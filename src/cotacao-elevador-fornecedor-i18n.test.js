/* ============================================================
   cotacao-elevador-fornecedor-i18n.test.js — o que o fornecedor lê chega em
   PT-BR / EN-US / 中文 (portal: rótulos, seções e valores; e-mail: assunto e corpo).
   Carrega o IIFE de browser num vm com um Supabase de mentira.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, 'cotacao-elevador-fornecedor-store.js'), 'utf8');
const win = { __VP_SB: { sb: {} }, MasterIdEngine: {} };
vm.runInNewContext(src, { window: win, console, fetch: async () => ({ json: async () => ({}) }), localStorage: { getItem() { return null; }, setItem() {} }, navigator: {}, location: { origin: 'https://x' } });
const store = win.CotacaoElevadorFornecedorStore;
const CJK = /[一-鿿]/;

const unidade = {
  identificador: 'VPEL-EL0955-1', quantidade: 1, tipo: 'Passageiro', casa_maquinas: 'sem', agrupamento: 'simplex',
  porta_tipo_abertura: 'Central', porta_modelo: 'P-301', acabamento_porta_cabina: 'Aço 304', acabamento_porta_pavimento: 'Pintado',
  teto_falso: 'SUB-001', piso_cabina: 'PS-201', ard: true, camera: false, estrutura_caixa: 'Concreto',
};
const linhas = (secoes) => secoes.flatMap((s) => s.linhas);
const achar = (secoes, key) => linhas(secoes).find((l) => l[0] === key);

test('portal: toda linha de elevador tem rótulo em chinês', () => {
  const secoes = store.unitSpecSecoes(unidade, 'elevator', 'elevador', { i18n: true });
  linhas(secoes).forEach((l) => assert.ok(CJK.test(l[4] || ''), `sem 中文: ${l[0]}`));
  secoes.forEach((s) => assert.ok(CJK.test(s.titulo), `seção sem 中文: ${s.titulo}`));
});

test('portal: toda linha do quadro de comando tem rótulo em chinês', () => {
  const secoes = store.unitSpecSecoes({ quantidade_quadros: 1 }, 'quadro_comando', 'quadro_comando', { i18n: true });
  linhas(secoes).forEach((l) => assert.ok(CJK.test(l[4] || ''), `sem 中文: ${l[0]}`));
  secoes.forEach((s) => assert.ok(CJK.test(s.titulo), `seção sem 中文: ${s.titulo}`));
});

test('portal: valores de aço, abertura, catálogo e sim/não chegam nos 3 idiomas', () => {
  const s = store.unitSpecSecoes(unidade, 'elevator', 'elevador', { i18n: true });
  assert.match(achar(s, 'acabamento_porta_cabina')[3], /Aço 304 \/ Stainless steel 304 \/ 304不锈钢/);
  assert.match(achar(s, 'acabamento_porta_pavimento')[3], /Pintado \/ Painted \/ 喷漆/);
  assert.match(achar(s, 'porta_tipo_abertura')[3], /Central \/ Center opening \/ 中分门/);
  assert.match(achar(s, 'porta_modelo')[3], /P-301 — Aço Pintado \/ Painted steel \/ 喷漆钢板/);
  assert.match(achar(s, 'teto_falso')[3], /SUB-001 .*拉丝不锈钢/);
  assert.match(achar(s, 'ard')[3], /Sim \/ Yes \/ 是/);
  assert.match(achar(s, 'camera')[3], /Não \/ No \/ 否/);
  assert.match(achar(s, 'modelo_elevador')[3], /乘客电梯/);
  assert.match(achar(s, 'estrutura')[3], /Concreto \/ Concrete \/ 混凝土/);
});

test('portal: os 3 valores de aço existem para os 4 campos', () => {
  ['Aço 304', 'Aço 430', 'Pintado'].forEach((v) => {
    const s = store.unitSpecSecoes({ ...unidade, porta_modelo: v, acabamento_porta_cabina: v, acabamento_porta_pavimento: v }, 'elevator', 'elevador', { i18n: true });
    ['porta_modelo', 'acabamento_porta_cabina', 'acabamento_porta_pavimento'].forEach((k) => assert.ok(CJK.test(achar(s, k)[3]), `${v} em ${k}`));
  });
});

test('texto livre fora do dicionário chega como digitado (não é inventado)', () => {
  assert.strictEqual(store.cefValorI18n('Sim - 180°'), 'Sim - 180°');
  assert.strictEqual(store.cefValorI18n(7), 7);
});

test('visão interna não muda (sem i18n)', () => {
  const s = store.unitSpecSecoes(unidade, 'elevator', 'elevador');
  const l = achar(s, 'acabamento_porta_cabina');
  assert.strictEqual(l.length, 4);
  assert.strictEqual(l[3], 'Aço 304');
  assert.ok(!CJK.test(s[0].titulo));
});

test('e-mail: assunto e corpo em PT-BR, EN-US e 中文', () => {
  const m = store.mensagemRfq({
    numeroDocumento: 'VPEL-EL0955', numeroTxt: ' — Cotação Nº VPCT-0955', url: 'https://x/c/abc', linkJaEnviadoEmDoisCanais: true,
    descricaoPt: 'da(s) unidade(s) A', descricaoEn: 'of unit(s) A', descricaoZh: '单元 A ',
  });
  assert.match(m.subject, /Cotação técnica VPEL-EL0955/);
  assert.match(m.subject, /Technical quotation VPEL-EL0955/);
  assert.ok(CJK.test(m.subject));
  assert.match(m.text, /Solicitação de cotação técnica/);
  assert.match(m.text, /Technical quotation request VPEL-EL0955 — Quotation No\. VPCT-0955/);
  assert.ok(CJK.test(m.text) && m.text.includes('询价编号 VPCT-0955'));
  assert.strictEqual(m.text.split('https://x/c/abc').length - 1, 3, 'o link aparece uma vez por idioma');
  assert.match(m.text, /same link was sent via WhatsApp/);
});

test('e-mail do quadro de comando: sem a frase de "mesmo link" e sem número', () => {
  const m = store.mensagemRfq({ numeroDocumento: 'VPQC-1', numeroTxt: '', url: 'u', linkJaEnviadoEmDoisCanais: false, descricaoPt: 'do Quadro', descricaoEn: 'of the Panel', descricaoZh: '控制柜' });
  assert.ok(!/same link/.test(m.text));
  assert.ok(CJK.test(m.text));
});
