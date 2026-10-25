-- Tratativas das Cotações de Varejo (lote × fornecedor), mostradas na RFQ Importação.
-- Mesmo papel de tratativas_cotacao (equipamentos), mas por CONVITE do lote.
-- Histórico imutável (sem update/delete) e SEM chave estrangeira de propósito: se o comprador remover o fornecedor do
-- lote, a conversa dele continua guardada (nome e nº do lote ficam gravados na própria linha).
create table if not exists public.iv_cotacao_tratativas (
  id uuid primary key default gen_random_uuid(),
  convite_id uuid not null,
  lote_id uuid not null,
  lote_numero text,
  fornecedor_nome text,
  autor text not null,
  mensagem text,
  anexos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists iv_cotacao_tratativas_convite_idx on public.iv_cotacao_tratativas (convite_id, created_at);
create index if not exists iv_cotacao_tratativas_lote_idx on public.iv_cotacao_tratativas (lote_id);

alter table public.iv_cotacao_tratativas enable row level security;

drop policy if exists vp_int_sel on public.iv_cotacao_tratativas;
drop policy if exists vp_int_ins on public.iv_cotacao_tratativas;
create policy vp_int_sel on public.iv_cotacao_tratativas for select to authenticated using ((select vp_usuario_ativo()));
create policy vp_int_ins on public.iv_cotacao_tratativas for insert to authenticated with check ((select vp_usuario_ativo()));

revoke all on public.iv_cotacao_tratativas from anon;
grant select, insert on public.iv_cotacao_tratativas to authenticated;
grant all on public.iv_cotacao_tratativas to service_role;
