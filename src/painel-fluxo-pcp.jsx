/* ============================================================
   painel-fluxo-pcp.jsx — Logística Interna · Relatórios do PCP · aba "Fluxo de Caixa": painel no topo.
   Só leitura. Recebe de RPFluxoCaixa (relatorios-pcp.jsx) `d` = { receita[12], mat[12], mo[12] } já calculado
   (receita pelo mês do pedido, custos pelas OPs concluídas) e `perm` = { custo, hh }.
   NÃO é o caixa do banco: é o RESULTADO do PCP + a visão de faturamento/carteira dos pedidos do Omie.
   Regras que existem por motivo real:
   - Receita faturada = pedido com NF emitida (pcp_pedidos.faturado), no mês de data_faturamento. Inclui pedidos marcados
     "histórico" (o faturamento é um fato; histórico só tira o SLA).
   - Carteira a faturar = pedido (exceto proposta/etapa 00) não cancelado, não faturado e NÃO histórico. Os históricos ficam
     de fora para não inflar a carteira com pedido que já foi entregue antes do sistema.
   - Valor do pedido = só os itens do PCP (quadro/corrimão/cabo), como no relatório de Fluxo de Caixa.
   - Custo (materiais + mão de obra) só com as alçadas almoxarifado.ver_custo / pcp.ver_hh; sem elas, valor falso e borrado.
   - Só enxerga os pedidos já lidos do Omie para o PCP (leitura automática seg–sex), não o Contas a Pagar/Receber.
   Usa helpers de relatorios-pcp.jsx: rpFmt, rpPct, rpMoeda, rpBorrado, RP_MESES.
   ============================================================ */

