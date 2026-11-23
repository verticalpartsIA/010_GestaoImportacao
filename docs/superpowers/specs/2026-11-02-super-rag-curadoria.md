# Super RAG — camada de curadoria gerada por script (`docs/rag/`)

> **Status:** rascunho de trabalho em branch `claude/super-rag-curadoria` (worktree `.worktrees/rag`), **nada commitado, nada publicado**. Decisões do Gelson em 02/11/2026 (`respostas7.md`). Spec, plano e tarefas juntos (Art. 38).
> **Selos (Art. 6):** **Conferido** = visto agora (comando ou arquivo indicado, 02/11/2026). **Herdado** = veio do pedido do Gelson e não foi reconferido. Faltando selo, vale Não verificado.

## 1. Specify

**Objetivo.** Dar ao "Super RAG" do VP Gestão (Claude Projects, NotebookLM) uma **camada de curadoria** sobre os 17 arquivos de conhecimento (15 documentos de `docs/modulos/`, `CLAUDE.md`, `README.md`): mapa de telas e, por documento, o índice de seções com o selo de cada uma e **de onde o selo veio**. Os próprios arquivos continuam sendo indexados como estão pela ferramenta de RAG: a camada **não copia texto** (Art. 44).

**Requisitos.**
- FR01. Um script (`scripts/gerar-rag.js`, `npm run rag`) gera `docs/rag/` só a partir dos 17 arquivos; nada é escrito à mão.
- FR02. Cada item aponta para `arquivo#âncora` (âncora no padrão do GitHub) e nunca reproduz o texto da fonte.
- FR03. Selo por bloco com herança **bloco → seção → seção-pai → cabeçalho do documento**; o índice mostra a origem; só vira "Não verificado" quando não há selo em nenhum nível. **Faltar selo nunca falha o CI.**
- FR04. O resultado é **idêntico** no Windows (CRLF) e no Linux do CI (LF), no Node 20 e no 24.
- FR05. `--conferir` falha (código 1) quando `docs/rag/` não bate com o que seria gerado agora; o CI roda isso **dentro** do job "Validar estrutura do projeto", sem renomear job nem checks (Art. 36).
- FR06. O mapa de telas confere o id de rota citado em cada documento com `KNOWN_ROUTES` de `src/router.js`.

**Fora do escopo desta rodada.** Commitar `docs/rag/` (a pasta foi gerada na branch em 02/11/2026 a pedido do Gelson; commit só quando ele pedir); gerar o `SUPER_RAG_CONHECIMENTO.md`; corrigir qualquer divergência entre fontes (Art. 12); limpar o Gmail de `CLAUDE.md:997` (**o Gelson decidiu manter**, serve de teste); resolver a issue #1334 do Copiloto.

**Cenários de aceitação** (ligados aos testes de `src/rag-gerador.test.js`, 16 testes).
- Dado um item de lista com subitem e continuação, quando o parser roda, então é **um** bloco.
- Dado um bloco sem selo numa seção em que todos os blocos selados dizem "Conferido", então herda "Conferido" com origem "seção"; se os blocos da seção divergem, vale o mais fraco ("misto").
- Dado um documento sem selo em nenhuma seção, então o bloco herda o do cabeçalho; sem cabeçalho, "Não verificado" com origem "nenhum".
- Dado o mesmo repositório com CRLF e com LF, então os arquivos gerados são byte a byte iguais.
- Dado `docs/rag/` editado à mão, atrasado ou com arquivo sobrando, então `--conferir` sai com 1 e diz qual arquivo.
- Dado um mapa de telas, então toda rota citada que não está em `KNOWN_ROUTES` aparece como "não".

## 2. Clarify — respostas do Gelson (02/11/2026, **Herdado** do `respostas7.md`)

