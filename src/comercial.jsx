/* ============================================================
   comercial.jsx — Leads, Cotações, Precificação, Propostas
   ============================================================ */

/* ---------- LEADS ---------- */
function LeadsPage({ setRoute, setSubsel }) {
  const [leads, setLeads] = React.useState(null);
  const [status, setStatus] = React.useState("Todos");
  const [search, setSearch] = React.useState("");
  const [owner, setOwner] = React.useState("Todos");

  React.useEffect(() => {
    window.__VP_SB.sb.from('leads').select('*').order('date', { ascending: false })
      .then(({ data }) => setLeads(data || []));
  }, []);

  const statuses = ["Todos", "Em qualificação", "Aguardando cotação", "Proposta enviada", "Negociação", "Convertido", "Sem retorno"];
  const allLeads = leads || [];
  const owners = ["Todos", ...Array.from(new Set(allLeads.filter(l => l.owner).map(l => l.owner))).sort()];

  const rows = allLeads.filter(l => {
    if (status !== "Todos" && l.status !== status) return false;
    if (owner !== "Todos" && l.owner !== owner) return false;
    if (search && !((l.building || "") + (l.contact || "") + (l.equip || "")).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: allLeads.length,
    qualif: allLeads.filter(l => l.status === "Em qualificação").length,
    proposta: allLeads.filter(l => l.status === "Proposta enviada").length,
    valor: allLeads.reduce((a, l) => a + (l.value || 0), 0),
  };

  if (leads === null) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div className="page-head__l">
            <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
            <h1 className="page-head__title">Pipeline de Leads</h1>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando leads…</div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
          <h1 className="page-head__title">Pipeline de Leads</h1>
          <p className="page-head__sub">{allLeads.length} leads ativos · pipeline {fmtBRL(stats.valor)} · conversão média 27%</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.toast('Exportação em breve.', 'info')}>Exportar</Button>
          <Button variant="outline" icon="filter" onClick={() => window.toast('Filtros avançados em breve.', 'info')}>Filtros avançados</Button>
          <Button variant="primary" icon="plus" onClick={() => window.toast('Cadastro de lead em breve.', 'info')}>Novo Lead</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Leads ativos" value={stats.total} sub="mês" delta={stats.total > 0 ? `+${stats.total}` : "0"} deltaDir="up" icon="flag"/>
        <KPI label="Em qualificação" value={stats.qualif} sub="hot leads" delta={`+${stats.qualif}`} deltaDir="up" icon="zap"/>
        <KPI label="Propostas no ar" value={stats.proposta} sub="aguardando" delta="0" deltaDir="up" icon="fileText"/>
        <KPI label="Valor pipeline" value={fmtBRL(stats.valor)} sub="potencial" delta="—" deltaDir="up" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {statuses.map(s => (
            <button key={s} className={status === s ? "is-active" : ""} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="divider-v"/>
        <select className="input" style={{ width: 160, height: 28, fontSize: 12 }} value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar prédio, contato, equipamento…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>ID</th>
            <th>Lead / Prédio</th>
            <th>Contato</th>
            <th>Equipamento</th>
            <th>Origem</th>
            <th>Status</th>
            <th>Resp.</th>
            <th className="text-right">Valor</th>
            <th>Próx. Ação</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 0", color: "var(--fg3)", fontSize: 13 }}>
                  {search || status !== "Todos" || owner !== "Todos"
                    ? "Nenhum lead encontrado com os filtros aplicados."
                    : "Nenhum lead cadastrado. Clique em \"Novo Lead\" para começar."}
                </td>
              </tr>
            ) : rows.map(l => (
              <tr key={l.id} onClick={() => { setSubsel(l); setRoute("lead-detail"); }}>
                <td><span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{l.id}</span></td>
                <td>
                  <div className="cell-main">{l.building}</div>
                  <div className="cell-sub">{fmtDate(l.date)}</div>
                </td>
                <td>
                  <div className="cell-main">{l.contact}</div>
                  <div className="cell-sub">{l.role} · {l.phone}</div>
                </td>
                <td><span style={{ fontSize: 12.5, color: "var(--fg2)" }}>{l.equip}</span></td>
                <td><Badge variant="outline">{l.origin}</Badge></td>
                <td><StatusBadge status={l.status}/></td>
                <td>
                  <div className="row gap-2">
                    <div className="avatar sm">{(l.owner || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                    <span style={{ fontSize: 12 }}>{l.owner || "—"}</span>
                  </div>
                </td>
                <td className="cell-money">{fmtBRL(l.value)}</td>
                <td>
                  <div style={{ fontSize: 12, color: "var(--fg1)", fontWeight: 500 }}>{l.next}</div>
                  <Badge variant={l.priority === "Alta" ? "danger" : l.priority === "Média" ? "warning" : "neutral"} style={{ marginTop: 4 }}>{l.priority}</Badge>
                </td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row sb" style={{ marginTop: 14, fontSize: 12, color: "var(--fg3)" }}>
        <span>Exibindo <b>{rows.length}</b> de <b>{allLeads.length}</b> leads</span>
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => window.toast('Paginação em breve.', 'info')}/>
          <span className="mono">Pág. 1 / {Math.max(1, Math.ceil(allLeads.length / 15))}</span>
          <Button variant="ghost" size="sm" icon="chevRight" onClick={() => window.toast('Paginação em breve.', 'info')}/>
        </div>
      </div>
    </div>
  );
}

/* ---------- LEAD DETAIL ---------- */
function LeadDetail({ lead, setRoute }) {
  if (!lead) {
    return <EmptyStateRedirect
      icon="flag"
      title="Nenhum lead selecionado"
      message="Selecione um lead da listagem para ver os detalhes, contato, histórico e próximos passos."
      ctaLabel="Ir para Listagem de Leads"
      onCta={() => setRoute("leads")}/>;
  }
  const history = [
    { t: "Lead criado via Site (formulário público)", date: "12/mai 09:14", who: "Sistema", icon: "plus" },
    { t: "Contato inicial — WhatsApp respondido pelo síndico", date: "12/mai 10:42", who: "Comercial", icon: "message" },
    { t: "Cotação CT-2026-118 solicitada para fornecedor Suzhou Vertical", date: "12/mai 14:20", who: "Comercial", icon: "globe" },
    { t: "Visita técnica agendada — 15/mai 14h", date: "12/mai 15:00", who: "Engenharia", icon: "calendar" },
    { t: "Email follow-up enviado com prévia da proposta", date: "13/mai 08:30", who: "Comercial", icon: "mail" },
  ];

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("leads")}>Voltar para Leads</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{lead.id} · {lead.origin}</div>
          <h1 className="page-head__title">{lead.building}</h1>
          <p className="page-head__sub">{lead.equip}</p>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={lead.status}/>
            <Badge variant={lead.priority === "Alta" ? "danger" : "warning"} dot>{lead.priority}</Badge>
            <span className="muted small">Última atualização: —</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="message" onClick={() => window.toast('Integração WhatsApp em breve.', 'info')}>WhatsApp</Button>
          <Button variant="outline" icon="mail" onClick={() => window.toast('Integração e-mail em breve.', 'info')}>Email</Button>
          <Button variant="primary" icon="calculator" onClick={() => setRoute("precificacao")}>Precificar</Button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card title="Resumo da oportunidade" sub="dados do prédio + escopo">
            <div className="grid-3" style={{ gap: 24 }}>
              <KvBlock label="Valor estimado" value={fmtBRL(lead.value)} mono/>
              <KvBlock label="Marca do equipamento" value="Atlas Schindler 9300AE"/>
              <KvBlock label="Quantidade" value="4 elevadores + 2 esc."/>
              <KvBlock label="Ano construção prédio" value="1998"/>
              <KvBlock label="Tipo serviço" value="Modernização total"/>
              <KvBlock label="Prazo desejado" value="Q3 2026"/>
            </div>
            <div className="hr"/>
            <div className="up-eyebrow muted">Descrição enviada pelo cliente</div>
            <p className="vp-small" style={{ marginTop: 8 }}>
              "Estamos buscando proposta para modernização completa dos 4 elevadores Schindler 9300AE
              (incluindo botoeiras, displays, quadro de comando e cabos de tração). Prioridade alta —
              os elevadores apresentam falhas frequentes e estamos com reclamações dos moradores.
              Por favor, agendar visita técnica o quanto antes."
            </p>
          </Card>

          <Card title="Histórico de Atividades" sub={history.length + " interações"}>
            <div className="timeline">
              {history.map((h, i) => (
                <div key={i} className={"timeline__row " + (i === 0 ? "current" : "done")}>
                  <div className="timeline__node"/>
                  <div>
                    <div className="timeline__title">{h.t}</div>
                    <div className="timeline__sub">por {h.who}</div>
                  </div>
                  <div className="timeline__meta">{h.date}</div>
                  <div className="timeline__rail"/>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Próximos passos sugeridos" sub="orquestração automática">
            <div className="stack" style={{ gap: 10 }}>
              <SuggestedStep icon="globe" label="Aguardar retorno cotação China" sub="CT-2026-118 · prazo 17/mai" status="current"/>
              <SuggestedStep icon="ruler" label="Visita técnica e laudo preliminar" sub="agendado 15/mai · Engenharia" status="next"/>
              <SuggestedStep icon="calculator" label="Calcular precificação final" sub="após laudo + cotação" status="future"/>
              <SuggestedStep icon="proposal" label="Enviar proposta + minuta jurídica" sub="estimativa 22/mai" status="future"/>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Contato">
            <div className="row gap-3" style={{ marginBottom: 14 }}>
              <div className="avatar lg">{lead.contact.split(" ").map(w => w[0]).join("").slice(0,2)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{lead.contact}</div>
                <div className="cell-sub">{lead.role}</div>
              </div>
            </div>
            <KvBlock label="Telefone" value={lead.phone} mono/>
            <KvBlock label="Email" value={lead.email} mono/>
            <div className="row gap-2" style={{ marginTop: 14 }}>
              <Button variant="secondary" size="sm" icon="message" onClick={() => window.toast('Integração WhatsApp em breve.', 'info')}>WhatsApp</Button>
              <Button variant="outline" size="sm" icon="mail" onClick={() => window.toast('Integração e-mail em breve.', 'info')}>Email</Button>
            </div>
          </Card>

          <Card title="Atribuição">
            <KvBlock label="Vendedor" value={lead.owner}/>
            <KvBlock label="Equipe" value="Comercial Capital"/>
            <KvBlock label="Origem" value={lead.origin}/>
            <KvBlock label="Comissão prevista" value={fmtBRL(lead.value * 0.04, { decimals: 0 }) + " (4%)"} mono/>
          </Card>

          <Card title="Etiquetas">
            <div className="row wrap gap-2">
              <Badge variant="outline">Modernização</Badge>
              <Badge variant="outline">Schindler</Badge>
              <Badge variant="yellow">+R$ 400k</Badge>
              <Badge variant="info">Capital SP</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KvBlock({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="up-eyebrow muted" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--fg1)", fontFamily: mono ? "var(--font-mono)" : "inherit", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function SuggestedStep({ icon, label, sub, status }) {
  const I = Icon[icon] || Icon.bolt;
  const stylesByStatus = {
    current: { background: "#FFFBE6", borderColor: "var(--vp-yellow)" },
    next:    { background: "#fff", borderColor: "var(--border-strong)" },
    future:  { background: "var(--vp-gray-50)", borderColor: "var(--border)", opacity: .7 },
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      border: "1px solid var(--border)",
      ...stylesByStatus[status]
    }}>
      <div style={{ width: 34, height: 34, background: status === "current" ? "#000" : "var(--vp-gray-100)", color: status === "current" ? "var(--vp-yellow)" : "var(--fg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <I size={18}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>{label}</div>
        <div className="cell-sub">{sub}</div>
      </div>
      <Icon.chevRight size={16} color="var(--fg3)"/>
    </div>
  );
}

/* ---------- COTAÇÕES China ---------- */
function CotacoesPage({ setRoute, setSubsel }) {
  const [cotacoes, setCotacoes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("Todos");
  const statuses = ["Todos", "Aguardando China", "Recebida", "Em análise", "Aprovada"];

  React.useEffect(() => {
    window.__VP_SB.sb.from('cotacoes').select('*').order('date', { ascending: false })
      .then(({ data }) => { setCotacoes(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const rows = cotacoes.filter(c => status === "Todos" || c.status === status);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · China</div>
          <h1 className="page-head__title">Cotações China</h1>
          <p className="page-head__sub">Solicitações enviadas aos fornecedores chineses. Link público é gerado para a fábrica preencher SEM autenticação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="link2" onClick={() => window.toast("Link público — próxima fase", "info")}>Link público</Button>
          <Button variant="primary" icon="plus" onClick={() => window.toast("Nova cotação — próxima fase", "info")}>Nova Cotação</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Em aberto" value={cotacoes.filter(c => c.status === "Aguardando China").length} sub="aguardando China" icon="clock"/>
        <KPI label="Recebidas" value={cotacoes.filter(c => c.status === "Recebida").length} sub="prontas p/ análise" icon="package"/>
        <KPI label="SLA médio" value="—" sub="sem dados suficientes" icon="trending"/>
        <KPI label="Variação preço" value="—" sub="sem dados suficientes" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">{statuses.map(s => <button key={s} className={status === s ? "is-active" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div>
        <div className="spacer"/>
        <Button variant="outline" size="sm" icon="filter">Fornecedor</Button>
        <Button variant="outline" size="sm" icon="filter">Origem</Button>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>ID</th>
            <th>Prédio / Projeto</th>
            <th>Fornecedor</th>
            <th>Itens</th>
            <th>Prazo</th>
            <th>Status</th>
            <th>Link público</th>
            <th className="text-right">Total USD</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </td></tr>
            )}
            {rows.map(c => (
              <tr key={c.id} onClick={() => { setSubsel(c); setRoute("cotacao-detail"); }}>
                <td><span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{c.id}</span></td>
                <td>
                  <div className="cell-main">{c.building}</div>
                  <div className="cell-sub">Lead {c.lead} · solicitado {fmtDate(c.date)}</div>
                </td>
                <td>{c.supplier}</td>
                <td><span className="cell-num">{c.items}</span></td>
                <td>
                  <div className="cell-num">{fmtDate(c.deadline)}</div>
                  <div className="cell-sub">{daysLeft(c.deadline) > 0 ? `em ${daysLeft(c.deadline)}d` : `atrasada ${-daysLeft(c.deadline)}d`}</div>
                </td>
                <td><StatusBadge status={c.status}/></td>
                <td>
                  <div className="row gap-2">
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>vp.cn/{c.token}</span>
                    <Button variant="ghost" size="sm" icon="copy" data-tip="Copiar"/>
                  </div>
                </td>
                <td className="cell-money">{c.total ? fmtUSD(c.total) : "—"}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function daysLeft(dateStr) {
  const now = new Date();
  const t = new Date(dateStr + "T12:00:00");
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}

/* ---------- COTAÇÃO DETAIL (with line items + PDF preview placeholder) ---------- */
function CotacaoDetail({ cot, setRoute }) {
  if (!cot) {
    return <EmptyStateRedirect
      icon="globe"
      title="Nenhuma cotação selecionada"
      message="Escolha uma cotação na listagem para ver itens, status China, link público e fornecedor."
      ctaLabel="Ir para Cotações China"
      onCta={() => setRoute("cotacoes")}/>;
  }
  // TODO: conectar Supabase — itens da cotação virão de tabela de itens futuramente
  const items = [];
  const totalUSD = 0;

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("cotacoes")}>Voltar para Cotações</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{cot.id} · {cot.supplier}</div>
          <h1 className="page-head__title">{cot.building}</h1>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={cot.status}/>
            <span className="muted small">Prazo de retorno: <b>{fmtDateLong(cot.deadline)}</b></span>
            <span className="muted small">Solicitado em {fmtDateLong(cot.date)}</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.toast("Geração de PDF — próxima fase", "info")}>PDF</Button>
          <Button variant="outline" icon="link2" onClick={() => { navigator.clipboard?.writeText(`https://vp.cn/cotacao/${cot.token}`); window.toast("Link copiado!", "success"); }}>Copiar link público</Button>
          <Button variant="primary" icon="check" onClick={() => window.toast("Aprovação de cotação — próxima fase", "info")}>Aprovar</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }} sharp={false}>
        <div className="alert info" style={{ margin: 0 }}>
          <Icon.link2/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">Link público para fábrica preencher</div>
            <div className="alert__sub mono" style={{ fontSize: 12, marginTop: 2 }}>https://vp.cn/cotacao/{cot.token} · sem autenticação · expira em 7 dias</div>
          </div>
          <Button variant="secondary" size="sm" icon="copy">Copiar</Button>
        </div>
      </Card>

      <div className="split--wide split">
        <Card title="Itens solicitados" sub={`${items.length} itens · total ${fmtUSD(totalUSD)} FOB Shanghai`} action={<Button variant="ghost" size="sm" icon="plus">Adicionar item</Button>}>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="t">
              <thead><tr>
                <th>SKU</th><th>Descrição</th><th>Categoria</th><th>Qtd</th>
                <th className="text-right">Preço unit.</th><th className="text-right">Total</th>
              </tr></thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
                    Nenhum item cadastrado. {/* TODO: tabela de itens de cotação — fase futura */}
                  </td></tr>
                )}
                {items.map((it) => (
                  <tr key={it.sku}>
                    <td><span className="sku">{it.sku}</span></td>
                    <td><div className="cell-main">{it.name}</div></td>
                    <td><span className="muted">{it.cat}</span></td>
                    <td className="cell-num">{it.qty}</td>
                    <td className="cell-money">{cot.status === "Aguardando China" ? <span className="muted">—</span> : fmtUSD(it.unitPrice)}</td>
                    <td className="cell-money">{cot.status === "Aguardando China" ? <span className="muted">—</span> : fmtUSD(it.qty * it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--vp-gray-50)" }}>
                  <td colSpan={5} className="text-right" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11, letterSpacing: ".14em" }}>Total FOB Shanghai</td>
                  <td className="cell-money" style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 14 }}>{cot.status === "Aguardando China" ? "—" : fmtUSD(totalUSD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Status China" sub="MCC sync">
            <div className="timeline">
              <div className="timeline__row done">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Solicitação enviada</div>
                  <div className="timeline__sub">{fmtDate(cot.date)} · Comercial</div>
                </div>
                <div className="timeline__meta">100%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row done">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Recebido pelo fornecedor</div>
                  <div className="timeline__sub">Suzhou Vertical · acessou link público</div>
                </div>
                <div className="timeline__meta">100%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row current">
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Aguardando preenchimento</div>
                  <div className="timeline__sub">Última atividade: hoje 06:18</div>
                </div>
                <div className="timeline__meta">60%</div>
                <div className="timeline__rail"/>
              </div>
              <div className="timeline__row" >
                <div className="timeline__node"/>
                <div>
                  <div className="timeline__title">Aprovação interna</div>
                  <div className="timeline__sub">Equipe Comercial</div>
                </div>
                <div className="timeline__meta">—</div>
              </div>
            </div>
          </Card>

          <Card title="Fornecedor">
            <div className="row gap-3" style={{ marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, background: "#FF4D2E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "var(--font-display)" }}>CN</div>
              <div>
                <div style={{ fontWeight: 700 }}>{cot.supplier}</div>
                <div className="cell-sub">Suzhou Industrial Park · Jiangsu</div>
              </div>
            </div>
            <KvBlock label="Contato" value="Mr. Wei Zhang"/>
            <KvBlock label="WeChat" value="wei.zhang.suzhou" mono/>
            <KvBlock label="Última cotação" value="abr/2026"/>
            <KvBlock label="Pontualidade" value="92% (24 cotações)"/>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LeadsPage, LeadDetail, CotacoesPage, CotacaoDetail });
