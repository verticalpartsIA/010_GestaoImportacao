// Configuração do rolo lembrada por tipo de etiqueta (por computador).
const test = require('node:test');
const assert = require('node:assert/strict');
const mem = {};
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.window = global.window || {};
global.navigator = global.navigator || {};
require('./etiquetas-impressoras.js');
const EI = window.EtiquetasImpressoras;

test('config por tipo: grava só os campos do rolo, separa os tipos e esquece', () => {
  assert.deepEqual(EI.lerPorTipo(), {});
  const cfg = { adaptador: 'navegador', id: 'x', perfilId: 'p', largura_mm: '50', altura_mm: '30', colunas: '2', espaco_mm: '3', desl_x_mm: '0.5' };
  EI.gravarPorTipo('CHICOTE_QUADRO', cfg);
  EI.gravarPorTipo('EXPEDICAO', { largura_mm: '100', altura_mm: '150' });
  const m = EI.lerPorTipo();
  assert.deepEqual(m.CHICOTE_QUADRO, { largura_mm: '50', altura_mm: '30', colunas: '2', espaco_mm: '3', desl_x_mm: '0.5' });
  assert.equal(m.CHICOTE_QUADRO.adaptador, undefined, 'impressora/perfil não entram');
  assert.deepEqual(m.EXPEDICAO, { largura_mm: '100', altura_mm: '150' });
  EI.esquecerPorTipo('CHICOTE_QUADRO');
  assert.equal(EI.lerPorTipo().CHICOTE_QUADRO, undefined);
  assert.ok(EI.lerPorTipo().EXPEDICAO);
  assert.deepEqual(EI.camposRolo(null), {});
});
