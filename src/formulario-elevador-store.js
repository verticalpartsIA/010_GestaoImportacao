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
    const { data, error } = await c.from('clientes').insert({
      razao_social: dados.razao_social || null,
      cnpj: dados.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: dados.tipo_pessoa === 'PF' ? (doc || null) : null,
      tipo_pessoa: dados.tipo_pessoa || 'PJ',
      inscricao_estadual: dados.inscricao_estadual || null,
      contribuinte_icms: dados.contribuinte_icms ?? null,
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
      endereco: formatarEndereco(enderecoPartes(dados, 'endereco_')) || null,
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
    return data;
  }

  async function salvar(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const resolved = { ...patch };
    if (resolved.endereco_logradouro !== undefined) {
      resolved.endereco = formatarEndereco(enderecoPartes(resolved, 'endereco_')) || null;
    }
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
    const { data: header, error } = await c.from('formularios_elevador').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: unidades } = await c.from('formularios_elevador_unidades')
      .select('*').eq('formulario_id', id).order('created_at', { ascending: true });
    return { ...header, unidades: unidades || [] };
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

  /* ---------- Unidades (um elevador por linha) ---------- */
  async function adicionarUnidade(formularioId, unidade) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const id = novoId('FEU');
    const { data, error } = await c.from('formularios_elevador_unidades').insert({
      id, formulario_id: formularioId, ...unidade,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizarUnidade(unidadeId, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador_unidades').update(patch).eq('id', unidadeId);
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
        numero_cotacao: h.numero_cotacao, data: h.data, vendedor: h.vendedor, origem_venda: h.origem_venda,
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

  window.FormularioElevadorStore = {
    buscarOuCriarCliente,
    criar, salvar, obter, obterPorToken, gerarLinkPublico, enviar, listar, listarCotacoes,
    adicionarUnidade, atualizarUnidade, removerUnidade,
    publicUrl, formatarEndereco, listarFornecedores,
  };
})();
