-- ============================================================
-- Ficha Técnica — rastreio de publicação no Omie
-- Permite ao "Publicar no Omie" saber se a ficha já foi publicada
-- antes (para republicar substituindo o anexo em vez de duplicar).
-- Tela: Engenharia → Ficha Técnica
-- ============================================================

ALTER TABLE public.fichas_tecnicas ADD COLUMN IF NOT EXISTS omie_anexo_id     bigint;      -- nIdAnexo retornado pela Omie no IncluirAnexo
ALTER TABLE public.fichas_tecnicas ADD COLUMN IF NOT EXISTS omie_publicado_em timestamptz; -- data/hora da última publicação (inclusão ou substituição) bem-sucedida
