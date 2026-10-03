/* ============================================================
   necessidade-pcp.jsx — Logística Interna · Almoxarifado · aba "Necessidade".
   O que falta de material para ATENDER O QUE JÁ FOI VENDIDO (carteira) e até quando comprar, dado o prazo de chegada.
   Complementa a aba Reposição (que olha o histórico de consumo): esta olha o COMPROMETIDO — pedidos abertos do Omie
   (e ordens avulsas) explodidos pela estrutura dos produtos (ver necessidade-calc.js).
   Regras que existem por motivo real:
   - Carteira = pedidos que o PCP já leu do Omie (etapa 20 em diante) NÃO faturados, NÃO cancelados e fora do histórico.
     Propostas (etapa 00) só entram se marcado: ainda não são venda firme.
   - Ordens de produção só entram se NÃO vierem de pedido (nem a OP-mãe): as de pedido já estão na demanda do pedido.
   - Pedidos em etapa 10 ("Pedido", antes de separar estoque/produção) são SÓ PREVISÃO: vêm de pcp_previsao_* (nunca de pcp_pedidos),
     entram na conta apenas com o interruptor ligado, não mudam os cartões (que são da carteira firme), ganham o selo "Previsão" quando
     são a única razão de o item faltar, e pedidos parados há mais de PREV_DIAS_MAX dias (cadastro antigo esquecido na etapa) são ignorados.
   - Gerar OP (03/10): cada item fabricado em falta vira uma OP aberta pelo botão "Gerar OP". A quantidade é o que FALTA ABRIR
     (produzir − o que já está em OPs abertas do mesmo produto, de pedido ou não), então clicar de novo não duplica. A observação
     da OP começa com [Necessidade] e essas OPs NÃO entram na demanda avulsa (senão a conta dobraria: demanda + oferta).
   - Fora a geração de OP, só LÊ: nada é gravado no Omie nem no banco. Custo/valor só para quem tem almoxarifado.ver_custo.
   ============================================================ */

