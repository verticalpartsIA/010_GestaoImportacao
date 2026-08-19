/* ============================================================
   formulario-elevador.jsx — Formulário de Coleta de Dados: Elevadores
   Ver issue #66. Header (cliente/fiscal/logística) + N Unidades
   (uma por elevador). Usado tanto internamente (Canal 1 — assistido,
   rota "formulario-elevador") quanto na página pública standalone
   (Canal 2 — self-service, formulario-cliente.html) — mesmo componente,
   controlado pela prop `publicMode`.
   ============================================================ */

const FE_TIPOS = ['Passageiro', 'Carga', 'Hospitalar', 'Panorâmico', 'Home Lift'];
const FE_MAO_DE_OBRA = [
  { value: 'local', label: 'Mão de Obra Local' },
  { value: 'sao_paulo', label: 'Mão de Obra de São Paulo' },
  { value: 'sem_mao_de_obra', label: 'Sem Mão de Obra' },
];
const FE_RESPONSAVEL_ENTREGA = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'verticalparts', label: 'VerticalParts' },
];
const FE_ORIGEM_VENDA = [
  'Conquista Vendedor',
  'Indicação VerticalParts',
  'Indicação Escamax + Vendedor',
  'Indicação Terceiros',
];
const FE_NORMAS = ['Glarie Standard', 'China Standard', 'EN81-20/50', 'EN81-20/50/70', 'EN81-41'];

/* 15/08 — "camaleão": card de equipamento muda de campo conforme o tipo
   (reunião de vendedores — cotação pode ter elevador + escada + esteira
   juntos, cada um com seus próprios ativos VPEL-EL/VPER-ER/VPES-ES). Elevador
   continua usando as colunas reais de sempre (intocadas, zero risco pro que
   já funciona — RFQ, precificação etc. dependem delas). Escada/esteira usam
   `especificacoes` (jsonb) com os campos das planilhas técnicas que o
   usuário passou — texto livre com o valor típico como placeholder (as
   planilhas chamam de "opções típicas", não é uma lista fechada de verdade,
   então virar <select> obrigatório inventaria uma rigidez que a spec não
   tem). */
const FE_TIPOS_EQUIPAMENTO = [
  { value: 'elevador', label: 'Elevador' },
  { value: 'escada', label: 'Escada Rolante' },
  { value: 'esteira', label: 'Esteira Rolante' },
];

const FE_SECOES_ESCADA = [
  { titulo: 'Dados Gerais', campos: [
    ['tipo_edificacao', 'Tipo de edificação', 'Comercial, residencial, hospitalar, aeroporto, metrô, shopping, institucional'],
    ['uso_previsto', 'Uso previsto', 'Público (alto tráfego) / privado (médio/baixo tráfego)'],
    ['horario_pico', 'Horário de pico estimado', 'Passageiros/hora em cada sentido'],
  ] },
  { titulo: 'Dados Geométricos', campos: [
    ['desnivel_elevacao', 'Desnível (altura de elevação)', 'ex.: 5,04 m'],
    ['inclinacao', 'Inclinação', '27,3° / 30° / 35°'],
    ['largura_degrau', 'Largura do degrau', '600 / 800 / 1.000 mm'],
    ['velocidade_nominal', 'Velocidade nominal', '0,50 / 0,65 / 0,75 m/s'],
    ['comprimento_abertura_piso', 'Comprimento da abertura no piso', ''],
    ['largura_rasgo_laje', 'Largura do rasgo na laje', ''],
    ['profundidade_poco_inferior', 'Profundidade do poço inferior', ''],
    ['headroom', 'Última altura (headroom)', ''],
    ['sentido_circulacao', 'Sentido de circulação', 'Subida / descida / reversível'],
    ['degraus_planos_patamar', 'Nº de degraus planos no patamar', '2 ou 3'],
    ['disposicao_espaco', 'Disposição no espaço', 'Simples / paralelas / cruzadas'],
  ] },
  { titulo: 'Especificações Técnicas', campos: [
    ['tipo_acionamento', 'Tipo de acionamento', 'Motorredutor direto / VVVF'],
    ['sistema_economia_energia', 'Sistema de economia de energia', 'Stand-by com sensor de presença'],
    ['capacidade_transporte', 'Capacidade de transporte', '4.500 a 13.500 pessoas/hora'],
    ['tipo_degrau', 'Tipo de degrau', 'Aço inoxidável / liga de alumínio'],
    ['altura_degrau', 'Altura do degrau', '~200 mm, máx. 240 mm'],
    ['profundidade_degrau', 'Profundidade do degrau', '> 380 mm'],
    ['balaustrada', 'Balaustrada / guarda-corpo', '80cm ou 90cm — vidro/inox'],
    ['corrimao_equip', 'Corrimão', 'Borracha preta/colorida/LED'],
    ['protecao_lateral', 'Proteção lateral', 'Painéis de inox/vidro'],
    ['iluminacao', 'Iluminação', 'LED balaustrada/teto/patamares'],
    ['protecao_patamar', 'Proteção de patamar', 'Pente de alumínio/borracha'],
    ['sistema_seguranca', 'Sistema de segurança', 'Freio serviço+segurança, sensor objeto preso'],
    ['comunicacao', 'Comunicação', 'Intercomunicador/alarme/indicadores'],
  ] },
  { titulo: 'Condições Ambientais', campos: [
    ['local_instalacao', 'Local de instalação', 'Interior / exterior / ambiente controlado'],
    ['protecao_intemperies', 'Proteção contra intempéries', 'Cobertura / toldo / totalmente exposta'],
    ['temp_min', 'Temperatura ambiente mínima', '°C'],
    ['temp_max', 'Temperatura ambiente máxima', '°C'],
    ['umidade_relativa', 'Umidade relativa', '%'],
    ['poeira_salinidade_quimicos', 'Poeira, salinidade ou agentes químicos', 'Sim / Não'],
    ['acesso_icamento', 'Acesso para içamento da máquina', 'Guindaste / elevador de carga / escada / manual'],
    ['energia_obra', 'Disponibilidade de energia na obra', 'Provisória / definitiva / não há ainda'],
    ['poco_inferior', 'Poço inferior', 'Já existe / será construído'],
    ['caixa_corrida_rasgo', 'Caixa de corrida / rasgo no piso', 'Já executada / será executada'],
  ] },
  { titulo: 'Dados Elétricos', campos: [
    ['tensao_alimentacao_equip', 'Tensão de alimentação', '220V / 380V / 440V trifásica'],
    ['frequencia_equip', 'Frequência', '60 Hz (Brasil) / 50 Hz'],
    ['potencia_estimada', 'Potência estimada disponível', 'kVA'],
    ['aterramento_equip', 'Aterramento', 'Existe / será executado / tipo'],
    ['quadro_distribuicao_proximo', 'Quadro de distribuição próximo', 'Sim/Não — distância aproximada'],
    ['disjuntor_dedicado', 'Disjuntor dedicado', 'Sim/Não — capacidade em A'],
    ['gerador_emergencia', 'Gerador de emergência', 'Sim / Não'],
    ['alarme_incendio', 'Sistema de alarme de incêndio', 'Sim / Não'],
    ['monitoramento_remoto', 'Monitoramento remoto', 'Sim / Não'],
  ] },
  { titulo: 'Acabamentos', campos: [
    ['acabamento_degraus', 'Acabamento dos degraus', 'Inox escovado/polido/antiderrapante/colorido'],
    ['acabamento_laterais', 'Acabamento das laterais', 'Inox / pintura / vidro'],
    ['acabamento_patamares', 'Acabamento dos patamares', 'Inox / granito / porcelanato'],
    ['cor_corrimao', 'Cor do corrimão', 'Preto / cinza / personalizado'],
    ['iluminacao_decorativa', 'Iluminação decorativa', 'LED RGB fixo/programável/branco'],
    ['indicadores_pavimento', 'Indicadores de pavimento', 'Display LED / LCD / simples'],
    ['revestimento_teto', 'Revestimento do teto interno', 'Inox / pintura / outro'],
    ['protecao_impacto_lateral', 'Proteção de impacto nas laterais', 'Sim / Não'],
  ] },
];

const FE_SECOES_ESTEIRA = [
  { titulo: 'Dados Gerais', campos: FE_SECOES_ESCADA[0].campos },
  { titulo: 'Dados Geométricos', campos: [
    ['comprimento_total', 'Comprimento total (desnível horizontal)', 'até 80m comercial / 120m público / 140m especial'],
    ['desnivel_vertical', 'Desnível vertical (altura de elevação)', '2.500 a 8.000 mm'],
    ['inclinacao', 'Inclinação', '0°–6° padrão / 10°/11° sob demanda / 12° inclinada'],
    ['largura_palete', 'Largura do palete', '800/1.000mm comercial, até 1.400mm público'],
    ['velocidade_nominal', 'Velocidade nominal', '0,50 / 0,60 / 0,75 m/s'],
    ['comprimento_rasgo_piso', 'Comprimento do rasgo no piso', ''],
    ['largura_rasgo_laje', 'Largura do rasgo na laje', ''],
    ['profundidade_poco_inferior', 'Profundidade do poço inferior', ''],
    ['headroom', 'Última altura (headroom)', ''],
    ['sentido_circulacao', 'Sentido de circulação', 'Unidirecional / reversível'],
    ['paletes_planos_patamar', 'Nº de paletes planos no patamar', '2 ou 3'],
    ['disposicao_espaco', 'Disposição no espaço', 'Simples / paralelas / cruzadas / em série'],
    ['raio_curva', 'Raio de curva (se aplicável)', 'esteiras curvas, em metros'],
  ] },
  { titulo: 'Especificações Técnicas', campos: [
    ['tipo_acionamento', 'Tipo de acionamento', 'Motorredutor direto / VVVF / corrente'],
    ['sistema_economia_energia', 'Sistema de economia de energia', 'Stand-by, baixa velocidade em vazio'],
    ['capacidade_transporte', 'Capacidade de transporte', 'depende largura+velocidade — tabela do fabricante'],
    ['tipo_palete', 'Tipo de palete', 'Aço inox / liga alumínio / aço carbono tratado'],
    ['espessura_palete', 'Espessura do palete', 'mm — resistência à deformação'],
    ['balaustrada', 'Balaustrada / guarda-corpo', '80/90/100cm — vidro/inox'],
    ['corrimao_equip', 'Corrimão', 'Borracha preta/cinza/colorida/LED/antiderrapante'],
    ['protecao_lateral', 'Proteção lateral', 'Painéis inox/vidro/sólidos até o piso'],
    ['iluminacao', 'Iluminação', 'LED balaustrada/teto/patamares/piso'],
    ['protecao_patamar', 'Proteção de patamar (pente)', 'Alumínio / borracha / inox'],
    ['sistema_seguranca', 'Sistema de segurança', 'Freio+sensor+parada emergência+chave inspeção'],
    ['sistema_travamento', 'Sistema de travamento', 'Trava mecânica manutenção / automática emergência'],
    ['comunicacao', 'Comunicação', 'Intercomunicador/alarme/setas/display'],
    ['sistema_lubrificacao', 'Sistema de lubrificação', 'Centralizado automático / manual / autolubrificante'],
  ] },
  { titulo: 'Condições Ambientais', campos: [
    ...FE_SECOES_ESCADA[3].campos,
    ['exposicao_chuva', 'Exposição à chuva direta', 'Sim/Não — determina IP elevado'],
    ['piso_acabado_patamares', 'Piso acabado nos patamares', 'Granito/porcelanato/cerâmica/concreto'],
  ] },
  { titulo: 'Dados Elétricos', campos: [
    ...FE_SECOES_ESCADA[4].campos,
    ['controle_acesso', 'Sistema de controle de acesso', 'Sim/Não — integração com catracas/torniquetes'],
  ] },
  { titulo: 'Acabamentos', campos: [
    ['acabamento_paletes', 'Acabamento dos paletes', 'Inox escovado/polido/antiderrapante/colorido'],
    ['acabamento_laterais', 'Acabamento das laterais (frizos)', 'Inox / pintura / vidro'],
    ['acabamento_patamares', 'Acabamento dos patamares', 'Inox / granito / porcelanato / antiderrapante'],
    ['cor_corrimao', 'Cor do corrimão', 'Preto/cinza/azul/verde/personalizado'],
    ['iluminacao_decorativa', 'Iluminação decorativa', 'LED RGB fixo/programável/sem'],
    ['indicadores_direcao', 'Indicadores de direção', 'Display/LCD/setas/placas'],
    ['revestimento_teto', 'Revestimento do teto interno', 'Inox / pintura / painel'],
    ['protecao_impacto_lateral', 'Proteção de impacto nas laterais', 'Sim / Não'],
    ['sinalizacao_tatil', 'Sinalização tátil', 'Sim/Não — NBR 9050'],
    ['contraste_visual', 'Contraste visual', 'Sim/Não — deficientes visuais'],
    ['anuncio_publicitario', 'Anúncio publicitário / branding', 'Sim / Não'],
  ] },
];

