# Módulo Geral — especificação técnica

> Mapeamento read-only feito em 31/10/2026 a partir de `src/shell.jsx`, `src/app.jsx`, `src/router.js`, `src/dashboard.jsx`, `src/financeiro.jsx`, `src/decisoes.jsx`, `src/gatilhos-engine.js`, `src/logistica.jsx` e `src/inbox-*.jsx`, cruzado com as seções do `CLAUDE.md` e com `docs/MAPA_DE_ROTAS.md`. Nenhum código da aplicação foi alterado. Complementa `docs/modulos/02_crm.md`.

## 1. Visão geral e propósito

O **Geral** é a torre de controle do VP Gestão: não produz dado de negócio próprio, **lê tudo o que os outros módulos geram** (Cotações, Propostas, Contratos, Dossiês, PCP, Importação, e-mail) e devolve três coisas: *o que está atrasado* (Prazos & Pendências), *o que precisa de uma pessoa decidir* (Central de Decisões) e *o que mudou* (Notificações, Dashboard, Inbox).

Menu lateral (`NAV_GROUPS` em `shell.jsx`, linhas 15–19), grupo "Geral":

| Item do menu | id/rota | Endereço | Componente | Arquivo | Restrição de menu |
|---|---|---|---|---|---|
| Dashboard | `dashboard` | `/geral/dashboard` | `Dashboard` | `dashboard.jsx` | — |
| Notificações | `notificacoes` | `/geral/notificacoes` | `NotificacoesPage` | `financeiro.jsx` | — |
| Central de Decisões | `decisoes` | `/geral/decisoes` | `window.DecisoesPage` | `decisoes.jsx` | — (badge de pendentes, atualiza a cada 3 min e no evento `vp:decisoes`) |
| Prazos & Pendências | `financeiro` | `/adm-financeiro/financeiro` | `FinanceiroPage` | `financeiro.jsx` | `financeiro`, `admin` |
| Inbox | `inbox` | `/geral/inbox` | `EmailInbox` | `logistica.jsx` + `inbox-*.jsx` | — |

Observações de nomenclatura: "Prazos & Pendências" era "Gatilhos & Prazo" (renomeada em 03/10/2026; o `id` de rota e de alçada continua `financeiro` e a URL fica sob `/adm-financeiro/`, **não** `/geral/`). O "?" do módulo na barra lateral abre o tutorial `geral` (`MODULOS_TUTORIAL`).

## 2. Mapeamento de rotas, abas e navegação por URL

Regra comum: o roteador (`router.js`) usa só o 2º segmento como rota; 3º/4º segmentos são aba/id lidos por hooks (`rota-pcp.js`: `useRotaId`, `useRotaItem`; `router.js`: `useRouteTab`). `VpRouter.navigate()` dispara `vp:navigate` e os hooks escutam. **O App não escuta esse evento** — para trocar de página de dentro de um componente use sempre `setSubsel(...)` + `setRoute(...)` (ver área blindada da Central de Decisões).

### 2.1 Dashboard — `/geral/dashboard[/<id do projeto>]`
- `Dashboard({ role, setRoute, setSubsel })` (`dashboard.jsx:175`), renderizado em `app.jsx:359`.
- Conteúdo: KPIs por papel (`dashboard-metrics-comercial|financeiro|engenharia|admin.js`), **Gantt** de fases por cotação (`dashboard-metrics-gantt.js`, `FASE_POR_NODE`), widget **"Onde Parou"** (lê `gatilhos`), atalhos para Notificações.
- Modal de detalhe do projeto reflete a URL: `window.useRotaId('dashboard')` (`dashboard.jsx:184`) — deep-link, F5 e Voltar/Avançar funcionam.
- Alertas do Dashboard (`supabase.js`) filtram por destinatário como a Central; leads com `excluido_em` não contam.

