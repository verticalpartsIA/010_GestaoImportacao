/* ============================================================
   proposta-editor.jsx — Editor shell
   - Top tabs: Elevador / Escada / Esteira
   - Left sidenav: jump to section
   - Right: live PDF preview
   - Bottom: action bar (save / pdf / view / back)
   ============================================================ */

/* Default data structure */
function makeDefaultProposta() {
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const anoAtual = hoje.getFullYear();
  return {
    numero: `VP-${anoAtual}-001`,
    dataLinha: `São Paulo, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${anoAtual}`,
    validade: "30 dias",
    // Master ID (Fase 2) — rastreia de qual Cotação/Precificação essa
    // Proposta nasceu; `ativos` é a lista granular de equipamentos
    // (índice + código completo) que Contrato de Venda/Instalador herdam.
    masterId: null, precificacaoId: null, ativos: [],
    // Chave da herança: informando o Nº da Cotação, a proposta puxa
    // cliente/obra/equipamentos/valores já coletados no pipeline.
    numeroCotacao: "",
    vendedor: { nome: "", celular: "", fixo: "", email: "" },
    cliente: { nome: "", cnpj: "", responsavel: "",
      endereco: "", numero: "", bairro: "", cidade: "", uf: "", cep: "",
      email: "", telefone: "" },
    obra: { nome: "", endereco: "", numero: "",
      bairro: "", cidade: "", uf: "", cep: "" },

    elevador: {
      /* Texto de abertura genérico: não cita modelo, pra não descrever um
         equipamento diferente do que está sendo vendido. */
      textoProposta: "Prezado(a) cliente,\n\nÉ com satisfação que apresentamos nossa proposta comercial para o fornecimento do(s) equipamento(s) especificado(s) a seguir, com atendimento integral às normas técnicas vigentes.",
      textoModelos: "",
      /* Nada de equipamento fictício aqui: estes campos descrevem o produto
         que o CLIENTE vai receber, então nascem vazios e são preenchidos
         pela herança do Nº da Cotação ou pelo vendedor. Antes vinha um
         elevador residencial inventado (18 paradas, 450kg, cabine VP-228)
         que, se ninguém percebesse, ia embora na proposta. */
      descricao: [{ titulo: "", linha: "", tipo: "", norma: "", piso: "" }],
      especificacoes: [{
        id: "", modelo: "", empreendimento: "", carac: "", denominacao: "",
        percurso: "", capacidade: "", dimensoesCaixa: "", profPoço: "", vel: "",
        andaresParadasPortas: "", qtd: 1,
      }],
      acabamentos: {
        modeloCabine: "", acabamentoMat: "", subTeto: "",
        painelOperacao: "", pisoCabina: "", medidasPiso: "",
        modeloPorta: "", dimPortaCabine: "",
        acabPortaCabine: "", portasPavimento: "", botoeirasPavimento: "",
        sinalizacao: "", pavInox: "", demais: "",
      },
      caracteristicas: ["Sistema de tração gearless de alta eficiência energética", "Comando microprocessado MAX-3000 com prioridade de chamadas inteligente"],
      recursos: ["Resgate automático em falta de energia (ARD)", "Comunicação bidirecional integrada à central 24h"],
      infraestrutura: ["Casa de máquinas dimensionada conforme NBR 16858", "Aterramento próprio para o quadro de comando"],
      valores: { equipamento: "", quantidade: "1", valorUnit: "", difal: "",
        forma: "40% à vista e 4 parcelas",
        parcelas: [
          { desc: "Sinal de 40% na assinatura do contrato", valor: "" },
          { desc: "1ª PARCELA", valor: "" },
          { desc: "2ª PARCELA", valor: "" },
          { desc: "3ª PARCELA", valor: "" },
          { desc: "4ª PARCELA", valor: "" },
        ]},
      condicoesPagto: { venda: "", impostos: "", ajusteFrete: "", reajuste: "" },
      ajustes: { preset: "sp", cambio: "", faturamento: "", reajuste: "Reajuste anual conforme IPCA acumulado.",
        taxasIn: "II, IPI, PIS/COFINS sobre importação. ICMS interestadual.",
        taxasOut: "ICMS final destino (DIFAL conforme localização da obra). Taxa CREA/CAU." },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "Os prazos poderão ser revisados em caso de eventos extraordinários relacionados a pandemia, escassez global de semicondutores ou bloqueios portuários." },
      responsabilidades: { tipoServico: "", itemMontagem: "Içamento + posicionamento + comissionamento" },
      garantia: { garantia: "24 (vinte e quatro) meses contra defeitos de fabricação + 12 meses de serviço técnico preventivo.",
        condicoes: "Esta proposta é válida por 30 dias a contar da emissão. Quaisquer alterações no escopo deverão ser formalizadas por aditivo contratual. As partes elegem o foro da Comarca de São Paulo." },
    },

    escada: {
      textoProposta: "", textoModelos: "",
      descricao: [{ titulo: "", desc: "", beneficios: "" }],
      especificacoes: [{
        id: "", empreendimento: "", carac: "", desnivel: "", incl: "",
        largDegrau: "", balaustrada: "", vel: "", alimentacao: "",
        arranjo: "", maquina: "", qtd: 1, valorUnit: "",
      }],
      especificidades: { tipo: "", config: "", corrimao: "", acabamento: "" },
      valores: { equipamento: "", quantidade: "", valorUnit: "", difal: "", forma: "", parcelas: [] },
      ajustes: { preset: "sp", cambio: "", freteMaritimo: "", reajuste: "", taxasIn: "", taxasOut: "" },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "" },
      instalacao: { instalacao: "", lubrificacao: "", transporte: "", descarregamento: "" },
      garantia: { garantia: "", condicoes: "" },
    },

    esteira: {
      textoProposta: "", textoModelos: "",
      descricao: [{ titulo: "", desc: "", beneficios: "" }],
      especificacoes: [{
        id: "", empreendimento: "", carac: "", desnivelComp: "", incl: "",
        largPallet: "", balaustrada: "", vel: "", alimentacao: "",
        arranjo: "", maquina: "", qtd: 1, valorUnit: "",
      }],
      especificidades: { tipo: "", config: "", corrimao: "", acabamento: "" },
      valores: { equipamento: "", quantidade: "", valorUnit: "", difal: "", forma: "", parcelas: [] },
      ajustes: { preset: "sp", cambio: "", freteMaritimo: "", fretePorContainer: "", ajusteFrete: "", reajuste: "", taxasIn: "", taxasOut: "" },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "" },
      instalacao: { instalacao: "", lubrificacao: "", transporte: "", descarregamento: "" },
      garantia: { garantia: "", condicoes: "" },
    }
  };
}

