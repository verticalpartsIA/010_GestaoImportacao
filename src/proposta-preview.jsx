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
    /* Escada/Esteira (15/10/2026): mesmo documento do Elevador, com textos/tabelas do próprio equipamento
       (sem "paradas"/"elevador"). As páginas compartilhadas leem `data.elevador`; aqui esse bloco é o do
       equipamento da proposta (pageData abaixo). Páginas sem conteúdo (especificidades, instalação,
       ajustes) só entram se o vendedor preencheu. */
    const ed = data[eqLabel] || {};
    const OP = window.PropostaOpcoes;
    pageList = [
      PreviewCapa, PreviewSobre, PreviewSobreCont, PreviewClienteObra,
      PreviewSaudacaoEscEst, PreviewApresentacaoEscEst, PreviewEspecEscEst,
      ...(OP && OP.linhasEspecificidades(ed, eqLabel).length ? [PreviewEspecificidades] : []),
      ...(OP && OP.itensNomeados(ed.acabamentosLista).length ? [PreviewAcabamentoEscEst] : []),
      ...(OP && OP.itensNomeados(ed.caracteristicasTec).length ? [PreviewCaracTecEscEst] : []),
      ...(OP && OP.blocosInstalacao(ed).length ? [PreviewInstalacao] : []),
      PreviewValoresTabelas,
      ...(OP && OP.blocosCondicoes(ed).length ? [PreviewCondicoesPagamento] : []),
      ...(OP && OP.blocosAjustes(ed).length ? [PreviewAjustesImpostos] : []),
      PreviewPrazoEntrega,
      ...(OP && (OP.itensTexto((ed.responsabilidades || {}).vendedor).length || OP.itensTexto((ed.responsabilidades || {}).comprador).length) ? [PreviewResponsabilidadesNova] : []),
      PreviewGarantiaValidade,
    ];
  }
  const total = pageList.length;
  const pageData = eqLabel === "elevador" ? data : (() => {
    const bloco = data[eqLabel] || {};
    const nomeEq = window.PropostaOpcoes ? window.PropostaOpcoes.eqInfo(eqLabel).nome : eqName;
    return { ...data, elevador: { ...bloco, valores: { ...(bloco.valores || {}), equipamento: (bloco.valores || {}).equipamento || nomeEq } } };
  })();
  const pages = pageList.map((C, i) => <C key={i} data={pageData} eq={eqLabel} eqName={eqName} pg={i + 1} total={total}/>);

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
        <img src="/assets/logo-verticalparts-color.png" alt="VerticalParts"/>
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
            <span><Icon.message size={13}/> {[v.celular, v.fixo].filter(Boolean).join("  ·  ") || "(11) 2528-6473"}</span>
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
          <img src="/assets/logo-verticalparts-color.png" alt="VerticalParts" style={{ height: 26 }}/>
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
          <img src="/assets/logo-verticalparts-color.png" alt="VerticalParts" style={{ height: 26 }}/>
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
          {c.telefone ? <p>Telefone: {c.telefone}</p> : null}
          {c.email ? <p>E-mail: {c.email}</p> : null}
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
  const qtd = ed.valores?.quantidade || "1";
  /* Tabela, uma linha por equipamento (código único), sem cores alternadas. */
  const rows = window.PropostaOpcoes ? window.PropostaOpcoes.resumoEquipamentos(ed.especificacoes) : [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <p>Prezados Senhores(as):</p>
        <p>Proposta Comercial para o fornecimento de {qtd} Elevador(es) de Passageiros.</p>
        {rows.length ? (
          <table className="pdf-table2" style={{ fontSize: "0.86em" }}>
            <thead><tr><th>Equipamento</th><th>Modelo</th><th>Capacidade</th><th style={{ textAlign: "center" }}>Paradas</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: "transparent", breakInside: "avoid" }}>
                  <td><b>{r.codigo}</b></td><td>{r.modelo}</td><td>{r.capacidade}</td>
                  <td style={{ textAlign: "center" }}>{r.paradas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Vazio>Preencha as especificações técnicas do equipamento.</Vazio>}
        <p style={{ marginTop: 10 }}>Marca: VerticalParts</p>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 5: Marketing do equipamento ---------- */
function PreviewElevadorMarketing({ data }) {
  const ed = data.elevador;
  const s = (ed.especificacoes || [])[0] || {};
  const titulo = ["Elevador de Passageiros", window.PropostaOpcoes ? window.PropostaOpcoes.modelosDistintos(ed.especificacoes) : s.modelo].filter(Boolean).join(" ");
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

/* Linhas da tabela de especificações de 1 equipamento — extraída (issue
   #704) pra ser testável sem montar o React inteiro; tensão/tração/
   dimensões da cabine entram aqui pela 1ª vez (vinham sendo coletadas
   no Formulário, nunca chegavam à Proposta). */
function montarLinhasEspec(s) {
  return [
    ["Tipo de Empreendimento", s.empreendimento],
    ["Característica de Transporte", s.carac],
    ["Denominação", s.denominacao],
    ["Percurso", s.percurso && `${s.percurso}mm`],
    ["Capacidade", s.capacidade],
    ["Caixa de Corrida", s.dimensoesCaixa],
    ["Poço", s.profPoço && `${s.profPoço}mm`],
    ["Dimensões da Cabine", s.dimensoesCabine],
    ["Tensão de Alimentação", s.tensao],
    ["Tração", s.tracao],
    ["Velocidade", s.vel && `${s.vel} m/s`],
    ["Paradas", (typeof window !== "undefined" && window.PropostaOpcoes) ? window.PropostaOpcoes.paradasDe(s.andaresParadasPortas) : s.andaresParadasPortas],
    ["Modelo", s.modelo],
    ["Quantidade", s.qtd],
  ].filter(([, v]) => v);
}

/* ---------- Página 6: Especificações Técnicas (tabela) ---------- */
function PreviewEspecTabela({ data }) {
  const ed = data.elevador;
  /* Uma tabela por equipamento — antes só lia especificacoes[0], então a 2ª
     unidade em diante (cotação com mais de 1 elevador) nunca aparecia aqui,
     mesmo com o dado certo (bug real na cotação 950). */
  const lista = (ed.especificacoes && ed.especificacoes.length) ? (window.PropostaOpcoes ? window.PropostaOpcoes.ordenarEspecs(ed.especificacoes) : ed.especificacoes) : [{}];
  const blocos = lista.map((s) => ({
    id: s.id,
    linhas: montarLinhasEspec(s),
  }));
  const temConteudo = blocos.some((b) => b.linhas.length);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Especificações Técnicas</h2>
        <div className="pdf-sec-rule"/>
        {temConteudo ? blocos.map((b, i) => b.linhas.length ? (
          <div key={i} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            {blocos.length > 1 ? null : <h3 className="pdf-sub-title">Características Principais</h3>}
            <table className="pdf-table2">
              <thead><tr><th>Característica</th><th>{b.id || "Elevador de Passageiros"}</th></tr></thead>
              <tbody>{b.linhas.map(([k, v], j) => <tr key={j}><td>{k}</td><td>{v}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null) : <Vazio>Preencha as especificações técnicas na aba "Especificações Técnicas".</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

/* ---------- Página 7: Acabamento (tabela) ---------- */
function PreviewAcabamentoTabela({ data }) {
  const ed = data.elevador;
  /* Blocos vêm de PropostaOpcoes.perfisAcabamento (fonte única de preview e PDF): 1 por perfil de tipo
     (Carga / Passageiro / Panorâmico) quando a proposta tem perfis; senão 1 bloco global, como sempre — só os campos
     marcados "ativo" e preenchidos entram (acabamentosCats, ou o formato fixo da proposta antiga). */
  const O = window.PropostaOpcoes;
  const blocos = O ? O.perfisAcabamento(ed) : [];
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Acabamento</h2>
        <div className="pdf-sec-rule"/>
        {blocos.length ? blocos.map((b) => (
          <div key={b.id} style={{ breakInside: "avoid", marginBottom: 14 }}>
            {b.nome ? <h3 className="pdf-sub-title">{O.tituloPerfil(b)}</h3> : null}
            <table className="pdf-table2">
              <thead><tr><th>Item</th><th>{b.rotulo}</th></tr></thead>
              <tbody>{b.linhas.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody>
            </table>
          </div>
        )) : <Vazio>Preencha os acabamentos na aba "Acabamentos".</Vazio>}
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
/* Duas modalidades de entrega (Financeiro, 01/10/2026): enquanto o cliente não
   escolheu, as duas aparecem — cada uma com suas características, tabela de
   preços e cronograma, e um campo de escolha. Ao escolher (na assinatura), a
   outra deixa de aparecer: o documento volta ao formato de sempre (PreviewValoresTabelas
   com os valores da modalidade escolhida). Ver proposta-opcoes.js. */
function PreviewValoresOpcoes({ data }) {
  const ops = window.PropostaOpcoes.opcoes(data) || [];
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Valores e Pagamento</h2>
        <div className="pdf-sec-rule"/>
        <p>Esta proposta traz duas modalidades de entrega. Escolha a que melhor atende o seu cronograma — ao escolher uma, a outra deixa de valer.</p>
        {ops.map((o) => (
          <div key={o.id} data-opcao-entrega={o.id} style={{ border: "1px solid #d9d9d9", borderRadius: 6, padding: "10px 14px", marginTop: 14 }}>
            <h3 className="pdf-sub-title" style={{ marginTop: 0 }}>{o.titulo} <span style={{ fontWeight: 400, opacity: 0.7 }}>— {o.rotulo}</span></h3>
            {o.caracteristicas.map((c, i) => <p key={i} style={{ margin: "2px 0" }}>{c}</p>)}
            <table className="pdf-table2" style={{ marginTop: 8 }}>
              <thead><tr><th>Equipamento</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                <tr><td>{o.equipamento}</td><td style={{ textAlign: "right" }}><b>{fmt(o.totalEquipamento)}</b></td></tr>
                <tr className="pdf-total-row"><td>Total — {o.titulo.toLowerCase()}</td><td style={{ textAlign: "right" }}>{fmt(o.total)}</td></tr>
              </tbody>
            </table>
            {o.parcelas.length ? (
              <table className="pdf-table2" style={{ marginTop: 8 }}>
                <thead><tr><th>Cronograma de Pagamento</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
                <tbody>
                  {o.parcelas.map((p, i) => <tr key={i}><td>{p.desc || "—"}</td><td style={{ textAlign: "right" }}>{p.valor ? "R$ " + p.valor : "—"}</td></tr>)}
                  <tr className="pdf-total-row"><td>Total Parcelado</td><td style={{ textAlign: "right" }}>{fmt(o.totalParcelas)}</td></tr>
                </tbody>
              </table>
            ) : null}
            <p style={{ marginTop: 10, fontWeight: 700 }}>☐ Escolho a modalidade: {o.titulo}</p>
          </div>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

function PreviewValoresTabelas({ data }) {
  if (window.PropostaOpcoes && window.PropostaOpcoes.temOpcoes(data)) return <PreviewValoresOpcoes data={data}/>;
  const modalidade = window.PropostaOpcoes ? window.PropostaOpcoes.modalidadeEscolhida(data) : null;
  const v = data.elevador.valores;
  const parcelas = v.parcelas || [];
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalParcelas = parcelas.reduce((s, p) => s + (parseFloat((p.valor || "0").toString().replace(/\./g, "").replace(",", ".")) || 0), 0);

  /* v.itens (mais de 1 equipamento na cotação): uma linha por unidade em vez
     de uma linha só somando tudo — sem isso 2 elevadores viravam "GEF, GEP"
     numa linha única (bug real na cotação 950). Sem itens (caso de sempre,
     proposta com 1 equipamento só), cai no formato antigo de sempre. */
  /* 10/10/2026 (Financeiro): uma linha por EQUIPAMENTO físico (27 = 27 linhas, cada uma com o valor
     unitário) e o DIFAL à parte do total dos equipamentos. Desconto ativo (Frentes B+C): valor original
     riscado ao lado do atual — vem em `original` de linhasUnitarias. */
  const linhas = window.PropostaOpcoes ? window.PropostaOpcoes.linhasUnitarias(data) : [];
  const totalEq = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Valores e Pagamento</h2>
        <div className="pdf-sec-rule"/>

        {modalidade && <p><b>Modalidade de entrega escolhida:</b> {modalidade.titulo} — {modalidade.rotulo}.</p>}
        <h3 className="pdf-sub-title">Preços dos Equipamentos</h3>
        <table className="pdf-table2">
          <thead><tr><th>Equipamento</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>{l.equipamento || "Elevador de Passageiros"}</td>
                <td style={{ textAlign: "right" }}>
                  {l.original != null && <span style={{ textDecoration: "line-through", opacity: 0.6, marginRight: 6 }}>{fmt(l.original)}</span>}
                  <b>{l.total ? fmt(l.total) : "—"}</b>
                </td>
              </tr>
            ))}
            <tr className="pdf-total-row"><td>Total Equipamentos</td><td style={{ textAlign: "right" }}>{fmt(totalEq)}</td></tr>
          </tbody>
        </table>

        {parcelas.length ? (
          <>
            <h3 className="pdf-sub-title">Cronograma de Pagamento</h3>
            {v.forma ? <p>Forma de pagamento: {v.forma}</p> : null}
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
  const blocos = window.PropostaOpcoes.blocosCondicoes(data.elevador);
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
  const blocos = window.PropostaOpcoes ? window.PropostaOpcoes.blocosAjustes(data.elevador) : [];
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
   Escada / Esteira — páginas próprias do equipamento (15/10/2026). Recebem `data` com `data.elevador`
   = bloco do equipamento (ver PEPreview). Regras/linhas em PropostaOpcoes (fonte única com o PDF).
   ============================================================ */
function PreviewSaudacaoEscEst({ data, eq }) {
  const OP = window.PropostaOpcoes;
  const info = OP.eqInfo(eq);
  const ed = data.elevador;
  const rows = OP.resumoEscEst(ed.especificacoes, eq);
  const qtd = ed.valores?.quantidade || String(rows.reduce((s, r) => s + (Number(r.qtd) || 0), 0) || 1);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <p>Prezados Senhores(as):</p>
        <p>Proposta Comercial para o fornecimento de {info.pluralTxt(qtd)}.</p>
        {rows.length ? (
          <table className="pdf-table2" style={{ fontSize: "0.86em" }}>
            <thead><tr><th>Equipamento</th><th>Empreendimento</th><th>Inclinação</th><th>{eq === "esteira" ? "Desnível / Comp." : "Desnível"}</th><th style={{ textAlign: "center" }}>Qtd.</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: "transparent", breakInside: "avoid" }}>
                  <td><b>{r.codigo}</b></td><td>{r.empreendimento}</td><td>{r.incl}</td><td>{r.desnivel}</td><td style={{ textAlign: "center" }}>{r.qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Vazio>Preencha as especificações técnicas do equipamento.</Vazio>}
        <p style={{ marginTop: 10 }}>Marca: VerticalParts</p>
      </div>
      <PdfFooter/>
    </div>
  );
}

function PreviewApresentacaoEscEst({ data, eq }) {
  const info = window.PropostaOpcoes.eqInfo(eq);
  const ed = data.elevador;
  const desc = (ed.descricao || []).filter((d) => d && (d.titulo || d.desc || d.beneficios || d.linha));
  const lista = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">{info.nome}</h2>
        <div className="pdf-sec-rule"/>
        {ed.textoProposta ? <p>{ed.textoProposta}</p> : <Vazio>Descreva a linha do produto neste campo.</Vazio>}
        {ed.textoModelos ? (<><h3 className="pdf-sub-title">Linha de Modelos</h3><p>{ed.textoModelos}</p></>) : null}
        {desc.map((d, i) => (
          <div key={i} style={{ breakInside: "avoid" }}>
            {d.titulo ? <h3 className="pdf-sub-title">{d.titulo}</h3> : null}
            {d.linha ? <p style={{ fontWeight: 600 }}>{d.linha}</p> : null}
            {d.desc ? <p>{d.desc}</p> : null}
            {lista(d.beneficios).length ? <ul className="pdf-list">{lista(d.beneficios).map((b, j) => <li key={j}>{b}</li>)}</ul> : null}
          </div>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

function PreviewEspecEscEst({ data, eq }) {
  const OP = window.PropostaOpcoes;
  const info = OP.eqInfo(eq);
  const lista = (data.elevador.especificacoes && data.elevador.especificacoes.length) ? data.elevador.especificacoes : [{}];
  const blocos = lista.map((s) => ({ id: s.id, linhas: OP.linhasEspecEscEst(s, eq) }));
  const temConteudo = blocos.some((b) => b.linhas.length);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Especificações Técnicas</h2>
        <div className="pdf-sec-rule"/>
        {temConteudo ? blocos.map((b, i) => b.linhas.length ? (
          <div key={i} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            {blocos.length > 1 ? null : <h3 className="pdf-sub-title">Características Principais</h3>}
            <table className="pdf-table2">
              <thead><tr><th>Característica</th><th>{b.id || info.nome}</th></tr></thead>
              <tbody>{b.linhas.map(([k, v], j) => <tr key={j}><td>{k}</td><td>{v}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null) : <Vazio>Preencha as especificações técnicas na aba "Especificações Técnicas".</Vazio>}
      </div>
      <PdfFooter/>
    </div>
  );
}

function PreviewEspecificidades({ data, eq }) {
  const OP = window.PropostaOpcoes;
  const linhas = OP.linhasEspecificidades(data.elevador, eq);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Especificidades</h2>
        <div className="pdf-sec-rule"/>
        <table className="pdf-table2">
          <thead><tr><th>Item</th><th>{OP.eqInfo(eq).nome}</th></tr></thead>
          <tbody>{linhas.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody>
        </table>
      </div>
      <PdfFooter/>
    </div>
  );
}

/* Lista nome + texto (Acabamento / Características Técnicas) — o texto da página cresce (min-height) como no elevador. */
function PreviewListaNomeada({ data, titulo, itens }) {
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">{titulo}</h2>
        <div className="pdf-sec-rule"/>
        {itens.map((it, i) => (
          <div key={i} style={{ breakInside: "avoid", marginBottom: 10 }}>
            <h3 className="pdf-sub-title" style={{ textTransform: "uppercase", marginBottom: 2 }}>{it.nome}:</h3>
            <p style={{ margin: 0 }}>{it.desc}</p>
          </div>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}
function PreviewAcabamentoEscEst({ data }) {
  return <PreviewListaNomeada data={data} titulo="Acabamento" itens={window.PropostaOpcoes.itensNomeados(data.elevador.acabamentosLista)}/>;
}
function PreviewCaracTecEscEst({ data }) {
  return <PreviewListaNomeada data={data} titulo="Características Técnicas" itens={window.PropostaOpcoes.itensNomeados(data.elevador.caracteristicasTec)}/>;
}

function PreviewInstalacao({ data }) {
  const blocos = window.PropostaOpcoes.blocosInstalacao(data.elevador);
  return (
    <div className="pe__pdf">
      <div className="pe__pdf-inner">
        <PdfHeader numero={data.numero}/>
        <h2 className="pdf-sec-title">Instalação e Montagem</h2>
        <div className="pdf-sec-rule"/>
        {blocos.map(([t, txt], i) => (
          <React.Fragment key={i}><h3 className="pdf-sub-title">{t}</h3><p>{txt}</p></React.Fragment>
        ))}
      </div>
      <PdfFooter/>
    </div>
  );
}

Object.assign(window, { PEPreview });
