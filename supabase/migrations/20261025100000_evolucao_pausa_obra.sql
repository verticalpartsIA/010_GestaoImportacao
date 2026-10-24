-- Cópia em SQL das regras de src/evolucao-conferir-calc.js (a tela usa o JS; mantenha as duas iguais — há teste de paridade).
-- 25/10/2026 — Pendência 4.3: PAUSA de obra legitimamente parada ("Pausada até dd/mm" + motivo).
--  * dossier_obra ganha pausada_ate/pausa_motivo/pausa_por/pausa_em; histórico imutável em dossier_obra_pausas.
--  * Só a função evolucao_pausar_obra grava (alçada mapa-obras.pausar ou Administrador): motivo >= 10 letras, data de hoje até +60 dias.
--  * Pausa vigente (até a data, inclusive) cala previsão vencida/desatualizada/anterior à chegada e "sem Diário"; erro de dado continua.
--  * Pausa vencida há <= 3 dias gera o achado pausa_vencida ("a pausa venceu"). Nada é apagado.
alter table public.dossier_obra
  add column if not exists pausada_ate date, add column if not exists pausa_motivo text,
  add column if not exists pausa_por text, add column if not exists pausa_em timestamptz;

create table if not exists public.dossier_obra_pausas (
  id bigint generated always as identity primary key,
  dossier_id text not null, pausada_ate date not null, motivo text not null,
  por text not null default public.vp_email(), criado_em timestamptz not null default now(), cancelada_em timestamptz
);
alter table public.dossier_obra_pausas enable row level security;
create policy dossier_obra_pausas_ler on public.dossier_obra_pausas for select to authenticated using (public.vp_usuario_ativo());
-- sem política de insert/update/delete: só a função abaixo grava (security definer)

