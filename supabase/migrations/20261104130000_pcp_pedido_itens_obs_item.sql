-- Quadros de Comando › Separação FAB QC: guarda a OBSERVAÇÃO DO ITEM do pedido do Omie (det[].observacao.obs_item).
-- No pedido do quadro (ex.: VPEL-735a) ela traz a lista de componentes que o cliente vê na proposta (inversor, placas, sensores…),
-- uma por linha, separadas por "|" e terminadas pela quantidade: "Suporte para Cabo de Comando de Elevador-2Peça (PC)".
-- Hoje o espelho pcp_pedido_itens não guardava esse texto. A rotina sync-pcp-pedidos passa a gravá-lo (só lê do Omie).
-- Coluna NOVA e opcional: nada existente muda; pedido antigo fica com null até a próxima leitura do Omie.

alter table public.pcp_pedido_itens add column if not exists obs_item text;

-- A marcação "Peguei" (qc_separacao_marcar) passa a aceitar também a linha de componente de um item: código "<ITEM>#<n>"
-- (n = posição da linha na observação, a partir de 1). O servidor confere que o item existe no pedido E que a linha n existe.
-- Itens comuns (sem "#") seguem exatamente como antes.
create or replace function public.qc_separacao_marcar(p_codigo_pedido bigint, p_codigo text, p_peguei boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_cod   text := upper(btrim(coalesce(p_codigo, '')));
  v_base  text;
  v_idx   int;
  v_n     int;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'editar') then raise exception 'separação QC: sem alçada "editar"'; end if;
  if p_codigo_pedido is null or v_cod = '' or p_peguei is null then raise exception 'separação QC: informe pedido, item e se pegou'; end if;

  if position('#' in v_cod) > 0 then
    -- linha de componente: "<ITEM>#<n>"
    if v_cod !~ '^[^#]+#[0-9]+$' then raise exception 'separação QC: código de componente inválido: %', v_cod; end if;
    v_base := split_part(v_cod, '#', 1);
    v_idx  := split_part(v_cod, '#', 2)::int;
    if not exists (
      select 1 from public.pcp_pedido_itens i
       where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_base and i.obs_item is not null
         and v_idx between 1 and array_length(string_to_array(i.obs_item, '|'), 1)
    ) then
      raise exception 'separação QC: o componente % não existe no pedido %', v_cod, p_codigo_pedido;
    end if;
  else
    -- item comum: precisa existir no pedido do Omie
    if not exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_cod) then
      raise exception 'separação QC: o item % não pertence ao pedido %', v_cod, p_codigo_pedido;
    end if;
  end if;

  if p_peguei then
    insert into public.qc_separacao_itens (codigo_pedido, codigo, peguei_por) values (p_codigo_pedido, v_cod, v_email)
      on conflict (codigo_pedido, codigo) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'pegou', v_email);
    end if;
  else
    delete from public.qc_separacao_itens where codigo_pedido = p_codigo_pedido and codigo = v_cod;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'devolveu', v_email);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'peguei', p_peguei, 'mudou', v_n > 0, 'por', v_email);
end $$;

revoke all on function public.qc_separacao_marcar(bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.qc_separacao_marcar(bigint, text, boolean) to authenticated;
