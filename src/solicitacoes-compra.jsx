/* ============================================================
   solicitacoes-compra.jsx — aba "Solicitações" de Pedidos (logistica/pedidos-acompanhamento).
   Vendedor: acompanha as suas solicitações (editar/cancelar enquanto nada foi alocado; reenviar quando devolvida).
   Comprador: vê todas, marca itens e ALOCA numa cotação (lote novo ou rascunho existente), devolve ao vendedor ou realoca.
   window.SolicitacoesCompraTab. Regras: SolicitacoesCompraCalc; gravação: SolicitacoesCompraStore (funções do banco).
   ============================================================ */

const SC_FILTROS = [
  { v: 'abertas', label: 'Em andamento' }, { v: 'todas', label: 'Todas' }, { v: 'enviada', label: 'Enviadas' }, { v: 'devolvida', label: 'Devolvidas' }, { v: 'alocada', label: 'Alocadas' },
];

function scFmtData(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }

/* ---------- Modal: alocar itens marcados numa cotação ---------- */
function SCModalAlocar({ itens, onClose, onFeito }) {
  const S = window.SolicitacoesCompraStore; const C = window.SolicitacoesCompraCalc;
  const [lotes, setLotes] = React.useState(null);
  const [modo, setModo] = React.useState('novo');
  const [loteId, setLoteId] = React.useState('');
  const [titulo, setTitulo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    S.lotesAbertos().then((l) => { if (vivo) setLotes(l); }).catch((e) => { if (vivo) { setLotes([]); window.toast?.('Não consegui listar os lotes abertos: ' + C.mensagemErro(e), 'error'); } });
    return () => { vivo = false; };
  }, []);
  const abertos = lotes || [];
  const soma = C.somarPorCodigo(itens);
  const confirmar = async () => {
    setGravando(true);
    try { onFeito(await S.alocar(itens.map((i) => i.id), modo === 'novo' ? null : loteId, titulo.trim() || null)); }
    catch (e) { window.toast?.('Erro ao alocar: ' + C.mensagemErro(e), 'error'); }
    finally { setGravando(false); }
  };
  return (
    <Modal title={'Alocar ' + itens.length + ' item(ns) em uma cotação'} onClose={onClose} width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={confirmar} disabled={gravando || lotes === null || (modo === 'existente' && !loteId)}>
          {gravando ? 'Alocando…' : (modo === 'novo' ? 'Criar cotação e alocar' : 'Alocar na cotação')}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small">Os itens entram no lote com a quantidade pedida (produto repetido soma). A solicitação mostra “Alocada em COTV-xxxx” para o vendedor. Depois você escolhe os fornecedores em Cotações de Varejo.</p>
        <div className="small muted">{Object.keys(soma).map((c) => c + ' × ' + soma[c]).join(' · ')}</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
          <input type="radio" name="sc-modo" checked={modo === 'novo'} onChange={() => setModo('novo')} /> Criar uma cotação (lote) nova
        </label>
        {modo === 'novo' && <input className="input" placeholder="Nome do lote (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} />}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
          <input type="radio" name="sc-modo" checked={modo === 'existente'} onChange={() => setModo('existente')} disabled={!abertos.length} />
          Usar uma cotação aberta {lotes === null ? '(carregando…)' : '(' + abertos.length + ')'}
        </label>
        {modo === 'existente' && (
          <div className="stack" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {abertos.map((l) => (
              <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: '6px 10px', background: loteId === l.id ? 'var(--bg2, #f6f6f6)' : undefined }}>
                <input type="radio" name="sc-lote" checked={loteId === l.id} onChange={() => setLoteId(l.id)} />
                <span><b>{l.numero}</b>{l.titulo ? ' · ' + l.titulo : ''}<br /><span className="small muted">criado por {l.criado_por_nome || '—'}</span></span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Modal: devolver ao vendedor ---------- */
function SCModalDevolver({ sol, onClose, onFeito }) {
  const S = window.SolicitacoesCompraStore; const C = window.SolicitacoesCompraCalc;
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const confirmar = async () => {
    setGravando(true);
    try { await S.devolver(sol.id, motivo); onFeito(); }
    catch (e) { window.toast?.('Erro ao devolver: ' + C.mensagemErro(e), 'error'); }
    finally { setGravando(false); }
  };
  return (
    <Modal title={'Devolver ' + sol.numero + ' ao vendedor'} onClose={onClose} width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={confirmar} disabled={gravando || motivo.trim().length < 5}>{gravando ? 'Devolvendo…' : 'Devolver'}</Button></>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small">O vendedor recebe um aviso, corrige e reenvia. Explique o que falta (quantidade, especificação, cliente…).</p>
        <textarea className="input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obrigatório)" maxLength={500} />
      </div>
    </Modal>
  );
}

/* ---------- Modal: vendedor edita/reenvia ---------- */
function SCModalEditar({ sol, onClose, onFeito }) {
  const S = window.SolicitacoesCompraStore; const C = window.SolicitacoesCompraCalc;
  const [linhas, setLinhas] = React.useState(() => sol.itens.map((i) => ({ codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, obs: i.obs || '' })));
  const [justificativa, setJustificativa] = React.useState(sol.justificativa || '');
  const [gravando, setGravando] = React.useState(false);
  const setCampo = (cod, campo, v) => setLinhas((ls) => ls.map((l) => (l.codigo === cod ? { ...l, [campo]: v } : l)));
  const remover = (cod) => setLinhas((ls) => ls.filter((l) => l.codigo !== cod));
  const confirmar = async () => {
    const pronto = linhas.map((l) => ({ ...l, quantidade: Number(l.quantidade) }));
    const v = C.validarEnvio(pronto);
    if (!v.ok) { window.toast?.(v.erros[0], 'error'); return; }
    setGravando(true);
    try { await S.editar(sol.id, pronto, { justificativa }); onFeito(); }
    catch (e) { window.toast?.('Erro ao salvar: ' + C.mensagemErro(e), 'error'); }
    finally { setGravando(false); }
  };
  return (
    <Modal title={(sol.status === 'devolvida' ? 'Corrigir e reenviar ' : 'Editar ') + sol.numero} onClose={onClose} width={680}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={confirmar} disabled={gravando}>{gravando ? 'Salvando…' : (sol.status === 'devolvida' ? 'Reenviar ao comprador' : 'Salvar')}</Button></>}>
      <div className="stack" style={{ gap: 10 }}>
        {sol.status === 'devolvida' && sol.devolucao_motivo && <div className="alert warning"><div><div className="alert__sub"><b>Motivo da devolução:</b> {sol.devolucao_motivo}</div></div></div>}
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Código</th><th>Descrição</th><th style={{ width: 110 }}>Quantidade</th><th>Observação</th><th /></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo}>
                  <td className="mono small">{l.codigo}</td><td className="small">{l.descricao || '—'}</td>
                  <td><input className="input" type="number" min="0" step="any" value={l.quantidade} onChange={(e) => setCampo(l.codigo, 'quantidade', e.target.value)} /></td>
                  <td><input className="input" value={l.obs} onChange={(e) => setCampo(l.codigo, 'obs', e.target.value)} maxLength={200} /></td>
                  <td><Button variant="ghost" size="sm" icon="trash" title="Tirar da solicitação" onClick={() => remover(l.codigo)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <textarea className="input" rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que precisa?" maxLength={1000} />
      </div>
    </Modal>
  );
}

/* ---------- Aba ---------- */
function SolicitacoesCompraTab({ setRoute }) {
  const S = window.SolicitacoesCompraStore; const C = window.SolicitacoesCompraCalc;
  const [sols, setSols] = React.useState(null);
  const [erro, setErro] = React.useState('');
  const [tratar, setTratar] = React.useState(false);
  const [filtro, setFiltro] = React.useState('abertas');
  const [busca, setBusca] = React.useState('');
  const [abertas, setAbertas] = React.useState(() => new Set());
  const [marcados, setMarcados] = React.useState(() => new Set());
  const [modalAlocar, setModalAlocar] = React.useState(false);
  const [devolver, setDevolver] = React.useState(null);
  const [editar, setEditar] = React.useState(null);
  const email = S.emailAtual();

  const carregar = React.useCallback(() => {
    S.listar().then((l) => { setSols(l); setErro(''); }).catch((e) => { setSols([]); setErro('Não consegui carregar as solicitações: ' + C.mensagemErro(e)); });
  }, []);
  React.useEffect(() => { carregar(); S.podeTratar().then(setTratar); }, [carregar]);
  /* Atualiza sozinha: o vendedor vê a alocação/devolução sem recarregar. */
  React.useEffect(() => {
    const t = setInterval(carregar, 60000);
    const v = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [carregar]);

  if (sols === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const q = busca.trim().toLowerCase();
  const visiveis = sols.filter((s) => {
    if (filtro === 'abertas' && !['enviada', 'em_analise', 'devolvida'].includes(s.status)) return false;
    if (filtro !== 'abertas' && filtro !== 'todas' && s.status !== filtro) return false;
    if (!q) return true;
    return [s.numero, s.solicitante_nome, s.vendedor_nome, s.pedido_venda_numero, s.cotacao_numero, s.justificativa].some((x) => String(x || '').toLowerCase().includes(q))
      || s.itens.some((i) => String(i.codigo).toLowerCase().includes(q) || String(i.descricao || '').toLowerCase().includes(q));
  });
  const itensMarcados = [];
  sols.forEach((s) => s.itens.forEach((i) => { if (marcados.has(i.id) && C.itemAlocavel(s, i)) itensMarcados.push(i); }));

  const toggle = (set, setSet, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setSet(n); };
  const marcarSolicitacao = (s) => {
    const ids = s.itens.filter((i) => C.itemAlocavel(s, i) && !i.lote_id).map((i) => i.id);
    const todos = ids.length > 0 && ids.every((id) => marcados.has(id));
    const n = new Set(marcados); ids.forEach((id) => (todos ? n.delete(id) : n.add(id))); setMarcados(n);
  };
  const cancelar = async (s) => {
    if (!window.confirm('Cancelar a solicitação ' + s.numero + '?')) return;
    try { await S.cancelar(s.id); window.toast?.('Solicitação cancelada.', 'success'); carregar(); }
    catch (e) { window.toast?.('Erro: ' + C.mensagemErro(e), 'error'); }
  };
  const irParaLote = (lote) => { window.VpRouter.navigate('cotacoes-varejo', lote.id); setRoute && setRoute('cotacoes-varejo'); };
  const alocado = (r) => {
    setModalAlocar(false); setMarcados(new Set());
    window.toast?.((r.novo ? 'Cotação ' + r.numero + ' criada. ' : 'Itens alocados em ' + r.numero + '. ') + r.adicionados + ' novo(s)' + (r.somados ? ', ' + r.somados + ' somado(s) a produto já existente' : '') + '.', 'success');
    carregar();
  };

  return (
    <div>
      {erro && <div className="alert danger" style={{ marginBottom: 12 }}><div><div className="alert__sub">{erro}</div></div></div>}
      <div className="row gap-2" style={{ margin: '14px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ flex: 1, minWidth: 240 }} placeholder="Buscar por nº, vendedor, produto, pedido de venda ou cotação…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input" style={{ width: 180 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>{SC_FILTROS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
        {tratar && itensMarcados.length > 0 && <Button variant="primary" onClick={() => setModalAlocar(true)}>{'Alocar em cotação (' + itensMarcados.length + ')'}</Button>}
      </div>
      {!tratar && sols.length > 0 && <p className="small muted" style={{ marginBottom: 10 }}>Você vê as solicitações que enviou. O comprador as aloca numa cotação e o andamento aparece aqui.</p>}

      {visiveis.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>{sols.length === 0 ? 'Nenhuma solicitação ainda. Em Importação Varejo, marque os produtos e clique em “Enviar solicitação”.' : 'Nenhuma solicitação neste filtro.'}</div>}

      <div className="stack" style={{ gap: 10 }}>
        {visiveis.map((s) => {
          const aberta = abertas.has(s.id); const r = C.resumo(s, s.itens);
          return (
            <Card key={s.id}>
              <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {tratar && <input type="checkbox" title="Marcar os itens ainda não alocados" onChange={() => marcarSolicitacao(s)} checked={s.itens.some((i) => !i.lote_id && C.itemAlocavel(s, i)) && s.itens.filter((i) => !i.lote_id && C.itemAlocavel(s, i)).every((i) => marcados.has(i.id))} />}
                <button className="link-btn" onClick={() => toggle(abertas, setAbertas, s.id)} style={{ fontWeight: 800 }}>{aberta ? '▾' : '▸'} {s.numero}</button>
                <span className={'badge badge--' + C.tomStatus(s.status)}>{C.rotuloStatus(s.status)}</span>
                <span className="small"><b>{s.vendedor_nome || s.solicitante_nome || s.solicitante_email}</b> · {scFmtData(s.created_at)}</span>
                {s.urgencia && s.urgencia !== 'normal' && <span className="small" style={{ fontWeight: 800, color: s.urgencia === 'urgente' ? 'var(--vp-danger, #c00)' : undefined }}>⚑ {s.urgencia}</span>}
                {s.cotacao_numero && <span className="small muted">cotação {s.cotacao_numero}</span>}
                {s.pedido_venda_numero && <span className="small muted">pedido de venda {s.pedido_venda_numero}</span>}
                <span className="small muted">{r.total} produto(s){r.alocados ? ' · ' + r.alocados + ' alocado(s)' : ''}</span>
                <div className="spacer" style={{ flex: 1 }} />
                {C.podeEditar(s, s.itens, email) && <Button variant="outline" size="sm" icon="edit" onClick={() => setEditar(s)}>{s.status === 'devolvida' ? 'Corrigir e reenviar' : 'Editar'}</Button>}
                {C.podeEditar(s, s.itens, email) && <Button variant="ghost" size="sm" icon="trash" title="Cancelar solicitação" onClick={() => cancelar(s)} />}
                {tratar && ['enviada', 'em_analise'].includes(s.status) && r.alocados === 0 && <Button variant="outline" size="sm" onClick={() => setDevolver(s)}>Devolver ao vendedor</Button>}
              </div>
              {s.status === 'devolvida' && s.devolucao_motivo && <div className="alert warning" style={{ marginTop: 8 }}><div><div className="alert__sub"><b>Devolvida:</b> {s.devolucao_motivo}</div></div></div>}
              {s.justificativa && <p className="small" style={{ margin: '8px 0 0' }}>{s.justificativa}</p>}
              {aberta && (
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="t">
                    <thead><tr>{tratar && <th style={{ width: 28 }} />}<th>Código</th><th>Descrição</th><th className="text-right">Qtd.</th><th>Observação</th><th>Cotação</th></tr></thead>
                    <tbody>
                      {s.itens.map((i) => (
                        <tr key={i.id}>
                          {tratar && <td><input type="checkbox" disabled={!C.itemAlocavel(s, i)} checked={marcados.has(i.id)} onChange={() => toggle(marcados, setMarcados, i.id)} /></td>}
                          <td className="mono small">{i.codigo}</td><td className="small">{i.descricao || '—'}</td>
                          <td className="text-right cell-num">{i.quantidade}{i.unidade ? ' ' + i.unidade : ''}</td>
                          <td className="small">{i.obs || '—'}</td>
                          <td>{i.lote ? <button className="link-btn" style={{ fontWeight: 800 }} onClick={() => irParaLote(i.lote)}>🧾 {i.lote.numero}{tratar && i.lote.status === 'rascunho' ? ' (realocável)' : ''}</button> : <span className="small muted">aguardando comprador</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {modalAlocar && <SCModalAlocar itens={itensMarcados} onClose={() => setModalAlocar(false)} onFeito={alocado} />}
      {devolver && <SCModalDevolver sol={devolver} onClose={() => setDevolver(null)} onFeito={() => { setDevolver(null); window.toast?.('Solicitação devolvida ao vendedor.', 'success'); carregar(); }} />}
      {editar && <SCModalEditar sol={editar} onClose={() => setEditar(null)} onFeito={() => { setEditar(null); window.toast?.('Solicitação atualizada.', 'success'); carregar(); }} />}
    </div>
  );
}

window.SolicitacoesCompraTab = SolicitacoesCompraTab;
