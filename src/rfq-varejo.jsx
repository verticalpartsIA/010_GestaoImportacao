/* ============================================================
   rfq-varejo.jsx — RFQ Importação (/gestao-importacao/rfq-importacao) · Cotações de VAREJO.
   Cada lote COTV-xxxx entra sozinho na lista da RFQ. Ao abrir: um cartão por fornecedor convidado, com o que ele respondeu
   (preço por faixa de quantidade, prazo, MOQ) e a TRATATIVA — a conversa única com o exportador até o fim da negociação, no
   mesmo molde das tratativas dos equipamentos (e-mails do Inbox + mensagens + eventos + mudanças de preço, em ordem de data).
   O MAPA comparativo e a aprovação da compra continuam em Cotações de Varejo. window.RFQVarejoLista / RFQVarejoDetalhe
   ============================================================ */
const RV_STATUS_LOTE = {
  rascunho: { label: 'Rascunho', variant: 'neutral' }, em_cotacao: { label: 'Em cotação', variant: 'warning' },
  aprovado: { label: 'Aprovado', variant: 'success' }, cancelado: { label: 'Cancelado', variant: 'danger' },
};
const RV_STATUS_CONVITE = {
  rascunho: { label: 'não enviado', variant: 'neutral' }, enviado: { label: 'aguardando', variant: 'warning' },
  visualizado: { label: 'abriu o link', variant: 'info' }, respondido: { label: 'respondeu', variant: 'success' },
};
function rvData(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function rvNum(v) { return (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
function rvMoeda(v, moeda) { const n = Number(v); if (!isFinite(n)) return '—'; return ({ USD: 'US$', BRL: 'R$', EUR: '€', RMB: 'RMB', CNY: 'CN¥' }[moeda] || moeda || '') + ' ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function rvIrPara(rota) { try { window.history.pushState({}, '', rota); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) { window.location.href = rota; } }

/* ---------- Linha do lote na lista da RFQ ---------- */
function RFQVarejoLinha({ lote, onAbrir }) {
  const st = RV_STATUS_LOTE[lote.status] || RV_STATUS_LOTE.rascunho;
  return (
    <div onClick={() => onAbrir(lote.id)} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', cursor: 'pointer' }}>
      <div className="row sb" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row gap-2" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 800 }}>{lote.numero}</span>
            <Badge variant={st.variant}>{st.label}</Badge>
            <Badge variant="info">Varejo</Badge>
          </div>
          <div className="cell-sub mono">
            Criado: {rvData(lote.created_at)} · Itens: {lote.qtdItens} · Fornecedores: {lote.qtdFornecedores} · Responderam: {lote.qtdRespondidos}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onAbrir(lote.id); }}>Abrir tratativas</Button>
      </div>
    </div>
  );
}

/* ---------- Tratativa de UM fornecedor do lote ---------- */
function RVTratativa({ lote, convite, itens, respostas, editavel }) {
  const S = window.RFQVarejoStore;
  const [msgs, setMsgs] = React.useState([]);
  const [emails, setEmails] = React.useState([]);
  const [aberto, setAberto] = React.useState({});
  const [texto, setTexto] = React.useState('');
  const [anexos, setAnexos] = React.useState([]);
  const [enviando, setEnviando] = React.useState(false);
  const [aviso, setAviso] = React.useState(null);
  const fim = React.useRef(null);

  const carregar = React.useCallback(async () => {
    const [m, e] = await Promise.all([S.listarPorConvite(convite.id), S.listarEmails(convite.id)]);
    setMsgs(m); setEmails(e);
  }, [convite.id]);
  React.useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    const vis = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);

  const itensPorId = {}; itens.forEach((i) => { itensPorId[i.id] = i; });
  const respostasDoConvite = respostas.filter((r) => r.convite_id === convite.id);
  const linha = [];
  msgs.forEach((m) => linha.push({ k: 'm:' + m.id, quando: m.created_at, tipo: 'msg', m }));
  emails.forEach((e) => {
    // o aviso que a própria tratativa dispara já aparece como mensagem; não repete
    if (e.direcao === 'saida' && /^Request for Quotation/i.test(e.assunto || '') && msgs.some((m) => Math.abs(new Date(m.created_at) - new Date(e.data_mensagem)) < 120000)) return;
    linha.push({ k: 'e:' + e.id, quando: e.data_mensagem, tipo: 'email', e });
  });
  S.eventosDoConvite(convite).forEach((ev) => linha.push({ ...ev, quando: ev.quando }));
  S.mudancasDePreco(respostasDoConvite, itensPorId, convite.moeda).forEach((ev) => linha.push(ev));
  const ordenada = linha.filter((x) => x.quando).sort((a, b) => new Date(a.quando) - new Date(b.quando));

  const anexar = async (files) => {
    try {
      const novos = [];
      for (const f of Array.from(files || [])) novos.push(await S.uploadAnexo(convite.id, f));
      setAnexos((a) => a.concat(novos));
    } catch (e) { window.toast?.('Erro ao anexar: ' + (e.message || e), 'error'); }
  };
  const enviar = async () => {
    setEnviando(true); setAviso(null);
    try {
      const r = await S.enviar({ lote, convite, mensagem: texto, anexos });
      setTexto(''); setAnexos([]);
      const a = r.__email;
      setAviso(a.ok ? { ok: true, txt: 'Registrado e enviado por e-mail para ' + a.para.join(', ') + '. A resposta dele volta aqui.' } : { ok: false, txt: 'Mensagem registrada, mas o e-mail NÃO foi enviado: ' + a.motivo });
      await carregar();
      setTimeout(() => fim.current && fim.current.scrollIntoView({ block: 'nearest' }), 50);
    } catch (e) { window.toast?.(String(e.message || e), 'error'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd. pedida</th><th>Preço por faixa de quantidade ({convite.moeda})</th><th className="text-right">Prazo (dias)</th><th className="text-right">MOQ</th><th>Obs. do fornecedor</th></tr></thead>
          <tbody>
            {itens.map((it) => {
              const r = respostasDoConvite.find((x) => x.item_id === it.id);
              const faixas = r ? (window.CotacoesVarejoCalc ? window.CotacoesVarejoCalc.faixasOrdenadas(r.faixas) : (r.faixas || [])) : [];
              return (
                <tr key={it.id}>
                  <td className="mono">{it.codigo}</td><td>{it.descricao}</td><td className="text-right">{rvNum(it.quantidade_pedida)}</td>
                  <td>{faixas.length ? faixas.map((f, i) => <div key={i}>a partir de {rvNum(f.min)} un.: <b>{rvMoeda(f.preco, convite.moeda)}</b></div>) : <span className="muted">sem preço</span>}</td>
                  <td className="text-right">{r && r.lead_time_dias != null ? rvNum(r.lead_time_dias) : '—'}</td>
                  <td className="text-right">{r && r.moq != null ? rvNum(r.moq) : '—'}</td>
                  <td>{r && r.obs ? r.obs : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 800 }}>Tratativas</div>
      <div className="small muted">Histórico único com este fornecedor: mensagens daqui (saem por e-mail), e-mails dele que voltam pelo Inbox, abertura e resposta do portal e mudanças de preço, em ordem de data. Atualiza sozinho.</div>
      <div className="stack" style={{ gap: 8, maxHeight: 460, overflowY: 'auto' }}>
        {ordenada.length === 0 && <div className="small muted" style={{ padding: 12 }}>Ainda não há nada nesta conversa.</div>}
        {ordenada.map((it) => {
          if (it.tipo === 'msg') {
            const m = it.m;
            return (
              <div key={it.k} style={{ border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 4 }}>
                <div className="row sb" style={{ marginBottom: 4 }}><span className="row gap-2"><b style={{ fontSize: 12 }}>{m.autor}</b><span className="badge" style={{ fontSize: 10 }}>Tratativa</span></span><span className="muted small mono">{rvData(m.created_at)}</span></div>
                {m.mensagem && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.mensagem}</div>}
                {(m.anexos || []).length > 0 && <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 6 }}>{m.anexos.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ border: '1px solid var(--border)', padding: '4px 8px', fontSize: 12 }}>{a.nome}</a>)}</div>}
              </div>
            );
          }
          if (it.tipo === 'email') {
            const e = it.e; const entrada = e.direcao === 'entrada'; const corpo = String(e.corpo_texto || '').trim(); const open = !!aberto[e.id];
            return (
              <div key={it.k} style={{ border: '1px solid ' + (entrada ? '#86efac' : 'var(--border)'), background: entrada ? '#f6fef9' : '#fff', padding: '8px 10px', borderRadius: 4 }}>
                <div className="row sb" style={{ marginBottom: 4 }}><span className="row gap-2"><b style={{ fontSize: 12 }}>{entrada ? (e.de_nome || e.de_email) : 'VerticalParts'}</b><span className="badge badge--info" style={{ fontSize: 10 }}>{entrada ? 'E-mail recebido (Inbox)' : 'E-mail enviado (Inbox)'}</span></span><span className="muted small mono">{rvData(e.data_mensagem)}</span></div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.assunto || '(sem assunto)'}</div>
                {corpo && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 4 }}>{open || corpo.length <= 400 ? corpo : corpo.slice(0, 400) + '…'}</div>}
                <div className="row gap-2" style={{ marginTop: 6 }}>
                  {corpo.length > 400 && <button className="btn btn--ghost btn--sm" onClick={() => setAberto((a) => ({ ...a, [e.id]: !open }))}>{open ? 'Mostrar menos' : 'Ler tudo'}</button>}
                  <button className="btn btn--ghost btn--sm" onClick={() => rvIrPara('/geral/inbox/' + e.id)}>Abrir no Inbox</button>
                </div>
              </div>
            );
          }
          return (
            <div key={it.k} style={{ borderLeft: '3px solid ' + (it.tipo === 'preco' ? '#f59e0b' : '#cbd5e1'), padding: '4px 10px' }}>
              <div className="row sb"><span style={{ fontSize: 12.5 }}>{it.titulo}{it.quem ? <span className="muted"> · {it.quem}</span> : null}</span><span className="muted small mono">{rvData(it.quando)}</span></div>
              {(it.linhas || []).map((l, i) => <div key={i} className="small muted">{l}</div>)}
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      {aviso && <div style={{ padding: '8px 10px', fontSize: 12, border: '1px solid ' + (aviso.ok ? '#86efac' : '#fbb039'), background: aviso.ok ? '#f0fdf4' : '#fff8e6', color: aviso.ok ? '#166534' : '#8a5a00' }}>{aviso.ok ? '✓ ' : '⚠ '}{aviso.txt}</div>}
      {editavel && (
        <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <textarea className="input" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Escreva ao fornecedor (' + convite.fornecedor_nome + '). A mensagem vai por e-mail e a resposta dele volta para esta conversa.'} />
          {anexos.length > 0 && <div className="row gap-2" style={{ flexWrap: 'wrap' }}>{anexos.map((a, i) => <span key={i} className="badge">{a.nome} <button className="link-btn" onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}>×</button></span>)}</div>}
          <div className="row sb">
            <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>Anexar arquivo<input type="file" multiple style={{ display: 'none' }} onChange={(e) => { anexar(e.target.files); e.target.value = ''; }} /></label>
            <Button variant="primary" icon="send" onClick={enviar} disabled={enviando || (!texto.trim() && !anexos.length)}>{enviando ? 'Enviando…' : 'Enviar ao fornecedor'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Detalhe do lote ---------- */
function RFQVarejoDetalhe({ loteId, onVoltar }) {
  const C = window.CotacoesVarejoStore;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [conviteSel, setConviteSel] = window.useRotaItem('rfq-importacao', loteId);
  const carregar = React.useCallback(() => {
    C.obterLote(loteId).then((d) => { if (!d) setErro('Lote não encontrado.'); else setDados(d); }).catch((e) => setErro(e.message || String(e)));
  }, [loteId]);
  React.useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);

  if (erro) return <div className="page fade-in"><div className="alert danger"><div><div className="alert__title">Não foi possível abrir o lote</div><div className="alert__sub">{erro}</div></div></div><Button variant="outline" onClick={onVoltar}>← RFQ</Button></div>;
  if (!dados) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const { lote, itens, convites, respostas } = dados;
  const st = RV_STATUS_LOTE[lote.status] || RV_STATUS_LOTE.rascunho;
  const aberto = lote.status === 'rascunho' || lote.status === 'em_cotacao';
  const sel = convites.find((c) => c.id === conviteSel) || convites[0] || null;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Importação · Gestão Importação · RFQ · Varejo</div>
          <h1 className="page-head__title">{lote.numero} <Badge variant={st.variant}>{st.label}</Badge></h1>
          <p className="page-head__sub">Tratativas com cada exportador deste lote de varejo, até o fim da negociação. Criado por {lote.criado_por_nome || lote.criado_por || '—'} em {rvData(lote.created_at)}.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" onClick={onVoltar}>← RFQ</Button>
          <Button variant="outline" onClick={() => rvIrPara('/logistica/cotacoes-varejo/' + lote.id)}>Mapa comparativo e aprovação</Button>
        </div>
      </div>
      {convites.length === 0 ? (
        <Card title="Fornecedores"><div className="small muted">Nenhum fornecedor foi convidado neste lote ainda. Convide e peça a cotação em <a href={'/logistica/cotacoes-varejo/' + lote.id} onClick={(e) => { e.preventDefault(); rvIrPara('/logistica/cotacoes-varejo/' + lote.id); }}>Cotações de Varejo</a>.</div></Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {convites.map((cv) => {
              const s = RV_STATUS_CONVITE[cv.status] || RV_STATUS_CONVITE.rascunho; const ativo = sel && sel.id === cv.id;
              return (
                <button key={cv.id} onClick={() => setConviteSel(cv.id)} className={'btn btn--sm ' + (ativo ? 'btn--primary' : 'btn--outline')}>
                  {cv.fornecedor_nome} <span style={{ opacity: 0.8 }}>· {s.label}</span>
                </button>
              );
            })}
          </div>
          {sel && <Card title={sel.fornecedor_nome} sub={(sel.email || 'sem e-mail no cadastro') + ' · ' + sel.moeda + ' · rodada ' + sel.rodada + (sel.respondido_em ? ' · respondeu ' + rvData(sel.respondido_em) : '')}>
            <RVTratativa key={sel.id} lote={lote} convite={sel} itens={itens} respostas={respostas} editavel={aberto} />
          </Card>}
        </>
      )}
    </div>
  );
}

Object.assign(window, { RFQVarejoLinha, RFQVarejoDetalhe });
