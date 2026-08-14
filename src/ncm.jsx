/* ============================================================
   ncm.jsx — Módulo NCM / Ficha Técnica
   - Stepper de status
   - Aba de detalhe (5 blocos)
   - Catálogo de Produtos
   - Kanban de solicitações
   - Modal LogComex
   - Widget no dashboard
   ============================================================ */

const NCM_STATUS_FLOW = [
  { key: "NAO_INICIADO",      label: "Não iniciado",        desc: "Aguarda preenchimento técnico" },
  { key: "EM_PREENCHIMENTO",  label: "Em preenchimento",    desc: "Engenharia descrevendo o produto e selecionando o NCM" },
  { key: "AGUARD_JURIDICO",   label: "Aguard. jurídico",    desc: "Aguardando validação do código NCM pelo jurídico" },
  { key: "APROVADO",          label: "Aprovado",            desc: "Validado pelo jurídico · pronto para cadastro no LogComex" },
  { key: "CADASTRADO",        label: "Cadastrado Siscomex", desc: "Produto ativo · disponível para uso em Duimp" },
];

function statusIndex(s) {
  const i = NCM_STATUS_FLOW.findIndex(x => x.key === s);
  return i < 0 ? 0 : i;
}

/* ============================================================
   STEPPER
   ============================================================ */
function NCMStepper({ status }) {
  const curr = statusIndex(status);
  return (
    <div className="ncm-stepper">
      {NCM_STATUS_FLOW.map((s, i) => (
        <div key={s.key} className={"ncm-step " + (i < curr ? "done" : i === curr ? "current" : "")}>
          <div className="ncm-step__node">
            {i < curr ? <Icon.check size={12}/> : String(i + 1)}
          </div>
          <div className="ncm-step__lbl">{s.label}</div>
        </div>
      ))}
      <div className="ncm-stepper__desc">
        <b style={{ color: "var(--fg1)" }}>Etapa {curr + 1}/{NCM_STATUS_FLOW.length}:</b>{" "}
        {NCM_STATUS_FLOW[curr].desc}
      </div>
    </div>
  );
}

/* ============================================================
   NCMTab — Aba no detalhe de Engenharia
   ============================================================ */
