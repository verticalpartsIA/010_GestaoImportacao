-- Repositório de desenhos/projetos de elevadores (Engenharia › Projeto de Elevadores, aba "Desenhos").
-- A Engenharia guarda os arquivos (PDF/DWG/imagem) para o vendedor enviar ao cliente.
-- Arquivo vai pro bucket Storage `engenharia` (path projetos-elevador/desenhos/{cotação ou avulso}/...).
-- Soft-delete (excluido_em/excluido_por), mesmo padrão de contratos_sociais.
-- Independente de `projetos_elevador` (formulário de especificação técnica, intacto).
create table if not exists public.projetos_elevador_desenhos (
  id uuid primary key default gen_random_uuid(),
  referencia text not null,
  cliente_nome text,
  numero_cotacao integer,
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
create index if not exists projetos_elevador_desenhos_cotacao_idx
  on public.projetos_elevador_desenhos (numero_cotacao) where excluido_em is null;

alter table public.projetos_elevador_desenhos enable row level security;
-- App roda com a chave anon (sem sessão Auth real, ver src/supabase.js). Sem policy de DELETE de propósito.
create policy "ped_leitura" on public.projetos_elevador_desenhos for select using (true);
create policy "ped_insert" on public.projetos_elevador_desenhos for insert with check (true);
create policy "ped_update" on public.projetos_elevador_desenhos for update using (true) with check (true);

notify pgrst, 'reload schema';
