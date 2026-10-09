/* ============================================================
   almoxarifado-compras.jsx — Logística Interna · Almoxarifado · aba "Pedidos de compra".
   Três visões, cada uma com link próprio (/logistica/almoxarifado/pedidos/{omie|requisicoes|internos}):
   1) Compras no Omie — pedidos de compra JÁ feitos (lidos do Omie por sync-pcp-compras, só os itens do PCP): o que está a caminho,
      previsão de chegada, atraso, o que foi recebido. A requisição só vira pedido depois que o comprador converte no Omie.
   2) Requisições enviadas — o que o PCP mandou ao Omie pelos botões "Enviar compra ao Omie" (Reposição/Necessidade), com o
      pedido de compra que provavelmente nasceu dela (mesmo item, pedido feito depois da requisição — aproximação, avisada na tela).
   3) Pedidos internos (varejo) — pedido de insumo/peça que passa pela aprovação do Chefe de Logística (pedidos-varejo-store.js).
   Regras que existem por motivo real:
   - Valores (preço/total) só são pedidos ao banco para quem tem almoxarifado.ver_custo (sem a alçada, nem consulta).
   - Nada é escrito no Omie aqui. "Atualizar do Omie" só relê (sync-pcp-compras); a leitura automática roda todo dia de manhã.
   - Previsão de chegada IGUAL à data do pedido = ninguém combinou prazo (o Omie preenche assim): vira "previsão não informada" e
     NÃO conta como atrasado. Só previsão maior que a data do pedido e já vencida é atraso (mesma regra do alerta diário no banco).
   - Requisição enviada sem pedido há 3+ dias úteis é marcada "parada" (e também avisada no alerta diário pcp_compras_alertar).
   - Pedido do Omie "recebido" = todas as linhas do PCP com quantidade recebida >= pedida; "parcial" = alguma recebida.
   - A visão padrão é "internos" quando há pedido interno aguardando aprovação/compra (a Central de Decisões abre esta aba
     para o pedido de varejo), senão "omie".
   Exposto: AlmoxarifadoPedidos.
   ============================================================ */

const PC_URG = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
const PC_ST_INT = {
  pendente: { l: 'Aguardando Logística', v: 'warning' }, aprovado: { l: 'Aprovado', v: 'info' }, reprovado: { l: 'Reprovado', v: 'danger' },
  comprado: { l: 'Comprado', v: 'success' }, cancelado: { l: 'Cancelado', v: 'neutral' },
};
const PC_ST_OMIE = { pendente: { l: 'A caminho', v: 'info' }, parcial: { l: 'Recebido em parte', v: 'warning' }, recebido: { l: 'Recebido', v: 'success' } };
const PC_DEFASADO_H = 36;
const PC_JUST_MIN = 500;       // espelho de PedidosVarejoStore.JUSTIFICATIVA_MIN_VALOR

