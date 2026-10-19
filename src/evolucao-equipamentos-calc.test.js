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
