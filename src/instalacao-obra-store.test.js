'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};

/* Mock chainable estilo Supabase: .from(table).select(...).eq(...).order(...)
   .limit(...).single()/.maybeSingle() resolve via then() com o valor
   configurado por tabela em `byTable`. `byTable[table]` pode ser um objeto
   fixo {data,error} ou uma função (chamadaArgs) => {data,error} pra tabelas
   consultadas mais de uma vez com filtros diferentes num mesmo teste. */
function mockSb(byTable) {
  function chain(table) {
    const spec = byTable[table];
    const result = () => (typeof spec === 'function' ? spec() : (spec || { data: null }));
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      update: () => builder,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (resolve) => resolve(result()),
    };
    return builder;
  }
  return { from: chain };
}

window.__VP_SB = { sb: mockSb({}) };
require('./instalacao-obra-store.js');
const S = window.InstalacaoObraStore;

test('fmtBRL — formata número como moeda BRL', () => {
  assert.equal(S.fmtBRL(1234.5), 'R$ 1.234,50');
});

test('fmtBRL — valor inválido cai em zero', () => {
  assert.equal(S.fmtBRL(undefined), 'R$ 0,00');
  assert.equal(S.fmtBRL(null), 'R$ 0,00');
});

test('fmtData — formata data ISO em pt-BR', () => {
  assert.equal(S.fmtData('2026-08-20T12:00:00Z'), '20/08/2026');
});

test('fmtData — sem data retorna travessão', () => {
  assert.equal(S.fmtData(null), '—');
  assert.equal(S.fmtData(undefined), '—');
});

test('obterProgressoVistoria — sem dossierId retorna não liberada, sem fases', async () => {
  const r = await S.obterProgressoVistoria(null);
  assert.deepEqual(r, { fases: [], liberada: false });
});

test('obterProgressoVistoria — 3 de 3 fases concluídas libera', async () => {
  window.__VP_SB.sb = mockSb({
    vistorias_obras: { data: [
      { numero_fase: 1, status: 'concluida' },
      { numero_fase: 2, status: 'concluida' },
      { numero_fase: 3, status: 'concluida' },
    ] },
  });
  const r = await S.obterProgressoVistoria('D1');
  assert.equal(r.liberada, true);
  assert.equal(r.fases.length, 3);
  assert.ok(r.fases.every((f) => f.concluida));
});

test('obterProgressoVistoria — fase pendente não libera', async () => {
  window.__VP_SB.sb = mockSb({
    vistorias_obras: { data: [
      { numero_fase: 1, status: 'concluida' },
      { numero_fase: 2, status: 'pendente' },
    ] },
  });
  const r = await S.obterProgressoVistoria('D1');
  assert.equal(r.liberada, false);
  assert.deepEqual(r.fases.map((f) => f.concluida), [true, false, false]);
});

test('obterChecklistObraPronta — dossiê sem numero_cotacao interrompe cedo, sem checar os demais sinais', async () => {
  window.__VP_SB.sb = mockSb({
    dossier_obra: { data: { id: 'D1', numero_cotacao: null } },
  });
  const r = await S.obterChecklistObraPronta('D1');
  assert.equal(r.pronta, false);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].chave, 'sem_cotacao');
});

test('obterChecklistObraPronta — sem parceiro vinculado, item "parceiro" fica pendente e bloqueia pronta', async () => {
  window.__VP_SB.sb = mockSb({
    dossier_obra: { data: {
      id: 'D1', numero_cotacao: 'MC-1',
      equipamento_entregue: true, equipamento_entregue_em: '2026-08-01T00:00:00Z',
      andaime_munck_necessario: false,
      parceiro_instalador_id: null,
    } },
    propostas: { data: { id: 'PR-1' } },
    contratos_venda_equipamentos: { data: { signed_at: '2026-08-02T00:00:00Z' } },
    avais_financeiros: { data: { sinal_pago: true } },
    projetos_elevador: { data: { status: 'finalizado' } },
    vistorias_obras: { data: [
      { numero_fase: 1, status: 'concluida' },
      { numero_fase: 2, status: 'concluida' },
      { numero_fase: 3, status: 'concluida' },
    ] },
  });
  const r = await S.obterChecklistObraPronta('D1');
  assert.equal(r.pronta, false);
  const byKey = Object.fromEntries(r.itens.map((i) => [i.chave, i]));
  assert.equal(byKey.parceiro.ok, false);
  assert.equal(byKey.parceiro.detalhe, 'Nenhum parceiro vinculado');
  // sem parceiro_instalador_id, o item de RH nem entra na lista (é distinto
  // da homologação geral do parceiro — só existe quando há alguém vinculado)
  assert.ok(!r.itens.some((i) => i.chave === 'montador_rh'));
});