1. Estratégia: **(b)** indexar os documentos reais sem copiar; índice e metadados gerados por script.
2. Local: **(a)** `docs/rag/`, com emenda no `CLAUDE.md`. O texto exato da emenda é mostrado antes (seção 6) e **só se aplica com "Confirmo" para essa emenda**.
3. O derivado **nunca é fonte da verdade**, nunca se edita à mão, e cada item aponta para arquivo e âncora de origem.
4. Selos: **(a)** com herança bloco → seção → cabeçalho, mostrando a origem; sem falhar o CI.
5. CI: **(a)** passo "RAG em dia" dentro do job existente; medir de novo o tempo.
6. Divergências: só relatar. (a) vale o documento (PC-12); (b) **"90 rotas" é registro datado, deixar**; (c) vale o estado real; (d) vale `16_servicos.md` S3.5; (e) relatar; (f) **limpar o Gmail: o Gelson reconsiderou e vai manter** ("serve de testes"); (g) relatar a chave publishable sem repetir o valor.
7. Edição concorrente: **(b)** branch própria; não tocar nos 5 documentos com mudanças não commitadas de outra sessão.

## 3. Plan

- `scripts/gerar-rag.js` (Node puro, sem dependências; CommonJS como `gerar-mapa-rotas.js`). Lê as fontes, normaliza CRLF/LF, faz o parse em seções (títulos `#`) e blocos (parágrafo, item de lista com subitens, tabela, citação; cerca de código é ignorada), resolve o selo e escreve `LEIAME.md`, `mapa-de-telas.md` e `indice/<fonte>.md`.
- **Definição de selo** (a mesma está no `LEIAME.md` gerado): as palavras `Conferido`, `Herdado`, `Não verificado` fora de crases, em qualquer forma (`**Conferido**`, `**Conferido em 31/10/2026:**`, `(Conferido, banco)`, `Selo: …`). Vários no mesmo bloco: o mais fraco. Seção meta (numeração, índice, glossário) e o título/cabeçalho do documento não contam.
- **Selo da seção:** `Selo:` explícito > selo no título > selo único dos blocos (uniforme) > o mais fraco dos blocos (misto).
- **Cabeçalho:** `Fonte da verdade:` ou `Fonte da verdade e selos:` (a grafia do `16_servicos.md`), com data e `origin/main` `<hash>` extraídos quando existem.
- `src/rag-gerador.test.js` (16 testes). `package.json`: `rag` e `rag:conferir`. `.github/workflows/ci.yml`: um passo, depois da conferência dos bundles de PDF e antes dos testes.
- Saída determinística: sem data, sem hash, ordem por ponto de código, sempre LF, links como caminho do repositório (não relativo à pasta de saída).

## 4. Tasks

| # | Tarefa | Situação (02/11/2026) |
|---|---|---|
| T001 | Branch isolada depois de `git fetch` (`origin/main` `f2ddd01`), em worktree `.worktrees/rag`, para não mexer na pasta onde as outras sessões trabalham | **Conferido** (worktree limpo, 1122 arquivos, pasta principal continua com HEAD solto e as mudanças das outras sessões) |
| T002 | Gerador + 16 testes | **Conferido**: 16/16 no Node 24 e no Node 20.20.2; `npm test` completo 947/947 (12 s) |
| T003 | Lint | **Conferido**: ESLint 9.39.5 (a versão do repositório) com `eslint.config.js`: 406 arquivos, 0 erros, 0 avisos (instalado fora do repositório porque o `node_modules` compartilhado está desatualizado e não tem ESLint) |
| T004 | Passo no CI + scripts do `package.json` | **Conferido**: YAML válido (13 passos), `check-cache-bust` ok. **Não executado no GitHub Actions** (sem commit nem PR) |
| T005 | Paridade Windows/Linux | **Conferido**: árvore CRLF do Windows × `git archive HEAD` (LF) geram arquivos **byte a byte iguais** (SHA-256 dos 19 arquivos); `--conferir` do Node 20 aceita a saída gerada pelo Node 24 |
| T006 | Emenda no `CLAUDE.md` | **Aplicada na branch em 02/11/2026, depois do "Confirmo" do Gelson para esta emenda** (5 edições, +5/−2 linhas; só o título, a contagem do índice e acréscimos; sem commit). Conferido: diff, gerador, 16 testes e `npm test` 947/947 depois da edição |
| T007 | Gerar `docs/rag/` | **Gerada na branch em 02/11/2026, a pedido do Gelson (sem commit).** Conferido: 19 arquivos (220 KB), `--conferir` ok, 1.432 linhas de índice = 1.432 títulos reais da fonte com âncora existente, nenhum segredo nem dado pessoal, nenhuma linha de texto copiada. A auditoria por amostra achou um defeito (linha `---` contada como bloco; 98 blocos a menos depois da correção), já corrigido e coberto por teste |

