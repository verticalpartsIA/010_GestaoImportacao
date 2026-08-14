/* ============================================================
   almoxarifado.jsx — Pedidos de Compra de Varejo (insumos/peças pra
   estoque). Todo pedido nasce com uma decisão pendente do Chefe de
   Logística (Danilo) — ver pedidos-varejo-store.js / decisoes-store.js.
   ============================================================ */

const AV_URGENCIA_LABEL = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
const AV_STATUS_LABEL = { pendente: 'Aguardando Logística', aprovado: 'Aprovado', reprovado: 'Reprovado', comprado: 'Comprado', cancelado: 'Cancelado' };
function fmtBRL(v) { return v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function AVModalNovoPedido({ onClose, onSaved }) {
  const [item, setItem] = React.useState('');
  const [quantidade, setQuantidade] = React.useState(1);
  const [unidade, setUnidade] = React.useState('un');
  const [valorEstimado, setValorEstimado] = React.useState('');
  const [urgencia, setUrgencia] = React.useState('normal');
  const [justificativa, setJustificativa] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    if (!item.trim()) return window.toast?.('Informe o item.', 'warning');
    setSaving(true);
    try {
      await window.PedidosVarejoStore.criarPedido({ item, quantidade, unidade, valorEstimado, urgencia, justificativa });
      window.toast?.('Pedido criado — aguardando aprovação da Logística.', 'success');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Novo pedido de compra de varejo" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Enviar pedido'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Item *</label>
          <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="ex.: Parafuso M8 inox, Cabo de aço 6mm…"/>
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Quantidade</label>
            <input className="input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)}/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Unidade</label>
            <input className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg, m…"/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Valor estimado (R$)</label>
            <input className="input" type="number" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="0,00"/>
          </div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Urgência</label>
          <select className="input" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
            {Object.entries(AV_URGENCIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Justificativa</label>
          <textarea className="input" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que esse item é necessário…"/>
        </div>
      </div>
    </Modal>
  );
}

function AlmoxarifadoPage() {
  const [pedidos, setPedidos] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(null);

  const reload = React.useCallback(() => {
    window.PedidosVarejoStore.listarPedidos().then(setPedidos).catch(() => setPedidos([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const comprar = async (p) => {
    setBusy(p.id);
    try { await window.PedidosVarejoStore.marcarComprado(p.id); window.toast?.('Marcado como comprado.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(null); }
  };

  if (pedidos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const pendentes = pedidos.filter((p) => p.status === 'pendente');
  const aprovados = pedidos.filter((p) => p.status === 'aprovado');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Almoxarifado</div>
          <h1 className="page-head__title">Pedidos de Compra (Varejo)</h1>
          <p className="page-head__sub">Insumos e peças para estoque — não equipamento de venda. Exige aprovação do Chefe de Logística.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>Novo pedido</Button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando Logística" value={pendentes.length} sub="decisão pendente" delta="—" deltaDir="up" icon="clock"/>
        <KPI label="Aprovados, aguardando compra" value={aprovados.length} sub="liberados" delta="—" deltaDir="up" icon="check"/>
        <KPI label="Total de pedidos" value={pedidos.length} sub="histórico" delta="—" deltaDir="up" icon="package"/>
      </div>

      <Card title="Pedidos" sub={`${pedidos.length} no total`}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr><th>Nº</th><th>Item</th><th>Qtd</th><th className="text-right">Valor est.</th><th>Urgência</th><th>Solicitante</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {pedidos.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum pedido ainda.</td></tr>
              )}
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.numero_documento}</td>
                  <td>{p.item}</td>
                  <td>{p.quantidade} {p.unidade || ''}</td>
                  <td className="cell-money">{fmtBRL(p.valor_estimado)}</td>
                  <td><StatusBadge status={AV_URGENCIA_LABEL[p.urgencia] || p.urgencia}/></td>
                  <td className="small muted">{p.solicitante_nome || '—'}</td>
                  <td>
                    <StatusBadge status={AV_STATUS_LABEL[p.status] || p.status}/>
                    {p.status === 'reprovado' && p.motivo && <div className="small muted" style={{ marginTop: 2 }}>{p.motivo}</div>}
                  </td>
                  <td>
                    {p.status === 'aprovado' && <Button variant="primary" size="sm" disabled={busy === p.id} onClick={() => comprar(p)}>{busy === p.id ? '…' : 'Marcar comprado'}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && <AVModalNovoPedido onClose={() => setModalOpen(false)} onSaved={reload}/>}
    </div>
  );
}

window.AlmoxarifadoPage = AlmoxarifadoPage;
