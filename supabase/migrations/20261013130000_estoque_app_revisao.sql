-- VP Estoque · lado do HUB, parte 2: abertura de sessão, lista cega, resumo, recontagem, decisão, aprovação e fechamento.
-- Sobre o esquema que já existe (estoque_sessoes.lista_esperada jsonb [{codigo,saldo,...}]) + estoque_sessao_decisoes (parte 1).
-- SECURITY DEFINER com alçada conferida DENTRO (módulo 'estoque', pelo JWT do usuário do hub); anon nunca executa.
-- Aprovar uma contagem grava em importacao_varejo_contagem / _hist com origem 'app' (acuracidade e sugestão de compra passam a usar).
-- NÃO enfileira ajuste no Omie (pcp_omie_fila): o payload 'ajuste_estoque' está em aberto na issue #861 e outra sessão cuida da gravação
-- no Omie. Quando fechar, acrescentar a chamada ao final de estoque_aprovar_contagem (ver TODO lá).

create or replace function public.estoque_exige(p_cap text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_tem_capacidade('estoque', p_cap) then raise exception 'estoque: sem alçada "%"', p_cap; end if;
end $$;

-- hub: quem revisa lê eventos e sessões completas pelas telas; o app não passa por aqui
drop policy if exists estoque_ev_sel_hub on public.estoque_eventos;
create policy estoque_ev_sel_hub on public.estoque_eventos for select to authenticated
  using ((select public.vp_tem_capacidade('estoque', 'revisar')));
grant select on public.estoque_eventos to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Abrir sessão e CONGELAR a lista esperada: [{codigo, descricao, endereco, saldo}] (saldo = físico do Omie naquele momento)
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_abrir_sessao(
  p_tipo text, p_nome text default null, p_escopo jsonb default '{"modo":"completo"}'::jsonb,
  p_limite integer default 10, p_tolerancia numeric default null, p_recontagem_obrigatoria boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_fam text; v_end text; v_cods text[]; v_lista jsonb; v_escopo text;
begin
  perform public.estoque_exige('abrir_sessao');
  if p_tipo not in ('contagem', 'inventario') then raise exception 'estoque: sessão só de contagem ou inventário'; end if;
  v_fam := nullif(btrim(p_escopo->>'familia'), '');
  v_end := nullif(btrim(p_escopo->>'endereco'), '');
  select array_agg(upper(btrim(x))) into v_cods from jsonb_array_elements_text(coalesce(p_escopo->'codigos', '[]'::jsonb)) x;
  v_escopo := case when v_fam is null and v_end is null and v_cods is null then 'completo' else p_escopo::text end;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', upper(c.sku), 'descricao', coalesce(iv.descricao, pp.descricao),
                                               'endereco', coalesce(ct.endereco, pp.endereco), 'saldo', c.fisico) order by upper(c.sku)), '[]'::jsonb)
    into v_lista
  from public.omie_estoque_cache c
  left join public.importacao_varejo_produtos iv on upper(iv.codigo) = upper(c.sku)
  left join public.pcp_produtos pp on upper(pp.codigo) = upper(c.sku)
  left join public.importacao_varejo_contagem ct on upper(ct.codigo) = upper(c.sku)
  where c.sku is not null and btrim(c.sku) <> ''
    and (v_fam is null or pp.familia ilike v_fam)
    and (v_end is null or coalesce(ct.endereco, pp.endereco) ilike v_end || '%')
    and (v_cods is null or upper(c.sku) = any (v_cods));
  if jsonb_array_length(v_lista) = 0 then raise exception 'estoque: o recorte não tem nenhum item'; end if;

  insert into public.estoque_sessoes (tipo, nome, escopo, lista_esperada, limite_aparelhos, tolerancia, recontagem_obrigatoria, criado_por)
    values (p_tipo, coalesce(nullif(btrim(p_nome), ''), initcap(p_tipo) || ' ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')),
            v_escopo, v_lista, greatest(1, least(coalesce(p_limite, 10), 50)), p_tolerancia, coalesce(p_recontagem_obrigatoria, false), public.vp_email())
    returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Lista que o APARELHO recebe: SEM saldo (contagem cega). Chamada com o JWT de quem conta.
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_sessao_lista(p_sessao uuid)
returns table (codigo text, descricao text, endereco text, rodada_atual integer, recontar boolean, contado_nesta_rodada boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.vp_tem_capacidade('estoque', 'contar') or public.vp_tem_capacidade('estoque', 'revisar')) then
    raise exception 'estoque: sem alçada para ver a lista';
  end if;
  return query
    select upper(btrim(x.codigo)), x.descricao, x.endereco, coalesce(d.rodada_atual, 1), coalesce(d.recontar, false),
           exists (select 1 from public.estoque_eventos e where e.sessao_id = s.id and e.codigo = upper(btrim(x.codigo))
                     and e.rodada = coalesce(d.rodada_atual, 1) and e.status <> 'rejeitado')
    from public.estoque_sessoes s
    cross join lateral jsonb_to_recordset(s.lista_esperada) as x(codigo text, descricao text, endereco text)
    left join public.estoque_sessao_decisoes d on d.sessao_id = s.id and d.codigo = upper(btrim(x.codigo))
    where s.id = p_sessao order by 1;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Resumo por item (base interna + versão com alçada 'revisar')
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_resumo_base(p_sessao uuid)
returns table (codigo text, descricao text, endereco text, saldo_omie numeric, rodada_atual integer, recontar boolean,
               contado_r1 numeric, contado_r2 numeric, quem text, endereco_lido text,
               decisao text, quantidade_final numeric, justificativa text, aprovado_em timestamptz,
               quantidade_apurada numeric, diferenca numeric, divergente boolean, situacao text)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.estoque_sessoes where id = p_sessao),
  lista as (
    select upper(btrim(x.codigo)) codigo, x.descricao, x.endereco, x.saldo
    from s cross join lateral jsonb_to_recordset(s.lista_esperada) as x(codigo text, descricao text, endereco text, saldo numeric)),
  ev as (
    select e.codigo, e.rodada, sum(e.quantidade) q, count(*) n,
           string_agg(distinct e.usuario, ', ') quem,
           (array_agg(e.endereco order by e.recebido_em desc) filter (where e.endereco is not null))[1] ender
    from public.estoque_eventos e
    where e.sessao_id = p_sessao and e.tipo in ('contagem', 'inventario') and e.status <> 'rejeitado'
    group by e.codigo, e.rodada),
  base as (
    select l.codigo, l.descricao, l.endereco, l.saldo,
           coalesce(d.rodada_atual, 1) rodada_atual, coalesce(d.recontar, false) recontar,
           d.decisao, d.quantidade_final, d.justificativa, d.aprovado_em,
           r1.q q1, r1.n n1, r2.q q2, r2.n n2,
           coalesce(r2.quem, r1.quem) quem, coalesce(r2.ender, r1.ender) ender_lido
    from lista l
    left join public.estoque_sessao_decisoes d on d.sessao_id = p_sessao and d.codigo = l.codigo
    left join ev r1 on r1.codigo = l.codigo and r1.rodada = 1
    left join ev r2 on r2.codigo = l.codigo and r2.rodada >= 2),
  calc as (
    select b.*,
      case
        when b.quantidade_final is not null then b.quantidade_final
        when b.recontar and b.n2 is null then null                              -- aguarda a recontagem
        when b.n2 is not null and b.n1 is not null and b.q2 <> b.q1 then null   -- 1ª e 2ª diferem: decisão manual do gestor
        when b.n2 is not null then b.q2                                         -- recontagem igual à primeira (ou 1ª ausente) vale
        else b.q1 end as apurada
    from base b)
  select c.codigo, c.descricao, c.endereco, c.saldo, c.rodada_atual, c.recontar,
         c.q1, c.q2, c.quem, c.ender_lido, c.decisao, c.quantidade_final, c.justificativa, c.aprovado_em,
         c.apurada,
         case when c.apurada is null or c.saldo is null then null else c.apurada - c.saldo end,
         case when c.apurada is null or c.saldo is null then null
              else abs(c.apurada - c.saldo) > coalesce((select tolerancia from s), 0) end,
         case
           when c.aprovado_em is not null then 'aprovado'
           when c.apurada is not null and c.apurada < 0 then 'negativo'
           when c.quantidade_final is not null then 'decidido'
           when c.recontar and c.n2 is null then 'aguardando_recontagem'
           when c.n1 is null and c.n2 is null then (case when c.decisao in ('justificado', 'aceito') then 'justificado' else 'nao_contado' end)
           when c.n1 is not null and c.n2 is not null and c.q2 <> c.q1 then 'decisao_manual'
           else 'contado' end
  from calc c order by c.codigo
