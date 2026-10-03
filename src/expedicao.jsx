/* ============================================================
   expedicao.jsx — Logística Interna · Expedição (envio do que foi fabricado ao cliente).
   Fluxo: Fabricação concluída → Emissão de NF (Fiscal/Financeiro, no Omie) → Expedição.
   A Expedição só libera pedido com NF emitida (faturado no Omie); a trava existe no banco
   (trigger fn_pcp_expedicao_exige_nf), então vale mesmo chamando a API direto.
   Dados: pcp_pedidos / pcp_pedido_itens (lidos do Omie pela função sync-pcp-pedidos), pcp_ordens (OP-mãe do pedido),
   pcp_expedicoes (despacho e entrega). Comprovante/canhoto vai para o bucket público "engenharia".
   ============================================================ */

function expData(d) { return d ? d.split('-').reverse().join('/') : '—'; }
function expFmt(v, d = 3) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function expHoje() { return new Date().toISOString().slice(0, 10); }
function expUsuario() { return (window.__VP_USER && window.__VP_USER.email) || null; }

function ExpedicaoPage({ setRoute, setSubsel }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('pronto');
  const [aberto, setAberto] = React.useState(null);          // codigo_pedido em edição
  const [itens, setItens] = React.useState([]);
  const [form, setForm] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [p, o, e] = await Promise.all([
      sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_endereco, cliente_telefone, data_pedido, data_previsao, faturado, data_faturamento, nf_autorizada, cancelado, volumes, peso_bruto, valor_total').eq('cancelado', false).order('data_previsao', { ascending: true }).limit(500),
      sb.from('pcp_ordens').select('id, numero, pedido_codigo, status').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
      sb.from('pcp_expedicoes').select('*').limit(1000),
    ]);
    const err = p.error || o.error || e.error;
    if (err) { setErro(err.message); return; }
    const maes = {}; (o.data || []).forEach(x => { maes[x.pedido_codigo] = x; });
    const exps = {}; (e.data || []).forEach(x => { exps[x.pedido_codigo] = x; });
    setErro(null); setDados({ pedidos: p.data || [], maes, exps });
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('expedicao', 'editar')).then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Situação de cada pedido na linha de expedição.
  const situacao = (p) => {
    const x = dados.exps[p.codigo_pedido];
    if (x && x.status === 'entregue') return 'entregue';
    if (x && x.status === 'despachado') return 'despachado';
    if (p.faturado) return 'pronto';
    return 'aguardando_nf';
  };
  const atualizarOmie = async () => {
    setBusy(true);
    try {
      const { data, error } = await sb.functions.invoke('sync-pcp-pedidos', { body: { atualizar_abertos: true } });
      if (error) throw error;
      window.toast?.(`Omie lido: ${data.gravados || 0} pedido(s) atualizado(s).`);
    } catch (e) { window.toast?.('Não foi possível atualizar do Omie: ' + e.message); }
    setBusy(false); carregar();
  };
  const abrir = async (p) => {
    setAberto(p.codigo_pedido);
    const x = dados.exps[p.codigo_pedido] || {};
    setForm({
      retirada: !!x.retirada, transportadora: x.transportadora || '', volumes: x.volumes ?? p.volumes ?? '', data_saida: x.data_saida || expHoje(),
      rastreio: x.rastreio || '', data_entrega: x.data_entrega || expHoje(), comprovante: x.comprovante || '', observacao: x.observacao || '',
    });
    const { data } = await sb.from('pcp_pedido_itens').select('seq, codigo, descricao, unidade, quantidade, item_pcp').eq('codigo_pedido', p.codigo_pedido).order('seq');
    setItens(data || []);
  };
  const gravar = async (p, status) => {
    const nPedido = p.numero_pedido;
    if (status === 'despachado' && !form.retirada && !String(form.transportadora).trim()) { window.toast?.('Informe a transportadora (ou marque retirada pelo cliente).'); return; }
    if (status === 'entregue' && !form.data_entrega) { window.toast?.('Informe a data da entrega.'); return; }
    setBusy(true);
    const linha = {
      pedido_codigo: p.codigo_pedido, status, retirada: !!form.retirada, transportadora: form.retirada ? null : (String(form.transportadora).trim() || null),
      volumes: form.volumes === '' ? null : Number(form.volumes), data_saida: form.data_saida || null, rastreio: String(form.rastreio).trim() || null,
      data_entrega: status === 'entregue' ? form.data_entrega : null, comprovante: String(form.comprovante).trim() || null,
      observacao: String(form.observacao).trim() || null, atualizado_por: expUsuario(),
    };
    if (!dados.exps[p.codigo_pedido]) linha.criado_por = expUsuario();
    const { error } = await sb.from('pcp_expedicoes').upsert(linha, { onConflict: 'pedido_codigo' });
    setBusy(false);
    if (error) { window.toast?.(error.message.includes('Expedição bloqueada') ? 'Bloqueado: o pedido ainda não tem NF emitida no Omie.' : 'Não foi possível salvar: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Expedição', acao: status === 'entregue' ? 'Confirmou entrega' : 'Registrou saída', alvo: `Pedido ${nPedido} — ${p.cliente_nome || ''}` });
    window.toast?.(status === 'entregue' ? 'Entrega confirmada.' : 'Saída registrada.');
    setAberto(null); carregar();
  };
  const anexar = async (p, arquivo) => {
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { window.toast?.('Arquivo acima de 10 MB.'); return; }
    setBusy(true);
    try {
      const nome = arquivo.name.replace(/[^\w.\-]+/g, '_');
      const caminho = `expedicao/${p.codigo_pedido}/${Date.now()}_${nome}`;
      const up = await sb.storage.from('engenharia').upload(caminho, arquivo, { upsert: false });
      if (up.error) throw up.error;
      const { data } = sb.storage.from('engenharia').getPublicUrl(caminho);
      setForm(f => ({ ...f, comprovante: data.publicUrl }));
      window.toast?.('Comprovante anexado. Confirme a entrega para salvar.');
    } catch (e) { window.toast?.('Não foi possível anexar: ' + (e.message || e)); }
    setBusy(false);
  };

  if (erro) return <div className="page"><div style={{ color: 'var(--vp-danger)', padding: 16 }}>{erro}</div></div>;
  if (!dados) return <div className="page"><div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div></div>;

  const contagem = { aguardando_nf: 0, pronto: 0, despachado: 0, entregue: 0 };
  dados.pedidos.forEach(p => { contagem[situacao(p)]++; });
  const lista = dados.pedidos.filter(p => filtro === 'todos' || situacao(p) === filtro);
  const cor = { aguardando_nf: undefined, pronto: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', despachado: 'color-mix(in srgb, #3b82c4 25%, transparent)', entregue: 'color-mix(in srgb, #2e9e5b 25%, transparent)' };
  const rotulo = { aguardando_nf: 'Aguardando NF', pronto: 'Pronto para expedir', despachado: 'Despachado', entregue: 'Entregue' };
  const kpi = (chave, rot) => (
    <button className="card pcp-total" onClick={() => setFiltro(chave)} style={{ padding: 14, flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', outline: filtro === chave ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{contagem[chave]}</div>
    </button>
  );

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Expedição</div>
          <h1 className="page-head__title">Expedição</h1>
          <p className="page-head__sub">Envio ao cliente do que foi fabricado. Só libera pedido com NF emitida.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('aguardando_nf', 'Aguardando NF')}
        {kpi('pronto', 'Prontos para expedir')}
        {kpi('despachado', 'Despachados')}
        {kpi('entregue', 'Entregues')}
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (filtro === 'todos' ? ' btn--primary' : '')} onClick={() => setFiltro('todos')}>Todos</button>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" disabled={busy} onClick={atualizarOmie} title="Relê no Omie os pedidos ainda não entregues, para pegar NF emitida">{busy ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Produção</th><th>NF</th><th>Previsão</th><th>Expedição</th><th></th></tr></thead>
          <tbody>
            {lista.map(p => {
              const s = situacao(p), x = dados.exps[p.codigo_pedido], mae = dados.maes[p.codigo_pedido];
              return (
                <React.Fragment key={p.codigo_pedido}>
                  <tr>
                    <td><b style={{ fontWeight: 500 }}>{p.numero_pedido}</b></td>
                    <td style={{ minWidth: 220 }}>{p.cliente_nome || '—'}</td>
                    <td>{mae ? <button className="pcp-cod" onClick={() => { try { sessionStorage.setItem('vp_pcp_op', mae.id); } catch (e) { /* ok */ } setSubsel && setSubsel(null); setRoute && setRoute('pcp'); }}>{mae.numero}</button> : <span style={{ color: 'var(--fg3)' }}>sem OP</span>}{mae && <span className="pcp-tag" style={{ marginLeft: 6 }}>{mae.status === 'concluida' ? 'concluída' : mae.status.replace('_', ' ')}</span>}</td>
                    <td>{p.faturado ? <>NF emitida <span style={{ color: 'var(--fg3)' }}>{expData(p.data_faturamento)}</span></> : <span style={{ color: 'var(--fg3)' }}>não emitida</span>}</td>
                    <td>{expData(p.data_previsao)}</td>
                    <td><span className="pcp-tag" style={cor[s] ? { background: cor[s] } : undefined}>{rotulo[s]}</span>{x && x.status !== 'aguardando' && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{x.retirada ? 'retirada pelo cliente' : x.transportadora}{x.data_saida ? ' · saiu ' + expData(x.data_saida) : ''}{x.data_entrega ? ' · entregue ' + expData(x.data_entrega) : ''}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s === 'aguardando_nf'
                        ? <span title="O Fiscal emite a NF no Omie; depois clique em Atualizar do Omie" style={{ fontSize: 11, color: 'var(--fg3)' }}>trava até ter NF</span>
                        : <button className="btn btn--sm" onClick={() => (aberto === p.codigo_pedido ? setAberto(null) : abrir(p))}>{aberto === p.codigo_pedido ? 'Fechar' : (s === 'entregue' ? 'Ver' : (s === 'despachado' ? 'Confirmar entrega' : 'Expedir'))}</button>}
                    </td>
                  </tr>
                  {aberto === p.codigo_pedido && (
                    <tr><td colSpan={7} style={{ background: 'var(--vp-gray-50)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.2fr)', gap: 18, padding: 6 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4 }}>Itens a enviar ({itens.length})</div>
                          <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 12 }}>
                            {itens.map(i => <div key={i.seq} style={{ padding: '3px 0', borderBottom: '1px solid var(--vp-gray-100)' }}>{i.item_pcp ? <b style={{ fontWeight: 500 }}>{i.codigo}</b> : i.codigo} · {i.descricao} <span style={{ color: 'var(--fg3)' }}>× {expFmt(i.quantidade)} {i.unidade || ''}</span></div>)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>{p.cliente_endereco || ''}{p.cliente_telefone ? ' · ' + p.cliente_telefone : ''}</div>
                        </div>
                        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                          {s !== 'entregue' && (<>
                            <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!form.retirada} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, retirada: e.target.checked })}/> Retirada pelo cliente</label>
                            {!form.retirada && <input className="input" placeholder="Transportadora" value={form.transportadora} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, transportadora: e.target.value })} style={{ width: 200 }}/>}
                            <input className="input" type="number" min="0" placeholder="Volumes" value={form.volumes} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, volumes: e.target.value })} style={{ width: 90 }}/>
                            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Saída <input className="input" type="date" value={form.data_saida} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, data_saida: e.target.value })}/></label>
                            <input className="input" placeholder="Rastreio / nº do conhecimento" value={form.rastreio} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, rastreio: e.target.value })} style={{ width: 220 }}/>
                          </>)}
                          {(s === 'despachado' || s === 'entregue') && (<>
                            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Entrega <input className="input" type="date" value={form.data_entrega} disabled={!podeEditar || s === 'entregue'} onChange={e => setForm({ ...form, data_entrega: e.target.value })}/></label>
                            {s === 'despachado' && podeEditar && <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Canhoto / comprovante <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => anexar(p, e.target.files[0])}/></label>}
                            {form.comprovante && <a href={form.comprovante} target="_blank" rel="noopener noreferrer" className="pcp-cod" style={{ fontSize: 12 }}>ver comprovante</a>}
                          </>)}
                          <input className="input" placeholder="Observação" value={form.observacao} disabled={!podeEditar || s === 'entregue'} onChange={e => setForm({ ...form, observacao: e.target.value })} style={{ flex: '1 1 100%' }}/>
                          {podeEditar && s === 'pronto' && <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => gravar(p, 'despachado')}>Registrar saída</button>}
                          {podeEditar && s === 'despachado' && <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => gravar(p, 'entregue')}>Confirmar entrega</button>}
                          {!podeEditar && <span style={{ fontSize: 11, color: 'var(--fg3)' }}>Somente leitura — falta a alçada de edição da Expedição.</span>}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum pedido nesta situação.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        A NF é emitida no Omie pelo Fiscal/Financeiro; “Atualizar do Omie” traz o status. Sem NF emitida o banco recusa o despacho. O cliente recebe o pedido inteiro, inclusive os itens que não são do PCP (em negrito, os do PCP).
      </div>
    </div>
  );
}

Object.assign(window, { ExpedicaoPage });
