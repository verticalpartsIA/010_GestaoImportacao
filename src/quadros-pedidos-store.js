/* ============================================================
   quadros-pedidos-store.js — carga de dados do módulo Quadros de Comando (04/11/2026). SÓ LEITURA.
   window.QuadrosPedidosStore.carregar(sb) → lista de pedidos (uma linha por pedido de venda do Omie). Usada pelas telas
   "Pedidos com Quadro" e "Separação PV QC", para as duas mostrarem sempre os mesmos pedidos.
   Quem entra: pedidos do Omie na etapa 20 que têm item que é quadro de comando (pcp_quadro_variante) + o pedido de toda OP de quadro
   ativa (aguardando/em produção), inclusive Ordem de Serviço (pedido da OP-mãe) e proposta (etapa 00). OP de quadro SEM pedido de
   venda do Omie não entra (decisão do Gelson, 04/11/2026: não se fabrica o que não é pedido de venda).
   Cada linha traz: itens (com estoque físico e falta), pedido, ops, esperado (nº de quadros), fab {pct, sub}, sep {linhas, unidades}, itensSeparar [...], cabos,
   numero, cliente, vendedor, incluido, prazo. Regras puras em quadros-pedidos-calc.js; andamento = mesmo % da Evolução da Fabricação.
   ============================================================ */
