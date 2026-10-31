-- 24/10/2026 — Ajuste do aviso ao Felipe conforme o que o gi-avisos REALMENTE faz (confirmado pela sessão root-f5 da VPS):
--  1) Agrupamento 24 h: a chave do título apaga números, acentos e pontuação ("Evolução dos equipamentos: 23 a conferir — 26/10"
--     vira sempre "evolucao dos equipamentos a conferir"), então a data numérica NÃO evita o descarte como "agrupado". Solução sem
--     mexer no gi-avisos: o DIA DA SEMANA POR EXTENSO no título (letras não são apagadas; repete só a cada 7 dias).
--  2) Texto: o gi-avisos reescreve a partir dos 400 primeiros caracteres de "título — sub" (quebras de linha e "•" não são
--     preservadas, o resto se perde). Por isso o sub agora cabe em ~330 caracteres, com o essencial na frente.
-- Só substitui evolucao_alertar_felipe; regras de detecção e cron não mudam.
create or replace function public.evolucao_alertar_felipe(simular boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dest text[] := array['felipe.barros@verticalparts.com.br', 'gelson.simoes@verticalparts.com.br'];
  v_dias constant text[] := array['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
  v_eq_f int; v_eq_m int; v_eq int; v_titulo text; v_sub text; v_linhas text; v_mont text; v_nmont int; v_pref text; v_id text; e text; v_criados int := 0;
begin
  if extract(isodow from v_hoje) >= 6 or exists (select 1 from calendario_feriados where data = v_hoje and ativo and bloqueia_envio) then
    return jsonb_build_object('pulado', 'fim de semana ou feriado', 'data', v_hoje);
  end if;

  select count(distinct obra_id || '|' || coalesce(serie, '')) filter (where quem = 'felipe'),
         count(distinct obra_id || '|' || coalesce(serie, '')) filter (where quem = 'montador'),
         count(distinct obra_id || '|' || coalesce(serie, ''))
    into v_eq_f, v_eq_m, v_eq from evolucao_conferir_achados(v_hoje);
  v_pref := 'evol-conf-' || to_char(v_hoje, 'YYYYMMDD') || '-';
  if v_eq = 0 then
    if not simular then update alertas set resolved = true where starts_with(id, 'evol-conf-') and not resolved; end if;
    return jsonb_build_object('pendentes', 0, 'criado', false);
  end if;

  -- 1 linha por equipamento (o achado mais grave), os 3 mais graves, cada uma cortada em 60 caracteres
  select string_agg(l, E'\n') into v_linhas from (
    select '• ' || coalesce(serie, obra_id) || ': ' || left(motivo, 60) || case when length(motivo) > 60 then '…' else '' end as l from (
      select distinct on (obra_id, serie) obra_id, serie, motivo, gravidade, dias
        from evolucao_conferir_achados(v_hoje) where quem = 'felipe'
       order by obra_id, serie, (gravidade = 'alta') desc, dias desc nulls last) z
     order by (gravidade = 'alta') desc, dias desc nulls last, obra_id, serie limit 3) t;
  select count(*), string_agg(s, ', ') into v_nmont, v_mont from (
    select distinct coalesce(serie, obra_id) as s from evolucao_conferir_achados(v_hoje) where quem = 'montador' order by 1 limit 2) t;
  select count(distinct coalesce(serie, obra_id)) into v_nmont from evolucao_conferir_achados(v_hoje) where quem = 'montador';

  v_titulo := 'Evolução dos equipamentos: ' || v_eq || ' a conferir — ' || v_dias[extract(isodow from v_hoje)::int] || ', ' || to_char(v_hoje, 'DD/MM');
  v_sub := left('Cadastro (Felipe): ' || v_eq_f || case when v_linhas is not null then E'\n' || v_linhas else '' end
               || case when v_eq_m > 0 then E'\nCobrar montadores (sem Diário): ' || v_eq_m || ' (' || v_mont || case when v_nmont > 2 then ' e +' || (v_nmont - 2) else '' end || ')' else '' end,
                330);

  if simular then
    return jsonb_build_object('pendentes', v_eq, 'felipe', v_eq_f, 'montador', v_eq_m, 'titulo', v_titulo, 'sub', v_sub,
                              'chars_titulo_mais_sub', length(v_titulo || ' — ' || v_sub), 'destinatarios', to_jsonb(v_dest), 'criado', false);
  end if;

  update alertas set resolved = true where starts_with(id, 'evol-conf-') and not starts_with(id, v_pref) and not resolved;
  foreach e in array v_dest loop
    v_id := v_pref || e;
    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values (v_id, 'warning', v_titulo, v_sub, 'Engenharia', false, e, '/engenharia/mapa-obras/evolucao')
    on conflict (id) do nothing;
    if found then v_criados := v_criados + 1; end if;
  end loop;
  return jsonb_build_object('pendentes', v_eq, 'criado', v_criados > 0, 'avisos', v_criados);
exception when others then
  raise warning '[evolucao_alertar_felipe] %', sqlerrm;
  return jsonb_build_object('erro', sqlerrm);
end $$;

revoke all on function public.evolucao_alertar_felipe(boolean) from public, anon, authenticated;
