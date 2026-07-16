/* ============================================================
   ficha-tecnica-store.js
   Persistência das Fichas Técnicas no Supabase vpprd.
   Toda ficha salva também sincroniza um registro em catalogo_produtos.
   Expõe window.FTStore = { ... }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function relative(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff/60000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m/60); if (h < 24) return `há ${h} h`;
    const d = Math.floor(h/24); return `há ${d} d`;
  }

  /* ---------- CRUD ---------- */
  async function listAll() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('fichas_tecnicas')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) { console.warn('[FTStore] list error', error); return []; }
    return data || [];
  }
  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('fichas_tecnicas').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* Extrai NCM dos campos ativos da categoria "codigos" (se houver). */
  function extractNCM(state) {
    const cat = state.cats.find((c) => c.id === 'codigos');
    if (!cat) return null;
    const fld = cat.campos.find((fld) => fld.ativo && /^NCM$/i.test(fld.nome));
    if (!fld || !fld.valor) return null;
    return String(fld.valor).trim();
  }

  /* Converte cats → atributos[] no formato esperado por catalogo_produtos */
  function buildAtributos(state) {
    const out = [];
    state.cats.forEach((cat) => {
      cat.campos.forEach((fld) => {
        if (!fld.ativo) return;
        if (fld.valor == null || String(fld.valor).trim() === '') return;
        out.push({
          categoria: cat.nome,
          nome: fld.nome,
          valor: String(fld.valor).trim(),
          unidade: fld.unidade || '',
          tipo: fld.tipo || 'number',
        });
      });
    });
    return out;
  }

  /* Sync: upsert no catalogo_produtos. Retorna id do produto. */
  async function syncCatalogoProduto(ficha, state) {
    const c = sb(); if (!c) return null;
    const ident = state.identificacao || {};
    const codigo = ident.codigoProduto || ident.sku || ficha.numero_documento;
    const ncm = extractNCM(state);
    const atributos = buildAtributos(state);

    const row = {
      id: ficha.produto_id || ('ft-' + (ficha.id || uuid())),
      codigo: codigo || ficha.numero_documento,
      situacao: 'ativado',
      modalidade: 'IMPORTACAO',
      denominacao: ident.nomeProduto || 'Produto sem nome',
      detalhamento: ident.descricaoComercial || ident.descricaoTecnica || '',
      ncm: ncm || null,
      ncm_descricao: ident.categoriaProduto || null,
      codigo_interno: ident.codigoProduto || ident.sku || null,
      unidade_medida: 'UN',
      atributos: atributos,
      fabricantes: [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await c.from('catalogo_produtos').upsert(row, { onConflict: 'id' });
    if (error) console.warn('[FTStore] sync catalogo_produtos error', error);
    return row.id;
  }

  /* Cria uma nova ficha + sincroniza no catalogo_produtos */
  async function createDraft(state, opts) {
    opts = opts || {};
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');

    const { data: numRows, error: numErr } = await c.rpc('next_doc_number', { p_prefixo: 'VPFT' });
    if (numErr) throw numErr;
    const num = (Array.isArray(numRows) ? numRows[0] : numRows) || {};

    const ident = state.identificacao || {};
    const rec = {
      id: state.__id || uuid(),                 // usa o id estável gerado no defaultState
      numero_documento: num.numero_documento,
      seq_mes: num.seq_mes,
      ano_mes: num.ano_mes,
      nome_produto: ident.nomeProduto || 'Sem nome',
      categoria_produto: ident.categoriaProduto || null,
      sku: ident.sku || null,
      codigo_produto: ident.codigoProduto || null,
      part_number: ident.partNumber || null,
      descricao_comercial: ident.descricaoComercial || null,
      descricao_tecnica: ident.descricaoTecnica || null,
      identificacao: ident,
      cats: state.cats,
      midia: state.midia || {},
      /* NCM/DUIMP — inputs novos do copiloto */
      insumo: state.insumo || null,
      funcao_aplicacao: state.funcao_aplicacao || null,
      eh_parte_de: state.eh_parte_de || null,
      forma_estado: state.forma_estado || null,
      /* NCM/DUIMP — decisão limpa devolvida pela IA */
      ncm_recomendado: state.ncm_recomendado || null,
      ncm_descricao: state.ncm_descricao || null,
      descricao_duimp: state.descricao_duimp || null,
      criado_por: opts.criadoPor || null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    // sync no catálogo primeiro pra ter o produto_id
    const prodId = await syncCatalogoProduto(rec, state);
    rec.produto_id = prodId;

    const { error } = await c.from('fichas_tecnicas').insert(rec);
    if (error) throw error;
    return rec;
  }

  /* Atualiza uma ficha existente (e re-sincroniza o produto) */
  async function update(id, state) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const ident = state.identificacao || {};
    const patch = {
      nome_produto: ident.nomeProduto || 'Sem nome',
      categoria_produto: ident.categoriaProduto || null,
      sku: ident.sku || null,
      codigo_produto: ident.codigoProduto || null,
      part_number: ident.partNumber || null,
      descricao_comercial: ident.descricaoComercial || null,
      descricao_tecnica: ident.descricaoTecnica || null,
      identificacao: ident,
      cats: state.cats,
      midia: state.midia || {},
      insumo: state.insumo || null,
      funcao_aplicacao: state.funcao_aplicacao || null,
      eh_parte_de: state.eh_parte_de || null,
      forma_estado: state.forma_estado || null,
      ncm_recomendado: state.ncm_recomendado || null,
      ncm_descricao: state.ncm_descricao || null,
      descricao_duimp: state.descricao_duimp || null,
      atualizado_em: new Date().toISOString(),
    };
    await c.from('fichas_tecnicas').update(patch).eq('id', id);
    const updated = { ...cur, ...patch };
    await syncCatalogoProduto(updated, state);
    return updated;
  }

  async function remove(id) {
    const c = sb();
    const cur = await getById(id);
    if (cur && cur.produto_id) {
      await c.from('catalogo_produtos').delete().eq('id', cur.produto_id);
    }
    await c.from('fichas_tecnicas').delete().eq('id', id);
  }

  /* ============================================================
     Biblioteca persistente (categorias + campos customizados).
     Quando o usuário cria um campo/categoria personalizado em qualquer
     ficha, ele entra na biblioteca e aparece na sidebar de TODAS as
     fichas futuras (mesclado com as 9 categorias pré-prontas).
     ============================================================ */
  async function loadLibrary() {
    const c = sb(); if (!c) return { cats: [], campos: [] };
    const [catsR, camposR] = await Promise.all([
      c.from('fichas_lib_categorias').select('*').order('criado_em', { ascending: true }),
      c.from('fichas_lib_campos').select('*').order('criado_em', { ascending: true }),
    ]);
    return { cats: catsR.data || [], campos: camposR.data || [] };
  }

  async function saveCategoryToLibrary(cat) {
    const c = sb(); if (!c || !cat || !cat.id) return null;
    const row = { id: cat.id, nome: cat.nome, icon: cat.icon || 'folder' };
    const { error } = await c.from('fichas_lib_categorias').upsert(row, { onConflict: 'id' });
    if (error) console.warn('[FTStore] saveCategoryToLibrary error', error);
    return row;
  }

  /* Slug estável (sem sufixo aleatório) pra biblioteca — diferente do
     slug local que tem random suffix. Aqui é (cat_id, k) único. */
  function libFieldKey(nome) {
    return 'fl_' + String(nome).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  }

  async function saveFieldToLibrary(catId, def) {
    const c = sb(); if (!c || !catId || !def || !def.nome) return null;
    const row = {
      cat_id: catId,
      k: libFieldKey(def.nome),
      nome: def.nome,
      unidade: def.unidade || '',
      tipo: def.tipo || 'number',
    };
    const { error } = await c.from('fichas_lib_campos').upsert(row, { onConflict: 'cat_id,k' });
    if (error) console.warn('[FTStore] saveFieldToLibrary error', error);
    return row;
  }

  /* Exclui uma categoria customizada da biblioteca (e os campos dela) —
     afeta só o que fichas NOVAS vão oferecer daqui pra frente; fichas já
     salvas guardam seu próprio retrato de categorias/campos e não mudam. */
  async function deleteCategoryFromLibrary(catId) {
    const c = sb(); if (!c || !catId) return;
    const { error: e1 } = await c.from('fichas_lib_campos').delete().eq('cat_id', catId);
    if (e1) console.warn('[FTStore] deleteCategoryFromLibrary (campos) error', e1);
    const { error: e2 } = await c.from('fichas_lib_categorias').delete().eq('id', catId);
    if (e2) console.warn('[FTStore] deleteCategoryFromLibrary (categoria) error', e2);
  }

  /* Exclui um campo customizado específico da biblioteca. */
  async function deleteFieldFromLibrary(catId, k) {
    const c = sb(); if (!c || !catId || !k) return;
    const { error } = await c.from('fichas_lib_campos').delete().eq('cat_id', catId).eq('k', k);
    if (error) console.warn('[FTStore] deleteFieldFromLibrary error', error);
  }

  window.FTStore = {
    uuid, fmtDateTime, relative,
    listAll, getById, createDraft, update, remove,
    syncCatalogoProduto, extractNCM, buildAtributos,
    loadLibrary, saveCategoryToLibrary, saveFieldToLibrary, libFieldKey,
    deleteCategoryFromLibrary, deleteFieldFromLibrary,
  };
}());
