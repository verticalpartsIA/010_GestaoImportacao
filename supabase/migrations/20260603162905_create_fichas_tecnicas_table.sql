
-- Tabela dedicada às Fichas Técnicas (gerador universal Engenharia)
CREATE TABLE IF NOT EXISTS public.fichas_tecnicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_documento text UNIQUE,        -- VPFT20260603_N
  seq_mes integer,
  ano_mes text,                        -- YYYYMM, índice mensal
  nome_produto text NOT NULL,
  categoria_produto text,
  sku text,
  codigo_produto text,
  part_number text,
  descricao_comercial text,
  descricao_tecnica text,
  identificacao jsonb DEFAULT '{}'::jsonb,
  cats jsonb DEFAULT '[]'::jsonb,      -- estado das categorias/campos
  midia jsonb DEFAULT '{}'::jsonb,     -- { desenho, foto } (dataURLs)
  produto_id text REFERENCES public.catalogo_produtos(id) ON DELETE SET NULL,
  criado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fichas_tecnicas_all_anon"
  ON public.fichas_tecnicas
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS fichas_ano_mes_idx ON public.fichas_tecnicas(ano_mes);
CREATE INDEX IF NOT EXISTS fichas_categoria_idx ON public.fichas_tecnicas(categoria_produto);
CREATE INDEX IF NOT EXISTS fichas_produto_idx ON public.fichas_tecnicas(produto_id);

-- Extender next_doc_number pra suportar VPFT
DROP FUNCTION IF EXISTS public.next_doc_number(text);
CREATE FUNCTION public.next_doc_number(p_prefixo text)
RETURNS TABLE (numero_documento text, seq_mes integer, ano_mes text) AS $$
DECLARE
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_data text := to_char(v_now, 'YYYYMMDD');
  v_ano_mes text := to_char(v_now, 'YYYYMM');
  v_seq integer;
BEGIN
  IF p_prefixo = 'VPPROP' THEN
    SELECT COALESCE(MAX(p.seq_mes), 0) + 1 INTO v_seq
      FROM public.propostas p WHERE p.ano_mes = v_ano_mes;
  ELSIF p_prefixo = 'VPVE' THEN
    SELECT COALESCE(MAX(c.seq_mes), 0) + 1 INTO v_seq
      FROM public.contratos_venda_equipamentos c WHERE c.ano_mes = v_ano_mes;
  ELSIF p_prefixo = 'VPNI' THEN
    SELECT COALESCE(MAX(c.seq_mes), 0) + 1 INTO v_seq
      FROM public.contratos_instalador c WHERE c.ano_mes = v_ano_mes;
  ELSIF p_prefixo = 'VPFT' THEN
    SELECT COALESCE(MAX(f.seq_mes), 0) + 1 INTO v_seq
      FROM public.fichas_tecnicas f WHERE f.ano_mes = v_ano_mes;
  ELSE
    RAISE EXCEPTION 'Prefixo % desconhecido (use VPPROP, VPVE, VPNI ou VPFT)', p_prefixo;
  END IF;

  RETURN QUERY SELECT
    (p_prefixo || v_data || '_' || v_seq::text)::text,
    v_seq,
    v_ano_mes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO anon, authenticated;
