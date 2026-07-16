/* ============================================================
   ficha-tecnica.jsx
   FichaTecnicaPage — wizard universal + dashboard de fichas +
   overlay de impressão. Persiste em fichas_tecnicas e sincroniza
   com catalogo_produtos.
   ============================================================ */
const { useState: _ftUS, useEffect: _ftUE, useMemo: _ftUM, useRef: _ftUR } = React;

/* ============================================================
   ICONS (categorias)
   ============================================================ */
const FT_ICONS = {
  ruler: 'M3 17 17 3l4 4L7 21z M7 13l2 2 M11 9l2 2 M15 5l2 2',
  weight: 'M5 7h14l1 13H4z M9 7a3 3 0 0 1 6 0',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  gauge: 'M12 14 18 8 M3 18a9 9 0 1 1 18 0',
  droplet: 'M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z',
  wave: 'M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
  cog: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2',
  chip: 'M7 7h10v10H7z M3 9h2 M3 13h2 M19 9h2 M19 13h2 M9 3v2 M13 3v2 M9 19v2 M13 19v2',
  barcode: 'M4 5v14 M8 5v14 M12 5v14 M16 5v14 M20 5v14',
  folder: 'M3 6h6l2 2h10v10H3z',
};
function FtCatIcon({ name }) {
  return (
    <svg className="ft-cat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={FT_ICONS[name] || FT_ICONS.folder}/>
    </svg>
  );
}

/* ============================================================
   FICHA (renderer A4 paisagem)
   ============================================================ */
function FtFichaLinha({ l }) {
  const val = l.unidade ? `${l.valor} ${l.unidade}` : l.valor;
  const longo = l.tipo === 'text' && val.length > 22;
  return longo
    ? <div className="ft-fz-line solo"><span className="ft-fz-lk2">{l.nome}</span><span className="ft-fz-lv">{val}</span></div>
    : <div className="ft-fz-line"><span className="ft-fz-lk">{l.nome}</span><span className="ft-fz-lv">{val}</span></div>;
}
function FtFichaGrupo({ g }) {
  return (
    <div className="ft-fz-grp">
      <h4>{g.nome}</h4>
      {g.linhas.map((l, i) => <FtFichaLinha l={l} key={i}/>)}
    </div>
  );
}
/* Hook que resolve uma referência de imagem (path do Storage OU dataURL legado)
   em URL utilizável pelo <img>. Re-resolve quando a referência muda. */
function useImgURL(src) {
  const [url, setUrl] = _ftUS(null);
  _ftUE(() => {
    if (!src) { setUrl(null); return; }
    let alive = true;
    if (window.FTImg && window.FTImg.resolveURL) {
      window.FTImg.resolveURL(src).then((u) => { if (alive) setUrl(u); });
    } else {
      setUrl(src);
    }
    return () => { alive = false; };
  }, [src]);
  return url;
}

function FtFichaFrame({ src, legenda }) {
  const url = useImgURL(src);
  return (
    <div className="ft-fz-frame">
      {url ? <img src={url} alt={legenda} crossOrigin="anonymous"/> : (
        <div className="ft-fz-ph">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <span>{legenda}</span>
        </div>
      )}
    </div>
  );
}

/* Mede aspect ratio da maior imagem (foto > desenho) pra decidir a orientação
   da página: portrait se h > w*1.15 (produto vertical tipo porta/totem),
   senão landscape (widescreen, padrão da Vertical Parts).
   Resolve URL assinada quando midia é um path do Storage. */
function useFichaOrientation(midia) {
  const [orientation, setOrientation] = _ftUS('landscape');
  const ref = (midia && (midia.foto || midia.desenho)) || null;
  _ftUE(() => {
    if (!ref) { setOrientation('landscape'); return; }
    let alive = true;
    const measure = (url) => {
      if (!alive || !url) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!alive) return;
        const r = img.naturalWidth / Math.max(1, img.naturalHeight);
        setOrientation(r < 0.85 ? 'portrait' : 'landscape');
      };
      img.onerror = () => alive && setOrientation('landscape');
      img.src = url;
    };
    if (window.FTImg && window.FTImg.resolveURL) {
      window.FTImg.resolveURL(ref).then(measure);
    } else {
      measure(ref);
    }
    return () => { alive = false; };
  }, [ref]);
  return orientation;
}

