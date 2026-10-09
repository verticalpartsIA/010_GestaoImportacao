# Mapa de rotas, módulos e botões — VP Gestão

> **Gerado automaticamente** por `node scripts/gerar-mapa-rotas.js` a partir do código. Não edite à mão: rode o script de novo depois de mexer em rotas, menu ou abas.

## Convenção de endereço

```
/<módulo>/<rota>                 tela              ex.: /logistica/pcp
/<módulo>/<rota>/<aba>           tela com abas     ex.: /logistica/pcp/fila
/<módulo>/<rota>/<id>            detalhe           ex.: /comercial/cotacao-fornecedor-detail/<uuid>
/<módulo>/<rota>/<id>/<aba>      detalhe com abas  ex.: /comercial/formulario-quadro-comando/<uuid>/cabina
```

- O 1º segmento (**módulo**) vem do `BREADCRUMB_MAP` do `shell.jsx` via `MODULE_SLUG` do `router.js`; só o 2º segmento (a rota) decide o que abre.
- A **aba padrão** deixa a URL limpa (sem o último segmento). Aba inválida na URL cai na padrão.
- Abas entram na URL com `window.useRouteTab(rota, padrão, [válidas], comId?)` (em `router.js`).
- Rotas no roteador: **79** · itens de menu: **68** · telas com abas na URL: **10**.

## Verificações automáticas

- ✅ Nenhuma inconsistência: todo `case` está em `KNOWN_ROUTES`, todo item de menu tem rota, todo `setRoute` literal aponta para rota existente e não há rótulo de menu duplicado.

## Menu → rotas → endereços

### Geral

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Dashboard | `dashboard` | `/geral/dashboard` | — | — |
| Notificações | `notificacoes` | `/geral/notificacoes` | — | — |
| Central de Decisões | `decisoes` | `/geral/decisoes` | — | — |
| Prazos & Pendências | `financeiro` | `/adm-financeiro/financeiro` | — | — |
| Inbox | `inbox` | `/geral/inbox` | — | id na URL (passthrough) |

### CRM

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Leads | `leads` | `/crm/leads` | — | — |
| Canais | `crm-canais` | `/crm/crm-canais` | — | — |
| Conversão | `crm-conversao` | `/crm/crm-conversao` | — | — |
| Automação | `crm-automacao` | `/crm/crm-automacao` | — | — |
| Análise | `crm-analise` | `/crm/crm-analise` | — | — |

### Cadastros Mestres

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Clientes | `cadastro-clientes` | `/cadastros/cadastro-clientes` | — | — |
| Fornecedores | `cadastro-fornecedores` | `/cadastros/cadastro-fornecedores` | — | — |
| Matérias-Primas | `cadastro-materias-primas` | `/cadastros/cadastro-materias-primas` | — | — |
| Produtos | `cadastro-produtos` | `/cadastros/cadastro-produtos` | — | — |

### Comercial | Pré-venda

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Formulários | `formularios` | `/comercial/formularios` | — | — |
| Controle de Cotações | `controle-cotacoes` | `/comercial/controle-cotacoes` | — | — |
| Cotações a Fornecedor | `cotacoes-fornecedor` | `/adm-financeiro/cotacoes-fornecedor` | — | — |
| Cotação Quadro de Comando | `cotacao-quadro-comando` | `/comercial/cotacao-quadro-comando` | — | — |
| Propostas | `propostas` | `/comercial/propostas` | — | — |
| Contratos Social | `contratos-sociais` | `/comercial/contratos-sociais` | — | — |

### Financeiro & Preços

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Atualização de Custos | `cadastro-custos` | `/cadastros/cadastro-custos` | — | id na URL (passthrough) |
| Precificação | `precificacao` | `/comercial/precificacao` | — | id na URL (passthrough) |
| Aval Financeiro | `aval-financeiro` | `/adm-financeiro/aval-financeiro` | — | — |
| Emissão de NF | `emissao-nf` | `/adm-financeiro/emissao-nf` | — | — |
| Comissões | `comissoes` | `/adm-financeiro/comissoes` | — | — |

