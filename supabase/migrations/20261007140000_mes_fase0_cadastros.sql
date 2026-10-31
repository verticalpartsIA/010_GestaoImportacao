-- MES · Fase 0 (Fundação) — cadastros do chão de fábrica.
-- Plano aprovado em 07/10/2026 (26_Mes-manufatura/MES-resumo-final.md).
-- ADITIVA: não altera nem remove nada que já existe. pcp_ordens.frente continua texto;
-- mes_frentes só dá nome/ordem/ativo aos mesmos códigos (quadro, fiacao, botoeiras, cabos_aco, corte).
-- RLS segue o padrão atual do app (leitura/insert/update abertos ao anon, sem DELETE) até a issue #571.

-- 1) Frentes de produção ------------------------------------------------------
create table if not exists public.mes_frentes (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nome       text not null,
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.mes_frentes (codigo, nome, ordem) values
  ('quadro',    'Quadro de Comando', 10),
  ('fiacao',    'Fiação e cabos',    20),
  ('botoeiras', 'Botoeiras',         30),
  ('cabos_aco', 'Cabos de aço',      40),
  ('corte',     'Corte de cabo',     50),
  ('corrimao',  'Corrimãos',         60),
  ('expedicao', 'Expedição',         70)
on conflict (codigo) do nothing;

-- 2) Posto = recurso do PCP (pcp_recursos) ligado a uma frente ------------------
alter table public.pcp_recursos
  add column if not exists frente_codigo text references public.mes_frentes(codigo) on update cascade;
create index if not exists pcp_recursos_frente_idx on public.pcp_recursos(frente_codigo);

-- 3) Cadastro ÚNICO de motivos (parada, problema, refugo) ---------------------------
create table if not exists public.mes_motivos (
  id              uuid primary key default gen_random_uuid(),
  tipo_ocorrencia text not null check (tipo_ocorrencia in ('parada','problema','refugo')),
  codigo          text not null,
  nome            text not null,
  planejada       boolean,                       -- só parada
  categoria_4m    text check (categoria_4m in ('metodo','material','maquina','mao_de_obra')), -- só refugo
  gera_alerta     boolean not null default false, -- parada não planejada avisa o líder da frente
  ordem           int not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tipo_ocorrencia, codigo),
  constraint mes_motivos_planejada_so_parada check ((tipo_ocorrencia = 'parada') = (planejada is not null)),
  constraint mes_motivos_4m_so_refugo check (tipo_ocorrencia = 'refugo' or categoria_4m is null)
);

insert into public.mes_motivos (tipo_ocorrencia, codigo, nome, planejada, categoria_4m, gera_alerta, ordem) values
  -- paradas NÃO planejadas (geram alerta)
  ('parada','aguardando_material',   'Aguardando material',                  false, null, true, 10),
  ('parada','aguardando_projeto',    'Aguardando projeto ou definição',      false, null, true, 20),
  ('parada','falha_ferramenta_maquina','Falha de ferramenta ou máquina',     false, null, true, 30),
  ('parada','aguardando_qualidade',  'Aguardando conferência da qualidade',  false, null, true, 40),
  ('parada','falta_operador',        'Falta de operador',                    false, null, true, 50),
  ('parada','outro',                 'Outro',                                false, null, true, 90),
  -- paradas planejadas (só registram)
  ('parada','setup_troca',           'Setup ou troca de produto',            true,  null, false, 60),
  ('parada','manutencao_limpeza',    'Manutenção ou limpeza',                true,  null, false, 70),
  -- problemas
  ('problema','material_faltando',   'Material faltando',                    null, null, false, 10),
  ('problema','material_defeito',    'Material com defeito',                 null, null, false, 20),
  ('problema','desenho_incorreto',   'Desenho ou projeto incorreto',         null, null, false, 30),
  ('problema','ferramenta_defeito',  'Ferramenta com defeito',               null, null, false, 40),
  ('problema','retrabalho',          'Retrabalho necessário',                null, null, false, 50),
  ('problema','outro',               'Outro',                                null, null, false, 90),
  -- refugo (4M)
  ('refugo','corte_medida_errada',   'Medida de corte errada',               null, 'metodo',      false, 10),
  ('refugo','furacao_fora_posicao',  'Furação fora de posição',              null, 'metodo',      false, 20),
  ('refugo','montagem_incorreta',    'Montagem incorreta',                   null, 'metodo',      false, 30),
  ('refugo','material_errado',       'Material errado',                      null, 'material',    false, 40),
  ('refugo','material_defeito',      'Material com defeito',                 null, 'material',    false, 50),
  ('refugo','cabo_danificado',       'Cabo danificado',                      null, 'material',    false, 60),
  ('refugo','falha_ferramenta_uso',  'Falha de ferramenta durante o uso',    null, 'maquina',     false, 70),
  ('refugo','erro_operacao_montagem','Erro de operação ou de montagem',      null, 'mao_de_obra', false, 80),
  ('refugo','outro',                 'Outro',                                null, null,          false, 90)
