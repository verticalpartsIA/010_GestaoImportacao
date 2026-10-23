'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./contrato-instalador-engine.js');
const CI = window.CI;

test('CNPJ/CPF — valida dígito verificador, não só o tamanho', () => {
  assert.equal(CI.isCNPJValid('15.822.325/0001-27'), true);
  assert.equal(CI.isCNPJValid('15.822.325/0001-28'), false);
  assert.equal(CI.isCNPJValid('11.111.111/1111-11'), false);
  assert.equal(CI.isCPFValid('529.982.247-25'), true);
  assert.equal(CI.isCPFValid('529.982.247-24'), false);
  assert.equal(CI.isCPFValid('111.111.111-11'), false);
  assert.equal(CI.isCNPJContratante('15822325000127'), true);
  assert.equal(CI.isCNPJContratante('11.222.333/0001-81'), false);
});

test('dividirEmParcelas — soma sempre igual ao total, resto na última', () => {
  assert.deepEqual(CI.dividirEmParcelas(100, 3), [33.33, 33.33, 33.34]);
  assert.deepEqual(CI.dividirEmParcelas(100.01, 2), [50, 50.01]);
  for (const [v, n] of [[100, 3], [100.01, 2], [0.05, 3], [12345.67, 3]]) {
    const soma = Math.round(CI.dividirEmParcelas(v, n).reduce((t, x) => t + Math.round(x * 100), 0));
    assert.equal(soma, Math.round(v * 100));
  }
});

test('cláusula 5.1 — parcelas do texto somam o total', () => {
  const s = CI.defaultState();
  s.valorTotal = '100,00'; s.formaPagamento = '3';
  const it = CI.buildContract(s, 'X').clauses.find((c) => c.id === 'pagamento').items;
  assert.match(it[1].text, /R\$ 33,33/);
  assert.match(it[3].text, /R\$ 33,34/);
});

test('escopo — concordância de gênero/número em Escada e Esteira Rolante', () => {
  const s = CI.defaultState();
  s.equipamento = 'escada'; s.quantidade = 2;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /2 \(duas\) Escadas Rolantes/);
  s.quantidade = 1;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /1 \(uma\) Escada Rolante /);
  s.equipamento = 'esteira'; s.quantidade = 21;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /21 \(vinte e uma\) Esteiras Rolantes/);
  assert.equal(CI.inteiroExtensoGen(1000, true), 'mil');
});

test('logradouro — só prefixa "Rua" quando falta o tipo', () => {
  assert.equal(CI.logradouro('Avenida Paulista'), 'Avenida Paulista');
  assert.equal(CI.logradouro('Av. Brasil'), 'Av. Brasil');
  assert.equal(CI.logradouro('das Flores'), 'Rua das Flores');
  assert.equal(CI.logradouro(''), 'Rua XXX');
});

test('Nº do contrato — nasce dos equipamentos (cotação ou nº de série)', () => {
  const s = CI.defaultState();
  assert.equal(CI.numeroBaseContrato(s), null); // nenhum equipamento ainda
  s.equipamentosManuais = ['sn 12/34'];
  assert.equal(CI.numeroBaseContrato(s), 'VPNI-SN-1234'); // avulso: 1º nº de série
  s.numeroCotacao = 955;
  assert.equal(CI.numeroBaseContrato(s), 'VPNI-0955'); // com Proposta: Nº da cotação
});

test('Nº do contrato — 2ª empresa na mesma cotação ganha sufixo', () => {
  assert.equal(CI.proximoNumeroLivre('VPNI-0955', []), 'VPNI-0955');
  assert.equal(CI.proximoNumeroLivre('VPNI-0955', ['VPNI-0955']), 'VPNI-0955-2');
  assert.equal(CI.proximoNumeroLivre('VPNI-0955', ['VPNI-0955', 'VPNI-0955-2']), 'VPNI-0955-3');
  assert.equal(CI.proximoNumeroLivre('VPNI-0955', ['VPNI-09551']), 'VPNI-0955');
});

test('equipamentos — ativos marcados da Proposta + manuais, sem duplicata, e cláusula 1.1.1', () => {
  const s = CI.defaultState();
  s.ativosSnapshot = [{ indice: 1, identificador: 'VPEL-EL0955-1' }, { indice: 2, identificador: 'VPEL-EL0955-2' }, { indice: 3, identificador: 'VPEL-EL0955-3' }];
  s.ativosIndices = [1, 3];
  s.equipamentosManuais = ['SN-77', 'VPEL-EL0955-1'];
  assert.deepEqual(CI.equipamentosDoContrato(s), ['VPEL-EL0955-1', 'VPEL-EL0955-3', 'SN-77']);
  const it = CI.buildContract(s, 'VPNI-0955').clauses[0].items.find((i) => i.n === '1.1.1');
  assert.match(it.text, /Equipamentos objeto deste contrato.*VPEL-EL0955-1, VPEL-EL0955-3, SN-77\./);
  assert.equal(CI.buildContract(CI.defaultState(), 'X').clauses[0].items.some((i) => i.n === '1.1.1'), false);
});

