-- VP Estoque · despachante da REVISÃO para o app (013_Estoque), chamado pela Edge Function `estoque-revisao`.
-- As funções de revisão (estoque_resumo_sessao, estoque_decidir_item, estoque_aprovar_contagem…) conferem a alçada pelo JWT do hub
-- (vp_email()). O app só tem o login do vpsistema, então a Edge Function valida o token, descobre o e-mail e chama ESTA função com a
-- chave de serviço: ela monta as "claims" do usuário só dentro da transação e chama a função certa — a alçada continua sendo conferida
-- pelas funções originais (uma só verdade). Só service_role executa.
--
-- Ações: sessoes · resumo · leituras · abrir · recontagem · decidir · justificar_nao_contados · rejeitar · estado · aprovar · fechar.
create or replace function public.estoque_revisao_chamar(p_email text, p_acao text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_sess uuid; v_cod text; v_out jsonb; v_itens jsonb; v_cont jsonb; v_sit text[]; v_ids uuid[]; v_cods text[];
begin
  if v_email = '' then raise exception 'estoque: e-mail não informado'; end if;
  if not public.estoque_cap_email(v_email, 'revisar') then
    raise exception 'estoque: % não tem alçada "revisar" (ou está inativo)', v_email;
  end if;
  p_args := coalesce(p_args, '{}'::jsonb);
  -- a partir daqui o banco enxerga o usuário como no hub (JWT autenticado); vale só nesta transação
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_email)::text, true);
  v_sess := nullif(p_args->>'sessao_id', '')::uuid;
  v_cod := upper(btrim(coalesce(p_args->>'codigo', '')));

  case p_acao
    when 'sessoes' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc), '[]'::jsonb) into v_out from (
        select s.id, s.nome, s.tipo, s.estado, s.criado_em, s.criado_por, s.fechado_em, s.total_itens, s.tolerancia, s.recontagem_obrigatoria,
               (select count(distinct e.codigo) from public.estoque_eventos e where e.sessao_id = s.id and e.status <> 'rejeitado') contados,
               (select count(*) from public.estoque_eventos e where e.sessao_id = s.id and e.status = 'pendente') eventos_pendentes
        from public.estoque_sessoes s order by s.criado_em desc limit 50) x;
      return jsonb_build_object('sessoes', v_out);

    when 'resumo' then
      if v_sess is null then raise exception 'estoque: informe sessao_id'; end if;
      select array_agg(x) into v_sit from jsonb_array_elements_text(coalesce(p_args->'situacoes', 'null'::jsonb)) x where jsonb_typeof(p_args->'situacoes') = 'array';
      select coalesce(jsonb_object_agg(situacao, n), '{}'::jsonb) into v_cont
        from (select situacao, count(*) n from public.estoque_resumo_sessao(v_sess) group by 1) c;
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_itens from (
        select * from public.estoque_resumo_sessao(v_sess) r where v_sit is null or r.situacao = any (v_sit) limit 600) r;
      select to_jsonb(s) into v_out from (
        select id, nome, tipo, estado, criado_em, criado_por, fechado_em, total_itens, tolerancia, recontagem_obrigatoria
        from public.estoque_sessoes where id = v_sess) s;
      return jsonb_build_object('sessao', v_out, 'contagem', v_cont, 'itens', v_itens);

    when 'leituras' then
      if v_sess is null or v_cod = '' then raise exception 'estoque: informe sessao_id e codigo'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'quantidade', e.quantidade, 'rodada', e.rodada,
               'usuario', e.usuario, 'endereco', e.endereco, 'status', e.status, 'recebido_em', e.recebido_em,
               'observacao', e.observacao, 'motivo_rejeicao', e.motivo_rejeicao) order by e.recebido_em), '[]'::jsonb) into v_out
        from public.estoque_eventos e where e.sessao_id = v_sess and e.codigo = v_cod;
      return jsonb_build_object('leituras', v_out);

    when 'abrir' then
      return jsonb_build_object('sessao_id', public.estoque_abrir_sessao(
        p_args->>'tipo', p_args->>'nome', coalesce(p_args->'escopo', '{"modo":"completo"}'::jsonb),
        coalesce((p_args->>'limite')::integer, 10), (p_args->>'tolerancia')::numeric, coalesce((p_args->>'recontagem_obrigatoria')::boolean, false)));

    when 'recontagem' then
      select array_agg(x) into v_cods from jsonb_array_elements_text(coalesce(p_args->'codigos', '[]'::jsonb)) x;
      return jsonb_build_object('itens', public.estoque_pedir_recontagem(v_sess, coalesce(v_cods, '{}')));

    when 'decidir' then
      perform public.estoque_decidir_item(v_sess, v_cod, p_args->>'decisao', (p_args->>'quantidade')::numeric, p_args->>'justificativa');
      return jsonb_build_object('ok', true);

    when 'justificar_nao_contados' then
      return jsonb_build_object('itens', public.estoque_justificar_nao_contados(v_sess, p_args->>'justificativa'));

    when 'rejeitar' then
      select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(p_args->'ids', '[]'::jsonb)) x;
      return jsonb_build_object('rejeitadas', public.estoque_rejeitar_eventos(coalesce(v_ids, '{}'), p_args->>'motivo'));

    when 'estado' then
      perform public.estoque_mudar_estado(v_sess, p_args->>'estado');
      return jsonb_build_object('ok', true);

    when 'aprovar' then
      select array_agg(x) into v_cods from jsonb_array_elements_text(coalesce(p_args->'codigos', 'null'::jsonb)) x where jsonb_typeof(p_args->'codigos') = 'array';
      return public.estoque_aprovar_contagem(v_sess, v_cods);

    when 'fechar' then
      return public.estoque_fechar_sessao(v_sess);

    else
      raise exception 'estoque: ação "%" desconhecida', p_acao;
  end case;
end $$;
revoke execute on function public.estoque_revisao_chamar(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.estoque_revisao_chamar(text, text, jsonb) to service_role;
notify pgrst, 'reload schema';
