/* ============================================================
   ficha-tecnica-copiloto.jsx
   Widget flutuante do Copiloto NCM/DUIMP.

   Estados: minimizado (bolinha 🤖) ↔ expandido (card ~320px).
   Arrastável, lembra posição em localStorage.
   Debounce ~800ms ao mudar campos-chave + botão "Analisar".
   Fallback gracioso quando a Edge Function está fora.

   Endpoint (vivo, formato §4 do SPEC):
     POST /functions/v1/ncm-duimp-assist
   ============================================================ */
const { useState: _cpUS, useEffect: _cpUE, useRef: _cpUR, useCallback: _cpUC } = React;

const CP_LS_POS = 'ft_copiloto_pos_v1';
const CP_LS_OPEN = 'ft_copiloto_open_v1';

const CP_ENDPOINT = 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/ncm-duimp-assist';
const CP_ANON_KEY = 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP';

/* ---------- API call ---------- */
async function callNcmAssist(payload) {
  const res = await fetch(CP_ENDPOINT, {
    method: 'POST',
    headers: {
      'apikey': CP_ANON_KEY,
      'Authorization': 'Bearer ' + CP_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 503 || res.status === 502) {
    throw new Error('ASSISTENTE_INDISPONIVEL');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('HTTP ' + res.status + (txt ? ' · ' + txt.slice(0, 200) : ''));
  }
  return await res.json();
}

/* ---------- Helpers ---------- */
function pctOf(v) { return Math.round((Number(v) || 0) * 100); }

/* Posição clampada para garantir que o elemento sempre fique visível,
   independente do tamanho atual (bolinha 56px ou card ~360px) e do viewport. */
function clampPos(p, w, h) {
  const margin = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  return {
    x: Math.max(margin, Math.min(vw - w - margin, p.x)),
    y: Math.max(margin, Math.min(vh - h - margin, p.y)),
  };
}
function defaultBubblePos() {
  return { x: window.innerWidth - 56 - 24, y: window.innerHeight - 56 - 24 };
}
function readPos() {
  try { const p = JSON.parse(localStorage.getItem(CP_LS_POS) || 'null'); if (p && typeof p.x === 'number') return p; } catch (e) {}
  return defaultBubblePos();
}
function writePos(p) { try { localStorage.setItem(CP_LS_POS, JSON.stringify(p)); } catch (e) {} }
function readOpen() {
  try { return JSON.parse(localStorage.getItem(CP_LS_OPEN) || 'false') === true; } catch (e) { return false; }
}
function writeOpen(o) { try { localStorage.setItem(CP_LS_OPEN, JSON.stringify(!!o)); } catch (e) {} }

/* ---------- Toma o dataURL ou path de Storage → dataURL pra enviar pra IA.
   (A IA real vai trocar pra URL assinada quando a Fase 2 entrar.) ---------- */
async function resolveImageForApi(ref) {
  if (!ref) return null;
  if (window.FTImg && window.FTImg.isDataURL(ref)) return ref;
  if (window.FTImg && window.FTImg.isStoragePath(ref)) {
    // Pega a URL assinada e baixa pra base64 (pra mandar no payload)
    const url = await window.FTImg.signedURL(ref, 600);
    if (!url) return null;
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  }
  return ref;
}

/* ============================================================
   COPILOTO — componente principal
   ============================================================ */
function FtCopiloto({ state, setState }) {
  const [open, setOpen] = _cpUS(readOpen());
  const [pos, setPos] = _cpUS(readPos());
  const [loading, setLoading] = _cpUS(false);
  const [error, setError] = _cpUS(null);
  const [response, setResponse] = _cpUS(null);    // última resposta da IA (em memória)
  const [showWhy, setShowWhy] = _cpUS(false);
  const [historico, setHistorico] = _cpUS([]);    // perguntas de desempate respondidas
  const dragRef = _cpUR(null);
  const debounceRef = _cpUR(null);

  /* persistência leve da posição/estado */
  _cpUE(() => writePos(pos), [pos]);
  _cpUE(() => writeOpen(open), [open]);

  /* Re-clampa a posição quando trocar entre bolinha (56px) e card (360x500ish)
     ou quando a janela for redimensionada — evita ficar fora da tela. */
  _cpUE(() => {
    const size = open ? { w: 360, h: 520 } : { w: 56, h: 56 };
    setPos((p) => clampPos(p, size.w, size.h));
    const onResize = () => setPos((p) => clampPos(p, size.w, size.h));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  /* ---------- Drag ---------- */
  const onMouseDown = (e) => {
    if (e.target.closest('button, a, input, textarea, select, .ft-cp-no-drag')) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origX = pos.x, origY = pos.y;
    const move = (ev) => {
      const nx = Math.max(0, Math.min(window.innerWidth  - 56, origX + (ev.clientX - startX)));
      const ny = Math.max(0, Math.min(window.innerHeight - 56, origY + (ev.clientY - startY)));
      setPos({ x: nx, y: ny });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* ---------- Chamada à IA ---------- */
  const buildPayload = _cpUC(async () => {
    const ident = state.identificacao || {};
    // imagens em base64 (Fase 1; quando bucket migrar pra signed URL, troca aqui)
    const imgs = [];
    for (const slot of ['foto', 'desenho']) {
      const r = state.midia && state.midia[slot];
      if (!r) continue;
      const dataURL = await resolveImageForApi(r);
      if (dataURL) imgs.push(dataURL);
    }
    return {
      ficha: {
        denominacao: ident.nomeProduto || '',
        insumo: state.insumo || '',
        funcao_aplicacao: state.funcao_aplicacao || '',
        eh_parte_de: state.eh_parte_de || '',
        forma_estado: state.forma_estado || '',
        categoria: ident.categoriaProduto || null,
        descricao_comercial: ident.descricaoComercial || null,
        descricao_tecnica_manual: ident.descricaoTecnica || null,
        atributos: (state.cats || []).reduce((acc, cat) => {
          (cat.campos || []).forEach((fld) => {
            if (fld.ativo && fld.valor && String(fld.valor).trim()) {
              acc[fld.k] = String(fld.valor).trim() + (fld.unidade ? ' ' + fld.unidade : '');
            }
          });
          return acc;
        }, {}),
      },
      imagens: imgs,
      historico_desempate: historico,
    };
  }, [state, historico]);

  const analisar = _cpUC(async () => {
    setLoading(true); setError(null);
    try {
      const payload = await buildPayload();
      const resp = await callNcmAssist(payload);
      setResponse(resp);
      // Defesa fica em memória; persiste só quando a ficha for salva
      setState((s) => ({ ...s, __defesa: { ...resp, _at: Date.now() } }));
    } catch (e) {
      if (e.message === 'ASSISTENTE_INDISPONIVEL') {
        setError('Assistente indisponível no momento. Você pode preencher manualmente.');
      } else {
        setError('Erro: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [buildPayload, setState]);

  /* Debounce: chama 800ms depois que o usuário para de digitar nos campos-chave */
  _cpUE(() => {
    const hasMin = (state.insumo || '').trim() && (state.funcao_aplicacao || '').trim();
    if (!hasMin || !open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analisar(), 800);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [state.insumo, state.funcao_aplicacao, state.eh_parte_de, state.forma_estado, state.midia && state.midia.foto, state.midia && state.midia.desenho]);

  /* ---------- Ações dos botões ---------- */
  const usarNCM = () => {
    if (!response) return;
    setState((s) => ({
      ...s,
      ncm_recomendado: response.ncm_recomendado || '',
      ncm_descricao: response.ncm_descricao || '',
    }));
  };
  const usarDescricao = () => {
    if (!response) return;
    setState((s) => ({ ...s, descricao_duimp: response.descricao_duimp || '' }));
  };
  const responderDesempate = (pid, resposta) => {
    setHistorico((h) => [...h, { pergunta_id: pid, resposta }]);
    setTimeout(() => analisar(), 0);
  };

  /* ============================================================
     RENDER
     ============================================================ */
  if (!open) {
    return (
      <div className="ft-cp-bubble" style={{ left: pos.x, top: pos.y }} onMouseDown={onMouseDown}>
        <button className="ft-cp-bubble-btn" onClick={() => setOpen(true)} title="Abrir Copiloto NCM/DUIMP">
          🤖
          {response && <span className="ft-cp-dot" style={{ background: response.confianca >= 0.7 ? '#16a34a' : '#FBB039' }}></span>}
        </button>
      </div>
    );
  }

  return (
    <div className="ft-cp-card" style={{ left: pos.x, top: pos.y }} onMouseDown={onMouseDown} ref={dragRef}>
      <div className="ft-cp-head">
        <div className="ft-cp-title">🤖 Copiloto NCM/DUIMP</div>
        <button className="ft-cp-no-drag ft-cp-min" onClick={() => setOpen(false)} title="Minimizar">—</button>
      </div>

      <div className="ft-cp-body ft-cp-no-drag">
        {loading && (
          <div className="ft-cp-status">
            <div className="ft-cp-spin"/>
            Analisando…
          </div>
        )}

        {!loading && error && (
          <div className="ft-cp-err">
            <b>⚠️ {error}</b>
            <button className="ft-cp-btn ghost" onClick={analisar}>Tentar novamente</button>
          </div>
        )}

        {!loading && !error && !response && (
          <div className="ft-cp-empty">
            <p>Preencha <b>Insumo</b> + <b>Função / aplicação</b> e clique em Analisar — eu sugiro o NCM e a descrição DUIMP.</p>
            <button className="ft-cp-btn primary" onClick={analisar}>Analisar agora</button>
          </div>
        )}

        {!loading && !error && response && (
          <>
            <div className="ft-cp-ncm">
              <span className="ft-cp-ncm-lbl">NCM sugerido</span>
              <span className="ft-cp-ncm-val">{response.ncm_recomendado || '—'}</span>
              {response.ncm_descricao && <small className="ft-cp-ncm-desc">{response.ncm_descricao}</small>}
            </div>

            <div className="ft-cp-conf">
              <div className="ft-cp-conf-bar">
                <div className="ft-cp-conf-fill" style={{ width: pctOf(response.confianca) + '%', background: pctOf(response.confianca) >= 70 ? '#16a34a' : pctOf(response.confianca) >= 40 ? '#FBB039' : '#dc2626' }}/>
              </div>
              <span className="ft-cp-conf-lbl">{pctOf(response.confianca)}% confiança</span>
            </div>

            {/* Perguntas de desempate */}
            {(response.perguntas_desempate || []).length > 0 && (
              <div className="ft-cp-desempate">
                <b>Preciso de mais info:</b>
                {response.perguntas_desempate.map((q) => (
                  <div key={q.pergunta_id} className="ft-cp-q">
                    <p>{q.texto}</p>
                    <div className="ft-cp-opts">
                      {(q.opcoes || []).map((opt) => (
                        <button key={opt} className="ft-cp-btn outline" onClick={() => responderDesempate(q.pergunta_id, opt)}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ft-cp-actions">
              <button className="ft-cp-btn primary" onClick={usarNCM} disabled={!response.ncm_recomendado}>Usar este NCM</button>
              <button className="ft-cp-btn dark" onClick={usarDescricao} disabled={!response.descricao_duimp}>✨ Usar descrição DUIMP</button>
              <button className="ft-cp-btn ghost" onClick={() => setShowWhy((v) => !v)}>{showWhy ? 'por quê? ▴' : 'por quê? ▾'}</button>
            </div>

            {showWhy && (
              <div className="ft-cp-why">
                {response.justificativa && (
                  <div className="ft-cp-why-block">
                    <div className="ft-cp-why-lbl">Justificativa</div>
                    <p>{response.justificativa}</p>
                  </div>
                )}
                {response.antitese && (
                  <div className="ft-cp-why-block">
                    <div className="ft-cp-why-lbl">Antítese / risco</div>
                    <p>{response.antitese}</p>
                  </div>
                )}
                {(response.fontes || []).length > 0 && (
                  <div className="ft-cp-why-block">
                    <div className="ft-cp-why-lbl">Fontes</div>
                    <ul>
                      {response.fontes.map((f, i) => (
                        <li key={i}>
                          {f.url ? <a href={f.url} target="_blank" rel="noopener">{f.titulo}</a> : f.titulo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {response._stub && <p className="ft-cp-stub-note">⚙️ Resposta vem do stub. IA real entra na Fase 2 (contrato não muda).</p>}
              </div>
            )}

            <button className="ft-cp-btn ghost ft-cp-reanalisar" onClick={analisar}>↻ Reanalisar</button>
          </>
        )}
      </div>
    </div>
  );
}

window.FtCopiloto = FtCopiloto;
