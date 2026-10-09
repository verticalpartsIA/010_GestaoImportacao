-- ClaudeNotebook (issue #584): send-email deixa de ser relay aberto.
--  1) limite de taxa por IP e global (janela de 10 min) — email_rate_check()
--  2) allowlist: só destinatários já conhecidos no sistema — email_conhecidos()
-- Ambas as funções são SECURITY DEFINER e só o service_role pode executá-las (a Edge Function
-- usa a chave de serviço; anon/authenticated não chamam via /rest/v1/rpc).
-- Rollback: drop function public.email_rate_check(text,int,int,int); drop function public.email_conhecidos(text[]);
--           drop table public.email_envios_log;

create table if not exists public.email_envios_log (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  ip         text,
  n_dest     int not null default 1
);
create index if not exists email_envios_log_criado_em_idx on public.email_envios_log (criado_em);
alter table public.email_envios_log enable row level security; -- sem policies: só service_role acessa
revoke all on public.email_envios_log from anon, authenticated;

create or replace function public.email_rate_check(p_ip text, p_n int, p_max_ip int default 25, p_max_global int default 60)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_ip int; v_g int;
begin
  delete from public.email_envios_log where criado_em < now() - interval '1 day';
  select count(*) into v_g  from public.email_envios_log where criado_em > now() - interval '10 minutes';
  select count(*) into v_ip from public.email_envios_log where criado_em > now() - interval '10 minutes' and ip = p_ip;
  if v_ip >= p_max_ip then return 'ip'; end if;
  if v_g  >= p_max_global then return 'global'; end if;
  insert into public.email_envios_log (ip, n_dest) values (p_ip, p_n);
  return 'ok';
end $$;

-- Devolve, dos e-mails recebidos, os que já aparecem em algum cadastro/histórico do sistema.
create or replace function public.email_conhecidos(p_emails text[])
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(e), '{}'::text[])
  from unnest(p_emails) as e
  where length(trim(e)) > 3 and (
       exists (select 1 from public.clientes c                    where position(lower(e) in lower(coalesce(c.email, ''))) > 0)
    or exists (select 1 from public.fornecedores f                where position(lower(e) in lower(coalesce(f.email, ''))) > 0)
    or exists (select 1 from public.leads l                       where position(lower(e) in lower(coalesce(l.email, ''))) > 0)
    or exists (select 1 from public.colaboradores x               where position(lower(e) in lower(coalesce(x.email, ''))) > 0)
    or exists (select 1 from public.colaboradores_vpsistema x     where position(lower(e) in lower(coalesce(x.email, ''))) > 0)
    or exists (select 1 from public.parceiros_instaladores p      where position(lower(e) in lower(coalesce(p.email, ''))) > 0)
    or exists (select 1 from public.operadores_estrangeiros o     where position(lower(e) in lower(coalesce(o.email, ''))) > 0)
    or exists (select 1 from public.contrato_venda_signatarios s  where position(lower(e) in lower(coalesce(s.email, ''))) > 0)
    or exists (select 1 from public.documento_signatarios s       where position(lower(e) in lower(coalesce(s.email, ''))) > 0)
    or exists (select 1 from public.perfis p                      where position(lower(e) in lower(coalesce(p.email, ''))) > 0)
    or exists (select 1 from public.usuarios u                    where position(lower(e) in lower(coalesce(u.email, ''))) > 0)
    or exists (select 1 from public.convites v                    where position(lower(e) in lower(coalesce(v.email, ''))) > 0)
    or exists (select 1 from public.cotacoes_elevador_historico h where position(lower(e) in lower(coalesce(h.email_contato, ''))) > 0)
    or exists (select 1 from public.emails_projeto m              where position(lower(e) in lower(coalesce(m.de_email, '') || ' ' || coalesce(m.para::text, ''))) > 0)
  );
$$;

revoke execute on function public.email_rate_check(text, int, int, int) from public, anon, authenticated;
revoke execute on function public.email_conhecidos(text[])              from public, anon, authenticated;
grant  execute on function public.email_rate_check(text, int, int, int) to service_role;
grant  execute on function public.email_conhecidos(text[])              to service_role;
