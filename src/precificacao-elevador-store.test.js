'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./precificacao-elevador-store.js');
const { parseContainerNo, classificarMaoDeObraUnidade, buscarMaoDeObraAutomatica, acrescentarEquipamento, removerEquipamento, restaurarEquipamentoMO, criar } = window.PrecificacaoElevadorStore;

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

test('buscarMaoDeObraAutomatica — cotação com 1 equipamento é sempre o -1 (ponto final), sem sufixo', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(9999);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'u2', identificador: 'VPEL-EL0958-2', tracao: '2:1', capacidadeKg: 800, paradas: 4, quantidade: 1 },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].identificador, 'VPEL-EL0958-1');
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

test('buscarMaoDeObraAutomatica — 21 equipamentos (cotação Nº 957 real): códigos corridos 1..21, sem repetir e sem sufixo aninhado', async () => {
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
    assert.deepEqual(out.map((o) => o.identificador), Array.from({ length: 21 }, (_, i) => `VPEL-EL0957-${i + 1}`));
    // tudo igual (paradas e capacidade): desempata a ordem original (antiguidade)
    assert.deepEqual(out.slice(0, 6).map((o) => o.unidadeId), ['u1', 'u1', 'u1', 'u1', 'u1', 'u1']);
    assert.equal(out[20].unidadeId, 'u9');
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

// Regra do usuário (10/10, cotação Nº 963: 27 equipamentos agrupados em 10 linhas):
// códigos corridos 1..N, da MENOR para a MAIOR quantidade de paradas; empate de
// paradas → menor capacidade fica com o código mais baixo; nunca "-1-2"/"-1-1".
test('buscarMaoDeObraAutomatica — explode e numera 1..N por paradas (menor → maior), desempate por capacidade', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(1000);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'a', identificador: 'VPEL-EL0963-1', tracao: '2:1', capacidadeKg: 1050, paradas: 9, quantidade: 2 },
      { unidadeId: 'b', identificador: 'VPEL-EL0963-2', tracao: '2:1', capacidadeKg: 560, paradas: 10, quantidade: 1 },
      { unidadeId: 'c', identificador: 'VPEL-EL0963-3', tracao: '2:1', capacidadeKg: 840, paradas: 6, quantidade: 2 },
      { unidadeId: 'd', identificador: 'VPEL-EL0963-4', tracao: '2:1', capacidadeKg: 420, paradas: 6, quantidade: 1 },
    ]);
    assert.equal(out.length, 6);
    // 6 paradas: d (420 kg) antes de c (840 kg); depois 9 paradas (a ×2); depois 10 (b)
    assert.deepEqual(out.map((o) => o.unidadeId), ['d', 'c', 'c', 'a', 'a', 'b']);
    assert.deepEqual(out.map((o) => o.identificador), [1, 2, 3, 4, 5, 6].map((n) => `VPEL-EL0963-${n}`));
    out.forEach((o) => assert.doesNotMatch(o.identificador, /-\d+-\d+$/, 'nunca sufixo aninhado'));
  } finally {
    window.CadastroCustosStore = antigo;
  }
});

