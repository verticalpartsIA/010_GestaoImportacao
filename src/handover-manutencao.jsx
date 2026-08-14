/* ============================================================
   handover-manutencao.jsx — Gestão de Entrega e Pós-Venda
   Handover do equipamento, transição para Escamax
   ============================================================ */

function HandoverManutencaoPage() {
  const [projetos, setProjetos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);
  const [handover, setHandover] = React.useState(null);
  const [showNovoHandover, setShowNovoHandover] = React.useState(false);
  const [editandoChecklist, setEditandoChecklist] = React.useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await window.__VP_SB.sb.from('projetos').select('*').order('created_at', { ascending: false });
    setProjetos(data || []);
    setLoading(false);
  };

  React.useEffect(() => { reload(); }, []);

  const handleSelectProjeto = async (p) => {
    setSelected(p);
    if (window.HandoverManutencao) {
      const h = await window.HandoverManutencao.obterHandover(p.id);
      setHandover(h);
    }
  };

  const handleRegistrarHandover = async (dados) => {
    if (!selected || !window.HandoverManutencao) return;
    try {
      const h = await window.HandoverManutencao.registrarHandover(selected.id, selected.building, dados);
      setHandover(h);
      setShowNovoHandover(false);
      window.toast('Handover registrado com sucesso!', 'success');
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    }
  };

  const handleTransferirEscamax = async () => {
    if (!selected || !handover || !window.confirm('Confirmar transferência para Escamax?')) return;
    try {
      const h = await window.HandoverManutencao.transferirParaEscamax(selected.id);
      setHandover(h);
      window.toast('Projeto transferido para Escamax com sucesso!', 'success');
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    }
  };

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const comHandover = projetos.filter(p => p.handover).length;
  const transferidosEscamax = projetos.filter(p => p.handover?.escamax_transferido).length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Instalação & Entrega · Pós-venda</div>
          <h1 className="page-head__title">Handover & Manutenção</h1>
          <p className="page-head__sub">Entrega final, garantia e transição para Escamax (sistema de manutenção preventiva).</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="check" onClick={() => setShowNovoHandover(true)}>Registrar Handover</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Projetos entregues" value={String(comHandover)} sub="com handover registrado" icon="check"/>
        <KPI label="Em garantia" value={String(comHandover - transferidosEscamax)} sub="período ativo" icon="shield"/>
        <KPI label="Transferidos" value={String(transferidosEscamax)} sub="para Escamax" icon="arrow"/>
        <KPI label="Total de projetos" value={String(projetos.length)} sub="gerenciados" icon="home"/>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <Card title="Projetos" sub={`${projetos.length} no total`}>
          <div className="stack" style={{ gap: 12 }}>
            {projetos.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum projeto cadastrado.
              </div>
            )}
            {projetos.map((p) => {
              const h = p.handover;
              const statusIcon = h?.escamax_transferido ? '✅'
                : h ? '🔄' : '⏳';

              return (
                <div key={p.id} style={{
                  background: selected?.id === p.id ? "var(--vp-gray-50)" : "#fff",
                  border: "1px solid " + (selected?.id === p.id ? "#000" : "var(--border)"),
                  padding: 14,
                  cursor: "pointer",
                  position: "relative"
                }} onClick={() => handleSelectProjeto(p)}>
                  <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>
                  <div className="row sb" style={{ marginBottom: 8 }}>
                    <div>
                      <div className="cell-main" style={{ fontSize: 14 }}>{p.building}</div>
                      <div className="cell-sub">{p.id} · {p.projeto}</div>
                    </div>
                    <span style={{ fontSize: 20 }}>{statusIcon}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
                    Status: <b>{h?.escamax_transferido ? 'Transferido para Escamax'
                      : h ? 'Handover registrado'
                      : 'Aguardando handover'}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {selected ? (
          <Card title={`Handover & Pós-venda · ${selected.id}`} sub={selected.building}>
            {!handover ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: 6
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Nenhum handover registrado</div>
                <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 14 }}>
                  Registre a entrega do equipamento ao cliente para iniciar o período de garantia.
                </div>
                <Button variant="primary" onClick={() => setShowNovoHandover(true)}>
                  Registrar Handover Agora
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 14 }}>
                  <div className="row sb" style={{ marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Data de Entrega</div>
                      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                        {window.HandoverManutencao?.fmtData(handover.data_entrega)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Garantia</div>
                      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                        {handover.periodo_garantia_meses} meses
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: handover.escamax_transferido ? '#e0f2fe' : '#fef3c7',
                  border: '1px solid ' + (handover.escamax_transferido ? '#0284c7' : '#fbbf24'),
                  borderRadius: 6, padding: 12 }}>
                  <div className="row sb" style={{ alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {handover.escamax_transferido ? '✅ Transferido para Escamax'
                          : '⏳ Aguardando transferência para Escamax'}
                      </div>
                      {handover.escamax_transferido && (
                        <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 2 }}>
                          {window.HandoverManutencao?.fmtData(handover.data_transferencia_escamax)}
                        </div>
                      )}
                    </div>
                    {!handover.escamax_transferido && (
                      <Button variant="primary" size="sm" onClick={handleTransferirEscamax}>
                        Transferir Agora
                      </Button>
                    )}
                  </div>
                </div>

                <div style={{ background: 'var(--vp-gray-50)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    ✓ Checklist de Entrega ({window.HandoverManutencao?.getProgressoChecklist(handover.checklists_concluidos)}%)
                  </div>
                  <div className="progress" style={{ marginBottom: 12 }}>
                    <span style={{ width: window.HandoverManutencao?.getProgressoChecklist(handover.checklists_concluidos) + '%' }}/>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditandoChecklist(!editandoChecklist)}>
                    {editandoChecklist ? 'Ocultar' : 'Editar'} Checklist
                  </Button>

                  {editandoChecklist && (
                    <ModalEditarChecklist
                      handover={handover}
                      projectId={selected.id}
                      onSaved={(h) => setHandover(h)}
                      onCancel={() => setEditandoChecklist(false)}
                    />
                  )}
                </div>

                {handover.periodo_garantia_meses && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      Período de Garantia
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 8 }}>
                      Fim da garantia: {window.HandoverManutencao?.fmtData(handover.data_fim_garantia)}
                      {' · '}
                      <span style={{ fontWeight: 700 }}>
                        {window.HandoverManutencao?.tempoRestanteGarantia(handover.data_fim_garantia)} dias restantes
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg3)' }}>
                      📞 Suporte: {handover.contato_suporte}<br/>
                      📧 {handover.email_suporte}
                    </div>
                  </div>
                )}

                {handover.observacoes && (
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Observações</div>
                    <div style={{ fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5 }}>
                      {handover.observacoes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
            Selecione um projeto à esquerda para gerenciar seu handover e garantia.
          </div>
        )}
      </div>

      {showNovoHandover && selected && (
        <ModalNovoHandover
          projeto={selected}
          onSave={handleRegistrarHandover}
          onCancel={() => setShowNovoHandover(false)}
        />
      )}
    </div>
  );
}

