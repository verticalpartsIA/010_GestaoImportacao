/* ============================================================
   Adiciona "Tração" (2:1 / 4:1) às unidades do Formulário de Elevadores.
   Pré-requisito pra busca automática de mão de obra em
   custos_instalacao_elevador (tração × capacidade × paradas) — issue
   "Precificação real" Fase 3. Aditiva e reversível: coluna nova,
   nullable, não afeta unidades já cadastradas (ficam com tracao = null
   até o vendedor reabrir e preencher).
   ============================================================ */

alter table public.formularios_elevador_unidades
  add column if not exists tracao text check (tracao in ('2:1', '4:1'));
