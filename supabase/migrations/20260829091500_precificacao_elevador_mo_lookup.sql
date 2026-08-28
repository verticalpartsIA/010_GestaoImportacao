/* ============================================================
   Guarda o resultado da busca automática de mão de obra (tração ×
   capacidade × paradas em custos_instalacao_elevador) por unidade, com
   origem/situação/regra usada — issue "Precificação real" Fase 3.
   Snapshot por precificação: se a tabela de referência mudar depois, uma
   precificação já calculada não muda retroactivamente (mesmo padrão de
   parametros_fiscais_snapshot). Aditiva e reversível.
   ============================================================ */

alter table public.precificacoes_elevador
  add column if not exists mo_lookup jsonb not null default '[]'::jsonb;
