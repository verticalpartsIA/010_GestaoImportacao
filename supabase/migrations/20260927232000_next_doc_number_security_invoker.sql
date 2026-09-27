-- Troca next_doc_number() de SECURITY DEFINER pra SECURITY INVOKER (achado
-- WARN 0028/0029 do Security Advisor: função SECURITY DEFINER executável
-- via RPC por anon/authenticated, auditoria de 27/09/2026).
--
-- Verificado antes desta migration: as 5 tabelas que a função lê
-- (propostas, contratos_venda_equipamentos, contratos_instalador,
-- fichas_tecnicas, pedidos_fornecedor) já dão SELECT pra "anon" via RLS
-- (direto ou via roles={public}) — o único role que este app realmente usa
-- (SSO em outro projeto, sem sessão "authenticated" real aqui). Sem
-- SECURITY DEFINER a função não perde acesso a nenhum dado que ela já não
-- lesse por outro caminho. GRANT EXECUTE existente não muda.
--
-- Observação separada (fora do escopo desta correção): contratos_instalador,
-- propostas e fichas_tecnicas têm policy só pra "anon", nenhuma pra
-- "authenticated" — hoje sem efeito prático (o app não autentica como
-- "authenticated" neste projeto), mas fica registrado caso isso mude.

CREATE OR REPLACE FUNCTION public.next_doc_number(p_prefixo text)
 RETURNS TABLE(numero_documento text, seq_mes integer, ano_mes text)
 LANGUAGE plpgsql
 SECURITY INVOKER
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
