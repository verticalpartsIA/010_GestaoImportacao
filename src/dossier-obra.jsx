/* ============================================================
   dossier-obra.jsx — Tela central do Dossier da Obra
   Mostra: histórico, documentos, responsáveis, pendências, próximas ações
   ============================================================ */

const DOSSIER_STATUS_COLOR = {
  'Lead qualificado': '#999',
  'Dossier criado': '#0066cc',
  'Análise técnica': '#0066cc',
  'Precificação': '#ff9900',
  'Proposta enviada': '#ff9900',
  'Contrato assinado': '#00aa00',
  'Importação': '#0066cc',
  'Homologação instalador': '#ff9900',
  'Instalação': '#ff6600',
  'DataBook': '#00aa00',
  'Entregue': '#00aa00',
  'Manutenção preventiva': '#0066cc',
};

/* ---------- Status de Obras — visão consolidada de todos os Dossiês ---------- */
function ObrasStatusPage({ setRoute, setSubsel }) {
  const [obras, setObras] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFiltro, setStatusFiltro] = React.useState('Todos');
  const statusFlow = (window.__DOSSIER && window.__DOSSIER.STATUS_FLOW) || [];
  const statuses = ['Todos', ...statusFlow];

  const reload = () => {
    setLoading(true);
    window.__DOSSIER.listar()
      .then((data) => setObras(data || []))
      .catch((e) => window.toast('Erro ao carregar obras: ' + e.message, 'error'))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { reload(); }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const rows = obras.filter((o) => statusFiltro === 'Todos' || o.status_master === statusFiltro);
  const abrirDossier = (o) => { setSubsel && setSubsel(o.id); setRoute('dossier-obra'); };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Status de Obras</div>
          <h1 className="page-head__title">Status de Obras</h1>
          <p className="page-head__sub">Visão consolidada de todas as obras em andamento — onde cada uma está parada e quem é o responsável.</p>
        </div>
      </div>

      <div className="tbar">
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {statuses.map((s) => (
            <button key={s} className={statusFiltro === s ? 'is-active' : ''} onClick={() => setStatusFiltro(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Obra Nº</th>
            <th>Prédio / Obra</th>
            <th>Cliente</th>
            <th>Equipamento</th>
            <th>Local</th>
            <th>Status</th>
            <th>Criado em</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
                Nenhuma obra encontrada.
              </td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} onClick={() => abrirDossier(o)} style={{ cursor: 'pointer' }}>
                <td><span className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{o.numero_cotacao != null ? window.MasterIdEngine.etapaId('obra', o.numero_cotacao) : o.id}</span></td>
                <td className="cell-main">{o.building_name || '—'}</td>
                <td>{o.client_name || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.equip_type || '—'}</td>
                <td>{o.city && o.state ? `${o.city}, ${o.state}` : '—'}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600, color: DOSSIER_STATUS_COLOR[o.status_master] || '#666',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOSSIER_STATUS_COLOR[o.status_master] || '#666' }}/>
                    {o.status_master || '—'}
                  </span>
                </td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DOSSIER_TAB_LABEL = {
  'visao-geral': 'Visão Geral', documentos: 'Documentos', instalacao: 'Instalação',
  equipamentos: 'Equipamentos', 'cronograma-instalacao': 'Cronograma de Instalação',
  pendencias: 'Pendências', responsaveis: 'Responsáveis', historico: 'Histórico',
};

function DossierObraPage({ dossierId, setRoute }) {
  const [dossier, setDossier] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  /* Aba inicial vem da URL quando é deep link (ex.: .../dossier-obra/DOS-M034/documentos);
     senão cai no padrão. */
  const [activeTab, setActiveTab] = React.useState(() =>
    (window.VpRouter && window.VpRouter.parseLocation().tab) || 'visao-geral');
  const [modalOpen, setModalOpen] = React.useState(null);

  React.useEffect(() => {
    carregarDossier();
  }, [dossierId]);

  /* Espelha a aba ativa no 3º segmento da URL — replace (não push) pra não
     lotar o histórico do navegador a cada clique de aba. Roda independente
     do efeito de sincronização de rota/subsel em app.jsx (que não reage a
     mudança de aba), então não há corrida entre os dois. */
  React.useEffect(() => {
    if (!window.VpRouter || !dossierId) return;
    window.VpRouter.navigate('dossier-obra', dossierId, activeTab, { replace: true });
  }, [dossierId, activeTab]);

  /* Título da aba do navegador some "· VP Gestão" genérico e mostra onde o
     usuário realmente está: nome da obra + aba ativa (app.jsx pula o título
     genérico pra esta rota — ver guard em app.jsx). */
  React.useEffect(() => {
    const nomeObra = (dossier && (dossier.client_name || dossier.building_name)) || 'Dossiê da Obra';
    document.title = `${nomeObra} · ${DOSSIER_TAB_LABEL[activeTab] || 'Visão Geral'}`;
  }, [dossier, activeTab]);

  const carregarDossier = async () => {
    try {
      setLoading(true);
      const data = await window.__DOSSIER.obter(dossierId);
      setDossier(data);
    } catch (e) {
      window.toast('Erro ao carregar Dossier: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}>⏳ Carregando...</div>;
  }

  if (!dossier) {
    return <div style={{ padding: 32, textAlign: 'center' }}>❌ Dossier não encontrado</div>;
  }

  const statusColor = (status) => DOSSIER_STATUS_COLOR[status] || '#666';

  const indicePossivel = window.__DOSSIER.STATUS_FLOW.indexOf(dossier.status_master);
  const progressoPct = ((indicePossivel + 1) / window.__DOSSIER.STATUS_FLOW.length) * 100;

  return (
    <div style={{ padding: '24px' }}>
      {/* ---- HEADER DO DOSSIER ---- */}
      <div style={{
        background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '8px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{dossier.building_name}</div>
            {dossier.numero_cotacao != null && (
              <div className="mono" style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                Obra Nº {window.MasterIdEngine.etapaId('obra', dossier.numero_cotacao)}
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              Cliente: <b>{dossier.client_name}</b>
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              {dossier.city && dossier.state ? `${dossier.city}, ${dossier.state}` : 'Localização não informada'}
              {dossier.equip_type && ` · ${dossier.equip_type}`}
            </div>
            {dossier.propostaVinculada ? (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 12 }}>
                🔗 Vinculado à Proposta <b>{dossier.propostaVinculada.numero_documento}</b> ({dossier.propostaVinculada.status})
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                Sem Proposta correspondente no sistema (obra órfã)
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Dossier ID</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{dossier.id}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>Criado em {new Date(dossier.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        {/* ---- BARRA DE PROGRESSO ---- */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Progresso do projeto</span>
            <span style={{ fontWeight: 600 }}>{Math.round(progressoPct)}%</span>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ background: '#ffff00', height: '100%', width: progressoPct + '%', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* ---- STATUS MESTRE ---- */}
      <div style={{
        background: '#f5f5f5',
        padding: '16px 20px',
        borderRadius: '6px',
        marginBottom: '24px',
        borderLeft: `4px solid ${statusColor(dossier.status_master)}`
      }}>
        <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Status Mestre</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(dossier.status_master) }}>
          {dossier.status_master}
        </div>
      </div>

      {/* ---- TABS ---- */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid #ddd',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'visao-geral', label: '📊 Visão Geral' },
          { id: 'documentos', label: '📄 Documentos' },
          { id: 'instalacao', label: '🛠️ Instalação' },
          { id: 'equipamentos', label: '🏢 Equipamentos' },
          { id: 'cronograma-instalacao', label: '🏗️ Cronograma de Instalação' },
          { id: 'pendencias', label: '⚠️ Pendências' },
          { id: 'responsaveis', label: '👥 Responsáveis' },
          { id: 'historico', label: '📜 Histórico' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #0066cc' : 'none',
              color: activeTab === tab.id ? '#0066cc' : '#666',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- CONTEÚDO DAS TABS ---- */}
      <div>
        {activeTab === 'visao-geral' && <TabVisaoGeral dossier={dossier} setModalOpen={setModalOpen} />}
        {activeTab === 'documentos' && <TabDocumentos dossier={dossier} reload={carregarDossier} />}
        {activeTab === 'instalacao' && <TabInstalacao dossier={dossier} reload={carregarDossier} />}
        {activeTab === 'equipamentos' && <TabEquipamentos dossier={dossier} />}
        {activeTab === 'cronograma-instalacao' && <TabCronogramaInstalacao dossier={dossier} />}
        {activeTab === 'pendencias' && <TabPendencias dossier={dossier} setModalOpen={setModalOpen} />}
        {activeTab === 'responsaveis' && <TabResponsaveis dossier={dossier} setModalOpen={setModalOpen} />}
        {activeTab === 'historico' && <TabHistorico dossier={dossier} />}
      </div>

      {/* ---- MODAIS ---- */}
      {modalOpen === 'adionar-pendencia' && (
        <ModalAdicionarPendencia
          dossierId={dossier.id}
          onClose={() => setModalOpen(null)}
          onSaved={() => { setModalOpen(null); carregarDossier(); }}
        />
      )}
      {modalOpen === 'analise-tecnica' && (
        <Modal title="Análise Técnica" onClose={() => setModalOpen(null)} width={900}>
          <AnaliseTecnicaWizard
            dossierId={dossier.id}
            dossier={dossier}
            onClose={() => setModalOpen(null)}
            onAprovada={() => { setModalOpen(null); carregarDossier(); }}
          />
        </Modal>
      )}
      {modalOpen === 'avancar-status' && (
        <ModalAvancarStatus
          dossier={dossier}
          onClose={() => setModalOpen(null)}
          onSaved={() => { setModalOpen(null); carregarDossier(); }}
        />
      )}
    </div>
  );
}

function TabVisaoGeral({ dossier, setModalOpen }) {
  const pendenciasAtivas = dossier.pendencias?.filter(p => !p.resolved_at) || [];
  const pendenciaBloqueante = pendenciasAtivas.some(p => p.bloqueante);
  const documentsCount = dossier.documentos?.length || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* CARDS DE STATUS */}
      <div style={{
        background: '#f0f8ff',
        border: '1px solid #0066cc',
        borderRadius: 6,
        padding: 16,
        gridColumn: '1 / -1'
      }}>
        <div style={{ fontSize: 12, color: '#0066cc', textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Situação</div>
        <div style={{ fontSize: 14 }}>
          {pendenciaBloqueante ? (
            <><b style={{ color: '#c00' }}>BLOQUEADO</b> — Pendência bloqueante resolvida</>
          ) : pendenciasAtivas.length > 0 ? (
            <><b style={{ color: '#ff6600' }}>{pendenciasAtivas.length} PENDÊNCIAS</b> — Aguardando ações</>
          ) : (
            <><b style={{ color: '#00aa00' }}>SEM BLOQUEIOS</b> — Próximo passo liberado</>
          )}
        </div>
      </div>

      {/* ANÁLISE TÉCNICA */}
      <div style={{
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 16
      }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Análise Técnica</div>
        {(() => {
          const at = dossier.analiseTecnica;
          const statusLabel = !at ? 'Não iniciada'
            : at.status === 'aprovada' ? 'Aprovada'
            : at.status === 'completa' ? 'Completa (aguardando aprovação)'
            : at.status === 'pendente_cliente' ? 'Pendente do cliente'
            : 'Rascunho';
          const statusColorAt = !at ? '#999' : at.status === 'aprovada' ? '#00aa00' : '#ff9900';
          return (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: statusColorAt }}>{statusLabel}</div>
              <Button variant={at?.status === 'aprovada' ? 'outline' : 'primary'} size="small" onClick={() => setModalOpen('analise-tecnica')}>
                {!at ? 'Iniciar Análise Técnica' : at.status === 'aprovada' ? 'Ver Análise Técnica' : 'Continuar Análise Técnica'}
              </Button>
            </>
          );
        })()}
      </div>

      {/* PRÓXIMO PASSO */}
      <div style={{
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 16
      }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Próximo Passo</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {dossier.status_master}
        </div>
        <Button variant="primary" size="small" onClick={() => setModalOpen('avancar-status')}>
          Avançar Etapa
        </Button>
      </div>

      {/* DOCUMENTOS */}
      <div style={{
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 16
      }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Documentos</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#0066cc', marginBottom: 8 }}>{documentsCount}</div>
        <Button variant="outline" size="small">
          Ver Documentos →
        </Button>
      </div>

      {/* RESPONSÁVEIS */}
      <div style={{
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 16
      }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Responsáveis</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {dossier.responsaveis && dossier.responsaveis.length > 0 ? (
            dossier.responsaveis.map(r => (
              <div key={r.id} style={{ marginBottom: 6 }}>
                <b>{r.etapa}</b>: {r.responsavel || '—'}
              </div>
            ))
          ) : (
            <div style={{ color: '#999' }}>Nenhum responsável atribuído</div>
          )}
        </div>
      </div>

      {/* PENDÊNCIAS */}
      <div style={{
        background: '#fff5f0',
        border: '1px solid #ff9900',
        borderRadius: 6,
        padding: 16,
        gridColumn: '1 / -1'
      }}>
        <div style={{ fontSize: 12, color: '#ff6600', textTransform: 'uppercase', marginBottom: 8 }}>Pendências Ativas</div>
        {pendenciasAtivas.length > 0 ? (
          <div style={{ fontSize: 13 }}>
            {pendenciasAtivas.slice(0, 3).map(p => (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{p.bloqueante ? '🔴' : '🟡'}</span>
                  <span>{p.descricao}</span>
                </div>
              </div>
            ))}
            {pendenciasAtivas.length > 3 && (
              <div style={{ color: '#666', marginTop: 8 }}>... +{pendenciasAtivas.length - 3} mais</div>
            )}
          </div>
        ) : (
          <div style={{ color: '#999' }}>Sem pendências bloqueantes</div>
        )}
        <Button variant="outline" size="small" style={{ marginTop: 12 }} onClick={() => alert('Adicionar pendência')}>
          + Adicionar Pendência
        </Button>
      </div>
    </div>
  );
}

/* Avançar Etapa — o botão existia como stub ("Fluxo de transição a
   implementar") desde antes; window.__DOSSIER.atualizarStatus() sempre
   funcionou, só faltava uma tela chamando ele pras etapas depois da
   Precificação (única que já tinha um caminho real, via aprovação da
   Análise Técnica). Sugere o próximo status da sequência por padrão, mas
   deixa escolher qualquer um — a obra real às vezes pula etapa formal
   (mesmo comportamento já assumido em gatilhos-engine.js). */
function ModalAvancarStatus({ dossier, onClose, onSaved }) {
  const FLOW = window.__DOSSIER.STATUS_FLOW;
  const indiceAtual = FLOW.indexOf(dossier.status_master);
  const sugestao = indiceAtual >= 0 && indiceAtual < FLOW.length - 1 ? FLOW[indiceAtual + 1] : dossier.status_master;
  const [novoStatus, setNovoStatus] = React.useState(sugestao);
  const [notas, setNotas] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    if (novoStatus === dossier.status_master) return window.toast?.('Escolha uma etapa diferente da atual.', 'warning');
    setSaving(true);
    try {
      await window.__DOSSIER.atualizarStatus(dossier.id, novoStatus, notas);
      window.toast?.(`Status atualizado para "${novoStatus}".`, 'success');
      onSaved();
    } catch (e) {
      window.toast?.('Erro: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Avançar Etapa" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          Etapa atual: <b>{dossier.status_master}</b>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Nova etapa</label>
          <select className="input" value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)}>
            {FLOW.map((s) => <option key={s} value={s}>{s}{s === sugestao ? ' (próxima)' : ''}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observação (opcional)</label>
          <textarea className="input" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="ex.: instalador iniciou a montagem em campo hoje"/>
        </div>
      </div>
    </Modal>
  );
}

/* Tipos de documento exigidos por obra. Alvará é condicional (opcional). */
const TIPOS_DOC_OBRA = [
  { tipo: 'ART', label: 'ART (CREA)', obrigatorio: true },
  { tipo: 'Termo de Vistoria', label: 'Termo de Vistoria', obrigatorio: true },
  { tipo: 'DataBook', label: 'DataBook (Ebook técnico)', obrigatorio: true },
  { tipo: 'Termo de Entrega', label: 'Termo de Entrega Final', obrigatorio: true },
  { tipo: 'Alvará', label: 'Alvará', obrigatorio: false },
  { tipo: 'Contrato Instalador', label: 'Contrato VerticalParts x Parceiro Instalador', obrigatorio: false },
  { tipo: 'NRs', label: 'NRs (NR-10/NR-35 do parceiro instalador)', obrigatorio: false },
  { tipo: 'ASO', label: 'ASO (Atestado de Saúde Ocupacional)', obrigatorio: false },
  { tipo: 'PCMSO/PGR', label: 'PCMSO/PGR', obrigatorio: false },
  { tipo: 'Cronograma', label: 'Cronograma de compra, importação e montagem', obrigatorio: false },
];

function TabDocumentos({ dossier, reload }) {
  const [uploading, setUploading] = React.useState(null);
  const docs = dossier.documentos || [];
  const byType = {};
  docs.forEach(d => { (byType[d.tipo] = byType[d.tipo] || []).push(d); });

  const upload = async (tipo, file) => {
    if (!file) return;
    /* Valor do custo real (23/08, Gelson) — só pedido pra ART hoje, onde
       existe custo de verdade associado. window.prompt é pragmático aqui;
       se algum dia isso precisar de mais campos junto, vira um modal. */
    let valor = null;
    if (tipo === 'ART') {
      const resp = window.prompt('Valor da ART (R$) — opcional, deixe em branco se não souber agora:');
      if (resp && resp.trim() && !isNaN(Number(resp.replace(',', '.')))) valor = Number(resp.replace(',', '.'));
    }
    setUploading(tipo);
    try {
      await window.__DOSSIER.anexarDocumento({ dossierId: dossier.id, tipo, file, valor });
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Documentos', acao: 'Documento anexado — ' + tipo, alvo: dossier.building_name, alvo_id: dossier.id });
      window.toast(tipo + ' anexado.', 'success');
      await (reload && reload());
    } catch (e) {
      window.toast('Erro ao anexar: ' + (e.message || e), 'error');
    } finally {
      setUploading(null);
    }
  };

  const obrig = TIPOS_DOC_OBRA.filter(t => t.obrigatorio);
  const prontos = obrig.filter(t => (byType[t.tipo] || []).length > 0).length;
  const extras = Object.keys(byType).filter(t => !TIPOS_DOC_OBRA.some(x => x.tipo === t));
  const rowBox = { border: '1px solid #ddd', borderRadius: 6, padding: 14, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start' };
  const uploadBtn = { cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0066cc', border: '1px solid #0066cc', borderRadius: 4, padding: '6px 12px', whiteSpace: 'nowrap' };

  return (
    <div>
      <div style={{ background: '#f5f7fa', border: '1px solid #dde3ea', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
        Checklist da obra — {prontos}/{obrig.length} documentos obrigatórios prontos
      </div>
      {TIPOS_DOC_OBRA.map(t => {
        const items = byType[t.tipo] || [];
        const pronto = items.length > 0;
        const mark = pronto ? '✓' : (t.obrigatorio ? '○' : '–');
        const markColor = pronto ? '#00aa00' : (t.obrigatorio ? '#cc7700' : '#999');
        return (
          <div key={t.tipo} style={rowBox}>
            <div style={{ fontSize: 18, color: markColor, fontWeight: 700, width: 20, textAlign: 'center' }}>{mark}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}{!t.obrigatorio && <span style={{ color: '#999', fontWeight: 400 }}> · opcional</span>}</div>
              {items.length === 0 ? (
                <div style={{ fontSize: 12, color: markColor, marginTop: 2 }}>{t.obrigatorio ? 'Pendente' : 'Não anexado (quando aplicável)'}</div>
              ) : items.map(d => (
                <div key={d.id} style={{ fontSize: 12, marginTop: 4 }}>
                  {d.arquivo_url
                    ? <a href={d.arquivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', fontWeight: 600 }}>⬇ {d.nome || t.label}</a>
                    : <span style={{ fontWeight: 600 }}>{d.nome || t.label}</span>}
                  <span style={{ color: '#999', marginLeft: 8 }}>v{d.versao} · {d.status}{d.data_criacao ? ' · ' + d.data_criacao : ''}</span>
                </div>
              ))}
            </div>
            <label style={{ ...uploadBtn, opacity: uploading === t.tipo ? 0.6 : 1 }}>
              {uploading === t.tipo ? 'Enviando…' : (items.length ? 'Nova versão' : 'Anexar')}
              <input type="file" style={{ display: 'none' }} disabled={uploading === t.tipo}
                onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; upload(t.tipo, f); }} />
            </label>
          </div>
        );
      })}
      {extras.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Outros documentos vinculados</div>
          {extras.map(tipo => (byType[tipo] || []).map(d => (
            <div key={d.id} style={{ fontSize: 12, marginBottom: 6 }}>
              <b>{tipo}:</b> {d.arquivo_url ? <a href={d.arquivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>{d.nome || tipo}</a> : (d.nome || tipo)} <span style={{ color: '#999' }}>· {d.status}</span>
            </div>
          )))}
        </div>
      )}

      <TermoEntregaPanel dossier={dossier} reload={reload}/>
    </div>
  );
}

/* ---- Termo de Entrega — assinatura digital ----
   Gera o link público (/termo-entrega/<token>) pro cliente assinar sozinho
   (self_service) ou pro supervisor + cliente assinarem juntos no mesmo
   celular (presencial). Ao concluir, o assinador (termo-entrega-store.js)
   já anexa o PDF em dossier_documentos com tipo:'Termo de Entrega', então
   o checklist acima marca ✓ sozinho — esse painel só cuida de gerar/copiar
   o link e mostrar o status atual. */
function TermoEntregaPanel({ dossier, reload }) {
  const [modo, setModo] = React.useState('self_service');
  const [gerando, setGerando] = React.useState(false);
  const [link, setLink] = React.useState(null);
  const termo = dossier.termo_entrega || null;

  const gerarLink = async () => {
    setGerando(true);
    try {
      const url = await window.TermoEntregaStore.gerarLink(dossier.id, modo);
      setLink(url);
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Documentos', acao: 'Link do Termo de Entrega gerado — ' + modo, alvo: dossier.building_name, alvo_id: dossier.id });
      await (reload && reload());
    } catch (e) {
      window.toast?.('Erro ao gerar link: ' + (e.message || e), 'error');
    } finally {
      setGerando(false);
    }
  };

  const copiar = (url) => {
    navigator.clipboard?.writeText(url);
    window.toast?.('Link copiado.', 'success');
  };

  return (
    <div style={{ marginTop: 20, background: '#f5f7fa', border: '1px solid #dde3ea', borderRadius: 6, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Termo de Entrega — assinatura digital</div>

      {termo?.status === 'concluido' ? (
        <div style={{ fontSize: 12.5, color: '#00aa00' }}>
          ✓ Assinado em {termo.concluido_em ? new Date(termo.concluido_em).toLocaleString('pt-BR') : '—'}
          {termo.assinaturas?.cliente && <span> · Cliente: {termo.assinaturas.cliente.nome}</span>}
          {termo.assinaturas?.supervisor && <span> · Supervisor: {termo.assinaturas.supervisor.nome}</span>}
        </div>
      ) : (
        <>
          {termo?.status === 'pendente' && (
            <div style={{ fontSize: 12, color: '#cc7700', marginBottom: 10 }}>
              Aguardando assinatura{termo.modo === 'presencial' ? ' (cliente + supervisor)' : ' do cliente'} —
              gerado em {termo.gerado_em ? new Date(termo.gerado_em).toLocaleString('pt-BR') : '—'}.
              {termo.assinaturas?.cliente && <span> Cliente já assinou.</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={modo} onChange={(e) => setModo(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="self_service">Self-service — cliente assina sozinho pelo link</option>
              <option value="presencial">Presencial — cliente + supervisor assinam juntos</option>
            </select>
            <Button variant="primary" size="sm" onClick={gerarLink} disabled={gerando}>
              {gerando ? 'Gerando…' : (termo ? 'Gerar novo link' : 'Gerar link')}
            </Button>
          </div>
          {dossier.termo_entrega_token && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" readOnly value={link || window.TermoEntregaStore.publicUrl(dossier.termo_entrega_token)} style={{ flex: 1, fontSize: 12 }}/>
              <Button variant="outline" size="sm" onClick={() => copiar(link || window.TermoEntregaStore.publicUrl(dossier.termo_entrega_token))}>Copiar</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Instalação (issue #9, Fase 1): checklist de obra pronta + vistorias ---------- */
/* ---- Equipamentos da Obra ----
   Pedido do usuário 19/08, a partir da planilha manual de Instalações do
   Mauricio: nº de série, ART, alvará (instalação/funcionamento) com datas
   reais, prazo, previsão × real, chegada de material — nada disso
   existia estruturado em lugar nenhum antes. parceiro_instalador_id
   sempre aponta pro cadastro único (Cadastros › Instaladores), nunca
   texto livre. */
const EO_STATUS_DOC = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'solicitada', label: 'Solicitada' },
  { value: 'em_processo', label: 'Em processo' },
  { value: 'assinada', label: 'Assinada' },
  { value: 'emitido', label: 'Emitido' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'nao_precisa', label: 'Não precisa' },
];

function EOField({ label, children }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted" style={{ fontSize: 10 }}>{label}</label>
      {children}
    </div>
  );
}

function EquipamentoCard({ equip, parceiros, onSalvar, onExcluir }) {
  const [aberto, setAberto] = React.useState(false);
  const [f, setF] = React.useState(equip);
  const [salvando, setSalvando] = React.useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const salvar = async () => {
    setSalvando(true);
    try { await onSalvar(equip.id, f); window.toast?.('Equipamento salvo.', 'success'); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, background: '#fff' }}>
      <div className="row sb" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => setAberto((v) => !v)}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <Icon.chevRight size={12} style={{ transform: aberto ? 'rotate(90deg)' : 'none' }}/>
          <b style={{ fontSize: 13 }}>{equip.numero_serie || 'Sem nº de série'}</b>
          <span className="small muted">{equip.tipo || '—'}</span>
        </div>
        <Button variant="ghost" size="sm" icon="trash" onClick={(e) => { e.stopPropagation(); onExcluir(equip.id); }}/>
      </div>
      {aberto && (
        <div style={{ padding: '4px 14px 16px' }}>
          <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Nº de série"><input className="input" value={f.numero_serie || ''} onChange={set('numero_serie')}/></EOField>
            <EOField label="Tipo"><input className="input" value={f.tipo || ''} onChange={set('tipo')} placeholder="Elevador, Escada..."/></EOField>
            <EOField label="Descrição"><input className="input" value={f.descricao || ''} onChange={set('descricao')}/></EOField>
          </div>
          <div className="grid-2" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Empresa de montagem (Cadastros › Instaladores)">
              <select className="input" value={f.parceiro_instalador_id || ''} onChange={set('parceiro_instalador_id')}>
                <option value="">— nenhuma —</option>
                {parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.id})</option>)}
              </select>
            </EOField>
            <EOField label="Vistoriador"><input className="input" value={f.vistoriador || ''} onChange={set('vistoriador')}/></EOField>
          </div>

          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>ART</div>
          <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Status">
              <select className="input" value={f.art_status || 'pendente'} onChange={set('art_status')}>
                {EO_STATUS_DOC.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </EOField>
            <EOField label="Início do processo"><input className="input" type="date" value={f.art_data_inicio || ''} onChange={set('art_data_inicio')}/></EOField>
            <EOField label="Término"><input className="input" type="date" value={f.art_data_termino || ''} onChange={set('art_data_termino')}/></EOField>
          </div>

          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Alvará de Instalação</div>
          <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Status">
              <select className="input" value={f.alvara_instalacao_status || 'pendente'} onChange={set('alvara_instalacao_status')}>
                {EO_STATUS_DOC.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </EOField>
            <EOField label="Início do processo"><input className="input" type="date" value={f.alvara_instalacao_inicio || ''} onChange={set('alvara_instalacao_inicio')}/></EOField>
            <EOField label="Término"><input className="input" type="date" value={f.alvara_instalacao_termino || ''} onChange={set('alvara_instalacao_termino')}/></EOField>
          </div>

          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Alvará de Funcionamento</div>
          <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Status">
              <select className="input" value={f.alvara_funcionamento_status || 'pendente'} onChange={set('alvara_funcionamento_status')}>
                {EO_STATUS_DOC.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </EOField>
            <EOField label="Início do processo"><input className="input" type="date" value={f.alvara_funcionamento_inicio || ''} onChange={set('alvara_funcionamento_inicio')}/></EOField>
            <EOField label="Término"><input className="input" type="date" value={f.alvara_funcionamento_termino || ''} onChange={set('alvara_funcionamento_termino')}/></EOField>
          </div>

          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Prazo de instalação</div>
          <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Prazo (dias)"><input className="input" type="number" value={f.prazo_instalacao_dias || ''} onChange={set('prazo_instalacao_dias')}/></EOField>
            <EOField label="Previsão início"><input className="input" type="date" value={f.previsao_inicio || ''} onChange={set('previsao_inicio')}/></EOField>
            <EOField label="Previsão término"><input className="input" type="date" value={f.previsao_termino || ''} onChange={set('previsao_termino')}/></EOField>
            <EOField label="Início real"><input className="input" type="date" value={f.data_real_inicio || ''} onChange={set('data_real_inicio')}/></EOField>
            <EOField label="Término real"><input className="input" type="date" value={f.data_real_termino || ''} onChange={set('data_real_termino')}/></EOField>
          </div>

          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Material</div>
          <div className="grid-2" style={{ gap: 10, marginBottom: 12 }}>
            <EOField label="Previsão de chegada"><input className="input" type="date" value={f.previsao_chegada_material || ''} onChange={set('previsao_chegada_material')}/></EOField>
            <EOField label="Chegada real"><input className="input" type="date" value={f.chegada_real_material || ''} onChange={set('chegada_real_material')}/></EOField>
          </div>

          <EOField label="Observações"><textarea className="input" rows={2} value={f.observacoes || ''} onChange={set('observacoes')} style={{ resize: 'vertical' }}/></EOField>

          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button variant="primary" size="sm" icon="check" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabEquipamentos({ dossier }) {
  const [equipamentos, setEquipamentos] = React.useState(null);
  const [parceiros, setParceiros] = React.useState([]);

  const carregar = React.useCallback(() => {
    window.__DOSSIER.listarEquipamentos(dossier.id).then(setEquipamentos).catch((e) => { window.toast?.('Erro: ' + e.message, 'error'); setEquipamentos([]); });
  }, [dossier.id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    if (window.RHHomologacao) window.RHHomologacao.listarMontadores().then(setParceiros).catch(() => setParceiros([]));
  }, []);

  const adicionar = async () => {
    try {
      /* Herda o instalador vinculado à obra (Visão Geral) como padrão do
         equipamento novo — evita a divergência silenciosa entre os dois
         vínculos independentes. Continua 100% editável no card logo
         abaixo, pra obras que legitimamente têm mais de um instalador. */
      await window.__DOSSIER.criarEquipamento(dossier.id, {
        tipo: dossier.equip_type || '',
        parceiro_instalador_id: dossier.parceiro_instalador_id || null,
      });
      carregar();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const salvar = async (id, campos) => {
    const { parceiros_instaladores, id: _id, dossier_id, criado_em, criado_por, atualizado_em, ...patch } = campos;
    await window.__DOSSIER.atualizarEquipamento(id, patch);
    carregar();
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir este equipamento da obra?')) return;
    try { await window.__DOSSIER.excluirEquipamento(id); carregar(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (equipamentos === null) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Um equipamento por linha — nº de série, ART, alvarás e prazos ficam aqui, cada um com seu próprio acompanhamento.
      </p>
      {equipamentos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6, marginBottom: 12 }}>
          Nenhum equipamento cadastrado nesta obra ainda.
        </div>
      )}
      {equipamentos.map((eq) => (
        <EquipamentoCard key={eq.id} equip={eq} parceiros={parceiros} onSalvar={salvar} onExcluir={excluir}/>
      ))}
      <Button variant="outline" size="sm" icon="plus" onClick={adicionar}>+ Adicionar equipamento</Button>
    </div>
  );
}

/* União dos dois vínculos possíveis (obra inteira + por equipamento) numa
   lista única "quem monta essa obra" — pedido do usuário depois de ver que
   uma obra pode ter mais de uma instaladora, mas isso ficava escondido
   dentro de cada card de equipamento, um por vez. Sem mudar schema: só
   agrupa o que já existe. */
function InstaladorasDaObraPanel({ dossier, equipamentos }) {
  const grupos = {};
  let semInstalador = 0;
  equipamentos.forEach((eq) => {
    const emp = eq.parceiros_instaladores;
    if (!emp?.id) { semInstalador += 1; return; }
    if (!grupos[emp.id]) grupos[emp.id] = { nome: emp.nome, equipamentos: [] };
    grupos[emp.id].equipamentos.push(eq.tipo || eq.descricao || eq.id);
  });
  const lista = Object.entries(grupos);

  if (equipamentos.length === 0) {
    return <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>Nenhum equipamento cadastrado ainda — cadastre na aba Equipamentos pra ver as instaladoras aqui.</div>;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Instaladoras desta obra</div>
      {lista.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Nenhum equipamento tem instalador vinculado ainda.</div>}
      {lista.map(([empId, g]) => (
        <div key={empId} style={{ fontSize: 13, marginBottom: 4 }}>
          🏢 <b>{g.nome}</b> — {g.equipamentos.length} equipamento{g.equipamentos.length !== 1 ? 's' : ''}
          {empId === dossier.parceiro_instalador_id && <span style={{ marginLeft: 6, fontSize: 11, color: '#0066cc', fontWeight: 700 }}>★ vínculo principal da obra</span>}
        </div>
      ))}
      {semInstalador > 0 && <div style={{ fontSize: 12, color: '#cc7700', marginTop: 4 }}>⚠ {semInstalador} equipamento{semInstalador !== 1 ? 's' : ''} sem instalador vinculado.</div>}
    </div>
  );
}

function TabInstalacao({ dossier, reload }) {
  const [checklist, setChecklist] = React.useState(null);
  const [parceiros, setParceiros] = React.useState([]);
  const [equipamentos, setEquipamentos] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [recebidoPor, setRecebidoPor] = React.useState('');
  const [qtdPessoas, setQtdPessoas] = React.useState('');
  const [valorAndaimeMunck, setValorAndaimeMunck] = React.useState('');

  const carregar = React.useCallback(async () => {
    try {
      const ck = await window.InstalacaoObraStore.obterChecklistObraPronta(dossier.id);
      setChecklist(ck);
      setRecebidoPor(ck.dossier.equipamento_recebido_por || '');
      setQtdPessoas(ck.dossier.equipamento_qtd_pessoas_recebimento != null ? String(ck.dossier.equipamento_qtd_pessoas_recebimento) : '');
    } catch (e) { window.toast?.('Erro ao carregar checklist: ' + e.message, 'error'); }
    try {
      const eqs = await window.__DOSSIER.listarEquipamentos(dossier.id);
      setEquipamentos(eqs);
    } catch (e) { setEquipamentos([]); }
    if (window.RHHomologacao) {
      window.RHHomologacao.listarMontadores().then(setParceiros).catch(() => setParceiros([]));
    }
  }, [dossier.id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const acao = async (fn) => {
    setBusy(true);
    try { await fn(); await carregar(); await (reload && reload()); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  if (!checklist) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const store = window.InstalacaoObraStore;

  return (
    <div>
      <div style={{
        background: checklist.pronta ? '#eafaf0' : '#fff8e6',
        border: `1px solid ${checklist.pronta ? '#00aa00' : '#FBB039'}`,
        borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700,
        color: checklist.pronta ? '#00701f' : '#8a5a00',
      }}>
        {checklist.pronta ? '✓ Obra pronta para instalação' : '○ Obra ainda não está pronta para instalação'}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Checklist de obra pronta</div>
        {checklist.itens.map((item) => (
          <div key={item.chave} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid #ddd', borderRadius: 6, padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 18, color: item.ok ? '#00aa00' : '#cc7700', fontWeight: 700, width: 20, textAlign: 'center' }}>{item.ok ? '✓' : '○'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.detalhe}</div>
            </div>
          </div>
        ))}

        {!checklist.dossier.equipamento_entregue && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-end' }}>
            <div>
              <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Recebido por (nome dos responsáveis)</label>
              <input className="input" style={{ width: 240 }} value={recebidoPor} onChange={(e) => setRecebidoPor(e.target.value)} placeholder="ex.: João Silva, Maria Souza"/>
            </div>
            <div>
              <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Qtd. de pessoas na recepção</label>
              <input className="input" type="number" min="0" style={{ width: 140 }} value={qtdPessoas} onChange={(e) => setQtdPessoas(e.target.value)} placeholder="mín. 2"/>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => acao(() => store.marcarEquipamentoEntregue(dossier.id, !checklist.dossier.equipamento_entregue, { recebidoPor, qtdPessoas }))}>
            {checklist.dossier.equipamento_entregue ? 'Desmarcar equipamento entregue' : 'Marcar equipamento entregue'}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => acao(() => store.marcarAndaimeMunck(dossier.id, { necessario: !checklist.dossier.andaime_munck_necessario }))}>
            {checklist.dossier.andaime_munck_necessario ? 'Andaime/munck: não aplicável' : 'Andaime/munck necessário'}
          </Button>
          {checklist.dossier.andaime_munck_necessario && !checklist.dossier.andaime_munck_providenciado && (
            <>
              <input className="input" type="number" min="0" step="0.01" style={{ width: 140 }}
                value={valorAndaimeMunck} onChange={(e) => setValorAndaimeMunck(e.target.value)}
                placeholder="Valor (R$)" title="Valor da locação — se ficar em branco, entra sem custo registrado"/>
              <Button variant="outline" size="sm" disabled={busy}
                onClick={() => acao(() => store.marcarAndaimeMunck(dossier.id, { providenciado: true, valor: valorAndaimeMunck }))}>
                Marcar andaime/munck providenciado
              </Button>
            </>
          )}
          {checklist.dossier.andaime_munck_necessario && checklist.dossier.andaime_munck_providenciado && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => acao(() => store.marcarAndaimeMunck(dossier.id, { providenciado: false }))}>
              Desmarcar providenciado {checklist.dossier.andaime_munck_valor != null ? `(R$ ${Number(checklist.dossier.andaime_munck_valor).toLocaleString('pt-BR')})` : '(sem valor informado)'}
            </Button>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <InstaladorasDaObraPanel dossier={dossier} equipamentos={equipamentos} />
          <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Parceiro instalador (vínculo principal da obra)</label>
          <select className="input" style={{ maxWidth: 360 }} disabled={busy} value={dossier.parceiro_instalador_id || ''}
            onChange={(e) => acao(() => store.vincularParceiroInstalador(dossier.id, e.target.value || null))}>
            <option value="">— nenhum vinculado —</option>
            {parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            Pra vincular uma empresa diferente num equipamento específico (obra com mais de uma instaladora), use a aba Equipamentos.
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Vistorias</div>
        <VistoriasObras obraId={dossier.id} obra={{ nome: dossier.building_name }} embedded onChanged={carregar}/>
      </div>
    </div>
  );
}

/* Cronograma de Instalação (15/08) — checklist de execução, "camaleão"
   por tipo de equipamento (pedido do usuário: template muda conforme
   elevador/escada/esteira). Ordem de conclusão livre — corte civil e
   elétrica podem rodar em paralelo na obra real, a semana é só
   agrupamento visual. */
function TabCronogramaInstalacao({ dossier }) {
  const store = window.InstalacaoChecklistStore;
  const [itens, setItens] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [linkPublico, setLinkPublico] = React.useState(null);
  const [linkInterno, setLinkInterno] = React.useState(null);
  const [showAddTemplate, setShowAddTemplate] = React.useState(false);

  const carregar = React.useCallback(() => {
    store.listarPorDossier(dossier.id).then(setItens).catch(() => setItens([]));
  }, [dossier.id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const criar = async () => {
    setBusy(true);
    try {
      await store.criarChecklistDossier(dossier.id, dossier.equip_type);
      window.toast?.('Cronograma criado.', 'success');
      carregar();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const marcar = async (item, novoStatus) => {
    setBusy(true);
    try { await store.marcarItem(item.id, { status: novoStatus }); carregar(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const gerarLink = async () => {
    try {
      const url = await store.gerarLinkPublico(dossier.id);
      setLinkPublico(url);
      try { await navigator.clipboard.writeText(url); window.toast?.('Link copiado — já é público, qualquer um com o link vê o status.', 'success'); }
      catch (e) { window.toast?.('Link gerado (copie manualmente abaixo).', 'success'); }
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const gerarLinkI = async () => {
    try {
      const url = await store.gerarLinkInterno(dossier.id);
      setLinkInterno(url);
      try { await navigator.clipboard.writeText(url); window.toast?.('Link interno copiado — permite anotar em reunião.', 'success'); }
      catch (e) { window.toast?.('Link gerado (copie manualmente abaixo).', 'success'); }
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (itens === null) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  if (itens.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 16 }}>
          Nenhum cronograma de instalação criado ainda pra esta obra ({store.normalizarTipoEquipamento(dossier.equip_type)}).
        </p>
        <Button variant="primary" onClick={criar} disabled={busy}>{busy ? 'Criando…' : 'Criar Cronograma de Instalação'}</Button>
      </div>
    );
  }

  const total = itens.length;
  const concluidos = itens.filter((i) => i.status === 'concluido').length;
  const pct = Math.round((concluidos / total) * 100);
  const semanas = [...new Set(itens.map((i) => i.semana))].sort((a, b) => a - b);

  return (
    <div>
      <div style={{ background: '#0b1220', color: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa7bd' }}>Progresso</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{concluidos} / {total} · {pct}%</div>
        </div>
        <div className="row gap-2">
          <Button variant="outline" size="sm" onClick={gerarLink}>🔗 Link público (Cliente)</Button>
          <Button variant="outline" size="sm" onClick={gerarLinkI}>🔒 Link interno (VerticalParts)</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAddTemplate((v) => !v)}>+ Adicionar item ao template</Button>
        </div>
      </div>

      {linkPublico && (
        <div style={{ background: '#f0f8ff', border: '1px solid #0066cc', borderRadius: 6, padding: 10, marginBottom: 8, fontSize: 12, wordBreak: 'break-all' }}>
          Link público — Cliente (copiado): <a href={linkPublico} target="_blank" rel="noopener noreferrer">{linkPublico}</a>
        </div>
      )}
      {linkInterno && (
        <div style={{ background: '#fff8e6', border: '1px solid #cc7700', borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 12, wordBreak: 'break-all' }}>
          Link interno — VerticalParts, permite anotar (copiado): <a href={linkInterno} target="_blank" rel="noopener noreferrer">{linkInterno}</a>
        </div>
      )}

      {showAddTemplate && (
        <FormAdicionarItemTemplate onSaved={() => setShowAddTemplate(false)} equipTypePadrao={store.normalizarTipoEquipamento(dossier.equip_type)}/>
      )}

      {semanas.map((sem) => (
        <div key={sem} style={{ marginBottom: 20 }}>
          <div style={{ borderLeft: `4px solid ${store.semanaCor(sem)}`, paddingLeft: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: store.semanaCor(sem), fontWeight: 700 }}>Semana {sem}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{store.semanaTitulo(sem)}</div>
          </div>
          {itens.filter((i) => i.semana === sem).map((item) => (
            <div key={item.id} style={{
              border: '1px solid ' + (item.status === 'concluido' ? '#10b981' : item.status === 'nao_aplicavel' ? '#ccc' : '#ddd'),
              background: item.status === 'concluido' ? '#f0fdf4' : item.status === 'nao_aplicavel' ? '#fafafa' : '#fff',
              borderRadius: 6, padding: 12, marginBottom: 8, opacity: item.status === 'nao_aplicavel' ? 0.6 : 1,
            }}>
              <div className="row sb" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.etapa}</div>
                  {item.servicos && item.servicos.length > 0 && (
                    <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 12, color: '#555' }}>
                      {item.servicos.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {item.resultado_esperado && (
                    <div style={{ fontSize: 12, color: '#0a7a3d', marginTop: 4 }}>✓ {item.resultado_esperado}</div>
                  )}
                  {item.status === 'concluido' && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                      Concluído por {item.concluido_por || '—'} em {item.concluido_em ? new Date(item.concluido_em).toLocaleString('pt-BR') : '—'}
                    </div>
                  )}
                </div>
                <div className="row gap-1" style={{ flexShrink: 0 }}>
                  {item.status !== 'concluido' && (
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => marcar(item, 'concluido')}>✓ Concluir</Button>
                  )}
                  {item.status === 'concluido' && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => marcar(item, 'pendente')}>Desmarcar</Button>
                  )}
                  {item.status === 'pendente' && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => marcar(item, 'nao_aplicavel')}>N/A</Button>
                  )}
                  {item.status === 'nao_aplicavel' && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => marcar(item, 'pendente')}>Reativar</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* "Camaleão": qualquer usuário pode adicionar item de template pra
   elevador, escada ou esteira — mesmo espírito da biblioteca
   compartilhada de categorias/campos da Ficha Técnica. Item entra no
   template geral, não neste dossiê (esta obra já tem seu snapshot). */
function FormAdicionarItemTemplate({ onSaved, equipTypePadrao }) {
  const [tipo, setTipo] = React.useState(equipTypePadrao || 'elevador');
  const [semana, setSemana] = React.useState(1);
  const [etapa, setEtapa] = React.useState('');
  const [servicos, setServicos] = React.useState('');
  const [resultado, setResultado] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    if (!etapa.trim()) return window.toast?.('Informe o nome da etapa.', 'warning');
    setSaving(true);
    try {
      await window.InstalacaoChecklistStore.adicionarItemTemplate({
        tipoEquipamento: tipo, semana, etapa,
        servicos: servicos.split('\n').map((s) => s.trim()).filter(Boolean),
        resultadoEsperado: resultado,
      });
      window.toast?.('Item adicionado ao template — vale só pra próximos cronogramas criados.', 'success');
      setEtapa(''); setServicos(''); setResultado('');
      onSaved();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ border: '1px dashed #999', borderRadius: 6, padding: 14, marginBottom: 18, background: '#fafafa' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Novo item de template (elevador / escada / esteira)</div>
      <div className="grid-3" style={{ gap: 10, marginBottom: 10 }}>
        <div>
          <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Tipo de equipamento</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="elevador">Elevador</option>
            <option value="escada">Escada rolante</option>
            <option value="esteira">Esteira rolante</option>
          </select>
        </div>
        <div>
          <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Semana</label>
          <input className="input" type="number" min="1" value={semana} onChange={(e) => setSemana(e.target.value)}/>
        </div>
        <div>
          <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Etapa</label>
          <input className="input" value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="ex.: Instalação dos degraus"/>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Serviços (um por linha)</label>
        <textarea className="input" rows={3} value={servicos} onChange={(e) => setServicos(e.target.value)}
          placeholder={'Fixação da estrutura\nAlinhamento e nivelamento'}/>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Resultado esperado</label>
        <input className="input" value={resultado} onChange={(e) => setResultado(e.target.value)}/>
      </div>
      <Button variant="primary" size="sm" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Adicionar ao template'}</Button>
    </div>
  );
}

function TabPendencias({ dossier }) {
  const pendencias = dossier.pendencias || [];
  const ativas = pendencias.filter(p => !p.resolved_at);
  const resolvidas = pendencias.filter(p => p.resolved_at);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🟡 Pendências Ativas ({ativas.length})</div>
        {ativas.length > 0 ? (
          ativas.map(p => (
            <div key={p.id} style={{
              background: p.bloqueante ? '#fff0f0' : '#fff8e6',
              border: `1px solid ${p.bloqueante ? '#ff6666' : '#ffcc00'}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.descricao}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    Tipo: <b>{p.tipo}</b> {p.etapa && `· Etapa: ${p.etapa}`}
                  </div>
                </div>
                <Button variant="outline" size="small">
                  Resolver
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>Sem pendências ativas</div>
        )}
      </div>

      {resolvidas.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>✅ Pendências Resolvidas ({resolvidas.length})</div>
          {resolvidas.map(p => (
            <div key={p.id} style={{
              background: '#f0f8f0',
              border: '1px solid #cce6cc',
              borderRadius: 6,
              padding: 12,
              marginBottom: 8,
              opacity: 0.7
            }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{p.descricao}</div>
              <div style={{ fontSize: 11, color: '#666' }}>
                Resolvido em {new Date(p.resolved_at).toLocaleDateString('pt-BR')} por {p.resolved_by}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabResponsaveis({ dossier }) {
  const responsaveis = dossier.responsaveis || [];
  const etapas = ['comercial', 'engenharia', 'financeiro', 'juridico', 'rh', 'instalacao'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {etapas.map(etapa => {
        const resp = responsaveis.find(r => r.etapa === etapa);
        return (
          <div key={etapa} style={{
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: 16
          }}>
            <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 12 }}>
              {etapa}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              {resp?.responsavel || '—'}
            </div>
            {resp?.notes && (
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                {resp.notes}
              </div>
            )}
            <Button variant="outline" size="small">
              {resp ? 'Alterar' : 'Atribuir'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function TabHistorico({ dossier }) {
  const historico = dossier.historico || [];

  return (
    <div style={{ maxWidth: 600 }}>
      {historico.length > 0 ? (
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          {historico.map((h, i) => (
            <div key={h.id} style={{
              position: 'relative',
              paddingBottom: 24,
              borderLeft: i === historico.length - 1 ? 'none' : '2px solid #ddd'
            }}>
              <div style={{
                position: 'absolute',
                left: -38,
                top: 2,
                width: 12,
                height: 12,
                background: '#0066cc',
                borderRadius: '50%',
                border: '3px solid white'
              }} />
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {h.status_from} → {h.status_to}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                Por: <b>{h.actor}</b>
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                {new Date(h.created_at).toLocaleDateString('pt-BR')} · {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {h.notes && (
                <div style={{ fontSize: 12, marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                  {h.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#999', textAlign: 'center', padding: 32 }}>
          Sem histórico de transições
        </div>
      )}
    </div>
  );
}

function ModalAdicionarPendencia({ dossierId, onClose, onSaved }) {
  const [f, setF] = React.useState({
    tipo: 'cliente',
    descricao: '',
    etapa: '',
    bloqueante: false
  });

  const save = async () => {
    if (!f.descricao.trim()) return window.toast('Descrição é obrigatória', 'warning');
    try {
      await window.__DOSSIER.adicionarPendencia(dossierId, f.tipo, f.descricao, f.etapa || null, f.bloqueante);
      window.toast('Pendência adicionada', 'success');
      onSaved?.();
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    }
  };

  return (
    <Modal title="Adicionar Pendência" onClose={onClose} width={500}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Adicionar</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="up-eyebrow muted">Tipo *</label>
        <select className="input" value={f.tipo} onChange={e => setF(p => ({ ...p, tipo: e.target.value }))}>
          <option>cliente</option>
          <option>interno</option>
          <option>externo</option>
        </select>

        <label className="up-eyebrow muted">Descrição *</label>
        <textarea className="input" rows={3} value={f.descricao} onChange={e => setF(p => ({ ...p, descricao: e.target.value }))} placeholder="O que está pendente?" />

        <label className="up-eyebrow muted">Etapa (opcional)</label>
        <select className="input" value={f.etapa} onChange={e => setF(p => ({ ...p, etapa: e.target.value }))}>
          <option value="">Sem etapa específica</option>
          <option value="comercial">Comercial</option>
          <option value="engenharia">Engenharia</option>
          <option value="financeiro">Financeiro</option>
          <option value="juridico">Jurídico</option>
          <option value="rh">RH</option>
          <option value="instalacao">Instalação</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.bloqueante} onChange={e => setF(p => ({ ...p, bloqueante: e.target.checked }))} />
          <span>Esta pendência bloqueia o fluxo?</span>
        </label>
      </div>
    </Modal>
  );
}

function statusBg(status) {
  const bgs = {
    'rascunho': '#f5f5f5',
    'aprovado': '#e6ffe6',
    'enviado': '#e6f2ff',
    'assinado': '#e6ffe6',
    'vencido': '#ffe6e6'
  };
  return bgs[status] || '#f5f5f5';
}

function statusColor(status) {
  const colors = {
    'rascunho': '#999',
    'aprovado': '#00aa00',
    'enviado': '#0066cc',
    'assinado': '#00aa00',
    'vencido': '#cc0000'
  };
  return colors[status] || '#666';
}
