/* ============================================================
   proposta-form.jsx — Form primitives + section components
   Used by proposta-editor.jsx
   ============================================================ */

/* ---- UF list (only canonical list we have) ---- */
const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/* ---- Official option lists (provided by user) ---- */
const OPTIONS = {
  // Elevador — Descrição do Produto
  elevTitulo: [
    "Elevador de Passageiros VPELEV VP-P",
    "Elevador de Passageiros/Carga VPELEV VP-E",
    "Elevador de Passageiros/MACA VPELEV VP-Y",
    "Elevador Panorâmico VPELEV VP-G",
    "Elevador Homelift VPELEV VP-V",
    "Elevador para Automóveis - VPELEV VP-A",
    "Elevador Plataforma VPELEV VP -X",
  ],
  elevLinha: [
    "VPEL-MRL-PASSAGEIROS",
    "VPEL-SMR-PASSAGEIROS",
  ],
  elevTipo: [
    "COM CASA DE MÁQUINAS",
    "SEM CASA DE MÁQUINAS",
  ],
  elevNorma: [
    "16858-1/2",
    "16858-1/2/3",
    "12892",
  ],

  // Tipo de Empreendimento — by equipment
  empreendimentoElev: ["Residencial", "Comercial", "Supermercado", "Shopping", "Hospital"],
  empreendimentoEsc:  ["Comercial", "Supermercado", "Shopping", "Hospital", "Aeroporto"],
  empreendimentoEst:  ["Supermercado", "Shopping", "Aeroporto"],

  caracTransporteElev: ["Passageiros", "Passageiros/Carga", "Passageiros/Maca", "Automóvel", "Homelift"],
  caracTransporteEsc:  ["Alto Tráfego", "Comercial"],
  caracTransporteEst:  ["Alto Tráfego", "Comercial"],

  // Elevador — Acabamentos
  modeloCabine: ["VP-004","VP-200","VP-221","VP-224","VP-228","VP-229","VP-230","VP-301","VP-302","VPY","HC165","HC160"],
  acabamentoMaterial: ["Aço Inox - 304", "Aço Inox - 430", "Aço pintado", "Aço Inox com painel traseiro espelhado"],
  subTeto: ["SUB-001","SUB-002","SUB-004","SUB-005","SUB-006","SUB-007"],
  painelOperacao: ["COP-05","CCOP-04","CCOP-05C – TFT","COP-017TFT","COP-029","COP-030","COP-027","Black Vision Glass"],
  pisoCabina: ["Mármore Resinado","Rebaixo 20 mm","Rebaixo 25 mm","PVC","Antiderrapante"],
  modeloPorta: ["Automática Central","Automática Lateral","Eixo Vertical"],
  acabPortaCabine: ["Inox","Inox 304","Aço pintado","Aço espelhado"],
  portasPavimento: ["Inox","Inox 304","Aço pintado","Aço espelhado"],
  botoeirasPavimento: ["LOP - 12 C","LOP - 35","LOP - 36","LOP - 41"],

  // Escada Rolante
  escTitulo: ["Escada Rolante - OAK", "Escada Rolante - BULOKE"],
  inclinacaoEsc: ["30º", "35º"],
  larguraDegrau: ["600mm", "800mm", "1000mm"],
  balaustradaEsc: ["900mm", "1000mm"],
  velocidadeEsc: ["0.5 m/s", "0.65 m/s", "0.75 m/s"],
  alimentacaoEsc: ["380V Trifásico", "220V Trifásico"],
  arranjoEsc: ["Paralelo", "Cruzada", "Simples"],
  maquinaEsc: ["Superior", "Externa"],

  // Esteira Rolante
  inclinacaoEst: ["0º", "10º", "11º", "12º"],
  larguraPallet: ["800mm", "1000mm"],
  balaustradaEst: ["900mm", "1000mm"],
  velocidadeEst: ["0.5 m/s", "0.65 m/s"],
  alimentacaoEst: ["Trifásico 380V", "Trifásico 220V"],
  arranjoEst: ["Paralelo", "Cruzada", "Simples"],
  maquinaEst: ["Superior", "Fosso"],
};

const FIXED = {
  emailDomain: "@verticalparts.com.br",
  telefoneFixo: "+55 11 2528-6473",
  enderecoVP: "Rua Armandina Braga de Almeida, 383",
};

/* ---- Field primitives ---- */
function PEField({ label, required, tag, help, children, span }) {
  const cls = span ? `pe-field span-${span}` : "pe-field";
  return (
    <div className={cls}>
      <div className="pe-field-label">
        {label}
        {required ? <span className="pe-req">*</span> : null}
        {tag ? <span className="pe-tag">{tag}</span> : null}
      </div>
      {children}
      {help ? <div className="pe-field-help">{help}</div> : null}
    </div>
  );
}

