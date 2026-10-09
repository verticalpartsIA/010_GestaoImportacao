-- Adiciona o prefixo VPRF (Pedido a Fornecedor) à next_doc_number().
--
-- Achado do review (Codex, PR #321): a versão checada em
-- 20260603162905_create_fichas_tecnicas_table.sql só aceita VPPROP/VPVE/
-- VPNI/VPFT — o prefixo VPPC usado por pedido-fornecedor-store.js até
-- 01/09 já não estava neste arquivo (drift de uma alteração aplicada
-- direto em produção antes desta sessão). Esta migração reflete fielmente
-- a função que está de fato em produção (jxtqwzmpgofwctqajewt) hoje,
-- incluindo VPPC — mantido só por compatibilidade, sem nenhum chamador no
-- código — e o novo VPRF, que pedido-fornecedor-store.js passou a usar
-- (VPPC colide com o prefixo que master-id-engine.js reserva pra etapa
-- Precificação, ex.: VPPC-0950).
CREATE OR REPLACE FUNCTION public.next_doc_number(p_prefixo text)
 RETURNS TABLE(numero_documento text, seq_mes integer, ano_mes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  ELSIF p_prefixo = 'VPPC' THEN
    -- Legado: mantido só por compatibilidade (nada mais deve gerar número
    -- novo com este prefixo — colide com o prefixo VPPC reservado à etapa
    -- "Precificação" em master-id-engine.js, ex.: VPPC-0950). Pedido a
    -- Fornecedor passou a usar VPRF (ver abaixo).
    SELECT COALESCE(MAX(pf.seq_mes), 0) + 1 INTO v_seq
      FROM public.pedidos_fornecedor pf WHERE pf.ano_mes = v_ano_mes;
  ELSIF p_prefixo = 'VPRF' THEN
    SELECT COALESCE(MAX(pf.seq_mes), 0) + 1 INTO v_seq
      FROM public.pedidos_fornecedor pf WHERE pf.ano_mes = v_ano_mes;
  ELSE
    RAISE EXCEPTION 'Prefixo % desconhecido (use VPPROP, VPVE, VPNI, VPFT, VPRF ou VPPC)', p_prefixo;
  END IF;

  RETURN QUERY SELECT
    (p_prefixo || v_data || '_' || v_seq::text)::text,
    v_seq,
    v_ano_mes;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO anon, authenticated;
