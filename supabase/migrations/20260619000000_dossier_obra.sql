-- ============================================================
-- Dossie da Obra — entidade central do VPPRD
-- Conecta Lead → Engenharia → Precificação → Proposta → Contrato → Importação → Instalação → DataBook
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dossier_obra (
  id                    text PRIMARY KEY,
  lead_id               text,
  client_name           text NOT NULL,
  building_name         text NOT NULL,
  city                  text,
  state                 text,
  equip_type            text,  -- 'elevador' | 'escada' | 'esteira'
  status_master         text DEFAULT 'Lead qualificado',  -- controla progresso macro
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  created_by            text,
  updated_by            text
);

-- Histórico de transições de status
CREATE TABLE IF NOT EXISTS public.dossier_history (
  id                    text PRIMARY KEY,
  dossier_id            text NOT NULL REFERENCES public.dossier_obra(id) ON DELETE CASCADE,
  status_from           text,
  status_to             text NOT NULL,
  actor                 text,
  notes                 text,
  created_at            timestamptz DEFAULT now()
);

-- Responsáveis por etapa (Comercial, Engenharia, Financeiro, Jurídico, RH, Instalação)
CREATE TABLE IF NOT EXISTS public.dossier_responsaveis (
  id                    text PRIMARY KEY,
  dossier_id            text NOT NULL REFERENCES public.dossier_obra(id) ON DELETE CASCADE,
  etapa                 text NOT NULL,  -- 'comercial' | 'engenharia' | 'financeiro' | 'juridico' | 'rh' | 'instalacao'
  responsavel           text,
  assigned_at           timestamptz DEFAULT now(),
  notes                 text
);

-- Pendências + bloqueios (rastreabilidade de por que algo está parado)
CREATE TABLE IF NOT EXISTS public.dossier_pendencias (
  id                    text PRIMARY KEY,
  dossier_id            text NOT NULL REFERENCES public.dossier_obra(id) ON DELETE CASCADE,
  tipo                  text NOT NULL,  -- 'cliente' | 'interno' | 'externo'
  descricao             text NOT NULL,
  etapa                 text,
  bloqueante            boolean DEFAULT false,  -- se true, paralisa fluxo
  resolved_at           timestamptz,
  resolved_by           text,
  created_at            timestamptz DEFAULT now()
);

-- Documentos + status (Proposta, Contratos, Projetos, ART, DataBook, etc)
CREATE TABLE IF NOT EXISTS public.dossier_documentos (
  id                    text PRIMARY KEY,
  dossier_id            text NOT NULL REFERENCES public.dossier_obra(id) ON DELETE CASCADE,
  tipo                  text NOT NULL,  -- 'proposta' | 'contrato_venda' | 'contrato_instalador' | 'projeto' | 'art' | 'databook' | etc
  nome                  text,
  versao                integer DEFAULT 1,
  status                text DEFAULT 'rascunho',  -- 'rascunho' | 'aprovado' | 'enviado' | 'assinado' | 'vencido'
  responsavel           text,
  data_criacao          date,
  data_atualizacao      date,
  arquivo_url           text,
  metadata              jsonb,  -- armazena IDs de referência, números de documentos, etc
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.dossier_obra          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_responsaveis  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_pendencias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_documentos    ENABLE ROW LEVEL SECURITY;
