-- #571 (segurança real) — fecha o DELETE do papel anônimo em 56 tabelas. Gelson, 01/11/2026.
--
-- O quê: o front-end (src/, server-lib/, páginas HTML) nunca apaga linhas dessas 56 tabelas — conferido por busca no
-- código em 31/10/2026 — mas elas ainda aceitam DELETE da chave pública. Esta migration tira só o DELETE:
--   A) 19 tabelas com política FOR DELETE própria: a política é removida;
--   B) 10 tabelas com política ALL para 'public' e C) 27 com política ALL para 'anon': a ALL é trocada por
--      SELECT + INSERT + UPDATE com as MESMAS condições (true). Leitura, inserção e alteração não mudam.
-- Não toca: papel 'authenticated' (as políticas dele ficam como estão), service_role (ignora RLS), concessões
-- (GRANT), nenhuma outra tabela. Ficam de fora, por serem área blindada ou trava por "Confirmo" (CLAUDE.md, Art. 15):
-- emails_projeto e inbox_estado_pessoa (E-mail/Inbox); custos_frete_interno, custos_frete_observacoes,
-- custos_instalacao_escada_esteira e difal_estados (Atualização de Custos).
--
-- Backup: as políticas removidas são gravadas em vp_policy_backup (onda 'delete_anon_20261101') ANTES de serem removidas.
-- Reverter: supabase/rollback/20261101000000_fecha_delete_anon_56_tabelas.sql (ou vp_reabrir_tabela(<tabela>)).
-- Verificar depois: supabase/tests/rls/fecha_delete_anon_56_tabelas.sql
-- Só se aplica com "Confirmo" do Gelson para esta mudança (CLAUDE.md, Art. 14 e 31).

set local lock_timeout = '5s';

