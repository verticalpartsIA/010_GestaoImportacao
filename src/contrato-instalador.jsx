/* ============================================================
   contrato-instalador.jsx
   ContratoInstaladorPage — wizard + dashboard + send modal,
   tudo integrado e persistindo no Supabase vpprd.
   ============================================================ */
const { useState: _ciUS, useEffect: _ciUE, useMemo: _ciUM, useRef: _ciUR } = React;

/* ============================================================
   FORM FIELDS (compartilhados pelo wizard)
   ============================================================ */
function CIField({ label, value, onChange, placeholder, mask, error, hint, required, mono, width }) {
  const handle = (e) => {
    let v = e.target.value;
    if (mask && window.CI[mask]) v = window.CI[mask](v);
    onChange(v);
  };
  return (
    <div className={'ci-field' + (width ? ' ci-field--' + width : '')}>
      <label>{label}{required && <span className="ci-req">*</span>}</label>
      <input
        className={'ci-input' + (mono ? ' ci-input--mono' : '') + (error ? ' ci-input--error' : '')}
        value={value || ''}
        onChange={handle}
        placeholder={placeholder}
        inputMode={mask === 'maskMoeda' || mask === 'maskCNPJ' || mask === 'maskCPF' || mask === 'maskCEP' ? 'numeric' : undefined}
      />
      {error ? <span className="ci-field-err">{error}</span> : (hint ? <span className="ci-field-hint">{hint}</span> : null)}
    </div>
  );
}

function CIMoneyField({ label, value, onChange, error, hint, required, width }) {
  const handle = (e) => onChange(window.CI.maskMoeda(e.target.value));
  const num = window.CI.moedaParaNumero(value);
  return (
    <div className={'ci-field' + (width ? ' ci-field--' + width : '')}>
      <label>{label}{required && <span className="ci-req">*</span>}</label>
      <div className={'ci-input ci-input--prefix' + (error ? ' ci-input--error' : '')}>
        <span className="ci-input-prefix">R$</span>
        <input className="ci-input-bare ci-input--mono" value={value || ''} onChange={handle} placeholder="0,00" inputMode="numeric" />
      </div>
      {num > 0 && <span className="ci-field-extenso">{window.CI.valorExtenso(num)}</span>}
      {error ? <span className="ci-field-err">{error}</span> : (hint ? <span className="ci-field-hint">{hint}</span> : null)}
    </div>
  );
}

function CITextArea({ label, value, onChange, placeholder, rows, hint }) {
  return (
    <div className="ci-field ci-field--full">
      <label>{label}</label>
      <textarea className="ci-input ci-textarea" rows={rows || 3} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}></textarea>
      {hint && <span className="ci-field-hint">{hint}</span>}
    </div>
  );
}

function CISelect({ label, value, onChange, options, width }) {
  return (
    <div className={'ci-field' + (width ? ' ci-field--' + width : '')}>
      <label>{label}</label>
      <div className="ci-select-wrap">
        <select className="ci-input ci-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="ci-select-caret">▾</span>
      </div>
    </div>
  );
}

function CIRadioCards({ value, onChange, options, columns }) {
  return (
    <div className="ci-radio-cards" style={{ gridTemplateColumns: `repeat(${columns || options.length}, 1fr)` }}>
      {options.map(o => (
        <button key={o.id} type="button"
          className={'ci-radio-card' + (value === o.id ? ' ci-radio-card--on' : '')}
          onClick={() => onChange(o.id)}>
          <span className="ci-radio-card-dot"></span>
          <span className="ci-radio-card-label">{o.label}</span>
          {o.desc && <span className="ci-radio-card-desc">{o.desc}</span>}
        </button>
      ))}
    </div>
  );
}