/* Propostas criadas antes deste Editor guardaram o data_json num formato
   diferente (chaves em inglês: client/specs/elevatorUnits...). Convertemos
   pros campos que o Editor atual usa (cliente/obra/elevador.especificacoes)
   pra abrir com os dados reais, em vez de aparecer em branco.
   Detecção: data_json tem `client` mas não tem `cliente`. */
function ehPropostaSchemaLegado(dj) {
  return !!(dj && dj.client && !dj.cliente);
}
/* O gerador antigo gravava `client.name` vazio — o nome real do cliente só
   sobreviveu na coluna `titulo` da linha, no formato "<Cliente> - <Equipamento>".
   Recuperamos daí (tirando só o sufixo de equipamento) pra proposta antiga
   não abrir como "Sem cliente". */
function clienteDoTitulo(titulo) {
  if (!titulo) return '';
  return String(titulo).replace(/\s*-\s*(Elevador|Escada Rolante|Esteira Rolante)\s*$/i, '').trim();
}

function converterPropostaLegado(dj, titulo) {
  const cli = dj.client || {};
  const obra = dj.elevatorWork || dj.work || {};
  const mapUnidade = (u, prefixo) => ({
    id: u.name || prefixo, modelo: u.model || '', empreendimento: u.buildingType || '',
    carac: u.transportChar || '', denominacao: u.denomination || '',
    percurso: (u.travelDistance || u.rise || '').replace(/mm$/, ''),
    capacidade: u.capacity || '', dimensoesCaixa: u.shaftDimensions || '',
    profPoço: (u.pitDepth || '').replace(/mm$/, ''), vel: (u.speed || '').replace(/\s*m\/s$/, ''),
    andaresParadasPortas: u.stops || '', qtd: u.quantity || 1,
  });
  const elevadorUnidades = dj.elevatorUnits || [];
  const somaQtd = (arr) => String(arr.reduce((s, u) => s + (Number(u.quantity) || 0), 0)) || '1';

  return {
    numero: dj.number || '',
    cliente: {
      nome: cli.name || clienteDoTitulo(titulo), cnpj: cli.cnpj || '', responsavel: cli.contactPerson || '',
      endereco: cli.address || '', numero: '', bairro: '', cidade: cli.city || '', uf: cli.state || '', cep: cli.zip || '',
      email: cli.email || '', telefone: cli.phone || '',
    },
    obra: {
      nome: obra.projectName || '', endereco: obra.address || '', numero: obra.number || '',
      bairro: obra.neighborhood || '', cidade: obra.city || '', uf: obra.state || '', cep: obra.zip || '',
    },
    elevador: elevadorUnidades.length ? {
      especificacoes: elevadorUnidades.map((u) => mapUnidade(u, 'Elevador')),
      valores: {
        equipamento: (dj.elevatorProducts && dj.elevatorProducts[0] && dj.elevatorProducts[0].title) || dj.specs?.type || '',
        quantidade: somaQtd(elevadorUnidades),
        valorUnit: String(dj.financials?.unitPrice || dj.specs?.price || ''),
        difal: '',
      },
    } : undefined,
  };
}

