-- Aviso automático à Engenharia quando o cliente assina (ou recusa) o Projeto de Instalação da Obra (05/10/2026).
-- Pedido do usuário depois do #701. Gatilho no banco, na mesma transação da assinatura (RPC public_cvs_assinar/_recusar),
-- então o aviso sai mesmo que ninguém da Engenharia esteja com o sistema aberto.
-- Destinatários: quem subiu o projeto (projetos_elevador_desenhos.enviado_por_email) + líderes ATIVOS do departamento
-- Engenharia (colaboradores_vpsistema). Sem ninguém, vira aviso global (nunca se perde).
-- Falha ao avisar NUNCA impede a assinatura de ser gravada (exception when others then null).
create or replace function public.projeto_instalacao_alertar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record; v_dest text[]; v_email text; v_ok boolean; v_titulo text; v_sub text; v_nome text; v_quando text;
begin
  if new.documento_tipo is distinct from 'projeto_instalacao' then return new; end if;
  if new.status not in ('assinado', 'recusado') or new.status is not distinct from old.status then return new; end if;
  begin
    select id, referencia, cliente_nome, numero_cotacao, lower(enviado_por_email) as enviado_por into d
      from public.projetos_elevador_desenhos where id::text = new.documento_id;
    if not found then return new; end if;

    v_ok := new.status = 'assinado';
    v_nome := coalesce(nullif(new.audit ->> 'signerName', ''), nullif(new.audit ->> 'refusedBy', ''), new.nome);
    v_quando := to_char(coalesce(new.signed_at, now()) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    v_titulo := case when v_ok then 'Projeto de Instalação assinado — ' else 'Projeto de Instalação RECUSADO — ' end || d.referencia;
    v_sub := case when v_ok
        then coalesce(v_nome, 'O cliente') || ' (' || coalesce(d.cliente_nome, 'cliente') || ') assinou em ' || v_quando || '. O PDF assinado já pode ser baixado em Projeto de Elevadores.'
        else coalesce(v_nome, 'O cliente') || ' (' || coalesce(d.cliente_nome, 'cliente') || ') recusou assinar'
             || case when nullif(new.audit ->> 'refusedReason', '') is not null then ' — motivo: ' || (new.audit ->> 'refusedReason') else '' end || '.' end;

    select array_agg(distinct e) into v_dest from (
      select d.enviado_por as e where d.enviado_por is not null and d.enviado_por <> ''
      union
      select lower(c.email) from public.colaboradores_vpsistema c
       where c.is_active is not false and c.is_department_lead and c.departamento ilike '%engenharia%'
         and c.email is not null and c.email <> ''
    ) t;

    if v_dest is null then
      insert into public.alertas (id, level, title, sub, module, destinatario_email, rota)
      values ('pi-' || new.id || '-' || new.status, case when v_ok then 'info' else 'warning' end, v_titulo, v_sub, 'Engenharia', null, '/engenharia/eng-projeto-elevadores')
      on conflict (id) do nothing;
    else
      foreach v_email in array v_dest loop
        insert into public.alertas (id, level, title, sub, module, destinatario_email, rota)
        values ('pi-' || new.id || '-' || new.status || '-' || md5(v_email), case when v_ok then 'info' else 'warning' end, v_titulo, v_sub, 'Engenharia', v_email, '/engenharia/eng-projeto-elevadores')
        on conflict (id) do nothing;
      end loop;
    end if;
  exception when others then
    raise warning '[projeto_instalacao_alertar] falhou: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.projeto_instalacao_alertar() from public, anon, authenticated;

drop trigger if exists trg_projeto_instalacao_alertar on public.documento_signatarios;
create trigger trg_projeto_instalacao_alertar
  after update of status on public.documento_signatarios
  for each row execute function public.projeto_instalacao_alertar();
