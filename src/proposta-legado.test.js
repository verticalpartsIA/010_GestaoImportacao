'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-legado.js');
const M = window.PropostaLegado;

test('ehPropostaSchemaLegado — true quando tem client sem cliente', () => {
  assert.equal(M.ehPropostaSchemaLegado({ client: {}, cliente: undefined }), true);
});

test('ehPropostaSchemaLegado — false pra proposta já no formato atual', () => {
  assert.equal(M.ehPropostaSchemaLegado({ cliente: {} }), false);
  assert.equal(M.ehPropostaSchemaLegado(null), false);
  assert.equal(M.ehPropostaSchemaLegado({}), false);
});

// Amostra real da proposta nº166 (site antigo "Propostas", migrado 18/08) —
// "PROPOSTA 797 - ESCADA ROLANTE - FF BORTOLAZZO". Conteúdo longo (termos
// jurídicos) reduzido pra manter o teste legível; nomes de campo idênticos
// aos do dado real.
const AMOSTRA_ESCADA = {
  titulo: 'PROPOSTA 797 - ESCADA ROLANTE - FF BORTOLAZZO',
  dj: {
    number: '797',
    client: { zip: '', city: 'Guarulhos', name: '', email: '', phone: '', state: 'SP', address: '', contactPerson: '' },
    work: { name: '', address: '' },
    terms: {
      general: 'Esta proposta está sujeita a retificação em qualquer tempo.',
      warranty: 'Garantia de 90 dias.',
      buyerResp: 'A. Preparo do poço\nB. Concreto',
      sellerResp: 'A. Entrega\nB. Montagem',
    },
    financials: { unitPrice: 0, taxExcluded: 'Alvará...', taxIncluded: 'Inclusos...', paymentTerms: 'Negociada.' },
    elevatorUnits: [],
    walkwayUnits: [],
    escalatorWork: { zip: '18530-141', city: 'Tietê', state: 'SP', number: '419', address: 'Rua Francisco de Toledo', projectName: 'FF BORTOLAZZO', neighborhood: "Caixa D'Água" },
    escalatorClient: { zip: '18530-141', city: 'Tietê', cnpj: '61.651.089/0001-40', name: 'FF BORTOLAZZO LTDA.', email: '', phone: '', state: 'SP', number: '419', address: 'Rua Francisco de Toledo', contact: '', neighborhood: "Caixa D'Água" },
    escalatorUnits: [{
      name: 'Escada Rolante - OAK - 35º - 800mm - 3070 mm', rise: '3070 mm', price: 498608.79, speed: '0.5 m/s',
      machine: 'Superior', quantity: 2, stepWidth: '800mm', clientName: 'FF Bortolazo', arrangement: 'Simples',
      inclination: '35º', powerSupply: '220V Trifásico', buildingType: 'Comercial', transportChar: 'Comercial', balustradeHeight: '900mm',
    }],
    escalatorProducts: [{ title: 'Escada Rolante - OAK', benefits: 'Soluções de última geração', description: 'A VerticalParts pode fornecer escadas rolantes.' }],
    escalatorSpecifics: { handrail: 'Borracha Vulcanizada com malha de aço', stepFinish: 'Pintado na cor preta' },
    escalatorInstallation: { transport: 'Montado na fábrica.', unloading: 'Descarregamento em horário comercial.', lubrication: 'Válvula solenoide.', installation: 'Ambiente fechado.' },
    escalatorDifal: 0,
    escalatorPaymentMethod: '40% á vista e 5 parcelas',
    escalatorPaymentSchedule: [
      { value: 398887.03, description: 'Sinal de 40% na assinatura do contrato' },
      { value: 199443.51, description: '1º PARCELA (20%)' },
    ],
    escalatorExchangeRate: '5,50',
    escalatorFreightAdj: 'Ajuste conforme frete marítimo.',
    escalatorReadjustment: 'Reajustado com base no IGP-DI.',
    escalatorTaxExcluded: 'Alvará de funcionamento...',
    escalatorDeliveryTimeframe: 'prazo de 120 a 150 dias',
    escalatorDeliveryConditions: 'Cronograma da obra.',
  },
};

test('converterPropostaLegado — escada: cliente vem do objeto prefixado (escalatorClient), não do genérico vazio', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  assert.equal(out.cliente.nome, 'FF BORTOLAZZO LTDA.');
  assert.equal(out.cliente.cnpj, '61.651.089/0001-40');
  assert.equal(out.cliente.cidade, 'Tietê');
  assert.equal(out.obra.nome, 'FF BORTOLAZZO');
});

test('converterPropostaLegado — escada: nasce em out.escada, não em out.elevador', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  assert.ok(out.escada);
  assert.equal(out.elevador, undefined);
  assert.equal(out.esteira, undefined);
});

