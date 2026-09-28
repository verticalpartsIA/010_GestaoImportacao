'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./precificacao-elevador-store.js');
const { parseContainerNo, classificarMaoDeObraUnidade, buscarMaoDeObraAutomatica, acrescentarEquipamento, removerEquipamento, restaurarEquipamentoMO } = window.PrecificacaoElevadorStore;

/* Fake mínimo de window.__VP_SB.sb — só o suficiente pra obter()/salvar()
   (select().eq().single() e update().eq()) contra uma "tabela" em memória. */
function makeFakeSb(row) {
  return {
    from() {
      return {
        select() { return { eq() { return { single: async () => ({ data: row, error: null }) }; } }; },
        update(patch) { return { eq: async () => { Object.assign(row, patch); return { error: null }; } }; },
      };
    },
  };
}

test('parseContainerNo — "1x40HC + 1x20GP" (resposta real da Glarie, VPCT-0950)', () => {
  const out = parseContainerNo('1x40HC + 1x20GP');
  assert.deepEqual(out, [
    { tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 0 },
    { tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 0 },
  ]);
});

test('parseContainerNo — vazio/nulo vira lista vazia', () => {
  assert.deepEqual(parseContainerNo(''), []);
  assert.deepEqual(parseContainerNo(null), []);
  assert.deepEqual(parseContainerNo(undefined), []);
});

test('parseContainerNo — texto sem padrão reconhecível vira "Outro"', () => {
  assert.deepEqual(parseContainerNo('a combinar com o despachante'), [
    { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 },
  ]);
});

test('parseContainerNo — quantidade > 1 e sufixo RF/OT/FR reconhecidos', () => {
  assert.deepEqual(parseContainerNo('2x40RF'), [{ tipo_tamanho: "40'RF", quantidade: 2, preco_rs: 0 }]);
});

/* ============================================================
   classificarMaoDeObraUnidade — busca automática de MO (Fase 3)
   ============================================================ */

test('classificarMaoDeObraUnidade — sem tração/paradas/capacidade vira pendente/manual (não é projeto especial)', () => {
  const out = classificarMaoDeObraUnidade({ unidadeId: 'E1', identificador: 'E1', tracao: '', capacidadeKg: null, paradas: '' }, null);
  assert.equal(out.origem, 'manual');
  assert.equal(out.situacao, 'pendente');
  assert.equal(out.projetoEspecial, false, 'faltar dado na Unidade não é a mesma coisa que estar fora da tabela');
  assert.equal(out.valorRs, 0);
});

test('classificarMaoDeObraUnidade — com tração/capacidade/paradas mas sem linha na tabela vira projeto especial', () => {
  // exemplo do documento de origem: 2:1, 43 paradas, 6.000kg — fora da cobertura real (paradas até 40, até 2000kg)
  const out = classificarMaoDeObraUnidade({ unidadeId: 'E1', identificador: 'E1', tracao: '2:1', capacidadeKg: 6000, paradas: 43 }, null);
  assert.equal(out.origem, 'tabela_referencia');
  assert.equal(out.situacao, 'pendente');
  assert.equal(out.projetoEspecial, true, 'config fora da tabela deve virar projeto especial, nunca preço confirmado automático');
  assert.equal(out.valorRs, 0);
  assert.match(out.motivo, /projeto especial/);
});

test('classificarMaoDeObraUnidade — achou na tabela vira confirmado, com regra/valor/data-base', () => {
  const custoTabela = {
    capacidade_min_kg: 400, capacidade_max_kg: 630, dias_montagem: 25, qtd_montadores: 2,
    valor_reajustado_rs: 11550, atualizado_em: '2026-08-28T10:00:00Z',
  };
  const out = classificarMaoDeObraUnidade({ unidadeId: 'E1', identificador: 'E1', tracao: '2:1', capacidadeKg: 400, paradas: 3 }, custoTabela);
  assert.equal(out.origem, 'tabela_referencia');
  assert.equal(out.situacao, 'confirmado');
  assert.equal(out.projetoEspecial, false);
  assert.equal(out.valorRs, 11550);
  assert.equal(out.diasMontagem, 25);
  assert.equal(out.qtdMontadores, 2);
  assert.equal(out.dataBase, '2026-08-28T10:00:00Z');
  assert.match(out.regraUsada, /2:1/);
  assert.match(out.regraUsada, /3 paradas/);
});

