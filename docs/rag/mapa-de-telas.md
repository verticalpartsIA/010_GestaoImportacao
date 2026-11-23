<!-- GERADO por scripts/gerar-rag.js — não edite à mão. Rode: npm run rag -->

**88 telas; 82 citam rota; 2 citam rota que não está em `KNOWN_ROUTES`.**

# Mapa de telas (módulo → tela → rota)

> Derivado dos títulos `N.k` (ou `S<n>`) e do tema "Rota e arquivos" de cada documento de módulo. "Rota" é o id citado (``Rota `x` ``) ou, na falta, o 2º trecho da primeira URL citada; "URL citada" é a primeira `/caminho` do tema, sem as partes opcionais. "No roteador" confere o id com `KNOWN_ROUTES` de `src/router.js`: **não** quer dizer que a tela está certa, só que a rota existe no código. Vazio = o tema não cita rota. Em divergência vale o documento de origem (e `docs/MAPA_DE_ROTAS.md`, gerado do código).

| Documento | Tela | Rota | URL citada | No roteador | Âncora |
|---|---|---|---|---|---|
| `01_geral.md` | 1.1 Dashboard | `dashboard` | `/geral/dashboard` | sim | `docs/modulos/01_geral.md#11-dashboard` |
| `01_geral.md` | 1.2 Notificações | `notificacoes` | `/geral/notificacoes` | sim | `docs/modulos/01_geral.md#12-notificações` |
| `01_geral.md` | 1.3 Central de Decisões 🔒 | `decisoes` | `/geral/decisoes` | sim | `docs/modulos/01_geral.md#13-central-de-decisões-` |
| `01_geral.md` | 1.4 Prazos & Pendências | `financeiro` | `/adm-financeiro/financeiro` | sim | `docs/modulos/01_geral.md#14-prazos--pendências` |
| `01_geral.md` | 1.5 Inbox 🔒 | `inbox` | `/geral/inbox` | sim | `docs/modulos/01_geral.md#15-inbox-` |
| `02_crm.md` | 2.1 Leads | `leads` | `/crm/leads` | sim | `docs/modulos/02_crm.md#21-leads` |
| `02_crm.md` | 2.2 Canais | `crm-canais` | `/crm/crm-canais` | sim | `docs/modulos/02_crm.md#22-canais` |
| `02_crm.md` | 2.3 Conversão | `crm-conversao` | `/crm/crm-conversao` | sim | `docs/modulos/02_crm.md#23-conversão` |
| `02_crm.md` | 2.4 Automação | `crm-automacao` | `/crm/crm-automacao` | sim | `docs/modulos/02_crm.md#24-automação` |
| `02_crm.md` | 2.5 Análise | `crm-analise` | `/crm/crm-analise` | sim | `docs/modulos/02_crm.md#25-análise` |
| `03_cadastros_mestres.md` | 3.1 Clientes | `cadastro-clientes` | `/cadastros/cadastro-clientes` | sim | `docs/modulos/03_cadastros_mestres.md#31-clientes` |
| `03_cadastros_mestres.md` | 3.2 Fornecedores | `cadastro-fornecedores` | `/cadastros/cadastro-fornecedores` | sim | `docs/modulos/03_cadastros_mestres.md#32-fornecedores` |
| `04_comercial_pre_venda.md` | 4.1 Formulários | `formularios` | `/comercial/formularios` | sim | `docs/modulos/04_comercial_pre_venda.md#41-formulários` |
| `04_comercial_pre_venda.md` | 4.2 Controle de Cotações | `controle-cotacoes` | `/comercial/controle-cotacoes` | sim | `docs/modulos/04_comercial_pre_venda.md#42-controle-de-cotações` |
| `04_comercial_pre_venda.md` | 4.3 Cotações a Fornecedor | `cotacoes-fornecedor` | `/comercial/cotacoes-fornecedor` | sim | `docs/modulos/04_comercial_pre_venda.md#43-cotações-a-fornecedor` |
| `04_comercial_pre_venda.md` | 4.4 Cotação Quadro de Comando | `cotacao-quadro-comando` | `/comercial/cotacao-quadro-comando` | sim | `docs/modulos/04_comercial_pre_venda.md#44-cotação-quadro-de-comando` |
| `04_comercial_pre_venda.md` | 4.5 Propostas | `propostas` | `/comercial/propostas` | sim | `docs/modulos/04_comercial_pre_venda.md#45-propostas` |
| `04_comercial_pre_venda.md` | 4.6 Contratos Social | `contratos-sociais` | `/comercial/contratos-sociais` | sim | `docs/modulos/04_comercial_pre_venda.md#46-contratos-social` |
| `05_financeiro_precos.md` | 5.1 Atualização de Custos | `cadastro-custos` | `/cadastros/cadastro-custos` | sim | `docs/modulos/05_financeiro_precos.md#51-atualização-de-custos` |
| `05_financeiro_precos.md` | 5.2 Precificação | `precificacao` | `/comercial/precificacao` | sim | `docs/modulos/05_financeiro_precos.md#52-precificação` |
| `05_financeiro_precos.md` | 5.3 Aval Financeiro | `aval-financeiro` | `/adm-financeiro/aval-financeiro` | sim | `docs/modulos/05_financeiro_precos.md#53-aval-financeiro` |
| `05_financeiro_precos.md` | 5.4 Emissão de NF | `emissao-nf` | `/adm-financeiro/emissao-nf` | sim | `docs/modulos/05_financeiro_precos.md#54-emissão-de-nf` |
| `05_financeiro_precos.md` | 5.5 Boletos Avisos | `boletos-avisos` | `/adm-financeiro/boletos-avisos` | sim | `docs/modulos/05_financeiro_precos.md#55-boletos-avisos` |
| `05_financeiro_precos.md` | 5.6 Comissões | `comissoes` | `/adm-financeiro/comissoes` | sim | `docs/modulos/05_financeiro_precos.md#56-comissões` |
| `06_contratos_juridico.md` | 6.1 Contrato Venda de Equipamentos | `contrato-venda-equipamentos` | `/juridico/contrato-venda-equipamentos` | sim | `docs/modulos/06_contratos_juridico.md#61-contrato-venda-de-equipamentos` |
| `06_contratos_juridico.md` | 6.2 Aval Jurídico | `aval-juridico` | `/juridico/aval-juridico` | sim | `docs/modulos/06_contratos_juridico.md#62-aval-jurídico` |
| `06_contratos_juridico.md` | 6.3 Contratos & Minutas | `juridico` | `/juridico/juridico` | sim | `docs/modulos/06_contratos_juridico.md#63-contratos--minutas` |
| `07_suprimentos_importacao.md` | 7.1 Painel | `gi-painel` | `/gestao-importacao/gi-painel` | sim | `docs/modulos/07_suprimentos_importacao.md#71-painel` |
| `07_suprimentos_importacao.md` | 7.2 P.I. | `pi-importacao` | `/gestao-importacao/pi-importacao` | sim | `docs/modulos/07_suprimentos_importacao.md#72-pi` |
| `07_suprimentos_importacao.md` | 7.3 RFQ | `rfq-importacao` | `/gestao-importacao/rfq-importacao` | sim | `docs/modulos/07_suprimentos_importacao.md#73-rfq` |
| `07_suprimentos_importacao.md` | 7.4 IMS | `ims-importacao` | `/gestao-importacao/ims-importacao` | sim | `docs/modulos/07_suprimentos_importacao.md#74-ims` |
| `07_suprimentos_importacao.md` | 7.5 Embarques | `embarques-importacao` | `/gestao-importacao/embarques-importacao` | sim | `docs/modulos/07_suprimentos_importacao.md#75-embarques` |
| `07_suprimentos_importacao.md` | 7.6 Rastreio Marítimo | `importacao` | `/gestao-importacao/importacao` | sim | `docs/modulos/07_suprimentos_importacao.md#76-rastreio-marítimo` |
| `07_suprimentos_importacao.md` | 7.7 Análise de Preços | `gi-analise-precos` | `/gestao-importacao/gi-analise-precos` | sim | `docs/modulos/07_suprimentos_importacao.md#77-análise-de-preços` |
| `07_suprimentos_importacao.md` | 7.8 Catálogo Siscomex | `ncm-catalogo` | `/gestao-importacao/ncm-catalogo` | sim | `docs/modulos/07_suprimentos_importacao.md#78-catálogo-siscomex` |
| `07_suprimentos_importacao.md` | 7.9 Importação Varejo | `compras` | `/logistica/compras` | sim | `docs/modulos/07_suprimentos_importacao.md#79-importação-varejo` |
| `07_suprimentos_importacao.md` | 7.10 Cotações de Varejo | `cotacoes-varejo` | `/logistica/cotacoes-varejo` | sim | `docs/modulos/07_suprimentos_importacao.md#710-cotações-de-varejo` |
| `07_suprimentos_importacao.md` | 7.11 Pedidos | `pedidos-acompanhamento` | `/logistica/pedidos-acompanhamento` | sim | `docs/modulos/07_suprimentos_importacao.md#711-pedidos` |
| `08_engenharia_produto.md` | 8.1 Projeto de Elevadores | `eng-projeto-elevadores` | `/engenharia/eng-projeto-elevadores` | sim | `docs/modulos/08_engenharia_produto.md#81-projeto-de-elevadores` |
| `08_engenharia_produto.md` | 8.2 Projeto de Equipamento | `eng-configurador` | `/engenharia/eng-configurador` | sim | `docs/modulos/08_engenharia_produto.md#82-projeto-de-equipamento` |
| `08_engenharia_produto.md` | 8.3 Solicitações de Produto | `solicitacoes-produto` | `/engenharia/solicitacoes-produto` | sim | `docs/modulos/08_engenharia_produto.md#83-solicitações-de-produto` |
| `08_engenharia_produto.md` | 8.4 Ficha Técnica | `ficha-tecnica` | `/engenharia/ficha-tecnica` | sim | `docs/modulos/08_engenharia_produto.md#84-ficha-técnica` |
| `08_engenharia_produto.md` | 8.5 Linha do Tempo da Cotação | `linha-do-tempo` | `/engenharia/linha-do-tempo` | sim | `docs/modulos/08_engenharia_produto.md#85-linha-do-tempo-da-cotação` |
| `09_obras_instalacao.md` | 9.1 Dossiês de Obras | `status-obras` | `/engenharia/status-obras` | sim | `docs/modulos/09_obras_instalacao.md#91-dossiês-de-obras` |
| `09_obras_instalacao.md` | 9.2 Vistorias de Obras | `vistorias-envio` | `/engenharia/vistorias-envio` | sim | `docs/modulos/09_obras_instalacao.md#92-vistorias-de-obras` |
| `09_obras_instalacao.md` | 9.3 Resultado Vistorias de Obras | `vistorias` | `/engenharia/vistorias` | sim | `docs/modulos/09_obras_instalacao.md#93-resultado-vistorias-de-obras` |
| `09_obras_instalacao.md` | 9.4 Instalação em Campo | `instalacao` | `/engenharia/instalacao` | sim | `docs/modulos/09_obras_instalacao.md#94-instalação-em-campo` |
| `09_obras_instalacao.md` | 9.5 Mapa de Obras | `mapa-obras` | `/engenharia/mapa-obras` | sim | `docs/modulos/09_obras_instalacao.md#95-mapa-de-obras` |
| `09_obras_instalacao.md` | 9.6 ART | `art` | `/engenharia/art` | sim | `docs/modulos/09_obras_instalacao.md#96-art` |
| `10_entrega_documentacao.md` | 10.1 Central de Documentos | `central-documentos` | `/engenharia/central-documentos` | sim | `docs/modulos/10_entrega_documentacao.md#101-central-de-documentos` |
| `10_entrega_documentacao.md` | 10.2 Data Book & Termo | `databook` | `/engenharia/databook` | sim | `docs/modulos/10_entrega_documentacao.md#102-data-book--termo` |
| `10_entrega_documentacao.md` | 10.3 Entrega Final (Handover) | `handover` | `/engenharia/handover` | sim | `docs/modulos/10_entrega_documentacao.md#103-entrega-final-handover` |
| `10_entrega_documentacao.md` | 10.4 Repositório Documentos | `repositorio-documentos` | `/engenharia/repositorio-documentos` | sim | `docs/modulos/10_entrega_documentacao.md#104-repositório-documentos` |
| `11_parceiros_instaladores.md` | 11.1 Empresas Instaladoras | `cadastro-instaladores` | `/cadastros/cadastro-instaladores` | sim | `docs/modulos/11_parceiros_instaladores.md#111-empresas-instaladoras` |
| `11_parceiros_instaladores.md` | 11.2 Homologação de Instaladores | `rh-homologacao` | `/rh/rh-homologacao` | sim | `docs/modulos/11_parceiros_instaladores.md#112-homologação-de-instaladores` |
| `11_parceiros_instaladores.md` | 11.3 Contrato Instalador | `contrato-instalador` | `/juridico/contrato-instalador` | sim | `docs/modulos/11_parceiros_instaladores.md#113-contrato-instalador` |
| `11_parceiros_instaladores.md` | 11.4 Pagamentos a Instaladores | `pagamentos-instalador` | `/adm-financeiro/pagamentos-instalador` | sim | `docs/modulos/11_parceiros_instaladores.md#114-pagamentos-a-instaladores` |
| `11_parceiros_instaladores.md` | 11.5 Cronograma de Pagamento da Instalação | `cronograma` | `/engenharia/cronograma` | sim | `docs/modulos/11_parceiros_instaladores.md#115-cronograma-de-pagamento-da-instalação` |
| `12_logistica_interna.md` | 12.1 Almoxarifado | `almoxarifado` | `/logistica/almoxarifado` | sim | `docs/modulos/12_logistica_interna.md#121-almoxarifado` |
| `12_logistica_interna.md` | 12.2 Expedição | `expedicao` | `/logistica/expedicao` | sim | `docs/modulos/12_logistica_interna.md#122-expedição` |
| `12_logistica_interna.md` | 12.3 Separação | `separacao` | `/logistica/separacao` | sim | `docs/modulos/12_logistica_interna.md#123-separação` |
| `12_logistica_interna.md` | 12.4 Etiquetas | `etiquetas` | `/logistica/etiquetas` | sim | `docs/modulos/12_logistica_interna.md#124-etiquetas` |
| `13_fabricacao.md` | 13.1 PCP | `pcp` | `/logistica/pcp` | sim | `docs/modulos/13_fabricacao.md#131-pcp` |
| `13_fabricacao.md` | 13.2 MES | `mes` | `/logistica/mes` | não | `docs/modulos/13_fabricacao.md#132-mes` |
| `13_fabricacao.md` | 13.3 MES · Cadastros | `mes-cadastros` |  | não | `docs/modulos/13_fabricacao.md#133-mes--cadastros` |
| `13_fabricacao.md` | 13.4 Carga Máquina | `carga-maquina` |  | sim | `docs/modulos/13_fabricacao.md#134-carga-máquina` |
| `13_fabricacao.md` | 13.5 Matérias-Primas | `cadastro-materias-primas` | `/cadastros/cadastro-materias-primas` | sim | `docs/modulos/13_fabricacao.md#135-matérias-primas` |
| `13_fabricacao.md` | 13.6 Produtos | `cadastro-produtos` | `/cadastros/cadastro-produtos` | sim | `docs/modulos/13_fabricacao.md#136-produtos` |
| `13_fabricacao.md` | 13.7 Montagem do Produto | `montagem-produto` | `/logistica/montagem-produto` | sim | `docs/modulos/13_fabricacao.md#137-montagem-do-produto` |
| `13_fabricacao.md` | 13.8 Evolução da Fabricação | `evolucao-fabricacao` | `/logistica/evolucao-fabricacao` | sim | `docs/modulos/13_fabricacao.md#138-evolução-da-fabricação` |
| `13_fabricacao.md` | 13.9 Fabricação Corrimão | `fabricacao-corrimao` | `/fabricacao-oficina` | sim | `docs/modulos/13_fabricacao.md#139-fabricação-corrimão` |
| `13_fabricacao.md` | 13.10 Fabricação Corte | `fabricacao-corte` |  | sim | `docs/modulos/13_fabricacao.md#1310-fabricação-corte` |
| `13_fabricacao.md` | 13.11 Simulação | `simulacao-producao` |  | sim | `docs/modulos/13_fabricacao.md#1311-simulação` |
| `13_fabricacao.md` | 13.12 Relatórios | `relatorios-pcp` |  | sim | `docs/modulos/13_fabricacao.md#1312-relatórios` |
| `14_quadros_comando.md` | 14.1 Pedidos com Quadro | `quadros-pedidos` | `/quadros-de-comando/quadros-pedidos` | sim | `docs/modulos/14_quadros_comando.md#141-pedidos-com-quadro` |
| `14_quadros_comando.md` | 14.2 Separação PV QC | `quadros-separacao` | `/quadros-de-comando/quadros-separacao` | sim | `docs/modulos/14_quadros_comando.md#142-separação-pv-qc` |
| `14_quadros_comando.md` | 14.3 Separação FAB QC | `quadros-separacao-fab` | `/quadros-de-comando/quadros-separacao-fab` | sim | `docs/modulos/14_quadros_comando.md#143-separação-fab-qc` |
| `14_quadros_comando.md` | 14.4 Fabricação QC | `evolucao-fabricacao` | `/quadros-de-comando/evolucao-fabricacao` | sim | `docs/modulos/14_quadros_comando.md#144-fabricação-qc` |
| `14_quadros_comando.md` | 14.5 Calculadora de Cabos | `quadros-calculadora-cabos` | `/quadros-de-comando/quadros-calculadora-cabos/mrl` | sim | `docs/modulos/14_quadros_comando.md#145-calculadora-de-cabos` |
| `14_quadros_comando.md` | 14.6 Formulários Respondidos | `quadros-formularios-respondidos` | `/quadros-de-comando/quadros-formularios-respondidos` | sim | `docs/modulos/14_quadros_comando.md#146-formulários-respondidos` |
| `15_administracao.md` | 15.1 Logs de Atividade | `logs` | `/admin/logs` | sim | `docs/modulos/15_administracao.md#151-logs-de-atividade` |
| `15_administracao.md` | 15.2 Configurações do Sistema | `configuracoes` | `/admin/configuracoes` | sim | `docs/modulos/15_administracao.md#152-configurações-do-sistema` |
| `16_servicos.md` | S1 WhatsApp (canal Evolution) |  |  | — | `docs/modulos/16_servicos.md#s1-whatsapp-canal-evolution` |
| `16_servicos.md` | S2 gi-avisos (avisos do fluxo do hub) |  |  | — | `docs/modulos/16_servicos.md#s2-gi-avisos-avisos-do-fluxo-do-hub` |
| `16_servicos.md` | S3 Copiloto VP |  |  | — | `docs/modulos/16_servicos.md#s3-copiloto-vp` |
| `16_servicos.md` | S4 Telegram |  |  | — | `docs/modulos/16_servicos.md#s4-telegram` |
| `16_servicos.md` | S5 vpsistema (login, pessoas, alçadas, Central de Eventos e mensagens próprias) |  |  | — | `docs/modulos/16_servicos.md#s5-vpsistema-login-pessoas-alçadas-central-de-eventos-e-mensagens-próprias` |
| `16_servicos.md` | S6 E-mail (canal do Inbox) |  |  | — | `docs/modulos/16_servicos.md#s6-e-mail-canal-do-inbox` |
