/* ============================================================
   vp-copiloto.jsx — Bolinha global do VP Gestão (Copiloto VP)
   Acompanha o usuário em TODAS as telas. Conversa, preenche
   formulários e revisa documentos procurando erros.

   IA: Anthropic Claude via Edge Function vp-copiloto.
   Mecanismo universal: lê os campos do <main> direto do DOM e
   preenche via native-setter + eventos (React atualiza o estado).

   Montado uma vez em app.jsx. Persona/contrato: ver instructions.md.
   ============================================================ */
const { useState: _vpUS, useRef: _vpUR, useEffect: _vpUE } = React;

const VPC_ENDPOINT = 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/vp-copiloto';
const VPC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dHF3em1wZ29md2N0cWFqZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODk3NzcsImV4cCI6MjA5NTA2NTc3N30.hoNuKfSaSLFDKqJ2F331QSDQkzsiphWhLk3xtZh6Bpc';
const VPC_LS_OPEN = 'vpc_open_v1';

/* ---------- API ---------- */
async function vpcCall(body) {
  const res = await fetch(VPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + VPC_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('HTTP ' + res.status + (txt ? ' · ' + txt.slice(0, 160) : ''));
  }
  return res.json();
}

/* ---------- Leitura da página (DOM → campos) ---------- */
function vpcClean(s) { return (s || '').replace(/\s+/g, ' ').replace(/\*\s*$/, '').trim(); }

function vpcLabelFor(el) {
  if (el.id) {
    try {
      const sel = 'label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]';
      const l = document.querySelector(sel);
      if (l) return vpcClean(l.textContent);
    } catch (e) {}
  }
  const aria = el.getAttribute('aria-label');
  if (aria) return vpcClean(aria);
  let p = el.parentElement;
  for (let d = 0; d < 4 && p; d++, p = p.parentElement) {
    const lab = p.querySelector('label');
    if (lab) return vpcClean(lab.textContent);
  }
  return vpcClean(el.getAttribute('placeholder') || el.name || '');
}

function vpcRequired(el) {
  if (el.required) return true;
  const f = el.closest('.cv-field, .ci-field, .pe-field, .ft-field, .field');
  if (f && f.querySelector('.cv-req, .ci-req, .pe-req, .req, .required')) return true;
  return false;
}

/* Varre o <main> e devolve { fields (p/ IA), els (p/ preencher) }.
   Índices alinhados: els[i] corresponde a fields[i].idx === i. */
function vpcScanPage() {
  const main = document.querySelector('main.main') || document.body;
  const nodes = main.querySelectorAll('input, textarea, select');
  const fields = [], els = [];
  let i = 0;
  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'file', 'submit', 'button', 'checkbox', 'radio', 'range'].includes(type)) return;
    if (el.disabled || el.readOnly) return;
    // visível?
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return;
    const isSelect = tag === 'select';
    const f = {
      idx: i,
      label: vpcLabelFor(el),
      type: isSelect ? 'select' : (tag === 'textarea' ? 'textarea' : (type || 'text')),
      value: el.value || '',
      required: vpcRequired(el),
    };
    if (isSelect) f.options = Array.from(el.options).map(o => o.value).filter(v => v !== '');
    fields.push(f);
    els.push(el);
    i++;
  });
  return { fields, els };
}

function vpcDocText() {
  const main = document.querySelector('main.main') || document.body;
  return (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);
}

/* ---------- Preenchimento (React-compatível) ---------- */
function vpcSetValue(el, value) {
  const tag = el.tagName;
  const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
    : tag === 'SELECT' ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function vpcApplyFills(fills, els) {
  let n = 0;
  for (const f of fills) {
    const el = els[f.idx];
    if (!el) continue;
    let v = f.value;
    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options);
      const m = opts.find(o => o.value === v)
        || opts.find(o => o.value.toLowerCase() === String(v).toLowerCase())
        || opts.find(o => o.textContent.trim().toLowerCase() === String(v).toLowerCase());
      if (!m) continue;
      v = m.value;
    }
    vpcSetValue(el, v);
    try {
      el.classList.add('vpc-flash');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => el.classList.remove('vpc-flash'), 1600);
    } catch (e) {}
    n++;
  }
  return n;
}

/* ============================================================
   Componente
   ============================================================ */
