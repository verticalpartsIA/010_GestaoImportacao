-- Painel TV da SEPARAÇÃO de pedidos de venda (hub). Decisões do Gelson em 17/10/2026:
--   * Link público com TOKEN (a TV não faz login): /separacao-tv/<token>. Cada link tem nome, pode ser revogado e guarda o último acesso.
--   * Atualiza a cada 30 s (a página consulta a RPC abaixo). Mostra só nº do pedido, status, SLA e CÓDIGOS de produto
--     (nada de cliente, descrição, valor nem nome de quem separa).
--   * SLA da separação = horas úteis (seg–sex, 08–18h Brasília, mesma conta de inbox_horas_comerciais) entre o pedido
--     ENTRAR no hub (pcp_pedidos.entrada_em = quando o cron o leu do Omie na etapa 20; atraso máx. ~30 min) e o "separado"
--     (estoque_separacoes.separado_em); enquanto não separa, conta até agora. Meta padrão 4 h úteis — valor ESCOLHIDO por mim,
--     o usuário não informou; editável em separacao_tv_config (tela interna Logística › Separação).
-- Tabelas nascem FECHADAS (RLS sem política). Anon só executa separacao_tv_dados (exige token válido); o resto é só para usuário logado
-- com a alçada separacao.ver / separacao.editar.

create table if not exists public.separacao_tv_tokens (
  token text primary key,
  nome text not null,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  ultimo_acesso timestamptz
);

create table if not exists public.separacao_tv_config (
  id boolean primary key default true check (id),
  sla_horas numeric not null default 4 check (sla_horas > 0 and sla_horas <= 72),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into public.separacao_tv_config (id) values (true) on conflict do nothing;

alter table public.separacao_tv_tokens enable row level security;
alter table public.separacao_tv_config enable row level security;
revoke all on public.separacao_tv_tokens, public.separacao_tv_config from anon, authenticated;
grant all on public.separacao_tv_tokens, public.separacao_tv_config to service_role;

-- ---------- Leitura da TV (token) ----------
create or replace function public.separacao_tv_dados(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t public.separacao_tv_tokens%rowtype; v_sla numeric; v_hoje timestamptz; v_out jsonb;
begin
  if coalesce(length(p_token), 0) < 32 then return null; end if;
  select * into v_t from public.separacao_tv_tokens where token = p_token and ativo and revogado_em is null;
  if not found then return null; end if;
  if v_t.ultimo_acesso is null or v_t.ultimo_acesso < now() - interval '1 minute' then
    update public.separacao_tv_tokens set ultimo_acesso = now() where token = p_token;
  end if;
  select sla_horas into v_sla from public.separacao_tv_config where id;
  v_hoje := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  select coalesce(jsonb_agg(to_jsonb(x) - 'ordem' order by x.ordem, x.entrada_em, x.numero_pedido), '[]'::jsonb) into v_out from (
    select p.codigo_pedido as id, p.numero_pedido,
           case when s.status = 'separado' then 'separado' when s.pego_por is not null then 'em_separacao' else 'aguardando' end as status,
           case when s.status = 'separado' then 2 when s.pego_por is not null then 1 else 0 end as ordem,
           coalesce(p.entrada_em, p.atualizado_em) as entrada_em, s.pego_em, s.separado_em,
           round(public.inbox_horas_comerciais(coalesce(p.entrada_em, p.atualizado_em), coalesce(s.separado_em, now())) * 60)::int as decorrido_min,
           (select coalesce(jsonb_agg(jsonb_build_object(
                     'codigo', t.c, 'pedida', t.pedida,
                     'separada', coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                            where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0)) order by t.c), '[]'::jsonb)
              from (select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                     where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t) as itens
      from public.pcp_pedidos p
      left join public.estoque_separacoes s on s.codigo_pedido = p.codigo_pedido
     where not p.cancelado
       and exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido)
       and ( (s.status = 'separado' and s.separado_em >= v_hoje)
          or (p.etapa = '20' and not p.faturado and coalesce(s.status, 'em_separacao') <> 'separado'
              and not coalesce((select a.historico from public.pcp_pedido_acompanhamento a where a.numero_pedido = p.numero_pedido), false)) )
     order by case when s.status = 'separado' then 2 when s.pego_por is not null then 1 else 0 end, coalesce(p.entrada_em, p.atualizado_em)
     limit 80) x;

  return jsonb_build_object('agora', now(), 'sla_min', round(v_sla * 60)::int, 'pedidos', v_out);
end $$;

-- ---------- Gestão dos links (usuário logado + alçada) ----------
create or replace function public.separacao_tv_listar() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() or not public.vp_tem_capacidade('separacao', 'ver') then
    raise exception 'separação: sem alçada "ver"';
  end if;
  return jsonb_build_object(
    'sla_horas', (select sla_horas from public.separacao_tv_config where id),
    'links', coalesce((select jsonb_agg(jsonb_build_object('token', token, 'nome', nome, 'criado_por', criado_por, 'criado_em', criado_em,
                              'ultimo_acesso', ultimo_acesso) order by criado_em desc)
                         from public.separacao_tv_tokens where ativo and revogado_em is null), '[]'::jsonb));
end $$;

create or replace function public.separacao_tv_gerar(p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_nome text := left(btrim(coalesce(p_nome, '')), 60);
begin
  if not public.vp_usuario_ativo() or not public.vp_tem_capacidade('separacao', 'editar') then
    raise exception 'separação: sem alçada "editar"';
  end if;
  if v_nome = '' then raise exception 'separação: informe um nome para o link (ex.: TV do almoxarifado)'; end if;
  insert into public.separacao_tv_tokens (token, nome, criado_por) values (v_tok, v_nome, public.vp_email());
  return jsonb_build_object('token', v_tok, 'nome', v_nome);
end $$;

create or replace function public.separacao_tv_revogar(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.vp_usuario_ativo() or not public.vp_tem_capacidade('separacao', 'editar') then
    raise exception 'separação: sem alçada "editar"';
  end if;
  update public.separacao_tv_tokens set ativo = false, revogado_em = now() where token = p_token and ativo;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

create or replace function public.separacao_tv_config_salvar(p_sla_horas numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() or not public.vp_tem_capacidade('separacao', 'editar') then
    raise exception 'separação: sem alçada "editar"';
  end if;
  if p_sla_horas is null or p_sla_horas <= 0 or p_sla_horas > 72 then raise exception 'separação: SLA deve ficar entre 0 e 72 horas'; end if;
  update public.separacao_tv_config set sla_horas = p_sla_horas, atualizado_em = now(), atualizado_por = public.vp_email() where id;
  return jsonb_build_object('ok', true, 'sla_horas', p_sla_horas);
end $$;

revoke execute on function public.separacao_tv_dados(text), public.separacao_tv_listar(), public.separacao_tv_gerar(text),
  public.separacao_tv_revogar(text), public.separacao_tv_config_salvar(numeric) from public, anon, authenticated;
grant execute on function public.separacao_tv_dados(text) to anon, authenticated;
grant execute on function public.separacao_tv_listar(), public.separacao_tv_gerar(text), public.separacao_tv_revogar(text),
  public.separacao_tv_config_salvar(numeric) to authenticated;
