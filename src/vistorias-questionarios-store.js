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

    async atualizarCategoria(id, patch) {
      const { error } = await sb().from('vistorias_categorias').update(patch).eq('id', id);
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

    /* Lista de pavimentos que uma categoria repete, dado o nº de paradas da
       atividade. 'todos' (ou null) = 1..N. 'intermediarios' = 2..N-1 (usado
       pra "Pavimentos Intermediários", que não repete no 1º nem no último
       piso — esses têm categoria própria, não-repetida). Usado tanto na
       execução pública (vistoria-execucao.jsx) quanto no resultado
       (vistorias-obras.jsx), pra nunca divergir. */
    pavsDaCategoria(categoria, paradas) {
      if (!categoria.repete_por_pavimento) return [0];
      const n = Math.max(1, paradas || 1);
      if (categoria.repete_modo === 'intermediarios') {
        const len = Math.max(0, n - 2);
        return Array.from({ length: len }, (_, i) => i + 2);
      }
      return Array.from({ length: n }, (_, i) => i + 1);
    },

    /* Troca a `ordem` de duas perguntas da mesma categoria (mover pra cima/baixo) */
    async reordenarPerguntas(perguntaA, perguntaB) {
      const { error: e1 } = await sb().from('vistorias_perguntas').update({ ordem: perguntaB.ordem }).eq('id', perguntaA.id);
      if (e1) throw e1;
      const { error: e2 } = await sb().from('vistorias_perguntas').update({ ordem: perguntaA.ordem }).eq('id', perguntaB.id);
      if (e2) throw e2;
    },

    /* wa.me com o número já preenchido — mesmo padrão de
       proposta-store.js/contrato-instalador-store.js/contrato-venda-store.js/
       pedido-fornecedor-store.js (cada store tem sua cópia, é a convenção
       do projeto). Sem número, cai pro wa.me genérico (abre o seletor de
       contato do WhatsApp Web/app). */
    whatsAppHref(phone, message) {
      let p = (phone || '').replace(/\D/g, '');
      if (p.length === 11 && p[2] === '9') p = '55' + p;
      const base = p ? 'https://wa.me/' + p : 'https://wa.me/';
      return base + '?text=' + encodeURIComponent(message);
    },

    /* Troca o vistoriador de uma atividade já despachada e gera um token
       novo — o link antigo (já visto/começado pelo vistoriador anterior)
       para de funcionar de verdade, então precisa de um link novo pra
       mandar pro substituto. Mantém as respostas já preenchidas; reseta
       status/check-in pra o novo vistoriador começar do zero visualmente. */
    async trocarVistoriadorEReenviar(atividadeId, novoTecnicoId) {
      const token = (window.crypto?.randomUUID ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
      const { data, error } = await sb().from('vistorias_atividades').update({
        tecnico_id: novoTecnicoId || null,
        token,
        status: 'pendente',
        checkin_em: null, checkin_lat: null, checkin_lng: null,
        enviado_em: new Date().toISOString(),
      }).eq('id', atividadeId).select().single();
      if (error) throw error;
      return data;
    },

    async excluirAtividade(atividadeId) {
      const { error: e1 } = await sb().from('vistorias_respostas').delete().eq('atividade_id', atividadeId);
      if (e1) throw e1;
      const { error: e2 } = await sb().from('vistorias_atividades').delete().eq('id', atividadeId);
      if (e2) throw e2;
    },

    /* Casa os campos "esperado" digitados pelo operador no Despacho com as
       perguntas reais do questionário (por texto — cada questionário tem
       seu próprio pergunta_id, então não dá pra fixar UUID). Só grava o
       que o operador realmente preencheu; sem match (ex.: questionário
       diferente do de elevador), ignora em silêncio esse campo. */
    MEDIDAS_PROJETO_MAP: [
      { campo: 'hw', texto: 'Largura esperada da caixa de corrida, conforme projeto (mm)' },
      { campo: 'hd', texto: 'Profundidade esperada da caixa de corrida, conforme projeto (mm)' },
      { campo: 's', texto: 'Profundidade esperada do poço, conforme projeto (mm)' },
      { campo: 'p', texto: 'Percurso total esperado, conforme projeto (mm)' },
      { campo: 'sow', texto: 'Largura esperada do vão de portas, conforme projeto (mm)' },
      { campo: 'soh', texto: 'Altura esperada do vão de portas, conforme projeto (mm)' },
      { campo: 'gancho', texto: 'Capacidade esperada do gancho de içamento, conforme projeto (kg)' },
      { campo: 'viga', texto: 'Viga intermediária — seção esperada, conforme projeto (ex.: 300x200mm)' },
    ],
    async preencherMedidasProjeto(atividadeId, questionarioId, medidas) {
      const preenchidos = Object.entries(medidas || {}).filter(([, v]) => v !== '' && v != null);
      if (!preenchidos.length) return;
      const estrutura = await this.carregarEstrutura(questionarioId);
      const porTexto = {};
      estrutura.forEach((c) => c.perguntas.forEach((p) => { porTexto[p.texto] = p.id; }));
      const linhas = [];
      preenchidos.forEach(([campo, valor]) => {
        const item = this.MEDIDAS_PROJETO_MAP.find((m) => m.campo === campo);
        const perguntaId = item && porTexto[item.texto];
        if (perguntaId) linhas.push({ atividade_id: atividadeId, pergunta_id: perguntaId, pavimento_index: 0, valor: String(valor) });
      });
      if (!linhas.length) return;
      const { error } = await sb().from('vistorias_respostas')
        .upsert(linhas, { onConflict: 'atividade_id,pergunta_id,pavimento_index' });
      if (error) throw error;
    },

    /* Igual preencherMedidasProjeto, mas pra medidas que variam por
       pavimento (entre-pisos) — cada pavimento intermediário grava sua
       própria linha em pavimento_index; última parada/overhead são
       únicos (pavimento_index 0), da categoria "Último Piso". */
    async preencherMedidasPorPavimento(atividadeId, questionarioId, { entrePisos, ultimaParada, overhead } = {}) {
      const estrutura = await this.carregarEstrutura(questionarioId);
      const porTexto = {};
      estrutura.forEach((c) => c.perguntas.forEach((p) => { porTexto[p.texto] = p.id; }));
      const linhas = [];
      const idEntrePisos = porTexto['Percurso esperado desta parada, conforme projeto (mm)'];
      if (idEntrePisos && entrePisos) {
        Object.entries(entrePisos).forEach(([pav, valor]) => {
          if (valor !== '' && valor != null) linhas.push({ atividade_id: atividadeId, pergunta_id: idEntrePisos, pavimento_index: parseInt(pav, 10), valor: String(valor) });
        });
      }
      const idUltima = porTexto['Percurso esperado da última parada, conforme projeto (mm)'];
      if (idUltima && ultimaParada) linhas.push({ atividade_id: atividadeId, pergunta_id: idUltima, pavimento_index: 0, valor: String(ultimaParada) });
      const idOverhead = porTexto['Overhead esperado, conforme projeto (mm)'];
      if (idOverhead && overhead) linhas.push({ atividade_id: atividadeId, pergunta_id: idOverhead, pavimento_index: 0, valor: String(overhead) });
      if (!linhas.length) return;
      const { error } = await sb().from('vistorias_respostas')
        .upsert(linhas, { onConflict: 'atividade_id,pergunta_id,pavimento_index' });
      if (error) throw error;
    },

    /* ---- Atividades (Fase 2: despacho) ----
       O token vira o link mandado pro técnico; a página que ele abre
       (execução no celular) é a Fase 3, ainda não construída. */
    async criarAtividade({ questionarioId, dossierId, equipamentoId, tecnicoId, agendadoPara, paradas }) {
      const token = (window.crypto?.randomUUID ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
      const { count, error: eCount } = await sb().from('vistorias_atividades')
        .select('id', { count: 'exact', head: true }).eq('dossier_id', dossierId);
      if (eCount) throw eCount;
      const { data, error } = await sb().from('vistorias_atividades').insert({
        questionario_id: questionarioId,
        dossier_id: dossierId,
        equipamento_id: equipamentoId || null,
        tecnico_id: tecnicoId || null,
        agendado_para: agendadoPara || null,
        paradas: paradas || null,
        numero_sequencial: (count || 0) + 1,
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
        .select('*, dossier_obra(id, client_name, building_name, numero_cotacao), equipamentos_obra(numero_serie), colaboradores_vpsistema(nome), vistorias_questionarios(nome)')
        .order('criado_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },

    /* ---- Calendário/Agenda (Módulo ADM) — todas as atividades com data marcada ---- */
    async listarAtividadesAgendadas() {
      const { data, error } = await sb().from('vistorias_atividades')
        .select('*, dossier_obra(id, client_name, building_name, numero_cotacao), equipamentos_obra(numero_serie), colaboradores_vpsistema(nome), vistorias_questionarios(nome)')
        .not('agendado_para', 'is', null)
        .order('agendado_para', { ascending: true });
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
      const OBRA_SELECT = 'id, client_name, building_name, city, state, numero_cotacao, equip_type';

      let obra = null;
      if (parsed) {
        const { data, error } = await sb().from('dossier_obra')
          .select(OBRA_SELECT).eq('numero_cotacao', parsed.numero).maybeSingle();
        if (error) throw error;
        obra = data;
      }

      /* Fallback pra obras legadas (migradas direto pro dossier_obra, nunca
         passaram pelo funil Lead->Formulário->Cotação->Proposta — não têm
         numero_cotacao porque nunca existiu cotação nenhuma pra elas).
         Aceita o ID interno da obra (ex.: "DOS-M045") como o próprio Master
         ID. Sem cotação, não há como buscar specs em formularios_elevador. */
      if (!obra) {
        const s = String(raw || '').trim();
        const { data, error } = await sb().from('dossier_obra')
          .select(OBRA_SELECT).in('id', [s, s.toUpperCase()]).limit(1).maybeSingle();
        if (error) throw error;
        obra = data;
      }

      /* Fallback pra quando o operador digita o nº de série do equipamento
         (ex.: "500.0371") em vez de um Master ID — comum, já que é o que
         está gravado na placa/plaqueta do equipamento em campo. */
      if (!obra) {
        const s = String(raw || '').trim();
        const { data: equipData, error: eEquip } = await sb().from('equipamentos_obra')
          .select('dossier_id').ilike('numero_serie', s).limit(2);
        if (eEquip) throw eEquip;
        if ((equipData || []).length === 1) {
          const { data, error } = await sb().from('dossier_obra').select(OBRA_SELECT).eq('id', equipData[0].dossier_id).maybeSingle();
          if (error) throw error;
          obra = data;
        } else if ((equipData || []).length > 1) {
          throw new Error(`Mais de um equipamento com nº de série "${raw}" — busque pela obra em vez disso.`);
        }
      }

      /* Fallback final: nome do cliente ou da obra (busca parcial,
         sem acentuação/case). Só resolve sozinho quando dá exatamente 1
         resultado — com mais de um, pede pra refinar em vez de arriscar
         escolher a obra errada. */
      if (!obra) {
        const s = String(raw || '').trim();
        const { data: candidatos, error } = await sb().from('dossier_obra')
          .select(OBRA_SELECT).or(`client_name.ilike.%${s}%,building_name.ilike.%${s}%`).limit(6);
        if (error) throw error;
        if ((candidatos || []).length === 1) {
          obra = candidatos[0];
        } else if ((candidatos || []).length > 1) {
          const nomes = candidatos.map((o) => `${o.client_name} — ${o.building_name || o.id}`).join('; ');
          throw new Error(`${candidatos.length} obras encontradas pra "${raw}": ${nomes}. Escolha direto no campo Obra.`);
        }
      }

      if (!obra) throw new Error(`Nenhuma obra encontrada para "${raw}"`);

      let unidade = null;
      if (parsed && parsed.indiceAtivo != null) {
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
