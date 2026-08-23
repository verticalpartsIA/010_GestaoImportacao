/* ============================================================
   dashboard.jsx — Dashboard Principal
   Dados reais via window.__VP_SB (Supabase).
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


function ProjectList({ projetos, onClick }) {
  if (!projetos.length) return (
    <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>Nenhum projeto cadastrado.</div>
  );
  return (
    <div className="stack" style={{ gap: 0 }}>
      {projetos.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: onClick ? 'pointer' : undefined }}
          onClick={() => onClick?.(p)}>
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

function ProjectKanban({ projetos, onMove, onClick }) {
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
    <div className="kanban project-kanban">
      {phases.map(ph => (
        <div key={ph} className="kanban__col">
          <div className={"kanban__col-head" + (byPhase[ph].length > 0 ? " is-active" : "")}>
            <span className="kanban__col-title">{ph}</span>
            <span className="kanban__col-count">{byPhase[ph].length}</span>
          </div>
          <div className="kanban__col-body">
          {byPhase[ph].map(p => (
            <div key={p.id} className="kanban__card project-kanban__card" style={{ cursor: onClick ? 'pointer' : undefined }}
              onClick={() => onClick?.(p)}>
              <div className="kanban__card-eyebrow">{p.id}</div>
              <div className="kanban__card-title">{p.name}</div>
              <div className="kanban__card-ncm muted">{p.client}</div>
              <div className="kanban__card-foot" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" icon="chevLeft" aria-label={`Mover ${p.name} para fase anterior`}
                  disabled={phases.indexOf(ph) === 0}
                  onClick={() => onMove?.(p, phases[Math.max(0, phases.indexOf(ph) - 1)])}/>
                <Button variant="ghost" size="sm" icon="chevRight" aria-label={`Mover ${p.name} para próxima fase`}
                  disabled={phases.indexOf(ph) === phases.length - 1}
                  onClick={() => onMove?.(p, phases[Math.min(phases.length - 1, phases.indexOf(ph) + 1)])}/>
              </div>
            </div>
          ))}
          {!byPhase[ph].length && <div style={{ color: 'var(--fg3)', fontSize: 11, padding: 18, textAlign: 'center' }}>vazio</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalNovaTask({ role, onClose, onSaved }) {
  const [titulo, setTitulo] = React.useState('');
  const [modulo, setModulo] = React.useState('Comercial');
  const [prio, setPrio] = React.useState('Média');
  const [hora, setHora] = React.useState('09:00');
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!titulo.trim()) return window.toast('Título é obrigatório.', 'warning');
    setSaving(true);
    const { error } = await window.__VP_SB.sb.from('tarefas').insert({
      title: titulo.trim(),
      module: modulo,
      priority: ({ 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }[prio] || 'media'),
      due_time: hora,
      role,
      done: false,
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Tarefa adicionada!', 'success');
    onSaved?.();
    onClose();
  };

  return (
    <Modal title="Nova Tarefa" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Criar Tarefa'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Título da tarefa *</label>
          <input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Ligar para síndico Ed. Itacolomi"/>
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Módulo</label>
            <select className="input" value={modulo} onChange={e => setModulo(e.target.value)}>
              {['Comercial','Engenharia','Jurídico','Importação','Financeiro','Instalação'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Prioridade</label>
            <select className="input" value={prio} onChange={e => setPrio(e.target.value)}>
              {['Alta','Média','Baixa'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Horário</label>
          <input className="input" type="time" value={hora} onChange={e => setHora(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

function Dashboard({ role, setRoute, setSubsel }) {
  const [sbData, setSbData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [projectView, setProjectView] = React.useState('gantt');
  const [period, setPeriod] = React.useState('Hoje');
  const [showTask, setShowTask] = React.useState(false);
  const [detalheProjeto, setDetalheProjeto] = React.useState(null);
  const periods = ['Hoje','7 dias','30 dias','90 dias'];
  const reloadDashboard = React.useCallback(() => {
    if (!window.__VP_SB) { setLoading(false); return Promise.resolve(); }
    setLoading(true);
    // Timeout de 3s: se Supabase não responder, renderiza vazio
    const timeoutId = setTimeout(() => {
      setSbData({ kpis: {}, tarefas: [], alertas: [], ganttProjetos: [], estoqueCritico: [], alertasCriticos: 0 });
      setLoading(false);
    }, 3000);
    return window.__VP_SB.loadDashboardData(role)
      .then(data => { clearTimeout(timeoutId); setSbData(data); setLoading(false); })
      .catch((err) => { clearTimeout(timeoutId); setLoading(false); window.toast?.('Erro ao atualizar dashboard: ' + err.message, 'error'); });
  }, [role]);

  React.useEffect(() => {
    reloadDashboard();
  }, [reloadDashboard]);

  const moveProject = async (project, phase) => {
    if (!project || !phase || project.current_phase === phase) return;
    const before = sbData;
    setSbData(prev => ({
      ...prev,
      ganttProjetos: (prev?.ganttProjetos || []).map(p => p.id === project.id ? { ...p, current_phase: phase } : p),
    }));
    const { error } = await window.__VP_SB.sb.from('projetos').update({ current_phase: phase }).eq('id', project.id);
    if (error) {
      setSbData(before);
      return window.toast('Erro ao mover projeto: ' + error.message, 'error');
    }
    window.toast(`${project.name} movido para ${phase}`, 'success');
    reloadDashboard();
  };

  const kpis        = sbData?.kpis?.[role] || [];
  const tasks       = sbData?.tarefas || [];
  const projetos    = sbData?.ganttProjetos || [];
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
            {alertasCrit > 0
              ? <b className="dash-alert-link" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setRoute('notificacoes')} title="Ver central de alertas">
                  {alertasCrit} alerta{alertasCrit !== 1 ? "s" : ""} crítico{alertasCrit !== 1 ? "s" : ""}
                </b>
              : <b>{alertasCrit} alertas críticos</b>}{" "}
            e <b>{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</b> hoje.
            {loading && <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>Atualizando…</span>}
          </p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="calendar" onClick={() => { const idx = periods.indexOf(period); setPeriod(periods[(idx+1) % periods.length]); }}>
            {period === 'Hoje' ? `Hoje · ${todayBtn}` : period}
          </Button>
          <Button variant="secondary" icon="download" onClick={() => window.csvDownload(kpis.map(k => ({ indicador: k.label, valor: k.value, sub: k.sub || '—', delta: k.delta || '—' })), `relatorio-dashboard-${role}-${new Date().toISOString().slice(0,10)}.csv`)}>Relatório</Button>
          {/* Vai pra listagem de Leads (não abre um "criar rápido" — não existe
              esse fluxo hoje); rótulo honesto em vez de prometer criação direta
              (achado #50). */}
          <Button variant="primary" icon="plus" onClick={() => setRoute('leads')}>Ir para Leads</Button>
        </div>
      </div>

      <div className="grid-5" style={{ marginBottom: 20 }}>
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
            <Button variant="ghost" size="sm" icon="expand" onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }}/>
          </>}>
          {/* A tabela `projetos` (Gantt/Lista/Kanban) é uma origem legada,
              sem numero_cotacao/proposta_id — não tem como abrir o
              detalhe real de proposta/contrato daqui (achado #50: o
              clique mandava TODO projeto pra "Propostas", sempre a mesma
              tela, independente de qual card). Mostra os dados que o
              próprio card já tem, honesto sobre o que existe. */}
          {projectView === 'gantt'  && <GanttChart projetos={projetos} onClick={setDetalheProjeto} today={sbData?.ganttToday ?? 60}/>}
          {projectView === 'lista'  && <ProjectList projetos={projetos} onClick={setDetalheProjeto}/>}
          {projectView === 'kanban' && <ProjectKanban projetos={projetos} onMove={moveProject} onClick={setDetalheProjeto}/>}
        </Card>

        <Card title="Tarefas de Hoje" sub={tasks.length + " pendentes"} action={<Button variant="ghost" size="sm" icon="plus" onClick={() => setShowTask(true)}/>}>
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

      {showTask && <ModalNovaTask role={role} onClose={() => setShowTask(false)} onSaved={reloadDashboard}/>}
      {detalheProjeto && (
        <Modal title={detalheProjeto.name || 'Projeto'} onClose={() => setDetalheProjeto(null)} width={420}
          footer={<Button variant="ghost" onClick={() => setDetalheProjeto(null)}>Fechar</Button>}>
          <div className="stack" style={{ gap: 10, fontSize: 13 }}>
            <div><span className="muted">ID</span> <span className="mono">{detalheProjeto.id}</span></div>
            <div><span className="muted">Cliente</span> {detalheProjeto.client || '—'}</div>
            <div><span className="muted">Fase atual</span> {detalheProjeto.current_phase || detalheProjeto.status || '—'}</div>
            <div><span className="muted">Início</span> {detalheProjeto.start_date || '—'}</div>
            <div><span className="muted">Previsão de término</span> {detalheProjeto.end_date || '—'}</div>
            {detalheProjeto.value != null && <div><span className="muted">Valor</span> {window.fmtBRL ? window.fmtBRL(detalheProjeto.value) : detalheProjeto.value}</div>}
            {detalheProjeto.responsavel && <div><span className="muted">Responsável</span> {detalheProjeto.responsavel}</div>}
          </div>
        </Modal>
      )}

      <div className="grid-3">
        <Card title="Pipeline Comercial" sub="acumulado">
          <PipelineFunnel stages={sbData?.pipelineStages}/>
        </Card>
        <Card title="Conversão por Origem" sub="todos os leads">
          <OriginBars data={sbData?.originBars}/>
        </Card>
        <OndeParouWidget gatilhos={sbData?.gatilhos || []} setRoute={setRoute} setSubsel={setSubsel}/>
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

