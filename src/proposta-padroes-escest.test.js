const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  for (const f of ['proposta-opcoes.js', 'proposta-padroes-escest.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, f), 'utf8'))(global.window);
  }
  return global.window;
}

test('semDifal: tira DIFAL dos textos jurídicos antigos sem quebrar a frase', () => {
  const { PropostaOpcoes: O } = carregar();
  assert.strictEqual(O.semDifal('majorações de taxas e impostos, a exemplo de DIFAL de ICMS e de tributos e encargos incidentes'),
    'majorações de taxas e impostos, a exemplo de tributos e encargos incidentes');
  assert.strictEqual(O.semDifal('ICMS final destino (DIFAL conforme localização da obra). Taxa CREA/CAU.'), 'Taxa CREA/CAU.');
  assert.strictEqual(O.semDifal('Majorações de taxas e impostos (DIFAL DE ICMS) havidos após a emissão'), 'Majorações de taxas e impostos havidos após a emissão');
  assert.strictEqual(O.semDifal('Sem a palavra.'), 'Sem a palavra.');
  assert.ok(!/difal/i.test(O.semDifal('incluindo DIFAL.')));
});

test('blocosAjustes e blocosCondicoes nunca devolvem DIFAL', () => {
  const { PropostaOpcoes: O } = carregar();
  const ed = { ajustes: { taxasExcluidas: 'a exemplo de DIFAL de ICMS e de tributos', taxasOut: 'ICMS final destino (DIFAL x).' }, condicoesPagto: { impostos: 'Inclui DIFAL de ICMS.' } };
  const todos = [...O.blocosAjustes(ed), ...O.blocosCondicoes(ed)].map(([, v]) => v).join(' ');
  assert.ok(!/difal/i.test(todos));
});

test('padrões de escada: 18 acabamentos, 4 características, instalação e responsabilidades, sem DIFAL', () => {
  const { PropostaPadroesEscEst: P } = carregar();
  const e = P.padroes('escada');
  assert.strictEqual(e.acabamentosLista.length, 18);
  assert.strictEqual(e.caracteristicasTec.length, 4);
  assert.ok(e.instalacao.descarregamento.includes('içamento'));
  assert.ok(e.responsabilidades.vendedor.length >= 7 && e.responsabilidades.comprador.length >= 6);
  assert.ok(!/difal/i.test(JSON.stringify(e)));
});

test('padrões de esteira: vocabulário trocado (pallets, esteiras rolantes), sem "escada"', () => {
  const { PropostaPadroesEscEst: P } = carregar();
  const t = JSON.stringify(P.padroes('esteira'));
  assert.ok(/pallets/.test(t) && /Esteiras Rolantes/.test(t));
  assert.ok(!/escada/i.test(t.replace(/escadas? rolantes?-Requisitos/i, '')) || /NBR 16734/.test(t));
});

test('completar: só preenche o que está vazio, nunca sobrescreve o digitado', () => {
  const { PropostaPadroesEscEst: P } = carregar();
  const padrao = { garantia: { garantia: 'G', condicoes: 'C' }, acabamentosLista: [{ nome: 'a', desc: 'b' }], descricao: [{ titulo: 'T', desc: 'D', beneficios: 'B' }] };
  const r = P.completar({ garantia: { garantia: 'meu texto', condicoes: '' }, acabamentosLista: [], descricao: [{ titulo: '', desc: '', beneficios: '' }] }, padrao);
  assert.strictEqual(r.garantia.garantia, 'meu texto');
  assert.strictEqual(r.garantia.condicoes, 'C');
  assert.strictEqual(r.acabamentosLista.length, 1);
  assert.strictEqual(r.descricao[0].titulo, 'T');
  const r2 = P.completar({ descricao: [{ titulo: 'Meu', desc: '', beneficios: '' }], acabamentosLista: [{ nome: 'x', desc: 'y' }] }, padrao);
  assert.strictEqual(r2.descricao[0].titulo, 'Meu');
  assert.strictEqual(r2.acabamentosLista[0].nome, 'x');
});
