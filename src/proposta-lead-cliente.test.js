/* ============================================================
   proposta-lead-cliente.test.js — passo "lead→cliente" da assinatura (proposta-store.js, executarEfeitosAssinatura)

   Auditoria #843 B2: o cliente certo do negócio é o do Formulário (achado pelo CNPJ). Se o Lead ainda não tem cliente e o
   Formulário tem, o passo grava ESTE no Lead em vez de deixar criarOuVincularDeLead casar pelo nome do prédio (que criava
   duplicado). Nos demais casos o caminho de sempre continua. Carrega o IIFE de browser num vm com um Supabase de mentira.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, 'proposta-store.js'), 'utf8');

function montar({ form, lead, clientes = [], errCliente = null }) {
  const updates = [];
  const vinculos = [];
  const sb = {
    from(nome) {
      let filtros = {};
      const q = {
        select() { return q; },
        eq(col, val) { filtros[col] = val; return q; },
        update(patch) {
          updates.push({ nome, patch, filtros });
          const r = Promise.resolve({ error: null });
          r.eq = (col, val) => { updates[updates.length - 1].filtros[col] = val; return Promise.resolve({ error: null }); };
          return r;
        },
        maybeSingle: async () => {
          if (nome === 'formularios_elevador') return { data: form || null, error: null };
          if (nome === 'leads') return { data: lead || null, error: null };
          if (nome === 'clientes') {
            if (errCliente) return { data: null, error: errCliente };
            return { data: clientes.find((c) => c.id === filtros.id) || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
  const win = {
    __VP_SB: { sb },
    CadastrosClientesStore: { criarOuVincularDeLead: async (l) => { vinculos.push(l.id); } },
    location: { origin: 'http://x' },
    crypto: undefined,
  };
  const ctx = vm.createContext({ window: win, console: { warn() {}, log() {}, error() {} }, navigator: {}, document: {}, setTimeout, clearTimeout });
  vm.runInContext(src, ctx);
  return { store: win.PropostaStore, updates, vinculos };
}

const proposta = { id: 'p1', numero_cotacao: 973, titulo: 'T', numero_documento: 'VP-1' };
const leadSemCliente = { id: 'LD-1', building: 'Edifício X', contact: 'Fulano', phone: null, email: null, cliente_id: null };

test('lead sem cliente + formulário com cliente existente: grava o cliente do formulário e NÃO cria por nome', async () => {
  const { store, updates, vinculos } = montar({ form: { lead_id: 'LD-1', cliente_id: 'cli-form' }, lead: leadSemCliente, clientes: [{ id: 'cli-form' }] });
  const falhas = await store.executarEfeitosAssinatura(proposta, { signerName: 'Cliente' });
  assert.deepStrictEqual(Array.from(falhas).filter((f) => f.startsWith('lead→cliente')), []);
  const vinculo = updates.find((u) => u.nome === 'leads' && u.patch.cliente_id);
  assert.ok(vinculo, 'deveria gravar leads.cliente_id');
  assert.strictEqual(vinculo.patch.cliente_id, 'cli-form');
  assert.strictEqual(vinculo.filtros.id, 'LD-1');
  assert.ok(updates.some((u) => u.nome === 'leads' && u.patch.status === 'Convertido'), 'lead continua marcado como Convertido');
  assert.deepStrictEqual(vinculos, [], 'criarOuVincularDeLead não deve ser chamado');
});

test('lead que já tem cliente: nada muda (segue por criarOuVincularDeLead, que respeita o cliente existente)', async () => {
  const { store, updates, vinculos } = montar({ form: { lead_id: 'LD-1', cliente_id: 'cli-form' }, lead: { ...leadSemCliente, cliente_id: 'cli-antigo' }, clientes: [{ id: 'cli-form' }] });
  await store.executarEfeitosAssinatura(proposta, {});
  assert.ok(!updates.some((u) => u.patch.cliente_id), 'não deve sobrescrever o cliente do lead');
  assert.deepStrictEqual(vinculos, ['LD-1']);
});

test('formulário sem cliente: caminho de sempre (por nome)', async () => {
  const { store, updates, vinculos } = montar({ form: { lead_id: 'LD-1', cliente_id: null }, lead: leadSemCliente });
  await store.executarEfeitosAssinatura(proposta, {});
  assert.ok(!updates.some((u) => u.patch.cliente_id));
  assert.deepStrictEqual(vinculos, ['LD-1']);
});

test('formulário aponta para cliente que não existe mais: cai no caminho por nome, sem gravar vínculo errado', async () => {
  const { store, updates, vinculos } = montar({ form: { lead_id: 'LD-1', cliente_id: 'cli-sumiu' }, lead: leadSemCliente, clientes: [] });
  await store.executarEfeitosAssinatura(proposta, {});
  assert.ok(!updates.some((u) => u.patch.cliente_id));
  assert.deepStrictEqual(vinculos, ['LD-1']);
});

test('erro ao consultar o cliente do formulário vira falha do passo (não é engolido)', async () => {
  const { store, vinculos } = montar({ form: { lead_id: 'LD-1', cliente_id: 'cli-form' }, lead: leadSemCliente, errCliente: { message: 'boom' } });
  const falhas = Array.from(await store.executarEfeitosAssinatura(proposta, {}));
  assert.ok(falhas.some((f) => f.startsWith('lead→cliente') && f.includes('boom')), JSON.stringify(falhas));
  assert.deepStrictEqual(vinculos, [], 'não deve cair no vínculo por nome quando a consulta falhou');
});

test('formulário sem lead: o passo não faz nada', async () => {
  const { store, updates, vinculos } = montar({ form: { lead_id: null, cliente_id: 'cli-form' }, lead: leadSemCliente, clientes: [{ id: 'cli-form' }] });
  await store.executarEfeitosAssinatura(proposta, {});
  assert.deepStrictEqual(updates, []);
  assert.deepStrictEqual(vinculos, []);
});
