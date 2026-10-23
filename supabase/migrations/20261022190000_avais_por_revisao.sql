-- Revisões comerciais — Etapa 2.2: avais por revisão (herdar ou reabrir).
-- Depende de 20261022100000_revisoes_comerciais_etapa1.sql.
-- Antes: o gatilho criava Aval Financeiro + Jurídico novos (pendentes) para QUALQUER proposta que virasse 'aprovada'.
-- Com revisão aprovada isso duplicava os avais da mesma cotação. Agora:
--   • proposta sem outra da família com aval  → comportamento de sempre;
--   • revisão aprovada → HERDA os avais da aprovada anterior quando o que cada um avalia não mudou, e
--     REABRE só o que mudou (conservador: na dúvida, reabre).
-- Financeiro avalia: valor_total, precificação, valores, condições de pagamento, ajustes (câmbio/impostos).
-- Jurídico avalia: partes (cliente), obra, ajustes, prazo, garantia, condições, responsabilidades, infraestrutura.
-- Mudança de PROJETO (especificações) não mexe nestes dois avais: é o Aval Engenharia (por cotação).
-- ADITIVA: só 2 colunas novas em cada tabela de aval + 1 função de hash + a função do gatilho.

alter table public.avais_financeiros
  add column if not exists herdado_de_proposta_id uuid references public.propostas(id) on delete set null,
  add column if not exists motivo_reabertura text;
alter table public.avais_juridicos
  add column if not exists herdado_de_proposta_id uuid references public.propostas(id) on delete set null,
  add column if not exists motivo_reabertura text;

create or replace function public.proposta_hash_grupo(p_dj jsonb, p_tipo text, p_grupo text) returns text
language sql immutable as $$
  select md5(case p_grupo
    when 'fin' then jsonb_build_object(
        'valores', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'valores'],
        'condicoesPagto', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'condicoesPagto'],
        'ajustes', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'ajustes'])::text
    when 'jur' then jsonb_build_object(
        'cliente', p_dj -> 'cliente', 'obra', p_dj -> 'obra',
        'ajustes', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'ajustes'],
        'prazo', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'prazo'],
        'garantia', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'garantia'],
        'condicoesPagto', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'condicoesPagto'],
        'responsabilidades', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'responsabilidades'],
        'infraestrutura', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'infraestrutura'],
        'infraestruturaNomeada', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'infraestruturaNomeada'])::text
    when 'proj' then jsonb_build_object(
        'especificacoes', p_dj #> array[public.proposta_tipo_norm(p_tipo), 'especificacoes'],
        'ativos', p_dj -> 'ativos')::text
    else '' end)
$$;

create or replace function public.fn_avais_abrir_na_proposta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cliente text; v_ref text; prev public.propostas; af public.avais_financeiros; aj public.avais_juridicos;
  v_new jsonb; v_prev jsonb; fin_igual boolean; jur_igual boolean; v_resumo text; v_tipo text;
