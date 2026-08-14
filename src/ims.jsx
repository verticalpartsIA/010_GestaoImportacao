/* ============================================================
   ims.jsx — Gestão Importação · IMS (recursos operacionais)
   Fase 3 da consolidação de importação dentro do VP Gestão. Controla
   solicitações de Transporte/Munck/Empilhadeira/Andaime/Mão de obra
   por projeto, com cotação de fornecedores e acompanhamento de execução.
   ============================================================ */

const IMS_STATUS = ['Solicitado', 'Em análise', 'Aprovado', 'Agendado', 'Em execução', 'Finalizado', 'Atrasado', 'Cancelado'];
const IMS_TIPOS_RECURSO = ['Transporte', 'Munck', 'Empilhadeira', 'Andaime', 'Mão de obra', 'Outros Equipamentos'];
const IMS_FORN_STATUS = ['Cotado', 'Aprovado', 'Em execução', 'Finalizado'];

function imsFmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
function imsFmtMoeda(v) { return (v == null || v === '' || isNaN(v)) ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ---------- Campos técnicos por tipo de recurso ---------- */
function IMSCamposTecnicos({ recurso, update }) {
  switch (recurso.tipo_recurso) {
    case 'Munck':
      return (
        <div className="grid-3" style={{ gap: 10 }}>
          <PIField label="Peso da carga (kg)"><PIInput type="number" value={recurso.peso_carga_kg} onChange={(v) => update('peso_carga_kg', v)}/></PIField>
          <PIField label="Altura de içamento (m)"><PIInput type="number" value={recurso.altura_icamento_m} onChange={(v) => update('altura_icamento_m', v)}/></PIField>
          <PIField label="Raio de operação (m)"><PIInput type="number" value={recurso.raio_operacao_m} onChange={(v) => update('raio_operacao_m', v)}/></PIField>
        </div>
      );
    case 'Empilhadeira':
      return (
        <div className="grid-3" style={{ gap: 10 }}>
          <PIField label="Capacidade (ton)"><PIInput type="number" value={recurso.capacidade_ton} onChange={(v) => update('capacidade_ton', v)}/></PIField>
          <PIField label="Altura de elevação (m)"><PIInput type="number" value={recurso.altura_elevacao_m} onChange={(v) => update('altura_elevacao_m', v)}/></PIField>
          <PIField label="Tipo de piso"><PISelect value={recurso.tipo_piso} onChange={(v) => update('tipo_piso', v)} options={['Concreto', 'Terra', 'Irregular']}/></PIField>
        </div>
      );
    case 'Andaime':
      return (
        <div className="grid-3" style={{ gap: 10, alignItems: 'end' }}>
          <PIField label="Altura total (m)"><PIInput type="number" value={recurso.altura_total_m} onChange={(v) => update('altura_total_m', v)}/></PIField>
          <PIField label="Tipo de andaime"><PISelect value={recurso.tipo_andaime} onChange={(v) => update('tipo_andaime', v)} options={['Fachadeiro', 'Tubular', 'Multidirecional']}/></PIField>
          <label className="row gap-2" style={{ cursor: 'pointer', paddingBottom: 8 }}>
            <input type="checkbox" checked={!!recurso.necessita_art} onChange={(e) => update('necessita_art', e.target.checked)}/>
            <span className="small">Necessita ART?</span>
          </label>
        </div>
      );
    case 'Transporte':
      return (
        <div className="stack" style={{ gap: 10 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <PIField label="Tipo de carga"><PIInput value={recurso.tipo_carga} onChange={(v) => update('tipo_carga', v)}/></PIField>
            <PIField label="Peso aproximado"><PIInput value={recurso.peso_aproximado} onChange={(v) => update('peso_aproximado', v)}/></PIField>
          </div>
          <label className="row gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!recurso.necessita_escolta} onChange={(e) => update('necessita_escolta', e.target.checked)}/>
            <span className="small">Necessita escolta?</span>
          </label>
        </div>
      );
    default:
      return null;
  }
}

/* ---------- Formulário completo ---------- */
const IMS_EMPTY = {
  numero_solicitacao: '', status: 'Solicitado', solicitante: '', projeto: '', responsavel_interno: '',
  recursos: [], data_inicio: '', data_fim: '', local_execucao: '', cidade: '', observacoes_operacionais: '',
  fornecedores: [], numero_pedido_compra: '', aprovado: false, aprovador: '', data_aprovacao: '', observacao_aprovacao: '',
  checkin_execucao: '', checkout_execucao: '', servico_concluido: false, avaliacao_servico: '', observacoes_finais: '',
  arquivado: false, historico: [],
};

function IMSForm({ initialData, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...IMS_EMPTY, ...initialData } : { ...IMS_EMPTY, solicitante: (window.__VP_USER || {}).nome || '' }));
  const [tab, setTab] = React.useState('identificacao');
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));

  const addRecurso = () => setForm((f) => ({ ...f, recursos: [...(f.recursos || []), { tipo_recurso: '', especificacoes: '' }] }));
  const removeRecurso = (i) => setForm((f) => ({ ...f, recursos: f.recursos.filter((_, idx) => idx !== i) }));
  const updateRecurso = (i, field, v) => setForm((f) => { const r = [...f.recursos]; r[i] = { ...r[i], [field]: v }; return { ...f, recursos: r }; });

  const addFornecedor = () => setForm((f) => ({ ...f, fornecedores: [...(f.fornecedores || []), { nome: '', valor: '', status: 'Cotado', observacao: '' }] }));
  const removeFornecedor = (i) => setForm((f) => ({ ...f, fornecedores: f.fornecedores.filter((_, idx) => idx !== i) }));
  const updateFornecedor = (i, field, v) => setForm((f) => { const arr = [...f.fornecedores]; arr[i] = { ...arr[i], [field]: v }; return { ...f, fornecedores: arr }; });

  const valorTotal = (form.fornecedores || []).reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

  const submit = () => {
    if (!form.solicitante.trim()) return window.toast?.('Informe o solicitante.', 'warning');
    if (!form.projeto.trim()) return window.toast?.('Informe o projeto.', 'warning');
    onSubmit(form);
  };

  return (
    <Card title={isEdit ? 'Editar solicitação' : 'Nova solicitação'}>
      <Tabs tabs={[
        { key: 'identificacao', label: 'Identificação', icon: 'fileText' },
        { key: 'planejamento', label: 'Planejamento', icon: 'calendar' },
        { key: 'tecnico', label: 'Técnico', icon: 'ruler' },
        { key: 'fornecedor', label: 'Fornecedor', icon: 'globe' },
        { key: 'execucao', label: 'Execução', icon: 'check' },
      ]} active={tab} onChange={setTab}/>

      {tab === 'identificacao' && (
        <div className="stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <PIField label="Nº embarque (opcional)"><PIInput value={form.numero_solicitacao} onChange={set('numero_solicitacao')}/></PIField>
            <PIField label="Status"><PISelect value={form.status} onChange={set('status')} options={IMS_STATUS}/></PIField>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <PIField label="Solicitante *"><PIInput value={form.solicitante} onChange={set('solicitante')}/></PIField>
            <PIField label="Projeto *"><PIInput value={form.projeto} onChange={set('projeto')}/></PIField>
          </div>
          <PIField label="Responsável interno"><PIInput value={form.responsavel_interno} onChange={set('responsavel_interno')}/></PIField>
        </div>
      )}

      {tab === 'planejamento' && (
        <div className="stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <PIField label="Data início *"><PIInput type="date" value={form.data_inicio} onChange={set('data_inicio')}/></PIField>
            <PIField label="Data fim *"><PIInput type="date" value={form.data_fim} onChange={set('data_fim')}/></PIField>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <PIField label="Local da execução"><PIInput value={form.local_execucao} onChange={set('local_execucao')}/></PIField>
            <PIField label="Cidade"><PIInput value={form.cidade} onChange={set('cidade')}/></PIField>
          </div>
          <div>
            <label className="up-eyebrow muted">Observações operacionais</label>
            <textarea className="input" rows={3} value={form.observacoes_operacionais} onChange={(e) => set('observacoes_operacionais')(e.target.value)}/>
          </div>
        </div>
      )}

      {tab === 'tecnico' && (
        <div style={{ marginTop: 14 }}>
          <div className="row sb" style={{ marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recursos operacionais</h4>
            <Button variant="outline" size="sm" icon="plus" onClick={addRecurso}>Adicionar recurso</Button>
          </div>
          {(!form.recursos || form.recursos.length === 0) ? (
            <p className="small muted" style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border)', borderRadius: 6 }}>
              Nenhum recurso adicionado. Inclua transportes, muncks, empilhadeiras, andaimes ou mão de obra.
            </p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {form.recursos.map((r, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                  <div className="row sb" style={{ marginBottom: 8 }}>
                    <span className="badge">Recurso {i + 1}</span>
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => removeRecurso(i)}/>
                  </div>
                  <div className="stack" style={{ gap: 10 }}>
                    <PIField label="Tipo de recurso *"><PISelect value={r.tipo_recurso} onChange={(v) => updateRecurso(i, 'tipo_recurso', v)} options={IMS_TIPOS_RECURSO}/></PIField>
                    <div>
                      <label className="up-eyebrow muted">Especificações</label>
                      <textarea className="input" rows={2} value={r.especificacoes || ''} onChange={(e) => updateRecurso(i, 'especificacoes', e.target.value)}/>
                    </div>
                    {r.tipo_recurso && (
                      <div style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 10 }}>
                        <div className="small muted" style={{ marginBottom: 8, fontWeight: 700 }}>Dados técnicos — {r.tipo_recurso}</div>
                        <IMSCamposTecnicos recurso={r} update={(field, v) => updateRecurso(i, field, v)}/>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'fornecedor' && (
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <div className="row sb">
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Fornecedores cotados</h4>
            <Button variant="outline" size="sm" icon="plus" onClick={addFornecedor}>Adicionar fornecedor</Button>
          </div>
          {(!form.fornecedores || form.fornecedores.length === 0) ? (
            <p className="small muted" style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border)', borderRadius: 6 }}>Nenhum fornecedor adicionado.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {form.fornecedores.map((f, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                  <div className="row sb" style={{ marginBottom: 8 }}>
                    <span className="badge">Fornecedor {i + 1}</span>
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => removeFornecedor(i)}/>
                  </div>
                  <div className="grid-3" style={{ gap: 10 }}>
                    <PIField label="Nome">
                      <PIInput value={f.nome} onChange={(v) => updateFornecedor(i, 'nome', v)} list="dl-fornecedores-ims"/>
                      <CadFornecedorDatalist id="dl-fornecedores-ims"/>
                    </PIField>
                    <PIField label="Status"><PISelect value={f.status} onChange={(v) => updateFornecedor(i, 'status', v)} options={IMS_FORN_STATUS}/></PIField>
                    <PIField label="Valor (R$)"><PIInput type="number" step="0.01" value={f.valor} onChange={(v) => updateFornecedor(i, 'valor', v)}/></PIField>
                    <PIField label="Observações" span={3}><PIInput value={f.observacao} onChange={(v) => updateFornecedor(i, 'observacao', v)}/></PIField>
                  </div>
                </div>
              ))}
            </div>
          )}
          {valorTotal > 0 && (
            <div style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 12 }}>
              <div className="small muted">Valor total previsto</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--vp-success, #0a7)' }}>{imsFmtMoeda(valorTotal)}</div>
            </div>
          )}
          <PIField label="Nº pedido de compra"><PIInput value={form.numero_pedido_compra} onChange={set('numero_pedido_compra')}/></PIField>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Aprovação</h4>
            <div className="grid-2" style={{ gap: 12 }}>
              <PIField label="Aprovador"><PIInput value={form.aprovador} onChange={set('aprovador')}/></PIField>
              <PIField label="Data da aprovação"><PIInput type="date" value={form.data_aprovacao} onChange={set('data_aprovacao')}/></PIField>
            </div>
            <label className="row gap-2" style={{ cursor: 'pointer', marginTop: 10 }}>
              <input type="checkbox" checked={!!form.aprovado} onChange={(e) => set('aprovado')(e.target.checked)}/>
              <span className="small">Aprovado?</span>
            </label>
            <div style={{ marginTop: 10 }}>
              <label className="up-eyebrow muted">Observação da aprovação</label>
              <textarea className="input" rows={2} value={form.observacao_aprovacao} onChange={(e) => set('observacao_aprovacao')(e.target.value)}/>
            </div>
          </div>
        </div>
      )}

      {tab === 'execucao' && (
        <div className="stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <PIField label="Check-in execução"><PIInput type="datetime-local" value={form.checkin_execucao} onChange={set('checkin_execucao')}/></PIField>
            <PIField label="Check-out execução"><PIInput type="datetime-local" value={form.checkout_execucao} onChange={set('checkout_execucao')}/></PIField>
          </div>
          <label className="row gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.servico_concluido} onChange={(e) => set('servico_concluido')(e.target.checked)}/>
            <span className="small">Serviço concluído?</span>
          </label>
          <PIField label="Avaliação do serviço (1 a 5)">
            <PISelect value={form.avaliacao_servico ? String(form.avaliacao_servico) : ''} onChange={(v) => set('avaliacao_servico')(v ? Number(v) : '')}
              options={['1', '2', '3', '4', '5']}/>
          </PIField>
          <div>
            <label className="up-eyebrow muted">Observações finais</label>
            <textarea className="input" rows={3} value={form.observacoes_finais} onChange={(e) => set('observacoes_finais')(e.target.value)}/>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Atualizar solicitação' : 'Criar solicitação')}</Button>
      </div>
    </Card>
  );
}

