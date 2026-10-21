/* ============================================================
   cotacao-fornecedor-arquivos.jsx — abas "Imagens" e "Documentos" da cotação a fornecedor (20/10/2026).
   Repositório SÓ DE LEITURA de tudo o que o fornecedor mandou: anexos do formulário do link + anexos dos e-mails
   de entrada ligados a esta cotação (TratativasStore.listarArquivosFornecedor). A separação imagem × documento e
   o agrupamento de versões ficam em CfArquivosCalc. Cada e-mail novo que o read-inbox grava aparece aqui sozinho
   (recarrega a cada 60 s e ao voltar para a aba). Nada é copiado, movido nem gravado.
   window.CfArquivosFornecedor({ cot, numeroCotacao, tipo: 'imagens' | 'documentos' })
   ============================================================ */

function cfaData(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; }
}
function cfaTamanho(b) {
  const n = Number(b); if (!(n > 0)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
}
function cfaOrigem(a) {
  return a.origem === 'formulario' ? 'Formulário do link' : ('E-mail' + (a.remetente ? ' de ' + a.remetente : ''));
}
function cfaAbrirInbox(emailId) {
  if (!emailId) return;
  window.history.pushState({}, '', '/geral/inbox/' + emailId);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function CfaLinhaDoc({ a, vigente }) {
  return (
    <div className="row gap-3" style={{ alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line, #eee)' }}>
      <Icon.fileText/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: vigente ? 600 : 400, wordBreak: 'break-all' }}>{a.nome}</span>
          {vigente && <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999 }}>Vigente</span>}
        </div>
        <div className="muted small">{cfaData(a.quando)} · {cfaOrigem(a)}{cfaTamanho(a.tamanho) ? ' · ' + cfaTamanho(a.tamanho) : ''}</div>
      </div>
      {a.emailId && <Button variant="ghost" size="sm" icon="mail" onClick={() => cfaAbrirInbox(a.emailId)}>Ver e-mail</Button>}
      {a.url
        ? <Button variant="outline" size="sm" icon="link2" onClick={() => window.open(a.url, '_blank', 'noopener')}>Abrir</Button>
        : <span className="muted small" title="Não foi possível gerar o link agora. Clique em Atualizar.">sem link</span>}
    </div>
  );
}

