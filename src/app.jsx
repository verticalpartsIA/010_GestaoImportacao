/* ============================================================
   app.jsx — Main app: routing, role, tweaks, mount
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "sidebarCollapsed": false,
  "initialRole": "admin",
  "initialRoute": "dashboard"
}/*EDITMODE-END*/;

// ---- Error Boundary — captura erros de render e mostra mensagem amigável ----
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { this.setState({ error: err, info: info }); }
  render() {
    if (this.state.error) {
      const stack = this.state.info && this.state.info.componentStack
        ? this.state.info.componentStack.trim().split('\n').slice(0, 6).join('\n')
        : '';
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, fontFamily: 'sans-serif' }}>Erro ao carregar o VP Gestão</div>
          <div style={{ fontSize: 12, color: '#c00', marginBottom: 16, wordBreak: 'break-all' }}>{String(this.state.error)}</div>
          {stack ? (
            <pre style={{ fontSize: 10, color: '#666', background: '#f5f5f5', padding: 12, borderRadius: 4, overflowX: 'auto', marginBottom: 20, whiteSpace: 'pre-wrap' }}>{stack}</pre>
          ) : null}
          <button onClick={() => { localStorage.removeItem('vpprd.role'); localStorage.removeItem('vpprd.route'); window.location.reload(); }}
            style={{ padding: '8px 20px', background: '#f5c400', border: 'none', fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>
            Limpar cache e recarregar
          </button>
          <button onClick={() => window.location.reload()}
            style={{ padding: '8px 20px', background: '#eee', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            Só recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- Restore from localStorage on mount ----
  const readLS = (k, fallback) => {
    try { const v = localStorage.getItem("vpprd." + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  };
  const writeLS = (k, v) => {
    try { localStorage.setItem("vpprd." + k, JSON.stringify(v)); } catch (e) {}
  };

  const [role, setRole] = React.useState(() => readLS("role", t.initialRole));
  const [route, setRoute] = React.useState(() => readLS("route", t.initialRoute));
  // Auto-collapse below 1024px
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
    return readLS("sidebarCollapsed", t.sidebarCollapsed);
  });
  const [subsel, setSubsel] = React.useState(null);

  // Persist navigation state
  React.useEffect(() => writeLS("role", role), [role]);
  React.useEffect(() => writeLS("route", route), [route]);
  React.useEffect(() => writeLS("sidebarCollapsed", collapsed), [collapsed]);

  // Auto-collapse on resize
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024 && !collapsed) setCollapsed(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed]);

  // sync density to body data attr
  React.useEffect(() => {
    document.body.dataset.density = t.density;
  }, [t.density]);

  React.useEffect(() => {
    if (t.sidebarCollapsed !== collapsed) setCollapsed(t.sidebarCollapsed);
  }, [t.sidebarCollapsed]);

  // when role changes via dropdown, ensure restricted routes don't show stale
  React.useEffect(() => {
    const restricted = {
      precificacao: ["financeiro", "admin"],
      financeiro: ["financeiro", "admin"],
      comissoes: ["financeiro", "admin"],
      configuracoes: ["admin"],
    };
    if (restricted[route] && !restricted[route].includes(role)) {
      setRoute("dashboard");
    }
  }, [role]);

  const renderPage = () => {
    switch (route) {
      case "dashboard": return <Dashboard role={role} setRoute={setRoute}/>;
      case "leads": return <LeadsPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "lead-detail": return <LeadDetail lead={subsel} setRoute={setRoute}/>;
      case "cotacoes": return <CotacoesPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "cotacao-detail": return <CotacaoDetail cot={subsel} setRoute={setRoute}/>;
      case "precificacao": return <PrecificacaoPage setRoute={setRoute}/>;
      case "propostas": return <PropostasPage setRoute={setRoute}/>;
      case "proposta-editor": return <PropostaEditor setRoute={setRoute}/>;
      case "engenharia": return <EngenhariaPage setRoute={setRoute}/>;
      case "ncm-kanban": return <NcmKanbanPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "ncm-detail": return <NcmDetailPage product={subsel?.ncmProduct} setRoute={setRoute}/>;
      case "ncm-catalogo": return <NcmCatalogoPage setRoute={setRoute}/>;
      case "juridico": return <JuridicoPage setRoute={setRoute}/>;
      case "instalacao": return <InstalacaoPage/>;
      case "importacao": return <ImportacaoPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "importacao-detail": return <ImportacaoDetail embarque={subsel} setRoute={setRoute}/>;
      case "importacao-rastreamento": return <ImportacaoRastreamento setRoute={setRoute}/>;
      case "importacao-email": return <EmailInbox kind="importacao" setRoute={setRoute}/>;
      case "compras": return <ComprasPage setRoute={setRoute}/>;
      case "compras-email": return <EmailInbox kind="compras" setRoute={setRoute}/>;
      case "financeiro": return <FinanceiroPage/>;
      case "comissoes": return <ComissoesPage/>;
      case "notificacoes": return <NotificacoesPage setRoute={setRoute}/>;
      case "configuracoes": return <ConfiguracoesPage/>;
      default: return <Dashboard role={role} setRoute={setRoute}/>;
    }
  };

  return (
    <div className="app" data-sidebar={collapsed ? "collapsed" : "expanded"} data-role={role}>
      <Sidebar route={route} setRoute={(r) => { setRoute(r); setSubsel(null); }}
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}/>
      <Header route={route} role={role} setRole={setRole} onSearch={(r) => setRoute(r)}/>
      <main className="main" key={route}>
        {renderPage()}
      </main>

      <ToastViewport/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Aparência">
          <TweakRadio
            label="Densidade"
            value={t.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "compact", label: "Compacta" },
              { value: "cozy", label: "Confortável" },
              { value: "airy", label: "Arejada" },
            ]}/>
          <TweakToggle
            label="Sidebar colapsada"
            value={collapsed}
            onChange={(v) => { setCollapsed(v); setTweak("sidebarCollapsed", v); }}/>
        </TweakSection>
        <TweakSection label="Perfil ativo">
          <TweakSelect
            label="Perfil"
            value={role}
            onChange={(v) => { setRole(v); setTweak("initialRole", v); }}
            options={[
              { value: "comercial", label: "Comercial" },
              { value: "engenharia", label: "Engenharia" },
              { value: "financeiro", label: "Financeiro" },
              { value: "admin", label: "Admin" },
            ]}/>
        </TweakSection>
        <TweakSection label="Navegação rápida">
          <TweakSelect
            label="Pular para tela"
            value={route}
            onChange={(v) => setRoute(v)}
            options={[
              { value: "dashboard", label: "Dashboard" },
              { value: "leads", label: "Leads" },
              { value: "lead-detail", label: "Detalhe de Lead" },
              { value: "cotacoes", label: "Cotações China" },
              { value: "cotacao-detail", label: "Detalhe de Cotação" },
              { value: "precificacao", label: "Precificação (calc)" },
              { value: "propostas", label: "Propostas (wizard)" },
              { value: "proposta-editor", label: "📝 Editor de Proposta (3 eq.)" },
              { value: "engenharia", label: "Engenharia + Laudo" },
              { value: "ncm-kanban", label: "📦 Solicitações NCM" },
              { value: "ncm-catalogo", label: "📋 Catálogo de Produtos" },
              { value: "juridico", label: "Jurídico (✂️ redator)" },
              { value: "instalacao", label: "Instalação + Checklist" },
              { value: "importacao", label: "Importação (lista)" },
              { value: "importacao-detail", label: "Detalhe de Embarque" },
              { value: "importacao-rastreamento", label: "🛰️ Mapa de Navios" },
              { value: "importacao-email", label: "📧 Inbox Importação" },
              { value: "compras", label: "Compras Nacional" },
              { value: "compras-email", label: "📧 Inbox Compras" },
              { value: "financeiro", label: "⏰ Prazo Reverso" },
              { value: "comissoes", label: "Comissões" },
              { value: "notificacoes", label: "🔔 Notificações" },
              { value: "configuracoes", label: "Configurações" },
            ]}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// Remove o spinner de boot assim que o React estiver pronto
const bootEl = document.getElementById('vp-boot');
if (bootEl) bootEl.remove();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);
