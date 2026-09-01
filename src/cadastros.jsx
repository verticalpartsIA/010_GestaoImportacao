/* ============================================================
   cadastros.jsx — Cadastros · Clientes & Fornecedores
   Módulo transversal (Comercial, Importação, Engenharia usam os mesmos
   cadastros). Produtos não tem tela própria aqui — é o Catálogo de
   Produtos já existente, só realocado no menu.
   ============================================================ */

const CAD_UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function cadFmtDoc(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v;
}

/* ---------- Bloco de endereço reutilizado por Clientes e Fornecedores ---------- */
function CadEnderecoFields({ form, set }) {
  return (
    <div className="grid-3" style={{ gap: 10 }}>
      <PIField label="Logradouro" span={2}><PIInput value={form.endereco_logradouro} onChange={set('endereco_logradouro')}/></PIField>
      <PIField label="Complemento"><PIInput value={form.endereco_complemento} onChange={set('endereco_complemento')}/></PIField>
      <PIField label="Bairro"><PIInput value={form.endereco_bairro} onChange={set('endereco_bairro')}/></PIField>
      <PIField label="CEP"><PIInput value={form.endereco_cep} onChange={set('endereco_cep')}/></PIField>
      <PIField label="Cidade"><PIInput value={form.endereco_cidade} onChange={set('endereco_cidade')}/></PIField>
      <PIField label="Estado"><PISelect value={form.endereco_estado} onChange={set('endereco_estado')} options={CAD_UFS}/></PIField>
    </div>
  );
}

/* ============================================================
   CLIENTES
   ============================================================ */
const CLI_EMPTY = {
  razao_social: '', nome_fantasia: '', tipo_pessoa: 'PJ', cnpj: '', cpf: '', inscricao_estadual: '',
  contribuinte_icms: false, email: '', telefone: '', contato: '',
  endereco_logradouro: '', endereco_complemento: '', endereco_bairro: '', endereco_cep: '', endereco_cidade: '', endereco_estado: '',
  ativo: true,
};

