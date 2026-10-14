/* ============================================================
   cadastros-clientes-vincula-quadros.test.js — lead convertido leva o cliente para o pedido de quadro

   Quando um lead vira cliente, os pedidos de Quadro de Comando que nasceram dele (quadros_comando.lead_id)
   passam a apontar para o cliente. Só preenche quem ainda não tem cliente; falha nunca derruba a conversão.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, 'cadastros-clientes-store.js'), 'utf8');

function montar({ lead, quadros, erroQuadros }) {
  const avisos = [];
  const sb = {
    from(nome) {
      const filtros = [];
      let patch = null;
      const q = {
        select() { return q; },
        update(p) { patch = p; return q; },
        eq(col, val) { filtros.push((l) => l[col] === val); return q; },
        is(col, val) { filtros.push((l) => (l[col] ?? null) === val); return q; },
        ilike() { return q; },
        limit() { return q; },
        maybeSingle: async () => ({ data: nome === 'leads' ? lead : null, error: null }),
        then(res) {
          if (nome === 'quadros_comando' && patch) {
            if (erroQuadros) return Promise.resolve({ data: null, error: { message: 'boom' } }).then(res);
            const alvo = quadros.filter((l) => filtros.every((f) => f(l)));
            alvo.forEach((l) => Object.assign(l, patch));
            return Promise.resolve({ data: alvo.map((l) => ({ id: l.id })), error: null }).then(res);
          }
          return Promise.resolve({ data: [], error: null }).then(res);
        },
      };
      return q;
    },
  };
  const win = { __VP_SB: { sb } };
  const ctx = vm.createContext({ window: win, console: { warn: (...a) => avisos.push(a), log() {}, error() {} }, Date, Math, Promise, String, Set, Object, Array });
  vm.runInContext(src, ctx);
  return { store: win.CadastrosClientesStore, avisos };
}

test('vincularQuadrosDoLead preenche só quem ainda não tem cliente', async () => {
  const quadros = [
    { id: 'Q1', lead_id: 'LD-1', cliente_id: null },
    { id: 'Q2', lead_id: 'LD-1', cliente_id: 'cli-antigo' },
    { id: 'Q3', lead_id: 'LD-2', cliente_id: null },
  ];
  const { store } = montar({ lead: null, quadros });
  const n = await store.vincularQuadrosDoLead('LD-1', 'cli-novo');
  assert.equal(n, 1);
  assert.equal(quadros[0].cliente_id, 'cli-novo');
  assert.equal(quadros[1].cliente_id, 'cli-antigo');
  assert.equal(quadros[2].cliente_id, null);
});

test('lead que já tem cliente: criarOuVincularDeLead também leva o cliente para o pedido de quadro', async () => {
  const quadros = [{ id: 'Q1', lead_id: 'LD-1', cliente_id: null }];
  const { store } = montar({ lead: { cliente_id: 'cli-9' }, quadros });
  const id = await store.criarOuVincularDeLead({ id: 'LD-1', building: 'Obra X' });
  assert.equal(id, 'cli-9');
  assert.equal(quadros[0].cliente_id, 'cli-9');
});

test('falha ao vincular os quadros só avisa e não derruba a conversão', async () => {
  const quadros = [{ id: 'Q1', lead_id: 'LD-1', cliente_id: null }];
  const { store, avisos } = montar({ lead: { cliente_id: 'cli-9' }, quadros, erroQuadros: true });
  const id = await store.criarOuVincularDeLead({ id: 'LD-1', building: 'Obra X' });
  assert.equal(id, 'cli-9');
  assert.equal(avisos.length, 1);
  assert.equal(quadros[0].cliente_id, null);
});

test('sem lead ou sem cliente não faz nada', async () => {
  const { store } = montar({ lead: null, quadros: [] });
  assert.equal(await store.vincularQuadrosDoLead(null, 'c'), 0);
  assert.equal(await store.vincularQuadrosDoLead('LD-1', null), 0);
});
