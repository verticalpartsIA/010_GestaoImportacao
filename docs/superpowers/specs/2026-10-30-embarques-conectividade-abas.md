# Embarques de Importação — conectividade e herança entre as 7 abas

Data: 30/10/2026 · Origem: relatório de diagnóstico read-only da mesma data (12 fios rompidos, 7 em curto).
Constituição: `CLAUDE.md` do repositório. Método: SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE → IMPLEMENT.
**Status (30/10/2026): CLARIFY respondido; Onda 1 (T1–T5 + T15) IMPLEMENTADA localmente, sem commit/PR. Ondas 2 e 3 pendentes. Banco/Edge Function/cron só com "CONFIRMO".**

---

## 1. SPECIFY

**Objetivo:** as 7 abas (Identificação, Pagamentos, Frete, Embarque, Aduaneiro, Faturamento, Entrega) passam a se ajudar: o que já foi informado numa aba (ou vem da P.I./cotação/AIS) aparece como herança ou sugestão nas outras, e nenhum campo editável é descartado em silêncio.

**Princípios:**
1. A P.I. continua sendo a fonte de fornecedor, incoterms, valores e pagamentos; o embarque agrega.
2. Herança **nunca sobrescreve** o que a pessoa digitou. Onde houver dúvida, **sugere** ("Sugerido: X — Aplicar"), não grava sozinho.
3. Cada informação tem **uma** coluna de verdade; cópias existem só por compatibilidade e ficam documentadas.
4. Campo que vale mas é sobrescrito no salvar fica **travado** na tela.
5. Nada nas áreas blindadas (Inbox/e-mail, Central de Decisões, Containers/Atualização de Custos, MO da Precificação) é alterado.

**Fora de escopo:** reescrever o motor de gatilhos; mudar `send-email`/`read-inbox`; tela nova; migrar dados antigos em massa.

**Critérios de pronto (por onda):** teste unitário do cálculo novo; JSX compila; `check-cache-bust` ok; `npm test` verde; abrir o embarque antigo (sem os campos novos) não quebra; o que era digitado antes continua gravando igual.

---

## 2. CLARIFY

**Respostas do Gelson (30/10/2026):** C1 = Presença de carga é a **chegada real**; C2 = AIS: **só não apagar** o ETA (nada de Edge Function agora); C3 = heranças **sugerem com botão**; ordem = **começar pela Onda 1**. C4 e C5 seguem a recomendação abaixo.

Tabela original:

| # | Dúvida | Recomendação (padrão adotado se ele não responder) |
|---|---|---|
| C1 | Qual o papel de **Presença de carga** (T10)? | Chegada **real**: alimenta Evolução e Linha do Tempo; enquanto vazia, vale a estimativa (ETA atual), marcada "previsto" |
| C2 | O **ETA do rastreio (AIS)** deve virar o ETA atual do embarque (T11)? | (resposta: só não apagar; o passo 2 de T13 fica descartado até novo pedido) |
| C3 | Herança: **sugerir** ou **preencher sozinho**? | Sugerir (botão Aplicar) em tudo que for editável |
| C4 | Espelho do mapa com **todos** os containers (T12) | Adiar: exige coluna/estrutura nova em `embarques`; só se o rastreio precisar |
| C5 | `transit_time` (Frete) × `transit_time_total` (Aduaneiro) (T9) | Manter os dois, mas o total passa a ser **calculado** de ETD → presença de carga, mostrado como sugestão |

---

## 3. PLAN (3 ondas, 1 PR por onda; cada PR sai de `origin/main` atualizado)

- **Onda 1 — Fios em curto e leitura (só front, sem banco):** T1–T5.
- **Onda 2 — Sugestões de herança (só front, sem banco):** T6–T11.
- **Onda 3 — Semântica de chegada e AIS (toca outras telas; AIS exige Edge Function):** T12–T15.

Ordem por risco: Onda 1 não muda nenhum dado gravado; Onda 2 só acrescenta botões; Onda 3 muda como outras telas leem datas.

---

## 4. TASKS

