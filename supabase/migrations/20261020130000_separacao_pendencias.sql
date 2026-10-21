-- Separação — PENDÊNCIAS POR ITEM (decisão do Gelson, 20/10/2026): pedido de quadro de comando tem itens que o almoxarifado separa agora
-- (botoeiras, cabos...) e itens que dependem de outro setor (quadro e fiação em fabricação ~10 dias, cabo que vai ser pinado, peça da importação).
--   * Cada item ganha, além de "separado", uma situação com OBSERVAÇÃO OBRIGATÓRIA: na_operacao | aguardando_chegada | falta.
--   * Estado novo do pedido, CALCULADO (não mexe no CHECK de estoque_separacoes, que o celular usa): 'parcial' = tudo separado ou justificado,
--     mas há pendência aberta. SLA do almoxarifado para de contar aí; a espera aparece à parte. Só 'separado' conta como pronto.
--   * Não dá mais para concluir com item em branco: falta sem justificativa é recusada. Concluir fica bloqueado enquanto houver item
--     na operação ou aguardando chegada (a falta justificada pode concluir).
--   * Quando a OP-mãe do pedido é concluída no PCP, avisa os líderes do almoxarifado (Central de Notificações).
-- NÃO mexe em estoque_separacao_chamar (a função do celular). O celular não vê as pendências até o app 013_Estoque ser atualizado.
-- Pendências nascem FECHADAS (RLS sem política): só as funções abaixo (security definer) leem e gravam.

create table if not exists public.estoque_separacao_pendencias (
  id bigint generated always as identity primary key,
  codigo_pedido bigint not null,
  codigo text not null,                                -- MAIÚSCULAS
  situacao text not null check (situacao in ('na_operacao', 'aguardando_chegada', 'falta')),
  obs text not null check (length(btrim(obs)) >= 3),
  por text not null,
  em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por text
);
create unique index if not exists estoque_separacao_pend_aberta_uk
  on public.estoque_separacao_pendencias (codigo_pedido, codigo) where resolvido_em is null;
alter table public.estoque_separacao_pendencias enable row level security;
revoke all on public.estoque_separacao_pendencias from anon, authenticated;
grant all on public.estoque_separacao_pendencias to service_role;

alter table public.estoque_separacao_hist drop constraint if exists estoque_separacao_hist_acao_check;
alter table public.estoque_separacao_hist add constraint estoque_separacao_hist_acao_check
  check (acao in ('pegou', 'assumiu', 'soltou', 'separou', 'concluiu', 'pendenciou', 'resolveu'));

