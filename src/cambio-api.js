/* ============================================================
   cambio-api.js — Câmbio USD/BRL ao vivo (AwesomeAPI, pública, sem
   chave — mesmo espírito do EnderecoAPI/BrasilAPI já usado no projeto).

   Pedido do usuário (27/08): a Precificação herda o valor unitário em
   USD que o fornecedor cotou, mas o câmbio usado no cálculo oficial
   (tx_cambial) é digitado à mão e fica "congelado" — não reflete o
   dólar de hoje. Este módulo só BUSCA a cotação atual pra referência /
   comparação; não substitui tx_cambial sozinho (o Financeiro decide se
   aplica ou não, via botão na tela).

   window.CambioAPI
   ============================================================ */
(function () {
  'use strict';

  const ENDPOINT = 'https://economia.awesomeapi.com.br/last/USD-BRL';
  const CACHE_MS = 60 * 1000; // evita bater na API a cada re-render/foco
  let _cache = null; // { valor, timestamp, buscadoEm }

  async function buscarUsdBrl() {
    if (_cache && (Date.now() - _cache.buscadoEm) < CACHE_MS) return _cache;
    let res;
    try {
      res = await fetch(ENDPOINT, { cache: 'no-store' });
    } catch (e) {
      throw new Error('Câmbio indisponível — sem conexão com o serviço de cotação.');
    }
    if (!res.ok) throw new Error('Câmbio indisponível — serviço retornou erro.');
    const data = await res.json();
    const d = data && data.USDBRL;
    if (!d || !d.bid) throw new Error('Câmbio indisponível — resposta inesperada do serviço.');
    _cache = {
      valor: Number(d.bid),
      timestamp: d.create_date || null,
      buscadoEm: Date.now(),
    };
    return _cache;
  }

  window.CambioAPI = { buscarUsdBrl };
}());
