/* ============================================================
   pi.jsx — Gestão Importação · Proforma Invoice (P.I.)
   Fase 1 da consolidação de importação dentro do VP Gestão. Uma P.I. pode
   ser vinculada a um Embarque (opcional) — o mesmo "Embarques" que já
   existe hoje na Importação.
   ============================================================ */

const PI_STATUS = ['Em andamento', 'Concluída', 'Aguardando documentos', 'Cancelada'];
const PI_INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const PI_MOEDAS = ['USD', 'EUR', 'BRL', 'CNY', 'GBP'];
const PI_UNIDADES = ['un', 'kg', 'g', 'ton', 'm', 'm²', 'm³', 'L', 'mL', 'cx', 'pct', 'par', 'cj'];
const PI_STATUS_PRODUCAO = ['Não iniciada', 'Em produção', 'Concluída', 'Atrasada'];

function fmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
function fmtNum(v) { return (v == null || v === '') ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function embarqueLabel(e) { return e ? (e.nome_embarque || e.referencia_embarque || e.awb_bl || 'Embarque ' + e.id) : ''; }

function PIField({ label, children, span }) {
  return (
    <div className="stack" style={{ gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label className="up-eyebrow muted">{label}</label>
      {children}
    </div>
  );
}
function PIInput({ value, onChange, type = 'text', placeholder, step }) {
  return <input className="input" type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>;
}
function PISelect({ value, onChange, options, placeholder }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || '—'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ---------- Multi-valor (Nºs de série / Categorias) ---------- */
function PIMultiText({ label, values, onChange, placeholder }) {
  const list = values && values.length ? values : [''];
  const update = (i, v) => onChange(list.map((x, idx) => (idx === i ? v : x)));
  const add = () => onChange([...list, '']);
  const remove = (i) => { const next = list.filter((_, idx) => idx !== i); onChange(next.length ? next : ['']); };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="up-eyebrow muted">{label}</label>
      {list.map((v, i) => (
        <div key={i} className="row gap-2">
          <input className="input" style={{ flex: 1 }} value={v || ''} onChange={(e) => update(i, e.target.value)} placeholder={placeholder}/>
          <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(i)}/>
        </div>
      ))}
      <Button variant="outline" size="sm" icon="plus" onClick={add}>Adicionar {label}</Button>
    </div>
  );
}

/* ---------- Itens da P.I. ---------- */
function PIItensSection({ itens, onChange, moeda }) {
  const store = window.PIStore;
  const add = () => onChange([...(itens || []), { descricao_produto: '', codigo_produto: '', quantidade: '', unidade_medida: 'un', ncm: '', valor_unitario: '' }]);
  const remove = (i) => onChange(itens.filter((_, idx) => idx !== i));
  const update = (i, field, v) => onChange(itens.map((it, idx) => (idx === i ? { ...it, [field]: v } : it)));
  const total = store.calcTotalGeral(itens);

  return (
    <Card title="Itens da P.I." sub="Adicione quantos itens forem necessários — o valor total é calculado automaticamente.">
      {(!itens || itens.length === 0) ? (
        <p className="small muted" style={{ textAlign: 'center', padding: '24px 0' }}>Nenhum item adicionado.</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {itens.map((item, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
              <div className="row sb" style={{ marginBottom: 8 }}>
                <span className="small muted">Item {i + 1}</span>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(i)}/>
              </div>
              <div className="grid-3" style={{ gap: 10 }}>
                <PIField label="Descrição do produto *" span={2}><PIInput value={item.descricao_produto} onChange={(v) => update(i, 'descricao_produto', v)}/></PIField>
                <PIField label="Código"><PIInput value={item.codigo_produto} onChange={(v) => update(i, 'codigo_produto', v)}/></PIField>
                <PIField label="Quantidade *"><PIInput type="number" step="0.01" value={item.quantidade} onChange={(v) => update(i, 'quantidade', v)}/></PIField>
                <PIField label="Unidade"><PISelect value={item.unidade_medida} onChange={(v) => update(i, 'unidade_medida', v)} options={PI_UNIDADES}/></PIField>
                <PIField label="NCM"><PIInput value={item.ncm} onChange={(v) => update(i, 'ncm', v)}/></PIField>
                <PIField label="Valor unitário *"><PIInput type="number" step="0.01" value={item.valor_unitario} onChange={(v) => update(i, 'valor_unitario', v)}/></PIField>
              </div>
              <div style={{ textAlign: 'right', marginTop: 6, fontSize: 12 }}>
                <span className="muted">Total do item: </span><b>{store.fmtMoeda(store.calcItemTotal(item), moeda)}</b>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 10 }} onClick={add}>Adicionar item</Button>
      <div className="row sb" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span/>
        <div style={{ textAlign: 'right' }}>
          <div className="small muted">Valor total da P.I.</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{store.fmtMoeda(total, moeda)}</div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Pagamentos adicionais ---------- */
function PIPagamentosAdicionais({ pagamentos, onChange }) {
  const add = () => onChange([...(pagamentos || []), { data: '', valor: '', cotacao_dolar: '' }]);
  const remove = (i) => onChange(pagamentos.filter((_, idx) => idx !== i));
  const update = (i, field, v) => onChange(pagamentos.map((p, idx) => (idx === i ? { ...p, [field]: v } : p)));
  return (
    <Card title="Pagamentos adicionais" sub="Além do 1º e 2º pagamento.">
      {(!pagamentos || pagamentos.length === 0) ? (
        <p className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>Nenhum pagamento adicional.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {pagamentos.map((p, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10 }}>
              <div className="row sb" style={{ marginBottom: 6 }}>
                <span className="small muted">Pagamento {i + 3}º</span>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(i)}/>
              </div>
              <div className="grid-3" style={{ gap: 10 }}>
                <PIField label="Data"><PIInput type="date" value={p.data} onChange={(v) => update(i, 'data', v)}/></PIField>
                <PIField label="Valor"><PIInput type="number" step="0.01" value={p.valor} onChange={(v) => update(i, 'valor', v)}/></PIField>
                <PIField label="Cotação USD (R$)"><PIInput type="number" step="0.0001" placeholder="5.1200" value={p.cotacao_dolar} onChange={(v) => update(i, 'cotacao_dolar', v)}/></PIField>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 10 }} onClick={add}>Adicionar pagamento</Button>
    </Card>
  );
}

/* ---------- Produção ---------- */
function PIProducaoSection({ value, onChange, piId }) {
  const [uploading, setUploading] = React.useState(false);
  const v = value || {};
  const set = (field, val) => onChange({ ...v, [field]: val });

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const novos = [];
      for (const file of files) { try { novos.push(await window.PIStore.uploadAnexoProducao(piId || 'novo', file)); } catch (e) { window.toast?.('Falha no upload: ' + e.message, 'error'); } }
      set('anexos', [...(v.anexos || []), ...novos]);
    } finally { setUploading(false); }
  };
  const removeAnexo = async (i) => {
    const a = (v.anexos || [])[i];
    if (a?.path) await window.PIStore.removerAnexoProducao(a.path);
    set('anexos', (v.anexos || []).filter((_, idx) => idx !== i));
  };

  return (
    <Card title="Produção" sub="Quando a P.I. estiver vinculada a um Embarque, esse status aparece lá também (só leitura).">
      <div className="grid-3" style={{ gap: 10 }}>
        <PIField label="Status da produção"><PISelect value={v.status} onChange={(x) => set('status', x)} options={PI_STATUS_PRODUCAO}/></PIField>
        <PIField label="Data de início"><PIInput type="date" value={v.data_inicio} onChange={(x) => set('data_inicio', x)}/></PIField>
        <PIField label="Previsão de conclusão"><PIInput type="date" value={v.previsao_conclusao} onChange={(x) => set('previsao_conclusao', x)}/></PIField>
        <PIField label="Data de conclusão"><PIInput type="date" value={v.data_conclusao} onChange={(x) => set('data_conclusao', x)}/></PIField>
      </div>
      <label className="row gap-2" style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 6, padding: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!v.cargo_ready} onChange={(e) => set('cargo_ready', e.target.checked)}/>
        <span className="small">Cargo Ready (mercadoria pronta)</span>
      </label>
      <div style={{ marginTop: 12 }}>
        <label className="up-eyebrow muted">Observações da produção</label>
        <textarea className="input" rows={3} value={v.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)}/>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="up-eyebrow muted">Anexos (fotos, relatórios, certificados)</label>
        <div className="stack" style={{ gap: 6, marginTop: 6 }}>
          {(v.anexos || []).map((a, i) => (
            <div key={i} className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--vp-gray-50)' }}>
              <a href={a.url} target="_blank" rel="noreferrer" className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</a>
              <Button variant="ghost" size="sm" icon="trash" onClick={() => removeAnexo(i)}/>
            </div>
          ))}
        </div>
        <label style={{ display: 'inline-block', marginTop: 8 }}>
          <input type="file" multiple style={{ display: 'none' }} disabled={uploading} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}/>
          <span className="btn btn--outline btn--sm">{uploading ? 'Enviando…' : '+ Adicionar anexos'}</span>
        </label>
      </div>
    </Card>
  );
}

