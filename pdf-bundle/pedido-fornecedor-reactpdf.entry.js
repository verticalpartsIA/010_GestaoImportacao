/* ============================================================
   pedido-fornecedor-reactpdf.entry.js — fonte do bundle Vite
   (Fase 1 da migração pra @react-pdf/renderer, Caminho B — plano
   aprovado 20/08: Caminho A via CDN ESM travou de verdade em
   pdf().toBlob() ["Cannot read properties of null (reading
   'props')"] tanto em esm.sh quanto jsDelivr, com e sem instância
   de React pareada — 3 tentativas, sempre o mesmo ponto. É um
   problema de empacotamento do próprio @react-pdf/renderer v4 fora
   de um bundler real, não configuração nossa.)

   Este arquivo SÓ é processado pelo Vite (`npm run build:pdf`), que
   gera src/pedido-fornecedor-reactpdf.bundle.js — um <script> comum,
   sem módulos, sem build step em produção. React/ReactDOM ficam
   como "external" (ver vite.config.js), resolvidos pro window.React
   já carregado pelo resto do app — sem segunda cópia do React.
   ============================================================ */
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';

const h0 = React.createElement;

/* @react-pdf/renderer usa um reconciler próprio que NÃO ignora `null`
   dentro de um array de filhos como o React DOM faz — um `null`
   sobrevivendo (de uma condicional tipo `cond ? h(...) : null`) quebra
   o layout com "Cannot read properties of null (reading 'props')"
   (achado 20/08, ao testar a Fase 1 da migração). h() aqui sempre
   filtra antes de repassar pro createElement real. */
function h(type, props, children) {
  return h0(type, props,
    Array.isArray(children) ? children.filter(c => c !== null && c !== false && c !== undefined) : children);
}

/* idioma helper — igual ao pfLbl() de pedido-fornecedor.jsx */
function lbl(o, idioma) {
  if (!o) return '';
  if (idioma === 'pt') return o.pt;
  if (idioma === 'en') return o.en;
  return o.pt + ' / ' + o.en;
}

let _fontesRegistradas = false;
function registrarFontes() {
  if (_fontesRegistradas) return;
  /* @fontsource — URLs estáveis/versionadas via jsDelivr (ao contrário
     do host gstatic direto do Google Fonts, cujos nomes de arquivo
     mudam por hash e não dá pra fixar com segurança). Só Inter: é a
     única fonte usada de fato neste documento (pedido-fornecedor.css
     não define font-family própria, herda --font-sans = Inter). */
  const base = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-';
  Font.register({
    family: 'Inter',
    fonts: [
      { src: base + '400-normal.woff', fontWeight: 400 },
      { src: base + '600-normal.woff', fontWeight: 600 },
      { src: base + '700-normal.woff', fontWeight: 700 },
      { src: base + '800-normal.woff', fontWeight: 800 },
    ],
  });
  _fontesRegistradas = true;
}

