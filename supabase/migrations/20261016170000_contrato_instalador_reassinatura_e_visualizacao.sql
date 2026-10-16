-- 16/10/2026 (Gelson) — dois defeitos nos contratos de instalador.
--
-- 1) Reassinatura engolida: a chave do aviso era só o id do contrato. O M014 foi assinado por terceiro,
--    anulado (aviso marcado 'falha'), reaberto e assinado de verdade pelo Luiz Carlos — e esse 2º aviso
--    bateu na mesma chave e foi descartado (on conflict do nothing). Agora a chave leva o momento da assinatura.
-- 2) Visualização falsa: M002, M009 e M010 foram abertos no navegador do escritório logo depois de gerados e
--    viraram "o instalador visualizou". A página deixa de marcar (assinar-app.jsx); aqui desfazemos os 3.

create or replace function public.trg_evt_contrato_instalador_assinado() returns trigger language plpgsql security definer set search_path = public as $$
declare qtd int; obra text;
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado' then
    begin
      qtd := greatest(coalesce(array_length(new.dossier_ids, 1), 0),
                      coalesce(jsonb_array_length(new.form_state->'equipamentosManuais'), 0) + coalesce(jsonb_array_length(new.ativos_indices), 0), 1);
      obra := coalesce(nullif(new.form_state->>'clienteObraNome', ''), nullif(new.form_state->>'localServico', ''), new.titulo, 'obra');
      perform evento_enfileirar('instalador.contrato_assinado',
        'instalador.contrato_assinado:' || new.id || ':' || floor(extract(epoch from coalesce(new.signed_at, now())))::bigint,
        'contrato_instalador', new.id::text, new.numero_documento,
        jsonb_build_object('obra', obra, 'quantidade_elevadores', qtd, 'valor', new.valor_total, 'valor_fmt', _evt_brl(new.valor_total),
          'instalador', new.contratada_nome, 'contrato', new.numero_documento,
          'dossies', coalesce(to_jsonb(new.dossier_ids), '[]'::jsonb), 'assinante', new.audit->>'signerName'),
        jsonb_build_object('nome', new.audit->>'signerName'));
    exception when others then null;
    end;
  end if;
  return new;
end $$;

-- Aviso que faltou: assinatura verdadeira do M014 (15/10 21:13, Luiz Carlos).
do $$
declare c contratos_instalador%rowtype; qtd int; obra text;
begin
  select * into c from contratos_instalador where numero_documento = 'VPNI-DOS-M014' and status = 'assinado';
  if not found then return; end if;
  qtd := greatest(coalesce(array_length(c.dossier_ids, 1), 0),
                  coalesce(jsonb_array_length(c.form_state->'equipamentosManuais'), 0) + coalesce(jsonb_array_length(c.ativos_indices), 0), 1);
  obra := coalesce(nullif(c.form_state->>'clienteObraNome', ''), nullif(c.form_state->>'localServico', ''), c.titulo, 'obra');
  perform evento_enfileirar('instalador.contrato_assinado',
    'instalador.contrato_assinado:' || c.id || ':' || floor(extract(epoch from c.signed_at))::bigint,
    'contrato_instalador', c.id::text, c.numero_documento,
    jsonb_build_object('obra', obra, 'quantidade_elevadores', qtd, 'valor', c.valor_total, 'valor_fmt', _evt_brl(c.valor_total),
      'instalador', c.contratada_nome, 'contrato', c.numero_documento,
      'dossies', coalesce(to_jsonb(c.dossier_ids), '[]'::jsonb), 'assinante', c.audit->>'signerName'),
    jsonb_build_object('nome', c.audit->>'signerName'));
end $$;

-- Desfaz as 3 visualizações do escritório (só se ainda estiverem como estavam: visualizado, sem assinatura).
update contratos_instalador
   set status = 'rascunho', viewed_at = null, atualizado_em = now(),
       audit = coalesce(audit, '{}'::jsonb) - 'viewedAt' - 'viewIp' - 'viewUa' - 'viewDevice',
       log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'rascunho', 'at', now(),
             'meta', jsonb_build_object('correcao', true, 'motivo', 'visualização desfeita: o link foi aberto pela equipe (escritório), não pelo instalador')))
 where numero_documento in ('VPNI-DOS-M002', 'VPNI-DOS-M009', 'VPNI-DOS-M010')
   and status = 'visualizado' and signed_at is null
   and audit->>'viewIp' = '179.100.123.210';

update alertas set resolved = true
 where id in ('ci-65bdd27a-58af-418e-b208-9e632f1d02ae', 'ci-052a31c5-4ffd-45cb-83c1-9128cf1d334c', 'ci-b2f820db-1919-4d54-a131-83d09350402d')
   and resolved = false;
