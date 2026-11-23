'use strict';
/* A proposta nasce com o que foi realmente cotado (REGRA do Gelson, 13/11/2026; módulo 4, 4.5.10 item 16):
   cotação de UM tipo só também herda os acabamentos, e a divergência do fornecedor vale e fica registrada. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  for (const f of ['proposta-opcoes.js', 'proposta-cotado-calc.js', 'proposta-heranca.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, f), 'utf8'))(global.window);
  }
  return global.window.PropostaHeranca;
}

const unidade = { id: 'U1', identificador: 'VPEL-EL1004-1', tipo: 'Passageiro', modelo: 'VP-200', aco_cabina: 'Aço 430', piso_cabina: 'PS-034', teto_falso: 'SUB-001', botoeira_cabine: 'COP-05C', botoeira_pavimento: 'LOP-12C', porta_tipo_abertura: 'Central', acabamento_porta_cabina: 'Aço 430', acabamento_porta_pavimento: 'Aço 430', porta_largura_mm: 1300, porta_altura_mm: 2100, paradas: 4, quantidade: 1 };
const fontes = (div) => ({
  encontrado: true, numeroCotacao: 1004, formulario: { local_obra_cidade: 'SP' }, cliente: { razao_social: 'ACME' },
  unidades: [unidade], precificacao: null,
  cotacao: { id: 'C1', numero_documento: 'VPEL-EL1004-A', fornecedor: 'Glarie', dados_envio: { unidades: [{ ...unidade, unidade_id: 'U1' }] }, respostas: { itens: [{ unidade_id: 'U1', divergencias: div }] } },
});

test('cotação de um só tipo: os acabamentos vêm do cotado (antes o vendedor digitava)', () => {
  const H = carregar();
  const p = H.montarPrefill(fontes({}));
  const a = p.elevador.acabamentos;
  assert.equal(a.pisoCabina, 'PS-034');
  assert.equal(a.acabamentoMat, 'Aço 430');
  assert.equal(a.modeloPorta, 'Automática Central');
  assert.equal(a.painelOperacao, 'COP-05C');
  assert.equal(p.divergencias, undefined);
});

test('o fornecedor cotou porta lateral: a proposta herda lateral e registra a divergência pendente', () => {
  const H = carregar();
  const p = H.montarPrefill(fontes({ porta_tipo_abertura: 'Side-opening' }));
  assert.equal(p.elevador.acabamentos.modeloPorta, 'Automática Lateral');
  assert.equal(p.divergencias.length, 1);
  assert.equal(p.divergencias[0].pedido, 'Central');
  assert.equal(p.divergencias[0].cotado, 'Lateral');
  assert.equal(p.divergencias[0].status, 'pendente');
});

test('paradas cotadas diferentes entram nas especificações da proposta', () => {
  const H = carregar();
  const p = H.montarPrefill(fontes({ paradas: '5' }));
  assert.equal(p.elevador.especificacoes[0].andaresParadasPortas, '5 Paradas');
  assert.equal(p.divergencias[0].key, 'paradas');
});
