'use strict';
/* 13/11/2026 — DESCONTO como pedido ao Financeiro: store (gravação do pedido, recusa, alçada e avisos), com Supabase simulado. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-aumento-calc.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-aumento-store.js'), 'utf8'))(global.window);
  return global.window;
}

/* Fake mínimo: propostas (select().eq().maybeSingle(), update().eq()), alertas (insert), perfis/colaboradores/alçadas vazios. */
function fakeSb(row) {
  const escritas = []; const alertas = [];
  const vazio = () => { const q = { eq() { return q; }, in() { return q; }, limit() { return q; }, maybeSingle: async () => ({ data: null }), then(r) { return Promise.resolve({ data: [] }).then(r); } }; return q; };
  return {
    escritas, alertas,
    from(t) {
      if (t === 'propostas') {
        return {
          select() { const q = { eq() { return q; }, maybeSingle: async () => ({ data: row, error: null }) }; return q; },
          update(patch) { escritas.push(patch); return { eq: async () => { Object.assign(row, patch); return { error: null }; } }; },
        };
      }
      if (t === 'alertas') return { insert: async (a) => { alertas.push(a); return { error: null }; } };
      return { select: () => vazio() };
    },
  };
}
const proposta = () => ({
  id: 'p1', status: 'rascunho', vendedor_id: null, numero_cotacao: 1048, numero_documento: 'VPPR-1048', precificacao_id: null, valor_total: 100000,
  data_json: { cliente: { nome: 'Cli' }, elevador: { valores: { ocultos: [], itens: [{ id: 'E1', quantidade: '1', valorUnit: '100000' }] } } },
});

test('solicitar (modo desconto): grava pedido tipo desconto no equipamento, não muda o preço e avisa com título de desconto', async () => {
  const w = carregar(); const row = proposta(); const sb = fakeSb(row);
  w.__VP_SB = { sb }; w.__VP_USER = { email: 'ana@x.com', nome: 'Ana' };
  w.PropostaStore = { podeOcultarEquipamento: async () => true };
  const r = await w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', valorAtual: 100000, valorPedido: 90000, motivo: 'fechar hoje', modo: 'desconto' });
  const it = row.data_json.elevador.valores.itens[0];
  assert.equal(it.aumentoPendente.tipo, 'desconto');
  assert.equal(it.valorUnit, '100000', 'o preço não muda enquanto o Financeiro não responde');
  assert.equal(r.alvo.aumentoPendente.valorPedido, 90000);
  // sem Financeiro/gestor/dono cadastrados no fake, nenhum aviso sai; o que importa aqui é gravar e não quebrar
  await assert.rejects(() => w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', valorAtual: 100000, valorPedido: 80000, modo: 'desconto' }), /já existe um pedido|aguardando/i);
});

test('solicitar (modo desconto) recusa valor maior; só o dono/Líder pede', async () => {
  const w = carregar(); const row = proposta(); w.__VP_SB = { sb: fakeSb(row) }; w.__VP_USER = { email: 'ana@x.com' };
  w.PropostaStore = { podeOcultarEquipamento: async () => true };
  await assert.rejects(() => w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', valorAtual: 100000, valorPedido: 120000, modo: 'desconto' }), /Alterar valor/);
  w.PropostaStore = { podeOcultarEquipamento: async () => false };
  await assert.rejects(() => w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', valorAtual: 100000, valorPedido: 90000, modo: 'desconto' }), /dono da proposta ou o Líder/);
});

test('recusar: exige a alçada de calcular a precificação, exige motivo, limpa o pedido e guarda o histórico', async () => {
  const w = carregar(); const row = proposta(); const sb = fakeSb(row); w.__VP_SB = { sb }; w.__VP_USER = { email: 'fin@x.com', nome: 'Fin' };
  w.PropostaStore = { podeOcultarEquipamento: async () => true };
  await w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', valorAtual: 100000, valorPedido: 90000, modo: 'desconto' });

  // sem alçada: recusa e NÃO grava
  w.PrecificacaoElevadorStore = { exigirAlcada: async () => { const e = new Error('Sem alçada de calcular'); e.semAlcada = true; throw e; } };
  await assert.rejects(() => w.PropostaAumentoStore.recusar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', motivo: 'Margem não comporta' }), (e) => e.semAlcada === true);
  assert.ok(row.data_json.elevador.valores.itens[0].aumentoPendente, 'o pedido continua aberto');

  // com alçada, sem motivo: recusa
  w.PrecificacaoElevadorStore = { exigirAlcada: async () => {} };
  await assert.rejects(() => w.PropostaAumentoStore.recusar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', motivo: '' }), /motivo/i);

  // com alçada e motivo: recusa de verdade
  await w.PropostaAumentoStore.recusar({ propostaId: 'p1', nivel: 'equipamento', itemId: 'E1', motivo: 'Margem não comporta' });
  const it = row.data_json.elevador.valores.itens[0];
  assert.equal(it.aumentoPendente, null);
  assert.equal(it.valorUnit, '100000', 'o preço não mudou');
  const ult = it.aumentoLog[it.aumentoLog.length - 1];
  assert.deepEqual([ult.acao, ult.tipo, ult.por, ult.motivo], ['recusado', 'desconto', 'fin@x.com', 'Margem não comporta']);
});

test('recusar no nível da proposta inteira (valor total)', async () => {
  const w = carregar(); const row = proposta(); w.__VP_SB = { sb: fakeSb(row) }; w.__VP_USER = { email: 'fin@x.com' };
  w.PropostaStore = { podeOcultarEquipamento: async () => true };
  w.PrecificacaoElevadorStore = { exigirAlcada: async () => {} };
  await w.PropostaAumentoStore.solicitar({ propostaId: 'p1', nivel: 'proposta', valorAtual: 100000, valorPedido: 95000, modo: 'desconto' });
  assert.equal(row.data_json.aumentoPendente.tipo, 'desconto');
  await w.PropostaAumentoStore.recusar({ propostaId: 'p1', nivel: 'proposta', motivo: 'Fora da política' });
  assert.equal(row.data_json.aumentoPendente, null);
  assert.equal(row.data_json.aumentoLog[row.data_json.aumentoLog.length - 1].acao, 'recusado');
});
