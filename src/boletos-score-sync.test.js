'use strict';
/* Edge Function boletos-score-sync: regras puras que valem teste (o arquivo é TypeScript de Deno, sem module.exports;
   o bloco BEGIN/END DEDUPE é extraído e executado aqui, no mesmo padrão de boletos-avisos-calc.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'boletos-score-sync', 'index.ts'), 'utf8');
function bloco(nome) {
  const i = fonte.indexOf('// BEGIN ' + nome), j = fonte.indexOf('// END ' + nome);
  assert.ok(i >= 0 && j > i, 'bloco ' + nome + ' não encontrado');
  return fonte.slice(i, j);
}
const unicosPorTitulo = new Function(bloco('DEDUPE') + '\nreturn unicosPorTitulo;')();

const t = (o) => ({ codigo_lancamento_omie: 1, pago: false, data_pagamento: null, valor: 100, ...o });

test('título repetido na mesma página vira uma linha só (foi o que parou a carga de 17/11/2026)', () => {
  const r = unicosPorTitulo([t({ codigo_lancamento_omie: 7 }), t({ codigo_lancamento_omie: 8 }), t({ codigo_lancamento_omie: 7 })]);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => x.codigo_lancamento_omie).sort(), [7, 8]);
});
test('entre o título aberto e o mesmo título pago, fica o pago', () => {
  const aberto = t({ codigo_lancamento_omie: 5, pago: false });
  const pago = t({ codigo_lancamento_omie: 5, pago: true, data_pagamento: '2026-05-10' });
  assert.equal(unicosPorTitulo([aberto, pago])[0].pago, true);
  assert.equal(unicosPorTitulo([pago, aberto])[0].pago, true, 'a ordem não pode mudar o resultado');
});
test('dois pagamentos do mesmo título: fica o de data mais recente', () => {
  const a = t({ codigo_lancamento_omie: 5, pago: true, data_pagamento: '2026-05-10' });
  const b = t({ codigo_lancamento_omie: 5, pago: true, data_pagamento: '2026-05-20' });
  assert.equal(unicosPorTitulo([a, b])[0].data_pagamento, '2026-05-20');
  assert.equal(unicosPorTitulo([b, a])[0].data_pagamento, '2026-05-20');
});
test('lista sem repetição passa intacta e lista vazia não quebra', () => {
  assert.equal(unicosPorTitulo([t({ codigo_lancamento_omie: 1 }), t({ codigo_lancamento_omie: 2 })]).length, 2);
  assert.deepEqual(unicosPorTitulo([]), []);
});
test('a gravação do histórico passa pelo dedupe e uma falha de gravação vai para o cursor (não estoura em 500 calado)', () => {
  assert.match(fonte, /unicosPorTitulo\(\(resp\.movimentos/);
  const i = fonte.indexOf('await pgUpsert("boletos_avisos_historico"');
  assert.ok(i > 0);
  const antes = fonte.slice(Math.max(0, i - 120), i);
  assert.match(antes, /try \{/, 'o upsert do histórico precisa estar dentro de try');
  assert.match(fonte.slice(i, i + 700), /gravarCursor\(\{ \.\.\.c, ultimo_resultado: \{ erro/);
});