## 5. Analyze — o que o Gelson precisa saber antes de aprovar

1. **O passo de CI só pode entrar no mesmo commit que o primeiro `docs/rag/`.** Antes de gerar, `--conferir` saía com 1 ("faltam" os 19 arquivos): comportamento certo, não vácuo. Com `docs/rag/` gerada na branch ele passa; o commit precisa levar a pasta e o passo juntos. Se o passo entrar sem a pasta, o CI do primeiro PR falha.
2. **Custo de rotina (R1 resolvido, com atrito):** depois do merge, toda sessão que editar `docs/modulos/*.md`, `CLAUDE.md` ou `README.md` precisa rodar `npm run rag` e commitar `docs/rag/`, senão o CI falha. Cada documento tem seu arquivo (`indice/<fonte>.md`), então PRs em documentos diferentes **não** conflitam entre si; só `mapa-de-telas.md` muda quando muda título de tela ou o tema "Rota e arquivos". Na entrega, avisar as sessões ativas. As 5 modificações não commitadas de outras sessões (`01_geral`, `02_crm`, `03_cadastros_mestres`, `04_comercial_pre_venda`, `15_administracao`) vão precisar de `npm run rag` quando forem commitadas.
3. **Tempo do passo:** o gerador leva **0,5 s** (medido, 19 arquivos). Os últimos 12 runs do `ci.yml` no GitHub levaram de **35 a 78 s** (limite do job: 10 min). O passo não muda isso de forma perceptível. **Não medido no GitHub Actions** (precisa de PR).
4. **Medições refeitas (Conferido, 02/11/2026, `HEAD` `f2ddd01`)** — e por que não batem exatamente com as do `respostas7.md`:
   - Blocos: **3.420** nos 15 módulos (3.040 fora das seções meta). Com selo **próprio no texto: 1.160 = 33,9%** (38,2% dos 3.040). O `respostas7.md` fala em 619 de 4.223 (15%); o 619 é praticamente igual às **627** menções que contei no formato exato `**Conferido|Herdado|Não verificado**` em negrito, então a diferença parece ser o **critério de selo** (suposição: o outro cálculo só contou esse formato) e a **definição de bloco**. Com a definição desta spec o percentual é maior; a conclusão do Gelson ("exigir selo por bloco reprovaria o estado atual") **continua valendo**, porque 67% dos blocos não têm selo próprio.
   - Seções (nível 2 ou mais, fora as meta) com selo próprio: **733 de 1.167 = 62,8%** (o `respostas7.md` diz 40%). Idem: depende do critério.
   - **Origem do selo dos blocos fora das seções meta:** próprio 1.160 · da seção 960 · da seção-pai 0 · do cabeçalho 920 · **nenhum 0**. Efeito: **nenhum bloco ficou sem selo**; o selo efetivo é **Conferido 2.305 (75,8%) · Herdado 498 (16,4%) · Não verificado 237 (7,8%)**, e os 237 são "Não verificado" **escrito** no texto ou na seção, não falta de selo. A previsão do `respostas7.md` (cerca de 85% Não verificado sem herança) fica evitada. O degrau "seção-pai" nunca foi usado hoje; fica como proteção.
   - **Atenção ao ler "Conferido por herança do cabeçalho" (920 blocos):** o cabeçalho diz que o **documento** foi conferido contra um commit; ele não prova cada frase. O índice mostra isso (`c`), e um leitor que queira rigor filtra por origem.
   - Seções com selo "misto" (blocos divergentes; vale o mais fraco): **126** de 733. Seção "uniforme": 595. `Selo:` explícito: 11.
   - Tamanho: palavras (por espaços, o que inclui símbolos soltos de Markdown) — `01_geral.md` 22.851, `CLAUDE.md` 86.269, `README.md` 4.101. O `respostas7.md` cita 24.514 e 83.795, que diferem por critério de contagem e talvez pelo estado do arquivo. Todos cabem como estão; não há decisão que dependa dessa diferença.
