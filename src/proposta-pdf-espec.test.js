/* ============================================================
   proposta-pdf-espec.test.js — issue #704

   O PDF real da Proposta (pdf-bundle/proposta-reactpdf.entry.js) só lia
   especificacoes[0] na tabela de Especificações Técnicas — com 2+
   equipamentos (ex.: cotação 950/955), só o 1º aparecia no PDF baixado
   pelo cliente, mesmo o preview HTML já mostrando todos. Extraído
   montarBlocosEspec(especificacoes) — função pura, sem JSX/`h()` — pra
   testar a separação por equipamento e os novos campos (tensão/tração/
   cabine) sem precisar renderizar react-pdf. Mesma técnica de extração
   por eval() já usada em proposta-eq.test.js.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pdf-bundle', 'proposta-reactpdf.entry.js'), 'utf8');
function extrair(nome) {
  const i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função não encontrada em proposta-reactpdf.entry.js: ' + nome);
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) break; }
  }
  return src.slice(i, j + 1);
}
eval(extrair('montarBlocosEspec'));

test('montarBlocosEspec — 1 bloco por equipamento (cotação com 2+ elevadores, bug real das 950/955)', () => {
  const blocos = montarBlocosEspec([
    { id: 'VPEL-EL0955-1', capacidade: '14 Passageiros x 1050Kg', tensao: '220V', tracao: '2:1' },
    { id: 'VPEL-EL0955-2', capacidade: '14 Passageiros x 1050Kg', tensao: '380V', tracao: '4:1' },
  ]);
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0].id, 'VPEL-EL0955-1');
  assert.equal(blocos[1].id, 'VPEL-EL0955-2');
  const linhas0 = Object.fromEntries(blocos[0].linhas);
  const linhas1 = Object.fromEntries(blocos[1].linhas);
  assert.equal(linhas0['Tensão de Alimentação'], '220V');
  assert.equal(linhas1['Tensão de Alimentação'], '380V');
  assert.equal(linhas0['Tração'], '2:1');
  assert.equal(linhas1['Tração'], '4:1');
});

test('montarBlocosEspec — dimensões da cabine entram na lista de linhas quando preenchidas', () => {
  const blocos = montarBlocosEspec([{ id: 'E1', dimensoesCabine: '1500 x 1700mm' }]);
  const porRotulo = Object.fromEntries(blocos[0].linhas);
  assert.equal(porRotulo['Dimensões da Cabine'], '1500 x 1700mm');
});

test('montarBlocosEspec — sem especificações, cai no formato antigo de 1 bloco vazio (sem quebrar o PDF)', () => {
  const blocos = montarBlocosEspec([]);
  assert.equal(blocos.length, 1);
  assert.deepEqual(blocos[0].linhas, []);
});
