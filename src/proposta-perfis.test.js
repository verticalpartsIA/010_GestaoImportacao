'use strict';
/* proposta-perfis.test.js — acabamentos por tipo de equipamento (Carga / Passageiro / Panorâmico), fase 1.
   Cotação real de referência: 990 (1 carga de 2 paradas + 4 cargas de 4 paradas + 1 passageiro + 3 panorâmicos). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  for (const f of ['proposta-opcoes.js', 'proposta-acabamentos-engine.js', 'proposta-heranca.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, f), 'utf8'))(global.window);
  }
  return global.window;
}

const U = (id, tipo, extra) => ({ id, tipo, ...extra });
const unidades990 = [
  U('FEU-A', 'Carga', { modelo: 'VP-301', aco_cabina: 'Aço 430', botoeira_cabine: 'COP-004C', piso_cabina: 'PS-201', porta_tipo_abertura: 'Central', porta_largura_mm: '1100', porta_altura_mm: '2500', acabamento_porta_cabina: 'Aço 430', acabamento_porta_pavimento: 'Aço 430', botoeira_pavimento: 'LOP-12C' }),
  U('FEU-B', 'Carga', { modelo: 'VP-301', aco_cabina: 'Aço 430' }),
  U('FEU-C', 'Panorâmico', { modelo: 'VP-004', aco_cabina: 'Aço 430', teto_falso: 'SUB-001', botoeira_cabine: 'COP-05C', piso_cabina: 'PS-034', porta_tipo_abertura: 'Lateral' }),
  U('FEU-D', 'Passageiro', { modelo: 'VP-200', aco_cabina: 'Aço 430', teto_falso: 'SUB-001', botoeira_cabine: 'COP-05C' }),
];
const esp990 = [
  { unidadeId: 'FEU-A', carac: 'Carga', codigos: ['VPEL-EL0990-1'] },
  { unidadeId: 'FEU-B', carac: 'Carga', codigos: ['VPEL-EL0990-2', 'VPEL-EL0990-3', 'VPEL-EL0990-4', 'VPEL-EL0990-5'] },
  { unidadeId: 'FEU-D', carac: 'Passageiro', codigos: ['VPEL-EL0990-6'] },
  { unidadeId: 'FEU-C', carac: 'Panorâmico', codigos: ['VPEL-EL0990-7', 'VPEL-EL0990-8', 'VPEL-EL0990-9'] },
];

test('faixaCodigos: faixa contínua, par, avulso e faixas quebradas', () => {
  const { PropostaOpcoes: O } = carregar();
  assert.equal(O.faixaCodigos(['VPEL-EL0990-1', 'VPEL-EL0990-2', 'VPEL-EL0990-3', 'VPEL-EL0990-4', 'VPEL-EL0990-5']), 'VPEL-EL0990-1 a -5');
  assert.equal(O.faixaCodigos(['VPEL-EL0990-6']), 'VPEL-EL0990-6');
  assert.equal(O.faixaCodigos(['VPEL-EL0990-6', 'VPEL-EL0990-7']), 'VPEL-EL0990-6 e -7');
  assert.equal(O.faixaCodigos(['VPEL-EL0990-9', 'VPEL-EL0990-1', 'VPEL-EL0990-2', 'VPEL-EL0990-3']), 'VPEL-EL0990-1 a -3, -9');
  assert.equal(O.faixaCodigos(['E4', 'X']), 'E4, X');
  assert.equal(O.faixaCodigos([]), '');
});

test('rotuloTipo / nomePerfil: tipos conhecidos, tipo novo e padrão de antes', () => {
  const { PropostaOpcoes: O } = carregar();
  assert.equal(O.rotuloTipo('Carga'), 'Elevador de Carga');
  assert.equal(O.rotuloTipo('Panorâmico'), 'Elevador Panorâmico');
  assert.equal(O.rotuloTipo('Passageiros'), 'Elevador de Passageiros');
  assert.equal(O.rotuloTipo('Hospitalar'), 'Elevador Hospitalar');
  assert.equal(O.rotuloTipo('', 'Elevador de Passageiros'), 'Elevador de Passageiros');
  assert.equal(O.nomePerfil('Carga'), 'Elevadores de Carga');
  assert.equal(O.nomePerfil('Hospitalar'), 'Elevadores Hospitalar');
});

test('perfisAcabamento: proposta sem perfis = 1 bloco global, como sempre (retrocompat)', () => {
  const { PropostaOpcoes: O } = carregar();
  const ed = { acabamentosCats: [{ campos: [{ nome: 'Modelo da Cabine', valor: 'VP-200', ativo: true }] }] };
  const b = O.perfisAcabamento(ed);
  assert.equal(b.length, 1);
  assert.equal(b[0].nome, null);
  assert.equal(b[0].rotulo, 'Elevador de Passageiros');
  assert.deepEqual(b[0].linhas, [['Modelo da Cabine', 'VP-200']]);
  assert.deepEqual(O.perfisAcabamento({}), []);
});

test('perfisAcabamento: sem perfis, todas as especificações de Carga → rótulo "Elevador de Carga"', () => {
  const { PropostaOpcoes: O } = carregar();
  const ed = { especificacoes: [{ carac: 'Carga' }, { carac: 'Carga' }], acabamentosCats: [{ campos: [{ nome: 'Piso', valor: 'PS-201', ativo: true }] }] };
  assert.equal(O.perfisAcabamento(ed)[0].rotulo, 'Elevador de Carga');
  const misto = { ...ed, especificacoes: [{ carac: 'Carga' }, { carac: 'Passageiro' }] };
  assert.equal(O.perfisAcabamento(misto)[0].rotulo, 'Elevador de Passageiros');
});

test('perfisAcabamento: com perfis, 1 bloco por perfil com linha; perfil sem nada preenchido some; global é ignorado', () => {
  const { PropostaOpcoes: O } = carregar();
  const cat = (valor) => [{ campos: [{ nome: 'Piso', valor, ativo: true }] }];
  const ed = {
    acabamentosCats: cat('GLOBAL-NAO-APARECE'),
    perfis: [
      { id: 'a', nome: 'Elevadores de Carga', tipo: 'Carga', codigos: ['VPEL-EL0990-1', 'VPEL-EL0990-2'], acabamentosCats: cat('PS-201') },
      { id: 'b', nome: 'Elevadores Panorâmicos', tipo: 'Panorâmico', codigos: ['VPEL-EL0990-7'], acabamentosCats: cat('PS-034') },
      { id: 'c', nome: 'Elevadores de Passageiros', tipo: 'Passageiro', codigos: ['VPEL-EL0990-6'], acabamentosCats: [{ campos: [{ nome: 'Piso', valor: '', ativo: true }] }] },
    ],
  };
  const b = O.perfisAcabamento(ed);
  assert.deepEqual(b.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(b[0].linhas, [['Piso', 'PS-201']]);
  assert.equal(b[0].rotulo, 'Elevador de Carga');
  assert.equal(O.tituloPerfil(b[0]), 'Elevadores de Carga — VPEL-EL0990-1 e -2');
});

test('montarPerfis (cotação 990): 3 perfis por tipo, cada um com os acabamentos DA SUA Unidade', () => {
  const w = carregar();
  const perfis = w.PropostaHeranca.montarPerfis({ unidades: unidades990, cotacao: null }, esp990);
  assert.deepEqual(perfis.map((p) => p.tipo), ['Carga', 'Passageiro', 'Panorâmico']);
  assert.deepEqual(perfis[0].codigos, ['VPEL-EL0990-1', 'VPEL-EL0990-2', 'VPEL-EL0990-3', 'VPEL-EL0990-4', 'VPEL-EL0990-5']);
  const linhas = (p) => Object.fromEntries(w.PropostaOpcoes.perfisAcabamento({ perfis: [p] })[0].linhas);
  assert.equal(linhas(perfis[0])['Modelo da Cabine'], 'VP-301');
  assert.equal(linhas(perfis[0])['Piso da Cabina'], 'PS-201');
  assert.equal(linhas(perfis[0])['Modelo de Porta'], 'Automática Central');
  assert.equal(linhas(perfis[0])['Dimensão da Porta de Cabine'], '1100 x 2500mm');
  assert.equal(linhas(perfis[0])['Sub-teto'], undefined);          // carga não tem sub-teto
  assert.equal(linhas(perfis[1])['Modelo da Cabine'], 'VP-200');   // passageiro
  assert.equal(linhas(perfis[2])['Modelo da Cabine'], 'VP-004');   // panorâmico
  assert.equal(linhas(perfis[2])['Modelo de Porta'], 'Automática Lateral');
});

test('montarPerfis: 1 tipo só → [] (proposta segue com o bloco global de sempre)', () => {
  const w = carregar();
  const esp = [{ unidadeId: 'FEU-A', carac: 'Carga', codigos: ['X-1'] }, { unidadeId: 'FEU-B', carac: 'Carga', codigos: ['X-2'] }];
  assert.deepEqual(w.PropostaHeranca.montarPerfis({ unidades: unidades990, cotacao: null }, esp), []);
  assert.deepEqual(w.PropostaHeranca.montarPerfis({ unidades: [], cotacao: null }, []), []);
});
