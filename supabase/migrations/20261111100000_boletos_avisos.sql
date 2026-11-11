-- Financeiro & Preços › Boletos Avisos (11/11/2026, pedido do Gelson).
-- Clientes com boleto em aberto no Omie, semáforo (Em dia / Vence hoje / Atrasado), log de e-mails de aviso
-- (D-5, D-1, D0, D+1 e manual) e a resposta do cliente. Tela fechada: só Gelson, Diego e Juliana.
--
-- Tudo nasce com RLS fechada (Art. 26): sem política para a chave pública; leitura só de quem passa em
-- boletos_avisos_pode(); quem grava é a Edge Function `boletos-avisos` (chave de serviço).
-- O envio automático nasce DESLIGADO (boletos_avisos_config.envio_automatico = false).
-- Rollback: select cron.unschedule('boletos-avisos-sincronizar'); select cron.unschedule('boletos-avisos-automatico');
--           drop view public.boletos_avisos_resumo_v; drop table public.boletos_avisos_envio_itens, public.boletos_avisos_envios,
--           public.boletos_avisos_boletos, public.boletos_avisos_clientes, public.boletos_avisos_config;
--           drop function public.boletos_avisos_pode(); drop function public.boletos_avisos_email_permitido(text);

-- 1) Quem pode: lista fixa de 3 e-mails (nem Administrador entra por ser Administrador). Mudar a lista = nova migration.
create or replace function public.boletos_avisos_email_permitido(p_email text)
returns boolean language sql immutable security definer set search_path = public as $$
  select lower(coalesce(p_email, '')) = any (array[
    'gelson.simoes@verticalparts.com.br',
    'diego@verticalparts.com.br',
    'juliana@verticalparts.com.br'
  ]);
$$;
revoke all on function public.boletos_avisos_email_permitido(text) from public, anon, authenticated;
grant execute on function public.boletos_avisos_email_permitido(text) to service_role;

create or replace function public.boletos_avisos_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select (select public.vp_usuario_ativo())
     and public.boletos_avisos_email_permitido((select public.vp_email()));
$$;
revoke all on function public.boletos_avisos_pode() from public, anon;
grant execute on function public.boletos_avisos_pode() to authenticated, service_role;

-- 2) Configuração (uma linha)
create table if not exists public.boletos_avisos_config (
  id boolean primary key default true check (id),
  envio_automatico boolean not null default false,
  destino_teste text,                 -- se preenchido, TODO e-mail vai só para este endereço (modo teste)
  sincronizado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
insert into public.boletos_avisos_config (id) values (true) on conflict (id) do nothing;

-- 3) Clientes (e-mails vêm do Omie: faturamento; se vazio, o geral)
create table if not exists public.boletos_avisos_clientes (
  codigo_cliente_omie bigint primary key,
  razao_social text,
  cnpj text,
  emails text[] not null default '{}',
  email_origem text check (email_origem in ('faturamento', 'geral', 'nenhum')),
  emails_atualizado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- 4) Espelho dos boletos em aberto (só leitura do Omie; nunca escreve no Omie)
create table if not exists public.boletos_avisos_boletos (
  codigo_lancamento_omie bigint primary key,
  codigo_cliente_omie bigint not null,
  numero_documento text,
  numero_parcela text,
  numero_boleto text,
  linha_digitavel text,
  data_vencimento date not null,
  valor numeric(14, 2),
  status_omie text,
  aberto boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create index if not exists boletos_avisos_boletos_cliente_idx on public.boletos_avisos_boletos (codigo_cliente_omie) where aberto;

-- 5) Log de envios (imutável: nada é apagado nem alterado depois de gravado)
create table if not exists public.boletos_avisos_envios (
  id uuid primary key default gen_random_uuid(),
  codigo_cliente_omie bigint not null,
  cliente_razao text,
  etapa text not null check (etapa in ('D-5', 'D-1', 'D0', 'D+1', 'manual')),
  origem text not null check (origem in ('automatico', 'manual')),
  para text[] not null default '{}',
  assunto text,
  corpo text,
  boleto_ids bigint[] not null default '{}',
  message_id text,
  status text not null check (status in ('enviado', 'erro')),
  erro text,
  modo_teste boolean not null default false,
  enviado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists boletos_avisos_envios_cliente_idx on public.boletos_avisos_envios (codigo_cliente_omie, criado_em desc);

-- Um aviso automático por boleto e etapa (idempotência: rodar o cron duas vezes não manda duas vezes)
create table if not exists public.boletos_avisos_envio_itens (
  envio_id uuid not null references public.boletos_avisos_envios (id),
  codigo_lancamento_omie bigint not null,
  etapa text not null
);
create unique index if not exists boletos_avisos_envio_itens_uniq
  on public.boletos_avisos_envio_itens (codigo_lancamento_omie, etapa) where etapa <> 'manual';

create or replace function public.boletos_avisos_log_imutavel() returns trigger language plpgsql as $$
begin raise exception 'O log de avisos de boleto não pode ser alterado nem apagado.'; end $$;
drop trigger if exists trg_boletos_avisos_envios_imut on public.boletos_avisos_envios;
create trigger trg_boletos_avisos_envios_imut before update or delete on public.boletos_avisos_envios
  for each row execute function public.boletos_avisos_log_imutavel();
drop trigger if exists trg_boletos_avisos_itens_imut on public.boletos_avisos_envio_itens;
create trigger trg_boletos_avisos_itens_imut before update or delete on public.boletos_avisos_envio_itens
  for each row execute function public.boletos_avisos_log_imutavel();

-- 6) RLS fechada
alter table public.boletos_avisos_config       enable row level security;
alter table public.boletos_avisos_clientes     enable row level security;
alter table public.boletos_avisos_boletos      enable row level security;
alter table public.boletos_avisos_envios       enable row level security;
alter table public.boletos_avisos_envio_itens  enable row level security;

