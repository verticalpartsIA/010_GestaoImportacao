/* ============================================================
   server.js — VP Gestão · VerticalParts
   Servidor Express: hospeda o app estático + proxy seguro para o
   Supabase do projeto "Propostas" (service role fica SÓ no servidor).
   Compatível com Hostinger Node.js (process.env.PORT injetado).
   ============================================================ */

'use strict';

const express = require('express');
const path    = require('path');
const { execSync } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- /version.json (aviso de atualização — ver src/version-check.js) ----------
   O deploy real é a integração "Deploy Node.js app from Git" do hPanel
   (Hostinger) — CADA deploy é um build isolado por commit (confirmado via
   hosting_listJsDeployments), não um `git pull` incremental num clone
   persistente. Isso importa: o diretório publicado só tem o commit atual
   alcançável (`git log -1`/`git rev-parse HEAD` funcionam), NÃO o histórico
   de commits anteriores — uma rota que tentasse `git log <sha antigo>..HEAD`
   pra montar um changelog sempre falharia em produção (testado ao vivo:
   sempre devolvia vazio). Por isso o changelog usa só o assunto do commit
   atual (`commitSubject`, também sempre disponível), não um range.
   Lido a cada request com cache curto pra não rodar `git` a cada carga. */
const VERSION_CACHE_MS = 30 * 1000;
let versionCache = null;
let versionCacheAt = 0;
function readVersionInfo() {
  const now = Date.now();
  if (versionCache && now - versionCacheAt < VERSION_CACHE_MS) return versionCache;
  try {
    const buildTime = execSync('git log -1 --format=%cI', { cwd: __dirname }).toString().trim();
    const commit = execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
    const commitSubject = execSync('git log -1 --format=%s', { cwd: __dirname }).toString().trim();
    versionCache = { buildTime, commit, commitSubject };
  } catch (e) {
    if (!versionCache) versionCache = { buildTime: new Date().toISOString(), commit: 'unknown', commitSubject: '' };
    console.warn('[server] Não foi possível ler a versão do git — usando fallback:', e.message);
  }
  versionCacheAt = now;
  return versionCache;
}
app.get('/version.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json(readVersionInfo());
});

app.use(express.json({ limit: '4mb' }));

/* ---------- Credenciais do projeto Propostas (service role) ----------
   Ordem: env var (produção/Hostinger) → arquivo local .propostas-key.js
   (fora do git) → vazio (proxy desligado). NUNCA expor no front-end. */
let PROPOSTAS_URL = process.env.PROPOSTAS_SB_URL || '';
let PROPOSTAS_SVC = process.env.PROPOSTAS_SB_SVC || '';
if (!PROPOSTAS_SVC) {
  try {
    const k = require('./.propostas-key.js');
    PROPOSTAS_URL = PROPOSTAS_URL || k.url;
    PROPOSTAS_SVC = k.serviceKey;
  } catch (e) { /* sem chave local — proxy fica desligado */ }
}
const PROPOSTAS_ON = !!(PROPOSTAS_URL && PROPOSTAS_SVC);

