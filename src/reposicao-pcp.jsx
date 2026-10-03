/* ============================================================
   reposicao-pcp.jsx — Logística Interna · Almoxarifado · aba "Reposição".
   Quanto comprar e QUANDO, a partir do CONSUMO MÉDIO REAL (saídas do estoque do Omie desde 01/01/2024) e do PRAZO DE
   CHEGADA — não do estoque mínimo (ver reposicao-calc.js). A maior parte é importada (~90 dias): comprar só quando encosta
   no mínimo é comprar tarde; por isso a tela mostra cobertura em dias e o ponto de pedido.
   Regras que existem por motivo real:
   - Dados vêm de cache no Supabase (pcp_consumo_mov / pcp_posicao_compra), abastecido pela função sync-pcp-consumo
     (cron diário 04:30/04:50 + botão "Atualizar"). O navegador nunca fala com o Omie.
   - Parâmetros (prazo importado/nacional, folga, ciclo, origens fora do consumo) em pcp_reposicao_config; só quem tem a
     alçada almoxarifado.reposicao_config altera (administrador sempre passa).
   - Custo/valor só para quem tem almoxarifado.ver_custo (sem ela nem é pedido ao banco).
   - "Fechar o container": a tela soma a cubagem (m³) do que está marcado e compara com a capacidade de referência do 40'HC.
     Item sem dimensão cadastrada fica de fora da soma e é contado no aviso.
   Nada é escrito no Omie aqui.
   ============================================================ */

const REP_STATUS = {
  critico: { label: 'Crítico', variant: 'danger', ordem: 0 },
  comprar: { label: 'Comprar', variant: 'warning', ordem: 1 },
  ok: { label: 'OK', variant: 'success', ordem: 2 },
  excesso: { label: 'Excesso', variant: 'info', ordem: 3 },
  sem_giro: { label: 'Sem giro', variant: 'neutral', ordem: 4 },
  sem_historico: { label: 'Sem histórico', variant: 'neutral', ordem: 5 },
};
const REP_M3_40HC = 76;          // capacidade nominal de referência do 40'HC (m³)

const repFmt = (v, d = 0) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
const repMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const repData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';

