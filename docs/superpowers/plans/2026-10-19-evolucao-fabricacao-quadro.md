# Evolução da Fabricação do Quadro de Comando — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every quadro de comando OP (`pcp_ordens`, `frente='quadro'`) a 6-step fabrication timeline, filled by the shop-floor worker through a no-login link, plus a self-contained "ocorrência" (missing-material) flow that never disturbs the timeline's own reading.

**Architecture:** New table family (`fabricacao_quadro_*`) keyed by `pcp_ordens.id`, mirroring the proven `acompanhamento_obra_*` engine (weighted checklist, append-mostly, link-driven) but without photo/EXIF/geolocation. One internal screen (cards, one per in-progress OP) and one public page (checklist + ocorrências), same split as Dossiê da Obra / `diario-obra.html`.

**Tech Stack:** React 18 UMD + Babel Standalone (no bundler), Supabase (Postgres + supabase-js v2), Node/Express static server — all matching the existing project setup. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-evolucao-fabricacao-quadro-design.md`

## Global Constraints

- No new npm dependency — this project ships React/Babel/Supabase via CDN `<script>` tags, zero bundler (see any `*.html` entrypoint).
- Public page carries **no mandatory photo, no camera, no EXIF/geolocation checks** — spec §3/§6, explicit decision (internal employee, not a 3rd-party installer).
- The 6 steps are fixed and in this exact order (spec §3): 1 Furação do gabinete · 2 Fixação de calhas e trilhos DIN · 3 Acoplagem de disjuntores e contatores; fixação de botoeira de inspeção, inversor, resgate, base de terminais e barramento de fio-terra · 4 Fiação de ligação entre terminais, placas e outros componentes (origem e destino) · 5 Fixação do resistor de frenagem · 6 Teste do quadro.
- Weights are equal, summing to exactly 100 (spec §8.3-4): 17, 17, 17, 17, 16, 16 for steps 1–6 in order.
- Steps can be flagged in **any order** (spec §8.2) — "current step" is a derived value (first unflagged item by `ordem`), never a stored state.
- The public link only **adds** (flags a step, opens/resolves an occurrence); un-flagging a step is **internal-only**, gated by a new alçada `fabricacao.editar_status_quadro` (spec §8.3-5).
- "Pausado" is **never a stored column** — it's computed as "exists an open occurrence on this OP with `tem_frente_trabalho = false`" (spec §4/§8.5-7).
- Occurrence's `codigo_produto` is **suggested** from that quadro's own BOM (`quadros_comando_bom_itens.sku`/`.descricao`) but must accept any typed value, including one that doesn't exist in the BOM (spec §8.5-9, e.g. "falta uma ferramenta").
- Each OP (`pcp_ordens.id`) owns its own independent timeline — a 2nd OP for the same `quadro_comando_id` (rework) starts at 0%, never inherits a prior OP's progress (spec §8.5-7).
- Cards on the internal screen show every `pcp_ordens` row with `frente = 'quadro'` and `status` in `('aguardando', 'em_producao')` — `concluida`/`cancelada` never appear (spec §5/§8.5-8).
- No requisition auto-generation, no automatic notification to Compras/Almoxarifado — explicitly out of scope (spec §7.5, §9).
- RLS on the new tables mirrors the **live, already-accepted** policy on `acompanhamento_obra_*` (confirmed via `pg_policies` on project `jxtqwzmpgofwctqajewt`: a single `ALL`/`public`/`qual=true`/`with_check=true` policy per table) — do not invent a stricter model for this feature alone; that's tracked separately under issues #960/#961.

## Review Focus

- **Invalid/expired token on the public page** (bad paste, revoked link): must render "link não encontrado" like `diario-obra-app.jsx` does, never a blank page or a thrown error.
- **Occurrence submitted with no code typed, or without answering "tem frente de trabalho?"**: must block submission with a clear message, never silently create a half-filled row.
- **Rework (2nd OP for the same `quadro_comando_id`)**: the two OPs must show as two independent cards with independent progress — no accidental merge/collision on `quadro_comando_id`.
- **An OP with other occurrences still open (`tem_frente_trabalho = true`) when the *blocking* one resolves**: "pausado" must flip back to false as soon as no occurrence with `tem_frente_trabalho = false` remains open, regardless of how many non-blocking ones stay open.
- **Flagging a step that's already flagged** (double-tap, slow network retry): must be idempotent — no duplicate row, no error surfaced to the worker.

---

## Task 1: Database schema

**Files:**
- Create: `supabase/migrations/20261019200000_fabricacao_quadro_schema.sql`

**Interfaces:**
- Produces: tables `fabricacao_quadro_itens(id, texto, ordem, peso)`, `fabricacao_quadro_links(id, ordem_id, token, criado_por, criado_em)`, `fabricacao_quadro_status(id, ordem_id, item_id, flegado, flegado_em, flegado_por)`, `fabricacao_quadro_ocorrencias(id, ordem_id, codigo_produto, descricao_produto, tem_frente_trabalho, status, aberta_em, resolvida_em)`. `ordem_id` references `pcp_ordens(id)`. `fabricacao_quadro_status` has a unique constraint on `(ordem_id, item_id)` (upsert target). `fabricacao_quadro_ocorrencias.status` check `in ('aberta','resolvida')`.

Note: the original spec draft (§4) included an optional `observacao` text column on `fabricacao_quadro_status`. Dropped here — no screen in this plan writes to it, and nothing in the confirmed decisions (spec §8.1/§8.3/§8.5) asks for it. Add it back only if a future request needs it.

- [ ] **Step 1: Write the migration file**

```sql
create table if not exists public.fabricacao_quadro_itens (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  ordem int not null,
  peso numeric not null
);
insert into public.fabricacao_quadro_itens (texto, ordem, peso) values
  ('Furação do gabinete', 1, 17),
  ('Fixação de calhas e trilhos DIN', 2, 17),
  ('Acoplagem de disjuntores e contatores; fixação de botoeira de inspeção, inversor, resgate, base de terminais e barramento de fio-terra', 3, 17),
  ('Fiação de ligação entre terminais, placas e outros componentes (origem e destino)', 4, 17),
  ('Fixação do resistor de frenagem', 5, 16),
  ('Teste do quadro', 6, 16);

