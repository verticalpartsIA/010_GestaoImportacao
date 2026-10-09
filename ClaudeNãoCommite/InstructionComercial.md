# Comercial (Leads) — Especificação Técnica

**Arquivo:** `src/comercial.jsx` (940 linhas) + integra `src/formulario-elevador.jsx`, `src/controle-cotacoes.jsx`  
**Propósito:** Pipeline de Leads (captação) → Formulário de Equipamento → Cotação Fornecedor/Precificação

---

## ⚡ Essência

| Aspecto | Valor |
|--------|-------|
| **O quê** | Lista de leads + form criar/editar + detalhe + hub de formulários |
| **Quem usa** | Vendedor (interno, único canal — sem self-service em Leads) |
| **Saída** | `leads` (Supabase) → `formularios_elevador` (via prefill) |
| **Componentes** | `LeadsPage`, `ModalNovoLead`, `LeadDetail/LeadDetailView`, `FormulariosPage` |
| **Dependência** | `comercialSb()`, `CadastrosClientesStore`, `FormularioElevadorStore`, Omie Edge Function |

---

## 📊 Estrutura de Dados (tabela `leads`)

```json
{
  "id": "LD-123456",              // gerado client-side (timestamp)
  "building": "string *",
  "contact": "string *",
  "role": "string|null",
  "phone": "string|null",
  "email": "string|null",
  "origin": "Site|Indicação|LinkedIn|Cold Call|Evento|WhatsApp|Email",
  "status": "Em qualificação|Aguardando cotação|Proposta enviada|Negociação|Convertido|Sem retorno",
  "owner": "string|null",
  "value": "float|null",
  "priority": "alta|media|baixa",  // banco sempre minúsculo (E04 normaliza legado)
  "next_action": "string|null",
  "documento_pendente": "boolean",
  "cliente_id": "uuid|null",       // vínculo com clientes (Omie/Cadastros)
  "date": "yyyy-mm-dd"
}
```

**Sem `updated_at`** — "Última atualização" usa `vp_logs` mais recente, senão `created_at`/`date`.

---

## 🔄 Fluxo Completo (validado nesta sessão)

```
LeadsPage (lista + filtros)
  │
  ├─ "Novo Lead" → ModalNovoLead
  │    ├─ Valida: building + contact obrigatórios
  │    ├─ Busca CNPJ: 1º Omie (Edge Function) → 2º EnderecoAPI pública
  │    ├─ Salva lead (insert/update)
  │    ├─ Vincula cliente_id (buscarOuCriarCliente, dedup por documento)
  │    └─ onSaved → reloadLeads() [LeadsPage recarrega array completo]
  │        │
  │        └─ "Abrir Formulário →" → FormularioElevadorPage
  │             prefill: contato/telefone/email/cliente_id (NÃO equipamento)
  │
  └─ Clica linha → LeadDetail(wrapper) → LeadDetailView
       ├─ Carrega cliente (CadastrosClientesStore.obter)
       ├─ Carrega histórico (vp_logs + criação intrínseca)
       ├─ Checa dossiê existente (evita duplicar)
       ├─ "Editar" → ModalNovoLead (mesmo fluxo acima)
       ├─ "Qualificar → Dossiê" → cria dossier_obra (1x, checado antes)
       └─ "Abrir Formulário" → FormularioElevadorPage (mesmo prefill)

FormularioElevadorPage (formulario-elevador.jsx)
  │
  ├─ "Salvar rascunho" → status='rascunho' (só exige nome mínimo)
  │
  └─ "Enviar para Cotação" → status='enviado' (validação COMPLETA)
       │
       ├─ "Enviar cotação a fornecedores" → FECotacaoFornecedorModal
       │    ├─ Agrupa unidades por fornecedor+tipo+categoria
       │    ├─ ⚠️ SÓ mostra grupo se unidade.fornecedor preenchido
       │    ├─ Envia: E-mail (send-email Edge Function) / WhatsApp / Link
       │    └─ store.marcarEnviado() → tracking de status
       │
       ├─ "Enviar direto para Precificação" (preço já combinado por fora)
       │    ├─ enviarDiretoParaPrecificacao(id) → envio_direto_precificacao_em
       │    ├─ Cria Proposta (prefill + preço=0)
       │    └─ PrecificacaoElevadorStore.listarPendentes() consome esse campo
       │
       └─ "Controle de Cotações" → ControleCotacoesPage
            └─ Une planilha legada + formularios_elevador num grid único
```