const pcFmt = (v, d = 2) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
const pcMoeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pcData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
const pcHojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const pcDataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(',', '');
};
// Dias úteis (seg–sex) entre duas datas ISO, sem contar o dia de início.
function pcDiasUteis(de, ate) {
  let n = 0; const d = new Date(de + 'T00:00:00Z'), fim = new Date(ate + 'T00:00:00Z');
  while (d < fim) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
const pcDias = (de, ate) => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000);
const pcCsv = (rows) => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
const pcBaixar = (nome, texto) => {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
async function pcLerTudo(montar) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
// Recarrega sozinho (a cada minuto e ao voltar para a aba do navegador).
function usePcAtualizar(fn) {
  React.useEffect(() => {
    const t = setInterval(fn, 60000);
    const v = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [fn]);
}
function usePcOrdem() {
  const [ordem, setOrdem] = React.useState(null);
  const ordenarPor = (col) => setOrdem(o => !o || o.col !== col ? { col, dir: 'asc' } : o.dir === 'asc' ? { col, dir: 'desc' } : null);
  const th = (col, rot, extra) => <th style={{ cursor: 'pointer', userSelect: 'none', ...(extra || {}) }} title="Clique para ordenar" onClick={() => ordenarPor(col)}>{rot}{ordem && ordem.col === col ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>;
  const ordenar = (lista, valor, padrao) => lista.slice().sort((a, b) => {
    if (!ordem) return padrao ? padrao(a, b) : 0;
    const va = valor(a, ordem.col), vb = valor(b, ordem.col);
    const c = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR', { numeric: true }) : va - vb;
    return c * (ordem.dir === 'desc' ? -1 : 1);
  });
  return { th, ordenar };
}

/* ------------------------------------------------------------------ 1) Compras no Omie */
function PcComprasOmie() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [custo, setCusto] = React.useState(null);              // null = ainda não sabe a alçada
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('andamento');
  const [busca, setBusca] = React.useState(() => { try { const v = sessionStorage.getItem('vp_pc_busca') || ''; sessionStorage.removeItem('vp_pc_busca'); return v; } catch (e) { return ''; } });   // vem do vínculo "pedido N no Omie" dos pedidos internos
  const [aberto, setAberto] = React.useState(null);
  const [atualizando, setAtualizando] = React.useState(false);
  const { th, ordenar } = usePcOrdem();

  React.useEffect(() => {
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setCusto(!!v)).catch(() => setCusto(false));
  }, []);
  const carregar = React.useCallback(async () => {
    if (!sb || custo === null) return;
    try {
      const cols = 'pedido_id, item_id, numero_pedido, data_pedido, situacao, fornecedor_cod, codigo, unidade, quantidade, qtde_recebida, data_previsao, etapa, atualizado_em' + (custo ? ', valor_unitario, valor_total' : '');
      const [itens, forn, prods] = await Promise.all([
        pcLerTudo(() => sb.from('pcp_compras_itens').select(cols).order('pedido_id')),
        pcLerTudo(() => sb.from('pcp_fornecedores_omie').select('codigo, nome').order('codigo')),
        pcLerTudo(() => sb.from('pcp_produtos').select('codigo, descricao').order('codigo')),
      ]);
      setD({ itens, forn: Object.fromEntries(forn.map(f => [f.codigo, f.nome])), desc: Object.fromEntries(prods.map(p => [p.codigo, p.descricao])) });
      setErro(null);
    } catch (e) { setErro(e.message || String(e)); }
  }, [sb, custo]);
  React.useEffect(() => { carregar(); }, [carregar]);
  usePcAtualizar(carregar);

  const hoje = pcHojeBrasilia();
  const pedidos = React.useMemo(() => {
    if (!d) return [];
    const m = new Map();
    d.itens.forEach(l => {
      const p = m.get(l.pedido_id) || { id: l.pedido_id, numero: l.numero_pedido, data: l.data_pedido, previsao: l.data_previsao, etapa: l.etapa, forCod: l.fornecedor_cod, linhas: [] };
      p.linhas.push(l); m.set(l.pedido_id, p);
    });
    return Array.from(m.values()).map(p => {
      const rec = p.linhas.every(l => Number(l.qtde_recebida) >= Number(l.quantidade) - 1e-9);
      const algum = p.linhas.some(l => Number(l.qtde_recebida) > 0);
      const status = rec ? 'recebido' : algum ? 'parcial' : 'pendente';
      const previsaoReal = !!p.previsao && !!p.data && p.previsao > p.data;            // previsão = data do pedido => ninguém informou prazo
      const semPrevisao = status !== 'recebido' && !previsaoReal;
      const atrasado = status !== 'recebido' && previsaoReal && p.previsao < hoje;
      const semPreco = !!custo && status !== 'recebido' && p.linhas.some(l => Number(l.qtde_recebida) < Number(l.quantidade) && !(Number(l.valor_unitario) > 0));
      const emAberto = custo ? p.linhas.reduce((s, l) => s + Math.max(0, Number(l.quantidade) - Number(l.qtde_recebida)) * Number(l.valor_unitario || 0), 0) : null;
      const total = custo ? p.linhas.reduce((s, l) => s + Number(l.valor_total || 0), 0) : null;
      return { ...p, status, atrasado, semPrevisao, semPreco, diasAtraso: atrasado ? pcDias(p.previsao, hoje) : 0, emAberto, total, nome: d.forn[p.forCod] || (p.forCod ? `Fornecedor ${p.forCod}` : '—') };
    });
  }, [d, hoje, custo]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const andamento = pedidos.filter(p => p.status !== 'recebido');
  const atrasados = andamento.filter(p => p.atrasado);
  const recebidos = pedidos.filter(p => p.status === 'recebido');
  const emAbertoTotal = custo ? andamento.reduce((s, p) => s + (p.emAberto || 0), 0) : null;
  const linhasAReceber = andamento.reduce((s, p) => s + p.linhas.filter(l => Number(l.qtde_recebida) < Number(l.quantidade)).length, 0);
  const maiorAtraso = atrasados.reduce((m, p) => Math.max(m, p.diasAtraso), 0);
  const nSemPreco = andamento.filter(p => p.semPreco).length;
  const nSemPrev = andamento.filter(p => p.semPrevisao).length;
  const q = busca.trim().toLowerCase();
  const base = filtro === 'andamento' ? andamento : filtro === 'atrasados' ? atrasados : filtro === 'recebidos' ? recebidos : pedidos;
  const lista = ordenar(base.filter(p => !q || (p.numero + ' ' + p.nome + ' ' + p.linhas.map(l => l.codigo + ' ' + (d.desc[l.codigo] || '')).join(' ')).toLowerCase().includes(q)),
    (p, col) => ({ numero: Number(p.numero) || 0, fornecedor: p.nome, data: p.data || '', previsao: p.previsao || '9999', valor: p.emAberto || 0 }[col]),
    (a, b) => filtro === 'recebidos' ? String(b.data).localeCompare(String(a.data)) : String(a.previsao || '9999').localeCompare(String(b.previsao || '9999')));
  let ultima = null; d.itens.forEach(l => { if (l.atualizado_em && (!ultima || l.atualizado_em > ultima)) ultima = l.atualizado_em; });
  const defasado = !ultima || (Date.now() - new Date(ultima).getTime()) / 3.6e6 > PC_DEFASADO_H;

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const { data, error } = await sb.functions.invoke('sync-pcp-compras', { body: {} });
      if (error) { let det = error.message; try { const j = await error.context.json(); if (j?.error) det = j.error; } catch { /* sem corpo */ } throw new Error(det); }
      if (data && data.ok === false) throw new Error(data.error || data.aviso || 'Falha na leitura do Omie');
      await carregar();
      window.toast?.('Pedidos de compra atualizados com o Omie.', 'success');
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setAtualizando(false); }
  };
  const exportar = () => {
    const cab = ['Pedido', 'Fornecedor', 'Pedido em', 'Previsão', 'Situação', 'Dias de atraso', 'Código', 'Descrição', 'Unidade', 'Quantidade', 'Recebida', ...(custo ? ['Valor unit.', 'Valor total'] : [])];
    const n = (v) => v == null ? '' : Number(v).toFixed(2).replace('.', ',');
    const rows = [];
    lista.forEach(p => p.linhas.forEach(l => rows.push([p.numero, p.nome, pcData(p.data), pcData(p.previsao), PC_ST_OMIE[p.status].l, p.diasAtraso || '', l.codigo, d.desc[l.codigo] || '', l.unidade || '', n(l.quantidade), n(l.qtde_recebida), ...(custo ? [n(l.valor_unitario), n(l.valor_total)] : [])])));
    pcBaixar(`pedidos-de-compra-${hoje}.csv`, pcCsv([cab, ...rows]));
  };
  const btn = (a) => 'btn btn--sm' + (a ? ' btn--primary' : '');

  return (
    <div>
      <div style={{ padding: defasado ? 10 : 0, marginBottom: 8, border: defasado ? '1px solid var(--vp-warning)' : 'none', borderRadius: 8, fontSize: 12, color: defasado ? 'var(--fg1)' : 'var(--fg3)' }}>
        {defasado && <b>⚠ Dados desatualizados — clique em "Atualizar do Omie". </b>}
        Pedidos de compra lidos do Omie em {pcDataHora(ultima)} (leitura automática todo dia de manhã). Só aparecem as linhas de itens do PCP; recebidos dos últimos 12 meses e pendentes dos últimos 6.
      </div>
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Em andamento</div><div className="pcp-total__v">{andamento.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>pedido(s) a caminho ou recebidos em parte</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Atrasados</div><div className="pcp-total__v" style={{ color: atrasados.length ? 'var(--vp-danger)' : undefined }}>{atrasados.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>previsão combinada já passou{maiorAtraso ? ` · maior atraso ${maiorAtraso} dia(s)` : ''}{nSemPrev ? ` · ${nSemPrev} sem previsão informada` : ''}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">{custo ? 'Valor ainda a receber' : 'Itens a receber'}</div><div className="pcp-total__v">{custo ? pcMoeda(emAbertoTotal) : linhasAReceber}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{custo ? `${linhasAReceber} linha(s) de item a receber` : `linha(s) de item a receber em ${andamento.length} pedido(s)`}{custo && nSemPreco ? ` · ${nSemPreco} pedido(s) sem preço no Omie (valor subestimado)` : ''}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Recebidos</div><div className="pcp-total__v">{recebidos.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>pedido(s) nos últimos 12 meses</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(filtro === 'andamento')} onClick={() => setFiltro('andamento')}>Em andamento ({andamento.length})</button>
        <button className={btn(filtro === 'atrasados')} onClick={() => setFiltro('atrasados')}>Atrasados ({atrasados.length})</button>
        <button className={btn(filtro === 'recebidos')} onClick={() => setFiltro('recebidos')}>Recebidos ({recebidos.length})</button>
        <button className={btn(filtro === 'todos')} onClick={() => setFiltro('todos')}>Todos ({pedidos.length})</button>
        <input className="input" style={{ minWidth: 220, marginLeft: 'auto' }} placeholder="Buscar nº do pedido, fornecedor ou item…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!lista.length} onClick={exportar} title="Baixa a lista da tela (uma linha por item) em planilha CSV">Exportar planilha</button>
        <button className="btn btn--sm btn--primary" disabled={atualizando} onClick={atualizar} title="Relê os pedidos de compra no Omie. Só leitura.">{atualizando ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>
      <Card title="Pedidos de compra no Omie" sub={`${lista.length} pedido(s)`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>{th('numero', 'Pedido')}{th('fornecedor', 'Fornecedor')}{th('data', 'Pedido em')}{th('previsao', 'Previsão de chegada')}<th>Itens do PCP</th>{custo && th('valor', 'A receber', { textAlign: 'right' })}<th>Situação</th></tr></thead>
            <tbody>
              {lista.map(p => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td style={{ cursor: 'pointer' }} title="Clique para ver os itens" onClick={() => setAberto(aberto === p.id ? null : p.id)}><span style={{ color: 'var(--fg3)', marginRight: 4 }}>{aberto === p.id ? '▾' : '▸'}</span><b style={{ fontWeight: 500 }}>{p.numero}</b></td>
                    <td>{p.forCod ? p.nome : <span style={{ color: 'var(--fg3)', fontStyle: 'italic' }} title="O pedido ainda não tem fornecedor no Omie (provável rascunho).">fornecedor não definido</span>}{p.etapa ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="Etapa do pedido de compra no Omie">etapa Omie {p.etapa}</div> : null}</td>
                    <td>{pcData(p.data)}</td>
                    <td style={{ color: p.atrasado ? 'var(--vp-danger)' : undefined }}>{p.semPrevisao ? <span style={{ color: 'var(--fg3)' }} title="O Omie repetiu a data do pedido: ninguém informou o prazo de chegada.">não informada</span> : pcData(p.previsao)}{p.atrasado ? <div style={{ fontSize: 10 }}>atrasado há {p.diasAtraso} dia(s)</div> : null}</td>
                    <td style={{ fontSize: 12 }}>{p.linhas.length} · {p.linhas.slice(0, 3).map(l => l.codigo).join(', ')}{p.linhas.length > 3 ? ` +${p.linhas.length - 3}` : ''}</td>
                    {custo && <td style={{ textAlign: 'right' }}>{p.status === 'recebido' ? '—' : pcMoeda(p.emAberto)}{p.semPreco ? <div style={{ fontSize: 10, color: 'var(--vp-warning-ink, #b45309)' }} title="Há item sem preço no pedido do Omie; o valor mostrado está incompleto.">⚠ sem preço</div> : null}</td>}
                    <td><Badge variant={PC_ST_OMIE[p.status].v}>{PC_ST_OMIE[p.status].l}</Badge>{p.atrasado ? <> <Badge variant="danger">Atrasado</Badge></> : null}</td>
                  </tr>
                  {aberto === p.id && (
                    <tr><td colSpan={custo ? 7 : 6} style={{ background: 'var(--bg2, rgba(127,127,127,0.06))', padding: 12 }}>
                      <table className="t pcp-grid"><thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Pedido</th><th style={{ textAlign: 'right' }}>Recebido</th><th style={{ textAlign: 'right' }}>Falta chegar</th>{custo && <><th style={{ textAlign: 'right' }}>Valor unit.</th><th style={{ textAlign: 'right' }}>Total</th></>}</tr></thead>
                        <tbody>{p.linhas.map(l => (
                          <tr key={l.item_id}><td><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{d.desc[l.codigo] || ''}</div></td>
                            <td style={{ textAlign: 'right' }}>{pcFmt(l.quantidade)} {l.unidade || ''}</td><td style={{ textAlign: 'right' }}>{pcFmt(l.qtde_recebida)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(l.qtde_recebida) >= Number(l.quantidade) - 1e-9 ? '—' : pcFmt(Number(l.quantidade) - Number(l.qtde_recebida))}</td>
                            {custo && <><td style={{ textAlign: 'right' }}>{pcMoeda(l.valor_unitario)}</td><td style={{ textAlign: 'right' }}>{pcMoeda(l.valor_total)}</td></>}</tr>
                        ))}</tbody></table>
                      <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Mostra só os itens do PCP deste pedido; o pedido no Omie pode ter outros itens.</div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
              {lista.length === 0 && <tr><td colSpan={custo ? 7 : 6} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum pedido neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ 2) Requisições enviadas */
function PcRequisicoes() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('todas');
  const [busca, setBusca] = React.useState('');
  const { th, ordenar } = usePcOrdem();
  const carregar = React.useCallback(async () => {
    if (!sb) return;
    try {
      const [fila, compras] = await Promise.all([
        sb.from('pcp_omie_fila').select('id, status, solicitante_email, payload, resposta, erro, criado_em, enviado_em').eq('tipo', 'requisicao_compra').order('criado_em', { ascending: false }).limit(300),
        pcLerTudo(() => sb.from('pcp_compras_itens').select('codigo, numero_pedido, data_pedido').order('item_id')),
      ]);
      if (fila.error) throw fila.error;
      setD({ fila: fila.data || [], compras });
      setErro(null);
    } catch (e) { setErro(e.message || String(e)); }
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  usePcAtualizar(carregar);
  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const linhas = d.fila.map(r => {
    const itens = (r.payload && r.payload.meta && r.payload.meta.itens) || [];
    const dia = String(r.enviado_em || r.criado_em).slice(0, 10);
    const pedidos = {};                                              // item -> primeiro pedido de compra feito a partir do dia da requisição
    itens.forEach(i => { const c = d.compras.filter(x => x.codigo === i.codigo && x.data_pedido && x.data_pedido >= dia).sort((a, b) => a.data_pedido.localeCompare(b.data_pedido))[0]; if (c) pedidos[i.codigo] = c.numero_pedido; });
    const parada = r.status === 'enviado' && itens.length > 0 && itens.every(i => !pedidos[i.codigo]) && pcDiasUteis(dia, pcHojeBrasilia()) >= 3;
    return { ...r, itens, dia, pedidos, parada, diasParada: parada ? pcDiasUteis(dia, pcHojeBrasilia()) : 0, categoria: r.payload && r.payload.param && r.payload.param.codCateg, codOmie: r.resposta && r.resposta.codReqCompra };
  });
  const q = busca.trim().toLowerCase();
  const lista = ordenar(linhas.filter(r => (filtro === 'todas' || (filtro === 'enviadas' ? r.status === 'enviado' : filtro === 'paradas' ? r.parada : r.status === 'erro'))
    && (!q || (r.itens.map(i => i.codigo).join(' ') + ' ' + (r.solicitante_email || '')).toLowerCase().includes(q))),
    (r, col) => ({ data: r.criado_em, solicitante: r.solicitante_email || '', status: r.status }[col]));
  const nParadas = linhas.filter(r => r.parada).length, nEnv = linhas.filter(r => r.status === 'enviado').length, nErr = linhas.filter(r => r.status === 'erro').length;
  const exportar = () => {
    const rows = [];
    lista.forEach(r => r.itens.forEach(i => rows.push([pcData(r.dia), r.solicitante_email || '', i.codigo, String(i.quantidade).replace('.', ','), r.categoria || '', r.codOmie || '', r.status, r.pedidos[i.codigo] || '', r.erro || ''])));
    pcBaixar(`requisicoes-${pcHojeBrasilia()}.csv`, pcCsv([['Data', 'Solicitante', 'Item', 'Quantidade', 'Categoria', 'Nº da requisição no Omie', 'Situação', 'Pedido de compra (provável)', 'Erro'], ...rows]));
  };
  const btn = (a) => 'btn btn--sm' + (a ? ' btn--primary' : '');
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 8 }}>Requisições de compra que o PCP enviou ao Omie (botão "Enviar compra ao Omie" das abas Reposição e Necessidade). A requisição só vira pedido depois que o comprador a converte no Omie; a coluna "Pedido de compra" é uma <b>aproximação</b>: o primeiro pedido do mesmo item feito depois da requisição.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(filtro === 'todas')} onClick={() => setFiltro('todas')}>Todas ({linhas.length})</button>
        <button className={btn(filtro === 'enviadas')} onClick={() => setFiltro('enviadas')}>Enviadas ({nEnv})</button>
        <button className={btn(filtro === 'paradas')} onClick={() => setFiltro('paradas')} title="Enviadas ao Omie há 3+ dias úteis sem virar pedido de compra">Paradas ({nParadas})</button>
        <button className={btn(filtro === 'erro')} onClick={() => setFiltro('erro')}>Com erro ({nErr})</button>
        <input className="input" style={{ minWidth: 220, marginLeft: 'auto' }} placeholder="Buscar item ou solicitante…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!lista.length} onClick={exportar}>Exportar planilha</button>
        <button className="btn btn--sm" onClick={carregar}>Recarregar</button>
      </div>
      <Card title="Requisições enviadas ao Omie" sub={`${lista.length} requisição(ões)`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>{th('data', 'Data')}{th('solicitante', 'Solicitante')}<th>Itens</th><th>Categoria</th><th>Nº no Omie</th>{th('status', 'Situação')}<th>Pedido de compra</th></tr></thead>
            <tbody>
              {lista.map(r => (
                <tr key={r.id}>
                  <td>{pcData(r.dia)}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{pcDataHora(r.criado_em)}</div></td>
                  <td style={{ fontSize: 12 }}>{r.solicitante_email || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.itens.map(i => <div key={i.codigo}><b style={{ fontWeight: 500 }}>{i.codigo}</b> × {pcFmt(i.quantidade)}</div>)}</td>
                  <td style={{ fontSize: 12 }}>{r.categoria === '2.01.90' ? 'Nacional (2.01.90)' : r.categoria === '2.01.99' ? 'Importada (2.01.99)' : (r.categoria || '—')}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.codOmie || '—'}</td>
                  <td><Badge variant={r.status === 'enviado' ? 'success' : 'danger'}>{r.status === 'enviado' ? 'Enviada' : 'Erro'}</Badge>{r.parada ? <> <Badge variant="warning">Parada há {r.diasParada} dias úteis</Badge></> : null}{r.erro ? <div style={{ fontSize: 10, color: 'var(--vp-danger)', maxWidth: 220 }}>{r.erro}</div> : null}</td>
                  <td style={{ fontSize: 12 }}>{r.itens.some(i => r.pedidos[i.codigo]) ? r.itens.map(i => <div key={i.codigo}>{i.codigo}: {r.pedidos[i.codigo] ? <>Pedido {r.pedidos[i.codigo]} <span style={{ color: 'var(--fg3)' }}>(provável)</span></> : <span style={{ color: 'var(--fg3)' }}>ainda não virou pedido</span>}</div>) : <span style={{ color: 'var(--fg3)' }}>ainda não virou pedido</span>}</td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhuma requisição neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ 3) Pedidos internos (varejo) */
function PcModalNovoInterno({ onClose, onSaved, inicial, editando }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const ini = editando || inicial || null;                         // "pedir de novo" (inicial) ou editar um pendente (editando)
  const [prods, setProds] = React.useState([]);
  const [item, setItem] = React.useState(ini ? ini.item : '');
  const [produto, setProduto] = React.useState(ini && ini.codigo_produto ? { codigo: ini.codigo_produto, unidade: ini.unidade } : null);   // item escolhido no cadastro (null = texto livre)
  const [quantidade, setQuantidade] = React.useState(ini ? String(ini.quantidade) : '1');
  const [unidade, setUnidade] = React.useState(ini ? (ini.unidade || 'un') : 'un');
  const [valorEstimado, setValorEstimado] = React.useState(ini && ini.valor_estimado != null ? String(ini.valor_estimado) : '');
  const [urgencia, setUrgencia] = React.useState(ini ? (ini.urgencia || 'normal') : 'normal');
  const [justificativa, setJustificativa] = React.useState(ini ? (ini.justificativa || '') : '');
  const [saving, setSaving] = React.useState(false);
  const [dup, setDup] = React.useState(null);                      // aviso de duplicidade (pedido interno aberto / requisição recente)
  React.useEffect(() => {
    const chave = produto ? produto.codigo : item.trim();
    if (!chave || chave.length < 2) { setDup(null); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      window.PedidosVarejoStore.verificarDuplicidade({ codigoProduto: produto ? produto.codigo : null, item }).then(r => {
        if (!vivo) return;
        const internos = (r.internos || []).filter(x => !editando || x.numero_documento !== editando.numero_documento);
        setDup(internos.length || (r.requisicoes || []).length ? { internos, requisicoes: r.requisicoes || [] } : null);
      });
    }, 500);
    return () => { vivo = false; clearTimeout(t); };
  }, [produto, item, editando]);
  React.useEffect(() => { if (sb) pcLerTudo(() => sb.from('pcp_produtos').select('codigo, descricao, unidade').eq('ativo', true).order('codigo')).then(setProds).catch(() => {}); }, [sb]);
  const q = item.trim().toLowerCase();
  const sugestoes = !produto && q.length >= 2 ? prods.filter(p => (p.codigo + ' ' + (p.descricao || '')).toLowerCase().includes(q)).slice(0, 8) : [];
  const escolher = (p) => { setProduto(p); setItem(`${p.codigo} — ${p.descricao || ''}`.trim()); if (p.unidade) setUnidade(p.unidade); };
  const qtdOk = Number(quantidade) > 0, valOk = valorEstimado === '' || Number(valorEstimado) >= 0;
  const justObrig = Number(valorEstimado) >= PC_JUST_MIN && !justificativa.trim();
  const salvar = async () => {
    if (!item.trim()) return window.toast?.('Informe o item.', 'warning');
    if (!qtdOk) return window.toast?.('A quantidade precisa ser maior que zero.', 'warning');
    if (!valOk) return window.toast?.('O valor estimado não pode ser negativo.', 'warning');
    if (justObrig) return window.toast?.(`Pedido de ${pcMoeda(PC_JUST_MIN)} ou mais exige justificativa.`, 'warning');
    setSaving(true);
    try {
      const dados = { item, quantidade: Number(quantidade), unidade, valorEstimado, urgencia, justificativa, codigoProduto: produto ? produto.codigo : null };
      if (editando) { await window.PedidosVarejoStore.editarPedido(editando.id, dados); window.toast?.('Pedido atualizado; a decisão guarda o que mudou.', 'success'); }
      else { await window.PedidosVarejoStore.criarPedido(dados); window.toast?.('Pedido criado — aguardando aprovação da Logística.', 'success'); }
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={editando ? `Editar ${editando.numero_documento}` : inicial ? 'Novo pedido (refeito a partir de outro)' : 'Novo pedido interno de compra (varejo)'} onClose={onClose} width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Enviar pedido'}</Button></>}>
      <div className="stack" style={{ gap: 12 }}>
        {dup && (
          <div className="card" style={{ padding: 10, fontSize: 12, borderLeft: '3px solid var(--vp-yellow)' }}>
            <b style={{ fontWeight: 500 }}>⚠ Já existe algo parecido — confira antes de enviar:</b>
            {dup.internos.map(x => <div key={x.numero_documento}>Pedido interno <b style={{ fontWeight: 500 }}>{x.numero_documento}</b> ({PC_ST_INT[x.status]?.l || x.status}): {x.item} × {pcFmt(x.quantidade)} {x.unidade || ''}, criado em {pcData(x.criado_em)}</div>)}
            {dup.requisicoes.map((x, i) => <div key={i}>Requisição do PCP enviada ao Omie em {pcData(x.em)}{x.por ? ' por ' + x.por : ''}: × {pcFmt(x.quantidade)} (veja em "Requisições enviadas")</div>)}
          </div>
        )}
        <div className="stack" style={{ gap: 4, position: 'relative' }}>
          <label className="up-eyebrow muted">Item * <span style={{ textTransform: 'none', letterSpacing: 0 }}>(digite para buscar no cadastro ou escreva livremente)</span></label>
          <input className="input" value={item} onChange={(e) => { setItem(e.target.value); setProduto(null); }} placeholder="ex.: VPMP-303 ou Parafuso M8 inox…"/>
          {produto && <div style={{ fontSize: 11, color: 'var(--vp-success, #1a7f37)' }}>✓ Item do cadastro ({produto.codigo}) — unidade preenchida automaticamente.</div>}
          {sugestoes.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg1, #fff)', maxHeight: 200, overflow: 'auto' }}>
              {sugestoes.map(p => <div key={p.codigo} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }} onClick={() => escolher(p)}><b style={{ fontWeight: 500 }}>{p.codigo}</b> — {p.descricao} <span style={{ color: 'var(--fg3)' }}>({p.unidade || '—'})</span></div>)}
            </div>
          )}
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Quantidade *</label>
            <input className="input" type="number" min="0" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} style={!qtdOk ? { borderColor: 'var(--vp-danger)' } : undefined}/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Unidade</label>
            <input className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg, m…"/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Valor estimado (R$)</label>
            <input className="input" type="number" min="0" step="any" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="0,00" style={!valOk ? { borderColor: 'var(--vp-danger)' } : undefined}/>
          </div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Urgência</label>
          <select className="input" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>{Object.entries(PC_URG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Justificativa{Number(valorEstimado) >= PC_JUST_MIN ? ' *' : ''} <span style={{ textTransform: 'none', letterSpacing: 0 }}>{Number(valorEstimado) >= PC_JUST_MIN ? `(obrigatória a partir de ${pcMoeda(PC_JUST_MIN)})` : ''}</span></label>
          <textarea className="input" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que esse item é necessário…" style={justObrig ? { borderColor: 'var(--vp-danger)' } : undefined}/>
        </div>
      </div>
    </Modal>
  );
}

function PcModalCancelar({ pedido, onClose, onFeito }) {
  const [motivo, setMotivo] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const ok = async () => {
    setBusy(true);
    try { await window.PedidosVarejoStore.cancelarPedido(pedido.id, motivo); window.toast?.('Pedido cancelado.', 'success'); onFeito(); onClose(); }
    catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`Cancelar ${pedido.numero_documento}`} onClose={onClose} width={440}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button variant="primary" onClick={ok} disabled={busy || !motivo.trim()}>{busy ? 'Cancelando…' : 'Cancelar pedido'}</Button></>}>
      <div className="stack" style={{ gap: 8 }}>
        <div style={{ fontSize: 13 }}>{pedido.item} — {pcFmt(pedido.quantidade)} {pedido.unidade || ''}</div>
        <label className="up-eyebrow muted">Motivo *</label>
        <textarea className="input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que o pedido está sendo cancelado…"/>
        <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Se a aprovação ainda estiver pendente, ela também é cancelada.</div>
      </div>
    </Modal>
  );
}

function PcModalComprado({ pedido, onClose, onFeito }) {
  const [omie, setOmie] = React.useState('');
  const [forn, setForn] = React.useState('');
  const [valor, setValor] = React.useState(pedido.valor_estimado != null ? String(pedido.valor_estimado) : '');
  const [dia, setDia] = React.useState(pcHojeBrasilia());
  const [busy, setBusy] = React.useState(false);
  const [conf, setConf] = React.useState(null);         // resultado da conferência do nº do Omie
  const conferir = async () => { if (!omie.trim()) { setConf(null); return; } try { setConf(await window.PedidosVarejoStore.conferirPedidoOmie(omie)); } catch (e) { setConf(null); } };
  const ok = async () => {
    setBusy(true);
    try { await window.PedidosVarejoStore.marcarComprado(pedido.id, { omiePedido: omie, fornecedor: forn, valorReal: valor, dataCompra: dia }); window.toast?.('Marcado como comprado.', 'success'); onFeito(); onClose(); }
    catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`Registrar compra — ${pedido.numero_documento}`} onClose={onClose} width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button variant="primary" onClick={ok} disabled={busy || (!omie.trim() && !forn.trim())}>{busy ? 'Salvando…' : 'Marcar como comprado'}</Button></>}>
      <div className="stack" style={{ gap: 10 }}>
        <div style={{ fontSize: 13 }}>{pedido.item} — {pcFmt(pedido.quantidade)} {pedido.unidade || ''}</div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Nº do pedido no Omie</label><input className="input" value={omie} onChange={(e) => { setOmie(e.target.value); setConf(null); }} onBlur={conferir} placeholder="ex.: 2177"/></div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Fornecedor</label><input className="input" value={forn} onChange={(e) => setForn(e.target.value)}/></div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Valor real (R$)</label><input className="input" type="number" min="0" step="any" value={valor} onChange={(e) => setValor(e.target.value)}/></div>
          <div className="stack" style={{ gap: 4 }}><label className="up-eyebrow muted">Data da compra</label><input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)}/></div>
        </div>
        {conf && (conf.achado
          ? <div style={{ fontSize: 12, color: 'var(--vp-success, #1a7f37)' }}>✓ Pedido {conf.numero} encontrado no Omie ({pcData(conf.data)}{conf.fornecedor ? ' · ' + conf.fornecedor : ''}; itens: {Array.from(new Set(conf.itens)).slice(0, 4).join(', ')}).{!forn.trim() && conf.fornecedor ? <> <button className="btn btn--sm" onClick={() => setForn(conf.fornecedor)}>Usar este fornecedor</button></> : null}</div>
          : <div style={{ fontSize: 12, color: 'var(--vp-warning-ink, #b45309)' }}>⚠ Pedido {conf.numero} não está entre os pedidos de compra já lidos do Omie (a leitura roda 2 vezes por dia e só traz itens do PCP). Pode gravar mesmo assim.</div>)}
        <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Informe pelo menos o nº do pedido no Omie ou o fornecedor.</div>
      </div>
    </Modal>
  );
}

function PcInternos({ pedidos, reload }) {
  const [filtro, setFiltro] = React.useState('abertos');
  const [busca, setBusca] = React.useState('');
  const [aberto, setAberto] = React.useState(null);
  const [modalNovo, setModalNovo] = React.useState(null);     // null | { inicial?, editando? }
  const [ctxItem, setCtxItem] = React.useState({});           // contexto de estoque do item de cada pedido aberto (carregado ao expandir)
  const [cancelando, setCancelando] = React.useState(null);
  const [comprando, setComprando] = React.useState(null);
  const [podeCanc, setPodeCanc] = React.useState({});
  const { th, ordenar } = usePcOrdem();
  React.useEffect(() => {
    let vivo = true;
    Promise.all(pedidos.filter(p => ['pendente', 'aprovado'].includes(p.status)).map(async p => [p.id, await window.PedidosVarejoStore.podeCancelar(p)]))
      .then(r => { if (vivo) setPodeCanc(Object.fromEntries(r)); });
    return () => { vivo = false; };
  }, [pedidos]);
  const pend = pedidos.filter(p => p.status === 'pendente'), apr = pedidos.filter(p => p.status === 'aprovado');
  const hoje = pcHojeBrasilia();
  const meu = String((window.__VP_USER && window.__VP_USER.email) || '').toLowerCase();
  const parado = (p) => {                                       // dias úteis parado: pendente há 2+, aprovado sem compra há 3+
    if (p.status === 'pendente' && p.criado_em) { const d = pcDiasUteis(String(p.criado_em).slice(0, 10), hoje); return d >= 2 ? d : 0; }
    if (p.status === 'aprovado') { const base = p.decidido_em || p.atualizado_em || p.criado_em; const d = base ? pcDiasUteis(String(base).slice(0, 10), hoje) : 0; return d >= 3 ? d : 0; }
    return 0;
  };
  const somaEst = (l) => l.reduce((s, p) => s + (Number(p.valor_estimado) || 0), 0);
  const emAbertoValor = somaEst([...pend, ...apr]);
  const comReal = pedidos.filter(p => p.status === 'comprado' && p.comprado_valor != null && Number(p.valor_estimado) > 0);
  const variacaoMedia = comReal.length ? (comReal.reduce((s, p) => s + Number(p.comprado_valor), 0) / comReal.reduce((s, p) => s + Number(p.valor_estimado), 0) - 1) * 100 : null;
  // Contexto para decidir: saldo, reservado e a caminho do item do cadastro (carregado quando a linha é aberta).
  React.useEffect(() => {
    const p = pedidos.find(x => x.id === aberto);
    if (!p || !p.codigo_produto || ctxItem[p.id]) return;
    const sb = window.__VP_SB && window.__VP_SB.sb; if (!sb) return;
    Promise.all([
      sb.from('pcp_estoque').select('quantidade').eq('codigo', p.codigo_produto),
      sb.from('pcp_posicao_compra').select('reservado, pendente').eq('codigo', p.codigo_produto).maybeSingle(),
      sb.from('pcp_compras_itens').select('numero_pedido, quantidade, qtde_recebida, data_previsao, data_pedido').eq('codigo', p.codigo_produto),
    ]).then(([e, po, c]) => {
      const caminho = (c.data || []).filter(x => Number(x.quantidade) - Number(x.qtde_recebida) > 1e-9);
      setCtxItem(m => ({ ...m, [p.id]: { saldo: (e.data || []).reduce((s, x) => s + Number(x.quantidade || 0), 0), temSaldo: (e.data || []).length > 0, reservado: po.data ? Number(po.data.reservado || 0) : null,
        caminho: caminho.reduce((s, x) => s + Number(x.quantidade) - Number(x.qtde_recebida), 0), pedidos: caminho.map(x => x.numero_pedido) } }));
    }).catch(() => setCtxItem(m => ({ ...m, [p.id]: { erro: true } })));
  }, [aberto, pedidos]);
  const q = busca.trim().toLowerCase();
  const base = filtro === 'abertos' ? pedidos.filter(p => p.status === 'pendente' || p.status === 'aprovado') : filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro);
  const lista = ordenar(base.filter(p => !q || (p.numero_documento + ' ' + p.item + ' ' + (p.solicitante_nome || '')).toLowerCase().includes(q)),
    (p, col) => ({ numero: p.numero_documento, item: p.item, valor: Number(p.valor_estimado) || 0, urgencia: ['baixa', 'normal', 'alta', 'critica'].indexOf(p.urgencia), data: p.criado_em || '' }[col]));
  const exportar = () => {
    const n = (v) => v == null ? '' : Number(v).toFixed(2).replace('.', ',');
    pcBaixar(`pedidos-internos-${pcHojeBrasilia()}.csv`, pcCsv([['Nº', 'Criado em', 'Item', 'Quantidade', 'Unidade', 'Valor estimado', 'Urgência', 'Solicitante', 'Situação', 'Justificativa', 'Motivo (reprovação/cancelamento)', 'Pedido no Omie', 'Fornecedor', 'Valor real'],
      ...lista.map(p => [p.numero_documento, pcData(p.criado_em), p.item, String(p.quantidade).replace('.', ','), p.unidade || '', n(p.valor_estimado), PC_URG[p.urgencia] || p.urgencia, p.solicitante_nome || '', PC_ST_INT[p.status]?.l || p.status, p.justificativa || '', p.cancelado_motivo || p.motivo || '', p.comprado_omie_pedido || '', p.comprado_fornecedor || '', n(p.comprado_valor)])]));
  };
  const btn = (a) => 'btn btn--sm' + (a ? ' btn--primary' : '');
  return (
    <div>
      {modalNovo && <PcModalNovoInterno inicial={modalNovo.inicial} editando={modalNovo.editando} onClose={() => setModalNovo(null)} onSaved={reload}/>}
      {cancelando && <PcModalCancelar pedido={cancelando} onClose={() => setCancelando(null)} onFeito={reload}/>}
      {comprando && <PcModalComprado pedido={comprando} onClose={() => setComprando(null)} onFeito={reload}/>}
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Aguardando Logística</div><div className="pcp-total__v">{pend.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{pend.filter(p => parado(p)).length ? `${pend.filter(p => parado(p)).length} parado(s) há 2+ dias úteis` : 'decisão pendente'}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Aprovados, aguardando compra</div><div className="pcp-total__v">{apr.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{apr.filter(p => parado(p)).length ? `${apr.filter(p => parado(p)).length} sem compra há 3+ dias úteis` : 'liberados'}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Valor em aberto (estimado)</div><div className="pcp-total__v">{pcMoeda(emAbertoValor)}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>pendentes {pcMoeda(somaEst(pend))} · aprovados {pcMoeda(somaEst(apr))}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Estimado × real</div><div className="pcp-total__v" style={{ color: variacaoMedia != null && Math.abs(variacaoMedia) > 20 ? 'var(--vp-danger)' : undefined }}>{variacaoMedia == null ? '—' : (variacaoMedia > 0 ? '+' : '') + pcFmt(variacaoMedia, 1) + '%'}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{comReal.length ? `em ${comReal.length} compra(s) com valor real` : 'sem compra com valor real ainda'}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(filtro === 'abertos')} onClick={() => setFiltro('abertos')}>Em aberto ({pend.length + apr.length})</button>
        {['pendente', 'aprovado', 'comprado', 'reprovado', 'cancelado'].map(s => <button key={s} className={btn(filtro === s)} onClick={() => setFiltro(s)}>{PC_ST_INT[s].l} ({pedidos.filter(p => p.status === s).length})</button>)}
        <button className={btn(filtro === 'todos')} onClick={() => setFiltro('todos')}>Todos ({pedidos.length})</button>
        <input className="input" style={{ minWidth: 200, marginLeft: 'auto' }} placeholder="Buscar nº, item ou solicitante…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!lista.length} onClick={exportar}>Exportar planilha</button>
        <button className="btn btn--sm btn--primary" onClick={() => setModalNovo({})}>+ Novo pedido interno</button>
      </div>
      <Card title="Pedidos internos de varejo" sub={`${lista.length} pedido(s) · exigem aprovação do Chefe de Logística`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>{th('numero', 'Nº')}{th('item', 'Item')}<th>Qtd</th>{th('valor', 'Valor est.', { textAlign: 'right' })}{th('urgencia', 'Urgência')}<th>Solicitante</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {lista.map(p => {
                const st = PC_ST_INT[p.status] || { l: p.status, v: 'neutral' };
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td className="mono" style={{ cursor: 'pointer' }} title="Clique para ver os detalhes" onClick={() => setAberto(aberto === p.id ? null : p.id)}><span style={{ color: 'var(--fg3)', marginRight: 4 }}>{aberto === p.id ? '▾' : '▸'}</span>{p.numero_documento}</td>
                      <td>{p.item}</td>
                      <td>{pcFmt(p.quantidade)} {p.unidade || ''}</td>
                      <td style={{ textAlign: 'right' }}>{pcMoeda(p.valor_estimado)}{p.status === 'comprado' && p.comprado_valor != null && Number(p.valor_estimado) > 0 ? (() => { const v = (Number(p.comprado_valor) / Number(p.valor_estimado) - 1) * 100; return <div style={{ fontSize: 10, color: Math.abs(v) > 20 ? 'var(--vp-danger)' : 'var(--fg3)' }} title="Valor real da compra comparado com o estimado">real {pcMoeda(p.comprado_valor)} ({v > 0 ? '+' : ''}{pcFmt(v, 0)}%)</div>; })() : null}</td>
                      <td><Badge variant={p.urgencia === 'critica' ? 'danger' : p.urgencia === 'alta' ? 'warning' : 'neutral'}>{PC_URG[p.urgencia] || p.urgencia}</Badge></td>
                      <td style={{ fontSize: 12 }}>{p.solicitante_nome || '—'}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{pcData(p.criado_em)}</div></td>
                      <td><Badge variant={st.v}>{st.l}</Badge>{parado(p) ? <> <Badge variant="warning">parado há {parado(p)} dias úteis</Badge></> : null}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.status === 'pendente' && String(p.solicitante_email || '').toLowerCase() === meu && <><button className="btn btn--sm" onClick={() => setModalNovo({ editando: p })}>Editar</button> </>}
                        {['reprovado', 'cancelado'].includes(p.status) && <><button className="btn btn--sm" title="Abre um pedido novo já preenchido com estes dados" onClick={() => setModalNovo({ inicial: p })}>Pedir de novo</button> </>}
                        {p.status === 'aprovado' && <button className="btn btn--sm btn--primary" onClick={() => setComprando(p)}>Marcar comprado</button>}
                        {podeCanc[p.id] && <> <button className="btn btn--sm" onClick={() => setCancelando(p)}>Cancelar</button></>}
                      </td>
                    </tr>
                    {aberto === p.id && (
                      <tr><td colSpan={8} style={{ background: 'var(--bg2, rgba(127,127,127,0.06))', padding: 12, fontSize: 12, lineHeight: 1.7 }}>
                        <div><b style={{ fontWeight: 500 }}>Justificativa:</b> {p.justificativa || '—'}</div>
                        {p.codigo_produto && <div><b style={{ fontWeight: 500 }}>Item do cadastro:</b> {p.codigo_produto}
                          {(() => { const c = ctxItem[p.id]; if (!c) return <span style={{ color: 'var(--fg3)' }}> · carregando saldo…</span>; if (c.erro) return null;
                            return <span> · saldo {c.temSaldo ? pcFmt(c.saldo) : '—'}{c.reservado != null ? ` · reservado ${pcFmt(c.reservado)}` : ''} · a caminho {c.caminho ? pcFmt(c.caminho) + ' (pedido ' + Array.from(new Set(c.pedidos)).join(', ') + ')' : '—'}</span>; })()}</div>}
                        {(p.decisao_edicoes || []).length > 0 && <div style={{ color: 'var(--fg3)' }}>Editado {p.decisao_edicoes.length}x depois de enviado.</div>}
                        {p.decidido_por && <div><b style={{ fontWeight: 500 }}>Decisão:</b> {p.status === 'reprovado' ? 'reprovado' : 'aprovado'} por {p.decidido_por}{p.decidido_em ? ' em ' + pcDataHora(p.decidido_em) : ''}{p.motivo ? ` — ${p.motivo}` : ''}</div>}
                        {p.status === 'comprado' && <div><b style={{ fontWeight: 500 }}>Compra:</b> {pcData(p.comprado_em)} por {p.comprado_por || '—'}{p.comprado_omie_pedido ? <> · pedido <button className="pcp-cod" title="Abre Compras no Omie já buscando este pedido" onClick={() => { try { sessionStorage.setItem('vp_pc_busca', String(p.comprado_omie_pedido)); } catch (e) { /* ok */ } window.pcpIrParaUrl && window.pcpIrParaUrl('/logistica/almoxarifado/pedidos/omie'); }}>{p.comprado_omie_pedido}</button> no Omie</> : null}{p.comprado_fornecedor ? ` · ${p.comprado_fornecedor}` : ''}{p.comprado_valor != null ? ` · ${pcMoeda(p.comprado_valor)}` : ''}</div>}
                        {p.status === 'cancelado' && <div><b style={{ fontWeight: 500 }}>Cancelado</b>{p.cancelado_por ? ` por ${p.cancelado_por}` : ''}{p.cancelado_em ? ' em ' + pcDataHora(p.cancelado_em) : ''}: {p.cancelado_motivo || '—'}</div>}
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--fg3)' }}>{pedidos.length === 0 ? 'Nenhum pedido interno ainda. Use "+ Novo pedido interno" para pedir um insumo ou peça (passa pela aprovação do Chefe de Logística).' : 'Nenhum pedido neste filtro.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ container */
function AlmoxarifadoPedidos() {
  const [sub, setSub] = window.useRotaItem('almoxarifado', 'pedidos');
  const [pedidos, setPedidos] = React.useState(null);
  const reload = React.useCallback(() => { window.PedidosVarejoStore.listarPedidos().then(setPedidos).catch(() => setPedidos([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);
  usePcAtualizar(reload);
  if (pedidos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;
  const abertosInt = pedidos.filter(p => p.status === 'pendente' || p.status === 'aprovado').length;
  const ativa = ['omie', 'requisicoes', 'internos'].includes(sub) ? sub : (abertosInt > 0 ? 'internos' : 'omie');
  const btn = (id) => 'btn btn--sm' + (ativa === id ? ' btn--primary' : '');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={btn('omie')} onClick={() => setSub('omie')}>Compras no Omie</button>
        <button className={btn('requisicoes')} onClick={() => setSub('requisicoes')}>Requisições enviadas</button>
        <button className={btn('internos')} onClick={() => setSub('internos')}>Pedidos internos (varejo){abertosInt ? ` (${abertosInt})` : ''}</button>
      </div>
      {ativa === 'omie' && <PcComprasOmie/>}
      {ativa === 'requisicoes' && <PcRequisicoes/>}
      {ativa === 'internos' && <PcInternos pedidos={pedidos} reload={reload}/>}
    </div>
  );
}

Object.assign(window, { AlmoxarifadoPedidos });
