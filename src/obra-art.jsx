/* ART por obra — ver obra-art-store.js e docs/superpowers/specs/2026-10-30-art-por-obra.md */
const ART_ETAPAS = {
  aguardando_modelo: { rotulo: 'Aguardando modelo e boleto', variante: 'warning' },
  modelo_anexado: { rotulo: 'Aguardando pagamento', variante: 'info' },
  paga: { rotulo: 'Paga — falta a definitiva', variante: 'info' },
  definitiva_anexada: { rotulo: 'Definitiva pronta — enviar à obra', variante: 'warning' },
  enviada: { rotulo: 'Enviada à obra', variante: 'success' },
};

function ArtArquivo({ arq, podeAnexar, rotulo, onFile, busy }) {
  const inp = React.useRef(null);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {arq ? <a href={arq.url} target="_blank" rel="noreferrer" title={arq.nome}>Abrir</a> : <span className="muted">—</span>}
      {podeAnexar && (
        <>
          <input ref={inp} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onFile(f); }}/>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inp.current && inp.current.click()}>{arq ? 'Trocar' : rotulo}</Button>
        </>
      )}
    </div>
  );
}

function ObraArtPage() {
  const S = window.ObraArtStore;
  const pode = (a) => !!(window.PropostaStore && window.PropostaStore.temCapacidade('art', a));
  const [lista, setLista] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  const [q, setQ] = window.useQueryParam ? window.useQueryParam('q', '') : React.useState('');

  const carregar = React.useCallback(async () => {
    try { setLista(await S.listar()); setErro(null); } catch (e) { setErro(e.message); setLista([]); }
  }, []);
  React.useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);

  const rodar = async (art, chave, fn) => {
    setBusy(art.codigo_obra + chave);
    try { await fn(); window.toast?.('Salvo.', 'success'); await carregar(); }
    catch (e) { window.toast?.(e.message, 'error'); }
    setBusy(null);
  };

  const filtrada = (lista || []).filter(a => !q || `${a.codigo_obra} ${a.cliente_nome || ''}`.toLowerCase().includes(q.toLowerCase()));
  const editar = pode('editar'), pagar = pode('confirmar_pagamento');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Obras &amp; Instalação · ART</div>
          <h1 className="page-head__title">ART de Instalação</h1>
          <p className="page-head__sub">Uma ART por obra. A linha nasce quando o primeiro Contrato do Instalador da obra é assinado e cada passo avisa a próxima pessoa por WhatsApp.</p>
        </div>
      </div>
      <Card>
        <div style={{ padding: '12px 16px' }}>
          <input className="input" placeholder="Buscar por obra ou cliente…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }}/>
        </div>
        {erro && <div style={{ padding: 16, color: 'var(--vp-danger)' }}>{erro}</div>}
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Obra</th><th>Cliente</th><th>Etapa</th><th>Modelo da ART</th><th>Boleto</th><th>Pagamento</th><th>ART definitiva</th><th>Envio à obra</th></tr></thead>
            <tbody>
              {lista === null && <tr><td colSpan={8}>Carregando…</td></tr>}
              {lista && !filtrada.length && <tr><td colSpan={8} className="muted">Nenhuma obra com ART ainda. Ela aparece aqui quando um Contrato do Instalador é assinado.</td></tr>}
              {filtrada.map(a => {
                const et = ART_ETAPAS[a.status] || { rotulo: a.status, variante: 'neutral' };
                const b = (c) => busy === a.codigo_obra + c;
                return (
                  <tr key={a.codigo_obra}>
                    <td><b>{a.codigo_obra}</b></td>
                    <td>{a.cliente_nome || '—'}</td>
                    <td><Badge variant={et.variante}>{et.rotulo}</Badge></td>
                    <td><ArtArquivo arq={a.modelo} podeAnexar={editar && ['aguardando_modelo', 'modelo_anexado'].includes(a.status)} rotulo="Anexar modelo" busy={b('modelo')} onFile={f => rodar(a, 'modelo', () => S.anexar(a, 'modelo', f))}/></td>
                    <td><ArtArquivo arq={a.boleto} podeAnexar={editar && ['aguardando_modelo', 'modelo_anexado'].includes(a.status)} rotulo="Anexar boleto" busy={b('boleto')} onFile={f => rodar(a, 'boleto', () => S.anexar(a, 'boleto', f))}/></td>
                    <td>
                      {a.pago_em ? <span>Paga em {new Date(a.pago_em).toLocaleDateString('pt-BR')}</span>
                        : a.status === 'modelo_anexado' && pagar ? <Button size="sm" variant="primary" disabled={b('paga')} onClick={() => { if (confirm('Confirmar que o boleto da ART desta obra foi pago?')) rodar(a, 'paga', () => S.marcarPaga(a)); }}>Marcar como paga</Button>
                        : <span className="muted">—</span>}
                    </td>
                    <td><ArtArquivo arq={a.definitiva} podeAnexar={editar && ['paga', 'definitiva_anexada'].includes(a.status)} rotulo="Anexar definitiva" busy={b('definitiva')} onFile={f => rodar(a, 'definitiva', () => S.anexar(a, 'definitiva', f))}/></td>
                    <td>
                      {a.enviada_em ? <span>Enviada em {new Date(a.enviada_em).toLocaleDateString('pt-BR')}</span>
                        : a.status === 'definitiva_anexada' && editar ? <Button size="sm" variant="outline" disabled={b('enviada')} onClick={() => rodar(a, 'enviada', () => S.marcarEnviada(a))}>Marcar enviada à obra</Button>
                        : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
Object.assign(window, { ObraArtPage });
