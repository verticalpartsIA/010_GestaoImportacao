'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('./inbox-organizar-calc.js');

const AGORA = new Date(2026, 9, 7, 10, 0, 0);          // quarta-feira, 07/10/2026 10:00
const futuro = new Date(2026, 9, 8, 8, 0, 0).toISOString();
const passado = new Date(2026, 9, 6, 8, 0, 0).toISOString();

/* contexto de teste: `estados` e `spams` indexados por id */
const ctx = (over) => ({
  ehEnviado: (m) => m._pasta === 'sent',
  estado: (m) => (over.estados || {})[m.id],
  spam: (m) => !!(over.spams || {})[m.id],
  eMeu: (m) => !!(over.meus || {})[m.id],
  semResp: (m) => !!(over.semResp || {})[m.id],
  marcadores: (m) => (over.marcadores || {})[m.id] || [],
  agora: AGORA,
});
const rec = { id: 'r1' };            // recebido
const env = { id: 'e1', _pasta: 'sent' };
const na = (m, pasta, over) => O.visivelNaPasta(m, pasta, ctx(over || {}));

test('opcoesAdiar — de manhã oferece hoje à tarde, amanhã e próxima segunda', () => {
  const o = O.opcoesAdiar(AGORA);
  assert.deepEqual(o.map((x) => x.id), ['hoje', 'amanha', 'segunda']);
  assert.equal(o[0].quando.getHours(), 18); assert.equal(o[0].quando.getDate(), 7);
  assert.equal(o[1].quando.getDate(), 8); assert.equal(o[1].quando.getHours(), 8);
  assert.equal(o[2].quando.getDay(), 1); assert.equal(o[2].quando.getDate(), 12);     // segunda 12/10
});

test('opcoesAdiar — depois das 17h não oferece "hoje à tarde"', () => {
  const o = O.opcoesAdiar(new Date(2026, 9, 7, 17, 30, 0));
  assert.deepEqual(o.map((x) => x.id), ['amanha', 'segunda']);
});

test('opcoesAdiar — numa segunda-feira, "próxima segunda" é a de daqui a 7 dias', () => {
  const o = O.opcoesAdiar(new Date(2026, 9, 5, 9, 0, 0));      // segunda 05/10
  assert.equal(o.find((x) => x.id === 'segunda').quando.getDate(), 12);
});

test('adiadoAgora — só enquanto a data é futura', () => {
  assert.equal(O.adiadoAgora({ adiado_ate: futuro }, AGORA), true);
  assert.equal(O.adiadoAgora({ adiado_ate: passado }, AGORA), false);
  assert.equal(O.adiadoAgora({}, AGORA), false);
  assert.equal(O.adiadoAgora(undefined, AGORA), false);
});

test('visivelNaPasta — Caixa de entrada: recebido normal sim; arquivado, adiado e enviado não', () => {
  assert.equal(na(rec, 'inbox'), true);
  assert.equal(na(rec, 'inbox', { estados: { r1: { arquivado: true } } }), false);
  assert.equal(na(rec, 'inbox', { estados: { r1: { adiado_ate: futuro } } }), false);
  assert.equal(na(env, 'inbox'), false);
});

test('visivelNaPasta — adiado volta sozinho quando a hora passa', () => {
  assert.equal(na(rec, 'inbox', { estados: { r1: { adiado_ate: passado } } }), true);
  assert.equal(na(rec, 'adiados', { estados: { r1: { adiado_ate: passado } } }), false);
  assert.equal(na(rec, 'adiados', { estados: { r1: { adiado_ate: futuro } } }), true);
});

test('visivelNaPasta — arquivado continua em "Todos os e-mails" e na estrela', () => {
  const st = { r1: { arquivado: true, estrela: true } };
  assert.equal(na(rec, 'all', { estados: st }), true);
  assert.equal(na(rec, 'starred', { estados: st }), true);
});

test('visivelNaPasta — spam só aparece na pasta Spam, em nenhuma outra (nem Todos)', () => {
  const o = { spams: { r1: true } };
  assert.equal(na(rec, 'spam', o), true);
  ['inbox', 'all', 'starred', 'mine', 'triagem', 'm:x'].forEach((p) => assert.equal(na(rec, p, o), false, p));
  assert.equal(na(rec, 'spam'), false);                       // e-mail normal não aparece em Spam
});

