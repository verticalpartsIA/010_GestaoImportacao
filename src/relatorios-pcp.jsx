/* ============================================================
   relatorios-pcp.jsx — Logística Interna · Relatórios do PCP.
   1ª entrega (somente leitura, dados já existentes):
     · Produção — planejado (pcp_plano) × realizado (OPs concluídas), mês a mês, por produto.
     · Perdas — produzido × perdido por produto e causas mais comuns (pcp_ordens).
     · Estoque — saldo × mínimo (pcp_estoque / pcp_produtos), matéria-prima e produtos.
   Próximas: Pedidos e Clientes (pedidos de venda do Omie), Lista de Preços e Fluxo de Caixa (custos).
   ============================================================ */

const RP_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function rpFmt(v, d = 1) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function rpPct(v) { return v == null || !isFinite(v) ? '—' : rpFmt(v, 1) + '%'; }

/* ---------------- Produção ---------------- */
function RPProducao({ ctx }) {
  const { sb, produtos } = ctx;
  const [ano, setAno] = React.useState(new Date().getFullYear());
  const [produto, setProduto] = React.useState('');         // '' = todos
  const [dados, setDados] = React.useState(null);           // { plano: [...], ordens: [...] }

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const [p, o] = await Promise.all([
        sb.from('pcp_plano').select('produto, mes, quantidade').eq('ano', ano).limit(5000),
        sb.from('pcp_ordens').select('produto, qtd_produzida, data_finalizacao').eq('status', 'concluida').not('produto', 'is', null).limit(5000),
      ]);
      if (!vivo) return;
      setDados({ plano: p.data || [], ordens: (o.data || []).filter(x => x.data_finalizacao && Number(x.data_finalizacao.slice(0, 4)) === ano) });
    })();
    return () => { vivo = false; };
  }, [sb, ano]);

  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const plano = Array(12).fill(0), real = Array(12).fill(0);
  dados.plano.filter(l => !produto || l.produto === produto).forEach(l => { plano[l.mes - 1] += Number(l.quantidade); });
  dados.ordens.filter(l => !produto || l.produto === produto).forEach(l => { real[Number(l.data_finalizacao.slice(5, 7)) - 1] += Number(l.qtd_produzida || 0); });
  const totP = plano.reduce((a, b) => a + b, 0), totR = real.reduce((a, b) => a + b, 0);
  const opcoes = Array.from(new Set([...dados.plano.map(l => l.produto), ...dados.ordens.map(l => l.produto)])).sort();

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
        <select className="input" value={produto} onChange={e => setProduto(e.target.value)} style={{ minWidth: 300 }}>
          <option value="">Todos os produtos</option>
          {opcoes.map(c => <option key={c} value={c}>{c} — {produtos[c]?.descricao || ''}</option>)}
        </select>
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Mês</th><th className="text-right">Planejado (meta)</th><th className="text-right">Produzido (real)</th><th className="text-right">Diferença</th><th className="text-right">Eficiência</th></tr></thead>
          <tbody>
            {RP_MESES.map((m, i) => {
              const dif = real[i] - plano[i];
              return (
                <tr key={m}>
                  <td>{m}</td>
                  <td className="text-right">{plano[i] ? rpFmt(plano[i], 0) : '—'}</td>
                  <td className="text-right">{real[i] ? rpFmt(real[i], 0) : '—'}</td>
                  <td className="text-right" style={plano[i] || real[i] ? { color: dif < 0 ? 'var(--vp-danger)' : undefined } : { color: 'var(--fg3)' }}>{plano[i] || real[i] ? (dif > 0 ? '+' : '') + rpFmt(dif, 0) : '—'}</td>
                  <td className="text-right">{plano[i] ? rpPct((real[i] / plano[i]) * 100) : '—'}</td>
                </tr>
              );
            })}
            <tr>
              <td><b style={{ fontWeight: 500 }}>Total {ano}</b></td>
              <td className="text-right"><b style={{ fontWeight: 500 }}>{rpFmt(totP, 0)}</b></td>
              <td className="text-right"><b style={{ fontWeight: 500 }}>{rpFmt(totR, 0)}</b></td>
              <td className="text-right"><b style={{ fontWeight: 500 }}>{(totR - totP > 0 ? '+' : '') + rpFmt(totR - totP, 0)}</b></td>
              <td className="text-right"><b style={{ fontWeight: 500 }}>{totP ? rpPct((totR / totP) * 100) : '—'}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Planejado vem do Planejamento do PCP; produzido é a quantidade das OPs concluídas, no mês da finalização. Eficiência = produzido ÷ planejado.
      </div>
    </div>
  );
}

