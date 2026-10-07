/* ============================================================
   mes.jsx — Logística Interna · MES (Sistema de Execução da Manufatura) · Fase 1.
   OP (reaproveita pcp_ordens, frente 'quadro') → Kanban por macroetapa → etapa com checklist obrigatório → histórico.
   A OP só avança por "Concluir etapa" (valida o checklist); histórico imutável em mes_historico.
   Fase 2: pausas (apontamento de tempo), bloqueios e materiais da OP.
   Fase 3: ligações elétricas, testes, NC/retrabalho e gates (furos, série). Próxima: embalagem/expedição, indicadores e painel TV.
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
const MES_MOTIVOS_BLOQ = {
  falta_material: 'Falta de material', erro_projeto: 'Erro de projeto', componente_incorreto: 'Componente incorreto',
  aguardando_engenharia: 'Aguardando engenharia', aguardando_compras: 'Aguardando compras', aguardando_decisao: 'Aguardando decisão',
  equipamento_danificado: 'Equipamento danificado', outro: 'Outro',
};
const MES_MOTIVOS_PAUSA = ['Intervalo', 'Falta de material', 'Aguardando engenharia', 'Troca de turno', 'Outro'];
const MES_STATUS_MAT = { pendente: 'Pendente', separado: 'Separado', instalado: 'Instalado', substituido: 'Substituído', faltante: 'Faltante', avariado: 'Avariado' };

function MESDetalhe({ ctx, id, onVoltar }) {
  const { sb, etapas, podeEditar } = ctx;
  const [d, setD] = React.useState(null);
  const [exec, setExec] = React.useState(null);
  const [pausa, setPausa] = React.useState(null);
  const [itens, setItens] = React.useState([]);
  const [feitos, setFeitos] = React.useState({});
  const [hist, setHist] = React.useState([]);
  const [bloqs, setBloqs] = React.useState([]);
  const [mats, setMats] = React.useState([]);
  const [sub, setSub] = React.useState('etapa');
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState(null);
  const [fPausa, setFPausa] = React.useState(null);   // { motivo, outro }
  const [fBloq, setFBloq] = React.useState(null);     // { motivo, detalhe }

  const carregar = React.useCallback(async () => {
    const [m, h, bl, mt] = await Promise.all([
      sb.from('mes_ordens').select('*, op:pcp_ordens(numero, titulo, produto, cliente, prazo_entrega, quantidade, observacao)').eq('ordem_id', id).maybeSingle(),
      sb.from('mes_historico').select('*').eq('ordem_id', id).order('created_at', { ascending: false }).limit(200),
      sb.from('mes_bloqueios').select('*').eq('ordem_id', id).order('inicio', { ascending: false }),
      sb.from('pcp_ordem_materiais').select('*').eq('ordem_id', id).order('codigo'),
    ]);
    setHist(h.data || []); setBloqs(bl.data || []); setMats(mt.data || []);
    const mo = m.data; setD(mo);
    if (!mo) return;
    if (!['AGUARDANDO', 'EXPEDIDO'].includes(mo.etapa_atual)) {
      const [ex, it] = await Promise.all([
        sb.from('mes_execucoes').select('*').eq('ordem_id', id).eq('etapa_codigo', mo.etapa_atual).eq('status', 'em_andamento').maybeSingle(),
        sb.from('mes_checklist_modelo').select('*').eq('etapa_codigo', mo.etapa_atual).eq('ativo', true).order('posicao'),
      ]);
      setExec(ex.data || null); setItens(it.data || []);
      if (ex.data) {
        const [r, p] = await Promise.all([
          sb.from('mes_checklist_resultados').select('item_id, feito').eq('execucao_id', ex.data.id),
          sb.from('mes_pausas').select('*').eq('execucao_id', ex.data.id).is('fim', null).maybeSingle(),
        ]);
        const f = {}; (r.data || []).forEach(x => { f[x.item_id] = x.feito; }); setFeitos(f); setPausa(p.data || null);
      } else { setFeitos({}); setPausa(null); }
    } else { setExec(null); setItens([]); setFeitos({}); setPausa(null); }
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const bloqAberto = bloqs.filter(b => !b.fim);
  const bloqueada = bloqAberto.length > 0;
  const proxima = (cod) => {
    const ativas = etapas.filter(e => e.ativo).sort((a, b) => a.sequencia - b.sequencia);
    const atual = ativas.find(e => e.codigo === cod);
    return cod === 'AGUARDANDO' ? ativas[0] : ativas.find(e => e.sequencia > (atual ? atual.sequencia : 0));
  };
  // Revalida no banco (a tela pode estar desatualizada): OP bloqueada não anda.
  const temBloqueioNoBanco = async () => {
    const r = await sb.from('mes_bloqueios').select('id', { count: 'exact', head: true }).eq('ordem_id', id).is('fim', null);
    return (r.count || 0) > 0;
  };
  const iniciarEtapa = async (codigo, vindoDeAguardando) => {
    setBusy(true); setErro(null);
    if (await temBloqueioNoBanco()) { setErro('OP bloqueada. Desbloqueie antes de iniciar.'); setBusy(false); carregar(); return; }
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
  const pausar = async () => {
    const motivo = fPausa.motivo === 'Outro' ? (fPausa.outro || '').trim() || 'Outro' : fPausa.motivo;
    setBusy(true); setErro(null);
    const { error } = await sb.from('mes_pausas').insert({ execucao_id: exec.id, ordem_id: id, motivo, operador: mesUser() });
    if (error) setErro(error.message);
    else await mesHist(sb, id, 'pausa', d.etapa_atual, d.etapa_atual, 'Pausou ' + mesNomeEtapa(etapas, d.etapa_atual) + ' — ' + motivo);
    setFPausa(null); await carregar(); setBusy(false);
  };
  const retomar = async () => {
    if (bloqueada) { setErro('OP bloqueada. Desbloqueie para retomar.'); return; }
    setBusy(true); setErro(null);
    const { error } = await sb.from('mes_pausas').update({ fim: new Date().toISOString() }).eq('id', pausa.id).is('fim', null);
    if (error) setErro(error.message);
    else await mesHist(sb, id, 'retomada', d.etapa_atual, d.etapa_atual, 'Retomou ' + mesNomeEtapa(etapas, d.etapa_atual) + ' (parada de ' + mesDur(pausa.inicio) + ')');
    await carregar(); setBusy(false);
  };
  const abrirBloqueio = async (motivo, detalhe) => {
    const { data: bl, error } = await sb.from('mes_bloqueios').insert({ ordem_id: id, motivo, detalhe: detalhe || null, aberto_por: mesUser() }).select().maybeSingle();
    if (error) { setErro(error.code === '23505' ? 'Já existe um bloqueio aberto com esse motivo.' : error.message); return false; }
    // Bloquear congela a contagem: pausa a execução aberta (se ainda não estiver pausada).
    if (exec && !pausa) await sb.from('mes_pausas').insert({ execucao_id: exec.id, ordem_id: id, motivo: 'Bloqueio: ' + MES_MOTIVOS_BLOQ[motivo], operador: mesUser(), bloqueio_id: bl.id });
    await mesHist(sb, id, 'bloqueio', d.etapa_atual, d.etapa_atual, 'Bloqueou — ' + MES_MOTIVOS_BLOQ[motivo] + (detalhe ? ': ' + detalhe : ''));
    window.VPLog?.registrar?.({ modulo: 'MES', acao: 'bloquear', alvo: d.op.numero, alvo_id: id, detalhe: MES_MOTIVOS_BLOQ[motivo] });
    return true;
  };
  const bloquear = async () => {
    setBusy(true); setErro(null);
    const ok = await abrirBloqueio(fBloq.motivo, (fBloq.detalhe || '').trim());
    if (ok) setFBloq(null);
    await carregar(); ctx.recarregar(); setBusy(false);
  };
  const desbloquear = async (b) => {
    setBusy(true); setErro(null);
    const agora = new Date().toISOString();
    const { error } = await sb.from('mes_bloqueios').update({ fim: agora, resolvido_por: mesUser() }).eq('id', b.id).is('fim', null);
    if (error) { setErro(error.message); setBusy(false); return; }
    await sb.from('mes_pausas').update({ fim: agora }).eq('bloqueio_id', b.id).is('fim', null);
    await mesHist(sb, id, 'desbloqueio', d.etapa_atual, d.etapa_atual, 'Desbloqueou — ' + MES_MOTIVOS_BLOQ[b.motivo] + ' (parada de ' + mesDur(b.inicio) + ')');
    window.VPLog?.registrar?.({ modulo: 'MES', acao: 'desbloquear', alvo: d.op.numero, alvo_id: id, detalhe: MES_MOTIVOS_BLOQ[b.motivo] });
    await carregar(); ctx.recarregar(); setBusy(false);
  };
  // Regras de passagem por etapa, sempre revalidadas no banco.
  const validarGate = async (cod) => {
    const nc = await sb.from('mes_nc').select('id', { count: 'exact', head: true }).eq('ordem_id', id).neq('status', 'fechada');
    if ((nc.count || 0) > 0) return 'Há não conformidade aberta. Corrija e feche a NC (com reteste) antes de concluir.';
    const mo = (await sb.from('mes_ordens').select('numero_serie, furos_previstos, furos_executados').eq('ordem_id', id).maybeSingle()).data || {};
    if (cod === 'FURACAO' && Number(mo.furos_executados) !== Number(mo.furos_previstos)) return `Furos executados (${mo.furos_executados ?? 0}) diferente do previsto (${mo.furos_previstos}).`;
    if (cod === 'ELETRIFICACAO') {
      const l = (await sb.from('mes_ligacoes').select('status').eq('ordem_id', id).limit(5000)).data || [];
      const pend = l.filter(x => x.status !== 'concluida').length;
      if (l.length && pend) return `Faltam ${pend} de ${l.length} ligações elétricas.`;
    }
    if (cod === 'TESTES') {
      const t = (await sb.from('mes_testes').select('tipo, nome, resultado, testado_em').eq('ordem_id', id).order('testado_em', { ascending: true }).limit(1000)).data || [];
      const ult = {}; t.forEach(x => { ult[x.tipo + '|' + x.nome.toLowerCase()] = x; });
      const ultimos = Object.values(ult);
      if (!ultimos.some(x => x.tipo === 'sem_potencia')) return 'Falta registrar teste sem potência.';
      if (!ultimos.some(x => x.tipo === 'energizado')) return 'Falta registrar teste energizado.';
      if (ultimos.some(x => x.resultado !== 'aprovado')) return 'Há teste cujo último resultado é REPROVADO. Refaça e aprove.';
    }
    if (cod === 'QUALIDADE' && !(mo.numero_serie || '').trim()) return 'Registre o número de série antes de aprovar a qualidade.';
    return null;
  };
  const concluir = async () => {
    setBusy(true); setErro(null);
    if (await temBloqueioNoBanco()) { setErro('OP bloqueada. Desbloqueie antes de concluir.'); setBusy(false); carregar(); return; }
    const pa = await sb.from('mes_pausas').select('id', { count: 'exact', head: true }).eq('execucao_id', exec.id).is('fim', null);
    if ((pa.count || 0) > 0) { setErro('Etapa pausada. Retome antes de concluir.'); setBusy(false); carregar(); return; }
    const gate = await validarGate(d.etapa_atual);
    if (gate) { setErro(gate); setBusy(false); return; }
    const r = await sb.from('mes_checklist_resultados').select('item_id, feito').eq('execucao_id', exec.id);
    const ok = new Set((r.data || []).filter(x => x.feito).map(x => x.item_id));
    const falta = itens.filter(i => i.obrigatorio && !ok.has(i.id));
    if (falta.length) { setErro(`Faltam ${falta.length} item(ns) obrigatório(s) do checklist.`); setBusy(false); return; }
    const agora = new Date();
    const ps = await sb.from('mes_pausas').select('inicio, fim').eq('execucao_id', exec.id);
    const pausaMin = (ps.data || []).reduce((s, p) => s + Math.max(0, (new Date(p.fim || agora) - new Date(p.inicio)) / 60000), 0);
    const durMin = Math.max(0, (agora - new Date(exec.iniciada_em)) / 60000 - pausaMin);
    const up = await sb.from('mes_execucoes').update({ status: 'concluida', concluida_em: agora.toISOString(), duracao_min: Math.round(durMin * 10) / 10, pausa_min: Math.round(pausaMin * 10) / 10 }).eq('id', exec.id).eq('status', 'em_andamento').select('id');
    if (up.error || !(up.data || []).length) { setErro(up.error ? up.error.message : 'Etapa já concluída por outra pessoa.'); setBusy(false); carregar(); return; }
    const prox = proxima(d.etapa_atual);
    const para = prox ? prox.codigo : 'EXPEDIDO';
    await sb.from('mes_ordens').update({ etapa_atual: para, etapa_desde: agora.toISOString(), concluida_em: prox ? null : agora.toISOString() }).eq('ordem_id', id);
    await mesHist(sb, id, 'etapa_concluida', d.etapa_atual, para, `Concluiu ${mesNomeEtapa(etapas, d.etapa_atual)} (${Math.round(durMin)} min trabalhados${pausaMin >= 1 ? ', ' + Math.round(pausaMin) + ' min parado' : ''})`);
    window.VPLog?.registrar?.({ modulo: 'MES', acao: 'concluir_etapa', alvo: d.op.numero, alvo_id: id, detalhe: `${d.etapa_atual} → ${para}` });
    await carregar(); ctx.recarregar(); setBusy(false);
  };
  const salvarCampo = async (patch, rotulo) => {
    if (!podeEditar) return;
    const { error } = await sb.from('mes_ordens').update(patch).eq('ordem_id', id);
    if (error) { setErro(error.message); return; }
    await mesHist(sb, id, 'campo', d.etapa_atual, d.etapa_atual, rotulo);
    await carregar();
  };
  const salvarMat = async (m, patch) => {
    if (!podeEditar) return;
    setMats(l => l.map(x => x.id === m.id ? { ...x, ...patch } : x));
    const { error } = await sb.from('pcp_ordem_materiais').update(patch).eq('id', m.id);
    if (error) { setErro(error.message); carregar(); return; }
    await mesHist(sb, id, 'material', null, null, `${m.codigo}: ` + Object.entries(patch).map(([k, v]) => `${{ separado: 'separado', qtd_instalada: 'instalado', status_mes: 'status', critico: 'crítico', lote_serie: 'lote/série' }[k] || k} = ${k === 'status_mes' ? MES_STATUS_MAT[v] : String(v)}`).join(', '));
    // Item crítico faltante bloqueia a OP (regra do fluxo).
    if (patch.status_mes === 'faltante' && (m.critico || patch.critico) && !bloqAberto.some(b => b.motivo === 'falta_material')) {
      if (await abrirBloqueio('falta_material', `Item crítico faltante: ${m.codigo}`)) { await carregar(); ctx.recarregar(); }
    }
  };

  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const atual = d.etapa_atual;
  const prog = mesProgresso(etapas, atual);
  const seqAtual = (etapas.find(e => e.codigo === atual) || { sequencia: atual === 'EXPEDIDO' ? 99 : 0 }).sequencia;
  const falta = itens.filter(i => i.obrigatorio && !feitos[i.id]).length;
  const emAndamento = !['AGUARDANDO', 'EXPEDIDO'].includes(atual);
  const abaBtn = (k, rot) => <button className={'btn btn--sm' + (sub === k ? ' btn--primary' : '')} onClick={() => setSub(k)}>{rot}</button>;
  return (
    <div>
      <button className="btn btn--sm" onClick={onVoltar} style={{ marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 4px' }}>{d.op.numero} · {d.op.titulo || d.op.produto || '—'}{bloqueada && <span className="pcp-tag" style={{ marginLeft: 8, background: 'color-mix(in srgb, var(--vp-danger, #c0392b) 25%, transparent)' }}>BLOQUEADA</span>}{ctx.ncAbertas[id] && <span className="pcp-tag" style={{ marginLeft: 8, background: 'color-mix(in srgb, #7b3fa0 30%, transparent)' }}>EM RETRABALHO</span>}</h2>
      <div style={{ color: 'var(--fg3)', marginBottom: 12 }}>{d.op.cliente || '—'} · qtd {d.op.quantidade} · prazo <span style={{ color: mesPrazoCor(d.op, atual === 'EXPEDIDO') }}>{mesData(d.op.prazo_entrega)}</span> · progresso <b>{prog}%</b></div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {etapas.filter(e => e.ativo).sort((a, b) => a.sequencia - b.sequencia).map(e => {
          const feita = e.sequencia < seqAtual, cur = e.codigo === atual;
          return <span key={e.codigo} className="pcp-tag" style={{ background: feita ? 'color-mix(in srgb, #2e9e5b 25%, transparent)' : cur ? 'color-mix(in srgb, var(--vp-yellow) 45%, transparent)' : undefined, fontWeight: cur ? 700 : 400 }}>{feita ? '✓ ' : ''}{e.nome}</span>;
        })}
      </div>
      {bloqAberto.map(b => (
        <div key={b.id} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: '5px solid var(--vp-danger, #c0392b)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}><b>Bloqueada — {MES_MOTIVOS_BLOQ[b.motivo]}</b> há {mesDur(b.inicio)}{b.detalhe ? ' · ' + b.detalhe : ''}</div>
          <button className="btn btn--sm" disabled={busy || !podeEditar} onClick={() => desbloquear(b)}>Desbloquear</button>
        </div>
      ))}
      {erro && <div style={{ color: 'var(--vp-danger, #c0392b)', marginBottom: 8 }}>{erro}</div>}
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {abaBtn('etapa', 'Etapa')}{abaBtn('ligacoes', 'Ligações')}{abaBtn('testes', 'Testes')}{abaBtn('ncs', 'NCs')}{abaBtn('materiais', `Materiais (${mats.length})`)}{abaBtn('bloqueios', `Bloqueios (${bloqs.length})`)}{abaBtn('historico', 'Histórico')}
      </div>

      {sub === 'etapa' && (<>
        {atual === 'AGUARDANDO' && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <b>Aguardando início.</b> {proxima('AGUARDANDO') ? '' : 'Sem etapas ativas.'}
            <div style={{ marginTop: 8 }}><button className="btn btn--primary" disabled={busy || bloqueada || !podeEditar || !proxima('AGUARDANDO')} onClick={() => iniciarEtapa(proxima('AGUARDANDO').codigo, true)}>Iniciar produção · {proxima('AGUARDANDO') ? proxima('AGUARDANDO').nome : ''}</button></div>
          </div>
        )}
        {atual === 'EXPEDIDO' && <div className="card" style={{ padding: 16, marginBottom: 16 }}><b>Expedido</b> em {new Date(d.concluida_em).toLocaleString('pt-BR')}.</div>}
        {emAndamento && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b>{mesNomeEtapa(etapas, atual)}{pausa && <span className="pcp-tag" style={{ marginLeft: 8 }}>PAUSADA — {pausa.motivo}</span>}</b>
              <span style={{ color: 'var(--fg3)' }}>{exec ? `iniciada por ${exec.operador || '—'} há ${mesDur(exec.iniciada_em)}` : 'não iniciada'}</span>
            </div>
            {!exec && <div style={{ marginTop: 10 }}><button className="btn btn--primary" disabled={busy || bloqueada || !podeEditar} onClick={() => iniciarEtapa(atual, false)}>Iniciar etapa</button></div>}
            {exec && (<>
              <div style={{ margin: '10px 0' }}>
                {itens.map(i => (
                  <label key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 15, borderBottom: '1px solid var(--line, #eee)' }}>
                    <input type="checkbox" style={{ width: 20, height: 20 }} checked={!!feitos[i.id]} disabled={!podeEditar || !!pausa} onChange={e => marcar(i, e.target.checked)}/>
                    {i.item}{i.obrigatorio ? '' : ' (opcional)'}
                  </label>
                ))}
              </div>
              {atual === 'FURACAO' && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13 }}>Furos previstos <input className="input" type="number" min="0" style={{ width: 80 }} defaultValue={d.furos_previstos} disabled={!podeEditar || !!pausa} onBlur={e => { const v = Number(e.target.value); if (v !== Number(d.furos_previstos)) salvarCampo({ furos_previstos: v }, `Furos previstos = ${v}`); }}/></label>
                  <label style={{ fontSize: 13 }}>Furos executados <input className="input" type="number" min="0" style={{ width: 80 }} defaultValue={d.furos_executados ?? ''} disabled={!podeEditar || !!pausa} onBlur={e => { if (e.target.value === '') return; const v = Number(e.target.value); if (v !== Number(d.furos_executados)) salvarCampo({ furos_executados: v }, `Furos executados = ${v}/${d.furos_previstos}`); }}/></label>
                </div>
              )}
              {atual === 'QUALIDADE' && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13 }}>Nº de série <input className="input" defaultValue={d.numero_serie || ''} disabled={!podeEditar} onBlur={e => { const v = e.target.value.trim(); if (v !== (d.numero_serie || '')) salvarCampo({ numero_serie: v || null }, `Nº de série = ${v || '—'}`); }}/></label>
                  <label style={{ fontSize: 13 }}>Revisão do projeto <input className="input" style={{ width: 90 }} defaultValue={d.revisao_projeto || ''} disabled={!podeEditar} onBlur={e => { const v = e.target.value.trim(); if (v !== (d.revisao_projeto || '')) salvarCampo({ revisao_projeto: v || null }, `Revisão do projeto = ${v || '—'}`); }}/></label>
                </div>
              )}
              {fPausa && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <select className="input" value={fPausa.motivo} onChange={e => setFPausa({ ...fPausa, motivo: e.target.value })}>{MES_MOTIVOS_PAUSA.map(m => <option key={m}>{m}</option>)}</select>
                  {fPausa.motivo === 'Outro' && <input className="input" placeholder="Motivo" value={fPausa.outro || ''} onChange={e => setFPausa({ ...fPausa, outro: e.target.value })}/>}
                  <button className="btn btn--sm btn--primary" disabled={busy} onClick={pausar}>Confirmar pausa</button>
                  <button className="btn btn--sm" onClick={() => setFPausa(null)}>Cancelar</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!pausa && <button className="btn" disabled={busy || !podeEditar} onClick={() => setFPausa({ motivo: MES_MOTIVOS_PAUSA[0] })}>Pausar</button>}
                {pausa && <button className="btn" disabled={busy || bloqueada || !podeEditar} onClick={retomar}>Retomar</button>}
                <button className="btn btn--primary" disabled={busy || bloqueada || !!pausa || !podeEditar || falta > 0} onClick={concluir}>Concluir etapa{falta ? ` · faltam ${falta}` : ''}</button>
              </div>
            </>)}
          </div>
        )}
        {atual !== 'EXPEDIDO' && (
          fBloq ? (
            <div className="card" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="input" value={fBloq.motivo} onChange={e => setFBloq({ ...fBloq, motivo: e.target.value })}>{Object.entries(MES_MOTIVOS_BLOQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Detalhe (opcional)" value={fBloq.detalhe || ''} onChange={e => setFBloq({ ...fBloq, detalhe: e.target.value })}/>
              <button className="btn btn--sm btn--primary" disabled={busy} onClick={bloquear}>Confirmar bloqueio</button>
              <button className="btn btn--sm" onClick={() => setFBloq(null)}>Cancelar</button>
            </div>
          ) : <button className="btn btn--sm" disabled={busy || !podeEditar} onClick={() => setFBloq({ motivo: 'falta_material' })}>Registrar problema / Bloquear OP</button>
        )}
      </>)}

      {sub === 'ligacoes' && <MESLigacoes ctx={ctx} id={id} d={d}/>}
      {sub === 'testes' && <MESTestes ctx={ctx} id={id} d={d} onMudou={() => { carregar(); ctx.recarregar(); }}/>}
      {sub === 'ncs' && <MESNcs ctx={ctx} id={id} d={d} onMudou={() => { carregar(); ctx.recarregar(); }}/>}

      {sub === 'materiais' && (
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Código</th><th>Descrição</th><th>Previsto</th><th>Separado</th><th>Instalado</th><th>Lote/série</th><th>Crítico</th><th>Status</th></tr></thead>
            <tbody>
              {mats.map(m => (
                <tr key={m.id}>
                  <td>{m.codigo}</td><td>{m.descricao || '—'}</td><td>{Number(m.necessario)} {m.unidade || ''}</td>
                  <td><input className="input" type="number" min="0" style={{ width: 80 }} defaultValue={Number(m.separado || 0)} disabled={!podeEditar} onBlur={e => { const v = Number(e.target.value); if (v !== Number(m.separado || 0)) salvarMat(m, { separado: v }); }}/></td>
                  <td><input className="input" type="number" min="0" style={{ width: 80 }} defaultValue={Number(m.qtd_instalada || 0)} disabled={!podeEditar} onBlur={e => { const v = Number(e.target.value); if (v !== Number(m.qtd_instalada || 0)) salvarMat(m, { qtd_instalada: v }); }}/></td>
                  <td><input className="input" style={{ width: 110 }} defaultValue={m.lote_serie || ''} disabled={!podeEditar} onBlur={e => { const v = e.target.value.trim(); if (v !== (m.lote_serie || '')) salvarMat(m, { lote_serie: v || null }); }}/></td>
                  <td><input type="checkbox" checked={!!m.critico} disabled={!podeEditar} onChange={e => salvarMat(m, { critico: e.target.checked })}/></td>
                  <td><select className="input" value={m.status_mes} disabled={!podeEditar} onChange={e => salvarMat(m, { status_mes: e.target.value })}>{Object.entries(MES_STATUS_MAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                </tr>
              ))}
              {!mats.length && <tr><td colSpan={8} style={{ color: 'var(--fg3)', padding: 16 }}>Esta OP não tem lista de materiais no PCP.</td></tr>}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--fg3)', padding: 8 }}>Item crítico marcado como "Faltante" bloqueia a OP automaticamente.</div>
        </div>
      )}

      {sub === 'bloqueios' && (
        <div>
          {bloqs.map(b => (
            <div key={b.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line, #eee)', fontSize: 14 }}>
              <b>{MES_MOTIVOS_BLOQ[b.motivo]}</b>{b.detalhe ? ' — ' + b.detalhe : ''}
              <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{new Date(b.inicio).toLocaleString('pt-BR')} por {b.aberto_por || '—'} · {b.fim ? `resolvido em ${new Date(b.fim).toLocaleString('pt-BR')} por ${b.resolvido_por || '—'} (${Math.round((new Date(b.fim) - new Date(b.inicio)) / 60000)} min)` : 'ABERTO'}</div>
            </div>
          ))}
          {!bloqs.length && <div style={{ color: 'var(--fg3)' }}>Nenhum bloqueio registrado.</div>}
        </div>
      )}

      {sub === 'historico' && (
        <div>
          {hist.map(h => (
            <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line, #eee)', fontSize: 13 }}>
              <span style={{ color: 'var(--fg3)' }}>{new Date(h.created_at).toLocaleString('pt-BR')}</span> · {h.usuario || '—'} · {h.descricao || h.evento}
            </div>
          ))}
          {!hist.length && <div style={{ color: 'var(--fg3)' }}>Sem registros.</div>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Fase 3: ligações, testes, NC ---------------- */
