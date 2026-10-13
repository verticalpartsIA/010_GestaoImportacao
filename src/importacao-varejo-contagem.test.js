'use strict';
// Testa a contagem física na Importação Varejo (src/importacao-varejo-store.js › aplicarContagem):
// contagem recente manda na sugestão; vencida/ausente cai no Omie; acuracidade compara com o saldo do DIA da contagem.
// Chamado por: scripts/run-tests.js (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'importacao-varejo-store.js'), 'utf8');
const win = { __VP_SB: {}, __VP_USER: {} };
vm.runInNewContext(SRC, { window: win, console });
const S = win.ImportacaoVarejoStore;

const HOJE = new Date(2026, 9, 12); // 12/10/2026
const base = () => ({
  codigo: 'VPER-1', curva: 'B', estoqueFisico: 0, estoqueReservado: 2, estoqueDisponivel: 0, estoqueMinimo: 10, pendenteOmie: 0, comprado: 0,
  multiploCompra: null, loteMinimo: null, sugestaoBruta: 10, sugestaoCompra: 10, conselho: null,
});

test('sem contagem: vale o Omie e fica "não conferido"', () => {
  const r = S.aplicarContagem(base(), null, HOJE);
  assert.equal(r.baseEstoque, 'omie');
  assert.equal(r.sugestaoCompra, 10);
  assert.equal(r.acuracia, null);
});

test('contagem recente manda: físico contado − reservado do Omie', () => {
  const r = S.aplicarContagem(base(), { quantidade: 30, saldo_sistemico: 0, contado_em: '2026-10-01', contado_por: 'TIAGO' }, HOJE);
  assert.equal(r.baseEstoque, 'contado');
  assert.equal(r.estoqueDisponivel, 28);
  assert.equal(r.sugestaoCompra, 0);              // mínimo 10 < 28: não compra, mesmo com o Omie dizendo 0
  assert.equal(r.acuracia.ok, false);
  assert.equal(r.acuracia.diferenca, 30);
});

test('contagem com mais de 30 dias não vale: volta ao Omie, mas a acuracidade do dia continua', () => {
  const r = S.aplicarContagem(base(), { quantidade: 30, saldo_sistemico: 30, contado_em: '2026-05-28' }, HOJE);
  assert.equal(r.baseEstoque, 'omie');
  assert.equal(r.contagem.vencida, true);
  assert.equal(r.sugestaoCompra, 10);
  assert.equal(r.acuracia.ok, true);
});

test('reaplicar não acumula: parte sempre do disponível do Omie', () => {
  const um = S.aplicarContagem(base(), { quantidade: 30, saldo_sistemico: 30, contado_em: '2026-10-10' }, HOJE);
  const dois = S.aplicarContagem(um, null, HOJE);
  assert.equal(dois.estoqueDisponivel, 0);
  assert.equal(dois.sugestaoCompra, 10);
});

test('lote/múltiplo continua valendo na sugestão recalculada', () => {
  const it = Object.assign(base(), { multiploCompra: 8 });
  const r = S.aplicarContagem(it, { quantidade: 4, saldo_sistemico: 4, contado_em: '2026-10-12' }, HOJE);
  // disponível = 4 − 2 = 2; necessidade 8 → múltiplo de 8 = 8
  assert.equal(r.sugestaoCompra, 8);
});

test('Curva D com físico contado gera o conselho; zerado não', () => {
  const d = Object.assign(base(), { curva: 'D' });
  assert.ok(S.aplicarContagem(d, { quantidade: 5, saldo_sistemico: 5, contado_em: '2026-10-12' }, HOJE).conselho);
  assert.equal(S.aplicarContagem(d, { quantidade: 2, saldo_sistemico: 2, contado_em: '2026-10-12' }, HOJE).conselho, null); // 2 − 2 reservado = 0
});

const comSug = (min, max, extra) => Object.assign(base(), { estoqueMinimo: 0, sugestaoEstoque: { minimo_sugerido: min, maximo_sugerido: max, confianca: 'media', tendencia: 'alta', serie_12m: [1, 2], serie_inicio: '2025-10-01' } }, extra || {});

test('regra "até o máximo": posição no mínimo sugerido → compra até o máximo', () => {
  const r = S.aplicarContagem(comSug(20, 50, { estoqueDisponivel: 10, pendenteOmie: 0, comprado: 0 }), null, HOJE);
  assert.equal(r.abaixoMinSug, true);
  assert.equal(r.sugestaoCompra, 40);   // 50 − 10
});

test('regra "até o máximo": posição acima do mínimo sugerido → não compra, mesmo abaixo do máximo', () => {
  const r = S.aplicarContagem(comSug(20, 50, { estoqueDisponivel: 30 }), null, HOJE);
  assert.equal(r.abaixoMinSug, false);
  assert.equal(r.sugestaoCompra, 0);
});

test('regra "até o máximo": pendente e comprado entram na posição', () => {
  const r = S.aplicarContagem(comSug(20, 50, { estoqueDisponivel: 5, pendenteOmie: 10, comprado: 10 }), null, HOJE);
  assert.equal(r.posicaoEstoque, 25);
  assert.equal(r.sugestaoCompra, 0);    // 25 > 20: já tem a caminho
});