/* ============================================================
   buscarMaoDeObraAutomatica — expansão por quantidade (28/09)
   Unidade com quantidade > 1 = N elevadores idênticos, cada um com sua
   própria instalação — vira N linhas na tabela "Mão de obra — busca
   automática" (achado real: cotação Nº 955, quantidade=2, mostrava só 1).
   ============================================================ */

function stubCadastroCustos(valorRs) {
  return {
    async buscarCustoElevador() {
      return { capacidade_min_kg: 0, capacidade_max_kg: 2000, dias_montagem: 5, qtd_montadores: 2, valor_reajustado_rs: valorRs, atualizado_em: '2026-01-01' };
    },
  };
}

test('buscarMaoDeObraAutomatica — quantidade=2 numa única Unidade (cotação Nº 955 real) vira 2 linhas, sufixo contínuo -1/-2', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(12345);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'u1', identificador: 'VPEL-EL0955-1', tracao: '2:1', capacidadeKg: 1050, paradas: 3, quantidade: 2 },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((o) => o.identificador), ['VPEL-EL0955-1', 'VPEL-EL0955-2']);
    assert.equal(out.reduce((s, o) => s + o.valorRs, 0), 12345 * 2, 'cada equipamento físico soma seu próprio valor de MO');
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

test('buscarMaoDeObraAutomatica — quantidade=1 continua com o mesmo identificador, sem sufixo', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(9999);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'u2', identificador: 'VPEL-EL0958-2', tracao: '2:1', capacidadeKg: 800, paradas: 4, quantidade: 1 },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].identificador, 'VPEL-EL0958-2');
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

test('buscarMaoDeObraAutomatica — sufixo contínuo nunca colide com o identificador de outra Unidade real da mesma cotação (cotação Nº 957 real)', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(5000);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'u1', identificador: 'VPEL-EL0957-1', tracao: '2:1', capacidadeKg: 1050, paradas: 3, quantidade: 6 },
      { unidadeId: 'u4', identificador: 'VPEL-EL0957-4', tracao: '2:1', capacidadeKg: 1050, paradas: 3, quantidade: 6 },
      { unidadeId: 'u6', identificador: 'VPEL-EL0957-6', tracao: '2:1', capacidadeKg: 1050, paradas: 3, quantidade: 6 },
      { unidadeId: 'u9', identificador: 'VPEL-EL0957-9', tracao: '2:1', capacidadeKg: 1050, paradas: 3, quantidade: 3 },
    ]);
    assert.equal(out.length, 21);
    const identificadores = out.map((o) => o.identificador);
    const duplicados = identificadores.filter((v, i) => identificadores.indexOf(v) !== i);
    assert.deepEqual(duplicados, [], 'nenhum identificador pode se repetir entre Unidades físicas diferentes');
    // as próprias Unidades reais (1ª linha de cada grupo) preservam o identificador original intacto
    assert.equal(out.find((o) => o.unidadeId === 'u1').identificador, 'VPEL-EL0957-1');
    assert.equal(out.find((o) => o.unidadeId === 'u4').identificador, 'VPEL-EL0957-4');
    assert.equal(out.find((o) => o.unidadeId === 'u6').identificador, 'VPEL-EL0957-6');
    assert.equal(out.find((o) => o.unidadeId === 'u9').identificador, 'VPEL-EL0957-9');
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

/* ============================================================
   acrescentarEquipamento / removerEquipamento (28/09) — vendedor ajusta
   a quantidade cotada depois que a Proposta já foi enviada (cliente pede
   pra acrescentar ou remover equipamento). Nunca mexe na Unidade real do
   Formulário — só no snapshot pz.modelos desta Precificação.
   ============================================================ */

test('acrescentarEquipamento — modo "identico" incrementa a quantidade da Unidade existente', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(5000);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0999-1', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 1 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    const moLookup = await acrescentarEquipamento('pz1', { modo: 'identico', unidadeId: 'u1', quantidadeAdicional: 1 });
    assert.equal(row.modelos.length, 1, 'não cria uma nova entrada — só incrementa a existente');
    assert.equal(row.modelos[0].quantidade, 2);
    assert.equal(moLookup.length, 2);
    assert.deepEqual(moLookup.map((m) => m.identificador), ['VPEL-EL0999-1', 'VPEL-EL0999-2']);
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});

