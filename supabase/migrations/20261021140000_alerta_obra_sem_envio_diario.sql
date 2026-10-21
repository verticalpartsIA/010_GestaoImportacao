-- Aviso: obra com Contrato Instalador assinado sem envio do checklist de Acompanhamento de Obra há 2+ dias úteis.
-- Só AVISA (não bloqueia pagamento; quem decide é o operador). Só lê e grava em `alertas`.
create or replace function public.obras_alertar_sem_envio(simular boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lista jsonb; v_n int := 0; r record;
begin
  create temp table if not exists _obras_sem_envio (dossier text, contrato text, instalador text, ref date, uteis int) on commit drop;
  delete from _obras_sem_envio;
  insert into _obras_sem_envio
  select d, c.numero_documento, c.contratada_nome, ref.dia,
         (select count(*) from generate_series(ref.dia + 1, v_hoje, interval '1 day') g where extract(isodow from g) < 6)::int
    from public.contratos_instalador c
    cross join lateral unnest(c.dossier_ids) d
    cross join lateral (
      select coalesce((select max(s.flegado_em) at time zone 'America/Sao_Paulo' from public.acompanhamento_obra_status s where s.dossier_id = d),
                      c.signed_at at time zone 'America/Sao_Paulo')::date as dia) ref
   where c.status = 'assinado' and c.signed_at is not null
     and (select count(*) filter (where s.flegado) from public.acompanhamento_obra_status s where s.dossier_id = d)
         < (select count(*) from public.acompanhamento_obra_itens);
  delete from _obras_sem_envio where uteis < 2;
  select count(*) into v_n from _obras_sem_envio;
  if simular then
    return jsonb_build_object('obras', v_n, 'lista', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from _obras_sem_envio t));
  end if;
  for r in select * from _obras_sem_envio loop
    insert into public.alertas (id, level, title, sub, module, resolved, rota)
    values ('obra-sem-envio-' || r.dossier || '-' || to_char(r.ref, 'YYYYMMDD'), 'warning',
            'Obra ' || r.dossier || ' sem envio do checklist há ' || r.uteis || ' dias úteis',
            r.instalador || ' · contrato ' || r.contrato || ' · último envio em ' || to_char(r.ref, 'DD/MM/YYYY'),
            'Engenharia', false, '/engenharia/dossier-obra/' || r.dossier || '/acompanhamento-obra')
    on conflict (id) do nothing;
  end loop;
  -- resolve avisos de obras que voltaram a enviar (ou concluíram)
  update public.alertas a set resolved = true
   where starts_with(a.id, 'obra-sem-envio-') and not a.resolved
     and not exists (select 1 from _obras_sem_envio t where a.id = 'obra-sem-envio-' || t.dossier || '-' || to_char(t.ref, 'YYYYMMDD'));
  return jsonb_build_object('obras', v_n);
end $$;
revoke all on function public.obras_alertar_sem_envio(boolean) from public, anon, authenticated;

-- seg–sex 10:25 UTC = 07:25 Brasília
select cron.schedule('obras-alerta-sem-envio-diario', '25 10 * * 1-5', $c$select public.obras_alertar_sem_envio(false)$c$);
