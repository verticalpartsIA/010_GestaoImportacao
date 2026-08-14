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
      window.toast('Sinal confirmado — pode iniciar a compra no fornecedor!', 'success');
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
        <p className="small muted">Depois de confirmado, a Cotação a Fornecedor correspondente já pode iniciar a compra do equipamento na China.</p>
      </div>
    </Modal>
  );
}

/* Aprovação do CEO (Diego) e do responsável pelo sistema — mesmo peso, sem
   ordem estrita entre elas, ambas exigidas antes de "Decidir comprar"
   (ver AvalFinanceiroStore.podeIniciarCompra). A "minha" é restrita por
   identidade — o botão fica desabilitado pra quem não for o dono. */
function AFAprovacoes({ row, onSaved }) {
  const a = row.aval;
  const [busy, setBusy] = React.useState(null);
  const souOwner = window.AvalFinanceiroStore.isOwner();

  const aprovar = async (quem) => {
    setBusy(quem);
    try {
      if (quem === 'ceo') await window.AvalFinanceiroStore.aprovarComoCEO(a.numero_cotacao);
      else await window.AvalFinanceiroStore.aprovarComoOwner(a.numero_cotacao);
      window.toast('Aprovação registrada.', 'success');
      onSaved();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
      {a.aprovacao_ceo_em
        ? <Badge variant="success" dot>CEO aprovou · {new Date(a.aprovacao_ceo_em).toLocaleDateString('pt-BR')}</Badge>
        : <Button variant="outline" size="sm" disabled={busy === 'ceo'} onClick={() => aprovar('ceo')}>{busy === 'ceo' ? 'Salvando…' : 'Aprovação CEO (Diego)'}</Button>}
      {a.aprovacao_owner_em
        ? <Badge variant="success" dot>Responsável aprovou · {new Date(a.aprovacao_owner_em).toLocaleDateString('pt-BR')}</Badge>
        : <Button variant="outline" size="sm" disabled={!souOwner || busy === 'owner'} title={!souOwner ? 'Só o responsável pelo sistema pode dar esta aprovação.' : undefined} onClick={() => aprovar('owner')}>{busy === 'owner' ? 'Salvando…' : 'Minha aprovação'}</Button>}
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
          {status === 'aprovado' && !a.sinal_pago && (
            <Button variant="primary" size="sm" onClick={() => onOpenModal('sinal', row)}>Confirmar sinal</Button>
          )}
        </div>
      </div>
      {status === 'aprovado' && <AFAprovacoes row={row} onSaved={onSaved}/>}
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
  const aguardandoSinal = fila.filter((r) => r.aval.status === 'aprovado' && !r.aval.sinal_pago);
  const reprovados = fila.filter((r) => r.aval.status === 'reprovado');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Aval de Vendas</div>
          <h1 className="page-head__title">Aval Financeiro</h1>
          <p className="page-head__sub">Consulta de score e aval de venda antes do contrato · confirmação do sinal antes da compra no fornecedor.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando consulta" value={pendConsulta.length} sub="propostas aprovadas" delta="—" deltaDir="up" icon="fileSearch"/>
        <KPI label="Aguardando aval" value={pendAval.length} sub="decisão pendente" delta="—" deltaDir="up" icon="zap"/>
        <KPI label="Aguardando sinal" value={aguardandoSinal.length} sub="contrato liberado" delta="—" deltaDir="up" icon="dollar"/>
        <KPI label="Reprovados" value={reprovados.length} sub="venda bloqueada" delta="—" deltaDir="down" icon="warning"/>
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