create or replace function public.evolucao_pausar_obra(p_dossier text, p_ate date, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $f$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not public.vp_tem_capacidade('mapa-obras', 'pausar') then raise exception 'Sem permissão para pausar obra (alçada mapa-obras.pausar).'; end if;
  if p_ate is null then
    update dossier_obra set pausada_ate = null, pausa_motivo = null, pausa_por = null, pausa_em = null where id::text = p_dossier;
    update dossier_obra_pausas set cancelada_em = now() where dossier_id = p_dossier and cancelada_em is null;
    return jsonb_build_object('ok', true, 'pausa', null);
  end if;
  if length(v_motivo) < 10 then raise exception 'Informe o motivo da pausa (mínimo 10 letras).'; end if;
  if p_ate < v_hoje or p_ate > v_hoje + 60 then raise exception 'A pausa vai de hoje até no máximo 60 dias (até %).', v_hoje + 60; end if;
  update dossier_obra set pausada_ate = p_ate, pausa_motivo = v_motivo, pausa_por = public.vp_email(), pausa_em = now() where id::text = p_dossier;
  if not found then raise exception 'Obra não encontrada.'; end if;
  insert into dossier_obra_pausas (dossier_id, pausada_ate, motivo) values (p_dossier, p_ate, v_motivo);
  return jsonb_build_object('ok', true, 'pausa', p_ate);
end $f$;
revoke all on function public.evolucao_pausar_obra(text, date, text) from public, anon;
grant execute on function public.evolucao_pausar_obra(text, date, text) to authenticated;

create or replace function public.evolucao_conferir_achados(p_hoje date default ((now() at time zone 'America/Sao_Paulo')::date))
returns table (obra_id text, serie text, codigo text, gravidade text, motivo text, quem text, dias int)
language sql stable security definer set search_path = public as $$
with b0 as (
  select d.id::text as obra_id, nullif(trim(e.numero_serie), '') as serie, trim(coalesce(d.status_master, '')) as fase,
         case when trim(coalesce(d.status_master, '')) in ('DataBook', 'Entregue', 'Manutenção preventiva') then 'concluida'
              when trim(coalesce(d.status_master, '')) = 'Instalação' then 'andamento'
              when trim(coalesce(d.status_master, '')) in ('Contrato assinado', 'Importação', 'Homologação instalador')
                   then case when coalesce(d.equipamento_entregue, false) then 'andamento' else 'aguardando' end end as sit,
         (greatest(d.updated_at, e.atualizado_em) at time zone 'America/Sao_Paulo')::date as upd,
         e.chegada_real_material::date as rc, e.data_real_inicio::date as ri, e.data_real_termino::date as rt,
         e.previsao_chegada_material::date as pc, e.previsao_inicio::date as pi, e.previsao_termino::date as pt,
         coalesce(d.equipamento_entregue, false) as entregue, d.equipamento_entregue_em::date as entregue_em,
         lower(trim(coalesce(d.client_name, ''))) || '|' || lower(trim(coalesce(d.building_name, ''))) || '|' || lower(trim(coalesce(d.city, ''))) as grupo,
         coalesce(d.building_name, '') || ' ' || coalesce(d.client_name, '') as texto,
         exists (select 1 from acompanhamento_obra_status s where s.dossier_id = d.id and s.flegado) as diario,
         d.pausada_ate as pausa_ate, nullif(trim(coalesce(d.pausa_motivo, '')), '') as pausa_motivo
    from dossier_obra d left join equipamentos_obra e on e.dossier_id = d.id
), b as (
  select row_number() over (order by obra_id, serie nulls first, rc, ri) as rn, * from b0 where sit is not null
), ach (obra_id, serie, codigo, gravidade, motivo, quem, dias) as (
-- R1a: data real no futuro
select b.obra_id, b.serie, 'real_no_futuro'::text, 'alta'::text,
       'A data real de ' || r.rot || ' (' || to_char(r.d, 'DD/MM/YYYY') || ') ainda não aconteceu — provavelmente é a previsão digitada no campo "real".', 'felipe'::text, null::int
  from b cross join lateral (values ('chegada do material', b.rc), ('início', b.ri), ('término', b.rt)) r(rot, d) where r.d > p_hoje
union all
-- R1b: data real depois da última edição do dossiê
select b.obra_id, b.serie, 'real_apos_edicao', 'media',
       'A data real de ' || r.rot || ' (' || to_char(r.d, 'DD/MM/YYYY') || ') é posterior à última edição do dossiê (' || to_char(b.upd, 'DD/MM/YYYY') || ') — confira se foi digitada certa.', 'felipe', null
  from b cross join lateral (values ('chegada do material', b.rc), ('início', b.ri), ('término', b.rt)) r(rot, d)
 where r.d <= p_hoje and b.upd is not null and (r.d - b.upd) > 1
union all
-- R2: ordem das etapas
select b.obra_id, b.serie, 'ordem_invalida', 'alta',
       'O início real (' || to_char(b.ri, 'DD/MM/YYYY') || ') é anterior à chegada do material (' || to_char(b.rc, 'DD/MM/YYYY') || ').', 'felipe', null
  from b where b.rc is not null and b.ri is not null and b.ri < b.rc
union all
select b.obra_id, b.serie, 'ordem_invalida', 'alta',
       'O término real (' || to_char(b.rt, 'DD/MM/YYYY') || ') é anterior ao início real (' || to_char(b.ri, 'DD/MM/YYYY') || ').', 'felipe', null
  from b where b.ri is not null and b.rt is not null and b.rt < b.ri
union all
-- R3: término registrado e fase ainda "Instalação"
select b.obra_id, b.serie, 'fase_nao_avancou', 'media',
       'Término real em ' || to_char(b.rt, 'DD/MM/YYYY') || ', mas o dossiê continua na fase "Instalação" (deveria ir para DataBook/Entregue).', 'felipe', null
  from b where b.rt is not null and b.fase = 'Instalação'
union all
-- R4 + R9: previsão vencida (a mais atrasada de cada equipamento); "parado" quando sem edição há > 14 dias
select b.obra_id, b.serie, 'previsao_vencida', case when p_hoje - v.d > 30 then 'alta' else 'media' end,
       'Previsão de ' || v.rot || ' vencida há ' || (p_hoje - v.d) || case when p_hoje - v.d = 1 then ' dia' else ' dias' end
         || ' (' || to_char(v.d, 'DD/MM/YYYY') || ')'
         || case when b.upd is not null and p_hoje - b.upd > 14 then ', sem edição há ' || (p_hoje - b.upd) || ' dias' else '' end || '.',
       'felipe', (p_hoje - v.d)
  from b cross join lateral (
    select x.rot, x.d from (values ('chegada do material', b.pc, b.rc is null and not b.entregue),
                                   ('início', b.pi, b.ri is null and not b.diario),
                                   ('término', b.pt, b.rt is null)) x(rot, d, aberto)
     where x.aberto and x.d is not null and public._evo_dias_uteis(x.d, p_hoje) >= 1
     order by x.d limit 1) v
 where b.sit <> 'concluida'
union all
-- R5: previsão que ficou para trás
select b.obra_id, b.serie, 'previsao_antes_da_chegada', 'media',
       'O início previsto (' || to_char(b.pi, 'DD/MM/YYYY') || ') é anterior à chegada real do material (' || to_char(b.rc, 'DD/MM/YYYY') || ') — replanejar.', 'felipe', null
  from b where b.rc is not null and b.pi is not null and b.ri is null and b.pi < b.rc
union all
select b.obra_id, b.serie, 'previsao_desatualizada', 'media',
       r.rot || ' real em ' || to_char(r.real, 'DD/MM/YYYY') || ' contra ' || to_char(r.prev, 'DD/MM/YYYY') || ' previsto (' || abs(r.real - r.prev)
         || ' dias de diferença) — atualizar as previsões.', 'felipe', null
  from b cross join lateral (values ('Início', b.ri, b.pi), ('Chegada do material', b.rc, b.pc)) r(rot, real, prev)
 where r.real is not null and r.prev is not null and abs(r.real - r.prev) > 14
union all
-- R6: obra em Instalação sem nenhum lançamento no Diário de Obra (montador)
select b.obra_id, b.serie, 'sem_diario', 'media',
       'Obra em Instalação sem nenhum lançamento no Diário de Obra (o progresso aparece 0%).', 'montador', null
  from b where b.fase = 'Instalação' and b.sit <> 'concluida' and not b.diario
   and (coalesce(b.rc, b.entregue_em) is null or public._evo_dias_uteis(coalesce(b.rc, b.entregue_em), p_hoje) >= 3)
union all
-- R7: cadastro incompleto
select b.obra_id, b.serie, 'sem_serie', 'media', 'Equipamento sem nº de série cadastrado.', 'felipe', null
  from b where b.sit <> 'concluida' and b.serie is null
union all
select b.obra_id, b.serie, 'remocao_sem_fabrica', 'media',
       'Obra de remoção não tem "saída da fábrica"/importação — a linha do tempo está mostrando uma etapa que não se aplica.', 'felipe', null
  from b where b.texto ~* 'remo[cç][aã]o' and b.rc is null and b.ri is null and not b.entregue and not b.diario
union all
-- R8: equipamentos da mesma obra preenchidos de forma diferente
select b.obra_id, b.serie, 'irmao_iniciou', 'media',
       'O equipamento ' || coalesce((select o.serie from b o where o.grupo = b.grupo and o.rn <> b.rn and o.ri is not null order by o.rn limit 1), 'irmão')
         || ' da mesma obra já tem início real e este não.', 'felipe', null
  from b where b.sit <> 'concluida' and b.ri is null
   and exists (select 1 from b o where o.grupo = b.grupo and o.rn <> b.rn and o.ri is not null)
union all
select b.obra_id, b.serie, 'chegada_destoa_irmaos', 'media',
       'Chegada do material em ' || to_char(b.rc, 'DD/MM/YYYY') || ' destoa dos equipamentos da mesma obra (mais de 60 dias de diferença) — possível mês digitado errado.', 'felipe', null
  from b where b.sit <> 'concluida' and b.rc is not null
   and (select min(abs(b.rc - o.rc)) from b o where o.grupo = b.grupo and o.rn <> b.rn and o.rc is not null) > 60
union all
-- R10: a pausa da obra venceu há pouco (avisa por 3 dias; depois a cobrança normal basta)
select b.obra_id, b.serie, 'pausa_vencida', 'media',
       'A pausa da obra venceu em ' || to_char(b.pausa_ate, 'DD/MM/YYYY') || case when b.pausa_motivo is not null then ' (motivo: ' || b.pausa_motivo || ')' else '' end
         || ' — atualize as previsões ou renove a pausa.', 'felipe', null
  from b where b.sit <> 'concluida' and b.pausa_ate is not null and b.pausa_ate < p_hoje and p_hoje - b.pausa_ate <= 3
)
-- Pausa vigente (até a data, inclusive) cala só previsão e Diário; erro de dado continua cobrando.
select a.obra_id, a.serie, a.codigo, a.gravidade, a.motivo, a.quem, a.dias from ach a
 where not (a.codigo in ('previsao_vencida', 'previsao_antes_da_chegada', 'previsao_desatualizada', 'sem_diario')
            and exists (select 1 from b where b.obra_id = a.obra_id and b.pausa_ate >= p_hoje))
$$;

revoke all on function public.evolucao_conferir_achados(date) from public, anon, authenticated;
