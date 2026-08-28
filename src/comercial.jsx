/* ============================================================
   comercial.jsx — Leads, Cotações, Precificação, Propostas
   ============================================================ */

/* ---------- MODAL: Novo Lead ----------
   15/08 → revisão do fluxo Lead→Formulário: o cadastro de Lead NÃO coleta
   mais equipamento (elevador/escada/esteira) — isso ficava preso a um
   único item, obrigava specs cedo demais e nunca virava dado estruturado
   de verdade (era um texto solto em `leads.equip`). Lead agora é só
   identificação do cliente (CNPJ + contato); a alocação de quantos
   equipamentos/tipos forem necessários acontece no Formulário, chamado
   a partir daqui ou da tela de Detalhe do Lead. */
function ModalNovoLead({ onClose, onSaved, onOpenFormulario, lead }) {
  const isEdit = !!lead;
  const [f, setF] = React.useState(() => isEdit ? {
    building: lead.building || '', contact: lead.contact || '', role: lead.role || '',
    phone: lead.phone || '', email: lead.email || '',
    tipoPessoa: 'PJ', cnpj: '', cpf: '', documentoPendente: !!lead.documento_pendente, razaoSocial: '',
    origin: lead.origin || 'Site', status: lead.status || 'Em qualificação',
    owner: lead.owner || '', value: lead.value != null ? String(lead.value) : '',
    priority: ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' }[String(lead.priority || '').toLowerCase()] || lead.priority || 'Alta'),
    next: lead.next_action || lead.next || '',
  } : {
    building:'', contact:'', role:'', phone:'', email:'',
    tipoPessoa:'PJ', cnpj:'', cpf:'', documentoPendente:false, razaoSocial:'',
    origin:'Site', status:'Em qualificação',
    owner:'', value:'', priority:'Alta', next:'',
  });
  const [buscandoCnpj, setBuscandoCnpj] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedLead, setSavedLead] = React.useState(null);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  /* Edição: o CNPJ/CPF/Razão Social não vivem no Lead — só no `clientes`
     vinculado (lead.cliente_id). Busca depois do mount (não trava a
     abertura do modal esperando essa consulta) e preenche por cima do
     estado inicial, só quando os dados chegam. */
  React.useEffect(() => {
    if (!isEdit || !lead.cliente_id) return;
    let alive = true;
    window.CadastrosClientesStore?.obter(lead.cliente_id).then((c) => {
      if (!alive || !c) return;
      setF((p) => ({
        ...p,
        tipoPessoa: c.tipo_pessoa || p.tipoPessoa,
        cnpj: c.cnpj || p.cnpj,
        cpf: c.cpf || p.cpf,
        razaoSocial: c.razao_social || p.razaoSocial,
      }));
    });
    return () => { alive = false; };
  }, [isEdit, lead?.cliente_id]);

  const buscarCnpj = async () => {
    if (!window.EnderecoAPI?.isCnpjValido(f.cnpj)) return window.toast('CNPJ inválido — informe 14 dígitos.', 'warning');
    setBuscandoCnpj(true);
    try {
      const dados = await window.EnderecoAPI.buscarCNPJ(f.cnpj);
      setF(p => ({ ...p, razaoSocial: dados.razao_social || p.razaoSocial, phone: p.phone || dados.telefone || p.phone }));
      window.toast('Dados do CNPJ preenchidos automaticamente.', 'success');
    } catch (e) {
      window.toast(e.message, 'warning');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.contact.trim())  return window.toast('Contato é obrigatório.', 'warning');
    const cnpjDigits = (f.cnpj || '').replace(/\D/g, '');
    const cpfDigits = (f.cpf || '').replace(/\D/g, '');
    if (!f.documentoPendente) {
      if (f.tipoPessoa === 'PF') {
        if (cpfDigits && !window.EnderecoAPI?.isCpfValido(cpfDigits)) return window.toast('CPF inválido — informe 11 dígitos.', 'warning');
      } else if (cnpjDigits && !window.EnderecoAPI?.isCnpjValido(cnpjDigits)) {
        return window.toast('CNPJ inválido — informe 14 dígitos.', 'warning');
      }
    }
    setSaving(true);
    const id = isEdit ? lead.id : 'LD-' + Date.now().toString().slice(-6);
    const payload = {
      building: f.building, contact: f.contact, role: f.role || null,
      phone: f.phone || null, email: f.email || null,
      origin: f.origin, status: f.status, owner: f.owner || null,
      value: f.value ? parseFloat(f.value) : null,
      priority: ({ 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }[f.priority] || 'media'),
      next_action: f.next || null,
      documento_pendente: f.documentoPendente,
    };

    const { error } = isEdit
      ? await window.__VP_SB.sb.from('leads').update(payload).eq('id', id)
      : await window.__VP_SB.sb.from('leads').insert({ id, ...payload, date: new Date().toISOString().slice(0, 10) });
    if (error) { setSaving(false); return window.toast('Erro: ' + error.message, 'error'); }

    /* CNPJ/CPF informado (e não marcado como "será inserido depois") →
       resolve/cria o cliente (mesma dedup por documento do Formulário,
       window.FormularioElevadorStore.buscarOuCriarCliente) e já vincula
       leads.cliente_id — assim o Formulário, quando chamar este Lead,
       abre com o cliente pronto, sem redigitar CNPJ/CPF.

       Na edição, se o Lead JÁ tem cliente_id, sincroniza esse registro
       sempre — mesmo sem CNPJ/CPF ainda (documento pendente) — senão editar
       só a Razão Social de um cliente provisório fecha com "Lead
       atualizado" mas descarta a edição em silêncio (achado real via
       review). `clienteIdProvisorio` faz o store atualizar esse mesmo
       registro em vez de criar um novo. */
    const docDigits = f.tipoPessoa === 'PF' ? cpfDigits : cnpjDigits;
    let clienteId = isEdit ? (lead.cliente_id || null) : null;
    let clienteAtualizado = null;
    if ((isEdit && lead.cliente_id) || (!f.documentoPendente && docDigits)) {
      try {
        const cliente = await window.FormularioElevadorStore.buscarOuCriarCliente({
          [f.tipoPessoa === 'PF' ? 'cpf' : 'cnpj']: docDigits, tipo_pessoa: f.tipoPessoa,
          razao_social: f.razaoSocial || f.building,
          contato: f.contact, telefone: f.phone || null, email: f.email || null,
          clienteIdProvisorio: isEdit ? (lead.cliente_id || null) : null,
        });
        clienteId = cliente.id;
        clienteAtualizado = cliente;
        if (clienteId !== (isEdit ? lead.cliente_id : null)) {
          await window.__VP_SB.sb.from('leads').update({ cliente_id: clienteId }).eq('id', id);
        }
      } catch (e) {
        window.toast((isEdit ? 'Lead atualizado, mas' : 'Lead criado, mas') + ' falhou ao vincular cliente: ' + e.message, 'warning');
      }
    }

    setSaving(false);
    if (isEdit) {
      window.toast('Lead atualizado.', 'success');
      /* Passa o cliente sincronizado de volta — a tela de Detalhe do Lead
         depende só de lead.cliente_id pra refazer essa busca, e esse id não
         muda quando só os DADOS do cliente (razão social, CNPJ...) mudam,
         então sem isso o card "Cliente" ficava com dado velho até recarregar
         a página (2º achado do review). */
      onSaved?.({ ...lead, ...payload, cliente_id: clienteId }, clienteAtualizado);
      onClose();
      return;
    }
    onSaved?.();
    setSavedLead({
      id, building: f.building, contact: f.contact, role: f.role, phone: f.phone, email: f.email,
      cliente_id: clienteId, razaoSocial: f.razaoSocial,
    });
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

  /* ISSUE #13: Auto-close modal após salvar lead se usuário não interagir */
  React.useEffect(() => {
    if (savedLead) {
      const timer = setTimeout(() => {
        setSavedLead(null);
        onClose();
      }, 4000);  // fecha automaticamente em 4 segundos
      return () => clearTimeout(timer);
    }
  }, [savedLead, onClose]);

  /* ---- pós-save: seguir pro Formulário (aloca equipamento lá) ---- */
  if (savedLead) {
    return (
      <Modal title="✓ Lead Criado! (fechará em 4s)" onClose={() => { setSavedLead(null); onClose(); }} width={500}
        footer={<>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {onOpenFormulario && (
            <Button variant="primary" icon="ruler"
              onClick={() => { onClose(); onOpenFormulario(savedLead); }}>
              Abrir Formulário →
            </Button>
          )}
        </>}>
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ background:'var(--vp-gray-50)', border:'1px solid var(--border)', padding:'14px 16px' }}>
            <div className="up-eyebrow muted" style={{ marginBottom:6 }}>Lead criado com sucesso</div>
            <div style={{ fontWeight:700, fontSize:15 }}>{savedLead.building}</div>
            <div className="cell-sub" style={{ marginTop:4 }}>{savedLead.id}</div>
            {savedLead.cliente_id
              ? <div className="cell-sub" style={{ marginTop:4 }}>Cliente vinculado: {savedLead.razaoSocial || savedLead.building}</div>
              : <div className="cell-sub" style={{ marginTop:4, color:'var(--vp-orange, #b45309)' }}>Sem CNPJ/CPF vinculado ainda — pode ser resolvido no Formulário.</div>}
          </div>
          <p style={{ fontSize:13, color:'var(--fg2)', margin:0 }}>
            Deseja abrir o Formulário agora e alocar os equipamentos deste lead?
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isEdit ? 'Editar Lead' : 'Novo Lead'} onClose={onClose} width={600}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : (isEdit ? 'Salvar Alterações' : 'Criar Lead')}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Prédio / Empreendimento *', 'building', 'text', 'Ed. Itacolomi, Shopping Vila Olímpia…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Contato *', 'contact', 'text', 'Nome do síndico / responsável')}
          {fld('Cargo', 'role', 'text', 'Síndico, Gerente, Engenheiro…')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Telefone', 'phone', 'text', '(11) 9 9999-9999')}
          {fld('Email', 'email', 'email', 'contato@email.com')}
        </div>

        {/* ---- CLIENTE (CNPJ/CPF) ---- */}
        <div style={{ border:'1px solid var(--border)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          <label className="up-eyebrow muted">Cliente (CNPJ/CPF)</label>
          <div className="grid-2" style={{ gap:12 }}>
            <div className="stack" style={{ gap:4 }}>
              <label className="up-eyebrow muted">Tipo de pessoa</label>
              <select className="input" value={f.tipoPessoa} onChange={e => set('tipoPessoa', e.target.value)}>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="PF">Pessoa Física</option>
              </select>
            </div>
          </div>
          <div className="row gap-2" style={{ alignItems:'flex-end' }}>
            <div className="stack" style={{ gap:4, flex:1 }}>
              <label className="up-eyebrow muted">{f.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}</label>
              <input className="input" type="text"
                value={f.tipoPessoa === 'PF' ? f.cpf : f.cnpj}
                onChange={e => set(f.tipoPessoa === 'PF' ? 'cpf' : 'cnpj', e.target.value)}
                placeholder={f.tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                disabled={f.documentoPendente}/>
            </div>
            {f.tipoPessoa !== 'PF' && (
              <Button variant="outline" onClick={buscarCnpj} disabled={buscandoCnpj || f.documentoPendente}>
                {buscandoCnpj ? 'Buscando…' : 'Buscar CNPJ'}
              </Button>
            )}
          </div>
          <label className="row gap-2" style={{ alignItems:'center', fontSize:12.5, cursor:'pointer' }}>
            <input type="checkbox" checked={f.documentoPendente}
              onChange={e => {
                const checked = e.target.checked;
                setF(p => ({ ...p, documentoPendente: checked, ...(checked ? { cnpj:'', cpf:'' } : {}) }));
              }}/>
            CPF ou CNPJ será inserido depois
          </label>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Razão Social</label>
            <input className="input" type="text" value={f.razaoSocial}
              onChange={e => set('razaoSocial', e.target.value)} placeholder="Preenchido automaticamente pelo CNPJ"/>
          </div>
          <p style={{ fontSize:11.5, color:'var(--fg3)', margin:0 }}>
            Sem CNPJ/CPF ainda? Marque a opção acima, ou deixe em branco e complete depois — direto no
            Formulário (busca o mesmo jeito, e evita duplicar cliente).
          </p>
        </div>

        <div className="grid-2" style={{ gap:12 }}>
          {fld('Origem', 'origin', 'text', '', ['Site','Indicação','LinkedIn','Cold Call','Evento','WhatsApp','Email'])}
          {fld('Prioridade', 'priority', 'text', '', ['Alta','Média','Baixa'])}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Responsável (Comercial)', 'owner', 'text', 'Nome do vendedor')}
          {fld('Valor estimado (R$)', 'value', 'number', '0')}
        </div>
        {fld('Próxima ação', 'next', 'text', 'Ex.: Enviar proposta, Agendar visita…')}
      </div>
    </Modal>
  );
}

/* ---------- LEADS ---------- */
function LeadsPage({ setRoute, setSubsel }) {
  const [leads, setLeads] = React.useState(null);
  const [status, setStatus] = React.useState("Todos");
  const [search, setSearch] = React.useState("");
  const [owner, setOwner] = React.useState("Todos");
  const [showLead, setShowLead] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 15;

  // Não reseta `leads` pra null aqui: fazer isso re-renderiza LeadsPage no
  // branch de "carregando" (que não inclui o modal na árvore) e desmonta
  // qualquer ModalNovoLead aberto no meio do save — a tela "✓ Lead Criado!"
  // nunca chegava a aparecer, reabria um modal novo em branco (bug real,
  // achado testando o fluxo completo). `leads` já nasce null no useState
  // inicial, então a primeira carga continua mostrando o esqueleto normal.
  const reloadLeads = () => {
    window.__VP_SB.sb.from('leads').select('*').order('date', { ascending: false })
      .then(({ data }) => setLeads(data || []));
  };
  React.useEffect(() => { reloadLeads(); }, []);

  const statuses = ["Todos", "Em qualificação", "Aguardando cotação", "Proposta enviada", "Negociação", "Convertido", "Sem retorno"];
  const allLeads = leads || [];
  const owners = ["Todos", ...Array.from(new Set(allLeads.filter(l => l.owner).map(l => l.owner))).sort()];

  const rows = allLeads.filter(l => {
    if (status !== "Todos" && l.status !== status) return false;
    if (owner !== "Todos" && l.owner !== owner) return false;
    if (search && !((l.building || "") + (l.contact || "") + (l.equip || "")).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = {
    total: allLeads.length,
    qualif: allLeads.filter(l => l.status === "Em qualificação").length,
    proposta: allLeads.filter(l => l.status === "Proposta enviada").length,
    valor: allLeads.reduce((a, l) => a + (l.value || 0), 0),
  };

  if (leads === null) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div className="page-head__l">
            <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
            <h1 className="page-head__title">Pipeline de Leads</h1>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--fg3)", fontSize: 13 }}>Carregando leads…</div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Leads</div>
          <h1 className="page-head__title">Pipeline de Leads</h1>
          <p className="page-head__sub">{allLeads.length} leads ativos · pipeline {fmtBRL(stats.valor)} · conversão média 27%</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(rows.map(l => ({ id:l.id, predio:l.building, contato:l.contact, cargo:l.role, telefone:l.phone, email:l.email, equipamento:l.equip, origem:l.origin, status:l.status, responsavel:l.owner, valor:l.value, prioridade:l.priority, proxima_acao:l.next_action || l.next, data:l.date })), 'leads.csv')}>Exportar</Button>
          {/* Removido o botão "Filtros" (era só um toast ecoando o estado dos
              filtros de status/responsável que já existem, visíveis e
              funcionais, logo abaixo — CTA redundante, achado #47). */}
          <Button variant="primary" icon="plus" onClick={() => setShowLead(true)}>Novo Lead</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Leads ativos" value={stats.total} sub="mês" delta={stats.total > 0 ? `+${stats.total}` : "0"} deltaDir="up" icon="flag"/>
        <KPI label="Em qualificação" value={stats.qualif} sub="hot leads" delta={`+${stats.qualif}`} deltaDir="up" icon="zap"/>
        <KPI label="Propostas no ar" value={stats.proposta} sub="aguardando" delta="0" deltaDir="up" icon="fileText"/>
        <KPI label="Valor pipeline" value={fmtBRL(stats.valor)} sub="potencial" delta="—" deltaDir="up" icon="dollar"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {statuses.map(s => (
            <button key={s} className={status === s ? "is-active" : ""} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="divider-v"/>
        <select className="input" style={{ width: 160, height: 28, fontSize: 12 }} value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar prédio, contato, equipamento…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>ID</th>
            <th>Lead / Prédio</th>
            <th>Contato</th>
            <th>Equipamento</th>
            <th>Origem</th>
            <th>Status</th>
            <th>Resp.</th>
            <th className="text-right">Valor</th>
            <th>Próx. Ação</th>
            <th></th>
          </tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 0", color: "var(--fg3)", fontSize: 13 }}>
                  {search || status !== "Todos" || owner !== "Todos"
                    ? "Nenhum lead encontrado com os filtros aplicados."
                    : "Nenhum lead cadastrado. Clique em \"Novo Lead\" para começar."}
                </td>
              </tr>
            ) : pageRows.map(l => (
              <tr key={l.id} onClick={() => { setSubsel(l); setRoute("lead-detail"); }}>
                <td><span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{l.id}</span></td>
                <td>
                  <div className="cell-main">{l.building}</div>
                  <div className="cell-sub">{fmtDate(l.date)}</div>
                </td>
                <td>
                  <div className="cell-main">{l.contact}</div>
                  <div className="cell-sub">{l.role} · {l.phone}</div>
                </td>
                <td><span style={{ fontSize: 12.5, color: "var(--fg2)" }}>{l.equip}</span></td>
                <td><Badge variant="outline">{l.origin}</Badge></td>
                <td><StatusBadge status={l.status}/></td>
                <td>
                  <div className="row gap-2">
                    <div className="avatar sm">{(l.owner || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                    <span style={{ fontSize: 12 }}>{l.owner || "—"}</span>
                  </div>
                </td>
                <td className="cell-money">{fmtBRL(l.value)}</td>
                <td>
                  <div style={{ fontSize: 12, color: "var(--fg1)", fontWeight: 500 }}>{l.next_action || l.next || "—"}</div>
                  <Badge variant={String(l.priority).toLowerCase() === "alta" ? "danger" : String(l.priority).toLowerCase() === "media" || l.priority === "Média" ? "warning" : "neutral"} style={{ marginTop: 4 }}>
                    {({ alta: "Alta", media: "Média", baixa: "Baixa" }[String(l.priority || "").toLowerCase()] || l.priority || "—")}
                  </Badge>
                </td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row sb" style={{ marginTop: 14, fontSize: 12, color: "var(--fg3)" }}>
        <span>Exibindo <b>{pageRows.length}</b> de <b>{rows.length}</b> leads</span>
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}/>
          <span className="mono">Pág. {page + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" icon="chevRight" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}/>
        </div>
      </div>

      {showLead && (
        <ModalNovoLead
          onClose={() => setShowLead(false)}
          onSaved={reloadLeads}
          onOpenFormulario={(lead) => {
            setShowLead(false);
            /* Formulário aceita { __prefillFromLead } no subsel e
               pré-preenche telefone/e-mail/observações + cliente (quando o
               Lead já tem cliente_id) — equipamento é sempre alocado lá
               dentro, nunca herdado do Lead. */
            setSubsel({ __prefillFromLead: lead });
            setRoute('formulario-elevador');
          }}
        />
      )}
    </div>
  );
}

/* ---------- LEAD DETAIL ---------- */
function LeadDetail({ lead, setRoute, setSubsel }) {
  const [creatingDossier, setCreatingDossier] = React.useState(false);
  const [showEditLead, setShowEditLead] = React.useState(false);

  if (!lead) {
    return <EmptyStateRedirect
      icon="flag"
      title="Nenhum lead selecionado"
      message="Selecione um lead da listagem para ver os detalhes, contato, histórico e próximos passos."
      ctaLabel="Ir para Listagem de Leads"
      onCta={() => setRoute("leads")}/>;
  }
  /* Cliente vinculado (CNPJ) — busca real via lead.cliente_id. Sem vínculo
     ainda → null, e a tela oferece "Abrir Formulário" pra completar lá
     (mesma busca por CNPJ, sem duplicar cliente). */
  const [cliente, setCliente] = React.useState(undefined); // undefined = carregando, null = sem vínculo
  React.useEffect(() => {
    let alive = true;
    if (!lead.cliente_id) { setCliente(null); return; }
    window.CadastrosClientesStore?.obter(lead.cliente_id).then((c) => { if (alive) setCliente(c || null); });
    return () => { alive = false; };
  }, [lead.cliente_id]);

  const abrirFormulario = () => {
    setSubsel({ __prefillFromLead: lead });
    setRoute('formulario-elevador');
  };

  /* Histórico real por lead: criação (intrínseca) + eventos do VPLog que
     têm alvo_id = lead.id. Sem dados → estado vazio honesto (não mais mock). */
  const [history, setHistory] = React.useState(null); // null = carregando
  const fmtHistTs = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const hasTime = typeof ts === "string" && ts.includes("T");
    return hasTime ? dateStr + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : dateStr;
  };
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const rows = [];
      if (lead.date) rows.push({ t: "Lead criado" + (lead.origin ? " via " + lead.origin : ""), who: lead.owner || "Sistema", ts: lead.date, icon: "plus" });
      try {
        const sb = window.__VP_SB && window.__VP_SB.sb;
        if (sb && lead.id != null) {
          const { data } = await sb.from("vp_logs").select("*").eq("alvo_id", String(lead.id)).order("criado_em", { ascending: false }).limit(50);
          (data || []).forEach((l) => rows.push({
            t: l.acao + (l.alvo ? " — " + l.alvo : ""),
            who: l.ator_nome + (l.ator_setor ? " · " + l.ator_setor : ""),
            ts: l.criado_em,
            icon: "activity",
          }));
        }
      } catch (e) { /* rastro best-effort — não quebra a tela */ }
      rows.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      if (alive) setHistory(rows);
    })();
    return () => { alive = false; };
  }, [lead.id]);

  const criarDossier = async () => {
    if (lead.status !== "Em qualificação" && lead.status !== "Aguardando cotação") {
      return window.toast('Lead já está avançado. Crie Dossier manualmente.', 'warning');
    }
    setCreatingDossier(true);
    try {
      const dossier = await window.__DOSSIER.criarDeDossier(lead);
      window.VPLog && window.VPLog.registrar({ modulo: "Comercial", acao: "Lead convertido em Dossiê da Obra", alvo: lead.building, alvo_id: lead.id, detalhe: { dossier_id: dossier.id } });
      window.toast('Dossier criado com sucesso! ID: ' + dossier.id, 'success');
      setSubsel?.(dossier.id);
      setRoute('dossier-obra');
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    } finally {
      setCreatingDossier(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("leads")}>Voltar para Leads</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{lead.id} · {lead.origin}</div>
          <h1 className="page-head__title">{lead.building}</h1>
          <p className="page-head__sub">
            {cliente ? `${cliente.razao_social}${cliente.cnpj ? ' · ' + (window.cadFmtDoc ? window.cadFmtDoc(cliente.cnpj) : cliente.cnpj) : ''}`
              : lead.equip || 'Sem cliente (CNPJ) vinculado ainda'}
          </p>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <StatusBadge status={lead.status}/>
            <Badge variant={String(lead.priority).toLowerCase() === "alta" ? "danger" : "warning"} dot>
              {({ alta: "Alta", media: "Média", baixa: "Baixa" }[String(lead.priority || "").toLowerCase()] || lead.priority)}
            </Badge>
            <span className="muted small">Última atualização: —</span>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="message" onClick={() => { const p = (lead.phone || '').replace(/\D/g,''); p ? window.open('https://wa.me/55'+p,'_blank') : window.toast('Telefone não cadastrado.','warning'); }}>WhatsApp</Button>
          <Button variant="outline" icon="mail" onClick={() => { lead.email ? window.open('mailto:'+lead.email) : window.toast('Email não cadastrado.','warning'); }}>Email</Button>
          <Button variant="outline" icon="edit" onClick={() => setShowEditLead(true)}>Editar Lead</Button>
          <Button variant="outline" icon="ruler" onClick={abrirFormulario}>Abrir Formulário</Button>
          <Button variant="primary" icon="zap" onClick={criarDossier} disabled={creatingDossier}>
            {creatingDossier ? 'Criando…' : 'Qualificar → Dossier'}
          </Button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card title="Cliente" sub="identificação — equipamento é alocado no Formulário">
            {cliente === undefined ? (
              <div className="muted small" style={{ padding: "8px 0" }}>Carregando…</div>
            ) : cliente ? (
              <div className="grid-3" style={{ gap: 24 }}>
                <KvBlock label="Razão social" value={cliente.razao_social}/>
                <KvBlock label="CNPJ" value={window.cadFmtDoc ? window.cadFmtDoc(cliente.cnpj) : cliente.cnpj} mono/>
                <KvBlock label="Valor estimado" value={fmtBRL(lead.value)} mono/>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <p className="vp-small muted" style={{ margin: 0 }}>
                  Este lead ainda não tem CNPJ/cliente vinculado.
                </p>
                <Button variant="outline" size="sm" icon="ruler" onClick={abrirFormulario} style={{ alignSelf: 'flex-start' }}>
                  Abrir Formulário e vincular cliente
                </Button>
              </div>
            )}
          </Card>

          <Card title="Histórico de Atividades" sub={history == null ? "carregando…" : history.length + (history.length === 1 ? " evento" : " eventos")}>
            {history == null ? (
              <div className="muted small" style={{ padding: "8px 0" }}>Carregando histórico…</div>
            ) : history.length === 0 ? (
              <div className="muted small" style={{ padding: "8px 0" }}>Nenhuma atividade registrada para este lead ainda.</div>
            ) : (
            <div className="timeline">
              {history.map((h, i) => (
                <div key={i} className={"timeline__row " + (i === 0 ? "current" : "done")}>
                  <div className="timeline__node"/>
                  <div>
                    <div className="timeline__title">{h.t}</div>
                    <div className="timeline__sub">por {h.who}</div>
                  </div>
                  <div className="timeline__meta">{fmtHistTs(h.ts)}</div>
                  <div className="timeline__rail"/>
                </div>
              ))}
            </div>
            )}
          </Card>

          <Card title="Próximo passo" sub="fluxo Lead → Formulário → Cotação">
            <div className="stack" style={{ gap: 10 }}>
              <SuggestedStep icon="ruler" label="Abrir Formulário e alocar equipamento(s)"
                sub={cliente ? 'Cliente já vinculado — abre pronto' : 'Ainda sem CNPJ — resolve lá dentro'}
                status="current"/>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Contato">
            <div className="row gap-3" style={{ marginBottom: 14 }}>
              <div className="avatar lg">{(lead.contact || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{lead.contact}</div>
                <div className="cell-sub">{lead.role}</div>
              </div>
            </div>
            <KvBlock label="Telefone" value={lead.phone} mono/>
            <KvBlock label="Email" value={lead.email} mono/>
            <div className="row gap-2" style={{ marginTop: 14 }}>
              <Button variant="secondary" size="sm" icon="message" onClick={() => { const p = (lead.phone || '').replace(/\D/g,''); p ? window.open('https://wa.me/55'+p,'_blank') : window.toast('Telefone não cadastrado.','warning'); }}>WhatsApp</Button>
              <Button variant="outline" size="sm" icon="mail" onClick={() => { lead.email ? window.open('mailto:'+lead.email) : window.toast('Email não cadastrado.','warning'); }}>Email</Button>
            </div>
          </Card>

          <Card title="Atribuição">
            <KvBlock label="Vendedor" value={lead.owner || '—'}/>
            <KvBlock label="Origem" value={lead.origin}/>
            {lead.value ? <KvBlock label="Comissão prevista" value={fmtBRL(lead.value * 0.04, { decimals: 0 }) + " (4%)"} mono/> : null}
          </Card>
        </div>
      </div>

      {showEditLead && (
        <ModalNovoLead
          lead={lead}
          onClose={() => setShowEditLead(false)}
          onSaved={(updatedLead, clienteAtualizado) => {
            setSubsel?.(updatedLead);
            // lead.cliente_id pode não mudar (só os DADOS do cliente
            // mudaram, ex.: razão social) — o efeito acima só refaz a busca
            // quando o id muda, então atualiza aqui direto pra não deixar
            // o card "Cliente" com dado velho até recarregar a página.
            if (clienteAtualizado) setCliente(clienteAtualizado);
          }}
        />
      )}
    </div>
  );
}

function KvBlock({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="up-eyebrow muted" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--fg1)", fontFamily: mono ? "var(--font-mono)" : "inherit", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function SuggestedStep({ icon, label, sub, status }) {
  const I = Icon[icon] || Icon.bolt;
  const stylesByStatus = {
    current: { background: "#FFFBE6", borderColor: "var(--vp-yellow)" },
    next:    { background: "#fff", borderColor: "var(--border-strong)" },
    future:  { background: "var(--vp-gray-50)", borderColor: "var(--border)", opacity: .7 },
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      border: "1px solid var(--border)",
      ...stylesByStatus[status]
    }}>
      <div style={{ width: 34, height: 34, background: status === "current" ? "#000" : "var(--vp-gray-100)", color: status === "current" ? "var(--vp-yellow)" : "var(--fg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <I size={18}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>{label}</div>
        <div className="cell-sub">{sub}</div>
      </div>
      <Icon.chevRight size={16} color="var(--fg3)"/>
    </div>
  );
}

/* ---------- FORMULÁRIOS (placeholder — estrutura interna vem em sessão futura) ---------- */
/* 15/08 — Elevador, Escada Rolante e Esteira Rolante deixaram de ser
   categorias/formulários separados: agora moram todos dentro do mesmo
   Formulário — Equipamento (reunião de vendedores, uma cotação pode ter
   vários tipos de equipamento juntos). O card único abaixo leva pro mesmo
   formulário; lá dentro o vendedor escolhe o tipo por card de unidade. */
const FE_CATEGORIAS = [
  { id: 'equipamento', label: 'Equipamento', icon: 'ruler', route: 'formulario-elevador', pronto: true, subLabel: 'Elevador · Escada Rolante · Esteira Rolante' },
  { id: 'mod-elevador', label: 'Modernização Elevador', icon: 'tool', pronto: false },
  { id: 'mod-er-es', label: 'Modernização Escadas e Esteiras', icon: 'tool', pronto: false },
  { id: 'maquina-tracao', label: 'Máquina de Tração', icon: 'grid', pronto: false },
  { id: 'quadro-comando', label: 'Quadro de Comando', icon: 'grid', pronto: false },
  { id: 'portas', label: 'Portas', icon: 'grid', pronto: false },
];

function FormulariosPage({ setRoute, setSubsel }) {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
          <h1 className="page-head__title">Formulários</h1>
          <p className="page-head__sub">Coleta de dados da obra e do equipamento, por categoria, antes de enviar para cotação.</p>
        </div>
      </div>
      <div className="grid-4" style={{ gap: 14 }}>
        {FE_CATEGORIAS.map((c) => (
          <Card key={c.id} title={c.label} sub={c.pronto ? (c.subLabel || 'Disponível') : 'Em breve'}
            style={!c.pronto ? { opacity: .55, cursor: 'not-allowed' } : { cursor: 'pointer' }}
            action={<Icon.chevRight/>}>
            <div
              onClick={() => { if (c.pronto) { setSubsel && setSubsel(null); setRoute(c.route); } }}
              style={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg2)', fontSize: 12.5 }}>
              {c.pronto ? 'Clique para preencher um novo formulário.' : 'Estrutura prevista para fase futura.'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LeadsPage, LeadDetail });