function NCMTab({ productId, onOpenLogComex }) {
  const N = window.__VP_NCM;
  const produtos = N && Array.isArray(N.produtos) ? N.produtos : [];
  const original = produtos.length
    ? (productId
        ? produtos.find(p => String(p.id) === String(productId))
        : produtos.find(p => p.status === "EM_PREENCHIMENTO"))
    : null;
  const [data, setData] = React.useState(() => original || produtos[0] || {});

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const setAttr = (k, v) => setData(d => ({ ...d, atributos: { ...d.atributos, [k]: v } }));

  if (!N || !N.produtos || !data.status) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Carregando dados NCM…</div>;
  }

  const ncmInfo = data.ncm ? (N.ncmCatalog || []).find(c => c.code === data.ncm) : null;
  const attrs = data.ncm && N.attributesByNcm && N.attributesByNcm[data.ncm] ? N.attributesByNcm[data.ncm] : [];

  const denomLen = (data.denominacao || "").length;
  const detLen = (data.detalhamento || "").length;

  const readonly = data.status === "AGUARD_JURIDICO" || data.status === "CADASTRADO";

  return (
    <div className="fade-in">
      <NCMStepper status={data.status}/>

      {data.status === "CADASTRADO" ? (
        <div className="ncm-alert success">
          <Icon.check className="ncm-alert__icon" size={18}/>
          <div style={{ flex: 1 }}>
            <div className="ncm-alert__title">Produto cadastrado no Siscomex</div>
            <div>Código <b className="mono">{data.siscomex}</b> · Versão <b className="mono">{data.versao}</b> · Situação <b>ATIVO</b> · cadastrado por <b>{data.cadastradoPor}</b> em {data.cadastradoEm}</div>
          </div>
        </div>
      ) : null}

      {/* BLOCO 2 — Identificação para Receita Federal */}
      <NCMSection lbl="Identificação para o Catálogo da Receita Federal" sub={data.id}>
        <div className="ncm-field" style={{ marginBottom: 16 }}>
          <div className="pe-field-label">
            Denominação do produto <span className="pe-req">*</span>
            <span className="pe-tag" title="Máximo 100 caracteres. Descreva em português, sem abreviações.">ⓘ</span>
          </div>
          <textarea className="pe-input"
            rows={2}
            disabled={readonly}
            maxLength={100}
            value={data.denominacao || ""}
            onChange={(e) => set("denominacao", e.target.value)}
            placeholder="Ex: Elevador elétrico de tração, uso comercial, capacidade 630 kg, 8 paradas"/>
          <span className={"ncm-counter " + (denomLen > 90 ? "danger" : denomLen > 75 ? "warn" : "")}>{denomLen}/100</span>
        </div>

        <div className="pe-grid cols-2-1" style={{ marginBottom: 12 }}>
          <PEField label="Descrição do NCM">
            <input className="pe-input" readOnly disabled value={ncmInfo ? ncmInfo.desc : ""} placeholder="Selecione um código NCM →"/>
          </PEField>
          <PEField label="Código NCM" required>
            <NCMTypeahead value={data.ncm || ""} onChange={(c) => set("ncm", c)} disabled={readonly || data.status === "APROVADO"}/>
          </PEField>
        </div>

        {data.ncm && data.status === "EM_PREENCHIMENTO" ? (
          <div className="ncm-alert">
            <Icon.warning className="ncm-alert__icon" size={18}/>
            <div>
              <div className="ncm-alert__title">ATENÇÃO: O código NCM não pode ser alterado após o envio ao Catálogo da Receita Federal</div>
              <div>Em caso de erro, o produto deverá ser <b>desativado</b> e um novo cadastrado. Confirme com o jurídico antes de avançar.</div>
            </div>
          </div>
        ) : null}

        <div className="ncm-field" style={{ marginTop: 14 }}>
          <div className="pe-field-label">Detalhamento complementar do produto</div>
          <textarea className="pe-input"
            rows={5}
            disabled={readonly}
            maxLength={3700}
            value={data.detalhamento || ""}
            onChange={(e) => set("detalhamento", e.target.value)}
            placeholder="Descreva: tipo de acionamento, potência (kW), velocidade (m/s), capacidade (kg), número de paradas, tensão, tipo de cabine, normas ABNT/EN. Não repita a Denominação."/>
          <span className={"ncm-counter " + (detLen > 3500 ? "danger" : detLen > 3000 ? "warn" : "")}>{detLen}/3700</span>
        </div>

        {attrs.length > 0 ? (
          <div className="ncm-attrs">
            <div className="ncm-attrs__title">Atributos técnicos da NCM {data.ncm}</div>
            <div className="pe-grid cols-2">
              {attrs.map(a => (
                <NCMAttrField key={a.key} attr={a} value={data.atributos[a.key]} onChange={(v) => setAttr(a.key, v)} disabled={readonly}/>
              ))}
            </div>
          </div>
        ) : null}
      </NCMSection>

      {/* BLOCO 3 — Fabricante */}
      <NCMSection lbl="Fabricante / Produtor Estrangeiro">
        <NCMFabricante value={data.fabricante} onChange={(v) => set("fabricante", v)} disabled={readonly}/>
      </NCMSection>

      {/* BLOCO 4 — Ficha técnica e imagens */}
      <NCMSection lbl="Ficha Técnica e Imagens" sub="O time de importação fará o download para envio à Receita Federal">
        <NCMImageSlots filled={data.imagens} onAdd={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true; inp.onchange = e => { const files = Array.from(e.target.files||[]); if (files.length) window.toast(`${files.length} imagem(ns) selecionada(s) — pré-visualização; o anexo definitivo é feito no fluxo de importação.`, 'info'); }; inp.click(); }} onView={() => window.print()}/>
        <div style={{ height: 16 }}/>
        <NCMPdfZone fileName={data.fichaPdf}/>
        <div className="row sb" style={{ marginTop: 14 }}>
          <span className="small muted">O download em lote (.zip) das imagens/ficha é feito pelo time de Importação no fluxo de envio à Receita Federal.</span>
        </div>
      </NCMSection>

      {/* BLOCO 5 — Action bar */}
      <NCMActionBar status={data.status} onChange={set}
        onOpenLogComex={onOpenLogComex}
        produto={data}/>
    </div>
  );
}

