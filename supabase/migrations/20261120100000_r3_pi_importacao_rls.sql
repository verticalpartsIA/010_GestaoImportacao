-- R3 (Segurança real #571) · Tabela 1/4 do PR-A: pi_importacao
-- Fecha escrita/leitura anônima, revoga privilégios extras de authenticated e corrige vp_int_del
-- para o nome exato do catálogo ('pi-importacao', com hífen). Preserva trigger vp_valores_guarda.
-- Rollback:
--   select public.vp_reabrir_tabela('pi_importacao');
--   grant truncate, references, trigger on public.pi_importacao to anon, authenticated;

select public.vp_fechar_tabela('pi_importacao', 'interno', 'R3');

revoke truncate, references, trigger on public.pi_importacao from authenticated;

drop policy if exists vp_int_del on public.pi_importacao;
create policy vp_int_del on public.pi_importacao
  for delete to authenticated
  using ((select public.vp_tem_capacidade('pi-importacao', 'excluir')));
