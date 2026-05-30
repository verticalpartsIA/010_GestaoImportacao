-- ============================================================
-- Importação — enriquecimento da tabela embarques
-- Campos do workflow de importação (refs: importção.md / importação1.md)
-- Tela: Logística → Importação
-- ============================================================

ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS imo                text;  -- identificador vitalício do navio (AIS)
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS supplier           text;  -- fornecedor / shipper
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS invoice_number     text;
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS invoice_value      numeric;
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS invoice_currency   text DEFAULT 'USD';
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS container_number   text;  -- nº real do contêiner (ex.: MSCU9382821)
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS seal               text;  -- lacre
ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS freight_condition  text;  -- FCL / LCL
