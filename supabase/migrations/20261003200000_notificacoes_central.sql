-- Central de Notificações — correções da análise de 03/10/2026.
-- 1) Arquivar POR PESSOA: notificacoes_lidas ganha `arquivada` (some da lista dessa pessoa; não mexe no alerta dos outros).
-- 2) Link padrão por origem: trigger BEFORE INSERT preenche `alertas.rota` quando o produtor não informou (antes só o PCP
--    informava e o clique caía no Dashboard). Só caminhos RELATIVOS de rotas conhecidas (a Central valida de novo no navegador).
-- 3) Expiração automática: alertas "info" somem da Central depois de 14 dias; os demais depois de 45 (resolved = true).
--    Antes NADA resolvia alerta (43 no banco, 0 resolvidos) e a lista só crescia.
-- 4) Limpeza única dos alertas de teste que ficaram abertos (TESTE-DOCSIG / TESTE-RECUSA / TESTE-REV-992).
alter table public.notificacoes_lidas add column if not exists arquivada boolean not null default false;
alter table public.notificacoes_lidas add column if not exists arquivada_em timestamptz;

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
    else null
  end
$$;

create or replace function public.alertas_rota_padrao() returns trigger
language plpgsql as $$
begin
  if new.rota is null then new.rota := public.alertas_rota_por_id(new.id); end if;
  return new;
end $$;

drop trigger if exists trg_alertas_rota_padrao on public.alertas;
create trigger trg_alertas_rota_padrao before insert on public.alertas
  for each row execute function public.alertas_rota_padrao();

update public.alertas set rota = public.alertas_rota_por_id(id) where rota is null;

-- Limpeza única: alertas de teste ainda abertos.
update public.alertas set resolved = true
 where not resolved and (id ilike '%teste%' or title ilike '%teste%');

-- Expiração diária (10:30 UTC = 07:30 de Brasília, depois dos alertas do PCP das 10:00 UTC).
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'alertas-expirar-diario';
end $$;
select cron.schedule('alertas-expirar-diario', '30 10 * * *', $$
  update public.alertas set resolved = true
   where not resolved and created_at is not null
     and ((level = 'info' and created_at < now() - interval '14 days') or created_at < now() - interval '45 days')
$$);
-- Aplica já a primeira rodada.
update public.alertas set resolved = true
 where not resolved and created_at is not null
   and ((level = 'info' and created_at < now() - interval '14 days') or created_at < now() - interval '45 days');
