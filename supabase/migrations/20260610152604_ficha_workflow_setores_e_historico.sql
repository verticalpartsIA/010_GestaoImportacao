-- Workflow por setores (Comercial→Engenharia→Financeiro→Importação) na ficha técnica.
ALTER TABLE public.fichas_tecnicas
  ADD COLUMN IF NOT EXISTS etapa              text DEFAULT 'comercial_rascunho',
  ADD COLUMN IF NOT EXISTS setor_responsavel  text DEFAULT 'comercial',
  ADD COLUMN IF NOT EXISTS cliente_lead       jsonb,                -- {nome, whatsapp, observacao} coletado pelo vendedor
  ADD COLUMN IF NOT EXISTS revisao            jsonb,                -- {solicitada_por, motivo, em} quando carimbinho é usado
  ADD COLUMN IF NOT EXISTS arquivado          boolean DEFAULT false;

-- Fichas existentes nasceram no fluxo antigo (ficha → catálogo direto):
-- ficam na etapa Importação (prontas p/ flegar e cotar com fornecedor).
UPDATE public.fichas_tecnicas
   SET etapa = 'importacao', setor_responsavel = 'importacao'
 WHERE etapa = 'comercial_rascunho';

-- Soft-hide do produto no catálogo (ícone arquivar).
ALTER TABLE public.catalogo_produtos
  ADD COLUMN IF NOT EXISTS arquivado boolean DEFAULT false;

-- Histórico append-only (ícone olhinho): quem fez, quando, o quê.
CREATE TABLE IF NOT EXISTS public.fichas_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id    uuid,
  produto_id  text,
  ator_id     uuid,
  ator_nome   text NOT NULL DEFAULT 'Sistema',
  ator_setor  text,
  acao        text NOT NULL,            -- criou|editou|avancou|devolveu|revisao|arquivou|desarquivou|excluiu|publicou
  de_etapa    text,
  para_etapa  text,
  detalhe     jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fichas_historico_ficha   ON public.fichas_historico (ficha_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_historico_produto ON public.fichas_historico (produto_id, criado_em DESC);

ALTER TABLE public.fichas_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fichas_historico_all_anon ON public.fichas_historico;
DROP POLICY IF EXISTS fichas_historico_all_auth ON public.fichas_historico;
-- Append-only: pode inserir e ler; nunca alterar/apagar (auditoria).
CREATE POLICY fichas_historico_ins_anon ON public.fichas_historico FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY fichas_historico_ins_auth ON public.fichas_historico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY fichas_historico_sel_anon ON public.fichas_historico FOR SELECT TO anon          USING (true);
CREATE POLICY fichas_historico_sel_auth ON public.fichas_historico FOR SELECT TO authenticated USING (true);
