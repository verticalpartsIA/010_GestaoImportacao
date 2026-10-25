-- Portal do fornecedor deixa de mostrar e de aceitar resposta para produto removido do lote (soft-delete, 25/10/2026).
-- Só acrescenta "removido_em is null" nas duas RPCs (versão de 20261020100000_cotacoes_varejo_fotos.sql); o resto é idêntico.
-- As respostas já dadas a esse produto continuam guardadas (nada é apagado).

create or replace function public.public_ivc_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into c from iv_cotacao_convites where token = p_token;
  if not found or c.status = 'rascunho' then return null; end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status = 'rascunho' then return null; end if;
  return jsonb_build_object(
    'convite', jsonb_build_object('id', c.id, 'fornecedor_nome', c.fornecedor_nome, 'idioma', c.idioma, 'moeda', c.moeda,
                                  'status', c.status, 'rodada', c.rodada, 'respondido_em', c.respondido_em),
    'lote', jsonb_build_object('numero', l.numero, 'status', l.status, 'encerrado', l.status <> 'em_cotacao'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                         'quantidade', i.quantidade_pedida, 'obs_vp', i.obs_vp, 'foto_url', i.foto_url, 'foto_url2', i.foto_url2,
                         'fotos_manuais', i.fotos_manuais) order by i.ordem, i.codigo)
                         from iv_cotacao_itens i where i.lote_id = l.id and i.removido_em is null), '[]'::jsonb),
    'respostas', coalesce((select jsonb_agg(jsonb_build_object('item_id', r.item_id, 'faixas', r.faixas, 'lead_time_dias', r.lead_time_dias,
                         'moq', r.moq, 'obs', r.obs, 'foto_fornecedor', r.foto_fornecedor, 'fotos_fornecedor', r.fotos_fornecedor, 'rodada', r.rodada))
                         from iv_cotacao_respostas r
                         join iv_cotacao_itens ri on ri.id = r.item_id and ri.removido_em is null
                        where r.convite_id = c.id), '[]'::jsonb));
end $$;

create or replace function public.public_ivc_responder(p_token text, p_respostas jsonb, p_moeda text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype; it jsonb; fx jsonb; fotos jsonb; item iv_cotacao_itens%rowtype;
        ex iv_cotacao_respostas%rowtype; n int := 0; lt int; mq numeric;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from iv_cotacao_convites where token = p_token for update;
  if not found or c.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status <> 'em_cotacao' then return jsonb_build_object('ok', false, 'erro', 'cotacao_encerrada'); end if;
  if jsonb_typeof(p_respostas) <> 'array' then return jsonb_build_object('ok', false, 'erro', 'formato'); end if;
  for it in select value from jsonb_array_elements(p_respostas) limit 1000 loop
    if jsonb_typeof(it) <> 'object' then continue; end if;
    select * into item from iv_cotacao_itens where id::text = (it->>'item_id') and lote_id = c.lote_id and removido_em is null;
    if not found then continue; end if;
    select coalesce(jsonb_agg(jsonb_build_object('min', m, 'preco', p) order by m), '[]'::jsonb) into fx
      from (select greatest(1, coalesce((x->>'min')::numeric, 1)) as m, (x->>'preco')::numeric as p
              from jsonb_array_elements(case when jsonb_typeof(it->'faixas') = 'array' then it->'faixas' else '[]'::jsonb end) x
             where (x->>'preco') ~ '^[0-9]+(\.[0-9]+)?$' and (x->>'preco')::numeric > 0 limit 6) q;
    select coalesce(jsonb_agg(v), '[]'::jsonb) into fotos
      from (select e.value #>> '{}' as v
              from jsonb_array_elements(case when jsonb_typeof(it->'fotos_fornecedor') = 'array' then it->'fotos_fornecedor' else '[]'::jsonb end) e
             where jsonb_typeof(e.value) = 'string' limit 5) q
     where v like 'https://%' and length(v) <= 500;
    lt := case when (it->>'lead_time_dias') ~ '^[0-9]{1,4}$' then (it->>'lead_time_dias')::int else null end;
    mq := case when (it->>'moq') ~ '^[0-9]+(\.[0-9]+)?$' then (it->>'moq')::numeric else null end;
    if jsonb_array_length(fx) = 0 and lt is null and mq is null and coalesce(it->>'obs','') = '' and jsonb_array_length(fotos) = 0 then continue; end if;
    select * into ex from iv_cotacao_respostas where convite_id = c.id and item_id = item.id;
    if found then
      update iv_cotacao_respostas set
        historico = case when c.rodada > ex.rodada and jsonb_array_length(ex.faixas) > 0
                         then ex.historico || jsonb_build_array(jsonb_build_object('rodada', ex.rodada, 'faixas', ex.faixas,
                              'lead_time_dias', ex.lead_time_dias, 'moq', ex.moq, 'em', ex.updated_at))
                         else ex.historico end,
        faixas = fx, lead_time_dias = lt, moq = mq, obs = left(it->>'obs', 2000),
        foto_fornecedor = left(coalesce(it->>'foto_fornecedor', ex.foto_fornecedor), 500),
        fotos_fornecedor = case when it ? 'fotos_fornecedor' then fotos else ex.fotos_fornecedor end,
        rodada = c.rodada, updated_at = now()
       where id = ex.id;
    else
      insert into iv_cotacao_respostas (convite_id, item_id, faixas, lead_time_dias, moq, obs, foto_fornecedor, fotos_fornecedor, rodada)
      values (c.id, item.id, fx, lt, mq, left(it->>'obs', 2000), left(it->>'foto_fornecedor', 500), fotos, c.rodada);
    end if;
    n := n + 1;
  end loop;
  update iv_cotacao_convites set status = 'respondido', respondido_em = now(), updated_at = now(),
         moeda = case when upper(coalesce(p_moeda, '')) in ('USD','EUR','BRL','RMB','CNY') then upper(p_moeda) else moeda end
   where id = c.id;
  return jsonb_build_object('ok', true, 'itens', n);
end $$;

revoke execute on function public.public_ivc_obter(text), public.public_ivc_responder(text, jsonb, text) from public;
grant execute on function public.public_ivc_obter(text), public.public_ivc_responder(text, jsonb, text) to anon, authenticated;
