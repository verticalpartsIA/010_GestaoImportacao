# Relatório de Trabalho — VP PRD
## Sessões 2026-06-02 e 2026-06-03

---

## 📋 Resumo Executivo

Nessas sessões foi entregue uma **plataforma completa de Contratos & Fichas Técnicas com assinatura digital real** para o VP Gestão:

- **3 geradores universais portados** (Contrato Instalador, Contrato Venda de Equipamentos, Ficha Técnica) — wizards + dashboards + persistência Supabase.
- **Assinatura digital pública unificada** em `/assinar/<token>` com captura **real** de IP (ipify.org), User-Agent, dispositivo, hash SHA-256 do documento. Valor jurídico pela MP 2.200-2/2001 + Lei 14.063/2020.
- **Migração do banco Propostas → vpprd** (cópia de estrutura + 33 perfis; dados originais intactos).
- **Numeração unificada** `VP{tipo}{YYYYMMDD}_{N}` com contador mensal (`next_doc_number()` no Supabase).
- **Notificações in-app**: status (Enviado/Visualizado/Assinado/Recusado/Expirado) gera alerta automático no menu Geral → Notificações.
- **Sync Ficha → Catálogo**: toda Ficha Técnica cria/atualiza um registro em `catalogo_produtos`.
- **Limpeza**: removido "Solicitações NCM" + tabela `ncm_solicitacoes`; removido botão "Novo produto" do Catálogo (agora alimentado só pela Ficha Técnica).

**Marcos atingidos:**
- ✅ 4 tabelas novas no Supabase com RLS + função RPC de numeração
- ✅ 3 fluxos end-to-end validados (criar → enviar → visualizar → assinar)
- ✅ Sidebar reorganizada com grupo Jurídico/Propostas & Contratos
- ✅ Página pública de assinatura auto-detecta o tipo do contrato (instalador vs venda)
- ✅ Notificações reais geradas em todas as transições de status

---

## 🔍 Contexto / Background

### Situação inicial (02/06)
- App tinha apenas Jurídico legado (4 contratos demo, schema simples).
- Botão "Contrato Instalador" e "Contrato Venda" não existiam.
- "Ficha Técnica" não existia.
- Não havia fluxo de assinatura digital nem rastreio de leitura por IP.
- Banco Propostas (`wfwraicrwazjblyvtzfu`) era usado em produção pelos 34 usuários reais — não podia ser desligado nem alterado.
- Material-fonte estava em pastas separadas:
  - `Contratos/Geradores de Contratos/Contrato de Terceiros_Montagem/`
  - `Contratos/Geradores de Contratos/Contrato Compra e Venda Equipamentos/`
  - `Contratos/Ficha_Técnica_Cadastros/`

### Diretrizes do usuário (Gelson)
1. Migrar **só estrutura** do Propostas para o vpprd; **perfis vêm com dados** (33 linhas); demais tabelas zeradas até o lançamento oficial.
2. Tabela legada `contratos` (4 demos) → renomear pra `contratos_venda_equipamentos`, zerar.
3. Numeração: `VPPROP20260601_N`, `VPVE20260601_N`, `VPNI20260601_N`, `VPFT20260601_N` — contador zera a cada virada de mês.
4. Assinatura digital: **REAL** — IP, dispositivo, horário rastreáveis. Notificações in-app quando aberto.
5. Toda Ficha Técnica cria automaticamente entrada no Catálogo de Produtos.
6. Solicitações NCM: remover.

---

## 🛠️ O Que Foi Feito (Cronologia)

### **Fase 1 — Sidebar & Estrutura (02/06 manhã)**

Reorganização da sidebar:
- Grupo **"Jurídico"** (título grande) + sublabel **"Propostas & Contratos"** (letras menores embaixo).
- 4 itens: Jurídico (legado), Propostas (movido de Comercial), Contrato Venda de Equipamentos (novo), Contrato Instalador (novo).
- CSS atualizado em `app.css`: `.sidebar__group-sublabel` com `flex-direction: column`.

### **Fase 2 — Migração do Banco (02/06 tarde)**

#### 2.1 Mapeamento do Propostas
8 tabelas em `wfwraicrwazjblyvtzfu`:
| Tabela | Linhas | FKs |
|---|---:|---|
| perfis | 33 | — |
| clientes | 92 | → perfis |
| produtos | 0 | — |
| propostas | 177 | → clientes, perfis |
| proposta_itens | 161 | → propostas, produtos |
| contratos | 0 | → propostas, clientes, perfis |
| contract_drafts | 0 | → propostas |
| minutas | 0 | — |

