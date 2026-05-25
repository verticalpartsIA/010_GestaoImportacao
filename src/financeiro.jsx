/* ============================================================
   financeiro.jsx — Gatilhos & Prazo Reverso, Comissões,
                    Notificações, Configurações
   ============================================================ */

function ModalNovoGatilho({ onClose, onSaved }) {
  const [f, setF] = React.useState({ projeto:'', building:'', trigger:'Pagamento entrada', value:'', due_date:'', status:'pendente', reverse_from:'' });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.due_date) return window.toast('Data de vencimento é obrigatória.', 'warning');
    setSaving(true);
    const id = 'GT-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('gatilhos').insert({
      id,
      project_id: f.projeto || null, building: f.building,
      trigger_name: f.trigger || 'Pagamento',
      value: f.value ? parseFloat(f.value) : null,
      due_date: f.due_date, status: f.status,
      reverse_from: f.reverse_from || null, chain: [],
      days_left: Math.round((new Date(f.due_date) - new Date()) / 86400000),
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Gatilho criado!', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type='text', ph='', opts=null) => (
    <div className="stack" style={{ gap:4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]} onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  return (
    <Modal title="Novo Gatilho Financeiro" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Criar Gatilho'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Prédio / Projeto *', 'building', 'text', 'Ed. Itacolomi, Shopping Vila Olímpia…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Código do projeto', 'projeto', 'text', 'Ex.: CT-2026-118')}
          {fld('Tipo de gatilho', 'trigger', 'text', '', ['Pagamento entrada','Pagamento embarque','Pagamento entrega','Sinal','Medição','Outro'])}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Valor (R$)', 'value', 'number', '0')}
          {fld('Vencimento *', 'due_date', 'date')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Status', 'status', 'text', '', ['pendente','atencao','ok'])}
          {fld('Base do prazo reverso', 'reverse_from', 'text', 'Ex.: Data de instalação')}
        </div>
      </div>
    </Modal>
  );
}

