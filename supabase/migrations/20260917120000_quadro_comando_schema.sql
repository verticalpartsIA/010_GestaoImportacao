-- Módulo Quadro de Comando (Fase 1 — schema base)
-- Cobre os dois ramos: fabricar interno (BOM + lista de corte + checklist de
-- separação) e comprar pronto de fornecedor (reusa cotacoes_elevador_fornecedor,
-- só precisa da categoria 'quadro_comando' já existente naquela tabela).
-- Ver conversa/instrução original: relação de corte de cabo de manobra e
-- fiação fixa do passadiço, com memória de cálculo e nível de confiança.

-- ---------- Catálogo de materiais (não existia nenhum equivalente no projeto) ----------
create table if not exists public.materiais_catalogo (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  descricao text not null,
  categoria text not null check (categoria in ('caixa','componente','fiacao','conector','terminal','fixacao','placa','montagem')),
  unidade text not null default 'un',
  fabricante text,
  observacao_divergencia text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Header ----------
create table if not exists public.quadros_comando (
  id uuid primary key default gen_random_uuid(),
  numero_cotacao integer, -- correlação solta, mesmo padrão de projetos_elevador (sem FK: numero_cotacao não é chave única em formularios_elevador)
  formulario_elevador_unidade_id text references public.formularios_elevador_unidades(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo_aplicacao text check (tipo_aplicacao in ('MR','MRL')),
  novo_ou_modernizacao text check (novo_ou_modernizacao in ('novo','modernizacao')),
  origem_fabricacao text not null default 'interno' check (origem_fabricacao in ('interno','comprado')),
  fabricante_comando text,
  modelo_comando text,
  status text not null default 'rascunho' check (status in ('rascunho','cotado','aprovado','em_fabricacao','concluido')),
  escopo_fornecimento jsonb not null default '{}'::jsonb,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quadros_comando_numero_cotacao on public.quadros_comando(numero_cotacao);

-- ---------- Paradas (frente/fundo, portas, botoeiras por frente) ----------
create table if not exists public.quadros_comando_paradas (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null references public.quadros_comando(id) on delete cascade,
  ordem integer not null,
  identificacao text,
  abertura_frontal boolean not null default true,
  abertura_traseira boolean not null default false,
  tipo_porta_pavimento text,
  tipo_porta_cabina text,
  qtd_lop_frontal integer not null default 1,
  qtd_lop_traseira integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_paradas_quadro on public.quadros_comando_paradas(quadro_comando_id, ordem);

-- ---------- Intervalos entre pisos (não presumir intervalo único) ----------
create table if not exists public.quadros_comando_intervalos_piso (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null references public.quadros_comando(id) on delete cascade,
  ordem integer not null,
  de_parada text,
  para_parada text,
  distancia_mm integer not null,
  origem text not null default 'medido' check (origem in ('medido','estimado')),
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_intervalos_quadro on public.quadros_comando_intervalos_piso(quadro_comando_id, ordem);

-- ---------- Geometria para fiação (cada campo carrega sua origem) ----------
create table if not exists public.quadros_comando_geometria (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null unique references public.quadros_comando(id) on delete cascade,
  poco_mm integer, poco_origem text default 'medido' check (poco_origem in ('medido','estimado')),
  ultima_altura_mm integer, ultima_altura_origem text default 'medido' check (ultima_altura_origem in ('medido','estimado')),
  caixa_largura_mm integer,
  caixa_profundidade_mm integer,
  cabina_largura_mm integer,
  cabina_profundidade_mm integer,
  cabina_altura_mm integer,
  posicao_caixa_inspecao text,
  lado_quadro text check (lado_quadro in ('esquerda','direita')),
  lado_tripe_maquina text check (lado_tripe_maquina in ('esquerda','direita')),
  lado_guia_solitaria text check (lado_guia_solitaria in ('esquerda','direita')),
  posicao_saida_cabo_quadro text,
  distancia_quadro_maquina_mm integer,
  distancia_quadro_limitador_mm integer,
  distancia_quadro_entrada_caixa_mm integer,
  altura_ponto_suspensao_cabo_mm integer,
  seio_cabo_mm integer,
  seio_definicao_confirmada boolean not null default false,
  folga_mm integer,
  folga_regra_confirmada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Máquina / freio / encoder ----------
create table if not exists public.quadros_comando_maquina (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null unique references public.quadros_comando(id) on delete cascade,
  tipo_maquina text check (tipo_maquina in ('sincrona','assincrona')),
  fabricante_maquina text,
  modelo_maquina text,
  potencia_kw numeric,
  corrente_a numeric,
  tensao_v numeric,
  velocidade_rpm numeric,
  freio_tipo text,
  freio_tensao_acionamento numeric,
  freio_tensao_manutencao numeric,
  freio_qtd_bobinas integer,
  encoder_fabricante text,
  encoder_modelo text,
  encoder_tecnologia text,
  encoder_resolucao text,
  encoder_alimentacao text,
  encoder_conector text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- BOM (lista de compra consolidada) ----------
create table if not exists public.quadros_comando_bom_itens (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null references public.quadros_comando(id) on delete cascade,
  materiais_catalogo_id uuid references public.materiais_catalogo(id),
  sku text not null,
  descricao text not null,
  grupo_separacao text not null check (grupo_separacao in ('caixa','componentes','fiacao')),
  quantidade numeric not null,
  unidade text not null,
  origem text not null check (origem in ('fixo_variante','calculado_geometria')),
  confianca text not null default 'confirmado' check (confianca in ('confirmado','estimado','pendente_engenharia')),
  memoria_calculo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_bom_quadro on public.quadros_comando_bom_itens(quadro_comando_id);

-- ---------- Lista de corte (trechos físicos origem→destino) ----------
create table if not exists public.quadros_comando_trechos_corte (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null references public.quadros_comando(id) on delete cascade,
  tipo_cabo text not null,
  endereco_referencia text,
  origem_fisica text not null,
  destino_fisico text not null,
  vias_bitola text,
  comprimento_base_mm integer,
  contornos_mm integer not null default 0,
  folga_mm integer not null default 0,
  comprimento_final_mm integer,
  quantidade_pedacos integer not null default 1,
  confianca text not null default 'estimado' check (confianca in ('confirmado','estimado','pendente_engenharia')),
  formula text,
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_cortes_quadro on public.quadros_comando_trechos_corte(quadro_comando_id);

-- ---------- Checklist digital de separação (chão de fábrica) ----------
create table if not exists public.quadros_comando_checklist_separacao (
  id uuid primary key default gen_random_uuid(),
  quadro_comando_id uuid not null references public.quadros_comando(id) on delete cascade,
  versao integer not null default 1,
  grupo text not null check (grupo in ('caixa','componentes','fiacao')),
  bom_item_id uuid references public.quadros_comando_bom_itens(id),
  trecho_corte_id uuid references public.quadros_comando_trechos_corte(id),
  descricao text not null,
  sku text,
  quantidade numeric,
  unidade text,
  medida_mm integer,
  ordem integer not null default 0,
  feito boolean not null default false,
  separado_por text,
  separado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_checklist_quadro on public.quadros_comando_checklist_separacao(quadro_comando_id, versao, ordem);

-- ---------- RLS (mesmo padrão do restante do projeto: acesso via anon key,
-- SSO tratado na camada da aplicação) ----------
alter table public.materiais_catalogo enable row level security;
alter table public.quadros_comando enable row level security;
alter table public.quadros_comando_paradas enable row level security;
alter table public.quadros_comando_intervalos_piso enable row level security;
alter table public.quadros_comando_geometria enable row level security;
alter table public.quadros_comando_maquina enable row level security;
alter table public.quadros_comando_bom_itens enable row level security;
alter table public.quadros_comando_trechos_corte enable row level security;
alter table public.quadros_comando_checklist_separacao enable row level security;

create policy "materiais_catalogo_anon_all" on public.materiais_catalogo for all to anon using (true) with check (true);
create policy "materiais_catalogo_auth_all" on public.materiais_catalogo for all to authenticated using (true) with check (true);

create policy "quadros_comando_anon_all" on public.quadros_comando for all to anon using (true) with check (true);
create policy "quadros_comando_auth_all" on public.quadros_comando for all to authenticated using (true) with check (true);

create policy "qc_paradas_anon_all" on public.quadros_comando_paradas for all to anon using (true) with check (true);
create policy "qc_paradas_auth_all" on public.quadros_comando_paradas for all to authenticated using (true) with check (true);

create policy "qc_intervalos_anon_all" on public.quadros_comando_intervalos_piso for all to anon using (true) with check (true);
create policy "qc_intervalos_auth_all" on public.quadros_comando_intervalos_piso for all to authenticated using (true) with check (true);

create policy "qc_geometria_anon_all" on public.quadros_comando_geometria for all to anon using (true) with check (true);
create policy "qc_geometria_auth_all" on public.quadros_comando_geometria for all to authenticated using (true) with check (true);

create policy "qc_maquina_anon_all" on public.quadros_comando_maquina for all to anon using (true) with check (true);
create policy "qc_maquina_auth_all" on public.quadros_comando_maquina for all to authenticated using (true) with check (true);

create policy "qc_bom_anon_all" on public.quadros_comando_bom_itens for all to anon using (true) with check (true);
create policy "qc_bom_auth_all" on public.quadros_comando_bom_itens for all to authenticated using (true) with check (true);

create policy "qc_cortes_anon_all" on public.quadros_comando_trechos_corte for all to anon using (true) with check (true);
create policy "qc_cortes_auth_all" on public.quadros_comando_trechos_corte for all to authenticated using (true) with check (true);

create policy "qc_checklist_anon_all" on public.quadros_comando_checklist_separacao for all to anon using (true) with check (true);
create policy "qc_checklist_auth_all" on public.quadros_comando_checklist_separacao for all to authenticated using (true) with check (true);
