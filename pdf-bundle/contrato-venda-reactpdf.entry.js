/* ============================================================
   contrato-venda-reactpdf.entry.js — fonte do bundle Vite do PDF do
   Contrato de Compra e Venda de Equipamentos e Prestação de Serviços
   de Instalação (minuta oficial "MINUTA CONTRATUAL VERTICALPARTS
   25 AGO 26").

   Pedido do usuário (29/09/2026): o contrato gerado pelo site tem que
   ter EXATAMENTE o layout da minuta oficial — sem mudar texto nem
   cláusulas. Por isso este motor NÃO redige nada: consome o mesmo
   `doc` que `CV.buildContract()` (contrato-venda-engine.js) já monta
   pra tela, e só decide COMO desenhar cada item.

   Layout da minuta reproduzido aqui (medido no PDF original):
   - A4, cabeçalho (faixa laranja + faixa cinza com logo) e rodapé
     (endereço/telefones/e-mails com ícones) em TODAS as páginas. São as
     próprias imagens extraídas da minuta (assets/contrato-venda-*.png),
     não uma reprodução aproximada.
   - Fonte Poppins 10pt, justificado, entrelinha ~1,7, margens 71/70pt.
   - Título de cláusula = faixa preta cheia com texto branco em negrito
     ("1 – OBJETO DO CONTRATO").
   - Listas com seta (➢) e sub-itens com check (✓), desenhados em SVG
     porque Poppins não tem esses glifos (a minuta usa Wingdings).
   - Assinaturas empilhadas (VENDEDORA, depois COMPRADOR) + TESTEMUNHAS.

   Mesmo padrão dos outros motores (proposta/vistoria/pedido): react e
   react-pdf externos ao app, React.createElement puro, sem `null` em
   array de filhos (o reconciler do react-pdf não ignora), imagens
   sempre normalizadas pra PNG via canvas (a Hostinger converte PNG em
   WEBP e o react-pdf descarta webp em silêncio — ver comentário em
   proposta-reactpdf.entry.js).
   ============================================================ */
import React from 'react';
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, Font, pdf } from '@react-pdf/renderer';

const h0 = React.createElement;
function h(type, props, children) {
  return h0(type, props,
    Array.isArray(children) ? children.filter(c => c !== null && c !== false && c !== undefined) : children);
}

/* ---------- Fontes ---------- */
let _fontesRegistradas = false;
function registrarFontes() {
  if (_fontesRegistradas) return;
  const base = 'https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.0.8/files/poppins-latin-';
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: base + '400-normal.woff', fontWeight: 400, fontStyle: 'normal' },
      { src: base + '400-italic.woff', fontWeight: 400, fontStyle: 'italic' },
      { src: base + '600-normal.woff', fontWeight: 600, fontStyle: 'normal' },
      { src: base + '600-italic.woff', fontWeight: 600, fontStyle: 'italic' },
    ],
  });
  /* Sem hifenização: o padrão do react-pdf quebra palavras em inglês, e a
     minuta nunca hifeniza. */
  Font.registerHyphenationCallback((palavra) => [palavra]);
  _fontesRegistradas = true;
}

/* ---------- Medidas (pt) — tiradas do PDF original ---------- */
const PAGE_W = 595.44;
const HEADER_H = 88.8;
const FOOTER_H = 59.52;
const MARGEM_ESQ = 71;
const MARGEM_DIR = 70;
const FONTE = 10;
const ENTRELINHA = 1.72;
const ESPACO_PARAGRAFO = 17;
const BOLD = 600;

