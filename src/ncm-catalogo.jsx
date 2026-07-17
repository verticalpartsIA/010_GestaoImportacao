/* ============================================================
   ncm-catalogo.jsx
   - Catálogo de Produtos (DUIMP) — modelo fiel à Receita Federal:
     duas entidades (Produtos + Operadores Estrangeiros), com
     situação (rascunho/ativado/desativado), versão e código.
     Fonte: catalogo_produtos / operadores_estrangeiros (Supabase)
   - Solicitações NCM (kanban) — fluxo interno de classificação que
     antecede o cadastro no catálogo. Fonte: ncm_solicitacoes
   ============================================================ */

/* ---------- MODAL: Novo Produto NCM (fluxo de classificação) ---------- */
function ModalNovoProduto({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    produto: '', ncm_atual: '', ncm_sugerido: '',
    solicitante: '', responsavel: '',
    descricao: '', observacoes: '',
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.produto.trim()) return window.toast('Denominação é obrigatória.', 'warning');
    setSaving(true);
    const id = 'NCM-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('ncm_solicitacoes').insert({
      id,
      produto: f.produto,
      ncm_atual: f.ncm_atual || null,
      ncm_sugerido: f.ncm_sugerido || null,
      solicitante: f.solicitante || null,
      responsavel: f.responsavel || null,
      descricao: f.descricao || null,
      observacoes: f.observacoes || null,
      status: 'EM_PREENCHIMENTO',
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Produto criado com sucesso!', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type = 'text', ph = '', multiline = false) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {multiline
        ? <textarea className="input" rows={3} value={f[key]}
            onChange={e => set(key, e.target.value)} placeholder={ph}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}/>
        : <input className="input" type={type} value={f[key]}
            onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  return (
    <Modal title="Novo Produto NCM" onClose={onClose} width={560}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Criar Produto'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Denominação do produto *', 'produto', 'text', 'Ex.: Escova de segurança nylon 27mm, Botoeira de cabina LED…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('NCM atual', 'ncm_atual', 'text', 'Ex.: 8431.31.00')}
          {fld('NCM sugerido', 'ncm_sugerido', 'text', 'Ex.: 8431.39.90')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Solicitante', 'solicitante', 'text', 'Nome de quem solicita')}
          {fld('Responsável técnico', 'responsavel', 'text', 'Engenheiro responsável')}
        </div>
        {fld('Descrição técnica', 'descricao', 'text', 'Descreva o produto conforme Siscomex…', true)}
        {fld('Observações internas', 'observacoes', 'text', 'Notas para o time (não vai ao Siscomex)', true)}
      </div>
    </Modal>
  );
}

/* ============================================================
   CATÁLOGO DE PRODUTOS (DUIMP)
   ============================================================ */

const CAT_PAISES = [
  { c:"CN", n:"China" }, { c:"DE", n:"Alemanha" }, { c:"US", n:"Estados Unidos" },
  { c:"ES", n:"Espanha" }, { c:"IT", n:"Itália" }, { c:"JP", n:"Japão" },
  { c:"KR", n:"Coreia do Sul" }, { c:"FR", n:"França" }, { c:"BR", n:"Brasil" },
];
const paisNome = (c) => (CAT_PAISES.find(p => p.c === c) || {}).n || c || "—";

function SitBadge({ s }) {
  const map = { ativado:["success","Ativado"], rascunho:["warning","Rascunho"], desativado:["muted","Desativado"] };
  const [variant, label] = map[s] || ["muted", s || "—"];
  return <Badge variant={variant} dot>{label}</Badge>;
}