async function repLerTudo(montar) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function AlmoxarifadoReposicao() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [perm, setPerm] = React.useState({ custo: false, config: false });
  const [cfg, setCfg] = React.useState(null);
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [atualizando, setAtualizando] = React.useState(null);     // texto de progresso
  const [statusF, setStatusF] = React.useState('acao');           // acao | todos | <status>
  const [grupo, setGrupo] = React.useState('comprados');          // comprados | fabricados | todos
  const [busca, setBusca] = React.useState('');
  const [sel, setSel] = React.useState(() => new Set());
  const [cfgAberta, setCfgAberta] = React.useState(false);
  const [edit, setEdit] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setPerm(p => ({ ...p, custo: !!v }))).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'reposicao_config')).then(v => setPerm(p => ({ ...p, config: !!v }))).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase não carregou.'); return; }
    try {
      const campos = 'codigo, descricao, unidade, familia, tipo_sped, altura_cm, largura_cm, profundidade_cm' + (perm.custo ? ', preco_custo, custo_manual' : '');
      const [c, cur, prods, estoque, pos, movs, estr] = await Promise.all([
        sb.from('pcp_reposicao_config').select('*').eq('id', true).maybeSingle(),
        sb.from('pcp_consumo_cursor').select('concluido_ate, atualizado_em, proxima_data').eq('id', true).maybeSingle(),
        repLerTudo(() => sb.from('pcp_produtos').select(campos).eq('ativo', true).order('codigo')),
        repLerTudo(() => sb.from('pcp_estoque').select('codigo, quantidade').order('codigo')),
        repLerTudo(() => sb.from('pcp_posicao_compra').select('codigo, disponivel, pendente, atualizado_em').order('codigo')),
        repLerTudo(() => sb.from('pcp_consumo_mov').select('codigo, dt_mov, qtde, cod_origem').order('id_mov')),
        repLerTudo(() => sb.from('pcp_estrutura').select('codigo_pai').order('codigo_pai')),
      ]);
      if (c.error) throw c.error;
      const porCod = {}; movs.forEach(m => { (porCod[m.codigo] = porCod[m.codigo] || []).push(m); });
      const fis = {}; estoque.forEach(e => { fis[e.codigo] = (fis[e.codigo] || 0) + Number(e.quantidade || 0); });
      const posic = {}; pos.forEach(p => { posic[p.codigo] = p; });
      setCfg(c.data); setEdit(c.data);
      const fabricados = new Set(estr.map(x => x.codigo_pai));      // têm estrutura no PCP = fabricados aqui, não comprados
      setD({ prods, porCod, fis, posic, fabricados, cursor: cur.data || {}, nMovs: movs.length });
      setErro(null);
    } catch (e) { setErro(e.message || String(e)); }
  }, [sb, perm.custo]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const linhas = React.useMemo(() => {
    if (!d || !cfg) return [];
    const hoje = new Date().toISOString().slice(0, 10);
    return d.prods.map(p => {
      const ps = d.posic[p.codigo];
      const r = window.PcpReposicao.calcularItem({
        codigo: p.codigo, movs: d.porCod[p.codigo], hoje, cfg,
        disponivel: ps ? ps.disponivel : (d.fis[p.codigo] || 0), pendente: ps ? ps.pendente : 0,
      });
      const m3un = (Number(p.altura_cm) * Number(p.largura_cm) * Number(p.profundidade_cm)) / 1e6;
      const custo = perm.custo ? rpCustoEfetivo(p) : null;
      return { ...r, p, custo, m3un: m3un > 0 ? m3un : null, fabricado: d.fabricados.has(p.codigo) };
    });
  }, [d, cfg, perm.custo]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d || !cfg) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const doGrupo = linhas.filter(l => grupo === 'todos' || (grupo === 'fabricados' ? l.fabricado : !l.fabricado));
  const cont = (s) => doGrupo.filter(l => l.status === s).length;
  const q = busca.trim().toLowerCase();
  const lista = doGrupo
    .filter(l => statusF === 'todos' ? true : statusF === 'acao' ? (l.status === 'critico' || l.status === 'comprar') : l.status === statusF)
    .filter(l => !q || (l.codigo + ' ' + (l.p.descricao || '') + ' ' + (l.p.familia || '')).toLowerCase().includes(q))
    .sort((a, b) => REP_STATUS[a.status].ordem - REP_STATUS[b.status].ordem || (a.coberturaProj ?? 1e9) - (b.coberturaProj ?? 1e9) || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

  const marcados = lista.filter(l => sel.has(l.codigo));
  const base = marcados.length ? marcados : doGrupo.filter(l => l.sugestao > 0);
  const valor = base.reduce((s, l) => s + (l.custo > 0 ? l.sugestao * l.custo : 0), 0);
  const semCustoN = base.filter(l => l.sugestao > 0 && perm.custo && !(l.custo > 0)).length;
  const m3 = base.reduce((s, l) => s + (l.m3un ? l.sugestao * l.m3un : 0), 0);
  const semDimN = base.filter(l => l.sugestao > 0 && !l.m3un).length;
  const alternar = (cod) => setSel(prev => { const n = new Set(prev); if (n.has(cod)) n.delete(cod); else n.add(cod); return n; });
  const todosMarcados = lista.length > 0 && lista.every(l => sel.has(l.codigo));
  const marcarTodos = () => setSel(prev => { const n = new Set(prev); if (todosMarcados) lista.forEach(l => n.delete(l.codigo)); else lista.forEach(l => n.add(l.codigo)); return n; });

  const chamar = async (body) => {
    const { data, error } = await sb.functions.invoke('sync-pcp-consumo', { body });
    if (error) {
      let det = error.message; try { const j = await error.context.json(); if (j?.error) det = j.error; } catch { /* sem corpo */ }
      throw new Error(det);
    }
    if (!data?.ok) throw new Error(data?.error || 'Falha na leitura do Omie');
    return data;
  };
  const atualizar = async () => {
    try {
      const modo = d.cursor.concluido_ate ? 'recente' : 'historico';
      for (let i = 1; i <= 15; i++) {
        setAtualizando(modo === 'historico' ? `Lendo o histórico de consumo do Omie… (etapa ${i}; pode levar alguns minutos na primeira vez)` : 'Atualizando o consumo recente…');
        const r = await chamar({ modo, dias: 45 });
        if (r.concluido) break;
      }
      setAtualizando('Lendo o que está a caminho…');
      await chamar({ modo: 'posicao' });
      await carregar();
      window.toast?.('Reposição atualizada com os dados do Omie.', 'success');
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setAtualizando(null); }
  };

  const salvarCfg = async () => {
    const n = (v) => Math.max(0, Math.round(Number(v) || 0));
    const corpo = {
      prazo_importado_dias: Math.max(1, n(edit.prazo_importado_dias)), prazo_nacional_dias: Math.max(1, n(edit.prazo_nacional_dias)),
      folga_dias: n(edit.folga_dias), ciclo_dias: n(edit.ciclo_dias),
      origens_excluidas: String(edit.origens_excluidas || '').toUpperCase().replace(/\s+/g, ''),
      atualizado_em: new Date().toISOString(), atualizado_por: window.__VP_USER?.email || null,
    };
    setSalvando(true);
    try {
      const { data, error } = await sb.from('pcp_reposicao_config').update(corpo).eq('id', true).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('Nada foi gravado (sem permissão).');
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Alterou parâmetros da Reposição', alvo: `importado ${corpo.prazo_importado_dias}d · nacional ${corpo.prazo_nacional_dias}d · folga ${corpo.folga_dias}d · ciclo ${corpo.ciclo_dias}d` });
      window.toast?.('Parâmetros salvos.', 'success');
      await carregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };

  const btn = (ativo) => 'btn btn--sm' + (ativo ? ' btn--primary' : '');
  const filtro = (id, rot, n) => <button key={id} className={btn(statusF === id)} onClick={() => setStatusF(id)}>{rot}{n != null ? ` (${n})` : ''}</button>;
  const nAcao = cont('critico') + cont('comprar');
  const lido = d.cursor.concluido_ate ? repData(d.cursor.concluido_ate) : null;
  const campo = (k, rot, hint) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>{rot}
      <input className="input" style={{ width: 130 }} value={edit[k] ?? ''} disabled={!perm.config} onChange={e => setEdit({ ...edit, [k]: e.target.value })}/>
      {hint && <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{hint}</span>}
    </label>
  );

  return (
    <div>
      {!lido && (
        <div style={{ padding: 12, marginBottom: 12, border: '1px solid var(--vp-warning)', borderRadius: 8, fontSize: 13 }}>
          O histórico de consumo ainda não foi carregado por completo. Clique em <b>Atualizar do Omie</b> (leva alguns minutos na primeira vez; depois é automático todo dia de madrugada).
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Críticos</div><div className="pcp-total__v" style={{ color: 'var(--vp-danger)' }}>{cont('critico')}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>vão faltar antes da próxima chegada</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Comprar agora</div><div className="pcp-total__v">{cont('comprar')}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>no ponto de pedido</div></div>
        <div className="pcp-total"><div className="pcp-total__l">{perm.custo ? 'Valor da compra sugerida' : 'Compra sugerida (itens)'}</div>
          <div className="pcp-total__v">{perm.custo ? repMoeda(valor) : repFmt(base.filter(l => l.sugestao > 0).length)}</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{marcados.length ? `${marcados.length} marcado(s)` : 'todos os críticos/comprar'}{semCustoN ? ` · ${semCustoN} sem custo` : ''}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Cubagem do container</div><div className="pcp-total__v">{repFmt(m3, 1)} m³</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{repFmt((m3 / REP_M3_40HC) * 100, 0)}% de um 40'HC (≈{REP_M3_40HC} m³){semDimN ? ` · ${semDimN} sem dimensão (cadastre no Omie)` : ''}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {filtro('acao', 'Precisa agir', nAcao)}{filtro('critico', 'Críticos', cont('critico'))}{filtro('comprar', 'Comprar', cont('comprar'))}{filtro('ok', 'OK', cont('ok'))}{filtro('excesso', 'Excesso', cont('excesso'))}{filtro('sem_giro', 'Sem giro', cont('sem_giro'))}{filtro('todos', 'Todos', null)}
        <span style={{ width: 8 }}/>
        <button className={btn(grupo === 'comprados')} onClick={() => setGrupo('comprados')} title="Itens que a empresa compra (sem estrutura própria)">Comprados</button>
        <button className={btn(grupo === 'fabricados')} onClick={() => setGrupo('fabricados')} title="Itens fabricados pelo PCP (têm estrutura): a reposição de verdade está nos componentes">Fabricados</button>
        <button className={btn(grupo === 'todos')} onClick={() => setGrupo('todos')}>Todos</button>
        <input className="input" style={{ minWidth: 200, marginLeft: 'auto' }} placeholder="Buscar código, descrição ou família…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" onClick={() => setCfgAberta(v => !v)}>Parâmetros</button>
        <button className="btn btn--sm btn--primary" disabled={!!atualizando} onClick={atualizar}>{atualizando ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>
      {atualizando && <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 8 }}>{atualizando}</div>}

      {cfgAberta && (
        <Card title="Parâmetros da reposição" sub={perm.config ? 'Valem para todos os itens. Salvar recalcula a tela.' : 'Somente leitura (sem a alçada de parâmetros da reposição).'}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, alignItems: 'flex-end' }}>
            {campo('prazo_importado_dias', 'Prazo importado (dias)', 'até chegar')}
            {campo('prazo_nacional_dias', 'Prazo nacional (dias)', 'código termina em "n"')}
            {campo('folga_dias', 'Folga (dias)', 'segurança acima do prazo')}
            {campo('ciclo_dias', 'Ciclo / container (dias)', 'consumo extra por compra')}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>Origens fora do consumo
              <input className="input" style={{ width: 230 }} value={edit.origens_excluidas ?? ''} disabled={!perm.config} onChange={e => setEdit({ ...edit, origens_excluidas: e.target.value })}/>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}>códigos do Omie separados por vírgula (COM = compra…)</span>
            </label>
            {perm.config && <button className="btn btn--sm btn--primary" disabled={salvando} onClick={salvarCfg}>{salvando ? 'Salvando…' : 'Salvar parâmetros'}</button>}
          </div>
        </Card>
      )}

      <Card title="Reposição por consumo real" sub={`${lista.length} item(ns) · histórico desde ${repData(cfg.janela_desde)}${lido ? ` · lido até ${lido}` : ''} · ${repFmt(d.nMovs)} movimentos`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>
              <th style={{ width: 28 }}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} title="Marcar todos os itens da lista"/></th>
              <th>Item</th><th>Situação</th><th style={{ textAlign: 'right' }}>Consumo/mês</th><th style={{ textAlign: 'right' }}>Prazo</th>
              <th style={{ textAlign: 'right' }}>Disponível</th><th style={{ textAlign: 'right' }}>A caminho</th>
              <th style={{ textAlign: 'right' }}>Cobertura</th><th style={{ textAlign: 'right' }}>Pedir quando ≤</th><th style={{ textAlign: 'right' }}>Máximo</th>
              <th style={{ textAlign: 'right' }}>Sugestão</th>{perm.custo && <th style={{ textAlign: 'right' }}>Valor</th>}<th style={{ textAlign: 'right' }}>m³</th>
            </tr></thead>
            <tbody>
              {lista.slice(0, 400).map(l => {
                const st = REP_STATUS[l.status];
                return (
                  <tr key={l.codigo}>
                    <td><input type="checkbox" checked={sel.has(l.codigo)} onChange={() => alternar(l.codigo)}/></td>
                    <td style={{ minWidth: 220 }}>
                      <b style={{ fontWeight: 500 }}>{l.codigo}</b>
                      <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.p.descricao}</div>
                    </td>
                    <td><Badge variant={st.variant}>{l.fabricado && (l.status === 'critico' || l.status === 'comprar') ? 'Produzir' : st.label}</Badge>{l.fabricado ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="Tem estrutura no PCP: é fabricado, o prazo de importação não se aplica; veja os componentes.">fabricado</div> : null}{l.faltaAntesDeChegar && l.status === 'ok' ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="O estoque em mãos acaba antes do prazo de chegada; depende do que está a caminho.">depende do que vem</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{l.mediaMensal > 0 ? repFmt(l.mediaMensal, 1) : '—'}{l.tendencia === 'alta' ? <span title="Últimos 6 meses acima da média" style={{ color: 'var(--vp-danger)' }}> ▲</span> : l.tendencia === 'baixa' ? <span title="Últimos 6 meses abaixo da média" style={{ color: 'var(--fg3)' }}> ▼</span> : null}{l.historicoCurto ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>histórico curto</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{l.prazo}d{l.nacional ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>nacional</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{repFmt(l.disponivel, 2)}</td>
                    <td style={{ textAlign: 'right' }}>{l.aCaminho ? repFmt(l.aCaminho, 2) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.coberturaProj != null ? `${repFmt(l.coberturaProj, 0)}d` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.pedido != null ? repFmt(l.pedido, 1) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.maximo != null ? repFmt(l.maximo, 1) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.sugestao > 0 ? `${repFmt(l.sugestao)} ${l.p.unidade || ''}` : l.excesso > 0 ? <span style={{ fontWeight: 400, color: 'var(--fg3)' }}>+{repFmt(l.excesso)} acima</span> : '—'}</td>
                    {perm.custo && <td style={{ textAlign: 'right' }}>{l.sugestao > 0 ? (l.custo > 0 ? repMoeda(l.sugestao * l.custo) : <span title="Sem custo cadastrado">⚠</span>) : '—'}</td>}
                    <td style={{ textAlign: 'right' }}>{l.sugestao > 0 ? (l.m3un ? repFmt(l.sugestao * l.m3un, 2) : <span title="Sem dimensões cadastradas">?</span>) : '—'}</td>
                  </tr>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={perm.custo ? 13 : 12} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        {lista.length > 400 && <div style={{ padding: 8, fontSize: 12, color: 'var(--fg3)' }}>Mostrando 400 de {lista.length}; use a busca ou os filtros.</div>}
      </Card>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        <b style={{ fontWeight: 500 }}>Como ler:</b> o consumo médio vem das saídas reais do estoque do Omie (vendas, remessas, consumo de OP, saídas manuais; devoluções abatem; compras e importações não contam) em meses completos, a partir do primeiro movimento do item.
        <b style={{ fontWeight: 500 }}> Posição</b> = disponível + o que já está a caminho. <b style={{ fontWeight: 500 }}>Crítico</b>: a posição não cobre nem o prazo de chegada ({cfg.prazo_importado_dias} dias importado / {cfg.prazo_nacional_dias} nacional).
        <b style={{ fontWeight: 500 }}> Comprar</b>: a posição chegou no ponto de pedido (prazo + {cfg.folga_dias} dias de folga). A sugestão leva a posição até o <b style={{ fontWeight: 500 }}>máximo</b> (prazo + folga + {cfg.ciclo_dias} dias de ciclo). O estoque mínimo do Omie não é usado.
        {!perm.custo && ' Valores aparecem só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

Object.assign(window, { AlmoxarifadoReposicao });
