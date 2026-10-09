/* ============================================================
   relatorios-pcp-extras.jsx — Logística Interna · Relatórios do PCP: peças compartilhadas pelas abas (relatorios-pcp.jsx).
   - RPCobertura: faixa "Base de vendas" (quantos pedidos o PCP já leu do Omie, de quando a quando, última leitura) com os botões
     para carregar os últimos 30/90 dias. Os relatórios de vendas (Pedidos, Clientes, Fluxo de Caixa) só enxergam o que já foi lido.
   - rpCarregarPeriodo: lê o período no Omie (só leitura, via sync-pcp-pedidos) e marca como HISTÓRICO os pedidos NOVOS que já estão
     faturados/entregues (etapa 60+): sem isso eles entrariam no SLA, na Emissão de NF e na Expedição como se fossem trabalho novo.
   - RPEstoque: situação do estoque pela MESMA regra da aba Reposição (consumo real × prazo de chegada); o estoque mínimo do Omie
     fica só como coluna informativa (88% dos itens não têm mínimo e o critério foi descartado na Reposição).
   - rpCsv/rpBaixar/rpLerTudo: exportação em planilha (UTF-8 com BOM, ";") e leitura paginada.
   Nada é escrito no Omie. Depende de rpAtualizarDoOmie/rpFmt/rpData* (relatorios-pcp.jsx) e window.PcpReposicao.
   ============================================================ */

function rpCsv(rows) {
  return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
}
function rpBaixar(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function rpLerTudo(montar) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
const rpHojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const rpNumCsv = (v, d = 2) => v == null || v === '' || !isFinite(v) ? '' : Number(v).toFixed(d).replace('.', ',');
function rpDataHoraBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(',', '');
}

async function rpCarregarPeriodo(sb, dias) {
  const antes = new Set((await rpLerTudo(() => sb.from('pcp_pedidos').select('numero_pedido').order('codigo_pedido'))).map(p => p.numero_pedido));
  const res = await rpAtualizarDoOmie(sb, { dias });
  if (!res.ok) return res;
  const depois = await rpLerTudo(() => sb.from('pcp_pedidos').select('numero_pedido, etapa').order('codigo_pedido'));
  const novos = Array.from(new Set(depois.filter(p => !antes.has(p.numero_pedido) && Number(p.etapa) >= 60).map(p => p.numero_pedido)));
  let marcados = 0;
  if (novos.length) {
    const { error } = await sb.from('pcp_pedido_acompanhamento').upsert(
      novos.map(n => ({ numero_pedido: n, historico: true, atualizado_por: 'carga de período (Relatórios do PCP)' })), { onConflict: 'numero_pedido', ignoreDuplicates: true });
    if (!error) marcados = novos.length;
  }
  return { ...res, marcados, novos: novos.length };
}

