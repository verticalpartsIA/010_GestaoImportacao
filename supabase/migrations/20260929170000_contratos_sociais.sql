-- Repositório de Contratos Sociais (PDF) por cliente — Comercial | Pré-venda.
-- O vendedor identifica o cliente (cadastro `clientes`) e salva o PDF; o arquivo
-- vai pro bucket Storage `engenharia` (path contratos-sociais/{cliente_id}/...).
-- Soft-delete (excluido_em/excluido_por), mesmo padrão de leads/solicitações.
create table if not exists public.contratos_sociais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id),
  cliente_nome text not null,
  cliente_documento text,
  arquivo_nome text not null,
  arquivo_path text not null,
  arquivo_url text not null,
  tamanho_bytes bigint,
  observacao text,
  enviado_por_email text,
  enviado_por_nome text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);
create index if not exists contratos_sociais_cliente_idx on public.contratos_sociais (cliente_id) where excluido_em is null;

alter table public.contratos_sociais enable row level security;
-- App roda com a chave anon (sem sessão Auth real, ver src/supabase.js).
create policy "cs_leitura" on public.contratos_sociais for select using (true);
create policy "cs_insert" on public.contratos_sociais for insert with check (true);
create policy "cs_update" on public.contratos_sociais for update using (true) with check (true);