### Contratos & Jurídico

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Contrato Venda de Equipamentos | `contrato-venda-equipamentos` | `/juridico/contrato-venda-equipamentos` | — | — |
| Aval Jurídico | `aval-juridico` | `/juridico/aval-juridico` | — | — |
| Contratos & Minutas | `juridico` | `/juridico/juridico` | — | — |
| Painel | `gi-painel` | `/gestao-importacao/gi-painel` | — | — |
| P.I. | `pi-importacao` | `/gestao-importacao/pi-importacao` | — | — |
| RFQ | `rfq-importacao` | `/gestao-importacao/rfq-importacao` | — | — |
| IMS | `ims-importacao` | `/gestao-importacao/ims-importacao` | — | — |
| Embarques | `embarques-importacao` | `/gestao-importacao/embarques-importacao` | — | — |
| Importação | `importacao` | `/gestao-importacao/importacao[/<aba>]` | **embarques**, documentos, aduana | — |
| Análise de Preços | `gi-analise-precos` | `/gestao-importacao/gi-analise-precos` | — | — |
| Importação Varejo | `compras` | `/logistica/compras` | — | — |
| Pedidos | `pedidos-acompanhamento` | `/logistica/pedidos-acompanhamento[/<aba>]` | **Nacional**, Importação | — |

### Engenharia & Produto

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Engenharia | `engenharia` | `/engenharia/engenharia` | — | — |
| Projeto de Elevadores | `eng-projeto-elevadores` | `/engenharia/eng-projeto-elevadores` | — | — |
| Projeto de Equipamento | `eng-configurador` | `/engenharia/eng-configurador` | — | — |
| Projetos ER/Es | `desenho-tecnico` | `/engenharia/desenho-tecnico` | — | — |
| Solicitações de Produto | `solicitacoes-produto` | `/engenharia/solicitacoes-produto` | — | id na URL (passthrough) |
| Ficha Técnica | `ficha-tecnica` | `/engenharia/ficha-tecnica` | — | id na URL (passthrough) |
| Catálogo Siscomex | `ncm-catalogo` | `/cadastros/ncm-catalogo[/<aba>]` | **produtos**, operadores, pedidos | — |
| Linha do Tempo da Cotação | `linha-do-tempo` | `/engenharia/linha-do-tempo` | — | id na URL (passthrough) |

### Obras & Instalação

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Dossiês de Obras | `status-obras` | `/engenharia/status-obras` | — | — |
| Vistorias de Obras | `vistorias-envio` | `/engenharia/vistorias-envio[/<aba>]` | questionarios, **despacho**, calendario | — |
| Resultado Vistorias de Obras | `vistorias` | `/engenharia/vistorias` | — | id na URL (passthrough) |
| Instalação em Campo | `instalacao` | `/engenharia/instalacao` | — | — |
| Cronograma | `cronograma` | `/engenharia/cronograma` | — | — |
| ART | `art` | `/engenharia/art` | — | — |

### Entrega & Documentação

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Central de Documentos | `central-documentos` | `/engenharia/central-documentos` | — | id na URL (passthrough) |
| Data Book & Termo | `databook` | `/engenharia/databook` | — | — |
| Entrega Final | `handover` | `/engenharia/handover` | — | — |

### Parceiros & Instaladores

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Empresas Instaladoras | `cadastro-instaladores` | `/cadastros/cadastro-instaladores` | — | — |
| Homologação de Instaladores | `rh-homologacao` | `/rh/rh-homologacao` | — | — |
| Contrato Instalador | `contrato-instalador` | `/juridico/contrato-instalador` | — | — |
| Pagamentos a Instaladores | `pagamentos-instalador` | `/adm-financeiro/pagamentos-instalador` | — | — |

### Logística Interna

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Almoxarifado | `almoxarifado` | `/logistica/almoxarifado[/<aba>]` | **estoque**, estrutura, custos, reposicao, necessidade, pedidos | — |
| Carga Máquina | `carga-maquina` | `/logistica/carga-maquina[/<aba>]` | **capacidade**, maquinas, roteiro, recursos | — |
| Montagem do Produto | `montagem-produto` | `/logistica/montagem-produto` | — | — |
| Simulação | `simulacao-producao` | `/logistica/simulacao-producao` | — | — |
| PCP | `pcp` | `/logistica/pcp[/<aba>]` | **ordens**, fila, pedidos, planejamento, controle | — |
| MES | `mes` | `/logistica/mes` | — | — |
| Relatórios | `relatorios-pcp` | `/logistica/relatorios-pcp[/<aba>]` | **painel**, pedidos, precos, producao, perdas, estoque, fluxo, clientes, fotos | — |
| Expedição | `expedicao` | `/logistica/expedicao` | — | — |

