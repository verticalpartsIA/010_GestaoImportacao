-- Formulário de Coleta de Dados — Elevadores (Comercial)
-- Header (cadastro/fiscal/logística) + Unidades (equipamento por elevador)
-- Ver issue #66 (verticalpartsIA/010_GestaoImportacao)

-- 1) Extensão de clientes: campos fiscais que faltavam pro DIFAL e PF (home lift)
alter table public.clientes
  add column if not exists cpf text,
  add column if not exists tipo_pessoa text default 'PJ',
  add column if not exists inscricao_estadual text,
  add column if not exists contribuinte_icms boolean,
  add column if not exists endereco text;

alter table public.clientes
  drop constraint if exists clientes_tipo_pessoa_check;
alter table public.clientes
  add constraint clientes_tipo_pessoa_check check (tipo_pessoa in ('PF','PJ'));

-- 2) Header do formulário
create table if not exists public.formularios_elevador (
  id text primary key,
  lead_id text references public.leads(id),
  dossier_id text references public.dossier_obra(id),
  cliente_id uuid references public.clientes(id),
  canal text not null default 'assistido' check (canal in ('assistido','self_service','extracao')),
  token text unique,
  local_obra_cidade text,
  local_obra_estado text,
  endereco_obra text,
  prazo_desejado text,
  tipo_mao_de_obra text check (tipo_mao_de_obra in ('local','sao_paulo','sem_mao_de_obra')),
  responsavel_entrega text check (responsavel_entrega in ('cliente','verticalparts')),
  origem_venda text,
  status text not null default 'rascunho' check (status in ('rascunho','enviado','em_cotacao','concluido')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now()
);

create index if not exists formularios_elevador_lead_id_idx on public.formularios_elevador(lead_id);
create index if not exists formularios_elevador_dossier_id_idx on public.formularios_elevador(dossier_id);
create index if not exists formularios_elevador_token_idx on public.formularios_elevador(token);

-- 3) Unidades (uma linha por elevador dentro do mesmo formulário)
create table if not exists public.formularios_elevador_unidades (
  id text primary key,
  formulario_id text not null references public.formularios_elevador(id) on delete cascade,
  identificador text,
  tipo text,
  capacidade_kg numeric,
  capacidade_pessoas integer,
  velocidade_ms numeric,
  paradas integer,
  pavimentos_desc text,
  casa_maquinas text check (casa_maquinas in ('com','sem')),
  agrupamento text check (agrupamento in ('simplex','duplex','triplex','group')),
  porta_oposta text,
  estrutura_caixa text,
  caixa_largura_mm numeric,
  caixa_profundidade_mm numeric,
  percurso_mm numeric,
  overhead_mm numeric,
  poco_mm numeric,
  cabina_largura_mm numeric,
  cabina_profundidade_mm numeric,
  cabina_altura_mm numeric,
  piso_cabina text,
  corrimao text,
  porta_tipo_abertura text,
  porta_largura_mm numeric,
  porta_altura_mm numeric,
  acabamento_porta_cabina text,
  acabamento_porta_pavimento text,
  classe_corta_fogo text,
  tensao_principal text,
  tensao_iluminacao text,
  norma_projeto text,
  cop_lop_tipo text,
  ard boolean default false,
  camera boolean default false,
  anuncio_voz boolean default false,
  exigencias_especiais text,
  created_at timestamptz not null default now()
);

create index if not exists formularios_elevador_unidades_formulario_id_idx on public.formularios_elevador_unidades(formulario_id);

-- 4) RLS — mesmo padrão já usado em cotacoes/pedidos_fornecedor (acesso público
-- de leitura/escrita por token, sem restrição fina de linha; a segurança real é
-- o token ser imprevisível, não a política em si — replica o modelo existente).
alter table public.formularios_elevador enable row level security;
alter table public.formularios_elevador_unidades enable row level security;

drop policy if exists formularios_elevador_all_anon on public.formularios_elevador;
create policy formularios_elevador_all_anon on public.formularios_elevador
  for all to anon using (true) with check (true);
drop policy if exists formularios_elevador_all_auth on public.formularios_elevador;
create policy formularios_elevador_all_auth on public.formularios_elevador
  for all to authenticated using (true) with check (true);

drop policy if exists formularios_elevador_unidades_all_anon on public.formularios_elevador_unidades;
create policy formularios_elevador_unidades_all_anon on public.formularios_elevador_unidades
  for all to anon using (true) with check (true);
drop policy if exists formularios_elevador_unidades_all_auth on public.formularios_elevador_unidades;
create policy formularios_elevador_unidades_all_auth on public.formularios_elevador_unidades
  for all to authenticated using (true) with check (true);
