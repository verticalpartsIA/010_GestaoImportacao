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
- Rotas no roteador: **89** · itens de menu: **75** · telas com abas na URL: **17**.

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
| Contrato Venda de Equipamentos | `contrato-venda-equipamentos` | `/juridico/contrato-venda-equipamentos[/<aba>]` | **painel**, novo | — |
| Aval Jurídico | `aval-juridico` | `/juridico/aval-juridico` | — | — |
| Contratos & Minutas | `juridico` | `/juridico/juridico` | — | — |
| Painel | `gi-painel` | `/gestao-importacao/gi-painel` | — | — |
| P.I. | `pi-importacao` | `/gestao-importacao/pi-importacao` | — | — |
| RFQ | `rfq-importacao` | `/gestao-importacao/rfq-importacao` | — | — |
| IMS | `ims-importacao` | `/gestao-importacao/ims-importacao` | — | — |
| Embarques | `embarques-importacao` | `/gestao-importacao/embarques-importacao[/<aba>]` | **identificacao**, pagamentos, frete, embarque, aduaneiro, faturamento, entrega | — |
| Rastreio Marítimo | `importacao` | `/gestao-importacao/importacao[/<aba>]` | **embarques**, documentos, aduana | — |
| Análise de Preços | `gi-analise-precos` | `/gestao-importacao/gi-analise-precos` | — | — |
| Catálogo Siscomex | `ncm-catalogo` | `/gestao-importacao/ncm-catalogo[/<aba>]` | **produtos**, operadores, pedidos | — |
| Importação Varejo | `compras` | `/logistica/compras` | — | — |
| Cotações de Varejo | `cotacoes-varejo` | `/logistica/cotacoes-varejo` | — | — |
| Pedidos | `pedidos-acompanhamento` | `/logistica/pedidos-acompanhamento[/<aba>]` | **Nacional**, Importação | — |

### Engenharia & Produto

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Projeto de Elevadores | `eng-projeto-elevadores` | `/engenharia/eng-projeto-elevadores` | — | — |
| Projeto de Equipamento | `eng-configurador` | `/engenharia/eng-configurador` | — | — |
| Solicitações de Produto | `solicitacoes-produto` | `/engenharia/solicitacoes-produto` | — | id na URL (passthrough) |
| Ficha Técnica | `ficha-tecnica` | `/engenharia/ficha-tecnica` | — | id na URL (passthrough) |
| Linha do Tempo da Cotação | `linha-do-tempo` | `/engenharia/linha-do-tempo` | — | id na URL (passthrough) |

### Obras & Instalação

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Dossiês de Obras | `status-obras` | `/engenharia/status-obras` | — | — |
| Vistorias de Obras | `vistorias-envio` | `/engenharia/vistorias-envio[/<aba>]` | questionarios, **despacho**, calendario | — |
| Resultado Vistorias de Obras | `vistorias` | `/engenharia/vistorias` | — | id na URL (passthrough) |
| Instalação em Campo | `instalacao` | `/engenharia/instalacao` | — | — |
| Mapa de Obras | `mapa-obras` | `/engenharia/mapa-obras` | — | — |
| ART | `art` | `/engenharia/art` | — | — |

### Entrega & Documentação

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Central de Documentos | `central-documentos` | `/engenharia/central-documentos` | — | id na URL (passthrough) |
| Data Book & Termo | `databook` | `/engenharia/databook` | — | — |
| Entrega Final | `handover` | `/engenharia/handover` | — | — |
| Repositório Documentos | `repositorio-documentos` | `/engenharia/repositorio-documentos` | — | — |

### Parceiros & Instaladores

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Empresas Instaladoras | `cadastro-instaladores` | `/cadastros/cadastro-instaladores` | — | — |
| Homologação de Instaladores | `rh-homologacao` | `/rh/rh-homologacao` | — | — |
| Contrato Instalador | `contrato-instalador` | `/juridico/contrato-instalador[/<aba>]` | **painel**, novo | — |
| Pagamentos a Instaladores | `pagamentos-instalador` | `/adm-financeiro/pagamentos-instalador[/<aba>]` | **parcelas**, acordos, recibos | — |
| Cronograma de Pagamento da Instalação | `cronograma` | `/engenharia/cronograma` | — | — |

