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
      if (window.EventosFluxo) window.EventosFluxo.registrar({
        evento: 'DOSSIE_CRIADO', numeroCotacao: data?.[0]?.numero_cotacao ?? null, alvoLabel: lead.building, alvoId: id,
      });
      return { id, ...data?.[0] };
    },

    /* ---- Criar Dossier a partir de uma Proposta aprovada ----
       Pedido do usuário 19/08: mesma lógica de "Formulário gera Proposta
       sozinho" — agora "Proposta ganha gera Obra sozinha". Chamado por
       PropostaStore.markSigned() assim que o cliente assina. Idempotente
       por numero_cotacao — reabrir/reassinar não duplica o Dossiê. */
    async criarDeProposta(proposta) {
      if (!proposta || proposta.numero_cotacao == null) return null;
      const { data: existente } = await sb.from('dossier_obra')
        .select('id').eq('numero_cotacao', proposta.numero_cotacao).maybeSingle();
      if (existente) return existente;

      const dj = proposta.data_json || {};
      const cliente = dj.cliente || {};
      const obra = dj.obra || {};
      const id = 'DOS-' + Date.now().toString().slice(-6);

      const { error } = await sb.from('dossier_obra').insert({
        id,
        client_name: cliente.nome || proposta.titulo || 'Cliente',
        building_name: obra.nome || proposta.titulo || '—',
        city: obra.cidade || null,
        state: obra.uf || null,
        equip_type: proposta.proposal_type || null,
        numero_cotacao: proposta.numero_cotacao,
        status_master: 'Contrato assinado',
        created_by: window.__VP_USER?.email || 'system',
      });
      if (error) throw error;
      await this.registrarHistorico(id, 'Proposta enviada', 'Contrato assinado', 'Proposta aprovada e assinada pelo cliente — Dossiê da Obra criado automaticamente');
      if (window.EventosFluxo) window.EventosFluxo.registrar({
        evento: 'DOSSIE_CRIADO', numeroCotacao: proposta.numero_cotacao, alvoLabel: obra.nome || proposta.titulo, alvoId: id,
      });
      return { id };
    },

    /* ---- Buscar Dossier com todas as relações ---- */
    async obter(dossierId) {
      const { data: dossier, error: errDossier } = await sb
        .from('dossier_obra')
        .select('*, clientes(id, razao_social, nome_fantasia)')
        .eq('id', dossierId)
        .single();

      if (errDossier) throw errDossier;

      let propostaVinculada = null;
      if (dossier.proposta_id) {
        const { data: p } = await sb.from('propostas')
          .select('id, numero_documento, titulo, status')
          .eq('id', dossier.proposta_id).maybeSingle();
        propostaVinculada = p || null;
      }

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

      const { data: analiseTecnica } = await sb.from('analise_tecnica')
        .select('*')
        .eq('dossier_id', dossierId)
        .maybeSingle();

      return {
        ...dossier,
        propostaVinculada,
        documentos: documentos || [],
        pendencias: pendencias || [],
        responsaveis: responsaveis || [],
        historico: historico || [],
        analiseTecnica: analiseTecnica || null
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
      if (window.EventosFluxo) {
        if (novoStatus === 'Instalação') window.EventosFluxo.registrar({
          evento: 'INSTALACAO_INICIADA', numeroCotacao: dossier.numero_cotacao, alvoLabel: dossier.building_name, alvoId: dossierId,
        });
        if (novoStatus === 'DataBook') window.EventosFluxo.registrar({
          evento: 'INSTALACAO_CONCLUIDA', numeroCotacao: dossier.numero_cotacao, alvoLabel: dossier.building_name, alvoId: dossierId,
        });
      }
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

    /* ---- Vincular obra a um cliente do Cadastro (client_name é texto
       livre, sem ligação nenhuma com a tabela clientes — esse é o
       vínculo manual, já que os nomes raramente batem sozinhos) ---- */
    async vincularCliente(dossierId, clienteId) {
      const { error } = await sb.from('dossier_obra')
        .update({ cliente_id: clienteId || null, updated_at: new Date().toISOString() }).eq('id', dossierId);
      if (error) throw error;
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
      const { data: pend, error } = await sb.from('dossier_pendencias')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: resolvePor || window.__VP_USER?.email || 'system'
        })
        .eq('id', pendenciaId).select().single();

      if (error) throw error;
      if (window.EventosFluxo && pend?.dossier_id) {
        const { data: dossier } = await sb.from('dossier_obra').select('numero_cotacao, building_name').eq('id', pend.dossier_id).maybeSingle();
        window.EventosFluxo.registrar({
          evento: 'PENDENCIA_RESOLVIDA', numeroCotacao: dossier?.numero_cotacao ?? null,
          alvoLabel: dossier?.building_name, alvoId: pend.dossier_id,
        });
      }
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

    /* ---- Anexar documento com upload de arquivo (Storage) ----
       Sobe o PDF pro bucket público `engenharia` sob dossier-documentos/<id>
       e grava a linha em dossier_documentos com arquivo_url. */
    async anexarDocumento({ dossierId, tipo, file, nome, valor }) {
      if (!file) throw new Error('Nenhum arquivo selecionado.');
      const id = 'DOC-' + Date.now().toString().slice(-6);
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `dossier-documentos/${dossierId}/${id}.${ext}`;
      const { error: upErr } = await sb.storage.from('engenharia')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from('engenharia').getPublicUrl(path);
      const { error } = await sb.from('dossier_documentos').insert({
        id,
        dossier_id: dossierId,
        tipo,
        nome: nome || file.name,
        status: 'anexado',
        responsavel: window.__VP_USER?.email || 'system',
        data_criacao: new Date().toISOString().split('T')[0],
        arquivo_url: pub?.publicUrl || null,
        valor: valor != null ? Number(valor) : null,
        metadata: { filename: file.name, size: file.size, path }
      });
      if (error) throw error;
      if (tipo === 'ART' || tipo === 'DataBook') {
        const { data: dossier } = await sb.from('dossier_obra').select('numero_cotacao, building_name').eq('id', dossierId).maybeSingle();
        if (window.EventosFluxo) window.EventosFluxo.registrar({
          evento: tipo === 'ART' ? 'ART_EMITIDA' : 'DATABOOK_MONTADO',
          numeroCotacao: dossier?.numero_cotacao ?? null, alvoLabel: dossier?.building_name, alvoId: dossierId,
        });
        if (tipo === 'ART' && valor != null && window.AvalFinanceiroStore && dossier?.numero_cotacao != null) {
          window.AvalFinanceiroStore.registrarCustoReal({
            numeroCotacao: dossier.numero_cotacao, origem: 'art',
            descricao: 'ART — ' + (dossier.building_name || dossierId), valor,
          });
        }
      }
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
      let query = sb.from('dossier_obra').select('*, parceiros_instaladores(nome)');

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
    },

    /* ---- Equipamentos da obra ----
       Pedido do usuário 19/08: campos da planilha manual de Instalações
       (Mauricio) que não existiam estruturados em lugar nenhum — nº de
       série, ART, alvará (instalação/funcionamento) com datas reais de
       início/término, prazo de instalação, previsão × real, chegada de
       material. Um equipamento por linha (obra pode ter mais de um
       elevador/escada). parceiro_instalador_id aponta pro cadastro único
       em Cadastros › Instaladores (parceiros_instaladores) — nunca texto
       livre, pra não repetir a fragmentação que já existia em Vistorias/
       Cronograma/Contrato Instalador. */
    async listarEquipamentos(dossierId) {
      const { data, error } = await sb.from('equipamentos_obra')
        .select('*, parceiros_instaladores(id, nome)')
        .eq('dossier_id', dossierId).order('criado_em', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /* Equipamentos de outros dossiês do MESMO cliente — cada obra migrada é
       1 equipamento por dossiê (issue real: cliente com 9 elevadores vira
       9 dossiê separados), então quem está vendo um deles não enxergava os
       "irmãos". Só leitura aqui — editar continua sendo por dossiê. */
    async listarEquipamentosDoCliente(clientName, excludeDossierId) {
      if (!clientName) return [];
      const { data: siblings } = await sb.from('dossier_obra')
        .select('id, building_name').eq('client_name', clientName);
      const ids = (siblings || []).map((s) => s.id).filter((id) => id !== excludeDossierId);
      if (ids.length === 0) return [];
      const { data: equipamentos } = await sb.from('equipamentos_obra')
        .select('*, parceiros_instaladores(id, nome)').in('dossier_id', ids);
      const buildingById = {};
      (siblings || []).forEach((s) => { buildingById[s.id] = s.building_name; });
      return (equipamentos || []).map((e) => ({ ...e, dossier_building_name: buildingById[e.dossier_id] }));
    },

    /* Empresas que passaram pela obra — cadastro simples (obra ↔ empresa,
       N pra N), separado de qual equipamento cada uma montou. "Quantas
       empresas forem necessárias", sem exigir escolher equipamento. */
    async listarInstaladoresRoster(dossierId) {
      const { data, error } = await sb.from('dossier_obra_instaladores')
        .select('id, parceiro_instalador_id, vinculado_em, vinculado_por, parceiros_instaladores(id, nome)')
        .eq('dossier_id', dossierId).order('vinculado_em', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async vincularInstaladorRoster(dossierId, parceiroId) {
      const id = 'DOI-' + Date.now().toString().slice(-8);
      const { error } = await sb.from('dossier_obra_instaladores').insert({
        id, dossier_id: dossierId, parceiro_instalador_id: parceiroId,
        vinculado_por: window.__VP_USER?.email || 'system',
      });
      if (error) throw error;
      return id;
    },

    async removerInstaladorRoster(id) {
      const { error } = await sb.from('dossier_obra_instaladores').delete().eq('id', id);
      if (error) throw error;
    },

    async criarEquipamento(dossierId, campos) {
      const id = 'EQO-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('equipamentos_obra').insert({
        id, dossier_id: dossierId, ...campos,
        criado_por: window.__VP_USER?.email || 'system',
      });
      if (error) throw error;
      return id;
    },

    async atualizarEquipamento(id, patch) {
      const { error } = await sb.from('equipamentos_obra')
        .update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },

    async excluirEquipamento(id) {
      const { error } = await sb.from('equipamentos_obra').delete().eq('id', id);
      if (error) throw error;
    },
  };
})();
