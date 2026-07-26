/* ============================================================
   assinar-app.jsx
   Página PÚBLICA unificada de assinatura.
   Busca o token em contratos_instalador OU contratos_venda_equipamentos
   e usa o renderer + store correspondente.
   ============================================================ */
const { useState: _sgUS, useEffect: _sgUE, useRef: _sgUR, useMemo: _sgUM, useCallback: _sgUC } = React;

function SgIconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <rect x="4" y="10" width="16" height="11" rx="2"/>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
    </svg>
  );
}

/* ---------- Signature pad (canvas) ---------- */
function SgSignaturePad({ onChange }) {
  const canvasRef = _sgUR(null);
  const drawing = _sgUR(false);
  const last = _sgUR(null);
  const [empty, setEmpty] = _sgUS(true);

  const setup = _sgUC(() => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#15233f';
  }, []);

  _sgUE(() => {
    setup();
    const onResize = () => setup();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setup]);

  const pos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!empty) onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="ci-sig-pad-wrap">
      <canvas ref={canvasRef} className="ci-sig-pad"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <div className="ci-sig-pad-base"></div>
      <span className="ci-sig-pad-x">✕</span>
      {empty && <div className="ci-sig-pad-ph">Assine aqui com o dedo ou mouse</div>}
      {!empty && <button className="ci-sig-clear" onClick={clear}>Limpar</button>}
    </div>
  );
}

function SgSumRow({ k, v }) { return <div className="ci-sum-row"><span className="k">{k}</span><span className="v">{v}</span></div>; }

/* Cada tabela usa seu próprio vocabulário de status (contratos: masculino
   rascunho/enviado/visualizado/assinado/recusado/expirado; propostas:
   feminino rascunho/enviada/visualizada/aprovada/recusada/expirada — já
   existia antes desta página, então reaproveitamos em vez de mudar). */
const STATUS_ALIASES = {
  instalador: { signed: 'assinado', refused: 'recusado', expired: 'expirado' },
  venda:      { signed: 'assinado', refused: 'recusado', expired: 'expirado' },
  proposta:   { signed: 'aprovada', refused: 'recusada', expired: 'expirada' },
};

/* Resolve a "fonte" (instalador vs venda vs proposta) a partir do token */
async function resolveSource(token) {
  // Tenta primeiro instalador (token mais comum nesse momento)
  if (window.CIStore) {
    const r = await window.CIStore.getByToken(token);
    if (r) return { kind: 'instalador', rec: r, store: window.CIStore, Preview: window.CIContractPreview, engine: window.CI };
  }
  if (window.CVStore) {
    const r = await window.CVStore.getByToken(token);
    if (r) return { kind: 'venda', rec: r, store: window.CVStore, Preview: window.CVContractPreview, engine: window.CV };
  }
  if (window.PropostaStore) {
    const r = await window.PropostaStore.getByToken(token);
    if (r) return { kind: 'proposta', rec: r, store: window.PropostaStore, Preview: null, engine: null };
  }
  return null;
}

