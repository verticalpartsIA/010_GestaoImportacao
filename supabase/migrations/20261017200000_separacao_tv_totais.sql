-- Painel TV da separação — achado da revisão automática do PR #938: os limites por status cortam as LINHAS devolvidas, mas a tela
-- calculava as contagens das colunas e o "fora do SLA" a partir dessas linhas, então subcontava quando uma coluna passava do limite.
-- Agora a RPC devolve também `totais` (sem corte): aguardando, em_separacao, separados e atrasados (aguardando/em separação com SLA estourado).
-- As linhas continuam limitadas (60 / 40 / 40) só para desenhar a tela.

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

  with z as (
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
  ), y as (
    select z.*, row_number() over (partition by z.status order by case when z.status = 'separado' then z.separado_em end desc nulls last, z.entrada_em) as rn
      from z
  )
  select jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(to_jsonb(y) - 'ordem' - 'rn' order by y.ordem, y.entrada_em, y.numero_pedido)
                           from y where y.rn <= case y.status when 'aguardando' then 60 when 'em_separacao' then 40 else 40 end), '[]'::jsonb),
    'totais', jsonb_build_object(
      'aguardando', (select count(*) from z where z.status = 'aguardando'),
      'em_separacao', (select count(*) from z where z.status = 'em_separacao'),
      'separados', (select count(*) from z where z.status = 'separado'),
      'atrasados', (select count(*) from z where z.status <> 'separado' and z.decorrido_min >= v_sla_min)))
    into v_res;

  return v_res || jsonb_build_object('agora', now(), 'sla_min', v_sla_min);
end $$;

revoke execute on function public.separacao_tv_dados(text) from public, anon, authenticated;
grant execute on function public.separacao_tv_dados(text) to anon, authenticated;
