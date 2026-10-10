-- Segurança real (#571) · F1 / Task 11g+11h — páginas públicas de OBRA falam por RPC, não por tabela (10/10/2026).
-- Páginas: /status-obra/:token (e /status-obra-interno/:token), /vistoria/:token, /diario-obra/:token, /termo-entrega/:token.
-- ADITIVA: só cria funções. O caminho antigo (leitura/gravação direta pelo navegador) continua funcionando até as tabelas
-- serem fechadas; o navegador tenta a RPC primeiro e cai no caminho antigo se ela falhar ou ainda não existir.
-- Regras (mesmo molde de 20261004200000_public_proposta_rpc.sql):
--   * cada RPC recebe o TOKEN do link (mínimo 8 caracteres) e só toca o registro daquele token;
--   * devolve só os campos que a página usa — nunca valores em R$ (dossier_obra, contratos, vistorias_obras, propostas
--     ficam fora do alcance direto do papel anônimo);
--   * IP de assinatura vem do servidor (cabeçalho), o do navegador é só fallback.

-- ---------- auxiliares (nunca chamáveis de fora) ----------
create or replace function public._po_ip(p_fallback text) returns text language plpgsql stable as $$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  return left(coalesce(nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''), nullif(p_fallback, '')), 100);
end $$;

-- dossier pelo token do status da obra: modo 'interno' usa link_interno_token, qualquer outro valor usa link_publico_token
create or replace function public._po_dossier_status(p_token text, p_modo text) returns text language sql stable as $$
  select d.id from dossier_obra d
   where coalesce(length(p_token), 0) >= 8
     and case when p_modo = 'interno' then d.link_interno_token = p_token else d.link_publico_token = p_token end
   limit 1
$$;

-- Termo de entrega sem a imagem da assinatura, IP, hash e device (o que a página precisa: modo, status, quem já assinou)
create or replace function public._po_termo_resumo(t jsonb) returns jsonb language sql immutable as $$
  select case when t is null then null else
    (t - 'assinaturas' - 'gerado_por')
    || jsonb_build_object('assinaturas', coalesce((
         select jsonb_object_agg(k, jsonb_build_object('nome', v->>'nome', 'assinado_em', v->>'assinado_em'))
           from jsonb_each(case when jsonb_typeof(t->'assinaturas') = 'object' then t->'assinaturas' else '{}'::jsonb end) as a(k, v)
       ), '{}'::jsonb))
  end
$$;

revoke execute on function public._po_ip(text), public._po_dossier_status(text, text), public._po_termo_resumo(jsonb)
  from public, anon, authenticated;

-- =====================================================================
-- STATUS DA OBRA (/status-obra/:token e /status-obra-interno/:token)
-- =====================================================================
-- Cabeçalho (id, cliente, prédio) + itens do cronograma. Antes: select * em dossier_obra.
create or replace function public.public_status_obra_obter(p_token text, p_modo text default 'cliente') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; d dossier_obra%rowtype;
begin
  v_id := public._po_dossier_status(p_token, p_modo);
  if v_id is null then return null; end if;
  select * into d from dossier_obra where id = v_id;
  return jsonb_build_object(
    'dossier', jsonb_build_object('id', d.id, 'client_name', d.client_name, 'building_name', d.building_name),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'semana', i.semana, 'ordem', i.ordem, 'etapa', i.etapa,
               'servicos', i.servicos, 'resultado_esperado', i.resultado_esperado, 'status', i.status,
               'concluido_em', i.concluido_em, 'marco', i.marco) order by i.semana, i.ordem)
        from instalacao_checklist_itens i where i.dossier_id = d.id), '[]'::jsonb));
end $$;

-- Sessão Administrativa montada no servidor (mesmos itens de InstalacaoChecklistStore.obterSessaoAdministrativa).
-- O item "Vendedor" do caminho antigo lia propostas.lead_id, coluna que não existe — nunca aparecia; não é reproduzido
-- aqui para não ampliar o que a página expõe.
create or replace function public.public_status_obra_sessao(p_token text, p_modo text default 'cliente') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; d dossier_obra%rowtype; itens jsonb := '[]'::jsonb; n int; c_status text; c_sent timestamptz; c_qtd int;
        v record; doc record; tp text;
