/* ============================================================
   controle-cotacoes.jsx — Controle de Cotações (Formulário de Elevadores)
   Grid pesquisável unindo o histórico real da planilha de controle
   (cotacoes_elevador_historico) com as cotações novas criadas pelo
   Formulário de Elevadores (formularios_elevador). Ver issues #76/#79.
   window.ControleCotacoesPage — rota "controle-cotacoes".
   ============================================================ */
const CC_STATUS_COR = {
  Conquistado: '#059669', Perdido: '#9f1239', Suspenso: '#b45309',
  'Em andamento': '#2563eb', rascunho: '#64748b', enviado: '#2563eb', em_cotacao: '#b45309', concluido: '#059669',
};

function CcStatusChip({ status }) {
  if (!status) return <span className="muted">—</span>;
  const cor = CC_STATUS_COR[status] || '#64748b';
  return <span className="la-setor" style={{ background: cor }}>{status}</span>;
}

/* Reabre a cadeia de tratativas (Formulário → Cotação a Fornecedor →
   Precificação → Proposta) de uma cotação viva do Formulário digital, num
   modal — reaproveita CadeiaGatilhosCotacao (financeiro.jsx), o mesmo
   componente da tela "Gatilhos & Prazo", em vez de duplicar a árvore/
   navegação aqui. Linhas de origem "historico" (planilha legada) não têm
   cadeia por trás — não abrem nada, pedido explícito do usuário. */
function ModalCadeiaCotacao({ numeroCotacao, setRoute, setSubsel, onClose }) {
  const [nos, setNos] = React.useState(null);
  const [confirmarSinalDe, setConfirmarSinalDe] = React.useState(null);
  const [confirmarAvalDe, setConfirmarAvalDe] = React.useState(null);

  const carregar = React.useCallback(async () => {
    const { data } = await window.__VP_SB.sb.from('gatilhos').select('*')
      .eq('numero_cotacao', numeroCotacao).eq('origem', 'automatico').order('nascido_em');
    setNos(data || []);
  }, [numeroCotacao]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const abrirGatilho = async (g) => {
    if (!window.GatilhosEngine) return;
    const alvo = await window.GatilhosEngine.navegarPara(g);
    if (!alvo) return;
    if (alvo.subsel !== null) setSubsel?.(alvo.subsel);
    setRoute?.(alvo.rota);
    onClose();
  };

  const fecharLembrete = async (id) => {
    if (window.GatilhosEngine) await window.GatilhosEngine.fecharLembrete(id);
    carregar();
  };

  return (
    <Modal title={`Tratativas — Cotação Nº ${numeroCotacao}`} onClose={onClose} width={640}>
      {nos === null && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      )}
      {nos !== null && nos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>
          Nenhuma cadeia automática encontrada pra essa cotação.
        </div>
      )}
      {nos !== null && nos.length > 0 && (
        <CadeiaGatilhosCotacao numeroCotacao={numeroCotacao} nos={nos} defaultOpen
          onConfirmarSinal={setConfirmarSinalDe} onConfirmarAval={setConfirmarAvalDe}
          onFecharLembrete={fecharLembrete} onAbrirGatilho={abrirGatilho}/>
      )}
      {confirmarSinalDe && <ModalConfirmarSinal g={confirmarSinalDe} onClose={() => setConfirmarSinalDe(null)} onSaved={carregar}/>}
      {confirmarAvalDe && <ModalConfirmarAvalPagamento g={confirmarAvalDe} onClose={() => setConfirmarAvalDe(null)} onSaved={carregar}/>}
    </Modal>
  );
}

