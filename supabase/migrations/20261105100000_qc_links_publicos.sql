-- Quadros de Comando › LINKS PÚBLICOS (pedido do Gelson, 05/11/2026). Três páginas sem login, cada uma com um link secreto (token):
--   pedidos       → gestores acompanham o status da fabricação e da separação (SÓ LEITURA);
--   separacao     → separador marca "Peguei" pelo celular (Separação PV QC);
--   separacao_fab → idem para a Separação FAB QC (cabos do kit + componentes do quadro).
-- Segue o desenho do Painel TV da Separação (separacao_tv_tokens): tabela FECHADA (RLS, sem acesso de anon/authenticated); o visitante só
-- executa as duas funções públicas, que exigem token válido. Quem cria/renova o link é usuário logado com alçada.
-- O "Peguei" feito pelo link grava o NOME que o separador digitou (não há login): ficam em qc_separacao_itens/hist como "link: <nome>".

create table if not exists public.qc_publico_links (
  tipo text primary key check (tipo in ('pedidos', 'separacao', 'separacao_fab')),
  token text not null unique,
  criado_por text,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
alter table public.qc_publico_links enable row level security;
revoke all on public.qc_publico_links from public, anon, authenticated;
grant all on public.qc_publico_links to service_role;

-- ---------- Interno (usuário logado): obter / renovar o link de um tipo ----------
create or replace function public._qc_publico_novo_token() returns text
language sql as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;
revoke all on function public._qc_publico_novo_token() from public, anon, authenticated;

create or replace function public.qc_publico_link_obter(p_tipo text, p_renovar boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare v_tok text; v_email text := public.vp_email();
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'link QC: sem sessão ativa'; end if;
  if p_tipo not in ('pedidos', 'separacao', 'separacao_fab') then raise exception 'link QC: tipo inválido'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'ver') then raise exception 'link QC: sem alçada "ver"'; end if;
  if p_renovar then
    if not public.vp_tem_capacidade('quadros-separacao', 'editar') then raise exception 'link QC: sem alçada "editar" para trocar o link'; end if;
    insert into public.qc_publico_links (tipo, token, criado_por) values (p_tipo, public._qc_publico_novo_token(), v_email)
      on conflict (tipo) do update set token = excluded.token, criado_por = excluded.criado_por, criado_em = now(), ultimo_acesso = null
      returning token into v_tok;
    return v_tok;
  end if;
  select token into v_tok from public.qc_publico_links where tipo = p_tipo;
  if v_tok is null then
    if not public.vp_tem_capacidade('quadros-separacao', 'editar') then raise exception 'link QC: o link ainda não existe e você não tem alçada "editar" para criá-lo'; end if;
    insert into public.qc_publico_links (tipo, token, criado_por) values (p_tipo, public._qc_publico_novo_token(), v_email)
      on conflict (tipo) do nothing;
    select token into v_tok from public.qc_publico_links where tipo = p_tipo;
  end if;
  return v_tok;
end $$;
revoke all on function public.qc_publico_link_obter(text, boolean) from public, anon, authenticated;
grant execute on function public.qc_publico_link_obter(text, boolean) to authenticated;

-- ---------- Dados brutos (mesmas tabelas que a tela interna lê; o navegador monta as linhas com o mesmo código) ----------
create or replace function public._qc_dados_brutos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cod text[]; v_ops jsonb; v_mae jsonb; v_status jsonb; v_chk jsonb; v_itq jsonb; v_ids bigint[]; v_ped jsonb; v_itens jsonb; v_fis jsonb;
begin
  select coalesce(array_agg(distinct codigo_produto), '{}') into v_cod from public.pcp_quadro_variante where codigo_produto is not null;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'numero', o.numero, 'titulo', o.titulo, 'produto', o.produto, 'cliente', o.cliente,
           'status', o.status, 'prazo_entrega', o.prazo_entrega, 'data_abertura', o.data_abertura, 'pedido_codigo', o.pedido_codigo, 'ordem_mae_id', o.ordem_mae_id)), '[]'::jsonb)
    into v_ops from public.pcp_ordens o where o.frente = 'quadro' and o.status in ('aguardando', 'em_producao');

  select coalesce(jsonb_object_agg(m.id::text, m.pedido_codigo), '{}'::jsonb) into v_mae
    from public.pcp_ordens m where m.id in (select ordem_mae_id from public.pcp_ordens where frente = 'quadro' and status in ('aguardando', 'em_producao') and ordem_mae_id is not null);

  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('fabricacao_quadro_itens',
           (select jsonb_build_object('id', i.id, 'texto', i.texto, 'ordem', i.ordem, 'peso', i.peso) from public.fabricacao_quadro_itens i where i.id = s.item_id))), '[]'::jsonb)
    into v_status from public.fabricacao_quadro_status s
   where s.ordem_id in (select id from public.pcp_ordens where frente = 'quadro' and status in ('aguardando', 'em_producao'));

  select coalesce(jsonb_agg(to_jsonb(i) order by i.ordem), '[]'::jsonb) into v_chk from public.fabricacao_quadro_itens i;

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', x.codigo_pedido, 'codigo', x.codigo, 'quantidade', x.quantidade)), '[]'::jsonb)
    into v_itq from public.pcp_pedido_itens x where x.codigo = any (v_cod);

  select coalesce(array_agg(distinct k), '{}') into v_ids from (
    select x.codigo_pedido k from public.pcp_pedido_itens x where x.codigo = any (v_cod)
    union select o.pedido_codigo from public.pcp_ordens o where o.frente = 'quadro' and o.status in ('aguardando', 'em_producao') and o.pedido_codigo is not null
    union select m.pedido_codigo from public.pcp_ordens m where m.id in (select ordem_mae_id from public.pcp_ordens where frente = 'quadro' and status in ('aguardando', 'em_producao') and ordem_mae_id is not null) and m.pedido_codigo is not null
  ) t where k is not null;

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', p.codigo_pedido, 'numero_pedido', p.numero_pedido, 'etapa', p.etapa, 'origem', p.origem, 'cancelado', p.cancelado,
           'so_separacao', p.so_separacao, 'cliente_nome', p.cliente_nome, 'vendedor_nome', p.vendedor_nome, 'data_pedido', p.data_pedido, 'data_previsao', p.data_previsao)), '[]'::jsonb)
    into v_ped from public.pcp_pedidos p where p.codigo_pedido = any (v_ids);

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', i.codigo_pedido, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade, 'quantidade', i.quantidade, 'obs_item', i.obs_item)), '[]'::jsonb)
    into v_itens from public.pcp_pedido_itens i where i.codigo_pedido = any (v_ids);

  -- estoque físico por código (Importação Varejo; senão a soma do PCP) — só dos itens desses pedidos
  select coalesce(jsonb_object_agg(c, q), '{}'::jsonb) into v_fis from (
    select cod c, coalesce(
             (select e.fisico from public.importacao_varejo_estoque e where upper(e.codigo) = cod limit 1),
             (select sum(p.quantidade) from public.pcp_estoque p where upper(p.codigo) = cod)) q
      from (select distinct upper(i.codigo) cod from public.pcp_pedido_itens i where i.codigo_pedido = any (v_ids) and position('#' in i.codigo) = 0) d
  ) z where q is not null;

  return jsonb_build_object('codigosQuadro', to_jsonb(v_cod), 'ops', v_ops, 'maePedido', v_mae, 'status', v_status, 'checklist', v_chk,
                            'itensQuadro', v_itq, 'pedidos', v_ped, 'itens', v_itens, 'fisico', v_fis);
