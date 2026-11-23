# Nenhum documento fica para trás — README enxuto, trava de CI e a lei proposta (Art. 52)

> **Status:** rascunho em branch `claude/documentos-em-dia` (worktree `.worktrees/docs-em-dia`), **nada commitado, nada publicado**. Pedido do Gelson em 02/11/2026. Spec, plano e tarefas juntos (Art. 38).
> **Selos (Art. 6):** **Conferido** = visto agora, com o comando ou arquivo indicado. **Herdado** = dito pelo Gelson, não reconferido. Faltando selo, vale Não verificado.
> **A emenda do Art. 52 NÃO está aplicada ao `CLAUDE.md`.** O texto está na seção 6 e só entra com o "Confirmo" do Gelson para essa emenda (Arts. 13 e 14).

## 1. Specify

**Pedido do Gelson (Herdado, 02/11/2026):** "Como atualizar o README e mantê-lo atualizado todas as vezes que houver uma nova atualização? Nenhum documento pode ficar para trás, nenhum, salvo o `CLAUDE.md`, que são leis e regras: quando uma nova lei for implementada, aí sim o `CLAUDE.md` ganha uma atualização. Se dentro de um módulo houver mudanças, o `.md` daquele módulo precisa refletir. Isso deveria ser uma lei para o `CLAUDE.md`, se já não está explícito."

**Requisitos.**
- FR01. O README deixa de repetir o que os módulos já dizem; só carrega o que muda raramente (visão, jornada, princípios, glossário, lista de módulos) e aponta o resto.
- FR02. Mudou um arquivo de um módulo (`src/*.js|jsx` ou `supabase/functions/<nome>`)? O documento do módulo muda no **mesmo** conjunto de commits (o PR). Quem é o dono de cada arquivo vem dos próprios documentos, nada cadastrado à parte.
- FR03. Escape explícito e auditável: `Docs: não se aplica — <motivo>` numa mensagem de commit do PR.
- FR04. Começa em modo **aviso** (não falha o CI) e passa a **falha** por uma troca de uma palavra no `ci.yml`.
- FR05. Modelo de PR com o checklist de documentos.
- FR06. Lei explícita no `CLAUDE.md` (Art. 52), por emenda confirmada.

**Fora do escopo.** Aplicar a emenda sem o "Confirmo"; retirar do `CLAUDE.md` as seções de entregas antigas (decisão à parte, Art. 50); conferir se o texto do documento está **certo** (a trava confere que o documento mudou, não que mudou corretamente); mapear migrations (arquivos de banco) e `index.html`; rodar `npm run tutoriais:conferir` no CI.

**Cenários de aceitação** (ligados a `src/check-docs-em-dia.test.js`, 9 testes).
- Dado um PR que altera `src/tela-a-calc.js`, dono primário `01_a.md`, quando `01_a.md` não muda, então há violação; quando muda, passa.
- Dado um arquivo com dois donos primários, quando só um dos documentos muda, então passa.
- Dado um arquivo citado só de passagem, quando o documento não muda, então só avisa.
- Dado um arquivo novo que nenhum documento do HEAD cita, então é violação.
- Dado um commit com `Docs: não se aplica — <motivo de 10+ letras>`, então o conjunto é liberado e o motivo aparece na saída.
- Dado teste, bundle, `index.html`, migration ou o próprio documento, então não contam como arquivo de módulo.

## 2. Clarify — o que a Constituição já diz (Conferido, `CLAUDE.md`, 02/11/2026)

- **Art. 42:** "Mudança, regra ou decisão nova entra **no documento do módulo**, no tema certo, nunca aqui."
- **Art. 46:** "Mudou uma tela? Atualizam-se o documento do módulo e o texto de ajuda do '?'; o tutorial passa pela sessão de tutoriais."
- **Art. 44:** uma regra em um lugar só; histórico de entrega não se repete nos documentos.
- **Art. 13 / 47:** o `CLAUDE.md` só muda por pedido do Gelson, com data e motivo — o que já combina com a regra dele de "só lei nova".

**Resposta à pergunta "já está explícito?": em parte.** Os Arts. 42 e 46 mandam atualizar o documento do módulo, mas **não** dizem (a) que é no mesmo commit/PR, (b) que vale para todo documento (README, spec, ajuda, `docs/rag/`) e (c) que existe verificação. E o próprio README dizia, na linha 432, "este README não pode ficar para trás novamente" e parou em 29/09/2026: uma regra em prosa, sem mecanismo, falhou. Por isso a proposta tem lei **e** trava.

## 3. Plan

