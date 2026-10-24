'use strict';
/* Paridade JS × SQL das regras de "dado a conferir" (24/10/2026).
   A tela usa src/evolucao-conferir-calc.js; o aviso diário ao Felipe usa a função SQL
   evolucao_conferir_achados (supabase/migrations/20261024110000_evolucao_alerta_felipe.sql).
   Este teste falha se uma regra for criada/removida/alterada de um lado só. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, 'evolucao-conferir-calc.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261024110000_evolucao_alerta_felipe.sql'), 'utf8');

const codigosJs = new Set([...js.matchAll(/achado\('([a-z_]+)'/g)].map((m) => m[1]));
const codigosSql = new Set([...sql.matchAll(/b\.serie, '([a-z_]+)'/g)].map((m) => m[1]));

test('mesmo conjunto de regras (códigos) no JS e no SQL', () => {
  assert.ok(codigosJs.size >= 12, 'o JS deveria ter ao menos 12 regras');
  assert.deepEqual([...codigosJs].sort(), [...codigosSql].sort());
});

test('limites numéricos iguais nos dois lados', () => {
  const lim = (re, txt) => { const m = re.exec(txt); assert.ok(m, 'limite não encontrado: ' + re); return Number(m[1]); };
  // JS
  const parado = lim(/DIAS_PARADO = (\d+)/, js);
  const semDiario = lim(/DIAS_UTEIS_SEM_DIARIO = (\d+)/, js);
  const replanejar = lim(/DIAS_REPLANEJAR = (\d+)/, js);
  const destoa = lim(/DIAS_DESTOA_IRMAOS = (\d+)/, js);
  const alta = lim(/ALTA_APOS_DIAS = (\d+)/, js);
  // SQL
  assert.equal(lim(/p_hoje - b\.upd > (\d+)/, sql), parado, 'dias parado');
  assert.equal(lim(/_evo_dias_uteis\(coalesce\(b\.rc, b\.entregue_em\), p_hoje\) >= (\d+)/, sql), semDiario, 'dias úteis sem Diário');
  assert.equal(lim(/abs\(r\.real - r\.prev\) > (\d+)/, sql), replanejar, 'previsão desatualizada');
  assert.equal(lim(/o\.rc is not null\) > (\d+)/, sql), destoa, 'chegada destoa dos irmãos');
  assert.equal(lim(/p_hoje - v\.d > (\d+)/, sql), alta, 'gravidade alta');
});

test('mesmas situações e fases em ambos (copiadas de mapa-obras-calc)', () => {
  const fases = ['DataBook', 'Entregue', 'Manutenção preventiva', 'Instalação', 'Contrato assinado', 'Importação', 'Homologação instalador'];
  fases.forEach((f) => assert.ok(sql.includes("'" + f + "'"), 'SQL sem a fase ' + f));
  global.window = global.window || {};
  require('./mapa-obras-calc.js');
  const M = window.MapaObrasCalc;
  assert.equal(M.classificar({ status_master: 'Instalação' }), 'andamento');
  assert.equal(M.classificar({ status_master: 'Importação' }), 'aguardando');
  assert.equal(M.classificar({ status_master: 'Entregue' }), 'concluida');
});

test('as duas pontas avisam que a outra existe', () => {
  assert.match(sql,/src\/evolucao-conferir-calc\.js/);
});
