/* ============================================================
   necessidade-pcp.jsx — Logística Interna · Almoxarifado · aba "Necessidade".
   O que falta de material para ATENDER O QUE JÁ FOI VENDIDO (carteira) e até quando comprar, dado o prazo de chegada.
   Complementa a aba Reposição (que olha o histórico de consumo): esta olha o COMPROMETIDO — pedidos abertos do Omie
   (e ordens avulsas) explodidos pela estrutura dos produtos (ver necessidade-calc.js).
   Regras que existem por motivo real:
   - Carteira = pedidos que o PCP já leu do Omie (etapa 20 em diante) NÃO faturados, NÃO cancelados e fora do histórico.
     Propostas (etapa 00) só entram se marcado: ainda não são venda firme.
   - Ordens de produção só entram se NÃO vierem de pedido (nem a OP-mãe): as de pedido já estão na demanda do pedido.
   - Só LÊ: nada é gravado no Omie nem no banco. Custo/valor só para quem tem almoxarifado.ver_custo.
   ============================================================ */

const NEC_STATUS = {
  atrasado: { label: 'Não chega a tempo', variant: 'danger' },
  comprar: { label: 'Comprar', variant: 'warning' },
  sem_data: { label: 'Sem data de entrega', variant: 'info' },
  coberto: { label: 'Coberto', variant: 'success' },
};
const necFmt = (v, d = 2) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
const necMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const necData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';

