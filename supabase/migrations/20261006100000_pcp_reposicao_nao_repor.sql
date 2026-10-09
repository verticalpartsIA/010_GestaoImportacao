-- Reposição: item marcado "não repor" (descontinuado/sob encomenda) sai das sugestões e dos alertas de compra.
-- Colunas próprias: o sync do Omie não as toca (mesmo padrão de custo_manual).
alter table public.pcp_produtos
  add column if not exists nao_repor boolean not null default false,
  add column if not exists nao_repor_motivo text,
  add column if not exists nao_repor_por text,
  add column if not exists nao_repor_em timestamptz;

-- Ajuste manual (AJU) é correção de contagem, não consumo: passa a ficar fora por padrão.
update public.pcp_reposicao_config
   set origens_excluidas = origens_excluidas || ',AJU'
 where id = true
   and position(',AJU,' in (',' || upper(replace(origens_excluidas, ' ', '')) || ',')) = 0;