-- Trava: aborta sem mexer em nada se alguma política esperada não existir como está (nome, comando, papéis,
-- permissiva e ainda totalmente aberta). Evita reabrir por engano uma tabela que alguém já fechou ou alterou.
do $$
declare faltando text;
begin
  if to_regclass('public.vp_policy_backup') is null then
    raise exception 'vp_policy_backup não existe: não dá para guardar o backup';
  end if;
  select string_agg(e.tabela || '.' || e.politica, ', ') into faltando
  from (values
    ('avais_financeiros','af_delete','DELETE','public'),
    ('avais_juridicos','aj_delete','DELETE','public'),
    ('cotacao_custos_reais','ccr_delete','DELETE','public'),
    ('equipamentos_spec','eq_delete','DELETE','public'),
    ('eventos_fluxo','ef_delete','DELETE','public'),
    ('importacao_varejo_estoque','iv_estoque_delete','DELETE','public'),
    ('importacao_varejo_fornecedor','iv_fornecedor_delete','DELETE','public'),
    ('importacao_varejo_giro','iv_giro_delete','DELETE','public'),
    ('importacao_varejo_giro_staging','iv_girostg_delete','DELETE','public'),
    ('importacao_varejo_lote_config','iv_lote_delete','DELETE','public'),
    ('importacao_varejo_produtos','iv_produtos_delete','DELETE','public'),
    ('importacao_varejo_sync_cursor','iv_cursor_delete','DELETE','public'),
    ('instalacao_checklist_itens','delete_anon','DELETE','public'),
    ('instalacao_checklist_templates','delete_anon','DELETE','public'),
    ('operadores_estrangeiros','oe_delete','DELETE','public'),
    ('pcp_ordem_etapas','pcp_ordem_etapas_delete','DELETE','public'),
    ('projetos_elevador','projetos_elevador_delete','DELETE','public'),
    ('tratativas_cotacao','tratativas_cotacao_delete','DELETE','public'),
    ('vistorias_obras','delete_anon','DELETE','public'),
    ('acompanhamento_obra_itens','allow_all_acomp_obra_itens','ALL','public'),
    ('acompanhamento_obra_lancamentos','allow_all_acomp_obra_lancamentos','ALL','public'),
    ('acompanhamento_obra_links','allow_all_acomp_obra_links','ALL','public'),
    ('acompanhamento_obra_status','allow_all_acomp_obra_status','ALL','public'),
    ('fabricacao_quadro_fiacao_itens','allow_all_fab_quadro_fiacao_itens','ALL','public'),
    ('fabricacao_quadro_fiacao_status','allow_all_fab_quadro_fiacao_status','ALL','public'),
    ('fabricacao_quadro_itens','allow_all_fab_quadro_itens','ALL','public'),
    ('fabricacao_quadro_links','allow_all_fab_quadro_links','ALL','public'),
    ('fabricacao_quadro_ocorrencias','allow_all_fab_quadro_ocorrencias','ALL','public'),
    ('fabricacao_quadro_status','allow_all_fab_quadro_status','ALL','public'),
    ('contract_drafts','contract_drafts_all_anon','ALL','anon'),
    ('contrato_instalador_parcelas','contrato_instalador_parcelas_anon_all','ALL','anon'),
    ('convites','convites_anon_all','ALL','anon'),
    ('cotacoes_elevador_fornecedor','cotacoes_elevador_fornecedor_all_anon','ALL','anon'),
    ('cotacoes_elevador_historico','cotacoes_elevador_historico_all_anon','ALL','anon'),
    ('elevador_modelo_opcoes','elevador_modelo_opcoes_all_anon','ALL','anon'),
    ('elevador_modelos','elevador_modelos_all_anon','ALL','anon'),
    ('elevador_opcoes','elevador_opcoes_all_anon','ALL','anon'),
    ('equipe_checklist','equipe_checklist_anon_all','ALL','anon'),
    ('fichas_relatorio_confiabilidade','frc_all_anon','ALL','anon'),
    ('formularios_elevador','formularios_elevador_all_anon','ALL','anon'),
    ('fornecedores_elevador','fornecedores_elevador_all_anon','ALL','anon'),
    ('materiais_catalogo','materiais_catalogo_anon_all','ALL','anon'),
    ('minutas','minutas_all_anon','ALL','anon'),
    ('notificacoes_lidas','notificacoes_lidas_anon_all','ALL','anon'),
    ('parametros_fiscais_elevador','parametros_fiscais_elevador_all_anon','ALL','anon'),
    ('parceiros_doc_catalogo','parceiros_doc_catalogo_anon_all','ALL','anon'),
    ('parceiros_documentos_empresa','parceiros_documentos_empresa_anon_all','ALL','anon'),
    ('precificacoes_elevador','precificacoes_elevador_all_anon','ALL','anon'),
    ('produtos','produtos_all_anon','ALL','anon'),
    ('proposta_itens','proposta_itens_all_anon','ALL','anon'),
    ('quadros_comando','quadros_comando_anon_all','ALL','anon'),
    ('quadros_comando_checklist_separacao','qc_checklist_anon_all','ALL','anon'),
    ('quadros_comando_componentes','quadros_comando_componentes_anon_all','ALL','anon'),
    ('quadros_comando_geometria','qc_geometria_anon_all','ALL','anon'),
    ('quadros_comando_maquina','qc_maquina_anon_all','ALL','anon'),
    ('solicitacoes_produto','solicitacoes_produto_all_anon','ALL','anon')
  ) as e(tabela, politica, cmd, papeis)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = e.tabela and p.policyname = e.politica
      and p.cmd = e.cmd and array_to_string(p.roles, ',') = e.papeis and p.permissive = 'PERMISSIVE'
      and coalesce(p.qual, 'true') = 'true' and coalesce(p.with_check, 'true') = 'true');
  if faltando is not null then
    raise exception 'Política(s) esperada(s) ausente(s) ou diferente(s) do inventário de 31/10/2026: %', faltando;
  end if;
end $$;

