/* ============================================================
   proposta-aumento-store.js — grava e avisa o pedido de AUMENTO de valor
   (regras puras em proposta-aumento-calc.js).

   - Grava só o pedido (aumentoPendente/aumentoLog) dentro de propostas.data_json,
     SEM passar pela trava de "enviada/aprovada" de PropostaStore.salvar (decisão
     do Gelson: para aumentar a proposta fica destravada). Nenhum preço muda aqui.
   - Quem pede: dono da proposta (vendedor) ou o Líder (alçada de destravar), o
     mesmo critério de PropostaStore.podeOcultarEquipamento.
   - Avisos (tabela alertas → gi-avisos → WhatsApp): ida = Financeiro + gestor
     comercial + dono; volta = os mesmos; contrato refeito = Jurídico (Cleiton).
   - Falha de aviso nunca desfaz o pedido (só console.warn).

   window.PropostaAumentoStore
   ============================================================ */
(function () {
  'use strict';

  const ROTA_PRECIFICACAO = '/comercial/precificacao';
  /* Quem refaz o contrato quando o valor muda depois dele (decisão de 06/11/2026:
     antes Bianca, hoje Cleiton). Troca de pessoa = trocar aqui. */
  const EMAIL_JURIDICO = ['cleiton.domingos@verticalparts.com.br'];
  const DEPTO_FINANCEIRO = 'Adm/Financeiro';
  const EQS = ['elevador', 'escada', 'esteira'];

  function sb() { return (window.__VP_SB || {}).sb; }
  function A() { return window.PropostaAumento; }
  function meuEmail() { return ((window.__VP_USER || {}).email || '').trim().toLowerCase(); }

  /* Financeiro = líderes ativos do departamento; gestores comerciais = quem tem a
     alçada de destravar propostas (Regiane); dono = e-mail do perfil do vendedor. */
  async function emailsFinanceiro(c) {
    try {
      const { data } = await c.from('colaboradores_vpsistema').select('email')
        .eq('departamento', DEPTO_FINANCEIRO).eq('is_department_lead', true).eq('is_active', true);
      return (data || []).map((x) => x.email);
    } catch (e) { return []; }
  }
  async function emailsGestores(c) {
    try {
      const { data: caps } = await c.from('alcadas_capacidade').select('perfil_id')
        .eq('modulo', 'propostas').eq('capacidade', 'destravar_aprovada');
      const ids = (caps || []).map((x) => x.perfil_id);
      if (!ids.length) return [];
      const { data } = await c.from('perfis').select('email').in('id', ids);
      return (data || []).map((x) => x.email);
    } catch (e) { return []; }
  }
  async function emailDono(c, vendedorId) {
    if (!vendedorId) return [];
    try {
      const { data } = await c.from('perfis').select('email').eq('id', vendedorId).maybeSingle();
      return data && data.email ? [data.email] : [];
    } catch (e) { return []; }
  }

  async function enviarAvisos(c, emails, aviso, idBase, rota, level) {
    for (const email of emails) {
      try {
        await c.from('alertas').insert({
          id: `${idBase}-${email.replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
          level: level || 'info', title: aviso.titulo, sub: aviso.sub, module: 'Propostas',
          resolved: false, destinatario_email: email, rota: rota || null,
        });
      } catch (e) { console.warn('[PropostaAumentoStore] aviso falhou', e); }
    }
  }

  async function lerProposta(c, id) {
    const { data, error } = await c.from('propostas')
      .select('id, status, data_json, vendedor_id, numero_cotacao, numero_documento, precificacao_id, valor_total').eq('id', id).maybeSingle();
    if (error || !data) throw new Error('Não encontrei a proposta para gravar o pedido.');
    return data;
  }

  /* Acha o equipamento (e em qual bloco ele mora) dentro do data_json. */
  function acharItem(dj, itemId) {
    for (const eq of EQS) {
      const itens = dj && dj[eq] && dj[eq].valores && dj[eq].valores.itens;
      if (Array.isArray(itens)) {
        const idx = itens.findIndex((it) => it && it.id === itemId);
        if (idx >= 0) return { eq, idx, itens };
      }
    }
    return null;
  }

  async function pode(id) {
    return window.PropostaStore && window.PropostaStore.podeOcultarEquipamento
      ? window.PropostaStore.podeOcultarEquipamento(id) : false;
  }

  function outroNivelPendente(dj, nivel, itemId) {
    const itens = [];
    EQS.forEach((eq) => { const l = dj && dj[eq] && dj[eq].valores && dj[eq].valores.itens; if (Array.isArray(l)) itens.push(...l); });
    const lista = A().pendentesDaProposta(dj, itens);
    if (nivel === 'proposta') return lista.some((p) => p.nivel === 'equipamento');
    return lista.some((p) => p.nivel === 'proposta');
  }

  /* Preço que a PRECIFICAÇÃO tem agora para o alvo do pedido (equipamento ou total). Best-effort: sem leitura, null. */
  async function precoNaPrecificacao(numeroCotacao, nivel, itemId, ocultos) {
    try {
      if (!window.PropostaHeranca || numeroCotacao == null) return null;
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(String(numeroCotacao));
      const itens = r && r.encontrado && r.prefill && r.prefill.elevador && r.prefill.elevador.valores && r.prefill.elevador.valores.itens;
      if (!Array.isArray(itens) || !itens.length) return null;
      if (nivel === 'equipamento') {
        const it = itens.find((x) => x.id === itemId);
        return it ? A().parseNum(it.valorUnit) : null;
      }
      const oc = new Set(ocultos || []);
      return itens.filter((x) => !oc.has(x.id)).reduce((s, x) => s + A().parseNum(x.valorUnit) * (Number(x.quantidade) || 1), 0);
    } catch (e) { return null; }
  }

  /* nivel: 'equipamento' (itemId) | 'proposta' (valor total). */
  async function solicitar({ propostaId, nivel, itemId, valorAtual, valorPedido, motivo }) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o sistema.');
    if (!A()) throw new Error('Regras do pedido não carregadas — recarregue a página.');
    if (!(await pode(propostaId))) throw new Error('Só o dono da proposta ou o Líder pode pedir alteração de valor.');
    const row = await lerProposta(c, propostaId);
    const dj = row.data_json || {};
    const por = meuEmail();
    const ctx = { outroNivelPendente: outroNivelPendente(dj, nivel, itemId) };
    const ocultosAtuais = (dj.elevador && dj.elevador.valores && dj.elevador.valores.ocultos) || [];
    const precificacaoBase = await precoNaPrecificacao(row.numero_cotacao, nivel, itemId, ocultosAtuais);
    let novoDj; let alvoAtual; let rotulo = null;
    if (nivel === 'proposta') {
      alvoAtual = A().solicitar(dj, { valorAtual, valorPedido, motivo, por, precificacaoBase }, ctx);
      novoDj = { ...dj, aumentoPendente: alvoAtual.aumentoPendente, aumentoLog: alvoAtual.aumentoLog };
    } else {
      const achado = acharItem(dj, itemId);
      if (!achado) throw new Error('Equipamento não encontrado na proposta.');
      const ocultos = (dj[achado.eq].valores.ocultos || []);
      const item = { ...achado.itens[achado.idx], oculto: ocultos.includes(itemId) };
      alvoAtual = A().solicitar(item, { valorAtual, valorPedido, motivo, por, precificacaoBase }, ctx);
      const itensNovos = achado.itens.slice();
      itensNovos[achado.idx] = { ...achado.itens[achado.idx], aumentoPendente: alvoAtual.aumentoPendente, aumentoLog: alvoAtual.aumentoLog };
      novoDj = { ...dj, [achado.eq]: { ...dj[achado.eq], valores: { ...dj[achado.eq].valores, itens: itensNovos } } };
      rotulo = itemId;
    }
    const { error } = await c.from('propostas').update({ data_json: novoDj, atualizado_em: new Date().toISOString() }).eq('id', propostaId);
    if (error) throw new Error('Não foi possível gravar o pedido: ' + error.message);
    try { window.VPLog?.registrar({ modulo: 'Propostas', acao: 'Pediu aumento de valor ao Financeiro', alvo: 'Proposta', alvo_id: propostaId, detalhe: { nivel, item: itemId || null, valor_atual: valorAtual, valor_pedido: valorPedido, motivo: motivo || '' } }); } catch (_) {}
    try {
      const emails = A().destinatarios({
        financeiro: await emailsFinanceiro(c), gestores: await emailsGestores(c), dono: await emailDono(c, row.vendedor_id),
      });
      const aviso = A().montarAviso('ida', {
        cliente: (dj.cliente && dj.cliente.nome) || row.numero_documento, equipamento: rotulo, por: (window.__VP_USER || {}).nome || por,
        valorAtual, valorPedido, motivo, numeroCotacao: row.numero_cotacao,
      });
      await enviarAvisos(c, emails, aviso, 'aumento-ida', row.precificacao_id ? `${ROTA_PRECIFICACAO}/${row.precificacao_id}` : ROTA_PRECIFICACAO, 'warning');
    } catch (e) { console.warn('[PropostaAumentoStore] avisos de ida falharam', e); }
    return { data_json: novoDj, alvo: alvoAtual };
  }

  async function cancelar({ propostaId, nivel, itemId }) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o sistema.');
    if (!(await pode(propostaId))) throw new Error('Só o dono da proposta ou o Líder pode cancelar o pedido.');
    const row = await lerProposta(c, propostaId);
    const dj = row.data_json || {};
    const por = meuEmail();
    let novoDj;
    if (nivel === 'proposta') {
      const r = A().cancelar(dj, por);
      novoDj = { ...dj, aumentoPendente: null, aumentoLog: r.aumentoLog };
    } else {
      const achado = acharItem(dj, itemId);
      if (!achado) throw new Error('Equipamento não encontrado na proposta.');
      const r = A().cancelar(achado.itens[achado.idx], por);
      const itensNovos = achado.itens.slice(); itensNovos[achado.idx] = r;
      novoDj = { ...dj, [achado.eq]: { ...dj[achado.eq], valores: { ...dj[achado.eq].valores, itens: itensNovos } } };
    }
    const { error } = await c.from('propostas').update({ data_json: novoDj, atualizado_em: new Date().toISOString() }).eq('id', propostaId);
    if (error) throw new Error('Não foi possível cancelar o pedido: ' + error.message);
    try { window.VPLog?.registrar({ modulo: 'Propostas', acao: 'Cancelou pedido de aumento de valor', alvo: 'Proposta', alvo_id: propostaId, detalhe: { nivel, item: itemId || null } }); } catch (_) {}
    return { data_json: novoDj };
  }

  async function temContrato(c, propostaId) {
    try {
      const { data } = await c.from('contratos_venda_equipamentos').select('id, status').eq('proposta_id', propostaId).neq('status', 'em_preenchimento');
      return (data || []).length > 0;
    } catch (e) { return false; }
  }

  /* Colunas leves das propostas para achar pedidos abertos sem baixar o data_json inteiro. */
  const COLS_PEDIDO = 'id, numero_cotacao, numero_documento, vendedor_id, status, precificacao_id, valor_total, pend:data_json->aumentoPendente, '
    + 'ocultos:data_json->elevador->valores->ocultos, '
    + 'it_elevador:data_json->elevador->valores->itens, it_escada:data_json->escada->valores->itens, it_esteira:data_json->esteira->valores->itens';

  function pedidosDaLinha(row) {
    const lista = [];
    if (row.pend) lista.push({ propostaId: row.id, nivel: 'proposta', pedido: row.pend, propostaTotal: row.valor_total, precificacaoId: row.precificacao_id });
    ['it_elevador', 'it_escada', 'it_esteira'].forEach((k) => {
      (Array.isArray(row[k]) ? row[k] : []).forEach((it) => {
        if (it && it.aumentoPendente) lista.push({ propostaId: row.id, nivel: 'equipamento', itemId: it.id, valorUnitAtual: it.valorUnit, pedido: it.aumentoPendente, propostaTotal: row.valor_total, precificacaoId: row.precificacao_id });
      });
    });
    return lista;
  }

  async function linhasPorCotacao(c, numeros) {
    const nums = [...new Set((numeros || []).map(Number).filter((n) => Number.isFinite(n)))];
    const saida = [];
    for (let i = 0; i < nums.length; i += 100) {
      const { data } = await c.from('propostas').select(COLS_PEDIDO).in('numero_cotacao', nums.slice(i, i + 100));
      saida.push(...(data || []));
    }
    return saida;
  }

  /* Para a fila da Precificação: { '1009': [{ propostaId, nivel, itemId?, pedido }] } — só cotações com pedido aberto. */
  async function pendentesPorCotacao(numeros) {
    const c = sb(); if (!c) return {};
    const mapa = {};
    (await linhasPorCotacao(c, numeros)).forEach((row) => {
      const l = pedidosDaLinha(row);
      if (l.length) mapa[String(row.numero_cotacao)] = (mapa[String(row.numero_cotacao)] || []).concat(l);
    });
    return mapa;
  }

  /* REGRA do Gelson (06/11/2026): reprecificou, a proposta herda. Chamada quando o Financeiro CALCULA a Precificação
     (e na abertura do editor). Para cada proposta de elevador da cotação:
       - rascunho (o cliente ainda não viu): recebe o preço novo sozinha;
       - proposta que o cliente já viu (enviada, visualizada, revisão pedida, aprovada) NÃO muda sozinha, salvo se o
         Comercial pediu o aumento (pedido aberto: "só muda quando o Comercial pedir");
       - o que não pôde mudar fica marcado (`precoDefasado`) para o editor avisar.
     Devolve a lista do que foi feito (o editor aberto aplica o resultado em memória). */
  const STATUS_VISTOS = ['enviada', 'visualizada', 'revisao_solicitada', 'aprovada'];
  const STATUS_FORA = ['cancelada', 'recusada', 'expirada'];

  async function sincronizarPreco(numeroCotacao, apenasPropostaId) {
    const c = sb();
    const saida = { atualizadas: [], marcadas: [] };
    if (!c || !A() || !window.PropostaHeranca || numeroCotacao == null) return saida;
    try {
      let q = c.from('propostas').select('id, status, proposal_type, data_json, vendedor_id, numero_cotacao, numero_documento, valor_total').eq('numero_cotacao', Number(numeroCotacao));
      if (apenasPropostaId) q = q.eq('id', apenasPropostaId);
      const { data: rows } = await q;
      const alvo = (rows || []).filter((r) => !STATUS_FORA.includes(r.status) && (!r.proposal_type || r.proposal_type === 'elevador')
        && r.data_json && r.data_json.elevador && r.data_json.elevador.valores && Array.isArray(r.data_json.elevador.valores.itens));
      if (!alvo.length) return saida;
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(String(numeroCotacao));
      const valoresNovos = r && r.encontrado && r.prefill && r.prefill.elevador && r.prefill.elevador.valores;
      if (!valoresNovos || !Array.isArray(valoresNovos.itens) || !valoresNovos.itens.length) return saida;
      for (const row of alvo) {
        const dj = row.data_json;
        const temPedido = !!dj.aumentoPendente || dj.elevador.valores.itens.some((it) => it && it.aumentoPendente);
        const vista = STATUS_VISTOS.includes(row.status);
        const res = A().aplicarNovosValores(dj, valoresNovos, { por: 'sistema (Precificação)' });
        if (!res.mudou) {
          if (dj.precoDefasado) await c.from('propostas').update({ data_json: { ...dj, precoDefasado: null } }).eq('id', row.id);
          continue;
        }
        if (vista && !temPedido) {
          /* o cliente já viu: não muda; só marca (uma vez por valor) */
          if (!dj.precoDefasado || Math.abs((Number(dj.precoDefasado.total) || 0) - res.total) >= 0.01) {
            await c.from('propostas').update({ data_json: { ...dj, precoDefasado: { total: res.total, anterior: res.totalAnterior, em: new Date().toISOString() } } }).eq('id', row.id);
            saida.marcadas.push({ id: row.id, total: res.total, anterior: res.totalAnterior });
          }
          continue;
        }
        let novoDj = { ...dj, precoDefasado: null, elevador: { ...dj.elevador, valores: { ...dj.elevador.valores, ...res.valores } } };
        if (res.propostaAtendida) novoDj = { ...novoDj, ...res.propostaAtendida };
        const { error } = await c.from('propostas').update({ data_json: novoDj, valor_total: res.total, atualizado_em: new Date().toISOString() }).eq('id', row.id);
        if (error) { console.warn('[PropostaAumentoStore] não gravou o preço novo', error); continue; }
        try { window.VPLog?.registrar({ modulo: 'Propostas', acao: 'Preço atualizado pela Precificação', alvo: 'Proposta', alvo_id: row.id, detalhe: { de: res.totalAnterior, para: res.total, status: row.status } }); } catch (_) {}
        saida.atualizadas.push({ id: row.id, resultado: res, valores: novoDj.elevador.valores, propostaAtendida: res.propostaAtendida });
        /* avisos: dono sempre recebe o "preço atualizado"; se havia pedido, os três recebem o aviso de volta */
        const cliente = (dj.cliente && dj.cliente.nome) || row.numero_documento;
        const dono = await emailDono(c, row.vendedor_id);
        if (res.atendidos.length) {
          const emails = A().destinatarios({ financeiro: await emailsFinanceiro(c), gestores: await emailsGestores(c), dono });
          const aviso = A().montarAviso('volta', { cliente, itens: res.atendidos.map((a) => ({ id: a.id === 'proposta' ? null : a.id, valorNovo: a.valorNovo, valorPedido: a.valorPedido })) });
          await enviarAvisos(c, emails, aviso.sub ? { titulo: aviso.titulo, sub: aviso.sub.replace(' Abra a proposta e clique em Herdar Dados.', ' A proposta já está com o preço novo.') } : aviso, 'aumento-volta', `/comercial/proposta-editor/${row.id}`, 'info');
          if (await temContrato(c, row.id)) {
            const aviso2 = A().montarAviso('contrato', { cliente, numeroCotacao: row.numero_cotacao, valorAnterior: res.totalAnterior, valorNovo: res.total });
            await enviarAvisos(c, A().destinatarios({ financeiro: EMAIL_JURIDICO }), aviso2, 'aumento-contrato', '/juridico/contrato-venda-equipamentos', 'warning');
          }
        } else if (dono.length) {
          const aviso = A().montarAviso('atualizada', { cliente, valorAnterior: res.totalAnterior, valorNovo: res.total });
          await enviarAvisos(c, A().destinatarios({ dono }), aviso, 'preco-atualizado', `/comercial/proposta-editor/${row.id}`, 'info');
        }
      }
    } catch (e) { console.warn('[PropostaAumentoStore] sincronizar preço falhou', e); }
    return saida;
  }

  /* Gancho que a Precificação chama depois de CALCULAR (best-effort; nunca impede o cálculo). */
  function aoSalvarPrecificacao(numeroCotacao) { return sincronizarPreco(numeroCotacao); }

  /* Existe contrato desta proposta (fora de "em preenchimento")? Usado também pela "Conferir proposta". */
  async function temContratoDaProposta(propostaId) {
    const c = sb(); if (!c || !propostaId) return false;
    return temContrato(c, propostaId);
  }

  window.PropostaAumentoStore = { solicitar, cancelar, pode, pendentesPorCotacao, aoSalvarPrecificacao, sincronizarPreco, temContrato: temContratoDaProposta };
}());
