/* ============================================================
   emissao-nf.jsx — Financeiro/Fiscal · Emissão de NF (acompanhamento + SLA + conferência).
   Fluxo: Fabricação concluída → Emissão de NF → Expedição.
   A NF é emitida NO OMIE pelo Fiscal; esta tela NÃO emite nada: mostra quais pedidos já podem ser
   faturados (produção concluída), quais já têm NF (campo "faturado" do pedido no Omie), o SLA de cada etapa
   (src/pcp-pedido-sla.js) e permite registrar a conferência proposta × NF (pcp_pedido_acompanhamento).
   Um mesmo nº de pedido pode ter VÁRIOS registros no Omie (parciais): a tela agrupa por numero_pedido.
   Dados: pcp_pedidos, pcp_ordens (OP-mãe), pcp_expedicoes, pcp_pedido_acompanhamento.
   ============================================================ */

function nfData(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
function nfMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function nfHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function nfUsuario() { return (window.__VP_USER && window.__VP_USER.email) || null; }
const NF_ETAPA = window.PCP_ETAPAS_OMIE;      // tabela única das telas do PCP (src/pcp-etapas-omie.js)
const NF_CONF = { pendente: 'Conferência pendente', conferida: 'Conferida', regularizar: 'Entregue — regularizar NF' };
const NF_SLA_ROT = { op: 'OP', producao: 'Produção', nf: 'NF', despacho: 'Despacho' };
const NF_SLA_COR = {
  ok: 'color-mix(in srgb, #2e9e5b 25%, transparent)',
  ok_atraso: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)',
  andamento: undefined,
  atrasada: 'color-mix(in srgb, var(--vp-danger) 30%, transparent)',
  aguardando: undefined,
};
const NF_SLA_TXT = { ok: 'no prazo', ok_atraso: 'fora do prazo', andamento: 'em andamento', atrasada: 'ATRASADA', aguardando: '—' };

