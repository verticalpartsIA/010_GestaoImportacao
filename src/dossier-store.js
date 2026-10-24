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
      }).select();

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
      /* Auditoria de 11/10: o dossiê nascido aqui não guardava proposta_id/cliente_id/lead_id (Status da Obra nunca achava
         a proposta; "Vida do Cliente" nunca achava a obra) e ignorava o dossiê que o vendedor já tinha criado pelo Lead
         ("Qualificar → Dossier"), gerando 2 dossiês da mesma obra. Agora: (1) dossiê da cotação existe → só completa os
         vínculos que faltam; (2) existe dossiê do mesmo Lead ainda sem cotação → adota esse; (3) senão cria, já com os
         vínculos. Nunca sobrescreve um vínculo já preenchido. */
      const { data: forms } = await sb.from('formularios_elevador')
        .select('lead_id, cliente_id').eq('numero_cotacao', proposta.numero_cotacao).limit(1);
      const form = (forms || [])[0] || {};
      const vinc = { proposta_id: proposta.id || null, cliente_id: proposta.cliente_id || form.cliente_id || null, lead_id: form.lead_id || null };
      const obraProp = (proposta.data_json || {}).obra || {};
      const completar = async (existente) => {
        const patch = {};
        Object.keys(vinc).forEach((k) => { if (vinc[k] && !existente[k]) patch[k] = vinc[k]; });
        /* Endereço da obra (19/10/2026): só preenche dossiê que ainda não tem endereço. */
        if (!existente.endereco_logradouro && obraProp.endereco) {
          patch.endereco_logradouro = obraProp.endereco;
          if (obraProp.numero) patch.endereco_numero = obraProp.numero;
          if (obraProp.bairro) patch.endereco_bairro = obraProp.bairro;
          const cepObra = String(obraProp.cep || '').replace(/\D/g, '');
          if (cepObra) patch.endereco_cep = cepObra;
        }
        if (Object.keys(patch).length) {
          const { error } = await sb.from('dossier_obra').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existente.id);
          if (error) console.warn('[DossierStore] vínculos do dossiê não completados', error);
        }
        return { id: existente.id };
      };

      /* limit(1) em vez de maybeSingle(): com 2+ dossiês pra mesma cotação o
         maybeSingle() dava erro e `existente` ficava undefined — criava um
         terceiro. */
      const { data: existentes } = await sb.from('dossier_obra')
        .select('id, proposta_id, cliente_id, lead_id, endereco_logradouro').eq('numero_cotacao', proposta.numero_cotacao).order('created_at', { ascending: true }).limit(1);
      if (existentes && existentes.length) return completar(existentes[0]);

      if (vinc.lead_id) {
        const { data: doLead } = await sb.from('dossier_obra')
          .select('id, proposta_id, cliente_id, lead_id, status_master, endereco_logradouro').eq('lead_id', vinc.lead_id).is('numero_cotacao', null)
          .order('created_at', { ascending: true }).limit(1);
        if (doLead && doLead.length) {
          const d = doLead[0];
          const { error } = await sb.from('dossier_obra').update({ numero_cotacao: proposta.numero_cotacao, status_master: 'Contrato assinado', updated_at: new Date().toISOString() }).eq('id', d.id);
          if (error) throw error;
          await completar(d);
          await this.registrarHistorico(d.id, d.status_master || 'Dossier criado', 'Contrato assinado', `Proposta da cotação Nº ${proposta.numero_cotacao} assinada — dossiê do Lead ligado à cotação`);
          if (window.EventosFluxo) window.EventosFluxo.registrar({
            evento: 'DOSSIE_CRIADO', numeroCotacao: proposta.numero_cotacao, alvoLabel: proposta.titulo || d.id, alvoId: d.id,
          });
          return { id: d.id };
        }
      }

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
        endereco_logradouro: obra.endereco || null,
        endereco_numero: obra.numero || null,
        endereco_bairro: obra.bairro || null,
        endereco_cep: String(obra.cep || '').replace(/\D/g, '') || null,
        equip_type: proposta.proposal_type || null,
        numero_cotacao: proposta.numero_cotacao,
        proposta_id: vinc.proposta_id,
        cliente_id: vinc.cliente_id,
        lead_id: vinc.lead_id,
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

    /* ---- Endereço completo da obra (19/10/2026) ----
       Grava rua/número/complemento/bairro/CEP/cidade/UF. A posição no mapa
       (latitude/longitude) é apagada pelo banco quando o endereço muda
       (trg_dossier_obra_limpa_geo) e o Mapa de Obras a refaz. */
    async atualizarEndereco(dossierId, e = {}) {
      const limpa = (v) => { const t = String(v == null ? '' : v).trim(); return t || null; };
      const cep = String(e.cep || '').replace(/\D/g, '');
      if (cep && cep.length !== 8) throw new Error('CEP precisa ter 8 dígitos.');
      const uf = limpa(e.uf);
      if (uf && !/^[A-Za-z]{2}$/.test(uf)) throw new Error('UF precisa ter 2 letras (ex.: SP).');
      if (!limpa(e.cidade)) throw new Error('Informe a cidade da obra.');
      const patch = {
        endereco_logradouro: limpa(e.logradouro),
        endereco_numero: limpa(e.numero),
        endereco_complemento: limpa(e.complemento),
        endereco_bairro: limpa(e.bairro),
        endereco_cep: cep || null,
        city: limpa(e.cidade),
        state: uf ? uf.toUpperCase() : null,
        updated_at: new Date().toISOString(),
        updated_by: window.__VP_USER?.email || null,
      };
      const { data, error } = await sb.from('dossier_obra').update(patch).eq('id', dossierId).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('O dossiê não foi alterado (sem permissão ou não encontrado).');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Dossiê da Obra', acao: 'Atualizou o endereço da obra', alvo: dossierId, alvo_id: dossierId });
      return patch;
    },

    /* Posição no mapa: gravada pelo Mapa de Obras ao localizar o endereço, ou à mão. */
    async salvarPosicao(dossierId, lat, lon, precisao) {
      const { error } = await sb.from('dossier_obra').update({
        latitude: lat, longitude: lon, geo_precisao: precisao, geo_atualizado_em: new Date().toISOString(),
      }).eq('id', dossierId);
      if (error) throw error;
    },

    /* ---- Pausa de obra (25/10/2026) ----
       "Pausada até dd/mm" + motivo: a obra sai da cobrança diária de previsão/Diário da Evolução até a data.
       Quem decide é o banco (função evolucao_pausar_obra: alçada mapa-obras.pausar, motivo >= 10 letras, até 60 dias).
       ate = null cancela a pausa (o histórico fica). */
    async pausarObra(dossierId, ate, motivo) {
      const m = String(motivo || '').trim();
      if (ate) {
        if (m.length < 10) throw new Error('Informe o motivo da pausa (mínimo 10 letras).');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new Error('Informe a data até quando a obra fica pausada.');
      }
      const { error } = await sb.rpc('evolucao_pausar_obra', { p_dossier: dossierId, p_ate: ate || null, p_motivo: ate ? m : null });
      if (error) throw new Error(error.message || 'Não foi possível salvar a pausa.');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Dossiê da Obra', acao: ate ? 'Pausou a obra' : 'Cancelou a pausa da obra', alvo: dossierId, alvo_id: dossierId, detalhe: ate ? { ate, motivo: m } : null });
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

    /* ---- Atribuir responsável por etapa (upsert: "Alterar" substitui o
       responsável da mesma etapa em vez de duplicar linha — onConflict
       dossier_id,etapa) ---- */
    async atribuirResponsavel(dossierId, etapa, responsavel, notas = '') {
      if (!['comercial', 'engenharia', 'financeiro', 'juridico', 'rh', 'instalacao'].includes(etapa)) {
        throw new Error(`Etapa inválida: ${etapa}`);
      }

      const id = 'RESP-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('dossier_responsaveis').upsert({
        id,
        dossier_id: dossierId,
        etapa,
        responsavel,
        notes: notas || null,
        assigned_at: new Date().toISOString()
      }, { onConflict: 'dossier_id,etapa' });

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
      // Conciliação empresa↔obra nasceu — provoca a busca de pagamentos no Omie sozinha (04/09).
      window.OmiePagamentosStore?.dispararSyncSilencioso(parceiroId);
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
