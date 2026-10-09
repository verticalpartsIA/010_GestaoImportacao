-- Substitui o modelo aproximado da fiação do carro (migration
-- 20260929160000) pelos chicotes reais de "LISTA DE MATERIAIS E FICAO
-- PARA QUADRO DE COMANDO MANUFATURADO MONARCH.xlsx" (planilha de
-- engenharia real, achada em 29/09/2026). Nenhum registro real ainda
-- usava as 3 colunas antigas — só o quadro de teste desta sessão, já
-- soft-deletado — então é seguro trocar em vez de acumular colunas
-- obsoletas.
alter table public.quadros_comando_geometria
  drop column if exists fiacao_carro_barreira_mm,
  drop column if exists fiacao_carro_motor_porta_mm,
  drop column if exists fiacao_carro_botoeira_mm,
  add column if not exists fiacao_carro_gs1_mm integer,
  add column if not exists fiacao_carro_dc1_mm integer,
  add column if not exists fiacao_carro_den1_mm integer,
  add column if not exists fiacao_carro_edp1_alim_mm integer,
  add column if not exists fiacao_carro_edp1_sinal_mm integer,
  add column if not exists fiacao_carro_rdz_mm integer,
  add column if not exists fiacao_carro_fan_iluminacao_mm integer,
  add column if not exists fiacao_carro_fan_ventilador_mm integer,
  add column if not exists fiacao_carro_sl_mm integer,
  add column if not exists fiacao_carro_wt1_mm integer,
  add column if not exists fiacao_carro_pow1_mm integer;
