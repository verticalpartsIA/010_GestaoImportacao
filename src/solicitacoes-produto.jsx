/* ============================================================
   solicitacoes-produto.jsx — Gerenciador de solicitações de produto
   Fluxo: Comercial (preenche) → Engenharia (completa) → Ficha Técnica
   ============================================================ */

function SolicitacoesProdutoPage({ solicitacaoId }) {
  const [view, setView] = React.useState(solicitacaoId ? 'detalhe' : 'lista');
  const [solicitacoes, setSolicitacoes] = React.useState([]);
  const [atual, setAtual] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [filtroStatus, setFiltroStatus] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');

  const user = window.__VP_USER || { email: 'desconhecido', nome: 'Usuário' };

  React.useEffect(() => {
    if (!window.SolicitacoesProdutoStore) {
      console.error('[SolicitacoesProduto] Store não carregada');
      return;
    }

    if (solicitacaoId) {
      _carregarDetalhe(solicitacaoId);
    } else {
      _carregarLista();
    }
  }, [solicitacaoId]);

  async function _carregarLista() {
    setLoading(true);
    try {
      const filtros = {};
      if (filtroStatus) filtros.status = filtroStatus;
      if (filtroTipo) filtros.tipo_equipamento = filtroTipo;

      const dados = await window.SolicitacoesProdutoStore.listar(filtros);
      setSolicitacoes(dados);
    } catch (e) {
      console.error('[SolicitacoesProduto] Erro ao carregar lista:', e);
    }
    setLoading(false);
  }

  async function _carregarDetalhe(id) {
    setLoading(true);
    try {
      const dados = await window.SolicitacoesProdutoStore.obter(id);
      setAtual(dados);
      setView('detalhe');
    } catch (e) {
      console.error('[SolicitacoesProduto] Erro ao carregar detalhe:', e);
    }
    setLoading(false);
  }

  function _voltarParaLista() {
    if (window.VpRouter) {
      window.VpRouter.navigate('solicitacoes-produto', null);
    }
    setView('lista');
    setAtual(null);
    _carregarLista();
  }

  function _abrirDetalhe(id) {
    if (window.VpRouter) {
      window.VpRouter.navigate('solicitacoes-produto', id);
    }
    _carregarDetalhe(id);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <div style={styles.breadcrumb}>ENGENHARIA · SOLICITAÇÕES DE PRODUTO</div>
          <div style={styles.title}>SOLICITAÇÕES DE PRODUTO</div>
          <div style={styles.subtitle}>
            Produtos novos solicitados pelo comercial que precisam análise e documentação da engenharia
          </div>
        </div>
      </div>

      {view === 'lista' ? (
        <ListaView
          solicitacoes={solicitacoes}
          loading={loading}
          filtroStatus={filtroStatus}
          filtroTipo={filtroTipo}
          onFiltroStatusChange={(s) => {
            setFiltroStatus(s);
            _carregarLista();
          }}
          onFiltroTipoChange={(t) => {
            setFiltroTipo(t);
            _carregarLista();
          }}
          onNovaClick={() => setView('nova')}
          onAbrirClick={_abrirDetalhe}
          user={user}
        />
      ) : view === 'nova' ? (
        <NovaView
          onSalvar={async (dados) => {
            try {
              const result = await window.SolicitacoesProdutoStore.criar(dados);
              _voltarParaLista();
            } catch (e) {
              alert('Erro ao criar solicitação: ' + e.message);
            }
          }}
          onCancelar={_voltarParaLista}
          user={user}
        />
      ) : (
        <DetalheView
          solicitacao={atual}
          loading={loading}
          onVoltar={_voltarParaLista}
          onAtualizar={(dados) => {
            window.SolicitacoesProdutoStore.atualizar(atual.id, dados)
              .then(() => _carregarDetalhe(atual.id))
              .catch((e) => alert('Erro ao atualizar: ' + e.message));
          }}
          user={user}
        />
      )}
    </div>
  );
}