const itensObjeto = (s) => CI.buildContract(s, 'VPNI-T').clauses[0].items;
test('1.1.1 — equipamento descrito com tipo + nº de série + dossiê (não só o código do dossiê)', () => {
  const s = CI.defaultState();
  s.equipamentosManuais = ['DOS-M055'];
  s.equipamentosDetalhe = [{ dossier: 'DOS-M055', serie: '500.0395', descricao: 'Elevador Panorâmico – 1000 – 2 – 4– MRL – 1 Porta', tipo: 'elevador' }];
  const t = itensObjeto(s).find((i) => i.n === '1.1.1').text;
  assert.match(t, /Elevador Panorâmico.*nº de série 500\.0395; Dossiê DOS-M055/);
  assert.equal((t.match(/DOS-M055/g) || []).length, 1);   // não repete o dossiê como se fosse outro equipamento
  s.equipamentosDetalhe[0].serie = '';
  assert.match(itensObjeto(s).find((i) => i.n === '1.1.1').text, /nº de série não informado/);   // ausência dita, nada inventado
});

test('1.2 — descrição livre opcional quando há fase marcada com texto; ":" solto não vale', () => {
  const s = CI.defaultState();
  s.descricaoServicos = ':';
  assert.equal(CI.descricaoServicosValida(s), false);                       // zero fases + descrição vazia
  assert.match(itensObjeto(s).find((i) => i.n === '1.2').text, /detalhar os serviços/);
  s.fasesAtivas = { f1: true };
  assert.equal(CI.descricaoServicosValida(s), true);                        // uma fase
  const it = itensObjeto(s).find((i) => i.n === '1.2');
  assert.match(it.text, /executará as seguintes etapas/); assert.equal(it.list.length, 1);
  assert.equal(itensObjeto(s).some((i) => i.n === '1.2.1'), false);
  s.fasesAtivas = { f1: true, f2: true, f3: true, f4: true };
  assert.equal(itensObjeto(s).find((i) => i.n === '1.2').list.length, 4);   // quatro fases
  s.descricaoServicos = 'Montagem completa';
  assert.equal(itensObjeto(s).find((i) => i.n === '1.2').text, 'Descrição dos serviços: Montagem completa');
  assert.equal(itensObjeto(s).find((i) => i.n === '1.2.1').list.length, 4); // livre + fases somadas
  s.descricaoServicos = ''; s.fasesTexto = { f1: '  ', f2: '', f3: '', f4: '' };
  assert.equal(CI.descricaoServicosValida(s), false);                       // fase marcada com texto apagado não supre
  assert.equal(itensObjeto(s).some((i) => /Descrição dos serviços: :/.test(i.text || '')), false);
});

test('1.1.1 — equipamento removido da seleção sai do texto (detalhes seguem a seleção atual)', () => {
  const s = CI.defaultState();
  s.equipamentosManuais = ['DOS-A', 'DOS-B'];
  s.equipamentosDetalhe = [{ dossier: 'DOS-A', serie: '1', descricao: 'Elevador A' }, { dossier: 'DOS-B', serie: '2', descricao: 'Elevador B' }];
  s.equipamentosManuais = ['DOS-B'];   // usuário removeu o chip do DOS-A
  const t = CI.buildContract(s, 'X').clauses[0].items.find((i) => i.n === '1.1.1').text;
  assert.match(t, /Elevador B/); assert.doesNotMatch(t, /Elevador A|nº de série 1/);
});

const itensPag = (s) => CI.buildContract(s, 'VPNI-T').clauses.find((c) => c.id === 'pagamento').items;
test('5.1 — data prevista por parcela: opcional, só aparece quando informada (2, 3 e personalizado)', () => {
  const s = CI.defaultState();
  s.valorTotal = '10.000,00'; s.condicionarUltimaParcela = false;   // este teste é só das datas
  s.formaPagamento = '2';
  assert.doesNotMatch(itensPag(s).map((i) => i.text).join(' '), /data prevista/);          // sem data, texto como antes
  s.datasParcelas = ['2026-10-26', '', ''];
  let t = itensPag(s);
  assert.match(t.find((i) => i.n === '5.1.1').text, /início dos trabalhos \(data prevista: 26\/10\/2026\);$/);
  assert.doesNotMatch(t.find((i) => i.n === '5.1.2').text, /data prevista/);               // só a que foi informada
  s.formaPagamento = '3'; s.datasParcelas = ['', '', '2026-11-27'];
  t = itensPag(s);
  assert.match(t.find((i) => i.n === '5.1.3').text, /nota fiscal de serviço \(data prevista: 27\/11\/2026\)\.$/);
  s.formaPagamento = 'custom';
  s.parcelas = [{ valor: '5.000,00', data: '2026-10-26', descricao: 'entrada' }, { valor: '5.000,00', data: '', descricao: 'entrega' }];
  t = itensPag(s);
  assert.match(t.find((i) => i.n === '5.1.1').text, /entrada \(data prevista: 26\/10\/2026\);$/);
  assert.doesNotMatch(t.find((i) => i.n === '5.1.2').text, /data prevista/);
  assert.equal(t.find((i) => i.bank).n, '5.1.3');                                          // numeração dos dados bancários intacta
});

