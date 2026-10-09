/* ============================================================
   aval-financeiro.jsx — Aval Financeiro
   Gate entre "Proposta aprovada" e "Contrato enviado" (consulta de score +
   aval de venda), e entre "Contrato assinado" e "Compra no fornecedor"
   (confirmação do sinal pago). Ver aval-financeiro-store.js pros gates
   reais (bloqueiam createDraft do Contrato de Venda e decidirComprar da
   Cotação a Fornecedor).
   ============================================================ */

const AF_STATUS = {
  pendente_consulta: { label: 'Aguardando consulta', tone: 'gray' },
  pendente_aval:      { label: 'Aguardando aval',     tone: 'yellow' },
  aprovado:           { label: 'Aprovado',            tone: 'green' },
  reprovado:          { label: 'Reprovado',           tone: 'red' },
};

function AFBadge({ status }) {
  const st = AF_STATUS[status] || AF_STATUS.pendente_consulta;
  return <Badge variant={st.tone === 'green' ? 'success' : st.tone === 'red' ? 'danger' : st.tone === 'yellow' ? 'warning' : 'neutral'} dot>{st.label}</Badge>;
}

function AFModalConsulta({ row, onClose, onSaved }) {
  const [fonte, setFonte] = React.useState('Serasa');
  const [score, setScore] = React.useState('');
  const [nota, setNota] = React.useState('');
  const [observacoes, setObservacoes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    if (!score.trim()) return window.toast('Informe o score/resultado da consulta.', 'warning');
    setSaving(true);
    try {
      await window.AvalFinanceiroStore.registrarConsulta(row.proposta.id, { fonte, score, nota, observacoes });
      window.toast('Consulta registrada!', 'success');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Consultar score do cliente" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Registrar consulta'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · Proposta {row.aval.numero_documento}</div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Fonte da consulta</label>
          <select className="input" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            {['Serasa', 'SPC', 'Boa Vista', 'Outro'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Score / resultado *</label>
            <input className="input" value={score} onChange={(e) => setScore(e.target.value)} placeholder="ex: 782"/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Classificação</label>
            <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ex: Baixo risco"/>
          </div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Restrições, pendências, contexto adicional…"/>
        </div>
      </div>
    </Modal>
  );
}

function AFModalAval({ row, aprovado, onClose, onSaved }) {
  const [observacoes, setObservacoes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      await window.AvalFinanceiroStore.darAval(row.aval.id, aprovado, observacoes);
      window.toast(aprovado ? 'Aval concedido — venda liberada!' : 'Venda reprovada.', aprovado ? 'success' : 'warning');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const c = row.aval.consulta || {};
  return (
    <Modal title={aprovado ? 'Dar aval — liberar venda' : 'Reprovar venda'} onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={aprovado ? 'primary' : 'danger'} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : (aprovado ? 'Confirmar aval' : 'Confirmar reprovação')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · Proposta {row.aval.numero_documento}</div>
        <div className="ci-audit">
          <div className="ci-audit-row"><span className="k">Fonte da consulta</span><span className="v">{c.fonte || '—'}</span></div>
          <div className="ci-audit-row"><span className="k">Score / resultado</span><span className="v">{c.score || '—'}</span></div>
          <div className="ci-audit-row"><span className="k">Classificação</span><span className="v">{c.nota || '—'}</span></div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações {aprovado ? '(opcional)' : '(motivo da reprovação)'}</label>
          <textarea className="input" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder={aprovado ? 'Condições especiais, ressalvas…' : 'Explique o motivo da reprovação…'}/>
        </div>
      </div>
    </Modal>
  );
}

function AFModalSinal({ row, onClose, onSaved }) {
  const [valor, setValor] = React.useState('');
  const [pagoEm, setPagoEm] = React.useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      await window.AvalFinanceiroStore.confirmarSinal(row.aval.id, { valor: valor ? Number(valor) : null, pagoEm });
      window.toast('Sinal confirmado. Faltam o Aval de Pagamento e o Aval Jurídico para liberar a compra.', 'success');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Confirmar sinal pago" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar sinal'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · Proposta {row.aval.numero_documento}</div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Valor recebido (R$)</label>
            <input className="input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00"/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Data do pagamento</label>
            <input className="input" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)}/>
          </div>
        </div>
        <p className="small muted">Depois do sinal, o Financeiro dá o Aval de Pagamento (aqui mesmo, ou em Prazos &amp; Pendências). Com ele e o Aval Jurídico, a compra na China é liberada.</p>
      </div>
    </Modal>
  );
}

/* 07/10 — "Dar Aval de Pagamento" também aqui. Antes o botão só existia em Prazos & Pendências
   (linha da etapa "Aguardando Aval de Pagamento"); esta tela só mostrava o selo "pendente" — na cotação 955
   o Financeiro deu sinal pago + consulta de score + "aval pra vender" aqui e achou que estava liberado, mas o
   Aval de Pagamento (o que libera "Decidir comprar") ficou aberto. Mesma chamada da outra tela
   (AvalFinanceiroStore.confirmarAvalPagamento → evento AVAL_PAGAMENTO_CONFIRMADO fecha a etapa). */
function AFModalAvalPagamento({ row, onClose, onSaved }) {
  const [observacoes, setObservacoes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const confirmar = async () => {
    setSaving(true);
    try {
      await window.AvalFinanceiroStore.confirmarAvalPagamento(row.aval.id, observacoes);
      window.toast('Aval de Pagamento confirmado. Com o Aval Jurídico, a compra na China fica liberada.', 'success');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Dar Aval de Pagamento" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={confirmar} disabled={saving}>{saving ? 'Confirmando…' : 'Dar Aval de Pagamento'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · Proposta {row.aval.numero_documento}</div>
        <p className="muted" style={{ fontSize: 13 }}>
          Checkpoint manual do Financeiro depois do sinal pago. Junto com o Aval Jurídico, libera a compra ao fornecedor
          (botão "Decidir comprar"). Não é o mesmo que o "aval pra vender" (consulta de score), que é opcional.
        </p>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações (opcional)</label>
          <textarea className="input" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ressalvas, conferência feita…"/>
        </div>
      </div>
    </Modal>
  );
}

/* Status dos dois avais que liberam a compra na China (29/09/2026):
   Aval de Pagamento (Financeiro, depois do sinal — dado aqui ou em "Prazos &
   Pendências") + Aval Jurídico (tela "Aval Jurídico"). A aprovação do CEO só
   aparece quando a margem efetiva da precificação fica abaixo de 15% (ou é
   desconhecida) — "CEO só chega nele dentro de discrepâncias". A antiga
   "Minha aprovação" (responsável pelo sistema) saiu: deixou de travar a
   compra. Ver AvalFinanceiroStore.podeIniciarCompra. */
function AFAprovacoes({ row, onSaved }) {
  const a = row.aval;
  const propostaId = row.proposta ? row.proposta.id : null;
  const [busy, setBusy] = React.useState(false);
  const [ceo, setCeo] = React.useState(null); // {precisa, margem}
  const [aj, setAj] = React.useState(undefined); // undefined = carregando
  const [avalPagAberto, setAvalPagAberto] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    setCeo(null); setAj(undefined);
    window.AvalFinanceiroStore.precisaAprovacaoCeo(a.numero_cotacao)
      .then((r) => { if (vivo) setCeo(r); })
      .catch(() => { if (vivo) setCeo({ precisa: true, margem: null }); });
    const ajStore = window.AvalJuridicoStore;
    (ajStore && propostaId ? ajStore.getByPropostaId(propostaId) : Promise.resolve(null))
      .then((r) => { if (vivo) setAj(r); })
      .catch(() => { if (vivo) setAj(null); });
    return () => { vivo = false; };
  }, [a.id, a.numero_cotacao, propostaId]);

  const aprovarCeo = async () => {
    setBusy(true);
    try {
      await window.AvalFinanceiroStore.aprovarComoCEO(a.numero_cotacao);
      window.toast('Aprovação do CEO registrada.', 'success');
      onSaved();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const margemTxt = ceo && ceo.margem != null ? `${(ceo.margem * 100).toFixed(1).replace('.', ',')}%` : null;
  const ajStatus = aj === undefined ? null : (aj ? aj.status : 'pendente');

  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {a.aval_pagamento_confirmado
        ? <Badge variant="success" dot>Aval de Pagamento OK</Badge>
        : <>
            <Badge variant="warning" dot>Aval de Pagamento pendente (após o sinal)</Badge>
            <Button variant="outline" size="sm" disabled={!a.sinal_pago}
              title={a.sinal_pago ? 'Libera a compra ao fornecedor (junto com o Aval Jurídico)' : 'Confirme o sinal pago antes'}
              onClick={() => setAvalPagAberto(true)}>Dar Aval de Pagamento</Button>
          </>}
      {avalPagAberto && <AFModalAvalPagamento row={row} onClose={() => setAvalPagAberto(false)} onSaved={onSaved}/>}
      {ajStatus === 'aprovado' && <Badge variant="success" dot>Aval Jurídico OK</Badge>}
      {ajStatus === 'reprovado' && <Badge variant="danger" dot>Aval Jurídico reprovado</Badge>}
      {ajStatus === 'pendente' && <Badge variant="warning" dot>Aval Jurídico pendente</Badge>}
      <AvalEngenhariaBadge numeroCotacao={a.numero_cotacao}/>
      {ceo && !ceo.precisa && <Badge variant="neutral" dot>CEO não precisa aprovar (margem {margemTxt})</Badge>}
      {ceo && ceo.precisa && (a.aprovacao_ceo_em
        ? <Badge variant="success" dot>CEO aprovou · {new Date(a.aprovacao_ceo_em).toLocaleDateString('pt-BR')}</Badge>
        : <Button variant="outline" size="sm" disabled={busy}
            title={margemTxt ? `Margem ${margemTxt}, abaixo de 15%` : 'Margem desconhecida (sem precificação finalizada)'}
            onClick={aprovarCeo}>
            {busy ? 'Salvando…' : `Aprovação CEO (Diego) — margem ${margemTxt || 'desconhecida'}`}
          </Button>)}
    </div>
  );
}

function AFRow({ row, onOpenModal, onSaved }) {
  const a = row.aval;
  const status = a.status;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="up-eyebrow muted">{a.numero_documento}</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{a.cliente_nome || '—'}</div>
          <div className="cell-sub mono">{fmtBRL(a.valor_total)}</div>
        </div>
        <AFBadge status={status}/>
        {a.sinal_pago && <Badge variant="success" dot>Sinal pago</Badge>}
        <div className="row gap-2">
          {status === 'pendente_consulta' && (
            <Button variant="primary" size="sm" onClick={() => onOpenModal('consulta', row)}>Consultar score</Button>
          )}
          {status === 'pendente_aval' && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenModal('consulta', row)}>Refazer consulta</Button>
              <Button variant="danger" size="sm" onClick={() => onOpenModal('reprovar', row)}>Reprovar</Button>
              <Button variant="primary" size="sm" onClick={() => onOpenModal('aprovar', row)}>Dar aval</Button>
            </>
          )}
          {status !== 'reprovado' && !a.sinal_pago && (
            <Button variant="primary" size="sm" onClick={() => onOpenModal('sinal', row)}>Confirmar sinal</Button>
          )}
        </div>
      </div>
      {status !== 'reprovado' && <AFAprovacoes row={row} onSaved={onSaved}/>}
    </div>
  );
}