function RPCobertura({ sb, onAtualizado }) {
  const [info, setInfo] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  const carregar = React.useCallback(async () => {
    try {
      const rows = await rpLerTudo(() => sb.from('pcp_pedidos').select('numero_pedido, data_pedido, atualizado_em, cancelado').order('codigo_pedido'));
      const vivos = rows.filter(r => !r.cancelado);
      let de = null, ate = null, lido = null;
      vivos.forEach(r => { if (r.data_pedido && (!de || r.data_pedido < de)) de = r.data_pedido; if (r.data_pedido && (!ate || r.data_pedido > ate)) ate = r.data_pedido; });
      rows.forEach(r => { if (r.atualizado_em && (!lido || r.atualizado_em > lido)) lido = r.atualizado_em; });
      setInfo({ n: new Set(vivos.map(r => r.numero_pedido)).size, de, ate, lido });
    } catch (e) { setInfo({ erro: e.message || String(e) }); }
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  const ler = async (dias) => {
    if (dias > 30 && !window.confirm(`Ler no Omie os pedidos dos últimos ${dias} dias?\n\nÉ só leitura. Os pedidos novos que já estão faturados ou entregues entram como "histórico" (não geram prazo de NF nem expedição). Pode levar alguns minutos.`)) return;
    setBusy(dias);
    const res = await rpCarregarPeriodo(sb, dias);
    setBusy(null);
    if (!res.ok) window.toast?.('Não foi possível ler o Omie: ' + (res.erro || 'erro desconhecido'), 'error');
    else window.toast?.(`Omie lido: ${res.dados?.gravados ?? 0} pedido(s) com itens do PCP${res.marcados ? `; ${res.marcados} já faturado(s)/entregue(s) marcado(s) como histórico` : ''}.${res.dados?.aviso ? ' ' + res.dados.aviso : ''}`, 'success');
    await carregar(); onAtualizado && onAtualizado();
  };
  if (!info) return null;
  if (info.erro) return <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 8 }}>Não foi possível conferir a base de vendas: {info.erro}</div>;
  const velho = info.lido && (Date.now() - new Date(info.lido).getTime()) / 3.6e6 > 72;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', marginBottom: 10, border: '1px solid ' + (velho ? 'var(--vp-warning)' : 'var(--border)'), borderRadius: 8, fontSize: 12 }}>
      <div style={{ flex: '1 1 420px', color: 'var(--fg2, var(--fg3))' }}>
        <b style={{ fontWeight: 500 }}>Base de vendas:</b> {info.n} pedido(s) já lidos do Omie{info.de ? ` (pedidos de ${rpDataBr(info.de)} a ${rpDataBr(info.ate)})` : ''} · última leitura {rpDataHoraBR(info.lido)}.
        {' '}Estes relatórios mostram <b style={{ fontWeight: 500 }}>só o que já foi lido</b> — não é tudo o que a empresa vendeu. {velho ? '⚠ Leitura antiga. ' : ''}
      </div>
      <button className="btn btn--sm" disabled={!!busy} onClick={() => ler(30)} title="Lê no Omie os pedidos dos últimos 30 dias (só leitura)">{busy === 30 ? 'Lendo…' : 'Carregar 30 dias'}</button>
      <button className="btn btn--sm" disabled={!!busy} onClick={() => ler(90)} title="Lê no Omie os pedidos dos últimos 90 dias (só leitura; máximo permitido)">{busy === 90 ? 'Lendo…' : 'Carregar 90 dias'}</button>
    </div>
  );
}

