/* ============================================================
   sidebar-busca-calc.js — regra pura da busca de TELAS da sidebar (Ctrl K).
   Recebe os grupos JÁ filtrados por permissão (mesma lista que desenha o
   menu) e devolve as telas que casam com o texto. Nunca decide acesso:
   quem filtra é o Sidebar (filterVisible + grupoVisivel). Não confundir com
   a busca de REGISTROS do cabeçalho (leads, contratos…).
   ============================================================ */
(function () {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  /* grupos: [{ label, items: [{ id, label, subheader?, planned?, icon? }] }]
     Devolve [{ id, label, grupo, icon, score }] ordenado: nome começa com o texto,
     depois palavra do nome, depois trecho do nome, por fim só o módulo casa.
     Subcabeçalhos e itens "planned" (sem rota) nunca entram. */
  function buscar(grupos, texto, limite) {
    const t = norm(texto);
    const max = limite || 12;
    const out = [];
    let ordem = 0;
    (grupos || []).forEach((g) => {
      const gl = norm(g.label);
      (g.items || []).forEach((it) => {
        if (!it || it.subheader || it.planned || !it.id) return;
        const nome = norm(it.label);
        let score = null;
        if (!t) score = 0;
        else if (nome.startsWith(t)) score = 0;
        else if (nome.split(/[\s\-–—/&|.]+/).some((w) => w.startsWith(t))) score = 1;
        else if (nome.includes(t)) score = 2;
        else if (gl.includes(t)) score = 3;
        if (score !== null) out.push({ id: it.id, label: it.label, grupo: g.label, icon: it.icon, score, ordem: ordem++ });
      });
    });
    out.sort((a, b) => a.score - b.score || a.ordem - b.ordem);
    return out.slice(0, max);
  }

  const api = { norm, buscar };
  if (typeof window !== 'undefined') window.SidebarBuscaCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
