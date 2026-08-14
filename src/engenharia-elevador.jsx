/* ============================================================
   engenharia-elevador.jsx — Projeto de Elevadores (Engenharia)
   Trata/traduz os desenhos técnicos que o fornecedor manda junto da
   cotação (poço, cabine, porta, COP/LOP) — correlacionado pelo Nº da
   Cotação, que também amarra Tratativas, Precificação e Proposta.
   Fonte de dados: projetos_elevador (Supabase) · bucket: engenharia
   ============================================================ */

const PE_TIPOS = ["Passageiro", "Carga", "Hospitalar", "Panorâmico"];
const PE_PORTA_TIPOS = ["Central", "Lateral"];

function peNovaUnidade(n) {
  return {
    identificador: "E" + n, tipo: "Passageiro", casaMaquinas: "sem",
    capacidadeKg: "", velocidadeMs: "", paradas: "",
    pocoLarguraMm: "", pocoProfundidadeMm: "", overheadMm: "", fossoMm: "", percursoMm: "",
    cabineLarguraMm: "", cabineProfundidadeMm: "", cabineAlturaMm: "",
    portaTipo: "Central", portaLarguraMm: "", portaAlturaMm: "",
    cop: "", lop: "", observacoes: "",
  };
}

function peUnidadeResumo(u) {
  const partes = [];
  if (u.capacidadeKg) partes.push(`${u.capacidadeKg}kg`);
  if (u.velocidadeMs) partes.push(`${u.velocidadeMs}m/s`);
  if (u.paradas) partes.push(`${u.paradas} paradas`);
  return partes.join(" · ") || "—";
}

