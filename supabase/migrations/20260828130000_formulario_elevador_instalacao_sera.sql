-- "Tipo de mão de obra" (tipo_mao_de_obra) virou "Instalação Será" na UI —
-- valores 'local'/'sao_paulo'/'sem_mao_de_obra' (mão de obra de onde) dão
-- lugar a 'verticalparts'/'cliente' (quem instala), mesmo par de valores
-- já usado em responsavel_entrega. A coluna continua com o mesmo nome —
-- só o rótulo e as opções mudaram na tela.
-- NOT VALID: os 4 formulários já salvos com valor antigo (2x sao_paulo,
-- 1x local) não são revalidados retroativamente — só passam a valer pra
-- inserts/updates novos, pra não quebrar a migration numa dessas linhas.
alter table formularios_elevador
  drop constraint if exists formularios_elevador_tipo_mao_de_obra_check;

alter table formularios_elevador
  add constraint formularios_elevador_tipo_mao_de_obra_check
  check (tipo_mao_de_obra in ('verticalparts', 'cliente')) not valid;

comment on column formularios_elevador.tipo_mao_de_obra is
  'UI: "Instalação Será" — quem instala o equipamento. Valores: verticalparts | cliente. Nome de coluna mantido por compatibilidade (era "Tipo de mão de obra" antes de 28/08).';
