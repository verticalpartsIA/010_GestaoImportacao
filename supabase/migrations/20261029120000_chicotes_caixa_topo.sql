-- Lista dos códigos VPEL dos chicotes da caixa de topo (VPB-193). Um chicote por conector; o código é cadastrado depois pela Engenharia.
-- Nasce FECHADA (mesmo padrão da lista de fios): lê usuário ativo; grava só quem tem a alçada lista-fios.editar ou Administrador.
create table if not exists public.chicotes_caixa_topo (
  chave text primary key,
  codigo text,
  atualizado_em timestamptz not null default now()
);
alter table public.chicotes_caixa_topo enable row level security;
revoke all on public.chicotes_caixa_topo from anon;
drop policy if exists chicotes_caixa_topo_ler on public.chicotes_caixa_topo;
create policy chicotes_caixa_topo_ler on public.chicotes_caixa_topo for select to authenticated using (public.vp_usuario_ativo());
drop policy if exists chicotes_caixa_topo_gravar on public.chicotes_caixa_topo;
create policy chicotes_caixa_topo_gravar on public.chicotes_caixa_topo for all to authenticated
  using (public.vp_eh_admin() or public.vp_tem_capacidade('lista-fios','editar'))
  with check (public.vp_eh_admin() or public.vp_tem_capacidade('lista-fios','editar'));
grant select, insert, update, delete on public.chicotes_caixa_topo to authenticated;
