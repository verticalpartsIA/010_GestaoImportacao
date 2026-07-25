/* ============================================================
   print-app.jsx — Tour mode: renders every major screen
   stacked, each one as its own A3-ish print page.
   Used ONLY by index-print.html
   ============================================================ */

const PRINT_SCREENS = [
  { id: "dashboard",      title: "Dashboard",                  module: "Geral",       role: "admin",      sub: "KPIs · Gantt · alertas · pipeline" },
  { id: "leads",          title: "Pipeline de Leads",          module: "Comercial",   role: "comercial",  sub: "128 leads · pipeline R$ 8.9M" },
  { id: "lead-detail",    title: "Detalhe do Lead",            module: "Comercial",   role: "comercial",  sub: "histórico · contato · próximos passos" },
  { id: "cotacoes-fornecedor",       title: "Cotações a Fornecedor",      module: "Comercial",   role: "comercial",  sub: "RFQ técnico · Glarie e próximos fornecedores" },
  { id: "cotacao-fornecedor-detail", title: "Detalhe da Cotação",         module: "Comercial",   role: "comercial",  sub: "resposta do fornecedor · decisão de compra" },
  { id: "precificacao",   title: "Precificação ao Vivo",       module: "Comercial",   role: "admin",      sub: "FOB → impostos → margem · histórico v7" },
  { id: "propostas",      title: "Propostas Comerciais",       module: "Comercial",   role: "comercial",  sub: "wizard 5 etapas · pacote PDF" },
  { id: "proposta-editor", title: "Editor de Proposta",        module: "Comercial",   role: "comercial",  sub: "3 abas · preview ao vivo · capas reais" },
  { id: "engenharia",     title: "Engenharia",                 module: "Operações",   role: "engenharia", sub: "laudo · BOM · vistoria técnica" },
  { id: "juridico",       title: "Jurídico & Contratos",       module: "Operações",   role: "admin",      sub: "redator ✂️ páginas confidenciais" },
  { id: "instalacao",     title: "Instalação em Campo",        module: "Operações",   role: "admin",      sub: "equipes · checklist obra" },
  { id: "importacao",     title: "Importação",                 module: "Logística",   role: "admin",      sub: "embarques · BL · ETA tracking" },
  { id: "importacao-detail", title: "Embarque — Detalhe",      module: "Logística",   role: "admin",      sub: "navio · timeline · documentos" },
  { id: "importacao-rastreamento", title: "Mapa de Navios",    module: "Logística",   role: "admin",      sub: "MarineTraffic API · rota Shanghai → Santos" },
  { id: "importacao-email", title: "Inbox Importação",         module: "Logística",   role: "admin",      sub: "IMAP · BL · invoice · aduana" },
  { id: "compras",        title: "Compras Nacional",           module: "Logística",   role: "admin",      sub: "fretes · ocorrências · CTes" },
  { id: "financeiro",     title: "Gatilhos & Prazo Reverso",   module: "Financeiro",  role: "financeiro", sub: "pagamentos por marcos · chain" },
  { id: "comissoes",      title: "Comissões Q2/26",            module: "Financeiro",  role: "financeiro", sub: "vendedor · % · aprovação · pagamento" },
  { id: "notificacoes",   title: "Central de Notificações",    module: "Geral",       role: "admin",      sub: "estilo Linear · agrupadas" },
  { id: "configuracoes",  title: "Configurações & RLS",        module: "Admin",       role: "admin",      sub: "matriz de permissões · integrações" },
];

/* Mock setRoute/setSubsel for print mode */
function noop() {}

