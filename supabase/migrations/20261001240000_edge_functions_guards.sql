-- ClaudeNotebook (issue #572): proteção das Edge Functions do Omie / webhook de lead.
--  1) api_rate_check(): limite de taxa genérico por bucket (função) + IP, janela configurável.
--  2) app_secrets + segredo_valido(): segredo compartilhado para chamadores que NÃO são o navegador
--     (pg_cron). O valor é gerado no banco na aplicação desta migration — NUNCA vai pro git.
-- Tudo SECURITY DEFINER e executável só pelo service_role (a Edge Function usa a chave de serviço).
-- Rollback: drop function public.api_rate_check(text,text,int,int,int); drop function public.segredo_valido(text,text);
--           drop table public.api_rate_log; drop table public.app_secrets;

create table if not exists public.api_rate_log (
  id        bigint generated always as identity primary key,
  bucket    text not null,
  ip        text,
  criado_em timestamptz not null default now()
);
create index if not exists api_rate_log_bucket_criado_idx on public.api_rate_log (bucket, criado_em);
alter table public.api_rate_log enable row level security; -- sem policies: só service_role
revoke all on public.api_rate_log from anon, authenticated;

create or replace function public.api_rate_check(p_bucket text, p_ip text, p_max_ip int, p_max_global int, p_janela_s int default 600)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_ip int; v_g int;
begin
  delete from public.api_rate_log where criado_em < now() - interval '1 day';
  select count(*) into v_g  from public.api_rate_log where bucket = p_bucket and criado_em > now() - make_interval(secs => p_janela_s);
  select count(*) into v_ip from public.api_rate_log where bucket = p_bucket and ip = p_ip and criado_em > now() - make_interval(secs => p_janela_s);
  if v_ip >= p_max_ip then return 'ip'; end if;
  if v_g  >= p_max_global then return 'global'; end if;
  insert into public.api_rate_log (bucket, ip) values (p_bucket, p_ip);
  return 'ok';
end $$;

create table if not exists public.app_secrets (
  nome      text primary key,
  valor     text not null,
  criado_em timestamptz not null default now()
);
alter table public.app_secrets enable row level security; -- sem policies: só service_role
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (nome, valor)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (nome) do nothing;

create or replace function public.segredo_valido(p_nome text, p_valor text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(p_valor, '') <> '' and exists (select 1 from public.app_secrets where nome = p_nome and valor = p_valor);
$$;

revoke execute on function public.api_rate_check(text, text, int, int, int) from public, anon, authenticated;
revoke execute on function public.segredo_valido(text, text)                from public, anon, authenticated;
grant  execute on function public.api_rate_check(text, text, int, int, int) to service_role;
grant  execute on function public.segredo_valido(text, text)                to service_role;