function EmissaoNFPage({ setRoute, setSubsel }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('aguardando');
  const [busy, setBusy] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);
  /* Bug real (varredura de URLs, 09/10): a rota recebe setSubsel mas não está
     em nenhum dos 3 mecanismos de deep-link de app.jsx — escreve/lê o 2º
     segmento direto (/adm-financeiro/emissao-nf/<numero_pedido>), sem
     depender de subsel, mesmo padrão do Mapa de Navios. */
  const [aberto, setAberto] = window.useRotaId('emissao-nf');    // numero_pedido em conferência
  const [form, setForm] = React.useState({ conferencia: 'pendente', historico: false, observacao: '' });

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [p, o, e, a] = await Promise.all([
      sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_documento, data_pedido, data_previsao, entrada_em, faturado, data_faturamento, nf_autorizada, cancelado, valor_total, atualizado_em').eq('cancelado', false).order('data_previsao', { ascending: true }).limit(500),
      sb.from('pcp_ordens').select('id, numero, pedido_codigo, status, created_at, data_finalizacao, prazo_entrega').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
      sb.from('pcp_expedicoes').select('pedido_codigo, status, data_saida').limit(1000),
      sb.from('pcp_pedido_acompanhamento').select('*').limit(1000),
    ]);
    const err = p.error || o.error || e.error || a.error;
    if (err) { setErro(err.message); return; }
    const maes = {}; (o.data || []).forEach(x => { maes[x.pedido_codigo] = x; });
    const exps = {}; (e.data || []).forEach(x => { exps[x.pedido_codigo] = x; });
    const acomp = {}; (a.data || []).forEach(x => { acomp[x.numero_pedido] = x; });
    // Agrupa os registros do Omie por nº de pedido.
    const mapa = {};
    (p.data || []).forEach(r => { (mapa[r.numero_pedido] = mapa[r.numero_pedido] || []).push(r); });
    setErro(null); setDados({ grupos: Object.entries(mapa).map(([numero, regs]) => ({ numero, regs })), maes, exps, acomp });
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('emissao-nf', 'editar')).then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  // Restaura o form de conferência ao chegar pela URL (deep-link/F5/Voltar-Avançar).
  React.useEffect(() => {
    if (!aberto || !dados) return;
    const g = dados.grupos.find((x) => x.numero === aberto);
    if (!g) return;
    const ac = dados.acomp[g.numero] || null;
    setForm({ conferencia: (ac && ac.conferencia) || 'pendente', historico: !!(ac && ac.historico), observacao: (ac && ac.observacao) || '' });
  }, [dados, aberto]);

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

  const hoje = nfHoje();
  const ultimaLeitura = dados.grupos.flatMap(g => g.regs).map(r => r.atualizado_em).filter(Boolean).sort().pop() || null;
  // Resumo de um grupo (todos os registros do mesmo nº de pedido).
  const resumo = (g) => {
    const mae = g.regs.map(r => dados.maes[r.codigo_pedido]).find(Boolean) || null;
    const exps = g.regs.map(r => dados.exps[r.codigo_pedido]).filter(Boolean);
    const ac = dados.acomp[g.numero] || null;
    const fat = g.regs.filter(r => r.faturado);
    const todosFat = fat.length === g.regs.length;
    const nfEm = todosFat ? fat.map(r => r.data_faturamento).filter(Boolean).sort().pop() || null : null;
    const saida = exps.map(x => x.data_saida).filter(Boolean).sort()[0] || null;
    const entrada = g.regs.map(r => r.entrada_em).filter(Boolean).sort()[0] || null;
    const prazo = (mae && mae.prazo_entrega) || g.regs.map(r => r.data_previsao).filter(Boolean).sort()[0] || null;
    const sla = window.PcpPedidoSLA.calcular({
      historico: !!(ac && ac.historico), entrada_em: entrada, opCriadaEm: mae ? mae.created_at : null,
      producaoPrazo: prazo, producaoFeita: mae && mae.status === 'concluida' ? (mae.data_finalizacao || hoje) : null,
      nfEm, despachoEm: saida,
    }, hoje);
    let situacao;
    if (todosFat) situacao = 'emitida';
    else if (fat.length) situacao = 'parcial';
    else if (mae && mae.status === 'concluida') situacao = 'aguardando';
    else situacao = 'producao';
    return { mae, ac, fat, situacao, sla, valor: g.regs.reduce((s, r) => s + Number(r.valor_total || 0), 0), nfEm };
  };
  const linhas = dados.grupos.map(g => ({ g, r: resumo(g) }));
  const contagem = { aguardando: 0, producao: 0, parcial: 0, emitida: 0, atrasados: 0, historico: 0 };
  linhas.forEach(({ r }) => {
    if (r.sla.historico) contagem.historico++;
    else { contagem[r.situacao]++; if (r.sla.atrasado) contagem.atrasados++; }
  });
  const lista = linhas.filter(({ r }) => {
    if (filtro === 'todos') return true;
    if (filtro === 'historico') return r.sla.historico;
    if (r.sla.historico) return false;
    if (filtro === 'atrasados') return r.sla.atrasado;
    return r.situacao === filtro;
  });
  const rotulo = { aguardando: 'Aguardando emissão', producao: 'Em produção / sem OP', parcial: 'NF parcial', emitida: 'NF emitida' };
  const cor = { aguardando: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', producao: undefined, parcial: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', emitida: 'color-mix(in srgb, #2e9e5b 25%, transparent)' };
  const kpi = (chave, rot) => (
    <button className="card pcp-total" onClick={() => setFiltro(chave)} style={{ padding: 14, flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', outline: filtro === chave ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{contagem[chave]}</div>
    </button>
  );

  const abrir = (g, r) => {
    setForm({ conferencia: (r.ac && r.ac.conferencia) || 'pendente', historico: !!(r.ac && r.ac.historico), observacao: (r.ac && r.ac.observacao) || '' });
    setAberto(g.numero);
  };
  const salvar = async (g) => {
    const { error } = await sb.from('pcp_pedido_acompanhamento').upsert({
      numero_pedido: g.numero, historico: form.historico, conferencia: form.conferencia,
      observacao: form.observacao.trim() || null, atualizado_por: nfUsuario(), updated_at: new Date().toISOString(),
    }, { onConflict: 'numero_pedido' });
    if (error) { window.toast?.('Não foi possível salvar: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Emissão de NF', acao: 'Registrou conferência do pedido', alvo: `Pedido ${g.numero} — ${NF_CONF[form.conferencia]}${form.historico ? ' (histórico)' : ''}` });
    window.toast?.('Conferência registrada.');
    setAberto(null); carregar();
  };

  const chipsSla = (sla) => {
    if (sla.historico) return <span className="pcp-tag">histórico — sem SLA</span>;
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(sla.etapas).map(([k, e]) => (
          <span key={k} className="pcp-tag" style={NF_SLA_COR[e.estado] ? { background: NF_SLA_COR[e.estado] } : undefined}
            title={e.limite ? `Limite ${nfData(e.limite)}${e.feito ? ` · feito ${nfData(e.feito)}` : ''}` : 'Aguarda a etapa anterior'}>
            {NF_SLA_ROT[k]}: {NF_SLA_TXT[e.estado]}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Fiscal</div>
          <h1 className="page-head__title">Emissão de NF</h1>
          <p className="page-head__sub">Acompanha os pedidos fabricados, o SLA de cada etapa e a conferência proposta × NF. A nota é emitida no Omie. Leitura automática do Omie a cada 30 min (seg–sex, 7h–19h) · última: {ultimaLeitura ? new Date(ultimaLeitura).toLocaleString('pt-BR') : '—'}.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('aguardando', 'Fabricados — aguardando emissão')}
        {kpi('producao', 'Em produção / sem OP')}
        {kpi('parcial', 'NF parcial')}
        {kpi('emitida', 'NF emitida')}
        {kpi('atrasados', 'SLA atrasado')}
        {kpi('historico', 'Histórico (sem SLA)')}
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (filtro === 'todos' ? ' btn--primary' : '')} onClick={() => setFiltro('todos')}>Todos</button>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" disabled={busy} onClick={atualizarOmie} title="Relê no Omie os pedidos ainda não entregues">{busy ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th className="text-right">Valor</th><th>Produção (OP)</th><th>Registros no Omie / NF</th><th>SLA</th><th>Conferência</th><th></th></tr></thead>
          <tbody>
            {lista.map(({ g, r }) => (
              <React.Fragment key={g.numero}>
                <tr>
                  <td><b style={{ fontWeight: 500 }}>{g.numero}</b>{g.regs.length > 1 && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{g.regs.length} registros</div>}</td>
                  <td style={{ minWidth: 200 }}>{g.regs[0].cliente_nome || '—'}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{g.regs[0].cliente_documento || ''}</div></td>
                  <td className="text-right">{nfMoeda(r.valor)}</td>
                  <td>{r.mae ? <><button className="pcp-cod" onClick={() => { try { sessionStorage.setItem('vp_pcp_op', r.mae.id); } catch (e) { /* ok */ } setSubsel && setSubsel(null); setRoute && setRoute('pcp'); }}>{r.mae.numero}</button><span className="pcp-tag" style={{ marginLeft: 6 }}>{r.mae.status === 'concluida' ? 'concluída' : r.mae.status.replace('_', ' ')}</span></> : <span style={{ color: 'var(--fg3)' }}>sem OP no PCP</span>}</td>
                  <td style={{ minWidth: 210 }}>
                    <span className="pcp-tag" style={cor[r.situacao] ? { background: cor[r.situacao] } : undefined}>{rotulo[r.situacao]}</span>
                    {g.regs.map(x => (
                      <div key={x.codigo_pedido} style={{ fontSize: 10, color: 'var(--fg3)' }}>
                        {NF_ETAPA[x.etapa] || 'Etapa ' + x.etapa} · {nfMoeda(x.valor_total)} · {x.faturado ? `NF ${nfData(x.data_faturamento)}${x.nf_autorizada ? '' : ' (aguardando autorização)'}` : 'sem NF'}
                      </div>
                    ))}
                  </td>
                  <td style={{ minWidth: 230 }}>{chipsSla(r.sla)}</td>
                  <td>
                    <span className="pcp-tag" style={r.ac && r.ac.conferencia === 'regularizar' ? { background: NF_SLA_COR.atrasada } : (r.ac && r.ac.conferencia === 'conferida' ? { background: NF_SLA_COR.ok } : undefined)}>{NF_CONF[(r.ac && r.ac.conferencia) || 'pendente']}</span>
                    {r.ac && r.ac.observacao && <div style={{ fontSize: 10, color: 'var(--fg3)', maxWidth: 220 }} title={r.ac.observacao}>{r.ac.observacao.length > 60 ? r.ac.observacao.slice(0, 60) + '…' : r.ac.observacao}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {podeEditar && <button className="btn btn--sm" onClick={() => (aberto === g.numero ? setAberto(null) : abrir(g, r))}>{aberto === g.numero ? 'Fechar' : 'Conferir'}</button>}
                    {r.fat.length > 0 && <button className="pcp-cod" style={{ marginLeft: 6 }} onClick={() => { setSubsel && setSubsel(null); setRoute && setRoute('expedicao'); }}>Expedição →</button>}
                  </td>
                </tr>
                {aberto === g.numero && (
                  <tr>
                    <td colSpan={8} style={{ background: 'var(--bg2, rgba(0,0,0,.03))' }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: 8 }}>
                        <label style={{ fontSize: 12 }}>Conferência proposta × NF<br/>
                          <select value={form.conferencia} onChange={e => setForm({ ...form, conferencia: e.target.value })}>
                            {Object.entries(NF_CONF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </label>
                        <label style={{ fontSize: 12, flex: '1 1 280px' }}>Observação<br/>
                          <input type="text" style={{ width: '100%' }} value={form.observacao} placeholder="Ex.: entregue em 09/2026; NF da máquina cobre o quadro" onChange={e => setForm({ ...form, observacao: e.target.value })}/>
                        </label>
                        <label style={{ fontSize: 12 }}><input type="checkbox" checked={form.historico} onChange={e => setForm({ ...form, historico: e.target.checked })}/> Histórico (já entregue antes do sistema — sem SLA)</label>
                        <button className="btn btn--sm btn--primary" onClick={() => salvar(g)}>Salvar</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {lista.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum pedido nesta situação.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        SLA: OP criada em até 1 dia útil da entrada do pedido; produção até a previsão; NF em até 1 dia útil após a produção; despacho em até 1 dia útil após a NF. Pedidos “histórico” não têm SLA. Um mesmo nº de pedido pode ter vários registros no Omie (parciais) — a NF só conta como emitida quando todos estão faturados; use “Conferir” para registrar o que foi verificado.
      </div>
    </div>
  );
}

Object.assign(window, { EmissaoNFPage });
