/* ============================================================
   painel-producao-pcp.jsx — Logística Interna · Relatórios do PCP · aba "Painel" (dashboard de Produção).
   Só leitura. Fontes: pcp_ordens (OPs e OP-mãe), pcp_plano (meta), pcp_pedidos (fila etapa 20 do Omie), pcp_produtos.
   Regras que existem por motivo real:
   - OP sem `produto` (OP-mãe do pedido, frentes de corte) NÃO entra em produção/perdas (mesmo filtro dos outros relatórios);
     a OP-mãe aparece à parte como "pedidos em produção".
   - Atraso = OP ainda não concluída/cancelada com prazo_entrega anterior a hoje.
   - Fila: pedido na etapa 20 do Omie sem OP-mãe no PCP ("aguardando gerar OP").
   Usado por RelatoriosPCPPage (relatorios-pcp.jsx), que passa ctx = { sb, produtos, nav }.
   ============================================================ */

const PN_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function pnFmt(v, d = 0) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function pnHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function pnData(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
function pnDias(deIso, ateIso) { return Math.round((new Date(ateIso + 'T00:00') - new Date(deIso + 'T00:00')) / 86400000); }

function RPPainelProducao({ ctx }) {
  const { sb, produtos, nav } = ctx;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const hoje = pnHoje();
  const ano = Number(hoje.slice(0, 4)), mes = hoje.slice(0, 7);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const [o, p, f, m] = await Promise.all([
        sb.from('pcp_ordens').select('id, numero, titulo, produto, quantidade, status, frente, prazo_entrega, data_abertura, data_finalizacao, qtd_produzida, qtd_perdida, causa_perda, pedido_codigo, cliente').neq('status', 'cancelada').limit(5000),
        sb.from('pcp_plano').select('produto, mes, quantidade').eq('ano', ano).limit(5000),
        sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, cliente_nome, entrada_em, data_previsao, valor_total').eq('etapa', '20').eq('cancelado', false).limit(500),
        sb.from('pcp_ordens').select('pedido_codigo').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
      ]);
      const err = o.error || p.error || f.error || m.error;
      if (!vivo) return;
      if (err) { setErro(err.message); return; }
      setDados({ ordens: o.data || [], plano: p.data || [], fila: f.data || [], comMae: new Set((m.data || []).map(x => x.pedido_codigo)) });
    })();
    return () => { vivo = false; };
  }, [sb, ano]);

  if (erro) return <div style={{ color: 'var(--vp-danger)', padding: 16 }}>{erro}</div>;
  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const prod = dados.ordens.filter(x => x.produto);                          // OPs de produto acabado
  const abertas = prod.filter(x => x.status === 'aguardando' || x.status === 'em_producao');
  const concl = prod.filter(x => x.status === 'concluida' && x.data_finalizacao);
  const doMes = concl.filter(x => x.data_finalizacao.slice(0, 7) === mes);
  const doAno = concl.filter(x => x.data_finalizacao.slice(0, 4) === String(ano));
  const emAberto = (x) => x.status === 'aguardando' || x.status === 'em_producao';
  const atrasadas = dados.ordens.filter(x => emAberto(x) && x.prazo_entrega && x.prazo_entrega < hoje)
    .sort((a, b) => a.prazo_entrega.localeCompare(b.prazo_entrega));
  const vencendo = dados.ordens.filter(x => emAberto(x) && x.prazo_entrega && x.prazo_entrega >= hoje && pnDias(hoje, x.prazo_entrega) <= 7)
    .sort((a, b) => a.prazo_entrega.localeCompare(b.prazo_entrega));
  const pedidosEmProducao = dados.ordens.filter(x => x.frente === 'pedido' && emAberto(x));
  const aguardandoOp = dados.fila.filter(x => !dados.comMae.has(x.codigo_pedido));

  const produzidoMes = doMes.reduce((s, x) => s + Number(x.qtd_produzida || 0), 0);
  const perdidoMes = doMes.reduce((s, x) => s + Number(x.qtd_perdida || 0), 0);
  const perdaMes = produzidoMes + perdidoMes > 0 ? (perdidoMes / (produzidoMes + perdidoMes)) * 100 : null;

  // planejado × realizado por mês (ano corrente)
  const plano = Array(12).fill(0), real = Array(12).fill(0);
  dados.plano.forEach(l => { plano[l.mes - 1] += Number(l.quantidade); });
  doAno.forEach(x => { real[Number(x.data_finalizacao.slice(5, 7)) - 1] += Number(x.qtd_produzida || 0); });
  const maxMes = Math.max(1, ...plano, ...real);

  const topProdutos = Object.entries(doAno.reduce((a, x) => { a[x.produto] = (a[x.produto] || 0) + Number(x.qtd_produzida || 0); return a; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const causas = Object.entries(doAno.filter(x => Number(x.qtd_perdida) > 0).reduce((a, x) => { const c = (x.causa_perda || 'Sem causa informada').trim(); a[c] = (a[c] || 0) + Number(x.qtd_perdida); return a; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  const abrirOp = (id) => window.pcpIrPara?.(nav, 'pcp', 'vp_pcp_op', id);
  const card = (rot, valor, sub, cor, onClick) => (
    <div className="card pcp-total" onClick={onClick} style={{ padding: 14, flex: '1 1 170px', cursor: onClick ? 'pointer' : 'default', borderLeft: cor ? `4px solid ${cor}` : undefined }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div>
      <div style={{ fontSize: 24, fontWeight: 500 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{sub}</div>}
    </div>
  );
  const linhaOp = (x, atraso) => (
    <tr key={x.id}>
      <td><button className="pcp-cod" onClick={() => abrirOp(x.id)}>{x.numero}</button></td>
      <td>{x.titulo || (produtos[x.produto] || {}).descricao || x.produto || '—'}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{x.cliente || ''}</div></td>
      <td>{pnData(x.prazo_entrega)}</td>
      <td className="text-right" style={atraso ? { color: 'var(--vp-danger)' } : undefined}>{atraso ? `${pnDias(x.prazo_entrega, hoje)} dia(s) de atraso` : (pnDias(hoje, x.prazo_entrega) === 0 ? 'vence hoje' : `em ${pnDias(hoje, x.prazo_entrega)} dia(s)`)}</td>
    </tr>
  );

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {card('Pedidos em produção', pedidosEmProducao.length, 'OP-mãe abertas', null)}
        {card('OPs de produto em aberto', abertas.length, `${abertas.filter(x => x.status === 'em_producao').length} em produção · ${abertas.filter(x => x.status === 'aguardando').length} aguardando`, null)}
        {card('Atrasadas', atrasadas.length, atrasadas.length ? 'prazo de entrega vencido' : 'nenhuma', atrasadas.length ? 'var(--vp-danger)' : '#2e9e5b')}
        {card('Produzido no mês', pnFmt(produzidoMes), `${doMes.length} OP(s) concluída(s)`, null)}
        {card('Perdas no mês', perdaMes == null ? '—' : pnFmt(perdaMes, 1) + '%', `${pnFmt(perdidoMes)} un. perdida(s)`, perdaMes > 5 ? 'var(--vp-yellow)' : null)}
        {card('Pedidos aguardando OP', aguardandoOp.length, 'etapa 20 no Omie, sem OP', aguardandoOp.length ? 'var(--vp-yellow)' : '#2e9e5b', () => { nav.setSubsel && nav.setSubsel(null); nav.setRoute && nav.setRoute('pcp'); })}
      </div>

      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Planejado × produzido em {ano}</h3>
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 150 }}>
          {PN_MESES.map((m, i) => (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }} title={`${m}: planejado ${pnFmt(plano[i])} · produzido ${pnFmt(real[i])}`}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '38%', height: (plano[i] / maxMes) * 120, background: 'color-mix(in srgb, var(--fg3) 45%, transparent)', minHeight: plano[i] ? 2 : 0 }}/>
                <div style={{ width: '38%', height: (real[i] / maxMes) * 120, background: 'var(--vp-yellow)', minHeight: real[i] ? 2 : 0 }}/>
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{m}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'color-mix(in srgb, var(--fg3) 45%, transparent)', marginRight: 4 }}/>Planejado (meta)
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--vp-yellow)', margin: '0 4px 0 14px' }}/>Produzido (OPs concluídas no mês da finalização)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Atrasadas e vencendo em 7 dias</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>OP</th><th>Descrição / cliente</th><th>Prazo</th><th className="text-right">Situação</th></tr></thead>
              <tbody>
                {atrasadas.slice(0, 10).map(x => linhaOp(x, true))}
                {vencendo.slice(0, 10).map(x => linhaOp(x, false))}
                {atrasadas.length + vencendo.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nada atrasado nem vencendo nos próximos 7 dias.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Pedidos aguardando gerar OP</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Previsão</th><th className="text-right">Esperando</th></tr></thead>
              <tbody>
                {aguardandoOp.map(x => {
                  const dias = x.entrada_em ? pnDias(String(x.entrada_em).slice(0, 10), hoje) : null;
                  return (
                    <tr key={x.codigo_pedido}>
                      <td><b style={{ fontWeight: 500 }}>{x.numero_pedido}</b></td>
                      <td>{x.cliente_nome || '—'}</td>
                      <td>{pnData(x.data_previsao)}</td>
                      <td className="text-right" style={dias > 1 ? { color: 'var(--vp-danger)' } : undefined}>{dias == null ? '—' : dias === 0 ? 'hoje' : `${dias} dia(s)`}</td>
                    </tr>
                  );
                })}
                {aguardandoOp.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Todos os pedidos da etapa 20 já têm OP.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Mais produzidos em {ano}</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Produto</th><th>Descrição</th><th className="text-right">Produzido</th></tr></thead>
              <tbody>
                {topProdutos.map(([c, q]) => <tr key={c}><td>{c}</td><td>{(produtos[c] || {}).descricao || ''}</td><td className="text-right">{pnFmt(q)}</td></tr>)}
                {topProdutos.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhuma OP concluída neste ano.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Principais causas de perda em {ano}</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Causa</th><th className="text-right">Unidades perdidas</th></tr></thead>
              <tbody>
                {causas.map(([c, q]) => <tr key={c}><td>{c}</td><td className="text-right">{pnFmt(q)}</td></tr>)}
                {causas.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Sem perdas registradas neste ano.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        OP-mãe (pedido) e frentes sem produto acabado não entram nas quantidades; aparecem só em “Pedidos em produção”. Atrasada = ainda não concluída com prazo de entrega vencido.
      </div>
    </div>
  );
}

Object.assign(window, { RPPainelProducao });
