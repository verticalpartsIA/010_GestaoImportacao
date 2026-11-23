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

/* 13/11/2026 — lucro projetado com as diferenças de "Alterar valor" ainda não calculadas (corrige o lucro por equipamento). */
test('lucroProjetado: sem diferença pendente devolve o lucro salvo; sem base não projeta', () => {
  const P = carregar();
  assert.equal(P.lucroProjetado({ lucroSalvo: 1000, margemMarginal: 0.7, precoSalvo: 5000, precoAtual: 5000 }), 1000);
  assert.equal(P.lucroProjetado({ lucroSalvo: 1000, margemMarginal: 0, precoSalvo: 5000, precoAtual: 6000 }), 1000);
  assert.equal(P.lucroProjetado({ lucroSalvo: 1000, margemMarginal: 0.7, precoSalvo: 0, precoAtual: 6000 }), 1000);
});

test('lucroProjetado: igual ao lucro que o MOTOR devolve ao recalcular no preço novo (caso 1048, serviços 30%, DIFAL proporcional)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'precificacao-elevador-engine.test.js'), 'utf8');
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'precificacao-elevador-engine.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(__dirname, 'precificacao-ajustes-calc.js'), 'utf8'))(global.window);
  const E = global.window.PrecificacaoElevadorEngine; const P = global.window.PrecificacaoAjustes;
  const g = /const GOLDEN_1048_PLANILHA = (\{[\s\S]*?\n\});/.exec(src);
  const base0 = new Function('GOLDEN_963', 'return ' + g[1])({ parametros: new Function('return ' + /const GOLDEN_963 = \{[\s\S]*?parametros: (\{[\s\S]*?\n  \}),\n\};/.exec(src)[1])() });
  const A = 0.2075471698; // DIFAL BA sobre o preço do produto (base dupla composta), como a Precificação recalcula
  const rodar = (mk) => {
    let difal = 0; let r;
    for (let i = 0; i < 60; i++) {
      r = E.calcularV2({ ...base0, markUpPct: mk, difalCustoRs: difal });
      const novo = r.precificacao.precoVendaProduto * A;
      if (Math.abs(novo - difal) < 0.0001) break;
      difal = novo;
    }
    return r;
  };
  const salvo = rodar(0.43);
  const pvS = salvo.precificacao;
  const m = E.margemMarginal(pvS);
  for (const delta of [+20000, -35000, +1234.56]) {
    const alvo = P.totalComAjustes(pvS.precoVendaProposta, { a: delta });
    const al = E.alavancaParaPreco(salvo, alvo);
    const recalculado = rodar(al.valor);
    const projetado = P.lucroProjetado({ lucroSalvo: pvS.lucroFinal, margemMarginal: m, precoSalvo: pvS.precoVendaProposta, precoAtual: alvo });
    assert.ok(Math.abs(recalculado.precificacao.precoVendaProposta - alvo) < 0.01, 'o motor fecha no preço novo');
    assert.ok(Math.abs(recalculado.precificacao.lucroFinal - projetado) < 0.05, `Δ ${delta}: projetado ${projetado} × motor ${recalculado.precificacao.lucroFinal}`);
  }
});
