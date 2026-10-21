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

test('modelos padrão: largura 100 (altura 50, 100 ou 150), ids únicos, campos usados existem em dados de exemplo', () => {
  const ids = E.MODELOS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of E.MODELOS) {
    assert.ok([50, 100].includes(m.largura_mm));
    assert.ok([30, 50, 100, 150].includes(m.altura_mm));
    for (const el of m.elementos) if (el.campo) {
      for (const c of (el.campo.match(/\{(\w+)\}/g) || [])) assert.ok(m.campos.includes(c.slice(1, -1)), `${m.id}: ${c} não está em campos`);
    }
  }
  assert.equal(E.modelosDoTipo('ENDERECO').length, 1);
});

test('validarEnderecoNovo: aceita existente (normaliza), recusa inexistente, preserva antigo igual', () => {
  assert.deepEqual(E.validarEnderecoNovo(' end: r2a4 ', null), { ok: true, codigo: 'R2A4', antigo: false, msg: '' });
  assert.equal(E.validarEnderecoNovo('exp', null).codigo, 'EXP');
  assert.equal(E.validarEnderecoNovo('', 'R01 05').codigo, null);
  assert.equal(E.validarEnderecoNovo('R1J1', null).ok, false);
  assert.equal(E.validarEnderecoNovo('Z14', 'R01 05').ok, false);
  assert.equal(E.validarEnderecoNovo('A05', null).ok, false);   // prateleira é só B–I
  assert.equal(E.validarEnderecoNovo('G31', null).ok, false);   // e só 1–30
  const igual = E.validarEnderecoNovo('r01 05', 'R01 05');   // texto antigo igual ao gravado passa
  assert.equal(igual.ok, true); assert.equal(igual.antigo, true);
});