### Onda 1 — corrigir curtos e dar visibilidade
| Tarefa | Problema (relatório) | O que fazer | Arquivos |
|---|---|---|---|
| **T1** | #4 agente/moeda editáveis com vencedora | `disabled` (e dica "vem da vencedora") em Agente de carga e Moeda frete quando há vencedora | `embarques-importacao.jsx` (aba Frete) |
| **T2** | #5 e #6 moeda mista / cotações divergentes entre P.I. | Aviso amarelo em Identificação e Pagamentos; total por moeda quando houver moedas diferentes (`resumoPIs` passa a devolver `totaisPorMoeda` e `cotacoesDivergentes`); `valor_total` gravado só soma P.I. da **mesma moeda** da primeira e o aviso diz isso | `embarques-importacao-store.js`, `.jsx` |
| **T3** | #14 Pagamentos sem saldo/% pago | Mostrar "% pago" e "falta pagar" por P.I. com `PIStore.calcValorQuitado` (já considera transferências) | `.jsx` (EIPagamentos) |
| **T4** | #12 `data_carregamento` na aba Entrega | Mover o campo para a aba Embarque, junto do ETD (mesma coluna, mesmos gatilhos) | `.jsx` |
| **T5** | #16 NF-e na Entrega | Mover o bloco NF-e para Faturamento (mesma coluna `nfes`) | `.jsx` |

### Onda 2 — sugestões de herança (botão "Aplicar", nunca grava sozinho)
| Tarefa | Problema | O que fazer | Arquivos |
|---|---|---|---|
| **T6** | #7 `modalidade_frete`/`tipo_frete` manuais | Sugerir modalidade a partir do incoterm da P.I. (FOB/FCA/EXW) e tipo "Marítimo" quando há cotação de frete | `.jsx` |
| **T7** | #11 `ultima_data_free_time` manual | Sugerir = presença de carga + `free_time` (dias) | novo helper `embarques-sugestoes-calc.js` + `.jsx` |
| **T8** | #8 `status_etapa` manual | Sugerir a etapa pelos campos preenchidos (pagamento→produção→embarque→desembaraço→entrega→concluído) | idem |
| **T9** | #9 e #17 rolagem não toca o ETA; dois transit times | Ao registrar rolagem de ETD, oferecer "Ajustar ETA em +N dias?"; `transit_time_total` sugerido = ETD → presença de carga | `.jsx` |
| **T10** | #10 containers herdados sem ressincronizar | Ao abrir a aba, comparar com a Precificação e mostrar "mudou: 2x40'HC → 1x40'HC — Atualizar" | `store.js` (`containersDaCotacao` já existe), `.jsx` |
| **T11** | #13 e #18 Faturamento sem herança | Sugerir numerário/faturamento a partir de `custos_estimativa` e do total do frete vencedor; mostrar taxas/anexos da vencedora (leitura) | `.jsx` |

### Onda 3 — chegada real, AIS e espelho
| Tarefa | Problema | O que fazer | Arquivos |
|---|---|---|---|
| **T12** | #1 e #2 Presença de carga sem consumidor; 4 datas de chegada | Definir hierarquia (C1): chegada real = `presenca_carga`; estimativa = `eta_atual`. Evolução (etapa "porto") e Linha do Tempo usam a real quando existe e rotulam "previsto" quando vem da estimativa. `eta_santos` segue sincronizado com `eta_atual` por compatibilidade | `evolucao-equipamentos-calc.js` (+teste), `linha-do-tempo-store.js`, `.jsx` |
| **T13** | #3 AIS não volta; salvar apaga o ETA do AIS | Primeiro passo **só front**: `_sincronizarRastreio` não sobrescreve `embarques.eta` se o AIS atualizou depois do último ETA digitado. Segundo passo (CONFIRMO + teste em cópia): `ais-sync` grava o ETA no embarque de origem com `historico_eta` motivo "AIS" | `embarques-importacao-store.js`; `supabase/functions/ais-sync` |
| **T14** | #15 só o 1º container no espelho | **FEITO (31/10/2026, PR #1235, squash `d2b9f84`).** Migration `20261031100000_embarques_containers_lista.sql` (coluna `containers_lista jsonb not null default '[]'` em `embarques`, aplicada em produção com CONFIRMO **antes** do merge). `_sincronizarRastreio` (`embarques-importacao-store.js` v18) grava `[{numero, tipo_tamanho, lacre}]`; o card "Navio & Container" (`logistica.jsx` v77) mostra todos quando há mais de um. `container_number`/`container_type` do 1º seguem como antes. Embarques antigos ficam com `[]` até serem salvos de novo. Não testado com clique real no navegador | `embarques-importacao-store.js`, `logistica.jsx`, migration |
| **T15** | #19 edição na Entrega muda a Evolução sem aviso | Texto de apoio nos campos `data_entrega`/`data_limite_entrega`: "alimenta a Evolução dos Equipamentos" | `.jsx` |

