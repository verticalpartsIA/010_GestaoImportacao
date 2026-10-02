# Autenticação real + RLS fechada (#571) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o banco só responder a usuários autenticados e autorizados, eliminando as 301 políticas RLS abertas ao papel anônimo (130 tabelas) e os buckets/RPCs abertos, **sem derrubar nenhum fluxo de produção** (incluindo as páginas públicas de assinatura e do fornecedor).

**Architecture:** (1) Identidade: o vpprd passa a aceitar diretamente os JWTs do projeto vpsistema (Supabase *Third-Party Auth* via JWKS ES256); o front mantém uma sessão vpsistema com refresh e injeta o token no cliente do vpprd (`accessToken`). (2) Autorização: funções SQL (`vp_usuario_ativo`, `vp_eh_admin`, `vp_tem_capacidade`) espelham a regra que hoje só existe no navegador (`perfis.nivel` + `alcadas_capacidade`), e um gerador de políticas (`vp_fechar_tabela`) fecha tabela por tabela, com backup e reversão exata. (3) Caminhos públicos (assinatura, fornecedor, formulário do cliente…): deixam de ler/escrever tabelas e passam a RPC/Edge Function que valida o token do documento; a cascata de assinatura vira server-side. Rollout em ondas com modo sombra, observação e rollback por onda.

**Tech Stack:** Supabase (Postgres RLS, Third-Party Auth, Edge Functions Deno, Storage), supabase-js v2 (UMD, sem build), React UMD/Babel, node:test, Playwright (via MCP do navegador embutido).

