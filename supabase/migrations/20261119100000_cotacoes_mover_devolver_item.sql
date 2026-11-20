-- Cotações de Varejo: comprador MOVE item para outro lote em rascunho e DEVOLVE item à fila de Solicitações (19/11/2026, pedido do Gelson).
-- Só lote em `rascunho` (nada foi enviado ao fornecedor). Exigem a alçada de comprador (iv_solicitacao_pode_tratar()).
-- Nada é apagado: o item de origem fica com removido_em/removido_por (Art. 27) e o histórico da solicitação registra o que houve.
-- Rollback: drop function public.iv_cotacao_mover_item(uuid, uuid, text), public.iv_cotacao_devolver_item(uuid);

-- Move o item para outro lote em rascunho (novo se p_lote_destino for nulo). Produto já presente no destino soma a quantidade.
create or replace function public.iv_cotacao_mover_item(p_item_id uuid, p_lote_destino uuid default null, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := (select public.vp_email()); v_nome text; li public.iv_cotacao_itens; origem public.iv_cotacao_lotes; destino public.iv_cotacao_lotes;
        ex public.iv_cotacao_itens; novo_id uuid; v_ordem int; v_somou boolean := false; si public.iv_solicitacao_itens;
begin
  if not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada: só o comprador move item entre lotes'; end if;
  select * into li from public.iv_cotacao_itens where id = p_item_id and removido_em is null for update;
  if not found then raise exception 'item_inexistente: o produto não está mais no lote'; end if;
  select * into origem from public.iv_cotacao_lotes where id = li.lote_id for update;
  if origem.status <> 'rascunho' then raise exception 'lote_fechado: o lote % já foi enviado aos fornecedores', origem.numero; end if;
  if p_lote_destino is not null and p_lote_destino = li.lote_id then raise exception 'mesmo_lote: o produto já está neste lote'; end if;
  if p_lote_destino is null then
    select coalesce(nullif(p.nome,''), v_email) into v_nome from public.perfis p where lower(p.email) = v_email limit 1;
    insert into public.iv_cotacao_lotes (titulo, criado_por, criado_por_nome) values (nullif(left(trim(coalesce(p_titulo,'')), 80), ''), v_email, coalesce(v_nome, v_email)) returning * into destino;
  else
    select * into destino from public.iv_cotacao_lotes where id = p_lote_destino for update;
    if not found then raise exception 'lote_inexistente'; end if;
    if destino.status <> 'rascunho' then raise exception 'lote_fechado: o lote % já foi enviado aos fornecedores', destino.numero; end if;
  end if;
  select * into ex from public.iv_cotacao_itens where lote_id = destino.id and codigo = li.codigo and removido_em is null limit 1 for update;
  if found then
    update public.iv_cotacao_itens set quantidade_pedida = coalesce(quantidade_pedida, 0) + coalesce(li.quantidade_pedida, 0) where id = ex.id;
    novo_id := ex.id; v_somou := true;
  else
    select coalesce(max(ordem), -1) + 1 into v_ordem from public.iv_cotacao_itens where lote_id = destino.id;
    insert into public.iv_cotacao_itens (lote_id, codigo, descricao, unidade, quantidade_pedida, ordem, obs_vp, exige_certificado, foto_url, foto_url2, solicitacao_item_id)
    values (destino.id, li.codigo, li.descricao, li.unidade, li.quantidade_pedida, v_ordem, li.obs_vp, li.exige_certificado, li.foto_url, li.foto_url2, li.solicitacao_item_id)
    returning id into novo_id;
  end if;
  update public.iv_cotacao_itens set removido_em = now(), removido_por = v_email where id = li.id;
  delete from public.iv_cotacao_decisoes where item_id = li.id;
  -- pedidos de vendedor ligados a este item (podem ser vários, se o produto foi somado antes) passam a apontar para o item do destino
  for si in select * from public.iv_solicitacao_itens where lote_item_id = li.id and removido_em is null for update loop
    update public.iv_solicitacao_itens set lote_id = destino.id, lote_item_id = novo_id, alocado_por = v_email, alocado_em = now() where id = si.id;
    insert into public.iv_solicitacao_hist (solicitacao_id, item_id, acao, por, detalhe)
      values (si.solicitacao_id, si.id, 'realocou', v_email, jsonb_build_object('de', origem.numero, 'lote', destino.numero, 'codigo', li.codigo, 'quantidade', si.quantidade));
  end loop;
  return jsonb_build_object('lote_id', destino.id, 'numero', destino.numero, 'novo', p_lote_destino is null, 'somado', v_somou, 'de', origem.numero);
end $$;

-- Devolve o item à fila de Solicitações: sai do lote e o pedido do vendedor volta a "não alocado" (solicitação alocada → em_analise).
-- Item de cesta (sem solicitação) apenas sai do lote.
create or replace function public.iv_cotacao_devolver_item(p_item_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := (select public.vp_email()); li public.iv_cotacao_itens; lote public.iv_cotacao_lotes; si public.iv_solicitacao_itens; n int := 0; sid uuid;
begin
  if not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada: só o comprador devolve item'; end if;
  select * into li from public.iv_cotacao_itens where id = p_item_id and removido_em is null for update;
  if not found then raise exception 'item_inexistente: o produto não está mais no lote'; end if;
  select * into lote from public.iv_cotacao_lotes where id = li.lote_id for update;
  if lote.status <> 'rascunho' then raise exception 'lote_fechado: o lote % já foi enviado aos fornecedores', lote.numero; end if;
  update public.iv_cotacao_itens set removido_em = now(), removido_por = v_email where id = li.id;
  delete from public.iv_cotacao_decisoes where item_id = li.id;
  for si in select * from public.iv_solicitacao_itens where lote_item_id = li.id and removido_em is null for update loop
    update public.iv_solicitacao_itens set lote_id = null, lote_item_id = null, alocado_por = null, alocado_em = null where id = si.id;
    insert into public.iv_solicitacao_hist (solicitacao_id, item_id, acao, por, detalhe)
      values (si.solicitacao_id, si.id, 'devolveu_fila', v_email, jsonb_build_object('lote', lote.numero, 'codigo', li.codigo, 'quantidade', si.quantidade));
    update public.iv_solicitacoes set status = 'em_analise', updated_at = now() where id = si.solicitacao_id and status = 'alocada';
    n := n + 1;
  end loop;
  return jsonb_build_object('lote', lote.numero, 'devolvidos', n);
end $$;

revoke all on function public.iv_cotacao_mover_item(uuid, uuid, text), public.iv_cotacao_devolver_item(uuid) from public, anon;
grant execute on function public.iv_cotacao_mover_item(uuid, uuid, text), public.iv_cotacao_devolver_item(uuid) to authenticated;
