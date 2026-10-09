/* ============================================================
   inbox-conversas.jsx — Inbox fase 4C (04/10/2026): CONVERSAS (threads) na lista, como no Gmail.
   SÓ LEITURA: busca message_id/in_reply_to das mensagens carregadas e agrupa com inbox-conversas-calc.js.
   window.useInboxConversas(msgs, ativo) → { porId, ligacoes } ; componente InboxFaixaConversa (mensagens da mesma conversa).
   ============================================================ */
function useInboxConversas(msgs, ativo) {
  const [ligacoes, setLigacoes] = React.useState({});
  const chave = (msgs || []).map((m) => m.id).sort().join(',');
  React.useEffect(() => {
    if (!ativo || !chave) return undefined;
    let vivo = true;
    (async () => {
      const ids = chave.split(',').filter(Boolean);
      const falta = ids.filter((id) => !(id in ligacoes));
      if (!falta.length) return;
      const novos = {};
      try {
        for (let i = 0; i < falta.length; i += 150) {
          const { data } = await window.__VP_SB.sb.from('emails_projeto').select('id,message_id,in_reply_to').in('id', falta.slice(i, i + 150));
          (data || []).forEach((r) => { novos[r.id] = { messageId: r.message_id || null, inReplyTo: r.in_reply_to || null }; });
        }
        falta.forEach((id) => { if (!novos[id]) novos[id] = {}; });   // mensagem sem linha no banco: agrupa só por assunto/ponta
      } catch (e) { console.warn('[Inbox] conversas: leitura de cabeçalhos falhou', e); falta.forEach((id) => { novos[id] = {}; }); }
      if (vivo) setLigacoes((p) => ({ ...p, ...novos }));
    })();
    return () => { vivo = false; };
  }, [chave, ativo]);
  const resultado = React.useMemo(() => (ativo && window.InboxConversas ? window.InboxConversas.agrupar(msgs, ligacoes) : { conversas: [], porId: {} }), [chave, ligacoes, ativo]);
  return { porId: resultado.porId, ligacoes };
}

/* Faixa no topo do e-mail aberto: as outras mensagens da conversa (clique abre). */
function InboxFaixaConversa({ conversa, linhas, ativoId, onAbrir, quando }) {
  const [aberta, setAberta] = React.useState(false);
  React.useEffect(() => { setAberta(false); }, [conversa && conversa.chave]);
  if (!conversa || conversa.total < 2) return null;
  const por = Object.fromEntries((linhas || []).map((m) => [m.id, m]));
  const membros = conversa.ids.map((id) => por[id]).filter(Boolean);
  return (
    <div className="io-conversa">
      <button className="io-conversa__cab" onClick={() => setAberta((a) => !a)}>
        <b>Conversa · {membros.length} mensagens</b> <span className="muted small">{aberta ? '▲ ocultar' : '▼ ver todas'}</span>
      </button>
      {aberta && membros.map((m) => (
        <div key={m.id} className={'io-conversa__item' + (m.id === ativoId ? ' on' : '')} onClick={() => onAbrir(m.id)}>
          <span className="io-conversa__quem">{m._pasta === 'sent' ? 'Você' : (m.fromName || m.from)}</span>
          <span className="io-conversa__txt">{String(m.preview || '').replace(/\s+/g, ' ').slice(0, 110)}</span>
          <span className="muted small">{quando ? quando(m.date) : ''}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { useInboxConversas, InboxFaixaConversa });
