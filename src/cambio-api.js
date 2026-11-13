/* ============================================================
   cambio-api.js — Câmbio USD/BRL = PTAX de COMPRA do Banco Central
   (API Olinda, pública, sem chave, com CORS liberado para o hub).

   13/11/2026 — DECISÃO do Gelson: a fonte do câmbio é a PTAX (a tela já a
   chamava de "PTAX"; antes vinha do `bid` do dólar comercial da AwesomeAPI,
   que não é a PTAX) e vale a de COMPRA ("nós importamos e isso é utilizado
   para as importações").

   Pedido original (27/08): a Precificação herda o valor unitário em USD que
   o fornecedor cotou, mas o câmbio usado no cálculo oficial (tx_cambial) é
   digitado à mão e fica "congelado" — não reflete o dólar de hoje. Este
   módulo só BUSCA a cotação pra referência / comparação; não substitui
   tx_cambial sozinho (o Financeiro decide se aplica ou não, via botão).

   A PTAX é divulgada 1x por dia útil (boletim de fechamento, por volta das
   13h). "Agora" = a PTAX mais recente já divulgada; fim de semana, feriado
   ou antes das 13h valem a do último dia útil publicado. Mantém a MESMA
   interface de antes: { valor, timestamp }.

   window.CambioAPI
   ============================================================ */
(function () {
  'use strict';

  const BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo';
  const CACHE_MS = 60 * 1000; // evita bater na API a cada re-render/foco
  let _cache = null; // { valor, timestamp, buscadoEm }

  function mdy(d) { // a API quer MM-DD-AAAA
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + d.getFullYear();
  }

  /* Última PTAX divulgada até `ate` (Date), olhando até 10 dias para trás (cobre fim de semana e feriados). Sem cache. */
  async function ptaxAte(ate, msgErro) {
    const ini = new Date(ate.getTime() - 10 * 24 * 3600 * 1000);
    const url = `${BASE}(dataInicial=@di,dataFinalCotacao=@df)?@di='${mdy(ini)}'&@df='${mdy(ate)}'&$orderby=dataHoraCotacao%20desc&$top=1&$format=json`;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`${msgErro} — sem conexão com o Banco Central.`);
    }
    if (!res.ok) throw new Error(`${msgErro} — o Banco Central retornou erro.`);
    const data = await res.json();
    const d0 = data && Array.isArray(data.value) && data.value[0];
    if (!d0 || !(Number(d0.cotacaoCompra) > 0)) throw new Error(`${msgErro} — sem PTAX divulgada no período.`);
    return { valor: Number(d0.cotacaoCompra), timestamp: d0.dataHoraCotacao || null };
  }

  async function buscarUsdBrl() {
    if (_cache && (Date.now() - _cache.buscadoEm) < CACHE_MS) return _cache;
    const r = await ptaxAte(new Date(), 'Câmbio indisponível');
    _cache = { ...r, buscadoEm: Date.now() };
    return _cache;
  }

  /* Câmbio histórico — "câmbio congelado no dia da cotação" (27/08): a PTAX de compra do dia (ou do último dia útil antes dele,
     se o dia não teve PTAX). `data` pode ser Date ou string ISO/parseável. Sem cache. */
  async function buscarUsdBrlHistorico(data) {
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) throw new Error('Data inválida para busca de câmbio histórico.');
    return ptaxAte(d, 'Câmbio histórico indisponível');
  }

  window.CambioAPI = { buscarUsdBrl, buscarUsdBrlHistorico };
}());
