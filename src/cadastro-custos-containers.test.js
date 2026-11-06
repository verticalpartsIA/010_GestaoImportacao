const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

/* Containers (06/11/2026): ID-TAG, Porto e Taxa de porto. Cobre a regra de negócio do AFRMM
   (8% de preço + capatazia + GRI + taxa; taxa vazia não entra), a ordem por ID-TAG e a consulta
   "em uso" que impede excluir container já citado numa Precificação. */
function carregarStore(sbFake) {
  global.window = { __VP_SB: { sb: sbFake } };
  (0, eval)(fs.readFileSync(path.join(__dirname, 'cadastro-custos-store.js'), 'utf8'));
  return global.window.CadastroCustosStore;
}
const perto = (a, b) => Math.abs(a - b) < 1e-9;

test('afrmmDoContainer: 8% de preço + capatazia + GRI, sem taxa de porto (taxa vazia não entra)', () => {
  const S = carregarStore({});
  const a = S.afrmmDoContainer({ preco_usd: 5000, capatazia_usd: 350, gri_usd: 0, taxa_porto_usd: null,
    preco_rs: 26820.5, capatazia_rs: 1000, gri_rs: 0, taxa_porto_rs: null });
  assert.ok(perto(a.usd, 0.08 * 5350), `usd=${a.usd}`);
  assert.ok(perto(a.rs, 0.08 * 27820.5), `rs=${a.rs}`);
});

test('afrmmDoContainer: com taxa de porto, a taxa soma na base (USD e R$)', () => {
  const S = carregarStore({});
  const a = S.afrmmDoContainer({ preco_usd: 5000, capatazia_usd: 350, gri_usd: 100, taxa_porto_usd: 250,
    preco_rs: 1000, capatazia_rs: 200, gri_rs: 50, taxa_porto_rs: 150 });
  assert.ok(perto(a.usd, 0.08 * 5700), `usd=${a.usd}`);
  assert.ok(perto(a.rs, 0.08 * 1400), `rs=${a.rs}`);
});

test('afrmmDoContainer: linha sem nenhum valor (ou nula) dá zero, sem NaN', () => {
  const S = carregarStore({});
  assert.deepStrictEqual(S.afrmmDoContainer({}), { usd: 0, rs: 0 });
  assert.deepStrictEqual(S.afrmmDoContainer(null), { usd: 0, rs: 0 });
  assert.deepStrictEqual(S.afrmmDoContainer({ preco_usd: '' , taxa_porto_usd: 'x' }), { usd: 0, rs: 0 });
});

test('listarContainers: ordena por ID-TAG (o mesmo tipo pode repetir em portos diferentes)', async () => {
  let ordenadoPor = null;
  const cadeia = { select: () => cadeia, order: (col) => { ordenadoPor = col; return cadeia; }, then: (ok) => ok({ data: [], error: null }) };
  const S = carregarStore({ from: () => cadeia });
  await S.listarContainers();
  assert.strictEqual(ordenadoPor, 'id_tag');
});

test('containerEmUso: devolve a contagem do banco; falha ou sem ID-TAG devolve null (o banco barra de qualquer jeito)', async () => {
  let chamada = null;
  const ok = { rpc: async (nome, args) => { chamada = { nome, args }; return { data: 2, error: null }; } };
  assert.strictEqual(await carregarStore(ok).containerEmUso('CONT-002'), 2);
  assert.deepStrictEqual(chamada, { nome: 'container_id_tag_em_uso', args: { p_id_tag: 'CONT-002' } });

  assert.strictEqual(await carregarStore({ rpc: async () => ({ data: 0, error: null }) }).containerEmUso('CONT-001'), 0);
  assert.strictEqual(await carregarStore({ rpc: async () => ({ data: null, error: { message: 'x' } }) }).containerEmUso('CONT-001'), null);
  assert.strictEqual(await carregarStore(ok).containerEmUso(''), null);
});
