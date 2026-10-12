-- Status da Obra (página pública) — vistorias lidas da tabela usada de verdade (12/10/2026, auditoria de amarrações)
-- public_status_obra_sessao lia vistorias_obras (agendador manual antigo, VAZIO), então "Vistoria Nº 1/2/3" ficava sempre
-- pendente, enquanto o checklist da obra (InstalacaoObraStore.obterProgressoVistoria) já lia vistorias_atividades.
-- Agora: Vistoria Nº N = N-ésima vistoria CONCLUÍDA da obra em vistorias_atividades, por data de conclusão; pessoa = nome do
-- técnico (colaboradores_vpsistema). O resto da função é idêntico ao da migration 20261010120000.
create or replace function public.public_status_obra_sessao(p_token text, p_modo text default 'cliente') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; d dossier_obra%rowtype; itens jsonb := '[]'::jsonb; n int; c_status text; c_sent timestamptz; c_qtd int;
        v record; doc record; tp text;
begin
  v_id := public._po_dossier_status(p_token, p_modo);
  if v_id is null then return null; end if;
  select * into d from dossier_obra where id = v_id;

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

  for n in 1..3 loop
    select cv.nome as vistoriador, coalesce(va.concluido_em, va.atualizado_em) as quando into v
      from vistorias_atividades va left join colaboradores_vpsistema cv on cv.id = va.tecnico_id
     where va.dossier_id = d.id and va.status = 'concluida'
     order by coalesce(va.concluido_em, va.atualizado_em) asc nulls last, va.id
     offset n - 1 limit 1;
    itens := itens || jsonb_build_array(jsonb_build_object('chave', 'vistoria_' || n, 'titulo', 'Vistoria Nº ' || n,
      'concluido', found, 'pessoa', case when found then v.vistoriador end, 'data', case when found then v.quando end));
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
