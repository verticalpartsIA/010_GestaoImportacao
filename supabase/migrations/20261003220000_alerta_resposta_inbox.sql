-- Central de Notificações · alerta de RESPOSTA no Inbox (autorizado pelo usuário em 03/10/2026).
-- Quando chega um e-mail de ENTRADA já vinculado a uma cotação/proposta/contrato (Message-ID = 'certo' ou assunto = 'provavel'),
-- grava um alerta em `alertas` com link para o Inbox. É um trigger AFTER INSERT em emails_projeto: NÃO altera send-email,
-- read-inbox, o vínculo/matching nem o soft-delete (área blindada de E-mail). Qualquer falha aqui é engolida de propósito:
-- o alerta nunca pode impedir um e-mail de ser gravado. O upsert do cron (mesmo imap_uid) não dispara de novo (só INSERT novo).
-- id determinístico `inbox-<id do e-mail>` + ON CONFLICT DO NOTHING = no máximo 1 alerta por e-mail.
create or replace function public.alertas_inbox_resposta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
  v_cot  text;
  v_quem text;
begin
  begin
    if new.direcao is distinct from 'entrada' then return new; end if;
    if new.excluido_em is not null then return new; end if;
    if new.numero_cotacao is null and new.referencia_id is null then return new; end if;            -- só e-mail vinculado
    if new.data_mensagem is not null and new.data_mensagem < now() - interval '7 days' then return new; end if;   -- importação de histórico não vira alerta

    v_cot  := case when new.numero_cotacao is not null then ' Nº ' || new.numero_cotacao else '' end;
    v_quem := coalesce(nullif(trim(new.de_nome), ''), new.de_email, 'remetente');
    v_tipo := case new.referencia_tipo
      when 'cotacao_fornecedor' then 'Fornecedor respondeu a cotação' || v_cot
      when 'tratativa_cotacao'  then 'Fornecedor respondeu a tratativa da cotação' || v_cot
      when 'proposta'           then 'Cliente respondeu a proposta' || v_cot
      when 'contrato_venda'     then 'Cliente respondeu o contrato de venda' || v_cot
      when 'contrato_instalador' then 'Instalador respondeu o contrato' || v_cot
      else 'Resposta por e-mail' || case when v_cot <> '' then ' — cotação' || v_cot else '' end
    end;

    insert into public.alertas (id, level, title, sub, module, resolved, rota)
    values ('inbox-' || new.id::text, 'warning', v_tipo,
            left(v_quem || ' · ' || coalesce(new.assunto, '(sem assunto)') || ' · abra o Inbox e responda.', 480),
            'Inbox', false, '/geral/inbox')
    on conflict (id) do nothing;
  exception when others then
    null;   -- nunca bloquear a gravação do e-mail por causa do alerta
  end;
  return new;
end $$;

drop trigger if exists trg_alertas_inbox_resposta on public.emails_projeto;
create trigger trg_alertas_inbox_resposta after insert on public.emails_projeto
  for each row execute function public.alertas_inbox_resposta();

-- Link padrão por prefixo também para `inbox-` (caso algum produtor futuro não informe a rota).
create or replace function public.alertas_rota_por_id(p_id text) returns text
language sql immutable as $$
  select case
    when p_id like 'prop-%'      then '/comercial/propostas'
    when p_id like 'cv-%'        then '/juridico/contrato-venda-equipamentos'
    when p_id like 'ci-%'        then '/juridico/contrato-instalador'
    when p_id like 'dec\_%'      then '/geral/decisoes'
    when p_id like 'estouro-%'   then '/adm-financeiro/aval-financeiro'
    when p_id like 'avais-%'     then '/adm-financeiro/aval-financeiro'
    when p_id like 'fw-%'        then '/engenharia/ficha-tecnica'
    when p_id like 'sol-%'       then '/engenharia/solicitacoes-produto'
    when p_id like 'vist%'       then '/engenharia/dossier-obra'
    when p_id like 'pf-%'        then '/adm-financeiro/cotacoes-fornecedor'
    when p_id like 'inbox-%'     then '/geral/inbox'
    else null
  end
$$;
