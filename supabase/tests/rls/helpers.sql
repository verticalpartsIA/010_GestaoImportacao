-- Teste das funções de autorização (Fase 1 / Task 3 da #571). Rodar via MCP SQL; TODA linha deve devolver ok = true.
select 'ativo conhecido'   as caso, (select public.vp_email_ativo((select email from public.perfis where ativo limit 1))) as ok
union all select 'email inexistente', not public.vp_email_ativo('naoexiste@exemplo.com')
union all select 'caixa alta', public.vp_email_ativo(upper((select email from public.perfis where ativo limit 1)))
union all select 'existe admin', (select count(*) from public.perfis where nivel='Administrador' and ativo) > 0
union all select 'sem JWT: vp_email vazio e não ativo', public.vp_email() = '' and not public.vp_usuario_ativo() and not public.vp_eh_admin()
union all select 'anon NÃO executa vp_email_ativo', not has_function_privilege('anon','public.vp_email_ativo(text)','execute')
union all select 'authenticated NÃO executa vp_email_ativo (oráculo)', not has_function_privilege('authenticated','public.vp_email_ativo(text)','execute')
union all select 'authenticated executa vp_usuario_ativo', has_function_privilege('authenticated','public.vp_usuario_ativo()','execute')
union all select 'anon NÃO executa fechar_tabela', not has_function_privilege('anon','public.vp_fechar_tabela(text,text,text)','execute')
union all select 'backup sem acesso para anon/authenticated', not has_table_privilege('anon','public.vp_policy_backup','select') and not has_table_privilege('authenticated','public.vp_policy_backup','select');
