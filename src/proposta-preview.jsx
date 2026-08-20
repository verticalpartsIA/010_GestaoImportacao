/* ============================================================
   proposta-preview.jsx — Live PDF preview pages (right column)
   Estrutura e conteúdo calibrados pelo PDF real de referência que o
   usuário mandou (Proposta_776_B, sistema "VP Proposta Comercial" já em
   produção) — 18 páginas: capa, institucional, cliente/obra, saudação,
   marketing do equipamento, especificação/acabamento (tabela),
   características/recursos/infraestrutura, fotos, valores (2 tabelas),
   condições de pagamento, ajustes e impostos, prazo, responsabilidades,
   garantia + assinatura. Escada/Esteira ainda usam o fluxo mais simples
   anterior (não fazem parte da referência que o usuário mandou).

   Cada página (.pe__pdf) é desenhada em tamanho FÍSICO real (210×297mm,
   igual à Ficha Técnica) — não mais numa largura de "miniatura" — daí a
   necessidade de encolher (nunca ampliar) pra caber na coluna lateral.

   IMPORTANTE: `zoom` só pode ser aplicado em quem NUNCA é capturado por
   html2canvas. Na coluna lateral (nunca capturada) o zoom automático via
   ResizeObserver deixa a miniatura legível. No overlay "Gerar PDF" os
   MESMOS elementos .pe__pdf são capturados pelo html2canvas — zoom
   (propriedade não-padrão) faz o html2canvas medir/clonar o layout errado
   e desenhar o texto duplicado/fantasma no PDF final. Por isso o overlay
   renderiza as páginas no tamanho nativo (sem zoom, sem esticar largura). */

// 210mm em px a 96dpi (largura "de projeto" real da página — ver .pe__pdf)
const PE_PAGE_PX = 793.7;