function CfArquivosFornecedor({ cot, numeroCotacao, tipo }) {
  const store = window.TratativasStore;
  const calc = window.CfArquivosCalc;
  const [lista, setLista] = React.useState(null);
  const [carregando, setCarregando] = React.useState(false);
  const [antigasAbertas, setAntigasAbertas] = React.useState({});
  const [mostrarOcultas, setMostrarOcultas] = React.useState(false);
  const [ampliada, setAmpliada] = React.useState(null);
  const cotId = cot && cot.id;
  const formularioId = cot && cot.formulario_elevador_id;

  const carregar = React.useCallback(async (silencioso) => {
    if (!store || !store.listarArquivosFornecedor || !cotId) { setLista([]); return; }
    if (!silencioso) setCarregando(true);
    try { setLista(await store.listarArquivosFornecedor({ cotacaoFornecedorId: cotId, numeroCotacao, formularioId })); }
    catch (e) { console.warn('[Arquivos do fornecedor]', e); setLista((l) => l || []); }
    setCarregando(false);
  }, [cotId, numeroCotacao, formularioId]);

  React.useEffect(() => {
    carregar(false);
    const t = setInterval(() => carregar(true), 60000);
    const vis = () => { if (document.visibilityState === 'visible') carregar(true); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);

  const r = React.useMemo(() => (calc ? calc.montar(lista || []) : { documentos: [], imagens: [] }), [lista]);
  const atualizar = <Button variant="ghost" size="sm" disabled={carregando} onClick={() => carregar(false)}>{carregando ? 'Atualizando…' : 'Atualizar'}</Button>;
  const subtitulo = 'Anexos que o fornecedor mandou pelo formulário do link e pelos e-mails ligados a esta cotação. Cada e-mail novo aparece aqui sozinho (a caixa é lida a cada 10 min).';

  if (lista == null) {
    return <Card title={tipo === 'imagens' ? 'Imagens' : 'Documentos'} sub={subtitulo}><div className="muted" style={{ padding: 16 }}>Carregando…</div></Card>;
  }

  if (tipo === 'documentos') {
    const nVersoes = r.documentos.reduce((s, d) => s + 1 + d.antigas.length, 0);
    return (
      <Card title={'Documentos (' + r.documentos.length + ')'} sub={subtitulo} action={atualizar}>
        {r.documentos.length === 0 && <div className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>O fornecedor ainda não mandou nenhum documento.</div>}
        {r.documentos.length > 0 && (
          <div className="muted small" style={{ marginBottom: 6 }}>
            {nVersoes} arquivo(s) recebidos. Versões do mesmo documento são agrupadas pelo nome; vale a mais recente (<b>Vigente</b>).
            Se o fornecedor mudar o nome do arquivo, ele aparece como documento separado.
          </div>
        )}
        {r.documentos.map((d) => (
          <div key={d.familia} style={{ marginBottom: 6 }}>
            <CfaLinhaDoc a={d.vigente} vigente/>
            {d.antigas.length > 0 && (
              <div style={{ paddingLeft: 28 }}>
                <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 12 }}
                  onClick={() => setAntigasAbertas((s) => ({ ...s, [d.familia]: !s[d.familia] }))}>
                  {antigasAbertas[d.familia] ? '▾' : '▸'} {d.antigas.length} versão(ões) anterior(es)
                </button>
                {antigasAbertas[d.familia] && d.antigas.map((a) => <div key={a.id} style={{ opacity: 0.8 }}><CfaLinhaDoc a={a}/></div>)}
              </div>
            )}
          </div>
        ))}
      </Card>
    );
  }

  const visiveis = r.imagens.filter((i) => mostrarOcultas || !i.oculta);
  const nOcultas = r.imagens.filter((i) => i.oculta).length;
  return (
    <Card title={'Imagens (' + visiveis.length + ')'} sub={subtitulo} action={atualizar}>
      {r.imagens.length === 0 && <div className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>O fornecedor ainda não mandou nenhuma imagem.</div>}
      {r.imagens.length > 0 && (
        <div className="muted small" style={{ marginBottom: 10 }}>
          A mesma imagem recebida várias vezes (mesmo tamanho) aparece uma vez só.
          {nOcultas > 0 && <> {nOcultas} imagem(ns) muito pequena(s) (logo de assinatura) {mostrarOcultas ? 'à mostra' : 'oculta(s)'} — <a href="#" onClick={(e) => { e.preventDefault(); setMostrarOcultas((v) => !v); }}>{mostrarOcultas ? 'esconder' : 'mostrar'}</a>.</>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {visiveis.map((i) => (
          <div key={i.id} style={{ border: '1px solid var(--line, #e5e5e5)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg2, #fafafa)' }}>
            <button type="button" onClick={() => i.url && setAmpliada(i)} title={i.url ? 'Ampliar' : 'Sem link agora — clique em Atualizar'}
              style={{ display: 'block', width: '100%', height: 140, padding: 0, border: 0, background: '#fff', cursor: i.url ? 'zoom-in' : 'default' }}>
              {i.url
                ? <img src={i.url} alt={i.nome} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <span className="muted small">sem link</span>}
            </button>
            <div style={{ padding: '6px 8px' }}>
              <div className="small" style={{ fontWeight: 600, wordBreak: 'break-all' }}>{i.nome}</div>
              <div className="muted small">{cfaData(i.quando)}{i.vezes > 1 ? ' · recebida ' + i.vezes + 'x' : ''}</div>
              <div className="muted small">{cfaOrigem(i)}</div>
              {i.emailId && <a href="#" className="small" onClick={(e) => { e.preventDefault(); cfaAbrirInbox(i.emailId); }}>Ver e-mail</a>}
            </div>
          </div>
        ))}
      </div>
      {ampliada && (
        <div onClick={() => setAmpliada(null)} role="dialog" aria-label={ampliada.nome}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <img src={ampliada.url} alt={ampliada.nome} style={{ maxWidth: '95vw', maxHeight: '82vh', objectFit: 'contain', background: '#fff' }}/>
            <div className="row gap-2" style={{ justifyContent: 'space-between', color: '#fff', fontSize: 13 }}>
              <span style={{ wordBreak: 'break-all' }}>{ampliada.nome}</span>
              <span className="row gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(ampliada.url, '_blank', 'noopener')}>Abrir em nova aba</Button>
                <Button variant="outline" size="sm" onClick={() => setAmpliada(null)}>Fechar</Button>
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

Object.assign(window, { CfArquivosFornecedor });
