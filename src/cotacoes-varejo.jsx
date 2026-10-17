/* ============================================================
   cotacoes-varejo.jsx — Suprimentos & Importação › Cotações de Varejo
   Lista de lotes + MAPA COMPARATIVO (produto × fornecedor). Pedido do usuário (16/10/2026): o comprador marca produtos na
   Importação Varejo e clica em "Pedir cotação"; aqui os fornecedores respondem (preço por faixa de quantidade, prazo, MOQ),
   o comprador escolhe vencedor(es) e QUANTIDADE por item (pode comprar mais ou menos que o pedido, e dividir entre
   fornecedores) e só ao APROVAR a Requisição de Compra vai ao Omie, uma por fornecedor vencedor.
   URL: /logistica/cotacoes-varejo[/<id do lote>]. window.CotacoesVarejoPage
   ============================================================ */

function cvNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function cvFmtNum(v) { return cvNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
function cvFmtMoeda(v, moeda) {
  const m = moeda === 'BRL' ? 'R$' : (moeda === 'EUR' ? '€' : 'US$');
  return m + ' ' + cvNum(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function cvFmtData(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

const CV_STATUS_LOTE = {
  rascunho: { label: 'Rascunho', variant: 'neutral' },
  em_cotacao: { label: 'Em cotação', variant: 'warning' },
  aprovado: { label: 'Aprovado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'danger' },
};
const CV_STATUS_CONVITE = {
  rascunho: { label: 'não enviado', variant: 'neutral' },
  enviado: { label: 'aguardando', variant: 'warning' },
  visualizado: { label: 'abriu o link', variant: 'info' },
  respondido: { label: 'respondeu', variant: 'success' },
};

/* ---------- Lista de lotes ---------- */
function CVLista({ onAbrir, setRoute }) {
  const [lotes, setLotes] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const carregar = React.useCallback(() => {
    setErro(null);
    window.CotacoesVarejoStore.listarLotes().then(setLotes).catch((e) => { setErro(e.message || String(e)); setLotes([]); });
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Suprimentos · Cotações de Varejo</div>
          <h1 className="page-head__title">Cotações de Varejo</h1>
          <p className="page-head__sub">Produtos que o comprador mandou cotar na Importação Varejo. Cada lote reúne vários fornecedores no mesmo mapa comparativo; só depois da aprovação a compra vai ao Omie.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="truck" onClick={() => setRoute && setRoute('compras')}>Ir para Importação Varejo</Button>
          <Button variant="outline" icon="refresh" onClick={carregar}>Atualizar</Button>
        </div>
      </div>
      {erro && <div className="alert danger" style={{ marginBottom: 16 }}><Icon.warning /><div><div className="alert__title">Erro ao consultar</div><div className="alert__sub">{erro}</div></div></div>}
      {lotes === null ? <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando lotes…</div> : (
        <Card>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Lote</th><th>Descrição</th><th>Status</th><th className="text-right">Itens</th><th className="text-right">Fornecedores</th><th className="text-right">Responderam</th><th>Criado por</th><th>Criado em</th></tr></thead>
              <tbody>
                {lotes.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum lote ainda. Na Importação Varejo, marque os produtos e clique em "Pedir cotação".</td></tr>}
                {lotes.map((l) => {
                  const st = CV_STATUS_LOTE[l.status] || CV_STATUS_LOTE.rascunho;
                  return (
                    <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => onAbrir(l.id)}>
                      <td className="mono"><b>{l.numero}</b></td>
                      <td>{l.titulo || '—'}</td>
                      <td><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="text-right">{l.qtdItens}</td>
                      <td className="text-right">{l.qtdFornecedores}</td>
                      <td className="text-right">{l.qtdRespondidos}/{l.qtdFornecedores}</td>
                      <td>{l.criado_por_nome || l.criado_por || '—'}</td>
                      <td>{cvFmtData(l.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Célula do fornecedor no mapa ---------- */
function CVCelula({ resp, qtdRef, melhor, editavel, valorQtd, onQtd, onTudo }) {
  const C = window.CotacoesVarejoCalc;
  const faixas = resp ? C.faixasOrdenadas(resp.faixas) : [];
  const aplicada = resp ? C.precoNaQuantidade(resp.faixas, qtdRef) : null;
  const moq = resp && resp.moq ? cvNum(resp.moq) : 0;
  const qtd = cvNum(valorQtd);
  const abaixoMoq = moq > 0 && qtd > 0 && qtd < moq;
  return (
    <div style={{ minWidth: 170, padding: '4px 2px', background: melhor ? 'rgba(34,160,90,.10)' : undefined, borderRadius: 6 }}>
      {!resp || !faixas.length ? <div className="small muted">sem preço</div> : (
        <div className="small" style={{ lineHeight: 1.45 }}>
          {faixas.map((f) => (
            <div key={f.min} style={{ fontWeight: aplicada && aplicada.min === f.min ? 800 : 400 }}>
              {cvFmtMoeda(f.preco, resp._moeda)} <span className="muted">{f.min > 1 ? '≥ ' + cvFmtNum(f.min) : 'un.'}</span>
            </div>
          ))}
          <div className="muted">{resp.lead_time_dias ? resp.lead_time_dias + ' d' : '— d'}{moq > 0 ? ' · MOQ ' + cvFmtNum(moq) : ''}</div>
          {resp.obs && <div className="muted" title={resp.obs} style={{ maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>💬 {resp.obs}</div>}
          {resp.historico && resp.historico.length > 0 && (
            <div className="muted" title={resp.historico.map((h) => 'Rodada ' + h.rodada + ': ' + (h.faixas || []).map((f) => cvFmtMoeda(f.preco, resp._moeda) + (f.min > 1 ? ' (≥' + f.min + ')' : '')).join(' · ')).join('\n')}>
              rodada {resp.rodada} · antes: {cvFmtMoeda(((resp.historico[resp.historico.length - 1].faixas || [])[0] || {}).preco, resp._moeda)}
            </div>
          )}
          {aplicada && aplicada.abaixoMin && <div style={{ color: 'var(--vp-amber-700, #b45309)' }}>⚠ vende a partir de {cvFmtNum(aplicada.min)}</div>}
        </div>
      )}
      {editavel && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
          <input className="input text-right" style={{ width: 82 }} type="number" min="0" step="any" placeholder="qtd" value={valorQtd ?? ''} onChange={(e) => onQtd(e.target.value)} />
          <button className="link-btn" title="Comprar a quantidade pedida deste fornecedor" onClick={onTudo}>★</button>
        </div>
      )}
      {abaixoMoq && <div className="small" style={{ color: 'var(--vp-amber-700, #b45309)' }}>⚠ abaixo do MOQ ({cvFmtNum(moq)})</div>}
    </div>
  );
}

/* ---------- Modal: aprovar e enviar ao Omie ---------- */
function CVModalAprovar({ resumo, cambio, onClose, onConfirmar, enviando }) {
  const nomes = Object.keys(resumo.porConvite);
  return (
    <Modal title="Aprovar o lote e enviar ao Omie" onClose={onClose} width={720}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={enviando}>Voltar</Button>
        <Button variant="primary" icon="send" onClick={onConfirmar} disabled={enviando}>{enviando ? 'Enviando…' : 'Confirmar — é o martelo'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small">Será criada <b>1 Requisição de Compra no Omie por fornecedor vencedor</b> (categoria "Compras de Mercadorias para Revenda Importada"), com a quantidade e o preço decididos abaixo. Preços em dólar são convertidos pelo câmbio do lote (R$ {cvFmtNum(cambio)}). Depois de aprovado o lote não muda mais.</p>
        {nomes.map((cid) => {
          const g = resumo.porConvite[cid];
          return (
            <div key={cid}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{g.nome} <span className="muted small">— {cvFmtMoeda(g.totalOriginal, g.moeda)}{g.totalBRL != null ? ' ≈ ' + cvFmtMoeda(g.totalBRL, 'BRL') : ''}</span></div>
              <div className="table-wrap"><table className="t">
                <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd.</th><th className="text-right">Preço</th></tr></thead>
                <tbody>{g.itens.map((i) => <tr key={i.item_id}><td className="mono">{i.codigo}</td><td>{i.descricao}</td><td className="text-right">{cvFmtNum(i.quantidade)}</td><td className="text-right">{cvFmtMoeda(i.preco, g.moeda)}</td></tr>)}</tbody>
              </table></div>
            </div>
          );
        })}
        <p className="small" style={{ textAlign: 'right', fontWeight: 800 }}>Total do lote: {resumo.totalBRL != null ? cvFmtMoeda(resumo.totalBRL, 'BRL') : 'informe o câmbio'}</p>
      </div>
    </Modal>
  );
}

/* ---------- Detalhe do lote: mapa comparativo ---------- */
function CVDetalhe({ loteId, onVoltar, setRoute }) {
  const C = window.CotacoesVarejoCalc; const S = window.CotacoesVarejoStore;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [qtd, setQtd] = React.useState({});            // 'item|convite' -> texto
  const [cambio, setCambio] = React.useState('');
  const [forn, setForn] = React.useState([]);
  const [novoForn, setNovoForn] = React.useState('');
  const [podeGerenciar, setPodeGerenciar] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [aprovando, setAprovando] = React.useState(false);
  const [modalAprovar, setModalAprovar] = React.useState(false);
  const [sujo, setSujo] = React.useState(false);
  const fotosTentadas = React.useRef(false);

  React.useEffect(() => { window.PropostaStore?.temCapacidade?.('cotacoes-varejo', 'criar').then(setPodeGerenciar).catch(() => setPodeGerenciar(false)); }, []);
  React.useEffect(() => { S.fornecedoresCadastrados().then(setForn).catch(() => setForn([])); }, []);

  const carregar = React.useCallback(async () => {
    try {
      const d = await S.obterLote(loteId);
      if (!d) { setErro('Lote não encontrado.'); return; }
      setDados(d);
      const m = {}; d.decisoes.forEach((x) => { m[x.item_id + '|' + x.convite_id] = String(x.quantidade); });
      setQtd(m); setSujo(false);
      setCambio((c) => c || (d.lote.cambio_usd_brl ? String(d.lote.cambio_usd_brl) : ''));
      return d;
    } catch (e) { setErro(e.message || String(e)); }
  }, [loteId]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // Câmbio sugerido (USD/BRL do dia) quando o lote ainda não tem um.
  React.useEffect(() => {
    if (!dados || dados.lote.cambio_usd_brl || !window.CambioAPI) return;
    window.CambioAPI.buscarUsdBrl().then((r) => setCambio((c) => c || String(Number(r.valor).toFixed(4)))).catch(() => {});
  }, [dados && dados.lote.id]);

  // Fotos: procura no banco / traz da Ficha Técnica uma vez por abertura.
  React.useEffect(() => {
    if (!dados || fotosTentadas.current) return;
    if (dados.itens.some((i) => !i.foto_url || !i.foto_url2)) { fotosTentadas.current = true; S.resolverFotos(dados.lote.id, dados.itens).then(() => carregar()).catch(() => {}); }
  }, [dados && dados.lote.id]);

  if (erro) return <div className="page fade-in"><div className="alert danger"><Icon.warning /><div><div className="alert__title">Erro</div><div className="alert__sub">{erro}</div></div></div><Button variant="outline" onClick={onVoltar}>← Voltar</Button></div>;
  if (!dados) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando lote…</div>;

  const { lote, itens, convites, respostasMap } = dados;
  const aberto = lote.status === 'rascunho' || lote.status === 'em_cotacao';
  const editavel = podeGerenciar && aberto;
  const st = CV_STATUS_LOTE[lote.status] || CV_STATUS_LOTE.rascunho;
  const respDe = (cid, iid) => { const r = respostasMap[cid + '|' + iid]; const cv = convites.find((x) => x.id === cid); return r ? { ...r, _moeda: cv && cv.moeda } : null; };

  const decisoesAtuais = [];
  Object.keys(qtd).forEach((k) => { const [item_id, convite_id] = k.split('|'); if (cvNum(qtd[k]) > 0) decisoesAtuais.push({ item_id, convite_id, quantidade: cvNum(qtd[k]) }); });
  const cambioNum = cvNum(String(cambio).replace(',', '.'));
  const calc = C.consolidarPorFornecedor(itens, decisoesAtuais, respostasMap, convites, cambioNum);
  const resumoModal = { totalBRL: calc.totalBRL, porConvite: {} };
  Object.keys(calc.porConvite).forEach((cid) => { const cv = convites.find((x) => x.id === cid); resumoModal.porConvite[cid] = { ...calc.porConvite[cid], nome: cv.fornecedor_nome, moeda: cv.moeda }; });

  const setQ = (iid, cid, v) => { setQtd((p) => ({ ...p, [iid + '|' + cid]: v })); setSujo(true); };
  const salvar = async (silencioso) => {
    setSalvando(true);
    try {
      await S.salvarDecisoes(lote.id, decisoesAtuais);
      if (cambioNum > 0 && cambioNum !== Number(lote.cambio_usd_brl || 0)) await S.atualizarLote(lote.id, { cambio_usd_brl: cambioNum });
      if (!silencioso) window.toast?.('Decisões salvas.', 'success');
      await carregar();
    } catch (e) { window.toast?.('Erro ao salvar: ' + (e.message || e), 'error'); throw e; }
    finally { setSalvando(false); }
  };

  const convidar = async () => {
    const f = forn.find((x) => x.id === novoForn); if (!f) return;
    try { await S.convidarFornecedor(lote.id, f); setNovoForn(''); await carregar(); } catch (e) { window.toast?.(e.message || String(e), 'error'); }
  };
  const enviarEmail = async (cv) => {
    try {
      const r = await S.enviarPorEmail(lote, cv);
      if (r.semEmail) { window.toast?.('Este fornecedor não tem e-mail no cadastro. Use "Link" ou "WhatsApp", ou complete o cadastro.', 'warning'); return; }
      if (r.enviouDireto) window.toast?.('E-mail enviado para ' + cv.email + '.', 'success');
      else { window.toast?.('Não consegui enviar direto — abrindo seu programa de e-mail.', 'warning'); window.open(r.mailto, '_blank'); }
      await carregar();
    } catch (e) { window.toast?.('Erro ao enviar: ' + (e.message || e), 'error'); }
  };
  const copiarLink = async (cv) => {
    const link = S.portalUrl(cv.token);
    try { await navigator.clipboard.writeText(link); window.toast?.('Link copiado.', 'success'); } catch (e) { window.prompt('Copie o link:', link); }
    try { await S.marcarEnviado({ ...cv, lote_id: lote.id }, 'link'); await carregar(); } catch (e) {}
  };
  const zap = async (cv) => {
    const f = forn.find((x) => x.id === cv.fornecedor_id); const tel = f && f.telefone;
    if (!tel) { window.toast?.('Sem telefone no cadastro deste fornecedor.', 'warning'); return; }
    window.open(S.whatsAppHref(tel, lote, cv), '_blank');
    try { await S.marcarEnviado({ ...cv, lote_id: lote.id }, 'whatsapp', tel); await carregar(); } catch (e) {}
  };
  const rodada = async (cv) => { try { await S.novaRodada(cv); window.toast?.('Nova rodada aberta — reenvie o link ao fornecedor.', 'success'); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };
  const tirar = async (cv) => { if (!window.confirm('Remover ' + cv.fornecedor_nome + ' deste lote? As respostas dele também saem.')) return; try { await S.removerConvite(cv.id); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };
  const trocarFoto = async (item, file) => {
    if (!file) return;
    try { const url = await S.enviarFoto(item.codigo, file); await S.atualizarItem(item.id, { foto_url: url }); await carregar(); window.toast?.('Foto salva no banco de fotos (' + item.codigo + ').', 'success'); }
    catch (e) { window.toast?.('Erro ao salvar a foto: ' + (e.message || e), 'error'); }
  };
  const editarItem = async (item, campo, valor) => { try { await S.atualizarItem(item.id, { [campo]: valor }); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };
  const tirarItem = async (item) => { if (!window.confirm('Tirar ' + item.codigo + ' deste lote?')) return; try { await S.removerItem(item.id); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };

  const aprovar = async () => {
    setAprovando(true);
    try {
      await salvar(true);
      const d = await S.obterLote(lote.id);
      const res = await S.aprovarLote(d);
      if (res.erros.length) window.toast?.('Atenção: ' + res.erros.join(' | ') + ' — corrija e aprove de novo; o que já foi enviado não se repete.', 'warning');
      else window.toast?.('Lote aprovado. Requisições criadas no Omie: ' + res.requisicoes.map((r) => r.req_omie).join(', '), 'success');
      setModalAprovar(false); await carregar();
    } catch (e) { window.toast?.('Erro ao aprovar: ' + (e.message || e), 'error'); }
    finally { setAprovando(false); }
  };

  const fornecedoresLivres = forn.filter((f) => !convites.some((c) => c.fornecedor_id === f.id));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Suprimentos · Cotações de Varejo</div>
          <h1 className="page-head__title">{lote.numero} <Badge variant={st.variant}>{st.label}</Badge></h1>
          <p className="page-head__sub">{lote.titulo ? lote.titulo + ' · ' : ''}Criado por {lote.criado_por_nome || lote.criado_por || '—'} em {cvFmtData(lote.created_at)}. Em cada célula digite a quantidade que vai comprar daquele fornecedor (pode dividir, e pode ser mais ou menos que o pedido).</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" onClick={onVoltar}>← Lotes</Button>
          {editavel && sujo && <Button variant="outline" icon="check" onClick={() => salvar(false)} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar decisões'}</Button>}
          {editavel && <Button variant="primary" icon="send" onClick={() => setModalAprovar(true)} disabled={!decisoesAtuais.length}>Aprovar e enviar ao Omie</Button>}
          {editavel && <Button variant="ghost" onClick={async () => { if (window.confirm('Cancelar este lote de cotação?')) { await S.cancelarLote(lote.id); onVoltar(); } }}>Cancelar lote</Button>}
        </div>
      </div>

      {lote.status === 'aprovado' && (
        <div className="alert success" style={{ marginBottom: 16 }}><Icon.check /><div><div className="alert__title">Lote aprovado em {cvFmtData(lote.aprovado_em)}</div>
          <div className="alert__sub">{(lote.requisicoes || []).map((r) => r.fornecedor + ' → requisição ' + r.req_omie + ' (' + r.itens + ' itens)').join(' · ') || '—'}</div></div></div>
      )}

      <Card title="Fornecedores convidados" sub="Só fornecedores já cadastrados em Cadastros › Fornecedores. Cada um recebe um link próprio e nunca vê os preços dos outros.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {convites.length === 0 && <span className="small muted">Nenhum fornecedor convidado ainda.</span>}
          {convites.map((cv) => {
            const s = CV_STATUS_CONVITE[cv.status] || CV_STATUS_CONVITE.rascunho;
            return (
              <div key={cv.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: '8px 10px', minWidth: 230 }}>
                <div style={{ fontWeight: 800 }}>{cv.fornecedor_nome} <Badge variant={s.variant}>{s.label}</Badge></div>
                <div className="small muted">{cv.moeda} · rodada {cv.rodada}{cv.respondido_em ? ' · respondeu ' + cvFmtData(cv.respondido_em) : ''}</div>
                {editavel && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <button className="link-btn" onClick={() => enviarEmail(cv)}>E-mail</button>
                    <button className="link-btn" onClick={() => zap(cv)}>WhatsApp</button>
                    <button className="link-btn" onClick={() => copiarLink(cv)}>Link</button>
                    {cv.status === 'respondido' && <button className="link-btn" onClick={() => rodada(cv)} title="Pede ao fornecedor que atualize os preços (2ª rodada de negociação)">Nova rodada</button>}
                    <button className="link-btn muted" onClick={() => tirar(cv)}>remover</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {editavel && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <select className="input" style={{ minWidth: 260 }} value={novoForn} onChange={(e) => setNovoForn(e.target.value)}>
              <option value="">Convidar fornecedor cadastrado…</option>
              {fornecedoresLivres.map((f) => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}{f.email ? '' : ' (sem e-mail)'}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={convidar} disabled={!novoForn}>Convidar</Button>
            <button className="link-btn" onClick={() => setRoute && setRoute('cadastro-fornecedores')} title="Fornecedor novo precisa existir no cadastro antes de entrar no lote">+ Cadastrar novo fornecedor</button>
            <div className="spacer" style={{ flex: 1 }} />
            <label className="small">Câmbio USD/BRL do lote&nbsp;
              <input className="input text-right" style={{ width: 90 }} value={cambio} onChange={(e) => { setCambio(e.target.value); setSujo(true); }} />
            </label>
          </div>
        )}
      </Card>

      <div style={{ height: 12 }} />
      <Card title="Mapa comparativo" sub={convites.length ? 'Verde = menor preço para a quantidade em questão. ★ = comprar a quantidade pedida deste fornecedor.' : 'Convide fornecedores acima para montar o comparativo.'}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Foto</th><th>Código</th><th>Descrição</th><th className="text-right">Qtd. pedida</th>
                {convites.map((cv) => <th key={cv.id}>{cv.fornecedor_nome}<div className="small muted" style={{ fontWeight: 400 }}>{cv.moeda}</div></th>)}
                <th className="text-right">Comprar</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const decs = decisoesAtuais.filter((d) => d.item_id === it.id);
                const comprada = decs.reduce((a, d) => a + d.quantidade, 0);
                const qtdRef = comprada > 0 ? comprada : cvNum(it.quantidade_pedida);
                const respostasItem = {}; convites.forEach((cv) => { respostasItem[cv.id] = respDe(cv.id, it.id); });
                const melhor = C.melhorConvite(respostasItem, qtdRef);
                const dif = comprada - cvNum(it.quantidade_pedida);
                return (
                  <tr key={it.id}>
                    <td>
                      <label style={{ cursor: editavel ? 'pointer' : 'default' }} title={editavel ? 'Trocar a foto (fica no banco de fotos, nomeada pelo código)' : ''}>
                        {it.foto_url ? <span style={{ display: 'inline-flex', gap: 4 }}><img src={it.foto_url} alt={it.codigo} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />{it.foto_url2 && <img src={it.foto_url2} alt={it.codigo + ' (2)'} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />}</span> :<div style={{ width: 52, height: 52, border: '1px dashed var(--border, #ccc)', borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--fg3)' }}>sem foto</div>}
                        {editavel && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => trocarFoto(it, e.target.files && e.target.files[0])} />}
                      </label>
                    </td>
                    <td className="mono">{it.codigo}</td>
                    <td style={{ maxWidth: 260 }}>
                      {it.descricao}
                      {editavel
                        ? <input className="input" style={{ width: '100%', marginTop: 4, fontSize: 12 }} placeholder="Obs. VerticalParts (aparece para o fornecedor)" defaultValue={it.obs_vp || ''} onBlur={(e) => { if ((e.target.value || '') !== (it.obs_vp || '')) editarItem(it, 'obs_vp', e.target.value || null); }} />
                        : (it.obs_vp ? <div className="small muted">{it.obs_vp}</div> : null)}
                    </td>
                    <td className="text-right">
                      {editavel
                        ? <input className="input text-right" style={{ width: 80 }} type="number" min="1" step="any" defaultValue={it.quantidade_pedida} onBlur={(e) => { const v = cvNum(e.target.value); if (v > 0 && v !== cvNum(it.quantidade_pedida)) editarItem(it, 'quantidade_pedida', v); }} />
                        : cvFmtNum(it.quantidade_pedida)}
                      {editavel && <div><button className="link-btn muted" onClick={() => tirarItem(it)}>tirar</button></div>}
                    </td>
                    {convites.map((cv) => (
                      <td key={cv.id}>
                        <CVCelula resp={respDe(cv.id, it.id)} qtdRef={qtdRef} melhor={melhor === cv.id} editavel={editavel}
                          valorQtd={qtd[it.id + '|' + cv.id]} onQtd={(v) => setQ(it.id, cv.id, v)} onTudo={() => setQ(it.id, cv.id, String(it.quantidade_pedida))} />
                      </td>
                    ))}
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <b>{cvFmtNum(comprada)}</b>
                      {comprada > 0 && dif !== 0 && <div className="small" style={{ color: dif > 0 ? 'var(--vp-success, #15803d)' : 'var(--vp-amber-700, #b45309)' }}>{dif > 0 ? '+' : ''}{cvFmtNum(dif)} vs pedido</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {convites.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight: 800 }}>Total por fornecedor</td>
                  {convites.map((cv) => { const g = calc.porConvite[cv.id]; return <td key={cv.id}>{g ? <><b>{cvFmtMoeda(g.totalOriginal, cv.moeda)}</b>{g.totalBRL != null && cv.moeda !== 'BRL' && <div className="small muted">≈ {cvFmtMoeda(g.totalBRL, 'BRL')}</div>}</> : <span className="muted">—</span>}</td>; })}
                  <td className="text-right"><b>{calc.totalBRL != null ? cvFmtMoeda(calc.totalBRL, 'BRL') : (cambioNum > 0 ? '—' : 'informe o câmbio')}</b></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {modalAprovar && <CVModalAprovar resumo={resumoModal} cambio={cambioNum} enviando={aprovando} onClose={() => setModalAprovar(false)} onConfirmar={aprovar} />}
    </div>
  );
}

function CotacoesVarejoPage({ setRoute }) {
  const [loteId, setLoteId] = window.useRotaId('cotacoes-varejo');
  if (loteId) return <CVDetalhe key={loteId} loteId={loteId} onVoltar={() => setLoteId(null)} setRoute={setRoute} />;
  return <CVLista onAbrir={(id) => setLoteId(id)} setRoute={setRoute} />;
}

Object.assign(window, { CotacoesVarejoPage });
