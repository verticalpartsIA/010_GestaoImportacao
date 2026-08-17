/* ============================================================
   notificacoes-processamento.js
   Central de Notificações — extraído de NotificacoesPage
   (financeiro.jsx) na revisão de arquitetura da sessão. Funções
   puras, zero I/O — testadas em notificacoes-processamento.test.js.

   Ao contrário dos módulos dashboard-metrics-*.js (que calculam um
   bloco fixo uma vez por carga de dados), filtro/agrupamento aqui
   reagem ao estado local da UI (aba selecionada, filtro de módulo) —
   por isso não tem um compute() único: paraNotificacao() faz a
   transformação bruto→exibição uma vez, e naoLidas()/agruparPorPeriodo()
   ficam como funções pequenas chamadas direto no render, conforme o
   filtro ativo.

   Removidas nesta extração: os filtros "Menções" e "Aprovações", que
   adivinhavam por regex/substring no `title` (sem coluna estruturada
   de verdade em `alertas` pra sustentar isso — ver issue no GitHub).
   De quebra, corrige um 3º bug achado ao extrair iconePara(): a UI
   original tinha um ICON_MAP redundante que não cobria a maioria dos
   módulos (Jurídico/Engenharia/Propostas/Comissões caíam todos no
   ícone genérico "bell" por engano) — iconByModule() já devolvia
   chaves válidas de Icon, o segundo mapa só atrapalhava.

   window.NotificacoesProcessamento
   ============================================================ */
(function () {
  'use strict';

  const ICONE_POR_MODULO = {
    'Importação': 'ship',
    'Jurídico': 'fileText',
    'Financeiro': 'dollar',
    'Engenharia': 'ruler',
    'Cotações': 'mail',
    'Propostas': 'proposal',
    'Comissões': 'award',
  };

  const ROTA_POR_MODULO = {
    'Importação': 'importacao',
    'Jurídico': 'juridico',
    'Financeiro': 'financeiro',
    'Engenharia': 'engenharia',
    'Cotações': 'cotacoes-fornecedor',
    'Propostas': 'propostas',
    'Comissões': 'comissoes',
  };

  function iconePara(module) {
    return ICONE_POR_MODULO[module] || 'bell';
  }

  function rotaPara(module) {
    return ROTA_POR_MODULO[module] || 'dashboard';
  }

  /* Alerta bruto (Supabase) → formato de exibição. `timeAgo` vem de
     window.__VP_SB (fonte única — antes existia uma 2ª cópia local
     dentro de NotificacoesPage). */
  function paraNotificacao(alerta, readIds) {
    const timeAgo = (window.__VP_SB || {}).timeAgo || (() => '—');
    return {
      id: alerta.id,
      title: alerta.title,
      sub: alerta.sub,
      createdAt: alerta.created_at,
      time: timeAgo(alerta.created_at),
      icon: iconePara(alerta.module),
      unread: !(readIds || []).includes(alerta.id),
      module: alerta.module || 'Sistema',
      level: alerta.level,
    };
  }

  function processarAlertas(alertasBrutos, readIds) {
    return (alertasBrutos || []).map((a) => paraNotificacao(a, readIds));
  }

  function naoLidas(notifications) {
    return (notifications || []).filter((n) => n.unread);
  }

  const DIA_MS = 86_400_000;

  /* "Hoje / Ontem / Anteriores" comparando created_at real (data), não
     fazendo parsing da string já formatada por timeAgo (bug corrigido
     nesta extração — "há 3h" contém "h", mas também contém qualquer
     coisa que mude a redação futuramente). */
  function agruparPorPeriodo(notifications, agora) {
    const hoje = agora || new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    const inicioOntem = inicioHoje - DIA_MS;
    const grupos = { Hoje: [], Ontem: [], Anteriores: [] };
    (notifications || []).forEach((n) => {
      const ts = n.createdAt ? new Date(n.createdAt).getTime() : null;
      if (ts == null) { grupos.Anteriores.push(n); return; }
      if (ts >= inicioHoje) grupos.Hoje.push(n);
      else if (ts >= inicioOntem) grupos.Ontem.push(n);
      else grupos.Anteriores.push(n);
    });
    // Remove grupos vazios — mesmo comportamento do Object.entries()
    // original, que só existia pros grupos que tinham item.
    Object.keys(grupos).forEach((k) => { if (!grupos[k].length) delete grupos[k]; });
    return grupos;
  }

  window.NotificacoesProcessamento = {
    ICONE_POR_MODULO, ROTA_POR_MODULO, iconePara, rotaPara,
    paraNotificacao, processarAlertas, naoLidas, agruparPorPeriodo,
  };
}());
