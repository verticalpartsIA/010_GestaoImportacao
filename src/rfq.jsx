/* ============================================================
   rfq.jsx — Gestão Importação · RFQ (Request for Quotation)
   Fase 2 da consolidação de importação dentro do VP Gestão. Cotação
   comparativa: N fornecedores x N itens, vencedor por item ou global.
   ============================================================ */

const RFQ_STATUS = ['Aberta', 'Em análise', 'Fechada', 'Cancelada'];
const RFQ_MOEDAS = ['BRL', 'USD', 'EUR', 'CNY', 'GBP'];

function rfqFmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }

/* ---------- Formulário ---------- */
const RFQ_EMPTY = {
  numero_rfq: '', data: '', data_validade: '', status: 'Aberta',
  fornecedores: [], itens: [], fornecedor_vencedor_global_id: '',
  moeda_total_item: 'BRL', observacoes: '',
};

function RFQForm({ initialData, isEdit, numeroSugerido, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...RFQ_EMPTY, ...initialData } : { ...RFQ_EMPTY, numero_rfq: numeroSugerido, data: new Date().toISOString().slice(0, 10) }));
  const [modoGlobal, setModoGlobal] = React.useState(!!(initialData && initialData.fornecedor_vencedor_global_id));
  const [novoFornecedor, setNovoFornecedor] = React.useState('');
  const [novoItem, setNovoItem] = React.useState('');
  const store = window.RFQStore;

  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));

  const addFornecedor = () => {
    const nome = novoFornecedor.trim();
    if (!nome) return;
    if ((form.fornecedores || []).some((f) => f.fornecedor_nome.toLowerCase() === nome.toLowerCase())) {
      return window.toast?.('Esse fornecedor já está na RFQ.', 'warning');
    }
    const id = store.novoId();
    setForm((prev) => ({
      ...prev,
      fornecedores: [...(prev.fornecedores || []), { fornecedor_id: id, fornecedor_nome: nome, moeda: 'BRL' }],
      itens: (prev.itens || []).map((item) => ({ ...item, precos: [...(item.precos || []), { fornecedor_id: id, valor_unitario: null, valor_total: 0 }] })),
    }));
    setNovoFornecedor('');
  };

  const removeFornecedor = (id) => {
    setForm((prev) => ({
      ...prev,
      fornecedores: (prev.fornecedores || []).filter((f) => f.fornecedor_id !== id),
      itens: (prev.itens || []).map((item) => ({
        ...item, precos: (item.precos || []).filter((p) => p.fornecedor_id !== id),
        fornecedor_vencedor_id: item.fornecedor_vencedor_id === id ? '' : item.fornecedor_vencedor_id,
      })),
      fornecedor_vencedor_global_id: prev.fornecedor_vencedor_global_id === id ? '' : prev.fornecedor_vencedor_global_id,
    }));
  };

  const changeFornecedorMoeda = (id, moeda) => {
    setForm((prev) => ({ ...prev, fornecedores: (prev.fornecedores || []).map((f) => (f.fornecedor_id === id ? { ...f, moeda } : f)) }));
  };

  const addItem = () => {
    const nome = novoItem.trim();
    if (!nome) return;
    const item = {
      nome, codigo: '', unidade: '', quantidade: 1, observacao: '', fornecedor_vencedor_id: '',
      precos: (form.fornecedores || []).map((f) => ({ fornecedor_id: f.fornecedor_id, valor_unitario: null, valor_total: 0 })),
    };
    setForm((prev) => ({ ...prev, itens: [...(prev.itens || []), item] }));
    setNovoItem('');
  };

  const removeItem = (idx) => setForm((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }));

  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const itens = [...prev.itens];
      itens[idx] = { ...itens[idx], [field]: value };
      if (field === 'quantidade') {
        const qtd = parseFloat(value) || 0;
        itens[idx].precos = (itens[idx].precos || []).map((p) => ({ ...p, valor_total: typeof p.valor_unitario === 'number' ? qtd * p.valor_unitario : 0 }));
      }
      return { ...prev, itens };
    });
  };

  const updatePreco = (idx, fornecedorId, valorStr) => {
    const vu = valorStr === '' ? null : parseFloat(valorStr);
    setForm((prev) => {
      const itens = [...prev.itens];
      const item = { ...itens[idx] };
      const qtd = parseFloat(item.quantidade) || 0;
      item.precos = (item.precos || []).map((p) => (p.fornecedor_id === fornecedorId ? { ...p, valor_unitario: vu, valor_total: typeof vu === 'number' ? qtd * vu : 0 } : p));
      itens[idx] = item;
      return { ...prev, itens };
    });
  };

  const setVencedorItem = (idx, fornecedorId) => setForm((prev) => { const itens = [...prev.itens]; itens[idx] = { ...itens[idx], fornecedor_vencedor_id: fornecedorId }; return { ...prev, itens }; });
  const setVencedorGlobal = (fornecedorId) => setForm((prev) => ({ ...prev, fornecedor_vencedor_global_id: fornecedorId, itens: prev.itens.map((i) => ({ ...i, fornecedor_vencedor_id: fornecedorId })) }));
  const toggleModoGlobal = (checked) => {
    setModoGlobal(checked);
    if (!checked) setForm((prev) => ({ ...prev, fornecedor_vencedor_global_id: '' }));
    else setForm((prev) => ({ ...prev, itens: prev.itens.map((i) => ({ ...i, fornecedor_vencedor_id: '' })) }));
  };

  const totalPorFornecedor = React.useMemo(() => store.totalPorFornecedor(form.itens), [form.itens]);
  const totalItem = (item) => {
    const id = modoGlobal ? form.fornecedor_vencedor_global_id : item.fornecedor_vencedor_id;
    const p = (item.precos || []).find((x) => x.fornecedor_id === id);
    return p ? p.valor_total : 0;
  };

  const submit = () => {
    if (!form.numero_rfq.trim()) return window.toast?.('Informe o número da RFQ.', 'warning');
    onSubmit({ ...form, fornecedor_vencedor_global_id: modoGlobal ? form.fornecedor_vencedor_global_id : '' });
  };

  return (
    <Card title={isEdit ? `Editar RFQ ${form.numero_rfq}` : 'Nova RFQ'}>
      <div className="grid-3" style={{ gap: 12 }}>
        <PIField label="Nº RFQ"><PIInput value={form.numero_rfq} onChange={set('numero_rfq')}/></PIField>
        <PIField label="Data *"><PIInput type="date" value={form.data} onChange={set('data')}/></PIField>
        <PIField label="Validade"><PIInput type="date" value={form.data_validade} onChange={set('data_validade')}/></PIField>
        <PIField label="Status"><PISelect value={form.status} onChange={set('status')} options={RFQ_STATUS}/></PIField>
      </div>

      {/* Fornecedores participantes */}
      <div style={{ marginTop: 18 }}>
        <div className="row sb" style={{ marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Fornecedores participantes</h4>
          <span className="small muted">{(form.fornecedores || []).length} selecionado(s)</span>
        </div>
        <div className="row gap-2">
          <input className="input" style={{ flex: 1 }} placeholder="Nome do fornecedor…" value={novoFornecedor}
            onChange={(e) => setNovoFornecedor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFornecedor())}/>
          <Button variant="outline" icon="plus" onClick={addFornecedor}>Adicionar</Button>
        </div>
        {(form.fornecedores || []).length > 0 && (
          <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {form.fornecedores.map((f) => (
              <span key={f.fornecedor_id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
                {f.fornecedor_nome}
                <button type="button" onClick={() => removeFornecedor(f.fornecedor_id)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--vp-danger, #c00)' }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Itens */}
      <div style={{ marginTop: 18 }}>
        <div className="row sb" style={{ marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Itens</h4>
          <span className="small muted">{(form.itens || []).length} item(ns)</span>
        </div>
        <div className="row gap-2">
          <input className="input" style={{ flex: 1 }} placeholder="Nome do produto…" value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}/>
          <Button variant="outline" icon="plus" onClick={addItem}>Adicionar item</Button>
        </div>
        {(form.itens || []).length > 0 && (
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {form.itens.map((item, idx) => (
              <div key={idx} className="row gap-2" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <div className="small" style={{ fontWeight: 700 }}>{item.nome}</div>
                  <label className="up-eyebrow muted">Código/ref.</label>
                  <input className="input" value={item.codigo || ''} onChange={(e) => updateItem(idx, 'codigo', e.target.value)}/>
                </div>
                <div style={{ width: 90 }}>
                  <label className="up-eyebrow muted">Qtd *</label>
                  <input className="input" type="number" min="0" step="0.01" value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', e.target.value)}/>
                </div>
                <div style={{ width: 90 }}>
                  <label className="up-eyebrow muted">Unidade</label>
                  <input className="input" value={item.unidade || ''} onChange={(e) => updateItem(idx, 'unidade', e.target.value)} placeholder="un, kg…"/>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="up-eyebrow muted">Observação</label>
                  <input className="input" value={item.observacao || ''} onChange={(e) => updateItem(idx, 'observacao', e.target.value)}/>
                </div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItem(idx)}/>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparativo de preços */}
      {(form.itens || []).length > 0 && (form.fornecedores || []).length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="row sb" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Comparativo de preços</h4>
            <label className="row gap-2" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={modoGlobal} onChange={(e) => toggleModoGlobal(e.target.checked)}/>
              <span className="small">Vencedor único para todos os itens</span>
            </label>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Item</th><th>Qtd</th>
                  {form.fornecedores.map((f) => (
                    <th key={f.fornecedor_id}>
                      <div>{f.fornecedor_nome}</div>
                      <select className="input" style={{ height: 26, fontSize: 11, marginTop: 4 }} value={f.moeda || 'BRL'} onChange={(e) => changeFornecedorMoeda(f.fornecedor_id, e.target.value)}>
                        {RFQ_MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </th>
                  ))}
                  <th>{modoGlobal ? 'Vencedor global' : 'Vencedor'}</th>
                  <th>
                    Total item
                    <select className="input" style={{ height: 26, fontSize: 11, marginTop: 4 }} value={form.moeda_total_item} onChange={(e) => set('moeda_total_item')(e.target.value)}>
                      {RFQ_MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.itens.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.nome}</div>
                      <div className="cell-sub">{item.codigo ? `REF.: ${item.codigo}` : null}{item.observacao ? ` · "${item.observacao}"` : ''}</div>
                    </td>
                    <td>{item.quantidade}</td>
                    {form.fornecedores.map((f) => {
                      const p = (item.precos || []).find((pp) => pp.fornecedor_id === f.fornecedor_id);
                      return (
                        <td key={f.fornecedor_id}>
                          <input className="input" type="number" step="0.01" min="0" placeholder="unit." style={{ width: 100 }}
                            value={p && p.valor_unitario != null ? p.valor_unitario : ''} onChange={(e) => updatePreco(idx, f.fornecedor_id, e.target.value)}/>
                          <div className="small muted" style={{ marginTop: 2 }}>{store.fmtMoeda(p ? p.valor_total : 0, f.moeda)}</div>
                        </td>
                      );
                    })}
                    <td>
                      {modoGlobal ? (
                        form.fornecedor_vencedor_global_id ? <span className="small">✓ {(form.fornecedores.find((f) => f.fornecedor_id === form.fornecedor_vencedor_global_id) || {}).fornecedor_nome}</span> : <span className="muted small">—</span>
                      ) : (
                        <select className="input" value={item.fornecedor_vencedor_id || ''} onChange={(e) => setVencedorItem(idx, e.target.value)}>
                          <option value="">—</option>
                          {form.fornecedores.map((f) => <option key={f.fornecedor_id} value={f.fornecedor_id}>{f.fornecedor_nome}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--vp-success, #0a7)' }}>{store.fmtMoeda(totalItem(item), form.moeda_total_item)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><b>Totais por fornecedor</b></td>
                  {form.fornecedores.map((f) => <td key={f.fornecedor_id}><b>{store.fmtMoeda(totalPorFornecedor[f.fornecedor_id] || 0, f.moeda)}</b></td>)}
                  <td colSpan={2}></td>
                </tr>
                {modoGlobal && (
                  <tr>
                    <td colSpan={2 + form.fornecedores.length}><span className="small">Vencedor global:</span></td>
                    <td colSpan={2}>
                      <select className="input" value={form.fornecedor_vencedor_global_id || ''} onChange={(e) => setVencedorGlobal(e.target.value)}>
                        <option value="">Selecionar…</option>
                        {form.fornecedores.map((f) => <option key={f.fornecedor_id} value={f.fornecedor_id}>{f.fornecedor_nome}</option>)}
                      </select>
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {(form.itens || []).length > 0 && (form.fornecedores || []).length === 0 && (
        <p className="small" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--vp-warning-ink)' }}>Adicione fornecedores para ver o comparativo de preços.</p>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="up-eyebrow muted">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes')(e.target.value)}/>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Atualizar RFQ' : 'Criar RFQ')}</Button>
      </div>
    </Card>
  );
}

/* ---------- Página ---------- */
function RFQPage() {
  const [rfqs, setRfqs] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [numeroSugerido, setNumeroSugerido] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('Todos');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => { window.RFQStore.listarTodas().then(setRfqs).catch(() => setRfqs([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const abrirNova = async () => { setEditing(null); setNumeroSugerido(await window.RFQStore.gerarNumero()); setShowForm(true); };

  const salvar = async (form) => {
    setSaving(true);
    try {
      if (editing) await window.RFQStore.atualizar(editing.id, form);
      else await window.RFQStore.criar(form);
      window.toast?.(editing ? 'RFQ atualizada.' : 'RFQ criada.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (rfq) => {
    if (!window.confirm(`Excluir a RFQ ${rfq.numero_rfq}? Esta ação não pode ser desfeita.`)) return;
    try { await window.RFQStore.remover(rfq.id); window.toast?.('RFQ excluída.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (rfqs === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = rfqs.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch = !s || (r.numero_rfq || '').toLowerCase().includes(s) || (r.itens || []).some((i) => (i.nome || '').toLowerCase().includes(s));
    const matchStatus = filterStatus === 'Todos' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">RFQ</h1>
          <p className="page-head__sub">Request for Quotation — cotação comparativa de produtos com fornecedores.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={abrirNova}>Nova RFQ</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <RFQForm initialData={editing} isEdit={!!editing} numeroSugerido={numeroSugerido} saving={saving}
            onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <div className="row gap-2" style={{ marginBottom: 14 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Buscar por número ou produto…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 200 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {RFQ_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="small muted" style={{ marginBottom: 8 }}>{filtered.length} RFQ(s) encontrada(s)</div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>Nenhuma RFQ encontrada.</div>
      )}

      <div className="stack" style={{ gap: 10 }}>
        {filtered.map((r) => {
          const totalVenc = window.RFQStore.totalVencedor(r);
          return (
            <div key={r.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
              <div className="row sb" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="row gap-2" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 800 }}>{r.numero_rfq}</span>
                    <StatusBadge status={r.status}/>
                  </div>
                  <div className="cell-sub mono">
                    Data: {rfqFmtDate(r.data)} · Validade: {rfqFmtDate(r.data_validade)} · Itens: {(r.itens || []).length} · Fornecedores: {(r.fornecedores || []).length}
                  </div>
                  {totalVenc > 0 && <div className="small" style={{ marginTop: 4, color: 'var(--vp-success, #0a7)', fontWeight: 700 }}>Valor vencedor: {window.RFQStore.fmtMoeda(totalVenc, r.moeda_total_item)}</div>}
                </div>
                <div className="row gap-1">
                  <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={() => { setEditing(r); setShowForm(true); }}/>
                  <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluir(r)}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.RFQPage = RFQPage;