-- ---------------------------------------------------------------------------------------------
create or replace function public.separacao_hub(p_acao text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_ped bigint; v_ped_row public.pcp_pedidos%rowtype; v_sep public.estoque_separacoes%rowtype;
  v_out jsonb; v_sla numeric; v_cod text; v_sit text; v_obs text; v_pedida numeric; v_feita numeric; v_n int; v_forcar boolean;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação: sem sessão ativa'; end if;
  p_args := coalesce(p_args, '{}'::jsonb);
  v_ped := nullif(p_args->>'codigo_pedido', '')::bigint;
  v_cod := upper(btrim(coalesce(p_args->>'codigo', '')));

  if p_acao = 'fila' then
    if not public.vp_tem_capacidade('separacao', 'ver') then raise exception 'separação: sem alçada "ver"'; end if;
    select sla_horas into v_sla from public.separacao_tv_config where id;
    select coalesce(jsonb_agg(to_jsonb(y) - 'ordem' order by y.ordem, y.data_previsao nulls last, y.numero_pedido), '[]'::jsonb) into v_out from (
      select x.*,
             case when x.status_base = 'separado' then 'separado'
                  when x.status_base = 'em_separacao' and x.pendentes > 0 and x.sem_resolver = 0 then 'parcial'
                  else x.status_base end as status,
             case when x.status_base = 'separado' then 3
                  when x.status_base = 'em_separacao' and x.pendentes > 0 and x.sem_resolver = 0 then 2
                  when x.status_base = 'em_separacao' then 1 else 0 end as ordem
        from (
          select p.codigo_pedido, p.numero_pedido,
                 coalesce(nullif(btrim(p.cliente_fantasia), ''), p.cliente_nome) as cliente, p.data_previsao,
                 coalesce(p.entrada_em, p.atualizado_em) as entrada_em,
                 (select count(distinct upper(i.codigo)) from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido) as itens,
                 (select count(*) from (
                    select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                     where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t
                   where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                    where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0) >= t.pedida) as separados,
                 (select count(*) from public.estoque_separacao_pendencias q
                   where q.codigo_pedido = p.codigo_pedido and q.resolvido_em is null) as pendentes,
                 (select count(*) from (
                    select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                     where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t
                   where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                    where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0) < t.pedida
                     and not exists (select 1 from public.estoque_separacao_pendencias q
                                      where q.codigo_pedido = p.codigo_pedido and q.codigo = t.c and q.resolvido_em is null)) as sem_resolver,
                 case when s.codigo_pedido is null then 'livre' when s.status = 'separado' then 'separado'
                      when s.pego_por is null then 'livre' else 'em_separacao' end as status_base,
                 s.pego_por, s.pego_em, s.separado_por, s.separado_em, s.atualizado_em as parcial_desde,
                 s.status as status_tabela
            from public.pcp_pedidos p
            left join public.estoque_separacoes s on s.codigo_pedido = p.codigo_pedido
           where not p.cancelado
             and exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido)
             and ( (s.status = 'separado' and s.separado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                or (p.etapa = '20' and not p.faturado and coalesce(s.status, 'em_separacao') <> 'separado'
                    and not coalesce((select a.historico from public.pcp_pedido_acompanhamento a where a.numero_pedido = p.numero_pedido), false)) )
        ) x) y;
    -- decorrido (SLA do almoxarifado) para no "separado" e no "parcial"; espera = tempo desde que ficou parcial
    select coalesce(jsonb_agg(
             e || jsonb_build_object(
               'decorrido_min', round(public.inbox_horas_comerciais(
                   (e->>'entrada_em')::timestamptz,
                   case when e->>'status' = 'separado' then (e->>'separado_em')::timestamptz
                        when e->>'status' = 'parcial' then (e->>'parcial_desde')::timestamptz else now() end) * 60)::int,
               'espera_min', case when e->>'status' = 'parcial'
                                  then round(public.inbox_horas_comerciais((e->>'parcial_desde')::timestamptz, now()) * 60)::int end)
             order by ord), '[]'::jsonb) into v_out
      from jsonb_array_elements(v_out) with ordinality as t(e, ord);
    return jsonb_build_object('sla_min', round(v_sla * 60)::int, 'eu', v_email, 'pedidos', v_out);
  end if;

  if v_ped is null then raise exception 'separação: informe codigo_pedido'; end if;

  if p_acao = 'itens' then
    if not public.vp_tem_capacidade('separacao', 'ver') then raise exception 'separação: sem alçada "ver"'; end if;
    select * into v_ped_row from public.pcp_pedidos where codigo_pedido = v_ped;
    if not found then raise exception 'separação: pedido não encontrado'; end if;
    select * into v_sep from public.estoque_separacoes where codigo_pedido = v_ped;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.codigo), '[]'::jsonb) into v_out from (
      select t.codigo, max(t.descricao) as descricao, max(t.unidade) as unidade, sum(t.quantidade) as qtd_pedida,
             bool_or(t.item_pcp) as fabricado_pcp,
             coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                        where si.codigo_pedido = v_ped and si.codigo = t.codigo), 0) as qtd_separada,
             coalesce((select jsonb_agg(jsonb_build_object('endereco', si.endereco, 'qtd', si.qtd_separada) order by si.endereco)
                         from public.estoque_separacao_itens si
                        where si.codigo_pedido = v_ped and si.codigo = t.codigo and si.qtd_separada > 0), '[]'::jsonb) as separacoes,
             (select to_jsonb(q) - 'codigo_pedido' - 'codigo' - 'resolvido_em' - 'resolvido_por'
                from public.estoque_separacao_pendencias q
               where q.codigo_pedido = v_ped and q.codigo = t.codigo and q.resolvido_em is null) as pendencia,
             (select coalesce(jsonb_agg(distinct z.e), '[]'::jsonb) from (
                select public.estoque_endereco_normalizar(pp.endereco) e from public.pcp_produtos pp where upper(pp.codigo) = t.codigo
                union
                select si.endereco from public.estoque_separacao_itens si where si.codigo_pedido = v_ped and si.codigo = t.codigo) z
              where z.e is not null) as enderecos
        from (select upper(i.codigo) codigo, i.descricao, i.unidade, i.quantidade, i.item_pcp
                from public.pcp_pedido_itens i where i.codigo_pedido = v_ped) t
       group by t.codigo) x;
    return jsonb_build_object(
      'pedido', jsonb_build_object('codigo_pedido', v_ped, 'numero_pedido', v_ped_row.numero_pedido,
                 'cliente', coalesce(nullif(btrim(v_ped_row.cliente_fantasia), ''), v_ped_row.cliente_nome),
                 'etapa', v_ped_row.etapa,
                 'status', case when v_sep.codigo_pedido is null or (v_sep.status = 'em_separacao' and v_sep.pego_por is null) then 'livre' else v_sep.status end,
                 'pego_por', v_sep.pego_por, 'pego_em', v_sep.pego_em, 'separado_por', v_sep.separado_por, 'separado_em', v_sep.separado_em),
      'itens', v_out);
  end if;

  if p_acao in ('pegar', 'assumir', 'soltar', 'separar', 'concluir', 'pendenciar', 'resolver') then
    if not public.vp_tem_capacidade('estoque', 'saida') then
      raise exception 'separação: para separar é preciso a alçada "VP Estoque › Saída" (a mesma do celular)';
    end if;
  end if;

  if p_acao in ('pendenciar', 'resolver') then
    select * into v_sep from public.estoque_separacoes where codigo_pedido = v_ped for update;
    if not found or v_sep.status <> 'em_separacao' or v_sep.pego_por is distinct from lower(v_email) then
      raise exception 'separação: pegue o pedido antes (ou ele já foi concluído/está com outra pessoa)';
    end if;
    if v_cod = '' then raise exception 'separação: informe o código do item'; end if;
    select sum(i.quantidade) into v_pedida from public.pcp_pedido_itens i where i.codigo_pedido = v_ped and upper(i.codigo) = v_cod;
    if v_pedida is null then raise exception 'separação: o item % não faz parte deste pedido', v_cod; end if;

    if p_acao = 'pendenciar' then
      v_sit := coalesce(p_args->>'situacao', ''); v_obs := btrim(coalesce(p_args->>'obs', ''));
      if v_sit not in ('na_operacao', 'aguardando_chegada', 'falta') then raise exception 'separação: situação inválida'; end if;
      if length(v_obs) < 3 then raise exception 'separação: escreva a observação (por que este item não foi separado agora)'; end if;
      select coalesce(sum(si.qtd_separada), 0) into v_feita from public.estoque_separacao_itens si where si.codigo_pedido = v_ped and si.codigo = v_cod;
      if v_feita >= v_pedida then raise exception 'separação: o item % já está todo separado', v_cod; end if;
      update public.estoque_separacao_pendencias set situacao = v_sit, obs = v_obs, por = v_email, em = now()
       where codigo_pedido = v_ped and codigo = v_cod and resolvido_em is null;
      if not found then
        insert into public.estoque_separacao_pendencias (codigo_pedido, codigo, situacao, obs, por) values (v_ped, v_cod, v_sit, v_obs, v_email);
      end if;
      update public.estoque_separacoes set atualizado_em = now() where codigo_pedido = v_ped;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por, detalhe)
      values (v_ped, 'pendenciou', v_email, jsonb_build_object('codigo', v_cod, 'situacao', v_sit, 'obs', v_obs));
      return jsonb_build_object('ok', true);
    else
      update public.estoque_separacao_pendencias set resolvido_em = now(), resolvido_por = v_email
       where codigo_pedido = v_ped and codigo = v_cod and resolvido_em is null;
      get diagnostics v_n = row_count;
      if v_n > 0 then
        update public.estoque_separacoes set atualizado_em = now() where codigo_pedido = v_ped;
        insert into public.estoque_separacao_hist (codigo_pedido, acao, por, detalhe) values (v_ped, 'resolveu', v_email, jsonb_build_object('codigo', v_cod));
      end if;
      return jsonb_build_object('ok', true, 'resolvidas', v_n);
    end if;
  end if;

  if p_acao = 'separar' and v_cod <> '' then
    -- separar um item que estava pendente = ele chegou: a pendência se resolve junto
    update public.estoque_separacao_pendencias set resolvido_em = now(), resolvido_por = v_email
     where codigo_pedido = v_ped and codigo = v_cod and resolvido_em is null;
  end if;

  if p_acao = 'concluir' then
    select count(*) into v_n from public.estoque_separacao_pendencias
     where codigo_pedido = v_ped and resolvido_em is null and situacao in ('na_operacao', 'aguardando_chegada');
    if v_n > 0 then
      raise exception 'separação: ainda há % item(ns) na operação ou aguardando chegada — marque "Chegou" quando voltarem, ou deixe o pedido parcial', v_n;
    end if;
    select count(*) into v_n from (
      select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i where i.codigo_pedido = v_ped group by upper(i.codigo)) t
     where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si where si.codigo_pedido = v_ped and si.codigo = t.c), 0) < t.pedida
       and not exists (select 1 from public.estoque_separacao_pendencias q where q.codigo_pedido = v_ped and q.codigo = t.c and q.resolvido_em is null);
    if v_n > 0 then raise exception 'separação: % item(ns) sem separar e sem justificativa — separe ou marque a situação com observação', v_n; end if;
    v_forcar := exists (select 1 from public.estoque_separacao_pendencias where codigo_pedido = v_ped and resolvido_em is null);
    return public.estoque_separacao_chamar(v_email, 'concluir', p_args || jsonb_build_object('forcar', v_forcar));
  end if;

  if p_acao in ('pegar', 'assumir', 'soltar', 'separar') then
    return public.estoque_separacao_chamar(v_email, p_acao, p_args);
  end if;

  raise exception 'separação: ação desconhecida: %', p_acao;