begin
  if new.status is distinct from 'aprovada' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'aprovada' then return new; end if;
  v_cliente := coalesce(new.data_json->'cliente'->>'nome', new.titulo);
  v_ref := coalesce('Cotação Nº ' || new.numero_cotacao::text, 'Proposta ' || new.numero_documento, 'Proposta');

  -- Revisão? Outra proposta da MESMA família que já tem aval.
  prev := null;
  if new.numero_cotacao is not null then
    select p.* into prev from public.propostas p
     where p.numero_cotacao = new.numero_cotacao
       and public.proposta_tipo_norm(p.proposal_type) = public.proposta_tipo_norm(new.proposal_type)
       and p.id <> new.id
       and exists (select 1 from public.avais_financeiros a where a.proposta_id = p.id)
     order by (select max(a.criado_em) from public.avais_financeiros a where a.proposta_id = p.id) desc
     limit 1;
  end if;

  if prev.id is null then
    -- comportamento de sempre
    insert into avais_financeiros (numero_cotacao, proposta_id, numero_documento, cliente_nome, valor_total, status)
    values (new.numero_cotacao, new.id, new.numero_documento, v_cliente, new.valor_total, 'pendente_consulta')
    on conflict (proposta_id) where proposta_id is not null do nothing;
    insert into avais_juridicos (proposta_id, numero_cotacao, numero_documento, cliente_nome, status)
    values (new.id, new.numero_cotacao, new.numero_documento, v_cliente, 'pendente')
    on conflict (proposta_id) where proposta_id is not null do nothing;
    insert into alertas (id, level, title, sub, module, resolved)
    values ('avais-abertos-' || new.id::text, 'info', v_ref || ' — Avais Financeiro e Jurídico iniciados',
      coalesce(v_cliente, '—') || ' aprovou a proposta. Jurídico: dar o aval em "Aval Jurídico". Financeiro: Aval de Pagamento depois do sinal pago.',
      'Financeiro', false)
    on conflict (id) do nothing;
    return new;
  end if;

  -- Revisão aprovada: herda ou reabre, por aval
  v_new  := coalesce(new.versao_publicada, new.data_json);
  v_prev := coalesce(prev.versao_publicada, prev.data_json);
  fin_igual := (new.valor_total is not distinct from prev.valor_total)
           and (new.precificacao_id is not distinct from prev.precificacao_id)
           and public.proposta_hash_grupo(v_new, new.proposal_type, 'fin') = public.proposta_hash_grupo(v_prev, prev.proposal_type, 'fin');
  jur_igual := public.proposta_hash_grupo(v_new, new.proposal_type, 'jur') = public.proposta_hash_grupo(v_prev, prev.proposal_type, 'jur');

  select * into af from public.avais_financeiros where proposta_id = prev.id;
  select * into aj from public.avais_juridicos   where proposta_id = prev.id;

  insert into avais_financeiros (numero_cotacao, proposta_id, numero_documento, cliente_nome, valor_total, status, consulta, aval,
      sinal_pago, sinal, aval_pagamento, aval_pagamento_confirmado, aprovacao_ceo_em, aprovacao_ceo_por,
      aprovacao_owner_em, aprovacao_owner_por, custo_teto, margem_aceita, herdado_de_proposta_id, motivo_reabertura)
  values (new.numero_cotacao, new.id, new.numero_documento, v_cliente, new.valor_total,
      case when fin_igual then af.status else 'pendente_consulta' end,
      af.consulta,
      case when fin_igual then af.aval end,
      coalesce(af.sinal_pago, false), af.sinal,           -- o sinal pago é um FATO da cotação: acompanha a revisão
      case when fin_igual then af.aval_pagamento end,
      case when fin_igual then coalesce(af.aval_pagamento_confirmado, false) else false end,
      case when fin_igual then af.aprovacao_ceo_em end, case when fin_igual then af.aprovacao_ceo_por end,
      case when fin_igual then af.aprovacao_owner_em end, case when fin_igual then af.aprovacao_owner_por end,
      case when fin_igual then af.custo_teto end, case when fin_igual then af.margem_aceita end,
      prev.id,
      case when fin_igual then null else 'Valor, pagamento, impostos ou precificação mudaram na revisão ' || coalesce(new.numero_documento, '') end)
  on conflict (proposta_id) where proposta_id is not null do nothing;

  insert into avais_juridicos (proposta_id, numero_cotacao, numero_documento, cliente_nome, status, aval, herdado_de_proposta_id, motivo_reabertura)
  values (new.id, new.numero_cotacao, new.numero_documento, v_cliente,
      case when jur_igual and aj.id is not null then aj.status else 'pendente' end,
      case when jur_igual then aj.aval end,
      prev.id,
      case when jur_igual then null else 'Partes, obra, cláusulas, prazo ou condições mudaram na revisão ' || coalesce(new.numero_documento, '') end)
  on conflict (proposta_id) where proposta_id is not null do nothing;

  v_resumo := case
    when fin_igual and jur_igual then 'Avais Financeiro e Jurídico MANTIDOS (nada que eles avaliam mudou).'
    when fin_igual then 'Aval Jurídico REABERTO (cláusulas/partes/prazo mudaram). Financeiro mantido.'
    when jur_igual then 'Aval Financeiro REABERTO (valor/pagamento/impostos mudaram). Jurídico mantido.'
    else 'Avais Financeiro e Jurídico REABERTOS (valor e cláusulas mudaram).' end;
  insert into alertas (id, level, title, sub, module, resolved)
  values ('avais-abertos-' || new.id::text, case when fin_igual and jur_igual then 'info' else 'warning' end,
    v_ref || ' — revisão ' || coalesce(new.numero_documento, '') || ' aprovada pelo cliente',
    coalesce(v_cliente, '—') || ' aprovou a revisão. ' || v_resumo, 'Financeiro', false)
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.proposta_hash_grupo(jsonb, text, text) from public, anon;
notify pgrst, 'reload schema';