create table if not exists public.fabricacao_quadro_links (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  token text not null unique,
  criado_por text,
  criado_em timestamptz not null default now()
);

create table if not exists public.fabricacao_quadro_status (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  item_id uuid not null references public.fabricacao_quadro_itens(id),
  flegado boolean not null default false,
  flegado_em timestamptz,
  flegado_por text,
  unique (ordem_id, item_id)
);

create table if not exists public.fabricacao_quadro_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  codigo_produto text not null,
  descricao_produto text,
  tem_frente_trabalho boolean not null,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  aberta_em timestamptz not null default now(),
  resolvida_em timestamptz
);
create index if not exists idx_fab_quadro_status_ordem on public.fabricacao_quadro_status (ordem_id);
create index if not exists idx_fab_quadro_ocorrencias_ordem on public.fabricacao_quadro_ocorrencias (ordem_id);

alter table public.fabricacao_quadro_itens enable row level security;
alter table public.fabricacao_quadro_links enable row level security;
alter table public.fabricacao_quadro_status enable row level security;
alter table public.fabricacao_quadro_ocorrencias enable row level security;
create policy allow_all_fab_quadro_itens on public.fabricacao_quadro_itens for all using (true) with check (true);
create policy allow_all_fab_quadro_links on public.fabricacao_quadro_links for all using (true) with check (true);
create policy allow_all_fab_quadro_status on public.fabricacao_quadro_status for all using (true) with check (true);
create policy allow_all_fab_quadro_ocorrencias on public.fabricacao_quadro_ocorrencias for all using (true) with check (true);
```

Load `supabase-postgres-best-practices` before touching this file if anything about the RLS shape looks off from what's described above — don't improvise a different policy for just this feature.

- [ ] **Step 2: Apply the migration to project `jxtqwzmpgofwctqajewt`**

This is a schema-write (CREATE) — requires the user's explicit **"CONFIRMO"** per this project's own governance (`vp-mcps` skill). Do not apply without it.

- [ ] **Step 3: Verify**

Run: `select tablename from pg_tables where tablename like 'fabricacao_quadro%';` — expect 4 rows. Run: `select texto, ordem, peso from fabricacao_quadro_itens order by ordem;` — expect the 6 rows above, peso summing to 100.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261019200000_fabricacao_quadro_schema.sql
git commit -m "feat: add fabricacao_quadro_* schema for the fabrication timeline"
```

---

## Task 2: Pure calc engine

**Files:**
- Create: `src/fabricacao-quadro-calc.js`
- Test: `src/fabricacao-quadro-calc.test.js`

