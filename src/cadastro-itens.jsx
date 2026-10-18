/* ============================================================
   cadastro-itens.jsx — Cadastros Mestres · Matérias-Primas e Produtos.
   Lê pcp_produtos (espelho do cadastro do Omie). Matéria-Prima = código VPMP
   (insumo que só é consumido, nunca vendido); Produtos = todo o resto, com o papel
   de cada item: Fabricado (tem estrutura) ou Mercadoria de estoque (vendida e/ou componente).
   O tipo SPED do Omie NÃO decide: é classificação fiscal, não o papel no chão de fábrica.
   Somente leitura: a origem é o Omie (sincronizado em Logística Interna › Almoxarifado).
   ============================================================ */

// Regra única de "matéria-prima" (usada por Montagem, Simulação, PCP, Relatórios e painel de fotos).
function pcpEhMateriaPrima(codigo) { return /^VPMP/i.test(codigo || ''); }

// Navegação entre as telas PCP: guarda o filtro/seleção na sessão e troca de rota (setSubsel + setRoute, como a Central de Decisões).
function pcpIrPara(nav, rota, chave, valor) {
  try { sessionStorage.setItem(chave, valor); } catch (e) { /* sem sessionStorage: abre sem filtro */ }
  if (!nav || !nav.setRoute) return;
  if (nav.setSubsel) nav.setSubsel(null);
  nav.setRoute(rota);
}

function CadastroItensPage({ tipo, setRoute, setSubsel }) {
  const ehMP = tipo === 'materias-primas';
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState(() => {
    try { const v = sessionStorage.getItem('vp_pcp_busca') || ''; sessionStorage.removeItem('vp_pcp_busca'); return v; } catch (e) { return ''; }
  });
  const [pais, setPais] = React.useState(new Set());
  const [familia, setFamilia] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setErro('Supabase indisponível.'); return; }
    let q = sb.from('pcp_produtos')
      .select('codigo, descricao, familia, unidade, ncm, tipo_sped, peso_liquido_kg, endereco')
      .eq('ativo', true).order('codigo').limit(2000);
    q = ehMP ? q.ilike('codigo', 'VPMP%') : q.not('codigo', 'ilike', 'VPMP%');
    q.then(({ data, error }) => {
      if (!vivo) return;
      if (error) setErro(error.message); else setLinhas(data || []);
    });
    sb.from('pcp_estrutura').select('codigo_pai').limit(5000).then(({ data }) => {
      if (vivo && data) setPais(new Set(data.map(l => l.codigo_pai)));
    });
    return () => { vivo = false; };
  }, [ehMP]);

  const familias = React.useMemo(
    () => Array.from(new Set((linhas || []).map(l => l.familia).filter(Boolean))).sort(),
    [linhas]
  );
  const filtradas = React.useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (linhas || []).filter(l =>
      (!familia || l.familia === familia) &&
      (!t || (l.codigo || '').toLowerCase().includes(t) || (l.descricao || '').toLowerCase().includes(t)));
  }, [linhas, busca, familia]);

  const titulo = ehMP ? 'Matérias-Primas' : 'Produtos';
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Cadastros Mestres</div>
          <h1 className="page-head__title">{titulo}</h1>
          <p className="page-head__sub">
            {ehMP ? 'Insumos VPMP ativos, só consumidos na fabricação' : 'Produtos fabricados e mercadorias de estoque ativos'} — origem: Omie.
          </p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, margin: '0 0 12px', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar código ou descrição…" value={busca}
          onChange={e => setBusca(e.target.value)} style={{ minWidth: 260 }}/>
        <select className="input" value={familia} onChange={e => setFamilia(e.target.value)}>
          <option value="">Todas as famílias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ alignSelf: 'center', color: 'var(--fg3)', fontSize: 12 }}>
          {linhas ? `${filtradas.length} de ${linhas.length}` : ''}
        </span>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {!erro && !linhas && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {linhas && (
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead>
              <tr>
                <th>Código</th><th>Descrição</th><th>Família</th><th>Un.</th>
                <th>NCM</th><th className="text-right">Peso líq. (kg)</th><th>Endereço</th>
                {!ehMP && <th>Papel</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(l => (
                <tr key={l.codigo}>
                  <td>{pais.has(l.codigo)
                    ? <button className="pcp-cod" title="Abrir na Montagem do Produto" onClick={() => pcpIrPara({ setRoute, setSubsel }, 'montagem-produto', 'vp_pcp_pai', l.codigo)}>{l.codigo}</button>
                    : <b style={{ fontWeight: 500 }}>{l.codigo}</b>}</td>
                  <td>{l.descricao}</td>
                  <td>{l.familia || '—'}</td>
                  <td>{l.unidade || '—'}</td>
                  <td>{l.ncm || '—'}</td>
                  <td className="text-right">{l.peso_liquido_kg != null ? Number(l.peso_liquido_kg).toLocaleString('pt-BR') : '—'}</td>
                  <td>{l.endereco || '—'}</td>
                  {!ehMP && <td>{pais.has(l.codigo) ? 'Fabricado' : 'Mercadoria de estoque'}</td>}
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={ehMP ? 7 : 8} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CadastroMateriasPrimasPage(props) { return <CadastroItensPage tipo="materias-primas" {...props}/>; }
function CadastroProdutosPage(props) { return <CadastroItensPage tipo="produtos" {...props}/>; }

Object.assign(window, { CadastroMateriasPrimasPage, CadastroProdutosPage, pcpIrPara, pcpEhMateriaPrima });
