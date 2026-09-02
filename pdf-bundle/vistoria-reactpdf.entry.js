/* ============================================================
   vistoria-reactpdf.entry.js — fonte do bundle Vite pro relatório de
   Vistoria Técnica de Elevador (Fase C do motor de Vistorias — plano
   confirmado na sessão: "PDF com a cara VerticalParts, no mesmo
   padrão de Proposta/Contrato").

   Mesmo padrão do proposta-reactpdf.entry.js: react/react-pdf
   externos, React.createElement puro, filtra null dos arrays de
   filhos antes de repassar pro createElement real, fotos sempre
   convertidas pra PNG via canvas antes de entregar ao react-pdf (o
   Storage do Supabase pode devolver formatos que o react-pdf
   descarta em silêncio).

   Diferença de layout: Proposta usa 1 <Page> fixa por seção (doc de
   venda, cada página desenhada). Vistoria é um relatório de
   comprimento variável (nº de perguntas muda com nº de paradas) —
   usa 1 único <Page> com paginação automática do react-pdf (`wrap`,
   comportamento padrão), só o rodapé é `fixed`.
   ============================================================ */
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';

const h0 = React.createElement;
function h(type, props, children) {
  return h0(type, props,
    Array.isArray(children) ? children.filter(c => c !== null && c !== false && c !== undefined) : children);
}

/* ---------- Fontes (mesmas do proposta-reactpdf) ---------- */
let _fontesRegistradas = false;
function registrarFontes() {
  if (_fontesRegistradas) return;
  const inter = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-';
  const barlow = 'https://cdn.jsdelivr.net/npm/@fontsource/barlow-condensed@5.0.13/files/barlow-condensed-latin-';
  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter + '400-normal.woff', fontWeight: 400 },
      { src: inter + '600-normal.woff', fontWeight: 600 },
      { src: inter + '700-normal.woff', fontWeight: 700 },
      { src: inter + '800-normal.woff', fontWeight: 800 },
    ],
  });
  Font.register({
    family: 'Barlow Condensed',
    fonts: [{ src: barlow + '800-normal.woff', fontWeight: 800 }],
  });
  _fontesRegistradas = true;
}

const NAVY = '#1b2a4a';
const YELLOW = '#F5C400';
const GRAY_100 = '#F2F2F2';
const TXT = '#333333';
const DANGER = '#b91c1c';
const DANGER_BG = '#fef2f2';

const pt = (px) => Math.round(px * 0.75 * 100) / 100;

function montarStyles() {
  return StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: pt(15.5), color: TXT, paddingTop: pt(63), paddingBottom: pt(95), paddingLeft: pt(58), paddingRight: pt(58) },

    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: pt(13), marginBottom: pt(21), borderBottom: '1pt solid #ddd' },
    headerLogo: { width: pt(30 * 4.809), height: pt(30), objectFit: 'contain' },
    headerTag: { fontSize: pt(11), fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#777', marginTop: pt(6) },
    headerNumLbl: { fontSize: pt(11), fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#777', textAlign: 'right' },
    headerNumVal: { fontSize: pt(19), fontWeight: 800, color: NAVY, marginTop: pt(4), textAlign: 'right' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    footerInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: pt(58), paddingTop: pt(17), paddingBottom: pt(13) },
    footerCol: { fontSize: pt(12.5), color: '#444', lineHeight: 1.5, flex: 1 },
    footerBar: { height: pt(13), flexDirection: 'row' },
    footerBarBlack: { width: '15%', backgroundColor: '#1a1a1a' },
    footerBarYellow: { flex: 1, backgroundColor: YELLOW },

    infoBox: { backgroundColor: GRAY_100, padding: `${pt(15)}pt ${pt(19)}pt`, marginBottom: pt(21) },
    infoRow: { flexDirection: 'row', flexWrap: 'wrap' },
    infoItem: { width: '50%', marginBottom: pt(6) },
    infoLbl: { fontSize: pt(10.5), fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: '#777' },
    infoVal: { fontSize: pt(14), color: TXT, marginTop: 1 },

    catTitle: { fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: pt(20), textTransform: 'uppercase', color: NAVY, marginTop: pt(17), marginBottom: pt(6), paddingBottom: pt(4), borderBottom: `1pt solid ${NAVY}` },
    pavLabel: { fontSize: pt(11), fontWeight: 700, textTransform: 'uppercase', color: '#999', marginTop: pt(8), marginBottom: pt(4) },

    pergunta: { marginBottom: pt(10), paddingBottom: pt(8), borderBottom: '0.5pt solid #eee' },
    perguntaTxt: { fontSize: pt(13), color: '#555', marginBottom: pt(3) },
    perguntaVal: { fontSize: pt(14.5), fontWeight: 600, color: TXT },
    perguntaValVazio: { fontSize: pt(14.5), color: '#bbb' },

    pendTag: { fontSize: pt(10), fontWeight: 800, color: DANGER, backgroundColor: DANGER_BG, paddingHorizontal: pt(6), paddingVertical: pt(2), marginTop: pt(4), alignSelf: 'flex-start', textTransform: 'uppercase' },

    fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: pt(8), marginTop: pt(4) },
    fotoBox: { width: pt(140) },
    fotoImg: { width: pt(140), height: pt(105), objectFit: 'cover', borderRadius: 3, border: '1pt solid #eee' },
    fotoLegenda: { fontSize: pt(10), color: '#888', marginTop: pt(2) },

    assinaturaImg: { width: pt(180), height: pt(70), objectFit: 'contain', border: '1pt solid #eee' },
  });
}