### Logística Interna

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| Almoxarifado | `almoxarifado` | `/logistica/almoxarifado[/<aba>]` | **estoque**, estrutura, custos, reposicao, necessidade, ajustes, pedidos | — |
| Expedição | `expedicao` | `/logistica/expedicao` | — | — |
| Separação | `separacao` | `/logistica/separacao[/<aba>]` | **pedidos**, tv | — |
| Etiquetas | `etiquetas` | `/logistica/etiquetas[/<aba>]` | **gerar**, modelos, historico | — |

### Fabricação

| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |
|---|---|---|---|---|
| PCP | `pcp` | `/logistica/pcp[/<aba>]` | **ordens**, fila, pedidos, planejamento, controle | — |
| MES | `mes` | `/logistica/mes[/<aba>]` | **kanban**, painel, ordens, apontamentos, tv | — |
| MES · Cadastros | `mes-cadastros` | `/logistica/mes-cadastros` | — | — |
| Carga Máquina | `carga-maquina` | `/logistica/carga-maquina[/<aba>]` | **capacidade**, maquinas, roteiro, recursos | — |
| Matérias-Primas | `cadastro-materias-primas` | `/geral/cadastro-materias-primas` | — | — |
| Produtos | `cadastro-produtos` | `/geral/cadastro-produtos` | — | — |
| Montagem do Produto | `montagem-produto` | `/logistica/montagem-produto` | — | — |
| Evolução da Fabricação | `evolucao-fabricacao` | `/logistica/evolucao-fabricacao` | — | — |
| Fabricação Corrimão | `fabricacao-corrimao` | `/logistica/fabricacao-corrimao` | — | — |
| Fabricação Corte | `fabricacao-corte` | `/logistica/fabricacao-corte` | — | — |
| Simulação | `simulacao-producao` | `/logistica/simulacao-producao` | — | — |
| Relatórios | `relatorios-pcp` | `/logistica/relatorios-pcp[/<aba>]` | **painel**, pedidos, precos, producao, perdas, estoque, fluxo, clientes, fotos | — |

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
| `formulario-escada` | `/comercial/formulario-escada/<id>` | — | id na URL (passthrough) | — |
| `formulario-esteira` | `/comercial/formulario-esteira/<id>` | — | id na URL (passthrough) | — |
| `formulario-quadro-comando` | `/comercial/formulario-quadro-comando/<id>[/<aba>]` | **escopo**, configuracao, cabina, paradas, maquina, componentes, geometria, resultado | id na URL (passthrough) | — |
| `cotacao-fornecedor-detail` | `/comercial/cotacao-fornecedor-detail/<id>[/<aba>]` | **detalhes**, tratativas, imagens, documentos | id na URL (busca no banco) | volta para `cotacoes-fornecedor` |
| `proposta-editor` | `/comercial/proposta-editor/<id>` | — | id na URL (envelope) | — |
| `contrato-editor` | `/juridico/contrato-editor/<id>` | — | id na URL (busca no banco) | volta para `juridico` |
| `importacao-detail` | `/gestao-importacao/importacao-detail/<id>` | — | id na URL (busca no banco) | volta para `importacao` |
| `importacao-rastreamento` | `/gestao-importacao/importacao-rastreamento` | — | — | — |
| `engenharia` | `/engenharia/engenharia` | — | — | — |
| `ncm-kanban` | `/engenharia/ncm-kanban` | — | — | — |
| `ncm-detail` | `/engenharia/ncm-detail/<id>` | — | id na URL (busca no banco) | volta para `ncm-kanban` |
| `dossier-obra` | `/engenharia/dossier-obra/<id>` | — | id na URL (passthrough) | — |

## Botões que levam a outra tela

Navegação por `setRoute("destino")` com destino fixo no código. (Destinos calculados em tempo de execução — Notificações, Gatilhos/“Onde parou”, Central de Decisões, atalhos do PCP — usam tabelas próprias, conferidas contra `KNOWN_ROUTES` na verificação acima.)

