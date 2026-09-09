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

/* ---- Acabamentos: campo com checkbox "ativo" (só o marcado entra no PDF)
   + valor inline quando marcado — mesmo padrão da Ficha Técnica. ---- */
function S_AcabField({ fld, onToggle, onValue, onRemove }) {
  const opts = fld.opcoesKey ? OPTIONS[fld.opcoesKey] : null;
  return (
    <div className="pe-acab-row">
      <label className={"pe-acab-check" + (fld.ativo ? " on" : "")}>
        <input type="checkbox" checked={!!fld.ativo} onChange={onToggle}/>
        <span>{fld.nome}</span>
      </label>
      {fld.custom && (
        <button type="button" className="pe-acab-rm" onClick={onRemove} title="Excluir campo" aria-label="Excluir campo">×</button>
      )}
      {fld.ativo && (
        <div className="pe-acab-value">
          {fld.tipo === "select"
            ? <PESelect value={fld.valor} onChange={onValue} options={opts || []}/>
            : fld.tipo === "textarea"
              ? <PETextarea rows={2} value={fld.valor} onChange={onValue}/>
              : <PETextInput value={fld.valor} onChange={onValue}/>}
        </div>
      )}
    </div>
  );
}

/* Reaproveita o Modal/Button globais (mesmo padrão do PropostaSendModal em
   proposta-editor.jsx) em vez de css/markup de modal próprio. */
function S_AcabAddFieldModal({ onAdd, onClose }) {
  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState("text");
  return (
    <Modal title="Novo campo de acabamento" onClose={onClose} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={() => nome.trim() && onAdd({ nome: nome.trim(), tipo })}>Adicionar</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <PEField label="Nome do campo"><PETextInput value={nome} onChange={setNome} placeholder="Ex.: Corrimão"/></PEField>
        <PEField label="Tipo">
          <select className="pe-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="text">Texto curto</option>
            <option value="textarea">Texto longo</option>
          </select>
        </PEField>
      </div>
    </Modal>
  );
}

function S_AcabAddCategoryModal({ onAdd, onClose }) {
  const [nome, setNome] = React.useState("");
  return (
    <Modal title="Nova categoria de acabamento" onClose={onClose} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={() => nome.trim() && onAdd(nome.trim())}>Criar</Button>
      </>}>
      <PEField label="Nome da categoria"><PETextInput value={nome} onChange={setNome} placeholder="Ex.: Sinalização de Emergência"/></PEField>
    </Modal>
  );
}

/* Categorias/campos dinâmicos com checkbox "ativo" — mesmo padrão da Ficha
   Técnica (engenharia/ficha-tecnica): o vendedor marca o que quer que entre
   na proposta e pode criar campo/categoria novos, que ficam disponíveis
   pras próximas propostas via biblioteca compartilhada (tabelas
   propostas_lib_categorias/propostas_lib_campos, PropostaAcabamentosStore).
   Os 13 campos que já existiam viram a categoria nativa "Acabamentos" —
   proposta salva antes dessa mudança migra sozinha, sem perder valor. */
