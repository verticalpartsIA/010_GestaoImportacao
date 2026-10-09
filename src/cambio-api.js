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

  /* Câmbio histórico — usado pro "câmbio congelado no dia da cotação"
     (pedido do usuário, 27/08): captura o USD/BRL no dia exato em que o
     fornecedor respondeu, e também serve pra backfill de cotações que já
     tinham sido respondidas antes dessa feature existir. `data` pode ser
     Date ou string ISO/parseável. Sem cache — cada dia é uma chamada só,
     usado uma vez e persistido no banco. */
  const ENDPOINT_HISTORICO = 'https://economia.awesomeapi.com.br/json/daily/USD-BRL/1';
  function yyyymmdd(d) {
    return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  async function buscarUsdBrlHistorico(data) {
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) throw new Error('Data inválida para busca de câmbio histórico.');
    const ymd = yyyymmdd(d);
    const url = `${ENDPOINT_HISTORICO}?start_date=${ymd}&end_date=${ymd}`;
    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      throw new Error('Câmbio histórico indisponível — sem conexão com o serviço de cotação.');
    }
    if (!res.ok) throw new Error('Câmbio histórico indisponível — serviço retornou erro.');
    const arr = await res.json();
    const d0 = Array.isArray(arr) && arr[0];
    if (!d0 || !d0.bid) throw new Error('Câmbio histórico indisponível — sem dado para essa data (fim de semana/feriado?).');
    return { valor: Number(d0.bid), timestamp: d0.create_date || null };
  }

  window.CambioAPI = { buscarUsdBrl, buscarUsdBrlHistorico };
}());
