/* ============================================================
   fluxo-pendentes.js — executa, num usuário INTERNO logado, os efeitos que uma ação do CLIENTE na página pública
   deixou na fila `fluxo_pendentes` (segurança real #571, Fase 3 / Task 10).
   Por quê: a assinatura/recusa/pedido de revisão da Proposta acontece na página pública, que não pode mais gravar nas tabelas
   internas (eventos_fluxo, gatilhos, decisoes_gerenciais, dossier_obra, leads, clientes). A RPC do banco enfileira; aqui rodamos
   o MESMO código de antes (PropostaStore.executarEfeitosAssinatura, EventosFluxo.registrar) — nada foi reescrito.
   Segurança do processamento: reivindicação atômica no banco (FOR UPDATE SKIP LOCKED + lease de 5 min) — duas abas/pessoas
   nunca pegam o mesmo item; item que trava volta à fila (até 5 tentativas). Cada item é concluído (ou marcado "falhou" com o motivo).
   Só roda no sistema real (não em localhost, para um teste local não consumir a fila de produção), a cada 30 s e ao voltar à aba.
   ============================================================ */
(function () {
  'use strict';
  const INTERVALO_MS = 30000;
  /* Tipos que ESTA versão sabe executar — o banco só entrega estes (uma versão antiga em cache nunca pega tipo novo e o marca como falho). */
  const TIPOS = ['proposta_assinada', 'proposta_recusada', 'proposta_revisao', 'contrato_venda_assinado', 'contrato_venda_representante', 'contrato_venda_signatario'];
  let rodando = false;

  function sb() { return (window.__VP_SB || {}).sb; }
  function ehLocal() { return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(window.location.hostname); }
  function ligado() {
    try { if (localStorage.getItem('vp_fluxo_pendentes') === 'off') return false; } catch (e) {}
    if (ehLocal()) { try { return localStorage.getItem('vp_fluxo_dev') === '1'; } catch (e) { return false; } }
    return true;
  }
  function logado() { const u = window.__VP_USER; return !!(u && u.email && u.email !== 'dev@localhost'); }

  /* Executa um item reivindicado. Devolve null se deu certo ou o texto do problema. */
  async function executar(item) {
    const P = window.PropostaStore;
    if (!P || !window.EventosFluxo) return 'módulos ainda não carregados';
    if (String(item.tipo).indexOf('contrato_venda_') === 0) {
      if (!window.CVStore || !window.CVStore.processarEfeitoFila) return 'módulos ainda não carregados';
      await window.CVStore.processarEfeitoFila(item.tipo, item.payload || {});
      return null;
    }
    const rec = await P.getById(item.proposta_id);
    if (!rec) return 'proposta não encontrada';
    const pay = item.payload || {};
    if (item.tipo === 'proposta_assinada') {
      const falhas = await P.executarEfeitosAssinatura(rec, { signerName: pay.signerName, modalidadeEntrega: pay.modalidadeEntrega });
      return falhas && falhas.length ? falhas.join(' | ') : null;
    }
    if (item.tipo === 'proposta_recusada' || item.tipo === 'proposta_revisao') {
      const recusada = item.tipo === 'proposta_recusada';
      const r = await window.EventosFluxo.registrar({
        evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: rec.numero_cotacao,
        alvoLabel: rec.titulo || rec.numero_documento, alvoId: rec.id,
        detalhe: recusada ? { resposta: 'recusada', nome: pay.nome || null, motivo: pay.motivo || null } : { resposta: 'revisao_solicitada', texto: pay.texto || null },
        atorNome: (recusada ? pay.nome : null) || (rec.recipient && rec.recipient.name) || 'Cliente (link público)',
      });
      return r ? null : 'evento não registrado';
    }
    return 'tipo desconhecido: ' + item.tipo;
  }

  async function processar() {
    if (rodando || !ligado() || !logado()) return 0;
    const c = sb(); if (!c) return 0;
    rodando = true;
    let feitos = 0;
    try {
      const { data, error } = await c.rpc('fluxo_pendentes_reivindicar', { p_max: 5, p_tipos: TIPOS });
      if (error) { console.warn('[FluxoPendentes] reivindicar falhou', error.message); return 0; }
      for (const item of data || []) {
        let erro = null;
        try { erro = await executar(item); } catch (e) { erro = (e && e.message) || String(e); }
        try { await c.rpc('fluxo_pendentes_concluir', { p_id: item.id, p_erro: erro }); } catch (e) { console.warn('[FluxoPendentes] concluir falhou', e); }
        if (erro) console.warn('[FluxoPendentes] item ' + item.id + ' (' + item.tipo + ') com problema:', erro);
        else feitos++;
      }
      if (feitos) { try { window.dispatchEvent(new CustomEvent('vp:decisoes')); } catch (e) {} }
    } catch (e) {
      console.warn('[FluxoPendentes] processar falhou', e);
    } finally {
      rodando = false;
    }
    return feitos;
  }

  window.FluxoPendentes = { processar };

  setTimeout(processar, 8000);
  setInterval(processar, INTERVALO_MS);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') processar(); });
})();
