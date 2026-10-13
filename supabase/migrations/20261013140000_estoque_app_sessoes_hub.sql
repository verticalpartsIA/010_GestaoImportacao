-- VP Estoque · quem REVISA (alçada estoque.revisar, JWT do hub) precisa ler as sessões em qualquer estado.
-- A política que já existe (estoque_sessoes_select_abertas, usada pelo app com a chave pública) só mostra estado = 'aberta';
-- sem esta, as telas do hub não enxergam sessões em_revisao/fechada. Política adicional (OR com a existente); não altera o que o app lê.
drop policy if exists estoque_sessoes_select_hub on public.estoque_sessoes;
create policy estoque_sessoes_select_hub on public.estoque_sessoes for select to authenticated
  using ((select public.vp_tem_capacidade('estoque', 'revisar')));
notify pgrst, 'reload schema';
