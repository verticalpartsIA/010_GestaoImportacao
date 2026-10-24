'use strict';
/* Casos reais de 24/10/2026 (varredura dos dados que alimentam a Evolução dos Equipamentos). */
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./evolucao-equipamentos-calc.js');
require('./evolucao-conferir-calc.js');
const K = window.EvolucaoConferirCalc;
const hoje = new Date(2026, 9, 24);

const item = (obra, eq, extra) => ({
  obra: { situacao: 'andamento', status_master: 'Instalação', client_name: 'CLIENTE X', building_name: 'Obra X', city: 'SP', ...obra },
  serie: eq && eq.numero_serie != null ? eq.numero_serie : null,
  eq: eq || null,
  diario: { pct: 10, iniciadoEm: '2026-09-01' },
  ...extra,
});
const codigos = (it, todos) => K.avaliar(todos || [it], { hoje }).get(it).map((x) => x.codigo);

test('500.0373: término real posterior à última edição + fase ainda Instalação', () => {
  const it = item({ id: 'DOS-M036', updated_at: '2026-08-27T10:00:00Z' }, { numero_serie: '500.0373', data_real_inicio: '2026-08-06', data_real_termino: '2026-09-01' });
  const c = codigos(it);
  assert.ok(c.includes('real_apos_edicao'));
  assert.ok(c.includes('fase_nao_avancou'));
});

test('500.0374: término real registrado e fase ainda Instalação', () => {
  const it = item({ id: 'DOS-M037', updated_at: '2026-09-08T10:00:00Z' }, { numero_serie: '500.0374', data_real_inicio: '2026-08-04', data_real_termino: '2026-09-01' });
  const c = codigos(it);
  assert.ok(c.includes('fase_nao_avancou'));
  assert.ok(!c.includes('real_apos_edicao'));
});

test('500.0378: chegada 17/10 digitada antes da edição e destoa das irmãs (17/07) — provável mês errado', () => {
  const mk = (id, serie, rc, upd) => item({ id, client_name: 'VB 2304 GOIABEIRAS', building_name: 'Torre', city: 'Santo André', updated_at: upd }, { numero_serie: serie, chegada_real_material: rc });
  const a = mk('DOS-M040', '500.0377', '2026-07-17', '2026-10-14T10:00:00Z');
  const b = mk('DOS-M041', '500.0378', '2026-10-17', '2026-10-14T10:00:00Z');
  const c = mk('DOS-M042', '500.0379', '2026-07-17', '2026-10-14T10:00:00Z');
  const todos = [a, b, c];
  const r = K.avaliar(todos, { hoje });
  const cods = r.get(b).map((x) => x.codigo);
  assert.ok(cods.includes('real_apos_edicao'));
  assert.ok(cods.includes('chegada_destoa_irmaos'));
  assert.ok(!r.get(a).map((x) => x.codigo).includes('chegada_destoa_irmaos'));
});

test('data real no futuro é erro grave', () => {
  const it = item({ id: 'X', updated_at: '2026-10-20T10:00:00Z' }, { numero_serie: 'S1', data_real_inicio: '2026-11-05' });
  const r = K.avaliar([it], { hoje }).get(it).find((x) => x.codigo === 'real_no_futuro');
  assert.ok(r);
  assert.equal(r.gravidade, 'alta');
  assert.equal(r.quem, 'felipe');
});

test('500.0372: previsão de término vencida e registro parado', () => {
  const it = item({ id: 'DOS-M035', updated_at: '2026-09-02T10:00:00Z' }, { numero_serie: '500.0372', data_real_inicio: '2026-06-08', previsao_termino: '2026-08-31' });
  const r = K.avaliar([it], { hoje }).get(it).find((x) => x.codigo === 'previsao_vencida');
  assert.ok(r);
  assert.match(r.motivo, /término/i);
  assert.match(r.motivo, /54 dias/);
  assert.match(r.motivo, /sem edição há 52 dias/);
  assert.equal(r.gravidade, 'alta');
});

test('previsão vencida em obra já entregue é ignorada', () => {
  const it = item({ id: 'X', situacao: 'concluida', status_master: 'Entregue', updated_at: '2026-09-02T10:00:00Z' }, { numero_serie: 'S2', previsao_termino: '2026-08-31' });
  assert.ok(!codigos(it).includes('previsao_vencida'));
});

test('500.0311: material chegou depois do início previsto — replanejar', () => {
  const it = item({ id: 'DOS-M002', updated_at: '2026-10-22T10:00:00Z' }, { numero_serie: '500.0311', chegada_real_material: '2026-10-14', previsao_inicio: '2026-08-17', previsao_termino: '2026-09-21' }, { diario: { pct: 0, iniciadoEm: null } });
  const c = codigos(it);
  assert.ok(c.includes('previsao_antes_da_chegada'));
  assert.ok(c.includes('previsao_vencida'));
});

