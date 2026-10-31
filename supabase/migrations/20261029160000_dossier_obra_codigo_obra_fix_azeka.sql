-- Correção: o UPDATE final da migration 20261029150000 (unir DOS-M046/047,
-- AZEKA — confirmado pelo usuário: "trate-a como uma só") foi bloqueado pela
-- própria trava que a mesma migration criou (trg_dossier_obra_fixa_codigo).
--
-- O que aconteceu: a carga automática (regra cliente+cidade/UF) NÃO uniu os
-- dois sozinha, porque os nomes de cliente são textualmente diferentes
-- ("AZEKA PARTICIPAÇÕES ( BANDEIRA PAULISTA)" x "AZEKA - CONDOMINIO BANDEIRA
-- PAULISTA - MOD") — por isso cada um recebeu um codigo_obra PRÓPRIO
-- (DOS-M046 = VPNI-OB0025, DOS-M047 = VPNI-OB0018) antes do UPDATE manual
-- rodar. Quando o UPDATE manual tentou sobrescrever o de DOS-M047, o
-- trigger viu old.codigo_obra já preenchido e, pela regra "uma vez
-- gravado, não muda", desfez a troca — o merge nunca aconteceu de verdade.
--
-- Correção: desliga o trigger só pra esta gravação pontual (mesmo padrão já
-- usado no projeto pra correção administrativa de registro de teste),
-- repete o UPDATE e liga de volta. DOS-M046 continua vencendo (nº menor).
alter table public.dossier_obra disable trigger trg_dossier_obra_fixa_codigo;

update public.dossier_obra
set codigo_obra = (select codigo_obra from public.dossier_obra where id = 'DOS-M046')
where id = 'DOS-M047';

alter table public.dossier_obra enable trigger trg_dossier_obra_fixa_codigo;
