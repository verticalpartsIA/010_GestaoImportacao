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
  const [meta, setMeta] = React.useState({ ia: {}, dono: {}, atribuido: {}, pronto: false });
  const chave = (emails || []).map((e) => e.id).filter((id) => IT_UUID.test(String(id))).sort().join(',');
  const [versao, setVersao] = React.useState(0);          // força nova leitura (ex.: depois de atribuir)
  React.useEffect(() => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setMeta({ ia: {}, dono: {}, atribuido: {}, pronto: true }); return; }
    if (!chave) { setMeta({ ia: {}, dono: {}, atribuido: {}, pronto: (emails || []).length === 0 }); return; }
    let vivo = true;
    sb.from('emails_projeto').select('id, ia_decisao, dono_email, atribuido_a, spam_em').in('id', chave.split(','))
      .then(({ data }) => {
        if (!vivo) return;
        const ia = {}; const dono = {}; const atribuido = {}; const spam = {};
        (data || []).forEach((r) => { if (r.ia_decisao) ia[r.id] = r.ia_decisao; dono[r.id] = r.dono_email || null; atribuido[r.id] = r.atribuido_a || null; spam[r.id] = r.spam_em || null; });
        setMeta({ ia, dono, atribuido, spam, pronto: true });
      })
      .catch(() => { if (vivo) setMeta({ ia: {}, dono: {}, atribuido: {}, pronto: true }); });   // sem metadados a tela funciona como sempre
    return () => { vivo = false; };
  }, [chave, versao]);
  return { ...meta, recarregar: () => setVersao((v) => v + 1) };
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

/* ============================================================
   FASE 2 (04/10/2026, mesmas regras do JEV: decisão estruturada com confiança; só aparece o que ajuda)
   ============================================================ */

/* Aviso na Central de Notificações para UMA pessoa (falha engolida: o aviso nunca atrapalha a ação). */
async function inboxNotificar(destinatario, titulo, sub) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  if (!sb || !destinatario) return;
  try {
    const { error } = await sb.from('alertas').insert({
      id: 'inbox-aviso-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), level: 'info',
      title: titulo, sub: String(sub || '').slice(0, 480), module: 'Inbox', resolved: false,
      destinatario_email: String(destinatario).toLowerCase(), rota: '/geral/inbox',
    });
    if (error) console.warn('[Inbox] aviso não gravado', error);
  } catch (e) { console.warn('[Inbox] aviso não gravado', e); }
}

/* Sugere a cotação (função SQL inbox_sugerir_vinculo) a partir do e-mail da OUTRA PONTA. E-mails internos não entram
   (colega nunca indica a cotação). Devolve { sug, politica: 'forte'|'perguntar'|'silencio' }. Erro = silêncio. */
async function inboxBuscarSugestao(emailsTexto, assunto) {
  const vazio = { sug: null, politica: 'silencio' };
  const sb = window.__VP_SB && window.__VP_SB.sb;
  if (!sb || !window.InboxTriagem) return vazio;
  const lista = String(emailsTexto || '').split(/[,;\s]+/).map((s) => s.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase())
    .filter((e) => e.includes('@') && !/@(vpsistema\.com|verticalparts\.com\.br)$/.test(e));
  if (!lista.length) return vazio;
  try {
    const { data, error } = await sb.rpc('inbox_sugerir_vinculo', { p_emails: lista, p_assunto: assunto || null });
    if (error || !data) return vazio;
    return { sug: data, politica: window.InboxTriagem.politicaSugestao(data) };
  } catch (e) { return vazio; }
}

/* useSugestaoVinculo(email, ponta) — sugestão para o e-mail ABERTO que ainda não tem cotação. */
function useSugestaoVinculo(email, ponta) {
  const [s, setS] = React.useState(null);
  const id = email && email.numeroCotacao == null ? email.id : null;
  React.useEffect(() => {
    setS(null);
    if (!id) return;
    let vivo = true;
    inboxBuscarSugestao(ponta, email.subject).then((r) => { if (vivo) setS(r); });
    return () => { vivo = false; };
  }, [id]);
  return s;
}

