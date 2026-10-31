/* ============================================================
   aval-engenharia-store.js — Aval Engenharia (08/10/2026)
   Terceiro aval da compra na China, POR COTAÇÃO: o cliente precisa ter ASSINADO o Projeto de Instalação.
   Fonte da verdade: projetos_elevador_desenhos (tipo 'projeto_instalacao', não excluídos, numero_cotacao) +
   documento_signatarios (documento_tipo 'projeto_instalacao', documento_id = id do desenho, status 'assinado').
   A cotação só está OK quando TODOS os Projetos de Instalação dela têm assinatura (ID-TAG não precisa assinar).
   Sem nenhum Projeto de Instalação salvo = ainda NÃO está OK (todas as cotações precisam dos 3 avais).
   ============================================================ */
(function () {
  'use strict';
  function sb() { return (window.__VP_SB || {}).sb; }
  function numTxt(n) { const v = Number(n); return Number.isFinite(v) ? String(v) : String(n == null ? '' : n).trim(); }

  /* estado por Projeto: assinado > aguardando (link criado/aberto) > recusado > sem_link */
  function estadoDoDesenho(sigs) {
    if (sigs.some((s) => s.status === 'assinado')) return 'assinado';
    if (sigs.some((s) => s.status !== 'recusado' && s.status !== 'expirado')) return 'aguardando';
    if (sigs.some((s) => s.status === 'recusado')) return 'recusado';
    return 'sem_link';
  }

  /* junta desenhos + assinaturas e resume por cotação. Função pura (testável). */
  function resumir(desenhos, sigs) {
    const porDesenho = {};
    (sigs || []).forEach((s) => { (porDesenho[s.documento_id] = porDesenho[s.documento_id] || []).push(s); });
    const porCot = {};
    (desenhos || []).forEach((d) => {
      if ((d.tipo_documento || 'projeto_instalacao') !== 'projeto_instalacao') return;
      const k = numTxt(d.numero_cotacao);
      const est = estadoDoDesenho(porDesenho[d.id] || []);
      const c = (porCot[k] = porCot[k] || { numero_cotacao: k, cliente_nome: d.cliente_nome || null, itens: [] });
      if (!c.cliente_nome && d.cliente_nome) c.cliente_nome = d.cliente_nome;
      c.itens.push({ id: d.id, referencia: d.referencia, arquivo_nome: d.arquivo_nome, estado: est });
    });
    Object.values(porCot).forEach((c) => {
      c.total = c.itens.length;
      c.assinados = c.itens.filter((i) => i.estado === 'assinado').length;
      c.estado = c.total === 0 ? 'sem_projeto'
        : c.assinados === c.total ? 'ok'
        : c.itens.some((i) => i.estado === 'recusado') ? 'recusado'
        : 'aguardando';
    });
    return porCot;
  }

  async function carregar(numeroCotacao) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    let q = c.from('projetos_elevador_desenhos')
      .select('id, referencia, arquivo_nome, tipo_documento, numero_cotacao, cliente_nome').is('excluido_em', null);
    q = numeroCotacao == null ? q.not('numero_cotacao', 'is', null) : q.eq('numero_cotacao', numTxt(numeroCotacao));
    const { data: desenhos, error } = await q;
    if (error) throw error;
    const proj = (desenhos || []).filter((d) => (d.tipo_documento || 'projeto_instalacao') === 'projeto_instalacao');
    if (!proj.length) return { desenhos: [], sigs: [] };
    const { data: sigs, error: e2 } = await c.from('documento_signatarios')
      .select('documento_id, status').eq('documento_tipo', 'projeto_instalacao').in('documento_id', proj.map((d) => d.id));
    if (e2) throw e2;
    return { desenhos: proj, sigs: sigs || [] };
  }

  /* Status do Aval Engenharia de UMA cotação. { estado: 'ok'|'aguardando'|'recusado'|'sem_projeto'|'erro', total, assinados, itens } */
  async function status(numeroCotacao) {
    try {
      const { desenhos, sigs } = await carregar(numeroCotacao);
      const r = resumir(desenhos, sigs)[numTxt(numeroCotacao)];
      return r || { numero_cotacao: numTxt(numeroCotacao), estado: 'sem_projeto', total: 0, assinados: 0, itens: [] };
    } catch (e) {
      console.warn('[AvalEngenhariaStore] status falhou', e);
      return { numero_cotacao: numTxt(numeroCotacao), estado: 'erro', total: 0, assinados: 0, itens: [] };
    }
  }

  /* Resumo de todas as cotações que já têm Projeto de Instalação salvo (tela da Engenharia). */
  async function resumoTodas() {
    const { desenhos, sigs } = await carregar(null);
    return Object.values(resumir(desenhos, sigs));
  }

  const ROTULO = { ok: 'Aval Engenharia OK', aguardando: 'Aval Engenharia: aguardando assinatura do projeto',
    recusado: 'Aval Engenharia: cliente recusou o projeto', sem_projeto: 'Aval Engenharia: projeto ainda não salvo', erro: 'Aval Engenharia: sem leitura' };

  /* Efeito de uma assinatura pública do projeto, executado por um usuário interno via fila `fluxo_pendentes` (fluxo-pendentes.js). */
  async function processarEfeitoFila(tipo, p) {
    if (tipo !== 'projeto_instalacao_assinado') throw new Error('tipo desconhecido: ' + tipo);
    if (!window.EventosFluxo) throw new Error('EventosFluxo indisponível');
    const num = p.numero_cotacao != null && p.numero_cotacao !== '' ? Number(p.numero_cotacao) : null;
    const r = await window.EventosFluxo.registrar({
      evento: 'PROJETO_INSTALACAO_ASSINADO', numeroCotacao: Number.isFinite(num) ? num : null,
      alvoLabel: p.label, alvoId: p.desenho_id, atorNome: p.signerName || 'Cliente (link público)',
    });
    if (!r) throw new Error('evento não registrado');
  }

  window.AvalEngenhariaStore = { status, resumoTodas, resumir, estadoDoDesenho, ROTULO, processarEfeitoFila };
}());
