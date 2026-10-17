'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./etiquetas-calc.js');
const E = window.EtiquetasCalc;

test('endereço: normaliza como o banco (END:, maiúscula, sem espaços)', () => {
  assert.equal(E.normalizarEndereco(' end: r2a4 '), 'R2A4');
  assert.equal(E.normalizarEndereco('END:EXP'), 'EXP');
});

test('endereço: mesmas regras da constraint do banco (236 posições + EXP)', () => {
  const todos = E.todosEnderecos();
  assert.equal(todos.length, 237);
  assert.equal(todos.filter((e) => e.tipo === 'posicao').length, 236);
  assert.equal(E.parseEndereco('R2A4').lado, 'direita');
  assert.equal(E.parseEndereco('R2A3').lado, 'esquerda');
  assert.equal(E.parseEndereco('R1A2'), null, 'Rua 1 só tem nível ímpar');
  assert.equal(E.parseEndereco('R4B2'), null, 'Rua 4 só tem nível ímpar');
  assert.equal(E.parseEndereco('R1J1'), null, 'Rua 1 só vai até o vão I');
  assert.ok(E.parseEndereco('R3J8'), 'Rua 3 vai até J e tem os dois lados');
  assert.equal(E.parseEndereco('R5A1'), null);
  assert.equal(E.parseEndereco('R2A9'), null);
  assert.equal(E.parseEndereco(''), null);
});

test('DV: rua×3 + vão×5 + nível×7, resto por 10 (fórmula proposta)', () => {
  assert.equal(E.dvEndereco('R2A4'), 9);   // 6 + 5 + 28 = 39
  assert.equal(E.dvEndereco('R2A3'), 2);   // 6 + 5 + 21 = 32 -> o erro de digitação muda o DV
  assert.equal(E.dvEndereco('END:R3J8'), (9 + 50 + 56) % 10);
  assert.equal(E.dvEndereco('EXP'), null);
  assert.equal(E.dvEndereco('R9Z9'), null);
});

test('DV: troca de 1 caractere entre posições vizinhas sempre muda o DV', () => {
  const todos = E.todosEnderecos().filter((e) => e.tipo === 'posicao');
  let pares = 0;
  for (const a of todos) {
    const vizinho = E.parseEndereco(`R${a.rua}${a.vao}${a.nivel + 1}`) || E.parseEndereco(`R${a.rua}${a.vao}${a.nivel + 2}`);
    if (!vizinho) continue;
    pares++;
    assert.notEqual(E.dvEndereco(a.codigo), E.dvEndereco(vizinho.codigo), `${a.codigo} x ${vizinho.codigo}`);
  }
  assert.ok(pares > 100);
});

test('dados do endereço: QR é END:+código, e o DV só aparece se ligado e nunca vai no QR', () => {
  const sem = E.dadosEndereco('r2a4');
  assert.equal(sem.qr, 'END:R2A4');
  assert.equal(sem.barras, 'R2A4');
  assert.equal(sem.dv_texto, '');
  assert.equal(sem.descricao_local, 'Rua 2 · Vão A · Nível 4');
  assert.equal(sem.lado_texto, 'LADO DIREITO');
  const com = E.dadosEndereco('R2A4', { dv: true });
  assert.equal(com.dv_texto, 'DV 9');
  assert.equal(com.qr, 'END:R2A4');
  const exp = E.dadosEndereco('EXP', { dv: true });
  assert.equal(exp.qr, 'END:EXP');
  assert.equal(exp.dv_texto, '');
  assert.equal(exp.descricao_local, 'Área de expedição');
  assert.throws(() => E.dadosEndereco('R1A2'), /inexistente/);
});

test('dados do item: QR e barras levam exatamente o código (contrato do app de estoque)', () => {
  const d = E.dadosItem({ codigo: ' VPEL-156 ', descricao: 'Rolete Poly-V', unidade: 'UN', familia: 'VPEL', endereco: 'R2A4' });
  assert.equal(d.qr, 'VPEL-156');
  assert.equal(d.barras, 'VPEL-156');
  assert.equal(d.linha_unidade, 'UN · Família VPEL');
  assert.equal(d.endereco_txt, 'End.: R2A4');
  assert.equal(E.dadosItem({ codigo: 'X' }).linha_unidade, '');
});

