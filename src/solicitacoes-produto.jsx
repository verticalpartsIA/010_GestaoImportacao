/* ============================================================
   solicitacoes-produto.jsx — Gerenciador de solicitações de produto
   Fluxo: Comercial (preenche) → Engenharia (completa) → Ficha Técnica
   ============================================================ */

/* Cores dos selos de status (texto branco por cima, então todas escuras). Fonte única para a lista e o detalhe. */
const SP_STATUS_CORES = {
  novo: 'var(--vp-info)',
  em_analise: 'var(--vp-warning-ink)',
  aguardando_desenho: 'var(--fg2)',
  pronto: 'var(--vp-success)',
  convertido_em_ficha: 'var(--vp-black)',
};

function SolicitacoesProdutoPage({ solicitacaoId }) {
  const [view, setView] = React.useState(solicitacaoId ? 'detalhe' : 'lista');
  const [solicitacoes, setSolicitacoes] = React.useState([]);
  const [atual, setAtual] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [filtroStatus, setFiltroStatus] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');
  /* Alçada — Configurações › Administração › Engenharia › Solicitações de
     Produto › Criar. Sem linha em alcadas_capacidade = não pode (Admin
     sempre pode, via temCapacidade). Só trava o botão de criar; ver/abrir
     detalhe continua livre (fluxo de análise da Engenharia não muda). */
  const [podeCriar, setPodeCriar] = React.useState(false);
  const [podeExcluir, setPodeExcluir] = React.useState(false);
  const [solicitacaoExcluir, setSolicitacaoExcluir] = React.useState(null);

  const user = window.__VP_USER || { email: 'desconhecido', nome: 'Usuário' };

  React.useEffect(() => {
    if (!window.PropostaStore) return;
    window.PropostaStore.temCapacidade('solicitacoes-produto', 'criar').then(setPodeCriar).catch(() => {});
    window.PropostaStore.temCapacidade('solicitacoes-produto', 'excluir').then(setPodeExcluir).catch(() => {});
  }, []);

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
          podeCriar={podeCriar}
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
          podeExcluir={podeExcluir}
          onExcluirClick={setSolicitacaoExcluir}
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

      {solicitacaoExcluir && (
        <ModalExcluirSolicitacao
          solicitacao={solicitacaoExcluir}
          onClose={() => setSolicitacaoExcluir(null)}
          onExcluida={() => {
            setSolicitacaoExcluir(null);
            _carregarLista();
          }}
        />
      )}
    </div>
  );
}

/* ---------- MODAL: Excluir Solicitação ----------
   Soft-delete (SolicitacoesProdutoStore.excluir → excluido_em/excluido_por).
   Exige o checkbox de ciência marcado antes de liberar o botão de
   confirmação — ninguém exclui em 1 clique só, mesmo padrão de "certeza
   explícita" pedido pelo usuário. */