const MES_TESTES_TIPO = { sem_potencia: 'Sem potência', energizado: 'Energizado', funcional: 'Funcional' };
const MES_TESTES_SUGESTOES = {
  sem_potencia: ['Continuidade', 'Curto entre circuitos', 'Aterramento', 'Ligação dos bornes', 'Alimentação'],
  energizado: ['Tensão de alimentação', 'Tensões auxiliares', 'Contatores', 'Relés', 'Placas', 'Entradas e saídas', 'Comunicação'],
  funcional: ['Normal / Inspeção', 'Sobe', 'Desce', 'Emergência', 'Freio', 'Limitador', 'Reset Limitador', 'Resgate', 'Ação Freio'],
};
async function mesAbrirNc(sb, ordemId, etapa, f) {
  const { data, error } = await sb.from('mes_nc').insert({ ordem_id: ordemId, etapa_codigo: etapa, descricao: f.descricao, componente: f.componente || null, causa: f.causa || null, aberto_por: mesUser() }).select().maybeSingle();
  if (error) return { error };
  await mesHist(sb, ordemId, 'nc_aberta', etapa, etapa, `Abriu ${data.numero} — ${f.descricao}`);
  window.VPLog?.registrar?.({ modulo: 'MES', acao: 'abrir_nc', alvo: data.numero, alvo_id: ordemId, detalhe: f.descricao });
  return { nc: data };
}

