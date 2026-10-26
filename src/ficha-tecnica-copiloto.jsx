/* ============================================================
   ficha-tecnica-copiloto.jsx
   Widget flutuante do Copiloto NCM/DUIMP.

   Estados: minimizado (bolinha 🤖) ↔ expandido (card ~320px).
   Arrastável, lembra posição em localStorage.
   Botão "Analisar" (sem análise automática: cada análise é uma pergunta da cota
   da pessoa e leva ~1 min, porque o assistente confere a TEC na internet).

   IA (26/10/2026): sessão do Claude na VPS — POST https://copiloto.vpsistema.com/ncm
   com o login da pessoa (mesma cota de 20/hora da bolinha geral). Substitui a Edge
   Function ncm-duimp-assist (API paga). Mesmo formato §4 do SPEC, mais:
   alertas (anuência, divergência com o histórico da casa…), resposta (à pergunta
   digitada) e restantes. A base de conhecimento de NCM fica na VPS.

   PREENCHER (26/10/2026): botão "📝 Preencher a ficha" — mesmo endpoint com
   modo:'preencher'. A IA lê nome/descrições/fotos/texto colado (e o datasheet do
   fabricante quando há marca+modelo) e PROPÕE identificação, classificação fiscal
   e campos técnicos, cada um com a origem. Nada entra sozinho: a pessoa marca o
   que quer e clica "Aplicar marcados"; depois revisa e salva a ficha.
   ============================================================ */
const { useState: _cpUS, useEffect: _cpUE, useRef: _cpUR, useCallback: _cpUC } = React;

const CP_LS_POS = 'ft_copiloto_pos_v1';
const CP_LS_OPEN = 'ft_copiloto_open_v1';

const CP_ENDPOINT = 'https://copiloto.vpsistema.com/ncm';

/* Estilos das partes novas (26/10/2026) — o resto está em styles/ficha-tecnica.css */
const CP_CSS = `
.ft-cp-resposta { background: #f1f5f9; border-left: 3px solid #0f172a; padding: 6px 8px; margin: 8px 0; font-size: 12px; white-space: pre-wrap; }
.ft-cp-alertas { list-style: none; margin: 8px 0; padding: 6px 8px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 11.5px; }
.ft-cp-alertas li + li { margin-top: 4px; }
.ft-cp-pergunta { display: flex; gap: 6px; align-items: flex-end; margin-top: 8px; }
.ft-cp-pergunta textarea { flex: 1; resize: vertical; font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.ft-cp-restantes { display: block; margin-top: 4px; color: #64748b; font-size: 10.5px; text-align: center; }
.ft-cp-empty textarea { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 8px; }
.ft-cp-duo { display: flex; gap: 6px; }
.ft-cp-duo .ft-cp-btn { flex: 1; }
.ft-cp-prop-resumo { font-size: 12px; color: #334155; margin: 0 0 8px; line-height: 1.45; }
.ft-cp-prop-grp { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin: 10px 0 4px; }
.ft-cp-prop-item { display: flex; gap: 6px; align-items: flex-start; padding: 5px 0; border-top: 1px solid #f1f5f9; font-size: 12px; cursor: pointer; }
.ft-cp-prop-item input { margin-top: 2px; }
.ft-cp-prop-item b { font-weight: 600; color: #0f172a; }
.ft-cp-prop-val { display: block; color: #1e293b; white-space: pre-wrap; word-break: break-word; }
.ft-cp-prop-meta { display: block; color: #64748b; font-size: 10.5px; margin-top: 1px; }
.ft-cp-prop-meta.baixa { color: #b45309; }
.ft-cp-prop-atual { display: block; color: #b91c1c; font-size: 10.5px; }
.ft-cp-prop-novo { font-size: 9px; font-weight: 700; color: #2563eb; border: 1px solid #93c5fd; border-radius: 3px; padding: 0 3px; margin-left: 4px; }
.ft-cp-faltando { margin: 8px 0; padding: 6px 8px 6px 22px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11.5px; }
.ft-cp-ok { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 6px 8px; font-size: 12px; margin-bottom: 8px; }
`;

