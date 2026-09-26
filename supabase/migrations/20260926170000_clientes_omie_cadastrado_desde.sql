-- 26/09 — pedido do usuário: coluna "Está no Omie desde" na lista de Leads.
-- A data pertence ao CLIENTE (CNPJ/CPF), não ao lead — vários leads podem
-- apontar pro mesmo cliente (leads.cliente_id → clientes.id).
--   omie_cadastrado_desde: data de inclusão no Omie (info.dInc do
--     ListarClientes); null = não está no Omie OU ainda não verificado.
--   omie_verificado_em: quando a consulta ao Omie foi feita por último;
--     null = nunca verificado. Separa "não está no Omie" (verificado, sem
--     data) de "ainda não sabemos" — e permite re-verificar os não
--     encontrados de tempos em tempos.
-- codigo_cliente_omie já existia (bigint) e passa a ser preenchido junto.
alter table clientes
  add column if not exists omie_cadastrado_desde date,
  add column if not exists omie_verificado_em timestamptz;
