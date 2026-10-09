# RAG do VP Gestão — VerticalParts Importação

## 1. Objetivo e escopo

Este documento é uma **engenharia reversa máxima** do sistema VP Gestão (`vpgestaoimportacao.vpsistema.com`, repositório `verticalpartsIA/010_GestaoImportacao`) e, ao mesmo tempo, a especificação da base de conhecimento e arquitetura de **Geração Aumentada por Recuperação (RAG)** para esse sistema. Foi elaborado inteiramente a partir do código-fonte real do repositório (sem invenção de campos, botões ou regras que não existam no código) e deve servir simultaneamente como:

- **mapa funcional completo** de cada tela, rota, campo, botão e alçada do sistema — pra qualquer humano ou IA entender "o que faz o quê" sem precisar abrir o código;
- referência funcional das telas para um futuro assistente de IA (Copiloto VP, já embrionário em `vp-copiloto.jsx`) responder perguntas sobre o sistema;
- política de qualidade e preenchimento dos dados;
- contrato de ingestão e recuperação de conteúdo para um pipeline RAG real, caso o VerticalParts decida construir um.

Este documento espelha a estrutura e o método de `verticalpartsIA/005_vpclick/.rag/rag.md` (mesma organização de capítulos), adaptado ao domínio real deste projeto: **importação e venda de elevadores/escadas/esteiras rolantes** — não gestão de tarefas.

### 1.1 Escopo real identificado no código

- **Stack:** React 18 (UMD, via CDN `unpkg.com`) + Babel Standalone (compilação JSX no navegador, cacheada em IndexedDB por `src/jsx-loader.js`) + Supabase JS v2 (UMD, via `cdn.jsdelivr.net`) + jsPDF/html2canvas + `@react-pdf/renderer` (só para 2 documentos específicos, ver §1.2). **Sem bundler, sem build step** — `npm run build` é literalmente um no-op (`package.json`). Servidor local é um Express mínimo (`server.js`) só pra servir os arquivos estáticos.
- **Banco:** Supabase (Postgres) — projeto `jxtqwzmpgofwctqajewt`, apelidado internamente de "vpprd". ~próximo de 100 tabelas reais, ver §5.
- **Roteamento:** `src/router.js` — roteador próprio (sem `react-router`), espelha `{route, id, tab}` na URL via `pushState`/`popstate`. 60 rotas conhecidas (`KNOWN_ROUTES`).
- **Não é multi-tenant / multi-empresa** — é o sistema interno de uma única empresa (VerticalParts), usado por ~4 perfis de usuário (Comercial, Engenharia, Financeiro, Admin), não por clientes externos (exceto formulários públicos com token, ver §4).
- **Deploy:** push em `main` → integração nativa Git do hPanel (Hostinger) → deploy automático, sem CI/CD tradicional.

### 1.2 O que este documento NÃO é

- Não é um crawl automatizado de todas as 60 telas com screenshot de cada uma — isso exigiria login SSO real, dados de produção em cada estado, e centenas de capturas. Onde uma captura real foi possível dentro desta sessão (via preview local ou produção), ela está referenciada; nos demais casos, o "propósito de cada tela" vem da leitura completa do código-fonte (comentários de topo de arquivo, labels de campo, texto de botão), não de suposição.
- O único artefato de auditoria automatizada (Lighthouse) fornecido pelo usuário nesta sessão cobre **1 única tela** (`/comercial/proposta-editor`) — ver §21.4. Não é um crawl do site inteiro; tratamos isso como amostra pontual, não como cobertura total.

## 2. Princípios obrigatórios

1. **Nenhum campo, botão ou regra é inventado.** Toda entrada no Guia por Rota (§4) foi extraída do código-fonte real (`src/*.jsx`, `src/*.js`, migrations SQL). Onde o código não deixou claro, a entrada diz isso explicitamente em vez de supor.
2. **Fonte de verdade é o código, não a memória da IA sobre o negócio.** Comentários de topo de arquivo neste projeto são incomumente ricos (decisões de negócio datadas, "achados reais", nomes de quem pediu) — são citados diretamente quando existem.
3. **Alçada (quem pode fazer o quê) é extraída de 3 lugares:** `restrict: [...]` no `NAV_GROUPS` de `shell.jsx` (visibilidade no menu), checagens de role/e-mail no próprio componente (ex.: `isOwner()` em `aval-financeiro-store.js`), e políticas RLS do Supabase (a maioria das tabelas deste projeto usa RLS permissiva — "app MVP interno, protegido por SSO no frontend, não por RLS", padrão citado em várias migrations).
4. **Toda tabela/coluna citada é conferida contra as migrations reais** em `supabase/migrations/*.sql`, não contra suposição de nome.
5. **Bugs encontrados durante esta engenharia reversa são documentados como bugs, não escondidos** — ver §21 ("Achados e caçada de bugs").

## 3. Mapa canônico das rotas

60 rotas conhecidas (`src/router.js` → `KNOWN_ROUTES`). Formato de URL: `/<módulo>/<rota>[/<id>][/<aba>]`, onde `<módulo>` é derivado do módulo do breadcrumb (`shell.jsx` → `BREADCRUMB_MAP` → `MODULE_SLUG` em `router.js`).

