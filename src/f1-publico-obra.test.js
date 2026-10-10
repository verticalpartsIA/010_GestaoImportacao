'use strict';
/* Segurança real (#571, F1) — páginas públicas de obra (status-obra, vistoria-execucao, diario-obra, termo-entrega)
   falam por RPC `public_*` e caem no caminho antigo (tabela direta) se a RPC falhar; localStorage.vp_public_rpc='off'
   desliga a RPC. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
if (typeof navigator === 'undefined') global.navigator = { userAgent: 'node-test' };
global.fetch = () => Promise.reject(new Error('sem rede no teste'));

const _ls = {};
global.localStorage = {
  getItem: (k) => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
};

/* Mock Supabase: rpcs[nome] = {data,error} | (args) => {data,error} | 'throw'; byTable[tabela] = {data,error}.
   Registra as chamadas em calls.rpc / calls.from. */
function mockSb({ rpcs = {}, byTable = {} } = {}) {
  const calls = { rpc: [], from: [] };
  function chain(table) {
    calls.from.push(table);
    const spec = byTable[table];
    const result = () => (typeof spec === 'function' ? spec() : (spec || { data: null }));
    const b = {};
    ['select', 'eq', 'in', 'or', 'order', 'limit', 'update', 'insert', 'upsert'].forEach((m) => { b[m] = () => b; });
    b.single = () => Promise.resolve(result());
    b.maybeSingle = () => Promise.resolve(result());
    b.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
    return b;
  }
  return {
    calls,
    from: chain,
    rpc: (nome, args) => {
      calls.rpc.push({ nome, args });
      const spec = rpcs[nome];
      if (spec === 'throw') return Promise.reject(new Error('rede'));
      if (spec === undefined) return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'função não existe' } });
      return Promise.resolve(typeof spec === 'function' ? spec(args) : spec);
    },
  };
}
function usar(sb) { window.__VP_SB = { sb }; return sb; }

usar(mockSb());
require('./instalacao-checklist-store.js');
require('./acompanhamento-obra-store.js');
require('./termo-entrega-store.js');
require('./vistorias-questionarios-store.js');
const IC = window.InstalacaoChecklistStore;
const AO = window.AcompanhamentoObraStore;
const TE = window.TermoEntregaStore;
const VQ = window.VistoriasQuestionariosStore;

test.beforeEach(() => { delete _ls.vp_public_rpc; });

/* ---------- status-obra ---------- */
test('status-obra — obterPorToken usa a RPC e a Sessão Administrativa também vem por RPC (sem tocar tabelas)', async () => {
  const sb = usar(mockSb({ rpcs: {
    public_status_obra_obter: { data: { dossier: { id: 'DOS-1', client_name: 'C', building_name: 'B' }, itens: [{ id: 'i1', semana: 1 }] } },
    public_status_obra_sessao: { data: [{ chave: 'doc_instalador', concluido: false }] },
  } }));
  const r = await IC.obterPorToken('tok-publico-1');
  assert.deepEqual(r, { dossier: { id: 'DOS-1', client_name: 'C', building_name: 'B' }, itens: [{ id: 'i1', semana: 1 }] });
  const sessao = await IC.obterSessaoAdministrativa(r.dossier);
  assert.deepEqual(sessao, [{ chave: 'doc_instalador', concluido: false }]);
  assert.deepEqual(sb.calls.from, []);
  assert.deepEqual(sb.calls.rpc.map((c) => [c.nome, c.args.p_modo, c.args.p_token]), [
    ['public_status_obra_obter', 'cliente', 'tok-publico-1'],
    ['public_status_obra_sessao', 'cliente', 'tok-publico-1'],
  ]);
});

test('status-obra — link interno passa p_modo interno', async () => {
  const sb = usar(mockSb({ rpcs: { public_status_obra_obter: { data: { dossier: { id: 'DOS-2' }, itens: [] } } } }));
  await IC.obterPorTokenInterno('tok-interno-1');
  assert.equal(sb.calls.rpc[0].args.p_modo, 'interno');
});