function montarStyles() {
  const amarelo = '#d8a900';
  const cinza = '#555';
  const cinzaClaro = '#999';
  const borda = '#e0e0e0';
  return StyleSheet.create({
    page: { padding: '16mm 14mm', fontSize: 9, fontFamily: 'Inter', color: '#1a1a1a', lineHeight: 1.4 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3pt solid #111', paddingBottom: 8 },
    titulo: { fontSize: 17, fontWeight: 800, letterSpacing: 0.3 },
    numDoc: { fontSize: 9, color: cinza, marginTop: 2 },
    logo: { fontSize: 12, letterSpacing: 0.5 },
    logoP: { color: amarelo, fontWeight: 800 },
    parties: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 12 },
    party: { flex: 1, border: '1pt solid ' + borda, borderRadius: 4, padding: 8 },
    partyLbl: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5, color: cinzaClaro, fontWeight: 700, marginBottom: 3 },
    partyNome: { fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
    partyLinha: { fontSize: 9, color: '#444', marginBottom: 1 },
    secLbl: { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.5, color: amarelo, fontWeight: 800, marginBottom: 4 },
    intro: { marginTop: 6, marginBottom: 10 },
    introTxt: { fontSize: 9 },
    /* sem itálico: @fontsource/inter não publica um arquivo italic — sem
       registrar essa variante o react-pdf falha com "Could not resolve
       font" (achado 20/08). A cor cinza já diferencia o texto em inglês. */
    introTxtEn: { fontSize: 9, color: cinza, marginTop: 3 },
    item: { flexDirection: 'row', gap: 10, border: '1pt solid ' + borda, borderRadius: 6, padding: 10, marginBottom: 8 },
    itemN: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#111', color: amarelo, fontWeight: 800, fontSize: 9, textAlign: 'center', paddingTop: 4 },
    itemFoto: { width: 68, height: 68, border: '1pt solid #eee', borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
    itemFotoImg: { width: 66, height: 66, objectFit: 'contain' },
    semFoto: { fontSize: 7, color: '#bbb', textAlign: 'center', padding: 4 },
    itemBody: { flex: 1, minWidth: 0 },
    sku: { fontSize: 9, color: '#111', fontWeight: 700, backgroundColor: amarelo, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 3, alignSelf: 'flex-start', marginBottom: 5 },
    campo: { marginTop: 5 },
    campoLbl: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.4, color: cinzaClaro, fontWeight: 700, marginBottom: 2 },
    campoVals: { flexDirection: 'row', gap: 10 },
    campoVal: { fontSize: 9, flex: 1 },
    campoValEn: { fontSize: 9, color: cinza, flex: 1 },
    specsTable: { marginTop: 5, border: '1pt solid #ececec' },
    specsRow: { flexDirection: 'row', borderBottom: '1pt solid #ececec' },
    specsK: { width: '42%', color: '#666', fontSize: 8, padding: 3, borderRight: '1pt solid #ececec' },
    specsV: { flex: 1, fontWeight: 600, fontSize: 8, padding: 3 },
    quoteTable: { marginTop: 8, border: '1pt solid #ddd' },
    quoteHeadRow: { flexDirection: 'row', backgroundColor: '#111' },
    quoteHeadCell: { flex: 1, color: '#fff', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700, padding: 4 },
    quoteBodyRow: { flexDirection: 'row' },
    quoteGiven: { flex: 1, backgroundColor: '#f6f6f6', fontWeight: 700, fontSize: 9, padding: 6, borderRight: '1pt solid #ddd' },
    quoteBlank: { flex: 1, backgroundColor: '#fcfcf3', padding: 6, minHeight: 20, borderRight: '1pt solid #ddd' },
    footer: { position: 'absolute', bottom: 14, left: '14mm', right: '14mm', borderTop: '1pt dashed #ccc', paddingTop: 5, fontSize: 8, color: amarelo, fontWeight: 700 },
  });
}

