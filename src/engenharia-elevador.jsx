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
function ProjetoElevadorEspecificacao({ abas }) {
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

      {abas}

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

/* ---------- ABA: Desenhos (repositório p/ enviar ao cliente) ---------- */
function peFmtData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function peFmtTam(b) {
  if (!b) return "—";
  return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
}
function peNorm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function peMascaraDoc(d) {
  const n = String(d || "").replace(/\D/g, "");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d || "";
}

const PE_DOC_TIPOS = [
  { key: "projeto_instalacao", label: "Projeto de Instalação" },
  { key: "id_tag", label: "ID-TAG" },
];
function peTipoLabel(k) { return (PE_DOC_TIPOS.find(t => t.key === k) || PE_DOC_TIPOS[0]).label; }
function peNormCodigo(v) { return String(v || "").trim().toUpperCase().replace(/\s+/g, ""); }

function DesenhoModal({ onClose, onSaved }) {
  const store = window.ProjetoElevadorStore;
  const [referencia, setReferencia] = React.useState("");
  const [cliente, setCliente] = React.useState("");
  const [doc, setDoc] = React.useState("");
  const [cotacao, setCotacao] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [arquivos, setArquivos] = React.useState({ projeto_instalacao: [], id_tag: [] });
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState("");
  /* vínculo resolvido (obra e cliente cadastrados) + avisos das buscas */
  const [vinc, setVinc] = React.useState({ formularioId: null, clienteId: null });
  const [obra, setObra] = React.useState(null);           // { predio, cidade, uf, numeroCotacao }
  const [obraInfo, setObraInfo] = React.useState(null);   // { ok, texto } (só quando NÃO achou / deu erro)
  const [docInfo, setDocInfo] = React.useState(null);     // { ok, texto }
  const [obras, setObras] = React.useState([]);           // obras do cliente achado pelo documento
  /* equipamentos: sugeridos pela obra (marcados por padrão) + códigos digitados pelo usuário */
  const [sugeridos, setSugeridos] = React.useState([]);
  const [desmarcados, setDesmarcados] = React.useState([]);
  const [extras, setExtras] = React.useState([]);
  const [extraTxt, setExtraTxt] = React.useState("");
  const auto = React.useRef({ referencia: "", cliente: "", doc: "" }); // o que foi preenchido pela busca (não pelo usuário)

  /* Nº da cotação → obra + cliente + equipamentos */
  React.useEffect(() => {
    const n = Number(cotacao);
    if (!(n > 0)) { setObra(null); setObraInfo(null); setSugeridos([]); setVinc(v => ({ ...v, formularioId: null })); return; }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const o = await store.buscarObraPorCotacao(n);
        if (!vivo) return;
        if (!o) { setObra(null); setSugeridos([]); setObraInfo({ ok: false, texto: `Cotação Nº ${n} não encontrada nos formulários.` }); setVinc(v => ({ ...v, formularioId: null })); return; }
        setObraInfo(null);
        setObra({ predio: o.predio, cidade: o.cidade, uf: o.uf, numeroCotacao: o.numeroCotacao });
        setVinc({ formularioId: o.formularioId, clienteId: o.clienteId });
        setSugeridos(o.equipamentos || []); setDesmarcados([]);
        // só preenche o que o usuário não digitou por conta própria
        setReferencia(r => (!r || r === auto.current.referencia) ? (auto.current.referencia = o.predio || r) : r);
        setCliente(c => (!c || c === auto.current.cliente) ? (auto.current.cliente = o.clienteNome || c) : c);
        setDoc(d => (!d || d === auto.current.doc) ? (auto.current.doc = peMascaraDoc(o.clienteDocumento) || d) : d);
      } catch (e) { if (vivo) { setObra(null); setSugeridos([]); setObraInfo({ ok: false, texto: e.message }); setVinc(v => ({ ...v, formularioId: null })); } }
    }, 450);
    return () => { vivo = false; clearTimeout(t); };
  }, [cotacao]);

  /* CPF/CNPJ → cliente cadastrado + obras dele */
  React.useEffect(() => {
    const d = doc.replace(/\D/g, "");
    if (d.length !== 11 && d.length !== 14) { setDocInfo(null); setObras([]); return; }
    let vivo = true;
    (async () => {
      try {
        const cl = await store.buscarClientePorDocumento(d);
        if (!vivo) return;
        if (!cl) { setDocInfo({ ok: false, texto: "CPF/CNPJ não encontrado no cadastro de clientes (o desenho será salvo só com o texto digitado)." }); setObras([]); setVinc(v => ({ ...v, clienteId: null })); return; }
        setDocInfo({ ok: true, texto: "Cliente encontrado no cadastro." });
        setVinc(v => ({ ...v, clienteId: cl.id }));
        setCliente(c => (!c || c === auto.current.cliente) ? (auto.current.cliente = cl.nome) : c);
        setObras(await store.obrasDoCliente(cl.id));
      } catch (e) { if (vivo) setDocInfo({ ok: false, texto: e.message }); }
    })();
    return () => { vivo = false; };
  }, [doc]);

  const equipamentos = [...sugeridos.filter(c => !desmarcados.includes(c)), ...extras.filter(c => !sugeridos.includes(c))];
  const alternar = (c) => setDesmarcados(d => d.includes(c) ? d.filter(x => x !== c) : [...d, c]);
  const addExtra = () => {
    const c = peNormCodigo(extraTxt);
    if (!c) return;
    if (!sugeridos.includes(c) && !extras.includes(c)) setExtras(e => [...e, c]);
    setDesmarcados(d => d.filter(x => x !== c));
    setExtraTxt("");
  };
  const setArq = (tipo, lista) => setArquivos(a => ({ ...a, [tipo]: lista }));

  const salvar = async () => {
    setErro("");
    if (!referencia.trim()) return setErro("Informe o prédio/empreendimento.");
    if (!equipamentos.length) return setErro("Informe o código do equipamento (ex.: VPEL-EL0955-1).");
    if (!arquivos.projeto_instalacao.length && !arquivos.id_tag.length) return setErro("Anexe o Projeto de Instalação e/ou o ID-TAG.");
    setSaving(true);
    try {
      const salvos = await store.salvarDesenhos({
        referencia, clienteNome: cliente, numeroCotacao: cotacao ? Number(cotacao) : null, observacao: obs.trim(),
        docs: PE_DOC_TIPOS.map(t => ({ tipo: t.key, files: arquivos[t.key] })), equipamentos,
        formularioId: vinc.formularioId, clienteId: vinc.clienteId, clienteDocumento: doc.replace(/\D/g, "") || null,
      });
      window.toast?.(`${salvos.length} documento(s) salvo(s).`, "success");
      onSaved();
    } catch (e) { setErro(e.message); setSaving(false); }
  };

  const aviso = (info) => info ? <span className="small" style={{ color: info.ok ? "var(--vp-success)" : "var(--fg3)" }}>{info.ok ? "✓ " : ""}{info.texto}</span> : null;
  const faltaUm = (!!arquivos.projeto_instalacao.length) !== (!!arquivos.id_tag.length);

  return (
    <Modal title="Salvar documentos da obra" onClose={saving ? () => {} : onClose} width={640}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Nº da Cotação (opcional)</label>
            <input className="input" type="number" value={cotacao} onChange={e => setCotacao(e.target.value)} placeholder="955"/>
            {aviso(obraInfo)}</div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">CPF / CNPJ do cliente (opcional)</label>
            <input className="input" value={doc} onChange={e => setDoc(e.target.value)} placeholder="Digite o CNPJ ou CPF"/>
            {aviso(docInfo)}</div>
        </div>

        {obra && (
          <div style={{ border: "1px solid var(--border)", background: "var(--vp-gray-50)", padding: "8px 12px", fontSize: 13 }}>
            <span className="up-eyebrow muted">Obra vinculada</span><br/>
            <b>Cotação Nº {obra.numeroCotacao}</b> · {obra.predio || "(sem nome)"}{obra.cidade ? ` · ${obra.cidade}/${obra.uf}` : ""}
          </div>
        )}
        {!obra && obras.length > 0 && (
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Obras deste cliente — escolha a obra</label>
            <select className="input" value="" onChange={e => { const o = obras.find(x => x.formularioId === e.target.value); if (o) setCotacao(String(o.numeroCotacao || "")); }}>
              <option value="">— selecione a obra —</option>
              {obras.map(o => <option key={o.formularioId} value={o.formularioId}>Cotação {o.numeroCotacao} · {o.predio || "sem nome"}{o.cidade ? " · " + o.cidade + "/" + o.uf : ""}</option>)}
            </select></div>
        )}

        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Prédio / Empreendimento *</label>
            <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Shopping Vila Olímpia…"/></div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Cliente (opcional)</label>
            <input className="input" value={cliente} onChange={e => setCliente(e.target.value)}/></div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label className="up-eyebrow muted">Equipamento(s) *</label>
          {sugeridos.length > 0 && (
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {sugeridos.map(c => (
                <label key={c} style={{ display: "inline-flex", gap: 6, alignItems: "center", border: "1px solid var(--border)", padding: "4px 10px", fontSize: 13, cursor: "pointer", background: desmarcados.includes(c) ? "transparent" : "var(--vp-gray-50)" }}>
                  <input type="checkbox" checked={!desmarcados.includes(c)} onChange={() => alternar(c)}/> <span className="mono">{c}</span>
                </label>
              ))}
            </div>
          )}
          {extras.length > 0 && (
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {extras.map(c => (
                <span key={c} className="mono" style={{ border: "1px solid var(--border)", padding: "4px 10px", fontSize: 13, background: "var(--vp-gray-50)" }}>
                  {c} <button onClick={() => setExtras(e => e.filter(x => x !== c))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg3)" }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="row gap-2">
            <input className="input" style={{ flex: 1 }} value={extraTxt} onChange={e => setExtraTxt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
              placeholder={sugeridos.length ? "Outro código de equipamento…" : "Digite o código do equipamento — ex.: VPEL-EL0955-1"}/>
            <Button variant="outline" onClick={addExtra}>Adicionar</Button>
          </div>
          <span className="muted small">{sugeridos.length ? "Códigos achados na Proposta/Precificação desta cotação. Desmarque o que o documento não cobre ou acrescente outro." : "Informe a cotação para sugerir os códigos, ou digite-os."}</span>
        </div>

        {PE_DOC_TIPOS.map(t => (
          <div key={t.key} className="stack" style={{ gap: 4, border: "1px solid var(--border)", padding: 10 }}>
            <label className="up-eyebrow muted">{t.label}</label>
            <input type="file" multiple accept={t.key === "id_tag" ? ".pdf,application/pdf" : ".pdf,.png,.jpg,.jpeg,.dwg,.dxf"} onChange={e => setArq(t.key, Array.from(e.target.files || []))}/>
            {t.key === "id_tag" && <span className="muted small">Somente PDF.</span>}
            {arquivos[t.key].length > 0 && <span className="muted small">{arquivos[t.key].length} arquivo(s) selecionado(s).</span>}
          </div>
        ))}
        <span className="muted small">Projeto de Instalação: PDF, PNG, JPG, DWG ou DXF. ID-TAG: PDF. Máx. 25 MB cada. Cada obra leva os dois documentos.</span>
        {faltaUm && <div style={{ color: "#92400e", fontSize: 13 }}>⚠ Falta anexar o {arquivos.projeto_instalacao.length ? "ID-TAG" : "Projeto de Instalação"} desta obra (você pode salvar assim e completar depois).</div>}

        <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Observação (opcional)</label>
          <input className="input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: planta do poço, revisão 2"/></div>
        {erro && <div style={{ color: "#b91c1c", fontSize: 13 }}>{erro}</div>}
      </div>
    </Modal>
  );
}

/* ---------- Assinatura digital do Projeto de Instalação (cliente assina em /assinar/<token>) ----------
   Pedido do usuário (05/10/2026): só o REPRESENTANTE do cliente assina, sem trava de envio.
   Reaproveita documento_signatarios (documento_tipo 'projeto_instalacao', documento_id = id do desenho)
   e a página pública /assinar. PDF assinado = original + página de assinaturas (projeto-assinado-pdf.js).
   REGRA TRAVADA (ver CLAUDE.md): o PDF assinado traz nome, data/hora, dispositivo, IP e hash. */
const PE_ASSIN_STATUS = {
  pendente: { label: "Link criado", variant: "info" },
  enviado: { label: "Enviado p/ assinatura", variant: "info" },
  visualizado: { label: "Visualizado", variant: "warning" },
  assinado: { label: "✓ Assinado", variant: "success" },
  recusado: { label: "Recusado", variant: "danger" },
  expirado: { label: "Expirado", variant: "danger" },
};

function ModalAssinaturaProjeto({ item, linha, onClose, onChanged }) {
  const S = window.DocumentoSignatariosStore;
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [tel, setTel] = React.useState("");
  const [sig, setSig] = React.useState(linha || null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState("");

  const url = sig ? S.signUrl(sig.token) : "";
  const primeiro = ((sig && sig.nome) || nome || "").trim().split(/\s+/)[0] || "";
  const mensagem = `Olá${primeiro ? " " + primeiro : ""}! A VerticalParts enviou o Projeto de Instalação da obra ${item.referencia} para sua assinatura digital.\n\nAssine pelo link seguro e individual:\n${url}`;
  const assunto = `Projeto de Instalação — ${item.referencia} — Assinatura digital | Vertical Parts`;

  const criar = async () => {
    setErro("");
    if (!nome.trim()) return setErro("Informe o nome do representante do cliente.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    setBusy(true);
    try {
      const nova = await S.criar({ documentoTipo: "projeto_instalacao", documentoId: item.id, nome, email, telefone: tel, papel: "Representante do cliente", ordem: 1 });
      setSig(nova); onChanged && onChanged();
      window.VPLog?.registrar({ modulo: "Projeto de Elevadores", acao: "Criou link de assinatura do Projeto de Instalação", alvo: item.referencia, alvo_id: item.id, detalhe: { representante: nova.nome, numero_cotacao: item.numero_cotacao } });
    } catch (e) { setErro(e.message || String(e)); }
    setBusy(false);
  };

  const marcar = async (canal) => {
    try {
      const upd = await S.marcarEnviado(sig.id, canal, { name: sig.nome, contact: canal === "whatsapp" ? sig.telefone : sig.email });
      setSig(upd); onChanged && onChanged();
      window.VPLog?.registrar({ modulo: "Projeto de Elevadores", acao: "Enviou o Projeto de Instalação para assinatura (" + canal + ")", alvo: item.referencia, alvo_id: item.id, detalhe: { representante: sig.nome, canal } });
    } catch (e) { setErro(e.message || String(e)); }
  };

  const enviarEmail = async () => {
    setBusy(true); setErro("");
    const r = await window.EmailEnvioHelper.tentarEnviarDireto({
      to: sig.email, subject: assunto, text: mensagem,
      numeroCotacao: item.numero_cotacao, referenciaTipo: "projeto_instalacao", referenciaId: item.id,
    });
    if (r.enviouDireto) { window.toast?.("E-mail enviado a " + sig.email + ".", "success"); await marcar("email"); }
    else {
      window.toast?.("Não foi possível enviar direto pelo sistema — abrindo seu e-mail. O envio só é registrado quando sai pelo sistema.", "warning");
      window.open("mailto:" + encodeURIComponent(sig.email) + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(mensagem), "_blank");
    }
    setBusy(false);
  };
  const enviarWhats = async () => {
    let d = String(sig.telefone || "").replace(/\D/g, "");
    if (!d) return setErro("Este representante não tem telefone cadastrado.");
    if (d.length <= 11) d = "55" + d;
    window.open("https://wa.me/" + d + "?text=" + encodeURIComponent(mensagem), "_blank");
    await marcar("whatsapp");
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); window.toast?.("Link individual copiado. Cole no WhatsApp ou e-mail.", "success"); }
    catch { window.prompt("Copie o link:", url); }
    await marcar("link");
  };
  const baixarAssinado = async () => {
    setBusy(true); setErro("");
    try {
      const ass = window.ProjetoAssinadoPdf.assinaturasDe([sig]);
      await window.ProjetoAssinadoPdf.baixar(item, ass, `Projeto de Instalação - ${item.referencia} - assinado.pdf`);
    } catch (e) { setErro("Não foi possível gerar o PDF assinado: " + (e.message || e)); }
    setBusy(false);
  };
  const novoLink = () => {
    if (!window.confirm("Gerar um novo link? O link atual deixa de ser o usado nesta tela (ele continua no histórico).")) return;
    setSig(null);
  };

  const st = sig && PE_ASSIN_STATUS[sig.status];
  const au = (sig && sig.audit) || {};
  return (
    <Modal title="Assinatura do Projeto de Instalação" onClose={onClose} width={560}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <p style={{ marginTop: 0 }}><b>{item.referencia}</b><br/><span className="muted small">{item.cliente_nome || "—"} · {item.arquivo_nome}</span></p>
      {!sig && (
        <div style={{ display: "grid", gap: 10 }}>
          <p className="muted small" style={{ margin: 0 }}>Só o representante do cliente assina. Ele recebe um link individual com este PDF, sem precisar de cadastro.</p>
          <input className="input" placeholder="Nome do representante do cliente *" value={nome} onChange={e => setNome(e.target.value)}/>
          <input className="input" placeholder="E-mail do representante *" value={email} onChange={e => setEmail(e.target.value)}/>
          <input className="input" placeholder="WhatsApp com DDD (opcional)" value={tel} onChange={e => setTel(e.target.value)}/>
          <div><Button variant="primary" onClick={criar} disabled={busy}>{busy ? "Criando…" : "Criar link de assinatura"}</Button></div>
        </div>
      )}
      {sig && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            {st && <Badge variant={st.variant}>{st.label}</Badge>}
            <span><b>{sig.nome}</b> · {sig.email}{sig.telefone ? " · " + sig.telefone : ""}</span>
          </div>
          {sig.status === "assinado" && (
            <div className="small" style={{ background: "#f0fdf4", padding: 10, borderRadius: 6 }}>
              Assinado em {peFmtData(au.signedAt || sig.signed_at)} · {au.signDevice || "—"} · IP {au.signIp || "—"}<br/>
              <span className="muted">Hash: {(au.hash || "").slice(0, 40)}…</span>
            </div>
          )}
          {sig.status === "recusado" && <div className="small" style={{ background: "#fef2f2", padding: 10, borderRadius: 6 }}>Recusado{au.refusedBy ? " por " + au.refusedBy : ""}. {au.refusedReason ? "Motivo: " + au.refusedReason : "Sem motivo informado."}</div>}
          {sig.status === "assinado" ? (
            <div><Button variant="primary" onClick={baixarAssinado} disabled={busy}>{busy ? "Gerando…" : "Baixar PDF assinado"}</Button></div>
          ) : (
            <>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <Button variant="primary" onClick={enviarEmail} disabled={busy}>{sig.status === "pendente" ? "Enviar por e-mail" : "Reenviar por e-mail"}</Button>
                <Button variant="outline" onClick={enviarWhats} disabled={busy}>WhatsApp</Button>
                <Button variant="outline" onClick={copiar}>Copiar link</Button>
              </div>
              <div className="small muted" style={{ wordBreak: "break-all" }}>{url}</div>
              {sig.status === "recusado" && <div><Button variant="outline" onClick={novoLink}>Criar novo link</Button></div>}
            </>
          )}
        </div>
      )}
      {erro && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{erro}</div>}
    </Modal>
  );
}

function ProjetoElevadorDesenhos({ abas }) {
  const store = window.ProjetoElevadorStore;
  const [itens, setItens] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busca, setBusca] = React.useState("");
  const [modal, setModal] = React.useState(false);
  const [excluir, setExcluir] = React.useState(null);
  const [assinaturas, setAssinaturas] = React.useState({});
  const [modalAssin, setModalAssin] = React.useState(null);

  const carregarAssinaturas = React.useCallback(async () => {
    const S = window.DocumentoSignatariosStore; if (!S) return;
    const linhas = await S.listarPorTipo("projeto_instalacao");
    const m = {}; linhas.forEach(l => { if (!m[l.documento_id]) m[l.documento_id] = l; }); // vem da mais recente p/ a mais antiga
    setAssinaturas(m);
  }, []);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    carregarAssinaturas();
    try { setItens(await store.listarDesenhos()); }
    catch (e) { window.toast?.("Não foi possível carregar os desenhos: " + e.message, "error"); setItens([]); }
    setLoading(false);
  }, [carregarAssinaturas]);
  React.useEffect(() => { carregar(); }, [carregar]);

  /* Pendência por obra: cada obra precisa dos dois documentos (Projeto de Instalação + ID-TAG). */
  const faltas = React.useMemo(() => {
    const porObra = {};
    itens.forEach(i => {
      const k = i.formulario_id || (i.numero_cotacao != null ? "c" + i.numero_cotacao : "r" + peNorm(i.referencia));
      (porObra[k] = porObra[k] || new Set()).add(i.tipo_documento || "projeto_instalacao");
    });
    const f = {};
    itens.forEach(i => {
      const k = i.formulario_id || (i.numero_cotacao != null ? "c" + i.numero_cotacao : "r" + peNorm(i.referencia));
      const tem = porObra[k];
      f[i.id] = PE_DOC_TIPOS.filter(t => !tem.has(t.key)).map(t => t.label);
    });
    return f;
  }, [itens]);

  const filtrados = React.useMemo(() => {
    const q = peNorm(busca);
    if (!q) return itens;
    return itens.filter(i => peNorm(`${i.referencia} ${i.cliente_nome} ${i.cliente_documento || ""} ${i.numero_cotacao} ${(i.equipamentos || []).join(" ")} ${peTipoLabel(i.tipo_documento)} ${i.arquivo_nome} ${i.enviado_por_nome}`).includes(q));
  }, [itens, busca]);

  const copiarLink = async (i) => {
    try { await navigator.clipboard.writeText(i.arquivo_url); window.toast?.("Link copiado. Cole no WhatsApp ou e-mail para o cliente.", "success"); }
    catch { window.prompt("Copie o link do desenho:", i.arquivo_url); }
  };

  const confirmarExcluir = async () => {
    try {
      await store.excluirDesenho(excluir.id);
      window.toast?.("Desenho excluído.", "success");
      setExcluir(null); carregar();
    } catch (e) { window.toast?.(e.message, "error"); }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Projeto de Elevadores</div>
          <h1 className="page-head__title">Projeto de Elevadores</h1>
          <p className="page-head__sub">Repositório dos projetos e desenhos dos elevadores, para enviar aos clientes.</p>
        </div>
        <div className="page-head__r row gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}</Button>
          <Button variant="primary" icon="plus" onClick={() => setModal(true)}>Salvar documentos da obra</Button>
        </div>
      </div>

      {abas}

      <Card style={{ marginBottom: 14 }}>
        <input className="input" style={{ width: "100%" }} placeholder="Buscar por prédio, cliente, CNPJ/CPF, cotação, equipamento ou arquivo…"
          value={busca} onChange={e => setBusca(e.target.value)}/>
      </Card>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Prédio / Cliente</th><th>Nº Cotação</th><th>Equipamento(s)</th><th>Documento</th><th>Arquivo</th><th>Tamanho</th><th>Salvo por</th><th>Data</th><th style={{ width: 230 }}></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={99}><div style={{ padding: 24 }}>Carregando…</div></td></tr>}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>{itens.length === 0 ? "Nenhum desenho salvo ainda" : "Nenhum resultado para a busca"}</h4>
                {itens.length === 0 && <p>Clique em "Salvar documentos da obra" para guardar o Projeto de Instalação e o ID-TAG.</p>}</div></td></tr>
            )}
            {!loading && filtrados.map(i => (
              <tr key={i.id}>
                <td><div className="cell-main">{i.referencia}</div><div className="cell-sub">{i.cliente_nome || "—"}{i.cliente_documento ? " · " + peMascaraDoc(i.cliente_documento) : ""}{i.observacao ? " · " + i.observacao : ""}</div></td>
                <td><span className="mono small">{i.numero_cotacao ?? "—"}</span></td>
                <td><span className="mono small">{(i.equipamentos || []).join(", ") || "—"}</span></td>
                <td><Badge variant={i.tipo_documento === "id_tag" ? "info" : "success"}>{peTipoLabel(i.tipo_documento)}</Badge>
                  {(faltas[i.id] || []).length > 0 && <div className="small" style={{ color: "#92400e", marginTop: 4 }}>Falta {(faltas[i.id] || []).join(" e ")}</div>}
                  {assinaturas[i.id] && PE_ASSIN_STATUS[assinaturas[i.id].status] && <div style={{ marginTop: 4 }}><Badge variant={PE_ASSIN_STATUS[assinaturas[i.id].status].variant}>{PE_ASSIN_STATUS[assinaturas[i.id].status].label}</Badge></div>}</td>
                <td>{i.arquivo_nome}</td>
                <td>{peFmtTam(i.tamanho_bytes)}</td>
                <td>{i.enviado_por_nome || i.enviado_por_email || "—"}</td>
                <td>{peFmtData(i.criado_em)}</td>
                <td>
                  <div className="row gap-2">
                    <a className="btn btn--outline" href={i.arquivo_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                    <button className="btn btn--outline" onClick={() => copiarLink(i)}>Copiar link</button>
                    {(i.tipo_documento || "projeto_instalacao") === "projeto_instalacao" && /\.pdf$/i.test(i.arquivo_nome || "") && (
                      <button className="btn btn--outline" title="Enviar para o cliente assinar / ver status" onClick={() => setModalAssin(i)}>Assinatura</button>
                    )}
                    <button className="btn btn--outline" title="Excluir" onClick={() => setExcluir(i)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AvalEngenhariaCard versao={Object.keys(assinaturas).map((k) => k + (assinaturas[k].status || '')).join('|') + itens.length}/>

      {modal && <DesenhoModal onClose={() => setModal(false)} onSaved={() => { setModal(false); carregar(); }}/>}
      {modalAssin && <ModalAssinaturaProjeto key={modalAssin.id + (assinaturas[modalAssin.id] ? assinaturas[modalAssin.id].id : "")} item={modalAssin} linha={assinaturas[modalAssin.id] || null} onClose={() => setModalAssin(null)} onChanged={carregarAssinaturas}/>}
      {excluir && (
        <Modal title="Excluir desenho?" onClose={() => setExcluir(null)} width={460}
          footer={<>
            <Button variant="ghost" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarExcluir}>Sim, excluir</Button>
          </>}>
          <p><b>{excluir.referencia}</b><br/>{excluir.arquivo_nome}</p>
          <p className="muted small">O registro sai da lista (o arquivo fica guardado para recuperação pelo suporte). Links já enviados a clientes continuam abrindo.</p>
        </Modal>
      )}
    </div>
  );
}

/* ---------- PÁGINA: Projeto de Elevadores (abas) ---------- */
function ProjetoElevadorPage({ setRoute }) {
  const [aba, setAba] = window.useRouteTab("eng-projeto-elevadores", "desenhos", ["desenhos", "especificacao"], false, true);
  const abas = <div style={{ marginBottom: 16 }}><Tabs tabs={[{ key: "desenhos", label: "Desenhos" }, { key: "especificacao", label: "Especificação técnica" }]} active={aba} onChange={setAba}/></div>;
  return aba === "especificacao" ? <ProjetoElevadorEspecificacao abas={abas}/> : <ProjetoElevadorDesenhos abas={abas}/>;
}

Object.assign(window, { ProjetoElevadorPage });
