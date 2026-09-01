/* ============================================================
   vistorias-questionarios-store.js — CRUD do motor de questionários
   de Vistorias de Obras (Fase 1: builder). Ver migration
   20260901200000_vistorias_questionarios_engine.sql pro schema.

   Hierarquia: Questionário -> Categoria -> Pergunta (com ramo
   condicional via regra_pai_pergunta_id/regra_valor_gatilho).
   `ordem` é mantida client-side (empurra pro fim ao criar; mover
   sobe/desce troca `ordem` com o vizinho).
   ============================================================ */

window.VistoriasQuestionariosStore = window.VistoriasQuestionariosStore || (() => {
  const sb = () => window.__VP_SB?.sb;

  const TIPOS_CAMPO = [
    { value: 'texto', label: 'Texto' },
    { value: 'numerico', label: 'Numérico' },
    { value: 'data', label: 'Data' },
    { value: 'sim_nao', label: 'Sim ou Não' },
    { value: 'selecao_unica', label: 'Seleção única' },
    { value: 'multipla_escolha', label: 'Múltipla escolha' },
    { value: 'foto', label: 'Foto' },
    { value: 'assinatura', label: 'Assinatura' },
    { value: 'informativa', label: 'Informativa' },
  ];
  const TIPOS_CAMPO_COM_OPCOES = ['selecao_unica', 'multipla_escolha'];

  return {
    TIPOS_CAMPO,
    TIPOS_CAMPO_COM_OPCOES,

    /* ---- Questionários ---- */
    async listarQuestionarios() {
      const { data, error } = await sb().from('vistorias_questionarios')
        .select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async criarQuestionario({ nome, tipo }) {
      const { data, error } = await sb().from('vistorias_questionarios')
        .insert({ nome, tipo: tipo || 'vistoria', criado_por: window.__VP_USER?.email || 'system' })
        .select().single();
      if (error) throw error;
      return data;
    },

    async atualizarQuestionario(id, patch) {
      const { error } = await sb().from('vistorias_questionarios')
        .update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },

    async excluirQuestionario(id) {
      const { error } = await sb().from('vistorias_questionarios').delete().eq('id', id);
      if (error) throw error;
    },

    /* ---- Estrutura completa (categorias + perguntas aninhadas) ---- */
    async carregarEstrutura(questionarioId) {
      const { data: categorias, error: e1 } = await sb().from('vistorias_categorias')
        .select('*').eq('questionario_id', questionarioId).order('ordem');
      if (e1) throw e1;
      const categoriaIds = (categorias || []).map((c) => c.id);
      if (categoriaIds.length === 0) return [];
      const { data: perguntas, error: e2 } = await sb().from('vistorias_perguntas')
        .select('*').in('categoria_id', categoriaIds).order('ordem');
      if (e2) throw e2;
      return (categorias || []).map((c) => ({
        ...c,
        perguntas: (perguntas || []).filter((p) => p.categoria_id === c.id),
      }));
    },

    /* ---- Categorias ---- */
    async criarCategoria(questionarioId, nome) {
      const { data: existentes } = await sb().from('vistorias_categorias')
        .select('ordem').eq('questionario_id', questionarioId).order('ordem', { ascending: false }).limit(1);
      const proximaOrdem = existentes && existentes[0] ? existentes[0].ordem + 1 : 0;
      const { data, error } = await sb().from('vistorias_categorias')
        .insert({ questionario_id: questionarioId, nome, ordem: proximaOrdem }).select().single();
      if (error) throw error;
      return data;
    },

    async renomearCategoria(id, nome) {
      const { error } = await sb().from('vistorias_categorias').update({ nome }).eq('id', id);
      if (error) throw error;
    },

    async excluirCategoria(id) {
      const { error } = await sb().from('vistorias_categorias').delete().eq('id', id);
      if (error) throw error;
    },

    /* ---- Perguntas ---- */
    async criarPergunta(categoriaId, campos) {
      const { data: existentes } = await sb().from('vistorias_perguntas')
        .select('ordem').eq('categoria_id', categoriaId).order('ordem', { ascending: false }).limit(1);
      const proximaOrdem = existentes && existentes[0] ? existentes[0].ordem + 1 : 0;
      const { data, error } = await sb().from('vistorias_perguntas')
        .insert({ categoria_id: categoriaId, ordem: proximaOrdem, ...campos }).select().single();
      if (error) throw error;
      return data;
    },

    async atualizarPergunta(id, patch) {
      const { error } = await sb().from('vistorias_perguntas').update(patch).eq('id', id);
      if (error) throw error;
    },

    async excluirPergunta(id) {
      const { error } = await sb().from('vistorias_perguntas').delete().eq('id', id);
      if (error) throw error;
    },

    /* Troca a `ordem` de duas perguntas da mesma categoria (mover pra cima/baixo) */
    async reordenarPerguntas(perguntaA, perguntaB) {
      const { error: e1 } = await sb().from('vistorias_perguntas').update({ ordem: perguntaB.ordem }).eq('id', perguntaA.id);
      if (e1) throw e1;
      const { error: e2 } = await sb().from('vistorias_perguntas').update({ ordem: perguntaA.ordem }).eq('id', perguntaB.id);
      if (e2) throw e2;
    },
  };
})();
