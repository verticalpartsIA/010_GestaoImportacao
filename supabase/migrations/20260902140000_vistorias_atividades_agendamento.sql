-- ============================================================
-- Agendamento de vistorias (Módulo ADM — Visão Calendário/Agenda).
-- Campo opcional: despacho continua funcionando sem data (fila
-- imediata), só ganha uma data/hora quando o ADM agenda de propósito.
-- ============================================================

ALTER TABLE public.vistorias_atividades ADD COLUMN IF NOT EXISTS agendado_para timestamptz;

CREATE INDEX IF NOT EXISTS idx_vistorias_atividades_agendado_para ON public.vistorias_atividades(agendado_para);
