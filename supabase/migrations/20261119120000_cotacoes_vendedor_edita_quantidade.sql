-- Cotações de Varejo: o VENDEDOR (sem alçada de comprador) insere/edita a quantidade só dos itens que ELE pediu (19/11/2026, pedido do Gelson).
-- "Item dele" = (a) todas as solicitações de vendedor ligadas ao item do lote são dele, ou (b) item de cesta (sem solicitação) em lote criado por ele.
-- Item somado de vários vendedores não é editável por vendedor (peça ao comprador). Só lote `rascunho` ou `em_cotacao`. Comprador (iv_solicitacao_pode_tratar) edita qualquer item.
-- Limite honesto: iv_cotacao_itens ainda tem a política vp_int_upd (qualquer usuário ativo), então a regra vale para quem usa a tela/RPC, não contra chamada direta à API (issue #571).
-- Rollback: drop function public.iv_cotacao_ajustar_quantidade(uuid, numeric), public.iv_cotacao_itens_editaveis(uuid), public._iv_cot_item_dono(uuid, text);

create or replace function public._iv_cot_item_dono(p_item_id uuid, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.iv_solicitacao_itens si where si.lote_item_id = p_item_id and si.removido_em is null)
      then (select count(*) from public.iv_solicitacao_itens si where si.lote_item_id = p_item_id and si.removido_em is null) = 1
           and not exists (select 1 from public.iv_solicitacao_itens si join public.iv_solicitacoes s on s.id = si.solicitacao_id
                           where si.lote_item_id = p_item_id and si.removido_em is null and lower(s.solicitante_email) <> lower(p_email))
    else exists (select 1 from public.iv_cotacao_itens i join public.iv_cotacao_lotes l on l.id = i.lote_id
                 where i.id = p_item_id and lower(coalesce(l.criado_por, '')) = lower(p_email))
  end
$$;

-- Ids dos itens do lote que o usuário logado pode editar (a tela mostra o campo de quantidade só para esses).
create or replace function public.iv_cotacao_itens_editaveis(p_lote_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare v_email text := (select public.vp_email()); lote public.iv_cotacao_lotes; ids uuid[];
begin
  if not (select public.vp_usuario_ativo()) then return '{}'; end if;
  select * into lote from public.iv_cotacao_lotes where id = p_lote_id;
  if not found or lote.status not in ('rascunho','em_cotacao') then return '{}'; end if;
  if public.iv_solicitacao_pode_tratar() then
    select coalesce(array_agg(id), '{}') into ids from public.iv_cotacao_itens where lote_id = p_lote_id and removido_em is null;
  else
    select coalesce(array_agg(i.id), '{}') into ids from public.iv_cotacao_itens i
      where i.lote_id = p_lote_id and i.removido_em is null and public._iv_cot_item_dono(i.id, v_email);
  end if;
  return ids;
end $$;

create or replace function public.iv_cotacao_ajustar_quantidade(p_item_id uuid, p_quantidade numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := (select public.vp_email()); v_nome text; li public.iv_cotacao_itens; lote public.iv_cotacao_lotes; v_antes numeric; v_comprador boolean;
begin
  if not (select public.vp_usuario_ativo()) then raise exception 'sem_alcada: usuário sem acesso ativo'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'quantidade_invalida: informe uma quantidade maior que zero'; end if;
  select * into li from public.iv_cotacao_itens where id = p_item_id and removido_em is null for update;
  if not found then raise exception 'item_inexistente: o produto não está mais no lote'; end if;
  select * into lote from public.iv_cotacao_lotes where id = li.lote_id;
  if lote.status not in ('rascunho','em_cotacao') then raise exception 'lote_fechado: o lote % não aceita mais alteração de quantidade', lote.numero; end if;
  v_comprador := public.iv_solicitacao_pode_tratar();
  if not v_comprador and not public._iv_cot_item_dono(p_item_id, v_email) then
    raise exception 'sem_alcada: você só altera a quantidade dos produtos que você pediu';
  end if;
  v_antes := li.quantidade_pedida;
  update public.iv_cotacao_itens set quantidade_pedida = p_quantidade where id = li.id;
  if not v_comprador then
    -- o pedido do vendedor acompanha o lote (a realocação usa a quantidade da solicitação)
    update public.iv_solicitacao_itens set quantidade = p_quantidade where lote_item_id = li.id and removido_em is null;
    insert into public.iv_solicitacao_hist (solicitacao_id, item_id, acao, por, detalhe)
      select si.solicitacao_id, si.id, 'ajustou_quantidade', v_email, jsonb_build_object('codigo', li.codigo, 'de', v_antes, 'para', p_quantidade, 'lote', lote.numero)
      from public.iv_solicitacao_itens si where si.lote_item_id = li.id and si.removido_em is null;
    -- lote já enviado ao fornecedor: avisa o comprador (falha do aviso nunca impede a alteração)
    if lote.status = 'em_cotacao' then
      begin
        select coalesce(nullif(p.nome,''), v_email) into v_nome from public.perfis p where lower(p.email) = v_email limit 1;
        insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
        values ('cotv-qtd-' || li.id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'warn',
                'Quantidade alterada no lote ' || lote.numero || ' — ' || coalesce(v_nome, v_email),
                li.codigo || ': de ' || coalesce(v_antes::text, '—') || ' para ' || p_quantidade::text || '. O fornecedor já recebeu a cotação com a quantidade antiga.',
                'Compras', false, null, '/gestao-importacao/rfq-importacao/' || lote.id || '/comparar');
      exception when others then raise warning 'iv_cotacao_ajustar_quantidade: aviso falhou: %', sqlerrm; end;
    end if;
  end if;
  return jsonb_build_object('item_id', li.id, 'codigo', li.codigo, 'de', v_antes, 'para', p_quantidade, 'lote', lote.numero, 'lote_status', lote.status);
end $$;

revoke all on function public._iv_cot_item_dono(uuid, text) from public, anon, authenticated;
revoke all on function public.iv_cotacao_itens_editaveis(uuid), public.iv_cotacao_ajustar_quantidade(uuid, numeric) from public, anon;
grant execute on function public.iv_cotacao_itens_editaveis(uuid), public.iv_cotacao_ajustar_quantidade(uuid, numeric) to authenticated;
