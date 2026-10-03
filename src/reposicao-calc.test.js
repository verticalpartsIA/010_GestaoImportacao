'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./reposicao-calc.js');
const R = window.PcpReposicao;

const cfg = { prazo_importado_dias: 90, prazo_nacional_dias: 15, folga_dias: 30, ciclo_dias: 60, origens_excluidas: 'COM,IMP,CIM,RRE,CTR,OPE', janela_desde: '2024-01-01' };
const hoje = '2026-10-03';
// 6 meses completos (abr–set/2026) com 10 un/mês de venda = consumoDia 1/3
const movs = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map(m => ({ dt_mov: m + '-15', qtde: -10, cod_origem: 'VEN' }));

test('só "n" minúsculo é nacional', () => {
  assert.equal(R.ehNacional('VP-1234n'), true);
  assert.equal(R.ehNacional('VP-1234N'), false);
  assert.equal(R.ehNacional('VPMP-586'), false);
});

test('limites: crítico 30, ponto de pedido 40, máximo 60 (10/mês, 90+30+60 dias)', () => {
  const r = R.calcularItem({ codigo: 'VPMP-1', movs, hoje, cfg, disponivel: 100, pendente: 0 });
  assert.equal(Math.round(r.mediaMensal), 10);
  assert.equal(Math.round(r.critico), 30);
  assert.equal(Math.round(r.pedido), 40);
  assert.equal(Math.round(r.maximo), 60);
  assert.equal(r.status, 'excesso');
});

test('status por posição (disponível + a caminho)', () => {
  const s = (disp, pend = 0) => R.calcularItem({ codigo: 'VPMP-1', movs, hoje, cfg, disponivel: disp, pendente: pend });
  assert.equal(s(25).status, 'critico');
  assert.equal(s(25).sugestao, 35);          // máximo 60 − 25
  assert.equal(s(35).status, 'comprar');
  assert.equal(s(40).status, 'comprar');
  assert.equal(s(41).status, 'ok');
  assert.equal(s(41).sugestao, 0);
  assert.equal(s(61).status, 'excesso');
  assert.equal(s(10, 30).status, 'comprar'); // 10 em mãos + 30 a caminho = posição 40
});

test('nacional usa prazo menor', () => {
  const r = R.calcularItem({ codigo: 'VP-9n', movs, hoje, cfg, disponivel: 100, pendente: 0 });
  assert.equal(r.prazo, 15);
  assert.equal(Math.round(r.critico), 5);
  assert.equal(Math.round(r.maximo), 35);
});

test('mês em curso não entra na média e item novo não é diluído', () => {
  const novo = [{ dt_mov: '2026-08-10', qtde: -30, cod_origem: 'VEN' }, { dt_mov: '2026-10-01', qtde: -999, cod_origem: 'VEN' }];
  const r = R.calcularItem({ codigo: 'VPMP-2', movs: novo, hoje, cfg, disponivel: 0, pendente: 0 });
  assert.equal(r.meses, 2);                  // ago e set (outubro está em curso)
  assert.equal(r.mediaMensal, 15);           // 30 ÷ 2 meses, não ÷ 33
  assert.equal(r.historicoCurto, true);
});

test('compra/importação não contam; devolução abate; ajuste manual para cima é ignorado', () => {
  const m = [
    { dt_mov: '2026-09-02', qtde: -100, cod_origem: 'VEN' },
    { dt_mov: '2026-09-05', qtde: 20, cod_origem: 'DVP' },    // devolução reverte parte da venda
    { dt_mov: '2026-09-06', qtde: 500, cod_origem: 'COM' },   // compra: não é consumo
    { dt_mov: '2026-09-07', qtde: 50, cod_origem: 'AJU' },    // contagem para cima: ignorada
    { dt_mov: '2026-09-08', qtde: -10, cod_origem: 'AJU' },   // saída manual: conta
  ];
  const r = R.calcularItem({ codigo: 'VPMP-3', movs: m, hoje, cfg, disponivel: 0, pendente: 0 });
  assert.equal(r.meses, 1);
  assert.equal(r.mediaMensal, 90);           // 100 − 20 + 10
});

test('sem consumo = sem giro, sem sugestão; sem movimento = sem histórico', () => {
  const so = [{ dt_mov: '2026-05-01', qtde: 40, cod_origem: 'COM' }];
  const r = R.calcularItem({ codigo: 'VPMP-4', movs: so, hoje, cfg, disponivel: 0, pendente: 0 });
  assert.equal(r.status, 'sem_giro');
  assert.equal(r.sugestao, 0);
  assert.equal(R.calcularItem({ codigo: 'VPMP-5', movs: [], hoje, cfg, disponivel: 0, pendente: 0 }).status, 'sem_historico');
});

test('tendência compara os últimos 6 meses com a média do histórico', () => {
  const alta = [];
  for (let i = 1; i <= 6; i++) alta.push({ dt_mov: `2025-${String(i).padStart(2, '0')}-10`, qtde: -10, cod_origem: 'VEN' });
  for (let i = 4; i <= 9; i++) alta.push({ dt_mov: `2026-${String(i).padStart(2, '0')}-10`, qtde: -40, cod_origem: 'VEN' });
  const r = R.calcularItem({ codigo: 'VPMP-6', movs: alta, hoje, cfg, disponivel: 0, pendente: 0 });
  assert.equal(r.tendencia, 'alta');
});
