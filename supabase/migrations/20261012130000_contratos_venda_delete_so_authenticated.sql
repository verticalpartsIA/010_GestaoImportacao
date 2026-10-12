-- #843 B4: a policy de DELETE de rascunho de contrato (20261012110000) saiu aberta a anon (chave pública).
-- Agora só usuário autenticado e ativo apaga, e só rascunho/em_preenchimento.
drop policy if exists delete_rascunho_anon on public.contratos_venda_equipamentos;
create policy delete_rascunho_auth on public.contratos_venda_equipamentos
  for delete to authenticated
  using (status in ('em_preenchimento','rascunho') and (select public.vp_usuario_ativo()));
notify pgrst, 'reload schema';
