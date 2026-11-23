/* Financeiro & Preços › Boletos Avisos › Índice de inadimplência e Consulta de cliente (score).
   Regra pura em boletos-score-calc.js; dados em boletos-avisos-store.js; spec em docs/modulos/05_financeiro_precos.md (5.5).
   O histórico vem de boletos_avisos_historico (Edge Function boletos-score-sync). Se as tabelas ainda não existirem ou o
   histórico estiver vazio, a tela de Boletos Avisos segue funcionando e estes blocos avisam em vez de quebrar. */

/* Chip da classe (A–D / novo) para a lista e para a consulta */
function BsChip({ r, grande }) {
  if (!r) return <span className="muted small">—</span>;
  const letra = r.classe === 'N' ? 'Novo' : r.classe;
  return (
    <span title={r.rotulo + ' — ' + r.conselho} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontWeight: 700,
      minWidth: grande ? 44 : 28, padding: grande ? '6px 12px' : '1px 8px', borderRadius: 999, fontSize: grande ? 18 : 12,
      background: r.cor + '22', color: r.cor, border: '1px solid ' + r.cor,
    }}>{letra}</span>
  );
}

/* Carrega os limites e o resumo de cada cliente e já classifica. Nunca lança: sem dados devolve mapa vazio. */
function useBoletosScores(versao) {
  const S = window.BoletosAvisosStore, K = window.BoletosScoreCalc;
  const [estado, setEstado] = React.useState({ map: new Map(), cfg: null, pronto: false, erro: null });
  React.useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const [cfg, linhas] = await Promise.all([S.scoreConfig(), S.listarScores()]);
        const map = new Map();
        for (const r of linhas) map.set(Number(r.codigo_cliente_omie), { ...r, cls: K.classificar(r, cfg) });
        if (vivo) setEstado({ map, cfg, pronto: true, erro: null });
      } catch (e) { if (vivo) setEstado({ map: new Map(), cfg: null, pronto: true, erro: e.message }); }
    };
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 300000);
    return () => { vivo = false; clearInterval(t); };
  }, [versao]);
  return estado;
}

