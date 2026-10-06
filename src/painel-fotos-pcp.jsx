/* ============================================================
   painel-fotos-pcp.jsx — Logística Interna · Relatórios do PCP · aba "Produtos com foto".
   Só leitura. Catálogo visual dos produtos do PCP (pcp_produtos ativos) com a foto da Ficha Técnica.
   Regras que existem por motivo real:
   - O Omie NÃO guarda imagem dos produtos do PCP; o caminho de publicação é a Ficha Técnica
     (fichas_tecnicas.midia.foto = caminho no bucket PRIVADO fichas-imagens; link assinado por window.FTImg.signedURL).
   - A ficha casa com o produto por fichas_tecnicas.codigo_produto = pcp_produtos.codigo; ficha arquivada não conta.
   - Produto sem ficha ou com ficha sem foto aparece marcado, com atalho para a Ficha Técnica (abre a ficha existente
     via sessionStorage 'vpprd_ft_open'; sem ficha, abre a tela de Fichas para criar). Nada é gravado aqui.
   - Custo só para quem tem a alçada almoxarifado.ver_custo (sem ela nem é pedido ao banco).
   Usa helpers de relatorios-pcp.jsx: useRPPermissoes, rpFmt; de relatorios-pcp-custos.jsx: rpCustoEfetivo, rpUsaManual.
   ============================================================ */

function pfMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Foto carregada sob demanda (link assinado), só quando o card entra na tela.
function PFFoto({ path, alt }) {
  const [url, setUrl] = React.useState(null);
  const [falhou, setFalhou] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const u = await window.FTImg?.signedURL?.(path);
        if (!vivo) return;
        if (u) setUrl(u); else setFalhou(true);
      } catch { if (vivo) setFalhou(true); }
    };
    if (typeof IntersectionObserver === 'undefined' || !ref.current) { carregar(); return () => { vivo = false; }; }
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); carregar(); } }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => { vivo = false; io.disconnect(); };
  }, [path]);
  return (
    <div ref={ref} style={{ height: 140, background: 'var(--bg2, #f4f4f4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {url && !falhou
        ? <img src={url} alt={alt} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={() => setFalhou(true)}/>
        : <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{falhou ? 'Foto indisponível' : 'Carregando…'}</span>}
    </div>
  );
}

