-- ============================================================
-- Adaptação por número de paradas + numeração sequencial da vistoria
-- por obra (ex.: "3ª Vistoria VPOB-0950").
-- ============================================================

-- Categoria pode ser marcada pra repetir 1x por pavimento (paradas do
-- ativo) — ex.: "Vão de Portas" vira uma seção por andar, não uma só.
ALTER TABLE public.vistorias_categorias ADD COLUMN IF NOT EXISTS repete_por_pavimento boolean NOT NULL DEFAULT false;

-- Paradas do ativo, herdadas da hidratação por Master ID no despacho
-- (ou digitadas manualmente quando não há Master ID pra puxar). Sem
-- valor, a execução trata como "não repete" (1 seção só).
ALTER TABLE public.vistorias_atividades ADD COLUMN IF NOT EXISTS paradas integer;

-- Nº sequencial da vistoria dentro da MESMA obra (1ª, 2ª, 3ª...) —
-- calculado na criação, nunca recalculado depois.
ALTER TABLE public.vistorias_atividades ADD COLUMN IF NOT EXISTS numero_sequencial integer;

-- Resposta agora pode ser por pavimento (0 = não repete / instância
-- única, igual ao comportamento de antes). Troca a constraint única
-- pra incluir o pavimento.
ALTER TABLE public.vistorias_respostas ADD COLUMN IF NOT EXISTS pavimento_index integer NOT NULL DEFAULT 0;

ALTER TABLE public.vistorias_respostas DROP CONSTRAINT IF EXISTS vistorias_respostas_atividade_id_pergunta_id_key;
ALTER TABLE public.vistorias_respostas ADD CONSTRAINT vistorias_respostas_atividade_pergunta_pavimento_key
  UNIQUE (atividade_id, pergunta_id, pavimento_index);
