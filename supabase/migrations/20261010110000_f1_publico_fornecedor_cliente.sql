-- Segurança real (#571) · F1 — páginas públicas do FORNECEDOR falam por RPC, não por tabela (10/10/2026).
-- Molde: 20261004200000_public_proposta_rpc.sql. ADITIVA: só cria funções; nenhuma tabela é fechada aqui e o caminho
-- antigo (update direto pelo navegador) continua funcionando até a fase que fecha as tabelas.
--
--   cotacao-elevador-fornecedor.html  -> public_cef_obter / public_cef_visualizado / public_cef_responder
--                                        (tabela cotacoes_elevador_fornecedor)
--   cotacao.html                      -> public_pfo_obter / public_pfo_visualizado / public_pfo_responder
--                                        (tabela pedidos_fornecedor)
--
-- Regras comuns: cada RPC recebe o TOKEN do link (mínimo 8 caracteres) e só toca aquele registro; devolve só as colunas
-- que a página usa (nada de destinatários/envios/câmbio/motivo de exclusão; o `_meta` da resposta — IP e, quando a
-- resposta foi registrada pelo Inbox, quem registrou — nunca sai); a transição de status é decidida no servidor; a
-- resposta do fornecedor passa por uma lista de campos permitidos (campo desconhecido é descartado) e o IP/hora vêm do
-- servidor. Logs (vp_logs), eventos (eventos_fluxo) e alertas continuam sendo gravados pela página, como antes.
--
-- formulario-cliente.html NÃO entra aqui: em tempo de execução ela só toca formularios_elevador(+_unidades, +_anexos),
-- clientes, elevador_modelos/elevador_modelo_opcoes, eventos_fluxo/gatilhos e vp_logs — nenhuma tabela com R$.

-- ---------- auxiliares (nunca chamáveis de fora) ----------
create or replace function public._f1pf_ip(p_fallback text) returns text language plpgsql stable as $$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  return left(coalesce(nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''), nullif(trim(coalesce(p_fallback, '')), '')), 100);
end $$;

-- valor simples (texto/número/booleano); texto cortado em p_max; objeto/lista/nulo -> null (campo descartado)
create or replace function public._f1pf_escalar(v jsonb, p_max int) returns jsonb language sql immutable as $$
  select case
    when v is null then null
    when jsonb_typeof(v) in ('number', 'boolean') then v
    when jsonb_typeof(v) = 'string' then to_jsonb(left(v #>> '{}', p_max))
    else null end
$$;

-- objeto só com as chaves permitidas e valores simples
create or replace function public._f1pf_filtrar(p jsonb, p_chaves text[], p_max int) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, public._f1pf_escalar(p->k, p_max)), '{}'::jsonb)
    from unnest(p_chaves) as k
   where jsonb_typeof(p) = 'object' and p ? k and public._f1pf_escalar(p->k, p_max) is not null
$$;

-- resposta sem `_meta` (IP / quem registrou ficam só no banco)
create or replace function public._f1pf_sem_meta(p jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(p) = 'object' then p - '_meta' else p end
$$;

-- ---- Cotação técnica de elevador (cotacoes_elevador_fornecedor) ----
create or replace function public._f1pf_cef_publico(r public.cotacoes_elevador_fornecedor) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', r.id, 'numero_documento', r.numero_documento, 'formulario_elevador_id', r.formulario_elevador_id,
    'fornecedor', r.fornecedor, 'tipo_formulario', r.tipo_formulario, 'categoria_produto', r.categoria_produto,
    'status', r.status, 'dados_envio', r.dados_envio, 'respostas', public._f1pf_sem_meta(r.respostas),
    'sent_at', r.sent_at, 'viewed_at', r.viewed_at, 'responded_at', r.responded_at, 'updated_at', r.updated_at)
$$;