function montarDocumento(doc) {
  const S = montarStyles();
  const L = doc.labels, idi = doc.idioma;
  const both = idi === 'bilingue';
  const forn = doc.fornecedor || {};

  const campo = (label, pt, en, key) => h(View, { style: S.campo, key }, [
    h(Text, { style: S.campoLbl, key: 'l' }, lbl(label, idi)),
    h(View, { style: S.campoVals, key: 'v' }, [
      idi !== 'en' ? h(Text, { style: S.campoVal, key: 'pt' }, pt || '—') : null,
      idi !== 'pt' ? h(Text, { style: S.campoValEn, key: 'en' }, en || pt || '—') : null,
    ]),
  ]);

  const itens = (doc.itens || []).map((it, i) => {
    const specsRows = (it.atributos || []).map((a, j) => {
      const ae = (it.atributos_en || [])[j] || {};
      return h(View, { style: S.specsRow, key: j }, [
        h(Text, { style: S.specsK, key: 'k' }, a.nome + (both && ae.nome_en ? ' / ' + ae.nome_en : '')),
        h(Text, { style: S.specsV, key: 'v' }, a.valor + (both && ae.valor_en ? ' / ' + ae.valor_en : '')),
      ]);
    });
    return h(View, { style: S.item, key: i, wrap: false }, [
      h(Text, { style: S.itemN, key: 'n' }, String(i + 1)),
      h(View, { style: S.itemFoto, key: 'foto' },
        it.foto
          ? h(Image, { src: it.foto, style: S.itemFotoImg })
          : h(Text, { style: S.semFoto }, lbl(L.semFoto, idi))
      ),
      h(View, { style: S.itemBody, key: 'body' }, [
        h(Text, { style: S.sku, key: 'sku' }, lbl(L.sku, idi) + ': ' + (it.codigo_interno || it.codigo || '—')),
        campo(L.produto, it.denominacao, it.denominacao_en, 'produto'),
        (it.detalhamento || it.detalhamento_en) ? campo(L.descricao, it.detalhamento, it.detalhamento_en, 'desc') : null,
        (it.atributos || []).length > 0 ? h(View, { style: S.campo, key: 'specs' }, [
          h(Text, { style: S.campoLbl, key: 'l' }, lbl(L.especif, idi)),
          h(View, { style: S.specsTable, key: 't' }, specsRows),
        ]) : null,
        h(View, { style: S.quoteTable, key: 'quote' }, [
          h(View, { style: S.quoteHeadRow, key: 'h' }, [
            h(Text, { style: S.quoteHeadCell, key: 'q' }, lbl(L.qtd, idi)),
            h(Text, { style: S.quoteHeadCell, key: 'u' }, lbl(L.unidade, idi)),
            h(Text, { style: S.quoteHeadCell, key: 'p' }, lbl(L.precoUnit, idi)),
            h(Text, { style: S.quoteHeadCell, key: 'm' }, lbl(L.moq, idi)),
            h(Text, { style: S.quoteHeadCell, key: 'lt' }, lbl(L.leadTime, idi)),
          ]),
          h(View, { style: S.quoteBodyRow, key: 'b' }, [
            h(Text, { style: S.quoteGiven, key: 'q' }, String(it.qty)),
            h(Text, { style: S.quoteGiven, key: 'u' }, it.unidade),
            h(View, { style: S.quoteBlank, key: 'p' }),
            h(View, { style: S.quoteBlank, key: 'm' }),
            h(View, { style: S.quoteBlank, key: 'lt' }),
          ]),
        ]),
      ]),
    ]);
  });

  return h0(Document, {},
    h(Page, { size: 'A4', style: S.page }, [
      h(View, { style: S.head, key: 'head' }, [
        h(View, { key: 'l' }, [
          h(Text, { style: S.titulo, key: 't' }, lbl(L.titulo, idi)),
          h(Text, { style: S.numDoc, key: 'n' }, lbl(L.numero, idi) + ' ' + doc.numero + ' · ' + doc.data.pt + (both ? ' / ' + doc.data.en : '')),
        ]),
        h(Text, { style: S.logo, key: 'logo' }, ['VERTICAL', h(Text, { style: S.logoP, key: 'p' }, 'PARTS')]),
      ]),
      h(View, { style: S.parties, key: 'parties' }, [
        h(View, { style: S.party, key: 'c' }, [
          h(Text, { style: S.partyLbl, key: 'l' }, lbl(L.comprador, idi)),
          h(Text, { style: S.partyNome, key: 'n' }, doc.comprador.razao_social),
          h(Text, { style: S.partyLinha, key: 'cnpj' }, 'CNPJ ' + doc.comprador.cnpj),
          h(Text, { style: S.partyLinha, key: 'end' }, doc.comprador.endereco),
          h(Text, { style: S.partyLinha, key: 'email' }, doc.comprador.email),
        ]),
        h(View, { style: S.party, key: 'f' }, [
          h(Text, { style: S.partyLbl, key: 'l' }, lbl(L.fornecedor, idi) + ' · ' + lbl(forn.tipo === 'nacional' ? L.nacional : L.importacao, idi)),
          h(Text, { style: S.partyNome, key: 'n' }, forn.nome || '—'),
          forn.pais ? h(Text, { style: S.partyLinha, key: 'pais' }, forn.pais) : null,
          forn.tin ? h(Text, { style: S.partyLinha, key: 'tin' }, 'TIN ' + forn.tin) : null,
          forn.email ? h(Text, { style: S.partyLinha, key: 'email' }, forn.email) : null,
        ]),
      ]),
      (doc.intro.pt || doc.intro.en) ? h(View, { style: S.intro, key: 'intro' }, [
        h(Text, { style: S.secLbl, key: 'l' }, lbl(L.intro, idi)),
        idi !== 'en' ? h(Text, { style: S.introTxt, key: 'pt' }, doc.intro.pt) : null,
        idi !== 'pt' ? h(Text, { style: S.introTxtEn, key: 'en' }, doc.intro.en || doc.intro.pt) : null,
      ]) : null,
      h(View, { key: 'itens' }, itens),
      (doc.observacoes.pt || doc.observacoes.en) ? h(View, { style: S.intro, key: 'obs' }, [
        h(Text, { style: S.secLbl, key: 'l' }, lbl(L.observacoes, idi)),
        idi !== 'en' ? h(Text, { style: S.introTxt, key: 'pt' }, doc.observacoes.pt) : null,
        idi !== 'pt' ? h(Text, { style: S.introTxtEn, key: 'en' }, doc.observacoes.en || doc.observacoes.pt) : null,
      ]) : null,
      h(Text, { style: S.footer, fixed: true, key: 'foot' }, '★ ' + lbl(L.aPreencher, idi)),
    ])
  );
}

async function baixar(doc, filename) {
  registrarFontes();
  const elemento = montarDocumento(doc);
  const blob = await pdf(elemento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

window.PFReactPdf = { baixar, montarDocumento };