function FinanceiroPage() {
  const [gatilhos, setGatilhos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showGatilho, setShowGatilho] = React.useState(false);

  const reloadGatilhos = () => {
    setLoading(true);
    window.__VP_SB.sb.from('gatilhos').select('*').order('due_date')
      .then(({ data }) => { setGatilhos(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadGatilhos(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const urgentes = gatilhos.filter(g => (g.days_left ?? g.daysLeft ?? 99) <= 2);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Prazo Reverso</div>
          <h1 className="page-head__title">Gatilhos & Prazo Reverso</h1>
          <p className="page-head__sub">Pagamentos disparados por marcos contratuais. Cálculo de prazo reverso a partir da data de instalação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(gatilhos.map(g => ({ projeto:g.projeto, building:g.building, trigger:g.trigger, valor:g.value, vencimento:g.due_date, dias_restantes:g.days_left, status:g.status })), 'gatilhos-fluxo.csv')}>Exportar fluxo</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowGatilho(true)}>Novo gatilho</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="A receber 30d" value="—" sub="contratos" delta="—" deltaDir="up" icon="dollar"/>
        <KPI label="Gatilhos próx. 7d" value={gatilhos.filter(g => (g.days_left ?? g.daysLeft ?? 99) <= 7 && (g.days_left ?? g.daysLeft ?? 99) > 0).length} sub="atenção" delta="—" deltaDir="up" icon="zap"/>
        <KPI label="Em atraso" value={gatilhos.filter(g => (g.days_left ?? g.daysLeft ?? 0) < 0).length} sub="ação urgente" delta="—" deltaDir="down" icon="warning"/>
        <KPI label="Recebido (mês)" value="—" sub="—" delta="—" deltaDir="up" icon="trending"/>
      </div>

      {urgentes.length > 0 && (
        <div className="alert danger" style={{ marginBottom: 20 }}>
          <Icon.warning/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">{urgentes.length} gatilho{urgentes.length > 1 ? 's' : ''} vence{urgentes.length === 1 ? '' : 'm'} em até 2 dias</div>
            <div className="alert__sub">Verifique os gatilhos abaixo e confirme os pagamentos pendentes.</div>
          </div>
          <Button variant="secondary" size="sm" iconRight="arrowRight">Ver agora</Button>
        </div>
      )}

      <Card title="Gatilhos Ativos" sub={`${gatilhos.length} projetos · prazo reverso calculado a partir da instalação`}>
        <div className="stack" style={{ gap: 14 }}>
          {gatilhos.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhum registro cadastrado.
            </div>
          )}
          {gatilhos.map((g) => (
            <GatilhoCard key={g.id} g={g}/>
          ))}
        </div>
      </Card>
      {showGatilho && <ModalNovoGatilho onClose={() => setShowGatilho(false)} onSaved={reloadGatilhos}/>}
    </div>
  );
}

function GatilhoCard({ g }) {
  const daysLeft = g.days_left ?? g.daysLeft ?? 0;
  const dueDate  = g.due_date  ?? g.dueDate  ?? null;
  const revFrom  = g.reverse_from ?? g.reverseFrom ?? null;
  const chain    = Array.isArray(g.chain) ? g.chain : [];
  const dueColor = daysLeft <= 2 ? "var(--vp-danger)" : daysLeft <= 7 ? "var(--vp-warning)" : "var(--vp-success)";
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", padding: 0, position: "relative" }}>
      <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 200px", gap: 14, padding: "16px 20px", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="up-eyebrow muted">{g.projeto} · {g.trigger}</div>
          <div style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>{g.building}</div>
        </div>
        <div>
          <div className="up-eyebrow muted">Valor</div>
          <div className="cell-money mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmtBRL(g.value)}</div>
        </div>
        <div>
          <div className="up-eyebrow muted">Vencimento</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: dueColor }}>{fmtDateLong(dueDate)}</div>
          <div className="mono small" style={{ color: dueColor }}>{daysLeft > 0 ? `em ${daysLeft} dias` : daysLeft < 0 ? `vencido há ${-daysLeft}d` : "vence hoje"}</div>
        </div>
        <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
          {g.status === "ok" ? <Badge variant="success" dot>OK</Badge>
           : g.status === "atencao" ? <Badge variant="warning" dot>Atenção</Badge>
           : <Badge variant="danger" dot>Pendente</Badge>}
          <Button variant={daysLeft <= 2 ? "primary" : "outline"} size="sm" icon="check"
            onClick={() => window.toast(`Gatilho "${g.trigger}" confirmado`, "success")}>Confirmar</Button>
        </div>
      </div>

      <div style={{ padding: "14px 20px", background: "var(--vp-gray-50)" }}>
        <div className="up-eyebrow muted" style={{ marginBottom: 10 }}>
          <Icon.history size={11} style={{ verticalAlign: "middle", marginRight: 4 }}/>
          Prazo reverso · base: {revFrom || "—"}
        </div>
        {chain.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--fg3)", fontStyle: "italic" }}>Cadeia de prazos não configurada.</div>
        ) : (
          <div className="prazo-chain">
            {chain.map((c, i) => {
              const lastIdx = chain.length - 1;
              const cls = i === lastIdx ? "current" : i < lastIdx - 1 ? "success" : "warning";
              const label = String(c);
              return (
                <div key={i} className={"prazo-step " + cls}>
                  <div className="prazo-step__lbl">Etapa {i + 1}</div>
                  <div className="prazo-step__t">{label.split(" — ")[0] || label}</div>
                  {label.includes(" — ") ? <div className="prazo-step__d">{label.split(" — ")[1]}</div> : null}
                  {i < chain.length - 1 ? (
                    <div className="prazo-step__arrow"><Icon.arrowRight size={10}/></div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- COMISSÕES ---------- */
function ComissoesPage() {
  const [comissoes, setComissoes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.__VP_SB.sb.from('comissoes').select('*').order('id')
      .then(({ data }) => { setComissoes(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const total = comissoes.reduce((a, c) => a + (c.comissao || 0), 0);
  const totalAprovado = comissoes.filter(c => c.status === "Aprovado").reduce((a, c) => a + (c.comissao || 0), 0);
  const totalAguardando = comissoes.filter(c => c.status !== "Aprovado" && c.status !== "Pago").reduce((a, c) => a + (c.comissao || 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Comissões</div>
          <h1 className="page-head__title">Comissões — Q2/26</h1>
          <p className="page-head__sub">Comissionamento sobre faturamento líquido · liberação após confirmação de entrada</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(comissoes.map(c => ({ vendedor:c.vendedor, cargo:c.role, projetos:c.projetos, faturado:c.faturado, pct_comissao:c.pct, comissao:c.comissao, status:c.status })), 'folha-comissoes-q2.csv')}>Folha de pagto</Button>
          <Button variant="primary" icon="check" onClick={() => window.toast("Todas as comissões aprovadas — Q2/26", "success")}>Aprovar todas</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Total comissões Q2" value={fmtBRL(total)} sub={`${comissoes.length} colaboradores`} delta="—" deltaDir="up" icon="award"/>
        <KPI label="Aprovado" value={fmtBRL(totalAprovado)} sub="liberado" delta="—" deltaDir="up" icon="check"/>
        <KPI label="Aguardando" value={fmtBRL(totalAguardando)} sub="trigger pendente" delta="—" deltaDir="up" icon="clock"/>
        <KPI label="Maior comissão" value={comissoes.length > 0 ? fmtBRL(Math.max(...comissoes.map(c => c.comissao || 0))) : "—"} sub="—" delta="—" deltaDir="flat" icon="award"/>
      </div>

      <Card title="Resumo por vendedor" sub={`${comissoes.length} colaboradores · pagamento dia 10`}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr>
              <th>Vendedor</th>
              <th>Projetos fechados</th>
              <th className="text-right">Faturamento líquido</th>
              <th>%</th>
              <th className="text-right">Comissão Q2</th>
              <th>Progresso</th>
              <th>Status</th>
              <th></th>
            </tr></thead>
            <tbody>
              {comissoes.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                  Nenhum registro cadastrado.
                </td></tr>
              )}
              {comissoes.map((c, i) => (
                <tr key={c.id || c.vendedor}>
                  <td>
                    <div className="row gap-3">
                      <div className="avatar">{(c.vendedor || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                      <div>
                        <div className="cell-main">{c.vendedor}</div>
                        <div className="cell-sub">{c.role}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="cell-num">{c.projetos}</span></td>
                  <td className="cell-money">{fmtBRL(c.faturado)}</td>
                  <td><span className="cell-num">{c.pct}%</span></td>
                  <td className="cell-money" style={{ fontSize: 14, fontWeight: 800 }}>{fmtBRL(c.comissao)}</td>
                  <td style={{ width: 140 }}>
                    <div className="progress" style={{ marginBottom: 4 }}>
                      <span style={{ width: ((c.comissao / 150000) * 100) + "%", background: i % 2 ? "var(--vp-yellow-press)" : "var(--vp-yellow)" }}/>
                    </div>
                    <div className="cell-sub mono">{Math.round(c.comissao / 150000 * 100)}% meta Q</div>
                  </td>
                  <td><StatusBadge status={c.status}/></td>
                  <td>
                    {c.status === "Aprovado" ? <Button variant="primary" size="sm" icon="dollar" onClick={() => window.toast(`Pagamento de ${fmtBRL(c.comissao)} para ${c.vendedor} liberado`, "success")}>Pagar</Button>
                     : c.status === "Pago" ? <Button variant="ghost" size="sm" icon="check"/>
                     : <Button variant="outline" size="sm" icon="check" onClick={() => window.toast(`Comissão de ${c.vendedor} aprovada`, "success")}>Aprovar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14, padding: "12px 16px", background: "#000", color: "var(--vp-yellow)" }} className="row sb">
        <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontWeight: 800, fontSize: 14 }}>Total a pagar Q2/26</span>
        <span className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{fmtBRL(total)}</span>
      </div>
    </div>
  );
}

/* ---------- NOTIFICAÇÕES ---------- */
function NotificacoesPage({ setRoute }) {
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todas");
  const [moduleFilter, setModuleFilter] = React.useState("Todos");
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [details, setDetails] = React.useState(null);
  const [readIds, setReadIds] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('vpprd.notificacoes.lidas') || '[]'); }
    catch (e) { return []; }
  });
  const filters = ["Todas", "Não lidas", "Menções", "Aprovações"];

  const ICON_MAP = { "user-plus": "users", "check": "check", "ship": "ship", "mail": "mail", "at-sign": "at", "dollar": "dollar", "calendar": "calendar" };
  const routeByModule = {
    "Importação": "importacao",
    "Jurídico": "juridico",
    "Financeiro": "financeiro",
    "Engenharia": "engenharia",
    "Cotações": "cotacoes",
    "Propostas": "propostas",
    "Comissões": "comissoes",
  };
  const timeAgo = (ts) => {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    return `há ${d}d`;
  };
  const groupLabel = (n) => {
    if ((n.time || '').includes('agora') || (n.time || '').includes('min') || (n.time || '').includes('h')) return 'Hoje';
    if ((n.time || '') === 'ontem') return 'Ontem';
    return 'Anteriores';
  };
  const iconByModule = (module) => ({
    "Importação": "ship",
    "Jurídico": "fileText",
    "Financeiro": "dollar",
    "Engenharia": "ruler",
    "Cotações": "mail",
    "Propostas": "proposal",
    "Comissões": "award",
  })[module] || "bell";

  const persistReadIds = (ids) => {
    setReadIds(ids);
    localStorage.setItem('vpprd.notificacoes.lidas', JSON.stringify(ids));
  };
  const markRead = (id) => {
    if (!readIds.includes(id)) persistReadIds([...readIds, id]);
  };

  React.useEffect(() => {
    setLoading(true);
    window.__VP_SB.sb.from('alertas').select('*').eq('resolved', false).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          window.toast('Erro ao carregar notificações: ' + error.message, 'error');
          setNotifications([]);
        } else {
          setNotifications((data || []).map(a => ({
            id: a.id,
            title: a.title,
            sub: a.sub,
            time: timeAgo(a.created_at),
            icon: iconByModule(a.module),
            unread: !readIds.includes(a.id),
            module: a.module || 'Sistema',
            level: a.level,
          })));
        }
        setLoading(false);
      });
  }, [readIds.join('|')]);

  const modules = ["Todos", ...Array.from(new Set(notifications.map(n => n.module))).sort()];
  const rows = notifications.filter(n => {
    if (filter === "Não lidas" && !n.unread) return false;
    if (filter === "Menções" && !String(n.title || '').includes('@')) return false;
    if (filter === "Aprovações" && !/aprova|assinatura|confirm/i.test(String(n.title || ''))) return false;
    if (moduleFilter !== "Todos" && n.module !== moduleFilter) return false;
    return true;
  });
  const groups = rows.reduce((acc, n) => {
    const key = groupLabel(n);
    acc[key] = acc[key] || [];
    acc[key].push(n);
    return acc;
  }, {});
  const markAllRead = () => {
    persistReadIds(Array.from(new Set([...readIds, ...notifications.map(n => n.id)])));
    window.toast("Notificações marcadas como lidas", "success");
  };
  const openNotification = (n) => {
    markRead(n.id);
    const target = routeByModule[n.module] || "dashboard";
    setRoute(target);
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Central</div>
          <h1 className="page-head__title">Notificações</h1>
          <p className="page-head__sub">Agrupadas por módulo · respostas rápidas inline</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="settings" onClick={() => setPrefsOpen(true)}>Preferências</Button>
          <Button variant="primary" icon="check" onClick={markAllRead}>Marcar todas como lidas</Button>
        </div>
      </div>

      <div className="tbar">
        <div className="seg">
          {filters.map(f => <button key={f} className={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <div className="spacer"/>
        <select className="input" style={{ width: 180, height: 30, fontSize: 12 }} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          {modules.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="table-wrap" style={{ padding: 0 }}>
        {loading && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
            Carregando notificações…
          </div>
        )}
        {!loading && Object.entries(groups).length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
            Nenhuma notificação encontrada.
          </div>
        )}
        {Object.entries(groups).map(([grp, items]) => (
          <div key={grp}>
            <div style={{ padding: "10px 20px", background: "var(--vp-gray-100)", fontSize: 10, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--fg2)", borderBottom: "1px solid var(--border)" }}>{grp}</div>
            {items.map((n) => {
              const I = Icon[ICON_MAP[n.icon] || "bell"] || Icon.bell;
              return (
                <div key={n.id} className={"notif-row " + (n.unread ? "unread" : "")} onClick={() => setDetails(n)}>
                  <div className="notif-row__icon"><I size={16}/></div>
                  <div className="notif-row__body">
                    <div className="notif-row__title">{n.title}</div>
                    <div className="notif-row__meta">
                      <span>{n.module}</span>
                      <span>·</span>
                      <span>{n.time}</span>
                    </div>
                  </div>
                  <div className="row gap-2">
                    <Button variant="ghost" size="sm" icon="check" aria-label="Marcar como lida"
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); window.toast('Notificação marcada como lida', 'success'); }}/>
                    <Button variant="ghost" size="sm" icon="arrowRight" aria-label="Abrir origem"
                      onClick={(e) => { e.stopPropagation(); openNotification(n); }}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {prefsOpen && <NotificationPrefsModal onClose={() => setPrefsOpen(false)}/>}
      {details && <Modal title="Detalhe da Notificação" onClose={() => setDetails(null)} width={520}
        footer={<>
          <Button variant="ghost" onClick={() => { markRead(details.id); setDetails(null); }}>Marcar como lida</Button>
          <Button variant="primary" iconRight="arrowRight" onClick={() => openNotification(details)}>Abrir origem</Button>
        </>}>
        <div className="stack">
          <Badge variant={details.level === 'danger' ? 'danger' : details.level === 'warning' ? 'warning' : 'info'} dot>{details.module}</Badge>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{details.title}</div>
          {details.sub ? <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{details.sub}</div> : null}
          <div className="mono small muted">{details.time}</div>
        </div>
      </Modal>}
    </div>
  );
}

function NotificationPrefsModal({ onClose }) {
  const [prefs, setPrefs] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vpprd.notificacoes.preferencias') || 'null') || {
        email: true, navegador: true, financeiro: true, operacoes: true, comercial: true,
      };
    } catch (e) {
      return { email: true, navegador: true, financeiro: true, operacoes: true, comercial: true };
    }
  });
  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));
  const save = () => {
    localStorage.setItem('vpprd.notificacoes.preferencias', JSON.stringify(prefs));
    window.toast('Preferências salvas', 'success');
    onClose();
  };
  const row = (key, label, sub) => (
    <label className="row sb" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
      <span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{label}</span>
        <span className="muted" style={{ fontSize: 12 }}>{sub}</span>
      </span>
      <input type="checkbox" checked={!!prefs[key]} onChange={() => toggle(key)} style={{ width: 18, height: 18, accentColor: 'var(--vp-yellow)' }}/>
    </label>
  );
  return (
    <Modal title="Preferências de Notificação" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Salvar preferências</Button>
      </>}>
      <div className="stack">
        {row('navegador', 'Alertas no sistema', 'Exibir notificações dentro do VP Gestão.')}
        {row('email', 'Resumo por email', 'Receber consolidados operacionais no email cadastrado.')}
        {row('financeiro', 'Financeiro', 'Gatilhos, comissões e pagamentos.')}
        {row('operacoes', 'Operações', 'Importação, engenharia, NCM e instalação.')}
        {row('comercial', 'Comercial', 'Leads, cotações e propostas.')}
      </div>
    </Modal>
  );
}

/* ---------- CONFIGURAÇÕES ---------- */
function ConfiguracoesPage() {
  const [tab, setTab] = React.useState("usuarios");
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Admin · Configurações</div>
          <h1 className="page-head__title">Configurações do Sistema</h1>
          <p className="page-head__sub">Usuários, permissões, parâmetros financeiros, integrações de API.</p>
        </div>
      </div>

      <Tabs tabs={[
        { key: "usuarios", label: "Usuários & Perfis", icon: "users" },
        { key: "permissoes", label: "Permissões (RLS)", icon: "shield" },
        { key: "parametros", label: "Parâmetros", icon: "settings" },
        { key: "integracoes", label: "Integrações", icon: "globe" },
        { key: "buckets", label: "Buckets Storage", icon: "package" },
      ]} active={tab} onChange={setTab}/>

      <div style={{ marginTop: 24 }}>
        {tab === "usuarios" && <ConfigUsers/>}
        {tab === "permissoes" && <ConfigPermissions/>}
        {tab === "parametros" && <ConfigParams/>}
        {tab === "integracoes" && <ConfigIntegrations/>}
        {tab === "buckets" && <ConfigBuckets/>}
      </div>
    </div>
  );
}

function ConfigUsers() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.__VP_SB.sb.from('usuarios').select('*').order('name')
      .then(({ data }) => { setUsers(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  return (
    <Card title="Usuários" sub={`${users.length} cadastrados`}
      action={<Button variant="primary" size="sm" icon="plus" onClick={() => window.open('mailto:ti@verticalparts.com.br?subject=Novo%20usuário%20VP%20PRD&body=Solicito%20acesso%20para:', '_blank')}>Convidar usuário</Button>}>
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t">
          <thead><tr>
            <th>Nome</th><th>Perfil</th><th>Email</th><th>Último login</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum usuário cadastrado.
              </td></tr>
            )}
            {users.map(u => (
              <tr key={u.id || u.email}>
                <td>
                  <div className="row gap-3">
                    <div className="avatar">{(u.name || u.email || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
                    <span className="cell-main">{u.name || u.email}</span>
                  </div>
                </td>
                <td><Badge variant="ink">{u.role || "—"}</Badge></td>
                <td><span className="mono small">{u.email}</span></td>
                <td><span className="mono small muted">{u.last_login ? fmtDate(u.last_login) : "—"}</span></td>
                <td><Badge variant={u.active !== false ? "success" : "neutral"} dot>{u.active !== false ? "Ativo" : "Inativo"}</Badge></td>
                <td><Button variant="ghost" size="sm" icon="more"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ConfigPermissions() {
  const modules = ["Leads", "Cotações", "Precificação", "Propostas", "Jurídico", "Engenharia", "Financeiro", "Importação", "Compras", "Instalação", "Comissões"];
  const perms = [
    { role: "Admin", access: modules.map(() => "rwx") },
    { role: "Comercial Sr.", access: ["rwx", "rwx", "rwx", "rwx", "r", "r", "r", "r", "r", "r", "r"] },
    { role: "Comercial Pleno", access: ["rwx", "rwx", "r", "rwx", "r", "r", "-", "r", "r", "r", "-"] },
    { role: "Engenharia", access: ["r", "r", "r", "r", "r", "rwx", "-", "rwx", "rwx", "rwx", "-"] },
    { role: "Jurídico", access: ["r", "r", "-", "r", "rwx", "r", "r", "r", "r", "r", "-"] },
    { role: "Financeiro", access: ["r", "r", "rwx", "r", "r", "r", "rwx", "rwx", "rwx", "r", "rwx"] },
    { role: "Instalação", access: ["-", "-", "-", "-", "-", "r", "-", "r", "r", "rwx", "-"] },
  ];
  return (
    <Card title="Matriz de Permissões (RLS Supabase)" sub="r=leitura · w=criar/editar · x=ações restritas">
      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ minWidth: 880 }}>
          <thead><tr>
            <th style={{ position: "sticky", left: 0, background: "var(--vp-gray-50)", zIndex: 2 }}>Perfil</th>
            {modules.map(m => <th key={m} style={{ textAlign: "center" }}>{m}</th>)}
          </tr></thead>
          <tbody>
            {perms.map(p => (
              <tr key={p.role}>
                <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, fontWeight: 700 }}>{p.role}</td>
                {p.access.map((a, i) => (
                  <td key={i} style={{ textAlign: "center" }}>
                    <PermCell value={a}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PermCell({ value }) {
  if (value === "-") return <span style={{ color: "var(--vp-gray-300)" }}>—</span>;
  const color = value === "rwx" ? "var(--vp-success)" : value === "rw" ? "var(--vp-info)" : value === "r" ? "var(--vp-gray-400)" : "var(--vp-warning)";
  const bg = value === "rwx" ? "var(--vp-success-tint)" : value === "r" ? "var(--vp-gray-100)" : "var(--vp-warning-tint)";
  return <span style={{ display: "inline-block", padding: "2px 8px", background: bg, color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 10, letterSpacing: ".1em" }}>{value.toUpperCase()}</span>;
}

function ConfigParams() {
  return (
    <div className="grid-2" style={{ gap: 16 }}>
      <Card title="Parâmetros Financeiros" sharp>
        <div className="stack">
          <ParamRow label="Câmbio USD → BRL (manual)" value="R$ 5,18" mono/>
          <ParamRow label="Margem mínima projeto" value="22%" mono/>
          <ParamRow label="Margem padrão" value="32%" mono/>
          <ParamRow label="Comissão padrão vendedor" value="4%" mono/>
          <ParamRow label="ICMS padrão (SP)" value="18%" mono/>
          <ParamRow label="II padrão equipamentos" value="14%" mono/>
        </div>
      </Card>
      <Card title="Parâmetros Operacionais" sharp>
        <div className="stack">
          <ParamRow label="SLA visita técnica" value="5 dias úteis"/>
          <ParamRow label="SLA laudo engenharia" value="4 dias úteis"/>
          <ParamRow label="Tempo médio importação" value="55 dias"/>
          <ParamRow label="Validade padrão proposta" value="30 dias"/>
          <ParamRow label="Garantia padrão" value="24 meses fab + 12 meses serv."/>
          <ParamRow label="Reten. inst. (calendário)" value="1 obra/equipe simultânea"/>
        </div>
      </Card>
    </div>
  );
}

function ParamRow({ label, value, mono }) {
  return (
    <div className="row sb" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--fg2)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : "inherit", fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  );
}

function ConfigIntegrations() {
  const integrations = [
    { name: "MarineTraffic API", status: "Ativo", last: "—", desc: "Rastreamento de navios em tempo real" },
    { name: "VesselFinder (fallback)", status: "Standby", last: "—", desc: "API secundária de rastreamento" },
    { name: "IMAP — cotacoes@verticalparts.com.br", status: "Ativo", last: "—", desc: "Inbox Importação" },
    { name: "IMAP — compras@verticalparts.com.br", status: "Ativo", last: "—", desc: "Inbox Compras Nacional" },
    { name: "SMTP — envio transacional", status: "Ativo", last: "—", desc: "Notificações e propostas" },
    { name: "DocuSign", status: "Ativo", last: "—", desc: "Assinatura digital de contratos" },
    { name: "ContaAzul (faturamento)", status: "Ativo", last: "—", desc: "Sincronização NF / contas a receber" },
    { name: "WhatsApp Business API", status: "Inativo", last: "—", desc: "Notificações para vendedores" },
  ];
  return (
    <Card title="Integrações Externas" sub={integrations.length + " serviços conectados"}>
      <div className="grid-2" style={{ gap: 12 }}>
        {integrations.map((i) => (
          <div key={i.name} style={{ padding: 14, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: i.status === "Ativo" ? "var(--vp-success-tint)" : i.status === "Standby" ? "var(--vp-warning-tint)" : "var(--vp-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", color: i.status === "Ativo" ? "var(--vp-success)" : i.status === "Standby" ? "var(--vp-warning-ink)" : "var(--fg3)" }}>
              {React.createElement(Icon.globe, { size: 18 })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row sb">
                <span style={{ fontWeight: 700, fontSize: 13 }}>{i.name}</span>
                <Badge variant={i.status === "Ativo" ? "success" : i.status === "Standby" ? "warning" : "neutral"} dot>{i.status}</Badge>
              </div>
              <div className="cell-sub" style={{ marginTop: 2 }}>{i.desc}</div>
              <div className="row sb mono small" style={{ marginTop: 4, color: "var(--fg3)" }}>
                <span>Última sync: {i.last}</span>
                <Button variant="ghost" size="sm" icon="settings"/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConfigBuckets() {
  const buckets = [
    { name: "contratos-originais", policy: "Privado · só Jurídico" },
    { name: "contratos-redigidos", policy: "Privado · vendedor+cliente" },
    { name: "propostas-pdf", policy: "Privado · vendedor" },
    { name: "engenharia-fotos", policy: "Privado · engenharia+admin" },
    { name: "embarques-docs", policy: "Privado · log+adm" },
    { name: "obras-laudos", policy: "Privado · cliente final" },
  ];
  return (
    <Card title="Supabase Storage Buckets" sub={`${buckets.length} buckets configurados`}>
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t">
          <thead><tr><th>Bucket</th><th>Arquivos</th><th>Tamanho</th><th>Política</th><th></th></tr></thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.name}>
                <td><span className="mono" style={{ fontWeight: 700 }}>{b.name}</span></td>
                <td className="cell-num muted">—</td>
                <td className="cell-num muted">—</td>
                <td><Badge variant="outline">{b.policy}</Badge></td>
                <td><Button variant="ghost" size="sm" icon="more"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

Object.assign(window, { FinanceiroPage, ComissoesPage, NotificacoesPage, ConfiguracoesPage });