/* Render a single page based on screen id */
/* NOTE: print mode — dados de detalhe passados como null; componentes exibem EmptyStateRedirect */
function renderPrintPage(scr) {
  // TODO: receber dados via props se impressão precisar de registros reais
  switch (scr.id) {
    case "dashboard":      return <Dashboard role={scr.role} setRoute={noop}/>;
    case "leads":          return <LeadsPage setRoute={noop} setSubsel={noop}/>;
    case "lead-detail":    return <LeadDetail lead={null} setRoute={noop}/>;
    case "cotacoes-fornecedor":       return <CotacoesFornecedorPage setRoute={noop} setSubsel={noop}/>;
    case "cotacao-fornecedor-detail": return <CotacaoFornecedorDetalhe cot={null} setRoute={noop}/>;
    case "precificacao":   return <PrecificacaoPage setRoute={noop}/>;
    case "propostas":      return <PropostasPage setRoute={noop}/>;
    case "proposta-editor": return <PropostaEditor setRoute={noop}/>;
    case "engenharia":     return <EngenhariaPage setRoute={noop}/>;
    case "juridico":       return <JuridicoPage setRoute={noop}/>;
    case "instalacao":     return <InstalacaoPage/>;
    case "importacao":     return <ImportacaoPage setRoute={noop} setSubsel={noop}/>;
    case "importacao-detail": return <ImportacaoDetail embarque={null} setRoute={noop}/>;
    case "importacao-rastreamento": return <ImportacaoRastreamento setRoute={noop}/>;
    case "importacao-email": return <EmailInbox kind="importacao" setRoute={noop}/>;
    case "compras":        return <ComprasPage setRoute={noop}/>;
    case "financeiro":     return <FinanceiroPage/>;
    case "comissoes":      return <ComissoesPage/>;
    case "notificacoes":   return <NotificacoesPage setRoute={noop}/>;
    case "configuracoes":  return <ConfiguracoesPage/>;
    default: return null;
  }
}

function PrintHeader({ scr, idx, total }) {
  return (
    <div className="print-page__head">
      <img className="brand" src="assets/logo-verticalparts-white.png" alt="VerticalParts"/>
      <span className="pgnum">{String(idx).padStart(2, "0")}</span>
      <span className="pgnum-total">/ {String(total).padStart(2, "0")}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 8 }}>
        <span className="module-eyebrow">{scr.module}</span>
        <span className="module-title">{scr.title}</span>
      </div>
      <span className="module-sub">{scr.sub}</span>
    </div>
  );
}

function PrintApp() {
  // Inject simulated full-bleed app shell per page (no sidebar, no header)
  const total = PRINT_SCREENS.length;
  return (
    <>
      {/* Cover */}
      <div className="print-cover">
        <div className="print-cover__body">
          <div className="print-cover__brand">
            <img src="assets/logo-mark-yellow.png" alt="" style={{ height: 64 }}/>
            <img src="assets/logo-verticalparts-white.png" alt="VerticalParts" style={{ height: 38 }}/>
          </div>
          <span className="print-cover__eyebrow">▎ Sistema interno · Protótipo Hi-Fi</span>
          <h1 className="print-cover__title">VP Gestão<br/><b>Tour Completo</b></h1>
          <p className="print-cover__sub">
            Sistema interno de gestão da VerticalParts. Cobre o ciclo completo de uma venda
            de elevadores: do lead na recepção do site, passando por cotação na China,
            precificação, proposta, contrato jurídico, importação marítima, fretes nacionais,
            instalação em campo, até o fechamento financeiro e comissionamento.
          </p>
        </div>
        <div className="print-cover__meta">
          <div className="print-cover__meta-item">
            <div className="lbl">Telas</div>
            <div className="val yellow">{total}</div>
          </div>
          <div className="print-cover__meta-item">
            <div className="lbl">Módulos</div>
            <div className="val">14</div>
          </div>
          <div className="print-cover__meta-item">
            <div className="lbl">Perfis (RLS)</div>
            <div className="val">04</div>
          </div>
          <div className="print-cover__meta-item">
            <div className="lbl">Versão</div>
            <div className="val">v2.4</div>
          </div>
        </div>
      </div>

      {/* TOC */}
      <div className="print-toc">
        <div>
          <h1><small>▎ Índice do tour</small>Sumário</h1>
        </div>
        <div className="print-toc__list">
          {PRINT_SCREENS.map((s, i) => (
            <div className="print-toc__item" key={s.id}>
              <span className="print-toc__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="print-toc__name">
                {s.title}
                <small>{s.module} · {s.sub}</small>
              </span>
              <span className="print-toc__pg">pg. {String(i + 3).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
        <div className="print-toc__foot">
          <span>VP Gestão · Sistema interno VerticalParts</span>
          <span>Página 02 / {String(total + 2).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Pages */}
      {PRINT_SCREENS.map((scr, i) => (
        <div className="print-page" key={scr.id} data-role={scr.role}>
          <PrintHeader scr={scr} idx={i + 3} total={total + 2}/>
          <div className="print-page__body">
            {renderPrintPage(scr)}
          </div>
        </div>
      ))}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PrintApp/>);

/* Wait for fonts and a settle delay, then print */
(async () => {
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {}
  await new Promise(r => setTimeout(r, 1500));
  window.print();
})();