function ClienteForm({ initialData, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...CLI_EMPTY, ...initialData } : CLI_EMPTY));
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));
  const submit = () => {
    if (!form.razao_social.trim()) return window.toast?.('Informe a razão social / nome.', 'warning');
    onSubmit(form);
  };
  return (
    <Card title={isEdit ? `Editar cliente ${initialData.codigo || ''}` : 'Novo cliente'}>
      <div className="grid-3" style={{ gap: 10 }}>
        <PIField label="Tipo de pessoa"><PISelect value={form.tipo_pessoa} onChange={set('tipo_pessoa')} options={['PJ', 'PF']}/></PIField>
        <PIField label={form.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}><PIInput value={form.tipo_pessoa === 'PF' ? form.cpf : form.cnpj} onChange={set(form.tipo_pessoa === 'PF' ? 'cpf' : 'cnpj')}/></PIField>
        <PIField label="Inscrição estadual"><PIInput value={form.inscricao_estadual} onChange={set('inscricao_estadual')}/></PIField>
        <PIField label="Razão social / Nome *" span={2}><PIInput value={form.razao_social} onChange={set('razao_social')}/></PIField>
        <PIField label="Nome fantasia"><PIInput value={form.nome_fantasia} onChange={set('nome_fantasia')}/></PIField>
        <PIField label="E-mail"><PIInput value={form.email} onChange={set('email')}/></PIField>
        <PIField label="Telefone"><PIInput value={form.telefone} onChange={set('telefone')}/></PIField>
        <PIField label="Contato"><PIInput value={form.contato} onChange={set('contato')}/></PIField>
      </div>
      <label className="row gap-2" style={{ cursor: 'pointer', margin: '10px 0' }}>
        <input type="checkbox" checked={!!form.contribuinte_icms} onChange={(e) => set('contribuinte_icms')(e.target.checked)}/>
        <span className="small">Contribuinte de ICMS</span>
      </label>
      <div style={{ marginTop: 6 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Endereço</h4>
        <CadEnderecoFields form={form} set={set}/>
      </div>
      <label className="row gap-2" style={{ cursor: 'pointer', marginTop: 10 }}>
        <input type="checkbox" checked={form.ativo !== false} onChange={(e) => set('ativo')(e.target.checked)}/>
        <span className="small">Cliente ativo</span>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Cadastrar cliente')}</Button>
      </div>
    </Card>
  );
}

function CadastroClientesPage() {
  const [items, setItems] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [historicoDe, setHistoricoDe] = React.useState(null);

  const reload = React.useCallback(() => { window.CadastrosClientesStore.listarTodos().then(setItems).catch(() => setItems([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      if (editing) await window.CadastrosClientesStore.atualizar(editing.id, form);
      else await window.CadastrosClientesStore.criar(form);
      window.toast?.(editing ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (cli) => {
    if (!window.confirm(`Excluir o cliente "${cli.razao_social}"? Isso pode afetar formulários/propostas já vinculados.`)) return;
    try { await window.CadastrosClientesStore.remover(cli.id); window.toast?.('Cliente excluído.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    return !q || (c.razao_social || '').toLowerCase().includes(q) || (c.nome_fantasia || '').toLowerCase().includes(q)
      || (c.codigo || '').toLowerCase().includes(q) || (c.cnpj || '').includes(q) || (c.cpf || '').includes(q);
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Cadastros</div>
          <h1 className="page-head__title">Clientes</h1>
          <p className="page-head__sub">Cadastro central de clientes — inclui os criados automaticamente pelo Formulário.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setShowForm(true); }}>Novo cliente</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <ClienteForm initialData={editing} isEdit={!!editing} saving={saving} onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <input className="input" style={{ marginBottom: 14 }} placeholder="Buscar por código, nome ou CNPJ/CPF…" value={search} onChange={(e) => setSearch(e.target.value)}/>
      <div className="small muted" style={{ marginBottom: 10 }}>{filtered.length} cliente(s) encontrado(s)</div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Código</th><th>Razão social</th><th>CNPJ/CPF</th><th>Cidade/UF</th><th>Contato</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum cliente encontrado.</td></tr>}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.codigo || '—'}</td>
                <td><div className="cell-main">{c.razao_social}</div>{c.nome_fantasia ? <div className="cell-sub">{c.nome_fantasia}</div> : null}</td>
                <td className="mono">{cadFmtDoc(c.cnpj || c.cpf)}</td>
                <td>{c.endereco_cidade ? `${c.endereco_cidade}/${c.endereco_estado || ''}` : '—'}</td>
                <td>{c.contato || c.telefone || '—'}</td>
                <td>{c.ativo === false ? <span className="badge">Inativo</span> : <StatusBadge status="Ativo"/>}</td>
                <td>
                  <div className="row gap-1">
                    <Button variant="ghost" size="sm" icon="history" title="Histórico" onClick={() => setHistoricoDe(c)}/>
                    <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={() => { setEditing(c); setShowForm(true); }}/>
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluir(c)}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historicoDe && <ClienteHistoricoModal cliente={historicoDe} onClose={() => setHistoricoDe(null)} />}
    </div>
  );
}

/* "Vida do Cliente" — timeline: canal de entrada + vendedor (leads),
   obras/equipamentos/instaladores (dossier_obra.cliente_id, vínculo
   manual — só mostra o que já foi ligado). Score fica pra uma fase
   futura, precisa de regra de negócio ainda não definida. */
function ClienteHistoricoModal({ cliente, onClose }) {
  const [dados, setDados] = React.useState(null);
  React.useEffect(() => {
    window.CadastrosClientesStore.historicoCliente(cliente.id).then(setDados).catch(() => setDados({ leads: [], obras: [], equipamentos: [], roster: [] }));
  }, [cliente.id]);

  const montadoresPorObra = React.useMemo(() => {
    if (!dados) return {};
    const map = {};
    dados.equipamentos.forEach((e) => { if (e.parceiros_instaladores?.nome) (map[e.dossier_id] = map[e.dossier_id] || new Set()).add(e.parceiros_instaladores.nome); });
    dados.roster.forEach((r) => { if (r.parceiros_instaladores?.nome) (map[r.dossier_id] = map[r.dossier_id] || new Set()).add(r.parceiros_instaladores.nome); });
    return map;
  }, [dados]);

  return (
    <Modal title={`Histórico · ${cliente.razao_social}`} onClose={onClose} width={640}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {!dados ? <div style={{ textAlign: 'center', padding: 30, color: 'var(--fg3)' }}>Carregando…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Canal de entrada / Vendedor ({dados.leads.length})</div>
            {dados.leads.length === 0 && <div className="small muted">Nenhum lead vinculado a este cliente ainda.</div>}
            {dados.leads.map((l) => (
              <div key={l.id} style={{ fontSize: 13, marginBottom: 4 }}>
                📅 {l.date || '—'} · <b>{l.origin || 'canal não informado'}</b> · vendedor: {l.owner || '—'} · {l.building}
              </div>
            ))}
          </div>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Obras e equipamentos ({dados.obras.length})</div>
            {dados.obras.length === 0 && <div className="small muted">Nenhuma obra vinculada a este cliente ainda — vincule em Engenharia → Dossiê da Obra → Visão Geral.</div>}
            {dados.obras.map((o) => (
              <div key={o.id} style={{ fontSize: 13, marginBottom: 6, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                <div><b>{o.building_name}</b> — {o.status_master || '—'} <span className="small muted">({o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—'})</span></div>
                {montadoresPorObra[o.id] && <div className="small muted">🏢 {Array.from(montadoresPorObra[o.id]).join(', ')}</div>}
              </div>
            ))}
          </div>
          <div className="small muted">Score de relacionamento: ainda não implementado — depende de definir a regra de negócio (frequência, valor, satisfação?).</div>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   FORNECEDORES
   ============================================================ */
const FOR_EMPTY = {
  razao_social: '', nome_fantasia: '', tipo_pessoa: 'PJ', cnpj: '', cpf: '', categorias: [],
  email: '', telefone: '', contato: '',
  endereco_logradouro: '', endereco_complemento: '', endereco_bairro: '', endereco_cep: '', endereco_cidade: '', endereco_estado: '',
  observacoes: '', ativo: true,
};

/* Arredonda pra BAIXO de propósito: com Math.round, uma média 4,5 virava 5
   estrelas cheias — superestima a nota. O número exato vem ao lado. */
function cadFmtEstrelas(media) {
  if (media == null) return '—';
  const cheias = Math.floor(media);
  return '★'.repeat(cheias) + '☆'.repeat(5 - cheias) + ` (${media.toFixed(1)})`;
}

/* ---------- Avaliações de um fornecedor (só aparece editando) ---------- */
function FornecedorAvaliacoes({ fornecedorId }) {
  const [avaliacoes, setAvaliacoes] = React.useState(null);
  const [nota, setNota] = React.useState(5);
  const [comentario, setComentario] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => {
    window.CadastrosFornecedoresStore.listarAvaliacoes(fornecedorId).then(setAvaliacoes).catch(() => setAvaliacoes([]));
  }, [fornecedorId]);
  React.useEffect(() => { reload(); }, [reload]);

  const enviar = async () => {
    setSaving(true);
    try {
      await window.CadastrosFornecedoresStore.avaliar(fornecedorId, { nota, comentario });
      setComentario(''); setNota(5); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const remover = async (id) => {
    if (!window.confirm('Remover esta avaliação?')) return;
    await window.CadastrosFornecedoresStore.removerAvaliacao(id); reload();
  };

  if (avaliacoes === null) return null;
  const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : null;

  return (
    <Card title="Avaliações" sub={avaliacoes.length ? `Média: ${cadFmtEstrelas(media)} · ${avaliacoes.length} avaliação(ões)` : 'Nenhuma avaliação ainda.'}>
      <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
        <PIField label="Nota">
          <PISelect value={String(nota)} onChange={(v) => setNota(Number(v))} options={['1', '2', '3', '4', '5']}/>
        </PIField>
        <div style={{ flex: 1 }}>
          <label className="up-eyebrow muted">Comentário</label>
          <input className="input" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Opcional"/>
        </div>
        <Button variant="outline" onClick={enviar} disabled={saving}>{saving ? 'Salvando…' : 'Avaliar'}</Button>
      </div>
      {avaliacoes.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          {avaliacoes.map((a) => (
            <div key={a.id} className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
              <div className="small">
                <b>{cadFmtEstrelas(a.nota).split(' ')[0]}</b> {a.comentario && `— ${a.comentario}`}
                <div className="cell-sub">{a.avaliado_por || 'Sistema'} · {new Date(a.avaliado_em).toLocaleDateString('pt-BR')}</div>
              </div>
              <Button variant="ghost" size="sm" icon="trash" onClick={() => remover(a.id)}/>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function FornecedorForm({ initialData, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...FOR_EMPTY, ...initialData } : FOR_EMPTY));
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));
  const toggleCategoria = (cat) => setForm((f) => ({ ...f, categorias: f.categorias.includes(cat) ? f.categorias.filter((x) => x !== cat) : [...f.categorias, cat] }));
  const submit = () => {
    if (!form.razao_social.trim()) return window.toast?.('Informe a razão social / nome.', 'warning');
    if (form.categorias.length === 0) return window.toast?.('Selecione ao menos uma categoria.', 'warning');
    onSubmit(form);
  };
  return (
    <Card title={isEdit ? `Editar fornecedor ${initialData.codigo || ''}` : 'Novo fornecedor'}>
      <div>
        <label className="up-eyebrow muted">Categorias *</label>
        <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {window.CadastrosFornecedoresStore.CATEGORIAS.map((cat) => (
            <label key={cat} className="row gap-2" style={{ cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', background: form.categorias.includes(cat) ? 'var(--vp-yellow, #ffd400)' : '#fff' }}>
              <input type="checkbox" checked={form.categorias.includes(cat)} onChange={() => toggleCategoria(cat)} style={{ display: 'none' }}/>
              <span className="small">{cat}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid-3" style={{ gap: 10, marginTop: 14 }}>
        <PIField label="Tipo de pessoa"><PISelect value={form.tipo_pessoa} onChange={set('tipo_pessoa')} options={['PJ', 'PF']}/></PIField>
        <PIField label={form.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}><PIInput value={form.tipo_pessoa === 'PF' ? form.cpf : form.cnpj} onChange={set(form.tipo_pessoa === 'PF' ? 'cpf' : 'cnpj')}/></PIField>
        <PIField label="Razão social / Nome *"><PIInput value={form.razao_social} onChange={set('razao_social')}/></PIField>
        <PIField label="Nome fantasia"><PIInput value={form.nome_fantasia} onChange={set('nome_fantasia')}/></PIField>
        <PIField label="E-mail"><PIInput value={form.email} onChange={set('email')}/></PIField>
        <PIField label="Telefone"><PIInput value={form.telefone} onChange={set('telefone')}/></PIField>
        <PIField label="Contato"><PIInput value={form.contato} onChange={set('contato')}/></PIField>
      </div>
      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Endereço</h4>
        <CadEnderecoFields form={form} set={set}/>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="up-eyebrow muted">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes ?? ''} onChange={(e) => set('observacoes')(e.target.value)}/>
      </div>
      <label className="row gap-2" style={{ cursor: 'pointer', marginTop: 10 }}>
        <input type="checkbox" checked={form.ativo !== false} onChange={(e) => set('ativo')(e.target.checked)}/>
        <span className="small">Fornecedor ativo</span>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Cadastrar fornecedor')}</Button>
      </div>
      {isEdit && <div style={{ marginTop: 16 }}><FornecedorAvaliacoes fornecedorId={initialData.id}/></div>}
    </Card>
  );
}

function CadastroFornecedoresPage() {
  const [items, setItems] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filterCategoria, setFilterCategoria] = React.useState('Todas');
  const [saving, setSaving] = React.useState(false);

  const [medias, setMedias] = React.useState({});

  const reload = React.useCallback(() => {
    window.CadastrosFornecedoresStore.listarTodos().then(setItems).catch(() => setItems([]));
    window.CadastrosFornecedoresStore.mediasAvaliacoes().then(setMedias).catch(() => setMedias({}));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      if (editing) await window.CadastrosFornecedoresStore.atualizar(editing.id, form);
      else await window.CadastrosFornecedoresStore.criar(form);
      window.toast?.(editing ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (f) => {
    if (!window.confirm(`Excluir o fornecedor "${f.razao_social}"?`)) return;
    try { await window.CadastrosFornecedoresStore.remover(f.id); window.toast?.('Fornecedor excluído.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = items.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (f.razao_social || '').toLowerCase().includes(q) || (f.nome_fantasia || '').toLowerCase().includes(q)
      || (f.codigo || '').toLowerCase().includes(q) || (f.cnpj || '').includes(q);
    const matchCat = filterCategoria === 'Todas' || (f.categorias || []).includes(filterCategoria);
    return matchSearch && matchCat;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Cadastros</div>
          <h1 className="page-head__title">Fornecedores</h1>
          <p className="page-head__sub">Cadastro único — Fornecedor, Agente de Carga, Transportador e Prestador IMS, marcados por categoria.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setShowForm(true); }}>Novo fornecedor</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <FornecedorForm initialData={editing} isEdit={!!editing} saving={saving} onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <div className="row gap-2" style={{ marginBottom: 14 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Buscar por código, nome ou CNPJ…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 200 }} value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
          <option value="Todas">Todas as categorias</option>
          {window.CadastrosFornecedoresStore.CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>{filtered.length} fornecedor(es) encontrado(s)</div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Código</th><th>Razão social</th><th>Categorias</th><th>CNPJ/CPF</th><th>Contato</th><th>Avaliação</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum fornecedor encontrado.</td></tr>}
            {filtered.map((f) => (
              <tr key={f.id}>
                <td className="mono">{f.codigo || '—'}</td>
                <td><div className="cell-main">{f.razao_social}</div>{f.nome_fantasia ? <div className="cell-sub">{f.nome_fantasia}</div> : null}</td>
                <td>{(f.categorias || []).map((c) => <span key={c} className="badge" style={{ marginRight: 4 }}>{c}</span>)}</td>
                <td className="mono">{cadFmtDoc(f.cnpj || f.cpf)}</td>
                <td>{f.contato || f.telefone || '—'}</td>
                <td className="small">{medias[f.id] ? cadFmtEstrelas(medias[f.id].media) : '—'}</td>
                <td>{f.ativo === false ? <span className="badge">Inativo</span> : <StatusBadge status="Ativo"/>}</td>
                <td>
                  <div className="row gap-1">
                    <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={() => { setEditing(f); setShowForm(true); }}/>
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluir(f)}/>
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

window.CadastroClientesPage = CadastroClientesPage;
window.CadastroFornecedoresPage = CadastroFornecedoresPage;
