/* ============================================================
   controle-cotacoes.jsx — Controle de Cotações (Formulário de Elevadores)
   Grid pesquisável unindo o histórico real da planilha de controle
   (cotacoes_elevador_historico) com as cotações novas criadas pelo
   Formulário de Elevadores (formularios_elevador). Ver issues #76/#79.
   window.ControleCotacoesPage — rota "controle-cotacoes".
   ============================================================ */
const CC_STATUS_VARIANT = {
  Conquistado: 'success', concluido: 'success', Perdido: 'danger',
  Suspenso: 'warning', em_cotacao: 'warning',
  'Em andamento': 'info', enviado: 'info', rascunho: 'neutral',
};

function CcStatusChip({ status }) {
  if (!status) return <span className="muted">—</span>;
  return <Badge variant={CC_STATUS_VARIANT[status] || 'neutral'} style={{ whiteSpace: 'nowrap' }}>{status}</Badge>;
}

/* "2026-09-30" -> "30/09/2026" (texto puro: new Date() cairia um dia no fuso BR) */
function ccDataBR(d) {
  const m = String(d || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d ? String(d).slice(0, 10) : '—');
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
  const [abrindo, setAbrindo] = React.useState(null);
  const [abrindoTrat, setAbrindoTrat] = React.useState(null);
  const [escolherForn, setEscolherForn] = React.useState(null);

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

  /* Abre o Formulário — Equipamento pra editar. Linha de "Formulário" já tem
     o registro real (r.id = formularios_elevador.id), abre direto. Linha de
     "Planilha" ainda não tem Formulário por trás — a primeira vez que
     alguém clica, "ressuscita" a cotação histórica como um Formulário de
     verdade (Nº novo, cliente resolvido pelo CNPJ/nome, 1 equipamento com a
     descrição original pra completar/duplicar/remover à vontade). Cliques
     seguintes na mesma cotação (já convertida) só reabrem o mesmo Formulário. */
  const abrirNoFormulario = async (r) => {
    setAbrindo(r.id);
    try {
      const formularioId = r.origem === 'formulario'
        ? r.id
        : await window.FormularioElevadorStore.abrirOuConverterHistorico(r.id);
      if (r.origem !== 'formulario') {
        window.toast?.('Cotação da planilha ressuscitada como Formulário — novo Nº atribuído.', 'success');
      }
      setSubsel(formularioId);
      setRoute('formulario-elevador');
    } catch (e) {
      window.toast?.('Erro ao abrir Formulário: ' + e.message, 'error');
    } finally {
      setAbrindo(null);
    }
  };

  /* Tratativas com o fornecedor: leva à aba Tratativas da cotação a fornecedor
     (/comercial/cotacao-fornecedor-detail/<id>/tratativas). Com mais de um
     fornecedor na cotação, pergunta de qual. */
  const irParaTratativas = (cot) => {
    const caminho = '/comercial/cotacao-fornecedor-detail/' + cot.id + '/tratativas';
    try { window.history.pushState({}, '', caminho); window.dispatchEvent(new PopStateEvent('popstate')); }
    catch (e) { window.location.assign(caminho); }
  };
  const abrirTratativas = async (r) => {
    setAbrindoTrat(r.id);
    try {
      const lista = await window.CotacaoElevadorFornecedorStore.listarPorFormulario(r.id);
      if (!lista || lista.length === 0) {
        window.toast?.('Esta cotação ainda não foi enviada a nenhum fornecedor — não há tratativas.', 'warning');
      } else if (lista.length === 1) {
        irParaTratativas(lista[0]);
      } else {
        setEscolherForn({ numero: r.numero_cotacao, lista });
      }
    } catch (e) {
      window.toast?.('Erro ao abrir tratativas: ' + e.message, 'error');
    } finally {
      setAbrindoTrat(null);
    }
  };

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

  const contagem = React.useMemo(() => {
    const c = {};
    (rows || []).forEach((r) => { if (r.status) c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const conquistadas = contagem['Conquistado'] || 0;
  const decididas = conquistadas + (contagem['Perdido'] || 0);
  const emAberto = (rows || []).filter((r) => !['Conquistado', 'Perdido', 'Suspenso', 'concluido'].includes(r.status)).length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Controle de Cotações</div>
          <h1 className="page-head__title">Controle de Cotações</h1>
          <p className="page-head__sub">Histórico completo de cotações de elevadores — planilha legada + cotações do Formulário digital.</p>
        </div>
        <div className="page-head__r">
          <Button variant="ghost" icon="chevLeft" onClick={() => setRoute('formulario-elevador')}>Voltar</Button>
          <Button variant="outline" icon="refresh" onClick={carregar} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
      </div>

      <div className="grid-3" style={{ margin: '20px 0' }}>
        <KPI label="Em aberto" value={rows ? emAberto : '…'} sub="rascunho, enviadas e em andamento" icon="history"/>
        <KPI label="Conquistadas" value={rows ? conquistadas : '…'} sub={rows && decididas ? `${Math.round(conquistadas / decididas * 100)}% das decididas` : 'status Conquistado'} icon="check"/>
        <KPI label="Cotação mais recente" value={rows && rows.length ? window.MasterIdEngine.etapaId('cotacao', rows[0].numero_cotacao) : '—'} sub={`${rows ? rows.length : '…'} no total`} icon="grid"/>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Buscar por cliente, vendedor, CNPJ ou nº da cotação…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <span className="small" style={{ color: 'var(--fg3)' }}>{rows ? filtradas.length : '…'} cotação(ões)</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['Todos'].concat(statusDisponiveis).map((s) => (
          <Button key={s} size="sm" variant={fStatus === s ? 'primary' : 'ghost'} onClick={() => setFStatus(s)}>
            {s} <span style={{ opacity: .7 }}>({s === 'Todos' ? (rows ? rows.length : 0) : (contagem[s] || 0)})</span>
          </Button>
        ))}
      </div>

      <Card title="Cotações" sub="Planilha legada + Formulário digital · clique numa linha do Formulário para abrir a cadeia de tratativas">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr>
              <th>Nº Cotação</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>UF</th>
              <th>Status</th>
              <th>Origem</th>
              <th></th>
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
                    <td style={{ whiteSpace: 'nowrap' }}><span className="mono small">{r.numero_cotacao != null ? window.MasterIdEngine.etapaId('cotacao', r.numero_cotacao) : '—'}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className="mono small">{ccDataBR(r.data)}</span></td>
                    <td style={{ fontSize: 12.5 }}>{r.nome_cliente || <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.vendedor || <span className="muted">—</span>}</td>
                    <td>{r.estado_instalacao || <span className="muted">—</span>}</td>
                    <td><CcStatusChip status={r.status}/></td>
                    <td className="small" style={{ color: 'var(--fg3)' }}>{r.origem === 'historico' ? 'Planilha' : 'Formulário'}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {r.origem === 'formulario' && (
                        <Button variant="outline" size="sm" icon="message" disabled={abrindoTrat === r.id}
                          onClick={() => abrirTratativas(r)} style={{ marginRight: 6 }}>
                          {abrindoTrat === r.id ? 'Abrindo…' : 'Tratativas'}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon="ruler" disabled={abrindo === r.id}
                        title="Abrir no Formulário" aria-label="Abrir no Formulário"
                        onClick={() => abrirNoFormulario(r)}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {escolherForn && (
        <Modal title={`Tratativas — Cotação Nº ${escolherForn.numero}`} onClose={() => setEscolherForn(null)} width={460}>
          <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 0 }}>Esta cotação foi enviada a mais de um fornecedor. Escolha com qual abrir as tratativas:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {escolherForn.lista.map((c) => (
              <Button key={c.id} variant="outline" onClick={() => { setEscolherForn(null); irParaTratativas(c); }}>
                {c.fornecedor || c.recipient?.nome || c.numero_documento || 'Fornecedor'}{c.status ? ` · ${c.status}` : ''}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {cadeiaDe != null && (
        <ModalCadeiaCotacao numeroCotacao={cadeiaDe} setRoute={setRoute} setSubsel={setSubsel} onClose={() => setCadeiaDe(null)}/>
      )}
    </div>
  );
}

window.ControleCotacoesPage = ControleCotacoesPage;
