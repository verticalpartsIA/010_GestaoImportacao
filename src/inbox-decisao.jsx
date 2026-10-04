/* ============================================================
   inbox-decisao.jsx — Inbox: botão "Pedir decisão" (04/10/2026).
   Do e-mail aberto, cria uma decisão na Central de Decisões (DecisoesStore.pedirDecisaoInbox) ligada ao e-mail, com a pergunta e
   quem decide (padrão: o chefe do responsável pelo e-mail; dá para trocar/acrescentar, inclusive o CEO). Qualquer um dos escolhidos
   pode decidir. O resultado volta para quem pediu (aviso da Central) e aparece na faixa do e-mail.
   window.InboxModalPedirDecisao, window.InboxFaixaDecisao, window.useDecisoesDoEmail
   ============================================================ */
const ID_CEO_EMAIL = 'diego@verticalparts.com.br';

/* chefe direto de quem é responsável pelo e-mail (manager_id); sem responsável/sem chefe → lista vazia */
function idChefeDe(colaboradores, emailResponsavel) {
  const r = String(emailResponsavel || '').toLowerCase();
  const eu = (colaboradores || []).find((p) => String(p.email || '').toLowerCase() === r);
  const chefe = eu && eu.manager_id ? (colaboradores || []).find((p) => p.id === eu.manager_id) : null;
  return chefe && chefe.email ? [String(chefe.email).toLowerCase()] : [];
}

function useDecisoesDoEmail(emailId, recarregar) {
  const [lista, setLista] = React.useState([]);
  React.useEffect(() => {
    if (!emailId || !window.__VP_SB) { setLista([]); return undefined; }
    let vivo = true;
    window.__VP_SB.sb.from('decisoes_gerenciais').select('id,status,criado_em,decidido_por,decidido_em,motivo,aprovadores_esperados,contexto,solicitado_por')
      .eq('referencia_tabela', 'emails_projeto').eq('referencia_id', String(emailId)).order('criado_em', { ascending: false })
      .then(({ data }) => { if (vivo) setLista(data || []); });
    return () => { vivo = false; };
  }, [emailId, recarregar]);
  return lista;
}

const ID_STATUS = { pendente: ['Aguardando decisão', 'var(--warning, #b7791f)'], aprovada: ['Aprovada', 'var(--success, #2f855a)'], reprovada: ['Reprovada', 'var(--danger, #c53030)'], cancelada: ['Cancelada', 'var(--fg3, #777)'], bloqueada_por_dependencia: ['Aguardando', 'var(--fg3, #777)'] };

function InboxFaixaDecisao({ decisoes, nomeDe }) {
  if (!decisoes || !decisoes.length) return null;
  return (
    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      {decisoes.slice(0, 3).map((d) => {
        const [rot, cor] = ID_STATUS[d.status] || [d.status, 'var(--fg2)'];
        const quem = (d.aprovadores_esperados || []).map((e) => (nomeDe ? nomeDe(e) : e)).join(', ');
        return (
          <div key={d.id} className="small" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
            <b style={{ color: cor }}>Decisão: {rot}</b> — “{(d.contexto && d.contexto.pergunta) || '—'}”
            <div className="muted">Para: {quem || '—'}{d.decidido_por ? ` · decidido por ${nomeDe ? nomeDe(d.decidido_por) : d.decidido_por}` : ''}{d.motivo ? ` · “${d.motivo}”` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function InboxModalPedirDecisao({ email, responsavel, colaboradores, eu, onClose, onCriada }) {
  const pessoas = (colaboradores || []).filter((p) => p.email && String(p.email).toLowerCase() !== String(eu || '').toLowerCase());
  const chefe = idChefeDe(colaboradores, responsavel || eu);
  const [pergunta, setPergunta] = React.useState('');
  const [escolhidos, setEscolhidos] = React.useState(() => new Set(chefe));
  const [busca, setBusca] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const alternar = (mail) => setEscolhidos((p) => { const n = new Set(p); const k = String(mail).toLowerCase(); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const lista = pessoas.filter((p) => (`${p.nome || ''} ${p.email} ${p.departamento || ''}`).toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 40);
  const nome = (mail) => { const p = (colaboradores || []).find((x) => String(x.email).toLowerCase() === String(mail).toLowerCase()); return (p && p.nome) || mail; };
  const enviar = async () => {
    setSalvando(true);
    try {
      const d = await window.DecisoesStore.pedirDecisaoInbox({ emailId: email.id, assunto: email.subject, de: email.from, numeroCotacao: email.numeroCotacao, pergunta, aprovadores: [...escolhidos] });
      window.toast?.('Decisão pedida — quem decide foi avisado na Central de Notificações.', 'success');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: 'Pediu decisão a partir de um e-mail', alvo: email.subject || '(sem assunto)', alvo_id: email.id, detalhe: { decisao_id: d.id, aprovadores: [...escolhidos] } });
      onCriada && onCriada(d); onClose();
    } catch (e) { window.toast?.('Não consegui pedir a decisão: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head"><b>Pedir decisão</b><button className="ig-iconbtn" onClick={onClose} title="Fechar"><Icon.x size={14}/></button></div>
        <div className="modal__body" style={{ display: 'grid', gap: 12 }}>
          <div className="small muted">E-mail: <b>{email.subject || '(sem assunto)'}</b>{email.fromName || email.from ? ` · de ${email.fromName || email.from}` : ''}</div>
          <label className="field">
            <span className="field__label">O que precisa ser decidido? *</span>
            <textarea className="input" rows={3} maxLength={400} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: Podemos dar 5% de desconto para fechar esta semana?"/>
          </label>
          <div>
            <div className="field__label" style={{ marginBottom: 4 }}>Quem decide * <span className="muted small">— quem decidir primeiro encerra o pedido</span></div>
            {escolhidos.size > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>{[...escolhidos].map((m) => <span key={m} className="badge" style={{ cursor: 'pointer' }} onClick={() => alternar(m)} title="Tirar">{nome(m)} ×</span>)}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input className="input" placeholder="Buscar pessoa, e-mail ou departamento…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }}/>
              <button className="btn btn--outline btn--sm" type="button" onClick={() => alternar(ID_CEO_EMAIL)}>{escolhidos.has(ID_CEO_EMAIL) ? 'Tirar o CEO' : 'Incluir o CEO'}</button>
            </div>
            {!chefe.length && <div className="small muted" style={{ marginBottom: 6 }}>Não achei o chefe do responsável no cadastro — escolha quem decide.</div>}
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {lista.map((p) => (
                <label key={p.email} style={{ display: 'flex', gap: 8, padding: '5px 10px', cursor: 'pointer', alignItems: 'center' }}>
                  <input type="checkbox" checked={escolhidos.has(String(p.email).toLowerCase())} onChange={() => alternar(p.email)}/>
                  <span>{p.nome || p.email}</span><span className="muted small">{p.departamento || ''}{p.is_department_lead ? ' · líder' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal__foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={salvando || !pergunta.trim() || escolhidos.size === 0} onClick={enviar}>{salvando ? 'Enviando…' : 'Pedir decisão'}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InboxModalPedirDecisao, InboxFaixaDecisao, useDecisoesDoEmail });
