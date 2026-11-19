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
test('um dia antes do vencimento é D-1; no dia é D0; 2 dias úteis depois é o aviso de atraso (D+1)', () => {
  assert.equal(C.etapaDevida('2026-11-12', '2026-11-11', []), 'D-1');
  assert.equal(C.etapaDevida('2026-11-11', '2026-11-11', []), 'D0');
  assert.equal(C.etapaDevida('2026-11-10', '2026-11-11', []), null);
  assert.equal(C.etapaDevida('2026-11-10', '2026-11-12', []), 'D+1');
});
test('entre as etapas não há aviso (faltam 3 dias, por exemplo)', () => {
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-11', []), null);   // quarta, faltam 3 dias
  assert.equal(C.etapaDevida('2026-11-20', '2026-11-11', []), null);
});
test('etapa já enviada não se repete', () => {
  assert.equal(C.etapaDevida('2026-11-16', '2026-11-11', ['D-5']), null);
  assert.equal(C.etapaDevida('2026-11-11', '2026-11-11', ['D-5', 'D-1']), 'D0');
});
test('etapa que cairia no fim de semana vai para o próximo dia útil (D-5 de um boleto de quinta)', () => {
  // 19/11 (quinta): o D-5 cai no sábado 14/11; a rotina só roda de segunda a sexta
  assert.equal(C.etapaDevida('2026-11-19', '2026-11-16', []), 'D-5');
});
test('boleto que vence no fim de semana: o vencimento vale na segunda (D0), o atraso só na quarta', () => {
  assert.equal(C.etapaDevida('2026-11-15', '2026-11-16', []), 'D0');
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-16', []), 'D0');
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-17', []), null);
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-18', []), 'D+1');
  assert.equal(C.etapaDevida('2026-11-14', '2026-11-13', []), 'D-1');   // sexta antes
});
test('fora da segunda-feira não há recuperação: o que passou do dia não é cobrado depois', () => {
  assert.equal(C.etapaDevida('2026-11-09', '2026-11-12', []), null);   // quinta, o aviso de atraso era quarta
  assert.equal(C.etapaDevida('2026-11-06', '2026-11-11', []), null);   // sexta: o aviso de atraso era terça
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
  assert.match(m.texto, /Para evitar encargos por atraso/);
  assert.match(m.texto, /Atenciosamente,\nFinanceiro — VerticalParts$/);
});
test('o aviso fala no plural quando há mais de um boleto', () => {
  const m = C.montarAviso('ACME LTDA', [b1, { ...b1, numero_parcela: '003/004' }], 'D+1');
  assert.match(m.texto, /não identificamos o pagamento dos boletos abaixo, já vencidos:/);
  assert.match(m.texto, /Se já pagou: responda este e-mail com o comprovante para darmos baixa/);
  assert.equal(m.assunto, 'Boletos em aberto — vencidos — ACME LTDA');
});
test('boleto sem linha digitável não imprime a linha vazia', () => {
  const m = C.montarAviso('ACME LTDA', [{ ...b1, linha_digitavel: null }], 'D0');
  assert.doesNotMatch(m.texto, /Linha digitável/);
});
test('as 4 etapas têm os textos aprovados em 17/11/2026 (boleto)', () => {
  assert.equal(C.montarAviso('ACME', [b1], 'D-5').assunto, 'Lembrete: boleto vence em 5 dias — ACME');
  assert.match(C.montarAviso('ACME', [b1], 'D-5').texto, /^Olá, tudo bem\?\n\nPassando para lembrar que o boleto abaixo vence em 5 dias:/);
  assert.match(C.montarAviso('ACME', [b1], 'D-5').texto, /Precisa da 2ª via ou tem alguma dúvida\? É só responder esta mensagem\./);
  assert.match(C.montarAviso('ACME', [b1], 'D-1').texto, /O boleto abaixo vence amanhã:/);
  assert.match(C.montarAviso('ACME', [b1], 'D0').texto, /Se o pagamento já foi feito, obrigado e desconsidere esta mensagem\./);
  assert.match(C.montarAviso('ACME', [b1], 'D0').texto, /Se precisar da 2ª via, responda este e-mail\./);
  assert.match(C.montarAviso('ACME', [b1], 'D+1').texto, /solicitamos a regularização imediata, sujeita aos encargos por atraso\. A 2ª via atualizada pode ser solicitada respondendo este e-mail\./);
  for (const e of ['D0', 'D+1']) assert.doesNotMatch(C.montarAviso('ACME', [b1], e).texto, /nova data|combinamos|ajudamos/);
  assert.equal(C.montarAviso('ACME', [b1], 'D+1').assunto, 'Boleto em aberto — vencido — ACME');
});
test('aviso de atraso sem boleto pede o comprovante do depósito e não fala em 2ª via', () => {
  const m = C.montarAviso('ESCAMAX', [{ numero_documento: '1', data_vencimento: '2026-11-10', valor: 5, tem_boleto: false }], 'D+1');
  assert.equal(m.assunto, 'Pagamento em aberto — vencido — ESCAMAX');
  assert.match(m.texto, /o pagamento abaixo, já vencido, ainda não consta como recebido:/);
  assert.match(m.texto, /comprovante do depósito ou da transferência/);
  assert.doesNotMatch(m.texto, /2ª via/);
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

// ---- impacto financeiro ----
test('resumo financeiro separa a vencer, vence hoje e atrasado (1–30 e mais de 30 dias) em reais', () => {
  const hoje = '2026-11-11';
  const bs = [
    { codigo_cliente_omie: 1, data_vencimento: '2026-11-20', valor: 1000.10 },   // a vencer
    { codigo_cliente_omie: 1, data_vencimento: '2026-11-11', valor: 500.05 },    // vence hoje
    { codigo_cliente_omie: 2, data_vencimento: '2026-11-01', valor: 250 },       // 10 dias
    { codigo_cliente_omie: 3, data_vencimento: '2026-10-12', valor: 300 },       // 30 dias (ainda até 30)
    { codigo_cliente_omie: 3, data_vencimento: '2026-10-09', valor: 400.40 },    // 33 dias (sexta; domingo 11/10 valeria na segunda)
  ];
  const r = C.resumoFinanceiro(bs, hoje);
  assert.equal(r.aVencer.valor, 1000.10);
  assert.equal(r.venceHoje.valor, 500.05);
  assert.equal(r.atrasado30.valor, 550);
  assert.equal(r.atrasadoMais30.valor, 400.40);
  assert.equal(r.atrasado.valor, 950.40);
  assert.equal(r.atrasado.clientes, 2);
  assert.equal(r.total.valor, 2450.55);
  assert.equal(r.total.boletos, 5);
  assert.equal(r.total.clientes, 3);
});
test('resumo financeiro: soma em centavos, sem erro de ponto flutuante, e % atrasado', () => {
  const bs = Array.from({ length: 10 }, () => ({ codigo_cliente_omie: 1, data_vencimento: '2026-11-01', valor: 0.1 }));
  const r = C.resumoFinanceiro(bs, '2026-11-11');
  assert.equal(r.total.valor, 1);
  assert.equal(r.pctAtrasado, 100);
});
test('resumo financeiro sem boletos devolve zeros', () => {
  const r = C.resumoFinanceiro([], '2026-11-11');
  assert.equal(r.total.valor, 0);
  assert.equal(r.pctAtrasado, 0);
});

// ---- títulos sem boleto (depósito/transferência) ----
test('aviso com título sem boleto fala em pagamento, não em boleto, e não traz linha digitável', () => {
  const m = C.montarAviso('ESCAMAX', [{ numero_documento: '123', numero_parcela: '1/1', data_vencimento: '2026-11-12', valor: 750, tem_boleto: false }], 'D0');
  assert.match(m.assunto, /Seu pagamento vence hoje — ESCAMAX/);
  assert.match(m.texto, /O pagamento abaixo vence hoje/);
  assert.match(m.texto, /Forma de pagamento: depósito\/transferência, conforme combinado/);
  assert.doesNotMatch(m.texto, /2ª via/);
  assert.doesNotMatch(m.texto, /Linha digitável/);
});
test('aviso só com boletos fala em boleto e traz a linha digitável', () => {
  const m = C.montarAviso('ACME', [{ numero_documento: '9', data_vencimento: '2026-11-12', valor: 10, linha_digitavel: '123', tem_boleto: true }], 'D0');
  assert.match(m.assunto, /Seu boleto vence hoje/);
  assert.match(m.texto, /Linha digitável: 123/);
});
test('a sincronização limita o sem-boleto a 180 dias e a migration cria tem_boleto com padrão true', () => {
  const f = ler('supabase/functions/boletos-avisos/index.ts');
  assert.match(f, /LIMITE_SEM_BOLETO_DIAS = 180/);
  assert.match(f, /!temBoleto && diasDesdeVencimento\(venc, hojeSync\) > \(semCorte\.has/);
  const sql = ler('supabase/migrations/20261112100000_boletos_avisos_sem_boleto.sql');
  assert.match(sql, /tem_boleto boolean not null default true/);
});

test('a Escamax (raiz do CNPJ) fica sem o corte de 180 dias do sem-boleto', () => {
  const f = ler('supabase/functions/boletos-avisos/index.ts');
  assert.match(f, /RAIZES_CNPJ_SEM_CORTE = \["24845692", "42689068"\]/);
  assert.match(f, /LIMITE_ESCAMAX_DIAS = 365/);
});

test('aviso de atraso no 2º dia útil, com ou sem boleto (19/11/2026)', () => {
  for (const sem of [false, true]) {
    assert.equal(C.etapaDevida('2026-11-10', '2026-11-11', [], sem), null);
    assert.equal(C.etapaDevida('2026-11-10', '2026-11-12', [], sem), 'D+1');
    assert.equal(C.etapaDevida('2026-11-10', '2026-11-12', ['D+1'], sem), null);
  }
});
test('sem boleto: D-5, D-1 e D0 continuam iguais; sexta vencida cai na segunda (2 dias depois)', () => {
  assert.equal(C.etapaDevida('2026-11-16', '2026-11-11', [], true), 'D-5');
  assert.equal(C.etapaDevida('2026-11-12', '2026-11-11', [], true), 'D-1');
  assert.equal(C.etapaDevida('2026-11-11', '2026-11-11', [], true), 'D0');
  assert.equal(C.etapaDevida('2026-11-13', '2026-11-16', [], true), null);    // vence sexta: 1º dia útil = segunda
  assert.equal(C.etapaDevida('2026-11-13', '2026-11-17', [], true), 'D+1');   // 2º dia útil = terça
});

// ---- dia sem expediente: fim de semana, feriados e Carnaval (17/11/2026) ----
const FER = C.conjuntoSemExpediente([
  { data: '2026-11-20', descricao: 'Consciência Negra', bloqueia_envio: true, ativo: true },
  { data: '2027-02-08', descricao: 'Carnaval (segunda)', bloqueia_envio: false, ativo: true },
  { data: '2027-02-09', descricao: 'Carnaval (terça)', bloqueia_envio: false, ativo: true },
  { data: '2027-01-25', descricao: 'Aniversário de São Paulo (cidade)', bloqueia_envio: false, ativo: true },
  { data: '2026-12-08', descricao: 'Aniversário de Guarulhos', bloqueia_envio: true, ativo: false },
]);
test('o calendário sem expediente leva feriado que bloqueia envio e Carnaval; fica fora o que não bloqueia e o inativo', () => {
  assert.deepEqual([...FER].sort(), ['2026-11-20', '2027-02-08', '2027-02-09']);
});
test('em feriado e fim de semana nenhum aviso sai', () => {
  assert.equal(C.etapaDevida('2026-11-25', '2026-11-20', [], false, FER), null);   // sexta 20/11 feriado
  assert.equal(C.etapaDevida('2026-11-26', '2026-11-21', [], false, FER), null);   // sábado
  assert.equal(C.diaUtil('2026-11-20', FER), false);
  assert.equal(C.diaUtil('2026-11-19', FER), true);
});
test('exemplo do Gelson: boleto de sábado 21/11 com feriado na sexta 20/11', () => {
  assert.deepEqual(C.datasDasEtapas('2026-11-21', false, FER), { 'D-5': '2026-11-16', 'D-1': '2026-11-19', 'D0': '2026-11-23', 'D+1': '2026-11-25' });
  assert.equal(C.datasDasEtapas('2026-11-21', true, FER)['D+1'], '2026-11-25');   // 2º dia útil, com ou sem boleto
  assert.equal(C.etapaDevida('2026-11-21', '2026-11-19', [], false, FER), 'D-1');
  assert.equal(C.etapaDevida('2026-11-21', '2026-11-23', [], false, FER), 'D0');
  assert.equal(C.etapaDevida('2026-11-21', '2026-11-24', [], false, FER), null);
  assert.equal(C.etapaDevida('2026-11-21', '2026-11-25', [], false, FER), 'D+1');
});
test('boleto que vence no feriado vale no dia útil seguinte: semáforo em dia antes, sem atraso no dia', () => {
  assert.equal(C.vencimentoEfetivo('2026-11-20', FER), '2026-11-23');
  assert.equal(C.situacaoDoBoleto('2026-11-20', '2026-11-23', FER), 'vence_hoje');
  assert.equal(C.situacaoDoBoleto('2026-11-20', '2026-11-24', FER), 'atrasado');
  assert.equal(C.diasDeAtraso('2026-11-20', '2026-11-24', FER), 1);
  assert.equal(C.diasDeAtraso('2026-11-20', '2026-11-23', FER), 0);
});
test('Carnaval: boleto da segunda de Carnaval vale na quarta de cinzas', () => {
  assert.equal(C.vencimentoEfetivo('2027-02-08', FER), '2027-02-10');
  assert.equal(C.etapaDevida('2027-02-08', '2027-02-05', [], false, FER), 'D-1');   // sexta antes
  assert.equal(C.etapaDevida('2027-02-08', '2027-02-10', [], false, FER), 'D0');
  assert.equal(C.etapaDevida('2027-02-08', '2027-02-12', [], false, FER), 'D+1');
});
test('resumo financeiro não conta como atrasado o boleto que venceu no feriado e vale hoje', () => {
  const r = C.resumoFinanceiro([{ codigo_cliente_omie: 1, data_vencimento: '2026-11-21', valor: 100 }], '2026-11-23', FER);
  assert.equal(r.venceHoje.valor, 100);
  assert.equal(r.atrasado.valor, 0);
});
test('aviso no dia de boleto que venceu em dia sem expediente diz que pode pagar hoje sem encargos', () => {
  const sab = { ...b1, data_vencimento: '2026-11-21' };
  assert.match(C.montarAviso('ACME', [sab], 'D0', FER).texto, /O boleto abaixo venceu em dia sem expediente bancário e pode ser pago hoje sem encargos:/);
  assert.match(C.montarAviso('ACME', [sab, sab], 'D0', FER).texto, /Os boletos abaixo venceram em dia sem expediente bancário e podem ser pagos hoje sem encargos:/);
  assert.match(C.montarAviso('X', [{ ...sab, tem_boleto: false }], 'D0', FER).texto, /O pagamento abaixo venceu em dia sem expediente bancário e pode ser feito hoje sem encargos:/);
  assert.match(C.montarAviso('ACME', [{ ...b1, data_vencimento: '2026-11-23' }], 'D0', FER).texto, /O boleto abaixo vence hoje:/);
});
test('a função lê o calendário de feriados e não envia em dia sem expediente', () => {
  const f = ler('supabase/functions/boletos-avisos/index.ts');
  assert.match(f, /conjuntoSemExpediente\(await pgSelectTudo\("calendario_feriados"/);
  assert.match(f, /if \(!diaUtil\(hoje, feriados\)\) return/);
  const sql = ler('supabase/migrations/20261117100000_boletos_avisos_dia_util.sql');
  assert.match(sql, /f\.bloqueia_envio or f\.descricao ilike 'Carnaval%'/);
  assert.match(sql, /boletos_avisos_venc_efetivo\(b\.data_vencimento\)/);
});

// ---- faixas dos cards (18/11/2026): o filtro da lista usa a MESMA regra dos cards ----
test('faixaDoBoleto: a vencer, vence hoje, atrasado 1–30 e atrasado mais de 30 (segunda-feira 23/11/2026, dia útil)', () => {
  const hoje = '2026-11-23';
  assert.equal(C.faixaDoBoleto('2026-11-30', hoje, FER), 'aVencer');
  assert.equal(C.faixaDoBoleto('2026-11-23', hoje, FER), 'venceHoje');
  assert.equal(C.faixaDoBoleto('2026-11-22', hoje, FER), 'venceHoje');       // domingo: vale no próximo dia útil = hoje
  assert.equal(C.faixaDoBoleto('2026-11-20', hoje, FER), 'venceHoje');       // 20/11 é feriado no calendário do teste: vale na segunda
  assert.equal(C.faixaDoBoleto('2026-11-19', hoje, FER), 'atrasado30');      // quinta: venceu há 4 dias
  assert.equal(C.faixaDoBoleto('2026-10-23', hoje, FER), 'atrasadoMais30');  // sexta: venceu há 31 dias
});
test('faixaDoBoleto: fronteira de 30 dias (quarta 25/11/2026: 26/10 é segunda, exatamente 30 dias)', () => {
  const hoje = '2026-11-25';
  assert.equal(C.faixaDoBoleto('2026-10-26', hoje, FER), 'atrasado30');      // 30 dias: ainda é "1 a 30"
  assert.equal(C.faixaDoBoleto('2026-10-24', hoje, FER), 'atrasado30');      // sábado: vale na segunda 26/10 = 30 dias
  assert.equal(C.faixaDoBoleto('2026-10-23', hoje, FER), 'atrasadoMais30');  // sexta: 33 dias
});
test('faixaDoBoleto e resumoFinanceiro concordam em todos os casos (a lista nunca discorda do card)', () => {
  const hoje = '2026-11-23';
  const bol = ['2026-12-10', '2026-11-23', '2026-11-22', '2026-11-10', '2026-10-24', '2026-10-23', '2025-01-05'].map((d, i) => ({ codigo_cliente_omie: i + 1, data_vencimento: d, valor: 100 + i }));
  const r = C.resumoFinanceiro(bol, hoje, FER);
  for (const f of C.FAIXAS) {
    const doFiltro = bol.filter((b) => C.faixaDoBoleto(b.data_vencimento, hoje, FER) === f.chave);
    assert.equal(doFiltro.length, r[f.chave].boletos, f.chave + ': quantidade');
    assert.equal(Math.round(doFiltro.reduce((a, b) => a + b.valor * 100, 0)) / 100, r[f.chave].valor, f.chave + ': valor');
  }
});

test('resumoSelecao: soma clientes, títulos e valor em centavos (0,1 + 0,2 não vira 0,30000000000000004)', () => {
  const r = C.resumoSelecao([{ qtd: 1, centavos: 10 }, { qtd: 2, centavos: 20 }]);
  assert.deepEqual(r, { clientes: 2, titulos: 3, valor: 0.3 });
  assert.deepEqual(C.resumoSelecao([{ qtd: 4, centavos: 890000 }, { qtd: 1, centavos: 150000 }]), { clientes: 2, titulos: 5, valor: 10400 });
});
test('resumoSelecao: nada marcado e dados faltando não quebram', () => {
  assert.deepEqual(C.resumoSelecao([]), { clientes: 0, titulos: 0, valor: 0 });
  assert.deepEqual(C.resumoSelecao(null), { clientes: 0, titulos: 0, valor: 0 });
  assert.deepEqual(C.resumoSelecao([{}, { qtd: 'x', centavos: null }]), { clientes: 2, titulos: 0, valor: 0 });
});

// ---- 19/11/2026: um e-mail com etapas diferentes (caso Escamax) ----
{
  const FER19 = new Set(['2026-11-20']);   // Consciência Negra
  const t = (id, venc, valor, extra) => ({ codigo_lancamento_omie: id, numero_documento: String(id), numero_parcela: '1/1', data_vencimento: venc, valor, tem_boleto: false, ...extra });
  const venc = t(1, '2026-11-17', 1495.87);
  const feriado = t(2, '2026-11-20', 108.66);
  const sabado = t(3, '2026-11-21', 1328.8);
  const seg = t(4, '2026-11-23', 4059.42);
  const etapas = { 1: 'D+1', 2: 'D-1', 3: 'D-1', 4: 'D-1' };
  const m = C.montarAviso('ESCAMAX', [sabado, venc, seg, feriado], etapas, FER19, '2026-11-19');

  test('título que ainda vai vencer não aparece como vencido', () => {
    const [vencidos, proximos] = m.texto.split('Próximos vencimentos:');
    assert.match(vencidos, /Vencido — ainda não consta como recebido:\n• NF 1 /);
    assert.doesNotMatch(vencidos, /NF [234] /);
    assert.match(proximos, /NF 2 .*NF 3 .*NF 4 /s);
    assert.doesNotMatch(proximos, /regularização imediata/);
    assert.equal(m.assunto, 'Pagamento em aberto — vencido — ESCAMAX');
  });
  test('vencimento em feriado ou fim de semana diz até quando pode pagar', () => {
    assert.match(m.texto, /vencimento 20\/11\/2026 \(feriado\) — pode pagar até 23\/11/);
    assert.match(m.texto, /vencimento 21\/11\/2026 \(sábado\) — pode pagar até 23\/11/);
    assert.match(m.texto, /vencimento 23\/11\/2026 — R\$/);
    assert.match(m.texto, /Total: R\$\s5\.496,88/);
  });
  test('véspera de feriado não diz "amanhã" quando o vencimento é na segunda', () => {
    const s = C.montarAviso('X', [{ ...seg, tem_boleto: true }], 'D-1', FER19, '2026-11-19');
    assert.equal(s.assunto, 'Seu boleto vence em 23/11 — X');
    assert.match(s.texto, /O boleto abaixo vence no próximo dia útil, segunda-feira, 23\/11:/);
    assert.match(C.montarAviso('X', [{ ...seg, tem_boleto: true }], 'D-1', FER19, '2026-11-22').texto, /vence amanhã:/);
  });
  test('D-5 conta os dias de verdade', () => {
    assert.equal(C.montarAviso('X', [seg], 'D-5', FER19, '2026-11-18').assunto, 'Lembrete: pagamento vence em 5 dias — X');
    assert.equal(C.montarAviso('X', [seg], 'D-5', FER19, '2026-11-19').assunto, 'Lembrete: pagamento vence em 4 dias — X');
  });
  test('html: tabela, linha digitável em linha própria e tudo escapado', () => {
    const b = { ...seg, tem_boleto: true, linha_digitavel: '34191090080004474758259782520007916340000105259', numero_documento: '<b>9</b>' };
    const h = C.montarAviso('A & B <LTDA>', [b, venc], { 1: 'D+1', 4: 'D0' }, FER19, '2026-11-23').html;
    assert.match(h, /<table/);
    assert.match(h, /Linha digitável: <span[^>]*>34191090080004474758259782520007916340000105259<\/span>/);
    assert.match(h, /&lt;b&gt;9&lt;\/b&gt;/);
    assert.doesNotMatch(h, /<b>9<\/b>/);
    assert.match(h, /Pagamentos de A &amp; B &lt;LTDA&gt;/);
    assert.match(h, />Vencido <span/);
    assert.match(h, /solicitamos a regularização imediata, sujeita aos encargos por atraso/);
    assert.ok(h.indexOf('>Vence hoje <span') < h.indexOf('>Vencido <span'), 'ordem do formato aprovado: Vence hoje antes de Vencido');
    assert.match(h, /1 parcela que vence hoje<\/strong> \(R\$ 4\.059,42\) e <strong>1 já vencida/);
    assert.match(h, /Atenciosamente,<br><strong>Financeiro — VerticalParts<\/strong>/);
    assert.match(h, /id="vp-assinatura-hub"/);
    assert.match(h, /mailto:financeiro@verticalparts\.com\.br/);
    assert.match(h, /Forma de pagamento:/);
  });
  test('html: título que venceu no feriado fica em "Vence hoje" no 1º dia útil, nunca em "Vencidos"', () => {
    const fer = { ...venc, codigo_lancamento_omie: 7, data_vencimento: '2026-11-20', numero_documento: '00022029' };
    const h = C.montarAviso('ESCAMAX', [fer], { 7: 'D0' }, FER19, '2026-11-23').html;
    assert.match(h, />Vence hoje <span/);
    assert.doesNotMatch(h, />Vencidos? <span/);
    assert.match(h, /20\/11\/2026<br><span[^>]*>feriado — pode pagar até 23\/11/);
    assert.match(h, /em dia sem expediente bancário/);
  });
  test('envio manual continua uma seção só', () => {
    const r = C.montarAviso('ACME', [venc, seg], 'manual', FER19, '2026-11-19');
    assert.equal(r.assunto, 'Pagamentos em aberto — ACME');
    assert.doesNotMatch(r.texto, /Próximos vencimentos|Vencido —/);
  });
}
test('a função manda um e-mail por destinatário (códigos do Omie com o mesmo e-mail juntos)', () => {
  const f = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/boletos-avisos/index.ts'), 'utf8');
  assert.match(f, /const chave = emails\.length \? emails\.join\(","\)/);
  assert.match(f, /montarAviso\(razao, boletos, origem === "manual" \? "manual" : etapaPorBoleto, feriados, hoje \|\| hojeBrasil\(\)\)/);
  assert.match(f, /enviarGraph\(para, assunto, texto, html, cc\)/);
  assert.match(f, /ccRecipients: cc\.map/);
  assert.match(f, /!modoTeste && EMAIL_RE\.test\(CC_FINANCEIRO\)/);
  assert.match(f, /comAssinatura\(html \|\|/);
});
