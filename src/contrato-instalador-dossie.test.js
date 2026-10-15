'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./contrato-instalador-dossie.js');
const D = window.CIDossie;
const mask = (d) => (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test('parseEquipamento — elevador de passageiros', () => {
  const r = D.parseEquipamento('Elevador de Passageiros – 600 – 10 – 29,2 – MRL – 1 Porta ', 'elevador');
  assert.equal(r.equipamento, 'elevador'); assert.equal(r.capacidadeCarga, '600'); assert.equal(r.paradas, '10'); assert.equal(r.tipoElevador, 'social');
});
test('parseEquipamento — panorâmico, carga, maca, escada, esteira', () => {
  assert.equal(D.parseEquipamento('Elevador Panorâmico – 600 – 03 – 7,9– MRL', 'elevador').tipoElevador, 'panoramico');
  assert.equal(D.parseEquipamento('Elevador de Carga – 2000 – 08 – 23,5 – MRL', 'elevador').tipoElevador, 'carga');
  assert.equal(D.parseEquipamento('Elevador de Maca/Leito - 1575 - 18 - 61,74 - MR', 'elevador').tipoElevador, 'outros');
  assert.equal(D.parseEquipamento('Escada Rolante - 35º - 1000mm  4000mm', 'escada rolante').equipamento, 'escada');
  assert.equal(D.parseEquipamento('Esteira Rolante  SEQUOIA- 12° - 1000mm - 5600mm', 'esteira rolante').equipamento, 'esteira');
});
test('splitLogradouro extrai o número', () => {
  assert.deepEqual(D.splitLogradouro('Rua das Flores, 123'), { rua: 'Rua das Flores', numero: '123', complemento: '' });
  assert.deepEqual(D.splitLogradouro('Av. Brasil 1.500 - sala 4'), { rua: 'Av. Brasil', numero: '1500', complemento: 'sala 4' });
  assert.equal(D.splitLogradouro('Rua X, s/n').numero, 'S/N');
  assert.deepEqual(D.splitLogradouro('Rua das Palmeiras'), { rua: 'Rua das Palmeiras', numero: '', complemento: '' });
  assert.equal(D.splitLogradouro('Rua 7 de Setembro, 45').numero, '45');
});
test('formaPagamentoDoAcordo — 2/3 automáticos, resto personalizado com centavo na última', () => {
  assert.equal(D.formaPagamentoDoAcordo(2, 18000, mask).formaPagamento, '2');
  const r = D.formaPagamentoDoAcordo(4, 10000.02, mask);
  assert.equal(r.formaPagamento, 'custom'); assert.equal(r.parcelas.length, 4);
  assert.deepEqual(D.dividir(10000.02, 4), [2500, 2500, 2500, 2500.02]);
});
test('montarPatch herda Dossiê + acordo', () => {
  const p = D.montarPatch({
    dossie: { id: 'DOS-M013', building_name: 'Elevador de Passageiros – 600 – 10 – 29,2 – MRL – 1 Porta ', equip_type: 'elevador', city: 'São Paulo', state: 'SP', client_name: 'PRIVILEGIO SPE', cliente_id: 'c1' },
    acordo: { id: 'ACO-1', valor_combinado: 18000, parcelas_qtd: 3 }, mask });
  assert.equal(p.valorTotal, '18.000,00'); assert.equal(p.formaPagamento, '3'); assert.deepEqual(p.dossierIds, ['DOS-M013']);
  assert.equal(p.paradas, '10'); assert.equal(p.capacidadeCarga, '600'); assert.equal(p.clienteObraNome, 'PRIVILEGIO SPE'); assert.equal(p.obraEstado, 'SP');
});