/* ---------- Formulário completo (Nova/Editar P.I.) ---------- */
const PI_EMPTY = {
  numero_pi: '', fornecedor: '', incoterms: '', data_solicitacao_pagamento: '', numero_requisicao: '',
  numeros_serie: [], categorias: [], embarque_id: '', data_abertura: '', data_prontidao: '',
  status: 'Em andamento', moeda: 'USD', itens: [],
  data_primeiro_pagamento: '', valor_primeiro_pagamento: '', cotacao_dolar_primeiro_pagamento: '',
  data_segundo_pagamento: '', valor_segundo_pagamento: '', cotacao_dolar_segundo_pagamento: '',
  pagamentos_adicionais: [], producao: {}, observacoes: '',
};

function PIForm({ embarques, initialData, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...PI_EMPTY, ...initialData } : PI_EMPTY));
  const [tab, setTab] = React.useState('id');
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));
  const store = window.PIStore;

  const valorTotalItens = store.calcTotalGeral(form.itens);
  const pago1 = parseFloat(form.valor_primeiro_pagamento) || 0;
  const pago2 = parseFloat(form.valor_segundo_pagamento) || 0;
  const pagoAdicional = store.somaPagamentosAdicionais(form.pagamentos_adicionais);
  const totalPago = pago1 + pago2 + pagoAdicional;
  const percPaga = valorTotalItens > 0 ? (totalPago / valorTotalItens) * 100 : 0;

  const submit = () => {
    if (!form.numero_pi.trim()) return window.toast?.('Informe o número da P.I.', 'warning');
    onSubmit(form);
  };

  return (
    <Card title={isEdit ? 'Editar P.I.' : 'Nova P.I.'}>
      <Tabs tabs={[
        { key: 'id', label: 'Identificação', icon: 'fileText' },
        { key: 'produtos', label: 'Produtos', icon: 'package' },
        { key: 'pagamento', label: 'Pagamento', icon: 'dollar' },
        { key: 'producao', label: 'Produção', icon: 'factory' },
      ]} active={tab} onChange={setTab}/>

      {tab === 'id' && (
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <div className="grid-3" style={{ gap: 12 }}>
            <PIField label="Número da P.I. *"><PIInput value={form.numero_pi} onChange={set('numero_pi')}/></PIField>
            <PIField label="Data de abertura *"><PIInput type="date" value={form.data_abertura} onChange={set('data_abertura')}/></PIField>
            <PIField label="Status"><PISelect value={form.status} onChange={set('status')} options={PI_STATUS}/></PIField>
            <PIField label="Data de prontidão do pedido"><PIInput type="date" value={form.data_prontidao} onChange={set('data_prontidao')}/></PIField>
            <PIField label="Moeda"><PISelect value={form.moeda} onChange={set('moeda')} options={PI_MOEDAS}/></PIField>
            <PIField label="Vincular ao embarque" span={3}>
              <select className="input" value={form.embarque_id || ''} onChange={(e) => set('embarque_id')(e.target.value)}>
                <option value="">Nenhum</option>
                {embarques.map((e) => <option key={e.id} value={e.id}>{embarqueLabel(e)}</option>)}
              </select>
            </PIField>
          </div>

          <div className="grid-2" style={{ gap: 12, border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: 'var(--vp-gray-50)', marginTop: 10 }}>
            <PIField label="Fornecedor"><PIInput value={form.fornecedor} onChange={set('fornecedor')} placeholder="Razão social do fornecedor"/></PIField>
            <PIField label="Incoterms"><PISelect value={form.incoterms} onChange={set('incoterms')} options={PI_INCOTERMS}/></PIField>
            <PIField label="Data da solicitação de pagamento"><PIInput type="date" value={form.data_solicitacao_pagamento} onChange={set('data_solicitacao_pagamento')}/></PIField>
            <PIField label="Nº da requisição"><PIInput value={form.numero_requisicao} onChange={set('numero_requisicao')}/></PIField>
            <PIMultiText label="Nºs de série" values={form.numeros_serie} onChange={set('numeros_serie')} placeholder="Nº de série do equipamento"/>
            <PIMultiText label="Categorias" values={form.categorias} onChange={set('categorias')} placeholder="Categoria do equipamento"/>
          </div>
        </div>
      )}

      {tab === 'produtos' && <div style={{ marginTop: 14 }}><PIItensSection itens={form.itens} onChange={set('itens')} moeda={form.moeda}/></div>}

      {tab === 'pagamento' && (
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <Card title="1º Pagamento">
            <div className="grid-3" style={{ gap: 10 }}>
              <PIField label="Data"><PIInput type="date" value={form.data_primeiro_pagamento} onChange={set('data_primeiro_pagamento')}/></PIField>
              <PIField label="Valor"><PIInput type="number" step="0.01" value={form.valor_primeiro_pagamento} onChange={set('valor_primeiro_pagamento')}/></PIField>
              <PIField label="Cotação USD (R$)"><PIInput type="number" step="0.0001" placeholder="5.1200" value={form.cotacao_dolar_primeiro_pagamento} onChange={set('cotacao_dolar_primeiro_pagamento')}/></PIField>
            </div>
          </Card>
          <Card title="2º Pagamento">
            <div className="grid-3" style={{ gap: 10 }}>
              <PIField label="Data"><PIInput type="date" value={form.data_segundo_pagamento} onChange={set('data_segundo_pagamento')}/></PIField>
              <PIField label="Valor"><PIInput type="number" step="0.01" value={form.valor_segundo_pagamento} onChange={set('valor_segundo_pagamento')}/></PIField>
              <PIField label="Cotação USD (R$)"><PIInput type="number" step="0.0001" placeholder="5.1200" value={form.cotacao_dolar_segundo_pagamento} onChange={set('cotacao_dolar_segundo_pagamento')}/></PIField>
            </div>
          </Card>
          <PIPagamentosAdicionais pagamentos={form.pagamentos_adicionais} onChange={set('pagamentos_adicionais')}/>
          <div className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <div className="small">
              <span className="muted">Total pago: </span><b>{store.fmtMoeda(totalPago, form.moeda)}</b>
              <span className="muted" style={{ margin: '0 8px' }}>·</span>
              <span className="muted">Total da P.I.: </span><b>{store.fmtMoeda(valorTotalItens, form.moeda)}</b>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">% paga</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: percPaga >= 100 ? 'var(--vp-success)' : percPaga > 0 ? 'var(--vp-warning-ink)' : undefined }}>{percPaga.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'producao' && <div style={{ marginTop: 14 }}><PIProducaoSection value={form.producao} onChange={set('producao')} piId={initialData?.id}/></div>}

      <div style={{ marginTop: 16 }}>
        <label className="up-eyebrow muted">Observações gerais</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes')(e.target.value)}/>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Salvar P.I.')}</Button>
      </div>
    </Card>
  );
}

