-- PCP · Mão de obra (hora-homem) nas OPs.
-- O operador (com a alçada pcp.apontar_hh) escolhe QUEM trabalhou e QUANTAS HORAS. O valor da hora é buscado
-- no Omie (Contas a Pagar) pela Edge Function pcp-hh e NUNCA chega ao navegador de quem não tem a alçada pcp.ver_hh.
--
-- pcp_hh_apontamentos : quem/horas — leitura aberta; escrita só pela Edge Function (sem policy de insert/update/delete).
-- pcp_hh_custos / pcp_hh_valores / pcp_hh_vinculo / pcp_hh_config : dado salarial — RLS ligada e SEM policy alguma
--                                                                     (anon não lê nem grava; só service_role).
create table if not exists public.pcp_hh_apontamentos (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  etapa_id uuid references public.pcp_ordem_etapas(id) on delete set null,
  colaborador_email text not null,
  colaborador_nome text,
  departamento text,
  horas numeric not null check (horas > 0 and horas <= 1000),
  observacao text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pcp_hh_apontamentos_ordem_idx on public.pcp_hh_apontamentos (ordem_id);
alter table public.pcp_hh_apontamentos enable row level security;
create policy "pcp_hh_apontamentos_leitura" on public.pcp_hh_apontamentos for select using (true);

create table if not exists public.pcp_hh_custos (
  apontamento_id uuid primary key references public.pcp_hh_apontamentos(id) on delete cascade,
  valor_hora numeric,
  custo numeric,
  origem text,
  calculado_em timestamptz not null default now()
);
create table if not exists public.pcp_hh_valores (
  colaborador_email text primary key,
  valor_hora numeric,
  base_mensal numeric,
  competencia text,
  origem text,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.pcp_hh_vinculo (
  colaborador_email text primary key,
  omie_codigo bigint not null,
  omie_nome text,
  vinculado_em timestamptz not null default now()
);
create table if not exists public.pcp_hh_config (
  chave text primary key,
  valor text not null,
  descricao text
);
insert into public.pcp_hh_config (chave, valor, descricao) values
 ('horas_uteis_mes', '176', 'Horas trabalhadas por mês (22 dias × 8 h) usadas para dividir o custo mensal da pessoa'),
 ('fator_encargos', '1', 'Multiplicador sobre o valor lançado no Omie (1 = só o valor dos títulos; 1.8 = inclui encargos estimados)'),
 ('categorias', '2.03.78,2.03.87', 'Categorias do Omie (Contas a Pagar) somadas como custo mensal da pessoa: Salários Operacional e Administrativo'),
 ('meses_busca', '3', 'Quantos meses fechados para trás procurar o último com lançamento da pessoa'),
 ('validade_dias', '15', 'Dias em que um valor-hora consultado no Omie é reaproveitado antes de consultar de novo')
on conflict (chave) do nothing;
alter table public.pcp_hh_custos enable row level security;
alter table public.pcp_hh_valores enable row level security;
alter table public.pcp_hh_vinculo enable row level security;
alter table public.pcp_hh_config enable row level security;
