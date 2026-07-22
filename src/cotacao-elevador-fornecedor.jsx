/* ============================================================
   cotacao-elevador-fornecedor.jsx
   Portal PÚBLICO de cotação técnica ao fornecedor (Glarie, por ora).
   O fornecedor abre /cotacao-elevador-fornecedor/<token>, lê a
   especificação técnica das unidades (Elevator ou Homelift Inquiry Form,
   conforme o Tipo) e devolve a cotação comercial (preço, prazo, garantia,
   condições) — sem PDF, sem digitação manual, direto no VP Gestão.
   Reusa o mesmo visual do portal de Pedido a Fornecedor (styles/cotacao.css).
   ============================================================ */
const { useState: _cefUS, useEffect: _cefUE, useMemo: _cefUM } = React;

const CEF_MOEDAS = [
  { v: 'USD', l: 'USD · Dólar' }, { v: 'EUR', l: 'EUR · Euro' },
  { v: 'CNY', l: 'CNY · Yuan' }, { v: 'BRL', l: 'BRL · Real' },
];

function cefSimNao(v) { return v ? 'Sim / Yes' : 'Não / No'; }
function cefMm(v) { return (v === '' || v === null || v === undefined) ? '' : `${v}mm`; }

/* Linhas de especificação bilíngues (PT / EN) de 1 unidade, agrupadas por
   seção — mesma estrutura do "Elevator/Homelift Inquiry Form" da Glarie. */
function cefSecoesUnidade(u, tipoFormulario) {
  const store = window.CotacaoElevadorFornecedorStore;
  const isElevator = tipoFormulario === 'elevator';
  const principais = [
    ['Número do elevador', 'Lift No.', u.identificador],
    isElevator && ['Modelo do elevador', 'Lift Model', store.liftModelLabel(u.tipo)],
    ['Estrutura do elevador', 'Shaft structure', u.estrutura_caixa],
    isElevator && ['Casa de máquinas', 'Machine Room Type', store.machineRoomLabel(u.casa_maquinas)],
    ['Capacidade', 'Rated Capacity', `${u.capacidade_pessoas ? u.capacidade_pessoas + 'pass / ' : ''}${u.capacidade_kg || ''}kg`],
    ['Velocidade', 'Rated Speed', u.velocidade_ms ? `${u.velocidade_ms}m/s` : ''],
    ['Andares/Paradas/Portas', 'Floors/Stops/Doors', u.paradas ? `${u.paradas}/${u.paradas}/${u.paradas}` : ''],
    ['Descrição dos pavimentos', 'Floor Marks', u.pavimentos_desc],
    isElevator && ['Modelo de controle', 'Control Model', store.controleLabel(u.agrupamento)],
    ['Tamanho da caixa', 'Shaft Size (W×D)', (u.caixa_largura_mm || u.caixa_profundidade_mm) ? `${u.caixa_largura_mm || '?'} x ${u.caixa_profundidade_mm || '?'} mm` : ''],
    ['Última altura', 'Overhead', cefMm(u.overhead_mm)],
    ['Poço', 'Shaft Pit', cefMm(u.poco_mm)],
    ['Percurso', 'Travel Height', cefMm(u.percurso_mm)],
    ['Porta oposta', 'Open-Through Door', u.porta_oposta],
  ].filter(Boolean);

  const cabina = [
    ['Largura da cabina', 'Car Width', cefMm(u.cabina_largura_mm)],
    ['Profundidade da cabina', 'Car Depth', cefMm(u.cabina_profundidade_mm)],
    ['Altura da cabina', 'Car Height', cefMm(u.cabina_altura_mm)],
    ['Teto falso', 'Car Ceiling', u.teto_falso],
    ['Piso da cabina', 'Car Floor', u.piso_cabina],
    ['Corrimão', 'Car Handrail', u.corrimao],
  ];

  const portas = [
    ['Tipo de abertura', 'Door Opening Type', u.porta_tipo_abertura],
    ['Modelo de porta', 'Door Model', u.porta_modelo],
    ['Largura da porta', 'Door Width', cefMm(u.porta_largura_mm)],
    ['Altura da porta', 'Door Height', cefMm(u.porta_altura_mm)],
    ['Acabamento porta cabina', 'Car Door Finish', u.acabamento_porta_cabina],
    ['Acabamento porta pavimento', 'Landing Door Finish', u.acabamento_porta_pavimento],
    ['Classe corta-fogo', 'Fire Rating', u.classe_corta_fogo],
  ];

  const copLop = [
    ['Botoeira de cabine (COP)', 'COP Type', u.botoeira_cabine],
    ['Botoeira de pavimento (LOP)', 'LOP Type', u.botoeira_pavimento],
  ];

  const opcionais = [
    ['ARD — resgate automático', 'ARD', cefSimNao(u.ard)],
    ['Câmera na cabine', 'Camera in Car', cefSimNao(u.camera)],
    ['Anúncio de voz', 'Voice Announcement', cefSimNao(u.anuncio_voz)],
    u.exigencias_especiais && ['Exigências especiais', 'Special Requirements', u.exigencias_especiais],
  ].filter(Boolean);

  return [
    { titulo: 'A. Especificações Principais / Main Specification', linhas: principais },
    { titulo: 'B. Cabine / Car', linhas: cabina },
    { titulo: 'C. Portas / Door', linhas: portas },
    { titulo: 'D. COP e LOP', linhas: copLop },
    { titulo: 'E. Opcionais / Options', linhas: opcionais },
  ];
}