$$;

create or replace function public.estoque_resumo_sessao(p_sessao uuid)
returns table (codigo text, descricao text, endereco text, saldo_omie numeric, rodada_atual integer, recontar boolean,
               contado_r1 numeric, contado_r2 numeric, quem text, endereco_lido text,
               decisao text, quantidade_final numeric, justificativa text, aprovado_em timestamptz,
               quantidade_apurada numeric, diferenca numeric, divergente boolean, situacao text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.estoque_exige('revisar');
  return query select * from public.estoque_resumo_base(p_sessao);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Revisão: pedir recontagem, decidir item, justificar em lote, rejeitar eventos, mudar estado
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_pedir_recontagem(p_sessao uuid, p_codigos text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  perform public.estoque_exige('revisar');
  if (select estado from public.estoque_sessoes where id = p_sessao) is distinct from 'aberta' then
    raise exception 'estoque: reabra a coleta da sessão para pedir recontagem';
  end if;
  insert into public.estoque_sessao_decisoes (sessao_id, codigo, recontar, rodada_atual)
    select p_sessao, c, true, 2 from (select distinct upper(btrim(x)) c from unnest(p_codigos) x) q
     where exists (select 1 from public.estoque_sessoes s, jsonb_array_elements(s.lista_esperada) li where s.id = p_sessao and upper(btrim(li->>'codigo')) = q.c)
    on conflict (sessao_id, codigo) do update set recontar = true, rodada_atual = 2, decisao = null, quantidade_final = null
      where estoque_sessao_decisoes.aprovado_em is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.estoque_decidir_item(p_sessao uuid, p_codigo text, p_decisao text,
                                                       p_quantidade numeric default null, p_justificativa text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cod text := upper(btrim(p_codigo));
begin
  perform public.estoque_exige('revisar');
  if p_decisao not in ('aceito', 'justificado', 'zero', 'manual') then raise exception 'estoque: decisão inválida'; end if;
  if p_decisao in ('justificado', 'manual', 'zero') and coalesce(btrim(p_justificativa), '') = '' then
    raise exception 'estoque: informe a justificativa';
  end if;
  if p_decisao = 'manual' and (p_quantidade is null or p_quantidade < 0) then raise exception 'estoque: informe a quantidade final (>= 0)'; end if;
  if not exists (select 1 from public.estoque_sessoes s, jsonb_array_elements(s.lista_esperada) li where s.id = p_sessao and upper(btrim(li->>'codigo')) = v_cod) then
    raise exception 'estoque: item % não está na sessão', v_cod;
  end if;
  insert into public.estoque_sessao_decisoes (sessao_id, codigo, decisao, quantidade_final, justificativa, decidido_por, decidido_em)
    values (p_sessao, v_cod, p_decisao, case p_decisao when 'zero' then 0 when 'manual' then p_quantidade else null end,
            p_justificativa, public.vp_email(), now())
  on conflict (sessao_id, codigo) do update set decisao = excluded.decisao, quantidade_final = excluded.quantidade_final,
      justificativa = excluded.justificativa, decidido_por = excluded.decidido_por, decidido_em = excluded.decidido_em
    where estoque_sessao_decisoes.aprovado_em is null;
  if exists (select 1 from public.estoque_sessao_decisoes where sessao_id = p_sessao and codigo = v_cod and aprovado_em is not null) then
    raise exception 'estoque: item % já foi aprovado', v_cod;
  end if;
end $$;

-- "Justificar" em lote tudo que não foi contado (mantém o saldo do Omie — 8.3 da especificação)
create or replace function public.estoque_justificar_nao_contados(p_sessao uuid, p_justificativa text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  perform public.estoque_exige('revisar');
  if coalesce(btrim(p_justificativa), '') = '' then raise exception 'estoque: informe a justificativa'; end if;
  insert into public.estoque_sessao_decisoes (sessao_id, codigo, decisao, justificativa, decidido_por, decidido_em)
    select p_sessao, r.codigo, 'justificado', p_justificativa, public.vp_email(), now()
      from public.estoque_resumo_base(p_sessao) r where r.situacao = 'nao_contado'
  on conflict (sessao_id, codigo) do update set decisao = 'justificado', justificativa = excluded.justificativa,
      decidido_por = excluded.decidido_por, decidido_em = excluded.decidido_em
    where estoque_sessao_decisoes.aprovado_em is null and estoque_sessao_decisoes.decisao is null and estoque_sessao_decisoes.quantidade_final is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.estoque_rejeitar_eventos(p_ids uuid[], p_motivo text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  perform public.estoque_exige('revisar');
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'estoque: informe o motivo da rejeição'; end if;
  perform set_config('vp.estoque_hub', 'on', true);
  update public.estoque_eventos set status = 'rejeitado', motivo_rejeicao = p_motivo, revisado_por = public.vp_email(), revisado_em = now()
   where id = any (p_ids) and status = 'pendente';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- aberta <-> em_revisao (a coleta para quando entra em revisão; reabrir permite recontagem)
create or replace function public.estoque_mudar_estado(p_sessao uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
declare v_atual text;
begin
  perform public.estoque_exige('revisar');
  select estado into v_atual from public.estoque_sessoes where id = p_sessao for update;
  if v_atual is null then raise exception 'estoque: sessão inexistente'; end if;
  if not ((v_atual = 'aberta' and p_estado = 'em_revisao') or (v_atual = 'em_revisao' and p_estado = 'aberta')) then
    raise exception 'estoque: transição % -> % não permitida (para fechar use estoque_fechar_sessao)', v_atual, p_estado;
  end if;
  update public.estoque_sessoes set estado = p_estado where id = p_sessao;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Aprovar: grava importacao_varejo_contagem (+ _hist, origem 'app') e marca os eventos como aprovados
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_aprovar_contagem(p_sessao uuid, p_codigos text[] default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_email text := public.vp_email(); v_ok integer := 0; v_pulados jsonb := '[]'::jsonb; v_estado text;
begin
  perform public.estoque_exige('aprovar');
  select estado into v_estado from public.estoque_sessoes where id = p_sessao;
  if v_estado is null then raise exception 'estoque: sessão inexistente'; end if;
  if v_estado = 'fechada' then raise exception 'estoque: sessão já fechada'; end if;
  perform set_config('vp.estoque_hub', 'on', true);

  for r in select * from public.estoque_resumo_base(p_sessao) x
            where (p_codigos is null or x.codigo = any (select upper(btrim(c)) from unnest(p_codigos) c)) loop
    if r.situacao in ('contado', 'decidido') and r.quantidade_apurada is not null then
      insert into public.importacao_varejo_contagem (codigo, quantidade, saldo_sistemico, contado_em, contado_por, endereco, observacao, atualizado_em, atualizado_por)
        values (r.codigo, r.quantidade_apurada, r.saldo_omie, current_date, coalesce(r.quem, v_email),
                coalesce(r.endereco_lido, r.endereco), 'VP Estoque · sessão ' || p_sessao::text || coalesce(' · ' || r.justificativa, ''), now(), v_email)
      on conflict (codigo) do update set quantidade = excluded.quantidade, saldo_sistemico = excluded.saldo_sistemico,
        contado_em = excluded.contado_em, contado_por = excluded.contado_por,
        endereco = coalesce(excluded.endereco, importacao_varejo_contagem.endereco),
        observacao = excluded.observacao, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
      insert into public.importacao_varejo_contagem_hist (codigo, quantidade, saldo_sistemico, diferenca, contado_em, contado_por, endereco, observacao, origem, registrado_por)
        values (r.codigo, r.quantidade_apurada, r.saldo_omie, case when r.saldo_omie is null then null else r.quantidade_apurada - r.saldo_omie end,
                current_date, coalesce(r.quem, v_email), coalesce(r.endereco_lido, r.endereco),
                'VP Estoque · sessão ' || p_sessao::text || coalesce(' · ' || r.justificativa, ''), 'app', v_email);
      update public.estoque_eventos set status = 'aprovado', revisado_por = v_email, revisado_em = now()
       where sessao_id = p_sessao and codigo = r.codigo and tipo in ('contagem', 'inventario') and status = 'pendente';
      insert into public.estoque_sessao_decisoes (sessao_id, codigo, aprovado_em, aprovado_por)
        values (p_sessao, r.codigo, now(), v_email)
      on conflict (sessao_id, codigo) do update set aprovado_em = now(), aprovado_por = v_email;
      v_ok := v_ok + 1;
    elsif r.situacao in ('aguardando_recontagem', 'decisao_manual', 'negativo') then
      v_pulados := v_pulados || jsonb_build_array(jsonb_build_object('codigo', r.codigo, 'motivo', r.situacao));
    end if;
  end loop;
  -- TODO (#861): enfileirar 'ajuste_estoque' em pcp_omie_fila (chave única por sessão+código) quando o payload estiver definido.
  return jsonb_build_object('aprovados', v_ok, 'pulados', v_pulados);
end $$;

-- Recebimento e saída: o gestor aprova (marca) os eventos; a escrita no Omie segue o fluxo da fila (#861)
create or replace function public.estoque_aprovar_eventos(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  perform public.estoque_exige('aprovar');
  perform set_config('vp.estoque_hub', 'on', true);
  update public.estoque_eventos set status = 'aprovado', revisado_por = public.vp_email(), revisado_em = now()
   where id = any (p_ids) and status = 'pendente' and tipo in ('recebimento', 'saida');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Fechar: só com tudo aprovado ou justificado (5.4)
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_fechar_sessao(p_sessao uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pend jsonb; v_estado text; v_obrig boolean;
begin
  perform public.estoque_exige('aprovar');
  select estado, recontagem_obrigatoria into v_estado, v_obrig from public.estoque_sessoes where id = p_sessao for update;
  if v_estado is null then raise exception 'estoque: sessão inexistente'; end if;
  if v_estado = 'fechada' then return jsonb_build_object('fechada', true); end if;
  select coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'situacao', x.situacao)), '[]'::jsonb) into v_pend
    from public.estoque_resumo_base(p_sessao) x
   where x.situacao not in ('aprovado', 'justificado')
      or (v_obrig and x.situacao = 'contado' and coalesce(x.divergente, false) and x.contado_r2 is null);
  if jsonb_array_length(v_pend) > 0 then
    raise exception 'estoque: não dá para fechar, faltam % item(ns): %', jsonb_array_length(v_pend), left(v_pend::text, 400);
  end if;
  update public.estoque_sessoes set estado = 'fechada', fechado_em = now(), fechado_por = public.vp_email() where id = p_sessao;
  return jsonb_build_object('fechada', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Permissões de execução: só usuário autenticado (a alçada é conferida dentro); a base e o helper só o servidor
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.estoque_exige(text), public.estoque_resumo_base(uuid) from public, anon, authenticated;
grant  execute on function public.estoque_exige(text), public.estoque_resumo_base(uuid) to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'estoque_abrir_sessao(text,text,jsonb,integer,numeric,boolean)', 'estoque_sessao_lista(uuid)', 'estoque_resumo_sessao(uuid)',
    'estoque_pedir_recontagem(uuid,text[])', 'estoque_decidir_item(uuid,text,text,numeric,text)',
    'estoque_justificar_nao_contados(uuid,text)', 'estoque_rejeitar_eventos(uuid[],text)', 'estoque_mudar_estado(uuid,text)',
    'estoque_aprovar_contagem(uuid,text[])', 'estoque_aprovar_eventos(uuid[])', 'estoque_fechar_sessao(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
