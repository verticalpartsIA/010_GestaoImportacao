-- ============================================================
-- Issue #7 — conecta embarque ao Dossiê da Obra + registra
-- confirmação de chegada (dispara tarefas Engenharia/Instalação)
-- ============================================================

-- project_id já existe em embarques (texto livre não usado); passa a
-- guardar dossier_obra.id quando o embarque é vinculado a uma obra.
COMMENT ON COLUMN public.embarques.project_id IS 'Referencia dossier_obra.id (vinculo opcional embarque -> obra)';

ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS chegada_confirmada_em timestamptz;
