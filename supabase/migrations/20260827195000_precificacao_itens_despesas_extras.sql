alter table precificacoes_elevador
  add column if not exists itens_despesas_extras jsonb not null default '[]'::jsonb;

comment on column precificacoes_elevador.itens_despesas_extras is
  'Lista avulsa {descricao, valor} pro card catch-all "Despesas Extras" — despesas recorrentes/planejadas sem seção própria ainda. Mesmo padrão de itens_instalacao_montagem; soma no mesmo total (K12) do motor de cálculo.';
