# Módulo CRM — especificação técnica

> Mapeamento read-only feito em 30/10/2026 a partir de `src/comercial.jsx`, `src/crm.jsx`, `src/shell.jsx`, `src/app.jsx` e `src/router.js`. Nenhum código da aplicação foi alterado. Complementa as seções do `CLAUDE.md` sobre Leads (26/09, 04/10/2026).

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

**Leads** — lista com busca, filtros por status/prioridade, indicadores, Kanban por `LEAD_STATUSES` (arrastar muda status), colunas incluindo "Está no Omie desde", botão Novo Lead, Exportar, lixeira por linha. Clique na linha: `setSubsel(l); setRoute('lead-detail')`.

**Detalhe do Lead** — a URL `/crm/lead-detail/<id>` é resolvida por `ASYNC_FETCH_ROUTES['lead-detail']` (`app.jsx`), que busca o lead por id (deep-link e F5 funcionam). Ações: Voltar (`setRoute('leads')`), Editar, abrir Formulário, "Qualificar → Dossier"/"Abrir Dossier", histórico (`vp_logs`), cliente vinculado, card de especificação técnica (quando há), comissão prevista.

**Canais** — leads com telefone ou e-mail; botão WhatsApp abre `wa.me` (sem DDI assume 55) com mensagem pronta; e-mail não é enviado aqui (Inbox cuida). Clique na linha abre o detalhe. Escopo decidido em 26/09/2026: só e-mail e WhatsApp.

**Conversão** — contagem de leads por `origin` com barras; card informativo da captura do site.

**Automação** — documenta a regra "Convertido → Cliente" e lista convertidos com badge Vinculado/Sem vínculo; "Vincular agora" chama `criarOuVincularDeLead` e recarrega a página. Não é motor de disparo em massa.

**Análise** — KPIs (total, convertidos, taxa de conversão, sem retorno), funil por status e contagem por responsável (`owner`).

**Navegação** — sempre `setSubsel` + `setRoute` recebidos do `App` (`VpRouter.navigate` sozinho só reescreve a URL e não renderiza). As 4 telas do `crm.jsx` recebem `setRoute/setSubsel` como props.

## 6. Regras de negócio

1. **Convertido → Cliente**: qualquer caminho para "Convertido" (Proposta assinada, edição, Kanban) garante registro em Cadastros › Clientes e grava `leads.cliente_id`, sem duplicar. Na assinatura da Proposta, o `cliente_id` do Formulário vence a busca por nome (evita homônimos).
2. **Documento**: o tipo escolhido na lista define o documento — PF exige CPF (11 dígitos), PJ exige CNPJ (14), ambos com dígito verificador (`EnderecoAPI.validarDocumento`); vazio é aceito com "documento pendente". Contribuinte de ICMS (Sim/Não) é obrigatório.
3. **Comissão**: campo manual 0–100%; em branco vale **2%** (`COMISSAO_PADRAO_PCT`) sem gravar o padrão (grava `null`). Não se liga a `regras_comissionamento`.
4. **Exclusão = soft-delete obrigatório** (`excluido_em`/`excluido_por`), sempre com confirmação em `ModalExcluirLead`. Não usar DELETE: FKs de `cotacoes`/`formularios_elevador` bloqueiam, `dossier_obra.lead_id` ficaria órfão, e `leads` não tem policy de DELETE para anon (voltaria sem erro e sem apagar). O update usa `.select('id')` e trata 0 linhas como erro. O filtro `excluido_em is null` vale só nas listagens (lista, busca global, Dashboard, `crm.jsx`); Precificação, histórico do cliente e buscas por id não filtram de propósito. Reverter: `update leads set excluido_em = null, excluido_por = null where id = '…'`.
5. **Acesso ao Supabase** apenas via `comercialSb()` (null se não carregou); falhas viram lista vazia + toast, nunca "Carregando…" eterno.
6. **Hooks**: `LeadDetail` é só o estado vazio; todos os hooks ficam em `LeadDetailView`, e cada efeito zera o estado ao trocar de lead (evita mostrar dados do lead anterior ou abrir dossiê errado).
7. **Omie**: nunca exigir sessão de usuário Supabase em Edge Function (login é o SSO do vpsistema; requests saem com a anon key). Falha de consulta (`encontrado: null`) não grava nada em `clientes`.
8. **Datas** `aaaa-mm-dd` formatadas por `isoParaDataBR()`, nunca `new Date('aaaa-mm-dd')` (cai um dia no fuso do Brasil).

## 7. Achados e riscos do diagnóstico

- **Texto possivelmente desatualizado em Conversão**: o card "Captura automática do site" diz que "falta só configurar o Webhook no Elementor". Não verifiquei se isso já foi feito; confirmar com o usuário antes de manter ou remover o texto.
- **Automação/"Vincular agora" usa `window.location.reload()`** em vez de atualizar o estado local; funciona, mas perde filtros/posição.
- **Canais, Conversão, Automação e Análise não filtram por dono/vendedor**: qualquer usuário com acesso ao módulo vê todos os leads. A restrição por vendedor (`formularios.ver_de_outros`) existe só no Formulário. Segurança real depende da issue #571 (RLS aberta a anon em `leads`).
- **Análise e Conversão calculam no navegador** sobre `select('*')` de todos os leads ativos, sem paginação; adequado hoje, a reavaliar se o volume crescer (limite padrão de 1000 linhas do PostgREST pode truncar em silêncio — usar paginação por `.range()` se passar disso).
- **Sem Realtime** em `leads` (diferente de Embarques/Proposta/Inbox): as telas só atualizam ao recarregar.
- **Tutoriais** de Leads, Canais, Conversão, Automação, Análise e do módulo CRM existem em `TreinamentoVP/`; mudanças nestas telas exigem regenerá-los pela sessão de tutoriais (não editar o HTML à mão).
- Não testado com clique real no navegador nesta etapa (inspeção por leitura de código).
