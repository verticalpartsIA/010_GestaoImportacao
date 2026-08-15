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
    const { error } = await window.__VP_SB.sb.from('contratos_venda_equipamentos').insert({
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
  const [gates, setGates] = React.useState(null);
  // Stable photo IDs so they don't shuffle on re-render
  const photoIds = React.useMemo(() => ([3142, 5891, 7204, 2057, 4396, 6128]), []);

  const reloadProjetos = () => {
    setLoading(true);
    window.__VP_SB.sb.from('projetos').select('*')
      .then(({ data }) => { setProjetos(data || []); setLoading(false); });
  };

  const validarGatesProjeto = async (projectId) => {
    if (window.ProjectGates && window.ProjectGates.validarGatesImportacao) {
      const result = await window.ProjectGates.validarGatesImportacao(projectId);
      setGates(result);
    }
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
                onClick={() => { setSelectedProject(p); validarGatesProjeto(p.id); setGates(null); }}>
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
              { key: "vistoria", label: "Vistoria", icon: "checklist" },
              { key: "ncm", label: "NCM / Ficha Técnica", icon: "package" },
              { key: "gates", label: "Gatilhos Importação", icon: "zap" },
            ]} active={engTab} onChange={setEngTab}/>

            {engTab === "vistoria" && (
              <div style={{ marginTop: 20, textAlign:'center', padding:'28px 20px', border:'1px solid var(--border)', background:'var(--vp-gray-50)' }}>
                <p style={{ fontSize:13, color:'var(--fg1)', margin:'0 0 14px' }}>
                  As vistorias desta obra agora ficam num lugar só: <b>Vistorias de Obras</b>, dentro da aba <b>Instalação</b> do <b>Dossiê da Obra</b> correspondente — não mais aqui, pra não duplicar registro em duas telas diferentes.
                </p>
                <Button variant="primary" size="sm" icon="arrowRight" onClick={() => setRoute && setRoute('status-obras')}>Abrir obras</Button>
              </div>
            )}

            {engTab === "gates" && (
              <div style={{ marginTop: 20 }}>
                <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, padding: 16 }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#92400e" }}>🔓 Gatilhos para Iniciar Importação (120 dias)</h3>
                  {gates === null ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#666", fontSize: 13 }}>Carregando validação…</div>
                  ) : gates.erro ? (
                    <div style={{ color: "#dc2626", fontSize: 13 }}>❌ Erro ao validar: {gates.detalhe}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {gates.gates.map((g, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "#fff", borderRadius: 4, border: "1px solid " + (g.ok ? "#10b981" : "#fbbf24") }}>
                          <span style={{ fontSize: 16 }}>{g.ok ? "✅" : "⏳"}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{g.descricao}</div>
                          </div>
                        </div>
                      ))}
                      {gates.ok && (
                        <div style={{ marginTop: 12, padding: 12, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 4, color: "#166534", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                          ✅ TODOS OS PRÉ-REQUISITOS OK — Importação pode ser iniciada!
                        </div>
                      )}
                      {!gates.ok && (
                        <div style={{ marginTop: 12, padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 4, color: "#991b1b", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                          ⏳ Aguarde todos os pré-requisitos antes de iniciar importação
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {engTab === "laudo" && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--fg3)', marginBottom:4 }}>Situação do laudo</div>
                <div style={{ fontSize:15, fontWeight:700 }}>{selectedProject.laudo || 'Pendente'}</div>
                <p style={{ fontSize:12, color:'var(--fg3)', marginTop:12 }}>Aprove o laudo pelo botão no topo. O laudo técnico completo é anexado na aba Documentos da Dossiê da Obra.</p>
              </div>
            )}
            {engTab === "docs" && (
              <div style={{ marginTop: 20, textAlign:'center', padding:'28px 20px', border:'1px solid var(--border)', background:'var(--vp-gray-50)' }}>
                <p style={{ fontSize:13, color:'var(--fg1)', margin:'0 0 14px' }}>Os documentos da obra (ART, Termo de Vistoria, DataBook, Alvará, Termo de Entrega) ficam na aba <b>Documentos</b> da <b>Dossiê da Obra</b>, com upload e checklist de prontidão por obra.</p>
                <Button variant="primary" size="sm" icon="arrowRight" onClick={() => setRoute && setRoute('status-obras')}>Abrir obras</Button>
              </div>
            )}
            {(engTab === "bom" || engTab === "visita" || engTab === "ncm") && (
              <div style={{ textAlign:'center', padding:'32px 20px', color:'var(--fg3)', fontSize:13 }}>
                {engTab === "ncm" ? "Ficha técnica e NCM do produto ficam no Catálogo de Produtos / Solicitações NCM."
                 : engTab === "visita" ? "As vistorias estão na aba Vistoria deste projeto — que abre o módulo Vistorias de Obras, dentro do Dossiê da Obra correspondente."
                 : "A lista de materiais (BOM) vem do Projeto de Equipamento / Ficha Técnica do produto."}
              </div>
            )}
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

/* ---------- JURÍDICO — lista idêntica ao PropostasPage =================== */
function JuridicoPage({ setRoute, setSubsel }) {
  const [contratos, setContratos] = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [showNovo, setShowNovo]   = React.useState(false);

  const reload = () => {
    setLoading(true);
    window.__VP_SB.sb.from('contratos_venda_equipamentos').select('*').order('issued_date', { ascending: false })
      .then(({ data }) => { setContratos(data || []); setLoading(false); });
  };
  React.useEffect(() => { reload(); }, []);

  const openEditor = (c) => {
    setSubsel && setSubsel(c);
    setRoute('contrato-editor');
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Contrato · Jurídico</div>
          <h1 className="page-head__title">Contratos & Minutas</h1>
          <p className="page-head__sub">Minuta contratual, preenchimento, redação de páginas confidenciais e envio para assinatura digital.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="upload" onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.pdf,.docx'; inp.onchange = e => { const f=e.target.files?.[0]; if(f) window.toast(`Minuta "${f.name}" importada.`,'success'); }; inp.click(); }}>Importar minuta</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo contrato</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Contratos no ar"    value={contratos.length}                                                    sub="total de contratos"   icon="fileText"/>
        <KPI label="Em assinatura"      value={contratos.filter(c => c.status === "Em assinatura digital").length}  sub="aguardando cliente"   icon="signature"/>
        <KPI label="Assinados"          value={contratos.filter(c => c.status === "Assinado").length}               sub="fase Compra liberada"  icon="check"/>
        <KPI label="Em redação"         value={contratos.filter(c => c.status === "Em redação").length}             sub="aguardando jurídico"   icon="edit"/>
      </div>

      {/* ===== GRID-2: lista + acesso rápido (idêntico ao PropostasPage) ===== */}
      <div className="grid-2" style={{ gap: 20 }}>

        {/* Contratos em andamento */}
        <Card title="Contratos em andamento" sub={`${contratos.length} registros`}
          action={<Button variant="ghost" size="sm" icon="filter"/>}>
          <div className="stack" style={{ gap: 12 }}>
            {loading && <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>}
            {!loading && contratos.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Nenhum contrato cadastrado.</div>
            )}
            {contratos.map((c) => (
              <div key={c.id} className="card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => openEditor(c)}>
                <div className="row sb">
                  <div>
                    <div className="cell-main" style={{ fontSize: 14 }}>{c.client || c.id}</div>
                    <div className="cell-sub">{c.id} · {c.issued_date ? new Date(c.issued_date).toLocaleDateString('pt-BR') : '—'}</div>
                  </div>
                  <StatusBadge status={c.status || 'Em redação'}/>
                </div>
                <div className="row sb" style={{ marginTop: 10 }}>
                  <div className="cell-money mono" style={{ fontSize: 16, fontWeight: 700 }}>{c.value ? fmtBRL(c.value) : '—'}</div>
                  <Button variant="ghost" size="sm" iconRight="arrowRight">Editar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Acesso Rápido — idêntico ao card de Propostas */}
        <Card title="Acesso Rápido" sub="abra o editor com um clique" sharp
          action={<Button variant="primary" size="sm" icon="plus" onClick={() => setShowNovo(true)}>Novo contrato</Button>}>
          <div className="stack" style={{ gap: 10 }}>
            {/* Banner preto — exatamente igual ao de Propostas */}
            <div onClick={() => setShowNovo(true)}
              style={{ padding: 18, background: '#000', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 3, background: 'var(--vp-yellow)' }}/>
              <Icon.fileText size={28} color="var(--vp-yellow)"/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>Abrir Editor de Contrato</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '.04em' }}>2 tipos · Cliente · Montador · Preview ao vivo</div>
              </div>
              <Icon.arrowRight color="var(--vp-yellow)"/>
            </div>

            {/* Cards de tipo — como Elevador / Escada / Esteira */}
            <div className="grid-2" style={{ gap: 8 }}>
              {/* Contrato do Cliente */}
              <div onClick={() => setShowNovo(true)} style={{ padding: 12, background: '#fff', border: '2px solid var(--vp-yellow)', cursor: 'pointer', position: 'relative', minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--vp-yellow)' }}/>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>📄</div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg1)', marginBottom: 4 }}>Contrato do Cliente</div>
                  <div style={{ fontSize: 9, color: 'var(--fg3)', lineHeight: 1.4 }}>Compra e venda · Instalação · 16 páginas · Minuta VerticalParts</div>
                </div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', marginTop: 8 }}>{contratos.filter(c=>(c.tipo_contrato||'cliente')==='cliente').length} contratos</div>
              </div>
              {/* Contrato do Montador */}
              <div style={{ padding: 12, background: '#fff', border: '1px solid var(--border)', cursor: 'not-allowed', position: 'relative', minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: .55 }}>
                <div>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>🔧</div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg1)', marginBottom: 4 }}>Contrato do Montador</div>
                  <div style={{ fontSize: 9, color: 'var(--fg3)', lineHeight: 1.4 }}>Prestação de serviços · Instalação · Terceiros</div>
                </div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'var(--vp-yellow)', color: '#000', fontWeight: 800, padding: '2px 6px', width: 'fit-content' }}>EM BREVE</div>
              </div>
            </div>

            <p className="small muted" style={{ marginTop: 6 }}>O editor é a forma recomendada de criar e preencher contratos. Baseado na Minuta Contratual VerticalParts.</p>
          </div>
        </Card>
      </div>

      {showNovo && (
        <ModalNovoContrato
          tipoDefault="cliente"
          onClose={() => setShowNovo(false)}
          onSaved={() => { reload(); setShowNovo(false); }}/>
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

/* EngLaudoContent/EngDocsContent/EngBomContent/EngVisitaContent (dados
   fixos de "Schindler 9300AE" etc., achado #54) foram removidos aqui —
   ficaram órfãos depois que o #48 trocou o conteúdo real renderizado
   (ver EngenhariaDetail: laudo aponta pra Dossiê da Obra, BOM aponta pro
   Projeto de Equipamento/Ficha Técnica). Nunca eram chamados de lugar
   nenhum — código morto. */
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

/* Checklist real e persistido por equipe (tabela equipe_checklist). */
function EquipeChecklist({ equipe }) {
  const sb = window.__VP_SB.sb;
  const [itens, setItens] = React.useState(null); // null = carregando
  const [novo, setNovo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data, error } = await sb.from('equipe_checklist').select('*').eq('equipe_id', equipe.id).order('ordem').order('created_at');
    if (error) { window.toast('Erro ao carregar checklist: ' + error.message, 'error'); setItens([]); return; }
    setItens(data || []);
  }, [equipe.id]);
  React.useEffect(() => { setItens(null); load(); }, [load]);

  const add = async () => {
    const desc = novo.trim(); if (!desc) return;
    setBusy(true);
    try {
      const ordem = (itens && itens.length) ? Math.max(...itens.map(i => i.ordem || 0)) + 1 : 0;
      const { error } = await sb.from('equipe_checklist').insert({ equipe_id: equipe.id, descricao: desc, ordem });
      if (error) throw error;
      setNovo(""); await load();
    } catch (e) { window.toast('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const toggle = async (it) => {
    setItens(prev => prev.map(x => x.id === it.id ? { ...x, feito: !x.feito } : x)); // otimista
    const { error } = await sb.from('equipe_checklist').update({ feito: !it.feito, updated_at: new Date().toISOString() }).eq('id', it.id);
    if (error) { window.toast('Erro ao salvar: ' + error.message, 'error'); load(); }
  };

  const remover = async (it) => {
    setItens(prev => prev.filter(x => x.id !== it.id));
    const { error } = await sb.from('equipe_checklist').delete().eq('id', it.id);
    if (error) { window.toast('Erro ao remover: ' + error.message, 'error'); load(); }
  };

  if (itens === null) return <div style={{ padding:'24px 0', textAlign:'center', color:'var(--fg3)', fontSize:13 }}>Carregando checklist…</div>;
  const feitos = itens.filter(i => i.feito).length;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <input className="pe-input" placeholder="Nova tarefa do checklist…" value={novo}
          onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ flex:1 }}/>
        <Button variant="primary" size="sm" icon="plus" onClick={add} disabled={busy || !novo.trim()}>Adicionar</Button>
      </div>
      {itens.length === 0 ? (
        <div style={{ padding:'24px 0', textAlign:'center', color:'var(--fg3)', fontSize:13 }}>Nenhuma tarefa no checklist. Adicione a primeira acima.</div>
      ) : (
        <>
          <div style={{ fontSize:12, color:'var(--fg2)', marginBottom:8, fontWeight:600 }}>{feitos}/{itens.length} concluídas</div>
          <div className="stack" style={{ gap:6 }}>
            {itens.map(it => (
              <div key={it.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', border:'1px solid var(--border)', background:'#fff' }}>
                <input type="checkbox" checked={!!it.feito} onChange={() => toggle(it)} style={{ width:16, height:16, cursor:'pointer' }}/>
                <span style={{ flex:1, fontSize:13, textDecoration: it.feito ? 'line-through' : 'none', color: it.feito ? 'var(--fg3)' : 'var(--fg1)' }}>{it.descricao}</span>
                <button onClick={() => remover(it)} title="Remover tarefa" style={{ border:0, background:'transparent', cursor:'pointer', color:'var(--fg3)', display:'flex' }}><Icon.trash size={14}/></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InstalacaoPage() {
  const [equipes, setEquipes] = React.useState([]);
  const [projetos, setProjetos] = React.useState([]);
  const [parceiros, setParceiros] = React.useState([]);
  const [alocacoes, setAlocacoes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEquipe, setSelectedEquipe] = React.useState(null);
  const [showAgendar, setShowAgendar] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      window.__VP_SB.sb.from('equipes').select('*'),
      window.__VP_SB.sb.from('projetos').select('*'),
      window.__VP_SB.sb.from('parceiros_instaladores').select('*'),
    ]).then(([eq, proj, parc]) => {
      setEquipes(eq.data || []);
      setProjetos(proj.data || []);
      setParceiros(parc.data || []);
      // Simula alocações (projeto.id = montador vinculado)
      const alocs = (proj.data || []).filter(p => p.status === "Em vistoria" || p.status === "Laudo emitido").map(p => ({
        projeto: p,
        parceiro: (parc.data || []).find(pc => pc.nome && p.responsavel?.includes(pc.nome)),
        iniciado: p.visita,
        previsao: new Date(new Date(p.visita).getTime() + 45*24*60*60*1000).toISOString(),
      })).filter(a => a.parceiro);
      setAlocacoes(alocs);
      setLoading(false);
    });
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
        <KPI label="Obras ativas" value={String(alocacoes.length)} sub="com parceiro alocado" icon="briefcase"/>
        <KPI label="Parceiros homologados" value={String(parceiros.length)} sub="disponíveis" icon="users"/>
        <KPI label="Termos de aceite" value="—" sub="sem dados suficientes" icon="check"/>
      </div>

      {alocacoes.length > 0 && (
        <Card title="Parceiros em Obras" sub={`${alocacoes.length} alocações ativas`} style={{ marginBottom: 20 }}>
          <div className="stack" style={{ gap: 14 }}>
            {alocacoes.map((aloc, i) => {
              const diasRestantes = Math.ceil((new Date(aloc.previsao) - new Date()) / (1000*60*60*24));
              const progresso = Math.max(0, Math.min(100, 100 - (diasRestantes / 45 * 100)));
              const statusColor = diasRestantes < 7 ? '#dc2626' : diasRestantes < 14 ? '#f59e0b' : '#10b981';

              return (
                <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
                  <div className="row sb" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>🏢 {aloc.parceiro?.nome || 'Parceiro não alocado'}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                        Obra: <b>{aloc.projeto.building}</b> ({aloc.projeto.id})
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="up-eyebrow muted">Status</div>
                      <StatusBadge status={aloc.projeto.status}/>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12, fontSize: 12 }}>
                    <div>
                      <div className="up-eyebrow muted">Iniciado</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{new Date(aloc.iniciado).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="up-eyebrow muted">Previsão de Entrega</div>
                      <div style={{ fontWeight: 600, marginTop: 2, color: statusColor }}>
                        {new Date(aloc.previsao).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div>
                      <div className="up-eyebrow muted">Dias Restantes</div>
                      <div style={{ fontWeight: 600, marginTop: 2, color: statusColor }}>{diasRestantes} dias</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div className="up-eyebrow muted" style={{ marginBottom: 4 }}>Progresso</div>
                    <div className="progress"><span style={{ width: progresso + '%' }}/></div>
                    <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>{Math.round(progresso)}% concluído</div>
                  </div>

                  {aloc.parceiro && (
                    <div style={{ fontSize: 11, color: 'var(--fg3)', padding: '8px 10px', background: 'var(--vp-gray-50)', borderRadius: 4 }}>
                      ✓ Certificações ativas: {
                        Object.entries(aloc.parceiro.certificacoes || {})
                          .filter(([_, cert]) => cert?.data_validade && new Date(cert.data_validade) > new Date())
                          .map(([key]) => key.toUpperCase())
                          .join(', ') || 'Nenhuma'
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

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
            <EquipeChecklist equipe={selectedEquipe}/>
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