revoke all on public.boletos_avisos_config, public.boletos_avisos_clientes, public.boletos_avisos_boletos,
              public.boletos_avisos_envios, public.boletos_avisos_envio_itens from anon, authenticated;
grant select on public.boletos_avisos_config, public.boletos_avisos_clientes, public.boletos_avisos_boletos,
                public.boletos_avisos_envios, public.boletos_avisos_envio_itens to authenticated;
grant update (envio_automatico, destino_teste) on public.boletos_avisos_config to authenticated;
grant all on public.boletos_avisos_config, public.boletos_avisos_clientes, public.boletos_avisos_boletos,
             public.boletos_avisos_envios, public.boletos_avisos_envio_itens to service_role;

do $$
declare t text;
begin
  foreach t in array array['config', 'clientes', 'boletos', 'envios', 'envio_itens'] loop
    execute format('drop policy if exists boletos_avisos_%s_sel on public.boletos_avisos_%s', t, t);
    execute format('create policy boletos_avisos_%s_sel on public.boletos_avisos_%s for select to authenticated using ((select public.boletos_avisos_pode()))', t, t);
  end loop;
end $$;
drop policy if exists boletos_avisos_config_upd on public.boletos_avisos_config;
create policy boletos_avisos_config_upd on public.boletos_avisos_config for update to authenticated
  using ((select public.boletos_avisos_pode())) with check ((select public.boletos_avisos_pode()));

-- 7) Visão da lista fechada: um cliente por linha, semáforo e dias de atraso (data de Brasília)
create or replace view public.boletos_avisos_resumo_v with (security_invoker = true) as
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
agg as (
  select b.codigo_cliente_omie,
         count(*)                                              as qtd_boletos,
         sum(b.valor)                                          as valor_total,
         min(b.data_vencimento)                                as primeiro_vencimento,
         max(greatest((select d from hoje) - b.data_vencimento, 0)) as dias_atraso,
         bool_or(b.data_vencimento < (select d from hoje))     as tem_atrasado,
         bool_or(b.data_vencimento = (select d from hoje))     as vence_hoje
    from public.boletos_avisos_boletos b
   where b.aberto
   group by b.codigo_cliente_omie
)
select a.codigo_cliente_omie,
       coalesce(c.razao_social, 'Cliente ' || a.codigo_cliente_omie) as razao_social,
       c.cnpj,
       coalesce(c.emails, '{}') as emails,
       coalesce(c.email_origem, 'nenhum') as email_origem,
       a.qtd_boletos, a.valor_total, a.primeiro_vencimento, a.dias_atraso,
       case when a.tem_atrasado then 'atrasado' when a.vence_hoje then 'vence_hoje' else 'em_dia' end as situacao,
       u.criado_em as ultimo_aviso_em, u.etapa as ultimo_aviso_etapa, u.status as ultimo_aviso_status
  from agg a
  left join public.boletos_avisos_clientes c on c.codigo_cliente_omie = a.codigo_cliente_omie
  left join lateral (
    select e.criado_em, e.etapa, e.status
      from public.boletos_avisos_envios e
     where e.codigo_cliente_omie = a.codigo_cliente_omie
     order by e.criado_em desc limit 1
  ) u on true;
revoke all on public.boletos_avisos_resumo_v from anon, authenticated;
grant select on public.boletos_avisos_resumo_v to authenticated;
grant select on public.boletos_avisos_resumo_v to service_role;

-- 8) Rotinas (o envio automático só age se boletos_avisos_config.envio_automatico = true)
--    sincronizar: todo dia 06:00 BRT (09:00 UTC). automatico: seg–sex 08:30 BRT (11:30 UTC).
select cron.schedule(
  'boletos-avisos-sincronizar',
  '0 9 * * *',
  format($cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/boletos-avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'x-cron-secret', %L
    ),
    body := '{"acao":"sincronizar"}'::jsonb,
    timeout_milliseconds := 140000
  );
  $cmd$, (select valor from public.app_secrets where nome = 'cron_secret'))
);
select cron.schedule(
  'boletos-avisos-automatico',
  '30 11 * * 1-5',
  format($cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/boletos-avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'x-cron-secret', %L
    ),
    body := '{"acao":"automatico"}'::jsonb,
    timeout_milliseconds := 140000
  );
  $cmd$, (select valor from public.app_secrets where nome = 'cron_secret'))
);