test('acrescentarEquipamento — modo "novo" cria equipamento avulso com specs próprias, sem tocar nas Unidades existentes', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(7000);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0999-1', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 1 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    const moLookup = await acrescentarEquipamento('pz1', { modo: 'novo', tracao: '4:1', capacidadeKg: 630, paradas: 5, quantidadeAdicional: 2 });
    assert.equal(row.modelos.length, 2);
    const novo = row.modelos[1];
    assert.equal(novo.avulso, true);
    assert.equal(novo.quantidade, 2);
    assert.ok(novo.unidadeId && novo.unidadeId !== 'u1', 'ganha um id sintético próprio, nunca reaproveita o de outra Unidade');
    assert.equal(row.modelos[0].quantidade, 1, 'Unidade existente não é alterada');
    assert.equal(moLookup.length, 3, '1 da Unidade original + 2 do equipamento avulso novo');
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});

test('buscarMaoDeObraAutomatica — moExcluidos exclui a Mão de obra do(s) último(s) equipamento(s) físico(s), sem mudar quantidade/identificadores', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(11550);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'u1', identificador: 'VPEL-EL0962-1', tracao: '2:1', capacidadeKg: 675, paradas: 4, quantidade: 1, moExcluidos: 1 },
    ]);
    assert.equal(out.length, 1, 'moExcluidos nunca remove a linha — só zera o valor');
    assert.equal(out[0].situacao, 'excluido');
    assert.equal(out[0].valorRs, 0);
    assert.equal(out[0].moExcluido, true);
    assert.match(out[0].motivo, /não é por conta da VerticalParts/);
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

// Achado real na cotação Nº 962: "Remover" (versão antiga) decrementava
// `quantidade` — o mesmo campo que a tabela "Unidades desta cotação"/VMLE
// e a Proposta usam como contagem real de equipamento vendido. Um
// equipamento inteiro (com seu custo de mercadoria) sumiu da cotação só
// porque o vendedor queria excluir a Mão de obra dele (instalação por
// conta de terceiro). Os 2 testes abaixo travam o comportamento correto.
test('removerEquipamento — NUNCA decrementa quantidade (achado real: cotação 962) — só exclui a MO daquele equipamento', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(3000);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0999-1', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 1, valorUnitarioUsd: 9040 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    const moLookup = await removerEquipamento('pz1', 'u1');
    assert.equal(row.modelos.length, 1, 'nunca remove a entrada — o equipamento continua na cotação/VMLE');
    assert.equal(row.modelos[0].quantidade, 1, 'quantidade jamais muda — só quem alimenta "Unidades desta cotação"/Proposta');
    assert.equal(row.modelos[0].valorUnitarioUsd, 9040, 'custo de mercadoria intacto');
    assert.equal(row.modelos[0].moExcluidos, 1);
    assert.equal(moLookup.length, 1);
    assert.equal(moLookup[0].situacao, 'excluido');
    assert.equal(moLookup[0].valorRs, 0);
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});

test('removerEquipamento — com quantidade > 1, exclui só 1 equipamento físico do grupo (os outros continuam confirmados)', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(3000);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0999-1', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 3 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    const moLookup = await removerEquipamento('pz1', 'u1');
    assert.equal(row.modelos[0].quantidade, 3, 'quantidade não muda');
    assert.equal(moLookup.length, 3, 'os 3 equipamentos físicos continuam na tabela');
    const excluidos = moLookup.filter((m) => m.situacao === 'excluido');
    const confirmados = moLookup.filter((m) => m.situacao === 'confirmado');
    assert.equal(excluidos.length, 1);
    assert.equal(confirmados.length, 2);
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});

test('removerEquipamento — recusa quando todos os equipamentos do grupo já estão excluídos', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(3000);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0999-1', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 1, moExcluidos: 1 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    await assert.rejects(() => removerEquipamento('pz1', 'u1'), /já estão com a Mão de obra excluída/);
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});

test('restaurarEquipamentoMO — desfaz a exclusão, devolvendo o equipamento pro cálculo normal', async () => {
  const antigoCustos = window.CadastroCustosStore;
  const antigoSb = window.__VP_SB;
  window.CadastroCustosStore = stubCadastroCustos(11550);
  const row = { id: 'pz1', modelos: [{ unidadeId: 'u1', identificador: 'VPEL-EL0962-1', tracao: '2:1', capacidadeKg: 675, paradas: 4, quantidade: 1, moExcluidos: 1 }] };
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    const moLookup = await restaurarEquipamentoMO('pz1', 'u1');
    assert.equal(row.modelos[0].moExcluidos, 0);
    assert.equal(moLookup[0].situacao, 'confirmado');
    assert.equal(moLookup[0].valorRs, 11550);
  } finally {
    window.CadastroCustosStore = antigoCustos;
    window.__VP_SB = antigoSb;
  }
});
