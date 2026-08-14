/* ============================================================
   engenharia-config.jsx — Configurador de Equipamentos (Engenharia)
   Especificação técnica que orienta a Compra (escada/esteira rolante).
   Campos dinâmicos por tipo + cálculos ao vivo + anexos (Supabase Storage).
   Inspirado no fluxo de configuradores (ex.: TK eSlider) + norma EN/NBR.
   Fonte de dados: equipamentos_spec (Supabase) · bucket: engenharia
   ============================================================ */

const WIDTH_COEF = { 600: 1.0, 800: 1.5, 1000: 2.0, 1200: 2.4 }; // coef. de largura p/ capacidade

const EQ_TIPOS = [
  { key: "escada_rolante",  label: "Escada rolante" },
  { key: "esteira_rolante", label: "Esteira rolante" },
];
const tipoLabel = (k) => (EQ_TIPOS.find(t => t.key === k) || {}).label || k;

const EQ_DEFAULTS = {
  escada_rolante: { aplicacao: "Comercial (shopping)", ambiente: "Interno", angulo: 30, rise: 4000, stepWidth: 1000, velocidade: 0.5, degrausPatamar: 2, motorizacao: "Cabeceira (convencional)", economia: "Partida suave", balaustrada: "Vidro" },
  esteira_rolante: { ambiente: "Interno", inclinacao: 0, comprimento: 20000, palheta: 1000, velocidade: 0.5, tipo: "Palhetas", motorizacao: "Cabeceira (convencional)", economia: "Partida suave" },
};

const EQ_FIELDS = {
  escada_rolante: [
    { k: "aplicacao", label: "Aplicação", opts: ["Comercial (shopping)", "Transporte público (metrô/aeroporto)"] },
    { k: "ambiente", label: "Ambiente", opts: ["Interno", "Externo (intempérie)"] },
    { k: "angulo", label: "Ângulo de inclinação", opts: [30, 35], suffix: "°" },
    { k: "rise", label: "Desnível / rise", num: true, suffix: "mm" },
    { k: "stepWidth", label: "Largura do degrau", opts: [600, 800, 1000], suffix: "mm" },
    { k: "velocidade", label: "Velocidade nominal", opts: [0.5, 0.65, 0.75], suffix: "m/s" },
    { k: "degrausPatamar", label: "Degraus em patamar", opts: [2, 3, 4] },
    { k: "motorizacao", label: "Motorização", opts: ["Cabeceira (convencional)", "Modular (SOG)"] },
    { k: "economia", label: "Economia de energia", opts: ["Sem", "Partida suave", "Parada automática (sem passageiro)", "VVVF"] },
    { k: "balaustrada", label: "Balaustrada", opts: ["Vidro", "Inox"] },
  ],
  esteira_rolante: [
    { k: "ambiente", label: "Ambiente", opts: ["Interno", "Externo (intempérie)"] },
    { k: "inclinacao", label: "Inclinação", opts: [0, 6, 10, 12], suffix: "°" },
    { k: "comprimento", label: "Comprimento", num: true, suffix: "mm" },
    { k: "palheta", label: "Largura da palheta", opts: [800, 1000, 1200], suffix: "mm" },
    { k: "velocidade", label: "Velocidade nominal", opts: [0.5, 0.65, 0.75], suffix: "m/s" },
    { k: "tipo", label: "Tipo de superfície", opts: ["Palhetas", "Esteira (belt)"] },
    { k: "motorizacao", label: "Motorização", opts: ["Cabeceira (convencional)", "Modular (SOG)"] },
    { k: "economia", label: "Economia de energia", opts: ["Sem", "Partida suave", "Parada automática (sem passageiro)", "VVVF"] },
  ],
};