function ListaView({ solicitacoes, loading, filtroStatus, filtroTipo, onFiltroStatusChange, onFiltroTipoChange, onNovaClick, onAbrirClick, user }) {
  const statusCores = {
    novo: '#3b82f6',
    em_analise: '#f59e0b',
    aguardando_desenho: '#ec4899',
    pronto: '#10b981',
    convertido_em_ficha: '#8b5cf6',
  };

  const tiposLabel = {
    elevador: 'Elevador',
    escada_rolante: 'Escada Rolante',
    esteira: 'Esteira',
  };

  return (
    <div style={styles.viewContainer}>
      <div style={styles.toolbar}>
        <button onClick={onNovaClick} style={styles.btnPrimary}>
          + NOVA SOLICITAÇÃO
        </button>
      </div>

      <div style={styles.filtros}>
        <div style={styles.filtroGrupo}>
          <label style={styles.filtroLabel}>Status</label>
          <select
            value={filtroStatus}
            onChange={(e) => onFiltroStatusChange(e.target.value)}
            style={styles.filtroSelect}
          >
            <option value="">Todos</option>
            {window.SolicitacoesProdutoStore.STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filtroGrupo}>
          <label style={styles.filtroLabel}>Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => onFiltroTipoChange(e.target.value)}
            style={styles.filtroSelect}
          >
            <option value="">Todos</option>
            {window.SolicitacoesProdutoStore.TIPOS.map((t) => (
              <option key={t} value={t}>
                {tiposLabel[t]}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.statsGrupo}>
          <div style={styles.stat}>
            <div style={styles.statNumero}>{solicitacoes.length}</div>
            <div style={styles.statLabel}>TOTAL</div>
          </div>
          {window.SolicitacoesProdutoStore.STATUS_LIST.map((status) => {
            const count = solicitacoes.filter((s) => s.status === status).length;
            return (
              <div key={status} style={styles.stat}>
                <div style={{ ...styles.statNumero, color: statusCores[status] }}>{count}</div>
                <div style={styles.statLabel}>{status.replace(/_/g, ' ').toUpperCase()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingContainer}>⏳ Carregando…</div>
      ) : solicitacoes.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <div style={styles.emptyTitle}>Nenhuma solicitação</div>
          <div style={styles.emptyText}>Não há solicitações de produto com os filtros aplicados</div>
        </div>
      ) : (
        <div style={styles.tabelaContainer}>
          <table style={styles.tabela}>
            <thead>
              <tr style={styles.theadTr}>
                <th style={styles.th}>SOLICITAÇÃO</th>
                <th style={styles.th}>TIPO</th>
                <th style={styles.th}>CLIENTE</th>
                <th style={styles.th}>SOLICITANTE</th>
                <th style={styles.th}>STATUS</th>
                <th style={styles.th}>DATA</th>
                <th style={styles.th}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((sol) => (
                <tr key={sol.id} style={styles.tbodyTr}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{sol.numero_solicitacao}</td>
                  <td style={styles.td}>{tiposLabel[sol.tipo_equipamento]}</td>
                  <td style={styles.td}>{sol.cliente_nome}</td>
                  <td style={styles.td}>{sol.solicitante_nome}</td>
                  <td style={styles.td}>
                    <div style={{ ...styles.badge, background: statusCores[sol.status] }}>
                      {sol.status.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </td>
                  <td style={styles.td}>{new Date(sol.data_criacao).toLocaleDateString('pt-BR')}</td>
                  <td style={styles.td}>
                    <button
                      onClick={() => onAbrirClick(sol.id)}
                      style={styles.btnLink}
                    >
                      ABRIR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NovaView({ onSalvar, onCancelar, user }) {
  const [form, setForm] = React.useState({
    tipo_equipamento: 'elevador',
    solicitante_nome: user.nome || 'Usuário',
    solicitante_email: user.email || '',
    cliente_nome: '',
    cliente_industria: '',
    descricao_inicial: '',
    observacoes_comercial: '',
    fotos_url: [],
  });

  const [erros, setErros] = React.useState({});

  function _validar() {
    const novosErros = {};
    if (!form.cliente_nome) novosErros.cliente_nome = 'Cliente é obrigatório';
    if (!form.descricao_inicial) novosErros.descricao_inicial = 'Descrição é obrigatória';
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function _salvar() {
    if (!_validar()) return;
    await onSalvar(form);
  }

  return (
    <div style={styles.viewContainer}>
      <div style={styles.formContainer}>
        <div style={styles.formTitle}>NOVA SOLICITAÇÃO DE PRODUTO</div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Tipo de Equipamento *</label>
          <select
            value={form.tipo_equipamento}
            onChange={(e) => setForm({ ...form, tipo_equipamento: e.target.value })}
            style={styles.input}
          >
            <option value="elevador">Elevador</option>
            <option value="escada_rolante">Escada Rolante</option>
            <option value="esteira">Esteira</option>
          </select>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Solicitante *</label>
            <input
              type="text"
              value={form.solicitante_nome}
              onChange={(e) => setForm({ ...form, solicitante_nome: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>E-mail *</label>
            <input
              type="email"
              value={form.solicitante_email}
              onChange={(e) => setForm({ ...form, solicitante_email: e.target.value })}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Cliente *</label>
            <input
              type="text"
              value={form.cliente_nome}
              onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
              style={{ ...styles.input, borderColor: erros.cliente_nome ? '#ef4444' : '' }}
            />
            {erros.cliente_nome && <div style={styles.erro}>{erros.cliente_nome}</div>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Indústria</label>
            <input
              type="text"
              value={form.cliente_industria}
              onChange={(e) => setForm({ ...form, cliente_industria: e.target.value })}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Descrição Detalhada *</label>
          <textarea
            value={form.descricao_inicial}
            onChange={(e) => setForm({ ...form, descricao_inicial: e.target.value })}
            style={{ ...styles.textarea, borderColor: erros.descricao_inicial ? '#ef4444' : '' }}
            placeholder="Descreva o equipamento, suas características, dimensões aproximadas, etc."
          />
          {erros.descricao_inicial && <div style={styles.erro}>{erros.descricao_inicial}</div>}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Observações e Detalhes Adicionais</label>
          <textarea
            value={form.observacoes_comercial}
            onChange={(e) => setForm({ ...form, observacoes_comercial: e.target.value })}
            style={styles.textarea}
            placeholder="Qualquer informação adicional que possa ser útil"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Fotos (opcional)</label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Você pode adicionar links para fotos do equipamento ou documentação (ex: URL de imagem, screenshot, etc)
          </div>
          <input
            type="text"
            placeholder="https://example.com/foto1.jpg (um por linha)"
            style={{...styles.textarea, minHeight: '60px'}}
            onBlur={(e) => {
              const urls = e.target.value.split('\n').filter(u => u.trim());
              setForm({ ...form, fotos_url: urls });
            }}
            defaultValue={form.fotos_url.join('\n')}
          />
        </div>

        <div style={styles.formActions}>
          <button onClick={onCancelar} style={styles.btnSecondary}>
            CANCELAR
          </button>
          <button onClick={_salvar} style={styles.btnPrimary}>
            ENVIAR PARA ENGENHARIA
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalheView({ solicitacao, loading, onVoltar, onAtualizar, user }) {
  if (loading || !solicitacao) {
    return <div style={styles.loadingContainer}>⏳ Carregando…</div>;
  }

  const [edicao, setEdicao] = React.useState(false);
  const [form, setForm] = React.useState({
    especificacoes_completas: solicitacao.especificacoes_completas || {},
    desenho_url: solicitacao.desenho_url || '',
    complementos_descobertos: solicitacao.complementos_descobertos || '',
  });

  const statusCores = {
    novo: '#3b82f6',
    em_analise: '#f59e0b',
    aguardando_desenho: '#ec4899',
    pronto: '#10b981',
    convertido_em_ficha: '#8b5cf6',
  };

  async function _iniciarAnalise() {
    if (!confirm('Iniciar análise desta solicitação?')) return;
    try {
      await window.SolicitacoesProdutoStore.iniciarAnalise(solicitacao.id);
      onAtualizar({});
      alert('Análise iniciada!');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }

  async function _salvarAnalise() {
    try {
      await window.SolicitacoesProdutoStore.marcarPronto(
        solicitacao.id,
        form.especificacoes_completas,
        form.desenho_url
      );
      onAtualizar({});
      setEdicao(false);
      alert('Análise salva e marcada como pronta!');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }

  return (
    <div style={styles.viewContainer}>
      <div style={styles.detalheHeader}>
        <div>
          <div style={styles.detalheNum}>{solicitacao.numero_solicitacao}</div>
          <div style={{ ...styles.badge, background: statusCores[solicitacao.status], marginTop: 8 }}>
            {solicitacao.status.replace(/_/g, ' ').toUpperCase()}
          </div>
        </div>
        <button onClick={onVoltar} style={styles.btnSecondary}>
          ← VOLTAR
        </button>
      </div>

      <div style={styles.detalheGrid}>
        <div style={styles.detalheSection}>
          <div style={styles.detalheSectionTitle}>INFORMAÇÕES COMERCIAIS</div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Cliente:</div>
            <div style={styles.detalheValue}>{solicitacao.cliente_nome}</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Indústria:</div>
            <div style={styles.detalheValue}>{solicitacao.cliente_industria}</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Solicitante:</div>
            <div style={styles.detalheValue}>{solicitacao.solicitante_nome} ({solicitacao.solicitante_email})</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Tipo:</div>
            <div style={styles.detalheValue}>{solicitacao.tipo_equipamento}</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Data:</div>
            <div style={styles.detalheValue}>{new Date(solicitacao.data_criacao).toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <div style={styles.detalheSection}>
          <div style={styles.detalheSectionTitle}>DESCRIÇÃO INICIAL</div>
          <div style={styles.detalheText}>{solicitacao.descricao_inicial}</div>
          {solicitacao.observacoes_comercial && (
            <>
              <div style={styles.detalheSectionTitle}>OBSERVAÇÕES</div>
              <div style={styles.detalheText}>{solicitacao.observacoes_comercial}</div>
            </>
          )}
        </div>

        {solicitacao.status !== 'novo' && (
          <div style={styles.detalheSection}>
            <div style={styles.detalheSectionTitle}>ANÁLISE DE ENGENHARIA</div>
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Engenheiro:</div>
              <div style={styles.detalheValue}>{solicitacao.engenheiro_responsavel || '—'}</div>
            </div>
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Iniciada em:</div>
              <div style={styles.detalheValue}>
                {solicitacao.data_inicio_analise ? new Date(solicitacao.data_inicio_analise).toLocaleString('pt-BR') : '—'}
              </div>
            </div>
            {solicitacao.complementos_descobertos && (
              <>
                <div style={styles.detalheSectionTitle}>COMPLEMENTOS DESCOBERTOS</div>
                <div style={styles.detalheText}>{solicitacao.complementos_descobertos}</div>
              </>
            )}
            {solicitacao.desenho_url && (
              <>
                <div style={styles.detalheSectionTitle}>DESENHO</div>
                <a href={solicitacao.desenho_url} target="_blank" style={styles.btnLink}>
                  VER DESENHO
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {solicitacao.status === 'novo' && (
        <div style={styles.formActions}>
          <button onClick={_iniciarAnalise} style={styles.btnPrimary}>
            INICIAR ANÁLISE
          </button>
        </div>
      )}

      {solicitacao.status === 'em_analise' && !edicao && (
        <div style={styles.formActions}>
          <button onClick={() => setEdicao(true)} style={styles.btnPrimary}>
            EDITAR ANÁLISE
          </button>
        </div>
      )}

      {edicao && (
        <div style={styles.formContainer}>
          <div style={styles.formTitle}>EDITAR ANÁLISE</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Complementos Descobertos</label>
            <textarea
              value={form.complementos_descobertos}
              onChange={(e) => setForm({ ...form, complementos_descobertos: e.target.value })}
              style={styles.textarea}
              placeholder="O que faltava e foi descoberto"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>URL do Desenho</label>
            <input
              type="text"
              value={form.desenho_url}
              onChange={(e) => setForm({ ...form, desenho_url: e.target.value })}
              style={styles.input}
              placeholder="https://..."
            />
          </div>

          <div style={styles.formActions}>
            <button onClick={() => setEdicao(false)} style={styles.btnSecondary}>
              CANCELAR
            </button>
            <button onClick={_salvarAnalise} style={styles.btnPrimary}>
              SALVAR E MARCAR COMO PRONTO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { marginBottom: '30px' },
  breadcrumb: { fontSize: '11px', color: '#666', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' },
  title: { fontSize: '28px', fontWeight: 700, marginBottom: '8px' },
  subtitle: { fontSize: '13px', color: '#666', lineHeight: 1.5 },
  viewContainer: { background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  titleSection: { borderBottom: 'none' },
  toolbar: { display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'space-between', alignItems: 'center' },

  btnPrimary: { padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' },
  btnSecondary: { padding: '10px 20px', background: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' },
  btnLink: { color: '#3b82f6', textDecoration: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '12px', background: 'none', border: 'none', padding: 0 },

  filtros: { display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' },
  filtroGrupo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  filtroLabel: { fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase' },
  filtroSelect: { padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' },

  statsGrupo: { display: 'flex', gap: '16px', marginLeft: 'auto' },
  stat: { textAlign: 'center' },
  statNumero: { fontSize: '18px', fontWeight: 700 },
  statLabel: { fontSize: '10px', color: '#666', fontWeight: 600, marginTop: '4px' },

  loadingContainer: { textAlign: 'center', padding: '40px', fontSize: '14px', color: '#666' },
  emptyState: { textAlign: 'center', padding: '40px' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  emptyTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '6px' },
  emptyText: { fontSize: '13px', color: '#666' },

  tabelaContainer: { overflowX: 'auto', marginTop: '20px' },
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  theadTr: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
  th: { padding: '12px', textAlign: 'left', fontWeight: 600, color: '#666', textTransform: 'uppercase', fontSize: '10px' },
  tbodyTr: { borderBottom: '1px solid #e5e7eb', '&:hover': { background: '#f9fafb' } },
  td: { padding: '12px', verticalAlign: 'top' },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: 600 },

  formContainer: { background: '#fafafa', padding: '20px', borderRadius: '8px', marginTop: '20px' },
  formTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '20px' },
  formGroup: { marginBottom: '20px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '6px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', minHeight: '80px', fontFamily: 'monospace', resize: 'vertical' },
  erro: { fontSize: '11px', color: '#ef4444', marginTop: '4px' },
  formActions: { display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' },

  detalheHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
  detalheNum: { fontSize: '20px', fontWeight: 700 },
  detalheGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  detalheSection: { background: '#fafafa', padding: '16px', borderRadius: '8px' },
  detalheSectionTitle: { fontSize: '12px', fontWeight: 700, color: '#333', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' },
  detalheRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', marginBottom: '12px', fontSize: '12px' },
  detalheLabel: { fontWeight: 600, color: '#666' },
  detalheValue: { color: '#333' },
  detalheText: { fontSize: '12px', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordWrap: 'break-word' },
};
