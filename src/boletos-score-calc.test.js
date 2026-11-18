'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./boletos-score-calc.js');
const S = window.BoletosScoreCalc;

const cli = (o) => ({ pagos_em_dia: 0, pagos_atrasados: 0, abertos_vencidos: 0, atraso_medio_dias: 0, maior_atraso_dias: 0, aberto_vencido_dias_max: 0, ...o });

// ---- classes ----
test('menos de 3 títulos vencidos = sem histórico suficiente, sem nota', () => {
  const r = S.classificar(cli({ pagos_em_dia: 2 }));
  assert.equal(r.classe, 'N');
  assert.match(r.conselho, /score externo/i);
});
test('A: 90% em dia, maior atraso até 15 dias e nada vencido em aberto', () => {
  const r = S.classificar(cli({ pagos_em_dia: 9, pagos_atrasados: 1, atraso_medio_dias: 5, maior_atraso_dias: 15 }));
  assert.equal(r.classe, 'A');
  assert.equal(r.pontualidade, 90);
});
test('A cai para B se houver título vencido em aberto, mesmo com boa pontualidade', () => {
  const r = S.classificar(cli({ pagos_em_dia: 19, abertos_vencidos: 1, aberto_vencido_dias_max: 5 }));
  assert.equal(r.classe, 'B');
});
test('B: 75% em dia e atraso médio até 10 dias', () => {
  const r = S.classificar(cli({ pagos_em_dia: 8, pagos_atrasados: 2, atraso_medio_dias: 10, maior_atraso_dias: 20 }));
  assert.equal(r.classe, 'B');
});
test('C: pontualidade entre 50% e 75%', () => {
  const r = S.classificar(cli({ pagos_em_dia: 6, pagos_atrasados: 4, atraso_medio_dias: 8, maior_atraso_dias: 12 }));
  assert.equal(r.classe, 'C');
  assert.ok(r.motivos.some((m) => /pontualidade/.test(m)));
});
test('C: bom em dia mas já atrasou mais de 30 dias', () => {
  const r = S.classificar(cli({ pagos_em_dia: 9, pagos_atrasados: 1, atraso_medio_dias: 40, maior_atraso_dias: 40 }));
  assert.equal(r.classe, 'C');
  assert.ok(r.motivos.some((m) => /40 dias/.test(m)));
});
test('D: pontualidade abaixo de 50%', () => {
  const r = S.classificar(cli({ pagos_em_dia: 2, pagos_atrasados: 8, atraso_medio_dias: 20, maior_atraso_dias: 45 }));
  assert.equal(r.classe, 'D');
  assert.match(r.conselho, /Juliana/);
});
test('D: título vencido em aberto há mais de 30 dias, mesmo com boa pontualidade', () => {
  const r = S.classificar(cli({ pagos_em_dia: 19, abertos_vencidos: 1, aberto_vencido_dias_max: 31 }));
  assert.equal(r.classe, 'D');
});
test('limites são inclusivos: 50% exato não é D; 30 dias exatos em aberto não é D', () => {
  assert.equal(S.classificar(cli({ pagos_em_dia: 5, pagos_atrasados: 5, atraso_medio_dias: 3, maior_atraso_dias: 5 })).classe, 'C');
  assert.equal(S.classificar(cli({ pagos_em_dia: 19, abertos_vencidos: 1, aberto_vencido_dias_max: 30 })).classe, 'B');
});
test('configuração do banco vence o padrão; valor vazio ou lixo cai no padrão', () => {
  const c = S.mesclarConfig({ pontualidade_a: '95', minimo_titulos: null, atraso_max_a: 'abc' });
  assert.equal(c.pontualidade_a, 95);
  assert.equal(c.minimo_titulos, 3);
  assert.equal(c.atraso_max_a, 15);
  // com limite A em 95, 90% deixa de ser A
  assert.equal(S.classificar(cli({ pagos_em_dia: 9, pagos_atrasados: 1, atraso_medio_dias: 2, maior_atraso_dias: 2 }), { pontualidade_a: 95 }).classe, 'B');
});

