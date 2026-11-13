const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-opcoes.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-aumento-calc.js'), 'utf8'))(global.window);
  return global.window.PropostaAumento;
}

const AGORA = '2026-11-06T12:00:00.000Z';

test('validarPedido: no modo aumento aceita só valor maior que o atual', () => {
  const A = carregar();
  const ok = A.validarPedido('217501,04', '232501,04', 'aumento');
  assert.strictEqual(ok.tipo, 'aumento');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.variacaoRs, 15000);
  assert.ok(Math.abs(ok.variacaoPct - 15000 / 217501.04) < 1e-9);
  assert.strictEqual(A.validarPedido(217501.04, 217501.04).ok, false);
  const menor = A.validarPedido(217501.04, 200000, 'aumento');
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

test('precificacaoMudou: compara com a BASE da Precificação, não com o valor da proposta (caso VPPR-0993)', () => {
  const A = carregar();
  // proposta defasada: valorAtual 243.045 mas a Precificação já valia 250.419,71 quando o pedido foi feito
  const p = A.solicitar({ id: 'E1' }, { valorAtual: 243045, valorPedido: 270424.79, por: 'r@x.c', agora: AGORA, precificacaoBase: 250419.71 });
  assert.strictEqual(p.aumentoPendente.precificacaoBase, 250419.71);
  assert.strictEqual(A.precificacaoMudou(p.aumentoPendente, 250419.71), false, 'Calcular sem mudar o preço não avisa');
  assert.strictEqual(A.precificacaoMudou(p.aumentoPendente, 262000), true);
});

test('baseDoPedido: pedido antigo usa o último valor já avisado, senão o da proposta', () => {
  const A = carregar();
  assert.strictEqual(A.baseDoPedido({ valorAtual: 100 }), 100);
  assert.strictEqual(A.baseDoPedido({ valorAtual: 100, precificacaoValor: 120 }), 120);
  assert.strictEqual(A.baseDoPedido({ valorAtual: 100, precificacaoValor: 120, precificacaoBase: 130 }), 130);
});

test('alvoTotal: total da proposta + diferenças pedidas; pedido da proposta inteira vale o próprio valor', () => {
  const A = carregar();
  const pedidos = [
    { nivel: 'equipamento', pedido: { valorAtual: 243045, valorPedido: 270424.79 } },
    { nivel: 'equipamento', pedido: { valorAtual: 200985.49, valorPedido: 223627.14 } },
    { nivel: 'equipamento', pedido: { valorAtual: 225972.87, valorPedido: 251429.44 } },
  ];
  assert.strictEqual(A.alvoTotal(670003.36, pedidos), 745481.37);
  assert.strictEqual(A.alvoTotal(670003.36, [{ nivel: 'proposta', pedido: { valorAtual: 670003.36, valorPedido: 700000 } }]), 700000);
});

test('montarAviso volta agrupado: um aviso por proposta, diz se o pedido foi alcançado', () => {
  const A = carregar();
  const naoChegou = A.montarAviso('volta', { cliente: 'Eisenhower', itens: [
    { id: 'VPEL-EL1-1', valorNovo: 250419.71, valorPedido: 270424.79 },
    { id: 'VPEL-EL1-2', valorNovo: 207083.99, valorPedido: 223627.14 },
    { id: 'VPEL-EL1-3', valorNovo: 232829.57, valorPedido: 251429.44 },
    { id: 'VPEL-EL1-4', valorNovo: 1, valorPedido: 2 },
  ] });
  assert.match(naoChegou.sub, /ainda abaixo do pedido/);
  assert.match(naoChegou.sub, /e mais 1/);
  assert.ok(naoChegou.sub.length <= 400);
  const chegou = A.montarAviso('volta', { cliente: 'X', itens: [{ id: 'E1', valorNovo: 270424.79, valorPedido: 270424.79 }] });
  assert.match(chegou.sub, /atingiu o valor pedido/);
});

function propostaAntiga() {
  return {
    elevador: { valores: {
      formaTipo: 'parcelado', qtdParcelas: 5, ocultos: [],
      itens: [
        { id: 'E1', quantidade: '1', valorUnit: '243045', valorOriginal: '243045', desconto: null },
        { id: 'E2', quantidade: '1', valorUnit: '190000', valorOriginal: '200000', desconto: { tipo: 'percentual', valor: 5 }, descontoLog: [] },
      ],
      parcelas: [{ valor: '1' }],
    } },
  };
}

test('aplicarNovosValores: preço novo entra sem desconto; o que não mudou fica como estava', () => {
  const A = carregar();
  const r = A.aplicarNovosValores(propostaAntiga(), { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '250419,71', valorOriginal: '250419,71' },
    { id: 'E2', quantidade: '1', valorUnit: '200000', valorOriginal: '200000' },
  ] }, { por: 'sistema', agora: AGORA });
  assert.strictEqual(r.mudou, true);
  const e1 = r.valores.itens.find((i) => i.id === 'E1');
  const e2 = r.valores.itens.find((i) => i.id === 'E2');
  assert.strictEqual(e1.valorUnit, '250419,71');
  assert.strictEqual(e1.desconto, null);
  assert.strictEqual(e2.valorUnit, '190000', 'preço de E2 não mudou: mantém o desconto');
  assert.deepStrictEqual(e2.desconto, { tipo: 'percentual', valor: 5 });
  assert.strictEqual(r.total, 440419.71);
  assert.strictEqual(r.valores.parcelas.length, 5, 'parcelas refeitas no padrão, mesma quantidade');
  const soma = r.valores.parcelas.reduce((s, p) => s + A.parseNum(p.valor), 0);
  assert.ok(Math.abs(soma - r.total) < 0.01);
});

