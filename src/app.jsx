/* ============================================================
   app.jsx — Main app: routing, role, tweaks, mount
   ============================================================ */

/* Títulos por rota — atualiza document.title ao navegar */
const ROUTE_TITLE = {
  dashboard: "Dashboard",
  leads: "Pipeline de Leads",
  "lead-detail": "Detalhe de Lead",
  formularios: "Formulários",
  "dossier-obra": "Dossier da Obra",
  "status-obras": "Status de Obras",
  "formulario-elevador": "Formulário — Elevador",
  "controle-cotacoes": "Controle de Cotações",
  "cotacoes-fornecedor": "Cotações a Fornecedor",
  "cotacao-fornecedor-detail": "Detalhe de Cotação a Fornecedor",
  precificacao: "Precificação",
  propostas: "Propostas Comerciais",
  "proposta-editor": "Editor de Proposta",
  engenharia: "Projetos de Engenharia",
  "ncm-catalogo": "Catálogo de Produtos",
  "ncm-kanban": "Solicitações NCM",
  "ncm-detail": "Detalhe da Solicitação NCM",
  "eng-projeto-elevadores": "Projeto de Elevadores",
  "eng-configurador": "Projeto de Equipamento",
  "desenho-tecnico": "Desenho Técnico ER | ES",
  "ficha-tecnica": "Ficha Técnica",
  juridico: "Contratos & Minutas",
  "contrato-editor": "Editor de Contrato",
  "contrato-venda-equipamentos": "Contrato Venda de Equipamentos",
  "contrato-instalador": "Contrato Instalador",
  vistorias: "Vistorias de Obras",
  instalacao: "Instalação em Campo",
  "central-documentos": "Central de Documentos",
  art: "ART de Instalação",
  cronograma: "Cronograma de Instalação",
  databook: "Data Book & Termo",
  handover: "Entrega Final",
  "rh-homologacao": "Homologação de Instaladores",
  "cadastro-instaladores": "Empresas Instaladoras",
  importacao: "Importação",
  "importacao-detail": "Detalhe de Embarque",
  "importacao-rastreamento": "Rastreamento de Navios",
  "importacao-email": "Inbox Importação",
  compras: "Compras Nacional",
  "compras-email": "Inbox Compras",
  financeiro: "Gatilhos & Prazo",
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

/* ---- Roteamento por URL — Fase 2 (issue #280): deep link real por ID ----
   Três formas como uma rota de detalhe recebe seu registro via `subsel`:

   1. SYNC_PASSTHROUGH_ROUTES — subsel É o id (string), e o componente já
      sabia buscar por conta própria antes desta Fase existir (dossier-obra,
      vistorias) ou aprende a fazer isso só de receber o id (formulario-
      elevador, via FormularioElevadorStore.obter — nenhuma mudança de
      componente precisou ser feita).
   2. WRAPPED_ID_KEY — subsel é um objeto-envelope com o id numa chave
      conhecida (proposta-editor usa `{__editId}`, convenção que o próprio
      editor já lia pra herdar proposta existente).
   3. ASYNC_FETCH_ROUTES — subsel é o registro inteiro, sem suporte a id
      solto no componente; app.jsx busca no Supabase e só then popula
      subsel (renderPage mostra "Carregando…" enquanto isso). */
const SYNC_PASSTHROUGH_ROUTES = new Set(["dossier-obra", "vistorias", "formulario-elevador", "central-documentos"]);
const WRAPPED_ID_KEY = { "proposta-editor": "__editId" };

/* Cada fetcher recebe o id da URL e resolve pro registro (ou null se não
   encontrado) — nunca rejeita, pra sempre cair no fallback em vez de
   quebrar a tela. */
const ASYNC_FETCH_ROUTES = {
  "lead-detail": (id) => window.__VP_SB.sb.from("leads").select("*").eq("id", id).maybeSingle()
    .then((r) => r.data || null).catch(() => null),
  "cotacao-fornecedor-detail": (id) => window.CotacaoElevadorFornecedorStore
    ? window.CotacaoElevadorFornecedorStore.getById(id).catch(() => null)
    : Promise.resolve(null),
  "contrato-editor": (id) => window.__VP_SB.sb.from("contratos_venda_equipamentos").select("*").eq("id", id).maybeSingle()
    .then((r) => r.data || null).catch(() => null),
  "importacao-detail": (id) => window.__VP_SB.sb.from("embarques").select("*").eq("id", id).maybeSingle()
    .then((r) => r.data || null).catch(() => null),
  // `ncm_solicitacoes` foi dropada (issue #273) e recriada depois (achado
  // "Urgente #1" da auditoria de código) — NcmDetailPage espera o registro
  // dentro de `{ ncmProduct }`, mesma forma que NcmKanbanPage já usa em
  // setSubsel({ ncmProduct: s }), então o fetcher embrulha aqui.
  "ncm-detail": (id) => window.__VP_SB.sb.from("ncm_solicitacoes").select("*").eq("id", id).maybeSingle()
    .then((r) => (r.data ? { ncmProduct: r.data } : null)).catch(() => null),
};

/* Pra onde cair quando não dá pra montar a tela de detalhe: id ausente na
   URL, registro não encontrado, ou fetch com erro. */
const SUBSEL_FALLBACK_ROUTE = {
  "lead-detail": "leads",
  "cotacao-fornecedor-detail": "cotacoes-fornecedor",
  "contrato-editor": "juridico",
  "ncm-detail": "ncm-kanban",
  "importacao-detail": "importacao",
};

function deriveIdForRoute(route, subsel) {
  if (subsel == null) return null;
  if (typeof subsel === "string" || typeof subsel === "number") return subsel;
  if (WRAPPED_ID_KEY[route]) return subsel[WRAPPED_ID_KEY[route]] != null ? subsel[WRAPPED_ID_KEY[route]] : null;
  if (route === "ncm-detail") return subsel.ncmProduct && subsel.ncmProduct.id;
  return subsel.id != null ? subsel.id : null;
}

/* Traduz { route, id } (vindo da URL, no mount ou de um popstate) pro trio
   que o App precisa: rota final a renderizar, subsel pronto pra usar (ou
   null) e um id pendente de fetch (ou null). Usada nos dois pontos onde
   uma navegação "de fora" chega — nunca duplica a decisão. */
function resolveIncomingLocation(loc) {
  const r = loc && loc.route;
  const id = loc && loc.id;
  if (!r) return { route: null, subsel: null, pendingFetchId: null };
  if (SYNC_PASSTHROUGH_ROUTES.has(r)) return { route: r, subsel: id, pendingFetchId: null };
  if (WRAPPED_ID_KEY[r]) return { route: r, subsel: id ? { [WRAPPED_ID_KEY[r]]: id } : null, pendingFetchId: null };
  if (ASYNC_FETCH_ROUTES[r] && id) return { route: r, subsel: null, pendingFetchId: id };
  if (SUBSEL_FALLBACK_ROUTE[r]) return { route: SUBSEL_FALLBACK_ROUTE[r], subsel: null, pendingFetchId: null };
  return { route: r, subsel: null, pendingFetchId: null };
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

  // Estado inicial: URL manda, se tiver uma rota reconhecível (deep link,
  // refresh); senão cai no localStorage de sempre (comportamento antigo,
  // preservado durante a transição).
  const initialLoc = (window.VpRouter && window.VpRouter.parseLocation()) || { route: null, id: null };
  const initialResolved = resolveIncomingLocation(initialLoc);

  const [role, setRole] = React.useState(() => readLS("role", t.initialRole));
  const [route, setRoute] = React.useState(() => initialResolved.route || readLS("route", t.initialRoute));
  // Auto-collapse below 1024px
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
    return readLS("sidebarCollapsed", t.sidebarCollapsed);
  });
  const [subsel, setSubsel] = React.useState(() => initialResolved.route ? initialResolved.subsel : null);
  // Id ainda sendo buscado no Supabase pra uma ASYNC_FETCH_ROUTE — enquanto
  // não resolve, `subsel` continua null e renderPage mostra "Carregando…"
  // em vez de tentar montar a tela de detalhe sem dado nenhum.
  const [pendingFetchId, setPendingFetchId] = React.useState(() => initialResolved.route ? initialResolved.pendingFetchId : null);

  // Persist navigation state
  React.useEffect(() => writeLS("role", role), [role]);
  React.useEffect(() => writeLS("route", route), [route]);
  React.useEffect(() => writeLS("sidebarCollapsed", collapsed), [collapsed]);

  // Espelha route/subsel na URL (pushState) e escuta voltar/avançar do
  // navegador (popstate). Sem-op se a URL já bate com o estado atual —
  // evita loop entre este effect e o handler de popstate abaixo. Usa
  // pendingFetchId como id quando subsel ainda não chegou, pra não perder
  // o link original da barra de endereço enquanto o fetch está em voo.
  React.useEffect(() => {
    if (!window.VpRouter) return;
    const id = deriveIdForRoute(route, subsel);
    window.VpRouter.navigate(route, id != null ? id : pendingFetchId);
  }, [route, subsel, pendingFetchId]);

  React.useEffect(() => {
    if (!window.VpRouter) return;
    return window.VpRouter.subscribe((loc) => {
      if (!loc.route) return;
      const resolved = resolveIncomingLocation(loc);
      setSubsel(resolved.subsel);
      setPendingFetchId(resolved.pendingFetchId);
      setRoute(resolved.route);
    });
  }, []);

  // Busca de verdade das ASYNC_FETCH_ROUTES — dispara sempre que há um id
  // pendente pra rota atual (mount com deep link, ou popstate landing numa
  // dessas rotas). Nunca deixa a tela quebrada: sem resultado ou com erro,
  // cai na rota de lista correspondente.
  React.useEffect(() => {
    if (!pendingFetchId) return;
    const loader = ASYNC_FETCH_ROUTES[route];
    if (!loader) { setPendingFetchId(null); return; }
    let vivo = true;
    loader(pendingFetchId).then((registro) => {
      if (!vivo) return;
      setPendingFetchId(null);
      if (registro) { setSubsel(registro); return; }
      window.toast?.("Registro não encontrado.", "warning");
      setRoute(SUBSEL_FALLBACK_ROUTE[route] || "dashboard");
    }).catch(() => {
      if (!vivo) return;
      setPendingFetchId(null);
      window.toast?.("Erro ao carregar o registro.", "error");
      setRoute(SUBSEL_FALLBACK_ROUTE[route] || "dashboard");
    });
    return () => { vivo = false; };
  }, [route, pendingFetchId]);

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
    "aval-financeiro": ["financeiro", "admin"],
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
    // Deep link numa ASYNC_FETCH_ROUTE ainda buscando o registro no
    // Supabase — subsel só chega quando o fetch (effect acima) resolver.
    if (pendingFetchId && ASYNC_FETCH_ROUTES[route]) {
      return <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div>;
    }
    switch (route) {
      case "dashboard": return <Dashboard role={role} setRoute={setRoute} setSubsel={setSubsel}/>;
      case "leads": return <LeadsPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "lead-detail": return <LeadDetail lead={subsel} setRoute={setRoute} setSubsel={setSubsel}/>;
      case "formularios": return <FormulariosPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "formulario-elevador": return <FormularioElevadorPage setRoute={setRoute} subsel={subsel}/>;
      case "controle-cotacoes": return <ControleCotacoesPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "dossier-obra": return <DossierObraPage dossierId={subsel} setRoute={setRoute}/>;
      case "status-obras": return <ObrasStatusPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "linha-do-tempo": return <window.LinhaDoTempoPage/>;
      case "cotacoes-fornecedor": return <CotacoesFornecedorPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "cotacao-fornecedor-detail": return <CotacaoFornecedorDetalhe cot={subsel} setRoute={setRoute}/>;
      case "precificacao": return <PrecificacaoPage setRoute={setRoute} setSubsel={setSubsel} subsel={subsel}/>;
      case "propostas": return <PropostasPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "proposta-editor": return <PropostaEditor setRoute={setRoute} subsel={subsel}/>;
      case "engenharia": return <EngenhariaPage setRoute={setRoute}/>;
      case "ncm-catalogo": return <NcmCatalogoPage setRoute={setRoute}/>;
      case "ncm-kanban": return <NcmKanbanPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "ncm-detail": return <NcmDetailPage product={subsel?.ncmProduct} setRoute={setRoute}/>;
      case "eng-projeto-elevadores": return <window.ProjetoElevadorPage setRoute={setRoute}/>;
      case "eng-configurador": return <ConfiguradorPage setRoute={setRoute}/>;
      case "desenho-tecnico": return <DesenhoTecnicoPage setRoute={setRoute}/>;
      case "ficha-tecnica": return <FichaTecnicaPage/>;
      case "juridico": return <JuridicoPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "contrato-editor": return <ContratoEditorPage contrato={subsel} setRoute={setRoute} onSaved={() => {}} />;
      case "contrato-venda-equipamentos": return <ContratoVendaEquipamentosPage/>;
      case "contrato-instalador": return <ContratoInstaladorPage/>;
      case "vistorias": return <VistoriasObras obraId={subsel} setRoute={setRoute}/>;
      case "instalacao": return <InstalacaoPage/>;
      case "central-documentos": return <window.CentralDocumentosPage setRoute={setRoute} setSubsel={setSubsel} subsel={subsel}/>;
      case "art": return <ArtPage setRoute={setRoute}/>;
      case "cronograma": return <CronogramaPage/>;
      case "databook": return <DataBookPage setRoute={setRoute}/>;
      case "handover": return <window.HandoverManutencaoPage/>;
      case "importacao": return <ImportacaoPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "importacao-detail": return <ImportacaoDetail embarque={subsel} setRoute={setRoute}/>;
      case "importacao-rastreamento": return <ImportacaoRastreamento setRoute={setRoute}/>;
      case "importacao-email": return <EmailInbox kind="importacao" setRoute={setRoute}/>;
      case "compras": return <ComprasPage setRoute={setRoute}/>;
      case "compras-email": return <EmailInbox kind="compras" setRoute={setRoute}/>;
      case "financeiro": return <FinanceiroPage setRoute={setRoute} setSubsel={setSubsel}/>;
      case "aval-financeiro": return <window.AvalFinanceiroPage setRoute={setRoute}/>;
      case "comissoes": return <ComissoesPage/>;
      case "rh-homologacao": return <window.RHHomologacaoPage/>;
      case "cadastro-instaladores": return <window.CadastroInstaladoresPage/>;
      case "notificacoes": return <NotificacoesPage setRoute={setRoute}/>;
      case "decisoes": return <window.DecisoesPage/>;
      case "almoxarifado": return <window.AlmoxarifadoPage/>;
      case "pi-importacao": return <window.PIPage/>;
      case "rfq-importacao": return <window.RFQPage/>;
      case "ims-importacao": return <window.IMSPage/>;
      case "embarques-importacao": return <window.EmbarquesImportacaoPage/>;
      case "gi-painel": return <window.GIPainelPage/>;
      case "gi-analise-precos": return <window.GIAnalisePrecosPage/>;
      case "pedidos-acompanhamento": return <window.PedidosAcompanhamentoPage/>;
      case "cadastro-clientes": return <window.CadastroClientesPage/>;
      case "cadastro-fornecedores": return <window.CadastroFornecedoresPage/>;
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
      <Header route={route} role={role} setRole={setRole} onSearch={(r) => setRoute(r)} onNavigate={(r, sub) => { setSubsel(sub ?? null); setRoute(r); }}/>
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
              { value: "cotacoes-fornecedor", label: "Cotações a Fornecedor" },
              { value: "cotacao-fornecedor-detail", label: "Detalhe de Cotação a Fornecedor" },
              { value: "precificacao", label: "Precificação (calc)" },
              { value: "propostas", label: "Propostas (wizard)" },
              { value: "proposta-editor", label: "📝 Editor de Proposta (3 eq.)" },
              { value: "engenharia", label: "Engenharia + Laudo" },
              { value: "ncm-catalogo", label: "📋 Catálogo de Produtos" },
              { value: "eng-projeto-elevadores", label: "🛗 Projeto de Elevadores" },
              { value: "eng-configurador", label: "🛠 Projeto de Equipamento" },
              { value: "desenho-tecnico", label: "📐 Desenho Técnico ER | ES" },
              { value: "ficha-tecnica", label: "📋 Ficha Técnica" },
              { value: "juridico", label: "Jurídico (✂️ redator)" },
              { value: "contrato-venda-equipamentos", label: "📄 Contrato Venda de Equipamentos" },
              { value: "contrato-instalador", label: "👷 Contrato Instalador" },
              { value: "instalacao", label: "Instalação + Checklist" },
              { value: "central-documentos", label: "📁 Central de Documentos" },
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
              { value: "financeiro", label: "⏰ Gatilhos & Prazo" },
              { value: "comissoes", label: "Comissões" },
              { value: "rh-homologacao", label: "👥 Homologação de Instaladores" },
              { value: "cadastro-instaladores", label: "🏢 Empresas Instaladoras" },
              { value: "notificacoes", label: "🔔 Notificações" },
              { value: "configuracoes", label: "Configurações" },
            ]}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// Mantém o vídeo de abertura na tela até ele terminar (ou 12s, o que vier
// primeiro) — dá tempo do usuário ver a marca mesmo quando o carregamento
// real (CDNs + Babel) é rápido. Erro no vídeo nunca trava o usuário aqui.
const bootEl = document.getElementById('vp-boot');
const bootVideo = document.getElementById('vp-boot-video');
function removeBoot() {
  if (bootEl && bootEl.parentNode) bootEl.remove();
}
if (bootVideo) {
  bootVideo.addEventListener('ended', removeBoot);
  bootVideo.addEventListener('error', removeBoot);
  setTimeout(removeBoot, 12000);
} else {
  removeBoot();
}

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