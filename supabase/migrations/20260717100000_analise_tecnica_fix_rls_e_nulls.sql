-- ============================================================
-- Cria de fato as tabelas de Análise Técnica (ISSUE #3).
--
-- A migração 20260619100000_analise_tecnica.sql existe no repo mas
-- nunca foi aplicada em produção (tabela não existia). Recriando aqui
-- já com 2 correções necessárias para o fluxo funcionar de ponta a
-- ponta:
--
-- 1) cidade_obra/estado_obra NÃO são NOT NULL — o wizard cria o
--    rascunho (window.__ANALISE_TECNICA.criar) só com dossier_id +
--    tipo_equipamento, ANTES do usuário preencher a localização.
--    A obrigatoriedade real já é garantida em app (validarObrigatorios)
--    antes de marcar como completa/aprovada.
-- 2) Policies de RLS incluídas desde a criação (mesmo bug já visto em
--    dossier_obra, corrigido no PR #37, intencionalmente evitado aqui).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analise_tecnica (
  id                      text PRIMARY KEY,
  dossier_id              text NOT NULL REFERENCES public.dossier_obra(id) ON DELETE CASCADE,

  -- Variáveis obrigatórias (definem escopo técnico)
  tipo_equipamento        text NOT NULL,  -- 'elevador' | 'escada' | 'esteira'
  paradas                 integer,        -- só para elevador
  carga_kg                integer,        -- só para elevador
  abertura                text,           -- 'Central' | 'Telescópica Direita' | 'Telescópica Esquerda' (elevador)
  vao_cm                  integer,        -- só para elevador
  acabamento              text,           -- 'Bege' | 'Inox' (elevador)

  -- Localização da obra (preenchido no passo 2 do wizard — não NOT NULL)
  cidade_obra             text,
  estado_obra             text,
  distancia_santos_km     numeric,        -- Santos → obra (calcula frete interno)

  -- Necessidades de infraestrutura (cliente responsável)
  necessidade_andaime     boolean DEFAULT false,
  responsavel_andaime     text,           -- 'VerticalParts' | 'Cliente'
  necessidade_munck       text,           -- 'nenhum' | '1-munck' | '2-munks'
  necessidade_armazenagem boolean DEFAULT false,
  observacoes_armazenagem text,

  -- Vistorias
  vistorias_inclusas      integer DEFAULT 3,
  valor_vistoria_avulsa   numeric,

  -- Instalação
  dias_instalacao_est     integer,        -- quantidade estimada de dias
  necessidade_supervisor  boolean DEFAULT false,
  horas_deslocamento      numeric,        -- horas de viagem até a obra
  hospedagem_necessaria   boolean DEFAULT false,
  dias_hospedagem_est     integer,

  -- Riscos + exclusões
  riscos_tecnicos         text,           -- descrição livre
  exclusoes_comerciais    text,           -- escopo que NÃO está no preço

  -- Documentos necessários
  projeto_necessario      boolean DEFAULT true,
  art_necessaria          boolean DEFAULT true,
  nrs_aplicaveis          text,           -- ex: 'NR-10, NR-11'
  aso_necessaria          boolean DEFAULT true,
  pcmso_pgr_necessaria    boolean DEFAULT true,

  -- Pendências do cliente (antes de avançar)
  pendencia_cliente_desc  text,
  data_resolucao_cliente  date,

  -- Status e rastreabilidade
  status                  text DEFAULT 'rascunho',  -- 'rascunho' | 'pendente_cliente' | 'completa' | 'aprovada'
  responsavel             text,
  data_criacao            timestamptz DEFAULT now(),
  data_atualizacao        timestamptz DEFAULT now(),
  data_aprovacao          timestamptz,
  aprovado_por            text,
  versao                  integer DEFAULT 1,

  -- Histórico de alterações (JSON)
  historico               jsonb DEFAULT '[]'::jsonb
);

-- Tabela de pendências de cliente antes da Engenharia
CREATE TABLE IF NOT EXISTS public.analise_tecnica_pendencias_cliente (
  id                      text PRIMARY KEY,
  analise_tecnica_id      text NOT NULL REFERENCES public.analise_tecnica(id) ON DELETE CASCADE,
  descricao               text NOT NULL,
  marcado_como_pendente   boolean DEFAULT true,
  resolvido_em            timestamptz,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analise_dossier ON public.analise_tecnica(dossier_id);
CREATE INDEX IF NOT EXISTS idx_analise_status ON public.analise_tecnica(status);

ALTER TABLE public.analise_tecnica                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analise_tecnica_pendencias_cliente  ENABLE ROW LEVEL SECURITY;

CREATE POLICY leitura_publica ON public.analise_tecnica FOR SELECT TO public USING (true);
CREATE POLICY escrita_anon    ON public.analise_tecnica FOR INSERT TO public WITH CHECK (true);
CREATE POLICY update_anon     ON public.analise_tecnica FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY leitura_publica ON public.analise_tecnica_pendencias_cliente FOR SELECT TO public USING (true);
CREATE POLICY escrita_anon    ON public.analise_tecnica_pendencias_cliente FOR INSERT TO public WITH CHECK (true);
CREATE POLICY update_anon     ON public.analise_tecnica_pendencias_cliente FOR UPDATE TO public USING (true) WITH CHECK (true);
