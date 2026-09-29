/* ============================================================
   aval-juridico.jsx — Aval Jurídico
   Gate entre "Contrato de Venda assinado" e "Desenho do Projeto de
   Instalação liberado pra envio". Ver aval-juridico-store.js pro gate
   real (podeEnviarDesenho, checado por CVDesenhoInstalacaoSection em
   contrato-venda.jsx).
   ============================================================ */

const AJ_STATUS = {
  pendente:  { label: 'Aguardando aval', tone: 'yellow' },
  aprovado:  { label: 'Aprovado',        tone: 'green' },
  reprovado: { label: 'Reprovado',       tone: 'red' },
};

function AJBadge({ status }) {
  const st = AJ_STATUS[status] || AJ_STATUS.pendente;
  return <Badge variant={st.tone === 'green' ? 'success' : st.tone === 'red' ? 'danger' : 'warning'} dot>{st.label}</Badge>;
}

function AJModalAval({ row, aprovado, onClose, onSaved }) {
  const [observacoes, setObservacoes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      await window.AvalJuridicoStore.darAval(row.aval.id, aprovado, observacoes);
      window.toast(aprovado ? 'Aval concedido — desenho liberado pra envio (junto com sinal pago e contrato assinado)!' : 'Contrato reprovado.', aprovado ? 'success' : 'warning');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={aprovado ? 'Dar aval jurídico' : 'Reprovar contrato'} onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={aprovado ? 'primary' : 'danger'} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : (aprovado ? 'Confirmar aval' : 'Confirmar reprovação')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · Contrato {row.aval.numero_documento}</div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações {aprovado ? '(opcional)' : '(motivo da reprovação)'}</label>
          <textarea className="input" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder={aprovado ? 'Ressalvas, condições especiais…' : 'Explique o motivo da reprovação…'}/>
        </div>
      </div>
    </Modal>
  );
}

function AJRow({ row, onOpenModal }) {
  const a = row.aval;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="up-eyebrow muted">{a.numero_documento}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{a.cliente_nome || '—'}</div>
        <div className="cell-sub mono">{fmtBRL(row.contrato.valor_total_num)}</div>
      </div>
      <AJBadge status={a.status}/>
      {a.status === 'pendente' && (
        <div className="row gap-2">
          <Button variant="danger" size="sm" onClick={() => onOpenModal('reprovar', row)}>Reprovar</Button>
          <Button variant="primary" size="sm" onClick={() => onOpenModal('aprovar', row)}>Dar aval</Button>
        </div>
      )}
    </div>
  );
}

function AvalJuridicoPage({ setRoute }) {
  const [fila, setFila] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null); // { type, row }

  const reload = React.useCallback(() => {
    setLoading(true);
    window.AvalJuridicoStore.listarFila()
      .then((rows) => setFila(rows))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const pendentes = fila.filter((r) => r.aval.status === 'pendente');
  const aprovados = fila.filter((r) => r.aval.status === 'aprovado');
  const reprovados = fila.filter((r) => r.aval.status === 'reprovado');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Aval de Contratos</div>
          <h1 className="page-head__title">Aval Jurídico</h1>
          <p className="page-head__sub">Todo Contrato de Venda assinado pelo cliente entra aqui — o aval, junto com sinal pago e contrato assinado, libera o envio do Desenho do Projeto de Instalação.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando aval" value={pendentes.length} sub="contratos assinados" delta="—" deltaDir="up" icon="scale"/>
        <KPI label="Aprovados" value={aprovados.length} sub="desenho liberado" delta="—" deltaDir="up" icon="shield"/>
        <KPI label="Reprovados" value={reprovados.length} sub="contrato bloqueado" delta="—" deltaDir="down" icon="warning"/>
      </div>

      <Card title="Fila do Jurídico" sub={`${fila.length} contratos assinados pelo cliente`}>
        <div className="stack" style={{ gap: 10 }}>
          {fila.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Nenhum Contrato de Venda assinado aguardando o Jurídico ainda.
            </div>
          )}
          {fila.map((row) => (
            <AJRow key={row.contrato.id} row={row} onOpenModal={(type, row) => setModal({ type, row })}/>
          ))}
        </div>
      </Card>

      {modal?.type === 'aprovar' && <AJModalAval row={modal.row} aprovado onClose={() => setModal(null)} onSaved={reload}/>}
      {modal?.type === 'reprovar' && <AJModalAval row={modal.row} aprovado={false} onClose={() => setModal(null)} onSaved={reload}/>}
    </div>
  );
}

window.AvalJuridicoPage = AvalJuridicoPage;