/* ---------- Card da lista ---------- */
function IMSCard({ s, onEdit, onDelete, onArchive }) {
  const [expanded, setExpanded] = React.useState(false);
  const periodo = window.IMSStore.diasEntre(s.data_inicio, s.data_fim);
  const atrasado = window.IMSStore.estaAtrasado(s);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
      <div className="row sb" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 800 }}>{s.numero_solicitacao || s.projeto || 'Solicitação'}</span>
            <StatusBadge status={s.status}/>
            {(s.recursos || []).map((r, i) => r.tipo_recurso && <span key={i} className="badge">{r.tipo_recurso}</span>)}
            {s.arquivado && <span className="badge">Arquivado</span>}
            {atrasado && s.status !== 'Finalizado' && <span className="badge" style={{ color: 'var(--vp-danger, #c00)' }}>⚠ Atrasado</span>}
            {s.aprovado && <span className="badge" style={{ color: 'var(--vp-success, #0a7)' }}>✓ Aprovado</span>}
          </div>
          <div className="cell-sub mono">
            Projeto: {s.projeto || '—'} · Solicitante: {s.solicitante || '—'} · Período: {imsFmtDate(s.data_inicio)} a {imsFmtDate(s.data_fim)}{periodo ? ` (${periodo}d)` : ''}
          </div>
          {(s.local_execucao || s.cidade) && <div className="cell-sub">{s.local_execucao}{s.cidade ? ` — ${s.cidade}` : ''}</div>}
          {s.valor_total_previsto > 0 && <div className="small" style={{ marginTop: 4, color: 'var(--vp-success, #0a7)', fontWeight: 700 }}>Valor total: {imsFmtMoeda(s.valor_total_previsto)}</div>}
        </div>
        <div className="row gap-1">
          <Button variant="outline" size="sm" onClick={() => setExpanded((e) => !e)}>{expanded ? '▲' : '▼'}</Button>
          <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={onEdit}/>
          {s.status === 'Finalizado' && <Button variant="ghost" size="sm" icon="archive" title={s.arquivado ? 'Desarquivar' : 'Arquivar'} onClick={() => onArchive(!s.arquivado)}/>}
          <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={onDelete}/>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }} className="stack">
          {(s.recursos || []).length > 0 && (
            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Recursos ({s.recursos.length})</div>
              <div className="stack" style={{ gap: 6 }}>
                {s.recursos.map((r, i) => (
                  <div key={i} style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 8 }}>
                    <span className="badge">{r.tipo_recurso}</span>
                    {r.especificacoes && <div className="small" style={{ marginTop: 4 }}>{r.especificacoes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(s.fornecedores || []).length > 0 && (
            <div>
              <div className="small" style={{ fontWeight: 700, margin: '10px 0 6px' }}>Fornecedores ({s.fornecedores.length})</div>
              <div className="stack" style={{ gap: 6 }}>
                {s.fornecedores.map((f, i) => (
                  <div key={i} className="row sb" style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 8 }}>
                    <span className="small">{f.nome || `Fornecedor ${i + 1}`}</span>
                    <span className="small"><StatusBadge status={f.status}/> {imsFmtMoeda(f.valor)}</span>
                  </div>
                ))}
              </div>
              {s.numero_pedido_compra && <div className="small muted" style={{ marginTop: 6 }}>PC: {s.numero_pedido_compra}</div>}
            </div>
          )}
          {(s.checkin_execucao || s.checkout_execucao || s.avaliacao_servico) && (
            <div className="small muted" style={{ marginTop: 10 }}>
              {s.checkin_execucao ? `Check-in: ${new Date(s.checkin_execucao).toLocaleString('pt-BR')} · ` : ''}
              {s.checkout_execucao ? `Check-out: ${new Date(s.checkout_execucao).toLocaleString('pt-BR')} · ` : ''}
              {s.avaliacao_servico ? `Avaliação: ${s.avaliacao_servico}/5` : ''}
            </div>
          )}
          {s.observacoes_finais && <div className="small" style={{ marginTop: 6 }}><b>Observações finais:</b> {s.observacoes_finais}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Página ---------- */
function IMSPage() {
  const [items, setItems] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('Todos');
  const [filterTipo, setFilterTipo] = React.useState('Todos');
  const [showArchived, setShowArchived] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('todos');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => { window.IMSStore.listarTodas().then(setItems).catch(() => setItems([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      if (editing) await window.IMSStore.atualizar(editing.id, form, editing);
      else await window.IMSStore.criar(form);
      window.toast?.(editing ? 'Solicitação atualizada.' : 'Solicitação criada.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a solicitação "${s.numero_solicitacao || s.projeto}"? Esta ação não pode ser desfeita.`)) return;
    try { await window.IMSStore.remover(s.id); window.toast?.('Solicitação excluída.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const arquivar = async (s, arquivado) => {
    try { await window.IMSStore.arquivar(s.id, arquivado); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

  const filtered = items.filter((s) => {
    if (!showArchived && s.arquivado) return false;
    const q = search.toLowerCase();
    const matchSearch = !q || (s.numero_solicitacao || '').toLowerCase().includes(q) || (s.projeto || '').toLowerCase().includes(q) || (s.solicitante || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Todos' || s.status === filterStatus;
    const matchTipo = filterTipo === 'Todos' || (s.recursos || []).some((r) => r.tipo_recurso === filterTipo);
    if (!matchSearch || !matchStatus || !matchTipo) return false;
    if (activeTab === 'em-execucao') return s.status === 'Em execução';
    if (activeTab === 'pendentes') return s.aprovado === false;
    if (activeTab === 'atrasados') return s.status === 'Atrasado' || window.IMSStore.estaAtrasado(s);
    if (activeTab === 'encerrados') return s.status === 'Finalizado' && s.checkout_execucao && new Date(s.checkout_execucao) >= inicioMes && new Date(s.checkout_execucao) <= fimMes;
    return true;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">IMS</h1>
          <p className="page-head__sub">Controle de recursos operacionais e transportes por projeto.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setShowForm(true); }}>Nova solicitação</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <IMSForm initialData={editing} isEdit={!!editing} saving={saving}
            onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <Tabs tabs={[
        { key: 'todos', label: 'Todos' }, { key: 'em-execucao', label: 'Em execução' },
        { key: 'pendentes', label: 'Pendentes' }, { key: 'atrasados', label: 'Atrasados' },
        { key: 'encerrados', label: 'Encerrados (mês)' },
      ]} active={activeTab} onChange={setActiveTab}/>

      <div className="row gap-2" style={{ margin: '14px 0', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por nº, projeto ou solicitante…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {IMS_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" style={{ width: 170 }} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="Todos">Todos os tipos</option>
          {IMS_TIPOS_RECURSO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button variant={showArchived ? 'primary' : 'outline'} size="sm" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}</Button>
      </div>

      <div className="small muted" style={{ marginBottom: 10 }}>{filtered.length} solicitação(ões) encontrada(s)</div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>Nenhuma solicitação encontrada.</div>
      )}

      <div className="stack" style={{ gap: 10 }}>
        {filtered.map((s) => (
          <IMSCard key={s.id} s={s} onEdit={() => { setEditing(s); setShowForm(true); }} onDelete={() => excluir(s)} onArchive={(v) => arquivar(s, v)}/>
        ))}
      </div>
    </div>
  );
}

window.IMSPage = IMSPage;
