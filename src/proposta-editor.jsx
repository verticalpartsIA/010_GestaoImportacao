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
      // Marketing da linha de produto — igual ao PDF de referência
      // (Proposta_776_B): texto institucional real da VerticalParts, não
      // específico de um equipamento, então nasce preenchido (não é dado
      // que arrisca descrever a unidade errada).
      beneficios: [
        "Soluções de última geração para oferecer viagens seguras e confortáveis aos usuários.",
        "Eficiência energética e respeito ao meio ambiente.",
        "Componentes de maior durabilidade.",
        "Novo design atemporal com uma gama de opções exclusivas.",
      ],
      diferenciais: [
        "Piso em 12 mm de resina, modelo FR035",
        "Segurança em relação ao espelho não ser de vidro e sim de Aço espelhado. (Não corre o risco de acidente com quebra de espelho).",
        "Escada de acesso ao poço do elevador inclusa no projeto.",
        "Iluminação da caixa de corrida do elevador inclusa no projeto.",
      ],
      caracteristicasEquip: {
        alimentacao: "Trifásico, 220v – A tensão deverá ser confirmada por ocasião da assinatura do contrato. Na hipótese de não correção da informação, a tensão será considerada como correta e definitiva.",
        comando: "O comando de última geração e microprocessado garante ao equipamento paradas precisas, aceleração e desaceleração confortável e tudo isso com o máximo em economia de energia.",
        tracao: "Acionamento Elétrico com cabo de aço ou cinto de tração",
      },
      recursosNomeados: [
        { nome: "Ventiladores de Cabine", desc: "Nossas cabines possuem ventiladores para refrigeração e conforto aos usuários." },
        { nome: "Sistema de Intercomunicação", desc: "Nossas cabines são equipadas com intercomunicadores, e disponibilizamos interfones para a portaria." },
        { nome: "Retorno Automático", desc: "Após atender todas as chamadas, o elevador retorna automaticamente ao andar pré-configurado." },
        { nome: "Despacho de Carro Lotado", desc: "Através de pesadores de carga na cabine, o sistema sabe a quantidade de passageiros e, além de sinalizar em caso de carro lotado para evitar excesso de carga, não para a cabine para chamadas de pavimento, caso a capacidade já esteja acima de 80% quando o elevador estiver em movimento." },
        { nome: "Resgate Manual Simplificado", desc: "Em caso de falta de energia o equipamento possui um sistema de resgate simplificado através de um botão de acionamento manual (localizado no painel de comando), onde o técnico consegue manobrar a cabine para o pavimento mais próximo e liberar a pessoa retida na cabine." },
        { nome: "Iluminação de Emergência na Cabine", desc: "Nossas cabines são equipadas com iluminação de emergência na cabine no caso de falta de energia." },
        { nome: "Cancelamento de Chamadas Falsas", desc: "Caso sejam feitas 3 ou mais chamadas na botoeira de cabine e nenhum passageiro entre ou saia da cabine, o sistema cancela estas chamadas, economizando energia e atendendo melhor o fluxo real de pavimento." },
        { nome: "Indicação de Posição", desc: "Presente em todas as botoeiras de todos os pavimentos, para maior conforto do usuário." },
      ],
      infraestruturaNomeada: [
        { nome: "Desenhos de Instalação", desc: "Serão fornecidos pela VerticalParts após a contratação. Os desenhos contêm todas as dimensões necessárias para instalação e funcionamento dos elevadores, bem como as cargas aplicadas nas estruturas do edifício." },
        { nome: "Caixa de Corrida", desc: "Em alvenaria e concreto, segundo as especificações do fabricante." },
        { nome: "Tensão de Alimentação", desc: "Deverão ser garantidas ainda no processo de montagem, dentro das especificações de projeto e normas brasileiras." },
      ],
      // Fotos reais do equipamento (upload) — path no Storage, mesmo
      // padrão da Ficha Técnica (ver proposta-imagens.js). Nascem vazias:
      // a página só aparece no PDF se pelo menos uma foto for enviada.
      fotos: { unidade: null, teto: null, botoeira: null },
      valores: { equipamento: "", quantidade: "1", valorUnit: "", difal: "",
        forma: "40% à vista e 4 parcelas",
        parcelas: [
          { desc: "Sinal de 40% na assinatura do contrato", valor: "" },
          { desc: "1ª PARCELA", valor: "" },
          { desc: "2ª PARCELA", valor: "" },
          { desc: "3ª PARCELA", valor: "" },
          { desc: "4ª PARCELA", valor: "" },
        ]},
      condicoesPagto: {
        venda: "De acordo com os valores acima, forma de pagamento será à vista e parcelas conforme tabela de preços. A partir da data do pagamento efetivo do sinal, a cada 30 dias, vencem as parcelas subsequentes.",
        impostos: "A porcentagem de serviços em relação ao preço total pode chegar em até 30%, dependendo de itens, como por exemplo a instalação e frete. Os impostos serão lançados na época de sua exigibilidade, e serão calculados e lançados em função do objeto e/ou serviço fornecido, na forma legal própria.",
        ajusteFrete: "O valor do frete marítimo considerado nesta proposta é de USD 6.000 por contêiner. Caso o custo do frete marítimo aumente em mais de 8% em relação ao valor inicial estipulado, o comprador será responsável por arcar com o aumento proporcional do custo de frete. O ajuste será realizado com base no valor indicado no Bill of Lading (BL) fornecido pelo armador responsável pelo transporte no momento do embarque.",
        reajuste: "Em caso de pagamento em prazo superior a 12 (doze) meses, conforme previsão na Lei 10.192/01, o preço do(s) equipamento(s) será reajustado com base nos índices de variação do IGP-DI coluna 2 (Índice Geral de Preços - Disponibilidade Interna), apurado e divulgado pela Fundação Getúlio Vargas, a partir do penúltimo mês anterior ao mês estabelecido para a data-base ajustada no Contrato e o penúltimo mês anterior ao mês estabelecido para o vencimento da prestação, obedecida a periodicidade mínima permitida legalmente. O preço do(s) equipamento(s) não inclui qualquer custo financeiro ou expectativa de inflação.",
      },
      ajustes: { preset: "sp", cambio: "", faturamento: "",
        // Distintos de `cambio` (taxa numérica) e `faturamento` (select) acima —
        // são os parágrafos jurídicos da página "Ajustes e Impostos" do PDF.
        clausulaCambial: "O valor total desta proposta está baseado na taxa de câmbio (dólar americano x real) vigente na data da assinatura deste contrato. No caso de variação superior a 10% na taxa de câmbio, será realizado um ajuste proporcional no valor final do contrato.",
        faturamentoTexto: "Venda de Equipamentos serão faturadas pela empresa VerticalParts – Indústria e Comércio Ltda, com sede na Rua Armandina Braga de Almeida, 383 - Guarulhos – SP - CEP: 07141-003.",
        reajuste: "Reajuste anual conforme IPCA acumulado.",
        taxasIn: "II, IPI, PIS/COFINS sobre importação. ICMS interestadual.",
        taxasOut: "ICMS final destino (DIFAL conforme localização da obra). Taxa CREA/CAU.",
        taxasInclusas: "Inclusos no preço todos os impostos decorrentes de Emissão de Notas Fiscais de Venda/Serviços, Montagem, Instalação dos Equipamentos, bem como ART'S.",
        taxasExcluidas: "Não estão inclusos no preço taxas de alvará de funcionamento ou outras licenças de qualquer natureza vinculadas às obrigações do COMPRADOR, bem como majorações de taxas e impostos, a exemplo de DIFAL de ICMS e de tributos e encargos incidentes sobre a importação e nacionalização das mercadorias (incluindo, sem limitação, Imposto de Importação (II), IPI, PIS/COFINS-Importação, ICMS-importação, AFRMM e taxa SISCOMEX), havidos após a emissão desta proposta ou da NF de venda.",
      },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "Os prazos poderão ser revisados em caso de eventos extraordinários relacionados a pandemia, escassez global de semicondutores ou bloqueios portuários." },
      responsabilidades: {
        vendedor: ["Entrega dos materiais e equipamentos no local da instalação", "Montagem completa dos elevadores"],
        comprador: [
          "Preparo do(s) poço(s) e caixa(s) de acordo com as nossas indicações;",
          "Execuções de trabalhos de concreto, ponto de içamento, alvenaria, andaimes, conserto nas paredes, recorte de pisos, mármore e granitos;",
          "Fornecimento de energia elétrica adequada aos nossos serviços e necessidades;",
          "Ligações de luz e força definitivas para o painel de comando e máquina no pavimento superior de acordo com Desenho Técnico fornecido;",
          "Licenças das autoridades competentes para montagem e para o funcionamento dos equipamentos.",
        ],
      },
      garantia: { garantia: "Os equipamentos da VerticalParts terão garantia das peças de 90 (noventa) dias a contar da data de assinatura do Termo de Conclusão da Instalação. Esse prazo poderá ser estendido por mais 9 (nove) meses, desde que os equipamentos estejam sob assistência técnica da VerticalParts ou de empresa por esta homologada.",
        condicoes: "Esta proposta está sujeita a retificação em qualquer tempo. O preço cotado nesta proposta, ou o que vier a ser definido, pressupõe a contratação dos equipamentos consoante as nossas modalidades e condições normais e usuais em vigor na ocasião da negociação. Condições ou exigências especiais demandarão em revisão de preço e adequação à inovação desejada.",
        horario: "Segunda à Sexta das 08:00 às 17:12hs" },
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
      { id: "beneficiosDiferenciais", title: "Benefícios e Diferenciais", icon: "star", group: "Apresentação" },
      { id: "espec", title: "Especificações Técnicas", icon: "ruler", group: "Produto" },
      { id: "acabamentos", title: "Acabamentos", icon: "star", group: "Produto" },
      { id: "caracteristicas", title: "Características Principais", icon: "check", group: "Produto" },
      { id: "recursos", title: "Recursos Inclusos", icon: "list", group: "Produto" },
      { id: "infra", title: "Infraestrutura e Instalação", icon: "hardhat", group: "Produto" },
      { id: "fotos", title: "Fotos do Equipamento", icon: "package", group: "Produto" },
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
  else if (sectionId === "beneficiosDiferenciais") target = { b: ed.beneficios, d: ed.diferenciais };
  else if (sectionId === "caracteristicas") target = ed.caracteristicasEquip || ed.caracteristicas;
  else if (sectionId === "recursos") target = ed.recursosNomeados || ed.recursos;
  else if (sectionId === "infra") target = ed.infraestruturaNomeada || ed.infraestrutura;
  else if (sectionId === "fotos") target = ed.fotos;
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
    if (Array.isArray(v)) {
      // Só preenche se o vendedor ainda não tiver uma lista própria aqui —
      // antes sobrescrevia sempre que a herança trazia algo, mesmo com
      // especificações/ativos já digitados (issue #160).
      if (v.length && !(Array.isArray(base[k]) && base[k].length)) out[k] = v;
      return;
    }
    if (typeof v === 'object' && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMergeHeranca(base[k], v);
      return;
    }
    // Campo escalar: só preenche se ainda estiver vazio — antes sobrescrevia
    // incondicionalmente, contrariando a regra "nunca apaga o que o
    // vendedor já digitou" (issue #160).
    if (base[k] === undefined || base[k] === null || base[k] === '') out[k] = v;
  });
  return out;
}

