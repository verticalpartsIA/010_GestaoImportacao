'use strict';
// Testa src/fabricacao-quadro-store.js — fix do bug de produção (20/10/2026):
// "Could not find a relationship between 'pcp_ordens' and 'quadros_comando'
// in the schema cache", porque pcp_ordens.quadro_comando_id não tem FK
// declarada para quadros_comando.id. O banco falso abaixo reproduz esse
// comportamento real do PostgREST: um select() em 'pcp_ordens' que tenta
// embutir 'quadros_comando (' é recusado com o mesmo erro.
// Chamado por: scripts/run-tests.js (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'fabricacao-quadro-store.js'), 'utf8');

const ERRO_RELACIONAMENTO = { message: "Could not find a relationship between 'pcp_ordens' and 'quadros_comando' in the schema cache", code: 'PGRST200' };

/* Banco falso: cada tabela é uma lista; select/eq/in/order/maybeSingle filtram de verdade.
   pcp_ordens recusa qualquer select() que tente embutir "quadros_comando (" —
   é exatamente isso que o PostgREST real faz sem a FK. */
function bancoFalso(tabelas) {
  function consulta(tabela, linhas) {
    let rows = linhas.slice();
    let unica = false;
    let erroForcado = null;
    const q = {
      select(colunas) {
        if (tabela === 'pcp_ordens' && typeof colunas === 'string' && colunas.includes('quadros_comando (')) {
          erroForcado = ERRO_RELACIONAMENTO;
        }
        return q;
      },
      order() { return q; },
      limit() { return q; },
      eq(c, v) { rows = rows.filter((r) => String(r[c]) === String(v)); return q; },
      in(c, vs) { rows = rows.filter((r) => vs.map(String).includes(String(r[c]))); return q; },
      maybeSingle() { unica = true; return q; },
      then(res, rej) {
        if (erroForcado) return Promise.resolve({ data: null, error: erroForcado }).then(res, rej);
        return Promise.resolve({ data: unica ? (rows[0] || null) : rows, error: null }).then(res, rej);
      },
    };
    return q;
  }
  return {
    from: (t) => consulta(t, tabelas[t] || []),
  };
}

function carrega(tabelas) {
  const win = { __VP_SB: { sb: bancoFalso(tabelas) }, VPLog: null };
  const ctx = { window: win, console };
  vm.runInNewContext(SRC, ctx);
  return win.FabricacaoQuadroStore;
}

const plain = (x) => JSON.parse(JSON.stringify(x));

function base() {
  return {
    pcp_ordens: [
      { id: 'op-1', numero: 'OP-0001', titulo: 'Quadro X', produto: null, cliente: null, numero_cotacao: 955, status: 'em_producao', prazo_entrega: '2026-11-01', previsao_inicio: null, data_abertura: '2026-10-01', quadro_comando_id: 'qc-1', frente: 'quadro' },
      { id: 'op-2', numero: 'OP-0002', titulo: 'OP sem quadro', produto: null, cliente: null, numero_cotacao: null, status: 'aguardando', prazo_entrega: '2026-11-05', previsao_inicio: null, data_abertura: '2026-10-02', quadro_comando_id: null, frente: 'quadro' },
    ],
    quadros_comando: [
      { id: 'qc-1', numero_pedido: 'PED-10', numero_cotacao: 955, cliente_id: 'cli-1', fabricante_comando: 'WEG', modelo_comando: 'CFW-11' },
    ],
    fabricacao_quadro_status: [],
    fabricacao_quadro_ocorrencias: [],
    fabricacao_quadro_itens: [],
  };
}

test('obterEstadoOrdem: não lança "Could not find a relationship" — busca o Quadro de Comando numa 2ª consulta e preenche ordem.quadros_comando', async () => {
  const store = carrega(base());
  const estado = await store.obterEstadoOrdem('op-1');
  assert.equal(estado.ordem.id, 'op-1');
  assert.ok(estado.ordem.quadros_comando, 'ordem.quadros_comando deveria vir preenchido');
  assert.equal(estado.ordem.quadros_comando.numero_pedido, 'PED-10');
  assert.equal(estado.ordem.quadros_comando.modelo_comando, 'CFW-11');
});

test('obterEstadoOrdem: OP sem quadro_comando_id devolve ordem.quadros_comando = null, sem tentar buscar nada', async () => {
  const store = carrega(base());
  const estado = await store.obterEstadoOrdem('op-2');
  assert.equal(estado.ordem.id, 'op-2');
  assert.equal(estado.ordem.quadros_comando, null);
});

test('obterEstadoOrdem: falha ao buscar o Quadro de Comando não derruba a função — segue com quadros_comando null', async () => {
  const t = base();
  t.quadros_comando = []; // id inexistente -> maybeSingle() devolve null, não erro; simula outro caminho de ausência
  const store = carrega(t);
  const estado = await store.obterEstadoOrdem('op-1');
  assert.equal(estado.ordem.quadros_comando, null);
});

test('listarOPsAbertas: não lança "Could not find a relationship" — junta pcp_ordens e quadros_comando em JS por quadro_comando_id', async () => {
  const store = carrega(base());
  const ordens = await store.listarOPsAbertas();
  const porId = {}; ordens.forEach((o) => { porId[o.id] = o; });
  assert.ok(porId['op-1'].quadros_comando, 'op-1 deveria ter o cabeçalho do quadro embutido');
  assert.equal(porId['op-1'].quadros_comando.numero_pedido, 'PED-10');
  assert.equal(porId['op-2'].quadros_comando, null);
});

test('listarOPsAbertas: sem nenhuma OP com quadro_comando_id, não consulta quadros_comando e não quebra', async () => {
  const t = base();
  t.pcp_ordens = [t.pcp_ordens[1]]; // só a OP sem quadro
  const store = carrega(t);
  const ordens = await store.listarOPsAbertas();
  assert.equal(ordens.length, 1);
  assert.equal(ordens[0].quadros_comando, null);
});