-- resposta do fornecedor: só os campos do formulário do link; itens só das unidades enviadas nesta cotação
create or replace function public._f1pf_cef_respostas(p jsonb, p_dados_envio jsonb) returns jsonb language plpgsql immutable as $$
declare base jsonb; itens jsonb := '[]'::jsonb; it jsonb; novo jsonb; uids text[]; div jsonb;
begin
  if jsonb_typeof(p) <> 'object' then return null; end if;
  base := public._f1pf_filtrar(p, array['moeda','incoterm_porto','condicoes_pagamento','prazo_fabricacao','garantia',
            'validade_dias','embalagem','container_no','documentos_embarque','frete_internacional_usd','taxas_extras_usd',
            'observacoes_gerais'], 4000);
  select coalesce(array_agg(u->>'unidade_id'), '{}') into uids
    from jsonb_array_elements(case when jsonb_typeof(p_dados_envio->'unidades') = 'array' then p_dados_envio->'unidades' else '[]'::jsonb end) u;
  if jsonb_typeof(p->'itens') = 'array' then
    for it in select value from jsonb_array_elements(p->'itens') limit 200 loop
      if jsonb_typeof(it) <> 'object' or not ((it->>'unidade_id') = any(uids)) then continue; end if;
      novo := public._f1pf_filtrar(it, array['unidade_id','unidade_identificador','modelo_fornecedor','floors_stops_doors',
                'preco_unitario','preco_total','confirmacao_tecnica','confirmacao_tecnica_pt'], 20000);
      if jsonb_typeof(it->'divergencias') = 'object' then
        select coalesce(jsonb_object_agg(left(d.key, 100), public._f1pf_escalar(d.value, 4000)), '{}'::jsonb) into div
          from (select key, value from jsonb_each(it->'divergencias') limit 300) d
         where public._f1pf_escalar(d.value, 4000) is not null;
        novo := novo || jsonb_build_object('divergencias', div);
      end if;
      itens := itens || jsonb_build_array(novo);
    end loop;
  end if;
  return base || jsonb_build_object('itens', itens);
end $$;

-- ---- Pedido a fornecedor / RFQ de peças (pedidos_fornecedor) ----
create or replace function public._f1pf_pfo_publico(r public.pedidos_fornecedor) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', r.id, 'numero_documento', r.numero_documento, 'modo', r.modo, 'idioma', r.idioma,
    'fornecedor', r.fornecedor, 'itens', r.itens, 'intro_pt', r.intro_pt, 'intro_en', r.intro_en,
    'observacoes_pt', r.observacoes_pt, 'observacoes_en', r.observacoes_en, 'status', r.status,
    'resposta', public._f1pf_sem_meta(r.resposta), 'expires_at', r.expires_at,
    'sent_at', r.sent_at, 'viewed_at', r.viewed_at, 'responded_at', r.responded_at, 'updated_at', r.updated_at)
$$;

create or replace function public._f1pf_pfo_resposta(p jsonb, p_itens jsonb) returns jsonb language plpgsql immutable as $$
declare base jsonb; itens jsonb := '[]'::jsonb; it jsonb; pids text[];
begin
  if jsonb_typeof(p) <> 'object' then return null; end if;
  base := public._f1pf_filtrar(p, array['moeda','validade','incoterm','porto','obs_geral'], 4000);
  select coalesce(array_agg(i->>'produto_id'), '{}') into pids
    from jsonb_array_elements(case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end) i;
  if jsonb_typeof(p->'itens') = 'array' then
    for it in select value from jsonb_array_elements(p->'itens') limit 500 loop
      if jsonb_typeof(it) <> 'object' or not ((it->>'produto_id') = any(pids)) then continue; end if;
      itens := itens || jsonb_build_array(public._f1pf_filtrar(it, array['produto_id','sku','preco_unit','moq','lead_time','obs'], 4000));
    end loop;
  end if;
  return base || jsonb_build_object('itens', itens);
end $$;

revoke execute on function public._f1pf_ip(text), public._f1pf_escalar(jsonb, int), public._f1pf_filtrar(jsonb, text[], int),
  public._f1pf_sem_meta(jsonb), public._f1pf_cef_publico(public.cotacoes_elevador_fornecedor),
  public._f1pf_cef_respostas(jsonb, jsonb), public._f1pf_pfo_publico(public.pedidos_fornecedor),
  public._f1pf_pfo_resposta(jsonb, jsonb)
  from public, anon, authenticated;

-- ---------- RPCs públicas: cotação técnica de elevador ----------
-- Rascunho e cotação excluída = link inválido (antes a página já tratava rascunho assim).
create or replace function public.public_cef_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r cotacoes_elevador_fornecedor%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into r from cotacoes_elevador_fornecedor where token = p_token;
  if not found or r.status = 'rascunho' or r.excluido_em is not null then return null; end if;
  return public._f1pf_cef_publico(r);
end $$;

