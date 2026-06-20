/* ============================================================
   app.jsx — Main app: routing, role, tweaks, mount
   ============================================================ */

/* Títulos por rota — atualiza document.title ao navegar */
const ROUTE_TITLE = {
  dashboard: "Dashboard",
  leads: "Pipeline de Leads",
  "lead-detail": "Detalhe de Lead",
  "dossier-obra": "Dossier da Obra",
  cotacoes: "Cotações China",
  "cotacao-detail": "Detalhe de Cotação",
  precificacao: "Precificação",
  propostas: "Propostas Comerciais",
  "proposta-editor": "Editor de Proposta",
  engenharia: "Projetos de Engenharia",
  "ncm-catalogo": "Catálogo de Produtos",
  "eng-configurador": "Projeto de Equipamento",
  "desenho-tecnico": "Desenho Técnico ER | ES",
  "ficha-tecnica": "Ficha Técnica",
  juridico: "Contratos & Minutas",
  "contrato-editor": "Editor de Contrato",
  "contrato-venda-equipamentos": "Contrato Venda de Equipamentos",
  "contrato-instalador": "Contrato Instalador",
  vistorias: "Vistorias de Obras",
  instalacao: "Instalação em Campo",
  art: "ART de Instalação",
  cronograma: "Cronograma de Instalação",
  databook: "Data Book & Termo",
  importacao: "Importação",
  "importacao-detail": "Detalhe de Embarque",
  "importacao-rastreamento": "Rastreamento de Navios",
  "importacao-email": "Inbox Importação",
  compras: "Compras Nacional",
  "compras-email": "Inbox Compras",
  financeiro: "Gatilhos & Prazo Reverso",
  comissoes: "Comissões",
  notificacoes: "Notificações",
  logs: "Logs de Atividade",
  configuracoes: "Configurações",
};

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