function ModalNovoHandover({ projeto, onSave, onCancel }) {
  const [clienteNome, setClienteNome] = React.useState('');
  const [periodoGarantia, setPeriodoGarantia] = React.useState('12');
  const [contatoSuporte, setContatoSuporte] = React.useState('+55 11 xxxx-xxxx');
  const [emailSuporte, setEmailSuporte] = React.useState('suporte@verticalparts.com.br');
  const [observacoes, setObservacoes] = React.useState('');
  const [checklists, setChecklists] = React.useState([]);

  const save = () => {
    if (!clienteNome.trim()) return window.toast('Nome do cliente é obrigatório.', 'warning');
    onSave({
      clienteNome,
      periodoGarantia: parseInt(periodoGarantia),
      contatoSuporte,
      emailSuporte,
      observacoes,
      checklists,
    });
  };

  return (
    <Modal title="Registrar Handover" onClose={onCancel} width={580}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Registrar Handover</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Nome do cliente *</label>
          <input className="input" value={clienteNome}
            onChange={e => setClienteNome(e.target.value)} placeholder="Condomínio, Empresa…"/>
        </div>

        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Período de garantia (meses)</label>
            <input className="input" type="number" min="1" value={periodoGarantia}
              onChange={e => setPeriodoGarantia(e.target.value)}/>
          </div>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Contato de suporte</label>
            <input className="input" value={contatoSuporte}
              onChange={e => setContatoSuporte(e.target.value)} placeholder="+55 11 xxxx-xxxx"/>
          </div>
        </div>

        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Email de suporte</label>
          <input className="input" type="email" value={emailSuporte}
            onChange={e => setEmailSuporte(e.target.value)}/>
        </div>

        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={2} value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Notas sobre a entrega, pendências, etc."
            style={{ resize:'vertical' }}/>
        </div>
      </div>
    </Modal>
  );
}

function ModalEditarChecklist({ handover, projectId, onSaved, onCancel }) {
  const [checklistSelecionados, setChecklistSelecionados] = React.useState(
    new Set(handover.checklists_concluidos || [])
  );

  const save = async () => {
    try {
      const { error } = await window.__VP_SB.sb.from('projetos')
        .update({ handover: { ...handover, checklists_concluidos: Array.from(checklistSelecionados) } })
        .eq('id', projectId);
      if (error) throw error;
      onSaved({ ...handover, checklists_concluidos: Array.from(checklistSelecionados) });
      window.toast('Checklist atualizado!', 'success');
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    }
  };

  return (
    <Modal title="Editar Checklist de Entrega" onClose={onCancel} width={500}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Salvar</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {window.HandoverManutencao?.CHECKLIST_ENTREGA.map((item) => (
          <label key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', background: checklistSelecionados.has(item.id) ? 'var(--vp-gray-50)' : '#fff' }}>
            <input type="checkbox" checked={checklistSelecionados.has(item.id)}
              onChange={(e) => {
                const next = new Set(checklistSelecionados);
                if (e.target.checked) next.add(item.id);
                else next.delete(item.id);
                setChecklistSelecionados(next);
              }} style={{ cursor:'pointer' }}/>
            <span style={{ fontSize:13, flex:1 }}>{item.label}</span>
            <span style={{ fontSize:10, background:'var(--border)', color:'var(--fg3)', padding:'2px 6px', borderRadius:3 }}>
              {item.categoria}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

window.HandoverManutencaoPage = HandoverManutencaoPage;
