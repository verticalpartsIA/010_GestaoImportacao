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
          {/* Removido o botão "Filtros" (era só um toast ecoando o estado dos
              filtros de status/responsável que já existem, visíveis e
              funcionais, logo abaixo — CTA redundante, achado #47). */}
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
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
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
function LeadDetail({ lead, setRoute, setSubsel }) {
  const [creatingDossier, setCreatingDossier] = React.useState(false);

  if (!lead) {
    return <EmptyStateRedirect
      icon="flag"
      title="Nenhum lead selecionado"
      message="Selecione um lead da listagem para ver os detalhes, contato, histórico e próximos passos."
      ctaLabel="Ir para Listagem de Leads"
      onCta={() => setRoute("leads")}/>;
  }
  /* Histórico real por lead: criação (intrínseca) + eventos do VPLog que
     têm alvo_id = lead.id. Sem dados → estado vazio honesto (não mais mock). */
  const [history, setHistory] = React.useState(null); // null = carregando
  const fmtHistTs = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const hasTime = typeof ts === "string" && ts.includes("T");
    return hasTime ? dateStr + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : dateStr;
  };
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const rows = [];
      if (lead.date) rows.push({ t: "Lead criado" + (lead.origin ? " via " + lead.origin : ""), who: lead.owner || "Sistema", ts: lead.date, icon: "plus" });
      try {
        const sb = window.__VP_SB && window.__VP_SB.sb;
        if (sb && lead.id != null) {
          const { data } = await sb.from("vp_logs").select("*").eq("alvo_id", String(lead.id)).order("criado_em", { ascending: false }).limit(50);
          (data || []).forEach((l) => rows.push({
            t: l.acao + (l.alvo ? " — " + l.alvo : ""),
            who: l.ator_nome + (l.ator_setor ? " · " + l.ator_setor : ""),
            ts: l.criado_em,
            icon: "activity",
          }));
        }
      } catch (e) { /* rastro best-effort — não quebra a tela */ }
      rows.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      if (alive) setHistory(rows);
    })();
    return () => { alive = false; };
  }, [lead.id]);

  const criarDossier = async () => {
    if (lead.status !== "Em qualificação" && lead.status !== "Aguardando cotação") {
      return window.toast('Lead já está avançado. Crie Dossier manualmente.', 'warning');
    }
    setCreatingDossier(true);
    try {
      const dossier = await window.__DOSSIER.criarDeDossier(lead);
      window.VPLog && window.VPLog.registrar({ modulo: "Comercial", acao: "Lead convertido em Dossiê da Obra", alvo: lead.building, alvo_id: lead.id, detalhe: { dossier_id: dossier.id } });
      window.toast('Dossier criado com sucesso! ID: ' + dossier.id, 'success');
      setSubsel?.(dossier.id);
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

          <Card title="Histórico de Atividades" sub={history == null ? "carregando…" : history.length + (history.length === 1 ? " evento" : " eventos")}>
            {history == null ? (
              <div className="muted small" style={{ padding: "8px 0" }}>Carregando histórico…</div>
            ) : history.length === 0 ? (
              <div className="muted small" style={{ padding: "8px 0" }}>Nenhuma atividade registrada para este lead ainda.</div>
            ) : (
            <div className="timeline">
              {history.map((h, i) => (
                <div key={i} className={"timeline__row " + (i === 0 ? "current" : "done")}>
                  <div className="timeline__node"/>
                  <div>
                    <div className="timeline__title">{h.t}</div>
                    <div className="timeline__sub">por {h.who}</div>
                  </div>
                  <div className="timeline__meta">{fmtHistTs(h.ts)}</div>
                  <div className="timeline__rail"/>
                </div>
              ))}
            </div>
            )}
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

/* ---------- FORMULÁRIOS (placeholder — estrutura interna vem em sessão futura) ---------- */
/* 15/08 — Elevador, Escada Rolante e Esteira Rolante deixaram de ser
   categorias/formulários separados: agora moram todos dentro do mesmo
   Formulário — Equipamento (reunião de vendedores, uma cotação pode ter
   vários tipos de equipamento juntos). O card único abaixo leva pro mesmo
   formulário; lá dentro o vendedor escolhe o tipo por card de unidade. */
const FE_CATEGORIAS = [
  { id: 'equipamento', label: 'Equipamento', icon: 'ruler', route: 'formulario-elevador', pronto: true, subLabel: 'Elevador · Escada Rolante · Esteira Rolante' },
  { id: 'mod-elevador', label: 'Modernização Elevador', icon: 'tool', pronto: false },
  { id: 'mod-er-es', label: 'Modernização Escadas e Esteiras', icon: 'tool', pronto: false },
  { id: 'maquina-tracao', label: 'Máquina de Tração', icon: 'grid', pronto: false },
  { id: 'quadro-comando', label: 'Quadro de Comando', icon: 'grid', pronto: false },
  { id: 'portas', label: 'Portas', icon: 'grid', pronto: false },
];

function FormulariosPage({ setRoute, setSubsel }) {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
          <h1 className="page-head__title">Formulários</h1>
          <p className="page-head__sub">Coleta de dados da obra e do equipamento, por categoria, antes de enviar para cotação.</p>
        </div>
      </div>
      <div className="grid-4" style={{ gap: 14 }}>
        {FE_CATEGORIAS.map((c) => (
          <Card key={c.id} title={c.label} sub={c.pronto ? (c.subLabel || 'Disponível') : 'Em breve'}
            style={!c.pronto ? { opacity: .55, cursor: 'not-allowed' } : { cursor: 'pointer' }}
            action={<Icon.chevRight/>}>
            <div
              onClick={() => { if (c.pronto) { setSubsel && setSubsel(null); setRoute(c.route); } }}
              style={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg2)', fontSize: 12.5 }}>
              {c.pronto ? 'Clique para preencher um novo formulário.' : 'Estrutura prevista para fase futura.'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LeadsPage, LeadDetail });
