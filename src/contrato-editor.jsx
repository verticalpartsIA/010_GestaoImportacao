/* ============================================================
   contrato-editor.jsx — Editor do Contrato (Cliente | Montador)
   Layout IDÊNTICO ao PropostaEditor:
     topbar · tipo-tabs · pe__main (sidenav + form) · preview
   ============================================================ */

/* ---------- helpers ---------- */
function dataBR(iso) {
  if (!iso) return "__ de __________ de ____";
  const [a, m, d] = iso.split('-');
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${a}`;
}
const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/* parse "230.000,00" → 230000 ; format 92000 → "92.000,00" */
function parseBRL(s) {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function fmtBRLnum(n) {
  if (!isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/* valor da parcela = % × valor total */
function calcParcela(pct, total) {
  const p = parseFloat(String(pct).replace(',', '.'));
  const t = parseBRL(total);
  if (!p || !t) return '';
  return fmtBRLnum(t * p / 100);
}

function makeDefaultDados(contrato) {
  const d = contrato?.dados || {};
  const hoje = new Date().toISOString().slice(0,10);
  return {
    numero:      d.numero      || contrato?.id || '',
    dataEmissao: d.dataEmissao || contrato?.issued_date || hoje,
    propostaRef: d.propostaRef || contrato?.project_id || '',
    advogado:    d.advogado    || contrato?.lawyer || '',
    razaoSocial: d.razaoSocial || contrato?.client || '',
    cnpj:        d.cnpj        || '',
    logradouro:  d.logradouro  || '',
    numero_end:  d.numero_end  || '',
    bairro:      d.bairro      || '',
    cidade:      d.cidade      || '',
    estado:      d.estado      || 'SP',
    cep:         d.cep         || '',
    responsavel: d.responsavel || '',
    rg:          d.rg          || '',
    cpf:         d.cpf         || '',
    nacionalidade: d.nacionalidade || 'brasileiro(a)',
    estadoCivil: d.estadoCivil || '',
    profissao:   d.profissao   || 'empresário(a)',
    endRespRua:    d.endRespRua    || '',
    endRespNumero: d.endRespNumero || '',
    endRespBairro: d.endRespBairro || '',
    endRespCidade: d.endRespCidade || '',
    endRespEstado: d.endRespEstado || 'SP',
    qtdEquip:    d.qtdEquip    || '1',
    modeloEquip: d.modeloEquip || '',
    entregaRua:  d.entregaRua  || '',
    entregaNum:  d.entregaNum  || '',
    entregaBairro: d.entregaBairro || '',
    entregaCidade: d.entregaCidade || '',
    entregaEstado: d.entregaEstado || 'SP',
    entregaCep:  d.entregaCep  || '',
    valorTotal:  d.valorTotal  || '',
    valorExtenso: d.valorExtenso || '',
    parcelas: d.parcelas || [
      { desc: 'Sinal — assinatura do contrato', pct: '40', valor: '' },
      { desc: '1ª Parcela',                     pct: '',   valor: '' },
      { desc: '2ª Parcela',                     pct: '',   valor: '' },
      { desc: '3ª Parcela',                     pct: '',   valor: '' },
    ],
    cidadeAss:   d.cidadeAss   || 'São Paulo',
    dataAss:     d.dataAss     || hoje,
    test1Nome:   d.test1Nome   || '',
    test1Cpf:    d.test1Cpf    || '',
    test2Nome:   d.test2Nome   || '',
    test2Cpf:    d.test2Cpf    || '',
  };
}

/* ---------- Seções de navegação ---------- */
const SECOES_CLIENTE = [
  { id: 'dados',     title: 'Dados do Contrato',       icon: 'fileText',  group: 'IDENTIFICAÇÃO' },
  { id: 'comprador', title: 'Comprador',                icon: 'user',      group: 'IDENTIFICAÇÃO' },
  { id: 'objeto',    title: 'Objeto do Contrato',       icon: 'package',   group: 'ESCOPO' },
  { id: 'preco',     title: 'Preço e Pagamento',        icon: 'dollar',    group: 'COMERCIAL' },
  { id: 'assinatura',title: 'Assinatura das Partes',    icon: 'signature', group: 'FORMALIZAÇÃO' },
];

function fillPct(dados) {
  const checks = [
    dados.numero, dados.dataEmissao,
    dados.razaoSocial, dados.cnpj, dados.logradouro, dados.responsavel, dados.cpf,
    dados.modeloEquip, dados.entregaRua,
    dados.valorTotal, dados.valorExtenso,
    dados.cidadeAss, dados.dataAss,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function sectionFill(id, dados) {
  const checks = {
    dados:     [dados.numero, dados.dataEmissao, dados.propostaRef],
    comprador: [dados.razaoSocial, dados.cnpj, dados.logradouro, dados.responsavel, dados.cpf],
    objeto:    [dados.modeloEquip, dados.entregaRua, dados.qtdEquip],
    preco:     [dados.valorTotal, dados.valorExtenso],
    assinatura:[dados.cidadeAss, dados.dataAss],
  };
  const arr = checks[id] || [];
  const done = arr.filter(Boolean).length;
  if (done === arr.length && arr.length > 0) return 'full';
  if (done > 0) return 'partial';
  return 'empty';
}

/* ============================================================
   ContratoEditorPage — full-page editor (idêntico ao PropostaEditor)
   ============================================================ */
function ContratoEditorPage({ contrato, setRoute, onSaved }) {
  const [dados, setDados] = React.useState(() => makeDefaultDados(contrato));
  const [tipoContrato] = React.useState(contrato?.tipo_contrato || 'cliente');
  const [activeSection, setActiveSection] = React.useState('dados');
  const [collapsed, setCollapsed] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(Date.now());
  const [tick, setTick] = React.useState(0);
  const [propostas, setPropostas] = React.useState([]);
  const formRef = React.useRef(null);

  // Tick para "salvado há Xs"
  React.useEffect(() => {
    const t = setInterval(() => setTick(p => p+1), 5000);
    return () => clearInterval(t);
  }, []);

  // Carrega lista de propostas (cotações) para o autocompletar
  React.useEffect(() => {
    window.__VP_SB.sb.from('cotacoes').select('id,building,total,lead_id').order('date', { ascending: false })
      .then(({ data }) => setPropostas(data || []));
  }, []);

  // Herda dados da proposta (cotação + lead) ao preencher "Proposta de Referência"
  const herdarDaProposta = async (ref) => {
    const r = (ref || '').trim();
    if (!r) return;
    const { data: cot } = await window.__VP_SB.sb.from('cotacoes').select('*').eq('id', r).maybeSingle();
    if (!cot) return; // referência livre — sem correspondência, não faz nada
    let lead = null;
    if (cot.lead_id) {
      const lr = await window.__VP_SB.sb.from('leads').select('*').eq('id', cot.lead_id).maybeSingle();
      lead = lr.data;
    }
    setDados(p => {
      const total = cot.total ? fmtBRLnum(cot.total) : p.valorTotal;
      const next = {
        ...p,
        razaoSocial: p.razaoSocial || cot.building || '',
        responsavel: p.responsavel || (lead?.contact || ''),
        modeloEquip: p.modeloEquip || (lead?.equip || ''),
        valorTotal:  p.valorTotal  || total || '',
      };
      // recalcula parcelas com o novo total herdado
      if (!p.valorTotal && total) {
        next.parcelas = p.parcelas.map(par => ({ ...par, valor: calcParcela(par.pct, total) }));
      }
      return next;
    });
    window.toast(`Dados herdados da proposta ${r}${lead ? ' (lead '+cot.lead_id+')' : ''}.`, 'success');
  };

  // Active section follows scroll
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = () => {
      const top = form.scrollTop;
      let best = SECOES_CLIENTE[0].id;
      for (const s of SECOES_CLIENTE) {
        const el = document.getElementById('csec-' + s.id);
        if (el && el.offsetTop - 100 <= top) best = s.id;
      }
      setActiveSection(best);
    };
    form.addEventListener('scroll', handler, { passive: true });
    return () => form.removeEventListener('scroll', handler);
  }, []);

  const set = (k, v) => setDados(p => ({ ...p, [k]: v }));

  // valorTotal muda → recalcula o valor de todas as parcelas (% × total)
  const setValorTotal = (v) => setDados(p => ({
    ...p,
    valorTotal: v,
    parcelas: p.parcelas.map(par => ({ ...par, valor: calcParcela(par.pct, v) })),
  }));

  // parcela muda → se for o %, recalcula seu valor automaticamente
  const setParcela = (i, k, v) => setDados(p => {
    const pars = [...p.parcelas];
    pars[i] = { ...pars[i], [k]: v };
    if (k === 'pct') pars[i].valor = calcParcela(v, p.valorTotal);
    return { ...p, parcelas: pars };
  });
  const addParcela = () => setDados(p => ({
    ...p, parcelas: [...p.parcelas, { desc: `${p.parcelas.length}ª Parcela`, pct: '', valor: '' }]
  }));
  const removeParcela = (i) => setDados(p => ({ ...p, parcelas: p.parcelas.filter((_,idx) => idx !== i) }));

  const jump = (id) => {
    const el = document.getElementById('csec-' + id);
    if (el && formRef.current) formRef.current.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
    setActiveSection(id);
  };

  const save = async (novoStatus) => {
    /* Contrato do fluxo novo (tem token de assinatura): este editor legado grava status 'Assinado'/'Em assinatura digital' direto,
       sem RPC, evento, D0 nem gates — e poderia rebaixar um contrato já assinado (auditoria de 11/10). Bloqueia a gravação;
       o caminho certo é Contratos & Jurídico › Contrato Venda de Equipamentos. */
    if (contrato && contrato.token) {
      return window.toast('Este contrato é do fluxo novo e não pode ser alterado por este editor antigo. Use "Contrato Venda de Equipamentos".', 'warning');
    }
    setSaving(true);
    const upd = {
      dados, client: dados.razaoSocial || contrato?.client,
      project_id: dados.propostaRef || contrato?.project_id,
      lawyer: dados.advogado || contrato?.lawyer,
      value: dados.valorTotal ? parseFloat(dados.valorTotal.replace(/\./g,'').replace(',','.')) : contrato?.value,
      ...(novoStatus ? { status: novoStatus } : {}),
    };
    const { error } = await window.__VP_SB.sb.from('contratos_venda_equipamentos').update(upd).eq('id', contrato.id);
    setSaving(false);
    if (error) return window.toast('Erro ao salvar: ' + error.message, 'error');
    setSavedAt(Date.now());
    if (novoStatus) window.toast(novoStatus === 'Em assinatura digital' ? 'Enviado para assinatura!' : 'Marcado como assinado — Compra desbloqueada!', 'success');
    onSaved?.();
  };

  const pct   = fillPct(dados);
  const fDone = SECOES_CLIENTE.filter(s => sectionFill(s.id, dados) === 'full').length;
  const preenchido = dados.razaoSocial && dados.cnpj && dados.modeloEquip && dados.valorTotal;

  // Groups for sidenav
  const groups = {};
  SECOES_CLIENTE.forEach(s => { if (!groups[s.group]) groups[s.group] = []; groups[s.group].push(s); });

  return (
    <div className="page fade-in" style={{ padding: 0, maxWidth: 'none' }}>

      {/* ===== TOP BAR ===== */}
      <div style={{ padding: '20px 32px 16px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute('juridico')}>Voltar para Contratos</Button>
          <div className="spacer" style={{ flex: 1 }}/>
          <div className="row gap-3" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>
            <span>Última edição: {Math.max(0, Math.floor((Date.now()-savedAt)/1000))}s atrás</span>
            <span style={{ color: 'var(--vp-success)' }}>● Salvamento ativo</span>
          </div>
        </div>
        <div className="row sb">
          <div>
            <div className="page-head__eyebrow" style={{ marginBottom: 4 }}>
              <span className="vp-rule"/>Editor de Contrato
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, textTransform: 'uppercase' }}>
              {contrato?.id || 'Novo Contrato'}
              <span style={{ marginLeft: 12, fontSize: 14, color: 'var(--fg3)', textTransform: 'none', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {dados.razaoSocial || 'Sem cliente'} · {dados.propostaRef ? 'Proposta '+dados.propostaRef : 'Sem proposta'}
              </span>
            </h1>
          </div>
          <div className="row gap-2">
            <Button variant="ghost" size="sm" icon="copy" onClick={() => save()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button variant="outline" size="sm" icon="download" onClick={() => gerarContratoPDF(dados)}>Gerar PDF</Button>
            <Button variant={preenchido ? 'primary' : 'outline'} size="sm" icon="signature"
              onClick={() => preenchido ? save('Em assinatura digital') : window.toast('Preencha Comprador, Objeto e Preço primeiro.','warning')}>
              Enviar p/ assinatura
            </Button>
          </div>
        </div>

        {/* TIPO TABS — Cliente | Montador */}
        <div className="pe__tabs" style={{ marginTop: 14, marginBottom: -16 }}>
          <button className={"pe__tab " + (tipoContrato === 'cliente' ? 'is-active' : '')}>
            <Icon.fileText size={18}/>
            <span>Contrato do Cliente</span>
            <span className="pe__tab-sub">COMPRA E VENDA · INSTALAÇÃO</span>
          </button>
          <button className={"pe__tab"} disabled style={{ opacity: .4, cursor: 'not-allowed' }}>
            <Icon.tool size={18}/>
            <span>Contrato do Montador</span>
            <span className="pe__tab-sub">EM BREVE</span>
          </button>
        </div>
      </div>

      {/* ===== BODY (pe layout) ===== */}
      <div className="pe">
        <div className="pe__main">

          {/* SIDENAV */}
          <nav className="pe__sidenav">
            <div className="pe__sidenav-progress">
              <div className="pe__sidenav-progress-lbl">Preenchimento</div>
              <div className="pe__sidenav-progress-val">{pct}%</div>
              <div className="progress"><span style={{ width: pct + '%' }}/></div>
              <div className="mono small" style={{ marginTop: 6, fontSize: 10, color: 'var(--fg3)' }}>
                {fDone}/{SECOES_CLIENTE.length} seções completas
              </div>
            </div>

            {Object.entries(groups).map(([g, items]) => (
              <div key={g}>
                <div className="pe__sidenav-group">{g}</div>
                {items.map(s => {
                  const fill = sectionFill(s.id, dados);
                  const I = Icon[s.icon] || Icon.bolt;
                  const isActive = activeSection === s.id;
                  const isDone   = fill === 'full';
                  return (
                    <div key={s.id}
                      className={"pe__sidenav-item " + (isActive ? 'is-active' : '') + (isDone && !isActive ? ' is-done' : '')}
                      onClick={() => jump(s.id)}>
                      <span className="pe__sidenav-icon">
                        {isDone ? <Icon.check/> : React.createElement(I)}
                      </span>
                      <span style={{ flex: 1 }}>{s.title}</span>
                      {fill === 'partial' && !isActive
                        ? <span className="mono small" style={{ fontSize: 9, color: 'var(--vp-warning-ink)' }}>parcial</span>
                        : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* FORM */}
          <div className="pe__form" ref={formRef}>
            <CSecao id="dados" num="01" title="Dados do Contrato" sub="IDENTIFICAÇÃO"
              fill={sectionFill('dados', dados)}
              collapsed={!!collapsed['dados']}
              onToggle={() => setCollapsed(c => ({ ...c, dados: !c.dados }))}>
              <SF_Dados dados={dados} set={set} propostas={propostas} onInherit={herdarDaProposta}/>
            </CSecao>

            <CSecao id="comprador" num="02" title="Comprador" sub="IDENTIFICAÇÃO"
              fill={sectionFill('comprador', dados)}
              collapsed={!!collapsed['comprador']}
              onToggle={() => setCollapsed(c => ({ ...c, comprador: !c.comprador }))}>
              <SF_Comprador dados={dados} set={set}/>
            </CSecao>

            <CSecao id="objeto" num="03" title="Objeto do Contrato" sub="ESCOPO"
              fill={sectionFill('objeto', dados)}
              collapsed={!!collapsed['objeto']}
              onToggle={() => setCollapsed(c => ({ ...c, objeto: !c.objeto }))}>
              <SF_Objeto dados={dados} set={set}/>
            </CSecao>

            <CSecao id="preco" num="04" title="Preço e Pagamento" sub="COMERCIAL"
              fill={sectionFill('preco', dados)}
              collapsed={!!collapsed['preco']}
              onToggle={() => setCollapsed(c => ({ ...c, preco: !c.preco }))}>
              <SF_Preco dados={dados} set={set} setValorTotal={setValorTotal} setParcela={setParcela} addParcela={addParcela} removeParcela={removeParcela}/>
            </CSecao>

            <CSecao id="assinatura" num="05" title="Assinatura das Partes" sub="FORMALIZAÇÃO"
              fill={sectionFill('assinatura', dados)}
              collapsed={!!collapsed['assinatura']}
              onToggle={() => setCollapsed(c => ({ ...c, assinatura: !c.assinatura }))}>
              <SF_Assinatura dados={dados} set={set}/>
            </CSecao>

            <div className="pe__actionbar">
              <span className="pe__autosave">
                <span className="dot"/> Salvo · {Math.max(0, Math.floor((Date.now()-savedAt)/1000))}s atrás
              </span>
              <div className="spacer" style={{ flex: 1 }}/>
              <Button variant="ghost" size="sm" icon="chevLeft" onClick={() => setRoute('juridico')}>Voltar</Button>
              <Button variant="outline" size="sm" icon="download" onClick={() => gerarContratoPDF(dados)}>
                Gerar PDF
              </Button>
              <Button variant="secondary" size="sm" icon="copy" onClick={() => save()} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar rascunho'}
              </Button>
              <Button variant="primary" size="sm" icon="signature"
                onClick={() => preenchido ? save('Em assinatura digital') : window.toast('Preencha todos os campos obrigatórios.','warning')}>
                Enviar p/ Cliente
              </Button>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <ContratoPreviewPanel dados={dados} status={contrato?.status} onSign={() => save('Assinado')}/>
      </div>
    </div>
  );
}

/* ---------- CSecao — igual ao PESection do PropostaEditor ---------- */
function CSecao({ id, num, title, sub, fill, collapsed, onToggle, children }) {
  const fillColor = fill === 'full' ? 'var(--vp-success)' : fill === 'partial' ? 'var(--vp-warning-ink)' : 'var(--border-strong)';
  return (
    <div className="pe__section" id={'csec-' + id}>
      <div className="pe__section-head" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <span className="pe__section-num">{num}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {sub && <div className="pe__section-sub">{sub}</div>}
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: fillColor, flexShrink: 0 }}/>
        {React.createElement(collapsed ? Icon.chevDown : Icon.chevUp, { size: 14, color: 'var(--fg3)' })}
      </div>
      {!collapsed && <div style={{ padding: '20px 24px 24px' }}>{children}</div>}
    </div>
  );
}

/* ---------- Sub-formulários ---------- */
function SF_Dados({ dados, set, propostas = [], onInherit }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Nº do Contrato *" value={dados.numero} onChange={v => set('numero', v)} ph="CTR-001/2026"/>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Data de emissão" type="date" value={dados.dataEmissao} onChange={v => set('dataEmissao', v)}/>
        <div className="field">
          <label>Proposta de referência <span style={{ color: 'var(--fg3)', fontWeight: 400, textTransform: 'none' }}>· herda dados</span></label>
          <input className="input" list="dt-propostas" value={dados.propostaRef}
            placeholder="COT-001"
            onChange={e => {
              const v = e.target.value;
              set('propostaRef', v);
              // seleção via datalist (casa exatamente com uma proposta) → herda na hora
              if (onInherit && propostas.some(p => p.id === v)) onInherit(v);
            }}
            onBlur={e => onInherit && onInherit(e.target.value)}/>
          <datalist id="dt-propostas">
            {propostas.map(p => (
              <option key={p.id} value={p.id}>{p.building}{p.total ? ' · R$ ' + fmtBRLnum(p.total) : ''}</option>
            ))}
          </datalist>
          <span style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 3, display: 'block' }}>
            Selecione/insira a proposta e saia do campo — cliente, valor, responsável e equipamento serão preenchidos.
          </span>
        </div>
      </div>
      <Field label="Advogado responsável" value={dados.advogado} onChange={v => set('advogado', v)} ph="Nome do advogado"/>
    </div>
  );
}

function SF_Comprador({ dados, set }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Razão Social *" value={dados.razaoSocial} onChange={v => set('razaoSocial', v)} ph="EMPRESA LTDA"/>
      <Field label="CNPJ *" value={dados.cnpj} onChange={v => set('cnpj', v)} ph="XX.XXX.XXX/XXXX-XX"/>
      <div className="pe__section-sub" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', marginTop: 4 }}>Endereço da Empresa</div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Logradouro *" value={dados.logradouro} onChange={v => set('logradouro', v)} ph="Rua, Av…"/>
        <Field label="Número" value={dados.numero_end} onChange={v => set('numero_end', v)} ph="123"/>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Bairro" value={dados.bairro} onChange={v => set('bairro', v)}/>
        <Field label="Cidade" value={dados.cidade} onChange={v => set('cidade', v)}/>
        <FieldSel label="UF" value={dados.estado} options={UF_LIST} onChange={v => set('estado', v)}/>
      </div>
      <Field label="CEP" value={dados.cep} onChange={v => set('cep', v)} ph="XX.XXX-XX"/>
      <div className="pe__section-sub" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', marginTop: 4 }}>Representante Legal</div>
      <Field label="Nome do Responsável *" value={dados.responsavel} onChange={v => set('responsavel', v)}/>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Nacionalidade" value={dados.nacionalidade} onChange={v => set('nacionalidade', v)}/>
        <Field label="Estado Civil" value={dados.estadoCivil} onChange={v => set('estadoCivil', v)}/>
        <Field label="Profissão" value={dados.profissao} onChange={v => set('profissao', v)}/>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="RG" value={dados.rg} onChange={v => set('rg', v)} ph="XX.XXX.XXX-X"/>
        <Field label="CPF *" value={dados.cpf} onChange={v => set('cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
    </div>
  );
}

function SF_Objeto({ dados, set }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Quantidade *" type="number" value={dados.qtdEquip} onChange={v => set('qtdEquip', v)} ph="1"/>
        <Field label="Proposta Comercial ref." value={dados.propostaRef} onChange={v => set('propostaRef', v)} ph="PR-2026-001"/>
      </div>
      <div>
        <label className="up-eyebrow muted" style={{ fontSize: 11, display: 'block', marginBottom: 5 }}>Descrição do Equipamento * (conforme Proposta e Anexo I e II)</label>
        <textarea className="input" rows={3} value={dados.modeloEquip}
          onChange={e => set('modeloEquip', e.target.value)}
          placeholder="Ex.: Escada Rolante OAK 30°, largura 1000mm, modalidade CIF, velocidade 0,5m/s…"
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}/>
      </div>
      <div className="pe__section-sub" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', marginTop: 4 }}>Local de Entrega / Obra</div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Logradouro *" value={dados.entregaRua} onChange={v => set('entregaRua', v)} ph="Av., Rua…"/>
        <Field label="Número" value={dados.entregaNum} onChange={v => set('entregaNum', v)}/>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Bairro" value={dados.entregaBairro} onChange={v => set('entregaBairro', v)}/>
        <Field label="Cidade" value={dados.entregaCidade} onChange={v => set('entregaCidade', v)}/>
        <FieldSel label="UF" value={dados.entregaEstado} options={UF_LIST} onChange={v => set('entregaEstado', v)}/>
      </div>
    </div>
  );
}

function SF_Preco({ dados, set, setValorTotal, setParcela, addParcela, removeParcela }) {
  const total   = parseBRL(dados.valorTotal);
  const somaPct = dados.parcelas.reduce((s, p) => s + (parseFloat(String(p.pct).replace(',', '.')) || 0), 0);
  const somaVal = dados.parcelas.reduce((s, p) => s + parseBRL(p.valor), 0);
  const pctOk   = Math.abs(somaPct - 100) < 0.01;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Valor Total (R$) *" value={dados.valorTotal} onChange={setValorTotal} ph="1.200.000,00"/>
        <Field label="Valor por extenso *" value={dados.valorExtenso} onChange={v => set('valorExtenso', v)} ph="um milhão, duzentos mil reais"/>
      </div>
      <div>
        <div className="up-eyebrow muted" style={{ fontSize: 11, marginBottom: 4 }}>Cronograma de Pagamento</div>
        <div style={{ fontSize: 10, color: 'var(--fg3)', marginBottom: 8 }}>Informe a <b>%</b> de cada parcela — o <b>valor</b> é calculado automaticamente (% × valor total).</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 150px 32px', gap: 0, background: 'var(--vp-gray-50)', padding: '6px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', borderBottom: '1px solid var(--border)' }}>
            <span>Descrição</span><span style={{ textAlign: 'center' }}>%</span><span style={{ textAlign: 'right' }}>Valor (auto)</span><span/>
          </div>
          {dados.parcelas.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 150px 32px', gap: 0, borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <input className="input" style={{ border: 'none', borderRadius: 0, fontSize: 12 }} value={p.desc} onChange={e => setParcela(i,'desc',e.target.value)} placeholder="Descrição"/>
              <input className="input" style={{ border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0, fontSize: 12, textAlign: 'center' }} value={p.pct} onChange={e => setParcela(i,'pct',e.target.value)} placeholder="%"/>
              <div style={{ borderLeft: '1px solid var(--border)', padding: '0 10px', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right', color: p.valor ? 'var(--fg1)' : 'var(--fg3)', background: 'var(--vp-gray-50)' }}>
                {p.valor ? 'R$ ' + p.valor : (total ? '—' : 'defina o total')}
              </div>
              {dados.parcelas.length > 1
                ? <button onClick={() => removeParcela(i)} title="Remover parcela" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fg3)', fontSize: 16, borderLeft: '1px solid var(--border)', height: '100%' }}>×</button>
                : <span/>}
            </div>
          ))}
          {/* linha de soma */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 150px 32px', gap: 0, padding: '0', alignItems: 'center', background: pctOk ? 'var(--vp-success-bg, #eef7ee)' : '#fff4e5' }}>
            <span style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700 }}>Total</span>
            <span style={{ padding: '7px 0', fontSize: 12, fontWeight: 800, textAlign: 'center', fontFamily: 'var(--font-mono)', color: pctOk ? 'var(--vp-success)' : 'var(--vp-danger)' }}>{somaPct ? somaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' : '0%'}</span>
            <span style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>R$ {fmtBRLnum(somaVal)}</span>
            <span/>
          </div>
        </div>
        {!pctOk && somaPct > 0 && (
          <div style={{ fontSize: 11, color: 'var(--vp-danger)', marginTop: 6 }}>
            ⚠ A soma das porcentagens é {somaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% — ajuste para totalizar 100%.
          </div>
        )}
        <Button variant="ghost" size="sm" icon="plus" onClick={addParcela} style={{ marginTop: 8 }}>Adicionar parcela</Button>
      </div>
    </div>
  );
}

function SF_Assinatura({ dados, set }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Cidade de assinatura" value={dados.cidadeAss} onChange={v => set('cidadeAss', v)} ph="São Paulo"/>
        <Field label="Data da assinatura" type="date" value={dados.dataAss} onChange={v => set('dataAss', v)}/>
      </div>
      <div className="pe__section-sub" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)' }}>Testemunhas</div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Testemunha 1 — Nome" value={dados.test1Nome} onChange={v => set('test1Nome', v)}/>
        <Field label="Testemunha 1 — CPF" value={dados.test1Cpf} onChange={v => set('test1Cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Testemunha 2 — Nome" value={dados.test2Nome} onChange={v => set('test2Nome', v)}/>
        <Field label="Testemunha 2 — CPF" value={dados.test2Cpf} onChange={v => set('test2Cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
    </div>
  );
}

/* ---------- Preview panel (lado direito) ---------- */
function ContratoPreviewPanel({ dados, status, onSign }) {
  const fill = (v, fb) => v ? <b>{v}</b> : <span style={{ color: 'var(--vp-danger)', fontStyle: 'italic', fontSize: 10 }}>{fb}</span>;
  const fb   = (v, def) => v || def;
  const endEmp  = [dados.logradouro, dados.numero_end, dados.bairro, dados.cidade, dados.estado].filter(Boolean).join(', ') || '___';
  const endEntr = [dados.entregaRua, dados.entregaNum, dados.entregaBairro, dados.entregaCidade, dados.entregaEstado].filter(Boolean).join(', ') || '___';

  return (
    <div style={{ width: 300, background: 'var(--vp-gray-50)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)' }}>Preview do Contrato</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>ELEVADOR</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {/* Mini contract card */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '16px 14px', fontSize: 11, lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8, borderBottom: '2px solid var(--vp-yellow)', paddingBottom: 6 }}>
            CONTRATO DE COMPRA E VENDA
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>
            <b>Nº:</b> {fb(dados.numero, '___')} &nbsp;·&nbsp; <b>Data:</b> {dataBR(dados.dataEmissao).substring(0,10)}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 10, color: 'var(--fg3)' }}>Proposta ref.: {fb(dados.propostaRef,'—')}</p>

          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', margin: '10px 0 4px', borderLeft: '3px solid var(--vp-yellow)', paddingLeft: 6 }}>COMPRADOR</div>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>{fill(dados.razaoSocial,'RAZÃO SOCIAL')}</p>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>CNPJ: {fill(dados.cnpj,'XX.XXX.XXX/XXXX-XX')}</p>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--fg3)' }}>{endEmp}</p>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>Rep.: {fill(dados.responsavel,'___')} · CPF: {fb(dados.cpf,'___')}</p>

          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', margin: '10px 0 4px', borderLeft: '3px solid var(--vp-yellow)', paddingLeft: 6 }}>OBJETO</div>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>{fb(dados.qtdEquip,'?')}× {fill(dados.modeloEquip,'MODELO NÃO PREENCHIDO')}</p>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--fg3)' }}>Entrega: {endEntr}</p>

          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', margin: '10px 0 4px', borderLeft: '3px solid var(--vp-yellow)', paddingLeft: 6 }}>VALOR</div>
          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800 }}>{dados.valorTotal ? `R$ ${dados.valorTotal}` : fill(null,'R$ ___')}</p>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--fg3)', fontStyle: 'italic' }}>{fb(dados.valorExtenso,'valor por extenso')}</p>

          {dados.parcelas.map((p,i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--fg2)' }}>{p.desc}</span>
              <b>{p.valor ? `R$ ${p.valor}` : '—'}</b>
            </div>
          ))}

          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg3)', margin: '10px 0 4px', borderLeft: '3px solid var(--vp-yellow)', paddingLeft: 6 }}>ASSINATURA</div>
          <p style={{ margin: '0 0 4px', fontSize: 10 }}>{fb(dados.cidadeAss,'___')}, {dataBR(dados.dataAss)}</p>
          <div style={{ marginTop: 12 }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginBottom: 8, fontSize: 9 }}>VERTICAL PARTS — Diego Y. Maeno</div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontSize: 9 }}>{fb(dados.razaoSocial,'COMPRADOR')} — {fb(dados.responsavel,'___')}</div>
          </div>
        </div>

        {/* Assinatura status */}
        {status === 'Em assinatura digital' && (
          <div style={{ marginTop: 12 }}>
            <div className="alert" style={{ background: 'var(--vp-yellow-50)', borderLeft: '3px solid var(--vp-yellow)', fontSize: 12, padding: '10px 12px' }}>
              ✉️ Aguardando assinatura do cliente
            </div>
            <Button variant="outline" size="sm" icon="check" onClick={onSign} style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
              Marcar como assinado
            </Button>
            <p className="small muted" style={{ marginTop: 4, fontSize: 10, textAlign: 'center' }}>Use quando receber confirmação</p>
          </div>
        )}
        {status === 'Assinado' && (
          <div className="alert success" style={{ marginTop: 12, fontSize: 12 }}>
            <Icon.check size={14}/> Assinado — fase de Compra liberada
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Primitivos de campo ---------- */
function Field({ label, value, onChange, type='text', ph='' }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type={type} value={value} placeholder={ph} onChange={e => onChange(e.target.value)}/>
    </div>
  );
}
function FieldSel({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ============================================================
   GERAÇÃO DE PDF FIEL À MINUTA CONTRATUAL_VERTICALPARTS.pdf
   Cabeçalho (bloco cinza + faixa creme #FCD89C + logo cinza),
   rodapé (contatos + bloco #343434 + faixa laranja #FBB039),
   destaques amarelos #FFFF00 nos campos preenchidos.
   ============================================================ */
function gerarContratoPDF(dados) {
  const html = buildContratoHTML(dados);
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) { window.toast('Permita pop-ups para gerar o PDF.', 'warning'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // aguarda render + imagem do logo, então abre o diálogo de impressão
  w.onload = () => { setTimeout(() => { w.focus(); w.print(); }, 350); };
  window.toast('Documento gerado — escolha "Salvar como PDF" na impressão.', 'success');
}

function buildContratoHTML(dados) {
  const origin = window.location.origin;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // V = campo preenchido (amarelo) | placeholder (amarelo, itálico cinza)
  const V  = (val, ph) => val ? `<span class="fill">${esc(val)}</span>` : `<span class="ph">${esc(ph)}</span>`;
  const T  = (val, def) => esc(val || def);

  const endEmpresa = [dados.logradouro && `${dados.logradouro}${dados.numero_end ? ', nº '+dados.numero_end : ''}`,
                      dados.bairro, dados.cidade && `${dados.cidade}/${dados.estado}`, dados.cep && `CEP ${dados.cep}`]
                     .filter(Boolean).join(', ');
  const endResp = [dados.endRespRua && `${dados.endRespRua}${dados.endRespNumero ? ', nº '+dados.endRespNumero : ''}`,
                   dados.endRespBairro, dados.endRespCidade && `${dados.endRespCidade}/${dados.endRespEstado}`]
                  .filter(Boolean).join(', ');
  const localEntrega = [dados.entregaRua && `${dados.entregaRua}${dados.entregaNum ? ', nº '+dados.entregaNum : ''}`,
                        dados.entregaBairro, dados.entregaCidade && `${dados.entregaCidade}/${dados.entregaEstado}`,
                        dados.entregaCep && `CEP ${dados.entregaCep}`].filter(Boolean).join(', ');

  const parcelasRows = (dados.parcelas || []).map(p => `
    <tr>
      <td>${esc(p.desc || '—')}</td>
      <td style="text-align:center">${p.pct ? esc(p.pct)+'%' : '—'}</td>
      <td style="text-align:right">${p.valor ? '<span class="fill">R$ '+esc(p.valor)+'</span>' : '—'}</td>
    </tr>`).join('');

  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<title>Contrato ${esc(dados.numero || '')} — VerticalParts</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Mulish','Segoe UI',Arial,sans-serif;
    font-size: 10.5px; line-height: 1.55; color: #1a1a1a;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* ---- repeating header/footer via fixed + thead/tfoot spacer ---- */
  .pg-header { position: fixed; top: 0; left: 0; right: 0; height: 92px; background: #fff; z-index: 10; }
  .pg-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 88px; background: #fff; z-index: 10; }

  .hd-strip { display: flex; height: 16px; }
  .hd-strip .blk { width: 64px; background: #999999; }
  .hd-strip .band { flex: 1; background: #FCD89C; }
  .hd-logo { background: #F3F3F3; padding: 12px 40px; }
  .hd-logo img { height: 34px; filter: grayscale(1); display: block; }

  .ft-contact { display: flex; gap: 28px; padding: 8px 40px 10px; }
  .ft-col { display: flex; gap: 8px; align-items: flex-start; }
  .ft-ico { width: 20px; height: 20px; border-radius: 4px; background: #2b2b2b; color: #fff;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .ft-ico svg { width: 11px; height: 11px; fill: #fff; }
  .ft-txt { font-size: 8px; line-height: 1.45; color: #555; font-family: 'Mulish',Arial,sans-serif; }
  .ft-strip { display: flex; height: 14px; position: absolute; bottom: 0; left: 0; right: 0; }
  .ft-strip .blk { width: 64px; background: #343434; }
  .ft-strip .band { flex: 1; background: #FBB039; }

  table.report { width: 100%; border-collapse: collapse; }
  table.report > thead > tr > td { height: 92px; }   /* reserva espaço do header */
  table.report > tfoot > tr > td { height: 88px; }    /* reserva espaço do footer */
  .body-cell { padding: 0 40px; }

  h1.doc-title { font-size: 12.5px; font-weight: 800; text-align: center; text-transform: uppercase;
                 text-decoration: underline; margin: 6px 0 14px; line-height: 1.4; }
  .doc-num { text-align: right; font-size: 10px; font-weight: 700; margin: 0 0 14px; }
  h2.cl { font-size: 11px; font-weight: 800; margin: 16px 0 8px; }
  p { margin: 0 0 7px; text-align: justify; }
  .ind { padding-left: 22px; }
  ul.anx { list-style: none; padding: 0; margin: 4px 0; }
  ul.anx li { padding: 2px 0; }
  .bullet { padding-left: 14px; position: relative; margin: 0 0 5px; }
  .bullet::before { content: "›"; position: absolute; left: 0; font-weight: 800; }
  .fill { background: #FFFF00; padding: 0 2px; font-weight: 600; }
  .ph   { background: #FFFF00; padding: 0 2px; color: #777; font-style: italic; }

  table.pgmt { width: 100%; border-collapse: collapse; margin: 6px 0 8px; font-size: 10px; }
  table.pgmt th { background: #2b2b2b; color: #fff; font-size: 8.5px; text-transform: uppercase;
                  letter-spacing: .06em; padding: 5px 10px; text-align: left; }
  table.pgmt td { border: 1px solid #ddd; padding: 5px 10px; }

  .anx-tbl { width: 60%; border-collapse: collapse; margin: 8px 0; font-size: 9.5px; }
  .anx-tbl td { border: 1px solid #ccc; padding: 4px 8px; }

  .sign-wrap { margin-top: 18px; }
  .sign-row { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; }
  .sign-box { flex: 1; text-align: center; }
  .sign-box .ln { border-top: 1px solid #000; margin-bottom: 4px; }
  .sign-box .nm { font-weight: 700; font-size: 10px; }
  .sign-box .sub { font-size: 9px; color: #444; }
  .keep { page-break-inside: avoid; }
</style></head>
<body>

<!-- HEADER (repete em todas as páginas) -->
<div class="pg-header">
  <div class="hd-strip"><div class="blk"></div><div class="band"></div></div>
  <div class="hd-logo"><img src="${origin}/assets/logo-verticalparts-color.png" alt="VerticalParts"/></div>
</div>

<!-- FOOTER (repete em todas as páginas) -->
<div class="pg-footer">
  <div class="ft-contact">
    <div class="ft-col">
      <span class="ft-ico"><svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></span>
      <span class="ft-txt">Rua Armandina Braga de Almeida, 383<br>Jardim Santa Emilia<br>Guarulhos - SP<br>CEP: 07141-003</span>
    </div>
    <div class="ft-col">
      <span class="ft-ico"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.2 1l-2.3 2.2z"/></svg></span>
      <span class="ft-txt">+55 11 2528-6473<br>+55 11 2528-6479<br>+55 11 94460-6396</span>
    </div>
    <div class="ft-col">
      <span class="ft-ico"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span>
      <span class="ft-txt">contato@verticalparts.com.br<br>comercial@verticalparts.com.br</span>
    </div>
  </div>
  <div class="ft-strip"><div class="blk"></div><div class="band"></div></div>
</div>

<!-- CORPO -->
<table class="report">
  <thead><tr><td></td></tr></thead>
  <tbody><tr><td class="body-cell">

    <h1 class="doc-title">CONTRATO DE COMPRA E VENDA DE EQUIPAMENTOS E PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO</h1>
    <p class="doc-num">Nº do Contrato: ${V(dados.numero, 'XXXX/2026')}</p>

    <p>Pelo presente instrumento particular e na melhor forma de direito, as partes a seguir nomeadas:</p>
    <p><b>VENDEDORA:</b> VERTICAL PARTS – INDUSTRIA E COMERCIO DE PEÇAS PARA ESCADAS, ESTEIRAS ROLANTES E ELEVADORES LTDA-ME, inscrita no CNPJ sob o nº 15.822.325/0001-27, com sede à Rua Armandina Braga de Almeida, nº 383, Jd. Santa Emilia, Guarulhos/SP, CEP 07.141-003, neste ato representada nos termos de seu Contrato social por DIEGO YUTAKA MAENO, brasileiro, casado, empresário, portador do RG 23.401.535-4, SSP/SP, inscrito no CPF nº 249.432.208-19, com escritório no endereço acima mencionado e;</p>
    <p><b>COMPRADOR:</b> ${V(dados.razaoSocial,'RAZÃO SOCIAL')}, inscrito no CNPJ sob o nº ${V(dados.cnpj,'XX.XXX.XXX/XXXX-XX')}, com sede à ${V(endEmpresa, 'Rua XXX, nº XXX, bairro, cidade/estado, CEP XX.XXX-XX')}, neste ato representada nos termos de seu ato constitutivo por ${V(dados.responsavel,'NOME DO RESPONSÁVEL')}, ${V(dados.nacionalidade,'nacionalidade')}, ${V(dados.estadoCivil,'estado civil')}, ${V(dados.profissao,'profissão')}, portador da cédula de identidade RG de nº ${V(dados.rg,'XXX')}, inscrito no CPF nº ${V(dados.cpf,'XXX')}, residente e domiciliado em ${V(endResp,'Rua XXX, nº XXX, bairro, cidade/estado')}.</p>
    <p>Têm, entre si, certo e ajustado o presente Contrato de compra e venda de equipamento, o qual se regerá pelas disposições do Código Civil e demais condições abaixo, às quais as partes mutuamente se obrigam.</p>

    <h2 class="cl">1 – OBJETO DO CONTRATO</h2>
    <p><b>1.1 Objeto.</b> O objeto deste Contrato consiste no descrito a seguir, observados e respeitados os termos e as condições estabelecidos neste instrumento contratual:</p>
    <p class="bullet">Compra e venda de ${V(dados.qtdEquip,'0X')} (qtd.) equipamento, modelo ${V(dados.modeloEquip,'DESCREVER CONFORME PROPOSTA COMERCIAL')}, denominado equipamentos, conforme especificações dos Anexos I e II.</p>
    <p class="bullet">Modalidade: "CIF" ("Cost, Insurance and Freight").</p>
    <p class="bullet">Instalação dos equipamentos mencionados acima de forma a entregá-los ao COMPRADOR em condições de uso imediato ("turn key"). A instalação compreende: frete (transporte e desembarque); entrega, instalação e montagem no endereço abaixo, sendo que qualquer alteração no CEP do local poderá sofrer reajuste de preço.</p>
    <p class="ind"><b>LOCAL DE ENTREGA:</b> ${V(localEntrega,'ENDEREÇO COMPLETO DO LOCAL DE ENTREGA')}</p>
    <p><b>1.1.1</b> Os seguintes anexos a este Contrato constituem parte indissociável e complementam os termos firmados neste instrumento:</p>
    <table class="anx-tbl">
      <tr><td><b>Anexo I</b></td><td>Proposta Comercial nº ${V(dados.propostaRef,'XXXX/2026')}</td></tr>
      <tr><td><b>Anexo II</b></td><td>Desenho(s) Técnico(s)</td></tr>
    </table>

    <h2 class="cl">2 – INFORMAÇÕES SOBRE A ENTREGA E A INSTALAÇÃO DOS EQUIPAMENTOS</h2>
    <p><b>2.1 Instalação e funcionamento.</b> A instalação dos equipamentos observará as normas técnicas pertinentes à natureza do trabalho. O COMPRADOR declara ciência de que o funcionamento definitivo dependerá das boas condições do local de montagem e das instalações elétricas adequadas e permanentes que os alimentarão.</p>
    <p><b>2.1.1</b> As instalações elétricas deverão ser providenciadas, antecipada e exclusivamente, pelo COMPRADOR, seguindo as especificações técnicas dos Anexos I e II, para que após aprovação seja iniciada a produção dos equipamentos.</p>
    <p><b>2.2 Guarda e manutenção.</b> O COMPRADOR se obriga a receber os equipamentos no prazo acordado e a mantê-los protegidos contra qualquer avaria, dano e/ou deterioração, incluindo detritos de obras civis (cimento, gesso, massa corrida, poeira, tinta, umidade, chuva, entre outros).</p>
    <p><b>2.4 Frete.</b> A VENDEDORA garante o frete rodoviário e marítimo sem custo para o COMPRADOR desde que a obra esteja pronta na data de entrega. Em caso de descumprimento, será de responsabilidade do COMPRADOR os custos de frete, descarga e armazenamento.</p>
    <p><b>2.5 Prazo de entrega na obra.</b> A VENDEDORA se compromete a entregar os equipamentos no prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias, a contar da data em que o último requisito for preenchido: assinatura do Contrato, pagamento do sinal e aprovação do projeto.</p>
    <p><b>2.5.1</b> Caso a VENDEDORA não realize a entrega no prazo, ficará sujeita a multa moratória diária de 0,05% limitada a 2% sobre o valor do(s) equipamento(s) em atraso.</p>
    <p><b>2.6.2</b> A VENDEDORA realizará a instalação e montagem de cada equipamento em até 30 (trinta) dias após sua entrega, desde que a obra esteja concluída — no caso de escadas/esteiras, quando os "berços" inferior e superior estiverem finalizados; no caso de elevadores, quando o(s) poço(s) estiver(em) liberado(s).</p>

    <h2 class="cl">3 – PREÇO E CONDIÇÕES DE PAGAMENTO</h2>
    <p><b>3.1 Preço.</b> Pela compra dos equipamentos e prestação dos serviços de instalação e montagem, o COMPRADOR pagará à VENDEDORA o valor total de ${dados.valorTotal ? '<span class="fill">R$ '+esc(dados.valorTotal)+'</span>' : V(null,'R$ XXX.XXX,XX')} (${V(dados.valorExtenso,'valor por extenso')}). O pagamento será efetuado conforme cronograma abaixo:</p>
    <table class="pgmt">
      <thead><tr><th>Parcela</th><th style="text-align:center">%</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${parcelasRows || '<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>'}</tbody>
    </table>
    <p><b>3.3 Formas de pagamento.</b> Os valores poderão ser pagos por boleto, depósito bancário ou transferência eletrônica diretamente na conta corrente da VENDEDORA ou de outra forma combinada entre as partes.</p>
    <p><b>3.4 Penalidades por atraso.</b> Caso o COMPRADOR não realize qualquer pagamento na data prevista, incidirá multa de 2%, juros moratórios de 1% ao mês (pro rata die) e correção monetária pelo IGPM ou índice que o substitua.</p>
    <p><b>3.5.1</b> Estão inclusos no preço todos os impostos decorrentes de emissão de Notas Fiscais de venda/serviços, montagem, instalação e ART's. Não estão inclusos taxas de alvará, DIFAL de ICMS, tributos de importação (II, IPI, PIS/COFINS, ICMS-importação, AFRMM, SISCOMEX) havidos após a emissão.</p>

    <h2 class="cl">4 – OBRIGAÇÕES DA VENDEDORA</h2>
    <p><b>4.1</b> A VENDEDORA adotará todas as Normas Regulamentadoras de Segurança e Saúde no Trabalho, fornecendo EPIs e EPCs à sua equipe.</p>
    <p><b>4.3</b> A VENDEDORA é a única responsável por seus funcionários e prepostos, arcando com todas as responsabilidades trabalhistas, previdenciárias e sociais, isentando o COMPRADOR.</p>
    <p><b>4.4</b> Danos materiais/morais por dolo ou culpa grave dos profissionais da VENDEDORA serão indenizados, limitados ao valor total do Contrato, mediante nexo causal apurado em juízo — reciprocamente aplicável ao COMPRADOR.</p>

    <h2 class="cl">5 – OBRIGAÇÕES DO COMPRADOR</h2>
    <p><b>5.1</b> O COMPRADOR se obriga a cumprir suas obrigações contratuais, em especial o pagamento em dia e os prazos das obras civis e elétricas de sua responsabilidade.</p>
    <p><b>5.3</b> O COMPRADOR oferecerá local fechado adequado para armazenamento de peças e ferramentas, responsabilizando-se por sua guarda.</p>
    <p><b>5.4</b> O COMPRADOR custeará qualquer obra, projeto civil ou reforma necessários à instalação, conforme projeto executivo entregue pela VENDEDORA.</p>

    <h2 class="cl">6 – GARANTIAS</h2>
    <p><b>6.1 Prazo de garantia.</b> Os equipamentos terão garantia das peças de 90 (noventa) dias a contar da assinatura do Termo de Conclusão da Instalação, podendo ser estendido por mais 9 (nove) meses desde que sob assistência técnica da VENDEDORA ou empresa homologada.</p>
    <p><b>6.2.1</b> A garantia não cobre: desgaste normal; mau uso/vandalismo; infiltração; sobrecarga elétrica; falta de energia; uso de líquidos; casos fortuitos; deficiências de construção civil; ausência de manutenção. Materiais frágeis (lâmpadas, fusíveis, sensores) também não são cobertos.</p>

    <h2 class="cl">7 – PENALIDADES POR DESCUMPRIMENTO</h2>
    <p><b>7.1</b> No caso de descumprimento de qualquer cláusula sem multa específica, a parte infratora arcará com multa de 2% sobre o valor do Contrato, paga à vista em até 10 (dez) dias, acrescida de honorários advocatícios de 20% se necessária medida judicial.</p>

    <h2 class="cl">8 – CONDIÇÕES DE ENCERRAMENTO DO CONTRATO</h2>
    <p><b>8.1</b> Decorridos 30 (trinta) dias de atraso no pagamento, a VENDEDORA notificará por escrito concedendo 5 (cinco) dias úteis; não regularizado, o Contrato estará rescindido de pleno direito.</p>
    <p><b>8.2.2</b> Desistência após a ordem de fabricação: permanecem devidos 70% do valor total (fabricação dos equipamentos sob medida) e indenização de 50% sobre o valor dos serviços de instalação e montagem.</p>

    <h2 class="cl">9 – CASO FORTUITO E FORÇA MAIOR</h2>
    <p><b>9.1</b> As partes não respondem por descumprimento decorrente de caso fortuito ou força maior (art. 393 do Código Civil). Não se consideram caso fortuito: dificuldades econômico-financeiras, perda de mercado, greves previsíveis e condições climáticas previsíveis.</p>

    <h2 class="cl">10 – DISPOSIÇÕES FINAIS</h2>
    <p><b>10.1 Dados para comunicação.</b> O relacionamento entre as partes será pela forma escrita (inclusive e-mail). Dados do COMPRADOR: ${V(dados.responsavel,'nome completo')} — ${V(dados.razaoSocial,'empresa')}. Dados da VENDEDORA: Diego Yutaka Maeno (CEO) — diego@verticalparts.com.br.</p>
    <p><b>10.8</b> O COMPRADOR declara que seu representante legal possui poderes regulares de representação na data de assinatura, sob pena do art. 299 do Decreto-Lei 2.848/40.</p>
    <p><b>10.9</b> As partes reconhecem o presente contrato como título executivo extrajudicial (art. 784, III, CPC).</p>
    <p><b>10.10</b> As partes declaram que leram e entenderam o conteúdo do presente contrato.</p>
    <p><b>10.13 Assinatura digital.</b> As partes estabelecem que este contrato poderá ser firmado por meios eletrônicos com assinatura eletrônica, nos termos do art. 10 da MP 2.200/2011.</p>

    <div class="sign-wrap keep">
      <p style="margin-top:20px">${V(dados.cidadeAss,'Guarulhos')}, ${dataBR(dados.dataAss)}.</p>
      <div class="sign-row">
        <div class="sign-box">
          <div class="ln"></div>
          <div class="nm">VENDEDORA — VERTICAL PARTS</div>
          <div class="sub">Diego Yutaka Maeno · CPF: 249.432.208-19</div>
        </div>
        <div class="sign-box">
          <div class="ln"></div>
          <div class="nm">COMPRADOR — ${T(dados.razaoSocial,'(RAZÃO SOCIAL) LTDA.')}</div>
          <div class="sub">${T(dados.responsavel,'NOME')} · CPF: ${T(dados.cpf,'________')}</div>
        </div>
      </div>
      <p style="margin-top:34px"><b>TESTEMUNHAS:</b></p>
      <div class="sign-row" style="margin-top:24px">
        <div class="sign-box">
          <div class="ln"></div>
          <div class="sub" style="text-align:left">1. Nome: ${T(dados.test1Nome,'____________________')}<br>&nbsp;&nbsp;&nbsp;CPF: ${T(dados.test1Cpf,'____________')}</div>
        </div>
        <div class="sign-box">
          <div class="ln"></div>
          <div class="sub" style="text-align:left">2. Nome: ${T(dados.test2Nome,'____________________')}<br>&nbsp;&nbsp;&nbsp;CPF: ${T(dados.test2Cpf,'____________')}</div>
        </div>
      </div>
    </div>

  </td></tr></tbody>
  <tfoot><tr><td></td></tr></tfoot>
</table>
</body></html>`;
}

Object.assign(window, { ContratoEditorPage, gerarContratoPDF });
