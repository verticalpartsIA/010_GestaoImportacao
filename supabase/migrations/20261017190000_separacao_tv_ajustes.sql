-- Painel TV da separação — correções da revisão automática do PR #937:
--  1) o limite de 80 linhas valia para o conjunto todo (aguardando + em separação + separados): uma fila grande expulsava os "separados hoje"
--     e a TV os tratava como "saiu da fila". Agora o limite é POR STATUS (60 aguardando, 40 em separação, 40 separados mais recentes).
--  2) o grupo de menu "Logística Interna" passa a incluir o módulo separacao no mapa alçada → menu (quem só tem Separação › Ver/Editar vê o item).

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

  select coalesce(jsonb_agg(to_jsonb(x) - 'ordem' - 'rn' order by x.ordem, x.entrada_em, x.numero_pedido), '[]'::jsonb) into v_out from (
    select y.* from (select z.*, row_number() over (partition by z.status order by case when z.status = 'separado' then z.separado_em end desc nulls last, z.entrada_em) as rn from (
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
     ) z) y where y.rn <= case y.status when 'aguardando' then 60 when 'em_separacao' then 40 else 40 end) x;

  return jsonb_build_object('agora', now(), 'sla_min', round(v_sla * 60)::int, 'pedidos', v_out);
end $$;

revoke execute on function public.separacao_tv_dados(text) from public, anon, authenticated;
grant execute on function public.separacao_tv_dados(text) to anon, authenticated;

create or replace function public.vpsistema_grupos_das_alcadas(p_perfil uuid)
returns text[]
language sql stable security definer
set search_path = public
as $$
  with mapa(grupo, modulo) as (values
    ('CRM','leads'),
    ('Cadastros Mestres','cadastro-clientes'),('Cadastros Mestres','cadastro-fornecedores'),('Cadastros Mestres','cadastro-materias-primas'),('Cadastros Mestres','cadastro-produtos'),
    ('Comercial | Pré-venda','formularios'),('Comercial | Pré-venda','controle-cotacoes'),('Comercial | Pré-venda','cotacoes-fornecedor'),('Comercial | Pré-venda','propostas'),('Comercial | Pré-venda','contratos-sociais'),
    ('Financeiro & Preços','cadastro-custos'),('Financeiro & Preços','precificacao'),('Financeiro & Preços','aval-financeiro'),('Financeiro & Preços','emissao-nf'),
    ('Contratos & Jurídico','contrato-venda-equipamentos'),('Contratos & Jurídico','aval-juridico'),('Contratos & Jurídico','juridico'),
    ('Suprimentos & Importação','importacao'),('Suprimentos & Importação','gi-painel'),('Suprimentos & Importação','pi-importacao'),('Suprimentos & Importação','rfq-importacao'),('Suprimentos & Importação','ims-importacao'),('Suprimentos & Importação','embarques-importacao'),('Suprimentos & Importação','gi-analise-precos'),('Suprimentos & Importação','compras'),('Suprimentos & Importação','pedidos-acompanhamento'),
    ('Engenharia & Produto','engenharia'),('Engenharia & Produto','eng-projeto-elevadores'),('Engenharia & Produto','eng-configurador'),('Engenharia & Produto','desenho-tecnico'),('Engenharia & Produto','solicitacoes-produto'),('Engenharia & Produto','ficha-tecnica'),('Engenharia & Produto','ncm-catalogo'),('Engenharia & Produto','linha-do-tempo'),
    ('Obras & Instalação','status-obras'),('Obras & Instalação','vistorias'),('Obras & Instalação','instalacao'),('Obras & Instalação','cronograma'),('Obras & Instalação','art'),
    ('Entrega & Documentação','databook'),('Entrega & Documentação','handover'),
    ('Parceiros & Instaladores','cadastro-instaladores'),('Parceiros & Instaladores','rh-homologacao'),('Parceiros & Instaladores','contrato-instalador'),
    ('Logística Interna','almoxarifado'),('Logística Interna','carga-maquina'),('Logística Interna','montagem-produto'),('Logística Interna','simulacao-producao'),('Logística Interna','pcp'),('Logística Interna','mes'),('Logística Interna','mes-cadastros'),('Logística Interna','relatorios-pcp'),('Logística Interna','expedicao'),('Logística Interna','separacao'),
    ('Administração','logs'))
  select coalesce(array_agg(distinct m.grupo order by m.grupo), '{}'::text[])
  from public.alcadas_capacidade a join mapa m on m.modulo = a.modulo
  where a.perfil_id = p_perfil
$$;
revoke all on function public.vpsistema_grupos_das_alcadas(uuid) from public, anon, authenticated;
