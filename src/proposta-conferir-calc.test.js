const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-opcoes.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-conferir-calc.js'), 'utf8'))(global.window);
  return global.window.PropostaConferir;
}

function proposta(extra) {
  return {
    vendedor: { nome: 'V', celular: '(11) 99999-9999', email: 'v@verticalparts.com.br' },
    cliente: { nome: 'ACME', cnpj: '12.345.678/0001-95', email: 'a@acme.com', telefone: '(11) 3333-4444' },
    elevador: {
      textoProposta: 'Prezado cliente',
      especificacoes: [{ id: 'VPEL-EL1-1', modelo: 'X' }],
      valores: {
        formaTipo: 'parcelado',
        itens: [{ id: 'VPEL-EL1-1', equipamento: 'A', quantidade: 1, valorUnit: '100000' }, { id: 'VPEL-EL1-2', equipamento: 'B', quantidade: 1, valorUnit: '50000' }],
        parcelas: [{ valor: '60000,00' }, { valor: '90000,00' }],
      },
    },
    ...(extra || {}),
  };
}
const ids = (r) => r.map((x) => x.id);

test('proposta completa e coerente não gera achado', () => {
  const C = carregar();
  assert.deepStrictEqual(C.conferir(proposta(), 'elevador'), []);
});

test('parcelas que não somam o total: achado "impede" com a diferença em R$', () => {
  const C = carregar();
  const p = proposta();
  p.elevador.valores.parcelas = [{ valor: '60000,00' }, { valor: '80000,00' }];
  const r = C.conferir(p, 'elevador');
  const a = r.find((x) => x.id === 'parcelas-soma');
  assert.strictEqual(a.gravidade, 'impede');
  assert.strictEqual(a.secao, 'valores');
  assert.match(a.detalhe, /10\.000,00/);
});

test('cliente sem nome e sem documento, vendedor sem celular: entram na lista "o que falta"', () => {
  const C = carregar();
  const p = proposta();
  p.cliente.nome = ''; p.cliente.cnpj = ''; p.vendedor.celular = '';
  const falta = C.faltaParaEnviar(C.conferir(p, 'elevador')).map((x) => x.id);
  assert.ok(falta.includes('cliente-nome') && falta.includes('cliente-doc') && falta.includes('vendedor-celular'));
});

test('e-mail colado no campo de telefone é apontado', () => {
  const C = carregar();
  const p = proposta();
  p.cliente.telefone = 'fulano@acme.com';
  p.vendedor.celular = 'v@x.com';
  assert.deepStrictEqual(ids(C.conferir(p, 'elevador')).filter((i) => /tel-email|cel-email/.test(i)).sort(), ['cliente-tel-email', 'vendedor-cel-email']);
});

test('equipamento com valor zero e parcelado sem parcelas: "impede"', () => {
  const C = carregar();
  const p = proposta();
  p.elevador.valores.itens[1].valorUnit = '0';
  p.elevador.valores.parcelas = [];
  const r = C.conferir(p, 'elevador');
  assert.ok(ids(r).includes('item-zero-VPEL-EL1-2'));
  assert.ok(ids(r).includes('parcelas-vazias'));
});

test('todos os equipamentos ocultos: "impede"', () => {
  const C = carregar();
  const p = proposta();
  p.elevador.valores.ocultos = ['VPEL-EL1-1', 'VPEL-EL1-2'];
  assert.ok(ids(C.conferir(p, 'elevador')).includes('todos-ocultos'));
});

test('pedido de aumento e de desconto abertos viram "atenção"', () => {
  const C = carregar();
  const p = proposta();
  p.elevador.valores.itens[0].aumentoPendente = { valorPedido: 1 };
  p.elevador.valores.itens[1].descontoPendente = { papel: 'ceo' };
  const r = C.conferir(p, 'elevador');
  assert.deepStrictEqual(r.filter((x) => /aberto/.test(x.id)).map((x) => x.gravidade), ['atencao', 'atencao']);
});

test('contrato existente e proposta travada só aparecem quando o contexto diz', () => {
  const C = carregar();
  assert.ok(!ids(C.conferir(proposta(), 'elevador')).includes('contrato-existe'));
  const r = ids(C.conferir(proposta(), 'elevador', { temContrato: true, travada: true }));
  assert.ok(r.includes('contrato-existe') && r.includes('travada'));
});

test('texto de passageiro em perfil de carga é sugestão; a conferência nunca altera a proposta', () => {
  const C = carregar();
  const p = proposta();
  p.elevador.perfis = [{ id: 'c', nome: 'Carga', tipo: 'carga', textoModelos: 'viagens confortáveis para passageiros' }];
  const antes = JSON.stringify(p);
  const r = C.conferir(p, 'elevador');
  assert.strictEqual(r.find((x) => /perfil-tipo/.test(x.id)).gravidade, 'sugestao');
  assert.strictEqual(JSON.stringify(p), antes);
});

test('ordena do mais grave ao mais leve e resume as contagens', () => {
  const C = carregar();
  const p = proposta();
  p.cliente.nome = ''; p.vendedor.email = '';
  const r = C.conferir(p, 'elevador', { travada: true });
  assert.strictEqual(r[0].gravidade, 'impede');
  const c = C.resumo(r);
  assert.deepStrictEqual([c.impede, c.sugestao >= 1], [1, true]);
});