const S = StyleSheet.create({
  page: {
    fontFamily: 'Poppins', fontSize: FONTE, lineHeight: ENTRELINHA, color: '#000',
    paddingTop: HEADER_H + 13, paddingBottom: FOOTER_H + 36,
    paddingLeft: MARGEM_ESQ, paddingRight: MARGEM_DIR,
  },
  header: { position: 'absolute', top: 0, left: 0, width: PAGE_W, height: HEADER_H },
  footer: { position: 'absolute', bottom: 0, left: 0, width: PAGE_W, height: FOOTER_H },

  titulo: { fontSize: 12, fontWeight: BOLD, textAlign: 'center', textDecoration: 'underline', marginBottom: 34 },
  numero: { fontWeight: BOLD, textAlign: 'right', textDecoration: 'underline', marginBottom: 34 },

  par: { textAlign: 'justify', marginBottom: ESPACO_PARAGRAFO },
  parIndent: { marginLeft: 14 },
  parCallout: { marginLeft: 28 },
  parCentro: { textAlign: 'center', marginTop: 24, marginBottom: 40 },

  li: { flexDirection: 'row', marginBottom: 0 },
  liMarca: { width: 13, paddingTop: 4.5 },
  liTexto: { flex: 1, textAlign: 'justify' },

  barra: { backgroundColor: '#000', paddingTop: 2, paddingBottom: 2, paddingLeft: 6, marginTop: 6, marginBottom: ESPACO_PARAGRAFO },
  barraTxt: { color: '#fff', fontWeight: BOLD, fontSize: 9, lineHeight: 1.6 },

  tabela: { alignSelf: 'center', borderTop: '0.75pt solid #7f7f7f', borderLeft: '0.75pt solid #7f7f7f', marginBottom: ESPACO_PARAGRAFO },
  tabLinha: { flexDirection: 'row' },
  tabCel: { borderRight: '0.75pt solid #7f7f7f', borderBottom: '0.75pt solid #7f7f7f', paddingVertical: 1, paddingHorizontal: 8 },
  tabCabec: { backgroundColor: '#bfbfbf', fontWeight: BOLD, textAlign: 'center' },

  assRole: { fontWeight: BOLD, marginBottom: 22 },
  assX: { fontSize: 20, lineHeight: 1.1 },
  assLinha: { width: 190, borderTop: '1.2pt solid #000', marginBottom: 2 },
  assTxt: { fontSize: 8, lineHeight: 1.4, marginLeft: 6 },

  testRow: { flexDirection: 'row', marginTop: 16 },
  testCol: { width: 250 },
});

/* ---------- HTML mínimo do engine → texto com estilos ----------
   O engine só emite <b>…</b> e <br/> (ver contrato-venda-engine.js); <i>/<u>
   ficam suportados por segurança. Tudo escapado por esc() no engine — aqui só
   se desfazem as entidades pra texto puro. */
function decodificar(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function htmlParaRuns(html) {
  const runs = [];
  const st = { b: false, i: false, u: false };
  const re = /<(\/?)(b|strong|i|em|u)\s*>|<br\s*\/?>|([^<]+)/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    if (m[3] !== undefined) {
      runs.push({ t: decodificar(m[3]), b: st.b, i: st.i, u: st.u });
    } else if (/^<br/i.test(m[0])) {
      runs.push({ t: '\n', b: false, i: false, u: false });
    } else {
      const tag = m[2].toLowerCase();
      const k = (tag === 'b' || tag === 'strong') ? 'b' : (tag === 'i' || tag === 'em') ? 'i' : 'u';
      st[k] = m[1] !== '/';
    }
  }
  /* Pontuação colada logo depois de um trecho com estilo diferente (ex.:
     "<b>NOME</b>, brasileiro") sobe pro trecho anterior. O react-pdf trata a
     fronteira entre estilos como ponto de quebra e, se a linha acaba ali,
     imprime um hífen ("NOME-" / ", brasileiro"). Colar a pontuação evita
     isso; a diferença visual (vírgula em negrito) é imperceptível. */
  for (let k = 1; k < runs.length; k++) {
    const ant = runs[k - 1], cur = runs[k];
    if (ant.t === '\n' || cur.t === '\n' || ant.b === cur.b && ant.i === cur.i && ant.u === cur.u) continue;
    const mm = /^[,.;:)\]"”]+/.exec(cur.t);
    if (mm) { ant.t += mm[0]; cur.t = cur.t.slice(mm[0].length); }
  }
  return runs.filter((r) => r.t !== '');
}

function runsParaFilhos(runs) {
  return runs.map((r, i) => {
    const style = {};
    if (r.b) style.fontWeight = BOLD;
    if (r.i) style.fontStyle = 'italic';
    if (r.u) style.textDecoration = 'underline';
    return h(Text, { key: i, style }, r.t);
  });
}

function dividirLinhas(runs) {
  const linhas = [[]];
  runs.forEach((r) => {
    if (r.t === '\n') linhas.push([]);
    else linhas[linhas.length - 1].push(r);
  });
  return linhas;
}

function textoDoItem(item) {
  return item.html ? htmlParaRuns(item.text) : [{ t: String(item.text == null ? '' : item.text), b: false, i: false, u: false }];
}

/* ---------- Marcadores em SVG ---------- */
function Seta() {
  return h(Svg, { width: 8, height: 8, viewBox: '0 0 8 8' },
    h(Path, { d: 'M0.5 0.5 L7.5 4 L0.5 7.5 L2.6 4 Z', fill: '#000' }));
}
function Check() {
  return h(Svg, { width: 8, height: 8, viewBox: '0 0 8 8' },
    h(Path, { d: 'M0.8 4.4 L3 6.6 L7.2 1.2', stroke: '#000', strokeWidth: 1, fill: 'none' }));
}
function Bolinha() {
  return h(Svg, { width: 8, height: 8, viewBox: '0 0 8 8' },
    h(Path, { d: 'M4 2 A2 2 0 1 1 3.99 2 Z', fill: '#000' }));
}

