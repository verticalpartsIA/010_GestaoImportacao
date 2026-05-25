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


function ProjectList({ projetos }) {
  if (!projetos.length) return (
    <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>Nenhum projeto cadastrado.</div>
  );
  return (
    <div className="stack" style={{ gap: 0 }}>
      {projetos.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cell-main">{p.name}</div>
            <div className="cell-sub">{p.client} · <span className="mono">{p.id}</span></div>
          </div>
          <Badge variant={p.status === 'Concluído' ? 'success' : 'warning'}>{p.current_phase || p.status || '—'}</Badge>
        </div>
      ))}
    </div>
  );
}

function ProjectKanban({ projetos }) {
  const phases = ['Projeto', 'Fabricação', 'Importação', 'Instalação', 'Entrega'];
  const byPhase = {};
  phases.forEach(ph => { byPhase[ph] = []; });
  projetos.forEach(p => {
    const ph = phases.find(ph => (p.current_phase || '').includes(ph)) || phases[0];
    byPhase[ph].push(p);
  });
  if (!projetos.length) return (
    <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>Nenhum projeto cadastrado.</div>
  );
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {phases.map(ph => (
        <div key={ph} style={{ minWidth: 130, flex: '0 0 130px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: 'var(--fg3)' }}>{ph}</div>
          {byPhase[ph].map(p => (
            <div key={p.id} style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 10px', marginBottom: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{p.name}</div>
              <div style={{ color: 'var(--fg3)', fontSize: 11 }}>{p.client}</div>
            </div>
          ))}
          {!byPhase[ph].length && <div style={{ color: 'var(--fg3)', fontSize: 11, padding: '4px 0' }}>—</div>}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ role, setRoute }) {
  const [sbData, setSbData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [projectView, setProjectView] = React.useState('gantt');

  React.useEffect(() => {
    if (!window.__VP_SB) { setLoading(false); return; }
    setLoading(true);
    window.__VP_SB.loadDashboardData(role)
      .then(data => { setSbData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [role]);

  const kpis        = sbData?.kpis?.[role] || [];
  const tasks       = sbData?.tarefas || [];
  const alertas     = sbData?.alertas || [];
  const projetos    = sbData?.ganttProjetos || [];
  const stocks      = sbData?.estoqueCritico || [];
  const alertasCrit = sbData?.alertasCriticos ?? 0;

  const u         = (window.ROLE_MAP || {})[role] || { name: 'VP Gestão', initials: 'VP', title: 'Sistema' };
  const firstName = (u.name || 'Usuário').split(" ")[0];
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
          <Button variant="outline" icon="calendar" onClick={() => window.toast('Filtro de período em breve.', 'info')}>Hoje · {todayBtn}</Button>
          <Button variant="secondary" icon="download" onClick={() => window.toast('Exportação de relatório em breve.', 'info')}>Relatório</Button>
          <Button variant="primary" icon="plus" onClick={() => setRoute('leads')}>Novo Lead</Button>
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
              <button className={projectView === 'gantt'  ? 'is-active' : ''} onClick={() => setProjectView('gantt')}>Gantt</button>
              <button className={projectView === 'lista'  ? 'is-active' : ''} onClick={() => setProjectView('lista')}>Lista</button>
              <button className={projectView === 'kanban' ? 'is-active' : ''} onClick={() => setProjectView('kanban')}>Kanban</button>
            </div>
            <Button variant="ghost" size="sm" icon="expand" onClick={() => window.toast('Tela cheia em breve.', 'info')}/>
          </>}>
          {projectView === 'gantt'  && <GanttChart projetos={projetos} onClick={() => setRoute("propostas")} today={sbData?.ganttToday ?? 60}/>}
          {projectView === 'lista'  && <ProjectList projetos={projetos}/>}
          {projectView === 'kanban' && <ProjectKanban projetos={projetos}/>}
        </Card>

        <Card title="Tarefas de Hoje" sub={tasks.length + " pendentes"} action={<Button variant="ghost" size="sm" icon="plus" onClick={() => window.toast('Adicionar tarefa em breve.', 'info')}/>}>
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
          <NcmDashboardWidget setRoute={setRoute} ncm={sbData?.ncm || []}/>
          <div style={{ height: 16 }}/>
          <Card title="Estoque Crítico" sub="peças com saldo abaixo do mínimo"
            action={<Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute('compras')}>Detalhar</Button>}>
            <div className="stack">
              {stocks.length === 0
              ? <div className="muted" style={{ padding: '16px 0', textAlign: 'center', fontSize: 13 }}>Nenhum item abaixo do mínimo.</div>
              : stocks.map((e, i) => <StockRow key={e.sku || i} {...e}/>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PipelineFunnel({ stages }) {
  const data = stages || [];
  const max  = data[0]?.value || 1;
  const last = data[data.length - 1]?.value || 0;
  const conv = max > 0 ? ((last / max) * 100).toFixed(1) : "0.0";
  if (!data.length) return (
    <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>Aguardando dados de leads.</div>
  );
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
  const rows = data || [];
  const max = rows[0]?.v || 1;
  if (!rows.length) return (
    <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>Aguardando dados de leads.</div>
  );
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
