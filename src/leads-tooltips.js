/* VP Gestão — ajuda contextual da tela Comercial > Leads */
(function () {
  'use strict';

  const STYLE_ID = 'vp-leads-help-style';
  const MARK = 'data-vp-leads-help';
  const HELP = [
    { find: 'Leads ativos', text: 'Total de oportunidades comerciais cadastradas no pipeline.' },
    { find: 'Em qualificação', text: 'Leads que ainda estão sendo avaliados e complementados antes de avançar no processo comercial.' },
    { find: 'Propostas no ar', text: 'Oportunidades que já possuem proposta enviada e aguardam evolução comercial.' },
    { find: 'Valor pipeline', text: 'Soma do valor estimado de todas as oportunidades cadastradas.' },
    { find: 'Exportar', text: 'Exporta para CSV os Leads que estão visíveis com os filtros atuais.' },
    { find: 'Novo Lead', text: 'Abre o formulário para cadastrar uma nova oportunidade comercial.' },
  ];

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .vp-help-wrap{display:inline-flex;align-items:center;gap:6px;position:relative}
      .vp-help-q{width:18px;height:18px;border:1px solid #2563eb;border-radius:50%;background:#eff6ff;color:#1d4ed8;font:700 11px/16px Arial,sans-serif;display:inline-flex;align-items:center;justify-content:center;cursor:help;padding:0;vertical-align:middle;flex:0 0 auto}
      .vp-help-q:hover,.vp-help-q:focus{background:#2563eb;color:#fff;outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
      .vp-help-pop{position:fixed;z-index:100000;width:min(300px,calc(100vw - 28px));padding:12px 14px;border:1px solid #bfdbfe;border-radius:10px;background:#fff;color:#172033;box-shadow:0 12px 32px rgba(15,23,42,.18);font:12px/1.5 Arial,sans-serif;display:none}
      .vp-help-pop strong{display:block;color:#1d4ed8;font-size:12px;margin-bottom:4px}
      .vp-help-pop.is-open{display:block}
      .vp-help-field{position:relative}
      .vp-help-field::after{content:'?';position:absolute;right:7px;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:50%;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;text-align:center;font:700 10px/14px Arial,sans-serif;pointer-events:none}
      .vp-help-field input,.vp-help-field select{padding-right:28px!important}
    `;
    document.head.appendChild(s);
  }

  let pop = null;
  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'vp-help-pop';
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);
    return pop;
  }

  function closePop() { if (pop) pop.classList.remove('is-open'); }
  function showPop(btn, title, text) {
    const p = ensurePop();
    p.innerHTML = '<strong></strong><span></span>';
    p.querySelector('strong').textContent = title;
    p.querySelector('span').textContent = text;
    p.classList.add('is-open');
    const r = btn.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 28);
    let left = Math.max(14, Math.min(r.left, window.innerWidth - w - 14));
    let top = r.bottom + 8;
    p.style.width = w + 'px'; p.style.left = left + 'px'; p.style.top = top + 'px';
    requestAnimationFrame(() => {
      const pr = p.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - 12) p.style.top = Math.max(12, r.top - pr.height - 8) + 'px';
    });
  }

  function helpButton(title, text) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vp-help-q'; b.textContent = '?';
    b.setAttribute('aria-label', 'Ajuda: ' + title); b.title = text;
    b.addEventListener('mouseenter', () => showPop(b, title, text));
    b.addEventListener('mouseleave', closePop);
    b.addEventListener('focus', () => showPop(b, title, text));
    b.addEventListener('blur', closePop);
    b.addEventListener('click', (e) => { e.stopPropagation(); showPop(b, title, text); });
    return b;
  }

  function exactText(root, text) {
    return Array.from(root.querySelectorAll('*')).find(el => el.children.length === 0 && el.textContent.trim() === text);
  }

  function annotate(root, label, text) {
    const el = exactText(root, label);
    if (!el || el.hasAttribute(MARK)) return;
    el.setAttribute(MARK, '1');
    const wrap = document.createElement('span'); wrap.className = 'vp-help-wrap';
    el.parentNode.insertBefore(wrap, el); wrap.appendChild(el); wrap.appendChild(helpButton(label, text));
  }

  function annotateSearch(root) {
    const input = root.querySelector('input[placeholder*="Buscar prédio"]');
    if (!input || input.hasAttribute(MARK)) return;
    input.setAttribute(MARK, '1'); input.title = 'Pesquise por prédio, contato ou equipamento. A busca considera toda a listagem de Leads.';
    const host = input.closest('.search') || input.parentElement; if (host) host.classList.add('vp-help-field');
  }

  function annotateOwner(root) {
    const selects = Array.from(root.querySelectorAll('select.input'));
    const sel = selects.find(s => Array.from(s.options || []).some(o => o.textContent.trim() === 'Todos'));
    if (!sel || sel.hasAttribute(MARK)) return;
    sel.setAttribute(MARK, '1'); sel.title = 'Filtre a listagem para exibir somente os Leads atribuídos a um responsável específico.';
    const host = sel.parentElement; if (host) host.classList.add('vp-help-field');
  }

  function annotateStatus(root) {
    const seg = root.querySelector('.tbar .seg');
    if (!seg || seg.hasAttribute(MARK)) return;
    seg.setAttribute(MARK, '1'); seg.title = 'Filtre os Leads pela etapa atual do processo comercial.';
    seg.appendChild(helpButton('Filtros por status', 'Use estes botões para visualizar somente os Leads da etapa selecionada.'));
  }

  function annotateTable(root) {
    const table = root.querySelector('.table-wrap table');
    if (!table || table.hasAttribute(MARK)) return;
    table.setAttribute(MARK, '1'); table.title = 'Clique em uma linha ou em Abrir para acessar o detalhe completo do Lead e seus próximos passos.';
    const th = exactText(table, 'Próx. Ação');
    if (th) { th.title = 'Próxima atividade prevista para esta oportunidade. A prioridade aparece logo abaixo.'; }
  }

  function apply() {
    const title = Array.from(document.querySelectorAll('.page-head__title')).find(e => e.textContent.trim() === 'Pipeline de Leads');
    if (!title) { closePop(); return; }
    const root = title.closest('.page') || document;
    addStyle();
    HELP.forEach(h => annotate(root, h.find, h.text));
    annotateStatus(root); annotateOwner(root); annotateSearch(root); annotateTable(root);
    if (!title.hasAttribute(MARK)) {
      title.setAttribute(MARK, '1');
      const wrap = document.createElement('span'); wrap.className = 'vp-help-wrap';
      title.parentNode.insertBefore(wrap, title); wrap.appendChild(title);
      wrap.appendChild(helpButton('Pipeline de Leads', 'Visão geral das oportunidades comerciais. Aqui você acompanha volume, etapa, responsável, valor e próxima ação de cada Lead.'));
    }
  }

  document.addEventListener('click', (e) => { if (!e.target.closest('.vp-help-q') && !e.target.closest('.vp-help-pop')) closePop(); });
  window.addEventListener('scroll', closePop, true); window.addEventListener('resize', closePop);
  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  function boot() { apply(); observer.observe(document.body, { childList:true, subtree:true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
