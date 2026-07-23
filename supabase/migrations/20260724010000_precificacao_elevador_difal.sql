-- Precificação de Elevador (ADM/Financeiro) + DIFAL — módulo que herda o
-- "Cotação Nº" do Formulário de Elevadores, os custos já respondidos pelo
-- fornecedor (cotacoes_elevador_fornecedor) e calcula o preço de venda,
-- replicando a planilha "Modelo_Pricing_Elevador.xlsx" + a regra de negócio
-- tributária de DIFAL (árvore de decisão + tabela dos 27 estados).

-- ============================================================
-- 1) DIFAL — tabela de estados (categoria de base + alíquotas)
-- ============================================================
create table if not exists public.difal_estados (
  uf text primary key,
  estado text not null,
  categoria text not null check (categoria in (
    'Base Única', 'Base Única com FCP', 'Base Dupla Simples',
    'Base Dupla Composta', 'Base Dupla com FCP'
  )),
  aliquota_interna numeric not null,
  aliquota_interestadual_nacional numeric not null,
  aliquota_interestadual_estrangeira numeric not null,
  fundo_combate numeric not null default 0
);

alter table public.difal_estados enable row level security;
drop policy if exists difal_estados_all_anon on public.difal_estados;
create policy difal_estados_all_anon on public.difal_estados for all to anon using (true) with check (true);
drop policy if exists difal_estados_all_auth on public.difal_estados;
create policy difal_estados_all_auth on public.difal_estados for all to authenticated using (true) with check (true);

