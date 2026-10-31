-- VP Estoque · FECHAR o saldo para a chave pública (anon). NÃO está em supabase/migrations de propósito.
--
-- Por quê: hoje o app (013_Estoque, mockup/catalog.js) lê com a chave pública (a) estoque_catalogo_v com fisico/reservado/saldo de ~1.965 itens e
-- (b) estoque_sessoes.lista_esperada, que carrega o SALDO CONGELADO de cada item. Qualquer pessoa com a chave pública lê esses saldos — e a
-- contagem "cega" deixa de ser cega (quem conta pode ver o número do sistema pelo navegador).
--
-- Quando aplicar: SÓ DEPOIS de o app (013_Estoque) ser publicado com a troca (PR do 013_estoque 'saldo por função') e a Edge Function estoque-eventos ter a acao "saldo". O app troca
--   • estoque_sessoes?select=...lista_esperada  ->  ...total_itens   (coluna criada na migration 20261013120000)
--   • estoque_catalogo_v?select=codigo,descricao,unidade,saldo  ->  sem 'saldo' (use a view _publica abaixo; o saldo só vai a quem tem alçada,
--     por função com JWT) — ou aceitar mostrar o saldo só na tela de Saída (aviso de saldo), vindo de uma função autenticada.
-- Aplicar antes quebra o app em desenvolvimento (HTTP 401/403 nas leituras).
--
-- Desfazer: grant select on public.estoque_sessoes to anon, authenticated;  e recriar estoque_catalogo_v como estava (ver migration
-- 'estoque_eventos_e_sessoes', de 13/10 04:41).

-- (a) sessões: o aparelho vê tudo MENOS a lista (e o saldo que ela carrega)
revoke select on public.estoque_sessoes from anon, authenticated;
grant select (id, tipo, nome, escopo, estado, limite_aparelhos, criado_por, criado_em, fechado_em, total_itens, tolerancia, recontagem_obrigatoria)
  on public.estoque_sessoes to anon, authenticated;
-- o hub lê a lista inteira pelas funções estoque_* (security definer), não pela tabela

-- (b) catálogo: sem saldo para a chave pública. A view sem saldo (estoque_catalogo_publico_v) e a função estoque_saldo_email
-- já foram criadas pela migration 20261018190000; o app novo pede o saldo só dos itens bipados (Edge Function estoque-eventos, acao "saldo").
revoke all on public.estoque_catalogo_v from anon, authenticated;

notify pgrst, 'reload schema';
