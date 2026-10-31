-- Verificação depois de aplicar 20261101000000_fecha_delete_anon_56_tabelas (somente leitura). TODA linha deve devolver ok = true.
-- Roda via MCP SQL ou psql. Não escreve nada.
with alvo(tabela) as (values
    ('acompanhamento_obra_itens'),
    ('acompanhamento_obra_lancamentos'),
    ('acompanhamento_obra_links'),
    ('acompanhamento_obra_status'),
    ('avais_financeiros'),
    ('avais_juridicos'),
    ('contract_drafts'),
    ('contrato_instalador_parcelas'),
    ('convites'),
    ('cotacao_custos_reais'),
    ('cotacoes_elevador_fornecedor'),
    ('cotacoes_elevador_historico'),
    ('elevador_modelo_opcoes'),
    ('elevador_modelos'),
    ('elevador_opcoes'),
    ('equipamentos_spec'),
    ('equipe_checklist'),
    ('eventos_fluxo'),
    ('fabricacao_quadro_fiacao_itens'),
    ('fabricacao_quadro_fiacao_status'),
    ('fabricacao_quadro_itens'),
    ('fabricacao_quadro_links'),
    ('fabricacao_quadro_ocorrencias'),
    ('fabricacao_quadro_status'),
    ('fichas_relatorio_confiabilidade'),
    ('formularios_elevador'),
    ('fornecedores_elevador'),
    ('importacao_varejo_estoque'),
    ('importacao_varejo_fornecedor'),
    ('importacao_varejo_giro'),
    ('importacao_varejo_giro_staging'),
    ('importacao_varejo_lote_config'),
    ('importacao_varejo_produtos'),
    ('importacao_varejo_sync_cursor'),
    ('instalacao_checklist_itens'),
    ('instalacao_checklist_templates'),
    ('materiais_catalogo'),
    ('minutas'),
    ('notificacoes_lidas'),
    ('operadores_estrangeiros'),
    ('parametros_fiscais_elevador'),
    ('parceiros_doc_catalogo'),
    ('parceiros_documentos_empresa'),
    ('pcp_ordem_etapas'),
    ('precificacoes_elevador'),
    ('produtos'),
    ('projetos_elevador'),
    ('proposta_itens'),
    ('quadros_comando'),
    ('quadros_comando_checklist_separacao'),
    ('quadros_comando_componentes'),
    ('quadros_comando_geometria'),
    ('quadros_comando_maquina'),
    ('solicitacoes_produto'),
    ('tratativas_cotacao'),
    ('vistorias_obras')
),
pol as (
  select c.relname as tabela, p.polcmd as cmd,
         (p.polqual is null or pg_get_expr(p.polqual, p.polrelid) = 'true')
           and (p.polwithcheck is null or pg_get_expr(p.polwithcheck, p.polrelid) = 'true') as aberta
  from pg_policy p join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where p.polpermissive and (0 = any(p.polroles) or (select oid from pg_roles where rolname = 'anon') = any(p.polroles))
)
select 'nenhuma das 56 ainda apaga para o anon' as caso,
       count(*) filter (where exists (select 1 from pol where pol.tabela = alvo.tabela and pol.aberta and pol.cmd in ('d', '*'))) = 0 as ok,
       count(*) filter (where exists (select 1 from pol where pol.tabela = alvo.tabela and pol.aberta and pol.cmd in ('d', '*'))) as detalhe
from alvo
union all
select 'as 56 mantêm SELECT, INSERT e UPDATE para o anon',
       count(*) filter (where not (exists (select 1 from pol where pol.tabela = alvo.tabela and pol.aberta and pol.cmd in ('r', '*'))
                               and exists (select 1 from pol where pol.tabela = alvo.tabela and pol.aberta and pol.cmd in ('a', '*'))
                               and exists (select 1 from pol where pol.tabela = alvo.tabela and pol.aberta and pol.cmd in ('w', '*')))) = 0,
       count(*)
from alvo
union all
select 'backup da onda gravado (uma linha por tabela)',
       (select count(*) from public.vp_policy_backup where onda = 'delete_anon_20261101') = 56,
       (select count(*) from public.vp_policy_backup where onda = 'delete_anon_20261101')
union all
select 'as 6 tabelas excluídas seguem intocadas (ainda têm política aberta que apaga)',
       (select count(distinct tabela) from pol where tabela in ('emails_projeto','inbox_estado_pessoa','custos_frete_interno','custos_frete_observacoes','custos_instalacao_escada_esteira','difal_estados') and aberta and cmd in ('d', '*')) = 6,
       (select count(distinct tabela) from pol where tabela in ('emails_projeto','inbox_estado_pessoa','custos_frete_interno','custos_frete_observacoes','custos_instalacao_escada_esteira','difal_estados') and aberta and cmd in ('d', '*'));