function PEPreview({ data, eq, overlay, bare }) {
  const eqLabel = eq === "elevador" ? "elevador" : eq === "escada" ? "escada" : "esteira";
  const eqName = eq === "elevador" ? "Elevador" : eq === "escada" ? "Escada Rolante" : "Esteira Rolante";

  const previewWrap = React.useRef(null);
  const [scale, setScale] = React.useState(0.5);
  React.useEffect(() => {
    if (overlay) return; // overlay é capturado por html2canvas — sem zoom (ver nota acima)
    const el = previewWrap.current; if (!el) return;
    // Nunca amplia além do tamanho real (max 1) — só encolhe pra caber.
    const ro = new ResizeObserver(() => setScale(Math.max(0.25, Math.min(1, (el.clientWidth - 28) / PE_PAGE_PX))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay]);

  // ---- Monta a lista de páginas ----
  let pageList;
  if (eqLabel === "elevador") {
    const ed = data.elevador;
    const fotos = ed.fotos || {};
    const temFotos = !!(fotos.unidade || fotos.teto || fotos.botoeira);
    pageList = [
      PreviewCapa,
      PreviewSobre,
      PreviewSobreCont,
      PreviewClienteObra,
      PreviewSaudacao,
      PreviewElevadorMarketing,
      PreviewEspecTabela,
      PreviewAcabamentoTabela,
      PreviewCaracteristicasEquip,
      PreviewRecursosNomeados,
      PreviewInfraestruturaNomeada,
      ...(temFotos ? [PreviewFotos] : []),
      PreviewValoresTabelas,
      PreviewCondicoesPagamento,
      PreviewAjustesImpostos,
      PreviewPrazoEntrega,
      PreviewResponsabilidadesNova,
      PreviewGarantiaValidade,
    ];
  } else {
    // Escada/Esteira: fluxo antigo, mais simples (fora do escopo da
    // referência que o usuário mandou — ainda não redesenhado).
    pageList = [PreviewCapa, PreviewClienteObraSimples, PreviewTexto, PreviewDescricaoEspec, PreviewValoresSimples, PreviewGarantiaSimples];
  }
  const total = pageList.length;
  const pages = pageList.map((C, i) => <C key={i} data={data} eq={eqLabel} eqName={eqName} pg={i + 1} total={total}/>);

  const scaled = (
    <div className="pe__preview-wrap" ref={previewWrap}>
      <div className="pe__preview-scaler" style={{ zoom: scale }}>
        <div className={"pe__preview-pages" + (overlay ? " pe__preview-pages--overlay" : "")} data-total={total}>{pages}</div>
      </div>
    </div>
  );

  // `bare` = página pública de assinatura (assinar-app.jsx): o cliente não
  // pode ver um cabeçalho de ferramenta interna ("Preview da Proposta" +
  // Badge) — só o documento em si, do mesmo jeito que ele vê no overlay/PDF.
  if (overlay || bare) return scaled;

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

/* ---------- Peças compartilhadas de header/rodapé (páginas internas) ---------- */
function PdfHeader({ numero }) {
  return (
    <div className="pdf-page-header">
      <div className="pdf-page-header-brand">
        <img src="assets/logo-verticalparts-color.png" alt="VerticalParts"/>
        <span>Elevando você e o seu negócio</span>
      </div>
      <div className="pdf-page-header-num">
        <span>Número da Proposta</span>
        <b>{numero || "—"}</b>
      </div>
    </div>
  );
}

function PdfFooter() {
  return (
    <div className="pdf-page-footer">
      <div className="pdf-page-footer-info">
        <div><Icon.pin size={13}/><span>Rua Armandina Braga de Almeida, 383<br/>Jardim Santa Emília<br/>Guarulhos/SP - CEP 07141-003</span></div>
        <div><Icon.message size={13}/><span>+55 (11) 2528-6473<br/>+55 (11) 2528-6479<br/>+55 (11) 94460-6396</span></div>
        <div><Icon.mail size={13}/><span>comercial@verticalparts.com.br</span></div>
      </div>
      <div className="pdf-page-footer-bar"><span/><span/></div>
    </div>
  );
}

/* CNPJ/CPF do cadastro vem só com dígitos ("88818299000137") e ia cru
   pro documento do cliente. Formata pra máscara oficial; se não tiver o
   tamanho esperado, devolve como está (não inventa formato). */
function fmtDoc(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v || "";
}

/* O nome do cliente às vezes vem digitado já com o CNPJ colado dentro
   ("Fulano - Prefeitura X, CNPJ 888182990001-37"), e aí o documento
   mostrava o CNPJ duas vezes — uma no nome, outra no campo próprio
   (achado na análise do PDF de 20/08, pág. 5). Limpa o sufixo do nome
   quando o campo CNPJ já existe. */
function nomeSemDoc(nome, doc) {
  if (!nome || !doc) return nome || "";
  return String(nome)
    .replace(/[,;–-]?\s*(CNPJ|CPF)\s*:?\s*[\d./-]+\s*$/i, "")
    .trim()
    .replace(/[,;–-]\s*$/, "");
}

/* Placeholder de campo vazio. O texto que o VENDEDOR lê ("Preencha os
   acabamentos na aba...") é instrução interna do sistema e não pode
   chegar ao cliente — saía impresso no PDF entregue (achado real na
   análise do PDF de 20/08, pág. 9: "ACABAMENTO — Preencha os acabamentos
   na aba Acabamentos"). Na tela mostra a instrução; no PDF/impressão
   mostra só "A definir.", que é o que faz sentido pro cliente ler. */
function Vazio({ children, print = "A definir." }) {
  return (
    <>
      <p className="pe-vazio-tela" style={{ color: "var(--vp-gray-400)", fontStyle: "italic" }}>{children}</p>
      <p className="pe-vazio-print" style={{ color: "#777", fontStyle: "italic" }}>{print}</p>
    </>
  );
}

/* ---------- Página 1: Capa ---------- */
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
            <dd>{v.nome || <span style={{ color: "var(--vp-gray-300)" }}>Equipe Comercial</span>}</dd>
            <dt>Contato</dt>
            <dt>&nbsp;</dt>
            <dd>{v.email || "comercial@verticalparts.com.br"}</dd>
            <dd>&nbsp;</dd>
          </dl>
          <div className="pe__pdf-capa-foot">
            <span><Icon.message size={13}/> {v.celular || v.fixo || "(11) 2528-6473"}</span>
            <span><Icon.pin size={13}/> Rua Armandina Braga de Almeida, 383</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Página 2: Sobre a VerticalParts (institucional, fixo) ----------
   Dividida em 2 páginas (achado 20/08): o conteúdo inteiro (título + foto +
   5 parágrafos + cards) media ~1626px de altura real contra os ~1123px de
   uma folha A4 — 45% maior que cabe numa página só. Com tudo num único
   `.pe__pdf`, o navegador decidia sozinho onde cortar pra impressão, e
   Chrome e Firefox faziam isso de formas diferentes e inconsistentes
   (uma página em branco sobrando, às vezes antes às vezes depois do
   conteúdo real). Separar em 2 `.pe__pdf` de verdade — o mesmo padrão que
   já funciona sem falha nas outras 18 páginas do documento — tira essa
   decisão do navegador. */
function PreviewSobre({ eq }) {
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, textTransform: "uppercase", color: "#1b2a4a", margin: "0 0 25px", lineHeight: 1.15 }}>
          Elevando<br/>Você e o Seu Negócio
        </h1>
        <div className="pe__pdf-sobre-img" data-eq={eq}/>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 17 }}>
          <img src="assets/logo-verticalparts-color.png" alt="VerticalParts" style={{ height: 26 }}/>
          <span className="pdf-sub-title" style={{ margin: 0 }}>Sobre a VerticalParts</span>
        </div>
        <p>Desde 2012 no mercado de mobilidade vertical, a VerticalParts se destaca como líder fornecedora de soluções personalizadas e competitivas para o transporte de passageiros. Nosso compromisso é oferecer produtos de alta qualidade e serviços excepcionais para atender às necessidades específicas de cada cliente.</p>
        <p>Especializados na venda de equipamentos como escadas, esteiras rolantes, elevadores e peças de reposição, nos orgulhamos de oferecer uma ampla variedade de opções para aprimorar a mobilidade em diversos setores. Nosso objetivo é proporcionar soluções eficientes e seguras que atendam às demandas de espaços comerciais, residenciais e públicos.</p>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 2b: continuação de "Sobre a VerticalParts" ---------- */
