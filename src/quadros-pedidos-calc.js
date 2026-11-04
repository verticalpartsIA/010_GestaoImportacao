/* ============================================================
   quadros-pedidos-calc.js — regras puras da tela Quadros de Comando · Pedidos (04/11/2026).
   Sem acesso a dados: recebe o que a tela já carregou. window.QuadrosPedidosCalc

   - progressoFabricacao(pcts, esperado): média do andamento das OPs de quadro do pedido (mesmo % da Evolução da Fabricação).
     Quadro que ainda não tem OP conta como 0%: um pedido com 2 quadros e 1 OP a 100% mostra 50%, não 100%.
   - classificarItem(item, codigosQuadro): em qual "casa" cada linha do pedido do Omie cai (decisão do Gelson, 04/11/2026):
       quadro         → o quadro de comando (código em pcp_quadro_variante ou o produto da OP de quadro);
       cabo           → vai JUNTO com o quadro (kit do quadro de comando): descrição começa com "Cabo" (modular BST, cabo de manobra…);
       materia_prima  → código VPMP (matéria-prima: não é item da proposta a separar);
       servico        → código VPSVC (Ordem de Serviço: não há o que separar);
       separacao      → o resto: botões, placa de display, botão de chamada, encoder…
   - resumoItens(itens, codigosQuadro): { quadros (unidades), cabos (linhas do kit), separacao: { linhas, unidades } }.
   - chaveDaOp(op, maePedidoCodigo): em que linha a OP entra — pelo pedido da própria OP, senão pelo pedido da OP-mãe (OS), senão sozinha.
   ============================================================ */
