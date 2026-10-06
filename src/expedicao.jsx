/* ============================================================
   expedicao.jsx — Logística Interna · Expedição (envio do que foi fabricado ao cliente).
   Fluxo: Fabricação concluída → Emissão de NF (Fiscal/Financeiro, no Omie) → Expedição.
   A Expedição só libera pedido com NF emitida (faturado no Omie); a trava existe no banco
   (trigger fn_pcp_expedicao_exige_nf), então vale mesmo chamando a API direto.
   Dados: pcp_pedidos / pcp_pedido_itens (lidos do Omie pela função sync-pcp-pedidos), pcp_ordens (OP-mãe do pedido),
   pcp_expedicoes (despacho e entrega). Comprovante/canhoto vai para o bucket público "engenharia".
   Regras que existem por motivo real:
   - A fila mostra só o que ainda precisa de ação: pedido marcado como HISTÓRICO, proposta/pedido em aberto (etapas 00/10) e pedido
     que o Omie já deu como entregue (etapa 70+) sem registro aqui ficam escondidos (chip "Mostrar histórico e já entregues").
   - Prazo de despacho = 1 dia útil depois da NF (mesma regra do SLA do PCP, window.PcpPedidoSLA); pronto passado do prazo = atrasado.
   - Pedido faturado com OP-mãe ainda aberta recebe aviso (a NF não prova que a produção acabou).
   - O código de rastreio costuma chegar depois da saída: continua editável enquanto o pedido não for entregue.
   - Desfazer saída/entrega exige motivo e fica no log; só quem tem a alçada de edição da Expedição.
   - O canhoto continua em link público (bucket "engenharia") — decisão de privacidade ainda em aberto.
   ============================================================ */

function expData(d) { return d ? d.split('-').reverse().join('/') : '—'; }
function expFmt(v, d = 3) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function expHoje() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }     // fuso de Brasília
function expUsuario() { return (window.__VP_USER && window.__VP_USER.email) || null; }
function expEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function expDias(de, ate) { return Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000); }
// Código de objeto dos Correios (AA123456789BR) → link de rastreamento; outros códigos só ganham o botão copiar.
function expLinkRastreio(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c) ? `https://www.linkcorreios.com.br/?id=${c}` : null;
}

