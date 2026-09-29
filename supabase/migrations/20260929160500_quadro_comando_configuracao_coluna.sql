-- Bug real encontrado em 29/09/2026: a aba "Configuração" do Quadro de
-- Comando (local/obra, responsável, datas, número de elevadores,
-- capacidade, velocidade, portas opostas na cabina, parada principal)
-- nunca tinha coluna nem chamada de save — quadro.configuracao era
-- descartado a cada reload. Sem isso, o campo portas_opostas_cabina
-- (usado pra dobrar a fiação da caixa de passagem quando a cabina tem
-- 2 aberturas) nunca sobreviveria a um recarregamento da página.
-- Mesmo padrão de escopo_fornecimento: jsonb livre na tabela header.
alter table public.quadros_comando
  add column if not exists configuracao jsonb not null default '{}'::jsonb;
