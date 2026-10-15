'use strict';
/* Escada/Esteira: a herança traduz o texto livre do Formulário para as opções dos selects da proposta. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-heranca.js');
const { montarBlocoEscadaEsteira } = window.PropostaHeranca;

const fontes = (unidades) => ({ encontrado: true, unidades });
const esc = (id, qtd, e) => ({ id: 'U' + id, identificador: 'VPER-ER0994-' + id, quantidade: qtd, tipo_equipamento: 'escada', especificacoes: e });

test('escada: normaliza o texto do Formulário e mantém 1 linha por unidade', () => {
  const r = montarBlocoEscadaEsteira(fontes([
    esc(1, 4, { tipo_edificacao: 'Shopping ', uso_previsto: 'Medio trafego ', desnivel_elevacao: '3390mm', inclinacao: '30', largura_degrau: '1000mm', balaustrada: 'Vidro - 900mm', velocidade_nominal: '0.50', tensao_alimentacao_equip: '380v', disposicao_espaco: 'Paralelas' }),
    esc(3, 4, { desnivel_elevacao: '6450mm' }),
    { id: 'E', identificador: 'X', quantidade: 9, tipo_equipamento: 'elevador' },
  ]), 'escada');
  assert.equal(r.especificacoes.length, 2);
  const a = r.especificacoes[0];
  assert.deepEqual([a.id, a.qtd, a.empreendimento, a.carac, a.desnivel, a.incl, a.largDegrau, a.balaustrada, a.vel, a.alimentacao, a.arranjo],
    ['VPER-ER0994-1', 4, 'Shopping', 'Comercial', '3390', '30º', '1000mm', '900mm', '0.5 m/s', '380V Trifásico', 'Paralelo']);
  assert.equal(r.especificacoes[1].balaustrada, '');
  assert.equal(r.valores.quantidade, '8');
});

test('esteira usa desnível/comprimento e largura do palete; sem unidade do tipo = null', () => {
  const r = montarBlocoEscadaEsteira(fontes([{ id: 'U', identificador: 'VPES-1', quantidade: 1, tipo_equipamento: 'esteira', especificacoes: { desnivel_vertical: '2.500', largura_palete: '1000mm', tensao_alimentacao_equip: '220V' } }]), 'esteira');
  assert.equal(r.especificacoes[0].desnivelComp, '2500');
  assert.equal(r.especificacoes[0].largPallet, '1000mm');
  assert.equal(r.especificacoes[0].alimentacao, 'Trifásico 220V');
  assert.equal(montarBlocoEscadaEsteira(fontes([]), 'escada'), null);
});