function eqCompute(tipo, p) {
  if (tipo === "escada_rolante") {
    const ang = Number(p.angulo) || 30, v = Number(p.velocidade) || 0.5, w = Number(p.stepWidth) || 1000;
    const riseM = (Number(p.rise) || 0) / 1000, k = WIDTH_COEF[w] || 1.0, rad = ang * Math.PI / 180;
    const velMax = ang <= 30 ? 0.75 : 0.50;
    const vertPerStep = 0.4 * Math.tan(rad); // m por degrau (passo 0,4 m)
    return {
      velMax, excedeVel: v > velMax + 1e-9,
      capacidade: Math.round(3600 * v * k / 0.4),
      degraus: vertPerStep > 0 ? Math.ceil(riseM / vertPerStep) : 0,
      comprimentoHorizontal: Math.tan(rad) > 0 ? Math.round(riseM / Math.tan(rad) * 100) / 100 : 0,
    };
  }
  const v = Number(p.velocidade) || 0.5, w = Number(p.palheta) || 1000, k = WIDTH_COEF[w] || 1.5;
  const compM = (Number(p.comprimento) || 0) / 1000, incl = Number(p.inclinacao) || 0;
  const velMax = incl <= 6 ? 0.75 : 0.50;
  return {
    velMax, excedeVel: v > velMax + 1e-9,
    capacidade: Math.round(3600 * v * k / 0.4),
    tempoTravessia: v > 0 ? Math.round(compM / v) : 0,
    desnivelAprox: incl > 0 ? Math.round(compM * Math.sin(incl * Math.PI / 180) * 100) / 100 : 0,
  };
}

function eqResumo(tipo, p) {
  if (tipo === "escada_rolante") return `${p.angulo}° · degrau ${p.stepWidth}mm · rise ${(Number(p.rise) / 1000).toFixed(1)}m · ${p.velocidade}m/s`;
  return `incl ${p.inclinacao}° · palheta ${p.palheta}mm · ${(Number(p.comprimento) / 1000).toFixed(1)}m · ${p.velocidade}m/s`;
}

function EqComputed({ tipo, c, p }) {
  const row = (l, v) => <div className="row sb" style={{ fontSize: 12, padding: "3px 0" }}><span className="muted">{l}</span><b className="mono">{v}</b></div>;
  return (
    <div>
      {row("Velocidade máx. (norma)", c.velMax + " m/s")}
      {c.excedeVel ? (
        <div className="alert danger" style={{ marginTop: 6 }}><Icon.warning/><div>
          <div className="alert__title">Velocidade acima da norma</div>
          <div className="alert__sub">{tipo === "escada_rolante" ? `${p.angulo}°` : `incl. ${p.inclinacao}°`} → máx {c.velMax} m/s</div>
        </div></div>
      ) : null}
      {row("Capacidade teórica", c.capacidade.toLocaleString("pt-BR") + " pess./h")}
      {tipo === "escada_rolante" ? (
        <>
          {row("Degraus expostos ≈", c.degraus)}
          {row("Projeção horizontal ≈", c.comprimentoHorizontal + " m")}
        </>
      ) : (
        <>
          {row("Tempo de travessia ≈", c.tempoTravessia + " s")}
          {Number(p.inclinacao) > 0 ? row("Desnível ≈", c.desnivelAprox + " m") : null}
        </>
      )}
    </div>
  );
}

