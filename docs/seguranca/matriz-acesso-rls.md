# Matriz de acesso (gerada por scripts/rls-matriz.mjs)

Tabelas do schema public ainda abertas a anon/public: **163**

| tabela | páginas públicas | realtime | usada no navegador | onda |
|---|---|---|---|---|
| acompanhamento_obra_itens | diario-obra | — | sim | C |
| acompanhamento_obra_lancamentos | diario-obra | — | sim | C |
| acompanhamento_obra_links | diario-obra | — | sim | C |
| acompanhamento_obra_status | diario-obra | — | sim | C |
| alcadas_capacidade | assinar | — | sim | C |
| alertas | assinar, cotacao | — | sim | C |
| analise_tecnica | assinar | — | sim | C |
| analise_tecnica_pendencias_cliente | — | — | sim | A |
| avais_financeiros | — | — | sim | B |
| avais_juridicos | — | — | sim | B |
| catalogo_produtos | — | — | sim | A |
| clientes | formulario-cliente | — | sim | C |
| colaborador_alocacoes | — | — | sim | A |
| colaboradores | — | — | não (só servidor/cron) | B |
| colaboradores_vpsistema | — | — | sim | B |
| comissoes | — | — | sim | B |
| contract_drafts | — | — | não (só servidor/cron) | B |
| contrato_instalador_parcelas | — | — | sim | A |
| contrato_venda_signatarios | assinar | — | sim | C |
| contratos_instalador | assinar | — | sim | C |
| contratos_sociais | — | — | sim | B |
| contratos_venda_equipamentos | assinar, status-obra | — | sim | C |
| convites | — | — | sim | B |
| cotacao_custos_reais | — | — | sim | A |
| cotacoes | — | — | sim | A |
| cotacoes_elevador_fornecedor | cotacao-elevador-fornecedor | — | sim | C |
| cotacoes_elevador_fornecedor_anexos | cotacao-elevador-fornecedor | — | sim | C |
| cotacoes_elevador_historico | formulario-cliente | — | sim | C |
| custos_containers | — | — | sim | B |
| custos_instalacao_elevador | — | — | sim | B |
| custos_instalacao_escada_esteira | — | — | sim | B |
| decisoes_gerenciais | — | — | sim | B |
| difal_estados | — | — | sim | B |
| documento_signatarios | assinar | — | sim | C |
| dossier_documentos | assinar, status-obra, termo-entrega | — | sim | C |
| dossier_history | assinar | — | sim | C |
| dossier_obra | assinar, diario-obra, status-obra, termo-entrega, vistoria-execucao | — | sim | C |
| dossier_obra_instaladores | assinar | — | sim | C |
| dossier_pendencias | assinar | — | sim | C |
| dossier_responsaveis | assinar | — | sim | C |
| elevador_modelo_opcoes | formulario-cliente | — | sim | C |
| elevador_modelos | formulario-cliente | — | sim | C |
| elevador_opcoes | — | — | não (só servidor/cron) | A |
| emails_projeto | formulario-cliente | sim | sim | C |
| embarques | cotacao-elevador-fornecedor | sim | sim | C |
| embarques_importacao | — | — | sim | A |
| equipamentos_obra | assinar, diario-obra, vistoria-execucao | — | sim | C |
| equipamentos_spec | — | — | sim | A |
| equipe_checklist | — | — | sim | A |
| equipes | — | — | sim | A |
| estoque | — | — | não (só servidor/cron) | A |
| eventos_fluxo | assinar, cotacao-elevador-fornecedor, formulario-cliente, diario-obra | — | sim | C |
| fichas_historico | — | — | sim | A |
| fichas_lib_campos | — | — | sim | A |
| fichas_lib_categorias | — | — | sim | A |
| fichas_relatorio_confiabilidade | — | — | não (só servidor/cron) | A |
| fichas_tecnicas | cotacao | — | sim | C |
| formularios_elevador | assinar, cotacao-elevador-fornecedor, formulario-cliente, vistoria-execucao | — | sim | C |
| formularios_elevador_anexos | cotacao-elevador-fornecedor, formulario-cliente | — | sim | C |
| formularios_elevador_unidades | formulario-cliente, vistoria-execucao | — | sim | C |
| fornecedores | — | — | sim | A |
| fornecedores_avaliacoes | — | — | sim | A |
| fornecedores_elevador | formulario-cliente | — | sim | C |
| gatilhos | assinar, cotacao-elevador-fornecedor, formulario-cliente | — | sim | C |
| importacao_varejo_comprado | — | — | sim | B |
| importacao_varejo_estoque | — | — | não (só servidor/cron) | B |
| importacao_varejo_fornecedor | — | — | não (só servidor/cron) | B |
| importacao_varejo_fornecedor_cursor | — | — | não (só servidor/cron) | B |
| importacao_varejo_giro | — | — | não (só servidor/cron) | B |
| importacao_varejo_giro_staging | — | — | não (só servidor/cron) | B |
| importacao_varejo_lote_config | — | — | sim | B |
| importacao_varejo_produtos | — | — | não (só servidor/cron) | B |
| importacao_varejo_sync_cursor | — | — | não (só servidor/cron) | B |
| importacao_varejo_sync_log | — | — | não (só servidor/cron) | B |
| ims_importacao | — | — | sim | A |
| inbox_atribuicoes | — | — | sim | A |
| inbox_email_marcador | — | — | sim | A |
| inbox_estado_pessoa | — | — | sim | A |
| inbox_marcadores | — | — | sim | A |
| instalacao_checklist_itens | status-obra | — | sim | C |
| instalacao_checklist_templates | status-obra | — | sim | C |
| instalacao_cronograma | — | — | sim | A |
| leads | assinar, status-obra | — | sim | C |
| materiais_catalogo | — | — | sim | A |
| minutas | — | — | não (só servidor/cron) | B |
| ncm_solicitacoes | — | — | sim | A |
| notificacoes_lidas | — | — | sim | B |
| omie_pagamentos_cache | — | — | sim | B |
| omie_pagamentos_sync_log | — | — | sim | B |
| operadores_estrangeiros | — | — | não (só servidor/cron) | A |
| parametros_fiscais_elevador | — | — | sim | B |
| parceiros_colaboradores | — | — | sim | A |
| parceiros_doc_catalogo | — | — | sim | A |
| parceiros_documentos_colaborador | — | — | sim | A |
| parceiros_documentos_empresa | — | — | sim | A |
| parceiros_instaladores | — | — | sim | A |
| pcp_codigo_alias | — | — | não (só servidor/cron) | A |
| pcp_consumo_cursor | — | — | sim | A |
| pcp_consumo_mov | — | — | sim | A |
| pcp_estoque | — | — | sim | A |
| pcp_estoque_contagens | — | — | sim | A |
| pcp_estoque_fisico | — | — | sim | A |
| pcp_estrutura | — | — | sim | A |
| pcp_etapas_modelo | — | — | sim | A |
| pcp_expedicoes | — | — | sim | A |
| pcp_hh_apontamentos | — | — | sim | B |
| pcp_omie_fila | — | — | sim | A |
| pcp_ordem_checklist | — | — | sim | A |
| pcp_ordem_etapas | — | — | sim | A |
| pcp_ordem_materiais | — | — | sim | A |
| pcp_ordens | — | — | sim | A |
| pcp_pedido_acompanhamento | — | — | sim | A |
| pcp_pedido_itens | — | — | sim | A |
| pcp_pedidos | — | — | sim | A |
| pcp_plano | — | — | sim | A |
| pcp_posicao_compra | — | — | sim | A |
| pcp_previsao_itens | — | — | sim | A |
| pcp_previsao_pedidos | — | — | sim | A |
| pcp_produto_fornecedor | — | — | não (só servidor/cron) | A |
| pcp_produtos | — | — | sim | A |
| pcp_quadro_variante | — | — | sim | A |
| pcp_recursos | — | — | sim | A |
| pcp_reposicao_config | — | — | sim | A |
| pcp_roteiro | — | — | sim | A |
| pcp_sync_log | — | — | sim | A |
| pedidos_acompanhamento | — | — | sim | A |
| pedidos_compra_varejo | — | — | sim | A |
| pedidos_fornecedor | cotacao | — | sim | C |
| perfis | assinar | — | sim | C |
| pi_importacao | — | — | sim | A |
| pi_omie_pagamentos | — | — | não (só servidor/cron) | B |
| precificacoes_elevador | assinar, cotacao-elevador-fornecedor, formulario-cliente | — | sim | C |
| produtos | — | — | não (só servidor/cron) | A |
| projetos | — | — | sim | A |
| projetos_elevador | — | — | sim | A |
| proposta_itens | — | — | não (só servidor/cron) | A |
| propostas | assinar, status-obra | sim | sim | C |
| propostas_lib_campos | — | — | sim | A |
| propostas_lib_categorias | — | — | sim | A |
| quadros_comando | — | — | sim | A |
| quadros_comando_bom_itens | — | — | sim | A |
| quadros_comando_checklist_separacao | — | — | sim | A |
| quadros_comando_componentes | — | — | sim | A |
| quadros_comando_cruzamento_erp | — | — | sim | A |
| quadros_comando_geometria | — | — | sim | A |
| quadros_comando_intervalos_piso | — | — | sim | A |
| quadros_comando_maquina | — | — | sim | A |
| quadros_comando_paradas | — | — | sim | A |
| quadros_comando_trechos_corte | — | — | sim | A |
| regras_comissionamento | — | — | sim | B |
| rfq_importacao | — | — | sim | A |
| solicitacoes_produto | — | — | sim | A |
| status_obra_anotacoes | status-obra | — | sim | C |
| tarefas | — | — | sim | B |
| tratativas_cotacao | — | — | sim | A |
| usuarios | — | — | sim | B |
| vistorias_atividades | vistoria-execucao | sim | sim | C |
| vistorias_categorias | vistoria-execucao | — | sim | C |
| vistorias_obras | status-obra | — | sim | C |
| vistorias_perguntas | vistoria-execucao | — | sim | C |
| vistorias_questionarios | vistoria-execucao | — | sim | C |
| vistorias_respostas | vistoria-execucao | — | sim | C |
| vp_logs | assinar, cotacao, cotacao-elevador-fornecedor | — | sim | C |

