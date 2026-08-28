/* ============================================================
   Motor V2 (custo econômico completo) — issue "Precificação real" Fase 4.
   Guarda os inputs exclusivos do V2 (modo de formação, margem desejada,
   contingência, outros custos não recuperáveis) e o resultado do V2 lado
   a lado com o V1 (`resultado`, já existente) — comparação persistida,
   não só em memória, pra o Financeiro poder auditar depois. Aditiva e
   reversível; V1 continua sendo o motor "oficial" até a migração ser
   aceita (ver plano de implementação, Fase 5).
   ============================================================ */

alter table public.precificacoes_elevador
  add column if not exists modo_formacao_preco text not null default 'margem_sobre_venda'
    check (modo_formacao_preco in ('markup_sobre_custo', 'margem_sobre_venda')),
  add column if not exists margem_desejada_pct numeric,
  add column if not exists contingencia_valor numeric not null default 0,
  add column if not exists outros_custos_nao_recuperaveis_rs numeric not null default 0,
  add column if not exists resultado_v2 jsonb not null default '{}'::jsonb;
