/* ============================================================
   formulario-elevador-dono.test.js — dono do formulário (formulario-elevador-store.js)

   O vendedor que cria um formulário (created_by) é o dono: outro vendedor só abre/edita
   com a alçada formularios.ver_de_outros. Sem e-mail (página pública do cliente) ou sem
   dono gravado, o acesso segue livre. Carrega o IIFE de browser num vm com um Supabase
   de mentira.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, 'formulario-elevador-store.js'), 'utf8');

function montar({ email, temAlcada, formularios, unidades }) {
  const gravacoes = [];
  const tabela = (nome) => (nome === 'formularios_elevador' ? formularios : nome === 'formularios_elevador_unidades' ? unidades : []);
  const sb = {
    from(nome) {
      let linhas = tabela(nome).slice();
      const q = {
        select() { return q; },
        order() { return q; },
        eq(col, val) { linhas = linhas.filter((l) => l[col] === val); return q; },
        update(patch) { gravacoes.push({ nome, patch }); linhas = []; return q; },
        maybeSingle: async () => ({ data: linhas[0] || null, error: null }),
        single: async () => ({ data: linhas[0] || null, error: linhas[0] ? null : { message: 'not found' } }),
        then(res) { return Promise.resolve({ data: linhas, error: null }).then(res); },
      };
      return q;
    },
  };
  const win = {
    __VP_SB: { sb },
    __VP_USER: email ? { email } : undefined,
    PropostaStore: { temCapacidade: async (m, c) => !!temAlcada && m === 'formularios' && c === 'ver_de_outros' },
    location: { origin: 'http://x' },
  };
  const ctx = vm.createContext({ window: win, console, Date, Math, Promise, String, Set, Object, Array });
  vm.runInContext(src, ctx);
  return { store: win.FormularioElevadorStore, gravacoes };
}

const FORMS = [
  { id: 'FE-A', numero_cotacao: 982, created_by: 'vagner@verticalparts.com.br', status: 'rascunho' },
  { id: 'FE-B', numero_cotacao: 983, created_by: 'regiane.rocha@verticalparts.com.br', status: 'rascunho' },
  { id: 'FE-C', numero_cotacao: 900, created_by: null, status: 'rascunho' },
];
const UNIDADES = [{ id: 'FEU-1', formulario_id: 'FE-A' }];

test('dono abre e salva o próprio formulário', async () => {
  const { store, gravacoes } = montar({ email: 'Vagner@verticalparts.com.br', formularios: FORMS, unidades: UNIDADES });
  const f = await store.obter('FE-A');
  assert.equal(f.numero_cotacao, 982);
  await store.salvar('FE-A', { observacoes: 'ok' });
  assert.equal(gravacoes.length, 1);
});

test('outro vendedor SEM alçada não abre, não salva, não mexe em unidade', async () => {
  const { store, gravacoes } = montar({ email: 'victor.caruso@verticalparts.com.br', temAlcada: false, formularios: FORMS, unidades: UNIDADES });
  await assert.rejects(() => store.obter('FE-A'), /criada por outro vendedor/);
  await assert.rejects(() => store.salvar('FE-A', { observacoes: 'invasão' }), /criada por outro vendedor/);
  await assert.rejects(() => store.atualizarUnidade('FEU-1', { x: 1 }), /criada por outro vendedor/);
  await assert.rejects(() => store.removerUnidade('FEU-1'), /criada por outro vendedor/);
  await assert.rejects(() => store.adicionarUnidade('FE-A', {}), /criada por outro vendedor/);
  assert.equal(gravacoes.length, 0, 'nada pode ter sido gravado');
});

test('outro vendedor COM a alçada ver_de_outros passa', async () => {
  const { store } = montar({ email: 'juliana@verticalparts.com.br', temAlcada: true, formularios: FORMS, unidades: UNIDADES });
  const f = await store.obter('FE-A');
  assert.equal(f.created_by, 'vagner@verticalparts.com.br');
});

test('sem e-mail (página pública do cliente) o acesso segue livre', async () => {
  const { store } = montar({ email: null, formularios: FORMS, unidades: UNIDADES });
  const f = await store.obter('FE-A');
  assert.equal(f.id, 'FE-A');
});

test('formulário sem dono gravado (legado) segue livre', async () => {
  const { store } = montar({ email: 'victor.caruso@verticalparts.com.br', temAlcada: false, formularios: FORMS, unidades: UNIDADES });
  const f = await store.obter('FE-C');
  assert.equal(f.id, 'FE-C');
});

test('listar: restrito só enxerga os próprios; com alçada vê todos', async () => {
  const restrito = montar({ email: 'vagner@verticalparts.com.br', temAlcada: false, formularios: FORMS, unidades: UNIDADES });
  const meus = await restrito.store.listar();
  assert.deepEqual(meus.map((f) => f.id).sort(), ['FE-A', 'FE-C']); // o seu + o sem dono

  const livre = montar({ email: 'vagner@verticalparts.com.br', temAlcada: true, formularios: FORMS, unidades: UNIDADES });
  assert.equal((await livre.store.listar()).length, 3);
});