5. **Cabeçalho "Fonte da verdade" nos 15 documentos:** **14** dizem `Fonte da verdade:` + "conferidos em <data>" + `origin/main` `<hash>`. O `16_servicos.md` diz **`Fonte da verdade e selos:`** e traz a data como "tudo em **01/11/2026**" e `origin/main` `ae64ebf` (sem a frase "conferidos em"). O gerador aceita as duas grafias (teste dedicado); a afirmação "os 15 têm o mesmo cabeçalho" é verdadeira em conteúdo, não em redação.
6. **O mapa de telas já faz uma conferência útil:** **81 telas** nos 15 documentos, **75 citam rota** e **0** citam rota fora de `KNOWN_ROUTES` (as 6 sem rota são S1 a S6, serviços do `16_servicos.md`, que não são telas). O mapa de rotas oficial continua sendo `docs/MAPA_DE_ROTAS.md` (gerado do código).
7. **Limites do gerador (Conferido nos testes, mas é heurística):** um bloco que *descreve* a regra do selo fora das seções meta contaria como selo (achei um caso, a linha 5 de `02_crm.md`, que fica no cabeçalho do documento e por isso é meta); a âncora segue a regra do GitHub, mas ferramentas de RAG não usam âncora (usam o texto), então a âncora serve a quem lê o índice.

## 6. Emenda proposta ao `CLAUDE.md` (Arts. 13 e 47) — **APLICADA na branch em 02/11/2026 depois do "Confirmo" do Gelson para esta emenda (sem commit)**

**Motivo:** o Gelson aprovou (02/11/2026) uma camada de curadoria gerada por script para o Super RAG; a Constituição não prevê um local para documento **derivado**, e sem regra escrita o derivado poderia virar segunda fonte da verdade (Art. 44).

**Edição 1 — acrescentar ao fim do Título IX, depois do Art. 50:**

> 51. **Art. 51 — Documentos derivados e gerados (`docs/rag/`)** *(emenda de 02/11/2026, pedido do Gelson: o Super RAG precisa de uma camada de curadoria que nunca vire segunda fonte da verdade)*. A pasta `docs/rag/` guarda arquivos **gerados** por `scripts/gerar-rag.js` (`npm run rag`) a partir de `docs/modulos/*.md`, `CLAUDE.md` e `README.md`. O conteúdo de `docs/rag/` é **derivado: nunca é fonte da verdade, nunca se edita à mão e não copia o texto dos documentos** (Art. 44). Cada item aponta para o arquivo e a âncora do documento de origem e mostra o selo do Art. 6 e **de onde ele veio** (do próprio bloco, da seção, de uma seção-pai ou do cabeçalho do documento); só é "Não verificado" quando não há selo em nenhum nível. Em divergência entre `docs/rag/` e a origem, **vale a origem**. Quem altera um desses documentos roda `npm run rag` e commita `docs/rag/` junto: o job "Validar estrutura do projeto" confere (`npm run rag:conferir`) e **falha se o índice estiver desatualizado**, mas **nunca falha por falta de selo** num documento.

**Edição 2 — título da Constituição (linha 21):** trocar `— 50 artigos (31/10/2026, aprovada pelo Gelson)` por `— 51 artigos (31/10/2026, aprovada pelo Gelson; Art. 51 acrescentado em 02/11/2026)`.

**Edição 3 — Índice deste arquivo, item A (linha 126):** trocar `(Títulos I a IX, 50 artigos)` por `(Títulos I a IX, 51 artigos)`.

**Edição 4 — logo abaixo da "Emenda de 02/11/2026 (PR #1341)" do Art. 36 (acrescentar bloco novo, sem tocar no existente):**

> **Emenda de 02/11/2026 (Art. 51):** o job "Validar estrutura do projeto" ganhou o passo "Índice RAG (docs/rag) em dia com os documentos", depois da conferência dos bundles de PDF e antes dos testes unitários. Editou `docs/modulos/*.md`, `CLAUDE.md` ou `README.md`? Rode `npm run rag` e commite `docs/rag/`, senão o CI falha. Os nomes do job e dos checks do Art. 36 não mudam.

**Edição 5 — Glossário (depois de "Doação de benefícios"):**

