/* ============================================================
   fabricacao-oficina.jsx — telas Fabricação Corrimão e Fabricação
   Corte (22/10/2026). Mesma receita da Evolução da Fabricação do
   Quadro: 1 card por OP (cada OP é uma UNIDADE; o pedido de venda é o
   pai), trilha de etapas clicável, link público pro chão de fábrica,
   falta de material que pausa. Corte ainda registra a sobra.
   Regras de flegar/pausar/concluir moram no banco (public_fab_*).
   window.FabricacaoCorrimaoPage / window.FabricacaoCortePage
   ============================================================ */

const FO_DESTINOS = {
  corrimao: { titulo: 'Fabricação Corrimão', eyebrow: 'Fabricação · Corrimão', vazio: 'Nenhum corrimão em fabricação no momento.',
    sub: 'Acompanhe cada corrimão (uma OP por unidade do pedido) nas 6 etapas: Mede, Corta, Prepara as pontas, Aplica as camadas, Vulcaniza e Acabamento.' },
  corte: { titulo: 'Fabricação Corte', eyebrow: 'Fabricação · Corte', vazio: 'Nenhum item de corte em fabricação no momento.',
    sub: 'Acompanhe os itens de corte (cabos e outros) nas etapas Separar material, Corte e Qualidade, e registre a sobra quando houver.' },
};