test('vários endereços: porta-palete + prateleira do mezanino, separados por "/", sem repetidos', () => {
  const v = E.validarEnderecoNovo('r2i8 / R2H8, h9;H09 / H24', null);
  assert.deepEqual(v, { ok: true, codigo: 'R2I8 / R2H8 / H09 / H24', antigo: false, msg: '' });
  assert.deepEqual(E.listaEnderecos('R4J5 / R4J3 / R4I3 / R4H5 / R4F3').map((e) => e.codigo), ['R4J5', 'R4J3', 'R4I3', 'R4H5', 'R4F3']);
  assert.deepEqual(E.listaEnderecos('R2J4 / I24').map((e) => e.tipo), ['porta_palete', 'prateleira']);
  assert.equal(E.validarEnderecoNovo('R2I8 / R9Z9', null).ok, false);          // um pedaço ruim recusa o conjunto
  assert.equal(E.validarEnderecoNovo('R1J1 / G14', null).ok, false);           // R1J1 não existe
  const antigo = E.validarEnderecoNovo('R01 05 / 09 / H23', 'R01 05 / 09');    // pedaço antigo preservado, novo validado
  assert.equal(antigo.ok, true); assert.equal(antigo.antigo, true);
  assert.equal(E.rotuloEndereco('g27'), 'Mezanino · Prateleira G27');
  assert.equal(E.tipoEndereco('EXP'), 'expedicao');
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

test('fase 4: palete, ID-TAG, OP do quadro e avaria — dados e QR', () => {
  const pal = E.dadosPalete({ codigo: 'pal-scvp-1', pi: 'SCVP1', embarque: '146', data: '17/10/2026', itens: [{ codigo: 'VPEL-156', quantidade: 40 }, { codigo: 'VPEL-157', quantidade: 5 }] });
  assert.equal(pal.qr, 'PAL:PAL-SCVP-1'); assert.equal(pal.total_txt, '2 item(ns)'); assert.match(pal.itens_txt, /VPEL-156 x40 · VPEL-157 x5/);
  const muitos = E.dadosPalete({ codigo: 'P', itens: Array.from({ length: 9 }, (_, i) => ({ codigo: 'C' + i, quantidade: 1 })) });
  assert.match(muitos.itens_txt, /\+3 item\(ns\)/);
  const tag = E.dadosIdTag({ codigo: 'vpel-el0985-1', cliente: 'AKAI', predio: 'Loja', cidade: 'Praia Grande', uf: 'SP', cotacao: 985 });
  assert.equal(tag.qr, 'EQP:VPEL-EL0985-1'); assert.equal(tag.obra_txt, 'Loja · Praia Grande/SP'); assert.equal(tag.cotacao_txt, 'Cotação Nº 985');
  const op = E.dadosOpQuadro({ numero: 'OP-0001', produto: 'VPEL-709b', serie: '' });
  assert.equal(op.qr, 'OP:OP-0001'); assert.match(op.serie_txt, /____/);
  assert.equal(E.dadosOpQuadro({ numero: '1', serie: 'S123' }).serie_txt, 'Nº de série: S123');
  const av = E.dadosAvaria({ codigo: 'VPEL-156', descricao: 'Rolete', quantidade: 2, unidade: 'UN', motivo: 'amassado', responsavel: 'Tiago', data: '18/10/2026' });
  assert.equal(av.qr, 'VPEL-156'); assert.equal(av.quem_txt, 'Por: Tiago · 18/10/2026');
  for (const id of ['PALETE_100x50', 'IDTAG_100x50', 'OP_QUADRO_100x50', 'AVARIA_100x50']) {
    const m = E.modeloPorId(id); assert.ok(m, id);
    const dados = { PALETE_100x50: pal, IDTAG_100x50: tag, OP_QUADRO_100x50: op, AVARIA_100x50: av }[id];
    const z = E.renderZPL(m, dados, { dpi: 203 }); assert.match(z.zpl, /\^XA[\s\S]*\^XZ/);
  }
});

test('fase 3: modelos da empresa — registro, validação e campos protegidos', () => {
  const base = E.modeloPorId('ITEM_100x50');
  const copia = () => ({ ...JSON.parse(JSON.stringify(base)), id: 'x', tipo: 'ITEM' });
  assert.deepEqual(E.validarModelo(copia(), base), []);
  const semQr = copia(); semQr.elementos = semQr.elementos.filter((e) => e.tipo !== 'qr');
  assert.ok(E.validarModelo(semQr, base).some((m) => /QR Code/.test(m)));
  const fora = copia(); fora.elementos[1].x = 90; fora.elementos[1].w = 30;
  assert.ok(E.validarModelo(fora, base).some((m) => /sai da etiqueta/.test(m)));
  const campo = copia(); campo.elementos.push({ tipo: 'texto', campo: '{inexistente}', x: 5, y: 5, w: 20, h: 4 });
  assert.ok(E.validarModelo(campo, base).some((m) => /não existe neste tipo/.test(m)));
  const pequeno = copia(); pequeno.elementos.find((e) => e.tipo === 'qr').w = 8;
  assert.ok(E.validarModelo(pequeno, base).some((m) => /QR muito pequeno/.test(m)));
  E.registrarModelos([{ id: 'u1', tipo: 'ITEM', nome: 'Item da casa', base_id: 'ITEM_100x50', largura_mm: 100, altura_mm: 50, campos: base.campos, elementos: base.elementos, ativo: true }, { id: 'u2', tipo: 'ITEM', nome: 'Inativo', base_id: 'ITEM_100x50', largura_mm: 100, altura_mm: 50, campos: [], elementos: [], ativo: false }]);
  assert.equal(E.modeloPorId('C:u1').nome, 'Item da casa');
  assert.equal(E.modelosDoTipo('ITEM').length, 3);   // 2 padrões (100x50 e 50x30) + 1 ativo (o inativo não aparece)
  assert.equal(E.modelosDaEmpresa().length, 2);
  E.registrarModelos([]);
  assert.equal(E.modeloPorId('C:u1'), null);
});

test('rolo: largura × comprimento, colunas e limite da impressora', () => {
  const zt = { largura_max_mm: 104 };
  const a = E.geometriaRolo({ largura_mm: '100', altura_mm: '150', colunas: '1' }, zt);
  assert.ok(a.ok); assert.equal(a.largura, 100); assert.equal(a.altura, 150); assert.equal(a.larguraTotal, 100);
  const b = E.geometriaRolo({ largura_mm: 30, altura_mm: 50, colunas: 2, espaco_mm: 3 }, zt);
  assert.ok(b.ok); assert.equal(b.larguraTotal, 63);
  assert.ok(!E.geometriaRolo({ largura_mm: 60, altura_mm: 50, colunas: 2, espaco_mm: 3 }, zt).ok, '123 mm não cabe numa impressora de 104 mm');
  assert.ok(!E.geometriaRolo({ largura_mm: '', altura_mm: 50 }).ok);
  assert.ok(!E.geometriaRolo({ largura_mm: 30, altura_mm: 50, colunas: 1.5 }).ok);
  const leg = E.geometriaRolo({ rolo: '100x100' });   // formato antigo guardado no navegador
  assert.equal(leg.largura, 100); assert.equal(leg.altura, 100); assert.equal(leg.colunas, 1);
});

test('adaptarModelo: mesma medida não mexe; outra medida usa escala única e centraliza', () => {
  const m = E.modeloPorId('ITEM_100x50');
  assert.equal(E.adaptarModelo(m, 100, 50).ajustado, false);
  const g = E.adaptarModelo(m, 100, 150);   // mais alto: escala 1, sobra 100 mm na vertical, centralizado
  assert.equal(g.escala, 1); assert.equal(g.modelo.altura_mm, 150);
  assert.equal(g.modelo.elementos[0].y, m.elementos[0].y + 50);
  const p = E.adaptarModelo(m, 30, 50);   // mais estreito: escala 0,3
  assert.ok(Math.abs(p.escala - 0.3) < 1e-9);
  for (const el of p.modelo.elementos) assert.ok(el.x >= 0 && el.x + (el.w || 0) <= 30.001, 'tudo dentro dos 30 mm');
  const t = E.adaptarModelo(m, 200, 100, { ampliar: false });
  assert.equal(t.escala, 1, 'o teste não é ampliado');
});

test('ZPL com 2 colunas: rolo de 63 mm, 2 etiquetas por linha, linhas iguais usam ^PQ', () => {
  const m = E.adaptarModelo(E.modeloPorId('ENDERECO_VIGA_100x50'), 30, 50).modelo;
  const A = E.dadosEndereco('R1A1'), B = E.dadosEndereco('R1A3'), C = E.dadosEndereco('R1A5');
  const r = E.renderZPLLinhas(m, [{ dados: A, copias: 2 }, { dados: B, copias: 1 }, { dados: C, copias: 1 }], { dpi: 203, colunas: 2, espaco: 3 });
  assert.equal(r.etiquetas, 4);
  assert.equal(r.blocos.length, 2, 'linha 1 = A A; linha 2 = B C');
  assert.match(r.blocos[0], /\^PW504/);   // 63 mm × 8
  assert.match(r.blocos[0], /\^PQ1/);
  assert.equal((r.blocos[1].match(/\^BQN/g) || []).length, 2, 'dois QR na mesma linha');
  assert.match(r.blocos[1], /\^FO(2[6-9]\d|3\d\d),/, 'a 2ª etiqueta começa depois de 33 mm (264 pontos)');
  const iguais = E.renderZPLLinhas(m, [{ dados: A, copias: 10 }], { dpi: 203, colunas: 2, espaco: 3 });
  assert.equal(iguais.blocos.length, 1); assert.match(iguais.blocos[0], /\^PQ5/);
  const um = E.renderZPLLinhas(m, [{ dados: A, copias: 3 }], { dpi: 203, colunas: 1 });
  assert.match(um.blocos[0], /\^PQ3/);
});

test('SVG da linha: largura do rolo inteiro e uma etiqueta por coluna', () => {
  const m = E.modeloPorId('ITEM_100x50');
  const svg = E.renderSVGLinha(m, [E.dadosItem({ codigo: 'A1' }), E.dadosItem({ codigo: 'B2' })], { colunas: 2, espaco: 4 });
  assert.match(svg, /viewBox="0 0 204 50"/);
  assert.match(svg, /width="204mm" height="50mm"/);
  assert.match(svg, />A1</); assert.match(svg, />B2</);
  assert.doesNotMatch(E.renderSVGLinha(m, [E.dadosItem({ codigo: 'A1' })], { fluido: true }), /width="100mm"/);
});

test('ajuste fino de posição: desloca os campos no ZPL e valida o limite', () => {
  const m = E.modeloPorId('TESTE_100x50');
  const base = E.renderZPL(m, E.DADOS_TESTE, { dpi: 300 }).zpl;
  const desl = E.renderZPL(m, E.DADOS_TESTE, { dpi: 300, desl_x_mm: 2, desl_y_mm: 1 }).zpl;
  const fo = (z) => z.match(/\^FO(\d+),(\d+)/g);
  const a = fo(base), b = fo(desl);
  assert.equal(a.length, b.length);
  const [ax, ay] = /\^FO(\d+),(\d+)/.exec(a[1]).slice(1).map(Number), [bx, by] = /\^FO(\d+),(\d+)/.exec(b[1]).slice(1).map(Number);
  assert.equal(bx - ax, 24); assert.equal(by - ay, 12);   // 2 mm e 1 mm a 300 dpi (12 pontos/mm)
  const neg = E.renderZPL(m, E.DADOS_TESTE, { dpi: 300, desl_x_mm: -50 }).zpl;
  assert.doesNotMatch(neg, /\^FO-/, '^FO nunca recebe negativo');
  assert.ok(E.geometriaRolo({ largura_mm: 100, altura_mm: 50, desl_x_mm: 3, desl_y_mm: -2 }).ok);
  assert.ok(!E.geometriaRolo({ largura_mm: 100, altura_mm: 50, desl_x_mm: 12 }).ok);
  assert.equal(E.geometriaRolo({ largura_mm: 100, altura_mm: 50 }).deslX, 0);
});

test('separação: há modelo para 100x50, 100x100 e 100x150 e o conteúdo ocupa ~95% da etiqueta', () => {
  const ms = E.modelosDoTipo('SEPARACAO');
  assert.deepEqual(ms.map((m) => m.altura_mm).sort((a, b) => a - b), [50, 100, 150]);
  for (const m of ms) {
    const xs = m.elementos.filter((e) => e.tipo !== 'caixa' && e.tipo !== 'linha');
    const dir = Math.max(...xs.map((e) => e.x + e.w)), baixo = Math.max(...xs.map((e) => e.y + (e.tipo === 'qr' ? e.w : e.h)));
    assert.ok(dir >= m.largura_mm * 0.93, `${m.id}: largura usada ${dir}`);
    assert.ok(baixo <= m.altura_mm - 1, `${m.id}: nada passa da borda`);
    const z = E.renderZPL(m, E.dadosSeparacao({ pedido: '26078', volume: 1, total_volumes: 3, cliente: 'CONCESSIONARIA CATEDRAL SPE S.A.', destino: 'EXP', separador: 'Gelson Simões', data: '19/10/2026' }), { dpi: 300 });
    assert.ok(!z.avisos.some((a) => /não cabe|pequeno|cortado/.test(a)), `${m.id}: ${z.avisos.join(' | ')}`);
  }
});

test('impressão pelo navegador: o CSS de tamanho vale só para o SVG da página, não para os aninhados (colunas, QR, barras)', () => {
  const h = E.htmlImpressao(['<svg></svg>'], 63, 50);
  assert.match(h, /\.pg>svg\{/);
  assert.doesNotMatch(h, /\.pg svg\{/);
});

test('Expedição: etiqueta de volume da NF (modelo girado, rolo 100 x 150)', () => {
  const m = E.modeloPorId('EXPEDICAO_100x150');
  assert.ok(m && m.girar === 90);
  assert.equal(m.largura_mm, 100); assert.equal(m.altura_mm, 150);
  const d = E.dadosExpedicaoVolume({ nf: '22019', pedido: '28988', volume: 13, total_volumes: 19, destinatario: 'BAR DO CUSCUZ E RESTAURANTE LTDA', transportadora: 'CLIENTE RETIRA',
    endereco: 'RUA DOUTOR SEVERINO RIBEIRO CRUZ, 771, CENTRO, CAMPINA GRANDE (PB)/PB, 58400258' });
  assert.equal(d.nf_txt, 'NOTA FISCAL: 22019');
  assert.equal(d.volume_txt, 'VOLUME 13 / 19');
  assert.equal(d.pedido_txt, '28988');
  assert.equal(d.qr, '22019');
  assert.equal(d.transportadora_txt, 'TRANSPORTADORA: RETIRA FOB');
  assert.match(d.endereco_txt, /CAMPINA GRANDE\/PB, CEP 58400-258$/);
  assert.match(E.renderSVG(m, d, {}), /rotate\(90\)/);
  assert.match(E.renderSVG(m, d, { girar: 270 }), /rotate\(-90\)/);
  assert.equal(E.renderZPL(m, d).zpl, '');                  // modelo girado só sai pelo navegador
  assert.deepEqual(E.renderZPLLinhas(m, [{ dados: d, copias: 2 }], {}).blocos, []);
  // rolo menor: a escala é calculada no desenho deitado (150 × 100), não na folha em pé
  const a = E.adaptarModelo(m, 100, 100);
  assert.ok(Math.abs(a.escala - 100 / 150) < 1e-9);
  assert.equal(E.adaptarModelo(m, 100, 150).ajustado, false);
});

test('Separação — etiqueta AGUARDA (pedido parcial) usa o mesmo modelo com outro texto', () => {
  const d = E.dadosSeparacao({ pedido: '29501', cliente: 'AKAI', aguarda: 'operação: VPEL-710a, VPB-148' });
  assert.equal(d.volume_txt, 'PARCIAL');
  assert.equal(d.destino_txt, 'AGUARDA');
  assert.equal(d.separador_txt, 'operação: VPEL-710a, VPB-148');
  assert.equal(d.qr, 'PED:29501');
  assert.equal(E.dadosSeparacao({ pedido: '1' }).destino_txt, 'Destino: EXP');
});

test('Item 50 x 30 (contagem às cegas, 2 colunas): ícone, QR e Code 128 do código, sem saldo; ZPL com ícone', () => {
  const m = E.modeloPorId('ITEM_50x30');
  assert.ok(m && m.largura_mm === 50 && m.altura_mm === 30);
  const d = E.dadosItem({ codigo: 'VPEL-EL0990-1', descricao: 'Polia de tração' });
  const z = E.renderZPL(m, d, { dpi: 203 });
  assert.ok(!z.avisos.some((a) => /não cabe|pequeno|cortado/.test(a)), z.avisos.join(' | '));
  assert.match(z.zpl, /\^GFA,/);
  assert.match(E.renderSVG(m, d, {}), /data:image\/png/);
  const g = E.geometriaRolo({ largura_mm: 50, altura_mm: 30, colunas: 2, espaco_mm: 3 }, { largura_max_mm: 104 });
  assert.ok(g.ok);
  assert.ok(!/saldo|qtd/i.test(JSON.stringify(m.campos)));
});

test('Chicote do quadro (50 x 30): "FAN | 1212 Modernização", só texto e ícone, POW1 só com casa de máquinas', () => {
  const m = E.modeloPorId('CHICOTE_50x30');
  assert.ok(m && m.largura_mm === 50 && m.altura_mm === 30 && m.tipo === 'CHICOTE_QUADRO');
  assert.ok(!m.elementos.some((e) => e.tipo === 'qr' || e.tipo === 'code128'), 'sem QR nem código de barras');
  assert.equal(E.CHICOTES.length, 22);
  assert.ok(E.CHICOTES.find((c) => c.codigo === 'FAN'));
  const d = E.dadosChicote({ chicote: 'FAN', pedido: '1212', tipo_obra: 'modernizacao' });
  assert.equal(d.chicote_txt, 'FAN | 1212 Modernização');
  assert.equal(d.desc_txt, 'Iluminação e ventilação da cabina');
  assert.equal(E.dadosChicote({ chicote: 'qc', pedido: 1070, tipo_obra: 'novo' }).chicote_txt, 'QC | 1070 Novo');
  const pow = E.CHICOTES.find((c) => c.codigo === 'POW1');
  assert.equal(E.chicoteDisponivel(pow, 'MR'), true);
  assert.equal(E.chicoteDisponivel(pow, 'MRL'), false);
  assert.equal(E.chicoteDisponivel(pow, null), false);
  assert.equal(E.chicoteDisponivel(E.CHICOTES.find((c) => c.codigo === 'OS'), 'MRL'), true);
  // cabe na etiqueta mesmo com o maior texto
  for (const c of E.CHICOTES) {
    const z = E.renderZPL(m, E.dadosChicote({ chicote: c.codigo, pedido: '1212', tipo_obra: 'modernizacao' }), { dpi: 203 });
    assert.ok(!z.avisos.some((a) => /cortado/.test(a)), `${c.codigo}: ${z.avisos.join(' | ')}`);
  }
});

test('Chicote: rodapé com OP e cliente (identifica de quem é o quadro)', () => {
  const d = E.dadosChicote({ chicote: 'QC', pedido: '29775', tipo_obra: '', cliente: 'VITALTEC ELEVADORES LTDA', op: 'OP-0004-Q1' });
  assert.equal(d.chicote_txt, 'QC | 29775');
  assert.equal(d.rodape_txt, 'OP-0004-Q1 · VITALTEC ELEVADORES LTDA');
  assert.equal(E.dadosChicote({ chicote: 'QC', pedido: '1', cliente: 'X' }).rodape_txt, 'X');
  const m = E.modeloPorId('CHICOTE_50x30');
  const z = E.renderZPL(m, d, { dpi: 203 });
  assert.ok(!z.avisos.some((a) => /cortado/.test(a)), z.avisos.join(' | '));
});
