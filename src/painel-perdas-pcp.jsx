/* ============================================================
   painel-perdas-pcp.jsx — Logística Interna · Relatórios do PCP · aba "Perdas": painel no topo.
   Só leitura. Recebe de RPPerdas (relatorios-pcp.jsx) as OPs de produto CONCLUÍDAS do ano (pcp_ordens) já filtradas.
   Regras que existem por motivo real:
   - Só OP com `produto` (mesmo filtro dos outros relatórios); % de perda = perdida ÷ (produzida + perdida).
   - CUSTO da perda = perdidas × custo unitário atual dos MATERIAIS (estrutura × preco_custo), e só para quem tem
     a alçada almoxarifado.ver_custo; sem ela o dado nem é pedido ao banco. Não inclui mão de obra e usa o custo de hoje,
     não o da data da OP — é estimativa.
   - OP concluída com perda mas sem causa informada é destacada como falha de preenchimento.
   Usa helpers de relatorios-pcp.jsx: useRPPermissoes, rpCustoUnit, rpFmt, rpPct, rpBorrado.
   ============================================================ */

const PP_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function ppMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function ppData(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
function ppPctDe(perd, boa) { const t = Number(perd) + Number(boa); return t > 0 ? (Number(perd) / t) * 100 : null; }

function RPPainelPerdas({ ctx, ano, ordens }) {
  const { sb, produtos, nav } = ctx;
  const perm = useRPPermissoes();
  const [custo, setCusto] = React.useState(null);          // { filhos, preco } só com alçada de custo

  React.useEffect(() => {
    let vivo = true;
    if (!perm.custo) { setCusto(null); return; }
    (async () => {
      const [e, p] = await Promise.all([
        sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').limit(5000),
        sb.from('pcp_produtos').select('codigo, preco_custo, custo_manual, custo_compra').limit(5000),
      ]);
      const filhos = {}; (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const preco = {}; (p.data || []).forEach(l => { preco[l.codigo] = rpCustoEfetivo(l); });
      if (vivo) setCusto({ filhos, preco });
    })();
    return () => { vivo = false; };
  }, [sb, perm.custo]);

  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === ano ? hoje.getMonth() : 11;       // em ano passado, compara dezembro
  const custoUn = (cod) => custo ? rpCustoUnit(cod, custo.filhos, custo.preco) : null;

  const porMes = Array.from({ length: 12 }, () => ({ boa: 0, perd: 0 }));
  const porProd = {}, porCausa = {};
  let totBoa = 0, totPerd = 0, opsComPerda = 0, semCausa = 0, custoTotal = 0;
  ordens.forEach(o => {
    const boa = Number(o.qtd_produzida || 0), perd = Number(o.qtd_perdida || 0), m = Number(o.data_finalizacao.slice(5, 7)) - 1;
    porMes[m].boa += boa; porMes[m].perd += perd; totBoa += boa; totPerd += perd;
    const p = (porProd[o.produto] = porProd[o.produto] || { boa: 0, perd: 0 });
    p.boa += boa; p.perd += perd;
    if (perd > 0) {
      opsComPerda++;
      const causa = (o.causa_perda || '').trim();
      if (!causa) semCausa++;
      const chave = causa || 'Sem causa informada';
      const c = (porCausa[chave] = porCausa[chave] || { un: 0, ops: 0, acao: null, acaoEm: '' });
      c.un += perd; c.ops++;
      if (o.acao_corretiva && o.acao_corretiva.trim() && o.data_finalizacao >= c.acaoEm) { c.acao = o.acao_corretiva.trim(); c.acaoEm = o.data_finalizacao; }
      const cu = custoUn(o.produto); if (cu != null) custoTotal += perd * cu;
    }
  });
  const pctAno = ppPctDe(totPerd, totBoa);
  const pctMes = ppPctDe(porMes[mesAtual].perd, porMes[mesAtual].boa);
  const pctAnt = mesAtual > 0 ? ppPctDe(porMes[mesAtual - 1].perd, porMes[mesAtual - 1].boa) : null;
  const delta = pctMes != null && pctAnt != null ? pctMes - pctAnt : null;
  const maxPct = Math.max(1, ...porMes.map(x => ppPctDe(x.perd, x.boa) || 0));
  const causas = Object.entries(porCausa).sort((a, b) => b[1].un - a[1].un);
  const topProd = Object.entries(porProd).filter(([, v]) => v.perd > 0).sort((a, b) => b[1].perd - a[1].perd).slice(0, 5);
  const piores = ordens.filter(o => Number(o.qtd_perdida) > 0)
    .map(o => ({ ...o, pct: ppPctDe(o.qtd_perdida, o.qtd_produzida) }))
    .sort((a, b) => b.pct - a.pct || Number(b.qtd_perdida) - Number(a.qtd_perdida)).slice(0, 10);

  const abrirOp = (id) => window.pcpIrPara?.(nav, 'pcp', 'vp_pcp_op', id);
  const card = (rot, valor, sub, cor, extra) => (
    <div className="card pcp-total" style={{ padding: 14, flex: '1 1 170px', borderLeft: cor ? `4px solid ${cor}` : undefined }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div>
      <div style={{ fontSize: 24, fontWeight: 500, ...(extra || {}) }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{sub}</div>}
    </div>
  );
  const corPct = (p) => p == null ? null : p > 5 ? 'var(--vp-danger)' : p > 2 ? 'var(--vp-yellow)' : '#2e9e5b';

  return (
    <div style={{ marginBottom: 20 }}>
      {ordens.length === 0 && <RPVazioGuiado titulo={`Nenhuma OP concluída em ${ano}: não há perda para medir`}
        passos={['Conclua as OPs em PCP › Ordens de Produção, informando a quantidade produzida e a perdida.', 'Em OP com perda, preencha a causa e a ação corretiva: elas alimentam os quadros abaixo.']}
        acoes={[{ rot: 'Abrir Ordens de Produção', path: '/logistica/pcp' }]}/>}
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {card(`Perda em ${ano}`, pctAno == null ? '—' : rpPct(pctAno), `${rpFmt(totPerd, 0)} un. de ${rpFmt(totBoa + totPerd, 0)} produzidas`, corPct(pctAno))}
        {card(`Perda em ${PP_MESES[mesAtual]}`, pctMes == null ? '—' : rpPct(pctMes), delta == null ? 'sem mês anterior para comparar' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${rpFmt(Math.abs(delta), 1)} p.p. vs. mês anterior`, corPct(pctMes))}
        {card('OPs com perda', `${opsComPerda} de ${ordens.length}`, ordens.length ? `${rpPct((opsComPerda / ordens.length) * 100)} das OPs concluídas` : null, null)}
        {card('Causa nº 1', causas.length ? causas[0][0] : '—', causas.length ? `${rpFmt(causas[0][1].un, 0)} un. · ${rpPct((causas[0][1].un / totPerd) * 100)} das perdas` : null, null, { fontSize: 16 })}
        {perm.custo
          ? card('Custo estimado das perdas', custo ? ppMoeda(custoTotal) : '…', 'materiais, ao custo atual', null)
          : card('Custo estimado das perdas', 'R$ 0.000,00', 'visível só com a alçada de custo', null, rpBorrado)}
        {card('Sem causa informada', semCausa, semCausa ? 'OPs com perda sem causa — preencher' : 'tudo preenchido', semCausa ? 'var(--vp-yellow)' : '#2e9e5b')}
      </div>

      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>% de perda por mês em {ano}</h3>
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 150 }}>
          {porMes.map((x, i) => {
            const p = ppPctDe(x.perd, x.boa);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}
                title={`${PP_MESES[i]}: ${p == null ? 'sem produção' : rpPct(p)} · ${rpFmt(x.perd, 0)} un. perdida(s) de ${rpFmt(x.boa + x.perd, 0)}`}>
                <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{p == null ? '' : rpFmt(p, 1) + '%'}</div>
                <div style={{ width: '60%', height: p ? Math.max(2, (p / maxPct) * 100) : 0, background: corPct(p) || 'var(--fg3)' }}/>
                <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{PP_MESES[i]}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Verde até 2% · amarelo até 5% · vermelho acima de 5% (faixas de referência do painel, não uma meta cadastrada).</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Causas e ação corretiva</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Causa</th><th className="text-right">Un.</th><th className="text-right">OPs</th><th>Ação corretiva mais recente</th></tr></thead>
              <tbody>
                {causas.map(([c, v]) => (
                  <tr key={c}>
                    <td>{c}<div style={{ height: 4, width: `${(v.un / causas[0][1].un) * 100}%`, background: 'var(--vp-yellow)', marginTop: 3 }}/></td>
                    <td className="text-right">{rpFmt(v.un, 0)}</td>
                    <td className="text-right">{v.ops}</td>
                    <td style={{ fontSize: 12, color: v.acao ? undefined : 'var(--fg3)' }}>{v.acao || 'não registrada'}</td>
                  </tr>
                ))}
                {causas.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Sem perdas registradas em {ano}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Produtos que mais perdem</h3>
          <div className="card table-wrap" style={{ overflowX: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr><th>Produto</th><th className="text-right">Perdidas</th><th className="text-right">% de perda</th><th className="text-right">Custo est.</th></tr></thead>
              <tbody>
                {topProd.map(([c, v]) => {
                  const cu = custoUn(c);
                  return (
                    <tr key={c}>
                      <td><b style={{ fontWeight: 500 }}>{c}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{(produtos[c] || {}).descricao || ''}</div></td>
                      <td className="text-right">{rpFmt(v.perd, 0)}</td>
                      <td className="text-right">{rpPct(ppPctDe(v.perd, v.boa))}</td>
                      <td className="text-right">{perm.custo ? (cu == null ? '…' : ppMoeda(v.perd * cu)) : <span style={rpBorrado}>R$ 0.000,00</span>}</td>
                    </tr>
                  );
                })}
                {topProd.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Sem perdas registradas em {ano}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h3 style={{ margin: '16px 0 8px', fontWeight: 500, fontSize: 14 }}>OPs com maior perda</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>OP</th><th>Produto</th><th>Finalizada</th><th className="text-right">Perdidas / total</th><th className="text-right">%</th><th>Causa</th><th>Ação corretiva</th></tr></thead>
          <tbody>
            {piores.map(o => (
              <tr key={o.id}>
                <td><button className="pcp-cod" onClick={() => abrirOp(o.id)}>{o.numero}</button></td>
                <td>{o.produto}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{(produtos[o.produto] || {}).descricao || ''}</div></td>
                <td>{ppData(o.data_finalizacao)}</td>
                <td className="text-right">{rpFmt(o.qtd_perdida, 0)} / {rpFmt(Number(o.qtd_produzida || 0) + Number(o.qtd_perdida || 0), 0)}</td>
                <td className="text-right" style={{ color: corPct(o.pct) || undefined }}>{rpPct(o.pct)}</td>
                <td>{(o.causa_perda || '').trim() || <span style={{ color: 'var(--vp-danger)' }}>não informada</span>}</td>
                <td style={{ fontSize: 12 }}>{(o.acao_corretiva || '').trim() || <span style={{ color: 'var(--fg3)' }}>—</span>}</td>
              </tr>
            ))}
            {piores.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhuma OP com perda em {ano}.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        % de perda = perdidas ÷ (produzidas + perdidas). Só OPs de produto acabado concluídas no ano. O custo estimado usa o custo atual dos materiais (sem mão de obra), não o da data da OP.
      </div>
    </div>
  );
}

Object.assign(window, { RPPainelPerdas });