function foNorm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function FOCard({ ordem, destino, podeDesmarcar, onRecarregar }) {
  const U = window.FabOficinaUI, C = window.FabOficinaCalc, S = window.FabricacaoOficinaStore;
  const [busy, setBusy] = React.useState(false);
  const [token, setToken] = React.useState(ordem.token);
  const [verLink, setVerLink] = React.useState(false);
  const pct = C.progresso(ordem.etapas);
  const pausado = C.pausado(ordem.ocorrencias);
  const un = C.unidadeDoTitulo(ordem.titulo);

  const comToken = async (fn, msgOk) => {
    setBusy(true);
    try {
      const t = token || await S.garantirLink(ordem.id, destino, window.__VP_USER?.email);
      setToken(t);
      await fn(t);
      if (msgOk) window.toast?.(msgOk);
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const onToggle = (etapaId, marcar) => {
    if (!marcar) {
      if (!podeDesmarcar) return;
      if (!window.confirm('Desmarcar esta etapa? A OP volta a "em andamento" nesse ponto.')) return;
    }
    comToken((t) => S.flegar(t, etapaId, marcar, window.__VP_USER?.email));
  };
  const copiar = async () => {
    try { const t = token || await S.garantirLink(ordem.id, destino, window.__VP_USER?.email); setToken(t); await navigator.clipboard.writeText(S.urlPublica(t)); window.toast?.('Link copiado.'); setVerLink(true); }
    catch (e) { setVerLink(true); }
  };

  return (
    <div className="fo-card">
      <div className="fo-head">
        <div>
          <div className="fo-tit">{ordem.numero}{ordem.numero_pedido ? ` · Pedido ${ordem.numero_pedido}` : ''}{un ? ` · unidade ${un.n}/${un.de}` : ''}</div>
          <div className="fo-sub">{ordem.titulo}</div>
          <div className="fo-meta">{ordem.cliente || 'Cliente não informado'}{ordem.item_codigo ? ' · ' + ordem.item_codigo : ''}{ordem.prazo_entrega ? ' · entrega ' + U.fmtData(ordem.prazo_entrega) : ''}{destino === 'corte' && ordem.quantidade ? ' · qtd ' + ordem.quantidade : ''}</div>
          {pausado && <div className="fo-pausa">PAUSADA — falta de material</div>}
          {ordem.status === 'concluida' && <div className="fo-ok">✓ Concluída{ordem.data_finalizacao ? ' em ' + U.fmtData(ordem.data_finalizacao) : ''}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="fo-pct">{pct}%</div>
          <button className="fo-btn" onClick={copiar}>Copiar link do chão de fábrica</button>
        </div>
      </div>
      {verLink && token && <div className="fo-meta" style={{ marginTop: 8, wordBreak: 'break-all' }}>{S.urlPublica(token)}</div>}
      <U.Trilha etapas={ordem.etapas} pausado={pausado} podeDesmarcar={podeDesmarcar} busy={busy} onToggle={onToggle} />
      <U.Ocorrencias ocorrencias={ordem.ocorrencias} busy={busy}
        onAbrir={(cod, desc, frente) => comToken((t) => S.abrirOcorrencia(t, cod, desc, frente), 'Falta registrada.')}
        onResolver={(id) => comToken((t) => S.resolverOcorrencia(t, id), 'Ocorrência resolvida.')} />
      {destino === 'corte' && (
        <U.Sobra sobra={ordem.sobra} busy={busy} onSalvar={(q, obs) => comToken((t) => S.registrarSobra(t, q, obs), 'Sobra registrada.')} />
      )}
    </div>
  );
}

function FabricacaoOficinaPage({ destino }) {
  const cfg = FO_DESTINOS[destino];
  const S = window.FabricacaoOficinaStore;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [concluidas, setConcluidas] = React.useState(false);
  const [podeDesmarcar, setPodeDesmarcar] = React.useState(false);

  const carregar = React.useCallback(async () => {
    try { setDados(await S.listar(destino, { concluidas })); setErro(null); }
    catch (e) { setErro(e.message || String(e)); }
  }, [destino, concluidas]);
  React.useEffect(() => { setDados(null); carregar(); }, [carregar]);
  React.useEffect(() => { const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('fabricacao', 'editar_status_quadro')).then((v) => { if (vivo) setPodeDesmarcar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const ordens = dados ? dados.ordens : null;
  const filtradas = React.useMemo(() => {
    if (!ordens) return null;
    const termos = foNorm(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return ordens;
    return ordens.filter((o) => { const t = foNorm([o.numero, o.titulo, o.cliente, o.numero_pedido, o.pedido_codigo, o.item_codigo].join(' ')); return termos.every((x) => t.includes(x)); });
  }, [ordens, busca]);

  const grupos = React.useMemo(() => {
    const m = new Map();
    (filtradas || []).forEach((o) => { const k = o.pedido_codigo == null ? 'sem' : String(o.pedido_codigo); if (!m.has(k)) m.set(k, []); m.get(k).push(o); });
    return [...m.entries()].map(([k, lista]) => ({ k, lista: lista.sort((a, b) => (a.unidade_seq || 0) - (b.unidade_seq || 0)), ped: lista[0].numero_pedido, cliente: lista[0].cliente }));
  }, [filtradas]);

  const C = window.FabOficinaCalc;
  const abertas = (ordens || []).filter((o) => o.status !== 'concluida');
  const pausadas = abertas.filter((o) => C.pausado(o.ocorrencias)).length;
  const pctMedio = abertas.length ? Math.round(abertas.reduce((a, o) => a + C.progresso(o.etapas), 0) / abertas.length) : null;

  return (
    <div className="page fade-in">
      <style>{window.FabOficinaUI.CSS}</style>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />{cfg.eyebrow}</div>
          <h1 className="page-head__title">{cfg.titulo}</h1>
          <p className="page-head__sub">{cfg.sub}</p>
        </div>
      </div>
      {erro && <div className="alert danger" style={{ borderRadius: 6, marginBottom: 14 }}><div><div className="alert__title">Não foi possível carregar</div><div className="alert__sub">{erro}</div></div></div>}
      {!erro && !dados && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>}
      {ordens && (
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <KPI label="OPs em fabricação" value={String(abertas.length)} />
          <KPI label="Pausadas" value={String(pausadas)} sub={pausadas ? 'falta de material' : 'nenhuma pausada'} />
          <KPI label="Progresso médio" value={pctMedio != null ? pctMedio + '%' : '—'} />
        </div>
      )}
      {ordens && (
        <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, OP, pedido ou código…" aria-label="Buscar"
            style={{ flex: '1 1 320px', maxWidth: 480, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg-elev, var(--bg, #fff))', color: 'var(--fg1)' }} />
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} /> mostrar concluídas</label>
        </div>
      )}
      {ordens && ordens.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>{cfg.vazio}</div>}
      {grupos.map((g) => (
        <div key={g.k}>
          <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px' }}>{g.k === 'sem' ? 'Sem pedido de venda' : `Pedido ${g.ped || g.k}`}{g.cliente ? ' — ' + g.cliente : ''} <span style={{ fontWeight: 400, color: 'var(--fg3)' }}>· {g.lista.length} OP(s)</span></div>
          {g.lista.map((o) => <FOCard key={o.id} ordem={o} destino={destino} podeDesmarcar={podeDesmarcar} onRecarregar={carregar} />)}
        </div>
      ))}
    </div>
  );
}

window.FabricacaoCorrimaoPage = function FabricacaoCorrimaoPage() { return <FabricacaoOficinaPage destino="corrimao" />; };
window.FabricacaoCortePage = function FabricacaoCortePage() { return <FabricacaoOficinaPage destino="corte" />; };