/* ---------- Tabelas ---------- */
function celula(txt, largura, extra, key) {
  return h(View, { key, style: [S.tabCel, { width: largura }] },
    h(Text, { style: extra || {} }, txt));
}

function Tabela(cabecalho, larguras, linhas, rodape) {
  const total = larguras.reduce((a, b) => a + b, 0);
  const filhos = [];
  if (cabecalho) {
    filhos.push(h(View, { key: 'cab', style: S.tabLinha, wrap: false }, [
      h(View, { key: 'c', style: [S.tabCel, S.tabCabec, { width: total }] },
        h(Text, {}, cabecalho)),
    ]));
  }
  linhas.forEach((cels, i) => {
    filhos.push(h(View, { key: 'l' + i, style: S.tabLinha, wrap: false },
      cels.map((c, j) => celula(c.t, larguras[j], c.style, j))));
  });
  if (rodape) {
    filhos.push(h(View, { key: 'rod', style: S.tabLinha, wrap: false },
      rodape.map((c, j) => celula(c.t, larguras[j], c.style, j))));
  }
  return h(View, { key: 'tab', style: [S.tabela, { width: total + 0.75 }], wrap: false }, filhos);
}

function brl(v) { return window.CV && window.CV.brl ? window.CV.brl(v || 0) : String(v || 0); }
const NEG = { fontWeight: BOLD };
const DIR = { textAlign: 'right' };

function TabelaAnexos(item) {
  return Tabela('Títulos dos Anexos', [90, 298],
    (item.anexos || []).map((r) => [{ t: r[0] }, { t: r[1] }]));
}

function TabelaParcelas(item) {
  const tab = item.table || [];
  const total = tab.reduce((s, t) => s + (t.valor || 0), 0);
  return Tabela(null, [112, 120, 56, 100],
    [[{ t: '#', style: NEG }, { t: 'Quando', style: NEG }, { t: '%', style: NEG }, { t: 'Valor', style: { ...NEG, ...DIR } }]]
      .concat(tab.map((t) => [
        { t: t.label }, { t: t.quando },
        { t: (t.pct || 0).toFixed(2).replace('.', ',') + '%' },
        { t: brl(t.valor), style: DIR },
      ])),
    [{ t: 'Total', style: NEG }, { t: '' }, { t: '' }, { t: brl(total), style: { ...NEG, ...DIR } }]);
}

function TabelaEquipamentos(item) {
  const eqs = item.equipamentos || [];
  const total = eqs.reduce((s, e) => s + (e.valor || 0), 0);
  return Tabela(null, [288, 100],
    [[{ t: 'Equipamento', style: NEG }, { t: 'Valor', style: { ...NEG, ...DIR } }]]
      .concat(eqs.map((e) => [{ t: e.label }, { t: brl(e.valor), style: DIR }])),
    [{ t: 'Total', style: NEG }, { t: brl(total), style: { ...NEG, ...DIR } }]);
}

/* ---------- Itens do documento ---------- */
function Item(item, key) {
  if (item.table) return h(View, { key }, TabelaParcelas(item));
  if (item.equipamentos) return h(View, { key }, TabelaEquipamentos(item));
  if (item.anexos) return h(View, { key }, TabelaAnexos(item));

  const runs = textoDoItem(item);

  /* Lista: seta no 1º nível, check nos sub-itens (como a minuta). */
  if (item.li) {
    const recuo = item.indent ? 19 : 14;
    return h(View, { key, style: [S.li, { marginLeft: recuo }], wrap: false }, [
      h(View, { key: 'm', style: S.liMarca }, item.indent ? h(Check) : h(Seta)),
      h(Text, { key: 't', style: S.liTexto }, runsParaFilhos(runs)),
    ]);
  }

  /* Blocos de dados (local de entrega, dados bancários, contatos): a minuta
     não usa caixa — texto simples recuado; os dados bancários vão em
     marcadores redondos. */
  if (item.callout) {
    const linhas = dividirLinhas(runs);
    const bancario = !!item.bancario || (linhas.length > 1 && /dados banc/i.test(linhas[0].map(r => r.t).join('')));
    if (bancario) {
      return h(View, { key, style: { marginBottom: ESPACO_PARAGRAFO } },
        linhas.map((l, i) => (i === 0 && !item.bancario)
          ? h(Text, { key: i, style: { marginLeft: 14 } }, runsParaFilhos(l))
          : h(View, { key: i, style: [S.li, { marginLeft: 22 }], wrap: false }, [
              h(View, { key: 'm', style: S.liMarca }, h(Bolinha)),
              h(Text, { key: 't', style: S.liTexto }, runsParaFilhos(l)),
            ])));
    }
    return h(Text, { key, style: [S.par, S.parCallout] }, runsParaFilhos(runs));
  }

  if (item.center) return h(Text, { key, style: [S.par, S.parCentro] }, runsParaFilhos(runs));

  return h(Text, { key, style: item.indent ? [S.par, S.parIndent] : S.par }, runsParaFilhos(runs));
}