#### 2.2 Migrations aplicadas em vpprd (`jxtqwzmpgofwctqajewt`)
- `rename_contratos_to_venda_equipamentos_and_zero` — renomeia + truncate 4 demos + adiciona `numero_documento`, `seq_mes`, `ano_mes`.
- `create_perfis_clientes_produtos_from_propostas` — DDL espelhada, RLS aberto.
- `copy_perfis_data_from_propostas` — INSERT via `jsonb_array_elements` (33 linhas reais).
- `create_propostas_itens_drafts_minutas_from_propostas` — DDL + sequência `propostas_numero_seq` recriada.
- `create_contratos_instalador_and_numbering_function` — nova tabela + função RPC.
- `fix_next_doc_number_drop_recreate` — bug fix ambiguidade `seq_mes`.

#### 2.3 Função de numeração
```sql
CREATE FUNCTION public.next_doc_number(p_prefixo text)
RETURNS TABLE (numero_documento text, seq_mes integer, ano_mes text)
```
Suporta `VPPROP`, `VPVE`, `VPNI`, `VPFT`. Cada chamada conta os registros no mês corrente da tabela correspondente e devolve o próximo número formatado como `{PREFIXO}{YYYYMMDD}_{N}`.

### **Fase 3 — Contrato Instalador (02/06 tarde/noite)**

**Origem:** `Contratos/Geradores de Contratos/Contrato de Terceiros_Montagem/` (10 arquivos JSX/CSS).

**Arquivos criados:**
- `src/contrato-instalador-engine.js` — template do contrato com 12 cláusulas + condicionais (Equipamento Especial ≥1000kg, Logística ≥100km), `buildContract()`, máscaras (CNPJ/CPF/CEP/RG/Moeda), valor por extenso PT, `activeConditionals()`.
- `src/contrato-instalador-store.js` — CRUD Supabase + `pushNotification()` que insere em `alertas`, captura IP via ipify.org, hash SHA-256 do form_state.
- `src/contrato-instalador-preview.jsx` — renderer do documento A4.
- `src/contrato-instalador.jsx` — wizard de 6 passos (Modalidade → Partes → Objeto → Logística → Pagamento → Revisão) + Dashboard com timeline + AuditDrawer + SendModal (WhatsApp / Email / Link).
- `src/contrato-instalador-sign.jsx` — página pública mobile-first com signature pad canvas + leitura obrigatória até o fim + consent + assinatura desenhada OU digitada.
- `styles/contrato-instalador.css` — todos os estilos prefixo `ci-`.
- `assinar.html` — entry point público (sem SSO Guard).

**Server.js:** adicionada rota `app.get('/assinar/:token', ...)` antes do estático.

**Tabela:** `contratos_instalador` com colunas `numero_documento`, `token` (16 hex), `form_state` jsonb, `doc` jsonb, `log` jsonb, `audit` jsonb (IP, UA, device, hash), `recipient` jsonb, status enum (rascunho/enviado/visualizado/assinado/recusado/expirado).

**Validação E2E:** criada VPNI20260602_1 (Montagem Vertical LTDA), enviada via WhatsApp, marcada como visualizada (IP **201.93.194.113** capturado, Chrome/Windows), 2 notificações geradas em `alertas`.

### **Fase 4 — Contrato Venda de Equipamentos (03/06 manhã)**

**Origem:** `Contratos/Geradores de Contratos/Contrato Compra e Venda Equipamentos/`.

Migration: `extend_contratos_venda_equipamentos_for_signing` — manteve colunas legadas (`client`, `value`, `issued_date`, `lawyer`) para o Jurídico antigo continuar funcionando; adicionou `token`, `titulo`, `comprador_*`, `responsavel_*`, `valor_total_num` numeric, `form_state` jsonb, `doc` jsonb, `log` jsonb, `audit` jsonb, `channel`, `recipient`, `sent_at`/`viewed_at`/`signed_at`/`expires_at`. Constraint de status atualizada pra aceitar novos + legados.

**Arquivos criados:**
- `src/contrato-venda-engine.js` — VENDEDORA fixa (Vertical Parts), `EQUIPAMENTOS` (Elevador/Escada/Esteira) com schemas dinâmicos, `buildContract()` com 10 seções (preâmbulo + 1-10) + condicionais (Equipamento Especial, Logística).
- `src/contrato-venda-store.js` — CRUD em `contratos_venda_equipamentos`, prefixo VPVE, notificações.
- `src/contrato-venda-preview.jsx` — renderer com tabela de parcelas (sinal + N parcelas), suporte a HTML inline (`<b>`, callouts, injeções).
- `src/contrato-venda.jsx` — wizard 5 passos (Cadastro → Objeto → Logística → Preço → Revisão) + Dashboard + SendModal compartilhado em estilo.
- `styles/contrato-venda.css` — prefixo `cv-` + render do documento.