/* ---------- Vincular embarque (modal rápido, fora do form) ---------- */
function PIModalVincularEmbarque({ pi, embarques, onClose, onSaved }) {
  const [selected, setSelected] = React.useState(pi.embarque_id || '');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    setSaving(true);
    try { await window.PIStore.vincularEmbarque(pi.id, selected || null); window.toast?.('Vínculo salvo.', 'success'); onSaved(); onClose(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Vincular P.I. ${pi.numero_pi} a Embarque`} onClose={onClose} width={440}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar vínculo'}</Button></>}>
      <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">Nenhum (desvincular)</option>
        {embarques.map((e) => <option key={e.id} value={e.id}>{embarqueLabel(e)}</option>)}
      </select>
    </Modal>
  );
}

/* ---------- Página ---------- */
function PIPage() {
  const [pis, setPis] = React.useState(null);
  const [embarques, setEmbarques] = React.useState([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [vincular, setVincular] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('Todos');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => {
    window.PIStore.listarTodas().then(setPis).catch(() => setPis([]));
    window.__VP_SB?.sb?.from('embarques_importacao').select('id, nome_embarque, referencia_embarque, awb_bl').order('created_at', { ascending: false }).then(({ data }) => setEmbarques(data || []));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const embarquesMap = React.useMemo(() => Object.fromEntries(embarques.map((e) => [e.id, e])), [embarques]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      if (editing) await window.PIStore.atualizar(editing.id, form);
      else await window.PIStore.criar(form);
      window.toast?.(editing ? 'P.I. atualizada.' : 'P.I. criada.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (pi) => {
    if (!window.confirm(`Excluir a P.I. ${pi.numero_pi}? Esta ação não pode ser desfeita.`)) return;
    try { await window.PIStore.remover(pi.id); window.toast?.('P.I. excluída.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (pis === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = pis.filter((pi) => {
    const s = search.toLowerCase();
    const embLabel = embarqueLabel(embarquesMap[pi.embarque_id]).toLowerCase();
    const matchSearch = !s || (pi.numero_pi || '').toLowerCase().includes(s) || (pi.fornecedor || '').toLowerCase().includes(s) || embLabel.includes(s);
    const matchStatus = filterStatus === 'Todos' || pi.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">Proforma Invoices (P.I.)</h1>
          <p className="page-head__sub">Gerencie todas as P.I. e vincule-as aos embarques.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setShowForm(true); }}>Nova P.I.</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <PIForm embarques={embarques} initialData={editing} isEdit={!!editing} saving={saving}
            onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <div className="row gap-2" style={{ marginBottom: 14 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Buscar por nº PI, fornecedor ou embarque…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 220 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {PI_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Nº P.I.</th><th>Fornecedor</th><th>Abertura</th><th>Status</th><th>Produção</th>
            <th>Valor total</th><th>Itens</th><th>% paga</th><th>Embarque</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma P.I. encontrada.</td></tr>
            )}
            {filtered.map((pi) => {
              const embarque = embarquesMap[pi.embarque_id];
              const itens = pi.itens || [];
              const pagoAdicional = (pi.pagamentos_adicionais || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
              const totalPago = (Number(pi.valor_primeiro_pagamento) || 0) + (Number(pi.valor_segundo_pagamento) || 0) + pagoAdicional;
              const percPaga = pi.valor_total ? (totalPago / pi.valor_total) * 100 : 0;
              const prod = pi.producao || {};
              return (
                <tr key={pi.id}>
                  <td className="mono">{pi.numero_pi}</td>
                  <td>{pi.fornecedor || '—'}</td>
                  <td>{fmtDate(pi.data_abertura)}</td>
                  <td><StatusBadge status={pi.status}/></td>
                  <td>{prod.status ? <StatusBadge status={prod.status}/> : <span className="muted small">—</span>}</td>
                  <td className="cell-money">{pi.valor_total ? window.PIStore.fmtMoeda(pi.valor_total, pi.moeda) : '—'}</td>
                  <td>{itens.length}</td>
                  <td>{fmtNum(percPaga)}%</td>
                  <td>{embarque ? <span className="small">{embarqueLabel(embarque)}</span> : <span className="muted small">Não vinculada</span>}</td>
                  <td>
                    <div className="row gap-1">
                      <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={() => { setEditing(pi); setShowForm(true); }}/>
                      <Button variant="ghost" size="sm" icon="link" title="Vincular embarque" onClick={() => setVincular(pi)}/>
                      <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluir(pi)}/>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vincular && <PIModalVincularEmbarque pi={vincular} embarques={embarques} onClose={() => setVincular(null)} onSaved={reload}/>}
    </div>
  );
}

window.PIPage = PIPage;
