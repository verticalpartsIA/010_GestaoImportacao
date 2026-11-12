const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'precificacao-ajustes-calc.js'), 'utf8'))(global.window);
  return global.window.PrecificacaoAjustes;
}

test('normalizar: tira zero e lixo; soma e total com ajustes', () => {
  const P = carregar();
  const aj = { 'u1:1': '20.005,08', 'u2:1': 0, 'u3:1': '', 'u4:1': -1000.5, 'u5:1': 'abc' };
  assert.deepStrictEqual(P.normalizar(aj), { 'u1:1': 20005.08, 'u4:1': -1000.5 });
  assert.strictEqual(P.soma(aj), 19004.58);
  assert.strictEqual(P.totalComAjustes(690333.27, { a: 20005.08, b: 16543.15, c: 18599.87 }), 745481.37);
});

test('precoDoEquipamento: base + a diferença dele; os outros ficam travados', () => {
  const P = carregar();
  const aj = { 'u1:1': 20005.08 };
  assert.strictEqual(P.precoDoEquipamento(250419.71, aj, 'u1:1'), 270424.79);
  assert.strictEqual(P.precoDoEquipamento(207083.99, aj, 'u2:1'), 207083.99);
});

test('diferencaParaPedido: pedido menos o VLR da Precificação (não o valor da proposta defasada)', () => {
  const P = carregar();
  assert.strictEqual(P.diferencaParaPedido(270424.79, 250419.71), 20005.08);
  assert.strictEqual(P.diferencaParaPedido(223627.14, 207083.99), 16543.15);
  assert.strictEqual(P.diferencaParaPedido(251429.44, 232829.57), 18599.87);
});

test('o mark-up efetivo fecha exatamente no total com ajustes (motor real, planilha de 963)', () => {
  // mesma fixture do teste golden do motor
  const src = fs.readFileSync(path.join(__dirname, 'precificacao-elevador-engine.test.js'), 'utf8');
  assert.ok(/GOLDEN_963/.test(src));
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'precificacao-elevador-engine.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(__dirname, 'precificacao-ajustes-calc.js'), 'utf8'))(global.window);
  const E = global.window.PrecificacaoElevadorEngine; const P = global.window.PrecificacaoAjustes;
  const m = /const GOLDEN_963 = (\{[\s\S]*?\n\});/.exec(src);
  const G = new Function('return ' + m[1])();
  const base = E.calcularV2(G);
  const P0 = base.precificacao.precoVendaProposta;
  const T = P.totalComAjustes(P0, { a: 10000, b: -2500 });
  const al = E.alavancaParaPreco(base, T);
  assert.ok(al && al.valido);
  const novo = E.calcularV2({ ...G, markUpPct: al.valor });
  assert.ok(Math.abs(novo.precificacao.precoVendaProposta - T) < 0.01);
});