function NCMSection({ lbl, sub, children }) {
  return (
    <div className="ncm-sect">
      <div className="ncm-sect__head">
        <span className="ncm-sect__lbl">{lbl}</span>
        {sub ? <span className="ncm-sect__sub">{sub}</span> : null}
      </div>
      <div className="ncm-sect__body">{children}</div>
    </div>
  );
}

/* ============================================================
   NCMTypeahead — busca de código NCM
   ============================================================ */
function NCMTypeahead({ value, onChange, disabled }) {
  const N = window.__VP_NCM;
  const [q, setQ] = React.useState(value || "");
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setQ(value || ""), [value]);

  const filtered = q.length >= 2
    ? N.ncmCatalog.filter(c => c.code.includes(q) || c.desc.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="ncm-typeahead">
      <input className="pe-input mono"
        type="text"
        value={q}
        disabled={disabled}
        placeholder="Digite 3+ dígitos..."
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}/>
      {open && filtered.length > 0 ? (
        <div className="ncm-typeahead__list">
          {filtered.map(c => (
            <div key={c.code} className="ncm-typeahead__item"
              onMouseDown={() => { onChange(c.code); setQ(c.code); setOpen(false); }}>
              <span className="ncm-typeahead__code">{c.code}</span>
              <span className="ncm-typeahead__desc">{c.desc}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   NCMAttrField — campo dinâmico por tipo
   ============================================================ */
function NCMAttrField({ attr, value, onChange, disabled }) {
  if (attr.type === "select") {
    return (
      <PEField label={attr.label} required={attr.required}>
        <PESelect value={value || ""} onChange={onChange} options={attr.options} placeholder="Selecione..."/>
      </PEField>
    );
  }
  if (attr.type === "radio") {
    return (
      <PEField label={attr.label} required={attr.required}>
        <div className="ncm-radio-group">
          {attr.options.map(o => (
            <button key={o} type="button"
              className={value === o ? "is-active" : ""}
              disabled={disabled}
              onClick={() => onChange(o)}>{o}</button>
          ))}
        </div>
      </PEField>
    );
  }
  if (attr.type === "toggle") {
    const on = !!value;
    return (
      <PEField label={attr.label} required={attr.required}>
        <div className={"ncm-toggle " + (on ? "on" : "")} onClick={() => !disabled && onChange(!on)}>
          <div className="ncm-toggle__track"><div className="ncm-toggle__thumb"/></div>
          <span className="ncm-toggle__lbl">{on ? "Sim" : "Não"}</span>
        </div>
      </PEField>
    );
  }
  return (
    <PEField label={attr.label} required={attr.required}>
      <div className={"pe-input-grp " + (attr.suffix ? "has-suffix" : "")}>
        <input className="pe-input" type="number" step={attr.type === "decimal" ? "0.1" : "1"}
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attr.placeholder || "0"}/>
        {attr.suffix ? <span className="pe-input-suffix">{attr.suffix}</span> : null}
      </div>
    </PEField>
  );
}

/* ============================================================
   NCMFabricante — busca e exibição do operador estrangeiro
   ============================================================ */
function NCMFabricante({ value, onChange, disabled }) {
  const N = window.__VP_NCM;
  const fab = value ? N.fabricantes.find(f => f.id === value) : null;
  const [search, setSearch] = React.useState("");

  if (fab) {
    return (
      <>
        <div className="ncm-fab-found">
          <Icon.check size={16}/>
          <span style={{ fontWeight: 700 }}>{fab.flag} {fab.nome}</span>
          <Badge variant="success" dot>já cadastrado</Badge>
          {!disabled ? <Button variant="ghost" size="sm" onClick={() => onChange("")}>Trocar</Button> : null}
        </div>
        <div className="pe-grid cols-3">
          <PEField label="País de origem" tag="não retificável">
            <input className="pe-input" value={`${fab.flag} ${fab.pais}`} readOnly disabled/>
          </PEField>
          <PEField label="TIN" tag="identificação fiscal">
            <input className="pe-input mono" value={fab.tin} readOnly disabled/>
          </PEField>
          <PEField label="Código interno">
            <input className="pe-input mono" value={fab.codigoInterno} readOnly disabled/>
          </PEField>
          <PEField label="Logradouro" span="2">
            <input className="pe-input" value={fab.logradouro} readOnly disabled/>
          </PEField>
          <PEField label="Cidade">
            <input className="pe-input" value={fab.cidade} readOnly disabled/>
          </PEField>
          <PEField label="Subdivisão">
            <input className="pe-input" value={fab.subdivisao} readOnly disabled/>
          </PEField>
          <PEField label="CEP / Código postal">
            <input className="pe-input mono" value={fab.cep} readOnly disabled/>
          </PEField>
          <PEField label="E-mail">
            <input className="pe-input mono" value={fab.email} readOnly disabled/>
          </PEField>
        </div>
        <div className="ncm-alert info" style={{ marginTop: 14 }}>
          <Icon.info className="ncm-alert__icon" size={18}/>
          <div>O <b>País do Operador Estrangeiro</b> também não pode ser alterado após o cadastro.</div>
        </div>
      </>
    );
  }

  const filtered = search.length >= 1
    ? N.fabricantes.filter(f => f.nome.toLowerCase().includes(search.toLowerCase()))
    : N.fabricantes;

  return (
    <>
      <div className="ncm-fab-search">
        <div className="pe-input-grp" style={{ flex: 1 }}>
          <span className="pe-input-prefix"><Icon.search size={12}/></span>
          <input className="pe-input" placeholder="Buscar fabricante já cadastrado..."
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }}/>
        </div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => window.open('mailto:ti@verticalparts.com.br?subject=Novo%20Fabricante%20NCM&body=Nome%3A%0ACidade%3A%0APA%C3%8DS%3A%0ATIN%3A%0AEmail%3A', '_blank')}>Novo Fabricante</Button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {filtered.map(f => (
          <div key={f.id}
            style={{ padding: 12, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => onChange(f.id)}>
            <div style={{ width: 40, height: 40, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{f.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
              <div className="cell-sub">{f.cidade} · {f.subdivisao} · TIN: <span className="mono">{f.tin}</span></div>
            </div>
            <Icon.chevRight size={16} color="var(--fg3)"/>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="empty"><h4>Nenhum fabricante encontrado</h4><p>Cadastre um novo no botão acima.</p></div>
        ) : null}
      </div>
    </>
  );
}

/* ============================================================
   NCMImageSlots e PdfZone
   ============================================================ */
function NCMImageSlots({ filled, onAdd, onView }) {
  return (
    <div className="ncm-slots">
      {Array.from({ length: 5 }, (_, i) => {
        const has = i < filled;
        return (
          <div key={i} className={"ncm-slot " + (has ? "filled" : "")}
            onClick={() => has ? null : onAdd?.()}>
            {has ? (
              <>
                <div className="ncm-slot__thumb"/>
                <div className="ncm-slot__check"><Icon.check size={10}/></div>
                <div className="ncm-slot__thumb-label">img_{String(i + 1).padStart(2, "0")}.jpg</div>
                <div className="ncm-slot__overlay">
                  <button onClick={onView}><Icon.eye size={10}/> Ver</button>
                </div>
              </>
            ) : (
              <>
                <div className="ncm-slot__icon"><Icon.upload size={28}/></div>
                <div className="ncm-slot__lbl">Imagem {i + 1}</div>
                <div className="ncm-slot__add">+ Adicionar</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NCMPdfZone({ fileName }) {
  if (fileName) {
    return (
      <div className="ncm-pdf-zone filled">
        <div className="ncm-pdf-zone__icon"><Icon.fileText size={20}/></div>
        <div style={{ flex: 1 }}>
          <div className="ncm-pdf-zone__title">{fileName}</div>
          <div className="ncm-pdf-zone__sub">PDF · 482 kb · enviado há 3d</div>
        </div>
        <Button variant="ghost" size="sm" icon="eye" data-tip="Visualizar" onClick={() => window.print()}/>
      </div>
    );
  }
  return (
    <div className="ncm-pdf-zone" onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.pdf'; inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.toast(`"${f.name}" selecionado — pré-visualização; o anexo definitivo é feito no fluxo de importação.`, 'info'); }; inp.click(); }}>
      <div className="ncm-pdf-zone__icon"><Icon.fileText size={20}/></div>
      <div style={{ flex: 1 }}>
        <div className="ncm-pdf-zone__title">Ficha Técnica do Fabricante (PDF)</div>
        <div className="ncm-pdf-zone__sub">Arraste o arquivo aqui ou clique em Anexar · Formatos: PDF · Máx 20MB</div>
      </div>
      <Button variant="outline" size="sm" icon="upload">Anexar</Button>
    </div>
  );
}

/* ============================================================
   ActionBar — botões conforme status
   ============================================================ */
function NCMActionBar({ status, onChange, onOpenLogComex, produto }) {
  if (status === "CADASTRADO") {
    return (
      <div className="ncm-actionbar">
        <span className="row gap-2"><Icon.shield size={14} color="var(--vp-success)"/><b>Produto ativo no Siscomex</b> · disponível para uso em Duimp</span>
      </div>
    );
  }
  if (status === "APROVADO") {
    return (
      <>
        <div className="ncm-alert success">
          <Icon.check className="ncm-alert__icon" size={18}/>
          <div>
            <div className="ncm-alert__title">Aprovado pelo Jurídico</div>
            <div>Marina Aragão · 19/mai 14:30 · NCM validado, pronto para cadastro no LogComex</div>
          </div>
        </div>
        <div className="ncm-actionbar">
          <div className="spacer" style={{ flex: 1 }}/>
          <Button variant="secondary" size="sm" icon="externalLink" onClick={onOpenLogComex}>Exportar para LogComex →</Button>
          <Button variant="primary" size="sm" icon="check" onClick={() => { onChange("status", "CADASTRADO"); window.toast("Produto marcado como cadastrado no Siscomex", "success"); }}>Marcar como cadastrado</Button>
        </div>
      </>
    );
  }
  if (status === "AGUARD_JURIDICO") {
    return (
      <div className="ncm-actionbar">
        <Badge variant="info" dot>Aguardando aprovação jurídica…</Badge>
        <span className="small muted">Marina Aragão · enviado há 2 dias</span>
        <div className="spacer" style={{ flex: 1 }}/>
        <Button variant="outline" size="sm" icon="chevLeft" onClick={() => { onChange("status", "EM_PREENCHIMENTO"); window.toast("Devolvido para edição da Engenharia", "info"); }}>Editar — solicitar devolução</Button>
      </div>
    );
  }
  // EM_PREENCHIMENTO or NAO_INICIADO
  return (
    <div className="ncm-actionbar">
      <div className="spacer" style={{ flex: 1 }}/>
      <Button variant="primary" size="sm" iconRight="arrowRight"
        disabled={!produto.ncm || !produto.denominacao || produto.denominacao.length < 10}
        onClick={() => {
          if (confirm(`Enviar Ficha Técnica para Revisão Jurídica?\n\nProduto: ${produto.denominacao}\nNCM: ${produto.ncm} — ${produto.ncmDesc || ""}\n\n⚠ Após o envio, o NCM não poderá ser alterado por Engenharia.`)) {
            onChange("status", "AGUARD_JURIDICO");
            window.toast("Enviado para validação do jurídico", "success");
          }
        }}>
        Enviar para revisão Jurídica
      </Button>
    </div>
  );
}

Object.assign(window, { NCMTab, NCMStepper, NCM_STATUS_FLOW, statusIndex });
