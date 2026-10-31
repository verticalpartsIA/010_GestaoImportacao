-- VP Estoque · lista de itens da sessão para o APARELHO (sem saldo), pedida pela Edge Function `estoque-eventos`.
-- O aparelho não tem JWT do hub (o login é do vpsistema), então a versão por JWT (estoque_sessao_lista) não serve a ele:
-- esta recebe o e-mail já validado pela Edge Function e só roda com a chave de serviço. Só sessões ABERTAS.
create or replace function public.estoque_sessao_lista_email(p_email text, p_sessao uuid)
returns table (codigo text, descricao text, endereco text, rodada_atual integer, recontar boolean, contado_nesta_rodada boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.estoque_cap_email(p_email, 'contar') or public.estoque_cap_email(p_email, 'revisar')) then
    raise exception 'estoque: % não tem alçada para ver a lista (ou está inativo)', p_email;
  end if;
  if (select estado from public.estoque_sessoes where id = p_sessao) is distinct from 'aberta' then
    raise exception 'estoque: a sessão não está aberta';
  end if;
  return query
    select upper(btrim(x.codigo)), x.descricao, x.endereco, coalesce(d.rodada_atual, 1), coalesce(d.recontar, false),
           exists (select 1 from public.estoque_eventos e where e.sessao_id = s.id and e.codigo = upper(btrim(x.codigo))
                     and e.rodada = coalesce(d.rodada_atual, 1) and e.status <> 'rejeitado')
    from public.estoque_sessoes s
    cross join lateral jsonb_to_recordset(s.lista_esperada) as x(codigo text, descricao text, endereco text)
    left join public.estoque_sessao_decisoes d on d.sessao_id = s.id and d.codigo = upper(btrim(x.codigo))
    where s.id = p_sessao order by 1;
end $$;
revoke execute on function public.estoque_sessao_lista_email(text, uuid) from public, anon, authenticated;
grant execute on function public.estoque_sessao_lista_email(text, uuid) to service_role;
notify pgrst, 'reload schema';
