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
     Agora PostgreSQL garante unicidade da sequência. */
  async function gerarCodigo() {
    const c = sb(); if (!c) return 'VPCLI-0001';
    const { data, error } = await c.rpc('gerar_codigo_cliente');
    if (error) {
      console.warn('[CadastrosClientesStore] gerarCodigo falhou, fallback', error);
      return 'VPCLI-0001';
    }
    return data || 'VPCLI-0001';
  }

  /* 14/09 — achado real: depois da importação Omie (191 -> 1212 clientes),
     a lista passou a mostrar só 1000 — o PostgREST tem limite padrão de
     1000 linhas por select() sem .range(), e ninguém tinha notado porque
     a tabela nunca tinha passado disso antes. Pagina em blocos de 1000
     até a página vir incompleta (sinal de que chegou ao fim). */
  async function listarTodos() {
    const c = sb(); if (!c) return [];
    const PAGE = 1000;
    let todos = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await c.from('clientes').select('*')
        .order('criado_em', { ascending: false }).range(from, from + PAGE - 1);
      if (error) { console.warn('[CadastrosClientesStore] listarTodos falhou', error); return todos; }
      todos = todos.concat(data || []);
      if (!data || data.length < PAGE) break;
    }
    return todos;
  }

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

    const { data: obras } = await c.from('dossier_obra')
      .select('id, building_name, status_master, created_at').eq('cliente_id', clienteId)
      .order('created_at', { ascending: true });

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
    const doc = (form.cnpj || form.cpf || '').replace(/\D/g, '');
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

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.razao_social || !form.razao_social.trim()) throw new Error('Informe a razão social / nome.');
    const codigo = await gerarCodigo();
    /* criado_por na tabela clientes é uuid (auth.users) — não dá pra gravar
       o e-mail ali (formulario-elevador-store.js também não grava). */
    const row = { ..._payload(form), codigo };
    const { data, error } = await c.from('clientes').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), atualizado_em: new Date().toISOString() };
    const { data, error } = await c.from('clientes').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('clientes').delete().eq('id', id);
    if (error) throw error;
  }

  /* Promoção Lead → Cliente (Central de Decisões concordou: Lead continua
     em Comercial, mas ao converter — Análise Técnica aprovada, ver
     analise-tecnica-store.js — vira cadastro real). Idempotente por
     leads.cliente_id: chamar de novo pro mesmo lead não duplica.
     Lead não tem CNPJ (só captura isso lá no Formulário), então o
     dedup aqui é por razao_social exata — best-effort, não tem doc pra
     casar com precisão como buscarOuCriarCliente (CNPJ) já faz. */
  async function criarOuVincularDeLead(lead) {
    const c = sb(); if (!c || !lead) return null;
    const { data: leadRow } = await c.from('leads').select('cliente_id').eq('id', lead.id).maybeSingle();
    if (leadRow?.cliente_id) return leadRow.cliente_id;

    const nome = (lead.building || lead.contact || '').trim();
    if (!nome) return null;

    let cliente = null;
    const { data: existente } = await c.from('clientes').select('id').ilike('razao_social', nome).maybeSingle();
    if (existente) {
      cliente = existente;
    } else {
      cliente = await criar({ razao_social: nome, contato: lead.contact || null, telefone: lead.phone || null, email: lead.email || null });
    }
    await c.from('leads').update({ cliente_id: cliente.id }).eq('id', lead.id);
    return cliente.id;
  }

  window.CadastrosClientesStore = { gerarCodigo, listarTodos, obter, criar, atualizar, remover, criarOuVincularDeLead, historicoCliente };
}());