test('status-obra — token inexistente (RPC devolve null) não cai no caminho antigo', async () => {
  const sb = usar(mockSb({ rpcs: { public_status_obra_obter: { data: null } } }));
  assert.equal(await IC.obterPorToken('tok-nao-existe'), null);
  assert.deepEqual(sb.calls.from, []);
});

test('status-obra — RPC inexistente cai no caminho antigo (tabela)', async () => {
  const sb = usar(mockSb({ byTable: { dossier_obra: { data: { id: 'DOS-3' } }, instalacao_checklist_itens: { data: [] } } }));
  const r = await IC.obterPorToken('tok-publico-3');
  assert.equal(r.dossier.id, 'DOS-3');
  assert.ok(sb.calls.from.includes('dossier_obra'));
});

test('status-obra — vp_public_rpc=off não chama RPC', async () => {
  localStorage.setItem('vp_public_rpc', 'off');
  const sb = usar(mockSb({ byTable: { dossier_obra: { data: { id: 'DOS-4' } }, instalacao_checklist_itens: { data: [] } } }));
  await IC.obterPorToken('tok-publico-4');
  assert.equal(sb.calls.rpc.length, 0);
});

test('status-obra — obterSessaoAdministrativa do app interno (dossiê sem token) continua lendo tabelas', async () => {
  const sb = usar(mockSb());
  await IC.obterSessaoAdministrativa({ id: 'DOS-INTERNO', proposta_id: null });
  assert.equal(sb.calls.rpc.length, 0);
  assert.ok(sb.calls.from.includes('vistorias_obras'));
});

/* ---------- diario-obra ---------- */
test('diário — obterEstadoPorToken usa a RPC e devolve o mesmo formato', async () => {
  const sb = usar(mockSb({ rpcs: { public_diario_obter: { data: {
    link: { dossier_id: 'DOS-5' }, dossier: { id: 'DOS-5', building_name: 'B' }, status: [{ item_id: 'x', flegado: false }], equipamentos: [{ numero_serie: '1' }],
  } } } }));
  const r = await AO.obterEstadoPorToken('a'.repeat(48));
  assert.equal(r.link.dossier_id, 'DOS-5');
  assert.equal(r.status.length, 1);
  assert.deepEqual(r.lancamentos, []);
  assert.deepEqual(sb.calls.from, []);
});

test('diário — RPC com erro de rede cai no caminho antigo', async () => {
  const sb = usar(mockSb({ rpcs: { public_diario_obter: 'throw' }, byTable: { acompanhamento_obra_links: { data: { dossier_id: 'DOS-6', token: 't' } } } }));
  const r = await AO.obterEstadoPorToken('b'.repeat(48));
  assert.equal(r.link.dossier_id, 'DOS-6');
  assert.ok(sb.calls.from.includes('dossier_obra'));
});

test('diário — link inexistente (RPC null) devolve null', async () => {
  usar(mockSb({ rpcs: { public_diario_obter: { data: null } } }));
  assert.equal(await AO.obterEstadoPorToken('c'.repeat(48)), null);
});

/* ---------- vistoria-execucao ---------- */
test('vistoria — obterAtividadePorToken usa a RPC', async () => {
  const sb = usar(mockSb({ rpcs: { public_vistoria_obter: { data: { id: 'A1', dossier_obra: { client_name: 'C' }, vistorias_questionarios: { id: 'Q1' } } } } }));
  const a = await VQ.obterAtividadePorToken('11111111-2222-3333-4444-555555555555');
  assert.equal(a.vistorias_questionarios.id, 'Q1');
  assert.deepEqual(sb.calls.from, []);
});