/* ---------- Carregamento de imagem — sempre normaliza pra PNG via
   canvas antes de entregar ao react-pdf (mesmo motivo documentado em
   proposta-reactpdf.entry.js: formato inesperado é descartado em
   silêncio pela lib). Aqui a URL já vem absoluta (Supabase Storage). */
const _imgCache = new Map();
async function carregarImagem(url) {
  if (_imgCache.has(url)) return _imgCache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url} → HTTP ${resp.status}`);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const dataUri = canvas.toDataURL('image/png');
  _imgCache.set(url, dataUri);
  return dataUri;
}

const IMG = { logo: null };

function chave(perguntaId, pav) { return perguntaId + ':' + (pav || 0); }

function PdfHeader(S, atividade) {
  return h(View, { style: S.pageHeader }, [
    h(View, { key: 'l' }, [
      IMG.logo ? h(Image, { key: 'logo', src: IMG.logo, style: S.headerLogo }) : null,
      h(Text, { style: S.headerTag, key: 't' }, 'Elevando você e o seu negócio'),
    ]),
    h(View, { key: 'r' }, [
      h(Text, { style: S.headerNumLbl, key: 'l' }, 'Vistoria'),
      h(Text, { style: S.headerNumVal, key: 'v' }, atividade.numeroLabel || '—'),
    ]),
  ]);
}

function PdfFooter(S) {
  return h(View, { style: S.footer, fixed: true }, [
    h(View, { style: S.footerInfo, key: 'i' }, [
      h(Text, { style: S.footerCol, key: '1' }, 'Rua Armandina Braga de Almeida, 383\nJardim Santa Emília\nGuarulhos/SP - CEP 07141-003'),
      h(Text, { style: S.footerCol, key: '2' }, '+55 (11) 2528-6473\n+55 (11) 2528-6479\n+55 (11) 94460-6396'),
      h(Text, { style: S.footerCol, key: '3' }, 'comercial@verticalparts.com.br'),
    ]),
    h(View, { style: S.footerBar, key: 'b' }, [
      h(View, { style: S.footerBarBlack, key: 'a' }),
      h(View, { style: S.footerBarYellow, key: 'b' }),
    ]),
  ]);
}

function InfoBox(S, atividade) {
  const itens = [
    ['Obra', atividade.obraNome], ['Cliente', atividade.clienteNome], ['Equipamento', atividade.equipamentoSerie],
    ['Técnico', atividade.tecnicoNome], ['Check-in', atividade.checkinTxt], ['Concluída em', atividade.concluidoTxt],
  ].filter(([, v]) => v);
  return h(View, { style: S.infoBox }, [
    h(View, { style: S.infoRow }, itens.map(([lbl, val], i) => h(View, { style: S.infoItem, key: i }, [
      h(Text, { style: S.infoLbl, key: 'l' }, lbl),
      h(Text, { style: S.infoVal, key: 'v' }, val),
    ]))),
  ]);
}

function RenderPergunta(S, pergunta, resposta, imgs) {
  const pend = resposta?.pendencia;
  let valorNode;
  if (pergunta.tipo_campo === 'foto') {
    const anexos = resposta?.anexos || [];
    valorNode = anexos.length
      ? h(View, { style: S.fotosRow }, anexos.map((a, i) => h(View, { style: S.fotoBox, key: i }, [
          imgs[a.url] ? h(Image, { key: 'img', src: imgs[a.url], style: S.fotoImg }) : null,
          a.legenda ? h(Text, { style: S.fotoLegenda, key: 'l' }, a.legenda) : null,
        ])))
      : h(Text, { style: S.perguntaValVazio }, '— sem resposta —');
  } else if (pergunta.tipo_campo === 'assinatura') {
    valorNode = (resposta?.anexo_url && imgs[resposta.anexo_url])
      ? h(Image, { src: imgs[resposta.anexo_url], style: S.assinaturaImg })
      : h(Text, { style: S.perguntaValVazio }, '— sem assinatura —');
  } else if (pergunta.tipo_campo === 'multipla_escolha') {
    valorNode = (resposta?.valor_lista || []).length
      ? h(Text, { style: S.perguntaVal }, resposta.valor_lista.join(', '))
      : h(Text, { style: S.perguntaValVazio }, '— sem resposta —');
  } else if (pergunta.tipo_campo === 'informativa') {
    return null;
  } else {
    valorNode = resposta?.valor
      ? h(Text, { style: S.perguntaVal }, resposta.valor)
      : h(Text, { style: S.perguntaValVazio }, '— sem resposta —');
  }
  return h(View, { style: S.pergunta }, [
    h(Text, { style: S.perguntaTxt, key: 't' }, pergunta.texto),
    valorNode,
    pend ? h(Text, { style: S.pendTag, key: 'p' }, 'Pendência') : null,
  ]);
}

async function montarDocumento({ atividade, estrutura, respostas }) {
  const S = montarStyles();
  montarDocumento.ultimasFalhas = [];

  await carregarImagem(new URL('assets/logo-verticalparts-color.png', window.location.origin + '/').href)
    .then((u) => { IMG.logo = u; })
    .catch((e) => { IMG.logo = null; montarDocumento.ultimasFalhas.push(e.message); });

  /* Junta toda URL de foto/assinatura da vistoria inteira e carrega em
     paralelo — evita N sequências de fetch por pergunta. */
  const urls = new Set();
  Object.values(respostas || {}).forEach((r) => {
    (r.anexos || []).forEach((a) => a.url && urls.add(a.url));
    if (r.anexo_url) urls.add(r.anexo_url);
  });
  const imgs = {};
  await Promise.all(Array.from(urls).map(async (url) => {
    try { imgs[url] = await carregarImagem(url); }
    catch (e) { montarDocumento.ultimasFalhas.push(`imagem: ${e.message}`); }
  }));

  const Store = window.VistoriasQuestionariosStore;
  const corpo = estrutura.flatMap((categoria) => {
    const pavs = Store.pavsDaCategoria(categoria, atividade.paradas);
    return [
      h(Text, { style: S.catTitle, key: categoria.id }, categoria.nome),
      ...pavs.flatMap((pav) => [
        categoria.repete_por_pavimento ? h(Text, { style: S.pavLabel, key: `${categoria.id}-pav-${pav}` }, `Pavimento ${pav}`) : null,
        ...categoria.perguntas.map((p) => RenderPergunta(S, p, respostas[chave(p.id, pav)], imgs)).map((node, i) =>
          node ? h(React.Fragment, { key: `${categoria.id}-${pav}-${i}` }, node) : null),
      ]),
    ];
  });

  const pagina = h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, atividade),
    InfoBox(S, atividade),
    ...corpo,
    PdfFooter(S),
  ]);

  return h0(Document, {}, [pagina]);
}

async function baixar(data, filename) {
  registrarFontes();
  const elemento = await montarDocumento(data);
  const blob = await pdf(elemento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { falhasDeImagem: montarDocumento.ultimasFalhas || [] };
}

window.VistoriaReactPdf = { baixar, montarDocumento };
