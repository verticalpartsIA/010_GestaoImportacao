const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-aumento-calc.js'), 'utf8'))(global.window);
  return global.window.PropostaAumento;
}

const AGORA = '2026-11-06T12:00:00.000Z';

test('validarPedido: aceita só valor maior que o atual', () => {
  const A = carregar();
  const ok = A.validarPedido('217501,04', '232501,04');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.variacaoRs, 15000);
  assert.ok(Math.abs(ok.variacaoPct - 15000 / 217501.04) < 1e-9);
  assert.strictEqual(A.validarPedido(217501.04, 217501.04).ok, false);
  const menor = A.validarPedido(217501.04, 200000);
  assert.strictEqual(menor.ok, false);
  assert.match(menor.erro, /desconto/i);
  assert.strictEqual(A.validarPedido(100, '').ok, false);
});

test('solicitar: abre o pedido, guarda o histórico e não muda o preço do item', () => {
  const A = carregar();
  const item = { id: 'VPEL-EL1009-1', valorUnit: '217501' };
  const novo = A.solicitar(item, { valorAtual: 217501.04, valorPedido: 232501.04, motivo: 'cliente aceita pagar mais', por: 'regiane.rocha@verticalparts.com.br', agora: AGORA });
  assert.strictEqual(novo.valorUnit, '217501');
  assert.strictEqual(novo.aumentoPendente.valorPedido, 232501.04);
  assert.strictEqual(novo.aumentoLog.length, 1);
  assert.strictEqual(novo.aumentoLog[0].acao, 'solicitado');
  assert.strictEqual(item.aumentoPendente, undefined, 'não muta o original');
});

test('solicitar: um pedido por vez, sem desconto pendente, sem oculto e sem contrato assinado', () => {
  const A = carregar();
  const base = { valorAtual: 100, valorPedido: 120, por: 'a@b.c', agora: AGORA };
  const aberto = A.solicitar({ id: 'x' }, base);
  assert.throws(() => A.solicitar(aberto, base), /aguardando o Financeiro/);
  assert.throws(() => A.solicitar({ descontoPendente: {} }, base), /desconto/);
  assert.throws(() => A.solicitar({ oculto: true }, base), /oculto/);
  assert.throws(() => A.solicitar({ id: 'x' }, base, { contratoAssinado: true }), /contrato assinado/);
  assert.throws(() => A.solicitar({ id: 'x' }, base, { outroNivelPendente: true }), /outro pedido/);
});

test('proposta travada não bloqueia o pedido (o bloqueio não olha o status da proposta)', () => {
  const A = carregar();
  assert.strictEqual(A.bloqueio({ id: 'x' }, { statusProposta: 'aprovada' }), null);
});

test('cancelar: limpa o pedido e registra no histórico', () => {
  const A = carregar();
  const aberto = A.solicitar({ id: 'x' }, { valorAtual: 100, valorPedido: 120, por: 'a@b.c', agora: AGORA });
  const c = A.cancelar(aberto, 'a@b.c', AGORA);
  assert.strictEqual(c.aumentoPendente, null);
  assert.deepStrictEqual(c.aumentoLog.map((l) => l.acao), ['solicitado', 'cancelado']);
  assert.throws(() => A.cancelar(c, 'a@b.c', AGORA), /Não há pedido/);
});

test('atender: só quando o preço da Precificação mudou de verdade', () => {
  const A = carregar();
  const aberto = A.solicitar({ id: 'x' }, { valorAtual: 217501.04, valorPedido: 232501.04, por: 'a@b.c', agora: AGORA });
  const igual = A.atender(aberto, 217501.04, 'juliana@verticalparts.com.br', AGORA);
  assert.strictEqual(igual.atendido, false);
  assert.ok(igual.alvo.aumentoPendente, 'continua aberto');
  const mudou = A.atender(aberto, 230000, 'juliana@verticalparts.com.br', AGORA);
  assert.strictEqual(mudou.atendido, true);
  assert.strictEqual(mudou.alvo.aumentoPendente, null);
  assert.strictEqual(mudou.valorNovo, 230000);
  const ultimo = mudou.alvo.aumentoLog[mudou.alvo.aumentoLog.length - 1];
  assert.deepStrictEqual([ultimo.acao, ultimo.valorAnterior, ultimo.valorNovo], ['atendido', 217501.04, 230000]);
});

