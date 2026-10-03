-- PCP · custo manual do produto/componente (para item que o Omie ainda não tem custo: nunca foi comprado).
-- Coluna PRÓPRIA: a sincronização com o Omie sobrescreve preco_custo (CMC) a cada rodada e apagaria qualquer ajuste ali.
-- Regra de uso: vale o custo do Omie (preco_custo > 0); só quando ele não existe é que entra o custo manual.
alter table public.pcp_produtos add column if not exists custo_manual numeric;
alter table public.pcp_produtos add column if not exists custo_manual_obs text;
alter table public.pcp_produtos add column if not exists custo_manual_por text;
alter table public.pcp_produtos add column if not exists custo_manual_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pcp_produtos_custo_manual_pos') then
    alter table public.pcp_produtos add constraint pcp_produtos_custo_manual_pos check (custo_manual is null or custo_manual > 0);
  end if;
end $$;