test('visivelNaPasta — Enviados, Atribuídos a mim e Sem responsável', () => {
  assert.equal(na(env, 'sent'), true);
  assert.equal(na(rec, 'sent'), false);
  assert.equal(na(rec, 'mine', { meus: { r1: true } }), true);
  assert.equal(na(rec, 'mine'), false);
  assert.equal(na(rec, 'triagem', { semResp: { r1: true } }), true);
  assert.equal(na(env, 'triagem', { semResp: { e1: true } }), false);     // enviado nunca está "sem responsável"
  assert.equal(na(rec, 'triagem', { semResp: { r1: true }, estados: { r1: { arquivado: true } } }), false);
});

test('visivelNaPasta — pasta de marcador mostra só quem tem aquele marcador', () => {
  const o = { marcadores: { r1: ['abc'] } };
  assert.equal(na(rec, 'm:abc', o), true);
  assert.equal(na(rec, 'm:zzz', o), false);
  assert.equal(na({ id: 'r2' }, 'm:abc', o), false);
});

test('arvoreMarcadores — pai antes do filho, por nome, com profundidade; órfão e ciclo não somem', () => {
  const l = [
    { id: 'b', nome: 'Filho B', pai_id: 'a' }, { id: 'a', nome: 'Pai', pai_id: null }, { id: 'c', nome: 'Filho A', pai_id: 'a' },
    { id: 'o', nome: 'Órfão', pai_id: 'sumiu' }, { id: 'x', nome: 'Ciclo X', pai_id: 'y' }, { id: 'y', nome: 'Ciclo Y', pai_id: 'x' },
  ];
  const t = O.arvoreMarcadores(l);
  assert.deepEqual(t.filter((x) => ['a', 'c', 'b'].includes(x.id)).map((x) => x.id + ':' + x.nivel), ['a:0', 'c:1', 'b:1']);
  assert.equal(t.length, 6);                                    // nenhum se perde
  assert.equal(t.find((x) => x.id === 'o').nivel, 0);
});

test('marcadoresVisiveis — os da equipe e só os meus pessoais', () => {
  const l = [{ id: '1', escopo: 'equipe', dono_email: 'a@x.com' }, { id: '2', escopo: 'pessoal', dono_email: 'eu@x.com' }, { id: '3', escopo: 'pessoal', dono_email: 'a@x.com' }];
  assert.deepEqual(O.marcadoresVisiveis(l, 'EU@x.com').map((x) => x.id), ['1', '2']);
});

test('permissões de marcador — criar da equipe exige triagem/ver_todos; gerir e aplicar respeitam o dono', () => {
  assert.equal(O.podeCriarMarcador('pessoal', { editar: true }), true);
  assert.equal(O.podeCriarMarcador('pessoal', { editar: false }), false);
  assert.equal(O.podeCriarMarcador('equipe', { editar: true }), false);
  assert.equal(O.podeCriarMarcador('equipe', { editar: true, triagem: true }), true);
  assert.equal(O.podeCriarMarcador('equipe', { editar: true, ver_todos: true }), true);
  const meu = { escopo: 'pessoal', dono_email: 'eu@x.com' }, deOutro = { escopo: 'pessoal', dono_email: 'a@x.com' }, equipe = { escopo: 'equipe', dono_email: 'a@x.com' };
  assert.equal(O.podeGerirMarcador(meu, 'eu@x.com', {}), true);
  assert.equal(O.podeGerirMarcador(deOutro, 'eu@x.com', { ver_todos: true }), false);     // pessoal de outro nunca
  assert.equal(O.podeGerirMarcador(equipe, 'eu@x.com', {}), false);
  assert.equal(O.podeGerirMarcador(equipe, 'eu@x.com', { ver_todos: true }), true);
  assert.equal(O.podeAplicarMarcador(meu, 'eu@x.com', { editar: true }), true);
  assert.equal(O.podeAplicarMarcador(deOutro, 'eu@x.com', { editar: true }), false);
  assert.equal(O.podeAplicarMarcador(equipe, 'eu@x.com', { editar: true }), true);
  assert.equal(O.podeAplicarMarcador(equipe, 'eu@x.com', { editar: false }), false);
});

test('podeMarcarSpam — nunca em enviado, nem em e-mail ligado a cotação ou documento', () => {
  assert.equal(O.podeMarcarSpam({}, false).ok, true);
  assert.equal(O.podeMarcarSpam({}, true).ok, false);
  const c = O.podeMarcarSpam({ numeroCotacao: 970 }, false);
  assert.equal(c.ok, false); assert.match(c.motivo, /970/);
  assert.equal(O.podeMarcarSpam({ referenciaTipo: 'proposta' }, false).ok, false);
});
