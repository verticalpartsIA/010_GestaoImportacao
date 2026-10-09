-- Desenhos de elevador: vínculo com a obra (formulário/cotação) e com o cliente cadastrado.
-- Colunas aditivas e opcionais (desenhos antigos ficam com NULL).
alter table public.projetos_elevador_desenhos
  add column if not exists formulario_id text,
  add column if not exists cliente_id uuid,
  add column if not exists cliente_documento text;
create index if not exists projetos_elevador_desenhos_cliente_idx
  on public.projetos_elevador_desenhos (cliente_id) where excluido_em is null;
notify pgrst, 'reload schema';
