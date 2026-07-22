-- Cotação a Fornecedor — Elevadores: envio do "Inquiry Form" (RFQ técnico)
-- de cada Unidade para o fornecedor real (começando pela Glarie, que usa
-- dois modelos de formulário: "Elevator Inquiry Form" (geral) e "Homelift
-- Inquiry Form" — a escolha do modelo segue o Tipo da unidade). Mesmo
-- padrão já usado em pedidos_fornecedor: token público, link por
-- WhatsApp/E-mail/Link copiável, resposta do fornecedor grava direto no
-- banco (sem PDF, sem digitação manual). Ver conversa/issue de
-- acompanhamento.

create sequence if not exists public.cotacao_elevador_fornecedor_numero_seq;

create table if not exists public.cotacoes_elevador_fornecedor (
  id uuid primary key default gen_random_uuid(),
  numero_documento text not null unique,
  token text not null unique,

  formulario_elevador_id text not null references public.formularios_elevador(id) on delete cascade,
  fornecedor text not null,
  tipo_formulario text not null check (tipo_formulario in ('elevator', 'homelift')),
  unidade_ids jsonb not null default '[]'::jsonb,

  dados_envio jsonb not null default '{}'::jsonb,
  respostas jsonb not null default '{}'::jsonb,

  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'visualizado', 'respondido', 'expirado')),
  channel text,
  recipient jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz
);

create index if not exists cotacoes_elevador_fornecedor_formulario_idx on public.cotacoes_elevador_fornecedor (formulario_elevador_id);
create index if not exists cotacoes_elevador_fornecedor_token_idx on public.cotacoes_elevador_fornecedor (token);
create index if not exists cotacoes_elevador_fornecedor_status_idx on public.cotacoes_elevador_fornecedor (status);

alter table public.cotacoes_elevador_fornecedor enable row level security;
drop policy if exists cotacoes_elevador_fornecedor_all_anon on public.cotacoes_elevador_fornecedor;
create policy cotacoes_elevador_fornecedor_all_anon on public.cotacoes_elevador_fornecedor for all to anon using (true) with check (true);
drop policy if exists cotacoes_elevador_fornecedor_all_auth on public.cotacoes_elevador_fornecedor;
create policy cotacoes_elevador_fornecedor_all_auth on public.cotacoes_elevador_fornecedor for all to authenticated using (true) with check (true);

create or replace function public.gerar_numero_cotacao_elevador_fornecedor()
returns text
language sql
volatile
as $$
  select 'VPEL-' || lpad(nextval('public.cotacao_elevador_fornecedor_numero_seq')::text, 4, '0');
$$;

grant execute on function public.gerar_numero_cotacao_elevador_fornecedor() to anon, authenticated;