---

## 🏗️ Componentes Principais

| Componente | Linha | Responsabilidade |
|-----------|-------|-------------------|
| `LeadsPage` | 395 | Lista, filtros (status/owner/busca), paginação, reloadLeads |
| `ModalNovoLead` | 76 | Form criar/editar + busca CNPJ (Omie→pública) |
| `OmieStatusBox` | 52 | Feedback visual da consulta Omie (3 estados) |
| `LeadDetail` | 603 | Wrapper vazio — evita quebra de ordem de hooks (E11) |
| `LeadDetailView` | 615 | Detalhe real: cliente, histórico, dossiê |
| `FormulariosPage` | 911 | Hub: Equipamento (✓), Quadro Comando (✓), Modernização (futuro) |

---

## 🔐 Avisos Críticos (11 erros documentados + 1 achado nesta auditoria)

### ⚠️ E01-E10 (robustez geral, PR #368)
- `comercialSb()` sempre usado — nunca `window.__VP_SB.sb` direto (E03/E10: script Supabase falho quebrava tela inteira)
- Stores externos (`EnderecoAPI`, `FormularioElevadorStore`, `CadastrosClientesStore`) checados antes de usar
- Erro no `update` de `leads.cliente_id` não é mais silenciado (antes dizia "vinculado" mesmo falhando)
- `reloadLeads` trata erro/catch → lista vazia + toast, nunca "Carregando…" eterno

### ⚠️ E04 — Prioridade Case (linha 46-50)
- Banco tem minúsculo (`alta`/`media`/`baixa`), registros antigos têm `Alta`/`ALTA`
- `priorityKey()` normaliza acento+case antes de escolher cor/rótulo
- **Sem isso:** badge de prioridade não coloria registros antigos

### ⚠️ E11 — Race Condition Hooks (linha 598-641)
- `if (!lead) return` **NÃO pode** vir antes de hooks — quebra ordem de hooks do React
- `LeadDetail` = só estado vazio; **todos hooks ficam em `LeadDetailView`**
- Cada efeito zera estado ao trocar de lead (`cliente` → `undefined`, não `null`) + flag `alive`
- **Sem isso:** trocar de Lead A→B mostrava dados de A até a busca de B responder

### ⚠️ Busca CNPJ no Omie (linha 20-41, 123-164)
- 1º tenta Edge Function `omie-buscar-cliente` (só leitura, anon key)
- Achou → preenche razão social/telefone/email do Omie, SEM chamar API pública
- Não achou/falhou → cai pra `EnderecoAPI` (consulta pública)
- **3 estados:** `encontrado: true|false|null` — `null` = falha de consulta, NUNCA mostrar como "não cadastrado"

### ⚠️ Dossiê Duplicado (linha 683-698)
- Antes: "Qualificar → Dossiê" sempre criava novo, sem checar existente
- Agora: `dossierExistente` checado via `lead_id` antes de criar
- Se já existe → botão abre o existente

### 🆕 ACHADO NESTA AUDITORIA: Fornecedor Não-Obrigatório no RFQ
- **Campo:** `unidade.fornecedor` (Unidade do Formulário)
- **Problema:** NÃO está na lista de campos obrigatórios (`validar()`, formulario-elevador.jsx L1341-1360) mesmo no envio (`status='enviado'`)
- **Consequência:** Vendedor pode enviar formulário completo sem preencher Fornecedor em nenhuma unidade
- **Onde aparece:** Só na hora de abrir "Enviar cotação a fornecedores" → modal vem **vazio**
- **Mitigação existente:** Mensagem clara "Salve o formulário e defina o Fornecedor em pelo menos uma Unidade para enviar a cotação" (linha 1074)
- **Risco real:** Vendedor pode achar que enviou a cotação (clicou "Enviar para Cotação") mas RFQ nunca saiu — únicos avisos são dentro do modal de fornecedores, que o vendedor pode nem abrir
- **Recomendação (não aplicada, aguarda decisão do usuário):** Adicionar validação leve (warning, não bloqueio) no botão "Enviar para Cotação" alertando se nenhuma unidade tem fornecedor

