/* ============================================================
   proposta-reactpdf.entry.js — fonte do bundle Vite pra Proposta
   (Fase 2 da migração pra @react-pdf/renderer, Caminho B — plano
   aprovado 20/08, seguindo o mesmo padrão do RFQ: react/react-pdf
   externos, React.createElement puro, filtra null dos arrays de
   filhos antes de repassar pro createElement real).

   Escopo: só ELEVADOR (fluxo de referência, 18 páginas — Capa, Sobre
   ×2, Cliente/Obra, Saudação, Marketing, Especificações, Acabamento,
   Características, Recursos, Infraestrutura, Fotos (condicional),
   Valores, Condições Pagto, Ajustes/Impostos, Prazo, Responsabilidades,
   Garantia+Assinatura). Escada/Esteira usam o fluxo antigo mais
   simples (proposta-preview.jsx) e ficam de fora desta fase — mesma
   decisão de escopo já tomada nesta sessão pro "envio direto".

   Espelha a lógica de dados de src/proposta-preview.jsx linha a linha
   (mesmos campos, mesmos cálculos) — só troca a saída HTML/CSS por
   primitivas @react-pdf/renderer.
   ============================================================ */
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';

const h0 = React.createElement;
/* @react-pdf/renderer não ignora `null` num array de filhos como o
   React DOM faz — sobrevivendo, quebra com "Cannot read properties of
   null (reading 'props')" (achado 20/08, na Fase 1/RFQ). h() aqui
   sempre filtra antes de repassar pro createElement real. */
function h(type, props, children) {
  return h0(type, props,
    Array.isArray(children) ? children.filter(c => c !== null && c !== false && c !== undefined) : children);
}

/* ---------- Fontes ---------- */
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

/* ---------- Paleta (colors_and_type.css) ---------- */
const NAVY = '#1b2a4a';
const YELLOW = '#F5C400';
const YELLOW_PRESS = '#C99E00';
const GRAY_100 = '#F2F2F2';
const GRAY_400 = '#A0A0A0';
const GRAY_500 = '#808080';
const TXT = '#333333';
const CAPA_TXT = '#29261b';

/* px (design a 96dpi) → pt (PDF, 72dpi) */
const pt = (px) => Math.round(px * 0.75 * 100) / 100;