function PETextInput({ value, onChange, placeholder, type = "text", ...rest }) {
  return <input className="pe-input" type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} {...rest}/>;
}
function PETextarea({ value, onChange, placeholder, rows = 4, ...rest }) {
  return <textarea className="pe-input" rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} {...rest}/>;
}
function PECurrency({ value, onChange, placeholder, ...rest }) {
  return (
    <div className="pe-input-grp">
      <span className="pe-input-prefix">R$</span>
      <input className="pe-input" type="text" inputMode="decimal" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "0,00"} {...rest}/>
    </div>
  );
}
function PENumber({ value, onChange, placeholder, suffix, ...rest }) {
  return (
    <div className={"pe-input-grp" + (suffix ? " has-suffix" : "")}>
      <input className="pe-input" type="number" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "0"} {...rest}/>
      {suffix ? <span className="pe-input-suffix">{suffix}</span> : null}
    </div>
  );
}
function PESelect({ value, onChange, options, placeholder }) {
  const opts = options || [];
  if (opts.length === 0) {
    return (
      <select className="pe-input is-empty" disabled>
        <option>Aguardando lista oficial</option>
      </select>
    );
  }
  return (
    <select className={"pe-input" + (!value ? " is-empty" : "")} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || "Selecione..."}</option>
      {opts.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}
function PECalc({ value }) {
  return <input className="pe-input is-calc" type="text" value={value || "—"} readOnly/>;
}

/* email-prefix input: user types only the part before @, domain is fixed */
function PEEmailPrefix({ value, onChange, placeholder, domain = FIXED.emailDomain }) {
  // value is full email; we display only prefix
  const prefix = (value || "").split("@")[0];
  return (
    <div className="pe-input-grp has-suffix">
      <input className="pe-input" type="text" value={prefix}
        onChange={(e) => onChange(e.target.value ? e.target.value + domain : "")}
        placeholder={placeholder || "seu.nome"} style={{ paddingLeft: 12 }}/>
      <span className="pe-input-suffix" style={{ fontSize: 11 }}>{domain}</span>
    </div>
  );
}
function PEPresets({ value, onChange, options }) {
  return (
    <div className="pe-presets">
      {options.map(o => (
        <button key={o.value} type="button" className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
          {o.sub ? <span className="pe-presets-sub">{o.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---- Section wrapper ---- */
function PESection({ id, num, title, sub, fill, collapsed, onToggle, children }) {
  return (
    <div id={"sec-" + id} className={"pe__section" + (collapsed ? " collapsed" : "")}>
      <div className="pe__section-head" onClick={onToggle}>
        <span className="pe__section-num">{num}</span>
        <h3>{title}</h3>
        {sub ? <span className="pe__section-sub">{sub}</span> : null}
        {fill ? <span className={"pe__section-fill " + fill.kind}>{fill.label}</span> : null}
        <span className="pe__section-chev"><Icon.chevDown size={16}/></span>
      </div>
      <div className="pe__section-body">
        {children}
      </div>
    </div>
  );
}

/* ---- Repeatable block (header w/ idx + delete + duplicate) ---- */
function PERep({ idx, total, title, onDelete, onDuplicate, children }) {
  return (
    <div className="pe-rep">
      <div className="pe-rep__head">
        <div>
          <span className="pe-rep__idx">{String(idx + 1).padStart(2, "0")}</span>
          {title} {total > 1 ? <span style={{ opacity: .55, fontFamily: "var(--font-mono)", fontSize: 11, marginLeft: 6 }}>de {total}</span> : null}
        </div>
        <div className="pe-rep__head-actions">
          {onDuplicate ? <button type="button" onClick={onDuplicate} title="Duplicar"><Icon.copy size={12}/></button> : null}
          {total > 1 ? <button type="button" className="danger" onClick={onDelete} title="Remover"><Icon.trash size={12}/></button> : null}
        </div>
      </div>
      <div className="pe-rep__body">
        {children}
      </div>
    </div>
  );
}
function PERepAdd({ label, onAdd }) {
  return (
    <button type="button" className="pe-rep-add" onClick={onAdd}>
      <Icon.plus size={14}/>
      {label}
    </button>
  );
}

/* ============================================================
   SECTION COMPONENTS
   Each receives `data`, `setField(path, value)`, plus helpers
   ============================================================ */

function S_Proposta({ d, set, herdar, herdando, heranca }) {
  return (
    <div className="pe-grid cols-3">
      {/* Porta de entrada do pipeline: com o Nº da Cotação a proposta puxa
          cliente, obra, equipamentos e valores já coletados. Em branco, o
          vendedor monta a proposta do zero normalmente. */}
      <PEField label="Nº da Cotação" span="3"
        help="Informe o nº para herdar cliente, obra, equipamentos e valores já coletados no fluxo. Deixe vazio para preencher do zero.">
        <div className="pe-heranca">
          <input className="pe-input" inputMode="numeric" placeholder="ex.: 902"
            value={d.numeroCotacao || ""}
            onChange={(e) => set("numeroCotacao", e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); herdar && herdar(); } }}/>
          <button type="button" className="pe-heranca__btn"
            disabled={herdando || !String(d.numeroCotacao || "").trim()}
            onClick={() => herdar && herdar()}>
            {herdando ? "Buscando…" : "Herdar dados"}
          </button>
        </div>
        {heranca ? <div className={"pe-heranca__msg is-" + heranca.tipo}>{heranca.texto}</div> : null}
      </PEField>

      <PEField label="Nº da Proposta" required>
        <PETextInput value={d.numero} onChange={(v) => set("numero", v)} placeholder="VP-2025-000"/>
      </PEField>
      <PEField label="Linha de Data">
        <PETextInput value={d.dataLinha} onChange={(v) => set("dataLinha", v)} placeholder="Guarulhos, 26 de Novembro de 2025"/>
      </PEField>
      <PEField label="Validade">
        <PETextInput value={d.validade} onChange={(v) => set("validade", v)} placeholder="30 dias"/>
      </PEField>

      <PEField label="Nome do Vendedor" required>
        <PETextInput value={d.vendedor.nome} onChange={(v) => set("vendedor.nome", v)} placeholder="Seu Nome"/>
      </PEField>
      <PEField label="Celular / WhatsApp" required>
        <PETextInput value={d.vendedor.celular} onChange={(v) => set("vendedor.celular", v)} placeholder="(11) 99999-9999"/>
      </PEField>
      <PEField label="Telefone Fixo" tag="VerticalParts">
        <PETextInput value={d.vendedor.fixo} onChange={(v) => set("vendedor.fixo", v)} placeholder={FIXED.telefoneFixo}/>
      </PEField>
      <PEField label="E-mail do Vendedor" required span="3" help={"Domínio fixo: " + FIXED.emailDomain}>
        <PEEmailPrefix value={d.vendedor.email} onChange={(v) => set("vendedor.email", v)}/>
      </PEField>
    </div>
  );
}

function S_Cliente({ d, set }) {
  return (
    <div className="pe-grid cols-3">
      <PEField label="Nome do Cliente" required span="2">
        <PETextInput value={d.cliente.nome} onChange={(v) => set("cliente.nome", v)} placeholder="Nome do cliente / empresa"/>
      </PEField>
      <PEField label="CNPJ" required>
        <PETextInput value={d.cliente.cnpj} onChange={(v) => set("cliente.cnpj", v)} placeholder="00.000.000/0001-00"/>
      </PEField>

      <PEField label="A/C Responsável" span="2">
        <PETextInput value={d.cliente.responsavel} onChange={(v) => set("cliente.responsavel", v)} placeholder="Nome — Cargo"/>
      </PEField>
      <PEField label="Telefone">
        <PETextInput value={d.cliente.telefone} onChange={(v) => set("cliente.telefone", v)} placeholder="(11) 0000-0000"/>
      </PEField>

      <PEField label="E-mail" span="3">
        <PETextInput type="email" value={d.cliente.email} onChange={(v) => set("cliente.email", v)} placeholder="email@cliente.com.br"/>
      </PEField>

      <PEField label="Endereço" span="2">
        <PETextInput value={d.cliente.endereco} onChange={(v) => set("cliente.endereco", v)} placeholder="Rua / Av."/>
      </PEField>
      <PEField label="Número">
        <PENumber value={d.cliente.numero} onChange={(v) => set("cliente.numero", v)} placeholder="Nº"/>
      </PEField>
      <PEField label="Bairro">
        <PETextInput value={d.cliente.bairro} onChange={(v) => set("cliente.bairro", v)} placeholder="Bairro"/>
      </PEField>
      <PEField label="Cidade">
        <PETextInput value={d.cliente.cidade} onChange={(v) => set("cliente.cidade", v)} placeholder="Cidade"/>
      </PEField>
      <PEField label="Estado (UF)">
        <PESelect value={d.cliente.uf} onChange={(v) => set("cliente.uf", v)} options={UF_LIST} placeholder="UF"/>
      </PEField>
      <PEField label="CEP">
        <PETextInput value={d.cliente.cep} onChange={(v) => set("cliente.cep", v)} placeholder="00000-000"/>
      </PEField>
    </div>
  );
}

function S_Obra({ d, set }) {
  return (
    <div className="pe-grid cols-3">
      <PEField label="Nome do Empreendimento" required span="3">
        <PETextInput value={d.obra.nome} onChange={(v) => set("obra.nome", v)} placeholder="Nome do empreendimento"/>
      </PEField>

      <PEField label="Endereço" span="2">
        <PETextInput value={d.obra.endereco} onChange={(v) => set("obra.endereco", v)} placeholder="Rua / Av."/>
      </PEField>
      <PEField label="Número">
        <PENumber value={d.obra.numero} onChange={(v) => set("obra.numero", v)} placeholder="Nº"/>
      </PEField>
      <PEField label="Bairro">
        <PETextInput value={d.obra.bairro} onChange={(v) => set("obra.bairro", v)} placeholder="Bairro"/>
      </PEField>
      <PEField label="Cidade">
        <PETextInput value={d.obra.cidade} onChange={(v) => set("obra.cidade", v)} placeholder="Cidade"/>
      </PEField>
      <PEField label="Estado (UF)">
        <PESelect value={d.obra.uf} onChange={(v) => set("obra.uf", v)} options={UF_LIST}/>
      </PEField>
      <PEField label="CEP" span="3">
        <PETextInput value={d.obra.cep} onChange={(v) => set("obra.cep", v)} placeholder="00000-000"/>
      </PEField>
    </div>
  );
}

function S_TextoProposta({ d, set, eq }) {
  return (
    <div className="pe-grid cols-1">
      <PEField label="Texto da Proposta" tag="abertura comercial">
        <PETextarea rows={4} value={d[eq].textoProposta} onChange={(v) => set(`${eq}.textoProposta`, v)} placeholder="Prezado(a) cliente, é com satisfação que apresentamos nossa proposta comercial..."/>
      </PEField>
      <PEField label="Texto de Modelos" tag="descrição da linha">
        <PETextarea rows={3} value={d[eq].textoModelos} onChange={(v) => set(`${eq}.textoModelos`, v)} placeholder="Linha de elevadores VB 2405 com tecnologia gearless e padrão internacional..."/>
      </PEField>
    </div>
  );
}

/* === ELEVADOR === */
function S_DescricaoElevador({ d, set }) {
  const items = d.elevador.descricao;
  const update = (i, k, v) => {
    const arr = [...items];
    arr[i] = { ...arr[i], [k]: v };
    set("elevador.descricao", arr);
  };
  const add = () => set("elevador.descricao", [...items, { titulo: "", linha: "", tipo: "", norma: "", piso: "" }]);
  const remove = (i) => set("elevador.descricao", items.filter((_, j) => j !== i));
  const dup = (i) => { const arr = [...items]; arr.splice(i + 1, 0, { ...items[i] }); set("elevador.descricao", arr); };

  return (
    <>
      {items.map((it, i) => (
        <PERep key={i} idx={i} total={items.length} title="Descrição do Produto"
          onDelete={() => remove(i)} onDuplicate={() => dup(i)}>
          <div className="pe-grid cols-2">
            <PEField label="Título" span="2"><PESelect value={it.titulo} onChange={(v) => update(i, "titulo", v)} options={OPTIONS.elevTitulo} placeholder="Selecione o modelo"/></PEField>
            <PEField label="Linha do Produto"><PESelect value={it.linha} onChange={(v) => update(i, "linha", v)} options={OPTIONS.elevLinha}/></PEField>
            <PEField label="Tipo de Elevador"><PESelect value={it.tipo} onChange={(v) => update(i, "tipo", v)} options={OPTIONS.elevTipo}/></PEField>
            <PEField label="Norma de Projeto" tag="NBR"><PESelect value={it.norma} onChange={(v) => update(i, "norma", v)} options={OPTIONS.elevNorma}/></PEField>
            <PEField label="Tipo de Piso / Diferencial"><PETextInput value={it.piso} onChange={(v) => update(i, "piso", v)} placeholder="Mármore resinado, rebaixo 25mm"/></PEField>
          </div>
        </PERep>
      ))}
      <PERepAdd label="+ Adicionar Produto" onAdd={add}/>
    </>
  );
}

function S_EspecElevador({ d, set }) {
  const items = d.elevador.especificacoes;
  const update = (i, k, v) => { const arr = [...items]; arr[i] = { ...arr[i], [k]: v }; set("elevador.especificacoes", arr); };
  const add = () => set("elevador.especificacoes", [...items, { id: "", modelo: "", empreendimento: "", carac: "", denominacao: "", percurso: "", capacidade: "", dimensoesCaixa: "", profPoço: "", vel: "", andaresParadasPortas: "", qtd: 1 }]);
  const remove = (i) => set("elevador.especificacoes", items.filter((_, j) => j !== i));
  const dup = (i) => { const arr = [...items]; arr.splice(i + 1, 0, { ...items[i] }); set("elevador.especificacoes", arr); };

  return (
    <>
      {items.map((it, i) => (
        <PERep key={i} idx={i} total={items.length} title="Unidade — Especificação Técnica"
          onDelete={() => remove(i)} onDuplicate={() => dup(i)}>
          <div className="pe-grid cols-3">
            <PEField label="Identificação do Elevador" span="2"><PETextInput value={it.id} onChange={(v) => update(i, "id", v)} placeholder="Elevador 1"/></PEField>
            <PEField label="Modelo do Equipamento"><PETextInput value={it.modelo} onChange={(v) => update(i, "modelo", v)} placeholder="SMR - Machine Room Less"/></PEField>

            <PEField label="Tipo de Empreendimento"><PESelect value={it.empreendimento} onChange={(v) => update(i, "empreendimento", v)} options={OPTIONS.empreendimentoElev}/></PEField>
            <PEField label="Característica de Transporte"><PESelect value={it.carac} onChange={(v) => update(i, "carac", v)} options={OPTIONS.caracTransporteElev}/></PEField>
            <PEField label="Denominação dos Pavimentos"><PETextInput value={it.denominacao} onChange={(v) => update(i, "denominacao", v)} placeholder="(-1, 0, 1 à 16)"/></PEField>

            <PEField label="Percurso" tag="mm"><PENumber value={it.percurso} onChange={(v) => update(i, "percurso", v)} suffix="mm" placeholder="51000"/></PEField>
            <PEField label="Capacidade" tag="Pass × Kg"><PETextInput value={it.capacidade} onChange={(v) => update(i, "capacidade", v)} placeholder="06 Passageiros x 450Kg"/></PEField>
            <PEField label="Dimensões da Caixa" tag="LxP mm"><PETextInput value={it.dimensoesCaixa} onChange={(v) => update(i, "dimensoesCaixa", v)} placeholder="1600 x 1840mm"/></PEField>

            <PEField label="Profundidade do Poço" tag="mm"><PENumber value={it.profPoço} onChange={(v) => update(i, "profPoço", v)} suffix="mm" placeholder="1500"/></PEField>
            <PEField label="Velocidade" tag="m/s"><PENumber value={it.vel} onChange={(v) => update(i, "vel", v)} suffix="m/s" placeholder="1"/></PEField>
            <PEField label="Andares / Paradas / Portas"><PETextInput value={it.andaresParadasPortas} onChange={(v) => update(i, "andaresParadasPortas", v)} placeholder="18 Paradas (-1, 0, 1 a 16)"/></PEField>

            <PEField label="Quantidade" required><PENumber value={it.qtd} onChange={(v) => update(i, "qtd", v)} placeholder="1"/></PEField>
          </div>
        </PERep>
      ))}
      <PERepAdd label="+ Adicionar Unidade" onAdd={add}/>
    </>
  );
}

function S_Acabamentos({ d, set, eq = "elevador" }) {
  const a = d.elevador.acabamentos;
  const u = (k) => (v) => set(`elevador.acabamentos.${k}`, v);
  return (
    <div className="pe-grid cols-2">
      <PEField label="Modelo da Cabine"><PESelect value={a.modeloCabine} onChange={u("modeloCabine")} options={OPTIONS.modeloCabine}/></PEField>
      <PEField label="Acabamento (material)"><PESelect value={a.acabamentoMat} onChange={u("acabamentoMat")} options={OPTIONS.acabamentoMaterial}/></PEField>
      <PEField label="Sub-teto"><PESelect value={a.subTeto} onChange={u("subTeto")} options={OPTIONS.subTeto}/></PEField>
      <PEField label="Painel de Operação / Botoeira de Cabine"><PESelect value={a.painelOperacao} onChange={u("painelOperacao")} options={OPTIONS.painelOperacao}/></PEField>

      <PEField label="Piso da Cabina"><PESelect value={a.pisoCabina} onChange={u("pisoCabina")} options={OPTIONS.pisoCabina}/></PEField>
      <PEField label="Medidas do Piso"><PETextInput value={a.medidasPiso} onChange={u("medidasPiso")} placeholder="800 x 2100mm"/></PEField>

      <PEField label="Modelo de Porta"><PESelect value={a.modeloPorta} onChange={u("modeloPorta")} options={OPTIONS.modeloPorta}/></PEField>
      <PEField label="Dimensão da Porta de Cabine" tag="mm"><PETextInput value={a.dimPortaCabine} onChange={u("dimPortaCabine")} placeholder="800x2100mm"/></PEField>

      <PEField label="Acabamento Porta Cabine"><PESelect value={a.acabPortaCabine} onChange={u("acabPortaCabine")} options={OPTIONS.acabPortaCabine}/></PEField>
      <PEField label="Portas de Pavimento"><PESelect value={a.portasPavimento} onChange={u("portasPavimento")} options={OPTIONS.portasPavimento}/></PEField>

      <PEField label="Botoeiras de Pavimento"><PESelect value={a.botoeirasPavimento} onChange={u("botoeirasPavimento")} options={OPTIONS.botoeirasPavimento}/></PEField>
      <PEField label="Sinalização"><PETextInput value={a.sinalizacao} onChange={u("sinalizacao")} placeholder="Display TFT 4.3'' colorido"/></PEField>

      <PEField label="Pavimentos com acabamento Inox" span="2" help="Demais pavimentos receberão pintura padrão."><PETextInput value={a.pavInox} onChange={u("pavInox")} placeholder="0 inox e demais Pintura"/></PEField>
      <PEField label="Demais acabamentos" span="2"><PETextarea rows={2} value={a.demais} onChange={u("demais")} placeholder="Corrimão tubular inox, espelho 3/4, ventilação 80m³/h..."/></PEField>
    </div>
  );
}

function S_RepText({ items, setItems, addLabel, placeholder, single = false }) {
  const update = (i, v) => { const arr = [...items]; arr[i] = v; setItems(arr); };
  const add = () => setItems([...items, ""]);
  const remove = (i) => setItems(items.filter((_, j) => j !== i));

  return (
    <div className="pe-grid cols-1">
      {items.map((it, i) => (
        <div key={i} style={{ position: "relative" }}>
          <PETextarea rows={2} value={it} onChange={(v) => update(i, v)} placeholder={placeholder}/>
          {!single && items.length > 1 ? (
            <button type="button" onClick={() => remove(i)} className="pe-parcela-row__del"
              style={{ position: "absolute", top: 0, right: 0, height: 32, width: 32 }}>
              <Icon.x size={12}/>
            </button>
          ) : null}
        </div>
      ))}
      {!single ? <PERepAdd label={addLabel} onAdd={add}/> : null}
    </div>
  );
}

function S_Valores({ d, set, eq }) {
  const v = d[eq].valores;
  const u = (k) => (val) => set(`${eq}.valores.${k}`, val);
  const parcelas = v.parcelas || [];
  const setParcelas = (arr) => set(`${eq}.valores.parcelas`, arr);

  const qtd = parseFloat(v.quantidade) || 0;
  const unit = parseFloat((v.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const difal = parseFloat((v.difal || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const totalEq = qtd * unit;
  const totalDifal = totalEq + difal;

  const formatBR = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formaPagLabel = eq === "esteira" ? "Condições de Pagamento" : "Forma de Pagamento";

  return (
    <>
      <div className="pe-grid cols-4">
        <PEField label="Equipamento" span="2">
          <PETextInput value={v.equipamento} onChange={u("equipamento")} placeholder={
            eq === "elevador" ? "Elevador VB 2405 — Configuração A" :
            eq === "escada" ? "Escada Rolante VP-ER 4000" :
            "Esteira Rolante VP-ET 6000"
          }/>
        </PEField>
        <PEField label="Quantidade"><PENumber value={v.quantidade} onChange={u("quantidade")} placeholder="1"/></PEField>
        <PEField label="Valor Unitário"><PECurrency value={v.valorUnit} onChange={u("valorUnit")} placeholder="480.000,00"/></PEField>
        <PEField label="DIFAL" tag="diferencial alíquota"><PECurrency value={v.difal} onChange={u("difal")} placeholder="0,00"/></PEField>
        <PEField label={formaPagLabel} span="3"><PESelect value={v.forma} onChange={u("forma")}/></PEField>
      </div>

      <div style={{ marginTop: 18, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="pe-field-label">Parcelas <span className="pe-tag">{parcelas.length} parcela{parcelas.length !== 1 ? "s" : ""}</span></div>
      </div>

      {parcelas.map((p, i) => (
        <div key={i} className="pe-parcela-row">
          <span className="pe-parcela-row__idx">{i + 1}</span>
          <input className="pe-input" value={p.desc || ""} onChange={(e) => { const a = [...parcelas]; a[i] = { ...a[i], desc: e.target.value }; setParcelas(a); }} placeholder="30% — Entrada (assinatura)"/>
          <div className="pe-input-grp"><span className="pe-input-prefix">R$</span><input className="pe-input" value={p.valor || ""} onChange={(e) => { const a = [...parcelas]; a[i] = { ...a[i], valor: e.target.value }; setParcelas(a); }} placeholder="144.000,00"/></div>
          <button type="button" className="pe-parcela-row__del" onClick={() => setParcelas(parcelas.filter((_, j) => j !== i))}><Icon.x size={12}/></button>
        </div>
      ))}
      <PERepAdd label="+ Adicionar Parcela" onAdd={() => setParcelas([...parcelas, { desc: "", valor: "" }])}/>

      <div className="pe-totais">
        <div className="pe-totais-row">
          <span>Total dos Equipamentos</span>
          <b>R$ {formatBR(totalEq)}</b>
        </div>
        <div className="pe-totais-row">
          <span>DIFAL aplicado</span>
          <b>R$ {formatBR(difal)}</b>
        </div>
        <div className="pe-totais-row final">
          <span>Total com DIFAL</span>
          <b>R$ {formatBR(totalDifal)}</b>
        </div>
      </div>
    </>
  );
}

function S_Ajustes({ d, set, eq }) {
  const a = d[eq].ajustes;
  const u = (k) => (v) => set(`${eq}.ajustes.${k}`, v);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="pe-field-label" style={{ marginBottom: 6 }}>Preset Financeiro</div>
        <PEPresets value={a.preset} onChange={u("preset")} options={[
          { value: "fora", label: "Fora do Estado", sub: "DIFAL aplicável" },
          { value: "sp",   label: "São Paulo",     sub: "alíquota interna" },
          { value: "livre", label: "Diferenciado", sub: "livre / negociado" },
        ]}/>
      </div>
      <div className="pe-grid cols-3">
        <PEField label="Taxa de Câmbio" tag="USD"><PECurrency value={a.cambio} onChange={u("cambio")} placeholder="5,18"/></PEField>
        {eq === "elevador" ? <PEField label="Faturamento"><PESelect value={a.faturamento} onChange={u("faturamento")}/></PEField> : null}
        {eq !== "elevador" ? <PEField label="Valor do Frete Marítimo"><PECurrency value={a.freteMaritimo} onChange={u("freteMaritimo")} placeholder="8.400,00"/></PEField> : null}
        {eq === "esteira" ? <PEField label="Valor por Contêiner"><PECurrency value={a.fretePorContainer} onChange={u("fretePorContainer")} placeholder="3.200,00"/></PEField> : null}
        {eq === "esteira" ? <PEField label="Ajuste Frete Marítimo"><PECurrency value={a.ajusteFrete} onChange={u("ajusteFrete")} placeholder="0,00"/></PEField> : null}
        <PEField label="Reajuste" span={eq === "elevador" ? "3" : "2"}><PETextarea rows={2} value={a.reajuste} onChange={u("reajuste")} placeholder="Reajuste anual conforme IPCA acumulado..."/></PEField>
        <PEField label="Taxas e Impostos Inclusos" span="3"><PETextarea rows={2} value={a.taxasIn} onChange={u("taxasIn")} placeholder="II, IPI, PIS/COFINS sobre importação..."/></PEField>
        <PEField label="Taxas e Impostos Exclusos" span="3"><PETextarea rows={2} value={a.taxasOut} onChange={u("taxasOut")} placeholder="ICMS interestadual, taxa de inspeção CREA..."/></PEField>
      </div>
    </>
  );
}

function S_PrazoEntrega({ d, set, eq }) {
  const p = d[eq].prazo;
  const u = (k) => (v) => set(`${eq}.prazo.${k}`, v);
  return (
    <div className="pe-grid cols-1">
      <PEField label="Prazo de Entrega"><PETextInput value={p.prazo} onChange={u("prazo")} placeholder="120 dias após assinatura + 45 dias instalação"/></PEField>
      <PEField label="Condições Gerais e Covid"><PETextarea rows={3} value={p.condCovid} onChange={u("condCovid")} placeholder="Os prazos podem ser revisados em caso de eventos extraordinários relacionados a pandemia..."/></PEField>
    </div>
  );
}

function S_Responsabilidades({ d, set }) {
  const r = d.elevador.responsabilidades;
  const u = (k) => (v) => set(`elevador.responsabilidades.${k}`, v);
  return (
    <div className="pe-grid cols-2">
      <PEField label="Tipo de Serviço"><PESelect value={r.tipoServico} onChange={u("tipoServico")}/></PEField>
      <PEField label="Item de Montagem"><PETextInput value={r.itemMontagem} onChange={u("itemMontagem")} placeholder="Içamento + posicionamento + comissionamento"/></PEField>
    </div>
  );
}

function S_InstalacaoMontagem({ d, set, eq }) {
  const i = d[eq].instalacao;
  const u = (k) => (v) => set(`${eq}.instalacao.${k}`, v);
  return (
    <div className="pe-grid cols-1">
      <PEField label="Instalação e Montagem"><PETextarea rows={2} value={i.instalacao} onChange={u("instalacao")} placeholder="Equipe técnica certificada VerticalParts, supervisão de engenheiro responsável..."/></PEField>
      <PEField label="Sistema de Lubrificação"><PETextarea rows={2} value={i.lubrificacao} onChange={u("lubrificacao")} placeholder="Lubrificação inicial inclusa; manutenção periódica conforme manual..."/></PEField>
      <PEField label="Transporte e Logística"><PETextarea rows={2} value={i.transporte} onChange={u("transporte")} placeholder="CIF Santos incluso; frete nacional CD Guarulhos → obra..."/></PEField>
      <PEField label="Descarregamento e Içamento"><PETextarea rows={2} value={i.descarregamento} onChange={u("descarregamento")} placeholder="Munck 8t por conta da CONTRATADA, infraestrutura de acesso por conta do cliente..."/></PEField>
    </div>
  );
}

function S_GarantiaCondicoes({ d, set, eq }) {
  const g = d[eq].garantia;
  const u = (k) => (v) => set(`${eq}.garantia.${k}`, v);
  return (
    <div className="pe-grid cols-1">
      <PEField label="Garantia"><PETextarea rows={3} value={g.garantia} onChange={u("garantia")} placeholder="24 (vinte e quatro) meses contra defeitos de fabricação + 12 meses de serviço..."/></PEField>
      <PEField label="Condições Gerais"><PETextarea rows={4} value={g.condicoes} onChange={u("condicoes")} placeholder="Esta proposta é válida por 30 dias. Quaisquer alterações no escopo deverão ser formalizadas por aditivo..."/></PEField>
    </div>
  );
}

function S_CondPagamentoElev({ d, set }) {
  const c = d.elevador.condicoesPagto;
  const u = (k) => (v) => set(`elevador.condicoesPagto.${k}`, v);
  return (
    <div className="pe-grid cols-1">
      <PEField label="Venda de Equipamentos"><PETextarea rows={2} value={c.venda} onChange={u("venda")} placeholder="Condições aplicáveis sobre a venda dos equipamentos..."/></PEField>
      <PEField label="Impostos e Serviços"><PETextarea rows={2} value={c.impostos} onChange={u("impostos")} placeholder="Impostos sobre prestação de serviços (ISS) faturados separadamente..."/></PEField>
      <PEField label="Ajuste de Frete Marítimo"><PETextarea rows={2} value={c.ajusteFrete} onChange={u("ajusteFrete")} placeholder="Variação cambial e frete marítimo serão reajustados conforme valor de embarque..."/></PEField>
      <PEField label="Reajuste"><PETextarea rows={2} value={c.reajuste} onChange={u("reajuste")} placeholder="Reajuste anual pelo IPCA acumulado..."/></PEField>
    </div>
  );
}

/* === ESCADA / ESTEIRA — Descrição (simpler) === */
function S_DescricaoSimples({ d, set, eq }) {
  const items = d[eq].descricao;
  const update = (i, k, v) => { const arr = [...items]; arr[i] = { ...arr[i], [k]: v }; set(`${eq}.descricao`, arr); };
  const add = () => set(`${eq}.descricao`, [...items, { titulo: "", desc: "", beneficios: "" }]);
  const remove = (i) => set(`${eq}.descricao`, items.filter((_, j) => j !== i));
  const dup = (i) => { const arr = [...items]; arr.splice(i + 1, 0, { ...items[i] }); set(`${eq}.descricao`, arr); };

  return (
    <>
      {items.map((it, i) => (
        <PERep key={i} idx={i} total={items.length} title="Descrição do Produto"
          onDelete={() => remove(i)} onDuplicate={() => dup(i)}>
          <div className="pe-grid cols-1">
            <PEField label="Título">
              {eq === "escada"
                ? <PESelect value={it.titulo} onChange={(v) => update(i, "titulo", v)} options={OPTIONS.escTitulo} placeholder="Selecione o modelo"/>
                : <PETextInput value={it.titulo} onChange={(v) => update(i, "titulo", v)} placeholder="Esteira Rolante SEQUOIA -12°"/>}
            </PEField>
            <PEField label="Descrição"><PETextarea rows={3} value={it.desc} onChange={(v) => update(i, "desc", v)} placeholder="Equipamento robusto destinado a grandes fluxos..."/></PEField>
            <PEField label="Benefícios"><PETextarea rows={3} value={it.beneficios} onChange={(v) => update(i, "beneficios", v)} placeholder="• Baixo consumo energético&#10;• Manutenção simplificada&#10;• Conformidade NBR 16858"/></PEField>
          </div>
        </PERep>
      ))}
      <PERepAdd label="+ Adicionar Produto" onAdd={add}/>
    </>
  );
}

function S_EspecEscada({ d, set, eq }) {
  const items = d[eq].especificacoes;
  const update = (i, k, v) => { const arr = [...items]; arr[i] = { ...arr[i], [k]: v }; set(`${eq}.especificacoes`, arr); };
  const blank = eq === "escada"
    ? { id: "", empreendimento: "", carac: "", desnivel: "", incl: "", largDegrau: "", balaustrada: "", vel: "", alimentacao: "", arranjo: "", maquina: "", qtd: 1, valorUnit: "" }
    : { id: "", empreendimento: "", carac: "", desnivelComp: "", incl: "", largPallet: "", balaustrada: "", vel: "", alimentacao: "", arranjo: "", maquina: "", qtd: 1, valorUnit: "" };
  const add = () => set(`${eq}.especificacoes`, [...items, { ...blank }]);
  const remove = (i) => set(`${eq}.especificacoes`, items.filter((_, j) => j !== i));
  const dup = (i) => { const arr = [...items]; arr.splice(i + 1, 0, { ...items[i] }); set(`${eq}.especificacoes`, arr); };

  const empOpts = eq === "escada" ? OPTIONS.empreendimentoEsc : OPTIONS.empreendimentoEst;
  const caracOpts = eq === "escada" ? OPTIONS.caracTransporteEsc : OPTIONS.caracTransporteEst;
  const inclOpts = eq === "escada" ? OPTIONS.inclinacaoEsc : OPTIONS.inclinacaoEst;
  const balOpts = eq === "escada" ? OPTIONS.balaustradaEsc : OPTIONS.balaustradaEst;
  const velOpts = eq === "escada" ? OPTIONS.velocidadeEsc : OPTIONS.velocidadeEst;
  const alimOpts = eq === "escada" ? OPTIONS.alimentacaoEsc : OPTIONS.alimentacaoEst;
  const arranjoOpts = eq === "escada" ? OPTIONS.arranjoEsc : OPTIONS.arranjoEst;
  const maquinaOpts = eq === "escada" ? OPTIONS.maquinaEsc : OPTIONS.maquinaEst;
  const desnivelLabel = eq === "escada" ? "Desnível" : "Desnível / Comprimento";

  return (
    <>
      {items.map((it, i) => (
        <PERep key={i} idx={i} total={items.length} title={eq === "escada" ? "Unidade — Escada Rolante" : "Unidade — Esteira Rolante"}
          onDelete={() => remove(i)} onDuplicate={() => dup(i)}>
          <div className="pe-grid cols-3">
            <PEField label={eq === "escada" ? "Identificação da Escada" : "Identificação da Esteira"} span="3">
              <PETextInput value={it.id} onChange={(v) => update(i, "id", v)} placeholder={eq === "escada" ? "Escada 1" : "Esteira 1"}/>
            </PEField>

            <PEField label="Tipo de Empreendimento"><PESelect value={it.empreendimento} onChange={(v) => update(i, "empreendimento", v)} options={empOpts}/></PEField>
            <PEField label="Característica de Transporte"><PESelect value={it.carac} onChange={(v) => update(i, "carac", v)} options={caracOpts}/></PEField>
            <PEField label={desnivelLabel} tag="mm">
              {eq === "escada"
                ? <PENumber value={it.desnivel} onChange={(v) => update(i, "desnivel", v)} suffix="mm" placeholder="4500"/>
                : <PENumber value={it.desnivelComp} onChange={(v) => update(i, "desnivelComp", v)} suffix="mm" placeholder="4500"/>}
            </PEField>

            <PEField label="Inclinação"><PESelect value={it.incl} onChange={(v) => update(i, "incl", v)} options={inclOpts}/></PEField>
            {eq === "escada"
              ? <PEField label="Largura do Degrau"><PESelect value={it.largDegrau} onChange={(v) => update(i, "largDegrau", v)} options={OPTIONS.larguraDegrau}/></PEField>
              : <PEField label="Largura do Pallet"><PESelect value={it.largPallet} onChange={(v) => update(i, "largPallet", v)} options={OPTIONS.larguraPallet}/></PEField>}
            <PEField label="Altura da Balaustrada"><PESelect value={it.balaustrada} onChange={(v) => update(i, "balaustrada", v)} options={balOpts}/></PEField>

            <PEField label="Velocidade"><PESelect value={it.vel} onChange={(v) => update(i, "vel", v)} options={velOpts}/></PEField>
            <PEField label={eq === "escada" ? "Alimentação" : "Alimentação Elétrica"}><PESelect value={it.alimentacao} onChange={(v) => update(i, "alimentacao", v)} options={alimOpts}/></PEField>
            <PEField label="Arranjo"><PESelect value={it.arranjo} onChange={(v) => update(i, "arranjo", v)} options={arranjoOpts}/></PEField>

            <PEField label="Máquina"><PESelect value={it.maquina} onChange={(v) => update(i, "maquina", v)} options={maquinaOpts}/></PEField>
            <PEField label="Quantidade" required><PENumber value={it.qtd} onChange={(v) => update(i, "qtd", v)} placeholder="1"/></PEField>
            <PEField label="Valor Unitário"><PECurrency value={it.valorUnit} onChange={(v) => update(i, "valorUnit", v)} placeholder="380.000,00"/></PEField>
          </div>
        </PERep>
      ))}
      <PERepAdd label="+ Adicionar Unidade" onAdd={add}/>
    </>
  );
}

function S_Especificidades({ d, set, eq }) {
  const s = d[eq].especificidades;
  const u = (k) => (v) => set(`${eq}.especificidades.${k}`, v);
  return (
    <div className="pe-grid cols-2">
      <PEField label="Tipo de Equipamento"><PESelect value={s.tipo} onChange={u("tipo")}/></PEField>
      <PEField label="Configuração"><PESelect value={s.config} onChange={u("config")}/></PEField>
      <PEField label="Corrimão"><PESelect value={s.corrimao} onChange={u("corrimao")}/></PEField>
      <PEField label={eq === "escada" ? "Acabamento dos Degraus" : "Acabamento dos Pallets"}><PESelect value={s.acabamento} onChange={u("acabamento")}/></PEField>
    </div>
  );
}

Object.assign(window, {
  UF_LIST,
  PEField, PETextInput, PETextarea, PECurrency, PENumber, PESelect, PECalc, PEPresets,
  PESection, PERep, PERepAdd,
  S_Proposta, S_Cliente, S_Obra, S_TextoProposta,
  S_DescricaoElevador, S_EspecElevador, S_Acabamentos,
  S_RepText, S_Valores, S_Ajustes, S_PrazoEntrega, S_Responsabilidades,
  S_InstalacaoMontagem, S_GarantiaCondicoes, S_CondPagamentoElev,
  S_DescricaoSimples, S_EspecEscada, S_Especificidades,
});
