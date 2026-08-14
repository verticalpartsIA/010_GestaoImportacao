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
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Dossiê da Obra</div>
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
            <th>ID</th>
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
                <td><span className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{o.id}</span></td>
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

function DossierObraPage({ dossierId, setRoute }) {
  const [dossier, setDossier] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('visao-geral');
  const [modalOpen, setModalOpen] = React.useState(null);

  React.useEffect(() => {
    carregarDossier();
  }, [dossierId]);

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
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              Cliente: <b>{dossier.client_name}</b>
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              {dossier.city && dossier.state ? `${dossier.city}, ${dossier.state}` : 'Localização não informada'}
              {dossier.equip_type && ` · ${dossier.equip_type}`}
            </div>
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
        <Button variant="primary" size="small" onClick={() => alert('Fluxo de transição a implementar')}>
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
    setUploading(tipo);
    try {
      await window.__DOSSIER.anexarDocumento({ dossierId: dossier.id, tipo, file });
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
