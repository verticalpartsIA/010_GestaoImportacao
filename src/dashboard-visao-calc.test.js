'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./dashboard-visao-calc.js');

const caps = (...l) => new Set(l);
const kpi = (label) => ({ label });

test('perfil — departamento escolhe o conjunto; sem perfil próprio mantém a visão completa', () => {
  assert.equal(V.perfilDoDepartamento('Comercial'), 'comercial');
  assert.equal(V.perfilDoDepartamento('Adm/Financeiro'), 'financeiro');
  assert.equal(V.perfilDoDepartamento('CEO'), 'admin');
  assert.equal(V.perfilDoDepartamento('Logística/Almoxarifado/Produção'), null);
  assert.equal(V.perfilDoDepartamento(''), null);
  assert.equal(V.perfilEfetivo({ ehAdmin: false, departamento: 'Logística/Almoxarifado/Produção', escolhido: 'comercial' }), 'admin');
  assert.equal(V.perfilEfetivo({ ehAdmin: false, departamento: 'Engenharia', escolhido: 'admin' }), 'engenharia');
});

test('perfil — administrador escolhe; sem dados vale o que a pessoa escolheu', () => {
  assert.equal(V.perfilEfetivo({ ehAdmin: true, departamento: 'Comercial', escolhido: 'financeiro' }), 'financeiro');
  assert.equal(V.perfilEfetivo({ semDados: true, departamento: '', escolhido: 'comercial' }), 'comercial');
});

test('limite — administrador, falha de leitura ou nenhuma alçada de referência veem tudo', () => {
  const lista = [kpi('Faturamento (propostas assinadas)'), kpi('Leads do mês')];
  assert.equal(V.filtrarCartoes(lista, V.visao({ ehAdmin: true, caps: caps() })).ocultos, 0);
  assert.equal(V.filtrarCartoes(lista, V.visao({ semDados: true, caps: caps() })).ocultos, 0);
  assert.equal(V.filtrarCartoes(lista, V.visao({ ehAdmin: false, caps: caps() })).ocultos, 0);
  // só notificações não conta como alçada de referência: continua vendo tudo
  assert.equal(V.filtrarCartoes(lista, V.visao({ ehAdmin: false, caps: caps('notificacoes.ver') })).ocultos, 0);
});

test('limite — com alguma alçada de referência, só os cartões liberados por ela aparecem', () => {
  const v = V.visao({ ehAdmin: false, caps: caps('leads.ver') });
  const r = V.filtrarCartoes([kpi('Leads do mês'), kpi('Propostas enviadas'), kpi('Conversão Lead→Proposta')], v);
  assert.deepEqual(r.visiveis.map((k) => k.label), ['Leads do mês', 'Conversão Lead→Proposta']);
  assert.equal(r.ocultos, 1);
});

test('limite — propostas libera por ver_todas, não por criar', () => {
  const soCriar = V.visao({ ehAdmin: false, caps: caps('leads.ver', 'propostas.criar') });
  assert.equal(soCriar.pode('propostas'), false);
  const verTodas = V.visao({ ehAdmin: false, caps: caps('leads.ver', 'propostas.ver_todas') });
  assert.equal(verTodas.pode('propostas'), true);
});

test('limite — Onde Parou e Projetos em Andamento dependem de Prazos & Pendências; cartão sem mapa e Tarefas sempre aparecem', () => {
  const v = V.visao({ ehAdmin: false, caps: caps('leads.ver') });
  assert.equal(V.blocoVisivel('ondeParou', v), false);
  assert.equal(V.blocoVisivel('projetos', v), false);
  assert.equal(V.blocoVisivel('pipeline', v), false);
  assert.equal(V.blocoVisivel('origem', v), true);
  assert.equal(V.filtrarCartoes([kpi('Cartão novo sem mapa')], v).ocultos, 0);
  const fin = V.visao({ ehAdmin: false, caps: caps('financeiro.ver') });
  assert.equal(V.blocoVisivel('ondeParou', fin), true);
});

test('mapa — todo cartão das quatro visões tem alçada definida', () => {
  const rotulos = ['Leads do mês', 'Cot. em China', 'Propostas enviadas', 'Conversão Lead→Proposta', 'Projetos abertos', 'Fichas técnicas', 'Catálogo (ativos)', 'Alertas engenharia', 'A receber', 'Comissões pendentes', 'Gatilhos próx. 7d', 'Contratos abertos', 'Projetos ativos', 'Embarques em trânsito', 'Alertas críticos', 'Faturamento (propostas assinadas)', 'Comissões (custo)'];
  for (const r of rotulos) assert.ok(V.MODULO_DO_CARTAO[r], r);
});
