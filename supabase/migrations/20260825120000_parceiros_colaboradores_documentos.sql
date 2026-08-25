-- Expande o modelo de parceiros instaladores pra suportar homologação por
-- PESSOA (colaborador), não só por empresa — a planilha real de controle
-- (Empresas/Colaboradores/Documentos, Felipe, 25/08) mostra 54 colaboradores
-- e 79 tipos de documento com vencimento individual, algo que o jsonb de
-- 5 certificações fixas em parceiros_instaladores não representa.

create table if not exists parceiros_colaboradores (
  id text primary key,
  empresa_id text not null references parceiros_instaladores(id),
  nome_completo text not null,
  cpf text,
  rg text,
  cnh text,
  tipo_vinculo text,
  endereco_logradouro text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cep text,
  endereco_cidade text,
  endereco_estado text,
  status text default 'Ativo',
  observacao text,
  origem_planilha_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists parceiros_doc_catalogo (
  id text primary key,
  nome text not null,
  escopo text not null check (escopo in ('colaborador', 'empresa', 'obra_compliance')),
  periodicidade text,
  obrigatorio boolean default true,
  observacao text
);

create table if not exists parceiros_documentos_colaborador (
  id text primary key,
  colaborador_id text not null references parceiros_colaboradores(id),
  documento_id text not null references parceiros_doc_catalogo(id),
  data_emissao date,
  data_vencimento date,
  status text,
  arquivo_link text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists parceiros_documentos_empresa (
  id text primary key,
  empresa_id text not null references parceiros_instaladores(id),
  documento_id text not null references parceiros_doc_catalogo(id),
  data_emissao date,
  data_vencimento date,
  status text,
  arquivo_link text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_parceiros_colaboradores_empresa on parceiros_colaboradores(empresa_id);
create index if not exists idx_parceiros_documentos_colaborador_colaborador on parceiros_documentos_colaborador(colaborador_id);
create index if not exists idx_parceiros_documentos_empresa_empresa on parceiros_documentos_empresa(empresa_id);