end $$;

revoke execute on function public.separacao_hub(text, jsonb) from public, anon, authenticated;
grant execute on function public.separacao_hub(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Painel TV: coluna "parcial" (aguardando fabricação/chegada). O pedido parcial não conta como atrasado nem como pronto.
create or replace function public.separacao_tv_dados(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t public.separacao_tv_tokens%rowtype; v_sla numeric; v_sla_min int; v_hoje timestamptz; v_res jsonb;
begin
  if coalesce(length(p_token), 0) < 32 then return null; end if;
  select * into v_t from public.separacao_tv_tokens where token = p_token and ativo and revogado_em is null;
  if not found then return null; end if;
  if v_t.ultimo_acesso is null or v_t.ultimo_acesso < now() - interval '1 minute' then
    update public.separacao_tv_tokens set ultimo_acesso = now() where token = p_token;
  end if;
  select sla_horas into v_sla from public.separacao_tv_config where id;
  v_sla_min := round(v_sla * 60)::int;
  v_hoje := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  with b as (
    select p.codigo_pedido, p.numero_pedido, p.entrada_em as e0, p.atualizado_em as a0,
           s.status as st, s.pego_por, s.pego_em, s.separado_em, s.atualizado_em as parcial_desde,
           (select count(*) from public.estoque_separacao_pendencias q where q.codigo_pedido = p.codigo_pedido and q.resolvido_em is null) as pend,
           (select count(*) from (
              select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t
             where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0) < t.pedida
               and not exists (select 1 from public.estoque_separacao_pendencias q where q.codigo_pedido = p.codigo_pedido and q.codigo = t.c and q.resolvido_em is null)) as sem_resolver
      from public.pcp_pedidos p
      left join public.estoque_separacoes s on s.codigo_pedido = p.codigo_pedido
     where not p.cancelado
       and exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido)
       and ( (s.status = 'separado' and s.separado_em >= v_hoje)
          or (p.etapa = '20' and not p.faturado and coalesce(s.status, 'em_separacao') <> 'separado'
              and not coalesce((select a.historico from public.pcp_pedido_acompanhamento a where a.numero_pedido = p.numero_pedido), false)) )
  ), z as (
    select b.codigo_pedido as id, b.numero_pedido,
           case when b.st = 'separado' then 'separado'
                when b.st = 'em_separacao' and b.pego_por is not null and b.pend > 0 and b.sem_resolver = 0 then 'parcial'
                when b.pego_por is not null then 'em_separacao' else 'aguardando' end as status,
           case when b.st = 'separado' then 3
                when b.st = 'em_separacao' and b.pego_por is not null and b.pend > 0 and b.sem_resolver = 0 then 2
                when b.pego_por is not null then 1 else 0 end as ordem,
           coalesce(b.e0, b.a0) as entrada_em, b.pego_em, b.separado_em,
           round(public.inbox_horas_comerciais(coalesce(b.e0, b.a0),
                 case when b.st = 'separado' then b.separado_em
                      when b.st = 'em_separacao' and b.pego_por is not null and b.pend > 0 and b.sem_resolver = 0 then b.parcial_desde
                      else now() end) * 60)::int as decorrido_min,
           case when b.st = 'em_separacao' and b.pego_por is not null and b.pend > 0 and b.sem_resolver = 0
                then round(public.inbox_horas_comerciais(b.parcial_desde, now()) * 60)::int end as espera_min,
           (select coalesce(jsonb_agg(jsonb_build_object(
                     'codigo', t.c, 'pedida', t.pedida,
                     'separada', coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                            where si.codigo_pedido = b.codigo_pedido and si.codigo = t.c), 0),
                     'pendente', exists (select 1 from public.estoque_separacao_pendencias q
                                          where q.codigo_pedido = b.codigo_pedido and q.codigo = t.c and q.resolvido_em is null)) order by t.c), '[]'::jsonb)
              from (select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                     where i.codigo_pedido = b.codigo_pedido group by upper(i.codigo)) t) as itens
      from b
  ), y as (
    select z.*, row_number() over (partition by z.status order by case when z.status = 'separado' then z.separado_em end desc nulls last, z.entrada_em) as rn
      from z
  )
  select jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(to_jsonb(y) - 'ordem' - 'rn' order by y.ordem, y.entrada_em, y.numero_pedido)
                           from y where y.rn <= case y.status when 'aguardando' then 60 else 40 end), '[]'::jsonb),
    'totais', jsonb_build_object(
      'aguardando', (select count(*) from z where z.status = 'aguardando'),
      'em_separacao', (select count(*) from z where z.status = 'em_separacao'),
      'parcial', (select count(*) from z where z.status = 'parcial'),
      'separados', (select count(*) from z where z.status = 'separado'),
      'atrasados', (select count(*) from z where z.status in ('aguardando', 'em_separacao') and z.decorrido_min >= v_sla_min)))
    into v_res;

  return v_res || jsonb_build_object('agora', now(), 'sla_min', v_sla_min);
