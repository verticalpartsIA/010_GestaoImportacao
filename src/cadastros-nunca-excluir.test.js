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

/* T2 #1222 — documento único */
function montarDoc(arquivo, { existente, erroBusca, erroInsert }) {
  const chamadas = { insert: 0, update: 0, rpc: 0 };
  const sb = {
    rpc: async () => { chamadas.rpc += 1; return { data: 'COD-0001', error: null }; },
    from() {
      let op = 'select';
      const q = {
        select() { return q; }, eq() { return q; }, neq() { return q; }, limit() { return q; },
        insert() { op = 'insert'; chamadas.insert += 1; return q; },
        update() { op = 'update'; chamadas.update += 1; return q; },
        single: async () => (op === 'insert' && erroInsert ? { data: null, error: erroInsert } : { data: { id: 'n', razao_social: 'ACME' }, error: null }),
        then(res) { return Promise.resolve(erroBusca ? { data: null, error: { message: 'timeout' } } : { data: existente ? [existente] : [], error: null }).then(res); },
      };
      return q;
    },
  };
  const window = { __VP_SB: { sb }, VPLog: { registrar() {} }, EnderecoAPI: undefined };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), { window, console });
  return { window, chamadas };
}
const CNPJ = '11222333000181';
for (const [arquivo, chave, extra] of [['cadastros-clientes-store.js', 'CadastrosClientesStore', {}], ['cadastros-fornecedores-store.js', 'CadastrosFornecedoresStore', { categorias: ['Fornecedor'] }]]) {
  const form = { razao_social: 'ACME', tipo_pessoa: 'PJ', cnpj: CNPJ, ...extra };
  test(`${chave}: CNPJ repetido não grava e diz qual cadastro usa`, async () => {
    const { window, chamadas } = montarDoc(arquivo, { existente: { id: 'o', codigo: 'VPXX-0007', razao_social: 'Outra', ativo: false } });
    await assert.rejects(window[chave].criar(form), /já está cadastrado em VPXX-0007.*inativo/);
    assert.strictEqual(chamadas.insert, 0); assert.strictEqual(chamadas.rpc, 0);
  });
  test(`${chave}: falha ao conferir não grava`, async () => {
    const { window, chamadas } = montarDoc(arquivo, { erroBusca: true });
    await assert.rejects(window[chave].criar(form), /nada foi gravado/);
    assert.strictEqual(chamadas.insert, 0);
  });
  test(`${chave}: editar com CNPJ de outro não grava`, async () => {
    const { window, chamadas } = montarDoc(arquivo, { existente: { id: 'o', codigo: 'VPXX-0007', razao_social: 'Outra' } });
    await assert.rejects(window[chave].atualizar('meu', form), /já está cadastrado/);
    assert.strictEqual(chamadas.update, 0);
  });
  test(`${chave}: recusa do índice único vira mensagem clara`, async () => {
    const { window } = montarDoc(arquivo, { erroInsert: { code: '23505', message: 'duplicate key value violates unique constraint "x_cnpj_unico"' } });
    await assert.rejects(window[chave].criar(form), /CNPJ\/CPF já está cadastrado/);
  });
  test(`${chave}: sem documento não consulta e grava`, async () => {
    const { window, chamadas } = montarDoc(arquivo, {});
    await window[chave].criar({ ...form, cnpj: '' });
    assert.strictEqual(chamadas.insert, 1);
  });
}