test('obterChecklistObraPronta — com parceiro homologado e liberado pelo RH, marca pronta', async () => {
  window.RHHomologacao = { statusGeral: () => 'ok' };
  window.DecisoesStore = { statusMontadorObra: async () => ({ status: 'aprovada', decidido_por: 'Fulano' }) };
  window.__VP_SB.sb = mockSb({
    dossier_obra: { data: {
      id: 'D1', numero_cotacao: 'MC-1',
      equipamento_entregue: true, equipamento_entregue_em: '2026-08-01T00:00:00Z',
      andaime_munck_necessario: false,
      parceiro_instalador_id: 'PARC-1',
    } },
    propostas: { data: { id: 'PR-1' } },
    contratos_venda_equipamentos: { data: { signed_at: '2026-08-02T00:00:00Z' } },
    avais_financeiros: { data: { sinal_pago: true } },
    projetos_elevador: { data: { status: 'finalizado' } },
    vistorias_obras: { data: [
      { numero_fase: 1, status: 'concluida' },
      { numero_fase: 2, status: 'concluida' },
      { numero_fase: 3, status: 'concluida' },
    ] },
    parceiros_instaladores: { data: { id: 'PARC-1', nome: 'Instaladora XP' } },
  });
  const r = await S.obterChecklistObraPronta('D1');
  assert.equal(r.pronta, true);
  assert.ok(r.itens.every((i) => i.ok));
  const byKey = Object.fromEntries(r.itens.map((i) => [i.chave, i]));
  assert.equal(byKey.montador_rh.detalhe, 'Liberado por Fulano');
  delete window.RHHomologacao;
  delete window.DecisoesStore;
});

test('obterChecklistObraPronta — contrato não assinado, sinal pendente e projeto não iniciado ficam pendentes', async () => {
  window.__VP_SB.sb = mockSb({
    dossier_obra: { data: {
      id: 'D1', numero_cotacao: 'MC-1',
      equipamento_entregue: false,
      andaime_munck_necessario: false,
      parceiro_instalador_id: null,
    } },
    propostas: { data: null },
    avais_financeiros: { data: null },
    projetos_elevador: { data: null },
    vistorias_obras: { data: [] },
  });
  const r = await S.obterChecklistObraPronta('D1');
  assert.equal(r.pronta, false);
  const byKey = Object.fromEntries(r.itens.map((i) => [i.chave, i]));
  assert.equal(byKey.contrato.ok, false);
  assert.equal(byKey.sinal.ok, false);
  assert.equal(byKey.projeto.ok, false);
  assert.equal(byKey.projeto.detalhe, 'Não iniciado');
  assert.equal(byKey.equipamento.ok, false);
  assert.equal(byKey.vistoria.detalhe, '0 de 3 fases concluídas');
});

test('obterChecklistObraPronta — andaime/munck só entra na conta quando necessário', async () => {
  window.__VP_SB.sb = mockSb({
    dossier_obra: { data: {
      id: 'D1', numero_cotacao: 'MC-1',
      equipamento_entregue: true, equipamento_entregue_em: '2026-08-01T00:00:00Z',
      andaime_munck_necessario: true, andaime_munck_providenciado: false,
      parceiro_instalador_id: null,
    } },
    propostas: { data: { id: 'PR-1' } },
    contratos_venda_equipamentos: { data: { signed_at: '2026-08-02T00:00:00Z' } },
    avais_financeiros: { data: { sinal_pago: true } },
    projetos_elevador: { data: { status: 'finalizado' } },
    vistorias_obras: { data: [
      { numero_fase: 1, status: 'concluida' },
      { numero_fase: 2, status: 'concluida' },
      { numero_fase: 3, status: 'concluida' },
    ] },
  });
  const r = await S.obterChecklistObraPronta('D1');
  const item = r.itens.find((i) => i.chave === 'andaime_munck');
  assert.ok(item);
  assert.equal(item.ok, false);
  assert.equal(r.pronta, false);
});

test('marcarEquipamentoEntregue — sem client lança erro', async () => {
  window.__VP_SB.sb = null;
  await assert.rejects(() => S.marcarEquipamentoEntregue('D1', true), /Supabase não carregado/);
  window.__VP_SB.sb = mockSb({});
});
