/* ============================================================
   distancia-obra.js — distância da sede da Vertical Parts até a obra (15/10/2026).
   Origem FIXA: Rua Armandina Braga de Almeida, 383 – Guarulhos/SP (CEP 07141-003; coordenadas do CEP, BrasilAPI).
   Destino: o CENTRO da cidade da obra (Nominatim/OpenStreetMap). Distância por ESTRADA (OSRM); se a rota falhar,
   usa linha reta × 1,3 e avisa. É uma estimativa — o operador pode editar o valor (ex.: obra distante do centro).
   window.DistanciaObra
   ============================================================ */
(function () {
  'use strict';

  const ORIGEM = { lat: -23.46278, lon: -46.53333, rotulo: 'Rua Armandina Braga de Almeida, 383 – Guarulhos/SP' };
  const FATOR_LINHA_RETA = 1.3;
  const _cache = new Map();

  function haversineKm(a, b) {
    const R = 6371, rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /* 19.07 → "19,1" (vírgula decimal, como o contrato lê). */
  function formatarKm(km) { return (Math.round(Number(km) * 10) / 10).toFixed(1).replace('.', ','); }

  async function _json(fetchFn, url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), ms || 8000) : null;
    try {
      const r = await fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { if (t) clearTimeout(t); }
  }

  async function geocodificar(cidade, uf, fetchFn) {
    const q = `${cidade}, ${uf}, Brasil`;
    const d = await _json(fetchFn, 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=' + encodeURIComponent(q));
    if (!Array.isArray(d) || !d.length) return null;
    return { lat: Number(d[0].lat), lon: Number(d[0].lon), nome: d[0].display_name };
  }

  /* → { km, fonte: 'rota' | 'linha_reta', destino:{lat,lon,nome} } ; lança erro se a cidade não for achada. */
  async function calcular({ cidade, uf, fetchFn }) {
    const f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!f) throw new Error('Sem acesso à rede.');
    const chave = `${String(cidade).trim().toLowerCase()}|${String(uf).trim().toUpperCase()}`;
    if (_cache.has(chave)) return _cache.get(chave);
    const destino = await geocodificar(String(cidade).trim(), String(uf).trim().toUpperCase(), f);
    if (!destino) throw new Error(`Não encontrei "${cidade}/${uf}" no mapa.`);
    let km, fonte;
    try {
      const d = await _json(f, `https://router.project-osrm.org/route/v1/driving/${ORIGEM.lon},${ORIGEM.lat};${destino.lon},${destino.lat}?overview=false`);
      if (d.code !== 'Ok' || !d.routes || !d.routes[0]) throw new Error('sem rota');
      km = d.routes[0].distance / 1000; fonte = 'rota';
    } catch (_) {
      km = haversineKm(ORIGEM, destino) * FATOR_LINHA_RETA; fonte = 'linha_reta';
    }
    const r = { km, fonte, destino };
    _cache.set(chave, r);
    return r;
  }

  window.DistanciaObra = { ORIGEM, FATOR_LINHA_RETA, haversineKm, formatarKm, calcular };
}());
