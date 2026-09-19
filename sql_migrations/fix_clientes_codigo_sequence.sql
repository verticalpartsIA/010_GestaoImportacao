-- Migration: Criar sequência nativa para código de clientes (evita race condition)
-- Data: 2026-09-19
-- Motivo: gerarCodigo() em JS tinha race condition quando 2+ usuários criavam clientes simultaneamente

-- 1. Criar a sequência
CREATE SEQUENCE IF NOT EXISTS seq_clientes_codigo START WITH 1 INCREMENT BY 1;

-- 2. Criar função SQL que retorna o próximo código formatado (VPCLI-XXXX)
CREATE OR REPLACE FUNCTION gerar_codigo_cliente()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  proximo_numero INTEGER;
BEGIN
  proximo_numero := nextval('seq_clientes_codigo');
  RETURN 'VPCLI-' || LPAD(proximo_numero::TEXT, 4, '0');
END;
$$;

-- 3. Sincronizar sequência com o maior código já existente (se houver)
-- (se a tabela já tem clientes com código, sincronizar pra não ter conflito)
DO $$
DECLARE
  maior_numero INTEGER;
BEGIN
  SELECT MAX(CAST(SUBSTRING(codigo FROM 7) AS INTEGER))
    INTO maior_numero
    FROM clientes
    WHERE codigo ~ '^\d+$';

  IF maior_numero IS NOT NULL AND maior_numero > 0 THEN
    PERFORM setval('seq_clientes_codigo', maior_numero);
  END IF;
END $$;

-- 4. Verificar integridade (lista últimos códigos)
SELECT codigo FROM clientes ORDER BY criado_em DESC LIMIT 5;
