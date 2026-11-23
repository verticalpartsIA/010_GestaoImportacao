-- Boletos Avisos: a lista de clientes estourava o tempo limite do banco (17/11/2026, achado do Gelson).
-- Sintoma: a tela mostrava "canceling statement due to statement timeout" e nenhum cliente.
-- Causa: a visão boletos_avisos_resumo_v chama boletos_avisos_venc_efetivo() uma vez por boleto (1.276 chamadas) e a
-- função testava os 61 dias seguintes inteiros (min() sobre generate_series), em vez de parar no primeiro dia útil.
-- Medido em produção: visão = 5,5 s (como dono, sem RLS); com RLS e o limite de ~8 s do usuário logado, estoura.
-- Correção: mesma assinatura e mesmo resultado, só que para no primeiro dia útil (limit 1). Conferido em leitura nas
-- 410 datas distintas dos boletos em aberto: 0 diferenças; o cálculo isolado caiu de 5,5 s para ~0,12 s e a visão inteira, depois de aplicada, de 5,5 s para ~0,6 s (como dono do banco; o tempo de quem está logado, com RLS, não foi medido).
-- Rollback: recriar a função com o corpo da migration 20261117100000_boletos_avisos_dia_util.sql (min(g::date) ... where not sem_expediente).
create or replace function public.boletos_avisos_venc_efetivo(p_venc date)
returns date language sql stable set search_path to '' as $$
  select g::date from generate_series(p_venc, p_venc + 60, interval '1 day') g
   where not public.boletos_avisos_sem_expediente(g::date)
   limit 1;
$$;
