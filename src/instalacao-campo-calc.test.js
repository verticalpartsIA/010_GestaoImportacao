'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./mapa-obras-calc.js');
require('./master-id-engine.js');
require('./instalacao-campo-calc.js');
const C = window.InstalacaoCampoCalc;

test('numeroLegado: extrai o sufixo de "DOS-M0NN"; fallback estável para id fora do padrão', () => {
  assert.equal(C.numeroLegado('DOS-M047'), 47);
  assert.equal(C.numeroLegado('DOS-M001'), 1);
  assert.equal(C.numeroLegado('DOS-721977'), C.numeroLegado('DOS-721977')); // determinístico
  assert.ok(C.numeroLegado('DOS-MUOH92OS') >= 1000 && C.numeroLegado('DOS-MUOH92OS') < 10000);
});

test('codigoObraLegada: VPNI-OB + 4 dígitos', () => {
  assert.equal(C.codigoObraLegada('DOS-M047'), 'VPNI-OB0047');
  assert.equal(C.codigoObraLegada('DOS-M001'), 'VPNI-OB0001');
});

test('codigoPaiGrupo: cotação nativa vence e usa o mesmo VPNI do Contrato do Instalador', () => {
  const g = C.codigoPaiGrupo([{ id: 'DOS-721977', numero_cotacao: 955 }]);
  assert.equal(g.codigo, 'VPNI-0955');
  assert.equal(g.nativo, true);
  assert.equal(g.numeroCotacao, 955);
});

test('codigoPaiGrupo: sem cotação usa o menor Nº legado do grupo (não renumera com dossiê novo)', () => {
  const g = C.codigoPaiGrupo([
    { id: 'DOS-M024', numero_cotacao: null },
    { id: 'DOS-M017', numero_cotacao: null },
    { id: 'DOS-M025', numero_cotacao: null },
  ]);
  assert.equal(g.codigo, 'VPNI-OB0017');
  assert.equal(g.nativo, false);
  assert.equal(g.numeroCotacao, null);
});

test('agruparPorCliente: só Montando/Prestes a iniciar entram; concluída e análise técnica ficam fora', () => {
  const dossies = [
    { id: 'DOS-M001', client_name: 'Cliente A', building_name: 'Obra A', status_master: 'Instalação', city: 'São Paulo', state: 'SP' },
    { id: 'DOS-M002', client_name: 'Cliente B', building_name: 'Obra B', status_master: 'Entregue', city: 'SP', state: 'SP' },
    { id: 'DOS-M003', client_name: 'Cliente C', building_name: 'Obra C', status_master: 'Análise técnica', city: 'SP', state: 'SP' },
  ];
  const grupos = C.agruparPorCliente(dossies, [], []);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].cliente, 'Cliente A');
  assert.equal(grupos[0].situacao, 'andamento');
});

test('agruparPorCliente: um cliente com 2 obras/dossiês vira 1 grupo com os equipamentos das duas', () => {
  const dossies = [
    { id: 'DOS-M017', client_name: 'Hospital X', building_name: 'Elevador 1', status_master: 'Homologação instalador', parceiro_instalador_id: 'P1' },
    { id: 'DOS-M018', client_name: 'Hospital X', building_name: 'Elevador 2', status_master: 'Homologação instalador', parceiro_instalador_id: null },
  ];
  const equipamentos = [
    { dossier_id: 'DOS-M017', numero_serie: '500.0346', descricao: 'Elevador de Passageiros - 1125' },
    { dossier_id: 'DOS-M018', numero_serie: '500.0347', descricao: 'Elevador de Passageiros - 1125 (2)' },
  ];
  const instaladores = [{ id: 'P1', nome: 'DHS ELEVADORES LTDA' }];
  const grupos = C.agruparPorCliente(dossies, equipamentos, instaladores);
  assert.equal(grupos.length, 1);
  const g = grupos[0];
  assert.equal(g.cliente, 'Hospital X');
  assert.equal(g.situacao, 'aguardando');
  assert.equal(g.codigoPai, 'VPNI-OB0017');
  assert.equal(g.nDossies, 2);
  assert.equal(g.equipamentos.length, 2);
  assert.deepEqual(g.equipamentos.map((e) => e.codigo), ['500.0346', '500.0347']);
  assert.deepEqual(g.instaladores, ['DHS ELEVADORES LTDA']);
});

