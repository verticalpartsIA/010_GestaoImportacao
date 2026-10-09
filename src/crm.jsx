/* ============================================================
   crm.jsx — CRM: Canais, Conversão, Automação, Análise
   (Leads/Kanban ficam em comercial.jsx — este arquivo carrega DEPOIS
   dele no index.html e reaproveita comercialSb/LEAD_STATUSES expostos
   de lá, e Badge/Button/Icon/KPI/Card/StatusBadge/fmtBRL de primitives.jsx)

   Escopo decidido pelo usuário em 26/09/2026: só e-mail e WhatsApp em
   Canais (SMS/Web Push/mídias sociais ficam de fora); Conversão mostra
   origem dos leads (sem editor de landing page); Automação documenta a
   regra "Convertido -> Cliente" (não é motor de disparo em massa);
   Análise é o funil próprio do CRM (sem os relatórios de SEO/Ads/GEO
   que o RD Station Marketing tem).
   ============================================================ */

function useLeadsBase() {
  const [leads, setLeads] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    const sb = comercialSb();
    if (!sb) { setLeads([]); return; }
    sb.from('leads').select('*').is('excluido_em', null).order('date', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { window.toast('Erro ao carregar leads: ' + error.message, 'error'); setLeads([]); return; }
        setLeads(data || []);
      })
      .catch((e) => { if (alive) { window.toast('Erro de conexão: ' + (e.message || e), 'error'); setLeads([]); } });
    return () => { alive = false; };
  }, []);
  return leads;
}

function CRMPageHead({ eyebrow, title, sub }) {
  return (
    <div className="page-head">
      <div className="page-head__l">
        <div className="page-head__eyebrow"><span className="vp-rule"/>{eyebrow}</div>
        <h1 className="page-head__title">{title}</h1>
        {sub ? <p className="page-head__sub">{sub}</p> : null}
      </div>
    </div>
  );
}

function CRMBarra({ valor, total }) {
  return (
    <div style={{ width: 120, height: 6, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: (total ? (valor / total) * 100 : 0) + "%", height: "100%", background: "var(--vp-yellow)" }}/>
    </div>
  );
}

/* ---------- CANAIS ---------- */
function waLink(phone, nome) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const numero = digits.length <= 11 ? '55' + digits : digits; // sem DDI informado -> assume Brasil
  const msg = encodeURIComponent('Olá' + (nome ? ' ' + nome : '') + ', tudo bem? Aqui é da VerticalParts.');
  return 'https://wa.me/' + numero + '?text=' + msg;
}

