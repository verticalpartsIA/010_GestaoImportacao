/* ============================================================
   shell.jsx — Sidebar + Header + role switcher
   ============================================================ */

/* Ordem segue o workflow operacional: pré-venda → contrato → engenharia →
   importação/logística → instalação & entrega. Financeiro é transversal. */
const NAV_GROUPS = [
  { label: "Geral", items: [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "notificacoes", label: "Notificações", icon: "bell" },
  ]},
  { label: "Comercial", items: [
    { id: "leads", label: "Leads", icon: "flag" },
    { id: "cotacoes", label: "Cotações China", icon: "globe" },
    { id: "precificacao", label: "Precificação", icon: "calculator", restrict: ["financeiro", "admin"] },
  ]},
  { label: "Jurídico", sublabel: "Propostas & Contratos", items: [
    { id: "juridico", label: "Jurídico", icon: "scale" },
    { id: "propostas", label: "Propostas", icon: "proposal" },
    { id: "contrato-venda-equipamentos", label: "Contrato Venda de Equipamentos", icon: "fileText" },
    { id: "contrato-instalador", label: "Contrato Instalador", icon: "hardhat" },
  ]},
  { label: "Engenharia", items: [
    { id: "engenharia", label: "Engenharia", icon: "ruler" },
    { id: "eng-configurador", label: "Projeto de Equipamento", icon: "grid" },
    { id: "desenho-tecnico", label: "Desenho Técnico ER|ES", icon: "ruler" },
    { id: "ficha-tecnica", label: "Ficha Técnica", icon: "fileText" },
    { id: "ncm-catalogo", label: "Catálogo de Produtos", icon: "fileSearch" },
  ]},
  { label: "Logística", items: [
    { id: "importacao", label: "Importação", icon: "ship" },
    { id: "compras", label: "Compras Nacional", icon: "truck" },
  ]},
  { label: "Instalação & Entrega", items: [
    { id: "vistorias", label: "Vistorias de Obras", icon: "search" },
    { id: "instalacao", label: "Instalação em Campo", icon: "hardhat" },
    { id: "art", label: "ART", icon: "scale" },
    { id: "cronograma", label: "Cronograma", icon: "clock" },
    { id: "databook", label: "Data Book & Termo", icon: "fileSearch" },
    { id: "handover", label: "Handover & Pós-venda", icon: "package" },
  ]},
  { label: "Financeiro", items: [
    { id: "financeiro", label: "Gatilhos & Prazo", icon: "dollar", restrict: ["financeiro", "admin"] },
    { id: "comissoes", label: "Comissões", icon: "award", restrict: ["financeiro", "admin"] },
  ]},
  { label: "Recursos Humanos", items: [
    { id: "rh-homologacao", label: "Homologação de Parceiros", icon: "users", restrict: ["admin"] },
  ]},
  { label: "Admin", items: [
    { id: "logs", label: "Logs de Atividade", icon: "history", restrict: ["admin"] },
    { id: "configuracoes", label: "Configurações", icon: "settings", restrict: ["admin"] },
  ]},
];

const ROLE_MAP = {
  comercial:   { name: "Comercial",   initials: "CO", title: "Perfil Comercial" },
  engenharia:  { name: "Engenharia",  initials: "EN", title: "Perfil Engenharia" },
  financeiro:  { name: "Financeiro",  initials: "FI", title: "Perfil Financeiro" },
  admin:       { name: "Admin",       initials: "AD", title: "Perfil Admin" },
};