test('converterPropostaLegado — escada: especificações da unidade (dimensões, ângulo, velocidade)', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  const spec = out.escada.especificacoes[0];
  assert.equal(spec.desnivel, '3070');
  assert.equal(spec.incl, '35');
  assert.equal(spec.largDegrau, '800mm');
  assert.equal(spec.vel, '0.5');
  assert.equal(spec.qtd, 2);
});

test('converterPropostaLegado — escada: parcelas convertidas (value/description → valor/desc)', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  assert.deepEqual(out.escada.valores.parcelas[0], { desc: 'Sinal de 40% na assinatura do contrato', valor: '398887.03' });
});

test('converterPropostaLegado — escada: instalação (transporte/lubrificação/descarregamento)', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  assert.equal(out.escada.instalacao.transporte, 'Montado na fábrica.');
  assert.equal(out.escada.instalacao.lubrificacao, 'Válvula solenoide.');
  assert.equal(out.escada.instalacao.descarregamento, 'Descarregamento em horário comercial.');
});

test('converterPropostaLegado — escada: garantia vem de terms (compartilhado entre equipamentos)', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  assert.equal(out.escada.garantia.garantia, 'Garantia de 90 dias.');
});

test('converterPropostaLegado — nenhuma chave do resultado é undefined (regressão: undefined explícito apagaria o default no merge)', () => {
  const out = M.converterPropostaLegado(AMOSTRA_ESCADA.dj, AMOSTRA_ESCADA.titulo);
  const checarSemUndef = (obj, caminho) => {
    Object.entries(obj).forEach(([k, v]) => {
      assert.notEqual(v, undefined, `${caminho}.${k} não deveria ser undefined`);
      if (v && typeof v === 'object' && !Array.isArray(v)) checarSemUndef(v, `${caminho}.${k}`);
    });
  };
  checarSemUndef(out.escada, 'escada');
});

test('converterPropostaLegado — elevador: unidade + acabamentos + responsabilidades (split por linha)', () => {
  const dj = {
    number: '378',
    elevatorClient: { name: 'Cliente Elevador', cnpj: '', city: 'São Paulo', state: 'SP' },
    elevatorWork: { projectName: 'Obra Elevador' },
    elevatorUnits: [{ name: 'E1', model: 'VP-P', buildingType: 'Comercial', quantity: 1, speed: '1.0 m/s', stops: '10' }],
    elevatorProducts: [{ title: 'Elevador de Passageiros VPELEV VP-P' }],
    finishes: { floor: 'Mármore', cabinModel: 'Inox' },
    terms: { sellerResp: 'A. Entrega\nB. Montagem', buyerResp: 'A. Poço', warranty: 'Garantia elevador', general: 'Condições gerais' },
    financials: { paymentTerms: 'Pagto negociado', taxIncluded: 'Impostos inclusos' },
  };
  const out = M.converterPropostaLegado(dj, 'Cliente Elevador - Elevador');
  assert.ok(out.elevador);
  assert.equal(out.cliente.nome, 'Cliente Elevador');
  assert.equal(out.elevador.especificacoes[0].modelo, 'VP-P');
  assert.equal(out.elevador.acabamentos.pisoCabina, 'Mármore');
  assert.deepEqual(out.elevador.responsabilidades.vendedor, ['A. Entrega', 'B. Montagem']);
});

test('converterPropostaLegado — esteira: usa largPallet (não largDegrau) e desnivelComp', () => {
  const dj = {
    number: '25',
    walkwayClient: { name: 'Cliente Esteira' },
    walkwayWork: { projectName: 'Obra Esteira' },
    walkwayUnits: [{ name: 'Esteira 1', rise: '4500mm', palletWidth: '1000mm', quantity: 1, speed: '0.5 m/s' }],
  };
  const out = M.converterPropostaLegado(dj, 'Cliente Esteira - Esteira Rolante');
  assert.ok(out.esteira);
  assert.equal(out.esteira.especificacoes[0].largPallet, '1000mm');
  assert.equal(out.esteira.especificacoes[0].largDegrau, undefined);
  assert.equal(out.esteira.especificacoes[0].desnivelComp, '4500');
});

test('converterPropostaLegado — nenhuma unidade em nenhum equipamento: só recupera o nome do cliente pelo título', () => {
  const out = M.converterPropostaLegado({ number: '1', client: {} }, 'Cliente Sem Unidade - Elevador');
  assert.equal(out.cliente.nome, 'Cliente Sem Unidade');
  assert.equal(out.elevador, undefined);
  assert.equal(out.escada, undefined);
  assert.equal(out.esteira, undefined);
});
