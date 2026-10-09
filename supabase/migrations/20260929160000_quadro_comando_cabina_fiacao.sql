-- Aba "Cabina" do Quadro de Comando: acabamento da cabina + fiação da
-- caixa de passagem (chicote do carro: barreira de luz, motor do operador
-- de porta, sensores óticos/magnéticos, segurança do carro, botoeira de
-- cabina). Todas as colunas são opcionais/overridáveis — o padrão
-- automático (cabina até 2400x2400mm) é calculado no
-- quadro-comando-bom-engine.js, nunca gravado aqui; só o override manual
-- da engenharia (cabina fora do padrão) é persistido.
alter table public.quadros_comando_geometria
  add column if not exists aco_cabina text,
  add column if not exists acabamento_porta_cabina text,
  add column if not exists teto_falso text,
  add column if not exists piso_cabina text,
  add column if not exists corrimao text,
  add column if not exists fiacao_carro_barreira_mm integer,
  add column if not exists fiacao_carro_motor_porta_mm integer,
  add column if not exists fiacao_carro_sensores_mm integer,
  add column if not exists fiacao_carro_seguranca_mm integer,
  add column if not exists fiacao_carro_botoeira_mm integer;
