-- O menu do HUB passa a seguir as alçadas também para quem não tinha nenhum grupo alocado (13/10/2026).
-- Antes: quem não tinha linha em colaborador_alocacoes via TODOS os grupos do menu (regra do shell.jsx),
-- e vpsistema_completar_alocacoes só agia sobre quem já tinha ao menos um grupo.
-- Aplicada em produção pelo MCP; este arquivo só registra o que está no ar.

-- Cópia de segurança antes de mexer.
create table if not exists public.colaborador_alocacoes_bak_20261013 as select * from public.colaborador_alocacoes;
alter table public.colaborador_alocacoes_bak_20261013 enable row level security;

-- grupos de menu que as alçadas da pessoa indicam (espelha MODULOS_POR_GRUPO_SIDEBAR do shell.jsx)
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
    ('Logística Interna','almoxarifado'),('Logística Interna','carga-maquina'),('Logística Interna','montagem-produto'),('Logística Interna','simulacao-producao'),('Logística Interna','pcp'),('Logística Interna','mes'),('Logística Interna','mes-cadastros'),('Logística Interna','relatorios-pcp'),('Logística Interna','expedicao'),
    ('Administração','logs'))
  select coalesce(array_agg(distinct m.grupo order by m.grupo), '{}'::text[])
  from public.alcadas_capacidade a join mapa m on m.modulo = a.modulo
  where a.perfil_id = p_perfil
$$;
revoke all on function public.vpsistema_grupos_das_alcadas(uuid) from public, anon, authenticated;

-- Regras (chamada no fim de cada sincronização de alçadas):
--  • sem linha no espelho de colaboradores ou perfil inativo → nada;
--  • Administrador do HUB → nada (já vê todo o menu);
--  • acrescenta os grupos que as alçadas indicam (nunca remove grupo já alocado);
--  • quem não tinha nenhum grupo e não tem alçada em módulo de nenhum grupo fica só com "Geral"
--    (marcador __acesso_restrito__); o marcador sai sozinho quando passa a ter algum grupo.
create or replace function public.vpsistema_completar_alocacoes(p_perfil uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  n int := 0;
  v_n int;
  grupos text[];
  tinha boolean;
begin
  if not exists (select 1 from public.colaboradores_vpsistema where id = p_perfil) then return 0; end if;
  if not exists (select 1 from public.perfis where id = p_perfil and ativo) then return 0; end if;
  if exists (select 1 from public.perfis where id = p_perfil and nivel = 'Administrador') then return 0; end if;

  grupos := public.vpsistema_grupos_das_alcadas(p_perfil);
  tinha := exists (select 1 from public.colaborador_alocacoes where colaborador_id = p_perfil);

  if cardinality(grupos) > 0 then
    insert into public.colaborador_alocacoes (colaborador_id, grupo_modulo, alocado_por)
    select p_perfil, g, 'vpsistema (alçadas)' from unnest(grupos) g
    on conflict (colaborador_id, grupo_modulo) do nothing;
    get diagnostics n = row_count;
    delete from public.colaborador_alocacoes where colaborador_id = p_perfil and grupo_modulo = '__acesso_restrito__';
  elsif not tinha then
    insert into public.colaborador_alocacoes (colaborador_id, grupo_modulo, alocado_por)
    values (p_perfil, '__acesso_restrito__', 'vpsistema (alçadas)')
    on conflict (colaborador_id, grupo_modulo) do nothing;
    get diagnostics v_n = row_count;
    n := v_n;
  end if;
  return n;
end;
$$;
revoke all on function public.vpsistema_completar_alocacoes(uuid) from public, anon, authenticated;

-- Carga inicial: quem estava sem nenhum grupo alocado (fonte de verdade = alçadas declaradas).
select public.vpsistema_completar_alocacoes(p.id)
from public.perfis p
where p.ativo and not exists (select 1 from public.colaborador_alocacoes a where a.colaborador_id = p.id);