test('500.0375: início real 33 dias antes do previsto — previsão desatualizada', () => {
  const it = item({ id: 'DOS-M038', updated_at: '2026-10-19T10:00:00Z' }, { numero_serie: '500.0375', data_real_inicio: '2026-08-28', previsao_inicio: '2026-09-30', previsao_termino: '2026-11-14' });
  assert.ok(codigos(it).includes('previsao_desatualizada'));
});

test('início real antes da chegada real do material é incoerente', () => {
  const it = item({ id: 'X', updated_at: '2026-10-20T10:00:00Z' }, { numero_serie: 'S3', chegada_real_material: '2026-10-10', data_real_inicio: '2026-10-01' });
  assert.ok(codigos(it).includes('ordem_invalida'));
});

test('sem nº de série e escada de remoção "saiu da fábrica"', () => {
  const it = item({ id: 'DOS-M063', building_name: 'Escada Rolante - Remoção', updated_at: '2026-08-20T10:00:00Z' }, null, { diario: { pct: 0, iniciadoEm: null } });
  const c = codigos(it);
  assert.ok(c.includes('sem_serie'));
  assert.ok(c.includes('remocao_sem_fabrica'));
});

test('obra em Instalação que nunca lançou Diário vai para o montador', () => {
  const it = item({ id: 'DOS-M009', updated_at: '2026-10-19T10:00:00Z' }, { numero_serie: '500.0333', chegada_real_material: '2026-09-30' }, { diario: { pct: 0, iniciadoEm: null } });
  const r = K.avaliar([it], { hoje }).get(it).find((x) => x.codigo === 'sem_diario');
  assert.ok(r);
  assert.equal(r.quem, 'montador');
});

test('Diário lançado ou chegada recente (< 3 dias úteis) não cobra o montador', () => {
  const com = item({ id: 'A', updated_at: '2026-10-19T10:00:00Z' }, { numero_serie: 'A1', chegada_real_material: '2026-09-30' });
  assert.ok(!codigos(com).includes('sem_diario'));
  const novo = item({ id: 'B', updated_at: '2026-10-23T10:00:00Z' }, { numero_serie: 'B1', chegada_real_material: '2026-10-22' }, { diario: { pct: 0, iniciadoEm: null } });
  assert.ok(!codigos(novo).includes('sem_diario'));
});

test('500.0338 iniciou e o irmão 500.0339 (mesma obra) não', () => {
  const mk = (id, serie, ri) => item({ id, client_name: 'PRIVILEGIO', building_name: 'Torre', city: 'São Paulo', updated_at: '2026-10-15T10:00:00Z' }, { numero_serie: serie, chegada_real_material: '2026-07-01', data_real_inicio: ri });
  const a = mk('DOS-M013', '500.0338', '2026-10-14');
  const b = mk('DOS-M014', '500.0339', null);
  const r = K.avaliar([a, b], { hoje });
  assert.ok(r.get(b).map((x) => x.codigo).includes('irmao_iniciou'));
  assert.ok(!r.get(a).map((x) => x.codigo).includes('irmao_iniciou'));
});

test('registro limpo não gera nada', () => {
  const it = item({ id: 'OK', updated_at: '2026-10-20T10:00:00Z' }, { numero_serie: 'OK1', chegada_real_material: '2026-10-01', data_real_inicio: '2026-10-05', previsao_inicio: '2026-10-04', previsao_termino: '2026-12-01' });
  assert.deepEqual(codigos(it), []);
});

test('dias úteis: sexta → segunda é 1; fim de semana não conta', () => {
  assert.equal(K.diasUteis(new Date(2026, 9, 23), new Date(2026, 9, 26)), 1);
  assert.equal(K.diasUteis(new Date(2026, 9, 24), new Date(2026, 9, 24)), 0);
  assert.equal(K.diasUteis(new Date(2026, 9, 19), new Date(2026, 9, 24)), 4);
});

test('resumo separa Felipe × montador e ordena por gravidade', () => {
  const a = item({ id: 'A', updated_at: '2026-09-02T10:00:00Z' }, { numero_serie: 'A1', previsao_termino: '2026-08-31' });
  const b = item({ id: 'B', updated_at: '2026-10-19T10:00:00Z' }, { numero_serie: 'B1', chegada_real_material: '2026-09-30' }, { diario: { pct: 0, iniciadoEm: null } });
  const res = K.resumo([a, b], { hoje });
  assert.equal(res.felipe.length >= 1, true);
  assert.equal(res.montador.length, 1);
  assert.equal(res.felipe[0].gravidade, 'alta');
  assert.equal(res.total, res.felipe.length + res.montador.length);
});
