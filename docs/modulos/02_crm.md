# Módulo CRM — especificação técnica

> Atualizado em 31/10/2026: as correções do diagnóstico (#1200–#1203) já estão em `main`; ver seção 7. Mapeamento read-only feito em 30/10/2026 a partir de `src/comercial.jsx`, `src/crm.jsx`, `src/shell.jsx`, `src/app.jsx` e `src/router.js`. Nenhum código da aplicação foi alterado. Complementa as seções do `CLAUDE.md` sobre Leads (26/09, 04/10/2026).

## 1. Visão geral

O CRM é o início da jornada comercial: capta o lead, qualifica, e converte em **Cliente** (Cadastros) e/ou abre **Formulário de Elevador** (cotação) e **Dossiê da Obra**. Menu lateral "CRM" (`shell.jsx`, grupo com 5 itens; `MODULE_HOME['CRM'] = 'leads'`).

| Tela | Rota (id) | Componente | Arquivo |
|---|---|---|---|
| Leads (lista + Kanban) | `/crm/leads` (`leads`) | `LeadsPage` | `comercial.jsx` |
| Detalhe do Lead | `/crm/lead-detail/<id>` | `LeadDetail` → `LeadDetailView` | `comercial.jsx` |
| Canais | `/crm/crm-canais` | `CRMCanaisPage` | `crm.jsx` |
| Conversão | `/crm/crm-conversao` | `CRMConversaoPage` | `crm.jsx` |
| Automação | `/crm/crm-automacao` | `CRMAutomacaoPage` | `crm.jsx` |
| Análise | `/crm/crm-analise` | `CRMAnalisePage` | `crm.jsx` |

`crm.jsx` carrega **depois** de `comercial.jsx` e reaproveita `comercialSb()` e `LEAD_STATUSES` expostos em `window`. As 4 telas do `crm.jsx` são **somente leitura** sobre `leads` (hook `useLeadsBase`: `select('*')` com `excluido_em is null`, ordenado por `date`), exceto o botão "Vincular agora" da Automação.

## 2. Ciclo de vida do Lead

Status (`LEAD_STATUSES`, fonte única de campo, filtros, Kanban e Análise):
`Em qualificação → Aguardando cotação → Proposta enviada → Negociação → Convertido | Sem retorno`.

- Lead nasce "Em qualificação" (formulário Novo Lead, Edge Function do site ou formulário público do Quadro de Comando).
- Muda por: edição do lead, **arrastar no Kanban** (`moverLeadStatus`, grava e loga em `vp_logs`) ou **Proposta assinada** (`proposta-store.js` marca "Convertido").
- Status antigo fora da lista continua selecionável na edição e cai na coluna "Outros" do Kanban.
- Prioridade: sempre via `priorityKey()` (banco tem `alta/media/baixa` e legados `Alta/Média/ALTA`).

## 3. Matriz de herança e doação de dados

**O CRM herda**
- Leads do site WordPress/Elementor → Edge Function `capturar-lead-verticalparts` (`verify_jwt:false` de propósito; limite 30/IP e 60 global; e-mail inválido descartado).
- Leads do formulário público do Quadro de Comando → `capturar-lead-quadro-comando` (origem "Formulário Público — Quadro de Comando"; especificação técnica em `leads.especificacao_tecnica`, mostrada no detalhe do lead).
- CNPJ/CPF → Omie via `omie-buscar-cliente` (v5, só leitura, `verify_jwt:true`); depois BrasilAPI (`EnderecoAPI.buscarCNPJ`) se o Omie não achar ou falhar. Três estados: `encontrado: true | false | null` (`null` = falha de consulta, nunca "não cadastrado").
- Cliente existente por documento → `FormularioElevadorStore.buscarOuCriarCliente` (dedup por CNPJ/CPF).

**O CRM doa**
- **Cliente** → `Cadastros › Clientes` (`leads.cliente_id`), por documento ao salvar ou por `CadastrosClientesStore.criarOuVincularDeLead` quando "Convertido" (dedup por razão social, idempotente). Também vincula os pedidos de Quadro de Comando do lead (`vincularQuadrosDoLead`).
- **Formulário de Elevador** → `setSubsel({ __prefillFromLead: lead })` + `setRoute('formulario-elevador')`; pré-preenche contato e cliente (equipamento é sempre alocado no Formulário).
- **Dossiê da Obra** → botão "Qualificar → Dossier" (`__DOSSIER.criarDeDossier`); se já existe dossiê com o `lead_id`, abre o existente. Só cria com status "Em qualificação"/"Aguardando cotação".
- **Omie (informação)** → `clientes.omie_cadastrado_desde`, `omie_verificado_em`, `codigo_cliente_omie` (coluna "Está no Omie desde" da lista; reverificação em segundo plano de até 10 clientes por carga, a cada 7 dias).
- **Auditoria** → `vp_logs` (criação, movimentação, exclusão, conversão em dossiê); o histórico do detalhe lê `vp_logs` por `alvo_id`.

## 4. Tabelas do Supabase

- **`leads`**: `id` (`LD-` + 6 dígitos), `building`, `contact`, `role`, `phone`, `email`, `origin`, `status`, `owner`, `value`, `priority`, `next_action`, `date`, `cliente_id`, `documento_pendente`, `contribuinte_icms`, `comissao_pct`, `especificacao_tecnica` (jsonb), `excluido_em`, `excluido_por`. **Sem `updated_at`** (a "última atualização" usa o evento mais recente do `vp_logs`, senão `created_at`/`date`).
- **`clientes`**: vínculo `leads.cliente_id`; colunas Omie acima.
- **`vp_logs`**: auditoria (módulo "Comercial").
- **`dossier_obra`**: `lead_id` (sem FK). **`cotacoes.lead_id`** e **`formularios_elevador.lead_id`** têm FK `NO ACTION`.
- Migrations relevantes: `20260818140000_leads_cliente_id`, `20260828130000_leads_clientes_documento_pendente`, `20260926160000_leads_soft_delete`, `20261004180000_leads_comissao_pct`, `20261007160000_leads_especificacao_tecnica`, `20261014130000_leads_vincular_quadros_ao_converter`, `20261016160000_leads_contribuinte_icms`.

## 5. Mapeamento de telas, rotas e botões

**Leads** — lista com busca, filtros por status/responsável, indicadores, Kanban por `LEAD_STATUSES` (arrastar muda status), colunas incluindo "Está no Omie desde", botão Novo Lead, Exportar, lixeira por linha. Clique na linha: `setSubsel(l); setRoute('lead-detail')`. Trocar status, responsável ou busca volta à página 1. O KPI "Leads ativos" e o subtítulo contam só os leads **em aberto** (sem Convertido, que moram em Cadastros › Clientes); a taxa de conversão continua sobre o total. Mover card no Kanban confere a gravação (`.select('id')`, 0 linhas = erro) e reverte o card se falhar.

**Detalhe do Lead** — a URL `/crm/lead-detail/<id>` é resolvida por `ASYNC_FETCH_ROUTES['lead-detail']` (`app.jsx`), que busca o lead por id (deep-link e F5 funcionam). Ações: Voltar (`setRoute('leads')`), Editar, abrir Formulário, "Qualificar → Dossier"/"Abrir Dossier" (a consulta usa `limit(1)`: com 2+ dossiês abre o primeiro; se a consulta falhar, não cria nada), histórico (`vp_logs`, recarrega depois de editar), cliente vinculado, card de especificação técnica (quando há), comissão prevista.

**Canais** — leads com telefone ou e-mail; botão WhatsApp abre `wa.me` pelo helper único `waLink` (definido em `comercial.jsx`, exposto em `window`; até 11 dígitos prefixa 55, 12+ ficam como estão) com mensagem pronta — o detalhe do lead usa o mesmo helper; e-mail não é enviado aqui (Inbox cuida). Clique na linha abre o detalhe. Escopo decidido em 26/09/2026: só e-mail e WhatsApp.

**Conversão** — contagem de leads por `origin` com barras; card informativo da captura do site (texto "falta configurar o Webhook no Elementor" **mantido de propósito**: o webhook ainda não está no ar; issue #1204 aberta).

**Automação** — documenta a regra "Convertido → Cliente" e lista convertidos com badge Vinculado/Sem vínculo; "Vincular agora" chama `criarOuVincularDeLead` e atualiza só aquela linha no estado local (sem recarregar a página). Não é motor de disparo em massa.

**Análise** — KPIs (total, convertidos, taxa de conversão, sem retorno), funil por status (com a linha "Outros (status antigo)" para status fora de `LEAD_STATUSES`, para a soma bater com o total) e contagem por responsável (`owner`).

**Navegação** — sempre `setSubsel` + `setRoute` recebidos do `App` (`VpRouter.navigate` sozinho só reescreve a URL e não renderiza). As 4 telas do `crm.jsx` recebem `setRoute/setSubsel` como props.

**Leitura de leads nas 4 telas do `crm.jsx`** — hook `useLeadsBase()` devolve `{ leads, erro, recarregar, atualizarLead }`: lê em páginas de 1000 (`.range()`, ordem por `date` e `id`), com `excluido_em is null`; `leads === null` = carregando; `erro` mostra o cartão "Não foi possível carregar os leads" com "Tentar de novo" (nunca vira lista vazia); `atualizarLead(id, patch)` altera uma linha sem recarregar.

## 6. Regras de negócio

1. **Convertido → Cliente**: qualquer caminho para "Convertido" (Proposta assinada, edição, Kanban) garante registro em Cadastros › Clientes e grava `leads.cliente_id`, sem duplicar. Na assinatura da Proposta, o `cliente_id` do Formulário vence a busca por nome (evita homônimos).
2. **Documento**: o tipo escolhido na lista define o documento — PF exige CPF (11 dígitos), PJ exige CNPJ (14), ambos com dígito verificador (`EnderecoAPI.validarDocumento`); vazio é aceito com "documento pendente". Contribuinte de ICMS (Sim/Não) é obrigatório.
3. **Comissão**: campo manual 0–100%; em branco vale **2%** (`COMISSAO_PADRAO_PCT`) sem gravar o padrão (grava `null`). Não se liga a `regras_comissionamento`.
4. **Exclusão = soft-delete obrigatório** (`excluido_em`/`excluido_por`), sempre com confirmação em `ModalExcluirLead`. Não usar DELETE: FKs de `cotacoes`/`formularios_elevador` bloqueiam, `dossier_obra.lead_id` ficaria órfão, e `leads` não tem policy de DELETE para anon (voltaria sem erro e sem apagar). O update usa `.select('id')` e trata 0 linhas como erro. O filtro `excluido_em is null` vale só nas listagens (lista, busca global, Dashboard, `crm.jsx`); Precificação, histórico do cliente e buscas por id não filtram de propósito. Reverter: `update leads set excluido_em = null, excluido_por = null where id = '…'`.
5. **Acesso ao Supabase** apenas via `comercialSb()` (null se não carregou); na lista de Leads falhas viram lista vazia + toast e nas telas do `crm.jsx` viram cartão de erro com retry — nunca "Carregando…" eterno. Gravações em `leads` conferem o resultado (`.select('id')`, 0 linhas = erro).
6. **Hooks**: `LeadDetail` é só o estado vazio; todos os hooks ficam em `LeadDetailView`, e cada efeito zera o estado ao trocar de lead (evita mostrar dados do lead anterior ou abrir dossiê errado).
7. **Omie**: nunca exigir sessão de usuário Supabase em Edge Function (login é o SSO do vpsistema; requests saem com a anon key). Falha de consulta (`encontrado: null`) não grava nada em `clientes`.
8. **Datas** `aaaa-mm-dd` formatadas por `isoParaDataBR()`, nunca `new Date('aaaa-mm-dd')` (cai um dia no fuso do Brasil).
9. **Auditoria**: criar/editar lead grava "Lead criado"/"Lead editado" em `vp_logs` (só nomes dos campos alterados e status de→para; nunca telefone, e-mail ou valores), além de mover no Kanban, excluir e criar dossiê.
10. **Leitura de `leads` com mais de 1000 linhas** exige paginação por `.range()` com ordem estável (o PostgREST corta em 1000).

## 7. Diagnóstico: corrigido e em aberto

**Corrigido em 31/10/2026 (issues fechadas, PRs mergeados em `main`)**
- **#1200 / PR #1205** — Kanban confere a gravação e reverte o card se falhar; checagem de dossiê duplicado com `limit(1)` e sem criar nada se a consulta falhar.
- **#1201 / PR #1206** — log de criação/edição do lead e histórico que recarrega depois de editar.
- **#1202 / PR #1207** — página volta à 1 ao filtrar; KPI conta só leads em aberto; `waLink` único (detalhe e Canais).
- **#1203 / PR #1208** — telas do `crm.jsx` com estado de erro e retry, leitura paginada, "Outros" no funil e Automação sem `window.location.reload()`.
- Versões em `index.html`: `comercial.jsx` v45, `crm.jsx` v3. Validado por `npm test` (869/869), `check-cache-bust` e compilação Babel; **não testado com clique real no navegador** (o e2e de fumaça roda no CI).

**Em aberto**
- **#1204 (aberta)** — texto do card de Conversão ("falta configurar o Webhook no Elementor"): o webhook **ainda não está no ar** (confirmado pelo usuário em 31/10/2026), então o texto fica. Quando entrar: conferir leads com origem "Site verticalparts.com.br", trocar para "Captura ativa", subir `crm.jsx?v=` e pedir à sessão de tutoriais para regenerar o tutorial "Conversão".
- **Canais, Conversão, Automação e Análise não filtram por dono/vendedor**: qualquer usuário com acesso ao módulo vê todos os leads. A restrição por vendedor (`formularios.ver_de_outros`) existe só no Formulário. Segurança real depende da issue #571 (RLS aberta a anon em `leads`).
- **Sem Realtime** em `leads` (diferente de Embarques/Proposta/Inbox): as telas só atualizam ao recarregar.
- **Prioridade legada** (ex.: "Alta" com maiúscula) pode aparecer como campo alterado no log "Lead editado" mesmo sem o usuário mexer nela.
- **Tutoriais** de Leads, Canais, Conversão, Automação, Análise e do módulo CRM existem em `TreinamentoVP/`; mudanças nestas telas (KPI, WhatsApp do detalhe, cartão de erro) exigem regenerá-los pela sessão de tutoriais (não editar o HTML à mão).