### Administração

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Logs de Atividade | `logs` | `/admin/logs` | — | — |
| Configurações do Sistema | `configuracoes` | `/admin/configuracoes` | — | — |

## Telas fora do menu (detalhes e destinos de botões)

| Rota | Endereço | Abas | Como o F5 resolve | Se o registro não existe |
|---|---|---|---|---|
| `lead-detail` | `/crm/lead-detail/<id>` | — | id na URL (busca no banco) | volta para `leads` |
| `formulario-elevador` | `/comercial/formulario-elevador/<id>` | — | id na URL (passthrough) | — |
| `formulario-quadro-comando` | `/comercial/formulario-quadro-comando/<id>[/<aba>]` | **escopo**, configuracao, cabina, paradas, maquina, componentes, geometria, resultado | id na URL (passthrough) | — |
| `cotacao-fornecedor-detail` | `/comercial/cotacao-fornecedor-detail/<id>[/<aba>]` | **detalhes**, tratativas | id na URL (busca no banco) | volta para `cotacoes-fornecedor` |
| `proposta-editor` | `/comercial/proposta-editor/<id>` | — | id na URL (envelope) | — |
| `contrato-editor` | `/juridico/contrato-editor/<id>` | — | id na URL (busca no banco) | volta para `juridico` |
| `importacao-detail` | `/gestao-importacao/importacao-detail/<id>` | — | id na URL (busca no banco) | volta para `importacao` |
| `importacao-rastreamento` | `/gestao-importacao/importacao-rastreamento` | — | — | — |
| `ncm-kanban` | `/engenharia/ncm-kanban` | — | — | — |
| `ncm-detail` | `/engenharia/ncm-detail/<id>` | — | id na URL (busca no banco) | volta para `ncm-kanban` |
| `dossier-obra` | `/engenharia/dossier-obra/<id>` | — | id na URL (passthrough) | — |

## Botões que levam a outra tela

Navegação por `setRoute("destino")` com destino fixo no código. (Destinos calculados em tempo de execução — Notificações, Gatilhos/“Onde parou”, Central de Decisões, atalhos do PCP — usam tabelas próprias, conferidas contra `KNOWN_ROUTES` na verificação acima.)