const NEC_MARCA = '[Necessidade]';
const NEC_STATUS = {
  atrasado: { label: 'Não chega a tempo', variant: 'danger' },
  comprar: { label: 'Comprar', variant: 'warning' },
  sem_data: { label: 'Sem data de entrega', variant: 'info' },
  coberto: { label: 'Coberto', variant: 'success' },
};
const PREV_DIAS_MAX = 120;
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
  const [incluiPrev, setIncluiPrev] = React.useState(true);
  const [filtro, setFiltro] = React.useState('agir');       // agir | atrasado | comprar | todos
  const [busca, setBusca] = React.useState('');
  const [sel, setSel] = React.useState(() => new Set());
  const [podeOp, setPodeOp] = React.useState(false);
  const [selOp, setSelOp] = React.useState(() => new Set());
  const [gerando, setGerando] = React.useState(false);
  const [comprando, setComprando] = React.useState(null);          // itens do modal "Enviar compra ao Omie" (compra-pcp.jsx)
  const [reqs, recarregarReqs] = window.usePcpRequisicoesRecentes();

  React.useEffect(() => {
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setCustoOk(!!v)).catch(() => {});
    Promise.resolve(window.PropostaStore?.temCapacidade?.('pcp', 'criar')).then(v => setPodeOp(!!v)).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase não carregou.'); return; }
    try {
      const campos = 'codigo, descricao, unidade' + (custoOk ? ', preco_custo, custo_manual' : '');
      const [cfg, pedidos, acomp, itens, ordens, estr, prods, pos, est, prevPed, prevItens] = await Promise.all([
        sb.from('pcp_reposicao_config').select('*').eq('id', true).maybeSingle(),
        necLerTudo(() => sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido, etapa, cliente_nome, cliente_fantasia, data_previsao').eq('faturado', false).eq('cancelado', false).order('codigo_pedido')),
        necLerTudo(() => sb.from('pcp_pedido_acompanhamento').select('numero_pedido, historico').order('numero_pedido')),
        necLerTudo(() => sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, quantidade').eq('item_pcp', true).order('id')),
        necLerTudo(() => sb.from('pcp_ordens').select('id, numero, produto, quantidade, qtd_produzida, status, prazo_entrega, pedido_codigo, ordem_mae_id, cliente, observacao').not('status', 'in', '(concluida,cancelada)').order('created_at')),
        necLerTudo(() => sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').order('id')),
        necLerTudo(() => sb.from('pcp_produtos').select(campos).order('codigo')),
        necLerTudo(() => sb.from('pcp_posicao_compra').select('codigo, fisico, pendente').order('codigo')),
        necLerTudo(() => sb.from('pcp_estoque').select('codigo, quantidade').order('codigo')),
        necLerTudo(() => sb.from('pcp_previsao_pedidos').select('codigo_pedido, numero_pedido, cliente_nome, cliente_fantasia, data_pedido, data_previsao').order('codigo_pedido')),
        necLerTudo(() => sb.from('pcp_previsao_itens').select('codigo_pedido, codigo, quantidade').order('id')),
      ]);
      if (cfg.error) throw cfg.error;
      setD({ cfg: cfg.data, pedidos, historico: new Set(acomp.filter(a => a.historico).map(a => a.numero_pedido)), itens, ordens, estr, prods, pos, est, prevPed, prevItens });
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
        if (!o.produto || raizDePedido(o) || String(o.observacao || '').startsWith(NEC_MARCA)) return;
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
    // Previsão (etapa 10): só pedidos que ainda não estão em pcp_pedidos e que não estão parados há muito tempo.
    const conhecidos = new Set(d.pedidos.map(p => p.numero_pedido));
    const limite = new Date(Date.now() - PREV_DIAS_MAX * 86400000).toISOString().slice(0, 10);
    const prevOk = d.prevPed.filter(p => !conhecidos.has(p.numero_pedido) && !d.historico.has(p.numero_pedido) && (p.data_pedido || '9999') >= limite);
    const prevIgnorados = d.prevPed.length - prevOk.length;
    const prevPorCod = new Map(prevOk.map(p => [p.codigo_pedido, p]));
    const demandaPrev = [];
    d.prevItens.forEach(i => {
      const p = prevPorCod.get(i.codigo_pedido);
      if (p && Number(i.quantidade) > 0) demandaPrev.push({ codigo: i.codigo, qtd: Number(i.quantidade), ref: `Previsão ${p.numero_pedido}`, previsao: p.data_previsao || null });
    });
    const rPrev = incluiPrev && demandaPrev.length ? window.PcpNecessidade.calcular({ demanda: demanda.concat(demandaPrev), filhos, estoque, hoje, cfg: d.cfg }) : null;
    const firmeFalta = new Map(r.comprados.map(l => [l.codigo, l.falta]));
    const mostra = rPrev || r;
    const prod = Object.fromEntries(d.prods.map(p => [p.codigo, p]));
    const comCusto = (l) => { const p = prod[l.codigo]; const c = custoOk && p ? rpCustoEfetivo(p) : null; return { ...l, p, custo: c, valor: c > 0 ? l.falta * c : null }; };
    const comPrev = (l) => ({ ...comCusto(l), soPrevisao: !!rPrev && l.falta > 1e-9 && !((firmeFalta.get(l.codigo) || 0) > 1e-9) });
    const emOp = {};                                                     // OPs abertas por produto (pedido, avulsa ou da Necessidade)
    d.ordens.forEach(o => {
      if (!o.produto) return;
      const q = Math.max(0, Number(o.quantidade || 0) - Number(o.qtd_produzida || 0));
      const e = (emOp[o.produto] = emOp[o.produto] || { qtd: 0, nums: [] });
      e.qtd += q; e.nums.push(o.numero);
    });
    const fabr = mostra.fabricados.map(l => {
      const e = emOp[l.codigo] || { qtd: 0, nums: [] };
      return { ...l, p: prod[l.codigo], emOp: e.qtd, opNums: e.nums, abrir: Math.max(0, l.produzir - e.qtd) };
    });
    return { abertos, nOrdens, nItens: demanda.length, ciclos: r.ciclos, firmes: r.comprados.map(comCusto), comprados: mostra.comprados.map(comPrev), fabricados: fabr, prevOk, prevIgnorados, nPrev: demandaPrev.length };
  }, [d, incluiPropostas, incluiOrdens, incluiPrev, custoOk]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d || !res) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const faltam = res.comprados.filter(l => l.falta > 1e-9);
  const atrasados = res.comprados.filter(l => l.status === 'atrasado');
  const faltamFirmes = res.firmes.filter(l => l.falta > 1e-9);       // cartões = carteira firme (previsão não conta)
  const atrasadosFirmes = res.firmes.filter(l => l.status === 'atrasado');
  const soPrev = faltam.filter(l => l.soPrevisao).length;
  const valorFalta = faltamFirmes.reduce((s, l) => s + (l.valor || 0), 0);
  const semCusto = faltamFirmes.filter(l => custoOk && !(l.custo > 0)).length;
  const q = busca.trim().toLowerCase();
  const lista = res.comprados
    .filter(l => filtro === 'todos' ? true : filtro === 'agir' ? l.falta > 1e-9 : l.status === filtro)
    .filter(l => !q || (l.codigo + ' ' + (l.p?.descricao || '') + ' ' + l.refs.join(' ')).toLowerCase().includes(q));
  const btn = (a) => 'btn btn--sm' + (a ? ' btn--primary' : '');
  const refsTxt = (refs) => refs.length > 3 ? `${refs.slice(0, 3).join(', ')} +${refs.length - 3}` : refs.join(', ');
  // Compra ao Omie: só o que está marcado E falta (a tabela "A produzir" não entra: fabricado não se compra).
  const compraSel = lista.filter(l => sel.has(l.codigo) && l.falta > 1e-9);
  const alternar = (cod) => setSel(prev => { const n = new Set(prev); if (n.has(cod)) n.delete(cod); else n.add(cod); return n; });
  const faltantesLista = lista.filter(l => l.falta > 1e-9);
  const todosMarcados = faltantesLista.length > 0 && faltantesLista.every(l => sel.has(l.codigo));
  const marcarTodos = () => setSel(prev => { const n = new Set(prev); if (todosMarcados) faltantesLista.forEach(l => n.delete(l.codigo)); else faltantesLista.forEach(l => n.add(l.codigo)); return n; });
  const fabrAbrir = res.fabricados.filter(l => l.abrir > 1e-9);
  const opSel = fabrAbrir.filter(l => selOp.has(l.codigo));
  const alternarOp = (cod) => setSelOp(prev => { const n = new Set(prev); if (n.has(cod)) n.delete(cod); else n.add(cod); return n; });
  const todosOp = fabrAbrir.length > 0 && fabrAbrir.every(l => selOp.has(l.codigo));
  const gerarOps = async () => {
    if (!opSel.length || gerando) return;
    const txt = opSel.map(l => `${l.codigo} × ${necFmt(Math.ceil(l.abrir))}`).join('\n');
    if (!window.confirm(`Criar ${opSel.length} ordem(ns) de produção?\n\n${txt}\n\nNada é enviado ao Omie.`)) return;
    setGerando(true);
    const quem = (window.__VP_USER && window.__VP_USER.email) || null;
    const feitas = []; let falha = null;
    try {
      const { data: modelo } = await sb.from('pcp_etapas_modelo').select('posicao, nome, setor').eq('ativo', true).order('posicao');
      const filhos = {}; d.estr.forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const explode = (raiz, mult, acc, pilha) => {
        (filhos[raiz] || []).forEach(f => {
          if (pilha.includes(f.codigo_filho)) return;
          const q = Number(f.quantidade || 0) * mult * (1 + Number(f.perda_pct || 0) / 100);
          if ((filhos[f.codigo_filho] || []).length) explode(f.codigo_filho, q, acc, pilha.concat(f.codigo_filho)); else acc[f.codigo_filho] = (acc[f.codigo_filho] || 0) + q;
        });
        return acc;
      };
      const prodMap = Object.fromEntries(d.prods.map(p => [p.codigo, p]));
      for (const l of opSel) {
        const qtd = Math.ceil(l.abrir);
        const { data: op, error } = await sb.from('pcp_ordens').insert({
          produto: l.codigo, quantidade: qtd, prazo_entrega: l.previsao || null, criado_por: quem,
          observacao: `${NEC_MARCA} ${refsTxt(l.refs)}`.slice(0, 300),
        }).select('id, numero').single();
        if (error || !op) { falha = error?.message || 'sem permissão'; break; }
        const mats = explode(l.codigo, 1, {}, [l.codigo]);
        const linhas = Object.keys(mats).sort().map(c => ({ ordem_id: op.id, codigo: c, descricao: prodMap[c]?.descricao || null, unidade: prodMap[c]?.unidade || null, quantidade_unit: mats[c], necessario: mats[c] * qtd }));
        if (linhas.length) { const r = await sb.from('pcp_ordem_materiais').insert(linhas); if (r.error) { falha = r.error.message; break; } }
        const etapas = (modelo || []).map(m => ({ ordem_id: op.id, posicao: m.posicao, nome: m.nome, setor: m.setor }));
        if (etapas.length) { const r = await sb.from('pcp_ordem_etapas').insert(etapas); if (r.error) { falha = r.error.message; break; } }
        window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Abriu OP pela Necessidade', alvo: `${op.numero} — ${l.codigo} × ${qtd}` });
        feitas.push(op.numero);
      }
    } catch (e) { falha = e.message || String(e); }
    setGerando(false);
    if (feitas.length) { setSelOp(new Set()); await carregar(); }
    window.toast?.(falha ? `${feitas.length} OP(s) criada(s); parou: ${falha}` : `${feitas.length} OP(s) criada(s): ${feitas.join(', ')}.`);
  };
  const abrirCompra = () => setComprando(compraSel.map(l => ({
    codigo: l.codigo, descricao: l.p?.descricao, unidade: l.p?.unidade, quantidade: Math.ceil(l.falta * 100) / 100,
    obs: `Necessidade: ${refsTxt(l.refs)} · entrega ${necData(l.previsao)}`.slice(0, 190),
  })));

  return (
    <div>
      {comprando && <PcpModalCompra itens={comprando} requisicoes={reqs} onClose={() => setComprando(null)} onEnviado={recarregarReqs}/>}
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Carteira considerada</div><div className="pcp-total__v">{res.abertos.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>pedido(s){res.nOrdens ? ` + ${res.nOrdens} ordem(ns) avulsa(s)` : ''} · {res.nItens} linha(s)</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Materiais em falta</div><div className="pcp-total__v">{faltamFirmes.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>para atender a carteira{soPrev ? ` · +${soPrev} só pela previsão` : ''}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Não chegam a tempo</div><div className="pcp-total__v" style={{ color: atrasadosFirmes.length ? 'var(--vp-danger)' : undefined }}>{atrasadosFirmes.length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>mesmo comprando hoje</div></div>
        <div className="pcp-total"><div className="pcp-total__l">{custoOk ? 'Valor do que falta' : 'Itens a produzir'}</div><div className="pcp-total__v">{custoOk ? necMoeda(valorFalta) : res.fabricados.filter(l => l.produzir > 0).length}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{custoOk ? (semCusto ? `${semCusto} sem custo` : 'custo efetivo') : 'quadros / corrimões / kits'}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(filtro === 'agir')} onClick={() => setFiltro('agir')}>Em falta ({faltam.length})</button>
        <button className={btn(filtro === 'atrasado')} onClick={() => setFiltro('atrasado')}>Não chegam a tempo ({atrasados.length})</button>
        <button className={btn(filtro === 'comprar')} onClick={() => setFiltro('comprar')}>Comprar ({res.comprados.filter(l => l.status === 'comprar').length})</button>
        <button className={btn(filtro === 'todos')} onClick={() => setFiltro('todos')}>Todos ({res.comprados.length})</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}><input type="checkbox" checked={incluiPropostas} onChange={e => setIncluiPropostas(e.target.checked)}/>incluir propostas (etapa 00)</label>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }} title="Pedidos em etapa 10 no Omie: ainda não são venda firme. Só aparecem aqui como aviso, com o selo Previsão."><input type="checkbox" checked={incluiPrev} onChange={e => setIncluiPrev(e.target.checked)}/>incluir previsão (etapa 10: {res.prevOk.length})</label>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={incluiOrdens} onChange={e => setIncluiOrdens(e.target.checked)}/>incluir ordens avulsas</label>
        <input className="input" style={{ minWidth: 200, marginLeft: 'auto' }} placeholder="Buscar item ou pedido…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!compraSel.length} title="Marque os itens em falta na tabela. Mostra uma simulação antes de enviar; nada vai ao Omie sem confirmação." onClick={abrirCompra}>Enviar compra ao Omie ({compraSel.length})</button>
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
              <th style={{ width: 28 }}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} title="Marcar todos os itens em falta da lista"/></th><th>Item</th><th>Situação</th><th style={{ textAlign: 'right' }}>Necessário</th><th style={{ textAlign: 'right' }}>Em mãos</th><th style={{ textAlign: 'right' }}>A caminho</th>
              <th style={{ textAlign: 'right' }}>Falta</th><th style={{ textAlign: 'right' }}>Prazo</th><th>Entrega mais cedo</th><th>Comprar até</th><th>Pedidos</th>{custoOk && <th style={{ textAlign: 'right' }}>Valor</th>}
            </tr></thead>
            <tbody>
              {lista.slice(0, 400).map(l => {
                const st = NEC_STATUS[l.status];
                return (
                  <tr key={l.codigo}>
                    <td>{l.falta > 1e-9 ? <input type="checkbox" checked={sel.has(l.codigo)} onChange={() => alternar(l.codigo)}/> : null}</td>
                    <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.p?.descricao}</div></td>
                    <td><Badge variant={st.variant}>{st.label}</Badge>{l.soPrevisao ? <> <Badge variant="info">Previsão</Badge></> : null}{l.status === 'atrasado' ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{l.prazo - l.diasAtePrevisao} dia(s) de atraso</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{necFmt(l.necessario)} {l.p?.unidade || ''}</td>
                    <td style={{ textAlign: 'right' }}>{necFmt(l.fisico)}</td>
                    <td style={{ textAlign: 'right' }}>{l.aCaminho ? necFmt(l.aCaminho) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.falta > 1e-9 ? necFmt(Math.ceil(l.falta * 100) / 100) : '—'}<PcpTagRequisicao lista={reqs[l.codigo]}/></td>
                    <td style={{ textAlign: 'right' }}>{l.prazo}d{l.nacional ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>nacional</div> : null}</td>
                    <td>{necData(l.previsao)}</td>
                    <td style={{ color: l.status === 'atrasado' ? 'var(--vp-danger)' : undefined }}>{l.falta > 1e-9 ? (l.comprarAte ? necData(l.comprarAte) : '—') : '—'}</td>
                    <td style={{ fontSize: 11, maxWidth: 200 }}>{refsTxt(l.refs)}</td>
                    {custoOk && <td style={{ textAlign: 'right' }}>{l.falta > 1e-9 ? (l.valor != null ? necMoeda(l.valor) : <span title="Sem custo cadastrado">⚠</span>) : '—'}</td>}
                  </tr>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={custoOk ? 12 : 11} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 12 }}/>
      <Card title="A produzir (itens fabricados)" sub="Quadros, corrimões e kits com estrutura: o que falta fabricar depois de abater o estoque acabado e as OPs já abertas">
        <div style={{ display: 'flex', gap: 8, padding: '0 0 8px', alignItems: 'center' }}>
          <button className="btn btn--sm" disabled={!opSel.length || gerando || !podeOp} title={podeOp ? 'Marque os itens e crie as ordens de produção. Nada é enviado ao Omie.' : 'Sem a alçada PCP › Criar'} onClick={gerarOps}>{gerando ? 'Criando…' : `Gerar OP (${opSel.length})`}</button>
          <span style={{ fontSize: 11, color: 'var(--fg3)' }}>A quantidade da OP é o que falta abrir; OPs já abertas do mesmo produto são descontadas.</span>
        </div>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th style={{ width: 28 }}><input type="checkbox" checked={todosOp} onChange={() => setSelOp(todosOp ? new Set() : new Set(fabrAbrir.map(l => l.codigo)))} title="Marcar todos os itens sem OP"/></th><th>Item</th><th style={{ textAlign: 'right' }}>Necessário</th><th style={{ textAlign: 'right' }}>Em estoque</th><th style={{ textAlign: 'right' }}>Produzir</th><th>OP aberta</th><th>Entrega mais cedo</th><th>Pedidos</th></tr></thead>
            <tbody>
              {res.fabricados.map(l => (
                <tr key={l.codigo}>
                  <td>{l.abrir > 1e-9 ? <input type="checkbox" checked={selOp.has(l.codigo)} onChange={() => alternarOp(l.codigo)}/> : null}</td>
                  <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.p?.descricao}</div></td>
                  <td style={{ textAlign: 'right' }}>{necFmt(l.necessario)} {l.p?.unidade || ''}</td>
                  <td style={{ textAlign: 'right' }}>{necFmt(l.fisico)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.produzir > 1e-9 ? necFmt(l.produzir) : <span style={{ fontWeight: 400, color: 'var(--fg3)' }}>coberto pelo estoque</span>}</td>
                  <td style={{ fontSize: 11 }}>{l.emOp > 1e-9 ? <>{necFmt(l.emOp)} em {l.opNums.slice(0, 3).join(', ')}{l.opNums.length > 3 ? ` +${l.opNums.length - 3}` : ''}{l.abrir <= 1e-9 && l.produzir > 1e-9 ? <> <Badge variant="success">com OP</Badge></> : null}</> : '—'}</td>
                  <td>{necData(l.previsao)}</td>
                  <td style={{ fontSize: 11, maxWidth: 220 }}>{refsTxt(l.refs)}</td>
                </tr>
              ))}
              {res.fabricados.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item fabricado na carteira.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {(res.abertos.length > 0 || res.prevOk.length > 0) && (
        <>
          <div style={{ height: 12 }}/>
          <Card title="Pedidos considerados" sub={`${res.abertos.length} pedido(s) abertos, não faturados${res.prevOk.length ? ` · ${res.prevOk.length} em previsão (etapa 10)` : ''}${res.prevIgnorados ? ` · ${res.prevIgnorados} da etapa 10 ignorado(s) por antigo(s) (> ${PREV_DIAS_MAX} dias)` : ''}`}>
            <div className="table-wrap">
              <table className="t pcp-grid">
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Etapa</th><th>Previsão de entrega</th></tr></thead>
                <tbody>{res.abertos.map(p => (
                  <tr key={p.codigo_pedido}><td>{p.numero_pedido}</td><td>{p.cliente_fantasia || p.cliente_nome}</td><td>{p.etapa}</td><td>{necData(p.data_previsao)}</td></tr>
                ))}
                {incluiPrev && res.prevOk.map(p => (
                  <tr key={'p' + p.codigo_pedido}><td>{p.numero_pedido}</td><td>{p.cliente_fantasia || p.cliente_nome}</td><td>10 <Badge variant="info">Previsão</Badge></td><td>{necData(p.data_previsao)}</td></tr>
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
