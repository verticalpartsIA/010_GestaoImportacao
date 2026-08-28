/* ============================================================
   cotacao-elevador-fornecedor-store.js
   Envio do RFQ técnico de Unidades do Formulário de Elevadores para o
   fornecedor real (começando pela Glarie — "Elevator Inquiry Form" e
   "Homelift Inquiry Form"). Mesmo padrão de pedido-fornecedor-store.js:
   token público, link por WhatsApp/E-mail/Link, resposta do fornecedor
   grava direto no banco (sem PDF, sem digitação manual).
   window.CotacaoElevadorFornecedorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  function cotacaoUrl(token) {
    return `${window.location.origin}/cotacao-elevador-fornecedor/${encodeURIComponent(token)}`;
  }

  /* ---------- IP (auditoria leve, mesmo padrão do resto do app) ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }

  /* ---------- Categorias de produto — hoje só "elevador" (Glarie) tem
     formulário técnico implementado; as demais existem no modelo de dados
     pra quando entrarem os próximos fornecedores (mesmo sistema, sem criar
     um domínio novo tipo o Pedido a Fornecedor de peças). ---------- */
  const CATEGORIAS_PRODUTO = [
    { value: 'elevador', label: 'Elevador' },
    { value: 'escada_rolante', label: 'Escada Rolante' },
    { value: 'esteira_rolante', label: 'Esteira Rolante' },
    { value: 'quadro_comando', label: 'Quadro de Comando' },
    { value: 'porta', label: 'Porta' },
    { value: 'cabine', label: 'Cabine' },
  ];

  /* ---------- Rótulos (nomenclatura do fornecedor) — usados na tela pública
     e no resumo interno, a partir dos MESMOS valores já salvos na Unidade. ---------- */
  const CEF_LIFT_MODEL = {
    'Passageiro': 'Passenger Lift', 'Carga': 'Freight Lift',
    'Hospitalar': 'Hospital (Bed) Lift', 'Panorâmico': 'Sightseeing/Panoramic Lift',
  };
  function liftModelLabel(tipo) { return CEF_LIFT_MODEL[tipo] || tipo || ''; }

  function machineRoomLabel(casaMaquinas) {
    if (casaMaquinas === 'com') return 'Machine Room';
    if (casaMaquinas === 'sem') return 'Machine Room Less';
    return '';
  }

  const CEF_CONTROLE = { simplex: 'Simplex', duplex: 'Duplex', triplex: 'Triplex', group: 'Group Control' };
  function controleLabel(agrupamento) { return CEF_CONTROLE[agrupamento] || agrupamento || ''; }

  /* Tipo da Unidade → qual dos 2 formulários da Glarie enviar. */
  function tipoFormularioPara(tipo) { return tipo === 'Home Lift' ? 'homelift' : 'elevator'; }

  /* ---------- Especificação técnica por Unidade (fonte única) — usada tanto
     no portal público (monta a tabela PT/EN + coluna de divergência do
     fornecedor) quanto na revisão interna (traduz a chave de uma divergência
     de volta pro rótulo PT/EN). Cada linha tem uma `key` estável — é o campo
     usado em respostas.itens[].divergencias quando o fornecedor propõe um
     valor diferente do enviado pela VerticalParts. ---------- */
  function cefMm(v) { return (v === '' || v === null || v === undefined) ? '' : `${v}mm`; }
  function cefSimNao(v) { return v ? 'Sim / Yes' : 'Não / No'; }

  const CEF_SPEC_DEFS = [
    { key: 'numero_elevador', pt: 'Número do elevador', en: 'Lift No.', secao: 'A', get: (u) => u.identificador },
    { key: 'qtd_unidades', pt: 'Quantidade de unidades idênticas', en: 'Lift Units (Quantity)', secao: 'A', get: (u) => u.quantidade || 1 },
    { key: 'modelo_elevador', pt: 'Modelo do elevador', en: 'Lift Model', secao: 'A', onlyElevator: true, get: (u) => liftModelLabel(u.tipo) },
    { key: 'estrutura', pt: 'Estrutura do elevador', en: 'Shaft structure', secao: 'A', get: (u) => u.estrutura_caixa },
    { key: 'casa_maquinas', pt: 'Casa de máquinas', en: 'Machine Room Type', secao: 'A', onlyElevator: true, get: (u) => machineRoomLabel(u.casa_maquinas) },
    { key: 'capacidade', pt: 'Capacidade', en: 'Rated Capacity', secao: 'A', get: (u) => `${u.capacidade_pessoas ? u.capacidade_pessoas + 'pass / ' : ''}${u.capacidade_kg || ''}kg` },
    { key: 'velocidade', pt: 'Velocidade', en: 'Rated Speed', secao: 'A', get: (u) => u.velocidade_ms ? `${u.velocidade_ms}m/s` : '' },
    { key: 'andares_paradas_portas', pt: 'Andares/Paradas/Portas', en: 'Floors/Stops/Doors', secao: 'A', get: (u) => u.paradas ? `${u.paradas}/${u.paradas}/${u.paradas}` : '' },
    { key: 'pavimentos_desc', pt: 'Descrição dos pavimentos', en: 'Floor Marks', secao: 'A', get: (u) => u.pavimentos_desc },
    { key: 'modelo_controle', pt: 'Modelo de controle', en: 'Control Model', secao: 'A', onlyElevator: true, get: (u) => controleLabel(u.agrupamento) },
    { key: 'tamanho_caixa', pt: 'Tamanho da caixa', en: 'Shaft Size (W×D)', secao: 'A', get: (u) => (u.caixa_largura_mm || u.caixa_profundidade_mm) ? `${u.caixa_largura_mm || '?'} x ${u.caixa_profundidade_mm || '?'} mm` : '' },
    { key: 'overhead', pt: 'Última altura', en: 'Overhead', secao: 'A', get: (u) => cefMm(u.overhead_mm) },
    { key: 'poco', pt: 'Poço', en: 'Shaft Pit', secao: 'A', get: (u) => cefMm(u.poco_mm) },
    { key: 'percurso', pt: 'Percurso', en: 'Travel Height', secao: 'A', get: (u) => cefMm(u.percurso_mm) },
    { key: 'porta_oposta', pt: 'Porta oposta', en: 'Open-Through Door', secao: 'A', get: (u) => u.porta_oposta },

    { key: 'cabina_largura', pt: 'Largura da cabina', en: 'Car Width', secao: 'B', get: (u) => cefMm(u.cabina_largura_mm) },
    { key: 'cabina_profundidade', pt: 'Profundidade da cabina', en: 'Car Depth', secao: 'B', get: (u) => cefMm(u.cabina_profundidade_mm) },
    { key: 'cabina_altura', pt: 'Altura da cabina', en: 'Car Height', secao: 'B', get: (u) => cefMm(u.cabina_altura_mm) },
    { key: 'teto_falso', pt: 'Teto falso', en: 'Car Ceiling', secao: 'B', get: (u) => u.teto_falso },
    { key: 'piso_cabina', pt: 'Piso da cabina', en: 'Car Floor', secao: 'B', get: (u) => u.piso_cabina },
    { key: 'corrimao', pt: 'Corrimão', en: 'Car Handrail', secao: 'B', get: (u) => u.corrimao },

    { key: 'porta_tipo_abertura', pt: 'Tipo de abertura', en: 'Door Opening Type', secao: 'C', get: (u) => u.porta_tipo_abertura },
    { key: 'porta_modelo', pt: 'Modelo de porta', en: 'Door Model', secao: 'C', get: (u) => u.porta_modelo },
    { key: 'porta_largura', pt: 'Largura da porta', en: 'Door Width', secao: 'C', get: (u) => cefMm(u.porta_largura_mm) },
    { key: 'porta_altura', pt: 'Altura da porta', en: 'Door Height', secao: 'C', get: (u) => cefMm(u.porta_altura_mm) },
    { key: 'acabamento_porta_cabina', pt: 'Acabamento porta cabina', en: 'Car Door Finish', secao: 'C', get: (u) => u.acabamento_porta_cabina },
    { key: 'acabamento_porta_pavimento', pt: 'Acabamento porta pavimento', en: 'Landing Door Finish', secao: 'C', get: (u) => u.acabamento_porta_pavimento },
    { key: 'classe_corta_fogo', pt: 'Classe corta-fogo', en: 'Fire Rating', secao: 'C', get: (u) => u.classe_corta_fogo },

    { key: 'botoeira_cabine', pt: 'Botoeira de cabine (COP)', en: 'COP Type', secao: 'D', get: (u) => u.botoeira_cabine },
    { key: 'botoeira_pavimento', pt: 'Botoeira de pavimento (LOP)', en: 'LOP Type', secao: 'D', get: (u) => u.botoeira_pavimento },

    { key: 'ard', pt: 'ARD — resgate automático', en: 'ARD', secao: 'E', get: (u) => cefSimNao(u.ard) },
    { key: 'camera', pt: 'Câmera na cabine', en: 'Camera in Car', secao: 'E', get: (u) => cefSimNao(u.camera) },
    { key: 'anuncio_voz', pt: 'Anúncio de voz', en: 'Voice Announcement', secao: 'E', get: (u) => cefSimNao(u.anuncio_voz) },
    { key: 'exigencias_especiais', pt: 'Exigências especiais', en: 'Special Requirements', secao: 'E', get: (u) => u.exigencias_especiais },
  ];

  const CEF_SECAO_TITULO = {
    A: 'A. Especificações Principais / Main Specification',
    B: 'B. Cabine / Car',
    C: 'C. Portas / Door',
    D: 'D. COP e LOP',
    E: 'E. Opcionais / Options',
  };

  /* Retorna as seções já filtradas por tipo (elevator/homelift) e com linhas
     [key, pt, en, valor] — key é usado como campo estável de divergência. */
  function unitSpecSecoes(u, tipoFormulario) {
    const isElevator = tipoFormulario === 'elevator';
    const porSecao = {};
    CEF_SPEC_DEFS.forEach((d) => {
      if (d.onlyElevator && !isElevator) return;
      (porSecao[d.secao] = porSecao[d.secao] || []).push([d.key, d.pt, d.en, d.get(u)]);
    });
    return Object.keys(CEF_SECAO_TITULO).filter((s) => porSecao[s]).map((s) => ({ titulo: CEF_SECAO_TITULO[s], linhas: porSecao[s] }));
  }

  function unitSpecFieldLabel(key) {
    const def = CEF_SPEC_DEFS.find((d) => d.key === key);
    return def ? `${def.pt} / ${def.en}` : key;
  }

  /* ---------- Snapshot do que é enviado (congela os dados no momento do
     envio — edições posteriores na Unidade não alteram o que já foi mandado) ---------- */
  function buildDadosEnvio(unidades, numeroCotacao) {
    const primeira = unidades[0] || {};
    return {
      header: {
        numero_cotacao: numeroCotacao ?? null,
        pais: 'Brazil',
        data: new Date().toISOString().slice(0, 10),
        tensao_principal: primeira.tensao_principal || '',
        tensao_iluminacao: primeira.tensao_iluminacao || '',
        norma_projeto: primeira.norma_projeto || '',
      },
      unidades: unidades.map((u) => ({
        unidade_id: u.id, identificador: u.identificador, tipo: u.tipo, modelo: u.modelo,
        indice_ativo: u.indice_ativo ?? null,
        quantidade: u.quantidade || 1,
        tracao: u.tracao,
        capacidade_kg: u.capacidade_kg, capacidade_pessoas: u.capacidade_pessoas,
        velocidade_ms: u.velocidade_ms, paradas: u.paradas, pavimentos_desc: u.pavimentos_desc,
        casa_maquinas: u.casa_maquinas, agrupamento: u.agrupamento, porta_oposta: u.porta_oposta,
        estrutura_caixa: u.estrutura_caixa, caixa_largura_mm: u.caixa_largura_mm, caixa_profundidade_mm: u.caixa_profundidade_mm,
        percurso_mm: u.percurso_mm, overhead_mm: u.overhead_mm, poco_mm: u.poco_mm,
        cabina_largura_mm: u.cabina_largura_mm, cabina_profundidade_mm: u.cabina_profundidade_mm, cabina_altura_mm: u.cabina_altura_mm,
        teto_falso: u.teto_falso, piso_cabina: u.piso_cabina, corrimao: u.corrimao,
        porta_tipo_abertura: u.porta_tipo_abertura, porta_modelo: u.porta_modelo,
        porta_largura_mm: u.porta_largura_mm, porta_altura_mm: u.porta_altura_mm,
        acabamento_porta_cabina: u.acabamento_porta_cabina, acabamento_porta_pavimento: u.acabamento_porta_pavimento,
        classe_corta_fogo: u.classe_corta_fogo,
        botoeira_cabine: u.botoeira_cabine, botoeira_pavimento: u.botoeira_pavimento,
        ard: u.ard, camera: u.camera, anuncio_voz: u.anuncio_voz, exigencias_especiais: u.exigencias_especiais,
      })),
    };
  }

  /* Código completo por equipamento (Fase 1 do Master ID): numero_documento
     da cotação já é [base]-[revisão] — só falta somar o índice do ativo.
     Ex.: numero_documento "VPEL-EL0902-A" + indice_ativo 1 = "VPEL-EL0902-A-1".
     Retorna null se a Unidade ainda não tem índice atribuído (dados antigos,
     de antes da Fase 1). */
  function assetMasterId(cot, indiceAtivo) {
    if (indiceAtivo == null) return null;
    return `${cot.numero_documento}-${indiceAtivo}`;
  }

  /* ---------- Gerar cotação (rascunho) ----------
     unidades: linhas de formularios_elevador_unidades já salvas (com id), todas
     do MESMO fornecedor e do mesmo tipo_formulario (elevator OU homelift).
     numeroCotacao: o Nº da Cotação do cliente (formularios_elevador.numero_cotacao,
     a mesma numeração que já vem sendo continuada desde a planilha histórica) —
     é o número que identifica o projeto pro fornecedor, equivalente ao "Project
     Name" que a Glarie usa nas próprias cotações.

     numero_documento agora segue o Master ID (Fase 1): [PREFIXO-TIPO][Nº
     da Cotação]-[REVISÃO], ex.: VPEL-EL0902, depois VPEL-EL0902-A se essa
     mesma categoria/formulário precisar de um 2º envio (troca de
     especificação, 2º tipo de formulário, outro fornecedor etc.) — a
     revisão é escopada por (formulário, categoria) pra nunca colidir,
     mesmo cobrindo motivos diferentes de reenvio. Cotações antigas
     (VPEL-0001..0003, formato sequencial simples) não são migradas. */
  async function gerar(formularioElevadorId, unidades, fornecedor, numeroCotacao, categoriaProduto) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const categoria = categoriaProduto || 'elevador';
    const tipo_formulario = tipoFormularioPara(unidades[0].tipo);

    const { data: existentes, error: exErr } = await c.from('cotacoes_elevador_fornecedor')
      .select('revisao').eq('formulario_elevador_id', formularioElevadorId).eq('categoria_produto', categoria);
    if (exErr) throw exErr;
    const maiorRevisao = (existentes || []).reduce((max, r) => (r.revisao && r.revisao > max ? r.revisao : max), '');
    const revisao = (existentes && existentes.length) ? window.MasterIdEngine.proximaRevisao(maiorRevisao || null) : null;
    const numero_documento = window.MasterIdEngine.masterId({ categoriaProduto: categoria, numeroCotacao, revisao });

    const row = {
      numero_documento,
      revisao,
      token: shortToken(),
      formulario_elevador_id: formularioElevadorId,
      fornecedor,
      categoria_produto: categoria,
      tipo_formulario,
      unidade_ids: unidades.map((u) => u.id),
      dados_envio: buildDadosEnvio(unidades, numeroCotacao),
      status: 'rascunho',
    };
    const { data, error } = await c.from('cotacoes_elevador_fornecedor').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const { error } = await c.from('cotacoes_elevador_fornecedor').update({
      status: 'enviado', channel: channel || null, recipient: recipient || null,
      sent_at: now, updated_at: now,
    }).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) {
      const cot = await getById(id);
      if (cot) window.EventosFluxo.registrar({
        evento: 'COTACAO_ENVIADA_FORNECEDOR',
        numeroCotacao: cot.dados_envio?.header?.numero_cotacao,
        alvoLabel: `${cot.fornecedor || 'Fornecedor'} · ${cot.numero_documento || ''}`, alvoId: cot.id,
        detalhe: { channel },
      });
    }
  }

  async function listarPorFormulario(formularioElevadorId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*').eq('formulario_elevador_id', formularioElevadorId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Tela "Cotações a Fornecedor" (todas categorias, todos fornecedores) ---------- */
  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*, formularios_elevador(numero_cotacao, local_obra_cidade, local_obra_estado, clientes(razao_social))')
      .is('excluido_em', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Exclusão com motivo (soft delete) ----------
     Nunca DELETE de verdade: precificacoes_elevador, tratativas_cotacao,
     projetos_elevador e cotacoes_elevador_fornecedor_anexos referenciam
     esta linha por FK — apagar quebraria ou arrastaria esses registros.
     "Excluir" aqui marca excluido_em/motivo_exclusao e a linha some da
     listagem (listarTodas já filtra), mas os dados ficam preservados
     pra auditoria. Pedido do usuário (27/08): exige justificativa antes
     de excluir. */
  async function excluirComMotivo(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da exclusão.');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    const now = new Date().toISOString();
    const { error } = await c.from('cotacoes_elevador_fornecedor').update({
      excluido_em: now, excluido_por: (window.__VP_USER || {}).email || null,
      motivo_exclusao: motivo.trim(), updated_at: now,
    }).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cotações a Fornecedor', acao: 'Excluiu cotação',
      alvo: cur.numero_documento, alvo_id: id, detalhe: { motivo: motivo.trim(), fornecedor: cur.fornecedor },
    });
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* ---------- Decisão interna pós-resposta do fornecedor: time decide seguir
     com a compra (em_analise) e depois confirma a compra (aprovada). ---------- */
  async function decidirComprar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'respondido') return cur;
    const numeroCotacao = cur.dados_envio?.header?.numero_cotacao;
    // Gate: só inicia a compra na China depois do Financeiro confirmar o
    // sinal pago — ver aval-financeiro-store.js.
    if (window.AvalFinanceiroStore) {
      const gate = await window.AvalFinanceiroStore.podeIniciarCompra(numeroCotacao);
      if (!gate.ok) throw new Error(gate.motivo);
    }
    const now = new Date().toISOString();
    const patch = { status: 'em_analise', decidido_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'COMPRA_FORNECEDOR_INICIADA', numeroCotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  async function aprovar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'em_analise') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'aprovada', aprovado_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'COMPRA_FORNECEDOR_CONFIRMADA',
      numeroCotacao: cur.dados_envio?.header?.numero_cotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* ---------- Rótulos/cores de status — usados tanto no modal de envio
     (dentro do Formulário de Elevadores) quanto na tela de Cotações a
     Fornecedor, pra não duplicar a mesma tabela em dois arquivos. ---------- */
  const STATUS_LABEL = {
    rascunho: 'Rascunho', enviado: 'Enviado', visualizado: 'Visualizado',
    respondido: 'Respondido', em_analise: 'Em análise', aprovada: 'Aprovada', expirado: 'Expirado',
  };
  const STATUS_COR = {
    rascunho: '#64748b', enviado: '#2563eb', visualizado: '#b45309',
    respondido: '#059669', em_analise: '#7c3aed', aprovada: '#15803d', expirado: '#9f1239',
  };

  /* Rótulo agrupado (spec 3.3.1 — "Ciclo de status"): rascunho/enviado/
     visualizado colapsam em "Aguardando", os demais viram seu próprio
     grupo. Fonte única — antes cotacoes-fornecedor.jsx (CF_AGUARDANDO) e
     precificacao-elevador.jsx (PZ_STATUS_COTACAO_LABEL) mantinham cada um
     sua própria cópia, esse último com um comentário admitindo a
     duplicata sem resolvê-la. */
  const STATUS_GROUP_LABEL = {
    rascunho: 'Aguardando', enviado: 'Aguardando', visualizado: 'Aguardando',
    respondido: 'Recebida', em_analise: 'Em análise', aprovada: 'Aprovada',
  };
  function statusGroupLabel(status) { return STATUS_GROUP_LABEL[status] || STATUS_LABEL[status] || status; }

  /* ---------- Fila da Importação: compras confirmadas no fornecedor que ainda
     não viraram embarque. O embarque (importação) nasce quando a compra ao
     fornecedor é decidida/aprovada (em_analise/aprovada) — não no sinal pago,
     que é só o cliente pagando a entrada. Sem esta ponte, uma compra iniciada
     ficava invisível na Importação (achado E2E reteste D). ---------- */
  async function listarComprasAguardandoEmbarque() {
    const c = sb(); if (!c) return [];
    const { data: cots } = await c.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, formulario_elevador_id, status, respostas, decidido_em, aprovado_em')
      .in('status', ['em_analise', 'aprovada']).eq('categoria_produto', 'elevador');
    if (!cots || !cots.length) return [];
    const { data: emb } = await c.from('embarques').select('cotacao_fornecedor_id');
    const comEmbarque = new Set((emb || []).map((x) => x.cotacao_fornecedor_id).filter(Boolean));
    const pendentes = cots.filter((x) => !comEmbarque.has(x.id));
    if (!pendentes.length) return [];
    const formIds = [...new Set(pendentes.map((x) => x.formulario_elevador_id).filter(Boolean))];
    const { data: forms } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, clientes(razao_social)').in('id', formIds);
    const formById = {}; (forms || []).forEach((f) => { formById[f.id] = f; });
    return pendentes.map((x) => {
      const form = formById[x.formulario_elevador_id] || {};
      const respostas = x.respostas || {};
      const fobUsd = (respostas.itens || []).reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);
      return {
        cotacaoFornecedorId: x.id,
        numeroDocumento: x.numero_documento,
        numeroCotacao: form.numero_cotacao ?? null,
        fornecedor: x.fornecedor,
        clienteNome: (form.clientes && form.clientes.razao_social) || null,
        fobUsd,
        status: x.status,
        quando: x.aprovado_em || x.decidido_em,
      };
    }).sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')));
  }

  /* ---------- Portal público (/cotacao-elevador-fornecedor/:token) ---------- */
  async function getByToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  async function marcarVisualizado(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'visualizado', viewed_at: now, updated_at: now };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    return { ...cur, ...patch };
  }

  /* Traduz a "Confirmação técnica" do fornecedor pra português — chamado
     no momento de salvar a resposta (uma vez só, fica gravado). Devolve
     null quando o texto já está em PT-BR (a Edge Function decide isso),
     ou quando a tradução falha — nesse caso NÃO bloqueia o envio, o
     fornecedor não pode ficar travado por causa de um serviço de IA
     instável, só fica sem a linha traduzida. */
  const VP_TRANSLATE_URL = 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/vp-translate-to-pt';
  const VP_TRANSLATE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dHF3em1wZ29md2N0cWFqZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODk3NzcsImV4cCI6MjA5NTA2NTc3N30.hoNuKfSaSLFDKqJ2F331QSDQkzsiphWhLk3xtZh6Bpc';
  async function traduzirConfirmacaoTecnica(text) {
    if (!text || !text.trim()) return null;
    try {
      const res = await fetch(VP_TRANSLATE_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + VP_TRANSLATE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.translated || null;
    } catch (e) {
      return null;
    }
  }

  /* respostas = { moeda, incoterm_porto, condicoes_pagamento, prazo_fabricacao,
     garantia, validade_dias, embalagem, container_no, documentos_embarque,
     observacoes_gerais, itens:[{unidade_id, modelo_fornecedor, floors_stops_doors,
     preco_unitario, preco_total, confirmacao_tecnica, confirmacao_tecnica_pt}] } */
  async function salvarResposta(token, respostas) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    // Traduz cada "confirmação técnica" em paralelo — não atrasa o envio
    // sequencialmente item a item, e nunca bloqueia se a IA falhar.
    if (Array.isArray(respostas.itens) && respostas.itens.length) {
      await Promise.all(respostas.itens.map(async (it) => {
        if (it && it.confirmacao_tecnica) {
          it.confirmacao_tecnica_pt = await traduzirConfirmacaoTecnica(it.confirmacao_tecnica);
        }
      }));
    }
    const ip = await getPublicIP();
    const now = new Date().toISOString();
    const payload = { ...respostas, _meta: { ip, ua: navigator.userAgent, respondido_em: now } };
    /* Câmbio USD/BRL congelado no exato momento em que o fornecedor
       respondeu (pedido do usuário, 27/08) — base pra comparar depois
       "câmbio no dia da cotação" vs. "câmbio agora" na Precificação.
       Nunca bloqueia o envio se a API de câmbio falhar. */
    let cambioNaResposta = null;
    try { cambioNaResposta = (await window.CambioAPI.buscarUsdBrl()).valor; } catch (e) { /* segue sem — Precificação fica sem o congelado */ }
    const patch = {
      status: 'respondido', respostas: payload, responded_at: now, updated_at: now,
      cambio_na_resposta_usd_brl: cambioNaResposta,
    };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    if (window.VPLog) window.VPLog.registrar({
      ator_nome: cur.fornecedor || 'Fornecedor', ator_setor: 'fornecedor',
      modulo: 'Formulário de Elevadores', acao: 'respondeu a cotação de fornecedor',
      alvo: cur.numero_documento, alvo_id: cur.id, detalhe: { ip },
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FORNECEDOR_RESPONDEU',
      numeroCotacao: cur.dados_envio?.header?.numero_cotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* ---------- Anexos da resposta do Fornecedor (PDF/DWG/imagens) ----------
     Bucket privado cotacao-fornecedor-anexos — mesmo padrão de bucket
     privado + URL assinada de formulario-elevador-store.js (FEA_BUCKET).
     Vinculados à cotação inteira (não por unidade). */
  const CEF_ANEXOS_BUCKET = 'cotacao-fornecedor-anexos';

  function cef_slugify(s) {
    return String(s || 'arquivo')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || 'arquivo';
  }

  async function listarAnexosResposta(cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('cotacoes_elevador_fornecedor_anexos')
      .select('*').eq('cotacao_fornecedor_id', cotacaoFornecedorId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function anexarArquivoResposta(cotacaoFornecedorId, file) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const nomeSeguro = cef_slugify(file.name);
    const path = `${cotacaoFornecedorId}/${Date.now()}-${nomeSeguro}`;
    const { error: upErr } = await c.storage.from(CEF_ANEXOS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (upErr) throw upErr;
    const { data, error } = await c.from('cotacoes_elevador_fornecedor_anexos').insert({
      cotacao_fornecedor_id: cotacaoFornecedorId,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      tipo_arquivo: file.type || null,
      path,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function urlAssinadaAnexoResposta(path, ttlSeconds) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(CEF_ANEXOS_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async function removerAnexoResposta(anexo) {
    const c = sb(); if (!c || !anexo) return;
    if (anexo.path) await c.storage.from(CEF_ANEXOS_BUCKET).remove([anexo.path]);
    await c.from('cotacoes_elevador_fornecedor_anexos').delete().eq('id', anexo.id);
  }

  /* ---------- Anexos do Formulário (VerticalParts) direcionados ao Fornecedor ----------
     Mesma tabela/bucket de formulario-elevador-store.js (formularios_elevador_anexos
     / bucket formulario-elevador-anexos, categoria='fornecedor') — lidos direto aqui
     pra não precisar carregar o store inteiro do Formulário na página pública. */
  const FORM_ANEXOS_BUCKET = 'formulario-elevador-anexos';

  async function listarAnexosFormulario(formularioId) {
    const c = sb(); if (!c || !formularioId) return [];
    const { data, error } = await c.from('formularios_elevador_anexos')
      .select('*').eq('formulario_id', formularioId).eq('categoria', 'fornecedor').order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async function urlAssinadaAnexoFormulario(path, ttlSeconds) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(FORM_ANEXOS_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  window.CotacaoElevadorFornecedorStore = {
    cotacaoUrl, tipoFormularioPara, liftModelLabel, machineRoomLabel, controleLabel,
    CATEGORIAS_PRODUTO, STATUS_LABEL, STATUS_COR, STATUS_GROUP_LABEL, statusGroupLabel,
    unitSpecSecoes, unitSpecFieldLabel, assetMasterId,
    listarAnexosResposta, anexarArquivoResposta, urlAssinadaAnexoResposta, removerAnexoResposta,
    listarAnexosFormulario, urlAssinadaAnexoFormulario,
    gerar, marcarEnviado, listarPorFormulario, listarTodas, getById,
    getByToken, marcarVisualizado, salvarResposta, getPublicIP,
    decidirComprar, aprovar, listarComprasAguardandoEmbarque, excluirComMotivo,
  };
}());
