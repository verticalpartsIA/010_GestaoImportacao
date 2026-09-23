/* ============================================================
   cotacao-quadro-comando.jsx — Cotação Quadro de Comando & Checklists
   Gerenciamento de cotações e checklists de produção interna
   ============================================================ */

const STATUS_COR = {
  rascunho: '#64748b', enviada: '#2563eb', respondida: '#059669',
  em_cotacao: '#b45309', precificada: '#7c3aed', proposta_enviada: '#06b6d4', concluida: '#059669',
  em_producao: '#f59e0b', pronto: '#10b981', cancelado: '#ef4444',
};

function StatusChip({ status }) {
  if (!status) return <span className="muted">—</span>;
  const cor = STATUS_COR[status] || '#64748b';
  return <span className="la-setor" style={{ background: cor }}>{status.replace(/_/g, ' ')}</span>;
}

function ModalVisualizarChecklist({ checklist, onClose }) {
  if (!checklist) return null;
  const dados = checklist.checklist_data || {};
  const maquina = dados.maquina || {};

  const imprimirChecklist = () => window.print?.();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'white', borderRadius: 8, maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: 32, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2>Checklist Nº {checklist.numero_checklist}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={imprimirChecklist}>Imprimir</Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
          <div>
            <h4 className="small muted" style={{ marginBottom: 8 }}>Pedido</h4>
            <p style={{ fontSize: 18, fontWeight: 'bold' }}>#{checklist.numero_pedido}</p>
          </div>
          <div>
            <h4 className="small muted" style={{ marginBottom: 8 }}>Status</h4>
            <StatusChip status={checklist.status}/>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, marginBottom: 24 }}>
          <h4>Especificações da Máquina</h4>
          <div className="grid-3" style={{ gap: 16, marginTop: 12 }}>
            <div>
              <span className="small muted">Potência</span>
              <p style={{ fontWeight: 'bold' }}>{maquina.potencia_kw || '—'} kW</p>
            </div>
            <div>
              <span className="small muted">Tensão</span>
              <p style={{ fontWeight: 'bold' }}>{maquina.tensao_v || '—'} V</p>
            </div>
            <div>
              <span className="small muted">Fases</span>
              <p style={{ fontWeight: 'bold' }}>{maquina.fases || '—'}</p>
            </div>
            <div>
              <span className="small muted">Frequência</span>
              <p style={{ fontWeight: 'bold' }}>{maquina.frequencia_hz || '—'} Hz</p>
            </div>
            <div>
              <span className="small muted">Tipo de Freio</span>
              <p style={{ fontWeight: 'bold' }}>{maquina.freio_tipo || '—'}</p>
            </div>
            <div>
              <span className="small muted">Nº de Paradas</span>
              <p style={{ fontWeight: 'bold' }}>{dados.paradas?.length || 0}</p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
          <h4>Componentes</h4>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {dados.componentes && Object.keys(dados.componentes).length > 0 ? (
              <ul style={{ lineHeight: 1.8 }}>
                {Object.entries(dados.componentes).map(([key, val]) => (
                  <li key={key}><strong>{key}:</strong> {String(val)}</li>
                ))}
              </ul>
            ) : (
              <span className="muted">Sem componentes registrados</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--fg3)' }}>
          <p>Criado em {new Date(checklist.created_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}

function CotacaoQuadroComandoPage({ setRoute, setSubsel }) {
  const [rows, setRows] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fStatus, setFStatus] = React.useState('Todos');
  const [refreshing, setRefreshing] = React.useState(false);

  const carregar = React.useCallback(async () => {
    setRefreshing(true);
    try {
      if (!window.__VP_SB || !window.__VP_SB.sb) throw new Error('Supabase não inicializado');
      const { data, error } = await window.__VP_SB.sb.from('quadros_comando').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      window.toast?.('Erro ao carregar: ' + e.message, 'error');
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

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
        String(r.numero_pedido || '').includes(busca) ||
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
          <p className="page-head__sub">Gerenciamento de cotações e checklists de produção</p>
        </div>
        <div className="row gap-2">
          <Button variant="outline" disabled={refreshing} onClick={carregar}>{refreshing ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <input className="input" style={{ flex: 1 }} placeholder="Buscar por pedido, cotação…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
          <select className="input" style={{ minWidth: 150 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            {statusDisponiveis.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Status: Todos' : s}</option>)}
          </select>
        </div>
      </Card>

      {rows === null ? (
        <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Nenhum registro encontrado</div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>Pedido Nº</th>
              <th>Nº Cotação</th>
              <th>Status</th>
              <th>Criado em</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }}>
                  <td><strong>#{r.numero_pedido}</strong></td>
                  <td><span className="mono">{r.numero_cotacao || '—'}</span></td>
                  <td><StatusChip status={r.status}/></td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row sb" style={{ marginTop: 14, fontSize: 12, color: 'var(--fg3)' }}>
        <span>Exibindo <b>{filtered.length}</b> de <b>{rows?.length || 0}</b> registros</span>
      </div>
    </div>
  );
}

Object.assign(window, { CotacaoQuadroComandoPage });
