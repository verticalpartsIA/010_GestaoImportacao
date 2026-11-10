/* ============================================================
   qc-respostas-reactpdf.entry.js — PDF das respostas do formulário do Quadro de Comando por pedido (10/11/2026).
   Spec: docs/superpowers/specs/2026-11-10-quadro-link-por-pedido-pdf.md.
   Recebe as linhas [[rótulo, valor], …] já prontas (src/qc-respostas-calc.js) — não depende de catálogo nem do formulário.
   Mesmo padrão dos outros bundles: react/react-pdf externos, React.createElement puro, filtra null dos filhos
   (o reconciler do react-pdf não ignora null como o React DOM). Rodar `npm run build:pdf:qc` ao editar.
   ============================================================ */
import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font, pdf } from '@react-pdf/renderer';

const h0 = React.createElement;
function h(type, props, children) {
  return h0(type, props,
    Array.isArray(children) ? children.filter((c) => c !== null && c !== false && c !== undefined) : children);
}

let _fontes = false;
function registrarFontes() {
  if (_fontes) return;
  const inter = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-';
  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter + '400-normal.woff', fontWeight: 400 },
      { src: inter + '600-normal.woff', fontWeight: 600 },
      { src: inter + '700-normal.woff', fontWeight: 700 },
    ],
  });
  _fontes = true;
}

const NAVY = '#1b2a4a';
const YELLOW = '#F5C400';
const S = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10, color: '#333', paddingTop: 40, paddingBottom: 56, paddingHorizontal: 42 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1pt solid #ddd', paddingBottom: 10, marginBottom: 14 },
  marca: { fontSize: 11, fontWeight: 700, color: NAVY },
  tag: { fontSize: 8, fontWeight: 700, color: '#777', marginTop: 3 },
  numLbl: { fontSize: 8, fontWeight: 700, color: '#777', textAlign: 'right' },
  numVal: { fontSize: 16, fontWeight: 700, color: NAVY, textAlign: 'right' },
  cliente: { fontSize: 9, color: '#555', textAlign: 'right', marginTop: 2 },
  numData: { fontSize: 11, fontWeight: 700, color: NAVY, textAlign: 'right' },
  titulo: { fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 },
  linha: { flexDirection: 'row', borderBottom: '0.5pt solid #e5e5e5', paddingVertical: 4 },
  rotulo: { width: '34%', fontSize: 8.5, fontWeight: 600, color: '#555', paddingRight: 8 },
  valor: { width: '66%', fontSize: 9.5 },
  rodape: { position: 'absolute', bottom: 22, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#777' },
  barra: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, backgroundColor: YELLOW },
});

function montarDocumento(d) {
  const linhas = (d.linhas || []).map((p, i) =>
    h(View, { style: S.linha, key: 'l' + i, wrap: false }, [
      h(Text, { style: S.rotulo, key: 'r' }, String(p[0])),
      h(Text, { style: S.valor, key: 'v' }, String(p[1])),
    ]));
  const pagina = h(Page, { size: 'A4', style: S.page }, [
    h(View, { style: S.topo, key: 'topo', fixed: true }, [
      h(View, { key: 'a' }, [
        h(Text, { style: S.marca, key: 'm' }, 'VerticalParts'),
        h(Text, { style: S.tag, key: 't' }, 'QUADRO DE COMANDO — INFORMAÇÕES DO CLIENTE'),
      ]),
      h(View, { key: 'b' }, [
        h(Text, { style: S.numLbl, key: 'l' }, d.numeroPedido ? 'PEDIDO OMIE' : 'FORMULÁRIO RESPONDIDO EM'),
        h(Text, { style: d.numeroPedido ? S.numVal : S.numData, key: 'v' }, String(d.numeroPedido || d.respondidoEm || '—')),
        d.cliente ? h(Text, { style: S.cliente, key: 'c' }, String(d.cliente)) : null,
      ]),
    ]),
    h(Text, { style: S.titulo, key: 'tit' }, 'Respostas do formulário técnico'),
    ...linhas,
    h(View, { style: S.rodape, key: 'rod', fixed: true }, [
      h(Text, { key: 'e' }, d.respondidoEm ? `Respondido em ${d.respondidoEm}` : ''),
      h(Text, { key: 'p', render: ({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}` }),
    ]),
    h(View, { style: S.barra, key: 'bar', fixed: true }),
  ]);
  return h0(Document, {}, [pagina]);
}

async function baixar(dados, filename) {
  registrarFontes();
  const blob = await pdf(montarDocumento(dados)).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

window.QcRespostasReactPdf = { baixar };
