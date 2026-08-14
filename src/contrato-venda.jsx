/* ============================================================
   contrato-venda.jsx
   ContratoVendaEquipamentosPage — wizard + dashboard + send modal
   tudo persistindo em contratos_venda_equipamentos via Supabase.
   ============================================================ */
const { useState: _cvUS, useEffect: _cvUE, useMemo: _cvUM, useRef: _cvUR } = React;

/* ============================================================
   FORM FIELDS
   ============================================================ */
function CVField({ label, value, onChange, placeholder, mask, error, hint, required, mono, width, type, suffix }) {
  const handle = (e) => {
    let v = e.target.value;
    if (mask && window.CV[mask]) v = window.CV[mask](v);
    onChange(v);
  };
  const im = (mask === 'maskMoney' || mask === 'maskCNPJ' || mask === 'maskCPF' || mask === 'maskCEP' || mask === 'maskPhone' || type === 'number') ? 'numeric' : undefined;
  return (
    <div className={'cv-field' + (width ? ' cv-field--' + width : '')}>
      {label && <label>{label}{required && <span className="cv-req">*</span>}</label>}
      <div className={'cv-input-wrap' + (suffix ? ' cv-input-wrap--suffix' : '')}>
        <input
          className={'cv-input' + (mono ? ' cv-mono' : '') + (error ? ' cv-input--error' : '')}
          value={value || ''}
          type={type || 'text'}
          onChange={handle}
          placeholder={placeholder}
          inputMode={im}
        />
        {suffix && <span className="cv-input-suffix">{suffix}</span>}
      </div>
      {error ? <span className="cv-field-err">{error}</span> : (hint ? <span className="cv-field-hint">{hint}</span> : null)}
    </div>
  );
}

function CVMoneyField({ label, value, onChange, error, hint, required, width }) {
  const handle = (e) => onChange(window.CV.maskMoney(e.target.value));
  const num = window.CV.parseMoney(value);
  return (
    <div className={'cv-field' + (width ? ' cv-field--' + width : '')}>
      <label>{label}{required && <span className="cv-req">*</span>}</label>
      <div className="cv-input-wrap cv-input-wrap--prefix">
        <span className="cv-input-prefix">R$</span>
        <input className="cv-input cv-mono" value={value || ''} onChange={handle} placeholder="0,00" inputMode="numeric"/>
      </div>
      {error ? <span className="cv-field-err">{error}</span> : (hint ? <span className="cv-field-hint">{hint}</span> : null)}
    </div>
  );
}

function CVSelect({ label, value, onChange, options, width }) {
  return (
    <div className={'cv-field' + (width ? ' cv-field--' + width : '')}>
      <label>{label}</label>
      <select className="cv-input cv-select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione…</option>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function CVTextArea({ label, value, onChange, placeholder, rows, hint }) {
  return (
    <div className="cv-field cv-field--full">
      <label>{label}</label>
      <textarea className="cv-input cv-textarea" rows={rows || 3} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}></textarea>
      {hint && <span className="cv-field-hint">{hint}</span>}
    </div>
  );
}

function CVToggle({ label, value, onChange }) {
  return (
    <button type="button" className={'cv-toggle' + (value ? ' on' : '')} onClick={() => onChange(!value)}>
      <div className="cv-toggle-sw"><div className="cv-toggle-dot"></div></div>
      <div className="cv-toggle-l">{label}</div>
    </button>
  );
}

function CVStepHeader({ kicker, title, desc }) {
  return (
    <div className="cv-step-head">
      <span className="cv-step-kicker">{kicker}</span>
      <h2 className="cv-step-title">{title}</h2>
      {desc && <p className="cv-step-desc">{desc}</p>}
    </div>
  );
}

/* Master ID (Fase 2) — puxa uma Proposta já aprovada (com master_id, vindo
   da Precificação) e herda cliente/valor/ativos sem redigitar. Se não houver
   nenhuma Proposta com Master ID ainda, some silenciosamente — o wizard
   continua funcionando 100% manual como sempre. */
function CVSeletorProposta({ masterId, onSelect }) {
  const [propostas, setPropostas] = _cvUS(null);
  const [selecionadaId, setSelecionadaId] = _cvUS('');

  _cvUE(() => {
    window.__VP_SB?.sb.from('propostas')
      .select('id, numero_documento, master_id, titulo, valor_total, data_json')
      .not('master_id', 'is', null)
      .order('criado_em', { ascending: false }).limit(50)
      .then(({ data }) => setPropostas(data || []));
  }, []);

  if (!propostas || !propostas.length) return null;

  return (
    <div className="cv-field-group" style={{ marginBottom: 16 }}>
      <CVSelect label="Herdar de uma Proposta (Master ID)" value={selecionadaId}
        onChange={(id) => {
          setSelecionadaId(id);
          const p = propostas.find((x) => x.id === id);
          if (p) onSelect(p);
        }}
        options={propostas.map((p) => ({ value: p.id, label: `${p.master_id} · ${p.numero_documento} · ${p.titulo || ''}` }))}
        width="full"/>
      {masterId && <div className="small muted" style={{ marginTop: 6 }}>Master ID vinculado: <b className="mono">{masterId}</b></div>}
    </div>
  );
}

/* ============================================================
   WIZARD STEPS
   ============================================================ */