test('1.4 — prazo e cronograma: opcional, marcos escolhidos um a um, nada corrigido em silêncio', () => {
  const s = CI.defaultState();
  const it = () => CI.buildContract(s, 'X').clauses[0].items.find((i) => i.n === '1.4');
  assert.equal(it(), undefined);                                                     // bloco desligado: não aparece
  s.cronograma = { ativo: true, prazoDias: '25', criterio: '', marcos: { inicio: { on: true, data: '2026-10-26' }, tracionamento: { on: false, data: '2026-11-06' }, termino: { on: true, data: '2026-11-27' } } };
  assert.match(it().text, /prazo total de execução dos serviços objeto deste contrato é de 25 \(vinte e cinco\) dias, observando o seguinte cronograma/);
  assert.deepEqual(it().list, ['Início previsto: 26/10/2026', 'Término e entrega para vistoria: 27/11/2026']);   // marco desmarcado não sai
  assert.match(CI.alertaCronograma(s), /32 dias corridos/);                           // exemplo do Jurídico: avisa, não corrige
  assert.equal(CI.cronogramaDoContrato(s).dias, 25);
  s.cronograma.criterio = 'corridos'; assert.match(it().text, /25 \(vinte e cinco\) dias corridos,/);
  s.cronograma.marcos = {}; assert.equal(it().list, undefined); assert.match(it().text, /dias corridos\.$/);   // sem marcos: só o prazo
  s.cronograma.prazoDias = ''; assert.equal(it(), undefined);                         // ativo sem prazo não publica cláusula vazia
  s.cronograma = { ativo: true, prazoDias: '25', criterio: '', marcos: { inicio: { on: true, data: '' } } };
  assert.equal(it().list, undefined);                                                // marco marcado sem data não é impresso
  s.modalidade = 'remocao'; s.destino = 'Galpão X';
  const itens = CI.buildContract(s, 'X').clauses[0].items;
  assert.match(itens.find((i) => i.n === '1.4').text, /Destino do equipamento removido/);   // remoção mantém a 1.4 = destino
  assert.match(itens.find((i) => i.n === '1.5').text, /prazo total/);
});

test('5.1 — última parcela condicionada à vistoria e laudos: valor da última parcela da sequência, antes dos dados bancários', () => {
  const s = CI.defaultState();
  s.valorTotal = '9.750,00'; s.formaPagamento = 'custom';
  s.parcelas = [{ valor: '2.437,50', descricao: 'entrada' }, { valor: '2.437,50', descricao: 'tracionamento' }, { valor: '2.437,50', descricao: 'porta' }, { valor: '2.437,50', descricao: 'entrega' }];
  const it = () => CI.buildContract(s, 'X').clauses.find((c) => c.id === 'pagamento').items;
  let t = it();
  const cond = t.find((i) => /liberação da última parcela/.test(i.text));
  assert.match(cond.text, /última parcela \(R\$ 2\.437,50\) fica estritamente condicionada à aprovação do equipamento na vistoria técnica realizada pelo Supervisor da CONTRATANTE e à emissão dos laudos de conformidade\./);
  assert.equal(cond.n, '5.1.5'); assert.equal(t.find((i) => i.bank).n, '5.1.6');                   // numeração dos dados bancários acompanha
  assert.equal(t.indexOf(cond) + 1, t.indexOf(t.find((i) => i.bank)));                              // imediatamente antes dos dados bancários
  s.parcelas[3].valor = '3.000,00';                                                                   // editou a última: recalcula
  assert.match(it().find((i) => /liberação da última parcela/.test(i.text)).text, /R\$ 3\.000,00/);
  s.parcelas = s.parcelas.slice(0, 2);                                                                // removeu parcelas: a última passa a ser a 2ª
  assert.match(it().find((i) => /liberação da última parcela/.test(i.text)).text, /R\$ 2\.437,50/);
  s.formaPagamento = '2'; s.valorTotal = '10.000,00';
  assert.match(it().find((i) => /liberação da última parcela/.test(i.text)).text, /R\$ 5\.000,00/);   // 2 parcelas
  s.formaPagamento = '3'; s.valorTotal = '10.000,00';
  assert.match(it().find((i) => /liberação da última parcela/.test(i.text)).text, /R\$ 3\.333,34/);   // 3 parcelas, resto na última
  s.condicionarUltimaParcela = false;
  assert.equal(it().some((i) => /liberação da última parcela/.test(i.text)), false);                  // desmarcado: some
  delete s.condicionarUltimaParcela;
  assert.equal(it().some((i) => /liberação da última parcela/.test(i.text)), false);                  // contrato antigo (sem a chave): inalterado
});