(function () {
  'use strict';

  function progressoFabricacao(pcts, esperado) {
    const lista = (pcts || []).map((p) => Math.max(0, Math.min(100, Number(p) || 0)));
    const denom = Math.max(Number(esperado) || 0, lista.length);
    if (!denom) return null;
    const soma = lista.reduce((a, b) => a + b, 0);
    return { pct: Math.floor(soma / denom + 1e-9), ops: lista.length, esperado: denom };
  }

  function classificarItem(item, codigosQuadro) {
    const cod = String((item && item.codigo) || '').trim().toUpperCase();
    const desc = String((item && item.descricao) || '').trim();
    const quadros = new Set((codigosQuadro || []).map((c) => String(c).toUpperCase()));
    if (quadros.has(cod)) return 'quadro';
    if (/^VPMP/.test(cod)) return 'materia_prima';
    if (/^VPSVC/.test(cod)) return 'servico';
    if (/^cabo\b/i.test(desc)) return 'cabo';
    return 'separacao';
  }

  // O Omie repete a mesma linha com quantidade 0 (ex.: pedido 29972): soma por código e ignora o que fica em zero.
  function agruparPorCodigo(itens) {
    const porCodigo = new Map();
    (itens || []).forEach((i) => {
      const k = String(i.codigo || '').trim().toUpperCase();
      if (!porCodigo.has(k)) porCodigo.set(k, { ...i, quantidade: 0 });
      porCodigo.get(k).quantidade += Number(i.quantidade) || 0;
    });
    return Array.from(porCodigo.values()).filter((i) => i.quantidade > 0);
  }

  // Lista do que o almoxarifado separa neste pedido (a mesma conta de resumoItens.separacao), por código.
  function itensParaSeparar(itens, codigosQuadro) {
    return agruparPorCodigo(itens)
      .filter((i) => classificarItem(i, codigosQuadro) === 'separacao')
      .map((i) => ({ codigo: i.codigo, descricao: i.descricao || '', unidade: i.unidade || '', quantidade: i.quantidade }))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  }

  // O kit que vai COM o quadro (cabo de manobra e cabos modulares): o que a Separação FAB QC lista. Mesma conta de resumoItens.cabos.
  function itensDoKit(itens, codigosQuadro) {
    return agruparPorCodigo(itens)
      .filter((i) => classificarItem(i, codigosQuadro) === 'cabo')
      .map((i) => ({ codigo: i.codigo, descricao: i.descricao || '', unidade: i.unidade || '', quantidade: i.quantidade }))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  }

  // Lê UMA linha da observação do item do quadro: "Suporte para Cabo de Comando de Elevador-2Peça (PC)" → { descricao, quantidade 2, unidade 'PC' }.
  // Aceita acento estragado na unidade ("Pe�a"). Linha que não segue o formato vira null (não entra na lista).
  function lerLinhaComponente(linha) {
    const m = String(linha || '').trim().match(/^(.*?)\s*-\s*(\d+(?:[.,]\d+)?)\s*[^\s(]+\s*\(([^)]+)\)\s*$/);
    if (!m || !m[1].trim()) return null;
    return { descricao: m[1].trim(), quantidade: Number(m[2].replace(',', '.')), unidade: m[3].trim().toUpperCase() };
  }

  // Componentes do(s) quadro(s) do pedido: a observação do item do quadro (obs_item) tem uma linha por componente, por quadro.
  // Código de cada linha = "<ITEM>#<n>" (n = posição na observação, a partir de 1; é o que o servidor confere ao gravar o Peguei).
  // Quantidade = a da linha × a quantidade de quadros do item (30614: 2 quadros → 'Suporte…-2' vira 4).
  function componentesDoQuadro(itens, codigosQuadro) {
    const out = [];
    (itens || []).forEach((i) => {
      if (!i || !i.obs_item || classificarItem(i, codigosQuadro) !== 'quadro') return;
      const porQuadro = Number(i.quantidade) > 0 ? Number(i.quantidade) : 1;
      String(i.obs_item).split('|').forEach((linha, idx) => {
        const c = lerLinhaComponente(linha);
        if (c) out.push({ codigo: `${String(i.codigo).trim().toUpperCase()}#${idx + 1}`, descricao: c.descricao, unidade: c.unidade, quantidade: c.quantidade * porQuadro });
      });
    });
    return out;
  }

  function resumoItens(itens, codigosQuadro) {
    const r = { quadros: 0, cabos: 0, separacao: { linhas: 0, unidades: 0 } };
    agruparPorCodigo(itens).forEach((i) => {
      const q = i.quantidade;
      const c = classificarItem(i, codigosQuadro);
      if (c === 'quadro') r.quadros += q;
      else if (c === 'cabo') r.cabos += 1;
      else if (c === 'separacao') { r.separacao.linhas += 1; r.separacao.unidades += q; }
    });
    return r;
  }

  function chaveDaOp(op, maePedidoCodigo) {
    if (op && op.pedido_codigo != null) return String(op.pedido_codigo);
    if (maePedidoCodigo != null) return String(maePedidoCodigo);
    return 'op:' + (op && op.numero);
  }

  // Quanto FALTA de um item: quantidade do pedido − estoque físico (nunca negativo). Sem estoque conhecido (item sem código de estoque,
  // como a linha de componente do quadro, ou leitura que falhou) devolve null: a tela mostra "—" e NÃO chuta zero.
  // Usa o físico, não o disponível: o "reservado" do Omie já inclui a reserva deste próprio pedido (mesma regra da Necessidade do PCP).
  function calcularFalta(quantidade, estoqueFisico) {
    if (estoqueFisico == null || estoqueFisico === '' || !isFinite(Number(estoqueFisico))) return null;
    const q = Number(quantidade);
    if (!isFinite(q)) return null;
    return Math.max(0, Math.round((q - Number(estoqueFisico)) * 1000) / 1000);
  }

  window.QuadrosPedidosCalc = { calcularFalta, progressoFabricacao, classificarItem, resumoItens, itensParaSeparar, itensDoKit, lerLinhaComponente, componentesDoQuadro, chaveDaOp };
})();