/* ---------------- Card: Índice de inadimplência (calendário de início e de fim) ---------------- */
function BoletosIndiceCard() {
  const S = window.BoletosAvisosStore, K = window.BoletosScoreCalc, C = window.BoletosAvisosCalc;
  const hoje = C.hojeBrasil();
  const padrao = K.periodo('passado', '30d', hoje);
  const [deUrl, setDe] = window.useQueryParam ? window.useQueryParam('de', padrao.de) : React.useState(padrao.de);
  const [ateUrl, setAte] = window.useQueryParam ? window.useQueryParam('ate', padrao.ate) : React.useState(padrao.ate);
  const per = K.intervalo(deUrl, ateUrl);
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [histEm, setHistEm] = React.useState(undefined);

  React.useEffect(() => {
    let vivo = true;
    setDados(null);
    if (per.erro) { setErro(null); return () => { vivo = false; }; }
    Promise.all([S.indiceDoPeriodo(per), S.historicoAtualizadoEm()])
      .then(([d, h]) => { if (vivo) { setDados(K.indice(d)); setHistEm(h); setErro(null); } })
      .catch(e => { if (vivo) { setErro(e.message); setDados(null); } });
    return () => { vivo = false; };
  }, [per.de, per.ate, per.erro]);

  const atalhos = K.atalhos(hoje);
  const usar = (a) => { setDe(a.de); setAte(a.ate); };
  const temPassado = !per.erro && per.de < hoje;       // parte do período que já venceu
  const temFuturo = !per.erro && per.ate >= hoje;      // parte que ainda vai vencer
  const semHistorico = histEm === null;
  const kpi = (t, v, cor, sub) => (
    <div style={{ border: '1px solid var(--border, #e5e7eb)', borderLeft: '4px solid ' + cor, borderRadius: 6, padding: '8px 12px' }}>
      <div className="small muted">{t}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor }}>{v}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );

  return (
    <Card>
      <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Índice de inadimplência</div>
            <div className="small muted">Por data de vencimento{per.erro ? '' : ': ' + C.dataBR(per.de) + ' a ' + C.dataBR(per.ate)}. “Vencido” = venceu antes de hoje; o que vence de hoje em diante entra em “A vencer”.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="small" style={{ display: 'grid', gap: 2 }}>Início
              <input type="date" className="input" aria-label="Data de início" value={deUrl || ''} max={ateUrl || undefined} onChange={e => setDe(e.target.value)}/>
            </label>
            <label className="small" style={{ display: 'grid', gap: 2 }}>Fim
              <input type="date" className="input" aria-label="Data de fim" value={ateUrl || ''} min={deUrl || undefined} onChange={e => setAte(e.target.value)}/>
            </label>
          </div>
        </div>
        <div className="small" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} aria-label="Atalhos de período">
          <span className="muted">Atalhos:</span>
          {atalhos.map(a => <a key={a.id} href="#" onClick={e => { e.preventDefault(); usar(a); }} style={{ fontWeight: per.de === a.de && per.ate === a.ate ? 700 : 400 }}>{a.rotulo}</a>)}
        </div>
        {per.erro && <div role="alert" style={{ color: 'var(--vp-danger)' }}>{per.erro}</div>}

        {erro && <div style={{ color: 'var(--vp-danger)' }}>Não consegui ler o índice: {erro}</div>}
        {!erro && semHistorico && <div className="muted">O histórico de pagamentos ainda não foi carregado do Omie. Assim que a primeira carga terminar, o índice aparece aqui.</div>}
        {!erro && !semHistorico && !dados && <div className="muted">Calculando…</div>}

        {!erro && !per.erro && !semHistorico && dados && temPassado && (
          dados.pct === null
            ? <div className="muted">Nenhum título venceu neste período.</div>
            : <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {kpi('Índice de inadimplência', dados.pct.toLocaleString('pt-BR') + '%', dados.pct >= 15 ? '#dc2626' : dados.pct >= 5 ? '#d97706' : '#16a34a', C.moedaBR(dados.aberto) + ' ainda em aberto de ' + C.moedaBR(dados.vencido))}
              {kpi('Pago em dia', C.moedaBR(dados.pagoEmDia), '#16a34a')}
              {kpi('Pago com atraso', C.moedaBR(dados.pagoAtrasado), '#d97706')}
              {kpi('Venceu e não pagou', C.moedaBR(dados.aberto), '#dc2626', dados.titulos + ' títulos no período · ' + dados.clientes + ' clientes')}
            </div>
        )}
        {!erro && !per.erro && !semHistorico && dados && temFuturo && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {kpi('A vencer no período', C.moedaBR(dados.aVencer), '#111827', dados.titulosAVencer + ' títulos · ' + dados.clientesAVencer + ' clientes')}
            <div className="small muted" style={{ alignSelf: 'center' }}>Ainda não venceu: não existe índice de inadimplência para esta parte, só a carteira que vai vencer.</div>
          </div>
        )}
        {histEm && <div className="small muted">Histórico de pagamentos atualizado em {new Date(histEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</div>}
      </div>
    </Card>
  );
}

/* ---------------- Consulta de cliente (score) — /adm-financeiro/boletos-avisos/score[/<cliente>] ---------------- */
function BsLimites({ cfg, onSalvo }) {
  const S = window.BoletosAvisosStore, K = window.BoletosScoreCalc;
  const campos = [
    ['pontualidade_a', 'Classe A: pontualidade mínima (%)'], ['pontualidade_b', 'Classe B: pontualidade mínima (%)'], ['pontualidade_c', 'Classe C: pontualidade mínima (%) — abaixo é D'],
    ['atraso_max_a', 'Classe A: maior atraso tolerado (dias)'], ['atraso_medio_b', 'Classe B: atraso médio tolerado (dias)'], ['atraso_max_b', 'Acima disto no histórico cai para C (dias)'],
    ['aberto_vencido_d', 'Vencido em aberto há mais de (dias) = D'], ['minimo_titulos', 'Mínimo de títulos vencidos para ter nota'], ['tolerancia_dias', 'Tolerância: pago até N dias depois do vencimento conta como em dia'],
  ];
  const base = K.mesclarConfig(cfg);
  const [v, setV] = React.useState(() => Object.fromEntries(campos.map(([k]) => [k, String(base[k])])));
  const [busy, setBusy] = React.useState(false);
  const salvar = async () => {
    const patch = {};
    for (const [k] of campos) { const n = Number(String(v[k]).replace(',', '.')); if (!Number.isFinite(n) || n < 0) { window.toast?.('Valor inválido em: ' + k, 'error'); return; } patch[k] = n; }
    if (patch.pontualidade_a < patch.pontualidade_b || patch.pontualidade_b < patch.pontualidade_c) { window.toast?.('A pontualidade deve ser A ≥ B ≥ C.', 'error'); return; }
    if (!confirm('Mudar os limites muda a classe de todos os clientes. Salvar?')) return;
    setBusy(true);
    try { await S.salvarScoreConfig(patch); window.toast?.('Limites salvos.', 'success'); onSalvo(); } catch (e) { window.toast?.(e.message, 'error'); }
    setBusy(false);
  };
  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', padding: 12, border: '1px solid var(--border, #e5e7eb)', borderRadius: 6 }}>
      {campos.map(([k, rot]) => (
        <label key={k} className="small" style={{ display: 'grid', gap: 2 }}>{rot}
          <input className="input" inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}/>
        </label>
      ))}
      <div><Button size="sm" variant="primary" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar limites'}</Button></div>
    </div>
  );
}

