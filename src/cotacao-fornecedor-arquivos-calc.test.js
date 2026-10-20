const test = require('node:test');
const assert = require('node:assert');
const C = require('./cotacao-fornecedor-arquivos-calc.js');

test('classificar usa a extensão, não o tipo informado (PDF de e-mail vem como octet-stream)', () => {
  assert.strictEqual(C.classificar('20261020-990-1-GEF.pdf', 'application/octet-stream'), 'documento');
  assert.strictEqual(C.classificar('Catch987C.jpg', 'image/jpeg'), 'imagem');
  assert.strictEqual(C.classificar('image(10-19-22-3(10-20-11-56-52).png', ''), 'imagem');
  assert.strictEqual(C.classificar('planta.DWG', ''), 'documento');
  assert.strictEqual(C.classificar('sem-extensao', 'image/png'), 'imagem');
  assert.strictEqual(C.classificar('sem-extensao', ''), 'documento');
});

test('familia junta as versões da cotação 990 (data na frente e _Updated)', () => {
  const f = C.familia('20261019-990-3-GEO-1500KG-6F-3units.pdf');
  assert.strictEqual(f, '990-3-geo-1500kg-6f-3units');
  assert.strictEqual(C.familia('20261019-990-3-GEO-1500KG-6F-3units_Updated.pdf'), f);
  assert.strictEqual(C.familia('20261020-990-3-GEO-1500KG-6F-3units.pdf'), f);
  assert.notStrictEqual(C.familia('20261020-990-4-GEP-MRL-1050KG-6F-1unit.pdf'), f);
  assert.strictEqual(C.familia('Proposta (1).pdf'), C.familia('Proposta.pdf'));
  assert.strictEqual(C.familia('Desenho_rev2.pdf'), C.familia('Desenho.pdf'));
});

test('montar: vigente = mais recente, antigas em ordem', () => {
  const r = C.montar([
    { id: 'a', nome: '20261019-990-3-GEO.pdf', quando: '2026-10-19T14:30:00Z', origem: 'formulario' },
    { id: 'b', nome: '20261019-990-3-GEO_Updated.pdf', quando: '2026-10-19T14:58:00Z', origem: 'email' },
    { id: 'c', nome: '20261020-990-3-GEO.pdf', quando: '2026-10-20T04:01:00Z', origem: 'email' },
    { id: 'd', nome: '20261020-990-1-GEF.pdf', quando: '2026-10-20T04:01:00Z', origem: 'email' },
  ]);
  assert.strictEqual(r.documentos.length, 2);
  const geo = r.documentos.find((d) => d.familia === '990-3-geo');
  assert.strictEqual(geo.vigente.id, 'c');
  assert.deepStrictEqual(geo.antigas.map((x) => x.id), ['b', 'a']);
  assert.strictEqual(r.imagens.length, 0);
});

test('montar: imagem repetida (mesmo tamanho) vira uma só; pequena fica oculta', () => {
  const r = C.montar([
    { id: '1', nome: 'Catch987C.jpg', tamanho: 60002, quando: '2026-10-15T08:41:00Z' },
    { id: '2', nome: 'Catch987C(10-19-22-31-51).jpg', tamanho: 60002, quando: '2026-10-19T14:35:00Z' },
    { id: '3', nome: 'image.png', tamanho: 168338, quando: '2026-10-15T19:53:00Z' },
    { id: '4', nome: 'logo.png', tamanho: 1200, quando: '2026-10-15T19:53:00Z' },
  ]);
  assert.strictEqual(r.imagens.length, 3);
  const catch_ = r.imagens.find((i) => i.tamanho === 60002);
  assert.strictEqual(catch_.vezes, 2);
  assert.strictEqual(catch_.id, '2');
  assert.strictEqual(r.imagens.find((i) => i.id === '4').oculta, true);
  assert.strictEqual(r.imagens.find((i) => i.id === '3').oculta, false);
});
