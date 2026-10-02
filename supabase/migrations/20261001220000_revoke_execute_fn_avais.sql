-- ClaudeNotebook (issue #573): funções SECURITY DEFINER do fluxo de avais não devem ser
-- chamáveis via /rest/v1/rpc por anon/authenticated. Os triggers continuam funcionando
-- (a permissão de EXECUTE é checada na criação do trigger, não a cada disparo).
-- Rollback: grant execute on function ... to anon, authenticated;
revoke execute on function public.fn_avais_abrir_na_proposta() from anon, authenticated, public;
revoke execute on function public.fn_avais_notificar_ok(uuid) from anon, authenticated, public;
revoke execute on function public.fn_avais_notificar_ok_trg() from anon, authenticated, public;