function CefSpecTable({ linhas }) {
  const preenchidas = linhas.filter((l) => l[2] !== '' && l[2] !== null && l[2] !== undefined);
  if (!preenchidas.length) return null;
  return (
    <table className="co-specs"><tbody>
      {preenchidas.map(([pt, en, v], i) => (
        <tr key={i}><td className="co-spec-k">{pt} / {en}</td><td className="co-spec-v">{String(v)}</td></tr>
      ))}
    </tbody></table>
  );
}

function CefUnidadeRead({ u, tipoFormulario, idx }) {
  const secoes = cefSecoesUnidade(u, tipoFormulario);
  return (
    <div className="co-block">
      <div className="co-sec-lbl">Unidade {u.identificador || idx + 1}</div>
      {secoes.map((s) => (
        <div key={s.titulo} style={{ marginTop: 10 }}>
          <b style={{ fontSize: 12 }}>{s.titulo}</b>
          <CefSpecTable linhas={s.linhas}/>
        </div>
      ))}
    </div>
  );
}

function CefUnidadeFill({ u, val, onChange, readOnly }) {
  const f = (k) => (e) => onChange(k, e.target.value);
  return (
    <div className="co-fill" style={{ background: '#fcfcf7', borderRadius: 12, marginTop: 10 }}>
      <b style={{ fontSize: 12 }}>Resposta — Unidade {u.identificador}</b>
      <label className="co-f">
        <span>Modelo do fornecedor / Supplier model</span>
        <input className="co-inp" value={val.modelo_fornecedor || ''} onChange={f('modelo_fornecedor')} placeholder="ex.: GEP-MRL" disabled={readOnly}/>
      </label>
      <label className="co-f">
        <span>Andares/Paradas/Portas confirmados / Confirmed Floors-Stops-Doors</span>
        <input className="co-inp" value={val.floors_stops_doors || ''} onChange={f('floors_stops_doors')} placeholder="ex.: 9/9/9" disabled={readOnly}/>
      </label>
      <div className="co-f-row">
        <label className="co-f">
          <span>Preço unitário / Unit Price</span>
          <input className="co-inp" inputMode="decimal" value={val.preco_unitario || ''} onChange={f('preco_unitario')} placeholder="0.00" disabled={readOnly}/>
        </label>
        <label className="co-f">
          <span>Preço total / Total Price</span>
          <input className="co-inp" inputMode="decimal" value={val.preco_total || ''} onChange={f('preco_total')} placeholder="0.00" disabled={readOnly}/>
        </label>
      </div>
      <label className="co-f">
        <span>Confirmação técnica / Technical confirmation <span className="co-en">(marca da máquina, do controle, distância entre guias etc.)</span></span>
        <textarea className="co-inp" rows={2} value={val.confirmacao_tecnica || ''} onChange={f('confirmacao_tecnica')} disabled={readOnly}/>
      </label>
    </div>
  );
}

