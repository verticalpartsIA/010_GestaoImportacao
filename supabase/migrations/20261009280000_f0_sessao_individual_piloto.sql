-- F0 (Gelson, 09/10/2026): o banco do HUB passa a saber QUEM pede cada dado.
-- O site manda a sessão individual da pessoa (obtida do login do vpsistema pela
-- edge function sso-exchange) em vez da chave pública — começando por um PILOTO.
--
-- 1. As 13 tabelas que só tinham regra para a chave pública (`anon`) ganham a
--    MESMA regra para sessão individual (`authenticated`). Nada novo fica aberto:
--    é exatamente o acesso que a chave pública já tem hoje. O fechamento por
--    pessoa vem nas fases seguintes (F1: R$ desfocado; F2: demais tabelas).
-- 2. Lista de piloto `vp_auth_piloto`: quem está nela usa a sessão individual
--    ('*' = todo mundo). Ligar/desligar = incluir/remover linha; vale no próximo
--    carregamento do site, sem publicar nada. O site pergunta via vp_auth_modo().

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'contract_drafts', 'contratos_instalador', 'equipamentos_obra',
    'fichas_lib_campos', 'fichas_lib_categorias', 'fichas_relatorio_confiabilidade',
    'fichas_tecnicas', 'minutas', 'produtos', 'proposta_itens', 'propostas',
    'solicitacoes_produto'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)',
                   t || '_all_authenticated', t);
  end loop;
end $$;

create table if not exists public.vp_auth_piloto (
  email       text primary key check (email = lower(email)),
  incluido_em timestamptz not null default now(),
  motivo      text
);
alter table public.vp_auth_piloto enable row level security;
revoke all on public.vp_auth_piloto from anon, authenticated;

create or replace function public.vp_auth_modo()
returns text
language sql stable security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.vp_auth_piloto
                 where email in ('*', lower(coalesce(auth.jwt() ->> 'email', ''))))
      then 'on'
    else 'shadow'
  end
$$;
revoke all on function public.vp_auth_modo() from public, anon;
grant execute on function public.vp_auth_modo() to authenticated;

insert into public.vp_auth_piloto (email, motivo)
values ('gelson.simoes@verticalparts.com.br', 'piloto F0 — 09/10/2026')
on conflict (email) do nothing;