test('ZPL do endereço a 203 dpi: 800 x 400 pontos, QR nativo com END:, Code 128 nativo', () => {
  const m = E.modeloPorId('ENDERECO_VIGA_100x50');
  const { zpl, avisos } = E.renderZPL(m, E.dadosEndereco('R2A4', { dv: true }), { dpi: 203, copias: 3 });
  assert.match(zpl, /^\^XA\n\^CI28\n\^PW800\n\^LL400\n\^LH0,0/);
  assert.match(zpl, /\^BQN,2,\d+\^FH_\^FDMA,END:R2A4\^FS/);
  assert.match(zpl, /\^BCN,\d+,N,N,N,A\^FH_\^FDR2A4\^FS/);
  assert.ok(zpl.includes('^FDRua 2 _C2_B7 V_C3_A3o A _C2_B7 N_C3_ADvel 4^FS'), 'descrição do local completa, com acento em UTF-8');
  assert.match(zpl, /\^FDDV 9\^FS/);
  assert.match(zpl, /\^PQ3\n\^XZ$/);
  assert.deepEqual(avisos, []);
});

test('ZPL: acento e símbolos viram bytes UTF-8 em hexadecimal; sem UTF-8 o acento é removido', () => {
  assert.equal(E.zplTexto('ç ã é', true), '_C3_A7 _C3_A3 _C3_A9');
  assert.equal(E.zplTexto('A^B~C_D', true), 'A_5EB_7EC_5FD');
  assert.equal(E.zplTexto('ç ã é', false), 'c a e');
  assert.equal(E.zplTexto('a·b', false), 'a?b');
  assert.equal(E.zplTexto('linha1\nlinha2', true), 'linha1 linha2');
  const m = E.modeloPorId('TESTE_100x50');
  const semUtf = E.renderZPL(m, E.DADOS_TESTE, { utf8: false }).zpl;
  assert.ok(!semUtf.includes('^CI28'));
  assert.match(semUtf, /Acentos: c a e o C A/);
});

test('ZPL: resolução de 300 dpi muda os pontos, não os milímetros', () => {
  const m = E.modeloPorId('ENDERECO_VIGA_100x50');
  const z = E.renderZPL(m, E.dadosEndereco('R3B5'), { dpi: 300 }).zpl;
  assert.match(z, /\^PW1200\n\^LL600/);
  assert.equal(E.mmParaDots(100, 203), 800, '203 dpi = 8 pontos por mm');
  assert.equal(E.mmParaDots(100, 600), 2400);
  assert.equal(E.mmParaDots(25.4, 150), 150);
});

test('ZPL: texto longo é cortado com aviso; campo vazio não gera comando', () => {
  const m = E.modeloPorId('ITEM_100x50');
  const longo = 'Descrição muito longa '.repeat(20);
  const r = E.renderZPL(m, E.dadosItem({ codigo: 'VPEL-1', descricao: longo, unidade: 'UN' }));
  assert.ok(r.avisos.some((a) => a.startsWith('Texto cortado')));
  assert.ok(!/\^FDEnd\.:/.test(r.zpl), 'sem endereço, sem linha de endereço');
});

test('ZPL: código de barras largo demais para o modelo avisa', () => {
  const m = E.modeloPorId('ITEM_100x50');
  const r = E.renderZPL(m, E.dadosItem({ codigo: 'CODIGO-MUITO-MUITO-LONGO-12345' }));
  assert.ok(r.avisos.some((a) => /não cabe/.test(a)));
});

test('QR: módulos por versão (modo byte, correção M)', () => {
  assert.equal(E.qrModulos(8), 21);     // END:R2A4
  assert.equal(E.qrModulos(14), 21);
  assert.equal(E.qrModulos(15), 25);
  assert.equal(E.qrModulos(500), 17 + 4 * 11);
});