function Sidebar({ route, setRoute, role, collapsed, onToggle }) {
  const filterVisible = (item) => !item.restrict || item.restrict.includes(role);
  /* Re-renderiza quando a identidade SSO (vpsistema) chega/é confirmada */
  const [, forceUser] = React.useState(0);
  React.useEffect(() => {
    const on = () => forceUser((n) => n + 1);
    window.addEventListener('vpprd:user', on);
    return () => window.removeEventListener('vpprd:user', on);
  }, []);
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="assets/logo-mark-yellow.png" alt="" className="sidebar__brand-mark"/>
        <div className="sidebar__brand-text">VERTICAL<b>PARTS</b></div>
        <div className="sidebar__brand-sub">v2.4</div>
      </div>
      <button className="sidebar__collapse" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? <Icon.chevRight size={12}/> : <Icon.chevLeft size={12}/>}
      </button>
      <div className="sidebar__scroll">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(filterVisible);
          if (!items.length) return null;
          return (
            <div className="sidebar__group" key={group.label}>
              <div className="sidebar__group-label">
                <span>{group.label}</span>
                {group.sublabel ? <span className="sidebar__group-sublabel">{group.sublabel}</span> : null}
              </div>
              {items.map((item) => {
                const Active = React.createElement(Icon[item.icon] || Icon.bolt);
                return (
                  <div key={item.id}
                    className={"nav-item " + (route === item.id ? "is-active" : "")}
                    onClick={() => setRoute(item.id)}
                    data-tooltip={item.label}>
                    <span className="nav-item__icon">{Active}</span>
                    <span className="nav-item__label">{item.label}</span>
                    {item.badge ? <span className="nav-item__badge">{item.badge}</span> : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="sidebar__foot">
        <div className="sidebar__user">
          <div className="avatar">{(window.__VP_USER || {}).iniciais || (ROLE_MAP[role] || {}).initials || "VP"}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{(window.__VP_USER || {}).nome || (ROLE_MAP[role] || {}).name || "VP Gestão"}</div>
            <div className="sidebar__user-role" title={(window.__VP_USER || {}).email || ""}>
              {(window.__VP_USER || {}).email || (ROLE_MAP[role] || {}).title || "Sistema"}
            </div>
          </div>
          <span className="chev" style={{ color: "var(--vp-gray-500)" }}><Icon.chevUp size={14}/></span>
        </div>
      </div>
    </aside>
  );
}

const BREADCRUMB_MAP = {
  dashboard:     { module: "Dashboard", page: "Visão Geral", icon: "home" },
  notificacoes:  { module: "Notificações", page: "Central de Alertas", icon: "bell" },
  leads:         { module: "Comercial", page: "Leads", icon: "flag" },
  cotacoes:      { module: "Comercial", page: "Cotações China", icon: "globe" },
  precificacao:  { module: "Comercial", page: "Precificação", icon: "calculator" },
  propostas:     { module: "Jurídico", page: "Propostas", icon: "proposal" },
  juridico:      { module: "Jurídico", page: "Jurídico", icon: "scale" },
  "contrato-venda-equipamentos": { module: "Jurídico", page: "Contrato Venda de Equipamentos", icon: "fileText" },
  "contrato-instalador":         { module: "Jurídico", page: "Contrato Instalador", icon: "hardhat" },
  engenharia:    { module: "Engenharia", page: "Engenharia", icon: "ruler" },
  "ncm-catalogo": { module: "Engenharia", page: "Catálogo de Produtos", icon: "fileSearch" },
  "eng-configurador": { module: "Engenharia", page: "Projeto de Equipamento", icon: "grid" },
  "desenho-tecnico": { module: "Engenharia", page: "Desenho Técnico ER | ES", icon: "ruler" },
  "ficha-tecnica":   { module: "Engenharia", page: "Ficha Técnica", icon: "fileText" },
  importacao:    { module: "Logística", page: "Importação", icon: "ship" },
  compras:       { module: "Logística", page: "Compras Nacional", icon: "truck" },
  vistorias:     { module: "Instalação & Entrega", page: "Vistorias de Obras", icon: "search" },
  instalacao:    { module: "Instalação & Entrega", page: "Instalação em Campo", icon: "hardhat" },
  art:           { module: "Instalação & Entrega", page: "ART de Instalação", icon: "scale" },
  cronograma:    { module: "Instalação & Entrega", page: "Cronograma de Instalação", icon: "clock" },
  databook:      { module: "Instalação & Entrega", page: "Data Book & Termo", icon: "fileSearch" },
  handover:      { module: "Instalação & Entrega", page: "Handover & Pós-venda", icon: "package" },
  financeiro:    { module: "Financeiro", page: "Gatilhos & Prazo Reverso", icon: "dollar" },
  comissoes:     { module: "Financeiro", page: "Comissões", icon: "award" },
  "rh-homologacao": { module: "Recursos Humanos", page: "Homologação de Parceiros", icon: "users" },
  logs: { module: "Admin", page: "Logs de Atividade", icon: "history" },
  configuracoes: { module: "Admin", page: "Configurações", icon: "settings" },
};

function Header({ route, role, setRole, onSearch }) {
  const bc = BREADCRUMB_MAP[route] || BREADCRUMB_MAP.dashboard;
  return (
    <header className="header">
      <div className="breadcrumb">
        <span>vp-gestao</span>
        <span className="sep">/</span>
        <span>{bc.module}</span>
        <span className="sep">/</span>
        <span className="cur">{bc.page}</span>
      </div>
      <div className="header__search" data-tip="Busca global em breve" aria-disabled="true" style={{ opacity: .55, cursor: "not-allowed" }}>
        <Icon.search size={14} color="var(--fg3)"/>
        <input placeholder="Buscar leads, projetos, contratos, embarques…"
          disabled aria-disabled="true"
          style={{ cursor: "not-allowed", background: "transparent" }}
          onFocus={(e) => e.target.blur()}/>
        <span className="header__search-kbd" title="Em breve">EM BREVE</span>
      </div>
      <div className="role-switch" title="Trocar perfil ativo">
        <button className={role === "comercial" ? "is-active" : ""} onClick={() => setRole("comercial")}>Comercial</button>
        <button className={role === "engenharia" ? "is-active" : ""} onClick={() => setRole("engenharia")}>Engenharia</button>
        <button className={role === "financeiro" ? "is-active" : ""} onClick={() => setRole("financeiro")}>Financeiro</button>
        <button className={role === "admin" ? "is-active" : ""} onClick={() => setRole("admin")}>Admin</button>
      </div>
      <button className="header__btn" data-tip="Notificações" onClick={() => onSearch?.("notificacoes")}>
        <Icon.bell size={16}/>
        <span className="dot"/>
      </button>
      <button className="header__btn" data-tip="Ajuda" onClick={() => window.open('mailto:suporte@verticalparts.com.br?subject=Ajuda%20VP%20PRD', '_blank')}><Icon.info size={16}/></button>
    </header>
  );
}

Object.assign(window, { Sidebar, Header, BREADCRUMB_MAP, ROLE_MAP });
