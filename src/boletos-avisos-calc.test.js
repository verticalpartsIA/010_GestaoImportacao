'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
require('./boletos-avisos-calc.js');
const C = window.BoletosAvisosCalc;

// ---- etapas dos avisos (D-5, D-1, D0, D+1) ----
test('boleto que vence em 5 dias recebe a etapa D-5', () => {
  assert.equal(C.etapaDevida('2026-11-16', '2026-11-11', []), 'D-5');
});
test('um dia antes do vencimento é D-1; no dia é D0; um dia depois é D+1', () => {
  assert.equal(C.etapaDevida('2026-11-12', '2026-11-11', []), 'D-1');
  assert.equal(C.etapaDevida('2026-11-11', '2026-11-11', []), 'D0');
  assert.equal(C.etapaDevida('2026-11-10', '2026-11-11', []), 'D+1');
});
test('entre as etapas não há aviso (faltam 3 dias, por exemplo)', () => {
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-11', []), null);   // quarta, faltam 3 dias
  assert.equal(C.etapaDevida('2026-11-20', '2026-11-11', []), null);
});
test('etapa já enviada não se repete', () => {
  assert.equal(C.etapaDevida('2026-11-16', '2026-11-11', ['D-5']), null);
  assert.equal(C.etapaDevida('2026-11-11', '2026-11-11', ['D-5', 'D-1']), 'D0');
});
test('segunda-feira recupera a etapa que caiu no fim de semana (D-5 de um boleto de quinta)', () => {
  // 19/11 (quinta): o D-5 cai no sábado 14/11; a rotina só roda de segunda a sexta
  assert.equal(C.etapaDevida('2026-11-19', '2026-11-16', []), 'D-5');
});
test('boleto de domingo: na segunda sai o D+1 (a mais recente vence a do fim de semana)', () => {
  assert.equal(C.etapaDevida('2026-11-15', '2026-11-16', []), 'D+1');
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-16', []), 'D+1');
});
test('fora da segunda-feira não há recuperação: o que passou do dia não é cobrado depois', () => {
  assert.equal(C.etapaDevida('2026-11-10', '2026-11-12', []), null);   // quinta, D+1 era quarta
  assert.equal(C.etapaDevida('2026-11-07', '2026-11-11', []), null);
});

// ---- semáforo ----
test('semáforo: atrasado, vence hoje e em dia', () => {
  assert.equal(C.situacaoDoBoleto('2026-11-10', '2026-11-11'), 'atrasado');
  assert.equal(C.situacaoDoBoleto('2026-11-11', '2026-11-11'), 'vence_hoje');
  assert.equal(C.situacaoDoBoleto('2026-11-12', '2026-11-11'), 'em_dia');
});
test('dias de atraso contam por dia de calendário, também na virada de mês', () => {
  assert.equal(C.diasDesdeVencimento('2026-10-30', '2026-11-02'), 3);
});
test('hoje no Brasil (UTC-3): 01h UTC ainda é o dia anterior em Brasília', () => {
  assert.equal(C.hojeBrasil(Date.UTC(2026, 10, 11, 1, 0)), '2026-11-10');
  assert.equal(C.hojeBrasil(Date.UTC(2026, 10, 11, 12, 0)), '2026-11-11');
});

// ---- texto do aviso ----
const b1 = { numero_documento: '00021398', numero_parcela: '004/004', data_vencimento: '2026-11-11', valor: 4815.27, linha_digitavel: '34191.09008 00015.387582' };
test('assunto e texto do aviso D-1 citam o cliente, a NF, o vencimento e o valor', () => {
  const m = C.montarAviso('ACME LTDA', [b1], 'D-1');
  assert.equal(m.assunto, 'Seu boleto vence amanhã — ACME LTDA');
  assert.match(m.texto, /NF 00021398 · parcela 004\/004 — vencimento 11\/11\/2026 — R\$\s4\.815,27/);
  assert.match(m.texto, /Linha digitável: 34191\.09008 00015\.387582/);
  assert.match(m.texto, /responda este e-mail com o comprovante/);
});
test('o aviso fala no plural quando há mais de um boleto', () => {
  const m = C.montarAviso('ACME LTDA', [b1, { ...b1, numero_parcela: '003/004' }], 'D+1');
  assert.match(m.texto, /os boletos abaixo venceram e ainda não constam como pagos/);
  assert.equal(m.assunto, 'Boleto vencido — regularize o pagamento — ACME LTDA');
});
test('boleto sem linha digitável não imprime a linha vazia', () => {
  const m = C.montarAviso('ACME LTDA', [{ ...b1, linha_digitavel: null }], 'D0');
  assert.doesNotMatch(m.texto, /Linha digitável/);
});
test('aviso manual não promete data', () => {
  const m = C.montarAviso('ACME LTDA', [b1], 'manual');
  assert.equal(m.assunto, 'Boletos em aberto — ACME LTDA');
});

// ---- paridade com a Edge Function ----
const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
function bloco(texto) {
  const m = /\/\/ BEGIN CALC[^\n]*\n([\s\S]*?)\/\/ END CALC/.exec(texto);
  return m ? m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n') : null;
}
test('a regra da Edge Function boletos-avisos é igual à da tela (src/boletos-avisos-calc.js)', () => {
  const tela = bloco(ler('src/boletos-avisos-calc.js'));
  const funcao = bloco(ler('supabase/functions/boletos-avisos/index.ts'));
  assert.ok(tela && funcao, 'blocos BEGIN/END CALC não encontrados');
  assert.equal(funcao, tela);
});

// ---- segurança: a lista de acesso e o envio ----
test('a migration trava a tela só para Gelson, Diego e Juliana (sem bypass de Administrador)', () => {
  const sql = ler('supabase/migrations/20261111100000_boletos_avisos.sql');
  const lista = /array\[([\s\S]*?)\]/.exec(sql.slice(sql.indexOf('boletos_avisos_email_permitido')))[1].match(/'[^']+'/g).map((s) => s.slice(1, -1)).sort();
  assert.deepEqual(lista, ['diego@verticalparts.com.br', 'gelson.simoes@verticalparts.com.br', 'juliana@verticalparts.com.br']);
  assert.doesNotMatch(sql, /vp_eh_admin/);
  assert.match(sql, /revoke all on public\.boletos_avisos_config, public\.boletos_avisos_clientes[\s\S]*from anon, authenticated/);
});
test('o envio automático nasce desligado', () => {
  const sql = ler('supabase/migrations/20261111100000_boletos_avisos.sql');
  assert.match(sql, /envio_automatico boolean not null default false/);
});
test('a função nunca usa o destinatário que vier no corpo da requisição', () => {
  const f = ler('supabase/functions/boletos-avisos/index.ts');
  assert.doesNotMatch(f, /p\.para|p\.to\b|payload\.to/);
});
