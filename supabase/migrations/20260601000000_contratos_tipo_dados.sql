-- ============================================================
-- Contratos: adiciona tipo_contrato + dados jsonb
-- tipo_contrato: 'cliente' | 'montador'
-- dados: jsonb com todos os campos preenchíveis do formulário
-- ============================================================
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_contrato text DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS dados jsonb DEFAULT '{}'::jsonb;