function RPProdutosFoto({ ctx }) {
  const { sb, nav } = ctx;
  const perm = useRPPermissoes();
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [grupo, setGrupo] = React.useState('produtos');   // 'produtos' | 'mp' | 'todos'
  const [situacao, setSituacao] = React.useState('todas'); // 'todas' | 'com' | 'sem'
  const [busca, setBusca] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const campos = 'codigo, descricao, familia, tipo_sped, unidade' + (perm.custo ? ', preco_custo, custo_manual, custo_compra' : '');
        const [p, f, e] = await Promise.all([
          sb.from('pcp_produtos').select(campos).eq('ativo', true).limit(5000),
          sb.from('fichas_tecnicas').select('id, codigo_produto, midia, arquivado').not('codigo_produto', 'is', null).limit(5000),
          sb.from('pcp_estoque').select('codigo, quantidade').limit(10000),
        ]);
        if (p.error) throw p.error;
        const fichas = {};
        (f.data || []).filter(x => !x.arquivado).forEach(x => {
          const cod = String(x.codigo_produto || '').trim();
          const foto = x.midia && x.midia.foto ? x.midia.foto : null;
          // se houver mais de uma ficha do mesmo código, prefere a que tem foto
          if (!fichas[cod] || (foto && !fichas[cod].foto)) fichas[cod] = { id: x.id, foto };
        });
        const saldo = {}; (e.data || []).forEach(l => { saldo[l.codigo] = (saldo[l.codigo] || 0) + Number(l.quantidade || 0); });
        if (vivo) setD({ prods: p.data || [], fichas, saldo });
      } catch (err) { if (vivo) setErro(err.message || String(err)); }
    })();
    return () => { vivo = false; };
  }, [sb, perm.custo]);

  if (erro) return <div style={{ padding: 24, color: 'var(--danger, #c00)' }}>Não foi possível carregar: {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const ehMP = (p) => p.tipo_sped === '01';
  const doGrupo = d.prods.filter(p => grupo === 'todos' || (grupo === 'mp' ? ehMP(p) : !ehMP(p)));
  const situ = (p) => { const f = d.fichas[p.codigo]; return f && f.foto ? 'com' : f ? 'semfoto' : 'semficha'; };
  const nCom = doGrupo.filter(p => situ(p) === 'com').length;
  const nSemFoto = doGrupo.filter(p => situ(p) === 'semfoto').length;
  const nSemFicha = doGrupo.filter(p => situ(p) === 'semficha').length;
  const pct = doGrupo.length ? (nCom / doGrupo.length) * 100 : 0;

  const q = busca.trim().toLowerCase();
  const lista = doGrupo
    .filter(p => situacao === 'todas' || (situacao === 'com' ? situ(p) === 'com' : situ(p) !== 'com'))
    .filter(p => !q || p.codigo.toLowerCase().includes(q) || (p.descricao || '').toLowerCase().includes(q) || (p.familia || '').toLowerCase().includes(q))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

  const abrirFicha = (p) => {
    const f = d.fichas[p.codigo];
    if (f) window.pcpIrPara?.(nav, 'ficha-tecnica', 'vpprd_ft_open', f.id);
    else window.pcpIrPara?.(nav, 'ficha-tecnica', 'vp_pcp_ficha_nova', p.codigo);
  };
  const btn = (ativo) => 'btn btn--sm' + (ativo ? ' btn--primary' : '');

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Cobertura de fotos</div><div className="pcp-total__v">{rpFmt(pct, 0)}%</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{nCom} de {doGrupo.length} itens</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Com foto</div><div className="pcp-total__v">{nCom}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Ficha sem foto</div><div className="pcp-total__v">{nSemFoto}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>falta anexar a foto</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Sem ficha técnica</div><div className="pcp-total__v">{nSemFicha}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>falta criar a ficha</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button className={btn(grupo === 'produtos')} onClick={() => setGrupo('produtos')}>Produtos</button>
        <button className={btn(grupo === 'mp')} onClick={() => setGrupo('mp')}>Matérias-primas</button>
        <button className={btn(grupo === 'todos')} onClick={() => setGrupo('todos')}>Todos</button>
        <span style={{ width: 12 }}/>
        <button className={btn(situacao === 'todas')} onClick={() => setSituacao('todas')}>Todas</button>
        <button className={btn(situacao === 'com')} onClick={() => setSituacao('com')}>Com foto</button>
        <button className={btn(situacao === 'sem')} onClick={() => setSituacao('sem')}>Sem foto</button>
        <input className="input" style={{ minWidth: 220, marginLeft: 'auto' }} placeholder="Buscar código, descrição ou família…" value={busca} onChange={e => setBusca(e.target.value)}/>
      </div>

      {lista.length === 0
        ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Nenhum item neste filtro.</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          {lista.map(p => {
            const s = situ(p), f = d.fichas[p.codigo];
            const ef = perm.custo ? rpCustoEfetivo(p) : null;
            return (
              <div key={p.codigo} style={{ border: '1px solid var(--border, #e3e3e3)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg, #fff)', display: 'flex', flexDirection: 'column' }}>
                {s === 'com'
                  ? <PFFoto path={f.foto} alt={p.descricao || p.codigo}/>
                  : <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2, #f4f4f4)', color: 'var(--fg3)', fontSize: 12, textAlign: 'center', padding: 8 }}>
                    {s === 'semfoto' ? 'Ficha técnica sem foto' : 'Sem ficha técnica'}
                  </div>}
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <button className="pcp-cod" style={{ textAlign: 'left' }} title="Abrir estrutura na Montagem do Produto" onClick={() => window.pcpIrPara?.(nav, 'montagem-produto', 'vp_pcp_pai', p.codigo)}>{p.codigo}</button>
                  <div style={{ fontSize: 12, lineHeight: 1.3 }}>{p.descricao}</div>
                  {p.familia && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{p.familia}</div>}
                  <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 'auto' }}>
                    Estoque: <b style={{ fontWeight: 500 }}>{rpFmt(d.saldo[p.codigo] || 0, 2)}</b> {p.unidade || ''}
                    {ef != null && ef > 0 && <> · Custo: <b style={{ fontWeight: 500 }}>{pfMoeda(ef)}</b>{rpUsaManual(p) ? ' ⓜ' : (rpUsaCompra(p) ? ' ⓒ' : '')}</>}
                  </div>
                  {s !== 'com' && <button className="btn btn--sm" onClick={() => abrirFicha(p)}>{f ? 'Abrir ficha e anexar foto' : 'Ir para Fichas Técnicas'}</button>}
                </div>
              </div>
            );
          })}
        </div>}

      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg3)' }}>
        As fotos vêm da <b style={{ fontWeight: 500 }}>Ficha Técnica</b> do produto (o Omie não guarda imagem destes itens). Esta tela só mostra; para incluir ou trocar uma foto, abra a ficha. {!perm.custo && 'O custo aparece só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

Object.assign(window, { RPProdutosFoto });
