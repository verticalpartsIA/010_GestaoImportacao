/* ============================================================
   rh-homologacao-store.js
   Validação de qualificação de Parceiro Instalador
   Certificações: NR-10, NR-35, ASO, PCMSO, PGR
   window.RHHomologacao — expõe validação e gerenciamento
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const ANEXOS_BUCKET = 'parceiros-instaladores-anexos';

  /* Documento/imagem da certificação (curso NR-10 etc.) — 1 arquivo por
     certificação, upsert substitui o anterior direto no mesmo path. */
  async function uploadCertificadoArquivo(montadorId, chave, file) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${montadorId}/${chave}.${ext}`;
    const { error } = await c.storage.from(ANEXOS_BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return { path, nome: file.name, tipo: file.type || null, tamanho: file.size, enviado_em: new Date().toISOString() };
  }

  async function urlCertificadoArquivo(path, ttlSeconds) {
    const c = sb();
    if (!c || !path) return null;
    const { data, error } = await c.storage.from(ANEXOS_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  async function removerCertificadoArquivo(path) {
    const c = sb();
    if (!c || !path) return;
    await c.storage.from(ANEXOS_BUCKET).remove([path]);
  }

  const CERTIFICACOES = {
    nr10: { label: 'NR-10: Segurança em Instalações Elétricas', categoria: 'seguranca' },
    nr35: { label: 'NR-35: Trabalho em Altura', categoria: 'seguranca' },
    aso: { label: 'ASO: Atestado de Saúde Ocupacional', categoria: 'saude' },
    pcmso: { label: 'PCMSO: Programa de Controle Médico', categoria: 'saude' },
    pgr: { label: 'PGR: Programa de Gerenciamento de Riscos', categoria: 'risco' },
  };

  async function salvarMontador(montadorData) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    if (!montadorData.id) montadorData.id = 'MNT-' + Date.now().toString().slice(-6);

    const { error } = await c.from('parceiros_instaladores').insert(montadorData);
    if (error && error.code !== '23505') throw error; // ignora duplicate

    if (error?.code === '23505') {
      const { error: updateError } = await c.from('parceiros_instaladores')
        .update(montadorData).eq('id', montadorData.id);
      if (updateError) throw updateError;
    }

    return montadorData.id;
  }

  async function obterMontador(montadorId) {
    const c = sb();
    if (!c || !montadorId) return null;

    const { data } = await c.from('parceiros_instaladores')
      .select('*')
      .eq('id', montadorId)
      .single();

    return data || null;
  }

  async function listarMontadores() {
    const c = sb();
    if (!c) return [];

    const { data } = await c.from('parceiros_instaladores')
      .select('*')
      .order('nome', { ascending: true });

    return data || [];
  }

  function validarCertificacoes(certificacoes) {
    const hoje = new Date();
    const resultado = {
      validas: [],
      expiradas: [],
      vencendoEm30Dias: [],
      todasValidas: true,
    };

    Object.entries(certificacoes || {}).forEach(([chave, data]) => {
      if (!data || !data.data_validade) return;

      const dataValidade = new Date(data.data_validade);
      const diasRestantes = Math.floor((dataValidade - hoje) / (1000 * 60 * 60 * 24));

      const cert = { chave, ...data, diasRestantes, label: CERTIFICACOES[chave]?.label };

      if (diasRestantes < 0) {
        resultado.expiradas.push(cert);
        resultado.todasValidas = false;
      } else if (diasRestantes <= 30) {
        resultado.vencendoEm30Dias.push(cert);
      } else {
        resultado.validas.push(cert);
      }
    });

    return resultado;
  }

  function statusGeral(montador) {
    if (!montador) return 'vazio';

    const validacao = validarCertificacoes(montador.certificacoes);

    if (validacao.expiradas.length > 0) return 'expirado';
    if (validacao.vencendoEm30Dias.length > 0) return 'atencao';
    if (validacao.todasValidas && validacao.validas.length === Object.keys(CERTIFICACOES).length) {
      return 'ok';
    }
    return 'incompleto';
  }

  function statusVariant(status) {
    return status === 'ok' ? 'success'
      : status === 'expirado' ? 'danger'
      : status === 'atencao' ? 'warning'
      : status === 'incompleto' ? 'warning'
      : 'neutral';
  }

  function fmtData(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  /* ---------- Colaboradores (pessoa física, dentro de uma empresa) ---------- */

  async function listarColaboradoresTodos() {
    const c = sb();
    if (!c) return [];
    const { data } = await c.from('parceiros_colaboradores').select('*').order('nome_completo');
    return data || [];
  }

  async function listarColaboradoresPorEmpresa(empresaId) {
    const c = sb();
    if (!c || !empresaId) return [];
    const { data } = await c.from('parceiros_colaboradores')
      .select('*').eq('empresa_id', empresaId).order('nome_completo');
    return data || [];
  }

  async function obterColaborador(colaboradorId) {
    const c = sb();
    if (!c || !colaboradorId) return null;
    const { data } = await c.from('parceiros_colaboradores').select('*').eq('id', colaboradorId).single();
    return data || null;
  }

  async function salvarColaborador(dados) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    if (!dados.id) dados.id = 'COLAB-' + Date.now().toString().slice(-8);
    const { error } = await c.from('parceiros_colaboradores').upsert(dados);
    if (error) throw error;
    return dados.id;
  }

  async function excluirColaborador(colaboradorId) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    const { error } = await c.from('parceiros_colaboradores').delete().eq('id', colaboradorId);
    if (error) throw error;
  }

  /* ---------- Catálogo de documentos (79 tipos: colaborador/empresa/obra) ---------- */

  let _catalogoCache = null;
  async function listarDocCatalogo() {
    if (_catalogoCache) return _catalogoCache;
    const c = sb();
    if (!c) return [];
    const { data } = await c.from('parceiros_doc_catalogo').select('*').order('nome');
    _catalogoCache = data || [];
    return _catalogoCache;
  }

  /* ---------- Documentos por colaborador (com vencimento real) ---------- */

  async function listarDocumentosColaborador(colaboradorId) {
    const c = sb();
    if (!c || !colaboradorId) return [];
    const { data } = await c.from('parceiros_documentos_colaborador')
      .select('*, parceiros_doc_catalogo(nome, periodicidade, obrigatorio)')
      .eq('colaborador_id', colaboradorId)
      .order('data_vencimento', { ascending: true, nullsFirst: false });
    return data || [];
  }

  async function salvarDocumentoColaborador(dados) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    if (!dados.id) dados.id = 'DOCCOL-' + Date.now().toString().slice(-8);
    const { error } = await c.from('parceiros_documentos_colaborador').upsert(dados);
    if (error) throw error;
    return dados.id;
  }

  /* Resumo de status (vencido/válido/N-A) por empresa — 1 query, agrupado no
     cliente. Usado pra pintar a lista de empresas sem precisar de N+1. */
  async function resumoDocumentosPorEmpresa() {
    const c = sb();
    if (!c) return {};
    const { data } = await c
      .from('parceiros_documentos_colaborador')
      .select('status, colaborador:parceiros_colaboradores!inner(empresa_id)');
    const map = {};
    (data || []).forEach((r) => {
      const eid = r.colaborador?.empresa_id;
      if (!eid) return;
      const m = map[eid] || { vencido: 0, valido: 0, na: 0, total: 0 };
      m.total += 1;
      if (r.status === 'VENCIDO') m.vencido += 1;
      else if (r.status === 'VALIDO') m.valido += 1;
      else m.na += 1;
      map[eid] = m;
    });
    return map;
  }

  /* Homologação real da empresa via parceiros_documentos_colaborador (schema
     pós-migração 25/08) — NÃO usa parceiros_instaladores.certificacoes (jsonb
     de 5 certs fixas), que ficou obsoleto: a tela RH Homologação não grava
     mais nele desde a migração, então um gate que lesse esse campo nunca
     seria satisfeito por documentos anexados hoje. Usado pelo gate "obra
     pronta pra instalação" (instalacao-obra-store.js).
     Status: 'vazio' (sem colaborador cadastrado), 'expirado' (algum
     documento VENCIDO), 'incompleto' (falta algum documento obrigatório em
     algum colaborador), 'ok' (documentação completa e em dia). */
  async function statusGeralPorColaboradores(empresaId) {
    const c = sb();
    if (!c || !empresaId) return { status: 'vazio', detalhe: 'Supabase indisponível' };

    const { data: colaboradores } = await c.from('parceiros_colaboradores')
      .select('id, nome_completo').eq('empresa_id', empresaId);
    if (!colaboradores || colaboradores.length === 0) {
      return { status: 'vazio', detalhe: 'Nenhum colaborador cadastrado' };
    }

    const catalogo = await listarDocCatalogo();
    const catalogoObrig = catalogo.filter((t) => t.escopo === 'colaborador' && t.obrigatorio);

    let vencidos = 0;
    let faltando = 0;
    for (const col of colaboradores) {
      const { data: docs } = await c.from('parceiros_documentos_colaborador')
        .select('documento_id, status').eq('colaborador_id', col.id);
      const tiposPresentes = new Set((docs || []).map((d) => d.documento_id));
      vencidos += (docs || []).filter((d) => d.status === 'VENCIDO').length;
      faltando += catalogoObrig.filter((t) => !tiposPresentes.has(t.id)).length;
    }

    if (vencidos > 0) return { status: 'expirado', detalhe: `${vencidos} documento(s) vencido(s)` };
    if (faltando > 0) return { status: 'incompleto', detalhe: `${faltando} documento(s) obrigatório(s) faltando` };
    return { status: 'ok', detalhe: `${colaboradores.length} colaborador(es), documentação em dia` };
  }

  /* Obras vinculadas a este instalador — une os dois vínculos que existem
     hoje (dossier_obra.parceiro_instalador_id, a nível de obra inteira, e
     equipamentos_obra.parceiro_instalador_id, por equipamento individual),
     dedupe por obra. Usado pela aba "Obras" em Cadastros → Empresas
     Instaladoras (Empresa → quais obras montou/está montando). */
  async function listarObrasPorInstalador(empresaId) {
    const c = sb();
    if (!c || !empresaId) return [];
    const [{ data: diretas }, { data: viaEquip }] = await Promise.all([
      c.from('dossier_obra').select('id, client_name, building_name, status_master').eq('parceiro_instalador_id', empresaId),
      c.from('equipamentos_obra').select('dossier_obra(id, client_name, building_name, status_master)').eq('parceiro_instalador_id', empresaId),
    ]);
    const map = {};
    (diretas || []).forEach((o) => { map[o.id] = o; });
    (viaEquip || []).forEach((e) => { const o = e.dossier_obra; if (o && !map[o.id]) map[o.id] = o; });
    return Object.values(map);
  }

  /* Hierarquia Empresa -> Cliente -> Equipamentos ("Vida da Instaladora").
     Une os 3 vínculos possíveis (obra principal, roster
     dossier_obra_instaladores, por equipamento) numa lista única por
     obra, dedupe por dossier_id (prioriza o dado mais específico —
     nº de série vem do vínculo por equipamento quando existe), depois
     agrupa por client_name pra virar a árvore. */
  async function listarHierarquiaClientesDoInstalador(empresaId) {
    const c = sb();
    if (!c || !empresaId) return [];
    const [{ data: diretas }, { data: viaRoster }, { data: viaEquip }] = await Promise.all([
      c.from('dossier_obra').select('id, client_name, building_name, status_master').eq('parceiro_instalador_id', empresaId),
      c.from('dossier_obra_instaladores').select('dossier_obra(id, client_name, building_name, status_master)').eq('parceiro_instalador_id', empresaId),
      c.from('equipamentos_obra').select('numero_serie, dossier_obra(id, client_name, building_name, status_master)').eq('parceiro_instalador_id', empresaId),
    ]);

    const porDossier = {};
    (diretas || []).forEach((o) => { porDossier[o.id] = { ...o, numero_serie: null }; });
    (viaRoster || []).forEach((r) => { const o = r.dossier_obra; if (o && !porDossier[o.id]) porDossier[o.id] = { ...o, numero_serie: null }; });
    (viaEquip || []).forEach((e) => {
      const o = e.dossier_obra; if (!o) return;
      porDossier[o.id] = { ...o, numero_serie: e.numero_serie || porDossier[o.id]?.numero_serie || null };
    });

    const porCliente = {};
    Object.values(porDossier).forEach((o) => {
      const chave = o.client_name || '(sem cliente)';
      (porCliente[chave] = porCliente[chave] || []).push(o);
    });
    return Object.entries(porCliente)
      .map(([cliente, obras]) => ({ cliente, obras }))
      .sort((a, b) => a.cliente.localeCompare(b.cliente));
  }

  function uploadDocumentoColaboradorArquivo(colaboradorId, documentoId, file) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `colaboradores/${colaboradorId}/${documentoId}.${ext}`;
    return c.storage.from(ANEXOS_BUCKET).upload(path, file, { upsert: true }).then(({ error }) => {
      if (error) throw error;
      return { path, nome: file.name, tipo: file.type || null, tamanho: file.size, enviado_em: new Date().toISOString() };
    });
  }

  window.RHHomologacao = {
    CERTIFICACOES,
    salvarMontador,
    obterMontador,
    listarMontadores,
    validarCertificacoes,
    statusGeral,
    statusVariant,
    fmtData,
    uploadCertificadoArquivo,
    urlCertificadoArquivo,
    removerCertificadoArquivo,
    listarColaboradoresTodos,
    listarColaboradoresPorEmpresa,
    obterColaborador,
    salvarColaborador,
    excluirColaborador,
    listarDocCatalogo,
    listarDocumentosColaborador,
    salvarDocumentoColaborador,
    resumoDocumentosPorEmpresa,
    statusGeralPorColaboradores,
    listarObrasPorInstalador,
    listarHierarquiaClientesDoInstalador,
    uploadDocumentoColaboradorArquivo,
  };
})();
