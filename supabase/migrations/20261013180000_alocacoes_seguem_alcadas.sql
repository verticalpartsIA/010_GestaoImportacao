-- Menu do HUB (colaborador_alocacoes) passa a acompanhar as alçadas que o vpsistema declara (13/10/2026).
-- Já aplicada em produção (projeto jxtqwzmpgofwctqajewt).
--
-- Problema: o menu lateral (shell.jsx › grupoVisivel) lê SÓ colaborador_alocacoes; as alçadas
-- (alcadas_capacidade, alimentadas pelo vpsistema) não faziam nenhum grupo aparecer. Quem tinha
-- alçada num módulo mas não tinha o grupo alocado não via o módulo no menu.
--
-- ADITIVO: só para quem já usa o filtro de menu (>= 1 grupo alocado) e só ACRESCENTA grupos que as
-- alçadas indicam; nunca remove. Quem tem 0 alocações continua vendo todos os grupos (regra do shell.jsx).
-- O mapa grupo -> módulos espelha MODULOS_POR_GRUPO_SIDEBAR de src/colaboradores-admin-store.js:
-- se um módulo mudar de grupo lá, mudar aqui também.

create or replace function public.vpsistema_completar_alocacoes(p_perfil uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare n int := 0;
begin
  if not exists (select 1 from public.colaboradores_vpsistema where id = p_perfil) then return 0; end if;
  if not exists (select 1 from public.colaborador_alocacoes where colaborador_id = p_perfil) then return 0; end if;
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
    ('Logística Interna','almoxarifado'),('Logística Interna','carga-maquina'),('Logística Interna','montagem-produto'),('Logística Interna','simulacao-producao'),('Logística Interna','pcp'),('Logística Interna','mes'),('Logística Interna','mes-cadastros'),('Logística Interna','relatorios-pcp'),('Logística Interna','expedicao'),
    ('Administração','logs')),
  novos as (
    select distinct m.grupo from public.alcadas_capacidade a join mapa m on m.modulo = a.modulo where a.perfil_id = p_perfil)
  insert into public.colaborador_alocacoes (colaborador_id, grupo_modulo, alocado_por)
  select p_perfil, grupo, 'vpsistema (alçadas)' from novos
  on conflict (colaborador_id, grupo_modulo) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.vpsistema_completar_alocacoes(uuid) from public, anon, authenticated;

-- vpsistema_set_alcadas igual ao anterior + completar o menu no fim (falha do menu nunca derruba a sincronização)
create or replace function public.vpsistema_set_alcadas(p_email text, p_caps text[], p_modulos text[])
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  pid   uuid;
  n_del int;
  n_ins int;
  n_aloc int := 0;
begin
  select id into pid from public.perfis where lower(email) = lower(p_email) limit 1;
  if pid is null then
    return jsonb_build_object('ok', false, 'email', p_email, 'motivo', 'sem_perfil_no_hub');
  end if;

  delete from public.alcadas_capacidade
  where perfil_id = pid
    and modulo = any (p_modulos)
    and not ((modulo || '.' || capacidade) = any (coalesce(p_caps, '{}')));
  get diagnostics n_del = row_count;

  insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por, concedido_em)
  select pid, split_part(c, '.', 1), split_part(c, '.', 2), 'vpsistema', now()
  from unnest(coalesce(p_caps, '{}')) as c
  on conflict (perfil_id, modulo, capacidade) do nothing;
  get diagnostics n_ins = row_count;

  begin
    n_aloc := public.vpsistema_completar_alocacoes(pid);
  exception when others then
    raise warning 'vpsistema_completar_alocacoes falhou para %: %', p_email, sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'email', p_email, 'removidas', n_del, 'incluidas', n_ins, 'grupos_menu_incluidos', n_aloc);
end;
$$;

-- Ajuste único (já feito em produção em 13/10/2026): 7 pessoas ganharam 19 grupos no menu.
-- select p.id, public.vpsistema_completar_alocacoes(p.id) from public.perfis p where p.ativo;
