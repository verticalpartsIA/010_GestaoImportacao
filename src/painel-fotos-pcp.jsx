/* ============================================================
   painel-fotos-pcp.jsx — Logística Interna · Relatórios do PCP · aba "Produtos com foto".
   Só leitura. Catálogo visual dos produtos do PCP (pcp_produtos ativos) com a foto da Ficha Técnica.
   Regras que existem por motivo real:
   - O Omie NÃO guarda imagem dos produtos do PCP; o caminho de publicação é a Ficha Técnica
     (fichas_tecnicas.midia.foto = caminho no bucket PRIVADO fichas-imagens; link assinado por window.FTImg.signedURL).
   - A ficha casa com o produto por fichas_tecnicas.codigo_produto = pcp_produtos.codigo; ficha arquivada não conta.
   - Produto sem ficha ou com ficha sem foto aparece marcado, com atalho para a Ficha Técnica: com ficha, abre a ficha existente
     (sessionStorage 'vpprd_ft_open'); sem ficha, abre uma ficha NOVA já com Código e Nome preenchidos
     (sessionStorage 'vp_pcp_ficha_nova' = JSON {codigo, nome}, lido por ficha-tecnica.jsx). Nada é gravado aqui.
   - Tipos (cada um com a própria cobertura): acabados, kits de emenda (VPKIT/VPPKIT), matéria-prima (tipo SPED 01) e
     consumíveis (tipo SPED 10). "Mais vendidos" olha os itens dos pedidos de venda já lidos (não cancelados).
   - Avisos: ficha sem Código do Produto não casa com nenhum item; código com 2+ fichas usa a que tem foto.
   - Custo só para quem tem a alçada almoxarifado.ver_custo (sem ela nem é pedido ao banco).
   - Cobertura "de venda" = acabados + kits (matéria-prima e consumíveis têm linha própria: 120 itens de MP escondiam o que importa).
   - Ordem padrão = prioridade: pendente antes de pronto; acabados, kits, consumíveis, matéria-prima; mais vendidos e maior estoque primeiro.
   - Tipo + situação ficam no endereço (/logistica/relatorios-pcp/fotos/<tipo>-<situação>, ex.: acabado-pendentes), como as outras abas do PCP.
   - "Imprimir catálogo" usa só os itens COM foto do filtro atual, com link assinado de cada foto e o preço de venda do cadastro.
   Usa helpers de relatorios-pcp.jsx: useRPPermissoes, rpFmt; de relatorios-pcp-custos.jsx: rpCustoEfetivo, rpUsaManual, rpUsaCompra;
   de relatorios-pcp-extras.jsx: rpCsv, rpBaixar, rpNumCsv.
   ============================================================ */

function pfMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const PF_TIPOS = [
  { id: 'acabado', rot: 'Produtos acabados' }, { id: 'kit', rot: 'Kits de emenda' },
  { id: 'mp', rot: 'Matéria-prima' }, { id: 'consumivel', rot: 'Consumíveis' },
];
function pfTipo(p) {
  if (p.tipo_sped === '01') return 'mp';
  if (/^VPP?KIT-/i.test(p.codigo) || /^kit\b/i.test(p.descricao || '')) return 'kit';
  if (p.tipo_sped === '10') return 'consumivel';
  return 'acabado';
}
const PF_SITU = { com: 'Com foto', semfoto: 'Ficha sem foto', semficha: 'Sem ficha' };