function Secao(sec, i) {
  const filhos = [];
  if (sec.num) {
    filhos.push(h(View, { key: 'bar', style: S.barra, minPresenceAhead: 70 },
      h(Text, { style: S.barraTxt }, `${sec.num} – ${sec.title}`)));
  }
  (sec.body || []).forEach((it, j) => filhos.push(Item(it, 'i' + j)));
  return h(View, { key: 's' + i }, filhos);
}

function Assinaturas(doc) {
  const a = (doc && doc.assinatura) || {};
  const vend = a.vendedora || {};
  const comp = a.comprador || {};
  const bloco = (key, papel, nome, cpf) => h(View, { key, wrap: false, style: { marginBottom: 30 } }, [
    h(Text, { key: 'r', style: S.assRole }, papel),
    h(Text, { key: 'x', style: S.assX }, 'X'),
    h(View, { key: 'l', style: S.assLinha }),
    h(Text, { key: 'n', style: S.assTxt }, nome),
    h(Text, { key: 'c', style: S.assTxt }, `CPF: ${cpf || ''}`),
  ]);
  return [
    bloco('v', 'VENDEDORA\nVERTICALPARTS', vend.nome || '', vend.cpf),
    bloco('c', `COMPRADOR\n${comp.razaoLabel || ''} LTDA.`, `NOME: ${comp.nome || ''}`, comp.cpf),
  ];
}

function Testemunhas() {
  const col = (n) => h(View, { key: n, style: S.testCol }, [
    h(Text, { key: 'l', style: { fontWeight: BOLD } }, `${n}. _________________________`),
    h(Text, { key: 'n' }, 'Nome:'),
    h(Text, { key: 'c' }, 'CPF:'),
  ]);
  return h(View, { key: 'test', wrap: false, style: { marginTop: 6 } }, [
    h(Text, { key: 't', style: { fontWeight: BOLD } }, 'TESTEMUNHAS:'),
    h(View, { key: 'r', style: S.testRow }, [col(1), col(2)]),
  ]);
}

/* ---------- Imagens (cabeçalho/rodapé da minuta) ---------- */
const IMG = { cabecalho: null, rodape: null };
const _imgCache = new Map();
async function carregarImagem(caminho) {
  if (_imgCache.has(caminho)) return _imgCache.get(caminho);
  const url = new URL(caminho, window.location.origin + '/').href;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${caminho} → HTTP ${resp.status}`);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const dataUri = canvas.toDataURL('image/png');
  if (!dataUri.startsWith('data:image/png')) throw new Error(`${caminho} → não virou PNG (veio ${blob.type})`);
  _imgCache.set(caminho, dataUri);
  return dataUri;
}

async function montarDocumento(doc) {
  registrarFontes();
  montarDocumento.ultimasFalhas = [];
  await Promise.all([
    carregarImagem('assets/contrato-venda-cabecalho.png').then((u) => { IMG.cabecalho = u; })
      .catch((e) => { IMG.cabecalho = null; montarDocumento.ultimasFalhas.push(e.message); }),
    carregarImagem('assets/contrato-venda-rodape.png').then((u) => { IMG.rodape = u; })
      .catch((e) => { IMG.rodape = null; montarDocumento.ultimasFalhas.push(e.message); }),
  ]);

  const corpo = [
    h(Text, { key: 'titulo', style: S.titulo }, doc.titulo || 'CONTRATO DE COMPRA E VENDA DE EQUIPAMENTOS E PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO'),
    h(Text, { key: 'numero', style: S.numero }, `Nº do Contrato: ${doc.numero || ''}`),
    ...(doc.sections || []).map(Secao),
    ...Assinaturas(doc),
    Testemunhas(),
  ];

  const pagina = h(Page, { size: 'A4', style: S.page }, [
    IMG.cabecalho ? h(Image, { key: 'cab', src: IMG.cabecalho, style: S.header, fixed: true }) : null,
    IMG.rodape ? h(Image, { key: 'rod', src: IMG.rodape, style: S.footer, fixed: true }) : null,
    ...corpo,
  ]);
  return h0(Document, { title: doc.numero ? `Contrato ${doc.numero}` : 'Contrato' }, pagina);
}

async function gerarBlob(doc) {
  const elemento = await montarDocumento(doc);
  return pdf(elemento).toBlob();
}

async function baixar(doc, filename) {
  const blob = await gerarBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { falhasDeImagem: montarDocumento.ultimasFalhas || [] };
}

window.ContratoVendaReactPdf = { baixar, gerarBlob, montarDocumento };
