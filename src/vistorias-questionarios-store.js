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

    /* ---- Atividades (Fase 2: despacho) ----
       O token vira o link mandado pro técnico; a página que ele abre
       (execução no celular) é a Fase 3, ainda não construída. */
    async criarAtividade({ questionarioId, dossierId, equipamentoId, tecnicoId }) {
      const token = (window.crypto?.randomUUID ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
      const { data, error } = await sb().from('vistorias_atividades').insert({
        questionario_id: questionarioId,
        dossier_id: dossierId,
        equipamento_id: equipamentoId || null,
        tecnico_id: tecnicoId || null,
        token,
        status: 'pendente',
        enviado_em: new Date().toISOString(),
        criado_por: window.__VP_USER?.email || 'system',
      }).select().single();
      if (error) throw error;
      return data;
    },

    async listarAtividades() {
      const { data, error } = await sb().from('vistorias_atividades')
        .select('*, dossier_obra(client_name, building_name), equipamentos_obra(numero_serie), colaboradores_vpsistema(nome), vistorias_questionarios(nome)')
        .order('criado_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },

    /* ---- Resultado (Fase 4): checklists digitais de UMA obra ---- */
    async listarAtividadesPorDossier(dossierId) {
      const { data, error } = await sb().from('vistorias_atividades')
        .select('*, equipamentos_obra(numero_serie), colaboradores_vpsistema(nome), vistorias_questionarios(nome)')
        .eq('dossier_id', dossierId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async listarRespostas(atividadeId) {
      const { data, error } = await sb().from('vistorias_respostas').select('*').eq('atividade_id', atividadeId);
      if (error) throw error;
      return data || [];
    },

    /* ---- Hidratação por Master ID ----
       Aceita VPOB-0950 (obra), VPEL-EL0950 / -A / -1 / -A-1 (equipamento)
       ou o número puro. Resolve a obra (dossier_obra por numero_cotacao)
       e, se o ID trouxer índice de ativo, a especificação técnica em
       formularios_elevador_unidades (paradas, dimensões, tensão etc. —
       preenchidas lá no Formulário/Cotação, não recadastradas aqui). */
    parseMasterId(raw) {
      const s = String(raw || '').trim().toUpperCase();
      if (!s) return null;
      let m = s.match(/^VP[A-Z]{2}-[A-Z]+(\d+)(?:-([A-Z]+))?(?:-(\d+))?$/);
      if (m) return { numero: parseInt(m[1], 10), revisao: m[2] || null, indiceAtivo: m[3] ? parseInt(m[3], 10) : null };
      m = s.match(/^VP[A-Z]{2}-(\d+)$/);
      if (m) return { numero: parseInt(m[1], 10), revisao: null, indiceAtivo: null };
      if (/^\d+$/.test(s)) return { numero: parseInt(s, 10), revisao: null, indiceAtivo: null };
      return null;
    },

    async resolverPorMasterId(raw) {
      const parsed = this.parseMasterId(raw);
      if (!parsed) throw new Error('ID não reconhecido — use um formato tipo VPOB-0950 ou VPEL-EL0950-1');

      const { data: obra, error: eObra } = await sb().from('dossier_obra')
        .select('id, client_name, building_name, city, state, numero_cotacao, equip_type')
        .eq('numero_cotacao', parsed.numero).maybeSingle();
      if (eObra) throw eObra;
      if (!obra) throw new Error(`Nenhuma obra encontrada para o nº ${parsed.numero}`);

      let unidade = null;
      if (parsed.indiceAtivo != null) {
        const { data: formularios, error: eForm } = await sb().from('formularios_elevador')
          .select('id').eq('numero_cotacao', parsed.numero);
        if (eForm) throw eForm;
        const formIds = (formularios || []).map((f) => f.id);
        if (formIds.length > 0) {
          const { data: unidades, error: eUn } = await sb().from('formularios_elevador_unidades')
            .select('*').in('formulario_id', formIds).eq('indice_ativo', parsed.indiceAtivo);
          if (eUn) throw eUn;
          unidade = (unidades || [])[0] || null;
        }
      }
      return { parsed, obra, unidade };
    },
  };
})();