begin
  v_id := public._po_dossier_status(p_token, p_modo);
  if v_id is null then return null; end if;
  select * into d from dossier_obra where id = v_id;

  -- Envio de Contrato (só status e data de envio; o caminho antigo usava maybeSingle → mais de 1 contrato = item some)
  if d.proposta_id is not null then
    select count(*), max(status), max(sent_at) into c_qtd, c_status, c_sent
      from contratos_venda_equipamentos
     where proposta_id = d.proposta_id and (status is null or status <> 'em_preenchimento');
    if c_qtd = 1 then
      itens := itens || jsonb_build_array(jsonb_build_object('chave', 'contrato', 'titulo', 'Envio de Contrato',
        'concluido', coalesce(c_status in ('enviado', 'visualizado', 'assinado'), false), 'pessoa', null,
        'data', case when c_status in ('enviado', 'visualizado', 'assinado') then c_sent else null end));
    end if;
  end if;

  -- 3 vistorias inclusas (só fase, vistoriador, status, data — nada de custo)
  for n in 1..3 loop
    select vo.vistoriador, vo.atualizado_em into v from vistorias_obras vo
     where vo.obra_id = d.id and vo.numero_fase = n and vo.status = 'concluida'
     order by vo.atualizado_em desc nulls last limit 1;
    itens := itens || jsonb_build_array(jsonb_build_object('chave', 'vistoria_' || n, 'titulo', 'Vistoria Nº ' || n,
      'concluido', found, 'pessoa', case when found then v.vistoriador end, 'data', case when found then v.atualizado_em end));
  end loop;

  itens := itens || jsonb_build_array(jsonb_build_object('chave', 'doc_instalador', 'titulo', 'Envio da Documentação do Instalador',
    'concluido', d.doc_instalador_enviado_em is not null, 'pessoa', d.doc_instalador_enviado_por, 'data', d.doc_instalador_enviado_em));

  foreach tp in array array['ART', 'Termo de Entrega', 'DataBook'] loop
    select dd.responsavel, dd.data_criacao into doc from dossier_documentos dd
     where dd.dossier_id = d.id and dd.tipo = tp order by dd.data_criacao desc nulls last limit 1;
    itens := itens || jsonb_build_array(jsonb_build_object('chave', 'doc_vp_' || tp, 'titulo', 'Envio — ' || tp,
      'concluido', found, 'pessoa', case when found then doc.responsavel end, 'data', case when found then doc.data_criacao end));
  end loop;

  return itens;
end $$;

-- =====================================================================
-- VISTORIA EM CAMPO (/vistoria/:token)
-- =====================================================================
-- Atividade + obra (cliente/prédio) + nº de série + questionário. Antes: select com join embutido em dossier_obra.
create or replace function public.public_vistoria_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a vistorias_atividades%rowtype; obra jsonb; eq jsonb; q jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into a from vistorias_atividades where token = p_token;
  if not found then return null; end if;
  select jsonb_build_object('client_name', d.client_name, 'building_name', d.building_name) into obra
    from dossier_obra d where d.id = a.dossier_id;
  select jsonb_build_object('numero_serie', e.numero_serie) into eq from equipamentos_obra e where e.id = a.equipamento_id;
  select jsonb_build_object('id', vq.id, 'nome', vq.nome, 'tipo', vq.tipo) into q from vistorias_questionarios vq where vq.id = a.questionario_id;
  return to_jsonb(a) || jsonb_build_object('dossier_obra', obra, 'equipamentos_obra', eq, 'vistorias_questionarios', q);
end $$;

-- =====================================================================
-- DIÁRIO DE OBRA (/diario-obra/:token — token em acompanhamento_obra_links)
-- =====================================================================
create or replace function public.public_diario_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l acompanhamento_obra_links%rowtype; d dossier_obra%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into l from acompanhamento_obra_links where token = p_token;
  if not found then return null; end if;
  select * into d from dossier_obra where id = l.dossier_id;
  return jsonb_build_object(
    'link', jsonb_build_object('dossier_id', l.dossier_id),
    'dossier', case when d.id is null then null else
      jsonb_build_object('id', d.id, 'client_name', d.client_name, 'building_name', d.building_name) end,
    'status', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'dossier_id', s.dossier_id, 'item_id', s.item_id, 'flegado', s.flegado,
               'flegado_em', s.flegado_em, 'fotos', s.fotos, 'observacao', s.observacao,
               'acompanhamento_obra_itens', case when it.id is null then null else
                 jsonb_build_object('id', it.id, 'texto', it.texto, 'ordem', it.ordem, 'peso', it.peso) end))
        from acompanhamento_obra_status s left join acompanhamento_obra_itens it on it.id = s.item_id
       where s.dossier_id = l.dossier_id), '[]'::jsonb),
    'lancamentos', '[]'::jsonb,
    'equipamentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'numero_serie', e.numero_serie, 'tipo', e.tipo))
        from equipamentos_obra e where e.dossier_id = l.dossier_id), '[]'::jsonb));
end $$;

-- =====================================================================
-- TERMO DE ENTREGA (/termo-entrega/:token — dossier_obra.termo_entrega_token)
-- =====================================================================
create or replace function public.public_termo_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d dossier_obra%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into d from dossier_obra where termo_entrega_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object('client_name', d.client_name, 'building_name', d.building_name, 'city', d.city, 'state', d.state,
                            'termo_entrega', public._po_termo_resumo(d.termo_entrega));