function ExpedicaoPage({ setRoute, setSubsel }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('pronto');
  const [busca, setBusca] = React.useState('');
  const [mostrarHist, setMostrarHist] = React.useState(false);
  const [aberto, setAberto] = React.useState(null);          // codigo_pedido em edição
  const [itens, setItens] = React.useState([]);
  const [form, setForm] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [p, o, e, h] = await Promise.all([
      sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_endereco, cliente_telefone, data_pedido, data_previsao, faturado, data_faturamento, nf_autorizada, cancelado, volumes, peso_bruto, valor_total').eq('cancelado', false).order('data_previsao', { ascending: true }).limit(500),
      sb.from('pcp_ordens').select('id, numero, pedido_codigo, status').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
      sb.from('pcp_expedicoes').select('*').limit(1000),
      sb.from('pcp_pedido_acompanhamento').select('numero_pedido').eq('historico', true).limit(5000),
    ]);
    const err = p.error || o.error || e.error || h.error;
    if (err) { setErro(err.message); return; }
    const maes = {}; (o.data || []).forEach(x => { maes[x.pedido_codigo] = x; });
    const exps = {}; (e.data || []).forEach(x => { exps[x.pedido_codigo] = x; });
    setErro(null); setDados({ pedidos: p.data || [], maes, exps, hist: new Set((h.data || []).map(x => x.numero_pedido)) });
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  // Atualiza sozinha (a cada minuto e ao voltar para a aba), sem mexer no pedido que está aberto.
  React.useEffect(() => {
    const t = setInterval(carregar, 60000);
    const v = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [carregar]);
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
    if (dados.hist.has(p.numero_pedido) || Number(p.etapa) >= 70) return 'encerrado';         // histórico ou o Omie já deu como entregue
    if (p.etapa === '00' || p.etapa === '10') return 'aberto';                                 // proposta / pedido ainda não é trabalho de expedição
    if (p.faturado) return 'pronto';
    return 'aguardando_nf';
  };
  const limiteDespacho = (p) => p.data_faturamento && window.PcpPedidoSLA ? window.PcpPedidoSLA.somarDiasUteis(p.data_faturamento, 1) : null;
  const hoje = expHoje();
  const atrasado = (p) => { const l = limiteDespacho(p); return situacao(p) === 'pronto' && !!l && hoje > l; };

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
  // O código de rastreio costuma chegar depois da saída: grava só rastreio/observação, sem mexer no resto.
  const salvarRastreio = async (p) => {
    setBusy(true);
    const { error } = await sb.from('pcp_expedicoes').update({ rastreio: String(form.rastreio).trim() || null, observacao: String(form.observacao).trim() || null, atualizado_por: expUsuario() }).eq('pedido_codigo', p.codigo_pedido);
    setBusy(false);
    if (error) { window.toast?.('Não foi possível salvar: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Expedição', acao: 'Atualizou o rastreio', alvo: `Pedido ${p.numero_pedido} — ${p.cliente_nome || ''}`, detalhe: String(form.rastreio || '').trim() || undefined });
    window.toast?.('Rastreio salvo.'); carregar();
  };
  // Desfaz a última etapa (entregue → despachado; despachado → pronto). Exige motivo, que vai para a observação e para o log.
  const desfazer = async (p, s) => {
    const motivo = window.prompt(s === 'entregue' ? 'Por que a entrega está sendo desfeita?' : 'Por que a saída está sendo desfeita?', '');
    if (motivo === null) return;
    if (!motivo.trim()) { window.toast?.('Informe o motivo.'); return; }
    const x = dados.exps[p.codigo_pedido] || {};
    const nota = `[${s === 'entregue' ? 'Entrega' : 'Saída'} desfeita em ${expData(expHoje())} por ${expUsuario() || '—'}: ${motivo.trim()}]`;
    const corpo = s === 'entregue'
      ? { status: 'despachado', data_entrega: null }
      : { status: 'aguardando', data_saida: null };
    corpo.observacao = [x.observacao, nota].filter(Boolean).join(' ').slice(0, 1000);
    corpo.atualizado_por = expUsuario();
    setBusy(true);
    const { error } = await sb.from('pcp_expedicoes').update(corpo).eq('pedido_codigo', p.codigo_pedido);
    setBusy(false);
    if (error) { window.toast?.('Não foi possível desfazer: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Expedição', acao: s === 'entregue' ? 'Desfez a entrega' : 'Desfez a saída', alvo: `Pedido ${p.numero_pedido} — ${p.cliente_nome || ''}`, detalhe: motivo.trim() });
    window.toast?.(s === 'entregue' ? 'Entrega desfeita.' : 'Saída desfeita.');
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
  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); window.toast?.('Código copiado.'); }
    catch (e) { window.prompt('Copie o código:', texto); }
  };
  const imprimirRomaneio = (p) => {
    const w = window.open('', '_blank');
    if (!w) { window.toast?.('Permita pop-ups para imprimir.'); return; }
    const linhas = itens.map(i => `<tr><td style="width:24px">☐</td><td>${expEsc(i.codigo)}</td><td>${expEsc(i.descricao)}</td><td style="text-align:right">${expFmt(i.quantidade)} ${expEsc(i.unidade || '')}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Romaneio ${expEsc(p.numero_pedido)}</title><style>
      body{font-family:Poppins,Arial,sans-serif;font-weight:300;font-size:12px;margin:28px;color:#111}h1{font-size:18px;font-weight:500;text-align:center}
      table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#eee;font-weight:500;font-size:11px;text-transform:uppercase}
      .g{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:10px 0}b{font-weight:500}.ass{margin-top:40px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:11px}</style></head><body>
      <h1>ROMANEIO DE EXPEDIÇÃO — PEDIDO ${expEsc(p.numero_pedido)}</h1>
      <div class="g"><div><b>Cliente:</b> ${expEsc(p.cliente_nome)}</div><div><b>NF emitida em:</b> ${expData(p.data_faturamento)}</div>
      <div><b>Endereço:</b> ${expEsc(p.cliente_endereco)}</div><div><b>Telefone:</b> ${expEsc(p.cliente_telefone)}</div>
      <div><b>Entrega:</b> ${form.retirada ? 'Retirada pelo cliente' : 'Transportadora ' + expEsc(form.transportadora || '________')}</div><div><b>Volumes:</b> ${expEsc(form.volumes || '____')}</div></div>
      <table><tr><th></th><th>Código</th><th>Descrição</th><th>Quantidade</th></tr>${linhas}</table>
      <div class="ass"><div>Conferido por (expedição)</div><div>Recebido por (transportador/cliente)</div></div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  if (erro) return <div className="page"><div style={{ color: 'var(--vp-danger)', padding: 16 }}>{erro}</div></div>;
  if (!dados) return <div className="page"><div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div></div>;

  const escondidos = dados.pedidos.filter(p => ['encerrado', 'aberto'].includes(situacao(p))).length;
  const base = dados.pedidos.filter(p => mostrarHist || !['encerrado', 'aberto'].includes(situacao(p)));
  const contagem = { aguardando_nf: 0, pronto: 0, despachado: 0, entregue: 0 };
  base.forEach(p => { if (contagem[situacao(p)] != null) contagem[situacao(p)]++; });
  const nAtrasados = base.filter(atrasado).length;
  const q = busca.trim().toLowerCase();
  const lista = base.filter(p => filtro === 'todos' || situacao(p) === filtro)
    .filter(p => !q || (String(p.numero_pedido) + ' ' + (p.cliente_nome || '')).toLowerCase().includes(q))
    .sort((a, b) => filtro === 'pronto' ? String(a.data_faturamento || '9999').localeCompare(String(b.data_faturamento || '9999')) : 0);   // pronto: NF mais antiga primeiro
  const cor = { aguardando_nf: undefined, pronto: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', despachado: 'color-mix(in srgb, #3b82c4 25%, transparent)', entregue: 'color-mix(in srgb, #2e9e5b 25%, transparent)', encerrado: undefined, aberto: undefined };
  const rotulo = { aguardando_nf: 'Aguardando NF', pronto: 'Pronto para expedir', despachado: 'Despachado', entregue: 'Entregue', encerrado: 'Já entregue (Omie/histórico)', aberto: 'Ainda não é venda firme' };
  const kpi = (chave, rot, sub) => (
    <button className="card pcp-total" onClick={() => setFiltro(chave)} style={{ padding: 14, flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', outline: filtro === chave ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{contagem[chave]}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--vp-danger)' }}>{sub}</div> : null}
    </button>
  );
  const exportar = () => {
    const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Pedido', 'Cliente', 'Situação', 'NF emitida em', 'Dias desde a NF', 'Prazo de despacho', 'Previsão', 'Transportadora / retirada', 'Volumes', 'Rastreio', 'Saída', 'Entrega'],
      ...lista.map(p => { const x = dados.exps[p.codigo_pedido] || {}; const l = limiteDespacho(p);
        return [p.numero_pedido, p.cliente_nome || '', rotulo[situacao(p)] + (atrasado(p) ? ' (atrasado)' : ''), expData(p.data_faturamento), p.data_faturamento ? expDias(p.data_faturamento, hoje) : '', l ? expData(l) : '',
          expData(p.data_previsao), x.retirada ? 'retirada pelo cliente' : (x.transportadora || ''), x.volumes ?? p.volumes ?? '', x.rastreio || '', expData(x.data_saida), expData(x.data_entrega)]; })];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `expedicao-${hoje}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Expedição</div>
          <h1 className="page-head__title">Expedição</h1>
          <p className="page-head__sub">Envio ao cliente do que foi fabricado. Só libera pedido com NF emitida; despache em até 1 dia útil depois da NF.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('aguardando_nf', 'Aguardando NF')}
        {kpi('pronto', 'Prontos para expedir', nAtrasados ? `${nAtrasados} com despacho atrasado` : null)}
        {kpi('despachado', 'Despachados')}
        {kpi('entregue', 'Entregues')}
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (filtro === 'todos' ? ' btn--primary' : '')} onClick={() => setFiltro('todos')}>Todos</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }} title="Pedidos marcados como histórico, propostas e pedidos que o Omie já deu como entregues"><input type="checkbox" checked={mostrarHist} onChange={e => setMostrarHist(e.target.checked)}/>mostrar histórico e já entregues ({escondidos})</label>
        <input className="input" placeholder="Buscar pedido ou cliente…" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 220 }}/>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" disabled={!lista.length} onClick={exportar} title="Baixa a lista que está na tela em planilha CSV">Exportar planilha</button>
        <button className="btn btn--sm" disabled={busy} onClick={atualizarOmie} title="Relê no Omie os pedidos ainda não entregues, para pegar NF emitida">{busy ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Produção</th><th>NF</th><th>Previsão</th><th>Expedição</th><th></th></tr></thead>
          <tbody>
            {lista.map(p => {
              const s = situacao(p), x = dados.exps[p.codigo_pedido], mae = dados.maes[p.codigo_pedido];
              const opAberta = !!mae && !['concluida', 'cancelada'].includes(mae.status);
              const atr = atrasado(p), lim = limiteDespacho(p);
              const link = x && expLinkRastreio(x.rastreio);
              return (
                <React.Fragment key={p.codigo_pedido}>
                  <tr>
                    <td><b style={{ fontWeight: 500 }}>{p.numero_pedido}</b></td>
                    <td style={{ minWidth: 220 }}>{p.cliente_nome || '—'}</td>
                    <td>{mae ? <button className="pcp-cod" onClick={() => { try { sessionStorage.setItem('vp_pcp_op', mae.id); } catch (e) { /* ok */ } setSubsel && setSubsel(null); setRoute && setRoute('pcp'); }}>{mae.numero}</button> : <span style={{ color: 'var(--fg3)' }}>sem OP</span>}{mae && <span className="pcp-tag" style={{ marginLeft: 6 }}>{mae.status === 'concluida' ? 'concluída' : mae.status.replace('_', ' ')}</span>}
                      {opAberta && p.faturado && s !== 'entregue' ? <div style={{ fontSize: 10, color: 'var(--vp-danger)' }} title="Tem NF, mas a OP-mãe do pedido ainda não foi concluída. Confira a produção antes de despachar.">⚠ produção ainda aberta</div> : null}</td>
                    <td>{p.faturado ? <>NF emitida <span style={{ color: 'var(--fg3)' }}>{expData(p.data_faturamento)}</span>{s === 'pronto' && p.data_faturamento ? <div style={{ fontSize: 10, color: atr ? 'var(--vp-danger)' : 'var(--fg3)' }}>há {expDias(p.data_faturamento, hoje)} dia(s){lim ? ` · prazo ${expData(lim)}` : ''}</div> : null}</> : <span style={{ color: 'var(--fg3)' }}>não emitida</span>}</td>
                    <td>{expData(p.data_previsao)}</td>
                    <td><span className="pcp-tag" style={cor[s] ? { background: cor[s] } : undefined}>{rotulo[s]}</span>{atr ? <> <span className="pcp-tag" style={{ background: 'color-mix(in srgb, var(--vp-danger, #c0392b) 25%, transparent)' }}>Despacho atrasado</span></> : null}
                      {x && x.status !== 'aguardando' && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{x.retirada ? 'retirada pelo cliente' : x.transportadora}{x.data_saida ? ' · saiu ' + expData(x.data_saida) : ''}{x.data_entrega ? ' · entregue ' + expData(x.data_entrega) : ''}</div>}
                      {x && x.rastreio ? <div style={{ fontSize: 10 }}>rastreio: <b style={{ fontWeight: 500 }}>{x.rastreio}</b>{link ? <> · <a href={link} target="_blank" rel="noopener noreferrer">rastrear</a></> : null}</div> : null}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s === 'aguardando_nf'
                        ? <span title="O Fiscal emite a NF no Omie; depois clique em Atualizar do Omie" style={{ fontSize: 11, color: 'var(--fg3)' }}>trava até ter NF</span>
                        : (s === 'encerrado' || s === 'aberto')
                          ? <span style={{ fontSize: 11, color: 'var(--fg3)' }}>—</span>
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
                          <button className="btn btn--sm" style={{ marginTop: 6 }} disabled={!itens.length} onClick={() => imprimirRomaneio(p)}>Imprimir romaneio</button>
                        </div>
                        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                          {opAberta && <div style={{ flex: '1 1 100%', fontSize: 12, color: 'var(--vp-danger)' }}>⚠ A OP-mãe {mae.numero} deste pedido ainda não foi concluída. Confira a produção antes de despachar.</div>}
                          {s !== 'entregue' && (<>
                            <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!form.retirada} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, retirada: e.target.checked })}/> Retirada pelo cliente</label>
                            {!form.retirada && <input className="input" placeholder="Transportadora" value={form.transportadora} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, transportadora: e.target.value })} style={{ width: 200 }}/>}
                            <input className="input" type="number" min="0" placeholder="Volumes" value={form.volumes} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, volumes: e.target.value })} style={{ width: 90 }}/>
                            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Saída <input className="input" type="date" value={form.data_saida} disabled={!podeEditar || s === 'despachado'} onChange={e => setForm({ ...form, data_saida: e.target.value })}/></label>
                            <input className="input" placeholder="Rastreio / nº do conhecimento (pode ser preenchido depois da saída)" value={form.rastreio} disabled={!podeEditar} onChange={e => setForm({ ...form, rastreio: e.target.value })} style={{ width: 300 }}/>
                            {String(form.rastreio || '').trim() && <button className="btn btn--sm" onClick={() => copiar(String(form.rastreio).trim())} title="Copia o código de rastreio">Copiar</button>}
                            {expLinkRastreio(form.rastreio) && <a className="btn btn--sm" href={expLinkRastreio(form.rastreio)} target="_blank" rel="noopener noreferrer" title="Abre o rastreamento dos Correios para este código">Rastrear nos Correios</a>}
                          </>)}
                          {(s === 'despachado' || s === 'entregue') && (<>
                            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Entrega <input className="input" type="date" value={form.data_entrega} disabled={!podeEditar || s === 'entregue'} onChange={e => setForm({ ...form, data_entrega: e.target.value })}/></label>
                            {s === 'despachado' && podeEditar && <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Canhoto / comprovante <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => anexar(p, e.target.files[0])}/></label>}
                            {form.comprovante && <a href={form.comprovante} target="_blank" rel="noopener noreferrer" className="pcp-cod" style={{ fontSize: 12 }}>ver comprovante</a>}
                          </>)}
                          <input className="input" placeholder="Observação" value={form.observacao} disabled={!podeEditar || s === 'entregue'} onChange={e => setForm({ ...form, observacao: e.target.value })} style={{ flex: '1 1 100%' }}/>
                          {podeEditar && s === 'pronto' && <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => gravar(p, 'despachado')}>Registrar saída</button>}
                          {podeEditar && s === 'despachado' && <button className="btn btn--sm" disabled={busy} onClick={() => salvarRastreio(p)}>Salvar rastreio</button>}
                          {podeEditar && s === 'despachado' && <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => gravar(p, 'entregue')}>Confirmar entrega</button>}
                          {podeEditar && (s === 'despachado' || s === 'entregue') && <button className="btn btn--sm" disabled={busy} onClick={() => desfazer(p, s)} title="Volta uma etapa (pede o motivo e registra no log)">{s === 'entregue' ? 'Desfazer entrega' : 'Desfazer saída'}</button>}
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
        A NF é emitida no Omie pelo Fiscal/Financeiro; “Atualizar do Omie” traz o status (a tela também se atualiza sozinha a cada minuto). Sem NF emitida o banco recusa o despacho. O cliente recebe o pedido inteiro, inclusive os itens que não são do PCP (em negrito, os do PCP). Pedidos históricos, propostas e os que o Omie já deu como entregues ficam escondidos — marque "mostrar histórico e já entregues" para vê-los.
      </div>
    </div>
  );
}

Object.assign(window, { ExpedicaoPage });
