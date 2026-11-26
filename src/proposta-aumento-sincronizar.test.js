'use strict';
/* 26/11/2026 — "reprecificou, a proposta herda" (sincronizarPreco), com Supabase simulado.
   Casos reais: VPPR-1052-E (1 equipamento nunca recebia o preço) e VPPR-1066-B (recebia o preço da revisão C). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  for (const f of ['proposta-opcoes.js', 'proposta-aumento-calc.js', 'proposta-aumento-store.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, f), 'utf8'))(global.window);
  }
  return global.window;
}

function fakeSb(rows) {
  const escritas = [];
  const consulta = (lista) => {
    let r = lista;
    const q = { eq(col, val) { r = r.filter((x) => x[col] === val); return q; }, in() { return q; }, limit() { return q; },
      maybeSingle: async () => ({ data: r[0] || null, error: null }), then(ok, er) { return Promise.resolve({ data: r, error: null }).then(ok, er); } };
    return q;
  };
  return {
    escritas,
    from(t) {
      if (t === 'propostas') return {
        select() { return consulta(rows); },
        update(patch) { return { eq: async (_c, id) => { escritas.push({ id, patch }); Object.assign(rows.find((x) => x.id === id), patch); return { error: null }; } }; },
      };
      if (t === 'alertas') return { insert: async () => ({ error: null }) };
      return { select: () => consulta([]) };
    },
  };
}

function montar(rows, precoPorPz) {
  const w = carregar();
  const sb = fakeSb(rows);
  w.__VP_SB = { sb };
  const chamadas = [];
  w.PropostaHeranca = { prefillPorNumeroCotacao: async (num, opts) => {
    const id = opts && opts.precificacaoId;
    chamadas.push(id || null);
    return { encontrado: true, prefill: { elevador: { valores: { quantidade: '1', valorUnit: precoPorPz[id || 'mais-recente'] } } } };
  } };
  return { w, sb, chamadas };
}

const umEquip = (id, doc, pz, valorUnit) => ({ id, status: 'rascunho', proposal_type: 'elevador', vendedor_id: null, numero_cotacao: 1052, numero_documento: doc,
  valor_total: 0, precificacao_id: pz, data_json: { cliente: { nome: 'Cli' }, elevador: { valores: { quantidade: '1', valorUnit, formaTipo: 'parcelado', qtdParcelas: 5, parcelas: [] } } } });

test('sincronizarPreco: proposta de 1 equipamento recebe o preço novo e o valor_total (VPPR-1052-E)', async () => {
  const rows = [umEquip('E', 'VPPR-1052-E', 'pz-E', '351019,05')];
  const { w, sb } = montar(rows, { 'pz-E': '520190,84' });
  const r = await w.PropostaAumentoStore.sincronizarPreco(1052, 'E');
  assert.equal(r.atualizadas.length, 1);
  assert.equal(sb.escritas.length, 1);
  assert.equal(sb.escritas[0].patch.valor_total, 520190.84);
  assert.equal(w.PropostaAumento.parseNum(rows[0].data_json.elevador.valores.valorUnit), 520190.84);
});

test('sincronizarPreco: cada proposta segue a SUA Precificação, não a mais recente da cotação (VPPR-1066-B)', async () => {
  const rows = [umEquip('B', 'VPPR-1052-B', 'pz-B', '339233,99'), umEquip('E', 'VPPR-1052-E', 'pz-E', '351019,05')];
  const { w, chamadas } = montar(rows, { 'pz-B': '339233,99', 'pz-E': '520190,84' });
  await w.PropostaAumentoStore.sincronizarPreco(1052);
  assert.deepEqual(chamadas.sort(), ['pz-B', 'pz-E']);
  assert.equal(w.PropostaAumento.parseNum(rows[0].data_json.elevador.valores.valorUnit), 339233.99, 'a revisão B não pega o preço da E');
  assert.equal(w.PropostaAumento.parseNum(rows[1].data_json.elevador.valores.valorUnit), 520190.84);
});

test('sincronizarPreco: proposta que o cliente já viu não muda sozinha, só fica marcada', async () => {
  const row = umEquip('E', 'VPPR-1052-E', 'pz-E', '351019,05');
  row.status = 'enviada';
  const { w } = montar([row], { 'pz-E': '520190,84' });
  const r = await w.PropostaAumentoStore.sincronizarPreco(1052, 'E');
  assert.equal(r.atualizadas.length, 0);
  assert.equal(r.marcadas.length, 1);
  assert.equal(w.PropostaAumento.parseNum(row.data_json.elevador.valores.valorUnit), 351019.05);
  assert.equal(row.data_json.precoDefasado.total, 520190.84);
});