/* ---- "Onde Parou" (23/08) — substitui Pendências NCM (lia tabela
   dropada, sempre vazio) e Estoque Crítico. Mostra as cotações com
   gatilho aberto e prazo estourado — quem tem a bola agora, não só
   "está verde/vermelho". Fonte: tabela `gatilhos`, já carregada pelo
   Dashboard (supabase.js), motor em gatilhos-engine.js. */
function OndeParouWidget({ gatilhos, setRoute, setSubsel }) {
  const agora = Date.now();
  const atrasados = (gatilhos || [])
    .filter((g) => !g.concluido_em && g.prazo_em && new Date(g.prazo_em).getTime() < agora
      && !String(g.evento_key || '').startsWith('LEMBRETE__'))
    .map((g) => ({ ...g, diasAtraso: Math.floor((agora - new Date(g.prazo_em).getTime()) / 86400000) }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 6);

  const abrir = async (g) => {
    if (!window.GatilhosEngine) return;
    const dest = await window.GatilhosEngine.navegarPara(g);
    if (dest?.rota) {
      if (dest.subsel != null && setSubsel) setSubsel(dest.subsel);
      setRoute(dest.rota);
    }
  };

  return (
    <Card title="Onde Parou" sub="cotações com etapa atrasada — quem tem a bola agora"
      action={<Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute('financeiro')}>Ver Gatilhos & Prazo</Button>}>
      <div className="stack">
        {atrasados.length === 0
          ? <div className="muted" style={{ padding: '16px 0', textAlign: 'center', fontSize: 13 }}>Nada atrasado agora. 🎉</div>
          : atrasados.map((g) => (
            <div key={g.id} className="row sb" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => abrir(g)}>
              <div style={{ minWidth: 0 }}>
                <div className="cell-main" style={{ fontSize: 12 }}>{g.trigger_name || g.evento_key}</div>
                <div className="cell-sub">Cotação {g.numero_cotacao ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--vp-danger, #c0392b)' }}>
                  {g.diasAtraso}d atrasado
                </span>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}

Object.assign(window, { Dashboard });
