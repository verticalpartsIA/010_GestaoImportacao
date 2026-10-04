/* ============================================================
   logistica.jsx — Importação (ship map) + Importação Varejo + Email Inbox
   ============================================================ */

/* ---------- Armadores suportados pela Sinay/Safecube Container Tracking API
   (código SCAC = parâmetro "sealine" da API) — lista das principais linhas
   globais citadas na doc; a API cobre 170+, isso aqui é só o que o time usa. */
const EI_SEALINES = [
  { code: 'MAEU', name: 'Maersk' },
  { code: 'MSCU', name: 'MSC' },
  { code: 'CMDU', name: 'CMA CGM' },
  { code: 'HLCU', name: 'Hapag-Lloyd' },
  { code: 'COSU', name: 'COSCO' },
  { code: 'EGLV', name: 'Evergreen' },
  { code: 'ONEY', name: 'ONE (Ocean Network Express)' },
  { code: 'YMLU', name: 'Yang Ming' },
  { code: 'HDMU', name: 'HMM' },
  { code: 'ZIMU', name: 'ZIM' },
  { code: 'PABV', name: 'Pan Ocean' },
  { code: 'WHLC', name: 'Wan Hai' },
];
function eiSealineName(code) { return (EI_SEALINES.find(s => s.code === code) || {}).name || code || ''; }

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

/* ---------- Diferença em dias entre 2 datas ISO (yyyy-mm-dd) ---------- */
function diffDiasISO(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((da - db) / 86400000);
}

/* 11/09 — achado real: quando uma Edge Function responde com status de
   erro (4xx/5xx), o cliente supabase-js devolve um `error` com mensagem
   SEMPRE genérica ("Edge Function returned a non-2xx status code") —
   o JSON de erro de verdade que a função manda (ex.: "Falha ao enviar
   e-mail via SMTP", "Nenhum destinatário válido") fica escondido dentro
   de `error.context` (a Response crua), e o toast mostrava só a
   mensagem genérica, inútil pro usuário entender o que deu errado. Esta
   função lê o corpo real quando existe. */
async function extrairErroFuncao(error) {
  if (!error) return 'Erro desconhecido';
  try {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json();
      if (body && body.error) return body.error + (body.detail ? ' — ' + body.detail : '');
    }
  } catch (e) { /* corpo não era JSON — segue pro fallback abaixo */ }
  return error.message || String(error);
}
/* 11/09 — confirmado via teste real (arquivo aleatório, não suposição):
   2.5MB passa, 3.5MB estoura WORKER_RESOURCE_LIMIT na Edge Function
   send-email (denomailer construindo o MIME do anexo). Espelha o mesmo
   limite fixado lá — avisa aqui ANTES de tentar enviar. */
const MAX_ANEXO_TOTAL = 2.5 * 1024 * 1024;
const EMAIL_VALIDO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validarEmails(destinatariosStr) {
  const lista = String(destinatariosStr || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!lista.length) return 'Digite ao menos um e-mail de destino.';
  const invalido = lista.find((e) => !EMAIL_VALIDO_RE.test(e));
  if (invalido) return `"${invalido}" não parece um e-mail válido (formato esperado: nome@dominio.com).`;
  return null;
}

/* ---------- Sincronização AIS (Edge Function ais-sync) ---------- */
async function runAisSync() {
  const { data, error } = await window.__VP_SB.sb.functions.invoke('ais-sync');
  if (error) { window.toast('Falha na sincronização AIS: ' + (error.message || error), 'error'); return null; }
  const modo = data && data.mode === 'ais' ? 'AIS' : 'simulação';
  window.toast(`Posições atualizadas (${(data && data.updated) || 0} navios · modo ${modo}).`, 'success');
  return data;
}

/* ---------- Documentos do embarque (checklist persistente) ---------- */
// Aceita tanto o formato antigo (strings "BL ✓") quanto o novo ({nome, pronto}).
function normDocs(docs) {
  return (docs || []).map(d =>
    typeof d === "string"
      ? { nome: d.replace(/\s*✓\s*$/, "").trim() || d, pronto: d.includes("✓") }
      : { nome: d.nome, pronto: !!d.pronto });
}

