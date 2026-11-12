/* ============================================================
   solicitacoes-produto-chat.jsx — Chat interno e devolução com pendência
   (Engenharia & Produto › Solicitações de Produto, 8.3; spec de 04/11/2026).
   Regras de quem pode devolver/responder e o SLA moram em window.SolProdTimeline (puro, testado).
   Dados: SolicitacoesProdutoStore (mensagens, devolver, responder). NCM, SKU e código NÃO moram aqui: são da Ficha.
   Exporta window.SolChat, window.SolDevolverModal, window.SolPendenciaFaixa.
   ============================================================ */
(function () {
  'use strict';
  const T = () => window.SolProdTimeline;
  const S = () => window.SolicitacoesProdutoStore;

  const COR_SETOR = {
    solicitante: { bg: 'var(--bg2, #f3f4f6)', borda: '#2563eb', nome: 'Solicitante' },
    engenharia: { bg: '#f5f3ff', borda: '#7c3aed', nome: 'Engenharia' },
    importacao: { bg: '#fffbeb', borda: '#b45309', nome: 'Importação' },
  };
  const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  /* Quem o usuário está sendo, para as regras: e-mail, se é Administrador. */
  function useQuem(sol) {
    const user = window.__VP_USER || {};
    const email = String(user.email || '').toLowerCase();
    const [admin, setAdmin] = React.useState(false);
    React.useEffect(() => { let vivo = true; S().souAdmin().then((a) => { if (vivo) setAdmin(!!a); }); return () => { vivo = false; }; }, []);
    return { email, admin, nome: user.nome || email };
  }

  /* Faixa "Devolvida … — pendente de resposta" com o prazo de 4 h comerciais. */
  function SolPendenciaFaixa({ sol, compacta }) {
    if (!sol || !sol.pendente_com) return null;
    const atrasada = T().emAtraso(sol.pendente_prazo);
    return (
      <div role="status" style={{ background: atrasada ? '#fef2f2' : '#fffbeb', border: '1px solid ' + (atrasada ? 'var(--vp-danger, #dc2626)' : 'var(--vp-yellow, #f59e0b)'), borderRadius: 8, padding: compacta ? '4px 8px' : '10px 14px', fontSize: compacta ? 11 : 13, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b>⏳ {T().rotuloPendencia(sol.pendente_com)}</b>
        {sol.pendente_prazo && <span style={{ color: atrasada ? 'var(--vp-danger, #dc2626)' : 'inherit', fontWeight: atrasada ? 700 : 400 }}>{atrasada ? 'ATRASADA — prazo era ' : 'prazo '}{fmt(sol.pendente_prazo)}</span>}
        {!compacta && sol.pendente_motivo && <span style={{ flexBasis: '100%', color: 'var(--fg2)' }}>Motivo: {sol.pendente_motivo}</span>}
      </div>
    );
  }

  /* Escolha de quem avisar por WhatsApp (a pessoa marca; nada sai sem marcar). */
  function AvisoWhatsapp({ sol, euEmail, marcados, setMarcados }) {
    const pessoas = [];
    if (sol.solicitante_email) pessoas.push({ nome: (sol.solicitante_nome || 'Solicitante') + ' (solicitante)', email: String(sol.solicitante_email).toLowerCase() });
    T().ENGENHARIA.forEach((p) => pessoas.push({ nome: p.nome + ' (Engenharia)', email: p.email }));
    T().IMPORTACAO.forEach((p) => pessoas.push({ nome: p.nome + ' (Importação)', email: p.email }));
    const vistos = new Set();
    const lista = pessoas.filter((p) => p.email !== euEmail && !vistos.has(p.email) && vistos.add(p.email));
    const alterna = (email) => setMarcados(marcados.includes(email) ? marcados.filter((e) => e !== email) : marcados.concat(email));
    return (
      <details style={{ fontSize: 12 }}>
        <summary style={{ cursor: 'pointer' }}>📱 Avisar também por WhatsApp{marcados.length ? ` (${marcados.length})` : ''}</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '6px 0' }}>
          {lista.map((p) => (
            <label key={p.email} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={marcados.includes(p.email)} onChange={() => alterna(p.email)} /> {p.nome}
            </label>
          ))}
        </div>
      </details>
    );
  }

  function avisoResultado(r) {
    if (!r) return;
    const a = r.aviso || r;
    if (a && a.falhas) window.toast?.('A mensagem foi gravada, mas o aviso por WhatsApp NÃO saiu para ' + a.falhas + ' pessoa(s).', 'error');
    else if (a && a.enviados) window.toast?.('📱 Aviso enviado para ' + a.enviados + ' pessoa(s).', 'success');
  }

  /* ---------- Janela: devolver ---------- */
  function SolDevolverModal({ sol, onClose, onFeito }) {
    const q = useQuem(sol);
    const [publicada, setPublicada] = React.useState(undefined);
    React.useEffect(() => { let vivo = true; S().fichaPublicada(sol).then((p) => { if (vivo) setPublicada(p); }); return () => { vivo = false; }; }, [sol.id]);
    const opcoes = ['solicitante', 'engenharia', 'importacao'].map((para) => ({ para, ...T().podeDevolver(para, sol, q.email, q.admin, !!publicada) }));
    const livres = opcoes.filter((o) => o.ok);
    const [para, setPara] = React.useState('');
    const [motivo, setMotivo] = React.useState('');
    const [cita, setCita] = React.useState('');
    const [whats, setWhats] = React.useState([]);
    const [salvando, setSalvando] = React.useState(false);
    const [erro, setErro] = React.useState('');
    React.useEffect(() => { if (!para && livres.length) setPara(livres[0].para); }, [livres.length]);

    const pessoasDestino = para === 'engenharia' ? T().ENGENHARIA : para === 'importacao' ? T().IMPORTACAO : [];
    const escolhaCita = pessoasDestino.find((p) => p.email === cita) || null;
    const emailsAviso = whats.concat(escolhaCita ? [escolhaCita.email] : []).concat(para === 'solicitante' && sol.solicitante_email ? [sol.solicitante_email] : []);

    async function enviar() {
      setErro('');
      if (String(motivo).trim().length < 10) { setErro('Explique o motivo (mínimo 10 letras).'); return; }
      setSalvando(true);
      try {
        const setor = T().setorDoUsuario(sol, q.email, q.admin, para === 'solicitante' ? 'engenharia' : (para === 'engenharia' ? 'importacao' : 'engenharia'));
        const r = await S().devolver(sol, { para, motivo: String(motivo).trim(), setor, cita: escolhaCita, whatsapp: emailsAviso.filter((e) => e !== q.email) });
        avisoResultado(r);
        window.toast?.('Devolvida. Prazo de resposta: ' + fmt(r.prazo), 'success');
        onFeito && onFeito();
      } catch (e) { setErro(e.message || String(e)); }
      setSalvando(false);
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
        <div style={{ background: 'var(--bg, #fff)', borderRadius: 12, padding: 20, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 4px' }}>Devolver {sol.numero_solicitacao}</h3>
          <div style={{ fontSize: 12, color: 'var(--fg2)', marginBottom: 12 }}>A devolução abre uma pendência com prazo de 4 horas comerciais (09–17 h, seg–sex).</div>
          {publicada === undefined && <div style={{ fontSize: 12 }}>⏳ Conferindo a Ficha…</div>}
          {livres.length === 0 && publicada !== undefined && (
            <div style={{ fontSize: 13, color: 'var(--vp-danger, #dc2626)' }}>
              Não dá para devolver agora:
              <ul style={{ margin: '6px 0 0 18px' }}>{opcoes.map((o) => <li key={o.para}>{T().DESTINOS[o.para]}: {o.motivo}</li>)}</ul>
            </div>
          )}
          {livres.length > 0 && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Devolver para</label>
              <select value={para} onChange={(e) => { setPara(e.target.value); setCita(''); }} style={{ width: '100%', padding: 8, margin: '4px 0 10px' }}>
                {livres.map((o) => <option key={o.para} value={o.para}>{T().DESTINOS[o.para]}{o.para === 'solicitante' ? ' — ' + (sol.solicitante_nome || sol.solicitante_email) : ''}</option>)}
              </select>
              {pessoasDestino.length > 0 && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Citar uma pessoa (opcional — qualquer pessoa do departamento pode responder)</label>
                  <select value={cita} onChange={(e) => setCita(e.target.value)} style={{ width: '100%', padding: 8, margin: '4px 0 10px' }}>
                    <option value="">— ninguém em especial —</option>
                    {pessoasDestino.map((p) => <option key={p.email} value={p.email}>{p.nome}</option>)}
                  </select>
                </>
              )}
              <label style={{ fontSize: 12, fontWeight: 600 }}>{para === 'solicitante' ? 'O que falta? (perguntas ao solicitante) *' : 'Qual é o problema ou a dúvida? *'}</label>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={5} style={{ width: '100%', padding: 8, margin: '4px 0 8px' }} placeholder="Explique com clareza para quem vai responder." />
              <AvisoWhatsapp sol={sol} euEmail={q.email} marcados={whats} setMarcados={setWhats} />
              {para === 'solicitante' && <div style={{ fontSize: 12, color: 'var(--fg2)', margin: '6px 0' }}>Só {sol.solicitante_nome || 'o solicitante'} poderá responder esta devolução.</div>}
            </>
          )}
          {erro && <div style={{ color: 'var(--vp-danger, #dc2626)', fontSize: 13, margin: '8px 0' }}>{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={onClose} className="btn">Cancelar</button>
            {livres.length > 0 && <button onClick={enviar} disabled={salvando} className="btn btn-primary">{salvando ? 'Enviando…' : 'Devolver'}</button>}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Chat ---------- */
  function SolChat({ sol, onMudou, onVoltar }) {
    const q = useQuem(sol);
    const [msgs, setMsgs] = React.useState(null);
    const [erro, setErro] = React.useState('');
    const [texto, setTexto] = React.useState('');
    const [anexos, setAnexos] = React.useState([]);
    const [whats, setWhats] = React.useState([]);
    const [enviando, setEnviando] = React.useState(false);
    const [devolver, setDevolver] = React.useState(false);
    const fim = React.useRef(null);

    const carregar = React.useCallback(() => {
      return S().listarMensagens(sol.id)
        .then((l) => { setMsgs(l); setErro(''); })
        .catch((e) => { setMsgs((m) => m || []); setErro(e.message || String(e)); });
    }, [sol.id]);

    React.useEffect(() => {
      carregar();
      const poll = setInterval(() => { if (!document.hidden) carregar(); }, 30000);      // reserva caso o Realtime não conecte (pausa com a aba oculta)
      let canal = null;
      try {
        const c = window.__VP_SB && window.__VP_SB.sb;
        if (c && c.channel) {
          canal = c.channel('sol-chat-' + sol.id)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacao_produto_mensagens', filter: 'solicitacao_id=eq.' + sol.id }, () => carregar())
            .subscribe();
        }
      } catch (e) { console.warn('[SolChat] realtime indisponível — usa a recarga a cada 30 s', e); }
      return () => { clearInterval(poll); if (canal && window.__VP_SB.sb.removeChannel) window.__VP_SB.sb.removeChannel(canal); };
    }, [sol.id]);

    React.useEffect(() => { if (fim.current && fim.current.scrollIntoView) fim.current.scrollIntoView({ block: 'nearest' }); }, [msgs && msgs.length]);

    const pode = T().podeResponder(sol, q.email, q.admin);
    const setor = T().setorDoUsuario(sol, q.email, q.admin, sol.pendente_com || undefined);

    /* Quem escreveu a última devolução fica marcado para receber o aviso da resposta. */
    React.useEffect(() => {
      if (!sol.pendente_com || !msgs) return;
      const ultima = msgs.slice().reverse().find((m) => m.tipo === 'devolucao');
      if (ultima && ultima.autor_email && ultima.autor_email !== q.email) setWhats((w) => (w.includes(ultima.autor_email) ? w : w.concat(ultima.autor_email)));
    }, [sol.pendente_com, msgs && msgs.length]);

    async function anexar(e) {
      const arquivos = Array.from(e.target.files || []); e.target.value = '';
      for (const f of arquivos) {
        if (f.size > 25 * 1024 * 1024) { window.toast?.(f.name + ' passa de 25 MB.', 'error'); continue; }
        try { const a = await S().uploadAnexo(f, sol.id + '/chat'); setAnexos((l) => l.concat(a)); }
        catch (err) { window.toast?.('Não consegui anexar ' + f.name + ': ' + (err.message || err), 'error'); }
      }
    }

    async function enviar(comoResposta) {
      if (!String(texto).trim() || enviando) return;
      setEnviando(true);
      try {
        const base = { texto: String(texto).trim(), anexos, setor, whatsapp: whats.filter((e) => e !== q.email) };
        const r = comoResposta ? await S().responder(sol, base) : await S().enviarMensagem(sol, base);
        avisoResultado(r);
        setTexto(''); setAnexos([]); setWhats([]);
        await carregar();
        if (comoResposta && onMudou) onMudou();
      } catch (e) { window.toast?.('Não enviei: ' + (e.message || e), 'error'); }
      setEnviando(false);
    }

    const podeAlgumaDevolucao = ['solicitante', 'engenharia', 'importacao'].some((p) => T().podeDevolver(p, sol, q.email, q.admin, false).ok);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SolPendenciaFaixa sol={sol} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--fg2)' }}>Participantes: Solicitante · Engenharia · Importação</span>
          <span style={{ flex: 1 }} />
          {onVoltar && <button className="btn" onClick={onVoltar}>← Voltar</button>}
          {!sol.pendente_com && podeAlgumaDevolucao && <button className="btn" onClick={() => setDevolver(true)}>↩ Devolver…</button>}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 220, maxHeight: 460, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs === null && <div style={{ fontSize: 13 }}>⏳ Carregando…</div>}
          {erro && <div style={{ color: 'var(--vp-danger, #dc2626)', fontSize: 12 }}>Não consegui ler as mensagens: {erro}</div>}
          {msgs && msgs.length === 0 && !erro && <div style={{ fontSize: 13, color: 'var(--fg2)' }}>Nenhuma mensagem ainda. Escreva abaixo para começar a conversa.</div>}
          {msgs && msgs.map((m) => {
            const c = COR_SETOR[m.setor] || COR_SETOR.solicitante;
            const minha = String(m.autor_email).toLowerCase() === q.email;
            return (
              <div key={m.id} style={{ alignSelf: minha ? 'flex-end' : 'flex-start', maxWidth: '82%', background: c.bg, borderLeft: '4px solid ' + c.borda, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--fg2)', marginBottom: 2 }}>
                  <b>{m.autor_nome || m.autor_email}</b> · {c.nome} · {fmt(m.criado_em)}
                  {m.tipo === 'devolucao' && <b style={{ marginLeft: 6, color: '#b45309' }}>↩ DEVOLUÇÃO{m.cita_nome ? ' (citou ' + m.cita_nome + ')' : ''}</b>}
                  {m.tipo === 'resposta' && <b style={{ marginLeft: 6, color: '#15803d' }}>✓ RESPOSTA</b>}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{m.texto}</div>
                {(m.anexos || []).map((a, i) => (
                  <div key={i} style={{ marginTop: 4, fontSize: 12 }}>📎 <a href={a.url} target="_blank" rel="noreferrer">{a.nome}</a></div>
                ))}
              </div>
            );
          })}
          <div ref={fim} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sol.pendente_com && !pode && <div style={{ fontSize: 12, color: 'var(--fg2)' }}>Esta devolução aguarda {sol.pendente_com === 'solicitante' ? (sol.solicitante_nome || 'o solicitante') : 'a ' + T().DESTINOS[sol.pendente_com]}. Você pode escrever mensagens, mas só quem tem a vez encerra a pendência.</div>}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder={sol.pendente_com && pode ? 'Escreva a resposta à devolução…' : 'Digite sua mensagem…'} style={{ width: '100%', padding: 8 }} />
          {anexos.length > 0 && <div style={{ fontSize: 12 }}>{anexos.map((a, i) => <span key={i} style={{ marginRight: 10 }}>📎 {a.nome} <button className="btn" style={{ padding: '0 6px' }} onClick={() => setAnexos(anexos.filter((_, j) => j !== i))} aria-label={'Remover ' + a.nome}>×</button></span>)}</div>}
          <AvisoWhatsapp sol={sol} euEmail={q.email} marcados={whats} setMarcados={setWhats} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn" style={{ cursor: 'pointer' }}>📎 Anexar<input type="file" multiple onChange={anexar} style={{ display: 'none' }} /></label>
            <span style={{ flex: 1 }} />
            {sol.pendente_com && pode && <button className="btn btn-primary" disabled={enviando || !String(texto).trim()} onClick={() => enviar(true)}>✓ Responder e encerrar a pendência</button>}
            <button className={sol.pendente_com && pode ? 'btn' : 'btn btn-primary'} disabled={enviando || !String(texto).trim()} onClick={() => enviar(false)}>{enviando ? 'Enviando…' : 'Enviar mensagem'}</button>
          </div>
        </div>

        {devolver && <SolDevolverModal sol={sol} onClose={() => setDevolver(false)} onFeito={() => { setDevolver(false); carregar(); onMudou && onMudou(); }} />}
      </div>
    );
  }

  window.SolChat = SolChat;
  window.SolDevolverModal = SolDevolverModal;
  window.SolPendenciaFaixa = SolPendenciaFaixa;
}());
