-- Aviso "Avais OK" passa a considerar o Aval Engenharia e as duas portas do CEO (11/10/2026, auditoria de amarrações)
-- Antes: fn_avais_notificar_ok olhava só Aval de Pagamento + Aval Jurídico e gravava "a compra na China está liberada",
-- mas desde 08/10 a compra exige também o Projeto de Instalação assinado pelo cliente (Aval Engenharia), e a aprovação do
-- CEO pode vir da Central de Decisões (decisão compra_equipamento_ceo), não só de avais_financeiros.aprovacao_ceo_em.
-- Agora:
--   * 'avais-ok-<proposta>' (1x, como antes) diz o que já está OK e o que ainda falta, sem prometer liberação falsa;
--   * 'compra-liberada-<proposta>' (1x) sai quando TUDO fecha: Pagamento + Jurídico + todos os Projetos de Instalação
--     assinados + CEO (só se margem < 15% ou desconhecida). O aviso anterior é resolvido nessa hora.
--   * Novos gatilhos chamam a mesma função quando o CEO aprova (aprovacao_ceo_em — a Central também grava lá desde
--     11/10) e quando o cliente assina um Projeto de Instalação. Falha ao avisar nunca impede a assinatura.

create or replace function public.fn_avais_notificar_ok(p_proposta_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare af record; aj record; v_margem numeric; v_ref text; v_cli text; v_falta text[] := '{}';
        v_proj_total int := 0; v_proj_ass int := 0; v_precisa_ceo boolean; v_ceo_ok boolean;
begin
  if p_proposta_id is null then return; end if;
  select * into af from avais_financeiros where proposta_id = p_proposta_id;
  select * into aj from avais_juridicos where proposta_id = p_proposta_id;
  if af.id is null or aj.id is null then return; end if;
  if not coalesce(af.aval_pagamento_confirmado, false) or aj.status <> 'aprovado' then return; end if;

  if af.numero_cotacao is not null then
    select coalesce((pz.resultado_v2->'precificacao'->>'margemEfetivaPct')::numeric, (pz.resultado->>'margemFinalPct')::numeric)
      into v_margem from precificacoes_elevador pz where pz.numero_cotacao = af.numero_cotacao
     order by (pz.status = 'finalizado') desc, pz.updated_at desc limit 1;
    select count(*), count(*) filter (where exists (
             select 1 from documento_signatarios s
              where s.documento_tipo = 'projeto_instalacao' and s.documento_id = d.id::text and s.status = 'assinado'))
      into v_proj_total, v_proj_ass
      from projetos_elevador_desenhos d
     where d.numero_cotacao = af.numero_cotacao and d.tipo_documento = 'projeto_instalacao' and d.excluido_em is null;
  end if;

  v_precisa_ceo := v_margem is null or v_margem < 0.15;
  v_ceo_ok := af.aprovacao_ceo_em is not null or exists (
    select 1 from decisoes_gerenciais g
     where g.tipo = 'compra_equipamento_ceo' and g.numero_cotacao = af.numero_cotacao and g.status = 'aprovada');

  if v_proj_total = 0 then v_falta := v_falta || 'o Projeto de Instalação (ainda não salvo em "Projeto de Elevadores")'::text;
  elsif v_proj_ass < v_proj_total then v_falta := v_falta || ('a assinatura do Projeto de Instalação pelo cliente (' || v_proj_ass || ' de ' || v_proj_total || ')')::text;
  end if;
  if v_precisa_ceo and not v_ceo_ok then
    v_falta := v_falta || ('a aprovação do CEO (margem ' || coalesce(round(v_margem * 100, 1)::text || '%', 'desconhecida') || ')')::text;
  end if;

  v_ref := coalesce('Cotação Nº ' || af.numero_cotacao::text, 'Proposta ' || af.numero_documento, 'Proposta');
  v_cli := coalesce(af.cliente_nome, '—');

  insert into alertas (id, level, title, sub, module, resolved)
  values ('avais-ok-' || p_proposta_id::text, 'info', v_ref || ' — Avais Financeiro e Jurídico OK',
          v_cli || ' · Aval de Pagamento e Aval Jurídico aprovados.' ||
          case when cardinality(v_falta) = 0 then ' A compra na China está liberada.'
               else ' Para liberar a compra ainda falta: ' || array_to_string(v_falta, '; ') || '.' end,
          'Financeiro', false)
  on conflict (id) do nothing;

  if cardinality(v_falta) = 0 then
    insert into alertas (id, level, title, sub, module, resolved)
    values ('compra-liberada-' || p_proposta_id::text, 'info', v_ref || ' — Compra ao fornecedor liberada',
            v_cli || ' · Aval de Pagamento, Aval Jurídico e Projeto de Instalação assinado' ||
            case when v_precisa_ceo then ', mais a aprovação do CEO' else '' end || '. Já dá para "Decidir comprar".',
            'Financeiro', false)
    on conflict (id) do nothing;
    update alertas set resolved = true where id = 'avais-ok-' || p_proposta_id::text and not resolved;
  end if;
end; $function$;

-- CEO aprovou (pela tela Aval Financeiro ou pela Central, que agora também grava aqui).
drop trigger if exists trg_avais_financeiros_ceo_ok on public.avais_financeiros;
create trigger trg_avais_financeiros_ceo_ok after update of aprovacao_ceo_em on public.avais_financeiros
  for each row when (new.aprovacao_ceo_em is not null and old.aprovacao_ceo_em is null)
  execute function public.fn_avais_notificar_ok_trg();

-- Cliente assinou um Projeto de Instalação: reavalia os avisos das propostas daquela cotação.
create or replace function public.fn_avais_notificar_ok_por_projeto()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_n int; r record;
begin
  if new.documento_tipo <> 'projeto_instalacao' or new.status <> 'assinado' or old.status is not distinct from new.status then
    return new;
  end if;
  begin
    select d.numero_cotacao into v_n from projetos_elevador_desenhos d where d.id::text = new.documento_id;
    if v_n is not null then
      for r in select proposta_id from avais_financeiros where numero_cotacao = v_n and proposta_id is not null loop
        perform public.fn_avais_notificar_ok(r.proposta_id);
      end loop;
    end if;
  exception when others then
    raise warning 'fn_avais_notificar_ok_por_projeto: %', sqlerrm;   -- aviso nunca impede a assinatura
  end;
  return new;
end; $function$;

drop trigger if exists trg_projeto_instalacao_avais_ok on public.documento_signatarios;
create trigger trg_projeto_instalacao_avais_ok after update of status on public.documento_signatarios
  for each row execute function public.fn_avais_notificar_ok_por_projeto();

revoke all on function public.fn_avais_notificar_ok(uuid) from public, anon, authenticated;
revoke all on function public.fn_avais_notificar_ok_por_projeto() from public, anon, authenticated;
