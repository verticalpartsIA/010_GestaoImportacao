
-- 🅰️ Decisão limpa: vai DIRETO na ficha técnica
ALTER TABLE public.fichas_tecnicas
  ADD COLUMN IF NOT EXISTS insumo              text,
  ADD COLUMN IF NOT EXISTS funcao_aplicacao    text,
  ADD COLUMN IF NOT EXISTS eh_parte_de         text,
  ADD COLUMN IF NOT EXISTS forma_estado        text
    CHECK (forma_estado IS NULL OR forma_estado IN ('materia_prima','peca_acabada')),
  ADD COLUMN IF NOT EXISTS ncm_recomendado     text,
  ADD COLUMN IF NOT EXISTS ncm_descricao       text,
  ADD COLUMN IF NOT EXISTS descricao_duimp     text;

-- 🅱️ Defesa: vai na página separada "Relatório de Confiabilidade"
-- Mantém tudo o que NÃO é decisão final: confiança, justificativa, antítese,
-- fontes, perguntas de desempate, status de homologação, auditoria humana.
CREATE TABLE IF NOT EXISTS public.fichas_relatorio_confiabilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  ncm_recomendado text,                            -- snapshot do NCM sugerido pela IA
  ncm_confianca numeric,                           -- 0..1
  ncm_justificativa text,
  ncm_antitese text,
  fontes jsonb DEFAULT '[]'::jsonb,
  perguntas_desempate jsonb DEFAULT '[]'::jsonb,
  historico_desempate jsonb DEFAULT '[]'::jsonb,
  atributos_sugeridos jsonb DEFAULT '{}'::jsonb,
  ncm_status_homologacao text NOT NULL DEFAULT 'sugerido_ia'
    CHECK (ncm_status_homologacao IN ('sugerido_ia','homologado','ajustado')),
  ncm_final text,                                  -- NCM válido após Homologar/Ajustar
  homologado_por uuid REFERENCES public.perfis(id),
  homologado_em timestamptz,
  request_log jsonb,                               -- audit do payload enviado pra Edge Function
  response_log jsonb,                              -- audit da resposta da Edge Function
  edge_function_url text,
  edge_function_version text,                      -- útil quando stub→IA real
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.fichas_relatorio_confiabilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frc_all_anon" ON public.fichas_relatorio_confiabilidade
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS frc_ficha_idx  ON public.fichas_relatorio_confiabilidade(ficha_id);
CREATE INDEX IF NOT EXISTS frc_status_idx ON public.fichas_relatorio_confiabilidade(ncm_status_homologacao);