function CVStepCadastro({ form, setComp, errors, onSelecionarProposta }) {
  return (
    <div className="cv-step">
      <CVStepHeader kicker="Passo 1 — Cadastro" title="Dados do Comprador" desc="A VENDEDORA (Vertical Parts) já está fixada. Preencha a contraparte."/>
      <CVSeletorProposta masterId={form.masterId} onSelect={onSelecionarProposta}/>
      <div className="cv-contratante-note">
        <span>VENDEDORA (fixo)</span>
        <strong>VERTICAL PARTS LTDA-ME</strong>
        <small>CNPJ 15.822.325/0001-27 · Guarulhos/SP · Rep. Diego Yutaka Maeno</small>
      </div>
      <div className="cv-grid">
        <CVField label="Razão social" required width="full" value={form.comprador.razao} onChange={(v) => setComp({ razao: v })} placeholder="ex: Shopping Center Aricanduva Ltda." error={errors.razao}/>
      </div>
      <div className="cv-grid">
        <CVField label="CNPJ" required mask="maskCNPJ" mono value={form.comprador.cnpj} onChange={(v) => setComp({ cnpj: v })} placeholder="00.000.000/0000-00" error={errors.cnpj}/>
        <CVField label="Telefone" mask="maskPhone" mono value={form.comprador.tel} onChange={(v) => setComp({ tel: v })} placeholder="(11) 90000-0000"/>
      </div>
      <div className="cv-grid">
        <CVField label="Endereço (sede)" width="full" value={form.comprador.endereco} onChange={(v) => setComp({ endereco: v })} placeholder="Rua, nº, bairro, cidade/estado, CEP"/>
      </div>
      <div className="cv-grid">
        <CVField label="Representante legal" required width="full" value={form.comprador.rep} onChange={(v) => setComp({ rep: v })} placeholder="Nome completo" error={errors.rep}/>
      </div>
      <div className="cv-grid">
        <CVField label="Cargo" value={form.comprador.repCargo} onChange={(v) => setComp({ repCargo: v })} placeholder="ex: Diretor"/>
        <CVField label="CPF do representante" mask="maskCPF" mono value={form.comprador.repCpf} onChange={(v) => setComp({ repCpf: v })} placeholder="000.000.000-00"/>
      </div>
      <div className="cv-grid">
        <CVField label="E-mail para assinatura" width="full" value={form.comprador.email} onChange={(v) => setComp({ email: v })} placeholder="contato@cliente.com.br" hint="Usado no envio do link de assinatura e como contato de comunicação (cláusula 10.1)."/>
      </div>
      <div className="cv-field-group">
        <h3 className="cv-group-title">Qualificação do representante (preâmbulo do contrato)</h3>
        <div className="cv-grid">
          <CVField label="Nacionalidade" value={form.comprador.repNacionalidade} onChange={(v) => setComp({ repNacionalidade: v })} placeholder="ex: brasileiro"/>
          <CVField label="Estado civil" value={form.comprador.repEstadoCivil} onChange={(v) => setComp({ repEstadoCivil: v })} placeholder="ex: casado"/>
        </div>
        <div className="cv-grid">
          <CVField label="Profissão" value={form.comprador.repProfissao} onChange={(v) => setComp({ repProfissao: v })} placeholder="ex: empresário"/>
          <CVField label="RG do representante" mono value={form.comprador.repRg} onChange={(v) => setComp({ repRg: v })} placeholder="nº e órgão emissor"/>
        </div>
        <div className="cv-grid">
          <CVField label="Endereço residencial do representante" width="full" value={form.comprador.repEnderecoResidencial} onChange={(v) => setComp({ repEnderecoResidencial: v })} placeholder="Rua, nº, bairro, cidade/estado, CEP" hint="Onde o representante reside e é domiciliado — exigido pelo preâmbulo do contrato."/>
        </div>
      </div>
    </div>
  );
}

