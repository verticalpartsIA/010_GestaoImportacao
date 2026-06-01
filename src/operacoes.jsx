/* ============================================================
   operacoes.jsx — Engenharia + Jurídico + Instalação
   ============================================================ */

/* ---------- MODAL: Novo Projeto de Engenharia ---------- */
function ModalNovoProjeto({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    building: '', projeto: '', responsavel: '',
    visita: '', status: 'Em vistoria', pendencia: '',
    descricao: '',
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.responsavel.trim()) return window.toast('Responsável é obrigatório.', 'warning');
    setSaving(true);
    const id = 'PJ-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('projetos').insert({
      id,
      building: f.building,
      projeto: f.projeto || null,
      responsavel: f.responsavel,
      visita: f.visita || null,
      status: f.status,
      pendencia: f.pendencia || null,
      descricao: f.descricao || null,
      laudo: 'Pendente',
      arquivos: 0,
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Projeto criado com sucesso!', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type = 'text', ph = '', opts = null) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]}
            onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  return (
    <Modal title="Novo Projeto de Engenharia" onClose={onClose} width={540}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Criar Projeto'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Prédio / Empreendimento *', 'building', 'text', 'Ed. Itacolomi, Shopping Vila Olímpia…')}
        {fld('Nome do projeto (referência interna)', 'projeto', 'text', 'Ex.: Modernização 4 elevadores Schindler')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Responsável técnico *', 'responsavel', 'text', 'Engenheiro da VP')}
          {fld('Data da visita técnica', 'visita', 'date')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Status', 'status', 'text', '', ['Em vistoria','Aguardando laudo','Laudo emitido','Aprovado'])}
          {fld('Pendência principal', 'pendencia', 'text', 'Ex.: Aguardar acesso ao poço')}
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Descrição do escopo</label>
          <textarea className="input" rows={3} value={f.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Descreva equipamentos, quantidade, tipo de serviço…"
            style={{ resize:'vertical', fontFamily:'inherit' }}/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- MODAL: Novo Contrato ---------- */
function ModalNovoContrato({ onClose, onSaved, tipoDefault = 'cliente' }) {
  const [f, setF] = React.useState({
    client: '', projeto: '', lawyer: '',
    value: '', status: 'Em redação', issued_date: '',
    tipo_contrato: tipoDefault,
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.client.trim()) return window.toast('Cliente é obrigatório.', 'warning');
    setSaving(true);
    const ano = new Date().getFullYear();
    const id = 'CTR-' + String(Date.now()).slice(-4) + '/' + ano;
    const { error } = await window.__VP_SB.sb.from('contratos').insert({
      id,
      client: f.client,
      project_id: f.projeto || null,
      lawyer: f.lawyer || null,
      value: f.value ? parseFloat(f.value) : null,
      status: f.status,
      issued_date: f.issued_date || new Date().toISOString().slice(0, 10),
      pages: 16,
      days_pending: 0,
      tipo_contrato: f.tipo_contrato,
      dados: { numero: id, propostaRef: f.projeto },
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Contrato criado! Preencha os dados no editor.', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type = 'text', ph = '', opts = null) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]}
            onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  return (
    <Modal title="Novo Contrato" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Criando…' : 'Criar e Abrir Editor'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Tipo de contrato', 'tipo_contrato', 'text', '', ['cliente','montador'])}
        {fld('Cliente / Empresa *', 'client', 'text', 'Condomínio Ed. Itacolomi, Empresa XYZ…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Proposta de referência', 'projeto', 'text', 'PR-2026-001')}
          {fld('Advogado responsável', 'lawyer', 'text', 'Nome do advogado')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Valor (R$)', 'value', 'number', '0')}
          {fld('Data de emissão', 'issued_date', 'date')}
        </div>
        {fld('Status inicial', 'status', 'text', '', ['Em redação','Aguardando assinatura','Em assinatura digital','Assinado'])}
      </div>
    </Modal>
  );
}

/* ---------- ENGENHARIA ---------- */
function EngenhariaPage({ setRoute }) {
  const [projetos, setProjetos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [engTab, setEngTab] = React.useState("laudo");
  const [selectedProject, setSelectedProject] = React.useState(null);
  const [showNovoProjeto, setShowNovoProjeto] = React.useState(false);
  // Stable photo IDs so they don't shuffle on re-render
  const photoIds = React.useMemo(() => ([3142, 5891, 7204, 2057, 4396, 6128]), []);

  const reloadProjetos = () => {
    setLoading(true);
    window.__VP_SB.sb.from('projetos').select('*')
      .then(({ data }) => { setProjetos(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadProjetos(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Projetos</div>
          <h1 className="page-head__title">Projetos de Engenharia</h1>
          <p className="page-head__sub">Visita técnica, levantamento, BOM, laudo final. Gatilha aprovação para Importação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="calendar" onClick={() => window.open('https://calendar.google.com/calendar/r/week', '_blank')}>Calendário visitas</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowNovoProjeto(true)}>Novo projeto</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Projetos ativos" value={projetos.length} sub="abertos" icon="ruler"/>
        <KPI label="Aguard. laudo" value={projetos.filter(p => !p.laudo || p.laudo === "Pendente" || p.laudo === "—").length} sub="fila técnica" icon="fileSearch"/>
        <KPI label="Visitas semana" value="—" sub="sem dados suficientes" icon="calendar"/>
        <KPI label="SLA laudo" value="—" sub="sem dados suficientes" icon="clock"/>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <Card title="Projetos abertos" sub={`${projetos.length} ativos`}>
          <div className="stack" style={{ gap: 12 }}>
            {projetos.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </div>
            )}
            {projetos.map((p) => (
              <div key={p.id} style={{ background: selectedProject?.id === p.id ? "var(--vp-gray-50)" : "#fff", border: "1px solid " + (selectedProject?.id === p.id ? "#000" : "var(--border)"), padding: 14, cursor: "pointer", position: "relative" }}
                onClick={() => setSelectedProject(p)}>
                <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>
                <div className="row sb">
                  <div>
                    <div className="cell-main" style={{ fontSize: 14 }}>{p.building}</div>
                    <div className="cell-sub">{p.id} · vinculado a {p.projeto}</div>
                  </div>
                  <StatusBadge status={p.status}/>
                </div>
                <div className="grid-3" style={{ marginTop: 12, gap: 12 }}>
                  <div>
                    <div className="up-eyebrow muted">Visita técnica</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{fmtDateLong(p.visita)}</div>
                  </div>
                  <div>
                    <div className="up-eyebrow muted">Responsável</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{p.responsavel}</div>
                  </div>
                  <div>
                    <div className="up-eyebrow muted">Arquivos</div>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{p.arquivos} docs</div>
                  </div>
                </div>
                <div className="row sb" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <span className="small muted">Pendência: <b style={{ color: "var(--fg1)" }}>{p.pendencia}</b></span>
                  <Badge variant={p.laudo === "Aprovado" ? "success" : p.laudo === "Reprovado" ? "danger" : p.laudo === "—" ? "neutral" : "warning"}>Laudo: {p.laudo}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selectedProject ? (
          <Card title={`Detalhe: ${selectedProject.id} · ${selectedProject.building || selectedProject.nome}`}
            sub={selectedProject.descricao || selectedProject.projeto || ""}
            action={<>
              <Button variant="outline" size="sm" icon="upload" onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.pdf,.jpg,.jpeg,.png,.xlsx,.dwg'; inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.toast(`"${f.name}" selecionado (${Math.round(f.size/1024)}kb). Upload via Supabase Storage — configurar bucket.`, 'info'); }; inp.click(); }}>Anexar</Button>
              <Button variant="primary" size="sm" icon="check" onClick={async () => { const { error } = await window.__VP_SB.sb.from('projetos').update({ laudo: 'Aprovado' }).eq('id', selectedProject.id); if (error) return window.toast('Erro: ' + error.message, 'error'); window.toast(`Laudo ${selectedProject.id} aprovado!`, 'success'); reloadProjetos(); setSelectedProject(null); }}>Aprovar Laudo</Button>
            </>}>
            <Tabs tabs={[
              { key: "laudo", label: "Laudo Técnico", icon: "fileText" },
              { key: "docs", label: "Documentos", icon: "package" },
              { key: "bom", label: "BOM", icon: "list" },
              { key: "visita", label: "Visita", icon: "calendar" },
              { key: "ncm", label: "NCM / Ficha Técnica", icon: "package" },
            ]} active={engTab} onChange={setEngTab}/>
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--fg3)', fontSize:13 }}>
              Conteúdo do projeto {selectedProject.id} será carregado aqui. {/* TODO: tabela de itens e laudos — fase futura */}
            </div>
          </Card>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
            Selecione um projeto à esquerda para ver laudo, documentos, BOM e visita técnica.
          </div>
        )}
      </div>
      {showNovoProjeto && <ModalNovoProjeto onClose={() => setShowNovoProjeto(false)} onSaved={reloadProjetos}/>}
    </div>
  );
}

/* ---------- JURÍDICO — Contract page redactor =================== */
function JuridicoPage({ setRoute }) {
  const [contratos, setContratos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todos");
  const [tipoTab, setTipoTab] = React.useState("cliente");
  const [selectedContract, setSelectedContract] = React.useState(null);
  const [showNovoContrato, setShowNovoContrato] = React.useState(false);
  const filters = ["Todos", "Aguardando assinatura", "Em redação", "Em assinatura digital", "Assinado"];

  const reloadContratos = () => {
    setLoading(true);
    window.__VP_SB.sb.from('contratos').select('*').order('issued_date', { ascending: false })
      .then(({ data }) => { setContratos(data || []); setLoading(false); });
  };
  React.useEffect(() => { reloadContratos(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  // Filtra por tipo e status
  const rows = contratos.filter(c => {
    const tipo = c.tipo_contrato || 'cliente';
    if (tipo !== tipoTab) return false;
    return filter === "Todos" || c.status === filter;
  });
  const activeContract = selectedContract?.tipo_contrato === tipoTab ? selectedContract : rows[0] || null;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Contrato · Jurídico</div>
          <h1 className="page-head__title">Contratos & Minutas</h1>
          <p className="page-head__sub">Minuta contratual, preenchimento, redação de páginas confidenciais e envio para assinatura digital.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => setShowNovoContrato(true)}>Novo contrato</Button>
        </div>
      </div>

      {/* TABS DE TIPO — como Elevador / Escada / Esteira em Propostas */}
      <div className="contrato-tipo-tabs">
        <button className={"contrato-tipo-tab" + (tipoTab === "cliente" ? " is-on" : "")}
          onClick={() => { setTipoTab("cliente"); setSelectedContract(null); }}>
          📄 Contrato do Cliente
        </button>
        <button className={"contrato-tipo-tab contrato-tipo-tab--soon" + (tipoTab === "montador" ? " is-on" : "")}
          onClick={() => { setTipoTab("montador"); setSelectedContract(null); }}
          title="Em breve">
          🔧 Contrato do Montador
        </button>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Em redação" value={contratos.filter(c => (c.tipo_contrato||'cliente') === tipoTab && c.status === "Em redação").length} sub="aguardando" icon="edit"/>
        <KPI label="Em assinatura" value={contratos.filter(c => (c.tipo_contrato||'cliente') === tipoTab && c.status === "Em assinatura digital").length} sub="aguardando cliente" icon="signature"/>
        <KPI label="Assinados" value={contratos.filter(c => (c.tipo_contrato||'cliente') === tipoTab && c.status === "Assinado").length} sub="fase Compra liberada" icon="check"/>
        <KPI label="Atrasados" value={String(contratos.filter(c => (c.tipo_contrato||'cliente') === tipoTab && (c.days_pending||0) > 7).length)} sub="ação necessária" icon="warning"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {filters.map(s => (
            <button key={s} className={filter === s ? "is-active" : ""} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
        <div className="spacer"/>
        <Button variant="outline" size="sm" icon="upload" onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.pdf,.docx,.doc'; inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.toast(`Minuta "${f.name}" importada.`, 'success'); }; inp.click(); }}>Importar minuta</Button>
      </div>

      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="t">
          <thead><tr>
            <th>Contrato</th>
            <th>Cliente</th>
            <th>Proposta ref.</th>
            <th>Advogado</th>
            <th>Status</th>
            <th className="text-right">Valor</th>
            <th>Dias</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum contrato cadastrado para este tipo.
                <br/><span style={{ fontSize:11, marginTop:4, display:'block' }}>Clique em "Novo contrato" para criar.</span>
              </td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} style={{ cursor: "pointer", background: activeContract?.id === c.id ? "var(--vp-gray-50)" : "" }}
                onClick={() => setSelectedContract(c)}>
                <td>
                  <div className="cell-main">{c.id}</div>
                  <div className="cell-sub">{fmtDate(c.issued || c.issued_date)}</div>
                </td>
                <td>{c.client}</td>
                <td><span className="cell-sub">{c.project_id || c.projeto || '—'}</span></td>
                <td>{c.lawyer || '—'}</td>
                <td><StatusBadge status={c.status}/></td>
                <td className="cell-money">{fmtBRL(c.value)}</td>
                <td>
                  {(() => { const d = c.days ?? c.days_pending ?? 0; return (
                    <span className="cell-num" style={{ color: d > 7 ? "var(--vp-danger)" : d > 0 ? "var(--vp-warning-ink)" : "var(--fg3)" }}>
                      {d === 0 ? "—" : d + "d"}
                    </span>
                  ); })()}
                </td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor do contrato selecionado */}
      {activeContract ? (
        tipoTab === "cliente" ? (
          <div>
            <div className="row sb" style={{ marginBottom:12 }}>
              <div>
                <div className="cell-main">{activeContract.id} · {activeContract.client}</div>
                <div className="cell-sub">{activeContract.project_id || activeContract.projeto || ''} · <StatusBadge status={activeContract.status}/></div>
              </div>
            </div>
            <ContratoClienteEditor
              key={activeContract.id}
              contrato={activeContract}
              onSaved={reloadContratos}/>
          </div>
        ) : (
          /* Montador — em breve */
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--fg3)', fontSize:13, border:'1px dashed var(--border)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🔧</div>
            <strong>Contrato do Montador</strong>
            <p style={{ marginTop:4, fontSize:12 }}>Em construção — baseado na MINUTA DOS TERCEIROS.</p>
          </div>
        )
      ) : (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
          Selecione um contrato na tabela ou crie um novo.
        </div>
      )}

      {showNovoContrato && (
        <ModalNovoContrato
          tipoDefault={tipoTab}
          onClose={() => setShowNovoContrato(false)}
          onSaved={reloadContratos}/>
      )}
    </div>
  );
}

/* ✂️ Page selector + redactor — the highlight feature */
function ContractRedactor() {
  const totalPages = 24;
  // pages initially redacted (sensitive: pricing, suppliers)
  const initial = new Set([9, 10, 14]);
  const [redacted, setRedacted] = React.useState(initial);
  const [active, setActive] = React.useState(9); // currently focused
  const [selection, setSelection] = React.useState(new Set([9, 10, 14]));

  const toggleRedact = (n) => {
    const next = new Set(redacted);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setRedacted(next);
  };
  const toggleSelect = (n) => {
    const next = new Set(selection);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelection(next);
  };
  const applyToSelection = () => {
    setRedacted(new Set(selection));
  };
  const clearAll = () => setRedacted(new Set());

  return (
    <div className="contract-grid">
      <div>
        <div className="row sb" style={{ marginBottom: 10 }}>
          <span className="up-eyebrow muted">Páginas do contrato</span>
          <span className="mono small" style={{ color: "var(--fg3)" }}>{totalPages} pgs · {redacted.size} ✂</span>
        </div>
        <div className="pg-thumbs">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const isRedact = redacted.has(n);
            const isSelected = selection.has(n);
            const isActive = active === n;
            const heading = (
              n === 1 ? "CAPA" :
              n === 2 ? "PARTES" :
              n === 3 ? "OBJETO" :
              n === 4 ? "ESCOPO" :
              n === 5 ? "ESCOPO" :
              n === 9 ? "VALORES" :
              n === 10 ? "PAGAMENTO" :
              n === 14 ? "FORNECEDOR" :
              n === 18 ? "GARANTIA" :
              n === 22 ? "ASSINATURA" :
              "CLÁUSULAS"
            );
            return (
              <div key={n}
                className={["pg-thumb", isActive ? "is-active" : "", isRedact ? "is-redact" : "", isSelected ? "is-selected" : ""].join(" ")}
                onClick={(e) => {
                  if (e.shiftKey) toggleSelect(n);
                  else setActive(n);
                }}>
                <div className="pg-thumb__num">{String(n).padStart(2, "0")}</div>
                {isSelected ? <div className="pg-thumb__check"><Icon.check size={10}/></div> : null}
                <div className="pg-thumb__body">
                  <div className="pg-h">{heading}</div>
                  <p className="l"/><p className="x"/><p className="l"/><p className="s"/>
                  <p className="l"/><p className="x"/><p className="l"/><p className="s"/>
                  <p className="l"/><p className="x"/>
                </div>
                {isRedact ? <>
                  <div className="pg-thumb__redact-overlay"/>
                </> : null}
              </div>
            );
          })}
        </div>
        <div className="row gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" icon="scissors" onClick={applyToSelection}>Redigir seleção</Button>
          <Button variant="ghost" size="sm" icon="x" onClick={clearAll}>Limpar</Button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Dica: <kbd style={{ background: "var(--vp-gray-100)", padding: "1px 5px", fontFamily: "var(--font-mono)", fontSize: 10 }}>Shift+Clique</kbd> para selecionar múltiplas páginas.</p>
      </div>

      <div className="contract-preview">
        <div className="contract-preview__head">
          <span>Página <b style={{ color: "var(--fg1)" }}>{String(active).padStart(2, "0")}</b> de {totalPages}</span>
          <div className="row gap-2">
            <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setActive(Math.max(1, active - 1))}/>
            <Button variant="ghost" size="sm" icon="chevRight" onClick={() => setActive(Math.min(totalPages, active + 1))}/>
          </div>
        </div>
        <div className="redact-toolbar">
          <Button variant={redacted.has(active) ? "secondary" : "outline"} size="sm" icon="scissors" onClick={() => toggleRedact(active)}>
            {redacted.has(active) ? "Restaurar página" : "Redigir esta página"}
          </Button>
        </div>
        <div className="contract-doc" style={{ position: "relative" }}>
          {active === 9 ? <ContractPage9 redacted={redacted.has(9)}/>
           : active === 10 ? <ContractPage10 redacted={redacted.has(10)}/>
           : active === 14 ? <ContractPage14 redacted={redacted.has(14)}/>
           : <ContractGenericPage num={active}/>
          }
          {redacted.has(active) ? (
            <div style={{
              position: "absolute",
              top: 16, right: 16,
              background: "var(--vp-danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".14em",
              padding: "4px 10px",
              transform: "rotate(2deg)",
              fontFamily: "var(--font-sans)"
            }}>✂ CONFIDENCIAL · REDIGIDA</div>
          ) : null}
        </div>
      </div>

      <div className="stack">
        <Card title="Versão Pública" sub="cópia para cliente após redação" sharp={true}>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Configurações da redação</div>
          <div className="stack" style={{ gap: 10 }}>
            <label className="row" style={{ fontSize: 12 }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "var(--vp-yellow)" }}/>
              <span>Substituir por blocos pretos (estilo padrão)</span>
            </label>
            <label className="row" style={{ fontSize: 12 }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "var(--vp-yellow)" }}/>
              <span>Substituir nome do fornecedor por "FABRICANTE PARCEIRO"</span>
            </label>
            <label className="row" style={{ fontSize: 12 }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "var(--vp-yellow)" }}/>
              <span>Ocultar valores de custo (manter preço final)</span>
            </label>
            <label className="row" style={{ fontSize: 12 }}>
              <input type="checkbox" style={{ accentColor: "var(--vp-yellow)" }}/>
              <span>Watermark "CÓPIA REDIGIDA — VERTICAL PARTS"</span>
            </label>
          </div>
        </Card>

        <Card title="Páginas Confidenciais Detectadas" sub="análise automática" sharp={true}>
          <div className="stack" style={{ gap: 8 }}>
            <DetectedRow page={9} category="Valores e tabela de preços" risk="alto"/>
            <DetectedRow page={10} category="Condições de pagamento detalhadas" risk="alto"/>
            <DetectedRow page={14} category="Identificação do fornecedor China" risk="alto"/>
            <DetectedRow page={16} category="Margem comercial mencionada" risk="médio"/>
            <DetectedRow page={19} category="Comissionamento interno" risk="médio"/>
          </div>
          <Button variant="outline" size="sm" icon="zap" style={{ marginTop: 14, width: "100%" }}>Sugerir redação automática</Button>
        </Card>

        <Card title="Auditoria" sub="trilha de revisões" sharp={true}>
          <div className="timeline">
            <div className="timeline__row current">
              <div className="timeline__node"/>
              <div>
                <div className="timeline__title">3 páginas marcadas para redação</div>
                <div className="timeline__sub">Marina A. · agora</div>
              </div>
              <div className="timeline__meta">v3</div>
              <div className="timeline__rail"/>
            </div>
            <div className="timeline__row done">
              <div className="timeline__node"/>
              <div>
                <div className="timeline__title">Minuta gerada da proposta</div>
                <div className="timeline__sub">Marina A. · 10/mai 14:22</div>
              </div>
              <div className="timeline__meta">v2</div>
              <div className="timeline__rail"/>
            </div>
            <div className="timeline__row done">
              <div className="timeline__node"/>
              <div>
                <div className="timeline__title">Importação template padrão</div>
                <div className="timeline__sub">Sistema · 06/mai</div>
              </div>
              <div className="timeline__meta">v1</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DetectedRow({ page, category, risk }) {
  const color = risk === "alto" ? "var(--vp-danger)" : "var(--vp-warning-ink)";
  return (
    <div className="row" style={{ padding: "8px 10px", background: "var(--vp-gray-50)", borderLeft: `3px solid ${color}` }}>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color }}>P.{String(page).padStart(2, "0")}</span>
      <span style={{ fontSize: 12, flex: 1 }}>{category}</span>
      <Badge variant={risk === "alto" ? "danger" : "warning"}>{risk}</Badge>
    </div>
  );
}

function ContractGenericPage({ num }) {
  return (
    <>
      {num === 1 ? <h1>CONTRATO DE FORNECIMENTO E PRESTAÇÃO DE SERVIÇOS Nº CT-2026-018</h1> : <h2>CLÁUSULA {romanize(num)}ª — DAS OBRIGAÇÕES</h2>}
      <p><span className="clause-num">{num}.1.</span> Pelo presente instrumento particular, as partes nomeadas no preâmbulo deste contrato, doravante denominadas em conjunto "PARTES" ou individualmente "PARTE", têm entre si justo e contratado o que abaixo se segue.</p>
      <p><span className="clause-num">{num}.2.</span> A CONTRATADA obriga-se a fornecer os equipamentos e prestar os serviços conforme descrito no escopo técnico anexo, observando as normas técnicas brasileiras aplicáveis (ABNT NBR 16858, NM-207, NM-313).</p>
      <p><span className="clause-num">{num}.3.</span> A CONTRATANTE compromete-se a disponibilizar o local da instalação devidamente preparado, com infraestrutura elétrica, civil e estrutural adequada conforme especificação técnica fornecida pela CONTRATADA.</p>
      <p><span className="clause-num">{num}.4.</span> Os prazos estabelecidos neste contrato serão contados em dias corridos, salvo quando expressamente indicado o contrário, iniciando-se a partir da data de assinatura ou conforme marco específico definido em cada cláusula.</p>
      <p><span className="clause-num">{num}.5.</span> As partes elegem o foro da Comarca de São Paulo/SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer questões oriundas do presente contrato.</p>
    </>
  );
}

function ContractPage9({ redacted }) {
  const R = (s) => redacted ? <span className="redact">{s}</span> : <b>{s}</b>;
  return (
    <>
      <h2>CLÁUSULA 9ª — DO VALOR DO CONTRATO</h2>
      <p><span className="clause-num">9.1.</span> O valor total deste contrato é de {R("R$ 1.840.000,00 (um milhão, oitocentos e quarenta mil reais)")}, conforme proposta comercial PR-2026-047 anexa, doravante denominado "VALOR CONTRATUAL".</p>
      <p><span className="clause-num">9.2.</span> O VALOR CONTRATUAL é composto da seguinte forma:</p>
      <p style={{ paddingLeft: 20 }}>a) Equipamentos importados FOB Shanghai: {R("USD 184.320,00")}</p>
      <p style={{ paddingLeft: 20 }}>b) Frete internacional e seguro CIF Santos: {R("R$ 56.700,00")}</p>
      <p style={{ paddingLeft: 20 }}>c) Impostos de importação (II, IPI, PIS, COFINS, ICMS): {R("R$ 478.220,00")}</p>
      <p style={{ paddingLeft: 20 }}>d) Despesas locais (despacho aduaneiro, frete nacional): {R("R$ 30.500,00")}</p>
      <p style={{ paddingLeft: 20 }}>e) Serviços de instalação e comissionamento: {R("R$ 248.000,00")}</p>
      <p style={{ paddingLeft: 20 }}>f) Margem comercial e garantia: {R("R$ 271.000,00")}</p>
      <p><span className="clause-num">9.3.</span> O VALOR CONTRATUAL inclui todos os tributos, encargos e despesas necessárias ao cumprimento integral do objeto deste contrato, salvo aqueles expressamente excluídos em escrito apartado.</p>
    </>
  );
}

