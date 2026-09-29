/* ============================================================
   contrato-venda.jsx
   ContratoVendaEquipamentosPage — wizard + dashboard + send modal
   tudo persistindo em contratos_venda_equipamentos via Supabase.
   ============================================================ */
const { useState: _cvUS, useEffect: _cvUE, useMemo: _cvUM, useRef: _cvUR, useCallback: _cvUC } = React;

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

function CVStepRevisao({ form, set, doc, dossierProvisioning }) {
  const dist = parseFloat(String(form.distancia || '0').replace(',', '.')) || 0;
  const longa = dist >= 100;
  const cargaNum = parseFloat(String(form.carga || '0').replace(',', '.')) || 0;
  const especial = form.tipoEquip === 'ELEVADOR' && (cargaNum >= 1000 || form.cargaEspecial);
  const conds = [];
  if (especial) conds.push('Equipamento Especial');
  if (longa) conds.push('Obra a mais de 100 km');

  const setChk = (k, v) => set({ checklist: { ...form.checklist, [k]: v } });
  const allChk = form.checklist.proposta && form.checklist.nrs;

  const rows = [
    ['Comprador', form.comprador.razao || '—'],
    ['Objeto', doc.meta.descEq],
    ['Local / distância', `${form.localObra || '—'} · ${dist || 0} km`],
    ['Valor total', window.CV.brl(doc.meta.valor)],
    ['Pontos de atenção', conds.join(', ') || 'Nenhum'],
    ['Dossiê da Obra', form.dossier_id || (dossierProvisioning ? 'Vinculando…' : 'Será vinculado ao gerar')],
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
        <div className="cv-cond-alert" style={{ margin: '8px 0' }}>
          O(s) Desenho(s) Técnico(s) — Anexo II (Projeto de Instalação) não são mais anexados aqui: a Engenharia envia
          separadamente, de dentro do próprio contrato, depois que o sinal for pago (Financeiro), o contrato for
          assinado e o Jurídico der o aval.
        </div>
        <button type="button" className={'cv-check-row' + (form.checklist.nrs ? ' on' : '')} onClick={() => setChk('nrs', !form.checklist.nrs)}>
          <span className="cv-check-box">{form.checklist.nrs && '✓'}</span>
          <span className="cv-check-label"><b>NRs e ART</b> · Documentação de segurança</span>
        </button>
        {!allChk && <p className="cv-field-hint" style={{ marginTop: 8 }}>Marque os anexos para liberar o envio.</p>}
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
        /* 29/09 — mesmo padrão já aplicado em RFQ (formulario-elevador.jsx)
           e Proposta (proposta-editor.jsx): tenta send-email (SMTP direto)
           primeiro, com numeroCotacao/referenciaTipo/referenciaId pra ficar
           em Enviados/Linha do Tempo e o read-inbox conseguir casar a
           resposta do cliente de volta a este contrato. Cai pro mailto:
           (como sempre foi) só se o envio direto falhar — nunca deixa o
           vendedor sem alternativa. numeroCotacao vem de numero_documento
           (VPCV-0950 → 950); contrato sem Proposta de origem (formato
           VPVE...) não tem número pra extrair — cai direto pro mailto:,
           sem tentar send-email com numeroCotacao null. */
        const numeroCotacao = window.MasterIdEngine?.parseNumeroCotacao?.(record.numero_documento) ?? null;
        const sb = window.__VP_SB && window.__VP_SB.sb;
        let enviouDireto = false;
        if (sb && numeroCotacao != null) {
          const { data: emailData, error: emailError } = await sb.functions.invoke('send-email', {
            body: {
              to: contact, subject: `Contrato ${record.numero_documento} — Assinatura digital | Vertical Parts`, text: message,
              numeroCotacao, referenciaTipo: 'contrato_venda', referenciaId: record.id,
            },
          });
          if (!emailError) {
            enviouDireto = true;
            if (emailData && emailData.avisoPersistencia) window.toast?.(emailData.avisoPersistencia, 'warning');
          } else {
            console.warn('[CVSendModal] send-email falhou, caindo pro mailto:', emailError);
          }
        }
        if (!enviouDireto) {
          window.open(window.CVStore.mailtoHref(contact, `Contrato ${record.numero_documento} — Assinatura digital | Vertical Parts`, message), '_blank');
          window.toast?.('Não foi possível enviar direto (envio automático falhou ou este contrato não tem Nº de Cotação) — abrindo seu e-mail padrão para envio manual. Esse envio não ficará registrado em Enviados/Linha do Tempo.', 'warning');
        }
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

function CVWizard({ onCreated, initial, prefillProposta }) {
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

    /* Discriminação por equipamento (Fase 2 da granularidade de valor) —
       só informativa na cláusula 3.1.1, não muda o valor total do contrato
       acima. Mesmo shape de elevador.valores.itens[] da Proposta. */
    const itensEquipamento = (valores.itens || []).map((it) => ({
      id: it.id, equipamento: it.equipamento, quantidade: it.quantidade, valorUnit: it.valorUnit,
    }));

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

    /* Sinal/Parcelas: a Proposta já calcula isso (Sinal de 40% + N parcelas
       iguais, proposta-form.jsx/proposta-heranca.js) mas o Contrato de Venda
       nunca lia esse dado — sempre caía no default do wizard (30%/5x),
       desalinhado do que o vendedor já ajustou na Proposta. O modelo de dado
       é diferente: valores.qtdParcelas conta TODAS as linhas da tabela da
       Proposta (sinal + parcelas do saldo), enquanto form.parcelas aqui conta
       só as parcelas do saldo (sem a linha do sinal) — por isso o -1.
       O percentual do sinal na Proposta é sempre fixo em 40% (hardcoded em
       gerarParcelasAutomaticas), não configurável por lá. */
    let sinalPctInf = null;
    let parcelasInf = null;
    if (valores.formaTipo === 'vista') {
      sinalPctInf = 100;
      parcelasInf = 0;
    } else if (valores.formaTipo === 'parcelado' && Number(valores.qtdParcelas) > 0) {
      sinalPctInf = 40;
      parcelasInf = Math.max(Number(valores.qtdParcelas) - 1, 0);
    }

    setForm(prev => ({
      ...prev,
      masterId: p.master_id, propostaId: p.id,
      sinalPct: sinalPctInf != null ? sinalPctInf : prev.sinalPct,
      parcelas: parcelasInf != null ? parcelasInf : prev.parcelas,
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
      itensEquipamento: itensEquipamento.length ? itensEquipamento : prev.itensEquipamento,
      qtd: qtd || prev.qtd,
      tipo: tipoInf || prev.tipo,
      paradas: paradasInf || prev.paradas,
      modelo: modeloInf || prev.modelo,
      carga: cargaInf || prev.carga,
    }));
  };

  /* Aberto pela fila "aguardando contrato" do Painel: já entra com a proposta
     assinada herdada, sem o usuário reselecionar (achado E2E reteste B). */
  _cvUE(() => { if (prefillProposta) aplicarProposta(prefillProposta); }, [prefillProposta && prefillProposta.id]);

  const valorNum = window.CV.parseMoney(form.valor);
  const docPreview = _cvUM(() => window.CV.buildContract({ form, comprador: form.comprador, valor: valorNum, sinalPct: form.sinalPct, parcelas: form.parcelas, numero: 'VPVE________' }), [form]);

  /* Campos obrigatórios ainda pendentes (mesma regra que bloqueia o "Gerar").
     Sem isto, o preview dizia "Sem pontos de atenção" enquanto a validação
     travava em "Informe o representante" — contradição pega no reteste E2E. */
  const pendencias = _cvUM(() => ({ ...validateStep(0, form), ...validateStep(3, form) }), [form]);
  const nPendencias = Object.keys(pendencias).length;

  /* Provisiona o Dossier da Obra assim que o usuário chega na Revisão (Passo
     5) — antes travava em silêncio no "Gerar" sem nenhum jeito de resolver
     (achado E2E). Criar cedo, em vez de só no submit, deixa o vínculo visível
     na tela de revisão antes de enviar. */
  const [dossierProvisioning, setDossierProvisioning] = _cvUS(false);
  _cvUE(() => {
    if (step !== 4 || form.dossier_id || dossierProvisioning) return;
    setDossierProvisioning(true);
    window.CVStore.garantirDossier(form)
      .then((id) => setForm((prev) => ({ ...prev, dossier_id: id })))
      .catch((e) => console.error('[CV] garantirDossier falhou:', e))
      .finally(() => setDossierProvisioning(false));
  }, [step, form.dossier_id]);

  const goNext = () => {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (step < CV_STEPS.length - 1) setStep(step + 1);
  };
  const goPrev = () => { setErrors({}); if (step > 0) setStep(step - 1); };
  const goTo = (i) => { setErrors({}); setStep(i); };

  const completeAll = (f) => {
    f = f || form;
    let all = {};
    [0, 3].forEach(i => { all = { ...all, ...validateStep(i, f) }; });

    // ISSUE #6: Validar anexos obrigatórios (Desenho saiu daqui — ver
    // CVDesenhoInstalacaoSection, enviado separadamente após sinal pago +
    // contrato assinado + aval Jurídico).
    if (!f.checklist.proposta || !f.checklist.nrs) {
      all.__checklist = 'Marque os anexos obrigatórios (Proposta, NRs).';
    }

    // Dossier da Obra — normalmente já provisionado automaticamente (ver
    // efeito acima) assim que o usuário chega na Revisão; este check só
    // pega o caso raro de a criação ter falhado (ex.: rede caiu).
    if (!f.dossier_id) {
      all.__dossier = 'Não foi possível vincular o Dossier da Obra automaticamente — tente novamente.';
    }

    // ISSUE #6: Validar valores monetários (não permitir NaN ou 0)
    if (window.CV.parseMoney(f.valor) <= 0) {
      all.__valor = 'Valor total deve ser maior que zero.';
    }

    if (Object.keys(all).length > 0) {
      setErrors(all);
      // Bug real: quando o único problema era checklist/dossier/valor (todos
      // do Passo 5 — Revisão), a função só resetava o passo (sempre pra 0 ou
      // 3) e retornava false EM SILÊNCIO — nenhum toast, nenhum alert, nada.
      // O usuário clicava "Gerar e enviar" e nada visível acontecia.
      const firstBad = Object.keys(validateStep(0, f)).length ? 0
        : Object.keys(validateStep(3, f)).length ? 3
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
    if (creating) return;
    setCreating(true);
    try {
      // Fallback do efeito acima — cobre o clique acontecer antes do
      // provisionamento automático terminar.
      let f = form;
      if (!f.dossier_id) {
        const dossierId = await window.CVStore.garantirDossier(f);
        f = { ...f, dossier_id: dossierId };
        setForm(f);
      }
      if (!completeAll(f)) { setCreating(false); return; }
      const rec = await window.CVStore.createDraft(f);
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
  else StepComp = <CVStepRevisao form={form} set={set} doc={docPreview} dossierProvisioning={dossierProvisioning}/>;

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
            <button className="ci-btn" type="button" onClick={() => cvBaixarPdf(docPreview, 'Contrato - rascunho.pdf')}>⬇ Baixar PDF</button>
            <div className="ci-preview-bar-conds">
              {nPendencias > 0 && <span className="ci-pv-cond ci-pv-cond--warn" title={Object.values(pendencias).join(' ')}>{nPendencias} campo{nPendencias > 1 ? 's' : ''} obrigatório{nPendencias > 1 ? 's' : ''} pendente{nPendencias > 1 ? 's' : ''}</span>}
              {docPreview.meta.especial && <span className="ci-pv-cond ci-pv-cond--warn">Equipamento Especial</span>}
              {docPreview.meta.longa && <span className="ci-pv-cond ci-pv-cond--warn">Obra a mais de 100 km</span>}
              {nPendencias === 0 && !docPreview.meta.especial && !docPreview.meta.longa && <span className="ci-pv-cond ci-pv-cond--muted">Sem pontos de atenção</span>}
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

/* 29/09 — indicador "respondeu por e-mail" (achado da investigação do
   Inbox único: nenhuma tela de Contrato mostrava isso, resposta ficava só
   solta no Inbox genérico). Só usa `referencia_id` (aponta pra ESTE
   contrato, gravado pelo send-email/read-inbox quando o Message-ID casa)
   — DE PROPÓSITO sem fallback por numero_cotacao como o FEEmailRespondidoBadge
   (formulario-elevador.jsx) faz: aqui o mesmo numero_cotacao é compartilhado
   por RFQ/Proposta/Contrato de Venda/Contrato Instalador do mesmo negócio,
   então um match só por numero_cotacao não sabe dizer se a resposta é
   sobre ESTE contrato ou sobre outro documento da mesma cotação — prefere
   não mostrar nada a mostrar errado. */
function CVEmailRespondidoBadge({ contratoId }) {
  const [temResposta, setTemResposta] = React.useState(false);
  React.useEffect(() => {
    let cancelado = false;
    setTemResposta(false);
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb || !contratoId) return;
    sb.from('emails_projeto').select('id', { count: 'exact', head: true })
      .eq('direcao', 'entrada').is('excluido_em', null).eq('referencia_id', String(contratoId))
      .then(({ count }) => { if (!cancelado) setTemResposta((count || 0) > 0); })
      .catch(() => { if (!cancelado) setTemResposta(false); });
    return () => { cancelado = true; };
  }, [contratoId]);
  if (!temResposta) return null;
  return (
    <span className="ci-badge ci-badge--blue" style={{ marginLeft: 6 }} title="Existe e-mail recebido vinculado a este contrato (Message-ID)">
      <span className="ci-badge-dot"></span>Respondeu por e-mail
    </span>
  );
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

const CVS_STATUS = {
  pendente:    { label: 'Pendente',     tone: 'gray' },
  enviado:     { label: 'Enviado',      tone: 'blue' },
  visualizado: { label: 'Visualizado',  tone: 'yellow' },
  assinado:    { label: 'Assinado',     tone: 'green' },
  recusado:    { label: 'Recusado',     tone: 'red' },
};
function CVSBadge({ status }) {
  const st = CVS_STATUS[status] || CVS_STATUS.pendente;
  return <span className={'ci-badge ci-badge--' + st.tone}><span className="ci-badge-dot"></span>{st.label}</span>;
}

/* Signatários adicionais (sócios/jurídico do Comprador) — pedido explícito
   do usuário: além do representante principal (que continua no fluxo já
   existente, intocado), o Comprador pode exigir que sócios e/ou o
   jurídico dele também assinem. Cada um tem seu próprio link (1 token por
   pessoa); o contrato só vira "Assinado" de verdade quando todos aqui +
   o representante tiverem assinado — ver contrato-venda-store.js
   (markSigned/tentarFinalizarAposSignatarioExtra). Opcional: um contrato
   sem nenhum signatário adicional cadastrado se comporta exatamente como
   antes desta feature. */
function CVSignatariosSection({ rec, onSaved }) {
  const [lista, setLista] = _cvUS(null);
  const [novo, setNovo] = _cvUS({ papel: '', nome: '', email: '', telefone: '' });
  const [adding, setAdding] = _cvUS(false);
  const [busyId, setBusyId] = _cvUS(null);

  const carregar = _cvUC(async () => {
    if (!window.CVSignatarioStore) return;
    const l = await window.CVSignatarioStore.listarPorContrato(rec.id);
    setLista(l);
  }, [rec.id]);
  _cvUE(() => { carregar(); }, [carregar]);

  if (!window.CVSignatarioStore) return null;

  const adicionar = async () => {
    setAdding(true);
    try {
      await window.CVSignatarioStore.adicionar(rec.id, novo, (lista || []).length);
      setNovo({ papel: '', nome: '', email: '', telefone: '' });
      await carregar();
      window.toast?.('Signatário adicionado.', 'success');
    } catch (err) {
      window.toast?.('Erro ao adicionar: ' + (err.message || err), 'error');
    } finally {
      setAdding(false);
    }
  };

  const remover = async (s) => {
    if (!window.confirm(`Remover ${s.nome} (${s.papel}) da lista de signatários?`)) return;
    await window.CVSignatarioStore.remover(s.id);
    await carregar();
    onSaved && onSaved();
  };

  const enviar = async (s, canal) => {
    setBusyId(s.id);
    try {
      const url = window.CVSignatarioStore.signUrl(s.token);
      const msg = `Olá ${s.nome}, segue o link para assinatura do Contrato ${rec.numero_documento} (${s.papel}) — VerticalParts:\n${url}`;
      if (canal === 'whatsapp') window.open(window.CVStore.whatsAppHref(s.telefone, msg), '_blank');
      if (canal === 'email') window.open(window.CVStore.mailtoHref(s.email, `Assinatura — Contrato ${rec.numero_documento}`, msg), '_blank');
      if (canal === 'link') { try { await navigator.clipboard.writeText(url); } catch (e) {} window.toast?.('Link copiado.', 'success'); }
      await window.CVSignatarioStore.marcarEnviado(s.id, canal, { contact: canal === 'whatsapp' ? s.telefone : s.email });
      await carregar();
    } catch (err) {
      window.toast?.('Erro ao enviar: ' + (err.message || err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ci-drawer-sec">
      <h3 className="ci-drawer-sec-title">Signatários adicionais (sócios/jurídico do Comprador)</h3>
      <p className="cv-field-hint" style={{ marginBottom: 10, display: 'block' }}>
        Opcional — além do representante acima, adicione quem mais precisa assinar este contrato. O contrato só fica "Assinado" quando todos aqui + o representante tiverem assinado.
      </p>
      {(lista || []).map((s) => (
        <div key={s.id} className="ci-audit-row" style={{ alignItems: 'center', gap: 8 }}>
          <span className="k">{s.papel} — {s.nome}</span>
          <span className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <CVSBadge status={s.status}/>
            {s.status !== 'assinado' && (
              <>
                <button className="ci-mini-btn" disabled={busyId === s.id || !s.telefone} onClick={() => enviar(s, 'whatsapp')}>WhatsApp</button>
                <button className="ci-mini-btn" disabled={busyId === s.id || !s.email} onClick={() => enviar(s, 'email')}>E-mail</button>
                <button className="ci-mini-btn" disabled={busyId === s.id} onClick={() => enviar(s, 'link')}>Copiar link</button>
                <button className="ci-mini-btn" onClick={() => remover(s)}>Remover</button>
              </>
            )}
          </span>
        </div>
      ))}
      {(!lista || lista.length === 0) && <div className="small muted" style={{ marginBottom: 8 }}>Nenhum signatário adicional.</div>}
      <div className="cv-grid" style={{ marginTop: 10 }}>
        <CVField label="Papel" value={novo.papel} onChange={(v) => setNovo({ ...novo, papel: v })} placeholder="Sócio, Jurídico…"/>
        <CVField label="Nome" value={novo.nome} onChange={(v) => setNovo({ ...novo, nome: v })} placeholder="Nome completo"/>
        <CVField label="E-mail" value={novo.email} onChange={(v) => setNovo({ ...novo, email: v })} placeholder="email@empresa.com"/>
        <CVField label="Telefone" value={novo.telefone} onChange={(v) => setNovo({ ...novo, telefone: v })} placeholder="(11) 99999-9999"/>
      </div>
      <button className="ci-btn ci-btn--ghost" style={{ marginTop: 10 }} disabled={adding || !novo.papel.trim() || !novo.nome.trim()} onClick={adicionar}>{adding ? 'Adicionando…' : '+ Adicionar signatário'}</button>
    </div>
  );
}

/* Desenho do Projeto de Instalação — não é mais anexado no wizard (ver
   CVStepRevisao, checklist antigo "Anexo II"); a Engenharia anexa e envia
   daqui, só depois que as 3 condições abaixo baterem (pedido explícito do
   usuário: sinal pago + aval Financeiro, contrato assinado + aval
   Jurídico). Histórico de envios fica em rec.desenho_instalacao.envios —
   permite reenviar sem anexar de novo. */
function CVDesenhoInstalacaoSection({ rec, onSaved }) {
  const [gate, setGate] = _cvUS(null); // {sinalPago, contratoAssinado, avalJuridico}
  const [uploading, setUploading] = _cvUS(false);
  const [sending, setSending] = _cvUS(false);
  const desenho = rec.desenho_instalacao || {};

  const carregarGate = _cvUC(async () => {
    const [av, aj] = await Promise.all([
      window.AvalFinanceiroStore ? window.AvalFinanceiroStore.getByContratoVendaId(rec.id) : null,
      window.AvalJuridicoStore ? window.AvalJuridicoStore.getByContratoId(rec.id) : null,
    ]);
    setGate({
      sinalPago: !!(av && av.sinal_pago),
      contratoAssinado: rec.status === 'assinado',
      avalJuridico: !!(aj && aj.status === 'aprovado'),
    });
  }, [rec.id, rec.status]);
  _cvUE(() => { carregarGate(); }, [carregarGate]);

  if (!gate) return null;
  const liberado = gate.sinalPago && gate.contratoAssinado && gate.avalJuridico;

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const novo = await window.CVStore.uploadDesenhoInstalacao(rec.id, file);
      window.toast?.('Desenho anexado.', 'success');
      onSaved && onSaved(novo);
    } catch (err) {
      window.toast?.('Erro ao anexar: ' + (err.message || err), 'error');
    } finally {
      setUploading(false);
    }
  };

  const enviar = async () => {
    if (!window.confirm('Enviar o Desenho do Projeto de Instalação ao cliente por e-mail agora?')) return;
    setSending(true);
    try {
      const novo = await window.CVStore.enviarDesenhoInstalacao(rec.id);
      window.toast?.('Desenho enviado ao cliente!', 'success');
      onSaved && onSaved(novo);
    } catch (err) {
      window.toast?.('Erro ao enviar: ' + (err.message || err), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ci-drawer-sec">
      <h3 className="ci-drawer-sec-title">Desenho — Projeto de Instalação</h3>
      <p className="cv-field-hint" style={{ marginBottom: 10, display: 'block' }}>
        Enviado separadamente do contrato — só depois do sinal pago, contrato assinado e aval do Jurídico.
      </p>
      <div className="ci-audit" style={{ marginBottom: 10 }}>
        <CVAuditRow k="Sinal pago (Financeiro)" v={gate.sinalPago ? 'OK' : 'Pendente'}/>
        <CVAuditRow k="Contrato assinado" v={gate.contratoAssinado ? 'OK' : 'Pendente'}/>
        <CVAuditRow k="Aval Jurídico" v={gate.avalJuridico ? 'OK' : 'Pendente'}/>
      </div>
      {!liberado && (
        <div className="cv-cond-alert">As 3 condições acima precisam estar OK antes de anexar/enviar o desenho.</div>
      )}
      {liberado && (
        <>
          {desenho.arquivo
            ? <div className="ci-audit-row"><span className="k">Arquivo anexado</span><span className="v"><a href={desenho.arquivo.url} target="_blank" rel="noopener">{desenho.arquivo.nome}</a></span></div>
            : <div className="small muted">Nenhum arquivo anexado ainda.</div>}
          <label className="ci-btn ci-btn--ghost" style={{ marginTop: 10, display: 'inline-block', cursor: 'pointer' }}>
            {uploading ? 'Enviando…' : (desenho.arquivo ? 'Substituir arquivo' : 'Anexar arquivo (Engenharia)')}
            <input type="file" style={{ display: 'none' }} onChange={onFile} disabled={uploading}/>
          </label>
          {desenho.arquivo && (
            <button className="ci-btn ci-btn--primary" style={{ marginTop: 10, marginLeft: 8 }} onClick={enviar} disabled={sending}>
              {sending ? 'Enviando…' : ((desenho.envios || []).length ? 'Reenviar por e-mail' : 'Enviar por e-mail')}
            </button>
          )}
          {(desenho.envios || []).length > 0 && (
            <div className="ci-audit" style={{ marginTop: 10 }}>
              {desenho.envios.map((ev, i) => (
                <CVAuditRow key={i} k="Enviado em" v={`${window.CVStore.fmtDateTime(ev.enviado_em)} · ${ev.destinatario}`}/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Baixa o PDF no layout idêntico ao da minuta oficial (motor react-pdf —
   pdf-bundle/contrato-venda-reactpdf.entry.js). Recebe o mesmo `doc` da tela. */
async function cvBaixarPdf(doc, nome) {
  if (!window.ContratoVendaReactPdf) { window.toast?.('Motor de PDF ainda carregando — tente de novo em instantes.', 'warning'); return; }
  try {
    const r = await window.ContratoVendaReactPdf.baixar(doc, nome);
    if (r && r.falhasDeImagem && r.falhasDeImagem.length) window.toast?.('PDF gerado, mas o cabeçalho/rodapé não carregou: ' + r.falhasDeImagem.join('; '), 'warning');
  } catch (e) {
    console.error('PDF do contrato falhou:', e);
    window.toast?.('Não foi possível gerar o PDF: ' + (e.message || e), 'error');
  }
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
            <div style={{ marginTop: 10 }}><CVBadge status={rec.status}/><CVEmailRespondidoBadge contratoId={rec.id}/></div>
            <button className="ci-btn" style={{ marginTop: 10 }} onClick={() => {
              const fs = rec.form_state || {};
              const doc = window.CV.buildContract({
                form: fs, comprador: fs.comprador,
                valor: (rec.valor_total_num != null) ? rec.valor_total_num : window.CV.parseMoney(fs.valor),
                sinalPct: fs.sinalPct, parcelas: fs.parcelas, numero: rec.numero_documento,
              });
              cvBaixarPdf(doc, ['Contrato', rec.numero_documento, rec.comprador_razao_social].filter(Boolean).join(' - ') + '.pdf');
            }}>⬇ Baixar PDF</button>
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
          <CVSignatariosSection rec={rec} onSaved={onRefresh}/>
          <CVDesenhoInstalacaoSection rec={rec} onSaved={onRefresh}/>
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

function CVDashboard({ onCriarDeProposta }) {
  const [contracts, setContracts] = _cvUS([]);
  const [loading, setLoading] = _cvUS(true);
  const [filter, setFilter] = _cvUS('todos');
  const [query, setQuery] = _cvUS('');
  const [drawerId, setDrawerId] = _cvUS(null);
  const [sendRec, setSendRec] = _cvUS(null);
  const [aguardando, setAguardando] = _cvUS([]);

  const refresh = async () => {
    setLoading(true);
    const [list, fila] = await Promise.all([
      window.CVStore.listAll(),
      window.CVStore.listarPropostasAguardandoContrato ? window.CVStore.listarPropostasAguardandoContrato() : [],
    ]);
    setContracts(list);
    setAguardando(fila);
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

      {aguardando.length > 0 && (
        <div className="ci-panel" style={{ marginBottom: 16, borderLeft: '3px solid #4338CA' }}>
          <div className="ci-panel-head">
            <h2>Propostas assinadas aguardando contrato <span className="ci-cell-num">({aguardando.length})</span></h2>
          </div>
          <table className="ci-table">
            <thead><tr><th>Proposta</th><th>Cliente</th><th>Valor</th><th>Assinada</th><th style={{ textAlign: 'right' }}>Ação</th></tr></thead>
            <tbody>
              {aguardando.map((p) => (
                <tr key={p.id}>
                  <td><div className="ci-cell-num">{p.numero_documento}</div><div className="ci-cell-resp">{p.master_id || ''}</div></td>
                  <td><div className="ci-cell-co">{p.data_json?.cliente?.nome || p.titulo || '—'}</div></td>
                  <td className="ci-cell-val">{p.valor_total ? window.CV.brl(Number(p.valor_total)) : '—'}</td>
                  <td className="ci-cell-time">{p.aprovada_em ? window.CVStore.relative(p.aprovada_em) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="ci-mini-btn" onClick={() => onCriarDeProposta && onCriarDeProposta(p)}>Criar contrato</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  const [prefillProposta, setPrefillProposta] = _cvUS(null);
  const criarDeProposta = (p) => { setPrefillProposta(p); setTab('novo'); };
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
            <button className={'ci-tab' + (tab === 'novo' ? ' on' : '')} onClick={() => { setPrefillProposta(null); setTab('novo'); }}>+ Novo contrato</button>
          </div>
        </div>
      </div>
      <div className="ci-page-body">
        {tab === 'painel'
          ? <CVDashboard onCriarDeProposta={criarDeProposta}/>
          : <CVWizard prefillProposta={prefillProposta} onCreated={() => { setPrefillProposta(null); setTab('painel'); }}/>}
      </div>
    </div>
  );
}

window.ContratoVendaEquipamentosPage = ContratoVendaEquipamentosPage;