**Onda A (82):** analise_tecnica_pendencias_cliente catalogo_produtos colaborador_alocacoes contrato_instalador_parcelas cotacao_custos_reais cotacoes elevador_opcoes embarques_importacao equipamentos_spec equipe_checklist equipes estoque fichas_historico fichas_lib_campos fichas_lib_categorias fichas_relatorio_confiabilidade fornecedores fornecedores_avaliacoes ims_importacao inbox_atribuicoes inbox_email_marcador inbox_estado_pessoa inbox_marcadores instalacao_cronograma materiais_catalogo ncm_solicitacoes operadores_estrangeiros parceiros_colaboradores parceiros_doc_catalogo parceiros_documentos_colaborador parceiros_documentos_empresa parceiros_instaladores pcp_codigo_alias pcp_consumo_cursor pcp_consumo_mov pcp_estoque pcp_estoque_contagens pcp_estoque_fisico pcp_estrutura pcp_etapas_modelo pcp_expedicoes pcp_omie_fila pcp_ordem_checklist pcp_ordem_etapas pcp_ordem_materiais pcp_ordens pcp_pedido_acompanhamento pcp_pedido_itens pcp_pedidos pcp_plano pcp_posicao_compra pcp_previsao_itens pcp_previsao_pedidos pcp_produto_fornecedor pcp_produtos pcp_quadro_variante pcp_recursos pcp_reposicao_config pcp_roteiro pcp_sync_log pedidos_acompanhamento pedidos_compra_varejo pi_importacao produtos projetos projetos_elevador proposta_itens propostas_lib_campos propostas_lib_categorias quadros_comando quadros_comando_bom_itens quadros_comando_checklist_separacao quadros_comando_componentes quadros_comando_cruzamento_erp quadros_comando_geometria quadros_comando_intervalos_piso quadros_comando_maquina quadros_comando_paradas quadros_comando_trechos_corte rfq_importacao solicitacoes_produto tratativas_cotacao

