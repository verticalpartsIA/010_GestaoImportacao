'use strict';
/* "A proposta nasce com o que foi cotado" (REGRA do Gelson, 13/11/2026; docs/modulos/04_comercial_pre_venda.md 4.5.10 item 16). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = global.window || {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-cotado-calc.js'), 'utf8'))(global.window);
  return global.window.PropostaCotado;
}
const PC = carregar();

/* Cotação 1004 (caso real): o formulário pediu porta Central e o fornecedor respondeu "Side-opening". */
const unidade = { id: 'U1', identificador: 'VPEL-EL1004-1', modelo: 'VP-200', aco_cabina: 'Aço 430', piso_cabina: 'PS-034', teto_falso: 'SUB-001', botoeira_cabine: 'COP-05C', botoeira_pavimento: 'LOP-12C', porta_tipo_abertura: 'Central', acabamento_porta_cabina: 'Aço 430', acabamento_porta_pavimento: 'Aço 430', porta_largura_mm: 1300, porta_altura_mm: 2100, paradas: 4, tracao: '2:1', velocidade_ms: '1.0' };
const fontes = (div) => ({
  unidades: [unidade],
  cotacao: { id: 'C1', fornecedor: 'Glarie', dados_envio: { unidades: [{ ...unidade, unidade_id: 'U1' }] }, respostas: { itens: [{ unidade_id: 'U1', unidade_identificador: 'VPEL-EL1004-1', divergencias: div }] } },
});

test('divergência: o fornecedor propôs porta lateral e o pedido era central', () => {
  const d = PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Side-opening' }));
  assert.equal(d.length, 1);
  assert.equal(d[0].pedido, 'Central');
  assert.equal(d[0].cotado, 'Lateral');
  assert.equal(d[0].status, 'pendente');
  assert.equal(d[0].fornecedor, 'Glarie');
});

test('divergência: o fornecedor só confirmou o que foi pedido, então não é divergência', () => {
  assert.equal(PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Center' })).length, 0);
  assert.equal(PC.detectarDivergencias(fontes({})).length, 0);
  assert.equal(PC.detectarDivergencias(fontes({ campo_que_nao_existe: 'x' })).length, 0);
  assert.equal(PC.detectarDivergencias({ unidades: [unidade], cotacao: null }).length, 0);
});

test('a proposta herda o COTADO: porta lateral e piso de granito, com o resto do que foi enviado', () => {
  const divs = PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Side-opening', piso_cabina: 'Granito' }));
  const l = PC.legadoDaUnidade(unidade, unidade, divs, {});
  assert.equal(l.modeloPorta, 'Automática Lateral');
  assert.equal(l.pisoCabina, 'Granito');
  assert.equal(l.acabamentoMat, 'Aço 430');
  assert.equal(l.botoeiraPavimento ?? l.botoeirasPavimento, 'LOP-12C');
  assert.equal(l.dimPortaCabine, '1300 x 2100mm');
});

test('sem divergência, o acabamento vem do que foi enviado ao fornecedor', () => {
  const l = PC.legadoDaUnidade(unidade, unidade, [], {});
  assert.equal(l.modeloPorta, 'Automática Central');
  assert.equal(l.pisoCabina, 'PS-034');
  assert.equal(l.painelOperacao, 'COP-05C');
});

test('divergência de paradas e tração entra nas especificações', () => {
  const divs = PC.detectarDivergencias(fontes({ paradas: '5', tracao: '4:1' }));
  const out = PC.aplicarNasEspecs([{ unidadeId: 'U1', andaresParadasPortas: '4 Paradas', tracao: '2:1' }], divs);
  assert.equal(out[0].andaresParadasPortas, '5 Paradas');
  assert.equal(out[0].tracao, '4:1');
});

test('decidir: aceitar, recusar e reabrir; recusada e pendente bloqueiam o envio, aceita não', () => {
  let divs = PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Side-opening' }));
  const id = divs[0].id;
  assert.equal(PC.pendentes({ divergencias: divs }).length, 1);
  divs = PC.decidir(divs, id, 'recusada', 'v@x.com');
  assert.equal(PC.pendentes({ divergencias: divs }).length, 1);
  divs = PC.decidir(divs, id, 'aceita', 'v@x.com');
  assert.equal(PC.pendentes({ divergencias: divs }).length, 0);
  assert.equal(divs[0].decididoPor, 'v@x.com');
  divs = PC.decidir(divs, id, 'pendente');
  assert.equal(divs[0].decididoPor, null);
  assert.throws(() => PC.decidir(divs, 'nao-existe', 'aceita'), /não encontrada/);
  assert.throws(() => PC.decidir(divs, id, 'talvez'), /inválida/);
});

test('mesclar nunca recria nem sobrescreve uma divergência já decidida', () => {
  const novas = PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Side-opening' }));
  const decidida = PC.decidir(novas, novas[0].id, 'aceita', 'v@x.com');
  const out = PC.mesclarDivergencias(decidida, PC.detectarDivergencias(fontes({ porta_tipo_abertura: 'Side-opening', piso_cabina: 'Granito' })));
  assert.equal(out.length, 2);
  assert.equal(out.find((d) => d.key === 'porta_tipo_abertura').status, 'aceita');
});

test('proposta cotada = tem Nº de cotação e Precificação (e é de elevador)', () => {
  assert.equal(PC.ehCotada({ numero_cotacao: 1004, precificacao_id: 'P', proposal_type: 'elevador' }), true);
  assert.equal(PC.ehCotada({ numero_cotacao: 1004, precificacao_id: null, proposal_type: 'elevador' }), false);
  assert.equal(PC.ehCotada({ numero_cotacao: null, precificacao_id: 'P' }), false);
  assert.equal(PC.ehCotada({ numero_cotacao: 1004, precificacao_id: 'P', proposal_type: 'escada' }), false);
});

const catNativa = (valores) => ({ id: 'n', campos: valores.map(([nome, valor], i) => ({ k: 'k' + i, nome, valor, ativo: true })) });
const bloco = (acab, specs) => ({ especificacoes: specs || [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 1, vel: '1' }], acabamentos: acab });