function FtFicha({ state }) {
  const d = window.FT.compile(state);
  const id = d.identificacao;
  const nome = id.nomeProduto || 'Ficha Técnica';
  const idents = [
    id.descricaoComercial && { k: 'Descrição Comercial', v: id.descricaoComercial },
    id.categoriaProduto && { k: 'Categoria', v: id.categoriaProduto },
    id.sku && { k: 'SKU', v: id.sku },
    id.codigoProduto && { k: 'Código do Produto', v: id.codigoProduto },
    id.partNumber && { k: 'Part Number', v: id.partNumber },
  ].filter(Boolean);
  const vazia = !d.grupos.length && idents.length === 0 && !(id.descricaoTecnica && id.descricaoTecnica.trim()) && !(state.descricao_duimp && state.descricao_duimp.trim());
  const orientation = useFichaOrientation(d.temMidia ? d.midia : null);

  return (
    <div className="ft-ficha" data-orientation={orientation} data-has-media={d.temMidia ? '1' : '0'}>
      <div className="ft-fz-logo"><img src="assets/logo-verticalparts-color.png" alt="VerticalParts"/></div>
      <div className={'ft-fz-columns' + (d.temMidia ? '' : ' no-media')}>
        <div className="ft-fz-zone ft-fz-zone--text">
          <div className="ft-fz-titlebar ft-tb-yellow">Ficha de Dados : {nome}</div>
          {idents.length > 0 && (
            <div className="ft-fz-ident">
              {idents.map((it, i) => <div className="it" key={i}><span className="k">{it.k}</span><span className="v">{it.v}</span></div>)}
            </div>
          )}
          {id.descricaoTecnica && id.descricaoTecnica.trim() && (
            <div className="ft-fz-descterm">
              <span className="ft-fz-dt-k">Descrição Técnica</span>
              <p>{id.descricaoTecnica.trim()}</p>
            </div>
          )}
          {state.descricao_duimp && state.descricao_duimp.trim() && (
            <div className="ft-fz-descterm">
              <span className="ft-fz-dt-k">Descrição DUIMP</span>
              <p>{state.descricao_duimp.trim()}</p>
            </div>
          )}
          {vazia ? (
            <div className="ft-fz-vazia">Selecione campos na barra lateral e preencha os valores — eles aparecem aqui automaticamente.</div>
          ) : (
            <div className="ft-fz-specs">
              {d.grupos.map((g) => <FtFichaGrupo g={g} key={g.id}/>)}
            </div>
          )}
        </div>
        {d.temMidia && (
          <div className="ft-fz-zone ft-fz-zone--media">
            <div className="ft-fz-titlebar ft-tb-black">Imagens & Desenho</div>
            <div className="ft-fz-media">
              {d.midia.desenho && <FtFichaFrame src={d.midia.desenho} legenda="Desenho técnico"/>}
              {d.midia.foto && <FtFichaFrame src={d.midia.foto} legenda="Foto do produto"/>}
            </div>
          </div>
        )}
      </div>
      <div className="ft-fz-footer">
        <div className="fb">VERTICAL<span>PARTS</span></div>
        <div className="fc">{id.categoriaProduto || 'Ficha Técnica'}</div>
        <div className="fc">
          {window.FT.hoje()} · www.verticalparts.com.br
          {window.__VP_USER?.email && <span className="ft-fz-autor"> · Criado por {window.__VP_USER.email}</span>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR (categorias expansíveis + busca + templates)
   ============================================================ */
function FtSidebar({ cats, search, setSearch, onToggle, onAddField, onAddCategory, onTemplate, onRemoveCategory, onRemoveField }) {
  const [open, setOpen] = _ftUS({ dimensoes: true });
  const t = search.trim().toLowerCase();
  const matchCampo = (fld) => !t || fld.nome.toLowerCase().includes(t);
  const catVisible = (c) => !t || c.nome.toLowerCase().includes(t) || c.campos.some(matchCampo);

  return (
    <aside className="ft-side">
      <div className="ft-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="O que você quer especificar?"/>
        {search && <button className="ft-clear" onClick={() => setSearch('')} aria-label="Limpar">×</button>}
      </div>
      <div className="ft-templates">
        <span className="ft-eyebrow">Começar de um modelo</span>
        <div className="ft-tpls">
          {window.FT.TEMPLATES.map((tp) => (
            <button key={tp.nome} onClick={() => onTemplate(tp)} title={'Carregar ' + tp.nome}>{tp.nome}</button>
          ))}
        </div>
      </div>
      <div className="ft-cats">
        {cats.filter(catVisible).map((c) => {
          const aberto = t ? true : !!open[c.id];
          const nAtivos = c.campos.filter((fld) => fld.ativo).length;
          const campos = c.campos.filter(matchCampo);
          const catExcluivel = c.custom && !window.FT.PROTECTED_CUSTOM_CATS.includes(c.id);
          return (
            <div className="ft-cat" key={c.id}>
              <div className="ft-cat-head">
                <button className="ft-cat-toggle" onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                  <svg className={'ft-chev' + (aberto ? ' on' : '')} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  <FtCatIcon name={c.icon}/>
                  <span className="ft-cat-nome">{c.nome}</span>
                  {nAtivos > 0 && <span className="ft-badge">{nAtivos}</span>}
                </button>
                {catExcluivel && (
                  <button className="ft-cat-rm" onClick={() => onRemoveCategory(c.id)} title="Excluir categoria" aria-label="Excluir categoria">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                  </button>
                )}
              </div>
              {aberto && (
                <div className="ft-fields">
                  {campos.map((fld) => (
                    <div className="ft-fld-row" key={fld.k}>
                      <label className={'ft-fld' + (fld.ativo ? ' on' : '')}>
                        <input type="checkbox" checked={!!fld.ativo} onChange={() => onToggle(c.id, fld.k)}/>
                        <span className="ft-fld-nome">{fld.nome}</span>
                        {fld.unidade && <span className="ft-fld-u">{fld.unidade}</span>}
                      </label>
                      {fld.custom && (
                        <button className="ft-fld-rm" onClick={() => onRemoveField(c.id, fld.k)} title="Excluir campo" aria-label="Excluir campo">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="ft-addfield" onClick={() => onAddField(c.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Adicionar campo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="ft-addcat" onClick={onAddCategory}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nova categoria
      </button>
    </aside>
  );
}

/* ============================================================
   EDITOR (identificação + campos ativos + mídia)
   ============================================================ */
function FtValueInput({ fld, onChange }) {
  if (fld.tipo === 'date')
    return <input type="date" value={fld.valor || ''} onChange={(e) => onChange(e.target.value)}/>;
  if (fld.tipo === 'text')
    return <input type="text" value={fld.valor || ''} placeholder="valor…" onChange={(e) => onChange(e.target.value)}/>;
  return (
    <div className={fld.unidade ? 'ft-unit' : ''}>
      <input type="text" inputMode="decimal" value={fld.valor || ''} placeholder="valor…" onChange={(e) => onChange(e.target.value)}/>
      {fld.unidade && <span className="u">{fld.unidade}</span>}
    </div>
  );
}

function FtMediaSlot({ label, src, uploading, onPick, onClear }) {
  const id = 'ft-media-' + label.replace(/\s/g, '');
  const url = useImgURL(src);
  return (
    <div className="ft-media-slot">
      <span className="ft-media-lbl">{label}{uploading && <em style={{ color:'#E89A1F', marginLeft:8, fontWeight:600 }}>enviando…</em>}</span>
      {url || uploading ? (
        <div className="ft-media-has">
          {url ? <img src={url} alt={label} crossOrigin="anonymous"/> : <div style={{ color:'#888', fontSize:11 }}>preparando…</div>}
          <button className="ft-media-rm" onClick={onClear}>Remover</button>
        </div>
      ) : (
        <label className="ft-media-drop" htmlFor={id}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>
          <span>Enviar imagem</span>
          <input id={id} type="file" accept="image/*" hidden onChange={onPick}/>
        </label>
      )}
    </div>
  );
}

function FtEditor({ state, onIdent, onValue, onRemove, onMedia, onAddField, onNCMField, uploadingSlot }) {
  const grupos = state.cats
    .map((c) => ({ c, ativos: c.campos.filter((fld) => fld.ativo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)) }))
    .filter((g) => g.ativos.length);

  /* SKU automático — nasce sozinho conforme a ficha é preenchida */
  const skuAuto = window.FT.buildSKU(state);
  /* mantém o state sincronizado (persiste no save / sync catálogo) */
  _ftUE(() => {
    if ((state.identificacao.sku || '') !== skuAuto.sku) onIdent('sku', skuAuto.sku);
  }, [skuAuto.sku]);

  return (
    <div className="ft-editor">
      <section className="ft-card">
        <div className="ft-card-head"><span className="ft-bar"></span><h3>Identificação</h3></div>
        <div className="ft-grid">
          <label className="ft-f full"><span>Descrição comercial</span>
            <input value={state.identificacao.descricaoComercial} onChange={(e) => onIdent('descricaoComercial', e.target.value)} placeholder="descrição amigável para leigos"/>
          </label>
          <label className="ft-f full"><span>Descrição técnica</span>
            <textarea rows="2" value={state.identificacao.descricaoTecnica || ''} onChange={(e) => onIdent('descricaoTecnica', e.target.value)} placeholder="especificação técnica detalhada do produto…"></textarea>
          </label>
          <label className="ft-f"><span>Categoria / Segmento</span>
            <input value={state.identificacao.categoriaProduto} onChange={(e) => onIdent('categoriaProduto', e.target.value)} placeholder="Elevador, Escada rolante, Esteira…"/>
          </label>
          <label className="ft-f"><span>Código do Produto (Omie) *</span>
            <input className="ft-mono" value={state.identificacao.codigoProduto || ''} onChange={(e) => onIdent('codigoProduto', e.target.value)} placeholder="ex.: VPEL-258"/>
          </label>
          <label className="ft-f"><span>Part Number</span>
            <input className="ft-mono" value={state.identificacao.partNumber} onChange={(e) => onIdent('partNumber', e.target.value)} placeholder="opcional"/>
          </label>
          {/* SKU é gerado automaticamente — usuário não digita (padrão único, sem interpretações) */}
          <label className="ft-f full"><span>SKU · gerado automaticamente {skuAuto.sku ? '✓' : ''}</span>
            <input className="ft-mono" value={skuAuto.sku} readOnly disabled
              placeholder={'aguardando: ' + (skuAuto.faltas.join(' + ') || 'preenchimento')}
              style={{ background: skuAuto.sku ? '#fffbe6' : '#f6f6f6', fontWeight: 700, cursor: 'default' }}
              title="Montado pelo padrão: PREFIXO-TIPO-CARACTERÍSTICAS-DIMENSÕES-SEQUENCIAL"/>
            {!skuAuto.sku && skuAuto.faltas.length > 0 && (
              <em style={{ fontSize: 10.5, color: '#b45309', fontStyle: 'normal', marginTop: 2 }}>
                Falta: {skuAuto.faltas.join(' · ')} — o SKU nasce sozinho conforme você preenche.
              </em>
            )}
          </label>
        </div>
      </section>

      {/* ============================================================
          Classificação fiscal — alimenta o Copiloto NCM/DUIMP
          ============================================================ */}
      <section className="ft-card">
        <div className="ft-card-head">
          <span className="ft-bar" style={{ background: '#2563eb' }}></span>
          <h3>Classificação fiscal · NCM/DUIMP</h3>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2563eb' }}>🤖 Copiloto IA</span>
        </div>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px', lineHeight: 1.5 }}>
          Mínimo essencial: <b>insumo</b> + <b>função/aplicação</b>. O resto a IA pergunta sozinha.
        </p>
        <div className="ft-grid">
          <label className="ft-f"><span>Insumo · matéria-prima predominante</span>
            <input value={state.insumo || ''} onChange={(e) => onNCMField('insumo', e.target.value)} placeholder="ex.: aço inox, vidro, borracha, polímero"/>
          </label>
          <label className="ft-f"><span>É parte de?</span>
            <input value={state.eh_parte_de || ''} onChange={(e) => onNCMField('eh_parte_de', e.target.value)} placeholder="ex.: elevador, esteira, escada"/>
          </label>
          <label className="ft-f full"><span>Função / aplicação</span>
            <input value={state.funcao_aplicacao || ''} onChange={(e) => onNCMField('funcao_aplicacao', e.target.value)} placeholder="ex.: comando de chamada em cabina de elevador"/>
          </label>
          <label className="ft-f"><span>Forma / estado</span>
            <select className="ft-input" value={state.forma_estado || ''} onChange={(e) => onNCMField('forma_estado', e.target.value)} style={{ padding: 8, fontSize: 13, fontFamily: 'inherit', border: '1px solid #C9CED6', borderRadius: 3 }}>
              <option value="">— escolha —</option>
              <option value="materia_prima">Matéria-prima (rolo / chapa / perfil)</option>
              <option value="peca_acabada">Peça acabada / moldada</option>
            </select>
          </label>
        </div>
        {state.ncm_recomendado && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#fffbeb', border: '1px solid #FBB039', borderRadius: 4, fontSize: 12 }}>
            <b>NCM atual (sugerido pela IA):</b> <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700 }}>{state.ncm_recomendado}</span>
            {state.ncm_descricao && <span style={{ color: '#666', marginLeft: 8 }}>— {state.ncm_descricao}</span>}
          </div>
        )}
        {/* Descrição DUIMP — preenchida pelo botão "✨ Usar descrição DUIMP"
            do Copiloto (editável manualmente; persiste com a ficha) */}
        <label className="ft-f full" style={{ marginTop: 12, display: 'block' }}>
          <span>Descrição DUIMP {state.descricao_duimp ? '✓' : ''}</span>
          <textarea className="ft-input" rows={3} value={state.descricao_duimp || ''}
            onChange={(e) => onNCMField('descricao_duimp', e.target.value)}
            placeholder="Gerada pelo Copiloto NCM (✨ Usar descrição DUIMP) ou digite manualmente — texto oficial do item na declaração"
            style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: 'inherit', border: '1px solid #C9CED6', borderRadius: 3, resize: 'vertical', lineHeight: 1.5, marginTop: 4, boxSizing: 'border-box' }}/>
        </label>
      </section>

      {grupos.length === 0 && (
        <div className="ft-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p><strong>Monte sua ficha.</strong> Abra uma categoria na barra lateral e marque os campos que se aplicam ao seu produto. Eles aparecem aqui para preencher.</p>
        </div>
      )}

      {grupos.map(({ c, ativos }) => (
        <section className="ft-card" key={c.id}>
          <div className="ft-card-head"><span className="ft-bar"></span><h3>{c.nome}</h3>
            <button className="ft-card-add" onClick={() => onAddField(c.id)} title="Adicionar campo a esta categoria">+ campo</button>
          </div>
          <div className="ft-rows">
            {ativos.map((fld) => (
              <div className="ft-row" key={fld.k}>
                <span className="ft-row-lbl">{fld.nome}</span>
                <div className="ft-row-val"><FtValueInput fld={fld} onChange={(v) => onValue(c.id, fld.k, v)}/></div>
                <button className="ft-row-rm" onClick={() => onRemove(c.id, fld.k)} title="Remover" aria-label="Remover">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="ft-card">
        <div className="ft-card-head"><span className="ft-bar"></span><h3>Imagens & Desenho</h3></div>
        <div className="ft-media">
          <FtMediaSlot label="Desenho técnico" src={state.midia.desenho} uploading={uploadingSlot === 'desenho'} onPick={(e) => onMedia('desenho', e)} onClear={() => onMedia('desenho', null)}/>
          <FtMediaSlot label="Foto do produto"  src={state.midia.foto}    uploading={uploadingSlot === 'foto'}    onPick={(e) => onMedia('foto', e)}    onClear={() => onMedia('foto', null)}/>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   MODALS — Add Field / Add Category
   ============================================================ */
function FtModalShell({ titulo, onClose, children }) {
  return (
    <div className="ft-gm-overlay" onClick={(e) => { if (e.target.classList.contains('ft-gm-overlay')) onClose(); }}>
      <div className="ft-gm-card">
        <div className="ft-gm-head"><h3>{titulo}</h3><button className="ft-gm-x" onClick={onClose} aria-label="Fechar">×</button></div>
        {children}
      </div>
    </div>
  );
}
function FtAddFieldModal({ catNome, onAdd, onClose }) {
  const [nome, setNome] = _ftUS('');
  const [tipo, setTipo] = _ftUS('number');
  const [unidade, setUnidade] = _ftUS('');
  const [unidadeCustom, setUnidadeCustom] = _ftUS('');
  const [valor, setValor] = _ftUS('');
  const uFinal = unidade === '__outra__' ? unidadeCustom : unidade;
  const submit = () => {
    if (!nome.trim()) return;
    onAdd({ nome: nome.trim(), tipo, unidade: tipo === 'text' || tipo === 'date' ? '' : uFinal, valor: valor.trim() });
  };
  return (
    <FtModalShell titulo={'Adicionar campo · ' + catNome} onClose={onClose}>
      <div className="ft-gm-body">
        <label className="ft-gm-field"><span>Nome do campo <i>*</i></span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Bitola, Tensão nominal"/>
        </label>
        <div className="ft-gm-row">
          <label className="ft-gm-field"><span>Tipo de entrada</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="number">Número</option>
              <option value="text">Texto</option>
              <option value="date">Data</option>
            </select>
          </label>
          {tipo === 'number' && (
            <label className="ft-gm-field"><span>Unidade / Símbolo</span>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                <option value="">— nenhuma —</option>
                {window.FT.UNIDADES.filter((u) => u && u !== '—').map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="__outra__">outra…</option>
              </select>
            </label>
          )}
        </div>
        {tipo === 'number' && unidade === '__outra__' && (
          <label className="ft-gm-field"><span>Nova unidade</span>
            <input value={unidadeCustom} onChange={(e) => setUnidadeCustom(e.target.value)} placeholder="ex.: cm³, lúmen"/>
          </label>
        )}
        <label className="ft-gm-field"><span>Valor padrão (opcional)</span>
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="deixe vazio p/ preencher depois"/>
        </label>
      </div>
      <div className="ft-gm-foot">
        <button className="ft-btn ghost" onClick={onClose}>Cancelar</button>
        <button className="ft-btn primary" onClick={submit}>Adicionar campo</button>
      </div>
    </FtModalShell>
  );
}
function FtAddCategoryModal({ onAdd, onClose }) {
  const [nome, setNome] = _ftUS('');
  return (
    <FtModalShell titulo="Nova categoria" onClose={onClose}>
      <div className="ft-gm-body">
        <label className="ft-gm-field"><span>Nome da categoria <i>*</i></span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Compatível com Fabricante"/>
        </label>
        <p className="ft-gm-hint">A categoria aparece na barra lateral; depois você adiciona campos a ela.</p>
      </div>
      <div className="ft-gm-foot">
        <button className="ft-btn ghost" onClick={onClose}>Cancelar</button>
        <button className="ft-btn primary" onClick={() => nome.trim() && onAdd(nome.trim())}>Criar categoria</button>
      </div>
    </FtModalShell>
  );
}

/* ============================================================
   GENERATOR (wizard universal) — sub-componente da página
   ============================================================ */
function FtGenerator({ initial, onSaved, onCancel }) {
  const [state, setState] = _ftUS(initial || window.FT.freshState());
  const [search, setSearch] = _ftUS('');
  const [modal, setModal] = _ftUS(null);
  const [overlay, setOverlay] = _ftUS(false);
  const [saving, setSaving] = _ftUS(false);
  const previewWrap = _ftUR(null);
  const [scale, setScale] = _ftUS(0.42);

  _ftUE(() => {
    const el = previewWrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.max(0.2, Math.min(1, (el.clientWidth - 28) / 1040))));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const setIdent = (k, v) => setState((s) => ({ ...s, identificacao: { ...s.identificacao, [k]: v } }));
  const toggleField = (catId, key) => setState((s) => {
    const ord = window.FT.nextOrdem(s.cats);
    return { ...s, cats: s.cats.map((c) => c.id !== catId ? c : { ...c, campos: c.campos.map((fld) => fld.k !== key ? fld : { ...fld, ativo: !fld.ativo, ordem: !fld.ativo ? ord : fld.ordem }) }) };
  });
  const setValue = (catId, key, v) => setState((s) => ({ ...s, cats: s.cats.map((c) => c.id !== catId ? c : { ...c, campos: c.campos.map((fld) => fld.k !== key ? fld : { ...fld, valor: v }) }) }));
  const removeField = (catId, key) => setState((s) => ({ ...s, cats: s.cats.map((c) => c.id !== catId ? c : { ...c, campos: c.campos.map((fld) => fld.k !== key ? fld : { ...fld, ativo: false }) }) }));
  const addField = (catId, def) => {
    // Trava duplicidade — sem diferenciar maiúsculo/minúsculo/acento —
    // contra os campos já existentes NESTA categoria (nativos + custom).
    // Retorna true/false pra quem chama saber se deve fechar o modal.
    const cat = state.cats.find((c) => c.id === catId);
    const norm = window.FT.normalizeNome(def.nome);
    const existe = cat && cat.campos.some((f) => window.FT.normalizeNome(f.nome) === norm);
    if (existe) {
      alert(`Já existe um campo "${def.nome.trim()}" nesta categoria — escolha outro nome.`);
      return false;
    }
    setState((s) => {
      const ord = window.FT.nextOrdem(s.cats);
      const novo = { k: window.FT.slug(def.nome), nome: def.nome, unidade: def.unidade || '', tipo: def.tipo || 'number', valor: def.valor || '', ativo: true, ordem: ord, custom: true };
      return { ...s, cats: s.cats.map((c) => c.id !== catId ? c : { ...c, campos: [...c.campos, novo] }) };
    });
    // Persiste o campo na biblioteca (assíncrono, não bloqueia UI)
    if (window.FTStore && window.FTStore.saveFieldToLibrary) {
      window.FTStore.saveFieldToLibrary(catId, def).catch((e) => console.warn('saveField bg', e));
    }
    return true;
  };
  const addCategory = (nome) => {
    // Trava duplicidade — sem diferenciar maiúsculo/minúsculo/acento —
    // contra as categorias já visíveis (9 nativas + biblioteca mesclada).
    // Recalcula freshCats() na hora (em vez de confiar só em state.cats):
    // se esta ficha foi aberta antes da biblioteca terminar de carregar,
    // state.cats pode estar incompleto — freshCats() reflete o que está
    // carregado agora, fechando essa brecha de corrida.
    const norm = window.FT.normalizeNome(nome);
    const todasCats = [...state.cats, ...window.FT.freshCats()];
    const existe = todasCats.some((c) => window.FT.normalizeNome(c.nome) === norm);
    if (existe) {
      alert(`Já existe uma categoria "${nome.trim()}" — escolha outro nome.`);
      return;
    }
    const id = window.FT.slug(nome);
    setState((s) => ({ ...s, cats: [...s.cats, { id, nome, icon: 'folder', custom: true, campos: [] }] }));
    setModal(null);
    // Persiste a categoria na biblioteca
    if (window.FTStore && window.FTStore.saveCategoryToLibrary) {
      window.FTStore.saveCategoryToLibrary({ id, nome, icon: 'folder' }).catch((e) => console.warn('saveCat bg', e));
    }
  };
  // Exclui uma categoria customizada de vez — desta ficha e da biblioteca
  // (fichas já salvas guardam seu próprio retrato e não são afetadas).
  const removeCategory = (catId) => {
    const cat = state.cats.find((c) => c.id === catId);
    if (!cat) return;
    if (!window.confirm(`Excluir a categoria "${cat.nome}"? Ela sai desta ficha e da lista de categorias disponíveis para novas fichas.`)) return;
    setState((s) => ({ ...s, cats: s.cats.filter((c) => c.id !== catId) }));
    if (window.FTStore && window.FTStore.deleteCategoryFromLibrary) {
      window.FTStore.deleteCategoryFromLibrary(catId).catch((e) => console.warn('deleteCat bg', e));
    }
  };
  // Exclui um campo customizado de vez (diferente do "Remover" do editor,
  // que só desmarca) — some da lista de campos desta categoria e da biblioteca.
  const removeFieldDef = (catId, key) => {
    const cat = state.cats.find((c) => c.id === catId);
    const fld = cat && cat.campos.find((f) => f.k === key);
    if (!fld) return;
    if (!window.confirm(`Excluir o campo "${fld.nome}"? Ele sai desta ficha e da lista de campos disponíveis para novas fichas.`)) return;
    setState((s) => ({ ...s, cats: s.cats.map((c) => c.id !== catId ? c : { ...c, campos: c.campos.filter((f) => f.k !== key) }) }));
    if (window.FTStore && window.FTStore.deleteFieldFromLibrary) {
      window.FTStore.deleteFieldFromLibrary(catId, key).catch((e) => console.warn('deleteField bg', e));
    }
  };
  const [uploadingSlot, setUploadingSlot] = _ftUS(null);

  const onMedia = async (slot, e) => {
    if (e === null) {
      const old = state.midia[slot];
      setState((s) => ({ ...s, midia: { ...s.midia, [slot]: null } }));
      // Apaga do Storage se for path (não dataURL legado)
      if (window.FTImg && window.FTImg.isStoragePath(old)) {
        window.FTImg.remove(old).catch((err) => console.warn('remove falhou', err));
      }
      return;
    }
    const file = e.target.files && e.target.files[0]; if (!file) return;
    // Lê como dataURL pra preview otimista enquanto sobe
    const dataURL = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setState((s) => ({ ...s, midia: { ...s.midia, [slot]: dataURL } }));
    setUploadingSlot(slot);
    try {
      if (!window.FTImg) throw new Error('Storage helpers não carregaram');
      const { path } = await window.FTImg.compressAndUpload(dataURL, {
        fichaId: state.__id,
        tipo: slot,
        nomeProduto: state.identificacao.nomeProduto,
      });
      // Sucesso: substitui o dataURL pelo path (persiste no Storage)
      setState((s) => ({ ...s, midia: { ...s.midia, [slot]: path } }));
    } catch (err) {
      console.error('upload err', err);
      // Mantém dataURL como fallback (UX não trava); usuário pode tentar de novo
      alert('Erro ao salvar no Storage: ' + (err.message || err) + '\n(imagem fica em memória até salvar a ficha)');
    } finally {
      setUploadingSlot(null);
    }
  };
  const aplicarTemplate = (tp) => setState((s) => window.FT.aplicarTemplate(s, tp));

  const podeGerar = window.FT.podeGerar(state);

  const handleSalvar = async () => {
    if (!podeGerar || saving) return;
    setSaving(true);
    try {
      const editando = !!(initial && initial.__id);
      const rec = editando
        ? await window.FTStore.update(initial.__id, state)
        : await window.FTStore.createDraft(state);
      /* Histórico do funil (quem criou/editou, quando) — best-effort */
      if (window.FWFStore && rec) {
        const ator = window.FWFStore.atorAtual();
        window.FWFStore.registrar({
          ficha_id: rec.id || (initial && initial.__id) || state.__id,
          produto_id: rec.produto_id || null,
          ator_nome: ator.nome, ator_setor: ator.setor,
          acao: editando ? 'editou' : 'criou',
          de_etapa: rec.etapa || null, para_etapa: rec.etapa || null,
          detalhe: { nome_produto: state.identificacao.nomeProduto },
        }).catch(() => {});
      }
      onSaved && onSaved(rec);
    } catch (e) {
      alert('Erro ao salvar ficha: ' + (e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div className="ft-gen-shell">
      <div className="ft-namebar">
        <label className="ft-name">
          <span>Nome do produto <i>*</i></span>
          <input value={state.identificacao.nomeProduto} onChange={(e) => setIdent('nomeProduto', e.target.value)} placeholder="ex.: Pneu, Caibro, Rolamento, Máquina de Tração…"/>
        </label>
        {!podeGerar && (
          <div style={{ fontSize: 11, color: '#b45309', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span><strong>Campos faltando:</strong> revise campos com <i>*</i> e Descrição Técnica</span>
          </div>
        )}
        <button className="ft-btn ghost" onClick={onCancel}>Cancelar</button>
        <button className={'ft-btn primary' + (podeGerar ? '' : ' off')} disabled={!podeGerar || saving} onClick={handleSalvar}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {saving ? 'Salvando…' : 'Salvar ficha'}
        </button>
        <button className={'ft-btn dark' + (podeGerar ? '' : ' off')} disabled={!podeGerar} onClick={() => setOverlay(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
          Gerar PDF
        </button>
        <button className={'ft-btn omie' + (state.identificacao.codigoProduto ? '' : ' off')}
          disabled={!state.identificacao.codigoProduto}
          onClick={async () => {
            if (!window.FichaOmiePublish) { window.toast?.('Sistema não carregado — recarregue a página', 'error'); return; }
            const fichaId = state.__id || (initial && initial.__id) || null;
            if (!fichaId) { window.toast?.('Salve a ficha primeiro — depois publique no Omie', 'error'); return; }
            const user = window.__VP_USER || { nome: 'Usuário', setor: 'engenharia' };
            try {
              const res = await window.FichaOmiePublish.publicarNoOmie(
                fichaId,
                state.identificacao.nomeProduto,
                user.nome,
                user.setor
              );
              if (res) setState((s) => ({ ...s, omie_publicado_em: new Date().toISOString() }));
            } catch (e) { console.error('[Omie publish]', e); }
          }}
          title={(() => {
            if (!state.identificacao.nomeProduto) return '⚠️ Preencha o Nome do Produto';
            if (!state.identificacao.codigoProduto) return '⚠️ Preencha o Código do Produto (Omie)';
            if (!podeGerar) return '⚠️ Faltam campos obrigatórios marcados com * (ou descrição técnica vazia)';
            return state.omie_publicado_em
              ? '🔄 Republicar — substitui o PDF já anexado no Omie'
              : '✅ Publicar ficha como anexo no Omie';
          })()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
          {state.omie_publicado_em ? 'Republicar no Omie' : 'Publicar no Omie'}
        </button>
        {state.omie_publicado_em && (
          <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
            Publicado no Omie em {window.FTStore.fmtDateTime(state.omie_publicado_em)}
          </span>
        )}
      </div>

      <div className="ft-gen-body">
        <FtSidebar cats={state.cats} search={search} setSearch={setSearch}
          onToggle={toggleField}
          onAddField={(catId) => setModal({ tipo: 'field', catId })}
          onAddCategory={() => setModal({ tipo: 'cat' })}
          onTemplate={aplicarTemplate}
          onRemoveCategory={removeCategory}
          onRemoveField={removeFieldDef}/>
        <div className="ft-work">
          <FtEditor state={state} onIdent={setIdent} onValue={setValue} onRemove={removeField}
            onMedia={onMedia} onAddField={(catId) => setModal({ tipo: 'field', catId })}
            onNCMField={(k, v) => setState((s) => ({ ...s, [k]: v }))}
            uploadingSlot={uploadingSlot}/>
        </div>
        <div className="ft-previewcol">
          <div className="ft-preview-head"><span>Pré-visualização</span><em>compila só o preenchido</em></div>
          <div className="ft-preview-wrap" ref={previewWrap}>
            <div className="ft-preview-scaler" style={{ zoom: scale }}><FtFicha state={state}/></div>
          </div>
        </div>
      </div>

      {modal && modal.tipo === 'field' && (
        <FtAddFieldModal catNome={state.cats.find((c) => c.id === modal.catId)?.nome || ''}
          onAdd={(def) => { if (addField(modal.catId, def)) setModal(null); }}
          onClose={() => setModal(null)}/>
      )}
      {modal && modal.tipo === 'cat' && (
        <FtAddCategoryModal onAdd={addCategory} onClose={() => setModal(null)}/>
      )}

      {/* Copiloto NCM/DUIMP — flutuante, portado pro body pra não ser cortado */}
      {window.FtCopiloto && ReactDOM.createPortal(
        <window.FtCopiloto state={state} setState={setState}/>,
        document.body
      )}

      {overlay && ReactDOM.createPortal(
        <div className="ft-ficha-overlay" onClick={(e) => { if (e.target.classList.contains('ft-ficha-overlay')) setOverlay(false); }}>
          <div className="ft-fo-bar">
            <span>Ficha Técnica — {state.identificacao.nomeProduto}</span>
            <div className="ft-fo-actions">
              <button className="ft-btn primary" onClick={async () => {
                // SALVAR PDF — html2canvas + jsPDF, com paginação real.
                // 1) força 1 coluna nas specs (.ft-pdf-export) — evita partir um
                //    grupo ao meio entre 2 colunas lado a lado na hora de fatiar
                // 2) html2canvas renderiza a ficha inteira (altura livre, sem corte)
                // 3) decide as quebras de página andando bloco a bloco (grupo de
                //    specs, descrição, identificação) — nunca corta um bloco ao
                //    meio, só entre eles. 1 página se couber, 2, 3… se não couber,
                //    sem perder conteúdo e sem órfãos.
                if (!window.html2canvas || !window.jspdf) {
                  alert('Biblioteca PDF ainda carregando…'); return;
                }
                const fichaEl = document.querySelector('.ft-ficha-overlay .ft-ficha');
                if (!fichaEl) return;
                const ori = fichaEl.getAttribute('data-orientation') || 'landscape';
                const safeName = (state.identificacao.nomeProduto || 'ficha-tecnica')
                  .normalize('NFD').replace(/[̀-ͯ]/g, '')
                  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
                fichaEl.classList.add('ft-pdf-export');
                try {
                  // aguarda o reflow da mudança pra 1 coluna antes de capturar
                  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                  const canvas = await window.html2canvas(fichaEl, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                  });
                  const { jsPDF } = window.jspdf;
                  const pdf = new jsPDF({
                    unit: 'mm',
                    format: 'a4',
                    orientation: ori,
                    compress: true,
                  });
                  const pw = pdf.internal.pageSize.getWidth();
                  const ph = pdf.internal.pageSize.getHeight();
                  const pxPerMm = canvas.width / pw;
                  const pageHeightPx = Math.round(ph * pxPerMm);

                  // blocos "atômicos" — nunca partidos ao meio entre 2 páginas
                  // (grupo de specs inteiro, cada bloco de descrição, a faixa
                  // de identificação). Análogo ao break-inside:avoid do print,
                  // só que aplicado manualmente na fatia do canvas.
                  const fichaBox = fichaEl.getBoundingClientRect();
                  // fichaBox está em pixels CSS (getBoundingClientRect); o canvas
                  // do html2canvas está em pixels de verdade (CSS px × scale) —
                  // precisa desse fator pra converter uma coordenada pra outra,
                  // não o pxPerMm (esse é canvas-px por mm, unidade diferente).
                  const cssToCanvas = canvas.width / fichaBox.width;
                  // Inclui o rodapé (.ft-fz-footer) na lista de blocos protegidos —
                  // sem ele aqui, o trecho depois do último grupo (só o rodapé)
                  // caía num "resto" não coberto por nenhum bloco, fatiado às
                  // cegas mais abaixo — e por arredondamento essa fatia podia sair
                  // com altura zero/negativa e ser descartada inteira, levando
                  // junto o conteúdo que estava logo antes dela (ex.: NCM).
                  const atoms = Array.from(fichaEl.querySelectorAll('.ft-fz-grp, .ft-fz-descterm, .ft-fz-ident, .ft-fz-footer'))
                    .map((el) => {
                      const r = el.getBoundingClientRect();
                      return {
                        top: Math.round((r.top - fichaBox.top) * cssToCanvas),
                        bottom: Math.round((r.bottom - fichaBox.top) * cssToCanvas),
                      };
                    })
                    .filter((a) => a.bottom > 0)
                    .sort((a, b) => a.top - b.top);

                  // decide onde cada página termina andando bloco a bloco, em uma
                  // única passada: se um bloco não cabe no que resta da página
                  // atual, ela fecha bem no topo dele (o bloco inteiro vai pra
                  // próxima) — nunca "às cegas" fora dos limites de um bloco, só
                  // quando o bloco sozinho já é maior que 1 página inteira (raro),
                  // caso em que ele mesmo é fatiado em pedaços fixos até esgotar.
                  const finalCuts = [0];
                  let pageStart = 0;
                  for (const atom of atoms) {
                    if (atom.bottom <= pageStart) continue;
                    if (atom.bottom - pageStart > pageHeightPx) {
                      if (atom.top > pageStart) {
                        finalCuts.push(atom.top);
                        pageStart = atom.top;
                      }
                      while (atom.bottom - pageStart > pageHeightPx) {
                        pageStart += pageHeightPx;
                        finalCuts.push(pageStart);
                      }
                    }
                  }
                  finalCuts.push(canvas.height);

                  // Se a última página sobrar bem curta (ex.: só o rodapé sozinho,
                  // sem nenhum grupo de specs), funde com a página anterior em vez
                  // de desperdiçar 1 página quase em branco — a fatia combinada é
                  // encolhida (mantendo proporção) só o suficiente pra caber.
                  if (finalCuts.length > 2) {
                    const lastH = finalCuts[finalCuts.length - 1] - finalCuts[finalCuts.length - 2];
                    if (lastH < pageHeightPx * 0.25) {
                      finalCuts.splice(finalCuts.length - 2, 1);
                    }
                  }

                  let first = true;
                  for (let i = 1; i < finalCuts.length; i++) {
                    const cursor = finalCuts[i - 1];
                    const cut = finalCuts[i];
                    const sliceH = cut - cursor;
                    if (sliceH <= 0) continue;
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = sliceH;
                    const ctx = sliceCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                    ctx.drawImage(canvas, 0, cursor, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
                    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.97);
                    if (!first) pdf.addPage();
                    first = false;
                    // encolhe proporcionalmente só se a fusão acima deixou a fatia
                    // mais alta que 1 página — nas demais páginas (o caso normal),
                    // naturalH já é <= ph e isso não muda nada.
                    const naturalH = sliceH / pxPerMm;
                    const drawH = Math.min(ph, naturalH);
                    const drawW = pw * (drawH / naturalH);
                    const offsetX = (pw - drawW) / 2;
                    pdf.addImage(sliceData, 'JPEG', offsetX, 0, drawW, drawH, undefined, 'FAST');
                  }
                  pdf.save(`Ficha-${safeName}.pdf`);
                } catch (err) {
                  console.error('PDF error', err);
                  alert('Erro ao gerar PDF: ' + (err.message || err));
                } finally {
                  fichaEl.classList.remove('ft-pdf-export');
                }
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Salvar PDF
              </button>
              <button className="ft-btn dark" onClick={() => {
                // Imprimir/visualizar via navegador. Injeta @page conforme orientação.
                const ficha = document.querySelector('.ft-ficha-overlay .ft-ficha');
                const ori = (ficha && ficha.getAttribute('data-orientation')) || 'landscape';
                let inj = document.getElementById('__ft-print-page');
                if (inj) inj.remove();
                inj = document.createElement('style');
                inj.id = '__ft-print-page';
                inj.textContent = '@page { size: A4 ' + ori + '; margin: 0; }';
                document.head.appendChild(inj);
                setTimeout(() => window.print(), 60);
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
                Imprimir
              </button>
              <button className="ft-btn ghost" onClick={() => setOverlay(false)}>Fechar</button>
            </div>
          </div>
          <div className="ft-fo-scroll"><FtFicha state={state}/></div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD — listagem das fichas
   ============================================================ */
function FtDashboard({ onNew, onOpen }) {
  const [fichas, setFichas] = _ftUS([]);
  const [loading, setLoading] = _ftUS(true);
  const [query, setQuery] = _ftUS('');

  const refresh = async () => {
    setLoading(true);
    const list = await window.FTStore.listAll();
    setFichas(list);
    setLoading(false);
  };
  _ftUE(() => { refresh(); }, []);

  const filtered = fichas.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return ((f.numero_documento || '') + ' ' + (f.nome_produto || '') + ' ' + (f.categoria_produto || '') + ' ' + (f.sku || '') + ' ' + (f.codigo_produto || ''))
      .toLowerCase().includes(q);
  });

  const handleDel = async (id, nomeProduto) => {
    const confirmacao = window.prompt(
      `⚠️ ATENÇÃO: Você está prestes a excluir permanentemente a ficha e o produto "${nomeProduto}".\n\nDigite o nome EXATO do produto para confirmar:\n\n${nomeProduto}`
    );
    if (confirmacao !== nomeProduto) {
      if (confirmacao !== null) window.alert('Nome incorreto. Exclusão cancelada.');
      return;
    }
    await window.FTStore.remove(id);
    refresh();
  };

  return (
    <div className="ft-dash">
      <div className="ft-dash-stats">
        <div className="ft-stat">
          <div className="ft-stat-num">{fichas.length}</div>
          <div className="ft-stat-label">Fichas totais</div>
        </div>
        <div className="ft-stat">
          <div className="ft-stat-num">{new Set(fichas.map((f) => f.categoria_produto).filter(Boolean)).size}</div>
          <div className="ft-stat-label">Categorias distintas</div>
        </div>
        <div className="ft-stat">
          <div className="ft-stat-num">{fichas.filter((f) => f.produto_id).length}</div>
          <div className="ft-stat-label">Vinculadas no Catálogo</div>
        </div>
      </div>

      <div className="ft-panel">
        <div className="ft-panel-head">
          <h2>Todas as fichas</h2>
          <div className="ft-panel-actions">
            <input className="ft-panel-search" placeholder="Buscar nº, produto, SKU…" value={query} onChange={(e) => setQuery(e.target.value)}/>
            <button className="ft-btn primary" onClick={onNew}>+ Nova ficha</button>
          </div>
        </div>
        {loading ? (
          <div className="ft-empty-row">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="ft-empty-row">Nenhuma ficha {query ? 'que combine com a busca' : 'ainda'}. Crie a primeira.</div>
        ) : (
          <table className="ft-table">
            <thead>
              <tr><th>Ficha</th><th>Produto</th><th>Categoria</th><th>SKU</th><th>Criada</th><th style={{textAlign:'right'}}>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id}>
                  <td><div className="ft-cell-num">{f.numero_documento}</div></td>
                  <td><div className="ft-cell-prod">{f.nome_produto}</div><div className="ft-cell-sub">{f.descricao_comercial || '—'}</div></td>
                  <td>{f.categoria_produto || '—'}</td>
                  <td className="ft-cell-mono">{f.sku || f.codigo_produto || '—'}</td>
                  <td className="ft-cell-time">{window.FTStore.relative(f.criado_em)}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="ft-mini-btn" onClick={() => onOpen(f)}>Abrir</button>
                    <button className="ft-mini-btn ft-mini-btn--danger" onClick={() => handleDel(f.id, f.nome_produto)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PAGE — abas Painel / Nova ficha
   ============================================================ */
function FichaTecnicaPage() {
  const [view, setView] = _ftUS('painel'); // painel | nova
  const [initial, setInitial] = _ftUS(null);
  const [libReady, setLibReady] = _ftUS(false);

  /* Carrega a biblioteca persistente (categorias + campos customizados)
     no boot da página. Toda ficha criada depois disso vê os extras
     já mesclados com as 9 categorias pré-prontas. */
  _ftUE(() => {
    let alive = true;
    (async () => {
      try {
        const extras = await window.FTStore.loadLibrary();
        if (!alive) return;
        window.FT.setLibraryExtras(extras);
      } catch (e) {
        console.warn('[FTPage] loadLibrary failed', e);
      } finally {
        if (alive) setLibReady(true);
      }
      /* Deep-link: lápis do Catálogo pediu pra abrir uma ficha direto no editor */
      try {
        const pendId = sessionStorage.getItem('vpprd_ft_open');
        if (pendId && alive) {
          sessionStorage.removeItem('vpprd_ft_open');
          const ficha = await window.FTStore.getById(pendId);
          if (ficha && alive) handleOpen(ficha);
        }
      } catch (e) { console.warn('[FTPage] deep-link open failed', e); }
    })();
    return () => { alive = false; };
  }, []);

  const handleOpen = (ficha) => {
    setInitial({
      __id: ficha.id,
      identificacao: ficha.identificacao || {},
      cats: ficha.cats || window.FT.freshCats(),
      midia: ficha.midia || { desenho: null, foto: null },
      /* Classificação fiscal NCM/DUIMP — restaura o que o usuário preencheu
         e a decisão da IA (antes voltava limpo ao reabrir a ficha) */
      insumo: ficha.insumo || '',
      funcao_aplicacao: ficha.funcao_aplicacao || '',
      eh_parte_de: ficha.eh_parte_de || '',
      forma_estado: ficha.forma_estado || '',
      ncm_recomendado: ficha.ncm_recomendado || '',
      ncm_descricao: ficha.ncm_descricao || '',
      descricao_duimp: ficha.descricao_duimp || '',
      omie_publicado_em: ficha.omie_publicado_em || null,
    });
    setView('nova');
  };

  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <div className="ci-page-titles">
          <div className="ci-page-kicker">ENGENHARIA · FICHA TÉCNICA</div>
          <h1 className="ci-page-title">FICHA TÉCNICA</h1>
          <p className="ci-page-sub">Gerador universal de fichas técnicas · cria automaticamente uma entrada no Catálogo de Produtos</p>
        </div>
        <div className="ci-page-actions-wrap">
          <div className="ci-page-actions">
            <button className={'ci-tab' + (view === 'painel' ? ' on' : '')} onClick={() => { setView('painel'); setInitial(null); }}>▦ Painel</button>
            <button className={'ci-tab' + (view === 'nova' ? ' on' : '')} onClick={() => { setView('nova'); setInitial(null); }}>+ Nova ficha</button>
          </div>
        </div>
      </div>
      <div className="ci-page-body">
        {view === 'painel'
          ? <FtDashboard onNew={() => { setInitial(null); setView('nova'); }} onOpen={handleOpen}/>
          : <FtGenerator initial={initial} onSaved={() => { setView('painel'); setInitial(null); }} onCancel={() => { setView('painel'); setInitial(null); }}/>}
      </div>
    </div>
  );
}

window.FichaTecnicaPage = FichaTecnicaPage;