**Spec:** issue [#571](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/571) (+ o comentário de agravante sobre tokens) e as issues #572/#573/#584 já resolvidas. Evidências coletadas em 02/10/2026 estão na seção "Fatos verificados" abaixo.

## Global Constraints

- **Sem etapa de build.** Todo `.js/.jsx` novo entra no `index.html` (e `assinar.html` etc. quando a página usar) **com `?v=N` incrementado a cada edição** — conferir contra `origin/main` no momento do merge (lição do PR #529).
- **Áreas blindadas do CLAUDE.md** (Inbox/e-mail, Central de Decisões, Preço de Containers, Mão de obra, etc.): **parar, informar o usuário e pedir confirmação explícita antes de editar**. Este plano toca em: `send-email`, `read-inbox`, `EmailInbox`, `FEComunicacaoFornecedor` (Tasks 8 e 12) — cada um exige o aviso.
- **Projeto Supabase do app:** `jxtqwzmpgofwctqajewt` (vpprd). **Projeto de identidade:** `ubdkoqxfwcraftesgmbw` (vpsistema) — fora deste repo, não alterar nada nele sem o dono.
- **Break-glass da API de gerenciamento do Supabase está desligado** (`SUPABASE_ALLOW_BREAK_GLASS=false`): configurações de Auth (Third-Party Auth, JWT) **só o usuário faz no painel/API com o token dele** — o plano marca esses passos como **[AÇÃO DO USUÁRIO]**. Não contornar (nem usando `~/.supabase/access-token`).
- **Deploy de Edge Function:** usar `deploy_edge_function` do MCP `6af018ee…` (empacota dependências) e **testar o boot numa cópia descartável** antes. A `sb_deploy_edge_function` do MCP `65e71fcf…` já causou BOOT_ERROR.
- **Cada migration tem rollback documentado e testado.** Nenhuma tabela é fechada sem `vp_policy_backup` preenchido.
- **Dado de teste em produção** leva o rótulo `Claude teste notebook` + data e é removido ao fim (soft-delete pela UI). **Nunca** enviar e-mail real a terceiros nem escrever no Omie fora de teste autorizado.
- **Segredos nunca entram no git** (nem em migration, log ou resposta). Senha de usuário de desenvolvimento é digitada em runtime.
- **Hooks do projeto (GateGuard)** exigem apresentar fatos antes do 1º `Write`/`Edit` de cada arquivo — apresentar e repetir a operação.
- `npm test` deve continuar verde (188/188 depois do PR da issue #577).

## Fatos verificados (02/10/2026)

| Fato | Evidência |
|---|---|
| 130 tabelas e 301 políticas abertas a `anon`/`public` | `pg_policies` |
| O app **nunca usou Supabase Auth** | `auth.users` tem 1 linha; todo request sai com a chave publishable (`src/supabase.js:11`) |
| O `sso_token` do vpsistema é usado **uma vez** e some da URL; só o e-mail fica em `sessionStorage` (forjável) | `src/supabase.js` (`ssoGuard`) — só lê `sso_token`, **não** lê `sso_refresh` |
| O projeto vpsistema publica **uma chave ES256** no JWKS | `https://ubdkoqxfwcraftesgmbw.supabase.co/auth/v1/.well-known/jwks.json` → `kty EC / alg ES256 / kid e517faf6-d251-4782-92ed-294520b083a0` ⇒ Third-Party Auth por JWKS é viável (a confirmar na Task 1 decodificando um token real) |
| Identidade/permissão já existem | `perfis` (36: 24 Colaborador, 7 Gestor, 5 Administrador, todos ativos; `email, nivel, ativo`), `alcadas_capacidade` (329 linhas: `perfil_id, modulo, capacidade`), `colaboradores_vpsistema` (48). Regra do app: `nivel = 'Administrador'` passa em tudo; senão consulta `alcadas_capacidade` (`proposta-store.js:586`) |
| Superfície do front | 784 chamadas `.from(`, 80 arquivos, 49 `storage.from`, 4 arquivos com Realtime, 13 Edge Functions chamadas do navegador, 3 RPCs (`next_doc_number`, `gerar_codigo_cliente`, `gerar_numero_precificacao_elevador`) |
| Páginas públicas (HTML próprio) | `assinar`, `cotacao`, `cotacao-elevador-fornecedor`, `formulario-cliente`, `diario-obra`, `status-obra`, `termo-entrega`, `vistoria-execucao` — `assinar.html` sozinha carrega stores que tocam **24 tabelas** (assinar → cria dossiê, gatilhos, eventos, alertas, avais, tudo hoje pelo navegador) |
| Storage | 10 buckets, 4 públicos (`engenharia`, `tratativas`, `vistorias-anexos`, `ImagensTutoriais`); políticas `anon`/`public` de leitura/escrita/exclusão em quase todos; só `emails-anexos` já exige `authenticated` |
| Tokens públicos (16–21 caracteres) | `propostas`, `contratos_venda_equipamentos`, `cotacoes_elevador_fornecedor`, `contrato_venda_signatarios` — protegidos hoje só pelo sigilo do token, mas as tabelas são legíveis pelo anônimo (agravante da #571) |

## Decisões que dependem do usuário (responder antes da Fase 3)

- **D1 — Fonte de identidade.** Recomendado: **A) aceitar os JWTs do vpsistema (Third-Party Auth/JWKS)**. Contingência **B) troca de token** (Edge Function `sso-exchange` com `generateLink`+`verifyOtp`, cria usuários Auth no vpprd). A Task 1 decide com evidência; se A falhar, o plano segue por B (Task 1B).
- **D2 — Modelo de permissão.** Recomendado: reaproveitar `perfis.nivel` + `alcadas_capacidade` como está. Classes de tabela: `interno` (qualquer usuário ativo lê/escreve; exclusão só admin ou capacidade), `leitura_interna` (só leitura; escrita só por função de servidor), `sensivel` (leitura Gestor+, escrita Administrador). Quais tabelas entram em `sensivel` está na Task 15 — **revisar com o usuário**.
- **D3 — Quem pode excluir** nas tabelas `interno`: só Administrador (recomendado) ou também Gestor?
- **D4 — Buckets públicos.** Quais podem continuar públicos (recomendado: só `ImagensTutoriais`) e quais passam a URL assinada. `engenharia` e `vistorias-anexos` guardam desenhos/fotos de obra e URLs públicas ficam gravadas em documentos e PDFs (Task 13 migra).
- **D5 — Desenvolvimento local.** O bypass `dev@localhost` deixa de funcionar com RLS fechada. Recomendado: um usuário de desenvolvimento **no vpsistema** (ligado a um `perfis` Administrador) com login por senha digitada em runtime só em `localhost` (Task 6).
- **D6 — Ensaio.** Rehearsal numa **branch do Supabase** (custo a confirmar com `sb_get_cost`) ou direto em produção em horário de baixa carga com ondas pequenas (recomendado: branch para a Fase 3, produção por ondas na Fase 4).
- **D7 — Páginas públicas que permanecem.** Confirmar quais das 8 páginas realmente precisam ser públicas (ex.: `status-obra`, `termo-entrega`, `vistoria-execucao` podem ser só internas).

## Review Focus (modos de falha que o spec implica e nenhuma tarefa de "fechar tabela" testa sozinha)

1. **Usuário do vpsistema que não está em `perfis`** (48 colaboradores no vpsistema × 36 perfis): autentica mas não tem acesso — deve ver a tela "Sem acesso, fale com o administrador", nunca tela em branco, loop de login ou dado vazio mudo. *(Task 3 e Task 7)*
2. **Token expirado no meio de uma operação longa** (publicar ficha ~10 s, sync, formulário aberto por horas): refresh transparente; se falhar, pedir relogin **sem perder** o que o usuário digitou. *(Task 5)*
3. **Realtime para de atualizar em silêncio** quando as tabelas exigem JWT (Embarques, Propostas, Vistorias, Inbox). *(Task 8)*
4. **Cascata de assinatura parcial**: documento marcado assinado mas sem dossiê/gatilhos/avais (hoje tudo é feito pelo navegador do cliente). Deve ser atômica ou reprocessável. *(Task 10)*
5. **URLs públicas de Storage já gravadas** em propostas/fichas/PDFs quebram ao privatizar o bucket. *(Task 13)*

(Também relevantes e cobertos nas tarefas: crons e Edge Functions que leem tabelas com a chave publishable — Task 12; ator dos logs vindo do cliente — Task 7; desempenho das políticas / `auth_rls_initplan` — Task 16.)

## Ondas de fechamento (calculadas em 02/10 a partir de `pg_policies` + mapa das páginas públicas)

- **Onda A — internas simples (49):** `analise_tecnica_pendencias_cliente catalogo_produtos colaborador_alocacoes contrato_instalador_parcelas cotacao_custos_reais cotacoes elevador_opcoes embarques_importacao equipamentos_spec equipe_checklist equipes estoque fichas_historico fichas_lib_campos fichas_lib_categorias fichas_relatorio_confiabilidade fornecedores fornecedores_avaliacoes ims_importacao instalacao_cronograma materiais_catalogo ncm_solicitacoes operadores_estrangeiros parceiros_colaboradores parceiros_doc_catalogo parceiros_documentos_colaborador parceiros_documentos_empresa parceiros_instaladores pedidos_acompanhamento pedidos_compra_varejo pi_importacao produtos projetos projetos_elevador proposta_itens propostas_lib_campos propostas_lib_categorias quadros_comando quadros_comando_bom_itens quadros_comando_checklist_separacao quadros_comando_componentes quadros_comando_geometria quadros_comando_intervalos_piso quadros_comando_maquina quadros_comando_paradas quadros_comando_trechos_corte rfq_importacao solicitacoes_produto tratativas_cotacao`
- **Onda B — sensíveis e caches (33):** `avais_financeiros avais_juridicos colaboradores colaboradores_vpsistema comissoes contract_drafts contratos_sociais convites custos_containers custos_instalacao_elevador custos_instalacao_escada_esteira decisoes_gerenciais difal_estados importacao_varejo_comprado importacao_varejo_estoque importacao_varejo_fornecedor importacao_varejo_fornecedor_cursor importacao_varejo_giro importacao_varejo_giro_staging importacao_varejo_lote_config importacao_varejo_produtos importacao_varejo_sync_cursor importacao_varejo_sync_log minutas notificacoes_lidas omie_pagamentos_cache omie_pagamentos_sync_log parametros_fiscais_elevador pi_omie_pagamentos quadros_comando_cruzamento_erp regras_comissionamento tarefas usuarios`
- **Onda C — tocadas por página pública ou Realtime (48), só depois da Fase 3:** `acompanhamento_obra_itens acompanhamento_obra_lancamentos acompanhamento_obra_links acompanhamento_obra_status alcadas_capacidade alertas analise_tecnica clientes contrato_venda_signatarios contratos_instalador contratos_venda_equipamentos cotacoes_elevador_fornecedor cotacoes_elevador_fornecedor_anexos cotacoes_elevador_historico documento_signatarios dossier_documentos dossier_history dossier_obra dossier_obra_instaladores dossier_pendencias dossier_responsaveis elevador_modelo_opcoes elevador_modelos emails_projeto embarques equipamentos_obra eventos_fluxo fichas_tecnicas formularios_elevador formularios_elevador_anexos formularios_elevador_unidades fornecedores_elevador gatilhos instalacao_checklist_itens instalacao_checklist_templates leads pedidos_fornecedor perfis precificacoes_elevador propostas status_obra_anotacoes vistorias_atividades vistorias_categorias vistorias_obras vistorias_perguntas vistorias_questionarios vistorias_respostas vp_logs`

> Atenção: a classificação é por arquivo carregado nas páginas públicas; o executor **regera** estas listas na Task 0 (script) antes de usá-las — se uma tabela da Onda A aparecer no script como tocada por página pública, ela passa para a C.

---

## FASE 0 — Descoberta e decisão (nenhuma mudança em produção)

### Task 0: Matriz de acesso reproduzível

**Files:**
- Create: `scripts/rls-matriz.mjs`
- Create: `docs/seguranca/matriz-acesso-rls.md` (saída gerada)

**Interfaces:**
- Produces: `docs/seguranca/matriz-acesso-rls.md` com, por tabela: usada por quais páginas públicas, Realtime?, linhas, onda; e as 3 listas de onda (A/B/C).

- [ ] **Step 1: Escrever o script** (lê os 8 HTMLs públicos, mapeia `src/*.js(x)` carregados → `.from('tabela')`, `.channel(`, e cruza com a lista de tabelas vinda de um arquivo JSON exportado do catálogo)

```js
// scripts/rls-matriz.mjs — uso: node scripts/rls-matriz.mjs tabelas.json > docs/seguranca/matriz-acesso-rls.md
import fs from 'node:fs';
const PUBLICAS = ['assinar','cotacao','cotacao-elevador-fornecedor','formulario-cliente','diario-obra','status-obra','termo-entrega','vistoria-execucao'];
const tabelas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // [{tablename, linhas}]
const scriptsDe = (html) => [...fs.readFileSync(html, 'utf8').matchAll(/src="\/(src\/[^"?]+\.jsx?)/g)].map(m => m[1]);
const usos = (arquivos, re) => new Set(arquivos.flatMap(f => fs.existsSync(f) ? [...fs.readFileSync(f, 'utf8').matchAll(re)].map(m => m[1]) : []));
const porPagina = Object.fromEntries(PUBLICAS.map(p => [p, usos(scriptsDe(`${p}.html`), /\.from\('([a-z_]+)'\)/g)]));
const todos = fs.readdirSync('src').filter(f => /\.jsx?$/.test(f)).map(f => `src/${f}`);
const realtime = new Set(todos.filter(f => /\.channel\(/.test(fs.readFileSync(f, 'utf8'))).flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/table:\s*'([a-z_]+)'/g)].map(m => m[1])));
const SENSIVEIS = new Set(['perfis','usuarios','alcadas_capacidade','colaboradores','colaboradores_vpsistema','convites','parametros_fiscais_elevador','custos_containers','custos_instalacao_elevador','custos_instalacao_escada_esteira','difal_estados','comissoes','regras_comissionamento','emails_projeto','vp_logs','avais_financeiros','avais_juridicos','decisoes_gerenciais','contract_drafts','minutas','contratos_sociais','notificacoes_lidas','tarefas']);
const linhas = ['| tabela | linhas | páginas públicas | realtime | onda |', '|---|---|---|---|---|'];
const ondas = { A: [], B: [], C: [] };
for (const { tablename: t, linhas: n } of tabelas) {
  const pubs = PUBLICAS.filter(p => porPagina[p].has(t));
  const rt = realtime.has(t);
  const onda = (pubs.length || rt) ? 'C' : (SENSIVEIS.has(t) || /^(importacao_varejo_|omie_|pi_omie)/.test(t)) ? 'B' : 'A';
  ondas[onda].push(t);
  linhas.push(`| ${t} | ${n} | ${pubs.join(', ') || '—'} | ${rt ? 'sim' : '—'} | ${onda} |`);
}
console.log('# Matriz de acesso (gerada)\n\n' + linhas.join('\n'));
for (const [k, v] of Object.entries(ondas)) console.log(`\n**Onda ${k} (${v.length}):** ${v.join(' ')}`);
```

- [ ] **Step 2: Exportar as tabelas** via MCP SQL e salvar em `tabelas.json` (scratchpad):

```sql
select jsonb_agg(jsonb_build_object('tablename', c.relname, 'linhas', c.reltuples::bigint) order by c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.roles::text ~ '(anon|public)');
```

- [ ] **Step 3: Rodar e conferir** — `node scripts/rls-matriz.mjs <scratchpad>/tabelas.json > docs/seguranca/matriz-acesso-rls.md`. Esperado: 130 linhas, 3 ondas somando 130 (A≈49, B≈33, C≈48). Se diferir, usar a saída do script (não as listas deste plano).
- [ ] **Step 4: Inventário de Storage e de token por página pública** — acrescentar ao `.md`: `grep -o "storage.from('[^']*')"` por página e, para cada um dos 8 HTMLs, o parâmetro de URL/token que usa (`grep -n "token\|params.get" src/<app>.jsx`). Marcar as que **não têm token** (candidatas a virar internas — D7).
- [ ] **Step 5: Commit** — `git add scripts/rls-matriz.mjs docs/seguranca/matriz-acesso-rls.md && git commit -m "docs(seguranca): matriz de acesso para o plano da #571"`

### Task 1: Spike — o vpprd aceita o JWT do vpsistema? (decide D1)

**Files:**
- Create: `docs/seguranca/decisao-identidade.md`
- Create (descartável): `vp_whoami()` aplicada só no spike

**Interfaces:**
- Produces: decisão registrada **A (Third-Party Auth)** ou **B (troca de token)**; o formato do `sub`/`email`/`role` dos tokens.

- [ ] **Step 1: Decodificar um token real sem imprimir o token** — com o usuário logado no vpsistema.com, no console da aba:

```js
// imprime só header e claims não sensíveis; NÃO imprime o token
const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /auth-token/.test(k))));
const dec = (p) => JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
const [h, c] = s.access_token.split('.');
console.log({ alg: dec(h).alg, kid: dec(h).kid, role: dec(c).role, iss: dec(c).iss, aud: dec(c).aud, expEm_s: dec(c).exp - Math.floor(Date.now()/1000), temEmail: !!dec(c).email });
```
  Esperado para A: `alg: 'ES256'`, `kid: 'e517faf6-…'`, `role: 'authenticated'`, `iss: 'https://ubdkoqxfwcraftesgmbw.supabase.co/auth/v1'`. Se `alg` for `HS256`, **A é inviável** → ir para a Task 1B.
- [ ] **Step 2: [AÇÃO DO USUÁRIO] Registrar a integração no vpprd** (Dashboard → Authentication → Third-Party Auth, ou pela Management API com o token pessoal dele):

```bash
curl -X POST "https://api.supabase.com/v1/projects/jxtqwzmpgofwctqajewt/config/auth/third-party-auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"jwks_url":"https://ubdkoqxfwcraftesgmbw.supabase.co/auth/v1/.well-known/jwks.json"}'
```
  Registrar só **aceita** tokens assinados por aquela chave; nada muda no comportamento atual enquanto as políticas estiverem abertas.
- [ ] **Step 3: Criar a função de diagnóstico** (migration descartável do spike):

```sql
create or replace function public.vp_whoami() returns jsonb language sql stable as $$
  select jsonb_build_object('role', auth.role(), 'email', auth.jwt()->>'email', 'sub', auth.jwt()->>'sub', 'iss', auth.jwt()->>'iss');
$$;
grant execute on function public.vp_whoami() to authenticated;
```
- [ ] **Step 4: Testar com o token real** (o usuário executa no console do vpsistema; o resultado volta para o plano sem o token):

```js
const tok = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /auth-token/.test(k)))).access_token;
const r = await fetch('https://jxtqwzmpgofwctqajewt.supabase.co/rest/v1/rpc/vp_whoami', { method: 'POST',
  headers: { apikey: 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP', Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{}' });
console.log(r.status, await r.json());
```
  Esperado: `200 { role: 'authenticated', email: '<email do usuário>', ... }`. `401/PGRST301` ⇒ integração mal registrada ou chave diferente.
- [ ] **Step 5: Testar Edge Function com `verify_jwt: true` e o mesmo token** (função descartável `zz-whoami` que devolve 200; apagar depois). Se o gateway recusar o token do vpsistema, **as Edge Functions chamadas pelo navegador validam o usuário dentro da função** (Task 12) em vez de depender do `verify_jwt`. Registrar o resultado.
- [ ] **Step 6: Escrever `docs/seguranca/decisao-identidade.md`** com: alg/kid/exp observados, resultado dos passos 4–5 e a decisão **A** ou **B**. Apagar `zz-whoami`; manter `vp_whoami` (útil para diagnóstico) e registrar.
- [ ] **Step 7: Commit** — `git commit -m "docs(seguranca): decisão de identidade (A: Third-Party Auth | B: troca de token)"`

### Task 1B (**somente se A falhar**): Edge Function `sso-exchange`

**Files:**
- Create: `supabase/functions/sso-exchange/index.ts`

**Interfaces:**
- Consumes: `access_token` do vpsistema (header `Authorization`); `vp_email_ativo` (Task 3).
- Produces: `{ token_hash, email }` que o front troca por sessão com `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. Cria o usuário Auth do vpprd na primeira vez.

- [ ] **Step 1: Escrever a função** (valida o token no Auth do vpsistema, exige perfil ativo, gera o link sem enviar e-mail; `fetch` cru, sem `supabase-js` via esm.sh):

```ts
// supabase/functions/sso-exchange/index.ts
const VPS = "https://ubdkoqxfwcraftesgmbw.supabase.co";
const VPS_ANON = Deno.env.get("VPSISTEMA_ANON_KEY")!;           // secret (AÇÃO DO USUÁRIO)
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SVC = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  const u = await fetch(`${VPS}/auth/v1/user`, { headers: { apikey: VPS_ANON, Authorization: `Bearer ${tok}` } });
  if (!u.ok) return json({ error: "token inválido" }, 401);
  const email = String((await u.json()).email || "").toLowerCase();
  const ok = await fetch(`${URL_SB}/rest/v1/rpc/vp_email_ativo`, { method: "POST", headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_email: email }) });
  if (!ok.ok || (await ok.json()) !== true) return json({ error: "sem acesso" }, 403);
  const g = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, { method: "POST", headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", email }) });
  const body = await g.json();
  if (!g.ok || !body.hashed_token) return json({ error: "falha ao gerar sessão" }, 502);
  return json({ token_hash: body.hashed_token, email });
});
```
- [ ] **Step 2: [AÇÃO DO USUÁRIO]** criar o secret `VPSISTEMA_ANON_KEY` (a chave anon pública do vpsistema, a mesma de `src/supabase.js`).
- [ ] **Step 3: Testar o boot numa cópia descartável** e só então deployar; testes: sem token → 401; token de usuário fora de `perfis` → 403; usuário válido → `{token_hash}`.
- [ ] **Step 4: Ajustar a Task 5:** o front chama `sso-exchange` e faz `verifyOtp`, em vez de usar `accessToken`; a sessão do vpprd passa a ser nativa, com refresh próprio, e as Tasks 7/8 permanecem iguais.

### Task 2: Spike — refresh do vpsistema sem derrubar o portal

**Files:**
- Modify (temporário, não commitar): `src/supabase.js` apenas com `console.log` de nomes de parâmetros

**Interfaces:**
- Produces: resposta objetiva a "o app pode renovar o token usando o `refresh_token` que o portal injeta, sem invalidar a sessão do portal?" + o nome real do parâmetro (`sso_refresh`?).

- [ ] **Step 1: Confirmar que o portal envia o refresh** — abrir o app pelo portal e registrar só os **nomes** dos parâmetros da URL (`console.log([...new URLSearchParams(location.search).keys()])`, **nunca** os valores). Esperado: `['sso_token','sso_refresh']`.
- [ ] **Step 2: Testar rotação** — criar um cliente do vpsistema, `setSession({access_token, refresh_token})`, forçar `refreshSession()` e depois **recarregar o portal** em outra aba. Esperado: o portal continua logado (se deslogar, a rotação invalida o refresh dele).
- [ ] **Step 3: Decisão** em `docs/seguranca/decisao-identidade.md`: (a) o app mantém sessão própria com refresh (se o portal tolera); (b) o app **não** renova sozinho: token de ~1 h e, ao expirar, pede ao portal um novo (redireciona a `https://vpsistema.com?vp_return=…`, mecanismo de deep link que já existe); ou (c) segue a Task 1B (sessão nativa do vpprd, independente do portal).
- [ ] **Step 4: Reverter o `console.log` temporário e commitar só o registro da decisão.**

