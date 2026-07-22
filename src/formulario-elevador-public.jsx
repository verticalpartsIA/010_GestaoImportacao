/* ============================================================
   formulario-elevador-public.jsx — mount da página pública
   (formulario-cliente.html). Canal 2 — self-service: o cliente abre
   o link com token, preenche e envia, sem login.
   ============================================================ */
function FormularioClientePublicApp() {
  const [status, setStatus] = React.useState('carregando'); // carregando | ok | naoencontrado | enviado
  const [formularioId, setFormularioId] = React.useState(null);

  React.useEffect(() => {
    const token = window.location.pathname.split('/').filter(Boolean).pop();
    if (!token) { setStatus('naoencontrado'); return; }
    window.FormularioElevadorStore.obterPorToken(token).then((f) => {
      if (!f) { setStatus('naoencontrado'); return; }
      if (f.status === 'enviado' || f.status === 'em_cotacao' || f.status === 'concluido') {
        setStatus('enviado');
        return;
      }
      setFormularioId(f.id);
      setStatus('ok');
    }).catch(() => setStatus('naoencontrado'));
  }, []);

  if (status === 'carregando') {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: '#888', fontSize: 13 }}>Carregando…</div>;
  }
  if (status === 'naoencontrado') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>Link inválido ou expirado</h1>
        <p style={{ color: '#666', fontSize: 13.5 }}>Entre em contato com seu vendedor VerticalParts para receber um novo link.</p>
      </div>
    );
  }
  if (status === 'enviado') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', maxWidth: 460, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>✓ Formulário já enviado</h1>
        <p style={{ color: '#666', fontSize: 13.5 }}>Recebemos seus dados e nossa equipe já está preparando a cotação.</p>
      </div>
    );
  }
  return (
    <>
      <FormularioElevadorForm formularioId={formularioId} publicMode onSaved={() => setStatus('enviado')}/>
      <ToastViewport/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('fe-root')).render(<FormularioClientePublicApp/>);
