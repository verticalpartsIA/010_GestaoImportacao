/* ============================================================
   mes.jsx — Logística Interna · MES (Sistema de Execução da Manufatura) · Fase 1.
   OP (reaproveita pcp_ordens, frente 'quadro') → Kanban por macroetapa → etapa com checklist obrigatório → histórico.
   A OP só avança por "Concluir etapa" (valida o checklist); histórico imutável em mes_historico.
   Fases seguintes: apontamentos/materiais/bloqueios, fiação/testes/NC, embalagem/expedição/painel TV.
   ============================================================ */

const MES_MACROS = ['Furação', 'Estrutura', 'Componentes', 'Fiação', 'Testes', 'Qualidade', 'Embalagem', 'Expedição'];
const mesUser = () => (window.__VP_USER && window.__VP_USER.email) || null;
function mesDur(desde) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
}
function mesPrazoCor(op, concluida) {
  if (concluida || !op.prazo_entrega) return 'var(--fg3)';
  const dias = Math.floor((new Date(op.prazo_entrega + 'T23:59:59') - Date.now()) / 86400000);
  return dias < 0 ? 'var(--vp-danger, #c0392b)' : dias <= 2 ? '#d9a400' : '#2e9e5b';
}
const mesData = (d) => d ? d.split('-').reverse().join('/') : '—';

function mesProgresso(etapas, atual) {
  const ativas = etapas.filter(e => e.ativo);
  const total = ativas.reduce((s, e) => s + Number(e.peso || 0), 0) || 1;
  if (atual === 'EXPEDIDO') return 100;
  const seqAtual = (ativas.find(e => e.codigo === atual) || { sequencia: 0 }).sequencia;
  const feito = ativas.filter(e => e.sequencia < seqAtual).reduce((s, e) => s + Number(e.peso || 0), 0);
  return Math.round(feito / total * 100);
}
function mesNomeEtapa(etapas, cod) {
  if (cod === 'AGUARDANDO') return 'Aguardando início';
  if (cod === 'EXPEDIDO') return 'Expedido';
  return (etapas.find(e => e.codigo === cod) || {}).nome || cod;
}
async function mesHist(sb, ordemId, evento, de, para, descricao) {
  await sb.from('mes_historico').insert({ ordem_id: ordemId, usuario: mesUser(), evento, de_etapa: de || null, para_etapa: para || null, descricao: descricao || null });
}