function AvalFinanceiroPage({ setRoute }) {
  const [fila, setFila] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null); // { type, row }

  const reload = React.useCallback(() => {
    setLoading(true);
    window.AvalFinanceiroStore.listarFila()
      .then((rows) => setFila(rows.map((r) => ({ proposta: r.proposta, aval: r.aval }))))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const pendConsulta = fila.filter((r) => r.aval.status === 'pendente_consulta');
  const pendAval = fila.filter((r) => r.aval.status === 'pendente_aval');
  const aguardandoSinal = fila.filter((r) => r.aval.status !== 'reprovado' && !r.aval.sinal_pago);
  const reprovados = fila.filter((r) => r.aval.status === 'reprovado');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Aval de Vendas</div>
          <h1 className="page-head__title">Aval Financeiro</h1>
          <p className="page-head__sub">Abre junto com o Aval Jurídico quando o cliente aprova a proposta · a compra na China libera com Aval de Pagamento (depois do sinal) + Aval Jurídico — CEO só se a margem ficar abaixo de 15% · consulta de score e aval de venda são opcionais.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando consulta" value={pendConsulta.length} sub="propostas aprovadas" delta="—" deltaDir="up" icon="fileSearch"/>
        <KPI label="Aguardando aval" value={pendAval.length} sub="decisão pendente" delta="—" deltaDir="up" icon="zap"/>
        <KPI label="Aguardando sinal" value={aguardandoSinal.length} sub="sinal a confirmar" delta="—" deltaDir="up" icon="dollar"/>
        <KPI label="Reprovados" value={reprovados.length} sub="avaliação negativa" delta="—" deltaDir="down" icon="warning"/>
      </div>

      <Card title="Fila do Financeiro" sub={`${fila.length} propostas aprovadas pelo cliente`}>
        <div className="stack" style={{ gap: 10 }}>
          {fila.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Nenhuma proposta aprovada aguardando o Financeiro ainda.
            </div>
          )}
          {fila.map((row) => (
            <AFRow key={row.proposta.id} row={row} onOpenModal={(type, row) => setModal({ type, row })} onSaved={reload}/>
          ))}
        </div>
      </Card>

      {modal?.type === 'consulta' && <AFModalConsulta row={modal.row} onClose={() => setModal(null)} onSaved={reload}/>}
      {modal?.type === 'aprovar' && <AFModalAval row={modal.row} aprovado onClose={() => setModal(null)} onSaved={reload}/>}
      {modal?.type === 'reprovar' && <AFModalAval row={modal.row} aprovado={false} onClose={() => setModal(null)} onSaved={reload}/>}
      {modal?.type === 'sinal' && <AFModalSinal row={modal.row} onClose={() => setModal(null)} onSaved={reload}/>}
    </div>
  );
}

window.AvalFinanceiroPage = AvalFinanceiroPage;
