/* ============================================================
   proposta-preview-espec.test.js — issue #704

   PreviewEspecTabela() monta a tabela "Especificações Técnicas" do
   preview HTML, 1 bloco por equipamento. A lista de linhas era montada
   inline, sem tensão/tração/dimensões da cabine. Extraída para
   montarLinhasEspec(s) — função pura, sem JSX — pra poder ser testada
   sem precisar de um harness de React. Mesma técnica de extração por
   eval() já usada em proposta-eq.test.js (proposta-store.js é JSX/UMD
   de browser, sem module.exports).
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'proposta-preview.jsx'), 'utf8');
function extrair(nome) {
  const i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função não encontrada em proposta-preview.jsx: ' + nome);
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) break; }
  }
  return src.slice(i, j + 1);
}
// eslint-disable-next-line no-eval
eval(extrair('montarLinhasEspec'));

test('montarLinhasEspec — inclui Tensão, Tração e Dimensões da Cabine quando preenchidos', () => {
  const linhas = montarLinhasEspec({ capacidade: '06 Passageiros x 450Kg', tensao: '220V/3P/60Hz', tracao: '2:1', dimensoesCabine: '1500 x 1700mm' });
  const porRotulo = Object.fromEntries(linhas);
  assert.equal(porRotulo['Tensão de Alimentação'], '220V/3P/60Hz');
  assert.equal(porRotulo['Tração'], '2:1');
  assert.equal(porRotulo['Dimensões da Cabine'], '1500 x 1700mm');
});

test('montarLinhasEspec — sem tensão/tração/cabine, as linhas não aparecem (mesmo filtro dos outros campos)', () => {
  const linhas = montarLinhasEspec({ capacidade: '06 Passageiros x 450Kg' });
  const rotulos = linhas.map(([k]) => k);
  assert.ok(!rotulos.includes('Tensão de Alimentação'));
  assert.ok(!rotulos.includes('Tração'));
  assert.ok(!rotulos.includes('Dimensões da Cabine'));
});

test('montarLinhasEspec — campos de hoje continuam no resultado (sem regressão)', () => {
  const linhas = montarLinhasEspec({ dimensoesCaixa: '1600 x 1840mm', profPoço: '1500', vel: '1', andaresParadasPortas: '18 Paradas' });
  const porRotulo = Object.fromEntries(linhas);
  assert.equal(porRotulo['Caixa de Corrida'], '1600 x 1840mm');
  assert.equal(porRotulo['Poço'], '1500mm');
  assert.equal(porRotulo['Velocidade'], '1 m/s');
  assert.equal(porRotulo['Paradas'], '18 Paradas');
});