function MESLigacoes({ ctx, id, d }) {
  const { sb, podeEditar } = ctx;
  const [l, setL] = React.useState(null);
  const [txt, setTxt] = React.useState('');
  const [soPend, setSoPend] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const carregar = React.useCallback(async () => {
    const r = await sb.from('mes_ligacoes').select('*').eq('ordem_id', id).order('codigo_fio').limit(2000);
    setL(r.data || []);
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  const importar = async () => {
    // Uma ligação por linha: fio;origem;destino;bitola;cor;comprimento;terminal (separador ; ou tab)
    const linhas = txt.split('\n').map(x => x.trim()).filter(Boolean).map(x => x.split(/[;\t]/).map(c => c.trim()));
    const rows = linhas.filter(c => c[0]).map(c => ({ ordem_id: id, codigo_fio: c[0], origem: c[1] || null, destino: c[2] || null, bitola: c[3] || null, cor: c[4] || null, comprimento: c[5] || null, terminal: c[6] || null }));
    if (!rows.length) { setMsg('Nada para importar.'); return; }
    const { error } = await sb.from('mes_ligacoes').insert(rows);
    if (error) { setMsg(error.message); return; }
    await mesHist(sb, id, 'ligacoes', null, null, `Cadastrou ${rows.length} ligação(ões) previstas`);
    setTxt(''); setMsg(`${rows.length} ligação(ões) cadastradas.`); carregar();
  };
  const alternar = async (x) => {
    if (!podeEditar) return;
    const novo = x.status === 'concluida' ? 'pendente' : 'concluida';
    setL(a => a.map(y => y.id === x.id ? { ...y, status: novo } : y));
    const { error } = await sb.from('mes_ligacoes').update({ status: novo, feito_por: novo === 'concluida' ? mesUser() : null, feito_em: novo === 'concluida' ? new Date().toISOString() : null }).eq('id', x.id);
    if (error) { setMsg(error.message); carregar(); }
  };
  const remover = async (x) => {
    if (!podeEditar || !window.confirm(`Remover a ligação ${x.codigo_fio}?`)) return;
    const { error } = await sb.from('mes_ligacoes').delete().eq('id', x.id);
    if (error) { setMsg(error.message); return; }
    await mesHist(sb, id, 'ligacoes', null, null, `Removeu a ligação ${x.codigo_fio}`); carregar();
  };
  if (!l) return <div style={{ color: 'var(--fg3)' }}>Carregando…</div>;
  const ok = l.filter(x => x.status === 'concluida').length;
  const pct = l.length ? Math.round(ok / l.length * 100) : 0;
  const lista = soPend ? l.filter(x => x.status !== 'concluida') : l;
  return (
    <div>
      <div style={{ marginBottom: 8 }}><b>Ligações concluídas: {ok} / {l.length} ({pct}%)</b>
        <div style={{ height: 8, background: 'var(--bg2, #eee)', borderRadius: 4, marginTop: 4 }}><div style={{ width: pct + '%', height: 8, background: '#2e9e5b', borderRadius: 4 }}/></div>
        <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>A etapa Interligação Elétrica só conclui com todas as ligações cadastradas concluídas.</div>
      </div>
      <label style={{ fontSize: 13 }}><input type="checkbox" checked={soPend} onChange={e => setSoPend(e.target.checked)}/> só pendentes</label>
      <div className="table-wrap">
        <table className="t pcp-grid">
          <thead><tr><th></th><th>Fio</th><th>Origem</th><th>Destino</th><th>Bitola</th><th>Cor</th><th>Compr.</th><th>Terminal</th><th></th></tr></thead>
          <tbody>
            {lista.map(x => (
              <tr key={x.id}>
                <td><input type="checkbox" style={{ width: 18, height: 18 }} checked={x.status === 'concluida'} disabled={!podeEditar} onChange={() => alternar(x)}/></td>
                <td>{x.codigo_fio}</td><td>{x.origem || '—'}</td><td>{x.destino || '—'}</td><td>{x.bitola || '—'}</td><td>{x.cor || '—'}</td><td>{x.comprimento || '—'}</td><td>{x.terminal || '—'}</td>
                <td>{podeEditar && <button className="btn btn--sm" onClick={() => remover(x)}>✕</button>}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={9} style={{ color: 'var(--fg3)', padding: 16 }}>{l.length ? 'Nenhuma pendente.' : 'Nenhuma ligação cadastrada.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {podeEditar && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Cadastrar ligações previstas (uma por linha: <code>fio;origem;destino;bitola;cor;comprimento;terminal</code> — só o fio é obrigatório)</div>
          <textarea className="input" rows={4} style={{ width: '100%' }} value={txt} onChange={e => setTxt(e.target.value)} placeholder="134;Placa;AA;1,0 mm²;Preto"/>
          <button className="btn btn--sm btn--primary" style={{ marginTop: 6 }} onClick={importar}>Cadastrar</button>
          {msg && <span style={{ marginLeft: 10, fontSize: 13 }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

function MESTestes({ ctx, id, d, onMudou }) {
  const { sb, podeEditar } = ctx;
  const [t, setT] = React.useState(null);
  const [f, setF] = React.useState({ tipo: 'sem_potencia', nome: '', resultado: 'aprovado', obs: '' });
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const carregar = React.useCallback(async () => {
    const r = await sb.from('mes_testes').select('*, nc:mes_nc(numero)').eq('ordem_id', id).order('testado_em', { ascending: false }).limit(500);
    setT(r.data || []);
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  const registrar = async () => {
    const nome = f.nome.trim();
    if (!nome) { setMsg('Informe o teste.'); return; }
    if (f.resultado === 'reprovado' && !f.obs.trim()) { setMsg('Teste reprovado exige descrever o problema.'); return; }
    setBusy(true); setMsg(null);
    let ncId = null;
    if (f.resultado === 'reprovado') {
      const r = await mesAbrirNc(sb, id, 'TESTES', { descricao: `Teste reprovado: ${nome} — ${f.obs.trim()}` });
      if (r.error) { setMsg(r.error.message); setBusy(false); return; }
      ncId = r.nc.id;
    }
    const { error } = await sb.from('mes_testes').insert({ ordem_id: id, tipo: f.tipo, nome, resultado: f.resultado, observacao: f.obs.trim() || null, testado_por: mesUser(), nc_id: ncId });
    if (error) { setMsg(error.message); setBusy(false); return; }
    await mesHist(sb, id, 'teste', 'TESTES', 'TESTES', `Teste ${MES_TESTES_TIPO[f.tipo]} — ${nome}: ${f.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO'}`);
    setF({ ...f, nome: '', obs: '' }); await carregar(); onMudou(); setBusy(false);
  };
  if (!t) return <div style={{ color: 'var(--fg3)' }}>Carregando…</div>;
  const podeRegistrar = podeEditar && d.etapa_atual === 'TESTES';
  return (
    <div>
      {podeRegistrar ? (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(MES_TESTES_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="input" list="mes-testes-sug" placeholder="Teste" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })}/>
          <datalist id="mes-testes-sug">{MES_TESTES_SUGESTOES[f.tipo].map(n => <option key={n} value={n}/>)}</datalist>
          <select className="input" value={f.resultado} onChange={e => setF({ ...f, resultado: e.target.value })}><option value="aprovado">APROVADO</option><option value="reprovado">REPROVADO</option></select>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder={f.resultado === 'reprovado' ? 'Descreva o problema (obrigatório)' : 'Observação'} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })}/>
          <button className="btn btn--sm btn--primary" disabled={busy} onClick={registrar}>Registrar resultado</button>
        </div>
      ) : <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 8 }}>Resultados só podem ser registrados enquanto a OP está na etapa Testes.</div>}
      {msg && <div style={{ color: 'var(--vp-danger, #c0392b)', marginBottom: 8 }}>{msg}</div>}
      <div className="table-wrap">
        <table className="t pcp-grid">
          <thead><tr><th>Quando</th><th>Tipo</th><th>Teste</th><th>Resultado</th><th>Quem</th><th>Observação</th></tr></thead>
          <tbody>
            {t.map(x => (
              <tr key={x.id}>
                <td>{new Date(x.testado_em).toLocaleString('pt-BR')}</td><td>{MES_TESTES_TIPO[x.tipo]}</td><td>{x.nome}</td>
                <td style={{ color: x.resultado === 'aprovado' ? '#2e9e5b' : 'var(--vp-danger, #c0392b)', fontWeight: 700 }}>{x.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO'}{x.nc ? ' · ' + x.nc.numero : ''}</td>
                <td>{x.testado_por || '—'}</td><td>{x.observacao || '—'}</td>
              </tr>
            ))}
            {!t.length && <tr><td colSpan={6} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhum teste registrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg3)', padding: 8 }}>Para concluir Testes: ao menos um teste sem potência e um energizado, e o último resultado de cada teste aprovado. Reprovado abre NC automaticamente.</div>
    </div>
  );
}

function MESNcs({ ctx, id, d, onMudou }) {
  const { sb, podeEditar } = ctx;
  const [l, setL] = React.useState(null);
  const [novo, setNovo] = React.useState(null);
  const [corr, setCorr] = React.useState({});     // { [ncId]: texto }
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const carregar = React.useCallback(async () => {
    const r = await sb.from('mes_nc').select('*').eq('ordem_id', id).order('aberto_em', { ascending: false });
    setL(r.data || []);
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  const abrir = async () => {
    if (!(novo.descricao || '').trim()) { setMsg('Descreva o problema.'); return; }
    setBusy(true); setMsg(null);
    const r = await mesAbrirNc(sb, id, d.etapa_atual, { descricao: novo.descricao.trim(), componente: (novo.componente || '').trim(), causa: (novo.causa || '').trim() });
    if (r.error) setMsg(r.error.message); else setNovo(null);
    await carregar(); onMudou(); setBusy(false);
  };
  const corrigir = async (n) => {
    const acao = (corr[n.id] || '').trim();
    if (!acao) { setMsg('Descreva a ação corretiva.'); return; }
    setBusy(true); setMsg(null);
    const { error } = await sb.from('mes_nc').update({ status: 'corrigida', acao_corretiva: acao, corrigido_por: mesUser(), corrigido_em: new Date().toISOString() }).eq('id', n.id).eq('status', 'aberta');
    if (error) setMsg(error.message); else await mesHist(sb, id, 'nc_corrigida', n.etapa_codigo, n.etapa_codigo, `${n.numero} corrigida — ${acao}`);
    await carregar(); onMudou(); setBusy(false);
  };
  const fechar = async (n) => {
    setBusy(true); setMsg(null);
    // NC nascida em Testes só fecha com teste APROVADO registrado depois da correção.
    if (n.etapa_codigo === 'TESTES') {
      const r = await sb.from('mes_testes').select('id', { count: 'exact', head: true }).eq('ordem_id', id).eq('resultado', 'aprovado').gt('testado_em', n.corrigido_em);
      if (!(r.count > 0)) { setMsg('Registre um novo teste APROVADO (aba Testes) depois da correção para fechar esta NC.'); setBusy(false); return; }
    }
    const { error } = await sb.from('mes_nc').update({ status: 'fechada', retest_result: 'aprovado', fechado_por: mesUser(), fechado_em: new Date().toISOString() }).eq('id', n.id).eq('status', 'corrigida');
    if (error) setMsg(error.message); else { await mesHist(sb, id, 'nc_fechada', n.etapa_codigo, n.etapa_codigo, `${n.numero} fechada — reteste/reinspeção aprovado`); window.VPLog?.registrar?.({ modulo: 'MES', acao: 'fechar_nc', alvo: n.numero, alvo_id: id, detalhe: 'reteste aprovado' }); }
    await carregar(); onMudou(); setBusy(false);
  };
  if (!l) return <div style={{ color: 'var(--fg3)' }}>Carregando…</div>;
  return (
    <div>
      {msg && <div style={{ color: 'var(--vp-danger, #c0392b)', marginBottom: 8 }}>{msg}</div>}
      {podeEditar && d.etapa_atual !== 'AGUARDANDO' && d.etapa_atual !== 'EXPEDIDO' && (novo ? (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'grid', gap: 8 }}>
          <input className="input" placeholder="Problema encontrado (obrigatório)" value={novo.descricao || ''} onChange={e => setNovo({ ...novo, descricao: e.target.value })}/>
          <input className="input" placeholder="Componente envolvido" value={novo.componente || ''} onChange={e => setNovo({ ...novo, componente: e.target.value })}/>
          <input className="input" placeholder="Causa provável" value={novo.causa || ''} onChange={e => setNovo({ ...novo, causa: e.target.value })}/>
          <div><button className="btn btn--sm btn--primary" disabled={busy} onClick={abrir}>Abrir NC</button> <button className="btn btn--sm" onClick={() => setNovo(null)}>Cancelar</button></div>
        </div>
      ) : <button className="btn btn--sm" style={{ marginBottom: 12 }} onClick={() => setNovo({})}>Abrir NC (reprovar etapa)</button>)}
      {l.map(n => (
        <div key={n.id} className="card" style={{ padding: 12, marginBottom: 8, borderLeft: '5px solid ' + (n.status === 'fechada' ? '#2e9e5b' : '#7b3fa0') }}>
          <b>{n.numero}</b> · {n.status === 'aberta' ? 'EM RETRABALHO' : n.status === 'corrigida' ? 'CORRIGIDA — aguardando reteste' : 'FECHADA'} · etapa {mesNomeEtapa(ctx.etapas, n.etapa_codigo)}
          <div>{n.descricao}{n.componente ? ' · ' + n.componente : ''}{n.causa ? ' · causa: ' + n.causa : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Aberta {new Date(n.aberto_em).toLocaleString('pt-BR')} por {n.aberto_por || '—'}
            {n.corrigido_em && ` · corrigida ${new Date(n.corrigido_em).toLocaleString('pt-BR')} por ${n.corrigido_por || '—'}: ${n.acao_corretiva}`}
            {n.fechado_em && ` · fechada ${new Date(n.fechado_em).toLocaleString('pt-BR')} por ${n.fechado_por || '—'}`}</div>
          {podeEditar && n.status === 'aberta' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Ação corretiva realizada" value={corr[n.id] || ''} onChange={e => setCorr({ ...corr, [n.id]: e.target.value })}/>
              <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => corrigir(n)}>Registrar correção</button>
            </div>
          )}
          {podeEditar && n.status === 'corrigida' && <div style={{ marginTop: 8 }}><button className="btn btn--sm btn--primary" disabled={busy} onClick={() => fechar(n)}>{n.etapa_codigo === 'TESTES' ? 'Fechar NC (reteste aprovado)' : 'Fechar NC (reinspeção aprovada)'}</button></div>}
        </div>
      ))}
      {!l.length && <div style={{ color: 'var(--fg3)' }}>Nenhuma não conformidade.</div>}
    </div>
  );
}

/* ---------------- Apontamentos ---------------- */
function MESApontamentos({ ctx }) {
  const { sb, etapas } = ctx;
  const [ex, setEx] = React.useState(null);
  React.useEffect(() => {
    sb.from('mes_execucoes').select('*, op:pcp_ordens(numero, cliente)').order('iniciada_em', { ascending: false }).limit(300).then(r => setEx(r.data || []));
  }, [sb]);
  if (!ex) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const nome = (c) => (etapas.find(e => e.codigo === c) || {}).nome || c;
  const medias = {};
  ex.filter(x => x.status === 'concluida' && x.duracao_min != null).forEach(x => { const m = (medias[x.etapa_codigo] = medias[x.etapa_codigo] || { n: 0, soma: 0 }); m.n++; m.soma += Number(x.duracao_min); });
  const min = (v) => v == null ? '—' : Number(v) >= 60 ? `${Math.floor(v / 60)}h${String(Math.round(v % 60)).padStart(2, '0')}` : `${Math.round(v)} min`;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {etapas.filter(e => medias[e.codigo]).map(e => (
          <div key={e.codigo} className="card" style={{ padding: 10, minWidth: 150 }}>
            <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{e.nome}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{min(medias[e.codigo].soma / medias[e.codigo].n)}</div>
            <div style={{ fontSize: 11, color: 'var(--fg3)' }}>média · {medias[e.codigo].n} apontamento(s)</div>
          </div>
        ))}
        {!Object.keys(medias).length && <div style={{ color: 'var(--fg3)' }}>Os tempos médios aparecem quando houver etapas concluídas.</div>}
      </div>
      <div className="table-wrap">
        <table className="t pcp-grid">
          <thead><tr><th>OP</th><th>Cliente</th><th>Etapa</th><th>Operador</th><th>Início</th><th>Fim</th><th>Trabalhado</th><th>Parado</th></tr></thead>
          <tbody>
            {ex.map(x => (
              <tr key={x.id}>
                <td>{x.op ? x.op.numero : '—'}</td><td>{x.op ? x.op.cliente || '—' : '—'}</td><td>{nome(x.etapa_codigo)}</td><td>{x.operador || '—'}</td>
                <td>{new Date(x.iniciada_em).toLocaleString('pt-BR')}</td><td>{x.concluida_em ? new Date(x.concluida_em).toLocaleString('pt-BR') : 'em andamento'}</td>
                <td>{min(x.duracao_min)}</td><td>{min(x.pausa_min)}</td>
              </tr>
            ))}
            {!ex.length && <tr><td colSpan={8} style={{ color: 'var(--fg3)', padding: 16 }}>Sem apontamentos.</td></tr>}
          </tbody>
        </table>
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
              <div key={l.ordem_id} className="card" onClick={() => ctx.abrir(l.ordem_id)} style={{ cursor: 'pointer', padding: 10, marginBottom: 8, borderLeft: '5px solid ' + (ctx.bloqueadas[l.ordem_id] ? '#555' : ctx.ncAbertas[l.ordem_id] ? '#7b3fa0' : mesPrazoCor(l.op, false)), fontSize: 12, opacity: ctx.bloqueadas[l.ordem_id] ? 0.8 : 1 }}>
                <b>{l.op.numero}</b> · {l.op.cliente || '—'}{ctx.bloqueadas[l.ordem_id] && <span className="pcp-tag" style={{ marginLeft: 6 }}>BLOQUEADA</span>}{ctx.ncAbertas[l.ordem_id] && <span className="pcp-tag" style={{ marginLeft: 6 }}>RETRABALHO</span>}
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
  const [aba, setAba] = window.useRouteTab('mes', 'kanban', ['kanban', 'ordens', 'apontamentos'], false, true);
  const [opId, setOpId] = window.useRotaItem('mes', aba);
  const [etapas, setEtapas] = React.useState(null);
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [bloqueadas, setBloqueadas] = React.useState({});
  const [ncAbertas, setNcAbertas] = React.useState({});
  const [liberar, setLiberar] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);

  const recarregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [e, m, bq, nq] = await Promise.all([
      sb.from('mes_etapas').select('*').order('sequencia'),
      sb.from('mes_ordens').select('*, op:pcp_ordens(numero, titulo, produto, cliente, prazo_entrega)').order('liberada_em', { ascending: false }).limit(500),
      sb.from('mes_bloqueios').select('ordem_id').is('fim', null).limit(1000),
      sb.from('mes_nc').select('ordem_id').neq('status', 'fechada').limit(1000),
    ]);
    if (e.error || m.error) { setErro((e.error || m.error).message); return; }
    setEtapas(e.data || []); setLinhas(m.data || []);
    const b = {}; (bq.data || []).forEach(x => { b[x.ordem_id] = true; }); setBloqueadas(b);
    const n = {}; (nq.data || []).forEach(x => { n[x.ordem_id] = true; }); setNcAbertas(n);
  }, [sb]);
  React.useEffect(() => {
    recarregar();
    const t = setInterval(recarregar, 30000);
    Promise.resolve(window.PropostaStore?.temCapacidade?.('mes', 'editar')).then(v => setPodeEditar(!!v)).catch(() => {});
    return () => clearInterval(t);
  }, [recarregar]);

  const ctx = etapas && linhas && { sb, etapas, linhas, bloqueadas, ncAbertas, podeEditar, recarregar, abrir: (id) => setOpId(id) };
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
          <button className={'btn btn--sm' + (aba === 'apontamentos' ? ' btn--primary' : '')} onClick={() => setAba('apontamentos')}>Apontamentos</button>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--sm btn--primary" disabled={!podeEditar} onClick={() => setLiberar(true)}>Liberar OP para o MES</button>
        </div>
      )}
      {erro && <div style={{ color: 'var(--vp-danger, #c0392b)', padding: 12 }}>{erro}</div>}
      {!erro && !ctx && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {ctx && opId && <MESDetalhe ctx={ctx} id={opId} onVoltar={() => setOpId(null)}/>}
      {ctx && !opId && aba === 'kanban' && <MESKanban ctx={ctx}/>}
      {ctx && !opId && aba === 'ordens' && <MESOrdens ctx={ctx}/>}
      {ctx && !opId && aba === 'apontamentos' && <MESApontamentos ctx={ctx}/>}
      {ctx && liberar && <MESLiberar ctx={ctx} onFechar={() => setLiberar(false)}/>}
    </div>
  );
}

Object.assign(window, { MESPage });
