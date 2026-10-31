/* ============================================================
   cadastros-nunca-excluir.test.js — 🔒 Área Blindada (31/10/2026)
   Cliente/fornecedor com transação nunca é excluído; falha ao conferir = não apaga.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function montar(arquivo, { vinculos, erroRpc }) {
  const chamadas = { rpc: [], delete: 0, update: null };
  const sb = {
    rpc: async (nome, args) => { chamadas.rpc.push({ nome, args }); return erroRpc ? { data: null, error: { message: 'sem função' } } : { data: vinculos, error: null }; },
    from() {
      let op = null;
      const q = {
        delete() { op = 'delete'; chamadas.delete += 1; return q; },
        update(p) { op = 'update'; chamadas.update = p; return q; },
        eq() { return q; }, select() { return q; },
        single: async () => ({ data: { id: 'x', razao_social: 'ACME' }, error: null }),
        then(res) { return Promise.resolve({ data: op === 'delete' ? [{ id: 'x' }] : [], error: null }).then(res); },
      };
      return q;
    },
  };
  const window = { __VP_SB: { sb }, VPLog: { registrar() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), { window, console });
  return { window, chamadas };
}

for (const [arquivo, chave, tipo] of [['cadastros-clientes-store.js', 'CadastrosClientesStore', 'cliente'], ['cadastros-fornecedores-store.js', 'CadastrosFornecedoresStore', 'fornecedor']]) {
  test(`${tipo}: com transação não exclui e explica o motivo`, async () => {
    const { window, chamadas } = montar(arquivo, { vinculos: [{ fonte: 'Propostas', qtd: 2 }] });
    await assert.rejects(window[chave].remover('x'), /não pode ser excluído: Propostas \(2\)/);
    assert.strictEqual(chamadas.delete, 0);
    assert.strictEqual(JSON.stringify(chamadas.rpc[0]), JSON.stringify({ nome: 'cadastro_vinculos', args: { p_tipo: tipo, p_id: 'x' } }));
  });
  test(`${tipo}: falha ao conferir não apaga`, async () => {
    const { window, chamadas } = montar(arquivo, { erroRpc: true });
    await assert.rejects(window[chave].remover('x'), /nada foi excluído/);
    assert.strictEqual(chamadas.delete, 0);
  });
  test(`${tipo}: sem transação exclui`, async () => {
    const { window, chamadas } = montar(arquivo, { vinculos: [] });
    await window[chave].remover('x');
    assert.strictEqual(chamadas.delete, 1);
  });
  test(`${tipo}: inativar só muda ativo (código e id intactos)`, async () => {
    const { window, chamadas } = montar(arquivo, { vinculos: [] });
    await window[chave].inativar('x');
    assert.strictEqual(Object.keys(chamadas.update).sort().join(','), 'ativo,atualizado_em');
    assert.strictEqual(chamadas.update.ativo, false);
  });
}