---

## 5. ANALYZE (riscos e verificações)

| Risco | Mitigação |
|---|---|
| Esquecer o `?v=` quebra produção por cache | Bump no `index.html` em todo PR; `node scripts/check-cache-bust.js origin/main` |
| Mover campos de aba (T4, T5) pode perder foco/valor | Mesmas chaves do `form`; só muda onde é desenhado; teste manual de abrir/salvar embarque antigo |
| Sugestão virar sobrescrita | Regra: só preenche com clique; teste unitário "não sobrescreve valor digitado" |
| T2 mudar `valor_total` gravado | Só afeta embarques com moedas mistas (hoje o valor já era errado); conferir quantos no banco antes (SELECT, leitura livre) |
| T12 muda o que a Evolução mostra | Fallback para `eta_atual`; testes de `evolucao-equipamentos-calc` ampliados; **tutorial do Mapa de Obras ficará desatualizado** (avisar para regenerar, não editar à mão) |
| T13 (Edge Function) já derrubou produção em redeploy | Primeiro passo é só front; o segundo só com CONFIRMO, cópia descartável e `curl` logo após |
| Áreas blindadas | Nenhuma tarefa toca `send-email`, `read-inbox`, Central de Decisões ou Atualização de Custos; o envio de cotação de frete continua pelo helper existente |
| Dados antigos sem campos novos | `EI_EMPTY` + fallback de leitura (já feito para ETA); cada tarefa testa registro "vazio" |
| Concorrência com outras sessões | Antes de cada PR: `git fetch`, comparar com `origin/main`, não sobrescrever arquivo alheio |

**Testes novos previstos:** `embarques-sugestoes-calc.test.js` (modalidade, free time, status, transit time, ETA após rolagem); `resumoPIs` (moedas mistas, cotações divergentes); `evolucao-equipamentos-calc.test.js` (presença de carga real × previsto).
**Sem migration** nas Ondas 1 e 2. Onda 3: só o T14 teve migration (`containers_lista`, aplicada em 31/10/2026). **Status: Ondas 1, 2 e 3 concluídas.**

---

## 6. IMPLEMENT (sequência quando liberado)

1. `git fetch` + branch novo a partir de `origin/main` (um por onda).
2. Onda 1 → testes → cache-bust → **parar e mostrar** (sem commit/PR até o Gelson pedir).
3. Onda 2 idem.
4. Onda 3: T12 e o passo 1 de T13 primeiro; o passo 2 de T13 só com "CONFIRMO" depois de descrever o que será publicado.
5. Ao fim de cada onda: atualizar `CLAUDE.md` (seção do assunto), avisar que tutoriais de Embarques/Mapa de Obras podem ter ficado desatualizados.
6. Teste real no navegador de cada onda (abrir embarque antigo, salvar, recarregar) antes de dizer "pronto".


---

## 7. STATUS DA IMPLEMENTAÇÃO — Onda 1 (30/10/2026)

| Tarefa | Feito | Observação |
|---|---|---|
| T1 | Sim | Agente de carga e Moeda frete ficam `disabled` quando há vencedora |
| T2 | Sim | `resumoPIs` devolve `totaisPorMoeda`, `moedasMistas`, `cotacoesDistintas`; o total gravado soma só a moeda da 1ª P.I.; aviso amarelo em Identificação e Pagamentos (`EIAvisosPIs`) |
| T3 | Sim | "Pago / % / Falta pagar" por P.I. com `PIStore.calcValorQuitado` |
| T4 | Sim | `data_carregamento` mudou para a aba Embarque (mesma coluna) |
| T5 | Sim | NF-e mudou para Faturamento (mesma coluna `nfes`) |
| T15 | Sim | Texto de apoio na Entrega sobre a Evolução |

Testes: `src/embarques-importacao-resumo.test.js` (4); suíte 858/858; JSX compila (esbuild); `check-cache-bust` ok (`embarques-importacao-store.js` v14, `embarques-importacao.jsx` v15). **Não testado com clique no navegador** (sem Playwright instalado neste ambiente; o e2e do CI abre a rota). Sem migration.