/* ---------- API call ---------- */
async function callNcmAssist(payload) {
  const token = (window.VpAuth && window.VpAuth.getAccessToken) ? await window.VpAuth.getAccessToken() : null;
  if (!token) throw new Error('não encontrei seu login. Saia e entre de novo pelo vpsistema.com e tente outra vez.');
  const res = await fetch(CP_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 502) throw new Error('ASSISTENTE_INDISPONIVEL');
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error || ''; } catch (e) { /* resposta sem JSON */ }
    if (!msg && res.status === 503) throw new Error('ASSISTENTE_INDISPONIVEL');
    throw new Error(msg || ('HTTP ' + res.status));
  }
  return await res.json();
}

/* Reduz a foto/desenho (máx. 1600 px, JPEG) antes de enviar — a IA enxerga igual e o envio fica leve. */
function cpReduzirImagem(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 1600 / Math.max(img.width, img.height));
      if (esc === 1 && dataURL.length < 1500000) return resolve(dataURL);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * esc); cv.height = Math.round(img.height * esc);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

/* ---------- Helpers ---------- */
function pctOf(v) { return Math.round((Number(v) || 0) * 100); }

/* ---------- Preencher: rótulos e leitura/aplicação dos itens propostos ---------- */
const CP_IDENT_LBL = {
  nomeProduto: 'Nome do produto', descricaoComercial: 'Descrição comercial', descricaoTecnica: 'Descrição técnica',
  categoriaProduto: 'Categoria / Segmento', marca: 'Marca', modelo: 'Modelo', partNumber: 'Part Number', unidade: 'Unidade (Omie)',
};
const CP_CLASSIF_LBL = { insumo: 'Insumo', funcao_aplicacao: 'Função / aplicação', eh_parte_de: 'É parte de?', forma_estado: 'Forma / estado' };
const CP_FORMA_LBL = { peca_acabada: 'Peça acabada / moldada', materia_prima: 'Matéria-prima (rolo / chapa / perfil)' };
const CP_ORIGEM_LBL = {
  foto: '📷 lido na foto', desenho: '📐 lido no desenho', ficha: '📄 já estava na ficha', texto: '✍️ do seu texto',
  datasheet: '🌐 site/datasheet do fabricante', norma: '📏 padrão de norma', inferido: '💭 dedução',
};

/* Achata a proposta numa lista de itens com id estável (ident:k / classif:k / campo:i). */
function cpItensDaProposta(prop) {
  const itens = [];
  Object.keys(CP_IDENT_LBL).forEach((k) => { const it = prop.identificacao && prop.identificacao[k]; if (it) itens.push({ id: 'ident:' + k, grupo: 'ident', k, rotulo: CP_IDENT_LBL[k], ...it }); });
  Object.keys(CP_CLASSIF_LBL).forEach((k) => { const it = prop.classificacao && prop.classificacao[k]; if (it) itens.push({ id: 'classif:' + k, grupo: 'classif', k, rotulo: CP_CLASSIF_LBL[k], ...it }); });
  (prop.campos || []).forEach((c, i) => itens.push({ id: 'campo:' + i, grupo: 'campo', rotulo: c.nome, ...c }));
  return itens;
}

/* Campo da ficha que corresponde a um item técnico (pela chave ou pelo nome, na categoria proposta). */
function cpAcharCampo(cats, item) {
  const cat = (cats || []).find((c) => c.id === item.cat);
  if (!cat) return { cat: null, fld: null };
  const norm = window.FT.normalizeNome(item.nome);
  const fld = cat.campos.find((f) => (item.k && f.k === item.k) || window.FT.normalizeNome(f.nome) === norm) || null;
  return { cat, fld };
}

/* Valor atual na ficha do que o item quer preencher ('' = vazio). */
function cpValorAtual(state, item) {
  if (item.grupo === 'ident') return String((state.identificacao || {})[item.k] || '').trim();
  if (item.grupo === 'classif') return String(state[item.k] || '').trim();
  const { fld } = cpAcharCampo(state.cats, item);
  return fld && fld.ativo ? String(fld.valor || '').trim() : '';
}

