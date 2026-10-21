-- Data real em que a etapa foi concluída (o montador informa ao marcar); flegado_em continua sendo a data do ENVIO.
alter table public.acompanhamento_obra_status add column if not exists concluido_em date;
comment on column public.acompanhamento_obra_status.concluido_em is 'Dia em que a etapa foi concluída em campo (informado pelo montador ou corrigido pelo operador). SLA usa esta data; sem ela, cai em flegado_em.';

create or replace function public.public_diario_obter(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
               'flegado_em', s.flegado_em, 'concluido_em', s.concluido_em, 'fotos', s.fotos, 'observacao', s.observacao,
               'acompanhamento_obra_itens', case when it.id is null then null else
                 jsonb_build_object('id', it.id, 'texto', it.texto, 'ordem', it.ordem, 'peso', it.peso) end))
        from acompanhamento_obra_status s left join acompanhamento_obra_itens it on it.id = s.item_id
       where s.dossier_id = l.dossier_id), '[]'::jsonb),
    'lancamentos', '[]'::jsonb,
    'equipamentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'numero_serie', e.numero_serie, 'tipo', e.tipo))
        from equipamentos_obra e where e.dossier_id = l.dossier_id), '[]'::jsonb));
end $function$;
