-- ============================================================
-- Corrige omie_pagamentos_cache pra guardar valor_pago/valor_a_pagar
-- reais por título (equivalente às colunas "Valor Pago"/"Valor a
-- Pagar" do próprio Omie), em vez de só um booleano pago/não-pago.
--
-- Achado do usuário 10/09, comparando com a tela de Contas a Pagar
-- do Omie: um título com baixa PARCIAL (status_titulo =
-- "PAGTO_PARCIAL") não batia com o antigo isPago() (só comparava
-- contra "PAGO"), então o valor_documento inteiro caía pro lado "não
-- pago" — escondendo dinheiro que o instalador já tinha recebido de
-- verdade (ex.: sinal de 25% já baixado, resto em aberto). O Omie
-- expõe o saldo em aberto por título via o campo valor_pag ("Valor a
-- Pagar" na listagem) — a Edge Function agora grava isso direto, e
-- valor_pago = valor_documento - valor_a_pagar.
--
-- Títulos CANCELADO deixam de ser sincronizados (não são mais uma
-- obrigação real) — os que já estavam no cache de sincronizações
-- anteriores são removidos aqui.
-- ============================================================

ALTER TABLE public.omie_pagamentos_cache
  ADD COLUMN IF NOT EXISTS valor_pago numeric,
  ADD COLUMN IF NOT EXISTS valor_a_pagar numeric;

-- Backfill best-effort dos registros já sincronizados: sem o
-- valor_pag do Omie salvo historicamente, só dá pra inferir pelo
-- booleano antigo (perde a granularidade parcial até a próxima
-- sincronização, que já vai vir com os campos corretos).
UPDATE public.omie_pagamentos_cache
SET valor_pago = CASE WHEN pago THEN valor_documento ELSE 0 END,
    valor_a_pagar = CASE WHEN pago THEN 0 ELSE valor_documento END
WHERE valor_pago IS NULL;

DELETE FROM public.omie_pagamentos_cache WHERE upper(status_titulo) = 'CANCELADO';