function CVStepObjeto({ form, set }) {
  const eqConf = window.CV.EQUIPAMENTOS[form.tipoEquip] || window.CV.EQUIPAMENTOS.ELEVADOR;
  const cargaNum = parseFloat(String(form.carga || '0').replace(',', '.')) || 0;
  const especial = form.tipoEquip === 'ELEVADOR' && (cargaNum >= 1000 || form.cargaEspecial);
  return (
    <div className="cv-step">
      <CVStepHeader kicker="Passo 2 — Objeto" title="Equipamento e especificações" desc="O tipo de equipamento altera as exigências técnicas e as cláusulas condicionais."/>
      <div className="cv-field-group">
        <label className="cv-mini-label">Tipo de equipamento</label>
        <div className="cv-eq-grid">
          {Object.values(window.CV.EQUIPAMENTOS).map(e => (
            <button key={e.key} type="button" className={'cv-eq-card' + (form.tipoEquip === e.key ? ' on' : '')} onClick={() => set({ tipoEquip: e.key })}>
              <div className="cv-eq-card-l">{e.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="cv-grid">
        <CVField label="Quantidade" width="narrow" type="number" value={form.qtd} onChange={(v) => set({ qtd: parseInt(v) || 1 })}/>
      </div>
      <div className="cv-grid">
        {eqConf.fields.map(fld => {
          if (fld.type === 'toggle') {
            return <div key={fld.id} className="cv-field cv-field--full"><CVToggle label={fld.label} value={!!form[fld.id]} onChange={(v) => set({ [fld.id]: v })}/></div>;
          }
          if (fld.type === 'select') {
            return <CVSelect key={fld.id} label={fld.label} value={form[fld.id]} onChange={(v) => set({ [fld.id]: v })} options={fld.options}/>;
          }
          return <CVField key={fld.id} label={fld.label} type={fld.type} value={form[fld.id]} onChange={(v) => set({ [fld.id]: v })} placeholder={fld.placeholder} suffix={fld.suffix}/>;
        })}
      </div>
      {especial && (
        <div className="cv-cond-alert">
          <span className="cv-cond-dot"></span>
          <div><b>Atenção: equipamento especial.</b><br/>Carga ≥ 1.000 kg ou marcada como especial — combine à parte com o cliente o reforço de estrutura, o içamento diferenciado e a ART específica (a minuta padrão não cobre esses pontos; trate como anexo/aditivo se necessário).</div>
        </div>
      )}
    </div>
  );
}

function CVStepLogistica({ form, set }) {
  const dist = parseFloat(String(form.distancia || '0').replace(',', '.')) || 0;
  const longa = dist >= 100;
  return (
    <div className="cv-step">
      <CVStepHeader kicker="Passo 3 — Logística" title="Local da obra e distância" desc="Regra dos 100 km: obras distantes merecem atenção redobrada ao cronograma e custos de deslocamento."/>
      <div className="cv-grid">
        <CVTextArea label="Endereço completo do local de entrega/obra" value={form.localObra} onChange={(v) => set({ localObra: v })} rows={2} placeholder="Rua, nº, bairro, cidade/estado, CEP"/>
      </div>
      <div className="cv-grid">
        <CVField label="Distância até Guarulhos/SP (km)" type="number" suffix="km" value={form.distancia} onChange={(v) => set({ distancia: v })} placeholder="ex: 85" hint="Acima de 100 km ativa a cláusula de logística."/>
      </div>
      {longa && (
        <div className="cv-cond-alert">
          <span className="cv-cond-dot"></span>
          <div><b>Atenção: obra a mais de 100 km.</b><br/>Obra a {dist} km de Guarulhos/SP — alinhe à parte com o cliente quem cobre transporte, hospedagem e alimentação da equipe, e o prazo adicional de execução (a minuta padrão não cobre esses pontos; trate como anexo/aditivo se necessário).</div>
        </div>
      )}
    </div>
  );
}

function CVStepPreco({ form, set, errors }) {
  const valor = window.CV.parseMoney(form.valor);
  return (
    <div className="cv-step">
      <CVStepHeader kicker="Passo 4 — Preço" title="Valor, sinal e parcelamento" desc="Prazo de entrega de 120 a 150 dias começa a contar quando todos os requisitos estiverem cumpridos."/>
      <div className="cv-grid">
        <CVMoneyField label="Valor total do contrato" required width="wide" value={form.valor} onChange={(v) => set({ valor: v })} error={errors.valor}/>
      </div>
      <div className="cv-grid">
        <CVField label="Sinal / entrada (%)" type="number" suffix="%" value={form.sinalPct} onChange={(v) => set({ sinalPct: Math.max(0, Math.min(100, parseInt(v) || 0)) })}/>
        <CVSelect label="Nº de parcelas do saldo" value={String(form.parcelas)} onChange={(v) => set({ parcelas: parseInt(v) })} options={['1','2','3','4','5','6','8','10','12'].map(n => ({ value: n, label: n + '×' }))}/>
      </div>
      {valor > 0 && (
        <div className="cv-pay-summary">
          <div className="cv-mini-label">Resumo do pagamento</div>
          <div className="cv-pay-row"><span>Sinal ({form.sinalPct}%)</span><b className="cv-mono">{window.CV.brl(valor * form.sinalPct / 100)}</b></div>
          <div className="cv-pay-row"><span>{form.parcelas}× parcelas do saldo</span><b className="cv-mono">{window.CV.brl((valor * (100 - form.sinalPct) / 100) / form.parcelas)}</b></div>
          <div className="cv-pay-row cv-pay-total"><span>Total</span><b className="cv-mono">{window.CV.brl(valor)}</b></div>
        </div>
      )}
    </div>
  );
}

function CVStepRevisao({ form, set, doc }) {
  const dist = parseFloat(String(form.distancia || '0').replace(',', '.')) || 0;
  const longa = dist >= 100;
  const cargaNum = parseFloat(String(form.carga || '0').replace(',', '.')) || 0;
  const especial = form.tipoEquip === 'ELEVADOR' && (cargaNum >= 1000 || form.cargaEspecial);
  const conds = [];
  if (especial) conds.push('Equipamento Especial');
  if (longa) conds.push('Obra a mais de 100 km');

  const setChk = (k, v) => set({ checklist: { ...form.checklist, [k]: v } });
  const allChk = form.checklist.proposta && form.checklist.desenho && form.checklist.nrs;

  const rows = [
    ['Comprador', form.comprador.razao || '—'],
    ['Objeto', doc.meta.descEq],
    ['Local / distância', `${form.localObra || '—'} · ${dist || 0} km`],
    ['Valor total', window.CV.brl(doc.meta.valor)],
    ['Pontos de atenção', conds.join(', ') || 'Nenhum'],
  ];

  return (
    <div className="cv-step">
      <CVStepHeader kicker="Passo 5 — Revisão" title="Revisão e checklist documental" desc="Confira o resumo, marque os anexos e libere o envio."/>
      <div className="cv-summary">
        {rows.map(([k, v], i) => (
          <div className="cv-summary-row" key={i}>
            <span className="cv-summary-k">{k}</span>
            <b className="cv-summary-v">{v}</b>
          </div>
        ))}
      </div>
      <div className="cv-field-group" style={{ marginTop: 16 }}>
        <h3 className="cv-group-title">Anexos obrigatórios</h3>
        <button type="button" className={'cv-check-row' + (form.checklist.proposta ? ' on' : '')} onClick={() => setChk('proposta', !form.checklist.proposta)}>
          <span className="cv-check-box">{form.checklist.proposta && '✓'}</span>
          <span className="cv-check-label"><b>Anexo I — Proposta Comercial</b> · PDF assinado pelo comercial</span>
        </button>
        <button type="button" className={'cv-check-row' + (form.checklist.desenho ? ' on' : '')} onClick={() => setChk('desenho', !form.checklist.desenho)}>
          <span className="cv-check-box">{form.checklist.desenho && '✓'}</span>
          <span className="cv-check-label"><b>Anexo II — Desenho(s) Técnico(s)</b> · Projeto aprovado pelo comprador</span>
        </button>
        <button type="button" className={'cv-check-row' + (form.checklist.nrs ? ' on' : '')} onClick={() => setChk('nrs', !form.checklist.nrs)}>
          <span className="cv-check-box">{form.checklist.nrs && '✓'}</span>
          <span className="cv-check-label"><b>NRs e ART</b> · Documentação de segurança</span>
        </button>
        {!allChk && <p className="cv-field-hint" style={{ marginTop: 8 }}>Marque os 3 anexos para liberar o envio.</p>}
      </div>
    </div>
  );
}

/* ============================================================
   SEND MODAL (compartilha o estilo .ci-modal)
   ============================================================ */
function CVSendModal({ record, onClose, onSent }) {
  const [channel, setChannel] = _cvUS(record.channel || 'whatsapp');
  const [contact, setContact] = _cvUS((record.recipient && record.recipient.contact) || '');
  const [name, setName] = _cvUS((record.recipient && record.recipient.name) || record.responsavel_nome || '');
  const [sent, setSent] = _cvUS(false);
  const [copied, setCopied] = _cvUS(false);
  const [sending, setSending] = _cvUS(false);

  const real = window.CVStore.signUrl(record.token);
  const valorFmt = record.valor_total_num ? window.CV.brl(record.valor_total_num) : '—';

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
      const updated = await window.CVStore.markSent(record.id, channel, { name, contact });
      if (channel === 'whatsapp') {
        window.open(window.CVStore.whatsAppHref(contact, message), '_blank');
      } else if (channel === 'email') {
        window.open(window.CVStore.mailtoHref(contact, `Contrato ${record.numero_documento} — Assinatura digital | Vertical Parts`, message), '_blank');
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
            <span className="ci-mini-title">{record.comprador_razao_social}</span>
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
                <input className="ci-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do signatário"/>
              </div>
              {channel !== 'link' && (
                <div className="ci-field">
                  <label>{channel === 'whatsapp' ? 'WhatsApp (com DDD)' : 'E-mail'}</label>
                  <input className="ci-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={channel === 'whatsapp' ? '(11) 99999-0000' : 'cliente@empresa.com.br'}/>
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
   WIZARD CONTAINER
   ============================================================ */
const CV_STEPS = [
  { id: 'cadastro',  label: 'Cadastro',  sub: 'Comprador' },
  { id: 'objeto',    label: 'Objeto',    sub: 'Equipamento' },
  { id: 'logistica', label: 'Logística', sub: 'Local & distância' },
  { id: 'preco',     label: 'Preço',     sub: 'Pagamento' },
  { id: 'revisao',   label: 'Revisão',   sub: 'Anexos & envio' },
];

function validateStep(idx, s) {
  const e = {};
  if (idx === 0) {
    if (!s.comprador.razao || !s.comprador.razao.trim()) e.razao = 'Informe a razão social.';
    if (window.CV.onlyDigits(s.comprador.cnpj).length !== 14) e.cnpj = 'CNPJ incompleto (14 dígitos).';
    if (!s.comprador.rep || !s.comprador.rep.trim()) e.rep = 'Informe o representante.';
  }
  if (idx === 3) {
    if (window.CV.parseMoney(s.valor) <= 0) e.valor = 'Informe o valor total.';
  }
  return e;
}

function CVWizard({ onCreated, initial }) {
  const [form, setForm] = _cvUS(initial || window.CV.defaultState());
  const [step, setStep] = _cvUS(0);
  const [errors, setErrors] = _cvUS({});
  const [sendRec, setSendRec] = _cvUS(null);
  const [creating, setCreating] = _cvUS(false);
  const formScrollRef = _cvUR(null);

  _cvUE(() => { if (formScrollRef.current) formScrollRef.current.scrollTop = 0; }, [step]);

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const setComp = (patch) => setForm(prev => ({ ...prev, comprador: { ...prev.comprador, ...patch } }));

  /* Master ID (Fase 2) — herda cliente + valor da Proposta selecionada,
     sem redigitar (a Proposta já tem os dados vindos do Formulário +
     Precificação — ver Fase 1). */
  const aplicarProposta = (p) => {
    const dj = p.data_json || {};
    const cli = dj.cliente || {};
    const obra = dj.obra || {};
    const valores = dj.elevador?.valores || {};
    const spec = (dj.elevador?.especificacoes || [])[0] || {};
    const qtd = Number(spec.qtd) || Number(valores.quantidade) || 1;

    /* Valor: a coluna valor_total da proposta é a fonte de verdade do total
       do contrato; só cai pro valorUnit×qtd do data_json se ela faltar. Antes
       lia só valorUnit e o contrato podia nascer R$ 0 (achado E2E C). */
    const totalProposta = Number(p.valor_total) || (Number(valores.valorUnit) || 0) * qtd || 0;

    /* Equipamento: antes NADA da especificação era herdado, então o objeto
       do contrato ficava no default ("1× Elevador Social, 10 paradas") em vez
       do equipamento real da proposta (achado E2E C). */
    const paradasInf = (String(spec.andaresParadasPortas || '').match(/\d+/) || [])[0] || '';
    const modeloInf = spec.modelo || valores.equipamento || '';
    const cargaInf = (String(spec.capacidade || '').match(/(\d+)\s*kg/i) || [])[1] || '';
    const TIPO_MAP = { passageiro: 'Social', social: 'Social', panoramico: 'Panorâmico', 'panorâmico': 'Panorâmico', carga: 'Carga', montacargas: 'Montacargas' };
    const tipoInf = TIPO_MAP[(spec.carac || '').trim().toLowerCase()] || '';

    /* Endereço: combina logradouro + número quando o número existe (registros
       novos já preservam o número — ver EnderecoAPI.mesclarLogradouro). */
    const endCli = [cli.endereco, cli.numero].filter(Boolean).join(', ');
    const endObra = [[obra.endereco, obra.numero].filter(Boolean).join(', '), obra.cidade, obra.uf].filter(Boolean).join(', ');

    setForm(prev => ({
      ...prev,
      masterId: p.master_id, propostaId: p.id,
      comprador: {
        ...prev.comprador,
        razao: cli.nome || prev.comprador.razao,
        cnpj: cli.cnpj || prev.comprador.cnpj,
        rep: cli.responsavel || prev.comprador.rep,
        email: cli.email || prev.comprador.email,
        tel: cli.telefone || prev.comprador.tel,
        endereco: endCli || prev.comprador.endereco,
      },
      localObra: endObra || prev.localObra,
      // valor é guardado no formato mascarado pt-BR ("185.022,00") — o mesmo
      // que o CVMoneyField produz e que parseMoney lê (dígitos como centavos).
      // Antes gravava "185022" cru, que parseMoney lia como R$ 1.850,22 (÷100).
      valor: totalProposta ? window.CV.maskMoney(String(Math.round(totalProposta * 100))) : prev.valor,
      qtd: qtd || prev.qtd,
      tipo: tipoInf || prev.tipo,
      paradas: paradasInf || prev.paradas,
      modelo: modeloInf || prev.modelo,
      carga: cargaInf || prev.carga,
    }));
  };

  const valorNum = window.CV.parseMoney(form.valor);
  const docPreview = _cvUM(() => window.CV.buildContract({ form, comprador: form.comprador, valor: valorNum, sinalPct: form.sinalPct, parcelas: form.parcelas, numero: 'VPVE________' }), [form]);

  const goNext = () => {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (step < CV_STEPS.length - 1) setStep(step + 1);
  };
  const goPrev = () => { setErrors({}); if (step > 0) setStep(step - 1); };
  const goTo = (i) => { setErrors({}); setStep(i); };

  const completeAll = () => {
    let all = {};
    [0, 3].forEach(i => { all = { ...all, ...validateStep(i, form) }; });

    // ISSUE #6: Validar anexos obrigatórios
    if (!form.checklist.proposta || !form.checklist.desenho || !form.checklist.nrs) {
      all.__checklist = 'Marque os 3 anexos obrigatórios (Proposta, Desenho, NRs).';
    }

    // ISSUE #6: Validar que Dossier está vinculado
    if (!form.dossier_id) {
      all.__dossier = 'Contrato deve estar vinculado a um Dossier da Obra.';
    }

    // ISSUE #6: Validar valores monetários (não permitir NaN ou 0)
    if (window.CV.parseMoney(form.valor) <= 0) {
      all.__valor = 'Valor total deve ser maior que zero.';
    }

    if (Object.keys(all).length > 0) {
      setErrors(all);
      // Bug real: quando o único problema era checklist/dossier/valor (todos
      // do Passo 5 — Revisão), a função só resetava o passo (sempre pra 0 ou
      // 3) e retornava false EM SILÊNCIO — nenhum toast, nenhum alert, nada.
      // O usuário clicava "Gerar e enviar" e nada visível acontecia.
      const firstBad = Object.keys(validateStep(0, form)).length ? 0
        : Object.keys(validateStep(3, form)).length ? 3
        : 4; // __checklist / __dossier / __valor pertencem ao Passo 5 (Revisão)
      setStep(firstBad);
      const mensagens = [all.__checklist, all.__dossier, all.__valor].filter(Boolean);
      if (mensagens.length) alert(mensagens.join('\n'));
      else if (firstBad !== 4) alert('Preencha os campos obrigatórios antes de gerar o contrato.');
      return false;
    }
    return true;
  };

  const handleCreateAndSend = async () => {
    if (!completeAll() || creating) return;
    setCreating(true);
    try {
      const rec = await window.CVStore.createDraft(form);
      setSendRec(rec);
      onCreated && onCreated(rec);
    } catch (e) {
      alert('Erro ao gerar contrato: ' + (e.message || e));
    } finally {
      setCreating(false);
    }
  };

  let StepComp;
  if (step === 0) StepComp = <CVStepCadastro form={form} setComp={setComp} errors={errors} onSelecionarProposta={aplicarProposta}/>;
  else if (step === 1) StepComp = <CVStepObjeto form={form} set={set}/>;
  else if (step === 2) StepComp = <CVStepLogistica form={form} set={set}/>;
  else if (step === 3) StepComp = <CVStepPreco form={form} set={set} errors={errors}/>;
  else StepComp = <CVStepRevisao form={form} set={set} doc={docPreview}/>;

  return (
    <div className="ci-wiz">
      <nav className="ci-stepbar">
        {CV_STEPS.map((st, i) => (
          <button key={st.id} className={'ci-stepbar-item' + (i === step ? ' is-active' : '') + (i < step ? ' is-done' : '')} onClick={() => goTo(i)}>
            <span className="ci-stepbar-num">{i < step ? '✓' : String(i + 1)}</span>
            <span className="ci-stepbar-text"><b>{st.label}</b><small>{st.sub}</small></span>
            {i < CV_STEPS.length - 1 && <span className="ci-stepbar-line"></span>}
          </button>
        ))}
      </nav>

      <div className="ci-wiz-body">
        <div className="ci-form-col" ref={formScrollRef}>
          <div className="ci-form-inner">{StepComp}</div>
          <div className="ci-form-foot">
            <button className="ci-btn ci-btn--ghost" onClick={goPrev} disabled={step === 0}>← Voltar</button>
            <span className="ci-form-foot-meta">Passo {step + 1} de {CV_STEPS.length}</span>
            {step < CV_STEPS.length - 1
              ? <button className="ci-btn ci-btn--dark" onClick={goNext}>Avançar →</button>
              : <button className="ci-btn ci-btn--primary" onClick={handleCreateAndSend} disabled={creating}>{creating ? 'Gerando…' : 'Gerar e enviar para assinatura →'}</button>}
          </div>
        </div>
        <div className="ci-preview-col">
          <div className="ci-preview-bar">
            <span className="ci-preview-bar-title">Pré-visualização</span>
            <div className="ci-preview-bar-conds">
              {docPreview.meta.especial && <span className="ci-pv-cond ci-pv-cond--warn">Equipamento Especial</span>}
              {docPreview.meta.longa && <span className="ci-pv-cond ci-pv-cond--warn">Obra a mais de 100 km</span>}
              {!docPreview.meta.especial && !docPreview.meta.longa && <span className="ci-pv-cond ci-pv-cond--muted">Sem pontos de atenção</span>}
            </div>
          </div>
          <div className="ci-preview-scroll">
            <window.CVContractPreview doc={docPreview} highlightInjected={true}/>
          </div>
        </div>
      </div>

      {sendRec && <CVSendModal record={sendRec} onClose={() => { setSendRec(null); setForm(window.CV.defaultState()); setStep(0); }} onSent={() => {}}/>}
    </div>
  );
}

/* ============================================================
   DASHBOARD — listagem
   ============================================================ */
function CVBadge({ status }) {
  const st = window.CVStore.STATUS[status] || window.CVStore.STATUS.rascunho;
  return <span className={'ci-badge ci-badge--' + st.tone}><span className="ci-badge-dot"></span>{st.label}</span>;
}

const CV_TL_SEQ = ['rascunho', 'enviado', 'visualizado', 'assinado'];

function CVTimeline({ rec }) {
  const byStatus = {};
  (rec.log || []).forEach(l => { byStatus[l.status] = l; });
  const terminal = (rec.status === 'expirado' || rec.status === 'recusado') ? rec.status : null;
  const curIdx = CV_TL_SEQ.indexOf(rec.status);
  const steps = CV_TL_SEQ.map((sid, i) => {
    const st = window.CVStore.STATUS[sid];
    const entry = byStatus[sid];
    let cls = 'pending';
    if (entry) cls = (i === curIdx && !terminal) ? 'current' : 'done';
    if (terminal && i <= curIdx) cls = 'done';
    return { st, entry, cls };
  });
  if (terminal) steps.push({ st: window.CVStore.STATUS[terminal], entry: byStatus[terminal], cls: 'current' });

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
              {s.entry ? window.CVStore.fmtDateTime(s.entry.at) : 'Pendente'}
              {s.entry && s.entry.meta && s.entry.meta.channel ? ' · ' + (s.entry.meta.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail') : ''}
              {s.entry && s.entry.meta && s.entry.meta.ip ? ' · IP ' + s.entry.meta.ip : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CVAuditRow({ k, v }) {
  return <div className="ci-audit-row"><span className="k">{k}</span><span className="v">{v || '—'}</span></div>;
}

/* ISSUE #6: marcos do D0 — pagamento da entrada, assinatura do contrato e
   projeto aprovado pela Engenharia. D0 é o mais recente dos 3; a entrega
   prevista é D0 + 120 dias. Assinatura vem do evento real (signed_at),
   não é editável aqui — só entrada e projeto, que ainda não têm um fluxo
   próprio de captura automática. */
function CVD0Section({ rec, onSaved }) {
  const fs = rec.form_state || {};
  const [d0Entrada, setD0Entrada] = _cvUS(fs.d0_entrada || '');
  const [d0Projeto, setD0Projeto] = _cvUS(fs.d0_projeto || '');
  const [saving, setSaving] = _cvUS(false);
  const dirty = d0Entrada !== (fs.d0_entrada || '') || d0Projeto !== (fs.d0_projeto || '');

  const d0Assinatura = rec.signed_at ? rec.signed_at.slice(0, 10) : (fs.d0_assinatura || '');
  const d0 = window.CV.calcularD0(d0Entrada, d0Assinatura, d0Projeto);
  const entregaPrevista = d0 ? window.CV.addDias(d0, 120) : null;

  const salvar = async () => {
    setSaving(true);
    try {
      const novo = await window.CVStore.updateFormState(rec.id, {
        ...fs, d0_entrada: d0Entrada, d0_projeto: d0Projeto, d0_assinatura: d0Assinatura, d0, entrega_prevista: entregaPrevista,
      });
      onSaved && onSaved(novo);
    } catch (e) {
      alert('Erro ao salvar marcos do D0: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ci-drawer-sec">
      <h3 className="ci-drawer-sec-title">Cronograma · D0</h3>
      <p className="cv-field-hint" style={{ marginBottom: 10, display: 'block' }}>
        D0 é a data do marco mais recente entre os 3 abaixo; a entrega prevista é D0 + 120 dias (cláusula 2.5).
      </p>
      <div className="cv-grid">
        <CVField label="Pagamento da entrada" type="date" value={d0Entrada} onChange={setD0Entrada}/>
        <CVField label="Projeto aprovado (Engenharia)" type="date" value={d0Projeto} onChange={setD0Projeto}/>
      </div>
      <div className="ci-audit" style={{ marginTop: 12 }}>
        <CVAuditRow k="Assinatura do contrato" v={d0Assinatura ? window.CVStore.fmtDate(d0Assinatura) : 'aguardando assinatura (preenchido sozinho quando o cliente assinar)'}/>
        <CVAuditRow k="D0 (marco mais recente)" v={d0 ? window.CVStore.fmtDate(d0) : 'aguardando os 3 marcos'}/>
        <CVAuditRow k="Entrega prevista (D0 + 120 dias)" v={entregaPrevista ? window.CVStore.fmtDate(entregaPrevista) : '—'}/>
      </div>
      {dirty && (
        <button className="ci-btn ci-btn--primary" onClick={salvar} disabled={saving} style={{ marginTop: 10 }}>
          {saving ? 'Salvando…' : 'Salvar marcos'}
        </button>
      )}
    </div>
  );
}

function CVAuditDrawer({ rec, onClose, onResend, onRefresh }) {
  const a = rec.audit || {};
  const del = async () => {
    if (!window.confirm('Excluir este contrato do painel?')) return;
    await window.CVStore.remove(rec.id);
    onClose(); onRefresh();
  };
  const valorFmt = rec.valor_total_num ? window.CV.brl(rec.valor_total_num) : '—';
  const signUrl = window.CVStore.signUrl(rec.token);
  return (
    <div className="ci-drawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ci-drawer">
        <div className="ci-drawer-head">
          <div>
            <h2>{rec.numero_documento}</h2>
            <div className="ci-drawer-co">{rec.comprador_razao_social}</div>
            <div style={{ marginTop: 10 }}><CVBadge status={rec.status}/></div>
          </div>
          <button className="ci-drawer-x" onClick={onClose}>✕</button>
        </div>
        <div className="ci-drawer-body">
          <div className="ci-drawer-sec">
            <h3 className="ci-drawer-sec-title">Linha do tempo</h3>
            <CVTimeline rec={rec}/>
          </div>
          <div className="ci-drawer-sec">
            <h3 className="ci-drawer-sec-title">Trilha de auditoria</h3>
            <div className="ci-audit">
              <CVAuditRow k="Comprador" v={rec.comprador_razao_social}/>
              <CVAuditRow k="Representante" v={rec.responsavel_nome}/>
              <CVAuditRow k="Objeto" v={rec.objeto_resumo}/>
              <CVAuditRow k="Valor total" v={valorFmt}/>
              <CVAuditRow k="Enviado em" v={window.CVStore.fmtDateTime(rec.sent_at)}/>
              <CVAuditRow k="Canal" v={rec.channel === 'whatsapp' ? 'WhatsApp' : rec.channel === 'email' ? 'E-mail' : rec.channel === 'link' ? 'Link copiado' : '—'}/>
              <CVAuditRow k="Destinatário" v={rec.recipient && rec.recipient.contact}/>
              <CVAuditRow k="Validade do link" v={rec.expires_at ? window.CVStore.fmtDate(rec.expires_at) : '—'}/>
              {a.viewedAt && <CVAuditRow k="Visualizado em" v={window.CVStore.fmtDateTime(a.viewedAt)}/>}
              {a.viewedAt && <CVAuditRow k="IP (visualização)" v={a.viewIp || 'não capturado'}/>}
              {a.viewedAt && <CVAuditRow k="Dispositivo (visualização)" v={a.viewDevice}/>}
              {a.signedAt && <CVAuditRow k="Assinado em" v={window.CVStore.fmtDateTime(a.signedAt)}/>}
              {a.signedAt && <CVAuditRow k="Signatário" v={a.signerName}/>}
              {a.signedAt && <CVAuditRow k="Tipo de assinatura" v={a.signatureType === 'draw' ? 'Desenhada' : 'Digitada'}/>}
              {a.signedAt && <CVAuditRow k="IP (assinatura)" v={a.signIp || 'não capturado'}/>}
              {a.signedAt && <CVAuditRow k="Dispositivo (assinatura)" v={a.signDevice}/>}
              {a.hash && <CVAuditRow k="Hash SHA-256" v={a.hash}/>}
            </div>
            {a.signedAt && (
              <div className="ci-legal-note">
                Documento assinado eletronicamente nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.
                A integridade é garantida pelo hash SHA-256 acima.
              </div>
            )}
          </div>
          <CVD0Section rec={rec} onSaved={onRefresh}/>
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

function CVDashboard() {
  const [contracts, setContracts] = _cvUS([]);
  const [loading, setLoading] = _cvUS(true);
  const [filter, setFilter] = _cvUS('todos');
  const [query, setQuery] = _cvUS('');
  const [drawerId, setDrawerId] = _cvUS(null);
  const [sendRec, setSendRec] = _cvUS(null);

  const refresh = async () => {
    setLoading(true);
    const list = await window.CVStore.listAll();
    setContracts(list);
    setLoading(false);
  };

  _cvUE(() => {
    window.CVStore.sweepExpired().then(refresh);
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const drawerRec = drawerId ? contracts.find(c => c.id === drawerId) : null;

  const counts = _cvUM(() => {
    const c = { rascunho: 0, enviado: 0, visualizado: 0, assinado: 0 };
    contracts.forEach(x => { if (x.status === 'recusado' || x.status === 'expirado') return; c[x.status] = (c[x.status] || 0) + 1; });
    return c;
  }, [contracts]);

  const filtered = contracts.filter(c => {
    if (filter !== 'todos' && c.status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      return ((c.numero_documento || '') + ' ' + (c.comprador_razao_social || '') + ' ' + (c.responsavel_nome || '')).toLowerCase().includes(q);
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
    return l ? window.CVStore.relative(l.at) : '';
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
            <div className="ci-stat-label">{window.CVStore.STATUS[sc.id].label}</div>
          </div>
        ))}
      </div>

      <div className="ci-panel">
        <div className="ci-panel-head">
          <h2>{filter === 'todos' ? 'Todos os contratos' : window.CVStore.STATUS[filter].label}</h2>
          <div className="ci-panel-search">
            <input placeholder="Buscar nº, comprador, representante…" value={query} onChange={(e) => setQuery(e.target.value)}/>
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
                  <td><div className="ci-cell-co">{c.comprador_razao_social}</div><div className="ci-cell-num">{c.numero_documento}</div></td>
                  <td><div className="ci-cell-obj">{c.objeto_resumo}</div><div className="ci-cell-resp">{c.responsavel_nome || '—'}</div></td>
                  <td className="ci-cell-val">{c.valor_total_num ? window.CV.brl(c.valor_total_num) : '—'}</td>
                  <td><CVBadge status={c.status}/></td>
                  <td className="ci-cell-time">{lastActivity(c)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="ci-cell-actions">
                      <button className="ci-icon-btn" title="Auditoria" onClick={() => setDrawerId(c.id)}>👁</button>
                      <a className="ci-icon-btn" title="Abrir assinatura" href={window.CVStore.signUrl(c.token)} target="_blank" rel="noopener">🔗</a>
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

      {drawerRec && <CVAuditDrawer rec={drawerRec} onClose={() => setDrawerId(null)} onResend={(r) => setSendRec(r)} onRefresh={refresh}/>}
      {sendRec && <CVSendModal record={sendRec} onClose={() => setSendRec(null)} onSent={refresh}/>}
    </div>
  );
}

/* ============================================================
   PAGE — abas Painel / Novo
   ============================================================ */
function ContratoVendaEquipamentosPage() {
  const [tab, setTab] = _cvUS('painel');
  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <div className="ci-page-titles">
          <div className="ci-page-kicker">JURÍDICO · CONTRATO VENDA DE EQUIPAMENTOS</div>
          <h1 className="ci-page-title">CONTRATO VENDA DE EQUIPAMENTOS</h1>
          <p className="ci-page-sub">Compra, venda e instalação para Clientes finais · assinatura digital com auditoria</p>
        </div>
        <div className="ci-page-actions-wrap">
          <div className="ci-page-actions">
            <button className={'ci-tab' + (tab === 'painel' ? ' on' : '')} onClick={() => setTab('painel')}>▦ Painel</button>
            <button className={'ci-tab' + (tab === 'novo' ? ' on' : '')} onClick={() => setTab('novo')}>+ Novo contrato</button>
          </div>
        </div>
      </div>
      <div className="ci-page-body">
        {tab === 'painel' ? <CVDashboard/> : <CVWizard onCreated={() => setTab('painel')}/>}
      </div>
    </div>
  );
}

window.ContratoVendaEquipamentosPage = ContratoVendaEquipamentosPage;
