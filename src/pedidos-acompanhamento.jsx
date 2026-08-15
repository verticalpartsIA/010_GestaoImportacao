/* ============================================================
   pedidos-acompanhamento.jsx — Pedidos (acompanhamento de status)
   Nacional/Importação. Diferente do "Pedido a Fornecedor" já existente
   em Cotações a Fornecedor (esse é envio de RFQ, não pedido confirmado).
   ============================================================ */

const PED_SETORES = ['Nacional', 'Importação'];
const PED_STATUS = ['Aberto', 'Em andamento', 'Recebido', 'Cancelado'];

function pedFmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
function pedFmtMoeda(v, moeda) { return (v == null || v === '') ? '—' : `${moeda || 'BRL'} ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

const PED_EMPTY = {
  numero_pedido: '', setor: 'Nacional', fornecedor: '', descricao: '', status: 'Aberto',
  data_pedido: '', data_prevista: '', data_recebimento: '', valor_total: '', moeda: 'BRL', observacoes: '',
};

function PedidoForm({ initialData, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...PED_EMPTY, ...initialData } : PED_EMPTY));
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));

  return (
    <Card title={isEdit ? `Editar pedido ${form.numero_pedido || ''}` : 'Novo pedido'}>
      <div className="grid-3" style={{ gap: 10 }}>
        <PIField label="Nº do pedido"><PIInput value={form.numero_pedido} onChange={set('numero_pedido')}/></PIField>
        <PIField label="Setor"><PISelect value={form.setor} onChange={set('setor')} options={PED_SETORES}/></PIField>
        <PIField label="Status"><PISelect value={form.status} onChange={set('status')} options={PED_STATUS}/></PIField>
        <PIField label="Fornecedor" span={2}>
          <PIInput value={form.fornecedor} onChange={set('fornecedor')} list="dl-fornecedores-pedidos"/>
          <CadFornecedorDatalist id="dl-fornecedores-pedidos"/>
        </PIField>
        <PIField label="Valor total"><PIInput type="number" value={form.valor_total} onChange={set('valor_total')}/></PIField>
        <PIField label="Moeda"><PISelect value={form.moeda} onChange={set('moeda')} options={['BRL', 'USD', 'EUR', 'CNY', 'GBP']}/></PIField>
        <PIField label="Data do pedido"><PIInput type="date" value={form.data_pedido} onChange={set('data_pedido')}/></PIField>
        <PIField label="Data prevista"><PIInput type="date" value={form.data_prevista} onChange={set('data_prevista')}/></PIField>
        <PIField label="Data de recebimento"><PIInput type="date" value={form.data_recebimento} onChange={set('data_recebimento')}/></PIField>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="up-eyebrow muted">Descrição</label>
        <input className="input" value={form.descricao} onChange={(e) => set('descricao')(e.target.value)} placeholder="O que está sendo pedido"/>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="up-eyebrow muted">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes')(e.target.value)}/>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={() => onSubmit(form)} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar pedido')}</Button>
      </div>
    </Card>
  );
}

function PedidosAcompanhamentoPage() {
  const [items, setItems] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [tab, setTab] = React.useState('Nacional');
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('Todos');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => { window.PedidosAcompanhamentoStore.listarTodos().then(setItems).catch(() => setItems([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      /* `editing` também carrega { setor } pré-preenchido pra um pedido NOVO
         (sem id) — só é edição de verdade quando tem id. */
      if (editing && editing.id) await window.PedidosAcompanhamentoStore.atualizar(editing.id, form);
      else await window.PedidosAcompanhamentoStore.criar(form);
      window.toast?.(editing ? 'Pedido atualizado.' : 'Pedido criado.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (p) => {
    if (!window.confirm(`Excluir o pedido "${p.numero_pedido || p.descricao || 'sem número'}"?`)) return;
    try { await window.PedidosAcompanhamentoStore.remover(p.id); window.toast?.('Pedido excluído.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const doSetor = items.filter((p) => p.setor === tab);
  const filtered = doSetor.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.numero_pedido || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q) || (p.descricao || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Todos' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Suprimentos</div>
          <h1 className="page-head__title">Pedidos</h1>
          <p className="page-head__sub">Acompanhamento de status de pedidos de compra — Nacional e Importação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing({ setor: tab }); setShowForm(true); }}>Novo pedido</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <PedidoForm initialData={editing && editing.id ? editing : { ...PED_EMPTY, setor: tab }} isEdit={!!(editing && editing.id)} saving={saving}
            onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <Tabs tabs={[
        { key: 'Nacional', label: 'Nacional', count: items.filter((p) => p.setor === 'Nacional').length },
        { key: 'Importação', label: 'Importação', count: items.filter((p) => p.setor === 'Importação').length },
      ]} active={tab} onChange={setTab}/>

      <div className="row gap-2" style={{ margin: '14px 0' }}>
        <input className="input" style={{ flex: 1 }} placeholder="Buscar por nº, fornecedor ou descrição…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {PED_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Nº pedido</th><th>Fornecedor</th><th>Descrição</th><th>Status</th><th>Data pedido</th><th>Previsão</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum pedido encontrado.</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.numero_pedido || '—'}</td>
                <td>{p.fornecedor || '—'}</td>
                <td>{p.descricao || '—'}</td>
                <td><StatusBadge status={p.status}/></td>
                <td>{pedFmtDate(p.data_pedido)}</td>
                <td>{pedFmtDate(p.data_prevista)}</td>
                <td>{pedFmtMoeda(p.valor_total, p.moeda)}</td>
                <td>
                  <div className="row gap-1">
                    <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={() => { setEditing(p); setShowForm(true); }}/>
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluir(p)}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.PedidosAcompanhamentoPage = PedidosAcompanhamentoPage;