/* ---- Apoio ao cabeçalho do editor ---- */
const PE_STATUS_LABEL = {
  rascunho: 'Rascunho', enviada: 'Enviada', visualizada: 'Visualizada pelo cliente',
  aprovada: 'Assinada', recusada: 'Recusada', expirada: 'Expirada', cancelada: 'Cancelada',
  revisao_solicitada: 'Revisão solicitada',
};

/* Estado que o badge mostra. O `status` sozinho contava só metade da história:
   uma proposta publicada (mas ainda não enviada) ficava 'rascunho' no banco e
   o badge dizia "Rascunho" bem ao lado do selo "Publicado vN" — contradição
   que o QA E2E pegou. Aqui, um rascunho já publicado vira "Publicada", e
   qualquer estado avançado (enviada/assinada/...) manda no badge. */
function statusVisual(meta) {
  const st = (meta && meta.status) || 'rascunho';
  if (st !== 'rascunho') return { cls: st, label: PE_STATUS_LABEL[st] || st };
  if (meta && meta.publicado_em) return { cls: 'publicada', label: 'Publicada' };
  return { cls: 'rascunho', label: 'Rascunho' };
}

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
  const [telefone, setTelefone] = React.useState(record.cliente?.telefone || '');
  const [email, setEmail] = React.useState(record.cliente?.email || '');
  const [name, setName] = React.useState(record.cliente?.nome || '');
  const [sent, setSent] = React.useState(null);
  const [sendingChannel, setSendingChannel] = React.useState(null);
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

  /* Botão de cada canal já dispara o envio na hora — mesmo padrão do
     FELinkClienteModal/FECotacaoFornecedorModal (formulario-elevador.jsx):
     sem passo intermediário de "escolher canal" + botão genérico, que
     confundia o vendedor (parecia só gerar link, mesmo abrindo o
     WhatsApp por baixo). */
  const enviar = async (channel) => {
    if (sendingChannel) return;
    const contact = channel === 'whatsapp' ? telefone : email;
    setSendingChannel(channel);
    try {
      await store.markSent(record.id, channel, { name, contact });
      if (channel === 'whatsapp') window.open(store.whatsAppHref(contact, message), '_blank');
      else if (channel === 'email') window.open(store.mailtoHref(contact, `Proposta ${record.numero_documento} — VerticalParts`, message), '_blank');
      setSent(channel);
      onSent && onSent();
    } catch (e) {
      window.toast?.('Erro ao registrar envio: ' + (e.message || e), 'error');
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <Modal title={sent ? 'Enviado' : 'Enviar para assinatura'} onClose={onClose} width={560}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="small muted" style={{ margin: 0 }}>
          {sent ? 'A proposta está aguardando a leitura e assinatura do cliente.' : 'Escolha o canal de envio — o cliente lê, assina digitalmente e pode baixar sua própria cópia, sem precisar de cadastro.'}
        </p>
        <div className="card" style={{ padding: 12 }}>
          <b>{record.numero_documento}</b> <span className="muted">· {record.cliente?.nome || 'Sem cliente'}</span>
          <div className="row sb" style={{ marginTop: 6 }}><span className="small muted">Valor</span><b className="mono">{valorFmt}</b></div>
        </div>
        {!sent ? (
          <>
            <FEField label="Nome do destinatário"><FEInput value={name} onChange={setName} placeholder="Nome completo"/></FEField>
            <FEField label="WhatsApp (com DDD)"><FEInput value={telefone} onChange={setTelefone} placeholder="(12) 99200-4047"/></FEField>
            <FEField label="E-mail"><FEInput value={email} onChange={setEmail} placeholder="contato@cliente.com.br"/></FEField>
            <div className="row gap-2" style={{ background: 'var(--vp-gray-50)', padding: '8px 10px' }}>
              <code className="mono small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
              <Button variant="ghost" size="sm" icon="copy" onClick={copyLink}>{copied ? 'Copiado ✓' : 'Copiar'}</Button>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <Button variant="primary" icon="message" disabled={!!sendingChannel || !telefone.trim()} onClick={() => enviar('whatsapp')}>
                {sendingChannel === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp'}
              </Button>
              <Button variant="outline" icon="mail" disabled={!!sendingChannel || !email.trim()} onClick={() => enviar('email')}>
                {sendingChannel === 'email' ? 'Enviando…' : 'Enviar por E-mail'}
              </Button>
            </div>
          </>
        ) : (
          <div className="alert info" style={{ margin: 0 }}>
            <Icon.check/>
            <div>
              <div className="alert__title">{sent === 'whatsapp' ? 'Enviado por WhatsApp' : 'Enviado por e-mail'}</div>
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

  /* Subcircuito de revisão de proposta (23/08, achado do Dossiê PCB §9.6) —
     decisão INTERNA da VerticalParts sobre o pedido de revisão do cliente,
     distinta de aceitar/recusar a proposta em si. */
  const [decidindoRevisao, setDecidindoRevisao] = React.useState(false);
  const [mostrarRecusaRevisao, setMostrarRecusaRevisao] = React.useState(false);
  const [motivoRecusaRevisao, setMotivoRecusaRevisao] = React.useState('');

  const decidirRevisao = async (aceita, motivo) => {
    if (!recordId) return;
    setDecidindoRevisao(true);
    try {
      const updated = await window.PropostaStore.decidirRevisao(recordId, aceita, motivo);
      setMeta((m) => ({ ...(m || {}), ...updated }));
      setMostrarRecusaRevisao(false);
      setMotivoRecusaRevisao('');
      window.toast(aceita ? 'Revisão aceita — edite e reenvie a proposta.' : 'Revisão recusada internamente.', 'success');
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setDecidindoRevisao(false);
    }
  };

  /* Trava por aprovação: proposta 'aprovada' sem destravada_em bloqueia
     Salvar/Enviar/Publicar (mesma checagem que o store faz de novo antes
     de gravar). podeDestravar só é resolvido se a proposta estiver
     travada — não faz sentido consultar alçada em proposta nova. */
  const [podeDestravar, setPodeDestravar] = React.useState(false);
  const [destravando, setDestravando] = React.useState(false);
  const travada = meta?.status === 'aprovada' && !meta?.destravada_em;
  React.useEffect(() => {
    if (!travada) { setPodeDestravar(false); return; }
    let cancelado = false;
    window.PropostaStore.temCapacidade('propostas', 'destravar_aprovada').then((v) => { if (!cancelado) setPodeDestravar(v); });
    return () => { cancelado = true; };
  }, [travada]);
  const destravarAgora = async () => {
    if (!recordId) return;
    setDestravando(true);
    try {
      const r = await window.PropostaStore.destravar(recordId);
      setMeta((m) => ({ ...(m || {}), destravada_em: r.destravada_em, destravada_por: r.destravada_por }));
      window.toast?.('Proposta destravada — fica editável até o próximo Salvar.', 'success');
    } catch (e) {
      window.toast?.('Erro ao destravar: ' + (e.message || e), 'error');
    } finally {
      setDestravando(false);
    }
  };
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
  // NÃO de um login separado — proposta-store.js persiste com a anon key +
  // identidade do SSO, mapeando pras colunas reais da tabela `propostas`.
  // Retorna { id, token } da linha salva (ou { erro } em falha) — precisamos
  // do id/token pra abrir o modal de envio por assinatura digital.
  // Montar a linha (payload, resolver vendedor_id, decidir insert-vs-update)
  // é responsabilidade do store (PropostaStore.salvar) — revisão de
  // arquitetura 18/08, candidato 2: isso morava aqui na UI antes.
  const saveToSupabase = React.useCallback(async () => {
    const row = await window.PropostaStore.salvar({ data, eq, editId, valorTotal: calcularValorTotal(data, eq) });
    if (row?.id) setRecordId(row.id);
    return row;
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
        if (salvo.precificacaoOrfa) {
          window.toast?.('⚠ O vínculo com a Precificação original não existe mais — proposta salva sem ele (nada foi perdido nos dados).', 'warning');
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
    const numeroCotacao = window.MasterIdEngine?.parseNumeroCotacao?.(data.numeroCotacao) ?? null;
    if (window.DecisoesStore && numeroCotacao != null) {
      const gate = await window.DecisoesStore.podeEnviarProposta(numeroCotacao);
      if (!gate.ok) { window.toast?.(gate.motivo, 'warning'); return; }
    }
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
      .select('proposal_type, data_json, status, numero_documento, master_id, valor_total, token, titulo, atualizado_em, publicado_em, publicado_por, version, revisao_texto, revisao_solicitada_em, destravada_em, destravada_por, revisao_decisao, revisao_decidida_em, revisao_decidida_por, motivo_recusa_interna')
      .eq('id', editId).maybeSingle()
      .then(({ data: row }) => {
        if (cancelado || !row) return;
        const dj = row.data_json || {};
        /* Proposta antiga: além de converter pro formato do editor, guardamos
           o data_json original em __legadoOriginal. Sem isso, salvar apagava
           de vez tudo que só existia no formato antigo (termos, recursos,
           blocos de escada/esteira, textos jurídicos). */
        const ehLegado = window.PropostaLegado.ehPropostaSchemaLegado(dj);
        const convertido = ehLegado ? window.PropostaLegado.converterPropostaLegado(dj, row.titulo) : null;
        const carregado = ehLegado
          ? { ...deepMergeProposta(makeDefaultProposta(), convertido), __legadoOriginal: dj }
          : (row.data_json || makeDefaultProposta());
        setData(carregado);
        /* eq deduzido do conteúdo, não de proposal_type: o campo está NULO
           em 290 das 311 propostas (todas as importadas), e o antigo
           `proposal_type || 'elevador'` fazia 16 propostas de Escada e 23 de
           Esteira abrirem com o layout de Elevador (achado 21/08).
           Passa `convertido` (não `carregado`): o merge com o default
           preenche .elevador mesmo numa proposta de escada, o que
           enganaria a detecção. */
        setEq(window.PropostaStore.resolverEq(row, convertido));
        setMeta({
          status: row.status, numero_documento: row.numero_documento,
          master_id: row.master_id, valor_total: row.valor_total,
          token: row.token, atualizado_em: row.atualizado_em,
          publicado_em: row.publicado_em, publicado_por: row.publicado_por, version: row.version,
          revisao_texto: row.revisao_texto, revisao_solicitada_em: row.revisao_solicitada_em,
          destravada_em: row.destravada_em, destravada_por: row.destravada_por,
          revisao_decisao: row.revisao_decisao, revisao_decidida_em: row.revisao_decidida_em,
          revisao_decidida_por: row.revisao_decidida_por, motivo_recusa_interna: row.motivo_recusa_interna,
        });
      })
      .finally(() => { if (!cancelado) setLoadingExisting(false); });
    return () => { cancelado = true; };
  }, [editId]);

  /* Re-sincroniza o status quando a aba volta ao foco. O aceite acontece na
     página pública /assinar (outra aba/janela); sem isto, ao voltar pro editor
     o badge continuava "Rascunho" mesmo com a proposta já assinada no banco
     (achado E2E). Atualiza só os campos de meta — nunca o conteúdo em edição. */
  React.useEffect(() => {
    if (!editId) return;
    const refetch = () => {
      if (document.visibilityState !== 'visible' || !window.__VP_SB?.sb) return;
      window.__VP_SB.sb.from('propostas')
        .select('status, publicado_em, publicado_por, version, valor_total, atualizado_em, revisao_texto, revisao_solicitada_em, destravada_em, destravada_por, revisao_decisao, revisao_decidida_em, revisao_decidida_por, motivo_recusa_interna')
        .eq('id', editId).maybeSingle()
        .then(({ data: row }) => {
          if (!row) return;
          setMeta((m) => ({
            ...(m || {}),
            status: row.status, publicado_em: row.publicado_em, publicado_por: row.publicado_por,
            version: row.version, valor_total: row.valor_total, atualizado_em: row.atualizado_em,
            revisao_texto: row.revisao_texto, revisao_solicitada_em: row.revisao_solicitada_em,
            destravada_em: row.destravada_em, destravada_por: row.destravada_por,
            revisao_decisao: row.revisao_decisao, revisao_decidida_em: row.revisao_decidida_em,
            revisao_decidida_por: row.revisao_decidida_por, motivo_recusa_interna: row.motivo_recusa_interna,
          }));
        });
    };
    document.addEventListener('visibilitychange', refetch);
    return () => document.removeEventListener('visibilitychange', refetch);
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

  /* Auto-herda uma vez ao abrir — pedido do usuário 19/08: "conforme os
     inputs forem acontecendo a proposta vai se auto preenchendo". Uma
     Proposta nascida direto do Formulário (sem preço ainda) só ganha o
     valor quando alguém digita na mão OU quando reabre esta tela depois
     que uma Precificação foi calculada em algum outro lugar — o herdar()
     acima já só completa campo vazio, nunca sobrescreve, então repetir
     aqui é seguro. Só roda depois que o carregamento (se for edição)
     termina, e só uma vez por sessão de tela. */
  const autoHerdadoRef = React.useRef(false);
  React.useEffect(() => {
    if (autoHerdadoRef.current || loadingExisting || !data.numeroCotacao) return;
    autoHerdadoRef.current = true;
    herdar();
  }, [loadingExisting, data.numeroCotacao, herdar]);

  /* ---- Salvar PDF / Imprimir ----
     Era html2canvas + jsPDF: capturava cada seção como FOTO e colava no
     PDF. Resultado: arquivo gigante (6,7MB pra 16 páginas), texto não
     selecionável/pesquisável, e distorção vertical em qualquer seção mais
     longa que 297mm (`.pe__pdf` usa min-height de propósito, pra não
     cortar conteúdo). O usuário descreveu certo: "age como um GoFullPage,
     desce tirando fotos" — não era isso que se queria (19/08).
     Agora usa a impressão nativa do navegador: PDF vetorial de verdade,
     texto real, sem distorção, arquivo leve. O usuário escolhe "Salvar
     como PDF" no destino da caixa de impressão. */
  const imprimirOverlay = React.useCallback(async () => {
    let inj = document.getElementById('__pe-print-page');
    if (inj) inj.remove();
    inj = document.createElement('style');
    inj.id = '__pe-print-page';
    /* @page precisa vir do runtime: ficha-tecnica.css também declara um
       @page global e a última declaração vence — injetar aqui garante que
       a Proposta imprima com a régua dela. margin 0 porque .pe__pdf já
       tem a margem interna própria (padding do .pe__pdf-inner). */
    inj.textContent = '@page { size: A4; margin: 0; }';
    document.head.appendChild(inj);
    /* Fotos do equipamento só terminam de carregar depois do primeiro
       paint — imprimir antes disso saía com espaço em branco no lugar. */
    const overlayEl = document.querySelector('.pe-pdf-overlay');
    const imgs = overlayEl ? overlayEl.querySelectorAll('img') : [];
    await Promise.all(Array.from(imgs).map((img) => img.complete
      ? Promise.resolve()
      : new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 5000); })));

    /* O Chrome usa document.title como nome do arquivo E como Título do
       PDF. Sem isto o cliente recebia "Editor de Proposta · VP Gestão.pdf"
       — nome de tela interna do sistema (achado 20/08). */
    const tituloOriginal = document.title;
    const cliente = (data.cliente?.nome || '').trim();
    document.title = ['Proposta', data.numero, cliente].filter(Boolean).join(' - ') || 'Proposta VerticalParts';
    const restaurar = () => { document.title = tituloOriginal; window.removeEventListener('afterprint', restaurar); };
    window.addEventListener('afterprint', restaurar);
    setTimeout(restaurar, 60000); // rede de segurança se afterprint não disparar

    setTimeout(() => window.print(), 80);
  }, [data]);

  /* ---- Baixar PDF (react-pdf) — Fase 2 da migração (plano aprovado 20/08) ----
     Só Elevador por enquanto: é o fluxo de referência (17 páginas), o
     mesmo que sofreu 3 rodadas de bug de paginação na impressão nativa
     (grid, aspect-ratio, conteúdo maior que a página — todos achados
     reais, cross-browser). react-pdf pagina sozinho, de forma
     determinística, sem depender do motor de impressão de nenhum
     navegador — a mesma abordagem já provada no RFQ (Fase 1). Escada/
     Esteira continuam no fluxo antigo (impressão nativa) por enquanto. */
  const [baixandoPdf, setBaixandoPdf] = React.useState(false);
  const baixarPdfReactPdf = React.useCallback(async () => {
    if (!window.PropostaReactPdf) { window.toast?.('Motor de PDF ainda carregando — tente de novo em instantes.', 'warning'); return; }
    setBaixandoPdf(true);
    try {
      const cliente = (data.cliente?.nome || '').trim();
      const filename = (['Proposta', data.numero, cliente].filter(Boolean).join(' - ') || 'Proposta VerticalParts') + '.pdf';
      const r = await window.PropostaReactPdf.baixar(data, filename);
      /* Sem este aviso, uma falha de carregamento de imagem produzia um
         PDF completo mas SEM logo nem foto de capa, e ninguém ficava
         sabendo até abrir o arquivo (achado 20/08). */
      if (r && r.falhasDeImagem && r.falhasDeImagem.length) {
        window.toast?.('⚠ PDF gerado, mas sem imagens: ' + r.falhasDeImagem.join('; '), 'warning');
      }
    } catch (e) {
      window.toast?.('❌ Erro ao gerar PDF: ' + (e.message || String(e)), 'error');
    } finally {
      setBaixandoPdf(false);
    }
  }, [data]);

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
              {(() => { const sv = statusVisual(meta); return (
                <span className={"pe-top__status is-" + sv.cls}>{sv.label}</span>
              ); })()}
              {meta?.publicado_em ? (
                <span className="pe-top__publicado" title="Versão que o cliente lê e assina — editar depois não muda o que já foi publicado">
                  <Icon.check size={11}/> Publicado {window.PropostaStore ? window.PropostaStore.fmtDateTime(meta.publicado_em) : ""} · v{meta.version || 1}
                </span>
              ) : null}
              {travada && (
                <span className="pe-top__publicado" title="Cliente já aprovou. Peça destrave a quem tem essa alçada pra editar de novo.">
                  <Icon.warning size={11}/> Travada
                </span>
              )}
              {meta?.destravada_em && meta?.status === 'aprovada' && (
                <span className="pe-top__publicado" title={"Destravada por " + (meta.destravada_por || '—')}>
                  <Icon.check size={11}/> Destravada — edite e salve
                </span>
              )}
            </div>
          </div>

          <div className="pe-top__actions">
            {travada && podeDestravar && (
              <Button variant="outline" size="sm" icon="warning" disabled={destravando} onClick={destravarAgora}>
                {destravando ? "Destravando…" : "Destravar"}
              </Button>
            )}
            <button className="pe-top__ghost pe-top__ghost--preview" onClick={() => setShowPreview((v) => !v)}
              title={showPreview ? "Ocultar pré-visualização" : "Mostrar pré-visualização"}>
              <Icon.eye size={14}/> {showPreview ? "Ocultar preview" : "Ver preview"}
            </button>
            <button className="pe-top__ghost" onClick={resetProposal} title="Descartar e recomeçar">
              <Icon.copy size={14}/> Reiniciar
            </button>
            <Button variant="outline" size="sm" icon="upload" disabled={publicando || travada}
              title={travada ? "Proposta travada — peça destrave" : "Congela esta versão como a oficial — é o que o cliente vai ler e assinar"}
              onClick={publicar}>
              {publicando ? "Publicando…" : (meta?.publicado_em ? "Republicar" : "Publicar")}
            </Button>
            <Button variant="outline" size="sm" icon="download" onClick={() => setPdfOverlay(true)}>Gerar PDF</Button>
            <Button variant="secondary" size="sm" icon="check" disabled={travada}
              title={travada ? "Proposta travada — peça destrave" : undefined}
              onClick={async () => {
              window.toast("Salvando proposta...", "info");
              const salvo = await saveToSupabase();
              setSavedAt(Date.now());
              if (salvo && !salvo.erro) {
                window.toast("✓ Proposta salva no sistema", "success");
                if (salvo.precificacaoOrfa) {
                  window.toast('⚠ O vínculo com a Precificação original não existe mais — proposta salva sem ele (nada foi perdido nos dados).', 'warning');
                }
                if (meta?.destravada_em) setMeta((m) => ({ ...(m || {}), destravada_em: null, destravada_por: null }));
              }
              else window.toast("❌ Não salvou: " + ((salvo && salvo.erro) || 'erro desconhecido'), "error");
            }}>Salvar</Button>
            <Button variant="primary" size="sm" icon="send" disabled={travada}
              title={travada ? "Proposta travada — peça destrave" : undefined}
              onClick={abrirEnvio}>Enviar p/ Cliente</Button>
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

      {/* Cliente pediu revisão na página pública (/assinar) — mostra o texto
         livre que ele digitou pra quem for renegociar não precisar caçar em
         log/notificação. Some sozinho quando o vendedor reenvia (markSent
         recoloca em 'enviada', tirando a proposta desse estado). */}
      {meta?.status === 'revisao_solicitada' && !meta.revisao_decisao && (
        <div className="alert info" style={{ margin: '16px 24px 0', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
            <Icon.warning/>
            <div style={{ flex: 1 }}>
              <div className="alert__title">Cliente pediu revisão desta proposta</div>
              <div className="alert__sub">"{meta.revisao_texto}"{meta.revisao_solicitada_em ? ` — ${window.PropostaStore ? window.PropostaStore.fmtDateTime(meta.revisao_solicitada_em) : ''}` : ''}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
            Decisão da VerticalParts: aceitar (edite e reenvie normalmente) ou recusar internamente (a proposta original segue valendo, sem alteração).
          </div>
          {!mostrarRecusaRevisao ? (
            <div className="row gap-2">
              <Button variant="primary" size="sm" disabled={decidindoRevisao} onClick={() => decidirRevisao(true, null)}>Aceitar revisão</Button>
              <Button variant="outline" size="sm" disabled={decidindoRevisao} onClick={() => setMostrarRecusaRevisao(true)}>Recusar internamente</Button>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <textarea className="input" rows={2} value={motivoRecusaRevisao} onChange={(e) => setMotivoRecusaRevisao(e.target.value)}
                placeholder="Motivo da recusa (ex.: fora de norma, margem insuficiente, prazo inviável…)" autoFocus/>
              <div className="row gap-2">
                <Button variant="danger" size="sm" disabled={decidindoRevisao} onClick={() => decidirRevisao(false, motivoRecusaRevisao)}>Confirmar recusa</Button>
                <Button variant="ghost" size="sm" onClick={() => { setMostrarRecusaRevisao(false); setMotivoRecusaRevisao(''); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {meta?.status === 'revisao_solicitada' && meta.revisao_decisao === 'aceita' && (
        <div className="alert info" style={{ margin: '16px 24px 0' }}>
          <Icon.check/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">Revisão aceita — edite e reenvie a proposta</div>
            <div className="alert__sub">"{meta.revisao_texto}"</div>
          </div>
        </div>
      )}

      {meta?.status === 'revisao_solicitada' && meta.revisao_decisao === 'recusada_interna' && (
        <div className="alert" style={{ margin: '16px 24px 0' }}>
          <Icon.info/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">Revisão recusada internamente — proposta original segue valendo</div>
            <div className="alert__sub">
              Pedido do cliente: "{meta.revisao_texto}" — Motivo da recusa: "{meta.motivo_recusa_interna}"
              {meta.revisao_decidida_por ? ` · por ${meta.revisao_decidida_por}` : ''}
            </div>
          </div>
        </div>
      )}

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
              {/* Elevador: SÓ "Baixar PDF" (react-pdf). O botão de imprimir
                  foi removido de propósito — era ele que produzia a página
                  em branco que o usuário reportou repetidamente, e manter
                  os dois caminhos só mantinha o defeito vivo. Escada/Esteira
                  ainda não foram migradas, então lá a impressão continua. */}
              {eq === 'elevador' ? (
                <Button variant="primary" size="sm" icon="download" onClick={baixarPdfReactPdf} disabled={baixandoPdf}
                  title="Gera e baixa o PDF direto — sem diálogo de impressão">
                  {baixandoPdf ? 'Gerando…' : 'Baixar PDF'}
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon="print" onClick={imprimirOverlay}
                  title="Abre a impressão do navegador — escolha 'Salvar como PDF' para baixar o arquivo">
                  Salvar PDF / Imprimir
                </Button>
              )}
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

    case "beneficiosDiferenciais": return <S_BeneficiosDiferenciais d={data} set={set}/>;
    case "caracteristicas": return <S_CaracteristicasEquip d={data} set={set}/>;
    case "recursos": return <S_RecursosNomeados d={data} set={set}/>;
    case "infra": return <S_InfraestruturaNomeada d={data} set={set}/>;
    case "fotos": return <S_FotosEquipamento d={data} set={set}/>;

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