test('destinatarios: junta Financeiro, gestores e dono sem repetir', () => {
  const A = carregar();
  const d = A.destinatarios({
    financeiro: ['Juliana@verticalparts.com.br'],
    gestores: ['regiane.rocha@verticalparts.com.br'],
    dono: 'regiane.rocha@verticalparts.com.br',
  });
  assert.deepStrictEqual(d, ['juliana@verticalparts.com.br', 'regiane.rocha@verticalparts.com.br']);
  assert.deepStrictEqual(A.destinatarios({ dono: 'sem-email' }), []);
});

test('pendentesDaProposta: enxerga pedido da proposta e dos equipamentos', () => {
  const A = carregar();
  const p = A.pendentesDaProposta({ aumentoPendente: { valorPedido: 1 } }, [{ id: 'a' }, { id: 'b', aumentoPendente: { valorPedido: 2 } }]);
  assert.deepStrictEqual(p.map((x) => x.nivel), ['proposta', 'equipamento']);
});

test('migrarAposHerdar: leva o histórico ao item novo e fecha só o pedido atendido', () => {
  const A = carregar();
  const a1 = A.solicitar({ id: 'E1', valorUnit: '100000' }, { valorAtual: 100000, valorPedido: 120000, por: 'r@x.c', agora: AGORA });
  const a2 = A.solicitar({ id: 'E2', valorUnit: '50000' }, { valorAtual: 50000, valorPedido: 60000, por: 'r@x.c', agora: AGORA });
  const novos = [{ id: 'E1', valorUnit: '118000' }, { id: 'E2', valorUnit: '50000' }, { id: 'E3', valorUnit: '10' }];
  const r = A.migrarAposHerdar([a1, a2], novos, 'juliana@x.c', AGORA);
  const e1 = r.itens.find((i) => i.id === 'E1');
  const e2 = r.itens.find((i) => i.id === 'E2');
  assert.strictEqual(e1.aumentoPendente, null);
  assert.strictEqual(e1.aumentoLog[e1.aumentoLog.length - 1].acao, 'atendido');
  assert.ok(e2.aumentoPendente, 'preço não mudou: continua aguardando');
  assert.strictEqual(r.itens.find((i) => i.id === 'E3').aumentoLog, undefined);
  assert.deepStrictEqual(r.atendidos.map((x) => [x.id, x.valorNovo]), [['E1', 118000]]);
});

test('montarAviso: título leva o cliente e o alvo (o gi-avisos agrupa por título)', () => {
  const A = carregar();
  const ida = A.montarAviso('ida', { cliente: 'CONCESSIONARIA DO AEROPORTO', equipamento: 'VPEL-EL1009-1', valorAtual: 217501.04, valorPedido: 232501.04, por: 'Regiane', numeroCotacao: 1009 });
  assert.match(ida.titulo, /CONCESSIONARIA DO AEROPORTO/);
  assert.match(ida.titulo, /VPEL-EL1009-1/);
  assert.match(ida.sub, /217\.501,04/);
  assert.match(ida.sub, /232\.501,04/);
  assert.ok(ida.sub.length <= 330, 'cabe no limite do gi-avisos');
  const volta = A.montarAviso('volta', { cliente: 'X', valorAnterior: 1, valorNovo: 2, valorPedido: 3 });
  assert.match(volta.sub, /Herdar Dados/);
  const contrato = A.montarAviso('contrato', { cliente: 'X', numeroCotacao: 1009, valorAnterior: 1, valorNovo: 2 });
  assert.match(contrato.titulo, /refeito/);
});
