/* ============================================================
   shell.jsx — Sidebar + Header + role switcher
   ============================================================ */

/* Ordem segue o workflow operacional: pré-venda → contrato/importação/suprimentos →
   engenharia → RH → logística → admin. ADM/Financeiro é transversal. */
const NAV_GROUPS = [
  { label: "Geral", items: [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "notificacoes", label: "Notificações", icon: "bell" },
    { id: "decisoes", label: "Central de Decisões", icon: "check" },
    { id: "financeiro", label: "Gatilhos & Prazo", icon: "dollar", restrict: ["financeiro", "admin"] },
  ]},
  /* Cadastros centrais — transversal (Comercial, Importação, Engenharia usam
     os mesmos registros). Clientes/Fornecedores têm tela própria aqui;
     Produtos é o Catálogo de Produtos já existente, só realocado. Sobe
     acima de Comercial (decisão 21/08): sem gente/empresa cadastrada,
     nada se movimenta. */
  { label: "Cadastros", items: [
    { id: "cadastro-clientes", label: "Clientes", icon: "users" },
    { id: "cadastro-fornecedores", label: "Fornecedores", icon: "truck" },
    { id: "ncm-catalogo", label: "Produtos", icon: "fileSearch" },
  ]},
  { label: "Comercial", items: [
    { id: "leads", label: "Leads", icon: "flag" },
    { id: "formularios", label: "Formulários", icon: "layers" },
    { id: "propostas", label: "Propostas", icon: "proposal" },
    { id: "controle-cotacoes", label: "Controle de Cotações", icon: "history" },
  ]},
  { label: "ADM/ Financeiro", items: [
    { id: "cotacoes-fornecedor", label: "Cotações a Fornecedor", icon: "globe" },
    { id: "precificacao", label: "Precificação", icon: "calculator", restrict: ["financeiro", "admin"] },
    { id: "aval-financeiro", label: "Aval Financeiro", icon: "shield", restrict: ["financeiro", "admin"] },
    { id: "comissoes", label: "Comissões", icon: "award", restrict: ["financeiro", "admin"] },
  ]},
  { label: "Jurídico", items: [
    { id: "contrato-venda-equipamentos", label: "Contrato Venda de Equipamentos", icon: "fileText" },
    { id: "contrato-instalador", label: "Contrato Instalador", icon: "hardhat" },
    { id: "juridico", label: "Contratos & Minutas", icon: "scale" },
  ]},
  { label: "Importação | Suprimentos", sublabel: "Siscomex & Compras", items: [
    { id: "importacao", label: "Importação", icon: "ship" },
    /* Sub-telas da Importação — consolidação de uma solução de importação
       já usada pela equipe (P.I., Embarques, RFQ, IMS), trazida pra dentro
       do VP Gestão em fases. Só P.I. está pronta; as demais entram indentadas
       aqui conforme forem migradas. */
    { label: "Gestão Importação", subheader: true },
    { id: "gi-painel", label: "Painel", icon: "home", indent: true },
    { id: "pi-importacao", label: "P.I.", icon: "fileText", indent: true },
    { id: "rfq-importacao", label: "RFQ", icon: "fileSearch", indent: true },
    { id: "ims-importacao", label: "IMS", icon: "package", indent: true },
    { id: "embarques-importacao", label: "Embarques", icon: "ship", indent: true },
    { id: "gi-analise-precos", label: "Análise de Preços", icon: "calculator", indent: true },
    { id: "compras", label: "Compras Nacional", icon: "truck" },
    { id: "pedidos-acompanhamento", label: "Pedidos", icon: "package" },
  ]},
  { label: "Engenharia", items: [
    { id: "engenharia", label: "Engenharia", icon: "ruler" },
    { id: "eng-projeto-elevadores", label: "Projeto de Elevadores", icon: "grid" },
    { id: "eng-configurador", label: "Projeto de Equipamento", icon: "grid" },
    { id: "desenho-tecnico", label: "Projetos ER/Es", icon: "ruler" },
    { id: "ficha-tecnica", label: "Ficha Técnica", icon: "fileText" },
    { id: "vistorias", label: "Vistorias de Obras", icon: "search" },
    { id: "instalacao", label: "Instalação em Campo", icon: "hardhat" },
    { id: "status-obras", label: "Status de Obras", icon: "building" },
    { id: "linha-do-tempo", label: "Linha do Tempo da Cotação", icon: "clock" },
    { id: "art", label: "ART", icon: "scale" },
    { id: "cronograma", label: "Cronograma", icon: "clock" },
    { id: "databook", label: "Data Book & Termo", icon: "fileSearch" },
    { id: "handover", label: "Entrega Final", icon: "package" },
  ]},
  { label: "RH Operacional", items: [
    { id: "rh-homologacao", label: "Homologação de Instaladores", icon: "hardhat" },
  ]},
  /* Submódulos ainda sem rota própria — apenas anunciam o que vai morar aqui,
     sem simular navegação que não existe (ver item.planned no render). */
  { label: "Logística", items: [
    { id: "almoxarifado", label: "Almoxarifado", icon: "package" },
    { label: "Expedição", icon: "truck", planned: true },
    { label: "Logística", icon: "ship", planned: true },
  ]},
  { label: "Portal Admin", items: [
    { id: "logs", label: "Logs de Atividade", icon: "history", restrict: ["admin"] },
    { id: "configuracoes", label: "Configurações do Sistema", icon: "settings", restrict: ["admin"] },
  ]},
];

