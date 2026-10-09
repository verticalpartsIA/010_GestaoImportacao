-- ============================================================
-- Vistorias de Obras — motor de questionários (Fase 0)
-- Estrutura de criação apenas: nasce vazia, sem dados importados de
-- nenhum sistema externo. Molde: Questionário -> Categoria -> Pergunta
-- (com ramo condicional via self-FK). Execução: Atividade (obra +
-- equipamento + técnico + questionário) -> Resposta.
--
-- Herança de dados: Atividade referencia dossier_obra/equipamentos_obra
-- (já existentes) por FK — não recadastra obra nem equipamento.
-- ============================================================

-- 1. O QUESTIONÁRIO (o "molde" — criado no builder em vistorias-envio.jsx)
CREATE TABLE IF NOT EXISTS public.vistorias_questionarios (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  nome          text NOT NULL,
  tipo          text NOT NULL DEFAULT 'vistoria',   -- livre: 'vistoria' | 'entrega' | 'servico'...
  ativo         boolean NOT NULL DEFAULT true,
  criado_por    text,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- 2. CATEGORIAS dentro do questionário (ex.: "Casa de Máquinas")
CREATE TABLE IF NOT EXISTS public.vistorias_categorias (
  id              text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  questionario_id text NOT NULL REFERENCES public.vistorias_questionarios(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  ordem           integer NOT NULL DEFAULT 0
);

-- 3. PERGUNTAS — o coração do motor, com a árvore condicional
CREATE TABLE IF NOT EXISTS public.vistorias_perguntas (
  id                     text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  categoria_id           text NOT NULL REFERENCES public.vistorias_categorias(id) ON DELETE CASCADE,
  texto                  text NOT NULL,
  tipo_campo             text NOT NULL,   -- 'texto'|'numerico'|'data'|'sim_nao'|'selecao_unica'|'multipla_escolha'|'foto'|'assinatura'|'informativa'
  opcoes                 jsonb,           -- ["Sim","Não","N/A"] — só selecao_unica/multipla_escolha
  obrigatoria            boolean NOT NULL DEFAULT true,
  ordem                  integer NOT NULL DEFAULT 0,
  regra_pai_pergunta_id  text REFERENCES public.vistorias_perguntas(id) ON DELETE CASCADE,
  regra_valor_gatilho    text             -- só aparece se a pergunta-pai responder isso
);

-- 4. ATIVIDADE — 1 vistoria despachada (obra + equipamento + técnico + questionário)
CREATE TABLE IF NOT EXISTS public.vistorias_atividades (
  id              text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  questionario_id text NOT NULL REFERENCES public.vistorias_questionarios(id),
  dossier_id      text NOT NULL REFERENCES public.dossier_obra(id),
  equipamento_id  text REFERENCES public.equipamentos_obra(id),        -- opcional
  tecnico_id      uuid REFERENCES public.colaboradores_vpsistema(id),
  status          text NOT NULL DEFAULT 'pendente',  -- pendente|em_execucao|concluida|cancelada
  token           text UNIQUE,             -- link/QR mobile
  enviado_em      timestamptz,
  checkin_em      timestamptz,
  checkin_lat     numeric,
  checkin_lng     numeric,
  checkout_em     timestamptz,
  checkout_lat    numeric,
  checkout_lng    numeric,
  concluido_em    timestamptz,
  criado_por      text,
  criado_em       timestamptz DEFAULT now(),
  atualizado_em   timestamptz DEFAULT now()
);

-- 5. RESPOSTAS — o que o técnico preencheu no celular
CREATE TABLE IF NOT EXISTS public.vistorias_respostas (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  atividade_id  text NOT NULL REFERENCES public.vistorias_atividades(id) ON DELETE CASCADE,
  pergunta_id   text NOT NULL REFERENCES public.vistorias_perguntas(id),
  valor         text,           -- texto/número/data/sim_nao/seleção única
  valor_lista   jsonb,          -- múltipla escolha
  anexo_url     text,           -- foto/assinatura (bucket vistorias-anexos)
  respondido_em timestamptz DEFAULT now(),
  UNIQUE (atividade_id, pergunta_id)
);

ALTER TABLE public.vistorias_questionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias_categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias_perguntas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias_atividades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias_respostas     ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vistorias_categorias_questionario ON public.vistorias_categorias(questionario_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_perguntas_categoria ON public.vistorias_perguntas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_perguntas_regra_pai ON public.vistorias_perguntas(regra_pai_pergunta_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_atividades_dossier ON public.vistorias_atividades(dossier_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_atividades_equipamento ON public.vistorias_atividades(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_atividades_tecnico ON public.vistorias_atividades(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_respostas_atividade ON public.vistorias_respostas(atividade_id);
