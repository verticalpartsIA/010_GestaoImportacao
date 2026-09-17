# WhatsApp na Central de Decisões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando uma decisão gerencial nasce pendente ou é decidida na Central de Decisões, avisar automaticamente por WhatsApp quem precisa agir (aprovadores) e quem pediu (solicitante).

**Architecture:** `decisoes-store.js` (browser) dispara, fire-and-forget, uma chamada a uma nova Supabase Edge Function `whatsapp-notify` (Deno, service role) nos 3 pontos de mudança de estado (criar/aprovar/reprovar). A function resolve o número de WhatsApp de cada destinatário em `perfis.whatsapp_number`, envia via Evolution API compartilhada e grava toda tentativa em `whatsapp_notification_log`. Uma tela em Configurações permite cadastrar/editar o número de cada colaborador.

**Tech Stack:** Supabase (Postgres + Edge Functions/Deno), JS vanilla (React 18 UMD, sem bundler), `node:test` para testes unitários (`node scripts/run-tests.js`).

**Spec:** [docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md](../specs/2026-09-17-whatsapp-central-decisoes-design.md)

## Global Constraints

- WhatsApp é sempre um efeito colateral — nenhuma falha de envio pode impedir criar/aprovar/reprovar uma decisão. Toda chamada é `void ....catch(console.warn)`, nunca `await` bloqueando.
- A Edge Function nunca lança exceção pro chamador — todo caminho (sucesso, erro HTTP, sem número, sem API key) termina em uma linha de `whatsapp_notification_log` e um `Response` 200.
- Números de WhatsApp: só dígitos, formato DDI+DDD+número (ex.: `5511999999999`) — mesmo formato aceito pela Evolution API.
- **Resposta da Claude VPS** ([`008_BorderoDiario#11`](https://github.com/verticalpartsIA/008_BorderoDiario/issues/11#issuecomment-5719032106)): reaproveitar a instância Evolution API **`vprequisicoes`** (não `pv360`). Os 3 valores (`EVOLUTION_API_URL`, `EVOLUTION_APIKEY`, `EVOLUTION_INSTANCE`) **não** vão direto como secrets desta Edge Function — o `010_GestaoImportacao` ainda não tem papel provisionado no cofre central de credenciais (schema `credentials` do Supabase `vpsistema`, `ubdkoqxfwcraftesgmbw`). A Edge Function precisa conectar ao Postgres do `vpsistema` como um papel `svc_gestaoimportacao` (a ser provisionado pelo Gelson — fora do alcance desta sessão) e chamar `credentials.get_secret('gestaoimportacao', '<CHAVE>')` por chave. O único secret novo desta Edge Function é `VPSISTEMA_DB_URL` (connection string do papel `svc_gestaoimportacao`). Até esse provisionamento acontecer, todas as tasks abaixo são implementáveis e testáveis — o caminho sem `VPSISTEMA_DB_URL`/sem acesso ao cofre é um caso de teste de primeira classe: `skipped_no_apikey`.
- Ao editar qualquer `.js`/`.jsx` referenciado em `index.html`, incrementar o `?v=N` correspondente no mesmo commit (convenção do projeto — cache-busting).
- Escopo travado ao módulo Central de Decisões (`decisoes_gerenciais`). Não tocar em `alertas` nem em outros módulos.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260917180000_perfis_whatsapp_number.sql` | Criar | Coluna `perfis.whatsapp_number` |
| `supabase/migrations/20260917180100_decisoes_gerenciais_solicitado_por.sql` | Criar | Coluna `decisoes_gerenciais.solicitado_por` |
| `supabase/migrations/20260917180200_whatsapp_notification_log.sql` | Criar | Tabela de auditoria de envio |
| `supabase/functions/whatsapp-notify/index.ts` | Criar | Edge Function: resolve destinatários, monta texto, envia, loga |
| `src/decisoes-store.js` | Modificar | Captura `solicitado_por`; 3 pontos de disparo fire-and-forget |
| `src/decisoes-store.test.js` | Criar | Testes unitários dos 3 pontos de disparo |
| `src/financeiro.jsx` | Modificar | Nova seção "WhatsApp por Colaborador" em `ConfiguracoesPage` |
| `index.html` | Modificar | Bump do `?v=` de `decisoes-store.js` e `financeiro.jsx` |

---

### Task 1: Migration — `perfis.whatsapp_number`

**Files:**
- Create: `supabase/migrations/20260917180000_perfis_whatsapp_number.sql`

**Interfaces:**
- Produces: coluna `perfis.whatsapp_number` (text, nullable) — consumida pela Edge Function (Task 4) e pela UI de cadastro (Task 6).

- [ ] **Step 1: Escrever a migration**

```sql
-- Coluna de WhatsApp por colaborador — usada pela notificação automática da
-- Central de Decisões (docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md).
-- Formato: DDI+DDD+número, só dígitos (ex.: 5511999999999) — mesmo formato
-- aceito pela Evolution API.
alter table perfis
  add column if not exists whatsapp_number text;
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase `jxtqwzmpgofwctqajewt`**

Usar a ferramenta MCP Supabase (`apply_migration`, projeto `jxtqwzmpgofwctqajewt`, nome `perfis_whatsapp_number`) com o SQL acima — mesmo fluxo já usado nas migrations existentes deste projeto (ver `CLAUDE.md`).

- [ ] **Step 3: Confirmar a coluna existe**

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'perfis' and column_name = 'whatsapp_number';
```

Expected: 1 linha, `data_type = 'text'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260917180000_perfis_whatsapp_number.sql
git commit -m "feat(db): adiciona perfis.whatsapp_number para notificações WhatsApp"
```

---

### Task 2: Migration — `decisoes_gerenciais.solicitado_por`

**Files:**
- Create: `supabase/migrations/20260917180100_decisoes_gerenciais_solicitado_por.sql`

**Interfaces:**
- Produces: coluna `decisoes_gerenciais.solicitado_por` (text, nullable) — preenchida por `criarDecisao()` (Task 5), consumida por `aprovar()`/`reprovar()` (Task 5) e pela Edge Function (Task 4).

- [ ] **Step 1: Escrever a migration**

```sql
-- Registra quem pediu a decisão (e-mail de quem estava logado ao criar),
-- pré-requisito para avisar o solicitante por WhatsApp quando a decisão for
-- aprovada/reprovada. Decisões já existentes ficam com o campo nulo — não há
-- como reconstruir retroativamente quem pediu.
alter table decisoes_gerenciais
  add column if not exists solicitado_por text;
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase `jxtqwzmpgofwctqajewt`**

Usar `apply_migration` (MCP Supabase), nome `decisoes_gerenciais_solicitado_por`.

- [ ] **Step 3: Confirmar a coluna existe**

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'decisoes_gerenciais' and column_name = 'solicitado_por';
```

Expected: 1 linha, `data_type = 'text'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260917180100_decisoes_gerenciais_solicitado_por.sql
git commit -m "feat(db): adiciona decisoes_gerenciais.solicitado_por"
```

---

### Task 3: Migration — `whatsapp_notification_log`

**Files:**
- Create: `supabase/migrations/20260917180200_whatsapp_notification_log.sql`

**Interfaces:**
- Produces: tabela `whatsapp_notification_log` — só escrita pela Edge Function (Task 4, via service role, bypassa RLS); leitura por qualquer usuário autenticado (auditoria).

- [ ] **Step 1: Escrever a migration**

```sql
-- Log de auditoria de tentativas de envio de WhatsApp — sem isso, a única
-- forma de diagnosticar "por que não chegou a mensagem" seria acessar o log
-- do processo da Edge Function diretamente, inviável remotamente.
create table if not exists whatsapp_notification_log (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null check (stage in ('decisao_pendente', 'decisao_resultado')),
  decisao_id        uuid references decisoes_gerenciais(id) on delete set null,
  recipient_email   text,
  recipient_number  text,
  status            text not null check (status in ('sent', 'error', 'skipped_no_apikey', 'skipped_no_number')),
  http_status       int,
  error_detail      text,
  created_at        timestamptz not null default now()
);

create index if not exists whatsapp_notification_log_decisao_id_idx
  on whatsapp_notification_log (decisao_id);
create index if not exists whatsapp_notification_log_created_at_idx
  on whatsapp_notification_log (created_at desc);

alter table whatsapp_notification_log enable row level security;

create policy whatsapp_notification_log_select_authenticated
  on whatsapp_notification_log for select
  to authenticated using (true);

-- Sem policy de insert/update/delete para "authenticated" de propósito — a
-- Edge Function grava usando a service role key, que bypassa RLS.
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase `jxtqwzmpgofwctqajewt`**

Usar `apply_migration` (MCP Supabase), nome `whatsapp_notification_log`.

- [ ] **Step 3: Confirmar a tabela existe e RLS está ativo**

```sql
select relrowsecurity from pg_class where relname = 'whatsapp_notification_log';
```

Expected: `true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260917180200_whatsapp_notification_log.sql
git commit -m "feat(db): cria whatsapp_notification_log para auditoria de envio"
```

---

### Task 4: Edge Function `whatsapp-notify`

**Files:**
- Create: `supabase/functions/whatsapp-notify/index.ts`

**Interfaces:**
- Consumes: `perfis.whatsapp_number` (Task 1), `whatsapp_notification_log` (Task 3), secret `VPSISTEMA_DB_URL` (connection string Postgres do papel `svc_gestaoimportacao` no `vpsistema` — pode não existir ainda, tratado como caso de teste `skipped_no_apikey`), função `credentials.get_secret('gestaoimportacao', chave)` no schema `credentials` do `vpsistema` (assinatura reportada pela Claude VPS, não confirmada em código nesta sessão — ver nota no Step 1), secrets automáticos `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (sempre presentes em toda Edge Function Supabase).
- Produces: endpoint HTTP `POST /functions/v1/whatsapp-notify`, payload:
  ```ts
  {
    stage: 'decisao_pendente' | 'decisao_resultado';
    decisaoId: string;
    tipo: string;
    numeroCotacao?: number | null;
    recipients: string[];        // e-mails
    statusFinal?: 'aprovada' | 'reprovada';
    motivo?: string | null;
  }
  ```
  Consumida por `decisoes-store.js` (Task 5) via `sb.functions.invoke('whatsapp-notify', { body: payload })`.

- [ ] **Step 1: Escrever a Edge Function**

```ts
// ============================================================
// whatsapp-notify — Edge Function (vpprd)
// Notifica por WhatsApp os envolvidos numa decisão da Central de Decisões
// (decisoes_gerenciais). Nunca lança exceção pro chamador — todo caminho
// (sucesso, erro HTTP, sem número, sem API key) termina em uma linha de
// whatsapp_notification_log e um Response 200. WhatsApp é sempre efeito
// colateral, nunca dependência da ação principal do chamador.
// Ver docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PgClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TIPO_LABEL: Record<string, string> = {
  envio_proposta_gestor: "Envio de proposta — aprovação do Gestor Comercial",
  envio_proposta_ceo: "Envio de proposta — aprovação do CEO",
  contratacao_mao_obra_ceo: "Contratação de mão de obra — aprovação do CEO",
  montador_entra_obra_rh: "Montador entra na obra — aprovação da Engenharia",
  compra_equipamento_ceo: "Compra do equipamento — aprovação do CEO",
  compra_varejo_logistica: "Compra de varejo — aprovação da Logística",
  desconto_proposta: "Desconto em proposta",
  pagamento_instalador_parcela: "Pagamento a instalador — aprovação do Gestor Comercial",
};

function labelTipo(tipo: string): string {
  return TIPO_LABEL[tipo] || tipo;
}

function montarTexto(input: {
  stage: string; tipo: string; numeroCotacao?: number | null;
  statusFinal?: string; motivo?: string | null;
}): string {
  const label = labelTipo(input.tipo);
  if (input.stage === "decisao_pendente") {
    const cotacao = input.numeroCotacao != null ? ` (Cotação Nº ${input.numeroCotacao})` : "";
    return `📋 Nova aprovação pendente: ${label}${cotacao}. Acesse o VP Gestão para decidir.`;
  }
  const emoji = input.statusFinal === "aprovada" ? "✅" : "❌";
  const motivo = input.motivo ? ` Motivo: ${input.motivo}` : "";
  return `${emoji} Sua decisão de ${label} foi ${input.statusFinal}.${motivo}`;
}

/* Busca as 3 credenciais da Evolution API no cofre central do vpsistema —
   uma vez por invocação, nunca por destinatário. Papel svc_gestaoimportacao
   e VPSISTEMA_DB_URL provisionados fora deste projeto (ver Global
   Constraints); enquanto não existirem, retorna null e todo destinatário
   vira skipped_no_apikey — não é um erro, é o estado esperado até lá.

   NOTA — a confirmar antes do deploy real: a assinatura exata de
   credentials.get_secret(project_slug, key_name) (nomes dos parâmetros,
   tipo de retorno) veio da descrição funcional da Claude VPS
   (008_BorderoDiario#11), não foi lida em código nesta sessão. Conferir
   contra a definição real em verticalpartsIA/001_vpsistema antes de
   confiar neste SQL literal. */
async function buscarCredenciaisEvolution(): Promise<{ url: string; apikey: string; instance: string } | null> {
  const dsn = Deno.env.get("VPSISTEMA_DB_URL");
  if (!dsn) return null;
  const client = new PgClient(dsn);
  try {
    await client.connect();
    const chaves = ["EVOLUTION_API_URL", "EVOLUTION_APIKEY", "EVOLUTION_INSTANCE"];
    const valores: Record<string, string> = {};
    for (const chave of chaves) {
      const { rows } = await client.queryObject<{ get_secret: string }>(
        "select credentials.get_secret('gestaoimportacao', $1) as get_secret", chave,
      );
      valores[chave] = rows[0]?.get_secret || "";
    }
    if (!valores.EVOLUTION_APIKEY) return null;
    return { url: valores.EVOLUTION_API_URL, apikey: valores.EVOLUTION_APIKEY, instance: valores.EVOLUTION_INSTANCE };
  } catch {
    return null;
  } finally {
    try { await client.end(); } catch { /* já desconectado */ }
  }
}

async function enviarEvolution(
  numero: string, texto: string, creds: { url: string; apikey: string; instance: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  const resp = await fetch(`${creds.url}/message/sendText/${creds.instance}`, {
    method: "POST",
    headers: { apikey: creds.apikey, "content-type": "application/json" },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body: body.slice(0, 500) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const stage = payload?.stage;
  if (stage !== "decisao_pendente" && stage !== "decisao_resultado") {
    return json({ error: "stage inválido" }, 400);
  }
  const decisaoId: string | null = typeof payload?.decisaoId === "string" ? payload.decisaoId : null;
  const tipo: string = typeof payload?.tipo === "string" ? payload.tipo : "";
  const numeroCotacao = typeof payload?.numeroCotacao === "number" ? payload.numeroCotacao : null;
  const recipients: string[] = Array.isArray(payload?.recipients)
    ? payload.recipients.filter((e: any) => typeof e === "string" && e.trim())
    : [];
  const statusFinal: string | undefined = typeof payload?.statusFinal === "string" ? payload.statusFinal : undefined;
  const motivo: string | null = typeof payload?.motivo === "string" ? payload.motivo : null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const texto = montarTexto({ stage, tipo, numeroCotacao, statusFinal, motivo });
  const creds = await buscarCredenciaisEvolution(); // uma vez por invocação, não por destinatário
  const resultados: Array<{ email: string; status: string }> = [];

  for (const email of recipients) {
    const { data: perfil } = await admin.from("perfis").select("whatsapp_number").eq("email", email).maybeSingle();
    const numero = (perfil?.whatsapp_number || "").replace(/\D/g, "");

    if (!numero) {
      await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: null, status: "skipped_no_number",
      });
      resultados.push({ email, status: "skipped_no_number" });
      continue;
    }

    if (!creds) {
      await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero, status: "skipped_no_apikey",
      });
      resultados.push({ email, status: "skipped_no_apikey" });
      continue;
    }

    try {
      const envio = await enviarEvolution(numero, texto, creds);
      await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero,
        status: envio.ok ? "sent" : "error", http_status: envio.status,
        error_detail: envio.ok ? null : envio.body,
      });
      resultados.push({ email, status: envio.ok ? "sent" : "error" });
    } catch (e) {
      await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero,
        status: "error", error_detail: String(e).slice(0, 500),
      });
      resultados.push({ email, status: "error" });
    }
  }

  return json({ ok: true, resultados });
});
```

- [ ] **Step 2: Deploy da Edge Function no projeto `jxtqwzmpgofwctqajewt`**

Usar a ferramenta MCP Supabase (`deploy_edge_function`, projeto `jxtqwzmpgofwctqajewt`, nome `whatsapp-notify`, conteúdo do arquivo acima) — mesmo padrão já usado para `vp-copiloto`.

- [ ] **Step 3: Testar sem `VPSISTEMA_DB_URL` configurada (caso esperado até o Gelson provisionar o cofre)**

Chamar a function via `curl` (ou MCP `execute_sql`/painel) com um `decisaoId` de teste e um `recipients` com um e-mail que já tenha `whatsapp_number` preenchido (ou preencher um de teste antes via SQL). Esperado: resposta `{ ok: true, resultados: [{ email, status: 'skipped_no_apikey' }] }` (ou `skipped_no_number` se o e-mail de teste não tiver número), e uma linha correspondente em `whatsapp_notification_log`.

```sql
select * from whatsapp_notification_log order by created_at desc limit 5;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-notify/index.ts
git commit -m "feat: cria Edge Function whatsapp-notify"
```

---

### Task 5: `decisoes-store.js` — captura de solicitante e disparo do WhatsApp

**Files:**
- Modify: `src/decisoes-store.js:94-114` (`criarDecisao`), `:210-223` (`aprovar`), `:225-238` (`reprovar`)
- Create: `src/decisoes-store.test.js`
- Modify: `index.html` (bump `?v=` de `decisoes-store.js`)

**Interfaces:**
- Consumes: `sb.functions.invoke(name, { body })` (Supabase JS v2, já carregado via CDN em `index.html`).
- Produces: `window.DecisoesStore.criarDecisao()` agora grava `solicitado_por`; nenhuma mudança de assinatura pública — `aprovar`/`reprovar`/`criarDecisao` continuam com os mesmos parâmetros e retorno.

- [ ] **Step 1: Escrever o teste (falha esperada)**

Criar `src/decisoes-store.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
window.__VP_USER = { email: 'gelson.simoes@verticalparts.com.br' };