function montarStyles() {
  return StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: pt(15.5), color: TXT, paddingTop: pt(63), paddingBottom: pt(95), paddingLeft: pt(58), paddingRight: pt(58) },
    pageNoPad: { fontFamily: 'Inter', padding: 0 },

    // Capa
    /* objectFit:'cover' equivale ao `background-size: cover` do CSS
       original. SEM ele o <Image> do react-pdf ESTICA a foto pra
       preencher exatamente width×height — e aqui isso era brutal: as
       fotos de capa são RETRATO (545×767, proporção 0.71) e a caixa é
       PAISAGEM (595×334, proporção 1.78), ou seja 2.5x de deformação
       na capa e 5x na página "Sobre" (achado 20/08, medindo as
       dimensões nativas dos PNGs contra as caixas de destino).
       objectPositionY:'0%' replica o `background-position: top center`
       do CSS — sem isso o corte pegaria a faixa central da foto em vez
       do topo, que é o enquadramento escolhido no design original. */
    capaImg: { width: '100%', height: '118mm', objectFit: 'cover', objectPositionY: '0%' },
    sobreImg: { width: '100%', height: pt(190), marginBottom: pt(25), objectFit: 'cover' },
    capaBody: { padding: `${pt(34)}pt ${pt(58)}pt ${pt(34)}pt` },
    capaTitle: { fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: pt(66), lineHeight: 0.95, textTransform: 'uppercase', color: CAPA_TXT, marginBottom: pt(28) },
    capaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: pt(4) },
    capaGridItem: { width: '50%', marginBottom: pt(13), paddingRight: pt(19) },
    capaGridDt: { fontSize: pt(17), fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: CAPA_TXT, marginBottom: 2 },
    capaGridDd: { fontSize: pt(17), color: YELLOW_PRESS, fontWeight: 600 },
    capaFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: pt(17) },
    capaFootTxt: { fontSize: pt(15), color: CAPA_TXT, fontWeight: 600 },

    // header/footer internas
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: pt(13), marginBottom: pt(25), borderBottom: '1pt solid #ddd' },
    /* Logo: SEMPRE width+height explícitos na proporção nativa
       (1866x388 = 4.809) + objectFit contain. Dar só `height` dentro de
       um flex row deixou o flex esticar a largura e o logo saiu 44%
       mais largo do que devia nas páginas "Sobre" (proporção desenhada
       6.949 contra 4.809 real — achado 20/08 lendo a matriz de
       transformação direto do content stream do PDF gerado). */
    headerLogo: { width: pt(30 * 4.809), height: pt(30), objectFit: 'contain' },
    logoInline: { width: pt(26 * 4.809), height: pt(26), marginRight: pt(13), objectFit: 'contain' },
    headerTag: { fontSize: pt(11), fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#777', marginTop: pt(6) },
    headerNumLbl: { fontSize: pt(11), fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#777', textAlign: 'right' },
    headerNumVal: { fontSize: pt(19), fontWeight: 800, color: NAVY, marginTop: pt(4), textAlign: 'right' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    footerInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: pt(58), paddingTop: pt(17), paddingBottom: pt(13) },
    footerCol: { fontSize: pt(12.5), color: '#444', lineHeight: 1.5, flex: 1 },
    footerBar: { height: pt(13), flexDirection: 'row' },
    footerBarBlack: { width: '15%', backgroundColor: '#1a1a1a' },
    footerBarYellow: { flex: 1, backgroundColor: YELLOW },

    secTitle: { fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: pt(26), textTransform: 'uppercase', color: NAVY, marginBottom: pt(8) },
    secRule: { width: '100%', height: 1, backgroundColor: '#ddd', marginBottom: pt(25) },
    subTitle: { fontSize: pt(16), fontWeight: 800, textTransform: 'uppercase', color: NAVY, marginTop: pt(25), marginBottom: pt(8) },
    p: { fontSize: pt(15), lineHeight: 1.5, marginBottom: pt(8) },

    box: { backgroundColor: '#f5f6f8', borderLeft: `3pt solid ${NAVY}`, padding: `${pt(21)}pt ${pt(25)}pt`, marginVertical: pt(13) },
    boxP: { fontSize: pt(15), lineHeight: 1.6, color: TXT, marginBottom: pt(6) },

    list: { marginBottom: pt(8) },
    listItemRow: { flexDirection: 'row', marginBottom: pt(6) },
    listBullet: { fontSize: pt(15), width: pt(14), color: TXT },
    listItemTxt: { fontSize: pt(15), lineHeight: 1.6, color: TXT, flex: 1 },

    namedItem: { marginBottom: pt(17) },
    namedItemLbl: { fontSize: pt(15), textTransform: 'uppercase', color: NAVY, fontWeight: 700, marginBottom: pt(4) },
    namedItemTxt: { fontSize: pt(15), lineHeight: 1.6, color: TXT },

    table: { marginTop: pt(8), border: '1pt solid #eee' },
    tHeadRow: { flexDirection: 'row', backgroundColor: GRAY_100 },
    tHeadCell: { padding: `${pt(10)}pt ${pt(15)}pt`, fontSize: pt(13), fontWeight: 800, textTransform: 'uppercase', color: TXT, borderBottom: '1pt solid #ddd' },
    tRow: { flexDirection: 'row', borderBottom: '1pt solid #eee' },
    tRowAlt: { flexDirection: 'row', borderBottom: '1pt solid #eee', backgroundColor: '#fafafa' },
    tCell: { padding: `${pt(10)}pt ${pt(15)}pt`, fontSize: pt(15), color: TXT },
    tTotalRow: { flexDirection: 'row', borderTop: `2pt solid ${NAVY}` },
    tTotalCell: { padding: `${pt(10)}pt ${pt(15)}pt`, fontSize: pt(15), fontWeight: 800, color: NAVY },

    foto: { marginBottom: pt(34), alignItems: 'center' },
    fotoImg: { maxWidth: '100%', maxHeight: pt(340), objectFit: 'contain' },

    assinaturas: { flexDirection: 'row', marginTop: pt(84) },
    assinatura: { flex: 1, marginRight: pt(50) },
    assinaturaLinha: { borderTop: '1pt solid #999', marginBottom: pt(8) },
    assinaturaB: { fontSize: pt(14), color: NAVY, fontWeight: 700 },
    assinaturaSpan: { fontSize: pt(13), color: '#777' },

    /* SEM fontStyle:'italic' — @fontsource/inter NÃO publica arquivo
       itálico, e react-pdf só sabe usar variante que foi registrada em
       Font.register: pedir itálico derruba a geração inteira com
       "Could not resolve font for Inter, fontWeight 400, fontStyle
       italic". Mesmíssimo erro já cometido e documentado na Fase 1
       (RFQ) e repetido aqui por descuido — se algum dia precisar de
       itálico de verdade, registre o arquivo antes de usar. */
    vazio: { fontSize: pt(15), color: '#777', marginBottom: pt(8) },
  });
}

/* ---------- Carregamento de imagem ----------
   O react-pdf recebia o caminho RELATIVO ('assets/capa-elevador.png') e
   resolvia de um jeito diferente do navegador: em produção não achou
   nenhuma imagem e gerou o PDF inteiro SEM elas, sem erro nenhum —
   17 páginas certas, 0 imagens, 83KB em vez de 1.4MB (achado 20/08, a
   partir do PDF VP-2026-580 enviado pelo usuário; os arquivos estavam
   no ar, HTTP 200, o problema era só a resolução do caminho).

   Aqui o carregamento passa a ser explícito: busca o arquivo com URL
   ABSOLUTA (window.location.origin) e converte pra data URI antes de
   entregar ao react-pdf. Assim não depende de como a lib resolve
   caminho, e — mais importante — a falha deixa de ser silenciosa:
   quem chamar sabe quais imagens não vieram. */
