-- ============================================================
-- T6 #1226 (31/10/2026, decisão do Gelson: coluna nova) — P.I. e Embarque
-- passam a guardar o vínculo com o cadastro de Fornecedores, ao lado do nome
-- (que continua gravado como estava naquele dia).
--   pi_importacao.fornecedor_id, embarques_importacao.agente_carga_id e
--   embarques_importacao.empresa_desembaraco_id → fornecedores(id), ON DELETE RESTRICT.
-- Colunas novas nascem vazias; registros antigos não são alterados.
-- cadastro_vinculos passa a contar também pelo vínculo (antes só pelo nome).
-- ============================================================
alter table public.pi_importacao add column if not exists fornecedor_id uuid
  references public.fornecedores(id) on delete restrict;
alter table public.embarques_importacao add column if not exists agente_carga_id uuid
  references public.fornecedores(id) on delete restrict;
alter table public.embarques_importacao add column if not exists empresa_desembaraco_id uuid
  references public.fornecedores(id) on delete restrict;

create index if not exists pi_importacao_fornecedor_id_idx on public.pi_importacao (fornecedor_id) where fornecedor_id is not null;
create index if not exists embarques_imp_agente_carga_id_idx on public.embarques_importacao (agente_carga_id) where agente_carga_id is not null;
create index if not exists embarques_imp_desembaraco_id_idx on public.embarques_importacao (empresa_desembaraco_id) where empresa_desembaraco_id is not null;

create or replace function public.cadastro_vinculos(p_tipo text, p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r      jsonb := '[]'::jsonb;
  n      bigint;
  v_nome text; v_fant text; v_emails text[]; v_omie text;
begin
  if p_tipo = 'cliente' then
    select razao_social, nome_fantasia, _cad_emails(email), codigo_cliente_omie::text
      into v_nome, v_fant, v_emails, v_omie
      from clientes where id = p_id;
    if not found then return r; end if;

    select count(*) into n from leads where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Leads', 'qtd', n); end if;
    select count(*) into n from formularios_elevador where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Formulários/cotações', 'qtd', n); end if;
    select count(*) into n from dossier_obra where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Dossiês de obra', 'qtd', n); end if;
    select count(*) into n from contratos_sociais where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Contratos sociais', 'qtd', n); end if;
    select count(*) into n from propostas where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Propostas', 'qtd', n); end if;
    select count(*) into n from quadros_comando where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos de Quadro de Comando', 'qtd', n); end if;
    select count(*) into n from projetos_elevador_desenhos where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Desenhos do Projeto de Elevadores', 'qtd', n); end if;
    if v_omie is not null then
      r := r || jsonb_build_object('fonte', 'Cadastrado no ERP Omie', 'qtd', 1);
      select count(*) into n from pcp_pedidos where codigo_cliente::text = v_omie;
      if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos de venda do Omie', 'qtd', n); end if;
    end if;

  elsif p_tipo = 'fornecedor' then
    select razao_social, nome_fantasia, _cad_emails(email)
      into v_nome, v_fant, v_emails
      from fornecedores where id = p_id;
    if not found then return r; end if;

    select count(*) into n from iv_cotacao_convites where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de Varejo (convites)', 'qtd', n); end if;
    select count(*) into n from embarques_importacao e
      where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(e.cotacoes_frete) = 'array' then e.cotacoes_frete else '[]'::jsonb end) x
                    where x->>'fornecedor_id' = p_id::text);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de frete (embarques)', 'qtd', n); end if;
    select count(*) into n from fornecedores_avaliacoes where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Avaliações', 'qtd', n); end if;
    select count(*) into n from fornecedor_avaliacoes where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Avaliações NPS das cotações', 'qtd', n); end if;

    -- P.I. e Embarque: pelo vínculo do cadastro (T6) OU pelo nome (registros antigos)
    select count(*) into n from pi_importacao
      where fornecedor_id = p_id or _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'P.I.', 'qtd', n); end if;
    select count(*) into n from embarques_importacao
      where agente_carga_id = p_id or empresa_desembaraco_id = p_id
         or _cad_nome_casa(agente_carga, v_nome) or _cad_nome_casa(agente_carga, v_fant)
         or _cad_nome_casa(empresa_desembaraco, v_nome) or _cad_nome_casa(empresa_desembaraco, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Embarques (agente/desembaraço)', 'qtd', n); end if;
    select count(*) into n from cotacoes_elevador_fornecedor
      where _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de elevador (pelo nome)', 'qtd', n); end if;
    select count(*) into n from formularios_elevador_unidades
      where _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Unidades do Formulário (pelo nome)', 'qtd', n); end if;
    select count(*) into n from pcp_expedicoes
      where _cad_nome_casa(transportadora, v_nome) or _cad_nome_casa(transportadora, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Expedições (transportadora, pelo nome)', 'qtd', n); end if;
    select count(*) into n from ims_importacao
      where fornecedores::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedores::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'IMS', 'qtd', n); end if;
    select count(*) into n from rfq_importacao
      where fornecedores::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedores::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'RFQ de importação', 'qtd', n); end if;
    select count(*) into n from pedidos_fornecedor
      where fornecedor::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedor::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos a fornecedor', 'qtd', n); end if;
  else
    raise exception 'cadastro_vinculos: tipo inválido (%)', p_tipo;
  end if;

  -- Troca de e-mails (cliente e fornecedor): o e-mail do cadastro aparece como
  -- remetente, destinatário ou cópia em emails_projeto (mesmo e-mail excluído conta).
  if coalesce(array_length(v_emails, 1), 0) > 0 then
    select count(*) into n from emails_projeto ep
      where _cad_norm(ep.de_email) = any(v_emails)
         or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(ep.para) = 'array' then ep.para else '[]'::jsonb end) x where _cad_norm(x) = any(v_emails))
         or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(ep.cc) = 'array' then ep.cc else '[]'::jsonb end) x where _cad_norm(x) = any(v_emails));
    if n > 0 then r := r || jsonb_build_object('fonte', 'E-mails trocados (Inbox)', 'qtd', n); end if;
  end if;

  return r;
end;
$$;

revoke all on function public.cadastro_vinculos(text, uuid) from public;
grant execute on function public.cadastro_vinculos(text, uuid) to anon, authenticated;