| De | Botão / rótulo | Para | Endereço de destino | Onde no código |
|---|---|---|---|---|
| (? em central-documentos.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `central-documentos.jsx:84` |
| (? em central-documentos.jsx) | (acionado por um handler — ver o código) | `rh-homologacao` | `/rh/rh-homologacao` | `central-documentos.jsx:86` |
| (App em app.jsx) | (acionado por um handler — ver o código) | `dashboard` | `/geral/dashboard` | `app.jsx:348` |
| (CardContratoInstalador em dossier-obra.jsx) | Abrir no Jurídico → | `contrato-instalador` | `/juridico/contrato-instalador` | `dossier-obra.jsx:600` |
| (CVDetalhe em cotacoes-varejo.jsx) | (acionado por um handler — ver o código) | `cadastro-fornecedores` | `/cadastros/cadastro-fornecedores` | `cotacoes-varejo.jsx:637` |
| (CVLista em cotacoes-varejo.jsx) | Ir para Importação Varejo | `compras` | `/logistica/compras` | `cotacoes-varejo.jsx:51` |
| (DetalheView em solicitacoes-produto.jsx) | (acionado por um handler — ver o código) | `ficha-tecnica` | `/engenharia/ficha-tecnica` | `solicitacoes-produto.jsx:796` |
| (irParaContratoInstalador em pagamentos-instalador.jsx) | (acionado por um handler — ver o código) | `contrato-instalador` | `/juridico/contrato-instalador` | `pagamentos-instalador.jsx:22` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `comercial.jsx:1188` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `comercial.jsx:1204` |
| (LeadDetailView em comercial.jsx) | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `comercial.jsx:1113` |
| (LeadDetailView em comercial.jsx) | Voltar para Leads | `leads` | `/crm/leads` | `comercial.jsx:1215` |
| (NcmDashboardWidget em ncm-catalogo.jsx) | Ver todas | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:885` |
| (OndeParouWidget em dashboard.jsx) | Ver Prazos & Pendências | `financeiro` | `/adm-financeiro/financeiro` | `dashboard.jsx:479` |
| (PrecificacaoDetail em precificacao.jsx) | Gerar proposta | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:298` |
| (RPPainelProducao em painel-producao-pcp.jsx) | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `painel-producao-pcp.jsx:100` |
| (TabEquipamentos em dossier-obra.jsx) | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `dossier-obra.jsx:1166` |
| cadastro-instaladores | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `cadastro-instaladores.jsx:105` |
| compras | (acionado por um handler — ver o código) | `cotacoes-varejo` | `/logistica/cotacoes-varejo` | `importacao-varejo.jsx:619` |
| compras | (acionado por um handler — ver o código) | `cotacoes-varejo` | `/logistica/cotacoes-varejo` | `importacao-varejo.jsx:863` |
| contrato-editor | Voltar para Contratos | `juridico` | `/juridico/juridico` | `contrato-editor.jsx:258` |
| contrato-editor | Voltar | `juridico` | `/juridico/juridico` | `contrato-editor.jsx:387` |
| controle-cotacoes | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `controle-cotacoes.jsx:138` |
| controle-cotacoes | Voltar | `formulario-elevador` | `/comercial/formulario-elevador` | `controle-cotacoes.jsx:217` |
| cotacao-fornecedor-detail | (acionado por um handler — ver o código) | `cotacoes-fornecedor` | `/adm-financeiro/cotacoes-fornecedor` | `cotacoes-fornecedor.jsx:533` |
| cotacao-fornecedor-detail | Voltar para Cotações a Fornecedor | `cotacoes-fornecedor` | `/adm-financeiro/cotacoes-fornecedor` | `cotacoes-fornecedor.jsx:561` |
| cotacao-quadro-comando | Abrir | `formulario-quadro-comando` | `/comercial/formulario-quadro-comando` | `cotacao-quadro-comando.jsx:228` |
| cotacoes-fornecedor | (acionado por um handler — ver o código) | `cotacao-fornecedor-detail` | `/comercial/cotacao-fornecedor-detail` | `cotacoes-fornecedor.jsx:231` |
| crm-canais | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `crm.jsx:113` |
| dashboard | Ir para Leads | `leads` | `/crm/leads` | `dashboard.jsx:282` |
| dashboard | (acionado por um handler — ver o código) | `notificacoes` | `/geral/notificacoes` | `dashboard.jsx:265` |
| dashboard | (acionado por um handler — ver o código) | `notificacoes` | `/geral/notificacoes` | `dashboard.jsx:298` |
| databook | (acionado por um handler — ver o código) | `status-obras` | `/engenharia/status-obras` | `entrega.jsx:13` |
| emissao-nf | Expedição → | `expedicao` | `/logistica/expedicao` | `emissao-nf.jsx:215` |
| emissao-nf | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `emissao-nf.jsx:199` |
| engenharia | Abrir obras | `status-obras` | `/engenharia/status-obras` | `operacoes.jsx:273` |
| engenharia | Abrir obras | `status-obras` | `/engenharia/status-obras` | `operacoes.jsx:322` |
| expedicao | (acionado por um handler — ver o código) | `pcp` | `/logistica/pcp` | `expedicao.jsx:301` |
| formulario-elevador, formulario-escada, formulario-esteira | (acionado por um handler — ver o código) | `controle-cotacoes` | `/comercial/controle-cotacoes` | `formulario-elevador.jsx:2132` |
| formulario-elevador, formulario-escada, formulario-esteira | (acionado por um handler — ver o código) | `formularios` | `/comercial/formularios` | `formulario-elevador.jsx:2130` |
| formulario-quadro-comando | (acionado por um handler — ver o código) | `formularios` | `/comercial/formularios` | `quadro-comando.jsx:1208` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:496` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:547` |
| importacao | (acionado por um handler — ver o código) | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:572` |
| importacao | Mapa de navios | `importacao-rastreamento` | `/gestao-importacao/importacao-rastreamento` | `logistica.jsx:407` |
| importacao | Inbox | `inbox` | `/geral/inbox` | `logistica.jsx:406` |
| importacao-detail | Ver no Financeiro | `financeiro` | `/adm-financeiro/financeiro` | `logistica.jsx:845` |
| importacao-detail | (acionado por um handler — ver o código) | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:656` |
| importacao-detail | Voltar para Importação | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:661` |
| importacao-rastreamento | Voltar para Importação | `importacao` | `/gestao-importacao/importacao` | `logistica.jsx:1066` |
| importacao-rastreamento | Abrir embarque | `importacao-detail` | `/gestao-importacao/importacao-detail` | `logistica.jsx:1178` |
| inbox | Voltar | `dashboard` | `/geral/dashboard` | `logistica.jsx:2324` |
| inbox | (acionado por um handler — ver o código) | `linha-do-tempo` | `/engenharia/linha-do-tempo` | `logistica.jsx:2042` |
| instalacao | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `operacoes.jsx:850` |
| juridico | (acionado por um handler — ver o código) | `contrato-editor` | `/juridico/contrato-editor` | `operacoes.jsx:361` |
| juridico | (acionado por um handler — ver o código) | `contrato-venda-equipamentos` | `/juridico/contrato-venda-equipamentos` | `operacoes.jsx:359` |
| lead-detail | (acionado por um handler — ver o código) | `leads` | `/crm/leads` | `comercial.jsx:1073` |
| leads | (acionado por um handler — ver o código) | `formulario-elevador` | `/comercial/formulario-elevador` | `comercial.jsx:978` |
| leads | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `comercial.jsx:898` |
| leads | (acionado por um handler — ver o código) | `lead-detail` | `/crm/lead-detail` | `comercial.jsx:953` |
| mapa-obras | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `mapa-obras.jsx:151` |
| ncm-catalogo | (acionado por um handler — ver o código) | `ficha-tecnica` | `/engenharia/ficha-tecnica` | `ncm-catalogo.jsx:318` |
| ncm-detail | (acionado por um handler — ver o código) | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:742` |
| ncm-detail | Voltar para Solicitações NCM | `ncm-kanban` | `/engenharia/ncm-kanban` | `ncm-catalogo.jsx:748` |
| ncm-kanban | (acionado por um handler — ver o código) | `ncm-detail` | `/engenharia/ncm-detail` | `ncm-catalogo.jsx:664` |
| ncm-kanban | (acionado por um handler — ver o código) | `ncm-detail` | `/engenharia/ncm-detail` | `ncm-catalogo.jsx:712` |
| proposta-editor | (acionado por um handler — ver o código) | `propostas` | `/comercial/propostas` | `proposta-editor.jsx:1047` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:596` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:685` |
| propostas | (acionado por um handler — ver o código) | `proposta-editor` | `/comercial/proposta-editor` | `precificacao.jsx:686` |
| status-obras | (acionado por um handler — ver o código) | `dossier-obra` | `/engenharia/dossier-obra` | `dossier-obra.jsx:71` |

## Estados internos que ainda NÃO têm endereço

São abas de formulário/modal, filtros, modos de visualização e passos de assistente. Ficam fora da URL de propósito (não são “submódulos”: trocar não muda de tela nem se compartilha por link). Listados para que nada fique escondido:

> Já têm endereço por implementação própria (por isso não aparecem abaixo): aba do Dossiê da Obra (`/engenharia/dossier-obra/<id>/<aba>`), aba de Configurações (`/admin/configuracoes/<aba>`), Ficha Técnica (`/engenharia/ficha-tecnica/<id>` e `/nova-ficha-tecnica`) e detalhe da Precificação (`/comercial/precificacao/<id>`).

| Onde | Componente | Estado | Valor inicial | Rotas que o exibem |
|---|---|---|---|---|
| `analise-tecnica.jsx:7` | AnaliseTecnicaWizard | `step` | `0` | (modal/componente interno) |
| `comercial.jsx:643` | LeadsPage | `view` | `"lista"` | `leads` |
| `cotacoes-fornecedor.jsx:76` | CotacoesFornecedorPage | `tab` | `'todos'` | `cotacoes-fornecedor` |
| `decisoes.jsx:302` | DecisoesPage | `aba` | `'pendentes'` | `decisoes` |
| `decisoes.jsx:306` | DecisoesPage | `modoAdmin` | `false` | `decisoes` |
| `dossier-obra.jsx:939` | TermoEntregaPanel | `modo` | `'self_service'` | `dossier-obra`, `status-obras` |
| `dossier-obra.jsx:1622` | FormAdicionarItemTemplate | `etapa` | `''` | `dossier-obra`, `status-obras` |
| `formulario-quadro-comando-publico.jsx:253` | ? | `passo` | `0` | (modal/componente interno) |
| `ims.jsx:75` | IMSForm | `tab` | `'identificacao'` | `ims-importacao` |
| `ims.jsx:342` | IMSPage | `activeTab` | `'todos'` | `ims-importacao` |
| `lista-fios.jsx:46` | ListaFiosView | `aba` | `'fios'` | (modal/componente interno) |
| `logistica.jsx:1860` | EmailInbox | `modoCompose` | `'responder'` | `inbox` |
| `ncm-catalogo.jsx:574` | NcmKanbanPage | `view` | `"kanban"` | `ncm-kanban` |
| `pi.jsx:445` | PIForm | `tab` | `'id'` | `pi-importacao` |
| `precificacao-elevador.jsx:484` | ModalAcrescentarEquipamento | `modo` | `grupos.length ? 'identico' : '` | (modal/componente interno) |
| `precificacao-memoria.jsx:46` | PZMemoriaCalculo | `aba` | `'resumo'` | (modal/componente interno) |
| `precificacao.jsx:20` | PrecificacaoPage | `modo` | `'elevador'` | `precificacao` |
| `proposta-form.jsx:1296` | S_Conteudo | `aba` | `null` | (modal/componente interno) |
| `recibo-instalador-app.jsx:62` | ReciboApp | `modo` | `'assinar'` | (modal/componente interno) |
| `rfq.jsx:22` | RFQForm | `modoGlobal` | `!!(initialData && initialData.` | `rfq-importacao` |
| `solicitacoes-produto.jsx:16` | SolicitacoesProdutoPage | `view` | `solicitacaoId ? 'detalhe' : 'l` | `solicitacoes-produto` |
| `termo-entrega-app.jsx:166` | ? | `passo` | `'cliente'` | (modal/componente interno) |
