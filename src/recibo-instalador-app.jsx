/* ============================================================
   recibo-instalador-app.jsx — página pública /recibo/<token> (15/10/2026)
   O montador confere o pagamento, assina (nome) e atesta o recebimento. Visual simples, com o logo e as cores da
   VerticalParts e o desenho de uma folha de cheque. Só fala com o banco por RPC (token).
   ============================================================ */
const RC_fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const RC_data = (d) => { if (!d) return ''; const [a, m, di] = String(d).slice(0, 10).split('-'); return `${di}/${m}/${a}`; };

async function RC_ip() {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t);
    return (await r.json()).ip || null;
  } catch (_) { return null; }
}
async function RC_sha(txt) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch (_) { return 'sem-hash'; }
}
function RC_device() {
  const ua = navigator.userAgent; let os = 'Desktop';
  if (/android/i.test(ua)) os = 'Android'; else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'; else if (/windows/i.test(ua)) os = 'Windows'; else if (/mac os/i.test(ua)) os = 'macOS';
  return 'Navegador / ' + os;
}

function RC_Cheque({ rec }) {
  const extenso = window.CI && window.CI.valorExtenso ? window.CI.valorExtenso(Number(rec.valor)) : '';
  return (
    <div style={{ background: '#fff', border: '2px solid #000', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,.12)' }}>
      <div style={{ background: '#000', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/assets/logo-black-yellow.png" alt="Vertical Parts" style={{ height: 30 }} />
        <span style={{ color: 'var(--y)', fontSize: 11, letterSpacing: 2, fontWeight: 600 }}>RECIBO DE PAGAMENTO</span>
      </div>
      <div style={{ height: 6, background: 'repeating-linear-gradient(90deg, var(--y) 0 14px, #000 14px 28px)' }} />
      <div style={{ padding: '20px 20px 8px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--g500)' }}>Nº <b style={{ color: '#000' }}>{rec.id}</b>{rec.dossier_id ? <> · Dossiê <b style={{ color: '#000' }}>{rec.dossier_id}</b></> : null}</div>
          <div style={{ border: '2px solid #000', borderRadius: 8, padding: '6px 16px', background: 'var(--yt)', fontSize: 22, fontWeight: 800 }}>{RC_fmt(rec.valor)}</div>
        </div>
        <div style={{ marginTop: 18, fontSize: 14, lineHeight: 1.9 }}>
          <div>Recebi da <b>VERTICAL PARTS</b> a quantia de</div>
          <div style={{ borderBottom: '1.5px dotted #000', fontWeight: 600, minHeight: 26, textTransform: 'uppercase', fontSize: 13 }}>{extenso}</div>
          <div style={{ marginTop: 6 }}>referente a: <b>{rec.descricao || (rec.tipo === 'adiantamento' ? 'Adiantamento de serviço de montagem' : 'Parcela de serviço de montagem')}</b></div>
          <div>Pagamento realizado em <b>{RC_data(rec.data_pagamento)}</b>{rec.forma ? <> via <b>{rec.forma}</b></> : null}.</div>
          {rec.tipo === 'adiantamento' && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--g700)' }}>Este valor será <b>deduzido das parcelas</b> do contrato, conforme combinado.</div>}
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--g50)', borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontSize: 11, color: 'var(--g500)', letterSpacing: 1 }}>RECEBEDOR</div>
          <b>{rec.instalador_nome || 'Montador'}</b>{rec.instalador_cnpj ? <span style={{ color: 'var(--g700)' }}> · CNPJ {rec.instalador_cnpj}</span> : null}
        </div>
      </div>
      <div style={{ padding: '0 20px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--g500)', letterSpacing: 3, overflow: 'hidden', whiteSpace: 'nowrap' }}>⑆ 0000 ⑈ 000000 ⑆ VERTICAL PARTS ⑈ 0000000</div>
    </div>
  );
}

function ReciboApp() {
  const token = (location.pathname.split('/').filter(Boolean)[1] || '').trim();
  const [rec, setRec] = React.useState(undefined);   // undefined = carregando; null = inválido
  const [nome, setNome] = React.useState('');
  const [ciente, setCiente] = React.useState(false);
  const [modo, setModo] = React.useState('assinar');
  const [motivo, setMotivo] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [fim, setFim] = React.useState(null);

  React.useEffect(() => {
    window.InstaladorRecibosStore.obterPorToken(token).then((r) => { setRec(r); if (r && r.status === 'pendente') window.InstaladorRecibosStore.visualizado(token); });
  }, [token]);

  const assinar = async () => {
    setErro('');
    if (nome.trim().length < 5) { setErro('Digite seu nome completo para assinar.'); return; }
    if (!ciente) { setErro('Marque a confirmação de recebimento.'); return; }
    setEnviando(true);
    try {
      const ip = await RC_ip(); const ua = navigator.userAgent; const quando = new Date().toISOString();
      const hash = await RC_sha(`${rec.id}|${rec.valor}|${rec.data_pagamento}|${nome.trim()}|${quando}`);
      await window.InstaladorRecibosStore.assinar(token, { signerName: nome.trim(), signatureType: 'type', signUa: ua, signDevice: RC_device(), signIp: ip, hash });
      setFim('assinado');
    } catch (e) { setErro(e.message || 'Erro ao assinar.'); }
    setEnviando(false);
  };
  const recusar = async () => {
    setErro('');
    if (nome.trim().length < 3) { setErro('Digite seu nome.'); return; }
    setEnviando(true);
    try {
      const ip = await RC_ip();
      await window.InstaladorRecibosStore.recusar(token, nome.trim(), motivo.trim(), { refuseIp: ip, refuseUa: navigator.userAgent, refuseDevice: RC_device() });
      setFim('recusado');
    } catch (e) { setErro(e.message || 'Erro ao registrar.'); }
    setEnviando(false);
  };

  const wrap = (children) => (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 16px 60px' }}>{children}</div>
  );
  if (rec === undefined) return <div style={{ textAlign: 'center', padding: 80, color: '#666' }}>Carregando…</div>;
  if (!rec) return wrap(<div style={{ textAlign: 'center', padding: 40 }}><h2>Link inválido</h2><p style={{ color: 'var(--g700)', marginTop: 8 }}>Este recibo não foi encontrado. Peça um novo link ao Financeiro da Vertical Parts.</p></div>);

  const status = fim || rec.status;
  return wrap(<>
    <RC_Cheque rec={rec} />
    <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, border: '1px solid var(--g200)', padding: 20 }}>
      {status === 'assinado' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, color: 'var(--ok)' }}>✓</div>
          <h3>Recebimento confirmado</h3>
          <p style={{ color: 'var(--g700)', fontSize: 14, marginTop: 6 }}>{rec.assinante ? <>Assinado por <b>{rec.assinante}</b>. </> : null}Obrigado! O Financeiro da Vertical Parts já foi avisado.</p>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 34, marginTop: 10 }}>{rec.assinante || nome}</div>
        </div>
      )}
      {status === 'recusado' && <div style={{ textAlign: 'center' }}><h3 style={{ color: 'var(--danger)' }}>Registrado</h3><p style={{ color: 'var(--g700)', fontSize: 14, marginTop: 6 }}>Você informou que não reconhece este pagamento. O Financeiro vai entrar em contato.</p></div>}
      {status === 'cancelado' && <div style={{ textAlign: 'center' }}><h3>Recibo cancelado</h3><p style={{ color: 'var(--g700)', fontSize: 14, marginTop: 6 }}>Este recibo foi cancelado pela Vertical Parts. Não é preciso fazer nada.</p></div>}
      {status === 'pendente' && modo === 'assinar' && <>
        <h3 style={{ fontSize: 16 }}>Confirme o recebimento</h3>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>Declaro que <b>recebi {RC_fmt(rec.valor)}</b> da Vertical Parts em {RC_data(rec.data_pagamento)}{rec.tipo === 'adiantamento' ? ' e que este valor será deduzido das parcelas do contrato' : ''}.</span>
        </label>
        <label style={{ display: 'block', marginTop: 16, fontSize: 12, color: 'var(--g500)' }}>Seu nome completo (assinatura)</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome" style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--g200)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit' }} />
        {nome.trim() && <div style={{ fontFamily: 'Caveat, cursive', fontSize: 34, marginTop: 8, borderBottom: '1px solid #000', paddingBottom: 4 }}>{nome}</div>}
        {erro && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{erro}</div>}
        <button onClick={assinar} disabled={enviando} style={{ marginTop: 16, width: '100%', padding: '14px', background: 'var(--y)', border: 0, borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{enviando ? 'Enviando…' : 'Assinar e confirmar recebimento'}</button>
        <button onClick={() => { setModo('recusar'); setErro(''); }} style={{ marginTop: 10, width: '100%', background: 'none', border: 0, color: 'var(--g500)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Não recebi / não reconheço este pagamento</button>
        <p style={{ fontSize: 11, color: 'var(--g500)', marginTop: 12 }}>Sua assinatura registra data, hora, endereço de IP e dispositivo, como comprovante.</p>
      </>}
      {status === 'pendente' && modo === 'recusar' && <>
        <h3 style={{ fontSize: 16 }}>Não reconheço este pagamento</h3>
        <label style={{ display: 'block', marginTop: 14, fontSize: 12, color: 'var(--g500)' }}>Seu nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--g200)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit' }} />
        <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--g500)' }}>O que aconteceu? (opcional)</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--g200)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />
        {erro && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{erro}</div>}
        <button onClick={recusar} disabled={enviando} style={{ marginTop: 14, width: '100%', padding: 14, background: '#000', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        <button onClick={() => { setModo('assinar'); setErro(''); }} style={{ marginTop: 10, width: '100%', background: 'none', border: 0, color: 'var(--g500)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Voltar</button>
      </>}
    </div>
  </>);
}

ReactDOM.createRoot(document.getElementById('rc-root')).render(<ReciboApp />);