---

## FASE 1 — Fundações no banco (aditivas; nenhum comportamento muda)

### Task 3: Funções de autorização + backup/gerador de políticas

**Files:**
- Create: `supabase/migrations/20261002100000_vp_auth_helpers.sql`
- Create: `supabase/tests/rls/helpers.sql`

**Interfaces:**
- Produces (SQL): `vp_email() → text`; `vp_perfil() → perfis`; `vp_usuario_ativo() → boolean`; `vp_email_ativo(text) → boolean`; `vp_eh_admin() → boolean`; `vp_nivel_ge(text) → boolean`; `vp_tem_capacidade(text,text) → boolean`; tabela `vp_policy_backup`; `vp_fechar_tabela(tabela text, classe text, onda text) → text`; `vp_reabrir_tabela(tabela text) → text`.

- [ ] **Step 1: Escrever o teste que falha** — `supabase/tests/rls/helpers.sql` (rodar via MCP SQL; cada linha deve devolver `true`):

```sql
select 'ativo conhecido'   as caso, (select public.vp_email_ativo((select email from public.perfis where ativo limit 1))) as ok
union all select 'email inexistente', not public.vp_email_ativo('naoexiste@exemplo.com')
union all select 'caixa alta', public.vp_email_ativo(upper((select email from public.perfis where ativo limit 1)))
union all select 'existe admin', (select count(*) from public.perfis where nivel='Administrador' and ativo) > 0;
```
- [ ] **Step 2: Rodar e ver falhar** — erro `function public.vp_email_ativo(text) does not exist`.
- [ ] **Step 3: Escrever a migration** (helpers `SECURITY DEFINER` com `search_path` fixo — leem `perfis`/`alcadas_capacidade` mesmo quando essas tabelas forem fechadas):