function ControleCotacoesPage({ setRoute, setSubsel }) {
  const [rows, setRows] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fStatus, setFStatus] = React.useState('Todos');
  const [refreshing, setRefreshing] = React.useState(false);
  const [cadeiaDe, setCadeiaDe] = React.useState(null);

  const carregar = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await window.FormularioElevadorStore.listarCotacoes();
      setRows(data);
    } catch (e) {
      window.toast?.('Erro ao carregar cotações: ' + e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const statusDisponiveis = React.useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.status).filter(Boolean))];
  }, [rows]);

  const filtradas = React.useMemo(() => {
    if (!rows) return [];
    const termo = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== 'Todos' && r.status !== fStatus) return false;
      if (!termo) return true;
      const masterId = r.numero_cotacao != null ? window.MasterIdEngine.etapaId('cotacao', r.numero_cotacao) : '';
      return [r.nome_cliente, r.vendedor, r.cnpj_comprador, String(r.numero_cotacao || ''), masterId]
        .some((v) => (v || '').toLowerCase().includes(termo));
    });
  }, [rows, busca, fStatus]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
          <h1 className="page-head__title">Controle de Cotações</h1>
          <p className="page-head__sub">Histórico completo de cotações de elevadores — planilha legada + cotações do Formulário digital.</p>
        </div>
        <div className="page-head__r">
          <Button variant="ghost" icon="chevLeft" onClick={() => setRoute('formulario-elevador')}>Voltar</Button>
          <Button variant="outline" icon="refresh" onClick={carregar} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
      </div>

      <div className="grid-3" style={{ margin: '20px 0' }}>
        <KPI label="Cotações (filtro atual)" value={rows ? filtradas.length : '…'} sub={`de ${rows ? rows.length : '…'} no total`} icon="history"/>
        <KPI label="Nº mais recente" value={rows && rows.length ? window.MasterIdEngine.etapaId('cotacao', rows[0].numero_cotacao) : '—'} sub="maior Nº Cotação registrado" icon="grid"/>
        <KPI label="Conquistadas" value={rows ? rows.filter((r) => r.status === 'Conquistado').length : '…'} sub="status Conquistado" icon="check"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {['Todos'].concat(statusDisponiveis).map((s) => (
            <button key={s} className={fStatus === s ? 'is-active' : ''} onClick={() => setFStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar por cliente, vendedor, CNPJ ou nº da cotação…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table className="t la-table">
          <thead><tr>
            <th style={{ width: 90 }}>Nº Cotação</th>
            <th style={{ width: 110 }}>Data</th>
            <th>Cliente</th>
            <th style={{ width: 90 }}>Vendedor</th>
            <th style={{ width: 60 }}>UF</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 90 }}>Origem</th>
          </tr></thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={99}><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)' }}>Carregando…</div></td></tr>
            )}
            {rows !== null && filtradas.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhuma cotação encontrada</h4><p>Nada encontrado com os filtros atuais.</p></div></td></tr>
            )}
            {filtradas.map((r, i) => {
              const clicavel = r.origem === 'formulario' && r.numero_cotacao != null;
              return (
                <tr key={r.id ? `${r.origem}-${r.id}` : `${r.origem}-${r.numero_cotacao}-${i}`}
                  style={clicavel ? { cursor: 'pointer' } : undefined}
                  title={clicavel ? 'Abrir tratativas desta cotação' : undefined}
                  onClick={clicavel ? () => setCadeiaDe(r.numero_cotacao) : undefined}>
                  <td><span className="mono small">{r.numero_cotacao != null ? window.MasterIdEngine.etapaId('cotacao', r.numero_cotacao) : '—'}</span></td>
                  <td><span className="mono small" style={{ whiteSpace: 'nowrap' }}>{r.data ? String(r.data).slice(0, 10) : '—'}</span></td>
                  <td style={{ fontSize: 12.5 }}>{r.nome_cliente || <span className="muted">—</span>}</td>
                  <td>{r.vendedor || <span className="muted">—</span>}</td>
                  <td>{r.estado_instalacao || <span className="muted">—</span>}</td>
                  <td><CcStatusChip status={r.status}/></td>
                  <td className="small" style={{ color: 'var(--fg2)' }}>{r.origem === 'historico' ? 'Planilha' : 'Formulário'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cadeiaDe != null && (
        <ModalCadeiaCotacao numeroCotacao={cadeiaDe} setRoute={setRoute} setSubsel={setSubsel} onClose={() => setCadeiaDe(null)}/>
      )}
    </div>
  );
}

window.ControleCotacoesPage = ControleCotacoesPage;
