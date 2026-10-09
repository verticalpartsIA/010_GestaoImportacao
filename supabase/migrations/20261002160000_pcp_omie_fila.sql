-- PCP · etapa 2 (PCP → Omie): fila de tudo que o Almoxarife manda gravar no Omie.
-- Cada ação nasce aqui como 'pendente' ANTES de chamar o Omie; o resultado (ok/erro) e o
-- retorno do Omie ficam gravados — auditoria e nova tentativa. A chave de idempotência
-- (cod_int_ajuste / codIntReqCompra) impede lançar duas vezes a mesma ação no Omie.
create table if not exists public.pcp_omie_fila (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('requisicao_compra', 'ajuste_estoque')),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro')),
  chave text not null unique,
  solicitante_email text,
  payload jsonb not null,
  resposta jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists pcp_omie_fila_criado_idx on public.pcp_omie_fila (criado_em desc);

alter table public.pcp_omie_fila enable row level security;
create policy "pcp_omie_fila_leitura" on public.pcp_omie_fila for select using (true);
-- Escrita só pelo service_role (Edge Function pcp-omie-escrever); sem policy de insert/update pra anon.