function ContractPage10({ redacted }) {
  const R = (s) => redacted ? <span className="redact">{s}</span> : <b>{s}</b>;
  return (
    <>
      <h2>CLÁUSULA 10ª — DAS CONDIÇÕES DE PAGAMENTO</h2>
      <p><span className="clause-num">10.1.</span> O VALOR CONTRATUAL será pago pela CONTRATANTE à CONTRATADA conforme o seguinte cronograma:</p>
      <p style={{ paddingLeft: 20 }}>a) <b>30% (trinta por cento)</b> — {R("R$ 552.000,00")} — devidos em até 10 (dez) dias da assinatura deste contrato, a título de SINAL e início da produção dos equipamentos;</p>
      <p style={{ paddingLeft: 20 }}>b) <b>50% (cinquenta por cento)</b> — {R("R$ 920.000,00")} — devidos contra apresentação do Conhecimento de Embarque (Bill of Lading) da carga em porto de origem (Shanghai/China);</p>
      <p style={{ paddingLeft: 20 }}>c) <b>20% (vinte por cento)</b> — {R("R$ 368.000,00")} — devidos no recebimento do TERMO DE ACEITE FINAL após instalação e comissionamento concluídos.</p>
      <p><span className="clause-num">10.2.</span> Os pagamentos serão realizados via TED para a conta bancária da CONTRATADA, identificada na cláusula 22ª, mediante apresentação de Nota Fiscal de Serviços e Nota Fiscal de Produtos correspondentes.</p>
      <p><span className="clause-num">10.3.</span> O atraso no pagamento de qualquer parcela ensejará multa moratória de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de mora de 1% (um por cento) ao mês, calculados pro rata die.</p>
    </>
  );
}

