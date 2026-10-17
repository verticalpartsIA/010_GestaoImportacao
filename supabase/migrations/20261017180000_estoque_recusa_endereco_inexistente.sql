-- VP Estoque · recusa de endereço inexistente em estoque_registrar_eventos (contagem, inventário, recebimento e saída).
-- Pedido do Gelson em 17/10/2026. Só acrescenta a conferência do endereço (estoque_endereco_normalizar, migration 20261017120000);
-- o resto da função é idêntico à versão em produção. Endereço vazio continua aceito; endereço válido é gravado na forma oficial (R2A4).
-- Evento recusado vira "problema permanente" na fila do celular, com o motivo. Não altera eventos já gravados.

create or replace function public.estoque_registrar_eventos(p_email text, p_eventos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e jsonb; v_email text := lower(btrim(coalesce(p_email, ''))); v_out jsonb := '[]'::jsonb;
  v_id uuid; v_tipo text; v_cod text; v_qtd numeric; v_sess uuid; v_rod integer; v_cap text;
  v_ses public.estoque_sessoes%rowtype; v_n integer; v_apar text; v_fin text; v_ref text; v_obs text; v_end text;
begin
  if v_email = '' then raise exception 'estoque: e-mail do usuário não informado'; end if;
  if jsonb_typeof(p_eventos) <> 'array' then raise exception 'estoque: esperado uma lista de eventos'; end if;
  if jsonb_array_length(p_eventos) > 500 then raise exception 'estoque: lote grande demais (máx. 500 eventos)'; end if;

  for e in select * from jsonb_array_elements(p_eventos) loop
    begin
      v_id := (e->>'id')::uuid;
      if v_id is null then raise exception 'estoque: evento sem id'; end if;
      if exists (select 1 from public.estoque_eventos x where x.id = v_id) then
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', true, 'duplicado', true));
        continue;
      end if;

      v_tipo := e->>'tipo';
      v_cod := upper(btrim(coalesce(e->>'codigo', '')));
      v_qtd := (e->>'quantidade')::numeric;
      v_sess := nullif(e->>'sessao_id', '')::uuid;
      v_rod := coalesce((e->>'rodada')::integer, 1);
      v_apar := nullif(btrim(coalesce(e->>'aparelho', '')), '');
      v_fin := nullif(btrim(coalesce(e->>'finalidade', '')), '');
      v_ref := nullif(btrim(coalesce(e->>'referencia', '')), '');
      v_obs := nullif(btrim(coalesce(e->>'observacao', '')), '');
      -- Endereço informado precisa existir no galpão (estoque_enderecos). Vazio continua aceito (ex.: saída sem endereço).
      v_end := nullif(btrim(coalesce(e->>'endereco', '')), '');
      if v_end is not null then
        v_end := public.estoque_endereco_normalizar(v_end);
        if v_end is null then raise exception 'estoque: o endereço "%" não existe no galpão', btrim(e->>'endereco'); end if;
      end if;

      if v_tipo not in ('recebimento', 'contagem', 'saida', 'inventario') then raise exception 'estoque: tipo inválido'; end if;
      if v_cod = '' then raise exception 'estoque: código vazio'; end if;
      if v_qtd is null then raise exception 'estoque: quantidade ausente'; end if;
      if v_rod < 1 or v_rod > 5 then raise exception 'estoque: rodada inválida'; end if;

      v_cap := case v_tipo when 'contagem' then 'contar' when 'inventario' then 'contar'
                           when 'recebimento' then 'receber' else 'saida' end;
      if not public.estoque_cap_email(v_email, v_cap) then
        raise exception 'estoque: % não tem alçada "%" (ou está inativo)', v_email, v_cap;
      end if;

      if v_tipo in ('contagem', 'inventario') and v_sess is null then raise exception 'estoque: % exige sessão aberta', v_tipo; end if;
      if v_tipo in ('recebimento', 'saida') and v_sess is not null then raise exception 'estoque: % não usa sessão', v_tipo; end if;
      if v_tipo = 'saida' and v_fin is null then raise exception 'estoque: saída exige finalidade (ordem_producao, obra ou consumo_interno)'; end if;
      if v_tipo = 'recebimento' and v_ref is null and v_obs is null then
        raise exception 'estoque: recebimento exige o pedido (referência) ou, se fora do pedido, uma observação';
      end if;

      if v_sess is not null then
        select * into v_ses from public.estoque_sessoes where id = v_sess;
        if not found then raise exception 'estoque: sessão inexistente'; end if;
        if v_ses.estado <> 'aberta' then raise exception 'estoque: a sessão não está aberta'; end if;
        if v_ses.tipo <> v_tipo then raise exception 'estoque: sessão de % não aceita %', v_ses.tipo, v_tipo; end if;
        if v_apar is not null and not exists (select 1 from public.estoque_eventos x where x.sessao_id = v_sess and x.aparelho = v_apar) then
          select count(distinct x.aparelho) into v_n from public.estoque_eventos x where x.sessao_id = v_sess and x.aparelho is not null;
          if v_n >= v_ses.limite_aparelhos then raise exception 'estoque: a sessão já tem % aparelhos (limite)', v_ses.limite_aparelhos; end if;
        end if;
        if not exists (select 1 from jsonb_array_elements(v_ses.lista_esperada) x where upper(btrim(x->>'codigo')) = v_cod) then
          raise exception 'estoque: o código % não está na lista desta sessão', v_cod;
        end if;
        if v_rod > 1 and exists (select 1 from public.estoque_eventos x where x.sessao_id = v_sess and x.codigo = v_cod
                                   and x.rodada < v_rod and lower(x.usuario) = v_email) then
          raise exception 'estoque: a recontagem do % precisa ser feita por outra pessoa', v_cod;
        end if;
      end if;

      insert into public.estoque_eventos (id, tipo, codigo, quantidade, endereco, sessao_id, rodada, referencia, finalidade, aparelho,
                                          usuario, lido_em, recebido_em, status, observacao, foto_url, divergencia)
        values (v_id, v_tipo, v_cod, v_qtd, v_end, v_sess, v_rod, v_ref, v_fin, v_apar,
                v_email, coalesce((e->>'lido_em')::timestamptz, now()), now(), 'pendente', v_obs,
                nullif(e->>'foto_url', ''), coalesce((e->>'divergencia')::boolean, false));
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', true));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', e->>'id', 'ok', false, 'erro', sqlerrm));
    end;
  end loop;
  return v_out;
end $$;
revoke execute on function public.estoque_registrar_eventos(text, jsonb) from public, anon, authenticated;
grant execute on function public.estoque_registrar_eventos(text, jsonb) to service_role;