/* deep set/get via dot-notation */
function setDeep(obj, path, value) {
  const keys = path.split(".");
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}
function getDeep(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function isNonEmpty(v) {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(isNonEmpty);
  return true;
}

/* Sections registry per equipment */
function getSections(eq) {
  const common = [
    { id: "proposta", title: "Dados da Proposta e Vendedor", icon: "fileText", group: "Comum", path: "vendedor" },
    { id: "cliente", title: "Dados do Cliente", icon: "users", group: "Comum", path: "cliente" },
    { id: "obra", title: "Dados da Obra", icon: "building", group: "Comum", path: "obra" },
    { id: "texto", title: "Texto da Proposta", icon: "edit", group: "Apresentação" },
  ];
  if (eq === "elevador") {
    return [...common,
      { id: "descricao", title: "Descrição do Produto", icon: "package", group: "Produto" },
      { id: "espec", title: "Especificações Técnicas", icon: "ruler", group: "Produto" },
      { id: "acabamentos", title: "Acabamentos", icon: "star", group: "Produto" },
      { id: "caracteristicas", title: "Características Principais", icon: "check", group: "Produto" },
      { id: "recursos", title: "Recursos Inclusos", icon: "list", group: "Produto" },
      { id: "infra", title: "Infraestrutura", icon: "hardhat", group: "Produto" },
      { id: "valores", title: "Valores e Pagamento", icon: "dollar", group: "Comercial" },
      { id: "condicoesPagto", title: "Condições Gerais de Pagamento", icon: "scale", group: "Comercial" },
      { id: "ajustes", title: "Ajustes, Impostos e Câmbio", icon: "globe", group: "Comercial" },
      { id: "prazo", title: "Prazo e Entrega", icon: "truck", group: "Operacional" },
      { id: "responsabilidades", title: "Responsabilidades", icon: "shield", group: "Operacional" },
      { id: "garantia", title: "Garantia e Condições", icon: "award", group: "Operacional" },
    ];
  }
  return [...common,
    { id: "descricao", title: "Descrição do Produto", icon: "package", group: "Produto" },
    { id: "espec", title: "Especificações Técnicas", icon: "ruler", group: "Produto" },
    { id: "especificidades", title: "Especificidades", icon: "tool", group: "Produto" },
    { id: "valores", title: "Valores e Pagamento", icon: "dollar", group: "Comercial" },
    { id: "ajustes", title: "Ajustes, Impostos e Câmbio", icon: "globe", group: "Comercial" },
    { id: "prazo", title: "Prazo e Entrega", icon: "truck", group: "Operacional" },
    { id: "instalacao", title: "Instalação e Montagem", icon: "hardhat", group: "Operacional" },
    { id: "garantia", title: "Garantia e Condições", icon: "award", group: "Operacional" },
  ];
}

/* compute "fill" badge for a section */
function fillFor(data, eq, sectionId) {
  const ed = data[eq];
  let target = null;
  if (sectionId === "proposta") target = { ...data.vendedor, n: data.numero, d: data.dataLinha };
  else if (sectionId === "cliente") target = data.cliente;
  else if (sectionId === "obra") target = data.obra;
  else if (sectionId === "texto") target = { a: ed.textoProposta, b: ed.textoModelos };
  else if (sectionId === "caracteristicas") target = ed.caracteristicas;
  else if (sectionId === "recursos") target = ed.recursos;
  else if (sectionId === "infra") target = ed.infraestrutura;
  else target = ed[sectionId === "condicoesPagto" ? "condicoesPagto" : sectionId];
  if (!target) return { kind: "", label: "0%" };
  const arr = Array.isArray(target) ? target : Object.values(target);
  const filled = arr.filter(isNonEmpty).length;
  const total = arr.length || 1;
  const pct = Math.round(filled / total * 100);
  if (pct === 0) return { kind: "", label: "vazio" };
  if (pct < 100) return { kind: "partial", label: pct + "%" };
  return { kind: "full", label: "✓ ok" };
}

/* Mescla o prefill (cliente/obra/valores vindos da Precificação) por cima do
   default — objetos aninhados mesclam campo a campo, arrays (especificacoes)
   são substituídos por inteiro quando o prefill traz um. */
function deepMergeProposta(base, prefill) {
  const out = { ...base };
  Object.keys(prefill).forEach((k) => {
    if (k === '__prefillFromPrecificacao') return;
    const v = prefill[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMergeProposta(base[k], v);
    } else {
      out[k] = v;
    }
  });
  return out;
}

/* Merge da HERANÇA: diferente do prefill de proposta nova, aqui o vendedor
   já pode ter digitado coisas. Só preenche o que vier com conteúdo — nunca
   apaga um campo que já estava preenchido. */
function deepMergeHeranca(base, prefill) {
  const out = { ...base };
  Object.keys(prefill).forEach((k) => {
    if (k === '__prefillFromPrecificacao') return;
    const v = prefill[k];
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) { if (v.length) out[k] = v; return; }
    if (typeof v === 'object' && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMergeHeranca(base[k], v);
      return;
    }
    out[k] = v;
  });
  return out;
}

/* ---- Apoio ao cabeçalho do editor ---- */
const PE_STATUS_LABEL = {
  rascunho: 'Rascunho', enviada: 'Enviada', visualizada: 'Visualizada pelo cliente',
  aprovada: 'Assinada', recusada: 'Recusada', expirada: 'Expirada', cancelada: 'Cancelada',
};

function tempoRelativo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/* Total da proposta a partir do que está no formulário (preço unitário ×
   quantidade da aba ativa) — o mesmo número que o cliente vê no PDF e que
   agora também vai pra coluna valor_total, alimentando a listagem. */
function calcularValorTotal(data, eq) {
  const v = (data[eq] && data[eq].valores) || {};
  const unit = Number(String(v.valorUnit || '').replace(/\./g, '').replace(',', '.')) || 0;
  const qtd = Number(v.quantidade) || 1;
  return unit * qtd;
}