function EmConstrucaoPage({ titulo, descricao }) {
  return (
    <div style={{ padding: 32, maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: "var(--vp-gray-500, #888)", lineHeight: 1.5 }}>{descricao}</div>
    </div>
  );
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

  // Atualiza document.title ao mudar de rota
  React.useEffect(() => {
    const label = ROUTE_TITLE[route];
    document.title = label ? label + " · VP Gestão" : "VP Gestão · VerticalParts";
  }, [route]);

  // AuthZ — impede acesso a rotas restritas independente de como a navegação ocorreu
  const RESTRICTED = {
    precificacao: ["financeiro", "admin"],
    financeiro: ["financeiro", "admin"],
    comissoes: ["financeiro", "admin"],
    logs: ["admin"],
    configuracoes: ["admin"],
  };
  React.useEffect(() => {
    if (RESTRICTED[route] && !RESTRICTED[route].includes(role)) {
      setRoute("dashboard");
    }
  }, [role, route]); // react em mudança de role E de rota

  const renderPage = () => {
    switch (route) {
      case "dashboard": return <Dashboard role={role} setRoute={setRoute}/>;
      case "leads": return <LeadsPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "lead-detail": return <LeadDetail lead={subsel} setRoute={setRoute}/>;
      case "dossier-obra": return <DossierObraPage dossierId={subsel} setRoute={setRoute}/>;
      case "cotacoes": return <CotacoesPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "cotacao-detail": return <CotacaoDetail cot={subsel} setRoute={setRoute}/>;
      case "precificacao": return <PrecificacaoPage setRoute={setRoute}/>;
      case "propostas": return <PropostasPage setRoute={setRoute}/>;
      case "proposta-editor": return <PropostaEditor setRoute={setRoute}/>;
      case "engenharia": return <EngenhariaPage setRoute={setRoute}/>;
      case "ncm-catalogo": return <NcmCatalogoPage setRoute={setRoute}/>;
      case "eng-configurador": return <ConfiguradorPage setRoute={setRoute}/>;
      case "desenho-tecnico": return <DesenhoTecnicoPage setRoute={setRoute}/>;
      case "ficha-tecnica": return <FichaTecnicaPage/>;
      case "juridico": return <JuridicoPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "contrato-editor": return <ContratoEditorPage contrato={subsel} setRoute={setRoute} onSaved={() => {}} />;
      case "contrato-venda-equipamentos": return <ContratoVendaEquipamentosPage/>;
      case "contrato-instalador": return <ContratoInstaladorPage/>;
      case "vistorias": return <VistoriasObras obraId={subsel} setRoute={setRoute}/>;
      case "instalacao": return <InstalacaoPage/>;
      case "art": return <ArtPage/>;
      case "cronograma": return <CronogramaPage/>;
      case "databook": return <DataBookPage/>;
      case "handover": return <window.HandoverManutencaoPage/>;
      case "importacao": return <ImportacaoPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "importacao-detail": return <ImportacaoDetail embarque={subsel} setRoute={setRoute}/>;
      case "importacao-rastreamento": return <ImportacaoRastreamento setRoute={setRoute}/>;
      case "importacao-email": return <EmailInbox kind="importacao" setRoute={setRoute}/>;
      case "compras": return <ComprasPage setRoute={setRoute}/>;
      case "compras-email": return <EmailInbox kind="compras" setRoute={setRoute}/>;
      case "financeiro": return <FinanceiroPage/>;
      case "comissoes": return <ComissoesPage/>;
      case "rh-homologacao": return <window.RHHomologacaoPage/>;
      case "notificacoes": return <NotificacoesPage setRoute={setRoute}/>;
      case "logs": return <LogsAdminPage/>;
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

      {/* Copiloto VP — bolinha global. Na Ficha Técnica o especialista de NCM (FtCopiloto) já é dono da tela. */}
      {route !== "ficha-tecnica" && window.VpCopiloto && <window.VpCopiloto route={route} role={role}/>}

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
              { value: "dossier-obra", label: "🏗 Dossier da Obra" },
              { value: "cotacoes", label: "Cotações China" },
              { value: "cotacao-detail", label: "Detalhe de Cotação" },
              { value: "precificacao", label: "Precificação (calc)" },
              { value: "propostas", label: "Propostas (wizard)" },
              { value: "proposta-editor", label: "📝 Editor de Proposta (3 eq.)" },
              { value: "engenharia", label: "Engenharia + Laudo" },
              { value: "ncm-catalogo", label: "📋 Catálogo de Produtos" },
              { value: "eng-configurador", label: "🛠 Projeto de Equipamento" },
              { value: "desenho-tecnico", label: "📐 Desenho Técnico ER | ES" },
              { value: "ficha-tecnica", label: "📋 Ficha Técnica" },
              { value: "juridico", label: "Jurídico (✂️ redator)" },
              { value: "contrato-venda-equipamentos", label: "📄 Contrato Venda de Equipamentos" },
              { value: "contrato-instalador", label: "👷 Contrato Instalador" },
              { value: "instalacao", label: "Instalação + Checklist" },
              { value: "art", label: "ART de Instalação" },
              { value: "cronograma", label: "Cronograma de Instalação" },
              { value: "databook", label: "Data Book & Termo" },
              { value: "handover", label: "📦 Handover & Pós-venda" },
              { value: "importacao", label: "Importação (lista)" },
              { value: "importacao-detail", label: "Detalhe de Embarque" },
              { value: "importacao-rastreamento", label: "🛰️ Mapa de Navios" },
              { value: "importacao-email", label: "📧 Inbox Importação" },
              { value: "compras", label: "Compras Nacional" },
              { value: "compras-email", label: "📧 Inbox Compras" },
              { value: "financeiro", label: "⏰ Prazo Reverso" },
              { value: "comissoes", label: "Comissões" },
              { value: "rh-homologacao", label: "👥 Homologação de Parceiros" },
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

// Timeout de emergência: se tudo ficar travado, força o app a renderizar
setTimeout(() => {
  if (!document.getElementById('root').innerHTML) {
    const boot = document.getElementById('vp-boot');
    if (boot) boot.remove();
    document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;"><h1>⚠️ Timeout ao carregar</h1><p>O app está demorando. Recarregando...</p></div>';
    setTimeout(() => { window.location.reload(); }, 2000);
  }
}, 5000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);
