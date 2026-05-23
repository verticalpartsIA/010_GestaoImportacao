/* ============================================================
   dashboard.jsx — Dashboard Principal
   Dados reais via window.__VP_SB (Supabase); fallback para window.__VP_DATA (mock).
   ============================================================ */

function GanttChart({ projetos, onClick, today = 60 }) {
  const ticks = [0, 25, 50, 75, 100, 125, 150, 175, 200];
  return (
    <div className="gantt">
      <div className="gantt__head">
        <div className="gantt__lblcol">Projeto / Cliente</div>
        <div className="gantt__chart">
          {ticks.map(t => <div key={t} className="gantt__tick" style={{ left: (t / 200 * 100) + "%" }}>+{t}d</div>)}
        </div>
      </div>
      <div className="gantt__rows">
        {projetos.map((p) => (
          <div key={p.id} className="gantt__row" onClick={() => onClick?.(p)}>
            <div className="gantt__lblcol">
              <div className="gantt__name">{p.name}</div>
              <div className="gantt__sub">{p.client} · <span className="mono">{p.id}</span></div>
            </div>
            <div className="gantt__chart">
              <div className="gantt__rail"/>
              <div className="gantt__today" style={{ left: (today / 200 * 100) + "%" }}>
                <span>HOJE</span>
              </div>
              {(p.phases || []).map((ph, i) => (
                <div key={i}
                  className={"gantt__bar gantt__bar--" + ph.status}
                  style={{ left: (ph.start / 200 * 100) + "%", width: ((ph.end - ph.start) / 200 * 100) + "%" }}>
                  <span>{ph.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="gantt__legend">
        <span><i className="gantt-sw done"/>Concluído</span>
        <span><i className="gantt-sw current"/>Em andamento</span>
        <span><i className="gantt-sw future"/>Planejado</span>
        <span><i className="gantt-sw today"/>Hoje</span>
      </div>
    </div>
  );
}

const MOCK_TASKS = {
  comercial: [
    { t: "Ligar Cond. Park Tower — André Pessoa",       time: "Hoje 14h",  prio: "Alta",  module: "Leads" },
    { t: "Enviar proposta Hospital São Luiz",           time: "Hoje 17h",  prio: "Alta",  module: "Propostas" },
    { t: "Follow-up Shopping Vila Olímpia",             time: "Amanhã 10h",prio: "Média", module: "Leads" },
    { t: "Revisar versão 3 da precificação ENG-148",   time: "Amanhã",    prio: "Média", module: "Precificação" },
  ],
  engenharia: [
    { t: "Visita técnica Aeroporto SBSP",               time: "17/mai 9h", prio: "Alta",  module: "Engenharia" },
    { t: "Concluir laudo Hospital São Luiz",            time: "Hoje",      prio: "Alta",  module: "Engenharia" },
    { t: "Aprovar BOM Park Tower modernização",         time: "Amanhã",    prio: "Média", module: "Engenharia" },
    { t: "Reunião kickoff Cyrela Itacolomi",            time: "16/mai 16h",prio: "Média", module: "Instalação" },
  ],
  financeiro: [
    { t: "Confirmar pagamento entrada Ed. Itacolomi",   time: "Hoje",      prio: "Alta",  module: "Financeiro" },
    { t: "Liberar comissões Q1/26",                    time: "Hoje",      prio: "Alta",  module: "Comissões" },
    { t: "Conciliar invoice CT-2026-116 (USD)",        time: "Amanhã",    prio: "Média", module: "Importação" },
    { t: "Validar gatilho 50% Hospital São Luiz",      time: "22/mai",    prio: "Média", module: "Financeiro" },
  ],
  admin: [
    { t: "Reunião gerencial semanal",                  time: "Hoje 16h",  prio: "Alta",  module: "Geral" },
    { t: "Revisar pipeline comercial Q2/26",           time: "Hoje",      prio: "Alta",  module: "Comercial" },
    { t: "Auditoria de permissões — perfil Financeiro",time: "Amanhã",    prio: "Média", module: "Admin" },
    { t: "Validar config. SMTP/IMAP Importação",       time: "Amanhã",    prio: "Baixa", module: "Admin" },
  ],
};

const MOCK_STOCK = [
  { sku: "VP-DG-2400", name: "Degraus Esc. Rolante 1000mm",  qty: 2, min: 6, status: "danger"  },
  { sku: "VP-CR-3100", name: "Corrimão Schindler 9300",       qty: 4, min: 5, status: "warning" },
  { sku: "VP-BI-220",  name: "Barreira Infravermelha 220V",   qty: 3, min: 8, status: "danger"  },
];

function Dashboard({ role, setRoute }) {
  const D = window.__VP_DATA;
  const [sbData, setSbData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!window.__VP_SB) { setLoading(false); return; }
    setLoading(true);
    window.__VP_SB.loadDashboardData(role)
      .then(data => { setSbData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [role]);

  const kpis     = sbData?.kpis?.[role]  || D.kpis?.[role] || D.kpis?.admin || [];
  const tasks    = (sbData?.tarefas?.length > 0 ? sbData.tarefas : null) || MOCK_TASKS[role] || [];
  const alertas  = sbData
    ? sbData.alertas
    : [...(D.alerts || [])].sort((a, b) => ({ danger: 0, warning: 1, info: 2 }[a.level] - { danger: 0, warning: 1, info: 2 }[b.level]));
  const projetos = sbData?.ganttProjetos || D.projetos || [];
  const stocks   = sbData?.estoqueCritico?.length > 0 ? sbData.estoqueCritico : MOCK_STOCK;
  const alertasCrit = sbData?.alertasCriticos ?? alertas.filter(a => a.level === 'danger').length;

  const u         = ROLE_MAP[role];
  const firstName = u.name.split(" ")[0];
  const hour      = new Date().getHours();
  const greet     = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const dateStr   = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateLabel = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const todayBtn  = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow">
            <span className="vp-rule" style={{ display: "inline-block", width: 24, height: 3, background: "var(--vp-yellow)" }}/>
            Dashboard {role}
          </div>
          <h1 className="page-head__title">{greet}, {firstName.toUpperCase()}.</h1>
          <p className="page-head__sub">
            {dateLabel}. Você tem{" "}
            <b>{alertasCrit} alerta{alertasCrit !== 1 ? "s" : ""} crítico{alertasCrit !== 1 ? "s" : ""}</b>{" "}
            e <b>{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</b> hoje.
            {loading && <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>Atualizando…</span>}
          </p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="calendar">Hoje · {todayBtn}</Button>
          <Button variant="secondary" icon="download">Relatório</Button>
          <Button variant="primary" icon="plus">Novo Lead</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <KPI key={i} {...k} icon={["flag","globe","proposal","trending","ruler","fileText","calendar","clock","dollar","award","zap","trending","briefcase","ship","warning","trending"][i % 16]}/>
        ))}
      </div>

      <div className="split" style={{ marginBottom: 20 }}>
        <Card title="Projetos em Andamento" sub={projetos.length + " projetos · 5 fases · timeline 200 dias"}
          action={<>
            <div className="seg">
              <button className="is-active">Gantt</button>
              <button>Lista</button>
              <button>Kanban</button>
            </div>
            <Button variant="ghost" size="sm" icon="expand"/>
          </>}>
          <GanttChart projetos={projetos} onClick={() => setRoute("propostas")} today={sbData?.ganttToday ?? 60}/>
        </Card>

        <Card title="Tarefas de Hoje" sub={tasks.length + " pendentes"} action={<Button variant="ghost" size="sm" icon="plus"/>}>
          <div className="stack">
            {tasks.map((t, i) => (
              <div key={i} className="task-row">
                <input type="checkbox"/>
                <div className="task-row__body">
                  <div className="task-row__title">{t.t}</div>
                  <div className="task-row__meta">
                    <span className="mono">{t.time}</span>
                    <span>·</span>
                    <span>{t.module}</span>
                  </div>
                </div>
                <Badge variant={t.prio === "Alta" ? "danger" : t.prio === "Média" ? "warning" : "neutral"}>{t.prio}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Central de Alertas" sub="ações pendentes que requerem sua atenção" style={{ marginBottom: 20 }}
        action={<Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute("notificacoes")}>Ver tudo</Button>}>
        <div className="stack">
          {alertas.map((a) => (
            <AlertRow key={a.id} alert={a} onClick={() => setRoute(
              a.module === "Importação"  ? "importacao"  :
              a.module === "Jurídico"    ? "juridico"    :
              a.module === "Financeiro"  ? "financeiro"  :
              a.module === "Engenharia"  ? "engenharia"  : "cotacoes"
            )}/>
          ))}
        </div>
      </Card>

      <div className="grid-3">
        <Card title="Pipeline Comercial" sub="acumulado">
          <PipelineFunnel stages={sbData?.pipelineStages}/>
        </Card>
        <Card title="Conversão por Origem" sub="todos os leads">
          <OriginBars data={sbData?.originBars}/>
        </Card>
        <div>
          <NcmDashboardWidget setRoute={setRoute}/>
          <div style={{ height: 16 }}/>
          <Card title="Estoque Crítico" sub="peças com saldo abaixo do mínimo"
            action={<Button variant="ghost" size="sm" iconRight="arrowRight">Detalhar</Button>}>
            <div className="stack">
              {stocks.map((e, i) => <StockRow key={e.sku || i} {...e}/>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PipelineFunnel({ stages }) {
  const data = stages || [
    { label: "Leads",         value: 128, color: "#000" },
    { label: "Cotação China", value: 47,  color: "var(--vp-gray-700)" },
    { label: "Precificação",  value: 31,  color: "var(--vp-gray-500)" },
    { label: "Proposta",      value: 18,  color: "var(--vp-yellow-press)" },
    { label: "Contrato",      value: 12,  color: "var(--vp-yellow)" },
  ];
  const max  = data[0]?.value || 1;
  const last = data[data.length - 1]?.value || 0;
  const conv = max > 0 ? ((last / max) * 100).toFixed(1) : "0.0";
  return (
    <div className="stack" style={{ gap: 8 }}>
      {data.map((s) => (
        <div key={s.label} className="funnel-row">
          <div className="funnel-row__lbl">{s.label}</div>
          <div className="funnel-row__bar">
            <div style={{ width: (s.value / max * 100) + "%", background: s.color }}>
              <span>{s.value}</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <span className="muted small">Conversão Lead→Contrato</span>
        <span className="mono" style={{ fontWeight: 700 }}>{conv}%</span>
      </div>
    </div>
  );
}

function OriginBars({ data }) {
  const rows = data || [
    { l: "Site",      v: 42, conv: 28 },
    { l: "Indicação", v: 31, conv: 41 },
    { l: "WhatsApp",  v: 24, conv: 19 },
    { l: "Licitação", v: 18, conv: 22 },
    { l: "Email",     v: 13, conv: 31 },
  ];
  const max = rows[0]?.v || 1;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((d) => (
        <div key={d.l} className="origin-row">
          <div className="origin-row__lbl">{d.l}</div>
          <div className="origin-row__bar"><div style={{ width: (d.v / max * 100) + "%" }}/></div>
          <div className="origin-row__val mono">{d.v}</div>
          <div className="origin-row__pct" style={{ color: d.conv > 30 ? "var(--vp-success)" : "var(--fg3)" }}>{d.conv}%</div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--fg3)" }}>
        <span>volume</span>
        <span>conversão</span>
      </div>
    </div>
  );
}

function StockRow({ sku, name, qty, min, status }) {
  return (
    <div className="stock-row">
      <div className="status-dot" style={{ background: status === "danger" ? "var(--vp-danger)" : status === "warning" ? "var(--vp-warning)" : "var(--vp-success)" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cell-main" style={{ fontSize: 12 }}>{name}</div>
        <div className="cell-sub">{sku} · min {min}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono tabular" style={{ fontSize: 16, fontWeight: 700 }}>{qty}</div>
        <div className="cell-sub">em estoque</div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
