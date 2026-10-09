/* ============================================================
   proposta-acabamentos-store.js — biblioteca persistente de categorias/
   campos customizados de "Acabamentos" da Proposta (tabelas
   propostas_lib_categorias / propostas_lib_campos).

   Mesmo padrão de fichas_lib_categorias/fichas_lib_campos (ver
   ficha-tecnica-store.js), mas em tabelas PRÓPRIAS — vocabulário de
   acabamento comercial de proposta é diferente do de ficha técnica de
   produto, não devem se misturar.

   window.PropostaAcabamentosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function loadLibrary() {
    const c = sb(); if (!c) return { cats: [], campos: [] };
    const [catsR, camposR] = await Promise.all([
      c.from('propostas_lib_categorias').select('*').order('criado_em', { ascending: true }),
      c.from('propostas_lib_campos').select('*').order('criado_em', { ascending: true }),
    ]);
    return { cats: catsR.data || [], campos: camposR.data || [] };
  }

  async function saveCategoryToLibrary(cat) {
    const c = sb(); if (!c || !cat || !cat.id) return null;
    const row = { id: cat.id, nome: cat.nome };
    const { error } = await c.from('propostas_lib_categorias').upsert(row, { onConflict: 'id' });
    if (error) console.warn('[PropostaAcabamentosStore] saveCategoryToLibrary error', error);
    return row;
  }

  async function saveFieldToLibrary(catId, def) {
    const c = sb(); if (!c || !catId || !def || !def.nome) return null;
    const k = window.PropostaAcabamentosEngine.fieldKey(def.nome);
    const row = { cat_id: catId, k, nome: def.nome, tipo: def.tipo || 'text' };
    const { error } = await c.from('propostas_lib_campos').upsert(row, { onConflict: 'cat_id,k' });
    if (error) console.warn('[PropostaAcabamentosStore] saveFieldToLibrary error', error);
    return row;
  }

  /* Exclui uma categoria customizada da biblioteca (e os campos dela) —
     afeta só o que propostas NOVAS vão oferecer daqui pra frente; propostas
     já salvas guardam seu próprio retrato de categorias/campos. */
  async function deleteCategoryFromLibrary(catId) {
    const c = sb(); if (!c || !catId) return;
    const { error: e1 } = await c.from('propostas_lib_campos').delete().eq('cat_id', catId);
    if (e1) console.warn('[PropostaAcabamentosStore] deleteCategoryFromLibrary (campos) error', e1);
    const { error: e2 } = await c.from('propostas_lib_categorias').delete().eq('id', catId);
    if (e2) console.warn('[PropostaAcabamentosStore] deleteCategoryFromLibrary (categoria) error', e2);
  }

  async function deleteFieldFromLibrary(catId, k) {
    const c = sb(); if (!c || !catId || !k) return;
    const { error } = await c.from('propostas_lib_campos').delete().eq('cat_id', catId).eq('k', k);
    if (error) console.warn('[PropostaAcabamentosStore] deleteFieldFromLibrary error', error);
  }

  window.PropostaAcabamentosStore = {
    loadLibrary, saveCategoryToLibrary, saveFieldToLibrary,
    deleteCategoryFromLibrary, deleteFieldFromLibrary,
  };
}());
