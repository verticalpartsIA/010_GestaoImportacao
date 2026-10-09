/* ============================================================
   montagem-produto.jsx — Logística Interna · Montagem do Produto (Estrutura + Custo).
   Escolhe-se o produto (ex.: quadro de comando): a estrutura (BOM) de pcp_estrutura
   é carregada, cada item herda o custo de pcp_produtos.preco_custo (cadastro do Omie)
   e o custo total do produto é a soma. É possível inserir itens extras — ficam só no PCP
   (origem 'pcp'); linhas vindas do Omie são somente leitura aqui (edição em Almoxarifado › Estrutura).
   Custos só aparecem a quem tem a alçada almoxarifado.ver_custo (senão, borrados).
   ============================================================ */

function mpFmt(v, d = 3) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function mpMoeda(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Custo unitário de um código: folha = preco_custo; subconjunto = soma dos filhos (com perda).
function mpCustoUnit(codigo, filhos, prods, pilha = []) {
  const sub = filhos[codigo] || [];
  if (!sub.length) return { valor: Number(prods[codigo]?.preco_custo || 0), semCusto: !(Number(prods[codigo]?.preco_custo) > 0) };
  let valor = 0, semCusto = false;
  sub.forEach(f => {
    if (pilha.includes(f.codigo_filho)) return;
    const c = mpCustoUnit(f.codigo_filho, filhos, prods, [...pilha, codigo]);
    valor += Number(f.quantidade || 0) * (1 + Number(f.perda_pct || 0) / 100) * c.valor;
    if (c.semCusto) semCusto = true;
  });
  return { valor, semCusto };
}

function MPNo({ linha, codigo, qtd, nivel, ctx, caminho }) {
  const { filhos, prods, abertos, alternar, verCusto, podeEditar, editarQtd, remover, irParaItem } = ctx;
  const sub = filhos[codigo] || [];
  const chave = caminho + '/' + codigo;
  const aberto = abertos.has(chave);
  const custo = mpCustoUnit(codigo, filhos, prods);
  const subtotal = custo.valor * Number(qtd || 0) * (1 + Number(linha?.perda_pct || 0) / 100);
  const borrado = verCusto ? undefined : { filter: 'blur(6px)', userSelect: 'none' };
  const editavel = podeEditar && linha && linha.origem === 'pcp';
  return (
    <>
      <tr>
        <td style={{ paddingLeft: 8 + nivel * 20, whiteSpace: 'nowrap' }}>
          {sub.length > 0
            ? <button className="btn btn--sm" style={{ marginRight: 6, padding: '0 6px' }} onClick={() => alternar(chave)}>{aberto ? '−' : '+'}</button>
            : <span style={{ display: 'inline-block', width: 30 }}/>}
          {nivel === 0 ? <b style={{ fontWeight: 500 }}>{codigo}</b>
            : <button className="pcp-cod" title="Abrir no cadastro" onClick={() => irParaItem(codigo)}>{codigo}</button>}
        </td>
        <td>{prods[codigo]?.descricao || '—'}</td>
        <td className="text-right">
          {editavel
            ? <input className="input" type="number" min="0" step="any" defaultValue={linha.quantidade} style={{ width: 80 }}
                onBlur={e => { if (Number(e.target.value) !== Number(linha.quantidade)) editarQtd(linha, e.target.value); }}/>
            : (qtd != null ? mpFmt(qtd) : '—')}
        </td>
        <td>{prods[codigo]?.unidade || '—'}</td>
        <td><span className={'pcp-tag' + (linha && linha.origem === 'pcp' ? ' pcp-tag--pcp' : '')}>{linha ? (linha.origem === 'pcp' ? 'Só no PCP' : 'Omie') : 'Produto'}</span></td>
        <td className="text-right" style={borrado} title={verCusto ? '' : 'Sem permissão para ver custos'}>
          {verCusto ? (custo.semCusto ? <span title="Sem custo cadastrado" style={{ color: 'var(--vp-danger)' }}>{mpMoeda(custo.valor)} *</span> : mpMoeda(custo.valor)) : 'R$ 00,00'}
        </td>
        <td className="text-right" style={borrado}><b>{verCusto ? mpMoeda(subtotal) : 'R$ 00,00'}</b></td>
        <td>{editavel && <button className="btn btn--sm" onClick={() => remover(linha)}>Remover</button>}</td>
      </tr>
      {aberto && nivel < 12 && sub.map(f => (
        <MPNo key={f.id} linha={f} codigo={f.codigo_filho} qtd={f.quantidade} nivel={nivel + 1} ctx={ctx} caminho={chave}/>
      ))}
    </>
  );
}

function MontagemProdutoPage({ setRoute, setSubsel }) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  // Produto escolhido vive na URL: /logistica/montagem-produto/{código} (rota-pcp.js). O sessionStorage 'vp_pcp_pai'
  // continua só como porta de entrada vinda de OUTRAS telas (OP, Simulação, Cadastros): no mount vira URL e é descartado.
  const [pai, setPai] = window.useRotaId('montagem-produto');
  React.useEffect(() => {
    try { const v = sessionStorage.getItem('vp_pcp_pai') || ''; sessionStorage.removeItem('vp_pcp_pai'); if (v && !pai) setPai(v); } catch (e) { /* ok */ }
  }, []);
  const [abertos, setAbertos] = React.useState(new Set());
  const [verCusto, setVerCusto] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);
  const [novoCod, setNovoCod] = React.useState('');
  const [novoQtd, setNovoQtd] = React.useState(1);
  const sb = window.__VP_SB && window.__VP_SB.sb;

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [e, p] = await Promise.all([
      sb.from('pcp_estrutura').select('id, codigo_pai, codigo_filho, quantidade, perda_pct, origem').limit(5000),
      sb.from('pcp_produtos').select('codigo, descricao, unidade, preco_custo, tipo_sped').eq('ativo', true).limit(5000),
    ]);
    const err = e.error || p.error;
    if (err) { setErro(err.message); return; }
    const filhos = {};
    (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
    const prods = {};
    (p.data || []).forEach(l => { prods[l.codigo] = l; });
    setErro(null); setDados({ filhos, prods });
  }, [sb]);

  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => { if (vivo) setVerCusto(!!v); }).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('montagem-produto', 'editar')).then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const pais = React.useMemo(() => dados ? Object.keys(dados.filhos).sort() : [], [dados]);
  const alternar = (chave) => setAbertos(a => { const n = new Set(a); n.has(chave) ? n.delete(chave) : n.add(chave); return n; });

  const adicionar = async () => {
    const cod = novoCod.trim();
    const q = Number(novoQtd);
    if (!dados.prods[cod]) { window.toast?.('Escolha um item existente no cadastro (código da lista).'); return; }
    if (cod === pai) { window.toast?.('Um produto não pode conter ele mesmo.'); return; }
    if (!(q > 0)) { window.toast?.('Informe uma quantidade maior que zero.'); return; }
    if ((dados.filhos[pai] || []).some(l => l.codigo_filho === cod)) { window.toast?.('Esse item já está na estrutura.'); return; }
    const { data, error } = await sb.from('pcp_estrutura')
      .insert({ codigo_pai: pai, codigo_filho: cod, quantidade: q, origem: 'pcp' }).select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível adicionar: ' + (error?.message || 'sem permissão')); return; }
    window.VPLog?.registrar?.({ modulo: 'Montagem do Produto', acao: 'Adicionou item à estrutura', alvo: `${pai} ← ${cod} (${q})` });
    setNovoCod(''); setNovoQtd(1);
    await carregar();
  };
  const editarQtd = async (linha, valor) => {
    const q = Number(valor);
    if (!(q > 0)) { window.toast?.('Quantidade inválida.'); await carregar(); return; }
    const { data, error } = await sb.from('pcp_estrutura').update({ quantidade: q }).eq('id', linha.id).eq('origem', 'pcp').select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível alterar.'); }
    else window.VPLog?.registrar?.({ modulo: 'Montagem do Produto', acao: 'Alterou quantidade', alvo: `${linha.codigo_pai} ← ${linha.codigo_filho} (${q})` });
    await carregar();
  };
  const remover = async (linha) => {
    if (!window.confirm(`Remover ${linha.codigo_filho} da estrutura?`)) return;
    const { data, error } = await sb.from('pcp_estrutura').delete().eq('id', linha.id).eq('origem', 'pcp').select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível remover.'); return; }
    window.VPLog?.registrar?.({ modulo: 'Montagem do Produto', acao: 'Removeu item da estrutura', alvo: `${linha.codigo_pai} ← ${linha.codigo_filho}` });
    await carregar();
  };

  const custoTotal = dados && pai ? mpCustoUnit(pai, dados.filhos, dados.prods) : null;
  const irParaItem = (codigo) => {
    const mp = dados.prods[codigo]?.tipo_sped === '01';
    window.pcpIrPara?.({ setRoute, setSubsel }, mp ? 'cadastro-materias-primas' : 'cadastro-produtos', 'vp_pcp_busca', codigo);
  };
  const ctx = dados && { filhos: dados.filhos, prods: dados.prods, abertos: new Set([...abertos, '/' + pai]), alternar, verCusto, podeEditar, editarQtd, remover, irParaItem };
  const itensSelecionaveis = dados ? Object.keys(dados.prods).sort() : [];

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Montagem do Produto</div>
          <h1 className="page-head__title">Montagem do Produto (Estrutura e Custo)</h1>
          <p className="page-head__sub">Escolha o produto: a estrutura é carregada, cada item herda seu custo e o total é somado. Itens inseridos aqui ficam só no PCP.</p>
        </div>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {!erro && !dados && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {dados && (<>
        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={pai} onChange={e => { setPai(e.target.value); setAbertos(new Set()); }} style={{ minWidth: 340 }}>
            <option value="">Selecione o produto…</option>
            {pais.map(c => <option key={c} value={c}>{c} — {dados.prods[c]?.descricao || ''}</option>)}
          </select>
        </div>
        {!pai && <div style={{ padding: 24, color: 'var(--fg3)' }}>Escolha um produto para ver a estrutura.</div>}
        {pai && (<>
          <div className="card pcp-total" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 12, color: 'var(--fg3)' }}>Custo total do produto (1 un.)</div>
              <div style={{ fontSize: 22, fontWeight: 700, ...(verCusto ? {} : { filter: 'blur(8px)', userSelect: 'none' }) }}>
                {verCusto ? mpMoeda(custoTotal.valor) : 'R$ 00.000,00'}
              </div></div>
            {verCusto && custoTotal.semCusto && <div style={{ fontSize: 12, color: 'var(--vp-danger)' }}>* Há itens sem custo cadastrado — o total está incompleto.</div>}
            {!verCusto && <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Sem permissão para ver custos.</div>}
          </div>
          <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table className="t pcp-grid">
              <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd</th><th>Un.</th><th>Origem</th><th className="text-right">Custo unit.</th><th className="text-right">Subtotal</th><th></th></tr></thead>
              <tbody>
                <MPNo linha={null} codigo={pai} qtd={1} nivel={0} ctx={ctx} caminho=""/>
              </tbody>
            </table>
          </div>
          {podeEditar && (
            <div className="card pcp-toolbar" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <b style={{ fontSize: 13 }}>Inserir item:</b>
              <input className="input" list="mp-itens" placeholder="Código do item…" value={novoCod} onChange={e => setNovoCod(e.target.value)} style={{ width: 180 }}/>
              <datalist id="mp-itens">
                {itensSelecionaveis.map(c => <option key={c} value={c}>{dados.prods[c]?.descricao}</option>)}
              </datalist>
              <input className="input" type="number" min="0" step="any" value={novoQtd} onChange={e => setNovoQtd(e.target.value)} style={{ width: 90 }}/>
              <button className="btn btn--sm btn--primary" onClick={adicionar}>Adicionar</button>
              <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Fica só no PCP; não é enviado ao Omie.</span>
            </div>
          )}
        </>)}
      </>)}
    </div>
  );
}

Object.assign(window, { MontagemProdutoPage });
