/* ============================================================
   simulacao-producao.jsx — Logística Interna · Simulação de Produção.
   Escolhe-se o produto e a quantidade a produzir: a tela mostra, lado a lado, o que
   1 unidade consome e o que N unidades consomem (materiais, custo da matéria-prima)
   e compara com o estoque do Almoxarifado (o que falta comprar).
   Somente leitura: parte da estrutura de pcp_estrutura (edição em Montagem do Produto).
   Custos só aparecem a quem tem a alçada almoxarifado.ver_custo (senão, borrados).
   ============================================================ */

function spFmt(v, d = 3) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function spMoeda(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Explode a estrutura até os materiais folha (quantidade por 1 unidade, já com perda). Protege contra ciclo.
function spExplodir(raiz, filhos, mult, acc, pilha) {
  (filhos[raiz] || []).forEach(f => {
    if (pilha.includes(f.codigo_filho)) return;
    const q = Number(f.quantidade || 0) * mult * (1 + Number(f.perda_pct || 0) / 100);
    if ((filhos[f.codigo_filho] || []).length) spExplodir(f.codigo_filho, filhos, q, acc, [...pilha, f.codigo_filho]);
    else acc[f.codigo_filho] = (acc[f.codigo_filho] || 0) + q;
  });
  return acc;
}

function SimulacaoProducaoPage({ setRoute, setSubsel }) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [produto, setProduto] = React.useState('');
  const [qtd, setQtd] = React.useState(5);
  const [verCusto, setVerCusto] = React.useState(false);
  const sb = window.__VP_SB && window.__VP_SB.sb;

  React.useEffect(() => {
    let vivo = true;
    if (!sb) { setErro('Supabase indisponível.'); return; }
    Promise.all([
      sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').limit(5000),
      sb.from('pcp_produtos').select('codigo, descricao, unidade, preco_custo, tipo_sped').eq('ativo', true).limit(5000),
      sb.from('pcp_estoque').select('codigo, quantidade').limit(10000),
    ]).then(([e, p, s]) => {
      if (!vivo) return;
      const err = e.error || p.error || s.error;
      if (err) { setErro(err.message); return; }
      const filhos = {};
      (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const prods = {};
      (p.data || []).forEach(l => { prods[l.codigo] = l; });
      const estoque = {};
      (s.data || []).forEach(l => { estoque[l.codigo] = (estoque[l.codigo] || 0) + Number(l.quantidade || 0); });
      setDados({ filhos, prods, estoque });
    });
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'ver_custo'))
      .then(v => { if (vivo) setVerCusto(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, [sb]);

  const pais = React.useMemo(() => dados ? Object.keys(dados.filhos).sort() : [], [dados]);
  const n = Math.max(1, Number(qtd) || 1);

  const linhas = React.useMemo(() => {
    if (!dados || !produto) return [];
    const porUn = spExplodir(produto, dados.filhos, 1, {}, [produto]);
    return Object.keys(porUn).sort().map(c => {
      const custoUn = Number(dados.prods[c]?.preco_custo || 0);
      const total = porUn[c] * n;
      const estoque = dados.estoque[c] || 0;
      return { codigo: c, porUn: porUn[c], total, custoUn, custoTotal: total * custoUn, estoque, falta: Math.max(0, total - estoque), semCusto: !(custoUn > 0) };
    });
  }, [dados, produto, n]);

  const custo1 = linhas.reduce((s, l) => s + l.porUn * l.custoUn, 0);
  const custoN = linhas.reduce((s, l) => s + l.custoTotal, 0);
  const semCusto = linhas.some(l => l.semCusto);
  const faltas = linhas.filter(l => l.falta > 0).length;
  const borrado = verCusto ? undefined : { filter: 'blur(7px)', userSelect: 'none' };
  const irParaItem = (codigo) => {
    const mp = dados.prods[codigo]?.tipo_sped === '01';
    window.pcpIrPara?.({ setRoute, setSubsel }, mp ? 'cadastro-materias-primas' : 'cadastro-produtos', 'vp_pcp_busca', codigo);
  };

  const cartao = (rotulo, sub, valor) => (
    <div className="card pcp-total" style={{ padding: 14, flex: '1 1 260px' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rotulo}</div>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 6 }}>{sub}</div>
      <div style={{ fontSize: 22, fontWeight: 500, ...borrado }}>{verCusto ? spMoeda(valor) : 'R$ 00.000,00'}</div>
      <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Custo da matéria-prima</div>
    </div>
  );

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Simulação</div>
          <h1 className="page-head__title">Simulação de Produção</h1>
          <p className="page-head__sub">Escolha o produto e a quantidade: veja o que consome, quanto custa a matéria-prima e o que falta no estoque.</p>
        </div>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {!erro && !dados && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {dados && (<>
        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={produto} onChange={e => setProduto(e.target.value)} style={{ minWidth: 340 }}>
            <option value="">Selecione o produto…</option>
            {pais.map(c => <option key={c} value={c}>{c} — {dados.prods[c]?.descricao || ''}</option>)}
          </select>
          <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Produzir&nbsp;
            <input className="input" type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} style={{ width: 90 }}/> un.
          </label>
        </div>
        {!produto && <div style={{ padding: 24, color: 'var(--fg3)' }}>Escolha um produto para simular.</div>}
        {produto && (<>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {cartao('Produto padrão', '1 unidade', custo1)}
            {cartao('Simulação', `${spFmt(n, 0)} unidades`, custoN)}
          </div>
          <div style={{ fontSize: 12, margin: '0 0 8px', color: faltas > 0 ? 'var(--vp-danger)' : 'var(--fg3)' }}>
            {faltas > 0 ? `${faltas} material(is) com falta no estoque para produzir ${spFmt(n, 0)} un.` : 'Estoque suficiente para esta produção.'}
            {verCusto && semCusto && <span style={{ color: 'var(--vp-danger)' }}> · Há itens sem custo cadastrado — o custo está incompleto.</span>}
          </div>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr>
                <th>Material</th><th>Descrição</th><th className="text-right">Qtd (1 un.)</th><th className="text-right">Qtd ({spFmt(n, 0)} un.)</th>
                <th>Un.</th><th className="text-right">Custo ({spFmt(n, 0)} un.)</th><th className="text-right">Em estoque</th><th className="text-right">Falta</th>
              </tr></thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.codigo}>
                    <td><button className="pcp-cod" title="Abrir no cadastro" onClick={() => irParaItem(l.codigo)}>{l.codigo}</button></td>
                    <td>{dados.prods[l.codigo]?.descricao || '—'}</td>
                    <td className="text-right">{spFmt(l.porUn)}</td>
                    <td className="text-right"><b style={{ fontWeight: 500 }}>{spFmt(l.total)}</b></td>
                    <td>{dados.prods[l.codigo]?.unidade || '—'}</td>
                    <td className="text-right" style={borrado}>{verCusto ? (l.semCusto ? <span style={{ color: 'var(--vp-danger)' }}>sem custo</span> : spMoeda(l.custoTotal)) : 'R$ 00,00'}</td>
                    <td className="text-right">{spFmt(l.estoque)}</td>
                    <td className="text-right" style={l.falta > 0 ? { color: 'var(--vp-danger)', fontWeight: 500 } : { color: 'var(--fg3)' }}>{l.falta > 0 ? spFmt(l.falta) : '—'}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Este produto não tem estrutura cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="pcp-cod" onClick={() => window.pcpIrPara?.({ setRoute, setSubsel }, 'montagem-produto', 'vp_pcp_pai', produto)}>Ver estrutura na Montagem do Produto →</button>
          </div>
        </>)}
      </>)}
    </div>
  );
}

Object.assign(window, { SimulacaoProducaoPage });