test('aplicarNovosValores: equipamento que mudou perde o desconto e o histórico registra a retirada', () => {
  const A = carregar();
  const r = A.aplicarNovosValores(propostaAntiga(), { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '243045', valorOriginal: '243045' },
    { id: 'E2', quantidade: '1', valorUnit: '210000', valorOriginal: '210000' },
  ] }, { por: 'sistema', agora: AGORA });
  const e2 = r.valores.itens.find((i) => i.id === 'E2');
  assert.strictEqual(e2.desconto, null);
  assert.strictEqual(e2.valorUnit, '210000');
  assert.deepStrictEqual(e2.descontoLog.map((l) => l.acao), ['removido']);
});

test('aplicarNovosValores: sem mudança de preço não mexe em nada', () => {
  const A = carregar();
  const r = A.aplicarNovosValores(propostaAntiga(), { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '243045', valorOriginal: '243045' },
    { id: 'E2', quantidade: '1', valorUnit: '200000', valorOriginal: '200000' },
  ] }, { por: 'sistema', agora: AGORA });
  assert.strictEqual(r.mudou, false);
});

test('aplicarNovosValores: pedido fecha só se a Precificação mudou em relação à BASE (caso VPPR-0993)', () => {
  const A = carregar();
  const antiga = propostaAntiga();
  // pedido feito quando a Precificação já valia 250.419,71 (proposta defasada em 243.045)
  antiga.elevador.valores.itens[0] = A.solicitar(antiga.elevador.valores.itens[0], { valorAtual: 243045, valorPedido: 270424.79, por: 'r@x.c', agora: AGORA, precificacaoBase: 250419.71 });
  const igualBase = A.aplicarNovosValores(antiga, { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '250419,71', valorOriginal: '250419,71' },
    { id: 'E2', quantidade: '1', valorUnit: '200000', valorOriginal: '200000' },
  ] }, { por: 'sistema', agora: AGORA });
  const e1a = igualBase.valores.itens.find((i) => i.id === 'E1');
  assert.ok(e1a.aumentoPendente, 'Precificação não mudou desde o pedido: segue aguardando');
  assert.strictEqual(e1a.aumentoPendente.valorAtual, 250419.71, 'o valor "na proposta" acompanha o preço aplicado');
  assert.strictEqual(igualBase.atendidos.length, 0);
  const mudou = A.aplicarNovosValores(antiga, { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '270424,79', valorOriginal: '270424,79' },
    { id: 'E2', quantidade: '1', valorUnit: '200000', valorOriginal: '200000' },
  ] }, { por: 'sistema', agora: AGORA });
  assert.strictEqual(mudou.valores.itens.find((i) => i.id === 'E1').aumentoPendente, null);
  assert.deepStrictEqual(mudou.atendidos.map((a) => [a.id, a.valorNovo]), [['E1', 270424.79]]);
});

test('aplicarNovosValores: pagamento à vista continua à vista, sem parcelas', () => {
  const A = carregar();
  const p = propostaAntiga();
  p.elevador.valores.formaTipo = 'vista';
  const r = A.aplicarNovosValores(p, { itens: [
    { id: 'E1', quantidade: '1', valorUnit: '250000', valorOriginal: '250000' },
    { id: 'E2', quantidade: '1', valorUnit: '200000', valorOriginal: '200000' },
  ] }, { agora: AGORA });
  assert.deepStrictEqual([r.valores.formaTipo, r.valores.parcelas.length, r.valores.forma], ['vista', 0, '100% à vista']);
});


/* ---------- 13/11/2026 — DESCONTO como pedido ao Financeiro (decisão do Gelson: 1A, 2A, 3A) ---------- */
test('validarPedido: no modo desconto aceita só valor MENOR; sem modo infere a direção', () => {
  const A = carregar();
  const d = A.validarPedido(100000, 90000, 'desconto');
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.tipo, 'desconto');
  assert.strictEqual(d.variacaoRs, 10000);
  assert.ok(Math.abs(d.variacaoPct - 0.1) < 1e-9);
  const maior = A.validarPedido(100000, 110000, 'desconto');
  assert.strictEqual(maior.ok, false);
  assert.match(maior.erro, /Alterar valor/);
  assert.strictEqual(A.validarPedido(100000, 90000).tipo, 'desconto');
  assert.strictEqual(A.validarPedido(100000, 110000).tipo, 'aumento');
});