const FE_SECOES_POR_TIPO = { escada: FE_SECOES_ESCADA, esteira: FE_SECOES_ESTEIRA };

/* Campos das planilhas técnicas do usuário (escada/esteira) — texto livre,
   sem select/obrigatoriedade: são "opções típicas", não lista fechada. */
function FEEspecificacoesGenericas({ tipoEquipamento, especificacoes, onChange }) {
  const secoes = FE_SECOES_POR_TIPO[tipoEquipamento] || [];
  const set = (chave) => (v) => onChange({ ...(especificacoes || {}), [chave]: v });
  return (
    <div className="stack" style={{ gap: 18 }}>
      {secoes.map((sec) => (
        <div key={sec.titulo}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>{sec.titulo}</div>
          <div className="grid-3" style={{ gap: 12 }}>
            {sec.campos.map(([chave, label, placeholder]) => (
              <FEField key={chave} label={label}>
                <FEInput value={(especificacoes || {})[chave]} onChange={set(chave)} placeholder={placeholder}/>
              </FEField>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Mapeia tipo_equipamento (chave curta usada no formulário) pra
   categoriaProduto (chave que o MasterIdEngine espera). */
const FE_CATEGORIA_MASTERID = { elevador: 'elevador', escada: 'escada_rolante', esteira: 'esteira_rolante' };

/* Código real do equipamento (VPEL-EL0917-1, VPER-ER0917-2...) — só existe
   depois que a cotação tem número (gerado no primeiro save) e a unidade tem
   indice_ativo (gerado pelo INSERT). Antes disso, null — a UI mostra
   "gerado ao salvar", igual ao badge de Nº da Cotação. */
function feCodigoUnidade(tipoEquip, numeroCotacao, indiceAtivo) {
  if (numeroCotacao == null || indiceAtivo == null) return null;
  const categoria = FE_CATEGORIA_MASTERID[tipoEquip] || 'elevador';
  return window.MasterIdEngine.masterId({ categoriaProduto: categoria, numeroCotacao, indiceAtivo });
}

function feNovaUnidade(identificador) {
  return {
    identificador: identificador || '', quantidade: 1,
    tipo_equipamento: 'elevador', especificacoes: {},
    fornecedor: '', modelo: '',
    tipo: '', capacidade_kg: '', capacidade_pessoas: '', velocidade_ms: '',
    paradas: '', pavimentos_desc: '', casa_maquinas: '', agrupamento: '', porta_oposta: '',
    estrutura_caixa: '', caixa_largura_mm: '', caixa_profundidade_mm: '',
    percurso_mm: '', overhead_mm: '', poco_mm: '',
    cabina_largura_mm: '', cabina_profundidade_mm: '', cabina_altura_mm: '', teto_falso: '', piso_cabina: '', corrimao: '',
    porta_tipo_abertura: '', porta_modelo: '', porta_largura_mm: '', porta_altura_mm: '',
    acabamento_porta_cabina: '', acabamento_porta_pavimento: '', classe_corta_fogo: '',
    tensao_principal: '', tensao_iluminacao: '', norma_projeto: '',
    botoeira_cabine: '', botoeira_pavimento: '',
    cop_lop_tipo: '', ard: false, camera: false, anuncio_voz: false, exigencias_especiais: '',
  };
}

/* ---------- Campos genéricos (mesmo padrão visual de ModalNovoLead) ---------- */
function FEField({ label, children, span }) {
  return (
    <div className="stack" style={{ gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label className="up-eyebrow muted">{label}</label>
      {children}
    </div>
  );
}
function FEInput({ value, onChange, placeholder, type = 'text', disabled, onBlur }) {
  return <input className="input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} disabled={disabled}/>;
}
function FESelect({ value, onChange, options, placeholder, disabled }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder || '— escolha —'}</option>
      {options.map((o) => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function FECheck({ label, checked, onChange }) {
  return (
    <label className="row gap-2" style={{ alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}/> {label}
    </label>
  );
}

/* Endereço estruturado (Logradouro/Complemento/Bairro/CEP/Cidade/UF) — usado
   tanto pro endereço do cliente (prefixo "endereco_") quanto da obra
   (prefixo "endereco_obra_"), mesmos nomes de coluna do banco. */
/* Nº da Cotação — mesma numeração continuada da planilha histórica (desde
   898). É a referência que o vendedor vai usar depois pra criar a Proposta,
   por isso precisa de destaque próprio, não só um texto solto no subtítulo. */
function FENumeroCotacaoBadge({ numeroCotacao }) {
  return (
    <div className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
      background: numeroCotacao != null ? '#111' : '#e5e5e5',
      color: numeroCotacao != null ? '#FBB039' : '#71717a', fontWeight: 700,
      padding: '6px 12px', borderRadius: 6, fontSize: 13, letterSpacing: '.02em',
    }}>
      Cotação Nº {numeroCotacao != null ? window.MasterIdEngine.baseId('elevador', numeroCotacao) : '— (gerado ao salvar)'}
    </div>
  );
}

function FEEndereco({ prefix, header, setH, requiredLogradouro, onBuscarCep }) {
  const k = (suf) => `${prefix}${suf}`;
  return (
    <div className="grid-3" style={{ gap: 12 }}>
      <FEField label={`Logradouro${requiredLogradouro ? ' *' : ''}`} span="2">
        <FEInput value={header[k('logradouro')]} onChange={setH(k('logradouro'))} placeholder="Rua São Paulo, 150"/>
      </FEField>
      <FEField label="Complemento">
        <FEInput value={header[k('complemento')]} onChange={setH(k('complemento'))} placeholder="Apto 22, Bloco B"/>
      </FEField>
      <FEField label="Bairro">
        <FEInput value={header[k('bairro')]} onChange={setH(k('bairro'))} placeholder="Jardim Paraíso"/>
      </FEField>
      <FEField label="CEP">
        <FEInput value={header[k('cep')]} onChange={setH(k('cep'))} placeholder="07140-000" onBlur={() => onBuscarCep?.(header[k('cep')])}/>
      </FEField>
      <FEField label="Cidade">
        <FEInput value={header[k('cidade')]} onChange={setH(k('cidade'))} placeholder="Guarulhos"/>
      </FEField>
      <FEField label="UF">
        <FEInput value={header[k('estado')]} onChange={setH(k('estado'))} placeholder="SP"/>
      </FEField>
    </div>
  );
}

/* ---------- Cliente por busca (15/08) ----------
   Vendedor busca o cliente já cadastrado em Cadastros (aba própria criada
   ontem) em vez de redigitar CNPJ/endereço/telefone aqui de novo — reduz
   redigitação e evita duas versões do mesmo cliente divergindo. Filtro
   client-side (listarTodos()) — volume ainda pequeno, sem necessidade de
   busca no servidor. */
function FEClientePicker({ clienteId, onSelecionar, onCriarNovo }) {
  const [busca, setBusca] = React.useState('');
  const [todos, setTodos] = React.useState(null);
  const [selecionado, setSelecionado] = React.useState(null);
  const [focado, setFocado] = React.useState(false);

  React.useEffect(() => {
    window.CadastrosClientesStore?.listarTodos().then(setTodos).catch(() => setTodos([]));
  }, []);

  React.useEffect(() => {
    if (!clienteId || !todos) { if (!clienteId) setSelecionado(null); return; }
    const c = todos.find((t) => t.id === clienteId);
    if (c) setSelecionado(c);
    else window.CadastrosClientesStore?.obter(clienteId).then(setSelecionado).catch(() => {});
  }, [clienteId, todos]);

  const termo = busca.trim().toLowerCase();
  const termoDigitos = termo.replace(/\D/g, '');
  /* termoDigitos vazio (busca só com letras) não pode entrar no .includes()
     de CNPJ/CPF — "qualquer coisa".includes("") é sempre true em JS, então
     sem essa guarda a busca por nome trazia TODO MUNDO, sem filtrar nada
     (bug pego em teste ao vivo). */
  const resultados = termo && todos ? todos.filter((c) =>
    (c.razao_social || '').toLowerCase().includes(termo) ||
    (termoDigitos && (c.cnpj || '').replace(/\D/g, '').includes(termoDigitos)) ||
    (termoDigitos && (c.cpf || '').replace(/\D/g, '').includes(termoDigitos)) ||
    (c.codigo || '').toLowerCase().includes(termo)
  ).slice(0, 8) : [];

  if (selecionado) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: 'var(--vp-gray-50)' }}>
        <div className="row sb" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{selecionado.razao_social} <span className="mono muted small">({selecionado.codigo})</span></div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {selecionado.cnpj || selecionado.cpf || 'sem documento'} · {selecionado.telefone || 'sem telefone'} · {selecionado.cidade}{selecionado.cidade && selecionado.estado ? '/' : ''}{selecionado.estado}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSelecionado(null); onSelecionar(null); setBusca(''); }}>Trocar</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input className="input" placeholder="Buscar cliente por nome, CNPJ/CPF ou código…" value={busca}
          onChange={(e) => setBusca(e.target.value)} onFocus={() => setFocado(true)} onBlur={() => setTimeout(() => setFocado(false), 150)}/>
        {focado && termo && (
          <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
            {todos === null ? (
              <div className="small muted" style={{ padding: 10 }}>Carregando…</div>
            ) : resultados.length === 0 ? (
              <div className="small muted" style={{ padding: 10 }}>Nenhum cliente encontrado com "{busca}".</div>
            ) : resultados.map((c) => (
              <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseDown={() => { setSelecionado(c); onSelecionar(c); }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.razao_social}</div>
                <div className="small muted">{c.cnpj || c.cpf || 'sem documento'} · {c.codigo}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Não achou? <a href="#" onClick={(e) => { e.preventDefault(); onCriarNovo(); }}>cadastrar cliente novo aqui mesmo</a> (fica salvo em Cadastros também).
      </p>
    </div>
  );
}

/* ---------- Anexos (projeto civil da obra) ----------
   O cliente (Canal 2, link público) anexa a planta/memorial/DWG do projeto
   civil; o Comercial (Canal 1) só visualiza/baixa e extrai as medidas na
   mão — equivale a uma "entrevista" feita por documento em vez de conversa. */
function feFmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FEAnexos({ formularioId, categoria, titulo, descricao, podeAnexar, garantirSalvo }) {
  const [anexos, setAnexos] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);
  const fileRef = React.useRef(null);

  const recarregar = React.useCallback(() => {
    if (!formularioId) { setAnexos([]); return; }
    window.FormularioElevadorStore.listarAnexos(formularioId, categoria).then(setAnexos).catch(() => setAnexos([]));
  }, [formularioId, categoria]);
  React.useEffect(() => { recarregar(); }, [recarregar]);

  /* Formulário novo ainda não tem id (só nasce no banco no 1º save) — sem
     isso, não dava pra anexar nada até salvar manualmente primeiro. Salva
     o rascunho na hora, por trás, na primeira tentativa de anexar. */
  const onEscolherArquivo = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setEnviando(true);
    try {
      let fid = formularioId;
      if (!fid && garantirSalvo) fid = await garantirSalvo();
      if (!fid) { window.toast?.('Preencha os campos obrigatórios do formulário antes de anexar.', 'warning'); return; }
      const novo = await window.FormularioElevadorStore.anexarArquivo(fid, file, categoria);
      setAnexos((prev) => [novo, ...(prev || [])]);
      window.toast?.('Arquivo anexado.', 'success');
    } catch (err) {
      window.toast?.('Erro ao anexar: ' + err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (anexo) => {
    const url = await window.FormularioElevadorStore.urlAssinadaAnexo(anexo.path);
    if (url) window.open(url, '_blank');
    else window.toast?.('Não foi possível abrir o arquivo.', 'error');
  };

  const remover = async (anexo) => {
    if (!window.confirm(`Remover "${anexo.nome_arquivo}"?`)) return;
    try {
      await window.FormularioElevadorStore.removerAnexo(anexo);
      recarregar();
    } catch (err) {
      window.toast?.('Erro ao remover: ' + err.message, 'error');
    }
  };

  return (
    <Card title={titulo}>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>{descricao}</p>
      {podeAnexar && (
        <div style={{ marginBottom: 10 }}>
          <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".pdf,.dwg,.dxf,image/*" onChange={onEscolherArquivo}/>
          <Button variant="outline" icon="paperclip" disabled={enviando} onClick={() => fileRef.current && fileRef.current.click()}>
            {enviando ? 'Enviando…' : 'Anexar arquivo'}
          </Button>
        </div>
      )}
      {anexos === null ? (
        <p className="small muted">Carregando anexos…</p>
      ) : anexos.length === 0 ? (
        <p className="small muted">Nenhum arquivo anexado ainda.</p>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {anexos.map((a) => (
            <div key={a.id} className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--vp-gray-50)', borderRadius: 6 }}>
              <div>
                <b style={{ fontSize: 13 }}>{a.nome_arquivo}</b>
                <div className="small muted">{feFmtBytes(a.tamanho_bytes)} · {new Date(a.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
              <div className="row gap-2">
                <Button variant="ghost" size="sm" icon="download" onClick={() => abrir(a)}>Ver</Button>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => remover(a)}>Remover</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const FE_OPCOES_VAZIAS = { teto_falso: [], piso: [], porta: [], botoeira_cabine: [], botoeira_pavimento: [] };

/* ---------- Card de uma Unidade (um elevador) ---------- */
function FEUnidadeCard({ unidade, index, onChange, onRemove, onDuplicate, fornecedores, modelos, publicMode, numeroCotacao }) {
  const [open, setOpen] = React.useState(true);
  const [opcoes, setOpcoes] = React.useState(FE_OPCOES_VAZIAS);
  const set = (k) => (v) => onChange({ ...unidade, [k]: v });

  React.useEffect(() => {
    let cancelado = false;
    if (!unidade.modelo) { setOpcoes(FE_OPCOES_VAZIAS); return; }
    window.FormularioElevadorStore.listarOpcoesElevador(unidade.modelo)
      .then((o) => { if (!cancelado) setOpcoes(o); })
      .catch(() => { if (!cancelado) setOpcoes(FE_OPCOES_VAZIAS); });
    return () => { cancelado = true; };
  }, [unidade.modelo]);

  const modelosDisponiveis = (modelos || []).filter((m) => !unidade.tipo || m.tipo === unidade.tipo);
  const tipoEquip = unidade.tipo_equipamento || 'elevador';
  const tipoEquipLabel = (FE_TIPOS_EQUIPAMENTO.find((t) => t.value === tipoEquip) || {}).label || 'Equipamento';

  /* 15/08 — o "E1"/"E2" digitado à mão não dizia nada; o número da cotação
     + indice_ativo (que o INSERT já gera) já formam o código real do
     equipamento (VPEL-EL0917-1, VPER-ER0917-2...). Assim que os dois
     existirem, sincroniza `identificador` pra esse código — é ele que
     aparece em RFQ/precificação/engenharia daqui pra frente. Antes do
     primeiro save (sem numeroCotacao/indice_ativo ainda), mantém o rótulo
     provisório E1/E2 só pra diferenciar os cards na tela. */
  const codigoUnidade = feCodigoUnidade(tipoEquip, numeroCotacao, unidade.indice_ativo);
  React.useEffect(() => {
    if (codigoUnidade && unidade.identificador !== codigoUnidade) set('identificador')(codigoUnidade);
  }, [codigoUnidade]);

  return (
    <Card
      title={codigoUnidade || `${tipoEquipLabel} ${unidade.identificador || index + 1}${Number(unidade.quantidade) > 1 ? ` × ${unidade.quantidade}` : ''}`}
      sub={`${tipoEquip === 'elevador' ? (unidade.tipo || 'Tipo não definido') : tipoEquipLabel}${codigoUnidade ? '' : ' · código gerado ao salvar'}`}
      action={
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon={open ? 'chevUp' : 'chevDown'} onClick={() => setOpen((o) => !o)}/>
          {!publicMode && onDuplicate && (
            <Button variant="outline" size="sm" icon="copy" onClick={onDuplicate} title="Copia todos os campos deste equipamento pra um card novo — útil quando só muda paradas/velocidade">Duplicar</Button>
          )}
          <Button variant="ghost" size="sm" icon="trash" onClick={onRemove}>Remover</Button>
        </div>
      }
    >
      {open && (
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Identificação do equipamento</div>
            <div className={publicMode ? 'grid-3' : 'grid-4'} style={{ gap: 12 }}>
              <FEField label="Código do equipamento">
                <FEInput value={codigoUnidade || 'Gerado ao salvar'} onChange={() => {}} disabled/>
              </FEField>
              <FEField label="Quantidade idêntica"><FEInput type="number" value={unidade.quantidade ?? 1} onChange={(v) => set('quantidade')(Math.max(1, Number(v) || 1))} placeholder="1"/></FEField>
              <FEField label="Tipo de equipamento *"><FESelect value={tipoEquip} onChange={set('tipo_equipamento')} options={FE_TIPOS_EQUIPAMENTO}/></FEField>
              {tipoEquip === 'elevador' && <FEField label="Tipo *"><FESelect value={unidade.tipo} onChange={set('tipo')} options={FE_TIPOS}/></FEField>}
              {tipoEquip === 'elevador' && <FEField label="Modelo"><FESelect value={unidade.modelo} onChange={set('modelo')} options={modelosDisponiveis.map((m) => ({ value: m.codigo, label: `${m.codigo} — ${m.nome}` }))} placeholder="— selecione o modelo —"/></FEField>}
              {tipoEquip === 'elevador' && <FEField label="Norma de projeto"><FESelect value={unidade.norma_projeto} onChange={set('norma_projeto')} options={FE_NORMAS}/></FEField>}
              {!publicMode && <FEField label="Fornecedor"><FESelect value={unidade.fornecedor} onChange={set('fornecedor')} options={fornecedores || []}/></FEField>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg3)', margin: '8px 0 0' }}>
              Se o cliente quer vários equipamentos idênticos, informe a quantidade aqui em vez de adicionar um card pra cada — use "+ Adicionar equipamento diferente" abaixo só quando a especificação mudar (ex.: um modelo/tipo distinto, ou mais paradas).
              {tipoEquip === 'elevador' && !unidade.modelo && ' Selecione o modelo do elevador para ver as opções disponíveis de teto falso, piso, porta e botoeiras.'}
            </p>
            {tipoEquip === 'elevador' && (
              <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
                <FEField label="Capacidade (kg)"><FEInput type="number" value={unidade.capacidade_kg} onChange={set('capacidade_kg')} placeholder="630"/></FEField>
                <FEField label="Capacidade (passageiros)"><FEInput type="number" value={unidade.capacidade_pessoas} onChange={set('capacidade_pessoas')} placeholder="8"/></FEField>
                <FEField label="Velocidade (m/s) *"><FEInput type="number" value={unidade.velocidade_ms} onChange={set('velocidade_ms')} placeholder="1.0"/></FEField>
                <FEField label="Paradas *"><FEInput type="number" value={unidade.paradas} onChange={set('paradas')} placeholder="4"/></FEField>
                <FEField label="Descrição dos pavimentos *" span="2"><FEInput value={unidade.pavimentos_desc} onChange={set('pavimentos_desc')} placeholder="Térreo, 1, 2, 3"/></FEField>
                <FEField label="Casa de máquinas *"><FESelect value={unidade.casa_maquinas} onChange={set('casa_maquinas')} options={[{ value: 'com', label: 'Com casa de máquinas' }, { value: 'sem', label: 'Sem casa de máquinas (MRL)' }]}/></FEField>
                <FEField label="Agrupamento *"><FESelect value={unidade.agrupamento} onChange={set('agrupamento')} options={[{ value: 'simplex', label: 'Simplex' }, { value: 'duplex', label: 'Duplex' }, { value: 'triplex', label: 'Triplex' }, { value: 'group', label: 'Group control' }]}/></FEField>
                <FEField label="Porta oposta / múltiplas entradas *"><FEInput value={unidade.porta_oposta} onChange={set('porta_oposta')} placeholder="Não / Sim - 180°"/></FEField>
              </div>
            )}
          </div>

          {tipoEquip !== 'elevador' && (
            <FEEspecificacoesGenericas tipoEquipamento={tipoEquip} especificacoes={unidade.especificacoes} onChange={set('especificacoes')}/>
          )}

          {tipoEquip === 'elevador' && (
          <React.Fragment>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Estrutura e dimensões da obra <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— opcional, Engenharia complementa na vistoria</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Tipo de estrutura da caixa *"><FEInput value={unidade.estrutura_caixa} onChange={set('estrutura_caixa')} placeholder="Concreto / Alvenaria / Aço"/></FEField>
              <FEField label="Caixa — largura (mm)"><FEInput type="number" value={unidade.caixa_largura_mm} onChange={set('caixa_largura_mm')}/></FEField>
              <FEField label="Caixa — profundidade (mm)"><FEInput type="number" value={unidade.caixa_profundidade_mm} onChange={set('caixa_profundidade_mm')}/></FEField>
              <FEField label="Percurso / altura de viagem (mm) *"><FEInput type="number" value={unidade.percurso_mm} onChange={set('percurso_mm')}/></FEField>
              <FEField label="Última altura / overhead (mm)"><FEInput type="number" value={unidade.overhead_mm} onChange={set('overhead_mm')}/></FEField>
              <FEField label="Profundidade do poço (mm)"><FEInput type="number" value={unidade.poco_mm} onChange={set('poco_mm')}/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Cabina <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— opcional</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Largura (mm)"><FEInput type="number" value={unidade.cabina_largura_mm} onChange={set('cabina_largura_mm')}/></FEField>
              <FEField label="Profundidade (mm)"><FEInput type="number" value={unidade.cabina_profundidade_mm} onChange={set('cabina_profundidade_mm')}/></FEField>
              <FEField label="Altura (mm)"><FEInput type="number" value={unidade.cabina_altura_mm} onChange={set('cabina_altura_mm')} placeholder="2500 (padrão)"/></FEField>
              <FEField label="Teto falso"><FESelect value={unidade.teto_falso} onChange={set('teto_falso')} options={opcoes.teto_falso} placeholder="— selecione o modelo primeiro —"/></FEField>
              <FEField label="Piso da cabina"><FESelect value={unidade.piso_cabina} onChange={set('piso_cabina')} options={opcoes.piso} placeholder="— selecione o modelo primeiro —"/></FEField>
              <FEField label="Corrimão"><FEInput value={unidade.corrimao} onChange={set('corrimao')} placeholder="Não / Sim - traseiro"/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Portas <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tipo obrigatório, resto opcional</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Tipo de abertura *"><FESelect value={unidade.porta_tipo_abertura} onChange={set('porta_tipo_abertura')} options={['Central', 'Lateral', 'Telescópica']}/></FEField>
              <FEField label="Modelo de porta"><FESelect value={unidade.porta_modelo} onChange={set('porta_modelo')} options={opcoes.porta} placeholder="— selecione o modelo primeiro —"/></FEField>
              <FEField label="Largura (mm)"><FEInput type="number" value={unidade.porta_largura_mm} onChange={set('porta_largura_mm')}/></FEField>
              <FEField label="Altura (mm)"><FEInput type="number" value={unidade.porta_altura_mm} onChange={set('porta_altura_mm')}/></FEField>
              <FEField label="Acabamento porta cabina"><FEInput value={unidade.acabamento_porta_cabina} onChange={set('acabamento_porta_cabina')}/></FEField>
              <FEField label="Acabamento porta pavimento"><FEInput value={unidade.acabamento_porta_pavimento} onChange={set('acabamento_porta_pavimento')}/></FEField>
              <FEField label="Classe corta-fogo"><FESelect value={unidade.classe_corta_fogo} onChange={set('classe_corta_fogo')} options={['Nenhuma', 'E120', 'EI60', 'EI120']}/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Elétrico</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Tensão de alimentação principal *"><FEInput value={unidade.tensao_principal} onChange={set('tensao_principal')} placeholder="380V/3P/60Hz"/></FEField>
              <FEField label="Tensão de iluminação *"><FEInput value={unidade.tensao_iluminacao} onChange={set('tensao_iluminacao')} placeholder="220V/1P/60Hz"/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Botoeiras</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Botoeira de cabine (COP)"><FESelect value={unidade.botoeira_cabine} onChange={set('botoeira_cabine')} options={opcoes.botoeira_cabine} placeholder="— selecione o modelo primeiro —"/></FEField>
              <FEField label="Botoeira de pavimento (LOP)"><FESelect value={unidade.botoeira_pavimento} onChange={set('botoeira_pavimento')} options={opcoes.botoeira_pavimento} placeholder="— selecione o modelo primeiro —"/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Opcionais <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tudo opcional</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="stack" style={{ gap: 8, justifyContent: 'center' }}>
                <FECheck label="ARD — resgate automático" checked={unidade.ard} onChange={set('ard')}/>
                <FECheck label="Câmera na cabine" checked={unidade.camera} onChange={set('camera')}/>
                <FECheck label="Anúncio de voz" checked={unidade.anuncio_voz} onChange={set('anuncio_voz')}/>
              </div>
              <FEField label="Exigências especiais" span="3"><textarea className="input" rows={2} value={unidade.exigencias_especiais || ''} onChange={(e) => set('exigencias_especiais')(e.target.value)}/></FEField>
            </div>
          </div>
          </React.Fragment>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- Envio da cotação técnica a fornecedores (Glarie, por ora) ----------
   Agrupa as Unidades salvas por (fornecedor, tipo_formulario) — tipo_formulario
   é "elevator" ou "homelift" conforme o Tipo da unidade — e envia 1 link por
   grupo (WhatsApp/E-mail/Link), igual ao Pedido a Fornecedor já existente. */
const FE_TIPO_FORMULARIO_LABEL = { elevator: 'Elevator Inquiry Form', homelift: 'Homelift Inquiry Form' };
function FECefStatusChip({ status }) {
  const store = window.CotacaoElevadorFornecedorStore;
  return <span className="la-setor" style={{ background: store.STATUS_COR[status] || '#64748b' }}>{store.STATUS_LABEL[status] || status}</span>;
}

function FECotacaoDivergencias({ itens }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const comDivergencia = itens
    .map((it) => ({ it, divs: Object.entries(it.divergencias || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined) }))
    .filter((x) => x.divs.length);
  if (!comDivergencia.length) return null;
  return (
    <div className="alert warning" style={{ marginTop: 12 }}>
      <Icon.warning/>
      <div style={{ flex: 1 }}>
        <div className="alert__title">O fornecedor divergiu da especificação enviada</div>
        {comDivergencia.map(({ it, divs }) => (
          <div key={it.unidade_id} style={{ marginTop: 6 }}>
            <b className="small">{it.unidade_identificador || it.unidade_id}</b>
            <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
              {divs.map(([key, v]) => (
                <li key={key} className="small">{store.unitSpecFieldLabel(key)}: <b>{v}</b></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FECotacaoAnexosResposta({ cotacaoId }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const [anexos, setAnexos] = React.useState([]);
  React.useEffect(() => {
    if (!store || !cotacaoId) return;
    store.listarAnexosResposta(cotacaoId).then(setAnexos).catch(() => setAnexos([]));
  }, [cotacaoId]);
  const abrir = async (a) => {
    const url = await store.urlAssinadaAnexoResposta(a.path);
    if (url) window.open(url, '_blank');
    else window.toast?.('Não foi possível gerar o link do arquivo.', 'error');
  };
  if (!anexos.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <span className="up-eyebrow muted">Anexos do fornecedor (PDF/DWG/imagens)</span>
      <div className="stack" style={{ gap: 4, marginTop: 4 }}>
        {anexos.map((a) => (
          <div key={a.id} className="row gap-2" style={{ fontSize: 13 }}>
            <Icon.fileText size={14}/>
            <button className="link-btn" style={{ border: 'none', background: 'transparent', color: 'var(--vp-info)', cursor: 'pointer', padding: 0, fontSize: 13 }}
              onClick={() => abrir(a)}>{a.nome_arquivo}</button>
            <span className="muted small">{a.tamanho_bytes ? `(${Math.round(a.tamanho_bytes / 1024)} KB)` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Tabela de leitura da spec técnica de uma Unidade, comparando o que a
   VerticalParts pediu (dados_envio, congelado no momento do envio) com o
   que o fornecedor propôs (respostas.itens[].divergencias) — mesmas 3
   colunas do formulário público, só que já respondido e read-only. Sem
   isso o "Ver resposta" só mostrava os campos comerciais + o resumo do
   equipamento, nunca a especificação técnica linha a linha. */
function FECotacaoSpecCompletaTable({ linhas, divergencias }) {
  const preenchidas = linhas.filter(([, , , v]) => v !== '' && v !== null && v !== undefined);
  if (!preenchidas.length) return null;
  return (
    <table className="t" style={{ marginTop: 4 }}>
      <thead><tr><th>Campo</th><th>VerticalParts pediu</th><th>Fornecedor propôs</th></tr></thead>
      <tbody>
        {preenchidas.map(([key, pt, en, v]) => {
          const div = (divergencias || {})[key];
          return (
            <tr key={key}>
              <td className="small">{pt} / {en}</td>
              <td className="small">{String(v)}</td>
              <td className="small">{div ? <b>{div}</b> : <span className="muted">Confirmado</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FECotacaoRespostaModal({ cot, onClose }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const r = cot.respostas || {};
  const itens = r.itens || [];
  const unidadesEnviadas = (cot.dados_envio && cot.dados_envio.unidades) || [];
  return (
    <Modal title={`Resposta de ${cot.fornecedor} — ${cot.numero_documento}`} onClose={onClose} width={880}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="grid-3" style={{ gap: 12 }}>
        <FEField label="Moeda"><b>{r.moeda || '—'}</b></FEField>
        <FEField label="Incoterm / Porto"><b>{r.incoterm_porto || '—'}</b></FEField>
        <FEField label="Validade da proposta"><b>{r.validade_dias ? `${r.validade_dias} dias` : '—'}</b></FEField>
        <FEField label="Prazo de fabricação"><b>{r.prazo_fabricacao || '—'}</b></FEField>
        <FEField label="Garantia"><b>{r.garantia || '—'}</b></FEField>
        <FEField label="Container"><b>{r.container_no || '—'}</b></FEField>
        <FEField label="Embalagem"><b>{r.embalagem || '—'}</b></FEField>
        <FEField label="Condições de pagamento" span="2"><b>{r.condicoes_pagamento || '—'}</b></FEField>
        <FEField label="Documentos no embarque" span="3"><b>{r.documentos_embarque || '—'}</b></FEField>
      </div>
      <FECotacaoDivergencias itens={itens}/>

      {unidadesEnviadas.map((u, i) => {
        const item = itens.find((it) => it.unidade_id === u.unidade_id) || {};
        const secoes = store ? store.unitSpecSecoes(u, cot.tipo_formulario) : [];
        return (
          <div key={u.unidade_id || i} style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <b style={{ fontSize: 13 }}>Unidade {u.identificador || i + 1}</b>
            {secoes.map((s) => (
              <div key={s.titulo} style={{ marginTop: 8 }}>
                <span className="up-eyebrow muted">{s.titulo}</span>
                <FECotacaoSpecCompletaTable linhas={s.linhas} divergencias={item.divergencias}/>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <span className="up-eyebrow muted">Resposta comercial do fornecedor</span>
              <div className="grid-2" style={{ gap: 8, marginTop: 4 }}>
                <FEField label="Modelo do fornecedor"><b>{item.modelo_fornecedor || '—'}</b></FEField>
                <FEField label="Andares/Paradas/Portas confirmados"><b>{item.floors_stops_doors || '—'}</b></FEField>
                <FEField label="Preço unitário"><b>{item.preco_unitario || '—'}</b></FEField>
                <FEField label={`Preço total (${u.quantidade || 1} un.)`}><b>{item.preco_total || '—'}</b></FEField>
              </div>
              {item.confirmacao_tecnica && (
                <div style={{ marginTop: 6 }}>
                  <span className="up-eyebrow muted">Confirmação técnica</span>
                  <p className="small" style={{ marginTop: 2 }}>{item.confirmacao_tecnica}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {r.observacoes_gerais && (
        <div style={{ marginTop: 16 }}>
          <span className="up-eyebrow muted">Observações gerais</span>
          <p className="small" style={{ marginTop: 4 }}>{r.observacoes_gerais}</p>
        </div>
      )}
      <FECotacaoAnexosResposta cotacaoId={cot.id}/>
    </Modal>
  );
}

function FECotacaoFornecedorGrupo({ grupo, cot, onEnviar, onPedirRevisao, enviando }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const suportado = grupo.fornecedor === 'Glarie';
  const [verResp, setVerResp] = React.useState(false);
  const [recipient, setRecipient] = React.useState(() => (
    grupo.fornecedor === 'Glarie'
      ? { nome: 'Kimmy (Glarie)', email: 'kimmy.kuai@glarie.com', telefone: '8618751801577' }
      : { nome: '', email: '', telefone: '' }
  ));
  const setR = (k) => (v) => setRecipient((r) => ({ ...r, [k]: v }));
  const key = `${grupo.fornecedor}|${grupo.tipoFormulario}`;
  const busy = enviando === key;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <b>{grupo.fornecedor}</b> <span className="muted small">· {FE_TIPO_FORMULARIO_LABEL[grupo.tipoFormulario]}</span>
          <div className="small muted">Unidades: {grupo.unidades.map((u) => u.identificador || '—').join(', ')}</div>
        </div>
        {cot && <FECefStatusChip status={cot.status}/>}
      </div>

      {!suportado && <p className="small muted" style={{ marginTop: 8 }}>Formulário deste fornecedor ainda não configurado — em breve.</p>}

      {suportado && cot?.status === 'respondido' ? (
        <div style={{ marginTop: 10 }}>
          <div className="row gap-2">
            <Button variant="outline" size="sm" icon="fileText" onClick={() => setVerResp(true)}>Ver resposta do fornecedor</Button>
            <Button variant="ghost" size="sm" icon="refresh" disabled={busy} onClick={() => onPedirRevisao(grupo)}>Pedir nova revisão</Button>
          </div>
          {verResp && <FECotacaoRespostaModal cot={cot} onClose={() => setVerResp(false)}/>}
        </div>
      ) : suportado && (
        <div style={{ marginTop: 10 }}>
          <div className="grid-3" style={{ gap: 8 }}>
            <FEInput value={recipient.nome} onChange={setR('nome')} placeholder="Contato no fornecedor"/>
            <FEInput value={recipient.email} onChange={setR('email')} placeholder="e-mail"/>
            <FEInput value={recipient.telefone} onChange={setR('telefone')} placeholder="WhatsApp (DDI+DDD+número)"/>
          </div>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <Button variant="outline" size="sm" icon="message" disabled={busy} onClick={() => onEnviar(grupo, 'whatsapp', recipient)}>WhatsApp</Button>
            <Button variant="outline" size="sm" icon="mail" disabled={busy || !recipient.email} onClick={() => onEnviar(grupo, 'email', recipient)}>E-mail</Button>
            <Button variant="ghost" size="sm" icon="copy" disabled={busy} onClick={() => onEnviar(grupo, 'link', recipient)}>Copiar link</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FECotacaoFornecedorModal({ formularioId, unidades, numeroCotacao, onClose }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const [cotacoes, setCotacoes] = React.useState([]);
  const [enviando, setEnviando] = React.useState(null);

  const reload = () => store.listarPorFormulario(formularioId).then(setCotacoes).catch(() => {});
  React.useEffect(() => { reload(); }, [formularioId]);

  const grupos = React.useMemo(() => {
    const map = {};
    unidades.filter((u) => u.id && u.fornecedor).forEach((u) => {
      const tipoFormulario = store.tipoFormularioPara(u.tipo);
      /* categoriaProduto real da unidade (elevador/escada_rolante/
         esteira_rolante) — antes o grupo só separava por fornecedor+
         tipoFormulario (esse último só distingue elevador-padrão de
         home-lift, sempre dentro de "elevador"), então unidades de
         escada/esteira caíam no mesmo grupo que elevador e a cotação
         nascia com categoria_produto='elevador' hardcoded, mesmo pra
         unidade de outro tipo. */
      const categoriaProduto = FE_CATEGORIA_MASTERID[u.tipo_equipamento || 'elevador'] || 'elevador';
      const key = `${u.fornecedor}|${tipoFormulario}|${categoriaProduto}`;
      if (!map[key]) map[key] = { fornecedor: u.fornecedor, tipoFormulario, categoriaProduto, unidades: [] };
      map[key].unidades.push(u);
    });
    return Object.values(map);
  }, [unidades]);

  const cotacaoDoGrupo = (g) => cotacoes.find((c) => c.fornecedor === g.fornecedor && c.tipo_formulario === g.tipoFormulario && c.categoria_produto === g.categoriaProduto);

  /* Pedir revisão = documento novo inteiro (mais simples por enquanto, ver
     issue de revisão): cria uma nova cotação (revisão auto-incrementada por
     store.gerar, ex. VPEL-EL0902 -> -A -> -B) pro MESMO fornecedor+tipo — a
     resposta anterior não é apagada, continua acessível em Cotações a
     Fornecedor. Depois de criada, cotacaoDoGrupo() já pega a mais recente
     (listarPorFormulario ordena por created_at desc), então o card volta
     sozinho pro estado "aguardando envio" com os campos de contato prontos. */
  const pedirRevisao = async (grupo) => {
    const key = `${grupo.fornecedor}|${grupo.tipoFormulario}|${grupo.categoriaProduto}`;
    if (!window.confirm(`Isso cria um novo documento de cotação (revisão) para ${grupo.fornecedor}, com um novo link. A resposta anterior continua salva e pode ser vista em Cotações a Fornecedor. Deseja continuar?`)) return;
    setEnviando(key);
    try {
      await store.gerar(formularioId, grupo.unidades, grupo.fornecedor, numeroCotacao, grupo.categoriaProduto);
      await reload();
      window.toast?.('Nova revisão criada — preencha o contato e envie.', 'success');
    } catch (e) {
      window.toast?.('Erro ao criar revisão: ' + e.message, 'error');
    } finally {
      setEnviando(null);
    }
  };

  const enviar = async (grupo, canal, recipient) => {
    const key = `${grupo.fornecedor}|${grupo.tipoFormulario}|${grupo.categoriaProduto}`;
    setEnviando(key);
    try {
      let cot = cotacaoDoGrupo(grupo);
      if (!cot) cot = await store.gerar(formularioId, grupo.unidades, grupo.fornecedor, numeroCotacao, grupo.categoriaProduto);
      const url = store.cotacaoUrl(cot.token);
      const numeroTxt = numeroCotacao != null ? ` — Cotação Nº ${window.MasterIdEngine.baseId('elevador', numeroCotacao)}` : '';
      const msg = `Solicitação de cotação técnica ${cot.numero_documento}${numeroTxt} — VerticalParts\n` +
        `Segue o link com as especificações da(s) unidade(s) ${grupo.unidades.map((u) => u.identificador).join(', ')} para cotação:\n${url}`;
      if (canal === 'whatsapp') window.open(window.PFStore.whatsAppHref(recipient.telefone, msg), '_blank');
      if (canal === 'email') window.open(window.PFStore.mailtoHref(recipient.email, `Cotação técnica ${cot.numero_documento} — VerticalParts`, msg), '_blank');
      if (canal === 'link') { try { await navigator.clipboard.writeText(url); } catch (e) {} window.toast?.('Link copiado.', 'success'); }
      await store.marcarEnviado(cot.id, canal, recipient);
      await reload();
      window.toast?.('Cotação marcada como enviada.', 'success');
    } catch (e) {
      window.toast?.('Erro ao enviar: ' + e.message, 'error');
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Modal title="Enviar cotação técnica aos fornecedores" onClose={onClose} width={640}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {grupos.length === 0 && <p className="small muted">Salve o formulário e defina o Fornecedor em pelo menos uma Unidade para enviar a cotação.</p>}
      {grupos.map((g) => (
        <FECotacaoFornecedorGrupo key={`${g.fornecedor}|${g.tipoFormulario}|${g.categoriaProduto}`} grupo={g} cot={cotacaoDoGrupo(g)} onEnviar={enviar} onPedirRevisao={pedirRevisao} enviando={enviando}/>
      ))}
    </Modal>
  );
}

/* ---------- Envio do link do cliente (Canal 2 — self-service) ----------
   Mesma regra de envio do fornecedor (WhatsApp/E-mail/Link), mas em
   português e só com o link do formulário em branco — os dados do
   equipamento ainda não existem, quem preenche é o próprio cliente. */
function FELinkClienteModal({ url, numeroCotacao, header, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [telefone, setTelefone] = React.useState(header.telefone || '');
  const [email, setEmail] = React.useState(header.email || '');

  const numeroTxt = numeroCotacao != null ? ` — Cotação Nº ${window.MasterIdEngine.baseId('elevador', numeroCotacao)}` : '';
  const msg = `Olá! Segue o link para preencher os dados do seu elevador${numeroTxt} — VerticalParts:\n${url}\n\n` +
    `Assim que enviar, nossa equipe já recebe os dados automaticamente para preparar a cotação.`;

  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); window.toast?.('Link copiado.', 'success'); }
    catch (e) { window.prompt('Copie o link:', url); }
  };
  const enviarWhatsApp = () => window.open(window.PFStore.whatsAppHref(telefone, msg), '_blank');
  const enviarEmail = () => window.open(window.PFStore.mailtoHref(email, `Formulário de Elevador${numeroTxt} — VerticalParts`, msg), '_blank');

  return (
    <Modal title="Enviar link para o cliente preencher" onClose={onClose} width={520}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="pf-portal-callout">
        <div className="pf-portal-ico">🔗</div>
        <div>
          <b>Formulário online do cliente</b>
          <p>O cliente abre o link, preenche os dados do elevador e obra, e <b>o VP Gestão recebe automaticamente</b> — sem PDF, sem digitação manual.</p>
        </div>
      </div>

      <div className="pf-linkbox">
        <input className="input mono small" readOnly value={url} onFocus={(e) => e.target.select()}/>
        <Button variant="primary" size="sm" icon={copied ? 'check' : 'copy'} onClick={copiarLink}>{copied ? 'Copiado!' : 'Copiar link'}</Button>
      </div>

      <div className="grid-2" style={{ gap: 8, marginTop: 12 }}>
        <FEField label="WhatsApp do cliente"><FEInput value={telefone} onChange={setTelefone} placeholder="(11) 99999-0000"/></FEField>
        <FEField label="E-mail do cliente"><FEInput value={email} onChange={setEmail} placeholder="cliente@empresa.com.br"/></FEField>
      </div>

      <div className="up-eyebrow muted" style={{ margin: '14px 0 6px' }}>Enviar por</div>
      <div className="stack" style={{ gap: 8 }}>
        <Button variant="outline" icon="message" disabled={!telefone} onClick={enviarWhatsApp}>WhatsApp</Button>
        <Button variant="outline" icon="mail" disabled={!email} onClick={enviarEmail}>E-mail</Button>
      </div>
    </Modal>
  );
}

/* Únicos campos que realmente pertencem ao header (formularios_elevador) —
   usado tanto pra filtrar o que vem do banco (obter() também traz id, token,
   status, unidades...) quanto pra montar o payload de save. Sem esse filtro,
   reabrir um rascunho e salvar de novo reenviava colunas inexistentes
   (ex.: `unidades`) e o update quebrava. */
const FE_FINALIDADE_COMPRA = [
  { value: 'uso_consumo_ativo', label: 'Uso e Consumo / Ativo Imobilizado' },
  { value: 'revenda', label: 'Revenda' },
];

const FE_HEADER_KEYS = [
  'tipo_pessoa', 'razao_social', 'cnpj', 'cpf', 'inscricao_estadual', 'contribuinte_icms', 'finalidade_compra',
  'endereco_logradouro', 'endereco_complemento', 'endereco_bairro', 'endereco_cep', 'endereco_cidade', 'endereco_estado',
  'telefone', 'email',
  'local_obra_cidade', 'local_obra_estado', 'endereco_obra_diferente',
  'endereco_obra', 'endereco_obra_logradouro', 'endereco_obra_complemento', 'endereco_obra_bairro', 'endereco_obra_cep', 'endereco_obra_cidade', 'endereco_obra_estado',
  'prazo_desejado',
  'tipo_mao_de_obra', 'responsavel_entrega', 'origem_venda', 'vendedor', 'observacoes',
];
function feHeaderDefaults() {
  const h = {};
  FE_HEADER_KEYS.forEach((k) => { h[k] = k === 'endereco_obra_diferente' ? false : ''; });
  return h;
}
function feHeaderPick(obj) {
  const h = {};
  FE_HEADER_KEYS.forEach((k) => { if (obj[k] !== undefined) h[k] = obj[k]; });
  // Campos com CHECK de enum no banco (só aceitam um valor da lista OU null —
  // "" não passa). "Finalidade da compra" é opcional na UI (sem *), então
  // salvar sem escolher nada mandava "" e quebrava com um erro cru do
  // Postgres ("violates check constraint") em vez de simplesmente gravar
  // "sem resposta" (achado E2E). tipo_mao_de_obra/responsavel_entrega já são
  // obrigatórios na validação — a sanitização aqui é só rede de segurança.
  ['finalidade_compra', 'tipo_mao_de_obra', 'responsavel_entrega'].forEach((k) => {
    if (h[k] === '') h[k] = null;
  });
  return h;
}

/* ---------- Página / componente principal ---------- */
function FormularioElevadorForm({ formularioId, publicMode, prefillFromLead, onSaved, onVoltar, onControleCotacoes }) {
  const [loading, setLoading] = React.useState(!!formularioId);
  const [saving, setSaving] = React.useState(false);
  const [id, setId] = React.useState(formularioId || null);
  const [header, setHeader] = React.useState(feHeaderDefaults());
  const [unidades, setUnidades] = React.useState([feNovaUnidade('E1')]);
  /* 15/08 — vendedor busca o cliente já cadastrado em Cadastros em vez de
     redigitar tudo aqui (Cadastros existe desde ontem). `criarClienteInline`
     é a válvula de escape: se o cliente ainda não existir lá, mostra o
     formulário antigo (os mesmos campos de sempre) só pra esse caso — não
     bloqueia o vendedor esperando alguém cadastrar em outra tela. Canal
     self_service (link público pro cliente preencher sozinho) sempre usa o
     formulário completo — não faz sentido pedir pro cliente "se buscar". */
  const [clienteId, setClienteId] = React.useState(null);
  const [criarClienteInline, setCriarClienteInline] = React.useState(false);
  const [linkPublico, setLinkPublico] = React.useState(null);
  const [numeroCotacao, setNumeroCotacao] = React.useState(null);
  const [fornecedores, setFornecedores] = React.useState([]);
  const [modelos, setModelos] = React.useState([]);
  const [showCotacaoFornecedor, setShowCotacaoFornecedor] = React.useState(false);
  const [showLinkCliente, setShowLinkCliente] = React.useState(false);

  React.useEffect(() => {
    if (publicMode) return;
    window.FormularioElevadorStore.listarFornecedores().then(setFornecedores).catch(() => {});
  }, [publicMode]);

  /* Só Glarie tem o formulário técnico de cotação configurado de verdade
     (ver FECotacaoFornecedorGrupo.suportado abaixo) — os demais cadastrados
     em fornecedores_elevador (BST, Seelon...) apareciam no seletor lado a
     lado com Glarie, sem nenhuma distinção, e só avisavam "ainda não
     configurado" DEPOIS de o vendedor escolher e tentar enviar (achado #92).
     Marca visualmente no próprio seletor quem está pronto. */
  const fornecedoresOptions = React.useMemo(() => fornecedores.map((nome) => (
    nome === 'Glarie' ? nome : { value: nome, label: `${nome} (RFQ ainda não configurado)` }
  )), [fornecedores]);

  React.useEffect(() => {
    window.FormularioElevadorStore.listarModelosElevador().then(setModelos).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!formularioId) return;
    setLoading(true);
    window.FormularioElevadorStore.obter(formularioId).then((f) => {
      setId(f.id);
      setHeader((h) => ({ ...h, ...feHeaderPick(f) }));
      setNumeroCotacao(f.numero_cotacao ?? null);
      setClienteId(f.cliente_id || null);
      if (!f.cliente_id && f.razao_social) setCriarClienteInline(true); // formulário antigo, sem vínculo — mantém editável do jeito que já estava
      if (f.unidades && f.unidades.length) setUnidades(f.unidades);
      setLoading(false);
    }).catch((e) => { window.toast?.('Erro ao carregar formulário: ' + e.message, 'error'); setLoading(false); });
  }, [formularioId]);

  /* Handoff vindo do Lead ("Criar Cotação China →", comercial.jsx) — só
     preenche telefone/e-mail/observações e a 1ª unidade (quando o Lead
     tinha Elevador marcado); nome/razão social continua exigindo o
     cliente-picker normal, não dá pra inventar isso a partir do prédio.
     Editável, não trava nada — mesmo espírito do autopreenchimento por
     CEP/CNPJ já existente aqui. */
  React.useEffect(() => {
    if (formularioId || !prefillFromLead) return;
    const lead = prefillFromLead;
    setHeader((h) => ({
      ...h,
      telefone: lead.phone || h.telefone,
      email: lead.email || h.email,
      observacoes: [
        `Originado do Lead ${lead.id} (${lead.building || ''}).`,
        lead.contact ? `Contato: ${lead.contact}${lead.role ? ' — ' + lead.role : ''}.` : null,
      ].filter(Boolean).join(' '),
    }));
    if (lead.elevSpec) {
      setUnidades([{
        ...feNovaUnidade('E1'),
        quantidade: lead.elevSpec.qty || 1,
        paradas: lead.elevSpec.paradas != null ? String(lead.elevSpec.paradas) : '',
        capacidade_kg: lead.elevSpec.carga || '',
        porta_largura_mm: lead.elevSpec.vao || '',
        porta_tipo_abertura: lead.elevSpec.abertura || '',
        acabamento_porta_cabina: lead.elevSpec.acabamento || '',
      }]);
    }
  }, [formularioId, prefillFromLead]);

  const setH = (k) => (v) => setHeader((h) => ({ ...h, [k]: v }));

  /* Autopreenchimento por CEP — melhor fonte, pois não depende de o CNPJ
     "bater" com o endereço real. Preenche mas deixa os campos editáveis. */
  const buscarCepEPreencher = (prefix) => async (cepRaw) => {
    if (!window.EnderecoAPI?.isCepValido(cepRaw)) return;
    try {
      const dados = await window.EnderecoAPI.buscarCEP(cepRaw);
      setHeader((h) => ({
        ...h,
        [`${prefix}logradouro`]: window.EnderecoAPI.mesclarLogradouro(h[`${prefix}logradouro`], dados.logradouro),
        [`${prefix}bairro`]: dados.bairro || h[`${prefix}bairro`],
        [`${prefix}cidade`]: dados.cidade || h[`${prefix}cidade`],
        [`${prefix}estado`]: dados.estado || h[`${prefix}estado`],
      }));
    } catch (e) {
      window.toast?.(e.message, 'warning');
    }
  };

  /* Autopreenchimento por CNPJ — preenche o formulário inteiro do cliente,
     mas o endereço pode não bater com o real (por isso o CEP acima é a via
     preferencial), então tudo continua editável manualmente. */
  const buscarCnpjEPreencher = async (cnpjRaw) => {
    if (!window.EnderecoAPI?.isCnpjValido(cnpjRaw)) return;
    try {
      const dados = await window.EnderecoAPI.buscarCNPJ(cnpjRaw);
      setHeader((h) => ({
        ...h,
        razao_social: dados.razao_social || h.razao_social,
        telefone: h.telefone || dados.telefone,
        endereco_logradouro: window.EnderecoAPI.mesclarLogradouro(h.endereco_logradouro, dados.endereco.logradouro),
        endereco_complemento: dados.endereco.complemento || h.endereco_complemento,
        endereco_bairro: dados.endereco.bairro || h.endereco_bairro,
        endereco_cep: dados.endereco.cep || h.endereco_cep,
        endereco_cidade: dados.endereco.cidade || h.endereco_cidade,
        endereco_estado: dados.endereco.estado || h.endereco_estado,
      }));
      window.toast?.('Dados do CNPJ preenchidos automaticamente.', 'success');
    } catch (e) {
      window.toast?.(e.message, 'warning');
    }
  };

  const setUnidade = (idx) => (u) => setUnidades((arr) => arr.map((x, i) => (i === idx ? u : x)));
  const addUnidade = () => setUnidades((arr) => [...arr, feNovaUnidade(`E${arr.length + 1}`)]);
  const removeUnidade = (idx) => setUnidades((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));
  /* Duplicar (15/08): copia os ~40 campos técnicos do elevador pra um card
     novo — pedido do vendedor pra quando só muda paradas/velocidade entre
     dois elevadores da mesma cotação (ex.: 2 MRL-4-paradas + 3
     MRL-6-paradas). Tira id/formulario_id/created_at/indice_ativo pra
     salvarTudo() tratar como unidade NOVA (mesma lógica de sempre: sem id
     → adicionarUnidade), com identificador/E-número seguinte. */
  const duplicarUnidade = (idx) => setUnidades((arr) => {
    const origem = arr[idx];
    const { id, formulario_id, created_at, indice_ativo, ...campos } = origem;
    const copia = { ...campos, identificador: `E${arr.length + 1}` };
    return [...arr.slice(0, idx + 1), copia, ...arr.slice(idx + 1)];
  });

  const usaClientePicker = !publicMode && !criarClienteInline;

  const validar = () => {
    if (usaClientePicker ? !clienteId : !header.razao_social?.trim()) return 'Selecione (ou cadastre) o cliente antes de continuar.';
    if (!header.local_obra_cidade?.trim() || !header.local_obra_estado?.trim()) return 'Local da obra (cidade/UF) é obrigatório.';
    if (!header.tipo_mao_de_obra) return 'Tipo de mão de obra é obrigatório.';
    if (!header.responsavel_entrega) return 'Responsável pela entrega é obrigatório.';
    if (header.endereco_obra_diferente && (!header.endereco_obra_logradouro?.trim() || !header.endereco_obra_bairro?.trim() || !header.endereco_obra_cep?.trim() || !header.endereco_obra_cidade?.trim() || !header.endereco_obra_estado?.trim())) {
      return 'Informe o endereço completo da obra (logradouro, bairro, CEP, cidade e UF).';
    }
    for (const u of unidades) {
      // Escada/esteira usam `especificacoes` (jsonb) em texto livre, sem
      // obrigatoriedade — a lista de campos "*" abaixo é específica do
      // elevador (colunas reais que outros módulos, RFQ/precificação,
      // dependem diretamente).
      if ((u.tipo_equipamento || 'elevador') !== 'elevador') continue;
      if (!u.tipo || !u.velocidade_ms || !u.paradas || !u.pavimentos_desc || !u.casa_maquinas || !u.agrupamento || !u.porta_oposta || !u.estrutura_caixa || !u.percurso_mm || !u.porta_tipo_abertura || !u.tensao_principal || !u.tensao_iluminacao) {
        return `Equipamento ${u.identificador || ''}: preencha os campos obrigatórios (*).`;
      }
    }
    return null;
  };

  /* Retorna o id salvo (não um boolean) — quem chama precisa do valor real,
     não do estado `id`, que só reflete o setId em um próximo render (issue
     #90: gerarLink chamava gerarLinkPublico(id) com o id ainda stale). */
  const salvarTudo = async (novoStatus) => {
    // Mesmo um rascunho precisa do nome — `clientes.razao_social` é NOT NULL
    // no banco, então salvar sem isso derrubava com um 400 silencioso (sem
    // toast nenhum), travando em "Cotação Nº — (gerado ao salvar)" pra
    // sempre. O resto de `validar()` continua opcional pra rascunho.
    if (usaClientePicker ? !clienteId : !header.razao_social?.trim()) {
      window.toast?.(usaClientePicker ? 'Selecione o cliente antes de salvar.' : 'Preencha o Nome/Razão Social do cliente antes de salvar.', 'warning');
      return null;
    }
    const erro = validar();
    if (novoStatus === 'enviado' && erro) { window.toast?.(erro, 'warning'); return null; }
    setSaving(true);
    try {
      let cliente = null;
      if (usaClientePicker) {
        cliente = { id: clienteId };
      } else if (!publicMode || header.cnpj || header.cpf) {
        cliente = await window.FormularioElevadorStore.buscarOuCriarCliente(header);
      }
      let currentId = id;
      if (!currentId) {
        const f = await window.FormularioElevadorStore.criar({
          ...feHeaderPick(header), cliente_id: cliente?.id, canal: publicMode ? 'self_service' : 'assistido',
          lead_id: prefillFromLead?.id || null,
        });
        currentId = f.id;
        setId(currentId);
        setNumeroCotacao(f.numero_cotacao ?? null);
      } else {
        await window.FormularioElevadorStore.salvar(currentId, { ...feHeaderPick(header), cliente_id: cliente?.id });
      }
      // Sincroniza unidades: atualiza as que já têm id, cria as que não têm —
      // e hidrata o estado com o id real de cada unidade nova (issue #91:
      // sem isso, unidade recém-criada ficava sem id em `unidades`, e o RFQ
      // ao fornecedor (que casa resposta por unidade_id) saía quebrado).
      // Sequencial de propósito: adicionarUnidade calcula indice_ativo
      // consultando as unidades já existentes, então rodar em paralelo
      // arriscaria duas unidades novas caírem no mesmo índice.
      const unidadesSalvas = [];
      for (const u of unidades) {
        const payload = { ...u };
        delete payload.id; delete payload.formulario_id; delete payload.created_at;
        if (u.id) {
          await window.FormularioElevadorStore.atualizarUnidade(u.id, payload);
          unidadesSalvas.push(u);
        } else {
          const nova = await window.FormularioElevadorStore.adicionarUnidade(currentId, payload);
          unidadesSalvas.push({ ...u, id: nova.id, indice_ativo: nova.indice_ativo });
        }
      }
      setUnidades(unidadesSalvas);
      if (novoStatus) await window.FormularioElevadorStore.enviar(currentId);
      window.toast?.(novoStatus ? 'Formulário enviado!' : 'Rascunho salvo.', 'success');
      onSaved?.(currentId);
      return currentId;
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const gerarLink = async () => {
    let currentId = id;
    if (!currentId) { currentId = await salvarTudo(null); if (!currentId) return; }
    const url = await window.FormularioElevadorStore.gerarLinkPublico(currentId);
    setLinkPublico(url);
    setShowLinkCliente(true);
  };

  /* Mesmo idioma de gerarLink acima — usado pelos anexos (FEAnexos) pra
     salvar o rascunho na hora, sem exigir clique manual em "Salvar
     Rascunho" antes de conseguir anexar um arquivo. */
  const garantirSalvo = async () => (id ? id : await salvarTudo(null));

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div className={publicMode ? 'fe-public' : 'page fade-in'}>
      {!publicMode && (
        <div className="page-head">
          <div className="page-head__l">
            <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
            <h1 className="page-head__title">Formulário — Equipamento</h1>
            <FENumeroCotacaoBadge numeroCotacao={numeroCotacao}/>
            <p className="page-head__sub">
              Coleta de dados da obra e do equipamento para envio de cotação aos fornecedores.
            </p>
          </div>
          <div className="page-head__r">
            {onVoltar && <Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button>}
            <Button variant="outline" icon="link2" onClick={gerarLink}>Link p/ cliente preencher</Button>
          </div>
        </div>
      )}
      {publicMode && (
        <div className="page-head">
          <div className="page-head__l">
            <h1 className="page-head__title">Cotação de Elevador — VerticalParts</h1>
            <FENumeroCotacaoBadge numeroCotacao={numeroCotacao}/>
            <p className="page-head__sub">
              Preencha os dados abaixo para recebermos sua cotação.
            </p>
          </div>
        </div>
      )}

      {!publicMode && showLinkCliente && linkPublico && (
        <FELinkClienteModal url={linkPublico} numeroCotacao={numeroCotacao} header={header} onClose={() => setShowLinkCliente(false)}/>
      )}

      <Card title="Dados do cliente e da obra">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Cliente</div>
            {usaClientePicker ? (
              <FEClientePicker clienteId={clienteId} onSelecionar={(c) => setClienteId(c ? c.id : null)} onCriarNovo={() => setCriarClienteInline(true)}/>
            ) : (
              <>
                <div className="grid-3" style={{ gap: 12 }}>
                  <FEField label="Tipo de pessoa"><FESelect value={header.tipo_pessoa} onChange={setH('tipo_pessoa')} options={[{ value: 'PJ', label: 'Pessoa Jurídica' }, { value: 'PF', label: 'Pessoa Física' }]}/></FEField>
                  <FEField label="Nome / Razão Social *" span="2"><FEInput value={header.razao_social} onChange={setH('razao_social')} placeholder="Nome do cliente"/></FEField>
                  {header.tipo_pessoa === 'PF'
                    ? <FEField label="CPF"><FEInput value={header.cpf} onChange={setH('cpf')} placeholder="000.000.000-00"/></FEField>
                    : <FEField label="CNPJ"><FEInput value={header.cnpj} onChange={setH('cnpj')} placeholder="00.000.000/0000-00" onBlur={() => buscarCnpjEPreencher(header.cnpj)}/></FEField>}
                  <FEField label="Inscrição Estadual"><FEInput value={header.inscricao_estadual} onChange={setH('inscricao_estadual')} disabled={header.tipo_pessoa === 'PF'}/></FEField>
                  <FEField label="Contribuinte de ICMS?"><FESelect value={header.contribuinte_icms === '' ? '' : String(header.contribuinte_icms)} onChange={(v) => setH('contribuinte_icms')(v === '' ? '' : v === 'true')} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]}/></FEField>
                  <FEField label="Telefone"><FEInput value={header.telefone} onChange={setH('telefone')}/></FEField>
                  <FEField label="E-mail" span="2"><FEInput type="email" value={header.email} onChange={setH('email')}/></FEField>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Endereço</div>
                  <FEEndereco prefix="endereco_" header={header} setH={setH} onBuscarCep={buscarCepEPreencher('endereco_')}/>
                </div>
                {!publicMode && (
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setCriarClienteInline(false); }}>voltar a buscar cliente já cadastrado</a>
                  </p>
                )}
              </>
            )}
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            <FEField label="Finalidade da compra"><FESelect value={header.finalidade_compra} onChange={setH('finalidade_compra')} options={FE_FINALIDADE_COMPRA}/></FEField>
          </div>
          {header.finalidade_compra === 'revenda' && header.contribuinte_icms === false && (
            <p style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #FBB039', padding: '8px 12px', margin: 0 }}>
              Atenção: Não Contribuintes do ICMS não podem comprar mercadorias com finalidade de Revenda.
            </p>
          )}
          <div className="grid-3" style={{ gap: 12 }}>
            <FEField label="Cidade da obra *"><FEInput value={header.local_obra_cidade} onChange={setH('local_obra_cidade')}/></FEField>
            <FEField label="UF da obra *"><FEInput value={header.local_obra_estado} onChange={setH('local_obra_estado')} placeholder="SP"/></FEField>
            <FEField label="Prazo mínimo desejado em obra"><FEInput value={header.prazo_desejado} onChange={setH('prazo_desejado')} placeholder="3 a 4 meses"/></FEField>
            <FEField label="Tipo de mão de obra *"><FESelect value={header.tipo_mao_de_obra} onChange={setH('tipo_mao_de_obra')} options={FE_MAO_DE_OBRA}/></FEField>
            <FEField label="Responsável pela entrega *"><FESelect value={header.responsavel_entrega} onChange={setH('responsavel_entrega')} options={FE_RESPONSAVEL_ENTREGA}/></FEField>
            {!publicMode && <FEField label="Origem da venda"><FESelect value={header.origem_venda} onChange={setH('origem_venda')} options={FE_ORIGEM_VENDA}/></FEField>}
            {!publicMode && <FEField label="Vendedor"><FEInput value={header.vendedor} onChange={setH('vendedor')} placeholder="Iniciais ou nome"/></FEField>}
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Condições</div>
            <div className="stack" style={{ gap: 10 }}>
              <FEField label="Equipamento será instalado em endereço diferente?">
                <div className="seg">
                  <button type="button" className={!header.endereco_obra_diferente ? 'is-active' : ''} onClick={() => setH('endereco_obra_diferente')(false)}>Não</button>
                  <button type="button" className={header.endereco_obra_diferente ? 'is-active' : ''} onClick={() => setH('endereco_obra_diferente')(true)}>Sim</button>
                </div>
              </FEField>
              {!header.endereco_obra_diferente && (
                <p style={{ fontSize: 12, color: 'var(--fg3)', margin: 0 }}>A obra usará o mesmo endereço já informado acima.</p>
              )}
              {header.endereco_obra_diferente && (
                <div>
                  <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Endereço da obra</div>
                  <FEEndereco prefix="endereco_obra_" header={header} setH={setH} requiredLogradouro onBuscarCep={buscarCepEPreencher('endereco_obra_')}/>
                </div>
              )}
            </div>
          </div>
          <FEField label="Observações"><textarea className="input" rows={2} value={header.observacoes || ''} onChange={(e) => setH('observacoes')(e.target.value)}/></FEField>
        </div>
      </Card>

      {/* Sem `id &&`: um formulário novo (ainda não salvo) também mostra
          estas seções — FEAnexos salva o rascunho na hora, por trás, se o
          vendedor tentar anexar antes do 1º "Salvar Rascunho" manual. */}
      <div className="stack" style={{ gap: 16, marginTop: 16 }}>
        <FEAnexos formularioId={id} categoria="projeto_civil" titulo="Projeto Civil da Obra"
          descricao="Anexe a planta, o memorial descritivo ou o projeto civil (PDF, DWG, imagem) — a equipe usa esses dados para extrair as medidas do elevador."
          podeAnexar={publicMode} garantirSalvo={garantirSalvo}/>
        {!publicMode && (
          <FEAnexos formularioId={id} categoria="fornecedor" titulo="Anexos para o Fornecedor"
            descricao="PDF, DWG ou fotos que devem ir junto com a cotação técnica ao fornecedor (ex.: planta, foto do local) — aparecem no link público que o fornecedor recebe."
            podeAnexar={true} garantirSalvo={garantirSalvo}/>
        )}
      </div>

      {/* fieldset disabled trava toda edição de unidades (campos, select, +/-
          adicionar/remover) enquanto salvarTudo está em voo — sem isso, dava
          pra editar `unidades` no meio do save e o setUnidades(unidadesSalvas)
          no final sobrescrevia essas edições com o snapshot antigo (achado
          do Codex no PR #167, issue #91). */}
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
        {unidades.map((u, i) => (
          <div key={u.id || i} style={{ marginTop: 16 }}>
            <FEUnidadeCard unidade={u} index={i} onChange={setUnidade(i)} onRemove={() => removeUnidade(i)} onDuplicate={() => duplicarUnidade(i)} fornecedores={fornecedoresOptions} modelos={modelos} publicMode={publicMode} numeroCotacao={numeroCotacao}/>
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <Button variant="outline" icon="plus" onClick={addUnidade}>+ Adicionar equipamento diferente</Button>
        </div>
      </fieldset>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <div className="row gap-2">
          <Button variant="outline" onClick={() => salvarTudo(null)} disabled={saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" onClick={() => salvarTudo('enviado')} disabled={saving}>{saving ? 'Enviando…' : 'Enviar para Cotação'}</Button>
        </div>
      </div>

      {!publicMode && (id || onControleCotacoes) && (
        <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'center' }}>
          {id && <Button variant="ghost" icon="send" onClick={() => setShowCotacaoFornecedor(true)}>Enviar cotação a fornecedores</Button>}
          {id && (
            <Button variant="ghost" icon="calculator" title="Preço já combinado por fora (CEO/Financeiro) — a Proposta já nasce agora, com o preço em aberto pra preencher"
              onClick={async () => {
                if (!unidades.length) { window.toast?.('Adicione ao menos um equipamento antes de enviar.', 'warning'); return; }
                if (!window.confirm('A proposta nasce agora, mesmo sem preço — alguém preenche o valor depois (na própria Proposta ou pela fila de Precificação). Confirma?')) return;
                try {
                  await window.FormularioElevadorStore.enviarDiretoParaPrecificacao(id);
                  /* Proposta nasce na hora, já com cliente/obra/equipamento —
                     preço fica em aberto (0) até alguém preencher, na própria
                     Proposta ou via Precificação depois (herdar() no editor
                     "auto-preenche" quando reaberta, sem sobrescrever o que
                     já foi digitado — pedido do usuário, 19/08). */
                  if (window.PropostaHeranca && numeroCotacao) {
                    const r = await window.PropostaHeranca.prefillPorNumeroCotacao(numeroCotacao);
                    if (r.encontrado) {
                      const numero = window.MasterIdEngine.baseId('elevador', numeroCotacao);
                      const salvo = await window.PropostaStore.salvar({ data: { ...r.prefill, numero }, eq: 'elevador', editId: null, valorTotal: 0 });
                      if (salvo?.erro) window.toast?.('Enviado, mas não consegui criar a Proposta agora: ' + salvo.erro, 'warning');
                      else window.toast?.('Proposta criada, aguardando preço.', 'success');
                    } else {
                      window.toast?.('Enviado — não consegui montar a Proposta agora, mas ela pode ser criada depois.', 'warning');
                    }
                  }
                } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
              }}>Enviar direto para Precificação</Button>
          )}
          {onControleCotacoes && <Button variant="ghost" icon="history" onClick={onControleCotacoes}>Controle de Cotações</Button>}
        </div>
      )}

      {showCotacaoFornecedor && (
        <FECotacaoFornecedorModal formularioId={id} unidades={unidades} numeroCotacao={numeroCotacao} onClose={() => setShowCotacaoFornecedor(false)}/>
      )}
    </div>
  );
}

/* ---------- Wrapper interno (rota "formulario-elevador") ---------- */
function FormularioElevadorPage({ setRoute, subsel }) {
  const prefillFromLead = subsel && typeof subsel === 'object' ? subsel.__prefillFromLead : null;
  return (
    <FormularioElevadorForm
      formularioId={typeof subsel === 'string' ? subsel : null}
      prefillFromLead={prefillFromLead}
      onVoltar={() => setRoute('formularios')}
      onSaved={() => {}}
      onControleCotacoes={() => setRoute('controle-cotacoes')}
    />
  );
}

window.FormularioElevadorForm = FormularioElevadorForm;
