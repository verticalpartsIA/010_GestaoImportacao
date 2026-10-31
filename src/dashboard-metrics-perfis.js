/* ============================================================
   dashboard-metrics-perfis.js — KPIs novos do Dashboard por perfil (Fase 2 e 3 de
   docs/modulos/01_geral.md 1.1.10, aprovados pelo Gelson em 31/10/2026). Funções puras, zero I/O: recebem arrays
   já carregados (ver loadDashboardData em supabase.js) e devolvem cartões { label, value, unit, delta, deltaDir, sub }.
   Cartão de ESTADO diz "agora" no sub; cartão de FLUXO diz o período. Dado que não carregou (null) vira "—", nunca 0.
   window.PerfisMetrics
   ============================================================ */
(function () {
  'use strict';

  const card = (label, value, sub, deltaDir) => ({ label, value: value == null ? '—' : String(value), unit: '', delta: '', deltaDir: deltaDir || 'up', sub });
  const fmtBRL = (n) => {
    if (!n) return 'R$ 0';
    if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return 'R$ ' + Math.round(n / 1_000) + 'k';
    return 'R$ ' + Math.round(n);
  };
  const lower = (t) => String(t || '').toLowerCase();
  const noPeriodo = (d, desde) => !!d && (!desde || new Date(d) >= desde);

  /* ---------- Comercial ---------- */
  const META_CONVERSAO_PADRAO = 25;

  function comercial({ leads, propostas, desde, periodoRotulo, convPct, metaConversao }) {
    const rot = periodoRotulo || 'histórico inteiro';
    const leadsNovos = (leads || []).filter((l) => noPeriodo(l.created_at || l.date, desde)).length;
    const aguardando = (propostas || []).filter((p) => ['enviada', 'visualizada'].includes(lower(p.status))).length;
    const assinadas = (propostas || []).filter((p) => lower(p.status) === 'aprovada' && noPeriodo(p.aprovada_em, desde)).length;
    const meta = Number.isFinite(Number(metaConversao)) && Number(metaConversao) > 0 ? Number(metaConversao) : META_CONVERSAO_PADRAO;
    return {
      leadsNovos: card('Leads novos', leadsNovos, rot),
      aguardando: card('Propostas aguardando o cliente', aguardando, 'agora'),
      assinadas: card('Propostas assinadas', assinadas, rot),
      conversao: { label: 'Conversão Lead→Proposta', value: String(convPct), unit: '%', delta: '', deltaDir: convPct >= meta ? 'up' : 'down', sub: 'meta ' + meta + '%' },
    };
  }

  /* ---------- Financeiro ---------- */
  function financeiro({ propostas, avais, gatilhos, parcelas, contratosInstalador, comissoes, agora }) {
    const hoje = agora || new Date();
    const aprovadas = new Set((propostas || []).filter((p) => lower(p.status) === 'aprovada' && p.numero_cotacao != null).map((p) => String(p.numero_cotacao)));
    const sinais = (avais || []).filter((a) => a.sinal_pago !== true && lower(a.status) !== 'reprovado' && a.numero_cotacao != null && aprovadas.has(String(a.numero_cotacao))).length;
    const abertos = (gatilhos || []).filter((g) => !g.concluido_em && lower(g.status) !== 'ok');
    const avaisPag = new Set(abertos.filter((g) => g.evento_key === 'AVAL_PAGAMENTO').map((g) => g.numero_cotacao)).size;
    const vencidas = abertos.filter((g) => g.due_date && new Date(g.due_date) < hoje).length;
    const assinados = new Set((contratosInstalador || []).filter((c) => lower(c.status) === 'assinado').map((c) => c.id));
    const liberadas = (parcelas || []).filter((p) => p.liberada === true && lower(p.status) !== 'paga' && assinados.has(p.contrato_id));
    const soma = liberadas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const comAguardando = (comissoes || []).filter((c) => c.status === 'Aguardando');
    return {
      sinais: card('Sinais a confirmar', sinais, 'agora'),
      avaisPagamento: card('Avais de pagamento pendentes', avaisPag, 'agora'),
      vencidas: card('Etapas com prazo vencido', vencidas, 'agora', vencidas > 0 ? 'down' : 'up'),
      parcelasInstalador: card('Parcelas de instalador liberadas', liberadas.length, fmtBRL(soma) + ' a pagar · agora'),
      /* esconde o cartão enquanto a tabela estiver vazia (spec) */
      comissoes: (comissoes || []).length ? card('Comissões pendentes', fmtBRL(comAguardando.reduce((s, c) => s + (c.comissao || 0), 0)), 'aguardando pagamento · agora') : null,
    };
  }

  /* ---------- Engenharia ---------- */
  function engenharia({ aguardandoProjeto, achados, obras, solicitacoes }) {
    const equipamentos = achados == null ? null : new Set((achados || []).map((a) => a.serie || a.codigo || a.obra_id)).size;
    const emInstalacao = obras == null ? null : (obras || []).filter((o) => o.status_master === 'Instalação').length;
    const solAbertas = solicitacoes == null ? null : (solicitacoes || []).filter((s) => !s.excluido_em && !['convertido_em_ficha', 'concluida', 'concluído', 'cancelada'].includes(lower(s.status))).length;
    return {
      projetosAguardando: card('Projetos aguardando assinatura', aguardandoProjeto, 'cotações · agora'),
      conferir: card('Equipamentos com dado a conferir', equipamentos, 'Evolução · agora', equipamentos > 0 ? 'down' : 'up'),
      obrasInstalacao: card('Obras em instalação', emInstalacao, 'agora'),
      solicitacoes: card('Solicitações de produto em aberto', solAbertas, 'agora'),
    };
  }

  /* ---------- Logística (perfil novo) ---------- */
  function logistica({ fila, ops, expedicoes, ajustes }) {
    let pedidos = null, foraSla = 0;
    if (fila && Array.isArray(fila.pedidos)) {
      const a = fila.pedidos.filter((p) => p.status !== 'separado');
      pedidos = a.length;
      foraSla = a.filter((p) => fila.sla_min && p.decorrido_min > fila.sla_min).length;
    }
    const agora = new Date(); agora.setHours(0, 0, 0, 0);
    const atrasadas = ops == null ? null : (ops || []).filter((o) => o.produto && !['concluida', 'cancelada'].includes(lower(o.status)) && o.prazo_entrega && new Date(o.prazo_entrega + 'T00:00:00') < agora).length;
    const prontos = expedicoes == null ? null : (expedicoes || []).filter((e) => lower(e.status) === 'aguardando').length;
    const ajustesPend = ajustes == null ? null : (ajustes || []).length;
    return {
      pedidosASeparar: card('Pedidos a separar', pedidos, pedidos == null ? 'sem acesso à fila' : foraSla + ' fora do SLA · agora', foraSla > 0 ? 'down' : 'up'),
      opsAtrasadas: card('OPs atrasadas', atrasadas, 'prazo vencido · agora', atrasadas > 0 ? 'down' : 'up'),
      prontosExpedir: card('Prontos para expedir', prontos, 'despacho pendente · agora'),
      ajustes: card('Ajustes de estoque pendentes', ajustesPend, 'aguardando decisão · agora'),
    };
  }

  /* ---------- Importação (perfil novo) ---------- */
  function importacao({ embarquesImp, lotes, avaisJuridicos, diaD, agora }) {
    const hoje = agora || new Date();
    const em30 = new Date(hoje.getTime() + 30 * 86_400_000);
    const chegadas = embarquesImp == null ? null : (embarquesImp || []).filter((e) => !e.arquivado && (e.eta_atual || e.eta_santos) && (() => { const d = new Date(e.eta_atual || e.eta_santos); return d >= new Date(hoje.toDateString()) && d <= em30; })()).length;
    const lotesAbertos = lotes == null ? null : (lotes || []).filter((l) => l.status === 'em_cotacao').length;
    const avaisPend = avaisJuridicos == null ? null : (avaisJuridicos || []).filter((a) => lower(a.status) === 'pendente').length;
    return {
      chegadas: card('Chegadas em 30 dias', chegadas, 'embarques · agora'),
      lotes: card('Cotações de varejo em aberto', lotesAbertos, 'lotes em cotação · agora'),
      avaisJuridicos: card('Avais jurídicos pendentes', avaisPend, 'agora'),
      diaD: card('Itens com Dia D vencido', diaD, 'curva A/B · agora', diaD > 0 ? 'down' : 'up'),
    };
  }

  /* ---------- Diretoria ---------- */
  function decisoesDoUsuario(decisoes, email) {
    const me = lower(email);
    if (!me) return null;
    return (decisoes || []).filter((d) => lower(d.status) === 'pendente' && (lower(d.aprovador_esperado_email) === me || (Array.isArray(d.aprovadores_esperados) && d.aprovadores_esperados.map(lower).includes(me)))).length;
  }

  window.PerfisMetrics = { META_CONVERSAO_PADRAO, comercial, financeiro, engenharia, logistica, importacao, decisoesDoUsuario };
}());