/* ---------- MODAL: Projeto de Elevadores ---------- */
function ProjetoElevadorModal({ projeto, onClose, onSaved }) {
  const store = window.ProjetoElevadorStore;
  const editing = !!projeto;
  const idRef = React.useRef(projeto?.id || store.uuid());
  const [numeroCotacao, setNumeroCotacao] = React.useState(projeto?.numero_cotacao || "");
  const [referencia, setReferencia] = React.useState(projeto?.referencia || "");
  const [responsavel, setResponsavel] = React.useState(projeto?.responsavel || "");
  const [unidades, setUnidades] = React.useState(projeto?.unidades?.length ? projeto.unidades : [peNovaUnidade(1)]);
  const [anexos, setAnexos] = React.useState(projeto?.anexos || []);
  const [observacoes, setObservacoes] = React.useState(projeto?.observacoes || "");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const setU = (i, k, v) => setUnidades(us => us.map((u, idx) => idx === i ? { ...u, [k]: v } : u));
  const addUnidade = () => setUnidades(us => [...us, peNovaUnidade(us.length + 1)]);
  const removeUnidade = (i) => setUnidades(us => us.length > 1 ? us.filter((_, idx) => idx !== i) : us);

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    const novos = [];
    for (const file of files) {
      try { novos.push(await store.uploadAnexo(idRef.current, file)); }
      catch (e) { window.toast("Falha no upload: " + e.message, "error"); }
    }
    setAnexos(a => [...a, ...novos]);
    setUploading(false);
    if (novos.length) window.toast(`${novos.length} arquivo(s) anexado(s).`, "success");
  };

  const removeAnexo = async (i) => {
    const a = anexos[i];
    if (a?.path) await store.removerAnexo(a.path);
    setAnexos(prev => prev.filter((_, idx) => idx !== i));
  };

  const save = async (finalizar) => {
    setSaving(true);
    try {
      const salvo = await store.salvar({
        id: idRef.current, isNew: !editing,
        numeroCotacao: numeroCotacao ? Number(numeroCotacao) : null,
        cotacaoFornecedorId: projeto?.cotacao_fornecedor_id || null,
        referencia, responsavel, unidades, anexos, observacoes,
        status: finalizar ? "finalizado" : "rascunho",
      });
      if (finalizar && salvo) await store.finalizar(salvo.id);
      window.toast(finalizar ? "Projeto finalizado!" : "Rascunho salvo.", "success");
      onSaved?.(); onClose();
    } catch (e) { window.toast("Erro: " + e.message, "error"); }
    setSaving(false);
  };

  const field = (label, value, onChange, opts) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} {...opts}/>
    </div>
  );

  return (
    <Modal title={editing ? `Projeto de elevadores · ${referencia || idRef.current}` : "Novo projeto de elevadores"} onClose={onClose} width={860}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={saving || uploading}>Salvar rascunho</Button>
        <Button variant="primary" onClick={() => save(true)} disabled={saving || uploading}>{saving ? "Salvando…" : "Finalizar projeto"}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          {field("Prédio / Empreendimento *", referencia, setReferencia, { placeholder: "Shopping Vila Olímpia…" })}
          {field("Nº da Cotação", numeroCotacao, setNumeroCotacao, { type: "number", placeholder: "706" })}
        </div>
        {field("Responsável técnico", responsavel, setResponsavel, { placeholder: "Engenheiro da VP" })}

        <div className="stack" style={{ gap: 8 }}>
          <div className="row sb">
            <label className="up-eyebrow muted">Unidades (elevadores desta cotação)</label>
            <Button variant="outline" size="sm" icon="plus" onClick={addUnidade}>Adicionar unidade</Button>
          </div>
          {unidades.map((u, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", padding: 12, background: "var(--vp-gray-50)" }}>
              <div className="row sb" style={{ marginBottom: 8 }}>
                <input className="input" style={{ maxWidth: 90, fontWeight: 700 }} value={u.identificador} onChange={e => setU(i, "identificador", e.target.value)}/>
                {unidades.length > 1 && <button onClick={() => removeUnidade(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg3)" }}><Icon.x size={14}/></button>}
              </div>
              <div className="grid-4" style={{ gap: 8, marginBottom: 8 }}>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Tipo</label>
                  <select className="input" value={u.tipo} onChange={e => setU(i, "tipo", e.target.value)}>
                    {PE_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Casa de máquinas</label>
                  <select className="input" value={u.casaMaquinas} onChange={e => setU(i, "casaMaquinas", e.target.value)}>
                    <option value="sem">Sem (MRL)</option><option value="com">Com</option>
                  </select></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Capacidade (kg)</label>
                  <input className="input" type="number" value={u.capacidadeKg} onChange={e => setU(i, "capacidadeKg", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Velocidade (m/s)</label>
                  <input className="input" type="number" step="0.05" value={u.velocidadeMs} onChange={e => setU(i, "velocidadeMs", e.target.value)}/></div>
              </div>
              <div className="grid-4" style={{ gap: 8, marginBottom: 8 }}>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Poço larg. (mm)</label>
                  <input className="input" type="number" value={u.pocoLarguraMm} onChange={e => setU(i, "pocoLarguraMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Poço prof. (mm)</label>
                  <input className="input" type="number" value={u.pocoProfundidadeMm} onChange={e => setU(i, "pocoProfundidadeMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Overhead (mm)</label>
                  <input className="input" type="number" value={u.overheadMm} onChange={e => setU(i, "overheadMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Fosso (mm)</label>
                  <input className="input" type="number" value={u.fossoMm} onChange={e => setU(i, "fossoMm", e.target.value)}/></div>
              </div>
              <div className="grid-4" style={{ gap: 8, marginBottom: 8 }}>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Percurso (mm)</label>
                  <input className="input" type="number" value={u.percursoMm} onChange={e => setU(i, "percursoMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Paradas</label>
                  <input className="input" type="number" value={u.paradas} onChange={e => setU(i, "paradas", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">COP</label>
                  <input className="input" value={u.cop} onChange={e => setU(i, "cop", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">LOP</label>
                  <input className="input" value={u.lop} onChange={e => setU(i, "lop", e.target.value)}/></div>
              </div>
              <div className="grid-4" style={{ gap: 8, marginBottom: 8 }}>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Cabine larg. (mm)</label>
                  <input className="input" type="number" value={u.cabineLarguraMm} onChange={e => setU(i, "cabineLarguraMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Cabine prof. (mm)</label>
                  <input className="input" type="number" value={u.cabineProfundidadeMm} onChange={e => setU(i, "cabineProfundidadeMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Cabine alt. (mm)</label>
                  <input className="input" type="number" value={u.cabineAlturaMm} onChange={e => setU(i, "cabineAlturaMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Tipo de porta</label>
                  <select className="input" value={u.portaTipo} onChange={e => setU(i, "portaTipo", e.target.value)}>
                    {PE_PORTA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
              </div>
              <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Porta larg. (mm)</label>
                  <input className="input" type="number" value={u.portaLarguraMm} onChange={e => setU(i, "portaLarguraMm", e.target.value)}/></div>
                <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Porta alt. (mm)</label>
                  <input className="input" type="number" value={u.portaAlturaMm} onChange={e => setU(i, "portaAlturaMm", e.target.value)}/></div>
              </div>
              <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Observações da unidade</label>
                <input className="input" value={u.observacoes} onChange={e => setU(i, "observacoes", e.target.value)} placeholder="Acabamento, norma exigida (EN81-72)…"/></div>
            </div>
          ))}
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label className="up-eyebrow muted">Desenhos técnicos & anexos do fornecedor</label>
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
          <label className="up-eyebrow muted">Observações gerais</label>
          <textarea className="input" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} placeholder="Pendências, divergências entre unidades…"/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- PÁGINA: Projeto de Elevadores ---------- */
function ProjetoElevadorPage({ setRoute }) {
  const store = window.ProjetoElevadorStore;
  const [projetos, setProjetos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [edit, setEdit] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);

  const reload = React.useCallback(() => {
    setLoading(true);
    return store.listarTodas().then(data => { setProjetos(data); setLoading(false); });
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando…</div>;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Projeto de Elevadores</div>
          <h1 className="page-head__title">Projeto de Elevadores</h1>
          <p className="page-head__sub">Especificação técnica do poço/cabine/porta de cada unidade — trata e traduz os desenhos que o fornecedor manda, amarrado ao Nº da Cotação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEdit(null); setShowModal(true); }}>Novo projeto de elevadores</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Projetos" value={projetos.length} sub="cotações com desenho" icon="ruler"/>
        <KPI label="Unidades" value={projetos.reduce((s, p) => s + (p.unidades || []).length, 0)} sub="elevadores especificados" icon="grid"/>
        <KPI label="Rascunho" value={projetos.filter(p => p.status !== "finalizado").length} sub="em tratamento" icon="clock"/>
        <KPI label="Finalizados" value={projetos.filter(p => p.status === "finalizado").length} sub="prontos p/ seguir no fluxo" icon="check"/>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Referência</th><th>Nº Cotação</th><th>Unidades</th><th>Anexos</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {projetos.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhum projeto de elevadores</h4><p>Clique em "Novo projeto de elevadores" para tratar o desenho técnico de uma cotação.</p></div></td></tr>
            )}
            {projetos.map(p => (
              <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => { setEdit(p); setShowModal(true); }}>
                <td><div className="cell-main">{p.referencia || "—"}</div><div className="cell-sub">{p.responsavel || "—"}</div></td>
                <td><span className="mono small">{p.numero_cotacao ?? "—"}</span></td>
                <td><span className="small">{(p.unidades || []).length} unid. · {(p.unidades || []).map(u => u.identificador).join(", ")}</span></td>
                <td><span className="mono small">{(p.anexos || []).length} arq.</span></td>
                <td><Badge variant={p.status === "finalizado" ? "success" : "warning"} dot>{p.status === "finalizado" ? "Finalizado" : "Rascunho"}</Badge></td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <ProjetoElevadorModal projeto={edit} onClose={() => { setShowModal(false); setEdit(null); }} onSaved={reload}/>}
    </div>
  );
}

Object.assign(window, { ProjetoElevadorPage });