create or replace function public.public_cef_visualizado(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r cotacoes_elevador_fornecedor%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from cotacoes_elevador_fornecedor where token = p_token for update;
  if not found or r.status = 'rascunho' or r.excluido_em is not null then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status <> 'enviado' then return jsonb_build_object('ok', true, 'rec', public._f1pf_cef_publico(r), 'mudou', false); end if;
  update cotacoes_elevador_fornecedor set status = 'visualizado', viewed_at = now(), updated_at = now()
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'rec', public._f1pf_cef_publico(r), 'mudou', true);
end $$;

-- p_meta = { ip (reserva, se o cabeçalho não vier), ua }. p_cambio = USD/BRL do momento (fora de 0..100 é ignorado).
-- Só responde quem está aguardando (enviado/visualizado): depois de respondida, a página fica só leitura; em análise/
-- aprovada, a resposta não pode mais ser trocada pelo link (antes uma chamada direta conseguia).
create or replace function public.public_cef_responder(p_token text, p_respostas jsonb, p_meta jsonb default '{}'::jsonb, p_cambio numeric default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r cotacoes_elevador_fornecedor%rowtype; resp jsonb; ip text; antes jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from cotacoes_elevador_fornecedor where token = p_token for update;
  if not found or r.status = 'rascunho' or r.excluido_em is not null then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status not in ('enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  resp := public._f1pf_cef_respostas(p_respostas, r.dados_envio);
  if resp is null then return jsonb_build_object('ok', false, 'erro', 'resposta_invalida'); end if;
  ip := public._f1pf_ip(p_meta->>'ip');
  resp := resp || jsonb_build_object('_meta', jsonb_build_object('ip', ip, 'ua', left(coalesce(p_meta->>'ua', ''), 500), 'respondido_em', now()));
  antes := public._f1pf_sem_meta(r.respostas);
  update cotacoes_elevador_fornecedor set status = 'respondido', respostas = resp, responded_at = now(), updated_at = now(),
         cambio_na_resposta_usd_brl = case when p_cambio > 0 and p_cambio < 100 then p_cambio else null end
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'rec', public._f1pf_cef_publico(r), 'antes', antes, 'ip', ip);
end $$;

-- ---------- RPCs públicas: pedido a fornecedor (RFQ de peças) ----------
create or replace function public.public_pfo_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r pedidos_fornecedor%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into r from pedidos_fornecedor where token = p_token;
  if not found then return null; end if;
  return public._f1pf_pfo_publico(r);
end $$;

-- rascunho/enviado -> visualizado (nunca regride), como a página já fazia
create or replace function public.public_pfo_visualizado(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r pedidos_fornecedor%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from pedidos_fornecedor where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status not in ('enviado', 'rascunho') then return jsonb_build_object('ok', true, 'rec', public._f1pf_pfo_publico(r), 'mudou', false); end if;
  update pedidos_fornecedor set status = 'visualizado', viewed_at = now(), updated_at = now()
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'rec', public._f1pf_pfo_publico(r), 'mudou', true);
end $$;

create or replace function public.public_pfo_responder(p_token text, p_resposta jsonb, p_meta jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r pedidos_fornecedor%rowtype; resp jsonb; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from pedidos_fornecedor where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.expires_at is not null and r.expires_at < now() then return jsonb_build_object('ok', false, 'erro', 'expirado'); end if;
  if r.status not in ('rascunho', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  resp := public._f1pf_pfo_resposta(p_resposta, r.itens);
  if resp is null then return jsonb_build_object('ok', false, 'erro', 'resposta_invalida'); end if;
  ip := public._f1pf_ip(p_meta->>'ip');
  resp := resp || jsonb_build_object('_meta', jsonb_build_object('ip', ip, 'ua', left(coalesce(p_meta->>'ua', ''), 500), 'respondido_em', now()));
  update pedidos_fornecedor set status = 'respondido', resposta = resp, responded_at = now(), updated_at = now()
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'rec', public._f1pf_pfo_publico(r), 'ip', ip);
end $$;

revoke execute on function public.public_cef_obter(text), public.public_cef_visualizado(text),
  public.public_cef_responder(text, jsonb, jsonb, numeric),
  public.public_pfo_obter(text), public.public_pfo_visualizado(text), public.public_pfo_responder(text, jsonb, jsonb)
  from public;
grant execute on function public.public_cef_obter(text), public.public_cef_visualizado(text),
  public.public_cef_responder(text, jsonb, jsonb, numeric),
  public.public_pfo_obter(text), public.public_pfo_visualizado(text), public.public_pfo_responder(text, jsonb, jsonb)
  to anon, authenticated;