function CRMCanaisPage({ setRoute, setSubsel }) {
  const leads = useLeadsBase();
  if (leads === null) {
    return <div className="page fade-in"><CRMPageHead eyebrow="CRM · Canais" title="Canais"/>
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div></div>;
  }
  const comContato = leads.filter((l) => l.phone || l.email);
  return (
    <div className="page fade-in">
      <CRMPageHead eyebrow="CRM · Canais" title="Canais" sub="WhatsApp e e-mail de cada lead — disparo rápido, sem sair do CRM."/>
      <Card title="Como funciona" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--fg2)", margin: 0 }}>
          O e-mail trocado com um lead já vinculado a uma cotação aparece automaticamente na Central de E-mails (Inbox) e no histórico do Lead — não duplicamos essa caixa aqui.
          O WhatsApp abre direto pelo número cadastrado, na conversa real do WhatsApp Web/App.
        </p>
      </Card>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Lead</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th>Origem</th><th></th></tr></thead>
          <tbody>
            {comContato.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "var(--fg3)", fontSize: 13 }}>Nenhum lead com telefone ou e-mail cadastrado ainda.</td></tr>
            ) : comContato.map((l) => {
              const link = waLink(l.phone, l.contact);
              return (
                <tr key={l.id} onClick={() => { setSubsel(l); setRoute("lead-detail"); }} style={{ cursor: "pointer" }}>
                  <td><div className="cell-main">{l.building}</div><div className="cell-sub">{l.id}</div></td>
                  <td>{l.contact || "—"}</td>
                  <td className="mono">{l.phone || "—"}</td>
                  <td className="mono">{l.email || "—"}</td>
                  <td><Badge variant="outline">{l.origin}</Badge></td>
                  <td>
                    {link ? (
                      <Button variant="outline" size="sm" icon="message" onClick={(ev) => { ev.stopPropagation(); window.open(link, "_blank", "noopener"); }}>WhatsApp</Button>
                    ) : <span style={{ color: "var(--fg3)", fontSize: 12 }}>Sem telefone</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- CONVERSÃO ---------- */
function CRMConversaoPage({ setRoute, setSubsel }) {
  const leads = useLeadsBase();
  if (leads === null) {
    return <div className="page fade-in"><CRMPageHead eyebrow="CRM · Conversão" title="Conversão"/>
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div></div>;
  }
  const total = leads.length;
  const porOrigem = {};
  leads.forEach((l) => { const o = l.origin || "Não informado"; porOrigem[o] = (porOrigem[o] || 0) + 1; });
  const linhas = Object.entries(porOrigem).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page fade-in">
      <CRMPageHead eyebrow="CRM · Conversão" title="Conversão" sub={total + " leads capturados · de onde eles vieram"}/>
      <div className="grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Card title="Fontes de captura">
          {linhas.length === 0 ? (
            <div style={{ color: "var(--fg3)", fontSize: 13, padding: "16px 0" }}>Nenhum lead cadastrado ainda.</div>
          ) : linhas.map(([origem, qtd]) => (
            <div key={origem} className="row sb" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13 }}>{origem}</span>
              <div className="row gap-2">
                <CRMBarra valor={qtd} total={total}/>
                <b style={{ fontSize: 13, width: 24, textAlign: "right" }}>{qtd}</b>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Captura automática do site">
          <p style={{ fontSize: 13, color: "var(--fg2)" }}>
            O formulário de contato de <b>verticalparts.com.br</b> já envia leads direto pra cá, via Edge Function <code>capturar-lead-verticalparts</code>.
          </p>
          <p style={{ fontSize: 12, color: "var(--fg3)" }}>
            Falta só configurar a ação de Webhook no Elementor (wp-admin) apontando pra:
          </p>
          <div className="mono" style={{ fontSize: 11, background: "var(--bg2)", padding: 8, borderRadius: 6, wordBreak: "break-all" }}>
            https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/capturar-lead-verticalparts
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- AUTOMAÇÃO ---------- */
function CRMAutomacaoPage({ setRoute, setSubsel }) {
  const leads = useLeadsBase();
  const [corrigindo, setCorrigindo] = React.useState(null);

  if (leads === null) {
    return <div className="page fade-in"><CRMPageHead eyebrow="CRM · Automação" title="Automação"/>
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div></div>;
  }

  const convertidos = leads.filter((l) => l.status === "Convertido");

  const corrigir = async (lead) => {
    if (!window.CadastrosClientesStore) return window.toast("Módulo de clientes indisponível.", "error");
    setCorrigindo(lead.id);
    try {
      const clienteId = await window.CadastrosClientesStore.criarOuVincularDeLead(lead);
      if (clienteId) { window.toast("Cliente vinculado.", "success"); window.location.reload(); }
      else window.toast("Não foi possível vincular (lead sem prédio/contato).", "warning");
    } catch (e) {
      window.toast("Erro: " + e.message, "error");
    } finally {
      setCorrigindo(null);
    }
  };

  return (
    <div className="page fade-in">
      <CRMPageHead eyebrow="CRM · Automação" title="Automação" sub="Regras automáticas do funil — não é disparo de e-mail/SMS em massa."/>
      <Card title="Regra ativa: Lead convertido → Cliente" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--fg2)", margin: 0 }}>
          Sempre que um lead vira <b>"Convertido"</b> — seja porque uma Proposta foi assinada, seja porque alguém mudou o status manualmente (edição ou arrastando no Kanban) —
          o sistema garante que existe um registro correspondente em <b>Cadastros → Clientes</b>, vinculando o lead a ele (<code>leads.cliente_id</code>). Não cria duplicado se já existir.
        </p>
      </Card>
      <Card title={"Leads convertidos (" + convertidos.length + ")"}>
        {convertidos.length === 0 ? (
          <div style={{ color: "var(--fg3)", fontSize: 13, padding: "16px 0" }}>Nenhum lead convertido ainda.</div>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Lead</th><th>Contato</th><th>Vínculo com Cliente</th><th></th></tr></thead>
              <tbody>
                {convertidos.map((l) => (
                  <tr key={l.id}>
                    <td><div className="cell-main">{l.building}</div><div className="cell-sub">{l.id}</div></td>
                    <td>{l.contact || "—"}</td>
                    <td>{l.cliente_id ? <Badge variant="success" dot>Vinculado</Badge> : <Badge variant="warning" dot>Sem vínculo</Badge>}</td>
                    <td>
                      {!l.cliente_id && (
                        <Button variant="outline" size="sm" disabled={corrigindo === l.id} onClick={() => corrigir(l)}>
                          {corrigindo === l.id ? "Vinculando…" : "Vincular agora"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- ANÁLISE ---------- */
function CRMAnalisePage({ setRoute, setSubsel }) {
  const leads = useLeadsBase();
  if (leads === null) {
    return <div className="page fade-in"><CRMPageHead eyebrow="CRM · Análise" title="Análise"/>
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div></div>;
  }
  const total = leads.length;
  const porStatus = {};
  LEAD_STATUSES.forEach((s) => { porStatus[s] = 0; });
  leads.forEach((l) => { porStatus[l.status] = (porStatus[l.status] || 0) + 1; });
  const convertidos = porStatus["Convertido"] || 0;
  const taxaConversao = total ? Math.round((convertidos / total) * 100) : 0;

  const porOwner = {};
  leads.forEach((l) => { const o = l.owner || "Sem responsável"; porOwner[o] = (porOwner[o] || 0) + 1; });

  return (
    <div className="page fade-in">
      <CRMPageHead eyebrow="CRM · Análise" title="Análise" sub="Funil de leads — não é analytics de marketing digital (SEO, Ads, etc.)."/>
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Total de leads" value={total} sub="ativos" icon="flag"/>
        <KPI label="Convertidos" value={convertidos} sub="viraram cliente" icon="check"/>
        <KPI label="Taxa de conversão" value={taxaConversao + "%"} sub="do total" icon="trending"/>
        <KPI label="Sem retorno" value={porStatus["Sem retorno"] || 0} sub="perdidos" icon="x"/>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <Card title="Funil por status">
          {LEAD_STATUSES.map((s) => (
            <div key={s} className="row sb" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <StatusBadge status={s}/>
              <div className="row gap-2">
                <CRMBarra valor={porStatus[s]} total={total}/>
                <b style={{ fontSize: 13, width: 24, textAlign: "right" }}>{porStatus[s]}</b>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Por responsável">
          {Object.entries(porOwner).sort((a, b) => b[1] - a[1]).map(([owner, qtd]) => (
            <div key={owner} className="row sb" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13 }}>{owner}</span>
              <b style={{ fontSize: 13 }}>{qtd}</b>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { CRMCanaisPage, CRMConversaoPage, CRMAutomacaoPage, CRMAnalisePage });
