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
      return R().subscribe((loc) => { if (loc && loc.route === rota) setN((n) => n + 1); });
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

  window.useRotaItem = useRotaItem;
  window.useRotaId = useRotaId;
}());