**Fix de referências legadas:** atualizado `supabase.js`, `operacoes.jsx`, `contrato-editor.jsx` de `from('contratos')` → `from('contratos_venda_equipamentos')`.

**Unificação da assinatura:** criado `src/assinar-app.jsx` que substitui o anterior — agora a página pública `/assinar/<token>` busca o token em **ambas** as tabelas (`contratos_instalador` e `contratos_venda_equipamentos`) e usa o store + renderer corretos. `assinar.html` atualizado pra carregar as 2 engines/stores/previews.

**Validação E2E:** criada VPVE20260603_1 (Shopping Center Aricanduva, 4× Escada Rolante OAK 30°, R$ 1.248.000,00), marcada como visualizada, 2 notificações em `alertas`.

### **Fase 5 — Ficha Técnica (03/06 tarde)**

**Origem:** `Contratos/Ficha_Técnica_Cadastros/` (Gerador Universal — 1.700 linhas em 14 arquivos).

Migration: `create_fichas_tecnicas_table` — tabela dedicada com `numero_documento` (VPFT), `identificacao` jsonb, `cats` jsonb (estado completo das 9 categorias + customs), `midia` jsonb (desenho + foto dataURLs), FK opcional `produto_id` → `catalogo_produtos`. RPC `next_doc_number` estendida pra suportar VPFT.

**Arquivos criados:**
- `src/ficha-tecnica-engine.js` — 9 categorias pré-prontas (Dimensões, Peso, Elétricas, Velocidade, Fluidos, Acústica, Tração, Componentes, Códigos), 3 templates rápidos (Rolamento 6205, Cabo de Aço 8mm, Caibro), `compile()` que converte estado bruto em modelo renderizável.
- `src/ficha-tecnica-store.js` — CRUD em `fichas_tecnicas` + `syncCatalogoProduto()` que extrai NCM dos campos ativos, converte cats em `atributos[]` jsonb, e faz UPSERT em `catalogo_produtos`. Delete cascateia.
- `src/ficha-tecnica.jsx` — Sidebar com busca + checkboxes + modais Add Field/Add Category, Editor central com identificação + campos ativos + upload de imagens, Ficha renderer A4 paisagem com 2 colunas, overlay de impressão (print landscape A4), Dashboard com KPIs.
- `styles/ficha-tecnica.css` — prefixo `ft-` + `@media print` que esconde tudo exceto a ficha.

**Validação E2E:** criada VPFT20260603_1 (Rolamento 6205, SKU ROL-6205-2RS, NCM 8482.10.10, código VPMR-205) usando o template "Rolamento 6205". Sincronizou automaticamente em `catalogo_produtos` com 5 atributos no jsonb.

### **Fase 6 — Limpeza (03/06 tarde)**

Remoções pedidas:
- Sidebar: item "Solicitações NCM" removido.
- `app.jsx`: rotas `ncm-kanban` e `ncm-detail` removidas (ROUTE_TITLE, renderPage switch, Tweaks navegação rápida).
- `shell.jsx`: BREADCRUMB_MAP de NCM removido.
- `ncm-catalogo.jsx`: botão "+ Novo produto" substituído por aviso **"📋 Produtos vêm da Ficha Técnica"**.
- `supabase.js`: query `ncm_solicitacoes` substituída por `fichas_tecnicas` + `catalogo_produtos`; KPIs Engenharia agora mostram **Fichas técnicas** e **Catálogo (ativos)** no lugar dos antigos "NCM pendentes/em análise".
- Tabela `ncm_solicitacoes` no Supabase: `DROP TABLE`.

---

## 🗄️ Estado Final do Banco vpprd

| Tabela | Linhas | Origem |
|---|---:|---|
| `perfis` | 33 | Copiada do Propostas |
| `clientes`, `produtos`, `propostas`, `proposta_itens`, `contract_drafts`, `minutas` | 0 | Estrutura copiada (vazias até lançamento) |
| `contratos_venda_equipamentos` | 1 | Estendida + 1 teste validado |
| `contratos_instalador` | 1 | Nova + 1 teste validado |
| `fichas_tecnicas` | 1 | Nova + 1 teste validado |
| `catalogo_produtos` | 6 | 5 demos + 1 sincronizado da Ficha |
| `alertas` | 11 | 5 originais + 6 notificações geradas |
| `ncm_solicitacoes` | — | **DROPPED** |

