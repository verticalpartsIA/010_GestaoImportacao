/* ============================================================
   cotacoes-fornecedor.jsx — Cotações a Fornecedor (todas categorias)
   Substitui a antiga "Cotações China" (mock, tabela órfã `cotacoes`).
   Lista real de cotacoes_elevador_fornecedor — hoje só Glarie/elevador
   está implementado, mas a tela já cobre qualquer categoria/fornecedor
   futuro (escada rolante, esteira, quadro de comando, porta, cabine).

   Ciclo de status mostrado na tela:
   rascunho/enviado/visualizado → "Aguardando" (fornecedor ainda não respondeu)
   respondido                   → "Recebida"
   em_analise                   → time decidiu seguir com a compra
   aprovada                     → confirmação final de compra
   window.CotacoesFornecedorPage / window.CotacaoFornecedorDetalhe
   rotas: "cotacoes-fornecedor" / "cotacao-fornecedor-detail"
   ============================================================ */
const CF_AGUARDANDO = ['rascunho', 'enviado', 'visualizado'];
const CF_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'aguardando', label: 'Aguardando' },
  { key: 'respondido', label: 'Recebida' },
  { key: 'em_analise', label: 'Em análise' },
  { key: 'aprovada', label: 'Aprovada' },
];

function cfCategoriaLabel(valor) {
  const store = window.CotacaoElevadorFornecedorStore;
  return store.CATEGORIAS_PRODUTO.find((c) => c.value === valor)?.label || valor;
}

function cfPredioLabel(cot) {
  const fe = cot.formularios_elevador;
  if (!fe) return '—';
  const cidadeUf = [fe.local_obra_cidade, fe.local_obra_estado].filter(Boolean).join('/');
  return fe.clientes?.razao_social || cidadeUf || '—';
}