test('travar: migrar o legado para categorias (o editor faz sozinho ao abrir) NÃO conta como edição', () => {
  const legado = bloco({ pisoCabina: 'PS-034', acabamentoMat: 'Aço 430', subTeto: '' });
  const cats = { ...bloco({}), acabamentosCats: [catNativa([['Piso da Cabina', 'PS-034'], ['Acabamento (material)', 'Aço 430'], ['Sub-teto', '']])] };
  assert.deepEqual(PC.alteracoesProtegidas(legado, cats), []);
});

test('travar: trocar piso, aço ou porta é alteração de Acabamentos', () => {
  const antes = { ...bloco({}), acabamentosCats: [catNativa([['Piso da Cabina', 'PS-034'], ['Modelo de Porta', 'Automática Central']])] };
  const depois = { ...bloco({}), acabamentosCats: [catNativa([['Piso da Cabina', 'Mármore Resinado'], ['Modelo de Porta', 'Automática Central']])] };
  assert.deepEqual(PC.alteracoesProtegidas(antes, depois), ['Acabamentos']);
  const porta = { ...bloco({}), acabamentosCats: [catNativa([['Piso da Cabina', 'PS-034'], ['Modelo de Porta', 'Automática Lateral']])] };
  assert.deepEqual(PC.alteracoesProtegidas(antes, porta), ['Acabamentos']);
});

test('travar: paradas, quantidade e modelo são Especificações; texto comercial não trava', () => {
  const a = bloco({}, [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 1, andaresParadasPortas: '4 Paradas' }]);
  const b = bloco({}, [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 1, andaresParadasPortas: '5 Paradas' }]);
  const c = bloco({}, [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 2, andaresParadasPortas: '4 Paradas' }]);
  assert.deepEqual(PC.alteracoesProtegidas(a, b), ['Especificações Técnicas']);
  assert.deepEqual(PC.alteracoesProtegidas(a, c), ['Especificações Técnicas']);
  assert.deepEqual(PC.alteracoesProtegidas({ ...a, textoProposta: 'A' }, { ...a, textoProposta: 'B', beneficios: ['x'] }), []);
});

test('Conferir: aponta o que a proposta tem diferente do cotado e a divergência pendente', () => {
  const f = fontes({ porta_tipo_abertura: 'Side-opening' });
  const proposta = { elevador: { especificacoes: [{ unidadeId: 'U1', andaresParadasPortas: '4 Paradas', tracao: '2:1', vel: '1', tensao: '' }], acabamentosCats: [catNativa([['Piso', 'Mármore Resinado'], ['Material', 'Aço Inox'], ['Porta', 'Automática Lateral']])] }, divergencias: PC.detectarDivergencias(f) };
  const a = PC.compararComProposta(proposta, f);
  const titulos = a.map((x) => x.titulo).join(' | ');
  assert.match(titulos, /Piso da cabina diferente do cotado/);
  assert.match(titulos, /Acabamento \(material\) diferente do cotado/);
  assert.doesNotMatch(titulos, /Tipo de abertura da porta diferente/); // lateral é o cotado e a proposta tem lateral
  assert.ok(a.some((x) => x.gravidade === 'impede' && /Divergência do fornecedor sem decisão/.test(x.titulo)));
  assert.ok(a.every((x) => x.gravidade !== 'impede' || /Divergência/.test(x.titulo)));
});

test('Conferir: proposta igual ao cotado não gera achado', () => {
  const f = fontes({});
  const proposta = { elevador: { especificacoes: [{ unidadeId: 'U1', andaresParadasPortas: '4 Paradas', tracao: '2:1', vel: '1', tensao: '' }], acabamentosCats: [catNativa([['a', 'VP-200'], ['b', 'Aço 430'], ['c', 'SUB-001'], ['d', 'COP-05C'], ['e', 'PS-034'], ['f', 'Automática Central'], ['g', 'LOP-12C']])] } };
  assert.deepEqual(PC.compararComProposta(proposta, f), []);
});
