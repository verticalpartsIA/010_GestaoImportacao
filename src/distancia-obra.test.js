'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./distancia-obra.js');
const D = window.DistanciaObra;

const resp = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });

test('haversine: Guarulhos → centro de São Paulo ≈ 15–20 km em linha reta', () => {
  const km = D.haversineKm(D.ORIGEM, { lat: -23.5506507, lon: -46.6333824 });
  assert.ok(km > 14 && km < 20, String(km));
});
test('formatarKm usa vírgula e 1 casa', () => {
  assert.equal(D.formatarKm(19.0723), '19,1'); assert.equal(D.formatarKm(100), '100,0');
});
test('calcular: rota por estrada quando o OSRM responde', async () => {
  const f = (url) => url.includes('nominatim') ? resp([{ lat: '-22.9056391', lon: '-47.0595640', display_name: 'Campinas' }]) : resp({ code: 'Ok', routes: [{ distance: 98500 }] });
  const r = await D.calcular({ cidade: 'Campinas', uf: 'sp', fetchFn: f });
  assert.equal(r.fonte, 'rota'); assert.equal(D.formatarKm(r.km), '98,5');
});
test('calcular: plano B em linha reta × 1,3 quando a rota falha', async () => {
  const f = (url) => url.includes('nominatim') ? resp([{ lat: '-22.0', lon: '-47.0', display_name: 'X' }]) : resp({}, false);
  const r = await D.calcular({ cidade: 'Cidade B', uf: 'SP', fetchFn: f });
  assert.equal(r.fonte, 'linha_reta');
  assert.ok(Math.abs(r.km - D.haversineKm(D.ORIGEM, { lat: -22.0, lon: -47.0 }) * 1.3) < 1e-6);
});
test('calcular: cidade não encontrada lança erro claro', async () => {
  await assert.rejects(D.calcular({ cidade: 'Zzz', uf: 'SP', fetchFn: () => resp([]) }), /Não encontrei/);
});