const ROLE_MAP = {
  comercial:   { name: "Comercial",   initials: "CO", title: "Perfil Comercial" },
  engenharia:  { name: "Engenharia",  initials: "EN", title: "Perfil Engenharia" },
  financeiro:  { name: "Financeiro",  initials: "FI", title: "Perfil Financeiro" },
  admin:       { name: "Admin",       initials: "AD", title: "Perfil Admin" },
};

/* "21/07/26 14:32h" — confirma visualmente que a aba está na versão
   publicada mais recente (ver src/version-check.js). */
function formatBuildTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}h`;
}

const GROUPS_LS_KEY = "vp_sidebar_collapsed_groups";

function Sidebar({ route, setRoute, role, collapsed, onToggle }) {
  const filterVisible = (item) => !item.restrict || item.restrict.includes(role);
  /* Badge de decisões pendentes — o dado já existia em DecisoesStore
     (listarPendentesParaMim, usado por decisoes.jsx), só nunca tinha sido
     plugado no nav. Sidebar já re-renderiza a cada navegação (recebe
     `route`), reaproveita isso pra recalcular ao sair de /decisoes. */
  const [pendentesDecisoes, setPendentesDecisoes] = React.useState(0);
  React.useEffect(() => {
    window.DecisoesStore?.listarPendentesParaMim().then((l) => setPendentesDecisoes(l.length)).catch(() => {});
  }, [route]);
  /* Alocação de módulos (Administração › Configurações) — só filtra grupo
     quando o colaborador tem pelo menos 1 alocação; sem isso, comportamento
     de sempre (mostra tudo, igual antes desta feature existir). "Geral" é
     nav básico e sempre aparece, independente de alocação. */
  const gruposAlocados = (window.__VP_USER || {}).gruposAlocados;
  const filtrarPorAlocacao = Array.isArray(gruposAlocados) && gruposAlocados.length > 0;
  const grupoVisivel = (label) => !filtrarPorAlocacao || label === "Geral" || gruposAlocados.includes(label);
  /* Módulos recolhidos individualmente (clique no título) — persiste por navegador. */
  const [collapsedGroups, setCollapsedGroups] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(GROUPS_LS_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const toggleGroup = (label) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      try { localStorage.setItem(GROUPS_LS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  /* Re-renderiza quando a identidade SSO (vpsistema) chega/é confirmada */
  const [, forceUser] = React.useState(0);
  React.useEffect(() => {
    const on = () => forceUser((n) => n + 1);
    window.addEventListener('vpprd:user', on);
    return () => window.removeEventListener('vpprd:user', on);
  }, []);
  /* Re-renderiza quando src/version-check.js confirma a versão publicada */
  const [, forceVersion] = React.useState(0);
  React.useEffect(() => {
    const on = () => forceVersion((n) => n + 1);
    window.addEventListener('vpprd:version', on);
    return () => window.removeEventListener('vpprd:version', on);
  }, []);
  const version = window.__VP_VERSION;
  const versionLabel = version && formatBuildTime(version.buildTime);
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
        {NAV_GROUPS.filter((group) => grupoVisivel(group.label)).map((group) => {
          const items = group.items.filter(filterVisible);
          /* Seção com `empty: true` é placeholder proposital sem nenhum item —
             mostra o label mesmo assim. Seção comum sem itens visíveis
             (todos ocultados pela role atual) continua oculta por completo. */
          if (!items.length && !group.empty) return null;
          /* Só respeita o recolher por módulo quando a sidebar inteira está expandida —
             no modo ícone (collapsed) os itens continuam visíveis, o rótulo já some por CSS. */
          const isCollapsed = !collapsed && collapsedGroups.has(group.label);
          return (
            <div className={"sidebar__group " + (isCollapsed ? "is-collapsed" : "")} key={group.label}>
              <button type="button" className="sidebar__group-label" onClick={() => toggleGroup(group.label)}
                aria-expanded={!isCollapsed} title={isCollapsed ? "Expandir módulo" : "Recolher módulo"}>
                <span className="sidebar__group-label__text">
                  <span>{group.label}</span>
                  {group.sublabel ? <span className="sidebar__group-sublabel">{group.sublabel}</span> : null}
                </span>
                <span className="sidebar__group-toggle">
                  <Icon.chevDown size={13}/>
                </span>
              </button>
              {isCollapsed ? null : <>
              {!items.length && group.empty && (
                <div className="nav-item nav-item--empty" style={{ color: 'var(--fg3)', cursor: 'default', fontStyle: 'italic' }}>
                  <span className="nav-item__label">Em breve</span>
                </div>
              )}
              {items.map((item) => {
                /* Rótulo indentado de sub-grupo (ex.: "Gestão Importação" dentro de
                   Jurídico|Importação|Suprimentos) — não navega, só organiza. */
                if (item.subheader) {
                  return (
                    <div className="nav-item nav-item--subheader" key={item.label}
                      style={{ paddingLeft: 34, fontSize: 11, fontWeight: 700, letterSpacing: '.03em',
                        textTransform: 'uppercase', color: 'var(--fg3)', cursor: 'default', marginTop: 2 }}>
                      {item.label}
                    </div>
                  );
                }
                const ItemIcon = React.createElement(Icon[item.icon] || Icon.bolt);
                /* Sem rota própria ainda — anuncia o submódulo sem fingir navegação. */
                if (item.planned) {
                  return (
                    <div className="nav-item nav-item--planned" key={item.label}
                      style={{ color: 'var(--fg3)', cursor: 'default', fontStyle: 'italic' }}
                      data-tooltip={item.label}>
                      <span className="nav-item__icon">{ItemIcon}</span>
                      <span className="nav-item__label">{item.label}</span>
                    </div>
                  );
                }
                return (
                  <button type="button" key={item.id}
                    className={"nav-item " + (item.indent ? "nav-item--indent " : "") + (route === item.id ? "is-active" : "")}
                    style={item.indent ? { paddingLeft: 34 } : undefined}
                    onClick={() => setRoute(item.id)}
                    aria-current={route === item.id ? "page" : undefined}
                    data-tooltip={item.label}>
                    <span className="nav-item__icon">{ItemIcon}</span>
                    <span className="nav-item__label">{item.label}</span>
                    {(item.id === 'decisoes' ? pendentesDecisoes : item.badge)
                      ? <span className="nav-item__badge">{item.id === 'decisoes' ? pendentesDecisoes : item.badge}</span> : null}
                  </button>
                );
              })}
              </>}
            </div>
          );
        })}
      </div>
      <div className="sidebar__foot">
        <div className="sidebar__user">
          {window.AvatarColaborador
            ? <window.AvatarColaborador src={(window.__VP_USER || {}).avatarUrl} nome={(window.__VP_USER || {}).nome || (ROLE_MAP[role] || {}).name}/>
            : <div className="avatar">{(window.__VP_USER || {}).iniciais || (ROLE_MAP[role] || {}).initials || "VP"}</div>}
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{(window.__VP_USER || {}).nome || (ROLE_MAP[role] || {}).name || "VP Gestão"}</div>
            <div className="sidebar__user-role" title={(window.__VP_USER || {}).email || ""}>
              {(window.__VP_USER || {}).email || (ROLE_MAP[role] || {}).title || "Sistema"}
            </div>
          </div>
          <span className="chev" style={{ color: "var(--vp-gray-500)" }}><Icon.chevUp size={14}/></span>
        </div>
        <div className="sidebar__version" title={version ? `commit ${version.commit}` : 'Aguardando confirmação da versão…'}>
          {versionLabel ? `Última atualização: ${versionLabel}` : 'Verificando versão…'}
        </div>
      </div>
    </aside>
  );
}

const BREADCRUMB_MAP = {
  dashboard:     { module: "Dashboard", page: "Visão Geral", icon: "home" },
  notificacoes:  { module: "Notificações", page: "Central de Alertas", icon: "bell" },
  leads:         { module: "Comercial", page: "Leads", icon: "flag" },
  "lead-detail": { module: "Comercial", page: "Detalhe de Lead", icon: "flag" },
  formularios:   { module: "Comercial", page: "Formulários", icon: "layers" },
  "formulario-elevador": { module: "Comercial", page: "Formulário — Elevador", icon: "layers" },
  "controle-cotacoes":   { module: "Comercial", page: "Controle de Cotações", icon: "history" },
  "cotacoes-fornecedor": { module: "Financeiro", page: "Cotações a Fornecedor", icon: "globe" },
  "cotacao-fornecedor-detail": { module: "Comercial", page: "Detalhe de Cotação", icon: "globe" },
  precificacao:  { module: "Comercial", page: "Precificação", icon: "calculator" },
  propostas:     { module: "Comercial", page: "Propostas", icon: "proposal" },
  "proposta-editor": { module: "Comercial", page: "Editor de Proposta", icon: "proposal" },
  "dossier-obra":  { module: "Engenharia", page: "Dossiê da Obra", icon: "briefcase" },
  "status-obras":  { module: "Engenharia", page: "Status de Obras", icon: "building" },
  "linha-do-tempo": { module: "Engenharia", page: "Linha do Tempo da Cotação", icon: "clock" },
  juridico:      { module: "Jurídico", page: "Contratos & Minutas", icon: "scale" },
  "contrato-editor": { module: "Jurídico", page: "Editor de Contrato", icon: "fileText" },
  "contrato-venda-equipamentos": { module: "Jurídico", page: "Contrato Venda de Equipamentos", icon: "fileText" },
  "contrato-instalador":         { module: "Jurídico", page: "Contrato Instalador", icon: "hardhat" },
  "cadastro-clientes":     { module: "Cadastros", page: "Clientes", icon: "users" },
  "cadastro-fornecedores": { module: "Cadastros", page: "Fornecedores", icon: "truck" },
  engenharia:    { module: "Engenharia", page: "Engenharia", icon: "ruler" },
  "ncm-catalogo": { module: "Cadastros", page: "Produtos", icon: "fileSearch" },
  "ncm-kanban": { module: "Engenharia", page: "Solicitações NCM", icon: "fileSearch" },
  "ncm-detail": { module: "Engenharia", page: "Detalhe da Solicitação NCM", icon: "fileSearch" },
  "eng-projeto-elevadores": { module: "Engenharia", page: "Projeto de Elevadores", icon: "grid" },
  "eng-configurador": { module: "Engenharia", page: "Projeto de Equipamento", icon: "grid" },
  "desenho-tecnico": { module: "Engenharia", page: "Desenho Técnico ER | ES", icon: "ruler" },
  "ficha-tecnica":   { module: "Engenharia", page: "Ficha Técnica", icon: "fileText" },
  importacao:    { module: "Logística", page: "Importação", icon: "ship" },
  "pi-importacao": { module: "Importação", page: "Gestão Importação — P.I.", icon: "fileText" },
  "rfq-importacao": { module: "Importação", page: "Gestão Importação — RFQ", icon: "fileSearch" },
  "ims-importacao": { module: "Importação", page: "Gestão Importação — IMS", icon: "package" },
  "embarques-importacao": { module: "Importação", page: "Gestão Importação — Embarques", icon: "ship" },
  "gi-painel": { module: "Importação", page: "Gestão Importação — Painel", icon: "home" },
  "gi-analise-precos": { module: "Importação", page: "Gestão Importação — Análise de Preços", icon: "calculator" },
  "pedidos-acompanhamento": { module: "Suprimentos", page: "Pedidos", icon: "package" },
  "importacao-detail":        { module: "Logística", page: "Detalhe de Embarque", icon: "ship" },
  "importacao-rastreamento":  { module: "Logística", page: "Rastreamento de Navios", icon: "mapIcon" },
  "importacao-email":         { module: "Logística", page: "Inbox Importação", icon: "mail" },
  compras:       { module: "Logística", page: "Compras Nacional", icon: "truck" },
  "compras-email": { module: "Logística", page: "Inbox Compras", icon: "mail" },
  vistorias:     { module: "Instalação & Entrega", page: "Vistorias de Obras", icon: "search" },
  instalacao:    { module: "Instalação & Entrega", page: "Instalação em Campo", icon: "hardhat" },
  art:           { module: "Instalação & Entrega", page: "ART de Instalação", icon: "scale" },
  cronograma:    { module: "Instalação & Entrega", page: "Cronograma de Instalação", icon: "clock" },
  databook:      { module: "Instalação & Entrega", page: "Data Book & Termo", icon: "fileSearch" },
  handover:      { module: "Instalação & Entrega", page: "Handover & Pós-venda", icon: "package" },
  financeiro:    { module: "Financeiro", page: "Gatilhos & Prazo", icon: "dollar" },
  "aval-financeiro": { module: "Financeiro", page: "Aval Financeiro", icon: "shield" },
  comissoes:     { module: "Financeiro", page: "Comissões", icon: "award" },
  "rh-homologacao": { module: "RH Operacional", page: "Homologação de Instaladores", icon: "hardhat" },
  logs: { module: "Admin", page: "Logs de Atividade", icon: "history" },
  configuracoes: { module: "Admin", page: "Configurações", icon: "settings" },
};
// Exposto pra src/router.js montar o prefixo de módulo na URL (Fase 1
// da roteirização, issue #279) sem duplicar este mapa.
window.BREADCRUMB_MAP = BREADCRUMB_MAP;

/* Rota "home" de cada módulo do breadcrumb — usada pra tornar o segmento
   do meio clicável (ex.: clicar em "Engenharia" volta pro landing da Engenharia). */
const MODULE_HOME = {
  "Dashboard": "dashboard",
  "Notificações": "notificacoes",
  "Cadastros": "cadastro-clientes",
  "Comercial": "leads",
  "Jurídico": "juridico",
  "Engenharia": "engenharia",
  "RH Operacional": "rh-homologacao",
  "Logística": "importacao",
  "Instalação & Entrega": "vistorias",
  "Financeiro": "financeiro",
  "Admin": "logs",
};

/* Ajuda contextual por rota — texto curto do que a tela faz / próximos passos. */
const HELP_TOPICS = {
  dashboard: "Visão geral do dia: KPIs, tarefas de hoje, projetos em andamento (Gantt/Lista/Kanban) e alertas críticos.",
  leads: "Pipeline comercial. Crie e qualifique leads; a partir do lead você abre formulário, cotação e proposta.",
  formularios: "Formulários de intake por tipo de equipamento. O de Elevador coleta os dados que alimentam cotação e precificação.",
  "cotacoes-fornecedor": "Cotações enviadas aos fornecedores (Glarie/Seloon…). Acompanhe status, tratativas e a decisão de compra.",
  precificacao: "Precificação a partir da cotação respondida. Só libera depois da Análise Técnica aprovada.",
  propostas: "Propostas comerciais geradas da precificação aprovada. Editor com PDF de 18 páginas para Elevador.",
  engenharia: "Projetos de engenharia, configurador e catálogo NCM.",
  "ncm-catalogo": "Catálogo de produtos para cadastro no Siscomex/Duimp. Use 'Solicitações NCM' para a fila de pendências.",
  "ncm-kanban": "Fila de solicitações NCM por status. Abra um produto para ver a ficha e exportar para o LogComex.",
  juridico: "Contratos e minutas. O contrato de venda nasce da proposta aprovada; contrato do instalador exige homologação.",
  importacao: "Embarques, rastreamento de navios (AIS) e inbox. Vincule o embarque à obra do Dossiê.",
  financeiro: "Gatilhos, prazos, comissões e aval financeiro.",
  "rh-homologacao": "Homologação de parceiros instaladores e controle documental (NRs, ASO, PGR…).",
};

function HelpCenter({ route, bc, onClose }) {
  const ctx = HELP_TOPICS[route];
  return (
    <Modal title="Central de Ajuda" onClose={onClose} width={620}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        <Button variant="primary" size="sm" icon="mail"
          onClick={() => window.open('mailto:suporte@verticalparts.com.br?subject=' + encodeURIComponent('Ajuda VP Gestão — ' + (bc.page || '')), '_blank')}>
          Falar com o suporte
        </Button>
      </>}>
      <div className="help-ctx">
        <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Você está em</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{bc.module} · {bc.page}</div>
        <p className="vp-small" style={{ marginTop: 0 }}>
          {ctx || "Use o menu à esquerda para navegar entre os módulos. Cada tela tem suas próprias ações no topo e na lista."}
        </p>
      </div>
      <div className="up-eyebrow muted" style={{ margin: "16px 0 8px" }}>Perguntas frequentes</div>
      <dl className="help-faq">
        <dt>Como faço login?</dt>
        <dd>O acesso é via SSO do portal vpsistema.com — você entra pelo portal e o VP Gestão abre já autenticado.</dd>
        <dt>Não encontro um módulo no menu</dt>
        <dd>O menu respeita o seu perfil (Comercial/Engenharia/Financeiro/Admin). Troque o perfil no topo à direita se tiver permissão.</dd>
        <dt>Um botão não fez nada</dt>
        <dd>Alguns fluxos dependem de uma etapa anterior (ex.: precificar exige Análise Técnica aprovada). Verifique o status da obra no Dossiê.</dd>
        <dt>Preciso de suporte humano</dt>
        <dd>Use o botão “Falar com o suporte” abaixo — ele abre um e-mail já com a tela atual no assunto.</dd>
      </dl>
    </Modal>
  );
}

/* Busca global — consulta leads/projetos/contratos/embarques no Supabase e
   deep-linka pro registro (mesmo objeto que as listas passam via select('*')). */
async function runGlobalSearch(term) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  if (!sb) return { error: true };
  const clean = term.replace(/[,%()]/g, " ").trim();
  if (!clean) return { groups: [] };
  const like = "%" + clean + "%";
  const safe = (p) => p.then((r) => r).catch(() => ({ data: [], error: true }));
  const [L, P, C, E] = await Promise.all([
    safe(sb.from("leads").select("*").or(`building.ilike.${like},contact.ilike.${like},email.ilike.${like}`).limit(6)),
    safe(sb.from("projetos").select("*").or(`name.ilike.${like},client.ilike.${like}`).limit(6)),
    safe(sb.from("contratos_venda_equipamentos").select("*").ilike("client", like).limit(6)),
    safe(sb.from("embarques").select("*").or(`client.ilike.${like},vessel.ilike.${like},bl.ilike.${like},container_number.ilike.${like}`).limit(6)),
  ]);
  const groups = [];
  const push = (module, rows, mapFn) => {
    const items = (rows || []).map(mapFn).filter((it) => it.title);
    if (items.length) groups.push({ module, items });
  };
  push("Leads", L.data, (l) => ({ id: l.id, title: l.building, sub: l.contact || l.status, route: "lead-detail", subsel: l }));
  push("Projetos", P.data, (p) => ({ id: p.id, title: p.name || p.client, sub: p.client || p.current_phase, route: "status-obras", subsel: null }));
  push("Contratos", C.data, (c) => ({ id: c.id, title: c.client, sub: c.status, route: "contrato-editor", subsel: c }));
  push("Embarques", E.data, (e) => ({ id: e.id, title: e.client, sub: e.vessel || e.bl || e.container_number, route: "importacao-detail", subsel: e }));
  return { groups };
}

function GlobalSearch({ onNavigate }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const [err, setErr] = React.useState(false);
  const boxRef = React.useRef(null);
  const reqRef = React.useRef(0);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setGroups([]); setLoading(false); setErr(false); return; }
    setLoading(true); setErr(false);
    const myReq = ++reqRef.current;
    const t = setTimeout(async () => {
      const res = await runGlobalSearch(term);
      if (myReq !== reqRef.current) return; // descarta resposta obsoleta
      setLoading(false);
      if (res.error) { setErr(true); setGroups([]); return; }
      setGroups(res.groups);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (r) => { setOpen(false); setQ(""); setGroups([]); onNavigate(r.route, r.subsel); };
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const showPanel = open && q.trim().length >= 2;

  return (
    <div className="header__search-wrap" ref={boxRef}>
      <div className="header__search">
        <Icon.search size={14} color="var(--fg3)"/>
        <input placeholder="Buscar leads, projetos, contratos, embarques…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}/>
        {q ? <button className="header__search-clear" aria-label="Limpar busca" onClick={() => { setQ(""); setGroups([]); }}>×</button> : null}
      </div>
      {showPanel && (
        <div className="gsearch-panel" role="listbox">
          {loading && <div className="gsearch-empty">Buscando…</div>}
          {!loading && err && <div className="gsearch-empty">Não foi possível buscar agora. Verifique a conexão.</div>}
          {!loading && !err && total === 0 && <div className="gsearch-empty">Nada encontrado para “{q.trim()}”.</div>}
          {!loading && !err && groups.map((g) => (
            <div key={g.module} className="gsearch-group">
              <div className="gsearch-group__label">{g.module}</div>
              {g.items.map((r) => (
                <button key={r.route + "-" + r.id} className="gsearch-item" onClick={() => go(r)}>
                  <span className="gsearch-item__title">{r.title}</span>
                  {r.sub ? <span className="gsearch-item__sub">{r.sub}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Dropdown compacto pra trocar o perfil ativo — antes eram 4 botões fixos
   sempre visíveis, competindo por espaço com a busca (ver header__search). */
function RoleSwitch({ role, setRole }) {
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = ROLE_MAP[role] || ROLE_MAP.admin;
  return (
    <div className="role-dropdown" ref={boxRef} title="Trocar perfil ativo">
      <button type="button" className="role-dropdown__trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="role-dropdown__label">Visualizando como</span>
        <span className="role-dropdown__value">{current.name}</span>
        <Icon.chevDown size={12}/>
      </button>
      {open && (
        <div className="role-dropdown__menu" role="listbox">
          {Object.keys(ROLE_MAP).map((key) => (
            <button type="button" key={key}
              className={"role-dropdown__option " + (role === key ? "is-active" : "")}
              onClick={() => { setRole(key); setOpen(false); }}>
              {ROLE_MAP[key].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ route, role, setRole, onSearch, onNavigate }) {
  const bc = BREADCRUMB_MAP[route] || BREADCRUMB_MAP.dashboard;
  const [showHelp, setShowHelp] = React.useState(false);
  const moduleHome = MODULE_HOME[bc.module];
  return (
    <header className="header">
      <div className="breadcrumb">
        <button type="button" className="breadcrumb__link" onClick={() => onNavigate("dashboard")}>vp-gestao</button>
        <span className="sep">/</span>
        {moduleHome && moduleHome !== route ? (
          <button type="button" className="breadcrumb__link" onClick={() => onNavigate(moduleHome)}>{bc.module}</button>
        ) : (
          <span>{bc.module}</span>
        )}
        <span className="sep">/</span>
        <span className="cur">{bc.page}</span>
      </div>
      <GlobalSearch onNavigate={onNavigate}/>
      <RoleSwitch role={role} setRole={setRole}/>
      <button className="header__btn" data-tip="Notificações" onClick={() => onSearch?.("notificacoes")}>
        <Icon.bell size={16}/>
        <span className="dot"/>
      </button>
      <button className="header__btn" data-tip="Ajuda" aria-label="Central de Ajuda" onClick={() => setShowHelp(true)}><Icon.info size={16}/></button>
      {showHelp ? <HelpCenter route={route} bc={bc} onClose={() => setShowHelp(false)}/> : null}
    </header>
  );
}

Object.assign(window, { Sidebar, Header, BREADCRUMB_MAP, ROLE_MAP });