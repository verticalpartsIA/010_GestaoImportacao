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

/* T3 #1223 e T4 #1224 */
function montarLeitura(arquivo, { paginas, erroNaPagina, rpc }) {
  let chamadaRange = 0;
  const sb = {
    rpc: async () => rpc || { data: null, error: { message: 'sem função' } },
    from() {
      const q = {
        select() { return q; }, order() { return q; }, eq() { return q; }, contains() { return q; },
        range: async () => {
          const i = chamadaRange++;
          if (erroNaPagina === i) return { data: null, error: { message: 'timeout' } };
          return { data: paginas[i] || [], error: null };
        },
      };
      return q;
    },
  };
  const window = { __VP_SB: { sb }, VPLog: { registrar() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), { window, console });
  return window;
}
const mil = (n) => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, fornecedor_id: 'f', nota: 4 }));

test('fornecedores: lista passa de 1000 linhas', async () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [mil(1000), mil(5)] });
  const r = await w.CadastrosFornecedoresStore.listarTodosDetalhado();
  assert.strictEqual(r.itens.length, 1005); assert.strictEqual(r.erro, null);
});
test('fornecedores: falha no meio vira aviso, não lista calada', async () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [mil(1000)], erroNaPagina: 1 });
  const r = await w.CadastrosFornecedoresStore.listarTodosDetalhado();
  assert.strictEqual(r.itens.length, 1000); assert.strictEqual(r.erro, 'timeout');
});
test('clientes: falha no meio vira aviso', async () => {
  const w = montarLeitura('cadastros-clientes-store.js', { paginas: [mil(1000)], erroNaPagina: 1 });
  const r = await w.CadastrosClientesStore.listarTodosDetalhado();
  assert.strictEqual(r.itens.length, 1000); assert.strictEqual(r.erro, 'timeout');
});
test('fornecedores: média soma as avaliações das duas páginas', async () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [mil(1000), mil(2)] });
  const m = await w.CadastrosFornecedoresStore.mediasAvaliacoes();
  assert.strictEqual(m.f.qtd, 1002);
});
test('fornecedores: código vem do banco; falha não inventa VPFOR-0001', async () => {
  const ok = montarLeitura('cadastros-fornecedores-store.js', { paginas: [], rpc: { data: 'VPFOR-0083', error: null } });
  assert.strictEqual(await ok.CadastrosFornecedoresStore.gerarCodigo(), 'VPFOR-0083');
  const falha = montarLeitura('cadastros-fornecedores-store.js', { paginas: [] });
  await assert.rejects(falha.CadastrosFornecedoresStore.gerarCodigo(), /gerar_codigo_fornecedor/);
});
