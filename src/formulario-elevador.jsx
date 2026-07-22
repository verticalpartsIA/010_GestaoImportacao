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

const FE_OPCOES_VAZIAS = { teto_falso: [], piso: [], porta: [], botoeira_cabine: [], botoeira_pavimento: [] };

/* ---------- Card de uma Unidade (um elevador) ---------- */
function FEUnidadeCard({ unidade, index, onChange, onRemove, fornecedores, modelos, publicMode }) {
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
            <div className={publicMode ? 'grid-3' : 'grid-4'} style={{ gap: 12 }}>
              <FEField label="Identificador (E1, E2...)"><FEInput value={unidade.identificador} onChange={set('identificador')} placeholder="E1"/></FEField>
              <FEField label="Tipo *"><FESelect value={unidade.tipo} onChange={set('tipo')} options={FE_TIPOS}/></FEField>
              <FEField label="Modelo"><FESelect value={unidade.modelo} onChange={set('modelo')} options={modelosDisponiveis.map((m) => ({ value: m.codigo, label: `${m.codigo} — ${m.nome}` }))} placeholder="— selecione o modelo —"/></FEField>
              <FEField label="Norma de projeto"><FESelect value={unidade.norma_projeto} onChange={set('norma_projeto')} options={FE_NORMAS}/></FEField>
              {!publicMode && <FEField label="Fornecedor"><FESelect value={unidade.fornecedor} onChange={set('fornecedor')} options={fornecedores || []}/></FEField>}
            </div>
            {!unidade.modelo && (
              <p style={{ fontSize: 12, color: 'var(--fg3)', margin: '8px 0 0' }}>Selecione o modelo do elevador para ver as opções disponíveis de teto falso, piso, porta e botoeiras.</p>
            )}
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
const FE_CEF_STATUS_LABEL = { rascunho: 'Rascunho', enviado: 'Enviado', visualizado: 'Visualizado', respondido: 'Respondido', expirado: 'Expirado' };
const FE_CEF_STATUS_COR = { rascunho: '#64748b', enviado: '#2563eb', visualizado: '#b45309', respondido: '#059669', expirado: '#9f1239' };
function FECefStatusChip({ status }) {
  return <span className="la-setor" style={{ background: FE_CEF_STATUS_COR[status] || '#64748b' }}>{FE_CEF_STATUS_LABEL[status] || status}</span>;
}

function FECotacaoRespostaModal({ cot, onClose }) {
  const r = cot.respostas || {};
  const itens = r.itens || [];
  return (
    <Modal title={`Resposta de ${cot.fornecedor} — ${cot.numero_documento}`} onClose={onClose} width={760}
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
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="t">
          <thead><tr><th>Unidade</th><th>Modelo (fornecedor)</th><th>Andares/Paradas/Portas</th><th>Preço unit.</th><th>Preço total</th><th>Confirmação técnica</th></tr></thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i}>
                <td className="mono small">{it.unidade_identificador || it.unidade_id}</td>
                <td>{it.modelo_fornecedor || '—'}</td>
                <td>{it.floors_stops_doors || '—'}</td>
                <td><b>{it.preco_unitario || '—'}</b></td>
                <td><b>{it.preco_total || '—'}</b></td>
                <td className="small muted">{it.confirmacao_tecnica || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.observacoes_gerais && (
        <div style={{ marginTop: 12 }}>
          <span className="up-eyebrow muted">Observações gerais</span>
          <p className="small" style={{ marginTop: 4 }}>{r.observacoes_gerais}</p>
        </div>
      )}
    </Modal>
  );
}

function FECotacaoFornecedorGrupo({ grupo, cot, onEnviar, enviando }) {
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
          <Button variant="outline" size="sm" icon="fileText" onClick={() => setVerResp(true)}>Ver resposta do fornecedor</Button>
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

function FECotacaoFornecedorModal({ formularioId, unidades, onClose }) {
  const store = window.CotacaoElevadorFornecedorStore;
  const [cotacoes, setCotacoes] = React.useState([]);
  const [enviando, setEnviando] = React.useState(null);

  const reload = () => store.listarPorFormulario(formularioId).then(setCotacoes).catch(() => {});
  React.useEffect(() => { reload(); }, [formularioId]);

  const grupos = React.useMemo(() => {
    const map = {};
    unidades.filter((u) => u.id && u.fornecedor).forEach((u) => {
      const tipoFormulario = store.tipoFormularioPara(u.tipo);
      const key = `${u.fornecedor}|${tipoFormulario}`;
      if (!map[key]) map[key] = { fornecedor: u.fornecedor, tipoFormulario, unidades: [] };
      map[key].unidades.push(u);
    });
    return Object.values(map);
  }, [unidades]);

  const cotacaoDoGrupo = (g) => cotacoes.find((c) => c.fornecedor === g.fornecedor && c.tipo_formulario === g.tipoFormulario);

  const enviar = async (grupo, canal, recipient) => {
    const key = `${grupo.fornecedor}|${grupo.tipoFormulario}`;
    setEnviando(key);
    try {
      let cot = cotacaoDoGrupo(grupo);
      if (!cot) cot = await store.gerar(formularioId, grupo.unidades, grupo.fornecedor);
      const url = store.cotacaoUrl(cot.token);
      const msg = `Solicitação de cotação técnica ${cot.numero_documento} — VerticalParts\n` +
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
        <FECotacaoFornecedorGrupo key={`${g.fornecedor}|${g.tipoFormulario}`} grupo={g} cot={cotacaoDoGrupo(g)} onEnviar={enviar} enviando={enviando}/>
      ))}
    </Modal>
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
  return h;
}

