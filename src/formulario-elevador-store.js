/* ============================================================
   formulario-elevador-store.js
   CRUD do Formulário de Coleta de Dados — Elevadores (Comercial).
   Header (formularios_elevador) + Unidades (formularios_elevador_unidades),
   ver issue #66. Mesmo padrão de token público de pedido-fornecedor-store.js
   (RLS permissiva — segurança real é o token ser imprevisível).
   window.FormularioElevadorStore
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
  function novoId(prefixo) { return `${prefixo}-${Date.now().toString(36).toUpperCase()}`; }

  function publicUrl(token) {
    return `${window.location.origin}/formulario-cliente/${encodeURIComponent(token)}`;
  }

  /* ---------- Fornecedores (cadastro expansível) ---------- */
  async function listarFornecedores() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('fornecedores_elevador').select('nome').eq('ativo', true).order('nome');
    if (error) throw error;
    return (data || []).map((f) => f.nome);
  }

  /* ---------- Catálogo de Modelos de Elevador (Modelo → acessórios compatíveis) ---------- */
  async function listarModelosElevador() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('elevador_modelos')
      .select('codigo, nome, tipo, cabine_descricao').eq('ativo', true).order('codigo');
    if (error) throw error;
    return data || [];
  }

  const FE_CATEGORIAS_OPCAO = ['teto_falso', 'piso', 'porta', 'botoeira_cabine', 'botoeira_pavimento'];

  async function listarOpcoesElevador(modeloCodigo) {
    const vazio = { teto_falso: [], piso: [], porta: [], botoeira_cabine: [], botoeira_pavimento: [] };
    if (!modeloCodigo) return vazio;
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: modelo, error: e1 } = await c.from('elevador_modelos')
      .select('id').eq('codigo', modeloCodigo).maybeSingle();
    if (e1) throw e1;
    if (!modelo) return vazio;
    const { data, error: e2 } = await c.from('elevador_modelo_opcoes')
      .select('elevador_opcoes(categoria, codigo, nome)').eq('modelo_id', modelo.id);
    if (e2) throw e2;
    const agrupado = { ...vazio };
    (data || []).forEach((v) => {
      const o = v.elevador_opcoes;
      if (!o || !FE_CATEGORIAS_OPCAO.includes(o.categoria)) return;
      agrupado[o.categoria].push({ value: o.codigo, label: `${o.codigo} — ${o.nome}` });
    });
    FE_CATEGORIAS_OPCAO.forEach((cat) => agrupado[cat].sort((a, b) => a.value.localeCompare(b.value)));
    return agrupado;
  }

  /* Endereço estruturado → string única pra exibição/exportação. Regra:
     CEP e cidade nunca ficam separados por vírgula (usa " - " entre eles). */
  function formatarEndereco({ logradouro, complemento, bairro, cep, cidade, estado } = {}) {
    const partes = [];
    let linha1 = (logradouro || '').trim();
    if ((complemento || '').trim()) linha1 = linha1 ? `${linha1}, ${complemento.trim()}` : complemento.trim();
    if (linha1) partes.push(linha1);
    if ((bairro || '').trim()) partes.push(bairro.trim());
    let cidadeUf = '';
    if ((cidade || '').trim() && (estado || '').trim()) cidadeUf = `${cidade.trim()}/${estado.trim()}`;
    else cidadeUf = (cidade || estado || '').trim();
    let linha2 = (cep || '').trim();
    if (linha2 && cidadeUf) linha2 = `${linha2} - ${cidadeUf}`;
    else if (cidadeUf) linha2 = cidadeUf;
    if (linha2) partes.push(linha2);
    return partes.join(', ');
  }
  function enderecoPartes(dados, prefixo) {
    return {
      logradouro: dados[`${prefixo}logradouro`],
      complemento: dados[`${prefixo}complemento`],
      bairro: dados[`${prefixo}bairro`],
      cep: dados[`${prefixo}cep`],
      cidade: dados[`${prefixo}cidade`],
      estado: dados[`${prefixo}estado`],
    };
  }

  /* ---------- Cliente (fiscal) ---------- */
  async function buscarOuCriarCliente(dados) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const doc = (dados.cnpj || dados.cpf || '').replace(/\D/g, '');
    if (doc) {
      const campo = dados.tipo_pessoa === 'PF' ? 'cpf' : 'cnpj';
      const { data: existente } = await c.from('clientes').select('*').eq(campo, doc).maybeSingle();
      if (existente) return existente;
    }
    const codigo = window.CadastrosClientesStore ? await window.CadastrosClientesStore.gerarCodigo() : null;
    const { data, error } = await c.from('clientes').insert({
      codigo,
      razao_social: dados.razao_social || null,
      cnpj: dados.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: dados.tipo_pessoa === 'PF' ? (doc || null) : null,
      tipo_pessoa: dados.tipo_pessoa || 'PJ',
      inscricao_estadual: dados.inscricao_estadual || null,
      contribuinte_icms: typeof dados.contribuinte_icms === 'boolean' ? dados.contribuinte_icms : null,
      endereco_logradouro: dados.endereco_logradouro || null,
      endereco_complemento: dados.endereco_complemento || null,
      endereco_bairro: dados.endereco_bairro || null,
      endereco_cep: dados.endereco_cep || null,
      endereco_cidade: dados.endereco_cidade || null,
      endereco_estado: dados.endereco_estado || null,
      endereco: formatarEndereco(enderecoPartes(dados, 'endereco_')) || null,
      email: dados.email || null,
      telefone: dados.telefone || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      contato: dados.contato || null,
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* ---------- Header ---------- */
  async function criar(dados) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const id = novoId('FE');
    const token = dados.canal === 'self_service' ? shortToken() : null;
    const usaEnderecoObra = !!dados.endereco_obra_diferente;
    const { data, error } = await c.from('formularios_elevador').insert({
      id,
      lead_id: dados.lead_id || null,
      dossier_id: dados.dossier_id || null,
      cliente_id: dados.cliente_id || null,
      canal: dados.canal || 'assistido',
      token,
      local_obra_cidade: dados.local_obra_cidade || null,
      local_obra_estado: dados.local_obra_estado || null,
      endereco_logradouro: dados.endereco_logradouro || null,
      endereco_complemento: dados.endereco_complemento || null,
      endereco_bairro: dados.endereco_bairro || null,
      endereco_cep: dados.endereco_cep || null,
      endereco_cidade: dados.endereco_cidade || null,
      endereco_estado: dados.endereco_estado || null,
      endereco_obra_diferente: usaEnderecoObra,
      endereco_obra_logradouro: usaEnderecoObra ? (dados.endereco_obra_logradouro || null) : (dados.endereco_logradouro || null),
      endereco_obra_complemento: usaEnderecoObra ? (dados.endereco_obra_complemento || null) : (dados.endereco_complemento || null),
      endereco_obra_bairro: usaEnderecoObra ? (dados.endereco_obra_bairro || null) : (dados.endereco_bairro || null),
      endereco_obra_cep: usaEnderecoObra ? (dados.endereco_obra_cep || null) : (dados.endereco_cep || null),
      endereco_obra_cidade: usaEnderecoObra ? (dados.endereco_obra_cidade || null) : (dados.endereco_cidade || null),
      endereco_obra_estado: usaEnderecoObra ? (dados.endereco_obra_estado || null) : (dados.endereco_estado || null),
      endereco_obra: formatarEndereco(enderecoPartes(dados, usaEnderecoObra ? 'endereco_obra_' : 'endereco_')) || null,
      prazo_desejado: dados.prazo_desejado || null,
      tipo_mao_de_obra: dados.tipo_mao_de_obra || null,
      responsavel_entrega: dados.responsavel_entrega || null,
      origem_venda: dados.origem_venda || null,
      vendedor: dados.vendedor || null,
      observacoes: dados.observacoes || null,
      created_by: (window.__VP_USER || {}).email || null,
    }).select().single();
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FORMULARIO_PREENCHIDO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.local_obra_cidade ? `${data.local_obra_cidade}/${data.local_obra_estado || ''}` : data.id,
      alvoId: data.id,
    });
    return data;
  }

  /* Colunas reais de formularios_elevador — o formulário na tela (`header`)
     também carrega campos do CLIENTE (cnpj, razão social, telefone...) que
     vivem só na tabela `clientes`, nunca aqui. Sem esse filtro, um spread
     cru do patch manda esses campos pro update() e quebra com "Could not
     find the column" (mesmo bug do 'endereco' antes — dessa vez foi o
     'cnpj'; por isso a whitelist agora, em vez de tirar campo por campo).

     `numero_cotacao` foi removido de propósito (15/08): nasce sozinho da
     sequência do banco no INSERT (nextval) e é o "Ator principal" da linha
     do tempo da cotação inteira — precisa nascer uma vez e nunca mais
     morrer. Deixá-lo editável aqui permitiria sobrescrever esse número por
     engano num patch qualquer; nenhuma tela usa isso hoje, mas o buraco
     estava aberto. */
  const FE_COLUNAS_VALIDAS = new Set([
    'lead_id', 'dossier_id', 'cliente_id', 'canal', 'token',
    'local_obra_cidade', 'local_obra_estado', 'endereco_obra', 'prazo_desejado',
    'tipo_mao_de_obra', 'responsavel_entrega', 'origem_venda', 'status', 'observacoes',
    'endereco_obra_diferente', 'endereco_logradouro', 'endereco_complemento', 'endereco_bairro',
    'endereco_cep', 'endereco_cidade', 'endereco_estado',
    'endereco_obra_logradouro', 'endereco_obra_complemento', 'endereco_obra_bairro',
    'endereco_obra_cep', 'endereco_obra_cidade', 'endereco_obra_estado',
    'vendedor', 'finalidade_compra', 'envio_direto_precificacao_em',
  ]);

  async function salvar(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const resolved = {};
    Object.keys(patch).forEach((k) => { if (FE_COLUNAS_VALIDAS.has(k)) resolved[k] = patch[k]; });
    if (resolved.endereco_obra_diferente !== undefined) {
      const usaEnderecoObra = !!resolved.endereco_obra_diferente;
      // Obra "não é endereço diferente" → mantém sincronizado com o endereço do cliente.
      if (!usaEnderecoObra) {
        resolved.endereco_obra_logradouro = resolved.endereco_logradouro || null;
        resolved.endereco_obra_complemento = resolved.endereco_complemento || null;
        resolved.endereco_obra_bairro = resolved.endereco_bairro || null;
        resolved.endereco_obra_cep = resolved.endereco_cep || null;
        resolved.endereco_obra_cidade = resolved.endereco_cidade || null;
        resolved.endereco_obra_estado = resolved.endereco_estado || null;
      }
      resolved.endereco_obra = formatarEndereco(enderecoPartes(resolved, usaEnderecoObra ? 'endereco_obra_' : 'endereco_')) || null;
    }
    const { error } = await c.from('formularios_elevador')
      .update({ ...resolved, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async function obter(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: header, error } = await c.from('formularios_elevador').select('*, clientes(*)').eq('id', id).single();
    if (error) throw error;
    const { data: unidades } = await c.from('formularios_elevador_unidades')
      .select('*').eq('formulario_id', id).order('created_at', { ascending: true });
    // Dados de identidade do cliente (razão social, CNPJ, endereço etc.) vivem
    // em `clientes`, não em `formularios_elevador` — sem isto o formulário
    // reabria com esses campos em branco mesmo já tendo um cliente vinculado.
    // `id` fica de fora do merge pra não trocar o id do formulário pelo do cliente.
    const { clientes, ...resto } = header;
    const { id: _clienteId, ...clienteCampos } = clientes || {};
    return { ...resto, ...clienteCampos, unidades: unidades || [] };
  }

  async function obterPorToken(token) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: header, error } = await c.from('formularios_elevador').select('*').eq('token', token).maybeSingle();
    if (error) throw error;
    if (!header) return null;
    const { data: unidades } = await c.from('formularios_elevador_unidades')
      .select('*').eq('formulario_id', header.id).order('created_at', { ascending: true });
    return { ...header, unidades: unidades || [] };
  }

  async function gerarLinkPublico(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual } = await c.from('formularios_elevador').select('token').eq('id', id).single();
    const token = atual?.token || shortToken();
    if (!atual?.token) {
      await c.from('formularios_elevador').update({ canal: 'self_service', token }).eq('id', id);
    }
    return publicUrl(token);
  }

  async function enviar(id) {
    await salvar(id, { status: 'enviado' });
  }

  /* "Enviar direto para Precificação" — pedido do usuário 19/08: preço já
     veio combinado por fora (CEO/Financeiro), não faz sentido esperar
     resposta de Cotação a Fornecedor que nunca vai chegar. Só marca a
     data — quem lê isso e decide o que fazer é
     PrecificacaoElevadorStore.listarPendentes() (precificacao-elevador-store.js). */
  async function enviarDiretoParaPrecificacao(id) {
    await salvar(id, { status: 'enviado', envio_direto_precificacao_em: new Date().toISOString() });
  }

  /* ---------- Unidades (um elevador por linha) ---------- */
  /* indice_ativo — Master ID (Fase 1): atribuído uma única vez, na criação
     da Unidade, e nunca reaproveitado nem trocado depois — é o "-1"/"-2"/"-3"
     do Asset-Level ID (ex.: VPEL-EL0902-A-1), obrigatório mesmo pra pedido
     de 1 elevador só. */
  /* Campos numéricos/opcionais da unidade chegam como '' quando o vendedor
     deixa em branco (ex.: dimensões da cabine) — Postgres rejeita '' em
     coluna numeric ("invalid input syntax for type numeric"). '' vira null
     pra qualquer coluna (texto aceita null igual). */
  function limparVazios(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => { out[k] = obj[k] === '' ? null : obj[k]; });
    return out;
  }

  async function adicionarUnidade(formularioId, unidade) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const id = novoId('FEU');
    const { data: existentes } = await c.from('formularios_elevador_unidades')
      .select('indice_ativo').eq('formulario_id', formularioId);
    const proximoIndice = (existentes || []).reduce((max, u) => Math.max(max, u.indice_ativo || 0), 0) + 1;
    const { data, error } = await c.from('formularios_elevador_unidades').insert({
      id, formulario_id: formularioId, ...limparVazios(unidade), indice_ativo: proximoIndice,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizarUnidade(unidadeId, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador_unidades').update(limparVazios(patch)).eq('id', unidadeId);
    if (error) throw error;
  }

  async function removerUnidade(unidadeId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador_unidades').delete().eq('id', unidadeId);
    if (error) throw error;
  }

  async function listar(filtros = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    let q = c.from('formularios_elevador').select('*, formularios_elevador_unidades(count)').order('created_at', { ascending: false });
    if (filtros.status) q = q.eq('status', filtros.status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  /* ---------- Controle de Cotações (histórico da planilha + cotações novas) ---------- */
  async function listarCotacoes() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const [{ data: hist, error: e1 }, { data: novos, error: e2 }] = await Promise.all([
      c.from('cotacoes_elevador_historico').select('*'),
      c.from('formularios_elevador').select('numero_cotacao, created_at, vendedor, origem_venda, status, local_obra_cidade, local_obra_estado, clientes(razao_social, cnpj)'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const unificado = [
      ...(hist || []).map((h) => ({
        id: h.id, numero_cotacao: h.numero_cotacao, data: h.data, vendedor: h.vendedor, origem_venda: h.origem_venda,
        nome_cliente: h.nome_cliente, cnpj_comprador: h.cnpj_comprador, estado_instalacao: h.estado_instalacao,
        status: h.status, origem: 'historico',
      })),
      ...(novos || []).map((f) => ({
        numero_cotacao: f.numero_cotacao, data: f.created_at, vendedor: f.vendedor, origem_venda: f.origem_venda,
        nome_cliente: f.clientes?.razao_social || null, cnpj_comprador: f.clientes?.cnpj || null,
        estado_instalacao: f.local_obra_estado, status: f.status, origem: 'formulario',
      })),
    ];
    return unificado.sort((a, b) => (b.numero_cotacao || 0) - (a.numero_cotacao || 0));
  }

  /* ---------- Anexos (projeto civil da obra) ----------
     Bucket privado formulario-elevador-anexos — mesmo padrão de bucket
     privado + URL assinada de ficha-tecnica-imagens.js (window.FTImg),
     mas sem compressão (não são fotos, são PDF/DWG/plantas). */
  const FEA_BUCKET = 'formulario-elevador-anexos';

  function fea_slugify(s) {
    return String(s || 'arquivo')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || 'arquivo';
  }

  /* categoria: 'projeto_civil' (default, uso interno — planta/memorial) ou
     'fornecedor' (anexos que vão junto no envio da cotação técnica, ex.:
     plantas, DWG, fotos que o fornecedor precisa ver). Mesma tabela, mesmo
     bucket — só filtra/rotula diferente. */
  async function listarAnexos(formularioId, categoria) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    let q = c.from('formularios_elevador_anexos').select('*').eq('formulario_id', formularioId);
    if (categoria) q = q.eq('categoria', categoria);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function anexarArquivo(formularioId, file, categoria) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const nomeSeguro = fea_slugify(file.name);
    const path = `${formularioId}/${Date.now()}-${nomeSeguro}`;
    const { error: upErr } = await c.storage.from(FEA_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (upErr) throw upErr;
    const { data, error } = await c.from('formularios_elevador_anexos').insert({
      formulario_id: formularioId,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      tipo_arquivo: file.type || null,
      path,
      categoria: categoria || 'projeto_civil',
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function urlAssinadaAnexo(path, ttlSeconds) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(FEA_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async function removerAnexo(anexo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    await c.storage.from(FEA_BUCKET).remove([anexo.path]);
    const { error } = await c.from('formularios_elevador_anexos').delete().eq('id', anexo.id);
    if (error) throw error;
  }

  window.FormularioElevadorStore = {
    buscarOuCriarCliente,
    criar, salvar, obter, obterPorToken, gerarLinkPublico, enviar, enviarDiretoParaPrecificacao, listar, listarCotacoes,
    adicionarUnidade, atualizarUnidade, removerUnidade,
    publicUrl, formatarEndereco, listarFornecedores,
    listarModelosElevador, listarOpcoesElevador,
    listarAnexos, anexarArquivo, urlAssinadaAnexo, removerAnexo,
  };
})();