end $$;

-- Registra 1 assinatura (cliente OU supervisor). A decisão de "completo" é do servidor. Quando completa, devolve o termo
-- inteiro (com as imagens das assinaturas) só para o navegador gerar o PDF; senão devolve o resumo.
create or replace function public.public_termo_assinar(p_token text, p_papel text, p_nome text, p_assinatura_png text,
                                                       p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d dossier_obra%rowtype; t jsonb; n text; completo boolean; exigidos text[];
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if p_papel not in ('cliente', 'supervisor') then return jsonb_build_object('ok', false, 'erro', 'papel_invalido'); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  if n is null then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  if coalesce(p_assinatura_png, '') not like 'data:image/%' or length(p_assinatura_png) > 600000 then
    return jsonb_build_object('ok', false, 'erro', 'assinatura_obrigatoria');
  end if;

  select * into d from dossier_obra where termo_entrega_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;

  t := coalesce(d.termo_entrega, jsonb_build_object('modo', 'self_service', 'status', 'pendente', 'assinaturas', '{}'::jsonb));
  if jsonb_typeof(t->'assinaturas') is distinct from 'object' then t := jsonb_set(t, '{assinaturas}', '{}'::jsonb); end if;
  if t->>'status' = 'concluido' then
    return jsonb_build_object('ok', true, 'completo', false, 'ja_concluido', true, 'termo', public._po_termo_resumo(t));
  end if;
  if t->'assinaturas' ? p_papel then return jsonb_build_object('ok', false, 'erro', 'ja_assinado'); end if;

  t := jsonb_set(t, array['assinaturas', p_papel], jsonb_build_object(
         'nome', n, 'assinatura_png', p_assinatura_png,
         'hash', left(coalesce(p_audit->>'hash', ''), 200), 'ip', public._po_ip(p_audit->>'ip'),
         'device', left(coalesce(p_audit->>'device', ''), 200), 'assinado_em', now()));

  exigidos := case when t->>'modo' = 'presencial' then array['cliente', 'supervisor'] else array['cliente'] end;
  completo := (t->'assinaturas') ?& exigidos;
  if completo then
    t := t || jsonb_build_object('status', 'concluido', 'concluido_em', now());
  end if;

  update dossier_obra set termo_entrega = t where id = d.id;
  return jsonb_build_object('ok', true, 'completo', completo,
    'termo', case when completo then t - 'gerado_por' else public._po_termo_resumo(t) end,
    'dossier', case when completo then jsonb_build_object('id', d.id, 'client_name', d.client_name, 'building_name', d.building_name) end);
end $$;

-- Depois do PDF gerado no navegador e anexado em dossier_documentos: grava o id do documento (ou o erro) no termo.
-- Só aceita termo já concluído, sem documento ainda, e um documento do tipo Termo de Entrega daquele mesmo dossiê.
create or replace function public.public_termo_registrar_pdf(p_token text, p_documento_id text, p_pdf_erro text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d dossier_obra%rowtype; t jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into d from dossier_obra where termo_entrega_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  t := d.termo_entrega;
  if t is null or t->>'status' <> 'concluido' then return jsonb_build_object('ok', false, 'erro', 'nao_concluido'); end if;
  if coalesce(t->>'documento_id', '') <> '' then return jsonb_build_object('ok', false, 'erro', 'ja_registrado'); end if;
  if nullif(p_documento_id, '') is not null then
    if not exists (select 1 from dossier_documentos dd where dd.id = p_documento_id and dd.dossier_id = d.id and dd.tipo = 'Termo de Entrega') then
      return jsonb_build_object('ok', false, 'erro', 'documento_invalido');
    end if;
    t := (t - 'pdf_erro') || jsonb_build_object('documento_id', p_documento_id);
  else
    t := t || jsonb_build_object('pdf_erro', left(coalesce(p_pdf_erro, 'erro ao gerar PDF'), 500));
  end if;
  update dossier_obra set termo_entrega = t where id = d.id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.public_status_obra_obter(text, text), public.public_status_obra_sessao(text, text),
  public.public_vistoria_obter(text), public.public_diario_obter(text), public.public_termo_obter(text),
  public.public_termo_assinar(text, text, text, text, jsonb), public.public_termo_registrar_pdf(text, text, text) from public;
grant execute on function public.public_status_obra_obter(text, text), public.public_status_obra_sessao(text, text),
  public.public_vistoria_obter(text), public.public_diario_obter(text), public.public_termo_obter(text),
  public.public_termo_assinar(text, text, text, text, jsonb), public.public_termo_registrar_pdf(text, text, text)
  to anon, authenticated;