insert into public.difal_estados (uf, estado, categoria, aliquota_interna, aliquota_interestadual_nacional, aliquota_interestadual_estrangeira, fundo_combate) values
  ('AC', 'Acre', 'Base Única', 0.19, 0.07, 0.04, 0),
  ('AL', 'Alagoas', 'Base Dupla com FCP', 0.19, 0.07, 0.04, 0.01),
  ('AM', 'Amazonas', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('AP', 'Amapá', 'Base Única', 0.18, 0.07, 0.04, 0),
  ('BA', 'Bahia', 'Base Dupla Composta', 0.205, 0.07, 0.04, 0),
  ('CE', 'Ceará', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('DF', 'Distrito Federal', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('ES', 'Espírito Santo', 'Base Única', 0.17, 0.07, 0.04, 0),
  ('GO', 'Goiás', 'Base Dupla Simples', 0.19, 0.07, 0.04, 0),
  ('MA', 'Maranhão', 'Base Única', 0.23, 0.07, 0.04, 0),
  ('MT', 'Mato Grosso', 'Base Única', 0.17, 0.07, 0.04, 0),
  ('MS', 'Mato Grosso do Sul', 'Base Única', 0.17, 0.07, 0.04, 0),
  ('MG', 'Minas Gerais', 'Base Dupla Composta', 0.18, 0.12, 0.04, 0),
  ('PA', 'Pará', 'Base Dupla Composta', 0.19, 0.07, 0.04, 0),
  ('PB', 'Paraíba', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('PR', 'Paraná', 'Base Dupla Simples', 0.195, 0.12, 0.04, 0),
  ('PE', 'Pernambuco', 'Base Única', 0.205, 0.07, 0.04, 0),
  ('PI', 'Piauí', 'Base Única', 0.225, 0.07, 0.04, 0),
  ('RN', 'Rio Grande do Norte', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('RS', 'Rio Grande do Sul', 'Base Dupla Composta', 0.17, 0.12, 0.04, 0),
  ('RJ', 'Rio de Janeiro', 'Base Única com FCP', 0.20, 0.12, 0.04, 0.02),
  ('RO', 'Rondônia', 'Base Dupla Composta', 0.195, 0.07, 0.04, 0),
  ('RR', 'Roraima', 'Base Única', 0.20, 0.07, 0.04, 0),
  ('SC', 'Santa Catarina', 'Base Dupla Composta', 0.17, 0.12, 0.04, 0),
  ('SP', 'São Paulo', 'Base Dupla Composta', 0.18, 0.18, 0.18, 0),
  ('SE', 'Sergipe', 'Base Dupla com FCP', 0.19, 0.07, 0.04, 0.01),
  ('TO', 'Tocantins', 'Base Dupla Composta', 0.20, 0.07, 0.04, 0)
on conflict (uf) do nothing;

-- ============================================================
-- 2) Parâmetros fiscais — % regulatórios externos (PIS/COFINS/II/ICMS
-- importação, regime tributário, comissões/mark-up padrão). Não são
-- calculados por fórmula porque são definidos por lei — mudam com o
-- tempo (ex.: Reforma Tributária), por isso ficam num único registro
-- editável em vez de espalhados/hardcoded pelo código.
-- ============================================================
create table if not exists public.parametros_fiscais_elevador (
  id text primary key default 'default',
  regime_tributario text not null default 'Presumido' check (regime_tributario in ('Simples', 'Presumido', 'Real')),
  icms_importacao_pct numeric not null default 0.12,
  ipi_importacao_pct numeric not null default 0,
  pis_importacao_pct numeric not null default 0.021,
  cofins_importacao_pct numeric not null default 0.1025,
  ii_importacao_pct numeric not null default 0.20,
  icms_venda_pct numeric not null default 0.04,
  ipi_venda_pct numeric not null default 0,
  pis_venda_pct numeric not null default 0.0065,
  cofins_venda_pct numeric not null default 0.03,
  irpj_venda_pct numeric not null default 0.0132,
  csll_venda_pct numeric not null default 0.01188,
  irpj_adicional_pct numeric not null default 0.008,
  impostos_pagar_servicos_pct numeric not null default 0.16,
  mark_up_padrao_pct numeric not null default 0.392,
  comissao_consultoria_pct numeric not null default 0.05,
  comissao_vendedor_pct numeric not null default 0.02,
  comissao_indicacao_pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.parametros_fiscais_elevador enable row level security;
drop policy if exists parametros_fiscais_elevador_all_anon on public.parametros_fiscais_elevador;
create policy parametros_fiscais_elevador_all_anon on public.parametros_fiscais_elevador for all to anon using (true) with check (true);
drop policy if exists parametros_fiscais_elevador_all_auth on public.parametros_fiscais_elevador;
create policy parametros_fiscais_elevador_all_auth on public.parametros_fiscais_elevador for all to authenticated using (true) with check (true);

insert into public.parametros_fiscais_elevador (id) values ('default') on conflict (id) do nothing;

-- ============================================================
-- 3) Precificação — 1 registro por cálculo, herda o Cotação Nº do
-- Formulário de Elevadores e a resposta de custos do fornecedor.
-- ============================================================
create sequence if not exists public.precificacao_elevador_numero_seq;

create or replace function public.gerar_numero_precificacao_elevador()
returns text
language sql
volatile
as $$
  select 'VPPZ-' || lpad(nextval('public.precificacao_elevador_numero_seq')::text, 4, '0');
$$;

grant execute on function public.gerar_numero_precificacao_elevador() to anon, authenticated;

create table if not exists public.precificacoes_elevador (
  id uuid primary key default gen_random_uuid(),
  numero_documento text not null unique,
  formulario_elevador_id text not null references public.formularios_elevador(id) on delete cascade,
  numero_cotacao integer,
  cotacao_fornecedor_id uuid references public.cotacoes_elevador_fornecedor(id) on delete set null,

  -- despesas de importação (inputs manuais/vindos do fornecedor)
  vmle_usd numeric not null default 0,
  seguro_usd numeric not null default 0,
  frete_seguro_capatazia_usd numeric not null default 0,
  siscomex_rs numeric not null default 0,
  tx_cambial numeric not null default 0,
  outras_despesas_importacao_rs numeric not null default 0,

  -- despesas extras (algumas de outros departamentos — manuais por enquanto)
  despachante_desembaraco_rs numeric not null default 0,
  demurrage_rs numeric not null default 0,
  frete_interno_rs numeric not null default 0,
  armazenagem_rs numeric not null default 0,
  itens_instalacao_montagem jsonb not null default '[]'::jsonb,

  percentual_servicos numeric not null default 0.30,

  -- rateio por modelo/unidade (auto-preenchido a partir das Unidades)
  modelos jsonb not null default '[]'::jsonb,

  -- parâmetros usados nesse cálculo (snapshot — não muda retroativamente)
  parametros_fiscais_snapshot jsonb not null default '{}'::jsonb,

  -- alavancas do financeiro (podem sobrescrever o padrão do snapshot)
  mark_up_pct numeric,
  comissao_consultoria_pct numeric,
  comissao_vendedor_pct numeric,
  comissao_indicacao_pct numeric,

  -- DIFAL
  difal jsonb not null default '{}'::jsonb,

  -- resultado calculado (snapshot pra histórico/auditoria)
  resultado jsonb not null default '{}'::jsonb,

  status text not null default 'rascunho' check (status in ('rascunho', 'calculado', 'finalizado')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create index if not exists precificacoes_elevador_formulario_idx on public.precificacoes_elevador (formulario_elevador_id);
create index if not exists precificacoes_elevador_numero_cotacao_idx on public.precificacoes_elevador (numero_cotacao);

alter table public.precificacoes_elevador enable row level security;
drop policy if exists precificacoes_elevador_all_anon on public.precificacoes_elevador;
create policy precificacoes_elevador_all_anon on public.precificacoes_elevador for all to anon using (true) with check (true);
drop policy if exists precificacoes_elevador_all_auth on public.precificacoes_elevador;
create policy precificacoes_elevador_all_auth on public.precificacoes_elevador for all to authenticated using (true) with check (true);