test('agruparPorCliente: junta o instalador legado (parceiro_instalador_id) com os do elenco (dossier_obra_instaladores) — achado real do Codex, DOS-M022', () => {
  const dossies = [
    { id: 'DOS-M022', client_name: 'Hospital X', building_name: 'Elevador', status_master: 'Homologação instalador', parceiro_instalador_id: 'LEGADO' },
  ];
  const instaladores = [
    { id: 'LEGADO', nome: 'DHS ELEVADORES LTDA' },
    { id: 'EXTRA1', nome: '60.555.952 GABRIEL SCHURT' },
    { id: 'EXTRA2', nome: '60.536.286 SILVIO SCHURT' },
  ];
  const elenco = [
    { dossier_id: 'DOS-M022', parceiro_instalador_id: 'EXTRA1' },
    { dossier_id: 'DOS-M022', parceiro_instalador_id: 'EXTRA2' },
  ];
  const grupos = C.agruparPorCliente(dossies, [], instaladores, elenco);
  assert.deepEqual(grupos[0].instaladores.slice().sort(), [
    '60.536.286 SILVIO SCHURT',
    '60.555.952 GABRIEL SCHURT',
    'DHS ELEVADORES LTDA',
  ]);
});

test('agruparPorCliente: dossiê com cotação usa o VPNI nativo, mesmo misturado com legados de outro cliente', () => {
  const dossies = [
    { id: 'DOS-721977', client_name: 'AKAI', building_name: 'Praia Grande', status_master: 'Contrato assinado', numero_cotacao: 955 },
    { id: 'DOS-M047', client_name: 'Outro Cliente', building_name: 'Obra', status_master: 'Homologação instalador' },
  ];
  const grupos = C.agruparPorCliente(dossies, [], []);
  const akai = grupos.find((g) => g.cliente === 'AKAI');
  assert.equal(akai.codigoPai, 'VPNI-0955');
  assert.equal(akai.nativo, true);
  const outro = grupos.find((g) => g.cliente === 'Outro Cliente');
  assert.equal(outro.codigoPai, 'VPNI-OB0047');
  assert.equal(outro.nativo, false);
});

test('agruparPorCliente: dossiê sem equipamento cadastrado cai num item com descrição da obra e código nulo', () => {
  const dossies = [{ id: 'DOS-M005', client_name: 'Cliente Sem Equip', building_name: 'Elevador de Carga - 3300', status_master: 'Contrato assinado' }];
  const grupos = C.agruparPorCliente(dossies, [], []);
  assert.equal(grupos[0].equipamentos.length, 1);
  assert.equal(grupos[0].equipamentos[0].codigo, null);
  assert.equal(grupos[0].equipamentos[0].descricao, 'Elevador de Carga - 3300');
});

test('agruparPorCliente: ordena Montando antes de Prestes a iniciar, depois por nome', () => {
  const dossies = [
    { id: 'DOS-M010', client_name: 'Zebra Prestes', building_name: 'Z', status_master: 'Contrato assinado' },
    { id: 'DOS-M011', client_name: 'Alfa Montando', building_name: 'A', status_master: 'Instalação' },
    { id: 'DOS-M012', client_name: 'Beta Montando', building_name: 'B', status_master: 'Instalação' },
  ];
  const grupos = C.agruparPorCliente(dossies, [], []);
  assert.deepEqual(grupos.map((g) => g.cliente), ['Alfa Montando', 'Beta Montando', 'Zebra Prestes']);
});
