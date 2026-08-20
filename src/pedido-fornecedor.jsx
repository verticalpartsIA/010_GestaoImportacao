/* ============================================================
   pedido-fornecedor.jsx — UI do "Pedido a Fornecedor" (RFQ)
   - PedidoBuilderModal: wizard (fornecedor, idioma, qtd, intro)
   - PedidoPreviewOverlay + PedidoDoc: documento A4 bilíngue PT|EN
   - PedidoSendModal: WhatsApp / E-mail / Link
   - PedidosList: histórico (aba Pedidos do Catálogo)
   Depende de window.PFEngine, window.PFStore, primitives, toast.
   ============================================================ */
const { useState: _pfUS, useRef: _pfUR, useEffect: _pfUE } = React;

/* idioma helper: rótulo bilíngue "PT / EN" conforme idioma do doc */
function pfLbl(o, idioma) {
  if (!o) return '';
  if (idioma === 'pt') return o.pt;
  if (idioma === 'en') return o.en;
  return o.pt + ' / ' + o.en;
}

/* ---------- PDF (html2canvas + jsPDF, multipágina A4) ---------- */
async function pfSalvarPDF(el, filename) {
  if (!window.html2canvas || !window.jspdf) { window.toast('Bibliotecas de PDF ainda carregando…', 'warning'); return; }
  const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pw = 210, ph = 297;
  const imgW = pw, imgH = canvas.height * pw / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.92);
  let heightLeft = imgH, position = 0;
  pdf.addImage(img, 'JPEG', 0, position, imgW, imgH);
  heightLeft -= ph;
  while (heightLeft > 0) { position -= ph; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, position, imgW, imgH); heightLeft -= ph; }
  pdf.save(filename);
}

/* ============================================================
   DOCUMENTO A4 (render) — bilíngue lado a lado
   ============================================================ */