test('regra "até o máximo": máximo zero (sem venda) nunca sugere compra; lote arredonda', () => {
  assert.equal(S.aplicarContagem(comSug(0, 0, { estoqueDisponivel: 0 }), null, HOJE).sugestaoCompra, 0);
  const r = S.aplicarContagem(comSug(20, 50, { estoqueDisponivel: 10, multiploCompra: 25 }), null, HOJE);
  assert.equal(r.sugestaoCompra, 50);   // 40 → múltiplo de 25 = 50
});

test('regra "até o máximo" usa o físico contado quando a contagem é recente', () => {
  const r = S.aplicarContagem(comSug(20, 50, { estoqueDisponivel: 0 }), { quantidade: 30, saldo_sistemico: 0, contado_em: '2026-10-10' }, HOJE);
  assert.equal(r.posicaoEstoque, 28);   // 30 − 2 reservados
  assert.equal(r.sugestaoCompra, 0);
  assert.equal(r.estTendencia, 'alta');
});

test('linha só com endereço não é contagem', () => {
  const r = S.aplicarContagem(base(), { quantidade: null, endereco: 'G13' }, HOJE);
  assert.equal(r.baseEstoque, 'omie');
  assert.equal(r.endereco, 'G13');
  assert.equal(r.acuracia, null);
});

// ---- revisão do comprador (venda esporádica não compra sozinha) ----
const esporadico = (extra) => comSug(20, 50, Object.assign({ estoqueDisponivel: 10 }, extra || {}));
function comConfianca(item, conf, rev) { item.sugestaoEstoque.confianca = conf; item.revisao = rev || null; return item; }

test('confiança baixa sem revisão: não compra e entra na fila de revisão', () => {
  const r = S.aplicarContagem(comConfianca(esporadico(), 'baixa'), null, HOJE);
  assert.equal(r.precisaRevisao, true);
  assert.equal(r.sugestaoCompra, 0);
  assert.equal(r.sugestaoSeAprovada, 40);
});

test('revisão aprovada libera a compra pela sugestão', () => {
  const r = S.aplicarContagem(comConfianca(esporadico(), 'baixa', { status: 'aprovado' }), null, HOJE);
  assert.equal(r.precisaRevisao, false);
  assert.equal(r.sugestaoCompra, 40);
});

test('ajuste manual troca mínimo e máximo', () => {
  const r = S.aplicarContagem(comConfianca(esporadico(), 'baixa', { status: 'ajustado', minimo_manual: 5, maximo_manual: 12 }), null, HOJE);
  assert.equal(r.estMinSug, 5);
  assert.equal(r.estMaxSug, 12);
  assert.equal(r.estOrigem, 'manual');
  assert.equal(r.sugestaoCompra, 0);        // posição 10 > mínimo manual 5
  const r2 = S.aplicarContagem(comConfianca(esporadico({ estoqueDisponivel: 4 }), 'baixa', { status: 'ajustado', minimo_manual: 5, maximo_manual: 12 }), null, HOJE);
  assert.equal(r2.sugestaoCompra, 8);       // 12 − 4
  assert.equal(r2.estMaxSugCalc, 50);       // o cálculo do sistema continua visível
});

test('"não repor" zera mínimo e máximo; confiança média/alta não precisa de revisão', () => {
  const d = S.aplicarContagem(comConfianca(esporadico(), 'baixa', { status: 'descartado' }), null, HOJE);
  assert.equal(d.estMaxSug, 0);
  assert.equal(d.sugestaoCompra, 0);
  const m = S.aplicarContagem(comConfianca(esporadico(), 'media'), null, HOJE);
  assert.equal(m.precisaRevisao, false);
  assert.equal(m.sugestaoCompra, 40);
});

test('Dia D: cobertura da posição menos (chegada + 50 d para criar e decidir o pedido)', () => {
  // demanda 30/mês = 1/dia; posição 200 → cobertura 200 d; prazo total 90 + 50 = 140 → Dia D em 60 dias
  const it = comSug(20, 50, { estoqueDisponivel: 200, pendenteOmie: 0, comprado: 0 });
  it.sugestaoEstoque = Object.assign({}, it.sugestaoEstoque, { demanda_mensal: 30, prazo_dias: 90, atraso_dias: 50, meses_ruptura: 2, ruptura_12m: [0, 1] });
  const r = S.aplicarContagem(it, null, HOJE);
  assert.equal(r.estCoberturaDias, 200);
  assert.equal(r.estLeadTotalDias, 140);
  assert.equal(r.estDiaDDias, 60);
  assert.equal(r.estDiaDStatus, 'ok');
  it.estoqueDisponivel = 150;   // cobertura 150 → Dia D em 10 dias → acordar o comprador
  assert.equal(S.aplicarContagem(it, null, HOJE).estDiaDStatus, 'acordar');
  it.estoqueDisponivel = 100;   // já passou
  assert.equal(S.aplicarContagem(it, null, HOJE).estDiaDStatus, 'atrasado');
  assert.equal(r.estMesesRuptura, 2);
});
