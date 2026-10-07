/* ============================================================
   importacao-handoff.js — issue #707

   Leva o Nº da Cotação de uma tela de Importação pra outra (hoje:
   P.I. → "Criar RFQ"/"Criar IMS"), sem acoplar os arquivos entre si —
   mesmo racional do pcpIrPara (cadastro-itens.jsx), aplicado aqui com
   nome e chave próprios porque PIPage/RFQPage/IMSPage não compartilham
   o mesmo módulo. `ler()` consome a chave (nunca reaplica numa tela
   aberta por engano/F5).

   window.ImportacaoHandoff
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'vp_importacao_criar_doc';

  function escrever(numeroCotacao) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ numero_cotacao: numeroCotacao })); } catch (e) { /* sem sessionStorage: segue sem prefill */ }
  }

  function ler() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      sessionStorage.removeItem(KEY);
      const parsed = JSON.parse(raw);
      return (parsed && parsed.numero_cotacao != null) ? parsed : null;
    } catch (e) { return null; }
  }

  window.ImportacaoHandoff = { KEY, escrever, ler };
}());
