-- MES (Execução da Manufatura) · Fase 1: etapas, checklist por etapa, execução e histórico.
-- Reaproveita a OP do PCP (pcp_ordens, frente 'quadro'); o MES só acrescenta o fluxo de chão de fábrica.
-- Histórico (mes_historico) é imutável: sem policy de update/delete.
create table if not exists public.mes_etapas (
  codigo text primary key,
  nome text not null,
  sequencia int not null unique,
  macro text not null,                      -- coluna do Kanban
  peso numeric not null default 0,          -- % no progresso da OP (configurável)
  ativo boolean not null default true
);
create table if not exists public.mes_checklist_modelo (
  id uuid primary key default gen_random_uuid(),
  etapa_codigo text not null references public.mes_etapas(codigo),
  posicao int not null,
  item text not null,
  obrigatorio boolean not null default true,
  ativo boolean not null default true
);
create table if not exists public.mes_ordens (
  ordem_id uuid primary key references public.pcp_ordens(id),
  etapa_atual text not null default 'AGUARDANDO',   -- 'AGUARDANDO' | código de mes_etapas | 'EXPEDIDO'
  prioridade text not null default 'normal',
  liberada_por text,
  liberada_em timestamptz not null default now(),
  etapa_desde timestamptz not null default now(),
  concluida_em timestamptz
);
create table if not exists public.mes_execucoes (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id),
  etapa_codigo text not null references public.mes_etapas(codigo),
  operador text,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida')),
  observacao text
);
create unique index if not exists mes_exec_uma_aberta on public.mes_execucoes (ordem_id, etapa_codigo) where status = 'em_andamento';
create table if not exists public.mes_checklist_resultados (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.mes_execucoes(id),
  item_id uuid not null references public.mes_checklist_modelo(id),
  feito boolean not null default false,
  feito_por text,
  feito_em timestamptz,
  unique (execucao_id, item_id)
);
create table if not exists public.mes_historico (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id),
  usuario text,
  evento text not null,
  de_etapa text,
  para_etapa text,
  descricao text,
  created_at timestamptz not null default now()
);
create index if not exists mes_historico_ordem_idx on public.mes_historico (ordem_id, created_at);

insert into public.mes_etapas (codigo, nome, sequencia, macro, peso) values
 ('FURACAO','Furação do Quadro',1,'Furação',8),
 ('ESTRUTURA','Instalação de Calhas e Perfil DIN',2,'Estrutura',10),
 ('COMPONENTES','Montagem dos Componentes',3,'Componentes',8),
 ('CONF_MEC','Conferência Mecânica',4,'Componentes',7),
 ('PREP_FIACAO','Preparação da Fiação',5,'Fiação',7),
 ('CRIMPAGEM','Crimpagem de Terminais',6,'Fiação',7),
 ('ELETRIFICACAO','Interligação Elétrica',7,'Fiação',14),
 ('CONF_FIACAO','Conferência da Fiação',8,'Fiação',7),
 ('TESTES','Testes',9,'Testes',17),
 ('QUALIDADE','Inspeção Final / Qualidade',10,'Qualidade',8),
 ('EMBALAGEM','Embalagem',11,'Embalagem',5),
 ('EXPEDICAO','Expedição',12,'Expedição',2)
on conflict (codigo) do nothing;