function DocsCard({ docs, onChange }) {
  const [novo, setNovo] = React.useState("");
  const list = normDocs(docs);
  const prontos = list.filter(d => d.pronto).length;

  const toggle = (i) => onChange(list.map((d, idx) => idx === i ? { ...d, pronto: !d.pronto } : d));
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => { const n = novo.trim(); if (!n) return; onChange([...list, { nome: n, pronto: false }]); setNovo(""); };

  return (
    <Card title="Documentos" sub={`${prontos}/${list.length} prontos`}>
      <div className="grid-3" style={{ gap: 10 }}>
        {list.map((d, i) => (
          <div key={i} onClick={() => toggle(i)} title="Clique para alternar pronto/pendente"
            style={{ padding: 12, background: d.pronto ? "var(--vp-success-tint)" : "var(--vp-gray-50)", border: "1px solid " + (d.pronto ? "var(--vp-success)" : "var(--border)"), display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Icon.fileText size={18} color={d.pronto ? "var(--vp-success)" : "var(--fg3)"}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{d.nome}</div>
              <div className="up-eyebrow" style={{ fontSize: 9, color: d.pronto ? "var(--vp-success-ink)" : "var(--fg3)" }}>{d.pronto ? "✓ pronto" : "pendente"}</div>
            </div>
            <button title="Remover" onClick={(ev) => { ev.stopPropagation(); remove(i); }}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg3)", padding: 2, lineHeight: 1 }}>
              <Icon.x size={12}/>
            </button>
          </div>
        ))}
        {list.length === 0 ? <div className="muted small" style={{ gridColumn: "1/-1" }}>Nenhum documento. Adicione abaixo.</div> : null}
      </div>
      <div className="row gap-2" style={{ marginTop: 12 }}>
        <input className="input" value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Novo documento (ex.: Certificado de Origem)" style={{ flex: 1 }}/>
        <Button variant="outline" size="sm" icon="plus" onClick={add}>Adicionar</Button>
      </div>
    </Card>
  );
}

/* ---------- MODAL: Novo Embarque ---------- */
function ModalNovoEmbarque({ onClose, onSaved, prefill }) {
  const [f, setF] = React.useState({
    client: prefill?.client || '', supplier: prefill?.supplier || '', vessel:'', imo:'', sealine:'',
    bl:'', invoiceNumber: prefill?.invoiceNumber || '',
    invoiceValue: prefill?.invoiceValue || '', invoiceCurrency: prefill?.invoiceCurrency || 'USD',
    containerNumber:'', seal:'', containers:'1', type:'40HC', freight:'FCL',
    from:'Xangai, CN', to:'Santos, BR',
    etd:'', eta:'', status:'Em trânsito', obraId:'',
  });
  const [saving, setSaving] = React.useState(false);
  const [obras, setObras] = React.useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  React.useEffect(() => {
    window.__VP_SB.sb.from('dossier_obra').select('id,client_name,building_name,city,state')
      .then(({ data }) => setObras(data || []));
  }, []);

  const save = async () => {
    if (!f.client.trim()) return window.toast('Cliente é obrigatório.', 'warning');
    if (!f.eta) return window.toast('ETA é obrigatória.', 'warning');
    setSaving(true);
    const id = 'EM-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('embarques').insert({
      id,
      client: f.client, supplier: f.supplier || null,
      project_id: f.obraId || null,
      cotacao_fornecedor_id: prefill?.cotacaoFornecedorId || null,
      numero_cotacao: prefill?.numeroCotacao != null ? prefill.numeroCotacao : null,
      vessel: f.vessel || null, imo: f.imo || null,
      line: f.sealine ? eiSealineName(f.sealine) : null, sealine: f.sealine || null,
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
      di_number: null, di_date: null,
      siscomex_status: f.status === "Entregue" ? "Desembaraçado"
        : f.status === "Aguardando liberação" ? "Em conferência aduaneira"
        : "Aguardando chegada do navio",
      milestones: buildMilestones(f.status, f.etd, f.eta), docs: [],
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Embarque criado!', 'success');
    onSaved?.(); onClose();
    // Posiciona o navio no mapa imediatamente (sem esperar o próximo sync manual).
    if (f.status !== 'Entregue') runAisSync();
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
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Obra (Dossiê) — vincula cidade/UF p/ transporte nacional</label>
          <select className="input" value={f.obraId} onChange={e => set('obraId', e.target.value)}>
            <option value="">— Sem vínculo —</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.building_name} · {o.client_name} ({o.city || '—'}/{o.state || '—'})</option>
            ))}
          </select>
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
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Armador (SCAC) — p/ rastreio automático</label>
            <select className="input" value={f.sealine} onChange={e => set('sealine', e.target.value)}>
              <option value="">— Selecione —</option>
              {EI_SEALINES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
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
  const [tab, setTab] = window.useRouteTab('importacao', 'embarques', ['embarques', 'documentos', 'aduana']);
  const [filter, setFilter] = React.useState("Todos");
  const [filterPorto, setFilterPorto] = React.useState("Todos");
  const [filterLinha, setFilterLinha] = React.useState("Todas");
  const [showEmbarque, setShowEmbarque] = React.useState(null); // null | {} (branco) | prefill
  const [aguardando, setAguardando] = React.useState([]);
  const filterOptions = ["Todos", "Em trânsito", "Aguardando liberação", "Entregue"];

  const reloadEmbarques = () => {
    setLoading(true);
    window.__VP_SB.sb.from('embarques').select('*').order('eta')
      .then(({ data }) => { setEmbarques(data || []); setLoading(false); });
    if (window.CotacaoElevadorFornecedorStore?.listarComprasAguardandoEmbarque) {
      window.CotacaoElevadorFornecedorStore.listarComprasAguardandoEmbarque()
        .then(setAguardando).catch(() => setAguardando([]));
    }
  };
  React.useEffect(() => { reloadEmbarques(); }, []);

  // Realtime (28/09): o cron ais-sync grava posição/status sem ninguém com a
  // tela aberta — sem isto, só via reload manual/F5 pra ver a mudança.
  React.useEffect(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    const canal = sb.channel('embarques-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'embarques' }, reloadEmbarques)
      .subscribe();
    return () => sb.removeChannel(canal);
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const rows = embarques
    .filter(e => filter === "Todos" || e.status === filter)
    .filter(e => filterPorto === "Todos" || (e.origin || e.from) === filterPorto || (e.destination || e.to) === filterPorto)
    .filter(e => filterLinha === "Todas" || e.line === filterLinha);
  const portosDisponiveis = ["Todos", ...new Set(embarques.flatMap(e => [e.origin || e.from, e.destination || e.to]).filter(Boolean))];
  const linhasDisponiveis = ["Todas", ...new Set(embarques.map(e => e.line).filter(Boolean))];

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
          <p className="page-head__sub">Embarques em trânsito + rastreamento marítimo por AIS</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="mail" onClick={() => setRoute("inbox")}>Inbox</Button>
          <Button variant="outline" icon="globe" onClick={() => setRoute("importacao-rastreamento")}>Mapa de navios</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowEmbarque({})}>Novo embarque</Button>
        </div>
      </div>

      {aguardando.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid #7c3aed', padding: 0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, fontSize:13 }}>Compras aguardando embarque <span style={{ color:'var(--fg3)' }}>({aguardando.length})</span></div>
            <span className="muted small">Compra confirmada no fornecedor · ainda sem embarque na Importação</span>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Cotação</th><th>Fornecedor</th><th>Cliente</th><th>FOB (USD)</th><th></th></tr></thead>
              <tbody>
                {aguardando.map((a) => (
                  <tr key={a.cotacaoFornecedorId}>
                    <td><div className="cell-main">{a.numeroCotacao != null ? window.MasterIdEngine.etapaId('cotacao', a.numeroCotacao) : (a.numeroDocumento || '—')}</div><div className="cell-sub">{a.numeroDocumento}</div></td>
                    <td>{a.fornecedor || '—'}</td>
                    <td>{a.clienteNome || '—'}</td>
                    <td className="cell-num">{a.fobUsd ? fmtUSD(a.fobUsd) : '—'}</td>
                    <td style={{ textAlign:'right' }}>
                      <Button variant="primary" size="sm" icon="plus" onClick={() => setShowEmbarque({
                        cotacaoFornecedorId: a.cotacaoFornecedorId, numeroCotacao: a.numeroCotacao,
                        client: a.clienteNome || '', supplier: a.fornecedor || '',
                        invoiceValue: a.fobUsd ? String(a.fobUsd) : '', invoiceCurrency: 'USD',
                      })}>Criar embarque</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {tab === "embarques" && <>
        <div className="tbar" style={{ marginTop: 20 }}>
          <div className="seg">
            {filterOptions.map(s => (
              <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
          <div className="spacer"/>
          <select className="input" style={{ width: 160 }} value={filterPorto} onChange={(e) => setFilterPorto(e.target.value)}>
            {portosDisponiveis.map(p => <option key={p} value={p}>{p === "Todos" ? "Porto: Todos" : p}</option>)}
          </select>
          <select className="input" style={{ width: 160 }} value={filterLinha} onChange={(e) => setFilterLinha(e.target.value)}>
            {linhasDisponiveis.map(l => <option key={l} value={l}>{l === "Todas" ? "Linha: Todas" : l}</option>)}
          </select>
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
                  Nenhum registro {embarques.length ? 'com esse filtro' : 'cadastrado'}.
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
                  <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      {tab === "documentos" && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table className="t">
            <thead><tr><th>Embarque</th><th>Nº Invoice</th><th>BL</th><th>Documentos anexados</th><th></th></tr></thead>
            <tbody>
              {embarques.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>Nenhum embarque cadastrado.</td></tr>
              )}
              {embarques.map((e) => (
                <tr key={e.id} onClick={() => { setSubsel(e); setRoute("importacao-detail"); }}>
                  <td><div className="cell-main">{e.id}</div><div className="cell-sub">{e.client}</div></td>
                  <td className="mono">{e.invoice_number || '—'}</td>
                  <td className="mono">{e.bl || '—'}</td>
                  <td>{(e.docs || []).length} documento{(e.docs || []).length === 1 ? '' : 's'}</td>
                  <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "aduana" && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table className="t">
            <thead><tr><th>Embarque</th><th>Canal</th><th>Status Siscomex</th><th>DI</th><th></th></tr></thead>
            <tbody>
              {embarques.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>Nenhum embarque cadastrado.</td></tr>
              )}
              {embarques.map((e) => (
                <tr key={e.id} onClick={() => { setSubsel(e); setRoute("importacao-detail"); }}>
                  <td><div className="cell-main">{e.id}</div><div className="cell-sub">{e.client}</div></td>
                  <td>{e.channel ? <Badge variant={e.channel === "Verde" ? "success" : e.channel === "Amarelo" ? "warning" : "danger"} dot>{e.channel}</Badge> : <span className="muted">—</span>}</td>
                  <td>{e.siscomex_status || '—'}</td>
                  <td className="mono">{e.di_number || '—'}</td>
                  <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEmbarque && <ModalNovoEmbarque prefill={showEmbarque} onClose={() => setShowEmbarque(null)} onSaved={reloadEmbarques}/>}
    </div>
  );
}

/* ---------- IMPORTAÇÃO detail ---------- */
function ImportacaoDetail({ embarque, setRoute }) {
  const [e, setE] = React.useState(embarque);
  const [syncing, setSyncing] = React.useState(false);
  const [reportando, setReportando] = React.useState(false);
  const [mapaAberto, setMapaAberto] = React.useState(false);
  const [mostrarTodosEventos, setMostrarTodosEventos] = React.useState(false);
  React.useEffect(() => { setE(embarque); }, [embarque]);

  // Realtime (28/09): status/posição/docs atualizam sozinhos nesta tela
  // quando o cron ais-sync (ou outra aba) grava — sem isto, `e` ficava
  // congelado no snapshot passado por `subsel` na navegação.
  React.useEffect(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb || !embarque?.id) return;
    const canal = sb.channel('embarque-detail-' + embarque.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'embarques', filter: `id=eq.${embarque.id}` },
        (payload) => { if (payload.new) setE(payload.new); })
      .subscribe();
    return () => sb.removeChannel(canal);
  }, [embarque?.id]);

  const refresh = async () => {
    setSyncing(true);
    await runAisSync();
    const { data } = await window.__VP_SB.sb.from('embarques').select('*').eq('id', embarque.id).single();
    if (data) setE(data);
    setSyncing(false);
  };

  const onDocsChange = async (newDocs) => {
    setE(prev => ({ ...prev, docs: newDocs }));
    const { error } = await window.__VP_SB.sb.from('embarques').update({ docs: newDocs }).eq('id', embarque.id);
    if (error) window.toast('Erro ao salvar documentos: ' + error.message, 'error');
  };

  const reportarChegada = async () => {
    if (e.chegada_confirmada_em) return;
    if (!window.confirm(`Confirmar chegada do navio ${e.vessel || e.id} no Brasil?\n\nIsso cria tarefas para Engenharia e Instalação prepararem o recebimento de "${e.client}".`)) return;
    setReportando(true);
    const now = new Date().toISOString();
    const dueTime = now.slice(0, 16).replace('T', ' ');
    const [{ error: errEmb }, { error: errEng }, { error: errInst }] = await Promise.all([
      window.__VP_SB.sb.from('embarques').update({ chegada_confirmada_em: now }).eq('id', e.id),
      window.__VP_SB.sb.from('tarefas').insert({
        title: `Chegada confirmada: preparar recebimento — ${e.client} (${e.id})`,
        module: 'Engenharia', priority: 'alta', due_time: dueTime, role: 'admin', done: false,
      }),
      window.__VP_SB.sb.from('tarefas').insert({
        title: `Chegada confirmada: agendar instalação — ${e.client} (${e.id})`,
        module: 'Instalação', priority: 'alta', due_time: dueTime, role: 'admin', done: false,
      }),
    ]);
    setReportando(false);
    const err = errEmb || errEng || errInst;
    if (err) return window.toast('Erro ao reportar chegada: ' + err.message, 'error');
    setE(prev => ({ ...prev, chegada_confirmada_em: now }));
    window.toast('Chegada reportada — tarefas criadas para Engenharia e Instalação.', 'success');
  };

  if (!e) {
    return <EmptyStateRedirect
      icon="ship"
      title="Nenhum embarque selecionado"
      message="Escolha um embarque na listagem para acompanhar a linha do tempo, posição do navio e documentos."
      ctaLabel="Ir para Importação"
      onCta={() => setRoute("importacao")}/>;
  }
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
            <span className="muted small">{e.last_ais_sync ? `AIS atualizado ${window.__VP_SB.timeAgo(e.last_ais_sync)}` : "AIS: aguardando 1ª sincronização"}</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="globe" onClick={() => setMapaAberto(true)}>Ver mapa</Button>
          <Button variant="outline" icon="mail" disabled title="Em desenvolvimento — ainda não envia e-mail ao fornecedor">Email fornecedor</Button>
          <Button variant="primary" icon="package" onClick={reportarChegada} disabled={reportando || !!e.chegada_confirmada_em}>
            {e.chegada_confirmada_em ? "Chegada confirmada ✓" : reportando ? "Reportando…" : "Reportar chegada"}
          </Button>
        </div>
      </div>

      <div className="split--wide split">
        <div className="stack">
          {(e.tracking_events || []).length > 0 ? (
            <Card title="Linha Do Tempo De Eventos" sub={`Rastreio Sinay/Safecube · ${(e.origin || e.from || "—")} → ${(e.destination || e.to || "—")}`}
              action={<Button variant="outline" size="sm" icon="globe" onClick={() => setMapaAberto(true)}>Ver mapa</Button>}>
              <div className="table-wrap">
                <table className="t">
                  <thead><tr>
                    <th>Data</th><th>Descrição</th><th>Localização</th><th>Navio</th>
                  </tr></thead>
                  <tbody>
                    {(mostrarTodosEventos ? e.tracking_events : e.tracking_events.slice(0, 3)).map((ev, i) => (
                      <tr key={i}>
                        <td className="mono small">{evDateTime(ev.date)}</td>
                        <td>{ev.description || "—"}</td>
                        <td>{ev.location || "—"}</td>
                        <td>{ev.vessel || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {e.tracking_events.length > 3 ? (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <Button variant="ghost" size="sm" onClick={() => setMostrarTodosEventos((v) => !v)}>
                    {mostrarTodosEventos ? "Mostrar menos" : `Mostrar mais (${e.tracking_events.length - 3})`}
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : (
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
              <p className="small muted" style={{ marginTop: 10 }}>
                Linha do tempo genérica — vira eventos reais (Container Arrival, Gate-In etc.) assim que a Sinay/Safecube sincronizar este embarque.
              </p>
            </Card>
          )}

          <Card title="Posição atual do navio" sub={(e.tracking_provider === 'sinay' ? "Rastreio Sinay/Safecube · " : "Simulação · ") + (e.last_ais_sync ? "atualizado " + window.__VP_SB.timeAgo(e.last_ais_sync) : "aguardando 1ª sync")}
            action={<Button variant="ghost" size="sm" icon="refresh" onClick={refresh} disabled={syncing}>{syncing ? "Atualizando…" : "Atualizar"}</Button>}>
            <div className="map-frame" style={{ height: 360 }}>
              <ShipMap mainShip={e}/>
            </div>
            <div className="grid-4" style={{ marginTop: 14 }}>
              <KvBlock label="Posição" value={e.lat ? `${e.lat}° / ${e.lng}°` : "—"} mono/>
              <KvBlock label="Velocidade" value={e.speed ? `${e.speed} kn` : "—"} mono/>
              <KvBlock label="Rumo" value={e.heading ? `${e.heading}°` : "—"} mono/>
              <KvBlock label="ETA atualizada" value={fmtDateLong(e.eta)}/>
            </div>
            {e.tracking_provider === 'sinay'
              ? <div className="grid-2" style={{ marginTop: 10 }}>
                  <KvBlock label="Status Sinay" value={e.tracking_status || '—'} mono/>
                  <KvBlock label="Atualizado (Sinay)" value={e.tracking_updated_at ? window.__VP_SB.timeAgo(e.tracking_updated_at) : '—'}/>
                </div>
              : (e.bl || e.container_number) && e.sealine
                ? <p className="small muted" style={{ marginTop: 10 }}>Ainda não sincronizado com a Sinay — clique "Atualizar" ou aguarde a sincronização diária.</p>
                : <p className="small muted" style={{ marginTop: 10 }}>Preencha BL/Container + Armador (SCAC) para habilitar rastreio real via Sinay/Safecube.</p>}
          </Card>

          <DocsCard docs={e.docs} onChange={onDocsChange}/>
        </div>

        <div className="stack">
          <Card title="Navio & Container" sharp>
            <KvBlock label="Navio" value={e.vessel}/>
            <KvBlock label="IMO" value={e.imo} mono/>
            <KvBlock label="Armador / Linha" value={e.line ? `${e.line}${e.sealine ? ' (' + e.sealine + ')' : ''}` : (e.sealine || '—')}/>
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

          <Card title="Aduana" sharp>
            <div className="row sb" style={{ marginBottom: 12 }}>
              <span className="up-eyebrow muted">Canal de parametrização</span>
              {e.channel
                ? <Badge variant={e.channel === "Verde" ? "success" : e.channel === "Amarelo" ? "warning" : "danger"} dot>{e.channel}</Badge>
                : <span className="muted">—</span>}
            </div>
            <KvBlock label="Nº DI / DUIMP" value={e.di_number || "—"} mono/>
            <KvBlock label="Registro DI" value={fmtDateLong(e.di_date)}/>
            <KvBlock label="Siscomex" value={e.siscomex_status || "—"}/>
            {e.channel === "Vermelho" ? (
              <div className="alert danger" style={{ marginTop: 8 }}><Icon.warning/><div><div className="alert__title">Canal vermelho</div><div className="alert__sub">Conferência documental + inspeção física</div></div></div>
            ) : e.channel === "Amarelo" ? (
              <div className="alert warning" style={{ marginTop: 8 }}><Icon.warning/><div><div className="alert__title">Canal amarelo</div><div className="alert__sub">Conferência documental</div></div></div>
            ) : e.channel === "Verde" ? (
              <div className="alert success" style={{ marginTop: 8 }}><Icon.check/><div><div className="alert__title">Canal verde</div><div className="alert__sub">Desembaraço automático previsto</div></div></div>
            ) : null}
          </Card>

          <Card title="Datas" sharp>
            <KvBlock label="ETD" value={fmtDateLong(e.etd)}/>
            <KvBlock label="ETA original" value={fmtDateLong(e.etaOriginal || e.eta_original)}/>
            <KvBlock label="ETA atualizada" value={fmtDateLong(e.eta)}/>
            {(e.etaOriginal || e.eta_original) && e.eta !== (e.etaOriginal || e.eta_original) ? (() => {
              const dias = diffDiasISO(e.eta, e.etaOriginal || e.eta_original);
              return (
                <div className="alert danger" style={{ marginTop: 8 }}>
                  <Icon.warning/>
                  <div>
                    <div className="alert__title">Atraso detectado</div>
                    <div className="alert__sub mono">Diferença: {dias > 0 ? "+" : ""}{dias} dia{Math.abs(dias) !== 1 ? "s" : ""}</div>
                    <div className="alert__sub">Pode impactar o cronograma de instalação — avise Engenharia/Instalação.</div>
                  </div>
                </div>
              );
            })() : null}
          </Card>

          <Card title="Trigger Financeiro" sharp>
            <div className="up-eyebrow muted">Gatilho de pagamento</div>
            <p className="small muted" style={{ marginTop: 4 }}>
              Ainda não existe gatilho financeiro automático ligado a embarques — o módulo de Gatilhos hoje cobre só a etapa comercial (formulário, precificação, proposta, fornecedor).
            </p>
            {e.invoice_value != null ? (
              <div style={{ marginTop: 10 }}>
                <div className="up-eyebrow muted">Valor da invoice (referência)</div>
                <div className="cell-money mono" style={{ fontSize: 16, fontWeight: 700 }}>
                  {e.invoice_currency === "BRL" ? fmtBRL(e.invoice_value) : fmtUSD(e.invoice_value)}
                </div>
              </div>
            ) : null}
            <Button variant="outline" size="sm" iconRight="arrowRight" style={{ width: "100%", marginTop: 10 }} onClick={() => setRoute("financeiro")}>Ver no Financeiro</Button>
          </Card>
        </div>
      </div>

      {mapaAberto ? <EmbarqueMapaModal embarque={e} onClose={() => setMapaAberto(false)}/> : null}
    </div>
  );
}

/* ---------- IMPORTAÇÃO · MAPA DE NAVIOS ====================== */
function ImportacaoRastreamento({ setRoute, setSubsel }) {
  const [embarques, setEmbarques] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState("Todos");
  const [filterEta, setFilterEta] = React.useState("Todos");
  const statusOptions = ["Todos", "Em trânsito", "Aguardando liberação", "Entregue"];
  const etaOptions = ["Todos", "Próximos 7 dias", "Próximos 30 dias", "Atrasados"];

  const load = React.useCallback(() => {
    return window.__VP_SB.sb.from('embarques').select('*').order('eta')
      .then(({ data }) => { setEmbarques(data || []); setLoading(false); });
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Realtime (28/09): a posição do navio (lat/lng/heading/speed) e o status
  // atualizam sozinhos no mapa e na lista quando o cron ais-sync grava —
  // sem isto só via "Atualizar" manual.
  React.useEffect(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    const canal = sb.channel('embarques-rastreamento')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'embarques' }, () => load())
      .subscribe();
    return () => sb.removeChannel(canal);
  }, [load]);

  const onSync = async () => { setSyncing(true); await runAisSync(); await load(); setSyncing(false); };

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const hoje = new Date().toISOString().slice(0, 10);
  const ships = embarques.filter(e => e.lat !== null && e.lat !== undefined)
    .filter(e => filterStatus === "Todos" || e.status === filterStatus)
    .filter(e => {
      if (filterEta === "Todos") return true;
      if (!e.eta) return false;
      if (filterEta === "Atrasados") return (e.eta_original || e.etaOriginal) && e.eta > (e.eta_original || e.etaOriginal);
      const dias = diffDiasISO(e.eta, hoje);
      if (filterEta === "Próximos 7 dias") return dias >= 0 && dias <= 7;
      if (filterEta === "Próximos 30 dias") return dias >= 0 && dias <= 30;
      return true;
    });
  const activeId = active || (ships[0] && ships[0].id) || null;
  const activeShip = ships.find(s => s.id === activeId);
  const lastSync = ships.map(s => s.last_ais_sync).filter(Boolean).sort().pop();

  return (
    <div className="page fade-in" style={{ paddingBottom: 32 }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("importacao")}>Voltar para Importação</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Rastreamento</div>
          <h1 className="page-head__title">Mapa Marítimo</h1>
          <p className="page-head__sub">Posição dos {ships.length} navio{ships.length !== 1 ? 's' : ''} · sincronização AIS{lastSync ? ` · atualizado ${window.__VP_SB.timeAgo(lastSync)}` : ' · aguardando 1ª sync'}</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh" onClick={onSync} disabled={syncing}>{syncing ? 'Atualizando…' : 'Atualizar'}</Button>
          <Button variant="outline" icon="download" disabled title="Em desenvolvimento — exportação do mapa ainda não implementada">Exportar relatório</Button>
        </div>
      </div>

      <div className="tbar" style={{ marginBottom: 16 }}>
        <div className="seg">
          {statusOptions.map(s => (
            <button key={s} className={filterStatus === s ? "is-active" : ""} onClick={() => setFilterStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="seg">
          {etaOptions.map(s => (
            <button key={s} className={filterEta === s ? "is-active" : ""} onClick={() => setFilterEta(s)}>{s}</button>
          ))}
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
              <Button variant="primary" size="sm" iconRight="arrowRight" style={{ width: "100%", marginTop: 8 }} onClick={() => { setSubsel?.(activeShip); setRoute("importacao-detail"); }}>Abrir embarque</Button>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Portos conhecidos (espelho client-side do PORTS da edge
   function ais-sync — só pra desenhar origem/destino no mapa real). ------ */
const EI_PORTS = {
  shanghai: [31.2, 121.5], xangai: [31.2, 121.5],
  ningbo: [29.8, 121.5], qingdao: [36.0, 120.4],
  hamburg: [53.55, 9.99], hamburgo: [53.55, 9.99],
  santos: [-23.95, -46.3], itaguai: [-22.86, -43.75], "itaguaí": [-22.86, -43.75],
};
function eiPortCoords(nome) {
  if (!nome) return null;
  const k = nome.toLowerCase();
  for (const p in EI_PORTS) if (k.includes(p)) return EI_PORTS[p];
  return null;
}

/* ---------- Waypoints de rota marítima real (não em linha reta!) ---------
   Uma reta lat/lng entre Xangai e Santos corta direto o continente africano
   — navio não anda em terra seca. Os pontos abaixo seguem corredores de
   navegação reais (Estreito de Malaca → Oceano Índico → Cabo da Boa
   Esperança → Atlântico Sul), permanecendo sempre sobre água. */
function eiRouteWaypoints(origin, destino) {
  if (!origin || !destino) return [origin, destino].filter(Boolean);
  const isAsia = (p) => p[1] > 90;
  const isBrasil = (p) => p[0] < 5 && p[1] < -30;
  const isEuropa = (p) => p[0] > 40 && p[1] > -15 && p[1] < 35;

  if ((isAsia(origin) && isBrasil(destino)) || (isBrasil(origin) && isAsia(destino))) {
    const asia = isAsia(origin) ? origin : destino;
    const brasil = isBrasil(origin) ? origin : destino;
    // Estreito de Malaca → Índico → Cabo da Boa Esperança → Atlântico Sul.
    const chain = [asia, [1.3, 103.8], [-6, 78], [-34.8, 20], [-25, -8], brasil];
    return isAsia(origin) ? chain : chain.slice().reverse();
  }
  if ((isEuropa(origin) && isBrasil(destino)) || (isBrasil(origin) && isEuropa(destino))) {
    const europa = isEuropa(origin) ? origin : destino;
    const brasil = isBrasil(origin) ? origin : destino;
    const chain = [europa, [43, -10], [15, -22], brasil];
    return isEuropa(origin) ? chain : chain.slice().reverse();
  }
  return [origin, destino];
}

/* ---------- Formata datetime de evento real da Sinay (ISO completo ou
   só data) no padrão "AAAA-MM-DD HH:mm" que o Safecube usa. ------------- */
function evDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v).slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- Modal grande: mapa real (Leaflet) com trocador de estilo
   Claro/Escuro/Ruas/Satélite — engenharia reversa do "Ver mapa" do
   Safecube/Sinay (fornecedor da nossa API de rastreio). ------------------ */
const EI_MAP_STYLES = [
  { key: "claro", label: "Claro",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS", tms: false, routeColor: "#334155" },
  { key: "escuro", label: "Escuro",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS", tms: false, routeColor: "#e5e7eb" },
  { key: "ruas", label: "Ruas",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors", subdomains: "abc", routeColor: "#1d4ed8" },
  { key: "satelite", label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics", routeColor: "#facc15" },
];

function EmbarqueMapaModal({ embarque: e, onClose }) {
  const mapElRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const layerRef = React.useRef(null);
  const routeRef = React.useRef(null);
  const [styleKey, setStyleKey] = React.useState("escuro");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  React.useEffect(() => {
    const fn = (ev) => { if (ev.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Cria o mapa uma única vez.
  React.useEffect(() => {
    if (!window.L || !mapElRef.current || mapRef.current) return;
    const map = window.L.map(mapElRef.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    const origin = eiPortCoords(e.origin || e.from);
    const destino = eiPortCoords(e.destination || e.to);
    const atual = (e.lat != null && e.lng != null) ? [e.lat, e.lng] : null;
    const rota = eiRouteWaypoints(origin, destino);
    const pontos = [...rota, atual].filter(Boolean);

    const shipIcon = window.L.divIcon({
      className: "", html: '<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">🚢</div>',
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    const portIcon = (cor) => window.L.divIcon({
      className: "", html: `<div style="width:12px;height:12px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
      iconSize: [12, 12], iconAnchor: [6, 6],
    });

    if (origin) window.L.marker(origin, { icon: portIcon("#334155") }).addTo(map).bindTooltip(e.origin || e.from || "Origem");
    if (destino) window.L.marker(destino, { icon: portIcon("#dc2626") }).addTo(map).bindTooltip(e.destination || e.to || "Destino");
    if (atual) window.L.marker(atual, { icon: shipIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip(e.vessel || "Navio", { permanent: false });

    if (pontos.length >= 2) map.fitBounds(window.L.latLngBounds(pontos), { padding: [60, 60] });
    else if (pontos.length === 1) map.setView(pontos[0], 4);
    else map.setView([10, 30], 2);

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de tile layer + cor da rota conforme o estilo escolhido.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    const cfg = EI_MAP_STYLES.find((s) => s.key === styleKey) || EI_MAP_STYLES[0];

    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = window.L.tileLayer(cfg.url, {
      attribution: cfg.attribution, subdomains: cfg.subdomains || "abc", maxZoom: 19,
    }).addTo(map);
    layerRef.current.bringToBack();

    if (routeRef.current) map.removeLayer(routeRef.current);
    const origin = eiPortCoords(e.origin || e.from);
    const destino = eiPortCoords(e.destination || e.to);
    if (origin && destino) {
      routeRef.current = window.L.polyline(eiRouteWaypoints(origin, destino), {
        color: cfg.routeColor, weight: 2, opacity: 0.85, dashArray: "1 8", lineCap: "round", smoothFactor: 2,
      }).addTo(map);
    }
  }, [styleKey]);

  // Reflow do mapa quando o modal terminou de animar/redimensionar.
  React.useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [fullscreen]);

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  };
  React.useEffect(() => {
    const fn = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  return (
    <div className="modal-shroud" onClick={onClose}>
      <div ref={shellRef} onClick={(ev) => ev.stopPropagation()}
        style={{
          width: "min(1180px, 94vw)", height: "min(760px, 90vh)",
          background: "#0b1220", display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.45)",
        }}>
        <div className="row sb" style={{ padding: "14px 18px", background: "#111a2e", flex: "0 0 auto" }}>
          <div>
            <div className="up-eyebrow" style={{ color: "#94a3b8" }}>{e.id} · {e.line || e.sealine}</div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{e.vessel || "Rastreamento marítimo"}</div>
          </div>
          <div className="row gap-2">
            <span className="mono small" style={{ color: "#94a3b8" }}>
              {(e.origin || e.from || "—")} → {(e.destination || e.to || "—")}
            </span>
            <button onClick={onClose} title="Fechar"
              style={{ border: "none", background: "rgba(255,255,255,.08)", color: "#fff", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon.x size={16}/>
            </button>
          </div>
        </div>

        <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
          <div ref={mapElRef} style={{ position: "absolute", inset: 0 }}/>

          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 400 }}>
            <button onClick={() => setPickerOpen((o) => !o)} title="Estilo do mapa"
              style={{ width: 34, height: 34, border: "none", background: "#111a2e", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
              <Icon.layers size={16}/>
            </button>
            {pickerOpen ? (
              <div style={{ marginTop: 6, background: "#111a2e", boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 120, overflow: "hidden" }}>
                {EI_MAP_STYLES.map((s) => (
                  <div key={s.key} onClick={() => { setStyleKey(s.key); setPickerOpen(false); }}
                    style={{
                      padding: "9px 14px", fontSize: 13, cursor: "pointer", color: "#fff",
                      background: styleKey === s.key ? "#2b3a5c" : "transparent",
                    }}>
                    {s.label}
                  </div>
                ))}
              </div>
            ) : null}
            <button onClick={toggleFullscreen} title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              style={{ marginTop: 6, width: 34, height: 34, border: "none", background: "#111a2e", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
              <Icon.expand size={15}/>
            </button>
          </div>
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
        <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,.6)", fontFamily: "var(--font-mono)" }}>Rastreamento AIS</div>
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
        <div className="map-ship__label">{(ship.vessel || 'Navio a definir').replace("MV ", "")}</div>
      </div>
    </>
  );
}

/* ---------- IMPORTAÇÃO VAREJO — movida pra src/importacao-varejo.jsx =
   29/09/2026: a casca vazia que existia aqui (ex-"Compras Nacional",
   esvaziada no PR #496 pra reserva de processo novo) virou o módulo real
   de estoque/sugestão de compra (`ImportacaoVarejoPage`, arquivo próprio
   `src/importacao-varejo.jsx` + `-store.js`, Edge Functions
   list-importacao-varejo/sync-importacao-varejo/
   criar-requisicao-compra-importacao-varejo). Rota/menu continuam com o
   id interno `compras` — ver `case "compras"` em app.jsx/print-app.jsx. */

/* ---------- EMAIL INBOX (Importação + Compras) ============== */
/* 30/09 — pedido do usuário: "as respostas dos fornecedores devem aparecer
   dentro do Inbox". O fornecedor (ex.: Glarie) costuma responder pelo
   FORMULÁRIO do link (cotacoes_elevador_fornecedor.respostas), nunca pela
   caixa suporte@ — então essas respostas não apareciam aqui, só as por
   e-mail. Bloco SOMENTE LEITURA, separado da lista de e-mails: não toca em
   emails_projeto, vínculo, matching nem soft-delete. */
function InboxRespostasFormulario({ onAbrir, verOk, liberado }) {
  const [itens, setItens] = React.useState(null);
  React.useEffect(() => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setItens([]); return; }
    let vivo = true;
    sb.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, responded_at, respostas, dados_envio')
      .not('responded_at', 'is', null).is('excluido_em', null)
      .order('responded_at', { ascending: false }).limit(6)
      .then(async ({ data }) => {
        const linhas = data || [];
        /* 04/10 — Inbox fase 1: estas respostas (com preço) não passam por emails_projeto, então a regra de dono
           também vale aqui: o dono é o vendedor da cotação (formularios_elevador.created_by). */
        const nums = [...new Set(linhas.map((c) => c.dados_envio && c.dados_envio.header ? c.dados_envio.header.numero_cotacao : null).filter((n) => n != null))];
        let donos = {};
        if (nums.length) {
          const { data: fs } = await sb.from('formularios_elevador').select('numero_cotacao, created_by').in('numero_cotacao', nums);
          (fs || []).forEach((f) => { donos[f.numero_cotacao] = f.created_by ? String(f.created_by).toLowerCase() : null; });
        }
        if (vivo) setItens(linhas.filter((c) => {
          const n = c.dados_envio && c.dados_envio.header ? c.dados_envio.header.numero_cotacao : null;
          return !verOk || verOk(n != null ? (donos[n] || null) : null);
        }));
      })
      .catch(() => { if (vivo) setItens([]); });
    return () => { vivo = false; };
  }, [liberado]);
  if (!itens || itens.length === 0) return null;
  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle, rgba(0,0,0,.03))' }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Respostas de fornecedores pelo formulário (link)</div>
      {itens.map((c) => {
        const num = c.dados_envio && c.dados_envio.header ? c.dados_envio.header.numero_cotacao : null;
        const total = ((c.respostas && c.respostas.itens) || []).reduce((t, it) => t + (Number(it.preco_total) || 0), 0);
        const moeda = (c.respostas && c.respostas.moeda) || 'USD';
        return (
          <div key={c.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', cursor: num != null ? 'pointer' : 'default' }}
            onClick={(ev) => num != null && onAbrir(ev, num)}>
            <span><b>{c.fornecedor}</b> respondeu {c.numero_documento}{total > 0 ? ` — ${moeda} ${total.toLocaleString('pt-BR')}` : ''}</span>
            <span className="muted">{c.responded_at ? new Date(c.responded_at).toLocaleString('pt-BR') : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

/* 01/10 — rótulo curto por `referencia_tipo`, só pra deixar visível na
   lista/detalhe de qual documento veio o e-mail (RFQ/Proposta/Contrato/
   Tratativa) — antes só se via o Nº da cotação, sem saber qual dos 4+
   fluxos que compartilham o mesmo Nº gerou aquele e-mail específico.
   Puramente de exibição — não influencia nenhum vínculo/matching. */
const INBOX_REFERENCIA_TIPO_LABEL = {
  cotacao_fornecedor: 'RFQ ao fornecedor',
  proposta: 'Proposta',
  contrato_venda: 'Contrato de Venda',
  contrato_instalador: 'Contrato Instalador',
  tratativa_cotacao: 'Tratativa',
};

/* 10/09 — IMAP conectado de verdade (Edge Function read-inbox, mesma
   caixa suporte@vpsistema.com usada pra enviar em send-email). Movida do
   módulo Comercial pro módulo Geral no mesmo dia — pedido do usuário: é
   uma caixa só, compartilhada por Comercial/Compras/Importação/quem mais
   precisar, não faz sentido morar dentro de um módulo específico. Botão
   "Inbox" dentro de Importação/Compras aponta pra cá também (mesma rota).
   Sem categorização automática por módulo ainda (não fabrica um filtro
   que não existe). Sem cron: busca só quando a tela abre/atualiza. */
function EmailInbox({ setRoute, setSubsel }) {
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState(null);
  const [activeId, setActiveId] = React.useState(null);
  const [folder, setFolder] = React.useState("inbox");
  const [enviados, setEnviados] = React.useState([]);
  const [carregandoEnviados, setCarregandoEnviados] = React.useState(false);
  /* 04/10 — Inbox fase 1: DONO do e-mail + permissões (Administração › Alçadas › Inbox). Quem vê o quê vem de
     src/inbox-visibilidade.js (regras testadas): é meu → vejo; senão pelas alçadas ver_todos/equipe/departamento/áreas/triagem.
     Começa liberado para todos. `perm` = undefined enquanto carrega, null se falhou (aí mostra tudo: organização na
     tela, não isolamento — ver CLAUDE.md/#571). Não toca leitura/vínculo/envio. */
  const meta = (window.useInboxMeta || (() => ({ ia: {}, dono: {}, pronto: true })))(emails);
  const perm = (window.useInboxPermissoes || (() => null))();
  const verOk = (dono, atribuido) => !perm || !window.InboxVisibilidade || window.InboxVisibilidade.podeVer(dono, perm, atribuido);
  const pode = (c) => !perm || !!(perm.flags && perm.flags[c]);
  const podeExcluirDe = (dono) => !perm || (pode('excluir') && String(dono || '').toLowerCase() === perm.eu) || pode('excluir_de_outros');
  /* Normaliza as linhas de emails_projeto (saida) pro mesmo formato que
     read-inbox devolve — reusa a mesma lista/detalhe sem duplicar JSX.
     "Para" vira o indicador principal (não "De", que seria sempre a
     própria caixa suporte@vpsistema.com — inútil pra escanear a lista). */
  const enviadosNormalizados = React.useMemo(() => enviados.filter((e) => perm === undefined ? false : verOk(e.dono_email || null, e.atribuido_a || null)).map((e) => ({
    id: e.id,
    _pasta: 'sent',
    dono: e.dono_email || null,
    atribuido: e.atribuido_a || null,
    from: (e.para && e.para[0]) || '',
    fromName: 'Para: ' + ((e.para || []).join(', ') || '—'),
    subject: e.assunto || '(sem assunto)',
    date: e.data_mensagem,
    unread: false,
    preview: (e.corpo_texto || '').slice(0, 2000),
    html: e.corpo_html || null,
    numeroCotacao: e.numero_cotacao,
    vinculoConfianca: e.vinculo_confianca,
    referenciaTipo: e.referencia_tipo,
    anexos: (e.anexos || []).map((a) => ({ ...a, url: a.url || null })),
    to: e.para || [],
    cc: [],
  })), [enviados, perm]);
  /* 22/09 — lixeira: soft-delete só no site (excluido_em em emails_projeto),
     NUNCA mexe na caixa real via IMAP. Caixa de entrada vem de um fetch ao
     vivo (read-inbox), que não sabe de exclusões — por isso filtra aqui,
     contra a lista de ids já marcados como excluídos no banco. */
  const [excluidos, setExcluidos] = React.useState([]);
  const carregarExcluidos = React.useCallback(() => {
    window.__VP_SB.sb.from('emails_projeto').select('id').not('excluido_em', 'is', null).limit(500)
      .then(({ data }) => setExcluidos((data || []).map((d) => d.id)));
  }, []);
  React.useEffect(() => { carregarExcluidos(); }, [carregarExcluidos]);
  const emailsVisiveis = React.useMemo(() => (perm === undefined || !meta.pronto) ? []
    : emails.filter((e) => !excluidos.includes(e.id)).filter((e) => verOk(meta.dono[e.id] || null, (meta.atribuido || {})[e.id] || null)), [emails, excluidos, meta, perm]);
  /* 04/10 — triagem silenciosa (estilo JEV, só regras; autorizada pelo usuário): a decisão (assunto/departamento/
     prioridade/confiança) é calculada no banco e só LIDA aqui (inbox-triagem.jsx). Esconde apenas e-mail automático
     com confiança suficiente (nunca apaga; "ver tudo" devolve) e destaca o que precisa de resposta. Sem classificação,
     a tela se comporta exatamente como antes. Não toca leitura/vínculo/envio/exclusão. */
  const iaMapa = meta.ia;
  /* Fase 2 (04/10): lido/estrela POR PESSOA, troca de responsável, aviso ao responder e-mail de outro, pop-up de vínculo. */
  const { estado, marcarLido, definirLido, alternarEstrela, arquivar, adiar } = (window.useInboxEstado || (() => ({ estado: {}, marcarLido() {}, definirLido() {}, alternarEstrela() {}, arquivar: async () => false, adiar: async () => false })))([...emails, ...enviados]);
  /* Fase 4A (04/10): marcadores (pessoal/equipe), arquivar e suspender POR PESSOA, spam compartilhado — ver inbox-organizar*.js */
  const mk = (window.useInboxMarcadores || (() => ({ marcadores: [], porEmail: {}, pronto: true, criar: async () => 'Marcadores indisponíveis.', apagar: async () => null, aplicar: async () => null })))([...emails, ...enviados]);
  const [modalMarcador, setModalMarcador] = React.useState(false);
  const [, setTick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);   // e-mail suspenso volta sozinho na hora marcada, com a tela aberta
  const naoLida = (m) => (window.InboxTriagem ? window.InboxTriagem.naoLidaPara(m.unread, estado[m.id]) : m.unread);
  const [atribuirAberto, setAtribuirAberto] = React.useState(false);
  const [avisoOutro, setAvisoOutro] = React.useState(null);        // { modo, responsavel }
  const [popupVinculo, setPopupVinculo] = React.useState(null);    // resultado de inboxBuscarSugestao
  const avisoConfirmado = React.useRef({});                         // e-mails de outra pessoa que já confirmei responder
  const numeroForcado = React.useRef(null);
  const vinculoDecidido = React.useRef(false);
  const [foco, setFoco] = React.useState(true);
  const politicaDe = (m) => (window.InboxTriagem ? window.InboxTriagem.politica(iaMapa[m.id], { vinculado: m.numeroCotacao != null }) : 'normal');
  const silenciosos = folder === 'inbox' ? emailsVisiveis.filter((m) => politicaDe(m) === 'silencioso') : [];
  const importantes = folder === 'inbox' ? emailsVisiveis.filter((m) => politicaDe(m) === 'precisa_de_voce').map((m) => ({ ...m, decisao: iaMapa[m.id] })) : [];
  /* Fase 2: responsável (dono ou atribuído), sugestão de cotação (JEV) e vínculo em 1 clique. */
  const donoDe = (m) => (m ? ((m.dono !== undefined ? m.dono : meta.dono[m.id]) || null) : null);
  const atribuidoDe = (m) => (m ? ((m.atribuido !== undefined ? m.atribuido : (meta.atribuido || {})[m.id]) || null) : null);
  /* Fase 3 (04/10) — fluxo de lista estilo Gmail: pasta → pesquisa (operadores) → ordem → seleção em massa.
     Pasta + pesquisa olham o que já está carregado na tela (Caixa de entrada + Enviados); histórico completo = fase 4. */
  const [prefs, atualizarPrefs] = (window.useInboxPrefs || (() => [{ densidade: 'padrao', painel: 'direita', ordem: 'padrao' }, () => {}]))();
  const [configAberta, setConfigAberta] = React.useState(false);
  const [ajudaAba, setAjudaAba] = React.useState(null);              // null | 'guia' | 'passo'
  const [novoInicial, setNovoInicial] = React.useState(null);        // { para, assunto } — ex.: feedback
  const [selecionados, setSelecionados] = React.useState(() => new Set());
  const eu = perm ? perm.eu : String((window.__VP_USER || {}).email || '').toLowerCase();
  const ehEnviado = (m) => !!m && m._pasta === 'sent';
  const respDe = (m) => (window.InboxTriagem ? window.InboxTriagem.responsavelDe(donoDe(m), atribuidoDe(m)) : null);
  const estrelaDe = (m) => !!(estado[m.id] && estado[m.id].estrela);
  const todasLinhas = [...emailsVisiveis, ...enviadosNormalizados];
  const eMeu = (m) => !!respDe(m) && respDe(m) === eu;
  const semResp = (m) => !ehEnviado(m) && !donoDe(m) && !atribuidoDe(m);
  const O = window.InboxOrganizar;
  const spamDe = (m) => !!(meta.spam && meta.spam[m.id]);
  const marcadorPorId = Object.fromEntries((mk.marcadores || []).map((x) => [x.id, x]));
  const mkArvore = O ? O.arvoreMarcadores(mk.marcadores || []) : [];
  const capsOrg = { editar: pode('editar'), triagem: !perm || !!(perm.caps && perm.caps.triagem), ver_todos: !perm || !!(perm.caps && perm.caps.ver_todos) };
  /* quem aparece em cada pasta (arquivado/suspenso/spam/marcador) vem de inbox-organizar-calc.js — regra única e testada */
  const ctxPasta = { ehEnviado, estado: (m) => estado[m.id], spam: spamDe, eMeu, semResp, marcadores: (m) => mk.porEmail[m.id] || [], agora: new Date() };
  const pastaLinhas = (id) => {
    const base = id === 'inbox' ? (foco ? emailsVisiveis.filter((m) => politicaDe(m) !== 'silencioso') : emailsVisiveis) : todasLinhas;
    return O ? base.filter((m) => O.visivelNaPasta(m, id, ctxPasta)) : base;
  };
  const [busca, setBusca] = React.useState('');
  const consulta = window.InboxBusca ? window.InboxBusca.parseConsulta(busca) : null;
  const buscando = !!(consulta && !window.InboxBusca.vazia(consulta));
  const pastaEfetiva = buscando ? (consulta.em || 'all') : folder;           // pesquisar sem "em:" olha todas as mensagens, como no Gmail
  const listaAtual = pastaLinhas(pastaEfetiva);
  // nos Enviados o remetente é a nossa caixa e a outra ponta é o destinatário (`de:` e `para:` precisam refletir isso)
  const paraBusca = (m) => ({ ...m, ...(ehEnviado(m) ? { from: 'suporte@vpsistema.com', fromName: 'VerticalParts' } : {}), naoLida: naoLida(m), estrela: estrelaDe(m),
    marcadoresNomes: (mk.porEmail[m.id] || []).map((id) => marcadorPorId[id] && marcadorPorId[id].nome).filter(Boolean) });
  const listaFiltrada0 = buscando ? listaAtual.filter((m) => window.InboxBusca.aplicar(paraBusca(m), consulta)) : listaAtual;
  const listaFiltrada = window.InboxBusca
    ? window.InboxBusca.ordenar(listaFiltrada0, prefs.ordem, { naoLida, estrela: estrelaDe, importante: (m) => politicaDe(m) === 'precisa_de_voce' }) : listaFiltrada0;
  const active = listaFiltrada.find((e) => e.id === activeId) || todasLinhas.find((e) => e.id === activeId);   // o e-mail aberto continua aberto mesmo que a pesquisa o esconda
  const nomeDe = (email) => { const p = ((perm && perm.colaboradores) || []).find((x) => String(x.email).toLowerCase() === String(email || '').toLowerCase()); return (p && p.nome) || email; };
  const pontaAtiva = active ? (ehEnviado(active) ? (active.to || []).join(',') : active.from) : '';
  const sugAtiva = (window.useSugestaoVinculo || (() => null))(active, pontaAtiva);
  const [vinculandoSug, setVinculandoSug] = React.useState(false);
  const vincularA = async (numero) => {
    if (!active) return;
    if (!pode('editar')) { window.toast?.('Sem permissão para vincular (alçada Inbox › Editar).', 'warning'); return; }
    setVinculandoSug(true);
    try {
      const { error } = await window.__VP_SB.sb.from('emails_projeto').update({ numero_cotacao: numero, vinculo_confianca: 'certo' }).eq('id', active.id);
      if (error) throw error;
      window.toast?.(`Vinculado à Cotação Nº ${numero}.`, 'success');
      carregar(); carregarEnviados(); if (meta.recarregar) meta.recarregar();
    } catch (e) { window.toast?.('Erro ao vincular: ' + (e.message || e), 'error'); }
    finally { setVinculandoSug(false); }
  };

  /* 28/09 — pedido do usuário: campo de busca no Inbox (não existia nenhum,
     só filtro por pasta e por Nº Cotação pra vínculo manual). Filtro em
     memória sobre a lista já carregada (assunto/remetente/preview/nº
     cotação) — não é busca no histórico completo de emails_projeto, só na
     janela recente que read-inbox/Enviados já trazem. Limpa ao trocar de
     pasta pra não confundir "sem resultado" com "pasta vazia". */
  /* 04/10 (fase 3): `busca`, `consulta` e `listaFiltrada` agora vivem no fluxo de lista mais acima (operadores estilo Gmail,
     inbox-busca-calc.js). A seleção em massa zera quando a pasta ou a pesquisa muda. */
  React.useEffect(() => { setSelecionados(new Set()); }, [folder, busca]);

  const [respondendo, setRespondendo] = React.useState(false);
  const [modoCompose, setModoCompose] = React.useState('responder'); // 'responder' | 'responder-todos' | 'encaminhar'
  const [destinatarioEncaminhar, setDestinatarioEncaminhar] = React.useState('');
  const [respostaTexto, setRespostaTexto] = React.useState('');
  const [enviandoResposta, setEnviandoResposta] = React.useState(false);
  const [sugerindoIA, setSugerindoIA] = React.useState(false);
  const [vinculando, setVinculando] = React.useState(false);
  const [vincularInput, setVincularInput] = React.useState('');
  const [salvandoVinculo, setSalvandoVinculo] = React.useState(false);
  const [anexosResposta, setAnexosResposta] = React.useState([]);
  const [gatilhoAberto, setGatilhoAberto] = React.useState(null);
  const [marcandoGatilho, setMarcandoGatilho] = React.useState(false);
  const [novoEmailAberto, setNovoEmailAberto] = React.useState(false);

  const carregar = React.useCallback(() => {
    setLoading(true); setErro(null);
    window.__VP_SB.sb.functions.invoke('read-inbox', { body: { limit: 25 } }).then(({ data, error }) => {
      if (error) { setErro(error.message || String(error)); setEmails([]); return; }
      if (data && data.error) { setErro(data.error); setEmails([]); return; }
      setEmails((data && data.messages) || []);
    }).catch((e) => setErro(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  /* Realtime (28/09, área blindada — CLAUDE.md): o cron read-inbox-poll já
     grava resposta de fornecedor em emails_projeto (direcao='entrada') a
     cada 10 min mesmo sem ninguém com a tela aberta; sem isto, quem já
     estava com a Inbox aberta só via a resposta nova fechando e reabrindo a
     tela. NÃO troca a leitura por emails_projeto (isso sim mexeria na
     lógica de vínculo/matching) — só chama de novo o mesmíssimo `carregar`
     acima (a mesma chamada do refresh manual, via read-inbox/IMAP). `active`
     é só um id (linha ~1390), então a thread aberta e a resposta em
     digitação (`respondendo`/`respostaTexto`) não são afetadas por este
     refetch. */
  React.useEffect(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    const canal = sb.channel('emails-projeto-entrada')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails_projeto', filter: 'direcao=eq.entrada' }, carregar)
      .subscribe();
    return () => sb.removeChannel(canal);
  }, [carregar]);

  /* 11/09 — achado real do usuário: mandou o RFQ pra fornecedora, não
     apareceu em lugar nenhum ("não vi ela na inbox") — na verdade tinha
     sido enviado com sucesso (confirmado em emails_projeto), só que
     "Enviados" era um placeholder que nunca lia dado real. E-mail que a
     gente manda não passa pelo IMAP de entrada — vem direto de
     emails_projeto (direcao='saida'), gravado pelo próprio send-email. */
  /* 14/09 — achado real (auditoria do tour.md): anexos de "Enviados" nunca
     tinham link de download (badge sem href), mesmo com o arquivo salvo de
     verdade no Storage — só a Caixa de Entrada gerava link (via read-inbox,
     que assina com a chave de serviço do Supabase, não a chave anônima). O
     bucket emails-anexos nega SELECT pra anon (só authenticated/chave de
     serviço), então o navegador não consegue assinar sozinho: precisa da
     edge function sign-email-anexos, que faz exatamente o mesmo que
     read-inbox já fazia pros anexos recebidos. */
  const carregarEnviados = React.useCallback(() => {
    setCarregandoEnviados(true);
    window.__VP_SB.sb.from('emails_projeto').select('*').eq('direcao', 'saida').is('excluido_em', null)
      .order('data_mensagem', { ascending: false }).limit(50)
      .then(async ({ data }) => {
        const rows = data || [];
        const paths = [...new Set(rows.flatMap((r) => (r.anexos || []).map((a) => a.path).filter(Boolean)))];
        if (!paths.length) { setEnviados(rows); return; }
        try {
          const { data: signed, error } = await window.__VP_SB.sb.functions.invoke('sign-email-anexos', { body: { paths } });
          const urls = (!error && signed && signed.urls) || {};
          setEnviados(rows.map((r) => ({
            ...r,
            anexos: (r.anexos || []).map((a) => ({ ...a, url: (a.path && urls[a.path]) || null })),
          })));
        } catch (e) {
          console.warn('[Inbox] falha ao assinar anexos de Enviados', e);
          setEnviados(rows);
        }
      }).finally(() => setCarregandoEnviados(false));
  }, []);
  React.useEffect(() => { carregarEnviados(); }, [carregarEnviados]);
  React.useEffect(() => {
    setRespondendo(false); setModoCompose('responder'); setDestinatarioEncaminhar('');
    setRespostaTexto(''); setVinculando(false); setVincularInput(''); setAnexosResposta([]); setGatilhoAberto(null);
  }, [activeId]);

  /* Sugestão de gatilho (10/09) — não dispara sozinho: um e-mail chegando
     não prova que É a resposta do fornecedor (pode ser só "recebido,
     aguarde"). Só avisa quando existe um nó SLA_FORNECEDOR aberto pra
     essa cotação, e deixa o vendedor decidir clicando. */
  React.useEffect(() => {
    if (!active || active.numeroCotacao == null) { setGatilhoAberto(null); return; }
    let cancelado = false;
    window.__VP_SB.sb.from('gatilhos').select('id, alvo_id')
      .eq('numero_cotacao', active.numeroCotacao).eq('evento_key', 'SLA_FORNECEDOR').is('concluido_em', null).maybeSingle()
      .then(({ data }) => { if (!cancelado) setGatilhoAberto(data || null); });
    return () => { cancelado = true; };
  }, [active && active.id, active && active.numeroCotacao]);

  /* 22/09 — pedido do usuário: botão de lixeira, mas NUNCA exclui sem
     perguntar antes. Soft-delete (excluido_em) — o e-mail continua na
     caixa real (IMAP)/no banco, só some da lista do site. */
  const excluirEmail = async (ev, email) => {
    if (ev) ev.stopPropagation();
    if (!email) return;
    if (!podeExcluirDe(email.dono !== undefined ? email.dono : meta.dono[email.id])) {
      window.toast?.('Você não tem permissão para excluir este e-mail (só o dono, ou quem tem a alçada "Exclui e-mails de outras pessoas").', 'warning');
      return;
    }
    const assunto = email.subject || '(sem assunto)';
    if (!window.confirm(`Tem certeza que deseja excluir este e-mail?\n\n"${assunto}"\n\nEle continua existindo na caixa de e-mail real — isso só remove da lista do site.`)) return;
    try {
      const user = window.__VP_USER || {};
      const { error } = await window.__VP_SB.sb.from('emails_projeto')
        .update({ excluido_em: new Date().toISOString(), excluido_por: user.email || null })
        .eq('id', email.id);
      if (error) throw error;
      if (ehEnviado(email)) setEnviados((prev) => prev.filter((e) => e.id !== email.id));
      else setExcluidos((prev) => [...prev, email.id]);
      if (activeId === email.id) setActiveId(null);
      window.toast?.('E-mail excluído da lista.', 'success');
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Inbox de E-mail', acao: 'Excluiu e-mail da lista (soft-delete)',
        alvo: assunto, alvo_id: email.id,
      });
    } catch (e) {
      window.toast?.('Erro ao excluir: ' + e.message, 'error');
    }
  };

  const marcarComoRespostaFornecedor = async () => {
    if (!active || !gatilhoAberto) return;
    setMarcandoGatilho(true);
    try {
      await window.EventosFluxo.registrar({
        evento: 'FORNECEDOR_RESPONDEU', numeroCotacao: active.numeroCotacao, alvoId: gatilhoAberto.alvo_id || null,
      });
      window.toast?.('Marcado — gatilho "Aguardando resposta do Fornecedor" fechado.', 'success');
      setGatilhoAberto(null);
    } catch (e) {
      window.toast?.('Erro ao marcar gatilho: ' + (e.message || e), 'error');
    } finally {
      setMarcandoGatilho(false);
    }
  };

  const lerArquivoBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const anexarArquivos = async (fileList) => {
    const arquivos = Array.from(fileList || []);
    if (!arquivos.length) return;
    const totalAtual = anexosResposta.reduce((s, a) => s + a.size, 0);
    const totalNovo = arquivos.reduce((s, f) => s + f.size, 0);
    if (totalAtual + totalNovo > MAX_ANEXO_TOTAL) {
      window.toast?.(`Anexos somam mais de ${MAX_ANEXO_TOTAL / 1024 / 1024}MB — limite real do ambiente de envio (confirmado em teste). Remova algum antes de adicionar mais.`, 'warning');
      return;
    }
    const novos = await Promise.all(arquivos.map(async (f) => ({
      filename: f.name, contentType: f.type || 'application/octet-stream', size: f.size, base64: await lerArquivoBase64(f),
    })));
    setAnexosResposta((prev) => [...prev, ...novos]);
  };

  const verNaLinhaDoTempo = (e, numeroCotacao) => {
    e.stopPropagation();
    if (setSubsel) setSubsel(numeroCotacao);
    setRoute('linha-do-tempo');
  };

  /* 10/09 — "Responder"/"Vincular" eram botões desabilitados desde que o
     Inbox foi criado, só com título "em desenvolvimento". Pedido do
     usuário (com print do site em produção): precisa funcionar de
     verdade. Responder reusa a mesma send-email (mesma caixa suporte@
     vpsistema.com); se o e-mail original já estava vinculado a uma
     cotação, a resposta herda o vínculo automaticamente. */
  const NOSSO_EMAIL = 'suporte@vpsistema.com'; // caixa própria — nunca incluir como destinatário em "responder a todos"
  const enviarCompose = async () => {
    if (!active || !respostaTexto.trim()) return;
    if (modoCompose === 'encaminhar' && !destinatarioEncaminhar.trim()) {
      window.toast?.('Digite o e-mail de quem vai receber o encaminhamento.', 'warning');
      return;
    }
    setEnviandoResposta(true);
    try {
      const sb = window.__VP_SB.sb;
      let to, subject, text;
      if (modoCompose === 'encaminhar') {
        to = destinatarioEncaminhar.trim();
        subject = /^fwd:/i.test(active.subject || '') ? active.subject : `Fwd: ${active.subject || ''}`;
        text = `${respostaTexto}\n\n---------- Mensagem encaminhada ----------\nDe: ${active.fromName || active.from} <${active.from}>\nAssunto: ${active.subject}\n\n${active.preview || ''}`;
      } else if (modoCompose === 'responder-todos') {
        const todos = [active.from, ...(active.to || []), ...(active.cc || [])]
          .map((e) => String(e).toLowerCase())
          .filter((e, i, arr) => e && e !== NOSSO_EMAIL && arr.indexOf(e) === i);
        to = todos.join(', ');
        subject = /^re:/i.test(active.subject || '') ? active.subject : `Re: ${active.subject || ''}`;
        text = respostaTexto;
      } else {
        to = active.from;
        subject = /^re:/i.test(active.subject || '') ? active.subject : `Re: ${active.subject || ''}`;
        text = respostaTexto;
      }
      const erroValidacao = validarEmails(to);
      if (erroValidacao) { window.toast?.(erroValidacao, 'warning'); setEnviandoResposta(false); return; }
      /* Fase 2 (JEV): sem Nº de cotação, sugere uma — o pop-up só aparece se há evidência (forte/perguntar). */
      if (active.numeroCotacao == null && numeroForcado.current == null && !vinculoDecidido.current && window.inboxBuscarSugestao) {
        const r = await window.inboxBuscarSugestao(modoCompose === 'encaminhar' ? to : active.from, subject);
        if (r.politica !== 'silencio') { setPopupVinculo(r); setEnviandoResposta(false); return; }
      }
      const numeroEfetivo = active.numeroCotacao ?? numeroForcado.current ?? undefined;
      const { data, error } = await sb.functions.invoke('send-email', {
        body: {
          to, subject, text,
          numeroCotacao: numeroEfetivo,
          referenciaTipo: numeroEfetivo != null ? 'resposta_inbox' : undefined,
          attachments: anexosResposta.length ? anexosResposta.map((a) => ({ filename: a.filename, contentType: a.contentType, base64: a.base64 })) : undefined,
        },
      });
      if (error) { window.toast?.('Erro ao enviar: ' + await extrairErroFuncao(error), 'error'); return; }
      if (data && data.avisoPersistencia) window.toast?.(data.avisoPersistencia, 'warning');
      window.toast?.(modoCompose === 'encaminhar' ? 'E-mail encaminhado.' : 'Resposta enviada.', 'success');
      /* Fase 2: vínculo confirmado no pop-up vale também para o e-mail original; e quem era o responsável é avisado. */
      if (numeroForcado.current != null && !ehEnviado(active)) {
        sb.from('emails_projeto').update({ numero_cotacao: numeroForcado.current, vinculo_confianca: 'certo' }).eq('id', active.id).then(() => { if (meta.recarregar) meta.recarregar(); });
      }
      numeroForcado.current = null; vinculoDecidido.current = false;
      const respAnterior = window.InboxTriagem ? window.InboxTriagem.avisoOutroDono({ dono: donoDe(active), atribuido: atribuidoDe(active), eu: perm ? perm.eu : String((window.__VP_USER || {}).email || '').toLowerCase() }) : null;
      if (respAnterior && window.inboxNotificar) window.inboxNotificar(respAnterior, 'Responderam um e-mail seu', `${nomeDe(String((window.__VP_USER || {}).email || ''))} respondeu "${active.subject || '(sem assunto)'}".`);
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Inbox de E-mail',
        acao: modoCompose === 'encaminhar' ? 'Encaminhou e-mail' : modoCompose === 'responder-todos' ? 'Respondeu a todos' : 'Respondeu e-mail',
        alvo: subject, alvo_id: active.id,
        detalhe: { para: to, numeroCotacao: active.numeroCotacao ?? null },
      });
      setRespondendo(false); setRespostaTexto(''); setAnexosResposta([]); setDestinatarioEncaminhar('');
      carregar();
    } catch (e) {
      window.toast?.('Erro ao enviar: ' + await extrairErroFuncao(e), 'error');
    } finally {
      setEnviandoResposta(false);
    }
  };

  const abrirCompose = (modo) => {
    if (!pode('editar')) { window.toast?.('Sem permissão para responder ou encaminhar (alçada Inbox › Editar).', 'warning'); return; }
    /* Fase 2: e-mail de OUTRA pessoa (dono ou atribuído) → aviso antes de responder; o responsável é avisado depois do envio. */
    const outroResp = active && window.InboxTriagem ? window.InboxTriagem.avisoOutroDono({ dono: donoDe(active), atribuido: atribuidoDe(active), eu: perm ? perm.eu : String((window.__VP_USER || {}).email || '').toLowerCase() }) : null;
    if (outroResp && !avisoConfirmado.current[active.id]) { setAvisoOutro({ modo, responsavel: outroResp }); return; }
    setModoCompose(modo);
    setRespondendo(true);
    setVinculando(false);
    if (modo !== 'encaminhar') setDestinatarioEncaminhar('');
  };

  /* Sugestão de resposta por IA (10/09) — pedido do usuário, botão que já
     existia desabilitado. Manda o corpo real do e-mail (texto puro, sem
     tags HTML) pra suggest-email-reply e só preenche o campo — o
     vendedor sempre revisa/edita antes de enviar, nunca envia sozinho. */
  const sugerirResposta = async () => {
    if (!active) return;
    if (!pode('editar')) { window.toast?.('Sem permissão para responder (alçada Inbox › Editar).', 'warning'); return; }
    const outroResp = window.InboxTriagem ? window.InboxTriagem.avisoOutroDono({ dono: donoDe(active), atribuido: atribuidoDe(active), eu: perm ? perm.eu : String((window.__VP_USER || {}).email || '').toLowerCase() }) : null;
    if (outroResp && !avisoConfirmado.current[active.id]) { setAvisoOutro({ modo: 'responder', responsavel: outroResp }); return; }
    setSugerindoIA(true);
    try {
      const sb = window.__VP_SB.sb;
      const bodyText = active.preview || (active.html || '').replace(/<[^>]+>/g, ' ');
      const { data, error } = await sb.functions.invoke('suggest-email-reply', {
        body: { subject: active.subject, fromName: active.fromName, from: active.from, bodyText, numeroCotacao: active.numeroCotacao ?? undefined },
      });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      setModoCompose((m) => (m === 'encaminhar' ? m : 'responder'));
      setRespondendo(true);
      setRespostaTexto(data.sugestao || '');
      window.toast?.('Sugestão gerada — revise antes de enviar.', 'success');
    } catch (e) {
      window.toast?.('Erro ao sugerir resposta: ' + (e.message || e), 'error');
    } finally {
      setSugerindoIA(false);
    }
  };

  /* Vínculo manual — cobre o caso do vínculo automático (Message-ID ou
     regex no assunto) não ter achado nada, ou ter achado errado. Marca
     como 'certo' porque é confirmação humana, mais confiável que
     qualquer heurística automática. */
  const salvarVinculo = async () => {
    if (!active) return;
    if (!pode('editar')) { window.toast?.('Sem permissão para vincular (alçada Inbox › Editar).', 'warning'); return; }
    const numero = parseInt(String(vincularInput).replace(/\D/g, ''), 10);
    if (!numero) { window.toast?.('Digite um Nº Cotação válido (ex.: 950).', 'warning'); return; }
    setSalvandoVinculo(true);
    try {
      const sb = window.__VP_SB.sb;
      const { data: existe } = await sb.from('formularios_elevador').select('numero_cotacao').eq('numero_cotacao', numero).maybeSingle();
      if (!existe) { window.toast?.(`Não existe Cotação Nº ${numero} no sistema.`, 'error'); return; }
      const { error } = await sb.from('emails_projeto').update({ numero_cotacao: numero, vinculo_confianca: 'certo' }).eq('id', active.id);
      if (error) throw error;
      window.toast?.(`Vinculado à Cotação Nº ${numero}.`, 'success');
      setVinculando(false); setVincularInput('');
      carregar();
    } catch (e) {
      window.toast?.('Erro ao vincular: ' + (e.message || e), 'error');
    } finally {
      setSalvandoVinculo(false);
    }
  };

  /* ---- Fase 3: ações do layout Gmail (todas funcionam com o backend de hoje) ---- */
  const abrirEscrever = () => {
    if (!pode('criar')) { window.toast?.('Sem permissão para escrever e-mails (alçada Inbox › Criar).', 'warning'); return; }
    setNovoInicial(null); setNovoEmailAberto(true);
  };
  const abrirAjuda = (aba) => {
    if (aba === 'feedback') {      // feedback vira um e-mail para a caixa de suporte (mesmo fluxo de envio, fica no histórico)
      if (!pode('criar')) { window.toast?.('Sem permissão para escrever e-mails (alçada Inbox › Criar).', 'warning'); return; }
      setNovoInicial({ para: 'suporte@vpsistema.com', assunto: '[Feedback Inbox] ' }); setNovoEmailAberto(true); return;
    }
    setAjudaAba(aba);
  };
  const alternarSel = (id) => setSelecionados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarTodas = () => setSelecionados(listaFiltrada.length > 0 && listaFiltrada.every((m) => selecionados.has(m.id)) ? new Set() : new Set(listaFiltrada.map((m) => m.id)));
  const marcarSelecionados = (lido) => {
    if (!pode('editar')) { window.toast?.('Sem permissão (alçada Inbox › Editar).', 'warning'); return; }
    const n = selecionados.size;
    selecionados.forEach((id) => definirLido(id, lido));
    setSelecionados(new Set());
    window.toast?.(`${n} e-mail(s) marcado(s) como ${lido ? 'lido(s)' : 'não lido(s)'} para você.`, 'success');
  };
  const excluirSelecionados = async () => {
    const linhas = listaFiltrada.filter((m) => selecionados.has(m.id));
    const permitidas = linhas.filter((m) => podeExcluirDe(donoDe(m)));
    if (!permitidas.length) { window.toast?.('Você não tem permissão para excluir os e-mails selecionados (só o dono, ou quem tem a alçada “Exclui e-mails de outras pessoas”).', 'warning'); return; }
    const pulados = linhas.length - permitidas.length;
    if (!window.confirm(`Excluir ${permitidas.length} e-mail(s) da lista?\n\nEles continuam na caixa de e-mail real — isso só remove da lista do site.${pulados ? `\n\n${pulados} selecionado(s) de outra pessoa será(ão) mantido(s).` : ''}`)) return;
    try {
      const ids = permitidas.map((m) => m.id);
      const { data, error } = await window.__VP_SB.sb.from('emails_projeto')
        .update({ excluido_em: new Date().toISOString(), excluido_por: (window.__VP_USER || {}).email || null }).in('id', ids).select('id');
      if (error) throw error;
      const feitos = new Set((data || []).map((r) => r.id));
      setEnviados((prev) => prev.filter((e) => !feitos.has(e.id)));
      setExcluidos((prev) => [...prev, ...feitos]);
      if (activeId && feitos.has(activeId)) setActiveId(null);
      setSelecionados(new Set());
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: 'Excluiu e-mails da lista (soft-delete, em massa)', alvo: `${feitos.size} e-mail(s)` });
      window.toast?.(`${feitos.size} e-mail(s) excluído(s) da lista.`, 'success');
    } catch (e) { window.toast?.('Erro ao excluir: ' + (e.message || e), 'error'); }
  };

  /* ---- Fase 4A: Arquivar, Spam, Suspender e Marcadores. Agem nos e-mails MARCADOS ou, se nada estiver marcado, no e-mail ABERTO. ---- */
  const alvosIds = selecionados.size ? [...selecionados] : (active ? [active.id] : []);
  const alvosLinhas = alvosIds.map((id) => todasLinhas.find((m) => m.id === id)).filter(Boolean);
  const todosArquivados = alvosLinhas.length > 0 && alvosLinhas.every((m) => estado[m.id] && estado[m.id].arquivado);
  const concluirAcao = (msg) => { setSelecionados(new Set()); if (msg) window.toast?.(msg, 'success'); };
  const semPermissaoEditar = () => { window.toast?.('Sem permissão (alçada Inbox › Editar).', 'warning'); };
  const arquivarAlvos = async () => {
    if (!pode('editar')) return semPermissaoEditar();
    const desfazer = todosArquivados;
    if (await arquivar(alvosIds, !desfazer)) {
      if (!desfazer && activeId && alvosIds.includes(activeId)) setActiveId(null);
      concluirAcao(`${alvosIds.length} e-mail(s) ${desfazer ? 'de volta à Caixa de entrada' : 'arquivado(s) — continuam em “Todos os e-mails”'}.`);
    }
  };
  const spamAlvos = async (marcar) => {
    if (!pode('editar')) return semPermissaoEditar();
    let ids = alvosIds;
    if (marcar) {
      const veredito = alvosLinhas.map((m) => ({ m, r: O.podeMarcarSpam(m, ehEnviado(m)) }));
      ids = veredito.filter((x) => x.r.ok).map((x) => x.m.id);
      const barrados = veredito.filter((x) => !x.r.ok);
      if (!ids.length) { window.toast?.(`Não dá para marcar como spam: ${barrados[0] ? barrados[0].r.motivo : 'nada selecionado'}.`, 'warning'); return; }
      if (barrados.length) window.toast?.(`${barrados.length} e-mail(s) ficaram de fora do spam (ligados a cotação/documento ou enviados por nós).`, 'info');
    }
    try {
      const n = await window.inboxMarcarSpam(ids, marcar);
      if (meta.recarregar) meta.recarregar();
      if (activeId && ids.includes(activeId)) setActiveId(null);
      concluirAcao(marcar ? `${n} e-mail(s) marcado(s) como spam (aparece em “Spam”, para todos).` : `${n} e-mail(s) tirado(s) do spam.`);
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
  };
  const adiarAlvos = async (quando) => {
    if (!pode('editar')) return semPermissaoEditar();
    if (await adiar(alvosIds, quando)) {
      if (quando && activeId && alvosIds.includes(activeId)) setActiveId(null);
      concluirAcao(quando ? `${alvosIds.length} e-mail(s) suspenso(s) até ${new Date(quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` : 'Adiamento cancelado — de volta à Caixa de entrada.');
    }
  };
  const estadoMarcador = (id) => {
    if (!alvosIds.length) return 'nenhum';
    const n = alvosIds.filter((e) => (mk.porEmail[e] || []).includes(id)).length;
    return n === 0 ? 'nenhum' : n === alvosIds.length ? 'todos' : 'alguns';
  };
  const aplicarMarcador = async (mc, st) => {
    if (!O.podeAplicarMarcador(mc, eu, capsOrg)) { window.toast?.('Você não pode usar este marcador.', 'warning'); return; }
    const err = await mk.aplicar(alvosIds, mc.id, st !== 'todos');
    if (err) window.toast?.(err, 'error');
  };
  const moverPara = async (mc) => {
    if (!O.podeAplicarMarcador(mc, eu, capsOrg)) { window.toast?.('Você não pode usar este marcador.', 'warning'); return; }
    const err = await mk.aplicar(alvosIds, mc.id, true);
    if (err) { window.toast?.(err, 'error'); return; }
    await arquivar(alvosIds, true);
    if (activeId && alvosIds.includes(activeId)) setActiveId(null);
    concluirAcao(`${alvosIds.length} e-mail(s) movido(s) para “${mc.nome}”.`);
  };
  const apagarMarcador = async (mc) => {
    if (!window.confirm(`Apagar o marcador “${mc.nome}”?\n\nOs e-mails não são apagados — só perdem este marcador.`)) return;
    const err = await mk.apagar(mc.id);
    if (err) { window.toast?.(err, 'error'); return; }
    if (folder === 'm:' + mc.id) setFolder('inbox');
    window.toast?.('Marcador apagado.', 'success');
  };
  const contaPasta = (pasta, soNaoLidas) => (O ? todasLinhas.filter((m) => O.visivelNaPasta(m, pasta, ctxPasta) && (!soNaoLidas || naoLida(m))).length : 0);

  const mostrarTriagem = !perm || !!(perm.caps && (perm.caps.triagem || perm.caps.ver_todos));
  const folders = [
    { id: "inbox", label: "Caixa de entrada", icon: "mail", count: contaPasta('inbox', true) },
    { id: "starred", label: "Com estrela", icon: "star" },
    { id: "adiados", label: "Adiados", icon: "clock", count: contaPasta('adiados', false) },
    { id: "mine", label: "Atribuídos a mim", icon: "users", count: contaPasta('mine', true) },
    ...(mostrarTriagem ? [{ id: "triagem", label: "Sem responsável", icon: "inbox", count: contaPasta('triagem', true) }] : []),
    { id: "sent", label: "Enviados", icon: "send" },
    { id: "all", label: "Todos os e-mails", icon: "layers" },
    { id: "spam", label: "Spam", icon: "warning", count: contaPasta('spam', true) },
  ];

  if (perm && !pode('ver')) {
    return (
      <div className="page fade-in">
        <div className="page-head"><div className="page-head__l"><h1 className="page-head__title">Inbox</h1>
          <p className="page-head__sub">Você não tem acesso ao Inbox. Peça ao administrador a alçada Inbox › Ver (Administração › Alçadas).</p></div></div>
      </div>
    );
  }

  return (
    <div className="page fade-in" style={{ paddingBottom: 0, paddingRight: 24, paddingLeft: 24 }}>
      <div className="ig-topo">
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("dashboard")}>Voltar</Button>
        <span className="ig-topo__titulo">Inbox</span>
        {window.InboxBarraBusca && <window.InboxBarraBusca valor={busca} onChange={setBusca}/>}
        <div className="ig-topo__fim">
          {erro ? <Badge variant="danger" dot>Erro na conexão</Badge> : <Badge variant="success" dot>Conectado</Badge>}
          {window.InboxMenuAjuda && <window.InboxMenuAjuda onAbrir={abrirAjuda}/>}
          <button className="ig-iconbtn ig-iconbtn--grande" title="Configurações rápidas" onClick={() => setConfigAberta((a) => !a)}><Icon.settings size={16}/></button>
        </div>
      </div>
      <div className="small muted" style={{ margin: '-4px 0 8px' }}>
        {erro ? `Falha ao conectar: ${erro}` : 'Caixa suporte@vpsistema.com — compartilhada por Comercial, Compras e Importação.'}
      </div>
      {novoEmailAberto && <EmailNovoModal inicial={novoInicial} onClose={() => { setNovoEmailAberto(false); setNovoInicial(null); }} onEnviado={() => { carregar(); carregarEnviados(); }}/>}
      {avisoOutro && window.InboxAvisoOutroDono && (
        <window.InboxAvisoOutroDono responsavel={avisoOutro.responsavel} nomeDe={nomeDe} onCancelar={() => setAvisoOutro(null)}
          onConfirmar={() => { if (active) avisoConfirmado.current[active.id] = true; const m = avisoOutro.modo; setAvisoOutro(null); abrirCompose(m); }}/>
      )}
      {popupVinculo && window.InboxPopupVinculoEnvio && (
        <window.InboxPopupVinculoEnvio r={popupVinculo} onCancelar={() => setPopupVinculo(null)}
          onSemVinculo={() => { vinculoDecidido.current = true; setPopupVinculo(null); enviarCompose(); }}
          onEscolher={(n) => { numeroForcado.current = n; vinculoDecidido.current = true; setPopupVinculo(null); enviarCompose(); }}/>
      )}
      {modalMarcador && window.InboxModalMarcador && (
        <window.InboxModalMarcador marcadores={mk.marcadores} caps={capsOrg} onCriar={mk.criar} onClose={() => setModalMarcador(false)}/>
      )}
      {atribuirAberto && active && window.InboxModalAtribuir && (
        <window.InboxModalAtribuir email={active} dono={donoDe(active)} atribuido={atribuidoDe(active)} decisao={iaMapa[active.id]} ctx={perm}
          onClose={() => setAtribuirAberto(false)} onSalvo={() => { setAtribuirAberto(false); if (meta.recarregar) meta.recarregar(); carregarEnviados(); }}/>
      )}

      <div className={"inbox inbox--gmail inbox--den-" + prefs.densidade}>
        <div className="inbox__folders">
          <button className="ig-escrever" disabled={!pode('criar')} onClick={abrirEscrever} title={pode('criar') ? 'Escrever um e-mail novo' : 'Sem permissão (alçada Inbox › Criar)'}>
            <Icon.edit size={18}/> Escrever
          </button>
          {folders.map((f) => {
            const I = Icon[f.icon] || Icon.mail;
            return (
              <div key={f.id} className={"inbox__folder " + (folder === f.id && !buscando ? "is-active" : "")} onClick={() => { setBusca(''); setFolder(f.id); setActiveId(null); }}>
                <I size={14}/>
                <span>{f.label}</span>
                {f.count ? <span className="count">{f.count}</span> : null}
              </div>
            );
          })}
          {window.InboxSecaoMarcadores && O && (
            <window.InboxSecaoMarcadores arvore={mkArvore} pasta={folder}
              onAbrir={(id) => { setBusca(''); setFolder(id); setActiveId(null); }} onNovo={() => setModalMarcador(true)}
              contagem={(id) => todasLinhas.filter((m) => (mk.porEmail[m.id] || []).includes(id) && naoLida(m) && !spamDe(m)).length}
              podeGerir={(m) => O.podeGerirMarcador(m, eu, capsOrg)} onApagar={apagarMarcador}/>
          )}
        </div>

        <div className={"inbox__main inbox__main--" + prefs.painel}>
          {(prefs.painel !== 'sem' || !active) && (
        <div className="inbox__list">
          <div className="inbox__list-toolbar">
            {window.InboxToolbarLista && (
              <window.InboxToolbarLista total={listaFiltrada.length} selecionadas={selecionados.size}
                alvos={alvosIds.length} rotuloAlvo={selecionados.size ? undefined : 'E-mail aberto:'}
                extras={O && window.InboxMenuSuspender ? (
                  <>
                    {pastaEfetiva === 'spam'
                      ? <Button variant="ghost" size="sm" disabled={!pode('editar')} onClick={() => spamAlvos(false)}>Não é spam</Button>
                      : (<>
                          <Button variant="ghost" size="sm" disabled={!pode('editar')} onClick={arquivarAlvos}>{todosArquivados ? 'Mover para a Caixa de entrada' : 'Arquivar'}</Button>
                          <Button variant="ghost" size="sm" disabled={!pode('editar')} onClick={() => spamAlvos(true)}>Denunciar spam</Button>
                        </>)}
                    {pastaEfetiva === 'adiados'
                      ? <Button variant="ghost" size="sm" disabled={!pode('editar')} onClick={() => adiarAlvos(null)}>Cancelar adiamento</Button>
                      : <window.InboxMenuSuspender desabilitado={!pode('editar')} onEscolher={adiarAlvos}/>}
                    <window.InboxMenuMarcadores rotulo="Mover para" icone="arrowRight" marcadores={mk.marcadores} estadoDe={estadoMarcador}
                      onEscolher={(mc) => moverPara(mc)} onNovo={() => setModalMarcador(true)} desabilitado={!pode('editar')}/>
                    <window.InboxMenuMarcadores rotulo="Marcadores" icone="layers" marcadores={mk.marcadores} estadoDe={estadoMarcador}
                      onEscolher={aplicarMarcador} onNovo={() => setModalMarcador(true)} desabilitado={!pode('editar')}/>
                  </>) : null}
                todasMarcadas={listaFiltrada.length > 0 && listaFiltrada.every((m) => selecionados.has(m.id))}
                onToggleTodas={alternarTodas} onLida={() => marcarSelecionados(true)} onNaoLida={() => marcarSelecionados(false)}
                onExcluir={excluirSelecionados} onAtualizar={() => { carregar(); carregarEnviados(); }} carregando={loading} podeEditar={pode('editar')}/>
            )}
            <div className="inbox__list-head">
              <span>{buscando ? 'Resultados da pesquisa' : (folders.find((f) => f.id === folder)?.label || folder)}</span>
              <span className="mono">{listaFiltrada.length}</span>
            </div>
          </div>
          {folder === "inbox" && !buscando && window.InboxFaixaImportante && (
            <window.InboxFaixaImportante itens={importantes} ocultos={silenciosos.length} foco={foco} onToggleFoco={() => setFoco((f) => !f)} onAbrir={setActiveId}/>
          )}
          {folder === "inbox" && !buscando && perm !== undefined && <InboxRespostasFormulario onAbrir={verNaLinhaDoTempo} verOk={verOk} liberado={perm === null ? 'sem' : perm.eu + ':' + (perm.flags && perm.flags.ver_todos)}/>}
          {folder === "inbox" && !buscando && !loading && emails.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--fg3)', fontSize:13, lineHeight:1.6 }}>
              <div style={{ fontWeight:600, color:'var(--fg2)', marginBottom:4 }}>{erro ? 'Não foi possível carregar' : 'Nenhuma mensagem'}</div>
              {erro || 'A caixa está vazia.'}
            </div>
          )}
          {pastaEfetiva === "sent" && !buscando && !carregandoEnviados && enviadosNormalizados.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--fg3)', fontSize:13, lineHeight:1.6 }}>
              <div style={{ fontWeight:600, color:'var(--fg2)', marginBottom:4 }}>Nenhum e-mail enviado ainda</div>
              Aparece aqui assim que você mandar um pelo Responder, Escrever ou Cotação a Fornecedor.
            </div>
          )}
          {listaFiltrada.length === 0 && (buscando || (folder !== 'inbox' && folder !== 'sent')) && (
            <div style={{ textAlign:'center', padding:'40px 24px', color:'var(--fg3)', fontSize:13, lineHeight:1.6 }}>
              {buscando ? <>Nenhum resultado para “{busca}”. <a href="#" onClick={(ev) => { ev.preventDefault(); setBusca(''); }}>Limpar pesquisa</a></>
                : folder === 'starred' ? 'Nenhum e-mail com estrela. Clique na ☆ de uma mensagem para marcá-la (só você vê).'
                : folder === 'mine' ? 'Nenhum e-mail atribuído a você.'
                : folder === 'triagem' ? 'Nenhum e-mail sem responsável. Tudo tem dono.'
                : folder === 'adiados' ? 'Nada suspenso. Use “Suspender” para um e-mail voltar à Caixa de entrada na hora que você escolher.'
                : folder === 'spam' ? 'Nenhum spam. E-mails ligados a cotação ou documento nunca vão para cá.'
                : String(folder).startsWith('m:') ? 'Nenhum e-mail com este marcador. Selecione e-mails e use “Marcadores”.' : 'Nenhuma mensagem.'}
            </div>
          )}
          {listaFiltrada.map((m) => {
            const sent = ehEnviado(m);
            const sel = selecionados.has(m.id);
            const est = estrelaDe(m);
            return (
              <div key={m.id} className={"inbox__item inbox__row " + (naoLida(m) ? "unread " : "") + (activeId === m.id ? "is-active " : "") + (sel ? "is-sel" : "")}
                onClick={() => { setActiveId(m.id); marcarLido(m.id); }}>
                <label className="ig-check" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => alternarSel(m.id)}/></label>
                <span className={"ig-estrela" + (est ? " on" : "")} title={est ? 'Tirar a estrela' : 'Marcar com estrela (só para você)'}
                  onClick={(ev) => { ev.stopPropagation(); alternarEstrela(m.id, est); }}>{est ? '★' : '☆'}</span>
                <span className="ig-quem">{m.fromName || m.from}</span>
                <span className="ig-texto"><b className="subj">{m.subject}</b>{m.preview ? <span> — {String(m.preview).replace(/\s+/g, ' ').slice(0, 160)}</span> : null}
                  {m.anexos && m.anexos.length > 0 ? <Icon.paperclip size={11} style={{ marginLeft: 6, verticalAlign: 'middle', opacity: .6 }}/> : null}</span>
                <span className="ig-chips">
                  {window.InboxChipsMarcadores && <window.InboxChipsMarcadores ids={mk.porEmail[m.id]} porId={marcadorPorId}/>}
                  {!sent && window.InboxChip && iaMapa[m.id] && <window.InboxChip decisao={iaMapa[m.id]}/>}
                  {m.numeroCotacao != null && (
                    <Badge variant={m.vinculoConfianca === 'certo' ? 'success' : 'warning'} onClick={(ev) => verNaLinhaDoTempo(ev, m.numeroCotacao)} style={{ cursor: 'pointer' }}>
                      <Icon.link2 size={10}/> Cotação Nº {m.numeroCotacao}{m.vinculoConfianca === 'provavel' ? ' (provável)' : ''}
                    </Badge>
                  )}
                  {INBOX_REFERENCIA_TIPO_LABEL[m.referenciaTipo] && <Badge variant="outline">{INBOX_REFERENCIA_TIPO_LABEL[m.referenciaTipo]}</Badge>}
                </span>
                <span className="ig-quando">{window.igQuando ? window.igQuando(m.date) : ''}</span>
                <span className="ig-lixo"><Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={(ev) => excluirEmail(ev, m)}/></span>
              </div>
            );
          })}
        </div>
          )}

          {(prefs.painel !== 'sem' || active) && (
        <div className="inbox__msg">
          {prefs.painel === 'sem' && active && (
            <div className="ig-voltar"><Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setActiveId(null)}>Voltar à lista</Button></div>
          )}
          {active ? (
            <>
              <div className="inbox__msg-head">
                <h3 className="inbox__msg-subj">{active.subject}</h3>
                {active.numeroCotacao != null && (
                  <Badge variant={active.vinculoConfianca === 'certo' ? 'success' : 'warning'} onClick={(ev) => verNaLinhaDoTempo(ev, active.numeroCotacao)} style={{ cursor: 'pointer', marginTop: 6 }}>
                    <Icon.link2 size={10}/> Ver na Linha do Tempo — Cotação Nº {active.numeroCotacao}{active.vinculoConfianca === 'provavel' ? ' (vínculo provável)' : ''}
                  </Badge>
                )}
                {INBOX_REFERENCIA_TIPO_LABEL[active.referenciaTipo] && (
                  <Badge variant="outline" style={{ marginTop: 6, marginLeft: 6 }}>{INBOX_REFERENCIA_TIPO_LABEL[active.referenciaTipo]}</Badge>
                )}
                {(donoDe(active) || atribuidoDe(active)) ? (
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Responsável: <b>{nomeDe(atribuidoDe(active) || donoDe(active))}</b>
                    {atribuidoDe(active) && donoDe(active) && atribuidoDe(active) !== donoDe(active) ? <> · autor original: {nomeDe(donoDe(active))}</> : null}
                  </div>
                ) : (folder === 'inbox' && <div className="small muted" style={{ marginTop: 6 }}>Sem responsável — fica na fila de triagem até alguém atribuir.</div>)}
                {window.InboxSugestaoBarra && <window.InboxSugestaoBarra s={sugAtiva} onVincular={vincularA} ocupado={vinculandoSug}/>}
                {gatilhoAberto && (
                  <div className="alert warning" style={{ marginTop: 8 }}>
                    <Icon.warning/>
                    <div style={{ flex: 1 }}>
                      <div className="alert__title">Nova mensagem na Cotação Nº {active.numeroCotacao} — o gatilho "Aguardando resposta do Fornecedor" ainda está aberto.</div>
                      <div className="small muted">Confirme se este e-mail é a resposta técnica/comercial antes de marcar — um e-mail pode ser só "recebido, aguarde".</div>
                    </div>
                    <Button variant="primary" size="sm" disabled={marcandoGatilho} onClick={marcarComoRespostaFornecedor}>
                      {marcandoGatilho ? 'Marcando…' : 'Marcar como resposta do fornecedor'}
                    </Button>
                  </div>
                )}
                <div className="inbox__msg-meta">
                  <div className="avatar">{(active.fromName || active.from || "").split(/[\s.\-_]/).filter(Boolean).slice(0,2).map(w => (w[0]||"").toUpperCase()).join("") || "?"}</div>
                  <div>
                    <div className="from-name">{active.fromName || active.from}</div>
                    <div className="from-email">{active.from}</div>
                  </div>
                  <div className="from-email">{active.date ? new Date(active.date).toLocaleString('pt-BR') : ''}</div>
                  <div className="inbox__msg-actions">
                    <Button variant="outline" size="sm" icon="reply" onClick={() => (respondendo && modoCompose === 'responder' ? setRespondendo(false) : abrirCompose('responder'))}>Responder</Button>
                    <Button variant="ghost" size="sm" icon="link2" onClick={() => { setVinculando(v => !v); setRespondendo(false); setVincularInput(active.numeroCotacao != null ? String(active.numeroCotacao) : ''); }}>Vincular</Button>
                    {perm && window.InboxVisibilidade && window.InboxVisibilidade.podeAtribuir(donoDe(active), atribuidoDe(active), perm) && (
                      <Button variant="ghost" size="sm" icon="users" onClick={() => setAtribuirAberto(true)}>Atribuir</Button>
                    )}
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={(ev) => excluirEmail(ev, active)}>Excluir</Button>
                  </div>
                </div>
                {vinculando && (
                  <div className="row gap-2" style={{ marginTop: 10, alignItems: 'center' }}>
                    <input className="input" style={{ maxWidth: 180 }} placeholder="Nº Cotação (ex.: 950)" value={vincularInput}
                      onChange={(e) => setVincularInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarVinculo()}/>
                    <Button variant="primary" size="sm" disabled={salvandoVinculo} onClick={salvarVinculo}>{salvandoVinculo ? 'Salvando…' : 'Salvar vínculo'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setVinculando(false)}>Cancelar</Button>
                  </div>
                )}
              </div>
              <div className="inbox__msg-body">
                <EmailBody active={active}/>
              </div>
              {active.anexos && active.anexos.length > 0 && (
                <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {active.anexos.map((a, i) => (
                    a.url ? (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="badge badge--outline" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon.paperclip size={10}/> {a.filename} <span className="muted small">({Math.round((a.size || 0) / 1024)}kb)</span>
                      </a>
                    ) : (
                      <span key={i} className="badge badge--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon.paperclip size={10}/> {a.filename}
                      </span>
                    )
                  ))}
                </div>
              )}
              {respondendo && (
                <div style={{ padding: '0 16px 12px' }}>
                  {modoCompose === 'encaminhar' && (
                    <input className="input" style={{ width: '100%', marginBottom: 6 }} placeholder="Encaminhar para (e-mail)"
                      value={destinatarioEncaminhar} onChange={(e) => setDestinatarioEncaminhar(e.target.value)}/>
                  )}
                  {modoCompose === 'responder-todos' && (
                    <div className="small muted" style={{ marginBottom: 6 }}>
                      Para: {[active.from, ...(active.to || []), ...(active.cc || [])].map((e) => String(e).toLowerCase()).filter((e, i, arr) => e && e !== NOSSO_EMAIL && arr.indexOf(e) === i).join(', ')}
                    </div>
                  )}
                  <textarea className="input" rows={5} style={{ width: '100%', resize: 'vertical' }}
                    placeholder={modoCompose === 'encaminhar' ? 'Mensagem (opcional) antes do conteúdo encaminhado…' : `Respondendo a ${active.fromName || active.from}…`}
                    value={respostaTexto} onChange={(e) => setRespostaTexto(e.target.value)} autoFocus/>
                  {anexosResposta.length > 0 && (
                    <div className="row gap-2" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                      {anexosResposta.map((a, i) => (
                        <span key={i} className="badge badge--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon.paperclip size={10}/> {a.filename} <span className="muted small">({Math.round(a.size / 1024)}kb)</span>
                          <span style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setAnexosResposta((prev) => prev.filter((_, idx) => idx !== i))}>×</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="row gap-2" style={{ marginTop: 8 }}>
                    <Button variant="primary" size="sm" icon="send" disabled={enviandoResposta || !respostaTexto.trim()} onClick={enviarCompose}>
                      {enviandoResposta ? 'Enviando…' : modoCompose === 'encaminhar' ? 'Encaminhar' : 'Enviar resposta'}
                    </Button>
                    <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon.paperclip size={12}/> Anexar
                      <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { anexarArquivos(e.target.files); e.target.value = ''; }}/>
                    </label>
                    <Button variant="ghost" size="sm" icon="zap" disabled={sugerindoIA} onClick={sugerirResposta}>{sugerindoIA ? 'Pensando…' : 'Sugerir resposta (AI)'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setRespondendo(false); setRespostaTexto(''); setAnexosResposta([]); }}>Cancelar</Button>
                  </div>
                </div>
              )}
              <div className="inbox__compose">
                <Button variant="primary" size="sm" icon="reply" onClick={() => abrirCompose('responder')}>Responder</Button>
                <Button variant="outline" size="sm" icon="reply" onClick={() => abrirCompose('responder-todos')}>Responder a todos</Button>
                <Button variant="outline" size="sm" icon="arrowRight" onClick={() => abrirCompose('encaminhar')}>Encaminhar</Button>
                <div className="spacer" style={{ flex: 1 }}/>
                <Button variant="ghost" size="sm" icon="zap" disabled={sugerindoIA} onClick={sugerirResposta}>{sugerindoIA ? 'Pensando…' : 'Sugerir resposta (AI)'}</Button>
              </div>
            </>
          ) : (
            <div className="ig-msg-vazio">Selecione um e-mail para ler.</div>
          )}
        </div>
        )}
        </div>
        {configAberta && window.InboxConfigRapida && (
          <window.InboxConfigRapida prefs={prefs} atualizar={atualizarPrefs} foco={foco} setFoco={setFoco} onClose={() => setConfigAberta(false)}/>
        )}
      </div>
      {ajudaAba && window.InboxAjudaModal && (
        <window.InboxAjudaModal aba={ajudaAba} onTrocar={setAjudaAba} onClose={() => setAjudaAba(null)}/>
      )}
    </div>
  );
}

/* 11/09 — pedido do usuário: "faltou um botão de enviar novo, tipo um
   usuário quer enviar um e-mail novo, como faz?". Antes só existia
   Responder/Responder a todos/Encaminhar, todos dependentes de uma
   mensagem já aberta — não tinha jeito de começar um e-mail do zero.
   Mesmo send-email, com "Nº Cotação (opcional)" pra já nascer vinculado
   a um projeto, igual ao RFQ do Formulário. */
function EmailNovoModal({ onClose, onEnviado, inicial }) {
  const [para, setPara] = React.useState((inicial && inicial.para) || '');
  const [assunto, setAssunto] = React.useState((inicial && inicial.assunto) || '');
  const [corpo, setCorpo] = React.useState('');
  const [numeroCotacaoInput, setNumeroCotacaoInput] = React.useState('');
  const [anexos, setAnexos] = React.useState([]);
  const [enviando, setEnviando] = React.useState(false);
  /* Fase 2 (JEV): sem Nº de cotação, sugere uma antes de enviar — só pergunta quando há evidência. */
  const [popupVinculo, setPopupVinculo] = React.useState(null);
  const numeroForcado = React.useRef(null);
  const vinculoDecidido = React.useRef(false);

  const lerArquivoBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const anexarArquivos = async (fileList) => {
    const arquivos = Array.from(fileList || []);
    if (!arquivos.length) return;
    const totalAtual = anexos.reduce((s, a) => s + a.size, 0);
    const totalNovo = arquivos.reduce((s, f) => s + f.size, 0);
    if (totalAtual + totalNovo > MAX_ANEXO_TOTAL) {
      window.toast?.(`Anexos somam mais de ${MAX_ANEXO_TOTAL / 1024 / 1024}MB — limite real do ambiente de envio (confirmado em teste). Remova algum antes de adicionar mais.`, 'warning');
      return;
    }
    const novos = await Promise.all(arquivos.map(async (f) => ({
      filename: f.name, contentType: f.type || 'application/octet-stream', size: f.size, base64: await lerArquivoBase64(f),
    })));
    setAnexos((prev) => [...prev, ...novos]);
  };

  const enviar = async () => {
    if (!para.trim() || !assunto.trim() || !corpo.trim()) {
      window.toast?.('Preencha destinatário, assunto e mensagem.', 'warning');
      return;
    }
    const erroValidacao = validarEmails(para);
    if (erroValidacao) { window.toast?.(erroValidacao, 'warning'); return; }
    const numero = numeroForcado.current != null ? numeroForcado.current : (numeroCotacaoInput.trim() ? parseInt(numeroCotacaoInput.replace(/\D/g, ''), 10) : null);
    if (!numero && !vinculoDecidido.current && window.inboxBuscarSugestao) {
      const r = await window.inboxBuscarSugestao(para, assunto);
      if (r.politica !== 'silencio') { setPopupVinculo(r); return; }
    }
    setEnviando(true);
    try {
      const sb = window.__VP_SB.sb;
      const { data, error } = await sb.functions.invoke('send-email', {
        body: {
          to: para.trim(), subject: assunto.trim(), text: corpo,
          numeroCotacao: numero || undefined,
          referenciaTipo: numero ? 'avulso_inbox' : undefined,
          attachments: anexos.length ? anexos.map((a) => ({ filename: a.filename, contentType: a.contentType, base64: a.base64 })) : undefined,
        },
      });
      if (error) { window.toast?.('Erro ao enviar: ' + await extrairErroFuncao(error), 'error'); return; }
      if (data && data.avisoPersistencia) window.toast?.(data.avisoPersistencia, 'warning');
      window.toast?.('E-mail enviado.', 'success');
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Inbox de E-mail', acao: 'Enviou e-mail novo',
        alvo: assunto.trim(), detalhe: { para: para.trim(), numeroCotacao: numero || null },
      });
      onEnviado?.();
      onClose();
    } catch (e) {
      window.toast?.('Erro ao enviar: ' + await extrairErroFuncao(e), 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
    {popupVinculo && window.InboxPopupVinculoEnvio && (
      <window.InboxPopupVinculoEnvio r={popupVinculo} onCancelar={() => setPopupVinculo(null)}
        onSemVinculo={() => { vinculoDecidido.current = true; setPopupVinculo(null); enviar(); }}
        onEscolher={(n) => { numeroForcado.current = n; vinculoDecidido.current = true; setPopupVinculo(null); enviar(); }}/>
    )}
    {/* Fase 3: "Escrever" abre a janela flutuante do canto da tela (como no Gmail); sem o componente novo, cai no modal de sempre. */}
    {React.createElement(window.InboxJanela || Modal,
      window.InboxJanela
        ? { titulo: 'Nova mensagem', onClose, footer: <div className="row gap-2">
            <Button variant="primary" icon="send" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar'}</Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div> }
        : { title: 'Novo e-mail', onClose, width: 560, footer: <div className="row gap-2">
            <Button variant="primary" icon="send" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar'}</Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div> },
      <div className="stack" style={{ gap: 8 }}>
        <input className="input" placeholder="Para (e-mail)" value={para} onChange={(e) => setPara(e.target.value)}/>
        <input className="input" placeholder="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}/>
        <textarea className="input" rows={7} style={{ resize: 'vertical' }} placeholder="Mensagem…" value={corpo} onChange={(e) => setCorpo(e.target.value)}/>
        <input className="input" style={{ maxWidth: 220 }} placeholder="Nº Cotação (opcional)" value={numeroCotacaoInput} onChange={(e) => setNumeroCotacaoInput(e.target.value)}/>
        {anexos.length > 0 && (
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            {anexos.map((a, i) => (
              <span key={i} className="badge badge--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon.paperclip size={10}/> {a.filename} <span className="muted small">({Math.round(a.size / 1024)}kb)</span>
                <span style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}>×</span>
              </span>
            ))}
          </div>
        )}
        <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
          <Icon.paperclip size={12}/> Anexar
          <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { anexarArquivos(e.target.files); e.target.value = ''; }}/>
        </label>
      </div>
    )}
    </>
  );
}

/* 10/09 — antes 100% mockado por kind/id, mas nunca renderizava de
   verdade (a lista de e-mails era sempre []). Agora recebe a mensagem
   real (vinda de read-inbox) e mostra o corpo de verdade: HTML dentro de
   um iframe sandboxed (sandbox="" desativa script/form/popup — é a forma
   segura de renderizar HTML de terceiro, o fornecedor pode mandar
   qualquer coisa no corpo do e-mail) com fallback pro texto puro. */
function EmailBody({ active }) {
  if (!active) return null;
  if (active.html) {
    return <iframe title="corpo do e-mail" sandbox="allow-popups allow-top-navigation-by-user-activation" srcDoc={active.html}
      style={{ width: '100%', minHeight: 420, border: 'none', background: '#fff' }}/>;
  }
  return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: 0 }}>{active.preview ? window.linkifyTexto(active.preview) : 'Mensagem sem conteúdo de texto.'}</pre>;
}

Object.assign(window, { ImportacaoPage, ImportacaoDetail, ImportacaoRastreamento, EmailInbox });