---

## 🔗 Integração com Formulário Elevador

| Campo Lead | Campo Formulário (prefill) |
|-----------|---------------------------|
| `phone` | `header.telefone` |
| `email` | `header.email` |
| `contact` | `header.contato` |
| `building` | `header.predio_empreendimento` |
| `id` | `header.observacoes` (texto: "Originado do Lead...") + `lead_id` |
| `cliente_id` | `clienteId` (se existir) → senão `criarClienteInline=true` |
| **(nunca)** | equipamento — sempre alocado manualmente no Formulário |

---

## 📦 Dependências Externas

| Store/API | Uso |
|-----------|-----|
| `comercialSb()` | Wrapper de acesso Supabase (nunca direto) |
| `CadastrosClientesStore.obter(id)` | Carrega dados de cliente vinculado |
| `FormularioElevadorStore.buscarOuCriarCliente()` | Dedup de cliente por documento |
| `EnderecoAPI.isCnpjValido/isCpfValido/buscarCNPJ` | Validação + consulta pública |
| Edge Function `omie-buscar-cliente` | Consulta ERP Omie (1ª tentativa) |
| `vp_logs` | Histórico de eventos por lead |
| `dossier_obra` | Verificação de duplicidade |

---

## 🔄 Fluxo Pós-RFQ (validado nesta auditoria, 26/09/2026)

**Pergunta do usuário:** "formulário enviado → fornecedor insere custos → financeiro precifica → proposta criada? Isso funciona, inclusive com o E-mail Inbox?"

**Resposta: SIM, todo o ciclo está implementado e conectado.**

```
FECotacaoFornecedorModal → enviar()
  ├─ cotacoes_elevador_fornecedor.status = 'enviado'
  ├─ send-email Edge Function (numeroCotacao, referenciaTipo='cotacao_fornecedor')
  │    └─ grava emails_projeto (direcao='saida', Message-ID próprio)
  │
  └─ [ÁREA BLINDADA] E-mail Inbox (src/logistica.jsx)
       ├─ cron read-inbox-poll (10 min) → read-inbox Edge Function
       ├─ Casa resposta por Message-ID/In-Reply-To → vinculo_confianca='certo'
       ├─ Fallback: regex de assunto → vinculo_confianca='provavel'
       └─ FEComunicacaoFornecedor (formulario-elevador.jsx L855) exibe thread
            "Ver comunicação desta cotação" dentro do modal RFQ

Fornecedor responde (portal público /cotacao-elevador-fornecedor/:token)
  └─ salvarResposta(token, respostas) [cotacao-elevador-fornecedor-store.js L561]
       ├─ status → 'respondido'
       ├─ cambio_na_resposta_usd_brl congelado (CambioAPI, no momento da resposta)
       ├─ respostas.itens[] com preco_unitario/preco_total por unidade
       ├─ respostas.container_no (texto livre, ex: "1x40HC + 1x20GP")
       ├─ confirmacao_tecnica traduzida via IA (confirmacao_tecnica_pt)
       └─ EventosFluxo: 'FORNECEDOR_RESPONDEU'

Time decide comprar (cotacoes-fornecedor.jsx)
  ├─ decidirComprar(id) → status 'em_analise'
  │    └─ GATE: AvalFinanceiroStore.podeIniciarCompra(numeroCotacao)
  │         exige TODAS: aprovação CEO + aprovação owner + sinal_pago +
  │         aval_pagamento_confirmado (aval-financeiro-store.js L336-340)
  └─ aprovar(id) → status 'aprovada' (compra confirmada c/ fornecedor)

PrecificacaoElevadorStore.listarPendentes() [precificacao-elevador-store.js L202]
  ├─ Fila = cotações com status IN (respondido, em_analise, aprovada)
  ├─ + formulários "direto pra Precificação" (envio_direto_precificacao_em)
  └─ montarRascunho(formularioId, cotacaoFornecedorId) [L257]
       ├─ Puxa preco_unitario/preco_total real de respostas.itens
       ├─ Puxa cambio_na_resposta_usd_brl (congelado)
       ├─ parseContainerNo(respostas.container_no) → containers estruturados
       │    🆕 ACHADO: JÁ FLUI pra Precificação (card Despesas Operacionais)
       │    — CLAUDE.md diz "não flui" mas isso está DESATUALIZADO
       └─ buscarMaoDeObraAutomatica(modelos) [tracao+paradas → custos_instalacao_elevador]

Financeiro calcula (PrecificacaoElevadorEngine V2) e aprova
  └─ aprovar(id) [precificacao-elevador-store.js L487]
       ├─ Valida: resultado existe, campos obrigatórios, margem >= mínima
       ├─ status → 'finalizado'
       └─ criarPropostaAutomatica(pz) [L529] — AUTOMÁTICO, idempotente
            ├─ Checa se já existe proposta p/ numero_cotacao (não duplica)
            ├─ PropostaHeranca.prefillPorNumeroCotacao(numero_cotacao)
            └─ PropostaStore.salvar() → Proposta nasce EDITÁVEL, preço pronto

Proposta criada → vendedor revisa/ajusta → dispara pro cliente
```