function PedidoDoc({ doc }) {
  const L = doc.labels, idi = doc.idioma;
  const both = idi === 'bilingue';
  const forn = doc.fornecedor || {};

  const Field = ({ label, pt, en }) => (
    <div className="pf-field">
      <div className="pf-field-lbl">{pfLbl(label, idi)}</div>
      <div className={'pf-field-vals' + (both ? ' two' : '')}>
        {idi !== 'en' && <div className="pf-val">{pt || '—'}</div>}
        {idi !== 'pt' && <div className="pf-val pf-val-en">{en || pt || '—'}</div>}
      </div>
    </div>
  );

  return (
    <div className="pf-doc">
      {/* Cabeçalho */}
      <div className="pf-doc-head">
        <div>
          <div className="pf-doc-title">{pfLbl(L.titulo, idi)}</div>
          <div className="pf-doc-num">{pfLbl(L.numero, idi)} {doc.numero} · {doc.data.pt}{both ? ' / ' + doc.data.en : ''}</div>
        </div>
        <div className="pf-doc-logo">VERTICAL<b>PARTS</b></div>
      </div>

      {/* Comprador x Fornecedor */}
      <div className="pf-parties">
        <div className="pf-party">
          <div className="pf-party-lbl">{pfLbl(L.comprador, idi)}</div>
          <b>{doc.comprador.razao_social}</b>
          <div>CNPJ {doc.comprador.cnpj}</div>
          <div>{doc.comprador.endereco}</div>
          <div>{doc.comprador.email}</div>
        </div>
        <div className="pf-party">
          <div className="pf-party-lbl">{pfLbl(L.fornecedor, idi)} · {pfLbl(forn.tipo === 'nacional' ? L.nacional : L.importacao, idi)}</div>
          <b>{forn.nome || '—'}</b>
          {forn.pais && <div>{forn.pais}</div>}
          {forn.tin && <div>TIN {forn.tin}</div>}
          {forn.email && <div>{forn.email}</div>}
        </div>
      </div>

      {/* Apresentação */}
      {(doc.intro.pt || doc.intro.en) && (
        <div className="pf-intro">
          <div className="pf-sec-lbl">{pfLbl(L.intro, idi)}</div>
          <div className={'pf-field-vals' + (both ? ' two' : '')}>
            {idi !== 'en' && <p>{doc.intro.pt}</p>}
            {idi !== 'pt' && <p className="pf-val-en">{doc.intro.en || doc.intro.pt}</p>}
          </div>
        </div>
      )}

      {/* Itens */}
      <div className="pf-items">
        {doc.itens.map((it, i) => (
          <div className="pf-item" key={i}>
            <div className="pf-item-n">{i + 1}</div>
            <div className="pf-item-photo">
              {it.foto ? <img src={it.foto} alt=""/> : <div className="pf-no-photo">{pfLbl(L.semFoto, idi)}</div>}
            </div>
            <div className="pf-item-body">
              <div className="pf-item-sku">{pfLbl(L.sku, idi)}: <b>{it.codigo_interno || it.codigo || '—'}</b></div>
              <Field label={L.produto} pt={it.denominacao} en={it.denominacao_en}/>
              {(it.detalhamento || it.detalhamento_en) &&
                <Field label={L.descricao} pt={it.detalhamento} en={it.detalhamento_en}/>}
              {(it.atributos || []).length > 0 && (
                <div className="pf-specs">
                  <div className="pf-field-lbl">{pfLbl(L.especif, idi)}</div>
                  <table className="pf-specs-t"><tbody>
                    {it.atributos.map((a, j) => {
                      const ae = (it.atributos_en || [])[j] || {};
                      return (
                        <tr key={j}>
                          <td className="pf-spec-k">{a.nome}{both && ae.nome_en ? ' / ' + ae.nome_en : ''}</td>
                          <td className="pf-spec-v">{a.valor}{both && ae.valor_en ? ' / ' + ae.valor_en : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )}
              {/* Linha de cotação — colunas em branco p/ o fornecedor preencher */}
              <table className="pf-quote-t">
                <thead><tr>
                  <th>{pfLbl(L.qtd, idi)}</th><th>{pfLbl(L.unidade, idi)}</th>
                  <th>{pfLbl(L.precoUnit, idi)}</th><th>{pfLbl(L.moq, idi)}</th><th>{pfLbl(L.leadTime, idi)}</th>
                </tr></thead>
                <tbody><tr>
                  <td className="pf-q-given">{it.qty}</td>
                  <td className="pf-q-given">{it.unidade}</td>
                  <td className="pf-q-blank"></td><td className="pf-q-blank"></td><td className="pf-q-blank"></td>
                </tr></tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Observações */}
      {(doc.observacoes.pt || doc.observacoes.en) && (
        <div className="pf-intro">
          <div className="pf-sec-lbl">{pfLbl(L.observacoes, idi)}</div>
          <div className={'pf-field-vals' + (both ? ' two' : '')}>
            {idi !== 'en' && <p>{doc.observacoes.pt}</p>}
            {idi !== 'pt' && <p className="pf-val-en">{doc.observacoes.en || doc.observacoes.pt}</p>}
          </div>
        </div>
      )}

      <div className="pf-doc-foot">★ {pfLbl(L.aPreencher, idi)}</div>
    </div>
  );
}

/* ============================================================
   BUILDER — wizard de criação
   ============================================================ */
function PedidoBuilderModal({ produtos, operadores, onClose, onCreated }) {
  const ativos = (operadores || []).filter(o => o.situacao === 'ativado');
  const [tipo, setTipo] = _pfUS('importacao');
  const [opCod, setOpCod] = _pfUS(ativos[0] ? ativos[0].codigo : '');
  const [fornNome, setFornNome] = _pfUS('');
  const [fornEmail, setFornEmail] = _pfUS('');
  const [idioma, setIdioma] = _pfUS('bilingue');
  const [intro, setIntro] = _pfUS('Prezado fornecedor, solicitamos cotação (preço unitário, MOQ e prazo de produção) para os itens abaixo, conforme especificações técnicas.');
  const [obs, setObs] = _pfUS('');
  const [qtys, setQtys] = _pfUS(() => Object.fromEntries(produtos.map(p => [p.id, 1])));
  const [busy, setBusy] = _pfUS(false);

  const setQty = (id, v) => setQtys(p => ({ ...p, [id]: v }));

  const gerar = async () => {
    let fornecedor;
    if (tipo === 'importacao') {
      const op = ativos.find(o => o.codigo === opCod);
      if (!op) return window.toast('Selecione um operador estrangeiro.', 'warning');
      fornecedor = { tipo: 'importacao', nome: op.nome, pais: op.pais, tin: op.tin || '', email: op.email || '' };
    } else {
      if (!fornNome.trim()) return window.toast('Informe o nome do fornecedor nacional.', 'warning');
      fornecedor = { tipo: 'nacional', nome: fornNome.trim(), pais: 'Brasil', email: fornEmail.trim() };
    }
    setBusy(true);
    try {
      const pedido = await window.PFStore.gerar(produtos, { fornecedor, idioma, intro_pt: intro, observacoes_pt: obs, qtys });
      window.toast('Cotação ' + pedido.numero_documento + ' gerada' + (idioma !== 'pt' ? ' e traduzida.' : '.'), 'success');
      onCreated(pedido);
    } catch (e) {
      window.toast('Erro ao gerar: ' + e.message, 'error');
    } finally { setBusy(false); }
  };

  const lbl = (t) => <label className="up-eyebrow muted">{t}</label>;

  return (
    <Modal title={`Gerar cotação — ${produtos.length} ${produtos.length === 1 ? 'item' : 'itens'}`} onClose={onClose} width={680}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="primary" icon="globe" onClick={gerar} disabled={busy}>
          {busy ? 'Gerando / traduzindo…' : 'Gerar documento'}
        </Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="stack" style={{ gap: 4 }}>{lbl('Fornecedor')}
          <div className="seg" style={{ maxWidth: 320 }}>
            <button className={tipo === 'importacao' ? 'is-active' : ''} onClick={() => setTipo('importacao')}>Importação</button>
            <button className={tipo === 'nacional' ? 'is-active' : ''} onClick={() => setTipo('nacional')}>Nacional</button>
          </div>
        </div>

        {tipo === 'importacao' ? (
          ativos.length ? (
            <div className="stack" style={{ gap: 4 }}>{lbl('Operador estrangeiro')}
              <select className="input" value={opCod} onChange={e => setOpCod(e.target.value)}>
                {ativos.map(o => <option key={o.codigo} value={o.codigo}>{o.nome} ({o.pais})</option>)}
              </select>
            </div>
          ) : <div className="muted small">Nenhum operador estrangeiro ativo. Cadastre um na aba “Operadores estrangeiros” ou use Nacional.</div>
        ) : (
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stack" style={{ gap: 4 }}>{lbl('Nome do fornecedor *')}
              <input className="input" value={fornNome} onChange={e => setFornNome(e.target.value)} placeholder="Razão social"/></div>
            <div className="stack" style={{ gap: 4 }}>{lbl('E-mail (opcional)')}
              <input className="input" value={fornEmail} onChange={e => setFornEmail(e.target.value)} placeholder="contato@fornecedor.com.br"/></div>
          </div>
        )}

        <div className="stack" style={{ gap: 4 }}>{lbl('Idioma do documento')}
          <div className="seg" style={{ maxWidth: 360 }}>
            <button className={idioma === 'bilingue' ? 'is-active' : ''} onClick={() => setIdioma('bilingue')}>Bilíngue PT|EN</button>
            <button className={idioma === 'pt' ? 'is-active' : ''} onClick={() => setIdioma('pt')}>Só PT</button>
            <button className={idioma === 'en' ? 'is-active' : ''} onClick={() => setIdioma('en')}>Só EN</button>
          </div>
        </div>

        <div className="stack" style={{ gap: 4 }}>{lbl('Apresentação / Introdução')}
          <textarea className="input" rows={2} value={intro} onChange={e => setIntro(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }}/></div>

        <div className="stack" style={{ gap: 4 }}>{lbl('Itens e quantidades')}
          <div className="pf-qty-list">
            {produtos.map(p => (
              <div className="pf-qty-row" key={p.id}>
                <span className="pf-qty-name">{p.denominacao || p.codigo}</span>
                <span className="muted mono small">{p.ncm || '—'}</span>
                <input className="input pf-qty-inp" type="number" min="1" value={qtys[p.id]}
                  onChange={e => setQty(p.id, e.target.value)}/>
                <span className="muted small">{p.unidade_medida || 'UN'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 4 }}>{lbl('Observações (opcional)')}
          <textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} placeholder="Condições, embalagem, Incoterm desejado, certificações…"/></div>
      </div>
    </Modal>
  );
}

/* ============================================================
   PREVIEW OVERLAY (fullscreen) + ações
   ============================================================ */
function PedidoPreviewOverlay({ pedido, onClose, onSaved }) {
  const [saving, setSaving] = _pfUS(false);
  const [showSend, setShowSend] = _pfUS(false);
  const docRef = _pfUR(null);
  const doc = pedido.doc || window.PFEngine.buildDoc(pedido);

  const salvarBanco = async () => {
    setSaving(true);
    try { await window.PFStore.salvar(pedido); window.toast('Cotação salva.', 'success'); onSaved && onSaved(); }
    catch (e) { window.toast('Erro ao salvar: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };
  /* Antes de abrir o envio, garante que o pedido está no banco (link do portal precisa). */
  const abrirEnvio = async () => {
    setSaving(true);
    try { await window.PFStore.salvar(pedido); onSaved && onSaved(); setShowSend(true); }
    catch (e) { window.toast('Erro ao preparar envio: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };
  const salvarPdf = async () => {
    const el = docRef.current ? docRef.current.querySelector('.pf-doc') : null;
    if (el) await pfSalvarPDF(el, `Cotacao-${pedido.numero_documento}.pdf`);
  };
  /* Fase 1 da migração pra @react-pdf/renderer (plano aprovado 20/08) —
     roda em paralelo ao botão acima, não substitui ainda. */
  const [gerandoNovo, setGerandoNovo] = _pfUS(false);
  const salvarPdfNovo = async () => {
    setGerandoNovo(true);
    try { await window.PFReactPdf.baixar(doc, `Cotacao-${pedido.numero_documento}.pdf`); }
    catch (e) { window.toast('Erro no novo motor de PDF: ' + e.message, 'error'); }
    finally { setGerandoNovo(false); }
  };

  return ReactDOM.createPortal(
    <div className="pf-overlay">
      <div className="pf-overlay-bar">
        <div className="pf-overlay-title">Cotação {pedido.numero_documento}</div>
        <div className="row gap-2">
          <Button variant="primary" size="sm" icon="download" onClick={salvarPdf}>Salvar PDF</Button>
          <Button variant="outline" size="sm" icon="download" onClick={salvarPdfNovo} disabled={gerandoNovo}
            title="Fase 1 da migração pra @react-pdf/renderer — PDF vetorial, em teste">
            {gerandoNovo ? 'Gerando…' : 'Salvar PDF (novo motor)'}
          </Button>
          <Button variant="outline" size="sm" icon="check" onClick={salvarBanco} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          <Button variant="secondary" size="sm" icon="send" onClick={abrirEnvio} disabled={saving}>Enviar</Button>
          <Button variant="ghost" size="sm" icon="x" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      <div className="pf-overlay-scroll" ref={docRef}>
        <PedidoDoc doc={doc}/>
      </div>
      {showSend && <PedidoSendModal pedido={pedido} onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); onSaved && onSaved(); }}/>}
    </div>,
    document.body
  );
}

/* ============================================================
   ENVIO — WhatsApp / E-mail / Link
   ============================================================ */
function PedidoSendModal({ pedido, onClose, onSent }) {
  const forn = pedido.fornecedor || {};
  const token = pedido.token;
  const portalUrl = token ? window.PFStore.cotacaoUrl(token) : '';
  const [copied, setCopied] = _pfUS(false);

  const msg =
    `Solicitação de Cotação ${pedido.numero_documento} — VerticalParts\n` +
    `Abra o link e preencha preço unitário, MOQ e prazo direto no nosso portal:\n${portalUrl}\n\n` +
    `RFQ ${pedido.numero_documento} — please open the link and fill in unit price, MOQ and lead time:\n${portalUrl}`;

  const marcar = async (canal) => {
    await window.PFStore.marcarEnviado(pedido.id, canal, { nome: forn.nome, email: forn.email });
    window.toast('Marcado como enviado (' + canal + ').', 'success');
    onSent && onSent();
  };
  const enviar = async (canal) => {
    if (canal === 'whatsapp') window.open(window.PFStore.whatsAppHref(forn.telefone || forn.whatsapp || '', msg), '_blank');
    if (canal === 'email') window.open(window.PFStore.mailtoHref(forn.email || '', 'RFQ ' + pedido.numero_documento + ' — VerticalParts', msg), '_blank');
    await marcar(canal);
  };
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); window.toast('Link do portal copiado.', 'success'); }
    catch (e) { window.prompt('Copie o link do portal:', portalUrl); }
    await marcar('link');
  };

  return (
    <Modal title={`Enviar cotação ${pedido.numero_documento}`} onClose={onClose} width={500}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="pf-portal-callout">
        <div className="pf-portal-ico">🔗</div>
        <div>
          <b>Portal de cotação online</b>
          <p>O fornecedor abre o link, preenche os preços e <b>o VP Gestão recebe a resposta automaticamente</b> — sem PDF, sem digitação manual.</p>
        </div>
      </div>

      {portalUrl ? (
        <div className="pf-linkbox">
          <input className="input mono small" readOnly value={portalUrl} onFocus={e => e.target.select()}/>
          <Button variant="primary" size="sm" icon={copied ? 'check' : 'copy'} onClick={copiarLink}>{copied ? 'Copiado!' : 'Copiar link'}</Button>
        </div>
      ) : (
        <p className="small muted">Salve a cotação primeiro para gerar o link do portal.</p>
      )}

      <div className="up-eyebrow muted" style={{ margin: '14px 0 6px' }}>Enviar por</div>
      <div className="stack" style={{ gap: 8 }}>
        <Button variant="outline" icon="message" onClick={() => enviar('whatsapp')} disabled={!portalUrl}>WhatsApp{forn.telefone ? ` (${forn.telefone})` : ''}</Button>
        <Button variant="outline" icon="mail" onClick={() => enviar('email')} disabled={!portalUrl || !forn.email}>E-mail {forn.email ? `(${forn.email})` : '(sem e-mail)'}</Button>
      </div>
      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Prefere o documento? Use “Salvar PDF” na barra acima e anexe manualmente.
      </p>
    </Modal>
  );
}

/* ============================================================
   RESPOSTA DO FORNECEDOR — visualizador (após "respondido")
   ============================================================ */
function CotacaoRespostaModal({ pedido, onClose }) {
  const r = pedido.resposta || {};
  const itens = pedido.itens || [];
  const respItens = {};
  (r.itens || []).forEach(ri => { respItens[ri.produto_id] = ri; });
  const meta = r._meta || {};

  return (
    <Modal title={`Resposta do fornecedor — ${pedido.numero_documento}`} onClose={onClose} width={720}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="pf-resp-head">
        <div><span className="up-eyebrow muted">Moeda</span><b>{r.moeda || '—'}</b></div>
        <div><span className="up-eyebrow muted">Validade</span><b>{r.validade || '—'}</b></div>
        {r.incoterm && <div><span className="up-eyebrow muted">Incoterm</span><b>{r.incoterm}</b></div>}
        {r.porto && <div><span className="up-eyebrow muted">Porto</span><b>{r.porto}</b></div>}
        <div><span className="up-eyebrow muted">Respondido em</span><b>{window.PFStore.fmtDateTime(pedido.responded_at || meta.respondido_em)}</b></div>
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="t">
          <thead><tr><th>SKU</th><th>Produto</th><th>Qtd</th><th>Preço unit. ({r.moeda || '—'})</th><th>MOQ</th><th>Prazo</th><th>Obs.</th></tr></thead>
          <tbody>
            {itens.map((it, i) => {
              const ri = respItens[it.produto_id] || {};
              return (
                <tr key={i}>
                  <td className="mono small">{it.codigo_interno || it.codigo || '—'}</td>
                  <td>{it.denominacao}</td>
                  <td>{it.qty} {it.unidade}</td>
                  <td><b>{ri.preco_unit || '—'}</b></td>
                  <td>{ri.moq || '—'}</td>
                  <td>{ri.lead_time || '—'}</td>
                  <td className="small muted">{ri.obs || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {r.obs_geral && (
        <div style={{ marginTop: 12 }}>
          <span className="up-eyebrow muted">Observações gerais</span>
          <p className="small" style={{ marginTop: 4 }}>{r.obs_geral}</p>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   LISTA — aba "Pedidos" do Catálogo
   ============================================================ */
function PedidosList({ onReopen }) {
  const [rows, setRows] = _pfUS(null);
  const [verResp, setVerResp] = _pfUS(null);
  const reload = () => window.PFStore.listar().then(setRows);
  _pfUE(() => { reload(); }, []);

  if (rows === null) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)' }}>Carregando…</div>;
  if (!rows.length) return (
    <div className="empty" style={{ padding: '48px 20px', textAlign: 'center' }}>
      <h4>Nenhuma cotação ainda</h4>
      <p className="muted small">Selecione produtos na aba “Produtos” e clique em “Gerar pedido a fornecedor”.</p>
    </div>
  );

  const sit = {
    rascunho: ['warning', 'Rascunho'], enviado: ['info', 'Enviado'],
    visualizado: ['warning', 'Visualizado'], respondido: ['success', 'Respondido'],
    expirado: ['danger', 'Expirado'], cancelado: ['muted', 'Cancelado'],
  };
  const excluir = async (r) => { if (!window.confirm('Excluir a cotação ' + r.numero_documento + '?')) return; await window.PFStore.excluir(r.id); reload(); window.toast('Cotação excluída.', 'success'); };
  const copiarLink = async (r) => {
    if (!r.token) return window.toast('Cotação sem link — reabra e salve.', 'warning');
    const url = window.PFStore.cotacaoUrl(r.token);
    try { await navigator.clipboard.writeText(url); window.toast('Link do portal copiado.', 'success'); }
    catch (e) { window.prompt('Copie o link do portal:', url); }
  };

  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Cotação</th><th>Fornecedor</th><th>Itens</th><th>Idioma</th><th>Situação</th><th>Data</th><th></th></tr></thead>
        <tbody>
          {rows.map(r => {
            const [v, l] = sit[r.status] || ['muted', r.status];
            const respondido = r.status === 'respondido';
            return (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => (respondido ? setVerResp(r) : onReopen(r))}>
                <td><span className="mono small">{r.numero_documento}</span></td>
                <td>{(r.fornecedor && r.fornecedor.nome) || '—'} <span className="muted small">({(r.fornecedor && r.fornecedor.tipo) === 'nacional' ? 'Nacional' : 'Importação'})</span></td>
                <td>{(r.itens || []).length}</td>
                <td className="small">{r.idioma === 'bilingue' ? 'PT|EN' : (r.idioma || '').toUpperCase()}</td>
                <td><Badge variant={v} dot>{l}</Badge></td>
                <td><span className="cell-sub mono">{(r.created_at || '').slice(0, 10)}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                    {respondido && <Button variant="outline" size="sm" icon="eye" onClick={() => setVerResp(r)}>Ver resposta</Button>}
                    <Button variant="ghost" size="sm" icon="link2" title="Copiar link do portal" onClick={() => copiarLink(r)}/>
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => excluir(r)}/>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {verResp && <CotacaoRespostaModal pedido={verResp} onClose={() => setVerResp(null)}/>}
    </div>
  );
}

window.PedidoBuilderModal = PedidoBuilderModal;
window.PedidoPreviewOverlay = PedidoPreviewOverlay;
window.PedidosList = PedidosList;
