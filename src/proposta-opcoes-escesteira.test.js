'use strict';
/* Escada/Esteira: textos e tabelas próprios do equipamento — nunca "paradas"/"elevador". */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-opcoes.js'), 'utf8'))(global.window);
const O = window.PropostaOpcoes;

test('linhas de especificação da escada: desnível/largura do degrau, sem paradas', () => {
  const l = O.linhasEspecEscEst({ empreendimento: 'Shopping', desnivel: '3390', incl: '30º', largDegrau: '1000mm', vel: '0.5 m/s', qtd: 4 }, 'escada');
  const rotulos = l.map(([k]) => k);
  assert.ok(rotulos.includes('Largura do Degrau') && rotulos.includes('Desnível'));
  assert.ok(!rotulos.some((k) => /parada|cabine|tração/i.test(k)));
  assert.equal(l.find(([k]) => k === 'Desnível')[1], '3390mm');
});

test('esteira usa pallet e desnível/comprimento; textos de quantidade por equipamento', () => {
  const l = O.linhasEspecEscEst({ desnivelComp: '2500', largPallet: '1000mm' }, 'esteira');
  assert.deepEqual(l.map(([k]) => k), ['Desnível / Comprimento', 'Largura do Pallet']);
  assert.equal(O.eqInfo('escada').pluralTxt(16), '16 Escada(s) Rolante(s)');
  assert.equal(O.eqInfo('esteira').pluralTxt(2), '2 Esteira(s) Rolante(s)');
  assert.equal(O.eqInfo('qualquer').nome, 'Elevador de Passageiros');
});

test('resumo, especificidades e instalação só trazem o que foi preenchido', () => {
  assert.deepEqual(O.resumoEscEst([{ id: 'VPER-ER0994-1', empreendimento: 'Shopping', incl: '30º', desnivel: '3390', qtd: 4 }], 'escada'),
    [{ codigo: 'VPER-ER0994-1', empreendimento: 'Shopping', incl: '30º', desnivel: '3390mm', qtd: 4 }]);
  assert.deepEqual(O.linhasEspecificidades({ especificidades: { corrimao: 'Preto', acabamento: 'Inox' } }, 'esteira'), [['Corrimão', 'Preto'], ['Acabamento dos Pallets', 'Inox']]);
  assert.deepEqual(O.blocosInstalacao({ instalacao: { instalacao: 'Por conta da VerticalParts', lubrificacao: ' ' } }), [['Instalação', 'Por conta da VerticalParts']]);
});