```sql
create or replace function public.vp_email() returns text language sql stable as
$$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.vp_email_ativo(p_email text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfis p where lower(p.email) = lower(p_email) and p.ativo) $$;

create or replace function public.vp_perfil() returns public.perfis language sql stable security definer set search_path = public as
$$ select p.* from public.perfis p where lower(p.email) = public.vp_email() and p.ativo limit 1 $$;

create or replace function public.vp_usuario_ativo() returns boolean language sql stable security definer set search_path = public as
$$ select public.vp_email_ativo(public.vp_email()) $$;

create or replace function public.vp_eh_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select nivel = 'Administrador' from public.perfis where lower(email) = public.vp_email() and ativo limit 1), false) $$;

create or replace function public.vp_nivel_ge(p_minimo text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select (case nivel when 'Administrador' then 3 when 'Gestor' then 2 else 1 end)
                         >= (case p_minimo when 'Administrador' then 3 when 'Gestor' then 2 else 1 end)
                    from public.perfis where lower(email) = public.vp_email() and ativo limit 1), false) $$;

create or replace function public.vp_tem_capacidade(p_modulo text, p_cap text) returns boolean language sql stable security definer set search_path = public as
$$ select public.vp_eh_admin() or exists (
     select 1 from public.alcadas_capacidade a join public.perfis p on p.id = a.perfil_id
     where lower(p.email) = public.vp_email() and p.ativo and a.modulo = p_modulo and a.capacidade = p_cap) $$;

-- backup exato das políticas abertas, para reverter qualquer onda
create table if not exists public.vp_policy_backup (
  id bigserial primary key, tabela text not null, polname text not null, cmd text not null,
  roles text[] not null, qual text, with_check text, onda text, salvo_em timestamptz not null default now());
alter table public.vp_policy_backup enable row level security;
revoke all on public.vp_policy_backup from anon, authenticated;
```
  e as duas funções de operação:

```sql
create or replace function public.vp_fechar_tabela(p_tabela text, p_classe text, p_onda text default null) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  if p_classe not in ('interno','leitura_interna','sensivel') then raise exception 'classe inválida: %', p_classe; end if;
  for r in select * from pg_policies where schemaname='public' and tablename=p_tabela and roles::text ~ '(anon|public)' loop
    insert into public.vp_policy_backup(tabela, polname, cmd, roles, qual, with_check, onda) values (p_tabela, r.policyname, r.cmd, r.roles, r.qual, r.with_check, p_onda);
    execute format('drop policy %I on public.%I', r.policyname, p_tabela); v_n := v_n + 1;
  end loop;
  execute format('revoke all on public.%I from anon', p_tabela);
  execute format('grant select, insert, update, delete on public.%I to authenticated', p_tabela);
  execute format('alter table public.%I enable row level security', p_tabela);
  if p_classe = 'interno' then
    execute format('create policy vp_int_sel on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_ins on public.%I for insert to authenticated with check ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_upd on public.%I for update to authenticated using ((select public.vp_usuario_ativo())) with check ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_del on public.%I for delete to authenticated using ((select public.vp_eh_admin()) or (select public.vp_tem_capacidade(%L, ''excluir'')))', p_tabela, p_tabela);
  elsif p_classe = 'leitura_interna' then
    execute format('create policy vp_ro_sel on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', p_tabela);
  else -- sensivel: leitura Gestor+, escrita Administrador
    execute format('create policy vp_sen_sel on public.%I for select to authenticated using ((select public.vp_nivel_ge(''Gestor'')))', p_tabela);
    execute format('create policy vp_sen_wr on public.%I for all to authenticated using ((select public.vp_eh_admin())) with check ((select public.vp_eh_admin()))', p_tabela);
  end if;
  return format('%s: %s política(s) aberta(s) removida(s), classe %s', p_tabela, v_n, p_classe);
end $$;

create or replace function public.vp_reabrir_tabela(p_tabela text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_ultima timestamptz;
begin
  select max(salvo_em) into v_ultima from public.vp_policy_backup where tabela = p_tabela;
  if v_ultima is null then raise exception 'sem backup para %', p_tabela; end if;
  for r in select policyname from pg_policies where schemaname='public' and tablename=p_tabela and policyname in ('vp_int_sel','vp_int_ins','vp_int_upd','vp_int_del','vp_ro_sel','vp_sen_sel','vp_sen_wr') loop
    execute format('drop policy %I on public.%I', r.policyname, p_tabela);
  end loop;
  for r in select * from public.vp_policy_backup where tabela = p_tabela and salvo_em = v_ultima loop
    execute format('create policy %I on public.%I for %s to %s%s%s', r.polname, p_tabela, r.cmd,
      array_to_string(r.roles, ','), coalesce(' using (' || r.qual || ')', ''), coalesce(' with check (' || r.with_check || ')', ''));
    v_n := v_n + 1;
  end loop;
  execute format('grant select, insert, update, delete on public.%I to anon', p_tabela);
  return format('%s: %s política(s) restaurada(s)', p_tabela, v_n);
end $$;

revoke execute on function public.vp_fechar_tabela(text,text,text), public.vp_reabrir_tabela(text) from public, anon, authenticated;
grant  execute on function public.vp_fechar_tabela(text,text,text), public.vp_reabrir_tabela(text) to service_role;
```
- [ ] **Step 4: Aplicar a migration e rodar o teste do Step 1** — todas as linhas `true`.
- [ ] **Step 5: Teste de ida e volta numa tabela-isca** — criar `public.zz_rls_teste(id int)` com política `anon` aberta (`for all to anon using (true) with check (true)`) e `grant all … to anon`, chamar `vp_fechar_tabela('zz_rls_teste','interno','teste')` e depois `vp_reabrir_tabela('zz_rls_teste')`; conferir via `pg_policies` que o estado final é igual ao inicial (mesmo nome, `cmd`, `roles`, `qual`, `with_check`); depois `drop table public.zz_rls_teste`. Registrar a saída.
- [ ] **Step 6: Review Focus #1 — usuário fora de `perfis`:** `select public.vp_email_ativo('alguem.do.vpsistema.sem.perfil@vpsistema.com')` → `false`; e (Task 4) a sonda de `authenticated` com esse e-mail devolve 0 linhas em tabela `interno` fechada.
- [ ] **Step 7: Commit** — `git add supabase/migrations/20261002100000_vp_auth_helpers.sql supabase/tests/rls/helpers.sql && git commit -m "feat(seguranca): funções de autorização e gerador reversível de políticas (#571)"`

### Task 4: Sonda de RLS (testa o que cada papel enxerga)

**Files:**
- Create: `supabase/migrations/20261002110000_vp_rls_probe.sql`
- Create: `supabase/tests/rls/matriz.sql`

**Interfaces:**
- Consumes: `vp_email_ativo`.
- Produces: `vp_rls_probe(tabela text, papel text, email text) → jsonb {tabela, papel, linhas, erro}`.

- [ ] **Step 1: Teste que falha** — `select public.vp_rls_probe('perfis','anon',null)` → função inexistente.
- [ ] **Step 2: Implementar** (SECURITY INVOKER — chamada como `postgres`, simula o papel com `set local role` e as claims):

```sql
create or replace function public.vp_rls_probe(p_tabela text, p_papel text, p_email text default null) returns jsonb
language plpgsql as $$
declare n bigint; err text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_papel, 'email', p_email, 'sub', gen_random_uuid())::text, true);
  execute format('set local role %I', p_papel);
  begin execute format('select count(*) from public.%I', p_tabela) into n;
  exception when others then err := sqlerrm; n := null; end;
  reset role;
  return jsonb_build_object('tabela', p_tabela, 'papel', p_papel, 'linhas', n, 'erro', err);
end $$;
revoke execute on function public.vp_rls_probe(text,text,text) from public, anon, authenticated;
```
- [ ] **Step 3: Matriz de verificação por tabela** (`supabase/tests/rls/matriz.sql`) — para uma tabela já fechada: `anon` → 0 linhas ou erro de permissão; `authenticated` + e-mail ativo → sem erro; `authenticated` + e-mail fora de `perfis` → 0 linhas:

```sql
with t(tabela) as (values ('importacao_varejo_produtos'))   -- trocar pela tabela da onda em teste
select 'anon sem acesso' as caso,
       (coalesce((r->>'linhas')::int, 0) = 0 or r->>'erro' is not null) as ok, r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'anon', null) as r) a
union all
select 'ativo enxerga', (r->>'erro' is null), r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'authenticated', (select email from public.perfis where ativo and nivel = 'Colaborador' limit 1)) as r) b
union all
select 'fora de perfis não enxerga', (coalesce((r->>'linhas')::int, 0) = 0), r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'authenticated', 'fantasma@vpsistema.com') as r) c;
```
- [ ] **Step 4: Rodar contra uma tabela ainda aberta** — `anon sem acesso` deve devolver `ok = false` (prova que a sonda detecta a brecha). Registrar.
- [ ] **Step 5: Commit** — `git commit -m "feat(seguranca): sonda de RLS por papel (#571)"`

---

## FASE 2 — Sessão no front (modo sombra: nada quebra se algo falhar)

### Task 5: `VpAuth` + cliente do vpprd com token (modo `off | shadow | on`)

**Files:**
- Create: `src/vp-auth.js`
- Modify: `src/supabase.js` (criação do cliente; captura de `sso_refresh`)
- Modify: `index.html`, `assinar.html` etc. (carregar `vp-auth.js` **antes** de `supabase.js`; bump de `?v=` em ambos)
- Test: `src/vp-auth.test.js`

**Interfaces:**
- Produces: `window.VpAuth = { init({accessToken, refreshToken}) → Promise<user|null>, getAccessToken() → Promise<string|null>, getUser() → user|null, onChange(fn), signOut() }`; `window.VP_AUTH_MODE` ∈ `'off'|'shadow'|'on'` (lido de `localStorage.vp_auth_mode`; padrão `'shadow'` depois do deploy; `'on'` só na Fase 4); `window.__VP_AUTH_READY` (Promise).
- Consumes: `window.__VPS_ANON` (a constante `VPSISTEMA_ANON` já existente em `supabase.js`, exposta por ele).

- [ ] **Step 1: Teste que falha** (`src/vp-auth.test.js`, node:test, mock de `window.supabase`):

```js
import test from 'node:test'; import assert from 'node:assert/strict';
test('getAccessToken devolve null sem sessão e o token com sessão', async () => {
  let sessao = null;
  globalThis.window = { __VPS_ANON: 'anon', supabase: { createClient: () => ({ auth: {
    setSession: async (s) => { sessao = { ...s, user: { email: 'a@b.com' } }; return { error: null }; },
    getSession: async () => ({ data: { session: sessao } }),
    onAuthStateChange: () => {}, signOut: async () => { sessao = null; } } }) } };
  await import('./vp-auth.js');
  assert.equal(await window.VpAuth.getAccessToken(), null);
  await window.VpAuth.init({ accessToken: 'tok', refreshToken: 'ref' });
  assert.equal(await window.VpAuth.getAccessToken(), 'tok');
  assert.equal(window.VpAuth.getUser().email, 'a@b.com');
});
```
- [ ] **Step 2: Rodar** `node --test src/vp-auth.test.js` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `src/vp-auth.js`:**

```js
(function () {
  'use strict';
  const VPS_URL = 'https://ubdkoqxfwcraftesgmbw.supabase.co';
  let vps = null, user = null; const ouvintes = [];
  function cliente() {
    if (!vps) vps = window.supabase.createClient(VPS_URL, window.__VPS_ANON, {
      auth: { persistSession: true, storageKey: 'vpprd-vps-auth', autoRefreshToken: true, detectSessionInUrl: false } });
    return vps;
  }
  async function init(opts) {
    const c = cliente();
    if (opts && opts.accessToken && opts.refreshToken) {
      const { error } = await c.auth.setSession({ access_token: opts.accessToken, refresh_token: opts.refreshToken });
      if (error) console.warn('[VpAuth] setSession falhou:', error.message);
    }
    const { data } = await c.auth.getSession();
    user = (data && data.session && data.session.user) || null;
    c.auth.onAuthStateChange((ev, s) => { user = (s && s.user) || null; ouvintes.forEach((f) => { try { f(ev, user); } catch (e) {} }); });
    return user;
  }
  async function getAccessToken() { const { data } = await cliente().auth.getSession(); return (data && data.session && data.session.access_token) || null; }
  window.VpAuth = { init, getAccessToken, getUser: () => user, onChange: (f) => ouvintes.push(f), signOut: () => cliente().auth.signOut() };
})();
```
- [ ] **Step 4: Rodar o teste** → PASS.
- [ ] **Step 5: Ligar em `supabase.js`** — (a) ler `sso_refresh` além de `sso_token` (nome confirmado na Task 2); (b) criar o cliente do vpprd com `accessToken` quando `VP_AUTH_MODE !== 'off'`:

```js
// substitui: const sb = window.supabase.createClient(URL_SB, ANON_SB);
window.__VPS_ANON = VPSISTEMA_ANON;
const MODO = (function () { try { return localStorage.getItem('vp_auth_mode') || 'shadow'; } catch (e) { return 'shadow'; } })();
window.VP_AUTH_MODE = MODO;
let _resolveReady; window.__VP_AUTH_READY = new Promise((r) => { _resolveReady = r; });
const sb = MODO === 'off'
  ? window.supabase.createClient(URL_SB, ANON_SB)
  : window.supabase.createClient(URL_SB, ANON_SB, { accessToken: async () => { await window.__VP_AUTH_READY; return await window.VpAuth.getAccessToken(); } });
// no ssoGuard, depois de capturar ssoToken/ssoRefresh:
//   window.VpAuth.init({ accessToken: ssoToken, refreshToken: ssoRefresh }).finally(_resolveReady);
// sem token SSO na URL (reload da aba):
//   window.VpAuth.init().finally(_resolveReady);
```
  Verificar com `grep -n "\.auth\." src/*.js src/*.jsx` que o app **não usa** `sb.auth.*` (com `accessToken` o namespace `auth` do cliente do vpprd é desabilitado). Se usar, listar e tratar.
- [ ] **Step 6: Review Focus #2 — token expirado no meio da operação:** teste manual com o MCP do navegador: logar, forçar expiração (alterar `expires_at` da chave `vpprd-vps-auth` no `localStorage` para o passado), abrir a Ficha Técnica e clicar "Salvar ficha" → esperado: salva sem erro (refresh transparente). Se o refresh falhar, esperado: `window.toast('Sessão expirada — recarregue pelo portal')` **e o formulário preservado** (não navegar sozinho). Registrar.
- [ ] **Step 7: Bump de `?v=`** de `supabase.js` e do novo `vp-auth.js` em `index.html` e `assinar.html`; `npm test` verde.
- [ ] **Step 8: Verificar em produção em modo `shadow`** — o token vai no header mas as políticas ainda estão abertas: abrir 10 telas e conferir nos logs que as requisições chegam com `role=authenticated` e e-mail correto, e que **nada** mudou para o usuário:

```sql
-- MCP de logs (ClickHouse): contagem por papel
select log_attributes['request.sb.jwt.authorization.payload.role'] as papel, count() n from logs where source='edge_logs' group by papel
```
- [ ] **Step 9: Commit** — `git add src/vp-auth.js src/vp-auth.test.js src/supabase.js index.html assinar.html && git commit -m "feat(auth): sessão vpsistema no front em modo sombra (#571)"`

### Task 6: Desenvolvimento local e testes automatizados com RLS fechada (D5)

**Files:**
- Modify: `src/vp-auth.js` (acrescentar `signInWithPassword`), `src/supabase.js` (substituir o bypass `dev@localhost`)
- Create: `src/vp-dev-login.jsx` (formulário que só existe em `localhost`)
- Create: `docs/seguranca/dev-local.md`
- Modify: `index.html`

**Interfaces:**
- Produces: `VpAuth.signInWithPassword(email, senha) → Promise<user>`; em `localhost`, tela de login (e-mail + senha digitados em runtime); sem credencial em arquivo.

- [ ] **Step 1: [AÇÃO DO USUÁRIO] criar o usuário de desenvolvimento no vpsistema** e a linha em `perfis` com `nivel = 'Administrador'` e e-mail `dev+<nome>@verticalparts.com.br`; registrar o e-mail (**não** a senha) em `docs/seguranca/dev-local.md`.
- [ ] **Step 2: Teste que falha** (node:test): `VpAuth.signInWithPassword('a@b.com','x')` chama `auth.signInWithPassword({email, password})` no cliente do vpsistema e **não** grava nada em chave de produção do `localStorage`.
- [ ] **Step 3: Implementar** `signInWithPassword` e o componente (campo `type="password"`, `autocomplete="off"`, nunca logar o valor); manter o bypass antigo **somente** quando `VP_AUTH_MODE === 'off'`.
- [ ] **Step 4: Documentar em `CLAUDE.md`** (seção Stack/como testar localmente): como logar em `localhost`; que testes automatizados pedem a senha ao desenvolvedor — **nunca** gravar em arquivo.
- [ ] **Step 5: Bump de `?v=` e commit.**

### Task 7: Estados "sem acesso" / "sessão expirada" e ator confiável nos logs