function BoletosConsultaCliente({ voltar, gerir }) {
  const S = window.BoletosAvisosStore, K = window.BoletosScoreCalc, C = window.BoletosAvisosCalc;
  const [codSel, setCodSel] = window.useRotaItem('boletos-avisos', 'score');
  const [q, setQ] = React.useState('');
  const [clientes, setClientes] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const sc = useBoletosScores(tick);
  const [titulos, setTitulos] = React.useState(null);
  const [editando, setEditando] = React.useState(false);

  React.useEffect(() => { S.listarClientesHistorico().then(setClientes).catch(e => { setErro(e.message); setClientes([]); }); }, []);
  React.useEffect(() => {
    if (!codSel) { setTitulos(null); return; }
    setTitulos(null);
    S.titulosDoCliente(Number(codSel)).then(setTitulos).catch(e => { setErro(e.message); setTitulos([]); });
  }, [codSel, tick]);

  const termo = q.trim().toLowerCase(), digitos = q.replace(/\D/g, '');
  const achados = termo.length < 2 ? [] : (clientes || []).filter(c => `${c.razao_social || ''}`.toLowerCase().includes(termo) || (digitos.length >= 3 && String(c.cnpj || '').replace(/\D/g, '').includes(digitos))).slice(0, 12);
  const cliente = codSel ? (clientes || []).find(c => String(c.codigo_cliente_omie) === String(codSel)) : null;
  const resumo = codSel ? sc.map.get(Number(codSel)) : null;
  const cls = resumo ? resumo.cls : (codSel ? K.classificar({}, sc.cfg) : null);
  const hoje = C.hojeBrasil();
  const cfg = K.mesclarConfig(sc.cfg);
  const ind = (t, v, sub) => (<div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, padding: '8px 12px' }}><div className="small muted">{t}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>{sub && <div className="small muted">{sub}</div>}</div>);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro &amp; Preços · Boletos Avisos · Consulta de cliente</div>
          <h1 className="page-head__title">Consulta de cliente</h1>
          <p className="page-head__sub">Antes de liberar uma compra, veja se o cliente costuma pagar em dia. A nota (A a D) e o conselho vêm do histórico de pagamento no Omie desde 01/01/2024; é uma ajuda para decidir, não substitui a avaliação do financeiro.</p>
        </div>
        <div><Button size="sm" variant="outline" onClick={voltar}>← Voltar aos boletos</Button></div>
      </div>

      <Card>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <input className="input" autoFocus placeholder="Buscar cliente por razão social ou CNPJ…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 420 }}/>
          {erro && <div style={{ color: 'var(--vp-danger)' }}>{erro}</div>}
          {sc.erro && <div className="muted">O resumo de pagamento não está disponível ainda ({sc.erro}).</div>}
          {clientes === null && <div className="muted">Carregando clientes…</div>}
          {termo.length >= 2 && clientes && !achados.length && <div className="muted">Nenhum cliente com esse nome ou CNPJ no histórico do Omie. Se for cliente novo, consulte o score externo no Aval Financeiro.</div>}
          {achados.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              {achados.map(c => {
                const r = sc.map.get(Number(c.codigo_cliente_omie));
                return (
                  <button type="button" key={c.codigo_cliente_omie} onClick={() => { setCodSel(String(c.codigo_cliente_omie)); setQ(''); }}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '6px 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
                    <BsChip r={r ? r.cls : K.classificar({}, sc.cfg)}/>
                    <b>{c.razao_social || '(sem nome)'}</b>{c.cnpj && <span className="muted small">{c.cnpj}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {codSel && cls && (
        <Card>
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <BsChip r={cls} grande/>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{cliente ? (cliente.razao_social || '(sem nome)') : 'Cliente ' + codSel}</div>
                <div className="small muted">{cliente && cliente.cnpj ? cliente.cnpj + ' · ' : ''}{cls.rotulo}</div>
              </div>
            </div>
            <div style={{ borderLeft: '4px solid ' + cls.cor, background: cls.cor + '14', padding: '10px 14px', borderRadius: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Conselho</div>
              <div>{cls.conselho}</div>
              {cls.motivos.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Por quê: {cls.motivos.join('; ')}.</div>}
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {ind('Pagou em dia', cls.pontualidade === null ? '—' : cls.pontualidade.toLocaleString('pt-BR') + '%', cls.titulosVencidos + ' título(s) vencido(s)')}
              {ind('Atraso médio', resumo ? Number(resumo.atraso_medio_dias).toLocaleString('pt-BR') + ' dias' : '—', 'só dos pagos com atraso')}
              {ind('Maior atraso', resumo ? resumo.maior_atraso_dias + ' dias' : '—')}
              {ind('Vencido em aberto', resumo ? C.moedaBR(resumo.aberto_vencido_valor) : C.moedaBR(0), resumo && resumo.abertos_vencidos ? resumo.abertos_vencidos + ' título(s), o mais antigo há ' + resumo.aberto_vencido_dias_max + ' dias' : 'nada vencido')}
              {ind('Último pagamento', resumo && resumo.ultimo_pagamento ? C.dataBR(resumo.ultimo_pagamento) : '—')}
              {ind('Cliente desde', resumo && resumo.primeiro_vencimento ? C.dataBR(resumo.primeiro_vencimento) : '—', 'primeiro vencimento no histórico')}
            </div>
            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Últimos títulos</div>
              <div className="table-wrap">
                <table className="t pcp-grid">
                  <thead><tr><th>Situação</th><th>NF · parcela</th><th>Vencimento</th><th>Pago em</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                  <tbody>
                    {titulos === null && <tr><td colSpan={5}>Carregando…</td></tr>}
                    {titulos && !titulos.length && <tr><td colSpan={5} className="muted">Nenhum título deste cliente no histórico.</td></tr>}
                    {(titulos || []).map(t => {
                      const dias = t.pago && t.data_pagamento ? C.diasDesdeVencimento(t.data_vencimento, t.data_pagamento) : null;
                      const situ = t.pago ? (dias !== null && dias > cfg.tolerancia_dias ? ['Pago com ' + dias + ' dia(s) de atraso', '#d97706'] : ['Pago em dia', '#16a34a'])
                        : (t.data_vencimento < hoje ? ['Vencido há ' + C.diasDesdeVencimento(t.data_vencimento, hoje) + ' dia(s)', '#dc2626'] : ['A vencer', '#6b7280']);
                      return (
                        <tr key={t.codigo_lancamento_omie}>
                          <td style={{ color: situ[1], fontWeight: 600 }}>{situ[0]}</td>
                          <td>{[t.numero_documento, t.numero_parcela].filter(Boolean).join(' · ') || '—'}</td>
                          <td>{C.dataBR(t.data_vencimento)}</td>
                          <td>{t.data_pagamento ? C.dataBR(t.data_pagamento) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{C.moedaBR(t.valor)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <details>
              <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Regra usada</summary>
              <div className="small" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                <div><b>A</b>: pagou em dia ≥ {cfg.pontualidade_a}%, maior atraso ≤ {cfg.atraso_max_a} dias e nada vencido em aberto.</div>
                <div><b>B</b>: pagou em dia ≥ {cfg.pontualidade_b}%, atraso médio ≤ {cfg.atraso_medio_b} dias e nunca passou de {cfg.atraso_max_b} dias.</div>
                <div><b>C</b>: pagou em dia ≥ {cfg.pontualidade_c}% mas fora dos limites de A e B.</div>
                <div><b>D</b>: pagou em dia &lt; {cfg.pontualidade_c}% ou tem título vencido em aberto há mais de {cfg.aberto_vencido_d} dias.</div>
                <div><b>Sem histórico</b>: menos de {cfg.minimo_titulos} títulos vencidos. “Em dia” = pago até {cfg.tolerancia_dias} dia(s) depois do vencimento.</div>
                {gerir && <div style={{ marginTop: 6 }}><a href="#" onClick={e => { e.preventDefault(); setEditando(!editando); }}>{editando ? 'Fechar limites' : 'Alterar limites'}</a></div>}
                {gerir && editando && <BsLimites cfg={sc.cfg} onSalvo={() => { setEditando(false); setTick(t => t + 1); }}/>}
              </div>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { BsChip, useBoletosScores, BoletosIndiceCard, BoletosConsultaCliente });