1. **README enxuto** (feito na branch): 593 → 459 linhas. Saiu o "Mapa funcional" (telas descritas uma a uma) e o gate de compra antigo; entrou "Onde está cada coisa" (tabela dos 15 documentos), os mapas gerados e a seção "Como este README é mantido". Corrigidos: "Gatilhos & Prazo" → Prazos & Pendências; `vistorias_obras` como fonte única; Importação Varejo "reservada"; Expedição e Logística "Planejado"; stack e segurança. A seção do Btime fica (um comentário em `src/vistorias-envio.jsx` aponta para ela), com a conferência de 02/11.
2. **`scripts/check-docs-em-dia.js`** (`npm run docs:conferir -- <base>`), no desenho de `check-cache-bust.js`. Dono **primário** = documento que cita o arquivo no tema "Rota e arquivos" (x.x.2): só ele reprova. Dono **provável** = citação de passagem: só avisa. Arquivo antigo sem dono: aviso. Arquivo novo sem dono: reprova. Lê tudo do Git (`git show <ref>:`), então roda em qualquer checkout e permite backtest.
3. **CI:** um passo dentro de "Validar estrutura do projeto" (sem renomear nada), com `--modo aviso`.
4. **`.github/pull_request_template.md`** com o checklist (hoje não existe modelo de PR).
5. **Lei:** Art. 52, só como texto (seção 6).

## 4. Tasks

| # | Tarefa | Situação (02/11/2026) |
|---|---|---|
| T001 | Branch isolada depois de `git fetch` (`origin/main` `4b16db5`) | **Conferido** (worktree `.worktrees/docs-em-dia`) |
| T002 | README enxuto + links conferidos | **Conferido**: 36 links internos e 5 imagens existem; as âncoras do topo resolvem; nenhuma menção restante a "Planejado" nem ao gate antigo |
| T003 | Script + 9 testes | **Conferido**: 9/9 (inclui 3 testes com repositório Git de mentira) |
| T004 | Backtest no histórico | ver seção 5 |
| T005 | Passo de CI (aviso), `package.json`, modelo de PR | **Conferido**: YAML válido, 14 passos, o novo na posição 8; nome do job intacto |
| T006 | `npm run rag` (o README mudou) | **Conferido**: só `docs/rag/indice/README.md` mudou de conteúdo |
| T007 | Emenda do Art. 52 | **Aplicada em 02/11/2026** (Gelson: "Lei 52 Confirmo") |
| T008 | Trocar `--modo aviso` por `--modo falha` | **Aguardar uma semana em modo aviso** (decisão do Gelson, 02/11/2026); trocar a partir de 09/11/2026 |

## 5. Analyze

**Backtest em commits reais da `main` (os últimos 80, cada um contra o pai dele; Conferido, 02/11/2026).**

- **1ª versão da regra** (dono primário = "Rota e arquivos" **ou** a Parte comum "Mapa de ligações/Rotas"; dono provável também reprovava): 28 dos 80 commits tocaram arquivo de módulo; **17 passariam** (o documento mudou junto) e **11 seriam barrados (39%)**.
- **O que os 11 mostraram:** 8 dos 11 só tinham dono *provável* (citação de passagem) e 3 tinham dono errado vindo da Parte comum "Mapa de ligações" (que cita arquivos de outros módulos: por exemplo `proposta-store.js` apontando para `03_cadastros_mestres.md`, `shell.jsx` para `02_crm.md`). Ou seja: **a 1ª regra gerava falso positivo**. O commit `f2ddd01` (só lint) é o caso legítimo do escape `Docs: não se aplica`.
- **Correção aplicada:** só o dono primário do tema "Rota e arquivos" reprova; o provável só avisa; "Mapa de ligações" saiu do conjunto de donos. Testes atualizados (9/9).
- **Viés que não dá para eliminar:** os documentos dos módulos 8 a 15 só existem desde 01/11/2026. Para a maior parte desses 80 commits o documento do módulo **nem existia**, então "o documento não mudou" era inevitável. O backtest serve para achar falso positivo de mapeamento (achou), **não** para medir o atrito real. Esse só se mede com PRs reais, por isso o modo começa em **aviso**.
- **Backtest com a regra refinada (Conferido, mesmos 80 commits):** 28 tocaram arquivo de módulo; **26 passariam** (7 delas com aviso de dono provável) e **2 seriam barrados (7%)**, contra 39% da 1ª versão. Os 2: `f2ddd01` (só lint, o caso típico do escape `Docs: não se aplica`) e `feb3fb0` (mexeu em `shell.jsx`, que na época só tinha `02_crm.md` como dono primário; hoje `shell.jsx` tem 2 donos primários, `02` e `05`). Arquivos muito compartilhados passam com facilidade: `app.jsx` tem 8 documentos donos, `financeiro.jsx` 4. Isso é o oposto do atrito (qualquer um dos donos basta) e a contrapartida é proteção fraca nesses arquivos; fica registrado como limite, não como defeito.