/* Helper: chama o PostgREST do projeto Propostas com a service role */
async function sbProp(pathQuery, opts = {}) {
  const res = await fetch(`${PROPOSTAS_URL}/rest/v1/${pathQuery}`, {
    ...opts,
    headers: {
      apikey: PROPOSTAS_SVC,
      Authorization: `Bearer ${PROPOSTAS_SVC}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/* ---------- API: Propostas (somente leitura) ---------- */

// Lista enxuta para o autocomplete da "Proposta de Referência"
app.get('/api/propostas/list', async (_req, res) => {
  if (!PROPOSTAS_ON) return res.json({ ok: true, propostas: [] });
  const q = 'propostas?select=numero,titulo,valor_total,status,clientes(razao_social)&order=numero.desc&limit=500';
  const r = await sbProp(q);
  if (!r.ok) return res.status(502).json({ ok: false, error: 'Falha ao listar propostas', detail: r.data });
  const propostas = (r.data || []).map(p => ({
    numero: p.numero,
    titulo: p.titulo || '',
    cliente: p.clientes?.razao_social || '',
    valor_total: Number(p.valor_total) || 0,
    status: p.status || '',
  }));
  res.json({ ok: true, propostas });
});

// Detalhe de UMA proposta (por número) para herança no contrato
app.get('/api/propostas/:numero', async (req, res) => {
  if (!PROPOSTAS_ON) return res.status(503).json({ ok: false, error: 'Proxy Propostas desligado (sem service key)' });
  const numero = String(req.params.numero).replace(/[^0-9]/g, '');
  if (!numero) return res.status(400).json({ ok: false, error: 'Número inválido' });
  const q = `propostas?select=numero,titulo,valor_total,condicao_pagamento,prazo_entrega,proposal_type,data_json,clientes(razao_social,cnpj,cidade,estado,contato,email,telefone)&numero=eq.${numero}&limit=1`;
  const r = await sbProp(q);
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0)
    return res.status(404).json({ ok: false, error: 'Proposta não encontrada' });
  const p  = r.data[0];
  const dj = p.data_json || {};
  const cli = p.clientes || {};
  const djc = dj.client || {};
  const pay = dj.paymentPlan || {};
  res.json({ ok: true, proposta: {
    numero: p.numero,
    titulo: p.titulo || '',
    proposal_type: p.proposal_type || '',
    valor_total: Number(p.valor_total) || Number(dj?.financials?.unitPrice) || 0,
    condicao_pagamento: p.condicao_pagamento || dj?.financials?.paymentTerms || '',
    prazo_entrega: p.prazo_entrega || '',
    cliente: {
      razao_social: cli.razao_social || djc.name || '',
      cnpj:    cli.cnpj || djc.cnpj || '',
      cidade:  cli.cidade || djc.city || '',
      estado:  cli.estado || djc.state || '',
      contato: cli.contato || djc.contactPerson || '',
      email:   cli.email || djc.email || '',
      telefone:cli.telefone || djc.phone || '',
      endereco: djc.address || '',
      cep:      djc.zip || '',
    },
    pagamento: {
      installments: Number(pay.installments) || 0,
      downPaymentPercent: Number(pay.downPaymentPercent) || 0,
    },
  }});
});

/* ---------- API: Minuta (HTML do contrato por proposta) ----------
   Espelha o padrão de produção: tabela `minutas` (proposal_key, html). */
app.get('/api/minuta/:key', async (req, res) => {
  if (!PROPOSTAS_ON) return res.status(503).json({ ok: false, error: 'Proxy desligado' });
  const key = encodeURIComponent(req.params.key);
  const r = await sbProp(`minutas?select=html&proposal_key=eq.${key}&limit=1`);
  if (!r.ok) return res.status(502).json({ ok: false, error: 'Falha ao buscar minuta' });
  res.json({ ok: true, html: (Array.isArray(r.data) && r.data[0]?.html) || '' });
});

app.post('/api/minuta', async (req, res) => {
  if (!PROPOSTAS_ON) return res.status(503).json({ ok: false, error: 'Proxy desligado' });
  const { proposal_key, html } = req.body || {};
  if (!proposal_key) return res.status(400).json({ ok: false, error: 'proposal_key obrigatório' });
  const r = await sbProp('minutas?on_conflict=proposal_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ proposal_key: String(proposal_key), html: String(html || ''), atualizado_em: new Date().toISOString() }),
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: 'Falha ao salvar minuta', detail: r.data });
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, propostas_proxy: PROPOSTAS_ON }));

/* ---------- Rota pública de assinatura (antes do estático) ----------
   /assinar/<token> → entrega assinar.html. O token é extraído no client. */
app.get('/assinar/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'assinar.html'));
});

/* ---------- Portal público de cotação (fornecedor) ----------
   /cotacao/<token> → entrega cotacao.html. O token é lido no client. */
app.get('/cotacao/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'cotacao.html'));
});

/* ---------- Formulário de Coleta de Dados — Elevadores (cliente) ----------
   /formulario-cliente/<token> → entrega formulario-cliente.html (Canal 2,
   self-service). O token é lido no client. Ver issue #66. */
app.get('/formulario-cliente/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'formulario-cliente.html'));
});

/* ---------- Portal público de cotação técnica — Elevadores (fornecedor) ----------
   /cotacao-elevador-fornecedor/<token> → entrega cotacao-elevador-fornecedor.html.
   O token é lido no client. */
app.get('/cotacao-elevador-fornecedor/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'cotacao-elevador-fornecedor.html'));
});

/* ---------- Execução de vistoria pelo técnico (Vistorias de Obras, Fase 3) ----------
   /vistoria/<token> → entrega vistoria-execucao.html. O token é lido no
   client (vistorias_atividades.token). Sem SSO — link enviado direto
   pro celular do técnico. */
app.get('/vistoria/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'vistoria-execucao.html'));
});

/* ---------- Status público da obra (Cronograma de Instalação) ----------
   /status-obra/<token> → entrega status-obra.html. O token é lido no
   client (dossier_obra.link_publico_token). Somente leitura. */
app.get('/status-obra/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'status-obra.html'));
});

/* /status-obra-interno/<token> — mesma página, mesmo arquivo (o JS decide
   o modo lendo o pathname); token é outro campo (link_interno_token),
   revogável independente do link do cliente. Habilita anotações
   (não se aplica / previsão de data) que o link do cliente não tem. */
app.get('/status-obra-interno/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'status-obra.html'));
});

/* ---------- Diário de Obra (Acompanhamento de Obra) ----------
   /diario-obra/<token> → entrega diario-obra.html. O token é lido no
   client (acompanhamento_obra_links.token). Link fixo por dossiê,
   mandado ao Montador junto com o contrato — sem SSO, ele só acrescenta
   (flega + foto), nunca desmarca. */
app.get('/diario-obra/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'diario-obra.html'));
});

/* ---------- Termo de Entrega (assinatura digital) ----------
   /termo-entrega/<token> → entrega termo-entrega.html. O token é lido no
   client (dossier_obra.termo_entrega_token). Cliente e/ou supervisor
   assinam sem login — ver termo-entrega-store.js. */
app.get('/termo-entrega/:token', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'termo-entrega.html'));
});

/* ---------- Estáticos ----------
   Código (html/js/jsx/css) e version.json vão sempre com no-cache: o navegador
   é obrigado a revalidar com o servidor antes de usar a cópia salva (ETag/
   Last-Modified do express.static cuida disso — 304 se não mudou, conteúdo
   novo se mudou). Sem isso, alguém que abre o site pode receber JS de até
   1h atrás mesmo sem nunca ter aberto a aba antes. Imagens/fonts continuam
   com cache longo — não fazem parte do bundle de código, mudam raríssimo. */
const NO_CACHE_EXT = ['.html', '.js', '.jsx', '.css', '.json'];

/* Lista de permissão do que é público. Antes `express.static(__dirname)` servia
   a pasta inteira do repositório (docs, logs, scripts, o próprio server.js...)
   e o catch-all devolvia o index.html (HTTP 200) para QUALQUER caminho, até
   /api/inexistente (issue #615). Agora só passam: as páginas públicas da raiz,
   as pastas do front (src/styles/assets) e os módulos do SPA (mesmos slugs de
   MODULE_SLUG em src/router.js). Todo o resto responde 404. */
const PUBLIC_ROOT_FILES = new Set([
  'index.html', 'index-print.html', 'assinar.html', 'cotacao.html', 'cotacao-elevador-fornecedor.html',
  'diario-obra.html', 'formulario-cliente.html', 'status-obra.html', 'termo-entrega.html',
  'vistoria-execucao.html', 'colors_and_type.css', 'favicon.ico',
]);
/* TreinamentoVP: tutoriais passo a passo (páginas HTML estáticas, uma pasta por tela). O botão "Ajuda" do
   app (HelpCenter, src/shell.jsx) abre /TreinamentoVP/<slug>/. Só vai o que estiver no Git. */
const PUBLIC_DIRS = new Set(['src', 'styles', 'assets', 'TreinamentoVP']);
const SPA_MODULES = new Set([
  'geral', 'comercial', 'crm', 'cadastros', 'engenharia', 'logistica', 'gestao-importacao',
  'adm-financeiro', 'juridico', 'rh', 'admin',
]);
function primeiroSegmento(reqPath) {
  const seg = String(reqPath || '/').split('/').filter(Boolean);
  return { first: seg[0] || '', depth: seg.length };
}
function naoEncontrado(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  return res.status(404).type('text/plain').send('404 — página não encontrada');
}
/* O navegador pede /favicon.ico sozinho e o projeto não tem ícone: 204 (vazio)
   em vez de 404 no console — antes caía no catch-all e recebia o HTML do app. */
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use((req, res, next) => {
  const { first, depth } = primeiroSegmento(req.path);
  if (!first || PUBLIC_DIRS.has(first) || SPA_MODULES.has(first)) return next();
  if (depth === 1 && PUBLIC_ROOT_FILES.has(first)) return next();
  return naoEncontrado(req, res);
});

app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (NO_CACHE_EXT.some((ext) => filePath.endsWith(ext))) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

/* Catch-all SPA — só "/" e os módulos do app recebem o index.html; um arquivo
   estático que não existe (ex.: /src/faltando.js) agora é 404, e não o HTML do
   app com status 200 (que o navegador tentava executar como JS). */
app.get('*', (req, res) => {
  const { first } = primeiroSegmento(req.path);
  if (!first || SPA_MODULES.has(first)) return res.sendFile(path.join(__dirname, 'index.html'));
  return naoEncontrado(req, res);
});

app.listen(PORT, () => {
  console.log(`✅ VP Gestão rodando na porta ${PORT}  · Proxy Propostas: ${PROPOSTAS_ON ? 'ON' : 'OFF'}`);
});
