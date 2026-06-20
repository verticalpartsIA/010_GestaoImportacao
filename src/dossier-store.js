/* ============================================================
   dossier-store.js — State management para Dossier da Obra
   Centraliza lógica de CRUD, transições de status, histórico
   ============================================================ */

window.__DOSSIER = window.__DOSSIER || (() => {
  const sb = window.__VP_SB?.sb;
  if (!sb) { console.warn('Supabase não carregado'); return {}; }

  const EQUIP_TYPES = ['elevador', 'escada', 'esteira'];
  const STATUS_FLOW = [
    'Lead qualificado',
    'Dossier criado',
    'Análise técnica',
    'Precificação',
    'Proposta enviada',
    'Contrato assinado',
    'Importação',
    'Homologação instalador',
    'Instalação',
    'DataBook',
    'Entregue',
    'Manutenção preventiva'
  ];

  return {
    EQUIP_TYPES,
    STATUS_FLOW,

    /* ---- Criar novo Dossier a partir de um Lead ---- */
    async criarDeDossier(lead) {
      if (!lead || !lead.id || !lead.building) {
        throw new Error('Lead inválido para criar Dossier');
      }

      const id = 'DOS-' + Date.now().toString().slice(-6);
      const [clientName] = (lead.contact || lead.building).split(/[,;]/);

      const { data, error } = await sb.from('dossier_obra').insert({
        id,
        lead_id: lead.id,
        client_name: clientName.trim(),
        building_name: lead.building,
        equip_type: lead.equip?.split('·')[0]?.toLowerCase()?.trim() || null,
        status_master: 'Dossier criado',
        created_by: window.__VP_USER?.email || 'system'
      });

      if (error) throw error;
      await this.registrarHistorico(id, 'Lead qualificado', 'Dossier criado', 'Criação automática');
      return { id, ...data?.[0] };
    },

    /* ---- Buscar Dossier com todas as relações ---- */
    async obter(dossierId) {
      const { data: dossier, error: errDossier } = await sb
        .from('dossier_obra')
        .select('*')
        .eq('id', dossierId)
        .single();

      if (errDossier) throw errDossier;

      const { data: documentos } = await sb.from('dossier_documentos')
        .select('*')
        .eq('dossier_id', dossierId)
        .order('created_at', { ascending: false });

      const { data: pendencias } = await sb.from('dossier_pendencias')
        .select('*')
        .eq('dossier_id', dossierId)
        .order('created_at', { ascending: false });

      const { data: responsaveis } = await sb.from('dossier_responsaveis')
        .select('*')
        .eq('dossier_id', dossierId);

      const { data: historico } = await sb.from('dossier_history')
        .select('*')
        .eq('dossier_id', dossierId)
        .order('created_at', { ascending: false })
        .limit(20);

      return {
        ...dossier,
        documentos: documentos || [],
        pendencias: pendencias || [],
        responsaveis: responsaveis || [],
        historico: historico || []
      };
    },

    /* ---- Atualizar status mestre + registra transição ---- */
    async atualizarStatus(dossierId, novoStatus, notas = '') {
      if (!STATUS_FLOW.includes(novoStatus)) {
        throw new Error(`Status inválido: ${novoStatus}`);
      }

      const dossier = await this.obter(dossierId);
      const statusAnterior = dossier.status_master;

      if (statusAnterior === novoStatus) {
        return; // nada a fazer
      }

      const { error } = await sb.from('dossier_obra')
        .update({
          status_master: novoStatus,
          updated_at: new Date().toISOString(),
          updated_by: window.__VP_USER?.email || 'system'
        })
        .eq('id', dossierId);

      if (error) throw error;
      await this.registrarHistorico(dossierId, statusAnterior, novoStatus, notas);
    },

    /* ---- Registrar no histórico ---- */
    async registrarHistorico(dossierId, statusFrom, statusTo, notas = '') {
      const id = 'HIS-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('dossier_history').insert({
        id,
        dossier_id: dossierId,
        status_from: statusFrom || null,
        status_to: statusTo,
        actor: window.__VP_USER?.email || 'system',
        notes: notas || null
      });

      if (error) console.error('Erro ao registrar histórico:', error);
    },

    /* ---- Atribuir responsável por etapa ---- */
    async atribuirResponsavel(dossierId, etapa, responsavel, notas = '') {
      if (!['comercial', 'engenharia', 'financeiro', 'juridico', 'rh', 'instalacao'].includes(etapa)) {
        throw new Error(`Etapa inválida: ${etapa}`);
      }

      const id = 'RESP-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('dossier_responsaveis').insert({
        id,
        dossier_id: dossierId,
        etapa,
        responsavel,
        notes: notas || null
      });

      if (error) throw error;
    },

    /* ---- Adicionar pendência (cliente/interno/externo) ---- */
    async adicionarPendencia(dossierId, tipo, descricao, etapa = null, bloqueante = false) {
      if (!['cliente', 'interno', 'externo'].includes(tipo)) {
        throw new Error(`Tipo de pendência inválido: ${tipo}`);
      }

      const id = 'PND-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('dossier_pendencias').insert({
        id,
        dossier_id: dossierId,
        tipo,
        descricao,
        etapa: etapa || null,
        bloqueante
      });

      if (error) throw error;
      return id;
    },

    /* ---- Resolver pendência ---- */
    async resolverPendencia(pendenciaId, resolvePor = null) {
      const { error } = await sb.from('dossier_pendencias')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: resolvePor || window.__VP_USER?.email || 'system'
        })
        .eq('id', pendenciaId);

      if (error) throw error;
    },

    /* ---- Vincular documento (proposta/contrato/etc) ---- */
    async vincularDocumento(dossierId, tipo, nome, referencia = {}) {
      const id = 'DOC-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('dossier_documentos').insert({
        id,
        dossier_id: dossierId,
        tipo,
        nome,
        responsavel: window.__VP_USER?.email || 'system',
        data_criacao: new Date().toISOString().split('T')[0],
        metadata: referencia
      });

      if (error) throw error;
      return id;
    },

    /* ---- Atualizar status de documento ---- */
    async atualizarDocumento(docId, updates) {
      const { error } = await sb.from('dossier_documentos')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          data_atualizacao: new Date().toISOString().split('T')[0]
        })
        .eq('id', docId);

      if (error) throw error;
    },

    /* ---- Listar dossiers com filtro ---- */
    async listar(filtros = {}) {
      let query = sb.from('dossier_obra').select('*');

      if (filtros.status_master) {
        query = query.eq('status_master', filtros.status_master);
      }
      if (filtros.equip_type) {
        query = query.eq('equip_type', filtros.equip_type);
      }
      if (filtros.city) {
        query = query.eq('city', filtros.city);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  };
})();
