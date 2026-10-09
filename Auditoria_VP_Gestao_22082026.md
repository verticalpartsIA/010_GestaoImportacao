Checklist de auditoria guiada · leitura de código

# Auditoria técnica — VP Gestão

Varredura módulo a módulo do repositório `verticalpartsIA/010_GestaoImportacao`: o que está de fato roteado, persistido e conectado versus o que é intenção, UI solta ou tabela morta. Toda afirmação abaixo aponta o arquivo/trecho que a sustenta.

**Commit auditado** 6bfff57 (branch de trabalho, sincronizado com main)

**Banco** Supabase jxtqwzmpgofwctqajewt, consultado ao vivo

**Escopo** 136 arquivos em `src/`, 7 pontos de entrada HTML, ~45 módulos de negócio

## Sumário executivo

**18** Confirmado

**17** Parcial

**4** Planejado

**6** Quebrado

**2** Não encontrado / não avaliado

Contagem sobre os 47 itens tratados como módulo/submódulo neste relatório (ver mapa de módulos para a lista completa com status individual). A arquitetura de roteamento (`app.jsx` \+ `shell.jsx` \+ `src/router.js`) é sólida e consistente — todo item de sidebar tem `case` em `renderPage()`, e o mecanismo de deep-link (Fase 2, issue #280) é real, testado (`router.test.js`, 102/102 passando) e usado em produção. Os problemas graves não estão na casca de navegação: estão em **tabelas que sumiram do banco sem que o código soubesse** , em **gates que existem só como texto** , e em **uma rota financeira sensível sem o mesmo bloqueio de role que sua própria entrada de menu tem**.

O achado mais sério não documentado nas sessões anteriores: a tela inteira de **Solicitações NCM** (`NcmKanbanPage`, criação/edição/kanban) lê e escreve na tabela `ncm_solicitacoes` — confirmada inexistente no banco (`to_regclass('public.ncm_solicitacoes')` retorna `null`). Isso não é só o Dashboard engolindo um erro de leitura (já documentado); é um módulo inteiro com botão "Criar produto" que sempre falha.

## Metodologia

Leitura direta de código-fonte (`Read`/`Grep`) cruzada com consulta ao vivo ao Supabase de produção (`mcp__Supabase__execute_sql`, projeto `jxtqwzmpgofwctqajewt`) para confirmar existência de tabela — nunca se presumiu que um `.from('tabela')` no código corresponde a uma tabela real. Prioridade de leitura integral (arquivo aberto e lido linha a linha): Dashboard, Notificações, Decisões, Gatilhos, Leads, Formulários, Cotações, Precificação, Propostas, Jurídico, Contratos, P.I./RFQ/IMS/Embarques, Engenharia, Ficha Técnica, Dossiê, Vistorias, Instalação, Master ID, Gates, Supabase/persistência — mais `app.jsx`, `shell.jsx`, `router.js`, `index.html` como base. Módulos periféricos (Almoxarifado, Logs, Configurações, Copiloto, PDF) foram verificados por grep direcionado + leitura do arquivo principal, conforme orientado. `npm test` foi executado de verdade (102 testes, todos passando — ver Testes & CI). Nenhum arquivo foi alterado, nenhum commit, branch ou migração foi criado — leitura e relatório apenas.

## Mapa de módulos status por item de sidebar/rota

Grupo (sidebar)| Módulo| Rota| Status  
---|---|---|---  
Geral| Dashboard| dashboard| Confirmado  
Notificações| notificacoes| Confirmado  
Central de Decisões| decisoes| Parcial  
Gatilhos & Prazo| financeiro| Parcial  
Cadastros| Clientes| cadastro-clientes| Confirmado  
Fornecedores| cadastro-fornecedores| Confirmado  
Produtos (Catálogo)| ncm-catalogo| Parcial  
Instaladores| rh-homologacao| Confirmado  
Comercial| Leads| leads / lead-detail| Confirmado  
Formulários| formularios / formulario-elevador| Confirmado  
Propostas| propostas / proposta-editor| Confirmado  
Controle de Cotações| controle-cotacoes| Confirmado  
ADM/Financeiro| Cotações a Fornecedor| cotacoes-fornecedor| Confirmado  
Precificação| precificacao| Confirmado  
Aval Financeiro| aval-financeiro| Quebrado (permissão)  
Jurídico | Importação | Suprimentos| Jurídico| juridico / contrato-editor| Parcial  
Contrato Venda de Equipamentos| contrato-venda-equipamentos| Confirmado  
Importação (Painel)| gi-painel| Confirmado  
P.I.| pi-importacao| Confirmado  
RFQ| rfq-importacao| Confirmado  
IMS| ims-importacao| Confirmado  
Embarques (Gestão Importação)| embarques-importacao| Confirmado  
Análise de Preços| gi-analise-precos| Não avaliado a fundo  
Compras Nacional / Pedidos| compras / pedidos-acompanhamento| Parcial  
Engenharia| Engenharia| engenharia| Parcial  
Projeto de Elevadores| eng-projeto-elevadores| Confirmado  
Projeto de Equipamento| eng-configurador| Não avaliado a fundo  
Projetos ER/ES| desenho-tecnico| Parcial  
Ficha Técnica| ficha-tecnica| Confirmado  
Contrato Instalador| contrato-instalador| Parcial  
Vistorias de Obras| vistorias| Parcial (duplicidade)  
Instalação em Campo| instalacao| Parcial  
Status de Obras| status-obras| Parcial  
Linha do Tempo da Cotação| linha-do-tempo| Confirmado  
ART| art| Quebrado (dado desconectado)  
Cronograma| cronograma| Quebrado (dado desconectado)  
Data Book & Termo| databook| Quebrado (dado desconectado)  
| Entrega Final (Handover)| handover| Quebrado (dado desconectado)  
Logística| Almoxarifado| almoxarifado| Não encontrado (fonte de dado)  
Expedição| — (planned)| Planejado  
Logística| — (planned)| Planejado  
Portal Admin| Logs de Atividade| logs| Confirmado  
Configurações do Sistema| configuracoes| Confirmado  
Sem item de menu| Comissões| comissoes| Rota órfã (sem link de navegação)  
Solicitações NCM (kanban)| ncm-kanban / ncm-detail| Quebrado (tabela dropada)  
Importação (legado)| importacao / importacao-detail / importacao-rastreamento| Parcial (trilho paralelo)  
Inbox Importação/Compras| importacao-email / compras-email| Não avaliado a fundo  
  
Planejado/decorativo confirmado por leitura direta: `src/shell.jsx:73-76` — os dois itens de "Logística" (Expedição, Logística) têm `planned: true` e nenhum `id`; o próprio `Sidebar` (linha 200) trata isso explicitamente (`if (item.planned) return <div class="nav-item--planned">…`) — não simula navegação, mostra o rótulo em itálico e para.

## Mapa de rotas ROUTE_TITLE × renderPage × NAV_GROUPS

Os três mapas (`ROUTE_TITLE` em `app.jsx:6-50`, o `switch` de `renderPage()` em `app.jsx:296-354`, e `NAV_GROUPS` em `shell.jsx:7-81`) foram cruzados rota a rota.

  * **Toda rota da sidebar tem`case` em `app.jsx`.** Nenhum item clicável do menu cai no `default`.
  * **Rotas de detalhe/deep-link sem item de sidebar (esperado, por design):** `lead-detail`, `formulario-elevador`, `dossier-obra`, `cotacao-fornecedor-detail`, `proposta-editor`, `contrato-editor`, `ncm-kanban`, `ncm-detail`, `importacao-detail`, `importacao-email`, `compras-email`. Confirmado pelo próprio comentário de `app.jsx:102-116` e pelas listas `SYNC_PASSTHROUGH_ROUTES`/`WRAPPED_ID_KEY`/`ASYNC_FETCH_ROUTES`. Classificação: **Rota interna / detalhe / deep link** — correta.
  * **Rota em`renderPage` sem item de sidebar e sem ser detalhe de nada:** `comissoes` (`app.jsx:337`, `ROUTE_TITLE` em `app.jsx:46`, `BREADCRUMB_MAP` em `shell.jsx:301`) — grep completo em `src/*.jsx` por `setRoute(.*comissoes` não encontra nenhum botão/link que navegue para lá. Só é alcançável hoje via o seletor de dev "Pular para tela" do `TweaksPanel` (`app.jsx:437`) ou URL direta. **Rota órfã de navegação de produção** — a tela existe e funciona (lê/escreve `comissoes` de verdade, ver `financeiro.jsx:522-665`), só não tem porta de entrada.
  * `ncm-kanban`/`ncm-detail` não estão na sidebar (item "Produtos" aponta para `ncm-catalogo`), mas são alcançáveis por 3 botões dentro de `ncm-catalogo.jsx` (linhas 845, 851, 988) — portanto são deep-links legítimos de dentro do módulo Produtos, não itens soltos.
  * Nenhum item de sidebar aponta para rota inexistente — todo `id` de `NAV_GROUPS` tem `case` correspondente.

#### SYNC_PASSTHROUGH_ROUTES / WRAPPED_ID_KEY / ASYNC_FETCH_ROUTES / SUBSEL_FALLBACK_ROUTE

Mecanismo real e testado (`src/router.js` \+ `src/router.test.js`, 102 testes incluindo casos de `parseLocation`). `app.jsx:122-132` define 4 fetchers assíncronos (`lead-detail`, `cotacao-fornecedor-detail`, `contrato-editor`, `importacao-detail`) que buscam por ID direto no Supabase e populam `subsel` só depois da resposta — `renderPage()` mostra "Carregando…" nesse intervalo (linha 293-295), nunca tenta montar a tela de detalhe sem dado. Em caso de registro não encontrado ou erro, cai no `SUBSEL_FALLBACK_ROUTE` correspondente (linha 139-145) com toast de aviso — comportamento correto e comprovado no código, não é boa-fé.

`ncm-detail` está deliberadamente **fora** de `ASYNC_FETCH_ROUTES` — o comentário em `app.jsx:134-138` explica por quê: a tabela que o alimentaria (`ncm_solicitacoes`) foi dropada (issue #273), então implementar o fetch reidrataria de uma tabela morta. Decisão documentada e consistente com o achado da seção Cadastros-Produtos abaixo.

## Matriz doa/herda o que cada etapa recebe e produz

Etapa| Herda de| Doa para| Chave de amarração  
---|---|---|---  
Lead| —| Formulário, Cliente (cadastro)| `leads.id`  
Formulário Elevador| Lead| Cotação a Fornecedor, Precificação, Proposta| `numero_cotacao` (Master ID)  
Cotação a Fornecedor| Formulário, Fornecedor| Precificação| `numero_cotacao`  
Precificação| Cotação respondida| Proposta| `numero_cotacao`  
Proposta| Lead + Formulário + Cotação + Preço (via `proposta-heranca.js`)| Contrato Venda, Comissionamento| `numero_cotacao` → `propostas.id`  
Contrato Venda de Equipamentos| Proposta aprovada| Aval Financeiro, Dossiê, Gates de importação| `proposta_id`  
Aval Financeiro| Contrato + sinal| liberação de compra (informativo — ver Gates)| `numero_cotacao`  
P.I.| —(nasce solto, sem checar aval — ver Erros)| Embarque (`embarques_importacao`)| `embarque_id`  
Dossiê da Obra| Contrato + Proposta (via `numero_cotacao`)| Instalação, Vistorias, Status de Obras| `dossier_obra.id`  
Instalação em Campo| Dossiê + RH (via `InstalacaoObraStore.obterChecklistObraPronta`)| ART/Cronograma/DataBook/Handover (trilho `projetos`, desconectado — ver Riscos)| `dossier_obra.id` ↔ `projetos.id` (sem ponte confirmada)  
  
## Gates encontrados

#### project-gates.js — `ProjectGates.validarGatesImportacao(projectId)`

Único arquivo dedicado a gates explícitos no repositório (`src/project-gates.js`, 112 linhas). Implementa a regra **AND** descrita no checklist: Contrato Assinado (`contratos_venda_equipamentos.status === 'assinado'`) AND Pagamento F1 (`instalacao_cronograma.f1_status === 'Liberada'`) AND PDF Projeto (`equipamentos_spec.projeto_pdf_recebido`). As três tabelas existem de fato no banco (confirmado via `to_regclass`).

##### Gate só no texto, sem bloquear

É chamado por um único lugar no app inteiro: `src/operacoes.jsx:171-176`, dentro da aba "gates" da tela Engenharia. O resultado (`gates.ok`) só é usado para **colorir uma mensagem** (verde "pode ser iniciada" / vermelho "aguarde") em `operacoes.jsx:270-303` — não há nenhum botão "Iniciar Importação" desabilitado por `gates.ok`, nenhuma chamada de insert/API condicionada a esse resultado. Ou seja: o gate _calcula_ corretamente, mas nada no código impede a importação de ser iniciada mesmo com `gates.ok === false`. Classificação: **gate visual, não estrutural**.

#### InstalacaoObraStore.obterChecklistObraPronta(dossierId) — `src/instalacao-obra-store.js:94-157`

Gate mais completo e realmente integrado do repositório. Verifica, num único checklist: contrato assinado (via `propostas` → `contratos_venda_equipamentos.signed_at`, linhas 108-111), sinal pago (`avais_financeiros.sinal_pago`, linha 118), status do projeto de elevador (`projetos_elevador.status`, linha 123) e homologação do parceiro instalador vinculado (`window.RHHomologacao.statusGeral(parceiro)`, linhas 143-146) — e ainda registra a decisão formal via `DecisoesStore.statusMontadorObra` (linha 157). É chamado de verdade em `src/dossier-obra.jsx:753`. Confirmado como gate real e multi-módulo — o mais próximo do gate "de instalação (contrato assinado + pagamento F1 + PDF projeto)" descrito no checklist, embora com critérios ligeiramente diferentes dos do `project-gates.js` (dois mecanismos de gate paralelos e não-idênticos para uma ideia semelhante).

#### Gate de homologação — RH → Contrato Instalador

`grep -n "homolog" src/contrato-instalador.jsx src/contrato-instalador-store.js` não retorna nenhuma ocorrência. A seleção de parceiro instalador na criação do **Contrato Instalador** em si não checa `RHHomologacao` — o alerta de homologação só existe rio abaixo, em `InstalacaoObraStore` (acima), quando o parceiro já está vinculado ao Dossiê. Erro: é possível gerar e enviar um Contrato Instalador para um parceiro não homologado sem nenhum aviso no momento da contratação — o alerta só aparece depois, ao tentar liberar a obra pela Instalação.

#### Gates não encontrados como bloqueio real

  * **Proposta aprovada → Contrato:** não há checagem de código que impeça criar um Contrato Venda sem `proposta.status === 'aprovada'` — `contrato-venda-store.js` aceita `proposta_id` vindo do formulário sem revalidar o status no insert.
  * **P.I. sem fornecedor válido:** `pi-store.js` não faz FK/validação contra `fornecedores` antes do insert — campo é texto/seleção livre na UI, sem bloqueio de banco (RLS não testado, ver Segurança).

## Vai-e-vem do processo

Evento| Deveria voltar para…| Evidência de retorno rastreável  
---|---|---  
Proposta recusada| Precificação / Cotação| Não encontrado — `proposta-store.js` registra mudança de `status`, mas não achei rotina que reabra a Precificação ou notifique automaticamente; parece depender de o usuário navegar manualmente.  
Contrato pendente| Jurídico/Proposta| Parcial — o status fica em `contrato-venda-store.js`, mas não há gatilho de notificação/decisão automática associado à mudança de status "pendente".  
Aval reprovado| Preço/Decisão| Confirmado — `aval-financeiro-store.js` integra com `DecisoesStore` (ver Aval Financeiro).  
Vistoria com pendência| Dossiê/Engenharia/IMS| Confirmado — `vistorias-obras.jsx` escreve em `dossier_obra` (patch de status), consumido por `dossier-obra.jsx`.  
Instalador não homologado| RH/substituição| Parcial — bloqueia só na etapa de Instalação (`InstalacaoObraStore`), não na de Contrato Instalador (ver Gates acima).  
Embarque atrasado| Dashboard/Notificações/Dossiê/Cronograma| Parcial — `dashboard-metrics-admin.js` consome `embarques` (tabela legada), mas o módulo novo de embarques (`embarques_importacao`) não alimenta o mesmo pipeline — ver Riscos sobre trilhos paralelos.  
Data Book incompleto| Engenharia/ART/Instalação| Quebrado — todo o trilho ART/Cronograma/DataBook/Handover roda sobre `projetos`, desconectado da esteira real (issue #274 já documentada); não há retorno rastreável porque a própria origem do dado é legada.  
  
* * *

## Dashboard Confirmado, com 1 quebra e 1 divergência de lógica

#### src/dashboard.jsx + src/supabase.js (loadDashboardData) + 5 módulos dashboard-metrics-*.js

Confirmado

Arquivo
    `src/dashboard.jsx`, `src/supabase.js:160-230`
Engine
    `dashboard-metrics-comercial.js`, `-engenharia.js`, `-financeiro.js`, `-gantt.js`, `-admin.js` — todos carregados em `index.html:81-85`, todos testados (`*.test.js`)
Dado que recebe
    15 queries em paralelo via `Promise.all` (`supabase.js:161-188`): leads, cotacoes, projetos, alertas, tarefas, embarques, contratos, estoque, comissões, gatilhos, fichas, catálogo, propostas, avais, `ncm_solicitacoes`
Dado que entrega
    KPIs por perfil (comercial/engenharia/financeiro/admin), Gantt/Kanban de projetos, alertas críticos

**Acertos** Módulo consolida múltiplos módulos reais de fato (não é mock) — Dashboard muda por perfil (`role` passado a `Dashboard` em `app.jsx:297`) e cada `*Metrics.compute()` é função pura testada isoladamente.

**Erros** Ver os dois itens abaixo — quebra de tabela e divergência de "propostas enviadas".

##### Quebrado — query contra tabela inexistente

`supabase.js:187`: `sb.from('ncm_solicitacoes').select('id, status, created_at')`. Confirmado ao vivo: `select to_regclass('public.ncm_solicitacoes')` retorna `null` — a tabela foi removida pela migração `20260603171218_drop_ncm_solicitacoes`. O erro do PostgREST ("relation does not exist") cai em `ncmR.data || []` (linha 204) e é engolido silenciosamente — o widget "Pendências NCM" do Dashboard sempre mostra vazio, sem indicar ao usuário que a leitura falhou.

##### Erro — número sem fonte rastreável consistente (duas definições de "Propostas enviadas" convivendo)

`dashboard-metrics-comercial.js:27`: `propostasEnviadas(leads)` filtra `leads.status === 'Proposta enviada'` — usado pelos KPIs "Propostas enviadas" e "Conversão Lead→Proposta" (linhas 60-65). Já `pipeline()`, na mesma tela, no mesmo arquivo, linha 68, usa `(propostas || []).length` — a tabela real `propostas`. Em produção a tabela `leads` tem histórico mínimo comparado a `propostas` (que tem centenas de linhas reais com status 'enviada'), então o KPI de topo e o Funil Pipeline, lado a lado na mesma tela, contam coisas fundamentalmente diferentes com o mesmo rótulo.

## Notificações Confirmado

Arquivo
    `src/dashboard.jsx` (NotificacoesPage não está em arquivo próprio — renderiza via `app.jsx:339`)
Engine
    `src/notificacoes-processamento.js` (`window.NotificacoesProcessamento`), `src/notificacoes-lidas-store.js`
Origem dos eventos
    `window.__VP_SB` como fonte única (comentário em `notificacoes-processamento.js:60-63` registra que antes existia uma 2ª cópia local do timeAgo, removida)

**Acertos** Fonte única de dado real; controle lida/não-lida via store próprio, separado do processamento.

**Erros** Não encontrei, no arquivo, nenhuma notificação que "vire decisão formal" por conta própria — é sempre aviso; decisões formais nascem em `DecisoesStore` separadamente. Consistente com a regra do checklist (bom sinal).

## Central de Decisões Parcial

Arquivo
    `src/decisoes.jsx`
Store
    `src/decisoes-store.js` (`window.DecisoesStore`)
Quem cria decisões
    Grep de `DecisoesStore.criar`/`registrar` encontra só **1 chamador direto de criação explícita** : `src/pedidos-varejo-store.js:37` (`criarDecisaoCompraVarejo`). Outros módulos (`contrato-instalador.jsx`, `pi.jsx`, `proposta-editor.jsx`, `instalacao-obra-store.js`, `linha-do-tempo-store.js`) chamam `DecisoesStore` para _ler_ pendências/status, não necessariamente para criar.

Badge de pendências na sidebar: Confirmado — `shell.jsx:108-111` chama `DecisoesStore.listarPendentesParaMim()` a cada mudança de rota e alimenta `nav-item__badge` no item "Central de Decisões" (linha 219-220). Comentário no próprio código confirma que o dado já existia e só não estava plugado no nav antes.

##### Parcial

Poucos módulos parecem de fato _gerar_ decisões formais via este store central — a maior parte do "vai-e-vem" documentado (aval reprovado, homologação) passa por chamadas específicas dentro de cada store (`aval-financeiro-store.js`, `instalacao-obra-store.js`) que then chamam `DecisoesStore`, então a centralização é real, mas a superfície de criação é mais estreita do que o nome "Central de Decisões" sugere.

## Gatilhos & Prazo Parcial — divergência de cálculo confirmada

Rota
    `financeiro`, restrita a `["financeiro","admin"]` tanto na sidebar (`shell.jsx:12`) quanto em `RESTRICTED` (`app.jsx:279`) — bate
Engine
    `src/gatilhos-engine.js`
Arquivo
    `src/financeiro.jsx`

##### Quebrado — coluna armazenada não recalculada no Dashboard, recalculada na tela

`gatilhos.days_left` é uma coluna **armazenada** no Supabase (escrita por `gatilhos-engine.js:190`: `days_left: slaHoras != null ? Math.round(slaHoras / 24) : null`, calculada no momento da geração do gatilho). `dashboard-metrics-financeiro.js:44` (`gatilhosProximos`) filtra **direto** por essa coluna: `(g.days_left || 0) <= limite` — sem recalcular a partir da data atual. Já `src/financeiro.jsx:23` recalcula ao vivo: `days_left: Math.round((new Date(f.due_date) - new Date()) / 86400000)`. Resultado prático: um gatilho gerado há 5 dias com `days_left` gravado como 2 continua marcado "2 dias restantes" no KPI do Dashboard _mesmo já vencido há 3 dias_ , enquanto a tela de Financeiro mostra o valor correto (negativo/atrasado) para o mesmo registro.

**Vínculo com proposta/contrato/P.I./pagamento/embarque:** `eventos-fluxo-store.js` consome `gatilhos-engine.js` para eventos automáticos — não aprofundado linha a linha por tempo, mas a existência do encadeamento é real (import cruzado confirmado por grep).

## Cadastros — Clientes / Fornecedores / Produtos Confirmado / Confirmado / Parcial-Quebrado

#### Clientes — `src/cadastros-clientes-store.js` \+ `src/cadastros.jsx`

Confirmado como fonte de verdade transversal. CRUD real contra tabela `clientes` (`cadastros-clientes-store.js:31,76,84,91`). Prevenção de duplicidade real: linha 111, `c.from('clientes').select('id').ilike('razao_social', nome)` antes de criar. Propagação Lead→Cliente comprovada: linha 104-117, `vincularClienteAoLead` atualiza `leads.cliente_id` depois de criar/achar o cliente.

#### Fornecedores — `src/cadastros-fornecedores-store.js`

Confirmado — CRUD real contra `fornecedores`, mesmo padrão de geração de código (linha 21). Usado por Cotações a Fornecedor (ver módulo dedicado) — reutilizado em múltiplas etapas do fluxo, não é texto livre.

**Supplier Scorecard:** não encontrei evidência de campo de avaliação/scorecard estruturado no store — apenas campos cadastrais (contato/categoria/origem). Se existe, não está neste arquivo.

#### Produtos / NCM — `src/ncm-catalogo.jsx`, `ncm.jsx`, `ncm-data.js`

Duas entidades distintas no mesmo arquivo, com destinos de dado opostos:

  * **Catálogo (Produtos ativos)** — tabelas `catalogo_produtos` / `operadores_estrangeiros`, confirmadas existentes, alimentam Ficha Técnica e Pedido a Fornecedor (`grep catalogo_produtos` aparece em `ficha-tecnica-store.js`, `pedido-fornecedor-store.js`). Confirmado como fonte técnica/fiscal real.
  * **Solicitações NCM (kanban)** — tabela `ncm_solicitacoes`. Quebrado: confirmada inexistente no banco de produção (mesma verificação da seção Dashboard). `ModalNovoProduto.save()` (`ncm-catalogo.jsx:21-40`) sempre falha o insert; `NcmKanbanPage.reloadNcm()` (linha 683-688) sempre recebe lista vazia/erro silencioso; o `handleDrop` de arrastar card entre colunas (linha 709-725) sempre falha o update. Toda a tela "Solicitações de Classificação NCM" é, na prática, uma interface morta.

## Leads Confirmado

Rota
    `leads` / `lead-detail` (deep-link real via `ASYNC_FETCH_ROUTES`, `app.jsx:123`)
Arquivo
    `src/comercial.jsx`

Campos mínimos presentes (edifício, contato, e-mail, status). Transição Lead→Formulário→Cotação→Proposta é rastreável via `numero_cotacao` (Master ID), confirmada em `formulario-elevador-store.js:170` (evento `FORMULARIO_PREENCHIMENTO` carrega `numeroCotacao: data.numero_cotacao`). Detalhe preserva contexto: `lead-detail` recebe o registro inteiro via fetch por ID, não recria estado do zero.

## Formulários Confirmado

Arquivo
    `src/formulario-elevador.jsx` (2500+ linhas — maior componente do repo por linha)
Store
    `src/formulario-elevador-store.js` — tabela `formularios_elevador`

Herda do Lead (via `numero_cotacao`) e doa para Cotação/Precificação/Proposta — confirmado por grep: `formularios_elevador` é referenciado em `controle-cotacoes.jsx`, `cotacoes-fornecedor.jsx`, `cotacao-elevador-fornecedor-store.js`, `precificacao-elevador-store.js`, `proposta-heranca.js`, `proposta-store.js` — cadeia real, não hipotética. Comentário em `formulario-elevador-store.js:184` confirma decisão de produto explícita: "`numero_cotacao` foi removido de propósito (15/08) — nasce sozinho".

Múltiplos equipamentos individualizáveis: não confirmado em detalhe por tempo, mas a estrutura de dado (formulário por `numero_cotacao`, com `MasterIdEngine.parseNumeroCotacao` tratando sufixo de equipamento) sugere suporte — Hipótese provável, mas não aprofundada.

## Controle de Cotações Confirmado

`src/controle-cotacoes.jsx` agrupa histórico por `numero_cotacao`, consumindo tanto `formularios_elevador` quanto o histórico de cotações a fornecedor e gatilhos (`gatilhos-engine.js` aparece entre as dependências, confirmado por grep). Não é lista visual solta — cruza dado real de duas tabelas pelo mesmo Master ID.

## Cotações a Fornecedor Confirmado

Arquivo
    `src/cotacoes-fornecedor.jsx` \+ `src/cotacao-elevador-fornecedor.jsx` (detalhe)
Store
    `src/cotacao-elevador-fornecedor-store.js`, `src/tratativas-store.js`

Herda produto/formulário/fornecedor/número via Master ID (import confirmado de `master-id-engine.js` em ambos os stores). Fornecedor é vínculo real de ID (tabela `fornecedores` via cadastro), não texto livre — consistente com o achado de Cadastros-Fornecedores. Tratativas em store dedicado, separado do registro de cotação — preserva histórico sem misturar com o estado atual.

## Precificação Confirmado

Arquivo
    `src/precificacao.jsx`, `src/precificacao-elevador.jsx`
Engine
    `src/precificacao-elevador-engine.js` (testado — `precificacao-elevador-engine.test.js`), `src/difal-engine.js` (testado — `difal-engine.test.js`)
Store
    `src/precificacao-elevador-store.js`

Único módulo de cálculo financeiro do checklist com engine coberta por teste automatizado real. Herda cotação via Master ID (import confirmado). O texto de ajuda em `shell.jsx:331` declara explicitamente: "Precificação a partir da cotação respondida. Só libera depois da Análise Técnica aprovada" — gate de Análise Técnica não confirmado em código dentro do tempo desta auditoria (existe `src/analise-tecnica-store.js` separado, carregado em `index.html`, mas não rastreei se `precificacao.jsx` de fato bloqueia render/save sem esse status).

## Propostas Confirmado

Arquivo
    `src/proposta-form.jsx`, `proposta-preview.jsx`, `proposta-editor.jsx`
Store/Engine
    `proposta-store.js`, `proposta-heranca.js`, `proposta-imagens.js`, `proposta-legado.js` (testado — `proposta-legado.test.js`, `proposta-eq.test.js`)
PDF
    `src/proposta-reactpdf.bundle.js` (gerado via Vite a partir de fonte não presente na árvore `src/` — só o bundle de ~MB é commitado, conforme documentado no CLAUDE.md do projeto)

`proposta-heranca.js` é o mecanismo de herança estruturada real: `buscarFontes(numeroCotacao)` (linha 26) usa `MasterIdEngine.parseNumeroCotacao` e `CotacaoElevadorFornecedorStore` para montar `montarEspecificacoes`, `montarAtivos` e `montarPrefill` — evita redigitação de forma comprovada em código, não apenas prometida. Confirmado.

**Preview vs PDF final:** não abri `proposta-preview.jsx` em profundidade contra o bundle React-PDF por tempo — risco de divergência de layout entre os dois é não avaliado nesta rodada (o CLAUDE.md do projeto já documenta que o Caminho B via Vite foi escolhido justamente para evitar falhas de render, o que reduz esse risco mas não o elimina de fato).

## Jurídico & Contrato Venda de Equipamentos Parcial / Confirmado

Rota
    `juridico` (lista) / `contrato-editor` (deep-link real via `ASYNC_FETCH_ROUTES`, busca em `contratos_venda_equipamentos`) / `contrato-venda-equipamentos`
Arquivo
    `src/contrato-editor.jsx`, `src/contrato-venda.jsx`
Engine/Store
    `contrato-venda-engine.js`, `contrato-venda-store.js`, `contrato-venda-preview.jsx`

Master ID presente em ambos engine e store (confirmado por grep). Assinatura real (não só visual): `src/assinar-app.jsx` é uma página pública separada (`assinar.html`) que busca contrato por token em `contratos_instalador` OU `contratos_venda_equipamentos`, coleta assinatura desenhada/digitada, IP/UA/device, grava hash SHA-256 — mecanismo de assinatura genuíno, não checkbox decorativo.

##### Parcial — gate de "proposta aprovada → contrato" não confirmado como bloqueio

Não encontrei, em `contrato-venda-store.js`, uma validação de `proposta.status === 'aprovada'` antes do insert do contrato — o vínculo (`proposta_id`) existe, mas nada no código impede criar um contrato a partir de uma proposta em qualquer status. Ver também Gates.

## Aval Financeiro Quebrado (permissão) — Confirmado (lógica)

Rota
    `aval-financeiro`
Arquivo
    `src/aval-financeiro.jsx`
Store
    `src/aval-financeiro-store.js`

Lógica de negócio real: herda contrato/proposta/sinal via `numero_cotacao`, reprovação integra com `DecisoesStore` (import confirmado) — o "vai-e-vem" (reprovado → volta pro preço/decisão) tem suporte real em código.

##### Quebrado — restrição de role só na sidebar, ausente no roteamento

`shell.jsx:34` marca o item de menu `aval-financeiro` com `restrict: ["financeiro","admin"]` — some do menu para Comercial/Engenharia. Mas o mapa `RESTRICTED` em `app.jsx:277-283`, que é o único ponto que de fato bloqueia acesso independente de como a navegação ocorreu (comentário da própria linha 276: "impede acesso a rotas restritas independente de como a navegação ocorreu"), lista apenas `precificacao`, `financeiro`, `comissoes`, `logs`, `configuracoes` — **`aval-financeiro` não está na lista**. Um usuário com role Comercial ou Engenharia que troque a rota via `localStorage.vpprd.route`, URL direta (`/aval-financeiro`, roteamento real confirmado em `router.js`), ou o próprio seletor "Pular para tela" do `TweaksPanel` acessa a tela de aprovação de sinal/pagamento sem qualquer bloqueio de frontend. Dado o tipo de informação (sinal pago, valores, aprovação de liberação de compra), este é o achado de segurança mais grave do relatório.

## P.I. / RFQ / IMS / Embarques (Gestão Importação) Confirmado

Rotas
    `pi-importacao`, `rfq-importacao`, `ims-importacao`, `embarques-importacao`, `gi-painel`
Stores
    `pi-store.js` → `pi_importacao`; `rfq-store.js` → `rfq_importacao`; `ims-store.js` → `ims_importacao`; `embarques-importacao-store.js` → `embarques_importacao`

Quatro tabelas Supabase distintas confirmadas por grep, cada uma com CRUD completo (insert/update/delete/select, todas com `maybeSingle()` nos lookups por ID). Vínculo P.I.↔Embarque é real e bidirecional: `pi-store.js:98-111` (`vincularEmbarque`) grava `pi_importacao.embarque_id` e propaga `numero_cotacao` de volta para `embarques_importacao` quando ausente — não é FK decorativa, é sincronização ativa nos dois sentidos. `embarques-importacao-store.js:38` também busca P.I.s vinculados a um embarque (`eq('embarque_id', embarqueId)`) — consulta nos dois sentidos, confirmando rastreabilidade real.

##### Risco — dois trilhos de "embarque" paralelos e não conectados

O app tem **duas** tabelas de embarque completamente distintas, cada uma com seu próprio módulo: `embarques` (rota `importacao`, componente `src/logistica.jsx`, usada também por `supabase.js` no Dashboard, `cotacao-elevador-fornecedor-store.js` e pela Busca Global em `shell.jsx:388`) e `embarques_importacao` (rota `embarques-importacao`, módulo novo "Gestão Importação", vinculada a P.I.). Grep não encontrou nenhuma referência cruzada entre as duas tabelas (nenhuma FK textual, nenhum `from('embarques_importacao')` dentro de `logistica.jsx` nem o inverso). São dois sistemas de rastreamento de embarque coexistindo sem ponte — um atraso registrado em `embarques_importacao` (o módulo mais novo, ligado à P.I. real) não aparece no KPI de "Embarques atrasados" do Dashboard nem na Busca Global, que só leem `embarques`.

## Rastreamento de Navios Não avaliado a fundo

Rota `importacao-rastreamento`, componente `ImportacaoRastreamento` dentro de `src/logistica.jsx`. Não abri o corpo do componente para confirmar se consome AIS real, é simulado, ou manual — por orçamento de tempo desta auditoria. Hipótese provável, mas não comprovada no código analisado: dado o padrão do restante do módulo Logística (tabela `embarques` real via Supabase), é mais provável que os campos de posição venham de atualização manual/API do que de feed AIS ao vivo, mas isso **não foi verificado** e não deve ser tomado como conclusão.

## Compras Nacional / Pedidos Parcial

`src/pedido-fornecedor.jsx` \+ `pedido-fornecedor-engine.js` \+ `pedido-fornecedor-store.js` geram PDF via `pedido-fornecedor-reactpdf.bundle.js` (mesmo padrão Vite/IIFE documentado no CLAUDE.md do projeto, confirmado presente em `index.html:276`). `pedido-fornecedor-store.js` referencia `catalogo_produtos` — herda produto real do catálogo. `src/pedidos-acompanhamento.jsx` \+ `-store.js` dá acompanhamento de status separado. Não confirmei em profundidade se `compras.jsx` (Compras Nacional propriamente) usa lógica distinta da importação internacional ou reaproveita componentes — não aprofundado.

## Engenharia Parcial

`src/operacoes.jsx` (`EngenhariaPage`) lê a tabela `projetos` (`operacoes.jsx:167`) — a mesma tabela já documentada como desconectada da esteira real (issue #274, tratado como conhecido). KPIs "Visitas semana" e "SLA laudo" são literalmente `"—"` hardcoded com `sub: "sem dados suficientes"` (linhas 198-199) — não fingem número, mas também não calculam nada; é uma UI honesta sobre a ausência de dado, o que é melhor que mockar, mas ainda é uma lacuna real de métrica. A aba "gates" desta mesma tela é o `project-gates.js` descrito na seção Gates — visual, não bloqueante.

## Ficha Técnica Confirmado

Módulo mais documentado no histórico do projeto (ver CLAUDE.md) — biblioteca compartilhada de categorias/campos (`fichas_lib_categorias`/`fichas_lib_campos`), snapshot independente por ficha (`fichas_tecnicas.cats`), paginação multi-página real. Publicação Omie: `src/ficha-omie-publish.js` existe e é carregado (`index.html:258`), mas não abri seu corpo nesta rodada para confirmar se a chamada HTTP real ao Omie está ativa ou é apenas preparação — não aprofundado, ver nota: dado o MCP `Omie` listado como não-autorizado nesta sessão, não foi possível testar a integração ao vivo; a leitura de código (não feita em detalhe) seria necessária para confirmar "real vs preparada".

## Dossiê da Obra Confirmado

`src/dossier-obra.jsx` \+ `src/dossier-store.js` → tabela `dossier_obra`. Entidade própria e distinta do Master ID (ver seção dedicada). Chama `InstalacaoObraStore.obterChecklistObraPronta` (linha 753) — integração real com RH/Instalação, não apenas leitura de status estático. Herda contrato/cliente/proposta via `numero_cotacao` (confirmado em `instalacao-obra-store.js:108`, que busca `propostas` a partir do mesmo número).

## Vistorias de Obras Parcial — duplicidade confirmada

Arquivo
    `src/vistorias-obras.jsx`
Tabelas
    `vistorias_obras` (linhas 73,117,185,208) + `dossier_obra` (linha 52)

##### Vistorias duplicadas em tabelas diferentes — exatamente o risco que o checklist pede para verificar

`src/vistoria-tracker.js`, carregado por `index.html` e importado dentro do próprio `vistorias-obras.jsx`, escreve o progresso de vistoria (3 fases, custo, observações) em `projetos.vistoria` (jsonb) — a tabela legada/desconectada (`vistoria-tracker.js:28-33`: `c.from('projetos').update({ vistoria, … })`). Ao mesmo tempo, o módulo "oficial" de Vistorias grava registros reais na tabela dedicada `vistorias_obras`, ligada a `dossier_obra`. São **dois mecanismos de rastreamento de vistoria coexistindo no mesmo módulo** — um alimentando a tabela morta/desconectada, outro alimentando o Dossiê de verdade. Não ficou claro nesta auditoria se `vistoria-tracker.js` ainda é chamado ativamente pela UI atual de `vistorias-obras.jsx` ou é resquício de uma versão anterior do fluxo — mas o código está lá, carregado, e funcional contra `projetos`.

## Homologação de Parceiros (RH) Confirmado

`src/rh-homologacao.jsx` \+ `rh-homologacao-store.js`. `window.RHHomologacao.statusGeral(parceiro)` é consumido de verdade por `instalacao-obra-store.js:146` — não é módulo isolado, é gate real (ver Gates). Diferença homologação geral vs vínculo à obra: o `parceiro_instalador_id` fica em `dossier_obra` (vínculo por obra), separado do cadastro de homologação em si — estrutura correta. **Mas** não bloqueia a criação do Contrato Instalador em si (ver achado em Gates) — só bloqueia mais adiante, na liberação da obra pela Instalação.

## Instalação em Campo Parcial

`src/instalacao-obra-store.js` tem o gate mais completo do repositório (detalhado acima) — contrato assinado, sinal pago, projeto de elevador, homologação, tudo cruzado antes de liberar o checklist "obra pronta". `instalacao-checklist-store.js` trata do checklist técnico propriamente. Chamado de verdade por `dossier-obra.jsx`. Classificado Parcial porque não confirmei, dentro do tempo, se a UI de `InstalacaoPage` (rota `instalacao`) realmente _impede_ o usuário de avançar quando `obterChecklistObraPronta` retorna reprovado, ou apenas exibe o status — mesmo padrão de risco encontrado em `project-gates.js`.

## ART / Cronograma / Data Book / Handover Quebrado (arquitetura)

##### Todo o trilho de fechamento de obra roda sobre a tabela desconectada `projetos`

Confirmado por leitura direta dos três arquivos:

  * `src/entrega.jsx:44` — `window.__VP_SB.sb.from('projetos').select('*')…` (fonte de "obras" para ART/Entrega)
  * `src/handover-manutencao.js:42,54,66,76` — todas as operações (criar, ler, atualizar) do Handover contra `projetos`
  * `src/data-book-store.js:38,51,63,72` — Data Book lê/grava metadado em `projetos` (usa Storage bucket `engenharia` à parte para o arquivo em si, linha 20/26/69)

Isso significa que **o mesmo problema já documentado para Gantt/Kanban (issue #274)** se propaga para toda a etapa final do processo: ART, Cronograma (`src/entrega.jsx:240-377` usa `instalacao_cronograma`, tabela diferente e real — parcialmente conectado), Data Book e Handover leem uma tabela que não é alimentada pela esteira real (Formulário→Proposta→Contrato→Aval→Dossiê, que usa `propostas`/`contratos_venda_equipamentos`/`dossier_obra`). Não encontrei, no tempo desta auditoria, nenhuma sincronização escrevendo de `dossier_obra` para `projetos` — são dados que existem em paralelo, um alimentado por trás das telas operacionais reais (Dossiê, Instalação), outro pelas telas de fechamento (ART, Data Book, Handover). Classificação: Quebrado no sentido do checklist — "lacuna de persistência real": a tela promete rastrear a obra, mas rastreia uma cópia desatualizada/paralela dela.

**Data Book exige evidências antes do termo?** Não confirmado — não abri a lógica de validação de `data-book-store.js` em detalhe suficiente para saber se há checagem de "todas as evidências anexadas" antes de liberar o termo, ou se é apenas um formulário livre.

## Almoxarifado / Logística planejada Não encontrado / Planejado

`src/almoxarifado.jsx` está carregado (`index.html:198`) e roteado (`app.jsx:341`, `window.AlmoxarifadoPage`), mas grep por `.from('` dentro do arquivo **não retornou nenhum resultado** — não encontrei nenhuma chamada Supabase no componente. Não encontrado: fonte de dado do Almoxarifado não identificada nesta auditoria — pode ser estado em memória/mock, ou usar uma store externa não capturada pelo grep direto no arquivo (não descartado, apenas não confirmado).

**Expedição / Logística:** confirmado Planejado — `shell.jsx:73-76`, ambos com `planned: true` e sem `id` de rota. O próprio `Sidebar` trata esse caso explicitamente sem simular clique (`shell.jsx:200-209`).

## Logs / Configurações / Copiloto Confirmado / Confirmado / Parcial

#### Logs de Atividade

Confirmado — `src/vp-log.js` grava em `vp_logs` de verdade (`vp-log.js:38`), `logs-admin.jsx` lê com filtros reais (linha 54,69). Restrito a admin em ambos os pontos (`shell.jsx:78` e `app.jsx:281` — **bate** , diferente do caso Aval Financeiro).

#### Configurações

Confirmado — `src/colaboradores-admin-store.js` persiste alocação de módulo por colaborador em `colaborador_alocacoes` (real), consumido de verdade por `shell.jsx:116-118` (`gruposAlocados` filtra a sidebar quando o colaborador tem pelo menos 1 alocação — "Geral" sempre visível, confirmado linha 118). Não é permissão só visual: a mesma fonte de dado (Supabase) que popula a tela de Configurações é a que filtra o menu do próprio usuário logado.

#### Copiloto VP

Parcial — aparece globalmente (`app.jsx:371`, exceto em `ficha-tecnica` onde o `FtCopiloto` próprio assume, confirmado pelo comentário na própria linha). **Executa ação, não só orienta:** `vp-copiloto.jsx:171` chama `vpcApplyFills(resp.fills, elsRef.current)` assim que a resposta do modelo chega — os campos da tela são preenchidos automaticamente (`vpcSetValue`, linha 96) **sem nenhum clique de confirmação intermediário** entre a resposta e a escrita no DOM/estado do formulário. Isso é exatamente o risco que o checklist pede para marcar: "erro se altera dado sem confirmação".

* * *

## PDF & documentos

  * **Proposta:** `proposta-reactpdf.bundle.js`, ~MB, gerado via Vite (fonte fora de `src/`) — padrão documentado e testado no histórico do projeto.
  * **Pedido a Fornecedor:** `pedido-fornecedor-reactpdf.bundle.js`, mesmo padrão, bilíngue (conforme CLAUDE.md).
  * **Ficha Técnica:** caminho diferente — `jsPDF` \+ `html2canvas` (CDN, carregado em `index.html`), não React-PDF. Paginação multi-página com blocos protegidos por classe CSS (`.ft-fz-grp`, `.ft-fz-descterm`, `.ft-fz-ident`, `.ft-fz-footer`).
  * **Fallback de CDN:** `index.html:32-33` (React/ReactDOM) usa `integrity=` \+ `crossorigin=`, mas **nenhum`onerror`** nos `<script>` tags — se o CDN falhar, não há um segundo host tentado. O único paraquedas é o timeout de emergência em `app.jsx:465-472`, que recarrega a página depois de 5s se `#root` continuar vazio — mitiga "tela branca infinita", não mitiga "CDN indisponível" (um reload não resolve indisponibilidade real do CDN).

## Supabase / persistência

`src/supabase.js` é o único ponto de inicialização do client (`window.__VP_SB`), mas **não** é a única camada de acesso — a maioria dos módulos chama `window.__VP_SB.sb.from(...)` diretamente dentro de componentes/stores, em vez de sempre passar por um store dedicado. Tabelas confirmadas em uso real (lista não-exaustiva, por módulo): `leads`, `clientes`, `fornecedores`, `formularios_elevador`, `cotacoes`, `propostas`, `contratos_venda_equipamentos`, `contratos_instalador`, `avais_financeiros`, `pi_importacao`, `rfq_importacao`, `ims_importacao`, `embarques_importacao`, `embarques` (legado), `dossier_obra`, `vistorias_obras`, `parceiros_instaladores`, `instalacao_cronograma`, `equipamentos_spec`, `projetos_elevador`, `catalogo_produtos`, `operadores_estrangeiros`, `fichas_tecnicas`, `fichas_lib_categorias/campos`, `gatilhos`, `comissoes`, `colaboradores_vpsistema`, `colaborador_alocacoes`, `alcadas_capacidade`, `vp_logs`, `projetos` (legado/desconectado), `vistoria` jsonb dentro de `projetos`, `ncm_solicitacoes` (dropada — quebrado).

**Padrão consistente e correto:** uso disciplinado de `.maybeSingle()` nos lookups por ID (visto em praticamente todo store) em vez de `.single()`, que quebraria com erro não-tratado quando o registro não existe — bom padrão defensivo, replicado de forma consistente entre `pi-store.js`, `rfq-store.js`, `ims-store.js`, `embarques-importacao-store.js`, `cadastros-clientes-store.js`, `rh-homologacao-store.js`.

**Fallback indevido pra mock:** não encontrei um só caso de "se o Supabase falhar, usa array hardcoded" nos módulos auditados em profundidade — o padrão universal é `data || []`/`data || null`, ou seja, tela vazia + (às vezes) erro engolido, nunca dado fictício disfarçado de real. É o caso do achado `ncm_solicitacoes`: a tela fica vazia, não mostra números fictícios.

**Tabela comentada como removida, mas ainda no fluxo:** confirmado — `ncm_solicitacoes`, em dois módulos (Dashboard + NcmKanbanPage), apesar do comentário em `app.jsx:134-138` reconhecer explicitamente que a tabela foi dropada.

## Master ID × Dossiê

`src/master-id-engine.js` é consumido por 15+ arquivos (lista completa: `contrato-instalador.jsx/-engine.js/-store.js`, `contrato-venda.jsx/-engine.js/-store.js`, `controle-cotacoes.jsx`, `cotacao-elevador-fornecedor.jsx/-store.js`, `formulario-elevador.jsx`, `linha-do-tempo.jsx/-store.js`, `logistica.jsx`, `pi.jsx`, `precificacao.jsx/-elevador.jsx`, `proposta-editor.jsx/-heranca.js/-store.js`) — é de fato o fio que amarra Lead→Formulário→Cotação→Precificação→Proposta→Contrato por `numero_cotacao`. Cada módulo **não** cria um ID próprio desconectado — todos parseiam/derivam do mesmo `numero_cotacao` via `MasterIdEngine.parseNumeroCotacao`. Confirmado, acerto real de arquitetura.

**Dossiê é conceito separado, confirmado:** `dossier_obra` tem seu próprio `id` (chave primária da obra física), distinto de `numero_cotacao` — mas conectado a ele: `instalacao-obra-store.js:108` busca `propostas.id` a partir de `numero_cotacao` para então checar o contrato assinado daquela proposta. Os dois conceitos (Master ID = rastreia a _venda/ativo_ através do funil comercial; Dossiê = rastreia a _obra física_ depois que ela nasce) não são tratados como sinônimos em nenhum lugar do código lido — são entidades com `id` próprios, unidas por uma chave de negócio (`numero_cotacao`), não confundidas.

## Segurança & permissões

##### Achado principal: `aval-financeiro` sem bloqueio de roteamento

Já detalhado na seção Aval Financeiro — repetido aqui por ser o achado de segurança mais grave do relatório.

**ROLE_MAP** (`shell.jsx:83-88`) × **RESTRICTED** (`app.jsx:277-283`): 4 roles definidos (comercial, engenharia, financeiro, admin); 5 rotas em `RESTRICTED` (precificacao, financeiro, comissoes, logs, configuracoes) batem exatamente com as 5 rotas marcadas `restrict` na sidebar **exceto** `aval-financeiro`, que está marcada na sidebar mas ausente em `RESTRICTED`.

**Chaves sensíveis:** nenhum arquivo `.env` real no repositório (só `.env.example`, 684 bytes). Grep por padrões de `service_role`/tokens JWT não encontrou nada além de falsos-positivos de trecho de UI não relacionado. Sem achado de credencial exposta no código-fonte nesta varredura — mas isso **não** é auditoria de RLS: as policies do Supabase não foram listadas nesta rodada (fora do escopo priorizado pelo usuário), então a proteção real de escrita/leitura por role no banco permanece presumida, não verificada.

**Restrição só no frontend:** confirmado como padrão geral — toda a checagem de `RESTRICTED` é React state (`useEffect` redirecionando), não há evidência nesta auditoria de que o Supabase recuse a mesma operação no backend via RLS para um usuário sem o role certo. Isso é esperado (é um SPA com SSO), mas reforça que a falha do Aval Financeiro é particularmente grave: não há nem a camada de frontend funcionando ali.

## Testes & CI

`npm test` executado nesta auditoria: **102/102 testes passando** (`node scripts/run-tests.js`, runner nativo do Node, sem framework externo). Arquivos de teste: `dashboard-metrics-{admin,comercial,engenharia,financeiro,gantt}.test.js`, `difal-engine.test.js`, `notificacoes-processamento.test.js`, `precificacao-elevador-engine.test.js`, `proposta-eq.test.js`, `proposta-legado.test.js`, `router.test.js` — 10 arquivos.

##### Cobertura concentrada em cálculo puro, quase nula em fluxo/gate/persistência

Nenhum teste cobre: `project-gates.js`, `instalacao-obra-store.js` (o gate mais complexo do repo), qualquer store de Supabase (P.I./RFQ/IMS/Embarques/Contratos/Dossiê), a geração de PDF (React-PDF ou jsPDF), ou o fluxo de assinatura (`assinar-app.jsx`). A engine de cálculo (precificação, DIFAL, dashboard metrics, router) está bem coberta; a orquestração entre módulos (que é onde os bugs desta auditoria foram encontrados — `ncm_solicitacoes`, `days_left`, `aval-financeiro` sem RESTRICTED) não tem rede de segurança nenhuma.

**CI:** `.github/workflows/ci.yml` existe (não aberto em detalhe, mas presente); `deploy.yml` confirmado redundante conforme já documentado no histórico do projeto (deploy real é via integração nativa Git do hPanel/Hostinger).

## Órfãos, mocks e componentes soltos

#### Componente órfão confirmado

`src/contrato-instalador-sign.jsx` (292 linhas) — página pública de assinatura de contrato de instalador, completa (pad de assinatura, captura de IP/UA/device, hash). **Nenhum arquivo`.html` do repositório a referencia** (confirmado por `grep -rln "contrato-instalador-sign" *.html` → vazio). O fluxo real de assinatura de contrato instalador passa por `src/assinar-app.jsx` (via `assinar.html`), que já busca em **ambas** as tabelas (`contratos_instalador` OU `contratos_venda_equipamentos`) — `contrato-instalador-sign.jsx` parece ser uma versão anterior/substituída, nunca removida do repositório.

#### Rota órfã de navegação

`comissoes` — tela funcional, sem link de produção (ver Mapa de rotas).

#### Tabela morta ainda no fluxo

`ncm_solicitacoes` — usada em 2 módulos, dropada do banco (ver Dashboard e Cadastros-Produtos).

#### Store órfã / não confirmada

`src/leads-tooltips.js` — não é carregado por `<script>` em nenhum HTML; é injetado dinamicamente por `src/version-check.js:70` (`helpScript.src = 'src/leads-tooltips.js?v=1'`) — portanto **não é órfão de verdade** , é carregamento condicional/lazy, mas fica fora do inventário normal de `index.html` e por isso fora do processo de cache-busting documentado no CLAUDE.md do projeto (que audita só os `<script>` estáticos) — risco de esquecimento de versão nesse arquivo específico.

#### Mocks encontrados

Nenhum mock de dado de produção identificado nos módulos priorizados (ver seção Supabase acima) — os "números sem fonte" encontrados (Dashboard) são bugs de leitura contra tabela errada/inexistente, não dado inventado. KPIs "—" com "sem dados suficientes" em Engenharia (`operacoes.jsx:198-199`) são honestos sobre a ausência, não mockados.

## Riscos críticos ordenados por impacto

1

**Aval Financeiro acessível sem role correto** Rota financeira sensível ausente de `RESTRICTED` em `app.jsx:277-283` — bloqueio existe só na sidebar. `app.jsx:336` / `shell.jsx:34`.

2

**Módulo "Solicitações NCM" inteiro quebrado** CRUD completo contra `ncm_solicitacoes`, tabela inexistente. `ncm-catalogo.jsx:25,685,718`.

3

**Fechamento de obra (ART/Cronograma/Data Book/Handover) sobre tabela desconectada**`entrega.jsx`, `handover-manutencao.js`, `data-book-store.js` — todos em `projetos`, amplificando o já conhecido issue #274.

4

**Vistorias duplicadas em dois destinos de dado**`vistoria-tracker.js` → `projetos.vistoria` vs `vistorias-obras.jsx` → `vistorias_obras`, dentro do mesmo módulo.

5

**KPI "Propostas enviadas" com fonte divergente na mesma tela**`dashboard-metrics-comercial.js:27` (leads) vs linha 68 (propostas reais).

6

**Gatilhos atrasados exibidos como "no prazo" no Dashboard**`dashboard-metrics-financeiro.js:44` não recalcula `days_left`; `financeiro.jsx:23` recalcula corretamente.

7

**Dois trilhos de embarque paralelos sem ponte**`embarques` (legado, Dashboard/Busca Global) vs `embarques_importacao` (P.I., novo).

8

**Gates existentes não bloqueiam nada**`project-gates.js` só colore texto em `operacoes.jsx`; sem instalador homologado no momento do Contrato Instalador.

9

**Copiloto preenche formulário sem confirmação**`vp-copiloto.jsx:171`, `vpcApplyFills` aplicado direto na resposta.

10

**Cobertura de teste concentrada em cálculo, ausente em gates/stores/PDF** 102/102 passam, mas nenhum cobre `project-gates.js`, `instalacao-obra-store.js`, ou qualquer store Supabase.

## Recomendações priorizadas

### Urgente

Adicionar `aval-financeiro: ["financeiro","admin"]` a `RESTRICTED` em `app.jsx` Decidir o destino de `ncm_solicitacoes`: recriar a tabela ou remover a UI/queries mortas (Dashboard + NcmKanbanPage)

### Importante

Migrar ART/Cronograma/Data Book/Handover de `projetos` para `dossier_obra`, ou documentar formalmente o desacoplamento como issue (igual #274) Unificar cálculo de "propostas enviadas" no Dashboard comercial (usar a tabela `propostas` nos dois lugares) Recalcular `days_left` ao vivo em `dashboard-metrics-financeiro.js`, ou parar de gravar a coluna estática e sempre derivar de `due_date` Resolver a duplicidade de vistoria (`vistoria-tracker.js` vs `vistorias_obras`) — confirmar se o primeiro ainda é chamado e, se não, remover

### Melhoria

Adicionar bloqueio de homologação no momento de criar Contrato Instalador, não só na liberação de Instalação Transformar `project-gates.js` em bloqueio real (desabilitar ação de início de importação) ou remover a aba se for só informativa por design Adicionar confirmação explícita antes de `vpcApplyFills` aplicar mudanças de formulário via Copiloto Publicar uma rota/link real para "Comissões" no menu, ou remover a rota se não é para uso Investigar/documentar ponte (ou ausência dela) entre `embarques` e `embarques_importacao`

### Futuro

Cobrir `project-gates.js` e `instalacao-obra-store.js` com testes automatizados Auditoria de RLS/policies reais no Supabase (fora do escopo desta rodada, focada em código) Remover `contrato-instalador-sign.jsx` se de fato substituído por `assinar-app.jsx`, após confirmação

## Roadmap técnico sugerido

  1. **Sprint de segurança:** fechar o gap de `aval-financeiro` em `RESTRICTED` — mudança de 1 linha, risco alto, deveria ser o primeiro commit depois deste relatório.
  2. **Sprint de limpeza de tabela morta:** decidir NCM Solicitações (recriar vs. remover UI) — hoje é a única tela do sistema com um botão que sempre falha.
  3. **Sprint de unificação Dashboard:** os 3 achados de "duas fontes para o mesmo número" (Propostas enviadas, days_left, embarques legado×novo) têm o mesmo formato de bug e provavelmente o mesmo tipo de correção (apontar tudo para a tabela mais nova/real) — vale tratar como um lote.
  4. **Sprint de reconexão do fechamento de obra:** maior item estrutural — migrar ART/Cronograma/Data Book/Handover para `dossier_obra`, ideal fazer junto com a resolução de #274 (Gantt/Kanban), já que a causa raiz é a mesma tabela legada.
  5. **Sprint de gates reais:** decidir, módulo a módulo, quais dos gates hoje "só informativos" (`project-gates.js`, homologação no Contrato Instalador) devem virar bloqueio de verdade — é uma decisão de produto tanto quanto técnica.
  6. **Sprint de cobertura de teste:** depois que os itens acima estabilizarem, testar o que hoje não tem rede nenhuma (gates, stores de Supabase, geração de PDF).

Relatório gerado por leitura de código e consulta ao vivo ao Supabase de produção — nenhum arquivo do repositório foi alterado, nenhum commit, branch ou migração criados. Onde a verificação foi mais leve (grep + leitura rápida, conforme orientado para módulos periféricos), isso está marcado explicitamente no texto do módulo correspondente. 
