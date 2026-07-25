-- Padrão universal de codificação de IDs (Fase 1): Master ID
-- [PREFIXO-TIPO][Nº DA COTAÇÃO]-[REVISÃO]-[ATIVO], ex.: VPEL-EL0902-A-1.
-- Reaproveita formularios_elevador.numero_cotacao como o número — nada de
-- contador novo. Cotações antigas (VPEL-0001..0003) NÃO são migradas; o
-- padrão novo passa a valer só pra cotações a fornecedor criadas a partir
-- daqui (ver src/master-id-engine.js e cotacao-elevador-fornecedor-store.js).

-- Índice de ativo — 1 elevador = 1 índice, atribuído uma única vez na
-- criação da Unidade e reaproveitado pra sempre (Precificação, Proposta,
-- Contrato de Venda, Contrato Instalador — fases futuras), independente de
-- quantas cotações/revisões essa Unidade passar a fazer parte.
alter table public.formularios_elevador_unidades
  add column if not exists indice_ativo integer;

-- Sufixo de revisão da Cotação a Fornecedor (reenvio por mudança de
-- especificação técnica pedida pelo Vendedor). Nulo = 1º envio (sem sufixo).
alter table public.cotacoes_elevador_fornecedor
  add column if not exists revisao text;