/* T8 #1228 — lead com nome igual a vários clientes */
function montarHomonimo(lista) {
  const vinc = {};
  const sb = {
    from(tab) {
      let patch = null;
      const q = {
        select() { return q; }, ilike() { return q; }, limit() { return q; }, is() { return q; },
        eq(col, val) { if (patch && tab === 'leads') vinc.cliente_id = patch.cliente_id; return q; },
        update(p) { patch = p; return q; },
        maybeSingle: async () => ({ data: { cliente_id: null }, error: null }),
        then(res) { return Promise.resolve(tab === 'clientes' && !patch ? { data: lista, error: null } : { data: [], error: null }).then(res); },
      };
      return q;
    },
  };
  const window = { __VP_SB: { sb }, VPLog: { registrar() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'cadastros-clientes-store.js'), 'utf8'), { window, console: { warn() {}, error() {}, log() {} } });
  return { window, vinc };
}
test('lead → cliente: desempata homônimo pelo e-mail', async () => {
  const { window } = montarHomonimo([{ id: 'a', email: 'x@a.com' }, { id: 'b', email: 'compras@b.com' }]);
  const id = await window.CadastrosClientesStore.criarOuVincularDeLead({ id: 'L1', building: 'ACME', email: 'compras@b.com' });
  assert.strictEqual(id, 'b');
});
test('lead → cliente: desempata pelo telefone e prefere ativo', async () => {
  const { window } = montarHomonimo([{ id: 'a', telefone: '(11) 9999-0000', ativo: false }, { id: 'b', telefone: '11 98888-7777' }, { id: 'c', telefone: '' }]);
  assert.strictEqual(await window.CadastrosClientesStore.criarOuVincularDeLead({ id: 'L1', building: 'ACME', phone: '+55 11 98888-7777' }), 'b');
  const s2 = montarHomonimo([{ id: 'a', ativo: false }, { id: 'b' }]);
  assert.strictEqual(await s2.window.CadastrosClientesStore.criarOuVincularDeLead({ id: 'L1', building: 'ACME' }), 'b');
});

/* T6 #1226 — vínculo do fornecedor pelo nome */
test('fornecedor: liga pelo nome só quando bate com UM cadastro', () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [] });
  const S = w.CadastrosFornecedoresStore;
  const lista = [
    { id: 'g', razao_social: 'GLARIE ELEVATOR CO.,LTD', nome_fantasia: 'Glarie' },
    { id: 'a1', razao_social: 'Agente Ágil', nome_fantasia: null },
    { id: 'a2', razao_social: 'Outra Razão', nome_fantasia: 'agente agil' },
  ];
  assert.strictEqual(S.idPorNome(lista, ' glarie '), 'g');
  assert.strictEqual(S.idPorNome(lista, 'GLARIE ELEVATOR CO.,LTD'), 'g');
  assert.strictEqual(S.idPorNome(lista, 'Agente Agil'), null, 'dois cadastros com o mesmo nome = sem vínculo');
  assert.strictEqual(S.idPorNome(lista, 'Agente Agil', 'a2'), 'a2', 'vínculo anterior que ainda casa é mantido');
  assert.strictEqual(S.idPorNome(lista, 'Glar'), null, 'nome parcial não liga');
  assert.strictEqual(S.idPorNome(lista, 'Glarie', 'a1'), 'g', 'vínculo anterior que não casa mais é trocado');
  assert.strictEqual(S.idPorNome(lista, ''), null);
});

/* T5 #1225 — RFQ de importação liga o fornecedor ao cadastro */
test('fornecedor: resolverPorNome devolve id e código VPFOR, ou nada', async () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [[
    { id: 'g', codigo: 'VPFOR-0007', razao_social: 'GLARIE ELEVATOR CO.,LTD', nome_fantasia: 'Glarie' },
    { id: 'a1', codigo: 'VPFOR-0008', razao_social: 'Agente', nome_fantasia: null },
    { id: 'a2', codigo: 'VPFOR-0009', razao_social: 'agente', nome_fantasia: null },
  ]] });
  const S = w.CadastrosFornecedoresStore;
  assert.strictEqual(JSON.stringify(await S.resolverPorNome('glarie')), JSON.stringify({ id: 'g', codigo: 'VPFOR-0007', nome: 'GLARIE ELEVATOR CO.,LTD' }));
  assert.strictEqual(await S.resolverPorNome('Agente'), null);
  assert.strictEqual(await S.resolverPorNome('Inexistente'), null);
  assert.strictEqual(await S.resolverPorNome(''), null);
});
test('fornecedor: resolverPorNome avisa quando não consegue ler o cadastro', async () => {
  const w = montarLeitura('cadastros-fornecedores-store.js', { paginas: [], erroNaPagina: 0 });
  assert.strictEqual(JSON.stringify(await w.CadastrosFornecedoresStore.resolverPorNome('Glarie')), JSON.stringify({ erro: true }));
});
test('rfq.jsx: entrada ligada guarda cadastro_id/código; nome livre só com confirmação', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rfq.jsx'), 'utf8');
  assert.match(src, /cadastro_id: cad\.id, cadastro_codigo/);
  assert.match(src, /nome_livre: true/);
  assert.match(src, /window\.confirm\(/);
});