function ContractPage14({ redacted }) {
  const R = (s) => redacted ? <span className="redact">{s}</span> : <b>{s}</b>;
  return (
    <>
      <h2>CLÁUSULA 14ª — DA ORIGEM DOS EQUIPAMENTOS</h2>
      <p><span className="clause-num">14.1.</span> Os equipamentos objeto deste contrato são produzidos pelo {R("FABRICANTE PARCEIRO HANGZHOU LIFT CO., LTD.")}, localizado em {R("Hangzhou Industrial Park, Zhejiang Province, China")}, sob padrões técnicos rigorosamente alinhados às normas IEC 60834 e EN 81-20.</p>
      <p><span className="clause-num">14.2.</span> A CONTRATADA é {R("distribuidora oficial autorizada")} para o território brasileiro desde {R("2019")}, conforme contrato de distribuição internacional registrado em cartório.</p>
      <p><span className="clause-num">14.3.</span> Todos os equipamentos passam por inspeção pré-embarque na fábrica de origem, com emissão de certificado de qualidade {R("(Certificado FQC nº emitido pelo fabricante)")}, e nova inspeção em território nacional antes da entrega à CONTRATANTE.</p>
      <p><span className="clause-num">14.4.</span> A CONTRATANTE reconhece e aceita expressamente a origem internacional dos equipamentos, ciente de que os prazos de entrega refletem o transit time marítimo internacional descrito na cláusula 11ª.</p>
    </>
  );
}