**Interfaces:**
- Consumes: nothing (pure module, no Supabase, no `window.AcompanhamentoObraStore`).
- Produces: `window.FabricacaoQuadroCalc = { resumoProgresso(statusRows) -> {pct}, etapaAtualId(statusRows) -> string|null, estaPausado(ocorrencias) -> boolean }`.
  - `statusRows`: `[{ item_id, flegado, fabricacao_quadro_itens: { ordem, peso } }]` (shape matches a Supabase `.select('*, fabricacao_quadro_itens(ordem, peso)')`).
  - `ocorrencias`: `[{ status: 'aberta'|'resolvida', tem_frente_trabalho: boolean }]`.

- [ ] **Step 1: Write the failing tests**

```js
test('resumoProgresso: ponderado, 100% só com tudo flegado', () => {
  const rows = (pesos, flegados) => pesos.map((peso, i) => ({ item_id: 'i' + i, flegado: flegados[i], fabricacao_quadro_itens: { ordem: i + 1, peso } }));
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,false,false,false,false])).pct, 34);
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,true,true,true,false])).pct, 99); // falta 1 item: teto 99, nunca 100
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,true,true,true,true])).pct, 100);
});

test('resumoProgresso: sem linhas devolve 0', () => {
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso([]).pct, 0);
});

test('etapaAtualId: primeiro item não flegado, por ordem (não por posição no array)', () => {
  const rows = [
    { item_id: 'c', flegado: false, fabricacao_quadro_itens: { ordem: 3, peso: 17 } },
    { item_id: 'a', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 17 } },
    { item_id: 'b', flegado: false, fabricacao_quadro_itens: { ordem: 2, peso: 17 } },
  ];
  assert.equal(window.FabricacaoQuadroCalc.etapaAtualId(rows), 'b');
});

test('etapaAtualId: tudo flegado devolve null', () => {
  const rows = [{ item_id: 'a', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 100 } }];
  assert.equal(window.FabricacaoQuadroCalc.etapaAtualId(rows), null);
});

// Review Focus: rework — progresso de uma OP não vaza pra outra (cada chamada só recebe as linhas da própria ordem_id; teste confirma que a função não agrega nada global).
test('resumoProgresso: 2 OPs do mesmo quadro, chamadas separadas, não se misturam', () => {
  const rowsOpA = [{ item_id: 'a1', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 17 } }];
  const rowsOpB = [{ item_id: 'b1', flegado: false, fabricacao_quadro_itens: { ordem: 1, peso: 17 } }];
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rowsOpA).pct, 17);
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rowsOpB).pct, 0);
});

// Review Focus: despausar quando a ocorrência bloqueante resolve, mesmo com outra ocorrência aberta "com frente de trabalho".
test('estaPausado: só true quando existe ABERTA com tem_frente_trabalho=false', () => {
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([
    { status: 'aberta', tem_frente_trabalho: true },
    { status: 'resolvida', tem_frente_trabalho: false },
  ]), false);
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([
    { status: 'aberta', tem_frente_trabalho: true },
    { status: 'aberta', tem_frente_trabalho: false },
  ]), true);
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([]), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node scripts/run-tests.js` (or target the single file if the runner supports a path filter — check `scripts/run-tests.js` for how `mapa-obras-calc.test.js` is picked up and mirror that).
Expected: FAIL — `window.FabricacaoQuadroCalc is not defined`.

- [ ] **Step 3: Implement `src/fabricacao-quadro-calc.js`**