function cpMesmoValor(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

/* Aplica os itens escolhidos ao estado da ficha. Campo técnico que não existe vira campo novo
   só NESTA ficha (como os modelos fazem) — não entra na biblioteca de campos de todo mundo. */
function cpAplicar(s, itens) {
  let ident = { ...s.identificacao };
  const extra = {};
  let ord = window.FT.nextOrdem(s.cats);
  let cats = s.cats.map((c) => ({ ...c, campos: c.campos.slice() }));
  itens.forEach((it) => {
    if (it.grupo === 'ident') { ident[it.k] = it.k === 'unidade' ? it.valor.toUpperCase() : it.valor; return; }
    if (it.grupo === 'classif') { extra[it.k] = it.valor; return; }
    const { cat, fld } = cpAcharCampo(cats, it);
    if (!cat) return;
    if (fld) {
      const i = cat.campos.indexOf(fld);
      cat.campos[i] = { ...fld, valor: it.valor, unidade: fld.unidade || it.unidade || '', ordem: fld.ativo ? fld.ordem : ord++, ativo: true };
    } else {
      cat.campos.push({ k: window.FT.slug(it.nome), nome: it.nome, unidade: it.unidade || '', tipo: it.tipo || 'number', valor: it.valor, ativo: true, ordem: ord++, custom: true });
    }
  });
  return { ...s, ...extra, identificacao: ident, cats };
}

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
  const [pergunta, setPergunta] = _cpUS('');      // pergunta/observação digitada para o assistente
  const [proposta, setProposta] = _cpUS(null);    // proposta de preenchimento da ficha (modo preencher)
  const [marcados, setMarcados] = _cpUS({});      // id do item → vai ser aplicado?
  const [aplicados, setAplicados] = _cpUS(0);     // quantos itens entraram na última aplicação
  const [ultimaAcao, setUltimaAcao] = _cpUS('ncm');
  const dragRef = _cpUR(null);

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
  const buildPayload = _cpUC(async (histAtual) => {
    const ident = state.identificacao || {};
    // imagens em base64 (Fase 1; quando bucket migrar pra signed URL, troca aqui)
    const imgs = [];
    for (const slot of ['foto', 'desenho']) {
      const r = state.midia && state.midia[slot];
      if (!r) continue;
      const dataURL = await resolveImageForApi(r);
      if (dataURL) imgs.push(await cpReduzirImagem(dataURL));
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
      historico_desempate: histAtual || historico,
    };
  }, [state, historico]);

  /* Fotos/desenho da ficha, reduzidos, para mandar junto. */
  const imagensDaFicha = async () => {
    const imgs = [];
    for (const slot of ['foto', 'desenho']) {
      const r = state.midia && state.midia[slot];
      if (!r) continue;
      const dataURL = await resolveImageForApi(r);
      if (dataURL) imgs.push(await cpReduzirImagem(dataURL));
    }
    return imgs;
  };

  const preencher = _cpUC(async (textoPedido) => {
    setLoading('preencher'); setError(null); setUltimaAcao('preencher'); setAplicados(0);
    try {
      const ident = state.identificacao || {};
      const payload = {
        modo: 'preencher',
        ficha: {
          identificacao: ident,
          insumo: state.insumo || '', funcao_aplicacao: state.funcao_aplicacao || '',
          eh_parte_de: state.eh_parte_de || '', forma_estado: state.forma_estado || '',
          descricao_duimp: state.descricao_duimp || '',
        },
        catalogo: (state.cats || []).map((c) => ({
          id: c.id, nome: c.nome,
          campos: (c.campos || []).map((fld) => ({ k: fld.k, nome: fld.nome, unidade: fld.unidade || '', tipo: fld.tipo || 'number', valor: fld.ativo ? (fld.valor || '') : '' })),
        })),
        imagens: await imagensDaFicha(),
      };
      if (typeof textoPedido === 'string' && textoPedido.trim()) payload.pergunta = textoPedido.trim();
      const resp = await callNcmAssist(payload);
      // Itens iguais ao que já está na ficha não aparecem; vazio na ficha = já vem marcado;
      // troca de valor existente fica DESmarcada (a pessoa decide).
      const itens = cpItensDaProposta(resp).filter((it) => !cpMesmoValor(cpValorAtual(state, it), it.valor));
      const m = {};
      itens.forEach((it) => { m[it.id] = !cpValorAtual(state, it); });
      setProposta({ ...resp, itens });
      setMarcados(m);
      setPergunta('');
    } catch (e) {
      setError(e.message === 'ASSISTENTE_INDISPONIVEL' ? 'Assistente indisponível no momento. Você pode preencher manualmente.' : 'Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [state]);

  const aplicarProposta = () => {
    if (!proposta) return;
    const escolhidos = proposta.itens.filter((it) => marcados[it.id]);
    setState((s) => cpAplicar(s, escolhidos));
    setAplicados(escolhidos.length);
    setProposta(null);
  };

  const analisar = _cpUC(async (textoPergunta, histAtual) => {
    setLoading('ncm'); setError(null); setUltimaAcao('ncm'); setAplicados(0);
    try {
      const payload = await buildPayload(histAtual);
      if (typeof textoPergunta === 'string' && textoPergunta.trim()) {
        payload.pergunta = textoPergunta.trim();
        if (response) payload.resposta_anterior = response;
      }
      const resp = await callNcmAssist(payload);
      setResponse(resp);
      setPergunta('');
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
  }, [buildPayload, setState, response]);

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
    // passa o histórico novo direto: o estado só atualiza no próximo render
    const novo = [...historico, { pergunta_id: pid, resposta }];
    setHistorico(novo);
    analisar(undefined, novo);
  };

  /* ============================================================
     RENDER
     ============================================================ */
  if (!open) {
    return (
      <div className="ft-cp-bubble" style={{ left: pos.x, top: pos.y }} onMouseDown={onMouseDown}>
        <button className="ft-cp-bubble-btn" onClick={() => setOpen(true)} title="Abrir Copiloto da Ficha (preencher + NCM/DUIMP)">
          🤖
          {response && <span className="ft-cp-dot" style={{ background: response.confianca >= 0.7 ? '#16a34a' : '#FBB039' }}></span>}
        </button>
      </div>
    );
  }

  return (
    <div className="ft-cp-card" style={{ left: pos.x, top: pos.y }} onMouseDown={onMouseDown} ref={dragRef}>
      <style>{CP_CSS}</style>
      <div className="ft-cp-head">
        <div className="ft-cp-title">🤖 Copiloto da Ficha · NCM/DUIMP</div>
        <button className="ft-cp-no-drag ft-cp-min" onClick={() => setOpen(false)} title="Minimizar">—</button>
      </div>

      <div className="ft-cp-body ft-cp-no-drag">
        {loading && (
          <div className="ft-cp-status">
            <div className="ft-cp-spin"/>
            {loading === 'preencher'
              ? 'Preenchendo… leio fotos, descrições e o datasheet do fabricante (1 a 2 min).'
              : 'Analisando… pode levar 1 a 2 min (confiro a TEC/TIPI vigente).'}
          </div>
        )}

        {!loading && error && (
          <div className="ft-cp-err">
            <b>⚠️ {error}</b>
            <button className="ft-cp-btn ghost" onClick={() => (ultimaAcao === 'preencher' ? preencher() : analisar())}>Tentar novamente</button>
          </div>
        )}

        {!loading && !error && aplicados > 0 && !proposta && (
          <div className="ft-cp-ok">✓ {aplicados} {aplicados === 1 ? 'item aplicado' : 'itens aplicados'} na ficha. Revise e clique em <b>Salvar ficha</b>.{!response && <> Depois, <b>Analisar NCM</b>.</>}</div>
        )}

        {!loading && !error && proposta && (
          <>
            {proposta.resumo && <p className="ft-cp-prop-resumo">{proposta.resumo}</p>}
            {proposta.resposta && <div className="ft-cp-resposta">{proposta.resposta}</div>}
            {proposta.itens.length === 0 && <p className="ft-cp-prop-resumo"><b>Nada novo para preencher</b> com o que tenho. Veja abaixo o que falta.</p>}
            {[['ident', 'Identificação'], ['classif', 'Classificação fiscal'], ['campo', 'Campos técnicos']].map(([g, titulo]) => {
              const lista = proposta.itens.filter((it) => it.grupo === g);
              if (!lista.length) return null;
              return (
                <div key={g}>
                  <div className="ft-cp-prop-grp">{titulo}</div>
                  {lista.map((it) => {
                    const atual = cpValorAtual(state, it);
                    const novo = it.grupo === 'campo' && !cpAcharCampo(state.cats, it).fld;
                    const mostra = it.k === 'forma_estado' ? (CP_FORMA_LBL[it.valor] || it.valor) : it.valor;
                    return (
                      <label key={it.id} className="ft-cp-prop-item">
                        <input type="checkbox" checked={!!marcados[it.id]} onChange={() => setMarcados((m) => ({ ...m, [it.id]: !m[it.id] }))}/>
                        <span>
                          <b>{it.rotulo}</b>{novo && <span className="ft-cp-prop-novo" title="Campo novo, só nesta ficha">NOVO</span>}
                          <span className="ft-cp-prop-val">{mostra}{it.grupo === 'campo' && it.unidade ? ' ' + it.unidade : ''}</span>
                          {atual && <span className="ft-cp-prop-atual">substitui: {it.k === 'forma_estado' ? (CP_FORMA_LBL[atual] || atual) : atual}</span>}
                          <span className={'ft-cp-prop-meta' + (it.certeza === 'baixa' ? ' baixa' : '')} title={it.motivo || ''}>
                            {CP_ORIGEM_LBL[it.origem] || it.origem}{it.certeza !== 'alta' ? ' · certeza ' + (it.certeza === 'media' ? 'média' : 'baixa') : ''}{it.motivo ? ' · ' + it.motivo : ''}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            {(proposta.faltando || []).length > 0 && (
              <>
                <div className="ft-cp-prop-grp">Falta você medir / confirmar</div>
                <ul className="ft-cp-faltando">{proposta.faltando.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>
            )}
            {(proposta.fontes || []).length > 0 && (
              <div className="ft-cp-why" style={{ marginBottom: 8 }}>
                <div className="ft-cp-why-lbl">Fontes</div>
                <ul>{proposta.fontes.map((f, i) => <li key={i}>{f.url ? <a href={f.url} target="_blank" rel="noopener">{f.titulo || f.url}</a> : f.titulo}</li>)}</ul>
              </div>
            )}
            <div className="ft-cp-duo">
              <button className="ft-cp-btn primary" disabled={!proposta.itens.some((it) => marcados[it.id])} onClick={aplicarProposta}>
                Aplicar marcados ({proposta.itens.filter((it) => marcados[it.id]).length})
              </button>
              <button className="ft-cp-btn ghost" onClick={() => setProposta(null)}>Descartar</button>
            </div>
            {typeof proposta.restantes === 'number' && <small className="ft-cp-restantes">Restam {proposta.restantes} de 20 perguntas nesta hora.</small>}
          </>
        )}

        {!loading && !error && !proposta && !response && (
          <div className="ft-cp-empty">
            <p><b>📝 Preencher a ficha:</b> eu leio o nome, as descrições, a foto/placa e o desenho (e o site do fabricante, se tiver marca + modelo) e proponho os campos — você escolhe o que entra.</p>
            <p><b>NCM:</b> com <b>Insumo</b> + <b>Função / aplicação</b> preenchidos, eu sugiro o NCM e a descrição DUIMP.</p>
            <textarea rows={3} value={pergunta} placeholder="Opcional: cole aqui o texto do catálogo/datasheet ou diga o que precisa (ex.: é o rolete do degrau da Otis 506)"
              onChange={(e) => setPergunta(e.target.value)}/>
            <div className="ft-cp-duo">
              <button className="ft-cp-btn dark" onClick={() => preencher(pergunta)}>📝 Preencher a ficha</button>
              <button className="ft-cp-btn primary" onClick={() => analisar(pergunta)}>Analisar NCM</button>
            </div>
          </div>
        )}

        {!loading && !error && !proposta && response && (
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

            {response.resposta && <div className="ft-cp-resposta">{response.resposta}</div>}

            {(response.alertas || []).length > 0 && (
              <ul className="ft-cp-alertas">
                {response.alertas.map((a, i) => <li key={i}>⚠️ {a}</li>)}
              </ul>
            )}

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
              </div>
            )}

            <div className="ft-cp-pergunta">
              <textarea rows={2} value={pergunta} placeholder="Pergunte ou contradiga (ex.: e se a bobina for 24 Vcc?)"
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && pergunta.trim()) { e.preventDefault(); analisar(pergunta); } }}/>
              <button className="ft-cp-btn outline" disabled={!pergunta.trim()} onClick={() => analisar(pergunta)}>Perguntar</button>
            </div>

            <div className="ft-cp-duo" style={{ marginTop: 8 }}>
              <button className="ft-cp-btn ghost" onClick={() => analisar()}>↻ Reanalisar NCM</button>
              <button className="ft-cp-btn ghost" onClick={() => preencher(pergunta)} title="Usa o texto da caixa acima, se houver">📝 Preencher a ficha</button>
            </div>
            {typeof response.restantes === 'number' && <small className="ft-cp-restantes">Restam {response.restantes} de 20 perguntas nesta hora.</small>}
          </>
        )}
      </div>
    </div>
  );
}

window.FtCopiloto = FtCopiloto;
