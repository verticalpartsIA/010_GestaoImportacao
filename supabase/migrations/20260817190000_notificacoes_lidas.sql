-- #275: persistência real de "lido" em Notificações (Candidato 2 da revisão
-- de arquitetura) — substitui o array em localStorage (chave
-- vpprd.notificacoes.lidas), que se perdia ao limpar o cache do navegador
-- e não sincronizava entre dispositivos do mesmo usuário.
create table if not exists public.notificacoes_lidas (
  id uuid primary key default gen_random_uuid(),
  alerta_id text not null,
  user_email text not null,
  lido_em timestamptz not null default now(),
  unique (alerta_id, user_email)
);

create index if not exists idx_notificacoes_lidas_user_email on public.notificacoes_lidas(user_email);

alter table public.notificacoes_lidas enable row level security;

-- Padrão do projeto: acesso via anon key do browser (SSO na camada da aplicação).
create policy "notificacoes_lidas_anon_all" on public.notificacoes_lidas for all to anon using (true) with check (true);
create policy "notificacoes_lidas_auth_all" on public.notificacoes_lidas for all to authenticated using (true) with check (true);