/* ---------------- Liberar OP para o MES ---------------- */
function MESLiberar({ ctx, onFechar }) {
  const { sb } = ctx;
  const [lista, setLista] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const [o, m] = await Promise.all([
        sb.from('pcp_ordens').select('id, numero, titulo, produto, cliente, prazo_entrega, status, frente').eq('frente', 'quadro').in('status', ['aguardando', 'em_producao']).order('created_at', { ascending: false }).limit(200),
        sb.from('mes_ordens').select('ordem_id').limit(5000),
      ]);
      const jaTem = new Set((m.data || []).map(x => x.ordem_id));
      setLista((o.data || []).filter(x => !jaTem.has(x.id)));
    })();
  }, [sb]);
  const liberar = async (op) => {
    setBusy(true);
    const { error } = await sb.from('mes_ordens').insert({ ordem_id: op.id, liberada_por: mesUser() });
    if (error) { window.toast?.('Não foi possível liberar: ' + error.message); setBusy(false); return; }
    await mesHist(sb, op.id, 'liberada', null, 'AGUARDANDO', 'OP liberada para produção no MES');
    window.VPLog?.registrar?.({ modulo: 'MES', acao: 'liberar', alvo: op.numero, alvo_id: op.id, detalhe: 'OP liberada para o MES' });
    setLista(l => l.filter(x => x.id !== op.id)); setBusy(false); ctx.recarregar();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'grid', placeItems: 'center' }} onClick={onFechar}>
      <div className="card" style={{ background: 'var(--bg1, #fff)', padding: 20, width: 'min(640px, 94vw)', maxHeight: '80vh', overflow: 'auto', borderRadius: 12 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Liberar OP de quadro para o MES</h3>
        {!lista && <div style={{ color: 'var(--fg3)' }}>Carregando…</div>}
        {lista && !lista.length && <div style={{ color: 'var(--fg3)' }}>Nenhuma OP de quadro (frente "quadro") disponível. Gere em PCP › Pedidos de Quadro.</div>}
        {lista && lista.map(op => (
          <div key={op.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line, #eee)' }}>
            <div style={{ flex: 1 }}><b>{op.numero}</b> · {op.titulo || op.produto || '—'}<div style={{ fontSize: 12, color: 'var(--fg3)' }}>{op.cliente || '—'} · prazo {mesData(op.prazo_entrega)}</div></div>
            <button className="btn btn--sm btn--primary" disabled={busy || !ctx.podeEditar} onClick={() => liberar(op)}>Liberar</button>
          </div>
        ))}
        <div style={{ textAlign: 'right', marginTop: 12 }}><button className="btn btn--sm" onClick={onFechar}>Fechar</button></div>
      </div>
    </div>
  );
}

/* ---------------- Detalhe da OP ---------------- */
function MESDetalhe({ ctx, id, onVoltar }) {
  const { sb, etapas, podeEditar } = ctx;
  const [d, setD] = React.useState(null);
  const [exec, setExec] = React.useState(null);
  const [itens, setItens] = React.useState([]);
  const [feitos, setFeitos] = React.useState({});
  const [hist, setHist] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState(null);

  const carregar = React.useCallback(async () => {
    const [m, h] = await Promise.all([
      sb.from('mes_ordens').select('*, op:pcp_ordens(numero, titulo, produto, cliente, prazo_entrega, quantidade, observacao)').eq('ordem_id', id).maybeSingle(),
      sb.from('mes_historico').select('*').eq('ordem_id', id).order('created_at', { ascending: false }).limit(200),
    ]);
    setHist(h.data || []);
    const mo = m.data; setD(mo);
    if (!mo) return;
    if (!['AGUARDANDO', 'EXPEDIDO'].includes(mo.etapa_atual)) {
      const [ex, it] = await Promise.all([
        sb.from('mes_execucoes').select('*').eq('ordem_id', id).eq('etapa_codigo', mo.etapa_atual).eq('status', 'em_andamento').maybeSingle(),
        sb.from('mes_checklist_modelo').select('*').eq('etapa_codigo', mo.etapa_atual).eq('ativo', true).order('posicao'),
      ]);
      setExec(ex.data || null); setItens(it.data || []);
      if (ex.data) {
        const r = await sb.from('mes_checklist_resultados').select('item_id, feito').eq('execucao_id', ex.data.id);
        const f = {}; (r.data || []).forEach(x => { f[x.item_id] = x.feito; }); setFeitos(f);
      } else setFeitos({});
    } else { setExec(null); setItens([]); setFeitos({}); }
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const proxima = (cod) => {
    const ativas = etapas.filter(e => e.ativo).sort((a, b) => a.sequencia - b.sequencia);
    const atual = ativas.find(e => e.codigo === cod);
    return cod === 'AGUARDANDO' ? ativas[0] : ativas.find(e => e.sequencia > (atual ? atual.sequencia : 0));
  };
  const iniciarEtapa = async (codigo, vindoDeAguardando) => {
    setBusy(true); setErro(null);
    const { error } = await sb.from('mes_execucoes').insert({ ordem_id: id, etapa_codigo: codigo, operador: mesUser() });
    if (error) { setErro(error.message); setBusy(false); return; }
    if (vindoDeAguardando) await sb.from('mes_ordens').update({ etapa_atual: codigo, etapa_desde: new Date().toISOString() }).eq('ordem_id', id);
    await mesHist(sb, id, 'etapa_iniciada', vindoDeAguardando ? 'AGUARDANDO' : codigo, codigo, 'Iniciou ' + mesNomeEtapa(etapas, codigo));
    await carregar(); ctx.recarregar(); setBusy(false);
  };
  const marcar = async (item, v) => {
    if (!exec || !podeEditar) return;
    setFeitos(f => ({ ...f, [item.id]: v }));
    const { error } = await sb.from('mes_checklist_resultados').upsert({ execucao_id: exec.id, item_id: item.id, feito: v, feito_por: mesUser(), feito_em: new Date().toISOString() }, { onConflict: 'execucao_id,item_id' });
    if (error) { setErro(error.message); carregar(); }
  };
  const concluir = async () => {
    setBusy(true); setErro(null);
    // Revalida no banco (não confia só no estado da tela).
    const r = await sb.from('mes_checklist_resultados').select('item_id, feito').eq('execucao_id', exec.id);
    const ok = new Set((r.data || []).filter(x => x.feito).map(x => x.item_id));
    const falta = itens.filter(i => i.obrigatorio && !ok.has(i.id));
    if (falta.length) { setErro(`Faltam ${falta.length} item(ns) obrigatório(s) do checklist.`); setBusy(false); return; }
    const agora = new Date().toISOString();
    const up = await sb.from('mes_execucoes').update({ status: 'concluida', concluida_em: agora }).eq('id', exec.id).eq('status', 'em_andamento').select('id');
    if (up.error || !(up.data || []).length) { setErro(up.error ? up.error.message : 'Etapa já concluída por outra pessoa.'); setBusy(false); carregar(); return; }
    const prox = proxima(d.etapa_atual);
    const para = prox ? prox.codigo : 'EXPEDIDO';
    await sb.from('mes_ordens').update({ etapa_atual: para, etapa_desde: agora, concluida_em: prox ? null : agora }).eq('ordem_id', id);
    await mesHist(sb, id, 'etapa_concluida', d.etapa_atual, para, `Concluiu ${mesNomeEtapa(etapas, d.etapa_atual)} (${mesDur(exec.iniciada_em)})`);
    window.VPLog?.registrar?.({ modulo: 'MES', acao: 'concluir_etapa', alvo: d.op.numero, alvo_id: id, detalhe: `${d.etapa_atual} → ${para}` });
    await carregar(); ctx.recarregar(); setBusy(false);
  };

  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const atual = d.etapa_atual;
  const prog = mesProgresso(etapas, atual);
  const seqAtual = (etapas.find(e => e.codigo === atual) || { sequencia: atual === 'EXPEDIDO' ? 99 : 0 }).sequencia;
  const falta = itens.filter(i => i.obrigatorio && !feitos[i.id]).length;
  return (
    <div>
      <button className="btn btn--sm" onClick={onVoltar} style={{ marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 4px' }}>{d.op.numero} · {d.op.titulo || d.op.produto || '—'}</h2>
      <div style={{ color: 'var(--fg3)', marginBottom: 12 }}>{d.op.cliente || '—'} · qtd {d.op.quantidade} · prazo <span style={{ color: mesPrazoCor(d.op, atual === 'EXPEDIDO') }}>{mesData(d.op.prazo_entrega)}</span> · progresso <b>{prog}%</b></div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {etapas.filter(e => e.ativo).sort((a, b) => a.sequencia - b.sequencia).map(e => {
          const feita = e.sequencia < seqAtual, cur = e.codigo === atual;
          return <span key={e.codigo} className="pcp-tag" style={{ background: feita ? 'color-mix(in srgb, #2e9e5b 25%, transparent)' : cur ? 'color-mix(in srgb, var(--vp-yellow) 45%, transparent)' : undefined, fontWeight: cur ? 700 : 400 }}>{feita ? '✓ ' : ''}{e.nome}</span>;
        })}
      </div>
      {erro && <div style={{ color: 'var(--vp-danger, #c0392b)', marginBottom: 8 }}>{erro}</div>}
      {atual === 'AGUARDANDO' && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <b>Aguardando início.</b> {proxima('AGUARDANDO') ? '' : 'Sem etapas ativas.'}
          <div style={{ marginTop: 8 }}><button className="btn btn--primary" disabled={busy || !podeEditar || !proxima('AGUARDANDO')} onClick={() => iniciarEtapa(proxima('AGUARDANDO').codigo, true)}>Iniciar produção · {proxima('AGUARDANDO') ? proxima('AGUARDANDO').nome : ''}</button></div>
        </div>
      )}
      {atual === 'EXPEDIDO' && <div className="card" style={{ padding: 16, marginBottom: 16 }}><b>Expedido</b> em {new Date(d.concluida_em).toLocaleString('pt-BR')}.</div>}
      {!['AGUARDANDO', 'EXPEDIDO'].includes(atual) && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{mesNomeEtapa(etapas, atual)}</b>
            <span style={{ color: 'var(--fg3)' }}>{exec ? `iniciada por ${exec.operador || '—'} há ${mesDur(exec.iniciada_em)}` : 'não iniciada'}</span>
          </div>
          {!exec && <div style={{ marginTop: 10 }}><button className="btn btn--primary" disabled={busy || !podeEditar} onClick={() => iniciarEtapa(atual, false)}>Iniciar etapa</button></div>}
          {exec && (<>
            <div style={{ margin: '10px 0' }}>
              {itens.map(i => (
                <label key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 15, borderBottom: '1px solid var(--line, #eee)' }}>
                  <input type="checkbox" style={{ width: 20, height: 20 }} checked={!!feitos[i.id]} disabled={!podeEditar} onChange={e => marcar(i, e.target.checked)}/>
                  {i.item}{i.obrigatorio ? '' : ' (opcional)'}
                </label>
              ))}
            </div>
            <button className="btn btn--primary" disabled={busy || !podeEditar || falta > 0} onClick={concluir}>Concluir etapa{falta ? ` · faltam ${falta}` : ''}</button>
          </>)}
        </div>
      )}
      <h3>Histórico</h3>
      <div>
        {hist.map(h => (
          <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line, #eee)', fontSize: 13 }}>
            <span style={{ color: 'var(--fg3)' }}>{new Date(h.created_at).toLocaleString('pt-BR')}</span> · {h.usuario || '—'} · {h.descricao || h.evento}
          </div>
        ))}
        {!hist.length && <div style={{ color: 'var(--fg3)' }}>Sem registros.</div>}
      </div>
    </div>
  );
}

/* ---------------- Kanban e lista ---------------- */
function MESKanban({ ctx }) {
  const { linhas, etapas } = ctx;
  const macroDe = (cod) => cod === 'AGUARDANDO' ? 'Aguardando' : (etapas.find(e => e.codigo === cod) || {}).macro;
  const cols = ['Aguardando', ...MES_MACROS];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(190px, 1fr))`, gap: 10, overflowX: 'auto' }}>
      {cols.map(c => {
        const cards = linhas.filter(l => l.etapa_atual !== 'EXPEDIDO' && macroDe(l.etapa_atual) === c);
        return (
          <div key={c} style={{ background: 'var(--bg2, #f4f4f4)', borderRadius: 10, padding: 8, minHeight: 120 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{c} <span style={{ color: 'var(--fg3)' }}>({cards.length})</span></div>
            {cards.map(l => (
              <div key={l.ordem_id} className="card" onClick={() => ctx.abrir(l.ordem_id)} style={{ cursor: 'pointer', padding: 10, marginBottom: 8, borderLeft: '5px solid ' + mesPrazoCor(l.op, false), fontSize: 12 }}>
                <b>{l.op.numero}</b> · {l.op.cliente || '—'}
                <div>{l.op.titulo || l.op.produto || '—'}</div>
                <div style={{ color: 'var(--fg3)' }}>{mesNomeEtapa(etapas, l.etapa_atual)} · {mesProgresso(etapas, l.etapa_atual)}%</div>
                <div style={{ color: 'var(--fg3)' }}>{mesDur(l.etapa_desde)} na etapa · prazo {mesData(l.op.prazo_entrega)}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MESOrdens({ ctx }) {
  const { linhas, etapas } = ctx;
  return (
    <div className="table-wrap">
      <table className="t pcp-grid">
        <thead><tr><th>OP</th><th>Cliente</th><th>Quadro</th><th>Etapa</th><th>Progresso</th><th>Prazo</th></tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.ordem_id} style={{ cursor: 'pointer' }} onClick={() => ctx.abrir(l.ordem_id)}>
              <td>{l.op.numero}</td><td>{l.op.cliente || '—'}</td><td>{l.op.titulo || l.op.produto || '—'}</td>
              <td>{mesNomeEtapa(etapas, l.etapa_atual)}</td><td>{mesProgresso(etapas, l.etapa_atual)}%</td>
              <td style={{ color: mesPrazoCor(l.op, l.etapa_atual === 'EXPEDIDO') }}>{mesData(l.op.prazo_entrega)}</td>
            </tr>
          ))}
          {!linhas.length && <tr><td colSpan={6} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhuma OP liberada para o MES.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MESPage() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [aba, setAba] = window.useRouteTab('mes', 'kanban', ['kanban', 'ordens'], false, true);
  const [opId, setOpId] = window.useRotaItem('mes', aba);
  const [etapas, setEtapas] = React.useState(null);
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [liberar, setLiberar] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);

  const recarregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [e, m] = await Promise.all([
      sb.from('mes_etapas').select('*').order('sequencia'),
      sb.from('mes_ordens').select('*, op:pcp_ordens(numero, titulo, produto, cliente, prazo_entrega)').order('liberada_em', { ascending: false }).limit(500),
    ]);
    if (e.error || m.error) { setErro((e.error || m.error).message); return; }
    setEtapas(e.data || []); setLinhas(m.data || []);
  }, [sb]);
  React.useEffect(() => {
    recarregar();
    const t = setInterval(recarregar, 30000);
    Promise.resolve(window.PropostaStore?.temCapacidade?.('mes', 'editar')).then(v => setPodeEditar(!!v)).catch(() => {});
    return () => clearInterval(t);
  }, [recarregar]);

  const ctx = etapas && linhas && { sb, etapas, linhas, podeEditar, recarregar, abrir: (id) => setOpId(id) };
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · MES</div>
          <h1 className="page-head__title">MES — Sistema de Execução da Manufatura</h1>
          <p className="page-head__sub">Execução do quadro de comando etapa a etapa, com checklist obrigatório e histórico.</p>
        </div>
      </div>
      {!opId && (
        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={'btn btn--sm' + (aba === 'kanban' ? ' btn--primary' : '')} onClick={() => setAba('kanban')}>Kanban</button>
          <button className={'btn btn--sm' + (aba === 'ordens' ? ' btn--primary' : '')} onClick={() => setAba('ordens')}>Ordens de Produção</button>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--sm btn--primary" disabled={!podeEditar} onClick={() => setLiberar(true)}>Liberar OP para o MES</button>
        </div>
      )}
      {erro && <div style={{ color: 'var(--vp-danger, #c0392b)', padding: 12 }}>{erro}</div>}
      {!erro && !ctx && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {ctx && opId && <MESDetalhe ctx={ctx} id={opId} onVoltar={() => setOpId(null)}/>}
      {ctx && !opId && aba === 'kanban' && <MESKanban ctx={ctx}/>}
      {ctx && !opId && aba === 'ordens' && <MESOrdens ctx={ctx}/>}
      {ctx && liberar && <MESLiberar ctx={ctx} onFechar={() => setLiberar(false)}/>}
    </div>
  );
}

Object.assign(window, { MESPage });
