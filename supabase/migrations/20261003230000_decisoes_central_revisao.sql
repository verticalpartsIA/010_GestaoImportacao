-- Central de Decisões — revisão de 03/10/2026.
-- 1) Novo status `cancelada` (decisão que perdeu o sentido: cotação inexistente, margem dentro da regra, proposta descartada).
-- 2) Alerta individual para QUEM decide quando a decisão nasce (ou é liberada por dependência); resolve sozinho ao decidir/cancelar.
-- 3) Limpeza única dos resíduos de teste/legado + aprovadores de RH atualizados + contexto (cliente/valor) das pendentes.
-- 4) Cron diário que cancela decisão de cotação que não existe mais (sem formulário nem proposta há > 30 dias).
alter table public.decisoes_gerenciais drop constraint if exists decisoes_gerenciais_status_check;
alter table public.decisoes_gerenciais add constraint decisoes_gerenciais_status_check
  check (status = any (array['pendente','bloqueada_por_dependencia','aprovada','reprovada','cancelada']));

create or replace function public.decisoes_alertar_aprovadores() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text; v_titulo text; v_alvo text;
begin
  begin
    if new.status <> 'pendente' then
      -- saiu de pendente (decidida/cancelada): o aviso de "aguardando você" deixa de valer
      if tg_op = 'UPDATE' and old.status = 'pendente' then
        update public.alertas set resolved = true
         where starts_with(id, 'dec_nova_' || new.id::text) and not resolved;
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and old.status = 'pendente' then return new; end if;   -- já estava pendente
    v_titulo := case new.tipo
      when 'envio_proposta_gestor' then 'Envio de proposta — aprovação do Gestor Comercial'
      when 'envio_proposta_ceo' then 'Envio de proposta — aprovação do CEO'
      when 'contratacao_mao_obra_ceo' then 'Contratação de mão de obra — aprovação do CEO'
      when 'montador_entra_obra_rh' then 'Montador entra na obra — aprovação da Engenharia'
      when 'compra_equipamento_ceo' then 'Compra do equipamento — aprovação do CEO'
      when 'compra_varejo_logistica' then 'Compra de varejo — aprovação da Logística'
      when 'desconto_proposta' then 'Desconto em proposta'
      when 'pagamento_instalador_parcela' then 'Pagamento a instalador — aprovação do Gestor Comercial'
      else new.tipo end;
    v_alvo := coalesce(new.contexto->>'cliente', new.contexto->>'titulo', new.contexto->>'item', new.contexto->>'obra',
                       case when new.numero_cotacao is not null then 'Cotação Nº ' || new.numero_cotacao end, '');
    foreach v_email in array coalesce(new.aprovadores_esperados, '{}') loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values ('dec_nova_' || new.id::text || '_' || lower(v_email), 'warning', 'Decisão aguardando você',
              left(v_titulo || case when v_alvo <> '' then ' · ' || v_alvo else '' end, 480),
              'Central de Decisões', false, lower(v_email), '/geral/decisoes')
      on conflict (id) do nothing;
    end loop;
  exception when others then
    null;   -- o aviso nunca pode impedir a decisão de ser gravada
  end;
  return new;
end $$;

drop trigger if exists trg_decisoes_alertar_aprovadores on public.decisoes_gerenciais;
create trigger trg_decisoes_alertar_aprovadores after insert or update of status on public.decisoes_gerenciais
  for each row execute function public.decisoes_alertar_aprovadores();

-- Contexto (cliente/valor) das pendentes que nasceram sem isso.
update public.decisoes_gerenciais d
   set contexto = coalesce(d.contexto, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
         'cliente', coalesce(p.data_json->'cliente'->>'nome', p.titulo),
         'valor', p.valor_total))
  from public.propostas p
 where d.status in ('pendente', 'bloqueada_por_dependencia')
   and d.numero_cotacao is not null and p.numero_cotacao = d.numero_cotacao
   and coalesce(d.contexto->>'cliente', '') = '';

-- Aprovadores de RH: o snapshot antigo apontava para quem já não é o responsável do papel.
update public.decisoes_gerenciais
   set aprovadores_esperados = array['arilene.avila@verticalparts.com.br'], aprovador_esperado_email = 'arilene.avila@verticalparts.com.br'
 where status = 'pendente' and tipo = 'montador_entra_obra_rh';

-- Limpeza única (cancelada, não apagada: o histórico fica).
update public.decisoes_gerenciais set status = 'cancelada', decidido_por = 'sistema', decidido_em = now(), atualizado_em = now(),
       motivo = 'Cotação inexistente (resíduo de teste/legado) — cancelada na revisão de 03/10/2026'
 where status in ('pendente', 'bloqueada_por_dependencia') and numero_cotacao is not null
   and not exists (select 1 from public.formularios_elevador f where f.numero_cotacao = decisoes_gerenciais.numero_cotacao)
   and not exists (select 1 from public.propostas p where p.numero_cotacao = decisoes_gerenciais.numero_cotacao)
   and tipo in ('compra_equipamento_ceo', 'envio_proposta_gestor', 'envio_proposta_ceo');
update public.decisoes_gerenciais set status = 'cancelada', decidido_por = 'sistema', decidido_em = now(), atualizado_em = now(),
       motivo = 'Margem efetiva de 25,9% (>= 15%): o CEO não precisa decidir (regra de 28-29/09/2026)'
 where status = 'pendente' and tipo = 'compra_equipamento_ceo' and numero_cotacao = 955;

-- Expiração diária: decisão de cotação que não existe mais (sem formulário nem proposta) há mais de 30 dias.
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'decisoes-expirar-orfas-diario'; end $$;
select cron.schedule('decisoes-expirar-orfas-diario', '40 10 * * *', $$
  update public.decisoes_gerenciais set status = 'cancelada', decidido_por = 'sistema', decidido_em = now(), atualizado_em = now(),
         motivo = 'Cotação sem formulário nem proposta há mais de 30 dias — cancelada automaticamente'
   where status in ('pendente', 'bloqueada_por_dependencia') and numero_cotacao is not null
     and criado_em < now() - interval '30 days'
     and not exists (select 1 from public.formularios_elevador f where f.numero_cotacao = decisoes_gerenciais.numero_cotacao)
     and not exists (select 1 from public.propostas p where p.numero_cotacao = decisoes_gerenciais.numero_cotacao)
$$);