/* Estado vazio guiado: explica por que a tela está vazia e leva ao lugar onde ela passa a se preencher. */
function RPVazioGuiado({ titulo, passos, acoes }) {
  return (
    <div style={{ padding: 12, marginBottom: 12, border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13 }}>
      <b style={{ fontWeight: 500 }}>{titulo}</b>
      <ol style={{ margin: '6px 0 8px 18px', padding: 0, color: 'var(--fg3)' }}>{passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {acoes.map(a => <button key={a.rot} className="btn btn--sm" onClick={() => window.pcpIrParaUrl && window.pcpIrParaUrl(a.path)}>{a.rot}</button>)}
      </div>
    </div>
  );
}

/* ---------------- Estoque (situação pela Reposição) ---------------- */
const RP_EST_ST = {
  critico: { l: 'Crítico', ordem: 0, cor: 'color-mix(in srgb, var(--vp-danger, #c0392b) 25%, transparent)' },
  comprar: { l: 'Comprar', ordem: 1, cor: 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)' },
  ok: { l: 'OK', ordem: 2, cor: 'color-mix(in srgb, #2e9e5b 22%, transparent)' },
  excesso: { l: 'Excesso', ordem: 3, cor: 'color-mix(in srgb, var(--vp-info, #2f6fed) 22%, transparent)' },
  sem_giro: { l: 'Sem giro', ordem: 4 }, sem_historico: { l: 'Sem histórico', ordem: 5 },
  fabricado: { l: 'Fabricado', ordem: 6 }, nao_repor: { l: 'Não repor', ordem: 7 },
};

function RPEstoque({ ctx }) {
  const { sb, nav } = ctx;
  const [grupo, setGrupo] = React.useState('mp');             // 'mp' | 'produtos'
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('');
  const [busca, setBusca] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cfg, prods, pos, est, movs, estr] = await Promise.all([
          sb.from('pcp_reposicao_config').select('*').eq('id', true).maybeSingle(),
          rpLerTudo(() => sb.from('pcp_produtos').select('codigo, descricao, unidade, estoque_minimo, tipo_sped, nao_repor').eq('ativo', true).order('codigo')),
          rpLerTudo(() => sb.from('pcp_posicao_compra').select('codigo, fisico, disponivel, pendente').order('codigo')),
          rpLerTudo(() => sb.from('pcp_estoque').select('codigo, quantidade').order('codigo')),
          rpLerTudo(() => sb.from('pcp_consumo_mov').select('codigo, dt_mov, qtde, cod_origem').order('id_mov')),
          rpLerTudo(() => sb.from('pcp_estrutura').select('codigo_pai').order('codigo_pai')),
        ]);
        if (cfg.error) throw cfg.error;
        if (!vivo) return;
        const porCod = {}; movs.forEach(m => { (porCod[m.codigo] = porCod[m.codigo] || []).push(m); });
        const fis = {}; est.forEach(e => { fis[e.codigo] = (fis[e.codigo] || 0) + Number(e.quantidade || 0); });
        const posic = {}; pos.forEach(p => { posic[p.codigo] = p; });
        const fab = new Set(estr.map(x => x.codigo_pai));
        const hoje = rpHojeBrasilia();
        const linhas = prods.map(p => {
          const ps = posic[p.codigo];
          const r = window.PcpReposicao.calcularItem({ codigo: p.codigo, movs: porCod[p.codigo], hoje, cfg: cfg.data, disponivel: ps ? ps.disponivel : (fis[p.codigo] || 0), pendente: ps ? ps.pendente : 0 });
          const fisico = ps ? Number(ps.fisico || 0) : (fis[p.codigo] || 0);
          const status = p.nao_repor ? 'nao_repor' : fab.has(p.codigo) ? 'fabricado' : r.status;
          return { ...r, p, fisico, status, minimo: Number(p.estoque_minimo || 0), cobertura: r.consumoDia > 0 ? r.disponivel / r.consumoDia : null };
        });
        setD({ linhas });
        setErro(null);
      } catch (e) { if (vivo) setErro(e.message || String(e)); }
    })();
    return () => { vivo = false; };
  }, [sb]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const doGrupo = d.linhas.filter(l => grupo === 'mp' ? l.p.tipo_sped === '01' : l.p.tipo_sped !== '01');
  const conta = (...s) => doGrupo.filter(l => s.includes(l.status)).length;
  const q = busca.trim().toLowerCase();
  const visiveis = doGrupo.filter(l => (!filtro || (filtro === 'giro' ? ['sem_giro', 'sem_historico'].includes(l.status) : filtro === 'outros' ? ['fabricado', 'nao_repor'].includes(l.status) : l.status === filtro))
    && (!q || (l.codigo + ' ' + (l.p.descricao || '')).toLowerCase().includes(q)))
    .sort((a, b) => RP_EST_ST[a.status].ordem - RP_EST_ST[b.status].ordem || (a.cobertura ?? 1e9) - (b.cobertura ?? 1e9) || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  const kpi = (rot, n, st) => (
    <button className="card pcp-total" onClick={() => setFiltro(f => f === st ? '' : st)} style={{ padding: 14, flex: '1 1 130px', textAlign: 'left', cursor: 'pointer', outline: filtro === st ? '2px solid var(--vp-yellow)' : 'none' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div><div style={{ fontSize: 22, fontWeight: 500 }}>{n}</div>
    </button>
  );
  const exportar = () => rpBaixar(`estoque-${rpHojeBrasilia()}.csv`, rpCsv([
    ['Código', 'Descrição', 'Unidade', 'Estoque físico', 'Disponível', 'A caminho', 'Consumo/mês (12m)', 'Cobertura (dias)', 'Situação', 'Mínimo do Omie'],
    ...visiveis.map(l => [l.codigo, l.p.descricao, l.p.unidade || '', rpNumCsv(l.fisico), rpNumCsv(l.disponivel), rpNumCsv(l.aCaminho), rpNumCsv(l.mediaMensal, 1), l.cobertura != null ? Math.round(l.cobertura) : '', RP_EST_ST[l.status].l, l.minimo ? rpNumCsv(l.minimo) : '']),
  ]));

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={'btn btn--sm' + (grupo === 'mp' ? ' btn--primary' : '')} onClick={() => { setGrupo('mp'); setFiltro(''); }}>Matéria-prima</button>
        <button className={'btn btn--sm' + (grupo === 'produtos' ? ' btn--primary' : '')} onClick={() => { setGrupo('produtos'); setFiltro(''); }}>Produtos</button>
        <input className="input" style={{ minWidth: 220, marginLeft: 'auto' }} placeholder="Buscar código ou descrição…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" disabled={!visiveis.length} onClick={exportar}>Exportar planilha</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('Crítico (vai faltar antes da chegada)', conta('critico'), 'critico')}
        {kpi('Comprar (ponto de pedido)', conta('comprar'), 'comprar')}
        {kpi('OK', conta('ok'), 'ok')}
        {kpi('Excesso', conta('excesso'), 'excesso')}
        {kpi('Sem giro / histórico', conta('sem_giro', 'sem_historico'), 'giro')}
        {kpi('Fabricado / não repor', conta('fabricado', 'nao_repor'), 'outros')}
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="text-right">Estoque físico</th><th className="text-right">Disponível</th><th className="text-right">A caminho</th><th className="text-right">Consumo/mês</th><th className="text-right">Cobertura</th><th>Situação</th><th className="text-right" title="Estoque mínimo cadastrado no Omie — só informativo">Mín. Omie</th></tr></thead>
          <tbody>
            {visiveis.map(l => (
              <tr key={l.codigo}>
                <td><button className="pcp-cod" title="Abrir no cadastro" onClick={() => window.pcpIrPara?.(nav, grupo === 'mp' ? 'cadastro-materias-primas' : 'cadastro-produtos', 'vp_pcp_busca', l.codigo)}>{l.codigo}</button></td>
                <td>{l.p.descricao}</td>
                <td>{l.p.unidade || '—'}</td>
                <td className="text-right">{rpFmt(l.fisico, 2)}</td>
                <td className="text-right">{rpFmt(l.disponivel, 2)}</td>
                <td className="text-right">{l.aCaminho ? rpFmt(l.aCaminho, 2) : '—'}</td>
                <td className="text-right">{l.mediaMensal > 0 ? rpFmt(l.mediaMensal, 1) : '—'}</td>
                <td className="text-right">{l.cobertura != null ? `${rpFmt(l.cobertura, 0)}d` : '—'}</td>
                <td><span className="pcp-tag" style={RP_EST_ST[l.status].cor ? { background: RP_EST_ST[l.status].cor } : undefined}>{RP_EST_ST[l.status].l}</span>{l.semGiroRecente ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>sem saída há {l.mesesSemSaida} meses</div> : null}</td>
                <td className="text-right" style={{ color: 'var(--fg3)' }}>{l.minimo ? rpFmt(l.minimo, 2) : '—'}</td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum item.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        A situação é a mesma da aba Reposição do Almoxarifado: consumo médio real dos últimos 12 meses × prazo de chegada (importado 90 dias / nacional 15), não o estoque mínimo. Cobertura = disponível ÷ consumo por dia. O mínimo do Omie aparece só como informação (a maior parte dos itens não tem).
      </div>
    </div>
  );
}

Object.assign(window, { RPVazioGuiado, RPCobertura, RPEstoque, rpCarregarPeriodo, rpCsv, rpBaixar, rpLerTudo });
