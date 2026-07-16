/* ============================================================
   contrato-instalador-preview.jsx
   Renderiza o documento (A4) a partir do model do engine.
   Componente compartilhado entre o app (vpprd) e a página
   pública de assinatura (assinar.html).
   ============================================================ */

function CI_ClauseItem({ it }) {
  if (it.bank) {
    return (
      <div className="ci-doc-item ci-doc-bank">
        <p><span className="ci-doc-n">{it.n === 'BANK' ? '5.1.3' : it.n}</span>{it.text}</p>
        <div className="ci-doc-bank-grid">
          <div><span>Banco</span><b>{it.bank.banco}</b></div>
          <div><span>Agência</span><b>{it.bank.ag}</b></div>
          <div><span>Conta</span><b>{it.bank.conta}</b></div>
          <div><span>Chave PIX</span><b>{it.bank.pix}</b></div>
        </div>
      </div>
    );
  }
  return (
    <div className="ci-doc-item">
      <p>{it.n ? <span className="ci-doc-n">{it.n}</span> : null}{it.text}</p>
      {it.list && (
        it.listType === 'alpha'
          ? <ol className="ci-doc-list-alpha">{it.list.map((li, i) => <li key={i}>{li}</li>)}</ol>
          : <ul className="ci-doc-list">{it.list.map((li, i) => <li key={i}>{li}</li>)}</ul>
      )}
    </div>
  );
}

function CIContractPreview({ doc, highlightConditional }) {
  const ct = doc.contratante;
  const cd = doc.contratada;
  return (
    <div className="ci-doc-sheet" id="ci-contract-doc">
      <div className="ci-doc-head">
        <img className="ci-doc-logo" src="assets/logo-black-yellow.png" alt="VerticalParts" />
        <div className="ci-doc-meta">
          <span className="ci-doc-meta-label">Nº do Contrato</span>
          <span className="ci-doc-meta-num">{doc.numero}</span>
        </div>
      </div>

      <h1 className="ci-doc-title">{doc.titulo}</h1>

      <p className="ci-doc-p ci-doc-intro">Pelo presente contrato de prestação de serviços, as partes a seguir nomeadas:</p>

      <p className="ci-doc-p">
        <b>{ct.razaoSocial}</b>, inscrita no CNPJ/MF sob o nº {ct.cnpj}, com sede à {ct.endereco}, neste ato representada por <b>{ct.representante}</b>, {ct.repNacionalidade}, {ct.repEstadoCivil}, {ct.repProfissao}, portador do RG: {ct.repRG} e do CPF: {ct.repCPF}, com escritório no endereço acima mencionado, doravante denominada simplesmente <b>CONTRATANTE</b>
      </p>
      <p className="ci-doc-p ci-doc-e">e,</p>
      <p className="ci-doc-p">
        <b>{cd.razao}</b>, inscrita no CNPJ sob o nº {cd.cnpj}, com sede à {cd.endereco}, neste ato representada nos termos de seu ato constitutivo por <b>{cd.responsavel}</b>, {cd.nacionalidade}, {cd.estadoCivil}, {cd.profissao}, portador da cédula de identidade RG de nº {cd.rg}, inscrito no CPF nº {cd.cpf}, residente e domiciliado na {cd.enderecoResp}, doravante denominada <b>CONTRATADA</b>,
      </p>

      <p className="ci-doc-p">As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços Técnicos Especializados, firmado entre pessoas jurídicas, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente.</p>

      {doc.clauses.map((c) => (
        <section key={c.id} className={'ci-doc-clause' + (c.conditional && highlightConditional ? ' ci-doc-clause--cond' : '')}>
          <h2 className="ci-doc-clause-title">
            CLÁUSULA {c.ord} – {c.titulo}
            {c.conditional && highlightConditional && <span className="ci-doc-cond-tag">Inserida automaticamente</span>}
          </h2>
          {c.items.map((it, j) => <CI_ClauseItem key={j} it={it} />)}
        </section>
      ))}

      <p className="ci-doc-p ci-doc-closing">E por estarem assim justos e contratados, as partes firmam o presente em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.</p>

      <p className="ci-doc-p ci-doc-local">{doc.cidadeAssinatura}, {doc.dataDia} de {doc.dataMes} de {doc.dataAno}.</p>

      <div className="ci-doc-sign-block">
        <div className="ci-doc-sign">
          <span className="ci-doc-sign-role">CONTRATANTE:</span>
          <span className="ci-doc-sign-co">VERTICAL PARTS LTDA.</span>
          <div className="ci-doc-sign-line"></div>
          <span className="ci-doc-sign-name">{doc.contratante.representante}</span>
          <span className="ci-doc-sign-cpf">CPF: {doc.contratante.repCPF}</span>
        </div>
        <div className="ci-doc-sign">
          <span className="ci-doc-sign-role">CONTRATADA:</span>
          <span className="ci-doc-sign-co">{cd.razao}</span>
          <div className="ci-doc-sign-line"></div>
          <span className="ci-doc-sign-name">{cd.responsavel}</span>
          <span className="ci-doc-sign-cpf">CPF: {cd.cpf}</span>
        </div>
      </div>

      <div className="ci-doc-witness">
        <div className="ci-doc-sign">
          <span className="ci-doc-sign-role">TESTEMUNHA 1:</span>
          <div className="ci-doc-sign-line"></div>
          <span className="ci-doc-sign-cpf">Nome: &nbsp; CPF:</span>
        </div>
        <div className="ci-doc-sign">
          <span className="ci-doc-sign-role">TESTEMUNHA 2:</span>
          <div className="ci-doc-sign-line"></div>
          <span className="ci-doc-sign-cpf">Nome: &nbsp; CPF:</span>
        </div>
      </div>
    </div>
  );
}

window.CIContractPreview = CIContractPreview;
window.CI_ClauseItem = CI_ClauseItem;
