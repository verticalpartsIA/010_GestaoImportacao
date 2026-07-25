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
    vendedor: { nome: "", celular: "", fixo: "", email: "" },
    cliente: { nome: "", cnpj: "", responsavel: "",
      endereco: "", numero: "", bairro: "", cidade: "", uf: "", cep: "",
      email: "", telefone: "" },
    obra: { nome: "", endereco: "", numero: "",
      bairro: "", cidade: "", uf: "", cep: "" },

    elevador: {
      textoProposta: "Prezado(a) cliente,\n\nÉ com satisfação que apresentamos nossa proposta comercial para o fornecimento de elevador VPELEV VP-P, com tecnologia gearless e atendimento à NBR 16858.",
      textoModelos: "A linha VPEL-MRL-PASSAGEIROS oferece elevadores de passageiros com cabines em aço inox 304, painel de operação TFT colorido e portas automáticas com abertura central.",
      descricao: [{ titulo: "Elevador de Passageiros VPELEV VP-P", linha: "VPEL-MRL-PASSAGEIROS", tipo: "SEM CASA DE MÁQUINAS", norma: "16858-1/2", piso: "Mármore Resinado" }],
      especificacoes: [{
        id: "Elevador 1",
        modelo: "SMR - Machine Room Less",
        empreendimento: "Residencial",
        carac: "Passageiros",
        denominacao: "(-1, 0, 1 à 16)",
        percurso: "51000",
        capacidade: "06 Passageiros x 450Kg",
        dimensoesCaixa: "1600 x 1840mm",
        profPoço: "1500",
        vel: "1",
        andaresParadasPortas: "18 Paradas (-1, 0, 1 a 16)",
        qtd: 1,
      }],
      acabamentos: {
        modeloCabine: "VP-228", acabamentoMat: "Aço Inox - 304", subTeto: "SUB-004",
        painelOperacao: "COP-017TFT", pisoCabina: "Mármore Resinado", medidasPiso: "1600 x 1500mm",
        modeloPorta: "Automática Central", dimPortaCabine: "800x2100mm",
        acabPortaCabine: "Inox", portasPavimento: "Inox", botoeirasPavimento: "LOP - 35",
        sinalizacao: "Display TFT 4.3'' colorido", pavInox: "0 inox e demais Pintura",
        demais: "Corrimão tubular inox · espelho 3/4 traseiro · ventilação cabine 80 m³/h",
      },
      caracteristicas: ["Sistema de tração gearless de alta eficiência energética", "Comando microprocessado MAX-3000 com prioridade de chamadas inteligente"],
      recursos: ["Resgate automático em falta de energia (ARD)", "Comunicação bidirecional integrada à central 24h"],
      infraestrutura: ["Casa de máquinas dimensionada conforme NBR 16858", "Aterramento próprio para o quadro de comando"],
      valores: { equipamento: "Elevador de Passageiros VPELEV VP-P", quantidade: "1", valorUnit: "", difal: "",
        forma: "40% à vista e 4 parcelas",
        parcelas: [
          { desc: "Sinal de 40% na assinatura do contrato", valor: "" },
          { desc: "1ª PARCELA", valor: "" },
          { desc: "2ª PARCELA", valor: "" },
          { desc: "3ª PARCELA", valor: "" },
          { desc: "4ª PARCELA", valor: "" },
        ]},
      condicoesPagto: { venda: "", impostos: "", ajusteFrete: "", reajuste: "" },
      ajustes: { preset: "sp", cambio: "5,50", faturamento: "", reajuste: "Reajuste anual conforme IPCA acumulado.",
        taxasIn: "II, IPI, PIS/COFINS sobre importação. ICMS interestadual.",
        taxasOut: "ICMS final destino (DIFAL conforme localização da obra). Taxa CREA/CAU." },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "Os prazos poderão ser revisados em caso de eventos extraordinários relacionados a pandemia, escassez global de semicondutores ou bloqueios portuários." },
      responsabilidades: { tipoServico: "", itemMontagem: "Içamento + posicionamento + comissionamento" },
      garantia: { garantia: "24 (vinte e quatro) meses contra defeitos de fabricação + 12 meses de serviço técnico preventivo.",
        condicoes: "Esta proposta é válida por 30 dias a contar da emissão. Quaisquer alterações no escopo deverão ser formalizadas por aditivo contratual. As partes elegem o foro da Comarca de São Paulo." },
    },

    escada: {
      textoProposta: "", textoModelos: "",
      descricao: [{ titulo: "Escada Rolante - OAK", desc: "", beneficios: "" }],
      especificacoes: [{
        id: "Escada 1",
        empreendimento: "Comercial",
        carac: "Comercial",
        desnivel: "4500",
        incl: "30º",
        largDegrau: "1000mm",
        balaustrada: "1000mm",
        vel: "0.5 m/s",
        alimentacao: "380V Trifásico",
        arranjo: "Paralelo",
        maquina: "Superior",
        qtd: 1, valorUnit: ""
      }],
      especificidades: { tipo: "", config: "", corrimao: "", acabamento: "" },
      valores: { equipamento: "Escada Rolante - OAK", quantidade: "", valorUnit: "", difal: "", forma: "", parcelas: [] },
      ajustes: { preset: "sp", cambio: "5,50", freteMaritimo: "3.500,00", reajuste: "", taxasIn: "", taxasOut: "" },
      prazo: { prazo: "prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias", condCovid: "" },
      instalacao: { instalacao: "", lubrificacao: "", transporte: "", descarregamento: "" },
      garantia: { garantia: "", condicoes: "" },
    },

    esteira: {
      textoProposta: "", textoModelos: "",
      descricao: [{ titulo: "Esteira Rolante SEQUOIA -12°", desc: "", beneficios: "" }],
      especificacoes: [{
        id: "Esteira 1",
        empreendimento: "Supermercado",
        carac: "Alto Tráfego",
        desnivelComp: "4500",
        incl: "12º",
        largPallet: "1000mm",
        balaustrada: "1000mm",
        vel: "0.5 m/s",
        alimentacao: "Trifásico 380V",
        arranjo: "Paralelo",
        maquina: "Superior",
        qtd: 1, valorUnit: ""
      }],
      especificidades: { tipo: "", config: "", corrimao: "", acabamento: "" },
      valores: { equipamento: "Esteira Rolante SEQUOIA -12°", quantidade: "", valorUnit: "", difal: "", forma: "", parcelas: [] },
      ajustes: { preset: "sp", cambio: "5,50", freteMaritimo: "3.500,00", fretePorContainer: "", ajusteFrete: "", reajuste: "", taxasIn: "", taxasOut: "" },
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
function converterPropostaLegado(dj) {
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
      nome: cli.name || '', cnpj: cli.cnpj || '', responsavel: cli.contactPerson || '',
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
  const LS_KEY = "vpprd.proposta-draft";
  const prefill = subsel && subsel.__prefillFromPrecificacao ? subsel : null;
  const editId = subsel && subsel.__editId ? subsel.__editId : null;
  const [loadingExisting, setLoadingExisting] = React.useState(!!editId);
  const [eq, setEq] = React.useState(() => {
    if (prefill) return 'elevador';
    try { return localStorage.getItem("vpprd.proposta-eq") || "elevador"; } catch (e) { return "elevador"; }
  });
  const [data, setData] = React.useState(() => {
    if (prefill) return deepMergeProposta(makeDefaultProposta(), prefill);
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
  const formRef = React.useRef(null);

  // Save to Supabase
  // SSO / portas abertas: a identidade vem do vpsistema (window.__VP_USER),
  // NÃO de um login separado. Antes exigia sb.auth.getUser() (sessão Supabase
  // Auth), que nunca existe neste modelo — por isso a proposta nunca salvava.
  // Aqui persiste com a anon key + identidade do SSO, mapeando para as colunas
  // REAIS da tabela `propostas` (sem alterar o schema do banco).
  // Retorna { id, token } da linha salva (ou null em falha) — precisamos do
  // id/token pra abrir o modal de envio por assinatura digital.
  const saveToSupabase = React.useCallback(async () => {
    if (!window.__VP_SB?.sb) return null;
    // Evita poluir a tabela real com rascunhos em branco: só persiste com cliente.
    if (!data?.cliente?.nome?.trim()) return null;

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
        atualizado_em: new Date().toISOString(),
      };

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
        return row;
      } else {
        const { data: row, error } = await window.__VP_SB.sb
          .from('propostas').insert([{ ...payload, status: 'rascunho' }]).select('id, token').single();
        if (error) throw error;
        return row;
      }
    } catch (e) {
      console.error('Supabase save failed:', e);
      return null;
    }
  }, [data, eq, editId]);

  // Salva e abre o modal de envio por assinatura digital — gera o link
  // público (/assinar/:token) igual ao Contrato Instalador/Venda, em vez de
  // só marcar status='enviada' sem nunca produzir nenhum link real.
  const abrirEnvio = React.useCallback(async () => {
    if (!window.PropostaStore) { window.toast?.('Store de assinatura não carregado.', 'error'); return; }
    window.toast?.('Salvando proposta...', 'info');
    const saved = await saveToSupabase();
    if (!saved) { window.toast?.('❌ Não foi possível salvar a proposta. Confira se o cliente está preenchido.', 'error'); return; }
    const token = saved.token || await window.PropostaStore.garantirToken(saved.id);
    setSendModal({ id: saved.id, token, numero_documento: data.numero, cliente: data.cliente, valorTotal: Number(data.elevador?.valores?.valorUnit) * Number(data.elevador?.valores?.quantidade || 1) });
  }, [data, saveToSupabase]);

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
    window.__VP_SB.sb.from('propostas').select('proposal_type, data_json').eq('id', editId).maybeSingle()
      .then(({ data: row }) => {
        if (cancelado || !row) return;
        const dj = row.data_json || {};
        const carregado = ehPropostaSchemaLegado(dj)
          ? deepMergeProposta(makeDefaultProposta(), converterPropostaLegado(dj))
          : (row.data_json || makeDefaultProposta());
        setData(carregado);
        setEq(row.proposal_type || 'elevador');
      })
      .finally(() => { if (!cancelado) setLoadingExisting(false); });
    return () => { cancelado = true; };
  }, [editId]);

  const set = React.useCallback((path, value) => {
    setData((d) => setDeep(d, path, value));
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
    <div className="page fade-in" style={{ padding: 0, maxWidth: "none" }}>
      {/* Header bar */}
      <div style={{ padding: "20px 32px 16px", background: "#fff", borderBottom: "1px solid var(--border)" }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("propostas")}>Voltar para Propostas</Button>
          <div className="spacer" style={{ flex: 1 }}/>
          <div className="row gap-3" style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg3)" }}>
            <span>Última edição: agora</span>
            <span style={{ color: "var(--vp-success)" }}>● Salvamento automático ativo</span>
          </div>
        </div>
        <div className="row sb">
          <div>
            <div className="page-head__eyebrow" style={{ marginBottom: 4 }}>
              <span className="vp-rule"/>
              Editor de Proposta
            </div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, textTransform: "uppercase" }}>
              {data.numero || "Nova Proposta"}
              <span style={{ marginLeft: 12, fontSize: 14, color: "var(--fg3)", textTransform: "none", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {data.cliente.nome || "Sem cliente"} · {data.obra.nome || "Sem obra"}
              </span>
            </h1>
            {data.masterId && (
              <div className="mono small muted" style={{ marginTop: 4 }}>Master ID {data.masterId}</div>
            )}
          </div>
          <div className="row gap-2">
            <Button variant="ghost" size="sm" icon="copy" onClick={resetProposal}>Reiniciar</Button>
            <Button variant="outline" size="sm" icon="eye" onClick={() => window.print()}>Visualizar</Button>
            <Button variant="outline" size="sm" icon="download" onClick={() => { window.toast("Abrindo diálogo de impressão / salvar PDF…", "info"); setTimeout(() => window.print(), 200); }}>Gerar PDF</Button>
            <Button variant="primary" size="sm" icon="send" onClick={abrirEnvio}>Enviar p/ Cliente</Button>
          </div>
        </div>

        {/* Equipment tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 14, marginBottom: -16 }}>
          {[
            { id: "elevador", label: "Elevador", icon: "building", sub: "PASSAGEIROS · CARGA" },
            { id: "escada", label: "Escada Rolante", icon: "layers", sub: "30° · 35°" },
            { id: "esteira", label: "Esteira Rolante", icon: "package", sub: "MALL · AIRPORT" },
          ].map(t => (
            <button key={t.id} className={"pe__tab " + (eq === t.id ? "is-active" : "")} onClick={() => setEq(t.id)}>
              {React.createElement(Icon[t.icon] || Icon.bolt, { size: 18 })}
              <span>{t.label}</span>
              <span className="pe__tab-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="pe">
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
                  {renderSection(s.id, eq, data, set)}
                </PESection>
              );
            })}

            <div className="pe__actionbar">
              <span className="pe__autosave"><span className="dot"/> Salvo automaticamente · {Math.max(0, Math.floor((Date.now() - savedAt) / 1000))}s atrás</span>
              <div className="spacer" style={{ flex: 1 }}/>
              <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute("propostas")}>Voltar</Button>
              <Button variant="outline" size="sm" icon="download" onClick={() => { window.toast("Abrindo diálogo salvar PDF…", "info"); setTimeout(() => window.print(), 200); }}>Gerar PDF</Button>
              <Button variant="outline" size="sm" icon="eye" onClick={() => window.print()}>Visualizar</Button>
              <Button variant="secondary" size="sm" icon="copy" onClick={async () => {
                window.toast("Salvando proposta...", "info");
                const saved = await saveToSupabase();
                if (saved) {
                  window.toast("✓ Proposta salva com sucesso em Supabase", "success");
                } else {
                  window.toast("⚠️ Proposta salva localmente (Supabase indisponível)", "warning");
                }
              }}>Salvar rascunho</Button>
              <Button variant="primary" size="sm" icon="send" onClick={abrirEnvio}>Enviar p/ Cliente</Button>
            </div>
          </div>
        </div>

        {/* Live PDF preview */}
        <PEPreview data={data} eq={eq}/>
      </div>

      {sendModal && (
        <PropostaSendModal record={sendModal} onClose={() => setSendModal(null)}
          onSent={() => window.toast?.('✓ Proposta enviada — o cliente já pode ler e assinar pelo link.', 'success')}/>
      )}
    </div>
  );
}

function renderSection(sid, eq, data, set) {
  switch (sid) {
    case "proposta": return <S_Proposta d={data} set={set}/>;
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