-- Backup das políticas que serão removidas (mesmo formato do vp_fechar_tabela; vp_reabrir_tabela restaura daqui).
insert into public.vp_policy_backup (tabela, polname, cmd, roles, qual, with_check, onda, salvo_em)
select p.tablename, p.policyname, p.cmd, p.roles::text[], p.qual, p.with_check, 'delete_anon_20261101', now()
from pg_policies p
join (values
    ('avais_financeiros','af_delete','DELETE','public'),
    ('avais_juridicos','aj_delete','DELETE','public'),
    ('cotacao_custos_reais','ccr_delete','DELETE','public'),
    ('equipamentos_spec','eq_delete','DELETE','public'),
    ('eventos_fluxo','ef_delete','DELETE','public'),
    ('importacao_varejo_estoque','iv_estoque_delete','DELETE','public'),
    ('importacao_varejo_fornecedor','iv_fornecedor_delete','DELETE','public'),
    ('importacao_varejo_giro','iv_giro_delete','DELETE','public'),
    ('importacao_varejo_giro_staging','iv_girostg_delete','DELETE','public'),
    ('importacao_varejo_lote_config','iv_lote_delete','DELETE','public'),
    ('importacao_varejo_produtos','iv_produtos_delete','DELETE','public'),
    ('importacao_varejo_sync_cursor','iv_cursor_delete','DELETE','public'),
    ('instalacao_checklist_itens','delete_anon','DELETE','public'),
    ('instalacao_checklist_templates','delete_anon','DELETE','public'),
    ('operadores_estrangeiros','oe_delete','DELETE','public'),
    ('pcp_ordem_etapas','pcp_ordem_etapas_delete','DELETE','public'),
    ('projetos_elevador','projetos_elevador_delete','DELETE','public'),
    ('tratativas_cotacao','tratativas_cotacao_delete','DELETE','public'),
    ('vistorias_obras','delete_anon','DELETE','public'),
    ('acompanhamento_obra_itens','allow_all_acomp_obra_itens','ALL','public'),
    ('acompanhamento_obra_lancamentos','allow_all_acomp_obra_lancamentos','ALL','public'),
    ('acompanhamento_obra_links','allow_all_acomp_obra_links','ALL','public'),
    ('acompanhamento_obra_status','allow_all_acomp_obra_status','ALL','public'),
    ('fabricacao_quadro_fiacao_itens','allow_all_fab_quadro_fiacao_itens','ALL','public'),
    ('fabricacao_quadro_fiacao_status','allow_all_fab_quadro_fiacao_status','ALL','public'),
    ('fabricacao_quadro_itens','allow_all_fab_quadro_itens','ALL','public'),
    ('fabricacao_quadro_links','allow_all_fab_quadro_links','ALL','public'),
    ('fabricacao_quadro_ocorrencias','allow_all_fab_quadro_ocorrencias','ALL','public'),
    ('fabricacao_quadro_status','allow_all_fab_quadro_status','ALL','public'),
    ('contract_drafts','contract_drafts_all_anon','ALL','anon'),
    ('contrato_instalador_parcelas','contrato_instalador_parcelas_anon_all','ALL','anon'),
    ('convites','convites_anon_all','ALL','anon'),
    ('cotacoes_elevador_fornecedor','cotacoes_elevador_fornecedor_all_anon','ALL','anon'),
    ('cotacoes_elevador_historico','cotacoes_elevador_historico_all_anon','ALL','anon'),
    ('elevador_modelo_opcoes','elevador_modelo_opcoes_all_anon','ALL','anon'),
    ('elevador_modelos','elevador_modelos_all_anon','ALL','anon'),
    ('elevador_opcoes','elevador_opcoes_all_anon','ALL','anon'),
    ('equipe_checklist','equipe_checklist_anon_all','ALL','anon'),
    ('fichas_relatorio_confiabilidade','frc_all_anon','ALL','anon'),
    ('formularios_elevador','formularios_elevador_all_anon','ALL','anon'),
    ('fornecedores_elevador','fornecedores_elevador_all_anon','ALL','anon'),
    ('materiais_catalogo','materiais_catalogo_anon_all','ALL','anon'),
    ('minutas','minutas_all_anon','ALL','anon'),
    ('notificacoes_lidas','notificacoes_lidas_anon_all','ALL','anon'),
    ('parametros_fiscais_elevador','parametros_fiscais_elevador_all_anon','ALL','anon'),
    ('parceiros_doc_catalogo','parceiros_doc_catalogo_anon_all','ALL','anon'),
    ('parceiros_documentos_empresa','parceiros_documentos_empresa_anon_all','ALL','anon'),
    ('precificacoes_elevador','precificacoes_elevador_all_anon','ALL','anon'),
    ('produtos','produtos_all_anon','ALL','anon'),
    ('proposta_itens','proposta_itens_all_anon','ALL','anon'),
    ('quadros_comando','quadros_comando_anon_all','ALL','anon'),
    ('quadros_comando_checklist_separacao','qc_checklist_anon_all','ALL','anon'),
    ('quadros_comando_componentes','quadros_comando_componentes_anon_all','ALL','anon'),
    ('quadros_comando_geometria','qc_geometria_anon_all','ALL','anon'),
    ('quadros_comando_maquina','qc_maquina_anon_all','ALL','anon'),
    ('solicitacoes_produto','solicitacoes_produto_all_anon','ALL','anon')
) as e(tabela, politica, cmd, papeis) on e.tabela = p.tablename and e.politica = p.policyname
where p.schemaname = 'public';

