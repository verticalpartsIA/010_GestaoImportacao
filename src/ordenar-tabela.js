/* ============================================================
   ordenar-tabela.js — "Classificar a ordem" clicando no título da coluna (Logística / Cadastros).
   Uso:  const ord = window.useOrdenacao();            // no topo do componente (antes de qualquer return)
         const linhas = ord.aplicar(lista, { codigo: (l) => l.codigo, qtd: (l) => Number(l.qtd) });
         <thead><tr>{ord.th('codigo', 'Código')}{ord.th('qtd', 'Qtd.', { className: 'text-right' })}</tr></thead>
   Clique: crescente ▲ → decrescente ▼ → volta à ordem original. `aplicar` não é hook de propósito (as telas
   calculam a lista depois de returns antecipados). Texto ordena em pt-BR com números naturais; vazio vai sempre ao fim.
   ============================================================ */
(function () {
  'use strict';
  const col = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

  function comparar(a, b) {
    const va = a === undefined || a === null || a === '' || (typeof a === 'number' && isNaN(a));
    const vb = b === undefined || b === null || b === '' || (typeof b === 'number' && isNaN(b));
    if (va || vb) return va === vb ? 0 : (va ? 1 : -1);   // sem valor: fim, qualquer que seja o sentido
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return col.compare(String(a), String(b));
  }

  function ordenar(lista, ord, getters) {
    const get = ord && ord.chave && getters && getters[ord.chave];
    if (!get) return lista;
    const dir = ord.dir;
    return lista.map((l, i) => ({ l, i, v: get(l) })).sort((x, y) => {
      const vx = x.v === undefined || x.v === null || x.v === '' || (typeof x.v === 'number' && isNaN(x.v));
      const vy = y.v === undefined || y.v === null || y.v === '' || (typeof y.v === 'number' && isNaN(y.v));
      if (vx || vy) return vx === vy ? x.i - y.i : (vx ? 1 : -1);
      return (comparar(x.v, y.v) * dir) || (x.i - y.i);
    }).map((x) => x.l);
  }

  function useOrdenacao() {
    const R = window.React;
    const st = R.useState({ chave: null, dir: 1 });
    const ord = st[0], setOrd = st[1];
    const alternar = (chave) => setOrd((o) => (o.chave !== chave ? { chave, dir: 1 } : (o.dir === 1 ? { chave, dir: -1 } : { chave: null, dir: 1 })));
    const th = (chave, rotulo, props) => {
      const p = props || {};
      const ativo = ord.chave === chave;
      return R.createElement('th', {
        ...p, key: p.key,
        title: p.title || 'Clique para classificar',
        'aria-sort': ativo ? (ord.dir === 1 ? 'ascending' : 'descending') : 'none',
        style: { cursor: 'pointer', userSelect: 'none', ...(p.style || {}) },
        onClick: () => alternar(chave),
      }, rotulo, ativo ? (ord.dir === 1 ? ' ▲' : ' ▼') : null);
    };
    return { ord, alternar, th, aplicar: (lista, getters) => ordenar(lista, ord, getters) };
  }

  window.useOrdenacao = useOrdenacao;
  window.OrdenarTabela = { ordenar, comparar };
}());
