/* ============================================================
   primitives.jsx — shared building blocks
   Icons (inline SVG, lucide-style 1.6 stroke),
   Button, Badge, Card, KPI, Table, Tabs, FilterPill, Modal.
   ============================================================ */

/* ---- Icon system: inline SVGs, lucide-style ---- */
const _SVG = (paths, viewBox = "0 0 24 24") => (props) => {
  const { size = 18, color, style, className, strokeWidth = 1.6, ...rest } = props || {};
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox={viewBox} fill="none" stroke={color || "currentColor"}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} {...rest}>
      {paths}
    </svg>
  );
};

const Icon = {
  home: _SVG(<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></>),
  users: _SVG(<><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 13.8c.8-.3 1.6-.4 2.5-.4 2.8 0 5 2 5 4.6"/></>),
  flag: _SVG(<><path d="M4 22V4"/><path d="M4 4h11l-2 3.5L15 11H4"/></>),
  fileText: _SVG(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></>),
  calculator: _SVG(<><rect x="5" y="3" width="14" height="18" rx="1"/><rect x="8" y="6" width="8" height="3"/><circle cx="9" cy="13" r=".6" fill="currentColor"/><circle cx="12" cy="13" r=".6" fill="currentColor"/><circle cx="15" cy="13" r=".6" fill="currentColor"/><circle cx="9" cy="17" r=".6" fill="currentColor"/><circle cx="12" cy="17" r=".6" fill="currentColor"/><circle cx="15" cy="17" r=".6" fill="currentColor"/></>),
  proposal: _SVG(<><path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v6h6"/><path d="m9 14 2 2 4-4"/></>),
  ruler: _SVG(<><rect x="3" y="9" width="18" height="6" transform="rotate(-15 12 12)"/><path d="m6 11 1 2M9 10l1.5 3M12 9l1 2M15 8l1.5 3M18 7l1 2"/></>),
  scale: _SVG(<><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 3 13a3 3 0 0 0 6 0L7 7"/><path d="m17 7-2 6a3 3 0 0 0 6 0L19 7"/></>),
  dollar: _SVG(<><path d="M12 3v18"/><path d="M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7"/></>),
  ship: _SVG(<><path d="M3 14 12 4l9 10"/><path d="M5 18s2 2 5 2 5-2 5-2 2 2 5 2"/><path d="M5 14v4"/><path d="M19 14v4"/><path d="M12 6v8"/></>),
  truck: _SVG(<><path d="M14 16V6H1v10h13z"/><path d="M14 8h5l4 4v4h-9"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>),
  tool: _SVG(<><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L14.7 12 12 9.3z"/></>),
  award: _SVG(<><circle cx="12" cy="9" r="6"/><path d="m8.5 13-1.5 7L12 17l5 3-1.5-7"/></>),
  bell: _SVG(<><path d="M18 16a4 4 0 0 1-6 5H6l1.4-1.8A7 7 0 0 0 6 14V9a6 6 0 1 1 12 0v5c0 .7.1 1.3.3 1.8z"/><path d="M11 21h2"/></>),
  settings: _SVG(<><circle cx="12" cy="12" r="3"/><path d="m19.4 15-1.7-.6a2 2 0 0 1-1.4-1.4l-.6-1.7L17 9.4a1 1 0 0 0-.2-1.1l-1.1-1.1a1 1 0 0 0-1.1-.2L13 7.7l-1.7-.6A2 2 0 0 1 9.9 5.7L9.3 4a1 1 0 0 0-1-.7H6.7a1 1 0 0 0-1 .7L5.1 5.7a2 2 0 0 1-1.4 1.4L2 7.7l1.3 1.7a1 1 0 0 0 0 1.2L2 12.3l1.7.6a2 2 0 0 1 1.4 1.4l.6 1.7"/></>),
  search: _SVG(<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>),
  plus: _SVG(<><path d="M12 5v14"/><path d="M5 12h14"/></>),
  filter: _SVG(<><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>),
  download: _SVG(<><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>),
  arrowRight: _SVG(<><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>),
  arrowUp: _SVG(<><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>),
  arrowDown: _SVG(<><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></>),
  trending: _SVG(<><path d="m3 17 7-7 4 4 7-7"/><path d="M14 7h7v7"/></>),
  check: _SVG(<><path d="m5 13 4 4L19 7"/></>),
  x: _SVG(<><path d="m6 6 12 12M6 18 18 6"/></>),
  edit: _SVG(<><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></>),
  trash: _SVG(<><path d="M3 6h18"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  chevDown: _SVG(<><path d="m6 9 6 6 6-6"/></>),
  chevRight: _SVG(<><path d="m9 6 6 6-6 6"/></>),
  chevLeft: _SVG(<><path d="m15 6-6 6 6 6"/></>),
  chevUp: _SVG(<><path d="m6 15 6-6 6 6"/></>),
  expand: _SVG(<><path d="M9 3H3v6"/><path d="M21 9V3h-6"/><path d="M15 21h6v-6"/><path d="M3 15v6h6"/></>),
  collapse: _SVG(<><path d="M4 4l5 5"/><path d="M9 5V9H5"/><path d="M20 20l-5-5"/><path d="M15 19v-4h4"/></>),
  externalLink: _SVG(<><path d="M5 5h6v2H7v10h10v-4h2v6H5z"/><path d="m13 3 8 0v8"/><path d="M11 13 21 3"/></>),
  mail: _SVG(<><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 7 9-7"/></>),
  paperclip: _SVG(<><path d="M21 11.5 12.5 20a5 5 0 1 1-7-7L14 4.5a3.5 3.5 0 1 1 5 5L10.5 18a2 2 0 1 1-3-3L15 7"/></>),
  reply: _SVG(<><path d="m9 17-5-5 5-5"/><path d="M4 12h7c4 0 7 3 7 7"/></>),
  send: _SVG(<><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></>),
  clock: _SVG(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  calendar: _SVG(<><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></>),
  warning: _SVG(<><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v5"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/></>),
  info: _SVG(<><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/></>),
  layers: _SVG(<><path d="m12 2 9 4.5-9 4.5-9-4.5z"/><path d="m3 11.5 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/></>),
  package: _SVG(<><path d="m12 3 9 4v10l-9 4-9-4V7z"/><path d="M3 7 12 11 21 7"/><path d="M12 11v10"/></>),
  zap: _SVG(<><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></>),
  user: _SVG(<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>),
  building: _SVG(<><rect x="4" y="3" width="16" height="18" rx="0"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>),
  pin: _SVG(<><path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z"/><circle cx="12" cy="9" r="3"/></>),
  mapIcon: _SVG(<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/></>),
  refresh: _SVG(<><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 16v5h5"/><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 8V3h-5"/></>),
  more: _SVG(<><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></>),
  star: _SVG(<><path d="m12 3 2.6 6 6.4.5-5 4.3 1.6 6.3L12 17l-5.5 3 1.6-6.3-5-4.3 6.4-.5z"/></>),
  link2: _SVG(<><path d="M10 14 21 3"/><path d="M21 8V3h-5"/><path d="M5 21c4 0 11-4 11-12"/></>),
  scissors: _SVG(<><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m20 4-8.5 10"/><path d="m20 20-8.5-10"/></>),
  at: _SVG(<><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1A10 10 0 1 0 14 22"/></>),
  message: _SVG(<><path d="M3 19V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8z"/></>),
  upload: _SVG(<><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/></>),
  eye: _SVG(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  copy: _SVG(<><rect x="9" y="9" width="11" height="11" rx="0"/><path d="M5 15H4V4h11v1"/></>),
  briefcase: _SVG(<><rect x="3" y="7" width="18" height="13" rx="1"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>),
  shield: _SVG(<><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z"/></>),
  hardhat: _SVG(<><path d="M3 18v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="18" width="20" height="3"/><path d="M10 9V4"/><path d="M14 9V4"/></>),
  list: _SVG(<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></>),
  grid: _SVG(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
  bolt: _SVG(<><path d="m12 2-3 9h4l-1 11 9-13h-5l1-7z"/></>),
  trash2: _SVG(<><path d="M3 6h18"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></>),
  globe: _SVG(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>),
  history: _SVG(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>),
  print: _SVG(<><rect x="6" y="3" width="12" height="6"/><rect x="3" y="9" width="18" height="9"/><rect x="6" y="15" width="12" height="6"/></>),
  signature: _SVG(<><path d="M3 17c5 0 5-9 10-9s5 9 8 9"/><path d="M3 21h18"/></>),
  fileSearch: _SVG(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="11" cy="14" r="2.4"/><path d="m13 16 1.5 1.5"/></>),
};

/* ---- Button ---- */
function Button({ variant = "outline", size, icon, iconRight, children, "aria-label": ariaLabel, ...rest }) {
  const cls = ["btn", "btn--" + variant];
  if (size) cls.push("btn--" + size);
  const isIconOnly = !children;
  if (isIconOnly) cls.push("btn--icon");
  // defensively scrub any leakage
  delete rest.iconRight;
  delete rest.iconright;
  // auto aria-label for icon-only buttons (a11y) — derive from data-tip or icon name
  const computedAriaLabel = ariaLabel || (isIconOnly ? (rest["data-tip"] || icon || "Ação") : undefined);
  return (
    <button className={cls.join(" ")} aria-label={computedAriaLabel} {...rest}>
      {icon ? React.createElement(Icon[icon] || Icon.bolt, { size: size === "sm" ? 12 : 14, "aria-hidden": "true" }) : null}
      {children}
      {iconRight ? React.createElement(Icon[iconRight] || Icon.arrowRight, { size: size === "sm" ? 12 : 14, "aria-hidden": "true" }) : null}
    </button>
  );
}

/* ---- Badge ---- */
function Badge({ variant = "neutral", dot, children, style }) {
  return (
    <span className={"badge badge--" + variant} style={style}>
      {dot ? <span className="dot"/> : null}
      {children}
    </span>
  );
}

const STATUS_MAP = {
  "Em qualificação": "info",
  "Aguardando cotação": "warning",
  "Proposta enviada": "info",
  "Negociação": "warning",
  "Convertido": "success",
  "Sem retorno": "neutral",
  "Em análise": "warning",
  "Recebida": "info",
  "Aguardando China": "warning",
  "Aprovada": "success",
  "Em trânsito": "info",
  "Liberação aduaneira": "warning",
  "Entregue": "success",
  "Saiu CD": "info",
  "Em rota": "info",
  "Aguardando coleta": "neutral",
  "Atraso": "danger",
  "Aguardando assinatura": "warning",
  "Em redação": "warning",
  "Assinado": "success",
  "Em assinatura digital": "info",
  "Aprovado": "success",
  "Pago": "success",
  "Aguardando": "warning",
  "Vistoria realizada": "info",
  "Laudo em revisão": "warning",
  "Vistoria agendada": "info",
  "Aguardando aprovação": "warning",
  "Em análise": "warning",
  "Reprovado": "danger",
  "Em estoque": "success",
  "Reposição": "warning",
  "Esgotado": "danger",
};
function StatusBadge({ status }) {
  return <Badge variant={STATUS_MAP[status] || "neutral"} dot>{status}</Badge>;
}

/* ---- Card ---- */
function Card({ title, sub, action, children, sharp = true, style, className = "", padding }) {
  return (
    <div className={(sharp ? "card sharp " : "card ") + className} style={{ padding: padding, ...style }}>
      {(title || action) ? (
        <div className="card__head">
          <div>
            {title ? <h3 className="card__title">{title}</h3> : null}
            {sub ? <div className="card__sub">{sub}</div> : null}
          </div>
          {action ? <div className="card__act">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---- KPI ---- */
function KPI({ label, value, unit, delta, deltaDir, sub, icon }) {
  const cls = "delta " + (deltaDir === "up" ? "up" : deltaDir === "down" ? "down" : "flat");
  return (
    <div className="kpi">
      <span className="kpi__stripe" />
      <div className="kpi__label">{icon ? React.createElement(Icon[icon] || Icon.bolt) : null}{label}</div>
      <div className="kpi__value">{value}{unit ? <span className="unit">{unit}</span> : null}</div>
      <div className="kpi__foot">
        <span className={cls}>
          {deltaDir === "up" ? React.createElement(Icon.arrowUp, { size: 11 }) : null}
          {deltaDir === "down" ? React.createElement(Icon.arrowDown, { size: 11 }) : null}
          {delta}
        </span>
        <span className="mono">{sub}</span>
      </div>
    </div>
  );
}

/* ---- formatMoney / formatNum ---- */
function fmtBRL(v, opts = {}) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: opts.decimals ?? 0, maximumFractionDigits: opts.decimals ?? 0 });
}
function fmtUSD(v) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d + "T12:00:00");
  return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtDateLong(d) {
  if (!d) return "—";
  const x = new Date(d + "T12:00:00");
  return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---- Tabs ---- */
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={"tab " + (active === t.key ? "is-active" : "")} onClick={() => onChange(t.key)}>
          {t.icon ? React.createElement(Icon[t.icon] || Icon.bolt, { size: 14 }) : null}
          {t.label}
          {t.count !== undefined ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---- Modal ---- */
function Modal({ title, children, onClose, footer, width = 720 }) {
  React.useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div className="modal-shroud" onClick={onClose}>
      <div className="modal slide-up" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon.x/></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---- Modal de confirmação de exclusão — exige digitar o nome exato ----
   Issue #12: evita exclusão acidental de dados reais em Ficha Técnica e Catálogo. */
function ModalConfirmarExclusao({ titulo = "Confirmar exclusão", nome, meta = [], consequencias = [], onConfirm, onClose }) {
  const [texto, setTexto] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [excluindo, setExcluindo] = React.useState(false);
  const ok = texto.trim().length > 0 && texto.trim() === String(nome || "").trim();

  const confirmar = async () => {
    if (!ok || excluindo) return;
    setExcluindo(true);
    try {
      await onConfirm(motivo.trim() || null);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Modal title={titulo} onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={confirmar} disabled={!ok || excluindo}>
          {excluindo ? "Excluindo…" : "Excluir definitivamente"}
        </Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="alert danger">
          <Icon.warning/>
          <div>
            <div className="alert__title">Esta ação não pode ser desfeita</div>
            {consequencias.length > 0 && (
              <div className="alert__sub">
                Também será removido: {consequencias.join(", ")}
              </div>
            )}
          </div>
        </div>
        {meta.map((m) => (
          <div key={m.label} className="row sb" style={{ fontSize: 13 }}>
            <span className="muted">{m.label}</span>
            <span style={{ fontWeight: 600 }}>{m.value || "—"}</span>
          </div>
        ))}
        <label className="stack" style={{ gap: 4 }}>
          <span className="up-eyebrow muted">Motivo da exclusão (opcional, fica no log de auditoria)</span>
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cadastro duplicado, produto descontinuado…"/>
        </label>
        <label className="stack" style={{ gap: 4, marginTop: 4 }}>
          <span className="up-eyebrow muted">Digite exatamente "{nome}" para confirmar</span>
          <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={nome} autoFocus/>
        </label>
      </div>
    </Modal>
  );
}

/* ---- Alert row ---- */
function AlertRow({ alert, onClick }) {
  const I = alert.level === "danger" ? Icon.warning : alert.level === "warning" ? Icon.warning : Icon.info;
  return (
    <div className={"alert " + alert.level} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <I/>
      <div style={{ flex: 1 }}>
        <div className="alert__title">{alert.title}</div>
        <div className="alert__sub">{alert.sub}</div>
      </div>
      <div className="mono" style={{ fontSize: 11, opacity: .7, textAlign: "right" }}>
        <div>{alert.module}</div>
        <div style={{ marginTop: 2 }}>{alert.time}</div>
      </div>
    </div>
  );
}

function EmptyStateRedirect({ icon = "search", title, message, ctaLabel, onCta }) {
  const I = Icon[icon] || Icon.info;
  return (
    <div className="page fade-in">
      <div className="empty-state">
        <div className="empty-state__icon"><I size={28}/></div>
        <h2>{title}</h2>
        <p>{message}</p>
        {ctaLabel ? <Button variant="primary" size="sm" iconRight="arrowRight" onClick={onCta}>{ctaLabel}</Button> : null}
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Button, Badge, StatusBadge, Card, KPI, Tabs, Modal, ModalConfirmarExclusao, AlertRow, fmtBRL, fmtUSD, fmtDate, fmtDateLong, EmptyStateRedirect });