/* ---------- Página / componente principal ---------- */
function FormularioElevadorForm({ formularioId, publicMode, onSaved, onVoltar, onControleCotacoes }) {
  const [loading, setLoading] = React.useState(!!formularioId);
  const [saving, setSaving] = React.useState(false);
  const [id, setId] = React.useState(formularioId || null);
  const [header, setHeader] = React.useState(feHeaderDefaults());
  const [unidades, setUnidades] = React.useState([feNovaUnidade('E1')]);
  const [linkPublico, setLinkPublico] = React.useState(null);
  const [numeroCotacao, setNumeroCotacao] = React.useState(null);
  const [fornecedores, setFornecedores] = React.useState([]);
  const [modelos, setModelos] = React.useState([]);
  const [showCotacaoFornecedor, setShowCotacaoFornecedor] = React.useState(false);

  React.useEffect(() => {
    if (publicMode) return;
    window.FormularioElevadorStore.listarFornecedores().then(setFornecedores).catch(() => {});
  }, [publicMode]);

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
      if (f.unidades && f.unidades.length) setUnidades(f.unidades);
      setLoading(false);
    }).catch((e) => { window.toast?.('Erro ao carregar formulário: ' + e.message, 'error'); setLoading(false); });
  }, [formularioId]);

  const setH = (k) => (v) => setHeader((h) => ({ ...h, [k]: v }));

  /* Autopreenchimento por CEP — melhor fonte, pois não depende de o CNPJ
     "bater" com o endereço real. Preenche mas deixa os campos editáveis. */
  const buscarCepEPreencher = (prefix) => async (cepRaw) => {
    if (!window.EnderecoAPI?.isCepValido(cepRaw)) return;
    try {
      const dados = await window.EnderecoAPI.buscarCEP(cepRaw);
      setHeader((h) => ({
        ...h,
        [`${prefix}logradouro`]: dados.logradouro || h[`${prefix}logradouro`],
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
        endereco_logradouro: dados.endereco.logradouro || h.endereco_logradouro,
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
        setNumeroCotacao(f.numero_cotacao ?? null);
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
            <p className="page-head__sub">
              Coleta de dados da obra e do equipamento para envio de cotação aos fornecedores.
              {numeroCotacao != null && <span className="mono" style={{ marginLeft: 8 }}>· Cotação Nº {numeroCotacao}</span>}
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
              : <FEField label="CNPJ"><FEInput value={header.cnpj} onChange={setH('cnpj')} placeholder="00.000.000/0000-00" onBlur={() => buscarCnpjEPreencher(header.cnpj)}/></FEField>}
            <FEField label="Inscrição Estadual"><FEInput value={header.inscricao_estadual} onChange={setH('inscricao_estadual')} disabled={header.tipo_pessoa === 'PF'}/></FEField>
            <FEField label="Contribuinte de ICMS?"><FESelect value={header.contribuinte_icms === '' ? '' : String(header.contribuinte_icms)} onChange={(v) => setH('contribuinte_icms')(v === '' ? '' : v === 'true')} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]}/></FEField>
            <FEField label="Telefone"><FEInput value={header.telefone} onChange={setH('telefone')}/></FEField>
            <FEField label="E-mail" span="2"><FEInput type="email" value={header.email} onChange={setH('email')}/></FEField>
          </div>
          <div>
            <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>Endereço</div>
            <FEEndereco prefix="endereco_" header={header} setH={setH} onBuscarCep={buscarCepEPreencher('endereco_')}/>
          </div>
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

      {unidades.map((u, i) => (
        <div key={u.id || i} style={{ marginTop: 16 }}>
          <FEUnidadeCard unidade={u} index={i} onChange={setUnidade(i)} onRemove={() => removeUnidade(i)} fornecedores={fornecedores} modelos={modelos} publicMode={publicMode}/>
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <Button variant="outline" icon="plus" onClick={addUnidade}>+ Adicionar elevador</Button>
        <div className="row gap-2">
          <Button variant="outline" onClick={() => salvarTudo(null)} disabled={saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" onClick={() => salvarTudo('enviado')} disabled={saving}>{saving ? 'Enviando…' : 'Enviar para Cotação'}</Button>
        </div>
      </div>

      {!publicMode && (id || onControleCotacoes) && (
        <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'center' }}>
          {id && <Button variant="ghost" icon="send" onClick={() => setShowCotacaoFornecedor(true)}>Enviar cotação a fornecedores</Button>}
          {onControleCotacoes && <Button variant="ghost" icon="history" onClick={onControleCotacoes}>Controle de Cotações</Button>}
        </div>
      )}

      {showCotacaoFornecedor && (
        <FECotacaoFornecedorModal formularioId={id} unidades={unidades} onClose={() => setShowCotacaoFornecedor(false)}/>
      )}
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
      onControleCotacoes={() => setRoute('controle-cotacoes')}
    />
  );
}

window.FormularioElevadorForm = FormularioElevadorForm;