### 2.2 Notificações — `/geral/notificacoes[/<aba>[/<id do aviso>]][?modulo=<módulo>]`
- `NotificacoesPage({ setRoute })` (`financeiro.jsx`), `app.jsx:418`. Abas Todas / Não lidas / Arquivadas (arquivar é **por pessoa**, `notificacoes_lidas.arquivada`). Desde 31/10/2026 a aba (`nao-lidas`, `arquivadas`; Todas deixa a URL limpa), o aviso aberto e o filtro de módulo ficam na URL.
- Fonte única de leitura: `NotificacoesLidasStore.carregarAlertas()/visiveis()/useNaoLidas()` (`notificacoes-lidas-store.js`) — usada também pelo sino do cabeçalho (`SinoNotificacoes`, `shell.jsx`; atualiza a cada 5 min e no evento `vp:notificacoes`). **Não duplicar essa leitura.**
- Regras puras em `notificacoes-processamento.js`: `categoriaDe`, `visivelPorPreferencia` (Financeiro/Operações/Comercial ocultáveis; **Jurídico e Central de Decisões nunca somem**), `urlSegura(rota, isKnownRoute)` (só aceita caminho relativo de rota conhecida — recusa `https://`, `//`, `javascript:`).
- "Abrir origem" navega pelo campo `alertas.rota` (preenchido pelo produtor ou, na falta, pelo trigger `trg_alertas_rota_padrao`/`alertas_rota_por_id` pelo prefixo do id). **Novo produtor de alerta com prefixo de id novo → acrescentar em `alertas_rota_por_id`.** Módulos sem rota própria caem em `ROTA_POR_MODULO`.
- Expiração automática: cron `alertas-expirar-diario` (10:30 UTC) — `info` > 14 dias e demais > 45 dias viram `resolved = true`.

### 2.3 Central de Decisões — `/geral/decisoes[/<id da decisão>/<tipo de modal> | /decididas[/<id>]][?tipo=&q=]`
- `DecisoesPage({ setRoute, setSubsel })` (`decisoes.jsx`), `app.jsx:419`.
- Desde 31/10/2026 a aba **Decididas** (`/decididas`, Pendentes deixa a URL limpa), o cartão destacado (`/decididas/<id>`), o filtro por tipo (`?tipo=`) e a busca (`?q=`) ficam na URL; o modal de aprovar/reprovar/cancelar vem de `useRotaId('decisoes')` + `useRotaItem('decisoes', rotaId)` desde 09/10.
- Busca, filtro por tipo, atualização a cada 60 s, modal de aprovação com resumo + comentário opcional, **Cancelar** (só Administrador, motivo obrigatório), **Solicitar novamente** (reabre a MESMA linha; histórico em `contexto.reaberturas`).
- Tipos de decisão (`decisoes-store.js`): `envio_proposta_gestor`, `envio_proposta_ceo` (CEO só quando `margemEfetivaPct < 0,15` ou desconhecida — `LIMITE_MARGEM_SEM_CEO`), `compra_equipamento_ceo`, `desconto_proposta`, varejo (`pedidos_compra_varejo`), `contratacao_mao_obra_ceo`, RH de montadores (aprovadores → Arilene), `inbox_decisao` ("Pedir decisão" a partir de um e-mail).
- Status: `pendente`, `bloqueada`, `aprovada`, `reprovada`, `cancelada`. Reprovar cancela quem dependia (`MOTIVO_DEPENDENCIA_REPROVADA`); aprovar/reprovar são atômicos (`.eq('status','pendente')`).