function romanize(num) {
  const lookup = { M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1 };
  let roman = "";
  for (const i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
  return roman;
}

function EngLaudoContent({ photoIds }) {
  const labels = ["Quadro Comando", "Botoeira Cabine", "Casa de Máquinas", "Poço Elevador", "Display Pavimento", "Cabos Tração"];
  return (
    <>
      <div className="alert success" style={{ marginBottom: 14 }}>
        <Icon.check/>
        <div style={{ flex: 1 }}>
          <div className="alert__title">Laudo aprovado pela engenharia interna</div>
          <div className="alert__sub">Daniel Otsuka · 12/mai 16:30 · revisado por Renan Bertoli</div>
        </div>
      </div>
      <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Resumo do Laudo</div>
      <p className="vp-small" style={{ marginBottom: 12 }}>
        Vistoria realizada em 08/mai/2026. Os 4 elevadores Schindler 9300AE apresentam quadros de comando obsoletos
        (geração 1998), botoeiras corroídas, displays sem retroiluminação, e cabos de tração com sinais de fadiga
        em 2 unidades. Recomenda-se modernização completa conforme BOM anexa.
      </p>
      <div className="grid-2" style={{ gap: 14 }}>
        <KvBlock label="Marca / Modelo" value="Schindler 9300AE"/>
        <KvBlock label="Quantidade" value="4 elevadores"/>
        <KvBlock label="Ano fabricação" value="1998"/>
        <KvBlock label="Capacidade" value="630 kg / 8 pessoas"/>
        <KvBlock label="Altura percurso" value="38m (12 andares)"/>
        <KvBlock label="Velocidade" value="1.5 m/s"/>
      </div>
      <div className="hr"/>
      <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Fotos da vistoria</div>
      <div className="grid-3" style={{ gap: 8 }}>
        {labels.map((lbl, i) => (
          <div key={lbl} style={{
            aspectRatio: "4/3",
            background: "repeating-linear-gradient(135deg, var(--vp-gray-100) 0 8px, var(--vp-gray-200) 8px 16px)",
            display: "flex", alignItems: "flex-end", justifyContent: "flex-start",
            position: "relative",
            cursor: "pointer",
          }}>
            <span style={{ background: "#000", color: "var(--vp-yellow)", padding: "3px 6px", fontFamily: "var(--font-mono)", fontSize: 9, margin: 6 }}>IMG_{photoIds[i]}</span>
            <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,.75)", color: "#fff", fontSize: 10, padding: "2px 6px", fontWeight: 700 }}>{lbl}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function EngDocsContent() {
  const docs = [
    { n: "ART_CREA_2026-148.pdf", size: "184 kb", kind: "ART" },
    { n: "Memorial_Descritivo_v3.pdf", size: "412 kb", kind: "MD" },
    { n: "Planta_Casa_Maquinas.dwg", size: "1.2 MB", kind: "CAD" },
    { n: "Esquema_Eletrico_QC.pdf", size: "320 kb", kind: "ELE" },
    { n: "BOM_Schindler_9300AE.xlsx", size: "48 kb", kind: "BOM" },
    { n: "Fotos_Vistoria.zip", size: "18.4 MB", kind: "ZIP" },
    { n: "NBR_16858_checklist.pdf", size: "96 kb", kind: "DOC" },
    { n: "Laudo_Tecnico_Final.pdf", size: "278 kb", kind: "LDO" },
    { n: "Termo_Vistoria_assinado.pdf", size: "112 kb", kind: "ASS" },
    { n: "Cronograma_modernizacao.xlsx", size: "32 kb", kind: "XLS" },
    { n: "Orçamento_pecas.pdf", size: "84 kb", kind: "ORC" },
    { n: "Aprovacao_eng.pdf", size: "44 kb", kind: "APR" },
  ];
  return (
    <div className="grid-3" style={{ gap: 8 }}>
      {docs.map(d => (
        <div key={d.n} style={{ padding: 12, background: "var(--vp-gray-50)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => window.toast("Visualizando " + d.n, "info")}>
          <span style={{ background: "#000", color: "var(--vp-yellow)", padding: "3px 6px", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>{d.kind}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.n}</div>
            <div className="cell-sub">{d.size}</div>
          </div>
          <Icon.download size={14} color="var(--fg3)"/>
        </div>
      ))}
    </div>
  );
}

function EngBomContent() {
  const bom = [
    { sku: "VP-QC-450", desc: "Quadro Comando MAX-3000 Trifásico", qty: 4, unit: 18400 },
    { sku: "VP-BT-880", desc: "Botoeira Inox c/ Braille", qty: 48, unit: 280 },
    { sku: "VP-CR-3100", desc: "Corrimão Borracha 30m", qty: 4, unit: 1200 },
    { sku: "VP-DG-2400", desc: "Display TFT 4.3'' Pavimento", qty: 48, unit: 340 },
    { sku: "VP-GU-1200", desc: "Guia T127 Otis Gen2 — 2.5m", qty: 16, unit: 2800 },
    { sku: "VP-BI-220", desc: "Barreira Infravermelha 220V", qty: 4, unit: 880 },
  ];
  const total = bom.reduce((a, b) => a + b.qty * b.unit, 0);
  return (
    <div className="table-wrap" style={{ border: 0 }}>
      <table className="t">
        <thead><tr><th>SKU</th><th>Descrição</th><th>Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {bom.map(b => (
            <tr key={b.sku}>
              <td><span className="sku">{b.sku}</span></td>
              <td>{b.desc}</td>
              <td className="cell-num">{b.qty}</td>
              <td className="cell-money">{fmtBRL(b.unit)}</td>
              <td className="cell-money">{fmtBRL(b.qty * b.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "var(--vp-gray-50)" }}>
            <td colSpan={4} className="text-right" style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em" }}>Total BOM</td>
            <td className="cell-money" style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 14 }}>{fmtBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EngVisitaContent() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid-2" style={{ gap: 14 }}>
        <KvBlock label="Data da visita" value="08/mai/2026"/>
        <KvBlock label="Horário" value="09:30 — 14:00"/>
        <KvBlock label="Responsável VP" value="Daniel Otsuka"/>
        <KvBlock label="Apoio técnico" value="Renan Bertoli"/>
        <KvBlock label="Recebido por" value="André Pessoa (Síndico)"/>
        <KvBlock label="Manutenção atual" value="Ricci Manutenções (3 anos)"/>
      </div>
      <div className="hr"/>
      <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Observações da Visita</div>
      <p className="vp-small">Acesso ao prédio liberado às 09:30. Vistoria iniciada pela casa de máquinas, seguida por inspeção dos 4 elevadores em uso. Cliente solicitou interrupção de 1 elevador por vez para inspeção do poço. Foram coletadas 47 fotos e medições com paquímetro e trena laser. Síndico se comprometeu a apresentar proposta em reunião do condomínio em 22/mai.</p>
    </div>
  );
}
function ModalAgendarInstalacao({ onClose }) {
  const [f, setF] = React.useState({ obra:'', equipe:'', data:'', horario:'08:00', obs:'' });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.obra.trim()) return window.toast('Nome da obra é obrigatório.', 'warning');
    if (!f.data) return window.toast('Data é obrigatória.', 'warning');
    setSaving(true);
    const { error } = await window.__VP_SB.sb.from('tarefas').insert({
      title: `Instalação: ${f.obra}`, module: 'Instalação', priority: 'alta',
      due_time: `${f.data} ${f.horario}`, role: 'admin',
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast(`Instalação de "${f.obra}" agendada para ${f.data}!`, 'success');
    onClose();
  };

  return (
    <Modal title="Agendar Instalação" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Agendar'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Obra / Prédio *</label>
          <input className="input" value={f.obra} onChange={e => set('obra', e.target.value)} placeholder="Ed. Itacolomi, Shopping Vila Olímpia…"/>
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Data *</label>
            <input className="input" type="date" value={f.data} onChange={e => set('data', e.target.value)}/>
          </div>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Horário</label>
            <input className="input" type="time" value={f.horario} onChange={e => set('horario', e.target.value)}/>
          </div>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Equipe responsável</label>
          <input className="input" value={f.equipe} onChange={e => set('equipe', e.target.value)} placeholder="Nome da equipe ou técnico líder"/>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={2} value={f.obs} onChange={e => set('obs', e.target.value)} placeholder="Informações adicionais…" style={{ resize:'vertical', fontFamily:'inherit' }}/>
        </div>
      </div>
    </Modal>
  );
}

function InstalacaoPage() {
  const [equipes, setEquipes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEquipe, setSelectedEquipe] = React.useState(null);
  const [showAgendar, setShowAgendar] = React.useState(false);

  React.useEffect(() => {
    window.__VP_SB.sb.from('equipes').select('*')
      .then(({ data }) => { setEquipes(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Instalação & Entrega · Instalação</div>
          <h1 className="page-head__title">Instalação em Campo</h1>
          <p className="page-head__sub">Equipes ativas, checklist de obra, laudo final e termo de aceite</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="calendar" onClick={() => window.open('https://calendar.google.com/calendar/r/week', '_blank')}>Calendário</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowAgendar(true)}>Agendar instalação</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Equipes em campo" value={equipes.filter(e => e.status === "Em campo").length} sub="ativas" icon="hardhat"/>
        <KPI label="Obras ativas" value="—" sub="sem dados suficientes" icon="briefcase"/>
        <KPI label="Tempo médio obra" value="—" sub="sem dados suficientes" icon="clock"/>
        <KPI label="Termos de aceite" value="—" sub="sem dados suficientes" icon="check"/>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <Card title="Equipes" sub={`${equipes.length} equipes`} sharp>
          <div className="stack" style={{ gap: 10 }}>
            {equipes.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </div>
            )}
            {equipes.map((e) => (
              <div key={e.id}
                style={{ padding: 14, background: selectedEquipe?.id === e.id ? "var(--vp-gray-50)" : "#fff", border: "1px solid " + (selectedEquipe?.id === e.id ? "#000" : "var(--border)"), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                onClick={() => setSelectedEquipe(e)}>
                <div style={{ width: 44, height: 44, background: e.status === "Em campo" ? "var(--vp-yellow)" : "var(--vp-gray-100)", color: e.status === "Em campo" ? "#000" : "var(--fg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon.hardhat size={22}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{e.nome}</div>
                  <div className="cell-sub">{e.lider} · {e.membros || "—"} membros · {e.ativo || "—"}</div>
                </div>
                <StatusBadge status={e.status === "Em campo" ? "Em rota" : "Aprovado"}/>
              </div>
            ))}
          </div>
        </Card>

        {selectedEquipe ? (
          <Card title={`Checklist · ${selectedEquipe.nome}`}
            sub={selectedEquipe.lider || ""}
            action={<>
              <Button variant="outline" size="sm" icon="upload" onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.toast(`Foto "${f.name}" selecionada. Upload via Supabase Storage.`, 'success'); }; inp.click(); }}>Foto</Button>
              <Button variant="primary" size="sm" icon="signature" onClick={() => { window.toast("Gerando laudo final — abrindo impressão.", "info"); setTimeout(() => window.print(), 200); }}>Laudo final</Button>
            </>}>
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--fg3)', fontSize:13 }}>
              Checklist da equipe {selectedEquipe.nome} será carregado aqui. {/* TODO: tabela de tarefas por equipe — fase futura */}
            </div>
          </Card>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
            Selecione uma equipe à esquerda para ver o checklist de obra.
          </div>
        )}
      </div>
      {showAgendar && <ModalAgendarInstalacao onClose={() => setShowAgendar(false)}/>}
    </div>
  );
}

Object.assign(window, { EngenhariaPage, JuridicoPage, InstalacaoPage });