/* ---------------- Perdas ---------------- */
function RPPerdas({ ctx }) {
  const { sb, produtos } = ctx;
  const [ano, setAno] = React.useState(new Date().getFullYear());
  const [ordens, setOrdens] = React.useState(null);

  React.useEffect(() => {
    let vivo = true;
    sb.from('pcp_ordens').select('id, numero, produto, qtd_produzida, qtd_perdida, causa_perda, acao_corretiva, data_finalizacao').eq('status', 'concluida').not('produto', 'is', null).limit(5000)
      .then(({ data }) => { if (vivo) setOrdens((data || []).filter(x => x.data_finalizacao && Number(x.data_finalizacao.slice(0, 4)) === ano)); });
    return () => { vivo = false; };
  }, [sb, ano]);

  if (!ordens) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const porProduto = {}, causas = {};
  ordens.forEach(o => {
    const p = (porProduto[o.produto] = porProduto[o.produto] || { boa: 0, perdida: 0, ops: 0 });
    p.boa += Number(o.qtd_produzida || 0); p.perdida += Number(o.qtd_perdida || 0); p.ops++;
    if (Number(o.qtd_perdida) > 0) { const c = (o.causa_perda || 'Não informada').trim(); causas[c] = (causas[c] || 0) + Number(o.qtd_perdida); }
  });
  const linhas = Object.keys(porProduto).sort();
  const tot = linhas.reduce((s, c) => ({ boa: s.boa + porProduto[c].boa, perdida: s.perdida + porProduto[c].perdida }), { boa: 0, perdida: 0 });
  const causasOrd = Object.keys(causas).sort((a, b) => causas[b] - causas[a]);

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
      </div>
      <RPPainelPerdas ctx={ctx} ano={ano} ordens={ordens}/>
      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Detalhe por produto</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table className="t pcp-grid">
          <thead><tr><th>Produto</th><th className="text-right">OPs</th><th className="text-right">Produção total</th><th className="text-right">Aproveitado</th><th className="text-right">Perdas</th><th className="text-right">% de perda</th></tr></thead>
          <tbody>
            {linhas.map(c => {
              const p = porProduto[c], total = p.boa + p.perdida;
              const pct = total ? (p.perdida / total) * 100 : null;
              return (
                <tr key={c}>
                  <td style={{ minWidth: 240 }}><b style={{ fontWeight: 500 }}>{c}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{produtos[c]?.descricao || ''}</div></td>
                  <td className="text-right">{p.ops}</td>
                  <td className="text-right">{rpFmt(total, 0)}</td>
                  <td className="text-right">{rpFmt(p.boa, 0)}</td>
                  <td className="text-right" style={p.perdida > 0 ? { color: 'var(--vp-danger)', fontWeight: 500 } : undefined}>{rpFmt(p.perdida, 0)}</td>
                  <td className="text-right">{rpPct(pct)}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhuma OP concluída em {ano}.</td></tr>}
            {linhas.length > 0 && (
              <tr>
                <td><b style={{ fontWeight: 500 }}>Total</b></td><td></td>
                <td className="text-right"><b style={{ fontWeight: 500 }}>{rpFmt(tot.boa + tot.perdida, 0)}</b></td>
                <td className="text-right"><b style={{ fontWeight: 500 }}>{rpFmt(tot.boa, 0)}</b></td>
                <td className="text-right"><b style={{ fontWeight: 500 }}>{rpFmt(tot.perdida, 0)}</b></td>
                <td className="text-right"><b style={{ fontWeight: 500 }}>{rpPct(tot.boa + tot.perdida ? (tot.perdida / (tot.boa + tot.perdida)) * 100 : null)}</b></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {causasOrd.length > 0 && (<>
        <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Causas mais comuns</h3>
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Causa</th><th className="text-right">Unidades perdidas</th><th className="text-right">% das perdas</th></tr></thead>
            <tbody>
              {causasOrd.map(c => <tr key={c}><td>{c}</td><td className="text-right">{rpFmt(causas[c], 0)}</td><td className="text-right">{rpPct((causas[c] / tot.perdida) * 100)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </>)}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Perdas e causas são lançadas ao concluir cada OP. Produção total = aproveitado + perdas. Quanto mais próximo de 0%, melhor.
      </div>
    </div>
  );
}

/* ---------------- Estoque ---------------- */
// Crítico: abaixo do mínimo · Alerta: até 50% acima do mínimo · Confortável: acima · Sem mínimo: não configurado.
function rpStatusEstoque(atual, minimo) {
  if (!(minimo > 0)) return 'Sem mínimo';
  if (atual < minimo) return 'Crítico';
  if (atual < minimo * 1.5) return 'Alerta';
  return 'Confortável';
}
const RP_ORDEM_STATUS = { 'Crítico': 0, 'Alerta': 1, 'Confortável': 2, 'Sem mínimo': 3 };

function RPEstoque({ ctx }) {
  const { sb, nav } = ctx;
  const [grupo, setGrupo] = React.useState('mp');             // 'mp' | 'produtos'
  const [linhas, setLinhas] = React.useState(null);
  const [filtro, setFiltro] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    setLinhas(null);
    let q = sb.from('pcp_produtos').select('codigo, descricao, unidade, estoque_minimo, tipo_sped, pcp_estoque(quantidade)').eq('ativo', true).order('codigo').limit(2000);
    q = grupo === 'mp' ? q.eq('tipo_sped', '01') : q.neq('tipo_sped', '01');
    q.then(({ data }) => { if (vivo) setLinhas(data || []); });
    return () => { vivo = false; };
  }, [sb, grupo]);

  const dados = React.useMemo(() => (linhas || []).map(l => {
    const atual = (l.pcp_estoque || []).reduce((s, e) => s + Number(e.quantidade || 0), 0);
    const minimo = Number(l.estoque_minimo || 0);
    return { ...l, atual, minimo, status: rpStatusEstoque(atual, minimo) };
  }).sort((a, b) => RP_ORDEM_STATUS[a.status] - RP_ORDEM_STATUS[b.status] || a.codigo.localeCompare(b.codigo)), [linhas]);

  if (!linhas) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const conta = (s) => dados.filter(d => d.status === s).length;
  const visiveis = dados.filter(d => !filtro || d.status === filtro);
  const cor = { 'Crítico': 'color-mix(in srgb, var(--vp-danger, #c0392b) 25%, transparent)', 'Alerta': 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', 'Confortável': 'color-mix(in srgb, #2e9e5b 22%, transparent)' };
  const kpi = (rot, n, st) => (
    <button className="card pcp-total" onClick={() => setFiltro(f => f === st ? '' : st)} style={{ padding: 14, flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', outline: filtro === st ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{n}</div>
    </button>
  );

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (grupo === 'mp' ? ' btn--primary' : '')} onClick={() => { setGrupo('mp'); setFiltro(''); }}>Matéria-prima</button>
        <button className={'btn btn--sm' + (grupo === 'produtos' ? ' btn--primary' : '')} onClick={() => { setGrupo('produtos'); setFiltro(''); }}>Produtos</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('Crítico (abaixo do mínimo)', conta('Crítico'), 'Crítico')}
        {kpi('Alerta (até 50% acima do mínimo)', conta('Alerta'), 'Alerta')}
        {kpi('Confortável', conta('Confortável'), 'Confortável')}
        {kpi('Sem mínimo definido', conta('Sem mínimo'), 'Sem mínimo')}
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="text-right">Estoque atual</th><th className="text-right">Estoque mínimo</th><th className="text-right">Falta p/ mínimo</th><th>Status</th></tr></thead>
          <tbody>
            {visiveis.map(d => (
              <tr key={d.codigo}>
                <td><button className="pcp-cod" title="Abrir no cadastro" onClick={() => window.pcpIrPara?.(nav, grupo === 'mp' ? 'cadastro-materias-primas' : 'cadastro-produtos', 'vp_pcp_busca', d.codigo)}>{d.codigo}</button></td>
                <td>{d.descricao}</td>
                <td>{d.unidade || '—'}</td>
                <td className="text-right">{rpFmt(d.atual, 2)}</td>
                <td className="text-right">{d.minimo ? rpFmt(d.minimo, 2) : '—'}</td>
                <td className="text-right" style={d.status === 'Crítico' ? { color: 'var(--vp-danger)', fontWeight: 500 } : { color: 'var(--fg3)' }}>{d.status === 'Crítico' ? rpFmt(d.minimo - d.atual, 2) : '—'}</td>
                <td><span className="pcp-tag" style={cor[d.status] ? { background: cor[d.status] } : undefined}>{d.status}</span></td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum item.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Saldo sincronizado do Omie (4x por dia); o mínimo vem do cadastro do produto. Entradas e saídas do período entram quando sincronizarmos os movimentos de estoque do Omie.
      </div>
    </div>
  );
}

/* ---------------- Pedidos / Clientes (pedidos de VENDA do Omie, só itens do PCP) ---------------- */
const RP_ETAPA = { '00': 'Proposta', '10': 'Pedido de Venda', '20': 'Separar estoque / produção', '50': 'Faturar', '60': 'Faturado', '70': 'Entrega', '80': 'Concluído (etapa 80)' };
function rpMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function rpDataBr(d) { return d ? d.split('-').reverse().join('/') : '—'; }
function rpEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Busca pedidos no Omie (leitura) e grava no cache do PCP. Devolve { ok, erro? }.
async function rpAtualizarDoOmie(sb, corpo) {
  try {
    const { data, error } = await sb.functions.invoke('sync-pcp-pedidos', { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.error || msg; } catch (e) { /* mantém */ }
      return { ok: false, erro: msg };
    }
    return { ok: data && data.ok !== false, dados: data, erro: data && data.erros && data.erros[0] };
  } catch (e) { return { ok: false, erro: e.message }; }
}

function RPPedidos({ ctx }) {
  const { sb, nav } = ctx;
  const perm = useRPPermissoes();
  const custos = useRPCustos(sb, perm.custo);            // null sem alçada de custo (nem consulta)
  const [numero, setNumero] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [aviso, setAviso] = React.useState(null);
  const [pedidos, setPedidos] = React.useState(null);        // registros do número consultado
  const [recentes, setRecentes] = React.useState([]);

  const carregarRecentes = React.useCallback(async () => {
    const { data } = await sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, cliente_nome, data_pedido, etapa, valor_total').order('data_pedido', { ascending: false }).limit(40);
    setRecentes(data || []);
  }, [sb]);
  React.useEffect(() => { carregarRecentes(); }, [carregarRecentes]);

  const ler = async (n) => {
    const { data: ps } = await sb.from('pcp_pedidos').select('*').eq('numero_pedido', n).order('data_pedido', { ascending: false });
    if (!ps || !ps.length) return [];
    const { data: its } = await sb.from('pcp_pedido_itens').select('*').eq('item_pcp', true).in('codigo_pedido', ps.map(p => p.codigo_pedido)).order('seq');
    return ps.map(p => ({ ...p, itens: (its || []).filter(i => i.codigo_pedido === p.codigo_pedido) }));
  };
  const buscar = async (n0, forcar) => {
    const n = String(n0 ?? numero).replace(/\D/g, '');
    if (!n) return;
    setBusy(true); setAviso(null);
    let r = forcar ? [] : await ler(n);
    if (!r.length) {
      const res = await rpAtualizarDoOmie(sb, { numeros: [n] });
      if (!res.ok) setAviso('Não foi possível consultar o Omie: ' + (res.erro || 'erro desconhecido'));
      r = await ler(n);
      await carregarRecentes();
    }
    if (!r.length && !aviso) setAviso(`Nenhum item de quadro de comando, corrimão ou cabo no pedido ${n} (ou o pedido não existe no Omie).`);
    setPedidos(r); setBusy(false);
  };
  const imprimir = (p) => {
    const w = window.open('', '_blank');
    if (!w) { window.toast?.('Permita pop-ups para imprimir.'); return; }
    const linhas = p.itens.map(i => `<tr><td>${rpEsc(i.codigo)}${i.codigo_original ? ' <small>(antigo ' + rpEsc(i.codigo_original) + ')</small>' : ''}</td><td>${rpEsc(i.descricao)}</td><td style="text-align:right">${rpFmt(i.quantidade, 3)}</td><td style="text-align:right">${rpMoeda(i.valor_unitario)}</td><td style="text-align:right">${rpMoeda(i.desconto)}</td><td style="text-align:right">${rpMoeda(i.valor_total)}</td></tr>`).join('');
    const tot = p.itens.reduce((s, i) => s + Number(i.valor_total || 0), 0);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${rpEsc(p.numero_pedido)}</title><style>
      body{font-family:Poppins,Arial,sans-serif;font-weight:300;font-size:12px;margin:28px;color:#111}h1{font-size:18px;font-weight:500;text-align:center}
      table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#eee;font-weight:500;font-size:11px;text-transform:uppercase}
      .g{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:10px 0}b{font-weight:500}</style></head><body>
      <h1>PEDIDO ${rpEsc(p.numero_pedido)}</h1>
      <div class="g"><div><b>Data do pedido:</b> ${rpDataBr(p.data_pedido)}</div><div><b>Etapa:</b> ${rpEsc(RP_ETAPA[p.etapa] || p.etapa)}</div>
      <div><b>Cliente:</b> ${rpEsc(p.cliente_nome)}</div><div><b>CNPJ/CPF:</b> ${rpEsc(p.cliente_documento)}</div>
      <div><b>Endereço:</b> ${rpEsc(p.cliente_endereco)}</div><div><b>Telefone:</b> ${rpEsc(p.cliente_telefone)} · <b>E-mail:</b> ${rpEsc(p.cliente_email)}</div></div>
      ${p.observacao ? '<p><b>Observação:</b> ' + rpEsc(p.observacao) + '</p>' : ''}
      <table><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr>${linhas}
      <tr><td colspan="5" style="text-align:right"><b>Total dos itens</b></td><td style="text-align:right"><b>${rpMoeda(tot)}</b></td></tr></table>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Nº do pedido (ex.: 29972)" value={numero} onChange={e => setNumero(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') buscar(); }} style={{ width: 220 }}/>
        <button className="btn btn--sm btn--primary" disabled={busy || !numero.trim()} onClick={() => buscar()}>{busy ? 'Buscando…' : 'Buscar'}</button>
        {pedidos && pedidos.length > 0 && <button className="btn btn--sm" disabled={busy} onClick={() => buscar(numero, true)} title="Lê o pedido de novo no Omie">Atualizar do Omie</button>}
      </div>
      {aviso && <div style={{ color: 'var(--vp-danger)', fontSize: 13, marginBottom: 10 }}>{aviso}</div>}

      {pedidos && pedidos.map(p => {
        const totItens = p.itens.reduce((s, i) => s + Number(i.valor_total || 0), 0);
        const lcs = custos ? p.itens.map(i => rpLinhaCusto(custos, i)) : null;
        const totCusto = lcs ? lcs.reduce((s, l) => s + l.custo, 0) : 0;
        const totLucro = totItens - totCusto, nIncompletos = lcs ? lcs.filter(l => l.incompleto).length : 0;
        return (
          <div key={p.codigo_pedido} className="card pcp-total" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <b style={{ fontWeight: 500, fontSize: 16 }}>Pedido {p.numero_pedido}</b>
              <span className="pcp-tag">{RP_ETAPA[p.etapa] || 'Etapa ' + p.etapa}</span>
              <span style={{ flex: 1 }}/>
              <button className="btn btn--sm" onClick={() => imprimir(p)}>Imprimir / PDF</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px 20px', fontSize: 13, marginBottom: 10 }}>
              <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Cliente</div>{p.cliente_nome || '—'}</div>
              <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>CNPJ / CPF</div>{p.cliente_documento || '—'}</div>
              <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Data do pedido</div>{rpDataBr(p.data_pedido)} · previsão {rpDataBr(p.data_previsao)}</div>
              <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Endereço</div>{p.cliente_endereco || '—'}</div>
              <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Contato</div>{[p.cliente_telefone, p.cliente_email].filter(Boolean).join(' · ') || '—'}</div>
              {p.observacao && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Observação</div><div style={{ maxHeight: 84, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>{p.observacao.replace(/\|/g, '\n')}</div></div>}
            </div>
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table className="t pcp-grid">
                <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd</th><th>Un.</th><th className="text-right">Preço unit.</th><th className="text-right">Desconto</th><th className="text-right">Total</th>{lcs && <><th className="text-right">Custo (materiais)</th><th className="text-right">Lucro bruto</th><th className="text-right">Margem</th></>}</tr></thead>
                <tbody>
                  {p.itens.map((i, k) => (
                    <tr key={i.id}>
                      <td><button className="pcp-cod" onClick={() => window.pcpIrPara?.(nav, 'cadastro-produtos', 'vp_pcp_busca', i.codigo)}>{i.codigo}</button>
                        {i.codigo_original && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>no Omie: {i.codigo_original}</div>}</td>
                      <td>{i.descricao}</td>
                      <td className="text-right">{rpFmt(i.quantidade, 3)}</td>
                      <td>{i.unidade || '—'}</td>
                      <td className="text-right">{rpMoeda(i.valor_unitario)}</td>
                      <td className="text-right">{Number(i.desconto) ? rpMoeda(i.desconto) : '—'}</td>
                      <td className="text-right"><b style={{ fontWeight: 500 }}>{rpMoeda(i.valor_total)}</b></td>
                      {lcs && <>
                        <td className="text-right">{rpMoeda(lcs[k].custo)}<RPAvisoCusto falta={lcs[k].falta} manuais={lcs[k].manuais}/></td>
                        <td className="text-right" style={lcs[k].lucro < 0 ? { color: 'var(--vp-danger)' } : undefined}>{rpMoeda(lcs[k].lucro)}</td>
                        <td className="text-right">{rpPct(lcs[k].margem)}</td>
                      </>}
                    </tr>
                  ))}
                  <tr><td colSpan={6} className="text-right"><b style={{ fontWeight: 500 }}>Total dos itens do PCP</b></td><td className="text-right"><b style={{ fontWeight: 500 }}>{rpMoeda(totItens)}</b></td>
                    {lcs && <>
                      <td className="text-right"><b style={{ fontWeight: 500 }}>{rpMoeda(totCusto)}</b></td>
                      <td className="text-right" style={totLucro < 0 ? { color: 'var(--vp-danger)' } : undefined}><b style={{ fontWeight: 500 }}>{rpMoeda(totLucro)}</b></td>
                      <td className="text-right"><b style={{ fontWeight: 500 }}>{rpPct(totItens > 0 ? (totLucro / totItens) * 100 : null)}</b></td>
                    </>}
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg3)' }}>Valor total do pedido no Omie (todos os itens): {rpMoeda(p.valor_total)}. Aqui aparecem só quadros de comando, corrimãos e cabos.
              {lcs && <div style={{ marginTop: 4 }}>Lucro bruto = venda − custo dos materiais (estrutura × custo atual); <b style={{ fontWeight: 500 }}>não inclui mão de obra, impostos, frete nem comissão</b>.{nIncompletos > 0 && <span style={{ color: 'var(--vp-yellow)' }}> ⚠ {nIncompletos} item(ns) com componente sem custo cadastrado: o lucro está superestimado (passe o mouse no ⚠).</span>}</div>}</div>
          </div>
        );
      })}

      <h3 style={{ margin: '14px 0 8px', fontWeight: 500, fontSize: 14 }}>Pedidos já consultados</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Etapa</th><th className="text-right">Total do pedido</th></tr></thead>
          <tbody>
            {recentes.map(r => (
              <tr key={r.codigo_pedido}>
                <td><button className="pcp-cod" onClick={() => { setNumero(r.numero_pedido); buscar(r.numero_pedido); }}>{r.numero_pedido}</button></td>
                <td>{r.cliente_nome || '—'}</td><td>{rpDataBr(r.data_pedido)}</td>
                <td><span className="pcp-tag">{RP_ETAPA[r.etapa] || 'Etapa ' + r.etapa}</span></td>
                <td className="text-right">{rpMoeda(r.valor_total)}</td>
              </tr>
            ))}
            {recentes.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Digite um número de pedido de venda para consultar no Omie.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RPClientes({ ctx }) {
  const { sb, nav } = ctx;
  const perm = useRPPermissoes();
  const custos = useRPCustos(sb, perm.custo);
  const [pedidos, setPedidos] = React.useState(null);
  const [cliente, setCliente] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const [p, i] = await Promise.all([
      sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, codigo_cliente, cliente_nome, data_pedido').neq('etapa', '00').limit(5000),
      sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, codigo_original, descricao, quantidade, valor_unitario, desconto, valor_total').eq('item_pcp', true).limit(20000),
    ]);
    const itens = {}; (i.data || []).forEach(x => { (itens[x.codigo_pedido] = itens[x.codigo_pedido] || []).push(x); });
    setPedidos((p.data || []).map(x => ({ ...x, itens: itens[x.codigo_pedido] || [] })));
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);

  if (!pedidos) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const clientes = Array.from(new Map(pedidos.map(p => [p.codigo_cliente, p.cliente_nome || String(p.codigo_cliente)]))).sort((a, b) => a[1].localeCompare(b[1]));
  const doCliente = pedidos.filter(p => String(p.codigo_cliente) === cliente);
  const linhas = doCliente.flatMap(p => p.itens.map(i => ({ ...i, numero: p.numero_pedido, data: p.data_pedido }))).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const qtd = linhas.reduce((s, l) => s + Number(l.quantidade || 0), 0);
  const total = linhas.reduce((s, l) => s + Number(l.valor_total || 0), 0);
  const lcs = custos ? linhas.map(l => rpLinhaCusto(custos, l)) : null;
  const totCusto = lcs ? lcs.reduce((s, l) => s + l.custo, 0) : 0, totLucro = total - totCusto;
  const nIncompletos = lcs ? lcs.filter(l => l.incompleto).length : 0;

  const atualizar = async () => {
    setBusy(true);
    const res = await rpAtualizarDoOmie(sb, { dias: 30 });
    setBusy(false);
    if (!res.ok) window.toast?.('Não foi possível atualizar: ' + (res.erro || 'erro')); else window.toast?.(`Omie lido: ${res.dados.gravados} pedido(s) com itens do PCP.`);
    await carregar();
  };

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={cliente} onChange={e => setCliente(e.target.value)} style={{ minWidth: 340 }}>
          <option value="">Selecione o cliente…</option>
          {clientes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" disabled={busy} onClick={atualizar} title="Lê no Omie os pedidos dos últimos 30 dias">{busy ? 'Atualizando…' : 'Atualizar do Omie (30 dias)'}</button>
      </div>
      {!cliente && <div style={{ padding: 24, color: 'var(--fg3)' }}>{clientes.length ? 'Escolha um cliente para ver o que ele comprou.' : 'Nenhum pedido consultado ainda. Busque pedidos na aba Pedidos ou use “Atualizar do Omie”.'}</div>}
      {cliente && (<>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="card pcp-total" style={{ padding: 14, flex: '1 1 180px' }}><div style={{ fontSize: 12, color: 'var(--fg3)' }}>Quantidade de produtos</div><div style={{ fontSize: 22, fontWeight: 500 }}>{rpFmt(qtd, 0)}</div></div>
          <div className="card pcp-total" style={{ padding: 14, flex: '1 1 180px' }}><div style={{ fontSize: 12, color: 'var(--fg3)' }}>Total vendido</div><div style={{ fontSize: 22, fontWeight: 500 }}>{rpMoeda(total)}</div></div>
          <div className="card pcp-total" style={{ padding: 14, flex: '1 1 180px' }}><div style={{ fontSize: 12, color: 'var(--fg3)' }}>Pedidos</div><div style={{ fontSize: 22, fontWeight: 500 }}>{doCliente.length}</div></div>
          {lcs && <div className="card pcp-total" style={{ padding: 14, flex: '1 1 220px', borderLeft: `4px solid ${totLucro < 0 ? 'var(--vp-danger)' : '#2e9e5b'}` }}><div style={{ fontSize: 12, color: 'var(--fg3)' }}>Lucro bruto (materiais)</div><div style={{ fontSize: 22, fontWeight: 500 }}>{rpMoeda(totLucro)}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{rpPct(total > 0 ? (totLucro / total) * 100 : null)} de margem · custo {rpMoeda(totCusto)}{nIncompletos > 0 ? ` · ⚠ ${nIncompletos} item(ns) com custo incompleto` : ''}</div></div>}
        </div>
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Produto</th><th>Data da venda</th><th>Pedido</th><th className="text-right">Qtd</th><th className="text-right">Valor unit.</th><th className="text-right">Desconto</th><th className="text-right">Total</th>{lcs && <><th className="text-right">Custo (materiais)</th><th className="text-right">Lucro bruto</th></>}</tr></thead>
            <tbody>
              {linhas.map((l, k) => (
                <tr key={k}>
                  <td style={{ minWidth: 240 }}><button className="pcp-cod" onClick={() => window.pcpIrPara?.(nav, 'cadastro-produtos', 'vp_pcp_busca', l.codigo)}>{l.codigo}</button><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.descricao}</div></td>
                  <td>{rpDataBr(l.data)}</td><td>{l.numero}</td>
                  <td className="text-right">{rpFmt(l.quantidade, 3)}</td><td className="text-right">{rpMoeda(l.valor_unitario)}</td>
                  <td className="text-right">{Number(l.desconto) ? rpMoeda(l.desconto) : '—'}</td>
                  <td className="text-right"><b style={{ fontWeight: 500 }}>{rpMoeda(l.valor_total)}</b></td>
                  {lcs && <>
                    <td className="text-right">{rpMoeda(lcs[k].custo)}<RPAvisoCusto falta={lcs[k].falta} manuais={lcs[k].manuais}/></td>
                    <td className="text-right" style={lcs[k].lucro < 0 ? { color: 'var(--vp-danger)' } : undefined}>{rpMoeda(lcs[k].lucro)}</td>
                  </>}
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={lcs ? 9 : 7} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nada vendido a este cliente.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Vem dos pedidos de venda do Omie, só com quadros de comando, corrimãos e cabos. Propostas (etapa 00) não contam como venda.
        {lcs && ' Lucro bruto = venda − custo dos materiais (estrutura × custo atual), sem mão de obra, impostos, frete nem comissão.'}
      </div>
    </div>
  );
}

/* ---------------- Lista de Preços e Fluxo de Caixa (custos: materiais + mão de obra) ---------------- */
// Permissões de custo: o custo dos materiais exige almoxarifado.ver_custo; a mão de obra, pcp.ver_hh (dado salarial).
function useRPPermissoes() {
  const [p, setP] = React.useState({ custo: false, hh: false });
  React.useEffect(() => {
    let vivo = true; const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => { if (vivo) setP(x => ({ ...x, custo: !!v })); }).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('pcp', 'ver_hh')).then(v => { if (vivo) setP(x => ({ ...x, hh: !!v })); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return p;
}
// Custos de mão de obra por OP: só a função (e só para quem tem pcp.ver_hh) devolve esses números.
async function rpCustosHH(sb, ordemIds) {
  if (!ordemIds.length) return {};
  try {
    const { data, error } = await sb.functions.invoke('pcp-hh', { body: { acao: 'custos', ordem_ids: ordemIds.slice(0, 300), solicitante_email: (window.__VP_USER && window.__VP_USER.email) || null } });
    if (error) return {};
    return (data && data.total_por_ordem) || {};
  } catch (e) { return {}; }
}
function rpCustoUnit(codigo, filhos, custo, pilha = []) {
  const sub = filhos[codigo] || [];
  if (!sub.length) return Number(custo[codigo] || 0);
  return sub.reduce((s, f) => pilha.includes(f.codigo_filho) ? s
    : s + Number(f.quantidade || 0) * (1 + Number(f.perda_pct || 0) / 100) * rpCustoUnit(f.codigo_filho, filhos, custo, [...pilha, codigo]), 0);
}
const rpBorrado = { filter: 'blur(6px)', userSelect: 'none' };

function RPListaPrecos({ ctx }) {
  const { sb } = ctx;
  const perm = useRPPermissoes();
  const [dados, setDados] = React.useState(null);
  const [busca, setBusca] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const campos = 'codigo, descricao, unidade, familia, preco_venda, tipo_sped';
      const [p, e] = await Promise.all([
        sb.from('pcp_produtos').select(campos).eq('ativo', true).or('familia.ilike.%QUADRO DE COMANDOS%,familia.ilike.%CORRIM%,familia.ilike.%CABOS%').order('familia').order('codigo').limit(500),
        sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').limit(5000),
      ]);
      let custo = {};
      if (perm.custo) {
        const { data } = await sb.from('pcp_produtos').select('codigo, preco_custo, custo_manual').limit(5000);
        (data || []).forEach(l => { custo[l.codigo] = rpCustoEfetivo(l); });
      }
      // Mão de obra real média por unidade: custo de HH das OPs concluídas do produto ÷ unidades produzidas.
      const mo = {};
      if (perm.hh) {
        const { data: ops } = await sb.from('pcp_ordens').select('id, produto, qtd_produzida').eq('status', 'concluida').not('produto', 'is', null).limit(500);
        const porOrdem = await rpCustosHH(sb, (ops || []).map(o => o.id));
        (ops || []).forEach(o => {
          if (porOrdem[o.id] == null || !(Number(o.qtd_produzida) > 0)) return;
          const m = (mo[o.produto] = mo[o.produto] || { custo: 0, un: 0 });
          m.custo += Number(porOrdem[o.id]); m.un += Number(o.qtd_produzida);
        });
      }
      const filhos = {}; (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      if (vivo) setDados({ produtos: p.data || [], filhos, custo, mo });
    })();
    return () => { vivo = false; };
  }, [sb, perm.custo, perm.hh]);

  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const linhas = dados.produtos.filter(p => !busca.trim() || (p.codigo + ' ' + p.descricao).toLowerCase().includes(busca.trim().toLowerCase())).map(p => {
    const preco = Number(p.preco_venda || 0);
    const mat = perm.custo ? rpCustoUnit(p.codigo, dados.filhos, dados.custo) : null;
    const m = dados.mo[p.codigo];
    const maoObra = perm.hh && m && m.un > 0 ? m.custo / m.un : null;
    const total = (mat != null || maoObra != null) ? (mat || 0) + (maoObra || 0) : null;
    const margem = preco > 0 && total != null && (mat != null) ? ((preco - total) / preco) * 100 : null;
    return { ...p, preco, mat, maoObra, total, margem };
  });
  const imprimir = () => {
    const w = window.open('', '_blank');
    if (!w) { window.toast?.('Permita pop-ups para imprimir.'); return; }
    const tr = linhas.map(l => `<tr><td>${rpEsc(l.codigo)}</td><td>${rpEsc(l.descricao)}</td><td>${rpEsc(l.unidade || '')}</td><td style="text-align:right">${l.preco ? rpMoeda(l.preco) : '—'}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lista de Preços</title><style>body{font-family:Poppins,Arial,sans-serif;font-weight:300;font-size:12px;margin:28px}h1{font-size:18px;font-weight:500;text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#eee;font-weight:500;font-size:11px;text-transform:uppercase}</style></head><body><h1>LISTA DE PREÇOS</h1><table><tr><th>Código</th><th>Produto</th><th>Un.</th><th>Preço de venda</th></tr>${tr}</table><p style="font-size:11px;color:#666">Emitida em ${new Date().toLocaleDateString('pt-BR')}. Preços do cadastro do Omie.</p><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar código ou descrição…" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 260 }}/>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{linhas.length} produto(s)</span>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" onClick={imprimir} title="Imprime só código, produto e preço de venda (sem custos)">Imprimir lista de preços</button>
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr>
            <th>Código</th><th>Descrição</th><th>Un.</th><th className="text-right">Preço de venda</th>
            {perm.custo && <th className="text-right">Custo dos materiais</th>}
            {perm.hh && <th className="text-right" title="Média do custo de hora-homem apontado nas OPs concluídas ÷ unidades produzidas">Mão de obra / un.</th>}
            {(perm.custo || perm.hh) && <th className="text-right">Custo total</th>}
            {perm.custo && <th className="text-right">Margem</th>}
          </tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.codigo}>
                <td><button className="pcp-cod" onClick={() => window.pcpIrPara?.(ctx.nav, 'montagem-produto', 'vp_pcp_pai', l.codigo)}>{l.codigo}</button></td>
                <td style={{ minWidth: 260 }}>{l.descricao}</td>
                <td>{l.unidade || '—'}</td>
                <td className="text-right"><b style={{ fontWeight: 500 }}>{l.preco ? rpMoeda(l.preco) : '—'}</b></td>
                {perm.custo && <td className="text-right">{l.mat ? rpMoeda(l.mat) : <span title="Sem custo cadastrado">—</span>}</td>}
                {perm.hh && <td className="text-right">{l.maoObra != null ? rpMoeda(l.maoObra) : <span title="Ainda não há OP concluída com mão de obra apontada">—</span>}</td>}
                {(perm.custo || perm.hh) && <td className="text-right">{l.total ? rpMoeda(l.total) : '—'}</td>}
                {perm.custo && <td className="text-right" style={l.margem != null && l.margem < 0 ? { color: 'var(--vp-danger)' } : undefined}>{l.margem != null ? rpPct(l.margem) : '—'}</td>}
              </tr>
            ))}
            {linhas.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum produto.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Preço de venda do cadastro do Omie. {perm.custo ? 'Custo dos materiais pela estrutura do produto. ' : ''}{perm.hh ? 'Mão de obra = média real das OPs concluídas. ' : ''}
        {!perm.custo && !perm.hh ? 'As colunas de custo e margem aparecem só para quem tem a alçada de custo.' : 'Margem = (preço − custo total) ÷ preço.'}
      </div>
    </div>
  );
}

function RPFluxoCaixa({ ctx }) {
  const { sb } = ctx;
  const perm = useRPPermissoes();
  const custos = useRPCustos(sb, perm.custo);
  const [ano, setAno] = React.useState(new Date().getFullYear());
  const [d, setD] = React.useState(null);

  React.useEffect(() => {
    let vivo = true;
    setD(null);
    if (perm.custo && !custos) return;                       // espera a tabela de custos carregar
    (async () => {
      const receita = Array(12).fill(0), mat = Array(12).fill(0), mo = Array(12).fill(0);
      let nItens = 0, incompletos = 0;
      // Receita: itens do PCP vendidos (pedidos de venda do Omie, exceto proposta), pelo mês do pedido.
      const { data: ped } = await sb.from('pcp_pedidos').select('codigo_pedido, data_pedido').neq('etapa', '00').gte('data_pedido', `${ano}-01-01`).lte('data_pedido', `${ano}-12-31`).limit(5000);
      const mesPedido = {}; (ped || []).forEach(p => { mesPedido[p.codigo_pedido] = Number(p.data_pedido.slice(5, 7)) - 1; });
      if (Object.keys(mesPedido).length) {
        const { data: its } = await sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, quantidade, valor_total').eq('item_pcp', true).in('codigo_pedido', Object.keys(mesPedido).map(Number)).limit(20000);
        (its || []).forEach(i => {
          receita[mesPedido[i.codigo_pedido]] += Number(i.valor_total || 0);
          // Custo dos materiais do que foi VENDIDO (estrutura × custo atual), no mesmo mês da receita: casa com a venda.
          if (custos) { const lc = rpLinhaCusto(custos, i); mat[mesPedido[i.codigo_pedido]] += lc.custo; nItens++; if (lc.incompleto) incompletos++; }
        });
      }
      // Custos: OPs (frentes) concluídas no ano, pelo mês da finalização.
      const { data: ops } = await sb.from('pcp_ordens').select('id, data_finalizacao, frente').eq('status', 'concluida').neq('frente', 'pedido').gte('data_finalizacao', `${ano}-01-01`).lte('data_finalizacao', `${ano}-12-31`).limit(2000);
      const mesOp = {}; (ops || []).forEach(o => { mesOp[o.id] = Number(o.data_finalizacao.slice(5, 7)) - 1; });
      const ids = Object.keys(mesOp);
      if (perm.hh && ids.length) {
        const porOrdem = await rpCustosHH(sb, ids);
        Object.keys(porOrdem).forEach(oid => { if (mesOp[oid] != null) mo[mesOp[oid]] += Number(porOrdem[oid]); });
      }
      if (vivo) setD({ receita, mat, mo, nOps: ids.length, nItens, incompletos });
    })();
    return () => { vivo = false; };
  }, [sb, ano, perm.custo, perm.hh, custos]);

  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const soma = (a) => a.reduce((s, v) => s + v, 0);
  const margem = d.receita.map((r, i) => r - d.mat[i]);          // lucro bruto sobre materiais; a mão de obra fica só informativa (apontamento incompleto)
  const linha = (rot, arr, opts = {}) => (
    <tr>
      <td><b style={{ fontWeight: opts.forte ? 500 : 300 }}>{rot}</b></td>
      {arr.map((v, i) => <td key={i} className="text-right" style={{ ...(opts.oculto ? rpBorrado : {}), ...(opts.neg && v < 0 ? { color: 'var(--vp-danger)' } : {}) }}>{opts.oculto ? '•••' : (v ? rpMoeda(opts.sinal ? -v : v) : '—')}</td>)}
      <td className="text-right" style={opts.oculto ? rpBorrado : undefined}><b style={{ fontWeight: 500 }}>{opts.oculto ? '•••' : (soma(arr) ? rpMoeda(opts.sinal ? -soma(arr) : soma(arr)) : '—')}</b></td>
    </tr>
  );
  const completo = perm.custo;

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
      </div>
      <RPPainelFluxo ctx={ctx} ano={ano} d={d} perm={perm}/>
      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Resultado do PCP por mês</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Resultado do PCP</th>{RP_MESES.map(m => <th key={m} className="text-right">{m.slice(0, 3)}</th>)}<th className="text-right">Total {ano}</th></tr></thead>
          <tbody>
            {linha('Receita (vendas dos itens do PCP)', d.receita, { forte: true })}
            {linha('(−) Custo dos materiais vendidos', d.mat, { oculto: !perm.custo, sinal: true })}
            {linha('Lucro bruto (sobre materiais)', margem, { forte: true, oculto: !completo, neg: true })}
            {linha('Mão de obra apontada nas OPs (informativo, fora do lucro)', d.mo, { oculto: !perm.hh, sinal: true })}
            <tr>
              <td>Margem bruta %</td>
              {d.receita.map((r, i) => <td key={i} className="text-right" style={completo ? undefined : rpBorrado}>{completo ? (r > 0 ? rpPct((margem[i] / r) * 100) : '—') : '•••'}</td>)}
              <td className="text-right" style={completo ? undefined : rpBorrado}><b style={{ fontWeight: 500 }}>{completo ? (soma(d.receita) > 0 ? rpPct((soma(margem) / soma(d.receita)) * 100) : '—') : '•••'}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        É o <b style={{ fontWeight: 500 }}>resultado do PCP</b>, não o caixa do banco: a receita vem dos pedidos de venda do Omie (mês do pedido, sem propostas) e o custo é o dos materiais dos mesmos itens vendidos (estrutura × custo atual). O lucro <b style={{ fontWeight: 500 }}>não inclui mão de obra, impostos, frete, comissão nem despesas fixas</b>; a mão de obra das {d.nOps} OP(s) concluída(s) aparece só como informação.
        {d.incompletos > 0 && ` ⚠ ${d.incompletos} de ${d.nItens} item(ns) vendido(s) têm componente sem custo cadastrado: o lucro está superestimado.`}
        {!completo && ' Custos e lucro aparecem só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

/* ---------------- Página ---------------- */
function RelatoriosPCPPage({ setRoute, setSubsel }) {
  const [aba, setAba] = window.useRouteTab('relatorios-pcp', 'painel', ['painel', 'pedidos', 'precos', 'producao', 'perdas', 'estoque', 'fluxo', 'clientes', 'fotos'], false, true);
  const [produtos, setProdutos] = React.useState(null);
  const sb = window.__VP_SB && window.__VP_SB.sb;

  React.useEffect(() => {
    let vivo = true;
    if (!sb) return;
    sb.from('pcp_produtos').select('codigo, descricao').limit(5000).then(({ data }) => {
      const m = {}; (data || []).forEach(l => { m[l.codigo] = l; });
      if (vivo) setProdutos(m);
    });
    return () => { vivo = false; };
  }, [sb]);

  const ctx = produtos && { sb, produtos, nav: { setRoute, setSubsel } };
  const abas = [['painel', 'Painel'], ['pedidos', 'Pedidos'], ['precos', 'Lista de Preços'], ['producao', 'Produção'], ['perdas', 'Perdas'], ['estoque', 'Estoque'], ['fluxo', 'Fluxo de Caixa'], ['clientes', 'Clientes'], ['fotos', 'Produtos com foto']];
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Relatórios</div>
          <h1 className="page-head__title">Relatórios do PCP</h1>
          <p className="page-head__sub">Produção, perdas e estoque a partir do planejamento, das ordens de produção e do Omie.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {abas.map(([id, rot]) => <button key={id} className={'btn btn--sm' + (aba === id ? ' btn--primary' : '')} onClick={() => setAba(id)}>{rot}</button>)}
      </div>
      {!ctx && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {ctx && aba === 'painel' && <RPPainelProducao ctx={ctx}/>}
      {ctx && aba === 'pedidos' && <RPPedidos ctx={ctx}/>}
      {ctx && aba === 'clientes' && <RPClientes ctx={ctx}/>}
      {ctx && aba === 'precos' && <RPListaPrecos ctx={ctx}/>}
      {ctx && aba === 'fluxo' && <RPFluxoCaixa ctx={ctx}/>}
      {ctx && aba === 'producao' && <RPProducao ctx={ctx}/>}
      {ctx && aba === 'perdas' && <RPPerdas ctx={ctx}/>}
      {ctx && aba === 'estoque' && <RPEstoque ctx={ctx}/>}
      {ctx && aba === 'fotos' && <RPProdutosFoto ctx={ctx}/>}
    </div>
  );
}

Object.assign(window, { RelatoriosPCPPage });
