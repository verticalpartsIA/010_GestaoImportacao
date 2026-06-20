/* ============================================================
   analise-tecnica-store.js — State management para Análise Técnica
   Gerencia variáveis técnicas obrigatórias antes de Precificação
   ============================================================ */

window.__ANALISE_TECNICA = window.__ANALISE_TECNICA || (() => {
  const sb = window.__VP_SB?.sb;
  if (!sb) { console.warn('Supabase não carregado'); return {}; }

  return {
    EQUIP_TYPES: ['elevador', 'escada', 'esteira'],
    ABERTURA_OPTS: ['Central', 'Telescópica Direita', 'Telescópica Esquerda'],
    MUNCK_OPTS: ['nenhum', '1-munck', '2-munks'],
    STATUS_FLOW: ['rascunho', 'pendente_cliente', 'completa', 'aprovada'],

    /* ---- Criar nova análise técnica ---- */
    async criar(dossierId, equip_type) {
      if (!dossierId || !equip_type) {
        throw new Error('Dossier ID e tipo de equipamento são obrigatórios');
      }

      const id = 'ANA-' + Date.now().toString().slice(-6);
      const { data, error } = await sb.from('analise_tecnica').insert({
        id,
        dossier_id: dossierId,
        tipo_equipamento: equip_type,
        status: 'rascunho',
        responsavel: window.__VP_USER?.email || 'system'
      });

      if (error) throw error;
      return { id, ...data?.[0] };
    },

    /* ---- Obter análise com pendências ---- */
    async obter(analiseId) {
      const { data: analise, error: errAnalise } = await sb
        .from('analise_tecnica')
        .select('*')
        .eq('id', analiseId)
        .single();

      if (errAnalise) throw errAnalise;

      const { data: pendencias } = await sb
        .from('analise_tecnica_pendencias_cliente')
        .select('*')
        .eq('analise_tecnica_id', analiseId);

      return {
        ...analise,
        pendencias_cliente: pendencias || []
      };
    },

    /* ---- Atualizar campos da análise ---- */
    async atualizar(analiseId, updates) {
      const { error } = await sb.from('analise_tecnica')
        .update({
          ...updates,
          data_atualizacao: new Date().toISOString()
        })
        .eq('id', analiseId);

      if (error) throw error;
    },

    /* ---- Validar preenchimento obrigatório ---- */
    validarObrigatorios(analise) {
      const erros = [];

      if (!analise.tipo_equipamento) erros.push('Tipo de equipamento');
      if (!analise.cidade_obra) erros.push('Cidade da obra');
      if (!analise.estado_obra) erros.push('Estado da obra');
      if (analise.distancia_santos_km === null || analise.distancia_santos_km === undefined) {
        erros.push('Distância Santos → obra');
      }

      // Específicos para elevador
      if (analise.tipo_equipamento === 'elevador') {
        if (!analise.paradas) erros.push('Número de paradas (elevador)');
        if (!analise.carga_kg) erros.push('Carga em kg (elevador)');
        if (!analise.abertura) erros.push('Tipo de abertura (elevador)');
        if (!analise.vao_cm) erros.push('Vão de porta em cm (elevador)');
      }

      if (analise.necessidade_munck === null || analise.necessidade_munck === undefined) {
        erros.push('Necessidade de munck');
      }
      if (!analise.dias_instalacao_est) erros.push('Dias estimados de instalação');
      if (analise.vistorias_inclusas === null || analise.vistorias_inclusas === undefined) {
        erros.push('Vistorias inclusas');
      }

      // Pendências com cliente
      if (analise.pendencia_cliente_desc && !analise.data_resolucao_cliente) {
        erros.push('Pendência do cliente ainda não resolvida');
      }

      return {
        valido: erros.length === 0,
        erros: erros
      };
    },

    /* ---- Marcar como completa (após preencher obrigatórios) ---- */
    async marcarCompleta(analiseId) {
      const analise = await this.obter(analiseId);
      const validacao = this.validarObrigatorios(analise);

      if (!validacao.valido) {
        throw new Error('Campos obrigatórios faltando: ' + validacao.erros.join(', '));
      }

      await this.atualizar(analiseId, {
        status: 'completa',
        data_atualizacao: new Date().toISOString()
      });

      // Registra histórico
      await this.registrarHistorico(analiseId, 'rascunho', 'completa', 'Análise marcada como completa');
    },

    /* ---- Aprovar análise (Engenharia) ---- */
    async aprovar(analiseId, notas = '') {
      const analise = await this.obter(analiseId);
      const validacao = this.validarObrigatorios(analise);

      if (!validacao.valido) {
        throw new Error('Não é possível aprovar. Campos faltando: ' + validacao.erros.join(', '));
      }

      await this.atualizar(analiseId, {
        status: 'aprovada',
        data_aprovacao: new Date().toISOString(),
        aprovado_por: window.__VP_USER?.email || 'system',
        versao: (analise.versao || 0) + 1
      });

      // Registra histórico
      await this.registrarHistorico(analiseId, 'completa', 'aprovada', notas || 'Análise aprovada');

      // Atualiza Dossier para próxima etapa
      if (analise.dossier_id) {
        await window.__DOSSIER.atualizarStatus(analise.dossier_id, 'Precificação', 'Análise técnica aprovada');
      }
    },

    /* ---- Registrar alteração no histórico ---- */
    async registrarHistorico(analiseId, statusFrom, statusTo, notas = '') {
      const analise = await this.obter(analiseId);
      const historico = analise.historico || [];

      const novaEntrada = {
        timestamp: new Date().toISOString(),
        status_from: statusFrom,
        status_to: statusTo,
        actor: window.__VP_USER?.email || 'system',
        notas: notas || null
      };

      historico.push(novaEntrada);

      await sb.from('analise_tecnica')
        .update({ historico })
        .eq('id', analiseId);
    },

    /* ---- Adicionar pendência do cliente ---- */
    async adicionarPendenciaCliente(analiseId, descricao) {
      const id = 'PEND-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('analise_tecnica_pendencias_cliente').insert({
        id,
        analise_tecnica_id: analiseId,
        descricao,
        marcado_como_pendente: true
      });

      if (error) throw error;

      await this.atualizar(analiseId, {
        status: 'pendente_cliente'
      });

      return id;
    },

    /* ---- Resolver pendência do cliente ---- */
    async resolverPendencia(pendenciaId) {
      const { error } = await sb.from('analise_tecnica_pendencias_cliente')
        .update({
          resolvido_em: new Date().toISOString(),
          marcado_como_pendente: false
        })
        .eq('id', pendenciaId);

      if (error) throw error;
    },

    /* ---- Calcular variáveis derivadas (auxiliar) ---- */
    calcularVariaveisDerivadas(analise) {
      return {
        // Frete interno baseado em distância
        categoria_frete: analise.distancia_santos_km > 500 ? 'longaDist' :
                         analise.distancia_santos_km > 100 ? 'mediaDist' : 'curtaDist',

        // Necessidade de supervisor
        supervisor_necessario: analise.necessidade_supervisor === true,

        // Custo de hospedagem
        dias_hospedagem: analise.hospedagem_necessaria ? analise.dias_hospedagem_est || 1 : 0,

        // Vistorias avulsas (após as 3 inclusas)
        cobranca_vistorias_avulsas: analise.vistorias_inclusas > 3
      };
    }
  };
})();
