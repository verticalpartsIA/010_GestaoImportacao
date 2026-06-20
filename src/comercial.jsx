/* ============================================================
   comercial.jsx — Leads, Cotações, Precificação, Propostas
   ============================================================ */

/* ---------- MODAL: Novo Lead ---------- */
/* ---------- constantes do formulário de equipamentos ---------- */
const EQUIP_OPTS = [
  { key: 'elevador', label: 'Elevador' },
  { key: 'escada',   label: 'Escada Rolante' },
  { key: 'esteira',  label: 'Esteira' },
];
const TIPO_EQUIP_OPTS = ['Residencial','Comercial','Escritório','Escola','Hospital','Industrial','Local Público','Outro'];
const ABERTURA_OPTS   = ['Central','Telescópica Direita','Telescópica Esquerda'];

function ModalNovoLead({ onClose, onSaved, onCreateCotacao }) {
  const [f, setF] = React.useState({
    building:'', contact:'', role:'', phone:'', email:'',
    origin:'Site', status:'Em qualificação',
    owner:'', value:'', priority:'Alta', next:'',
  });
  const [equips, setEquips] = React.useState({
    elevador: { checked: false, qty: 1, paradas: 1 },
    escada:   { checked: false, qty: 1 },
    esteira:  { checked: false, qty: 1 },
  });
  const [tipoEquip, setTipoEquip] = React.useState('');
  const [elevSpec, setElevSpec] = React.useState({ carga: '', abertura: 'Central', vao: '', acabamento: 'Inox' });
  const [saving, setSaving] = React.useState(false);
  const [savedLead, setSavedLead] = React.useState(null);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setElev = (k, v) => setElevSpec(p => ({ ...p, [k]: v }));
  const setEquipField = (key, field, value) => setEquips(p => ({ ...p, [key]: { ...p[key], [field]: value } }));

  const hasEquip    = Object.values(equips).some(e => e.checked);
  const hasElevador = equips.elevador.checked;

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.contact.trim())  return window.toast('Contato é obrigatório.', 'warning');
    if (!hasEquip)          return window.toast('Selecione ao menos um equipamento.', 'warning');
    if (!tipoEquip)         return window.toast('Tipo de empreendimento é obrigatório.', 'warning');
    if (hasElevador) {
      if (!elevSpec.carga) return window.toast('Informe a carga do elevador (kg).', 'warning');
      if (!elevSpec.vao)   return window.toast('Informe o vão de porta (cm).', 'warning');
    }
    setSaving(true);
    const id = 'LD-' + Date.now().toString().slice(-6);

    const equipItens = EQUIP_OPTS.filter(o => equips[o.key].checked)
      .map(o => o.key === 'elevador'
        ? { tipo: o.label, quantidade: equips[o.key].qty, paradas: equips.elevador.paradas }
        : { tipo: o.label, quantidade: equips[o.key].qty });
    const equipStr = equipItens.map(i =>
      i.paradas !== undefined
        ? `${i.quantidade}× ${i.tipo} (${i.paradas} paradas)`
        : `${i.quantidade}× ${i.tipo}`
    ).join(', ')
      + ` · ${tipoEquip}`
      + (hasElevador ? ` · ${elevSpec.carga}kg ${elevSpec.abertura}` : '');

    const { error } = await window.__VP_SB.sb.from('leads').insert({
      id,
      building: f.building, contact: f.contact, role: f.role || null,
      phone: f.phone || null, email: f.email || null, equip: equipStr,
      origin: f.origin, status: f.status, owner: f.owner || null,
      value: f.value ? parseFloat(f.value) : null,
      priority: ({ 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }[f.priority] || 'media'),
      next_action: f.next || null,
      date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    onSaved?.();
    setSavedLead({
      id, building: f.building, equipItens, tipoEquip,
      elevSpec: hasElevador ? { ...elevSpec } : null,
      totalEquip: equipItens.reduce((s, i) => s + i.quantidade, 0),
    });
  };

  const fld = (label, key, type = 'text', ph = '', opts = null) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]}
            onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  /* ISSUE #13: Auto-close modal após salvar lead se usuário não interagir */
  React.useEffect(() => {
    if (savedLead) {
      const timer = setTimeout(() => {
        setSavedLead(null);
        onClose();
      }, 4000);  // fecha automaticamente em 4 segundos
      return () => clearTimeout(timer);
    }
  }, [savedLead, onClose]);

  /* ---- pós-save: confirmar criação de cotação ---- */
  if (savedLead) {
    return (
      <Modal title="✓ Lead Criado! (fechará em 4s)" onClose={() => { setSavedLead(null); onClose(); }} width={500}
        footer={<>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {onCreateCotacao && (
            <Button variant="primary" icon="globe"
              onClick={() => { onClose(); onCreateCotacao(savedLead); }}>
              Criar Cotação China →
            </Button>
          )}
        </>}>
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ background:'var(--vp-gray-50)', border:'1px solid var(--border)', padding:'14px 16px' }}>
            <div className="up-eyebrow muted" style={{ marginBottom:6 }}>Lead criado com sucesso</div>
            <div style={{ fontWeight:700, fontSize:15 }}>{savedLead.building}</div>
            <div className="cell-sub" style={{ marginTop:4 }}>{savedLead.id}</div>
            <div className="cell-sub" style={{ marginTop:4 }}>
              {savedLead.equipItens.map(i =>
                i.paradas !== undefined
                  ? `${i.quantidade}× ${i.tipo} (${i.paradas} paradas)`
                  : `${i.quantidade}× ${i.tipo}`
              ).join(', ')}
              {' · '}{savedLead.tipoEquip}
              {savedLead.elevSpec && ` · ${savedLead.elevSpec.carga}kg · ${savedLead.elevSpec.abertura}`}
            </div>
          </div>
          <p style={{ fontSize:13, color:'var(--fg2)', margin:0 }}>
            Deseja criar uma cotação China para este lead agora?
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Novo Lead" onClose={onClose} width={600}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Criar Lead'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Prédio / Empreendimento *', 'building', 'text', 'Ed. Itacolomi, Shopping Vila Olímpia…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Contato *', 'contact', 'text', 'Nome do síndico / responsável')}
          {fld('Cargo', 'role', 'text', 'Síndico, Gerente, Engenheiro…')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Telefone', 'phone', 'text', '(11) 9 9999-9999')}
          {fld('Email', 'email', 'email', 'contato@email.com')}
        </div>

        {/* ---- EQUIPAMENTO ---- */}
        <div style={{ border:'1px solid var(--border)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          <label className="up-eyebrow muted">Equipamento *</label>

          {/* checkboxes + qty */}
          {EQUIP_OPTS.map(({ key, label }) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" id={`eq-${key}`}
                checked={equips[key].checked}
                onChange={e => setEquipField(key, 'checked', e.target.checked)}
                style={{ width:16, height:16, accentColor:'#f5c400', cursor:'pointer', flexShrink:0 }}/>
              <label htmlFor={`eq-${key}`}
                style={{ fontSize:13, fontWeight:500, cursor:'pointer', flex:1 }}>
                {label}
              </label>

              {/* Elevador marcado: dois campos com labels */}
              {key === 'elevador' && equips.elevador.checked && (
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--fg2)', whiteSpace:'nowrap' }}>Qtd. equip.</span>
                    <input type="number" className="input" min="1" max="99"
                      value={equips.elevador.qty}
                      onChange={e => setEquipField('elevador', 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                      aria-label="Quantidade de Elevadores"
                      style={{ width:68, textAlign:'center' }}/>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--fg2)', whiteSpace:'nowrap' }}>Qtd. paradas</span>
                    <input type="number" className="input" min="1" max="99"
                      value={equips.elevador.paradas}
                      onChange={e => setEquipField('elevador', 'paradas', Math.max(1, parseInt(e.target.value) || 1))}
                      aria-label="Quantidade de paradas do elevador"
                      style={{ width:82, textAlign:'center' }}/>
                  </div>
                </div>
              )}

              {/* Outros equipamentos marcados: campo simples */}
              {key !== 'elevador' && equips[key].checked && (
                <input type="number" className="input" min="1" max="99"
                  value={equips[key].qty}
                  onChange={e => setEquipField(key, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Qtd"
                  aria-label={`Quantidade de ${label}`}
                  style={{ width:72, textAlign:'center' }}/>
              )}
            </div>
          ))}

          {/* tipo de empreendimento — aparece ao selecionar ao menos 1 */}
          {hasEquip && (
            <div className="stack" style={{ gap:4, marginTop:2 }}>
              <label className="up-eyebrow muted">Tipo de empreendimento *</label>
              <select className="input" value={tipoEquip} onChange={e => setTipoEquip(e.target.value)}>
                <option value="">Selecione…</option>
                {TIPO_EQUIP_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* especificações do elevador — aparece quando elevador marcado */}
          {hasElevador && (
            <div style={{ background:'var(--vp-gray-50)', border:'1px solid var(--border)', padding:'10px 12px', marginTop:2 }}>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>
                Especificações do Elevador
              </div>
              <div className="grid-2" style={{ gap:10 }}>
                <div className="stack" style={{ gap:4 }}>
                  <label className="up-eyebrow muted">Carga (kg) *</label>
                  <input className="input" type="number"
                    value={elevSpec.carga} onChange={e => setElev('carga', e.target.value)}
                    placeholder="Ex: 450, 600, 1000"/>
                </div>
                <div className="stack" style={{ gap:4 }}>
                  <label className="up-eyebrow muted">Vão de porta (cm) *</label>
                  <input className="input" type="text"
                    value={elevSpec.vao} onChange={e => setElev('vao', e.target.value)}
                    placeholder="Ex: 90, 100, 110"/>
                </div>
                <div className="stack" style={{ gap:4 }}>
                  <label className="up-eyebrow muted">Tipo de abertura *</label>
                  <select className="input" value={elevSpec.abertura} onChange={e => setElev('abertura', e.target.value)}>
                    {ABERTURA_OPTS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="stack" style={{ gap:4 }}>
                  <label className="up-eyebrow muted">Acabamento *</label>
                  <div style={{ display:'flex', gap:20, alignItems:'center', height:32 }}>
                    {['Bege','Inox'].map(op => (
                      <label key={op} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                        <input type="radio" name="elev-acabamento" value={op}
                          checked={elevSpec.acabamento === op}
                          onChange={() => setElev('acabamento', op)}
                          style={{ accentColor:'#f5c400' }}/>
                        {op}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid-2" style={{ gap:12 }}>
          {fld('Origem', 'origin', 'text', '', ['Site','Indicação','LinkedIn','Cold Call','Evento','WhatsApp','Email'])}
          {fld('Prioridade', 'priority', 'text', '', ['Alta','Média','Baixa'])}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Responsável (Comercial)', 'owner', 'text', 'Nome do vendedor')}
          {fld('Valor estimado (R$)', 'value', 'number', '0')}
        </div>
        {fld('Próxima ação', 'next', 'text', 'Ex.: Enviar proposta, Agendar visita…')}
      </div>
    </Modal>
  );
}

/* ---------- LEADS ---------- */
function LeadsPage({ setRoute, setSubsel }) {
  const [leads, setLeads] = React.useState(null);
  const [status, setStatus] = React.useState("Todos");
  const [search, setSearch] = React.useState("");
  const [owner, setOwner] = React.useState("Todos");
  const [showLead, setShowLead] = React.useState(false);
  const [cotacaoPrefill, setCotacaoPrefill] = React.useState(null);
  const [showCotFromLead, setShowCotFromLead] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 15;

  const reloadLeads = () => {
    setLeads(null);
    window.__VP_SB.sb.from('leads').select('*').order('date', { ascending: false })
      .then(({ data }) => setLeads(data || []));
  };
  React.useEffect(() => { reloadLeads(); }, []);

  const statuses = ["Todos", "Em qualificação", "Aguardando cotação", "Proposta enviada", "Negociação", "Convertido", "Sem retorno"];
  const allLeads = leads || [];
  const owners = ["Todos", ...Array.from(new Set(allLeads.filter(l => l.owner).map(l => l.owner))).sort()];

  const rows = allLeads.filter(l => {
    if (status !== "Todos" && l.status !== status) return false;
    if (owner !== "Todos" && l.owner !== owner) return false;
    if (search && !((l.building || "") + (l.contact || "") + (l.equip || "")).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = {
    total: allLeads.length,
    qualif: allLeads.filter(l => l.status === "Em qualificação").length,
    proposta: allLeads.filter(l => l.status === "Proposta enviada").length,
    valor: allLeads.reduce((a, l) => a + (l.value || 0), 0),
  };

  if (leads === null) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div className="page-head__l">
            <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
            <h1 className="page-head__title">Pipeline de Leads</h1>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando leads…</div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
          <h1 className="page-head__title">Pipeline de Leads</h1>
          <p className="page-head__sub">{allLeads.length} leads ativos · pipeline {fmtBRL(stats.valor)} · conversão média 27%</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(rows.map(l => ({ id:l.id, predio:l.building, contato:l.contact, cargo:l.role, telefone:l.phone, email:l.email, equipamento:l.equip, origem:l.origin, status:l.status, responsavel:l.owner, valor:l.value, prioridade:l.priority, proxima_acao:l.next_action || l.next, data:l.date })), 'leads.csv')}>Exportar</Button>
          <Button variant="outline" icon="filter" onClick={() => window.toast(`Filtros ativos: status="${status}", responsável="${owner}". Use os botões acima.`, 'info')}>Filtros</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowLead(true)}>Novo Lead</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Leads ativos" value={stats.total} sub="mês" delta={stats.total > 0 ? `+${stats.total}` : "0"} deltaDir="up" icon="flag"/>
        <KPI label="Em qualificação" value={stats.qualif} sub="hot leads" delta={`+${stats.qualif}`} deltaDir="up" icon="zap"/>
        <KPI label="Propostas no ar" value={stats.proposta} sub="aguardando" delta="0" deltaDir="up" icon="fileText"/>
        <KPI label="Valor pipeline" value={fmtBRL(stats.valor)} sub="potencial" delta="—" deltaDir="up" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {statuses.map(s => (
            <button key={s} className={status === s ? "is-active" : ""} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="divider-v"/>
        <select className="input" style={{ width: 160, height: 28, fontSize: 12 }} value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar prédio, contato, equipamento…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>ID</th>
            <th>Lead / Prédio</th>
            <th>Contato</th>
            <th>Equipamento</th>
            <th>Origem</th>
            <th>Status</th>
            <th>Resp.</th>
            <th className="text-right">Valor</th>
            <th>Próx. Ação</th>
            <th></th>
          </tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 0", color: "var(--fg3)", fontSize: 13 }}>
                  {search || status !== "Todos" || owner !== "Todos"
                    ? "Nenhum lead encontrado com os filtros aplicados."
                    : "Nenhum lead cadastrado. Clique em \"Novo Lead\" para começar."}
                </td>
              </tr>
            ) : pageRows.map(l => (
              <tr key={l.id} onClick={() => { setSubsel(l); setRoute("lead-detail"); }}>
                <td><span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{l.id}</span></td>
                <td>
                  <div className="cell-main">{l.building}</div>
                  <div className="cell-sub">{fmtDate(l.date)}</div>
                </td>
                <td>
                  <div className="cell-main">{l.contact}</div>
                  <div className="cell-sub">{l.role} · {l.phone}</div>
                </td>
                <td><span style={{ fontSize: 12.5, color: "var(--fg2)" }}>{l.equip}</span></td>
                <td><Badge variant="outline">{l.origin}</Badge></td>
                <td><StatusBadge status={l.status}/></td>
                <td>
                  <div className="row gap-2">
                    <div className="avatar sm">{(l.owner || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                    <span style={{ fontSize: 12 }}>{l.owner || "—"}</span>
                  </div>
                </td>
                <td className="cell-money">{fmtBRL(l.value)}</td>
                <td>
                  <div style={{ fontSize: 12, color: "var(--fg1)", fontWeight: 500 }}>{l.next_action || l.next || "—"}</div>
                  <Badge variant={String(l.priority).toLowerCase() === "alta" ? "danger" : String(l.priority).toLowerCase() === "media" || l.priority === "Média" ? "warning" : "neutral"} style={{ marginTop: 4 }}>
                    {({ alta: "Alta", media: "Média", baixa: "Baixa" }[String(l.priority || "").toLowerCase()] || l.priority || "—")}
                  </Badge>
                </td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row sb" style={{ marginTop: 14, fontSize: 12, color: "var(--fg3)" }}>
        <span>Exibindo <b>{pageRows.length}</b> de <b>{rows.length}</b> leads</span>
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}/>
          <span className="mono">Pág. {page + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" icon="chevRight" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}/>
        </div>
      </div>

      {showLead && (
        <ModalNovoLead
          onClose={() => setShowLead(false)}
          onSaved={reloadLeads}
          onCreateCotacao={(lead) => {
            setShowLead(false);
            setCotacaoPrefill(lead);
            setShowCotFromLead(true);
          }}
        />
      )}
      {showCotFromLead && (
        <ModalNovaCotacao
          onClose={() => { setShowCotFromLead(false); setCotacaoPrefill(null); }}
          onSaved={() => {
            reloadLeads();
            window.toast('Cotação criada! Acesse Comercial → Cotações China.', 'success');
          }}
          prefill={cotacaoPrefill}
        />
      )}
    </div>
  );
}

/* ---------- LEAD DETAIL ---------- */
function LeadDetail({ lead, setRoute }) {
  const [creatingDossier, setCreatingDossier] = React.useState(false);

  if (!lead) {
    return <EmptyStateRedirect
      icon="flag"
      title="Nenhum lead selecionado"
      message="Selecione um lead da listagem para ver os detalhes, contato, histórico e próximos passos."
      ctaLabel="Ir para Listagem de Leads"
      onCta={() => setRoute("leads")}/>;
  }
  const history = [
    { t: "Lead criado via Site (formulário público)", date: "12/mai 09:14", who: "Sistema", icon: "plus" },
    { t: "Contato inicial — WhatsApp respondido pelo síndico", date: "12/mai 10:42", who: "Comercial", icon: "message" },
    { t: "Cotação CT-2026-118 solicitada para fornecedor Suzhou Vertical", date: "12/mai 14:20", who: "Comercial", icon: "globe" },
    { t: "Visita técnica agendada — 15/mai 14h", date: "12/mai 15:00", who: "Engenharia", icon: "calendar" },
    { t: "Email follow-up enviado com prévia da proposta", date: "13/mai 08:30", who: "Comercial", icon: "mail" },
  ];

  const criarDossier = async () => {
    if (lead.status !== "Em qualificação" && lead.status !== "Aguardando cotação") {
      return window.toast('Lead já está avançado. Crie Dossier manualmente.', 'warning');
    }
    setCreatingDossier(true);
    try {
      const dossier = await window.__DOSSIER.criarDeDossier(lead);
      window.toast('Dossier criado com sucesso! ID: ' + dossier.id, 'success');
      setRoute('dossier-obra');
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    } finally {
      setCreatingDossier(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("leads")}>Voltar para Leads</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{lead.id} · {lead.origin}</div>
          <h1 className="page-head__title">{lead.building}</h1>
          <p className="page-head__sub">{lead.equip}</p>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={lead.status}/>
            <Badge variant={String(lead.priority).toLowerCase() === "alta" ? "danger" : "warning"} dot>
              {({ alta: "Alta", media: "Média", baixa: "Baixa" }[String(lead.priority || "").toLowerCase()] || lead.priority)}
            </Badge>
            <span className="muted small">Última atualização: —</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="message" onClick={() => { const p = (lead.phone || '').replace(/\D/g,''); p ? window.open('https://wa.me/55'+p,'_blank') : window.toast('Telefone não cadastrado.','warning'); }}>WhatsApp</Button>
          <Button variant="outline" icon="mail" onClick={() => { lead.email ? window.open('mailto:'+lead.email) : window.toast('Email não cadastrado.','warning'); }}>Email</Button>
          <Button variant="primary" icon="zap" onClick={criarDossier} disabled={creatingDossier}>
            {creatingDossier ? 'Criando…' : 'Qualificar → Dossier'}
          </Button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card title="Resumo da oportunidade" sub="dados do prédio + escopo">
            <div className="grid-3" style={{ gap: 24 }}>
              <KvBlock label="Valor estimado" value={fmtBRL(lead.value)} mono/>
              <KvBlock label="Marca do equipamento" value="Atlas Schindler 9300AE"/>
              <KvBlock label="Quantidade" value="4 elevadores + 2 esc."/>
              <KvBlock label="Ano construção prédio" value="1998"/>
              <KvBlock label="Tipo serviço" value="Modernização total"/>
              <KvBlock label="Prazo desejado" value="Q3 2026"/>
            </div>
            <div className="hr"/>
            <div className="up-eyebrow muted">Descrição enviada pelo cliente</div>
            <p className="vp-small" style={{ marginTop: 8 }}>
              "Estamos buscando proposta para modernização completa dos 4 elevadores Schindler 9300AE
              (incluindo botoeiras, displays, quadro de comando e cabos de tração). Prioridade alta —
              os elevadores apresentam falhas frequentes e estamos com reclamações dos moradores.
              Por favor, agendar visita técnica o quanto antes."
            </p>
          </Card>

          <Card title="Histórico de Atividades" sub={history.length + " interações"}>
            <div className="timeline">
              {history.map((h, i) => (
                <div key={i} className={"timeline__row " + (i === 0 ? "current" : "done")}>
                  <div className="timeline__node"/>
                  <div>
                    <div className="timeline__title">{h.t}</div>
                    <div className="timeline__sub">por {h.who}</div>
                  </div>
                  <div className="timeline__meta">{h.date}</div>
                  <div className="timeline__rail"/>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Próximos passos sugeridos" sub="orquestração automática">
            <div className="stack" style={{ gap: 10 }}>
              <SuggestedStep icon="globe" label="Aguardar retorno cotação China" sub="CT-2026-118 · prazo 17/mai" status="current"/>
              <SuggestedStep icon="ruler" label="Visita técnica e laudo preliminar" sub="agendado 15/mai · Engenharia" status="next"/>
              <SuggestedStep icon="calculator" label="Calcular precificação final" sub="após laudo + cotação" status="future"/>
              <SuggestedStep icon="proposal" label="Enviar proposta + minuta jurídica" sub="estimativa 22/mai" status="future"/>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Contato">
            <div className="row gap-3" style={{ marginBottom: 14 }}>
              <div className="avatar lg">{(lead.contact || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{lead.contact}</div>
                <div className="cell-sub">{lead.role}</div>
              </div>
            </div>
            <KvBlock label="Telefone" value={lead.phone} mono/>
            <KvBlock label="Email" value={lead.email} mono/>
            <div className="row gap-2" style={{ marginTop: 14 }}>
              <Button variant="secondary" size="sm" icon="message" onClick={() => { const p = (lead.phone || '').replace(/\D/g,''); p ? window.open('https://wa.me/55'+p,'_blank') : window.toast('Telefone não cadastrado.','warning'); }}>WhatsApp</Button>
              <Button variant="outline" size="sm" icon="mail" onClick={() => { lead.email ? window.open('mailto:'+lead.email) : window.toast('Email não cadastrado.','warning'); }}>Email</Button>
            </div>
          </Card>

          <Card title="Atribuição">
            <KvBlock label="Vendedor" value={lead.owner}/>
            <KvBlock label="Equipe" value="Comercial Capital"/>
            <KvBlock label="Origem" value={lead.origin}/>
            <KvBlock label="Comissão prevista" value={fmtBRL(lead.value * 0.04, { decimals: 0 }) + " (4%)"} mono/>
          </Card>

          <Card title="Etiquetas">
            <div className="row wrap gap-2">
              <Badge variant="outline">Modernização</Badge>
              <Badge variant="outline">Schindler</Badge>
              <Badge variant="yellow">+R$ 400k</Badge>
              <Badge variant="info">Capital SP</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KvBlock({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="up-eyebrow muted" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--fg1)", fontFamily: mono ? "var(--font-mono)" : "inherit", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function SuggestedStep({ icon, label, sub, status }) {
  const I = Icon[icon] || Icon.bolt;
  const stylesByStatus = {
    current: { background: "#FFFBE6", borderColor: "var(--vp-yellow)" },
    next:    { background: "#fff", borderColor: "var(--border-strong)" },
    future:  { background: "var(--vp-gray-50)", borderColor: "var(--border)", opacity: .7 },
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      border: "1px solid var(--border)",
      ...stylesByStatus[status]
    }}>
      <div style={{ width: 34, height: 34, background: status === "current" ? "#000" : "var(--vp-gray-100)", color: status === "current" ? "var(--vp-yellow)" : "var(--fg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <I size={18}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>{label}</div>
        <div className="cell-sub">{sub}</div>
      </div>
      <Icon.chevRight size={16} color="var(--fg3)"/>
    </div>
  );
}

/* ---------- MODAL: Nova Cotação ---------- */
function ModalNovaCotacao({ onClose, onSaved, prefill = null }) {
  const token = React.useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const [f, setF] = React.useState(() => ({
    building: prefill?.building || '',
    supplier: '',
    lead:     prefill?.id || '',
    items:    String(prefill?.totalEquip || 1),
    deadline: '',
    line:     '',
  }));
  const [leads, setLeads] = React.useState([]);
  const [leadSearch, setLeadSearch] = React.useState('');
  const [showLeadDropdown, setShowLeadDropdown] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (window.__VP_SB?.sb) {
      window.__VP_SB.sb.from('leads').select('id,building').order('date', { ascending: false })
        .then(({ data }) => setLeads(data || []));
    }
  }, []);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const selectedLead = leads.find(l => l.id === f.lead);
  const filteredLeads = leads.filter(l =>
    l.id.toLowerCase().includes(leadSearch.toLowerCase()) ||
    l.building.toLowerCase().includes(leadSearch.toLowerCase())
  );

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.supplier.trim()) return window.toast('Fornecedor é obrigatório.', 'warning');
    if (!f.deadline) return window.toast('Prazo de retorno é obrigatório.', 'warning');
    if (f.lead && !leads.find(l => l.id === f.lead)) return window.toast('Lead inválido. Selecione um lead da lista.', 'warning');
    setSaving(true);
    const id = 'CT-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('cotacoes').insert({
      id,
      building: f.building, supplier: f.supplier,
      lead_id: f.lead || null, items: parseInt(f.items) || 1,
      deadline: f.deadline, status: 'Aguardando China',
      token, line: f.line || null,
      date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Cotação criada!', 'success');
    onSaved?.(); onClose();
  };

  return (
    <Modal title="Nova Cotação China" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Criar Cotação'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {prefill && (
          <div className="alert info" style={{ margin:0 }}>
            <Icon.flag size={14}/>
            <div style={{ flex:1, fontSize:12 }}>
              Pré-preenchido do lead <b>{prefill.id}</b> —{' '}
              {prefill.equipItens?.map(i => `${i.quantidade}× ${i.tipo}`).join(', ')}
              {prefill.tipoEquip ? ` · ${prefill.tipoEquip}` : ''}
            </div>
          </div>
        )}
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Prédio / Projeto *</label>
          <input className="input" value={f.building} onChange={e => set('building', e.target.value)} placeholder="Ed. Itacolomi, Shopping Vila Olímpia…"/>
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Fornecedor (China) *</label>
            <input className="input" value={f.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Ex.: Suzhou Vertical Co."/>
          </div>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Linha marítima</label>
            <input className="input" value={f.line} onChange={e => set('line', e.target.value)} placeholder="Ex.: MSC, Cosco…"/>
          </div>
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Lead de referência</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Buscar ID ou prédio…"
                value={showLeadDropdown ? leadSearch : (selectedLead?.building || selectedLead?.id || '')}
                onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true); }}
                onFocus={() => setShowLeadDropdown(true)}
                onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
              />
              {showLeadDropdown && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 4,
                    maxHeight: 200, overflowY: 'auto', zIndex: 1000
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {filteredLeads.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fg3)' }}>Nenhum lead encontrado</div>
                  ) : (
                    filteredLeads.map(l => (
                      <div
                        key={l.id}
                        style={{
                          padding: '8px 12px', borderBottom: '1px solid var(--vp-gray-50)',
                          cursor: 'pointer', fontSize: 12, color: 'var(--fg1)'
                        }}
                        onClick={() => { set('lead', l.id); setShowLeadDropdown(false); setLeadSearch(''); }}
                      >
                        <span className="mono" style={{ fontSize: 10, color: 'var(--fg3)' }}>{l.id}</span> · {l.building}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Qtd. de itens</label>
            <input className="input" type="number" min="1" value={f.items} onChange={e => set('items', e.target.value)}/>
          </div>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Prazo de retorno *</label>
          <input className="input" type="date" value={f.deadline} onChange={e => set('deadline', e.target.value)}/>
        </div>
        <div style={{ background:'var(--vp-gray-50)', padding:'10px 12px', fontSize:12, color:'var(--fg3)' }}>
          Link público gerado: <span className="mono" style={{ color:'var(--fg1)' }}>vp.cn/{token}</span> · compartilhe com a fábrica para preenchimento sem login
        </div>
      </div>
    </Modal>
  );
}

/* ---------- COTAÇÕES China ---------- */
function CotacoesPage({ setRoute, setSubsel }) {
  const [cotacoes, setCotacoes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("Todos");
  const [showCot, setShowCot] = React.useState(false);
  const statuses = ["Todos", "Aguardando China", "Recebida", "Em análise", "Aprovada"];

  const reloadCotacoes = () => {
    setLoading(true);
    window.__VP_SB.sb.from('cotacoes').select('*').order('date', { ascending: false })
      .then(({ data }) => { setCotacoes(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadCotacoes(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const rows = cotacoes.filter(c => status === "Todos" || c.status === status);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · China</div>
          <h1 className="page-head__title">Cotações China</h1>
          <p className="page-head__sub">Solicitações enviadas aos fornecedores chineses. Link público é gerado para a fábrica preencher SEM autenticação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="link2" onClick={() => { const url = 'https://vp.cn/nova-cotacao'; navigator.clipboard?.writeText(url).then(() => window.toast('Link público copiado!', 'success')).catch(() => window.toast('Link: ' + url, 'info')); }}>Link público</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowCot(true)}>Nova Cotação</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Em aberto" value={cotacoes.filter(c => c.status === "Aguardando China").length} sub="aguardando China" icon="clock"/>
        <KPI label="Recebidas" value={cotacoes.filter(c => c.status === "Recebida").length} sub="prontas p/ análise" icon="package"/>
        <KPI label="SLA médio" value="—" sub="sem dados suficientes" icon="trending"/>
        <KPI label="Variação preço" value="—" sub="sem dados suficientes" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">{statuses.map(s => <button key={s} className={status === s ? "is-active" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div>
        <div className="spacer"/>
        <Button variant="outline" size="sm" icon="filter">Fornecedor</Button>
        <Button variant="outline" size="sm" icon="filter">Origem</Button>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>ID</th>
            <th>Prédio / Projeto</th>
            <th>Fornecedor</th>
            <th>Itens</th>
            <th>Prazo</th>
            <th>Status</th>
            <th>Link público</th>
            <th className="text-right">Total USD</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </td></tr>
            )}
            {rows.map(c => (
              <tr key={c.id} onClick={() => { setSubsel(c); setRoute("cotacao-detail"); }}>
                <td><span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{c.id}</span></td>
                <td>
                  <div className="cell-main">{c.building}</div>
                  <div className="cell-sub">Lead {c.lead_id} · solicitado {fmtDate(c.date)}</div>
                </td>
                <td>{c.supplier}</td>
                <td><span className="cell-num">{c.items}</span></td>
                <td>
                  <div className="cell-num">{fmtDate(c.deadline)}</div>
                  <div className="cell-sub">{daysLeft(c.deadline) > 0 ? `em ${daysLeft(c.deadline)}d` : `atrasada ${-daysLeft(c.deadline)}d`}</div>
                </td>
                <td><StatusBadge status={c.status}/></td>
                <td>
                  <div className="row gap-2">
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>vp.cn/{c.token}</span>
                    <Button variant="ghost" size="sm" icon="copy" data-tip="Copiar"/>
                  </div>
                </td>
                <td className="cell-money">{c.total ? fmtUSD(c.total) : "—"}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCot && <ModalNovaCotacao onClose={() => setShowCot(false)} onSaved={reloadCotacoes}/>}
    </div>
  );
}

function daysLeft(dateStr) {
  const now = new Date();
  const t = new Date(dateStr + "T12:00:00");
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}

/* ---------- COTAÇÃO DETAIL (with line items + PDF preview placeholder) ---------- */
function CotacaoDetail({ cot, setRoute }) {
  if (!cot) {
    return <EmptyStateRedirect
      icon="globe"
      title="Nenhuma cotação selecionada"
      message="Escolha uma cotação na listagem para ver itens, status China, link público e fornecedor."
      ctaLabel="Ir para Cotações China"
      onCta={() => setRoute("cotacoes")}/>;
  }
  const [aprovado, setAprovado] = React.useState(cot.status === 'Aprovada');
  // TODO: conectar Supabase — itens da cotação virão de tabela de itens futuramente
  const items = [];
  const totalUSD = 0;

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("cotacoes")}>Voltar para Cotações</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{cot.id} · {cot.supplier}</div>
          <h1 className="page-head__title">{cot.building}</h1>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={cot.status}/>
            <span className="muted small">Prazo de retorno: <b>{fmtDateLong(cot.deadline)}</b></span>
            <span className="muted small">Solicitado em {fmtDateLong(cot.date)}</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => { window.toast("Abrindo impressão — salve como PDF.", "info"); setTimeout(() => window.print(), 200); }}>PDF</Button>
          <Button variant="outline" icon="link2" onClick={() => { const url = `https://vp.cn/cotacao/${cot.token}`; navigator.clipboard?.writeText(url).then(() => window.toast("Link copiado!", "success")).catch(() => window.toast("Link: " + url, "info")); }}>Copiar link público</Button>
          <Button variant={aprovado ? "ghost" : "primary"} icon="check" onClick={async () => { if (aprovado) return window.toast('Cotação já aprovada.', 'info'); const { error } = await window.__VP_SB.sb.from('cotacoes').update({ status: 'Aprovada' }).eq('id', cot.id); if (error) return window.toast('Erro: ' + error.message, 'error'); setAprovado(true); window.toast('Cotação aprovada!', 'success'); }}>{aprovado ? 'Aprovada ✓' : 'Aprovar'}</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }} sharp={false}>
        <div className="alert info" style={{ margin: 0 }}>
          <Icon.link2/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">Link público para fábrica preencher</div>
            <div className="alert__sub mono" style={{ fontSize: 12, marginTop: 2 }}>https://vp.cn/cotacao/{cot.token} · sem autenticação · expira em 7 dias</div>
          </div>
          <Button variant="secondary" size="sm" icon="copy">Copiar</Button>
        </div>
      </Card>

      <div className="split--wide split">
        <Card title="Itens solicitados" sub={`${items.length} itens · total ${fmtUSD(totalUSD)} FOB Shanghai`} action={<Button variant="ghost" size="sm" icon="plus">Adicionar item</Button>}>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="t">
              <thead><tr>
                <th>SKU</th><th>Descrição</th><th>Categoria</th><th>Qtd</th>
                <th className="text-right">Preço unit.</th><th className="text-right">Total</th>
              </tr></thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
                    Nenhum item cadastrado. {/* TODO: tabela de itens de cotação — fase futura */}
                  </td></tr>
                )}
                {items.map((it) => (
                  <tr key={it.sku}>
                    <td><span className="sku">{it.sku}</span></td>
                    <td><div className="cell-main">{it.name}</div></td>
                    <td><span className="muted">{it.cat}</span></td>
                    <td className="cell-num">{it.qty}</td>
                    <td className="cell-money">{cot.status === "Aguardando China" ? <span className="muted">—</span> : fmtUSD(it.unitPrice)}</td>
                    <td className="cell-money">{cot.status === "Aguardando China" ? <span className="muted">—</span> : fmtUSD(it.qty * it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--vp-gray-50)" }}>
                  <td colSpan={5} className="text-right" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11, letterSpacing: ".14em" }}>Total FOB Shanghai</td>
                  <td className="cell-money" style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 14 }}>{cot.status === "Aguardando China" ? "—" : fmtUSD(totalUSD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Status China" sub="MCC sync">
            <div className="timeline">
              <div className="timeline__row done">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Solicitação enviada</div>
                  <div className="timeline__sub">{fmtDate(cot.date)} · Comercial</div>
                </div>
                <div className="timeline__meta">100%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row done">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Recebido pelo fornecedor</div>
                  <div className="timeline__sub">Suzhou Vertical · acessou link público</div>
                </div>
                <div className="timeline__meta">100%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row current">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Aguardando preenchimento</div>
                  <div className="timeline__sub">Última atividade: hoje 06:18</div>
                </div>
                <div className="timeline__meta">60%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row" >
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Aprovação interna</div>
                  <div className="timeline__sub">Equipe Comercial</div>
                </div>
                <div className="timeline__meta">—</div>
              </div>
            </div>
          </Card>

          <Card title="Fornecedor">
            <div className="row gap-3" style={{ marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, background: "#FF4D2E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "var(--font-display)" }}>CN</div>
              <div>
                <div style={{ fontWeight: 700 }}>{cot.supplier}</div>
                <div className="cell-sub">Suzhou Industrial Park · Jiangsu</div>
              </div>
            </div>
            <KvBlock label="Contato" value="Mr. Wei Zhang"/>
            <KvBlock label="WeChat" value="wei.zhang.suzhou" mono/>
            <KvBlock label="Última cotação" value="abr/2026"/>
            <KvBlock label="Pontualidade" value="92% (24 cotações)"/>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LeadsPage, LeadDetail, CotacoesPage, CotacaoDetail });
