-- Precificação de Escada/Esteira Rolante (05/11/2026, cotação 1009).
-- Escada e esteira passam pela fila da Precificação, mas SEM motor de cálculo:
-- o Financeiro vê o custo do fornecedor e lança o preço de venda por equipamento.
-- Tabela própria (não mistura com precificacoes_elevador, que é toda do motor de
-- elevador e é lida pela Proposta de elevador por numero_cotacao).
-- Nasce FECHADA (Art. 26): só usuário ativo com a alçada do módulo 'precificacao'.

create table if not exists public.precificacoes_escada_esteira (
  id uuid primary key default gen_random_uuid(),
  numero_documento text not null unique,
  numero_cotacao integer,
  formulario_elevador_id text not null,
  cotacao_fornecedor_id uuid,
  categoria text not null check (categoria in ('escada_rolante','esteira_rolante')),
  status text not null default 'rascunho' check (status in ('rascunho','finalizado')),
  -- [{unidadeId, identificador, modelo, quantidade, custoUnitarioUsd, precoVendaUnit}]
  itens jsonb not null default '[]'::jsonb,
  observacao text,
  aprovado_em timestamptz,
  aprovado_por text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists precificacoes_escada_esteira_cot_idx on public.precificacoes_escada_esteira (numero_cotacao);
create index if not exists precificacoes_escada_esteira_cotforn_idx on public.precificacoes_escada_esteira (cotacao_fornecedor_id);

alter table public.precificacoes_escada_esteira enable row level security;
revoke all on public.precificacoes_escada_esteira from anon, authenticated;
grant select, insert, update on public.precificacoes_escada_esteira to authenticated;
grant all on public.precificacoes_escada_esteira to service_role;

drop policy if exists pzee_sel on public.precificacoes_escada_esteira;
create policy pzee_sel on public.precificacoes_escada_esteira for select to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('precificacao', 'ver')));

drop policy if exists pzee_ins on public.precificacoes_escada_esteira;
create policy pzee_ins on public.precificacoes_escada_esteira for insert to authenticated
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('precificacao', 'criar')));

drop policy if exists pzee_upd on public.precificacoes_escada_esteira;
create policy pzee_upd on public.precificacoes_escada_esteira for update to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('precificacao', 'editar')))
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('precificacao', 'editar')));

notify pgrst, 'reload schema';