function VpCopiloto({ route, role }) {
  const [open, setOpen] = _vpUS(() => { try { return localStorage.getItem(VPC_LS_OPEN) === '1'; } catch (e) { return false; } });
  const [msgs, setMsgs] = _vpUS([
    { role: 'assistant', content: 'Oi! Sou o Copiloto VP 🟡 Posso responder dúvidas, preencher o formulário desta tela ou revisar o documento à procura de erros. É só pedir.' },
  ]);
  const [input, setInput] = _vpUS('');
  const [loading, setLoading] = _vpUS(false);
  const [pendingMode, setPendingMode] = _vpUS(null); // 'fill' enquanto há perguntas em aberto
  const elsRef = _vpUR([]);
  const bodyRef = _vpUR(null);

  _vpUE(() => { try { localStorage.setItem(VPC_LS_OPEN, open ? '1' : '0'); } catch (e) {} }, [open]);
  _vpUE(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, loading, open]);

  const send = async (mode, text) => {
    const userText = (text != null ? text : input).trim();
    if (mode === 'chat' && !userText) return;
    const base = userText ? [...msgs, { role: 'user', content: userText }] : msgs;
    setMsgs(base);
    setInput('');
    setLoading(true);
    try {
      const { fields, els } = vpcScanPage();
      elsRef.current = els;
      const body = {
        mode,
        message: userText,
        history: base.slice(-12).map(m => ({
          role: m.role,
          content: m.content + (m.questions && m.questions.length ? ' [perguntei: ' + m.questions.map(q => q.text).join(' | ') + ']' : ''),
        })),
        page: { route, title: document.title.replace(' · VP Gestão', ''), fields },
      };
      if (mode === 'analyze') body.documentText = vpcDocText();
      const resp = await vpcCall(body);
      let filled = 0;
      if (resp.fills && resp.fills.length) filled = vpcApplyFills(resp.fills, elsRef.current);
      setMsgs(m => [...m, {
        role: 'assistant',
        content: resp.reply || '',
        questions: resp.questions || [],
        issues: resp.issues || [],
        filled,
      }]);
      setPendingMode(resp.questions && resp.questions.length ? 'fill' : null);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: '⚠️ Não consegui responder agora: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => { e.preventDefault(); send(pendingMode || 'chat'); };

  if (!open) {
    return (
      <button className="vpc-bubble" onClick={() => setOpen(true)} title="Copiloto VP" aria-label="Abrir Copiloto VP">
        <span className="vpc-bubble-dot" />
      </button>
    );
  }

  return (
    <div className="vpc-panel" role="dialog" aria-label="Copiloto VP">
      <div className="vpc-head">
        <div className="vpc-title"><span className="vpc-title-dot" /> Copiloto VP</div>
        <button className="vpc-x" onClick={() => setOpen(false)} title="Minimizar" aria-label="Minimizar">—</button>
      </div>

      <div className="vpc-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={'vpc-msg vpc-msg--' + m.role}>
            {m.content && <div className="vpc-bubble-text">{m.content}</div>}

            {m.filled > 0 && (
              <div className="vpc-note vpc-note--ok">✓ Preenchi {m.filled} {m.filled === 1 ? 'campo' : 'campos'} na tela.</div>
            )}

            {m.questions && m.questions.length > 0 && (
              <ul className="vpc-questions">
                {m.questions.map((q, j) => <li key={j}>{q.text}</li>)}
              </ul>
            )}

            {m.issues && m.issues.length > 0 && (
              <div className="vpc-issues">
                {m.issues.map((it, j) => (
                  <div key={j} className={'vpc-issue vpc-issue--' + (it.severity || 'media')}>
                    <div className="vpc-issue-head">
                      <span className="vpc-sev">{it.severity || 'media'}</span>
                      <span className="vpc-where">{it.where}</span>
                    </div>
                    <div className="vpc-issue-prob">{it.problem}</div>
                    {it.suggestion && <div className="vpc-issue-sug">💡 {it.suggestion}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="vpc-msg vpc-msg--assistant"><div className="vpc-typing"><i /><i /><i /></div></div>}
      </div>

      <div className="vpc-actions">
        <button className="vpc-act" disabled={loading} onClick={() => send('fill')}>✨ Preencher página</button>
        <button className="vpc-act" disabled={loading} onClick={() => send('analyze')}>🔍 Revisar erros</button>
      </div>

      <form className="vpc-input-row" onSubmit={onSubmit}>
        <input
          className="vpc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pendingMode === 'fill' ? 'Responda para eu continuar preenchendo…' : 'Pergunte ou peça algo…'}
          disabled={loading}
        />
        <button className="vpc-send" type="submit" disabled={loading || !input.trim()} aria-label="Enviar">➤</button>
      </form>
    </div>
  );
}

window.VpCopiloto = VpCopiloto;
