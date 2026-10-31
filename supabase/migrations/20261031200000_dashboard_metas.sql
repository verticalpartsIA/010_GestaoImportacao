-- Dashboard — metas dos KPIs em tabela (nada de meta fixa no código). 31/10/2026.
-- Nasce FECHADA (Art. 26): só usuário ativo lê; só Administrador grava. Sem acesso para a chave pública.
create table if not exists public.dashboard_metas (
  chave          text primary key,
  valor          numeric not null check (valor > 0),
  descricao      text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);

alter table public.dashboard_metas enable row level security;

drop policy if exists dashboard_metas_ler on public.dashboard_metas;
create policy dashboard_metas_ler on public.dashboard_metas
  for select to authenticated using (public.vp_usuario_ativo());

drop policy if exists dashboard_metas_gravar on public.dashboard_metas;
create policy dashboard_metas_gravar on public.dashboard_metas
  for all to authenticated
  using (public.vp_eh_admin()) with check (public.vp_eh_admin());

revoke all on public.dashboard_metas from anon, public;

insert into public.dashboard_metas (chave, valor, descricao)
values ('conversao_lead_proposta', 25, 'Meta de conversão Lead→Proposta (%), mostrada no cartão do Comercial')
on conflict (chave) do nothing;