on conflict (tipo_ocorrencia, codigo) do nothing;

-- 4) Tabela única de ocorrências (parada, problema, refugo) ----------------------
create table if not exists public.mes_ocorrencias (
  id              uuid primary key default gen_random_uuid(),
  tipo_ocorrencia text not null check (tipo_ocorrencia in ('parada','problema','refugo')),
  ordem_id        uuid not null references public.pcp_ordens(id) on delete cascade,
  etapa_id        uuid references public.pcp_ordem_etapas(id) on delete set null,
  posto_id        uuid references public.pcp_recursos(id) on delete set null,
  motivo_id       uuid not null references public.mes_motivos(id),
  status          text not null default 'aberta' check (status in ('aberta','em_tratamento','resolvida')),
  inicio          timestamptz not null default now(),
  fim             timestamptz,
  quantidade      numeric check (quantidade is null or quantidade >= 0),   -- refugo
  disposicao      text check (disposicao in ('retrabalhar','refugar','liberar')),
  descricao       text,
  reportado_por   text,
  resolvido_por   text,
  resolvido_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  excluido_em     timestamptz,
  excluido_por    text,
  constraint mes_ocorrencias_fim_apos_inicio check (fim is null or fim >= inicio)
);
create index if not exists mes_ocorrencias_ordem_idx  on public.mes_ocorrencias(ordem_id);
create index if not exists mes_ocorrencias_etapa_idx  on public.mes_ocorrencias(etapa_id);
create index if not exists mes_ocorrencias_posto_idx  on public.mes_ocorrencias(posto_id);
create index if not exists mes_ocorrencias_motivo_idx on public.mes_ocorrencias(motivo_id);
create index if not exists mes_ocorrencias_status_idx on public.mes_ocorrencias(status) where excluido_em is null;

-- 5) Jornada única (horário normal) — uma linha só ---------------------------------
-- Intervalo de almoço de 60 min é SUPOSIÇÃO (o usuário só informou 08:00–17:00): editável na tela.
create table if not exists public.mes_jornada (
  id            boolean primary key default true check (id),
  nome          text not null default 'Horário normal',
  inicio        time not null default '08:00',
  fim           time not null default '17:00',
  intervalo_min int  not null default 60 check (intervalo_min >= 0),
  dias_semana   int[] not null default '{1,2,3,4,5}',
  updated_at    timestamptz not null default now(),
  updated_by    text,
  constraint mes_jornada_fim_apos_inicio check (fim > inicio)
);
insert into public.mes_jornada (id) values (true) on conflict (id) do nothing;

-- 6) Posto padrão do colaborador (tabela à parte: colaboradores_vpsistema é sincronizada) -
create table if not exists public.mes_operador_posto (
  email      text primary key,
  recurso_id uuid references public.pcp_recursos(id) on delete cascade,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists mes_operador_posto_recurso_idx on public.mes_operador_posto(recurso_id);

-- 7) Etapas: tipo (produção/inspeção) e nº de operadores ---------------------------------
alter table public.pcp_etapas_modelo
  add column if not exists tipo text not null default 'producao' check (tipo in ('producao','inspecao')),
  add column if not exists operadores int not null default 1 check (operadores >= 1);
alter table public.pcp_ordem_etapas
  add column if not exists tipo text not null default 'producao' check (tipo in ('producao','inspecao')),
  add column if not exists operadores int not null default 1 check (operadores >= 1);

-- A etapa de qualidade do modelo é conferência (inspeção)
update public.pcp_etapas_modelo set tipo = 'inspecao'
 where tipo = 'producao' and lower(nome) like '%qualidade%';

-- 8) RLS (padrão atual do app; sem DELETE de propósito — desativa-se, não se apaga) ------
do $$
declare t text;
begin
  foreach t in array array['mes_frentes','mes_motivos','mes_ocorrencias','mes_jornada','mes_operador_posto'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_leitura', t);
    execute format('create policy %I on public.%I for insert with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (true) with check (true)', t || '_update', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
