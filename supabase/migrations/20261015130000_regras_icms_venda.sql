-- Regras de ICMS na venda (15/10/2026). A Precificação passa a achar a alíquota pela UF de destino
-- em vez do icms_venda_pct fixo de 4% (que é a alíquota interestadual de importado, Res. Senado 13/2012).
create table if not exists public.regras_icms_venda (
  id uuid primary key default gen_random_uuid(),
  uf_origem text not null default 'SP',
  uf_destino text not null,
  origem_mercadoria text not null default 'Estrangeira' check (origem_mercadoria in ('Estrangeira','Nacional')),
  ncm text,
  aliquota_pct numeric(7,5) not null check (aliquota_pct >= 0 and aliquota_pct <= 1),
  fundamento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create unique index if not exists regras_icms_venda_chave on public.regras_icms_venda (uf_origem, uf_destino, origem_mercadoria, coalesce(ncm, ''));
alter table public.regras_icms_venda enable row level security;
create policy regras_icms_venda_select on public.regras_icms_venda for select to anon, authenticated using (true);
-- Leitura aberta (alíquota não é segredo e a Precificação precisa dela); escrita só para usuário ativo autenticado.
create policy regras_icms_venda_insert on public.regras_icms_venda for insert to authenticated with check (public.vp_usuario_ativo());
create policy regras_icms_venda_update on public.regras_icms_venda for update to authenticated using (public.vp_usuario_ativo()) with check (public.vp_usuario_ativo());
insert into public.regras_icms_venda (uf_origem, uf_destino, origem_mercadoria, ncm, aliquota_pct, fundamento)
values ('SP','SP','Estrangeira','8428.10',0.12,'Venda interna em SP de elevador importado (NCM 8428.10): 12%, definido pelo Financeiro em 15/10/2026. Conferir com o contador o texto vigente do RICMS/SP.')
on conflict do nothing;
notify pgrst, 'reload schema';