/* Barra no cabeçalho do e-mail: "Parece da Cotação Nº 955 — CLIENTE (72%) [Vincular]". Silêncio = não aparece. */
function InboxSugestaoBarra({ s, onVincular, ocupado }) {
  if (!s || s.politica === 'silencio' || !s.sug) return null;
  const c = s.sug.candidatos.slice(0, s.politica === 'forte' ? 1 : 3);
  return (
    <div className="alert info" style={{ marginTop: 8 }}>
      <Icon.link2/>
      <div style={{ flex: 1 }}>
        <div className="alert__title">{s.politica === 'forte' ? 'Parece ser desta cotação' : 'Pode ser de uma destas cotações'}</div>
        <div className="small" style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.map((x) => (
            <div key={x.numero} className="row gap-2" style={{ alignItems: 'center' }}>
              <span><b>Cotação Nº {x.numero}</b>{x.nome ? ' — ' + x.nome : ''} <span className="muted">({Math.round((x.probabilidade || 0) * 100)}% · regras)</span></span>
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onVincular(x.numero)}>Vincular</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Pop-up ANTES de enviar sem número de cotação (só aparece quando há evidência — política forte/perguntar). */
function InboxPopupVinculoEnvio({ r, onEscolher, onSemVinculo, onCancelar }) {
  const c = (r.sug.candidatos || []).slice(0, 4);
  const [sel, setSel] = React.useState(r.politica === 'forte' && c[0] ? c[0].numero : null);
  return (
    <Modal title="Vincular este e-mail a uma cotação?" onClose={onCancelar} width={520}
      footer={<div className="row gap-2">
        <Button variant="primary" disabled={sel == null} onClick={() => onEscolher(sel)}>Vincular e enviar</Button>
        <Button variant="outline" onClick={onSemVinculo}>Enviar sem vincular</Button>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="small muted">Você não informou o Nº da cotação. {r.politica === 'forte' ? 'Esta parece ser a certa:' : 'Estas podem ser:'} (sugestão por regras, você decide)</div>
        {c.map((x) => (
          <label key={x.numero} className="row gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="vinculo-envio" checked={sel === x.numero} onChange={() => setSel(x.numero)}/>
            <span><b>Cotação Nº {x.numero}</b>{x.nome ? ' — ' + x.nome : ''} <span className="muted">({Math.round((x.probabilidade || 0) * 100)}%)</span></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/* Aviso ao responder e-mail que é de OUTRA pessoa (dono ou atribuído). Só aparece nesse caso. */
function InboxAvisoOutroDono({ responsavel, nomeDe, onConfirmar, onCancelar }) {
  return (
    <Modal title="Este e-mail é de outra pessoa" onClose={onCancelar} width={460}
      footer={<div className="row gap-2">
        <Button variant="primary" onClick={onConfirmar}>Responder mesmo assim</Button>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>}>
      <div className="stack" style={{ gap: 6 }}>
        <div>O responsável por este e-mail é <b>{nomeDe(responsavel)}</b> ({responsavel}).</div>
        <div className="small muted">Se você responder, ela(e) será avisado(a) na Central de Notificações. Para passar o e-mail a você de vez, use “Atribuir”.</div>
      </div>
    </Modal>
  );
}

/* Troca de responsável. O autor/dono original NUNCA muda; fica o histórico (inbox_atribuicoes). Avisa quem recebe e quem perdeu. */
async function inboxAtribuir({ emailId, de, para, por, motivo }) {
  const sb = window.__VP_SB.sb;
  const agora = new Date().toISOString();
  const { data, error } = await sb.from('emails_projeto').update({ atribuido_a: para, atribuido_por: por, atribuido_em: agora }).eq('id', emailId).select('id');
  if (error) throw error;
  if (!data || !data.length) throw new Error('Não foi possível atribuir (sem permissão ou e-mail inexistente).');
  const { error: errH } = await sb.from('inbox_atribuicoes').insert({ email_id: emailId, de_pessoa: de || null, para_pessoa: para, por_pessoa: por, motivo: motivo || null });
  if (errH) console.warn('[Inbox] histórico da atribuição não gravado', errH);
  if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: 'Atribuiu e-mail', alvo: para, alvo_id: emailId, detalhe: { de: de || null, motivo: motivo || null } });
  if (para !== por) await inboxNotificar(para, 'E-mail atribuído a você', (por || 'Alguém') + ' passou um e-mail para você' + (motivo ? ' — ' + motivo : '') + '.');
  if (de && de !== por && de !== para) await inboxNotificar(de, 'E-mail passado para outra pessoa', (por || 'Alguém') + ' atribuiu um e-mail seu a ' + para + '.');
}

function InboxModalAtribuir({ email, dono, atribuido, decisao, ctx, onClose, onSalvo }) {
  const T = window.InboxTriagem;
  const eu = (ctx && ctx.eu) || String((window.__VP_USER || {}).email || '').toLowerCase();
  const pessoas = ((ctx && ctx.colaboradores) || []).filter((p) => p.email);
  const sugeridos = T.sugerirResponsavel({ decisao, colaboradores: pessoas, eu });
  const [alvo, setAlvo] = React.useState(sugeridos[0] ? sugeridos[0].email : '');
  const [motivo, setMotivo] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const atual = T.responsavelDe(dono, atribuido);
  const lista = pessoas.filter((p) => p.email.toLowerCase() !== atual && (`${p.nome || ''} ${p.email} ${p.departamento || ''}`).toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email)).slice(0, 60);
  const salvar = async () => {
    if (!alvo) return;
    setSalvando(true);
    try {
      await inboxAtribuir({ emailId: email.id, de: atual, para: alvo.toLowerCase(), por: eu, motivo: motivo.trim() });
      window.toast?.('E-mail atribuído.', 'success');
      onSalvo(alvo.toLowerCase());
    } catch (e) { window.toast?.('Erro ao atribuir: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };
  return (
    <Modal title="Atribuir e-mail" onClose={onClose} width={520}
      footer={<div className="row gap-2">
        <Button variant="primary" disabled={!alvo || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Atribuir'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="small muted">Responsável hoje: <b>{atual || 'ninguém (fila de triagem)'}</b>. O autor original e o histórico ficam preservados.</div>
        {sugeridos.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="up-eyebrow muted">Sugestão (regras)</div>
            {sugeridos.map((s) => (
              <label key={s.email} className="row gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="atribuir" checked={alvo === s.email} onChange={() => setAlvo(s.email)}/>
                <span><b>{s.nome || s.email}</b> <span className="muted">— {s.motivo} ({Math.round(s.probabilidade * 100)}%)</span></span>
              </label>
            ))}
          </div>
        )}
        <input className="input" placeholder="Buscar pessoa, e-mail ou departamento…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <select className="input" size={6} value={alvo} onChange={(e) => setAlvo(e.target.value)}>
          {lista.map((p) => <option key={p.email} value={p.email}>{(p.nome || p.email) + ' — ' + (p.departamento || 'sem departamento')}</option>)}
        </select>
        <input className="input" placeholder="Motivo (opcional) — ex.: férias do vendedor" value={motivo} onChange={(e) => setMotivo(e.target.value)}/>
      </div>
    </Modal>
  );
}

/* Lido e estrela POR PESSOA. `estado` = { [emailId]: { lido, estrela } } só da pessoa logada. Atualização otimista. */
function useInboxEstado(emails) {
  const [estado, setEstado] = React.useState({});
  const eu = String((window.__VP_USER || {}).email || '').toLowerCase();
  const chave = (emails || []).map((e) => e.id).filter((id) => IT_UUID.test(String(id))).sort().join(',');
  React.useEffect(() => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb || !chave || !eu) { setEstado({}); return; }
    let vivo = true;
    sb.from('inbox_estado_pessoa').select('email_id, lido, estrela, arquivado, adiado_ate').eq('pessoa', eu).in('email_id', chave.split(','))
      .then(({ data }) => { if (vivo) { const m = {}; (data || []).forEach((r) => { m[r.email_id] = { lido: r.lido, estrela: r.estrela, arquivado: r.arquivado, adiado_ate: r.adiado_ate }; }); setEstado(m); } })
      .catch(() => { if (vivo) setEstado({}); });
    return () => { vivo = false; };
  }, [chave, eu]);
  const gravar = React.useCallback((id, patch) => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb || !eu || !IT_UUID.test(String(id))) return;
    setEstado((prev) => ({ ...prev, [id]: { lido: null, estrela: false, ...(prev[id] || {}), ...patch } }));
    sb.from('inbox_estado_pessoa').upsert({ email_id: id, pessoa: eu, ...patch, atualizado_em: new Date().toISOString() }, { onConflict: 'email_id,pessoa' })
      .then(({ error }) => { if (error) console.warn('[Inbox] estado não gravado', error); });
  }, [eu]);
  const marcarLido = React.useCallback((id) => gravar(id, { lido: true }), [gravar]);
  const definirLido = React.useCallback((id, lido) => gravar(id, { lido: !!lido }), [gravar]);      // "Marcar como lida / não lida" (só para mim)
  const alternarEstrela = React.useCallback((id, atual) => gravar(id, { estrela: !atual }), [gravar]);
  /* Fase 4A: gravação em lote (Arquivar / Suspender), tudo POR PESSOA. Atualização otimista; erro avisa e a tela recarrega ao atualizar. */
  const gravarVarios = React.useCallback((ids, patch) => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    const validos = (ids || []).filter((id) => IT_UUID.test(String(id)));
    if (!sb || !eu || !validos.length) return Promise.resolve(false);
    setEstado((prev) => {
      const n = { ...prev };
      validos.forEach((id) => { n[id] = { lido: null, estrela: false, arquivado: false, adiado_ate: null, ...(n[id] || {}), ...patch }; });
      return n;
    });
    const agora = new Date().toISOString();
    return sb.from('inbox_estado_pessoa').upsert(validos.map((id) => ({ email_id: id, pessoa: eu, ...patch, atualizado_em: agora })), { onConflict: 'email_id,pessoa' })
      .then(({ error }) => {
        if (error) { console.warn('[Inbox] estado não gravado', error); window.toast?.('Não consegui salvar: ' + error.message, 'error'); return false; }
        return true;
      });
  }, [eu]);
  const arquivar = React.useCallback((ids, sim) => gravarVarios(ids, { arquivado: !!sim }), [gravarVarios]);
  /* Suspender: volta na hora escolhida, como NÃO lido (lido=false) e com aviso na Central (cron inbox-acordar-adiados). quando=null cancela. */
  const adiar = React.useCallback((ids, quando) => gravarVarios(ids, quando
    ? { adiado_ate: new Date(quando).toISOString(), acordado_avisado_em: null, lido: false }
    : { adiado_ate: null, acordado_avisado_em: null }), [gravarVarios]);
  return { estado, marcarLido, definirLido, alternarEstrela, arquivar, adiar };
}

Object.assign(window, { useInboxMeta, useInboxPermissoes, InboxChip, InboxFaixaImportante,
  inboxNotificar, inboxBuscarSugestao, useSugestaoVinculo, InboxSugestaoBarra, InboxPopupVinculoEnvio, InboxAvisoOutroDono,
  inboxAtribuir, InboxModalAtribuir, useInboxEstado });