function CISegmented({ value, onChange, options }) {
  return (
    <div className="ci-segmented">
      {options.map(o => (
        <button key={o.value} type="button"
          className={'ci-seg' + (value === o.value ? ' ci-seg--on' : '')}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function CICheckRow({ checked, onChange, label }) {
  return (
    <button type="button" className={'ci-check-row' + (checked ? ' ci-check-row--on' : '')} onClick={() => onChange(!checked)}>
      <span className="ci-check-box">{checked && <span className="ci-check-mark">✓</span>}</span>
      <span className="ci-check-label">{label}</span>
    </button>
  );
}

function CIStepper({ label, value, onChange, min, max }) {
  const v = parseInt(value, 10) || 0;
  const set = (n) => onChange(Math.max(min ?? 0, Math.min(max ?? 999, n)));
  return (
    <div className="ci-field ci-field--qty">
      <label>{label}</label>
      <div className="ci-stepper">
        <button type="button" onClick={() => set(v - 1)}>−</button>
        <input className="ci-input--mono" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={() => set(v + 1)}>+</button>
      </div>
    </div>
  );
}

function CIStepHeader({ kicker, title, desc }) {
  return (
    <div className="ci-step-head">
      <span className="ci-step-kicker">{kicker}</span>
      <h2 className="ci-step-title">{title}</h2>
      {desc && <p className="ci-step-desc">{desc}</p>}
    </div>
  );
}

/* ============================================================
   WIZARD STEPS
   ============================================================ */
function CIStepModalidade({ s, set }) {
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 1 — Início" title="Modalidade do contrato" desc="Escolha o tipo de serviço. As cláusulas se adaptam automaticamente." />
      <CIRadioCards value={s.modalidade} onChange={(v) => set('modalidade', v)} options={window.CI.MODALIDADES} columns={1} />
    </div>
  );
}

function CIStepPartes({ s, set, errors }) {
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 2 — Partes" title="Dados da Contratada" desc="A Contratante (Vertical Parts) já está fixada. Preencha os dados da empresa contratada." />
      <div className="ci-contratante-note">
        <span className="ci-cn-label">Contratante (fixo)</span>
        <strong>VERTICAL PARTS LTDA-ME</strong>
        <span className="ci-cn-meta">CNPJ 15.822.325/0001-27 · Guarulhos/SP · Rep. Diego Yutaka Maeno</span>
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Empresa</h3>
        <div className="ci-grid">
          <CIField label="Razão social" required width="full" value={s.c_razao} onChange={(v) => set('c_razao', v)} placeholder="Ex.: Montagem Vertical Serviços Ltda." error={errors.c_razao} />
          <CIField label="CNPJ" required mask="maskCNPJ" mono value={s.c_cnpj} onChange={(v) => set('c_cnpj', v)} placeholder="00.000.000/0000-00" error={errors.c_cnpj} />
        </div>
        <div className="ci-grid">
          <CIField label="Logradouro (Rua/Av.)" width="wide" value={s.c_rua} onChange={(v) => set('c_rua', v)} placeholder="Rua Exemplo" />
          <CIField label="Número" width="narrow" value={s.c_numero} onChange={(v) => set('c_numero', v)} placeholder="123" />
        </div>
        <div className="ci-grid">
          <CIField label="Bairro" value={s.c_bairro} onChange={(v) => set('c_bairro', v)} placeholder="Centro" />
          <CIField label="Cidade" value={s.c_cidade} onChange={(v) => set('c_cidade', v)} placeholder="São Paulo" />
          <CIField label="UF" width="narrow" value={s.c_estado} onChange={(v) => set('c_estado', v.toUpperCase().slice(0, 2))} placeholder="SP" />
          <CIField label="CEP" mask="maskCEP" mono value={s.c_cep} onChange={(v) => set('c_cep', v)} placeholder="00000-000" />
        </div>
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Responsável legal</h3>
        <div className="ci-grid">
          <CIField label="Nome completo" required width="full" value={s.r_nome} onChange={(v) => set('r_nome', v)} placeholder="Nome do responsável" error={errors.r_nome} />
        </div>
        <div className="ci-grid">
          <CIField label="Nacionalidade" value={s.r_nacionalidade} onChange={(v) => set('r_nacionalidade', v)} placeholder="brasileiro(a)" />
          <CIField label="Estado civil" value={s.r_estadoCivil} onChange={(v) => set('r_estadoCivil', v)} placeholder="casado(a)" />
          <CIField label="Profissão" value={s.r_profissao} onChange={(v) => set('r_profissao', v)} placeholder="empresário(a)" />
        </div>
        <div className="ci-grid">
          <CIField label="RG" mask="maskRG" mono value={s.r_rg} onChange={(v) => set('r_rg', v)} placeholder="00.000.000-0" />
          <CIField label="CPF" required mask="maskCPF" mono value={s.r_cpf} onChange={(v) => set('r_cpf', v)} placeholder="000.000.000-00" error={errors.r_cpf} />
        </div>
        <CICheckRow checked={s.r_mesmoEndereco} onChange={(v) => set('r_mesmoEndereco', v)} label="Responsável reside no mesmo endereço da empresa" />
        {!s.r_mesmoEndereco && (
          <div className="ci-grid ci-grid--indent">
            <CIField label="Logradouro" width="wide" value={s.r_rua} onChange={(v) => set('r_rua', v)} placeholder="Rua Exemplo" />
            <CIField label="Número" width="narrow" value={s.r_numero} onChange={(v) => set('r_numero', v)} placeholder="123" />
            <CIField label="Bairro" value={s.r_bairro} onChange={(v) => set('r_bairro', v)} placeholder="Centro" />
            <CIField label="Cidade" value={s.r_cidade} onChange={(v) => set('r_cidade', v)} placeholder="São Paulo" />
            <CIField label="UF" width="narrow" value={s.r_estado} onChange={(v) => set('r_estado', v.toUpperCase().slice(0, 2))} placeholder="SP" />
            <CIField label="CEP" mask="maskCEP" mono value={s.r_cep} onChange={(v) => set('r_cep', v)} placeholder="00000-000" />
          </div>
        )}
      </div>
    </div>
  );
}

function CIStepObjeto({ s, set }) {
  const isElevador = s.equipamento === 'elevador';
  const remocao = window.CI.isRemocao(s);
  const especial = window.CI.isCargaEspecial(s);
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 3 — Objeto" title="Objeto do contrato" desc="Defina o equipamento e o escopo. Os campos mudam conforme o tipo selecionado." />
      <div className="ci-field-group">
        <h3 className="ci-group-title">Equipamento</h3>
        <CIRadioCards value={s.equipamento} onChange={(v) => set('equipamento', v)} options={window.CI.EQUIPAMENTOS} columns={3} />
        <div className="ci-grid" style={{ marginTop: 16 }}>
          <CIStepper label="Quantidade" value={s.quantidade} onChange={(v) => set('quantidade', v)} min={1} max={99} />
          <div className="ci-field ci-field--fixed-brand">
            <label>Marca</label>
            <div className="ci-brand-lock"><span>Vertical Parts</span><span className="ci-lock-ico">🔒</span></div>
          </div>
        </div>
      </div>
      {isElevador && (
        <div className="ci-field-group ci-field-group--cond">
          <h3 className="ci-group-title">Especificações do elevador</h3>
          <div className="ci-grid">
            <CISelect label="Tipo de elevador" value={s.tipoElevador} onChange={(v) => set('tipoElevador', v)} options={window.CI.TIPOS_ELEVADOR.map(t => ({ value: t.id, label: t.label }))} />
            <CISelect label="Quantidade de paradas" value={s.paradas} onChange={(v) => set('paradas', v)} options={window.CI.PARADAS_OPCOES.map(p => ({ value: p, label: p }))} />
            {s.paradas === 'Personalizado' && <CIField label="Paradas (qtd.)" width="narrow" mono value={s.paradasCustom} onChange={(v) => set('paradasCustom', v.replace(/\D/g, ''))} placeholder="30" />}
          </div>
          <div className="ci-grid">
            <CIField label="Capacidade de carga (kg)" mono value={s.capacidadeCarga} onChange={(v) => set('capacidadeCarga', v.replace(/[^\d.,]/g, ''))} placeholder="1000" hint="Acima de 1.000 kg ativa a cláusula de equipamento especial." />
          </div>
          <CICheckRow checked={s.cargaEspecial} onChange={(v) => set('cargaEspecial', v)} label="Marcar como carga especial (içamento / reforço NR-12 e NR-18)" />
          {especial && <div className="ci-cond-alert"><span className="ci-cond-dot"></span>Cláusula de Equipamento Especial será inserida.</div>}
        </div>
      )}
      {remocao && (
        <div className="ci-field-group ci-field-group--cond">
          <h3 className="ci-group-title">{s.modalidade === 'remocao_adequacao' ? 'Nova instalação' : 'Destino da remoção'}</h3>
          <CIField label={s.modalidade === 'remocao_adequacao' ? 'Local da nova instalação' : 'Destino do equipamento removido'} width="full" value={s.destino} onChange={(v) => set('destino', v)} placeholder="Endereço / destino" />
        </div>
      )}
      <div className="ci-field-group">
        <h3 className="ci-group-title">Escopo</h3>
        <CITextArea label="Descrição dos serviços" value={s.descricaoServicos} onChange={(v) => set('descricaoServicos', v)} rows={3} placeholder="Detalhe os serviços (montagem, alinhamento, testes, etc.)" />
        <CITextArea label="Local do serviço" value={s.localServico} onChange={(v) => set('localServico', v)} rows={2} placeholder="Endereço completo de onde será realizado o serviço" hint="Endereço da obra onde o serviço acontece." />
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Prazo e garantia</h3>
        <div className="ci-grid">
          <CIField label="Prazo de execução (dias corridos)" mono value={s.prazo_execucao} onChange={(v) => set('prazo_execucao', v.replace(/\D/g, ''))} placeholder="30" hint="Prazo para conclusão dos serviços, contado a partir do início." />
          {s.modalidade !== 'remocao' && (
            <CIField label="Garantia da montagem (meses)" mono value={s.garantia_meses} onChange={(v) => set('garantia_meses', v.replace(/\D/g, ''))} placeholder="6" hint="Meses de garantia contra vícios de execução após aceite formal." />
          )}
        </div>
      </div>
    </div>
  );
}

function CIStepLogistica({ s, set }) {
  const longa = window.CI.isLongaDistancia(s);
  const km = parseFloat(String(s.distancia).replace(',', '.')) || 0;
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 4 — Logística" title="Logística e local" desc="Localização da obra e distância de Guarulhos/SP. A partir de 100 km uma cláusula de deslocamento é inserida." />
      <div className="ci-field-group">
        <div className="ci-grid">
          <CIField label="Cidade da obra" value={s.obraCidade} onChange={(v) => set('obraCidade', v)} placeholder="Campinas" />
          <CIField label="UF" width="narrow" value={s.obraEstado} onChange={(v) => set('obraEstado', v.toUpperCase().slice(0, 2))} placeholder="SP" />
          <CIField label="Distância de Guarulhos/SP (km)" mono value={s.distancia} onChange={(v) => set('distancia', v.replace(/[^\d.,]/g, ''))} placeholder="0" hint="≥ 100 km ativa a cláusula de logística." />
        </div>
        <div className={'ci-distance-gauge' + (longa ? ' ci-distance-gauge--on' : '')}>
          <div className="ci-dg-track"><div className="ci-dg-fill" style={{ width: Math.min(100, (km / 200) * 100) + '%' }}></div><div className="ci-dg-mark" style={{ left: '50%' }}><span>100 km</span></div></div>
          <div className="ci-dg-status">{longa ? `${km} km — cláusula de logística ativada` : (km > 0 ? `${km} km — dentro do raio padrão` : 'Informe a distância')}</div>
        </div>
      </div>
      {longa && (
        <div className="ci-field-group ci-field-group--cond">
          <h3 className="ci-group-title">Cláusula de logística e deslocamento</h3>
          <label className="ci-mini-label">Forma de tratamento</label>
          <CISegmented value={s.logModo} onChange={(v) => set('logModo', v)} options={[{ value: 'despesas', label: 'Despesas à parte' }, { value: 'prazo', label: 'Extensão de prazo' }]} />
          {s.logModo === 'despesas' && (
            <div style={{ marginTop: 16 }}>
              <label className="ci-mini-label">Despesas por conta de</label>
              <CISegmented value={s.logResponsavel} onChange={(v) => set('logResponsavel', v)} options={[{ value: 'contratada', label: 'Contratada' }, { value: 'contratante', label: 'Contratante' }]} />
            </div>
          )}
          {s.logModo === 'prazo' && (
            <div className="ci-grid" style={{ marginTop: 16 }}>
              <CIField label="Dias adicionais de prazo" width="narrow" mono value={s.logDiasExtra} onChange={(v) => set('logDiasExtra', v.replace(/\D/g, ''))} placeholder="10" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CIStepPagamento({ s, set, errors }) {
  const addParcela = () => set('parcelas', [...(s.parcelas || []), { valor: '', data: '', descricao: '' }]);
  const updateParcela = (i, k, v) => {
    const arr = [...s.parcelas];
    arr[i] = { ...arr[i], [k]: k === 'valor' ? window.CI.maskMoeda(v) : v };
    set('parcelas', arr);
  };
  const removeParcela = (i) => set('parcelas', s.parcelas.filter((_, j) => j !== i));
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 5 — Pagamento" title="Valores e pagamento" desc="Valor total, parcelamento e dados bancários. O valor por extenso é gerado automaticamente." />
      <div className="ci-field-group">
        <div className="ci-grid">
          <CIMoneyField label="Valor total do contrato" required width="wide" value={s.valorTotal} onChange={(v) => set('valorTotal', v)} error={errors.valorTotal} />
        </div>
        <label className="ci-mini-label">Forma de pagamento</label>
        <CISegmented value={s.formaPagamento} onChange={(v) => set('formaPagamento', v)} options={[
          { value: '2', label: '2 parcelas (50/50)' },
          { value: '3', label: '3 parcelas' },
          { value: 'custom', label: 'Personalizado' },
        ]} />
        {s.formaPagamento === 'custom' && (
          <div className="ci-parcelas">
            {(s.parcelas || []).map((p, i) => (
              <div className="ci-parcela-row" key={i}>
                <span className="ci-parcela-n">{i + 1}ª</span>
                <div className="ci-parcela-fields">
                  <div className="ci-input ci-input--prefix ci-parcela-money">
                    <span className="ci-input-prefix">R$</span>
                    <input className="ci-input-bare ci-input--mono" value={p.valor} onChange={(e) => updateParcela(i, 'valor', e.target.value)} placeholder="0,00" inputMode="numeric" />
                  </div>
                  <input className="ci-input" value={p.descricao} onChange={(e) => updateParcela(i, 'descricao', e.target.value)} placeholder="Descrição / marco (ex.: na assinatura)" />
                </div>
                <button type="button" className="ci-parcela-del" onClick={() => removeParcela(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="ci-add-parcela" onClick={addParcela}>+ Adicionar parcela</button>
          </div>
        )}
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Mora e correção</h3>
        <div className="ci-grid">
          <CIField label="Juros por atraso da Contratante (% a.m.)" width="narrow" mono value={s.juros_atraso_pct} onChange={(v) => set('juros_atraso_pct', v.replace(/[^\d.,]/g, ''))} placeholder="1" hint="Taxa de mora mensal aplicada em caso de atraso no pagamento." />
        </div>
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Dados bancários da Contratada</h3>
        <div className="ci-grid">
          <CIField label="Banco" value={s.banco} onChange={(v) => set('banco', v)} placeholder="Banco do Brasil" />
          <CIField label="Agência" width="narrow" mono value={s.agencia} onChange={(v) => set('agencia', v)} placeholder="0000" />
          <CIField label="Conta" mono value={s.conta} onChange={(v) => set('conta', v)} placeholder="00000-0" />
        </div>
        <CIField label="Chave PIX" width="full" mono value={s.pix} onChange={(v) => set('pix', v)} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
      </div>
    </div>
  );
}

function CIStepRevisao({ s, set }) {
  const allAnexos = window.CI.ANEXOS.every(a => s.anexos[a.id]);
  const toggleAll = () => {
    const next = {};
    window.CI.ANEXOS.forEach(a => next[a.id] = !allAnexos);
    set('anexos', next);
  };
  const conds = window.CI.activeConditionals(s);
  return (
    <div className="ci-step">
      <CIStepHeader kicker="Passo 6 — Revisão" title="Anexos e assinatura" desc="Confirme os documentos obrigatórios e a data. Depois é só gerar o contrato." />
      <div className="ci-field-group">
        <div className="ci-anexos-head">
          <h3 className="ci-group-title" style={{ margin: 0 }}>ANEXO I — Documentos obrigatórios (Cláusula 2.13)</h3>
          <button type="button" className="ci-link-btn" onClick={toggleAll}>{allAnexos ? 'Desmarcar todos' : 'Marcar todos'}</button>
        </div>
        <p className="ci-step-desc" style={{ margin: '4px 0 12px' }}>Itens exigidos antes do início da obra. A entrega e aprovação de todos é condição para acesso à obra e para o pagamento da 1ª parcela (Cláusula 5.3).</p>
        <div className="ci-anexos-grid">
          {window.CI.ANEXOS.map(a => (
            <CICheckRow key={a.id} checked={!!s.anexos[a.id]} onChange={(v) => set('anexos', { ...s.anexos, [a.id]: v })} label={a.label} />
          ))}
        </div>
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Local e data</h3>
        <div className="ci-grid">
          <CIField label="Cidade" value={s.cidadeAssinatura} onChange={(v) => set('cidadeAssinatura', v)} placeholder="Guarulhos" />
          <CIField label="Dia" width="narrow" mono value={s.dataDia} onChange={(v) => set('dataDia', v.replace(/\D/g, '').slice(0, 2))} placeholder="01" />
          <CISelect label="Mês" value={s.dataMes} onChange={(v) => set('dataMes', v)} options={window.CI.MESES.map(m => ({ value: m, label: m }))} />
          <CIField label="Ano" width="narrow" mono value={s.dataAno} onChange={(v) => set('dataAno', v.replace(/\D/g, '').slice(0, 4))} placeholder="2026" />
        </div>
      </div>
      <div className="ci-field-group">
        <h3 className="ci-group-title">Cláusulas condicionais ativas</h3>
        {conds.length === 0
          ? <p className="ci-empty-conds">Nenhuma cláusula condicional ativada. O contrato usará apenas as cláusulas padrão.</p>
          : <div className="ci-cond-summary">{conds.map(c => <span key={c.id} className={'ci-cond-pill ci-cond-pill--' + c.tone}>{c.label}</span>)}</div>}
      </div>
    </div>
  );
}

/* ============================================================
   SEND MODAL — WhatsApp / E-mail / Link copiável
   ============================================================ */
function CISendModal({ record, onClose, onSent }) {
  const [channel, setChannel] = _ciUS(record.channel || 'whatsapp');
  const [contact, setContact] = _ciUS((record.recipient && record.recipient.contact) || '');
  const [name, setName] = _ciUS((record.recipient && record.recipient.name) || record.responsavel_nome || '');
  const [sent, setSent] = _ciUS(false);
  const [copied, setCopied] = _ciUS(false);
  const [sending, setSending] = _ciUS(false);

  const pretty = window.CIStore.prettyUrl(record.token);
  const real = window.CIStore.signUrl(record.token);
  const valorFmt = record.valor_total ? 'R$ ' + window.CI.fmtMoeda(record.valor_total) : '—';

  const message =
    `Olá${name ? ' ' + name.split(' ')[0] : ''}! A Vertical Parts enviou um contrato para sua assinatura digital.\n\n` +
    `Contrato ${record.numero_documento}\n${record.titulo}\nValor: ${valorFmt}\n\n` +
    `Assine pelo link seguro (válido por 7 dias):\n${real}`;

  const copyLink = () => {
    navigator.clipboard && navigator.clipboard.writeText(real);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const updated = await window.CIStore.markSent(record.id, channel, { name, contact });
      if (channel === 'whatsapp') {
        window.open(window.CIStore.whatsAppHref(contact, message), '_blank');
      } else if (channel === 'email') {
        window.open(window.CIStore.mailtoHref(contact, `Contrato ${record.numero_documento} — Assinatura digital | Vertical Parts`, message), '_blank');
      }
      setSent(true);
      onSent && onSent(updated);
    } catch (e) {
      alert('Erro ao registrar envio: ' + (e.message || e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ci-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ci-modal">
        <div className="ci-modal-head">
          <div>
            <h2>{sent ? 'Enviado' : 'Enviar para assinatura'}</h2>
            <p>{sent ? 'O contrato está aguardando a assinatura do destinatário.' : 'Gere o link seguro e escolha o canal de envio.'}</p>
          </div>
          <button className="ci-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="ci-modal-body">
          <div className="ci-mini">
            <span className="ci-mini-num">{record.numero_documento}</span>
            <span className="ci-mini-title">{record.contratada_nome}</span>
            <div className="ci-mini-row"><span>{record.objeto_resumo}</span><b>{valorFmt}</b></div>
          </div>
          {!sent ? (
            <>
              <label className="ci-mini-label" style={{ display: 'block', marginBottom: 8 }}>Link único e seguro</label>
              <div className="ci-linkbox">
                <code>{real}</code>
                <button onClick={copyLink}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
              </div>
              <div className="ci-channels">
                <button className={'ci-channel' + (channel === 'whatsapp' ? ' on' : '')} onClick={() => setChannel('whatsapp')}>
                  <span className="ci-channel-icon">📱</span><span>WhatsApp</span><small>Abre o WhatsApp Web</small>
                </button>
                <button className={'ci-channel' + (channel === 'email' ? ' on' : '')} onClick={() => setChannel('email')}>
                  <span className="ci-channel-icon">✉️</span><span>E-mail</span><small>Template profissional</small>
                </button>
                <button className={'ci-channel' + (channel === 'link' ? ' on' : '')} onClick={() => setChannel('link')}>
                  <span className="ci-channel-icon">🔗</span><span>Link</span><small>Copie e envie por fora</small>
                </button>
              </div>
              <div className="ci-field">
                <label>Nome do destinatário</label>
                <input className="ci-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do signatário" />
              </div>
              {channel !== 'link' && (
                <div className="ci-field">
                  <label>{channel === 'whatsapp' ? 'WhatsApp (com DDD)' : 'E-mail'}</label>
                  <input className="ci-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={channel === 'whatsapp' ? '(11) 99999-0000' : 'cliente@empresa.com.br'} />
                </div>
              )}
            </>
          ) : (
            <div className="ci-sent-ok">
              <div className="ci-check">✓</div>
              <h3>Link {channel === 'link' ? 'registrado' : 'enviado via ' + (channel === 'whatsapp' ? 'WhatsApp' : 'E-mail')}</h3>
              <p>Status atualizado para <b>ENVIADO</b>. Você acompanha a abertura e a assinatura no painel.</p>
              <div className="ci-linkbox">
                <code>{real}</code>
                <button onClick={copyLink}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
              </div>
              <a className="ci-btn ci-btn--dark" href={real} target="_blank" rel="noopener" style={{ textDecoration: 'none', marginTop: 8, display:'inline-block' }}>Abrir página de assinatura →</a>
            </div>
          )}
        </div>
        <div className="ci-modal-foot">
          {!sent ? (
            <>
              <button className="ci-btn ci-btn--ghost" onClick={onClose}>Cancelar</button>
              <button className="ci-btn ci-btn--primary" onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando…' : (channel === 'whatsapp' ? 'Enviar pelo WhatsApp →' : channel === 'email' ? 'Enviar por e-mail →' : 'Registrar e copiar link')}
              </button>
            </>
          ) : (
            <button className="ci-btn ci-btn--primary" onClick={onClose}>Concluir</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   WIZARD CONTAINER (panel esquerdo com form, direito com preview)
   ============================================================ */
const CI_WIZ_STEPS = [
  { id: 'modalidade', label: 'Início', sub: 'Modalidade' },
  { id: 'partes', label: 'Partes', sub: 'Contratada' },
  { id: 'objeto', label: 'Objeto', sub: 'Equipamento' },
  { id: 'logistica', label: 'Logística', sub: 'Local & distância' },
  { id: 'pagamento', label: 'Pagamento', sub: 'Valores' },
  { id: 'revisao', label: 'Revisão', sub: 'Anexos & assinatura' },
];

function validateStep(idx, s) {
  const e = {};
  if (idx === 1) {
    if (!s.c_razao || !s.c_razao.trim()) e.c_razao = 'Informe a razão social.';
    if (!window.CI.isCNPJValid(s.c_cnpj)) e.c_cnpj = 'CNPJ incompleto (14 dígitos).';
    if (!s.r_nome || !s.r_nome.trim()) e.r_nome = 'Informe o responsável.';
    if (!window.CI.isCPFValid(s.r_cpf)) e.r_cpf = 'CPF incompleto (11 dígitos).';
  }
  if (idx === 4) {
    if (window.CI.moedaParaNumero(s.valorTotal) <= 0) e.valorTotal = 'Informe o valor total.';
  }
  return e;
}

function CIWizard({ onCreated, initial }) {
  const [s, setS] = _ciUS(initial || window.CI.defaultState());
  const [step, setStep] = _ciUS(0);
  const [errors, setErrors] = _ciUS({});
  const [sendRec, setSendRec] = _ciUS(null);
  const [creating, setCreating] = _ciUS(false);
  const formScrollRef = _ciUR(null);

  _ciUE(() => { if (formScrollRef.current) formScrollRef.current.scrollTop = 0; }, [step]);

  const set = (k, v) => setS(prev => ({ ...prev, [k]: v }));

  const docPreview = _ciUM(() => window.CI.buildContract(s, 'VPNI' + '________'), [s]);
  const conds = window.CI.activeConditionals(s);

  const goNext = () => {
    const e = validateStep(step, s);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (step < CI_WIZ_STEPS.length - 1) setStep(step + 1);
  };
  const goPrev = () => { setErrors({}); if (step > 0) setStep(step - 1); };
  const goTo = (i) => { setErrors({}); setStep(i); };

  const completeAll = () => {
    let all = {};
    [1, 4].forEach(i => { all = { ...all, ...validateStep(i, s) }; });
    if (Object.keys(all).length > 0) {
      setErrors(all);
      const firstBad = Object.keys(validateStep(1, s)).length ? 1 : 4;
      setStep(firstBad);
      return false;
    }
    return true;
  };

  const handleCreateAndSend = async () => {
    if (!completeAll() || creating) return;
    setCreating(true);
    try {
      const rec = await window.CIStore.createDraft(s);
      setSendRec(rec);
      onCreated && onCreated(rec);
    } catch (e) {
      alert('Erro ao gerar contrato: ' + (e.message || e));
    } finally {
      setCreating(false);
    }
  };

  const StepComp = [CIStepModalidade, CIStepPartes, CIStepObjeto, CIStepLogistica, CIStepPagamento, CIStepRevisao][step];

  return (
    <div className="ci-wiz">
      <nav className="ci-stepbar">
        {CI_WIZ_STEPS.map((st, i) => (
          <button key={st.id} className={'ci-stepbar-item' + (i === step ? ' is-active' : '') + (i < step ? ' is-done' : '')} onClick={() => goTo(i)}>
            <span className="ci-stepbar-num">{i < step ? '✓' : String(i + 1)}</span>
            <span className="ci-stepbar-text"><b>{st.label}</b><small>{st.sub}</small></span>
            {i < CI_WIZ_STEPS.length - 1 && <span className="ci-stepbar-line"></span>}
          </button>
        ))}
      </nav>

      <div className="ci-wiz-body">
        <div className="ci-form-col" ref={formScrollRef}>
          <div className="ci-form-inner">
            <StepComp s={s} set={set} errors={errors} goTo={goTo} />
          </div>
          <div className="ci-form-foot">
            <button className="ci-btn ci-btn--ghost" onClick={goPrev} disabled={step === 0}>← Voltar</button>
            <span className="ci-form-foot-meta">Passo {step + 1} de {CI_WIZ_STEPS.length}</span>
            {step < CI_WIZ_STEPS.length - 1
              ? <button className="ci-btn ci-btn--dark" onClick={goNext}>Avançar →</button>
              : <button className="ci-btn ci-btn--primary" onClick={handleCreateAndSend} disabled={creating}>{creating ? 'Gerando…' : 'Gerar e enviar para assinatura →'}</button>}
          </div>
        </div>
        <div className="ci-preview-col">
          <div className="ci-preview-bar">
            <span className="ci-preview-bar-title">Pré-visualização</span>
            <div className="ci-preview-bar-conds">
              {conds.length === 0
                ? <span className="ci-pv-cond ci-pv-cond--muted">Cláusulas padrão</span>
                : conds.map(c => <span key={c.id} className={'ci-pv-cond ci-pv-cond--' + c.tone}>{c.label}</span>)}
            </div>
          </div>
          <div className="ci-preview-scroll">
            <window.CIContractPreview doc={docPreview} highlightConditional={true} />
          </div>
        </div>
      </div>

      {sendRec && <CISendModal record={sendRec} onClose={() => { setSendRec(null); setS(window.CI.defaultState()); setStep(0); }} onSent={() => {}} />}
    </div>
  );
}

/* ============================================================
   DASHBOARD — listagem dos contratos, timeline, auditoria
   ============================================================ */
function CIBadge({ status }) {
  const st = window.CIStore.STATUS[status] || window.CIStore.STATUS.rascunho;
  return <span className={'ci-badge ci-badge--' + st.tone}><span className="ci-badge-dot"></span>{st.label}</span>;
}

const CI_TL_SEQ = ['rascunho', 'enviado', 'visualizado', 'assinado'];

function CITimeline({ rec }) {
  const byStatus = {};
  (rec.log || []).forEach(l => { byStatus[l.status] = l; });
  const terminal = (rec.status === 'expirado' || rec.status === 'recusado') ? rec.status : null;
  const curIdx = CI_TL_SEQ.indexOf(rec.status);
  const steps = CI_TL_SEQ.map((sid, i) => {
    const st = window.CIStore.STATUS[sid];
    const entry = byStatus[sid];
    let cls = 'pending';
    if (entry) cls = (i === curIdx && !terminal) ? 'current' : 'done';
    if (terminal && i <= curIdx) cls = 'done';
    return { st, entry, cls };
  });
  if (terminal) {
    const st = window.CIStore.STATUS[terminal];
    steps.push({ st, entry: byStatus[terminal], cls: 'current' });
  }
  return (
    <div className="ci-timeline">
      {steps.map((s, i) => (
        <div key={i} className={'ci-tl-step ' + s.cls}>
          <div className="ci-tl-rail">
            <div className="ci-tl-dot">{s.entry ? s.st.icon : (i + 1)}</div>
            <div className="ci-tl-line"></div>
          </div>
          <div className="ci-tl-body">
            <div className="ci-tl-title">{s.st.label}</div>
            <div className="ci-tl-meta">
              {s.entry ? window.CIStore.fmtDateTime(s.entry.at) : 'Pendente'}
              {s.entry && s.entry.meta && s.entry.meta.channel ? ' · ' + (s.entry.meta.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail') : ''}
              {s.entry && s.entry.meta && s.entry.meta.ip ? ' · IP ' + s.entry.meta.ip : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CIAuditRow({ k, v }) {
  return <div className="ci-audit-row"><span className="k">{k}</span><span className="v">{v || '—'}</span></div>;
}

function CIAuditDrawer({ rec, onClose, onResend, onRefresh }) {
  const a = rec.audit || {};
  const del = async () => {
    if (!window.confirm('Excluir este contrato do painel?')) return;
    await window.CIStore.remove(rec.id);
    onClose();
    onRefresh();
  };
  const valorFmt = rec.valor_total ? 'R$ ' + window.CI.fmtMoeda(rec.valor_total) : '—';
  const signUrl = window.CIStore.signUrl(rec.token);
  return (
    <div className="ci-drawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ci-drawer">
        <div className="ci-drawer-head">
          <div>
            <h2>{rec.numero_documento}</h2>
            <div className="ci-drawer-co">{rec.contratada_nome}</div>
            <div style={{ marginTop: 10 }}><CIBadge status={rec.status} /></div>
          </div>
          <button className="ci-drawer-x" onClick={onClose}>✕</button>
        </div>
        <div className="ci-drawer-body">
          <div className="ci-drawer-sec">
            <h3 className="ci-drawer-sec-title">Linha do tempo</h3>
            <CITimeline rec={rec} />
          </div>
          <div className="ci-drawer-sec">
            <h3 className="ci-drawer-sec-title">Trilha de auditoria</h3>
            <div className="ci-audit">
              <CIAuditRow k="Responsável" v={rec.responsavel_nome} />
              <CIAuditRow k="Objeto" v={rec.objeto_resumo} />
              <CIAuditRow k="Valor" v={valorFmt} />
              <CIAuditRow k="Enviado em" v={window.CIStore.fmtDateTime(rec.sent_at)} />
              <CIAuditRow k="Canal" v={rec.channel === 'whatsapp' ? 'WhatsApp' : rec.channel === 'email' ? 'E-mail' : rec.channel === 'link' ? 'Link copiado' : '—'} />
              <CIAuditRow k="Destinatário" v={rec.recipient && rec.recipient.contact} />
              <CIAuditRow k="Validade do link" v={rec.expires_at ? window.CIStore.fmtDate(rec.expires_at) : '—'} />
              {a.viewedAt && <CIAuditRow k="Visualizado em" v={window.CIStore.fmtDateTime(a.viewedAt)} />}
              {a.viewedAt && <CIAuditRow k="IP (visualização)" v={a.viewIp || 'não capturado'} />}
              {a.viewedAt && <CIAuditRow k="Dispositivo (visualização)" v={a.viewDevice} />}
              {a.signedAt && <CIAuditRow k="Assinado em" v={window.CIStore.fmtDateTime(a.signedAt)} />}
              {a.signedAt && <CIAuditRow k="Signatário" v={a.signerName} />}
              {a.signedAt && <CIAuditRow k="Tipo de assinatura" v={a.signatureType === 'draw' ? 'Desenhada' : 'Digitada'} />}
              {a.signedAt && <CIAuditRow k="IP (assinatura)" v={a.signIp || 'não capturado'} />}
              {a.signedAt && <CIAuditRow k="Dispositivo (assinatura)" v={a.signDevice} />}
              {a.hash && <CIAuditRow k="Hash SHA-256" v={a.hash} />}
            </div>
            {a.signedAt && (
              <div className="ci-legal-note">
                Documento assinado eletronicamente nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.
                A integridade é garantida pelo hash SHA-256 acima.
              </div>
            )}
          </div>
          <div className="ci-drawer-sec">
            <h3 className="ci-drawer-sec-title">Ações</h3>
            <div className="ci-drawer-actions">
              <a className="ci-btn ci-btn--ghost" href={signUrl} target="_blank" rel="noopener">Abrir link de assinatura ↗</a>
              {(rec.status === 'enviado' || rec.status === 'visualizado' || rec.status === 'expirado' || rec.status === 'rascunho') &&
                <button className="ci-btn ci-btn--primary" onClick={() => onResend(rec)}>{rec.status === 'rascunho' ? 'Enviar' : 'Reenviar link'}</button>}
              <button className="ci-btn ci-btn--danger" onClick={del}>Excluir</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CIDashboard() {
  const [contracts, setContracts] = _ciUS([]);
  const [loading, setLoading] = _ciUS(true);
  const [filter, setFilter] = _ciUS('todos');
  const [query, setQuery] = _ciUS('');
  const [drawerId, setDrawerId] = _ciUS(null);
  const [sendRec, setSendRec] = _ciUS(null);

  const refresh = async () => {
    setLoading(true);
    const list = await window.CIStore.listAll();
    setContracts(list);
    setLoading(false);
  };

  _ciUE(() => {
    window.CIStore.sweepExpired().then(refresh);
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const drawerRec = drawerId ? contracts.find(c => c.id === drawerId) : null;

  const counts = _ciUM(() => {
    const c = { rascunho: 0, enviado: 0, visualizado: 0, assinado: 0 };
    contracts.forEach(x => { if (x.status === 'recusado' || x.status === 'expirado') return; c[x.status] = (c[x.status] || 0) + 1; });
    return c;
  }, [contracts]);

  const filtered = contracts.filter(c => {
    if (filter !== 'todos' && c.status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      return ((c.numero_documento || '') + ' ' + (c.contratada_nome || '') + ' ' + (c.responsavel_nome || '')).toLowerCase().includes(q);
    }
    return true;
  });

  const statCards = [
    { id: 'rascunho', tone: 'gray' },
    { id: 'enviado', tone: 'blue' },
    { id: 'visualizado', tone: 'yellow' },
    { id: 'assinado', tone: 'green' },
  ];

  const lastActivity = (c) => {
    const l = (c.log || [])[c.log.length - 1];
    return l ? window.CIStore.relative(l.at) : '';
  };

  return (
    <div className="ci-dash">
      <div className="ci-dash-stats">
        <div className={'ci-stat' + (filter === 'todos' ? ' active' : '')} onClick={() => setFilter('todos')}>
          <div className="ci-stat-top"><span className="ci-stat-num">{contracts.length}</span></div>
          <div className="ci-stat-label">Total</div>
        </div>
        {statCards.map(sc => (
          <div key={sc.id} className={'ci-stat ci-stat--' + sc.tone + (filter === sc.id ? ' active' : '')} onClick={() => setFilter(filter === sc.id ? 'todos' : sc.id)}>
            <div className="ci-stat-top">
              <span className="ci-stat-dot"></span>
              <span className="ci-stat-num">{counts[sc.id] || 0}</span>
            </div>
            <div className="ci-stat-label">{window.CIStore.STATUS[sc.id].label}</div>
          </div>
        ))}
      </div>

      <div className="ci-panel">
        <div className="ci-panel-head">
          <h2>{filter === 'todos' ? 'Todos os contratos' : window.CIStore.STATUS[filter].label}</h2>
          <div className="ci-panel-search">
            <input placeholder="Buscar nº, empresa, responsável…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {loading && contracts.length === 0 ? (
          <div className="ci-empty">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="ci-empty">Nenhum contrato {filter !== 'todos' ? 'com este status' : ''}. Crie um novo no gerador.</div>
        ) : (
          <table className="ci-table">
            <thead>
              <tr>
                <th>Contrato</th><th>Objeto</th><th>Valor</th><th>Status</th><th>Atividade</th><th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setDrawerId(c.id)}>
                  <td><div className="ci-cell-co">{c.contratada_nome}</div><div className="ci-cell-num">{c.numero_documento}</div></td>
                  <td><div className="ci-cell-obj">{c.objeto_resumo}</div><div className="ci-cell-resp">{c.responsavel_nome || '—'}</div></td>
                  <td className="ci-cell-val">{c.valor_total ? 'R$ ' + window.CI.fmtMoeda(c.valor_total) : '—'}</td>
                  <td><CIBadge status={c.status} /></td>
                  <td className="ci-cell-time">{lastActivity(c)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="ci-cell-actions">
                      <button className="ci-icon-btn" title="Auditoria" onClick={() => setDrawerId(c.id)}>👁</button>
                      <a className="ci-icon-btn" title="Abrir assinatura" href={window.CIStore.signUrl(c.token)} target="_blank" rel="noopener">🔗</a>
                      {(c.status === 'enviado' || c.status === 'visualizado' || c.status === 'rascunho' || c.status === 'expirado') &&
                        <button className="ci-mini-btn" onClick={() => setSendRec(c)}>{c.status === 'rascunho' ? 'Enviar' : 'Reenviar'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawerRec && <CIAuditDrawer rec={drawerRec} onClose={() => setDrawerId(null)} onResend={(r) => setSendRec(r)} onRefresh={refresh} />}
      {sendRec && <CISendModal record={sendRec} onClose={() => setSendRec(null)} onSent={refresh} />}
    </div>
  );
}

/* ============================================================
   PAGE — abas Wizard (novo) / Dashboard (painel)
   ============================================================ */
function ContratoInstaladorPage() {
  const [tab, setTab] = _ciUS('painel');
  return (
    <EnterprisePageBase
      module="JURÍDICO"
      page="Contrato Instalador"
      title="CONTRATO INSTALADOR"
      subtitle="Contrato de prestação de serviços para terceiros / montadores · assinatura digital com auditoria"
      actions={
        <div className="ci-page-actions">
          <button className={'ci-tab' + (tab === 'painel' ? ' on' : '')} onClick={() => setTab('painel')}>▦ Painel</button>
          <button className={'ci-tab' + (tab === 'novo' ? ' on' : '')} onClick={() => setTab('novo')}>+ Novo contrato</button>
        </div>
      }
    >
      {tab === 'painel' ? <CIDashboard /> : <CIWizard onCreated={() => setTab('painel')} />}
    </EnterprisePageBase>
  );
}

/* Fallback: se o host não definiu EnterprisePageBase, usa wrapper simples */
function EnterprisePageBase(props) {
  if (window.EnterprisePageBase && window.EnterprisePageBase !== EnterprisePageBase) {
    return window.EnterprisePageBase(props);
  }
  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <div className="ci-page-titles">
          <div className="ci-page-kicker">{props.module} · {props.page}</div>
          <h1 className="ci-page-title">{props.title}</h1>
          {props.subtitle && <p className="ci-page-sub">{props.subtitle}</p>}
        </div>
        {props.actions ? <div className="ci-page-actions-wrap">{props.actions}</div> : null}
      </div>
      <div className="ci-page-body">{props.children}</div>
    </div>
  );
}

window.ContratoInstaladorPage = ContratoInstaladorPage;