// ---- períodos ----
test('passado: últimos 30 dias termina ontem; hoje nunca entra', () => {
  assert.deepEqual(S.periodo('passado', '30d', '2026-11-17'), { modo: 'passado', preset: '30d', de: '2026-10-18', ate: '2026-11-16' });
});
test('passado: mês passado vai do dia 1 ao último dia, inclusive na virada do ano', () => {
  assert.deepEqual(S.periodo('passado', 'mes', '2026-11-17'), { modo: 'passado', preset: 'mes', de: '2026-10-01', ate: '2026-10-31' });
  const j = S.periodo('passado', 'mes', '2026-01-10');
  assert.equal(j.de, '2025-12-01'); assert.equal(j.ate, '2025-12-31');
});
test('passado: ano até ontem; em 1º de janeiro o período não fica ao contrário', () => {
  assert.deepEqual(S.periodo('passado', 'ano', '2026-11-17'), { modo: 'passado', preset: 'ano', de: '2026-01-01', ate: '2026-11-16' });
  assert.deepEqual(S.periodo('passado', 'ano', '2026-01-01'), { modo: 'passado', preset: 'ano', de: '2025-01-01', ate: '2025-12-31' });
});
test('presente: do dia 1 do mês até hoje', () => {
  assert.deepEqual(S.periodo('presente', 'mes', '2026-11-17'), { modo: 'presente', preset: 'mes', de: '2026-11-01', ate: '2026-11-17' });
});
test('futuro: começa amanhã; "até o fim do mês" no último dia do mês não inverte o período', () => {
  assert.deepEqual(S.periodo('futuro', '30d', '2026-11-17'), { modo: 'futuro', preset: '30d', de: '2026-11-18', ate: '2026-12-17' });
  assert.deepEqual(S.periodo('futuro', 'mes', '2026-11-17'), { modo: 'futuro', preset: 'mes', de: '2026-11-18', ate: '2026-11-30' });
  const f = S.periodo('futuro', 'mes', '2026-11-30');
  assert.ok(f.de <= f.ate);
});
test('preset desconhecido cai no padrão do modo', () => {
  assert.equal(S.periodo('passado', 'xyz', '2026-11-17').preset, '30d');
  assert.equal(S.periodo('futuro', 'xyz', '2026-11-17').preset, '30d');
});

// ---- índice ----
test('índice = vencido em aberto ÷ vencido no período, com 1 casa decimal', () => {
  const i = S.indice({ vencido_valor: 3000, vencido_aberto_valor: 500, pago_em_dia_valor: 2000, pago_atrasado_valor: 500, titulos: 12, clientes: 5 });
  assert.equal(i.pct, 16.7);
  assert.equal(i.pagoEmDia, 2000);
});
test('sem nada vencido não há índice (null), não zero', () => {
  assert.equal(S.indice({ vencido_valor: 0, vencido_aberto_valor: 0, a_vencer_valor: 900 }).pct, null);
  assert.equal(S.indice(null).pct, null);
});

// ---- calendário livre de início e fim (18/11/2026) ----
test('intervalo: datas válidas passam; início depois do fim e data vazia ou inexistente dão erro', () => {
  assert.equal(S.intervalo('2026-01-01', '2026-11-17').erro, null);
  assert.equal(S.intervalo('2026-11-17', '2026-11-17').erro, null, 'um dia só vale');
  assert.match(S.intervalo('2026-11-18', '2026-11-17').erro, /depois/);
  assert.match(S.intervalo('', '2026-11-17').erro, /Escolha/);
  assert.match(S.intervalo('2026-02-30', '2026-03-10').erro, /Escolha/, '30/02 não existe');
  assert.equal(S.dataValida('2028-02-29'), true);
  assert.equal(S.dataValida('2027-02-29'), false);
});
test('atalhos preenchem início e fim sem inverter, inclusive em 1º de janeiro', () => {
  for (const hoje of ['2026-11-17', '2026-01-01', '2026-12-31', '2026-03-01']) {
    for (const a of S.atalhos(hoje)) assert.equal(S.intervalo(a.de, a.ate).erro, null, a.id + ' em ' + hoje);
  }
  const a = Object.fromEntries(S.atalhos('2026-11-17').map((x) => [x.id, x]));
  assert.deepEqual([a['30d'].de, a['30d'].ate], ['2026-10-18', '2026-11-16']);
  assert.deepEqual([a.prox30.de, a.prox30.ate], ['2026-11-18', '2026-12-17']);
  assert.deepEqual([a.mes_atual.de, a.mes_atual.ate], ['2026-11-01', '2026-11-17']);
});