function S_Acabamentos({ d, set }) {
  const engine = window.PropostaAcabamentosEngine;
  const store = window.PropostaAcabamentosStore;
  const [libLoaded, setLibLoaded] = React.useState(false);
  const [modal, setModal] = React.useState(null); // { type: 'campo'|'categoria', catId? }

  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!store || !engine) return;
      const lib = await store.loadLibrary();
      if (cancelado) return;
      engine.setLibraryExtras(lib);
      setLibLoaded((n) => !n); // força recomputar cats com a lib carregada
    })();
    return () => { cancelado = true; };
  }, []);

  const cats = engine ? engine.garantirCats(d.elevador) : [];

  /* Só na 1ª vez (proposta ainda sem acabamentosCats): grava o resultado da
     migração como estado real, pra não ficar recalculando do legado a
     cada render. */
  React.useEffect(() => {
    if (engine && !(Array.isArray(d.elevador.acabamentosCats) && d.elevador.acabamentosCats.length)) {
      set("elevador.acabamentosCats", cats);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libLoaded]);

  if (!engine) return <div className="pe-hint">Carregando…</div>;

  const updateCats = (novo) => set("elevador.acabamentosCats", novo);

  const toggleField = (catId, k) => updateCats(cats.map((c) => c.id !== catId ? c : {
    ...c, campos: c.campos.map((f) => f.k !== k ? f : { ...f, ativo: !f.ativo }),
  }));
  const setFieldValue = (catId, k, valor) => updateCats(cats.map((c) => c.id !== catId ? c : {
    ...c, campos: c.campos.map((f) => f.k !== k ? f : { ...f, valor }),
  }));
  const removeField = (catId, k) => {
    updateCats(cats.map((c) => c.id !== catId ? c : { ...c, campos: c.campos.filter((f) => f.k !== k) }));
    store && store.deleteFieldFromLibrary(catId, k);
  };
  const removeCategory = (catId) => {
    updateCats(cats.filter((c) => c.id !== catId));
    store && store.deleteCategoryFromLibrary(catId);
  };
  const addField = (catId, def) => {
    const cat = cats.find((c) => c.id === catId);
    if (cat && cat.campos.some((f) => engine.normalizeNome(f.nome) === engine.normalizeNome(def.nome))) {
      window.toast?.("Já existe um campo com esse nome nessa categoria.", "warning");
      return;
    }
    const k = engine.fieldKey(def.nome);
    updateCats(cats.map((c) => c.id !== catId ? c : {
      ...c, campos: [...c.campos, { k, nome: def.nome, tipo: def.tipo, opcoesKey: null, valor: "", ativo: true, ordem: c.campos.length, custom: true }],
    }));
    store && store.saveFieldToLibrary(catId, def);
  };
  const addCategory = (nome) => {
    if (cats.some((c) => engine.normalizeNome(c.nome) === engine.normalizeNome(nome))) {
      window.toast?.("Já existe uma categoria com esse nome.", "warning");
      return;
    }
    const id = engine.slugCategoria(nome);
    updateCats([...cats, { id, nome, custom: true, campos: [] }]);
    store && store.saveCategoryToLibrary({ id, nome });
  };

  return (
    <div className="pe-acab">
      {cats.map((c) => (
        <div className="pe-acab-cat" key={c.id}>
          <div className="pe-acab-cat-head">
            <span className="pe-acab-cat-nome">{c.nome}</span>
            {c.custom && (
              <button type="button" className="pe-acab-rm" onClick={() => removeCategory(c.id)} title="Excluir categoria" aria-label="Excluir categoria">×</button>
            )}
          </div>
          <div className="pe-acab-fields">
            {c.campos.map((fld) => (
              <S_AcabField
                key={fld.k}
                fld={fld}
                onToggle={() => toggleField(c.id, fld.k)}
                onValue={(v) => setFieldValue(c.id, fld.k, v)}
                onRemove={() => removeField(c.id, fld.k)}
              />
            ))}
          </div>
          <button type="button" className="pe-acab-addfield" onClick={() => setModal({ type: "campo", catId: c.id })}>+ Adicionar campo</button>
        </div>
      ))}
      <button type="button" className="pe-acab-addcat" onClick={() => setModal({ type: "categoria" })}>+ Nova categoria</button>

      {modal?.type === "campo" && (
        <S_AcabAddFieldModal onClose={() => setModal(null)} onAdd={(def) => { addField(modal.catId, def); setModal(null); }}/>
      )}
      {modal?.type === "categoria" && (
        <S_AcabAddCategoryModal onClose={() => setModal(null)} onAdd={(nome) => { addCategory(nome); setModal(null); }}/>
      )}
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

/* ---- Desconto por equipamento (Frentes B + C do estudo do editor de
   Proposta) — só aparece quando a cotação tem mais de 1 equipamento
   (v.itens existe, ver proposta-heranca.js). Pedido de desconto vira uma
   decisão pendente na Central de Decisões (≤7% Gestor Comercial, >7% só
   CEO) — nada muda de preço até alguém com a alçada certa aprovar. ---- */
function S_ItemDescontoModal({ item, onClose, onSolicitar }) {
  const [tipo, setTipo] = React.useState("percentual");
  const [valor, setValor] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const engine = window.PropostaDesconto;
  const pct = engine ? engine.pctDoDesconto(item, tipo, valor) : 0;
  const papel = engine ? engine.papelParaPct(pct) : null;
  const submit = async () => {
    setSaving(true);
    try { await onSolicitar({ tipo, valor, motivo }); onClose(); }
    catch (e) { window.toast?.("Erro: " + (e.message || e), "error"); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Solicitar desconto — ${item.id || item.equipamento}`} onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving || !(Number(valor) > 0)}>{saving ? "Enviando…" : "Enviar para aprovação"}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <PEField label="Tipo de desconto">
          <select className="pe-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor fixo (R$)</option>
          </select>
        </PEField>
        <PEField label={tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}>
          <PETextInput value={valor} onChange={setValor} placeholder={tipo === "percentual" ? "5" : "15.000,00"}/>
        </PEField>
        <PEField label="Motivo"><PETextarea rows={2} value={motivo} onChange={setMotivo} placeholder="Ex.: pedido do cliente na revisão da proposta"/></PEField>
        {Number(valor) > 0 && (
          <div className="small muted" style={{ padding: "8px 10px", background: "var(--vp-gray-50)", borderRadius: 6 }}>
            Equivale a {(pct * 100).toFixed(1)}% do valor original — precisa de aprovação do{" "}
            <b>{papel === "ceo" ? "CEO (acima de 7%)" : "Gestor Comercial"}</b>.
          </div>
        )}
      </div>
    </Modal>
  );
}

function S_ItemDescontoLog({ log }) {
  const [aberto, setAberto] = React.useState(false);
  if (!log || !log.length) return null;
  const ACAO_LABEL = { solicitado: "Solicitado", aprovado: "Aprovado", reprovado: "Reprovado", removido: "Removido" };
  return (
    <div style={{ marginTop: 4 }}>
      <button type="button" className="pe-acab-addfield" style={{ marginTop: 0, fontSize: 11 }} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar histórico" : `Ver histórico (${log.length})`}
      </button>
      {aberto && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11.5, color: "var(--fg2)" }}>
          {log.slice().reverse().map((l, i) => (
            <li key={i}>
              {ACAO_LABEL[l.acao] || l.acao} por <b>{l.por || "—"}</b> em {l.em ? new Date(l.em).toLocaleString("pt-BR") : "—"}
              {l.tipo && l.valor != null ? ` — ${l.tipo === "percentual" ? l.valor + "%" : "R$ " + l.valor}` : ""}
              {l.motivo ? ` (${l.motivo})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function S_ItensValores({ eq, itens, onChangeItens, proposta }) {
  const [modalItem, setModalItem] = React.useState(null);
  const engine = window.PropostaDesconto;
  const fmt = (n) => "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Reconcilia pedidos pendentes ao abrir a seção — se alguém já decidiu na
  // Central de Decisões, aplica (ou descarta) sem o vendedor precisar fazer nada.
  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!engine) return;
      const numeroCotacao = window.MasterIdEngine?.parseNumeroCotacao?.(proposta.numeroCotacao) ?? null;
      const pendentes = itens.some((it) => it.descontoPendente);
      if (!pendentes) return;
      const atualizados = await Promise.all(itens.map((it) => engine.reconciliar(it, numeroCotacao)));
      if (!cancelado && atualizados.some((it, i) => it !== itens[i])) onChangeItens(atualizados);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solicitar = async (item, payload) => {
    const atualizado = await engine.solicitar(proposta, item, payload);
    onChangeItens(itens.map((it) => (it.id === item.id ? atualizado : it)));
    window.toast?.("Pedido de desconto enviado para aprovação.", "success");
  };
  const remover = (item) => {
    const atualizado = engine.removerDesconto(item);
    onChangeItens(itens.map((it) => (it.id === item.id ? atualizado : it)));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {itens.map((it) => {
        const original = engine ? engine.parseNum(it.valorOriginal ?? it.valorUnit) : Number(it.valorUnit) || 0;
        const atual = engine ? engine.parseNum(it.valorUnit) : Number(it.valorUnit) || 0;
        const temDesconto = it.desconto && atual < original;
        return (
          <div key={it.id} className="pe-acab-cat">
            <div className="pe-acab-cat-head">
              <span className="pe-acab-cat-nome">{it.id || it.equipamento}</span>
              <span className="small muted">Qtd. {it.quantidade || 1}</span>
            </div>
            <div className="row gap-2" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              {temDesconto && <span className="small muted" style={{ textDecoration: "line-through" }}>{fmt(original)}</span>}
              <b style={{ fontSize: 16 }}>{fmt(atual)}</b>
              {it.descontoPendente && <span className="pe-tag" style={{ background: "var(--vp-warning-tint, #f8eed7)" }}>Aguardando aprovação ({it.descontoPendente.papel === "ceo" ? "CEO" : "Gestor Comercial"})</span>}
            </div>
            <div className="row gap-2" style={{ marginTop: 8 }}>
              {!it.descontoPendente && (
                <button type="button" className="pe-acab-addfield" onClick={() => setModalItem(it)}>
                  {temDesconto ? "Alterar desconto" : "Solicitar desconto"}
                </button>
              )}
              {temDesconto && !it.descontoPendente && (
                <button type="button" className="pe-acab-addfield" onClick={() => remover(it)}>Remover desconto</button>
              )}
            </div>
            <S_ItemDescontoLog log={it.descontoLog}/>
          </div>
        );
      })}
      {modalItem && (
        <S_ItemDescontoModal item={modalItem} onClose={() => setModalItem(null)} onSolicitar={(payload) => solicitar(modalItem, payload)}/>
      )}
    </div>
  );
}

function S_Valores({ d, set, eq, recordId }) {
  const v = d[eq].valores;
  const u = (k) => (val) => set(`${eq}.valores.${k}`, val);
  const parcelas = v.parcelas || [];
  const setParcelas = (arr) => set(`${eq}.valores.parcelas`, arr);
  const temItens = Array.isArray(v.itens) && v.itens.length > 0;

  const qtd = parseFloat(v.quantidade) || 0;
  const unit = parseFloat((v.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const difal = parseFloat((v.difal || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;
  const totalEq = temItens
    ? v.itens.reduce((s, it) => s + (parseFloat((it.valorUnit || "0").toString().replace(/\./g, "").replace(",", ".")) || 0) * (Number(it.quantidade) || 1), 0)
    : qtd * unit;
  const totalDifal = totalEq + difal;
  /* Parcelas eram digitadas aqui mas a soma delas nunca aparecia nem era
     conferida contra o Total com DIFAL — vendedor só descobria a conta
     errada depois, olhando o PDF (achado real, 19/08). */
  const totalParcelado = parcelas.reduce((s, p) => s + (parseFloat((p.valor || "0").toString().replace(/\./g, "").replace(",", ".")) || 0), 0);
  const diferencaParcelas = totalDifal - totalParcelado;
  const parcelasBatem = parcelas.length === 0 || Math.abs(diferencaParcelas) < 0.01;

  const formatBR = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formaPagLabel = eq === "esteira" ? "Condições de Pagamento" : "Forma de Pagamento";

  const propostaRef = { id: recordId, numeroCotacao: d.numeroCotacao, cliente: d.cliente, titulo: d.cliente?.nome };

  /* Solicitar/remover desconto precisa ficar salvo na hora, não só no state
     local — senão o pedido pendente (e a decisão já criada de verdade na
     Central de Decisões) se perde ao sair da tela sem clicar em "Salvar"
     antes (achado real testando ao vivo, 09/09). set() sozinho não basta
     porque o React ainda não comitou o novo state no momento da chamada —
     monta o objeto final na mão e salva direto, sem depender de closure. */
  const persistirItens = (novosItens) => {
    set(`${eq}.valores.itens`, novosItens);
    if (!window.PropostaStore) return;
    const novoData = { ...d, [eq]: { ...d[eq], valores: { ...d[eq].valores, itens: novosItens } } };
    const valorTotal = typeof calcularValorTotal === "function" ? calcularValorTotal(novoData, eq) : undefined;
    window.PropostaStore.salvar({ data: novoData, eq, editId: recordId, valorTotal });
  };

  return (
    <>
      {temItens ? (
        <S_ItensValores
          eq={eq}
          itens={v.itens}
          proposta={propostaRef}
          onChangeItens={persistirItens}
        />
      ) : (
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
      )}
      {temItens && (
        <div className="pe-grid cols-4">
          <PEField label="DIFAL" tag="diferencial alíquota"><PECurrency value={v.difal} onChange={u("difal")} placeholder="0,00"/></PEField>
          <PEField label={formaPagLabel} span="3"><PESelect value={v.forma} onChange={u("forma")}/></PEField>
        </div>
      )}

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
        {parcelas.length > 0 && (
          <div className="pe-totais-row" style={parcelasBatem ? undefined : { color: 'var(--vp-danger, #c62828)' }}>
            <span>Total Parcelado {parcelasBatem ? '' : `— diferença de R$ ${formatBR(Math.abs(diferencaParcelas))}`}</span>
            <b>R$ {formatBR(totalParcelado)}</b>
          </div>
        )}
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
        {eq === "elevador" ? <>
          <PEField label='Cláusula de Reajuste Cambial (página "Ajustes e Impostos")' span="3"><PETextarea rows={3} value={a.clausulaCambial} onChange={u("clausulaCambial")} placeholder="O valor total desta proposta está baseado na taxa de câmbio..."/></PEField>
          <PEField label='Faturamento (página "Ajustes e Impostos")' span="3"><PETextarea rows={2} value={a.faturamentoTexto} onChange={u("faturamentoTexto")} placeholder="Venda de Equipamentos serão faturadas pela empresa..."/></PEField>
          <PEField label="Taxas e Impostos Inclusos no Preço" span="3"><PETextarea rows={2} value={a.taxasInclusas} onChange={u("taxasInclusas")} placeholder="Inclusos no preço todos os impostos decorrentes de..."/></PEField>
          <PEField label="Taxas e Impostos Excluídos do Preço" span="3"><PETextarea rows={2} value={a.taxasExcluidas} onChange={u("taxasExcluidas")} placeholder="Não estão inclusos no preço taxas de alvará..."/></PEField>
        </> : null}
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
  return (
    <>
      <div className="pe-field-label" style={{ marginBottom: 6 }}>A cargo do Vendedor (VerticalParts)</div>
      <S_RepText items={r.vendedor || []} setItems={(v) => set("elevador.responsabilidades.vendedor", v)}
        addLabel="+ Adicionar item" placeholder="Ex.: Montagem completa dos elevadores"/>
      <div className="pe-field-label" style={{ margin: "18px 0 6px" }}>A cargo do Comprador</div>
      <S_RepText items={r.comprador || []} setItems={(v) => set("elevador.responsabilidades.comprador", v)}
        addLabel="+ Adicionar item" placeholder="Ex.: Preparo do(s) poço(s) e caixa(s) de acordo com as nossas indicações"/>
    </>
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
      {eq === "elevador" ? <PEField label="Horário dos Serviços de Instalação/Montagem"><PETextInput value={g.horario} onChange={u("horario")} placeholder="Segunda à Sexta das 08:00 às 17:12hs"/></PEField> : null}
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

/* === Marketing do equipamento: Benefícios + Diferenciais (página 5 do PDF) === */
function S_BeneficiosDiferenciais({ d, set }) {
  const ed = d.elevador;
  return (
    <>
      <div className="pe-field-label" style={{ marginBottom: 6 }}>Benefícios</div>
      <S_RepText items={ed.beneficios || []} setItems={(v) => set("elevador.beneficios", v)}
        addLabel="+ Adicionar benefício" placeholder="Ex.: Eficiência energética e respeito ao meio ambiente."/>
      <div className="pe-field-label" style={{ margin: "18px 0 6px" }}>Diferenciais em Relação ao Mercado</div>
      <S_RepText items={ed.diferenciais || []} setItems={(v) => set("elevador.diferenciais", v)}
        addLabel="+ Adicionar diferencial" placeholder="Ex.: Piso em 12mm de resina, modelo FR035"/>
    </>
  );
}

/* === Características Principais: elétrica / comando / tração === */
function S_CaracteristicasEquip({ d, set }) {
  const c = d.elevador.caracteristicasEquip || {};
  const u = (k) => (v) => set(`elevador.caracteristicasEquip.${k}`, v);
  return (
    <div className="pe-grid cols-1">
      <PEField label="Alimentação Elétrica"><PETextarea rows={2} value={c.alimentacao} onChange={u("alimentacao")} placeholder="Trifásico, 220v..."/></PEField>
      <PEField label="Sistema de Comando de Controle"><PETextarea rows={2} value={c.comando} onChange={u("comando")} placeholder="O comando de última geração e microprocessado garante..."/></PEField>
      <PEField label="Máquina de Tração"><PETextarea rows={2} value={c.tracao} onChange={u("tracao")} placeholder="Acionamento Elétrico com cabo de aço ou cinto de tração"/></PEField>
    </div>
  );
}

/* === Item nomeado (nome + descrição) — usado em Recursos Inclusos e
   Infraestrutura e Instalação === */
function S_RepNomeDesc({ items, setItems, addLabel }) {
  const update = (i, k, v) => { const arr = [...items]; arr[i] = { ...arr[i], [k]: v }; setItems(arr); };
  const add = () => setItems([...items, { nome: "", desc: "" }]);
  const remove = (i) => setItems(items.filter((_, j) => j !== i));
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="pe-grid cols-1" style={{ position: "relative", marginBottom: 10, paddingBottom: 10, borderBottom: "1px dashed var(--border)" }}>
          <PEField label="Nome"><PETextInput value={it.nome} onChange={(v) => update(i, "nome", v)} placeholder="Ex.: Retorno Automático"/></PEField>
          <PEField label="Descrição"><PETextarea rows={2} value={it.desc} onChange={(v) => update(i, "desc", v)} placeholder="Descreva o recurso..."/></PEField>
          <button type="button" onClick={() => remove(i)} className="pe-parcela-row__del"
            style={{ position: "absolute", top: 0, right: 0, height: 28, width: 28 }}>
            <Icon.x size={12}/>
          </button>
        </div>
      ))}
      <PERepAdd label={addLabel} onAdd={add}/>
    </>
  );
}

function S_RecursosNomeados({ d, set }) {
  return <S_RepNomeDesc items={d.elevador.recursosNomeados || []} setItems={(v) => set("elevador.recursosNomeados", v)} addLabel="+ Adicionar recurso"/>;
}

function S_InfraestruturaNomeada({ d, set }) {
  return <S_RepNomeDesc items={d.elevador.infraestruturaNomeada || []} setItems={(v) => set("elevador.infraestruturaNomeada", v)} addLabel="+ Adicionar item"/>;
}

/* === Fotos do Equipamento (upload — mesmo padrão da Ficha Técnica) === */
function S_FotosEquipamento({ d, set }) {
  const fotos = d.elevador.fotos || {};
  const [uploadingSlot, setUploadingSlot] = React.useState(null);
  // Bucket privado: o path guardado no data_json não serve de <img src>
  // direto — precisa resolver uma URL assinada pra mostrar a miniatura.
  const [thumbs, setThumbs] = React.useState({});
  const slots = [["unidade", "Unidade (foto geral)"], ["teto", "Teto da Cabine"], ["botoeira", "Botoeira"]];

  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!window.PropostaImagens) return;
      const entries = await Promise.all(slots.map(async ([slot]) =>
        [slot, fotos[slot] ? await window.PropostaImagens.signedURL(fotos[slot]) : null]));
      if (!cancelado) setThumbs(Object.fromEntries(entries));
    })();
    return () => { cancelado = true; };
  }, [fotos.unidade, fotos.teto, fotos.botoeira]);

  const onFile = async (slot, e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    setUploadingSlot(slot);
    try {
      if (!window.PropostaImagens) throw new Error('Upload de imagens não carregado — recarregue a página.');
      const { path } = await window.PropostaImagens.compressAndUpload(file, { propostaId: d.numero || 'rascunho', slot });
      set(`elevador.fotos.${slot}`, path);
    } catch (err) {
      window.toast?.('Erro ao enviar foto: ' + (err.message || err), 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div className="pe-grid cols-1">
      {slots.map(([slot, label]) => (
        <PEField label={label} key={slot}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {thumbs[slot] ? <img src={thumbs[slot]} alt={label} style={{ height: 60, borderRadius: 4, objectFit: "cover" }}/> : null}
            <input type="file" accept="image/*" disabled={uploadingSlot === slot}
              onChange={(e) => onFile(slot, e)}/>
            {uploadingSlot === slot ? <span className="small muted">Enviando…</span> : null}
            {fotos[slot] ? <Button variant="ghost" size="sm" icon="trash" onClick={() => set(`elevador.fotos.${slot}`, null)}>Remover</Button> : null}
          </div>
        </PEField>
      ))}
      <p className="small muted" style={{ margin: 0 }}>A página "Fotos do Equipamento" só aparece no PDF se pelo menos uma foto for enviada.</p>
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