**Onda B (33):** avais_financeiros avais_juridicos colaboradores colaboradores_vpsistema comissoes contract_drafts contratos_sociais convites custos_containers custos_instalacao_elevador custos_instalacao_escada_esteira decisoes_gerenciais difal_estados importacao_varejo_comprado importacao_varejo_estoque importacao_varejo_fornecedor importacao_varejo_fornecedor_cursor importacao_varejo_giro importacao_varejo_giro_staging importacao_varejo_lote_config importacao_varejo_produtos importacao_varejo_sync_cursor importacao_varejo_sync_log minutas notificacoes_lidas omie_pagamentos_cache omie_pagamentos_sync_log parametros_fiscais_elevador pcp_hh_apontamentos pi_omie_pagamentos regras_comissionamento tarefas usuarios

**Onda C (48):** acompanhamento_obra_itens acompanhamento_obra_lancamentos acompanhamento_obra_links acompanhamento_obra_status alcadas_capacidade alertas analise_tecnica clientes contrato_venda_signatarios contratos_instalador contratos_venda_equipamentos cotacoes_elevador_fornecedor cotacoes_elevador_fornecedor_anexos cotacoes_elevador_historico documento_signatarios dossier_documentos dossier_history dossier_obra dossier_obra_instaladores dossier_pendencias dossier_responsaveis elevador_modelo_opcoes elevador_modelos emails_projeto embarques equipamentos_obra eventos_fluxo fichas_tecnicas formularios_elevador formularios_elevador_anexos formularios_elevador_unidades fornecedores_elevador gatilhos instalacao_checklist_itens instalacao_checklist_templates leads pedidos_fornecedor perfis precificacoes_elevador propostas status_obra_anotacoes vistorias_atividades vistorias_categorias vistorias_obras vistorias_perguntas vistorias_questionarios vistorias_respostas vp_logs

**Sem uso no navegador (20) — só Edge Function/cron/banco; podem fechar totalmente para anon sem afetar a tela:** colaboradores contract_drafts elevador_opcoes estoque fichas_relatorio_confiabilidade importacao_varejo_estoque importacao_varejo_fornecedor importacao_varejo_fornecedor_cursor importacao_varejo_giro importacao_varejo_giro_staging importacao_varejo_produtos importacao_varejo_sync_cursor importacao_varejo_sync_log minutas operadores_estrangeiros pcp_codigo_alias pcp_produto_fornecedor pi_omie_pagamentos produtos proposta_itens