> - **Derivado gerado:** arquivo produzido por script a partir dos documentos (hoje `docs/rag/`); nunca é fonte da verdade, nunca se edita à mão e em divergência vale a origem (Art. 51).

Nada mais no `CLAUDE.md` muda. Nenhuma seção existente é apagada ou reescrita (Art. 13).

## 7. Divergências entre fontes — **relatadas, nenhuma corrigida** (Art. 12)

Reconferidas em 02/11/2026 no commit `f2ddd01` (e, quando indicado, no banco ou nas funções de produção):

- **(a) Parte comum do Geral:** `CLAUDE.md` linhas **135** e **177** dizem "PC-1 a PC-11"; `01_geral.md` tem os cabeçalhos PC-1 a **PC-12** (a PC-12 está no `HEAD`, não é só mudança local). **Vale o documento de módulo** (decisão do Gelson).
- **(b) "90 rotas" (`CLAUDE.md:1473`):** **não é divergência.** A linha está na seção "Formulário de Escada/Esteira Rolante … (29/10/2026)", acrescentada pelo commit `46574c1` (#1166) como registro datado do que o mapa dizia naquele dia. Hoje o código e o mapa dizem **89** rotas, **75** de menu e **17** com abas. **Retiro** o que escrevi antes, quando tratei como divergência. Nada a fazer.
- **(c) "sugestão" dos nomes (`CLAUDE.md:166`):** o texto diz que os nomes dos módulos 4 a 14 "são sugestão"; os 15 arquivos existem em `docs/modulos/`. **Vale o estado real.**
- **(d) Copiloto:** o Copiloto em uso é o da VPS e **não** lê `vp_copiloto_docs` (`16_servicos.md` S3.5). Na tabela de produção há **8 linhas**: `ecossistema`, `regras` e **6** `rota:` (`cadastro-custos`, `formulario-elevador`, `formulario-quadro-comando`, `precificacao`, `proposta-editor`, `solicitacoes-produto`): **seis telas, não cinco**. `04_comercial_pre_venda.md` se contradiz: a linha **636** ainda manda ajustar por `UPDATE` ("Herdado, a tabela não foi consultada") e a linha **679** diz que isso só valia para a função antiga, removida em 01/11/2026. `06_contratos_juridico.md` (linha 400) e `08_engenharia_produto.md` (linha 172) também descrevem o mecanismo antigo no corpo; `04`, `05`, `06`, `08` e `10` têm no fim a nota "Recebido de Serviços" que corrige (o `11` só descreve o que a tabela não tem). A issue #1334 continua fora do escopo.
- **(e) Funções:** `15_administracao.md` (PC-6, já no `HEAD`) diz **43** em produção e **42** pastas. Hoje: **41** funções ACTIVE em produção (`list_edge_functions`, projeto `jxtqwzmpgofwctqajewt`) e **40** pastas em `supabase/functions/`. A única em produção sem pasta é `conferir-clientes-omie` (v1, criada em 01/11/2026 às 04h12 UTC), o que viola o Art. 23. Nenhuma pasta fica sem função em produção.
- **(f) Gmail de terceiro em `CLAUDE.md:997`:** **mantido por decisão do Gelson** ("serve de testes"). Não será limpo. Fica registrado que o Art. 28 diz o contrário.
- **(g) Chave "publishable" do Supabase:** aparece em `.claude/agents/ceo-agent.md` (1 vez), `.claude/agents/database-agent.md` (2 vezes) e em `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md` (1 vez), no formato `sb_publishable_…`. Não é segredo (é a chave pública do app). **Nenhuma `sb_secret_`** nesses arquivos. O valor **não** foi copiado para este documento nem para o índice.

## 8. Próximos passos (cada um com "Confirmo" ou pedido do Gelson)

1. ~~"Confirmo" para a emenda da seção 6~~ — feito em 02/11/2026; o "Confirmo" vale só para essa emenda (Art. 14).
2. Pedido de geração → rodar `npm run rag`, revisar uma amostra de itens contra a origem, commitar `docs/rag/` **junto** com o passo de CI (Art. 39: só quando o Gelson pedir commit/PR).
3. Depois: o `SUPER_RAG_CONHECIMENTO.md`/glossário/divergências curados (a parte manual da camada, fora de `docs/rag/`).
