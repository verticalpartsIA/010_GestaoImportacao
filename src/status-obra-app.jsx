/* ============================================================
   status-obra-app.jsx — página pública de status da obra (15/08)
   Rota: /status-obra/<token> (server.js entrega status-obra.html, token
   lido do path aqui). Somente leitura — sem SSO, sem edição. Pra que o
   cliente/fornecedor veja o andamento da instalação sem precisar logar.
   ============================================================ */
(function () {
  'use strict';

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/status-obra\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fmtData(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  }

  function StatusObraApp() {
    const [estado, setEstado] = React.useState(null); // null=carregando, 'not-found', {dossier, itens}

    React.useEffect(() => {
      const token = tokenDoPath();
      if (!token) { setEstado('not-found'); return; }
      window.InstalacaoChecklistStore.obterPorToken(token)
        .then((r) => setEstado(r || 'not-found'))
        .catch(() => setEstado('not-found'));
    }, []);

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

    const { dossier, itens } = estado;
    const store = window.InstalacaoChecklistStore;
    const total = itens.length;
    const concluidos = itens.filter((i) => i.status === 'concluido').length;
    const pct = total ? Math.round((concluidos / total) * 100) : 0;
    const semanas = [...new Set(itens.map((i) => i.semana))].sort((a, b) => a - b);

    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)', color: '#fff', borderRadius: 10, padding: '28px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.8 }}>Status da Instalação</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{dossier.building_name || 'Obra'}</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>Cliente: {dossier.client_name}</div>
          {total > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{concluidos} de {total} etapas concluídas</span>
                <span style={{ fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,.25)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: '#ffd400', height: '100%', width: pct + '%' }}/>
              </div>
            </div>
          )}
        </div>

        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 13 }}>
            O cronograma de instalação desta obra ainda não foi iniciado.
          </div>
        ) : semanas.map((sem) => (
          <div key={sem} style={{ marginBottom: 22 }}>
            <div style={{ borderLeft: `4px solid ${store.semanaCor(sem)}`, paddingLeft: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: store.semanaCor(sem), fontWeight: 700 }}>Semana {sem}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{store.semanaTitulo(sem)}</div>
            </div>
            {itens.filter((i) => i.semana === sem).map((item) => (
              <div key={item.id} style={{
                background: '#fff', border: '1px solid ' + (item.status === 'concluido' ? '#10b981' : '#e5e5e5'),
                borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start',
                opacity: item.status === 'nao_aplicavel' ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 18, marginTop: 1 }}>
                  {item.status === 'concluido' ? '✅' : item.status === 'nao_aplicavel' ? '➖' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.etapa}</div>
                  {item.status === 'concluido' && (
                    <div style={{ fontSize: 11.5, color: '#888', marginTop: 3 }}>Concluído em {fmtData(item.concluido_em)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: '#aaa' }}>Vertical Parts</div>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('so-root')).render(<StatusObraApp/>);
}());
