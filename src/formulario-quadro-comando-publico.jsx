/* ============================================================
   formulario-quadro-comando-publico.jsx — página pública (sem login)
   Wizard de levantamento técnico pra pedido de orçamento de Quadro de
   Comando. Envia pra Edge Function `capturar-lead-quadro-comando`, que
   cria um Lead em Comercial > Leads (mesmo funil que o site
   institucional já alimenta) — ver supabase/functions/capturar-lead-quadro-comando.

   Inspirado na estrutura de wizard (passos, stepper, condicionais,
   resumo antes de enviar) de um formulário público equivalente de
   outro fornecedor, investigado a pedido do usuário em 07/10/2026 —
   vocabulário técnico (tensão de rede, tipo de porta/freio, tipo de
   acionamento) é terminologia padrão de elevadores, não específica de
   ninguém. Esta tela NÃO mexe no formulário interno `quadro-comando.jsx`
   (Comercial > Formulários), que continua sendo a ferramenta de
   engenharia pós-venda (BOM, estoque, checklist) — este wizard é só a
   porta de entrada pública, pré-venda.

   Ícones: por ora emoji simples (mesmo peso visual do fallback usado
   lá fora) — ponto único de troca em STEP_ICON_SRC quando o usuário
   mandar o set de ilustrações isométricas já combinado.
   ============================================================ */

