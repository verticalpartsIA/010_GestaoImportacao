'use strict';
/* Autoria do rodapé da Ficha Técnica (FT.autoriaFicha, ficha-tecnica-engine.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('./ficha-tecnica-engine.js');
const FT = global.window.FT;

const ficha = { criado_em: '2026-11-17T18:52:23Z', atualizado_em: '2026-11-17T18:52:23Z' };

test('autoria: criador e data vêm do histórico "criou" e da ficha, nunca do usuário logado', () => {
  global.window.__VP_USER = { email: 'quem.abriu@verticalparts.com.br' };
  const a = FT.autoriaFicha(ficha, [{ acao: 'criou', ator_nome: 'Vinicius Ramos', criado_em: '2026-11-17T18:52:24Z' }]);
  assert.equal(a.criadoPor, 'Vinicius Ramos');
  assert.equal(a.criadoEm, '2026-11-17T18:52:23Z');
  assert.equal(a.versao, 1);
  assert.equal(a.atualizadoEm, null);
});

test('autoria: versão nova mostra quem atualizou (última edição) e conta as versões', () => {
  const a = FT.autoriaFicha(ficha, [
    { acao: 'editou', ator_nome: 'Maria', criado_em: '2026-11-18T10:00:00Z' },
    { acao: 'criou', ator_nome: 'Vinicius Ramos', criado_em: '2026-11-17T18:52:24Z' },
    { acao: 'editou', ator_nome: 'Vinicius Ramos', criado_em: '2026-11-17T19:30:10Z' },
  ]);
  assert.equal(a.criadoPor, 'Vinicius Ramos');
  assert.equal(a.versao, 3);
  assert.equal(a.atualizadoPor, 'Maria');
  assert.equal(a.atualizadoEm, '2026-11-18T10:00:00Z');
});

test('autoria: ficha antiga sem histórico "criou" não inventa autor', () => {
  const a = FT.autoriaFicha({ criado_em: '2026-06-03T12:00:00Z', atualizado_em: '2026-06-03T12:01:00Z' }, []);
  assert.equal(a.criadoPor, null);
  assert.equal(a.criadoEm, '2026-06-03T12:00:00Z');
  assert.equal(a.atualizadoEm, null);
});

test('autoria: ficha antiga atualizada bem depois, sem evento de edição, marca data sem autor', () => {
  const a = FT.autoriaFicha({ criado_em: '2026-06-03T12:00:00Z', atualizado_em: '2026-07-01T12:00:00Z' }, []);
  assert.equal(a.atualizadoEm, '2026-07-01T12:00:00Z');
  assert.equal(a.atualizadoSemAutor, true);
  assert.equal(a.atualizadoPor, null);
});
