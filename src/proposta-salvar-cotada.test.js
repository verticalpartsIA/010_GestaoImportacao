'use strict';
/* Proposta que nasceu da cotação não muda o que foi cotado sem destrave, nem em rascunho (REGRA do Gelson, 13/11/2026). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-cotado-calc.js'), 'utf8'))(global.window);
require('./master-id-engine.js');
require('./proposta-store.js');

const cats = (piso) => [{ id: 'n', campos: [{ k: 'a', nome: 'Piso da Cabina', valor: piso, ativo: true }] }];
const gravado = (extra) => ({
  status: 'rascunho', destravada_em: null, numero_documento: 'VPPR-1004', numero_cotacao: 1004, precificacao_id: 'PZ', proposal_type: 'elevador',
  data_json: { elevador: { especificacoes: [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 1 }], acabamentosCats: cats('PS-034') } }, ...extra,
});
function montar(atual) {
  const atualizacoes = [];
  const sb = {
    from(t) {
      if (t === 'perfis') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'EU' }, error: null }) }) }) };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: atual, error: null }) }) }),
        update: (p) => { atualizacoes.push(p); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'P1', token: 't' }, error: null }) }) }) }; },
      };
    },
  };
  window.__VP_SB = { sb }; window.__VP_USER = { email: 'v@x.com' };
  return atualizacoes;
}
const dados = (piso, texto) => ({ numero: 'VPPR-1004', numeroCotacao: 1004, cliente: { nome: 'ACME' }, elevador: { textoProposta: texto || '', especificacoes: [{ id: 'VPEL-EL1004-1', modelo: 'GEP-MRL', qtd: 1 }], acabamentosCats: cats(piso) } });
const salvar = (d) => window.PropostaStore.salvar({ data: d, eq: 'elevador', editId: 'P1', valorTotal: 1 });

test('rascunho cotado: trocar o piso é recusado e nada é gravado', async () => {
  const upd = montar(gravado());
  const r = await salvar(dados('Mármore Resinado'));
  assert.match(r.erro, /nasceu da cotação.*Acabamentos.*destrave/);
  assert.equal(upd.length, 0);
});

test('rascunho cotado: mudar só o texto comercial salva normalmente', async () => {
  const upd = montar(gravado());
  const r = await salvar(dados('PS-034', 'Texto novo para o cliente'));
  assert.equal(r.erro, undefined);
  assert.equal(upd.length, 1);
});

test('rascunho cotado e destravado: a troca do piso é permitida e o salvar retrava', async () => {
  const upd = montar(gravado({ destravada_em: '2026-11-13T10:00:00Z' }));
  const r = await salvar(dados('Mármore Resinado'));
  assert.equal(r.erro, undefined);
  assert.equal(upd[0].destravada_em, null);
});

test('proposta sem Precificação (não cotada) continua editável como sempre', async () => {
  const upd = montar(gravado({ precificacao_id: null }));
  const r = await salvar(dados('Mármore Resinado'));
  assert.equal(r.erro, undefined);
  assert.equal(upd.length, 1);
});
