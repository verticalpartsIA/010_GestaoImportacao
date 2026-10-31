/* ============================================================
   formulario-elevador-escada-calc.test.js

   Formulário de Escada/Esteira Rolante (29/10/2026) — Tipo de equipamento
   escolhido no 1º card decide a URL (feRotaPorTipoEquipamento), a
   velocidade disponível depende da Aplicação/Uso (feOpcoesVelocidadeEscadaEsteira)
   e o aviso de inclinação/apoio intermediário depende do desnível vertical
   (feDesnivelAcimaDe6m) — 3 funções puras, sem JSX, extraídas de
   formulario-elevador.jsx (mesma técnica de proposta-preview-espec.test.js:
   o arquivo é JSX/UMD de browser, sem module.exports, então o trecho é
   recortado do fonte e avaliado isoladamente).
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'formulario-elevador.jsx'), 'utf8');

function linhaDe(constNome) {
  const re = new RegExp('const ' + constNome + ' = .*;');
  const m = re.exec(src);
  assert.ok(m, `const ${constNome} não encontrada em formulario-elevador.jsx`);
  return m[0];
}
function funcaoDe(nome) {
  const i = src.indexOf('function ' + nome + '(');
  assert.ok(i >= 0, `função ${nome} não encontrada em formulario-elevador.jsx`);
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) break; }
  }
  return src.slice(i, j + 1);
}

/* Num eval() só — `const` declarado num eval direto não vaza pro escopo de
   fora (diferente de `function`, que vaza em modo não-estrito); juntando a
   const e a função no MESMO eval, o fechamento (closure) da função continua
   enxergando a const do jeito certo, e a função em si fica chamável fora. */
// eslint-disable-next-line no-eval
eval(linhaDe('FE_ROTA_POR_TIPO_EQUIPAMENTO') + '\n' + funcaoDe('feRotaPorTipoEquipamento'));
// eslint-disable-next-line no-eval
eval(funcaoDe('feOpcoesVelocidadeEscadaEsteira'));
// eslint-disable-next-line no-eval
eval(funcaoDe('feDesnivelAcimaDe6m'));

test('feRotaPorTipoEquipamento — elevador/escada/esteira mapeiam pras 3 rotas; tipo desconhecido cai em elevador', () => {
  assert.equal(feRotaPorTipoEquipamento('elevador'), 'formulario-elevador');
  assert.equal(feRotaPorTipoEquipamento('escada'), 'formulario-escada');
  assert.equal(feRotaPorTipoEquipamento('esteira'), 'formulario-esteira');
  assert.equal(feRotaPorTipoEquipamento(undefined), 'formulario-elevador');
  assert.equal(feRotaPorTipoEquipamento('lixo'), 'formulario-elevador');
});

test('feOpcoesVelocidadeEscadaEsteira — Comercial só 0,50 m/s; Alto Tráfego libera 0,65/0,75', () => {
  assert.deepEqual(feOpcoesVelocidadeEscadaEsteira('Comercial'), ['0,50 m/s']);
  assert.deepEqual(feOpcoesVelocidadeEscadaEsteira(''), ['0,50 m/s']);
  assert.deepEqual(feOpcoesVelocidadeEscadaEsteira(undefined), ['0,50 m/s']);
  assert.deepEqual(feOpcoesVelocidadeEscadaEsteira('Alto Tráfego'), ['0,65 m/s', '0,75 m/s']);
});

test('feDesnivelAcimaDe6m — escada usa desnivel_elevacao, esteira usa desnivel_vertical; aceita vírgula decimal', () => {
  assert.equal(feDesnivelAcimaDe6m({ desnivel_elevacao: '6450' }, 'escada'), true);
  assert.equal(feDesnivelAcimaDe6m({ desnivel_elevacao: '5,04 m' }, 'escada'), false); // "5,04" vira 5.04, não 5040 — texto livre não é mm puro
  assert.equal(feDesnivelAcimaDe6m({ desnivel_elevacao: '3390' }, 'escada'), false);
  assert.equal(feDesnivelAcimaDe6m({ desnivel_vertical: '8000' }, 'esteira'), true);
  assert.equal(feDesnivelAcimaDe6m({ desnivel_vertical: '2500' }, 'esteira'), false);
  assert.equal(feDesnivelAcimaDe6m({}, 'escada'), false);
  assert.equal(feDesnivelAcimaDe6m({ desnivel_elevacao: '6450' }, 'esteira'), false); // chave errada pro tipo não confere nada
});
