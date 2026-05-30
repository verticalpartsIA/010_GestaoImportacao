/* ============================================================
   logistica.jsx — Importação (ship map) + Compras Nacional + Email Inbox
   ============================================================ */

/* ---------- Timeline padrão (9 fases do workflow de importação) ---------- */
function buildMilestones(status, etd, eta) {
  const phases = [
    "Produção concluída",
    "Embarcado (gate-in / load)",
    "Saiu do porto de origem",
    "Em trânsito marítimo",
    "Chegada prevista (ETA)",
    "Atracação",
    "Desembaraço aduaneiro",
    "Transporte nacional",
    "Entregue na obra",
  ];
  // índice da fase "atual" conforme o status escolhido
  const curIdx = status === "Entregue" ? 9
    : status === "Aguardando liberação" ? 6   // desembaraço em andamento
    : 3;                                        // Em trânsito → fase marítima
  return phases.map((label, i) => ({
    label,
    date: i === 0 ? (etd || "—") : i === 4 ? (eta || "—") : "—",
    state: i < curIdx ? "done" : i === curIdx ? "current" : "future",
  }));
}

/* ---------- MODAL: Novo Embarque ---------- */
function ModalNovoEmbarque({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    client:'', supplier:'', vessel:'', imo:'', line:'',
    bl:'', invoiceNumber:'', invoiceValue:'', invoiceCurrency:'USD',
    containerNumber:'', seal:'', containers:'1', type:'40HC', freight:'FCL',
    from:'Xangai, CN', to:'Santos, BR',
    etd:'', eta:'', status:'Em trânsito',
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.client.trim()) return window.toast('Cliente é obrigatório.', 'warning');
    if (!f.eta) return window.toast('ETA é obrigatória.', 'warning');
    setSaving(true);
    const id = 'EM-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('embarques').insert({
      id,
      client: f.client, supplier: f.supplier || null,
      vessel: f.vessel || null, imo: f.imo || null, line: f.line || null,
      bl: f.bl || null,
      invoice_number: f.invoiceNumber || null,
      invoice_value: f.invoiceValue ? parseFloat(f.invoiceValue) : null,
      invoice_currency: f.invoiceCurrency || 'USD',
      container_number: f.containerNumber || null, seal: f.seal || null,
      freight_condition: f.freight,
      origin: f.from, destination: f.to,
      etd: f.etd || null, eta: f.eta, eta_original: f.eta,
      status: f.status, containers: parseInt(f.containers) || 1,
      container_type: f.type, position: 0,
      lat: null, lng: null, speed: null, heading: null, channel: null,
      milestones: buildMilestones(f.status, f.etd, f.eta), docs: [],
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Embarque criado!', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type='text', ph='', opts=null) => (
    <div className="stack" style={{ gap:4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]} onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  const sectionLabel = (t) => (
    <div className="up-eyebrow muted" style={{ fontSize:9, letterSpacing:'.08em', marginTop:4 }}>{t}</div>
  );

  return (
    <Modal title="Novo Embarque" onClose={onClose} width={600}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Criar Embarque'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {sectionLabel('Projeto & Fornecedor')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Cliente *', 'client', 'text', 'Condomínio Ed. Itacolomi…')}
          {fld('Fornecedor', 'supplier', 'text', 'Ex.: Tianjin Control Systems')}
        </div>

        {sectionLabel('Invoice')}
        <div className="grid-3" style={{ gap:12 }}>
          {fld('Nº Invoice', 'invoiceNumber', 'text', 'HSL-2026-0418')}
          {fld('Valor', 'invoiceValue', 'number', '128400')}
          {fld('Moeda', 'invoiceCurrency', 'text', '', ['USD','EUR','CNY','BRL'])}
        </div>

        {sectionLabel('Navio & BL')}
        <div className="grid-3" style={{ gap:12 }}>
          {fld('Nome do navio', 'vessel', 'text', 'MSC ISABELLA')}
          {fld('IMO', 'imo', 'text', '9839430')}
          {fld('Armador / Linha', 'line', 'text', 'MSC, COSCO, Hapag…')}
        </div>
        {fld('BL (Bill of Lading)', 'bl', 'text', 'Ex.: COSU6789012345')}

        {sectionLabel('Container')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Nº do Container', 'containerNumber', 'text', 'MSCU9382821')}
          {fld('Lacre (seal)', 'seal', 'text', 'SH4471092')}
        </div>
        <div className="grid-3" style={{ gap:12 }}>
          {fld('Qtd. containers', 'containers', 'number', '1')}
          {fld('Tipo', 'type', 'text', '', ['20GP','40GP','40HC','20RF'])}
          {fld('Condição', 'freight', 'text', '', ['FCL','LCL'])}
        </div>

        {sectionLabel('Rota & Datas')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Origem', 'from', 'text', 'Xangai, CN')}
          {fld('Destino', 'to', 'text', 'Santos, BR')}
        </div>
        <div className="grid-3" style={{ gap:12 }}>
          {fld('ETD (saída)', 'etd', 'date')}
          {fld('ETA (chegada) *', 'eta', 'date')}
          {fld('Status', 'status', 'text', '', ['Em trânsito','Aguardando liberação','Entregue'])}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- IMPORTAÇÃO listing ---------- */
function ImportacaoPage({ setRoute, setSubsel }) {
  const [embarques, setEmbarques] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("embarques");
  const [filter, setFilter] = React.useState("Todos");
  const [showEmbarque, setShowEmbarque] = React.useState(false);
  const filterOptions = ["Todos", "Em trânsito", "Aguardando liberação", "Entregue"];

  const reloadEmbarques = () => {
    setLoading(true);
    window.__VP_SB.sb.from('embarques').select('*').order('eta')
      .then(({ data }) => { setEmbarques(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadEmbarques(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const rows = embarques.filter(e => filter === "Todos" || e.status === filter);

  // KPIs derivados
  const emTransito = embarques.filter(e => e.status === "Em trânsito");
  const ativos = embarques.filter(e => e.status !== "Entregue");
  const alertasEta = embarques.filter(e => {
    const orig = e.eta_original || e.etaOriginal;
    return orig && e.eta && e.eta > orig;   // ETA atual atrasada vs. original (ISO compara como string)
  });
  const valorTransito = ativos.reduce((s, e) => s + (e.invoice_value || 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Importação</div>
          <h1 className="page-head__title">Importação</h1>
          <p className="page-head__sub">Embarques em trânsito + rastreamento marítimo (MarineTraffic API) + inbox de emails sincronizada</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="mail" onClick={() => setRoute("importacao-email")}>Inbox</Button>
          <Button variant="outline" icon="globe" onClick={() => setRoute("importacao-rastreamento")}>Mapa de navios</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowEmbarque(true)}>Novo embarque</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Em trânsito" value={emTransito.length} sub="navios ativos" icon="ship"/>
        <KPI label="Aguard. liberação" value={embarques.filter(e => e.status === "Aguardando liberação").length} sub="aduana" icon="package"/>
        <KPI label="Alertas ETA" value={alertasEta.length} sub={alertasEta.length ? "embarques atrasados" : "no prazo"} icon="warning"/>
        <KPI label="Valor em trânsito" value={fmtUSD(valorTransito)} sub="invoices ativas" icon="dollar"/>
      </div>

      <Tabs tabs={[
        { key: "embarques", label: "Embarques", icon: "ship", count: embarques.length },
        { key: "documentos", label: "Documentos & BL", icon: "fileText" },
        { key: "aduana", label: "Aduana", icon: "shield" },
      ]} active={tab} onChange={setTab}/>

      <div className="tbar" style={{ marginTop: 20 }}>
        <div className="seg">
          {filterOptions.map(s => (
            <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
        <div className="spacer"/>
        <Button variant="outline" size="sm" icon="filter">Porto</Button>
        <Button variant="outline" size="sm" icon="filter">Linha</Button>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Embarque</th>
            <th>Navio / BL</th>
            <th>Rota</th>
            <th>ETA</th>
            <th>Progresso</th>
            <th>Aduana</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </td></tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} onClick={() => { setSubsel(e); setRoute("importacao-detail"); }}>
                <td>
                  <div className="cell-main">{e.id}</div>
                  <div className="cell-sub">{e.client}</div>
                </td>
                <td>
                  <div className="cell-main">{e.vessel}</div>
                  <div className="cell-sub">BL {e.bl} · {e.line}</div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span>{(e.from || e.origin || "—").split(" ")[0]}</span>
                    <Icon.arrowRight size={12} color="var(--vp-yellow)"/>
                    <span>{(e.to || e.destination || "—").split(" ")[0]}</span>
                  </div>
                  <div className="cell-sub">{e.containers}× {e.type || e.container_type}</div>
                </td>
                <td>
                  <div className="cell-num">{fmtDate(e.eta)}</div>
                  {(e.etaOriginal || e.eta_original) && e.eta !== (e.etaOriginal || e.eta_original) ? <div className="cell-sub" style={{ color: "var(--vp-danger)" }}>antes: {fmtDate(e.etaOriginal || e.eta_original)}</div> : null}
                </td>
                <td style={{ width: 160 }}>
                  <div className="progress" style={{ marginBottom: 4 }}>
                    <span style={{ width: (e.position * 100) + "%" }}/>
                  </div>
                  <div className="cell-sub mono">{Math.round(e.position * 100)}%</div>
                </td>
                <td>
                  {e.channel ? <Badge variant={e.channel === "Verde" ? "success" : e.channel === "Amarelo" ? "warning" : "danger"} dot>{e.channel}</Badge> : <span className="muted">—</span>}
                </td>
                <td><StatusBadge status={e.status}/></td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showEmbarque && <ModalNovoEmbarque onClose={() => setShowEmbarque(false)} onSaved={reloadEmbarques}/>}
    </div>
  );
}

/* ---------- IMPORTAÇÃO detail ---------- */
function ImportacaoDetail({ embarque, setRoute }) {
  if (!embarque) {
    return <EmptyStateRedirect
      icon="ship"
      title="Nenhum embarque selecionado"
      message="Escolha um embarque na listagem para acompanhar a linha do tempo, posição do navio e documentos."
      ctaLabel="Ir para Importação"
      onCta={() => setRoute("importacao")}/>;
  }
  const e = embarque;
  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("importacao")}>Voltar para Importação</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{e.id} · {e.line}</div>
          <h1 className="page-head__title">{e.vessel}</h1>
          <p className="page-head__sub">BL {e.bl} · {e.containers}× container {e.type || e.container_type} · {e.client}</p>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={e.status}/>
            {e.channel ? <Badge variant={e.channel === "Verde" ? "success" : "warning"} dot>Canal {e.channel}</Badge> : null}
            <span className="muted small">Última atualização: hoje 09:14 BRT</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="globe" onClick={() => setRoute("importacao-rastreamento")}>Ver no mapa</Button>
          <Button variant="outline" icon="mail">Email fornecedor</Button>
          <Button variant="primary" icon="package">Reportar chegada</Button>
        </div>
      </div>

      <div className="split--wide split">
        <div className="stack">
          <Card title="Linha do tempo do embarque" sub={(e.from || e.origin || "—") + " → " + (e.to || e.destination || "—")}>
            <div className="timeline">
              {(e.milestones || []).map((m, i) => (
                <div key={i} className={"timeline__row " + m.state}>
                  <div className="timeline__node"/>
                  <div>
                    <div className="timeline__title">{m.label}</div>
                    {m.note ? <div className="timeline__sub" style={{ color: "var(--vp-warning-ink)" }}>{m.note}</div> : null}
                  </div>
                  <div className="timeline__meta">{m.date}</div>
                  {i < (e.milestones || []).length - 1 ? <div className="timeline__rail"/> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Posição atual do navio" sub="MarineTraffic API · atualizado há 8 min"
            action={<Button variant="ghost" size="sm" icon="refresh">Atualizar</Button>}>
            <div className="map-frame" style={{ height: 360 }}>
              <ShipMap mainShip={e}/>
            </div>
            <div className="grid-4" style={{ marginTop: 14 }}>
              <KvBlock label="Posição" value={e.lat ? `${e.lat}° / ${e.lng}°` : "—"} mono/>
              <KvBlock label="Velocidade" value={e.speed ? `${e.speed} kn` : "—"} mono/>
              <KvBlock label="Rumo" value={e.heading ? `${e.heading}°` : "—"} mono/>
              <KvBlock label="ETA atualizada" value={fmtDateLong(e.eta)}/>
            </div>
          </Card>

          <Card title="Documentos" sub={(e.docs || []).length + " arquivos"} action={<Button variant="outline" size="sm" icon="upload">Adicionar</Button>}>
            <div className="grid-3" style={{ gap: 10 }}>
              {(e.docs || []).map((d, i) => (
                <div key={i} style={{ padding: 12, background: "var(--vp-gray-50)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <Icon.fileText size={18} color={d.includes("✓") ? "var(--vp-success)" : "var(--fg3)"}/>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{d}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Navio & Container" sharp>
            <KvBlock label="Navio" value={e.vessel}/>
            <KvBlock label="IMO" value={e.imo} mono/>
            <KvBlock label="Armador / Linha" value={e.line}/>
            <KvBlock label="BL" value={e.bl} mono/>
            <KvBlock label="Nº Container" value={e.container_number} mono/>
            <KvBlock label="Lacre" value={e.seal} mono/>
            <KvBlock label="Carga" value={`${e.containers}× ${e.type || e.container_type}${e.freight_condition ? " · " + e.freight_condition : ""}`}/>
            <KvBlock label="Rota" value={`${e.from || e.origin} → ${e.to || e.destination}`}/>
          </Card>

          <Card title="Invoice & Fornecedor" sharp>
            <KvBlock label="Fornecedor" value={e.supplier}/>
            <KvBlock label="Nº Invoice" value={e.invoice_number} mono/>
            <KvBlock label="Valor" value={e.invoice_value != null ? (e.invoice_currency === "BRL" ? fmtBRL(e.invoice_value) : fmtUSD(e.invoice_value)) : "—"} mono/>
            <KvBlock label="Moeda" value={e.invoice_currency}/>
          </Card>

          <Card title="Datas" sharp>
            <KvBlock label="ETD" value={fmtDateLong(e.etd)}/>
            <KvBlock label="ETA original" value={fmtDateLong(e.etaOriginal || e.eta_original)}/>
            <KvBlock label="ETA atualizada" value={fmtDateLong(e.eta)}/>
            {(e.etaOriginal || e.eta_original) && e.eta !== (e.etaOriginal || e.eta_original) ? <div className="alert danger" style={{ marginTop: 8 }}><Icon.warning/><div><div className="alert__title">Atraso detectado</div><div className="alert__sub mono">Diferença: +3 dias</div></div></div> : null}
          </Card>

          <Card title="Trigger Financeiro" sharp>
            <div className="up-eyebrow muted">Gatilho próximo</div>
            <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 8px" }}>Pagamento 50% no embarque</div>
            <div className="cell-money mono" style={{ fontSize: 18, fontWeight: 700 }}>R$ 620.000</div>
            <p className="small muted" style={{ marginTop: 8 }}>Será ativado automaticamente quando o BL for confirmado.</p>
            <Button variant="outline" size="sm" iconRight="arrowRight" style={{ width: "100%", marginTop: 8 }}>Ver no Financeiro</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- IMPORTAÇÃO · MAPA DE NAVIOS ====================== */
function ImportacaoRastreamento({ setRoute }) {
  const [embarques, setEmbarques] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(null);

  React.useEffect(() => {
    window.__VP_SB.sb.from('embarques').select('*').order('eta')
      .then(({ data }) => { setEmbarques(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const ships = embarques.filter(e => e.lat !== null && e.lat !== undefined);
  const activeId = active || (ships[0] && ships[0].id) || null;
  const activeShip = ships.find(s => s.id === activeId);

  return (
    <div className="page fade-in" style={{ paddingBottom: 32 }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("importacao")}>Voltar para Importação</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Rastreamento</div>
          <h1 className="page-head__title">Mapa Marítimo</h1>
          <p className="page-head__sub">Posição em tempo real dos {ships.length} navio{ships.length !== 1 ? 's' : ''} em trânsito · MarineTraffic API</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh">Atualizar</Button>
          <Button variant="outline" icon="download">Exportar relatório</Button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, gridTemplateColumns: "1fr 360px" }}>
        <Card sharp={false} padding="0">
          <div className="map-frame" style={{ height: 600 }}>
            <ShipMap mainShip={activeShip} ships={ships} onClick={(s) => setActive(s.id)} active={activeId}/>
          </div>
        </Card>

        <div className="stack">
          <Card title="Navios em trânsito" sub={ships.length + " ativos"}>
            <div className="stack" style={{ gap: 8 }}>
              {ships.map((s) => (
                <div key={s.id}
                  onClick={() => setActive(s.id)}
                  style={{
                    padding: 12,
                    background: activeId === s.id ? "#000" : "#fff",
                    color: activeId === s.id ? "#fff" : "var(--fg1)",
                    border: "1px solid " + (activeId === s.id ? "#000" : "var(--border)"),
                    cursor: "pointer",
                    position: "relative",
                  }}>
                  {activeId === s.id ? <span style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "var(--vp-yellow)" }}/> : null}
                  <div className="row sb">
                    <div className="cell-main" style={{ color: "inherit", fontSize: 13 }}>{s.vessel}</div>
                    <span className="mono small" style={{ color: activeId === s.id ? "var(--vp-yellow)" : "var(--fg3)" }}>{Math.round(s.position * 100)}%</span>
                  </div>
                  <div className="cell-sub" style={{ marginTop: 4 }}>{s.line} · BL {s.bl}</div>
                  <div className="progress" style={{ marginTop: 8, background: activeId === s.id ? "var(--vp-gray-900)" : "var(--vp-gray-200)" }}>
                    <span style={{ width: (s.position * 100) + "%" }}/>
                  </div>
                  <div className="row sb mono small" style={{ marginTop: 8, color: activeId === s.id ? "rgba(255,255,255,.7)" : "var(--fg3)" }}>
                    <span>{s.speed} kn · rumo {s.heading}°</span>
                    <span>ETA {fmtDate(s.eta)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {activeShip ? (
            <Card title="Detalhe" sub={activeShip.id} sharp>
              <KvBlock label="Cliente" value={activeShip.client}/>
              <KvBlock label="Conteúdo" value={`${activeShip.containers}× ${activeShip.type || activeShip.container_type}`}/>
              <KvBlock label="Trajeto" value={`${activeShip.from || activeShip.origin} → ${activeShip.to || activeShip.destination}`}/>
              <KvBlock label="ETA" value={fmtDateLong(activeShip.eta)}/>
              <Button variant="primary" size="sm" iconRight="arrowRight" style={{ width: "100%", marginTop: 8 }} onClick={() => setRoute("importacao")}>Abrir embarque</Button>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Ship map (simplified world-map SVG) ============= */
function ShipMap({ mainShip, ships = [], onClick, active }) {
  // Project lat/lng → x/y inside a fake map area.
  // Map covers lat -50..50, lng -100..150 (China + Brazil corridor)
  const project = (lat, lng) => {
    const minLng = -75, maxLng = 130;
    const minLat = -40, maxLat = 50;
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(4, Math.min(96, y)) };
  };

  const portShanghai = project(31.2, 121.5);
  const portSantos = project(-23.95, -46.3);
  const portItaguai = project(-22.86, -43.75);
  const portNingbo = project(29.8, 121.5);
  const portQingdao = project(36.0, 120.4);

  const allShips = ships.length ? ships : (mainShip ? [mainShip] : []);

  return (
    <>
      <div className="map-grid"/>
      {/* Landmasses (very simplified) */}
      {/* Asia */}
      <div className="map-landmass" style={{ left: "62%", top: "8%", width: "32%", height: "44%", clipPath: "polygon(10% 0, 80% 0, 100% 30%, 95% 60%, 80% 100%, 30% 100%, 0 70%, 0 20%)" }}/>
      {/* Indonesia / SEA islands */}
      <div className="map-landmass" style={{ left: "70%", top: "52%", width: "20%", height: "8%", opacity: .6 }}/>
      <div className="map-landmass" style={{ left: "78%", top: "55%", width: "8%", height: "6%", opacity: .6 }}/>
      {/* Africa */}
      <div className="map-landmass" style={{ left: "38%", top: "20%", width: "22%", height: "55%", clipPath: "polygon(0 0, 70% 0, 100% 20%, 90% 60%, 70% 100%, 30% 100%, 0 60%)" }}/>
      {/* South America */}
      <div className="map-landmass" style={{ left: "8%", top: "30%", width: "20%", height: "55%", clipPath: "polygon(35% 0, 80% 5%, 100% 30%, 80% 60%, 60% 100%, 20% 95%, 0 60%, 10% 20%)" }}/>
      {/* Australia */}
      <div className="map-landmass" style={{ left: "78%", top: "62%", width: "16%", height: "12%", opacity: .8 }}/>

      {/* Ports */}
      <div className="map-port" style={{ left: portShanghai.x + "%", top: portShanghai.y + "%" }}>
        <span className="map-port__label">Shanghai</span>
      </div>
      <div className="map-port" style={{ left: portNingbo.x + "%", top: portNingbo.y + "%" }}>
        <span className="map-port__label">Ningbo</span>
      </div>
      <div className="map-port" style={{ left: portQingdao.x + "%", top: portQingdao.y + "%" }}>
        <span className="map-port__label">Qingdao</span>
      </div>
      <div className="map-port" style={{ left: portSantos.x + "%", top: portSantos.y + "%" }}>
        <span className="map-port__label">Santos</span>
      </div>
      <div className="map-port" style={{ left: portItaguai.x + "%", top: portItaguai.y + "%" }}>
        <span className="map-port__label">Itaguaí</span>
      </div>

      {/* Routes for all ships */}
      {allShips.map((s) => {
        const from = s.from || s.origin || "";
        const to   = s.to   || s.destination || "";
        const start = from.startsWith("Shanghai") || from.startsWith("Xangai") ? portShanghai
                    : from.startsWith("Ningbo") ? portNingbo
                    : from.startsWith("Qingdao") ? portQingdao
                    : portShanghai;
        const end = to.startsWith("Itaguaí") || to.startsWith("Itaguai") ? portItaguai : portSantos;
        const cur = project(s.lat, s.lng);
        return (
          <RouteAndShip key={s.id} start={start} end={end} cur={cur} ship={s}
            isActive={active ? active === s.id : true}
            onClick={() => onClick?.(s)}/>
        );
      })}

      {/* Legend */}
      <div className="map-legend">
        <div className="row gap-3"><span className="sw" style={{ background: "var(--vp-yellow)", borderRadius: "50%" }}/><span>Navio ativo</span></div>
        <div className="row gap-3"><span className="sw" style={{ background: "var(--vp-yellow)", transform: "rotate(45deg)", border: "2px solid #000" }}/><span>Porto</span></div>
        <div className="row gap-3"><span className="sw" style={{ background: "linear-gradient(to right, var(--vp-yellow) 50%, transparent 50%) 0 / 8px 100%" }}/><span>Rota</span></div>
        <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,.6)", fontFamily: "var(--font-mono)" }}>MarineTraffic · sync 8min</div>
      </div>

      {/* Info card */}
      {mainShip ? (
        <div className="map-info">
          <h4>{mainShip.vessel}</h4>
          <dl>
            <dt>BL</dt><dd>{mainShip.bl}</dd>
            <dt>Linha</dt><dd>{mainShip.line}</dd>
            <dt>Velocidade</dt><dd>{mainShip.speed} kn</dd>
            <dt>Rumo</dt><dd>{mainShip.heading}°</dd>
            <dt>Lat/Lng</dt><dd>{mainShip.lat}, {mainShip.lng}</dd>
            <dt>ETA</dt><dd style={{ color: (mainShip.etaOriginal || mainShip.eta_original) && mainShip.eta !== (mainShip.etaOriginal || mainShip.eta_original) ? "var(--vp-danger)" : "var(--fg1)" }}>{fmtDate(mainShip.eta)}</dd>
          </dl>
        </div>
      ) : null}
    </>
  );
}

function RouteAndShip({ start, end, cur, ship, isActive, onClick }) {
  // distance & angle for route line
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <>
      <div className="map-route" style={{
        left: start.x + "%",
        top: start.y + "%",
        width: length + "%",
        transform: `rotate(${angle}deg)`,
        opacity: isActive ? 1 : .35,
      }}/>
      <div className={"map-ship" + (isActive ? " is-active" : "")} style={{ left: cur.x + "%", top: cur.y + "%" }} onClick={onClick}>
        {isActive ? <div className="map-ship__pulse"/> : null}
        <div className="map-ship__icon">
          <Icon.ship size={14} color="#000"/>
        </div>
        <div className="map-ship__label">{ship.vessel.replace("MV ", "")}</div>
      </div>
    </>
  );
}

/* ---------- COMPRAS NACIONAL ============================== */
function ComprasPage({ setRoute }) {
  const [fretes, setFretes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todos");
  const filters = ["Todos", "Em rota", "Saiu CD", "Aguardando coleta", "Entregue", "Atraso"];

  const reloadFretes = () => {
    setLoading(true);
    window.__VP_SB.sb.from('embarques').select('*').order('eta')
      .then(({ data, error }) => {
        if (error) {
          window.toast('Erro ao carregar fretes nacionais: ' + error.message, 'error');
          setFretes([]);
        } else {
          setFretes((data || []).map(e => {
            const status = e.status === 'Entregue' ? 'Entregue'
              : e.status === 'Liberação aduaneira' ? 'Aguardando coleta'
              : e.status === 'Em trânsito' ? 'Saiu CD'
              : e.status || 'Aguardando coleta';
            return {
              id: 'FN-' + e.id,
              origem: e.to || 'Porto',
              destino: e.client || e.projeto || 'Obra',
              transportadora: e.line || 'Operador logístico',
              driver: null,
              placa: e.bl,
              itens: e.containers || 1,
              peso: e.containers ? e.containers * 1200 : 0,
              valor: null,
              eta: e.eta ? fmtDate(e.eta) : '—',
              status,
              ocorrencias: e.status === 'Atraso' ? 1 : 0,
            };
          }));
        }
        setLoading(false);
      });
  };
  React.useEffect(() => { reloadFretes(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;
  const rows = fretes.filter(f => {
    if (filter === "Todos") return true;
    if (filter === "Atraso") return f.ocorrencias > 0 || f.status === "Atraso";
    return f.status === filter;
  });
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Compras Nacional</div>
          <h1 className="page-head__title">Fretes Nacionais</h1>
          <p className="page-head__sub">Movimentação entre CD Guarulhos, portos e obras. Ocorrências e CTes integrados.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="mail" onClick={() => setRoute("compras-email")}>Inbox</Button>
          <Button variant="primary" icon="plus" onClick={() => setRoute("importacao")}>Novo frete via embarque</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Em rota" value={fretes.filter(f => f.status === "Em rota" || f.status === "Em trânsito").length} sub="ativos" icon="truck"/>
        <KPI label="Entregues (semana)" value={fretes.filter(f => f.status === "Entregue").length} sub="OK" icon="check"/>
        <KPI label="Ocorrências" value={fretes.filter(f => f.ocorrencias > 0).length} sub="abertas" icon="warning"/>
        <KPI label="Custo médio frete" value="—" sub="sem dados suficientes" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {filters.map(s => (
            <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>
              {s === "Atraso" ? "Com ocorrência" : s}
            </button>
          ))}
        </div>
        <div className="spacer"/>
        <Button variant="outline" size="sm" icon="filter">Transportadora</Button>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Frete</th>
            <th>Trajeto</th>
            <th>Transportadora</th>
            <th>Motorista</th>
            <th>Carga</th>
            <th className="text-right">Valor</th>
            <th>ETA</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum frete registrado.
              </td></tr>
            )}
            {rows.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="cell-main">{f.id}</div>
                  <div className="cell-sub">{f.itens} itens · {f.peso}kg</div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span>{f.origem}</span>
                    <Icon.arrowRight size={12} color="var(--vp-yellow)"/>
                    <span>{f.destino}</span>
                  </div>
                </td>
                <td>{f.transportadora}<div className="cell-sub">{f.placa}</div></td>
                <td><div className="row gap-2"><div className="avatar sm">{(f.driver || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div><span style={{ fontSize: 12 }}>{f.driver || "—"}</span></div></td>
                <td>
                  <span className="cell-num">{f.itens}</span>
                  {f.ocorrencias > 0 ? <Badge variant="danger" style={{ marginLeft: 8 }}>{f.ocorrencias} oco</Badge> : null}
                </td>
                <td className="cell-money">{fmtBRL(f.valor)}</td>
                <td><span className="cell-num">{f.eta}</span></td>
                <td><StatusBadge status={f.status}/></td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- EMAIL INBOX (Importação + Compras) ============== */
function EmailInbox({ kind, setRoute }) {
  // TODO: conectar Supabase — emails sincronizados via IMAP; usando array vazio por ora
  const emails = [];
  const [activeId, setActiveId] = React.useState(null);
  const [folder, setFolder] = React.useState("inbox");
  const active = emails.find(e => e.id === activeId);

  const folders = [
    { id: "inbox", label: "Caixa de entrada", icon: "mail", count: emails.filter(e => e.unread).length },
    { id: "sent", label: "Enviados", icon: "send" },
    { id: "drafts", label: "Rascunhos", icon: "edit", count: 1 },
    { id: "archive", label: "Arquivados", icon: "package" },
  ];
  const tags = kind === "compras"
    ? [{ id: "frete", label: "Fretes", color: "var(--vp-info)" }, { id: "ocorrencia", label: "Ocorrências", color: "var(--vp-danger)" }, { id: "cte", label: "CTes", color: "var(--vp-success)" }]
    : [{ id: "bl", label: "BLs", color: "var(--vp-yellow-press)" }, { id: "invoice", label: "Invoices", color: "var(--vp-info)" }, { id: "aduana", label: "Aduana", color: "var(--vp-warning-ink)" }, { id: "fornec", label: "Fornecedores", color: "var(--vp-success)" }];

  return (
    <div className="page fade-in" style={{ paddingBottom: 0, paddingRight: 24, paddingLeft: 24 }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute(kind === "compras" ? "compras" : "importacao")}>Voltar</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Email · {kind === "compras" ? "Compras Nacional" : "Importação"}</div>
          <h1 className="page-head__title">Inbox {kind === "compras" ? "Compras" : "Importação"}</h1>
          <p className="page-head__sub">Caixa dedicada sincronizada via IMAP · vincula emails a embarques/fretes automaticamente</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh">Sincronizar</Button>
          <Button variant="primary" icon="plus">Compor</Button>
        </div>
      </div>

      <div className="inbox">
        <div className="inbox__folders">
          {folders.map((f) => {
            const I = Icon[f.icon] || Icon.mail;
            return (
              <div key={f.id} className={"inbox__folder " + (folder === f.id ? "is-active" : "")} onClick={() => setFolder(f.id)}>
                <I size={14}/>
                <span>{f.label}</span>
                {f.count ? <span className="count">{f.count}</span> : null}
              </div>
            );
          })}
          <div className="hr"/>
          <div className="up-eyebrow muted" style={{ padding: "8px 16px 4px", fontSize: 9 }}>Tags</div>
          {tags.map(t => (
            <div key={t.id} className="inbox__folder">
              <span style={{ width: 10, height: 10, background: t.color, borderRadius: "50%" }}/>
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        <div className="inbox__list">
          <div className="inbox__list-head">
            <span>{folder === "inbox" ? "Caixa de entrada" : folder}</span>
            <span className="mono">{emails.length}</span>
          </div>
          {emails.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 16px', color:'var(--fg3)', fontSize:13 }}>
              Nenhuma mensagem encontrada.
            </div>
          )}
          {emails.map((m) => (
            <div key={m.id} className={"inbox__item " + (m.unread ? "unread " : "") + (activeId === m.id ? "is-active" : "")} onClick={() => setActiveId(m.id)}>
              <div className="from">
                <span>{m.from}</span>
                <span className="time">{m.time}</span>
              </div>
              <div className="subj">{m.subject}</div>
              <div className="preview">{m.preview}</div>
              <div className="tags">
                {m.tags.map((t) => (
                  <span key={t} className={"tag " + (t === "Urgente" ? "urgent" : "")}>{t}</span>
                ))}
                {m.attached ? <span className="clip mono"><Icon.paperclip size={10} style={{ verticalAlign: "middle" }}/> {m.attached}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="inbox__msg">
          {active ? (
            <>
              <div className="inbox__msg-head">
                <h3 className="inbox__msg-subj">{active.subject}</h3>
                <div className="inbox__msg-meta">
                  <div className="avatar">{(active.from || "").split("@")[0].split(/[.\-_]/).slice(0,2).map(w => (w[0]||"").toUpperCase()).join("") || "?"}</div>
                  <div>
                    <div className="from-name">{(active.from || "").split("@")[0]}</div>
                    <div className="from-email">{active.from}</div>
                  </div>
                  <div className="from-name" style={{ marginLeft: 12 }}>
                    para: <span className="mono">cotacoes@verticalparts.com.br</span>
                  </div>
                  <div className="from-email">{active.date} · {active.time} BRT</div>
                  <div className="inbox__msg-actions">
                    <Button variant="outline" size="sm" icon="reply">Responder</Button>
                    <Button variant="ghost" size="sm" icon="link2">Vincular</Button>
                    <Button variant="ghost" size="sm" icon="more"/>
                  </div>
                </div>
                <div className="row gap-2" style={{ marginTop: 12 }}>
                  {active.tags.map((t) => <Badge key={t} variant={t === "Urgente" ? "danger" : "outline"}>{t}</Badge>)}
                  <div className="spacer" style={{ flex: 1 }}/>
                  <Badge variant="yellow"><Icon.link2 size={10}/> Vinculado a EMB-2026-009</Badge>
                </div>
              </div>
              <div className="inbox__msg-body">
                <EmailBody kind={kind} id={active.id}/>
              </div>
              {active.attached ? (
                <div className="inbox__msg-attach">
                  {Array.from({ length: active.attached }, (_, i) => (
                    <div key={i} className="att">
                      <Icon.paperclip size={12}/>
                      <span>{["BL_COSU6029841.pdf", "Invoice_HSL.pdf", "Packing_List.xlsx", "CO_Origin.pdf", "Photo_loading.jpg", "Pre-shipment.pdf", "AWB.pdf", "Seguro.pdf"][i]}</span>
                      <span className="mono small muted" style={{ marginLeft: 6 }}>{[124, 64, 48, 22, 1840, 88, 14, 12][i]}kb</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="inbox__compose">
                <Button variant="primary" size="sm" icon="reply">Responder</Button>
                <Button variant="outline" size="sm" icon="reply">Responder a todos</Button>
                <Button variant="outline" size="sm" icon="arrowRight">Encaminhar</Button>
                <div className="spacer" style={{ flex: 1 }}/>
                <Button variant="ghost" size="sm" icon="zap">Sugerir resposta (AI)</Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmailBody({ kind, id }) {
  // Just deliver some realistic looking body content based on email id
  if (kind === "importacao") {
    if (id === "em-1") return (
      <>
        <p>Dear Customer,</p>
        <p>Please be informed that vessel <b>MV LIANJIANG</b> (Voy. 218S, BL <b>COSU6029841</b>) has experienced a 3-day delay
          due to adverse weather conditions in the Indian Ocean. The vessel is currently routing through the South Atlantic
          and we expect arrival at Santos terminal on <b>2026-06-12</b> instead of the original ETA of 2026-06-09.</p>
        <p>Current vessel position: <span className="mono">-8.4°, -34.2°</span> · speed 16.2 kn · course 235°.</p>
        <p>We will provide further updates every 24h. Should you require any additional information, please reach out to your designated contact.</p>
        <p>Best regards,<br/><b>COSCO SHIPPING — Customer Service</b><br/>freight.ops@cosco.com</p>
        <div className="quote">
          <p>--- Histórico ---</p>
          <p>Em 11/mai, ops@verticalparts.com.br escreveu:</p>
          <p>Olá COSCO, gostaria de uma atualização sobre a posição do MV LIANJIANG referente ao nosso BL COSU6029841...</p>
        </div>
      </>
    );
    if (id === "em-2") return (
      <>
        <p>Hi Bruno,</p>
        <p>Attached please find the updated Proforma Invoice with the additional 5% supplier discount we discussed yesterday.
          The new total is <b>USD 96,440.00</b> FOB Shanghai for the 3 items of the CT-2026-116 quotation (Ed. Faria Lima Plaza retrofit).</p>
        <p>Could you please confirm by end of day Beijing time so we can lock production slot for the first week of June?</p>
        <p>Best regards,<br/><b>Liu Mei</b> · Sales Manager<br/>Tianjin Control Systems Co., Ltd.</p>
      </>
    );
    return <p>Nenhuma mensagem encontrada.</p>;
  }
  if (id === "em-6") return (
    <>
      <p>Boa tarde Cláudia,</p>
      <p>Confirmando que o motorista <b>Carlos Vieira</b> (placa GFR-2244) já está a caminho do CD Guarulhos para a coleta do
        frete <b>FR-2026-050</b>. Previsão de coleta às 11h e entrega no Hospital São Luiz Morumbi por volta das 18h.</p>
      <p>Total: <b>4 volumes</b> · 110kg · peças importadas para retrofit Gen2.</p>
      <p>Qualquer alteração eu aviso imediatamente.</p>
      <p>Att,<br/><b>Carlos Vieira</b> · Coord. Operações<br/>Patrus Transportes</p>
    </>
  );
  if (id === "em-7") return (
    <>
      <p>Prezados,</p>
      <p>Informamos que durante o transporte do frete <b>FR-2026-047</b> (destino Cond. Park Tower Itaim), registramos
        avaria leve em <b>2 caixas</b> (de um total de 8) contendo botoeiras de cabine. As caixas apresentaram danos
        externos sem aparente comprometimento do conteúdo, mas para resguardo da garantia, recomendamos inspeção
        prévia antes da assinatura do recebimento.</p>
      <p>Fotos em anexo (6 imagens) para registro.</p>
      <p>Aguardamos orientação sobre como proceder.</p>
      <p>Att,<br/><b>Setor de Ocorrências — TransLog SP</b></p>
    </>
  );
  return <p>Nenhuma mensagem encontrada.</p>;
}

Object.assign(window, { ImportacaoPage, ImportacaoDetail, ImportacaoRastreamento, ComprasPage, EmailInbox });
