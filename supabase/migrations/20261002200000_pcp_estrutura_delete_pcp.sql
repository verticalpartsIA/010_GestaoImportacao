-- Montagem do Produto: permite excluir só as linhas de estrutura criadas no PCP (origem = 'pcp').
-- Linhas vindas do Omie (origem = 'omie') continuam intocáveis por aqui.
create policy "pcp_estrutura_delete_pcp" on public.pcp_estrutura for delete using (origem = 'pcp');