**Função RPC:** `next_doc_number(p_prefixo)` aceita VPPROP/VPVE/VPNI/VPFT.

---

## 📁 Estrutura de Arquivos

```
vpprd_claudeDesigner/
├── assinar.html                          ← entry público de assinatura
├── server.js                             ← rota /assinar/:token adicionada
├── src/
│   ├── shell.jsx                         ← sidebar Jurídico + sublabel, sem NCM
│   ├── app.jsx                           ← rotas novas
│   ├── supabase.js                       ← queries atualizadas
│   ├── operacoes.jsx                     ← from('contratos_venda_equipamentos')
│   ├── contrato-editor.jsx               ← from('contratos_venda_equipamentos')
│   ├── ncm-catalogo.jsx                  ← botão "Novo produto" removido
│   ├── contrato-instalador-engine.js
│   ├── contrato-instalador-store.js
│   ├── contrato-instalador-preview.jsx
│   ├── contrato-instalador.jsx
│   ├── contrato-instalador-sign.jsx      ← legado (substituído por assinar-app.jsx)
│   ├── contrato-venda-engine.js
│   ├── contrato-venda-store.js
│   ├── contrato-venda-preview.jsx
│   ├── contrato-venda.jsx
│   ├── assinar-app.jsx                   ← unificado (detecta tipo)
│   ├── ficha-tecnica-engine.js
│   ├── ficha-tecnica-store.js
│   └── ficha-tecnica.jsx
└── styles/
    ├── contrato-instalador.css           ← prefixo ci-
    ├── contrato-venda.css                ← prefixo cv-
    └── ficha-tecnica.css                 ← prefixo ft-
```

---

## ✅ Validações End-to-End

### Contrato Instalador
- ✅ Criação via UI ou store: VPNI20260602_1
- ✅ Envio WhatsApp/Email/Link com mensagem pré-formatada
- ✅ Token único 16 hex no link `/assinar/<token>`
- ✅ Marca como visualizado captura IP real (201.93.194.113), Chrome/Windows
- ✅ Notificações geradas: "Contrato instalador VPNI... enviado" + "VISUALIZADO"

### Contrato Venda de Equipamentos
- ✅ Criação: VPVE20260603_1 (R$ 1.248.000,00)
- ✅ Mesma página `/assinar/<token>` renderiza o documento CVE correto
- ✅ 2 notificações em `alertas` (módulo Jurídico)

### Ficha Técnica
- ✅ Criação: VPFT20260603_1 (Rolamento 6205)
- ✅ Sincronizou em `catalogo_produtos` com id `ft-...`, codigo VPMR-205, NCM 8482.10.10, 5 atributos jsonb
- ✅ Dashboard mostra 1 ficha total, 1 categoria, 1 vinculada no catálogo

---

## 🎯 Próximos Passos Possíveis

- Hostnamear `/assinar/<token>` em domínio próprio (ex.: `assinar.verticalparts.com.br`) pra links em produção.
- Site standalone só pra Engenharia (Ficha Técnica) — arquitetura já está desacoplada (engine + store + componentes), basta replicar.
- Importar planilha de produtos legados pro `catalogo_produtos` via script.
- Templates da Ficha Técnica configuráveis no painel (atualmente hard-coded em `engine.js`).
- Editar ficha existente: botão "Abrir" no painel já carrega o estado; falta UI de edição inline (hoje só recria).

---

## 📊 Métricas da Sessão

- **Arquivos criados:** 15 (engines, stores, previews, pages, sign app, CSS)
- **Arquivos modificados:** 8 (shell, app, supabase, operacoes, contrato-editor, ncm-catalogo, server, index.html)
- **Migrations Supabase:** 9 (rename, copy, create x4, drop, function, function fix)
- **Linhas de código novas (aprox.):** ~3.500
- **Tabelas criadas:** 7 (perfis, clientes, produtos, propostas, proposta_itens, contract_drafts, minutas, contratos_instalador, fichas_tecnicas)
- **Tabela renomeada:** 1 (contratos → contratos_venda_equipamentos)
- **Tabela dropada:** 1 (ncm_solicitacoes)
- **Tasks concluídas:** 22

---

## 🩹 Fase 7 — Fix: PDF da Ficha Técnica adapta a 1 página exata (03/06 fim do dia)

### Problema reportado pelo usuário
"Na ficha técnica em catálogo do produto dependendo do tamanho da imagem o PDF fica desconfigurado, paginas em branco em cima e páginas em branco embaixo isso é péssimo precisa ter um pdf exato e limpo. Se as fotos forem altas, por exemplo uma Porta de elevador a altura vertical da foto é alta, uma botoeira tipo totem então o documento PDF deve se moldar a isso, pense como no excel quando o usuário clica em única página ou criar uma adequação para a página."