-- A) 19 tabelas com política FOR DELETE própria: só remover
drop policy "af_delete" on public."avais_financeiros";
drop policy "aj_delete" on public."avais_juridicos";
drop policy "ccr_delete" on public."cotacao_custos_reais";
drop policy "eq_delete" on public."equipamentos_spec";
drop policy "ef_delete" on public."eventos_fluxo";
drop policy "iv_estoque_delete" on public."importacao_varejo_estoque";
drop policy "iv_fornecedor_delete" on public."importacao_varejo_fornecedor";
drop policy "iv_giro_delete" on public."importacao_varejo_giro";
drop policy "iv_girostg_delete" on public."importacao_varejo_giro_staging";
drop policy "iv_lote_delete" on public."importacao_varejo_lote_config";
drop policy "iv_produtos_delete" on public."importacao_varejo_produtos";
drop policy "iv_cursor_delete" on public."importacao_varejo_sync_cursor";
drop policy "delete_anon" on public."instalacao_checklist_itens";
drop policy "delete_anon" on public."instalacao_checklist_templates";
drop policy "oe_delete" on public."operadores_estrangeiros";
drop policy "pcp_ordem_etapas_delete" on public."pcp_ordem_etapas";
drop policy "projetos_elevador_delete" on public."projetos_elevador";
drop policy "tratativas_cotacao_delete" on public."tratativas_cotacao";
drop policy "delete_anon" on public."vistorias_obras";