Same weighted-sum / floor-to-99-until-complete algorithm as `acompanhamento-obra-store.js:resumoProgresso` (lines 220–245 of that file), adapted to:
- read the embedded relation key `fabricacao_quadro_itens` instead of `acompanhamento_obra_itens`;
- return only `{ pct }` (no `marcos`, no `criado`, no `iniciadoEm` — this feature has no 50/75/100 milestone events to trigger, unlike the Diário de Obra's `_checarMetadeExecucao`);
- keep the same "100% only if every row is flagged AND the weights sum to ≥100" guard that `acompanhamento-obra-store.js` added on 2026-10-19 (same file this session reviewed) — it's a real, recently-hit bug (a link seeded before all 6 rows exist must never show 100%).

`etapaAtualId(statusRows)`: sort a copy of `statusRows` by `fabricacao_quadro_itens.ordem`, return the first `item_id` where `flegado` is falsy, else `null`.

`estaPausado(ocorrencias)`: `(ocorrencias || []).some((o) => o.status === 'aberta' && o.tem_frente_trabalho === false)`.

Expose as `window.FabricacaoQuadroCalc = { resumoProgresso, etapaAtualId, estaPausado }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node scripts/run-tests.js`
Expected: PASS, all new tests green, no regression in the existing 636.

- [ ] **Step 5: Commit**

```bash
git add src/fabricacao-quadro-calc.js src/fabricacao-quadro-calc.test.js
git commit -m "feat: pure progress/pause engine for the fabrication timeline"
```

---

## Task 3: Store (Supabase calls)

**Files:**
- Create: `src/fabricacao-quadro-store.js`

**Interfaces:**
- Consumes: `window.FabricacaoQuadroCalc` (Task 2), `window.__VP_SB.sb` (existing Supabase client global).
- Produces: `window.FabricacaoQuadroStore` with:
  - `listarItens() -> Promise<Item[]>`
  - `obterLink(ordemId) -> Promise<Link|null>`
  - `criarOuObterLink(ordemId, criadoPor) -> Promise<Link>` — seeds `fabricacao_quadro_status` (one row per item, `flegado:false`) on first call, same `upsert ... ignoreDuplicates:true` pattern as `acompanhamento-obra-store.js:criarOuObterLink`.
  - `obterEstadoOrdem(ordemId) -> Promise<{ ordem, status, ocorrencias }>` — `ordem` is the `pcp_ordens` row joined with `quadros_comando` (cliente, modelo) and `quadros_comando_bom_itens` (for the occurrence datalist).
  - `obterEstadoPorToken(token) -> Promise<{ link, ordem, status, ocorrencias }|null>` — looks up `fabricacao_quadro_links` by token, then delegates to `obterEstadoOrdem`.
  - `marcarEtapa(ordemId, itemId, flegadoPor) -> Promise<void>` — upsert `flegado:true, flegado_em:now, flegado_por:flegadoPor||null` on `(ordemId, itemId)`. `flegadoPor` is `null` when called from the public page (mirrors `acompanhamento-obra-store.js:registrarLancamento`'s `flegado_por`).
  - `desmarcarEtapa(ordemId, itemId, operadorEmail) -> Promise<void>` — update `flegado:false`. No internal alçada check here (same as `acompanhamento-obra-store.js:desflegarItem`) — the caller (Task 4's screen) gates the button with `temCapacidade`.
  - `listarOcorrencias(ordemId) -> Promise<Ocorrencia[]>`
  - `abrirOcorrencia(ordemId, codigoProduto, descricaoProduto, temFrenteTrabalho) -> Promise<void>`
  - `resolverOcorrencia(ocorrenciaId) -> Promise<void>` — `status:'resolvida', resolvida_em:now()`.
  - `listarOPsAbertas() -> Promise<OP[]>` — `pcp_ordens` where `frente='quadro' and status in ('aguardando','em_producao')`, joined with `quadros_comando`/`quadros_comando_maquina` for the card header (cliente, nº pedido, tensão/potência).

No unit test file for this task — matches the existing convention: `acompanhamento-obra-store.js` (its direct model) has zero automated tests; only its `-calc` sibling is tested. Verification here is manual, against the live dev server, once Task 1's migration is applied.

- [ ] **Step 1: Implement `src/fabricacao-quadro-store.js`**

Use `acompanhamento-obra-store.js` as the line-by-line template for `gerarToken()`, `criarOuObterLink`, the upsert shape in `marcarEtapa`/`desmarcarEtapa`, and the token lookup in `obterEstadoPorToken`. Table names and the `resumoProgresso`/`estaPausado` calls come from Task 2's `window.FabricacaoQuadroCalc` — do not re-implement that math here.

- [ ] **Step 2: Manual verification against `npm run dev`**

With Task 1's migration applied: create a test `pcp_ordens` row (`frente='quadro'`, `status='aguardando'`, any `quadro_comando_id`), call `criarOuObterLink` from the browser console, confirm `fabricacao_quadro_status` gets 6 seeded rows and a token comes back.

- [ ] **Step 3: Commit**

```bash
git add src/fabricacao-quadro-store.js
git commit -m "feat: Supabase store for the fabrication timeline"
```

---

## Task 4: Internal screen — "Evolução da Fabricação"

**Files:**
- Create: `src/evolucao-fabricacao-quadro.jsx`
- Modify: `src/router.js` (`KNOWN_ROUTES` array, add `'evolucao-fabricacao'` — insert it in the existing `'almoxarifado', 'carga-maquina', 'montagem-produto', ...` group per the file's own comment that this list must mirror `app.jsx`'s `switch(route)`)
- Modify: `src/shell.jsx` — add `{ id: "evolucao-fabricacao", label: "Evolução da Fabricação", icon: "history" }` right after the `"montagem-produto"` entry in the `Fabricação` nav group (line ~141), and add `"evolucao-fabricacao": { module: "Logística", page: "Evolução da Fabricação", icon: "history" }` to `BREADCRUMB_MAP` (next to the `"montagem-produto"` entry, line ~396) — same `module: "Logística"` as the rest of the Fabricação group (confirmed: the group's URLs stay under `/logistica/...`, the "Fabricação" label is purely a sidebar grouping).
- Modify: `src/app.jsx` — add `case "evolucao-fabricacao": return <window.EvolucaoFabricacaoQuadroPage setRoute={setRoute} setSubsel={setSubsel}/>;` next to the existing `"montagem-produto"` case.
- Modify: `src/financeiro.jsx` — add one row to `ALCADAS_PROPOSTAS` (line ~1399, next to the `instalacao.editar_status_obra` row): `{ modulo: 'fabricacao', capacidade: 'editar_status_quadro', label: 'Edita status da Evolução da Fabricação', hint: 'Pode desmarcar uma etapa da fabricação do quadro de comando marcada por engano.' }`. This list is **read-only documentation** in this repo — granting the capacity to a person happens outside this repo (vpsistema.com/administração), not in this task.
- Modify: `index.html` — add `<script src="/src/fabricacao-quadro-calc.js?v=1"></script>`, `<script src="/src/fabricacao-quadro-store.js?v=1"></script>`, `<script type="text/vp-jsx" src="/src/evolucao-fabricacao-quadro.jsx?v=1"></script>` right after the existing `evolucao-equipamentos.jsx` script tags (line ~268 area).

**Interfaces:**
- Consumes: `window.FabricacaoQuadroStore` (Task 3), `window.FabricacaoQuadroCalc` (Task 2), `window.PropostaStore.temCapacidade` (existing global), the shared `Button`/`Card`/`KPI` components already used by `evolucao-equipamentos.jsx`.
- Produces: `window.EvolucaoFabricacaoQuadroPage` — a React component taking `{ setRoute, setSubsel }` (same prop shape as `MontagemProdutoPage`/`SimulacaoProducaoPage`), self-contained (loads its own data via `FabricacaoQuadroStore.listarOPsAbertas()`).

- [ ] **Step 1: Implement `src/evolucao-fabricacao-quadro.jsx`**

One card per OP from `listarOPsAbertas()`. Per card: header (cliente, nº pedido, tensão/potência from `quadros_comando`/`quadros_comando_maquina`), a 6-node timeline (reuse the visual language of `evolucao-equipamentos.jsx`'s `.ev-trilha`/`.ev-no` CSS and pulsing-current-node pattern — `etapaAtualId` from Task 2 picks which node pulses), a `%` readout from `resumoProgresso`, a "Gerar link" button (same copy-to-clipboard + toast pattern as `dossier-obra.jsx:gerarLink`, pointing at `/fabricacao-quadro/<token>`), and a separate "Ocorrências" section below the timeline listing open (pulsing) and resolved occurrences for that OP. Steps are clickable checkboxes; unchecking only renders when `temCapacidade('fabricacao', 'editar_status_quadro')` resolves true, calling `desmarcarEtapa`.

- [ ] **Step 2: Regenerate the route map**

Run: `node scripts/gerar-mapa-rotas.js`
Expected: `docs/MAPA_DE_ROTAS.md` gains the new route, no other route changes.

- [ ] **Step 3: Manual verification**

Open `/logistica/evolucao-fabricacao` with the dev server running and the migration applied; confirm the test OP from Task 3's verification shows as a card with 6 zeroed steps and a working "Gerar link" button.

- [ ] **Step 4: Commit**

```bash
git add src/evolucao-fabricacao-quadro.jsx src/router.js src/shell.jsx src/app.jsx src/financeiro.jsx index.html docs/MAPA_DE_ROTAS.md
git commit -m "feat: Evolução da Fabricação screen (internal, per-OP timeline)"
```

---

## Task 5: Public page — worker's link

**Files:**
- Create: `fabricacao-quadro.html` (molded on `diario-obra.html`)
- Create: `src/fabricacao-quadro-app.jsx` (molded on `diario-obra-app.jsx`, **without** `CameraCaptura`, `lerExifTiff`, `lerDataExif`, `obterLocalizacao` — none of that applies here)
- Modify: `server.js` — add `app.get('/fabricacao-quadro/:token', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'fabricacao-quadro.html')); });` next to the existing `/diario-obra/:token` route (line ~356); add `'fabricacao-quadro.html'` to the `PUBLIC_ROOT_FILES` set (line ~391–394) — **without this, the static-file allowlist 404s the page even though the route exists**.

**Interfaces:**
- Consumes: `window.FabricacaoQuadroStore` (Task 3).
- Produces: a mounted React root at `#fq-root`, no exports (standalone page, matches `diario-obra-app.jsx`).

- [ ] **Step 1: Write `fabricacao-quadro.html`**

Copy `diario-obra.html`'s `<head>` (same CDN script tags/versions, same `window.__VP_SB` inline bootstrap pointed at the same `jxtqwzmpgofwctqajewt` project) with title "Fabricação do Quadro de Comando · Vertical Parts" and root id `fq-root`. Script tags: `<script src="/src/fabricacao-quadro-calc.js?v=1"></script>`, `<script src="/src/fabricacao-quadro-store.js?v=1"></script>`, `<script type="text/babel" src="/src/fabricacao-quadro-app.jsx?v=1"></script>`.

- [ ] **Step 2: Implement `src/fabricacao-quadro-app.jsx`**

Read token from `/fabricacao-quadro/<token>` path (same regex approach as `diario-obra-app.jsx:tokenDoPath`). Load state via `FabricacaoQuadroStore.obterEstadoPorToken(token)`. Render: progress bar (`resumoProgresso`), 6 checkboxes (checking calls `marcarEtapa(ordemId, itemId, null)` immediately — no batching, no "enviar" button, since there's no photo upload to wait on), a "pausado" banner when `estaPausado(ocorrencias)` is true, a "Relatar falta de material" form (text input with a `<datalist>` suggesting `quadros_comando_bom_itens.sku` — `descricao` as the visible label — but submittable with any typed value) that, on submit, asks "Tem frente de trabalho?" (two buttons, not a native `confirm()`/`alert()` dialog) before calling `abrirOcorrencia`, and a separate occurrences list below with a "Chegou — resolver" button per open row calling `resolverOcorrencia`.
- Review Focus: invalid/missing token renders "Link não encontrado ou expirado." (same text/behavior as `diario-obra-app.jsx` lines 188–190) instead of a blank screen.
- Review Focus: the occurrence form's submit button is disabled (or shows an inline message) until both a non-empty code and a frente-de-trabalho answer are present — never silently drops an incomplete report.
- Review Focus: `marcarEtapa` on an already-flagged step is a no-op from the UI's own state (checkbox already `disabled` once `flegado`, mirroring `ItemLinha`'s `disabled={!!flegado || enviando}` in `diario-obra-app.jsx`) — document this as the idempotency guard rather than relying on the DB upsert alone.

- [ ] **Step 3: Manual verification on a phone**

Generate a link from Task 4's screen, open it on a phone, flag all 6 steps, report an occurrence with "tem frente de trabalho = não", confirm the internal screen (Task 4) shows the OP as pausado, resolve the occurrence from the public page, confirm it un-pauses.

- [ ] **Step 4: Commit**

```bash
git add fabricacao-quadro.html src/fabricacao-quadro-app.jsx server.js
git commit -m "feat: public fabrication-timeline page for the shop-floor link"
```

---

## Task 6: Full-suite regression check

**Files:** none (verification-only task).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including all pre-existing 636 tests plus Task 2's new ones — nothing in `acompanhamento-obra-store.js`, `evolucao-equipamentos.jsx`, or `evolucao-equipamentos-calc.js` was modified by this plan, so none of those tests should change behavior.

- [ ] **Step 2: Walk the spec's §11 checklist live**

(1) weighted `%` matches between the internal card and the public page for the same OP; (2) "tem frente de trabalho = sim" keeps the timeline editable while an occurrence stays open; (3) "não" pauses the OP on the internal screen; (4) resolving the occurrence un-pauses it; (5) a quadro with a 2nd (rework) OP shows two independent cards.

- [ ] **Step 3: Commit (if any fix was needed)**

```bash
git add -A
git commit -m "fix: address regressions found in full-suite check"
```
