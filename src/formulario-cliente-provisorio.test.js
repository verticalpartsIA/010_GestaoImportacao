/* ============================================================
   formulario-cliente-provisorio.test.js — buscarOuCriarCliente com clienteIdProvisorio
   (formulario-elevador-store.js). A janela de Lead usa esse caminho para atualizar o cliente vinculado e NÃO
   informa endereço nem IE: o update não pode zerar o que o cadastro já tem. O Formulário, que informa os campos,
   continua sobrescrevendo-os.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, 'formulario-elevador-store.js'), 'utf8');

function montar() {
  const gravacoes = [];
  const sb = {
    from(nome) {
      const q = {
        update(patch) { gravacoes.push({ nome, patch }); return q; },
        eq() { return q; },
        select() { return q; },
        single: async () => ({ data: { id: 'CLI-1' }, error: null }),
      };
      return q;
    },
  };
  const win = { __VP_SB: { sb }, location: { origin: 'http://x' } };
  const ctx = vm.createContext({ window: win, console, Date, Math, Promise, String, Set, Object, Array });
  vm.runInContext(src, ctx);
  return { store: win.FormularioElevadorStore, gravacoes };
}

test('Lead sem endereço/IE: atualizar o cliente vinculado não apaga endereço, cidade, UF nem IE', async () => {
  const { store, gravacoes } = montar();
  await store.buscarOuCriarCliente({ tipo_pessoa: 'PJ', razao_social: 'ACME', contato: 'Ana', telefone: '11999990000', email: 'a@b.com', clienteIdProvisorio: 'CLI-1' });
  const patch = gravacoes[0].patch;
  for (const k of ['inscricao_estadual', 'endereco_logradouro', 'endereco_complemento', 'endereco_bairro', 'endereco_cep', 'endereco_cidade', 'endereco_estado', 'endereco', 'cidade', 'estado']) {
    assert.ok(!(k in patch), 'não deve sobrescrever ' + k);
  }
  assert.strictEqual(patch.razao_social, 'ACME');
  assert.strictEqual(patch.contato, 'Ana');
});

test('Formulário informando o endereço: o update continua gravando endereço e o texto composto', async () => {
  const { store, gravacoes } = montar();
  await store.buscarOuCriarCliente({ tipo_pessoa: 'PJ', razao_social: 'ACME', endereco_logradouro: 'Rua A, 10', endereco_cidade: 'Santos', endereco_estado: 'SP', endereco_cep: '', clienteIdProvisorio: 'CLI-1' });
  const patch = gravacoes[0].patch;
  assert.strictEqual(patch.endereco_logradouro, 'Rua A, 10');
  assert.strictEqual(patch.endereco_cidade, 'Santos');
  assert.ok(patch.endereco && patch.endereco.includes('Rua A, 10'));
  assert.strictEqual(patch.endereco_cep, null, 'campo informado vazio limpa de propósito');
});