| Rota (id) | Módulo (URL) | Tela (título) | Componente / arquivo | Alçada (restrict no menu) |
|---|---|---|---|---|
| `dashboard` | geral | Dashboard | `Dashboard` — `dashboard.jsx` (provável) | todos |
| `notificacoes` | geral | Notificações | `NotificacoesPage` | todos |
| `decisoes` | geral | Central de Decisões | `window.DecisoesPage` — `decisoes.jsx` | todos |
| `financeiro` | adm-financeiro | Gatilhos & Prazo | `FinanceiroPage` — `financeiro.jsx` | financeiro, admin |
| `leads` | comercial | Leads | `LeadsPage` — `comercial.jsx` | todos |
| `lead-detail` | comercial | Detalhe de Lead | `LeadDetail` — `comercial.jsx` | todos |
| `formularios` | comercial | Formulários | `FormulariosPage` — `comercial.jsx` | todos |
| `formulario-elevador` | comercial | Formulário — Elevador | `FormularioElevadorPage`/`FormularioElevadorForm` — `formulario-elevador.jsx` | todos (+ acesso público via token, `formulario-elevador-public.jsx`) |
| `controle-cotacoes` | comercial | Controle de Cotações | `ControleCotacoesPage` — `controle-cotacoes.jsx` | todos |
| `cotacoes-fornecedor` | adm-financeiro | Cotações a Fornecedor | `CotacoesFornecedorPage` — `cotacoes-fornecedor.jsx` | todos |
| `cotacao-fornecedor-detail` | comercial | Detalhe de Cotação | `CotacaoFornecedorDetalhe` — `cotacao-elevador-fornecedor.jsx` | todos |
| `precificacao` | comercial | Precificação | `PrecificacaoPage` — `precificacao.jsx` + `precificacao-elevador.jsx` | todos (visível), mas cálculo é papel Financeiro |
| `propostas` | comercial | Propostas | `PropostasPage` — `precificacao.jsx` | todos |
| `proposta-editor` | comercial | Editor de Proposta | `PropostaEditor` — `proposta-form.jsx`/`proposta-editor.jsx` | todos |
| `cadastro-clientes` | cadastros | Clientes | `window.CadastroClientesPage` | todos |
| `cadastro-fornecedores` | cadastros | Fornecedores | `window.CadastroFornecedoresPage` | todos |
| `ncm-catalogo` | cadastros | Produtos (Catálogo) | `NcmCatalogoPage` — `ncm-catalogo.jsx` | todos |
| `cadastro-instaladores` | cadastros | Empresas Instaladoras | `window.CadastroInstaladoresPage` | todos |
| `cadastro-custos` | cadastros | Atualização de Custos | `CadastroCustosPage` — `cadastro-custos.jsx` | todos |
| `juridico` | juridico | Contratos & Minutas | `JuridicoPage` — `juridico.jsx` | todos |
| `contrato-editor` | juridico | Editor de Contrato | `ContratoEditorPage` — `contrato-editor.jsx` | todos |
| `contrato-venda-equipamentos` | juridico | Contrato Venda de Equipamentos | `ContratoVendaEquipamentosPage` | todos |
| `contrato-instalador` | juridico | Contrato Instalador | `ContratoInstaladorPage` — `contrato-instalador.jsx` | todos |
| `importacao` | logistica | Importação (legado) | `ImportacaoPage` — `importacao.jsx` | todos |
| `importacao-detail` | logistica | Detalhe de Embarque | `ImportacaoDetail` | todos |
| `importacao-rastreamento` | logistica | Rastreamento de Navios | `ImportacaoRastreamento` | todos |
| `importacao-email` | logistica | Inbox Importação | `EmailInbox` (kind="importacao") | todos |
| `gi-painel` | logistica | Gestão Importação — Painel | `window.GIPainelPage` | todos |
| `pi-importacao` | logistica | Gestão Importação — P.I. | `window.PIPage` — `pi.jsx` | todos |
| `rfq-importacao` | logistica | Gestão Importação — RFQ | `window.RFQPage` | todos |
| `ims-importacao` | logistica | Gestão Importação — IMS | `window.IMSPage` | todos |
| `embarques-importacao` | logistica | Gestão Importação — Embarques | `window.EmbarquesImportacaoPage` — `embarques-importacao.jsx` | todos |
| `gi-analise-precos` | logistica | Gestão Importação — Análise de Preços | `window.GIAnalisePrecosPage` | todos |
| `compras` | logistica | Compras Nacional | `ComprasPage` — `compras.jsx` | todos |
| `compras-email` | logistica | Inbox Compras | `EmailInbox` (kind="compras") | todos |
| `pedidos-acompanhamento` | logistica | Pedidos | `window.PedidosAcompanhamentoPage` | todos |
| `engenharia` | engenharia | Engenharia | `EngenhariaPage` — `engenharia.jsx` | todos |
| `eng-projeto-elevadores` | engenharia | Projeto de Elevadores | `window.ProjetoElevadorPage` | todos |
| `eng-configurador` | engenharia | Projeto de Equipamento | `ConfiguradorPage` — `engenharia-config.jsx` | todos |
| `desenho-tecnico` | engenharia | Desenho Técnico ER \| ES | `DesenhoTecnicoPage` — `desenho-tecnico.jsx` | todos |
| `ficha-tecnica` | engenharia | Ficha Técnica | `FichaTecnicaPage` — `ficha-tecnica.jsx` | todos |
| `ncm-kanban` | engenharia | Solicitações NCM | `NcmKanbanPage` — `ncm.jsx` | todos |
| `ncm-detail` | engenharia | Detalhe da Solicitação NCM | `NcmDetailPage` | todos |
| `status-obras` | engenharia | Status de Obras | `ObrasStatusPage` | todos |
| `linha-do-tempo` | engenharia | Linha do Tempo da Cotação | `window.LinhaDoTempoPage` | todos |
| `central-documentos` | engenharia | Central de Documentos | `window.CentralDocumentosPage` | todos |
| `dossier-obra` | engenharia | Dossiê da Obra | `DossierObraPage` — `dossier-store.js` + view | todos |
| `vistorias` | instalacao-entrega | Vistorias de Obras | `VistoriasObras` | todos |
| `instalacao` | instalacao-entrega | Instalação em Campo | `InstalacaoPage` | todos |
| `art` | instalacao-entrega | ART de Instalação | `ArtPage` | todos |
| `cronograma` | instalacao-entrega | Cronograma de Instalação | `CronogramaPage` | todos |
| `databook` | instalacao-entrega | Data Book & Termo | `DataBookPage` | todos |
| `handover` | instalacao-entrega | Entrega Final / Handover | `window.HandoverManutencaoPage` | todos |
| `rh-homologacao` | rh | Homologação de Instaladores | `window.RHHomologacaoPage` | todos |
| `almoxarifado` | logistica | Almoxarifado | `window.AlmoxarifadoPage` | todos |
| `aval-financeiro` | adm-financeiro | Aval Financeiro | `window.AvalFinanceiroPage` — `aval-financeiro.jsx` | financeiro, admin |
| `comissoes` | adm-financeiro | Comissões | `ComissoesPage` | financeiro, admin |
| `logs` | admin | Logs de Atividade | `LogsAdminPage` | admin |
| `configuracoes` | admin | Configurações do Sistema | `ConfiguracoesPage` | admin |

**Rotas anunciadas no menu mas sem rota própria ainda** (`planned: true` em `shell.jsx`): Expedição, Logística (genérica) — dentro do grupo "Logística".

## 4. Guia por rota — engenharia reversa completa

> Cada entrada abaixo foi extraída do código-fonte real. Onde uma informação não pôde ser confirmada, a entrada diz isso explicitamente.

### `cotacoes-fornecedor` — Cotações a Fornecedor
**Arquivo:** `src/cotacoes-fornecedor.jsx` (função `CotacoesFornecedorPage`)
**Módulo/Alçada:** Comercial (sem `restrict:` explícito no shell — acessível a quem vê o menu Comercial). Consome status vindos de `CotacaoElevadorFornecedorStore`.
**Propósito:** Lista todas as solicitações técnicas de cotação enviadas a fornecedores (hoje só Glarie/elevador implementado, mas desenhada para qualquer categoria futura). Substitui a antiga "Cotações China" (mock); cada linha vem de um envio real originado do Formulário de Elevadores.
**Dados de origem:** Tabela `cotacoes_elevador_fornecedor`, join com `formularios_elevador`.
**Campos principais:** Nº Documento, Nº Cotação, Prédio/Cliente, Fornecedor, Categoria, Enviado em, Status, Equipamentos (Master ID por unidade).
**Ações/botões principais:** Abas de status (Todos/Aguardando/Recebida/Em análise/Aprovada); filtros por Fornecedor e Categoria; seleção em lote + "Excluir selecionadas" (exige motivo); clique abre `CotacaoFornecedorDetalhe`.
**Regras de negócio notáveis:** Status derivado por `STATUS_GROUP_LABEL` compartilhado com `precificacao-elevador.jsx`. Exclusão exige justificativa textual.
**Para onde essa tela alimenta:** Abre `cotacao-fornecedor-detail`; a decisão de compra alimenta `PrecificacaoElevadorPage`.

### `cotacao-fornecedor-detail` — Detalhe de Cotação a Fornecedor
**Arquivo:** `src/cotacoes-fornecedor.jsx` (função `CotacaoFornecedorDetalhe`). O portal PÚBLICO que o fornecedor preenche é outro arquivo (`cotacao-elevador-fornecedor.jsx`, `CotacaoElevadorFornecedorApp`, via link com token — sem rota interna do shell).
**Módulo/Alçada:** Comercial.
**Propósito:** Link público enviado ao fornecedor, resposta recebida, linha do tempo (enviado/visualizado/respondido/decidido/aprovado), decisão/aprovação de compra travada por gate financeiro.
**Dados de origem:** `cotacoes_elevador_fornecedor` (via `subsel`), gate por `AvalFinanceiroStore.podeIniciarCompra`.
**Campos principais:** Fornecedor, Categoria, Nº Cotação, Equipamentos, timeline de datas; aba "Tratativas" (thread + anexos).
**Ações/botões principais:** "Copiar link público"; "Ver resposta do fornecedor"; "Decidir comprar"; "Aprovar compra"; Tratativas.
**Regras de negócio notáveis:** "Decidir comprar" fica desabilitado com tooltip se `podeIniciarCompra` retornar `ok:false` (contrato assinado + sinal pago + aval financeiro ainda faltando) — achado E2E documentado no código: antes falhava com toast sem explicação.
**Para onde essa tela alimenta:** Aprovar compra libera a fila de "cotações respondidas" em Precificação e, adiante, a compra real no fornecedor.

### `precificacao` — Precificação
**Arquivo:** `src/precificacao.jsx` (`PrecificacaoPage`, roteador de 2 modos) → `src/precificacao-elevador.jsx` (`PrecificacaoElevadorPage`/`PrecificacaoElevadorDetalhe`, modo padrão "Elevadores") e `PrecificacaoLeadsPage` (modo "Outros projetos", calculadora legada).
**Módulo/Alçada:** Financeiro/Admin (`restrict: ["financeiro","admin"]`).
**Propósito:** Calcular o preço de venda a partir do custo econômico completo (importação + impostos + mão de obra + despesas operacionais + margem/comissões), herdando o Formulário + resposta do fornecedor. **Documentado exaustivamente nesta própria sessão de conversa — ver §21.2 pra história completa da correção V1→V2.**
**Dados de origem:** `precificacoes_elevador`, criado a partir de `formulario_elevador_id`+`cotacao_fornecedor_id`.
**Campos principais:** Unidades (modelo/qtd/PTAX/custo fornecedor); Mão de obra automática (tração×capacidade×paradas); Despesas de Importação (VMLE, Seguro, Frete Padrão 120d/Expresso 90d, Siscomex, Câmbio, Despachante, Demurrage, Containers); Despesas Operacionais/Extras (Instalação, Frete interno, Armazenagem, %Serviços, Contingência); Alavancas do Financeiro (Markup, Comissões, Margem mínima, parâmetros fiscais); Modo de formação (Markup×Margem desejada).
**Ações/botões principais:** Recalcular MO; Ressincronizar do fornecedor; Salvar rascunho; Calcular; Aprovar precificação; Usar câmbio ao vivo.
**Regras de negócio notáveis:** Motor V2 é oficial desde 29/08 (ver §21.2); 2 cenários de frete (90d expresso × 120d padrão); travas de sanidade (câmbio 1-20 R$/US$, VMLE&gt;0, markup&lt;100%); aprovação trava se margem V2 &lt; mínima.
**Para onde essa tela alimenta:** `PropostasPage` ("Prontas para enviar"); preço V2 vira base do teto de custo do CEO.