**Files:**
- Create: `src/vp-acesso.jsx` (telas "Sem acesso" e "Sessão expirada")
- Modify: `src/app.jsx` (render condicional), `src/vp-log.js`
- Create: `supabase/migrations/20261002120000_vp_logs_ator_do_jwt.sql`
- Test: `src/vp-acesso.test.js`

**Interfaces:**
- Consumes: `VpAuth.getUser()`, RPC `vp_usuario_ativo`.
- Produces: `window.VpAcesso.verificar() → Promise<'ok'|'sem_perfil'|'sem_sessao'>`; coluna `vp_logs.ator_email_jwt` preenchida por trigger `before insert` com `auth.jwt()->>'email'` quando houver JWT.

- [ ] **Step 1: Teste que falha** (Review Focus #1): `verificar()` devolve `'sem_perfil'` quando o RPC `vp_usuario_ativo` retorna `false`, `'ok'` quando `true`, `'sem_sessao'` sem token.
- [ ] **Step 2: Implementar** `verificar()` (`sb.rpc('vp_usuario_ativo')`) e a tela: "Seu usuário ainda não tem acesso ao VP Gestão. Peça a um administrador para liberar o seu perfil." + botão "Voltar ao portal" (`https://vpsistema.com`). Em `app.jsx`, no modo `on`, renderizar a tela **no lugar do app** quando `verificar() !== 'ok'`; em `shadow`, só `console.warn` (não bloquear).
- [ ] **Step 3: Trigger de ator confiável** — `vp_logs.ator_email_jwt text` preenchido por trigger `before insert` (`new.ator_email_jwt := nullif(auth.jwt()->>'email','')`); `ator_nome` do cliente continua só para exibição, mas a auditoria passa a ter o e-mail verificável.
- [ ] **Step 4: Verificar no navegador (MCP):** usuário válido → app normal; e-mail sem perfil (homologação, modo `on`) → tela "Sem acesso" sem loop.
- [ ] **Step 5: Bump de `?v=` e commit.**

### Task 8: Realtime autenticado (Review Focus #3)

**Files:**
- Modify: `src/supabase.js` (aplicar o token ao Realtime), `src/logistica.jsx`, `src/proposta-editor.jsx`, `src/precificacao.jsx`, `src/vistorias-envio.jsx` (só se precisarem reassinar canal)
- Create: `docs/seguranca/checklist-realtime.md`

**Interfaces:**
- Consumes: cliente com `accessToken`; `VpAuth.onChange`.

- [ ] **Step 1: Teste (manual) que prova a falha antes:** com uma tabela Realtime **fechada** em ensaio (tabela-isca na publication + canal de teste), abrir a tela, inserir uma linha por SQL e verificar se o evento chega. Sem JWT na conexão ele **não** chega e a tela fica parada sem erro.
- [ ] **Step 2: Aplicar o token ao Realtime** — em `supabase.js`, depois de `VpAuth.init`: `sb.realtime.setAuth(await VpAuth.getAccessToken())`.
- [ ] **Step 3: Reaplicar a cada renovação** — `VpAuth.onChange(async () => sb.realtime.setAuth(await VpAuth.getAccessToken()))`.
- [ ] **Step 4: Roteiro nas 4 telas** (Importação/Embarques, Proposta aberta, Propostas, Vistorias; Inbox só leitura) com `embarques`, `propostas`, `vistorias_atividades`, `emails_projeto` em ensaio: o evento chega em ≤ 3 s. Registrar no checklist.
- [ ] **Step 5: Commit.** *(O `EmailInbox` é área blindada: se for preciso tocá-lo, parar e pedir confirmação ao usuário antes.)*

---

## FASE 3 — Caminhos públicos saem das tabelas (o maior risco)

> **Princípio:** nenhuma página pública fala com tabela. Cada uma passa a falar com **RPC `public_*` (SECURITY DEFINER, `grant execute … to anon`) que recebe o token do documento e devolve/grava só aquele documento**. A Task 9 é o molde; a Task 11 o replica.

### Task 9: Molde — Proposta pública (`/assinar/:token`)

**Files:**
- Create: `supabase/migrations/20261002130000_public_proposta_rpc.sql`
- Create: `docs/seguranca/cascata-assinatura.md`
- Modify: `src/proposta-store.js` (`getByToken`, `markViewed`, `markSigned`, `refuse` passam a chamar as RPCs)
- Modify: `src/assinar-app.jsx` (se usar `.from(` direto)
- Test: `src/proposta-store.test.js` (novo, mock do cliente)

**Interfaces:**
- Produces (SQL, `grant execute … to anon, authenticated`): `public_proposta_obter(p_token text) → jsonb` (só as colunas que a página usa); `public_proposta_visualizada(p_token text) → void`; `public_proposta_assinar(p_token text, p_audit jsonb, p_opcao text) → jsonb {ok, status|erro}`; `public_proposta_recusar(p_token text, p_motivo text, p_audit jsonb) → jsonb`.
- Consumes: a regra atual de `PropostaStore.markSigned` (hash, `opcaoEntrega`, troca de valores, `valor_total`).

- [ ] **Step 1: Capturar a verdade atual (antes de mudar):** ler `proposta-store.js` (`markSigned`/`refuse`/`markViewed`) e registrar em `docs/seguranca/cascata-assinatura.md` **todas** as escritas (tabela + colunas) feitas em cada uma, incluindo as de stores chamados em cadeia (`DossierStore.criarDeProposta`, `EventosFluxo`, `GatilhosEngine.onEvento`, `AvalFinanceiroStore`, `VPLog`). Comando: `grep -n "\.from(\|\.insert(\|\.update(\|\.upsert(\|onEvento\|criarDeProposta" src/proposta-store.js src/dossier-store.js src/gatilhos-engine.js src/eventos-fluxo-store.js`.
- [ ] **Step 2: Teste que falha** (`proposta-store.test.js`): `markSigned(token, audit)` chama `rpc('public_proposta_assinar', {p_token, p_audit, p_opcao})` e **não** chama `from('propostas')`.
- [ ] **Step 3: Escrever a RPC** (atômica; só atualiza se o token existe, o status é assinável e a proposta não expirou). O corpo abaixo fixa o molde; **as linhas marcadas** são completadas com **exatamente** o que a Step 1 listou (troca da opção de entrega, valores, `valor_total`):

```sql
create or replace function public.public_proposta_assinar(p_token text, p_audit jsonb, p_opcao text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v propostas%rowtype;
begin
  select * into v from propostas where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if v.status not in ('enviada','visualizada') then return jsonb_build_object('ok', false, 'erro', 'status_' || v.status); end if;
  -- (a) aplicar a troca de opção de entrega/valores de PropostaStore.markSigned  <- da Step 1
  update propostas set status = 'aprovada', signed_at = now(), audit = coalesce(audit,'{}'::jsonb) || p_audit where id = v.id;
  return jsonb_build_object('ok', true, 'status', 'aprovada');
end $$;
revoke execute on function public.public_proposta_assinar(text, jsonb, text) from public;
grant  execute on function public.public_proposta_assinar(text, jsonb, text) to anon, authenticated;
```
- [ ] **Step 4: Rodar o teste** → PASS; e teste SQL: token inexistente → `{ok:false, erro:'link_invalido'}`; token de proposta de teste (`Claude teste notebook`) → `ok:true`; reassinar → `status_aprovada`.
- [ ] **Step 5: Verificação cruzada** — comparar o estado do banco depois de assinar uma proposta de teste pelo caminho **antigo** (ensaio) e pelo **novo**: mesmas colunas alteradas em `propostas`. Registrar a diferença (a cascata é a Task 10).
- [ ] **Step 6: Bump de `?v=` (`proposta-store.js`, `assinar-app.jsx`, em `index.html` e `assinar.html`) e commit.**

### Task 10: Cascata de assinatura server-side e atômica (Review Focus #4)

**Files:**
- Create: `supabase/migrations/20261002140000_cascata_assinatura.sql`
- Modify: `src/proposta-store.js`, `src/dossier-store.js`, `src/gatilhos-engine.js` (deixam de executar a cascata no navegador do cliente)
- Test: `supabase/tests/rls/cascata.sql`

**Interfaces:**
- Consumes: a lista de escritas de `docs/seguranca/cascata-assinatura.md` (Task 9, Step 1).
- Produces: trigger `trg_proposta_assinada` (já existe `fn_avais_abrir_na_proposta` para os avais; estender): criar o Dossiê (equivalente a `DossierStore.criarDeProposta`, idempotente), registrar `eventos_fluxo`/`gatilhos`/`alertas` e logs — **na mesma transação do `update` da assinatura**.

- [ ] **Step 1: Teste que falha** (`cascata.sql`): em transação com `rollback`, inserir proposta de teste `enviada`, chamar `public_proposta_assinar` e afirmar: existe **1** dossiê para o Nº da cotação (e **não** 2 — bug conhecido), 2 avais (Financeiro e Jurídico), ≥ 1 `eventos_fluxo` `CLIENTE_RESPONDEU_PROPOSTA`, 1 alerta "Avais iniciados".
- [ ] **Step 2: Implementar** cada passo da lista como SQL na função do trigger; **onde a lógica for complexa demais para SQL** (`GatilhosEngine.onEvento` calcula SLAs), mover para uma Edge Function `processar-evento-fluxo` chamada pelo trigger via `pg_net` com o segredo de cron (padrão da #572) e **fila de reprocesso** (`eventos_fluxo_pendentes`) para não perder evento se a função falhar.
- [ ] **Step 3: Review Focus #4 — idempotência e falha parcial:** executar a cascata duas vezes sobre a mesma proposta → mesmo estado (sem dossiê/aval duplicado); simular falha no passo 3 → o `update` da assinatura **não** persiste (transação) **ou** o evento fica na fila para reprocesso.
- [ ] **Step 4: Remover o código antigo do navegador** (`DossierStore.criarDeProposta` chamado de `markSigned`, etc.) — só depois de o teste de paridade passar.
- [ ] **Step 5: Bump de `?v=` e commit.**

### Task 11: Replicar o molde nos demais fluxos públicos (uma sub-tarefa por fluxo)

Cada sub-tarefa segue **exatamente** os Steps 1–6 da Task 9 (capturar escritas atuais → teste → RPC → paridade → commit), com os artefatos abaixo. Executar na ordem; cada uma termina com a página funcionando **sem** depender de política `anon` nas tabelas dela.

| # | Fluxo / página | Store de origem | RPCs a criar (`public_*`) | Tabelas que deixam de ser acessadas pela página |
|---|---|---|---|---|
| 11a | Contrato de Venda (`/assinar`) | `contrato-venda-store.js` | `public_cv_obter/visualizado/assinar/recusar` | `contratos_venda_equipamentos`, `leads`, `perfis`, `alcadas_capacidade` |
| 11b | Signatário adicional do contrato | `contrato-venda-signatarios-store.js` | `public_cvs_obter/visualizado/assinar/recusar` | `contrato_venda_signatarios` |
| 11c | Contrato do Instalador | `contrato-instalador-store.js` | `public_ci_obter/visualizado/assinar/recusar` | `contratos_instalador`, `contrato_instalador_parcelas` |
| 11d | Cotação do fornecedor (`cotacao-elevador-fornecedor.html`) | `cotacao-elevador-fornecedor-store.js` | `public_cef_obter/responder` + upload por URL assinada (Task 13) | `cotacoes_elevador_fornecedor`, `..._anexos`, `formularios_elevador`, `embarques` |
| 11e | Pedido ao fornecedor (`cotacao.html`) | `pedido-fornecedor-store.js` | `public_pf_obter/responder` | `pedidos_fornecedor`, `fichas_tecnicas` |
| 11f | Formulário do cliente (`formulario-cliente.html`) | `formulario-elevador-store.js` | `public_form_criar` (cria cliente/lead/formulário/unidades) + `public_form_catalogo()` para `elevador_modelos`/`opcoes` | `clientes`, `formularios_elevador*`, `elevador_modelo*`, `fornecedores_elevador` |
| 11g | Diário de obra (`diario-obra.html`) | `acompanhamento-obra-store.js` | `public_diario_obter/lancar` por `acompanhamento_obra_links.token` | `acompanhamento_obra_*`, `dossier_obra`, `equipamentos_obra` |
| 11h | `status-obra`, `termo-entrega`, `vistoria-execucao` | respectivos apps | **Primeiro decidir D7:** se não têm token, viram rotas internas (exigem login); se têm, RPC por token | `dossier_obra`, `dossier_documentos`, `vistorias_*`, `instalacao_checklist_*` |

- [ ] **Step final de cada sub-tarefa:** teste de ponta a ponta com um documento `Claude teste notebook` — abrir o link como visitante **sem sessão** (janela anônima do MCP), concluir o fluxo, conferir o estado no banco; e conferir em `read_network_requests` que a página **não faz mais nenhuma** chamada `/rest/v1/<tabela>`, só `/rpc/public_*`.

---

## FASE 4 — Fechar tabelas em ondas (cada onda: migration + verificação + observação + rollback)

### Task 12: Edge Functions e crons que dependem de `anon` ("fios soltos")

**Files:**
- Create: `docs/seguranca/funcoes.md`
- Modify: as Edge Functions chamadas pelo navegador (`publicar_ficha_omie`, `omie_sync_pagamentos_instaladores`, `criar-requisicao-compra-importacao-varejo`, `omie-buscar-cliente`, `sync-importacao-varejo-estoque`, `quadro-comando-cruzamento-erp`, `vp-copiloto`)
- Modify (**área blindada — pedir confirmação**): `send-email`, `read-inbox`, `suggest-email-reply`, `sign-email-anexos`

**Interfaces:**
- Produces: toda função que lê/escreve tabelas usa a **chave de serviço** (já é o padrão); funções chamadas pelo navegador passam a **validar o usuário** (`Authorization` do usuário → RPC `vp_usuario_ativo()` e, onde houver, `vp_tem_capacidade`).

- [ ] **Step 1: Inventário** — para cada uma das funções: quem chama (navegador/cron/webhook), com que chave lê o banco, se depende de política `anon` (`grep -ln "sb_publishable\|ANON" supabase/functions/*/index.ts`). Tabela em `docs/seguranca/funcoes.md`.
- [ ] **Step 2: Teste** — depois de fechar uma tabela de teste, chamar cada função que a lê e conferir 200.
- [ ] **Step 3: Funções do navegador exigem usuário real** — padrão: `POST ${SUPABASE_URL}/rest/v1/rpc/vp_usuario_ativo` **com o `Authorization` do usuário** (o JWT decide); falha → 401/403. `publicar_ficha_omie` exige também `vp_tem_capacidade('ficha-tecnica','publicar_omie')`. **Cada edição de `send-email`/`read-inbox` exige confirmação explícita do usuário (área blindada).**
- [ ] **Step 4: Crons** — continuam com o segredo (`x-cron-secret`); confirmar que nenhum lê tabela com a chave publishable.
- [ ] **Step 5: Redeploy com teste do boot em cópia descartável; `publicar_ficha_omie` exige novo teste real autorizado** (regra do CLAUDE.md).
- [ ] **Step 6: Commit.**

### Task 13: Storage — buckets, URLs assinadas e URLs já gravadas (Review Focus #5) (D4)

**Files:**
- Create: `supabase/migrations/20261002150000_storage_politicas.sql`
- Create: `src/vp-storage.js` (`VpStorage.urlAssinada(bucket, path, ttl)` com cache)
- Create: `scripts/migrar-urls-storage.mjs` (reescreve URLs públicas gravadas em tabelas, com backup)
- Modify: os 49 pontos de `storage.from(...)` (`getPublicUrl` → `VpStorage.urlAssinada` onde o bucket fechar)

**Interfaces:**
- Produces: `VpStorage.urlAssinada(bucket, path, ttlSeg = 3600) → Promise<string>`; buckets `fichas-imagens`, `propostas-imagens`, `formulario-elevador-anexos`, `parceiros-instaladores-anexos`, `tratativas`, `cotacao-fornecedor-anexos`, `vistorias-anexos`, `engenharia` com políticas `authenticated` + `vp_usuario_ativo()`; `ImagensTutoriais` continua público (D4); uploads de visitantes (fornecedor, formulário) por **URL assinada de upload** gerada pela RPC/Edge do fluxo (Tasks 11d/11f).

- [ ] **Step 1: Inventariar URLs públicas já gravadas** (Review Focus #5) — contar, por bucket, ocorrências de `/storage/v1/object/public/` em `propostas.data_json`, `fichas_tecnicas.cats/identificacao`, `formularios_elevador_anexos`, `dossier_documentos`, `cotacoes_elevador_fornecedor_anexos` e tabelas de vistoria.
- [ ] **Step 2: Teste que falha** — para cada bucket a privatizar, um `fetch` anônimo da URL pública de um objeto de teste (`Claude teste notebook`) hoje retorna 200; **depois** deve retornar 400/404.
- [ ] **Step 3: Estratégia para URLs gravadas:** guardar **caminho** (`bucket/path`) em vez de URL pública; migrar com o script (reescrita idempotente, com backup do JSON original em `vp_url_backup`); as páginas resolvem `urlAssinada` na hora de exibir. **PDFs e imagens embutidas em documentos já enviados** (propostas assinadas) usam URLs assinadas de TTL longo geradas no envio — ou o bucket `propostas-imagens` permanece de leitura pública para esses objetos (decisão D4 explícita).
- [ ] **Step 4: Políticas** (por bucket: `authenticated` + `vp_usuario_ativo()`; remover `anon`/`public`); testar upload/download de cada módulo pelo MCP.
- [ ] **Step 5: Bump de `?v=` e commit.**

### Task 14: Onda A (49 tabelas) — fechar, verificar, observar

**Files:**
- Create: `supabase/migrations/20261003100000_fechar_onda_a.sql`
- Create: `supabase/rollback/onda_a.sql`
- Create: `docs/seguranca/onda-a-resultado.md`

**Interfaces:**
- Consumes: `vp_fechar_tabela`, `vp_reabrir_tabela`, `vp_rls_probe`; `VP_AUTH_MODE='on'` já ativo (Tasks 5/7).
- Produces: as tabelas da Onda A (lista **regerada** pelo script da Task 0) sem nenhuma política `anon`.

- [ ] **Step 1: Pré-condições (todas verdadeiras ou não prosseguir):** (a) Tasks 0–8 mergeadas; (b) em `shadow` há ≥ 3 dias úteis sem erro de sessão; (c) o roteiro de telas da onda está listado em `docs/seguranca/onda-a-resultado.md` com o resultado esperado de cada uma; (d) rollback testado em tabela-isca (Task 3, Step 5).
- [ ] **Step 2: Migration** — uma chamada por tabela, classe `interno` (ou `leitura_interna` onde a Task 0 marcar):

```sql
select public.vp_fechar_tabela(t, 'interno', 'A')
from unnest(string_to_array('<lista da Onda A gerada pelo script da Task 0, separada por espaço>', ' ')) as t;
```
- [ ] **Step 3: Rollback pronto antes de aplicar** — `supabase/rollback/onda_a.sql`: `select public.vp_reabrir_tabela(t) from unnest(string_to_array('<mesma lista>', ' ')) as t;`.
- [ ] **Step 4: Aplicar em horário de baixa carga e rodar a matriz** (`supabase/tests/rls/matriz.sql`) para cada tabela: `anon` 0/erro; usuário ativo enxerga; fantasma não. Qualquer falha → rollback imediato da onda inteira.
- [ ] **Step 5: Roteiro de telas (MCP do navegador, logado):** abrir cada tela que usa as tabelas (Ficha Técnica, Importação/PI/RFQ/IMS, Catálogo, Quadros de Comando, Solicitações de Produto, Cadastro de Instaladores, Tratativas, Pedidos de Compra Varejo…), executar **uma leitura e uma escrita** com dado `Claude teste notebook`, conferir console sem erro 401/403/42501.
- [ ] **Step 6: Observação 24 h** — monitorar:

```sql
select log_attributes['response.status_code'] as st, count() n from logs
where source='edge_logs' and log_attributes['request.path'] like '/rest/v1/%' group by st order by n desc
```
  `401/403` fora do normal ou queixa de usuário → rollback.
- [ ] **Step 7: Registrar o resultado e commitar.**

### Task 15: Onda B (33), Onda C (48) e remoção definitiva do `anon`

Mesmo molde da Task 14 (migration + rollback + matriz + roteiro + observação), com estas diferenças:

- **Onda B:** classes por tabela conforme revisão do usuário (D2): `custos_*`, `parametros_fiscais_elevador`, `difal_estados`, `comissoes`, `regras_comissionamento`, `usuarios`, `colaboradores*`, `convites`, `decisoes_gerenciais`, `avais_*`, `contract_drafts`, `minutas`, `contratos_sociais`, `notificacoes_lidas`, `tarefas` → `sensivel` (ou `interno` onde o módulo for de uso amplo — decidir **antes**); `importacao_varejo_*`, `omie_*`, `pi_omie_pagamentos`, `quadros_comando_cruzamento_erp` → `leitura_interna` (escrita só pelas Edge Functions com chave de serviço); **exceções que o front edita:** `importacao_varejo_comprado` e `importacao_varejo_lote_config` → `interno`.
- **Onda C:** só depois da Fase 3 (Tasks 9–11) e do roteiro de **todos** os fluxos públicos como visitante anônimo; `perfis` e `alcadas_capacidade` por último (as funções `vp_*` leem com `SECURITY DEFINER`, então continuam funcionando); `vp_logs`: insert por qualquer ativo, leitura só `vp_nivel_ge('Gestor')`.
- [ ] **Step final 1 — remover o `anon` do schema** (só quando `select count(*) from pg_policies where schemaname='public' and roles::text ~ '(anon|public)'` for **0**):

```sql
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
-- conceder de volta SOMENTE as RPCs públicas, uma a uma (lista final = as criadas nas Tasks 9–11):
grant execute on function public.public_proposta_obter(text), public.public_proposta_visualizada(text),
  public.public_proposta_assinar(text,jsonb,text), public.public_proposta_recusar(text,text,jsonb) to anon;
-- repetir o grant para cada public_* de 11a–11h
```
- [ ] **Step final 2:** rodar o advisor de segurança (`get_advisors security`) — meta: zero `rls_disabled`, zero `*_security_definer_function_executable` exceto as `public_*` documentadas, zero políticas `anon`.

---

## FASE 5 — Verificação final, desempenho e documentação

### Task 16: Regressão completa, desempenho e fechamento

**Files:**
- Create: `docs/seguranca/relatorio-final-571.md`, `scripts/teste-invasao-anon.mjs`
- Modify: `CLAUDE.md` (nova seção blindada "Autenticação e RLS")

- [ ] **Step 1: Teste de invasão repetível** — `scripts/teste-invasao-anon.mjs`: com a chave publishable pública, tenta `GET /rest/v1/<tabela>?limit=1` em **todas** as tabelas (esperado 401/403/`[]`), `POST/PATCH/DELETE` com corpo inválido (nunca 2xx), Storage (`/storage/v1/object/...`) e RPC (`/rest/v1/rpc/*`: só as `public_*`). Somente leitura/rejeição; nenhuma escrita bem-sucedida pode ocorrer — se ocorrer, é falha crítica.
- [ ] **Step 2: Repetir o teste de carga da issue #589** (mesma metodologia) — comparar p50/p95; as políticas com `(select ...)`/funções `stable` devem manter o p95 próximo ao baseline; se piorar, criar índices em `perfis(lower(email))` e `alcadas_capacidade(perfil_id, modulo, capacidade)` e tratar `auth_rls_initplan` (#582).
- [ ] **Step 3: Rodar `npm test` e o roteiro de ponta a ponta dos módulos críticos** (Lead → Formulário → Cotação → Precificação → Proposta → assinatura pública → Contrato → Avais → Importação → Ficha → Omie) como Colaborador, Gestor e Administrador, e **como visitante** nas páginas públicas que restarem.
- [ ] **Step 4: Atualizar o `CLAUDE.md`** com: modelo de identidade, classes de política, como fechar/reabrir tabela, regra "**nunca criar política `anon`; novo fluxo público = RPC `public_*`**", como logar em `localhost`, e o aviso de que `vp_fechar_tabela` é o único caminho para novas tabelas.
- [ ] **Step 5: Fechar as issues** #571 e relacionadas com o relatório final e o PR.

---

## Cronograma e risco (estimativas, a revisar após a Task 1)

| Fase | Duração estimada | Risco | Reversível? |
|---|---|---|---|
| 0 Descoberta | 1–2 dias | baixo | n/a |
| 1 Fundações | 1–2 dias | baixo (aditivo) | sim |
| 2 Sessão no front | 2–3 dias + 3 dias úteis em sombra | médio (toca `supabase.js`, carregado por tudo) | sim (`vp_auth_mode=off`) |
| 3 Fluxos públicos | 5–8 dias | **alto** (assinatura de contratos reais) | sim por fluxo (via flag no store) |
| 4 Ondas A→C | 3–4 dias + observação | alto (risco de bloquear usuários) | sim por onda (`vp_reabrir_tabela`) |
| 5 Fechamento | 1–2 dias | baixo | — |

**Regras de parada:** qualquer erro 401/403 inesperado em tela de uso diário, relato de usuário sem acesso ou assinatura pública falhando ⇒ rollback da onda/fluxo em curso antes de investigar. Nunca avançar duas ondas no mesmo dia.

## Auto-revisão

- **Cobertura da issue #571:** políticas abertas (Tasks 14–15), tokens listáveis (Tasks 9/11 + fechar as tabelas), Storage (Task 13), RPCs/funções `SECURITY DEFINER` (Task 15 passo final + Task 12), identidade real (Tasks 1–2/5), escrita/exclusão por papel (classes + D3), páginas públicas (Tasks 9–11). Lacuna aceita: **MFA/política de senha** ficam com o vpsistema (fora deste repo).
- **Placeholders:** o que depende de dados só disponíveis em tempo de execução (lista exata de escritas da cascata na Task 9, listas de onda regeradas pelo script da Task 0) tem o **comando que produz o dado e o critério de aceite**; não é lacuna de decisão.
- **Consistência de nomes:** `vp_usuario_ativo`, `vp_email_ativo`, `vp_eh_admin`, `vp_nivel_ge`, `vp_tem_capacidade`, `vp_fechar_tabela`, `vp_reabrir_tabela`, `vp_rls_probe`, `VpAuth`, `VpStorage`, `public_*` usados de forma idêntica nas tarefas.
- **Review Focus:** itens 1–5 têm tarefa dona (3/7, 5, 8, 10, 13).