(function () {
  const EDGE_URL = 'https://jxtqwzmpgofwctqajewt.functions.supabase.co/capturar-lead-quadro-comando';
  const TOTAL_PASSOS = 6;

  /* Ponto único de troca: quando houver imagem pronta pro passo, só
     preencher a URL aqui — o fallback em emoji continua funcionando
     sem imagem nenhuma. */
  const ICONS_BASE = 'https://jxtqwzmpgofwctqajewt.supabase.co/storage/v1/object/public/engenharia/formulario-quadro-comando-publico/icones';
  const STEP_ICON_SRC = {
    boasVindas: null,
    identificacao: `${ICONS_BASE}/identificacao.webp`,
    quadro: null,
    porta: `${ICONS_BASE}/porta.webp`,
    acessorios: `${ICONS_BASE}/acessorios.webp`,
    fiacao: null,
    revisao: `${ICONS_BASE}/revisao.webp`,
  };

  const VARIANTES_QUADRO = [
    { value: '7.5_220', label: '7,5 kW / 220 V' },
    { value: '7.5_380', label: '7,5 kW / 380 V' },
    { value: '15_220', label: '15 kW / 220 V' },
    { value: '15_380', label: '15 kW / 380 V' },
    { value: '30_380', label: '30 kW / 380 V' },
  ];

  const ACESSORIOS = [
    ['cop', 'COP — Botoeira de Cabina'],
    ['lop', 'LOP — Botoeira de Pavimento'],
    ['lip', 'LIP — Indicador de Posição sobre as Portas'],
    ['resgate', 'Resgate Automático (ARD)'],
    ['interfone', 'Interfone 5 Canais'],
    ['insp_cabina', 'Botoeira de Inspeção sobre a Cabina'],
    ['insp_poco', 'Botoeira de Inspeção no Fundo do Poço'],
    ['stop_poco', 'Botão de Stop para Acesso ao Poço'],
    ['gongo', 'Gongo'],
    ['anuncio_voz', 'Anúncio de Voz na Cabina'],
    ['sensor_foto', 'Sensor Fotoelétrico de Poço'],
    ['barreira_luz', 'Barreira de Luz (Cortina) da Porta'],
    ['pesador', 'Pesador de Carga'],
    ['camera', 'Câmera na Cabina'],
  ];

  const LABELS = {
    modernizacao: 'Modernização', elevador_novo: 'Elevador Novo',
    residencial: 'Residencial', comercial: 'Comercial', hospitalar: 'Hospitalar', industrial: 'Industrial',
    simplex: 'Simplex', duplex: 'Duplex', triplex: 'Triplex', quadriplex: 'Quadriplex',
    manual: 'Manual', eixo_vertical: 'Eixo Vertical', simultanea: 'Simultânea', pantografica: 'Pantográfica',
    vvvf: 'VVVF', trifasico: 'Trifásico', monofasico: 'Monofásico', corr_continua: 'Corr. Contínua',
    bobina_tensao: 'Bobina — Tensão', tipo_bs: 'Tipo BS', moto_freio: 'Moto Freio', nao_possui: 'Não Possui',
    vf: 'VVVF — Inversor de Frequência', ca: 'CA — Por Contatores', hd: 'HD — Hidráulico',
    com_casa: 'Com Casa de Máquinas', sem_casa: 'Sem Casa de Máquinas',
    sem_encoder: 'Sem Encoder', com_encoder: 'Com Encoder',
  };
  const lbl = (v) => LABELS[v] || v || '—';

  const DEFAULT_FORM = {
    tipo_servico: '', cnpj: '', empresa: '', solicitante: '', telefone: '', email: '',
    identificacao: '', num_paradas: '',
    variante_quadro: '', tensao_rede: '', tensao_rede_outro: '', potencia_motor: '', tensao_motor: '',
    corrente_nominal: '', aplicacao: '', atendimento: '', num_botoeiras: '',
    tipo_porta: '', operador_porta: '', tipo_freio: '', tensao_freio: '',
    acionamento: '', encoder: '', engrenagem: '', casa_maquinas: '',
    acessorios: {}, ind_cor: '', observacoes: '',
    fiacao_omitida: false, dist: [], f_l1: '', f_ua: '', f_tr: '', f_bp: '', f_lim: '', f_fp: '',
    obs_fiacao: '',
  };

  function Icon({ passo, emoji }) {
    const src = STEP_ICON_SRC[passo];
    // Ilustrações isométricas exportadas em 320x175 (16:9-ish) — a caixa
    // segue a mesma proporção pra `cover` não cortar nada, só encaixar.
    if (src) return <img src={src} alt="" style={{ width: 56, height: 31, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}/>;
    return <span style={{ fontSize: 20 }}>{emoji}</span>;
  }

  function Field({ label, req, children, hint }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--gray-700)' }}>
          {label} {req && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
        {children}
        {hint && <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{hint}</span>}
      </div>
    );
  }

  const inputStyle = {
    border: '1.5px solid var(--gray-300)', borderRadius: 6, padding: '9px 12px',
    fontFamily: 'Poppins, sans-serif', fontSize: 14, color: 'var(--gray-900)', background: '#fff', width: '100%',
  };

  function TInput(props) {
    const { value, onChange, ...rest } = props;
    return <input {...rest} value={value == null ? '' : value} onChange={(e) => onChange(e.target.value)} style={inputStyle}/>;
  }
  function TSelect({ value, onChange, options, placeholder }) {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">{placeholder || '-- Selecione --'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  function RadioGroup({ name, value, onChange, options }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const sel = value === o.value;
          return (
            <label key={o.value} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: sel ? 'var(--vp-yellow-tint)' : 'var(--gray-100)',
              border: `1.5px solid ${sel ? 'var(--vp-yellow-press)' : 'var(--gray-300)'}`, borderRadius: 6,
              padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: sel ? 'var(--vp-yellow-press)' : 'var(--gray-900)',
            }}>
              <input type="radio" name={name} checked={sel} onChange={() => onChange(o.value)} style={{ display: 'none' }}/>
              {o.label}
            </label>
          );
        })}
      </div>
    );
  }
  function CheckOption({ label, checked, onChange }) {
    return (
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6, background: checked ? 'var(--vp-yellow-tint)' : 'var(--gray-100)',
        border: `1.5px solid ${checked ? 'var(--vp-yellow-press)' : 'var(--gray-300)'}`, borderRadius: 6,
        padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: checked ? 'var(--vp-yellow-press)' : 'var(--gray-900)',
      }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: 'none' }}/>
        {label}
      </label>
    );
  }
  function Section({ icon, passo, title, tag, children }) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ background: 'var(--vp-black)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon passo={passo} emoji={icon}/>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>{title}</span>
          {tag && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase' }}>{tag}</span>}
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    );
  }
  function Grid({ cols, children }) {
    return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>{children}</div>;
  }
  function Btn({ children, onClick, kind, disabled }) {
    const base = {
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 7,
      fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: .5,
      textTransform: 'uppercase', cursor: disabled ? 'default' : 'pointer', border: 'none', opacity: disabled ? .6 : 1,
    };
    const styles = {
      primary: { background: 'var(--vp-yellow)', color: 'var(--vp-black)' },
      secondary: { background: '#fff', color: 'var(--gray-900)', border: '1.5px solid var(--gray-300)' },
      success: { background: 'var(--success)', color: '#fff' },
    };
    return <button type="button" disabled={disabled} onClick={onClick} style={{ ...base, ...styles[kind || 'primary'] }}>{children}</button>;
  }

  function Stepper({ passo }) {
    const steps = ['Início', 'Identificação', 'Quadro', 'Porta/Acionamento', 'Acessórios', 'Fiação', 'Revisão'];
    return (
      <div style={{ display: 'flex', maxWidth: 900, margin: '0 auto 24px', flexWrap: 'wrap', gap: 4 }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            flex: '1 1 100px', textAlign: 'center', padding: '8px 2px',
            borderBottom: `3px solid ${i === passo ? 'var(--vp-yellow)' : i < passo ? 'var(--success)' : 'transparent'}`,
            opacity: i === passo ? 1 : i < passo ? 0.75 : 0.4,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>{s}</div>
          </div>
        ))}
      </div>
    );
  }

  function ErroBox({ erros }) {
    if (!erros || !erros.length) return null;
    return (
      <div style={{ background: 'var(--danger-tint)', borderLeft: '4px solid var(--danger)', borderRadius: '0 6px 6px 0', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#8c1414' }}>
        <strong>Por favor, preencha os campos obrigatórios:</strong>
        <ul style={{ marginTop: 6, paddingLeft: 18 }}>{erros.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    );
  }

  function FormularioQuadroComandoPublico() {
    const [passo, setPasso] = React.useState(0);
    const [f, setF] = React.useState(DEFAULT_FORM);
    const [erros, setErros] = React.useState([]);
    const [cnpjStatus, setCnpjStatus] = React.useState(null); // {tipo:'ok'|'erro'|'buscando', msg}
    const [enviando, setEnviando] = React.useState(false);
    const [resultado, setResultado] = React.useState(null); // {ok:true, lead_id} | {ok:false, erro}

    const set = (patch) => setF((p) => ({ ...p, ...patch }));
    const setAcessorio = (key, v) => setF((p) => ({ ...p, acessorios: { ...p.acessorios, [key]: v } }));

    // Tabela de distâncias entre pavimentos — reage ao nº de paradas
    React.useEffect(() => {
      const n = parseInt(f.num_paradas, 10) || 0;
      const linhas = n > 1 ? Math.min(n - 1, 32) : 0;
      setF((p) => {
        const atual = p.dist || [];
        if (atual.length === linhas) return p;
        const novo = Array.from({ length: linhas }, (_, i) => atual[i] || { de: '', ate: '', m: '' });
        return { ...p, dist: novo };
      });
      // eslint-disable-next-line
    }, [f.num_paradas]);

    async function buscarCNPJ() {
      const digits = (f.cnpj || '').replace(/\D/g, '');
      if (digits.length !== 14) { setCnpjStatus({ tipo: 'erro', msg: 'Informe os 14 dígitos do CNPJ.' }); return; }
      if (!window.EnderecoAPI || !window.EnderecoAPI.isCnpjValido(digits)) { setCnpjStatus({ tipo: 'erro', msg: 'CNPJ inválido — confira os dígitos.' }); return; }
      setCnpjStatus({ tipo: 'buscando', msg: 'Consultando…' });
      try {
        const dados = await window.EnderecoAPI.buscarCNPJ(digits);
        if (dados && dados.razao_social) {
          set({ empresa: dados.razao_social });
          setCnpjStatus({ tipo: 'ok', msg: `✅ ${dados.razao_social}${dados.municipio ? ' — ' + dados.municipio + '/' + dados.uf : ''}` });
        } else {
          setCnpjStatus({ tipo: 'erro', msg: 'CNPJ válido, mas não encontramos a razão social — preencha manualmente.' });
        }
      } catch (e) {
        setCnpjStatus({ tipo: 'erro', msg: 'Não foi possível consultar agora — preencha a Razão Social manualmente.' });
      }
    }

    function mascararCNPJ(v) {
      let d = v.replace(/\D/g, '').slice(0, 14);
      d = d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
      return d;
    }

    function validar(p) {
      const e = [];
      if (p === 0) { if (!f.tipo_servico) e.push('Tipo de Serviço'); }
      if (p === 1) {
        const digits = (f.cnpj || '').replace(/\D/g, '');
        if (digits.length !== 14) e.push('CNPJ (14 dígitos)');
        if (!f.empresa.trim()) e.push('Razão Social da Empresa');
        if (!f.solicitante.trim()) e.push('Nome do Solicitante');
        if (!f.telefone.trim()) e.push('Telefone');
        if (!f.identificacao.trim()) e.push('Identificação da Obra');
        if (!f.num_paradas || parseInt(f.num_paradas, 10) < 2) e.push('Número de Paradas (mínimo 2)');
      }
      if (p === 2) {
        if (!f.variante_quadro) e.push('Modelo do Quadro (potência/tensão)');
        if (!f.tensao_rede) e.push('Tensão da Rede');
        if (!f.potencia_motor) e.push('Potência do Motor');
        if (!f.tensao_motor) e.push('Tensão do Motor');
        if (!f.aplicacao) e.push('Aplicação');
        if (!f.atendimento) e.push('Atendimento');
        if (['duplex', 'triplex', 'quadriplex'].includes(f.atendimento) && !f.num_botoeiras) e.push('Nº de Botoeiras');
      }
      if (p === 3) {
        if (!f.tipo_porta) e.push('Tipo de Porta');
        if (!f.operador_porta) e.push('Operador de Porta');
        if (!f.tipo_freio) e.push('Tipo de Freio');
        if (f.tipo_freio && f.tipo_freio !== 'nao_possui' && !f.tensao_freio) e.push('Tensão do Freio');
        if (!f.acionamento) e.push('Tipo de Acionamento');
        if (f.acionamento === 'vf' && !f.casa_maquinas) e.push('Casa de Máquinas');
      }
      if (p === 5 && !f.fiacao_omitida) {
        if (!f.f_l1) e.push('Fiação: L1');
        if (!f.f_ua) e.push('Fiação: UA');
        if (!f.f_tr) e.push('Fiação: TR');
        if (!f.f_bp) e.push('Fiação: BP');
        if (!f.f_lim) e.push('Fiação: LIM');
        if (!f.f_fp) e.push('Fiação: FP');
      }
      return e;
    }

    function irPara(n) {
      const e = validar(passo);
      if (e.length) { setErros(e); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      setErros([]);
      setPasso(n);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function enviar() {
      const e = validar(passo);
      if (e.length) { setErros(e); return; }
      setEnviando(true);
      try {
        const acessoriosLista = ACESSORIOS.filter(([k]) => f.acessorios[k]).map(([, l]) => l);
        const corpo = {
          ...f,
          acessorios: acessoriosLista.join(', '),
          distancias: (f.dist || []).map((d, i) => `${i + 1}# - De: ${d.de} - Até: ${d.ate} - Metros: ${d.m}`).filter((_, i) => f.dist[i] && f.dist[i].m).join('\n'),
        };
        const resp = await fetch(EDGE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok || !dados.success) {
          setResultado({ ok: false, erro: dados.error || 'Não foi possível enviar agora. Tente novamente em instantes.' });
        } else {
          setResultado({ ok: true, lead_id: dados.lead_id });
        }
      } catch (err) {
        setResultado({ ok: false, erro: 'Falha de conexão — verifique sua internet e tente novamente.' });
      } finally {
        setEnviando(false);
      }
    }

    if (resultado && resultado.ok) {
      return (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '60px 40px', textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 26, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>Solicitação enviada com sucesso!</h2>
          <p style={{ color: 'var(--gray-700)', marginBottom: 6 }}>Seu número de protocolo é:</p>
          <div style={{ background: 'var(--vp-yellow-tint)', border: '2px solid var(--vp-yellow-press)', borderRadius: 8, display: 'inline-block', padding: '12px 32px', fontSize: 20, fontWeight: 700, margin: '14px 0', letterSpacing: 1 }}>{resultado.lead_id}</div>
          <p style={{ fontSize: 14, color: 'var(--gray-700)', maxWidth: 480, margin: '0 auto' }}>Nossa equipe comercial vai analisar a especificação técnica e entrar em contato com a proposta de orçamento.</p>
        </div>
      );
    }

    return (
      <div style={{ paddingTop: 24 }}>
        <Stepper passo={passo}/>
        <ErroBox erros={erros}/>
        {resultado && !resultado.ok && (
          <div style={{ background: 'var(--danger-tint)', borderLeft: '4px solid var(--danger)', padding: '12px 16px', borderRadius: '0 6px 6px 0', marginBottom: 16, fontSize: 13, color: '#8c1414' }}>{resultado.erro}</div>
        )}

        {passo === 0 && (
          <Section icon="🚀" passo="boasVindas" title="Bem-vindo ao Portal de Especificação Técnica VerticalParts">
            <p style={{ fontSize: 13, color: 'var(--gray-700)' }}>Informe o tipo de serviço e siga o passo a passo — leva poucos minutos.</p>
            <Field label="Tipo de Serviço" req>
              <RadioGroup name="tipo_servico" value={f.tipo_servico} onChange={(v) => set({ tipo_servico: v })}
                options={[{ value: 'modernizacao', label: 'Modernização (elevador existente)' }, { value: 'elevador_novo', label: 'Elevador Novo' }]}/>
            </Field>
          </Section>
        )}

        {passo === 1 && (
          <Section icon="🏢" passo="identificacao" title="Dados do Solicitante" tag="Passo 1 de 5">
            <div style={{ background: 'var(--vp-yellow-tint)', border: '1.5px solid var(--vp-yellow-press)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vp-yellow-press)', marginBottom: 8 }}>🔍 Identificação pela Empresa (CNPJ)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Field label="CNPJ" req>
                    <TInput value={f.cnpj} placeholder="00.000.000/0000-00" maxLength={18}
                      onChange={(v) => { set({ cnpj: mascararCNPJ(v) }); setCnpjStatus(null); }}
                      onBlur={buscarCNPJ}/>
                  </Field>
                </div>
                <Btn onClick={buscarCNPJ}>Verificar CNPJ</Btn>
              </div>
              {cnpjStatus && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: cnpjStatus.tipo === 'erro' ? 'var(--danger)' : 'var(--success)' }}>{cnpjStatus.msg}</div>
              )}
            </div>
            <Grid cols={3}>
              <Field label="Razão Social / Empresa" req><TInput value={f.empresa} placeholder="Preenchido pelo CNPJ" onChange={(v) => set({ empresa: v })}/></Field>
              <Field label="Nome do Solicitante" req><TInput value={f.solicitante} placeholder="Nome completo" onChange={(v) => set({ solicitante: v })}/></Field>
              <Field label="Telefone / WhatsApp" req><TInput type="tel" value={f.telefone} placeholder="(11) 90000-0000" onChange={(v) => set({ telefone: v })}/></Field>
              <Field label="E-mail para contato"><TInput type="email" value={f.email} placeholder="email@empresa.com.br" onChange={(v) => set({ email: v })}/></Field>
              <Field label="Identificação da Obra / Referência" req><TInput value={f.identificacao} placeholder="Ex: Edifício Azul, Rua das Flores 100" onChange={(v) => set({ identificacao: v })}/></Field>
              <Field label="Número de Paradas" req><TInput type="number" value={f.num_paradas} min="2" max="64" placeholder="Ex: 10" onChange={(v) => set({ num_paradas: v })}/></Field>
            </Grid>
          </Section>
        )}

        {passo === 2 && (
          <Section icon="⚙️" passo="quadro" title="Especificações do Quadro de Comando" tag="Passo 2 de 5">
            <Grid cols={3}>
              <Field label="Modelo do Quadro (potência/tensão)" req>
                <TSelect value={f.variante_quadro} onChange={(v) => set({ variante_quadro: v })} options={VARIANTES_QUADRO}/>
              </Field>
              <Field label="Tensão da Rede (V)" req>
                <TSelect value={f.tensao_rede} onChange={(v) => set({ tensao_rede: v })} options={[{ value: '220', label: '220 V' }, { value: '380', label: '380 V' }, { value: '440', label: '440 V' }, { value: 'outro', label: 'Outra' }]}/>
              </Field>
              {f.tensao_rede === 'outro' && <Field label="Tensão da Rede — Outro (V)"><TInput type="number" value={f.tensao_rede_outro} onChange={(v) => set({ tensao_rede_outro: v })}/></Field>}
              <Field label="Potência do Motor (HP)" req><TInput type="number" step="0.5" value={f.potencia_motor} placeholder="Ex: 15" onChange={(v) => set({ potencia_motor: v })}/></Field>
              <Field label="Tensão do Motor (V)" req><TInput type="number" value={f.tensao_motor} placeholder="Ex: 220" onChange={(v) => set({ tensao_motor: v })}/></Field>
              <Field label="Corrente Nominal do Motor (A)" hint={f.corrente_nominal ? `▶ Inversor recomendado: ${(parseFloat(f.corrente_nominal) * 2 / 1.5).toFixed(1)}A nominais` : null}>
                <TInput type="number" step="0.1" value={f.corrente_nominal} placeholder="Ex: 45" onChange={(v) => set({ corrente_nominal: v })}/>
              </Field>
            </Grid>
            <Grid cols={2}>
              <Field label="Aplicação" req>
                <RadioGroup name="aplicacao" value={f.aplicacao} onChange={(v) => set({ aplicacao: v })}
                  options={[['residencial', 'Residencial'], ['comercial', 'Comercial'], ['hospitalar', 'Hospitalar'], ['industrial', 'Industrial']].map(([value, label]) => ({ value, label }))}/>
              </Field>
              <Field label="Atendimento" req>
                <RadioGroup name="atendimento" value={f.atendimento} onChange={(v) => set({ atendimento: v })}
                  options={[['simplex', 'Simplex'], ['duplex', 'Duplex'], ['triplex', 'Triplex'], ['quadriplex', 'Quadriplex']].map(([value, label]) => ({ value, label }))}/>
                {['duplex', 'triplex', 'quadriplex'].includes(f.atendimento) && (
                  <div style={{ marginTop: 10, maxWidth: 200 }}>
                    <Field label="Nº de Botoeiras" req><TInput type="number" min="1" max="4" value={f.num_botoeiras} onChange={(v) => set({ num_botoeiras: v })}/></Field>
                  </div>
                )}
              </Field>
            </Grid>
          </Section>
        )}

        {passo === 3 && (
          <React.Fragment>
            <Section icon="🔧" passo="porta" title="Porta e Freio" tag="Passo 3 de 5">
              <Grid cols={2}>
                <Field label="Tipo de Porta" req>
                  <RadioGroup name="tipo_porta" value={f.tipo_porta} onChange={(v) => set({ tipo_porta: v })}
                    options={[['manual', 'Manual'], ['eixo_vertical', 'Eixo Vertical'], ['simultanea', 'Simultânea'], ['pantografica', 'Pantográfica']].map(([value, label]) => ({ value, label }))}/>
                </Field>
                <Field label="Operador de Porta" req>
                  <RadioGroup name="operador_porta" value={f.operador_porta} onChange={(v) => set({ operador_porta: v })}
                    options={[['vvvf', 'VVVF'], ['trifasico', 'Trifásico'], ['monofasico', 'Monofásico'], ['corr_continua', 'Corr. Contínua']].map(([value, label]) => ({ value, label }))}/>
                </Field>
              </Grid>
              <Grid cols={2}>
                <Field label="Tipo de Freio" req>
                  <RadioGroup name="tipo_freio" value={f.tipo_freio} onChange={(v) => set({ tipo_freio: v })}
                    options={[['bobina_tensao', 'Bobina — Tensão'], ['trifasico', 'Trifásico'], ['tipo_bs', 'Tipo BS'], ['moto_freio', 'Moto Freio'], ['nao_possui', 'Não Possui']].map(([value, label]) => ({ value, label }))}/>
                </Field>
                {f.tipo_freio && f.tipo_freio !== 'nao_possui' && (
                  <Field label="Tensão do Freio (V)" req><TInput type="number" value={f.tensao_freio} placeholder="Ex: 110 ou 220" onChange={(v) => set({ tensao_freio: v })}/></Field>
                )}
              </Grid>
            </Section>
            <Section icon="🔩" passo="porta" title="Tipo de Acionamento">
              <Field label="Tipo de Acionamento" req>
                <RadioGroup name="acionamento" value={f.acionamento} onChange={(v) => set({ acionamento: v })}
                  options={[['vf', 'VVVF — Inversor de Frequência'], ['ca', 'CA — Por Contatores'], ['hd', 'HD — Hidráulico']].map(([value, label]) => ({ value, label }))}/>
              </Field>
              {f.acionamento === 'vf' && (
                <Grid cols={2}>
                  <Field label="Encoder">
                    <RadioGroup name="encoder" value={f.encoder} onChange={(v) => set({ encoder: v })}
                      options={[['sem_encoder', 'Sem Encoder'], ['com_encoder', 'Com Encoder']].map(([value, label]) => ({ value, label }))}/>
                  </Field>
                  <Field label="Casa de Máquinas" req>
                    <RadioGroup name="casa_maquinas" value={f.casa_maquinas} onChange={(v) => set({ casa_maquinas: v })}
                      options={[['com_casa', 'Com Casa de Máquinas'], ['sem_casa', 'Sem Casa de Máquinas']].map(([value, label]) => ({ value, label }))}/>
                  </Field>
                </Grid>
              )}
              {['hd', 'ca'].includes(f.acionamento) && (
                <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>Detalhes adicionais desse tipo de acionamento — descreva nas Observações (próximo passo), se tiver à mão.</p>
              )}
            </Section>
          </React.Fragment>
        )}

        {passo === 4 && (
          <React.Fragment>
            <Section icon="💡" passo="acessorios" title="Acessórios" tag="Passo 4 de 5">
              <Field label="Cor dos Indicadores">
                <RadioGroup name="ind_cor" value={f.ind_cor} onChange={(v) => set({ ind_cor: v })}
                  options={[['vermelho', 'Vermelho'], ['azul', 'Azul'], ['branco', 'Branco']].map(([value, label]) => ({ value, label }))}/>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {ACESSORIOS.map(([key, label]) => (
                  <CheckOption key={key} label={label} checked={!!f.acessorios[key]} onChange={(v) => setAcessorio(key, v)}/>
                ))}
              </div>
            </Section>
            <Section icon="📝" passo="acessorios" title="Observações">
              <Field label="Observações gerais" hint="Qualquer detalhe adicional relevante pro orçamento">
                <textarea value={f.observacoes} onChange={(e) => set({ observacoes: e.target.value })} rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }} placeholder="Informações adicionais..."/>
              </Field>
            </Section>
          </React.Fragment>
        )}

        {passo === 5 && (
          <Section icon="📐" passo="fiacao" title="Pré-Fiação de Poço" tag="Opcional">
            <div style={{ background: '#fff8e1', borderLeft: '4px solid #ffc107', borderRadius: '0 6px 6px 0', padding: '12px 16px', fontSize: 13, color: '#5d4037' }}>
              <strong>⚠️ Atenção:</strong> necessário pra calcular o orçamento com precisão. Se não tiver agora, marque abaixo e usaremos valores padrão.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.fiacao_omitida} onChange={(e) => set({ fiacao_omitida: e.target.checked })}/>
              Não tenho os dados de fiação agora — usar valores padrão
            </label>
            {!f.fiacao_omitida && (
              <React.Fragment>
                {f.dist.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6 }}>Distâncias entre Pavimentos — {f.dist.length} distância(s)</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>
                          <th style={{ background: 'var(--vp-black)', color: '#fff', padding: '6px 10px', fontSize: 11 }}>#</th>
                          <th style={{ background: 'var(--vp-black)', color: '#fff', padding: '6px 10px', fontSize: 11 }}>De</th>
                          <th style={{ background: 'var(--vp-black)', color: '#fff', padding: '6px 10px', fontSize: 11 }}>Até</th>
                          <th style={{ background: 'var(--vp-black)', color: '#fff', padding: '6px 10px', fontSize: 11 }}>Metros</th>
                        </tr></thead>
                        <tbody>
                          {f.dist.map((d, i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #ddd' }}>{i + 1}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}><input value={d.de} onChange={(e) => { const nd = [...f.dist]; nd[i] = { ...nd[i], de: e.target.value }; set({ dist: nd }); }} style={{ width: 54, border: 'none', textAlign: 'center' }}/></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}><input value={d.ate} onChange={(e) => { const nd = [...f.dist]; nd[i] = { ...nd[i], ate: e.target.value }; set({ dist: nd }); }} style={{ width: 54, border: 'none', textAlign: 'center' }}/></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}><input type="number" value={d.m} onChange={(e) => { const nd = [...f.dist]; nd[i] = { ...nd[i], m: e.target.value }; set({ dist: nd }); }} style={{ width: 70, border: 'none', textAlign: 'center' }}/></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <Grid cols={3}>
                  <Field label="L1 — Quadro → entrada do poço (m)" req><TInput type="number" step="0.1" value={f.f_l1} onChange={(v) => set({ f_l1: v })}/></Field>
                  <Field label="UA — Entrada do poço → botoeira (m)" req><TInput type="number" step="0.1" value={f.f_ua} onChange={(v) => set({ f_ua: v })}/></Field>
                  <Field label="TR — Contato de TRICO → calha (m)" req><TInput type="number" step="0.1" value={f.f_tr} onChange={(v) => set({ f_tr: v })}/></Field>
                  <Field label="BP — Botoeira → calha (m)" req><TInput type="number" step="0.1" value={f.f_bp} onChange={(v) => set({ f_bp: v })}/></Field>
                  <Field label="LIM — Limites → calha (m)" req><TInput type="number" step="0.1" value={f.f_lim} onChange={(v) => set({ f_lim: v })}/></Field>
                  <Field label="FP — PAP → calha (m)" req><TInput type="number" step="0.1" value={f.f_fp} onChange={(v) => set({ f_fp: v })}/></Field>
                </Grid>
                <Field label="Observações sobre a fiação">
                  <textarea value={f.obs_fiacao} onChange={(e) => set({ obs_fiacao: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }}/>
                </Field>
              </React.Fragment>
            )}
          </Section>
        )}

        {passo === 6 && (
          <Section icon="📋" passo="revisao" title="Revisão — Resumo do Levantamento" tag="Passo Final">
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '4px 16px', fontSize: 14 }}>
              {[
                ['Empresa', f.empresa], ['CNPJ', f.cnpj], ['Solicitante', f.solicitante], ['Telefone', f.telefone], ['E-mail', f.email || '—'],
                ['Obra / Referência', f.identificacao], ['Nº de Paradas', f.num_paradas], ['Tipo de Serviço', lbl(f.tipo_servico)],
                ['Modelo do Quadro', (VARIANTES_QUADRO.find((v) => v.value === f.variante_quadro) || {}).label || '—'],
                ['Tensão da Rede', f.tensao_rede === 'outro' ? `${f.tensao_rede_outro} V (outro)` : `${f.tensao_rede} V`],
                ['Potência do Motor', `${f.potencia_motor} HP`], ['Tensão do Motor', `${f.tensao_motor} V`],
                ['Aplicação', lbl(f.aplicacao)], ['Atendimento', lbl(f.atendimento) + (f.num_botoeiras ? ` (${f.num_botoeiras} botoeiras)` : '')],
                ['Tipo de Porta', lbl(f.tipo_porta)], ['Operador de Porta', lbl(f.operador_porta)],
                ['Tipo de Freio', lbl(f.tipo_freio) + (f.tensao_freio ? ` — ${f.tensao_freio} V` : '')],
                ['Acionamento', lbl(f.acionamento)], ['Casa de Máquinas', lbl(f.casa_maquinas)],
                ['Acessórios', ACESSORIOS.filter(([k]) => f.acessorios[k]).map(([, l]) => l).join(' · ') || 'Nenhum'],
                ['Observações', f.observacoes || '—'],
                ['Fiação de Poço', f.fiacao_omitida ? 'Omitida — valores padrão' : `L1:${f.f_l1}m UA:${f.f_ua}m TR:${f.f_tr}m BP:${f.f_bp}m LIM:${f.f_lim}m FP:${f.f_fp}m`],
              ].filter(([, v]) => v).map(([k, v]) => (
                <React.Fragment key={k}>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', fontSize: 11, textTransform: 'uppercase' }}>{k}</div>
                  <div>{v}</div>
                </React.Fragment>
              ))}
            </div>
          </Section>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          {passo > 0 ? <Btn kind="secondary" onClick={() => irPara(passo - 1)}>← Voltar</Btn> : <div/>}
          {passo < TOTAL_PASSOS
            ? <Btn onClick={() => irPara(passo + 1)}>{passo === 0 ? 'Começar →' : 'Próximo →'}</Btn>
            : <Btn kind="success" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : '✓ Enviar Solicitação de Cotação'}</Btn>}
        </div>
      </div>
    );
  }

  const root = document.getElementById('fqc-root');
  if (root) ReactDOM.createRoot(root).render(<FormularioQuadroComandoPublico/>);
})();
