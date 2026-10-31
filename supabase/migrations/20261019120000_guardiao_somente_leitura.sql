-- Guardião (monitor diário rodado pelo Claude Code na VPS) — usuário de banco SOMENTE LEITURA.
--
-- Desenho (privilégio mínimo):
--   * Papel `guardiao_ro` nasce SEM LOGIN e SEM SENHA. A senha nunca entra no git:
--     depois de aplicar, um administrador ativa o login pelo SQL Editor do Supabase
--     (ver "ATIVAÇÃO" no fim deste arquivo).
--   * Sem GRANT em nenhuma tabela: o papel não lê dado de negócio (e-mails, clientes,
--     preços). O que o guardião precisa vem de UMA função, `public.guardiao_snapshot()`,
--     que devolve só contagens, nomes de tabela/política/função e status de crons.
--   * Transações sempre READ ONLY, timeout curto, no máximo 3 conexões.
--   * Catálogo do Postgres (pg_policies, pg_proc, pg_class...) continua legível como
--     para qualquer papel — é metadado, não dado.
--   * O padrão do Supabase concede EXECUTE a anon/authenticated em função nova no
--     schema public; por isso o REVOKE explícito desses papéis (não basta "from public").

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardiao_ro') then
    create role guardiao_ro nologin noinherit nosuperuser nocreatedb nocreaterole
      noreplication nobypassrls connection limit 3;
  end if;
end $$;

alter role guardiao_ro set default_transaction_read_only = on;
alter role guardiao_ro set statement_timeout = '15s';
alter role guardiao_ro set idle_in_transaction_session_timeout = '30s';

grant usage on schema public to guardiao_ro;

create or replace function public.guardiao_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
select jsonb_build_object(
  'gerado_em', now(),
  'tabelas', jsonb_build_object(
     'total', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relkind='r'),
     'sem_rls', (select coalesce(jsonb_agg(c.relname order by c.relname),'[]') from pg_class c
                 join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
     'sem_pk', (select coalesce(jsonb_agg(c.relname order by c.relname),'[]') from pg_class c
                join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and c.relkind='r'
                  and not exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p')),
     'com_politica_anon_public', (select count(distinct tablename) from pg_policies
                where schemaname='public' and (roles::text like '%anon%' or roles::text like '%public%'))),
  'politicas_abertas_por_comando', (select coalesce(jsonb_object_agg(cmd, n),'{}') from (
     select cmd, count(distinct tablename) n from pg_policies
     where schemaname='public' and (roles::text like '%anon%' or roles::text like '%public%')
       and coalesce(qual,'true')='true' and coalesce(with_check,'true')='true'
     group by cmd) s),
  'criticas_abertas', (select coalesce(jsonb_agg(jsonb_build_object(
        'tabela',tablename,'politica',policyname,'cmd',cmd,'papeis',roles::text) order by tablename, cmd),'[]')
     from pg_policies
     where schemaname='public' and (roles::text like '%anon%' or roles::text like '%public%')
       and tablename = any(array['decisoes_gerenciais','avais_financeiros','avais_juridicos',
         'documento_signatarios','contrato_venda_signatarios','contrato_instalador_parcelas',
         'contratos_instalador','contratos_venda_equipamentos','propostas','precificacoes_elevador',
         'cotacoes_elevador_fornecedor','clientes','emails_projeto','perfis','alcadas_capacidade',
         'app_secrets','pcp_hh_custos','estoque_movimentos'])),
  'funcoes_definer_anon', (select coalesce(jsonb_agg(p.proname order by p.proname),'[]')
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'migrations', jsonb_build_object(
     'total', (select count(*) from supabase_migrations.schema_migrations),
     'ultimas', (select coalesce(jsonb_agg(jsonb_build_object('versao',version,'nome',name) order by version desc),'[]')
                 from (select version, name from supabase_migrations.schema_migrations
                       order by version desc limit 30) m)),
  'crons', jsonb_build_object(
     'ativos', (select count(*) from cron.job where active),
     'com_falha_24h', (select coalesce(jsonb_agg(jsonb_build_object('job',jobname,'falhas',f)),'[]') from (
        select j.jobname, count(*) f from cron.job j join cron.job_run_details d on d.jobid=j.jobid
        where d.start_time > now()-interval '24 hours' and d.status<>'succeeded' group by 1) x)),
  'http_24h', (select jsonb_build_object('total',count(*),
        'timeouts',count(*) filter (where timed_out),
        'erros_http',count(*) filter (where status_code>=400))
     from net._http_response where created > now()-interval '24 hours'),
  'sync_pcp_24h', (select coalesce(jsonb_agg(jsonb_build_object('escopo',escopo,'tudo_ok',ok_all,'ultima',ultima)),'[]')
     from (select escopo, bool_and(ok) ok_all, max(iniciado_em) ultima from pcp_sync_log
           where iniciado_em > now()-interval '24 hours' group by 1) s),
  'fluxo_pendentes_parados', (select count(*) from fluxo_pendentes
     where status <> 'concluido' and criado_em < now()-interval '1 day'),
  'integridade', jsonb_build_object(
     'propostas_valor_zero', (select count(*) from propostas
        where precificacao_id is not null and coalesce(valor_total,0)=0),
     'pi_orfas', (select count(*) from pi_importacao pi where pi.embarque_id is not null
        and not exists(select 1 from embarques_importacao e where e.id=pi.embarque_id)),
     'espelhos_sem_origem', (select count(*) from embarques where origem_embarque_importacao_id is null),
     'decisoes_pendentes', (select count(*) from decisoes_gerenciais where status='pendente'))
);
$$;

comment on function public.guardiao_snapshot() is
  'Guardião (monitor diário, só leitura): contagens e metadados de segurança/saúde. Sem dado pessoal. Só o papel guardiao_ro executa.';

revoke all on function public.guardiao_snapshot() from public, anon, authenticated;
grant execute on function public.guardiao_snapshot() to guardiao_ro;

-- ATIVAÇÃO (rodar UMA vez, à mão, no SQL Editor do Supabase — NÃO commitar a senha):
--   alter role guardiao_ro with login password '<senha forte gerada na hora>';
-- Conexão do guardião (pooler, modo sessão), usuário no formato papel.projeto:
--   usuário:  guardiao_ro.jxtqwzmpgofwctqajewt
--   host:     o "Session pooler" de Project Settings > Database
-- Consulta diária:  select public.guardiao_snapshot();
-- Desativar:        alter role guardiao_ro nologin;
-- Remover:          drop function public.guardiao_snapshot(); drop role guardiao_ro;
