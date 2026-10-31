/* ============================================================
   cadastros-clientes-store.js
   Cadastros · Clientes — CRUD sobre a tabela `clientes` já existente
   (criada nos bastidores pelo Formulário de Elevador quando alguém
   preenche CNPJ/razão social — ver formulario-elevador-store.js). Esta
   tela dá a essa tabela uma interface própria de consulta/edição/criação
   manual, além do código humano (VPCLI-0001...).

   window.CadastrosClientesStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Usa sequência nativa do PostgreSQL (seq_clientes_codigo) pra evitar race condition.
     Antes usava MAX em JS — se 2+ usuários criavam clientes simultaneamente,
     ambos calculavam o mesmo código e a 2ª inserção falhava com "duplicate key".
     Agora PostgreSQL garante unicidade da sequência.

     21/09 — achado real: o fallback aqui era a string fixa 'VPCLI-0001' pra
     QUALQUER falha (RPC ausente, erro de rede, etc). A função gerar_codigo_
     cliente() ficou ausente em produção por ~2 dias (migration nunca
     aplicada) e esse fallback colidiu SEMPRE com um cliente real que já
     tinha esse código desde abril — todo usuário travava salvando o
     Formulário, com um erro de constraint do banco, difícil de entender.
     Um fallback fixo pra um valor garantido a colidir não é fallback, é
     uma bomba-relógio — melhor falhar alto e claro do que silenciar e
     tentar um código que sabidamente já existe. */
  async function gerarCodigo() {
    const c = sb();
    if (!c) throw new Error('Não foi possível gerar o código do cliente: conexão com o banco indisponível.');
    const { data, error } = await c.rpc('gerar_codigo_cliente');
    if (error) {
      console.error('[CadastrosClientesStore] gerarCodigo — RPC gerar_codigo_cliente falhou', error);
      throw new Error('Não foi possível gerar o código do cliente agora. Tente novamente em instantes; se persistir, avise o suporte (função gerar_codigo_cliente indisponível).');
    }
    if (!data) throw new Error('Não foi possível gerar o código do cliente: resposta vazia do banco.');
    return data;
  }

  /* 14/09 — achado real: depois da importação Omie (191 -> 1212 clientes),
     a lista passou a mostrar só 1000 — o PostgREST tem limite padrão de
     1000 linhas por select() sem .range(), e ninguém tinha notado porque
     a tabela nunca tinha passado disso antes. Pagina em blocos de 1000
     até a página vir incompleta (sinal de que chegou ao fim). */
  /* T4 #1224 (31/10/2026): devolve também o erro — antes uma página que falhasse no meio deixava a lista
     PARCIAL em silêncio. `listarTodos` continua devolvendo só a lista (contrato dos outros módulos). */
  async function listarTodosDetalhado() {
    const c = sb(); if (!c) return { itens: [], erro: 'Banco de dados indisponível — recarregue a página.' };
    const PAGE = 1000;
    let todos = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await c.from('clientes').select('*')
        .order('criado_em', { ascending: false }).range(from, from + PAGE - 1);
      if (error) { console.warn('[CadastrosClientesStore] listarTodos falhou', error); return { itens: todos, erro: error.message || 'falha ao ler os clientes' }; }
      todos = todos.concat(data || []);
      if (!data || data.length < PAGE) break;
    }
    return { itens: todos, erro: null };
  }

  async function listarTodos() { return (await listarTodosDetalhado()).itens; }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('clientes').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* "Vida do Cliente" — canal de entrada + vendedor vêm de leads.cliente_id
     (vínculo real, já usado pelo Detalhe de Lead); obras/equipamentos/
     instaladores vêm de dossier_obra.cliente_id (vínculo manual, recém
     criado — só aparece o que já foi vinculado). Score fica pra depois:
     precisa de regra de negócio que ainda não foi definida. */
  async function historicoCliente(clienteId) {
    const c = sb(); if (!c || !clienteId) return null;

    const { data: leads } = await c.from('leads')
      .select('id, building, origin, owner, status, date').eq('cliente_id', clienteId)
      .order('date', { ascending: true });

    /* Auditoria 12/10: só 2 de 67 dossiês têm cliente_id gravado — a "Vida do Cliente" quase nunca mostrava obras.
       Agora a obra do cliente = dossiê com cliente_id OU ligado a um lead dele OU a uma cotação (formulário) dele. */
    const colunas = 'id, building_name, status_master, created_at';
    const leadIds = (leads || []).map((l) => l.id);
    const { data: forms } = await c.from('formularios_elevador').select('numero_cotacao').eq('cliente_id', clienteId);
    const cotacoes = (forms || []).map((f) => f.numero_cotacao).filter((n) => n != null);
    const consultas = [c.from('dossier_obra').select(colunas).eq('cliente_id', clienteId)];
    if (leadIds.length) consultas.push(c.from('dossier_obra').select(colunas).in('lead_id', leadIds));
    if (cotacoes.length) consultas.push(c.from('dossier_obra').select(colunas).in('numero_cotacao', cotacoes));
    const resultados = await Promise.all(consultas);
    const porId = new Map();
    resultados.forEach((r) => (r.data || []).forEach((o) => porId.set(o.id, o)));
    const obras = [...porId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    const dossierIds = (obras || []).map((o) => o.id);
    let equipamentos = [], roster = [];
    if (dossierIds.length > 0) {
      const [{ data: eq }, { data: rost }] = await Promise.all([
        c.from('equipamentos_obra').select('dossier_id, numero_serie, parceiros_instaladores(nome)').in('dossier_id', dossierIds),
        c.from('dossier_obra_instaladores').select('dossier_id, parceiros_instaladores(nome)').in('dossier_id', dossierIds),
      ]);
      equipamentos = eq || []; roster = rost || [];
    }

    return { leads: leads || [], obras: obras || [], equipamentos, roster };
  }

  function formatarEndereco(p) {
    const partes = [p.logradouro, p.complemento, p.bairro, p.cidade && p.estado ? `${p.cidade}/${p.estado}` : (p.cidade || p.estado), p.cep].filter(Boolean);
    return partes.join(', ') || null;
  }

  function _payload(form) {
    // O documento vem do campo que combina com o tipo escolhido na lista (PF → CPF, PJ → CNPJ) e precisa conferir (04/10/2026).
    const tipoDoc = form.tipo_pessoa === 'PF' ? 'PF' : 'PJ';
    const bruto = tipoDoc === 'PF' ? form.cpf : form.cnpj;
    const val = window.EnderecoAPI && window.EnderecoAPI.validarDocumento ? window.EnderecoAPI.validarDocumento(tipoDoc, bruto) : { ok: true, digitos: String(bruto || '').replace(/\D/g, '') };
    if (!val.ok) throw new Error(val.msg);
    const doc = val.digitos;
    const endereco = {
      logradouro: form.endereco_logradouro, complemento: form.endereco_complemento, bairro: form.endereco_bairro,
      cep: form.endereco_cep, cidade: form.endereco_cidade, estado: form.endereco_estado,
    };
    return {
      razao_social: form.razao_social || null, nome_fantasia: form.nome_fantasia || null,
      tipo_pessoa: form.tipo_pessoa || 'PJ',
      cnpj: form.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: form.tipo_pessoa === 'PF' ? (doc || null) : null,
      inscricao_estadual: form.inscricao_estadual || null,
      contribuinte_icms: typeof form.contribuinte_icms === 'boolean' ? form.contribuinte_icms : null,
      /* 14/09 — achado real (auditoria do tour.md): documento_pendente já
         existia na tabela (gravado por Leads/Formulário quando o cliente
         nasce sem CNPJ/CPF ainda), mas este store nunca lia nem escrevia
         essa coluna — o cadastro mestre não deixava ver nem resolver a
         pendência. */
      documento_pendente: typeof form.documento_pendente === 'boolean' ? form.documento_pendente : false,
      email: form.email || null, telefone: form.telefone || null, contato: form.contato || null,
      endereco_logradouro: form.endereco_logradouro || null, endereco_complemento: form.endereco_complemento || null,
      endereco_bairro: form.endereco_bairro || null, endereco_cep: form.endereco_cep || null,
      endereco_cidade: form.endereco_cidade || null, endereco_estado: form.endereco_estado || null,
      endereco: formatarEndereco(endereco), cidade: form.endereco_cidade || null, estado: form.endereco_estado || null,
      ativo: form.ativo !== false,
    };
  }

  /* T2 #1222 (31/10/2026): o mesmo CNPJ/CPF não pode ter dois cadastros (o banco também recusa, por índice
     único). Confere antes de gravar para dizer QUAL cadastro já usa o documento; falha ao conferir = não grava. */
  async function garantirDocumentoUnico(c, row, idAtual) {
    const campo = row.cnpj ? 'cnpj' : (row.cpf ? 'cpf' : null);
    if (!campo) return;
    let q = c.from('clientes').select('id, codigo, razao_social, ativo').eq(campo, row[campo]).limit(1);
    if (idAtual) q = q.neq('id', idAtual);
    const { data, error } = await q;
    if (error) throw new Error('Não foi possível conferir se o ' + campo.toUpperCase() + ' já está cadastrado — nada foi gravado. (' + (error.message || 'erro') + ')');
    const ja = data && data[0];
    if (ja) throw new Error('Este ' + campo.toUpperCase() + ' já está cadastrado em ' + (ja.codigo || 'outro cliente') + ' — ' + (ja.razao_social || '') + (ja.ativo === false ? ' (inativo: reative esse cadastro em vez de criar outro)' : '') + '.');
  }

  /* Se o banco recusar pelo índice único (duas pessoas ao mesmo tempo), mostra a mesma mensagem clara. */
  function erroGravacao(error) {
    if (error && error.code === '23505' && /cnpj|cpf/i.test(String(error.message || '') + String(error.details || ''))) {
      return new Error('Este CNPJ/CPF já está cadastrado em outro cliente. Procure-o na lista (ele pode estar inativo).');
    }
    return error;
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.razao_social || !form.razao_social.trim()) throw new Error('Informe a razão social / nome.');
    const base = _payload(form);
    await garantirDocumentoUnico(c, base, null);
    const codigo = await gerarCodigo();
    /* criado_por na tabela clientes é uuid (auth.users) — não dá pra gravar
       o e-mail ali (formulario-elevador-store.js também não grava). */
    const row = { ...base, codigo };
    const { data, error } = await c.from('clientes').insert(row).select().single();
    if (error) throw erroGravacao(error);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Criou cliente', alvo: data.razao_social, alvo_id: data.id,
    });
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), atualizado_em: new Date().toISOString() };
    await garantirDocumentoUnico(c, row, id);
    const { data, error } = await c.from('clientes').update(row).eq('id', id).select().single();
    if (error) throw erroGravacao(error);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Editou cliente', alvo: data.razao_social, alvo_id: id,
    });
    return data;
  }

  /* 🔒 ÁREA BLINDADA (CLAUDE.md, 31/10/2026): cliente com transação nunca é excluído — só inativado.
     A lista de transações vem do banco (cadastro_vinculos), a mesma regra da trava BEFORE DELETE.
     Falha ao conferir = lança erro (nunca deixa apagar sem conferir). Devolve [{ fonte, qtd }]. */
  async function vinculos(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.rpc('cadastro_vinculos', { p_tipo: 'cliente', p_id: id });
    if (error) throw new Error('Não foi possível conferir as transações deste cliente — nada foi excluído. (' + (error.message || 'erro') + ')');
    return Array.isArray(data) ? data : [];
  }

  async function inativar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('clientes').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', id).select('id, razao_social').single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Cadastros', acao: 'Inativou cliente', alvo: data.razao_social, alvo_id: id });
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const lista = await vinculos(id);
    if (lista.length > 0) {
      const err = new Error('Cliente com transação não pode ser excluído: ' + lista.map((v) => `${v.fonte} (${v.qtd})`).join(', ') + '. Inative o cadastro.');
      err.vinculos = lista;
      throw err;
    }
    const { data: apagados, error } = await c.from('clientes').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!apagados || apagados.length === 0) throw new Error('O cliente não foi excluído (nenhuma linha apagada).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Excluiu cliente', alvo_id: id,
    });
  }

  /* Promoção Lead → Cliente (Central de Decisões concordou: Lead continua
     em Comercial, mas ao converter — Análise Técnica aprovada, ver
     analise-tecnica-store.js — vira cadastro real). Idempotente por
     leads.cliente_id: chamar de novo pro mesmo lead não duplica.
     Lead não tem CNPJ (só captura isso lá no Formulário), então o
     dedup aqui é por razao_social exata — best-effort, não tem doc pra
     casar com precisão como buscarOuCriarCliente (CNPJ) já faz. */
  /* Lead convertido deixa de ser lead e passa a ser cliente (pedido do usuário, 14/10/2026): os pedidos de
     Quadro de Comando que nasceram desse lead (quadros_comando.lead_id) passam a apontar para o cliente.
     Só preenche quem ainda não tem cliente (nunca troca um vínculo que já existe) e nunca derruba a
     conversão: falha só avisa no console, o vínculo é refeito na próxima conversão/edição do lead. */
  async function vincularQuadrosDoLead(leadId, clienteId) {
    const c = sb(); if (!c || !leadId || !clienteId) return 0;
    const { data, error } = await c.from('quadros_comando')
      .update({ cliente_id: clienteId }).eq('lead_id', leadId).is('cliente_id', null).select('id');
    if (error) { console.warn('[clientes] não vinculou os pedidos de quadro do lead ao cliente:', error); return 0; }
    return (data || []).length;
  }

  /* Resposta de Contribuinte de ICMS dada no Lead completa o cliente só se ele ainda não tem (nunca troca valor já definido). */
  async function completarContribuinte(clienteId, valor) {
    const c = sb(); if (!c || typeof valor !== 'boolean') return;
    await c.from('clientes').update({ contribuinte_icms: valor }).eq('id', clienteId).is('contribuinte_icms', null);
  }

  function escolherHomonimo(lista, lead) {
    if (lista.length <= 1) return lista[0] || null;
    const dig = (v) => String(v || '').replace(/\D/g, '');
    const email = String(lead.email || '').trim().toLowerCase();
    const tel = dig(lead.phone).slice(-8);
    const pontos = (cl) => {
      let p = 0;
      if (email && String(cl.email || '').toLowerCase().split(/[,;\s]+/).includes(email)) p += 4;
      if (tel.length === 8 && dig(cl.telefone).includes(tel)) p += 2;
      if (cl.ativo !== false) p += 1;
      return p;
    };
    const ordenados = lista.map((cl, i) => ({ cl, i, p: pontos(cl) })).sort((a, b) => b.p - a.p || a.i - b.i);
    if (ordenados[0].p < 2) console.warn('[CadastrosClientesStore] lead com nome igual a', lista.length, 'clientes; sem e-mail/telefone para desempatar — vinculado ao primeiro.');
    return ordenados[0].cl;
  }

  async function criarOuVincularDeLead(lead) {
    const c = sb(); if (!c || !lead) return null;
    const { data: leadRow } = await c.from('leads').select('cliente_id').eq('id', lead.id).maybeSingle();
    if (leadRow?.cliente_id) { await completarContribuinte(leadRow.cliente_id, lead.contribuinte_icms); await vincularQuadrosDoLead(lead.id, leadRow.cliente_id); return leadRow.cliente_id; }

    const nome = (lead.building || lead.contact || '').trim();
    if (!nome) return null;

    let cliente = null;
    /* Auditoria 12/10: `.maybeSingle()` dava erro com 2+ clientes de mesmo nome (o erro era ignorado → criava
       mais um duplicado) e `%`/`_` no nome viravam curinga do ilike. Agora escapa os curingas e usa limit(1). */
    const nomeLike = nome.replace(/[\\%_]/g, (m) => '\\' + m);
    /* T8 #1228 (31/10/2026): com 2+ clientes de mesmo nome (filiais, cadastro antigo), desempata pelo e-mail
       e depois pelo telefone do lead, preferindo o ativo; sem desempate fica o primeiro (como antes) e avisa no console. */
    const { data: achados, error: errBusca } = await c.from('clientes').select('id, email, telefone, ativo').ilike('razao_social', nomeLike).limit(20);
    if (errBusca) throw errBusca;
    const existente = escolherHomonimo(achados || [], lead);
    if (existente) {
      cliente = existente;
      await completarContribuinte(existente.id, lead.contribuinte_icms);
    } else {
      cliente = await criar({ razao_social: nome, contato: lead.contact || null, telefone: lead.phone || null, email: lead.email || null,
        contribuinte_icms: typeof lead.contribuinte_icms === 'boolean' ? lead.contribuinte_icms : null });
    }
    const { error: errVinc } = await c.from('leads').update({ cliente_id: cliente.id }).eq('id', lead.id);
    if (errVinc) throw errVinc;
    await vincularQuadrosDoLead(lead.id, cliente.id);
    return cliente.id;
  }

  window.CadastrosClientesStore = { gerarCodigo, listarTodos, listarTodosDetalhado, obter, criar, atualizar, remover, vinculos, inativar, criarOuVincularDeLead, vincularQuadrosDoLead, historicoCliente };
}());
