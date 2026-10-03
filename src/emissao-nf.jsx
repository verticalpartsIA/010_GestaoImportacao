/* ============================================================
   emissao-nf.jsx — Financeiro/Fiscal · Emissão de NF (acompanhamento).
   Fluxo: Fabricação concluída → Emissão de NF → Expedição.
   A NF é emitida NO OMIE pelo Fiscal; esta tela NÃO emite nada: mostra quais pedidos já podem ser
   faturados (produção concluída), quais já têm NF (campo "faturado" do pedido no Omie) e leva à Expedição.
   Dados: pcp_pedidos (lidos do Omie pela função sync-pcp-pedidos), pcp_ordens (OP-mãe), pcp_expedicoes.
   ============================================================ */

function nfData(d) { return d ? d.split('-').reverse().join('/') : '—'; }
function nfMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
const NF_ETAPA = { '00': 'Proposta', '10': 'Pedido de Venda', '20': 'Separar estoque / produção', '50': 'Faturar', '60': 'Faturado', '70': 'Entrega', '80': 'Etapa 80' };

function EmissaoNFPage({ setRoute, setSubsel }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('aguardando');
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [p, o, e] = await Promise.all([
      sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_documento, data_pedido, data_previsao, faturado, data_faturamento, nf_autorizada, cancelado, valor_total, atualizado_em').eq('cancelado', false).order('data_previsao', { ascending: true }).limit(500),
      sb.from('pcp_ordens').select('id, numero, pedido_codigo, status').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
      sb.from('pcp_expedicoes').select('pedido_codigo, status').limit(1000),
    ]);
    const err = p.error || o.error || e.error;
    if (err) { setErro(err.message); return; }
    const maes = {}; (o.data || []).forEach(x => { maes[x.pedido_codigo] = x; });
    const exps = {}; (e.data || []).forEach(x => { exps[x.pedido_codigo] = x; });
    setErro(null); setDados({ pedidos: p.data || [], maes, exps });
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const atualizarOmie = async () => {
    setBusy(true);
    try {
      const { data, error } = await sb.functions.invoke('sync-pcp-pedidos', { body: { atualizar_abertos: true } });
      if (error) throw error;
      window.toast?.(`Omie lido: ${data.gravados || 0} pedido(s) atualizado(s).`);
    } catch (e) { window.toast?.('Não foi possível atualizar do Omie: ' + e.message); }
    setBusy(false); carregar();
  };

  if (erro) return <div className="page"><div style={{ color: 'var(--vp-danger)', padding: 16 }}>{erro}</div></div>;
  if (!dados) return <div className="page"><div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div></div>;

  // Situação fiscal de cada pedido.
  const situacao = (p) => {
    if (p.faturado) return 'emitida';
    const mae = dados.maes[p.codigo_pedido];
    if (mae && mae.status === 'concluida') return 'aguardando';       // fabricado, falta emitir a NF
    return 'producao';                                               // ainda em fabricação (ou sem OP no PCP)
  };
  const contagem = { aguardando: 0, producao: 0, emitida: 0 };
  dados.pedidos.forEach(p => { contagem[situacao(p)]++; });
  const lista = dados.pedidos.filter(p => filtro === 'todos' || situacao(p) === filtro);
  const rotulo = { aguardando: 'Aguardando emissão', producao: 'Em produção / sem OP', emitida: 'NF emitida' };
  const cor = { aguardando: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', producao: undefined, emitida: 'color-mix(in srgb, #2e9e5b 25%, transparent)' };
  const kpi = (chave, rot) => (
    <button className="card pcp-total" onClick={() => setFiltro(chave)} style={{ padding: 14, flex: '1 1 170px', textAlign: 'left', cursor: 'pointer', outline: filtro === chave ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{contagem[chave]}</div>
    </button>
  );

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Fiscal</div>
          <h1 className="page-head__title">Emissão de NF</h1>
          <p className="page-head__sub">Acompanha quais pedidos já foram fabricados e aguardam a NF. A nota é emitida no Omie.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('aguardando', 'Fabricados — aguardando emissão')}
        {kpi('producao', 'Em produção / sem OP')}
        {kpi('emitida', 'NF emitida')}
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (filtro === 'todos' ? ' btn--primary' : '')} onClick={() => setFiltro('todos')}>Todos</button>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" disabled={busy} onClick={atualizarOmie} title="Relê no Omie os pedidos ainda não entregues">{busy ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th className="text-right">Valor do pedido</th><th>Produção (OP)</th><th>Etapa no Omie</th><th>NF</th><th></th></tr></thead>
          <tbody>
            {lista.map(p => {
              const s = situacao(p), mae = dados.maes[p.codigo_pedido], exp = dados.exps[p.codigo_pedido];
              return (
                <tr key={p.codigo_pedido}>
                  <td><b style={{ fontWeight: 500 }}>{p.numero_pedido}</b></td>
                  <td style={{ minWidth: 220 }}>{p.cliente_nome || '—'}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{p.cliente_documento || ''}</div></td>
                  <td className="text-right">{nfMoeda(p.valor_total)}</td>
                  <td>{mae ? <><button className="pcp-cod" onClick={() => { try { sessionStorage.setItem('vp_pcp_op', mae.id); } catch (e) { /* ok */ } setSubsel && setSubsel(null); setRoute && setRoute('pcp'); }}>{mae.numero}</button><span className="pcp-tag" style={{ marginLeft: 6 }}>{mae.status === 'concluida' ? 'concluída' : mae.status.replace('_', ' ')}</span></> : <span style={{ color: 'var(--fg3)' }}>sem OP no PCP</span>}</td>
                  <td>{NF_ETAPA[p.etapa] || 'Etapa ' + p.etapa}</td>
                  <td><span className="pcp-tag" style={cor[s] ? { background: cor[s] } : undefined}>{rotulo[s]}</span>{p.faturado && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{nfData(p.data_faturamento)}{p.nf_autorizada ? ' · autorizada' : ' · aguardando autorização'}</div>}</td>
                  <td>{p.faturado && <button className="pcp-cod" onClick={() => { setSubsel && setSubsel(null); setRoute && setRoute('expedicao'); }}>{exp ? 'Expedição: ' + exp.status : 'Ir para a Expedição →'}</button>}</td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum pedido nesta situação.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Esta tela só acompanha: o Fiscal emite a NF dentro do Omie e, ao clicar em “Atualizar do Omie”, o pedido aparece como NF emitida e é liberado para a Expedição. Pedidos entram aqui quando têm quadros, corrimãos ou cabos (itens do PCP).
      </div>
    </div>
  );
}

Object.assign(window, { EmissaoNFPage });