function fmtValorProposta(data, eq) {
  const total = calcularValorTotal(data, eq);
  if (!total) return '—';
  return total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/* vendedor_id aponta pra public.perfis; a identidade vem do SSO (e-mail).
   Cacheado por sessão — não faz sentido consultar a cada salvamento. */
let _vendedorIdCache;
async function resolverVendedorId() {
  if (_vendedorIdCache !== undefined) return _vendedorIdCache;
  const email = (window.__VP_USER || {}).email;
  if (!email || !window.__VP_SB?.sb) { _vendedorIdCache = null; return null; }
  try {
    const { data } = await window.__VP_SB.sb.from('perfis').select('id').eq('email', email).maybeSingle();
    _vendedorIdCache = data ? data.id : null;
  } catch (e) { _vendedorIdCache = null; }
  return _vendedorIdCache;
}

function PEChip({ label, value, mono, destaque }) {
  return (
    <span className={"pe-chip" + (destaque ? " pe-chip--destaque" : "")}>
      <span className="pe-chip__k">{label}</span>
      <span className={"pe-chip__v" + (mono ? " mono" : "")}>{value}</span>
    </span>
  );
}

/* Envio por assinatura digital — mesmo padrão do Contrato Instalador/Venda
   (link público /assinar/:token, WhatsApp ou E-mail). Reaproveita FEField/
   FEInput (formulario-elevador.jsx, já global) pra não duplicar estilo. */
function PropostaSendModal({ record, onClose, onSent }) {
  const [channel, setChannel] = React.useState('whatsapp');
  const [contact, setContact] = React.useState(record.cliente?.telefone || record.cliente?.email || '');
  const [name, setName] = React.useState(record.cliente?.nome || '');
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const store = window.PropostaStore;
  const url = store.signUrl(record.token);
  const valorFmt = record.valorTotal ? `R$ ${record.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const message = `Olá${name ? ' ' + name.split(' ')[0] : ''}! A VerticalParts enviou uma proposta comercial para sua análise e assinatura digital.\n\n` +
    `Proposta ${record.numero_documento}\nValor: ${valorFmt}\n\n` +
    `Acesse e assine pelo link seguro (válido por 7 dias):\n${url}`;

  const copyLink = () => {
    navigator.clipboard && navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await store.markSent(record.id, channel, { name, contact });
      if (channel === 'whatsapp') window.open(store.whatsAppHref(contact, message), '_blank');
      else if (channel === 'email') window.open(store.mailtoHref(contact, `Proposta ${record.numero_documento} — VerticalParts`, message), '_blank');
      setSent(true);
      onSent && onSent();
    } catch (e) {
      window.toast?.('Erro ao registrar envio: ' + (e.message || e), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={sent ? 'Enviado' : 'Enviar para assinatura'} onClose={onClose} width={560}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="small muted" style={{ margin: 0 }}>
          {sent ? 'A proposta está aguardando a leitura e assinatura do cliente.' : 'Gere o link seguro e escolha o canal de envio — o cliente lê, assina digitalmente e pode baixar sua própria cópia, sem precisar de cadastro.'}
        </p>
        <div className="card" style={{ padding: 12 }}>
          <b>{record.numero_documento}</b> <span className="muted">· {record.cliente?.nome || 'Sem cliente'}</span>
          <div className="row sb" style={{ marginTop: 6 }}><span className="small muted">Valor</span><b className="mono">{valorFmt}</b></div>
        </div>
        {!sent ? (
          <>
            <FEField label="Nome do destinatário"><FEInput value={name} onChange={setName} placeholder="Nome completo"/></FEField>
            <FEField label={channel === 'whatsapp' ? 'WhatsApp (DDI+DDD+número)' : 'E-mail'}>
              <FEInput value={contact} onChange={setContact} placeholder={channel === 'whatsapp' ? '5511999999999' : 'contato@cliente.com.br'}/>
            </FEField>
            <div className="row gap-2">
              <Button variant={channel === 'whatsapp' ? 'primary' : 'outline'} size="sm" icon="message" onClick={() => setChannel('whatsapp')}>WhatsApp</Button>
              <Button variant={channel === 'email' ? 'primary' : 'outline'} size="sm" icon="mail" onClick={() => setChannel('email')}>E-mail</Button>
            </div>
            <div className="row gap-2" style={{ background: 'var(--vp-gray-50)', padding: '8px 10px' }}>
              <code className="mono small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
              <Button variant="ghost" size="sm" icon="copy" onClick={copyLink}>{copied ? 'Copiado ✓' : 'Copiar'}</Button>
            </div>
            <Button variant="primary" icon="send" disabled={sending || !contact.trim()} onClick={handleSend}>{sending ? 'Enviando…' : 'Enviar e gerar link'}</Button>
          </>
        ) : (
          <div className="alert info" style={{ margin: 0 }}>
            <Icon.check/>
            <div>
              <div className="alert__title">Link enviado</div>
              <div className="alert__sub mono" style={{ fontSize: 12 }}>{url}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PropostaEditor({ setRoute, subsel }) {
  const prefill = subsel && subsel.__prefillFromPrecificacao ? subsel : null;
  const editId = subsel && subsel.__editId ? subsel.__editId : null;
  /* Rascunho local por proposta. Antes era UMA chave só pra todas: abrir a
     proposta A e depois clicar em "Nova proposta" trazia o conteúdo da A. */
  const LS_KEY = editId ? `vpprd.proposta-draft:${editId}` : "vpprd.proposta-draft";
  const [loadingExisting, setLoadingExisting] = React.useState(!!editId);
  const [eq, setEq] = React.useState(() => {
    if (prefill) return 'elevador';
    try { return localStorage.getItem("vpprd.proposta-eq") || "elevador"; } catch (e) { return "elevador"; }
  });
  const [data, setData] = React.useState(() => {
    if (prefill) return deepMergeProposta(makeDefaultProposta(), prefill);
    // Proposta existente: começa limpa e é substituída pelo que vem do banco,
    // pra não piscar o conteúdo de outra proposta.
    if (editId) return makeDefaultProposta();
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return makeDefaultProposta();
  });
  const [activeSection, setActiveSection] = React.useState("proposta");
  const [collapsed, setCollapsed] = React.useState({});
  const [savedAt, setSavedAt] = React.useState(Date.now());
  const [sendModal, setSendModal] = React.useState(null);
  // Estado da linha no banco (status/valor/token) — o header mostra a
  // situação real da proposta em vez de textos fixos.
  const [meta, setMeta] = React.useState(null);
  // id real da linha salva — nasce do editId (abrir existente) ou do
  // retorno do primeiro "Salvar"/"Enviar". "Publicar" precisa dele.
  const [recordId, setRecordId] = React.useState(editId || null);
  const [publicando, setPublicando] = React.useState(false);
  // Overlay fullscreen do PDF (mesmo padrão da Ficha Técnica): a leitura
  // de verdade e o "Salvar PDF"/"Imprimir" acontecem aqui, em tamanho real —
  // a coluna lateral é só um preview em miniatura.
  const [pdfOverlay, setPdfOverlay] = React.useState(false);
  // Preview ocupa 460px fixos; em telas menores ele espremia o formulário.
  // Agora é alternável e a escolha persiste.
  const [showPreview, setShowPreview] = React.useState(() => {
    try { return localStorage.getItem("vpprd.proposta-preview") !== "0"; } catch (e) { return true; }
  });
  // Faz o "salvo há Xs" andar sozinho (antes só atualizava a cada tecla).
  const [, forceTick] = React.useState(0);
  const formRef = React.useRef(null);

  React.useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem("vpprd.proposta-preview", showPreview ? "1" : "0"); } catch (e) {}
  }, [showPreview]);

  // Save to Supabase
  // SSO / portas abertas: a identidade vem do vpsistema (window.__VP_USER),
  // NÃO de um login separado. Antes exigia sb.auth.getUser() (sessão Supabase
  // Auth), que nunca existe neste modelo — por isso a proposta nunca salvava.
  // Aqui persiste com a anon key + identidade do SSO, mapeando para as colunas
  // REAIS da tabela `propostas` (sem alterar o schema do banco).
  // Retorna { id, token } da linha salva (ou null em falha) — precisamos do
  // id/token pra abrir o modal de envio por assinatura digital.
  const saveToSupabase = React.useCallback(async () => {
    if (!window.__VP_SB?.sb) return { erro: 'Sem conexão com o sistema.' };
    // Evita poluir a tabela real com rascunhos em branco: só persiste com cliente.
    if (!data?.cliente?.nome?.trim()) return { erro: 'Preencha o nome do cliente para salvar.' };

    const vpUser = window.__VP_USER || {};
    const chave = (data.numero || '').trim() || null;   // → numero_documento (texto)
    try {
      const payload = {
        numero_documento: chave,
        proposal_type: eq,
        titulo: [data.cliente?.nome, data.obra?.nome].filter(Boolean).join(' · ') || chave,
        data_json: { ...data, _vp_user: { email: vpUser.email || null, nome: vpUser.nome || null } },
        master_id: data.masterId || null,
        precificacao_id: data.precificacaoId || null,
        // Sem isto a listagem congelava no valor antigo e proposta nova ficava sem valor.
        valor_total: calcularValorTotal(data, eq),
        // Elo persistido com a cotação de origem (herança).
        numero_cotacao: parseInt(data.numeroCotacao, 10) || null,
        atualizado_em: new Date().toISOString(),
      };

      /* vendedor_id era NOT NULL e nunca era enviado — todo INSERT de
         proposta nova falhava. Resolvemos pelo e-mail do SSO em `perfis`;
         só mandamos quando resolve, pra um update não apagar o vendedor
         que já estava gravado. */
      const vendedorId = await resolverVendedorId();
      if (vendedorId) payload.vendedor_id = vendedorId;

      // Alvo do update: se veio de "Editar" (editId), usa o id diretamente;
      // senão, chave de negócio = numero_documento (texto). O `numero` (int)
      // é auto-sequencial no banco, então não o enviamos no insert. Status
      // só é definido na CRIAÇÃO — salvar de novo não regride o status de
      // uma proposta já enviada/assinada.
      let existing = editId ? { id: editId } : null;
      if (!existing && chave) {
        const { data: rows } = await window.__VP_SB.sb
          .from('propostas')
          .select('id')
          .eq('numero_documento', chave)
          .order('criado_em', { ascending: false })
          .limit(1);
        existing = rows && rows[0];
      }

      if (existing?.id) {
        const { data: row, error } = await window.__VP_SB.sb
          .from('propostas').update(payload).eq('id', existing.id).select('id, token').single();
        if (error) throw error;
        setRecordId(row.id);
        return row;
      } else {
        const { data: row, error } = await window.__VP_SB.sb
          .from('propostas').insert([{ ...payload, status: 'rascunho' }]).select('id, token').single();
        if (error) throw error;
        setRecordId(row.id);
        return row;
      }
    } catch (e) {
      // Antes o erro era engolido e o usuário via "salva localmente" — uma
      // falha total (ex.: not-null de vendedor_id) parecia sucesso parcial.
      console.error('Supabase save failed:', e);
      return { erro: e.message || String(e) };
    }
  }, [data, eq, editId]);

  /* ---- Publicar = congelar a versão oficial (ver proposta-store.js) ----
     Salva antes se ainda não existir linha no banco. O primeiro envio já
     publica sozinho (ver markSent) — este botão serve pra publicar antes de
     enviar, ou pra REpublicar depois de editar uma proposta já enviada. */
  const publicar = React.useCallback(async () => {
    if (publicando || !window.PropostaStore) return;
    setPublicando(true);
    try {
      let id = recordId;
      if (!id) {
        window.toast?.('Salvando proposta antes de publicar…', 'info');
        const salvo = await saveToSupabase();
        if (!salvo || salvo.erro) {
          window.toast?.('❌ Não foi possível salvar: ' + ((salvo && salvo.erro) || 'erro desconhecido'), 'error');
          return;
        }
        id = salvo.id;
      }
      const updated = await window.PropostaStore.publicar(id);
      setMeta((m) => ({ ...(m || {}), publicado_em: updated.publicado_em, version: updated.version, publicado_por: updated.publicado_por }));
      window.toast?.(`✓ Versão oficial publicada (v${updated.version})`, 'success');
    } catch (e) {
      window.toast?.('❌ ' + (e.message || String(e)), 'error');
    } finally {
      setPublicando(false);
    }
  }, [publicando, recordId, saveToSupabase]);

  // Salva e abre o modal de envio por assinatura digital — gera o link
  // público (/assinar/:token) igual ao Contrato Instalador/Venda, em vez de
  // só marcar status='enviada' sem nunca produzir nenhum link real.
  const abrirEnvio = React.useCallback(async () => {
    if (!window.PropostaStore) { window.toast?.('Store de assinatura não carregado.', 'error'); return; }
    window.toast?.('Salvando proposta...', 'info');
    const saved = await saveToSupabase();
    if (!saved || saved.erro) { window.toast?.('❌ Não foi possível salvar: ' + ((saved && saved.erro) || 'erro desconhecido'), 'error'); return; }
    const token = saved.token || await window.PropostaStore.garantirToken(saved.id);
    setSendModal({ id: saved.id, token, numero_documento: data.numero, cliente: data.cliente, valorTotal: calcularValorTotal(data, eq) });
  }, [data, eq, saveToSupabase]);

  // Autosave para localStorage (instantâneo e seguro). A persistência no
  // Supabase é feita nas ações explícitas "Salvar rascunho" / "Enviar" —
  // assim não escrevemos na tabela real `propostas` a cada tecla digitada.
  React.useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(data)); setSavedAt(Date.now()); } catch (e) {}
    }, 400);
    return () => clearTimeout(t);
  }, [data]);

  React.useEffect(() => {
    try { localStorage.setItem("vpprd.proposta-eq", eq); } catch (e) {}
  }, [eq]);

  // Abrir uma Proposta já existente (clique em "Editar" na listagem) — carrega
  // o data_json salvo em vez do rascunho do localStorage ou do prefill.
  React.useEffect(() => {
    if (!editId || !window.__VP_SB?.sb) return;
    let cancelado = false;
    setLoadingExisting(true);
    window.__VP_SB.sb.from('propostas')
      .select('proposal_type, data_json, status, numero_documento, master_id, valor_total, token, titulo, atualizado_em, publicado_em, publicado_por, version')
      .eq('id', editId).maybeSingle()
      .then(({ data: row }) => {
        if (cancelado || !row) return;
        const dj = row.data_json || {};
        /* Proposta antiga: além de converter pro formato do editor, guardamos
           o data_json original em __legadoOriginal. Sem isso, salvar apagava
           de vez tudo que só existia no formato antigo (termos, recursos,
           blocos de escada/esteira, textos jurídicos). */
        const carregado = ehPropostaSchemaLegado(dj)
          ? { ...deepMergeProposta(makeDefaultProposta(), converterPropostaLegado(dj, row.titulo)), __legadoOriginal: dj }
          : (row.data_json || makeDefaultProposta());
        setData(carregado);
        setEq(row.proposal_type || 'elevador');
        setMeta({
          status: row.status, numero_documento: row.numero_documento,
          master_id: row.master_id, valor_total: row.valor_total,
          token: row.token, atualizado_em: row.atualizado_em,
          publicado_em: row.publicado_em, publicado_por: row.publicado_por, version: row.version,
        });
      })
      .finally(() => { if (!cancelado) setLoadingExisting(false); });
    return () => { cancelado = true; };
  }, [editId]);

  const set = React.useCallback((path, value) => {
    setData((d) => setDeep(d, path, value));
  }, []);

  /* ---- Herança pelo Nº da Cotação ----
     A proposta é o fim do pipeline (Formulário → Cotação → Precificação),
     mas não é obrigada a vir dele: sem o número, o vendedor preenche do
     zero. Com o número, puxamos o que já existe e só COMPLETAMOS o que
     está vazio — nada que o vendedor digitou é sobrescrito. */
  const [herdando, setHerdando] = React.useState(false);
  const [heranca, setHeranca] = React.useState(null);

  const herdar = React.useCallback(async () => {
    const num = String(data.numeroCotacao || '').trim();
    if (!num) return;
    if (!window.PropostaHeranca) {
      setHeranca({ tipo: 'erro', texto: 'Motor de herança não carregado — recarregue a página.' });
      return;
    }
    setHerdando(true);
    setHeranca(null);
    try {
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(num);
      if (!r.encontrado) {
        setHeranca({ tipo: 'aviso', texto: `Nenhum formulário encontrado para a Cotação nº ${num}. Você pode seguir preenchendo a proposta manualmente.` });
      } else {
        setData((d) => deepMergeHeranca(d, r.prefill));
        setEq('elevador');
        setHeranca({ tipo: 'ok', texto: 'Herdado de: ' + window.PropostaHeranca.resumoFontes(r.fontes) });
        window.toast?.(`✓ Dados herdados da cotação ${num}`, 'success');
      }
    } catch (e) {
      setHeranca({ tipo: 'erro', texto: e.message || String(e) });
    } finally {
      setHerdando(false);
    }
  }, [data.numeroCotacao]);

  /* ---- Gerar PDF (overlay em tela cheia, padrão Ficha Técnica) ----
     "Salvar PDF": cada página do preview já é um bloco discreto (Capa,
     Identificação, Especificação...), então captura 1 canvas por página via
     html2canvas e monta um PDF A4 retrato — sem precisar do algoritmo de
     paginação por átomos da Ficha (lá o documento é um fluxo único; aqui
     já são páginas fixas). "Imprimir" reaproveita o @media print existente. */
  const gerarPdfArquivo = React.useCallback(async () => {
    if (!window.html2canvas || !window.jspdf) {
      window.toast?.('Biblioteca de PDF ainda carregando…', 'error');
      return;
    }
    const paginas = Array.from(document.querySelectorAll('.pe-pdf-overlay .pe__pdf'));
    if (!paginas.length) return;
    const safeName = (data.cliente?.nome || data.numero || 'proposta')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    window.toast?.('Gerando PDF…', 'info');
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < paginas.length; i++) {
        const canvas = await window.html2canvas(paginas[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const img = canvas.toDataURL('image/jpeg', 0.97);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
      }
      pdf.save(`Proposta-${safeName}.pdf`);
    } catch (e) {
      console.error('PDF error', e);
      window.toast?.('Erro ao gerar PDF: ' + (e.message || e), 'error');
    }
  }, [data]);

  const imprimirOverlay = React.useCallback(() => {
    let inj = document.getElementById('__pe-print-page');
    if (inj) inj.remove();
    inj = document.createElement('style');
    inj.id = '__pe-print-page';
    inj.textContent = '@page { size: A4; margin: 0; }';
    document.head.appendChild(inj);
    setTimeout(() => window.print(), 60);
  }, []);

  const resetProposal = () => {
    if (confirm("Descartar todas as alterações e reiniciar a proposta?")) {
      setData(makeDefaultProposta());
      window.toast("Proposta reiniciada", "info");
    }
  };

  const sections = getSections(eq);
  const groups = sections.reduce((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  // calc overall fill
  const fills = sections.map(s => fillFor(data, eq, s.id));
  const filledCount = fills.filter(f => f.kind === "full").length;
  const partialCount = fills.filter(f => f.kind === "partial").length;
  const completePct = Math.round((filledCount + partialCount * 0.5) / sections.length * 100);

  const jump = (sid) => {
    setActiveSection(sid);
    if (collapsed[sid]) setCollapsed((c) => ({ ...c, [sid]: false }));
    requestAnimationFrame(() => {
      const el = document.getElementById("sec-" + sid);
      if (el && formRef.current) {
        const top = el.offsetTop - 16;
        formRef.current.scrollTo({ top, behavior: "smooth" });
      }
    });
  };

  // Active section follows scroll
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = () => {
      const top = form.scrollTop;
      let best = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById("sec-" + s.id);
        if (el && el.offsetTop - 100 <= top) best = s.id;
      }
      setActiveSection(best);
    };
    form.addEventListener("scroll", handler, { passive: true });
    return () => form.removeEventListener("scroll", handler);
  }, [eq, sections.length]);

  if (loadingExisting) {
    return <div className="page fade-in" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando proposta…</div>;
  }

  return (
    <div className="pe-shell fade-in">
      {/* ---- Topbar: identidade + situação real + ações (sem duplicação) ---- */}
      <header className="pe-top">
        <div className="pe-top__crumb">
          <button className="pe-top__back" onClick={() => setRoute("propostas")}>
            <Icon.chevLeft size={14}/> Propostas
          </button>
          <span className="pe-top__sep">/</span>
          <span className="pe-top__crumb-cur">{data.numero || "Nova proposta"}</span>
          <div style={{ flex: 1 }}/>
          <span className="pe-top__autosave" title="Rascunho salvo automaticamente neste navegador">
            <span className="dot"/> rascunho salvo {tempoRelativo(savedAt)}
          </span>
        </div>

        <div className="pe-top__main">
          <div className="pe-top__id">
            <h1>{data.cliente.nome || "Sem cliente"}</h1>
            <div className="pe-top__chips">
              <PEChip label="Nº" value={data.numero || "—"} mono/>
              {data.masterId && <PEChip label="Master ID" value={data.masterId} mono/>}
              <PEChip label="Obra" value={data.obra.nome || data.obra.cidade || "—"}/>
              <PEChip label="Total" value={fmtValorProposta(data, eq)} mono destaque/>
              <span className={"pe-top__status is-" + (meta?.status || "rascunho")}>
                {PE_STATUS_LABEL[meta?.status] || "Rascunho"}
              </span>
              {meta?.publicado_em ? (
                <span className="pe-top__publicado" title="Versão que o cliente lê e assina — editar depois não muda o que já foi publicado">
                  <Icon.check size={11}/> Publicado {window.PropostaStore ? window.PropostaStore.fmtDateTime(meta.publicado_em) : ""} · v{meta.version || 1}
                </span>
              ) : null}
            </div>
          </div>

          <div className="pe-top__actions">
            <button className="pe-top__ghost pe-top__ghost--preview" onClick={() => setShowPreview((v) => !v)}
              title={showPreview ? "Ocultar pré-visualização" : "Mostrar pré-visualização"}>
              <Icon.eye size={14}/> {showPreview ? "Ocultar preview" : "Ver preview"}
            </button>
            <button className="pe-top__ghost" onClick={resetProposal} title="Descartar e recomeçar">
              <Icon.copy size={14}/> Reiniciar
            </button>
            <Button variant="outline" size="sm" icon="upload" disabled={publicando}
              title="Congela esta versão como a oficial — é o que o cliente vai ler e assinar"
              onClick={publicar}>
              {publicando ? "Publicando…" : (meta?.publicado_em ? "Republicar" : "Publicar")}
            </Button>
            <Button variant="outline" size="sm" icon="download" onClick={() => setPdfOverlay(true)}>Gerar PDF</Button>
            <Button variant="secondary" size="sm" icon="check" onClick={async () => {
              window.toast("Salvando proposta...", "info");
              const salvo = await saveToSupabase();
              setSavedAt(Date.now());
              if (salvo && !salvo.erro) window.toast("✓ Proposta salva no sistema", "success");
              else window.toast("❌ Não salvou: " + ((salvo && salvo.erro) || 'erro desconhecido'), "error");
            }}>Salvar</Button>
            <Button variant="primary" size="sm" icon="send" onClick={abrirEnvio}>Enviar p/ Cliente</Button>
          </div>
        </div>

        {/* Abas de equipamento */}
        <nav className="pe-top__tabs">
          {[
            { id: "elevador", label: "Elevador", icon: "building", sub: "PASSAGEIROS · CARGA" },
            { id: "escada", label: "Escada Rolante", icon: "layers", sub: "30° · 35°" },
            { id: "esteira", label: "Esteira Rolante", icon: "package", sub: "MALL · AIRPORT" },
          ].map(t => (
            <button key={t.id} className={"pe__tab " + (eq === t.id ? "is-active" : "")} onClick={() => setEq(t.id)}>
              {React.createElement(Icon[t.icon] || Icon.bolt, { size: 16 })}
              <span>{t.label}</span>
              <span className="pe__tab-sub">{t.sub}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className={"pe" + (showPreview ? "" : " pe--no-preview")}>
        <div className="pe__main">
          {/* Sidenav */}
          <nav className="pe__sidenav">
            <div className="pe__sidenav-progress">
              <div className="pe__sidenav-progress-lbl">Preenchimento</div>
              <div className="pe__sidenav-progress-val">{completePct}%</div>
              <div className="progress"><span style={{ width: completePct + "%" }}/></div>
              <div className="mono small" style={{ marginTop: 6, fontSize: 10, color: "var(--fg3)" }}>
                {filledCount}/{sections.length} seções completas
              </div>
            </div>
            {Object.entries(groups).map(([g, items]) => (
              <div key={g}>
                <div className="pe__sidenav-group">{g}</div>
                {items.map((s) => {
                  const f = fillFor(data, eq, s.id);
                  const I = Icon[s.icon] || Icon.bolt;
                  const isActive = activeSection === s.id;
                  const isDone = f.kind === "full";
                  return (
                    <div key={s.id} className={"pe__sidenav-item " + (isActive ? "is-active" : "") + (isDone && !isActive ? " is-done" : "")}
                      onClick={() => jump(s.id)}>
                      <span className="pe__sidenav-icon">
                        {isDone ? <Icon.check/> : <I/>}
                      </span>
                      <span style={{ flex: 1 }}>{s.title}</span>
                      {f.kind === "partial" ? <span className="mono small" style={{ fontSize: 9, color: "var(--vp-warning-ink)" }}>{f.label}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Form */}
          <div className="pe__form" ref={formRef}>
            {sections.map((s, i) => {
              const f = fillFor(data, eq, s.id);
              const isCollapsed = !!collapsed[s.id];
              return (
                <PESection key={s.id} id={s.id}
                  num={String(i + 1).padStart(2, "0")}
                  title={s.title}
                  sub={s.group}
                  fill={f}
                  collapsed={isCollapsed}
                  onToggle={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}>
                  {renderSection(s.id, eq, data, set, { herdar, herdando, heranca })}
                </PESection>
              );
            })}

            <p className="pe__form-end">
              Fim do formulário · as ações (salvar, PDF, enviar) ficam sempre no topo da tela.
            </p>
          </div>
        </div>

        {/* Live PDF preview */}
        {showPreview && <PEPreview data={data} eq={eq}/>}
      </div>

      {sendModal && (
        <PropostaSendModal record={sendModal} onClose={() => setSendModal(null)}
          onSent={() => window.toast?.('✓ Proposta enviada — o cliente já pode ler e assinar pelo link.', 'success')}/>
      )}

      {/* Overlay fullscreen do PDF — mesmo padrão da Ficha Técnica */}
      {pdfOverlay && ReactDOM.createPortal(
        <div className="pe-pdf-overlay" onClick={(e) => { if (e.target.classList.contains('pe-pdf-overlay')) setPdfOverlay(false); }}>
          <div className="pe-pdf-bar">
            <span>Proposta — {data.cliente?.nome || data.numero || 'Nova proposta'}</span>
            <div className="pe-pdf-actions">
              <Button variant="primary" size="sm" icon="download" onClick={gerarPdfArquivo}>Salvar PDF</Button>
              <Button variant="outline" size="sm" icon="print" onClick={imprimirOverlay}>Imprimir</Button>
              <Button variant="ghost" size="sm" onClick={() => setPdfOverlay(false)}>Fechar</Button>
            </div>
          </div>
          <div className="pe-pdf-scroll">
            <PEPreview data={data} eq={eq} overlay/>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function renderSection(sid, eq, data, set, extras) {
  extras = extras || {};
  switch (sid) {
    case "proposta": return <S_Proposta d={data} set={set} herdar={extras.herdar} herdando={extras.herdando} heranca={extras.heranca}/>;
    case "cliente": return <S_Cliente d={data} set={set}/>;
    case "obra": return <S_Obra d={data} set={set}/>;
    case "texto": return <S_TextoProposta d={data} set={set} eq={eq}/>;

    case "descricao":
      return eq === "elevador" ? <S_DescricaoElevador d={data} set={set}/> : <S_DescricaoSimples d={data} set={set} eq={eq}/>;
    case "espec":
      return eq === "elevador" ? <S_EspecElevador d={data} set={set}/> : <S_EspecEscada d={data} set={set} eq={eq}/>;

    case "acabamentos": return <S_Acabamentos d={data} set={set}/>;
    case "especificidades": return <S_Especificidades d={data} set={set} eq={eq}/>;

    case "caracteristicas":
      return <S_RepText items={data.elevador.caracteristicas} setItems={(v) => set("elevador.caracteristicas", v)}
        addLabel="+ Adicionar Característica" placeholder="Ex.: Sistema gearless de alta eficiência energética..."/>;
    case "recursos":
      return <S_RepText items={data.elevador.recursos} setItems={(v) => set("elevador.recursos", v)}
        addLabel="+ Adicionar Recurso" placeholder="Ex.: ARD — resgate automático em falta de energia..."/>;
    case "infra":
      return <S_RepText items={data.elevador.infraestrutura} setItems={(v) => set("elevador.infraestrutura", v)}
        addLabel="+ Adicionar Item de Infraestrutura" placeholder="Ex.: Casa de máquinas conforme NBR 16858..."/>;

    case "valores": return <S_Valores d={data} set={set} eq={eq}/>;
    case "condicoesPagto": return <S_CondPagamentoElev d={data} set={set}/>;
    case "ajustes": return <S_Ajustes d={data} set={set} eq={eq}/>;
    case "prazo": return <S_PrazoEntrega d={data} set={set} eq={eq}/>;
    case "responsabilidades": return <S_Responsabilidades d={data} set={set}/>;
    case "instalacao": return <S_InstalacaoMontagem d={data} set={set} eq={eq}/>;
    case "garantia": return <S_GarantiaCondicoes d={data} set={set} eq={eq}/>;
    default: return null;
  }
}

Object.assign(window, { PropostaEditor, makeDefaultProposta });
