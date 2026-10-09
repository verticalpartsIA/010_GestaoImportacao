-- PCP · Pedido de quadro de comando → OP-mãe + uma OP por frente (quadro, fiação, botoeiras).
-- A OP-mãe é o pedido (sem produto); cada frente tem etapas/responsável próprios.
-- Checklist de separação (portas, máquina, itens de botoeira) vive em pcp_ordem_checklist.
alter table public.pcp_ordens alter column produto drop not null;
alter table public.pcp_ordens add column if not exists titulo text;
alter table public.pcp_ordens add column if not exists ordem_mae_id uuid references public.pcp_ordens(id);
alter table public.pcp_ordens add column if not exists frente text;                 -- pedido | quadro | fiacao | botoeiras | ...
alter table public.pcp_ordens add column if not exists quadro_comando_id uuid;      -- pedido de origem (quadros_comando)
create index if not exists pcp_ordens_mae_idx on public.pcp_ordens (ordem_mae_id);
create index if not exists pcp_ordens_quadro_idx on public.pcp_ordens (quadro_comando_id);
alter table public.pcp_ordem_materiais add column if not exists descricao text;
alter table public.pcp_ordem_materiais add column if not exists unidade text;

create table if not exists public.pcp_ordem_checklist (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  posicao int not null default 0,
  grupo text,
  descricao text not null,
  quantidade numeric,
  unidade text,
  observacao text,
  feito boolean not null default false,
  feito_por text,
  feito_em timestamptz
);
create index if not exists pcp_ordem_checklist_ordem_idx on public.pcp_ordem_checklist (ordem_id, posicao);
alter table public.pcp_ordem_checklist enable row level security;
create policy "pcp_ordem_checklist_leitura" on public.pcp_ordem_checklist for select using (true);
create policy "pcp_ordem_checklist_insert" on public.pcp_ordem_checklist for insert with check (true);
create policy "pcp_ordem_checklist_update" on public.pcp_ordem_checklist for update using (true) with check (true);

-- Variante do quadro (potência_tensão) → produto do PCP.
create table if not exists public.pcp_quadro_variante (
  variante text primary key,
  codigo_produto text,
  observacao text
);
insert into public.pcp_quadro_variante (variante, codigo_produto, observacao) values
 ('7.5_220', 'VPEL-702b', 'Quadro 7,5 kW / 220 V'),
 ('15_220', 'VPEL-710a', 'Quadro 15 kW / 220 V'),
 ('15_380', 'VPEL-704b', 'Quadro 15 kW / 380 V'),
 ('30_380', 'VPEL-709b', 'Quadro 30 kW / 380 V'),
 ('7.5_380', null, 'Sem produto no Omie — definir ao gerar a OP')
on conflict (variante) do nothing;
alter table public.pcp_quadro_variante enable row level security;
create policy "pcp_quadro_variante_leitura" on public.pcp_quadro_variante for select using (true);