-- B) 10 tabelas com política ALL para 'public': trocar por SELECT + INSERT + UPDATE
drop policy "allow_all_acomp_obra_itens" on public."acompanhamento_obra_itens";
create policy "allow_all_acomp_obra_itens_sel" on public."acompanhamento_obra_itens" for select to public using (true);
create policy "allow_all_acomp_obra_itens_ins" on public."acompanhamento_obra_itens" for insert to public with check (true);
create policy "allow_all_acomp_obra_itens_upd" on public."acompanhamento_obra_itens" for update to public using (true) with check (true);
drop policy "allow_all_acomp_obra_lancamentos" on public."acompanhamento_obra_lancamentos";
create policy "allow_all_acomp_obra_lancamentos_sel" on public."acompanhamento_obra_lancamentos" for select to public using (true);
create policy "allow_all_acomp_obra_lancamentos_ins" on public."acompanhamento_obra_lancamentos" for insert to public with check (true);
create policy "allow_all_acomp_obra_lancamentos_upd" on public."acompanhamento_obra_lancamentos" for update to public using (true) with check (true);
drop policy "allow_all_acomp_obra_links" on public."acompanhamento_obra_links";
create policy "allow_all_acomp_obra_links_sel" on public."acompanhamento_obra_links" for select to public using (true);
create policy "allow_all_acomp_obra_links_ins" on public."acompanhamento_obra_links" for insert to public with check (true);
create policy "allow_all_acomp_obra_links_upd" on public."acompanhamento_obra_links" for update to public using (true) with check (true);
drop policy "allow_all_acomp_obra_status" on public."acompanhamento_obra_status";
create policy "allow_all_acomp_obra_status_sel" on public."acompanhamento_obra_status" for select to public using (true);
create policy "allow_all_acomp_obra_status_ins" on public."acompanhamento_obra_status" for insert to public with check (true);
create policy "allow_all_acomp_obra_status_upd" on public."acompanhamento_obra_status" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_fiacao_itens" on public."fabricacao_quadro_fiacao_itens";
create policy "allow_all_fab_quadro_fiacao_itens_sel" on public."fabricacao_quadro_fiacao_itens" for select to public using (true);
create policy "allow_all_fab_quadro_fiacao_itens_ins" on public."fabricacao_quadro_fiacao_itens" for insert to public with check (true);
create policy "allow_all_fab_quadro_fiacao_itens_upd" on public."fabricacao_quadro_fiacao_itens" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_fiacao_status" on public."fabricacao_quadro_fiacao_status";
create policy "allow_all_fab_quadro_fiacao_status_sel" on public."fabricacao_quadro_fiacao_status" for select to public using (true);
create policy "allow_all_fab_quadro_fiacao_status_ins" on public."fabricacao_quadro_fiacao_status" for insert to public with check (true);
create policy "allow_all_fab_quadro_fiacao_status_upd" on public."fabricacao_quadro_fiacao_status" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_itens" on public."fabricacao_quadro_itens";
create policy "allow_all_fab_quadro_itens_sel" on public."fabricacao_quadro_itens" for select to public using (true);
create policy "allow_all_fab_quadro_itens_ins" on public."fabricacao_quadro_itens" for insert to public with check (true);
create policy "allow_all_fab_quadro_itens_upd" on public."fabricacao_quadro_itens" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_links" on public."fabricacao_quadro_links";
create policy "allow_all_fab_quadro_links_sel" on public."fabricacao_quadro_links" for select to public using (true);
create policy "allow_all_fab_quadro_links_ins" on public."fabricacao_quadro_links" for insert to public with check (true);
create policy "allow_all_fab_quadro_links_upd" on public."fabricacao_quadro_links" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_ocorrencias" on public."fabricacao_quadro_ocorrencias";
create policy "allow_all_fab_quadro_ocorrencias_sel" on public."fabricacao_quadro_ocorrencias" for select to public using (true);
create policy "allow_all_fab_quadro_ocorrencias_ins" on public."fabricacao_quadro_ocorrencias" for insert to public with check (true);
create policy "allow_all_fab_quadro_ocorrencias_upd" on public."fabricacao_quadro_ocorrencias" for update to public using (true) with check (true);
drop policy "allow_all_fab_quadro_status" on public."fabricacao_quadro_status";
create policy "allow_all_fab_quadro_status_sel" on public."fabricacao_quadro_status" for select to public using (true);
create policy "allow_all_fab_quadro_status_ins" on public."fabricacao_quadro_status" for insert to public with check (true);
create policy "allow_all_fab_quadro_status_upd" on public."fabricacao_quadro_status" for update to public using (true) with check (true);

