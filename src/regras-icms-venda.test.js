const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function carregarStore(resposta) {
  const cadeia = { select: () => cadeia, eq: () => cadeia, then: (ok) => ok(resposta) };
  global.window = { __VP_SB: { sb: { from: () => cadeia } } };
  (0, eval)(fs.readFileSync(path.join(__dirname, 'cadastro-custos-store.js'), 'utf8'));
  return global.window.CadastroCustosStore;
}

test('buscarRegraIcmsVenda: falha de consulta interrompe (não vira "sem regra")', async () => {
  const S = carregarStore({ data: null, error: { message: 'rls' } });
  await assert.rejects(() => S.buscarRegraIcmsVenda({ ufDestino: 'SP' }), /Regras de ICMS/);
});

test('buscarRegraIcmsVenda: sem linhas devolve null; com NCM em branco vence a específica', async () => {
  assert.strictEqual(await carregarStore({ data: [], error: null }).buscarRegraIcmsVenda({ ufDestino: 'PE' }), null);
  const r = await carregarStore({ data: [{ ncm: '8428.10', aliquota_pct: 0.12 }, { ncm: null, aliquota_pct: 0.07 }], error: null }).buscarRegraIcmsVenda({ ufDestino: 'SP' });
  assert.strictEqual(r.aliquota_pct, 0.07);
});
