/* ============================================================
   solicitacoes-compra-calc.js — regras puras das Solicitações de Compra do vendedor (testadas em
   solicitacoes-compra-calc.test.js). Suprimentos & Importação › Compras / Pedidos. window.SolicitacoesCompraCalc

   O vendedor ENVIA uma solicitação (itens + quantidade); o comprador ALOCA os itens num lote de cotação (rascunho).
   As regras de gravação moram no banco (funções iv_solicitacao_*); aqui só o que a tela precisa decidir/mostrar.
   ============================================================ */
(function () {
  'use strict';

  const STATUS = {
    enviada: { label: 'Enviada', tom: 'info' },
    em_analise: { label: 'Em análise', tom: 'warning' },
    alocada: { label: 'Alocada em cotação', tom: 'success' },
    devolvida: { label: 'Devolvida ao vendedor', tom: 'danger' },
    cancelada: { label: 'Cancelada', tom: 'neutral' },
  };
  const URGENCIAS = [
    { v: 'baixa', label: 'Baixa' }, { v: 'normal', label: 'Normal' }, { v: 'alta', label: 'Alta' }, { v: 'urgente', label: 'Urgente' },
  ];

  function rotuloStatus(s) { return (STATUS[s] || { label: s || '—' }).label; }
  function tomStatus(s) { return (STATUS[s] || { tom: 'neutral' }).tom; }

  /* Seleção da tela Compras → itens da solicitação. Quantidade vem da sugestão de compra (se houver); o vendedor ajusta no modal.
     Código em MAIÚSCULAS, sem repetir. */
  function itensDaSelecao(selecionados) {
    const vistos = new Set(); const out = [];
    (selecionados || []).forEach((i) => {
      const cod = String((i && i.codigo) || '').trim().toUpperCase();
      if (!cod || vistos.has(cod)) return;
      vistos.add(cod);
      const sug = Number(i.sugestaoCompra);
      out.push({ codigo: cod, descricao: i.descricao || null, unidade: i.unidade || null, quantidade: Number.isFinite(sug) && sug > 0 ? sug : 0, obs: '' });
    });
    return out;
  }

  /* Valida antes de enviar: toda linha precisa de quantidade > 0. Devolve { ok, erros[] } (mensagens para o usuário). */
  function validarEnvio(itens) {
    const erros = [];
    if (!itens || !itens.length) erros.push('Escolha pelo menos um produto.');
    (itens || []).forEach((i) => { if (!(Number(i.quantidade) > 0)) erros.push(i.codigo + ': informe a quantidade (maior que zero).'); });
    return { ok: erros.length === 0, erros };
  }

  /* As funções do banco avisam com "codigo_do_erro: mensagem". Mostra só a mensagem; sem prefixo conhecido, devolve como veio. */
  function mensagemErro(e) {
    const m = String((e && (e.message || e)) || 'erro desconhecido');
    const r = m.match(/^[a-z_]+:\s+(.+)$/s);
    return r ? r[1] : m;
  }

  /* Itens ativos (sem removido_em) de uma solicitação e o resumo para a lista. */
  function resumo(sol, itens) {
    const ativos = (itens || []).filter((i) => !i.removido_em);
    const alocados = ativos.filter((i) => i.lote_id);
    return { total: ativos.length, alocados: alocados.length, pendentes: ativos.length - alocados.length };
  }

  /* Quem pode editar/cancelar: só quem solicitou (ou o comprador, no banco) e só enquanto nada foi alocado. */
  function podeEditar(sol, itens, emailAtual) {
    if (!sol || !['enviada', 'devolvida'].includes(sol.status)) return false;
    if (!emailAtual || String(sol.solicitante_email || '').toLowerCase() !== String(emailAtual).toLowerCase()) return false;
    return !(itens || []).some((i) => !i.removido_em && i.lote_id);
  }

  /* Itens que o comprador ainda pode alocar (ativos, de solicitação não cancelada/devolvida). Realocar = já alocado em lote rascunho. */
  function itemAlocavel(sol, item) {
    if (!sol || !item || item.removido_em) return false;
    return ['enviada', 'em_analise', 'alocada'].includes(sol.status);
  }

  /* Total de unidades por produto entre os itens escolhidos pelo comprador (mostra a soma antes de alocar). */
  function somarPorCodigo(itens) {
    const m = {};
    (itens || []).forEach((i) => { m[i.codigo] = (m[i.codigo] || 0) + (Number(i.quantidade) || 0); });
    return m;
  }

  window.SolicitacoesCompraCalc = { STATUS, URGENCIAS, rotuloStatus, tomStatus, itensDaSelecao, validarEnvio, mensagemErro, resumo, podeEditar, itemAlocavel, somarPorCodigo };
}());