test('SVG: tamanho exato em mm, sem marcador {campo} sobrando, barcode embutido pela função injetada', () => {
  const m = E.modeloPorId('ENDERECO_VIGA_100x50');
  const chamadas = [];
  const barcode = (tipo, texto) => { chamadas.push([tipo, texto]); return '<svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h21v21z"/></svg>'; };
  const svg = E.renderSVG(m, E.dadosEndereco('R2A4', { dv: true }), { barcode });
  assert.match(svg, /viewBox="0 0 100 50" width="100mm" height="50mm"/);
  assert.ok(!svg.includes('{'));
  assert.deepEqual(chamadas, [['qr', 'END:R2A4'], ['code128', 'R2A4']]);
  assert.match(svg, /preserveAspectRatio="xMinYMin meet"/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.match(svg, />R2A4</);
  assert.match(svg, />DV 9</);
});

test('SVG sem biblioteca de código de barras desenha marcador, não quebra', () => {
  const svg = E.renderSVG(E.modeloPorId('ITEM_100x50'), E.dadosItem({ codigo: 'A&B<1>' }));
  assert.match(svg, />QR</);
  assert.match(svg, /A&amp;B&lt;1&gt;/);
});

test('HTML de impressão: página com o tamanho do modelo e sem margem', () => {
  const h = E.htmlImpressao(['<svg/>', '<svg/>'], 100, 50);
  assert.match(h, /@page\{size:100mm 50mm;margin:0\}/);
  assert.equal((h.match(/class="pg"/g) || []).length, 2);
});

test('modelos padrão: largura 100 (altura 50 ou 100), ids únicos, campos usados existem em dados de exemplo', () => {
  const ids = E.MODELOS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of E.MODELOS) {
    assert.equal(m.largura_mm, 100);
    assert.ok(m.altura_mm === 50 || m.altura_mm === 100);
    for (const el of m.elementos) if (el.campo) {
      for (const c of (el.campo.match(/\{(\w+)\}/g) || [])) assert.ok(m.campos.includes(c.slice(1, -1)), `${m.id}: ${c} não está em campos`);
    }
  }
  assert.equal(E.modelosDoTipo('ENDERECO').length, 1);
});

test('validarEnderecoNovo: aceita existente (normaliza), recusa inexistente, preserva antigo igual', () => {
  assert.deepEqual(E.validarEnderecoNovo(' end: r2a4 ', null), { ok: true, codigo: 'R2A4', antigo: false, msg: '' });
  assert.equal(E.validarEnderecoNovo('exp', null).codigo, 'EXP');
  assert.equal(E.validarEnderecoNovo('', 'G13').codigo, null);
  assert.equal(E.validarEnderecoNovo('R1J1', null).ok, false);
  assert.equal(E.validarEnderecoNovo('G14', 'G13').ok, false);
  const igual = E.validarEnderecoNovo('g13', 'G13');
  assert.equal(igual.ok, true); assert.equal(igual.antigo, true);
});

test('recebimento: QR e barras = código do item (contrato do tipo Item), textos montados', () => {
  const d = E.dadosRecebimento({ data: '17/10/2026', embarque: '146', pi: 'SCVP260522-2', fornecedor: 'Ningbo', codigo: ' VPEL-156 ', descricao: 'Rolete', quantidade: 40, unidade: 'UN', nf: '123' });
  assert.equal(d.qr, 'VPEL-156'); assert.equal(d.barras, 'VPEL-156');
  assert.equal(d.origem, 'Embarque 146 · P.I. SCVP260522-2');
  assert.equal(d.quantidade_txt, 'Qtd: 40 UN'); assert.equal(d.nf_txt, 'NF: 123');
  assert.equal(E.dadosRecebimento({ codigo: 'X' }).nf_txt, '');
});

test('separação: volume n/N limitado ao total e QR PED:<pedido>', () => {
  const d = E.dadosSeparacao({ pedido: '30570', volume: 9, total_volumes: 5, cliente: 'AKAI' });
  assert.equal(d.volume_txt, 'VOL 5 / 5'); assert.equal(d.qr, 'PED:30570'); assert.equal(d.pedido_txt, 'PEDIDO 30570');
  assert.equal(E.dadosSeparacao({ pedido: '1' }).volume_txt, 'VOL 1 / 1');
});

test('modelos novos: rolos 100x50 e 100x100 e ZPL com a página certa', () => {
  const r = E.modeloPorId('RECEBIMENTO_100x50'), s = E.modeloPorId('SEPARACAO_100x100');
  assert.equal(r.altura_mm, 50); assert.equal(s.altura_mm, 100);
  const z = E.renderZPL(s, E.dadosSeparacao({ pedido: '30570', volume: 2, total_volumes: 5, cliente: 'AKAI KB' }), { dpi: 203 });
  assert.match(z.zpl, /\^PW800/); assert.match(z.zpl, /\^LL800/); assert.match(z.zpl, /PED:30570/);
  const zr = E.renderZPL(r, E.dadosRecebimento({ codigo: 'VPEL-156', descricao: 'Rolete ção', quantidade: 4, unidade: 'UN' }), { dpi: 203 });
  assert.match(zr.zpl, /\^LL400/); assert.match(zr.zpl, /VPEL-156/);
});
