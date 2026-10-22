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

test('extrairNumeros aceita vírgula, "e", linhas e ignora repetição', () => {
  assert.deepEqual(D.extrairNumeros('DOS-M013, DOS-M014'), ['DOS-M013', 'DOS-M014']);
  assert.deepEqual(D.extrairNumeros('dos-m013 e dos-m014\nDOS-M013'), ['DOS-M013', 'DOS-M014']);
  assert.deepEqual(D.extrairNumeros(''), []);
});
const doss = (id, extra) => Object.assign({ id, building_name: 'Elevador de Passageiros – 600 – 10 – 29,2 – MRL – 1 Porta ', equip_type: 'elevador', city: 'São Paulo', state: 'SP', client_name: 'PRIVILEGIO SPE', cliente_id: 'c1', parceiro_instalador_id: null, endereco_logradouro: 'R. Padre João', endereco_numero: '418', endereco_bairro: 'Penha', endereco_cep: '03637-000' }, extra || {});
test('montarPatchVarios: 2 Dossiês, mesma empresa — soma valor, 2 equipamentos, 1 contrato', () => {
  const r = D.montarPatchVarios({ dossies: [doss('DOS-M013'), doss('DOS-M014')],
    acordos: { 'DOS-M013': { id: 'A1', parceiro_instalador_id: 'MNT-1', valor_combinado: 18000, parcelas_qtd: 3 }, 'DOS-M014': { id: 'A2', parceiro_instalador_id: 'MNT-1', valor_combinado: 17500.5, parcelas_qtd: 3 } }, mask });
  assert.equal(r.erro, null); assert.deepEqual(r.patch.dossierIds, ['DOS-M013', 'DOS-M014']); assert.deepEqual(r.patch.equipamentosManuais, ['DOS-M013', 'DOS-M014']);
  assert.equal(r.patch.quantidade, 2); assert.equal(r.patch.valorTotal, '35.500,50'); assert.equal(r.patch.formaPagamento, '3'); assert.equal(r.avisos.length, 0);
});
test('montarPatchVarios: empresas diferentes bloqueia', () => {
  const r = D.montarPatchVarios({ dossies: [doss('DOS-M013'), doss('DOS-M014')],
    acordos: { 'DOS-M013': { id: 'A1', parceiro_instalador_id: 'MNT-1', valor_combinado: 1, parcelas_qtd: 2 }, 'DOS-M014': { id: 'A2', parceiro_instalador_id: 'MNT-2', valor_combinado: 1, parcelas_qtd: 2 } }, mask });
  assert.ok(r.erro);
});
test('montarPatchVarios: sem acordo em um dos Dossiês não preenche o valor e avisa; equipamentos diferentes avisam', () => {
  const r = D.montarPatchVarios({ dossies: [doss('DOS-M013'), doss('DOS-M014', { building_name: 'Elevador de Carga – 2000 – 08 – 23,5 – MRL' })],
    acordos: { 'DOS-M013': { id: 'A1', parceiro_instalador_id: 'MNT-1', valor_combinado: 18000, parcelas_qtd: 2 } }, mask });
  assert.equal(r.erro, null); assert.equal(r.patch.valorTotal, undefined); assert.equal(r.avisos.length, 2);
});

test('Local do serviço = endereço da obra, nunca a descrição do equipamento (22/10/2026)', () => {
  const d = doss('DOS-M055', { building_name: 'Elevador Panorâmico – 1000 – 2 – 4– MRL – 1 Porta ', client_name: 'LAR E CONSTRUCAO QUASE TUDO LTDA  ', city: 'Paraty', state: 'RJ',
    endereco_logradouro: 'Av. Roberto Silveira', endereco_numero: 's/n', endereco_bairro: 'Parque Ypê', endereco_cep: '23970-000' });
  const p = D.montarPatch({ dossie: d, acordo: null, mask, equipamentos: [{ dossier_id: 'DOS-M055', numero_serie: '500.0395', descricao: 'Elevador Panorâmico – 1000 – 2 – 4– MRL – 1 Porta', tipo: 'elevador' }] });
  assert.equal(p.localServico, 'Obra LAR E CONSTRUCAO QUASE TUDO LTDA — Av. Roberto Silveira, s/n, Parque Ypê, Paraty/RJ - CEP: 23970-000');
  assert.doesNotMatch(p.localServico, /MRL/);
  assert.deepEqual(p.equipamentosDetalhe, [{ dossier: 'DOS-M055', serie: '500.0395', descricao: 'Elevador Panorâmico – 1000 – 2 – 4– MRL – 1 Porta', tipo: 'elevador' }]);
});
test('Sem endereço no Dossiê: não preenche o local e avisa', () => {
  const r = D.montarPatchVarios({ dossies: [doss('DOS-M013', { endereco_logradouro: null })], acordos: {}, mask });
  assert.equal(r.patch.localServico, undefined);
  assert.ok(r.avisos.some((a) => /endereço da obra/.test(a)));
  assert.equal(r.patch.equipamentosDetalhe[0].serie, '');   // sem linha em equipamentos_obra: série em branco, descrição do Dossiê
});