function SgApp() {
  function extractToken() {
    const m = location.pathname.match(/\/assinar\/([^/]+)/);
    if (m) return decodeURIComponent(m[1]);
    const h = (location.hash || '').replace(/^#/, '');
    if (h) return decodeURIComponent(h);
    return new URLSearchParams(location.search).get('t');
  }
  const token = extractToken();
  const [source, setSource] = _sgUS(null); // { kind, rec, store, Preview, engine }
  const [loading, setLoading] = _sgUS(true);
  const [notFound, setNotFound] = _sgUS(false);
  const [phase, setPhase] = _sgUS('sign'); // sign | processing | done | refused
  const [scrolledEnd, setScrolledEnd] = _sgUS(false);
  const [consent, setConsent] = _sgUS(false);
  const [sigMode, setSigMode] = _sgUS('draw');
  const [drawData, setDrawData] = _sgUS(null);
  const [typedName, setTypedName] = _sgUS('');
  const viewerRef = _sgUR(null);

  /* Mount: localiza o contrato e marca como visualizado */
  _sgUE(() => {
    (async () => {
      if (!token) { setLoading(false); setNotFound(true); return; }
      const src = await resolveSource(token);
      if (!src) { setLoading(false); setNotFound(true); return; }

      const r = src.rec;
      const st = STATUS_ALIASES[src.kind];
      if (r.status === st.signed) { setSource(src); setPhase('done'); setLoading(false); return; }
      if (r.status === st.refused || r.status === st.expired) { setSource(src); setLoading(false); return; }

      const updated = await src.store.markViewed(token);
      setSource({ ...src, rec: updated || r });
      setLoading(false);
    })();
  }, [token]);

  /* Builda o doc renderizável usando a engine correta */
  const doc = _sgUM(() => {
    if (!source) return null;
    const rec = source.rec;
    if (source.kind === 'proposta') return null; // PEPreview renderiza a versão publicada (ver conteudoVigente)
    if (source.kind === 'instalador') {
      return window.CI.buildContract(rec.form_state, rec.numero_documento);
    }
    // venda
    return window.CV.buildContract({
      form: rec.form_state, comprador: (rec.form_state || {}).comprador,
      valor: (rec.valor_total_num != null) ? rec.valor_total_num : window.CV.parseMoney((rec.form_state || {}).valor),
      sinalPct: (rec.form_state || {}).sinalPct, parcelas: (rec.form_state || {}).parcelas,
      numero: rec.numero_documento,
    });
  }, [source]);

  const onScroll = () => {
    const el = viewerRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledEnd(true);
  };

  const sigValid = sigMode === 'draw' ? !!drawData : typedName.trim().length >= 3;
  const canSign = scrolledEnd && consent && sigValid && source;

  const handleSign = async () => {
    if (!source) return;
    setPhase('processing');
    const rec = source.rec;
    const defaultName = source.kind === 'instalador'
      ? (rec.responsavel_nome || rec.contratada_nome)
      : source.kind === 'proposta'
      ? ((window.PropostaStore.conteudoVigente(rec).cliente || {}).nome)
      : (rec.responsavel_nome || rec.comprador_razao_social);
    const sig = sigMode === 'draw'
      ? { type: 'draw', data: drawData, signerName: defaultName }
      : { type: 'type', data: typedName.trim(), signerName: typedName.trim() };
    await new Promise(r => setTimeout(r, 1200));
    const updated = await source.store.markSigned(token, sig);
    setSource({ ...source, rec: updated });
    setPhase('done');
  };

  const handleRefuse = async () => {
    if (!source) return;
    if (!window.confirm(`Recusar a assinatura ${source.kind === 'proposta' ? 'desta proposta' : 'deste contrato'}? A Vertical Parts será notificada.`)) return;
    const updated = await source.store.refuse(token);
    setSource({ ...source, rec: updated });
    setPhase('refused');
  };

  if (loading) {
    return (
      <div className="ci-sign-status">
        <div className="ci-spinner"></div>
        <h1>Carregando contrato…</h1>
        <p>Validando o link de assinatura.</p>
      </div>
    );
  }

  if (notFound || !source) {
    return (
      <div className="ci-sign-shell">
        <div className="ci-err-state">
          <h1>Link inválido</h1>
          <p>Este link de assinatura não foi encontrado ou expirou. Solicite um novo link à Vertical Parts.</p>
        </div>
      </div>
    );
  }

  const rec = source.rec;
  const Preview = source.Preview;
  const st = STATUS_ALIASES[source.kind];

  if (rec.status === st.expired) {
    return (
      <div className="ci-sign-shell">
        <div className="ci-err-state">
          <h1>Link expirado</h1>
          <p>Este link expirou (validade de 7 dias). Solicite o reenvio à Vertical Parts.</p>
        </div>
      </div>
    );
  }
  if (phase === 'processing') {
    return (
      <div className="ci-sign-status">
        <div className="ci-spinner"></div>
        <h1>Processando…</h1>
        <p>Registrando sua assinatura e gerando o documento final com a trilha de auditoria.</p>
      </div>
    );
  }
  if (phase === 'done' || rec.status === st.signed) {
    const a = rec.audit || {};
    return (
      <div className="ci-sign-status">
        <div className="ci-success-check">✓</div>
        <h1>{source.kind === 'proposta' ? 'Proposta assinada!' : 'Contrato assinado!'}</h1>
        <p>{source.kind === 'proposta' ? 'A proposta' : 'O contrato'} <b>{rec.numero_documento}</b> foi assinado(a) com sucesso.</p>
        <div className="ci-protocolo">
          Protocolo: {rec.token}<br/>
          Assinado em {source.store.fmtDateTime(a.signedAt)}<br/>
          Hash: {(a.hash || '').slice(0, 32)}…
        </div>
        <button className="ci-sign-btn" onClick={() => window.print()}>Baixar cópia assinada (PDF)</button>
      </div>
    );
  }
  if (phase === 'refused' || rec.status === st.refused) {
    return (
      <div className="ci-sign-shell">
        <div className="ci-err-state">
          <h1>Assinatura recusada</h1>
          <p>Obrigado pelo retorno. A Vertical Parts foi notificada e entrará em contato em breve.</p>
        </div>
      </div>
    );
  }

  /* Resumo do card de topo varia por tipo */
  const isInstalador = source.kind === 'instalador';
  const isProposta = source.kind === 'proposta';
  const djVigente = isProposta ? window.PropostaStore.conteudoVigente(rec) : {};
  const djCliente = (djVigente && djVigente.cliente) || {};
  const counterpartyName = isInstalador ? rec.contratada_nome : isProposta ? djCliente.nome : rec.comprador_razao_social;
  const counterpartyLabel = isInstalador ? 'Contratada' : isProposta ? 'Cliente' : 'Comprador';
  const titulo = isProposta ? (rec.titulo || rec.numero_documento) : rec.titulo;
  const objetoResumo = isProposta
    ? (((djVigente.elevador || {}).valores || {}).equipamento || 'Proposta comercial')
    : rec.objeto_resumo;
  const valorFmt = isInstalador
    ? (rec.valor_total ? 'R$ ' + window.CI.fmtMoeda(rec.valor_total) : '—')
    : isProposta
    ? (rec.valor_total ? window.CV.brl(Number(rec.valor_total)) : '—')
    : (rec.valor_total_num ? window.CV.brl(rec.valor_total_num) : '—');

  return (
    <div className="ci-sign-shell">
      <div className="ci-sign-top">
        <img src="/assets/logo-mark-yellow.png" alt="VerticalParts"/>
        <span className="ci-secure"><SgIconLock/> Seguro</span>
      </div>

      <div className="ci-sign-intro">
        <h1>{isProposta ? 'Assine sua proposta' : 'Assine seu contrato'}</h1>
        <p>A Vertical Parts enviou {isProposta ? 'esta proposta comercial' : 'este contrato'} para sua assinatura digital. Leia o documento, confirme e assine — sem precisar de cadastro.</p>
      </div>

      <div className="ci-sum-card">
        <div className="ci-sum-head">
          <div className="num">{rec.numero_documento}</div>
          <div className="title">{titulo}</div>
        </div>
        <div className="ci-sum-rows">
          <SgSumRow k={isInstalador ? 'Contratante' : 'Vendedora'} v="Vertical Parts Ltda."/>
          <SgSumRow k={counterpartyLabel} v={counterpartyName}/>
          <SgSumRow k="Objeto" v={objetoResumo}/>
          <SgSumRow k="Valor total" v={valorFmt}/>
        </div>
      </div>

      <div className="ci-sign-label"><span className="n">1</span> Leia {isProposta ? 'a proposta' : 'o contrato'}</div>
      <div className="ci-doc-viewer">
        <div className="ci-doc-viewer-scroll" ref={viewerRef} onScroll={onScroll}>
          {isProposta
            ? <window.PEPreview data={window.PropostaStore.conteudoVigente(rec)} eq={rec.proposal_type || 'elevador'}/>
            : <Preview doc={doc} highlightConditional={false} highlightInjected={false}/>}
        </div>
        <div className={'ci-scroll-hint' + (scrolledEnd ? ' hidden' : '')}>↓ Role até o fim para habilitar a assinatura</div>
      </div>
      <div className={'ci-read-flag' + (scrolledEnd ? '' : ' pending')}>
        {scrolledEnd ? '✓ Documento lido por completo' : 'Role o documento até o final'}
      </div>

      <div className="ci-sign-label"><span className="n">2</span> Concordância</div>
      <div className={'ci-consent' + (consent ? ' on' : '') + (scrolledEnd ? '' : ' disabled')} onClick={() => scrolledEnd && setConsent(!consent)}>
        <div className="box">{consent && <span>✓</span>}</div>
        <div className="txt">Declaro que li, compreendi e concordo com todos os termos {isProposta ? 'desta proposta' : 'deste contrato'}.</div>
      </div>

      <div className="ci-sign-label"><span className="n">3</span> Sua assinatura</div>
      <div className="ci-sig-tabs">
        <button className={'ci-sig-tab' + (sigMode === 'draw' ? ' on' : '')} onClick={() => setSigMode('draw')}>Desenhar</button>
        <button className={'ci-sig-tab' + (sigMode === 'type' ? ' on' : '')} onClick={() => setSigMode('type')}>Digitar nome</button>
      </div>
      {sigMode === 'draw'
        ? <SgSignaturePad onChange={setDrawData}/>
        : (
          <div className="ci-sig-typed">
            <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Digite seu nome completo"/>
            <div className="preview">{typedName.trim() ? <span>{typedName}</span> : <span className="ph">Sua assinatura aparece aqui</span>}</div>
          </div>
        )}
      <p className="ci-sig-meta">Ao assinar, registramos data/hora, seu IP e dispositivo para fins de auditoria, conforme a MP 2.200-2/2001 e a Lei 14.063/2020.</p>

      <div className="ci-sign-actionbar">
        <button className="ci-sign-btn" disabled={!canSign} onClick={handleSign}>Confirmar e assinar</button>
        {!canSign && <p className="ci-req-hint">{!scrolledEnd ? 'Leia o documento até o fim' : !consent ? 'Marque a concordância' : 'Adicione sua assinatura'}</p>}
        <button className="ci-sign-sub-action" onClick={handleRefuse}>Recusar assinatura</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ci-sign-root')).render(<SgApp/>);
