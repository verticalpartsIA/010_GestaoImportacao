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

function feNovaUnidade(identificador) {
  return {
    identificador: identificador || '',
    tipo: '', capacidade_kg: '', capacidade_pessoas: '', velocidade_ms: '',
    paradas: '', pavimentos_desc: '', casa_maquinas: '', agrupamento: '', porta_oposta: '',
    estrutura_caixa: '', caixa_largura_mm: '', caixa_profundidade_mm: '',
    percurso_mm: '', overhead_mm: '', poco_mm: '',
    cabina_largura_mm: '', cabina_profundidade_mm: '', cabina_altura_mm: '', piso_cabina: '', corrimao: '',
    porta_tipo_abertura: '', porta_largura_mm: '', porta_altura_mm: '',
    acabamento_porta_cabina: '', acabamento_porta_pavimento: '', classe_corta_fogo: '',
    tensao_principal: '', tensao_iluminacao: '', norma_projeto: '',
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
function FEInput({ value, onChange, placeholder, type = 'text', disabled }) {
  return <input className="input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}/>;
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
function FEEndereco({ prefix, header, setH, requiredLogradouro }) {
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
        <FEInput value={header[k('cep')]} onChange={setH(k('cep'))} placeholder="07140-000"/>
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

/* ---------- Card de uma Unidade (um elevador) ---------- */
function FEUnidadeCard({ unidade, index, onChange, onRemove }) {
  const [open, setOpen] = React.useState(true);
  const set = (k) => (v) => onChange({ ...unidade, [k]: v });
  return (
    <Card
      title={`Elevador ${unidade.identificador || index + 1}`}
      sub={unidade.tipo || 'Tipo não definido'}
      action={
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon={open ? 'chevUp' : 'chevDown'} onClick={() => setOpen((o) => !o)}/>
          <Button variant="ghost" size="sm" icon="trash" onClick={onRemove}>Remover</Button>
        </div>
      }
    >
      {open && (
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Identificação do elevador</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Identificador (E1, E2...)"><FEInput value={unidade.identificador} onChange={set('identificador')} placeholder="E1"/></FEField>
              <FEField label="Tipo *"><FESelect value={unidade.tipo} onChange={set('tipo')} options={FE_TIPOS}/></FEField>
              <FEField label="Norma de projeto"><FESelect value={unidade.norma_projeto} onChange={set('norma_projeto')} options={FE_NORMAS}/></FEField>
              <FEField label="Capacidade (kg)"><FEInput type="number" value={unidade.capacidade_kg} onChange={set('capacidade_kg')} placeholder="630"/></FEField>
              <FEField label="Capacidade (passageiros)"><FEInput type="number" value={unidade.capacidade_pessoas} onChange={set('capacidade_pessoas')} placeholder="8"/></FEField>
              <FEField label="Velocidade (m/s) *"><FEInput type="number" value={unidade.velocidade_ms} onChange={set('velocidade_ms')} placeholder="1.0"/></FEField>
              <FEField label="Paradas *"><FEInput type="number" value={unidade.paradas} onChange={set('paradas')} placeholder="4"/></FEField>
              <FEField label="Descrição dos pavimentos *" span="2"><FEInput value={unidade.pavimentos_desc} onChange={set('pavimentos_desc')} placeholder="Térreo, 1, 2, 3"/></FEField>
              <FEField label="Casa de máquinas *"><FESelect value={unidade.casa_maquinas} onChange={set('casa_maquinas')} options={[{ value: 'com', label: 'Com casa de máquinas' }, { value: 'sem', label: 'Sem casa de máquinas (MRL)' }]}/></FEField>
              <FEField label="Agrupamento *"><FESelect value={unidade.agrupamento} onChange={set('agrupamento')} options={[{ value: 'simplex', label: 'Simplex' }, { value: 'duplex', label: 'Duplex' }, { value: 'triplex', label: 'Triplex' }, { value: 'group', label: 'Group control' }]}/></FEField>
              <FEField label="Porta oposta / múltiplas entradas *"><FEInput value={unidade.porta_oposta} onChange={set('porta_oposta')} placeholder="Não / Sim - 180°"/></FEField>
            </div>
          </div>

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
              <FEField label="Piso da cabina"><FEInput value={unidade.piso_cabina} onChange={set('piso_cabina')} placeholder="PVC / Mármore / Inox antiderrapante"/></FEField>
              <FEField label="Corrimão"><FEInput value={unidade.corrimao} onChange={set('corrimao')} placeholder="Não / Sim - traseiro"/></FEField>
            </div>
          </div>

          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Portas <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tipo obrigatório, resto opcional</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="Tipo de abertura *"><FESelect value={unidade.porta_tipo_abertura} onChange={set('porta_tipo_abertura')} options={['Central', 'Lateral', 'Telescópica']}/></FEField>
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
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Opcionais <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tudo opcional</span></div>
            <div className="grid-3" style={{ gap: 12 }}>
              <FEField label="COP/LOP — tipo"><FEInput value={unidade.cop_lop_tipo} onChange={set('cop_lop_tipo')}/></FEField>
              <div className="stack" style={{ gap: 8, justifyContent: 'center' }}>
                <FECheck label="ARD — resgate automático" checked={unidade.ard} onChange={set('ard')}/>
                <FECheck label="Câmera na cabine" checked={unidade.camera} onChange={set('camera')}/>
                <FECheck label="Anúncio de voz" checked={unidade.anuncio_voz} onChange={set('anuncio_voz')}/>
              </div>
              <FEField label="Exigências especiais" span="3"><textarea className="input" rows={2} value={unidade.exigencias_especiais || ''} onChange={(e) => set('exigencias_especiais')(e.target.value)}/></FEField>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* Únicos campos que realmente pertencem ao header (formularios_elevador) —
   usado tanto pra filtrar o que vem do banco (obter() também traz id, token,
   status, unidades...) quanto pra montar o payload de save. Sem esse filtro,
   reabrir um rascunho e salvar de novo reenviava colunas inexistentes
   (ex.: `unidades`) e o update quebrava. */
const FE_HEADER_KEYS = [
  'tipo_pessoa', 'razao_social', 'cnpj', 'cpf', 'inscricao_estadual', 'contribuinte_icms',
  'endereco', 'endereco_logradouro', 'endereco_complemento', 'endereco_bairro', 'endereco_cep', 'endereco_cidade', 'endereco_estado',
  'telefone', 'email',
  'local_obra_cidade', 'local_obra_estado', 'endereco_obra_diferente',
  'endereco_obra', 'endereco_obra_logradouro', 'endereco_obra_complemento', 'endereco_obra_bairro', 'endereco_obra_cep', 'endereco_obra_cidade', 'endereco_obra_estado',
  'prazo_desejado',
  'tipo_mao_de_obra', 'responsavel_entrega', 'origem_venda', 'observacoes',
];
function feHeaderDefaults() {
  const h = {};
  FE_HEADER_KEYS.forEach((k) => { h[k] = k === 'endereco_obra_diferente' ? false : ''; });
  return h;
}
function feHeaderPick(obj) {
  const h = {};
  FE_HEADER_KEYS.forEach((k) => { if (obj[k] !== undefined) h[k] = obj[k]; });
  return h;
}

/* ---------- Página / componente principal ---------- */
function FormularioElevadorForm({ formularioId, publicMode, onSaved, onVoltar }) {
  const [loading, setLoading] = React.useState(!!formularioId);
  const [saving, setSaving] = React.useState(false);
  const [id, setId] = React.useState(formularioId || null);
  const [header, setHeader] = React.useState(feHeaderDefaults());
  const [unidades, setUnidades] = React.useState([feNovaUnidade('E1')]);
  const [linkPublico, setLinkPublico] = React.useState(null);

  React.useEffect(() => {
    if (!formularioId) return;
    setLoading(true);
    window.FormularioElevadorStore.obter(formularioId).then((f) => {
      setId(f.id);
      setHeader((h) => ({ ...h, ...feHeaderPick(f) }));
      if (f.unidades && f.unidades.length) setUnidades(f.unidades);
      setLoading(false);
    }).catch((e) => { window.toast?.('Erro ao carregar formulário: ' + e.message, 'error'); setLoading(false); });
  }, [formularioId]);

  const setH = (k) => (v) => setHeader((h) => ({ ...h, [k]: v }));
  const setUnidade = (idx) => (u) => setUnidades((arr) => arr.map((x, i) => (i === idx ? u : x)));
  const addUnidade = () => setUnidades((arr) => [...arr, feNovaUnidade(`E${arr.length + 1}`)]);
  const removeUnidade = (idx) => setUnidades((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  const validar = () => {
    if (!header.razao_social?.trim()) return 'Nome/Razão Social do cliente é obrigatório.';
    if (!header.local_obra_cidade?.trim() || !header.local_obra_estado?.trim()) return 'Local da obra (cidade/UF) é obrigatório.';
    if (!header.tipo_mao_de_obra) return 'Tipo de mão de obra é obrigatório.';
    if (!header.responsavel_entrega) return 'Responsável pela entrega é obrigatório.';
    if (header.endereco_obra_diferente && (!header.endereco_obra_logradouro?.trim() || !header.endereco_obra_bairro?.trim() || !header.endereco_obra_cep?.trim() || !header.endereco_obra_cidade?.trim() || !header.endereco_obra_estado?.trim())) {
      return 'Informe o endereço completo da obra (logradouro, bairro, CEP, cidade e UF).';
    }
    for (const u of unidades) {
      if (!u.tipo || !u.velocidade_ms || !u.paradas || !u.pavimentos_desc || !u.casa_maquinas || !u.agrupamento || !u.porta_oposta || !u.estrutura_caixa || !u.percurso_mm || !u.porta_tipo_abertura || !u.tensao_principal || !u.tensao_iluminacao) {
        return `Elevador ${u.identificador || ''}: preencha os campos obrigatórios (*).`;
      }
    }
    return null;
  };

  const salvarTudo = async (novoStatus) => {
    const erro = validar();
    if (novoStatus === 'enviado' && erro) { window.toast?.(erro, 'warning'); return false; }
    setSaving(true);
    try {
      let cliente = null;
      if (!publicMode || header.cnpj || header.cpf) {
        cliente = await window.FormularioElevadorStore.buscarOuCriarCliente(header);
      }
      let currentId = id;
      if (!currentId) {
        const f = await window.FormularioElevadorStore.criar({
          ...feHeaderPick(header), cliente_id: cliente?.id, canal: publicMode ? 'self_service' : 'assistido',
        });
        currentId = f.id;
        setId(currentId);
      } else {
        await window.FormularioElevadorStore.salvar(currentId, { ...feHeaderPick(header), cliente_id: cliente?.id });
      }
      // sincroniza unidades: atualiza as que já têm id, cria as que não têm
      for (const u of unidades) {
        const payload = { ...u };
        delete payload.id; delete payload.formulario_id; delete payload.created_at;
        if (u.id) await window.FormularioElevadorStore.atualizarUnidade(u.id, payload);
        else await window.FormularioElevadorStore.adicionarUnidade(currentId, payload);
      }
      if (novoStatus) await window.FormularioElevadorStore.enviar(currentId);
      window.toast?.(novoStatus ? 'Formulário enviado!' : 'Rascunho salvo.', 'success');
      onSaved?.(currentId);
      return true;
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const gerarLink = async () => {
    if (!id) { const ok = await salvarTudo(null); if (!ok) return; }
    const url = await window.FormularioElevadorStore.gerarLinkPublico(id);
    setLinkPublico(url);
    navigator.clipboard?.writeText(url).then(() => window.toast?.('Link copiado!', 'success')).catch(() => {});
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div className={publicMode ? 'fe-public' : 'page fade-in'}>
      {!publicMode && (
        <div className="page-head">
          <div className="page-head__l">
            <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
            <h1 className="page-head__title">Formulário — Elevador</h1>
            <p className="page-head__sub">Coleta de dados da obra e do equipamento para envio de cotação aos fornecedores.</p>
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
            <p className="page-head__sub">Preencha os dados abaixo para recebermos sua cotação.</p>
          </div>
        </div>
      )}

      {linkPublico && (
        <div style={{ background: '#fffbeb', border: '1px solid #FBB039', padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          Link copiado: <span className="mono">{linkPublico}</span>
        </div>
      )}

      <Card title="Dados do cliente e da obra">
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid-3" style={{ gap: 12 }}>
            <FEField label="Tipo de pessoa"><FESelect value={header.tipo_pessoa} onChange={setH('tipo_pessoa')} options={[{ value: 'PJ', label: 'Pessoa Jurídica' }, { value: 'PF', label: 'Pessoa Física' }]}/></FEField>
            <FEField label="Nome / Razão Social *" span="2"><FEInput value={header.razao_social} onChange={setH('razao_social')} placeholder="Nome do cliente"/></FEField>
            {header.tipo_pessoa === 'PF'
              ? <FEField label="CPF"><FEInput value={header.cpf} onChange={setH('cpf')} placeholder="000.000.000-00"/></FEField>
              : <FEField label="CNPJ"><FEInput value={header.cnpj} onChange={setH('cnpj')} placeholder="00.000.000/0000-00"/></FEField>}
            <FEField label="Inscrição Estadual"><FEInput value={header.inscricao_estadual} onChange={setH('inscricao_estadual')} disabled={header.tipo_pessoa === 'PF'}/></FEField>
            <FEField label="Contribuinte de ICMS?"><FESelect value={header.contribuinte_icms === '' ? '' : String(header.contribuinte_icms)} onChange={(v) => setH('contribuinte_icms')(v === '' ? '' : v === 'true')} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]}/></FEField>
            <FEField label="Telefone"><FEInput value={header.telefone} onChange={setH('telefone')}/></FEField>
            <FEField label="E-mail" span="2"><FEInput type="email" value={header.email} onChange={setH('email')}/></FEField>
          </div>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Endereço</div>
            <FEEndereco prefix="endereco_" header={header} setH={setH}/>
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            <FEField label="Cidade da obra *"><FEInput value={header.local_obra_cidade} onChange={setH('local_obra_cidade')}/></FEField>
            <FEField label="UF da obra *"><FEInput value={header.local_obra_estado} onChange={setH('local_obra_estado')} placeholder="SP"/></FEField>
            <FEField label="Prazo mínimo desejado em obra"><FEInput value={header.prazo_desejado} onChange={setH('prazo_desejado')} placeholder="3 a 4 meses"/></FEField>
            <FEField label="Tipo de mão de obra *"><FESelect value={header.tipo_mao_de_obra} onChange={setH('tipo_mao_de_obra')} options={FE_MAO_DE_OBRA}/></FEField>
            <FEField label="Responsável pela entrega *"><FESelect value={header.responsavel_entrega} onChange={setH('responsavel_entrega')} options={FE_RESPONSAVEL_ENTREGA}/></FEField>
            {!publicMode && <FEField label="Origem da venda"><FESelect value={header.origem_venda} onChange={setH('origem_venda')} options={FE_ORIGEM_VENDA}/></FEField>}
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
                  <FEEndereco prefix="endereco_obra_" header={header} setH={setH} requiredLogradouro/>
                </div>
              )}
            </div>
          </div>
          <FEField label="Observações"><textarea className="input" rows={2} value={header.observacoes || ''} onChange={(e) => setH('observacoes')(e.target.value)}/></FEField>
        </div>
      </Card>

      {unidades.map((u, i) => (
        <div key={u.id || i} style={{ marginTop: 16 }}>
          <FEUnidadeCard unidade={u} index={i} onChange={setUnidade(i)} onRemove={() => removeUnidade(i)}/>
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <Button variant="outline" icon="plus" onClick={addUnidade}>+ Adicionar elevador</Button>
        <div className="row gap-2">
          <Button variant="outline" onClick={() => salvarTudo(null)} disabled={saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" onClick={() => salvarTudo('enviado')} disabled={saving}>{saving ? 'Enviando…' : 'Enviar para Cotação'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Wrapper interno (rota "formulario-elevador") ---------- */
function FormularioElevadorPage({ setRoute, subsel }) {
  return (
    <FormularioElevadorForm
      formularioId={typeof subsel === 'string' ? subsel : null}
      onVoltar={() => setRoute('formularios')}
      onSaved={() => {}}
    />
  );
}

window.FormularioElevadorForm = FormularioElevadorForm;
