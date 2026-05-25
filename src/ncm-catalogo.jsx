/* ============================================================
   ncm-catalogo.jsx — Catálogo de Produtos (Logística)
   Lista cadastrados + painel lateral com abas
   Fonte de dados: Supabase — tabela ncm_solicitacoes
   ============================================================ */

/* ---------- MODAL: Novo Produto NCM ---------- */
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

function NcmCatalogoPage({ setRoute }) {
  const [produtos, setProdutos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todos");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(null);
  const [detailTab, setDetailTab] = React.useState("dados");
  const [showNovo, setShowNovo] = React.useState(false);

  const reloadProdutos = () => {
    setLoading(true);
    window.__VP_SB.sb.from('ncm_solicitacoes').select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProdutos(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadProdutos(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const filters = ["Todos", "CADASTRADO", "APROVADO", "AGUARD_JURIDICO", "EM_PREENCHIMENTO", "DESATIVADO"];

  const rows = produtos.filter(p => {
    if (filter !== "Todos" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((p.produto || "") + (p.ncm_atual || "") + String(p.id) + (p.ncm_sugerido || "")).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = produtos.find(p => p.id === selectedId);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Catálogo de Produtos</div>
          <h1 className="page-head__title">Catálogo de Produtos</h1>
          <p className="page-head__sub">Produtos cadastrados no Catálogo da Receita Federal (Siscomex/Duimp). Necessário para emissão de Duimp.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(rows.map(p => ({ id:p.id, produto:p.produto, ncm_atual:p.ncm_atual, ncm_sugerido:p.ncm_sugerido, solicitante:p.solicitante, status:p.status, criado_em:p.created_at?.slice(0,10) })), 'catalogo-produtos.csv')}>Exportar</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo produto</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Produtos ativos"  value={produtos.filter(p => p.status === "CADASTRADO").length}    sub="cadastrados Siscomex" icon="package"/>
        <KPI label="Aguard. jurídico" value={produtos.filter(p => p.status === "AGUARD_JURIDICO").length} sub="em validação"        icon="scale"/>
        <KPI label="Em preenchimento" value={produtos.filter(p => p.status === "EM_PREENCHIMENTO").length} sub="rascunhos"           icon="edit"/>
        <KPI label="NCMs distintas"   value={new Set(produtos.filter(p => p.ncm_atual).map(p => p.ncm_atual)).size} sub="códigos em uso" icon="globe"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {filters.map(s => (
            <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>
              {s === "Todos" ? "Todos" :
               s === "CADASTRADO" ? "Ativos" :
               s === "APROVADO" ? "Aprovados" :
               s === "AGUARD_JURIDICO" ? "Aguard. jurídico" :
               s === "EM_PREENCHIMENTO" ? "Em preench." :
               "Desativados"}
            </button>
          ))}
        </div>
        <div className="divider-v"/>
        <Button variant="outline" size="sm" icon="filter">NCM</Button>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar produto, NCM..." value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="cat-split">
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
              {rows.length === 0 && (
                <tr><td colSpan={99}>
                  <div className="empty">
                    <h4>Nenhum produto encontrado</h4>
                    <p>Ajuste os filtros ou cadastre um novo produto pelo módulo de Engenharia.</p>
                  </div>
                </td></tr>
              )}
              {rows.map(p => {
                const isSelected = p.id === selectedId;
                return (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)}
                    style={isSelected ? { background: "#FFFBE6", boxShadow: "inset 3px 0 0 0 var(--vp-yellow)" } : null}>
                    <td>
                      <div className="cell-main" style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                        {p.produto || <span className="muted">(sem denominação)</span>}
                      </div>
                      <div className="cell-sub">#{p.id}</div>
                    </td>
                    <td>{p.ncm_atual ? <span className="sku">{p.ncm_atual}</span> : <span className="muted">—</span>}</td>
                    <td>{p.ncm_sugerido ? <span className="sku">{p.ncm_sugerido}</span> : <span className="muted">—</span>}</td>
                    <td>{p.solicitante || <span className="muted">—</span>}</td>
                    <td><span className="ncm-status" data-s={p.status}>{(p.status || "").replace(/_/g, " ").toLowerCase()}</span></td>
                    <td><span className="cell-sub">{p.created_at ? p.created_at.slice(0,10) : "—"}</span></td>
                    <td>
                      <Button variant="ghost" size="sm" icon="more"
                        onClick={(e) => { e.stopPropagation(); const ncm = p.ncm_atual || p.ncm_sugerido || ''; ncm ? navigator.clipboard?.writeText(ncm).then(() => window.toast(`NCM ${ncm} copiado!`, 'success')).catch(() => window.toast(`NCM: ${ncm}`, 'info')) : window.toast('Sem NCM cadastrado.', 'warning'); }}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="prod-detail">
            <div className="prod-detail__head">
              <div className="row sb">
                <span className="prod-detail__id">#{selected.id}</span>
                <span className="ncm-status" data-s={selected.status}>{(selected.status || "").replace(/_/g, " ").toLowerCase()}</span>
              </div>
              <div className="prod-detail__title">{selected.produto || "(Sem denominação)"}</div>
            </div>
            <div className="prod-detail__tabs">
              {["dados", "historico"].map(t => (
                <button key={t} className={detailTab === t ? "is-active" : ""} onClick={() => setDetailTab(t)}>
                  {t === "dados" ? "Dados básicos" : "Histórico"}
                </button>
              ))}
            </div>
            <div className="prod-detail__body">
              {detailTab === "dados" && <CatDetailDados p={selected}/>}
              {detailTab === "historico" && <CatDetailHistorico p={selected}/>}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
            Selecione um produto para ver os detalhes.
          </div>
        )}
      </div>
      {showNovo && <ModalNovoProduto onClose={() => setShowNovo(false)} onSaved={reloadProdutos}/>}
    </div>
  );
}

function CatDetailDados({ p }) {
  return (
    <div className="stack">
      <KvBlock label="NCM atual"    value={p.ncm_atual    || "—"} mono/>
      <KvBlock label="NCM sugerido" value={p.ncm_sugerido || "—"} mono/>
      <KvBlock label="Solicitante"  value={p.solicitante  || "—"}/>
      <KvBlock label="Responsável"  value={p.responsavel  || "—"}/>
      {p.descricao ? (
        <>
          <div className="hr"/>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Descrição</div>
          <p className="small" style={{ color: "var(--fg2)", lineHeight: 1.6 }}>{p.descricao}</p>
        </>
      ) : null}
      {p.observacoes ? (
        <>
          <div className="hr"/>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Observações</div>
          <p className="small" style={{ color: "var(--fg2)", lineHeight: 1.6 }}>{p.observacoes}</p>
        </>
      ) : null}
    </div>
  );
}

function CatDetailHistorico({ p }) {
  return (
    <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
      Histórico de versões será carregado aqui. {/* TODO: tabela de histórico por solicitação — fase futura */}
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
          <div className="page-head__eyebrow"><span className="vp-rule"/>Operações · Engenharia · Solicitações NCM</div>
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
