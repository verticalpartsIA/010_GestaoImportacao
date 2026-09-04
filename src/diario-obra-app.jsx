/* ============================================================
   diario-obra-app.jsx — página pública do Diário de Obra (04/09)
   Rota: /diario-obra/<token> (server.js entrega diario-obra.html, token
   lido do path aqui). Sem SSO — link fixo, mandado ao Montador junto
   com o contrato. Qualquer um com o link VÊ o status; só quem preenche
   consegue FLEGAR (com foto obrigatória) — nunca desmarcar. Desmarcar é
   ação exclusiva do operador, de dentro do sistema (Dossiê da Obra →
   aba Acompanhamento de Obra).
   ============================================================ */
(function () {
  'use strict';

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/diario-obra\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fmtDataHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function ItemLinha({ item, status, selecionado, fotos, observacao, enviando, onToggle, onFotos, onObservacao }) {
    const flegado = status && status.flegado;
    return (
      <div style={{
        border: '1px solid ' + (flegado ? '#10b981' : selecionado ? '#0066cc' : '#ddd'),
        background: flegado ? '#f0fdf4' : selecionado ? '#f0f8ff' : '#fff',
        borderRadius: 8, padding: 12, marginBottom: 8,
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: flegado ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={!!flegado || selecionado} disabled={!!flegado || enviando}
            onChange={() => onToggle(item.id)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.texto}</div>
            {flegado && (
              <div style={{ fontSize: 11.5, color: '#0a7a3d', marginTop: 2 }}>✓ Feito em {fmtDataHora(status.flegado_em)}</div>
            )}
            {flegado && status.fotos && status.fotos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {status.fotos.map((url, i) => <img key={i} src={url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />)}
              </div>
            )}
            {flegado && status.observacao && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>📝 {status.observacao}</div>
            )}
            {!flegado && selecionado && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, color: '#0066cc', border: '1px solid #0066cc', borderRadius: 6, padding: '6px 10px', display: 'inline-block', cursor: 'pointer' }}>
                  📷 {fotos.length > 0 ? `${fotos.length} foto(s) anexada(s)` : 'Anexar foto (obrigatório)'}
                  <input type="file" accept="image/*" capture="environment" multiple hidden disabled={enviando}
                    onChange={(e) => onFotos(item.id, e.target.files)} />
                </label>
                {fotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {fotos.map((f, i) => <img key={i} src={f.preview} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />)}
                  </div>
                )}
                <textarea
                  value={observacao}
                  onChange={(e) => onObservacao(item.id, e.target.value)}
                  disabled={enviando}
                  placeholder="Observação (opcional) — descreva se teve alguma dificuldade nessa tarefa"
                  rows={2}
                  style={{ marginTop: 8, width: '100%', fontSize: 13, padding: 8, border: '1px solid #ddd', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        </label>
      </div>
    );
  }

  function DiarioObraApp() {
    const [token] = React.useState(tokenDoPath);
    const [estado, setEstado] = React.useState(undefined);
    const [selecionados, setSelecionados] = React.useState({});
    const [fotos, setFotos] = React.useState({});
    const [observacoes, setObservacoes] = React.useState({});
    const [enviando, setEnviando] = React.useState(false);

    const carregar = React.useCallback(() => {
      if (!token || !window.AcompanhamentoObraStore) return;
      window.AcompanhamentoObraStore.obterEstadoPorToken(token).then(setEstado).catch(() => setEstado(null));
    }, [token]);
    React.useEffect(() => { carregar(); }, [carregar]);

    if (!token) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link inválido.</div>;
    if (estado === undefined) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Carregando…</div>;
    if (estado === null) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link não encontrado ou expirado.</div>;

    const statusPorItem = {};
    (estado.status || []).forEach((s) => { statusPorItem[s.item_id] = s; });
    const itens = (estado.status || [])
      .map((s) => s.acompanhamento_obra_itens)
      .filter(Boolean)
      .sort((a, b) => a.ordem - b.ordem);
    const total = itens.length;
    const feitos = (estado.status || []).filter((s) => s.flegado).length;
    const pct = total ? Math.round((feitos / total) * 100) : 0;

    const toggle = (itemId) => {
      setSelecionados((p) => { const n = { ...p }; if (n[itemId]) delete n[itemId]; else n[itemId] = true; return n; });
    };

    const onFotos = async (itemId, fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const previews = files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      setFotos((p) => ({ ...p, [itemId]: [...(p[itemId] || []), ...previews] }));
    };

    const onObservacao = (itemId, texto) => {
      setObservacoes((p) => ({ ...p, [itemId]: texto }));
    };

    const enviar = async () => {
      const idsSelecionados = Object.keys(selecionados);
      if (!idsSelecionados.length) { window.alert('Marque ao menos 1 atividade feita hoje.'); return; }
      const semFoto = idsSelecionados.find((id) => !(fotos[id] || []).length);
      if (semFoto) { window.alert('Toda atividade marcada precisa de pelo menos 1 foto.'); return; }

      setEnviando(true);
      try {
        const itensHoje = [];
        for (const itemId of idsSelecionados) {
          const urls = [];
          for (const f of fotos[itemId]) {
            const url = await window.AcompanhamentoObraStore.uploadFoto(estado.link.dossier_id, itemId, f.file);
            urls.push(url);
          }
          itensHoje.push({ item_id: itemId, fotos: urls, observacao: (observacoes[itemId] || '').trim() || null });
        }
        await window.AcompanhamentoObraStore.registrarLancamento(estado.link.dossier_id, itensHoje, null);
        window.alert('Enviado! Obrigado — até amanhã.');
        setSelecionados({}); setFotos({}); setObservacoes({});
        carregar();
      } catch (e) {
        window.alert('Erro ao enviar: ' + e.message);
      } finally {
        setEnviando(false);
      }
    };

    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 14px 90px', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif' }}>
        <div style={{ background: '#0b1220', color: '#fff', borderRadius: 10, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Diário de Obra</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{estado.dossier?.building_name || estado.dossier?.client_name || '—'}</div>
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,.15)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ background: '#22c55e', height: '100%', width: pct + '%' }} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{feitos}/{total} atividades feitas</div>
        </div>

        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          Marque o que você fez <b>hoje</b> e anexe uma foto de cada item. O que já está feito fica travado — só o pessoal da VerticalParts consegue desmarcar.
        </div>

        {itens.map((item) => (
          <ItemLinha key={item.id} item={item} status={statusPorItem[item.id]}
            selecionado={!!selecionados[item.id]} fotos={fotos[item.id] || []} observacao={observacoes[item.id] || ''} enviando={enviando}
            onToggle={toggle} onFotos={onFotos} onObservacao={onObservacao} />
        ))}

        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #ddd', padding: 12 }}>
          <button onClick={enviar} disabled={enviando || !Object.keys(selecionados).length}
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando…' : `Enviar (${Object.keys(selecionados).length})`}
          </button>
        </div>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('do-root'));
  root.render(<DiarioObraApp />);
}());
