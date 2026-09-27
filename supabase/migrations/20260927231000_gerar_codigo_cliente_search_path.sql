-- Fixa o search_path de gerar_codigo_cliente() (achado WARN
-- function_search_path_mutable do Security Advisor, auditoria de
-- 27/09/2026). Função não é SECURITY DEFINER (roda com privilégio de quem
-- chama), então o risco real aqui é baixo — mas fixar o search_path é
-- boa prática recomendada pela documentação oficial e fecha o lint.
-- Corpo idêntico ao que já está em produção (conferido via
-- pg_get_functiondef antes desta migration), só adiciona o SET.

CREATE OR REPLACE FUNCTION public.gerar_codigo_cliente()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  proximo_numero INTEGER;
BEGIN
  proximo_numero := nextval('seq_clientes_codigo');
  RETURN 'VPCLI-' || LPAD(proximo_numero::TEXT, 4, '0');
END;
$function$;