**Limites que o Gelson precisa saber, ditos sem rodeio:**
1. **A trava confere que o documento mudou, não que mudou certo.** Alguém pode tocar uma linha do documento só para passar. O que reduz isso: o selo do Art. 6 (data e método) e o índice `docs/rag/` mostrando a origem do selo; o resto é revisão humana. Nada automático substitui isso.
2. **Cobertura do mapa arquivo → documento (Conferido com o próprio script, 02/11/2026):** dos 267 arquivos de `src/`, **166 (62%)** têm dono primário (são os que reprovam), **60** só são citados de passagem (avisam) e **41** não têm dono (avisam). Das 40 Edge Functions, só **5** têm dono primário, 30 só provável e 5 sem dono (`estoque-omie-endereco` e quatro `sync-importacao-varejo-*`): na prática a trava vale para `src/`, e as funções só avisam até os documentos as citarem no tema "Rota e arquivos".
3. **Arquivos compartilhados:** 21 dos 166 arquivos com dono primário têm 2 ou mais documentos donos; basta um deles mudar, o que pode deixar passar o documento "errado". É o preço de não gerar falso positivo.
4. **`supabase/migrations`, `index.html`, `styles/` e `e2e/` não são mapeados.** Tabela nova sem documento não é pega por esta trava.
5. **O `npm run tutoriais:conferir` existe, mas não roda no CI** (0 ocorrências em `.github/workflows/`); o Art. 46 continua sem trava para o tutorial. Não alterado aqui.
6. **Atrito:** todo PR que mexe em código de módulo passa a exigir uma edição de documento ou um `Docs: não se aplica`. Em modo aviso o custo é só ler a mensagem.

## 6. Lei proposta (Art. 52) — **NÃO aplicada; aguarda o "Confirmo" do Gelson para esta emenda**

**Motivo:** o Gelson pediu (02/11/2026) que nenhum documento fique para trás; os Arts. 42 e 46 cobrem só parte e nada verifica.

**Edição 1 — acrescentar ao fim do Título IX, depois do Art. 51:**

> 52. **Art. 52 — Nenhum documento fica para trás** *(emenda de <data da confirmação>, pedido do Gelson)*. Documento é parte da entrega: mudou o comportamento, a regra, a tela, a rota, a tabela, a integração ou a decisão de um módulo, o documento daquele módulo (`docs/modulos/`) é atualizado **no mesmo commit ou PR**, no tema certo (Art. 42), e `docs/rag/` é regenerado (Art. 51). Vale também para o `README.md` (visão geral: só muda quando muda o conceito do produto, a jornada, o glossário ou a lista de módulos; o detalhe de telas e regras mora nos módulos e o README aponta para eles), para a ajuda do "?" e o tutorial (Art. 46) e para a spec do assunto. Mudança sem efeito em documento declara isso num commit do PR (`Docs: não se aplica — <motivo>`). O CI confere (`scripts/check-docs-em-dia.js`) e, quando estiver em modo de falha, **reprova** o PR que muda arquivo de um módulo sem mudar o documento dele nem declarar o motivo. Só o `CLAUDE.md` fica fora: ele muda quando nasce lei nova (Art. 13).

**Edição 2 — título da Constituição:** "51 artigos" passa a "52 artigos … Art. 52 acrescentado em <data>".
**Edição 3 — Índice deste arquivo, item A:** "51 artigos" passa a "52 artigos".
**Edição 4 — logo abaixo da "Emenda de 02/11/2026 (Art. 51)" do Art. 36 (bloco novo):** o job "Validar estrutura do projeto" ganhou o passo "Documentos de módulo em dia com o código", depois do passo do índice RAG; começa em modo aviso e passa a falha por decisão do Gelson; os nomes do job e dos checks não mudam.

Nenhuma seção existente é apagada ou reescrita.

## 7. Decisões que dependem do Gelson

1. "Confirmo" para a emenda do Art. 52 (seção 6).
2. Quando trocar o modo `aviso` por `falha` (sugestão: depois de uma semana de PRs reais com o aviso ligado).
3. Retirar do `CLAUDE.md` as seções de entregas antigas (hoje 121 das 129 seções têm a nota "→ parte já migrada"), se ele quer o arquivo só com leis. É decisão à parte (Art. 50), reversível pelo Git.