function PreviewSobreCont() {
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 17 }}>
          <img src="assets/logo-verticalparts-color.png" alt="VerticalParts" style={{ height: 26 }}/>
          <span className="pdf-sub-title" style={{ margin: 0 }}>Sobre a VerticalParts</span>
        </div>
        <p>Além disso, a VerticalParts se destaca pela sua dedicação em manter um amplo estoque de peças de reposição para escadas e esteiras rolantes. Isso nos permite suprir todas as suas necessidades de forma rápida e eficiente, garantindo a máxima disponibilidade e funcionamento contínuo dos seus equipamentos.</p>
        <p>Nossa equipe altamente qualificada está pronta para oferecer suporte técnico especializado e auxiliar na seleção, instalação e manutenção dos produtos. Valorizamos a satisfação do cliente e buscamos estabelecer parcerias duradouras baseadas na confiança e na excelência dos nossos serviços.</p>
        <p>Se você está em busca de soluções personalizadas e confiáveis em mobilidade vertical, conte com a VerticalParts.</p>
        <p><b>VerticalParts</b> - Soluções em mobilidade vertical, além das suas expectativas.</p>

        <div style={{ display: "flex", gap: 13, marginTop: 25 }}>
          {[["+3.000", "Clientes"], ["+5.000", "Peças a Pronta Entrega"], ["+300", "Equipamentos Instalados"]].map(([n, l], i) => (
            <div key={i} style={{ flex: 1, background: "var(--vp-yellow)", padding: "13px 15px" }}>
              <b style={{ display: "block", fontSize: 20, fontWeight: 800 }}>{n}</b>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 3: Cliente & Obra ---------- */
function PreviewClienteObra({ data }) {
  const c = data.cliente, o = data.obra;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        {data.dataLinha ? <p style={{ marginBottom: 25 }}>{data.dataLinha}</p> : null}

        <h2 className="pdf-sub-title">Dados do Cliente</h2>
        <div className="pdf-box">
          <p><b>{nomeSemDoc(c.nome, c.cnpj) || c.nome || "—"}</b></p>
          {c.cnpj ? <p>CNPJ: {fmtDoc(c.cnpj)}</p> : null}
          {c.responsavel ? <p>A/C: {c.responsavel}</p> : null}
          <p>{[c.endereco, c.numero].filter(Boolean).join(", ") || "—"}</p>
          <p>{[c.bairro, c.cidade, c.uf].filter(Boolean).join(" - ") || "—"}</p>
          {c.cep ? <p>CEP: {c.cep}</p> : null}
        </div>

        <h2 className="pdf-sub-title">Dados da Obra</h2>
        <div className="pdf-box">
          <p><b>{o.nome || "—"}</b></p>
          <p>{[o.endereco, o.numero].filter(Boolean).join(", ") || "—"}</p>
          <p>{[o.bairro, o.cidade, o.uf].filter(Boolean).join(" - ") || "—"}</p>
          {o.cep ? <p>CEP: {o.cep}</p> : null}
        </div>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 4: Saudação + resumo do fornecimento ---------- */
function PreviewSaudacao({ data }) {
  const ed = data.elevador;
  const s = (ed.especificacoes || [])[0] || {};
  const qtd = ed.valores?.quantidade || "1";
  const resumo = [s.id, s.modelo, s.carac, s.capacidade ? `Capacidade para ${s.capacidade}` : "", s.andaresParadasPortas]
    .filter(Boolean).join(" - ");
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <p>Prezados Senhores(as):</p>
        <p>Proposta Comercial para o fornecimento de {qtd} Elevador(es) de Passageiros.</p>
        <div className="pdf-box">
          {resumo ? <p>{resumo}</p> : <Vazio>Preencha as especificações técnicas do equipamento.</Vazio>}
          <p>Marca: VerticalParts</p>
        </div>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 5: Marketing do equipamento ---------- */
function PreviewElevadorMarketing({ data }) {
  const ed = data.elevador;
  const s = (ed.especificacoes || [])[0] || {};
  const titulo = ["Elevador de Passageiros", s.modelo].filter(Boolean).join(" ");
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">{titulo}</h2>
        <div className="pdf-sec-rule"/>
        {ed.textoProposta ? <p>{ed.textoProposta}</p> : <Vazio>Descreva a linha do produto neste campo.</Vazio>}

        {ed.textoModelos ? (
          <>
            <h3 className="pdf-sub-title">Linha de Modelos</h3>
            <p>{ed.textoModelos}</p>
          </>
        ) : null}

        {ed.beneficios?.length ? (
          <>
            <h3 className="pdf-sub-title">Benefícios</h3>
            <ul className="pdf-list">{ed.beneficios.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </>
        ) : null}

        {ed.diferenciais?.length ? (
          <>
            <h3 className="pdf-sub-title">Diferenciais em Relação ao Mercado</h3>
            <ul className="pdf-list">{ed.diferenciais.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </>
        ) : null}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 6: Especificações Técnicas (tabela) ---------- */
function PreviewEspecTabela({ data }) {
  const ed = data.elevador;
  const s = (ed.especificacoes || [])[0] || {};
  const linhas = [
    ["Tipo de Empreendimento", s.empreendimento],
    ["Característica de Transporte", s.carac],
    ["Denominação", s.denominacao],
    ["Percurso", s.percurso && `${s.percurso}mm`],
    ["Capacidade", s.capacidade],
    ["Caixa de Corrida", s.dimensoesCaixa],
    ["Poço", s.profPoço && `${s.profPoço}mm`],
    ["Velocidade", s.vel && `${s.vel} m/s`],
    ["Paradas", s.andaresParadasPortas],
    ["Modelo", s.modelo],
    ["Quantidade", s.qtd],
  ].filter(([, v]) => v);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Especificações Técnicas</h2>
        <div className="pdf-sec-rule"/>
        <h3 className="pdf-sub-title">Características Principais</h3>
        {linhas.length ? (
          <table className="pdf-table2">
            <thead><tr><th>Característica</th><th>{s.id || "Elevador de Passageiros"}</th></tr></thead>
            <tbody>{linhas.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
        ) : <Vazio>Preencha as especificações técnicas na aba "Especificações Técnicas".</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 7: Acabamento (tabela) ---------- */
function PreviewAcabamentoTabela({ data }) {
  const a = data.elevador.acabamentos;
  const linhas = [
    ["Modelo da Cabine", a.modeloCabine],
    ["Acabamentos", a.acabamentoMat],
    ["Sub-teto", a.subTeto],
    ["Botoeira de Cabine", a.painelOperacao],
    ["Piso", a.pisoCabina],
    ["Medidas", a.medidasPiso],
    ["Porta de Cabine", a.modeloPorta],
    ["Medidas Porta de Cabine", a.dimPortaCabine],
    ["Modelo de Porta", a.acabPortaCabine],
    ["Portas de Pavimento", a.portasPavimento],
    ["Botoeiras de Pavimento", a.botoeirasPavimento],
    ["Sinalização", a.sinalizacao],
    ["Pavimentos Inox", a.pavInox],
    ["Demais", a.demais],
  ].filter(([, v]) => v);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Acabamento</h2>
        <div className="pdf-sec-rule"/>
        {linhas.length ? (
          <table className="pdf-table2">
            <thead><tr><th>Item</th><th>Elevador de Passageiros</th></tr></thead>
            <tbody>{linhas.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
        ) : <Vazio>Preencha os acabamentos na aba "Acabamentos".</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 8: Características Principais (elétrica/comando/tração) ---------- */
function PreviewCaracteristicasEquip({ data }) {
  const c = data.elevador.caracteristicasEquip || {};
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Características Principais</h2>
        <div className="pdf-sec-rule"/>
        <h3 className="pdf-sub-title">Alimentação Elétrica</h3>
        {c.alimentacao ? <p>{c.alimentacao}</p> : <Vazio>A preencher.</Vazio>}
        <h3 className="pdf-sub-title">Sistema de Comando de Controle</h3>
        {c.comando ? <p>{c.comando}</p> : <Vazio>A preencher.</Vazio>}
        <h3 className="pdf-sub-title">Máquina de Tração</h3>
        {c.tracao ? <p>{c.tracao}</p> : <Vazio>A preencher.</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 9: Recursos Inclusos ---------- */
function PreviewRecursosNomeados({ data }) {
  const itens = data.elevador.recursosNomeados || [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Recursos Inclusos</h2>
        <div className="pdf-sec-rule"/>
        {itens.length ? itens.map((it, i) => (
          <div className="pdf-named-item" key={i}>
            <b>{it.nome}:</b>
            <p>{it.desc}</p>
          </div>
        )) : <Vazio>Adicione os recursos inclusos no equipamento.</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 10: Infraestrutura e Instalação ---------- */
function PreviewInfraestruturaNomeada({ data }) {
  const itens = data.elevador.infraestruturaNomeada || [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Infraestrutura e Instalação</h2>
        <div className="pdf-sec-rule"/>
        {itens.length ? itens.map((it, i) => (
          <div className="pdf-named-item" key={i}>
            <b>{it.nome}:</b>
            <p>{it.desc}</p>
          </div>
        )) : <Vazio>Adicione os itens de infraestrutura.</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 11: Fotos do Equipamento (só aparece se houver foto) ---------- */
function PreviewFotos({ data }) {
  const fotos = data.elevador.fotos || {};
  // Bucket privado: o path guardado no data_json exige URL assinada —
  // resolve antes de montar o <img> (tanto pra tela quanto pra captura
  // do html2canvas em "Salvar PDF", que espera as imagens carregarem).
  const [urls, setUrls] = React.useState({});
  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!window.PropostaImagens) return;
      const slots = ['unidade', 'teto', 'botoeira'];
      const entries = await Promise.all(slots.map(async (k) =>
        [k, fotos[k] ? await window.PropostaImagens.signedURL(fotos[k]) : null]));
      if (!cancelado) setUrls(Object.fromEntries(entries));
    })();
    return () => { cancelado = true; };
  }, [fotos.unidade, fotos.teto, fotos.botoeira]);

  const itens = [
    ["Unidade", urls.unidade],
    ["Teto da Cabine", urls.teto],
    ["Botoeira", urls.botoeira],
  ].filter(([, url]) => url);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        {itens.map(([label, url], i) => (
          <div className="pdf-foto" key={i}>
            <img src={url} alt={label}/>
          </div>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 12: Valores e Pagamento (2 tabelas) ---------- */
function PreviewValoresTabelas({ data }) {
  const v = data.elevador.valores;
  const parcelas = v.parcelas || [];
  const qtd = parseFloat(v.quantidade) || 0;
  const unit = parseFloat((v.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const difal = parseFloat((v.difal || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const totalEq = qtd * unit;
  const totalGeral = totalEq + difal;
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalParcelas = parcelas.reduce((s, p) => s + (parseFloat((p.valor || "0").toString().replace(/\./g, "").replace(",", ".")) || 0), 0);

  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Valores e Pagamento</h2>
        <div className="pdf-sec-rule"/>

        <h3 className="pdf-sub-title">Preços dos Equipamentos</h3>
        <table className="pdf-table2">
          <thead><tr><th>Equipamento</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor Unit.</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
          <tbody>
            <tr>
              <td>{v.equipamento || "Elevador de Passageiros"}</td>
              <td style={{ textAlign: "right" }}>{qtd || "—"}</td>
              <td style={{ textAlign: "right" }}>{unit ? fmt(unit) : "—"}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{totalEq ? fmt(totalEq) : "—"}</td>
            </tr>
            {difal ? <tr><td colSpan={3}>DIFAL</td><td style={{ textAlign: "right" }}>{fmt(difal)}</td></tr> : null}
            <tr className="pdf-total-row"><td colSpan={3}>Total Equipamentos</td><td style={{ textAlign: "right" }}>{fmt(totalGeral)}</td></tr>
          </tbody>
        </table>

        {parcelas.length ? (
          <>
            <h3 className="pdf-sub-title">Cronograma de Pagamento</h3>
            <table className="pdf-table2">
              <thead><tr><th>Parcela / Descrição</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {parcelas.map((p, i) => (
                  <tr key={i}><td>{p.desc || "—"}</td><td style={{ textAlign: "right" }}>{p.valor ? "R$ " + p.valor : "—"}</td></tr>
                ))}
                <tr className="pdf-total-row"><td>Total Parcelado</td><td style={{ textAlign: "right" }}>{fmt(totalParcelas)}</td></tr>
              </tbody>
            </table>
          </>
        ) : null}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 13: Condições Gerais de Pagamento ---------- */
function PreviewCondicoesPagamento({ data }) {
  const c = data.elevador.condicoesPagto || {};
  const blocos = [
    ["Venda de Equipamentos", c.venda],
    ["Impostos e Serviços", c.impostos],
    ["Ajuste de Frete Marítimo", c.ajusteFrete],
    ["Reajuste", c.reajuste],
  ].filter(([, v]) => v);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Condições Gerais de Pagamento</h2>
        <div className="pdf-sec-rule"/>
        {blocos.map(([t, txt], i) => (
          <React.Fragment key={i}><h3 className="pdf-sub-title">{t}</h3><p>{txt}</p></React.Fragment>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 14: Ajustes e Impostos ---------- */
function PreviewAjustesImpostos({ data }) {
  const a = data.elevador.ajustes || {};
  const blocos = [
    ["Cláusula de Reajuste Cambial", a.clausulaCambial],
    ["Faturamento", a.faturamentoTexto],
    ["Taxas e Impostos Inclusos", a.taxasInclusas],
    ["Taxas e Impostos Excluídos", a.taxasExcluidas],
  ].filter(([, v]) => v);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Ajustes e Impostos</h2>
        <div className="pdf-sec-rule"/>
        {blocos.map(([t, txt], i) => (
          <React.Fragment key={i}><h3 className="pdf-sub-title">{t}</h3><p>{txt}</p></React.Fragment>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 15: Prazo de Entrega ---------- */
function PreviewPrazoEntrega({ data }) {
  const p = data.elevador.prazo || {};
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Prazo de Entrega</h2>
        <div className="pdf-sec-rule"/>
        {p.prazo ? <p>A VerticalParts se compromete a entregar o(s) equipamento(s) adquirido(s) no <b>{p.prazo}</b>, contados a partir da data em que todos os requisitos forem atendidos, quais sejam: assinatura do contrato, pagamento do sinal e aprovação do projeto. A conclusão desses 03 (três) requisitos são condições essenciais e indispensáveis para o início da contagem do prazo de entrega do(s) equipamento(s).</p> : <Vazio>A preencher.</Vazio>}
        <p>O comprador deverá apresentar cronograma da obra contendo as datas de liberação de obra para início das montagens e datas finais de entrega, sendo que este cronograma será validado pela VerticalParts.</p>
        {p.condCovid ? <p>{p.condCovid}</p> : null}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 16: Responsabilidades ---------- */
function PreviewResponsabilidadesNova({ data }) {
  const r = data.elevador.responsabilidades || {};
  const vendedor = r.vendedor || [];
  const comprador = r.comprador || [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Responsabilidades</h2>
        <div className="pdf-sec-rule"/>
        <h3 className="pdf-sub-title">Serviços e Fornecimento a Cargo e por Conta do Vendedor</h3>
        <p>Esta proposta pode ser alterada a qualquer momento. O preço mencionado pressupõe a compra dos equipamentos de acordo com nossas condições padrão vigentes. Se houver condições ou requisitos especiais, o preço e os termos precisarão ser revisados para acomodar essas solicitações.</p>
        {vendedor.length ? <ul className="pdf-list">{vendedor.map((v, i) => <li key={i}>{v}</li>)}</ul> : null}
        <h3 className="pdf-sub-title">Serviços e Fornecimento a Cargo e por Conta do Comprador</h3>
        {comprador.length ? <ul className="pdf-list">{comprador.map((v, i) => <li key={i}>{v}</li>)}</ul> : <Vazio>A preencher.</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 17: Garantia e Validade + Assinatura ---------- */
function PreviewGarantiaValidade({ data }) {
  const g = data.elevador.garantia || {};
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Garantia e Validade</h2>
        <div className="pdf-sec-rule"/>
        <h3 className="pdf-sub-title">Garantia</h3>
        {g.garantia ? <p>{g.garantia}</p> : <Vazio>A preencher.</Vazio>}
        <h3 className="pdf-sub-title">Condições Gerais</h3>
        {g.condicoes ? <p>{g.condicoes}</p> : <Vazio>A preencher.</Vazio>}
        {g.horario ? (
          <>
            <p>A realização dos serviços de Instalação e Montagem serão realizados no período de:<br/><b>{g.horario}</b></p>
            <p>Serviços realizados fora do horário comercial acima mencionado serão cobrados à parte.</p>
          </>
        ) : null}
        <h3 className="pdf-sub-title">Validade da Proposta</h3>
        <p>{data.validade || "30 dias"}</p>

        <div className="pdf-assinaturas">
          <div className="pdf-assinatura">
            <div className="pdf-assinatura-linha"/>
            <b>Assinatura do Cliente:</b>
            <span>Nome legível:</span>
          </div>
          <div className="pdf-assinatura">
            <div className="pdf-assinatura-linha"/>
            <b>VerticalParts:</b>
          </div>
        </div>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ============================================================
   Escada / Esteira — fluxo anterior, mais simples (fora do escopo da
   referência que o usuário mandou pra Elevador; ainda não redesenhado).
   ============================================================ */
function PreviewClienteObraSimples({ data, eq, pg, total }) {
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
      <div className="pe__pdf-pgnum">Seção {pg} de {total}</div>
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
        {data.dataLinha ? <p style={{ fontWeight: 700, marginBottom: 8 }}>{data.dataLinha}</p> : <Vazio>São Paulo, [data]</Vazio>}
        {ed.textoProposta ? <p>{ed.textoProposta}</p> : <Vazio>O texto da proposta aparecerá aqui conforme preenchimento.</Vazio>}
        <h3 className="pdf-h3">Linha de Modelos</h3>
        {ed.textoModelos ? <p>{ed.textoModelos}</p> : <Vazio>Descreva a linha do produto neste campo.</Vazio>}
      </div>
      <div className="pe__pdf-pgnum">Seção {pg} de {total}</div>
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
              <div><span>Quantidade</span><b>{s.qtd || "1"}</b></div>
            </div>
          </div>
        ))}
        {(desc.length === 0 && espec.length === 0) ? <Vazio>Preencha pelo menos uma descrição e uma especificação técnica.</Vazio> : null}
      </div>
      <div className="pe__pdf-pgnum">Seção {pg} de {total}</div>
    </div>
  );
}

function PreviewValoresSimples({ data, eq, pg, total }) {
  const v = data[eq].valores;
  const parcelas = v.parcelas || [];
  const qtd = parseFloat(v.quantidade) || 0;
  const unit = parseFloat((v.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const difal = parseFloat((v.difal || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const totalEq = qtd * unit;
  const totalDifal = totalEq + difal;
  const totalParcelado = parcelas.reduce((s, p) => s + (parseFloat((p.valor || "0").toString().replace(/\./g, "").replace(",", ".")) || 0), 0);
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Valores</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Comercial</div>
        <h2 className="pdf-h2">Valores e Pagamento</h2>
        <div className="pdf-rule"/>
        <table className="pdf-table">
          <thead><tr><th>Equipamento</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor Unit.</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
          <tbody>
            <tr>
              <td>{v.equipamento || "—"}</td>
              <td style={{ textAlign: "right" }}>{qtd || "—"}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{unit ? fmt(unit) : "—"}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{totalEq ? fmt(totalEq) : "—"}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colSpan={3}>DIFAL</td><td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{difal ? fmt(difal) : "—"}</td></tr></tfoot>
        </table>
        <div className="pdf-total"><span>Total com DIFAL</span><b>{fmt(totalDifal)}</b></div>
        {parcelas.length > 0 ? (
          <>
            <h3 className="pdf-h3" style={{ marginTop: 10 }}>Parcelamento</h3>
            <table className="pdf-table">
              <thead><tr><th>#</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {parcelas.map((p, i) => <tr key={i}><td style={{ width: 18 }}>{i + 1}</td><td>{p.desc || "—"}</td><td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.valor ? "R$ " + p.valor : "—"}</td></tr>)}
                <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total Parcelado</td><td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(totalParcelado)}</td></tr>
              </tbody>
            </table>
          </>
        ) : null}
        <p style={{ marginTop: 13, fontSize: 14, color: "var(--fg3)" }}>Forma de pagamento: <b>{v.forma || "a definir"}</b></p>
      </div>
      <div className="pe__pdf-pgnum">Seção {pg} de {total}</div>
    </div>
  );
}

function PreviewGarantiaSimples({ data, eq, pg, total }) {
  const g = data[eq].garantia;
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-pgmark">P. {String(pg).padStart(2, "0")} · Garantia</div>
      <div className="pe__pdf-inner">
        <div className="pdf-eyebrow">▎ Jurídico</div>
        <h2 className="pdf-h2">Garantia & Condições</h2>
        <div className="pdf-rule"/>
        <h3 className="pdf-h3">Garantia</h3>
        {g.garantia ? <p>{g.garantia}</p> : <Vazio>Texto de garantia será preenchido.</Vazio>}
        <h3 className="pdf-h3">Condições Gerais</h3>
        {g.condicoes ? <p>{g.condicoes}</p> : <Vazio>Condições gerais serão preenchidas.</Vazio>}
        <div className="pdf-footer">
          <span>VerticalParts · CNPJ XX.XXX.XXX/0001-XX</span>
          <span>{data.numero || "VP-2026-XXX"}</span>
        </div>
      </div>
      <div className="pe__pdf-pgnum">Seção {pg} de {total}</div>
    </div>
  );
}

Object.assign(window, { PEPreview });
