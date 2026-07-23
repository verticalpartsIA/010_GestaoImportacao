-- Anexos do Formulário de Elevadores — o cliente (Canal 2, link público)
-- pode anexar o projeto civil da obra (planta, memorial descritivo, DWG/PDF)
-- direto no formulário, pra o Comercial visualizar/baixar e extrair as
-- medidas manualmente (equivale a uma "entrevista" feita por documento em
-- vez de conversa). Mesmo padrão de bucket privado + URL assinada já usado
-- em fichas-imagens — projeto civil de obra é dado sensível do cliente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'formulario-elevador-anexos',
  'formulario-elevador-anexos',
  false, -- PRIVADO
  20971520, -- 20MB (plantas/DWG são maiores que fotos)
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/acad', 'application/x-dwg', 'application/dxf', 'image/vnd.dwg',
    'application/octet-stream' -- fallback: navegador nem sempre reconhece o MIME de DWG/DXF
  ]
)
on conflict (id) do nothing;

-- RLS do bucket: anon pode inserir/ler/deletar APENAS nesse bucket
-- (cliente sem login preenche pelo link público — mesma lógica de fichas-imagens).
drop policy if exists "formulario_elevador_anexos_anon_insert" on storage.objects;
create policy "formulario_elevador_anexos_anon_insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'formulario-elevador-anexos');

drop policy if exists "formulario_elevador_anexos_anon_select" on storage.objects;
create policy "formulario_elevador_anexos_anon_select"
  on storage.objects for select to anon
  using (bucket_id = 'formulario-elevador-anexos');

drop policy if exists "formulario_elevador_anexos_anon_delete" on storage.objects;
create policy "formulario_elevador_anexos_anon_delete"
  on storage.objects for delete to anon
  using (bucket_id = 'formulario-elevador-anexos');

-- Metadados dos anexos — tabela relacional própria (não jsonb embutido),
-- pra listar/remover sem reescrever um array a cada mudança.
create table if not exists public.formularios_elevador_anexos (
  id uuid primary key default gen_random_uuid(),
  formulario_id text not null references public.formularios_elevador(id) on delete cascade,
  categoria text not null default 'projeto_civil',
  nome_arquivo text not null,
  tamanho_bytes bigint,
  tipo_arquivo text,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists formularios_elevador_anexos_formulario_idx on public.formularios_elevador_anexos (formulario_id);

alter table public.formularios_elevador_anexos enable row level security;
drop policy if exists formularios_elevador_anexos_all_anon on public.formularios_elevador_anexos;
create policy formularios_elevador_anexos_all_anon on public.formularios_elevador_anexos for all to anon using (true) with check (true);
drop policy if exists formularios_elevador_anexos_all_auth on public.formularios_elevador_anexos;
create policy formularios_elevador_anexos_all_auth on public.formularios_elevador_anexos for all to authenticated using (true) with check (true);