insert into public.mes_checklist_modelo (etapa_codigo, posicao, item)
select e, row_number() over (partition by e order by ord), i from (values
 ('FURACAO',1,'Gabinete correto'),('FURACAO',2,'Desenho de furação disponível'),('FURACAO',3,'48 furos marcados'),('FURACAO',4,'48 furos executados'),('FURACAO',5,'Rebarbas removidas'),('FURACAO',6,'Limpeza concluída'),
 ('ESTRUTURA',1,'Calhas cortadas'),('ESTRUTURA',2,'Calhas fixadas'),('ESTRUTURA',3,'Perfis DIN cortados'),('ESTRUTURA',4,'Perfis DIN fixados'),('ESTRUTURA',5,'Posicionamento conforme layout'),('ESTRUTURA',6,'Parafusos e fixação OK'),
 ('COMPONENTES',1,'Disjuntores e DR'),('COMPONENTES',2,'Contatores e relés'),('COMPONENTES',3,'Transformador'),('COMPONENTES',4,'Placas Monarch'),('COMPONENTES',5,'Borneiras e demais'),('COMPONENTES',6,'Conforme lista de materiais'),
 ('CONF_MEC',1,'Componentes corretos'),('CONF_MEC',2,'Posição conforme projeto'),('CONF_MEC',3,'Fixação e etiquetas'),('CONF_MEC',4,'Espaçamento adequado'),('CONF_MEC',5,'Canaletas livres'),('CONF_MEC',6,'Aterramento preparado'),
 ('PREP_FIACAO',1,'Corte dos fios'),('PREP_FIACAO',2,'Decapagem'),('PREP_FIACAO',3,'Identificação (origem/destino)'),('PREP_FIACAO',4,'Bitola e cor corretas'),('PREP_FIACAO',5,'Preparação dos chicotes'),
 ('CRIMPAGEM',1,'Terminal correto'),('CRIMPAGEM',2,'Crimpagem (tubular e pino)'),('CRIMPAGEM',3,'Inspeção visual'),('CRIMPAGEM',4,'Teste de tração (amostral)'),('CRIMPAGEM',5,'Identificação dos fios'),
 ('ELETRIFICACAO',1,'Passagem dos fios'),('ELETRIFICACAO',2,'Interligação conforme projeto'),('ELETRIFICACAO',3,'Fixação e organização'),('ELETRIFICACAO',4,'Identificação nos dois lados'),('ELETRIFICACAO',5,'Aterramento'),
 ('CONF_FIACAO',1,'Origem/destino correto'),('CONF_FIACAO',2,'Bitola e cor corretas'),('CONF_FIACAO',3,'Crimpagem OK'),('CONF_FIACAO',4,'Aperto dos bornes'),('CONF_FIACAO',5,'Organização nas canaletas'),('CONF_FIACAO',6,'Sem fios soltos ou expostos'),
 ('TESTES',1,'Teste sem potência (continuidade/curto)'),('TESTES',2,'Teste energizado'),('TESTES',3,'Tensões auxiliares'),('TESTES',4,'Relés e contatores'),('TESTES',5,'Placas Monarch'),('TESTES',6,'Funções: sobe, desce, inspeção, freio, limitador, resgate'),
 ('QUALIDADE',1,'Elétrica aprovada'),('QUALIDADE',2,'Mecânica aprovada'),('QUALIDADE',3,'Identificação e limpeza'),('QUALIDADE',4,'Canaletas fechadas'),('QUALIDADE',5,'Documentação e fotos'),('QUALIDADE',6,'Etiqueta de inspeção'),
 ('EMBALAGEM',1,'Proteção interna'),('EMBALAGEM',2,'Acessórios'),('EMBALAGEM',3,'Documentação'),('EMBALAGEM',4,'Embalo e lacre'),('EMBALAGEM',5,'Etiqueta da obra'),
 ('EXPEDICAO',1,'Liberado para expedição'),('EXPEDICAO',2,'Faturamento'),('EXPEDICAO',3,'Coleta / transporte'),('EXPEDICAO',4,'Registro de envio')
) v(e, ord, i)
where not exists (select 1 from public.mes_checklist_modelo);

do $$ declare t text; begin
  foreach t in array array['mes_etapas','mes_checklist_modelo','mes_ordens','mes_execucoes','mes_checklist_resultados','mes_historico'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_leitura', t);
  end loop;
  foreach t in array array['mes_ordens','mes_execucoes','mes_checklist_resultados','mes_historico'] loop
    execute format('create policy %I on public.%I for insert with check (true)', t||'_insert', t);
  end loop;
  foreach t in array array['mes_ordens','mes_execucoes','mes_checklist_resultados'] loop
    execute format('create policy %I on public.%I for update using (true) with check (true)', t||'_update', t);
  end loop;
end $$;
