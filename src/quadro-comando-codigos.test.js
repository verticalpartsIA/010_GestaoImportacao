const test = require('node:test');
const assert = require('node:assert');
global.window = {};
require('./quadro-comando-bom-engine.js');
require('./quadro-comando-codigos.js');
const E = window.QuadroComandoBomEngine;
const K = window.QuadroComandoCodigos;

const CAT = [
  { codigo: 'VPB-318', descricao: 'Botoeira de Cabina em Aço Inox, sem Furos, sem Display Indicador de Posição, para Elevador - Ref.: BST' },
  { codigo: 'VPB-351', descricao: 'Botoeira de Cabina Vidro Preto, com Botões em Led Branco, e Display em Led Branco, para Elevador - Ref.: BST' },
  { codigo: 'VPB-032', descricao: 'Botoeira de Cabina Vidro Preto, 10 Andares, com Botões em Led Branco, e Display em Led Branco, para Elevador - Ref.: BST' },
  { codigo: 'VPB-035', descricao: 'Botoeira de Pavimento Vidro Preto com 2 Botões, &quot;1 Sobe e 1 Desce&quot; sem Display' },
  { codigo: 'VPB-034', descricao: 'Botoeira de Pavimento Vidro Preto com 1 Botão "Seta Subida" sem Display' },
  { codigo: 'VPB-317', descricao: 'Botoeira de Pavimento AIE 02 Botões sem Display' },
  { codigo: 'VPB-065', descricao: 'Botoeira de Pavimento AIE, 2 Botões, com Display' },
  { codigo: 'VPEL-686', descricao: 'Indicador de Posição de Pavimento LIP, Horizontal, LED Branco' },
  { codigo: 'VPB-381', descricao: 'Resgate Manual no Comando para Elevador' },
  { codigo: 'VPMAC-40K-0800-100-380V', descricao: 'Máquina de Tração para Elevador, 5.3KW' },
  { codigo: 'VPB-321', descricao: 'Porta de Cabina Completa 2 Folhas Lateral Esquerda 800x2000 AI 304' },
  { codigo: 'VPB-322', descricao: 'Porta de Pavimento Completa 2 Folhas Lateral Esquerda 800x2000 AI 304' },
  { codigo: 'VPKIT-042', descricao: 'Porta de Pavimento Pintado Abertura Cental Inward' },
];

test('opcoes filtra por item, decodifica entidades e tira kits/cópias das portas', () => {
  assert.deepStrictEqual(K.opcoes('maquina_tracao', CAT).map((o) => o.codigo), ['VPMAC-40K-0800-100-380V']);
  assert.deepStrictEqual(K.opcoes('portas', CAT).map((o) => o.codigo), ['VPB-321']);
  assert.deepStrictEqual(K.opcoes('portas_pavimento', CAT).map((o) => o.codigo), ['VPB-322']);
  assert.ok(K.opcoes('lop', CAT).find((o) => o.codigo === 'VPB-035').descricao.includes('"1 Sobe e 1 Desce"'));
});

test('sugerir: COP pelo display e nº de andares; LOP pela família e botões', () => {
  assert.strictEqual(K.sugerir('cop', { paradas: 10, resp: { cop_display: 'com' } }, CAT), 'VPB-032');
  assert.strictEqual(K.sugerir('cop', { paradas: 5, resp: { cop_display: 'com' } }, CAT), 'VPB-351');
  assert.strictEqual(K.sugerir('cop', { paradas: 5, resp: { cop_display: 'sem' } }, CAT), 'VPB-318');
  assert.strictEqual(K.sugerir('cop', { paradas: 5, resp: {} }, CAT), null);
  assert.strictEqual(K.sugerir('lop', { resp: { lop_material: 'vidro', lop_display: 'sem', lop_botoes: '2' } }, CAT), 'VPB-035');
  assert.strictEqual(K.sugerir('lop', { resp: { lop_material: 'vidro', lop_display: 'sem', lop_botoes: '1' } }, CAT), 'VPB-034');
  assert.strictEqual(K.sugerir('lop', { resp: { lop_material: 'aco_escovado', lop_display: 'sem', lop_botoes: '2' } }, CAT), 'VPB-317');
  assert.strictEqual(K.sugerir('lop', { resp: { lop_material: 'aco_escovado', lop_display: 'com', lop_botoes: '2' } }, CAT), 'VPB-065');
  assert.strictEqual(K.sugerir('resgate_automatico', {}, CAT), 'VPB-381'); // único candidato
  assert.strictEqual(K.sugerir('maquina_tracao', {}, CAT), null);
});

test('familiaDoCodigo reconhece qualquer posição da família', () => {
  assert.strictEqual(K.familiaDoCodigo('VPB-317').nome, 'aco_sem');
  assert.strictEqual(K.familiaDoCodigo('VPB-034').dois, 'VPB-035');
  assert.strictEqual(K.familiaDoCodigo('VPB-999'), null);
});