test('vistoria — RPC inexistente cai no select antigo; off desliga a RPC', async () => {
  let sb = usar(mockSb({ byTable: { vistorias_atividades: { data: { id: 'A2' } } } }));
  assert.equal((await VQ.obterAtividadePorToken('tok-vistoria-2')).id, 'A2');
  assert.deepEqual(sb.calls.from, ['vistorias_atividades']);
  localStorage.setItem('vp_public_rpc', 'off');
  sb = usar(mockSb({ byTable: { vistorias_atividades: { data: { id: 'A3' } } } }));
  await VQ.obterAtividadePorToken('tok-vistoria-3');
  assert.equal(sb.calls.rpc.length, 0);
});

/* ---------- termo-entrega ---------- */
test('termo — obterPorToken usa a RPC', async () => {
  const sb = usar(mockSb({ rpcs: { public_termo_obter: { data: { client_name: 'C', termo_entrega: { modo: 'self_service', status: 'pendente', assinaturas: {} } } } } }));
  const o = await TE.obterPorToken('tok-termo-1');
  assert.equal(o.client_name, 'C');
  assert.deepEqual(sb.calls.from, []);
});

test('termo — assinatura parcial (presencial, só cliente) não gera PDF nem toca tabelas', async () => {
  const sb = usar(mockSb({ rpcs: { public_termo_assinar: { data: { ok: true, completo: false, termo: { modo: 'presencial', status: 'pendente', assinaturas: { cliente: { nome: 'F' } } } } } } }));
  const t = await TE.assinar({ token: 'tok-termo-2', papel: 'cliente', nome: ' F ', assinaturaPngDataUrl: 'data:image/png;base64,AA' });
  assert.equal(t.status, 'pendente');
  assert.equal(sb.calls.rpc.length, 1);
  assert.equal(sb.calls.rpc[0].args.p_nome, 'F');
  assert.equal(sb.calls.rpc[0].args.p_papel, 'cliente');
  assert.deepEqual(sb.calls.from, []);
});

test('termo — assinatura que completa tenta o PDF e registra o resultado por RPC', async () => {
  const sb = usar(mockSb({ rpcs: {
    public_termo_assinar: { data: { ok: true, completo: true, dossier: { id: 'DOS-7' }, termo: { modo: 'self_service', status: 'concluido', assinaturas: { cliente: { nome: 'F' } } } } },
    public_termo_registrar_pdf: { data: { ok: true } },
  } }));
  // sem window.jspdf → gerar PDF falha → registra pdf_erro
  const t = await TE.assinar({ token: 'tok-termo-3', papel: 'cliente', nome: 'F', assinaturaPngDataUrl: 'data:image/png;base64,AA' });
  assert.equal(t.status, 'concluido');
  assert.ok(t.pdf_erro);
  const reg = sb.calls.rpc.find((c) => c.nome === 'public_termo_registrar_pdf');
  assert.equal(reg.args.p_documento_id, null);
  assert.ok(reg.args.p_pdf_erro);
  assert.deepEqual(sb.calls.from, []);
});

test('termo — erro de negócio da RPC vira mensagem (sem cair no caminho antigo)', async () => {
  const sb = usar(mockSb({ rpcs: { public_termo_assinar: { data: { ok: false, erro: 'ja_assinado' } } } }));
  await assert.rejects(TE.assinar({ token: 'tok-termo-4', papel: 'cliente', nome: 'F', assinaturaPngDataUrl: 'data:image/png;base64,AA' }), /já foi registrada/);
  assert.deepEqual(sb.calls.from, []);
});

test('termo — RPC inexistente cai no caminho antigo (dossier_obra)', async () => {
  const sb = usar(mockSb({ byTable: { dossier_obra: { data: { id: 'DOS-8', termo_entrega: { modo: 'presencial', status: 'pendente', assinaturas: {} } }, error: null } } }));
  const t = await TE.assinar({ token: 'tok-termo-5', papel: 'cliente', nome: 'F', assinaturaPngDataUrl: 'data:image/png;base64,AA' });
  assert.equal(t.assinaturas.cliente.nome, 'F');
  assert.ok(sb.calls.from.includes('dossier_obra'));
});
