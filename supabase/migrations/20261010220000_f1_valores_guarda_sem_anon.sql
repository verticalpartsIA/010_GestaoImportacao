-- Corrige a migração 20261010130000 (F1 — valores no banco): o trigger vp_valores_guarda avaliava
-- `current_user = 'authenticated' AND NOT vp_pode_valores(...)` num único predicado. O Postgres pode avaliar
-- os dois lados em qualquer ordem, e `anon` NÃO tem EXECUTE em vp_pode_valores → toda escrita feita pelo app
-- (chave pública, papel anon) nas 17 tabelas guardadas falhava com "permission denied for function vp_pode_valores",
-- mesmo com a trava desligada. Agora a função só é chamada quando o papel é `authenticated` (IF aninhado).
create or replace function public.vp_valores_guarda() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if not public.vp_pode_valores(tg_table_name) then
      raise exception 'Você não tem liberação para os valores em R$ desta tela.'
        using errcode = '42501', hint = 'vp_valores',
              detail = 'Peça a liberação em vpsistema.com/administracao (Valores).';
    end if;
  end if;
  return coalesce(new, old);
end $$;