(function () {
  'use strict';

  async function carregar(sb) {
    const C = window.QuadrosPedidosCalc, FQ = window.FabricacaoQuadroStore, FC = window.FabricacaoQuadroCalc;
    // 1) quais códigos são quadro de comando
    const v = await sb.from('pcp_quadro_variante').select('codigo_produto');
    if (v.error) throw v.error;
    const codigosQuadro = Array.from(new Set((v.data || []).map((x) => x.codigo_produto).filter(Boolean)));

    // 2) as OPs de quadro que a Evolução da Fabricação lista (aguardando / em produção) e as OPs-mãe delas (para a Ordem de Serviço)
    const o = await sb.from('pcp_ordens')
      .select('id, numero, titulo, produto, cliente, status, prazo_entrega, data_abertura, pedido_codigo, ordem_mae_id')
      .eq('frente', 'quadro').in('status', ['aguardando', 'em_producao']);
    if (o.error) throw o.error;
    const ops = o.data || [];
    const maeIds = Array.from(new Set(ops.map((x) => x.ordem_mae_id).filter(Boolean)));
    const maePedido = {};
    if (maeIds.length) {
      const m = await sb.from('pcp_ordens').select('id, pedido_codigo').in('id', maeIds);
      if (m.error) throw m.error;
      (m.data || []).forEach((x) => { maePedido[x.id] = x.pedido_codigo; });
    }

    // 3) andamento de cada OP de quadro (o mesmo cálculo da Evolução da Fabricação)
    const [chk, st] = await Promise.all([
      FQ.listarItens(),
      ops.length ? sb.from('fabricacao_quadro_status').select('*, fabricacao_quadro_itens(id, texto, ordem, peso)').in('ordem_id', ops.map((x) => x.id)) : Promise.resolve({ data: [] }),
    ]);
    if (st.error) throw st.error;
    const statusPorOp = {};
    (st.data || []).forEach((s) => { (statusPorOp[s.ordem_id] = statusPorOp[s.ordem_id] || []).push(s); });
    const pctDaOp = (op) => FC.resumoProgresso(FC.mergeStatusComItens(chk, statusPorOp[op.id] || [])).pct;

    // 4) pedidos do Omie que têm item de quadro (quantos quadros cada um tem)
    let itensQuadro = [];
    if (codigosQuadro.length) {
      const it = await sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, quantidade').in('codigo', codigosQuadro).limit(5000);
      if (it.error) throw it.error;
      itensQuadro = it.data || [];
    }
    const qtdQuadros = {};
    itensQuadro.forEach((x) => { qtdQuadros[String(x.codigo_pedido)] = (qtdQuadros[String(x.codigo_pedido)] || 0) + Math.max(1, Math.round(Number(x.quantidade) || 1)); });

    // 5) cabeçalho e itens dos pedidos (da união das duas fontes)
    const chaveOp = (op) => C.chaveDaOp(op, maePedido[op.ordem_mae_id]);
    const idsOps = new Set(ops.map(chaveOp).filter((k) => !k.startsWith('op:')));
    const ids = Array.from(new Set([...Object.keys(qtdQuadros), ...idsOps]));
    const ped = {}, itensPorPedido = {};
    if (ids.length) {
      const [p, ip] = await Promise.all([
        sb.from('pcp_pedidos')
          .select('codigo_pedido, numero_pedido, etapa, origem, cancelado, so_separacao, cliente_nome, vendedor_nome, data_pedido, data_previsao')
          .in('codigo_pedido', ids).limit(1000),
        sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, descricao, unidade, quantidade, obs_item').in('codigo_pedido', ids).limit(5000),
      ]);
      if (p.error) throw p.error;
      if (ip.error) throw ip.error;
      (p.data || []).forEach((x) => { ped[String(x.codigo_pedido)] = x; });
      (ip.data || []).forEach((x) => { (itensPorPedido[String(x.codigo_pedido)] = itensPorPedido[String(x.codigo_pedido)] || []).push(x); });
    }

    // 6) uma linha por pedido
    const porChave = new Map();
    const linha = (k) => { if (!porChave.has(k)) porChave.set(k, { chave: k, ops: [], esperado: 0, pedido: ped[k] || null }); return porChave.get(k); };
    Object.keys(qtdQuadros).forEach((k) => {
      const p = ped[k];
      if (p && p.etapa === '20' && !p.cancelado && !p.so_separacao) linha(k).esperado = qtdQuadros[k];
    });
    ops.forEach((op) => { linha(chaveOp(op)).ops.push(op); });

    const linhasFinais = Array.from(porChave.values()).filter((r) => r.pedido).map((r) => {
      const f = C.progressoFabricacao(r.ops.map(pctDaOp), r.esperado);
      // Quadro de comando = código de variante ou o produto da OP de quadro (ex.: 702b/704b); cabos vão no kit do quadro.
      const codigosDoQuadro = [...codigosQuadro, ...r.ops.map((x) => x.produto).filter(Boolean)];
      const itens = itensPorPedido[r.chave] || [];
      const res = C.resumoItens(itens, codigosDoQuadro);
      const kit = res.cabos ? ` + ${res.cabos} itens do kit` : '';
      const fab = f ? { pct: f.pct, sub: (!f.ops ? 'sem OP' : (f.esperado > f.ops ? `${f.ops} de ${f.esperado} quadros com OP` : `${f.ops} quadro(s)`)) + kit } : null;
      const op0 = r.ops[0] || null;
      return {
        ...r, fab, sep: res.separacao, cabos: res.cabos, itensSeparar: C.itensParaSeparar(itens, codigosDoQuadro),
        // Separação FAB QC = cabos do kit + componentes do quadro (linhas da observação do item no Omie, ver componentesDoQuadro).
        itensKit: C.itensDoKit(itens, codigosDoQuadro).map((i) => ({ ...i, grupo: 'Cabo do kit' })),
        itensComponentes: C.componentesDoQuadro(itens, codigosDoQuadro).map((i) => ({ ...i, rotulo: i.codigo.replace('#', ' · item '), grupo: 'Componente do quadro' })),
        numero: r.pedido.numero_pedido,
        cliente: r.pedido.cliente_nome || (op0 && op0.cliente) || null,
        vendedor: r.pedido.vendedor_nome,
        incluido: r.pedido.data_pedido,
        prazo: r.pedido.data_previsao,
      };
    }).sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));

    // 7) estoque físico dos itens com código de estoque (a linha de componente "<ITEM>#n" não tem). Falha ao ler NÃO derruba a tela:
    //    as linhas ficam com estoque desconhecido (null) e `estoqueErro` diz por quê (a tela mostra "—" e avisa).
    const codigos = new Set();
    linhasFinais.forEach((r) => { [...r.itensSeparar, ...r.itensKit].forEach((i) => { if (i.codigo && !String(i.codigo).includes('#')) codigos.add(String(i.codigo)); }); });
    const fisico = {};
    let estoqueErro = null;
    try {
      const lista = Array.from(codigos);
      for (let k = 0; k < lista.length; k += 150) {
        const parte = lista.slice(k, k + 150);
        const a = await sb.from('importacao_varejo_estoque').select('codigo, fisico').in('codigo', parte);
        if (a.error) throw a.error;
        (a.data || []).forEach((x) => { fisico[String(x.codigo).toUpperCase()] = Number(x.fisico) || 0; });
        const faltam = parte.filter((c) => fisico[c.toUpperCase()] === undefined);
        if (faltam.length) {
          const b = await sb.from('pcp_estoque').select('codigo, quantidade, local_estoque').in('codigo', faltam);
          if (b.error) throw b.error;
          (b.data || []).forEach((x) => { const c = String(x.codigo).toUpperCase(); fisico[c] = (fisico[c] || 0) + (Number(x.quantidade) || 0); });
        }
      }
    } catch (e) { estoqueErro = (e && e.message) || String(e); }
    const estoqueDe = (i) => (estoqueErro || String(i.codigo).includes('#') ? null : (fisico[String(i.codigo).toUpperCase()] ?? null));
    const comEstoque = (i) => ({ ...i, estoque: estoqueDe(i), falta: C.calcularFalta(i.quantidade, estoqueDe(i)) });
    return linhasFinais.map((r) => ({ ...r, itensSeparar: r.itensSeparar.map(comEstoque), itensKit: r.itensKit.map(comEstoque), itensComponentes: r.itensComponentes.map(comEstoque), estoqueErro }));
  }

  /* "Peguei" dos itens a separar (tabela qc_separacao_itens, só por função: exige sessão real do portal + alçada
     quadros-separacao ver/editar). Chave do mapa: "<codigo_pedido>|<CODIGO>" → { por, em }. Falha vira erro (nunca silenciosa). */
  const chavePeguei = (codigoPedido, codigo) => `${codigoPedido}|${String(codigo).toUpperCase()}`;

  async function listarPegos(sb, codigosPedido) {
    const ids = (codigosPedido || []).map(Number).filter(Boolean);
    if (!ids.length) return {};
    const { data, error } = await sb.rpc('qc_separacao_listar', { p_pedidos: ids });
    if (error) throw error;
    const m = {};
    (data || []).forEach((x) => { m[chavePeguei(x.codigo_pedido, x.codigo)] = { por: x.peguei_por, em: x.peguei_em }; });
    return m;
  }

  async function marcar(sb, codigoPedido, codigo, peguei) {
    const { data, error } = await sb.rpc('qc_separacao_marcar', { p_codigo_pedido: Number(codigoPedido), p_codigo: String(codigo), p_peguei: !!peguei });
    if (error) throw error;
    return data;
  }

  /* Anotações por item: previsão de entrega, observação e ESTOQUE REAL digitado (tabela qc_separacao_previsao, migrations 20261104140000 e 20261104150000; só por função, mesma alçada do Peguei).
     Mapa "<codigo_pedido>|<CODIGO>" → { previsao 'AAAA-MM-DD' | null, obs, por, em }. */
  async function listarPrevisoes(sb, codigosPedido) {
    const ids = (codigosPedido || []).map(Number).filter(Boolean);
    if (!ids.length) return {};
    const { data, error } = await sb.rpc('qc_separacao_previsao_listar', { p_pedidos: ids });
    if (error) throw error;
    const m = {};
    (data || []).forEach((x) => { m[chavePeguei(x.codigo_pedido, x.codigo)] = { previsao: x.previsao, obs: x.obs, estoque_real: x.estoque_real == null ? null : Number(x.estoque_real), por: x.atualizado_por, em: x.atualizado_em }; });
    return m;
  }

  async function gravarPrevisao(sb, codigoPedido, codigo, previsao, obs, estoqueReal) {
    const real = estoqueReal === '' || estoqueReal == null ? null : Number(estoqueReal);
    const { data, error } = await sb.rpc('qc_separacao_previsao_gravar', { p_codigo_pedido: Number(codigoPedido), p_codigo: String(codigo), p_previsao: previsao || null, p_obs: obs || null, p_estoque_real: real });
    if (error) throw error;
    return data;
  }

  window.QuadrosPedidosStore = { carregar, listarPegos, marcar, chavePeguei, listarPrevisoes, gravarPrevisao };
})();