-- C) 27 tabelas com política ALL para 'anon': trocar por SELECT + INSERT + UPDATE
drop policy "contract_drafts_all_anon" on public."contract_drafts";
create policy "contract_drafts_all_anon_sel" on public."contract_drafts" for select to anon using (true);
create policy "contract_drafts_all_anon_ins" on public."contract_drafts" for insert to anon with check (true);
create policy "contract_drafts_all_anon_upd" on public."contract_drafts" for update to anon using (true) with check (true);
drop policy "contrato_instalador_parcelas_anon_all" on public."contrato_instalador_parcelas";
create policy "contrato_instalador_parcelas_anon_all_sel" on public."contrato_instalador_parcelas" for select to anon using (true);
create policy "contrato_instalador_parcelas_anon_all_ins" on public."contrato_instalador_parcelas" for insert to anon with check (true);
create policy "contrato_instalador_parcelas_anon_all_upd" on public."contrato_instalador_parcelas" for update to anon using (true) with check (true);
drop policy "convites_anon_all" on public."convites";
create policy "convites_anon_all_sel" on public."convites" for select to anon using (true);
create policy "convites_anon_all_ins" on public."convites" for insert to anon with check (true);
create policy "convites_anon_all_upd" on public."convites" for update to anon using (true) with check (true);
drop policy "cotacoes_elevador_fornecedor_all_anon" on public."cotacoes_elevador_fornecedor";
create policy "cotacoes_elevador_fornecedor_all_anon_sel" on public."cotacoes_elevador_fornecedor" for select to anon using (true);
create policy "cotacoes_elevador_fornecedor_all_anon_ins" on public."cotacoes_elevador_fornecedor" for insert to anon with check (true);
create policy "cotacoes_elevador_fornecedor_all_anon_upd" on public."cotacoes_elevador_fornecedor" for update to anon using (true) with check (true);
drop policy "cotacoes_elevador_historico_all_anon" on public."cotacoes_elevador_historico";
create policy "cotacoes_elevador_historico_all_anon_sel" on public."cotacoes_elevador_historico" for select to anon using (true);
create policy "cotacoes_elevador_historico_all_anon_ins" on public."cotacoes_elevador_historico" for insert to anon with check (true);
create policy "cotacoes_elevador_historico_all_anon_upd" on public."cotacoes_elevador_historico" for update to anon using (true) with check (true);
drop policy "elevador_modelo_opcoes_all_anon" on public."elevador_modelo_opcoes";
create policy "elevador_modelo_opcoes_all_anon_sel" on public."elevador_modelo_opcoes" for select to anon using (true);
create policy "elevador_modelo_opcoes_all_anon_ins" on public."elevador_modelo_opcoes" for insert to anon with check (true);
create policy "elevador_modelo_opcoes_all_anon_upd" on public."elevador_modelo_opcoes" for update to anon using (true) with check (true);
drop policy "elevador_modelos_all_anon" on public."elevador_modelos";
create policy "elevador_modelos_all_anon_sel" on public."elevador_modelos" for select to anon using (true);
create policy "elevador_modelos_all_anon_ins" on public."elevador_modelos" for insert to anon with check (true);
create policy "elevador_modelos_all_anon_upd" on public."elevador_modelos" for update to anon using (true) with check (true);
drop policy "elevador_opcoes_all_anon" on public."elevador_opcoes";
create policy "elevador_opcoes_all_anon_sel" on public."elevador_opcoes" for select to anon using (true);
create policy "elevador_opcoes_all_anon_ins" on public."elevador_opcoes" for insert to anon with check (true);
create policy "elevador_opcoes_all_anon_upd" on public."elevador_opcoes" for update to anon using (true) with check (true);
drop policy "equipe_checklist_anon_all" on public."equipe_checklist";
create policy "equipe_checklist_anon_all_sel" on public."equipe_checklist" for select to anon using (true);
create policy "equipe_checklist_anon_all_ins" on public."equipe_checklist" for insert to anon with check (true);
create policy "equipe_checklist_anon_all_upd" on public."equipe_checklist" for update to anon using (true) with check (true);
drop policy "frc_all_anon" on public."fichas_relatorio_confiabilidade";
create policy "frc_all_anon_sel" on public."fichas_relatorio_confiabilidade" for select to anon using (true);
create policy "frc_all_anon_ins" on public."fichas_relatorio_confiabilidade" for insert to anon with check (true);
create policy "frc_all_anon_upd" on public."fichas_relatorio_confiabilidade" for update to anon using (true) with check (true);
drop policy "formularios_elevador_all_anon" on public."formularios_elevador";
create policy "formularios_elevador_all_anon_sel" on public."formularios_elevador" for select to anon using (true);
create policy "formularios_elevador_all_anon_ins" on public."formularios_elevador" for insert to anon with check (true);
create policy "formularios_elevador_all_anon_upd" on public."formularios_elevador" for update to anon using (true) with check (true);
drop policy "fornecedores_elevador_all_anon" on public."fornecedores_elevador";
create policy "fornecedores_elevador_all_anon_sel" on public."fornecedores_elevador" for select to anon using (true);
create policy "fornecedores_elevador_all_anon_ins" on public."fornecedores_elevador" for insert to anon with check (true);
create policy "fornecedores_elevador_all_anon_upd" on public."fornecedores_elevador" for update to anon using (true) with check (true);
drop policy "materiais_catalogo_anon_all" on public."materiais_catalogo";
create policy "materiais_catalogo_anon_all_sel" on public."materiais_catalogo" for select to anon using (true);
create policy "materiais_catalogo_anon_all_ins" on public."materiais_catalogo" for insert to anon with check (true);
create policy "materiais_catalogo_anon_all_upd" on public."materiais_catalogo" for update to anon using (true) with check (true);
drop policy "minutas_all_anon" on public."minutas";
create policy "minutas_all_anon_sel" on public."minutas" for select to anon using (true);
create policy "minutas_all_anon_ins" on public."minutas" for insert to anon with check (true);
create policy "minutas_all_anon_upd" on public."minutas" for update to anon using (true) with check (true);
drop policy "notificacoes_lidas_anon_all" on public."notificacoes_lidas";
create policy "notificacoes_lidas_anon_all_sel" on public."notificacoes_lidas" for select to anon using (true);
create policy "notificacoes_lidas_anon_all_ins" on public."notificacoes_lidas" for insert to anon with check (true);
create policy "notificacoes_lidas_anon_all_upd" on public."notificacoes_lidas" for update to anon using (true) with check (true);
drop policy "parametros_fiscais_elevador_all_anon" on public."parametros_fiscais_elevador";
create policy "parametros_fiscais_elevador_all_anon_sel" on public."parametros_fiscais_elevador" for select to anon using (true);
create policy "parametros_fiscais_elevador_all_anon_ins" on public."parametros_fiscais_elevador" for insert to anon with check (true);
create policy "parametros_fiscais_elevador_all_anon_upd" on public."parametros_fiscais_elevador" for update to anon using (true) with check (true);
drop policy "parceiros_doc_catalogo_anon_all" on public."parceiros_doc_catalogo";
create policy "parceiros_doc_catalogo_anon_all_sel" on public."parceiros_doc_catalogo" for select to anon using (true);
create policy "parceiros_doc_catalogo_anon_all_ins" on public."parceiros_doc_catalogo" for insert to anon with check (true);
create policy "parceiros_doc_catalogo_anon_all_upd" on public."parceiros_doc_catalogo" for update to anon using (true) with check (true);
drop policy "parceiros_documentos_empresa_anon_all" on public."parceiros_documentos_empresa";
create policy "parceiros_documentos_empresa_anon_all_sel" on public."parceiros_documentos_empresa" for select to anon using (true);
create policy "parceiros_documentos_empresa_anon_all_ins" on public."parceiros_documentos_empresa" for insert to anon with check (true);
create policy "parceiros_documentos_empresa_anon_all_upd" on public."parceiros_documentos_empresa" for update to anon using (true) with check (true);
drop policy "precificacoes_elevador_all_anon" on public."precificacoes_elevador";
create policy "precificacoes_elevador_all_anon_sel" on public."precificacoes_elevador" for select to anon using (true);
create policy "precificacoes_elevador_all_anon_ins" on public."precificacoes_elevador" for insert to anon with check (true);
create policy "precificacoes_elevador_all_anon_upd" on public."precificacoes_elevador" for update to anon using (true) with check (true);
drop policy "produtos_all_anon" on public."produtos";
create policy "produtos_all_anon_sel" on public."produtos" for select to anon using (true);
create policy "produtos_all_anon_ins" on public."produtos" for insert to anon with check (true);
create policy "produtos_all_anon_upd" on public."produtos" for update to anon using (true) with check (true);
drop policy "proposta_itens_all_anon" on public."proposta_itens";
create policy "proposta_itens_all_anon_sel" on public."proposta_itens" for select to anon using (true);
create policy "proposta_itens_all_anon_ins" on public."proposta_itens" for insert to anon with check (true);
create policy "proposta_itens_all_anon_upd" on public."proposta_itens" for update to anon using (true) with check (true);
drop policy "quadros_comando_anon_all" on public."quadros_comando";
create policy "quadros_comando_anon_all_sel" on public."quadros_comando" for select to anon using (true);
create policy "quadros_comando_anon_all_ins" on public."quadros_comando" for insert to anon with check (true);
create policy "quadros_comando_anon_all_upd" on public."quadros_comando" for update to anon using (true) with check (true);
drop policy "qc_checklist_anon_all" on public."quadros_comando_checklist_separacao";
create policy "qc_checklist_anon_all_sel" on public."quadros_comando_checklist_separacao" for select to anon using (true);
create policy "qc_checklist_anon_all_ins" on public."quadros_comando_checklist_separacao" for insert to anon with check (true);
create policy "qc_checklist_anon_all_upd" on public."quadros_comando_checklist_separacao" for update to anon using (true) with check (true);
drop policy "quadros_comando_componentes_anon_all" on public."quadros_comando_componentes";
create policy "quadros_comando_componentes_anon_all_sel" on public."quadros_comando_componentes" for select to anon using (true);
create policy "quadros_comando_componentes_anon_all_ins" on public."quadros_comando_componentes" for insert to anon with check (true);
create policy "quadros_comando_componentes_anon_all_upd" on public."quadros_comando_componentes" for update to anon using (true) with check (true);
drop policy "qc_geometria_anon_all" on public."quadros_comando_geometria";
create policy "qc_geometria_anon_all_sel" on public."quadros_comando_geometria" for select to anon using (true);
create policy "qc_geometria_anon_all_ins" on public."quadros_comando_geometria" for insert to anon with check (true);
create policy "qc_geometria_anon_all_upd" on public."quadros_comando_geometria" for update to anon using (true) with check (true);
drop policy "qc_maquina_anon_all" on public."quadros_comando_maquina";
create policy "qc_maquina_anon_all_sel" on public."quadros_comando_maquina" for select to anon using (true);
create policy "qc_maquina_anon_all_ins" on public."quadros_comando_maquina" for insert to anon with check (true);
create policy "qc_maquina_anon_all_upd" on public."quadros_comando_maquina" for update to anon using (true) with check (true);
drop policy "solicitacoes_produto_all_anon" on public."solicitacoes_produto";
create policy "solicitacoes_produto_all_anon_sel" on public."solicitacoes_produto" for select to anon using (true);
create policy "solicitacoes_produto_all_anon_ins" on public."solicitacoes_produto" for insert to anon with check (true);
create policy "solicitacoes_produto_all_anon_upd" on public."solicitacoes_produto" for update to anon using (true) with check (true);
