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
      .select('id, status, data_json, vendedor_id, numero_cotacao, numero_documento').eq('id', id).maybeSingle();
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

  /* nivel: 'equipamento' (itemId) | 'proposta' (valor total). */
  async function solicitar({ propostaId, nivel, itemId, valorAtual, valorPedido, motivo }) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o sistema.');
    if (!A()) throw new Error('Regras do pedido não carregadas — recarregue a página.');
    if (!(await pode(propostaId))) throw new Error('Só o dono da proposta ou o Líder pode pedir alteração de valor.');
    const row = await lerProposta(c, propostaId);
    const dj = row.data_json || {};
    const por = meuEmail();
    const ctx = { outroNivelPendente: outroNivelPendente(dj, nivel, itemId) };
    let novoDj; let alvoAtual; let rotulo = null;
    if (nivel === 'proposta') {
      alvoAtual = A().solicitar(dj, { valorAtual, valorPedido, motivo, por }, ctx);
      novoDj = { ...dj, aumentoPendente: alvoAtual.aumentoPendente, aumentoLog: alvoAtual.aumentoLog };
    } else {
      const achado = acharItem(dj, itemId);
      if (!achado) throw new Error('Equipamento não encontrado na proposta.');
      const ocultos = (dj[achado.eq].valores.ocultos || []);
      const item = { ...achado.itens[achado.idx], oculto: ocultos.includes(itemId) };
      alvoAtual = A().solicitar(item, { valorAtual, valorPedido, motivo, por }, ctx);
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
      await enviarAvisos(c, emails, aviso, 'aumento-ida', ROTA_PRECIFICACAO, 'warning');
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
  const COLS_PEDIDO = 'id, numero_cotacao, numero_documento, vendedor_id, status, pend:data_json->aumentoPendente, '
    + 'ocultos:data_json->elevador->valores->ocultos, '
    + 'it_elevador:data_json->elevador->valores->itens, it_escada:data_json->escada->valores->itens, it_esteira:data_json->esteira->valores->itens';

  function pedidosDaLinha(row) {
    const lista = [];
    if (row.pend) lista.push({ propostaId: row.id, nivel: 'proposta', pedido: row.pend });
    ['it_elevador', 'it_escada', 'it_esteira'].forEach((k) => {
      (Array.isArray(row[k]) ? row[k] : []).forEach((it) => {
        if (it && it.aumentoPendente) lista.push({ propostaId: row.id, nivel: 'equipamento', itemId: it.id, valorUnitAtual: it.valorUnit, pedido: it.aumentoPendente });
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

  /* Chamado quando o Financeiro SALVA a Precificação: se o preço mudou em relação ao do momento do pedido,
     avisa Regiane, dono e Financeiro ("clique em Herdar Dados"). Avisa uma vez por valor novo (marca no pedido). */
  async function aoSalvarPrecificacao(numeroCotacao) {
    const c = sb(); if (!c || !A() || !window.PropostaHeranca || numeroCotacao == null) return;
    try {
      const rows = (await linhasPorCotacao(c, [numeroCotacao])).filter((r) => pedidosDaLinha(r).length);
      if (!rows.length) return;
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(String(numeroCotacao));
      const novosItens = r && r.encontrado && r.prefill && r.prefill.elevador && r.prefill.elevador.valores && r.prefill.elevador.valores.itens;
      if (!Array.isArray(novosItens) || !novosItens.length) return;
      for (const row of rows) {
        const ocultos = new Set(Array.isArray(row.ocultos) ? row.ocultos : []);
        const totalNovo = novosItens.filter((it) => !ocultos.has(it.id)).reduce((s, it) => s + A().parseNum(it.valorUnit) * (Number(it.quantidade) || 1), 0);
        const mudancas = [];
        pedidosDaLinha(row).forEach((p) => {
          const novo = p.nivel === 'proposta' ? totalNovo : A().parseNum((novosItens.find((it) => it.id === p.itemId) || {}).valorUnit);
          const ant = A().atender({ aumentoPendente: p.pedido }, novo);
          if (ant.atendido && Math.abs((Number(p.pedido.precificacaoValor) || 0) - novo) > 0.005) mudancas.push({ p, novo, ant });
        });
        if (!mudancas.length) continue;
        const emails = A().destinatarios({ financeiro: await emailsFinanceiro(c), gestores: await emailsGestores(c), dono: await emailDono(c, row.vendedor_id) });
        const dj = (await lerProposta(c, row.id)).data_json || {};
        let novoDj = dj;
        for (const m of mudancas) {
          const cliente = (dj.cliente && dj.cliente.nome) || row.numero_documento;
          const aviso = A().montarAviso('volta', { cliente, equipamento: m.p.nivel === 'proposta' ? null : m.p.itemId, valorAnterior: m.p.pedido.valorAtual, valorNovo: m.novo, valorPedido: m.p.pedido.valorPedido });
          await enviarAvisos(c, emails, aviso, 'aumento-volta', `/comercial/proposta-editor/${row.id}`, 'info');
          /* marca o valor já avisado para não repetir a cada novo "Calcular" com o mesmo preço */
          if (m.p.nivel === 'proposta') {
            novoDj = { ...novoDj, aumentoPendente: { ...novoDj.aumentoPendente, precificacaoValor: m.novo } };
          } else {
            const achado = acharItem(novoDj, m.p.itemId);
            if (achado) {
              const itens = achado.itens.slice();
              itens[achado.idx] = { ...itens[achado.idx], aumentoPendente: { ...itens[achado.idx].aumentoPendente, precificacaoValor: m.novo } };
              novoDj = { ...novoDj, [achado.eq]: { ...novoDj[achado.eq], valores: { ...novoDj[achado.eq].valores, itens } } };
            }
          }
        }
        await c.from('propostas').update({ data_json: novoDj, atualizado_em: new Date().toISOString() }).eq('id', row.id);
      }
    } catch (e) { console.warn('[PropostaAumentoStore] aviso de volta falhou', e); }
  }

  /* O pedido foi atendido (o preço novo entrou na proposta pelo Herdar Dados): se já existe
     contrato desta proposta, avisa o Jurídico para refazê-lo. O aviso de volta sai quando a
     Precificação é salva (aoSalvarPrecificacao). */
  async function avisarAtendimento({ propostaId, atendidos, cliente, numeroCotacao }) {
    const c = sb(); if (!c || !A() || !(atendidos || []).length) return;
    try {
      const row = await lerProposta(c, propostaId);
      if (await temContrato(c, propostaId)) {
        const a = atendidos[0];
        const aviso = A().montarAviso('contrato', { cliente, numeroCotacao: numeroCotacao || row.numero_cotacao, valorAnterior: a.valorAnterior, valorNovo: a.valorNovo });
        await enviarAvisos(c, A().destinatarios({ financeiro: EMAIL_JURIDICO }), aviso, 'aumento-contrato', '/juridico/contrato-venda-equipamentos', 'warning');
      }
    } catch (e) { console.warn('[PropostaAumentoStore] avisos de atendimento falharam', e); }
  }

  window.PropostaAumentoStore = { solicitar, cancelar, avisarAtendimento, pode, pendentesPorCotacao, aoSalvarPrecificacao };
}());
