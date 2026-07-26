/* ============================================================
   proposta-imagens.js
   Helpers de upload/leitura de fotos do equipamento na Proposta.
   Mesmo padrão de ficha-tecnica-imagens.js — bucket PRIVADO (lição do
   incidente vp-automations-hub: nunca expor foto/desenho de produto
   publicamente), acesso só via URL assinada.

   Bucket: propostas-imagens (privado, MIME image/*, max 5MB).
   Path: propostas/{proposta_id}/{slot}.jpg
   ============================================================ */
(function () {
  'use strict';

  const BUCKET = 'propostas-imagens';

  function sb() { return (window.__VP_SB || {}).sb; }

  function slugify(s) {
    return String(s || 'proposta')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 60) || 'proposta';
  }

  /* ---------- Compressão no front (reduz pra ~1280px lado maior + JPEG) ---------- */
  async function compress(dataURLOrBlob, maxSide, quality) {
    maxSide = maxSide || 1280;
    quality = quality || 0.8;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxSide || h > maxSide) {
          if (w >= h) { h = Math.round(h * maxSide / w); w = maxSide; }
          else        { w = Math.round(w * maxSide / h); h = maxSide; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob falhou')),
          'image/jpeg', quality
        );
      };
      img.onerror = () => reject(new Error('imagem inválida'));
      img.src = typeof dataURLOrBlob === 'string'
        ? dataURLOrBlob
        : URL.createObjectURL(dataURLOrBlob);
    });
  }

  /* ---------- Upload no bucket — retorna o PATH (persiste no data_json) ---------- */
  async function upload(blob, opts) {
    opts = opts || {};
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const propostaId = slugify(opts.propostaId);
    const slot = opts.slot || 'foto';
    const path = `propostas/${propostaId}/${slot}.jpg`;
    const { error } = await c.storage.from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (error) throw error;
    return { path };
  }

  async function compressAndUpload(fileOrDataURL, opts) {
    const blob = await compress(fileOrDataURL, opts && opts.maxSide, opts && opts.quality);
    return upload(blob, opts);
  }

  /* ---------- URL assinada (bucket privado) — cache em memória ---------- */
  const _urlCache = new Map();
  async function signedURL(path, ttlSeconds) {
    if (!path) return null;
    ttlSeconds = ttlSeconds || 3600;
    const cacheKey = path + '::' + ttlSeconds;
    const cached = _urlCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) return cached.url;
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
    if (error || !data) { console.warn('[PropostaImagens] signedURL error', error); return null; }
    _urlCache.set(cacheKey, { url: data.signedUrl, exp: Date.now() + (ttlSeconds - 60) * 1000 });
    return data.signedUrl;
  }

  async function remove(path) {
    if (!path) return;
    const c = sb(); if (!c) return;
    await c.storage.from(BUCKET).remove([path]);
    [..._urlCache.keys()].forEach((k) => { if (k.startsWith(path + '::')) _urlCache.delete(k); });
  }

  window.PropostaImagens = { BUCKET, slugify, compress, upload, compressAndUpload, signedURL, remove };
}());
