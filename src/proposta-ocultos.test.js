'use strict';
/* Ocultar/reexibir equipamento individual na Proposta (VPPR-0990, 23/10/2026).
   O estado oculto fica em elevador.valores.ocultos (códigos); projetar() devolve a visão comercial
   (nunca muta o original); alternarOculto() recalcula as parcelas sozinho. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-opcoes.js');
const O = window.PropostaOpcoes;

const cod = (n) => `VPEL-EL0990-${n}`;
const preco = { 1: '185247,39', 2: '192075,01', 3: '192075,01', 4: '192075,01', 5: '192075,01', 6: '300000,00', 7: '300000,00', 8: '300000,00', 9: '300000,00' };

function p990(extra) {
  const itens = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    id: cod(n), unidadeId: n === 1 ? 'U1' : n <= 5 ? 'U2' : 'U3', equipamento: cod(n), quantidade: '1',
    valorUnit: preco[n], valorOriginal: preco[n], desconto: null, descontoPendente: null, descontoLog: [],
  }));
  const total = itens.reduce((s, it) => s + parseFloat(it.valorUnit.replace(',', '.')), 0);
  return {
    numero: 'VPPR-0990',
    ativos: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ codigo: cod(n), unidadeId: n === 1 ? 'U1' : n <= 5 ? 'U2' : 'U3' })),
    elevador: {
      especificacoes: [
        { id: cod(1), qtd: 1, modelo: 'GEF', unidadeId: 'U1', codigos: [cod(1)], codigoAtivo: cod(2) }, // codigoAtivo NÃO é chave
        { id: `${cod(2)}, ${cod(3)}, ${cod(4)}, ${cod(5)}`, qtd: 4, modelo: 'GEF', unidadeId: 'U2', codigos: [cod(2), cod(3), cod(4), cod(5)] },
        { id: 'x', qtd: 4, modelo: 'GEP', unidadeId: 'U3', codigos: [cod(6), cod(7), cod(8), cod(9)] },
      ],
      valores: {
        itens, quantidade: '9', valorUnit: '277885,40', equipamento: 'GEF, GEO, GEP-MRL',
        formaTipo: 'parcelado', qtdParcelas: 6, forma: '40% à vista e 5 parcelas',
        parcelas: O.parcelasPadrao(6, total),
        ...extra,
      },
    },
  };
}
const cent = (s) => Math.round(parseFloat(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const somaParcelas = (d) => d.elevador.valores.parcelas.reduce((s, p) => s + cent(p.valor), 0);

test('sem ocultos: projetar devolve o MESMO objeto (propostas antigas não mudam)', () => {
  const d = p990();
  assert.equal(O.projetar(d), d);
  assert.deepEqual(O.ocultosDe(d), []);
});

test('ocultar só o -2: 8 visíveis, -3/-4/-5 continuam, original intacto', () => {
  const d = p990();
  const antes = JSON.stringify(d);
  const r = O.alternarOculto(d, cod(2), true);
  assert.equal(r.erro, undefined);
  assert.equal(JSON.stringify(d), antes); // não muta
  const v = O.projetar(r.data);
  const ids = v.elevador.valores.itens.map((i) => i.id);
  assert.equal(ids.length, 8);
  assert.ok(!ids.includes(cod(2)));
  ['3', '4', '5'].forEach((n) => assert.ok(ids.includes(cod(n))));
  assert.equal(r.data.ativos.length, 9); // dado integral preservado
  assert.equal(r.data.elevador.valores.itens.length, 9);
  assert.deepEqual(O.ocultosDe(r.data), [cod(2)]);
});

test('grupo GEF: qtd 4 → 3 só na projeção, sem usar codigoAtivo', () => {
  const r = O.alternarOculto(p990(), cod(2), true);
  const v = O.projetar(r.data);
  const g = v.elevador.especificacoes.find((s) => s.unidadeId === 'U2');
  assert.equal(g.qtd, 3);
  assert.deepEqual(g.codigos, [cod(3), cod(4), cod(5)]);
  assert.equal(r.data.elevador.especificacoes.find((s) => s.unidadeId === 'U2').qtd, 4);
  // o grupo U1 tem codigoAtivo = -2, mas o -1 NÃO é ocultado por causa disso
  assert.equal(v.elevador.especificacoes.find((s) => s.unidadeId === 'U1').codigos[0], cod(1));
  assert.equal(v.ativos.length, 8);
});

test('total = soma dos visíveis e parcelas fecham no centavo', () => {
  const d = p990();
  const totalCheio = O.totalOficial(d);
  const r = O.alternarOculto(d, cod(2), true);
  const totalVisivel = O.totalOficial(r.data);
  assert.equal(Math.round(totalCheio * 100) - Math.round(totalVisivel * 100), cent(preco[2]));
  assert.equal(somaParcelas(r.data), Math.round(totalVisivel * 100));
  assert.equal(r.data.elevador.valores.parcelas.length, 6);
});

test('reexibir restaura total e parcelas exatamente', () => {
  const d = p990();
  const oc = O.alternarOculto(d, cod(2), true).data;
  const volta = O.alternarOculto(oc, cod(2), false).data;
  assert.deepEqual(O.ocultosDe(volta), []);
  assert.equal(Math.round(O.totalOficial(volta) * 100), Math.round(O.totalOficial(d) * 100));
  assert.equal(somaParcelas(volta), Math.round(O.totalOficial(d) * 100));
});

test('idempotente: ocultar duas vezes não duplica', () => {
  const a = O.alternarOculto(p990(), cod(2), true).data;
  const b = O.alternarOculto(a, cod(2), true).data;
  assert.deepEqual(O.ocultosDe(b), [cod(2)]);
});

test('ocultar 2 do mesmo grupo e 1 de outro; grupo todo oculto some da projeção', () => {
  let d = p990();
  [2, 3].forEach((n) => { d = O.alternarOculto(d, cod(n), true).data; });
  assert.equal(O.projetar(d).elevador.especificacoes.find((s) => s.unidadeId === 'U2').qtd, 2);
  [4, 5].forEach((n) => { d = O.alternarOculto(d, cod(n), true).data; });
  const v = O.projetar(d);
  assert.equal(v.elevador.especificacoes.some((s) => s.unidadeId === 'U2'), false);
  assert.equal(v.elevador.especificacoes.length, 2);
});

test('perfis por tipo: codigos filtrados e perfil vazio some', () => {
  let d = p990();
  d.elevador.perfis = [{ id: 'a', tipo: 'carga', unidadeIds: ['U2'], codigos: [cod(2), cod(3)] }, { id: 'b', tipo: 'passageiro', unidadeIds: ['U1'], codigos: [cod(1)] }];
  d = O.alternarOculto(d, cod(2), true).data;
  let v = O.projetar(d);
  assert.deepEqual(v.elevador.perfis[0].codigos, [cod(3)]);
  d = O.alternarOculto(d, cod(3), true).data;
  v = O.projetar(d);
  assert.equal(v.elevador.perfis.length, 1);
});

test('desconto pendente bloqueia ocultar; desconto já aplicado vale o valor líquido', () => {
  const d = p990();
  d.elevador.valores.itens[1].descontoPendente = { papel: 'gestor' };
  const r = O.alternarOculto(d, cod(2), true);
  assert.match(r.erro, /desconto/i);
  assert.equal(r.data, d);
  // reexibir um item com pedido pendente é sempre permitido
  const oc = p990(); oc.elevador.valores.ocultos = [cod(2)]; oc.elevador.valores.itens[1].descontoPendente = { papel: 'gestor' };
  assert.equal(O.alternarOculto(oc, cod(2), false).erro, undefined);
});

test('proposta com opção 90 dias não oculta (1 equipamento só)', () => {
  const d = p990({ opcao90: { valorUnit: '224913', parcelas: [] } });
  assert.match(O.alternarOculto(d, cod(2), true).erro, /90/);
});

test('código inexistente é recusado', () => {
  assert.match(O.alternarOculto(p990(), 'VPEL-XXX', true).erro, /encontrad/i);
});

test('último equipamento: rascunho permite, mas não há equipamento visível (publicar/enviar bloqueiam) e total = 0', () => {
  /* A tela agora exige no mínimo 2 visíveis; zero visível só existe em dado antigo/gravado fora da tela — a guarda continua. */
  const d = p990();
  d.elevador.valores.ocultos = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(cod);
  d.elevador.valores.parcelas = [];
  assert.equal(O.semEquipamentoVisivel(d), true);
  assert.equal(O.totalOficial(d), 0); // sem cair no valorUnit×quantidade agregado
  assert.equal(O.semEquipamentoVisivel(p990()), false);
  assert.deepEqual(d.elevador.valores.parcelas, []);
});

test('ordem dos ocultos e linhasUnitarias/totaisValores usam só os visíveis', () => {
  const d = O.alternarOculto(p990(), cod(2), true).data;
  assert.equal(O.linhasUnitarias(d).length, 8);
  assert.equal(O.linhasUnitarias(d).some((l) => l.equipamento === cod(2)), false);
  assert.equal(Math.round(O.totaisValores(d).totalGeral * 100), Math.round(O.totalOficial(d) * 100));
});

test('à vista: ocultar não cria parcelas', () => {
  const d = p990({ formaTipo: 'vista', parcelas: [], forma: '100% à vista' });
  const r = O.alternarOculto(d, cod(2), true);
  assert.deepEqual(r.data.elevador.valores.parcelas, []);
});
