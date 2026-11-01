# 1 Geral — documento do módulo (REAL, fonte da verdade — 31/10/2026)

> **Status: REAL (documento oficial do módulo 1), desde 31/10/2026.** Substituiu o `01_geral.md` antigo; as revisões A e C foram atendidas e o Gelson leu e aprovou. É a **fonte da verdade** do Geral (1.1 a 1.5 e a Parte comum): o `CLAUDE.md` só aponta para cá. Está publicado em `main` (PR #1256) e vale a cópia do repositório. Mudança nova entra no tema certo e a mesma sessão reescreve o Índice e o Glossário.
>
> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (`origin/main` `fd5cf97`); o código foi reconferido em 31/10/2026 contra `bfcf9dd` (PR #1259) e os pontos que divergiam foram corrigidos neste documento (o banco não foi reconferido nessa rodada). O que veio de documento anterior (e não foi reconferido agora) está dito no próprio tema, nas seções 1.3.9, 1.4.9 e 1.5.9. Sem número de linha (envelhece): cita-se arquivo e função.

## Como esta numeração funciona (regra do Gelson, 31/10/2026)
- A numeração **não é fixa**: é como cláusula de contrato. Quem acrescenta um item dá a ele o número da posição certa, e **tudo o que vem depois se desloca**.
- **Módulo = número inteiro; tela filha = módulo.posição.** Geral é o módulo 1: 1.1 Dashboard, 1.2 Notificações, 1.3 Central de Decisões, 1.4 Prazos & Pendências, 1.5 Inbox. CRM é o módulo 2 (cinco filhas: 2.1 a 2.5), o seguinte é o 3 (3.1, 3.2…) e assim por diante, na ordem do menu. Só as telas filhas ocupam N.1…N.k; o conteúdo comum do módulo (motor de gatilhos, jobs, tabelas comuns) fica na "Parte comum", sem número de tela.
- Ao deslocar, a mesma sessão **reescreve o Índice e o Glossário** e corrige as referências cruzadas.
- Cada tela filha (1.1, 1.2…) tem os **mesmos temas, na mesma ordem** (1.x.1 O que é · 1.x.2 Rota e arquivos · 1.x.3 Perfil/acesso · 1.x.4 O que a tela mostra · 1.x.5 Botões e controles · 1.x.6 Comportamento · 1.x.7 Dados (lê/grava) · 1.x.8 Regras e armadilhas · 1.x.9 Testes · 1.x.10 Pendências e decisões · 1.x.11 Histórico). Mudou algo na tela? Escreva no tema dela.
- Uma regra vale em **um lugar só**. Se aparece em dois, um deles aponta para o outro.

## Índice
1. **Geral**
   1.1 Dashboard
   &nbsp;&nbsp;&nbsp;1.1.1 O que é · 1.1.2 Rota e arquivos · 1.1.3 Perfil e acesso · 1.1.4 O que a tela mostra · 1.1.5 Botões e controles · 1.1.6 Comportamento · 1.1.7 Dados (lê/grava) · 1.1.8 Regras e armadilhas · 1.1.9 Testes · 1.1.10 Pendências e decisões · 1.1.11 Histórico
   1.2 Notificações
   &nbsp;&nbsp;&nbsp;1.2.1 O que é · 1.2.2 Rota e arquivos · 1.2.3 Perfil e acesso · 1.2.4 O que a tela mostra · 1.2.5 Botões e controles · 1.2.6 Comportamento · 1.2.7 Dados (lê/grava) · 1.2.8 Regras e armadilhas · 1.2.9 Testes · 1.2.10 Pendências e decisões · 1.2.11 Histórico
   1.3 Central de Decisões 🔒
   &nbsp;&nbsp;&nbsp;1.3.1 O que é · 1.3.2 Rota e arquivos · 1.3.3 Perfil e acesso · 1.3.4 O que a tela mostra · 1.3.5 Botões e controles · 1.3.6 Comportamento · 1.3.7 Dados (lê/grava) · 1.3.8 Regras e armadilhas · 1.3.9 Testes · 1.3.10 Pendências e decisões · 1.3.11 Histórico
   1.4 Prazos & Pendências
   &nbsp;&nbsp;&nbsp;1.4.1 O que é · 1.4.2 Rota e arquivos · 1.4.3 Perfil e acesso · 1.4.4 O que a tela mostra · 1.4.5 Botões e controles · 1.4.6 Comportamento · 1.4.7 Dados (lê/grava) · 1.4.8 Regras e armadilhas · 1.4.9 Testes · 1.4.10 Pendências e decisões · 1.4.11 Histórico
   1.5 Inbox 🔒
   &nbsp;&nbsp;&nbsp;1.5.1 O que é · 1.5.2 Rota e arquivos · 1.5.3 Perfil e acesso · 1.5.4 O que a tela mostra · 1.5.5 Botões e controles · 1.5.6 Comportamento · 1.5.7 Dados (lê/grava) · 1.5.8 Regras e armadilhas · 1.5.9 Testes · 1.5.10 Pendências e decisões · 1.5.11 Histórico
   Parte comum do Geral (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações entre as 5 telas · PC-2 Trilha de eventos e motor de etapas · PC-3 Fila de efeitos da assinatura pública · PC-4 Alertas como barramento · PC-5 Registro de atividades (`vp_logs`) · PC-6 Identidade, alçadas e segurança · PC-7 Jobs agendados · PC-8 Tabelas comuns · PC-9 Padrões de navegação, cache e testes · PC-10 Menu "?" (Ajuda, Treinamento, Feedback) · PC-11 Documentos soltos e pendências comuns · PC-12 Governança: departamentos, auditoria e lacunas
2. CRM → `02_crm.md` (2.1 a 2.5)

## Glossário (módulo Geral)
- **Esteira / cadeia:** o caminho de uma cotação desde o Formulário até a entrega, medido pelas etapas do motor de gatilhos; é o conjunto de etapas da cotação, ligadas por predecessor. É a "Cadeia de etapas por Cotação" da tela 1.4 e a fonte dos "projetos" do Dashboard (1.1).
- **Nº da cotação:** número que identifica uma venda de equipamento do Formulário até a entrega; liga Formulário, Proposta, Contrato, Dossiê e etapas.
- **Etapa / gatilho (tabela `gatilhos`):** passo da esteira de uma cotação (Formulário, Precificação, Proposta, Contrato, Avais, Compra, Embarque, Instalação…), com prazo (`prazo_em`) e conclusão (`concluido_em`). Nasce sozinha quando a etapa anterior termina, tem prazo (SLA) e fecha sozinha quando o evento correspondente acontece na tela de origem. Acompanha-se em "Prazos & Pendências" (1.4).
- **Projeto (no Dashboard):** uma cotação que está na esteira. Não é a tabela antiga `projetos` (vazia).
- **Fase (do Gantt/Kanban):** uma das 5 — Projeto, Fabricação, Importação, Instalação, Entrega. Vem da etapa aberta mais antiga da cotação, pelo mapa `FASE_POR_NODE`.
- **KPI:** cartão de indicador da tela. O conjunto muda conforme o **perfil** (1.1.3).
- **Perfil (role):** visão escolhida — comercial, engenharia, financeiro ou admin. Decide quais KPIs e quais tarefas aparecem.
- **Onde Parou:** cartão que lista as etapas com prazo vencido, para dizer quem está com a bola.
- **Alerta crítico:** alerta de nível `danger` mais três checagens cruzadas (proposta assinada sem contrato, contrato com valor zerado, sinal pago sem contrato). Ver 1.1.8.
- **Alerta global / dirigido:** alerta sem destinatário (todos veem) ou com `destinatario_email` (só aquela pessoa).
- **Soft-delete (`excluido_em`):** exclusão que só marca o registro; o Dashboard ignora leads assim marcados.
- **Período:** recorte de tempo do botão Hoje / 7 / 30 / 90 dias. Só afeta o perfil admin (1.1.6).
- **Alerta (aviso):** linha da tabela `alertas` que o sistema escreve quando algo importante acontece. Tem nível (`info`, `warning`, `danger`), módulo, título, texto, destinatário opcional e rota de destino. É o que a Central de Notificações lista (1.2).
- **Aviso calculado:** aviso que a Central monta na hora a partir de propostas, contratos e avais (ex.: proposta aprovada sem contrato); não existe como linha em `alertas`.
- **Lida / Arquivada:** estado **por pessoa** (e-mail do login) gravado em `notificacoes_lidas`. Arquivar tira da lista de quem arquivou e conta como lida; não apaga o alerta.
- **Sino:** ícone do cabeçalho que mostra a contagem de não lidas pela mesma regra da Central.
- **Resolvido (`resolved`):** alerta encerrado, some para todos; hoje só acontece por expiração automática ou por regra do produtor do alerta.
- **Decisão (gate):** pedido de aprovação gravado em `decisoes_gerenciais`. Uma tela de outro módulo só libera a próxima ação (enviar proposta, contratar montador, pagar parcela, comprar equipamento) depois que a decisão está `aprovada`. Os "gates" são as funções `pode…` de `decisoes-store.js`.
- **Papel requerido / aprovador:** papel que decide (CEO, Gestor Comercial, Supervisor de Obra, Logística…). Os e-mails vêm de uma lista fixa no código mais as alçadas concedidas em Administração; são recalculados a cada leitura.
- **Status da decisão:** `pendente`, `bloqueada_por_dependencia` (espera outra decisão), `aprovada`, `reprovada`, `cancelada`.
- **Reabrir ("Solicitar novamente"):** a **mesma** linha de uma decisão reprovada/cancelada volta a pendente, com o histórico em `contexto.reaberturas`; os gates procuram por tipo+cotação, então não se cria linha nova.
- **Modo Administrador:** o Administrador vê tudo o que está em aberto no sistema, mas só aprova se também for aprovador daquela decisão; pode cancelar.
- **Evento de fluxo:** registro em `eventos_fluxo` (ex.: `PROPOSTA_ENVIADA`) que as telas emitem por `EventosFluxo.registrar`; o motor (`GatilhosEngine.onEvento`) lê o evento para nascer e fechar etapas.
- **SLA / prazo:** limite de horas de uma etapa. Conta só dias úteis (seg–sex, sem os feriados que contam no SLA), exceto a espera do cliente e o embarque, que contam em dia corrido; a Precificação conta em horário comercial (08–18 h).
- **Etapa retroativa:** etapa que o motor criou já fechada porque uma etapa posterior aconteceu sem ela (`conclusao_tipo = 'retroativo'`); a tela mostra "registrada retroativamente", não "concluída no prazo".
- **Etapa opcional:** etapa que não conta como pendência (hoje o score e o aval de venda do Financeiro).
- **Cemitério / Fechar com motivo:** proposta parada além de 10 dias sem resposta do cliente vira `revisao_necessaria`; só uma pessoa a encerra, com motivo escrito.
- **Gatilho avulso:** gatilho cadastrado à mão, sem Nº de cotação (`origem` diferente de `automatico`). Hoje não existe nenhum.
- **Caixa compartilhada:** a caixa `suporte@vpsistema.com`; o sistema lê por IMAP e envia por SMTP. Todos os e-mails passam por `emails_projeto`; quem pode ver cada um depende de dono, atribuição e alçadas (1.5.3).
- **Dono / Responsável:** dono = login de quem enviou (ou dono do e-mail respondido, ou da cotação); responsável atual = a pessoa a quem o e-mail foi **atribuído**, senão o dono. O autor original nunca muda.
- **Vínculo (certo / provável):** ligação do e-mail a uma cotação. **Certo** = pelo Message-ID/In-Reply-To da mensagem original; **provável** = pelo Nº da cotação escrito no assunto. Sem vínculo, o e-mail é "órfão".
- **Triagem (robô):** classificação por regras no banco (assunto, departamento, urgência, "pede resposta"); só sugere, não age. Confiança de regra, não calibrada.
- **Conversa (thread):** mensagens juntadas por cabeçalho (ou assunto + ponta externa); a lista mostra uma linha por conversa.
- **Arquivar / Suspender / Spam / Marcador:** organização estilo Gmail. Arquivar, suspender e estrela são **por pessoa**; spam é **compartilhado**; marcador é pessoal ou da equipe.
- **Excluir (e-mail):** é soft-delete (ver acima): só tira o e-mail da lista do sistema (`excluido_em`); ele continua na caixa real e nunca é apagado do IMAP.

---

## 1.1 Dashboard

### 1.1.1 O que é
Tela inicial do sistema ("Visão Geral"). Mostra, para um perfil, indicadores (KPIs), os projetos em andamento (Gantt, Lista ou Kanban), as tarefas do dia, o funil comercial, a conversão por origem e as etapas atrasadas. **Lê 14 tabelas e grava em uma só: `tarefas`.** Não doa dados a nenhum outro módulo.

### 1.1.2 Rota e arquivos
- Rota `dashboard` → `/geral/dashboard[/<id do projeto>]`. É a rota inicial do app e o destino de queda de rotas inexistentes.
- Tela: `src/dashboard.jsx`, função `Dashboard`, com os subcomponentes `GanttChart`, `ProjectList`, `ProjectKanban`, `ModalNovaTask`, `PipelineFunnel`, `OriginBars` e `OndeParouWidget`; o nome da saudação vem de `src/dashboard-saudacao.js` (`window.DashboardSaudacao`, função pura). Quem vê o quê: `src/dashboard-visao-calc.js` (`window.DashboardVisao`, função pura) e `src/dashboard-visao-store.js` (`window.DashboardVisaoStore`, lê `perfis`, `colaboradores_vpsistema` e `alcadas_capacidade`; só lê).
- Dados: `window.__VP_SB.loadDashboardData(role, period)` em `src/supabase.js`, que usa os módulos puros `dashboard-metrics-comercial.js`, `-engenharia.js`, `-financeiro.js`, `-admin.js` e `-gantt.js`.
- Menu: grupo "Geral", 1º item. Caminho do topo: Dashboard › Visão Geral. Texto do "?" e tutorial `geral/dashboard` (ver 1.1.10 sobre o tutorial).
- URL: a visão dos Projetos em Andamento fica na URL (`useRouteTab`): `/geral/dashboard` (Gantt, padrão), `/geral/dashboard/lista`, `/geral/dashboard/kanban`. O projeto aberto no modal fica no 3º segmento (`/geral/dashboard/<visão>/<id>`); o link antigo `/geral/dashboard/<id>` (sem visão) continua abrindo o projeto. F5, link e Voltar/Avançar funcionam. Link de projeto que já saiu da esteira mostra aviso e limpa a URL. **Conferido em 31/10/2026 só por leitura do código; teste novo B.1 em `e2e/dashboard.spec.js` roda no CI.** Os demais controles (Período, Tela cheia, "+" Nova Tarefa) seguem fora da URL (estado efêmero; Período é recorte que reinicia em "Hoje").

### 1.1.3 Perfil e acesso
- Os KPIs e as tarefas dependem do perfil: comercial, engenharia, financeiro ou admin.
- **Hoje (código, 31/10/2026):** o **departamento** da pessoa (`colaboradores_vpsistema.departamento`, por e-mail) escolhe o conjunto de KPIs: Comercial → comercial, Engenharia → engenharia, Adm/Financeiro → financeiro, CEO → admin; **Logística/Almoxarifado/Produção → logística e Jurídico/Importação/Suprimentos → importação** (Fase 3, abaixo); **Marketing, Gente & Gestão e sem departamento mantêm a visão completa (admin)**. A **alçada** dá o limite (ver 1.1.10). **Administrador** (`perfis.nivel`) escolhe a visão pelo seletor **"Visualizando como"** (`RoleSwitch`, `shell.jsx`, guardado em `localStorage "vpprd.role"`); os demais **não veem o seletor** (enquanto a leitura carrega, ou se ela falhar, o seletor aparece como antes). O perfil guardado no navegador continua decidindo o **menu e as rotas restritas** (`RESTRICTED` em `app.jsx`, ver 1.4.3): isso **não mudou**, então quem tinha guardado um perfil diferente de admin segue com o menu dele. Falha ao ler perfil, departamento ou alçadas = visão completa. **Conferido em 31/10/2026:** testes unitários e e2e D.1 a D.4 (`e2e/dashboard.spec.js`) com o Supabase simulado; **não testado com os usuários reais.**
- **Decisão do Gelson (31/10/2026) — implementada:** o perfil vem do usuário (departamento), com a alçada como limite e o Administrador escolhendo a visão. Detalhe, tabela cartão → alçada e dados em 1.1.10. Segurança real de dados continua dependendo da issue #571 (a regra é da tela; quem chama o banco direto não passa por ela).
- **Saudação (decisão do Gelson, 31/10/2026) — implementada em 31/10/2026 (mesmo dia da decisão):** o cabeçalho chama a pessoa pelo que vem **antes do `@` do e-mail do login**, cada parte separada por `.`, `_` ou `-` vira uma palavra com inicial maiúscula: `bianca@…` → "Bianca"; `almoxarifado@…` → "Almoxarifado"; `gelson.simoes@…` → "Gelson Simões". O e-mail e o cadastro (`perfis.nome`, conferido: "Gelson Simoes") não trazem acento; o acento vem do dicionário `ACENTOS` e das regras de final de palavra (-ção, -ções, -ões) em `src/dashboard-saudacao.js` (`window.DashboardSaudacao`, 5 testes unitários; e2e C.1). **Palavra fora do dicionário fica sem acento:** para acrescentar, uma linha em `ACENTOS`. Sem login (e-mail vazio ou `@localhost`) mostra "VP Gestão". O nome aparece como escrito (não mais em maiúsculas). **Conferido em 31/10/2026:** testes unitários; o e2e C.1 roda no CI.

### 1.1.4 O que a tela mostra (de cima para baixo)
1. **Cabeçalho:** saudação por horário e **nome da pessoa tirado do e-mail do login** ("Bom dia, Gelson Simões."; ver 1.1.3), data, e a frase "Você tem N alertas críticos e N tarefas hoje". O nº de alertas vira link para Notificações quando é maior que zero.
2. **Aviso de falha:** faixa vermelha com "Tentar novamente" quando a carga inteira falha ou alguma consulta não carregou (lista quais).
3. **KPIs** (grade de 5; ver definição de cada um em 1.1.8).
4. **Projetos em Andamento:** Gantt, Lista ou Kanban dos projetos da esteira, com 5 fases e linha do tempo de 200 dias com marcador "Hoje". Clicar num projeto abre o modal de detalhe (ID, cliente, fase atual, início, previsão de término, valor, responsável).
5. **Tarefas de Hoje:** todas as tarefas com `done = false` do **perfil** (não filtra por data nem por pessoa: quem usa o mesmo perfil compartilha a lista); "+" cria (modal "Nova Tarefa" com Título obrigatório, Módulo, Prioridade e Horário, padrão 09:00); a caixa de seleção conclui na hora, sem confirmação nem desfazer. A frase do cabeçalho "tem N tarefas hoje" conta essa mesma lista.
6. **Pipeline Comercial:** funil Leads → Propostas enviadas → Propostas assinadas → Contratos (volume por estágio atual, uma proposta que virou contrato conta só em Contrato).
7. **Conversão por Origem:** leads convertidos por origem.
8. **Onde Parou:** até 6 etapas com prazo vencido, com dias de atraso; clicar leva à tela da etapa (`GatilhosEngine.navegarPara`).

### 1.1.5 Botões e controles (contados na leitura de 31/10/2026)
- **Sempre visíveis (9):** Período · Relatório · Ir para Leads · Gantt · Lista · Kanban (**cada um muda a URL**: `/geral/dashboard`, `/lista`, `/kanban`; ver 1.1.2) · Tela cheia · "+" (nova tarefa) · Ver Prazos & Pendências (no cartão Onde Parou).
- **Condicionais:** Tentar novamente (só com falha); link "N alertas críticos" e KPI "Alertas críticos" (só se maior que zero).
- **Nos modais:** Nova Tarefa (Cancelar, Criar Tarefa); detalhe do projeto (Fechar).
- **Por item:** cada linha do Gantt/Lista e cada cartão do Kanban abre o modal; cada etapa do Onde Parou navega; cada tarefa tem caixa de conclusão.
- **Destinos:** Ir para Leads → `/crm/leads`; alertas e KPI → `/geral/notificacoes`; Ver Prazos & Pendências → `/adm-financeiro/financeiro`.
- **Fora da URL de propósito:** Período (volta a "Hoje" ao recarregar), Tela cheia e a janela Nova Tarefa (estado efêmero).
- **Código sem efeito:** o Kanban tem botões de mover fase, mas a tela não os liga (`onMove` não é passado): não aparecem. A fase só muda quando a etapa real fecha.
- A contagem bruta do arquivo (3 `<button>`, 12 `<Button>`, 33 `onClick`; conferido em 31/10/2026 com `grep -o`) inclui subcomponentes e esse código sem efeito: **não é o número de botões na tela.**

### 1.1.6 Comportamento
- **Período:** o botão gira Hoje → 7 dias → 30 dias → 90 dias e recarrega. **Só filtra o Faturamento (por `aprovada_em`) e as Comissões (por `created_at`), e só no perfil Admin.** Projetos em Andamento (Gantt, Lista, Kanban) e "Projetos ativos" **não** são filtrados por ele: todo projeto da esteira nasce com `end_date` nulo e `projetosAtivosNoPeriodo` só descarta projeto com início futuro. Os outros perfis ignoram o período.
- **Relatório:** baixa um CSV dos KPIs visíveis (indicador, valor, sub, delta).
- **Carga:** 14 consultas em paralelo. Falha parcial não vira zero: a tela lista o que não carregou. Só a carga mais recente vale (trocar perfil/período não é sobrescrito por resposta antiga). Passados 3 s sem resposta, avisa que o banco está demorando (nunca zera os números).
- **Atualização:** ao voltar para a aba do navegador, recarrega se a última carga tem mais de 5 minutos. Não há atualização contínua.
- **Fase do projeto:** vem da etapa aberta mais antiga da cotação (`FASE_POR_NODE`); etapa sem entrada no mapa cai em "Projeto".

### 1.1.7 Dados — o que lê e o que grava
- **Grava:** só `tarefas` (insert ao criar; `done = true` ao concluir). Colunas: `title`, `module`, `priority` (alta/media/baixa), `due_time`, `role`, `done`. A tarefa pertence ao **perfil**, não à pessoa.
- **Lê (14):** `leads` (sem os com `excluido_em`), `alertas` (abertos, globais + dirigidos ao e-mail logado), `tarefas` (do perfil, não concluídas), `embarques` (sem os de teste), `contratos_venda_equipamentos` (menos os `em_preenchimento`), `comissoes`, `gatilhos`, `fichas_tecnicas`, `catalogo_produtos`, `propostas`, `avais_financeiros`, `formularios_elevador`, `clientes`, `contratos_instalador`.
- **Herda de:** Comercial (Formulário, Propostas, Contratos), Financeiro, Engenharia (fichas, catálogo, dossiê) e do motor de gatilhos (etapas). **Também herda tarefas de Embarques:** ao confirmar a chegada do navio (`logistica.jsx`, `reportarChegada`), são criadas 2 tarefas ("preparar recebimento" para Engenharia e "agendar instalação") **sempre no perfil `admin`**, então só aparecem para quem vê o perfil admin.
- **Doa para:** a Central de Notificações e o sino (1.2): os 3 avisos calculados (proposta aprovada ou assinada sem contrato, contrato de valor zerado, sinal pago sem contrato) saem de `AdminMetrics.alertasSinteticosDetalhados` (`dashboard-metrics-admin.js`), usado por `NotificacoesLidasStore.carregarAlertas`. Nenhum outro arquivo usa `loadDashboardData`. A tabela `tarefas` tem dois escritores: o próprio Dashboard e a confirmação de chegada do navio em Embarques.

### 1.1.8 Regras e armadilhas
**Definição de cada KPI** (verificada nos módulos de métricas):

| Perfil | KPI | Como é calculado |
|---|---|---|
| Comercial | Leads do mês | leads (não excluídos) cuja data começa com o mês atual |
| Comercial | Cot. em China | nº de cotações distintas com etapa aberta SLA_FORNECEDOR ou PRECIFICACAO |
| Comercial | Propostas enviadas | propostas com status diferente de `rascunho`, histórico inteiro |
| Comercial | Conversão Lead→Proposta | leads cujo cliente tem ao menos 1 proposta enviada ÷ total de leads |
| Engenharia | Projetos abertos | mesma esteira do Gantt |
| Engenharia | Fichas técnicas | total de fichas; variação = criadas no mês |
| Engenharia | Catálogo (ativos) | produtos com situação `ativado` |
| Engenharia | Alertas engenharia | alertas abertos do módulo "Engenharia" |
| Financeiro | A receber | soma de `c.value` (coluna legada `bigint`, gravada só na criação do contrato; o resto do módulo usa `valor_total_num`, que é o que a edição atualiza) dos contratos com status diferente de `Assinado`. Recusado e expirado também contam como "abertos". `fmtBRL` abrevia ("R$ 5k", "R$ 1.2M") e perde centavos |
| Financeiro | Comissões pendentes | soma de `comissao` com status `Aguardando` |
| Financeiro | Gatilhos próx. 7d | etapas com `due_date` em até 7 dias; **não olha** `concluido_em`, `status` nem etapa opcional e, sem `due_date`, usa `days_left` (que vira 0, e 0 conta como "≤ 7"). Conta etapas já concluídas e sem prazo, então só cresce. O "Onde Parou" usa outra regra (1.4), e os dois discordam na mesma tela |
| Financeiro | Contratos abertos | contratos com status diferente de `Assinado` |
| Financeiro | Instalação: contratado vs previsto | valor dos Contratos do Instalador menos o custo de mão de obra previsto na Precificação; só aparece com contrato comparável |
| Admin | Projetos ativos | projetos da esteira ativos no período |
| Admin | Embarques em trânsito | embarques (sem teste) com status `Em trânsito` |
| Admin | Alertas críticos | alertas `danger` + proposta assinada sem contrato + contrato de valor zero + sinal pago sem contrato. **O cartão só aparece no perfil admin, mas o número da frase do cabeçalho ("N alertas críticos") usa essa mesma conta em todos os perfis.** |
| Admin | Faturamento (propostas assinadas) | soma de `valor_total` das propostas aprovadas no período |
| Admin | Comissões (custo) | soma de `comissao` de todos os registros do período |

**Regras que não se reintroduzem o bug que elas evitam:**
- **Nunca mostrar zero no lugar de erro:** falha de consulta vira aviso, não número (#1216).
- **Alertas seguem a regra de destinatário da Central de Notificações** (globais + os dirigidos ao e-mail logado). Antes o Dashboard contava alertas de outras pessoas.
- **Lead com `excluido_em` não conta**; contrato `em_preenchimento` fica de fora. Qualquer consulta nova a `contratos_venda_equipamentos` deve tratar `em_preenchimento`.
- **Projeto vem da esteira (gatilhos + formulários), não da tabela antiga `projetos`** (0 linhas).
- **Etapa nova no motor de gatilhos precisa de entrada em `FASE_POR_NODE`**, senão cai em "Projeto" (aconteceu com a etapa de importação a iniciar).
- **O KPI "contratado vs previsto" lê `propostas.data_json.ativos` por `indice`:** a Proposta tem de gerar 1 ativo por equipamento físico.
- **Navegação:** entre páginas usa `setSubsel` + `setRoute`; `VpRouter.navigate` sozinho só troca a URL.
- **Formulários de outros vendedores:** o Dashboard lê `formularios_elevador` sem o filtro de dono (decisão registrada; segurança real = #571).
- **Cache:** se um arquivo do Dashboard muda sem subir o `?v=` no `index.html`, quem já tem o arquivo continua vendo o antigo.

### 1.1.9 Testes
- 62 testes unitários em `dashboard-metrics-*.test.js` (rodados em 31/10/2026: 62 passam) 5 em `dashboard-saudacao.test.js` e 7 em `dashboard-visao-calc.test.js` (31/10/2026: passam).
- E2E em `e2e/dashboard.spec.js` (9 testes; o C.1 cobre a saudação e o D.1 a D.4 a visão por departamento e alçada; o B.1 cobre as visões Gantt/Lista/Kanban na URL; Supabase simulado, nunca toca produção).

### 1.1.10 Pendências e decisões
**Decisões do Gelson (31/10/2026)**
- O perfil virá do **usuário** (1.1.3) e a saudação usa o primeiro nome do e-mail (1.1.3). **Aprovado em 31/10/2026:** a lista de KPIs e os perfis (inclusive Logística e Importação) de `2026-10-31-dashboard-kpis-por-perfil.md`. **[Aberto]** período padrão, definição de "A receber" e dono da meta de conversão (perguntas 2 a 4 daquele arquivo).

**Erros encontrados nos KPIs** (verificados no banco em 31/10/2026; **não corrigidos**, aguardam aprovação):
1. **A receber / Contratos abertos:** o código compara o status com `Assinado` (A maiúsculo), mas o banco grava `assinado`. O único contrato do banco (já assinado, R$ 435.215) conta como "a receber" e "aberto". Conferido no banco em 31/10/2026: `contratos_venda_equipamentos.value` existe (`bigint`, 435215) e `valor_total_num` = 435214,74; contrato editado fica com `value` velho no KPI.
2. **Propostas enviadas** diz "no período" mas conta o histórico inteiro.
3. **Período padrão é "Hoje":** no perfil admin (padrão) Faturamento e Comissões mostram só o recorte de hoje, sem aviso (Projetos ativos não é filtrado pelo período: ver 1.1.6).
4. **Meta de 25%** da conversão está fixa no código.
5. A tabela `comissoes` está vazia (0 linhas): os dois KPIs de comissão mostram zero.
6. ~~A saudação mostrava o nome do perfil~~ — corrigido em 31/10/2026 (1.1.3).
7. **Vocabulário de status das comissões não bate:** o KPI de comissões pendentes conta só `status === 'Aguardando'` (e fala em "Paga"), mas o motor e a tela de Comissões (módulo 5) gravam "Aguardando aprovação", "Aguardando aprovação diretoria", "Aprovado" e "Pago". Comissões geradas pelo motor **não entram** nesse KPI; hoje não há linhas, então sem efeito. **Conferido** no código, 31/10/2026; texto completo em `05_financeiro_precos.md` 5.5.10 item 1. **Achado, sem correção.**

**Proposta, aguardando aprovação:** manter poucos KPIs por perfil, cada um com nome, definição única, fonte e período explícitos; tirar a meta do código; corrigir 1 e 2 antes de qualquer outra mudança.

**Tutorial:** o tutorial do Dashboard é de 10/10/2026 e a tela mudou em 30/10/2026 (#1216). Está desatualizado; regerar pela sessão de tutoriais, não editar o HTML à mão.

**Achados da revisão de 31/10/2026 (sem correção; conferidos no código):**
- **Alertas críticos:** a frase do cabeçalho e o KPI usam uma conta que ignora lidas, arquivadas, Preferências e a retenção da Central; quem clica em "N alertas críticos" pode ver menos ou nenhum na Central.
- **Textos que enganam no cartão:** "Leads do mês" mostra delta `+N` igual ao valor e subtítulo "vs. mês anterior" sem comparar; "Fichas técnicas" mostra o total como valor e o do mês só no delta; "Embarques em trânsito" tem subtítulo fixo "Santos+Itaguaí"; o funil tem subtítulo "acumulado" e rodapé "Contratos ÷ Leads (volume)"; "Previsão de término" do projeto é sempre "—"; o "eyebrow" mostra o texto cru "Dashboard admin" (a saudação foi corrigida em 31/10/2026).
- **Botões:** "Tela cheia" é só ícone, sem texto nem `title`; "Ver Prazos & Pendências" aparece também para Comercial e Engenharia, cujo menu não tem a tela (a rota os redireciona).
- **Rota de queda sem `setSubsel` (conferido no código em 31/10/2026):** a rota `dashboard` monta `<Dashboard>` com `setSubsel`, mas o caso padrão de `app.jsx` (rota inexistente cai no Dashboard) monta sem ele; nesse caminho o clique no "Onde Parou" navega sem passar o item. Achado, sem correção.
- **"Onde Parou"** exclui etapas opcionais e lembretes (`LEMBRETE__`); só entram as de prazo efetivo vencido. Existem duas cópias de `fmtBRL` (`dashboard-metrics-financeiro.js` e `-admin.js`).
- **Leitura de `leads` sem paginação (doação do CRM, 31/10/2026):** a carga do Dashboard (`loadDashboardData` em `supabase.js`) lê `leads` com `select('*')` e sem `range`. Hoje são 13 leads ativos; acima de 1000 o PostgREST cortaria em silêncio e os indicadores de lead subestimariam. As outras consultas da carga **não** foram conferidas quanto a isso (Não verificado). Ver PC-9.
- **Dependência futura:** as telas que leem proposta (Dashboard em `supabase.js`, Notificações, "Ver documento") passarão a ler a revisão vigente quando `propostas_vigentes` (docs/revisoes/02, branch ainda não mesclada) entrar.

**Desenho aprovado e ainda não implementado (resumo de `docs/superpowers/specs/2026-10-31-dashboard-kpis-por-perfil.md`; o detalhe fica lá até a implementação):**
- *Perfil pelo departamento* (`colaboradores_vpsistema.departamento`): Logística/Almoxarifado/Produção → **Logística** (novo); Comercial; Engenharia; Jurídico/Importação/Suprimentos → **Importação** (novo); Adm/Financeiro → Financeiro; CEO e Administrador → Diretoria; Marketing, Gente & Gestão e sem departamento → Geral. Administrador continua podendo trocar de visão.
- *Blocos comuns a todos:* Minhas decisões pendentes, Meus alertas não lidos, Tarefas de hoje, Onde Parou e Projetos em andamento.
- *Seis regras de KPI:* nome + pergunta + fonte + período; período explícito no rótulo (estado = "agora", fluxo = usa o botão); todo KPI clicável e filtrado; sem dado = traço, não zero; meta fora do código (tabela editável); no máximo 5 KPIs por perfil.
- *Fases:* 0 corrigir o que está errado (A receber, Contratos abertos, Propostas enviadas, período padrão 30 dias); 1 perfil pelo usuário e saudação pelo e-mail; 2 KPIs de Comercial, Financeiro, Engenharia e Diretoria; 3 perfis Logística e Importação. Cada fase é uma entrega com "Confirmo" para migration.

**Visão do Dashboard pelas alçadas (pedido de 31/10/2026; decisões do Gelson em 31/10/2026; IMPLEMENTADO em 31/10/2026).**

*Specify.* O departamento da pessoa escolhe **qual conjunto de KPIs** ela vê (perfil); a alçada dela (Administração › Alçadas) **limita** o que pode ver desse conjunto. Administrador vê tudo e continua podendo trocar de visão.

*Clarify (respostas do Gelson, 31/10/2026).* (1) Tabela cartão → alçada **aprovada** (abaixo). (2) Quem não tem nenhuma das alçadas da tabela vê o Dashboard **completo**, como hoje. (3) **Departamento escolhe, alçada dá o limite.**

| Cartão ou bloco | Alçada que libera |
|---|---|
| Leads do mês, Conversão Lead→Proposta, Conversão por Origem | `leads` › ver |
| Propostas enviadas, Faturamento, Pipeline Comercial | `propostas` › `ver_todas` (a ação `ver` não existe) |
| Cot. em China | `cotacoes-fornecedor` › ver |
| Onde Parou, Projetos em Andamento, Gatilhos próx. 7d, Comissões | `financeiro` (Prazos & Pendências) › ver |
| Embarques em trânsito | `importacao` › ver |
| Projetos abertos (Engenharia) | `eng-projeto-elevadores` › ver |
| Fichas técnicas / Catálogo | `ficha-tecnica` / `ncm-catalogo` › ver |
| A receber, Contratos abertos | `contrato-venda-equipamentos` › ver |
| Alertas críticos / Alertas engenharia | `notificacoes` › ver |
| Tarefas de Hoje | sempre visível |

*Plan.* Função pura nova `dashboard-visao-calc.js` (`window.DashboardVisao`): (a) **perfil pelo departamento** (`colaboradores_vpsistema.departamento`, por e-mail): Comercial → comercial, Engenharia → engenharia, Adm/Financeiro → financeiro, CEO → admin; **Logística, Importação/Suprimentos, Marketing, Gente & Gestão e sem departamento mantêm a visão completa de hoje** até a Fase 3 criar o conjunto deles (a spec `2026-10-31-dashboard-kpis-por-perfil.md` continua valendo para as Fases 0, 2 e 3); (b) **limite por alçada** (`alcadas_capacidade` da pessoa): cartão só aparece se ela tem a alçada da tabela; **se não tem nenhuma das alçadas da tabela, vê tudo**; (c) **falha ao ler departamento ou alçadas = visão completa** (mesma regra do Inbox; nunca esconder por erro de leitura); (d) o seletor "Visualizando como" fica só para Administrador. Sem migration e sem escrita no banco.

*Tasks.* T001 `dashboard-visao-calc.js` + testes (perfil, limite, "nenhuma alçada = completo", falha = completo) · T002 `dashboard.jsx`: ler departamento e alçadas e aplicar · T003 `shell.jsx`: seletor só para Administrador · T004 aviso discreto "N cartões ocultos por falta de alçada" · T005 e2e (perfil comercial com e sem alçada, falha de leitura) · T006 este documento (1.1.3, 1.1.5, 1.1.8) e texto do "?".

*Respostas à Analyze (Gelson, 31/10/2026).* (1) **Onde Parou e Projetos em Andamento ficam LIMITADOS por `financeiro`** (a tabela venceu a spec, que os chamava de blocos comuns). (2) **Aplicar o limite agora (opção a)**, sem conceder alçada antes: quem tem só parte das alçadas passa a ver só os cartões dela. Nenhuma alçada foi concedida nesta entrega (Art. 14).

*Como ficou no código.* A regra "nenhuma alçada de referência = visão completa" **não conta `notificacoes`** como alçada de referência (27 de 34 a têm; contá-la quase nunca daria "completo"); os números da Analyze abaixo foram medidos assim. O aviso "N cartões/blocos ocultos por falta de alçada" aparece só para quem está com visão limitada. Tarefas de Hoje: sempre. Cartão sem alçada mapeada: sempre.

*Analyze (dados do banco em 31/10/2026, 34 pessoas ativas que não são administradores; Conferido por SQL).* Por departamento (pessoas · com `leads.ver` · com `propostas.ver_todas` · com `financeiro.ver` · com `importacao.ver` · sem nenhuma alçada da tabela): Logística 9 · 0 · 0 · 0 · 2 · **7**; Comercial 6 · 5 · 1 · 0 · 0 · 1; Engenharia 6 · 0 · 0 · 0 · 0 · 1; Jurídico/Importação 5 · 0 · 1 · 1 · 4 · 0; Adm/Financeiro 3 · 0 · 3 · 3 · 0 · 0; Marketing 2 · 1 · 0 · 0 · 0 · 1; Gente & Gestão 2 · 0 · 0 · 0 · 0 · 2; sem departamento 1 · 0 · 0 · 0 · 0 · 1. **12 de 34 não têm nenhuma** e continuariam com a visão completa. Achados:
1. **Conflito entre duas decisões aprovadas:** a spec aprovada em 31/10 diz que *Onde Parou* e *Projetos em Andamento* são **blocos comuns a todos**; a tabela acima (resposta 1) os liga a `financeiro`, que só 4 pessoas têm. Aplicada a tabela, quase todos perdem esses dois blocos.
2. **Quem tem só parte das alçadas perde os outros cartões:** ex. Comercial, 5 de 6 têm `leads.ver`, mas só 1 tem `propostas.ver_todas`; os outros 4 passariam a **não ver "Propostas enviadas"** do próprio perfil. O mesmo vale para os demais departamentos.
3. **`propostas` não tem a ação `ver`:** a tabela usa `ver_todas` (a que existe); quem só tem `criar`/`editar` de propostas não vê esses cartões.
4. **Conceder alçada é escrita em produção** (`alcadas_capacidade`) e só se faz com o "Confirmo" do Gelson para aquela lista de pessoas; não faz parte desta entrega.

### 1.1.10-A Fases 0, 2 e 3 dos KPIs (31/10/2026, aprovadas pelo Gelson item a item) — **Conferido** por `npm test` (929) e consultas no banco; **não testado com clique nem com usuário real**
- **Fase 0:** "Contratos abertos" e "A receber" comparam o status sem diferença de maiúscula (`assinado`, `recusado`, `expirado` e `em_preenchimento` não são abertos) e "A receber" soma `valor_total_num` (cai para `value`). **A definição de "A receber" segue aberta** (sinal e parcelas não pagas não existem como dado de venda): hoje é o valor dos contratos ainda sem assinatura final. "Propostas enviadas" passa a respeitar o período, usando `sent_at`, senão `enviada_em`, senão `criado_em` (**Conferido 31/10/2026:** 0 de 301 propostas "enviada" têm data de envio; a data de criação é suposição). Período padrão = 30 dias; o período agora vale também para o Comercial, não só para o Admin.
- **Fase 2 e 3:** `src/dashboard-metrics-perfis.js` (`PerfisMetrics`, puro) calcula os cartões novos; `carregarExtrasPerfil` (`supabase.js`) faz só as consultas do perfil aberto, e consulta que falha vira "—", nunca zero. Perfis **logística** e **importação** são só do Dashboard (não mudam menu nem rotas). Comercial: Leads novos, Cotações em preço (antes "Cot. em China"), Propostas aguardando o cliente, Propostas assinadas, Conversão (meta de `dashboard_metas`, padrão 25). Financeiro: Sinais a confirmar, Avais de pagamento pendentes, Etapas com prazo vencido, Parcelas de instalador liberadas, Comissões pendentes (some com a tabela vazia) + A receber, Contratos abertos e Instalação. Engenharia: Projetos aguardando assinatura, Equipamentos com dado a conferir (`evolucao_conferir_achados`), Obras em instalação, Solicitações de produto em aberto + os que já existiam. Logística: Pedidos a separar (`separacao_hub`, precisa da alçada `separacao.ver`), OPs atrasadas, Prontos para expedir (expedições "aguardando"), Ajustes de estoque pendentes. Importação: Embarques em trânsito, Chegadas em 30 dias, Cotações de varejo em aberto, Avais jurídicos pendentes, Itens com Dia D vencido (`iv_alertar_dia_d(simular)`, curva A/B). Diretoria: Decisões aguardando você.
- **Não feito:** "Itens críticos para compra" (Logística) — a Reposição só existe calculada no navegador (`reposicao-calc.js`), sem função no banco; fica pendente. Admin não consegue pré-visualizar Logística/Importação pelo seletor (mexeria no menu).
- **Alçada parcial (item 12):** quem não tem `propostas.ver_todas` não vê os totais de propostas da empresa (de propósito, é o isolamento por vendedor); no lugar aparecem "Minhas propostas aguardando/enviadas/assinadas" (por `vendedor_id` do próprio perfil; proposta sem vendedor gravado — 133 de 333 — não conta como de ninguém).
- **Meta:** migration `20261031200000_dashboard_metas.sql` (tabela fechada, só Administrador grava) **escrita e ainda NÃO aplicada**; sem ela o cartão usa 25 %. Não há tela para editar a meta.

### 1.1.11 Histórico (só o que ainda ensina)
- **31/10/2026:** visão por departamento e alçada (`DashboardVisao`); saudação pelo nome do e-mail (`DashboardSaudacao`); Gantt/Lista/Kanban com URL própria.
- **#274 (23/08/2026):** "projetos" passou a vir da esteira real; a tabela antiga `projetos` tinha 0 linhas. Desde então não há "mover fase" manual.
- **03/10/2026:** KPI "Cot. em China" deixou de ler a tabela `cotacoes` (vazia) e passou a ler os gatilhos. A conversão Lead→Proposta deixou de dividir populações sem relação (dava 2575%).
- **03/10/2026:** alertas do Dashboard passaram a seguir o destinatário, como na Central.
- **09/10/2026:** modal de projeto na URL (varredura de URLs).
- **#1216 / PR #1230 (30/10/2026):** `erros` na carga, sem "vazio aos 3 s", só a carga mais recente vale, aviso de projeto fora da esteira, recarga ao voltar para a aba.
- **06/10/2026:** `FASE_POR_NODE` ganhou a etapa de importação a iniciar.

---

## 1.2 Notificações

### 1.2.1 O que é
A central de avisos de cada pessoa: o sistema escreve aqui quando algo importante acontece (proposta aprovada, decisão pedida, resposta no Inbox, prazo vencido, falta de material…). A lista é agrupada por período; a pessoa marca como lida, arquiva ou abre a origem. **Lê** a tabela `alertas` e alguns avisos calculados na hora; **grava** só o estado "lida/arquivada" da própria pessoa. Alimenta também o **sino** do cabeçalho.
Em 31/10/2026 havia **223 alertas abertos** (164 dirigidos a uma pessoa e 59 globais): Almoxarifado 107, Inbox 34, Jurídico 34, Central de Decisões 28, Engenharia 11, Comercial 5, Importação 3, Compras 1; por nível, 146 `info`, 71 `warning` e 6 `danger`.

### 1.2.2 Rota e arquivos
- Rota `notificacoes` → `/geral/notificacoes[/<aba>[/<id do aviso>]][?modulo=<módulo>]`. Abas: `todas` (padrão, deixa a URL limpa), `nao-lidas` e `arquivadas`. Aba, aviso aberto e filtro de módulo moram na URL (F5, link e Voltar/Avançar funcionam); a janela Preferências fica fora da URL de propósito.
- Tela: `NotificacoesPage` e `NotificationPrefsModal` em **`src/financeiro.jsx`** (o mesmo arquivo de Prazos & Pendências — cuidado ao editar). Regras puras: `src/notificacoes-processamento.js` (ícone, rota e categoria por módulo, agrupar por período, link seguro). Leitura, estado e preferências: `src/notificacoes-lidas-store.js`.
- Menu: grupo "Geral", 2º item. O caminho do topo diz "Notificações › **Central de Alertas**" e o cabeçalho da tela diz "Central": três nomes para a mesma tela (ver 1.2.10). Texto do "?" e tutorial `geral/notificacoes`.

### 1.2.3 Perfil e acesso
- Não tem perfil nem alçada própria: qualquer pessoa logada abre. Cada um vê os alertas **globais** e os **dirigidos ao próprio e-mail** (`window.__VP_USER.email`, que vem do navegador e não é verificável — issue #571).
- Lida e arquivada são **por e-mail**. As **Preferências** (1.2.6) ficam no navegador (`localStorage`), não na pessoa.

### 1.2.4 O que a tela mostra
1. **Cabeçalho:** "Central / Notificações" e "N não lida(s) · agrupadas por período · arquivar tira da sua lista (os alertas somem sozinhos depois de 14 dias, ou 45 se forem avisos/críticos)".
2. **Aviso de lista incompleta** (condicional): quando os avisos calculados não puderam ser montados, com "Tentar novamente".
3. **Barra:** abas Todas / Não lidas / Arquivadas e um filtro de módulo (só lista os módulos presentes na aba).
4. **Lista agrupada por período**, uma linha por aviso: ícone do módulo, título, "módulo · tempo", e os botões de ação. Linha não lida aparece em destaque.
5. **Detalhe do aviso** (janela): nível/módulo, título, texto e hora.
6. **Preferências** (janela).

### 1.2.5 Botões e controles
- **Cabeçalho (3):** Preferências · Arquivar lidas · Marcar todas como lidas. Os dois últimos agem sobre **todas as não arquivadas que passaram pelas Preferências** (`notificationsVisiveis`), **ignorando a aba "Não lidas" e o filtro de módulo**: com o filtro "Financeiro", "Marcar todas" marca também Comercial, Engenharia etc.; na aba Arquivadas os dois ainda agem sobre as ativas; o contador do botão é global. Sem confirmação nem desfazer.
- **Barra:** 3 abas e o seletor de módulo.
- **Por linha:** Marcar como lida · Arquivar · Abrir origem; na aba Arquivadas: Restaurar · Abrir origem. Clicar na linha abre o detalhe (**não** marca como lida).
- **Detalhe:** Arquivar (ou Restaurar) · Marcar como lida · Abrir origem. **Preferências:** Cancelar · Salvar preferências. Condicional: Tentar novamente.
- **"Abrir origem"** marca como lida e navega: primeiro pela `rota` gravada no alerta (só caminho relativo de rota conhecida — `urlSegura`), senão pela rota do módulo (`ROTA_POR_MODULO`), senão Dashboard.

### 1.2.6 Comportamento
- **Carga:** alertas abertos (`resolved = false`) globais ou dirigidos ao e-mail, mais os avisos calculados (3 consultas: propostas, contratos, avais). Recarrega a cada 5 minutos com a aba visível e ao voltar para a aba se passou mais de 1 minuto. Falha numa recarga **mantém** a lista que já estava na tela.
- **Marcar/arquivar:** a tela muda na hora e **desfaz** se o banco recusar. "Marcar todas como lidas" só mostra sucesso depois de gravar. Arquivar também conta como lida.
- **Link direto:** abrir por link **não** marca como lida nem arquiva. Aviso que não existe mais (resolvido, de outra pessoa ou oculto pelas Preferências) mostra um aviso e volta à lista; aviso arquivado aberto fora da aba Arquivadas troca de aba sozinho.
- **Filtro de módulo** volta a "Todos" quando o módulo some da aba atual.
- **Preferências:** três categorias (Financeiro, Operações, Comercial) ocultam módulos da Central **e** do sino. Módulos fora do mapa **nunca** são ocultados: Jurídico, Central de Decisões e também o Inbox (a tela só cita os dois primeiros).
- **Expiração:** cron `alertas-expirar-diario` (10:30 UTC) marca `resolved = true` em `info` com mais de 14 dias e nos demais com mais de 45 dias.
- **Sino:** mesma regra de contagem (`useNaoLidas`: destinatário, arquivadas e Preferências); atualiza a cada 5 minutos e no mesmo instante em que a Central muda.
- **Preferências (acréscimo da revisão):** valem só no navegador atual e também ocultam os avisos calculados e o aviso diário de prazos (módulo Financeiro). Mapa módulo → categoria: Financeiro e Comissões → Financeiro; Comercial, Propostas, Cotações e Compras → Comercial; Importação, Engenharia e Almoxarifado → Operações; o resto (Jurídico, Central de Decisões, Inbox, Sistema, módulos novos) nunca é ocultado.
- **Avisos calculados:** vêm de `AdminMetrics.alertasSinteticosDetalhados` (`dashboard-metrics-admin.js`), com módulo `Propostas` (→ Comercial) ou `Financeiro`, logo **as Preferências podem ocultá-los**. Não têm `created_at` (a data aparece "—") e o id é determinístico: arquivado, o aviso não volta quando a condição reaparece.

### 1.2.7 Dados — o que lê e o que grava
- **Grava:** só `notificacoes_lidas` (`alerta_id`, `user_email`, `arquivada`, `arquivada_em`; upsert por alerta+e-mail; `lido_em` não é enviado pela tela: o banco preenche com `default now()`, migration `20260817190000`). Hoje 137 linhas, 32 arquivadas.
- **Lê:** `alertas` (`select('*')`; as colunas usadas são `id, level, title, sub, module, resolved, created_at, destinatario_email, rota`), `notificacoes_lidas`, e para os avisos calculados `propostas`, `contratos_venda_equipamentos` (menos os `em_preenchimento`) e `avais_financeiros`.
- **Herda de (quem escreve em `alertas`):** praticamente todos os módulos — 17 arquivos do front citam `from('alertas')` (a maioria insere; este store, o Dashboard e Prazos & Pendências só leem), 4 Edge Functions e 41 migrations com gatilhos/crons que inserem (PCP, Inbox, Decisões, avais, Evolução, ART, instalador, etc.). **Todos os 223 abertos têm `rota`** (um gatilho a preenche pelo prefixo do id).
- **Doa para:** o sino do cabeçalho, a frase de alertas do Dashboard e o quadro de alertas de Prazos & Pendências (mesma regra de destinatário). Alertas dirigidos também podem sair por **WhatsApp** pelo serviço de avisos da VPS, que lê a mesma tabela.
- **Detalhes (revisão de 31/10/2026):** a leitura é `select('*')`; os arquivos que só leem `alertas` são 4 (a lista acima soma `almoxarifado.jsx`); das 4 Edge Functions, `vp-copiloto` só lista alertas, não escreve.

### 1.2.8 Regras e armadilhas
- **Alerta com id determinístico por produtor** (mesmo fato = mesmo id): evita repetir aviso a cada rodada de cron. Produtor novo deve seguir isso.
- **`rota` é preenchida por gatilho** (`trg_alertas_rota_padrao`, função `alertas_rota_por_id`) a partir do prefixo do id quando o produtor não informa. **Prefixo de id novo precisa ser acrescentado nessa função**, senão o clique cai no Dashboard.
- **`urlSegura`:** o campo `rota` é gravável com a chave pública, então só caminho relativo de rota conhecida é aceito (nunca `https://`, `//` ou `javascript:`).
- **Alerta nunca é apagado:** sai da lista por expiração (`resolved`) ou por regra do produtor. Arquivar é só da pessoa.
- **A leitura é uma só** (`NotificacoesLidasStore.carregarAlertas/visiveis/useNaoLidas`): Central e sino não podem ter leituras separadas, ou os números divergem.
- **Mudou título ou módulo de um alerta?** O serviço de WhatsApp agrupa títulos parecidos por pessoa em 24 horas; combinar antes de mexer em texto de alerta que também sai por lá.
- **Cache:** mudou arquivo desta tela, sobe o `?v=` no `index.html`.
- **Ordem do clique em "Abrir origem":** `rota` gravada no alerta (aceita por `urlSegura`) → `ROTA_POR_MODULO` → Dashboard. "Marcar como lida" por linha fica desabilitado se já lida; o filtro de módulo lista os módulos de tudo que não está arquivado, mesmo na aba "Não lidas"; os botões por linha (Marcar como lida, Arquivar, Abrir origem) são só ícones com `aria-label`, exceto **Restaurar** na aba Arquivadas, que também mostra o texto; os modais se chamam "Detalhe da Notificação" e "Preferências de Notificação".

### 1.2.9 Testes
- 22 testes unitários em `notificacoes-processamento.test.js` (todos passam, rodados em 31/10/2026) e 5 de navegador em `e2e/notificacoes.spec.js` (rodam no CI, Supabase simulado; **não rodei agora**).

### 1.2.10 Pendências e decisões
Nenhuma decisão do Gelson registrada ainda para esta tela. Achados, **sem correção**:
1. **Três nomes para a mesma tela:** "Notificações" (menu e título), "Central de Alertas" (caminho do topo) e "Central" (cabeçalho).
2. **Preferências presas ao navegador:** trocar de computador ou de navegador volta ao padrão; e o **Inbox (34 avisos) nunca pode ser ocultado**, coisa que a tela não diz.
3. **Identidade pelo navegador:** lida/arquivada e destinatário dependem de um e-mail que o navegador informa (issue #571).
4. **Volume:** 107 dos 223 avisos abertos são do Almoxarifado; não há agrupamento nem resumo de avisos repetidos.
5. Em `ROTA_POR_MODULO` a chave `Propostas` aparece duas vezes (inofensivo).
6. **Tutorial desatualizado:** o de Notificações é de 10/10/2026 e a tela mudou em 30/10/2026 (#1217). Regerar pela sessão de tutoriais.
7. **Botões em massa ignoram filtro e aba** (ver 1.2.5): "Marcar todas como lidas" pode marcar avisos de módulos que a pessoa nem estava vendo.
8. **Avisos calculados dependem do Dashboard** (código em `dashboard-metrics-admin.js`) e podem ser ocultados pelas Preferências (ver 1.2.6).

### 1.2.11 Histórico (só o que ainda ensina)
- **03/10/2026:** arquivar por pessoa e aba Arquivadas; expiração automática; `rota` preenchida por gatilho; sino com a contagem real; Preferências passaram a valer de verdade (antes eram chaves que nada lia); Dashboard e Prazos & Pendências passaram a filtrar alertas por destinatário.
- **03/10/2026:** alerta de resposta no Inbox (gatilho que só insere em `alertas`, nunca impede o e-mail de ser gravado).
- **31/10/2026 (#1217, PR #1232):** filtro de módulo volta a "Todos"; "marcar todas" só avisa sucesso após gravar; falha em propostas/contratos/avais marca a lista como incompleta; recarga a cada 5 minutos e ao voltar para a aba; aba, aviso aberto e módulo na URL.

---

## 1.3 Central de Decisões 🔒

> **Área blindada** (regra permanente do CLAUDE.md, 23/09/2026): o botão **Ver documento** (`gerarLinkDecisao()`, `DecCard.abrirDocumento()`, o `case "decisoes"` de `app.jsx`) só muda com pedido explícito do Gelson, depois de a sessão informar o que existe e ouvir a confirmação. As regras estão em 1.3.8.

### 1.3.1 O que é
A caixa de entrada de aprovações de cada pessoa: tudo o que outras telas pedem para um gestor decidir (envio de proposta, desconto, compra de equipamento, contratação e entrada de montador, pagamento de parcela, compra de varejo, pergunta aberta a partir de um e-mail). A pessoa lê o cartão, abre o documento, aprova ou reprova (reprovar exige motivo). **Grava** em `decisoes_gerenciais` e avisa em `alertas`; **as telas de origem leem** essa tabela para liberar ou travar o passo seguinte.
Em 31/10/2026 havia **72 decisões**: 7 pendentes, 3 bloqueadas por dependência, 28 aprovadas, 4 reprovadas e 30 canceladas. Pendentes hoje: 5 de montador (Supervisor de Obra) e 2 de compra de equipamento (CEO).

### 1.3.2 Rota e arquivos
- Rota `decisoes` → `/geral/decisoes[/<id>/<modal>]` ou `/geral/decisoes/decididas[/<id>]`, com filtros `?tipo=&q=`. Aba, modal de aprovar/reprovar/cancelar, cartão destacado e filtros moram na URL (F5 e link funcionam). Nenhum id de decisão é a palavra "decididas" (são uuid), então links antigos seguem valendo.
- Tela: `src/decisoes.jsx` (`DecisoesPage`, `DecCard`, os 3 modais, `gerarLinkDecisao`). Regras e gates: `src/decisoes-store.js` (`window.DecisoesStore`). Montados em `app.jsx` com `setRoute` e `setSubsel`.
- Menu: grupo "Geral", 3º item, com **selo de pendentes** (conferido a cada navegação, a cada 3 minutos e quando a Central avisa pelo evento `vp:decisoes`). Caminho do topo "Geral / Central de Decisões". Texto do "?" em `HELP_TOPICS`. Tutorial `geral/central-de-decisoes`.
- Specs antigas que pertenciam aqui (WhatsApp na Central, de 17/09, e o aval do instalador por WhatsApp) foram absorvidas em 1.3.8 e 1.3.11 e **excluídas do disco em 31/10/2026**; continuam no histórico do Git. O assunto WhatsApp passa a ter documento próprio em `docs/servicos/` (ver `CLAUDE.md`, "Serviços transversais").

### 1.3.3 Perfil e acesso
- Não há alçada para abrir a tela: qualquer pessoa logada abre. Cada um vê o que espera por ele (`souAprovador`: o e-mail está em `aprovadores_esperados`) e, em Decididas, o que decidiu, pediu ou era aprovador.
- **Administrador** (nível `Administrador`, via `PropostaStore.resolverPerfilAtual`) entra no **modo Administrador**: vê tudo em aberto e tudo o que foi decidido, ganha o botão Cancelar e o aviso de quem decide de verdade. **Não ganha poder de aprovar**: `aprovar`/`reprovar` continuam exigindo ser aprovador (pedido do Gelson: "não vou aprovar nada").
- Quem decide cada papel (lista fixa em `EMAILS_FIXOS`, 31/10/2026, mais as alçadas `decisoes.<papel>` concedidas em Administração): CEO e CEO-Diego = Diego; aval do instalador = Juliana; dono do sistema = Gelson; Gestor Comercial = Regiane e Guilherme; RH = Karla; Engenharia = Maurício; Supervisor de Obra = Maurício; Logística = Danilo. Mudou o responsável de um papel: trocar na lista e, se for só para quem já tem alçada, conceder a alçada.
- O e-mail de quem clica vem do navegador (`window.__VP_USER`) e não é verificável (issue #571, ver 1.3.10).
- **Onde se concede:** a mesma tela de Administração (`/admin/configuracoes/administracao`). **Situação em 31/10/2026:** alçada `decisoes.ceo` em 2 perfis, `gestor_comercial` em 3 e `ver` em 18; os demais papéis vêm da lista fixa `EMAILS_FIXOS`.

### 1.3.4 O que a tela mostra
1. **Cabeçalho:** "Central de Decisões" e uma frase que muda no modo Administrador ("você está vendo tudo… não é aprovação").
2. **Cartão "Aguardando você"** (ou "Tudo em aberto no sistema" para Administrador, ou "Decididas") com a contagem filtrada/total, as abas, a busca e o filtro de tipo.
3. **Um cartão por decisão:** tipo, título (cliente, título, item, obra ou "Cotação Nº"), uma linha de dados (cotação, proposta, montador, quantidade, valor, margem efetiva, desconto, "Pedido por"), data de abertura e, nas decididas, "Aprovada/Reprovada/Cancelada por X em… — “motivo”" e quantas vezes foi solicitada de novo.
4. **Avisos dentro do cartão em aberto:** "Bloqueada — depende de outra decisão" ou "Só você está vendo (Administrador) — quem decide: …".
5. **Estados da lista:** "Carregando…", aviso "Tentar novamente" (só aparece com a lista vazia; ver 1.3.10), "Nada encontrado com esses filtros" e vazio por aba.

### 1.3.5 Botões e controles
- **Barra:** abas **Pendentes (n)** e **Decididas (n)**; busca "Buscar cotação, cliente, pessoa…" (acha por cotação, cliente, título, item, obra, montador, proposta, solicitante, quem decidiu e motivo); filtro **Todos os tipos** (só os tipos presentes).
- **Por cartão em aberto:** **Ver documento** (quando há link); **Reprovar** e **Aprovar** (só para aprovador e só se não estiver bloqueada); **Cancelar** (só Administrador).
- **Por cartão decidido:** **Ver documento** e **Solicitar novamente** (decisões reprovadas ou canceladas).
- **Modais:** Aprovar (comentário opcional, "Confirmar aprovação"), Reprovar (motivo obrigatório, "Confirmar reprovação"), Cancelar (motivo obrigatório, "Cancelar decisão"; botão "Voltar").
- **Ver documento:** abre o registro de origem (1.3.8 tem o mapa).

### 1.3.6 Comportamento
- **Carga:** pendentes (aprovador: as dele; Administrador: tudo em aberto) e decididas (até 200; o filtro "o que é meu" vai ao banco antes do limite). Recarrega a cada 60 segundos e ao voltar para a aba; **a falha de leitura não aparece como erro** (ver 1.3.10) e mantém a lista anterior, sem zerar.
- **Aprovar/reprovar** só gravam se a decisão ainda estiver `pendente` (a escrita confere o status): se outra pessoa decidiu no meio tempo, avisa "já foi decidida por outra pessoa" e não sobrescreve.
- **Aprovar:** libera as decisões que dependiam desta (quando todas as pais estão aprovadas), avisa quem pediu e, se for `compra_equipamento_ceo`, registra a aprovação do CEO também no Aval Financeiro (a mesma regra vale pelas duas telas). **Reprovar:** cancela as que dependiam desta, com um motivo fixo que permite reabri-las depois.
- **Solicitar novamente** reaproveita a mesma linha (volta a pendente, ou a bloqueada se uma dependência não estiver aprovada), guarda o que houve em `contexto.reaberturas`, recalcula os aprovadores e reabilita as dependentes canceladas por causa dela. Os gates também reabrem sozinhos decisões **canceladas** que voltam a ser necessárias (`garantirAtiva`).
- **Link:** `/geral/decisoes/<id>/<modal>` de decisão que já foi decidida leva à aba Decididas com o cartão destacado e avisa; de decisão que não existe (ou que não é sua) avisa e limpa a URL.
- **Aviso ao aprovador:** gatilho no banco grava um aviso individual `dec_nova_<id>_<email>` para cada aprovador; ele se resolve sozinho quando a decisão é decidida ou cancelada, e é reativado se ela for reaberta. **Resultado:** só quem pediu é avisado (sem `solicitado_por`, aviso global).
- **Expiração:** o cron `decisoes-expirar-orfas-diario` (10:40 UTC) cancela decisões de cotação que não tem mais formulário nem proposta há mais de 30 dias.

### 1.3.7 Dados — o que lê e o que grava
- **Grava:** `decisoes_gerenciais` (cria, aprova, reprova, cancela, reabre), `alertas` (resultado), `vp_logs` (criou, aprovou, reprovou, cancelou, solicitou de novo; módulo "Central de Decisões").
- **Lê:** `decisoes_gerenciais`, `alcadas_capacidade` + `perfis` (aprovadores por alçada), `colaboradores_vpsistema`/`perfis` (nível Administrador), e para os gates `precificacoes_elevador`, `propostas`, `formularios_elevador`, `gatilhos` (`COMPRA_LIBERADA`) e `avais_financeiros`.
- **Colunas de `decisoes_gerenciais`:** `id, tipo, numero_cotacao, dossier_id, referencia_tabela, referencia_id, papel_requerido, aprovador_esperado_email, aprovadores_esperados[], depende_de[], status, decidido_por, decidido_em, motivo, contexto jsonb, solicitado_por, criado_em, atualizado_em`. **Triggers:** `trg_decisoes_alertar_aprovadores`, `trg_aval_resultado`, `trg_evt_aval_instalador`. **RPCs:** `decisao_aval_reenviar`, `decisao_whatsapp_responder`.
- **Herda de (quem cria decisão):** 9 arquivos chamam os gates — `proposta-store.js` e `proposta-editor.jsx` (envio, desconto e compra do CEO), `proposta-desconto.js`, `contrato-instalador.jsx` (+ `contrato-instalador-parcelas-store.js` para pagamento), `instalacao-obra-store.js` (montador), `pedidos-varejo-store.js` (compra de varejo), `pi.jsx` (compra do equipamento) e `inbox-decisao.jsx` (pedir decisão a partir de e-mail); também consultam o status `aval-financeiro-store.js`, `gatilhos-engine.js` e `linha-do-tempo-store.js`.
- **Doa para:** os gates das telas acima (liberam ou travam o passo), o selo do menu, as Notificações (1.2) e o WhatsApp do aval do instalador.

### 1.3.8 Regras e armadilhas
**Tipos de decisão (9) e o gate de cada um:**
| Tipo | Quem decide (papel) | O que trava |
|---|---|---|
| `envio_proposta_gestor` | Gestor Comercial | enviar a proposta ao cliente |
| `envio_proposta_ceo` | CEO | enviar a proposta, **só se a margem efetiva < 15% ou desconhecida** (depende da decisão do gestor) |
| `desconto_proposta` | definido em `proposta-desconto.js` | aplicar o desconto |
| `compra_equipamento_ceo` | CEO | início da compra, **só se a margem < 15% ou desconhecida** |
| `contratacao_mao_obra_ceo` | Juliana (papel `aval_instalador`) | envio do Contrato do Instalador (com cotação ou avulso, pelo id do contrato) |
| `montador_entra_obra_rh` | Supervisor de Obra | montador entrar numa obra (chave: dossiê + parceiro) |
| `pagamento_instalador_parcela` | Gestor Comercial | marcar a parcela como paga (uma decisão por parcela) |
| `compra_varejo_logistica` | Logística (Danilo) | pedido de compra de varejo do Almoxarifado |
| `inbox_decisao` | pessoas escolhidas por quem pede | nada: é uma pergunta aberta a partir de um e-mail |

**Regras que existem por motivo — não reintroduza os bugs que elas evitam:**
- 🔒 **Ver documento:** `VpRouter.navigate()` sozinho só reescreve a URL e não avisa o `App`; navegue sempre com `setSubsel(...)` + `setRoute(...)` recebidos por prop. O Nº legível da cotação não é o id do formulário: `abrirDocumento()` resolve por consulta (`numero_cotacao`) antes de navegar. Só entra em `tabelaPagina` rota que existe em `KNOWN_ROUTES` e tabela que a tela de destino realmente lê; sem mapeamento o cartão fica sem botão. Mapa atual: `propostas` → editor da proposta; `envio_proposta*` → proposta da cotação (cai no formulário se não houver); cotação → formulário; dossiê → dossiê; `formularios_elevador`, `parceiros_instaladores`, `contrato_instalador_parcelas`, `contratos_instalador`, `pedidos_compra_varejo` (aba Pedidos do Almoxarifado), `emails_projeto` (Inbox). Falha ao localizar o registro avisa, nunca fica em silêncio.
- **Gate de prévia não cria nem reabre decisão:** `podeComprarEquipamento(..., { somenteLeitura: true })` só consulta. A P.I. conferia o gate a cada tecla do Nº da cotação e criou decisões de CEO para cotações inexistentes (issue #728).
- **Pedir de novo reabre a MESMA linha**, nunca cria outra: os gates procuram por tipo + cotação.
- **Aprovadores recalculados ao ler:** o retrato `aprovadores_esperados` fica velho se o responsável do papel muda; a leitura recalcula. Falha ao ler as alçadas **mantém** os aprovadores gravados (não tira ninguém).
- **`criarDecisaoSeNaoExiste`** usa `.is` para Nº nulo (`.eq` com null não casa) e pega a primeira existente (antes `maybeSingle` falhava com duas e criava mais uma).
- **`pedirDecisaoInbox`** grava **sem** `numero_cotacao` de propósito (com ele o "Ver documento" abriria o formulário da cotação, não o e-mail); o Nº vai em `contexto`. O papel `inbox_decisao` não existe na lista fixa, então os aprovadores escolhidos ficam como estão.
- **CEO só em discrepância:** `LIMITE_MARGEM_SEM_CEO = 0,15`; margem desconhecida mantém o CEO no circuito. Não troque por "sem precificação libera".
- **Aval do instalador é da Juliana — regra do Gelson, reafirmada em 31/10/2026 (este documento vale; o código segue o documento).** É a **Juliana** quem recebe a mensagem no WhatsApp e quem dá o aval (responde SIM ou NÃO, ou decide pela Central); o **Diego não dá esse aval**. Depois do SIM, o Diego só **assina** o Contrato do Instalador como "Contratante — CEO", junto com Juliana e Maurício (`_ci_disparar`). O papel é `aval_instalador`, separado de `ceo` para as alçadas do CEO não entrarem; `reenviarAvalWhatsApp` reenvia ou reabre o pedido. **Conferido no banco em 31/10/2026:** `decisao_whatsapp_numeros` ativo tem `juliana@` como `aprovador` e `mauricio.araujo@` como `ciente` (recebe o aviso do resultado); não há número do Diego.
- Mexeu em arquivo desta tela: suba o `?v=` no `index.html` (hoje `decisoes-store.js` v29 e `decisoes.jsx` v10).

**Aval do contrato do instalador por WhatsApp (fluxo no banco, migration `20261021100000_aval_ceo_disparo_automatico.sql`; absorvido de `docs/eventos/vphub-aval-whatsapp.md`, hoje excluído do disco e no histórico do Git; sem telefone nem chave):**
1. "Enviar" no rascunho do Contrato do Instalador = **pedir o aval**: `ci_pedir_envio` guarda o WhatsApp do montador (o contrato continua rascunho); nasce a decisão `contratacao_mao_obra_ceo` e `_aval_enfileirar_pendente` cria o aviso à pessoa que decide ("…Você autoriza? Responda SIM ou NÃO").
2. **SIM** (WhatsApp, por `decisao_whatsapp_responder`, ou o botão Aprovar na Central): o gatilho `trg_aval_resultado` chama `_ci_disparar`; o contrato vira `enviado` (validade de 7 dias), nascem as **3 assinaturas internas liberadas ao mesmo tempo** e cada uma recebe o aviso; o link do montador sai pelo serviço de avisos (PC-4).
3. **NÃO:** nada é enviado e o Supervisor de Obra é avisado para conversar com quem decide. O aval pode ser reenviado por `decisao_aval_reenviar` (reabre a decisão).
4. **Trava no servidor:** `public_ci_assinar` e `public_ci_visualizado` recusam contrato em `rascunho` sem aval aprovado (`aguardando_aval`), mesmo com o link.
5. O contrato só fica **completo** (`assinaturas_completas_em`) com o montador mais as 3 internas, em qualquer ordem (`_ci_verificar_completo`).
- **Fora deste repositório e ainda aberto:** ninguém chama a Edge Function `decisao-resposta-whatsapp` quando chega a resposta SIM/NÃO; enquanto isso, a aprovação se faz pela Central. A função `whatsapp-notify` parece órfã (nada a chama). O papel decisor mudou entre 16 e 22/10 (`ceo_diego` → Juliana, `aval_instalador`); documento anterior que diga "só o Diego" está superado (regra em 1.3.8). O aviso do resultado (`trg_aval_resultado`, migration `20261022191000`) cita **quem decidiu** ("Juliana APROVOU…"; sem nome, "A Juliana"), não o Diego — conferido no banco em 31/10/2026. Os comentários do código que ainda diziam "aval do Diego" (`decisoes-store.js`, `contrato-instalador-store.js`, `contrato-instalador.jsx`) foram corrigidos em 31/10/2026; o papel `ceo_diego` ficou marcado como legado (decisões antigas). Os textos do banco estão em 1.3.10, item 11.
- **Por que `pedidos_compra_varejo` aponta para o Almoxarifado (achado do PR #358):** a tabela é lida e exibida por `AlmoxarifadoPage` via `PedidosVarejoStore`; `PedidosAcompanhamentoPage` lê uma tabela totalmente diferente e nunca teria o registro. O mapa atual de `tabelaPagina` é `formularios_elevador` → formulário, `parceiros_instaladores` → cadastro de instaladores, `contrato_instalador_parcelas` → pagamentos a instaladores, `contratos_instalador` → contrato do instalador, `pedidos_compra_varejo` → Almoxarifado (aba Pedidos) e `emails_projeto` → Inbox.

### 1.3.9 Testes
- 8 testes unitários (`decisoes-store.test.js` 4 + `decisoes-gate-compra.test.js` 4), todos passam (rodados em 31/10/2026). 7 de navegador em `e2e/decisoes.spec.js` (histórico por pessoa, link de decidida/inexistente/pendente, "Ver documento" com falha e abrindo a proposta, URL com F5); rodam no CI com Supabase simulado e **não os rodei agora**.
- **Não testado com clique real em produção:** aprovar, reprovar, cancelar e solicitar de novo gravariam em dado real. O fluxo do WhatsApp (SIM/NÃO) também não foi exercitado nesta etapa.

### 1.3.10 Pendências e decisões
Achados, **sem correção**:
1. **Aprovação sem prova de identidade:** `decisoes_gerenciais` tem políticas `INSERT`/`UPDATE`/`SELECT` abertas à chave pública; qualquer pessoa com a chave aprova direto no banco (issue #571). Pelo tela, quem aprova depende do e-mail informado pelo navegador.
2. **5 decisões de montador seguem pendentes** com o Supervisor de Obra (antes estavam com a Arilene, hoje Maurício); revisar com ele.
3. **Texto fixo de pessoa nos gates:** as mensagens dizem "Juliana", "Diego", "Maurício" e "Regiane ou Guilherme" no código. Se o responsável mudar, a lista (`EMAILS_FIXOS`) muda mas a mensagem não.
4. **Desconto:** a regra existe em `proposta-desconto.js`: `LIMITE_GESTOR_PCT = 0.07` (até 7% decide o Gestor Comercial; acima, o CEO). Esse caminho usa `criarDecisao` direto, sem `criarDecisaoSeNaoExiste`: clique repetido cria decisões duplicadas.
5. **O texto de ajuda do menu** ("envio de proposta, desconto, compra, montador") não cita contratação de mão de obra, pagamento de parcela, compra de varejo nem a pergunta a partir de e-mail.
6. **Tutorial** (`central-de-decisoes`) está levemente defasado: não cita "Pedir decisão", o cartão de e-mail e as abas/URL de 31/10/2026. Regenerar pela sessão de tutoriais.
7. **Spec e plano do WhatsApp de 17/09 e `vphub-aval-whatsapp.md`:** absorvidos (ver 1.3.11 e 1.3.8) e excluídos do disco em 31/10/2026 por decisão do Gelson; recuperáveis no histórico do Git.
8. **Falha de leitura não aparece como erro:** o store engole o erro e devolve lista vazia (`decisoes-store.js`, só `console.warn`); o aviso "Tentar novamente" só aparece com a lista vazia. Falha de rede ou RLS vira "Nenhuma decisão pendente pra você no momento". `ehAdministrador()` vira `false` em qualquer erro (o Administrador cai para "Aguardando você"). O teste de navegador cobre só a falha do "Ver documento".
9. **Bloqueadas só para o Administrador:** quem não é administrador lê só decisões `pendente`; as `bloqueada_por_dependencia` e o aviso "Bloqueada — depende de outra decisão" só ele vê.
10. **`garantirAtiva` só roda em alguns gates** (`podeEnviarProposta`, `podeContratarInstalador` com Nº de cotação e `podeComprarEquipamento`). Não roda em `podeMontadorEntrarObra`, `podePagarParcela`, `criarDecisaoCompraVarejo` nem no contrato avulso: ali uma decisão cancelada fica travada até alguém clicar "Solicitar novamente". Esses gates também ignoram o `error` da leitura de existentes e podem duplicar decisão.
11. **Rótulo do aval do montador (corrigido no código em 31/10/2026):** `contratacao_mao_obra_ceo` é decidida pela Juliana; a tela passou a dizer "Contratação de mão de obra — aval da Juliana", a recusa diz "Aval da contratação recusado (e-mail de quem recusou)" e o aviso do Contrato do Instalador avulso diz "aval da Juliana". O nome interno do tipo (`…_ceo`) não muda (está gravado nas decisões). **No banco, aplicado com "Confirmo" em 31/10/2026** (migration `20261031120000_aval_instalador_textos_juliana.sql`; conferido depois: não resta "CEO" na função, permissões iguais): em `decisao_whatsapp_responder`, a ação do log "(CEO)" vira "(aval da Juliana)" e o aviso "Aval do CEO aprovado/recusado" vira "Aval do montador aprovado/recusado por <quem respondeu>". O tipo `inbox_decisao` não tem rótulo no `CASE` do gatilho e o aviso sai com o texto cru "inbox_decisao · …".
12. **"Solicitar novamente"** não confere quem clica nem pede confirmação: qualquer pessoa que veja o cartão em Decididas reabre, inclusive as canceladas pelo cron e as que só o Administrador poderia cancelar.
13. **Detalhes:** o selo do menu conta só decisões `pendente` do próprio usuário (bloqueadas não entram; o Administrador vê o número dele, não "tudo"). Aprovar pelo Aval Financeiro dispara `aprovarCompraCeoSeAberta` (caminho inverso ao de 1.3.6). `solicitado_por` não é criada por nenhuma migration do repositório (a lista de colunas de 1.3.7 vem do banco real).

### 1.3.11 Histórico (só o que ainda ensina)
- **23/09/2026:** "Ver documento" corrigido e blindado (PR #358): navegação por `setRoute`/`setSubsel`, resolução do Nº da cotação, mapa `tabelaPagina` conferido contra o store real.
- **28/09/2026:** alçada do CEO no envio de proposta só abaixo de 15% de margem (PR #473).
- **03/10/2026:** revisão da Central: status `cancelada`, abas Pendentes/Decididas, busca e filtro por tipo, aprovar/reprovar atômicos, Cancelar (Administrador), Solicitar novamente (mesma linha), aviso individual ao aprovador e ao solicitante, expiração de órfãs.
- **04/10/2026:** "Pedir decisão" a partir do Inbox (tipo `inbox_decisao`, uma linha a mais em `tabelaPagina`).
- **09/10/2026:** modais de aprovar/reprovar/cancelar passaram para a URL (varredura de URLs).
- **06/10/2026:** gate de prévia de compra passou a ser só leitura (#728).
- **16 a 22/10/2026:** Supervisor de Obra decide a entrada do montador; aval do instalador passou à Juliana; WhatsApp do aval.
- **31/10/2026 (#1215, #1233; #1244):** histórico filtrado no banco antes do limite, link de decidida/inexistente, erros do Ver documento avisados, idempotência de `criarDecisaoSeNaoExiste`, aba/tipo/busca e cartão destacado na URL.
- **17/09/2026 (não adotado):** o desenho de WhatsApp da Central (`decisoes-store.js` chamaria a Edge Function `whatsapp-notify` e gravaria em `whatsapp_notification_log`) **não foi o implementado**: o store não chama `whatsapp-notify` e a tabela `whatsapp_notification_log` não existe em nenhuma migration. (O store cita WhatsApp em outro ponto: `reenviarAvalWhatsApp` e as mensagens do aval do montador, que pedem o "SIM/NÃO" da Juliana pelo serviço de avisos.) O envio real é o serviço de avisos lendo `alertas` e `hub.aviso_fluxo` (PC-4).

---

## 1.4 Prazos & Pendências

### 1.4.1 O que é
O painel de controle da esteira de cada cotação: lista, por Nº da cotação, as etapas do Formulário até o Pós-venda, mostra quais estão atrasadas ou paradas e deixa o Financeiro agir nas duas etapas que dependem de uma pessoa. **Lê** `gatilhos` (a esteira) e `alertas`; **grava** em `gatilhos` só nas ações manuais (Boleto pago, Dar Aval de Pagamento, Fechar com motivo, "Já cobrei", gatilho avulso). A esteira em si é escrita pelo **motor** (`gatilhos-engine.js`), que roda no navegador de quem faz a ação nas outras telas.
Em 31/10/2026 havia **202 etapas** em **64 cotações**: 139 fechadas (`ok`) e 63 pendentes (26 "Proposta pronta — aguardando envio", 24 "Formulário", 8 "Precificação", 1 "Fornecedor", 4 de importação/instalação). Todas automáticas; **nenhum gatilho avulso**, nenhum lembrete aberto.

### 1.4.2 Rota e arquivos
- Rota `financeiro` (o id interno ficou, só o rótulo mudou) → `/adm-financeiro/financeiro[/<filtro>[/<Nº da cotação>]]`. Filtros: `atrasada`, `andamento`, `rascunho`, `fim`, `todas`. A cotação aberta fica no link; a busca e as janelas de confirmação ficam fora da URL de propósito (reabrir uma confirmação no F5 poderia confirmar duas vezes).
- Tela: `FinanceiroPage` em **`src/financeiro.jsx`** (o mesmo arquivo da Central de Notificações, 1.2, das Comissões e das Configurações — cuidado ao editar), com `CadeiaGatilhosCotacao`, `GatilhoCard`, `ModalNovoGatilho`, `ModalConfirmarSinal`, `ModalConfirmarAvalPagamento`, `ModalFecharComMotivo`. Motor e regras: **`src/gatilhos-engine.js`** (`window.GatilhosEngine`, 55 nós). Também carregado em `assinar.html` e nas páginas públicas (a assinatura emite eventos).
- Menu: grupo "Geral", 4º item, "Prazos & Pendências"; **restrito aos perfis Financeiro e Admin** (`restrict`). Caminho do topo "Financeiro / Prazos & Pendências" (o módulo no topo ainda diz Financeiro). Tutorial `geral/prazos-e-pendencias`.
- Documento de produto antigo: `instrucaocompra.md` **saiu do repositório** em 12/10/2026 (commit `41f9d33`, #852); o conteúdo útil (tipos de relacionamento e lembretes) está absorvido em 1.4.6. Ainda é citado em 6 comentários de código (tarefa do desenvolvedor).

### 1.4.3 Perfil e acesso
- O item só aparece no menu para Financeiro e Admin. **Existe guarda de rota** (`app.jsx`, `RESTRICTED.financeiro = ["financeiro","admin"]`; sem o perfil, `setRoute("dashboard")`), mas é um `useEffect`: a tela monta antes do redirecionamento e seus efeitos de montagem (`reloadGatilhos`, `reloadAlertas`, `verificarPrazos`) já rodam. O "perfil" é o seletor do navegador (`vpprd.role`), então qualquer pessoa troca para Admin e passa. Os botões Boleto pago e Dar Aval de Pagamento só gravam `confirmado_por` com o e-mail e não conferem alçada.
- "Aval de Pagamento" é um dos três avais que liberam a compra (1.3 e Aval Financeiro); quem o dá é o Financeiro.

### 1.4.4 O que a tela mostra
1. **Cabeçalho** com os botões Exportar fluxo e Novo gatilho.
2. **Aviso de falha** de carga (com "Tentar novamente"): números abaixo podem estar incompletos.
3. **4 KPIs:** Cotações em andamento · Com prazo estourado (e quantas etapas) · Ação do Financeiro pendente (boleto ou aval de pagamento) · Formulários sem envio.
4. **Faixa vermelha** "N cotações com etapa atrasada" (com "Ver agora") e, se houver avulsos, "N gatilhos vencem em até 2 dias".
5. **Alertas recentes:** até 6 dos que mais pedem atenção (críticos e avisos primeiro), com "Ver tudo (n)" para Notificações. Mesma regra de destinatário da Central (1.2).
6. **Cadeia de etapas por Cotação:** uma cadeia por cotação, as mais atrasadas primeiro, cada etapa com a barra de prazo (azul → vermelho), situação ("concluída no prazo", "atrasada", "registrada retroativamente", "em andamento") e o botão da ação quando houver.
7. **Gatilhos Financeiros Avulsos:** cartão que só existe se houver algum.
- **Detalhes conferidos na revisão de 31/10/2026:** a tela **não** mostra "concluída no prazo": a cadeia tem selo Encerrada/Concluída/Atrasada/Em andamento e a etapa mostra "concluído · levou Xh", "etapa pulada · registrada retroativamente", "fechado manualmente", "encerrado", "faltam Xh" ou "prazo estourado"; também "sem rastreio automático", "(opcional — não trava o fluxo)" e "⚠ Parado há N dias". A faixa vermelha tem o botão **Ver atrasadas**; "Ver agora" é do aviso de avulsos (`days_left <= 2`, inclui vencidos e concluídos) e rola para o cartão da cadeia automática, não para os avulsos. O subtítulo do cartão diz "Formulário → Compra liberada", mas a cadeia aberta lista os 55 nós até o Pós-venda.
- **Nomes dos modais:** criar = "Novo Gatilho Financeiro" (o botão de salvar é "Criar Gatilho"); boleto = "Confirmar Boleto Pago" ("Confirmar sinal" é o nome do componente); Fechar com motivo abre "Fechar ciclo com motivo" (botão "Encerrar ciclo"); o cartão de avulso tem o botão **Confirmar** (`conclusao_tipo = confirmado_manual`). Filtro padrão: "Atrasadas" se houver alguma, senão "Em andamento".

### 1.4.5 Botões e controles
- **Cabeçalho:** Exportar fluxo (CSV de **todas** as etapas, automáticas e avulsas) · Novo gatilho (modal "Criar Gatilho").
- **Cadeias:** filtros Atrasadas / Em andamento / Formulário sem envio / Concluídas-Encerradas / Todas (cada um com a contagem) e busca "Buscar Nº da cotação".
- **Por cadeia:** abrir/fechar (grava o Nº na URL). **Por etapa:** clicar abre o documento real (`GatilhosEngine.navegarPara`; etapa retroativa sem documento avisa em vez de fingir que existe); **Boleto pago** (etapa `AGUARDA_BOLETO`), **Dar Aval de Pagamento** (etapa `AVAL_PAGAMENTO`; o texto explica que é um dos três avais e não o aval de venda), **Fechar com motivo** (Cemitério), **Já cobrei** (lembrete).
- **Modais:** Confirmar sinal, Confirmar aval de pagamento, Fechar com motivo (motivo obrigatório), Criar Gatilho.

### 1.4.6 Comportamento
- **Como uma etapa nasce e fecha:** cada tela de origem chama `EventosFluxo.registrar`, que dispara `GatilhosEngine.onEvento`. O motor fecha as etapas cujo `fecha` é aquele evento e faz nascer as seguintes cujo `nasce` é ele; etapas com `requerEventos` (hoje a Compra liberada, que exige os 3 avais) só nascem quando **todos** os eventos já foram registrados. Se uma etapa posterior acontece sem a anterior, o motor cria a anterior já fechada como retroativa (`garantirNo`).
- **Prazos:** `prazoEfetivo` usa o prazo gravado ou, em linha antiga, o SLA atual; dias úteis seg–sex sem feriados que contam no SLA (tabela `calendario_feriados`, lida com cache de 10 minutos; se falhar, vale só o fim de semana); Precificação em horário comercial 08–18 h; espera do cliente e embarque em dia corrido.
- **SLAs atuais (`SLA_HORAS`):** Precificação 4 h comerciais; Aguarda cliente 240 h (limiar do Cemitério); Contrato enviado 24 h; Projeto enviado 24 h; Aguarda assinatura 120 h; Aguarda boleto 72 h; Aval de pagamento 4 h; Negociação de compra 168 h; Embarque chegada 2160 h. **Sem prazo (por decisão do Gelson, 24/10/2026):** `SLA_FORNECEDOR` (só acompanhado, nunca gera atraso) e `PROPOSTA_PREP` ("Proposta pronta — aguardando envio manual", só lembrete visual).
- **Lembretes:** aos 7 dias sem resposta à Proposta e aos 3 dias sem assinatura do Contrato, o motor cria uma etapa-lembrete (`LEMBRETE__…`) que se fecha com "Já cobrei". Aos 10 dias sem resposta, a Proposta vira `revisao_necessaria`. Como não há cron para isso, isso é verificado **a cada carga da lista de etapas** (`reloadGatilhos` em `financeiro.jsx` chama `verificarPrazos`, junto com `InstalacaoObraStore.verificarPrazoVistorias`): ao abrir a tela, depois de cada ação manual e no "Tentar novamente".
- **Carga:** lê todas as etapas ordenadas por cotação e data; falha vira aviso vermelho, nunca "Carregando…" eterno nem lista vazia muda. Gatilho avulso tem os dias restantes recalculados na leitura (não grava).
- **Link:** cotação da URL que não está no filtro troca o filtro sozinha; cotação sem cadeia avisa e volta à lista.
- **Aviso diário:** o cron `gatilhos-alerta-prazos-diario` (seg–sex 10:20 UTC = 07:20 de Brasília) grava um alerta global **por lista de etapas vencidas** ("N etapa(s) com prazo vencido", link para esta tela), resolve os anteriores (id = semana ISO + assinatura da lista cotação+etapa, com `on conflict do nothing`: a mesma lista na mesma semana não gera alerta novo; só nasce outro quando a lista muda ou a semana vira; sem atraso, resolve tudo; a SQL usa `prazo_em` e `iniciado_em is null`, a tela usa `prazoEfetivo`) e usa a mesma regra da tela (fora opcionais e encerradas).
- **Omissões do motor (revisão):** `prazoEfetivo` devolve `null` quando há `iniciado_em`, e a migration `20261024130000` marca `iniciado_em` ao criar a precificação (as 4 h comerciais medem só até a Financeiro abrir a cotação); `COMPRA_LIBERADA` dispara `PIStore.criarRascunhoAutomatico` (rascunho de P.I.); os triggers `trg_evt_aviso_gatilho_ins/upd` enfileiram `hub.aviso_fluxo` (outbox do Hub) ao nascer ou concluir etapa (exceto retroativas); `reloadGatilhos` volta a página inteira para "Carregando…" a cada ação e não protege contra resposta fora de ordem (o Dashboard protege com `cargaRef`).
- **Tipos de relacionamento entre etapas** (absorvido de `instrucaocompra.md`): **TI (FS, término-início)** é o padrão e vale para quase toda a cadeia; **II (SS, início-início)**: Contrato enviado e Projeto de Engenharia enviado nascem juntos na proposta aprovada, correndo em paralelo, cada um com seu prazo de 24 h; **TT (FF)** e **IT (SF)** não são usados hoje. No código os nomes TI/II só aparecem nos comentários; o campo gravado é `rel: 'FS'` ou `rel: 'SS'` (`gatilhos-engine.js`).
- **Histórico dos prazos** (o que mudou desde a v2 de 30/09): Precificação 5 h → 2 h (29/09) → 4 h comerciais (24/10); fornecedor 48 h → sem prazo (24/10); espera do cliente 15 → 10 dias (limiar do Cemitério) com lembretes aos 7 dias (resposta à proposta) e aos 3 dias (assinatura do contrato); "Proposta pronta" sem prazo e envio sempre manual; e a verificação deixou de ser só "ao abrir a tela" (existe o cron diário de 07:20).

### 1.4.7 Dados — o que lê e o que grava
- **Grava:** `gatilhos` (o motor e as ações manuais), `alertas` (lembretes de vistoria e o aviso diário).
- **Lê:** `gatilhos`, `alertas`, `calendario_feriados`. Para abrir o documento de cada etapa, o motor resolve em `precificacoes_elevador`, `propostas`, `contratos_venda_equipamentos`, `dossier_obra` etc.
- **Colunas de `gatilhos`:** `id` (`GT-<cotação>-<etapa>`), `numero_cotacao`, `evento_key`, `trigger_name`, `predecessor_id`, `tipo_relacionamento`, `origem`, `conclusao_tipo`, `nascido_em`, `prazo_em`, `concluido_em`, `iniciado_em`, `status` (`pendente`, `ok`, `atencao`, `revisao_necessaria`, `encerrado`), `motivo_fechamento`, `alvo_id` (id do documento de origem) e as colunas antigas dos avulsos (`project_id`, `building`, `value`, `due_date`, `days_left`). **Triggers:** `trg_evt_aviso_gatilho_ins` e `trg_evt_aviso_gatilho_upd`.
- **Herda de:** 26 arquivos emitem eventos ou usam o motor (Formulário, Fornecedor, Precificação, Proposta, Contrato de Venda, Avais, Projeto de Elevadores, P.I., Embarques, RFQ, IMS, Dossiê, Vistorias, Contrato do Instalador, ART, Databook, Handover, Instalação…); eventos em `eventos_fluxo`.
- **Doa para:** Dashboard (1.1: "Onde Parou", Projetos em Andamento, KPIs de Financeiro), Controle de Cotações, Central de Decisões (`verificarGateCompra` lê o nó `COMPRA_LIBERADA`), Linha do Tempo e Notificações (1.2, aviso diário).
- **Colunas que faltavam na lista acima:** `chain` e `reverse_from` (usadas pelos avulsos). `numero_cotacao`, `evento_key`, `predecessor_id`, `origem`, `conclusao_tipo`, `nascido_em`, `prazo_em`, `concluido_em`, `motivo_fechamento` e `alvo_id` existem só no banco real, fora das migrations do repositório.

### 1.4.8 Regras e armadilhas
- **A esteira de uma cotação não pode ser preenchida antes da hora.** Caso real (cotação 982): um rascunho de proposta digitado com o Nº da cotação antes de ela existir emitiu `PROPOSTA_ELABORADA` e o motor completou sozinho as etapas puladas. Hoje a Proposta só aceita um Nº com Precificação, ou com envio direto à Precificação, ou (escada/esteira) com Formulário existente, e recusa Nº já usado por outra proposta do mesmo tipo e da mesma letra de revisão (desde 23/10/2026). **Não remova essa trava nem a troque por "sempre exigir".**
- **Etapa retroativa** sempre carrega `conclusao_tipo = 'retroativo'`; a tela não pode chamá-la de "concluída no prazo".
- **`COMPRA_LIBERADA`** exige os 3 eventos `AVAL_PAGAMENTO_CONFIRMADO`, `AVAL_JURIDICO_APROVADO` e `PROJETO_INSTALACAO_ASSINADO`; é a etapa que a Central de Decisões e o botão "Decidir comprar" consultam.
- **Decisões do Gelson sobre `IMPORTACAO_A_INICIAR` (06/10/2026, issue #706):** nasce na compra liberada (`COMPRA_FORNECEDOR_INICIADA`), **antes** de confirmar com o fornecedor, para não deixar a cotação sem pendência no intervalo; sem SLA fixo e sem alerta diário nesta primeira rodada. **Não feito:** SLA, alerta de "parado sem P.I.", painel dedicado de Gestão de Importação e teste de ponta a ponta com a cotação 955.
- **`IMPORTACAO_A_INICIAR`** nasce na compra liberada e fecha com `PI_CRIADA` com Nº de cotação; P.I. de varejo (sem equipamento) não passa por aqui, de propósito.
- **Etapas e rótulos** moram no código (`NODES`); o rótulo mostrado vem do motor, não do texto gravado em `trigger_name` (linhas antigas dizem "SLA 5h"). Etapa nova = acrescentar em `NODES`, em `FASE_POR_NODE` do Dashboard (1.1; senão a fase cai em "Projeto") e, se tiver prazo, em `SLA_HORAS`.
- **O motor roda no navegador de quem age** e as etapas que dependem de efeitos da assinatura pública (cascata) são executadas depois, pela fila `fluxo_pendentes`, quando alguém interno abre o sistema (ver Parte comum).
- **`GT-955-AVAL_*`:** etapas de avais da 955 foram criadas à mão (nasceram antes da regra); o motor não cria retroativamente o que o evento já passou.
- **Cache:** mudou `financeiro.jsx` ou `gatilhos-engine.js`, suba o `?v=` no `index.html` (e em `assinar.html`, `cotacao-elevador-fornecedor.html` e `formulario-cliente.html`, que carregam o motor).

### 1.4.9 Testes
- 16 testes unitários do motor (`gatilhos-engine.test.js`), todos passam (rodados em 31/10/2026); mais testes no Dashboard e nos avais que dependem das mesmas regras. 4 de navegador em `e2e/prazos.spec.js`, que rodam no CI e **não rodei agora**.
- **Não testado com clique real em produção:** Boleto pago, Dar Aval de Pagamento, Fechar com motivo, Novo gatilho e Exportar fluxo (gravariam ou baixariam dado real).

### 1.4.10 Pendências e decisões
Achados, **sem correção**:
1. **Três nomes de rota/módulo:** menu "Prazos & Pendências", caminho do topo "Financeiro / Prazos & Pendências", rota `financeiro` e cabeçalho "Geral · Prazos". A tela está no grupo Geral mas restrita ao Financeiro.
2. **Guarda de rota fraca:** o menu restringe e existe guarda de rota, mas o "perfil" é o seletor do navegador (qualquer pessoa vira Admin) e a tela monta antes do redirecionamento (ver 1.4.3). As confirmações não checam alçada, e a gravação no banco é aberta à chave pública (issue #571).
3. **26 etapas "Proposta pronta" pendentes e 24 "Formulário":** sem prazo por decisão do Gelson, aparecem como "em andamento" indefinidamente; a tela depende de alguém fechar o ciclo. O filtro "Formulário sem envio" existe para isso.
4. **Texto de ajuda do "?"** diz que "só duas ações dependem de uma pessoa" (Boleto pago e Dar Aval); vale, mas há também "Fechar com motivo" e "Já cobrei", que ele cita parcialmente.
5. **A página mostra "Novo gatilho"** embora não exista gatilho avulso há tempo; manter ou retirar é decisão do Gelson.
6. **Prazo de lembrete e de Cemitério** (7, 3 e 10 dias) moram no código; não há tela para ajustar.
7. **Tutorial** (`prazos-e-pendencias`) é de 04/10/2026 e a tela mudou em 30/10 (URL com filtro e cotação, #1214): regenerar pela sessão de tutoriais.
8. **Etapas sem fechamento automático:** os 5 nós `PROJETO_APROVADO`, `FICHA_CRIADA`, `PAGAMENTO_1_SOLICITADO`, `PAGAMENTO_1_CONFIRMADO` e `TESTES_REALIZADOS` têm `fecha: null`; além disso, `PAGAMENTO_1_CONFIRMADO` **nunca nasce** (o evento `PAGAMENTO_FORNECEDOR_1_SOLICITADO` está só no catálogo e nada o dispara; idem `PROJETO_APROVADO_CLIENTE` e `FICHA_TECNICA_CRIADA`). Sem SLA não geram atraso, mas contam como pendência: a cotação que chega à Engenharia ou à P.I. nunca fica "Concluída", não entra em "Concluídas/Encerradas" e conta para sempre em "Cotações em andamento" e nos "Projetos em Andamento" do Dashboard (`projetosDaEsteira` não ignora opcionais nem `encerrado`). O comentário do código chama isso de intencional. O que a tela mostra como "atraso" depende de os outros módulos emitirem o evento certo.
9. **Os dois sentidos de "pendente" discordam:** o KPI "Gatilhos próx. 7d" do Dashboard e o "Onde Parou" usam regras diferentes (ver 1.1.8); a cotação que chega à Engenharia ou à P.I. nunca fecha (ver 1.4.8 item 8).
10. **Achados do relatório forense de 19/10/2026 (`AUDITORIA_FORENSE_E2E_SCORE.md`, linha de base do Guardião) que tocam esta tela** e ainda precisam ser reconferidos um a um: E2E-009 (a trava dos 3 avais é contornável por `garantirNo`), 010, 015 (a fila `fluxo_pendentes` só anda com alguém logado), 025, 026, 027 (avisos para a área errada) e 031 (`criarDecisaoSeNaoExiste` sem UNIQUE). O E2E-024 já foi corrigido. Não foram reconferidos nesta etapa.

### 1.4.11 Histórico (só o que ainda ensina)
- **23/08/2026:** Cemitério (proposta parada vira `revisao_necessaria`, só uma pessoa a encerra com motivo) e lembretes de cobrança.
- **03/10/2026:** revisão completa (renome para "Prazos & Pendências", horas úteis, KPIs reais, etapas retroativas, alertas pela rota gravada, cron diário 07:20).
- **29/09 a 08/10/2026:** nós `AVAL_JURIDICO` e `AVAL_ENGENHARIA` nascem na aprovação da proposta; `COMPRA_LIBERADA` passa a exigir os 3 avais; nó `IMPORTACAO_A_INICIAR` (#706).
- **02/10/2026:** trava da Proposta contra Nº de cotação inexistente, duplicado ou sem Precificação (caso 982).
- **24/10/2026:** Precificação com 4 h comerciais; `SLA_FORNECEDOR` e `PROPOSTA_PREP` sem prazo; feriados que contam no SLA vindos de `calendario_feriados`.
- **09/10/2026:** `gatilhos-engine.js` ganhou resolução de link para avais e Contrato de Venda (varredura de URLs).
- **31/10/2026 (#1214, PR #1236):** filtro e cotação aberta na URL; falha de carga vira aviso.

---

## 1.5 Inbox 🔒

> **Área blindada** (regra permanente do CLAUDE.md, 23/09/2026): quem for "mexer, melhorar, simplificar, remover ou refazer" qualquer parte do sistema de e-mail **para antes de editar**, informa o que já existe e funciona (resumo abaixo) e só segue com confirmação explícita do Gelson. Vale para `logistica.jsx` (`EmailInbox`, `EmailBody`, `EmailNovoModal`), as Edge Functions `send-email`, `read-inbox`, `sign-email-anexos` e `suggest-email-reply`, a tabela `emails_projeto`, o vínculo por Nº de cotação, o cron `read-inbox-poll` e `formulario-elevador.jsx` (RFQ ao fornecedor). **Nunca apagar e-mail da caixa real `suporte@vpsistema.com` (IMAP); só listar para o Gelson apagar à mão.**
>
> **Canal de e-mail** (funções `send-email`, `read-inbox`, `sign-email-anexos` e `suggest-email-reply`, travas, crons e os avisos que nascem do e-mail): descrito em `docs/modulos/15_servicos.md` S6 (01/11/2026). A **tela** e a **lei** continuam aqui.

### 1.5.1 O que é
A caixa de e-mail compartilhada da empresa (`suporte@vpsistema.com`) dentro do sistema: chegam as respostas de fornecedores e clientes, e saem as cotações, propostas, contratos, tratativas e pedidos enviados pelas outras telas. Funciona como um Gmail de equipe: pastas, marcadores, conversas, pesquisa avançada, janela de escrever, mais camadas de equipe (dono, atribuição, vínculo a cotação, triagem por regras, "pedir decisão" e "extrair preço"). **Lê** a caixa por IMAP (`read-inbox`) e **envia** por SMTP (`send-email`); tudo passa por `emails_projeto`.
Em 31/10/2026 havia **133 e-mails** em `emails_projeto`: 55 de entrada e 78 de saída; 22 excluídos (só da lista), nenhum em spam, 30 sem dono. Vínculo: 2 certos, 24 prováveis e 107 sem vínculo. Por origem: cotação a fornecedor 33, cotação de varejo 16, cotação de frete 9, contrato de venda 7, projeto de instalação 2, proposta 1, respostas/avulsos 4 e 61 sem referência.

### 1.5.2 Rota e arquivos
- Rota `inbox` → `/geral/inbox`, `/geral/inbox/<pasta>`, `/geral/inbox/<id do e-mail>` e `/geral/inbox/<pasta>/<id do e-mail>`, mais `?q=<pesquisa>`. **Pastas (ids):** Caixa de entrada = padrão (URL limpa), `starred` (Com estrela), `adiados`, `mine` (Atribuídos a mim), `triagem` (Sem responsável), `sent` (Enviados), `all` (Todos os e-mails), `spam` e `m:<id>` (marcador). E-mail aberto na Caixa de entrada fica em `/geral/inbox/<id>` (forma antiga, continua valendo); em outra pasta, em `/geral/inbox/<pasta>/<id>`. **Link antigo com `?pasta=` ainda abre e é regravado no formato novo.** O `App` entrega o 2º segmento como `subsel`; a tela mantém o `subsel` igual a ele (`setSubsel`) para o `App` não reescrever o endereço, e escreve o 3º segmento por conta própria. Trocar de pasta ou abrir e-mail cria entrada no Voltar; digitar na pesquisa só substitui. Pasta que a pessoa não pode ver (marcador apagado, `triagem` sem alçada, nome inventado) avisa e volta à Caixa de entrada. As janelas de ação (Escrever, Atribuir, Pedir decisão, Extrair preço) ficam fora da URL de propósito.
- **Tela:** `EmailInbox`, `EmailBody`, `EmailNovoModal` e `InboxRespostasFormulario` em **`src/logistica.jsx`** (2.868 linhas em 31/10/2026, depois do PR #1259; o mesmo arquivo da Importação/Embarques). Camadas em arquivos próprios: `inbox-triagem(.jsx/-calc.js)` (robô, atribuição, lido/estrela, sugestão de vínculo), `inbox-visibilidade.js` (quem vê o quê), `inbox-gmail.jsx` + `styles/inbox-gmail.css` (barra de pesquisa, configurações, ajuda, janela Escrever, barra de ferramentas), `inbox-busca-calc.js`, `inbox-organizar(.jsx/-calc.js)` (arquivar, suspender, spam, marcadores), `inbox-historico.jsx` (pesquisa no histórico completo), `inbox-conversas(.jsx/-calc.js)`, `inbox-decisao.jsx` (Pedir decisão), `inbox-preco(.jsx/-calc.js)` e `inbox-preco-varejo.jsx` (extrair preço), `email-envio-helper.js` (envio direto, usado por RFQ, Proposta, Contratos, Tratativas, Frete…).
- **Edge Functions (versões em produção em 31/10/2026):** `send-email` v24, `read-inbox` v17, `sign-email-anexos` v7, `suggest-email-reply` v7. As quatro têm pasta em `supabase/functions/`.
- Menu: grupo "Geral", 5º item, "Inbox". Tutorial `geral/inbox`.
- **Rota no `App`:** `inbox` está em `KNOWN_ROUTES` (`router.js`) e em `SYNC_PASSTHROUGH_ROUTES` (`app.jsx`): o `App` preserva o 2º segmento do endereço (pasta ou id do e-mail, ver o 1º item) e a tela escreve e limpa o resto da URL por conta própria.

### 1.5.3 Perfil e acesso
- **Alçadas do módulo `inbox`** (Administração › Alçadas): `ver`, `criar` (escrever), `editar` (responder, encaminhar, vincular, atribuir, pedir decisão, extrair preço), `excluir`, `ver_todos`, `ver_equipe` (quem responde a ele), `ver_departamento`, `ver_area_<área>` (7 áreas), `triagem` (recebe e-mail sem dono) e `excluir_de_outros`. Administrador passa em tudo. Perfil novo nasce **sem nada** (os comentários do código dizem "tudo começa marcado" por causa da carga de 04/10/2026, que valeu só para os perfis que existiam então). **Conferido no banco em 31/10/2026:** não há gatilho em `perfis` que conceda alçada (só `hub_manual_espelho`), então nada é concedido sozinho.
- **Regra de visibilidade** (`inbox-visibilidade.js`): vejo o que é meu (dono ou atribuído); `ver_todos` vê tudo; e-mail sem dono só `triagem`; senão equipe, departamento e áreas marcadas. **Falha ao carregar as alçadas mostra tudo** (prefere não esconder e-mail de venda por erro de leitura).
- Atribuir: responsável atual, `ver_todos`, `triagem` (e-mail sem responsável) ou o chefe do responsável (`ver_equipe`), e precisa de `editar`. Excluir: por padrão só o dono; `excluir_de_outros` libera.
- **Limite honesto:** é organização na tela. `read-inbox` devolve a caixa inteira a quem chamar com a chave pública e `emails_projeto` tem leitura aberta (policies `ALL` para `anon` e `authenticated`); o `enviadoPor` é declarado pelo navegador. Segurança real = issue #571.
- **Onde se concede:** tela de Administração do site (`/admin/configuracoes/administracao`, Alçadas). **Situação em 31/10/2026:** dos 39 perfis ativos, 36 têm `ver`, `criar` e `editar`; **7 não têm `ver`** (1 Administrador, que passa de qualquer jeito, e 6 Colaboradores, que veem "Você não tem acesso" ao Inbox). `ver_todos`, `triagem`, `excluir` e `excluir_de_outros` estão em 7 perfis cada; `ver_equipe` em 8; `ver_departamento` em 20; `ver_area_*`: logística 9, financeiro 5, comercial 3, jurídico/importação 3, engenharia 2, gente & gestão 2, marketing 2. Quem for criar um perfil novo precisa conceder as alçadas ali.

### 1.5.4 O que a tela mostra
1. **Barra de cima:** título, pesquisa em pílula (com opções avançadas), "?" (Ajuda, Treinamento, Enviar feedback) e ⚙ (Configurações rápidas).
2. **Sidebar:** botão **Escrever** e as pastas, nesta ordem: Caixa de entrada (com não lidas), Com estrela, Adiados, Atribuídos a mim, Sem responsável (só `triagem`/`ver_todos`), Enviados, Todos os e-mails, Spam, mais a seção **Marcadores** com "＋".
3. **Faixa "Precisa de você (n)"** no topo da lista (prioridade alta, reclamação, ou pede resposta) e "N automáticos ocultos · ver tudo".
4. **Lista** de conversas: caixa de seleção, estrela, remetente, assunto — prévia, etiqueta do robô (assunto · área · prioridade), selo do documento de origem ("RFQ ao fornecedor", "Proposta", "Contrato de Venda", "Contrato Instalador", "Tratativa"), data estilo Gmail e lixeira ao passar o mouse. Densidade Padrão/Regular/Compacto.
5. **Bloco "Respostas de fornecedores pelo formulário"** (`InboxRespostasFormulario`): respostas dadas pelo link do RFQ, que não chegam como e-mail.
6. **E-mail aberto:** cabeçalho, corpo (texto/HTML com anexos assinados), faixa da conversa ("Conversa · N mensagens"), barra de sugestão de vínculo, faixa de decisão pedida e o painel de resposta. Painel de leitura à direita, abaixo ou sem divisão.
7. **Janela Escrever** flutuante (De, Para, Cc, Assunto, corpo, anexos).

### 1.5.5 Botões e controles
- **Menu lateral (cada item muda a URL, ver 1.5.2):** **Escrever** (abre a janela flutuante; não mexe na URL; precisa da alçada `criar`) · Caixa de entrada (com contagem de não lidas) · Com estrela · Adiados · Atribuídos a mim · Sem responsável (só `triagem` ou `ver_todos`) · Enviados · Todos os e-mails · Spam, mais a seção Marcadores. Clicar numa pasta fecha o e-mail aberto, limpa a pesquisa e grava a pasta no endereço.
- **Pasta/pesquisa:** operadores `de: para: assunto: cotacao: tem:anexo é:nao-lida|lida|estrela depois: antes: em: marcador: -palavra "frase"`; formulário avançado gera o mesmo texto.
- **Barra de ferramentas:** Selecionar, Arquivar, Denunciar spam ("Não é spam"), Suspender, Mover para, Marcadores, Marcar lida/não lida, Excluir, Atualizar. Agem nas conversas marcadas ou, sem marcação, no e-mail aberto.
- **No e-mail aberto:** Responder · Responder a todos · Encaminhar · Sugerir resposta (IA) · Vincular/desvincular a cotação · Atribuir · Pedir decisão · Extrair preço (e-mail de fornecedor ligado a cotação) · Abrir tratativas (e-mails de RFQ/Tratativa) · Excluir.
- **⚙ Configurações rápidas (por pessoa, no navegador):** densidade, painel de leitura, tipo de caixa (padrão, não lidas, estrela ou "precisa de você" primeiro), ocultar automáticos, agrupar em conversas.
- Carregar mais enviados (+50).

### 1.5.6 Comportamento
- **Entrada:** o cron `read-inbox-poll` (a cada 10 min, timeout de 20 s) lê as 25 mais recentes e grava em `emails_projeto`; só e-mail novo ou ainda sem linha é inserido (upsert por `imap_uid`). A tela atualiza ao abrir, ao clicar Atualizar e, quando entra e-mail de entrada, por Realtime (assinatura em `emails_projeto`, INSERT `direcao=entrada`) que só rechama o `carregar()`.
- **Saída:** `send-email` valida (formato, máx. 10 destinatários, allowlist, limite de taxa, `cc`), envia por SMTP e **registra todo envio** em `emails_projeto` (dono pelo login); assunto acentuado longo perde os acentos e o corpo vai em Base64 (ver 1.5.8). Falha em RFQ, Proposta, Contrato ou Tratativa cai para `mailto:` com aviso, e **o "enviado" só é gravado depois de `ok:true`**.
- **Vínculo:** pelo Message-ID/In-Reply-To (`certo`, herda `referencia_id/tipo`) ou pelo Nº da cotação no assunto (`provavel`, só se ainda não tem vínculo certo). Contrato/Proposta sem Nº de cotação ainda vinculam pelo Message-ID e `referencia_id`.
- **Triagem:** ao inserir e-mail de entrada, o gatilho `trg_emails_projeto_classificar` grava assunto, departamento, urgência, "pede resposta" e a confiança. **O limite fica na tela, não no banco:** `LIMITE_SILENCIOSO = 0.75` em `inbox-triagem-calc.js` (`politica`) agrupa como "automático oculto" só o e-mail automático com confiança ≥ 0,75 (nunca apaga).
- **Avisos:** `trg_alertas_inbox_resposta` cria aviso quando chega resposta vinculada (ao vendedor, se for tratativa/cotação a fornecedor; senão global, abrindo o Inbox); `trg_alertas_inbox_triagem` avisa prioridade alta/reclamação sem cotação; `inbox-alerta-sem-resposta` (a cada 15 min, seg–sex, 08–18h de Brasília) avisa e-mail que pede resposta há 2 horas úteis (nível 2 às 4 h, com o chefe); `inbox-acordar-adiados` (a cada 10 min) devolve e-mail suspenso à caixa e avisa.
- **Tratativas ⇄ Inbox (07/10/2026), lado do Inbox:** a Tratativa de uma cotação a fornecedor envia por `send-email` com `referenciaTipo 'tratativa_cotacao'`, `referenciaId` = id da cotação a fornecedor, assunto "Nova mensagem — Cotação Nº N — VerticalParts" (bate no regex de vínculo) e destino = contatos do RFQ (senão cadastro por aproximação). No Inbox, "Abrir tratativas" leva à aba Tratativas; **Responder/Responder a todos** a e-mail de RFQ ou Tratativa herda esse tipo e esse id (encaminhar não herda). O `read-inbox` não devolve `referencia_id`, então o helper consulta `emails_projeto` na hora do clique. Alerta ao vendedor: resposta de fornecedor vinculada a tratativa ou RFQ avisa **só o dono** do e-mail, com link para `/comercial/cotacao-fornecedor-detail/<id>/tratativas`. O lado da Tratativa (linha do tempo, histórico interno de preço e decisões, botão "Enviar documentos ao fornecedor") pertence ao módulo de Comercial/Pré-venda e será descrito lá.
- **Cc (30/10/2026):** campo "Em cópia (CC)" (vários, separados por vírgula) em todo envio, componente `EmailCcInput` (lembra o último em `localStorage vp_email_cc`); `send-email` valida, entra na allowlist, no limite de 10 e no limite de taxa; grava em `emails_projeto.cc`.
- **Arquivar/Suspender/Spam/Marcadores/estrela/lido:** por pessoa em `inbox_estado_pessoa`, exceto spam (compartilhado) e marcador da equipe. **Trava de spam:** e-mail enviado por nós e ligado a cotação ou documento nunca vira spam (tela e banco).
- **Pesquisa:** local sobre o carregado e, quando há palavra/`de:`/`assunto:`/`cotacao:`/datas, no **histórico completo** do banco (até 100 resultados, sem acento).

### 1.5.7 Dados — o que lê e o que grava
- **Grava:** `emails_projeto` (36 colunas: id, numero_cotacao, referencia_tipo/id, direcao, de/para/cc, assunto, corpos, message_id, in_reply_to, imap_uid, vinculo_confianca, lido, anexos, excluido_*, ia_*, dono_*, atribuido_*, spam_*), `inbox_estado_pessoa` (lido, estrela, arquivado, adiado), `inbox_atribuicoes` (histórico imutável de trocas), `inbox_marcadores` e `inbox_email_marcador`, `alertas`, `vp_logs`, `decisoes_gerenciais` (Pedir decisão), `cotacoes_elevador_fornecedor` (Extrair preço registra a resposta do fornecedor).
- **Lê:** `emails_projeto`, `inbox_regras` (só o banco), `alcadas_capacidade`, `colaboradores_vpsistema` (departamento e chefe), `cotacoes_elevador_fornecedor` e formulários (RFQ), `email_conhecidos()` (allowlist do envio) e o bucket de anexos via `sign-email-anexos`.
- **Triggers em `emails_projeto`:** `trg_emails_projeto_classificar`, `trg_emails_projeto_dono`, `trg_emails_projeto_dono_upd`, `trg_alertas_inbox_resposta`, `trg_alertas_inbox_triagem`. **Crons:** `read-inbox-poll`, `inbox-acordar-adiados`, `inbox-alerta-sem-resposta`.
- **Herda de (quem envia):** RFQ ao fornecedor (`formulario-elevador.jsx`), Proposta, Contrato de Venda e do Instalador, Tratativas, Frete do embarque, Cotações de Varejo, RFQ de elevador, Projeto de Instalação e o próprio Escrever; tudo pelo `EmailEnvioHelper` ou direto em `send-email`.
- **Doa para:** badges "Respondeu por e-mail" em RFQ, Contratos e Tratativas, a aba Tratativas (mão dupla), Central de Decisões ("Pedir decisão"), Precificação (Extrair preço), Notificações (1.2) e a Linha do Tempo da cotação.

### 1.5.8 Regras e armadilhas
**Erros reais já corrigidos — não reintroduza:**
- Anexo de 0 bytes (Uint8Array cru ao denomailer): exige base64 explícito. Limite real de anexo 2,5 MB somados (`MAX_ANEXO_TOTAL`), confirmado em teste real.
- Uma mensagem grande travava o batch: o `read-inbox` busca em duas fases (cabeçalho+tamanho, depois o corpo).
- `sb.functions.invoke()` devolve erro genérico: use `extrairErroFuncao()` para ver o erro real.
- Nome de fornecedor casa com o cadastro por **aproximação** (`.includes()` bidirecional), nunca igualdade exata.
- **Nunca chamar `.insert()` sem checar `error`** (supabase-js não lança em erro do PostgREST); `send-email` devolve `avisoPersistencia` se a gravação falhar.
- Fallback `mailto:` sempre com `window.toast`, nunca silencioso.
- `read-inbox` herda `referencia_id/tipo` do e-mail de saída original ao casar por Message-ID (é o que alimenta o badge por fornecedor).
- **Assunto e corpo no `send-email`:** assunto ASCII passa direto; acentuado curto segue com o denomailer; **acentuado longo perde os acentos (NFD)** de propósito; o corpo (texto e HTML) vai em **Base64**, linhas de 76. **Não volte a mandar encoded-word pronta nem corpo em quoted-printable** (cortava no meio do caractere UTF-8 e quebrava o cabeçalho).
- `FEEmailRespondidoBadge` prioriza `referencia_id`; o fallback por Nº só vale com um único fornecedor na cotação (`matchSeguro`). Os badges de Contrato/Tratativa filtram **só** por `referencia_id`.
- `FECotacaoFornecedorGrupo`: a chave de "ocupado" é montada igual à do envio (com `categoriaProduto`) e há trava síncrona (`enviandoRef`); uma cotação saiu 4x em 7 s por isso.
- **`send-email` não é relay aberto:** formato (400), máx. 10 destinatários (400), **allowlist** (403: `@verticalparts.com.br`, `@vpsistema.com`, extras e quem existe em algum cadastro por `email_conhecidos()`), limite de taxa (429: 25 envios por IP e 60 globais a cada 10 min) e **fail-closed** (503) se o banco falhar. Não afrouxe; se um envio legítimo der 403, cadastre o contato.
- **Antes de redeployar `send-email`, teste numa cópia** (o import remoto do `denomailer` já derrubou produção). A ferramenta MCP de arquivo único deu `BOOT_ERROR`; o deploy bom é pela CLI com bundle. Comparar produção × repo antes de publicar.
- Cron `read-inbox-poll`: o timeout de 5 s do pg_net estourava sempre; está em 20 s. **Não reduza nem apague o job.**
- `read-inbox` v17: `decodeHeaderValue` junta encoded-words adjacentes do mesmo charset; leitura real da caixa ainda não exercitada por teste automático.
- Log de e-mail recebido: a checagem `SELECT` por `imap_uid` antes do `upsert` evita um log novo a cada poll; **não a remova**.
- O envio nunca grava "enviado" sem `ok:true`; "Copiar link" e WhatsApp continuam registrando porque o envio é manual.
- **Nenhuma função em produção sem pasta em `supabase/functions/`** (regra de 01/10/2026): funções órfãs foram apagadas do Supabase; as recuperáveis estão em `supabase/functions-removidas/` (hoje `cleanup-inbox-tests`, `diag-imap`, `omie_listar_clientes` e `sync-importacao-varejo-estoque`) e **não se redeploya**.
- **Não invoque a função `cleanup-inbox-tests`** (se existir): tinha poder de apagar da caixa real.

**Regras atuais do envio e das camadas do Inbox (conferidas no código e no banco em 31/10/2026; encaixam o que o texto antigo do CLAUDE.md dizia):**
- **`send-email` (v24):** `MAX_DESTINATARIOS = 10`, 25 envios por IP e 60 globais a cada 10 minutos, medidos por `public.email_rate_check` (tabela `email_envios_log`, que apaga o que tem mais de 1 dia; migration `20261001230000`). `EXTRAS_PERMITIDOS` está no código e hoje tem um único Gmail de teste do Gelson. A allowlist consulta `public.email_conhecidos()`, que procura o endereço em: clientes, fornecedores, leads, colaboradores, colaboradores_vpsistema, parceiros_instaladores, operadores_estrangeiros, contrato_venda_signatarios, documento_signatarios, perfis, usuarios, convites, cotacoes_elevador_historico e emails_projeto. As duas funções SQL só executam pelo `service_role`. Anexos: `MAX_ANEXO_TOTAL_BYTES` = 2,5 MB somados.
- **Por que assunto e corpo são assim:** o `denomailer` 1.6.0 recodifica assunto acentuado ou começando por `=?` em quoted-printable cortando a cada 74 caracteres sem dobrar o cabeçalho (assunto longo fecha o bloco de cabeçalhos no meio e o resto vira corpo) e corta o corpo em QP no meio de um caractere UTF-8 (`=c3=` + quebra + `=a9`, e o "é" chegava como `c3©`). Por isso `codificarAssunto` deixa o ASCII passar, o acentuado curto (QP até 74) seguir pelo denomailer e o acentuado longo perder os acentos (NFD), e `corpoBase64` manda texto e HTML em Base64 pelo `mimeContent`, linhas de 76.
- **Funções SQL do Inbox (todas existem no banco):** `inbox_classificar` (usada pelo gatilho BEFORE INSERT da triagem), `inbox_sugerir_vinculo` (candidatas com probabilidade e confiança), `inbox_buscar_historico` e `inbox_texto_busca` (pesquisa sem acento, via `unaccent`), `inbox_alertar_sem_resposta` e `inbox_acordar_adiados` (os dois crons).
- **"Extrair preço" (grava como o formulário do fornecedor):** `registrarRespostaPorEmail` grava `status = respondido`, congela o câmbio USD/BRL, dispara o evento `FORNECEDOR_RESPONDEU` e marca `_meta.origem = email`; `preco_total` = unitário × quantidade da unidade; campo deixado vazio não apaga o que já existia; se o fornecedor já respondeu pelo formulário, exige marcar "substituir" e guarda a resposta anterior em `_meta.substitui`. O texto citado (nossa própria RFQ devolvida) é cortado antes da leitura.
- **Aviso de resposta no Inbox:** o gatilho que cria o alerta engole qualquer falha de propósito (`exception when others then null`), porque o alerta jamais pode impedir um e-mail de ser gravado; não troque por propagar o erro. O id é `inbox-<id do e-mail>`, no máximo um aviso por e-mail.

### 1.5.9 Testes
- 71 testes unitários nos 6 arquivos `inbox-*.test.js` (triagem, visibilidade, busca, conversas, organizar, preço), todos passam (rodados em 31/10/2026). 12 de navegador em `e2e/inbox.spec.js` (Supabase simulado; nunca toca produção). **Rodados em 31/10/2026 neste ambiente:** 12 de 12 passam (2 rodadas com 2 workers como no CI e 1 com 4 workers); com 4 workers, 2 rodadas deram uma falha cada, em teste diferente e na carga fria do primeiro teste de cada worker (cada um passou isolado), então há instabilidade de carga fria. Os 3 testes de URL por pasta (cada pasta, link antigo com `?pasta=`, link direto `/<pasta>/<id>`) são novos.
- **Não exercitado de ponta a ponta:** leitura real da caixa pelo `read-inbox` depois de v17, entrega em spam/quarentena no destino, "Vincular e enviar" e o aviso pós-envio ao responsável, resposta real a "Pedir decisão" e Extrair preço com e-mail de fornecedor real.

### 1.5.10 Pendências e decisões
Achados, **sem correção** (todos registrados por sessões anteriores, nada novo foi alterado):
1. **Reputação de envio:** e-mails de teste caíram no Spam (domínio e IP compartilhado da Hostinger com pouco volume). DKIM/SPF/DMARC existem e estão propagados. Só o uso ao longo do tempo ou um provedor transacional resolve; fora de escopo.
2. **Segurança dos dados:** a leitura é aberta à chave pública e `read-inbox` devolve a caixa inteira (#571); a visibilidade por dono é organização na tela.
3. **Sem dono:** 30 e-mails ficaram sem dono (11 de entrada na carga inicial e os demais sem vínculo); só quem tem `triagem` os vê.
4. **Segue pendente por decisão:** a "Fase 4" de rascunhos, tarefas e agendamento de envio do roteiro Gmail, e a importação de outras pastas IMAP além da INBOX (a caixa tem poucas mensagens).
5. **Vínculo provável é palpite** (regex do assunto); thread nova sem número fica órfã até alguém vincular.
6. **`FEEmailRespondidoBadge` (RFQ)** pode acender por resposta que, em teoria, é sobre a Proposta/Contrato da mesma cotação quando só há um fornecedor (nota residual do PR #486).
7. **Tutorial** (`inbox`) é o que mais envelhece (a tela mudou várias vezes em 04/10 e 31/10): regenerar pela sessão de tutoriais.
8. **A mensagem trilíngue** do RFQ de elevadores/portal segue como estava; cotação nacional pode ser só PT-BR, sem pedido explícito de qual envio mudar.
9. **A pasta `docs/` não tem documento de e-mail próprio:** o sistema vive neste capítulo. Em 31/10/2026 a seção "Sistema de E-mail/Inbox" do `CLAUDE.md` foi reduzida a uma lei curta (o que é protegido e o que nunca se faz) com o endereço de §1.5.8; a regra completa mora aqui.

### 1.5.11 Histórico (só o que ainda ensina)
- **23/09/2026:** sistema de e-mail validado ao vivo e blindado (envio, leitura, vínculo, soft-delete, cron de 10 min).
- **28/09/2026:** erro de persistência engolido no `send-email` corrigido; badge e busca (PR #450); Realtime na caixa (PR #417); logs `vp_logs` de e-mail (PR #460).
- **30/09 a 02/10/2026:** investigação "fornecedor não recebe" (chave de ocupado, "enviado" só com `ok:true`); `send-email` v16 deixou de ser relay aberto (allowlist, taxa, fail-closed).
- **28/09 a 01/10/2026:** envio SMTP direto de Proposta, Contrato de Venda e do Instalador (PRs #476, #486, #489); Tratativas com `referenciaId`; helper único `EmailEnvioHelper` (PR #544).
- **04/10/2026:** triagem por regras; dono e permissões em Administração (fase 1); troca de dono, sugestão de vínculo, lido/estrela por pessoa (fase 2); layout estilo Gmail (fase 3); arquivar, suspender, spam e marcadores (4A); pesquisa no histórico (4B); conversas (4C); alerta de 2 horas úteis; Pedir decisão; Extrair preço.
- **07/10/2026:** Tratativas ⇄ Inbox em mão dupla (bug do corpo vazio do `send-email` nas Tratativas corrigido).
- **30/10/2026:** CC em todos os envios, correção de acentos/quebra no Outlook e Gmail (`send-email` v24, `read-inbox` v17, PR #1187).
- **31/10/2026:** pasta e pesquisa na URL (a pasta em `?pasta=`); abrir e-mail limpa a URL ao fechar.
- **31/10/2026:** a pasta passou para o caminho (`/geral/inbox/<pasta>[/<id>]`); só a pesquisa ficou na query; link antigo `?pasta=` segue valendo. Pedido e "Confirmo" do Gelson (área blindada); só front, sem tocar `send-email`, `read-inbox`, vínculo nem soft-delete.

---

## Parte comum do Geral

> O que as cinco telas (1.1 a 1.5) compartilham e que não pertence a uma só. **Não tem número de tela** (regra de numeração): fica depois do 1.5 e usa o prefixo PC-. Quando uma peça daqui for usada por outro módulo, ela continua sendo descrita só aqui e os outros documentos apontam para cá.

### PC-1 Mapa de ligações entre as 5 telas
| Quem produz | O que produz | Quem consome |
|---|---|---|
| Todas as telas de negócio | Evento em `eventos_fluxo` (`EventosFluxo.registrar`) | Motor de etapas → **1.4** (que alimenta **1.1** Projetos/Onde Parou/KPIs) |
| Motor, gates, gatilhos no banco | Linha em `alertas` | **1.2** (lista e sino), **1.1** (frase e alertas críticos), **1.4** (Alertas recentes), WhatsApp |
| Gates de outras telas | Linha em `decisoes_gerenciais` | **1.3** (decide); a tela de origem libera ou trava o passo; **1.2** avisa |
| `read-inbox` / `send-email` | Linha em `emails_projeto` | **1.5**; badges em RFQ, Contratos e Tratativas; **1.2** (aviso de resposta); **1.3** (Pedir decisão) |
| **1.5** | Pedir decisão (`inbox_decisao`) | **1.3** |
| **1.3** | Aprovação do CEO de compra | Aval Financeiro e gate da P.I.; etapa `COMPRA_LIBERADA` em **1.4** |
| **1.4** | Etapas vencidas | **1.1** (Onde Parou), **1.2** (aviso diário das 07:20) |

Ninguém aqui escreve nas tabelas dos outros por atalho: o contato é por evento, alerta, decisão ou e-mail.

### PC-2 Trilha de eventos e motor de etapas
- **Tela de origem → `EventosFluxo.registrar({ evento, numeroCotacao, alvoLabel, alvoId, detalhe })`** (`src/eventos-fluxo-store.js`, 65 eventos definidos, cada um com módulo, rótulo e papel). Grava em `eventos_fluxo` (506 linhas em 31/10/2026) e **depois** chama `GatilhosEngine.onEvento`. Evento desconhecido só gera aviso no console e não grava. Falha ao gravar não derruba a ação da tela.
- O motor (1.4) usa `NODES` como a **fonte viva** da cadeia: quem nasce e fecha em cada evento. Acrescentar uma etapa = `NODES` + `SLA_HORAS` (se tiver prazo) + `FASE_POR_NODE` do Dashboard (1.1). Os eventos de instalação também liberam parcela de pagamento ao instalador (Trilha B).
- Evento disparado pelo **cliente** na página pública passa a ser gravado por um usuário interno (PC-3), com `atorNome` explícito para a trilha dizer quem agiu de verdade.

### PC-3 Fila de efeitos da assinatura pública (`fluxo_pendentes`)
- **Por quê:** a página pública (`/assinar/:token`) não pode escrever nas tabelas internas (segurança real, #571). A RPC de assinar, recusar ou pedir revisão faz a parte segura no banco (status, alerta, `vp_logs`) e **enfileira** o restante (eventos, etapas, decisões, dossiê, lead→cliente, D0).
- **Quem executa:** `src/fluxo-pendentes.js`, no sistema interno de quem estiver logado, a cada 30 s e ao voltar para a aba. **Só roda no sistema real**, não em `localhost` (salvo `localStorage vp_fluxo_dev=1`); `vp_fluxo_pendentes='off'` desliga. Reivindicação atômica (`FOR UPDATE SKIP LOCKED` com lease de 5 minutos, até 5 tentativas); item que falha fica `falhou` com o motivo.
- **Tipos que esta versão sabe executar:** `proposta_assinada`, `proposta_recusada`, `proposta_revisao`, `contrato_venda_assinado`, `contrato_venda_representante`, `contrato_venda_signatario`, `contrato_instalador_assinado`, `projeto_instalacao_assinado`. O banco só entrega os tipos que a versão da tela informa; versão antiga em cache nunca pega tipo novo.
- **Consequência prática:** o contrato fica `assinado` na hora, mas o D0 e as etapas seguintes só aparecem quando alguém interno abrir o sistema. Em 31/10/2026 a fila tinha 9 itens, todos concluídos.
- Tipo novo = incluir em `TIPOS` e tratar em `executar`; a lista completa do que roda no navegador está em `docs/seguranca/cascata-assinatura.md`.
- **Os dois "5":** `tentativas < 5` por item e o lote de 5 por rodada (`fluxo_pendentes_reivindicar(p_max)`, migrations `20261005100000` e `20261005120000`) são coisas diferentes.
- **Os 5 efeitos que a assinatura de Proposta deixa na fila** (absorvido de `docs/seguranca/cascata-assinatura.md`): (1) alerta e `vp_logs` (já gravados no banco pela RPC); (2) `EventosFluxo.registrar(CLIENTE_RESPONDEU_PROPOSTA)`, com ator = o cliente; (3) `DecisoesStore.podeComprarEquipamento` (decisão do CEO só com margem < 15% ou desconhecida, nascida sem solicitante); (4) `__DOSSIER.criarDeProposta` (idempotente por Nº de cotação); (5) lead → Convertido e `criarOuVincularDeLead` (cliente). Já no banco, sem depender do navegador: os triggers `fn_avais_abrir_na_proposta` (abre os 2 avais e a notificação "avais iniciados") e `fn_avais_notificar_ok`. **Consequências:** a cascata só anda com alguém interno logado; o momento (`nascido_em`/SLA) dos gatilhos é o do processamento, não o da assinatura; o dossiê grava `created_by` = quem processou. Interruptor de emergência: `localStorage.vp_public_rpc = off`. Fase 4: restringir `fluxo_pendentes_*` a usuário ativo e remover o caminho antigo.

### PC-4 Alertas como barramento
- `alertas` é o canal único de aviso a pessoas: **produtor** grava (front, 4 Edge Functions, gatilhos e crons do banco — ver 1.2.7) e **consumidores** leem (1.2, 1.1, 1.4, sino, WhatsApp).
- **Id determinístico por fato** (mesmo fato = mesmo id): evita repetir aviso a cada rodada de cron; `on conflict do nothing` ou `ignore-duplicates`.
- **Destinatário:** `destinatario_email` nulo = global; preenchido = só aquela pessoa. Todas as telas filtram pela mesma regra.
- **`rota`:** o gatilho `trg_alertas_rota_padrao` preenche pelo prefixo do id; todos os 223 abertos de 31/10/2026 têm rota. Prefixo novo = acrescentar em `alertas_rota_por_id`.
- **WhatsApp:** todo alerta dirigido também vira WhatsApp, entregue pelo gi-avisos (serviço da VPS) por um caminho em fila: `alertas` → `eventos_outbox` → Central de Eventos do vpsistema → gi-avisos. A mecânica, a janela de envio, o agrupamento de 24 h e as regras de título moram em `docs/modulos/15_servicos.md` (S2 e PC-2). **Não mexer no serviço**; ao criar aviso importante, título curto, com o essencial na frente.
- **Expiração:** `alertas-expirar-diario` (10:30 UTC) resolve `info` > 14 dias e os demais > 45 dias.

**O serviço de avisos de WhatsApp (gi-avisos):** → `docs/modulos/15_servicos.md` S2 (regras conferidas no código em 01/11/2026) e PC-2 (fila `eventos_outbox` e o caminho de ponta a ponta). *(Este bloco, absorvido em 31/10/2026 de `.claude/gi-avisos-regras-whatsapp.md`, foi concatenado lá em 01/11/2026 por decisão do Gelson e virou ponteiro (Art. 50); o texto anterior continua no Git. O código desmentiu duas frases do texto antigo: o serviço lê a Central de Eventos, não a tabela `alertas` direto, e não existe janela por departamento.)* O detalhe dos tipos `instalador.*` continua no módulo 11.

### PC-5 Registro de atividades (`vp_logs`)
- `window.VPLog.registrar({ modulo, acao, alvo, alvo_id, detalhe })` (`src/vp-log.js`): auditoria global "quem fez o quê, onde e quando" (3.078 linhas em 31/10/2026). Segundo o cabeçalho do arquivo, é append-only. **Best-effort:** não quebra o fluxo principal. Aceita essas chaves e, opcionalmente, `ator_nome` e `ator_setor` (sem eles usa o usuário logado); não use `descricao`. **Sem `acao` não grava nada.** `detalhe` em texto vira `{texto}`.
- **Não confundir** com `eventos_fluxo` (trilha do fluxo operacional por cotação, que alimenta a Linha do Tempo e o motor). Um módulo pode e deve gravar os dois quando fizer sentido.
- **Cobertura (do CLAUDE.md, 28/09/2026):** a tela `LogsAdminPage` (`src/logs-admin.jsx`) lê de verdade de `vp_logs` por `VPLog.listar()`; nunca teve mock. O problema era cobertura. Já chamam `VPLog.registrar` Comercial, contratos, documentos, Ficha Técnica, Catálogo, Financeiro/Gatilhos, Pedido a Fornecedor, Proposta, Aval Financeiro, Precificação (acrescentar, remover e restaurar equipamento, e aprovar), Inbox (enviar, responder, excluir, receber), Formulário de Elevadores, Central de Decisões e Solicitações de Produto. **Não houve varredura exaustiva:** Cadastros, Embarques, Vistorias e Instalação podem ainda estar sem log. Quem mexer em `acrescentarEquipamento`, `removerEquipamento`, `restaurarEquipamentoMO` e `aprovar()` mantém as chamadas de log.
- **Nunca** grave dado sensível no `detalhe` (valores de salário, telefone, e-mail de terceiros).

### PC-6 Identidade, alçadas e segurança
- **Login:** SSO do vpsistema (projeto `ubdkoqxfwcraftesgmbw`); o `sso_token` é usado uma vez e o app guarda o e-mail em `window.__VP_USER`. **Não existe credencial verificável do usuário para uma Edge Function**; nunca exija sessão do vpprd numa função. Na Fase 2 do plano de segurança, `src/vp-auth.js` troca o token por sessão nativa em **modo sombra** (os dados ainda usam a chave pública).
- **Alçadas:** tabela `alcadas_capacidade` por perfil (módulo + capacidade), lida por `PropostaStore.temCapacidade`; Administrador passa em tudo. Catálogo em `colaboradores-admin-store.js`. Alçadas das telas de Geral: `inbox.*` (1.5), `decisoes.<papel>` (1.3). Notificações (1.2) e Dashboard (1.1) não têm alçada; Prazos & Pendências (1.4) só restringe o menu.
- **Estado real da segurança:** várias tabelas de Geral ainda têm leitura e escrita abertas à chave pública (`gatilhos`, `decisoes_gerenciais`, `emails_projeto`). A trava por pessoa é da tela. O isolamento verdadeiro depende da issue #571 e do plano em `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`. **Tabela nova nasce já com RLS fechada.**
- **Modo do `vp-auth.js` (conferido no banco em 31/10/2026):** a ordem de decisão é `localStorage.vp_auth_mode` manual (`off`, `shadow` ou `on`); senão a RPC `vp_auth_modo` devolve `on` se a tabela `vp_auth_piloto` tem o e-mail da pessoa **ou o coringa `*`**, e `shadow` caso contrário (migration `20261009280000`). A tabela tem hoje **1 coringa e 4 nominais**, então **todo usuário com sessão nativa está em `on`**; `shadow` só aparece para quem ainda não tem sessão. Com sessão `ok` e modo `on`, só as chamadas `/rest/v1/` vão com `Authorization: Bearer`, com recuo para a chave pública em 401/403, sem limite de vezes (o número 50 é só o tamanho do histórico de diagnóstico em `VpAuth.status().recuos`). **Exceção:** a recusa da trava de valores (hint `vp_valores`) não é refeita com a chave pública; volta como está. O texto de "modo sombra" no item de login acima é o histórico de 04/10/2026 e está superado. `VpAuth.status().modo` e o log `[VpAuth] modo=…` podem mostrar `shadow` antes da sessão nascer. A identidade `window.__VP_USER` vem de decodificar o JWT no navegador, sem checar a assinatura.
- **Onde se concedem as alçadas:** `/admin/configuracoes/administracao` (Alçadas, no vpsistema/site de administração). Telas de Geral que dependem delas: Inbox (1.5.3) e Central de Decisões (1.3.3).

### PC-7 Jobs agendados do Geral
| Job | Quando (UTC) | O que faz | Tela |
|---|---|---|---|
| `read-inbox-poll` | a cada 10 min | lê a caixa e grava em `emails_projeto` (timeout de 20 s) | 1.5 |
| `inbox-acordar-adiados` | a cada 10 min | devolve e-mail suspenso e avisa | 1.5 |
| `inbox-alerta-sem-resposta` | :07,:22,:37,:52, 11–21 h, seg–sex | avisa e-mail sem resposta há 2 h úteis (4 h com o chefe) | 1.5 / 1.2 |
| `alertas-expirar-diario` | 10:30 | resolve alertas antigos | 1.2 |
| `decisoes-expirar-orfas-diario` | 10:40 | cancela decisões de cotação que não existe mais há 30 dias | 1.3 |
| `gatilhos-alerta-prazos-diario` | 10:20, seg–sex | 1 alerta global de etapas vencidas | 1.4 / 1.2 |
Resultado de job com `net.http_post` não aparece em `cron.job_run_details` (só diz que o disparo saiu); o resultado real está na tabela de log da função ou em `net._http_response`.

Esta tabela lista os 6 jobs **das telas de Geral**. Em 31/10/2026 o banco tinha **49 jobs ativos**; vários outros também escrevem em `alertas` e alimentam o que a Central (1.2) mostra, mas pertencem a outros módulos: `pcp-alerta-compras-diario`, `pcp-alerta-prazos-diario`, `pcp-compras-alerta-atrasos`, `pcp-expedicao-alerta-sem-entrega`, `pcp-varejo-alerta-parados` e `estoque-reconciliacao-diaria` (Logística/PCP); `embarques-alerta-rastreio-diario` e `embarques-alerta-chegada` (Importação); `obras-alerta-sem-envio-diario` e `evolucao-alerta-felipe-diario` (Obras); `ci-lembretes-assinatura` (Contrato do Instalador); `importacao-varejo-alerta-dia-d` (Importação Varejo). Decisão a tomar: PC-7 é "jobs do Geral" ou "todos os que alimentam alertas".

### PC-8 Tabelas comuns
| Tabela | Linhas (31/10/2026) | Telas |
|---|---|---|
| `alertas` | 574 (223 abertas) | 1.1, 1.2, 1.4 |
| `notificacoes_lidas` | 137 | 1.2 |
| `decisoes_gerenciais` | 72 | 1.3 |
| `gatilhos` | 202 | 1.1, 1.4 |
| `eventos_fluxo` | 506 | 1.4 (+ Linha do Tempo) |
| `fluxo_pendentes` | 9 | PC-3 |
| `emails_projeto` + `inbox_*` | 133 | 1.5 |
| `vp_logs` | 3.078 | todas |
| `tarefas` | 9 | 1.1 |
| `calendario_feriados` | 48 | 1.4 (prazos) |
| `alcadas_capacidade` (1.834), `perfis` (49) | — | 1.3, 1.5, todas |

### PC-9 Padrões de navegação, cache e testes
- **Navegar entre páginas** a partir de um componente: `setSubsel(...)` + `setRoute(...)` recebidos por prop; `VpRouter.navigate()` sozinho só reescreve a URL. Estado que o usuário quer recarregar ou compartilhar vai para a URL com `useRotaId`, `useRotaItem`, `useRouteTab` ou `useQueryParam` (`router.js`, `rota-pcp.js`); janelas de confirmação ficam fora da URL de propósito.
- **Modais pela URL (varredura de 09/10/2026 e correção de 11/10):** `navigate()` dispara o evento `vp:navigate` e os hooks de `rota-pcp.js` o escutam; sem isso o modal aberto por link não aparece. O `App` **não** escuta esse evento. Quando uma tela precisa de dois slots (ação e id) e só sobra um segmento livre, codifica-se `"<ação>:<id>"` (usado no Almoxarifado/Estoque e na Importação Varejo; `decisoes.jsx` usa `rotaId` e `tipoModal`). Ficam de fora, de propósito, estado efêmero (prévia do "Gerar OPs", expandir linha de tabela, detalhe aninhado só de leitura). Mecanismo: `useRotaItem(rota, aba)` (3º segmento) e `useRotaId(rota)` (2º).
- **Cache-busting:** todo arquivo editado ganha `?v=` novo no `index.html` (e em `assinar.html`, `cotacao-elevador-fornecedor.html` e `formulario-cliente.html` quando carregam o arquivo); o CI barra esquecimento (`scripts/check-cache-bust.js`).
- **Rota com pasta/visão no 2º segmento e e-mail ou id no 3º (Inbox, 31/10/2026):** `/geral/inbox/<pasta>[/<id>]`. O `App` entrega o 2º segmento como `subsel` e **reescreve a URL a partir dele**, então a tela deve manter o `subsel` igual ao 2º segmento (`setSubsel`) toda vez que escreve a URL, e gravar o 3º segmento por conta própria (o `App` o preserva). Mantém-se o formato antigo (`/<id>` e `?pasta=`) como entrada e regrava-se no formato novo. Visão de tela sem id (`useRouteTab`, como o Gantt/Lista/Kanban do Dashboard) é o caso simples; o caso do Inbox só é preciso quando o 2º segmento já era ocupado por um id.
- **Testes:** `npm test` (unitários, `scripts/run-tests.js`) e `npm run test:e2e` (Playwright, Supabase simulado: nunca toca produção). **Rodar o e2e neste ambiente de sessão (Conferido em 31/10/2026):** o `package.json` fixa `@playwright/test` 1.56.1, que procura o Chromium 1194, mas o ambiente traz o 1243 em `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`; sem `executablePath` todos os testes falham com "Executable doesn't exist" (não é erro do código). Use um arquivo de configuração temporário que estenda `playwright.config.js` com esse `executablePath` e `--no-sandbox`, e apague-o depois. Com 4 workers o primeiro teste de cada worker pode estourar o tempo (compilação do Babel); no ritmo do CI (2 workers) passou. Toda rota de `KNOWN_ROUTES` entra no teste de fumaça sozinha.
- **Ajuda:** o "?" lê `HELP_TOPICS` (`shell.jsx`) e a lista `TUTORIAIS` (`TreinamentoVP/`); tutorial desatualizado **não se corrige à mão**: pede-se à sessão de tutoriais.
- **Mapa de rotas:** `docs/MAPA_DE_ROTAS.md` é gerado por `node scripts/gerar-mapa-rotas.js` (rode depois de mexer em rotas ou abas) e confere as 5 telas de Geral (Prazos & Pendências aparece em `/adm-financeiro/financeiro`). Não se edita à mão.

- **Benefícios vindos do CRM e de Cadastros (doados em 31/10/2026, Art. 49; valem para qualquer tela de Geral que leia tabela ou mostre data):**
  - **Tabela que pode passar de 1000 linhas:** o PostgREST corta em 1000 **sem avisar**. Leia em laço com `.range(de, de + 999)` e ordem estável (por data **e** por `id`, senão a paginação repete ou perde linha); em erro mostre um cartão com "Tentar de novo", nunca uma lista parcial nem vazia fingindo estar completa. Exemplos prontos: `useLeadsBase` (`crm.jsx`) e `CadastrosClientesStore.listarTodos`.
  - **Data pura `aaaa-mm-dd`:** nunca `new Date('aaaa-mm-dd')` (vira meia-noite UTC e cai um dia no fuso do Brasil). Formate o texto direto (`isoParaDataBR` em `comercial.jsx`) ou monte a data local; o `fmtDate` global corta o ano para 2 dígitos.
  - **Hooks antes de qualquer `return` antecipado:** a tela de estado vazio fica num componente à parte e todos os hooks no componente de dentro, senão o React quebra ao alternar entre vazio e preenchido (padrão `LeadDetail` → `LeadDetailView`).
  - **Atualizar uma linha sem recarregar a tela:** devolver `atualizarLead(id, patch)` do hook de leitura evita o recarregamento total e a perda de rolagem e de janelas abertas.

- **Benefícios vindos de Cadastros Mestres (doados em 31/10/2026, Art. 49; valem para qualquer tela de Geral que grave um cadastro, gere um código ou abra um registro pelo link). Selo: Conferido em 31/10/2026 no código das duas stores e nos índices do banco; detalhe em `03_cadastros_mestres.md` (PC-4, 3.1.6 e 3.1.8):**
  - **Gravar com conferência prévia de duplicidade:** a store procura o dado único (ex.: CNPJ/CPF) em **outro** registro antes de gravar, para dizer **qual** registro já o usa; o banco reforça com **índice único parcial** (para valer com duas pessoas ao mesmo tempo ou fora da tela) e o erro `23505` do índice vira a mesma mensagem clara. Falha ao conferir = não grava; na criação a conferência roda **antes** de gerar o código, para não gastar número.
  - **Código humano pela sequência do banco, sem reserva fixa:** nunca "maior código + 1" lido no navegador (duas pessoas ao mesmo tempo geram o mesmo) nem um código constante quando o banco falha (colide sempre); a falha vira erro claro. Exemplos: `gerar_codigo_cliente` e `gerar_codigo_fornecedor`.
  - **Link para um registro que não existe:** mostrar aviso ("não encontrado", com "Voltar à lista") em vez de abrir a tela como se fosse "Novo"; se a lista veio incompleta, o aviso diz isso.
- **Benefícios vindos de Comercial | Pré-venda (doados em 31/10/2026, Art. 49; texto completo em `04_comercial_pre_venda.md` 4.1.8, 4.5.10 e PC-4). Selo: Conferido em 31/10/2026 no código e na lista de gatilhos do banco:**
  - **Identidade protegida por gatilho do banco:** o Formulário fixa `id`, Nº, data, dono e vendedor num gatilho `BEFORE UPDATE` (`fn_formularios_elevador_protege`), não só pela tela. Vale para toda tabela cujo código/`id` "nunca muda".
  - **Trava com destrave por motivo:** ação travada por regra de negócio; destrave só por alçada de Líder, motivo obrigatório de 10 letras ou mais, aviso ao dono e registro em `vp_logs` (Formulário e Proposta).
  - **Lista cortada em silêncio:** a lista de Propostas pede 300 linhas e o banco tem 340. Ler em páginas de 1.000 e avisar quando a lista veio incompleta.
- **Benefícios vindos de Financeiro & Preços (doados em 31/10/2026, Art. 49; texto completo em `05_financeiro_precos.md` PC-12). Selo: Conferido em 31/10/2026 no código:**
  - **Vocabulário único de status:** o mesmo conceito com três grafias ("Aguardando", "Aguardando aprovação", "Paga"/"Pago") quebra KPI que compara texto (1.1.10 item 7). Antes de comparar status por texto, conferir o que o gravador realmente escreve.
  - **Botão de aprovação sem conferir quem aprova:** "Aprovar (diretoria)", "Dar Aval" e "Aprovar" são regras do navegador; a alçada existe no catálogo e a tela não a confere. Vale para qualquer tela de Geral com decisão (1.3).
  - **Botão que parece ação e só muda status:** "Pagar" não paga e "Reprovar" não bloqueia; o rótulo deve dizer o que o botão realmente faz.
- **Benefícios vindos de Contratos & Jurídico (doados em 31/10/2026, Art. 49; texto completo em `06_contratos_juridico.md` PC-12). Selo: Conferido em 31/10/2026 no código e no banco:**
  - **Rota restrita a um perfil que o seletor não oferece:** `aval-juridico` está em `RESTRICTED` como `["juridico","admin"]`, mas o `ROLE_MAP` não tem "juridico"; só o Administrador abre. Conferir as demais rotas de `RESTRICTED` contra o `ROLE_MAP`.
  - **Nome de alçada diferente entre o catálogo e a política do banco:** a política de exclusão de `contratos_venda_equipamentos` pergunta por `contratos_venda_equipamentos` e as concessões estão em `contrato-venda-equipamentos`; a concessão não vale. Conferir os nomes em `vp_tem_capacidade('…')` das demais políticas.
  - **Função que regrava depois do fechamento:** `updateFormState` do contrato atualiza `doc` e `form_state` sem olhar o status e sem conferir o erro; vale procurar `update` sem filtro de estado em outras stores.
  - **Data de documento remontado:** "Guarulhos, <hoje>" sai do relógio na montagem; reabrir um documento antigo mostra a data de hoje.
- **Benefícios vindos de Suprimentos & Importação (doados em 31/10/2026, Art. 49; texto completo em `07_suprimentos_importacao.md` PC-12). Selo: Conferido em 31/10/2026 no código e no banco:**
  - **Leitura que falha vira "zero" em silêncio:** o Painel de Importação faz `catch → listas vazias` e mostra "0" como se não houvesse nada (Art. 9). Vale procurar `catch(() => set…([]))` nas telas de leitura e nos painéis.
  - **Duas fontes da mesma coisa:** `embarques` × `embarques_importacao`, RFQ antiga × lote de varejo, duas avaliações de fornecedor. Registrar qual manda e qual é espelho.
  - **Comentário de código que contradiz o comportamento:** o cabeçalho de `cotacoes-varejo.jsx` ainda descreve a aprovação como "Requisição ao Omie" quando hoje gera P.I. em rascunho. Conferir comentários de cabeçalho ao revisar uma tela.

- **Benefícios vindos de Engenharia & Produto (doados em 01/11/2026, Art. 49; texto completo em `08_engenharia_produto.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **O código grava colunas que o banco não tem:** `engenharia-config.jsx` manda `projeto_pdf_recebido`/`projeto_pdf` para `equipamentos_spec`, que não as tem; teste de unidade e compilação não pegam. Conferir payload × `information_schema.columns`.
  - **Alçada declarada e nunca lida:** conferir se a **ação** do catálogo (criar/editar/excluir) é checada no código, não só o nome do módulo.
  - **Filtro que recarrega com o valor antigo:** `setFiltro(v); recarregar()` lê o estado da renderização anterior.
  - **Dois marcadores do mesmo fato** (etapa da ficha × data de publicação no Omie, 1 × 93) e **vista decidida por `useState`** (o Voltar do navegador não volta à lista): procurar nas telas do Geral.
- **Benefícios vindos de Obras & Instalação (doados em 01/11/2026, Art. 49; texto completo em `09_obras_instalacao.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Regra copiada em JS e em SQL exige teste de paridade:** a "Evolução" tem a mesma regra nas duas linguagens e `evolucao-conferir-paridade.test.js` falha se uma mudar sozinha; vale o mesmo para qualquer regra espelhada em função do banco.
  - **Identificador gravado e imutável por gatilho:** `dossier_obra.codigo_obra` nasce uma vez e outros módulos o citam; não depende de cálculo ao vivo.
  - **Cobrança automática precisa de pausa legítima com prazo e motivo** (até 60 dias, motivo escrito): sem isso a pessoa cobrada passa a ignorar o aviso. Aplicável aos alertas de prazo (1.4).
  - **Texto de estado que diz o contrário do estado** (Dossiê: "BLOQUEADO — pendência bloqueante resolvida", 9.1.8): ler o texto com o dado ao lado.
- **Benefícios vindos de Entrega & Documentação (doados em 01/11/2026, Art. 49; texto completo em `10_entrega_documentacao.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Página pública que passa a falar por RPC precisa levar junto os efeitos que rodavam no navegador:** a Proposta e os Contratos usam a fila `fluxo_pendentes` (PC-3 deste documento); o Termo de Entrega foi migrado sem ela e o evento `TERMO_ASSINADO` não é mais emitido. Ao migrar uma página pública, listar os efeitos antigos (evento, aviso, PDF) e conferir cada um.
  - **Lista de chaves de evento copiada no SQL deve ser conferida contra o motor:** `_evt_modulo_etapa` tem `DATA_BOOK_MONTADO`, que não existe (o nó é `DATABOOK_MONTADO`), e `POS_VENDA_ATIVADO` cai no ramo padrão "Comercial". Vale um teste que compare as duas listas, como o de paridade do 9.
  - **Conferir o uso real antes de documentar "como funciona":** 0 handovers, 0 termos digitais e 0 documentos no repositório mostram um fluxo digital que ninguém usa.
  - **Botão que cria não deve poder ser disparado de novo sobre um registro existente, e ação de topo sem seleção deve avisar;** campo com exemplo usa *placeholder*, não valor inicial gravado como dado.
- **Benefícios vindos de Parceiros & Instaladores (doados em 01/11/2026, Art. 49; texto completo em `11_parceiros_instaladores.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Status gravado em coluna a partir de uma data precisa de recálculo:** o `VALIDO` da homologação de montadores nunca vira `VENCIDO` sozinho (8 casos hoje). Vale para qualquer "vencido" derivado de data, inclusive alertas de prazo (1.4).
  - **Portão de aprovação deve falhar fechado:** o pagamento de parcela ao instalador só confere a decisão se o store existe (`if (window.DecisoesStore)`); sem ele, passa. O portão da compra (5) já bloqueia quando não consegue ler.
  - **Dado pessoal em migration e em documento versionado (Art. 28):** telefones de pessoas estão em uma migration e em `docs/eventos/vphub-instalador.md`; seeds de destinatários de aviso (`decisao_whatsapp_numeros`) devem vir de fora do repositório.
  - **Dois caminhos de pagamento para a mesma coisa:** parcelas do Contrato (com aprovação do Gestor Comercial) e Cronograma de Pagamento (manual, sem aprovação, tabela aberta e vazia). Quem aprova o quê está em `11_parceiros_instaladores.md` PC-5.
  - **Comentário de código que contradiz a produção:** o comentário de `omie_sync_pagamentos_instaladores` diz `verify_jwt:false`; a função em produção (v30) tem `verify_jwt: true`. Conferir com `list_edge_functions` antes de confiar em comentário.
- **Benefícios vindos de Logística Interna (doados em 01/11/2026, Art. 49; texto completo em `12_logistica_interna.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Escrita no Omie em dois passos:** o ajuste de estoque só é gravado no Omie depois de **Confirmar** (decisão) e de **Enviar** (resumo + `confirm()`), com chave determinística que impede lançar duas vezes. Padrão para qualquer escrita real no ERP.
  - **Estado calculado em vez de novo valor de coluna:** a separação "parcial" é derivada (pendências abertas), sem mexer no CHECK de `status` que o celular também usa. Vale quando outro sistema compartilha a coluna.
  - **Parâmetro que decide compra não pode ficar aberto:** `pcp_reposicao_config` aceita UPDATE de `anon`/`authenticated`. Tabela de parâmetro, custo ou preço deve nascer fechada (Art. 26).
  - **Afirmação de documento antigo envelhece:** o `CLAUDE.md` dizia que nenhum ajuste fora enviado ao Omie; o banco tem 2 enviados. Conferir no banco antes de repetir "ainda não foi feito".
  - **Link como senha:** a página pública da TV da Separação é entregue por token revogável; o mesmo vale para os demais links públicos.

- **Benefícios vindos de Fabricação (doados em 01/11/2026, Art. 49; texto completo em `13_fabricacao.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Tabela que guarda token de link público não pode ter leitura pública:** `fabricacao_quadro_links` tem SELECT/INSERT/UPDATE para `public`, então qualquer um lista os tokens; o padrão certo é o de `fab_*` (tabelas fechadas + RPC `public_*` por token). Vale para todo link público (Diário, Status da Obra, recibo, assinatura).
  - **Duas telas para o mesmo trabalho criam duas verdades:** o quadro pode ser acompanhado no MES (12 etapas) e na Evolução do Quadro (6 etapas); 24 OPs de quadro, 1 no MES. Antes de criar tela nova, decidir se substitui a antiga.
  - **Contar linhas antes de chamar de "pronto":** `pcp_roteiro` 0, `fiacao_fios` 0, `mes_nc` 0, `mes_testes` 0, `fab_ocorrencias` 0; tela existe, dado não. O documento diz o que foi exercitado.
  - **Comentário de cabeçalho envelhece com o menu:** vários arquivos de Fabricação ainda dizem "Logística Interna". Ao reagrupar menu, grep nos cabeçalhos.
  - **Regra de filtro que protege relatórios:** OP sem `produto` é ignorada em Planejamento, Controle, Carga Máquina e relatórios de Produção/Perdas; consulta nova de produção mantém esse filtro.

- **Benefícios vindos de Administração (doados em 01/11/2026, Art. 49; texto completo em `14_administracao.md` PC-12). Selo: Conferido em 01/11/2026 no código e no banco:**
  - **Log de auditoria aberto não é prova:** `vp_logs` aceita INSERT e SELECT da chave pública; qualquer tela que use o log como evidência deve dizer isso até a tabela ser fechada.
  - **Tela que parece configuração e é texto no código:** Parâmetros, Permissões, Integrações e Buckets (Configurações) são fixos; antes de confiar num número de tela de admin, conferir se ele é lido do banco.
  - **Lista de recursos no código envelhece:** a tela de Buckets mostra 6 dos 11 buckets reais. Listar do banco (`storage.buckets`), não do código.
  - **Decisão de segurança precisa de conferência periódica:** D4 (só um bucket público) não se cumpriu; 4 buckets são públicos. Registrar decisão não é cumpri-la.
  - **Função em produção sem pasta no repositório** (`conferir-clientes-omie`) viola o Art. 23; conferir `list_edge_functions` × `supabase/functions` antes de tratar o repositório como a fonte.

### PC-10 Menu "?" (Ajuda, Treinamento, Enviar feedback)
*(Migrado do CLAUDE.md em 31/10/2026; arquivos conferidos agora, regras vindas do CLAUDE.md.)*
- Círculo "?" no canto superior direito de **todas as telas** (`AjudaSuporte` em `src/ajuda-suporte.jsx`, desenhado pelo `Header` de `shell.jsx`). Dica nativa "Suporte". Itens: **Ajuda** (texto da tela em `HELP_TOPICS[rota]`, mais perguntas frequentes), **Treinamento** (abre o tutorial da tela; sem tutorial na lista `TUTORIAIS`, fica apagado "Em breve") e **Enviar feedback**.
- **"?" do módulo na barra lateral:** o título do grupo (ex.: Geral, CRM, Cadastros Mestres) tem seu próprio "?", que abre direto o tutorial do módulo em nova aba. Lista `MODULOS_TUTORIAL` em `shell.jsx` (hoje 5 grupos: Geral, CRM, Cadastros Mestres, Comercial | Pré-venda e Financeiro & Preços); grupo sem linha não tem "?". Tutorial novo de módulo = copiar a página para o Git + 1 linha em `MODULOS_TUTORIAL` + subir o `?v=` do `shell.jsx`.
- **Tutorial novo de tela** = copiar `TreinamentoVP/<pasta>/index.html` para o Git + 1 linha em `TUTORIAIS` + subir o `?v=`. **Só o `index.html` vai ao Git** (`PUBLIC_DIRS` em `server.js` libera a pasta `TreinamentoVP` inteira como estático, então `img/`, `roteiro.json`, `demo.json`, `README.md` e `LEIAME.md` ficariam públicos). Tutorial só leva dado **fictício** (`@exemplo.com`), nunca cliente, CNPJ, valor ou e-mail reais. Os tutoriais são abertos sem login.
- **Tutorial não se corrige sozinho.** Mudou uma tela que tem tutorial? Avise o Gelson para a sessão de tutoriais regenerar; **não edite o HTML à mão**. `npm run tutoriais:conferir` (`scripts/conferir-tutoriais.mjs`) aponta desatualizado (arquivo da tela mudou depois do "Atualizado em"), dado real no texto, link relacionado quebrado e tutorial pronto fora do menu. Pasta nova entra em `TELAS` do script.
- **Enviar feedback:** formulário guiado (tipo Erro/Dúvida/Sugestão, gravidade, resumo, o que fazia/aconteceu/esperava, texto livre) que vira **issue do GitHub**. Fluxo: navegador → `POST /api/feedback` (`server.js`, lógica em `server-lib/feedback-issue.js`) → GitHub; **o token nunca vai ao navegador**.
  - Variáveis no Hostinger: `GITHUB_TOKEN` (fine-grained, só "Issues: Read and write" no repositório) e, opcional, `GITHUB_FEEDBACK_REPO` (padrão `verticalpartsIA/010_GestaoImportacao`). Sem token a rota responde 503 "ainda não foi ativado". `FEEDBACK_DRY_RUN=1` só monta a issue (teste local).
  - **Se falhar,** leia o log de runtime do Hostinger (procure `[feedback]`): traz o status do GitHub e o diagnóstico (`permissao_exigida`, `conta_do_token`, `repositorio_status`). `403` com `repositorio_status` 200 = falta Issues: Read and write. O valor do token nunca vai ao log.
  - **Privacidade:** a issue leva **só o primeiro nome** do colaborador, nunca o e-mail; `@menções` e `#números` do texto livre são neutralizados. Linha "Endereço da tela" com a URL (origem vinda do servidor, nunca do formulário).
  - **Triagem:** etiquetas `feedback`, `aguardando-gestor`, tipo, `gravidade:<…>`, `tela:<rota>`. O gestor troca `aguardando-gestor` por `pronto-para-claude`; a sessão do Claude **só resolve issue com `pronto-para-claude`**.
  - Limites: 5 por IP a cada 10 min e 60 no total por hora; origem precisa ser o próprio site. Os mínimos de letras do formulário têm de bater com `validar()` em `server-lib/feedback-issue.js`. Testes: `src/feedback-issue.test.js`.
- **Estado dos tutoriais de Geral (revisão de 31/10/2026):** os 5 de `TreinamentoVP/geral/*` estão desatualizados (todos "Atualizado em 10 de outubro de 2026", Notificações em 04/10, e as telas mudaram em 30–31/10); nenhum tem dado real; a visão do módulo `geral/index.html` não é conferida pelo script. **Falha de cobertura do `scripts/conferir-tutoriais.mjs`** (mapa `TELAS`): `geral/notificacoes` só observa `notificacoes-processamento.js` e `notificacoes-lidas-store.js` (não a `NotificacoesPage` em `financeiro.jsx`), `geral/prazos-e-pendencias` só `gatilhos-engine.js` (não `FinanceiroPage`) e `geral/dashboard` só `dashboard.jsx` (sem `dashboard-metrics-*.js` nem `supabase.js`): mudança só nessas partes não acende "DESATUALIZADO". A correção do script é tarefa de código.
- **Textos de ajuda do "?" defasados (só relato; corrigir é código):** Dashboard (`shell.jsx`) não cita Pipeline, Conversão por Origem, Onde Parou nem "Visualizando como", e diz "tarefas de hoje"; Notificações não avisa que as Preferências valem só no navegador nem que atingem os avisos calculados; Decisões lista só "envio de proposta, desconto, compra, montador" (faltam pagamento a instalador, contratação de mão de obra, compra de varejo e "Pedir decisão"), descreve "Bloqueada" que quem não é administrador não vê e não fala de Cancelar nem de "Solicitar novamente"; Prazos diz "às 7h20 todo dia útil" e "só duas ações dependem de uma pessoa"; Inbox não cita Pedir decisão, Extrair preço, CC, a janela Escrever nem o ⚙. O caminho do topo mostra "Dashboard / Visão Geral", "Notificações / Central de Alertas" e "Financeiro / Prazos & Pendências" (o menu agrupa tudo em "Geral"); `print-app.jsx` ainda lista "Gatilhos & Prazo".

### PC-11 Documentos soltos e pendências comuns
- **`docs/governanca-matriz.md`** (14/08/2026) estava desatualizado em relação ao motor (SLA de 48 h do fornecedor, Precificação 5 h, cliente 15 dias; sem os nós de aval jurídico, projeto, importação e instalação). O que valia nele foi absorvido em PC-12 e 1.4.6; o arquivo foi **excluído do disco em 31/10/2026** (decisão do Gelson) e continua no histórico do Git.
- **Spec e plano de 17/09/2026 do WhatsApp da Central de Decisões e `docs/eventos/vphub-aval-whatsapp.md`:** o desenho não foi o implementado (ver 1.3.11); o aval do instalador por WhatsApp está em 1.3.8. Os três arquivos foram **excluídos do disco em 31/10/2026** (decisão do Gelson; o último trazia telefone pessoal e exemplo de chamada com chave, num repositório público); continuam no histórico do Git.
- **`docs/seguranca/*` e o plano #571:** pertencem ao módulo 14 Administração; aqui só PC-6 aponta para eles.
- **Pendência comum (Gelson):** decidir se o aviso diário de prazos (1.4), as notificações de decisão (1.3) e os alertas do Inbox (1.5) continuam todos como alertas separados ou se algum vira resumo, já que 107 dos 223 avisos abertos são do Almoxarifado e o excesso esconde o que importa.
- **Outros documentos que tocam o Geral e ficam onde estão:** `docs/seguranca/*` e o plano #571 (módulo 14); `docs/revisoes/00…03` (módulos 4 e 6; branch ainda não mesclada); `docs/eventos/vphub-instalador.md` (módulo 11); `AUDITORIA_FORENSE_E2E_SCORE.md` (linha de base do Guardião); `docs/MAPA_DE_ROTAS.md` (gerado); `README.md` (texto defasado em Gatilhos & Prazo e Inbox: corrigir o texto, não absorver).
- **Serviços (01/11/2026):** o bloco do gi-avisos do PC-4, as regras de `.claude/gi-avisos-regras-whatsapp.md` e a parte de canal do 1.5 foram concatenados em `docs/modulos/15_servicos.md` (decisão do Gelson); aqui ficaram ponteiros. **Recebido de Serviços:** todo alerta dirigido também vira WhatsApp; para chegar certo, título curto, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.


### PC-12 Governança: departamentos, auditoria e lacunas
*(Absorvido de `docs/governanca-matriz.md`, de 14/08/2026, hoje excluído do disco e no histórico do Git; o que era sobre SLA e cadeia foi substituído por 1.4.6, PC-2 e o próprio motor.)*
- **Departamentos × telas (resumo):** Comercial (Leads, Formulário, Proposta); Engenharia (Projeto de Elevadores, Vistorias); Financeiro (Precificação, Aval Financeiro); Jurídico (Contrato de Venda); Compras/Importação (Cotações a fornecedor, Logística); RH (Homologação); Parceiro Instalador (Contrato do Instalador); Cliente (portal público `assinar.html`).
- **Quem aprovou o quê (trilha de auditoria):** `eventos_fluxo` (todo nó que nasceu ou fechou, com data); `avais_financeiros` (`aprovado_por`/`aprovada_em`); `precificacoes_elevador` (`aprovado_por`/`aprovado_em`); `propostas` e `contratos_venda_equipamentos` (`signed_at`, `log`, `audit` com IP, hash e protocolo da assinatura digital); `comissoes` (`aprovador_necessario` quando a comissão passa do limite de alçada); e `vp_logs` (PC-5).
- **Status mestre do Dossiê da Obra** (`dossier-obra.jsx`): Lead qualificado → Dossier criado → Análise técnica → Precificação → Proposta enviada → Contrato assinado → Importação → Homologação do instalador → Instalação → DataBook → Entregue → Manutenção. O Dossiê é auto-provisionado no Contrato de Venda (`garantirDossier()`).
- **Gargalos que o Dashboard Admin sinaliza** como alerta crítico: proposta assinada sem contrato, contrato com valor zerado, sinal pago sem contrato (1.1.8).
- **Lacunas conhecidas (de 14/08, sem reconferir agora):** a homologação de RH não trava a mobilização do instalador (issue #9); não há um campo único "D0" de entrega, só a cadeia de prazos por etapa (issue #6); o checklist de documentos da obra (ART, Termo de Vistoria, DataBook, Termo de Entrega) é indicativo e não bloqueia o contrato nem o DataBook. A geração de comissão (só depois da proposta assinada, com trava de alçada) pertence ao módulo 5; RH e Instalação ao módulo 11; Dossiê ao módulo 9 e DataBook ao módulo 10 (corrigido em 01/11/2026: o texto antigo punha o Dossiê no 10).