end $$;
revoke execute on function public.separacao_tv_dados(text) from public, anon, authenticated;
grant execute on function public.separacao_tv_dados(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Aviso: a fabricação do pedido (OP-mãe, frente 'pedido') foi concluída e o pedido tem pendência aberta no almoxarifado.
-- Só INSERE em alertas; falha engolida (nunca impede o PCP de concluir a OP). Líderes de Almoxarifado/Logística; sem líder, global.
create or replace function public.separacao_op_concluida_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_num text; v_em text; v_lideres text[]; v_n int := 0; v_id text;
begin
  if new.status = 'concluida' and old.status is distinct from new.status and new.frente = 'pedido' and new.pedido_codigo is not null
     and exists (select 1 from public.estoque_separacao_pendencias q where q.codigo_pedido = new.pedido_codigo and q.resolvido_em is null) then
    select numero_pedido into v_num from public.pcp_pedidos where codigo_pedido = new.pedido_codigo limit 1;
    v_id := 'sep-fabricacao-ok-' || new.pedido_codigo;
    select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
     where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%';
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id || '-' || left(md5(v_em), 6), 'info', 'Pedido ' || coalesce(v_num, new.pedido_codigo::text) || ': a fabricação terminou',
              'Pegue o que veio da operação, marque "Chegou" no pedido e conclua a separação.', 'Almoxarifado', false, v_em,
              '/logistica/separacao/pedidos/' || new.pedido_codigo)
      on conflict (id) do nothing;
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id, 'info', 'Pedido ' || coalesce(v_num, new.pedido_codigo::text) || ': a fabricação terminou',
              'Pegue o que veio da operação, marque "Chegou" no pedido e conclua a separação.', 'Almoxarifado', false,
              '/logistica/separacao/pedidos/' || new.pedido_codigo)
      on conflict (id) do nothing;
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.separacao_op_concluida_avisar() from public, anon, authenticated;

drop trigger if exists trg_separacao_op_concluida_avisar on public.pcp_ordens;
create trigger trg_separacao_op_concluida_avisar
  after update of status on public.pcp_ordens
  for each row execute function public.separacao_op_concluida_avisar();