test('solicitar desconto: grava o tipo no pedido e no histórico e não muda o preço', () => {
  const A = carregar();
  const alvo = { id: 'E1', valorUnit: '100000' };
  const r = A.solicitar(alvo, { valorAtual: 100000, valorPedido: 92000, motivo: 'cliente pediu', por: 'ana@x', modo: 'desconto' }, {});
  assert.strictEqual(r.aumentoPendente.tipo, 'desconto');
  assert.strictEqual(r.aumentoLog[0].tipo, 'desconto');
  assert.strictEqual(r.valorUnit, '100000');
  assert.throws(() => A.solicitar(alvo, { valorAtual: 100000, valorPedido: 120000, modo: 'desconto' }, {}), /Alterar valor/);
});

test('recusar: exige motivo, limpa o pedido, não mexe no preço e guarda quem recusou e por quê', () => {
  const A = carregar();
  const aberto = A.solicitar({ id: 'E1', valorUnit: '100000' }, { valorAtual: 100000, valorPedido: 90000, por: 'ana@x', modo: 'desconto' }, {});
  assert.throws(() => A.recusar(aberto, { motivo: ' ', por: 'fin@x' }), /motivo/i);
  assert.throws(() => A.recusar({ id: 'E2' }, { motivo: 'sem pedido', por: 'fin@x' }), /Não há pedido/);
  const r = A.recusar(aberto, { motivo: 'Margem não comporta', por: 'fin@x', agora: '2026-11-13T12:00:00Z' });
  assert.strictEqual(r.aumentoPendente, null);
  assert.strictEqual(r.valorUnit, '100000');
  const ult = r.aumentoLog[r.aumentoLog.length - 1];
  assert.deepStrictEqual([ult.acao, ult.tipo, ult.por, ult.motivo, ult.valorPedido], ['recusado', 'desconto', 'fin@x', 'Margem não comporta', 90000]);
});

test('pendentesDeDesconto: só pedido de desconto trava o envio; aumento não trava', () => {
  const A = carregar();
  const itDesc = { id: 'E1', aumentoPendente: { tipo: 'desconto', valorPedido: 90, valorAtual: 100 } };
  const itAum = { id: 'E2', aumentoPendente: { tipo: 'aumento', valorPedido: 110, valorAtual: 100 } };
  const itAntigo = { id: 'E3', aumentoPendente: { valorPedido: 110, valorAtual: 100 } }; // sem `tipo` = aumento
  assert.strictEqual(A.pendentesDeDesconto({}, [itDesc, itAum, itAntigo]).length, 1);
  assert.strictEqual(A.pendentesDeDesconto({}, [itAum, itAntigo]).length, 0);
  assert.strictEqual(A.pendentesDeDesconto({ aumentoPendente: { tipo: 'desconto' } }, []).length, 1); // pedido da proposta inteira
});

test('atender e aplicarNovosValores: desconto atendido quando a Precificação baixou; o aviso diz que o desconto foi alcançado', () => {
  const A = carregar();
  const pedido = A.solicitar({ id: 'E1', valorUnit: '100000' }, { valorAtual: 100000, valorPedido: 90000, por: 'ana@x', modo: 'desconto', precificacaoBase: 100000 }, {});
  const r = A.atender(pedido, 90000, 'sistema');
  assert.strictEqual(r.atendido, true);
  assert.strictEqual(r.tipo, 'desconto');
  const sem = A.atender(pedido, 100000, 'sistema'); // Calcular sem mudar o preço não atende
  assert.strictEqual(sem.atendido, false);
  const ok = A.montarAviso('volta', { cliente: 'X', itens: [{ id: 'E1', tipo: 'desconto', valorNovo: 90000, valorPedido: 90000 }] });
  assert.match(ok.sub, /atingiu o valor pedido/);
  const menor = A.montarAviso('volta', { cliente: 'X', itens: [{ id: 'E1', tipo: 'desconto', valorNovo: 95000, valorPedido: 90000 }] });
  assert.match(menor.sub, /desconto ficou menor que o pedido/);
});

test('montarAviso: pedido de desconto e de aumento têm títulos diferentes; a recusa leva o motivo', () => {
  const A = carregar();
  const d = A.montarAviso('ida', { cliente: 'Cli', equipamento: 'E1', tipoPedido: 'desconto', por: 'Ana', valorAtual: 100000, valorPedido: 90000, motivo: 'fechar hoje', numeroCotacao: 1048 });
  const a = A.montarAviso('ida', { cliente: 'Cli', equipamento: 'E1', tipoPedido: 'aumento', por: 'Ana', valorAtual: 100000, valorPedido: 110000, numeroCotacao: 1048 });
  assert.match(d.titulo, /Desconto pedido/);
  assert.match(a.titulo, /Revisão de valor pedida/);
  assert.notStrictEqual(d.titulo, a.titulo);
  assert.match(d.sub, /travada para envio/);
  const rc = A.montarAviso('recusa', { cliente: 'Cli', equipamento: 'E1', valorAtual: 100000, valorPedido: 90000, motivo: 'Margem não comporta', por: 'Juliana' });
  assert.match(rc.titulo, /Desconto recusado/);
  assert.match(rc.sub, /Margem não comporta/);
  assert.match(rc.sub, /já pode ser enviada/);
});
