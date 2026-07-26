/* ============================================================
   proposta-preview.jsx — Live PDF preview pages (right column)
   Mirrors filled-in data; uses real uploaded covers.
   Cada página (.pe__pdf) é desenhada num tamanho "de projeto" fixo
   (380px de largura, fontes de ~7-8px) — é a base que faz o conteúdo
   caber certinho. Pra ficar grande e legível (na coluna lateral OU no
   overlay "Gerar PDF"), a página inteira é ampliada via `zoom` (que
   escala texto e espaço na mesma proporção); NÃO esticamos só a
   largura da caixa, porque aí o texto fica pequeno dentro de uma
   caixa maior e sobra um vão em branco embaixo do conteúdo.
   ============================================================ */

function PEPreview({ data, eq, overlay }) {
  const eqLabel = eq === "elevador" ? "elevador" : eq === "escada" ? "escada" : "esteira";
  const eqName = eq === "elevador" ? "Elevador" : eq === "escada" ? "Escada Rolante" : "Esteira Rolante";
  const ed = data[eq];
  // Só o Elevador tem a página de Acabamentos — a contagem acompanha.
  const totalPaginas = eqLabel === "elevador" ? 7 : 6;

  const previewWrap = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = previewWrap.current; if (!el) return;
    // Overlay tem bem mais espaço que a coluna lateral — o teto de zoom é
    // maior (3.2) pra aproveitar isso em vez de ficar do mesmo tamanho.
    const max = overlay ? 3.2 : 2.2;
    const ro = new ResizeObserver(() => setScale(Math.max(0.5, Math.min(max, (el.clientWidth - 28) / 380))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay]);

  const pages = (
    <>
      {/* Page 1: Capa */}
      <PreviewCapa data={data} eq={eqLabel} pg={1} total={totalPaginas}/>

      {/* Page 2: Cliente + Obra */}
      <PreviewClienteObra data={data} eq={eqLabel} pg={2} total={totalPaginas}/>

      {/* Page 3: Texto da Proposta */}
      <PreviewTexto data={data} eq={eqLabel} eqName={eqName} pg={3} total={totalPaginas}/>

      {/* Page 4: Descrição + Especificações */}
      <PreviewDescricaoEspec data={data} eq={eqLabel} pg={4} total={totalPaginas}/>

      {eqLabel === "elevador" && <PreviewAcabamentos data={data} pg={5} total={totalPaginas}/>}

      {/* Page final: Valores */}
      <PreviewValores data={data} eq={eqLabel} pg={eqLabel === "elevador" ? 6 : 5} total={totalPaginas}/>

      {/* Garantia */}
      <PreviewGarantia data={data} eq={eqLabel} pg={eqLabel === "elevador" ? 7 : 6} total={totalPaginas}/>
    </>
  );

  const scaled = (
    <div className="pe__preview-wrap" ref={previewWrap}>
      <div className="pe__preview-scaler" style={{ zoom: scale }}>
        <div className={"pe__preview-pages" + (overlay ? " pe__preview-pages--overlay" : "")} data-total={totalPaginas}>{pages}</div>
      </div>
    </div>
  );

  if (overlay) return scaled;

  return (
    <div className="pe__preview">
      <div className="pe__preview-head">
        <h4>Preview da Proposta</h4>
        <Badge variant="yellow">{eqName}</Badge>
      </div>
      {scaled}
    </div>
  );
}