### 2.4 Prazos & Pendências — `/adm-financeiro/financeiro[/<filtro>[/<Nº da cotação>]]`
- `FinanceiroPage({ setRoute, setSubsel })` (`financeiro.jsx`), `app.jsx:410`. Sem abas; o 2º segmento é o filtro das cadeias (`atrasada`, `andamento`, `rascunho`, `fim`, `todas`) e o 3º a cotação aberta (desde 31/10/2026, #1214 D.5).
- KPIs reais (etapas em andamento, com prazo estourado, ação do Financeiro, formulários sem envio), cadeias por cotação com filtros (Atrasadas / Em andamento / Formulário sem envio / Concluídas / Todas) e busca por Nº, ordenadas pelas mais atrasadas; alertas abrem `alertas.rota` via `urlSegura`.
- Ações do Financeiro: **"Dar Aval de Pagamento"** (`ModalConfirmarAvalPagamento` → evento `AVAL_PAGAMENTO_CONFIRMADO`), "Confirmar Boleto Pago", gatilhos avulsos (card só aparece se houver), "Exportar fluxo" (todas as etapas).
- Motor: `gatilhos-engine.js` (ver seção 4).

### 2.5 Inbox — `/geral/inbox[/<id do e-mail>][?pasta=&q=]`
- `EmailInbox({ setRoute, setSubsel, subsel })` (`logistica.jsx:1632`), `app.jsx:360`; `inbox` está em `SYNC_PASSTHROUGH_ROUTES` (`app.jsx:157`), então o `subsel` **é** o id do e-mail (link direto abre o e-mail; se não estiver carregado, pesquisa o assunto no histórico). Abertura centralizada no helper `abrirEmail`. Desde 31/10/2026 a pasta (`?pasta=`, Caixa de entrada deixa limpo) e a pesquisa (`?q=`) também ficam na URL.
- Camadas (todas sobre o transporte blindado):
  - **Triagem por regras** (`inbox-triagem-calc.js`, `inbox-triagem.jsx`): classifica entrada em assunto/departamento/urgência/reclamação (`emails_projeto.ia_*`, função SQL `inbox_classificar`, regras em `inbox_regras`); faixa "Precisa de você", automáticos ocultos (confiança ≥ 0,75; nunca apaga).
  - **Dono e visibilidade** (`inbox-visibilidade.js`): `dono_email`, `atribuido_a`, alçadas do módulo `inbox` (`ver`, `criar`, `editar`, `excluir`, `ver_todos`, `ver_equipe`, `ver_departamento`, `ver_area_*`, `triagem`, `excluir_de_outros`). Falha ao carregar = mostra tudo (fail-open).
  - **Layout estilo Gmail** (`inbox-gmail.jsx`, `inbox-busca-calc.js`): pesquisa por operadores, densidade, painel de leitura, janela Escrever flutuante.
  - **Organização** (`inbox-organizar*.js(x)`): Arquivar, Suspender, Spam (compartilhado; **e-mail enviado ligado a cotação/documento nunca vira spam**), Marcadores.
  - **Histórico** (`inbox-historico.jsx` → `inbox_buscar_historico`), **Conversas** (`inbox-conversas*`), **Sugestão de vínculo** (`inbox_sugerir_vinculo`), **Pedir decisão** (`inbox-decisao.jsx`), **Extrair preço** (`inbox-preco*.js(x)`, grava no formato do formulário do fornecedor só após confirmação humana).
- Realtime (PR #417): assina Postgres Changes em `emails_projeto` (INSERT de entrada) só para rechamar `carregar()`.

## 3. Matriz de herança e doação de dados

**O Geral herda (lê)**
| De | O quê | Onde é usado |
|---|---|---|
| Comercial / Formulário / Propostas / Contratos | `formularios_elevador`, `propostas`, `contratos_venda_equipamentos`, `contratos_instalador` | Dashboard, Prazos & Pendências, Central (contexto cliente/valor/margem) |
| Precificação | `precificacoes_elevador.resultado_v2.precificacao.margemEfetivaPct` | decide se o CEO entra na decisão |
| Dossiê da Obra / Evolução | `dossier_obra`, `equipamentos_obra` | Dashboard, alertas de obra |
| PCP / Almoxarifado / Importação | `pcp_*`, `embarques*`, `pi_importacao` | alertas de compra/prazo/chegada, Gantt |
| Cadastros | colaboradores, hierarquia (`manager_id`), fornecedores | aprovadores, atribuição do Inbox |
| E-mail real | caixa `suporte@vpsistema.com` (IMAP/SMTP) | Inbox |

**O Geral doa (grava / dispara)**
- **Eventos de fluxo**: `eventos_fluxo` (via `EventosFluxo.registrar`) — ex. `AVAL_PAGAMENTO_CONFIRMADO` fecha etapa e pode fazer `COMPRA_LIBERADA` nascer.
- **Decisões**: aprovar/reprovar libera ou bloqueia gates (`DecisoesStore.podeEnviarProposta`, `podeComprarEquipamento`, `podeContratarInstalador`).
- **Alertas** para a Central de Notificações (tabela `alertas`), entregues também por WhatsApp via gi-avisos quando há `destinatario_email`.
- **Auditoria**: `vp_logs` (`VPLog.registrar`: `modulo/acao/alvo/alvo_id/detalhe`).
- **E-mail**: envio real via `send-email`, com `referencia_tipo/id` e `numero_cotacao` que alimentam badges de resposta nos outros módulos.
- **Vínculo/atribuição**: `inbox_atribuicoes` (histórico imutável), `inbox_estado_pessoa` (lido/estrela/arquivado/adiado por pessoa), `inbox_marcadores`.

## 4. Motor de gatilhos e prazos (`gatilhos-engine.js`)

- Cada etapa é um nó (`nodeByKey`) com `nasce`/`fecha` (eventos de `eventos_fluxo`), predecessor, rota e SLA (`SLA_HORAS`). Estado na tabela `gatilhos` (id `GT-<cotação>-<NÓ>`).
- Prazos em **horas úteis** (seg–sex, `somarHorasUteis`), exceto `AGUARDA_CLIENTE`/`EMBARQUE_CHEGADA` (`SLA_CALENDARIO`). `prazoEfetivo(g)`, `emAtraso`, `ehRetroativo` exportados. `garantirNo` completa etapas puladas gravando `conclusao_tipo = 'retroativo'`.
- Compra liberada (`COMPRA_LIBERADA`) exige **3 eventos**: `AVAL_PAGAMENTO_CONFIRMADO`, `AVAL_JURIDICO_APROVADO`, `PROJETO_INSTALACAO_ASSINADO` (Aval Engenharia, automático) + CEO só se margem < 15%. Gate em `AvalFinanceiroStore.podeIniciarCompra` (devolve `checagens`). Depois nasce `IMPORTACAO_A_INICIAR` até `PI_CRIADA`.
- Nós opcionais (`FIN_SCORE`, `FIN_AVAL_VENDA`) não contam como pendência.
- Versões: `gatilhos-engine.js` é carregado também em `assinar.html`, `cotacao-elevador-fornecedor.html` e `formulario-cliente.html` — **mudar o motor exige bumpar o `?v=` em todas as páginas**.

## 5. Áreas blindadas do módulo — PARE antes de editar

Se você (Claude Code, em qualquer sessão, inclusive concorrente) foi chamado para "mexer", "melhorar", "simplificar", "remover" ou "refazer" qualquer item abaixo: **informe ao usuário o que já existe e funciona e peça confirmação explícita, incluindo o risco de quebrar algo validado ao vivo.** Só prossiga depois do "sim".

### 5.1 🔒 Central de Decisões — botão "Ver documento" (23/09/2026, PR #358)
- Peças: `gerarLinkDecisao()`, `DecCard.abrirDocumento()`, props `setRoute`/`setSubsel` de `DecCard`/`DecisoesPage` em `decisoes.jsx`; em `app.jsx` a linha `case "decisoes": return <window.DecisoesPage setRoute={setRoute} setSubsel={setSubsel}/>;`.
- Regras: (a) navegar **sempre** com `setSubsel` + `setRoute`, nunca `VpRouter.navigate()` sozinho (só reescreve a URL; o estado do `App` não é avisado); (b) decisão de cotação carrega `numero_cotacao` legível, mas o formulário espera o `id` uuid — `abrirDocumento()` resolve por consulta, não passar o Nº direto; (c) `tabelaPagina` só mapeia tabela → rota existente em `KNOWN_ROUTES` e que realmente exibe o dado, senão retorna `null` (sem botão). Mapeamento atual: `formularios_elevador→formulario-elevador`, `parceiros_instaladores→cadastro-instaladores`, `contrato_instalador_parcelas→pagamentos-instalador`, `pedidos_compra_varejo→almoxarifado` (**não** `pedidos-acompanhamento`), `emails_projeto→inbox` (adicionada em 07/10/2026 com autorização).
- Exceção documentada: a aba do Almoxarifado vem da URL (`useRouteTab`).

### 5.2 🔒 Sistema de E-mail / Inbox (23/09/2026)
- Peças: `EmailInbox`/`EmailBody`/`EmailNovoModal` (`logistica.jsx`); `cadastros-fornecedores-store.js` (`listarAtivos`); Edge Functions `send-email`, `read-inbox`, `sign-email-anexos`, `suggest-email-reply`; tabela `emails_projeto` (soft-delete `excluido_em`/`excluido_por`); vínculo por `numero_cotacao` (Message-ID/In-Reply-To = `certo`, regex de assunto = `provavel`); cron `read-inbox-poll` (a cada 10 min, `timeout_milliseconds := 20000` — **não reduzir nem apagar**); Realtime de `emails_projeto`.
- **Nunca**: apagar e-mails reais da caixa IMAP (listar para o usuário apagar manualmente); invocar `cleanup-inbox-tests`; chamar `.insert()`/`.update()` sem checar `.error`; remover a checagem `SELECT` por `imap_uid` antes do `upsert` de log; trocar a checagem `if (vinculo == null)` da camada `provavel` por `numeroCotacao == null`.
- Travas de `send-email` (v16+) — **não remover nem trocar fail-closed por fail-open**: formato de e-mail (400), máx. 10 destinatários (400), allowlist (403: domínios `verticalparts.com.br`/`vpsistema.com`, `EXTRAS_PERMITIDOS`, ou endereço em `public.email_conhecidos()`), limite de taxa 25/IP e 60 globais por 10 min (429, `email_rate_check()`), falha ao consultar banco = 503. Envio legítimo com 403: cadastrar o contato, não afrouxar.
- Codificação de e-mail (denomailer 1.6.0): assunto ASCII passa direto; acentuado curto segue; **acentuado longo perde os acentos (NFD)**; corpo por `mimeContent` em Base64. **Não voltar a mandar encoded-word pronta nem corpo em QP.**
- Limite de anexo 2,5 MB (`MAX_ANEXO_TOTAL`); anexo precisa de base64 explícito; usar `extrairErroFuncao()` (o `invoke()` devolve erro genérico).
- Badges de resposta (`FEEmailRespondidoBadge`, `CVEmailRespondidoBadge`, `CIEmailRespondidoBadge`, `CfTratativasEmailRespondidoBadge`): filtram por `referencia_id` da própria linha; **não** cair no fallback por `numero_cotacao` (mistura RFQ/Proposta/Contrato da mesma cotação).
- Deploy: antes de redeployar `send-email`, testar numa cópia; publicar com CLI com bundle (a ferramenta MCP de arquivo único dá `BOOT_ERROR`); comparar produção × repo antes de publicar.
- Mudança que as camadas do Inbox (triagem, dono, organização, conversas, Pedir decisão, Extrair preço) fizeram **só no front e em tabelas/gatilhos próprios** — `send-email`, `read-inbox`, vínculo/matching e soft-delete ficaram intactos (exceto as alterações explicitamente autorizadas e documentadas no `CLAUDE.md`).

## 6. Tabelas do Supabase e migrations

| Tabela | Uso no módulo | Pontos de atenção |
|---|---|---|
| `alertas` | Notificações, Dashboard, avisos de decisão/prazos/Inbox | colunas `destinatario_email`, `rota`, `resolved`; ids determinísticos por produtor (evita repetição) |
| `notificacoes_lidas` | lido/arquivado por pessoa | `arquivada` por pessoa |
| `decisoes_gerenciais` | Central de Decisões | RLS ainda aberta (issue #571); status `cancelada` via migration `20261003230000` |
| `gatilhos` | etapas/prazos por cotação | `alvo_id` nulo em linhas "falsas" já limpas; `conclusao_tipo = 'retroativo'` |
| `eventos_fluxo` | trilha operacional | diferente de `vp_logs` (auditoria global) |
| `vp_logs` | auditoria | `detalhe` texto vira `{texto}` |
| `emails_projeto` | Inbox | `ia_*`, `dono_email/_origem`, `atribuido_a/_por/_em`, `spam_em/_por`, `excluido_em/_por`, `acordado_avisado_em`, `referencia_tipo/id`, `numero_cotacao`, `cc` |
| `inbox_atribuicoes` | histórico de atribuição | sem update/delete |
| `inbox_estado_pessoa` | lido (nulo = segue IMAP), estrela, arquivado, `adiado_ate` | por pessoa |
| `inbox_marcadores` (+ vínculo) | marcadores pessoal/equipe | filho herda alcance do pai |
| `inbox_regras` | regras da triagem | sem policy; ajustar = nova migration |
| `fluxo_pendentes` | fila de efeitos pós-assinatura executados por usuário interno (`fluxo-pendentes.js`) | só RPCs |

Migrations principais: `20261003170000_pcp_alerta_compras`, `20261003210000_pcp_alerta_prazos`, `20261003220000_alerta_resposta_inbox`, `20261003230000_decisoes_central_revisao`, `20261003240000_alerta_diario_prazos_gatilhos`, `20261003250000_decisoes_alerta_reabertura`, `20261004100000…170000` (Inbox fases 1–4B, SLA de resposta), `20261007150000_alerta_fornecedor_respondeu_tratativa`, `20261024110000_alerta_prazos_sem_sla_proposta_pronta`.

## 7. Jobs e automações

| Job | Agenda | Função |
|---|---|---|
| `read-inbox-poll` | a cada 10 min | poll IMAP → `emails_projeto` (🔒) |
| `inbox-alerta-sem-resposta` | a cada 15 min, seg–sex 08–18h BRT | `inbox_alertar_sem_resposta`: aviso após 2 h úteis (nível 2 às 4 h, soma o chefe) |
| `inbox-acordar-adiados` | a cada 10 min | avisa quando um e-mail suspenso volta |
| `alertas-expirar-diario` | 10:30 UTC | resolve alertas antigos |
| `gatilhos-alerta-prazos-diario` | seg–sex 10:20 UTC | 1 alerta global/dia com etapas vencidas |
| `decisoes-expirar-orfas-diario` | diário | cancela decisões de cotação inexistente há > 30 dias |
| Triggers | — | `trg_alertas_inbox_resposta` (resposta vinculada → alerta; Tratativa/RFQ vai individual ao vendedor), `trg_alertas_inbox_triagem`, `trg_decisoes_alertar_aprovadores`, `trg_alertas_rota_padrao` |

## 8. Regras e armadilhas conhecidas

- Alertas e filtros por destinatário são **de exibição** (leitura pública da tabela — issue #571); segurança real depende do fechamento de RLS.
- Visibilidade do Inbox é organização na tela: `read-inbox` ainda devolve a caixa inteira a quem chamar com a chave pública.
- Decisões pendentes antigas de `compra_equipamento_ceo` foram canceladas, não apagadas; aprovadores são recalculados pelo papel atual (`atualizarAprovadores`) em vez de confiar em `aprovadores_esperados`.
- "Decidir comprar" desabilitado: o motivo agora aparece como lista de todos os avais (`checagens`) acima das abas da cotação.
- Item de menu "Prazos & Pendências" é restrito a Financeiro/Admin (decisão de acesso não revista).
- O SLA de 24 h úteis da "Proposta pronta" é escolha minha, editável em `SLA_HORAS`.
- Resposta por e-mail do fornecedor só alimenta a Precificação via "Extrair preço" com confirmação humana.
- **Cache-busting**: qualquer arquivo editado aqui exige bump do `?v=` no `index.html` (e nas páginas públicas que o carregam).

## 9. Tutoriais (podem ficar desatualizados)

Publicados em `TreinamentoVP/`: Dashboard, Notificações, Prazos & Pendências, Central de Decisões, Inbox e o módulo Geral. Ligados ao "?" apenas Central de Decisões, Dashboard e Notificações; Inbox e Prazos & Pendências ficam fora do menu até regeneração. Ao mexer em `decisoes.jsx`, `logistica.jsx`/`inbox-*.jsx` ou `financeiro.jsx`, **avisar** que o tutorial correspondente deve ser regenerado pela sessão de tutoriais (nunca editar o HTML à mão).

## 10. Referências cruzadas

`CLAUDE.md` (seções: Sistema de E-mail/Inbox; Central de Decisões — Ver documento; Central de Notificações — análise e correções; Prazos & Pendências — revisão; Inbox fases 1–4C; Tratativas ⇄ Inbox; Aval Engenharia), `docs/MAPA_DE_ROTAS.md` (grupo "Geral"), `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`.

## 11. Debug do módulo — 31/10/2026 (epic #1218)

Auditoria read-only seguida de correções, uma issue por tela. Cada correção tem teste de navegador em `e2e/` que falha no código antigo e passa no novo (Supabase simulado; o banco de produção nunca é tocado).

| Tela | Issue | PR (squash) | Teste |
|---|---|---|---|
| Inbox | #1213 | #1220 (`e40c910`) | `e2e/inbox.spec.js` |
| Prazos & Pendências | #1214 | #1229 (`d9aed86`) | `e2e/prazos.spec.js` |
| Dashboard | #1216 | #1230 (`a7d6990`) | `e2e/dashboard.spec.js` |
| Notificações | #1217 | #1232 (`e100fa3`) | `e2e/notificacoes.spec.js` |
| Central de Decisões | #1215 | ver o PR desta entrega | `e2e/decisoes.spec.js`, `src/decisoes-store.test.js` |

**Comportamentos que passaram a valer (não reintroduza o que eles evitam):**
- **Inbox:**
  - Clicar num e-mail **não troca a pasta**; o efeito "abrir por id" só atua no id que chega de fora (link, Voltar/Avançar, "Ver documento").
  - Falha ao ler o dono dos e-mails (`useInboxMeta`, lotes de 100 ids) **mostra tudo com aviso**, nunca esconde.
  - Excluir confere a gravação (`.select('id')`).
  - Os excluídos são conferidos por id, sem o teto de 500.
  - O Realtime agrupa os avisos de 3 s, e só a leitura mais recente do `read-inbox` vale.
  - Falha ao ler Enviados avisa.
  - O link de e-mail excluído avisa e limpa a URL.
  - `send-email`/`read-inbox`/vínculo/soft-delete **não foram alterados**.
  - E.8 (comentário errado em `send-email`) saiu do Inbox e virou a issue #1237: corrigir no próximo deploy da função. A #1213 foi fechada.
  - (31/10/2026, item 3 do prompt de debug: F5 e link; área blindada, autorizado pelo Gelson) Pasta e pesquisa na URL (`/geral/inbox[/<id>]?pasta=&q=`). O caminho continua do App (`setSubsel`); a query é da tela e é devolvida a cada `vp:navigate` (o `VpRouter.navigate` troca só o caminho). Trocar de pasta cria entrada no Voltar; digitar na pesquisa só substitui. Pasta que a pessoa não vê (marcador apagado, "Sem responsável" sem `triagem`/`ver_todos`) avisa e volta à Caixa de entrada. **Corrigido junto:** fechar o e-mail (ex.: trocar de pasta) deixava o id antigo no endereço e o F5 reabria o e-mail — `abrirEmail(null)` agora limpa. Janelas de ação (Escrever, Atribuir, Pedir decisão, Extrair preço, Suspender) ficam fora de propósito. **`send-email`/`read-inbox`/vínculo/soft-delete/dono/triagem não mudaram.**
- **Prazos & Pendências:**
  - A carga tem `try/catch` e mostra aviso com "Tentar novamente" (nunca "Carregando…" eterno).
  - Após "Dar Aval de Pagamento", a tela confere `AvalFinanceiroStore.podeIniciarCompra` e diz o que ainda falta. **As regras de avais não mudaram** (confirmado pelo Gelson): três avais (Pagamento, Jurídico, Projeto de Instalação assinado) + CEO se margem < 15%.
  - D.5 (31/10/2026, decisão do Gelson: opções a + b): o filtro das cadeias e a cotação aberta ficam na URL (`/adm-financeiro/financeiro/<filtro>/<Nº>`). F5, link compartilhado e Voltar/Avançar mantêm a tela. **Só uma cotação aberta por vez** (a do link). Link com filtro que não é o da cotação abre no filtro dela (troca sem criar entrada no Voltar); cotação sem cadeia avisa e volta à lista. **Busca e janelas de confirmação ficam fora da URL de propósito** (reabrir uma confirmação no F5 arriscaria confirmar duas vezes). Filtro novo = incluir em `FILTROS_CADEIA`. O modal de cadeia do Controle de Cotações (mesmo componente, sem `onAlternar`) continua abrindo/fechando só na tela.
  - D.4 (alçada no botão) saiu da #1214 e virou a issue #1239, que depende da #571. A #1214 e o epic #1218 foram fechados.
- **Dashboard:**
  - `loadDashboardData` devolve `erros` (consultas que falharam) e a tela avisa.
  - Não há mais "vazio aos 3 s": a tela segue carregando e avisa a demora.
  - Só a carga mais recente vale.
  - O link de projeto fora da esteira avisa e limpa a URL.
  - Ao voltar para a aba, recarrega se a última carga tem mais de 5 min.
- **Notificações:**
  - O filtro de módulo volta para "Todos" quando o módulo some da aba.
  - "Marcar todas como lidas" só mostra sucesso após gravar (`marcarTodasLidas` devolve `true/false`).
  - Falha em propostas/contratos/avais marca a lista `incompleto`, sem montar avisos calculados com dados vazios.
  - Recarrega a cada 5 min e ao voltar para a aba.
  - (31/10/2026, item 3 do prompt de debug: F5 e link) Aba, aviso aberto e módulo ficam na URL (`/geral/notificacoes/<aba>/<id>?modulo=`). **Abrir pelo link não marca como lida nem arquiva.** Aviso que não existe mais (resolvido, expirado, de outra pessoa ou oculto pelas Preferências) avisa e volta à lista; aviso arquivado aberto fora de "Arquivadas" (ou o contrário) troca de aba sem criar entrada no Voltar. Preferências fora da URL de propósito. Aba nova = incluir em `NOTIF_ABAS`.
- **Central de Decisões:**
  - `listarDecididas` filtra por pessoa **no banco** (`decidido_por`, `solicitado_por`, `aprovadores_esperados cs`) antes do limite de 200.
  - O link de decisão já decidida abre "Decididas" com aviso; o de decisão não encontrada avisa; nos dois casos o modal sai da URL.
  - "Ver documento": erro na consulta da proposta e falha de rede avisam. **A navegação blindada (`setSubsel` + `setRoute`, resolução de `numero_cotacao` → id, `tabelaPagina`) não mudou**, e o teste confere que continua abrindo a proposta.
  - `criarDecisaoSeNaoExiste` usa `.is` para cotação nula e pega a primeira existente.
  - (31/10/2026, item 3 do prompt de debug: F5 e link; área blindada, autorizado pelo Gelson) Aba, tipo e busca na URL (`/geral/decisoes/decididas?tipo=&q=`). Link de decisão já decidida (`/<id>/aprovar` antigo ou `/decididas/<id>`) abre "Decididas", rola até o cartão e o destaca por 4 s; id que não está nas decididas avisa e fica só na aba. Nenhum id é a palavra "decididas" (uuid), então os links antigos valem. **"Ver documento", os modais e `setSubsel`+`setRoute` não mudaram** (o teste do caminho feliz continua passando).
  - Falha ao ler as alçadas de decisão mantém os aprovadores gravados.