async function necLerTudo(montar) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function AlmoxarifadoNecessidade() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [custoOk, setCustoOk] = React.useState(false);
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [incluiPropostas, setIncluiPropostas] = React.useState(false);
  const [incluiOrdens, setIncluiOrdens] = React.useState(true);
  const [filtro, setFiltro] = React.useState('agir');       // agir | atrasado | comprar | todos
  const [busca, setBusca] = React.useState('');

  React.useEffect(() => {
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setCustoOk(!!v)).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase não carregou.'); return; }
    try {
      const campos = 'codigo, descricao, unidade' + (custoOk ? ', preco_custo, custo_manual' : '');
      const [cfg, pedidos, acomp, itens, ordens, estr, prods, pos, est] = await Promise.all([
        sb.from('pcp_reposicao_config').select('*').eq('id', true).maybeSingle(),
        necLerTudo(() => sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_fantasia, data_previsao').eq('faturado', false).eq('cancelado', false).order('codigo_pedido')),
        necLerTudo(() => sb.from('pcp_pedido_acompanhamento').select('numero_pedido, historico').order('numero_pedido')),
        necLerTudo(() => sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, quantidade').eq('item_pcp', true).order('id')),
        necLerTudo(() => sb.from('pcp_ordens').select('id, numero, produto, quantidade, qtd_produzida, status, prazo_entrega, pedido_codigo, ordem_mae_id, cliente').not('status', 'in', '(concluida,cancelada)').order('created_at')),
        necLerTudo(() => sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').order('id')),
        necLerTudo(() => sb.from('pcp_produtos').select(campos).order('codigo')),
        necLerTudo(() => sb.from('pcp_posicao_compra').select('codigo, fisico, pendente').order('codigo')),
        necLerTudo(() => sb.from('pcp_estoque').select('codigo, quantidade').order('codigo')),
      ]);
      if (cfg.error) throw cfg.error;
      setD({ cfg: cfg.data, pedidos, historico: new Set(acomp.filter(a => a.historico).map(a => a.numero_pedido)), itens, ordens, estr, prods, pos, est });
      setErro(null);
    } catch (e) { setErro(e.message || String(e)); }
  }, [sb, custoOk]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const res = React.useMemo(() => {
    if (!d) return null;
    const hoje = new Date().toISOString().slice(0, 10);
    const abertos = d.pedidos.filter(p => !d.historico.has(p.numero_pedido) && (incluiPropostas || p.etapa !== '00'));
    const porCodigo = new Map(abertos.map(p => [p.codigo_pedido, p]));
    const demanda = [];
    d.itens.forEach(i => {
      const p = porCodigo.get(i.codigo_pedido);
      if (p && Number(i.quantidade) > 0) demanda.push({ codigo: i.codigo, qtd: Number(i.quantidade), ref: `Pedido ${p.numero_pedido}`, previsao: p.data_previsao || null });
    });
    let nOrdens = 0;
    if (incluiOrdens) {
      const porId = new Map(d.ordens.map(o => [o.id, o]));
      const raizDePedido = (o) => { let x = o, n = 0; while (x && n++ < 5) { if (x.pedido_codigo) return true; x = x.ordem_mae_id ? porId.get(x.ordem_mae_id) : null; } return false; };
      d.ordens.forEach(o => {
        if (!o.produto || raizDePedido(o)) return;
        const q = Math.max(0, Number(o.quantidade || 0) - Number(o.qtd_produzida || 0));
        if (q > 0) { demanda.push({ codigo: o.produto, qtd: q, ref: `OP ${o.numero}`, previsao: o.prazo_entrega || null }); nOrdens++; }
      });
    }
    const filhos = {}; d.estr.forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
    const fis = {}; d.est.forEach(e => { fis[e.codigo] = Number(e.quantidade || 0); });
    const estoque = {};
    d.prods.forEach(p => { estoque[p.codigo] = { fisico: fis[p.codigo] || 0, aCaminho: 0 }; });
    d.pos.forEach(p => { estoque[p.codigo] = { fisico: Number(p.fisico || 0), aCaminho: Number(p.pendente || 0) }; });
    const r = window.PcpNecessidade.calcular({ demanda, filhos, estoque, hoje, cfg: d.cfg });
    const prod = Object.fromEntries(d.prods.map(p => [p.codigo, p]));
    const comCusto = (l) => { const p = prod[l.codigo]; const c = custoOk && p ? rpCustoEfetivo(p) : null; return { ...l, p, custo: c, valor: c > 0 ? l.falta * c : null }; };
    return { abertos, nOrdens, nItens: demanda.length, ciclos: r.ciclos, comprados: r.comprados.map(comCusto), fabricados: r.fabricados.map(l => ({ ...l, p: prod[l.codigo] })) };
  }, [d, incluiPropostas, incluiOrdens, custoOk]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d || !res) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const faltam = res.comprados.filter(l => l.falta > 1e-9);
  const atrasados = res.comprados.filter(l => l.status === 'atrasado');
  const valorFalta = faltam.reduce((s, l) => s + (l.valor || 0), 0);
  const semCusto = faltam.filter(l => custoOk && !(l.custo > 0)).length;
  const q = busca.trim().toLowerCase();
  const lista = res.comprados
    .filter(l => filtro === 'todos' ? true : filtro === 'agir' ? l.falta > 1e-9 : l.status === filtro)
    .filter(l => !q || (l.codigo + ' ' + (l.p?.descricao || '') + ' ' + l.refs.join(' ')).toLowerCase().includes(q));
  const btn = (a) => 'btn btn--sm' + (a ? ' btn--primary' : '');
  const refsTxt = (refs) => refs.length > 3 ? `${refs.slice(0, 3).join(', ')} +${refs.length - 3}` : refs.join(', ');

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Carteira considerada</div><div className="pcp-total__v">{res.abertos.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>pedido(s){res.nOrdens ? ` + ${res.nOrdens} ordem(ns) avulsa(s)` : ''} · {res.nItens} linha(s)</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Materiais em falta</div><div className="pcp-total__v">{faltam.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>para atender a carteira</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Não chegam a tempo</div><div className="pcp-total__v" style={{ color: atrasados.length ? 'var(--vp-danger)' : undefined }}>{atrasados.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>mesmo comprando hoje</div></div>
        <div className="pcp-total"><div className="pcp-total__l">{custoOk ? 'Valor do que falta' : 'Itens a produzir'}</div><div className="pcp-total__v">{custoOk ? necMoeda(valorFalta) : res.fabricados.filter(l => l.produzir > 0).length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{custoOk ? (semCusto ? `${semCusto} sem custo` : 'custo efetivo') : 'quadros / corrimões / kits'}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(filtro === 'agir')} onClick={() => setFiltro('agir')}>Em falta ({faltam.length})</button>
        <button className={btn(filtro === 'atrasado')} onClick={() => setFiltro('atrasado')}>Não chegam a tempo ({atrasados.length})</button>
        <button className={btn(filtro === 'comprar')} onClick={() => setFiltro('comprar')}>Comprar ({res.comprados.filter(l => l.status === 'comprar').length})</button>
        <button className={btn(filtro === 'todos')} onClick={() => setFiltro('todos')}>Todos ({res.comprados.length})</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}><input type="checkbox" checked={incluiPropostas} onChange={e => setIncluiPropostas(e.target.checked)}/>incluir propostas (etapa 00)</label>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={incluiOrdens} onChange={e => setIncluiOrdens(e.target.checked)}/>incluir ordens avulsas</label>
        <input className="input" style={{ minWidth: 200, marginLeft: 'auto' }} placeholder="Buscar item ou pedido…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" onClick={carregar}>Recarregar</button>
      </div>

      {res.nItens === 0 && (
        <div style={{ padding: 12, marginBottom: 12, border: '1px solid var(--vp-warning)', borderRadius: 8, fontSize: 13 }}>
          Nenhum pedido aberto com item do PCP na carteira. Os pedidos entram sozinhos quando chegam à etapa 20 ("Separar estoque / produção") no Omie; marcar "incluir propostas" mostra também os ainda em proposta.
        </div>
      )}

      <Card title="Materiais para comprar" sub={`${lista.length} item(ns) · prazo ${d.cfg.prazo_importado_dias} d importado / ${d.cfg.prazo_nacional_dias} d nacional`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>
              <th>Item</th><th>Situação</th><th style={{ textAlign: 'right' }}>Necessário</th><th style={{ textAlign: 'right' }}>Em mãos</th><th style={{ textAlign: 'right' }}>A caminho</th>
              <th style={{ textAlign: 'right' }}>Falta</th><th style={{ textAlign: 'right' }}>Prazo</th><th>Entrega mais cedo</th><th>Comprar até</th><th>Pedidos</th>{custoOk && <th style={{ textAlign: 'right' }}>Valor</th>}
            </tr></thead>
            <tbody>
              {lista.slice(0, 400).map(l => {
                const st = NEC_STATUS[l.status];
                return (
                  <tr key={l.codigo}>
                    <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.p?.descricao}</div></td>
                    <td><Badge variant={st.variant}>{st.label}</Badge>{l.status === 'atrasado' ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{l.prazo - l.diasAtePrevisao} dia(s) de atraso</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{necFmt(l.necessario)} {l.p?.unidade || ''}</td>
                    <td style={{ textAlign: 'right' }}>{necFmt(l.fisico)}</td>
                    <td style={{ textAlign: 'right' }}>{l.aCaminho ? necFmt(l.aCaminho) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.falta > 1e-9 ? necFmt(Math.ceil(l.falta * 100) / 100) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.prazo}d{l.nacional ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>nacional</div> : null}</td>
                    <td>{necData(l.previsao)}</td>
                    <td style={{ color: l.status === 'atrasado' ? 'var(--vp-danger)' : undefined }}>{l.falta > 1e-9 ? (l.comprarAte ? necData(l.comprarAte) : '—') : '—'}</td>
                    <td style={{ fontSize: 11, maxWidth: 200 }}>{refsTxt(l.refs)}</td>
                    {custoOk && <td style={{ textAlign: 'right' }}>{l.falta > 1e-9 ? (l.valor != null ? necMoeda(l.valor) : <span title="Sem custo cadastrado">⚠</span>) : '—'}</td>}
                  </tr>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={custoOk ? 11 : 10} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 12 }}/>
      <Card title="A produzir (itens fabricados)" sub="Quadros, corrimões e kits com estrutura: o que falta fabricar depois de abater o estoque acabado">
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Necessário</th><th style={{ textAlign: 'right' }}>Em estoque</th><th style={{ textAlign: 'right' }}>Produzir</th><th>Entrega mais cedo</th><th>Pedidos</th></tr></thead>
            <tbody>
              {res.fabricados.map(l => (
                <tr key={l.codigo}>
                  <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.p?.descricao}</div></td>
                  <td style={{ textAlign: 'right' }}>{necFmt(l.necessario)} {l.p?.unidade || ''}</td>
                  <td style={{ textAlign: 'right' }}>{necFmt(l.fisico)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.produzir > 1e-9 ? necFmt(l.produzir) : <span style={{ fontWeight: 400, color: 'var(--fg3)' }}>coberto pelo estoque</span>}</td>
                  <td>{necData(l.previsao)}</td>
                  <td style={{ fontSize: 11, maxWidth: 220 }}>{refsTxt(l.refs)}</td>
                </tr>
              ))}
              {res.fabricados.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item fabricado na carteira.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {res.abertos.length > 0 && (
        <>
          <div style={{ height: 12 }}/>
          <Card title="Pedidos considerados" sub={`${res.abertos.length} pedido(s) abertos, não faturados`}>
            <div className="table-wrap">
              <table className="t pcp-grid">
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Etapa</th><th>Previsão de entrega</th></tr></thead>
                <tbody>{res.abertos.map(p => (
                  <tr key={p.codigo_pedido}><td>{p.numero_pedido}</td><td>{p.cliente_fantasia || p.cliente_nome}</td><td>{p.etapa}</td><td>{necData(p.data_previsao)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {res.ciclos.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--vp-danger)' }}>⚠ Estrutura com ciclo (um item contém ele mesmo): {res.ciclos.join(', ')}. Corrija no cadastro.</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        <b style={{ fontWeight: 500 }}>Como ler:</b> a carteira (pedidos abertos do Omie, mais ordens avulsas) é explodida pela estrutura dos produtos, em todos os níveis, somando tudo que cada item é pedido antes de abater o estoque físico e o que já está a caminho. <b style={{ fontWeight: 500 }}>Comprar até</b> = entrega mais cedo − prazo de chegada; <b style={{ fontWeight: 500 }}>Não chega a tempo</b> = essa data já passou. Use junto da aba Reposição: esta mostra o que já foi vendido, a outra o que o histórico pede. Só leitura.
        {!custoOk && ' Valores aparecem só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

Object.assign(window, { AlmoxarifadoNecessidade });
