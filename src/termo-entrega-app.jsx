/* ============================================================
   termo-entrega-app.jsx — página pública de assinatura do Termo de Entrega
   Rota: /termo-entrega/<token> (server.js entrega termo-entrega.html,
   token lido do path aqui). Sem SSO — cliente e/ou supervisor assinam
   no próprio celular. Signature pad em canvas (mesmo padrão visual de
   assinar-app.jsx), auditoria via TermoEntregaStore.assinar().
   ============================================================ */
(function () {
  'use strict';

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/termo-entrega\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ---------- Signature pad (canvas) — mesmo comportamento de assinar-app.jsx ---------- */
  function TeSignaturePad({ onChange }) {
    const canvasRef = React.useRef(null);
    const drawing = React.useRef(false);
    const last = React.useRef(null);
    const [empty, setEmpty] = React.useState(true);

    const setup = React.useCallback(() => {
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

    React.useEffect(() => {
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
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef}
          style={{ width: '100%', height: 160, background: '#fff', border: '1px solid #ddd', borderRadius: 8, touchAction: 'none' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {empty && <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)', color: '#999', fontSize: 13, pointerEvents: 'none' }}>Assine aqui com o dedo ou mouse</div>}
        {!empty && <button onClick={clear} style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>Limpar</button>}
      </div>
    );
  }

  function SignerStep({ papel, obra, onDone }) {
    const [nome, setNome] = React.useState('');
    const [assinatura, setAssinatura] = React.useState(null);
    const [enviando, setEnviando] = React.useState(false);
    const [erro, setErro] = React.useState(null);

    const label = papel === 'cliente' ? 'Assinatura do Cliente' : 'Assinatura do Supervisor';

    const enviar = async () => {
      setErro(null);
      if (!nome.trim()) return setErro('Informe o nome completo.');
      if (!assinatura) return setErro('Assine no campo acima antes de continuar.');
      setEnviando(true);
      try {
        const termo = await window.TermoEntregaStore.assinar({
          token: tokenDoPath(), papel, nome, assinaturaPngDataUrl: assinatura,
        });
        onDone(termo);
      } catch (e) {
        setErro(e.message || 'Erro ao assinar. Tente novamente.');
      } finally {
        setEnviando(false);
      }
    };

    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)', color: '#fff', borderRadius: 10, padding: '24px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.8 }}>Termo de Entrega</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{obra.building_name || 'Obra'}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Cliente: {obra.client_name}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
          <p style={{ fontSize: 12.5, color: '#555', lineHeight: 1.5, marginTop: 0 }}>
            Declaro que o(s) equipamento(s) desta obra foi(ram) entregue(s), testado(s) e aceito(s)
            nas condições apresentadas, encerrando a etapa de instalação.
          </p>

          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#666', display: 'block', marginBottom: 4 }}>Nome completo</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, marginBottom: 14 }}/>

          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#666', display: 'block', marginBottom: 4 }}>Assinatura</label>
          <TeSignaturePad onChange={setAssinatura}/>

          {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: '#c0392b' }}>{erro}</div>}

          <button onClick={enviar} disabled={enviando}
            style={{ marginTop: 16, width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: enviando ? '#94a3b8' : '#0066cc', border: 'none', borderRadius: 8, cursor: enviando ? 'default' : 'pointer' }}>
            {enviando ? 'Enviando…' : 'Confirmar assinatura'}
          </button>

          <div style={{ marginTop: 10, fontSize: 10.5, color: '#999', textAlign: 'center' }}>
            Ao assinar, registramos data/hora, seu IP e dispositivo para fins de auditoria,
            conforme a MP 2.200-2/2001 e a Lei 14.063/2020.
          </div>
        </div>
      </div>
    );
  }

  function ConcluidoView({ obra, termo }) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Termo de Entrega assinado</div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
          {obra.building_name} · {obra.client_name}
        </div>
        <div style={{ fontSize: 12.5, color: '#999', marginTop: 16 }}>
          {termo.concluido_em ? new Date(termo.concluido_em).toLocaleString('pt-BR') : ''}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 20 }}>Vertical Parts</div>
      </div>
    );
  }

  function TermoEntregaApp() {
    const [estado, setEstado] = React.useState(null); // null=carregando, 'not-found', {obra, termo}
    const [passo, setPasso] = React.useState('cliente'); // 'cliente' | 'supervisor'

    const carregar = React.useCallback(() => {
      const token = tokenDoPath();
      if (!token) { setEstado('not-found'); return; }
      window.TermoEntregaStore.obterPorToken(token)
        .then((obra) => {
          if (!obra) return setEstado('not-found');
          const termo = obra.termo_entrega || { modo: 'self_service', status: 'pendente', assinaturas: {} };
          setEstado({ obra, termo });
          setPasso(termo.assinaturas && termo.assinaturas.cliente ? 'supervisor' : 'cliente');
        })
        .catch(() => setEstado('not-found'));
    }, []);

    React.useEffect(() => { carregar(); }, [carregar]);

    if (estado === null) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#666', fontSize: 14 }}>Carregando…</div>;
    }
    if (estado === 'not-found') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 10, color: '#666' }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Link não encontrado</div>
          <div style={{ fontSize: 13 }}>Confira o link recebido — pode ter sido digitado errado.</div>
        </div>
      );
    }

    const { obra, termo } = estado;
    if (termo.status === 'concluido') return <ConcluidoView obra={obra} termo={termo}/>;

    return (
      <SignerStep
        papel={passo}
        obra={obra}
        onDone={(termoAtualizado) => {
          if (termo.modo === 'presencial' && passo === 'cliente' && termoAtualizado.status !== 'concluido') {
            setPasso('supervisor');
            setEstado({ obra, termo: termoAtualizado });
          } else {
            setEstado({ obra, termo: termoAtualizado });
          }
        }}
      />
    );
  }

  ReactDOM.createRoot(document.getElementById('te-root')).render(<TermoEntregaApp/>);
}());