end $$;
revoke all on function public._qc_dados_brutos() from public, anon, authenticated;

-- ---------- Público (token): leitura ----------
create or replace function public.qc_publico_dados(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_t public.qc_publico_links%rowtype; v_peg jsonb;
begin
  if coalesce(length(p_token), 0) < 32 then return null; end if;
  select * into v_t from public.qc_publico_links where token = p_token;
  if not found then return null; end if;
  if v_t.ultimo_acesso is null or v_t.ultimo_acesso < now() - interval '1 minute' then
    update public.qc_publico_links set ultimo_acesso = now() where tipo = v_t.tipo;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', s.codigo_pedido, 'codigo', s.codigo, 'peguei_por', s.peguei_por, 'peguei_em', s.peguei_em)), '[]'::jsonb)
    into v_peg from public.qc_separacao_itens s;
  return jsonb_build_object('tipo', v_t.tipo, 'dados', public._qc_dados_brutos(), 'pegos', v_peg);
end $$;
revoke all on function public.qc_publico_dados(text) from public;
grant execute on function public.qc_publico_dados(text) to anon, authenticated;

-- ---------- Público (token): "Peguei" pelo celular ----------
create or replace function public.qc_publico_peguei(p_token text, p_codigo_pedido bigint, p_codigo text, p_peguei boolean, p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t public.qc_publico_links%rowtype; v_cod text := upper(btrim(coalesce(p_codigo, ''))); v_nome text := btrim(coalesce(p_nome, ''));
  v_quem text; v_base text; v_idx int; v_n int;
begin
  if coalesce(length(p_token), 0) < 32 then raise exception 'link QC: link inválido'; end if;
  select * into v_t from public.qc_publico_links where token = p_token;
  if not found then raise exception 'link QC: link inválido ou trocado'; end if;
  if v_t.tipo not in ('separacao', 'separacao_fab') then raise exception 'link QC: este link é só de leitura'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 60 then raise exception 'link QC: informe seu nome (2 a 60 letras)'; end if;
  if p_codigo_pedido is null or v_cod = '' or p_peguei is null then raise exception 'link QC: informe pedido, item e se pegou'; end if;
  v_quem := 'link: ' || v_nome;

  if position('#' in v_cod) > 0 then
    if v_cod !~ '^[^#]+#[0-9]+$' then raise exception 'link QC: código de componente inválido'; end if;
    v_base := split_part(v_cod, '#', 1); v_idx := split_part(v_cod, '#', 2)::int;
    if not exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_base and i.obs_item is not null
                      and v_idx between 1 and array_length(string_to_array(i.obs_item, '|'), 1)) then
      raise exception 'link QC: o componente não existe no pedido';
    end if;
  elsif not exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_cod) then
    raise exception 'link QC: o item não pertence ao pedido';
  end if;

  if p_peguei then
    insert into public.qc_separacao_itens (codigo_pedido, codigo, peguei_por) values (p_codigo_pedido, v_cod, v_quem) on conflict (codigo_pedido, codigo) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'pegou', v_quem); end if;
  else
    delete from public.qc_separacao_itens where codigo_pedido = p_codigo_pedido and codigo = v_cod;
    get diagnostics v_n = row_count;
    if v_n > 0 then insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'devolveu', v_quem); end if;
  end if;
  return jsonb_build_object('ok', true, 'peguei', p_peguei, 'mudou', v_n > 0, 'por', v_quem);
end $$;
revoke all on function public.qc_publico_peguei(text, bigint, text, boolean, text) from public;
grant execute on function public.qc_publico_peguei(text, bigint, text, boolean, text) to anon, authenticated;