// Foto carregada sob demanda (link assinado), só quando o card entra na tela. Clicar amplia; se falhar, dá para tentar de novo.
function PFFoto({ path, alt, onAbrir }) {
  const [url, setUrl] = React.useState(null);
  const [falhou, setFalhou] = React.useState(false);
  const [tent, setTent] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    let vivo = true;
    setFalhou(false); setUrl(null);
    const carregar = async () => {
      try {
        const u = await window.FTImg?.signedURL?.(path);
        if (!vivo) return;
        if (u) setUrl(u); else setFalhou(true);
      } catch { if (vivo) setFalhou(true); }
    };
    if (tent > 0 || typeof IntersectionObserver === 'undefined' || !ref.current) { carregar(); return () => { vivo = false; }; }
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); carregar(); } }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => { vivo = false; io.disconnect(); };
  }, [path, tent]);
  return (
    <div ref={ref} style={{ height: 140, background: 'var(--bg2, #f4f4f4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: url && !falhou ? 'zoom-in' : 'default' }}
      onClick={() => { if (url && !falhou && onAbrir) onAbrir(url); }} title={url && !falhou ? 'Clique para ampliar' : undefined}>
      {url && !falhou
        ? <img src={url} alt={alt} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={() => setFalhou(true)}/>
        : falhou
          ? <button className="btn btn--sm" onClick={(e) => { e.stopPropagation(); setTent(t => t + 1); }}>Foto indisponível — tentar de novo</button>
          : <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Carregando…</span>}
    </div>
  );
}

function PFLightbox({ item, onFechar, onFicha }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onFechar]);
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg, #fff)', borderRadius: 10, maxWidth: 'min(900px, 96vw)', maxHeight: '94vh', overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <img src={item.url} alt={item.titulo} style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', alignSelf: 'center' }}/>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{item.codigo}</div>
        <div style={{ fontSize: 13 }}>{item.titulo}</div>
        {item.familia && <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{item.familia}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {onFicha && <button className="btn btn--sm" onClick={onFicha}>Abrir a ficha técnica</button>}
          <button className="btn btn--sm btn--primary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function RPProdutosFoto({ ctx }) {
  const { sb, nav } = ctx;
  const perm = useRPPermissoes();
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  // Tipo e situação moram no endereço (3º trecho: <tipo>-<situação>); o Voltar do navegador e o link compartilhado reproduzem o filtro.
  const [filtroUrl, setFiltroUrl] = window.useRotaItem('relatorios-pcp', 'fotos');
  const [gUrl, sUrl] = String(filtroUrl || '').split('-');
  const grupo = ['acabado', 'kit', 'mp', 'consumivel'].includes(gUrl) ? gUrl : 'todos';                 // 'todos' | 'acabado' | 'kit' | 'mp' | 'consumivel'
  const situacao = ['com', 'semfoto', 'semficha', 'pendentes'].includes(sUrl) ? sUrl : 'todas';         // 'todas' | 'com' | 'semfoto' | 'semficha' | 'pendentes'
  const aplicarFiltro = (g, s) => setFiltroUrl(g === 'todos' && s === 'todas' ? null : `${g}-${s}`);
  const setGrupo = (g) => aplicarFiltro(g, situacao);
  const setSituacao = (s) => aplicarFiltro(grupo, s);
  const [ordem, setOrdem] = React.useState('prioridade');  // 'prioridade' | 'codigo' | 'vendidos' | 'estoque'
  const [busca, setBusca] = React.useState('');
  const [lightbox, setLightbox] = React.useState(null);
  const [avisoAberto, setAvisoAberto] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const campos = 'codigo, descricao, familia, tipo_sped, unidade, preco_venda' + (perm.custo ? ', preco_custo, custo_manual, custo_compra' : '');
        const [p, f, e, ped, it] = await Promise.all([
          sb.from('pcp_produtos').select(campos).eq('ativo', true).limit(5000),
          sb.from('fichas_tecnicas').select('id, codigo_produto, nome_produto, numero_documento, midia, arquivado').limit(5000),
          sb.from('pcp_estoque').select('codigo, quantidade').limit(10000),
          sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido').eq('cancelado', false).limit(5000),
          sb.from('pcp_pedido_itens').select('codigo_pedido, codigo, quantidade').eq('item_pcp', true).limit(20000),
        ]);
        if (p.error) throw p.error;
        const ativas = (f.data || []).filter(x => !x.arquivado);
        const semCodigo = ativas.filter(x => !String(x.codigo_produto || '').trim());
        const porCod = {};
        ativas.forEach(x => { const c = String(x.codigo_produto || '').trim(); if (c) (porCod[c] = porCod[c] || []).push(x); });
        const fichas = {}, duplicados = [];
        Object.keys(porCod).forEach(c => {
          const lista = porCod[c];
          const escolhida = lista.find(x => x.midia && x.midia.foto) || lista[0];      // com mais de uma ficha do mesmo código, prefere a que tem foto
          fichas[c] = { id: escolhida.id, foto: escolhida.midia && escolhida.midia.foto ? escolhida.midia.foto : null, numero: escolhida.numero_documento };
          if (lista.length > 1) duplicados.push({ codigo: c, fichas: lista });
        });
        const saldo = {}; (e.data || []).forEach(l => { saldo[l.codigo] = (saldo[l.codigo] || 0) + Number(l.quantidade || 0); });
        const numPedido = new Map((ped.data || []).map(x => [x.codigo_pedido, x.numero_pedido]));
        const vendas = {};
        (it.data || []).forEach(x => { const n = numPedido.get(x.codigo_pedido); if (n == null) return; const v = (vendas[x.codigo] = vendas[x.codigo] || { qtd: 0, nums: new Set() }); v.qtd += Number(x.quantidade || 0); v.nums.add(n); });
        if (vivo) setD({ prods: p.data || [], fichas, saldo, vendas, semCodigo, duplicados });
      } catch (err) { if (vivo) setErro(err.message || String(err)); }
    })();
    return () => { vivo = false; };
  }, [sb, perm.custo]);

  if (erro) return <div style={{ padding: 24, color: 'var(--danger, #c00)' }}>Não foi possível carregar: {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const situ = (p) => { const f = d.fichas[p.codigo]; return f && f.foto ? 'com' : f ? 'semfoto' : 'semficha'; };
  const doGrupo = d.prods.filter(p => grupo === 'todos' || pfTipo(p) === grupo);
  const nCom = doGrupo.filter(p => situ(p) === 'com').length;
  const nSemFoto = doGrupo.filter(p => situ(p) === 'semfoto').length;
  const nSemFicha = doGrupo.filter(p => situ(p) === 'semficha').length;
  const pct = doGrupo.length ? (nCom / doGrupo.length) * 100 : 0;
  const porTipo = PF_TIPOS.map(t => { const ps = d.prods.filter(p => pfTipo(p) === t.id); return { ...t, n: ps.length, com: ps.filter(p => situ(p) === 'com').length }; });
  const venda = porTipo.filter(t => t.id === 'acabado' || t.id === 'kit');            // cobertura "de venda"
  const vendaN = venda.reduce((s, t) => s + t.n, 0), vendaCom = venda.reduce((s, t) => s + t.com, 0);
  const nPendentes = nSemFoto + nSemFicha;

  const q = busca.trim().toLowerCase();
  const lista = doGrupo
    .filter(p => situacao === 'todas' || (situacao === 'pendentes' ? situ(p) !== 'com' : situ(p) === situacao))
    .filter(p => !q || p.codigo.toLowerCase().includes(q) || (p.descricao || '').toLowerCase().includes(q) || (p.familia || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const cod = a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
      if (ordem === 'prioridade') {
        const rk = { acabado: 0, kit: 1, consumivel: 2, mp: 3 };
        const pend = (p) => situ(p) === 'com' ? 1 : 0;
        const va = (d.vendas[a.codigo] && d.vendas[a.codigo].qtd) || 0, vb = (d.vendas[b.codigo] && d.vendas[b.codigo].qtd) || 0;
        return pend(a) - pend(b) || rk[pfTipo(a)] - rk[pfTipo(b)] || vb - va || (d.saldo[b.codigo] || 0) - (d.saldo[a.codigo] || 0) || cod;
      }
      if (ordem === 'vendidos') return ((d.vendas[b.codigo] && d.vendas[b.codigo].qtd) || 0) - ((d.vendas[a.codigo] && d.vendas[a.codigo].qtd) || 0) || cod;
      if (ordem === 'estoque') return (d.saldo[b.codigo] || 0) - (d.saldo[a.codigo] || 0) || cod;
      return cod;
    });

  const abrirFichaPorId = (id) => window.pcpIrPara?.(nav, 'ficha-tecnica', 'vpprd_ft_open', id);
  const abrirFicha = (p) => {
    const f = d.fichas[p.codigo];
    if (f) abrirFichaPorId(f.id);
    else window.pcpIrPara?.(nav, 'ficha-tecnica', 'vp_pcp_ficha_nova', JSON.stringify({ codigo: p.codigo, nome: p.descricao || '' }));
  };
  const imprimirCatalogo = async () => {
    const itens = lista.filter(p => situ(p) === 'com');
    if (!itens.length) { window.toast?.('Não há item com foto neste filtro.'); return; }
    if (itens.length > 120 && !window.confirm(`O catálogo terá ${itens.length} itens e pode demorar para carregar as fotos. Continuar?`)) return;
    const w = window.open('', '_blank');
    if (!w) { window.toast?.('Permita pop-ups para imprimir.'); return; }
    w.document.write('<p style="font-family:Arial;padding:20px">Carregando as fotos do catálogo…</p>');
    const urls = await Promise.all(itens.map(p => Promise.resolve(window.FTImg?.signedURL?.(d.fichas[p.codigo].foto)).catch(() => null)));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cards = itens.map((p, i) => `<div class="c">${urls[i] ? `<img src="${esc(urls[i])}" alt="">` : '<div class="ni">sem imagem</div>'}<b>${esc(p.codigo)}</b><span>${esc(p.descricao || '')}</span>${Number(p.preco_venda) > 0 ? `<em>${esc(pfMoeda(p.preco_venda))}${p.unidade ? ' / ' + esc(p.unidade) : ''}</em>` : ''}</div>`).join('');
    const rotGrupo = grupo === 'todos' ? 'Todos os tipos' : (PF_TIPOS.find(x => x.id === grupo) || {}).rot;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Catálogo de produtos</title><style>
      body{font-family:Poppins,Arial,sans-serif;font-weight:300;font-size:11px;margin:22px;color:#111}h1{font-size:18px;font-weight:500;text-align:center;margin:0 0 4px}.s{text-align:center;color:#666;margin-bottom:14px}
      .g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{border:1px solid #ccc;padding:8px;display:flex;flex-direction:column;gap:3px;break-inside:avoid}
      .c img{width:100%;height:120px;object-fit:contain}.ni{height:120px;display:flex;align-items:center;justify-content:center;color:#999}.c b{font-weight:500;font-size:12px}.c em{font-style:normal;font-weight:500}
      @media print{body{margin:10mm}}</style></head><body><h1>CATÁLOGO DE PRODUTOS — VERTICAL PARTS</h1><div class="s">${esc(rotGrupo)} · ${itens.length} item(ns) com foto · emitido em ${new Date().toLocaleDateString('pt-BR')}</div><div class="g">${cards}</div>
      <script>var n=document.images.length,k=0;function ok(){if(++k>=n)setTimeout(function(){window.print()},300)}if(!n)window.print();else for(var i=0;i<n;i++){var im=document.images[i];if(im.complete)ok();else{im.onload=ok;im.onerror=ok}}setTimeout(function(){if(k<n)window.print()},15000);<\/script></body></html>`);
    w.document.close();
  };
  const exportar = () => rpBaixar(`produtos-com-foto-${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)}.csv`, rpCsv([
    ['Código', 'Descrição', 'Tipo', 'Família', 'Situação da foto', 'Estoque', 'Unidade', 'Vendido (qtd)', 'Pedidos'],
    ...lista.map(p => { const v = d.vendas[p.codigo]; return [p.codigo, p.descricao || '', PF_TIPOS.find(t => t.id === pfTipo(p)).rot, p.familia || '', PF_SITU[situ(p)], rpNumCsv(d.saldo[p.codigo] || 0), p.unidade || '', v ? rpNumCsv(v.qtd, 0) : '', v ? v.nums.size : '']; }),
  ]));
  const btn = (ativo) => 'btn btn--sm' + (ativo ? ' btn--primary' : '');
  const nAvisos = d.semCodigo.length + d.duplicados.length;

  return (
    <div>
      {lightbox && <PFLightbox item={lightbox} onFechar={() => setLightbox(null)} onFicha={lightbox.fichaId ? () => abrirFichaPorId(lightbox.fichaId) : null}/>}
      <div className="grid-4" style={{ marginBottom: 8 }}>
        <div className="pcp-total" onClick={() => aplicarFiltro('acabado', 'pendentes')} style={{ cursor: 'pointer' }} title="Clique para ver os acabados pendentes"><div className="pcp-total__l">Itens de venda (acabados + kits)</div><div className="pcp-total__v">{vendaCom} de {vendaN}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{vendaN ? rpFmt((vendaCom / vendaN) * 100, 0) : 0}% com foto · cobertura geral {rpFmt(pct, 0)}% ({nCom}/{doGrupo.length})</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Com foto</div><div className="pcp-total__v">{nCom}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Ficha sem foto</div><div className="pcp-total__v">{nSemFoto}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>falta anexar a foto</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Sem ficha técnica</div><div className="pcp-total__v">{nSemFicha}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>falta criar a ficha</div></div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg3)', marginBottom: 12 }}>
        {porTipo.map(t => <button key={t.id} className="btn btn--sm" title={`Ver os pendentes de "${t.rot}"`} onClick={() => aplicarFiltro(t.id, 'pendentes')}><b style={{ fontWeight: 500 }}>{t.rot}:</b> {t.com}/{t.n} com foto{t.n ? ` (${rpFmt((t.com / t.n) * 100, 0)}%)` : ''}</button>)}
      </div>

      {nAvisos > 0 && (
        <div style={{ border: '1px solid var(--vp-warning)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
          <button className="btn btn--sm" onClick={() => setAvisoAberto(v => !v)}>{avisoAberto ? '▾' : '▸'} {nAvisos} ficha(s) técnica(s) pedem atenção</button>
          {avisoAberto && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.semCodigo.length > 0 && <div><b style={{ fontWeight: 500 }}>Sem "Código do Produto" ({d.semCodigo.length}):</b> não casam com nenhum item e por isso nunca aparecem aqui. Preencha o código na ficha.
                {d.semCodigo.map(x => <div key={x.id} style={{ marginLeft: 12 }}>{x.nome_produto || x.numero_documento || x.id} <button className="btn btn--sm" onClick={() => abrirFichaPorId(x.id)}>Abrir ficha</button></div>)}</div>}
              {d.duplicados.length > 0 && <div><b style={{ fontWeight: 500 }}>Mesmo código em mais de uma ficha ({d.duplicados.length}):</b> esta tela usa a que tem foto. Arquive a que sobrar.
                {d.duplicados.map(x => <div key={x.codigo} style={{ marginLeft: 12, marginTop: 4 }}><b style={{ fontWeight: 500 }}>{x.codigo}</b>
                  {x.fichas.map(fi => <div key={fi.id} style={{ marginLeft: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{fi.numero_documento || fi.nome_produto || 'ficha'} · {fi.midia && fi.midia.foto ? 'com foto' : 'sem foto'}{d.fichas[x.codigo] && d.fichas[x.codigo].id === fi.id ? ' · é a que esta tela usa' : ''}</span>
                    <button className="btn btn--sm" onClick={() => abrirFichaPorId(fi.id)}>Abrir ficha</button>
                  </div>)}</div>)}</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button className={btn(grupo === 'todos')} onClick={() => setGrupo('todos')}>Todos ({d.prods.length})</button>
        {porTipo.map(t => <button key={t.id} className={btn(grupo === t.id)} onClick={() => setGrupo(t.id)}>{t.rot} ({t.n})</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button className={btn(situacao === 'todas')} onClick={() => setSituacao('todas')}>Todas</button>
        <button className={btn(situacao === 'pendentes')} onClick={() => setSituacao('pendentes')} title="Ficha sem foto + sem ficha">Pendentes ({nPendentes})</button>
        <button className={btn(situacao === 'com')} onClick={() => setSituacao('com')}>Com foto ({nCom})</button>
        <button className={btn(situacao === 'semfoto')} onClick={() => setSituacao('semfoto')} title="Já existe ficha: basta anexar a foto">Ficha sem foto ({nSemFoto})</button>
        <button className={btn(situacao === 'semficha')} onClick={() => setSituacao('semficha')} title="Ainda não existe ficha: precisa criar">Sem ficha ({nSemFicha})</button>
        <select className="input" value={ordem} onChange={e => setOrdem(e.target.value)} title="Ordenar os cartões">
          <option value="prioridade">Ordenar: prioridade</option><option value="codigo">Ordenar: código</option><option value="vendidos">Ordenar: mais vendidos</option><option value="estoque">Ordenar: maior estoque</option>
        </select>
        <input className="input" style={{ minWidth: 220, marginLeft: 'auto' }} placeholder="Buscar código, descrição ou família…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!lista.some(p => situ(p) === 'com')} onClick={imprimirCatalogo} title="Imprime (ou salva em PDF) um catálogo com foto, código, descrição e preço de venda dos itens COM foto do filtro atual">Imprimir catálogo</button>
        <button className="btn btn--sm" disabled={!lista.length} onClick={exportar} title="Baixa a lista que está na tela (com a situação da foto) em planilha CSV — útil para repartir quem tira as fotos">Exportar pendências</button>
      </div>

      {lista.length === 0
        ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Nenhum item neste filtro.</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          {lista.map((p, idx) => {
            const s = situ(p), f = d.fichas[p.codigo], v = d.vendas[p.codigo];
            const prioritario = ordem === 'prioridade' && s !== 'com' && idx < 10;
            const ef = perm.custo ? rpCustoEfetivo(p) : null;
            return (
              <div key={p.codigo} style={{ border: '1px solid var(--border, #e3e3e3)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg, #fff)', display: 'flex', flexDirection: 'column' }}>
                {s === 'com'
                  ? <PFFoto path={f.foto} alt={p.descricao || p.codigo} onAbrir={(url) => setLightbox({ url, codigo: p.codigo, titulo: p.descricao || '', familia: p.familia, fichaId: f.id })}/>
                  : <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2, #f4f4f4)', color: 'var(--fg3)', fontSize: 12, textAlign: 'center', padding: 8 }}>
                    {s === 'semfoto' ? 'Ficha técnica sem foto' : 'Sem ficha técnica'}
                  </div>}
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  {prioritario && <span style={{ alignSelf: 'flex-start', fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--vp-yellow) 35%, transparent)' }} title="Um dos 10 itens que mais precisam de foto: acabados e kits primeiro, depois os mais vendidos e de maior estoque">prioridade</span>}
                  <button className="pcp-cod" style={{ textAlign: 'left' }} title="Abrir estrutura na Montagem do Produto" onClick={() => window.pcpIrPara?.(nav, 'montagem-produto', 'vp_pcp_pai', p.codigo)}>{p.codigo}</button>
                  <div style={{ fontSize: 12, lineHeight: 1.3 }} title={p.descricao || ''}>{p.descricao}</div>
                  {p.familia && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{p.familia}</div>}
                  {v && <div style={{ fontSize: 11, color: 'var(--vp-info, #2f6fed)' }} title={`Pedidos: ${Array.from(v.nums).join(', ')}`}>vendido: {rpFmt(v.qtd, 0)} em {v.nums.size} pedido(s)</div>}
                  <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 'auto' }}>
                    Estoque: <b style={{ fontWeight: 500 }}>{rpFmt(d.saldo[p.codigo] || 0, 2)}</b> {p.unidade || ''}
                    {ef != null && ef > 0 && <> · Custo: <b style={{ fontWeight: 500 }}>{pfMoeda(ef)}</b>{rpUsaManual(p) ? ' ⓜ' : (rpUsaCompra(p) ? ' ⓒ' : '')}</>}
                  </div>
                  {s !== 'com' && <button className="btn btn--sm" onClick={() => abrirFicha(p)} title={f ? 'Abre a ficha existente para anexar a foto' : 'Abre uma ficha nova já com o código e o nome deste item'}>{f ? 'Abrir ficha e anexar foto' : 'Criar ficha deste item'}</button>}
                </div>
              </div>
            );
          })}
        </div>}

      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg3)' }}>
        As fotos vêm da <b style={{ fontWeight: 500 }}>Ficha Técnica</b> do produto (o Omie não guarda imagem destes itens). Esta tela só mostra; para incluir ou trocar uma foto, abra a ficha. "Criar ficha deste item" abre uma ficha nova já com o código e o nome preenchidos. {!perm.custo && 'O custo aparece só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

Object.assign(window, { RPProdutosFoto });