test('LOP usa a família escolhida (aço, sem display) em vez dos padrões de vidro', () => {
  const fam = K.familiaDoCodigo('VPB-317');
  const itens = E.montarItensLop(4, '2', {}, false, { sobe: fam.sobe, desce: fam.desce, dois: fam.dois });
  assert.deepStrictEqual(itens.map((i) => [i.sku, i.quantidade]), [['VPB-315', 1], ['VPB-316', 1], ['VPB-317', 2]]);
  const padrao = E.montarItensLop(4, '2', {}, false);
  assert.deepStrictEqual(padrao.map((i) => i.sku), ['VPB-034', 'VPB-033', 'VPB-035']);
});

test('itensDoEscopo: código escolhido vira linha; sem código vira pendência; não duplica', () => {
  const paradas = [
    { abertura_frontal: true, abertura_traseira: true }, { abertura_frontal: true, abertura_traseira: true }, { abertura_frontal: true, abertura_traseira: false },
  ];
  const escopo = {
    cop: { decisao: 'fornecer', codigo: 'VPB-318' },
    lip: { decisao: 'fornecer', codigo: 'VPEL-686' },
    interfone: { decisao: 'fornecer' },
    maquina_tracao: { decisao: 'fornecer', codigo: 'VPMAC-40K-0800-100-380V' },
    portas: { decisao: 'fornecer', codigo: 'VPB-321', codigo_pavimento: 'VPB-322', quantidade_pavimento: '5' },
    gongo: { decisao: 'nao_aplica', codigo: 'X' },
  };
  const r = K.itensDoEscopo(escopo, paradas, CAT, ['VPB-318']);
  assert.deepStrictEqual(r.pendentes, ['interfone']);
  const por = Object.fromEntries(r.itens.map((i) => [i.sku, i]));
  assert.ok(!por['VPB-318'], 'não repete o que já está no BOM');
  assert.strictEqual(por['VPEL-686'].quantidade, 5);          // 3 frente + 2 oposta
  assert.strictEqual(por['VPEL-686'].confianca, 'estimado');
  assert.strictEqual(por['VPMAC-40K-0800-100-380V'].quantidade, 1);
  assert.strictEqual(por['VPB-321'].quantidade, 2);            // cabina frente + oposta
  assert.strictEqual(por['VPB-322'].quantidade, 5);            // informada pelo vendedor
  assert.strictEqual(por['VPB-322'].confianca, 'confirmado');
});

test('inspeção de cabina usa o código escolhido no hub', () => {
  const r = E.montarItensInspecao({ botoeira_inspecao_cabina: { decisao: 'fornecer', codigo: 'VPB-378' } }, {});
  assert.strictEqual(r[0].sku, 'VPB-378');
  const padrao = E.montarItensInspecao({ botoeira_inspecao_cabina: { decisao: 'fornecer' } }, {});
  assert.strictEqual(padrao[0].sku, 'VPB-208');
});

test('chicotes automáticos: poço (VPB-209) e topo de cabine (VPB-193) trazem os seus; todo quadro leva HW, MT e OS', () => {
  const skus = (l) => l.map((i) => i.sku).sort();
  assert.deepStrictEqual(skus(E.montarItensChicotes([{ sku: 'VPB-209' }], {})),
    ['VPEL-729a', 'VPEL-730a', 'VPEL-731a', 'VPEL-732a', 'VPEL-733a']);
  assert.deepStrictEqual(skus(E.montarItensChicotes([{ sku: 'VPB-193' }], {})),
    ['VPEL-721a', 'VPEL-723a', 'VPEL-725a', 'VPEL-727a', 'VPEL-728a', 'VPEL-729a', 'VPEL-730a', 'VPEL-731a']);
  assert.deepStrictEqual(skus(E.montarItensChicotes([{ sku: 'VPB-380' }], {})), ['VPEL-729a', 'VPEL-730a', 'VPEL-731a']);
  assert.deepStrictEqual(skus(E.montarItensChicotes([{ sku: 'VPEL-729a' }], {})), ['VPEL-730a', 'VPEL-731a']);
});

test('MRL: máquina (MT), limitador (OS) e PAP (HW) saem com 6000mm quando não medidos; medida vence; com casa de máquinas não presume', () => {
  const mm = (t) => Object.fromEntries(t.map((x) => [x.endereco_referencia, x.comprimento_final_mm]));
  const mrl = mm(E.montarTrechosFiacaoFixa({}, 'MRL'));
  assert.strictEqual(mrl['U/V/W, MT (freio)'], 6000);
  assert.strictEqual(mrl.OS, 6000);
  assert.strictEqual(mrl.HW, 6000);
  const medido = mm(E.montarTrechosFiacaoFixa({ distancia_quadro_maquina_mm: 5200, distancia_quadro_limitador_mm: 4800 }, 'MRL'));
  assert.strictEqual(medido['U/V/W, MT (freio)'], 5200);
  assert.strictEqual(medido.OS, 4800);
  const mr = E.montarTrechosFiacaoFixa({}, 'MR');
  assert.ok(mr.every((t) => !t.comprimento_final_mm));
  assert.ok(!mr.some((t) => t.endereco_referencia === 'HW'));
});