/* Fake Supabase client — cobre só as chamadas que decisoes-store.js faz
   nos 3 fluxos testados aqui (criar, aprovar, reprovar). */
function fakeSupabase({ decisaoExistente, invokeCalls }) {
  const from = (table) => {
    if (table === 'alcadas_capacidade') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
    }
    if (table === 'decisoes_gerenciais') {
      return {
        insert: (row) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'dec-1', ...row }, error: null }),
          }),
        }),
        select: () => ({
          eq: (col, val) => {
            const chain = {
              maybeSingle: () => Promise.resolve({ data: null }),
              single: () => Promise.resolve({ data: decisaoExistente, error: null }),
              eq: () => chain,
              order: () => Promise.resolve({ data: [] }),
            };
            return chain;
          },
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        contains: () => Promise.resolve({ data: [] }),
      };
    }
    if (table === 'alertas') return { insert: () => Promise.resolve({ error: null }) };
    throw new Error('tabela não mockada: ' + table);
  };
  return {
    from,
    functions: { invoke: (name, opts) => { invokeCalls.push({ name, opts }); return Promise.resolve({ data: {}, error: null }); } },
  };
}

test('criarDecisao grava solicitado_por com o e-mail do usuário logado', async () => {
  const invokeCalls = [];
  window.__VP_SB = { sb: fakeSupabase({ invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  const decisao = await D.criarDecisao({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao: 917 });
  assert.equal(decisao.solicitado_por, 'gelson.simoes@verticalparts.com.br');
});

test('criarDecisao dispara whatsapp-notify (stage decisao_pendente) para os aprovadores', async () => {
  const invokeCalls = [];
  window.__VP_SB = { sb: fakeSupabase({ invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await D.criarDecisao({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao: 917 });
  await new Promise((r) => setTimeout(r, 0)); // deixa o fire-and-forget rodar

  const call = invokeCalls.find((c) => c.name === 'whatsapp-notify');
  assert.ok(call, 'esperava uma chamada a whatsapp-notify');
  assert.equal(call.opts.body.stage, 'decisao_pendente');
  assert.deepEqual(call.opts.body.recipients, ['diego@verticalparts.com.br']);
});

test('aprovar dispara whatsapp-notify (stage decisao_resultado) para o solicitante', async () => {
  const invokeCalls = [];
  const decisaoExistente = {
    id: 'dec-1', status: 'pendente', tipo: 'compra_equipamento_ceo',
    aprovadores_esperados: ['gelson.simoes@verticalparts.com.br'],
    solicitado_por: 'regiane.rocha@verticalparts.com.br',
  };
  window.__VP_SB = { sb: fakeSupabase({ decisaoExistente, invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await D.aprovar('dec-1', 'ok pode comprar');
  await new Promise((r) => setTimeout(r, 0));

  const call = invokeCalls.find((c) => c.name === 'whatsapp-notify');
  assert.ok(call, 'esperava uma chamada a whatsapp-notify');
  assert.equal(call.opts.body.stage, 'decisao_resultado');
  assert.equal(call.opts.body.statusFinal, 'aprovada');
  assert.deepEqual(call.opts.body.recipients, ['regiane.rocha@verticalparts.com.br']);
});

test('falha em functions.invoke não impede aprovar() de completar', async () => {
  const decisaoExistente = {
    id: 'dec-1', status: 'pendente', tipo: 'compra_equipamento_ceo',
    aprovadores_esperados: ['gelson.simoes@verticalparts.com.br'],
    solicitado_por: 'regiane.rocha@verticalparts.com.br',
  };
  const sb = fakeSupabase({ decisaoExistente, invokeCalls: [] });
  sb.functions.invoke = () => Promise.reject(new Error('edge function fora do ar'));
  window.__VP_SB = { sb };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await assert.doesNotReject(() => D.aprovar('dec-1', 'ok'));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node scripts/run-tests.js`
Expected: FAIL — `decisao.solicitado_por` é `undefined` (campo ainda não gravado), e nenhuma chamada a `whatsapp-notify` é encontrada (função `notificarWhatsapp` ainda não existe).

- [ ] **Step 3: Implementar `solicitado_por` + wrapper `notificarWhatsapp` + 3 pontos de disparo**

Em `src/decisoes-store.js`, dentro da IIFE, logo depois de `souAprovador` (linha ~91):

```js
  /* ---------- WhatsApp (Central de Decisões) ---------- */
  /* Fire-and-forget — nunca bloqueia nem derruba a ação principal (criar,
     aprovar, reprovar). Ver docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md */
  function notificarWhatsapp(payload) {
    const c = sb(); if (!c) return;
    c.functions.invoke('whatsapp-notify', { body: payload })
      .catch((e) => console.warn('[DecisoesStore] notificarWhatsapp falhou', e));
  }
```

Em `criarDecisao` (linha ~94-114), adicionar `solicitado_por: meuEmail()` ao `row` e disparar o WhatsApp depois do insert:

```js
  async function criarDecisao({ tipo, papelRequerido, numeroCotacao, dossierId, referenciaTabela, referenciaId, dependeDe, contexto }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const aprovadores = await resolverAprovadores(papelRequerido);
    const status = (dependeDe && dependeDe.length) ? 'bloqueada_por_dependencia' : 'pendente';
    const row = {
      tipo, papel_requerido: papelRequerido,
      numero_cotacao: numeroCotacao ?? null, dossier_id: dossierId ?? null,
      referencia_tabela: referenciaTabela ?? null, referencia_id: referenciaId ?? null,
      depende_de: dependeDe || [], status,
      aprovadores_esperados: aprovadores,
      aprovador_esperado_email: aprovadores[0] || null,
      contexto: contexto || {},
      solicitado_por: meuEmail() || null,
    };
    const { data, error } = await c.from('decisoes_gerenciais').insert(row).select().single();
    if (error) throw error;
    if (aprovadores.length && status === 'pendente') {
      notificarWhatsapp({
        stage: 'decisao_pendente', decisaoId: data.id, tipo,
        numeroCotacao: numeroCotacao ?? null, recipients: aprovadores,
      });
    }
    return data;
  }
```

Em `aprovar` (linha ~210-223), disparar depois do update bem-sucedido:

```js
  async function aprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'aprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo || null, atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
    await desbloquearDependentes(c, id);
    await notificarResultado(c, { ...decisao, motivo: motivo || null }, 'aprovada');
    if (decisao.solicitado_por) {
      notificarWhatsapp({
        stage: 'decisao_resultado', decisaoId: id, tipo: decisao.tipo,
        statusFinal: 'aprovada', motivo: motivo || null, recipients: [decisao.solicitado_por],
      });
    }
  }
```

Em `reprovar` (linha ~225-238), mesmo padrão com `statusFinal: 'reprovada'`:

```js
  async function reprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da reprovação.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'reprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo.trim(), atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
    await notificarResultado(c, { ...decisao, motivo: motivo.trim() }, 'reprovada');
    if (decisao.solicitado_por) {
      notificarWhatsapp({
        stage: 'decisao_resultado', decisaoId: id, tipo: decisao.tipo,
        statusFinal: 'reprovada', motivo: motivo.trim(), recipients: [decisao.solicitado_por],
      });
    }
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node scripts/run-tests.js`
Expected: PASS — todos os testes de `decisoes-store.test.js`, e nenhuma regressão nos testes já existentes (`dashboard-metrics-gantt.test.js`, `notificacoes-processamento.test.js`, `dashboard-metrics-financeiro.test.js`).

- [ ] **Step 5: Bump do cache-busting em `index.html`**

Localizar a linha `<script src=".../decisoes-store.js?v=N">` em `index.html` e incrementar `N` em 1 (convenção obrigatória do projeto — ver `CLAUDE.md`).

- [ ] **Step 6: Commit**

```bash
git add src/decisoes-store.js src/decisoes-store.test.js index.html
git commit -m "feat: dispara WhatsApp na Central de Decisões (criar/aprovar/reprovar)"
```

---

### Task 6: UI — "WhatsApp por Colaborador" em Configurações

**Files:**
- Modify: `src/financeiro.jsx` (nova função de componente + registro na `Tabs`/render de `ConfiguracoesPage`, ver linhas 1014-1060)
- Modify: `index.html` (bump `?v=` de `financeiro.jsx`)

**Interfaces:**
- Consumes: `perfis` (Task 1) — lê `id, email, nome, whatsapp_number` filtrando pelos e-mails relevantes; `window.DecisoesStore.EMAILS_FIXOS` (já exportado) para saber quais e-mails mostrar por padrão.
- Produces: nenhuma interface nova consumida por outro código — é uma tela terminal.

- [ ] **Step 1: Adicionar a aba e o componente**

Em `src/financeiro.jsx`, no array de `Tabs` de `ConfiguracoesPage` (linha ~1041-1048), adicionar uma entrada:

```js
      <Tabs tabs={[
        { key: "administracao", label: "Administração", icon: "users" },
        { key: "usuarios", label: "Usuários & Perfis", icon: "users" },
        { key: "whatsapp", label: "WhatsApp", icon: "phone" },
        { key: "permissoes", label: "Permissões (RLS)", icon: "shield" },
        { key: "parametros", label: "Parâmetros", icon: "settings" },
        { key: "integracoes", label: "Integrações", icon: "globe" },
        { key: "buckets", label: "Buckets Storage", icon: "package" },
      ]} active={tab} onChange={setTab}/>

      <div style={{ marginTop: 24 }}>
        {tab === "administracao" && <window.ColaboradoresAdminPage/>}
        {tab === "usuarios" && <ConfigUsers/>}
        {tab === "whatsapp" && <ConfigWhatsapp/>}
        {tab === "permissoes" && <ConfigPermissions/>}
        {tab === "parametros" && <ConfigParams/>}
        {tab === "integracoes" && <ConfigIntegrations/>}
        {tab === "buckets" && <ConfigBuckets/>}
      </div>
```

Logo depois da função `ConfigUsers` (antes de `ModalConvidarUsuario`, por volta da linha 1148), adicionar o componente novo:

```jsx
/* WhatsApp por Colaborador — cadastro do número usado pela notificação
   automática da Central de Decisões (ver decisoes-store.js:notificarWhatsapp
   e docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md).
   Mostra os e-mails com papel fixo em DecisoesStore.EMAILS_FIXOS — cobertura
   incompleta de números é a armadilha mais comum desse tipo de integração,
   então a lista fica visível mesmo pra quem ainda não tem número salvo. */
function ConfigWhatsapp() {
  const sb = window.__VP_SB.sb;
  const [perfis, setPerfis] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editando, setEditando] = React.useState({});
  const [salvando, setSalvando] = React.useState(null);

  const emailsRelevantes = React.useMemo(() => {
    const fixos = Object.values((window.DecisoesStore || {}).EMAILS_FIXOS || {}).flat();
    return [...new Set(fixos)];
  }, []);

  const load = React.useCallback(async () => {
    if (!emailsRelevantes.length) { setPerfis([]); setLoading(false); return; }
    const { data } = await sb.from('perfis').select('id, email, nome, whatsapp_number').in('email', emailsRelevantes);
    setPerfis(data || []); setLoading(false);
  }, [emailsRelevantes]);
  React.useEffect(() => { load(); }, [load]);

  const salvar = async (email) => {
    setSalvando(email);
    const numero = (editando[email] ?? '').replace(/\D/g, '');
    const { error } = await sb.from('perfis').update({ whatsapp_number: numero || null }).eq('email', email);
    setSalvando(null);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Número salvo.', 'info');
    setEditando((e) => { const n = { ...e }; delete n[email]; return n; });
    load();
  };

  if (loading) return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  return (
    <Card title="WhatsApp por Colaborador" sub="Números usados pela notificação automática da Central de Decisões">
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t">
          <thead><tr><th>Nome</th><th>Email</th><th>WhatsApp</th><th></th></tr></thead>
          <tbody>
            {emailsRelevantes.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum papel fixo cadastrado em DecisoesStore.EMAILS_FIXOS.
              </td></tr>
            )}
            {emailsRelevantes.map((email) => {
              const p = perfis.find((x) => x.email === email);
              const valor = editando[email] ?? (p?.whatsapp_number || '');
              return (
                <tr key={email}>
                  <td>{p?.nome || '—'}</td>
                  <td><span className="mono small">{email}</span></td>
                  <td>
                    <input type="text" className="input" style={{ maxWidth: 200 }}
                      placeholder="5511999999999" value={valor}
                      onChange={(e) => setEditando((s) => ({ ...s, [email]: e.target.value }))}/>
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" disabled={salvando === email} onClick={() => salvar(email)}>
                      {salvando === email ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Bump do cache-busting em `index.html`**

Incrementar o `?v=N` da referência a `financeiro.jsx`.

- [ ] **Step 3: Verificar manualmente no navegador local**

```bash
npm run dev
```

Abrir `http://localhost:3000/admin/configuracoes/whatsapp`, confirmar que a aba "WhatsApp" aparece na lista de tabs, lista os e-mails de `EMAILS_FIXOS` (`diego@`, `gelson.simoes@`, `regiane.rocha@`, `guilherme@`, `arilene.avila@`, `danilo@`), digitar um número de teste num campo, clicar Salvar, recarregar a página e confirmar que o valor persistiu.

- [ ] **Step 4: Commit**

```bash
git add src/financeiro.jsx index.html
git commit -m "feat: tela de cadastro de WhatsApp por colaborador em Configurações"
```

---

### Task 7: Verificação fim-a-fim (bloqueada até o Gelson provisionar o cofre)

**Files:** nenhum arquivo novo — checklist de verificação manual.

- [ ] **Step 1: Gelson provisiona `svc_gestaoimportacao` no cofre central do `vpsistema`**

Ação fora do alcance desta sessão (acesso `postgres`/PAT master do `vpsistema`, outro projeto): criar o papel `svc_gestaoimportacao` no schema `credentials`, com acesso de leitura às 3 chaves (`EVOLUTION_API_URL`, `EVOLUTION_APIKEY`, `EVOLUTION_INSTANCE`) já existentes da instância `vprequisicoes` — reaproveitar, não criar credencial nova (ver resposta da Claude VPS em [`008_BorderoDiario#11`](https://github.com/verticalpartsIA/008_BorderoDiario/issues/11#issuecomment-5719032106)).

- [ ] **Step 2: Configurar `VPSISTEMA_DB_URL` como secret da Edge Function**

Depois do Step 1, usar a ferramenta MCP Supabase para configurar `VPSISTEMA_DB_URL` (connection string Postgres do papel `svc_gestaoimportacao`, apontando pro projeto `vpsistema`/`ubdkoqxfwcraftesgmbw`) como secret da Edge Function `whatsapp-notify` no projeto `jxtqwzmpgofwctqajewt` — nunca como variável de código-fonte. Confirmar antes que `credentials.get_secret('gestaoimportacao', 'EVOLUTION_APIKEY')` realmente retorna valor não vazio para esse papel (testar com uma query direta, se tiver acesso, antes de confiar na Edge Function).

- [ ] **Step 3: Cadastrar ao menos um número real via Task 6 (ex.: o seu próprio, já verificado como `5511997663780`)**

- [ ] **Step 4: Criar uma decisão de teste e aprovar**

No app (Central de Decisões), disparar um dos gates existentes (ex.: `compra_equipamento_ceo` via um fluxo de teste) com um `numeroCotacao` fictício, e depois aprovar/reprovar logado como o aprovador esperado.

- [ ] **Step 5: Confirmar que a mensagem chegou de verdade no WhatsApp e que o log bate**

```sql
select stage, recipient_email, status, http_status, created_at
from whatsapp_notification_log order by created_at desc limit 10;
```

Expected: linhas com `status = 'sent'` para os dois estágios (`decisao_pendente` na criação, `decisao_resultado` na decisão), e a mensagem realmente recebida no celular. Não considerar a feature "pronta" só porque não deu erro na tela — o guia de referência é explícito: "o envio é silencioso por design".
