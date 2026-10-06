/* ============================================================
   reposicao-calc.js — Logística Interna · Almoxarifado · Reposição de materiais (funções puras, sem rede).
   Por que existe: a maior parte dos itens é IMPORTADA (≈90 dias para chegar). Estoque mínimo não serve: quando o
   saldo encosta no mínimo, o que for comprado só chega depois de ~3 meses de consumo. Aqui a decisão sai do
   CONSUMO MÉDIO REAL × PRAZO DE CHEGADA:
     consumoDia   = média mensal ÷ 30
     crítico      = posição ≤ consumoDia × prazo                  (vai faltar antes de qualquer compra nova chegar)
     comprar      = posição ≤ consumoDia × (prazo + folga)         (ponto de pedido)
     máximo       = consumoDia × (prazo + folga + ciclo)           (alvo da compra; ciclo ≈ fechar o container)
     sugestão     = máximo − posição                               (só para crítico/comprar)
     posição      = disponível (físico − reservado) + a caminho (pendente de compra no Omie)
   Regras que existem por motivo real:
   - Código terminado em "n" MINÚSCULO = nacional (prazo menor); qualquer outro = importado.
   - A média só conta meses COMPLETOS e só a partir do 1º movimento do item (item novo não é diluído por meses em que não existia).
   - Consumo = −Σ qtde dos movimentos de estoque do Omie (saída negativa). Devoluções/cancelamentos (entradas que revertem
     venda) abatem sozinhos. Entram de fora as origens configuradas (compras, importação, entrada de OP…); ajuste manual (AJU)
     para CIMA é correção de contagem e não conta como "menos consumo".
   - Sem consumo no histórico = "sem giro": não gera sugestão.
   Exposto em window.PcpReposicao.
   ============================================================ */
(function () {
  'use strict';

  // BEGIN CALC — copiado para supabase/functions/alerta-pcp-compras/index.ts; src/alerta-pcp-paridade.test.js confere que seguem idênticos
  const MESES_HISTORICO_CURTO = 3;
  const JANELA_MEDIA_MESES = 12;
  const SEM_GIRO_RECENTE_MESES = 6;
  const ehNacional = (codigo) => /n$/.test(String(codigo || ''));        // só "n" minúsculo

  const ym = (iso) => String(iso).slice(0, 7);
  const idx = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + (m - 1); };
  const keyDe = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

  function origensDe(texto) {
    return new Set(String(texto || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
  }
  function contaComoConsumo(mov, excluidas) {
    const o = String(mov.cod_origem || '').toUpperCase();
    if (excluidas.has(o)) return false;
    if (o === 'AJU' && Number(mov.qtde) > 0) return false;
    return true;
  }

  // movs: [{ dt_mov:'YYYY-MM-DD', qtde, cod_origem }] de UM item.
  function calcularItem({ codigo, movs, hoje, cfg, disponivel, pendente }) {
    const excl = origensDe(cfg.origens_excluidas);
    const prazo = ehNacional(codigo) ? cfg.prazo_nacional_dias : cfg.prazo_importado_dias;
    const base = { codigo, nacional: ehNacional(codigo), prazo, disponivel: Number(disponivel || 0), aCaminho: Number(pendente || 0) };
    base.posicao = base.disponivel + base.aCaminho;

    const porMes = {};
    let primeiro = null;
    (movs || []).forEach(m => {
      const k = ym(m.dt_mov);
      if (primeiro === null || k < primeiro) primeiro = k;            // 1º movimento de QUALQUER tipo
      if (contaComoConsumo(m, excl)) porMes[k] = (porMes[k] || 0) - Number(m.qtde || 0);
    });

    const mesAtual = idx(ym(hoje));
    const inicio = Math.max(idx(ym(cfg.janela_desde)), primeiro === null ? Infinity : idx(primeiro));
    const n = mesAtual - inicio;                                       // meses completos (exclui o mês em curso)
    if (!(n > 0)) return { ...base, status: 'sem_historico', meses: 0, mediaMensal: 0, consumoDia: 0, sugestao: 0, serie: [], serieInicio: null, ultimoConsumo: null, mesesSemSaida: null };

    const serie = [];
    for (let i = inicio; i < mesAtual; i++) serie.push(Math.max(0, porMes[keyDe(i)] || 0));
    // A média é dos ÚLTIMOS 12 meses completos (ou do que existir): consumo de 2 anos atrás não decide a compra de hoje.
    const janela = serie.slice(-Math.min(JANELA_MEDIA_MESES, n));
    const media = janela.reduce((a, b) => a + b, 0) / janela.length;
    const ult = serie.slice(-Math.min(6, n));
    const media6 = ult.reduce((a, b) => a + b, 0) / ult.length;
    let tendencia = 'estavel';
    if (n >= 6 && media > 0) { const r = media6 / media; if (r > 1.25) tendencia = 'alta'; else if (r < 0.75) tendencia = 'baixa'; }
    let ultimoI = -1;
    serie.forEach((v, i) => { if (v > 0) ultimoI = i; });
    const mesesSemSaida = ultimoI < 0 ? null : n - 1 - ultimoI;      // 0 = houve saída no último mês completo

    const consumoDia = media / 30;
    const r = {
      ...base, meses: n, mediaMensal: media, media6, tendencia, consumoDia, historicoCurto: n < MESES_HISTORICO_CURTO,
      ultimoMes: serie[serie.length - 1], serie, serieInicio: keyDe(inicio), mesesSemSaida,
      ultimoConsumo: ultimoI < 0 ? null : keyDe(inicio + ultimoI),
    };
    if (!(consumoDia > 0)) return { ...r, status: 'sem_giro', sugestao: 0 };
    // Sem saída há 6 meses ou mais: o item parou de girar; não sugere compra mesmo que a média de 12 meses ainda seja > 0.
    if (mesesSemSaida >= SEM_GIRO_RECENTE_MESES) return { ...r, status: 'sem_giro', semGiroRecente: true, sugestao: 0 };

    const critico = consumoDia * prazo;
    const pedido = consumoDia * (prazo + cfg.folga_dias);
    const maximo = consumoDia * (prazo + cfg.folga_dias + cfg.ciclo_dias);
    const coberturaAtual = base.disponivel / consumoDia;
    const coberturaProj = base.posicao / consumoDia;
    let status = 'ok';
    if (base.posicao <= critico) status = 'critico';
    else if (base.posicao <= pedido) status = 'comprar';
    else if (base.posicao > maximo) status = 'excesso';
    const sugestao = (status === 'critico' || status === 'comprar') ? Math.max(0, Math.ceil(maximo - base.posicao)) : 0;
    const excesso = status === 'excesso' ? Math.floor(base.posicao - maximo) : 0;
    return { ...r, status, critico, pedido, maximo, coberturaAtual, coberturaProj, sugestao, excesso, faltaAntesDeChegar: coberturaAtual < prazo };
  }

  // END CALC
  window.PcpReposicao = { ehNacional, calcularItem, origensDe, contaComoConsumo, MESES_HISTORICO_CURTO };
}());
