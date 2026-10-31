'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./dashboard-metrics-perfis.js');
const M = window.PerfisMetrics;

test('Comercial — leads e propostas assinadas respeitam o período; aguardando é estado; meta vem de fora com padrão 25', () => {
  const desde = new Date('2026-10-01T00:00:00Z');
  const r = M.comercial({
    leads: [{ created_at: '2026-10-10T00:00:00Z' }, { created_at: '2026-08-10T00:00:00Z' }],
    propostas: [{ status: 'enviada' }, { status: 'visualizada' }, { status: 'rascunho' }, { status: 'aprovada', aprovada_em: '2026-10-05T00:00:00Z' }, { status: 'aprovada', aprovada_em: '2026-07-05T00:00:00Z' }],
    desde, periodoRotulo: 'últimos 30 dias', convPct: 30, metaConversao: null,
  });
  assert.equal(r.leadsNovos.value, '1');
  assert.equal(r.aguardando.value, '2');
  assert.equal(r.assinadas.value, '1');
  assert.equal(r.conversao.sub, 'meta 25%');
  assert.equal(r.conversao.deltaDir, 'up');
  assert.equal(M.comercial({ leads: [], propostas: [], convPct: 30, metaConversao: 40 }).conversao.deltaDir, 'down');
});

test('Financeiro — sinais só de proposta aprovada, avais de pagamento por cotação, parcelas só de contrato assinado, comissões escondidas se tabela vazia', () => {
  const r = M.financeiro({
    propostas: [{ status: 'aprovada', numero_cotacao: 955 }, { status: 'aprovada', numero_cotacao: 956 }, { status: 'enviada', numero_cotacao: 957 }],
    avais: [{ numero_cotacao: 955, sinal_pago: false, status: 'pendente' }, { numero_cotacao: 956, sinal_pago: true }, { numero_cotacao: 957, sinal_pago: false }],
    gatilhos: [{ evento_key: 'AVAL_PAGAMENTO', numero_cotacao: 955, status: 'pendente', due_date: '2026-01-01' }, { evento_key: 'AVAL_PAGAMENTO', numero_cotacao: 956, status: 'ok' }, { evento_key: 'FORMULARIO', status: 'pendente', due_date: '2099-01-01', numero_cotacao: 1 }],
    parcelas: [{ contrato_id: 'a', liberada: true, status: 'pendente', valor: 1000 }, { contrato_id: 'b', liberada: true, status: 'pendente', valor: 500 }, { contrato_id: 'a', liberada: true, status: 'paga', valor: 9 }],
    contratosInstalador: [{ id: 'a', status: 'assinado' }, { id: 'b', status: 'enviado' }],
    comissoes: [], agora: new Date('2026-10-31T00:00:00Z'),
  });
  assert.equal(r.sinais.value, '1');
  assert.equal(r.avaisPagamento.value, '1');
  assert.equal(r.vencidas.value, '1');
  assert.equal(r.parcelasInstalador.value, '1');
  assert.equal(r.comissoes, null);
});

test('Engenharia — dado que não carregou vira "—", nunca zero', () => {
  const r = M.engenharia({ aguardandoProjeto: 2, achados: null, obras: [{ status_master: 'Instalação' }, { status_master: 'Entregue' }], solicitacoes: [{ status: 'convertido_em_ficha' }, { status: 'em_analise' }] });
  assert.equal(r.projetosAguardando.value, '2');
  assert.equal(r.conferir.value, '—');
  assert.equal(r.obrasInstalacao.value, '1');
  assert.equal(r.solicitacoes.value, '1');
  assert.equal(M.engenharia({ achados: [{ serie: 'A' }, { serie: 'A' }, { serie: 'B' }] }).conferir.value, '2');
});

test('Logística — fora do SLA, OP atrasada sem produto ignorada, fila sem acesso = "—"', () => {
  const r = M.logistica({
    fila: { sla_min: 240, pedidos: [{ status: 'livre', decorrido_min: 300 }, { status: 'em_separacao', decorrido_min: 10 }, { status: 'separado', decorrido_min: 999 }] },
    ops: [{ produto: 'X', status: 'aguardando', prazo_entrega: '2020-01-01' }, { produto: null, status: 'aguardando', prazo_entrega: '2020-01-01' }, { produto: 'Y', status: 'aguardando', prazo_entrega: '2999-01-01' }],
    expedicoes: [{ status: 'aguardando' }], ajustes: [],
  });
  assert.equal(r.pedidosASeparar.value, '2');
  assert.match(r.pedidosASeparar.sub, /^1 fora do SLA/);
  assert.equal(r.opsAtrasadas.value, '1');
  assert.equal(r.prontosExpedir.value, '1');
  assert.equal(r.ajustes.value, '0');
  assert.equal(M.logistica({ fila: null }).pedidosASeparar.value, '—');
});

test('Importação — chegadas só nos próximos 30 dias, arquivados fora', () => {
  const agora = new Date('2026-10-31T12:00:00Z');
  const r = M.importacao({
    embarquesImp: [{ eta_atual: '2026-11-10' }, { eta_atual: '2026-12-31' }, { eta_atual: '2026-10-01' }, { eta_santos: '2026-11-20', arquivado: true }],
    lotes: [{ status: 'em_cotacao' }], avaisJuridicos: [{ status: 'pendente' }, { status: 'aprovado' }], diaD: 31, agora,
  });
  assert.equal(r.chegadas.value, '1');
  assert.equal(r.lotes.value, '1');
  assert.equal(r.avaisJuridicos.value, '1');
  assert.equal(r.diaD.value, '31');
});

test('Decisões aguardando você — pela lista de aprovadores ou o aprovador esperado, só pendentes', () => {
  const d = [
    { status: 'pendente', aprovador_esperado_email: 'diego@x.com', aprovadores_esperados: ['diego@x.com', 'Gelson@x.com'] },
    { status: 'pendente', aprovador_esperado_email: 'outro@x.com', aprovadores_esperados: ['outro@x.com'] },
    { status: 'aprovada', aprovador_esperado_email: 'gelson@x.com' },
  ];
  assert.equal(M.decisoesDoUsuario(d, 'gelson@x.com'), 1);
  assert.equal(M.decisoesDoUsuario(d, ''), null);
});
