/* ============================================================
   analise-tecnica.jsx — Wizard guiado para Análise Técnica
   Torna variáveis técnicas obrigatórias ANTES de Precificar
   ============================================================ */

function AnaliseTecnicaWizard({ dossierId, dossier, onClose, onAprovada }) {
  const [step, setStep] = React.useState(0);
  const [analise, setAnalise] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [erros, setErros] = React.useState([]);

  React.useEffect(() => {
    carregarOuCriarAnalise();
  }, [dossierId]);

  const carregarOuCriarAnalise = async () => {
    try {
      setLoading(true);
      // Procura análise existente
      const { data } = await window.__VP_SB.sb
        .from('analise_tecnica')
        .select('*')
        .eq('dossier_id', dossierId)
        .single();

      if (data) {
        setAnalise(data);
      } else {
        // Cria nova
        const nova = await window.__ANALISE_TECNICA.criar(dossierId, dossier?.equip_type || 'elevador');
        setAnalise(nova);
      }
    } catch (e) {
      if (e.message?.includes('no rows')) {
        // Tabela pode não existir ainda, cria nova
        const nova = await window.__ANALISE_TECNICA.criar(dossierId, dossier?.equip_type || 'elevador');
        setAnalise(nova);
      } else {
        window.toast('Erro ao carregar análise: ' + e.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const atualizar = async (campo, valor) => {
    const newAnalise = { ...analise, [campo]: valor };
    setAnalise(newAnalise);
    try {
      await window.__ANALISE_TECNICA.atualizar(analise.id, { [campo]: valor });
    } catch (e) {
      window.toast('Erro ao salvar: ' + e.message, 'error');
    }
  };

  const avancar = async () => {
    const validacao = window.__ANALISE_TECNICA.validarObrigatorios(analise);
    if (!validacao.valido && step < 4) {
      setErros(validacao.erros);
      return;
    }
    if (step < 4) setStep(s => s + 1);
  };

  const voltar = () => {
    if (step > 0) setStep(s => s - 1);
    setErros([]);
  };

  const aprovar = async () => {
    const validacao = window.__ANALISE_TECNICA.validarObrigatorios(analise);
    if (!validacao.valido) {
      setErros(validacao.erros);
      return;
    }
    try {
      await window.__ANALISE_TECNICA.aprovar(analise.id, 'Análise aprovada pelo wizard');
      window.toast('Análise técnica aprovada!', 'success');
      onAprovada?.();
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}>⏳ Carregando análise técnica...</div>;
  }

  if (!analise) {
    return <div style={{ padding: 32, textAlign: 'center' }}>❌ Erro ao carregar</div>;
  }

  const steps = [
    { title: 'Equipamento', icon: '⚙️' },
    { title: 'Localização', icon: '📍' },
    { title: 'Infraestrutura', icon: '🏗️' },
    { title: 'Instalação', icon: '👷' },
    { title: 'Documentos', icon: '📋' }
  ];

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: '24px',
      background: '#f5f5f5',
      borderRadius: '8px'
    }}>
      {/* PROGRESS BAR */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: i <= step ? '#0066cc' : '#ddd',
              color: i <= step ? '#fff' : '#666',
              borderRadius: '4px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }} onClick={() => i < step && setStep(i)}>
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>Passo {step + 1} de {steps.length}</div>
      </div>

      {/* ERROS */}
      {erros.length > 0 && (
        <div style={{
          background: '#ffe6e6',
          border: '1px solid #ff6666',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: 24,
          fontSize: 13
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ Campos obrigatórios faltando:</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {erros.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* CONTEÚDO DO PASSO */}
      <div style={{
        background: '#fff',
        borderRadius: '6px',
        padding: '24px',
        marginBottom: 24,
        minHeight: 300
      }}>
        {step === 0 && (
          <StepEquipamento analise={analise} atualizar={atualizar} />
        )}
        {step === 1 && (
          <StepLocalizacao analise={analise} atualizar={atualizar} />
        )}
        {step === 2 && (
          <StepInfraestrutura analise={analise} atualizar={atualizar} />
        )}
        {step === 3 && (
          <StepInstalacao analise={analise} atualizar={atualizar} />
        )}
        {step === 4 && (
          <StepDocumentos analise={analise} atualizar={atualizar} />
        )}
      </div>

      {/* BOTÕES */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="outline" onClick={voltar} disabled={step === 0}>← Voltar</Button>
          {step < steps.length - 1 ? (
            <Button variant="primary" onClick={avancar}>Avançar →</Button>
          ) : (
            <Button variant="primary" onClick={aprovar}>✓ Aprovar Análise</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepEquipamento({ analise, atualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Tipo de Equipamento</h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Equipamento *</span>
        <select
          className="input"
          value={analise.tipo_equipamento || ''}
          onChange={e => atualizar('tipo_equipamento', e.target.value)}
        >
          <option value="">Selecione…</option>
          {window.__ANALISE_TECNICA.EQUIP_TYPES.map(e => (
            <option key={e} value={e}>
              {({ elevador: 'Elevador', escada: 'Escada Rolante', esteira: 'Esteira' }[e])}
            </option>
          ))}
        </select>
      </label>

      {analise.tipo_equipamento === 'elevador' && (
        <div style={{ background: '#f0f8ff', border: '1px solid #0066cc', borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Especificações do Elevador</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="up-eyebrow muted">Paradas *</span>
              <input
                className="input"
                type="number"
                value={analise.paradas || ''}
                onChange={e => atualizar('paradas', parseInt(e.target.value))}
                placeholder="4, 5, 10…"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="up-eyebrow muted">Carga (kg) *</span>
              <input
                className="input"
                type="number"
                value={analise.carga_kg || ''}
                onChange={e => atualizar('carga_kg', parseInt(e.target.value))}
                placeholder="450, 600, 1000…"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="up-eyebrow muted">Abertura *</span>
              <select
                className="input"
                value={analise.abertura || ''}
                onChange={e => atualizar('abertura', e.target.value)}
              >
                <option value="">Selecione…</option>
                {window.__ANALISE_TECNICA.ABERTURA_OPTS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="up-eyebrow muted">Vão de porta (cm) *</span>
              <input
                className="input"
                type="number"
                value={analise.vao_cm || ''}
                onChange={e => atualizar('vao_cm', parseInt(e.target.value))}
                placeholder="90, 100, 110…"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="up-eyebrow muted">Acabamento *</span>
              <select
                className="input"
                value={analise.acabamento || ''}
                onChange={e => atualizar('acabamento', e.target.value)}
              >
                <option value="">Selecione…</option>
                <option value="Bege">Bege</option>
                <option value="Inox">Inox</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function StepLocalizacao({ analise, atualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Localização da Obra</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="up-eyebrow muted">Cidade *</span>
          <input
            className="input"
            type="text"
            value={analise.cidade_obra || ''}
            onChange={e => atualizar('cidade_obra', e.target.value)}
            placeholder="São Paulo, Rio de Janeiro…"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="up-eyebrow muted">Estado *</span>
          <input
            className="input"
            type="text"
            value={analise.estado_obra || ''}
            onChange={e => atualizar('estado_obra', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SP"
            maxLength="2"
          />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Distância Santos → Obra (km) *</span>
        <input
          className="input"
          type="number"
          value={analise.distancia_santos_km || ''}
          onChange={e => atualizar('distancia_santos_km', parseFloat(e.target.value))}
          placeholder="100, 500…"
        />
        <span className="vp-small" style={{ color: '#666' }}>
          {analise.distancia_santos_km > 100 && '→ Frete de longa distância + hospedagem provável'}
        </span>
      </label>
    </div>
  );
}

function StepInfraestrutura({ analise, atualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Infraestrutura da Obra</h2>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.necessidade_andaime || false}
          onChange={e => atualizar('necessidade_andaime', e.target.checked)}
        />
        <span>Necessidade de andaime</span>
      </label>

      {analise.necessidade_andaime && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 24 }}>
          <span className="up-eyebrow muted">Responsável pelo andaime</span>
          <select
            className="input"
            value={analise.responsavel_andaime || ''}
            onChange={e => atualizar('responsavel_andaime', e.target.value)}
          >
            <option value="">Selecione…</option>
            <option value="VerticalParts">VerticalParts (incluir no preço)</option>
            <option value="Cliente">Cliente (responsabilidade)</option>
          </select>
        </label>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Necessidade de munck *</span>
        <select
          className="input"
          value={analise.necessidade_munck || ''}
          onChange={e => atualizar('necessidade_munck', e.target.value)}
        >
          <option value="">Selecione…</option>
          {window.__ANALISE_TECNICA.MUNCK_OPTS.map(m => (
            <option key={m} value={m}>
              {({ 'nenhum': 'Nenhum munck', '1-munck': '1 munck', '2-munks': '2 munks' }[m])}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.necessidade_armazenagem || false}
          onChange={e => atualizar('necessidade_armazenagem', e.target.checked)}
        />
        <span>Necessidade de armazenagem</span>
      </label>

      {analise.necessidade_armazenagem && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 24 }}>
          <span className="up-eyebrow muted">Observações sobre armazenagem</span>
          <textarea
            className="input"
            rows="2"
            value={analise.observacoes_armazenagem || ''}
            onChange={e => atualizar('observacoes_armazenagem', e.target.value)}
            placeholder="Pé direto, acesso, proteção…"
          />
        </label>
      )}
    </div>
  );
}

function StepInstalacao({ analise, atualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Instalação e Equipe</h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Dias estimados de instalação *</span>
        <input
          className="input"
          type="number"
          value={analise.dias_instalacao_est || ''}
          onChange={e => atualizar('dias_instalacao_est', parseInt(e.target.value))}
          placeholder="5, 10, 20…"
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Vistorias inclusas *</span>
        <input
          className="input"
          type="number"
          value={analise.vistorias_inclusas || 3}
          onChange={e => atualizar('vistorias_inclusas', parseInt(e.target.value))}
        />
        <span className="vp-small" style={{ color: '#666' }}>Padrão VerticalParts: 3 vistorias inclusas</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.necessidade_supervisor || false}
          onChange={e => atualizar('necessidade_supervisor', e.target.checked)}
        />
        <span>Supervisor VerticalParts necessário</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Horas de deslocamento até a obra</span>
        <input
          className="input"
          type="number"
          step="0.5"
          value={analise.horas_deslocamento || ''}
          onChange={e => atualizar('horas_deslocamento', parseFloat(e.target.value))}
          placeholder="2, 6, 12…"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.hospedagem_necessaria || false}
          onChange={e => atualizar('hospedagem_necessaria', e.target.checked)}
        />
        <span>Hospedagem necessária</span>
      </label>

      {analise.hospedagem_necessaria && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 24 }}>
          <span className="up-eyebrow muted">Dias estimados de hospedagem</span>
          <input
            className="input"
            type="number"
            value={analise.dias_hospedagem_est || ''}
            onChange={e => atualizar('dias_hospedagem_est', parseInt(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}

function StepDocumentos({ analise, atualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Documentação Necessária</h2>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.projeto_necessario || true}
          onChange={e => atualizar('projeto_necessario', e.target.checked)}
        />
        <span>Projeto necessário</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.art_necessaria || true}
          onChange={e => atualizar('art_necessaria', e.target.checked)}
        />
        <span>ART (Anotação de Responsabilidade Técnica) necessária</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Normas (NRs) aplicáveis</span>
        <input
          className="input"
          type="text"
          value={analise.nrs_aplicaveis || ''}
          onChange={e => atualizar('nrs_aplicaveis', e.target.value)}
          placeholder="NR-10, NR-11, NR-35…"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.aso_necessaria || true}
          onChange={e => atualizar('aso_necessaria', e.target.checked)}
        />
        <span>ASO (Atestado de Saúde Ocupacional) necessário</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={analise.pcmso_pgr_necessaria || true}
          onChange={e => atualizar('pcmso_pgr_necessaria', e.target.checked)}
        />
        <span>PCMSO/PGR necessário</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="up-eyebrow muted">Riscos técnicos e exclusões comerciais</span>
        <textarea
          className="input"
          rows="3"
          value={analise.riscos_tecnicos || ''}
          onChange={e => atualizar('riscos_tecnicos', e.target.value)}
          placeholder="Descreva riscos, limitações, escopo que NÃO está incluído no preço…"
        />
      </label>

      <div style={{
        background: '#e6ffe6',
        border: '1px solid #00aa00',
        borderRadius: 6,
        padding: 12,
        fontSize: 13
      }}>
        ✓ Análise técnica completa e pronta para precificação!
      </div>
    </div>
  );
}
