/* ============================================================
   cotacao-quadro-comando.jsx — Cotação Quadro de Comando
   Fluxo completo: Pedido QC → Cotação a Fornecedor →
   Precificação → Proposta
   ============================================================ */

const CQC_STATUS_COR = {
  rascunho: '#64748b', enviada: '#2563eb', respondida: '#059669',
  em_cotacao: '#b45309', precificada: '#7c3aed', proposta_enviada: '#06b6d4', concluida: '#059669',
};

function CqcStatusChip({ status }) {
  if (!status) return <span className="muted">—</span>;
  const cor = CQC_STATUS_COR[status] || '#64748b';
  return <span className="la-setor" style={{ background: cor }}>{status.replace(/_/g, ' ')}</span>;
}

function CotacaoQuadroComandoPage({ setRoute, setSubsel }) {
  const [rows, setRows] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fStatus, setFStatus] = React.useState('Todos');
  const [refreshing, setRefreshing] = React.useState(false);
  const [abrindo, setAbrindo] = React.useState(null);

  const carregar = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await window.CotacaoQuadroComandoStore.listarCotacoes();
      setRows(data);
    } catch (e) {
      window.toast?.('Erro ao carregar cotações: ' + e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const abrirNoFormulario = async (r) => {
    setAbrindo(r.id);
    try {
      setSubsel(r.id);
      setRoute('formulario-quadro-comando');
    } catch (e) {
      window.toast?.('Erro ao abrir: ' + e.message, 'error');
    } finally {
      setAbrindo(null);
    }
  };

  const statusDisponiveis = React.useMemo(() => {
    if (!rows) return [];
    const statuses = [...new Set(rows.map(r => r.status).filter(Boolean))];
    return ['Todos', ...statuses.sort()];
  }, [rows]);

  const filtered = React.useMemo(() => {
    if (!rows) return [];
    return rows.filter(r => {
      const matchStatus = fStatus === 'Todos' || r.status === fStatus;
      const matchBusca = !busca.trim() ||
        String(r.numero_pedido).includes(busca) ||
        String(r.numero_cotacao || '').includes(busca);
      return matchStatus && matchBusca;
    });
  }, [rows, busca, fStatus]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Pré-venda</div>
          <h1 className="page-head__title">Cotação Quadro de Comando</h1>
          <p className="page-head__sub">Gerenciamento do fluxo completo: pedido → cotação → precificação → proposta</p>
        </div>
        <div className="row gap-2">
          <Button variant="outline" disabled={refreshing} onClick={carregar}>{refreshing ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <input className="input" style={{ flex: 1 }} placeholder="Buscar por pedido, cotação…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
          <select className="input" style={{ minWidth: 150 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            {statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {rows === null ? (
        <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Nenhuma cotação encontrada</div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>Pedido Nº</th>
              <th>Cotação Nº</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Especificações</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => abrirNoFormulario(r)} style={{ cursor: 'pointer' }}>
                  <td><strong>#{r.numero_pedido}</strong></td>
                  <td><span className="mono">{r.numero_cotacao || '—'}</span></td>
                  <td><CqcStatusChip status={r.status}/></td>
                  <td>{r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg2)' }}>
                    {r.potencia_kw ? `${r.potencia_kw} kW` : '—'} · {r.tensao_v ? `${r.tensao_v}V` : '—'}
                  </td>
                  <td><Button variant="ghost" size="sm" icon="chevRight" disabled={abrindo === r.id}>{abrindo === r.id ? '…' : ''}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row sb" style={{ marginTop: 14, fontSize: 12, color: 'var(--fg3)' }}>
        <span>Exibindo <b>{filtered.length}</b> de <b>{rows?.length || 0}</b> cotações</span>
      </div>
    </div>
  );
}

Object.assign(window, { CotacaoQuadroComandoPage });