/* Imagens já resolvidas em data URI, preenchidas por montarDocumento()
   antes de qualquer página ser montada. As funções de página leem daqui
   em vez de receber mais um parâmetro em 13 assinaturas. */
const IMG = { logo: null, capa: null };

const _imgCache = new Map();
async function carregarImagem(caminho) {
  if (_imgCache.has(caminho)) return _imgCache.get(caminho);
  const url = new URL(caminho, window.location.origin + '/').href;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${caminho} → HTTP ${resp.status}`);
  const blob = await resp.blob();

  /* ⚠️ NUNCA entregue o blob cru do servidor pro react-pdf.
     A Hostinger converte as imagens pra WEBP automaticamente quando
     quem pede é um navegador (Accept: image/webp) — os .png do /assets
     chegam como image/webp em produção. E o @react-pdf/renderer só
     entende PNG e JPEG: ao receber webp ele DESCARTA a imagem sem
     erro nenhum, gerando o documento inteiro sem logo e sem capa
     (achado 21/08, medindo o content-type real dentro do navegador
     logado em produção).
     Por que isso enganou os testes anteriores: `curl` não manda
     Accept: image/webp, então via o PNG original e dava "200
     image/png"; e o servidor local de dev (Express) não converte
     nada, então localmente sempre funcionou.
     Aqui o blob é redesenhado num canvas e re-serializado em PNG —
     assim, seja qual for o formato que o servidor resolva mandar
     (webp, avif, o que for), o react-pdf sempre recebe PNG. */
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const dataUri = canvas.toDataURL('image/png');
  if (!dataUri.startsWith('data:image/png')) {
    throw new Error(`${caminho} → não virou PNG (veio ${blob.type})`);
  }

  _imgCache.set(caminho, dataUri);
  return dataUri;
}

/* ---------- helpers de dado (idênticos a proposta-preview.jsx) ---------- */
function fmtDoc(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '';
}
function nomeSemDoc(nome, doc) {
  if (!nome || !doc) return nome || '';
  return String(nome).replace(/[,;–-]?\s*(CNPJ|CPF)\s*:?\s*[\d./-]+\s*$/i, '').trim().replace(/[,;–-]\s*$/, '');
}
function fmtBRL(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numBR(s) { return parseFloat((s || '0').toString().replace(/\./g, '').replace(',', '.')) || 0; }

/* ---------- Peças compartilhadas ---------- */
function PdfHeader(S, numero) {
  return h(View, { style: S.pageHeader }, [
    h(View, { key: 'l' }, [
      IMG.logo ? h(Image, { key: 'logo', src: IMG.logo, style: S.headerLogo }) : null,
      h(Text, { style: S.headerTag, key: 't' }, 'Elevando você e o seu negócio'),
    ]),
    h(View, { key: 'r' }, [
      h(Text, { style: S.headerNumLbl, key: 'l' }, 'Número da Proposta'),
      h(Text, { style: S.headerNumVal, key: 'v' }, numero || '—'),
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
function Vazio(S, texto) { return h(Text, { style: S.vazio }, texto || 'A definir.'); }
function Lista(S, itens, key) {
  return h(View, { style: S.list, key }, itens.map((it, i) => h(View, { style: S.listItemRow, key: i }, [
    h(Text, { style: S.listBullet, key: 'b' }, '•'),
    h(Text, { style: S.listItemTxt, key: 't' }, it),
  ])));
}
function Tabela2(S, cols, linhas, key) {
  return h(View, { style: S.table, key }, [
    h(View, { style: S.tHeadRow, key: 'h' }, cols.map((c, i) => h(Text, { style: [S.tHeadCell, { flex: c.flex || 1, textAlign: c.align || 'left' }], key: i }, c.label))),
    ...linhas.map((row, ri) => h(View, { style: ri % 2 ? S.tRowAlt : S.tRow, key: ri }, row.map((v, ci) => h(Text, { style: [S.tCell, { flex: cols[ci]?.flex || 1, textAlign: cols[ci]?.align || 'left' }], key: ci }, String(v ?? '—'))))),
  ]);
}

/* ============================================================
   Páginas — Elevador
   ============================================================ */
function PgCapa(S, data, eq) {
  const v = data.vendedor || {};
  return h(Page, { size: 'A4', style: S.pageNoPad }, [
    IMG.capa ? h(Image, { key: 'img', src: IMG.capa, style: S.capaImg }) : null,
    h(View, { style: S.capaBody, key: 'body' }, [
      h(Text, { style: S.capaTitle, key: 't' }, 'Proposta\nComercial'),
      h(View, { style: S.capaGrid, key: 'grid' }, [
        h(View, { style: S.capaGridItem, key: 'a' }, [h(Text, { style: S.capaGridDt, key: 'l' }, 'Nº da Proposta'), h(Text, { style: S.capaGridDd, key: 'v' }, data.numero || 'VP-2026-XXX')]),
        h(View, { style: S.capaGridItem, key: 'b' }, [h(Text, { style: S.capaGridDt, key: 'l' }, 'Vendedor'), h(Text, { style: S.capaGridDd, key: 'v' }, v.nome || 'Equipe Comercial')]),
        h(View, { style: S.capaGridItem, key: 'c' }, [h(Text, { style: S.capaGridDt, key: 'l' }, 'Contato'), h(Text, { style: S.capaGridDd, key: 'v' }, v.email || 'comercial@verticalparts.com.br')]),
        h(View, { style: S.capaGridItem, key: 'd' }),
      ]),
      h(View, { style: S.capaFoot, key: 'foot' }, [
        h(Text, { style: S.capaFootTxt, key: '1' }, v.celular || v.fixo || '(11) 2528-6473'),
        h(Text, { style: S.capaFootTxt, key: '2' }, 'Rua Armandina Braga de Almeida, 383'),
      ]),
    ]),
  ]);
}

function PgSobre(S, eq) {
  return h(Page, { size: 'A4', style: S.page }, [
    h(Text, { style: [S.capaTitle, { fontSize: pt(27), color: NAVY, marginBottom: pt(25) }], key: 't' }, 'Elevando\nVocê e o Seu Negócio'),
    IMG.capa ? h(Image, { key: 'img', src: IMG.capa, style: S.sobreImg }) : null,
    h(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: pt(17) }, key: 'l' }, [
      IMG.logo ? h(Image, { key: 'logo', src: IMG.logo, style: S.logoInline }) : null,
      h(Text, { style: { fontSize: pt(16), fontWeight: 800, textTransform: 'uppercase', color: NAVY }, key: 't' }, 'Sobre a VerticalParts'),
    ]),
    h(Text, { style: S.p, key: 'p1' }, 'Desde 2012 no mercado de mobilidade vertical, a VerticalParts se destaca como líder fornecedora de soluções personalizadas e competitivas para o transporte de passageiros. Nosso compromisso é oferecer produtos de alta qualidade e serviços excepcionais para atender às necessidades específicas de cada cliente.'),
    h(Text, { style: S.p, key: 'p2' }, 'Especializados na venda de equipamentos como escadas, esteiras rolantes, elevadores e peças de reposição, nos orgulhamos de oferecer uma ampla variedade de opções para aprimorar a mobilidade em diversos setores. Nosso objetivo é proporcionar soluções eficientes e seguras que atendam às demandas de espaços comerciais, residenciais e públicos.'),
    PdfFooter(S),
  ]);
}

function PgSobreCont(S) {
  return h(Page, { size: 'A4', style: S.page }, [
    h(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: pt(17) }, key: 'l' }, [
      IMG.logo ? h(Image, { key: 'logo', src: IMG.logo, style: S.logoInline }) : null,
      h(Text, { style: { fontSize: pt(16), fontWeight: 800, textTransform: 'uppercase', color: NAVY }, key: 't' }, 'Sobre a VerticalParts'),
    ]),
    h(Text, { style: S.p, key: 'p1' }, 'Além disso, a VerticalParts se destaca pela sua dedicação em manter um amplo estoque de peças de reposição para escadas e esteiras rolantes. Isso nos permite suprir todas as suas necessidades de forma rápida e eficiente, garantindo a máxima disponibilidade e funcionamento contínuo dos seus equipamentos.'),
    h(Text, { style: S.p, key: 'p2' }, 'Nossa equipe altamente qualificada está pronta para oferecer suporte técnico especializado e auxiliar na seleção, instalação e manutenção dos produtos. Valorizamos a satisfação do cliente e buscamos estabelecer parcerias duradouras baseadas na confiança e na excelência dos nossos serviços.'),
    h(Text, { style: S.p, key: 'p3' }, 'Se você está em busca de soluções personalizadas e confiáveis em mobilidade vertical, conte com a VerticalParts.'),
    h(Text, { style: S.p, key: 'p4' }, [h(Text, { style: { fontWeight: 800 }, key: 'b' }, 'VerticalParts'), ' - Soluções em mobilidade vertical, além das suas expectativas.']),
    h(View, { style: { flexDirection: 'row', marginTop: pt(25) }, key: 'cards' },
      [['+3.000', 'Clientes'], ['+5.000', 'Peças a Pronta Entrega'], ['+300', 'Equipamentos Instalados']].map(([n, l], i) =>
        h(View, { style: { flex: 1, backgroundColor: YELLOW, padding: `${pt(13)}pt ${pt(15)}pt`, marginRight: i < 2 ? pt(13) : 0 }, key: i }, [
          h(Text, { style: { fontSize: pt(20), fontWeight: 800 }, key: 'n' }, n),
          h(Text, { style: { fontSize: pt(12), fontWeight: 700, textTransform: 'uppercase' }, key: 'l' }, l),
        ])
      )),
    PdfFooter(S),
  ]);
}

function PgClienteObra(S, data) {
  const c = data.cliente || {}, o = data.obra || {};
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    data.dataLinha ? h(Text, { style: [S.p, { marginBottom: pt(25) }], key: 'dl' }, data.dataLinha) : null,
    h(Text, { style: S.subTitle, key: 'h1' }, 'Dados do Cliente'),
    h(View, { style: S.box, key: 'b1' }, [
      h(Text, { style: [S.boxP, { fontWeight: 700 }], key: 'n' }, nomeSemDoc(c.nome, c.cnpj) || c.nome || '—'),
      c.cnpj ? h(Text, { style: S.boxP, key: 'cnpj' }, 'CNPJ: ' + fmtDoc(c.cnpj)) : null,
      c.responsavel ? h(Text, { style: S.boxP, key: 'ac' }, 'A/C: ' + c.responsavel) : null,
      h(Text, { style: S.boxP, key: 'end' }, [c.endereco, c.numero].filter(Boolean).join(', ') || '—'),
      h(Text, { style: S.boxP, key: 'cid' }, [c.bairro, c.cidade, c.uf].filter(Boolean).join(' - ') || '—'),
      c.cep ? h(Text, { style: S.boxP, key: 'cep' }, 'CEP: ' + c.cep) : null,
    ]),
    h(Text, { style: S.subTitle, key: 'h2' }, 'Dados da Obra'),
    h(View, { style: S.box, key: 'b2' }, [
      h(Text, { style: [S.boxP, { fontWeight: 700 }], key: 'n' }, o.nome || '—'),
      h(Text, { style: S.boxP, key: 'end' }, [o.endereco, o.numero].filter(Boolean).join(', ') || '—'),
      h(Text, { style: S.boxP, key: 'cid' }, [o.bairro, o.cidade, o.uf].filter(Boolean).join(' - ') || '—'),
      o.cep ? h(Text, { style: S.boxP, key: 'cep' }, 'CEP: ' + o.cep) : null,
    ]),
    PdfFooter(S),
  ]);
}

function PgSaudacao(S, data) {
  const ed = data.elevador || {};
  const s = (ed.especificacoes || [])[0] || {};
  const qtd = ed.valores?.quantidade || '1';
  const resumo = [s.id, s.modelo, s.carac, s.capacidade ? `Capacidade para ${s.capacidade}` : '', s.andaresParadasPortas].filter(Boolean).join(' - ');
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.p, key: 'p1' }, 'Prezados Senhores(as):'),
    h(Text, { style: S.p, key: 'p2' }, `Proposta Comercial para o fornecimento de ${qtd} Elevador(es) de Passageiros.`),
    h(View, { style: S.box, key: 'b' }, [
      resumo ? h(Text, { style: S.boxP, key: 'r' }, resumo) : Vazio(S, 'A definir.'),
      h(Text, { style: S.boxP, key: 'm' }, 'Marca: VerticalParts'),
    ]),
    PdfFooter(S),
  ]);
}

function PgMarketing(S, data) {
  const ed = data.elevador || {};
  const s = (ed.especificacoes || [])[0] || {};
  const titulo = ['Elevador de Passageiros', s.modelo].filter(Boolean).join(' ');
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, titulo),
    h(View, { style: S.secRule, key: 'r' }),
    ed.textoProposta ? h(Text, { style: S.p, key: 'p' }, ed.textoProposta) : Vazio(S),
    ed.textoModelos ? h(View, { key: 'modelos' }, [h(Text, { style: S.subTitle, key: 't' }, 'Linha de Modelos'), h(Text, { style: S.p, key: 'p' }, ed.textoModelos)]) : null,
    (ed.beneficios || []).length ? h(View, { key: 'benef' }, [h(Text, { style: S.subTitle, key: 't' }, 'Benefícios'), Lista(S, ed.beneficios, 'l')]) : null,
    (ed.diferenciais || []).length ? h(View, { key: 'dif' }, [h(Text, { style: S.subTitle, key: 't' }, 'Diferenciais em Relação ao Mercado'), Lista(S, ed.diferenciais, 'l')]) : null,
    PdfFooter(S),
  ]);
}

function PgEspecTabela(S, data) {
  const ed = data.elevador || {};
  const s = (ed.especificacoes || [])[0] || {};
  const linhas = [
    ['Tipo de Empreendimento', s.empreendimento], ['Característica de Transporte', s.carac], ['Denominação', s.denominacao],
    ['Percurso', s.percurso && `${s.percurso}mm`], ['Capacidade', s.capacidade], ['Caixa de Corrida', s.dimensoesCaixa],
    ['Poço', s.profPoço && `${s.profPoço}mm`], ['Velocidade', s.vel && `${s.vel} m/s`], ['Paradas', s.andaresParadasPortas],
    ['Modelo', s.modelo], ['Quantidade', s.qtd],
  ].filter(([, v]) => v);
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Especificações Técnicas'),
    h(View, { style: S.secRule, key: 'r' }),
    h(Text, { style: S.subTitle, key: 'st' }, 'Características Principais'),
    linhas.length ? Tabela2(S, [{ label: 'Característica', flex: 1 }, { label: s.id || 'Elevador de Passageiros', flex: 1 }], linhas, 't') : Vazio(S, 'Preencha as especificações técnicas na aba "Especificações Técnicas".'),
    PdfFooter(S),
  ]);
}

function PgAcabamento(S, data) {
  const a = (data.elevador || {}).acabamentos || {};
  const linhas = [
    ['Modelo da Cabine', a.modeloCabine], ['Acabamentos', a.acabamentoMat], ['Sub-teto', a.subTeto], ['Botoeira de Cabine', a.painelOperacao],
    ['Piso', a.pisoCabina], ['Medidas', a.medidasPiso], ['Porta de Cabine', a.modeloPorta], ['Medidas Porta de Cabine', a.dimPortaCabine],
    ['Modelo de Porta', a.acabPortaCabine], ['Portas de Pavimento', a.portasPavimento], ['Botoeiras de Pavimento', a.botoeirasPavimento],
    ['Sinalização', a.sinalizacao], ['Pavimentos Inox', a.pavInox], ['Demais', a.demais],
  ].filter(([, v]) => v);
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Acabamento'),
    h(View, { style: S.secRule, key: 'r' }),
    linhas.length ? Tabela2(S, [{ label: 'Item', flex: 1 }, { label: 'Elevador de Passageiros', flex: 1 }], linhas, 't') : Vazio(S, 'Preencha os acabamentos na aba "Acabamentos".'),
    PdfFooter(S),
  ]);
}

function PgCaracteristicas(S, data) {
  const c = (data.elevador || {}).caracteristicasEquip || {};
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Características Principais'),
    h(View, { style: S.secRule, key: 'r' }),
    h(Text, { style: S.subTitle, key: 's1' }, 'Alimentação Elétrica'),
    c.alimentacao ? h(Text, { style: S.p, key: 'p1' }, c.alimentacao) : Vazio(S),
    h(Text, { style: S.subTitle, key: 's2' }, 'Sistema de Comando de Controle'),
    c.comando ? h(Text, { style: S.p, key: 'p2' }, c.comando) : Vazio(S),
    h(Text, { style: S.subTitle, key: 's3' }, 'Máquina de Tração'),
    c.tracao ? h(Text, { style: S.p, key: 'p3' }, c.tracao) : Vazio(S),
    PdfFooter(S),
  ]);
}

function PgItensNomeados(S, data, titulo, campo, vazioTxt) {
  const itens = (data.elevador || {})[campo] || [];
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, titulo),
    h(View, { style: S.secRule, key: 'r' }),
    itens.length ? itens.map((it, i) => h(View, { style: S.namedItem, key: i }, [
      h(Text, { style: S.namedItemLbl, key: 'n' }, it.nome),
      h(Text, { style: S.namedItemTxt, key: 'd' }, it.desc),
    ])) : Vazio(S, vazioTxt),
    PdfFooter(S),
  ]);
}

function PgFotos(S, data, urls) {
  const itens = [['Unidade', urls.unidade], ['Teto da Cabine', urls.teto], ['Botoeira', urls.botoeira]].filter(([, u]) => u);
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    ...itens.map(([label, url], i) => h(View, { style: S.foto, key: i }, h(Image, { src: url, style: S.fotoImg }))),
    PdfFooter(S),
  ]);
}

function PgValores(S, data) {
  const v = (data.elevador || {}).valores || {};
  const parcelas = v.parcelas || [];
  const qtd = parseFloat(v.quantidade) || 0;
  const unit = numBR(v.valorUnit);
  const difal = numBR(v.difal);
  const totalEq = qtd * unit;
  const totalGeral = totalEq + difal;
  const totalParcelas = parcelas.reduce((s, p) => s + numBR(p.valor), 0);
  const linhasEq = [[v.equipamento || 'Elevador de Passageiros', qtd || '—', unit ? fmtBRL(unit) : '—', totalEq ? fmtBRL(totalEq) : '—']];
  if (difal) linhasEq.push(['DIFAL', '', '', fmtBRL(difal)]);
  linhasEq.push(['Total Equipamentos', '', '', fmtBRL(totalGeral)]);
  const linhasParc = parcelas.map(p => [p.desc || '—', p.valor ? 'R$ ' + p.valor : '—']);
  if (parcelas.length) linhasParc.push(['Total Parcelado', fmtBRL(totalParcelas)]);
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Valores e Pagamento'),
    h(View, { style: S.secRule, key: 'r' }),
    h(Text, { style: S.subTitle, key: 's1' }, 'Preços dos Equipamentos'),
    Tabela2(S, [{ label: 'Equipamento', flex: 2 }, { label: 'Qtd', flex: 1, align: 'right' }, { label: 'Valor Unit.', flex: 1, align: 'right' }, { label: 'Total', flex: 1, align: 'right' }], linhasEq, 't1'),
    parcelas.length ? h(View, { key: 'parc' }, [
      h(Text, { style: S.subTitle, key: 's2' }, 'Cronograma de Pagamento'),
      Tabela2(S, [{ label: 'Parcela / Descrição', flex: 3 }, { label: 'Valor', flex: 1, align: 'right' }], linhasParc, 't2'),
    ]) : null,
    PdfFooter(S),
  ]);
}

function PgBlocos(S, data, titulo, campo, pares) {
  const obj = (data.elevador || {})[campo] || {};
  const blocos = pares.map(([lbl, k]) => [lbl, obj[k]]).filter(([, v]) => v);
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, titulo),
    h(View, { style: S.secRule, key: 'r' }),
    ...blocos.map(([t, txt], i) => h(View, { key: i }, [h(Text, { style: S.subTitle, key: 't' }, t), h(Text, { style: S.p, key: 'p' }, txt)])),
    PdfFooter(S),
  ]);
}

function PgPrazo(S, data) {
  const p = (data.elevador || {}).prazo || {};
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Prazo de Entrega'),
    h(View, { style: S.secRule, key: 'r' }),
    p.prazo
      ? h(Text, { style: S.p, key: 'p1' }, [
          'A VerticalParts se compromete a entregar o(s) equipamento(s) adquirido(s) no ',
          h(Text, { style: { fontWeight: 700 }, key: 'b' }, p.prazo),
          ', contados a partir da data em que todos os requisitos forem atendidos, quais sejam: assinatura do contrato, pagamento do sinal e aprovação do projeto. A conclusão desses 03 (três) requisitos são condições essenciais e indispensáveis para o início da contagem do prazo de entrega do(s) equipamento(s).',
        ])
      : Vazio(S),
    h(Text, { style: S.p, key: 'p2' }, 'O comprador deverá apresentar cronograma da obra contendo as datas de liberação de obra para início das montagens e datas finais de entrega, sendo que este cronograma será validado pela VerticalParts.'),
    p.condCovid ? h(Text, { style: S.p, key: 'p3' }, p.condCovid) : null,
    PdfFooter(S),
  ]);
}

function PgResponsabilidades(S, data) {
  const r = (data.elevador || {}).responsabilidades || {};
  const vendedor = r.vendedor || [], comprador = r.comprador || [];
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Responsabilidades'),
    h(View, { style: S.secRule, key: 'r' }),
    h(Text, { style: S.subTitle, key: 's1' }, 'Serviços e Fornecimento a Cargo e por Conta do Vendedor'),
    h(Text, { style: S.p, key: 'p1' }, 'Esta proposta pode ser alterada a qualquer momento. O preço mencionado pressupõe a compra dos equipamentos de acordo com nossas condições padrão vigentes. Se houver condições ou requisitos especiais, o preço e os termos precisarão ser revisados para acomodar essas solicitações.'),
    vendedor.length ? Lista(S, vendedor, 'l1') : null,
    h(Text, { style: S.subTitle, key: 's2' }, 'Serviços e Fornecimento a Cargo e por Conta do Comprador'),
    comprador.length ? Lista(S, comprador, 'l2') : Vazio(S),
    PdfFooter(S),
  ]);
}

function PgGarantia(S, data) {
  const g = (data.elevador || {}).garantia || {};
  return h(Page, { size: 'A4', style: S.page }, [
    PdfHeader(S, data.numero),
    h(Text, { style: S.secTitle, key: 't' }, 'Garantia e Validade'),
    h(View, { style: S.secRule, key: 'r' }),
    h(Text, { style: S.subTitle, key: 's1' }, 'Garantia'),
    g.garantia ? h(Text, { style: S.p, key: 'p1' }, g.garantia) : Vazio(S),
    h(Text, { style: S.subTitle, key: 's2' }, 'Condições Gerais'),
    g.condicoes ? h(Text, { style: S.p, key: 'p2' }, g.condicoes) : Vazio(S),
    g.horario ? h(View, { key: 'hor' }, [
      h(Text, { style: S.p, key: 'p3' }, ['A realização dos serviços de Instalação e Montagem serão realizados no período de:\n', h(Text, { style: { fontWeight: 700 }, key: 'b' }, g.horario)]),
      h(Text, { style: S.p, key: 'p4' }, 'Serviços realizados fora do horário comercial acima mencionado serão cobrados à parte.'),
    ]) : null,
    h(Text, { style: S.subTitle, key: 's3' }, 'Validade da Proposta'),
    h(Text, { style: S.p, key: 'p5' }, data.validade || '30 dias'),
    h(View, { style: S.assinaturas, key: 'ass' }, [
      h(View, { style: S.assinatura, key: 'c' }, [h(View, { style: S.assinaturaLinha, key: 'l' }), h(Text, { style: S.assinaturaB, key: 'b' }, 'Assinatura do Cliente:'), h(Text, { style: S.assinaturaSpan, key: 's' }, 'Nome legível:')]),
      h(View, { style: S.assinatura, key: 'v' }, [h(View, { style: S.assinaturaLinha, key: 'l' }), h(Text, { style: S.assinaturaB, key: 'b' }, 'VerticalParts:')]),
    ]),
    PdfFooter(S),
  ]);
}

/* ---------- Monta o documento completo ---------- */
async function montarDocumento(data) {
  const S = montarStyles();
  const eq = 'elevador';
  const ed = data.elevador || {};
  const fotos = ed.fotos || {};
  const temFotos = !!(fotos.unidade || fotos.teto || fotos.botoeira);
  montarDocumento.ultimasFalhas = [];

  let urls = {};
  if (temFotos && window.PropostaImagens) {
    const slots = ['unidade', 'teto', 'botoeira'];
    /* As fotos do equipamento também passam por carregarImagem(): vêm
       do Storage do Supabase e podem chegar em qualquer formato — se
       vier webp, o react-pdf descartaria em silêncio igual às de
       /assets (ver comentário em carregarImagem). */
    const entries = await Promise.all(slots.map(async (k) => {
      if (!fotos[k]) return [k, null];
      try {
        const assinada = await window.PropostaImagens.signedURL(fotos[k]);
        return [k, assinada ? await carregarImagem(assinada) : null];
      } catch (e) {
        montarDocumento.ultimasFalhas.push(`foto ${k}: ${e.message}`);
        return [k, null];
      }
    }));
    urls = Object.fromEntries(entries);
  }

  /* Logo e foto de capa viram data URI ANTES de montar qualquer página —
     ver comentário em carregarImagem(). Falha aqui é reportada de volta
     (montarDocumento.ultimasFalhas) em vez de gerar um PDF sem imagem
     em silêncio, que foi o defeito de 20/08.
     (a lista já foi zerada lá em cima, antes das fotos — não zerar de
     novo aqui, senão as falhas de foto seriam apagadas) */
  const capaArquivo = `assets/capa-${eq === 'elevador' ? 'elevador' : eq === 'escada' ? 'escada-rolante' : 'esteira-rolante'}.png`;
  await Promise.all([
    carregarImagem('assets/logo-verticalparts-color.png').then((u) => { IMG.logo = u; })
      .catch((e) => { IMG.logo = null; montarDocumento.ultimasFalhas.push(e.message); }),
    carregarImagem(capaArquivo).then((u) => { IMG.capa = u; })
      .catch((e) => { IMG.capa = null; montarDocumento.ultimasFalhas.push(e.message); }),
  ]);

  const pages = [
    PgCapa(S, data, eq),
    PgSobre(S, eq),
    PgSobreCont(S),
    PgClienteObra(S, data),
    PgSaudacao(S, data),
    PgMarketing(S, data),
    PgEspecTabela(S, data),
    PgAcabamento(S, data),
    PgCaracteristicas(S, data),
    PgItensNomeados(S, data, 'Recursos Inclusos', 'recursosNomeados', 'Adicione os recursos inclusos no equipamento.'),
    PgItensNomeados(S, data, 'Infraestrutura e Instalação', 'infraestruturaNomeada', 'Adicione os itens de infraestrutura.'),
    ...(temFotos ? [PgFotos(S, data, urls)] : []),
    PgValores(S, data),
    PgBlocos(S, data, 'Condições Gerais de Pagamento', 'condicoesPagto', [['Venda de Equipamentos', 'venda'], ['Impostos e Serviços', 'impostos'], ['Ajuste de Frete Marítimo', 'ajusteFrete'], ['Reajuste', 'reajuste']]),
    PgBlocos(S, data, 'Ajustes e Impostos', 'ajustes', [['Cláusula de Reajuste Cambial', 'clausulaCambial'], ['Faturamento', 'faturamentoTexto'], ['Taxas e Impostos Inclusos', 'taxasInclusas'], ['Taxas e Impostos Excluídos', 'taxasExcluidas']]),
    PgPrazo(S, data),
    PgResponsabilidades(S, data),
    PgGarantia(S, data),
  ];
  return h0(Document, {}, pages);
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

window.PropostaReactPdf = { baixar, montarDocumento };
