/* ============================================================
   utils.js — utilitários globais sem dados de demonstração
   ============================================================ */

/* Converte texto monetário livre (ex.: "$18,990", "18.990,50", "R$ 5,16")
   em número. Fornecedores digitam preço em qualquer formato — sem isso,
   Number("$18,990") vira NaN e o valor herdado na Precificação zera
   silenciosamente (bug real, achado 27/08 — cotação Glarie VPEL-EL0922).
   Heurística: se tem vírgula E ponto, o último dos dois é o separador
   decimal; se só tem vírgula, decimal só se tiver exatos 2 dígitos depois
   (senão é separador de milhar). */
window.parseMoeda = function(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = (s.length - lastComma - 1) === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

window.csvDownload = function(rows, filename) {
  if (!rows || !rows.length) return window.toast('Nenhum dado para exportar.', 'warning');
  const keys = Object.keys(rows[0]);
  const esc  = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv  = [keys.map(esc).join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  window.toast('CSV exportado: ' + filename, 'success');
};
