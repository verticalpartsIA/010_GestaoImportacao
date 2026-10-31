/* ============================================================
   rota-pcp.js — Logística Interna · link do ITEM aberto dentro de uma tela (hooks de React, sem rede).
   Complementa window.useRouteTab (router.js, PR #625), que só cobre a ABA (2º segmento da URL). Aqui entra o que vem depois:
       /logistica/pcp/ordens/{id da OP}            → useRotaItem('pcp', 'ordens')       (item = 3º segmento, dentro da aba)
       /logistica/montagem-produto/{código}        → useRotaId('montagem-produto')       (2º segmento é um registro, não aba)
   Por que existe: a OP aberta e o produto escolhido viviam só em useState/sessionStorage, então o detalhe ficava atrás do
   link da lista: sem link direto, F5 voltava à lista e o Voltar do navegador não reabria o item.
   Regras que existem por motivo real:
   - O valor é LIDO DA URL a cada render (não duplicado em estado): quando outro código troca a aba (useRouteTab navega para
     /pcp e some o 3º segmento), a tela já enxerga o item fechado sem precisar avisar ninguém. Um contador só força o re-render.
   - Não depende do app.jsx: o App preserva o 2º/3º segmento da URL quando o subsel é nulo (mesmo padrão de Configurações).
   - Voltar/Avançar do navegador: escuta VpRouter.subscribe e re-renderiza.
   Exposto em window.useRotaItem / window.useRotaId.
   ============================================================ */
(function () {
  'use strict';

  const R = () => window.VpRouter;

  function useRerender(rota) {
    const [, setN] = React.useState(0);
    React.useEffect(() => {
      if (!R()) return undefined;
      const unsub = R().subscribe((loc) => { if (loc && loc.route === rota) setN((n) => n + 1); });
      // navigate() chamado direto por outra parte da tela (não pelo setter deste hook) — ver router.js.
      const onNav = () => { const loc = R().parseLocation(); if (loc && loc.route === rota) setN((n) => n + 1); };
      window.addEventListener('vp:navigate', onNav);
      return () => { unsub(); window.removeEventListener('vp:navigate', onNav); };
    }, []);
    return () => setN((n) => n + 1);
  }

  // 3º segmento (item) dentro de uma aba. Retorna [item, setItem(id, { replace }?)].
  function useRotaItem(rota, aba) {
    const rerender = useRerender(rota);
    const loc = (R() && R().parseLocation()) || {};
    const item = loc.route === rota && loc.id === aba ? (loc.tab || '') : '';
    const setItem = (novo, opts) => { if (R()) R().navigate(rota, aba, novo || null, opts); rerender(); };
    return [item, setItem];
  }

  // 2º segmento = registro (não aba). Retorna [id, setId].
  function useRotaId(rota) {
    const rerender = useRerender(rota);
    const loc = (R() && R().parseLocation()) || {};
    const id = loc.route === rota ? (loc.id || '') : '';
    const setId = (novo) => { if (R()) R().navigate(rota, novo || null); rerender(); };
    return [id, setId];
  }

  /* Destaque da coluna sob o mouse nas tabelas do PCP (a linha é CSS). Uso: onMouseOver/onMouseLeave={window.pcpColHover}. */
  function pcpColHover(e) {
    const t = e.currentTarget; const c = e.target.closest ? e.target.closest('td,th') : null;
    const i = c ? c.cellIndex : -1;
    if (t.__hc === i) return;
    t.querySelectorAll('.pcp-col-hot').forEach(x => x.classList.remove('pcp-col-hot'));
    t.__hc = i;
    if (i < 0) return;
    t.querySelectorAll('tr').forEach(r => { if (r.cells.length > 2 && r.cells[i]) r.cells[i].classList.add('pcp-col-hot'); });
  }

  /* Filtro/busca da tela na query string (?chave=valor): F5 e link direto reabrem a tela filtrada.
     Estado local inicializado da URL; o setter regrava com replaceState (não cria entrada no Voltar/Avançar e não
     mexe no caminho, então o roteador e o App não reagem). Valor vazio ou igual ao padrão sai da URL. */
  function useQueryParam(chave, padrao) {
    const ler = () => {
      try { const v = new URLSearchParams(window.location.search).get(chave); return v == null ? padrao : v; } catch (_) { return padrao; }
    };
    const [valor, setValor] = React.useState(ler);
    const set = (novo) => {
      const v = novo == null ? padrao : String(novo);
      setValor(v);
      try {
        const u = new URL(window.location.href);
        if (v === '' || v === padrao) u.searchParams.delete(chave); else u.searchParams.set(chave, v);
        window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
      } catch (_) { /* sem history: segue só em memória */ }
    };
    return [valor, set];
  }

  window.useQueryParam = useQueryParam;
  window.useRotaItem = useRotaItem;
  window.useRotaId = useRotaId;
  window.pcpColHover = pcpColHover;

  /* Vale para TODA table.pcp-grid e table.ci-table (inclusive as futuras), sem precisar ligar tabela por tabela. */
  function pcpColDelegado(e) {
    const t = e.target && e.target.closest ? e.target.closest('table.pcp-grid, table.ci-table, table.tab-cruz, table.t') : null;
    if (t) { pcpColHover({ currentTarget: t, target: e.target }); return; }
    document.querySelectorAll('table.pcp-grid, table.ci-table, table.tab-cruz, table.t').forEach(x => { if (x.__hc !== undefined && x.__hc !== -1) pcpColHover({ currentTarget: x, target: document.body }); });
  }
  document.addEventListener('mouseover', pcpColDelegado);
}());