function nextCodigo(list) {
  const max = list.reduce((m, x) => Math.max(m, parseInt(x.codigo, 10) || 0), 0);
  return String(max + 1).padStart(10, "0");
}
function nextOpCodigo(list) {
  const max = list.reduce((m, x) => {
    const n = parseInt(String(x.codigo || "").replace(/\D/g, ""), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return "OPE_" + (max + 1);
}

/* ---------- MODAL: Novo Produto do Catálogo ---------- */
function ModalProdutoCatalogo({ operadores, proximoCodigo, onClose, onSaved }) {
  const [f, setF] = React.useState({
    cpf_cnpj_raiz:"54123456", modalidade:"IMPORTACAO", ncm:"", ncm_descricao:"",
    denominacao:"", detalhamento:"", unidade_medida:"UNIDADE", codigo_interno:"",
  });
  const [atributos, setAtributos] = React.useState([]);
  const [fabricantes, setFabricantes] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const toggleFab = (cod) => setFabricantes(p => p.includes(cod) ? p.filter(x => x !== cod) : [...p, cod]);
  const addAttr = () => setAtributos(p => [...p, { nome:"", valor:"" }]);
  const setAttr = (i, k, v) => setAtributos(p => p.map((a, idx) => idx === i ? { ...a, [k]: v } : a));
  const rmAttr = (i) => setAtributos(p => p.filter((_, idx) => idx !== i));

  const save = async (ativar) => {
    if (!f.ncm.trim()) return window.toast("NCM é obrigatória.", "warning");
    if (!f.denominacao.trim()) return window.toast("Denominação do produto é obrigatória.", "warning");
    setSaving(true);
    const id = "CP-" + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from("catalogo_produtos").insert({
      id, codigo: proximoCodigo, versao: 1,
      situacao: ativar ? "ativado" : "rascunho",
      cpf_cnpj_raiz: f.cpf_cnpj_raiz, modalidade: f.modalidade,
      ncm: f.ncm.replace(/\D/g, ""), ncm_descricao: f.ncm_descricao || null,
      denominacao: f.denominacao, detalhamento: f.detalhamento || null,
      unidade_medida: f.unidade_medida || null, codigo_interno: f.codigo_interno || null,
      atributos: atributos.filter(a => a.nome.trim()), fabricantes,
    });
    setSaving(false);
    if (error) return window.toast("Erro: " + error.message, "error");
    window.toast(ativar ? "Produto ativado no catálogo!" : "Rascunho salvo.", "success");
    onSaved?.(); onClose();
  };

  const lbl = (t, req) => <label className="up-eyebrow muted">{t}{req ? " *" : ""}</label>;

  return (
    <Modal title="Novo Produto · Catálogo DUIMP" onClose={onClose} width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>Salvar rascunho</Button>
        <Button variant="primary" onClick={() => save(true)} disabled={saving}>{saving ? "Salvando…" : "Salvar e ativar"}</Button>
      </>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="up-eyebrow muted" style={{ fontSize:9, letterSpacing:".08em" }}>Dados não retificáveis</div>
        <div className="grid-3" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>{lbl("CNPJ raiz", true)}
            <input className="input" value={f.cpf_cnpj_raiz} onChange={e => set("cpf_cnpj_raiz", e.target.value)} placeholder="54123456"/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("Modalidade", true)}
            <select className="input" value={f.modalidade} onChange={e => set("modalidade", e.target.value)}>
              <option value="IMPORTACAO">Importação</option><option value="EXPORTACAO">Exportação</option></select></div>
          <div className="stack" style={{ gap:4 }}>{lbl("NCM", true)}
            <input className="input" value={f.ncm} onChange={e => set("ncm", e.target.value)} placeholder="8431.31.00"/></div>
        </div>
        <div className="stack" style={{ gap:4 }}>{lbl("Descrição da NCM")}
          <input className="input" value={f.ncm_descricao} onChange={e => set("ncm_descricao", e.target.value)} placeholder="Partes de elevadores, monta-cargas ou escadas rolantes"/></div>

        <div className="up-eyebrow muted" style={{ fontSize:9, letterSpacing:".08em", marginTop:4 }}>Descrição do produto</div>
        <div className="stack" style={{ gap:4 }}>{lbl("Denominação do produto", true)}
          <input className="input" maxLength={100} value={f.denominacao} onChange={e => set("denominacao", e.target.value)} placeholder="Identificação primária — em português, sem abreviações"/>
          <span className="muted small mono">{f.denominacao.length}/100</span></div>
        <div className="stack" style={{ gap:4 }}>{lbl("Detalhamento complementar")}
          <textarea className="input" rows={4} maxLength={3700} value={f.detalhamento} onChange={e => set("detalhamento", e.target.value)} style={{ resize:"vertical", fontFamily:"inherit" }} placeholder="Informações adicionais necessárias à classificação fiscal (material, dimensões, norma técnica, aplicação…)"/>
          <span className="muted small mono">{f.detalhamento.length}/3700</span></div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>{lbl("Unidade de medida estatística")}
            <input className="input" value={f.unidade_medida} onChange={e => set("unidade_medida", e.target.value)} placeholder="UNIDADE"/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("Código interno do produto")}
            <input className="input" value={f.codigo_interno} onChange={e => set("codigo_interno", e.target.value)} placeholder="VPER-PRT-FER-800-CC"/></div>
        </div>

        <div className="up-eyebrow muted" style={{ fontSize:9, letterSpacing:".08em", marginTop:4 }}>Atributos da NCM</div>
        {atributos.map((a, i) => (
          <div key={i} className="row gap-2">
            <input className="input" style={{ flex:1 }} value={a.nome} onChange={e => setAttr(i, "nome", e.target.value)} placeholder="Atributo (ex.: Material predominante)"/>
            <input className="input" style={{ flex:1 }} value={a.valor} onChange={e => setAttr(i, "valor", e.target.value)} placeholder="Valor (ex.: Aço inoxidável)"/>
            <Button variant="ghost" size="sm" icon="trash" onClick={() => rmAttr(i)}/>
          </div>
        ))}
        <Button variant="outline" size="sm" icon="plus" onClick={addAttr}>Adicionar atributo</Button>

        {operadores.length > 0 ? (
          <>
            <div className="up-eyebrow muted" style={{ fontSize:9, letterSpacing:".08em", marginTop:4 }}>Fabricantes / produtores vinculados</div>
            <div className="stack" style={{ gap:6 }}>
              {operadores.filter(o => o.situacao === "ativado").map(o => (
                <label key={o.codigo} className="row gap-2" style={{ cursor:"pointer", fontSize:12 }}>
                  <input type="checkbox" checked={fabricantes.includes(o.codigo)} onChange={() => toggleFab(o.codigo)}/>
                  <span>{o.nome} <span className="muted mono">({paisNome(o.pais)} · {o.codigo})</span></span>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---------- MODAL: Novo Operador Estrangeiro ---------- */
function ModalOperadorEstrangeiro({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    cpf_cnpj_raiz:"54123456", pais:"CN", nome:"", logradouro:"", cidade:"",
    tin:"", email:"", codigo_interno:"", codigo_postal:"", subdivisao:"",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nome.trim()) return window.toast("Nome do operador é obrigatório.", "warning");
    if (!f.logradouro.trim()) return window.toast("Logradouro é obrigatório.", "warning");
    if (!f.cidade.trim()) return window.toast("Cidade é obrigatória.", "warning");
    setSaving(true);
    const id = "OE-" + Date.now().toString().slice(-6);
    const { data: existentes } = await window.__VP_SB.sb.from("operadores_estrangeiros").select("codigo");
    const { error } = await window.__VP_SB.sb.from("operadores_estrangeiros").insert({
      id, codigo: nextOpCodigo(existentes || []), versao: 1, situacao: "ativado",
      cpf_cnpj_raiz: f.cpf_cnpj_raiz, pais: f.pais, nome: f.nome,
      logradouro: f.logradouro, cidade: f.cidade,
      tin: f.tin || null, email: f.email || null, codigo_interno: f.codigo_interno || null,
      codigo_postal: f.codigo_postal || null, subdivisao: f.subdivisao || null,
    });
    setSaving(false);
    if (error) return window.toast("Erro: " + error.message, "error");
    window.toast("Operador estrangeiro cadastrado!", "success");
    onSaved?.(); onClose();
  };

  const lbl = (t, req) => <label className="up-eyebrow muted">{t}{req ? " *" : ""}</label>;

  return (
    <Modal title="Novo Operador Estrangeiro" onClose={onClose} width={580}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Cadastrar"}</Button>
      </>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>{lbl("CNPJ raiz", true)}
            <input className="input" value={f.cpf_cnpj_raiz} onChange={e => set("cpf_cnpj_raiz", e.target.value)} placeholder="54123456"/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("País do operador", true)}
            <select className="input" value={f.pais} onChange={e => set("pais", e.target.value)}>
              {CAT_PAISES.map(p => <option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select></div>
        </div>
        <div className="stack" style={{ gap:4 }}>{lbl("Nome do operador estrangeiro", true)}
          <input className="input" value={f.nome} onChange={e => set("nome", e.target.value)} placeholder="Razão social do fabricante/exportador"/></div>
        <div className="stack" style={{ gap:4 }}>{lbl("Logradouro", true)}
          <input className="input" value={f.logradouro} onChange={e => set("logradouro", e.target.value)} placeholder="Endereço completo"/></div>
        <div className="grid-3" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>{lbl("Cidade", true)}
            <input className="input" value={f.cidade} onChange={e => set("cidade", e.target.value)}/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("Subdivisão (estado)")}
            <input className="input" value={f.subdivisao} onChange={e => set("subdivisao", e.target.value)} placeholder="CN-SH"/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("Código postal")}
            <input className="input" value={f.codigo_postal} onChange={e => set("codigo_postal", e.target.value)}/></div>
        </div>
        <div className="grid-3" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>{lbl("TIN (identificação OMA)")}
            <input className="input" value={f.tin} onChange={e => set("tin", e.target.value)}/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("E-mail")}
            <input className="input" value={f.email} onChange={e => set("email", e.target.value)}/></div>
          <div className="stack" style={{ gap:4 }}>{lbl("Código interno")}
            <input className="input" value={f.codigo_interno} onChange={e => set("codigo_interno", e.target.value)}/></div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Painel de detalhe: Produto ---------- */
function ProdutoDetail({ p, operadores, onAct, ficha, onEdit, onWorkflowChanged }) {
  const fabs = (p.fabricantes || []).map(c => operadores.find(o => o.codigo === c)).filter(Boolean);
  return (
    <div className="prod-detail">
      <div className="prod-detail__head">
        <div className="row sb">
          <span className="prod-detail__id mono">cód. {p.codigo} · v{p.versao}{p.arquivado ? <span className="fw-arq-badge">Arquivado</span> : null}</span>
          <SitBadge s={p.situacao}/>
        </div>
        <div className="prod-detail__title">{p.denominacao || "(Sem denominação)"}</div>
        {window.FwIconBar && <window.FwIconBar
          produto={p} ficha={ficha}
          onEdit={onEdit}
          onDelete={() => onAct(p, null, true)}
          onChanged={onWorkflowChanged}/>}
      </div>
      <div className="prod-detail__body">
        {window.FwWorkflowCard && ficha !== undefined &&
          <window.FwWorkflowCard ficha={ficha} onChanged={onWorkflowChanged}/>}
        <div className="stack">
          <KvBlock label="NCM" value={p.ncm || "—"} mono/>
          <KvBlock label="Descrição da NCM" value={p.ncm_descricao || "—"}/>
          <KvBlock label="Modalidade" value={p.modalidade === "EXPORTACAO" ? "Exportação" : "Importação"}/>
          <KvBlock label="CNPJ raiz" value={p.cpf_cnpj_raiz || "—"} mono/>
          <KvBlock label="Unidade estatística" value={p.unidade_medida || "—"}/>
          <KvBlock label="Código interno" value={p.codigo_interno || "—"} mono/>
          {p.detalhamento ? (<>
            <div className="hr"/>
            <div className="up-eyebrow muted" style={{ marginBottom:6 }}>Detalhamento complementar</div>
            <p className="small" style={{ color:"var(--fg2)", lineHeight:1.6 }}>{p.detalhamento}</p>
          </>) : null}
          {(p.atributos || []).length ? (<>
            <div className="hr"/>
            <div className="up-eyebrow muted" style={{ marginBottom:6 }}>Atributos da NCM</div>
            {(p.atributos || []).map((a, i) => <KvBlock key={i} label={a.nome} value={a.valor || "—"}/>)}
          </>) : null}
          <div className="hr"/>
          <div className="up-eyebrow muted" style={{ marginBottom:6 }}>Fabricantes / produtores</div>
          {fabs.length ? fabs.map(o => (
            <div key={o.codigo} className="small" style={{ color:"var(--fg2)" }}>{o.nome} <span className="muted mono">({paisNome(o.pais)})</span></div>
          )) : <span className="muted small">Nenhum vinculado</span>}

          <div className="hr"/>
          <div className="row gap-2" style={{ flexWrap:"wrap" }}>
            {p.situacao === "rascunho" && <>
              <Button variant="primary" size="sm" icon="check" onClick={() => onAct(p, { situacao:"ativado" })}>Ativar</Button>
            </>}
            {p.situacao === "ativado" && <>
              <Button variant="outline" size="sm" icon="edit" onClick={() => onAct(p, { versao:(p.versao||1)+1 })}>Gerar nova versão</Button>
              <Button variant="ghost" size="sm" icon="x" onClick={() => onAct(p, { situacao:"desativado" })}>Desativar</Button>
            </>}
            {p.situacao === "desativado" &&
              <Button variant="primary" size="sm" icon="check" onClick={() => onAct(p, { situacao:"ativado", versao:(p.versao||1)+1 })}>Reativar (nova versão)</Button>}
            {/* Excluir migrou para a lixeira na barra de ícones do cabeçalho */}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Painel de detalhe: Operador Estrangeiro ---------- */
function OperadorDetail({ o, onAct }) {
  return (
    <div className="prod-detail">
      <div className="prod-detail__head">
        <div className="row sb">
          <span className="prod-detail__id mono">cód. {o.codigo} · v{o.versao}</span>
          <SitBadge s={o.situacao}/>
        </div>
        <div className="prod-detail__title">{o.nome}</div>
      </div>
      <div className="prod-detail__body">
        <div className="stack">
          <KvBlock label="País" value={`${paisNome(o.pais)} (${o.pais})`}/>
          <KvBlock label="Cidade" value={o.cidade || "—"}/>
          <KvBlock label="Logradouro" value={o.logradouro || "—"}/>
          <KvBlock label="Subdivisão" value={o.subdivisao || "—"}/>
          <KvBlock label="Código postal" value={o.codigo_postal || "—"} mono/>
          <KvBlock label="TIN" value={o.tin || "—"} mono/>
          <KvBlock label="E-mail" value={o.email || "—"}/>
          <KvBlock label="CNPJ raiz" value={o.cpf_cnpj_raiz || "—"} mono/>
          <KvBlock label="Código interno" value={o.codigo_interno || "—"} mono/>
          <div className="hr"/>
          <div className="row gap-2" style={{ flexWrap:"wrap" }}>
            {o.situacao === "ativado" && <>
              <Button variant="outline" size="sm" icon="edit" onClick={() => onAct(o, { versao:(o.versao||1)+1 })}>Gerar nova versão</Button>
              <Button variant="ghost" size="sm" icon="x" onClick={() => onAct(o, { situacao:"desativado" })}>Desativar</Button>
            </>}
            {o.situacao === "desativado" &&
              <Button variant="primary" size="sm" icon="check" onClick={() => onAct(o, { situacao:"ativado", versao:(o.versao||1)+1 })}>Reativar (nova versão)</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Página: Catálogo de Produtos (Produtos + Operadores) ---------- */
function NcmCatalogoPage({ setRoute }) {
  const [tab, setTab] = React.useState("produtos");
  const [produtos, setProdutos] = React.useState([]);
  const [operadores, setOperadores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todos");
  const [search, setSearch] = React.useState("");
  const [selProd, setSelProd] = React.useState(null);
  const [selOp, setSelOp] = React.useState(null);
  const [showProd, setShowProd] = React.useState(false);
  const [showOp, setShowOp] = React.useState(false);
  const [sel, setSel] = React.useState(() => new Set());
  const [showBuilder, setShowBuilder] = React.useState(false);
  const [previewPedido, setPreviewPedido] = React.useState(null);
  const [fichaSel, setFichaSel] = React.useState(null);      // ficha vinculada ao produto selecionado
  const [mostrarArq, setMostrarArq] = React.useState(false); // exibir arquivados?
  const [delTarget, setDelTarget] = React.useState(null);     // produto pendente de confirmação de exclusão
  const [fichasVincDelTarget, setFichasVincDelTarget] = React.useState([]);

  const reload = React.useCallback(() => {
    setLoading(true);
    return Promise.all([
      window.__VP_SB.sb.from("catalogo_produtos").select("*").order("codigo"),
      window.__VP_SB.sb.from("operadores_estrangeiros").select("*").order("codigo"),
    ]).then(([pr, op]) => {
      setProdutos(pr.data || []);
      setOperadores(op.data || []);
      setLoading(false);
    });
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  /* Ficha técnica vinculada ao produto selecionado (workflow do funil) */
  React.useEffect(() => {
    let alive = true;
    if (!selProd || !window.FWFStore) { setFichaSel(null); return; }
    window.FWFStore.getFichaByProduto(selProd).then((f) => { if (alive) setFichaSel(f); });
    return () => { alive = false; };
  }, [selProd, produtos]);

  /* Lápis: abre a ficha técnica vinculada direto no editor */
  const editarFicha = () => {
    if (!fichaSel) return window.toast("Produto sem ficha técnica vinculada.", "warning");
    try { sessionStorage.setItem("vpprd_ft_open", fichaSel.id); } catch (e) {}
    setRoute && setRoute("ficha-tecnica");
  };

  const workflowChanged = (f) => { if (f && f.id) setFichaSel(f); reload(); };

  const actProd = async (row, patch, del) => {
    if (del) {
      // Procura se há ficha técnica vinculada a esse produto, pra mostrar no modal de confirmação
      const { data: fichas } = await window.__VP_SB.sb
        .from("fichas_tecnicas")
        .select("id, numero_documento, nome_produto")
        .eq("produto_id", row.id);
      setFichasVincDelTarget(fichas || []);
      setDelTarget(row);
      return;
    }
    const { error } = await window.__VP_SB.sb.from("catalogo_produtos").update(patch).eq("id", row.id);
    if (error) return window.toast("Erro: " + error.message, "error");
    if (window.VPLog) {
      const acao = patch.situacao === "ativado" ? (patch.versao ? "reativou o produto" : "ativou o produto")
        : patch.situacao === "desativado" ? "desativou o produto"
        : patch.versao ? "gerou nova versão" : "atualizou o produto";
      window.VPLog.registrar({ modulo: "Catálogo", acao, alvo: row.denominacao || row.codigo, alvo_id: row.id, detalhe: patch });
    }
    window.toast("Produto atualizado.", "success");
    reload();
  };

  const confirmarExclusaoProd = async (motivo) => {
    const row = delTarget;
    const fichasVinc = fichasVincDelTarget;
    if (fichasVinc.length) {
      const { error: ferr } = await window.__VP_SB.sb
        .from("fichas_tecnicas").delete().eq("produto_id", row.id);
      if (ferr) return window.toast("Erro ao remover ficha: " + ferr.message, "error");
    }
    const { error } = await window.__VP_SB.sb.from("catalogo_produtos").delete().eq("id", row.id);
    if (error) return window.toast("Erro: " + error.message, "error");
    if (window.VPLog) window.VPLog.registrar({
      modulo: "Catálogo", acao: "excluiu o produto",
      alvo: row.denominacao || row.codigo, alvo_id: row.id,
      detalhe: { fichas_removidas: fichasVinc.length, motivo },
    });
    window.toast(
      fichasVinc.length
        ? `Produto e ${fichasVinc.length === 1 ? 'ficha técnica vinculada removidos' : `${fichasVinc.length} fichas técnicas vinculadas removidas`}.`
        : "Produto excluído.",
      "success"
    );
    setSelProd(null);
    setDelTarget(null);
    setFichasVincDelTarget([]);
    reload();
  };

  const actOp = async (row, patch) => {
    const { error } = await window.__VP_SB.sb.from("operadores_estrangeiros").update(patch).eq("id", row.id);
    if (error) return window.toast("Erro: " + error.message, "error");
    window.toast("Operador atualizado.", "success");
    reload();
  };

  if (loading) return <div style={{ textAlign:"center", padding:"60px 0", color:"var(--fg3)", fontSize:13 }}>Carregando…</div>;

  const sitFilters = ["Todos", "ativado", "rascunho", "desativado"];
  const matchSearch = (txt) => !search || txt.toLowerCase().includes(search.toLowerCase());

  const nArquivados = produtos.filter(p => p.arquivado).length;
  const prodRows = produtos.filter(p =>
    (mostrarArq || !p.arquivado) &&
    (filter === "Todos" || p.situacao === filter) &&
    matchSearch((p.denominacao || "") + (p.ncm || "") + (p.codigo || "") + (p.codigo_interno || "")));
  const opRows = operadores.filter(o =>
    (filter === "Todos" || o.situacao === filter) &&
    matchSearch((o.nome || "") + (o.pais || "") + (o.codigo || "") + (o.cidade || "")));

  const selectedProd = produtos.find(p => p.id === selProd);
  const selectedOp = operadores.find(o => o.id === selOp);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Catálogo de Produtos</div>
          <h1 className="page-head__title">Catálogo de Produtos</h1>
          <p className="page-head__sub">Catálogo do Portal Único Siscomex — produtos e operadores estrangeiros usados na DUIMP. Cadastro obrigatório antes do registro da declaração.</p>
        </div>
        <div className="page-head__r">
          {tab === "produtos"
            ? <span style={{ fontSize: 11, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>📋 Produtos vêm da Ficha Técnica</span>
            : <Button variant="primary" icon="plus" onClick={() => setShowOp(true)}>Novo operador</Button>}
        </div>
      </div>

      <Tabs tabs={[
        { key:"produtos", label:"Produtos", icon:"package", count:produtos.length },
        { key:"operadores", label:"Operadores estrangeiros", icon:"globe", count:operadores.length },
        { key:"pedidos", label:"Pedidos a fornecedor", icon:"fileText" },
      ]} active={tab} onChange={(t) => { setTab(t); setFilter("Todos"); }}/>

      {tab === "produtos" ? (
        <div className="grid-4" style={{ margin:"20px 0" }}>
          <KPI label="Produtos ativos" value={produtos.filter(p => p.situacao === "ativado").length} sub="disponíveis p/ DUIMP" icon="check"/>
          <KPI label="Rascunhos" value={produtos.filter(p => p.situacao === "rascunho").length} sub="não usáveis ainda" icon="edit"/>
          <KPI label="Desativados" value={produtos.filter(p => p.situacao === "desativado").length} sub="fora de uso" icon="x"/>
          <KPI label="NCMs distintas" value={new Set(produtos.map(p => p.ncm).filter(Boolean)).size} sub="códigos em uso" icon="globe"/>
        </div>
      ) : tab === "operadores" ? (
        <div className="grid-4" style={{ margin:"20px 0" }}>
          <KPI label="Operadores ativos" value={operadores.filter(o => o.situacao === "ativado").length} sub="fabricantes/exportadores" icon="check"/>
          <KPI label="Países" value={new Set(operadores.map(o => o.pais).filter(Boolean)).size} sub="origens" icon="globe"/>
          <KPI label="Desativados" value={operadores.filter(o => o.situacao === "desativado").length} sub="fora de uso" icon="x"/>
          <KPI label="Total" value={operadores.length} sub="cadastrados" icon="package"/>
        </div>
      ) : null}

      {tab !== "pedidos" && <div className="tbar">
        <div className="seg">
          {sitFilters.map(s => (
            <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>
              {s === "Todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1) + "s"}
            </button>
          ))}
        </div>
        <div className="spacer"/>
        {tab === "produtos" && nArquivados > 0 && (
          <label className="small muted" style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", marginRight:10 }}>
            <input type="checkbox" className="pf-chk" checked={mostrarArq} onChange={(e) => setMostrarArq(e.target.checked)}/>
            Mostrar arquivados ({nArquivados})
          </label>
        )}
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder={tab === "produtos" ? "Buscar produto, NCM, código…" : "Buscar operador, país…"} value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
      </div>}

      {tab === "produtos" && sel.size > 0 && (
        <div className="pf-selbar">
          <b>{sel.size}</b>&nbsp;{sel.size === 1 ? "produto selecionado" : "produtos selecionados"}
          <div className="spacer"/>
          <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>Limpar</Button>
          <Button variant="primary" size="sm" icon="fileText" onClick={() => setShowBuilder(true)}>Gerar pedido a fornecedor</Button>
        </div>
      )}

      {tab === "pedidos" ? (
        <window.PedidosList onReopen={(r) => setPreviewPedido(r)}/>
      ) : (
      <div className="cat-split">
        <div className="table-wrap">
          {tab === "produtos" ? (
            <table className="t">
              <thead><tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" className="pf-chk"
                    checked={prodRows.length > 0 && prodRows.every(p => sel.has(p.id))}
                    onChange={(e) => { const n = new Set(sel); if (e.target.checked) prodRows.forEach(p => n.add(p.id)); else prodRows.forEach(p => n.delete(p.id)); setSel(n); }}/>
                </th>
                <th>Produto</th><th>NCM</th><th>Código</th><th>Cód. interno</th><th>Versão</th><th>Situação</th>
              </tr></thead>
              <tbody>
                {prodRows.length === 0 && (
                  <tr><td colSpan={99}><div className="empty"><h4>Nenhum produto encontrado</h4><p>Cadastre um produto para usá-lo na DUIMP.</p></div></td></tr>
                )}
                {prodRows.map(p => (
                  <tr key={p.id} onClick={() => setSelProd(p.id)}
                    className={p.arquivado ? "fw-row-arquivado" : undefined}
                    style={p.id === selProd ? { background:"#FFFBE6", boxShadow:"inset 3px 0 0 0 var(--vp-yellow)" } : null}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="pf-chk" checked={sel.has(p.id)}
                        onChange={() => { const n = new Set(sel); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSel(n); }}/>
                    </td>
                    <td><div className="cell-main" style={{ fontSize:12.5, lineHeight:1.3 }}>{p.denominacao || <span className="muted">(sem denominação)</span>}</div></td>
                    <td>{p.ncm ? <span className="sku">{p.ncm}</span> : <span className="muted">—</span>}</td>
                    <td><span className="cell-sub mono">{p.codigo}</span></td>
                    <td>{p.codigo_interno ? <span className="mono small">{p.codigo_interno}</span> : <span className="muted">—</span>}</td>
                    <td><span className="cell-sub mono">v{p.versao}</span></td>
                    <td><SitBadge s={p.situacao}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="t">
              <thead><tr>
                <th>Operador estrangeiro</th><th>País</th><th>Cidade</th><th>Código</th><th>TIN</th><th>Situação</th>
              </tr></thead>
              <tbody>
                {opRows.length === 0 && (
                  <tr><td colSpan={99}><div className="empty"><h4>Nenhum operador encontrado</h4><p>Cadastre o fabricante/exportador estrangeiro.</p></div></td></tr>
                )}
                {opRows.map(o => (
                  <tr key={o.id} onClick={() => setSelOp(o.id)}
                    style={o.id === selOp ? { background:"#FFFBE6", boxShadow:"inset 3px 0 0 0 var(--vp-yellow)" } : null}>
                    <td><div className="cell-main" style={{ fontSize:12.5, lineHeight:1.3 }}>{o.nome}</div></td>
                    <td>{paisNome(o.pais)}</td>
                    <td>{o.cidade || <span className="muted">—</span>}</td>
                    <td><span className="cell-sub mono">{o.codigo}</span></td>
                    <td>{o.tin ? <span className="mono small">{o.tin}</span> : <span className="muted">—</span>}</td>
                    <td><SitBadge s={o.situacao}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {tab === "produtos"
          ? (selectedProd
              ? <ProdutoDetail p={selectedProd} operadores={operadores} onAct={actProd}
                  ficha={fichaSel} onEdit={editarFicha} onWorkflowChanged={workflowChanged}/>
              : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", border:"1px dashed var(--border)", color:"var(--fg3)", fontSize:13, padding:"60px 20px", textAlign:"center" }}>Selecione um produto para ver os detalhes.</div>)
          : (selectedOp
              ? <OperadorDetail o={selectedOp} onAct={actOp}/>
              : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", border:"1px dashed var(--border)", color:"var(--fg3)", fontSize:13, padding:"60px 20px", textAlign:"center" }}>Selecione um operador para ver os detalhes.</div>)}
      </div>
      )}

      {showBuilder && <window.PedidoBuilderModal
        produtos={produtos.filter(p => sel.has(p.id))}
        operadores={operadores}
        onClose={() => setShowBuilder(false)}
        onCreated={(pedido) => { setShowBuilder(false); setSel(new Set()); setPreviewPedido(pedido); }}/>}
      {previewPedido && <window.PedidoPreviewOverlay
        pedido={previewPedido}
        onClose={() => setPreviewPedido(null)}
        onSaved={() => {}}/>}

      {showProd && <ModalProdutoCatalogo operadores={operadores} proximoCodigo={nextCodigo(produtos)} onClose={() => setShowProd(false)} onSaved={reload}/>}
      {showOp && <ModalOperadorEstrangeiro onClose={() => setShowOp(false)} onSaved={reload}/>}
      {delTarget && (
        <ModalConfirmarExclusao
          titulo="Excluir produto do catálogo"
          nome={delTarget.denominacao || delTarget.codigo}
          meta={[
            { label: 'Código', value: delTarget.codigo },
            { label: 'NCM', value: delTarget.ncm },
          ]}
          consequencias={fichasVincDelTarget.length ? fichasVincDelTarget.map(f => `ficha ${f.numero_documento} — ${f.nome_produto}`) : []}
          onConfirm={confirmarExclusaoProd}
          onClose={() => { setDelTarget(null); setFichasVincDelTarget([]); }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Kanban de Solicitações NCM
   ============================================================ */
function NcmKanbanPage({ setRoute, setSubsel }) {
  const [solicitacoes, setSolicitacoes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState("kanban");
  const [showNovo, setShowNovo] = React.useState(false);
  const [dragging, setDragging] = React.useState(null); // { id, fromStatus }
  const [dragOver, setDragOver] = React.useState(null); // coluna key

  const reloadNcm = () => {
    setLoading(true);
    window.__VP_SB.sb.from('ncm_solicitacoes').select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setSolicitacoes(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadNcm(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const columns = [
    { key: "EM_PREENCHIMENTO", label: "Em preenchimento", hint: "Engenharia descrevendo o produto" },
    { key: "AGUARD_JURIDICO",  label: "Aguard. jurídico",  hint: "Aguarda validação do código NCM" },
    { key: "APROVADO",         label: "Aprovado jurídico", hint: "Pronto para exportar" },
    { key: "APROVADO_PRONTO",  label: "Pronto LogComex",   hint: "Em cadastro pelo time de importação" },
    { key: "CADASTRADO",       label: "Cadastrado Siscomex", hint: "Produto ATIVO disponível para Duimp" },
  ];

  const byCol = {};
  columns.forEach(c => { byCol[c.key] = []; });
  solicitacoes.forEach(s => {
    const status = s.status || "EM_PREENCHIMENTO";
    if (byCol[status]) byCol[status].push(s);
    else byCol.EM_PREENCHIMENTO.push(s);
  });

  const handleDrop = async (targetStatus) => {
    if (!dragging || dragging.fromStatus === targetStatus) {
      setDragging(null); setDragOver(null); return;
    }
    const { id, fromStatus } = dragging;
    setDragging(null); setDragOver(null);
    // Optimistic update
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: targetStatus } : s));
    const { error } = await window.__VP_SB.sb
      .from('ncm_solicitacoes').update({ status: targetStatus }).eq('id', id);
    if (error) {
      window.toast('Erro ao mover card: ' + error.message, 'error');
      reloadNcm();
    } else {
      window.toast('Status → ' + targetStatus.replace(/_/g, ' ').toLowerCase(), 'success');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Solicitações NCM</div>
          <h1 className="page-head__title">Solicitações de Classificação NCM</h1>
          <p className="page-head__sub">Produtos pendentes de descrição técnica, validação jurídica e cadastro Siscomex.</p>
        </div>
        <div className="page-head__r">
          <div className="seg">
            <button className={view === "lista" ? "is-active" : ""} onClick={() => setView("lista")}>
              <Icon.list size={12} style={{ marginRight: 6 }}/>Lista
            </button>
            <button className={view === "kanban" ? "is-active" : ""} onClick={() => setView("kanban")}>
              <Icon.grid size={12} style={{ marginRight: 6 }}/>Kanban
            </button>
          </div>
          <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo produto</Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="kanban">
          {columns.map(c => (
            <div key={c.key}
              className={"kanban__col" + (dragOver === c.key && dragging?.fromStatus !== c.key ? " is-dragover" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(c.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(c.key); }}>
              <div className={"kanban__col-head" + (byCol[c.key].length > 0 ? " is-active" : "")}>
                <span className="kanban__col-title">{c.label}</span>
                <span className="kanban__col-count">{byCol[c.key].length}</span>
              </div>
              <div className="kanban__col-body">
                {byCol[c.key].map(s => (
                  <div key={s.id}
                    className={"kanban__card" + (dragging?.id === s.id ? " is-dragging" : "")}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragging({ id: s.id, fromStatus: c.key }); }}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onClick={() => { if (!dragging) { setSubsel?.({ ncmProduct: s }); setRoute("ncm-detail"); } }}>
                    <div className="kanban__card-eyebrow">#{s.id}</div>
                    <div className="kanban__card-title">{s.produto || <i className="muted">(sem denominação)</i>}</div>
                    {s.ncm_atual
                      ? <div className="kanban__card-ncm"><span className="sku">{s.ncm_atual}</span></div>
                      : <div className="kanban__card-ncm muted">NCM pendente</div>}
                    <div className="kanban__card-foot">
                      <span className="who">
                        {(s.solicitante || s.responsavel) ? (
                          <>
                            <div className="avatar sm">{(s.solicitante || s.responsavel).split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
                            {(s.solicitante || s.responsavel).split(" ")[0]}
                          </>
                        ) : <span className="muted" style={{ fontSize: 11 }}>—</span>}
                      </span>
                      <span className="mono">{s.created_at ? s.created_at.slice(0,10) : ""}</span>
                    </div>
                  </div>
                ))}
                {byCol[c.key].length === 0 ? (
                  <div style={{ padding: 18, textAlign: "center", color: "var(--fg3)", fontSize: 11, fontStyle: "italic" }}>
                    {dragOver === c.key && dragging ? "Soltar aqui →" : "vazio"}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>Produto</th>
              <th>NCM atual</th>
              <th>NCM sugerido</th>
              <th>Solicitante</th>
              <th>Status</th>
              <th>Cadastrado</th>
              <th></th>
            </tr></thead>
            <tbody>
              {solicitacoes.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                  Nenhuma solicitação NCM cadastrada.
                </td></tr>
              )}
              {solicitacoes.filter(s => s.status !== "CADASTRADO").map(s => (
                <tr key={s.id} style={{ cursor:'pointer' }}
                  onClick={() => { setSubsel?.({ ncmProduct: s }); setRoute("ncm-detail"); }}>
                  <td>
                    <div className="cell-main" style={{ fontSize: 12.5, lineHeight: 1.3 }}>{s.produto || <i className="muted">(sem denominação)</i>}</div>
                    <div className="cell-sub">#{s.id}</div>
                  </td>
                  <td>{s.ncm_atual    ? <span className="sku">{s.ncm_atual}</span>    : <span className="muted">—</span>}</td>
                  <td>{s.ncm_sugerido ? <span className="sku">{s.ncm_sugerido}</span> : <span className="muted">—</span>}</td>
                  <td>{s.solicitante || <span className="muted">—</span>}</td>
                  <td><span className="ncm-status" data-s={s.status}>{(s.status || "").replace(/_/g, " ").toLowerCase()}</span></td>
                  <td><span className="cell-sub">{s.created_at ? s.created_at.slice(0,10) : "—"}</span></td>
                  <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showNovo && <ModalNovoProduto onClose={() => setShowNovo(false)} onSaved={reloadNcm}/>}
    </div>
  );
}

/* ============================================================
   NCM Detail page (acesso vindo do kanban)
   ============================================================ */
function NcmDetailPage({ product, setRoute }) {
  const [showLogComex, setShowLogComex] = React.useState(false);
  if (!product) {
    return <EmptyStateRedirect icon="package" title="Nenhum produto selecionado"
      message="Escolha um produto na fila de solicitações NCM para ver os detalhes."
      ctaLabel="Ir para Solicitações NCM" onCta={() => setRoute("ncm-kanban")}/>;
  }
  const nome = product.produto || product.denominacao || "Novo Produto";
  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("ncm-kanban")}>Voltar para Solicitações NCM</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>#{product.id}</div>
          <h1 className="page-head__title">{nome.length > 60 ? nome.slice(0, 60) + "…" : nome}</h1>
          <p className="page-head__sub">Ficha técnica para cadastro no Catálogo da Receita Federal (Siscomex/Duimp).</p>
        </div>
      </div>

      <NCMTab productId={String(product.id)} onOpenLogComex={() => setShowLogComex(true)}/>

      {showLogComex ? <LogComexModal product={product} onClose={() => setShowLogComex(false)}/> : null}
    </div>
  );
}

/* ============================================================
   LogComex Export Modal
   ============================================================ */
function LogComexModal({ product, onClose }) {
  const checks = [
    "Confirmei que o código NCM está correto e validado pelo jurídico",
    "A Denominação está em português, sem abreviações",
    "O Detalhamento Complementar descreve suficientemente o produto",
    "Os atributos obrigatórios da NCM foram preenchidos",
    "O fabricante/produtor está identificado corretamente",
    "As imagens representam fielmente o produto a ser importado",
  ];
  const [checked, setChecked] = React.useState(new Set());
  const [copied, setCopied] = React.useState(false);
  const allChecked = checked.size === checks.length;

  const toggle = (i) => {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i); else next.add(i);
    setChecked(next);
  };

  const copy = () => {
    const formatted = [
      `NCM: ${product.ncm_atual || product.ncm || "—"}`,
      `Denominação: ${product.produto || product.denominacao || "—"}`,
      `Descrição: ${product.descricao || product.detalhamento || "—"}`,
      `Solicitante: ${product.solicitante || "—"}`,
    ].join("\n");
    try { navigator.clipboard.writeText(formatted); } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.toast("Dados copiados para a área de transferência", "success");
  };

  return (
    <Modal title="Exportar para LogComex" onClose={onClose} width={720}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant={allChecked ? "primary" : "outline"} size="sm"
          disabled={!allChecked}
          icon={copied ? "check" : "copy"}
          onClick={copy}>
          {copied ? "Copiado!" : "Copiar dados formatados"}
        </Button>
      </>}>

      <p className="vp-small" style={{ marginTop: 0, marginBottom: 14 }}>
        Catálogo de Produtos da plataforma LogComex. Confira o resumo abaixo, marque o checklist e clique em <b>Copiar dados formatados</b>.
      </p>

      <dl className="lc-resumo">
        <dt>NCM</dt>
        <dd>{product.ncm_atual || product.ncm || "—"}</dd>
        <dt>Denominação</dt>
        <dd>{product.produto || product.denominacao || "—"}</dd>
        <dt>Solicitante</dt>
        <dd>{product.solicitante || "—"}</dd>
      </dl>

      <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Checklist de pré-envio (todos obrigatórios)</div>
      <div className="lc-checklist">
        {checks.map((c, i) => (
          <div key={i} className={"lc-check " + (checked.has(i) ? "checked" : "")} onClick={() => toggle(i)}>
            <div className="lc-check__box"/>
            <div className="lc-check__txt">{c}</div>
          </div>
        ))}
      </div>

      <div className="lc-steps" style={{ marginTop: 16 }}>
        <div className="up-eyebrow" style={{ color: "var(--vp-yellow)", marginBottom: 6 }}>Instruções</div>
        <b>O VP Gestão não envia diretamente ao Siscomex.</b>
        <ol>
          <li>Clique em <strong>Copiar dados formatados</strong></li>
          <li>Acesse <strong>plataforma.logcomex</strong> → Catálogo de Produtos → Novo Produto</li>
          <li>Cole os dados nos campos correspondentes</li>
          <li>Ative o produto e copie o Código Siscomex gerado (<strong>PRD-xxxxx</strong>)</li>
          <li>Volte aqui e clique em <strong>"Marcar como cadastrado"</strong></li>
        </ol>
      </div>
    </Modal>
  );
}

/* ============================================================
   NCM Widget — Dashboard
   ============================================================ */
function NcmDashboardWidget({ setRoute, ncm = [] }) {
  const stuck = ncm.filter(p => p.status === "EM_PREENCHIMENTO").length;
  const inJur = ncm.filter(p => p.status === "AGUARD_JURIDICO").length;
  const ready = ncm.filter(p => p.status === "APROVADO").length;

  return (
    <div className="ncm-widget">
      <div className="ncm-widget__title"><Icon.package size={12}/> Pendências NCM</div>
      {ncm.length === 0 ? (
        <div className="muted" style={{ padding: '12px 0', fontSize: 12, textAlign: 'center' }}>Nenhuma solicitação NCM pendente.</div>
      ) : (
        <>
          {stuck > 0 && <div className="ncm-widget__row">
            <Icon.warning size={14} color="var(--vp-warning)"/>
            <span><b>{stuck}</b> fichas técnicas em preenchimento há +5 dias</span>
          </div>}
          {inJur > 0 && <div className="ncm-widget__row">
            <Icon.warning size={14} color="var(--vp-warning)"/>
            <span><b>{inJur}</b> produtos aguardando validação jurídica</span>
          </div>}
          {ready > 0 && <div className="ncm-widget__row">
            <Icon.check size={14} color="var(--vp-success)"/>
            <span><b>{ready}</b> produto{ready !== 1 ? "s" : ""} aprovado{ready !== 1 ? "s" : ""} aguardando cadastro LogComex</span>
          </div>}
        </>
      )}
      <div className="ncm-widget__cta">
        <Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute("ncm-kanban")}>Ver todas</Button>
      </div>
    </div>
  );
}

Object.assign(window, { NcmCatalogoPage, NcmKanbanPage, NcmDetailPage, LogComexModal, NcmDashboardWidget });