function CotacoesFornecedorPage({ setRoute, setSubsel }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const [rows, setRows] = React.useState(null);
  const [tab, setTab] = React.useState('todos');
  const [fFornecedor, setFFornecedor] = React.useState('Todos');
  const [fCategoria, setFCategoria] = React.useState('Todos');

  const carregar = React.useCallback(async () => {
    try {
      const data = await store.listarTodas();
      setRows(data);
    } catch (e) {
      window.toast?.('Erro ao carregar cotações: ' + e.message, 'error');
      setRows([]);
    }
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const fornecedores = React.useMemo(() => (rows ? [...new Set(rows.map((r) => r.fornecedor))] : []), [rows]);

  const filtradas = React.useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (tab === 'aguardando' && !CF_AGUARDANDO.includes(r.status)) return false;
      if (tab !== 'todos' && tab !== 'aguardando' && r.status !== tab) return false;
      if (fFornecedor !== 'Todos' && r.fornecedor !== fFornecedor) return false;
      if (fCategoria !== 'Todos' && r.categoria_produto !== fCategoria) return false;
      return true;
    });
  }, [rows, tab, fFornecedor, fCategoria]);

  if (rows === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const kpi = (pred) => rows.filter(pred).length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial</div>
          <h1 className="page-head__title">Cotações a Fornecedor</h1>
          <p className="page-head__sub">Solicitações técnicas enviadas aos fornecedores (Glarie e próximos) — cada linha vem de um envio real do Formulário de Elevadores.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando" value={kpi((r) => CF_AGUARDANDO.includes(r.status))} sub="fornecedor ainda não respondeu" icon="clock"/>
        <KPI label="Recebidas" value={kpi((r) => r.status === 'respondido')} sub="prontas p/ decisão" icon="package"/>
        <KPI label="Em análise" value={kpi((r) => r.status === 'em_analise')} sub="decidimos seguir com a compra" icon="trending"/>
        <KPI label="Aprovadas" value={kpi((r) => r.status === 'aprovada')} sub="compra confirmada" icon="check"/>
      </div>

      <div className="tbar">
        <div className="seg">{CF_TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}</div>
        <div className="spacer"/>
        <select className="input" style={{ maxWidth: 180 }} value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)}>
          <option value="Todos">Todos os fornecedores</option>
          {fornecedores.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
          <option value="Todos">Todas as categorias</option>
          {store.CATEGORIAS_PRODUTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Nº Documento</th>
            <th>Nº Cotação</th>
            <th>Prédio / Cliente</th>
            <th>Fornecedor</th>
            <th>Categoria</th>
            <th>Enviado em</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
                Nenhum registro encontrado com os filtros atuais.
              </td></tr>
            )}
            {filtradas.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => { setSubsel(c); setRoute('cotacao-fornecedor-detail'); }}>
                <td><span className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{c.numero_documento}</span></td>
                <td><span className="mono small">{c.dados_envio?.header?.numero_cotacao ?? c.formularios_elevador?.numero_cotacao ?? '—'}</span></td>
                <td>
                  <div className="cell-main">{cfPredioLabel(c)}</div>
                  <div className="cell-sub">{c.formularios_elevador?.local_obra_cidade ? `${c.formularios_elevador.local_obra_cidade}/${c.formularios_elevador.local_obra_estado || ''}` : ''}</div>
                </td>
                <td>{c.fornecedor}</td>
                <td>{cfCategoriaLabel(c.categoria_produto)}</td>
                <td><span className="cell-num">{c.sent_at ? fmtDate(c.sent_at) : '—'}</span></td>
                <td><FECefStatusChip status={c.status}/></td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CotacaoFornecedorDetalhe({ cot: cotInicial, setRoute }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const [cot, setCot] = React.useState(cotInicial);
  const [verResp, setVerResp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!cot) {
    return <EmptyStateRedirect
      icon="globe"
      title="Nenhuma cotação selecionada"
      message="Escolha uma cotação na listagem para ver a resposta do fornecedor, o link público e decidir a compra."
      ctaLabel="Ir para Cotações a Fornecedor"
      onCta={() => setRoute('cotacoes-fornecedor')}/>;
  }

  const url = store.cotacaoUrl(cot.token);
  const temResposta = ['respondido', 'em_analise', 'aprovada'].includes(cot.status);

  async function decidirComprar() {
    setBusy(true);
    try {
      const atualizado = await store.decidirComprar(cot.id);
      setCot(atualizado);
      window.toast('Cotação movida para Em análise.', 'success');
    } catch (e) { window.toast('Erro: ' + e.message, 'error'); }
    setBusy(false);
  }
  async function aprovar() {
    setBusy(true);
    try {
      const atualizado = await store.aprovar(cot.id);
      setCot(atualizado);
      window.toast('Compra aprovada!', 'success');
    } catch (e) { window.toast('Erro: ' + e.message, 'error'); }
    setBusy(false);
  }

  return (
    <div className="page fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute('cotacoes-fornecedor')}>Voltar para Cotações a Fornecedor</Button>
      </div>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{cot.numero_documento} · {cot.fornecedor}</div>
          <h1 className="page-head__title">{cfPredioLabel(cot)}</h1>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <FECefStatusChip status={cot.status}/>
            <span className="muted small">{cfCategoriaLabel(cot.categoria_produto)}</span>
            {cot.sent_at && <span className="muted small">Enviado em {fmtDateLong(cot.sent_at)}</span>}
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="copy" onClick={() => { navigator.clipboard?.writeText(url).then(() => window.toast('Link copiado!', 'success')).catch(() => window.toast('Link: ' + url, 'info')); }}>Copiar link público</Button>
          {temResposta && <Button variant="outline" icon="fileText" onClick={() => setVerResp(true)}>Ver resposta do fornecedor</Button>}
          {cot.status === 'respondido' && <Button variant="primary" icon="check" disabled={busy} onClick={decidirComprar}>{busy ? 'Salvando…' : 'Decidir comprar'}</Button>}
          {cot.status === 'em_analise' && <Button variant="primary" icon="check" disabled={busy} onClick={aprovar}>{busy ? 'Salvando…' : 'Aprovar compra'}</Button>}
          {cot.status === 'aprovada' && <Button variant="ghost" icon="check" disabled>Compra aprovada ✓</Button>}
        </div>
      </div>

      <Card style={{ marginBottom: 16 }} sharp={false}>
        <div className="alert info" style={{ margin: 0 }}>
          <Icon.link2/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">Link público enviado ao fornecedor</div>
            <div className="alert__sub mono" style={{ fontSize: 12, marginTop: 2 }}>{url}</div>
          </div>
        </div>
      </Card>

      {!temResposta && (
        <Card sub="Ainda não há resposta registrada para esta cotação.">
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
            Aguardando o fornecedor preencher o formulário técnico pelo link público.
          </div>
        </Card>
      )}

      <div className="split--wide split">
        <Card title="Dados enviados">
          <KvBlock label="Fornecedor" value={cot.fornecedor}/>
          <KvBlock label="Categoria" value={cfCategoriaLabel(cot.categoria_produto)}/>
          <KvBlock label="Nº Cotação (cliente)" value={cot.dados_envio?.header?.numero_cotacao ?? '—'} mono/>
          <KvBlock label="Unidades" value={(cot.dados_envio?.unidades || []).map((u) => u.identificador).join(', ') || '—'}/>
        </Card>
        <Card title="Linha do tempo">
          <KvBlock label="Enviado em" value={cot.sent_at ? fmtDateLong(cot.sent_at) : '—'}/>
          <KvBlock label="Visualizado em" value={cot.viewed_at ? fmtDateLong(cot.viewed_at) : '—'}/>
          <KvBlock label="Respondido em" value={cot.responded_at ? fmtDateLong(cot.responded_at) : '—'}/>
          <KvBlock label="Decidido comprar em" value={cot.decidido_em ? fmtDateLong(cot.decidido_em) : '—'}/>
          <KvBlock label="Aprovado em" value={cot.aprovado_em ? fmtDateLong(cot.aprovado_em) : '—'}/>
        </Card>
      </div>

      {verResp && <FECotacaoRespostaModal cot={cot} onClose={() => setVerResp(false)}/>}
    </div>
  );
}

Object.assign(window, { CotacoesFornecedorPage, CotacaoFornecedorDetalhe });