function pfData(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
function pfDias(deIso, ateIso) { return Math.round((new Date(ateIso + 'T00:00') - new Date(deIso + 'T00:00')) / 86400000); }
function pfHoje() { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
const PF_ETAPA = { '10': 'Pedido de Venda', '20': 'Separar estoque / produção', '50': 'Faturar', '60': 'Faturado', '70': 'Entrega', '80': 'Etapa 80' };

function RPPainelFluxo({ ctx, ano, d, perm }) {
  const { sb, produtos } = ctx;
  const [x, setX] = React.useState(null);

  React.useEffect(() => {
    let vivo = true;
    setX(null);
    (async () => {
      const [p, a] = await Promise.all([
        sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, cliente_nome, etapa, faturado, data_faturamento, data_pedido, entrada_em').neq('etapa', '00').eq('cancelado', false).limit(5000),
        sb.from('pcp_pedido_acompanhamento').select('numero_pedido, historico').eq('historico', true).limit(5000),
      ]);
      const ids = (p.data || []).map(r => r.codigo_pedido);
      let its = [];
      if (ids.length) { const r = await sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, valor_total').eq('item_pcp', true).in('codigo_pedido', ids).limit(20000); its = r.data || []; }
      if (vivo) setX({ pedidos: p.data || [], hist: new Set((a.data || []).map(r => r.numero_pedido)), itens: its });
    })();
    return () => { vivo = false; };
  }, [sb, ano]);

  if (!x) return <div style={{ padding: 16, color: 'var(--fg3)' }}>Carregando painel…</div>;
  const hoje = pfHoje();
  const valor = {}; x.itens.forEach(i => { valor[i.codigo_pedido] = (valor[i.codigo_pedido] || 0) + Number(i.valor_total || 0); });
  const doAno = (iso) => iso && String(iso).slice(0, 4) === String(ano);
  const faturada = Array(12).fill(0);
  let nFat = 0;
  x.pedidos.forEach(r => { if (r.faturado && doAno(r.data_faturamento)) { faturada[Number(r.data_faturamento.slice(5, 7)) - 1] += valor[r.codigo_pedido] || 0; nFat++; } });
  const carteira = x.pedidos.filter(r => !r.faturado && !x.hist.has(r.numero_pedido) && (valor[r.codigo_pedido] || 0) > 0)
    .map(r => ({ ...r, v: valor[r.codigo_pedido] })).sort((a, b) => b.v - a.v);
  const totCarteira = carteira.reduce((s, r) => s + r.v, 0);
  const soma = (arr) => arr.reduce((s, v) => s + v, 0);
  const totPedida = soma(d.receita), totFat = soma(faturada);
  const custo = d.mat;                                    // custo dos materiais dos itens vendidos; mão de obra fica de fora do lucro
  const completo = perm.custo;
  const totCusto = soma(custo), margem = totPedida - totCusto;
  const nItens = d.nItens || 0, incompletos = d.incompletos || 0;
  // Variação: compara o ÚLTIMO MÊS FECHADO com o anterior (o mês em curso ainda está incompleto e daria queda falsa).
  const mes = new Date().getFullYear() === ano ? new Date().getMonth() - 1 : 11;
  const varMes = mes > 0 && d.receita[mes - 1] > 0 ? ((d.receita[mes] - d.receita[mes - 1]) / d.receita[mes - 1]) * 100 : null;
  const maxMes = Math.max(1, ...d.receita, ...faturada, ...(completo ? custo : []));

  const porCliente = {}, porProduto = {};
  x.pedidos.forEach(r => { if (doAno(r.data_pedido)) { porCliente[r.cliente_nome || '—'] = (porCliente[r.cliente_nome || '—'] || 0) + (valor[r.codigo_pedido] || 0); } });
  const mapaPed = {}; x.pedidos.forEach(r => { mapaPed[r.codigo_pedido] = r; });
  x.itens.forEach(i => { const r = mapaPed[i.codigo_pedido]; if (r && doAno(r.data_pedido)) porProduto[i.codigo] = (porProduto[i.codigo] || 0) + Number(i.valor_total || 0); });
  const topCli = Object.entries(porCliente).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProd = Object.entries(porProduto).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const card = (rot, val, sub, cor, extra) => (
    <div className="card pcp-total" style={{ padding: 14, flex: '1 1 175px', borderLeft: cor ? `4px solid ${cor}` : undefined }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div>
      <div style={{ fontSize: 22, fontWeight: 500, ...(extra || {}) }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{sub}</div>}
    </div>
  );
  const falso = 'R$ 000.000,00';

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {card(`Receita pedida ${ano}`, rpMoeda(totPedida), varMes == null ? 'itens do PCP, mês do pedido' : `${RP_MESES[mes].slice(0, 3)}: ${varMes >= 0 ? '▲' : '▼'} ${rpFmt(Math.abs(varMes), 0)}% vs. ${RP_MESES[mes - 1].slice(0, 3)} (últimos meses fechados)`)}
        {card(`Faturado (NF) ${ano}`, rpMoeda(totFat), `${nFat} pedido(s) com NF emitida`, null)}
        {card('Carteira a faturar', rpMoeda(totCarteira), `${carteira.length} pedido(s) sem NF, fora os históricos`, carteira.length ? 'var(--vp-yellow)' : '#2e9e5b')}
        {completo
          ? card('Custo dos materiais vendidos', rpMoeda(totCusto), 'estrutura × custo atual · sem mão de obra', null)
          : card('Custo dos materiais vendidos', falso, 'visível só com a alçada de custo', null, rpBorrado)}
        {completo
          ? (totPedida > 0
            ? card('Lucro bruto (materiais)', rpMoeda(margem), `${rpPct((margem / totPedida) * 100)} de margem${incompletos ? ` · ⚠ ${incompletos} de ${nItens} itens com custo incompleto: superestimado` : ''}`, incompletos ? 'var(--vp-yellow)' : (margem / totPedida < 0.15 ? 'var(--vp-danger)' : '#2e9e5b'))
            : card('Lucro bruto (materiais)', '—', 'sem receita no ano', null))
          : card('Lucro bruto (materiais)', 'R$ 000.000,00', 'visível só com a alçada de custo', null, rpBorrado)}
      </div>

      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Receita pedida × faturada{completo ? ' × custo' : ''} por mês em {ano}</h3>
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 150 }}>
          {RP_MESES.map((m, i) => (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}
              title={`${m}: pedida ${rpMoeda(d.receita[i])} · faturada ${rpMoeda(faturada[i])}${completo ? ` · custo ${rpMoeda(custo[i])}` : ''}`}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: completo ? '27%' : '38%', height: (d.receita[i] / maxMes) * 120, background: 'color-mix(in srgb, var(--fg3) 45%, transparent)', minHeight: d.receita[i] ? 2 : 0 }}/>
                <div style={{ width: completo ? '27%' : '38%', height: (faturada[i] / maxMes) * 120, background: 'var(--vp-yellow)', minHeight: faturada[i] ? 2 : 0 }}/>
                {completo && <div style={{ width: '27%', height: (custo[i] / maxMes) * 120, background: 'var(--vp-danger)', minHeight: custo[i] ? 2 : 0 }}/>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{m.slice(0, 3)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'color-mix(in srgb, var(--fg3) 45%, transparent)', marginRight: 4 }}/>Pedida (mês do pedido)
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--vp-yellow)', margin: '0 4px 0 14px' }}/>Faturada (mês da NF)
          {completo && <><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--vp-danger)', margin: '0 4px 0 14px' }}/>Custo dos materiais vendidos (mês do pedido)</>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Carteira a faturar</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Etapa no Omie</th><th className="text-right">Valor (itens PCP)</th><th className="text-right">Parado há</th></tr></thead>
              <tbody>
                {carteira.slice(0, 10).map(r => {
                  const dias = r.entrada_em ? pfDias(String(r.entrada_em).slice(0, 10), hoje) : null;
                  return (
                    <tr key={r.codigo_pedido}>
                      <td><b style={{ fontWeight: 500 }}>{r.numero_pedido}</b></td>
                      <td>{r.cliente_nome || '—'}</td>
                      <td>{PF_ETAPA[r.etapa] || 'Etapa ' + r.etapa}</td>
                      <td className="text-right">{rpMoeda(r.v)}</td>
                      <td className="text-right">{dias == null ? '—' : dias === 0 ? 'hoje' : `${dias} dia(s)`}</td>
                    </tr>
                  );
                })}
                {carteira.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum pedido aguardando faturamento.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Maiores clientes em {ano}</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Cliente</th><th className="text-right">Receita pedida</th><th className="text-right">% do total</th></tr></thead>
              <tbody>
                {topCli.map(([c, v]) => <tr key={c}><td>{c}</td><td className="text-right">{rpMoeda(v)}</td><td className="text-right">{rpPct(totPedida ? (v / totPedida) * 100 : null)}</td></tr>)}
                {topCli.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Sem pedidos em {ano}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Produtos que mais vendem em {ano}</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Produto</th><th className="text-right">Receita pedida</th><th className="text-right">% do total</th></tr></thead>
              <tbody>
                {topProd.map(([c, v]) => <tr key={c}><td><b style={{ fontWeight: 500 }}>{c}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{(produtos[c] || {}).descricao || ''}</div></td><td className="text-right">{rpMoeda(v)}</td><td className="text-right">{rpPct(totPedida ? (v / totPedida) * 100 : null)}</td></tr>)}
                {topProd.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Sem pedidos em {ano}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Resultado do PCP, não o caixa do banco. O lucro é bruto sobre materiais: sem mão de obra, impostos, frete, comissão e despesas fixas. Considera só os pedidos já lidos do Omie (leitura automática seg–sex, 7h–19h). Faturado = NF emitida, inclusive de pedidos marcados como histórico; a carteira exclui propostas e pedidos históricos. Despesas fixas e prazos de pagamento entram quando o Financeiro ligar o Contas a Pagar e a Receber.
      </div>
    </div>
  );
}

Object.assign(window, { RPPainelFluxo });
