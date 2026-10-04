/* ============================================================
   inbox-triagem.jsx — "só mostra o que importa" no Inbox (04/10/2026, estilo JEV, só regras).
   A classificação é feita no banco (public.inbox_classificar → emails_projeto.ia_decisao).
   Aqui só se LÊ essa decisão e se mostra:
     - useInboxClassificacao(emails)  → { [id]: ia_decisao }  (somente leitura)
     - InboxChip                      → "Avaria · Pós-venda · Alta" em cada e-mail
     - InboxFaixaImportante           → faixa "Precisa de você (n)" no topo da lista
   Aditivo: não altera a leitura (read-inbox), o vínculo, o envio nem a exclusão do Inbox.
   ============================================================ */
const IT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* useInboxMeta(emails) → { ia: { [id]: ia_decisao }, dono: { [id]: dono_email }, pronto }
   Lê (somente leitura) a classificação e o DONO de cada e-mail da caixa de entrada. `pronto` = a consulta voltou
   (ou não há o que consultar); enquanto não, a tela não decide visibilidade por dono. Sem banco = tudo vazio. */
function useInboxMeta(emails) {
  const [meta, setMeta] = React.useState({ ia: {}, dono: {}, pronto: false });
  const chave = (emails || []).map((e) => e.id).filter((id) => IT_UUID.test(String(id))).sort().join(',');
  React.useEffect(() => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setMeta({ ia: {}, dono: {}, pronto: true }); return; }
    if (!chave) { setMeta({ ia: {}, dono: {}, pronto: (emails || []).length === 0 }); return; }
    let vivo = true;
    sb.from('emails_projeto').select('id, ia_decisao, dono_email').in('id', chave.split(','))
      .then(({ data }) => {
        if (!vivo) return;
        const ia = {}; const dono = {};
        (data || []).forEach((r) => { if (r.ia_decisao) ia[r.id] = r.ia_decisao; dono[r.id] = r.dono_email || null; });
        setMeta({ ia, dono, pronto: true });
      })
      .catch(() => { if (vivo) setMeta({ ia: {}, dono: {}, pronto: true }); });   // sem metadados a tela funciona como sempre
    return () => { vivo = false; };
  }, [chave]);
  return meta;
}

/* useInboxPermissoes() → contexto de InboxVisibilidade (alçadas + equipe da pessoa logada) ou null.
   null = ainda carregando OU falhou: a tela mostra tudo (fail-open, documentado — a restrição é organização na tela). */
function useInboxPermissoes() {
  const [ctx, setCtx] = React.useState(undefined);      // undefined = carregando; null = falhou (mostra tudo)
  React.useEffect(() => {
    let vivo = true;
    if (window.InboxVisibilidade) window.InboxVisibilidade.carregarContexto().then((c) => { if (vivo) setCtx(c); });
    else setCtx(null);
    return () => { vivo = false; };
  }, []);
  return ctx;
}

function InboxChip({ decisao }) {
  const T = window.InboxTriagem;
  if (!T || !decisao || !decisao.resumo) return null;
  const r = decisao.resumo;
  const variante = decisao.reclamacao && decisao.reclamacao.resposta ? 'danger'
    : r.prioridade === 'alta' ? 'danger' : r.prioridade === 'media' ? 'warning' : 'outline';
  const dica = `Confiança ${Math.round(Number(r.confianca) * 100)}% (regras, não calibrada) · urgência ${decisao.urgencia ? decisao.urgencia.valor : '—'}/10`
    + (decisao.exige_resposta && decisao.exige_resposta.resposta ? ' · pede resposta' : '');
  return <Badge variant={variante} style={{ marginTop: 4 }}><span title={dica}>{T.rotulo(decisao)}</span></Badge>;
}

function InboxFaixaImportante({ itens, ocultos, foco, onToggleFoco, onAbrir }) {
  if ((!itens || itens.length === 0) && !ocultos) return null;
  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: itens && itens.length ? 'var(--vp-warning-tint, rgba(245,158,11,.10))' : 'transparent' }}>
      {itens && itens.length > 0 && (
        <>
          <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>Precisa de você ({itens.length})</div>
          {itens.map((m) => (
            <div key={m.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', cursor: 'pointer' }} onClick={() => onAbrir(m.id)}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b>{window.InboxTriagem.rotulo(m.decisao)}</b> — {m.fromName || m.from}: {m.subject}
              </span>
            </div>
          ))}
        </>
      )}
      {ocultos > 0 && (
        <div className="small muted" style={{ marginTop: itens && itens.length ? 6 : 0 }}>
          {foco ? `${ocultos} e-mail(s) automático(s) ocultos` : `Mostrando ${ocultos} automático(s)`} ·{' '}
          <a href="#" onClick={(ev) => { ev.preventDefault(); onToggleFoco(); }}>{foco ? 'ver tudo' : 'ocultar de novo'}</a>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { useInboxMeta, useInboxPermissoes, InboxChip, InboxFaixaImportante });
