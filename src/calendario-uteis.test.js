const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('./calendario-uteis.js');
const { diasUteis, somarDiasUteis, conjuntoDeFeriados } = window.CalendarioUteis;

const feriados = conjuntoDeFeriados([
  { data: '2026-10-12', ativo: true, conta_no_sla: true },
  { data: '2026-02-16', ativo: true, conta_no_sla: true },
  { data: '2026-02-17', ativo: true, conta_no_sla: true },
  { data: '2026-01-25', ativo: true, conta_no_sla: false }, // local: não conta
  { data: '2026-11-20', ativo: false, conta_no_sla: true },  // desativado: não conta
]);

test('segunda a sexta = 5 (duas pontas)', () => assert.equal(diasUteis('2026-10-05', '2026-10-09', feriados), 5));
test('sexta a segunda feriado = 1', () => assert.equal(diasUteis('2026-10-09', '2026-10-12', feriados), 1));
test('sábado e domingo = 0', () => assert.equal(diasUteis('2026-10-10', '2026-10-11', feriados), 0));
test('carnaval 2026 entre sexta e quarta = 2', () => assert.equal(diasUteis('2026-02-13', '2026-02-18', feriados), 2));
test('intervalo invertido = 0', () => assert.equal(diasUteis('2026-10-12', '2026-10-09', feriados), 0));
test('feriado local e feriado desativado não contam', () => {
  assert.equal(diasUteis('2026-01-25', '2026-01-26', feriados), 1);
  assert.equal(diasUteis('2026-11-20', '2026-11-20', feriados), 1);
});
test('somar: sexta + 1 com segunda feriado = terça', () => assert.equal(somarDiasUteis('2026-10-09', 1, feriados), '2026-10-13'));
test('somar: segunda + 5 pulando feriado = terça seguinte', () => assert.equal(somarDiasUteis('2026-10-05', 5, feriados), '2026-10-13'));
test('somar 0 devolve a própria data', () => assert.equal(somarDiasUteis('2026-10-05', 0, feriados), '2026-10-05'));
test('somar n negativo recusa', () => assert.throws(() => somarDiasUteis('2026-10-05', -1, feriados)));
test('mês com mais feriados rende menos dias úteis', () => {
  const fev = diasUteis('2026-02-01', '2026-02-28', feriados), out = diasUteis('2026-10-01', '2026-10-31', feriados);
  assert.equal(fev, 18); assert.equal(out, 21);
});

test('calendário todo feriado: erro claro em vez de laço/NULL', () => {
  const tudo = new Set(); for (let ms = Date.parse('2026-10-06T00:00:00Z'); ms < Date.parse('2037-01-01T00:00:00Z'); ms += 864e5) tudo.add(new Date(ms).toISOString().slice(0, 10));
  assert.throws(() => somarDiasUteis('2026-10-05', 1, tudo), /sem dia útil suficiente/);
});