| De | Botão / rótulo | Para | Endereço de destino | Onde no código |
|---|---|---|---|---|
| (? em central-documentos.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `central-documentos.jsx:79` |
| (? em central-documentos.jsx) | (acionado por um handler — ver o código) | `rh-homologacao` | `/rh/rh-homologacao` | `central-documentos.jsx:81` |
| (App em app.jsx) | (acionado por um handler — ver o código) | `dashboard` | `/geral/dashboard` | `app.jsx:338` |
| (CardContratoInstalador em dossier-obra.jsx) | Abrir no Jurídico → | `contrato-instalador` | `/juridico/contrato-instalador` | `dossier-obra.jsx:431` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `comercial.jsx:1099` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `comercial.jsx:1115` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `comercial.jsx:1036` |
| (LeadDetailView em comercial.jsx) | Voltar para Leads | `leads` | `/crm/leads` | `comercial.jsx:1126` |
| (NcmDashboardWidget em ncm-catalogo.jsx) | Ver todas | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:988` |
| (OndeParouWidget em dashboard.jsx) | Ver Prazos & Pendências | `financeiro` | `/adm-financeiro/financeiro` | `dashboard.jsx:419` |
| (PrecificacaoDetail em precificacao.jsx) | Gerar proposta | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:279` |
| (RPPainelProducao em painel-producao-pcp.jsx) | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `painel-producao-pcp.jsx:100` |
| (TabEquipamentos em dossier-obra.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `dossier-obra.jsx:967` |
| art | (acionado por um handler — ver o código) | `status-obras` | `/engenharia/status-obras` | `entrega.jsx:7` |
| cadastro-instaladores | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `cadastro-instaladores.jsx:79` |
| contrato-editor | Voltar para Contratos | `juridico` | `/juridico/juridico` | `contrato-editor.jsx:252` |
| contrato-editor | Voltar | `juridico` | `/juridico/juridico` | `contrato-editor.jsx:381` |
| controle-cotacoes | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `controle-cotacoes.jsx:111` |
| controle-cotacoes | Voltar | `formulario-elevador` | `/comercial/formulario-elevador` | `controle-cotacoes.jsx:145` |
| cotacao-fornecedor-detail | (acionado por um handler — ver o código) | `cotacoes-fornecedor` | `/adm-financeiro/cotacoes-fornecedor` | `cotacoes-fornecedor.jsx:411` |
| cotacao-fornecedor-detail | Voltar para Cotações a Fornecedor | `cotacoes-fornecedor` | `/adm-financeiro/cotacoes-fornecedor` | `cotacoes-fornecedor.jsx:439` |
| cotacao-quadro-comando | Abrir | `formulario-quadro-comando` | `/comercial/formulario-quadro-comando` | `cotacao-quadro-comando.jsx:200` |
| cotacoes-fornecedor | (acionado por um handler — ver o código) | `cotacao-fornecedor-detail` | `/comercial/cotacao-fornecedor-detail` | `cotacoes-fornecedor.jsx:202` |
| crm-canais | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `crm.jsx:87` |
| dashboard | Ir para Leads | `leads` | `/crm/leads` | `dashboard.jsx:243` |
| dashboard | (acionado por um handler — ver o código) | `notificacoes` | `/geral/notificacoes` | `dashboard.jsx:227` |
| dashboard | (acionado por um handler — ver o código) | `notificacoes` | `/geral/notificacoes` | `dashboard.jsx:251` |
| databook | (acionado por um handler — ver o código) | `status-obras` | `/engenharia/status-obras` | `entrega.jsx:42` |
| emissao-nf | Expedição → | `expedicao` | `/logistica/expedicao` | `emissao-nf.jsx:199` |
| emissao-nf | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `emissao-nf.jsx:183` |
| engenharia | Abrir obras | `status-obras` | `/engenharia/status-obras` | `operacoes.jsx:273` |
| engenharia | Abrir obras | `status-obras` | `/engenharia/status-obras` | `operacoes.jsx:322` |
| expedicao | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `expedicao.jsx:283` |
| formulario-elevador | (acionado por um handler — ver o código) | `controle-cotacoes` | `/comercial/controle-cotacoes` | `formulario-elevador.jsx:1763` |
| formulario-elevador | (acionado por um handler — ver o código) | `formularios` | `/comercial/formularios` | `formulario-elevador.jsx:1761` |
| formulario-quadro-comando | (acionado por um handler — ver o código) | `formularios` | `/comercial/formularios` | `quadro-comando.jsx:1001` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:437` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:485` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:507` |
| importacao | Mapa de navios | `importacao-rastreamento` | `/gestao-importacao/importacao-rastreamento` | `logistica.jsx:353` |
| importacao | Inbox | `inbox` | `/geral/inbox` | `logistica.jsx:352` |
| importacao-detail | Ver no Financeiro | `financeiro` | `/adm-financeiro/financeiro` | `logistica.jsx:778` |
| importacao-detail | (acionado por um handler — ver o código) | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:591` |
| importacao-detail | Voltar para Importação | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:596` |
| importacao-rastreamento | Voltar para Importação | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:981` |
| importacao-rastreamento | Abrir embarque | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:1093` |
| inbox | Voltar | `dashboard` | `/geral/dashboard` | `logistica.jsx:2158` |
| inbox | (acionado por um handler — ver o código) | `linha-do-tempo` | `/engenharia/linha-do-tempo` | `logistica.jsx:1883` |
| juridico | (acionado por um handler — ver o código) | `contrato-editor` | `/juridico/contrato-editor` | `operacoes.jsx:359` |
| lead-detail | (acionado por um handler — ver o código) | `leads` | `/crm/leads` | `comercial.jsx:1001` |
| leads | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `comercial.jsx:910` |
| leads | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `comercial.jsx:830` |
| leads | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `comercial.jsx:885` |
| ncm-catalogo | (acionado por um handler — ver o código) | `ficha-tecnica` | `/engenharia/ficha-tecnica` | `ncm-catalogo.jsx:424` |
| ncm-detail | (acionado por um handler — ver o código) | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:845` |
| ncm-detail | Voltar para Solicitações NCM | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:851` |
| ncm-kanban | (acionado por um handler — ver o código) | `ncm-detail` | `/engenharia/ncm-detail` | `ncm-catalogo.jsx:767` |
| ncm-kanban | (acionado por um handler — ver o código) | `ncm-detail` | `/engenharia/ncm-detail` | `ncm-catalogo.jsx:815` |
| proposta-editor | (acionado por um handler — ver o código) | `propostas` | `/comercial/propostas` | `proposta-editor.jsx:941` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:560` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:605` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:606` |
| status-obras | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `dossier-obra.jsx:63` |

## Estados internos que ainda NÃO têm endereço

São abas de formulário/modal, filtros, modos de visualização e passos de assistente. Ficam fora da URL de propósito (não são “submódulos”: trocar não muda de tela nem se compartilha por link). Listados para que nada fique escondido:

> Já têm endereço por implementação própria (por isso não aparecem abaixo): aba do Dossiê da Obra (`/engenharia/dossier-obra/<id>/<aba>`), aba de Configurações (`/admin/configuracoes/<aba>`), Ficha Técnica (`/engenharia/ficha-tecnica/<id>` e `/nova-ficha-tecnica`) e detalhe da Precificação (`/comercial/precificacao/<id>`).

| Onde | Componente | Estado | Valor inicial | Rotas que o exibem |
|---|---|---|---|---|
| `analise-tecnica.jsx:7` | AnaliseTecnicaWizard | `step` | `0` | (modal/componente interno) |
| `comercial.jsx:597` | LeadsPage | `view` | `"lista"` | `leads` |
| `cotacoes-fornecedor.jsx:76` | CotacoesFornecedorPage | `tab` | `'todos'` | `cotacoes-fornecedor` |
| `decisoes.jsx:294` | DecisoesPage | `aba` | `'pendentes'` | `decisoes` |
| `decisoes.jsx:298` | DecisoesPage | `modoAdmin` | `false` | `decisoes` |
| `dossier-obra.jsx:740` | TermoEntregaPanel | `modo` | `'self_service'` | `dossier-obra`, `status-obras` |
| `dossier-obra.jsx:1423` | FormAdicionarItemTemplate | `etapa` | `''` | `dossier-obra`, `status-obras` |
| `embarques-importacao.jsx:278` | EmbarqueImportacaoForm | `tab` | `'identificacao'` | `embarques-importacao` |
| `ims.jsx:74` | IMSForm | `tab` | `'identificacao'` | `ims-importacao` |
| `ims.jsx:340` | IMSPage | `activeTab` | `'todos'` | `ims-importacao` |
| `logistica.jsx:1715` | EmailInbox | `modoCompose` | `'responder'` | `inbox` |
| `ncm-catalogo.jsx:678` | NcmKanbanPage | `view` | `"kanban"` | `ncm-kanban` |
| `pi.jsx:360` | PIForm | `tab` | `'id'` | `pi-importacao` |
| `precificacao-elevador.jsx:222` | ModalAcrescentarEquipamento | `modo` | `grupos.length ? 'identico' : '` | (modal/componente interno) |
| `precificacao.jsx:20` | PrecificacaoPage | `modo` | `'elevador'` | `precificacao` |
| `rfq.jsx:21` | RFQForm | `modoGlobal` | `!!(initialData && initialData.` | `rfq-importacao` |
| `solicitacoes-produto.jsx:7` | SolicitacoesProdutoPage | `view` | `solicitacaoId ? 'detalhe' : 'l` | `solicitacoes-produto` |
| `termo-entrega-app.jsx:166` | ? | `passo` | `'cliente'` | (modal/componente interno) |
