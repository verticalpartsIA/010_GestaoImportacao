'use strict';
/* Central de Decisões — store (#1215 C.4 e C.5). Supabase falso: cada consulta registra os filtros usados e devolve o que
   o teste mandar para aquela tabela. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./decisoes-store.js');

function fakeSb(resp) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      const filtros = [];
      const reg = (op) => (...a) => { filtros.push([op, ...a]); return q; };
      const q = {
        select: reg('select'), eq: reg('eq'), is: reg('is'), in: reg('in'), or: reg('or'), order: reg('order'), limit: reg('limit'),
        insert: (row) => { filtros.push(['insert', row]); return q; },
        single: () => q, maybeSingle: () => q,
        then(ok, erro) {
          chamadas.push({ tabela, filtros });
          const r = typeof resp[tabela] === 'function' ? resp[tabela](filtros) : (resp[tabela] || { data: [], error: null });
          return Promise.resolve(r).then(ok, erro);
        },
      };
      return q;
    },
  };
}

test('C.4 — criarDecisaoSeNaoExiste sem Nº de cotação usa .is (não .eq com null) e reaproveita a existente', async () => {
  const sb = fakeSb({ decisoes_gerenciais: { data: [{ id: 'ja-existe' }], error: null } });
  window.__VP_SB = { sb };
  const r = await window.DecisoesStore.criarDecisaoSeNaoExiste({ tipo: 'inbox_decisao', papelRequerido: 'ceo', numeroCotacao: null });
  assert.equal(r.id, 'ja-existe');
  const f = sb.chamadas[0].filtros;
  assert.ok(f.some(([op, col, v]) => op === 'is' && col === 'numero_cotacao' && v === null), 'usa .is(numero_cotacao, null)');
  assert.ok(!f.some(([op, col]) => op === 'eq' && col === 'numero_cotacao'), 'não usa .eq em numero_cotacao');
  assert.ok(f.some(([op, n]) => op === 'limit' && n === 1), 'pega uma só (não quebra com 2+ linhas)');
});

test('C.4 — com Nº de cotação continua usando .eq', async () => {
  const sb = fakeSb({ decisoes_gerenciais: { data: [{ id: 'd955' }], error: null } });
  window.__VP_SB = { sb };
  await window.DecisoesStore.criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_gestor', papelRequerido: 'gestor_comercial', numeroCotacao: 955 });
  assert.ok(sb.chamadas[0].filtros.some(([op, col, v]) => op === 'eq' && col === 'numero_cotacao' && v === 955));
});

const PEND = { id: 'p1', status: 'pendente', papel_requerido: 'ceo', aprovadores_esperados: ['diego@verticalparts.com.br', 'gelson.simoes@verticalparts.com.br'] };

test('C.5 — falha ao ler as alçadas mantém os aprovadores gravados (não tira ninguém)', async () => {
  window.__VP_SB = { sb: fakeSb({
    decisoes_gerenciais: { data: [PEND], error: null },
    alcadas_capacidade: { data: null, error: { message: 'falha simulada' } },
  }) };
  const [d] = await window.DecisoesStore.listarTodasEmAberto();
  assert.deepEqual(d.aprovadores_esperados, PEND.aprovadores_esperados);
});

test('C.5 — leitura das alçadas ok recalcula pelo papel atual', async () => {
  window.__VP_SB = { sb: fakeSb({
    decisoes_gerenciais: { data: [PEND], error: null },
    alcadas_capacidade: { data: [], error: null },
  }) };
  const [d] = await window.DecisoesStore.listarTodasEmAberto();
  assert.deepEqual(d.aprovadores_esperados, ['diego@verticalparts.com.br']);   // só o fixo do papel 'ceo'
});