function ModalExcluirSolicitacao({ solicitacao, onClose, onExcluida }) {
  const [ciente, setCiente] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const jaVirouFicha = solicitacao.status === 'convertido_em_ficha';

  async function confirmar() {
    if (!ciente || excluindo) return;
    setExcluindo(true);
    setErro('');
    try {
      await window.SolicitacoesProdutoStore.excluir(solicitacao.id);
      onExcluida();
    } catch (e) {
      setErro('Erro ao excluir: ' + (e.message || e));
      setExcluindo(false);
    }
  }

  return (
    <div style={styles.modalShroud} onClick={excluindo ? undefined : onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Excluir solicitação?</div>

        <div style={styles.modalInfo}>
          <div style={{ fontWeight: 700 }}>{solicitacao.numero_solicitacao}</div>
          <div style={{ color: 'var(--fg2)', marginTop: '4px' }}>
            {solicitacao.cliente_nome ? solicitacao.cliente_nome + ' · ' : ''}
            {solicitacao.categoria_sku || '—'} · {solicitacao.status.replace(/_/g, ' ').toUpperCase()}
          </div>
        </div>

        {jaVirouFicha && (
          <div style={styles.modalWarn}>
            Esta solicitação já foi convertida em Ficha Técnica. A ficha não é apagada e continua
            acessível normalmente — só esta solicitação sai da lista.
          </div>
        )}

        <div style={styles.modalText}>
          A solicitação sai da lista de Solicitações de Produto. O registro fica guardado no banco
          (com data e autor da exclusão) e pode ser recuperado pelo suporte, se necessário.
        </div>

        <label style={styles.modalCheckboxRow}>
          <input
            type="checkbox"
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
            style={{ marginTop: '2px' }}
          />
          <span>Estou ciente e tenho certeza de que quero excluir esta solicitação.</span>
        </label>

        {erro && <div style={styles.erro}>{erro}</div>}

        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onClose} disabled={excluindo}>
            CANCELAR
          </button>
          <button
            style={{ ...styles.btnDanger, ...((!ciente || excluindo) ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            onClick={confirmar}
            disabled={!ciente || excluindo}
          >
            {excluindo ? 'EXCLUINDO…' : 'SIM, EXCLUIR'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaView({ solicitacoes, loading, podeCriar, filtroStatus, filtroTipo, onFiltroStatusChange, onFiltroTipoChange, onNovaClick, onAbrirClick, podeExcluir, onExcluirClick, user }) {
  const statusCores = SP_STATUS_CORES;

  const tiposLabel = {
    elevador: 'Elevador',
    escada_rolante: 'Escada Rolante',
    esteira: 'Esteira',
  };

  return (
    <div style={styles.viewContainer}>
      <div style={styles.toolbar}>
        <button
          onClick={onNovaClick}
          disabled={!podeCriar}
          style={{ ...styles.btnPrimary, ...(podeCriar ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
          title={podeCriar ? undefined : 'Sem permissão para criar — peça liberação em Configurações → Administração'}
        >
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
                <th style={styles.th}>CATEGORIA</th>
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
                  <td style={styles.td}>{sol.categoria_sku || '—'}</td>
                  <td style={styles.td}>{sol.cliente_nome}</td>
                  <td style={styles.td}>{sol.solicitante_nome}</td>
                  <td style={styles.td}>
                    <div style={{ ...styles.badge, background: statusCores[sol.status] }}>
                      {sol.status.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </td>
                  <td style={styles.td}>{new Date(sol.data_criacao).toLocaleDateString('pt-BR')}</td>
                  <td style={styles.td}>
                    <div style={styles.acoesCell}>
                      <button
                        onClick={() => onAbrirClick(sol.id)}
                        style={styles.btnLink}
                      >
                        ABRIR
                      </button>
                      {podeExcluir && (
                        <button
                          onClick={() => onExcluirClick(sol)}
                          style={styles.btnIconTrash}
                          title="Excluir solicitação"
                          aria-label="Excluir solicitação"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
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
    categoria_sku: '',
    solicitante_nome: user.nome || 'Usuário',
    solicitante_email: user.email || '',
    descricao_inicial: '',
    observacoes_comercial: '',
    fornecedor_contato: '',
    link_produto: '',
    foiPedidoCliente: false,
    cliente_nome: '',
    cliente_industria: '',
    cliente_contato: '',
    anexos: [],
  });

  const [erros, setErros] = React.useState({});
  const [enviandoAnexo, setEnviandoAnexo] = React.useState(false);
  // Todos os anexos desta solicitação nova caem na mesma pasta temporária —
  // a solicitação ainda não tem id (só existe depois do insert).
  const pastaTempRef = React.useRef(window.SolicitacoesProdutoStore._pastaTemp());

  function _validar() {
    const novosErros = {};
    if (!form.categoria_sku) novosErros.categoria_sku = 'Categoria é obrigatória';
    if (!form.descricao_inicial) novosErros.descricao_inicial = 'Explique o que você precisa';
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function _salvar() {
    if (!_validar()) return;
    await onSalvar(form);
  }

  async function _onAnexoChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEnviandoAnexo(true);
    try {
      for (const file of files) {
        const anexo = await window.SolicitacoesProdutoStore.uploadAnexo(file, pastaTempRef.current);
        setForm((s) => ({ ...s, anexos: [...s.anexos, anexo] }));
      }
    } catch (err) {
      alert('Erro ao enviar anexo: ' + (err.message || err));
    } finally {
      setEnviandoAnexo(false);
      e.target.value = '';
    }
  }

  function _removerAnexo(idx) {
    const anexo = form.anexos[idx];
    if (anexo && anexo.path) window.SolicitacoesProdutoStore.removerAnexo(anexo.path).catch(() => {});
    setForm((s) => ({ ...s, anexos: s.anexos.filter((_, i) => i !== idx) }));
  }

  return (
    <div style={styles.viewContainer}>
      <div style={styles.formContainer}>
        <div style={styles.formTitle}>NOVA SOLICITAÇÃO DE PRODUTO</div>
        <div style={{ fontSize: '12px', color: 'var(--fg2)', marginBottom: '16px' }}>
          Só <b>Tipo</b>, <b>Categoria</b> e a <b>Descrição</b> são obrigatórios — preencha o resto que souber, o que faltar a Engenharia completa depois.
        </div>

        <div style={styles.formRow}>
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

          <div style={styles.formGroup}>
            <label style={styles.label}>Categoria (SKU) *</label>
            <select
              value={form.categoria_sku}
              onChange={(e) => setForm({ ...form, categoria_sku: e.target.value })}
              style={{ ...styles.input, borderColor: erros.categoria_sku ? 'var(--vp-danger)' : '' }}
            >
              <option value="">Selecione…</option>
              {(window.SolicitacoesProdutoStore.CATEGORIAS_SKU || []).map((c) => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
            {erros.categoria_sku && <div style={styles.erro}>{erros.categoria_sku}</div>}
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>O que você precisa? *</label>
          <textarea
            value={form.descricao_inicial}
            onChange={(e) => setForm({ ...form, descricao_inicial: e.target.value })}
            style={{ ...styles.textarea, borderColor: erros.descricao_inicial ? 'var(--vp-danger)' : '' }}
            placeholder="Explique com suas palavras o que é o produto e pra que serve — não precisa ser técnico, a Engenharia completa os detalhes depois."
          />
          {erros.descricao_inicial && <div style={styles.erro}>{erros.descricao_inicial}</div>}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Detalhes adicionais (opcional)</label>
          <textarea
            value={form.observacoes_comercial}
            onChange={(e) => setForm({ ...form, observacoes_comercial: e.target.value })}
            style={styles.textarea}
            placeholder="Qualquer informação a mais que possa ajudar"
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Contato do fornecedor (opcional)</label>
            <input
              type="text"
              value={form.fornecedor_contato}
              onChange={(e) => setForm({ ...form, fornecedor_contato: e.target.value })}
              style={styles.input}
              placeholder="Nome, telefone, e-mail — o que você já tiver"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Link do produto (opcional)</label>
            <input
              type="text"
              value={form.link_produto}
              onChange={(e) => setForm({ ...form, link_produto: e.target.value })}
              style={styles.input}
              placeholder="Site do fabricante, catálogo, marketplace…"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Imagem ou PDF do produto (opcional)</label>
          <input type="file" accept="image/*,.pdf" multiple onChange={_onAnexoChange} disabled={enviandoAnexo}/>
          {enviandoAnexo && <div style={{ fontSize: '12px', color: 'var(--fg2)', marginTop: '6px' }}>Enviando…</div>}
          {form.anexos.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              {form.anexos.map((a, idx) => (
                <div key={a.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '4px 0' }}>
                  <span>{a.tipo === 'imagem' ? '🖼️' : '📄'}</span>
                  <a href={a.url} target="_blank" style={{ color: 'var(--vp-info)' }}>{a.nome}</a>
                  <button type="button" onClick={() => _removerAnexo(idx)} style={{ border: 'none', background: 'none', color: 'var(--vp-danger)', cursor: 'pointer' }}>remover</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.formGroup}>
          <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.foiPedidoCliente}
              onChange={(e) => setForm({ ...form, foiPedidoCliente: e.target.checked })}
            />
            Foi um pedido de um cliente específico?
          </label>
        </div>

        {form.foiPedidoCliente && (
          <div style={{ padding: '12px', background: 'var(--vp-gray-50)', borderRadius: '4px', marginBottom: '16px' }}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Cliente (opcional)</label>
                <input
                  type="text"
                  value={form.cliente_nome}
                  onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Indústria (opcional)</label>
                <input
                  type="text"
                  value={form.cliente_industria}
                  onChange={(e) => setForm({ ...form, cliente_industria: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Contato do cliente (opcional)</label>
              <input
                type="text"
                value={form.cliente_contato}
                onChange={(e) => setForm({ ...form, cliente_contato: e.target.value })}
                style={styles.input}
                placeholder="Telefone, e-mail…"
              />
            </div>
          </div>
        )}

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

  const statusCores = SP_STATUS_CORES;

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
        form.desenho_url,
        form.complementos_descobertos
      );
      onAtualizar({});
      setEdicao(false);
      alert('Análise salva e marcada como pronta!');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }

  async function _converterEmFicha() {
    if (!window.FT || !window.FTStore) {
      alert('Módulo de Ficha Técnica não está carregado. Recarregue a página e tente novamente.');
      return;
    }
    if (!confirm('Converter esta solicitação em uma nova Ficha Técnica?')) return;
    try {
      const state = window.FT.freshState();
      state.identificacao.nomeProduto = solicitacao.cliente_nome
        ? `${solicitacao.tipo_equipamento} — ${solicitacao.cliente_nome}`
        : solicitacao.tipo_equipamento;
      state.identificacao.descricaoComercial = solicitacao.descricao_inicial || '';
      state.identificacao.descricaoTecnica = solicitacao.complementos_descobertos || '';

      const rec = await window.FTStore.createDraft(state);
      await window.SolicitacoesProdutoStore.converterEmFicha(solicitacao.id, rec.id);
      onAtualizar({});
      alert('Ficha técnica criada! Abrindo editor…');
      if (window.VpRouter) {
        window.VpRouter.navigate('ficha-tecnica', rec.id);
        // navigate() só faz pushState (não dispara popstate); o app.jsx só
        // troca de página reagindo a popstate, então disparamos manualmente
        // pra simular uma navegação real do browser.
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (e) {
      alert('Erro ao converter em ficha técnica: ' + e.message);
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
          {solicitacao.cliente_nome && (
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Cliente:</div>
              <div style={styles.detalheValue}>
                {solicitacao.cliente_nome}
                {solicitacao.cliente_industria ? ` (${solicitacao.cliente_industria})` : ''}
              </div>
            </div>
          )}
          {solicitacao.cliente_contato && (
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Contato do cliente:</div>
              <div style={styles.detalheValue}>{solicitacao.cliente_contato}</div>
            </div>
          )}
          {solicitacao.fornecedor_contato && (
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Contato do fornecedor:</div>
              <div style={styles.detalheValue}>{solicitacao.fornecedor_contato}</div>
            </div>
          )}
          {solicitacao.link_produto && (
            <div style={styles.detalheRow}>
              <div style={styles.detalheLabel}>Link do produto:</div>
              <div style={styles.detalheValue}>
                <a href={solicitacao.link_produto} target="_blank" style={styles.btnLink}>{solicitacao.link_produto}</a>
              </div>
            </div>
          )}
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Solicitante:</div>
            <div style={styles.detalheValue}>{solicitacao.solicitante_nome} ({solicitacao.solicitante_email})</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Tipo:</div>
            <div style={styles.detalheValue}>{solicitacao.tipo_equipamento}</div>
          </div>
          <div style={styles.detalheRow}>
            <div style={styles.detalheLabel}>Categoria (SKU):</div>
            <div style={styles.detalheValue}>{solicitacao.categoria_sku || '—'}</div>
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
          {(solicitacao.anexos || []).length > 0 && (
            <>
              <div style={styles.detalheSectionTitle}>ANEXOS</div>
              {solicitacao.anexos.map((a) => (
                <div key={a.path || a.url} style={{ padding: '4px 0' }}>
                  <a href={a.url} target="_blank" style={styles.btnLink}>
                    {a.tipo === 'imagem' ? '🖼️' : '📄'} {a.nome}
                  </a>
                </div>
              ))}
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

      {solicitacao.status === 'pronto' && (
        <div style={styles.formActions}>
          <button onClick={_converterEmFicha} style={styles.btnPrimary}>
            CONVERTER EM FICHA TÉCNICA
          </button>
        </div>
      )}

      {solicitacao.status === 'convertido_em_ficha' && solicitacao.ficha_tecnica_id && (
        <div style={styles.formActions}>
          <button
            onClick={() => {
              if (!window.VpRouter) return;
              window.VpRouter.navigate('ficha-tecnica', solicitacao.ficha_tecnica_id);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={styles.btnPrimary}
          >
            ABRIR FICHA TÉCNICA
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
  breadcrumb: { fontSize: '11px', color: 'var(--fg2)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' },
  title: { fontSize: '28px', fontWeight: 700, marginBottom: '8px' },
  subtitle: { fontSize: '13px', color: 'var(--fg2)', lineHeight: 1.5 },
  viewContainer: { background: 'var(--bg)', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  titleSection: { borderBottom: 'none' },
  toolbar: { display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'space-between', alignItems: 'center' },

  btnPrimary: { padding: '10px 20px', background: 'var(--vp-yellow)', color: 'var(--vp-black)', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' },
  btnSecondary: { padding: '10px 20px', background: 'var(--border)', color: 'var(--fg1)', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' },
  btnLink: { color: 'var(--vp-info)', textDecoration: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '12px', background: 'none', border: 'none', padding: 0 },
  btnDanger: { padding: '10px 20px', background: 'var(--vp-danger)', color: 'var(--vp-white)', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' },
  acoesCell: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnIconTrash: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '2px 4px', lineHeight: 1 },

  modalShroud: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox: { background: 'var(--bg)', borderRadius: '8px', width: '460px', maxWidth: '92vw', padding: '22px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
  modalTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '14px' },
  modalInfo: { background: 'var(--vp-gray-50)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px' },
  modalWarn: { background: 'var(--vp-warning-tint)', border: '1px solid var(--vp-warning)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: 'var(--vp-warning-ink)' },
  modalText: { fontSize: '13px', color: 'var(--fg2)', lineHeight: 1.5, marginBottom: '14px' },
  modalCheckboxRow: { display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', marginBottom: '18px', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },

  filtros: { display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' },
  filtroGrupo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  filtroLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase' },
  filtroSelect: { padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: '4px', fontSize: '12px' },

  statsGrupo: { display: 'flex', gap: '16px', marginLeft: 'auto' },
  stat: { textAlign: 'center' },
  statNumero: { fontSize: '18px', fontWeight: 700 },
  statLabel: { fontSize: '10px', color: 'var(--fg2)', fontWeight: 600, marginTop: '4px' },

  loadingContainer: { textAlign: 'center', padding: '40px', fontSize: '14px', color: 'var(--fg2)' },
  emptyState: { textAlign: 'center', padding: '40px' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  emptyTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '6px' },
  emptyText: { fontSize: '13px', color: 'var(--fg2)' },

  tabelaContainer: { overflowX: 'auto', marginTop: '20px' },
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  theadTr: { background: 'var(--vp-gray-50)', borderBottom: '2px solid var(--border)' },
  th: { padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase', fontSize: '10px' },
  tbodyTr: { borderBottom: '1px solid var(--border)', '&:hover': { background: 'var(--vp-gray-50)' } },
  td: { padding: '12px', verticalAlign: 'top' },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: 'var(--vp-white)', fontSize: '10px', fontWeight: 600 },

  formContainer: { background: 'var(--vp-gray-50)', padding: '20px', borderRadius: '8px', marginTop: '20px' },
  formTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '20px' },
  formGroup: { marginBottom: '20px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--fg1)', marginBottom: '6px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: '4px', fontSize: '13px', minHeight: '80px', fontFamily: 'monospace', resize: 'vertical' },
  erro: { fontSize: '11px', color: 'var(--vp-danger)', marginTop: '4px' },
  formActions: { display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' },

  detalheHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' },
  detalheNum: { fontSize: '20px', fontWeight: 700 },
  detalheGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  detalheSection: { background: 'var(--vp-gray-50)', padding: '16px', borderRadius: '8px' },
  detalheSectionTitle: { fontSize: '12px', fontWeight: 700, color: 'var(--fg1)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' },
  detalheRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', marginBottom: '12px', fontSize: '12px' },
  detalheLabel: { fontWeight: 600, color: 'var(--fg2)' },
  detalheValue: { color: 'var(--fg1)' },
  detalheText: { fontSize: '12px', color: 'var(--fg1)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordWrap: 'break-word' },
};