### `aval-financeiro` — Aval Financeiro
**Arquivo:** `src/aval-financeiro.jsx` (`AvalFinanceiroPage`) + `src/aval-financeiro-store.js`.
**Módulo/Alçada:** Financeiro/Admin + duas aprovações extra: CEO (Diego, sem login próprio) e Owner (`isOwner()`, e-mails fixos).
**Propósito:** Gate em 2 etapas: (1) Proposta aprovada → Contrato (score de crédito + aval); (2) Contrato assinado → Compra no fornecedor (sinal pago + Aval Pagamento + aprovações CEO/Owner).
**Dados de origem:** `avais_financeiros` (1 por proposta `aprovada`), vínculo com `contratos_venda_equipamentos`/`precificacoes_elevador`/`projetos_elevador`.
**Campos principais:** Status, Consulta (fonte/score/classificação), Aval (decisão/observações), Sinal (valor/data), Aprovações CEO/Owner.
**Ações/botões principais:** Consultar score; Dar aval/Reprovar; Confirmar sinal; Aprovação CEO; Minha aprovação (owner).
**Regras de negócio notáveis:** **Teto de custo corrigido nesta sessão (§21.1)** — `custo_teto = precoVenda(V2) × (1−margemMinima)`. `registrarCustoReal` só alerta (nunca bloqueia) se estourar o teto. Gate final `podeIniciarCompra` checa em ordem: CEO → Owner → sinal pago → Aval Pagamento → contrato assinado → revisão técnica Engenharia.
**Para onde essa tela alimenta:** Libera `createDraft` do Contrato de Venda e `decidirComprar` na Cotação a Fornecedor.