### ⚠️ Gap Real Confirmado (não é bug, é escopo não implementado)
- `parseContainerNo()` estrutura o container **só dentro da Precificação** (card "Despesas Operacionais", preço sempre nasce 0)
- **NÃO propaga** para `embarques-importacao.jsx` — `EIContainers` nasce sempre com `containers: []` vazio, sem herdar nada de Precificação/Formulário
- Confirma a "Fase 2" pendente do CLAUDE.md principal — mas a "Fase 1" (Precificação) **já está pronta**, contrariando a nota antiga "não flui pra Precificação nem pra Embarques hoje"
- **✅ Aplicado 26/09:** CLAUDE.md principal (seção "Pendências", linha ~121) atualizado com esta divergência — nota antiga estava desatualizada

### ✅ Confirmações Positivas
- E-mail Inbox: vínculo por `numero_cotacao` funciona ponta a ponta (envio real via SMTP + poll automático a cada 10 min mesmo sem tela aberta)
- Gate financeiro antes de comprar do fornecedor: 4 aprovações obrigatórias (CEO, owner, sinal pago, aval pagamento) — trava rígida, sem `numeroCotacao` não bloqueia (`if (numeroCotacao == null) return { ok: true }`)
- Proposta automática é idempotente — não duplica se already existe, e falha silenciosa não desfaz aprovação da Precificação (só loga warning)
- Câmbio USD/BRL congelado no momento exato da resposta do fornecedor, permitindo comparar depois "câmbio no dia da cotação vs. agora"

---

## 🎯 Fluxo Prático: Lead → Cotação Completa

1. Vendedor cria Lead (Prédio + Contato obrigatórios)
2. Busca CNPJ → Omie (se cadastrado) ou pública → preenche razão social
3. Salva → cliente_id vinculado automaticamente
4. "Abrir Formulário" → prefill automático (contato/telefone/cliente)
5. Preenche equipamento(s) no Formulário (elevador/escada/esteira)
6. "Salvar rascunho" → numero_cotacao gerado
7. "Enviar para Cotação" → validação completa, status='enviado'
8. **[PONTO DE ATENÇÃO]** Vendedor deve lembrar de preencher `fornecedor` em cada unidade
9. "Enviar cotação a fornecedores" → RFQ real sai (e-mail/WhatsApp/link)
10. Fornecedor responde → "Controle de Cotações" mostra status
11. Segue para Precificação → Proposta → Contrato

---

## 📍 Localização Crítica

- **Consts:** `PRIORITY_VARIANT/LABEL` (L49-50), `FE_CATEGORIAS` (L902-909)
- **Helpers:** `comercialSb()` (L16), `priorityKey()` (L46), `buscarClienteOmie()` (L25)
- **Componentes:** `ModalNovoLead` (L76), `LeadsPage` (L395), `LeadDetail` (L603), `LeadDetailView` (L615), `FormulariosPage` (L911)
- **Save crítico:** `save()` do ModalNovoLead (L166-256)
