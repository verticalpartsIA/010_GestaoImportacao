/* ============================================================
   cadastros-fornecedores-store.js
   Cadastros · Fornecedores — cadastro único (com categorias[]) em vez de
   um cadastro por tipo de prestador (Fornecedor / Agente de Carga /
   Transportador / Prestador IMS). Código humano VPFOR-0001...

   window.CadastrosFornecedoresStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const CATEGORIAS = ['Fornecedor', 'Agente de Carga', 'Transportador', 'Prestador IMS'];

  /* T3 #1223 (31/10/2026): o código vem da sequência do banco (RPC gerar_codigo_fornecedor), igual ao de
     clientes. Antes era calculado no navegador (maior código + 1): dois cadastros ao mesmo tempo podiam gerar
     o mesmo código, e sem banco caía num 'VPFOR-0001' fixo, que colide sempre. Falha = erro claro, sem chute. */
  async function gerarCodigo() {
    const c = sb();
    if (!c) throw new Error('Não foi possível gerar o código do fornecedor: conexão com o banco indisponível.');
    const { data, error } = await c.rpc('gerar_codigo_fornecedor');
    if (error) {
      console.error('[CadastrosFornecedoresStore] gerarCodigo — RPC gerar_codigo_fornecedor falhou', error);
      throw new Error('Não foi possível gerar o código do fornecedor agora. Tente novamente em instantes; se persistir, avise o suporte (função gerar_codigo_fornecedor indisponível).');
    }
    if (!data) throw new Error('Não foi possível gerar o código do fornecedor: resposta vazia do banco.');
    return data;
  }

  /* T4 #1224 (31/10/2026): lê de 1000 em 1000 (o PostgREST corta em 1000 linhas sem avisar) e devolve o erro,
     para a tela avisar "lista incompleta" em vez de mostrar uma lista parcial como se fosse a inteira. */
  async function lerPaginado(montar) {
    const PAGE = 1000;
    let todos = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await montar().range(from, from + PAGE - 1);
      if (error) return { itens: todos, erro: error.message || 'falha de leitura' };
      todos = todos.concat(data || []);
      if (!data || data.length < PAGE) break;
    }
    return { itens: todos, erro: null };
  }

  async function listarTodosDetalhado() {
    const c = sb(); if (!c) return { itens: [], erro: 'Banco de dados indisponível — recarregue a página.' };
    const r = await lerPaginado(() => c.from('fornecedores').select('*').order('criado_em', { ascending: false }).order('id'));
    if (r.erro) console.warn('[CadastrosFornecedoresStore] listarTodos falhou', r.erro);
    return r;
  }

  /* T6 #1226 (31/10/2026): acha o cadastro de um fornecedor citado pelo nome (P.I., Embarque), para gravar o
     vínculo ao lado do nome. Regra: se já havia um vínculo e o nome ainda é o desse cadastro, mantém; senão,
     só liga quando o nome bate EXATAMENTE (sem acento/maiúscula) com UM cadastro (razão social ou fantasia).
     Nome que não bate ou bate com 2+ cadastros = sem vínculo (null) — nunca adivinha. Falha de leitura = null. */
  let _cacheNomes = null, _cacheEm = 0;
  function _norm(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  async function _todosParaVinculo() {
    if (_cacheNomes && Date.now() - _cacheEm < 60000) return _cacheNomes;
    const c = sb(); if (!c) return null;
    const r = await lerPaginado(() => c.from('fornecedores').select('id, razao_social, nome_fantasia').order('id'));
    if (r.erro) return null;
    _cacheNomes = r.itens; _cacheEm = Date.now();
    return _cacheNomes;
  }
  function idPorNome(lista, nome, idAtual) {
    const n = _norm(nome);
    if (!n || !Array.isArray(lista)) return null;
    const casa = (f) => _norm(f.razao_social) === n || (f.nome_fantasia && _norm(f.nome_fantasia) === n);
    if (idAtual) { const atual = lista.find((f) => f.id === idAtual); if (atual && casa(atual)) return idAtual; }
    const achados = lista.filter(casa);
    return achados.length === 1 ? achados[0].id : null;
  }
  async function resolverIdPorNome(nome, idAtual) {
    if (!_norm(nome)) return null;
    const lista = await _todosParaVinculo();
    if (!lista) return idAtual || null;
    return idPorNome(lista, nome, idAtual);
  }

  async function listarTodos() { return (await listarTodosDetalhado()).itens; }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('fornecedores').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* Sugestões pra datalist noutros módulos (P.I./RFQ/Embarques/IMS) — nome
     + categorias, sem obrigar ninguém a migrar campo livre pra FK ainda.
     11/09 — ganhou email/telefone/contato: o RFQ (formulario-elevador.jsx)
     passou a capturar o e-mail do fornecedor direto daqui em vez de um
     mapa hardcoded (achado real: e-mail da Victória/VERTICALPARTS estava
     fixo no código, desalinhado do cadastro de verdade). */
  async function listarAtivos(categoria) {
    const c = sb(); if (!c) return [];
    let q = c.from('fornecedores').select('id, codigo, razao_social, nome_fantasia, categorias, email, telefone, contato').eq('ativo', true);
    if (categoria) q = q.contains('categorias', [categoria]);
    const { data, error } = await q.order('razao_social');
    if (error) return [];
    return data || [];
  }

  function _payload(form) {
    // O documento vem do campo que combina com o tipo escolhido na lista (PF → CPF, PJ → CNPJ) e precisa conferir (04/10/2026).
    const tipoDoc = form.tipo_pessoa === 'PF' ? 'PF' : 'PJ';
    const bruto = tipoDoc === 'PF' ? form.cpf : form.cnpj;
    const val = window.EnderecoAPI && window.EnderecoAPI.validarDocumento ? window.EnderecoAPI.validarDocumento(tipoDoc, bruto) : { ok: true, digitos: String(bruto || '').replace(/\D/g, '') };
    if (!val.ok) throw new Error(val.msg);
    const doc = val.digitos;
    return {
      razao_social: form.razao_social || null, nome_fantasia: form.nome_fantasia || null,
      tipo_pessoa: form.tipo_pessoa || 'PJ',
      cnpj: form.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: form.tipo_pessoa === 'PF' ? (doc || null) : null,
      categorias: form.categorias || [],
      email: form.email || null, telefone: form.telefone || null, contato: form.contato || null,
      endereco_logradouro: form.endereco_logradouro || null, endereco_complemento: form.endereco_complemento || null,
      endereco_bairro: form.endereco_bairro || null, endereco_cep: form.endereco_cep || null,
      endereco_cidade: form.endereco_cidade || null, endereco_estado: form.endereco_estado || null,
      observacoes: form.observacoes || null, ativo: form.ativo !== false,
    };
  }

  /* T2 #1222 (31/10/2026): o mesmo CNPJ/CPF não pode ter dois cadastros (o banco também recusa, por índice
     único). Confere antes de gravar para dizer QUAL cadastro já usa o documento; falha ao conferir = não grava. */
  async function garantirDocumentoUnico(c, row, idAtual) {
    const campo = row.cnpj ? 'cnpj' : (row.cpf ? 'cpf' : null);
    if (!campo) return;
    let q = c.from('fornecedores').select('id, codigo, razao_social, ativo').eq(campo, row[campo]).limit(1);
    if (idAtual) q = q.neq('id', idAtual);
    const { data, error } = await q;
    if (error) throw new Error('Não foi possível conferir se o ' + campo.toUpperCase() + ' já está cadastrado — nada foi gravado. (' + (error.message || 'erro') + ')');
    const ja = data && data[0];
    if (ja) throw new Error('Este ' + campo.toUpperCase() + ' já está cadastrado em ' + (ja.codigo || 'outro fornecedor') + ' — ' + (ja.razao_social || '') + (ja.ativo === false ? ' (inativo: reative esse cadastro em vez de criar outro)' : '') + '.');
  }

  /* Se o banco recusar pelo índice único (duas pessoas ao mesmo tempo), mostra a mesma mensagem clara. */
  function erroGravacao(error) {
    if (error && error.code === '23505' && /cnpj|cpf/i.test(String(error.message || '') + String(error.details || ''))) {
      return new Error('Este CNPJ/CPF já está cadastrado em outro fornecedor. Procure-o na lista (ele pode estar inativo).');
    }
    return error;
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.razao_social || !form.razao_social.trim()) throw new Error('Informe a razão social / nome.');
    if (!form.categorias || form.categorias.length === 0) throw new Error('Selecione ao menos uma categoria.');
    const base = _payload(form);
    await garantirDocumentoUnico(c, base, null);
    const codigo = await gerarCodigo();
    const row = { ...base, codigo, criado_por: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('fornecedores').insert(row).select().single();
    if (error) throw erroGravacao(error);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Criou fornecedor', alvo: data.razao_social, alvo_id: data.id,
    });
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), atualizado_em: new Date().toISOString() };
    await garantirDocumentoUnico(c, row, id);
    const { data, error } = await c.from('fornecedores').update(row).eq('id', id).select().single();
    if (error) throw erroGravacao(error);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Editou fornecedor', alvo: data.razao_social, alvo_id: id,
    });
    return data;
  }

  /* 🔒 ÁREA BLINDADA (CLAUDE.md, 31/10/2026): fornecedor com transação (inclusive citado pelo nome ou com
     e-mails trocados) nunca é excluído — só inativado. Regra no banco (cadastro_vinculos), a mesma da trava
     BEFORE DELETE. Falha ao conferir = lança erro. Devolve [{ fonte, qtd }]. */
  async function vinculos(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.rpc('cadastro_vinculos', { p_tipo: 'fornecedor', p_id: id });
    if (error) throw new Error('Não foi possível conferir as transações deste fornecedor — nada foi excluído. (' + (error.message || 'erro') + ')');
    return Array.isArray(data) ? data : [];
  }

  async function inativar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('fornecedores').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', id).select('id, razao_social').single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Cadastros', acao: 'Inativou fornecedor', alvo: data.razao_social, alvo_id: id });
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const lista = await vinculos(id);
    if (lista.length > 0) {
      const err = new Error('Fornecedor com transação não pode ser excluído: ' + lista.map((v) => `${v.fonte} (${v.qtd})`).join(', ') + '. Inative o cadastro.');
      err.vinculos = lista;
      throw err;
    }
    const { data: apagados, error } = await c.from('fornecedores').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!apagados || apagados.length === 0) throw new Error('O fornecedor não foi excluído (nenhuma linha apagada).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Excluiu fornecedor', alvo_id: id,
    });
  }

  /* ---------- Avaliações — nota + comentário, histórico por fornecedor ---------- */
  async function listarAvaliacoes(fornecedorId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('fornecedores_avaliacoes').select('*').eq('fornecedor_id', fornecedorId).order('avaliado_em', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async function avaliar(fornecedorId, { nota, comentario }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!nota || nota < 1 || nota > 5) throw new Error('Nota deve ser de 1 a 5.');
    const user = window.__VP_USER || {};
    const row = { fornecedor_id: fornecedorId, nota, comentario: comentario || null, avaliado_por: user.nome || user.email || null };
    const { data, error } = await c.from('fornecedores_avaliacoes').insert(row).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Avaliou fornecedor', alvo_id: fornecedorId, detalhe: { nota, comentario: comentario || null },
    });
    return data;
  }

  async function removerAvaliacao(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('fornecedores_avaliacoes').delete().eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Removeu avaliação de fornecedor', alvo_id: id,
    });
  }

  /* Média + contagem por fornecedor, pra mostrar na lista sem N+1 query. */
  async function mediasAvaliacoes() {
    const c = sb(); if (!c) return {};
    const r = await lerPaginado(() => c.from('fornecedores_avaliacoes').select('id, fornecedor_id, nota').order('id'));
    if (r.erro) return {};
    const map = {};
    r.itens.forEach((a) => {
      const m = map[a.fornecedor_id] || { soma: 0, qtd: 0 };
      m.soma += a.nota; m.qtd += 1;
      map[a.fornecedor_id] = m;
    });
    Object.keys(map).forEach((k) => { map[k].media = map[k].soma / map[k].qtd; });
    return map;
  }

  window.CadastrosFornecedoresStore = {
    CATEGORIAS, gerarCodigo, listarTodos, listarTodosDetalhado, listarAtivos, idPorNome, resolverIdPorNome, obter, criar, atualizar, remover, vinculos, inativar,
    listarAvaliacoes, avaliar, removerAvaliacao, mediasAvaliacoes,
  };
}());
