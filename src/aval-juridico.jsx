/* ============================================================
   aval-juridico.jsx — Aval Jurídico
   Desde 29/09/2026 abre JUNTO com o Aval Financeiro, quando o cliente
   aprova a Proposta. Com o Aval de Pagamento do Financeiro, libera a
   compra na China (AvalFinanceiroStore.podeIniciarCompra); também é uma
   das 3 condições do envio do Desenho de Instalação (podeEnviarDesenho,
   checado por CVDesenhoInstalacaoSection em contrato-venda.jsx).
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
      window.toast(aprovado ? 'Aval Jurídico concedido. Com o Aval de Pagamento do Financeiro, a compra na China fica liberada.' : 'Venda reprovada pelo Jurídico.', aprovado ? 'success' : 'warning');
      onSaved(); onClose();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={aprovado ? 'Dar aval jurídico' : 'Reprovar (Jurídico)'} onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={aprovado ? 'primary' : 'danger'} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : (aprovado ? 'Confirmar aval' : 'Confirmar reprovação')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="small muted">Cliente: <b>{row.aval.cliente_nome || '—'}</b> · {row.proposta ? `Proposta ${row.proposta.numero_documento || ''}` : `Contrato ${row.contrato?.numero_documento || ''}`}</div>
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
        <div className="up-eyebrow muted">{a.numero_cotacao != null ? `Cotação Nº ${a.numero_cotacao} · ` : ''}{a.numero_documento}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{a.cliente_nome || '—'}</div>
        <div className="cell-sub mono">{fmtBRL(row.valor)}</div>
        <div className="small muted">{row.contrato
          ? `Contrato ${row.contrato.numero_documento || ''} · ${row.contrato.status === 'assinado' ? 'assinado' : (row.contrato.status || '—')}`
          : 'Contrato de Venda ainda não gerado'}</div>
        <AvaisDaCotacao numeroCotacao={a.numero_cotacao} juridicoStatus={a.status}/>
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
          <p className="page-head__sub">Toda proposta aprovada pelo cliente entra aqui, junto com o Aval Financeiro. O Aval Jurídico + o Aval de Pagamento do Financeiro liberam a compra na China — e, com sinal pago e contrato assinado, o envio do Desenho de Instalação.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando aval" value={pendentes.length} sub="propostas aprovadas" delta="—" deltaDir="up" icon="scale"/>
        <KPI label="Aprovados" value={aprovados.length} sub="aval dado" delta="—" deltaDir="up" icon="shield"/>
        <KPI label="Reprovados" value={reprovados.length} sub="venda bloqueada" delta="—" deltaDir="down" icon="warning"/>
      </div>

      <Card title="Fila do Jurídico" sub={`${fila.length} vendas aprovadas pelo cliente`}>
        <div className="stack" style={{ gap: 10 }}>
          {fila.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Nenhuma proposta aprovada aguardando o Jurídico ainda.
            </div>
          )}
          {fila.map((row) => (
            <AJRow key={row.key} row={row} onOpenModal={(type, row) => setModal({ type, row })}/>
          ))}
        </div>
      </Card>

      {modal?.type === 'aprovar' && <AJModalAval row={modal.row} aprovado onClose={() => setModal(null)} onSaved={reload}/>}
      {modal?.type === 'reprovar' && <AJModalAval row={modal.row} aprovado={false} onClose={() => setModal(null)} onSaved={reload}/>}
    </div>
  );
}

window.AvalJuridicoPage = AvalJuridicoPage;
