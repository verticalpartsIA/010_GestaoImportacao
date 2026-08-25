/* ============================================================
   contrato-venda-preview.jsx
   Renderiza o documento do Contrato de Venda de Equipamentos.
   Compartilhado entre app (vpprd) e assinar.html (público).
   ============================================================ */

function CV_DocItem({ item }) {
  /* tabela de parcelas */
  if (item.table) {
    const tab = item.table || [];
    const total = tab.reduce((s, t) => s + (t.valor || 0), 0);
    return (
      <table className="cv-doc-table">
        <thead>
          <tr><th>#</th><th>Quando</th><th>%</th><th style={{textAlign:'right'}}>Valor</th></tr>
        </thead>
        <tbody>
          {tab.map((t, i) => (
            <tr key={i}>
              <td>{t.label}</td>
              <td>{t.quando}</td>
              <td className="cv-mono">{(t.pct || 0).toFixed(2).replace('.',',')}%</td>
              <td className="cv-mono" style={{textAlign:'right'}}>{window.CV.brl(t.valor || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan="3"><b>Total</b></td><td className="cv-mono" style={{textAlign:'right'}}><b>{window.CV.brl(total)}</b></td></tr>
        </tfoot>
      </table>
    );
  }
  /* tabela simples de 2 colunas — Anexo I / Anexo II (cláusula 1.1.1) */
  if (item.anexos) {
    return (
      <table className="cv-doc-anexos">
        <thead><tr><th colSpan="2">Títulos dos Anexos</th></tr></thead>
        <tbody>
          {item.anexos.map((row, i) => <tr key={i}><td>{row[0]}</td><td>{row[1]}</td></tr>)}
        </tbody>
      </table>
    );
  }
  const cls = ['cv-doc-p'];
  if (item.li) cls.push('cv-doc-li');
  if (item.indent) cls.push('cv-doc-indent');
  if (item.callout) cls.push('cv-doc-callout');
  if (item.center) cls.push('cv-doc-center');
  if (item.sign) cls.push('cv-doc-sign-line');
  if (item.injected) cls.push('cv-doc-injected');
  if (item.html) {
    return (
      <p className={cls.join(' ')}>
        {item.tag && <span className="cv-doc-tag">{item.tag}</span>}
        <span dangerouslySetInnerHTML={{ __html: item.text }}/>
      </p>
    );
  }
  return <p className={cls.join(' ')}>{item.text}</p>;
}

/* Bloco final de assinaturas (VENDEDORA / COMPRADOR) — 2 colunas com linha
   "X" acima do nome e CPF, igual à minuta oficial. */
function CV_SignBlock({ doc }) {
  const a = (doc && doc.assinatura) || {};
  const vend = a.vendedora || {};
  const comp = a.comprador || {};
  return (
    <div className="cv-doc-signatures">
      <div className="cv-doc-sign-col">
        <div className="cv-doc-sign-role">VENDEDORA<br/>VERTICALPARTS</div>
        <div className="cv-doc-sign-x">X</div>
        <div className="cv-doc-sign-line2"></div>
        <div className="cv-doc-sign-name">{vend.nome}</div>
        <div className="cv-doc-sign-cpf">CPF: {vend.cpf}</div>
      </div>
      <div className="cv-doc-sign-col">
        <div className="cv-doc-sign-role">COMPRADOR<br/>{comp.razaoLabel} LTDA.</div>
        <div className="cv-doc-sign-x">X</div>
        <div className="cv-doc-sign-line2"></div>
        <div className="cv-doc-sign-name">NOME: {comp.nome || ''}</div>
        <div className="cv-doc-sign-cpf">CPF: {comp.cpf || ''}</div>
      </div>
    </div>
  );
}

/* Página final — testemunhas (2 linhas em branco, mesma estrutura da minuta) */
function CV_Witnesses() {
  return (
    <div className="cv-doc-witnesses">
      <h2 className="cv-doc-section-title">TESTEMUNHAS:</h2>
      <div className="cv-doc-witness-row">
        <div className="cv-doc-witness-col">
          <div className="cv-doc-witness-line">1. _________________________</div>
          <div>Nome:</div>
          <div>CPF:</div>
        </div>
        <div className="cv-doc-witness-col">
          <div className="cv-doc-witness-line">2. _________________________</div>
          <div>Nome:</div>
          <div>CPF:</div>
        </div>
      </div>
    </div>
  );
}

/* Rodapé de contato — mesmo bloco que aparece em todas as páginas da
   minuta oficial. Aqui aparece 1x, ao final do documento (a repetição
   física por página impressa exigiria autoria em páginas A4 fixas, como
   foi feito na Proposta — ver nota na revisão). */
function CV_Foot() {
  return (
    <div className="cv-doc-foot">
      <span>Rua Armandina Braga de Almeida, 383 · Jardim Santa Emilia · Guarulhos/SP · CEP 07141-003</span>
      <span>+55 11 2528-6473 · +55 11 2528-6479 · +55 11 94460-6396</span>
      <span>contato@verticalparts.com.br · comercial@verticalparts.com.br</span>
    </div>
  );
}

function CVContractPreview({ doc, highlightInjected }) {
  if (!doc) return null;
  return (
    <div className="cv-doc-sheet" id="cv-contract-doc">
      <div className="cv-doc-head">
        <img className="cv-doc-logo" src="/assets/logo-verticalparts-color.png" alt="VerticalParts"/>
        <div className="cv-doc-meta">
          <span className="cv-doc-meta-label">Nº do Contrato</span>
          <span className="cv-doc-meta-num">{doc.numero}</span>
        </div>
      </div>
      <h1 className="cv-doc-title">{doc.titulo || 'CONTRATO DE COMPRA E VENDA DE EQUIPAMENTO'}</h1>

      {doc.sections.map((sec) => (
        <section key={sec.id} className={'cv-doc-section' + (sec.kind === 'preamble' ? ' cv-doc-preamble' : '')}>
          {sec.num && (
            <h2 className="cv-doc-section-title">
              <span className="cv-doc-section-num">{sec.num}.</span> {sec.title}
            </h2>
          )}
          {sec.body.map((it, j) => <CV_DocItem key={j} item={it}/>)}
        </section>
      ))}

      <CV_SignBlock doc={doc}/>
      <CV_Witnesses/>
      <CV_Foot/>
    </div>
  );
}

window.CVContractPreview = CVContractPreview;
