-- Entrega & Documentação › Repositório Documentos — repositório genérico de upload.
-- Independente de Central de Documentos/Data Book & Termo/Entrega Final (telas
-- que já existiam e continuam intocadas): a Engenharia sobe aqui qualquer
-- documento que ache necessário guardar, sem vínculo com cliente/obra/cotação.
-- Arquivo vai pro bucket Storage `engenharia` (já existente); esta tabela só
-- guarda os metadados. Soft-delete (excluido_em/excluido_por), mesmo padrão
-- de contratos_sociais/projetos_elevador_desenhos.
-- Nasce FECHADA (plano #571, mesma classe de etiqueta_modelos/lista-fios):
-- só usuário ativo com a alçada do módulo 'repositorio-documentos' lê/grava;
-- Administrador passa sempre (vp_tem_capacidade já inclui vp_eh_admin()).

create table if not exists public.repositorio_documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  descricao text,
  arquivo_nome text not null,
  arquivo_path text not null,
  arquivo_url text not null,
  tamanho_bytes bigint,
  enviado_por_email text,
  enviado_por_nome text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);
create index if not exists repositorio_documentos_ativos_idx on public.repositorio_documentos (criado_em desc) where excluido_em is null;

alter table public.repositorio_documentos enable row level security;
revoke all on public.repositorio_documentos from anon, authenticated;
grant select, insert, update on public.repositorio_documentos to authenticated;
grant all on public.repositorio_documentos to service_role;

drop policy if exists repdoc_sel on public.repositorio_documentos;
create policy repdoc_sel on public.repositorio_documentos for select to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('repositorio-documentos', 'ver')));

drop policy if exists repdoc_ins on public.repositorio_documentos;
create policy repdoc_ins on public.repositorio_documentos for insert to authenticated
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('repositorio-documentos', 'criar')));

-- Update só serve pro soft-delete: exige a linha ainda não excluída e a
-- alçada 'excluir' (o front só chama update pra isso — nunca pra editar
-- título/descrição de um documento já salvo).
drop policy if exists repdoc_upd on public.repositorio_documentos;
create policy repdoc_upd on public.repositorio_documentos for update to authenticated
  using ((select public.vp_usuario_ativo()) and excluido_em is null and (select public.vp_tem_capacidade('repositorio-documentos', 'excluir')))
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('repositorio-documentos', 'excluir')));

notify pgrst, 'reload schema';
