'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./evolucao-equipamentos-calc.js');
const C = window.EvolucaoEquipamentosCalc;
const hoje = new Date(2026, 9, 19);
const est = (r, k) => r.passos.find((p) => p.key === k).estado;

test('aguardando: embarque com ETA futuro vira previsão e é a etapa atual', () => {
  const r = C.montarLinha({ created_at: '2026-08-01T10:00:00Z', status_master: 'Importação' }, null, {
    hoje, embarque: { etd_atual: '2026-09-20', eta_santos: '2026-11-05' },
  });
  assert.equal(est(r, 'aberta'), 'feito');
  assert.equal(est(C.montarLinha({ status_master: 'Importação' }, null, { hoje }), 'aberta'), 'feito');
  assert.equal(est(r, 'embarque'), 'feito');
  assert.equal(est(r, 'porto'), 'previsto');
  assert.equal(r.atualKey, 'porto');
  assert.equal(r.atrasada, false);
});

test('em instalação: marcos do Diário de Obra e etapas anteriores sem data viram "pulado"', () => {
  const r = C.montarLinha({ created_at: '2026-05-01', status_master: 'Instalação', equipamento_entregue: true }, { previsao_termino: '2026-10-01' }, {
    hoje, progresso: { pct: 60, iniciadoEm: '2026-09-01T12:00:00Z', marcos: [{ label: '50%', completo: true, dataConclusao: '2026-09-30T12:00:00Z' }, { label: '75%', completo: false }, { label: '100%', completo: false }] },
  });
  assert.equal(est(r, 'embarque'), 'pulado');
  assert.equal(est(r, 'obra'), 'feito');
  assert.equal(est(r, 'inicio'), 'feito');
  assert.equal(est(r, 'm50'), 'feito');
  assert.equal(r.atualKey, 'm75');
  assert.equal(r.pct, 60);
  const fim = r.passos.find((p) => p.key === 'fim');
  assert.equal(fim.estado, 'previsto');
});

test('previsão vencida marca atraso; data aaaa-mm-dd é local', () => {
  const r = C.montarLinha({ created_at: '2026-05-01', status_master: 'Contrato assinado' }, { previsao_chegada_material: '2026-10-10' }, { hoje });
  assert.equal(r.atualKey, 'embarque');
  const obra = r.passos.find((p) => p.key === 'obra');
  assert.equal(obra.data.getDate(), 10);
  const r2 = C.montarLinha({ created_at: '2026-05-01' }, { chegada_real_material: '2026-10-01', previsao_inicio: '2026-10-05' }, { hoje });
  assert.equal(r2.atualKey, 'inicio');
  assert.equal(r2.atrasada, true);
});

test('obra entregue: tudo concluído, nenhuma etapa atual', () => {
  const r = C.montarLinha({ created_at: '2026-01-01', status_master: 'Entregue' }, { data_real_termino: '2026-06-01' }, { hoje });
  assert.equal(est(r, 'entrega'), 'feito');
  assert.equal(est(r, 'fim'), 'feito');
  assert.equal(r.atualKey, null);
});

test('escolherEmbarque ignora arquivado e pega o mais recente', () => {
  const e = C.escolherEmbarque([{ id: 'a', updated_at: '2026-09-01' }, { id: 'b', updated_at: '2026-10-01', arquivado: true }, { id: 'c', updated_at: '2026-09-15' }]);
  assert.equal(e.id, 'c');
  assert.equal(C.escolherEmbarque([]), null);
});

test('embarque pelo nº de série da P.I. (temporário): cotação vence; série casa sem espaço/maiúscula', () => {
  const embs = [{ id: 'e1', nome_embarque: '143º', updated_at: '2026-09-01' }, { id: 'e2', nome_embarque: '144º', updated_at: '2026-09-20' }];
  const pis = [{ numeros_serie: ['500.0393'], embarque_id: 'e1' }, { numeros_serie: ['500.0393 ', 'vpel-1'], embarque_id: 'e2' }, { numeros_serie: ['500.0400'], embarque_id: null }];
  const m = C.embarquesPorSerie(pis, embs);
  assert.equal(m['500.0393'].id, 'e2');
  assert.equal(m['VPEL-1'].id, 'e2');
  assert.equal(m['500.0400'], undefined);
  assert.equal(C.embarqueDoEquipamento(null, m, ' 500.0393').origem, 'serie');
  assert.equal(C.embarqueDoEquipamento({ id: 'x' }, m, '500.0393').embarque.id, 'x');
  assert.equal(C.embarqueDoEquipamento(null, m, null).embarque, null);
});

test('ocorrências: rolagens do navio, canal vermelho, previsão vencida e extras', () => {
  const emb = { nome_embarque: '150º', etd_atual: '2026-10-13', eta_santos: '2026-10-12', canal_parametrizacao: 'Vermelho',
    historico_rolagens: [{ data_anterior: '2026-10-01', nova_data: '2026-10-09', motivo: 'cut-off' }, { data_anterior: '2026-10-09', nova_data: '2026-10-13', motivo: 'Atraso do Navio' }] };
  const linha = C.montarLinha({ status_master: 'Importação' }, { previsao_chegada_material: '2026-10-09' }, { hoje, embarque: emb });
  const r = C.ocorrencias(emb, linha, { hoje, extras: [{ categoria: 'contrato', titulo: 'Projeto aprovado com atraso', dias: 3 }] });
  assert.equal(r.porCategoria.navio.filter((o) => o.etapa === 'embarque').length, 2);
  assert.equal(r.porCategoria.aduana[0].gravidade, 'alta');
  assert.equal(r.porCategoria.contrato.length, 1);
  assert.equal(r.porCategoria.logistica.length, 1); // previsão de chegada na obra vencida
  assert.equal(r.diasAtraso, 12 + 10 + 3);
});

test('ocorrências: canal verde e embarque sem rolagem não geram nada; porto parado vira logística', () => {
  assert.equal(C.ocorrencias({ canal_parametrizacao: 'Verde', etd_original: '2026-08-01', etd_atual: '2026-08-01' }, null, { hoje }).lista.length, 0);
  const emb = { eta_santos: '2026-09-14', etd_atual: '2026-08-16' };
  const linha = C.montarLinha({ status_master: 'Importação' }, null, { hoje, embarque: emb });
  const r = C.ocorrencias(emb, linha, { hoje });
  assert.equal(r.porCategoria.logistica.length, 1);
  assert.equal(r.porCategoria.logistica[0].dias, 35);
});

test('ocorrências: rolagem com data suspeita é marcada para conferir', () => {
  require('./rolagens-calc.js');
  const emb = { nome_embarque: '145º', etd_atual: '2026-09-17', historico_rolagens: [
    { data_anterior: '2026-08-26', nova_data: '2026-08-09', data_comunicacao: '2026-08-26' },
    { data_anterior: '2026-08-09', nova_data: '2026-09-17', data_comunicacao: '2026-08-09' }] };
  const r = C.ocorrencias(emb, null, { hoje });
  assert.equal(r.lista.filter((o) => o.conferir).length, 2);
  assert.match(r.lista[0].detalhe, /conferir/);
  assert.equal(r.diasAtraso, 22);
});
