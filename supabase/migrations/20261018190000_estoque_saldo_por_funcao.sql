-- VP Estoque · saldo por item só para quem tem alçada, sem expor o catálogo inteiro à chave pública.
-- Contexto: a tela de Saída do app mostra "Saldo conhecido: N" e o aviso "Acima do saldo" ao lado do item bipado. Até hoje o app baixava o saldo de
-- TODOS os ~1.965 itens com a chave pública (estoque_catalogo_v) — o que também tira a "cegueira" da contagem. Agora o app pergunta o saldo só dos
-- itens bipados, à Edge Function `estoque-eventos` (acao "saldo"), que valida o login do vpsistema e chama esta função com a chave de serviço.
-- Esta migration é ADITIVA (nada fecha): cria a função e a view pública SEM saldo. O fechamento (revoke) é o script docs/seguranca/estoque-ocultar-saldo.sql,
-- que só roda DEPOIS de o app novo estar publicado.
create or replace function public.estoque_saldo_email(p_email text, p_codigos text[])
returns table (codigo text, saldo numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.estoque_cap_email(p_email, 'saida') or public.estoque_cap_email(p_email, 'revisar')) then
    raise exception 'estoque: % não tem alçada para consultar saldo (ou está inativo)', p_email;
  end if;
  if p_codigos is null or cardinality(p_codigos) = 0 then return; end if;
  if cardinality(p_codigos) > 50 then raise exception 'estoque: máximo de 50 códigos por consulta'; end if;
  return query
    select v.codigo::text, coalesce(v.saldo, 0)::numeric
      from public.estoque_catalogo_v v
     where upper(v.codigo) = any (select upper(btrim(x)) from unnest(p_codigos) x);
end $$;
revoke execute on function public.estoque_saldo_email(text, text[]) from public, anon, authenticated;
grant execute on function public.estoque_saldo_email(text, text[]) to service_role;

-- Catálogo público SEM saldo (código, descrição, unidade): é o que o app precisa para reconhecer o código bipado.
create or replace view public.estoque_catalogo_publico_v with (security_invoker = false) as
select e.sku as codigo, coalesce(p.descricao, e.sku) as descricao, coalesce(p.unidade, 'UN') as unidade, e.atualizado_em
from public.omie_estoque_cache e
left join public.importacao_varejo_produtos p on p.codigo = e.sku;
grant select on public.estoque_catalogo_publico_v to anon, authenticated;
notify pgrst, 'reload schema';
