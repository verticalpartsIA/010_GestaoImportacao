'use strict';
// Testa o registro da requisição enviada em "Comprado" (src/importacao-varejo-store.js) — #843 A2.
// Chamado por: scripts/run-tests.js (npm test). Banco e função falsos em memória.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'importacao-varejo-store.js'), 'utf8');

function carrega({ resposta, erroInsert }) {
  const inseridos = []; const logs = [];
  const sb = {
    functions: { invoke: async () => ({ data: resposta, error: null }) },
    from: (t) => ({ insert: async (rows) => { inseridos.push({ t, rows }); return { error: erroInsert || null }; } }),
  };
  const win = { __VP_SB: { sb }, __VP_USER: { email: 'c@x.test', name: 'Comprador' }, VPLog: { registrar: (l) => logs.push(l) } };
  vm.runInNewContext(SRC, { window: win, console: { warn() {} } });
  return { store: win.ImportacaoVarejoStore, inseridos, logs };
}
const itens = [{ codigo: 'VPEL-1', quantidade: 10 }, { codigo: 'VPEL-2', quantidade: 5 }];

test('requisição enviada vira "Comprado" (origem requisicao, com nº e previsão), só dos itens incluídos', async () => {
  const { store, inseridos } = carrega({ resposta: { codReqCompra: 777, quantidadeItens: 1, itensComErro: [{ codigo: 'VPEL-2', motivo: 'x' }] } });
  const r = await store.enviarRequisicaoOmie(itens);
  assert.equal(r.avisoRegistro, undefined);
  assert.equal(inseridos.length, 1);
  assert.equal(inseridos[0].t, 'importacao_varejo_comprado');
  assert.equal(inseridos[0].rows.length, 1);
  const linha = inseridos[0].rows[0];
  assert.equal(linha.codigo, 'VPEL-1'); assert.equal(linha.quantidade, 10);
  assert.equal(linha.requisicao_omie, 777); assert.equal(linha.origem, 'requisicao');
  assert.match(linha.previsao_chegada, /^\d{4}-\d{2}-\d{2}$/);
});

test('falha ao registrar não lança (a requisição já existe no Omie) e devolve aviso', async () => {
  const { store } = carrega({ resposta: { codReqCompra: 778, quantidadeItens: 2 }, erroInsert: { message: 'rls' } });
  const r = await store.enviarRequisicaoOmie(itens);
  assert.equal(r.codReqCompra, 778);
  assert.equal(r.avisoRegistro, 'rls');
});

test('previsaoPadrao soma 90 dias no calendário local', () => {
  const { store } = carrega({ resposta: {} });
  assert.equal(store.previsaoPadrao(new Date(2026, 9, 12)), '2027-01-10');
  assert.equal(store.previsaoPadrao(new Date(2026, 11, 31), 1), '2027-01-01');
});

/* Banco falso com select/update encadeáveis para as linhas de "Comprado" (correção da previsão — achado do Codex no PR #849). */
function carregaComLinhas(linhas) {
  const logs = []; const filtros = [];
  const sb = {
    from: () => {
      let rows = linhas.slice(); let patch = null;
      const q = {
        select() { return q; },
        order() { return q; },
        eq(c, v) { filtros.push([c, v]); rows = rows.filter((r) => String(r[c]) === String(v)); return q; },
        update(p) { patch = p; return q; },
        maybeSingle() { if (patch && rows[0]) Object.assign(rows[0], patch); return Promise.resolve({ data: rows[0] || null, error: null }); },
        then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); },
      };
      return q;
    },
  };
  const win = { __VP_SB: { sb }, __VP_USER: {}, VPLog: { registrar: (l) => logs.push(l) } };
  vm.runInNewContext(SRC, { window: win, console: { warn() {} } });
  return { store: win.ImportacaoVarejoStore, logs, filtros };
}

test('listarCompradoAberto devolve as linhas abertas do produto, com id e nº da requisição', async () => {
  const { store } = carregaComLinhas([
    { id: 'a', codigo: 'VPEL-1', recebido: false, quantidade: 10, previsao_chegada: '2027-01-10', requisicao_omie: 777, origem: 'requisicao' },
    { id: 'b', codigo: 'VPEL-1', recebido: true, quantidade: 3, previsao_chegada: '2026-01-10' },
    { id: 'c', codigo: 'VPEL-2', recebido: false, quantidade: 5, previsao_chegada: '2027-01-10' },
  ]);
  const r = JSON.parse(JSON.stringify(await store.listarCompradoAberto('VPEL-1')));
  assert.deepEqual(r.map((x) => x.id), ['a']);
  assert.equal(r[0].requisicao_omie, 777);
});

test('atualizarPrevisaoComprado corrige a data e registra o log; id inexistente dá erro', async () => {
  const { store, logs } = carregaComLinhas([{ id: 'a', codigo: 'VPEL-1', recebido: false, previsao_chegada: '2027-01-10' }]);
  await store.atualizarPrevisaoComprado('a', '2026-12-01');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].detalhe.previsao_chegada, '2026-12-01');
  await assert.rejects(() => store.atualizarPrevisaoComprado('zzz', '2026-12-01'), /não encontrado/);
  await assert.rejects(() => store.atualizarPrevisaoComprado('a', ''), /previsão/i);
});