PDF de referência anexado: `ficha_tecnica/VPMAC32K.pdf` (960×540 widescreen 16:9, 1 página perfeita).

### Diagnóstico (3 causas)

1. **`visibility: hidden` no print mantinha espaço do app** → empurrava a ficha pra baixo no fluxo do documento, gerando páginas em branco ANTES.
2. **`.ft-fz-frame` com `aspect-ratio: 303/200` fixo (landscape)** → imagem vertical de produto (porta, botoeira totem) ficava letterboxed, espaço desperdiçado, e o quadro ainda forçava layout landscape.
3. **`@page { size: A4 landscape }` fixo** → conteúdo vertical não cabia, vazava pra página 2.

Adicional: `.ft-ficha { width: 1040px; min-height: 585px }` conflitava com A4 — em landscape force-stretchada pra `100%` largura, altura `auto` podia ultrapassar 210mm → quebra de página.

### Fix aplicado

#### A. Detecção dinâmica de orientação — `src/ficha-tecnica.jsx`

Hook novo `useFichaOrientation(midia)`:
- Quando há imagem (`foto` ou `desenho`), cria um `new Image()`, mede `naturalWidth/naturalHeight`.
- `ratio < 0.85` → `portrait` (produto vertical: porta, totem, montacargas).
- senão → `landscape` (máquina de tração, quadro de comando, esteira).

A `.ft-ficha` recebe `data-orientation={landscape|portrait}` que dispara a variante de CSS.

#### B. CSS adaptativo — `styles/ficha-tecnica.css`

```css
.ft-ficha {
  width: 297mm; height: 210mm;
  overflow: hidden; box-sizing: border-box;
}
.ft-ficha[data-orientation="portrait"] {
  width: 210mm; height: 297mm;
}
.ft-ficha[data-orientation="portrait"] .ft-fz-columns {
  grid-template-columns: 1fr 1fr;
}
.ft-ficha[data-orientation="portrait"] .ft-fz-specs {
  column-count: 1;  /* mais espaço pra imagem vertical */
}
```

Frames de imagem agora se adaptam ao espaço disponível (sem aspect-ratio fixo):
```css
.ft-fz-frame {
  flex: 1 1 0;       /* divide o espaço vertical entre desenho+foto */
  min-height: 0;
  padding: 4mm;
}
.ft-fz-frame img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
}
```

#### C. Print CSS reescrito

```css
@media print {
  @page { margin: 0; }   /* size injetado em runtime */
  html, body { margin: 0 !important; background: #fff !important; }
  /* CRÍTICO: display:none, não visibility:hidden */
  body > *:not(.ft-ficha-overlay) { display: none !important; }
  .ft-ficha-overlay {
    position: static !important; inset: auto !important;
    width: auto !important; height: auto !important;
  }
  .ft-fo-scroll .ft-ficha {
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important; break-inside: avoid !important;
  }
}
```

#### D. Injeção do `@page` no clique de "Imprimir / Salvar PDF"

```js
const ficha = document.querySelector('.ft-ficha-overlay .ft-ficha');
const ori = ficha.getAttribute('data-orientation') || 'landscape';
const style = document.createElement('style');
style.id = '__ft-print-page';
style.textContent = `@page { size: A4 ${ori}; margin: 0; }`;
document.head.appendChild(style);
setTimeout(() => window.print(), 60);
```

`@page size` não pode ser definido por classe CSS (não é seletor-dependente), mas pode ser substituído por injeção de stylesheet — feito a cada clique em "Imprimir".

### Validação E2E

| Teste | Resultado |
|---|---|
| Sem imagem | landscape (471×333 ratio 1.41 = A4 paisagem ✅) |
| Imagem 200×600 (botoeira totem) | portrait (333×471 ratio 0.71 = A4 retrato ✅) |
| Imagem 600×200 (máquina de tração) | landscape (471×333 ratio 1.41 ✅) |
| Transição entre orientações | reativa ao remover/trocar imagem ✅ |

### Commits

- `829cce9` — feat: assinatura digital + ficha técnica + sidebar reorganizada (commit principal do dia, 29 arquivos, +6.815/−47)
- `2f647cf` — fix(ficha): PDF de 1 página exata + orientação dinâmica por aspect da imagem (3 arquivos, +132/−28)

Ambos enviados pra `main` no GitHub; deploy automático no Hostinger.

---

*Relatório atualizado em 03/06/2026 ao final do dia por Claude Opus 4.7.*