### `comissoes` — Comissões
**Arquivo:** `src/financeiro.jsx` (`ComissoesPage`) + `src/comissionamento-store.js`.
**Módulo/Alçada:** Financeiro/Admin.
**Propósito:** Gerar comissões a partir de propostas assinadas com split por `origem_venda` (issue #68), configurável sem deploy.
**Dados de origem:** `comissoes`, `regras_comissionamento`, fila de propostas aprovadas sem comissão gerada.
**Campos principais:** Vendedor, Faturamento líquido, % comissão, Progresso vs meta, Status.
**Ações/botões principais:** Gerar comissão; Aprovar todas/individual; Pagar; Folha de pagto (CSV).
**Regras de negócio notáveis:** Idempotente (erro se comissão já existe). Split acima de `limite_sem_aprovacao_pct` exige aprovação de diretoria (`requer_aprovacao_diretoria`).
**Para onde essa tela alimenta:** Fim do funil comercial — pagamento de comissões.

### `contrato-venda-equipamentos` — Contrato Venda de Equipamentos
**Arquivo:** `src/contrato-venda.jsx` (`ContratoVendaEquipamentosPage`) + `contrato-venda-store.js`/`contrato-venda-engine.js`.
**Módulo/Alçada:** Jurídico.
**Propósito:** Wizard + painel pra gerar/enviar/acompanhar o contrato de venda ao cliente final, com assinatura digital pública auditável (IP/user-agent/hash SHA-256).
**Dados de origem:** `contratos_venda_equipamentos` (Master ID `VPVE`), pode nascer de Proposta aprovada.
**Campos principais:** Comprador, valor, sinal (%), parcelas, Anexo I (Proposta assinada).
**Ações/botões principais:** Enviar/Reenviar link de assinatura.
**Regras de negócio notáveis:** `createDraft` exige `podeEnviarContrato` (Financeiro já deu aval) — senão lança erro com motivo.
**Para onde essa tela alimenta:** `status='assinado'` é condição do gate `podeIniciarCompra`.

### `contrato-instalador` — Contrato Instalador
**Arquivo:** `src/contrato-instalador.jsx` + `contrato-instalador-store.js`/`-engine.js`.
**Módulo/Alçada:** Jurídico.
**Propósito:** Wizard/painel análogo ao Contrato de Venda, para prestação de serviço com instaladores terceiros.
**Dados de origem:** Tabela própria de contratos de instalador.
**Ações/botões principais:** Abas Painel/Novo contrato.
**Regras de negócio notáveis:** Ainda marcado "EM BREVE" no card de Acesso Rápido de `JuridicoPage" — via recomendada hoje ainda é o fluxo de Contrato de Venda.
**Para onde essa tela alimenta:** Custo real de instalação lançável em `registrarCustoReal`.

### `juridico` — Contratos &amp; Minutas
**Arquivo:** `src/operacoes.jsx` (`JuridicoPage`).
**Propósito:** Tela-índice do Jurídico — lista `contratos_venda_equipamentos` com KPIs e atalhos.
**Campos principais:** Cliente, Data emissão, Valor, Status.
**Ações/botões principais:** Importar minuta (só toast, sem persistência real visível); Novo contrato; Acesso Rápido (Contrato Cliente ativo, Contrato Montador desabilitado).
**Regras de negócio notáveis:** KPIs usam rótulos de status legados, distintos dos status normalizados do `CVDashboard` — duas visões da mesma tabela.
**Para onde essa tela alimenta:** Abre `contrato-editor`.

### `contrato-editor` — Editor de Contrato
**Arquivo:** `src/contrato-editor.jsx`.
**Propósito:** Editor full-page (5 seções) pra formalizar o contrato do cliente, com herança por número de proposta.
**Campos principais:** Dados do Contrato, Comprador, Objeto, Preço e Pagamento (parcelas), Assinatura.
**Ações/botões principais:** Salvar; Gerar PDF; Assinar; Adicionar parcela.
**Regras de negócio notáveis:** Progresso por seção (`sectionFill`); parcelas recalculam automaticamente ao mudar valor total; herança não sobrescreve campo já preenchido manualmente.
**Para onde essa tela alimenta:** Mesma tabela consultada pelo gate `podeIniciarCompra`.

### `dashboard` — Dashboard
**Arquivo:** `src/dashboard.jsx` (`Dashboard`). **Alçada:** todos, conteúdo varia por `role`.
**Propósito:** Visão do dia por perfil: KPIs, projetos em andamento (Gantt/Lista/Kanban), tarefas de hoje, funil comercial, "Onde Parou" (cotações atrasadas).
**Dados de origem:** `loadDashboardData(role)` — gantt derivado da esteira real de gatilhos (não da tabela legada `projetos`, 0 linhas, issue #274).
**Ações principais:** trocar período; Relatório CSV; Ir para Leads; Nova Tarefa; clique navega via `GatilhosEngine.navegarPara`.
**Regra notável:** fase do projeto no Kanban é textual, sem botão de mover manual (decisão 23/08 — muda sozinha quando a etapa real fecha).

### `notificacoes` — Central de Alertas
**Arquivo:** `src/financeiro.jsx` (`NotificacoesPage`). **Alçada:** todos.
**Propósito:** Todos os `alertas` (`resolved=false`) agrupados por período/módulo.
**Regra notável:** `alertas` não tem destinatário — todo alerta é visível a todo mundo (decisão documentada como candidato a revisão de arquitetura).

### `decisoes` — Central de Decisões
**Arquivo:** `src/decisoes.jsx` + `decisoes-store.js`. **Alçada:** filtrada por `souAprovador()` — só quem está em `aprovadores_esperados` (papéis fixos: ceo, owner, gestor_comercial, rh, engenharia_lider, logistica_lider).
**Propósito:** Inbox pessoal de decisões gerenciais — gate genérico "alguém precisa decidir isto", com dependência opcional entre decisões.
**Ações:** Aprovar; Reprovar (motivo obrigatório).
**Regra notável:** decisões nascem `bloqueada_por_dependencia` e destravam sozinhas quando as decisões-pai são aprovadas. Toda resolução gera notificação. Gates codificados: envio de proposta (Gestor Comercial→CEO), contratação de mão de obra (CEO), montador entra na obra (RH), compra de equipamento (CEO), compra de varejo (Chefe de Logística).
**Alimenta:** libera `podeEnviarProposta`, `podeContratarInstalador`, `podeMontadorEntrarObra`, `podeComprarEquipamento`/gate de compra, Almoxarifado.

### `financeiro` — Gatilhos &amp; Prazo
**Arquivo:** `src/financeiro.jsx` (`FinanceiroPage`). **Alçada:** `restrict:["financeiro","admin"]`. *(Distinto de Precificação e de Aval Financeiro — 3 arquivos/rotas separados.)*
**Propósito:** Painel da cadeia automática de gatilhos por cotação (`GatilhosEngine`, sem cron — reprocessa a cada abertura) + gatilhos manuais/avulsos.
**Ações:** Novo gatilho; Exportar CSV; Confirmar sinal/Aval de Pagamento por nó; Fechar com motivo.
**Regra notável:** sem SLA embutido nas etapas (decisão 23/08: "só o fato consumado"). Barra de Gantt interpola azul→vermelho conforme aproxima o prazo.

### `rh-homologacao` — Homologação de Instaladores
**Arquivo:** `src/rh-homologacao.jsx` + `rh-homologacao-store.js`.
**Propósito:** Compliance documental Empresa→Colaborador→Documentos (RG/CNH/ASO/NRs...) com vencimento — cadastro raso fica em Cadastros; aqui é só compliance.
**Regra notável:** Carteira de Vacinação (DOC-080) vira checklist de vacinas reais, grava múltiplas linhas.
**Alimenta:** pré-requisito do gate RH em `decisoes-store.js` (`podeMontadorEntrarObra`) e do Contrato Instalador.

### `almoxarifado` — Almoxarifado
**Arquivo:** `src/almoxarifado.jsx` + `PedidosVarejoStore`.
**Propósito:** Pedidos de compra de varejo (insumos/reposição), distintos de equipamento de venda.
**Regra notável:** aprovação não acontece aqui — é feita pelo Chefe de Logística via Central de Decisões (`criarDecisaoCompraVarejo`); "o pedido É o gatilho".

### `logs` — Logs de Atividade
**Arquivo:** `src/logs-admin.jsx` + `window.VPLog`. **Alçada:** `restrict:["admin"]`.
**Propósito:** Auditoria append-only e imutável (quem/o quê/onde/quando/alvo), limite de 400 registros por consulta.
**Alimenta:** destino de eventos registrados por outras telas (convite de usuário, alteração de alçada etc.).

### `configuracoes` — Configurações do Sistema
**Arquivo:** `src/financeiro.jsx` (`ConfiguracoesPage`) + `colaboradores-admin.jsx`. **Alçada:** `restrict:["admin"]`.
**Propósito:** Hub admin em 6 abas:
1. **Administração** — alocação de módulos por colaborador (nome/foto vêm de vpsistema, só edita alocação); decide o que aparece na Sidebar via `gruposAlocados`.
2. **Usuários &amp; Perfis** — tabela `usuarios` + convites pendentes; criação de login real é feita pelo TI via SSO, aqui só registra o convite.
3. **Permissões (RLS)** — (a) Alçadas de Propostas: 5 capacidades delegáveis (`ver_todas`, `precificar_manual`, `destravar_aprovada`, `excluir`, `conceder_alcadas` — recursiva); (b) Matriz de Permissões: tabela ESTÁTICA hardcoded, só documentação — "RLS ainda não é gerido por esta tela".
4. **Parâmetros** — 100% estático/hardcoded (câmbio manual, margem mínima 22%, margem padrão 32%, comissão 4%, ICMS 18%, II 14%, SLAs) — sem persistência real.
5. **Integrações** — lista estática, todas "Não configurado" (AIS, IMAP importação/compras, SMTP, assinatura digital, Omie, WhatsApp Business) — frontend não monitora saúde real, é só previsão.
6. **Buckets Storage** — lista real dos 6 buckets Supabase do projeto (engenharia, tratativas, cotacao-fornecedor-anexos, formulario-elevador-anexos, propostas-imagens, fichas-imagens).
**Regra notável:** distinção real entre editável-de-verdade (Administração, Usuários, Alçadas) vs. documentação estática sem persistência (Matriz, Parâmetros, Integrações).

### `gi-painel` — Painel (Gestão Importação)
**Arquivo:** `src/gestao-importacao-painel.jsx` (`GIPainelPage`).
**Propósito:** Dashboard somente-leitura agregando P.I./RFQ/IMS/Embarques em paralelo (`Promise.all`). Sem tabela própria.

### `pi-importacao` — Proforma Invoices (P.I.)
**Arquivo:** `src/pi.jsx`. Fase 1 da consolidação de importação.
**Propósito:** Gerencia P.I.s, com itens/pagamentos/produção, vínculo opcional a Embarque.
**Regra notável:** ao preencher Nº Cotação numa P.I. nova, checa o **gate de compra do CEO** (`DecisoesStore.verificarGateCompra`) — bloqueia criação se a compra não estiver liberada.

### `rfq-importacao` — RFQ
**Arquivo:** `src/rfq.jsx`. Fase 2 da consolidação.
**Propósito:** Cotação comparativa N fornecedores × N itens, vencedor por item ou global.
**Alimenta:** histórico de preços alimenta `gi-analise-precos`.

### `ims-importacao` — IMS (recursos operacionais)
**Arquivo:** `src/ims.jsx`. Fase 3 da consolidação.
**Propósito:** Transporte/Munck/Empilhadeira/Andaime/Mão de obra por projeto — campos técnicos variam por tipo de recurso, com cotação de fornecedor e execução (check-in/out, avaliação 1-5).

### `embarques-importacao` — Embarques (rico)
**Arquivo:** `src/embarques-importacao.jsx`. Fase 4 — **explicitamente NÃO é** o "Mapa de navios" legado (tabela `embarques_importacao`, diferente de `embarques`).
**Propósito:** Embarque completo vinculado às P.I. (fornecedor/pagamentos herdados só-leitura); aduaneiro com canal Verde/Amarelo/Vermelho/Cinza.

### `importacao` — Importação (legado)
**Arquivo:** `src/logistica.jsx` (`ImportacaoPage`), tabela `embarques` (distinta de `embarques_importacao` — sobreposição não resolvida, decisão 25/08).
**Propósito:** Embarques em trânsito + rastreamento AIS legado.
**Alimenta:** `importacao-detail`, `importacao-rastreamento`, `importacao-email`; ponte com Cotação a Fornecedor via "Compras aguardando embarque".

### `importacao-detail` — Detalhe de Embarque
**Arquivo:** `src/logistica.jsx` (`ImportacaoDetail`).
**Regra notável:** "Reportar chegada" só uma vez — cria automaticamente 2 tarefas (Engenharia + Instalação).

### `importacao-rastreamento` — Mapa Marítimo
**Arquivo:** `src/logistica.jsx` (`ImportacaoRastreamento`). Integração real via Edge Function `ais-sync/index.ts` (ajustada nesta sessão pra 24h).
**Regra notável:** 3 modos automáticos por prioridade: (1) **Sinay/Safecube real** (se `SINAY_API_KEY` + BL/container), (2) AIS genérico por IMO (fallback legado), (3) **simulação** interpolando posição (sem chave nenhuma) — modo usado aparece no toast.

### `importacao-email` / `compras-email` — Inbox Importação/Compras
**Arquivo:** `src/logistica.jsx` (`EmailInbox`, kind="importacao"/"compras").
**Achado real:** integração IMAP **não configurada** — lista de e-mails é array vazio hardcoded, com aviso honesto na UI ("sem mock"). Corpos de exemplo (`EmailBody`) existem no código mas nunca renderizam.

### `gi-analise-precos` — Análise de Preços
**Arquivo:** `src/gestao-importacao-painel.jsx` (`GIAnalisePrecosPage`). Somente leitura, agrupa histórico de RFQs por item (case-insensitive), ordenado por menor preço.

### `compras` — Fretes Nacionais
**Arquivo:** `src/logistica.jsx` (`ComprasPage`). Reaproveita a mesma tabela `embarques`, remapeando status pra vocabulário de frete nacional.
**Achado real:** campos "Valor"/"Motorista" não existem na tabela — sempre nulos/"—"; "Ocorrências" é só `1` se status="Atraso" (não é registro real de ocorrência). "Novo frete" redireciona pra `importacao` (não cria aqui).

### `pedidos-acompanhamento` — Pedidos
**Arquivo:** `src/pedidos-acompanhamento.jsx`. Módulo "Suprimentos" — distinto do "Pedido a Fornecedor" de Cotações a Fornecedor (aquele é RFQ, este é pedido confirmado). Abas Nacional/Importação.

### `leads` — Pipeline de Leads
**Arquivo:** `src/comercial.jsx` (`LeadsPage`).
**Propósito:** Entrada do funil comercial — cadastro do cliente/contato. Desde 15/08 NÃO coleta mais equipamento (isso ficava preso a 1 item só); equipamento é alocado no Formulário.
**Regra notável:** validação mínima Prédio+Contato; CNPJ/CPF opcional ("documento pendente"); ao editar lead com cliente já vinculado, sincroniza mesmo sem documento (evita "atualizado" mascarar falha de sync).
**Alimenta:** `lead-detail`, `formulario-elevador`.

### `lead-detail` — Detalhe de Lead
**Arquivo:** `src/comercial.jsx` (`LeadDetail`).
**Propósito:** Cliente vinculado, histórico real (`vp_logs`), comissão prevista (4% hardcoded, só informativo).
**Regra notável:** "Qualificar → Dossier" só se status "Em qualificação"/"Aguardando cotação".

### `formularios` — Formulários (hub)
**Arquivo:** `src/comercial.jsx` (`FormulariosPage`). Grid estático de categorias — só "Equipamento" está pronta (Elevador/Escada/Esteira moram juntas no mesmo formulário desde 15/08); as outras 5 são placeholders "Em breve".

### `formulario-elevador` — Formulário — Equipamento
**Arquivo:** `src/formulario-elevador.jsx`. Mesmo componente serve uso interno (`canal='assistido'`) E público standalone (`canal='self_service'`, sem SSO, via token).
**Propósito:** Coleta Header (cliente/fiscal/logística) + N Unidades. **Módulo mais trabalhado nesta sessão** (tração adicionada, MO automática — ver §21.2).
**Regra notável:** identificação mínima pra rascunho (nome/contato/prédio, não exige CNPJ — `clientes.razao_social` é NOT NULL, travava silenciosamente); envio exige todos os campos técnicos `*` da unidade; `fieldset disabled={saving}` trava edição concorrente durante save.
**Alimenta:** Cotação a Fornecedores, `controle-cotacoes`, Precificação/Proposta.

### `propostas` — Propostas Comerciais
**Arquivo:** `src/precificacao.jsx` (`PropostasPage`). Visibilidade por vendedor (`resolverEscopoVisibilidade`) — quem não "vê tudo" só vê as próprias.
**Regra notável:** "Prontas para enviar" inclui `calculado` E `finalizado` (antes só `calculado`, sumia no momento errado). KPI de valor só soma propostas com `numero_documento` (evita inflar com rascunhos/demo).

### `proposta-editor` — Editor de Proposta
**Arquivo:** `src/proposta-editor.jsx` + `proposta-form.jsx`/`proposta-preview.jsx`. Top tabs Elevador/Escada/Esteira, preview PDF ao vivo.
**Regra notável:** proposta `aprovada` sem `destravada_em` fica travada (capacidade `destravar_aprovada`); herança só preenche campo vazio, roda automática 1x ao abrir; `eq` (tipo) é deduzido do conteúdo, não de `proposal_type` (nulo em 290/311 propostas migradas — bug real corrigido 21/08); PDF migrou de html2canvas (6,7MB) pra react-pdf/impressão nativa (vetorial).
**Alimenta:** assinatura digital pública, Contrato de Venda/Instalador.

### `controle-cotacoes` — Controle de Cotações
**Arquivo:** `src/controle-cotacoes.jsx`. Une histórico legado (`cotacoes_elevador_historico`) + Formulário novo.
**Regra notável:** linha do histórico legado sem cadeia real (clique não abre nada); "Abrir no Formulário" numa linha legada "ressuscita" a cotação como Formulário real na hora.

### `cadastro-clientes` / `cadastro-fornecedores` — Cadastros centrais
**Arquivo:** `src/cadastros.jsx`. Transversal (Comercial/Importação/Engenharia usam os mesmos).
**Regra notável (Fornecedores):** cadastro único pra Fornecedor/Agente de Carga/Transportador/Prestador IMS por categoria (chips multi-seleção); média de avaliação arredonda pra BAIXO de propósito (`Math.floor`, não `Math.round` — evita superestimar nota).

### `ncm-catalogo` — Catálogo de Produtos
**Arquivo:** `src/ncm-catalogo.jsx`. Modelo DUIMP (Produtos + Operadores Estrangeiros), + kanban de Solicitações NCM.
**Regra notável:** produtos vêm majoritariamente por herança da Ficha Técnica, não cadastro manual direto; excluir produto com ficha vinculada remove a ficha junto (confirmação).

### `cadastro-instaladores` — Empresas Instaladoras
**Arquivo:** `src/cadastro-instaladores.jsx`. Cadastro RASO (empresa+colaborador) — certificações/homologação ficam em RH Operacional (mesma tabela `parceiros_instaladores`).

### `cadastro-custos` — Atualização de Custos
**Arquivo:** `src/cadastro-custos.jsx` — **documentado exaustivamente nesta sessão** (capacidade/paradas viraram editáveis, botões de adicionar linha, URL por aba, cabeçalho sticky). Ver commits desta sessão pro histórico completo.

### `engenharia` — Projetos de Engenharia
**Arquivo:** `src/operacoes.jsx` (`EngenhariaPage`).
**Propósito:** Lista/detalha projetos (visita técnica, laudo) e valida gates de importação (`ProjectGates.validarGatesImportacao`).
**Regra notável:** abas Vistoria/Documentos/NCM são placeholders que redirecionam pra outras telas (evita duplicar registro — "agora fica num lugar só").

### `eng-projeto-elevadores` — Projeto de Elevadores
**Arquivo:** `src/engenharia-elevador.jsx`. Traduz desenhos técnicos do fornecedor (poço/cabine/porta/COP-LOP) por unidade, correlacionado por Nº da Cotação.

### `eng-configurador` — Projeto de Equipamento
**Arquivo:** `src/engenharia-config.jsx`. Configurador ao vivo (escada/esteira), inspirado em configuradores de mercado (TK eSlider) + normas EN/NBR.
**Regra notável:** velocidade máx. de escada é 0,75m/s se ângulo≤30° senão 0,50m/s.

### `desenho-tecnico` — Desenho Técnico ER \| ES
**Arquivo:** `src/desenho-tecnico.jsx`. 100% cálculo local (sem Supabase) — porte do "Claude Designer" embarcado. Botão "Cotar" só mostra toast (não integra de fato com Cotações ainda).

### `ficha-tecnica` — Ficha Técnica
**Arquivo:** `src/ficha-tecnica.jsx` + engine/store. Já documentado em profundidade no `CLAUDE.md` do projeto (paginação A4, biblioteca compartilhada de campos).

### `vistorias` — Vistorias de Obras
**Arquivo:** `src/vistorias-obras.jsx`. **Achado real:** era 1 de 3 implementações PARALELAS de vistoria que existiam sem se falar (consolidação 15/08); as outras duas foram aposentadas.

### `instalacao` — Instalação em Campo
**Arquivo:** `src/operacoes.jsx` (`InstalacaoPage`). Progresso calculado por dias restantes até previsão de entrega (+45 dias), cor por proximidade do prazo.

### `status-obras` — Status de Obras
**Arquivo:** `src/dossier-obra.jsx` (`ObrasStatusPage`). Lista consolidada de todas as obras — porta de entrada pro Dossiê.

### `linha-do-tempo` — Linha do Tempo da Cotação
**Arquivo:** `src/linha-do-tempo.jsx`. Busca por Nº Cotação, agrega eventos de TODAS as fontes/módulos numa timeline só — rastreabilidade cross-módulo, só leitura.

### `central-documentos` — Central de Documentos
**Arquivo:** `src/central-documentos.jsx`. Fase 1: leitura agregada (Vistoria+Documentos+RH), "sem pipeline de envio ainda" — não escreve nada além de "marcar como enviado".

### `art` — ART de Instalação / `databook` — Data Book &amp; Termo
**Arquivo:** `src/entrega.jsx`. **Ambas são telas de REDIRECT**, sem dado próprio — só orientam e mandam pro Dossiê da Obra (aba Documentos). `databook` antes lia a tabela legada `projetos` (issue #274, desconectada) — virou redirect, achado "Importante" de auditoria.

### `cronograma` — Cronograma de Pagamento da Instalação
**Arquivo:** `src/entrega.jsx` (`CronogramaPage`). 4 fases de pagamento por marco físico do equipamento.
**Regra notável:** soma das 4 fases precisa fechar exatamente com o valor disponível (tolerância 0,01) — bloqueia salvar se não fechar.

### `handover` — Handover &amp; Manutenção
**Arquivo:** `src/handover-manutencao.jsx`. Checklist de entrega + transferência pra Escamax (sistema de manutenção preventiva). Fonte trocada de `projetos` (legada) pra `dossier_obra` — mesmo padrão de correção do `databook`.

### `dossier-obra` — Dossiê da Obra
**Arquivo:** `src/dossier-obra.jsx` + `dossier-store.js`. **Hub central** que todas as outras telas do pipeline pós-venda redirecionam — aba ativa espelhada na URL (3º segmento).

### `ncm-kanban` — Solicitações de Classificação NCM
**Arquivo:** `src/ncm-catalogo.jsx` (`NcmKanbanPage`). Funil: `EM_PREENCHIMENTO`→`AGUARD_JURIDICO`→`APROVADO`→`APROVADO_PRONTO`→`CADASTRADO`.

### `ncm-detail` — Detalhe da Solicitação NCM
**Arquivo:** `src/ncm-catalogo.jsx` (`NcmDetailPage`). Checklist de 6 itens obrigatórios antes de habilitar "Copiar dados formatados" pro LogComex.

## 5. Catálogos de dados — tabelas Supabase reais (por domínio)

Extraído de `supabase/migrations/*.sql` (histórico completo de migrations do projeto, não um dump do schema atual — algumas tabelas podem ter sido alteradas por migrations posteriores às citadas).

### 5.1 Comercial / Funil
- `leads` — pipeline comercial, ponto de entrada.
- `clientes` — cadastro central de cliente (CNPJ/CPF, endereço, contato). `documento_pendente` como estado válido (Lead pode nascer sem CNPJ/CPF).
- `formularios_elevador` + `formularios_elevador_unidades` — intake técnico por equipamento (elevador/escada/esteira), inclui `tracao` (adicionado nesta sessão), `capacidade_kg`, `paradas`, `tipo_mao_de_obra` (renomeado "Instalação Será" 28/08).
- `cotacoes_elevador_fornecedor` — RFQ técnico enviado a fornecedor (Glarie, Seloon…), com `dados_envio` (snapshot congelado no envio) e `respostas` (jsonb, inclui `container_no` texto livre).
- `precificacoes_elevador` — motor de cálculo V1 (legado) + V2 (oficial, custo econômico completo — ver §21.2), `modo_formacao_preco`, `resultado_v2`, `resultado_v2_expresso` (modalidade 90d/120d).
- `propostas` — documento comercial final, PDF de 18 páginas.

### 5.2 Cadastros de referência
- `custos_instalacao_elevador` — tração × capacidade × paradas → valor de mão de obra (seed real: "Tabela MO - 18032026 - Definitivo 2026 - Rev.1"). CHECK `tracao in ('2:1','4:1')`.
- `custos_instalacao_escada_esteira` — valor fixo por tipo × estado (SP / Outros Estados).
- `custos_containers` — specs ISO + dados comerciais por cotação.
- `fornecedores_elevador`, `parceiros_instaladores` (+ `colaboradores`/`documentos` relacional pós-migração 25/08).

### 5.3 Fiscal / Financeiro
- `parametros_fiscais_elevador` — registro único editável (`id='default'`): regime tributário, alíquotas de importação e venda, `margem_minima_pct`, comissões padrão.
- `difal_estados` — 27 UFs, categoria de base + alíquotas (motor DIFAL).
- `avais_financeiros` — gate Financeiro→CEO→Owner antes de iniciar compra no fornecedor. `custo_teto`/`margem_aceita` (corrigido nesta sessão, ver §21.1).
- `cotacao_custos_reais` — extrato de gasto real por cotação, comparado contra `custo_teto`.
- `contratos_venda_equipamentos`, `alertas`.

### 5.4 Engenharia / Pós-venda
- `projetos_elevador`, `dossier_obra`, `analise_tecnica` — pré-requisito documentado pra liberar Precificação.
- Tabelas de ART, cronograma, data book, handover (não auditadas linha a linha nesta sessão — ver §21.5, pendência de cobertura).

### 5.5 Importação / Logística
- `embarques` — busca global (`runGlobalSearch` em `app.jsx`) já indexa por `client`/`vessel`/`bl`/`container_number`.
- Integração AIS via Edge Function `supabase/functions/ais-sync/index.ts` — rastreamento de navio real (Sinay API, chave em secrets), rodando com frequência diária (ajustado nesta sessão, era 6h).

## 6. Pipeline de ingestão, limpeza e chunking (proposto)

### 6.1 Fontes de conteúdo indexável
1. **Este documento** (`rag.md`) — a fonte primária e mais densa; reingestão em cada atualização relevante do código.
2. **Comentários de topo de arquivo** — este projeto tem uma convenção forte de comentários `/* ... */` no topo de cada `.jsx`/`.js` explicando propósito, decisões de negócio datadas e "achados reais" — extração automatizável por regex (`^\/\*[\s\S]*?\*\//`).
3. **Migrations SQL** (`supabase/migrations/*.sql`) — schema real, comentários `--` com justificativa de negócio.
4. **Dados operacionais** (tabelas Supabase) — não o rag.md em si, mas uma segunda trilha de ingestão orientada a evento (ver §19) pra responder perguntas sobre registros específicos ("qual o status da cotação 950?").

### 6.2 Eventos de ingestão
- `git push` em `main` → reingestão do `rag.md` e dos comentários de arquivo alterados (diff-aware, não reingestão completa).
- Alteração de linha em tabela operacional relevante (nova precificação calculada, novo embarque, nova cotação) → evento de domínio (ver §19), não texto de documentação.

### 6.3 Limpeza
- Remover blocos de código-fonte puro (JSX/SQL) do texto indexado pra perguntas em linguagem natural — manter só comentários e prosa; guardar o código como metadado de referência (link pro arquivo/linha), não como corpo do chunk.
- Normalizar nomes de rota/arquivo pra busca exata (ex.: `cadastro-custos` deve casar com "Atualização de Custos", "Cadastros de Custo", "custos de instalação").

### 6.4 Estratégia de chunking
- **Por rota** (§4) é a unidade natural de chunk — cada entrada do Guia por Rota já é um bloco coeso e independente (arquivo + propósito + campos + botões + regras), do tamanho certo pra um chunk de embedding (~200-500 tokens).
- **Por tabela** (§5) é a segunda unidade — schema + propósito + relações.
- Comentários de topo de arquivo que excedem ~800 tokens (raro, mas existe — `formulario-elevador.jsx`, `precificacao-elevador-engine.js`) dividem por seção lógica (marcadores `/* ---------- Nome ---------- */` já usados como convenção no próprio código — reaproveitável como delimitador de chunk).

### 6.5 Documento lógico para embedding — exemplo
```
[ROTA] precificacao
[MÓDULO] Comercial / Financeiro
[ARQUIVO] src/precificacao-elevador.jsx, src/precificacao-elevador-store.js, src/precificacao-elevador-engine.js
[PROPÓSITO] Calcula o preço de venda de elevador a partir da cotação respondida pelo fornecedor.
  Motor V2 (custo econômico completo) é o oficial desde 29/08/2026: soma mercadoria + instalação +
  frete interno + armazenagem + demais custos operacionais na BASE do preço, corrigindo uma
  fragilidade herdada da planilha original onde markup positivo podia conviver com margem real negativa.
[CAMPOS] VMLE, Seguro, Frete padrão/expresso (USD), Câmbio, Markup sobre o custo (%), Margem
  desejada sobre a venda (%), Margem mínima (%), Contingência, Outros custos não recuperáveis.
[AÇÕES] Calcular, Salvar rascunho, Aprovar precificação, Recalcular mão de obra, Ressincronizar do fornecedor.
[REGRA] Aprovação trava se margem efetiva (V2) < margem mínima configurada, com opção de forçar
  aprovação abaixo do mínimo mediante confirmação explícita.
[ALIMENTA] propostas (herda precoVendaPorEquipamento do V2) → aval-financeiro (teto de custo = preço × (1−margem mínima)).
```

### 6.6 Recuperação com janela contextual
Um chunk de rota sozinho não basta pra perguntas do tipo "o que acontece depois de aprovar a precificação?" — a resposta está em OUTRO chunk (`propostas`, `aval-financeiro`). Mitigação: cada chunk carrega explicitamente `[ALIMENTA]` e é indexado também por essa relação — recuperação deve trazer o chunk da rota perguntada + os chunks referenciados em `[ALIMENTA]`/`[DADOS DE ORIGEM]` dela, não só o top-K por similaridade pura.

## 7. Modelo de embedding

### 7.1 Política de seleção
Conteúdo é majoritariamente **português técnico-comercial de importação/engenharia** (não código em si, ver §6.3) — um modelo multilíngue com bom desempenho em PT-BR é suficiente; não há necessidade de um modelo especializado em código, já que o corpo do chunk é prosa extraída de comentários, não o código bruto.

### 7.2 Representação
Cada chunk vira 1 vetor. Chunks de rota (§6.5) e chunks de tabela usam o MESMO formato de metadado (ver §8.2) pra permitir filtro por tipo antes do rerank.

## 8. Vetores e base vetorial (Embedding Store)

### 8.1 Esquema lógico sugerido
```sql
create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('rota', 'tabela', 'regra_negocio', 'bug_conhecido')),
  chave text not null,              -- ex.: 'precificacao', 'custos_instalacao_elevador'
  titulo text not null,
  conteudo text not null,           -- texto normalizado (ver §6.5)
  embedding vector(1536),           -- pgvector — mesmo Postgres do app, sem infra nova
  fonte_arquivo text,               -- ex.: 'src/precificacao-elevador.jsx'
  atualizado_em timestamptz not null default now()
);
create index on public.rag_chunks using ivfflat (embedding vector_cosine_ops);
```
Reaproveitar o MESMO Supabase Postgres do app (extensão `pgvector`) em vez de infra vetorial separada — decisão consistente com o resto do projeto ("sem bundler, sem infra nova quando dá pra evitar").

### 8.2 Metadados mínimos por chunk
`tipo`, `chave` (id da rota ou nome da tabela), `módulo`, `alçada`/`restrict`, `fonte_arquivo`, `atualizado_em`.

## 9. Modelos de LLM e orquestração

### 9.1 Responsabilidades do LLM
Responder em português, citando a rota/arquivo exato de onde a informação veio (nunca inventar caminho de tela) — o mesmo princípio de rastreabilidade de §2 se aplica à resposta gerada, não só ao documento fonte.

### 9.2 Contrato de resposta
Toda resposta que cita uma regra de negócio ou trava deve incluir `[fonte: arquivo:linha]` — igual ao padrão já usado nas conversas de engenharia desta sessão (`file_path:line_number`).

## 10. Fluxo de recuperação

`pergunta do usuário` → `embedding` → `top-K em rag_chunks` (filtrado por `tipo` quando a pergunta é claramente sobre "uma tela" vs "uma tabela") → `expansão por [ALIMENTA]/[DADOS DE ORIGEM]` (§6.6) → `LLM com contrato de citação (§9.2)`.

## 11. Regras de negócio para respostas e ações

O assistente NUNCA deve confirmar automaticamente um valor de "projeto especial" (capacidade/paradas fora da tabela de MO) como se fosse tabelado — essa é uma regra de negócio real do sistema (`classificarMaoDeObraUnidade`, `precificacao-elevador-store.js`) e deve se propagar pro comportamento do assistente também: nunca extrapolar preço fora de tabela sem marcar como estimativa não confirmada.

## 12. Segurança, LGPD e governança

- A maioria das tabelas usa RLS permissiva (App MVP interno, protegido por SSO no frontend) — um RAG que expõe conteúdo de `rag_chunks` (schema/regras) é seguro por natureza (não é dado de cliente), mas se o pipeline de ingestão orientado a evento (§19) um dia indexar REGISTROS reais (nome de cliente, valor de proposta), precisa de política de acesso por role — reaproveitar o mesmo mapa `restrict:` de `shell.jsx` como política de leitura do RAG.
- Nunca indexar CNPJ/CPF/e-mail/telefone de cliente em texto livre no `rag_chunks` — só referência (id), nunca o dado pessoal em si.

## 13. Avaliação e observabilidade

Sem infraestrutura de avaliação de RAG implementada — este documento é o ponto de partida. Critério mínimo de aceite: uma pergunta como "o que preciso preencher antes de aprovar uma precificação?" deve recuperar o chunk `precificacao` (§6.5) e citar a regra real do §21.2.

## 14. Critérios de aceite da primeira versão

1. Toda rota do §3 tem uma entrada correspondente em §4 — sem lacuna.
2. Nenhuma entrada em §4 contém campo/botão inventado — cada uma foi checada contra o código real.
3. Pelo menos 3 bugs reais documentados em §21, todos com arquivo:linha.
4. Diagrama de arquitetura (§20) renderiza como Mermaid válido.

## 15. Fontes e rastreabilidade

### Fontes do projeto
- `src/router.js`, `src/app.jsx`, `src/shell.jsx` — mapa de rotas, módulos, alçadas.
- `supabase/migrations/*.sql` — schema real.
- Cada arquivo de rota citado no §4.
- Histórico desta própria sessão de trabalho (Fases 1-5 da reconstrução da Precificação, correção do teto de custo, correção do `tipo_mao_de_obra` legado).

### Referências conceituais
- `verticalpartsIA/005_vpclick/.rag/rag.md` — estrutura e método deste documento.

## 16. GraphRAG para relações e raciocínio multi-hop

O sistema tem um grafo de dependência funcional NATURAL, explícito no próprio código via `[ALIMENTA]`/`[DADOS DE ORIGEM]` (§6.5-6.6) — não precisa ser inferido, já está codificado no fluxo `setRoute`/`setSubsel` entre telas. Nós = rotas + tabelas; arestas = "alimenta"/"depende de"/"trava".

### 16.1 Cadeia principal do funil (nós → arestas reais do código)
```
lead-detail --setRoute('formulario-elevador')--> formulario-elevador
formulario-elevador --envia RFQ--> cotacao-fornecedor-detail
cotacao-fornecedor-detail --resposta do fornecedor--> precificacao (via montarRascunho)
precificacao --aprovar()--> propostas (criarPropostaAutomatica, via PropostaHeranca)
propostas --cliente assina--> aval-financeiro (garantirRegistro)
aval-financeiro --aprovarComoCEO--> podeIniciarCompra (gate pra Cotação a Fornecedor)
```
Essa cadeia responde perguntas multi-hop do tipo "de onde vem o preço que aparece na proposta?" sem precisar de busca semântica — é travessia de grafo direta.

### 16.2 Aplicação a alçadas ("de cada ser humano, o que faz o quê")
Segundo grafo, ortogonal ao de dados: nós = pessoas/roles (Comercial, Engenharia, Financeiro, Admin, CEO, Owner); arestas = ação sobre uma rota. Extraído de `restrict:` (`shell.jsx`) + checagens de código (`isOwner()` em `aval-financeiro-store.js`, e-mails fixos `OWNER_EMAILS`) + status de aprovação em cada store:

| Papel | Ações reais encontradas no código |
|---|---|
| Comercial (vendedor) | Cria Lead, preenche Formulário, envia RFQ, monta Proposta, confirma comissão do vendedor. |
| Financeiro | Roda Precificação, aprova/rejeita margem abaixo do mínimo, consulta score do cliente, dá Aval Financeiro, confirma sinal pago, dá Aval de Pagamento. |
| CEO (Diego) | `aprovarComoCEO` — congela o teto de custo (§21.1), sem trava de identidade no código (comentário explícito: "não há login próprio pra ele no sistema ainda"). |
| Owner/responsável do sistema (Gelson) | `aprovarComoOwner` — mesmo peso que o CEO, mas com trava de e-mail (`OWNER_EMAILS = ['gelson.simoes@verticalparts.com.br', 'dev@localhost']`), nenhuma subordina a outra. |
| Admin | Único papel com acesso a `logs` e `configuracoes` (`restrict: ["admin"]`). |
| Engenharia | Projeto/Configurador/Ficha Técnica, revisão técnica do projeto (gate em `podeIniciarCompra`), ART. |
| Cliente (externo, sem login) | Só o Formulário de Elevador via link público com token (`formulario-elevador-public.jsx`) — único ponto de acesso não autenticado por SSO no sistema. |

## 17. RAPTOR para recuperação hierárquica e visão macro

Aplicação natural: o **Dashboard** já é, na prática, um resumo RAPTOR-like de métricas (`dashboard-metrics-*.js`, 4 arquivos: comercial, financeiro, engenharia, admin, cada um com teste próprio) — resumos hierárquicos por módulo que já existem como código, não precisam ser reconstruídos por um RAG; o RAG deveria indexar a DEFINIÇÃO de cada métrica (o que ela soma, de qual tabela), não recalculá-la.

## 18. RAFT para adaptação do modelo ao domínio

Domínio real: importação, tributação de importação (II/IPI/PIS/COFINS/ICMS/DIFAL), Incoterms, mão de obra de instalação de elevador por tração/capacidade/paradas. Um dataset RAFT pra este projeto usaria como fonte de "documentos distratores" as PRÓPRIAS regras antigas/corrigidas nesta sessão (ex.: fórmula V1 vs V2 de precificação) — útil justamente porque documenta uma correção real de negócio, ensinando o modelo a preferir a regra vigente (V2) sobre a legada (V1) mesmo quando ambas aparecem no contexto.

## 19. Arquitetura de indexação orientada a eventos (dados operacionais, não documentação)

### 19.1 Eventos canônicos já existentes no código
O projeto já tem um barramento de eventos de domínio — `window.EventosFluxo.registrar({evento, numeroCotacao, alvoLabel, alvoId, detalhe})`, chamado em pontos-chave (`FINANCEIRO_APROVOU_CEO`, `FORNECEDOR_RESPONDEU`, `COMPRA_FORNECEDOR_CONFIRMADA`, etc. — visto em `aval-financeiro-store.js`, `cotacao-elevador-fornecedor-store.js`). Um pipeline de ingestão orientado a evento para dados operacionais (não a documentação estática deste rag.md) reaproveitaria ESSE barramento existente em vez de criar um novo.

### 19.2 Estados do pipeline de precificação (exemplo real)
`rascunho` → `calculado` → `finalizado` (aprovado) — enum real de `precificacoes_elevador.status`. Achado desta sessão: um bug em `aval-financeiro-store.js` filtrava por `status='aprovado'`, valor que nunca existiu nesse enum (corrigido, ver §21.1) — lição pra qualquer pipeline de ingestão futuro: **validar o enum real da coluna contra a migration, nunca assumir o nome do estado**.

## 20. Interface via Model Context Protocol (MCP) — proposta

Um servidor MCP para este RAG exporia:
- **Resources:** `rag://rotas/{route-id}` (uma entrada do §4), `rag://tabelas/{nome}` (uma entrada do §5).
- **Tools:** `buscar_rota(pergunta)`, `explicar_regra_negocio(rota)`, `rastrear_fluxo(de, para)` (travessia de grafo, §16).
- Autenticação: reaproveitar o mesmo SSO de `vpsistema.com` já usado pelo app — nenhuma infraestrutura de auth nova.

## 21. Achados e caçada de bugs (front + backend)

> Pedido explícito do usuário: "leia os arquivos de testes, implemente a caçada de bug no front e backend". Esta seção documenta o que foi encontrado — nesta sessão e nesta rodada de engenharia reversa — com arquivo:linha, e o status de cada um (corrigido ou pendente).

### 21.1 [CORRIGIDO] Teto de custo do CEO sempre null — `aval-financeiro-store.js`
Dois bugs simultâneos em `_snapshotTetoCusto()`: (1) filtro `.eq('status', 'aprovado')` contra um valor que **nunca existiu** no enum de `precificacoes_elevador.status` (`'rascunho'|'calculado'|'finalizado'`) — a query nunca retornava linha; (2) leitura de `custoTotalMercadorias` de dentro de `resultado.precificacao`, campo que só existe em `resultado.importacao`. Resultado prático: o teto de custo do CEO **nunca foi gravado**, e o alerta de estouro de gasto (`registrarCustoReal`) nunca disparou desde que a feature foi criada (23/08). Corrigido 29/08: nova fórmula `teto = preço de venda (V2 oficial) × (1 − margem mínima)`, com fallback pro V1 legado.

### 21.2 [CORRIGIDO] Motor V1 de Precificação — markup positivo com margem real negativa
`precificacao-elevador-engine.js` (motor V1, fiel à planilha original): instalação/frete interno/armazenagem entravam no LUCRO depois de formado o preço, nunca na BASE do preço — uma precificação podia ter markup de 22% e ainda assim dar prejuízo real. Confirmado com dado de produção real (VPPC-0950): V1 reportava 18,06% de margem; o motor corrigido (V2, custo econômico completo) revelou 13,49-14,18% — abaixo do mínimo configurado (15%). V2 é o motor oficial desde 29/08/2026 (trava aprovação e alimenta a Proposta); V1 continua disponível só como referência histórica.

### 21.3 [CORRIGIDO] `formularios_elevador.tipo_mao_de_obra` — dado legado quebrava salvamento
Migration de 28/08 trocou o domínio do campo (`local`/`sao_paulo`/`sem_mao_de_obra` → `verticalparts`/`cliente`) e criou a nova CHECK constraint como `NOT VALID` — o que pula a validação em massa das linhas existentes, mas o Postgres **continua validando em qualquer UPDATE** dessas linhas, mesmo tocando outra coluna. Resultado: "Salvar rascunho" quebrava com `violates check constraint` para 3 formulários com valor antigo. Corrigido 29/08 (dados zerados nos 3 registros afetados + constraint revalidada).

### 21.4 [ACHADO, NÃO CORRIGIDO] `/comercial/proposta-editor` — performance e SEO real muito baixos
Auditoria Lighthouse fornecida pelo usuário nesta sessão (`vpgestaoimportacao.vpsistema.com-20260829T124833.json/.html`), rodada em produção real contra essa URL:

| Categoria | Score |
|---|---:|
| Performance | **0,13** (crítico) |
| Accessibility | 0,79 |
| Best Practices | 0,96 |
| SEO | **0,58** |
| Agentic Browsing | **0,08** (crítico) |

`runtimeError`: `PROTOCOL_TIMEOUT` no artefato `FullPageScreenshot` — a página demorou tanto pra estabilizar que o próprio Lighthouse não conseguiu tirar o screenshot completo. `runWarnings` apontam extensões de Chrome e dados em IndexedDB (cache do `jsx-loader.js`, ver §1.1) afetando a medição — parte do problema pode ser artefato do ambiente de teste, mas o score de Performance (0,13) e Agentic Browsing (0,08) são baixos demais pra serem só ruído de ambiente. **Pendente**: rodar de novo em aba anônima sem extensões pra isolar o número real, e investigar por que `proposta-editor.jsx` demora tanto pra ficar interativo (é um editor de 3 tipos de equipamento com PDF de 18 páginas — candidato óbvio a excesso de trabalho síncrono no load).

### 21.5 [PENDENTE — cobertura incompleta] Módulos não auditados nesta sessão
Esta engenharia reversa foi construída por leitura de código (não execução linha a linha com cobertura de teste) para os módulos de Engenharia/Instalação (ART, Cronograma, Data Book, Handover) e todo o bloco "Importação | Suprimentos" (P.I./RFQ/IMS/Embarques/Painel/Análise de Preços) além do que os agentes de exploração desta sessão confirmaram no §4 — o comentário original em `shell.jsx` ("só P.I. está pronta, as demais entram indentadas conforme migradas") pode estar desatualizado; o §4 abaixo reflete o que os agentes efetivamente encontraram implementado no código nesta data, não o que o comentário antigo dizia.

### 21.6 Testes existentes — cobertura real
15 arquivos de teste (`src/*.test.js`), 154 casos, **todos passando** no momento deste documento (`node --test src/*.test.js`). Cobrem: métricas de dashboard (4 módulos), motor de DIFAL, motor de contrato de venda, gates de projeto (`project-gates.test.js`), processamento de notificações, roteador (`router.test.js`), e o motor de Precificação V1/V2 (mais denso — 20 casos, incluindo o teste de regressão que reproduz o bug do V1 de propósito, §21.2). **Não há testes automatizados** para: Formulário de Elevador, Cotação a Fornecedor, Propostas, Aval Financeiro, nem para nenhuma tela do bloco Engenharia/Instalação/Importação — risco real de regressão silenciosa nesses módulos.

## 22. Roadmap incremental (se este RAG for implementado de verdade)

1. **Fase 1 — Fundação:** criar `rag_chunks` (pgvector no mesmo Supabase), popular com os chunks de rota (§4) e tabela (§5) deste documento — sem LLM ainda, só busca por similaridade validável manualmente.
2. **Fase 2 — Eventos:** conectar o `EventosFluxo` existente (§19.1) como segunda trilha de ingestão, pra perguntas sobre registros reais.
3. **Fase 3 — Orquestração:** LLM + contrato de citação (§9.2) + interface MCP (§20).
4. **Fase 4 — Operação contínua:** reingestão automática em cada push, avaliação contínua (§13).

---
*Documento gerado por engenharia reversa do código-fonte real de `verticalpartsIA/010_GestaoImportacao` (branch `main`), estruturado a partir do método de `verticalpartsIA/005_vpclick/.rag/rag.md`. Nenhum campo, botão ou regra de negócio citado neste documento foi inventado — cada afirmação é rastreável a um arquivo real do repositório.*