/* ---------- Desenho esquemático 2D (vista lateral, paramétrico) ---------- */
function EqSchematic({ tipo, p, c }) {
  const W = 460, H = 180, pad = 26, ground = H - 28;
  const lbl = { fontSize: 10, fontFamily: "var(--font-mono, monospace)", fill: "#666" };

  if (tipo === "escada_rolante") {
    const ang = Number(p.angulo) || 30;
    const riseM = (Number(p.rise) || 0) / 1000;
    const rad = ang * Math.PI / 180;
    const pxPerM = 22;
    let risePx = Math.max(riseM * pxPerM, 8);
    let runPx = risePx / Math.tan(rad);
    let land = 40;
    const maxW = W - 2 * pad - 40, maxH = ground - pad - 14;
    let s = 1;
    const totalW = land + runPx + land;
    if (totalW > maxW) s = Math.min(s, maxW / totalW);
    if (risePx * s > maxH) s = Math.min(s, maxH / risePx);
    risePx *= s; runPx *= s; land *= s;
    const x0 = pad, x1 = x0 + land, x2 = x1 + runPx, x3 = x2 + land;
    const y0 = ground, y2 = ground - risePx, hr = 20;
    const n = Math.min(Math.max(Number(c.degraus) || 0, 0), 16);
    const steps = [];
    for (let i = 0; i < n; i++) {
      const fx = x1 + runPx * i / n, fy = y0 - risePx * i / n;
      const ny = y0 - risePx * (i + 1) / n, nx = x1 + runPx * (i + 1) / n;
      steps.push(`M ${fx.toFixed(1)} ${fy.toFixed(1)} L ${fx.toFixed(1)} ${ny.toFixed(1)} L ${nx.toFixed(1)} ${ny.toFixed(1)}`);
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <line x1={pad - 6} y1={ground} x2={W - pad} y2={ground} stroke="#e2e2e2" strokeWidth="1.5"/>
        <polyline points={`${x0},${y0} ${x1},${y0} ${x2},${y2} ${x3},${y2}`} fill="none" stroke="#111" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"/>
        <polyline points={`${x0},${y0 - hr} ${x1},${y0 - hr} ${x2},${y2 - hr} ${x3},${y2 - hr}`} fill="none" stroke="#f5c400" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {steps.map((d, i) => <path key={i} d={d} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9"/>)}
        <line x1={x3 + 14} y1={y0} x2={x3 + 14} y2={y2} stroke="#999" strokeWidth="1" strokeDasharray="3 2"/>
        <text x={x3 + 18} y={(y0 + y2) / 2 + 3} style={lbl}>{Number(p.rise) || 0} mm</text>
        <text x={x1 + 8} y={y0 - 7} style={lbl}>{ang}°</text>
        <text x={pad - 6} y={H - 8} style={lbl}>degrau {p.stepWidth} mm · {p.velocidade} m/s · {(c.capacidade || 0).toLocaleString("pt-BR")} pess./h</text>
      </svg>
    );
  }

  // esteira rolante (vista lateral)
  const incl = Number(p.inclinacao) || 0;
  const compM = (Number(p.comprimento) || 0) / 1000;
  const rad = incl * Math.PI / 180;
  const maxW = W - 2 * pad - 20;
  let len = Math.min(Math.max(compM * 8, 40), maxW);
  const x0 = pad, yMid = ground - 22;
  const dx = len * Math.cos(rad), dy = len * Math.sin(rad);
  const x1 = x0 + dx, y1 = yMid - dy, th = 14;
  const nt = 12, ticks = [];
  for (let i = 1; i < nt; i++) ticks.push([x0 + dx * i / nt, yMid - dy * i / nt]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <line x1={pad - 6} y1={ground} x2={W - pad} y2={ground} stroke="#e2e2e2" strokeWidth="1.5"/>
      <line x1={x0} y1={yMid} x2={x1} y2={y1} stroke="#111" strokeWidth={th} strokeLinecap="round"/>
      <line x1={x0} y1={yMid - 16} x2={x1} y2={y1 - 16} stroke="#f5c400" strokeWidth="3" strokeLinecap="round"/>
      {ticks.map(([tx, ty], i) => <line key={i} x1={tx} y1={ty - th / 2 + 1} x2={tx} y2={ty + th / 2 - 1} stroke="#fff" strokeWidth="1" opacity="0.8"/>)}
      <text x={pad - 6} y={H - 8} style={lbl}>incl {incl}° · {Number(p.comprimento) || 0} mm · palheta {p.palheta} mm · {p.velocidade} m/s</text>
    </svg>
  );
}

/* ---------- MODAL: Configurador ---------- */
function ConfiguradorModal({ spec, onClose, onSaved }) {
  const editing = !!spec;
  const idRef = React.useRef(spec?.id || ("EQ-" + Date.now().toString().slice(-6)));
  const [tipo, setTipo] = React.useState(spec?.tipo || "escada_rolante");
  const [ref, setRef] = React.useState(spec?.referencia || "");
  const [resp, setResp] = React.useState(spec?.responsavel || "");
  const [obs, setObs] = React.useState(spec?.observacoes || "");
  const [params, setParams] = React.useState(
    spec?.params && Object.keys(spec.params).length ? spec.params : EQ_DEFAULTS[spec?.tipo || "escada_rolante"]);
  const [anexos, setAnexos] = React.useState(spec?.anexos || []);
  const [projetoPdf, setProjetoPdf] = React.useState(spec?.projeto_pdf_recebido ? spec.projeto_pdf : null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const setTipoAndDefaults = (t) => { setTipo(t); setParams(EQ_DEFAULTS[t]); };
  const setP = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const computed = eqCompute(tipo, params);

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    const novos = [];
    for (const file of files) {
      const path = `${idRef.current}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await window.__VP_SB.sb.storage.from("engenharia").upload(path, file, { upsert: true });
      if (error) { window.toast("Falha no upload: " + error.message, "error"); continue; }
      const { data } = window.__VP_SB.sb.storage.from("engenharia").getPublicUrl(path);
      novos.push({ nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path });
    }
    setAnexos(a => [...a, ...novos]);
    setUploading(false);
    if (novos.length) window.toast(`${novos.length} arquivo(s) anexado(s).`, "success");
  };

  const removeAnexo = async (i) => {
    const a = anexos[i];
    if (a?.path) await window.__VP_SB.sb.storage.from("engenharia").remove([a.path]);
    setAnexos(prev => prev.filter((_, idx) => idx !== i));
  };

  const save = async (finalizar) => {
    if (!ref.trim()) return window.toast("Prédio / empreendimento é obrigatório.", "warning");
    setSaving(true);
    const row = {
      id: idRef.current, referencia: ref, responsavel: resp || null, tipo,
      status: finalizar ? "finalizado" : "rascunho",
      params, computed: eqCompute(tipo, params), anexos, observacoes: obs || null,
      projeto_pdf_recebido: !!projetoPdf,
      projeto_pdf: projetoPdf || null,
      updated_at: new Date().toISOString(),
    };
    const q = editing
      ? window.__VP_SB.sb.from("equipamentos_spec").update(row).eq("id", idRef.current)
      : window.__VP_SB.sb.from("equipamentos_spec").insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) return window.toast("Erro: " + error.message, "error");
    window.toast(finalizar ? "Especificação finalizada!" : "Rascunho salvo.", "success");
    onSaved?.(); onClose();
  };

  const field = (fd) => (
    <div className="stack" style={{ gap: 4 }} key={fd.k}>
      <label className="up-eyebrow muted">{fd.label}{fd.suffix ? ` (${fd.suffix})` : ""}</label>
      {fd.opts
        ? <select className="input" value={params[fd.k]} onChange={e => {
            const num = fd.opts.every(o => typeof o === "number");
            setP(fd.k, num ? Number(e.target.value) : e.target.value);
          }}>
            {fd.opts.map(o => <option key={o} value={o}>{o}{fd.suffix ? ` ${fd.suffix}` : ""}</option>)}
          </select>
        : <input className="input" type={fd.num ? "number" : "text"} value={params[fd.k] || ""} onChange={e => setP(fd.k, e.target.value)}/>}
    </div>
  );

  return (
    <Modal title={editing ? `Projeto de equipamento · ${idRef.current}` : "Novo projeto de equipamento"} onClose={onClose} width={760}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={saving || uploading}>Salvar rascunho</Button>
        <Button variant="primary" onClick={() => save(true)} disabled={saving || uploading}>{saving ? "Salvando…" : "Finalizar especificação"}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Prédio / Empreendimento *</label>
            <input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="Shopping Vila Olímpia…"/></div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Responsável técnico</label>
            <input className="input" value={resp} onChange={e => setResp(e.target.value)} placeholder="Engenheiro da VP"/></div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label className="up-eyebrow muted">Tipo de equipamento</label>
          <div className="seg">
            {EQ_TIPOS.map(t => <button key={t.key} className={tipo === t.key ? "is-active" : ""} onClick={() => setTipoAndDefaults(t.key)}>{t.label}</button>)}
          </div>
          <p className="muted small" style={{ margin: 0 }}>Elevador tem tela própria: <b>Engenharia · Projeto de Elevadores</b>.</p>
        </div>

        <div style={{ border: "1px solid var(--border)", background: "var(--vp-gray-50)", padding: 8 }}>
          <div className="up-eyebrow muted" style={{ fontSize: 9, marginBottom: 4 }}>Esquema (vista lateral) — atualiza com a configuração</div>
          <EqSchematic tipo={tipo} p={params} c={computed}/>
        </div>

        <div className="grid-2" style={{ gap: 20, gridTemplateColumns: "1fr 280px" }}>
          <div className="grid-2" style={{ gap: 12, alignContent: "start" }}>
            {EQ_FIELDS[tipo].map(field)}
          </div>
          <div style={{ padding: 14, background: "var(--vp-gray-50)", border: "1px solid var(--border)" }}>
            <div className="up-eyebrow" style={{ color: "var(--vp-yellow-press)", marginBottom: 8 }}>Resumo técnico calculado</div>
            <EqComputed tipo={tipo} c={computed} p={params}/>
          </div>
        </div>

        <div className="stack" style={{ gap: 6, padding: "12px", background: "#fef3c7", borderRadius: "4px", border: "1px solid #fbbf24" }}>
          <label className="up-eyebrow muted" style={{ color: "#92400e", fontWeight: 700 }}>📄 PDF do Projeto (Inglês + Chinês)</label>
          <p style={{ margin: 0, fontSize: 12, color: "#b45309", lineHeight: 1.4 }}>
            {projetoPdf
              ? `✅ PDF recebido: ${projetoPdf.nome || 'arquivo enviado'}`
              : '❌ Aguardando o PDF do projeto traduzido. Este é o segundo gatilho crítico para iniciar a importação.'}
          </p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", cursor: "pointer", border: "1px solid #d97706", padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#fff" }}>
            <Icon.upload size={12}/> {uploading ? "Enviando…" : "Carregar PDF"}
            <input type="file" accept=".pdf" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              const path = `${idRef.current}/${Date.now()}_projeto_${file.name.replace(/[^\w.\-]/g, "_")}`;
              const { error } = await window.__VP_SB.sb.storage.from("engenharia").upload(path, file, { upsert: true });
              if (error) { window.toast("Falha no upload: " + error.message, "error"); setUploading(false); return; }
              const { data } = window.__VP_SB.sb.storage.from("engenharia").getPublicUrl(path);
              setProjetoPdf({ nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path });
              setUploading(false);
              window.toast("PDF do projeto carregado com sucesso!", "success");
            }}/>
          </label>
          {projetoPdf && (
            <button onClick={() => {
              if (projetoPdf?.path) window.__VP_SB.sb.storage.from("engenharia").remove([projetoPdf.path]);
              setProjetoPdf(null);
            }} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", border: "1px solid #ef4444", color: "#991b1b", padding: "4px 8px", fontSize: 11, background: "#fee2e2", borderRadius: "3px" }}>
              <Icon.x size={11}/> Remover PDF
            </button>
          )}
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label className="up-eyebrow muted">Desenhos técnicos & imagens (ajuda a Compra a acertar o pedido)</label>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {anexos.map((a, i) => (
              <div key={i} className="row gap-2" style={{ border: "1px solid var(--border)", padding: "6px 8px", fontSize: 12, alignItems: "center" }}>
                <Icon.fileText size={14} color="var(--vp-success)"/>
                <a href={a.url} target="_blank" rel="noreferrer" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</a>
                <button onClick={() => removeAnexo(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg3)" }}><Icon.x size={12}/></button>
              </div>
            ))}
            {anexos.length === 0 ? <span className="muted small">Nenhum arquivo anexado.</span> : null}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", cursor: "pointer", border: "1px solid var(--border)", padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#fff" }}>
            <Icon.upload size={12}/> {uploading ? "Enviando…" : "Anexar arquivo"}
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.xlsx" style={{ display: "none" }} onChange={e => onFiles(e.target.files)}/>
          </label>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações para Compras</label>
          <textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} placeholder="Marca/fornecedor preferencial, prazo, normas exigidas…"/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- PÁGINA: Configurador de Equipamentos ---------- */
function ConfiguradorPage({ setRoute }) {
  const [specs, setSpecs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todos");
  const [edit, setEdit] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);

  const reload = React.useCallback(() => {
    setLoading(true);
    return window.__VP_SB.sb.from("equipamentos_spec").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setSpecs(data || []); setLoading(false); });
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div>;

  const tipos = ["Todos", "escada_rolante", "esteira_rolante"];
  const rows = specs.filter(s => filter === "Todos" || s.tipo === filter);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Projeto de Equipamento</div>
          <h1 className="page-head__title">Projeto de Equipamento</h1>
          <p className="page-head__sub">Especificação técnica de escadas e esteiras rolantes — com desenho e anexos — para orientar a compra do equipamento correto.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEdit(null); setShowModal(true); }}>Novo projeto de equipamento</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Equipamentos" value={specs.length} sub="especificados" icon="ruler"/>
        <KPI label="Escadas rolantes" value={specs.filter(s => s.tipo === "escada_rolante").length} sub="configuradas" icon="grid"/>
        <KPI label="Esteiras rolantes" value={specs.filter(s => s.tipo === "esteira_rolante").length} sub="configuradas" icon="grid"/>
        <KPI label="Finalizados" value={specs.filter(s => s.status === "finalizado").length} sub="prontos p/ compra" icon="check"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {tipos.map(t => <button key={t} className={filter === t ? "is-active" : ""} onClick={() => setFilter(t)}>{t === "Todos" ? "Todos" : tipoLabel(t)}</button>)}
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Referência</th><th>Tipo</th><th>Configuração</th><th>Capacidade</th><th>Anexos</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhum equipamento configurado</h4><p>Clique em "Novo projeto de equipamento" para especificar uma escada ou esteira rolante.</p></div></td></tr>
            )}
            {rows.map(s => (
              <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => { setEdit(s); setShowModal(true); }}>
                <td><div className="cell-main">{s.referencia || "—"}</div><div className="cell-sub">{s.id}{s.responsavel ? ` · ${s.responsavel}` : ""}</div></td>
                <td>{tipoLabel(s.tipo)}</td>
                <td><span className="small">{eqResumo(s.tipo, s.params || {})}</span></td>
                <td><span className="mono small">{s.computed && s.computed.capacidade ? s.computed.capacidade.toLocaleString("pt-BR") + " p/h" : "—"}</span></td>
                <td><span className="mono small">{(s.anexos || []).length} arq.</span></td>
                <td><Badge variant={s.status === "finalizado" ? "success" : "warning"} dot>{s.status === "finalizado" ? "Finalizado" : "Rascunho"}</Badge></td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <ConfiguradorModal spec={edit} onClose={() => { setShowModal(false); setEdit(null); }} onSaved={reload}/>}
    </div>
  );
}

Object.assign(window, { ConfiguradorPage });
