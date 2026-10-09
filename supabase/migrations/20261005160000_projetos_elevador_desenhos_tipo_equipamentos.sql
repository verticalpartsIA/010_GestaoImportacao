-- Desenhos de elevador: cada obra sobe 2 documentos — Projeto de Instalação e ID-TAG —
-- e cada arquivo cita o(s) equipamento(s) (ex.: VPEL-EL0955-1). Colunas aditivas;
-- linhas antigas viram 'projeto_instalacao' com lista de equipamentos vazia.
alter table public.projetos_elevador_desenhos
  add column if not exists tipo_documento text not null default 'projeto_instalacao',
  add column if not exists equipamentos jsonb not null default '[]'::jsonb;
alter table public.projetos_elevador_desenhos
  drop constraint if exists projetos_elevador_desenhos_tipo_check;
alter table public.projetos_elevador_desenhos
  add constraint projetos_elevador_desenhos_tipo_check check (tipo_documento in ('projeto_instalacao','id_tag'));
notify pgrst, 'reload schema';