function PreviewCapa({ data, eq, pg, total }) {
  const v = data.vendedor;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-capa" data-eq={eq}>
        <div className="pe__pdf-capa-img"/>
        <div className="pe__pdf-capa-body">
          <h1 className="pe__pdf-capa-title">Proposta<br/>Comercial</h1>
          <dl className="pe__pdf-capa-grid">
            <dt>Nº da Proposta</dt>
            <dt>Vendedor</dt>
            <dd>{data.numero || <span style={{ color: "var(--vp-gray-300)" }}>VP-2026-XXX</span>}</dd>
            <dd>{v.nome || <span style={{ color: "var(--vp-gray-300)" }}>—</span>}</dd>
            <dt>Contato</dt>
            <dt>&nbsp;</dt>
            <dd>{v.email || <span style={{ color: "var(--vp-gray-300)" }}>@verticalparts.com.br</span>}</dd>
            <dd>&nbsp;</dd>
          </dl>
          <div className="pe__pdf-capa-foot">
            <span><Icon.message size={6}/> {v.celular || v.fixo || "(11) 2528-6473"}</span>
            <span><Icon.pin size={6}/> Rua Armandina Braga de Almeida, 383</span>
          </div>
        </div>
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewClienteObra({ data, eq, pg, total }) {
  const c = data.cliente, o = data.obra;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Identificação</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Cliente & Obra</div>
        <h2 className="pdf-h2">Identificação</h2>
        <div className="pdf-rule"/>

        <h3 className="pdf-h3">Dados do Cliente</h3>
        <div className="pdf-spec-grid">
          <div><span>Razão Social</span><b>{c.nome || "—"}</b></div>
          <div><span>CNPJ</span><b>{c.cnpj || "—"}</b></div>
          <div><span>A/C</span><b>{c.responsavel || "—"}</b></div>
          <div><span>Telefone</span><b>{c.telefone || "—"}</b></div>
          <div><span>E-mail</span><b>{c.email || "—"}</b></div>
          <div><span>CEP</span><b>{c.cep || "—"}</b></div>
          <div><span>Endereço</span><b>{[c.endereco, c.numero].filter(Boolean).join(", ") || "—"}</b></div>
          <div><span>Bairro / Cidade</span><b>{[c.bairro, c.cidade, c.uf].filter(Boolean).join(" · ") || "—"}</b></div>
        </div>

        <h3 className="pdf-h3">Dados da Obra</h3>
        <div className="pdf-spec-grid">
          <div><span>Empreendimento</span><b>{o.nome || "—"}</b></div>
          <div><span>CEP</span><b>{o.cep || "—"}</b></div>
          <div><span>Endereço</span><b>{[o.endereco, o.numero].filter(Boolean).join(", ") || "—"}</b></div>
          <div><span>Bairro / Cidade / UF</span><b>{[o.bairro, o.cidade, o.uf].filter(Boolean).join(" · ") || "—"}</b></div>
        </div>
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewTexto({ data, eq, eqName, pg, total }) {
  const ed = data[eq];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Apresentação</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Comercial</div>
        <h2 className="pdf-h2">{eqName}</h2>
        <div className="pdf-rule"/>
        {data.dataLinha ? <p style={{ fontWeight: 700, marginBottom: 8 }}>{data.dataLinha}</p> : <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>São Paulo, [data]</p>}
        {ed.textoProposta ? <p>{ed.textoProposta}</p> : <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>O texto da proposta aparecerá aqui conforme preenchimento.</p>}
        <h3 className="pdf-h3">Linha de Modelos</h3>
        {ed.textoModelos ? <p>{ed.textoModelos}</p> : <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>Descreva a linha do produto neste campo.</p>}
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewDescricaoEspec({ data, eq, pg, total }) {
  const ed = data[eq];
  const desc = ed.descricao || [];
  const espec = ed.especificacoes || [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Especificação Técnica</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Produto</div>
        <h2 className="pdf-h2">Especificação Técnica</h2>
        <div className="pdf-rule"/>

        {desc.slice(0, 1).map((d, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <h3 className="pdf-h3">{d.titulo || `Produto ${i + 1}`}</h3>
            {d.linha ? <p style={{ fontWeight: 600 }}>{d.linha}</p> : null}
            {d.desc ? <p>{d.desc}</p> : null}
            {d.beneficios ? <p style={{ whiteSpace: "pre-line" }}>{d.beneficios}</p> : null}
          </div>
        ))}

        {espec.slice(0, 2).map((s, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <h3 className="pdf-h3">{s.id || `Unidade ${i + 1}`}</h3>
            <div className="pdf-spec-grid">
              {eq === "elevador" ? <>
                <div><span>Modelo</span><b>{s.modelo || "—"}</b></div>
                <div><span>Tipo de Empreendimento</span><b>{s.empreendimento || "—"}</b></div>
                <div><span>Característica</span><b>{s.carac || "—"}</b></div>
                <div><span>Denominação Pavimentos</span><b>{s.denominacao || "—"}</b></div>
                <div><span>Percurso</span><b>{s.percurso ? `${s.percurso}mm` : "—"}</b></div>
                <div><span>Capacidade</span><b>{s.capacidade || "—"}</b></div>
                <div><span>Dimensões Caixa</span><b>{s.dimensoesCaixa || "—"}</b></div>
                <div><span>Prof. Poço</span><b>{s.profPoço ? `${s.profPoço}mm` : "—"}</b></div>
                <div><span>Velocidade</span><b>{s.vel ? `${s.vel} m/s` : "—"}</b></div>
                <div><span>And./Paradas/Portas</span><b>{s.andaresParadasPortas || "—"}</b></div>
              </> : <>
                <div><span>Tipo de Empreendimento</span><b>{s.empreendimento || "—"}</b></div>
                <div><span>Característica</span><b>{s.carac || "—"}</b></div>
                <div><span>{eq === "escada" ? "Desnível" : "Desnível / Comp."}</span><b>{(eq === "escada" ? s.desnivel : s.desnivelComp) ? `${(eq === "escada" ? s.desnivel : s.desnivelComp)}mm` : "—"}</b></div>
                <div><span>Inclinação</span><b>{s.incl || "—"}</b></div>
                <div><span>{eq === "escada" ? "Largura Degrau" : "Largura Pallet"}</span><b>{(eq === "escada" ? s.largDegrau : s.largPallet) || "—"}</b></div>
                <div><span>Balaustrada</span><b>{s.balaustrada || "—"}</b></div>
                <div><span>Velocidade</span><b>{s.vel || "—"}</b></div>
                <div><span>Alimentação</span><b>{s.alimentacao || "—"}</b></div>
                <div><span>Arranjo</span><b>{s.arranjo || "—"}</b></div>
                <div><span>Máquina</span><b>{s.maquina || "—"}</b></div>
              </>}
              <div><span>Quantidade</span><b>{s.qtd || "1"}</b></div>
            </div>
          </div>
        ))}

        {(desc.length === 0 && espec.length === 0) ? (
          <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>Preencha pelo menos uma descrição e uma especificação técnica.</p>
        ) : null}
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewAcabamentos({ data, pg, total }) {
  const a = data.elevador.acabamentos;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Acabamentos</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Cabine & Pavimento</div>
        <h2 className="pdf-h2">Acabamentos</h2>
        <div className="pdf-rule"/>
        <div className="pdf-spec-grid">
          <div><span>Modelo Cabine</span><b>{a.modeloCabine || "—"}</b></div>
          <div><span>Material</span><b>{a.acabamentoMat || "—"}</b></div>
          <div><span>Sub-teto</span><b>{a.subTeto || "—"}</b></div>
          <div><span>Painel Operação</span><b>{a.painelOperacao || "—"}</b></div>
          <div><span>Piso Cabina</span><b>{a.pisoCabina || "—"}</b></div>
          <div><span>Medidas Piso</span><b>{a.medidasPiso || "—"}</b></div>
          <div><span>Modelo Porta</span><b>{a.modeloPorta || "—"}</b></div>
          <div><span>Dim. Porta Cabine</span><b>{a.dimPortaCabine || "—"}</b></div>
          <div><span>Acab. Porta Cabine</span><b>{a.acabPortaCabine || "—"}</b></div>
          <div><span>Portas Pavimento</span><b>{a.portasPavimento || "—"}</b></div>
          <div><span>Botoeiras Pavim.</span><b>{a.botoeirasPavimento || "—"}</b></div>
          <div><span>Sinalização</span><b>{a.sinalizacao || "—"}</b></div>
        </div>
        {a.pavInox ? <p style={{ marginTop: 6 }}><b>Pavimentos inox:</b> {a.pavInox}</p> : null}
        {a.demais ? <><h3 className="pdf-h3">Demais</h3><p>{a.demais}</p></> : null}
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewValores({ data, eq, pg, total }) {
  const v = data[eq].valores;
  const parcelas = v.parcelas || [];
  const qtd = parseFloat(v.quantidade) || 0;
  const unit = parseFloat((v.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const difal = parseFloat((v.difal || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const totalEq = qtd * unit;
  const totalDifal = totalEq + difal;
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Valores</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Comercial</div>
        <h2 className="pdf-h2">Valores e Pagamento</h2>
        <div className="pdf-rule"/>

        <table className="pdf-table">
          <thead>
            <tr><th>Equipamento</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor Unit.</th><th style={{ textAlign: "right" }}>Total</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{v.equipamento || "—"}</td>
              <td style={{ textAlign: "right" }}>{qtd || "—"}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{unit ? fmt(unit) : "—"}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{totalEq ? fmt(totalEq) : "—"}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>DIFAL</td><td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{difal ? fmt(difal) : "—"}</td></tr>
          </tfoot>
        </table>

        <div className="pdf-total">
          <span>Total com DIFAL</span>
          <b>{fmt(totalDifal)}</b>
        </div>

        {parcelas.length > 0 ? (
          <>
            <h3 className="pdf-h3" style={{ marginTop: 10 }}>Parcelamento</h3>
            <table className="pdf-table">
              <thead><tr><th>#</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {parcelas.map((p, i) => (
                  <tr key={i}>
                    <td style={{ width: 18 }}>{i + 1}</td>
                    <td>{p.desc || "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.valor ? "R$ " + p.valor : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <p style={{ marginTop: 6, fontSize: 6.5, color: "var(--fg3)" }}>
          Forma de pagamento: <b>{v.forma || "a definir"}</b>
        </p>
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

function PreviewGarantia({ data, eq, pg, total }) {
  const g = data[eq].garantia;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Garantia</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Jurídico</div>
        <h2 className="pdf-h2">Garantia & Condições</h2>
        <div className="pdf-rule"/>
        <h3 className="pdf-h3">Garantia</h3>
        {g.garantia ? <p>{g.garantia}</p> : <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>Texto de garantia será preenchido.</p>}
        <h3 className="pdf-h3">Condições Gerais</h3>
        {g.condicoes ? <p>{g.condicoes}</p> : <p style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>Condições gerais serão preenchidas.</p>}

        <div className="pdf-footer">
          <span>VerticalParts · CNPJ XX.XXX.XXX/0001-XX</span>
          <span>{data.numero || "VP-2026-XXX"}</span>
        </div>
      </div>
      <div className="pe__pdf-pgnum">Página {pg} de {total}</div>
    </div>
  );
}

Object.assign(window, { PEPreview });