test('buscarMaoDeObraAutomatica — cotação sem explosão (1 equipamento por Unidade) mantém os códigos reais das Unidades', async () => {
  const antigo = window.CadastroCustosStore;
  window.CadastroCustosStore = stubCadastroCustos(1000);
  try {
    const out = await buscarMaoDeObraAutomatica([
      { unidadeId: 'a', identificador: 'VPEL-EL0970-1', tracao: '2:1', capacidadeKg: 800, paradas: 9, quantidade: 1 },
      { unidadeId: 'b', identificador: 'VPEL-EL0970-2', tracao: '2:1', capacidadeKg: 800, paradas: 3, quantidade: 1 },
    ]);
    assert.deepEqual(out.map((o) => o.identificador), ['VPEL-EL0970-1', 'VPEL-EL0970-2']);
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

/* ---------- Containers: capatazia herdada + aviso de divergência (01/10/2026) ---------- */
const { enriquecerContainersComCusto, divergenciasContainerComCadastro } = window.PrecificacaoElevadorStore;
const CUSTOS_CONT = [
  { tipo: '20GP (Padrão)', ativo: true, preco_rs: 31243.2, capatazia_rs: 6000 },
  { tipo: '40HC (High Cube)', ativo: true, preco_rs: 36450.4, capatazia_rs: null },
];

test('enriquecerContainersComCusto — herda preço e capatazia do cadastro quando a linha não tem valor', () => {
  const [ct] = enriquecerContainersComCusto([{ tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 0 }], CUSTOS_CONT);
  assert.equal(ct.preco_rs, 31243.2);
  assert.equal(ct.capatazia_rs, 6000);
});

test('enriquecerContainersComCusto — nunca sobrescreve valor já digitado (preço nem capatazia)', () => {
  const [ct] = enriquecerContainersComCusto([{ tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 30000, capatazia_rs: 5000 }], CUSTOS_CONT);
  assert.equal(ct.preco_rs, 30000);
  assert.equal(ct.capatazia_rs, 5000);
});

test('enriquecerContainersComCusto — cadastro sem capatazia não cria capatazia; tipo sem mapeamento fica intacto', () => {
  const [a, b] = enriquecerContainersComCusto([{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 0 }, { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 }], CUSTOS_CONT);
  assert.equal(a.preco_rs, 36450.4);
  assert.equal(a.capatazia_rs, undefined);
  assert.deepEqual(b, { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 });
});

test('divergenciasContainerComCadastro — avisa quando preço/capatazia diferem do cadastro, só com os dois lados preenchidos', () => {
  const div = divergenciasContainerComCadastro([
    { tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 36450.4, capatazia_rs: 6000 },   // preço diverge, capatazia igual
    { tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 36450.4, capatazia_rs: 100 },    // cadastro sem capatazia → não compara
    { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 1 },                              // sem mapeamento → não compara
  ], CUSTOS_CONT);
  assert.equal(div.length, 1);
  assert.deepEqual({ i: div[0].indice, campo: div[0].campo, atual: div[0].atual, cadastro: div[0].cadastro }, { i: 0, campo: 'preco_rs', atual: 36450.4, cadastro: 31243.2 });
});

test('GRI — herda do cadastro só em linha vazia e entra no aviso de divergência', () => {
  const custos = [{ tipo: '40HC (High Cube)', ativo: true, preco_rs: 36450.4, capatazia_rs: 6559.42, gri_rs: 2000 }];
  const [herdado] = enriquecerContainersComCusto([{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 0 }], custos);
  assert.equal(herdado.gri_rs, 2000);
  const [manual] = enriquecerContainersComCusto([{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 1, gri_rs: 1500 }], custos);
  assert.equal(manual.gri_rs, 1500, 'nunca sobrescreve valor digitado');
  const div = divergenciasContainerComCadastro([{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 36450.4, gri_rs: 1500 }], custos);
  assert.deepEqual(div.map((d) => [d.campo, d.atual, d.cadastro]), [['gri_rs', 1500, 2000]]);
});

/* ============================================================
   criar() — cada revisão do fornecedor ganha numero_documento próprio
   (22/10, achado real: cotação 990 virou revisão B, "VPPC-0990" já
   existia pra original e o Financeiro não conseguia abrir precificação nova)
   ============================================================ */

/* Fake de window.__VP_SB.sb cobrindo a cadeia inteira de criar()/montarRascunho()
   pro caso mais simples (sem unidades/custos — só o que o teste precisa exercitar:
   numeração). `insercoesQuePodemFalhar` simula colisão de numero_documento (23505)
   nas primeiras N tentativas de insert em precificacoes_elevador. */
function makeFakeSbCriar({ revisaoCotacao, insercoesQuePodemFalhar = 0, existentePzNaColisao = null } = {}) {
  let tentativasInsert = 0;
  const inseridos = [];
  return {
    from(tabela) {
      return {
        select(cols) {
          return {
            eq(col, _val) {
              const single = async () => {
                if (tabela === 'formularios_elevador') return { data: { numero_cotacao: 990 }, error: null };
                if (tabela === 'cotacoes_elevador_fornecedor') {
                  return { data: { dados_envio: { unidades: [] }, respostas: { itens: [] }, cambio_na_resposta_usd_brl: null, revisao: revisaoCotacao }, error: null };
                }
                if (tabela === 'parametros_fiscais_elevador') {
                  return { data: { mark_up_padrao_pct: 0.405, mark_up_padrao_expresso_pct: 0.381, margem_minima_pct: 0.2, comissao_vendedor_pct: 0, comissao_indicacao_pct: 0 }, error: null };
                }
                return { data: null, error: null };
              };
              const maybeSingle = async () => {
                if (tabela === 'cotacoes_elevador_fornecedor' && cols === 'revisao') return { data: { revisao: revisaoCotacao }, error: null };
                // busca de "existente" na colisão (criar()'s retry loop) — select('*').eq(cotacao_fornecedor_id/formulario_elevador_id, ...)
                if (tabela === 'precificacoes_elevador' && cols === '*' && (col === 'cotacao_fornecedor_id' || col === 'formulario_elevador_id')) {
                  return { data: existentePzNaColisao, error: null };
                }
                return (await single());
              };
              // encadeia .is()/.order()/.limit() (busca de "existente") sem mudar o resultado final
              const chain = { single, maybeSingle, is: () => chain, order: () => chain, limit: () => chain };
              return chain;
            },
          };
        },
        insert(obj) {
          return {
            select() {
              return {
                single: async () => {
                  if (tabela !== 'precificacoes_elevador') return { data: obj, error: null };
                  tentativasInsert += 1;
                  if (tentativasInsert <= insercoesQuePodemFalhar) return { data: null, error: { code: '23505', message: 'duplicate key' } };
                  inseridos.push(obj);
                  return { data: { id: 'pz-' + tentativasInsert, ...obj }, error: null };
                },
              };
            },
          };
        },
      };
    },
    _inseridos: () => inseridos,
    _tentativas: () => tentativasInsert,
  };
}

test('criar(): com cotação do fornecedor já na revisão B, nasce VPPC-0990-B (não colide com a original)', async () => {
  const fake = makeFakeSbCriar({ revisaoCotacao: 'B' });
  window.__VP_SB = { sb: fake };
  const pz = await criar('FORM-1', 'COT-B');
  assert.equal(pz.numero_documento, 'VPPC-0990-B');
  assert.equal(fake._tentativas(), 1, 'sem colisão, grava na 1ª tentativa');
});

test('criar(): colisão de verdade com OUTRA cotação (sem registro já criado pra esta) tenta a próxima letra livre', async () => {
  const fake = makeFakeSbCriar({ revisaoCotacao: 'B', insercoesQuePodemFalhar: 1, existentePzNaColisao: null });
  window.__VP_SB = { sb: fake };
  const pz = await criar('FORM-1', 'COT-B');
  assert.equal(pz.numero_documento, 'VPPC-0990-C', 'colidiu em B, repetiu com a próxima letra (C)');
  assert.equal(fake._tentativas(), 2);
});

test('criar(): corrida real (2 cliques simultâneos) — reaproveita a precificação que o 1º clique já criou, não duplica', async () => {
  const jaCriada = { id: 'pz-existente', numero_documento: 'VPPC-0990-B', cotacao_fornecedor_id: 'COT-B' };
  const fake = makeFakeSbCriar({ revisaoCotacao: 'B', insercoesQuePodemFalhar: 1, existentePzNaColisao: jaCriada });
  window.__VP_SB = { sb: fake };
  const pz = await criar('FORM-1', 'COT-B');
  assert.equal(pz.id, 'pz-existente', 'devolve a precificação já criada pela OUTRA chamada, não cria uma 2ª');
  assert.equal(fake._inseridos().length, 0, 'nenhum insert vingou — a 1ª colidiu, a checagem de existente achou a da corrida e parou ali');
});

test('criar(): sem revisão na cotação do fornecedor (original), número sai igual a antes (sem sufixo)', async () => {
  const fake = makeFakeSbCriar({ revisaoCotacao: null });
  window.__VP_SB = { sb: fake };
  const pz = await criar('FORM-1', 'COT-ORIGINAL');
  assert.equal(pz.numero_documento, 'VPPC-0990');
});

/* ---------- Containers por ID-TAG (06/11/2026): o Financeiro cita o ID-TAG + quantidade ---------- */
const PZS = window.PrecificacaoElevadorStore;
const CUSTOS_TAG = [
  { id_tag: 'CONT-001', tipo: '20HC (High Cube)', porto: 'Santos', ativo: true, preco_rs: 24138.45, capatazia_rs: 1877.3, gri_rs: 0, taxa_porto_rs: null },
  { id_tag: 'CONT-002', tipo: '40HC (High Cube)', porto: 'Santos', ativo: true, preco_rs: 26820.5, capatazia_rs: 1877.3, gri_rs: 0, taxa_porto_rs: 1341 },
  { id_tag: 'CONT-003', tipo: '40HC (High Cube)', porto: 'Itajaí', ativo: true, preco_rs: 27900, capatazia_rs: 1600, gri_rs: 100, taxa_porto_rs: 900 },
  { id_tag: 'CONT-004', tipo: 'Tank (Cisterna)', porto: 'Santos', ativo: true, preco_rs: 50000, capatazia_rs: 0, gri_rs: 0, taxa_porto_rs: 0 },
];

test('isoDoTipoCustos — nome do cadastro vira o código ISO que o Embarque lê; sem equivalente vira "Outro"', () => {
  assert.equal(PZS.isoDoTipoCustos('40HC (High Cube)'), "40'HC");
  assert.equal(PZS.isoDoTipoCustos('20GP (Padrão)'), "20'DV");
  assert.equal(PZS.isoDoTipoCustos('Tank (Cisterna)'), 'Outro');
  assert.equal(PZS.isoDoTipoCustos(undefined), 'Outro');
});

test('aplicarIdTagNaLinha — puxa tipo ISO, porto e os 4 valores; mantém a quantidade; não muta a linha', () => {
  const linha = { tipo_tamanho: '', quantidade: 3, preco_rs: 0 };
  const out = PZS.aplicarIdTagNaLinha(linha, CUSTOS_TAG[2]);
  assert.deepEqual(out, { tipo_tamanho: "40'HC", quantidade: 3, id_tag: 'CONT-003', porto: 'Itajaí', preco_rs: 27900, capatazia_rs: 1600, gri_rs: 100, taxa_porto_rs: 900 });
  assert.deepEqual(linha, { tipo_tamanho: '', quantidade: 3, preco_rs: 0 });
  // mesmo tamanho em outro porto traz os valores do OUTRO ID-TAG (não "a primeira linha do tipo")
  assert.equal(PZS.aplicarIdTagNaLinha(linha, CUSTOS_TAG[1]).porto, 'Santos');
  assert.equal(PZS.aplicarIdTagNaLinha(linha, CUSTOS_TAG[1]).taxa_porto_rs, 1341);
  // valor ausente no cadastro vira 0 (taxa vazia não entra na conta)
  assert.equal(PZS.aplicarIdTagNaLinha(linha, CUSTOS_TAG[0]).taxa_porto_rs, 0);
  // tipo sem equivalente ISO fica 'Outro'
  assert.equal(PZS.aplicarIdTagNaLinha(linha, CUSTOS_TAG[3]).tipo_tamanho, 'Outro');
});

test('enriquecerContainersComCusto — linha com ID-TAG não é reaplicada por tipo (nem preenchida quando o valor é 0)', () => {
  const linha = { id_tag: 'CONT-001', tipo_tamanho: "20'HC", quantidade: 1, preco_rs: 0, capatazia_rs: 0 };
  const [out] = PZS.enriquecerContainersComCusto([linha], [{ tipo: '20HC (High Cube)', ativo: true, preco_rs: 99999, capatazia_rs: 500 }]);
  assert.equal(out.preco_rs, 0);
  assert.equal(out.capatazia_rs, 0);
  // linha SEM ID-TAG segue a regra de sempre (regra blindada)
  const [sem] = PZS.enriquecerContainersComCusto([{ tipo_tamanho: "20'HC", quantidade: 1, preco_rs: 0 }], [{ tipo: '20HC (High Cube)', ativo: true, preco_rs: 99999 }]);
  assert.equal(sem.preco_rs, 99999);
});

test('divergenciasContainerComCadastro — linha com ID-TAG compara com a PRÓPRIA linha do cadastro, inclusive a taxa de porto', () => {
  const linha = { id_tag: 'CONT-003', tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 27900, capatazia_rs: 1600, gri_rs: 100, taxa_porto_rs: 1000 };
  const div = PZS.divergenciasContainerComCadastro([linha], CUSTOS_TAG);
  assert.equal(div.length, 1);
  assert.equal(div[0].campo, 'taxa_porto_rs');
  assert.equal(div[0].cadastro, 900);
  // igual ao cadastro: sem aviso. (Compararia com CONT-002 se fosse "o primeiro 40'HC".)
  assert.deepEqual(PZS.divergenciasContainerComCadastro([{ ...linha, taxa_porto_rs: 900 }], CUSTOS_TAG), []);
});

test('linhaTemValorDiferenteDoIdTag — só valor > 0 que difere pede confirmação; vazio ou igual não', () => {
  const alvo = CUSTOS_TAG[2];
  assert.equal(PZS.linhaTemValorDiferenteDoIdTag({ preco_rs: 0, capatazia_rs: 0 }, alvo), false);
  assert.equal(PZS.linhaTemValorDiferenteDoIdTag({ preco_rs: 27900, capatazia_rs: 1600, gri_rs: 100, taxa_porto_rs: 900 }, alvo), false);
  assert.equal(PZS.linhaTemValorDiferenteDoIdTag({ preco_rs: 26820.5 }, alvo), true);
  assert.equal(PZS.linhaTemValorDiferenteDoIdTag({ taxa_porto_rs: 5 }, CUSTOS_TAG[0]), true);
});

/* ---------- DIFAL pendente barra a aprovação (07/11/2026; spec de 15/10/2026, pendência 3 de 5.2.10) ---------- */
test('difalPendente — só "falta informar se o cliente é contribuinte" é pendência; os outros avisos não bloqueiam', () => {
  const { difalPendente } = window.PrecificacaoElevadorStore;
  const MSG = 'Informe se o cliente é Contribuinte de ICMS para determinar o responsável pelo recolhimento do DIFAL.';
  assert.equal(difalPendente({ mensagem: MSG, contribuinte_icms: null }), true);
  assert.equal(difalPendente({ mensagem: MSG }), true);
  // contribuinte informado (sim ou não): não é pendência
  assert.equal(difalPendente({ mensagem: MSG, contribuinte_icms: true }), false);
  assert.equal(difalPendente({ mensagem: MSG, contribuinte_icms: false }), false);
  // outros avisos do motor continuam só avisos
  assert.equal(difalPendente({ mensagem: 'Informe a UF de entrega ou o UF do endereço do cliente para calcular o DIFAL.', contribuinte_icms: null }), false);
  assert.equal(difalPendente({ mensagem: 'Estado de destino (XX) não encontrado na tabela de referência do DIFAL.', contribuinte_icms: null }), false);
  assert.equal(difalPendente({ mensagem: 'Venda para comercialização (revenda) — tributada normalmente, sem incidência de DIFAL.', contribuinte_icms: null, alerta: 'Atenção: Não Contribuintes…' }), false);
  // sem DIFAL calculado (nunca calculou) ou lixo: não decide nada aqui (o aprovar já exige "Calcule antes")
  assert.equal(difalPendente(null), false);
  assert.equal(difalPendente(undefined), false);
  assert.equal(difalPendente('x'), false);
});

function linhaParaAprovar(difal, margemMinima) {
  return {
    id: 'pz-dif', status: 'calculado', numero_documento: 'VPPC-0001', numero_cotacao: 1,
    vmle_usd: 1000, tx_cambial: 5, modelos: [{ unidadeId: 'u1', quantidade: 1 }],
    itens_instalacao_montagem: [{ descricao: 'ART', valor: 100 }], comissao_vendedor_pct: 0.02, comissao_consultoria_pct: 0,
    parametros_fiscais_snapshot: { margem_minima_pct: margemMinima },
    resultado: { precificacao: { margemFinalPct: 0.3 } }, resultado_v2: { precificacao: { margemEfetivaPct: 0.3 } },
    difal,
  };
}

test('aprovar — DIFAL pendente recusa, com marca própria, e NÃO grava nada (nem com "aprovar mesmo assim")', async () => {
  const row = linhaParaAprovar({ mensagem: 'Informe se o cliente é Contribuinte de ICMS para determinar o responsável pelo recolhimento do DIFAL.', contribuinte_icms: null }, 0.15);
  const antigoSb = window.__VP_SB;
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    await assert.rejects(() => window.PrecificacaoElevadorStore.aprovar('pz-dif', { forcarAbaixoMinima: true }),
      (e) => e.difalPendente === true && /Contribuinte de ICMS/.test(e.message));
    assert.equal(row.status, 'calculado', 'a precificação continua não aprovada');
    assert.equal(row.aprovado_em, undefined);
  } finally { window.__VP_SB = antigoSb; }
});

test('aprovar — com o contribuinte informado o DIFAL deixa de bloquear (segue para as demais conferências)', async () => {
  // margem mínima acima da margem do resultado: se o DIFAL não bloqueasse, o erro seria o da margem (e não o do DIFAL)
  const row = linhaParaAprovar({ mensagem: 'DIFAL de R$ 1,00 é responsabilidade da VerticalParts.', contribuinte_icms: false }, 0.9);
  const antigoSb = window.__VP_SB;
  window.__VP_SB = { sb: makeFakeSb(row) };
  try {
    await assert.rejects(() => window.PrecificacaoElevadorStore.aprovar('pz-dif'),
      (e) => e.margemAbaixoMinima === true && !e.difalPendente);
    assert.equal(row.status, 'calculado');
  } finally { window.__VP_SB = antigoSb; }
});
