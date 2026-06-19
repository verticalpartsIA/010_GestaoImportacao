/* ============================================================
   rh-homologacao.jsx — Gestão de Parceiros Instaladores
   Validação de certificações e qualificações de segurança
   ============================================================ */

function RHHomologacaoPage() {
  const [montadores, setMontadores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);
  const [showNovo, setShowNovo] = React.useState(false);
  const [editingCert, setEditingCert] = React.useState(null);

  const reload = async () => {
    setLoading(true);
    const list = await window.RHHomologacao.listarMontadores();
    setMontadores(list);
    setLoading(false);
  };

  React.useEffect(() => { reload(); }, []);

  const handleSelectMontador = async (m) => {
    const full = await window.RHHomologacao.obterMontador(m.id);
    setSelected(full);
    setEditingCert(null);
  };

  const handleSaveCertificacao = async (chave, data) => {
    if (!selected) return;

    const updated = {
      ...selected,
      certificacoes: {
        ...(selected.certificacoes || {}),
        [chave]: { ...data, atualizado_em: new Date().toISOString() }
      }
    };

    try {
      await window.RHHomologacao.salvarMontador(updated);
      setSelected(updated);
      setEditingCert(null);
      window.toast('Certificação salva com sucesso!', 'success');
      reload();
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    }
  };

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const statusSummary = montadores.reduce((acc, m) => {
    const status = window.RHHomologacao.statusGeral(m);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Recursos Humanos</div>
          <h1 className="page-head__title">Homologação de Parceiros Instaladores</h1>
          <p className="page-head__sub">Validação de certificações de segurança: NR-10, NR-35, ASO, PCMSO, PGR.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo parceiro</Button>
        </div>
      </div>

      <div className="grid-5" style={{ marginBottom: 20 }}>
        <KPI label="Total de parceiros" value={String(montadores.length)} sub="instaladores" icon="users"/>
        <KPI label="Homologados" value={String(statusSummary.ok || 0)} sub="100% certificados" icon="check"/>
        <KPI label="Atenção" value={String((statusSummary.atencao || 0) + (statusSummary.incompleto || 0))} sub="certificações vencendo" icon="alert"/>
        <KPI label="Expirado" value={String(statusSummary.expirado || 0)} sub="certificações vencidas" icon="alertTriangle"/>
        <KPI label="Sem cadastro" value={String(statusSummary.vazio || 0)} sub="dados incompletos" icon="minus"/>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <Card title="Parceiros Instaladores" sub={`${montadores.length} registros`}>
          <div className="stack" style={{ gap: 12 }}>
            {montadores.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum parceiro cadastrado.
              </div>
            )}
            {montadores.map((m) => {
              const status = window.RHHomologacao.statusGeral(m);
              const statusLabel = status === 'ok' ? '✅ Homologado'
                : status === 'expirado' ? '❌ Expirado'
                : status === 'atencao' ? '⚠️ Atenção'
                : status === 'incompleto' ? '⚠️ Incompleto'
                : '—';

              return (
                <div key={m.id} style={{
                  background: selected?.id === m.id ? "var(--vp-gray-50)" : "#fff",
                  border: "1px solid " + (selected?.id === m.id ? "#000" : "var(--border)"),
                  padding: 14,
                  cursor: "pointer",
                  position: "relative"
                }} onClick={() => handleSelectMontador(m)}>
                  <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>
                  <div className="row sb" style={{ marginBottom: 8 }}>
                    <div>
                      <div className="cell-main" style={{ fontSize: 14 }}>{m.nome}</div>
                      <div className="cell-sub">{m.id} · {m.cnpj || '—'}</div>
                    </div>
                    <Badge variant={window.RHHomologacao.statusVariant(status)}>{statusLabel}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
                    {m.email || m.telefone || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {selected ? (
          <Card title={`Certificações · ${selected.nome}`} sub={`${selected.id} · ${selected.cnpj || '—'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(window.RHHomologacao.CERTIFICACOES).map(([chave, def]) => {
                const cert = selected.certificacoes?.[chave];
                const validacao = window.RHHomologacao.validarCertificacoes({ [chave]: cert });
                const status = validacao.expiradas.length > 0 ? 'expirado'
                  : validacao.vencendoEm30Dias.length > 0 ? 'atencao'
                  : cert && cert.data_validade ? 'ok' : 'falta';

                return (
                  <div key={chave} style={{
                    padding: 12,
                    border: '1px solid ' + (status === 'ok' ? '#10b981' : status === 'expirado' ? '#dc2626' : status === 'atencao' ? '#f59e0b' : 'var(--border)'),
                    background: status === 'ok' ? '#f0fdf4' : status === 'expirado' ? '#fef2f2' : status === 'atencao' ? '#fefce8' : '#fff',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <span style={{ fontSize: 16 }}>
                      {status === 'ok' ? '✅' : status === 'expirado' ? '❌' : status === 'atencao' ? '⚠️' : '⏳'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{def.label}</div>
                      {cert?.data_validade && (
                        <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                          Válido até {window.RHHomologacao.fmtData(cert.data_validade)}
                          {validacao.vencendoEm30Dias.length > 0 && validacao.vencendoEm30Dias[0].diasRestantes > 0 && (
                            <span style={{ color: '#f59e0b', marginLeft: 8 }}>· {validacao.vencendoEm30Dias[0].diasRestantes} dias</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" icon="edit" onClick={() => setEditingCert(chave)}>
                      {cert?.data_validade ? 'Editar' : 'Adicionar'}
                    </Button>
                  </div>
                );
              })}

              {editingCert && (
                <ModalEditarCertificacao
                  chave={editingCert}
                  certificacao={selected.certificacoes?.[editingCert]}
                  onSave={(data) => handleSaveCertificacao(editingCert, data)}
                  onCancel={() => setEditingCert(null)}
                />
              )}
            </div>
          </Card>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'60px 20px', textAlign:'center' }}>
            Selecione um parceiro à esquerda para gerenciar suas certificações.
          </div>
        )}
      </div>

      {showNovo && <ModalNovoMontador onClose={() => setShowNovo(false)} onSaved={reload}/>}
    </div>
  );
}

function ModalNovoMontador({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    nome: '', cnpj: '', email: '', telefone: '',
    endereco: '', contato: '',
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nome.trim()) return window.toast('Nome é obrigatório.', 'warning');

    setSaving(true);
    try {
      await window.RHHomologacao.salvarMontador({
        ...f,
        certificacoes: {}
      });
      window.toast('Parceiro criado com sucesso!', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fld = (label, key, type = 'text', ph = '') => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      <input className="input" type={type} value={f[key]}
        onChange={e => set(key, e.target.value)} placeholder={ph}/>
    </div>
  );

  return (
    <Modal title="Novo Parceiro Instalador" onClose={onClose} width={540}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Criar parceiro'}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Nome da empresa *', 'nome', 'text', 'Empresa de Instalação XYZ')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('CNPJ', 'cnpj', 'text', '00.000.000/0000-00')}
          {fld('Contato', 'contato', 'text', 'Nome do responsável')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Email', 'email', 'email', 'contato@empresa.com')}
          {fld('Telefone', 'telefone', 'tel', '(11) 99999-9999')}
        </div>
        {fld('Endereço', 'endereco', 'text', 'Rua, número, cidade')}
      </div>
    </Modal>
  );
}

function ModalEditarCertificacao({ chave, certificacao, onSave, onCancel }) {
  const [data_validade, setDataValidade] = React.useState(
    certificacao?.data_validade ? certificacao.data_validade.slice(0, 10) : ''
  );
  const [numero_registro, setNumeroRegistro] = React.useState(certificacao?.numero_registro || '');
  const [observacoes, setObservacoes] = React.useState(certificacao?.observacoes || '');

  const save = () => {
    if (!data_validade) return window.toast('Data de validade é obrigatória.', 'warning');
    onSave({ data_validade, numero_registro, observacoes });
  };

  return (
    <Modal title={`Editar: ${window.RHHomologacao.CERTIFICACOES[chave].label}`} onClose={onCancel} width={480}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Salvar</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Data de validade *</label>
          <input className="input" type="date" value={data_validade}
            onChange={e => setDataValidade(e.target.value)}/>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Número de registro / certificado</label>
          <input className="input" value={numero_registro}
            onChange={e => setNumeroRegistro(e.target.value)}
            placeholder="Ex: 123456"/>
        </div>
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={2} value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Notas adicionais sobre a certificação"
            style={{ resize:'vertical' }}/>
        </div>
      </div>
    </Modal>
  );
}

window.RHHomologacaoPage = RHHomologacaoPage;
