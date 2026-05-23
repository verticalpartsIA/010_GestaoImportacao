/* ============================================================
   shell.jsx — Sidebar + Header + role switcher
   ============================================================ */

const NAV_GROUPS = [
  { label: "Geral", items: [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "notificacoes", label: "Notificações", icon: "bell", badge: 3 },
  ]},
  { label: "Comercial", items: [
    { id: "leads", label: "Leads", icon: "flag" },
    { id: "cotacoes", label: "Cotações China", icon: "globe", badge: 2 },
    { id: "precificacao", label: "Precificação", icon: "calculator", restrict: ["financeiro", "admin"] },
    { id: "propostas", label: "Propostas", icon: "proposal" },
  ]},
  { label: "Operações", items: [
    { id: "engenharia", label: "Engenharia", icon: "ruler" },
    { id: "ncm-kanban", label: "Solicitações NCM", icon: "package", badge: 6 },
    { id: "juridico", label: "Jurídico", icon: "scale" },
    { id: "instalacao", label: "Instalação", icon: "hardhat" },
  ]},
  { label: "Logística", items: [
    { id: "importacao", label: "Importação", icon: "ship", badge: 9 },
    { id: "ncm-catalogo", label: "Catálogo de Produtos", icon: "fileSearch" },
    { id: "compras", label: "Compras Nacional", icon: "truck" },
  ]},
  { label: "Financeiro", items: [
    { id: "financeiro", label: "Gatilhos & Prazo", icon: "dollar", restrict: ["financeiro", "admin"] },
    { id: "comissoes", label: "Comissões", icon: "award", restrict: ["financeiro", "admin"] },
  ]},
  { label: "Admin", items: [
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
              <div className="sidebar__group-label"><span>{group.label}</span></div>
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
          <div className="avatar">{ROLE_MAP[role].initials}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{ROLE_MAP[role].name}</div>
            <div className="sidebar__user-role">{ROLE_MAP[role].title}</div>
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
  propostas:     { module: "Comercial", page: "Propostas", icon: "proposal" },
  engenharia:    { module: "Operações", page: "Engenharia", icon: "ruler" },
  "ncm-kanban":  { module: "Operações", page: "Solicitações NCM", icon: "package" },
  "ncm-detail":  { module: "Operações", page: "Solicitação NCM — Detalhe", icon: "fileSearch" },
  juridico:      { module: "Operações", page: "Jurídico", icon: "scale" },
  instalacao:    { module: "Operações", page: "Instalação", icon: "hardhat" },
  importacao:    { module: "Logística", page: "Importação", icon: "ship" },
  "ncm-catalogo": { module: "Logística", page: "Catálogo de Produtos", icon: "fileSearch" },
  compras:       { module: "Logística", page: "Compras Nacional", icon: "truck" },
  financeiro:    { module: "Financeiro", page: "Gatilhos & Prazo Reverso", icon: "dollar" },
  comissoes:     { module: "Financeiro", page: "Comissões", icon: "award" },
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
      <button className="header__btn" data-tip="Ajuda" onClick={() => window.toast('Central de ajuda em breve.', 'info')}><Icon.info size={16}/></button>
    </header>
  );
}

Object.assign(window, { Sidebar, Header, BREADCRUMB_MAP, ROLE_MAP });
