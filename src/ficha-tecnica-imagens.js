/* ============================================================
   ficha-tecnica-imagens.js
   Helpers de upload/leitura de imagens no Supabase Storage.

   Bucket: fichas-imagens (privado, MIME image/*, max 5MB).
   Path: fichas/{ficha_id}/{tipo}-{slug-nome}.jpg
   ============================================================ */
(function () {
  'use strict';

  const BUCKET = 'fichas-imagens';

  function sb() { return (window.__VP_SB || {}).sb; }

  function slugify(s) {
    return String(s || 'produto')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 60) || 'produto';
  }

  /* ---------- Compressão no front ----------
     Reduz pra ~1280px lado maior + JPEG ~0.8.
     Evita estourar 5MB e infla payload (instruído no SPEC). */
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

  /* ---------- Upload no bucket ----------
     Retorna { path, name } onde path é o que persiste no jsonb midia. */
  async function upload(blob, opts) {
    opts = opts || {};
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const fichaId = opts.fichaId || 'tmp-' + Math.random().toString(36).slice(2, 10);
    const tipo = opts.tipo || 'foto';        // 'foto' | 'desenho'
    const nome = slugify(opts.nomeProduto);
    const path = `fichas/${fichaId}/${tipo}-${nome}.jpg`;

    const { error } = await c.storage.from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (error) throw error;
    return { path, name: nome + '-' + tipo + '.jpg' };
  }

  /* ---------- Compress + upload em uma chamada ---------- */
  async function compressAndUpload(dataURL, opts) {
    const blob = await compress(dataURL, opts && opts.maxSide, opts && opts.quality);
    return upload(blob, opts);
  }

  /* ---------- URL assinada ----------
     Bucket privado: precisa de URL assinada pra exibir/baixar.
     Cache em memória pra não pedir signed URL toda hora. */
  const _urlCache = new Map();
  async function signedURL(path, ttlSeconds) {
    if (!path) return null;
    ttlSeconds = ttlSeconds || 3600;
    const cacheKey = path + '::' + ttlSeconds;
    const cached = _urlCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) return cached.url;
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
    if (error || !data) { console.warn('[FTImg] signedURL error', error); return null; }
    _urlCache.set(cacheKey, { url: data.signedUrl, exp: Date.now() + (ttlSeconds - 60) * 1000 });
    return data.signedUrl;
  }

  /* ---------- Delete ---------- */
  async function remove(path) {
    if (!path) return;
    const c = sb(); if (!c) return;
    await c.storage.from(BUCKET).remove([path]);
    // Invalida cache
    [..._urlCache.keys()].forEach((k) => { if (k.startsWith(path + '::')) _urlCache.delete(k); });
  }

  /* ---------- Copia um arquivo da ficha para a pasta de OUTRA ficha ----------
     Usado ao salvar uma cópia de ficha: a cópia ganha o próprio arquivo, então
     limpar/trocar a foto dela nunca apaga a da original. Lança erro se falhar. */
  async function copiarPara(path, fichaId) {
    if (!path || !fichaId) throw new Error('caminho ou ficha inválidos');
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const nome = String(path).split('/').pop();
    const novo = `fichas/${fichaId}/${nome}`;
    if (novo === path) return path;
    await c.storage.from(BUCKET).remove([novo]).catch(() => {});
    const { error } = await c.storage.from(BUCKET).copy(path, novo);
    if (error) throw error;
    return novo;
  }
  /* true se o caminho pertence à pasta desta ficha */
  function ehDaFicha(path, fichaId) {
    return typeof path === 'string' && !!fichaId && path.startsWith(`fichas/${fichaId}/`);
  }

  /* ---------- Heuristica: é path do Storage ou dataURL legado? ---------- */
  function isStoragePath(v) {
    return typeof v === 'string' && v.startsWith('fichas/');
  }
  function isDataURL(v) {
    return typeof v === 'string' && v.startsWith('data:');
  }

  /* ---------- Backwards-compat: resolve uma midia qualquer (path OU dataURL) ---------- */
  async function resolveURL(v) {
    if (!v) return null;
    if (isDataURL(v)) return v;                  // legado: dataURL ainda funciona pra exibir
    if (isStoragePath(v)) return await signedURL(v);
    return v;                                    // qualquer outra URL passa direto
  }

  window.FTImg = {
    BUCKET, slugify,
    compress, upload, compressAndUpload,
    signedURL, remove, copiarPara, ehDaFicha,
    isStoragePath, isDataURL, resolveURL,
  };
}());