function CotacaoElevadorFornecedorApp() {
  function extractToken() {
    const m = location.pathname.match(/\/cotacao-elevador-fornecedor\/([^/]+)/);
    if (m) return decodeURIComponent(m[1]);
    return new URLSearchParams(location.search).get('t');
  }
  const token = extractToken();
  const store = window.CotacaoElevadorFornecedorStore;

  const [loading, setLoading] = _cefUS(true);
  const [notFound, setNotFound] = _cefUS(false);
  const [cot, setCot] = _cefUS(null);
  const [phase, setPhase] = _cefUS('fill');

  const [moeda, setMoeda] = _cefUS('USD');
  const [incotermPorto, setIncotermPorto] = _cefUS('FOB Shanghai');
  const [condicoesPagamento, setCondicoesPagamento] = _cefUS('');
  const [prazoFabricacao, setPrazoFabricacao] = _cefUS('');
  const [garantia, setGarantia] = _cefUS('');
  const [validadeDias, setValidadeDias] = _cefUS('30');
  const [embalagem, setEmbalagem] = _cefUS('');
  const [containerNo, setContainerNo] = _cefUS('');
  const [documentosEmbarque, setDocumentosEmbarque] = _cefUS('');
  const [observacoesGerais, setObservacoesGerais] = _cefUS('');
  const [itemVals, setItemVals] = _cefUS({});

  _cefUE(() => {
    (async () => {
      if (!token || !store) { setLoading(false); setNotFound(true); return; }
      const rec = await store.getByToken(token);
      if (!rec || rec.status === 'rascunho') { setLoading(false); setNotFound(true); return; }
      const unidades = (rec.dados_envio && rec.dados_envio.unidades) || [];
      const seed = {};
      unidades.forEach((u) => { seed[u.unidade_id] = { modelo_fornecedor: '', floors_stops_doors: '', preco_unitario: '', preco_total: '', confirmacao_tecnica: '' }; });
      if (rec.status === 'respondido' && rec.respostas) {
        const r = rec.respostas;
        setMoeda(r.moeda || 'USD'); setIncotermPorto(r.incoterm_porto || '');
        setCondicoesPagamento(r.condicoes_pagamento || ''); setPrazoFabricacao(r.prazo_fabricacao || '');
        setGarantia(r.garantia || ''); setValidadeDias(r.validade_dias || '');
        setEmbalagem(r.embalagem || ''); setContainerNo(r.container_no || '');
        setDocumentosEmbarque(r.documentos_embarque || ''); setObservacoesGerais(r.observacoes_gerais || '');
        (r.itens || []).forEach((it) => { if (seed[it.unidade_id]) seed[it.unidade_id] = { modelo_fornecedor: it.modelo_fornecedor || '', floors_stops_doors: it.floors_stops_doors || '', preco_unitario: it.preco_unitario || '', preco_total: it.preco_total || '', confirmacao_tecnica: it.confirmacao_tecnica || '' }; });
        setItemVals(seed);
        setCot(rec); setPhase('done'); setLoading(false); return;
      }
      setItemVals(seed);
      const updated = await store.marcarVisualizado(token);
      setCot(updated || rec);
      setLoading(false);
    })();
  }, [token]);

  const setItemVal = (uid, k, v) => setItemVals((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [k]: v } }));

  if (loading) return <div className="co-status"><div className="co-spinner"/><h1>Carregando cotação…</h1><p>Validando o link.</p></div>;
  if (notFound || !cot) {
    return (
      <div className="co-shell"><div className="co-err">
        <h1>Link inválido</h1>
        <p>Esta cotação não foi encontrada, ainda não foi enviada ou o link expirou.<br/>
        <span className="co-en">This quotation request was not found, was not sent yet, or the link expired.</span></p>
      </div></div>
    );
  }

  const unidades = (cot.dados_envio && cot.dados_envio.unidades) || [];
  const header = (cot.dados_envio && cot.dados_envio.header) || {};
  const readOnly = phase === 'done';

  const enviar = async () => {
    setPhase('sending');
    const respostas = {
      moeda, incoterm_porto: incotermPorto, condicoes_pagamento: condicoesPagamento,
      prazo_fabricacao: prazoFabricacao, garantia, validade_dias: validadeDias,
      embalagem, container_no: containerNo, documentos_embarque: documentosEmbarque,
      observacoes_gerais: observacoesGerais,
      itens: unidades.map((u) => ({ unidade_id: u.unidade_id, unidade_identificador: u.identificador, ...(itemVals[u.unidade_id] || {}) })),
    };
    try {
      const updated = await store.salvarResposta(token, respostas);
      setCot(updated);
      setPhase('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('Erro ao enviar / Error: ' + (e.message || e));
      setPhase('fill');
    }
  };

  if (phase === 'sending') return <div className="co-status"><div className="co-spinner"/><h1>Enviando cotação…</h1></div>;

  return (
    <div className="co-shell">
      <div className="co-top">
        <img src="/assets/logo-mark-yellow.png" alt="VerticalParts"/>
        <span className="co-secure">🔒 Seguro · Secure</span>
      </div>

      {phase === 'done' && (
        <div className="co-done-banner">
          <div className="co-check">✓</div>
          <div>
            <b>Cotação enviada! · Quotation submitted!</b>
            <div className="co-done-sub">Obrigado. A VerticalParts recebeu sua cotação. · Thank you, VerticalParts received your quotation.</div>
          </div>
        </div>
      )}

      <div className="co-intro-head">
        <h1>Solicitação de Cotação Técnica · Technical Quotation Request</h1>
        <div className="co-num">{cot.numero_documento} · {header.data}</div>
        {!readOnly && (
          <p className="co-lead">
            A VerticalParts solicita sua cotação para o(s) elevador(es) abaixo. Preencha os campos de resposta ao final de cada unidade.<br/>
            <span className="co-en">VerticalParts requests your quotation for the elevator(s) below. Fill in the response fields at the end of each unit.</span>
          </p>
        )}
      </div>

      <div className="co-parties">
        <div className="co-party">
          <div className="co-party-lbl">Comprador · Buyer</div>
          <b>VerticalParts</b>
        </div>
        <div className="co-party">
          <div className="co-party-lbl">Fornecedor · Supplier</div>
          <b>{cot.fornecedor}</b>
        </div>
      </div>

      <div className="co-block">
        <div className="co-sec-lbl">Dados gerais do projeto / Project data</div>
        <CefSpecTable linhas={[
          ['País', 'Country', header.pais],
          ['Norma de projeto', 'Design Standard', header.norma_projeto],
          ['Voltagem — Elevador', 'Main Power', header.tensao_principal],
          ['Voltagem — Iluminação', 'Lighting Power', header.tensao_iluminacao],
        ]}/>
      </div>

      {unidades.map((u, i) => (
        <div key={u.unidade_id || i}>
          <CefUnidadeRead u={u} tipoFormulario={cot.tipo_formulario} idx={i}/>
          <CefUnidadeFill u={u} val={itemVals[u.unidade_id] || {}} onChange={(k, v) => setItemVal(u.unidade_id, k, v)} readOnly={readOnly}/>
        </div>
      ))}

      <div className="co-global">
        <div className="co-sec-lbl">Condições da cotação · Quotation terms</div>
        <div className="co-global-grid">
          <label className="co-f">
            <span>Moeda · Currency</span>
            <select className="co-inp" value={moeda} onChange={(e) => setMoeda(e.target.value)} disabled={readOnly}>
              {CEF_MOEDAS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </label>
          <label className="co-f">
            <span>Incoterm / Porto · Incoterm / Port</span>
            <input className="co-inp" value={incotermPorto} onChange={(e) => setIncotermPorto(e.target.value)} placeholder="ex.: FOB Shanghai" disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Prazo de fabricação · Delivery time</span>
            <input className="co-inp" value={prazoFabricacao} onChange={(e) => setPrazoFabricacao(e.target.value)} placeholder="ex.: 30 dias após confirmação" disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Garantia · Warranty</span>
            <input className="co-inp" value={garantia} onChange={(e) => setGarantia(e.target.value)} placeholder="ex.: 24 meses" disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Validade da proposta (dias) · Valid period (days)</span>
            <input className="co-inp" inputMode="numeric" value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Container</span>
            <input className="co-inp" value={containerNo} onChange={(e) => setContainerNo(e.target.value)} placeholder="ex.: 1x20GP" disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Embalagem · Packing</span>
            <input className="co-inp" value={embalagem} onChange={(e) => setEmbalagem(e.target.value)} disabled={readOnly}/>
          </label>
          <label className="co-f">
            <span>Documentos no embarque · Documents with shipment</span>
            <input className="co-inp" value={documentosEmbarque} onChange={(e) => setDocumentosEmbarque(e.target.value)} disabled={readOnly}/>
          </label>
        </div>
        <label className="co-f" style={{ marginTop: 10 }}>
          <span>Observações gerais · General remarks</span>
          <textarea className="co-inp" rows={2} value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} disabled={readOnly}/>
        </label>
      </div>

      {!readOnly && (
        <div className="co-actionbar">
          <button className="co-send-btn" onClick={enviar}>Enviar cotação · Submit quotation</button>
          <p className="co-foot-meta">Ao enviar, registramos data/hora e IP para confirmação. · By submitting, we log date/time and IP for confirmation.</p>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('cef-root')).render(<CotacaoElevadorFornecedorApp/>);
