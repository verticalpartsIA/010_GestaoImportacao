/* ============================================================
   quadro-comando.jsx — Comercial · Formulários · Quadro de Comando
   Coleta de dados pra fabricação/cotação do quadro de comando NICE3000 MRL
   e, quando o ramo é "Fabricar interno", cálculo de BOM + lista de corte +
   checklist digital de separação (caixa / componentes / fiação).
   ============================================================ */

function QcField({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div className="small muted" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function QcInput({ value, onChange, type, placeholder, disabled, required, hasError, name }) {
  return (
    <input className="input" data-field={name} type={type || 'text'} value={value == null ? '' : value} placeholder={placeholder}
      disabled={disabled} required={required}
      style={{borderColor: hasError ? '#d32f2f' : undefined}}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}/>
  );
}

function QcSelect({ value, onChange, options, placeholder, disabled }) {
  return (
    <select className="input" value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder || 'Selecione…'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function QcOrigemBadge({ confianca }) {
  const map = {
    confirmado: { label: 'Confirmado', bg: '#e6f4ea', fg: '#1e7a34' },
    estimado: { label: 'Estimado', bg: '#fff4d6', fg: '#8a6300' },
    pendente_engenharia: { label: 'Pendente de engenharia', bg: '#fde2e1', fg: '#a11d1d' },
  };
  const s = map[confianca] || map.pendente_engenharia;
  return <span className="badge" style={{ background: s.bg, color: s.fg, fontSize: 11 }}>{s.label}</span>;
}

function QcCruzamentoBadge({ status }) {
  const map = {
    cadastrado_e_solicitado: { label: 'Cadastrado no Omie', bg: '#e6f4ea', fg: '#1e7a34' },
    solicitado_sem_cadastro: { label: 'SEM cadastro no Omie', bg: '#fde2e1', fg: '#a11d1d' },
    erro_consulta: { label: 'Erro na consulta', bg: '#fff4d6', fg: '#8a6300' },
  };
  const s = map[status] || map.erro_consulta;
  return <span className="badge" style={{ background: s.bg, color: s.fg, fontSize: 11 }}>{s.label}</span>;
}

/* Suficiência de estoque Omie x Qtd necessária da BOM — pedido do
   usuário (24/09/2026): verde/amarelo/vermelho, sempre só diagnóstico
   (nunca decide nada sozinho). */
function QcEstoqueBadge({ status }) {
  const map = {
    suficiente: { label: 'Suficiente', bg: '#e6f4ea', fg: '#1e7a34' },
    insuficiente: { label: 'Insuficiente', bg: '#fff4d6', fg: '#8a6300' },
    sem_estoque: { label: 'Sem estoque', bg: '#fde2e1', fg: '#a11d1d' },
    erro_consulta: { label: 'Erro ao consultar', bg: '#eee', fg: '#555' },
  };
  const s = map[status] || map.erro_consulta;
  return <span className="badge" style={{ background: s.bg, color: s.fg, fontSize: 11 }}>{s.label}</span>;
}

/* ---------- Escopo de fornecimento (item 1 da instrução) ---------- */
const QC_ESCOPO_ITENS = [
  { key: 'cop', label: 'COP — Botoeira de Cabina' },
  { key: 'lop', label: 'LOP — Botoeira de Pavimento' },
  { key: 'lip', label: 'LIP — Indicador de Posição sobre as Portas' },
  { key: 'operador_porta', label: 'Operador de Portas' },
  { key: 'resgate_automatico', label: 'Resgate Automático (ARD)' },
  { key: 'interfone', label: 'Interfone 5 Canais' },
  { key: 'botoeira_inspecao_cabina', label: 'Botoeira de Inspeção sobre a Cabina' },
  { key: 'botoeira_inspecao_poco', label: 'Botoeira de Inspeção no Fundo do Poço' },
  { key: 'botao_stop_poco', label: 'Botão de Stop para Acesso ao Poço' },
  { key: 'gongo', label: 'Gongo' },
  { key: 'anuncio_voz', label: 'Anúncio de Voz na Cabina' },
  { key: 'suporte_cabo_comando', label: 'Suporte de Fixação para Cabo de Comando' },
  { key: 'sensor_fotoeletrico', label: 'Sensor Fotoelétrico para Informação de Poço' },
  { key: 'pesador_carga', label: 'Pesador de Carga' },
  { key: 'tomada_fundo_poco', label: 'Tomada para Fundo do Poço' },
  { key: 'cabos', label: 'Cabos — Fiação Fixa + Cabo de Manobra' },
];
const QC_ESCOPO_OPCOES = [
  { value: 'fornecer', label: 'Fornecer' },
  { value: 'reutilizar', label: 'Reutilizar existente' },
  { value: 'terceiro', label: 'Fornecido por terceiro' },
  { value: 'nao_aplica', label: 'Não se aplica' },
];

function QcEscopoSecao({ escopo, onChange, disabled }) {
  return (
    <>
      <Card title="Escopo do pedido" sub="Para cada item: fornecer / reutilizar existente / fornecido por terceiro / não se aplica.">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr><th>Item</th><th>Decisão</th><th>Qtd/modelo</th></tr></thead>
            <tbody>
              {QC_ESCOPO_ITENS.map((it) => {
                const v = escopo[it.key] || {};
                return (
                  <tr key={it.key}>
                    <td>{it.label}</td>
                    <td style={{ maxWidth: 220 }}>
                      <QcSelect value={v.decisao} disabled={disabled} options={QC_ESCOPO_OPCOES}
                        onChange={(val) => onChange({ ...escopo, [it.key]: { ...v, decisao: val } })}/>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <QcInput value={v.detalhe} disabled={disabled || v.decisao === 'nao_aplica' || !v.decisao}
                        placeholder="qtd/modelo" onChange={(val) => onChange({ ...escopo, [it.key]: { ...v, detalhe: val } })}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Customizações de botoeiras" sub="Gravação, furação e personalizações do COP/LOP.">
        <div className="grid-2" style={{ gap: 12 }}>
          <QcField label="Logo da empresa nas botoeiras" hint="Gravar/imprimir logo do cliente nas botoeiras fornecidas.">
            <label className="small"><input type="checkbox" checked={!!escopo.botoeiras_logo_cliente} disabled={disabled}
              onChange={(e) => onChange({ ...escopo, botoeiras_logo_cliente: e.target.checked })}/> Sim, gravar logo do cliente</label>
          </QcField>
          <QcField label="Furação do totem (botoeira de cabina)">
            <QcSelect value={escopo.botoeiras_furacoes_totem} disabled={disabled}
              options={[
                { value: 'nenhuma', label: 'Sem furação (padrão)' },
                { value: 't', label: 'Furação em T' },
                { value: 'custom', label: 'Furação customizada (especificar)' }
              ]}
              onChange={(val) => onChange({ ...escopo, botoeiras_furacoes_totem: val })}/>
            {escopo.botoeiras_furacoes_totem === 'custom' && (
              <QcInput value={escopo.botoeiras_furacoes_custom} disabled={disabled} placeholder="Ex: furo M5 central + 4 furos de fixação"
                onChange={(val) => onChange({ ...escopo, botoeiras_furacoes_custom: val })}/>
            )}
          </QcField>
          <QcField label="COP com display visual (modelo)" hint="Indicador de posição ou outras informações visuais.">
            <QcSelect value={escopo.cop_com_display} disabled={disabled}
              options={[
                { value: '', label: 'Sem display' },
                { value: 'vpb333', label: 'VPB-333 (Display TFT 7")' },
                { value: 'vpb036', label: 'VPB-036 (Indicador LED de direção)' },
                { value: 'outro', label: 'Outro modelo (especificar)' }
              ]}
              onChange={(val) => onChange({ ...escopo, cop_com_display: val })}/>
            {escopo.cop_com_display === 'outro' && (
              <QcInput value={escopo.cop_display_modelo} disabled={disabled} placeholder="Modelo/referência do display"
                onChange={(val) => onChange({ ...escopo, cop_display_modelo: val })}/>
            )}
          </QcField>
          <QcField label="Operador de portas — modelo e tensão" hint="Se fornecido, especifique modelo exato e tensão de acionamento.">
            <QcInput value={escopo.operador_porta_modelo} disabled={disabled} placeholder="Ex: Monarch S5000-8000, 24Vcc"
              onChange={(val) => onChange({ ...escopo, operador_porta_modelo: val })}/>
          </QcField>
        </div>
      </Card>
    </>
  );
}

/* ---------- Identificação e Configuração geral (item 2) ---------- */
function QcConfiguracaoSecao({ config, paradas, onChange, disabled }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const numParadas = paradas?.length || 0;
  return (
    <>
      <Card title="Identificação do equipamento e da obra" sub="Rastreabilidade do projeto — local, cliente, responsáveis e data da medição.">
        <div className="grid-2" style={{ gap: 12 }}>
          <QcField label="Local/obra"><QcInput value={config.local_obra} disabled={disabled} placeholder="ex: Prédio Commercial 'X', Av. Paulista" onChange={(v) => set({ local_obra: v })}/></QcField>
          <QcField label="Responsável pela medição"><QcInput value={config.responsavel_medicao} disabled={disabled} placeholder="Nome completo + contato" onChange={(v) => set({ responsavel_medicao: v })}/></QcField>
          <QcField label="Data da medição"><QcInput type="date" value={config.data_medicao} disabled={disabled} onChange={(v) => set({ data_medicao: v })}/></QcField>
          <QcField label="Data revisão/confirmação"><QcInput type="date" value={config.data_revisao} disabled={disabled} onChange={(v) => set({ data_revisao: v })}/></QcField>
        </div>
      </Card>

      <Card title="Configuração do elevador" sub="Estrutura geral — número de paradas, capacidade, tipo de aplicação.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Número de elevadores nesta instalação"><QcInput type="number" value={config.numero_elevadores} disabled={disabled} onChange={(v) => set({ numero_elevadores: v })}/></QcField>
          <QcField label="Capacidade (pessoas)"><QcInput type="number" value={config.capacidade_pessoas} disabled={disabled} onChange={(v) => set({ capacidade_pessoas: v })}/></QcField>
          <QcField label="Velocidade nominal (m/s)"><QcInput type="number" step="0.1" value={config.velocidade_ms} disabled={disabled} onChange={(v) => set({ velocidade_ms: v })}/></QcField>
          <QcField label="Número de paradas"><QcInput type="number" value={paradas?.length || 0} disabled={true} placeholder="Automático"/></QcField>
          <QcField label="Portas opostas na cabina?" hint="Frente E fundo com aberturas simultâneas?">
            <label className="small"><input type="checkbox" checked={!!config.portas_opostas_cabina} disabled={disabled}
              onChange={(e) => set({ portas_opostas_cabina: e.target.checked })}/> Sim, há portas opostas na cabina</label>
          </QcField>
          <QcField label="Parada principal (acesso maior)"><QcInput value={config.parada_principal} disabled={disabled} placeholder="ex: Térreo / Parada 1" onChange={(v) => set({ parada_principal: v })}/></QcField>
        </div>
      </Card>
    </>
  );
}

/* ---------- Paradas (item 2.1) ---------- */
function QcParadasSecao({ paradas, onChange, disabled }) {
  const add = () => onChange([...paradas, { identificacao: `Parada ${paradas.length + 1}`, abertura_frontal: true, abertura_traseira: false, tipo_porta_pavimento: '', tipo_porta_cabina: '', qtd_lop_frontal: 1, qtd_lop_traseira: 0 }]);
  const upd = (i, patch) => onChange(paradas.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const rm = (i) => onChange(paradas.filter((_, idx) => idx !== i));
  return (
    <Card title="Paradas" sub="Frente/fundo por parada — o número de paradas não determina a quantidade de portas/botoeiras quando há frentes opostas."
      action={!disabled && <Button variant="outline" size="sm" icon="plus" onClick={add}>Adicionar parada</Button>}>
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t">
          <thead><tr><th>Identificação</th><th>Frontal</th><th>Traseira</th><th>Porta pavimento</th><th>Porta cabina</th><th>LOP frontal</th><th>LOP traseira</th><th></th></tr></thead>
          <tbody>
            {paradas.length === 0 && <tr><td colSpan={8} className="small muted" style={{ textAlign: 'center', padding: 20 }}>Nenhuma parada cadastrada.</td></tr>}
            {paradas.map((p, i) => (
              <tr key={i}>
                <td style={{ minWidth: 120 }}><QcInput value={p.identificacao} disabled={disabled} onChange={(v) => upd(i, { identificacao: v })}/></td>
                <td><input type="checkbox" checked={!!p.abertura_frontal} disabled={disabled} onChange={(e) => upd(i, { abertura_frontal: e.target.checked })}/></td>
                <td><input type="checkbox" checked={!!p.abertura_traseira} disabled={disabled} onChange={(e) => upd(i, { abertura_traseira: e.target.checked })}/></td>
                <td style={{ minWidth: 120 }}><QcInput value={p.tipo_porta_pavimento} disabled={disabled} onChange={(v) => upd(i, { tipo_porta_pavimento: v })}/></td>
                <td style={{ minWidth: 120 }}><QcInput value={p.tipo_porta_cabina} disabled={disabled} onChange={(v) => upd(i, { tipo_porta_cabina: v })}/></td>
                <td style={{ width: 90 }}><QcInput type="number" value={p.qtd_lop_frontal} disabled={disabled} onChange={(v) => upd(i, { qtd_lop_frontal: v })}/></td>
                <td style={{ width: 90 }}><QcInput type="number" value={p.qtd_lop_traseira} disabled={disabled || !p.abertura_traseira} onChange={(v) => upd(i, { qtd_lop_traseira: v })}/></td>
                <td>{!disabled && <Button variant="ghost" size="sm" icon="trash" onClick={() => rm(i)}/>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Máquina/Freio/Encoder (item 3) ---------- */
function QcMaquinaSecao({ maquina, onChange, disabled, varianteLabel, errosVisiveis }) {
  const set = (patch) => onChange({ ...maquina, ...patch });
  return (
    <>
      <Card title="Alimentação da rede" sub="Características técnicas do local da instalação.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Tensão da rede (V)"><QcSelect value={maquina.tensao_v} disabled={disabled} data-field="tensao_v"
            options={[{ value: '220', label: '220V' }, { value: '380', label: '380V' }]}
            style={{borderColor: errosVisiveis?.tensao_v ? '#d32f2f' : undefined}}
            onChange={(v) => set({ tensao_v: v ? Number(v) : null })}/></QcField>
          <QcField label="Número de fases"><QcSelect value={maquina.fases} disabled={disabled} data-field="fases"
            options={[{ value: '1', label: 'Monofásico (1Ø)' }, { value: '3', label: 'Trifásico (3Ø)' }]}
            style={{borderColor: errosVisiveis?.fases ? '#d32f2f' : undefined}}
            onChange={(v) => set({ fases: v })}/></QcField>
          <QcField label="Frequência (Hz)"><QcSelect value={maquina.frequencia_hz} disabled={disabled} data-field="frequencia_hz"
            options={[{ value: '50', label: '50 Hz' }, { value: '60', label: '60 Hz' }]}
            style={{borderColor: errosVisiveis?.frequencia_hz ? '#d32f2f' : undefined}}
            onChange={(v) => set({ frequencia_hz: v ? Number(v) : null })}/></QcField>
        </div>
      </Card>

      <Card title="Quadro, máquina e acionamentos" sub={varianteLabel ? `Variante reconhecida: ${varianteLabel}` : 'Preencha potência e tensão pra reconhecer a variante do quadro (7,5/15 kW × 220/380 V).'}>
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Tipo de máquina"><QcSelect value={maquina.tipo_maquina} disabled={disabled}
            options={[{ value: 'sincrona', label: 'Síncrona (ímãs permanentes)' }, { value: 'assincrona', label: 'Assíncrona (indução)' }]}
            onChange={(v) => set({ tipo_maquina: v })}/></QcField>
          <QcField label="Fabricante/modelo da máquina"><QcInput value={maquina.fabricante_maquina} disabled={disabled} onChange={(v) => set({ fabricante_maquina: v })}/></QcField>
          <QcField label="Potência (kW)"><QcInput type="number" value={maquina.potencia_kw} disabled={disabled} hasError={!!errosVisiveis?.potencia_kw} name="potencia_kw" onChange={(v) => set({ potencia_kw: v ? Number(v) : null })}/></QcField>
          <QcField label="Corrente (A)"><QcInput type="number" value={maquina.corrente_a} disabled={disabled} onChange={(v) => set({ corrente_a: v ? Number(v) : null })}/></QcField>
          <QcField label="Velocidade (rpm)"><QcInput type="number" value={maquina.velocidade_rpm} disabled={disabled} onChange={(v) => set({ velocidade_rpm: v ? Number(v) : null })}/></QcField>
          <QcField label="Freio — tipo"><QcInput value={maquina.freio_tipo} disabled={disabled} hasError={!!errosVisiveis?.freio_tipo} name="freio_tipo" onChange={(v) => set({ freio_tipo: v })}/></QcField>
          <QcField label="Freio — tensão de acionamento"><QcInput type="number" value={maquina.freio_tensao_acionamento} disabled={disabled} onChange={(v) => set({ freio_tensao_acionamento: v ? Number(v) : null })}/></QcField>
          <QcField label="Freio — tensão de manutenção"><QcInput type="number" value={maquina.freio_tensao_manutencao} disabled={disabled} onChange={(v) => set({ freio_tensao_manutencao: v ? Number(v) : null })}/></QcField>
          <QcField label="Freio — quantidade de bobinas"><QcInput type="number" value={maquina.freio_qtd_bobinas} disabled={disabled} placeholder="1, 2, 3..." onChange={(v) => set({ freio_qtd_bobinas: v ? Number(v) : null })}/></QcField>
          <QcField label="Encoder — fabricante"><QcInput value={maquina.encoder_fabricante} disabled={disabled} onChange={(v) => set({ encoder_fabricante: v })}/></QcField>
          <QcField label="Encoder — modelo/referência exata"><QcInput value={maquina.encoder_modelo} disabled={disabled} onChange={(v) => set({ encoder_modelo: v })}/></QcField>
          <QcField label="Encoder — tecnologia/protocolo" hint="Ex.: incremental, EnDat, Hiperface. Combinações incomuns vão pra validação técnica.">
            <QcInput value={maquina.encoder_tecnologia} disabled={disabled} onChange={(v) => set({ encoder_tecnologia: v })}/></QcField>
          <QcField label="Encoder — resolução (PPR)"><QcInput type="number" value={maquina.encoder_resolucao} disabled={disabled} placeholder="Pulsos por rotação" onChange={(v) => set({ encoder_resolucao: v ? String(v) : null })}/></QcField>
          <QcField label="Encoder — alimentação (V)"><QcInput type="number" value={maquina.encoder_alimentacao} disabled={disabled} onChange={(v) => set({ encoder_alimentacao: v ? String(v) : null })}/></QcField>
        </div>
      </Card>
    </>
  );
}

/* ---------- Componentes internos do quadro (item 3.5) ---------- */
function QcComponentesSecao({ componentes, onChange, disabled }) {
  const set = (patch) => onChange({ ...componentes, ...patch });
  return (
    <>
      <Card title="Componentes internos do quadro" sub="Especificação dos elementos que compõem o gabinete do quadro de comando.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Inversor — marca/modelo"><QcInput value={componentes.inversor_modelo} disabled={disabled} onChange={(v) => set({ inversor_modelo: v })}/></QcField>
          <QcField label="Inversor — potência (kW)"><QcInput type="number" value={componentes.inversor_potencia_kw} disabled={disabled} onChange={(v) => set({ inversor_potencia_kw: v ? Number(v) : null })}/></QcField>
          <QcField label="Placa PCB principal — código SKU"><QcInput value={componentes.pcb_principal_sku} disabled={disabled} onChange={(v) => set({ pcb_principal_sku: v })}/></QcField>
          <QcField label="Disjuntor — tipo/corrente (A)"><QcInput value={componentes.disjuntor_tipo_a} disabled={disabled} placeholder="ex: C16" onChange={(v) => set({ disjuntor_tipo_a: v })}/></QcField>
          <QcField label="Disjuntor — quantidade"><QcInput type="number" value={componentes.disjuntor_qtd} disabled={disabled} onChange={(v) => set({ disjuntor_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Contator — modelo"><QcInput value={componentes.contator_modelo} disabled={disabled} placeholder="ex: CJX2-1210" onChange={(v) => set({ contator_modelo: v })}/></QcField>
          <QcField label="Contator — quantidade"><QcInput type="number" value={componentes.contator_qtd} disabled={disabled} onChange={(v) => set({ contator_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Relé térmico — corrente (A)"><QcInput type="number" value={componentes.rele_termico_a} disabled={disabled} onChange={(v) => set({ rele_termico_a: v ? Number(v) : null })}/></QcField>
          <QcField label="Relé térmico — quantidade"><QcInput type="number" value={componentes.rele_termico_qtd} disabled={disabled} onChange={(v) => set({ rele_termico_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Terminais M5 — quantidade"><QcInput type="number" value={componentes.terminais_m5_qtd} disabled={disabled} onChange={(v) => set({ terminais_m5_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Parafusos — tamanho/tipo"><QcInput value={componentes.parafusos_tamanho} disabled={disabled} placeholder="ex: M6×10" onChange={(v) => set({ parafusos_tamanho: v })}/></QcField>
          <QcField label="Parafusos — quantidade"><QcInput type="number" value={componentes.parafusos_qtd} disabled={disabled} onChange={(v) => set({ parafusos_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Fusíveis — tipo/corrente (A)"><QcInput value={componentes.fusivel_tipo_a} disabled={disabled} placeholder="ex: gL 10" onChange={(v) => set({ fusivel_tipo_a: v })}/></QcField>
          <QcField label="Fusíveis — quantidade"><QcInput type="number" value={componentes.fusivel_qtd} disabled={disabled} onChange={(v) => set({ fusivel_qtd: v ? Number(v) : null })}/></QcField>
          <QcField label="Cabos internos — bitola/tipo"><QcInput value={componentes.cabos_internos_bitola} disabled={disabled} placeholder="ex: 4mm² VVF" onChange={(v) => set({ cabos_internos_bitola: v })}/></QcField>
          <QcField label="Cabos internos — metros"><QcInput type="number" value={componentes.cabos_internos_metros} disabled={disabled} onChange={(v) => set({ cabos_internos_metros: v ? Number(v) : null })}/></QcField>
          <QcField label="Conectores/plugs — tipo"><QcInput value={componentes.conectores_tipo} disabled={disabled} placeholder="ex: 2.8mm, 6.3mm" onChange={(v) => set({ conectores_tipo: v })}/></QcField>
          <QcField label="Conectores/plugs — quantidade"><QcInput type="number" value={componentes.conectores_qtd} disabled={disabled} onChange={(v) => set({ conectores_qtd: v ? Number(v) : null })}/></QcField>
        </div>
      </Card>

      <Card title="Placas adicionais do comando" sub="Componentes de leitura, proteção e interface — especifique modelo/SKU quando fornecido.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Placa leitora Encoder (Sin/Cos) — SKU"><QcInput value={componentes.placa_encoder_sku} disabled={disabled} placeholder="ex: MC02-1" onChange={(v) => set({ placa_encoder_sku: v })}/></QcField>
          <QcField label="Placa de proteção do freio — SKU"><QcInput value={componentes.placa_freio_sku} disabled={disabled} placeholder="ex: NC30-1" onChange={(v) => set({ placa_freio_sku: v })}/></QcField>
          <QcField label="Placa de interface de ligações — SKU"><QcInput value={componentes.placa_interface_sku} disabled={disabled} placeholder="ex: MC04-1" onChange={(v) => set({ placa_interface_sku: v })}/></QcField>
          <QcField label="Capacitores — tipo/µF"><QcInput value={componentes.capacitor_tipo_uf} disabled={disabled} placeholder="ex: 100µF 400V" onChange={(v) => set({ capacitor_tipo_uf: v })}/></QcField>
          <QcField label="Capacitores — quantidade"><QcInput type="number" value={componentes.capacitor_qtd} disabled={disabled} onChange={(v) => set({ capacitor_qtd: v ? Number(v) : null })}/></QcField>
        </div>
      </Card>
    </>
  );
}

/* ---------- Geometria para fiação (item 4/5) ---------- */
function QcGeometriaSecao({ geometria, intervalos, onGeom, onIntervalos, disabled }) {
  const set = (patch) => onGeom({ ...geometria, ...patch });
  const addIntervalo = () => onIntervalos([...intervalos, { de_parada: '', para_parada: '', distancia_mm: null, origem: 'medido' }]);
  const updIntervalo = (i, patch) => onIntervalos(intervalos.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const rmIntervalo = (i) => onIntervalos(intervalos.filter((_, idx) => idx !== i));

  const engine = window.QuadroComandoBomEngine;
  const calc = engine ? engine.alturaTotalMm(geometria, intervalos) : { percurso_mm: 0, altura_total_mm: 0, ultima_altura_fora_do_padrao: false };
  const perimetro = engine ? engine.perimetroCaixaMm(geometria) : null;

  return (
    <>
      <Card title="Geometria da caixa (medida em mm)" sub="Sempre a medida real da obra — os padrões comerciais de estimativa (poço 1500mm, intervalo 3000mm, K 4400mm) só entram se você marcar explicitamente 'estimado'.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Profundidade do poço (S)">
            <QcInput type="number" value={geometria.poco_mm} disabled={disabled} onChange={(v) => set({ poco_mm: v })}/>
            <label className="small muted"><input type="checkbox" checked={geometria.poco_origem === 'estimado'} disabled={disabled}
              onChange={(e) => set({ poco_origem: e.target.checked ? 'estimado' : 'medido' })}/> usar padrão comercial (1500mm)</label>
          </QcField>
          <QcField label="Última altura (K)">
            <QcInput type="number" value={geometria.ultima_altura_mm} disabled={disabled} onChange={(v) => set({ ultima_altura_mm: v })}/>
            <label className="small muted"><input type="checkbox" checked={geometria.ultima_altura_origem === 'estimado'} disabled={disabled}
              onChange={(e) => set({ ultima_altura_origem: e.target.checked ? 'estimado' : 'medido' })}/> usar padrão comercial (4400mm)</label>
          </QcField>
          <QcField label="Largura da caixa de corrida"><QcInput type="number" value={geometria.caixa_largura_mm} disabled={disabled} onChange={(v) => set({ caixa_largura_mm: v })}/></QcField>
          <QcField label="Profundidade da caixa de corrida"><QcInput type="number" value={geometria.caixa_profundidade_mm} disabled={disabled} onChange={(v) => set({ caixa_profundidade_mm: v })}/></QcField>
          <QcField label="Largura da cabina"><QcInput type="number" value={geometria.cabina_largura_mm} disabled={disabled} onChange={(v) => set({ cabina_largura_mm: v })}/></QcField>
          <QcField label="Profundidade da cabina"><QcInput type="number" value={geometria.cabina_profundidade_mm} disabled={disabled} onChange={(v) => set({ cabina_profundidade_mm: v })}/></QcField>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Percurso (soma dos intervalos): <b>{calc.percurso_mm} mm</b> · Altura total: <b>{calc.altura_total_mm} mm</b>
          {calc.ultima_altura_fora_do_padrao && <span style={{ color: '#a11d1d', fontWeight: 600 }}> · fora do padrão (K &gt; 4400mm) — encaminhar pra análise da engenharia.</span>}
          {perimetro != null && <> · Perímetro da caixa: <b>{perimetro} mm</b> (referência de contorno, não lançar automaticamente num ramal específico)</>}
        </div>
      </Card>

      <Card title="Distância entre pisos por intervalo" sub="Um valor por intervalo — não multiplicar um mínimo presumido se os intervalos forem diferentes entre si."
        action={!disabled && <Button variant="outline" size="sm" icon="plus" onClick={addIntervalo}>Adicionar intervalo</Button>}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr><th>De</th><th>Para</th><th>Distância (mm)</th><th>Origem</th><th></th></tr></thead>
            <tbody>
              {intervalos.length === 0 && <tr><td colSpan={5} className="small muted" style={{ textAlign: 'center', padding: 20 }}>Nenhum intervalo cadastrado.</td></tr>}
              {intervalos.map((it, i) => (
                <tr key={i}>
                  <td style={{ width: 100 }}><QcInput value={it.de_parada} disabled={disabled} onChange={(v) => updIntervalo(i, { de_parada: v })}/></td>
                  <td style={{ width: 100 }}><QcInput value={it.para_parada} disabled={disabled} onChange={(v) => updIntervalo(i, { para_parada: v })}/></td>
                  <td style={{ width: 120 }}><QcInput type="number" value={it.distancia_mm} disabled={disabled} onChange={(v) => updIntervalo(i, { distancia_mm: v })}/></td>
                  <td style={{ width: 120 }}>
                    <QcSelect value={it.origem} disabled={disabled} options={[{ value: 'medido', label: 'Medido' }, { value: 'estimado', label: 'Estimado (3000mm)' }]}
                      onChange={(v) => updIntervalo(i, { origem: v })}/>
                  </td>
                  <td>{!disabled && <Button variant="ghost" size="sm" icon="trash" onClick={() => rmIntervalo(i)}/>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Posição do quadro e rotas de fiação" sub="Lados são relativos — o espelhamento deve preservar as relações, não os rótulos esquerda/direita.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Lado do quadro"><QcSelect value={geometria.lado_quadro} disabled={disabled}
            options={[{ value: 'esquerda', label: 'Esquerda' }, { value: 'direita', label: 'Direita' }]} onChange={(v) => set({ lado_quadro: v })}/></QcField>
          <QcField label="Lado tripé/máquina"><QcSelect value={geometria.lado_tripe_maquina} disabled={disabled}
            options={[{ value: 'esquerda', label: 'Esquerda' }, { value: 'direita', label: 'Direita' }]} onChange={(v) => set({ lado_tripe_maquina: v })}/></QcField>
          <QcField label="Lado da guia solitária"><QcSelect value={geometria.lado_guia_solitaria} disabled={disabled}
            options={[{ value: 'esquerda', label: 'Esquerda' }, { value: 'direita', label: 'Direita' }]} onChange={(v) => set({ lado_guia_solitaria: v })}/></QcField>
          <QcField label="Distância quadro → máquina (mm)"><QcInput type="number" value={geometria.distancia_quadro_maquina_mm} disabled={disabled} onChange={(v) => set({ distancia_quadro_maquina_mm: v })}/></QcField>
          <QcField label="Distância quadro → limitador (mm)"><QcInput type="number" value={geometria.distancia_quadro_limitador_mm} disabled={disabled} onChange={(v) => set({ distancia_quadro_limitador_mm: v })}/></QcField>
          <QcField label="Distância quadro → entrada da caixa (mm)"><QcInput type="number" value={geometria.distancia_quadro_entrada_caixa_mm} disabled={disabled} onChange={(v) => set({ distancia_quadro_entrada_caixa_mm: v })}/></QcField>
        </div>
      </Card>

      <Card title="Cabo de manobra — seio e folga" sub="Definições ainda pendentes de confirmação da engenharia (ver instrução original) — sem confirmar, o corte fica travado como pendente.">
        <div className="grid-3" style={{ gap: 12 }}>
          <QcField label="Seio do cabo (mm)"><QcInput type="number" value={geometria.seio_cabo_mm} disabled={disabled} onChange={(v) => set({ seio_cabo_mm: v })}/></QcField>
          <QcField label="Definição do seio confirmada pela engenharia?">
            <label className="small"><input type="checkbox" checked={!!geometria.seio_definicao_confirmada} disabled={disabled}
              onChange={(e) => set({ seio_definicao_confirmada: e.target.checked })}/> Confirmado</label>
          </QcField>
          <QcField label="Folga (mm)"><QcInput type="number" value={geometria.folga_mm} disabled={disabled} onChange={(v) => set({ folga_mm: v })}/></QcField>
          <QcField label="Regra de folga confirmada pela engenharia?">
            <label className="small"><input type="checkbox" checked={!!geometria.folga_regra_confirmada} disabled={disabled}
              onChange={(e) => set({ folga_regra_confirmada: e.target.checked })}/> Confirmado</label>
          </QcField>
        </div>
      </Card>
    </>
  );
}

/* ---------- Resultado: BOM + lista de corte + checklist ---------- */
function QcResultadoSecao({ quadroId, podeGerar }) {
  const [bom, setBom] = React.useState([]);
  const [cortes, setCortes] = React.useState([]);
  const [checklist, setChecklist] = React.useState([]);
  const [cruzamento, setCruzamento] = React.useState([]);
  const [gerando, setGerando] = React.useState(false);
  const [gerandoChecklist, setGerandoChecklist] = React.useState(false);
  const [cruzando, setCruzando] = React.useState(false);
  const [catalogoNaoUsado, setCatalogoNaoUsado] = React.useState(null); // null = nunca rodou nesta sessão

  const reload = React.useCallback(() => {
    window.QuadroComandoStore.obterBomECortes(quadroId).then(({ bomItens, trechos }) => { setBom(bomItens); setCortes(trechos); });
    window.QuadroComandoStore.obterChecklist(quadroId).then(setChecklist);
    window.QuadroComandoStore.obterCruzamentoErp(quadroId).then(setCruzamento);
  }, [quadroId]);
  React.useEffect(() => { reload(); }, [reload]);

  const gerarBom = async () => {
    setGerando(true);
    try {
      const r = await window.QuadroComandoStore.gerarBomECortes(quadroId);
      if (r.erroVariante) window.toast?.(r.erroVariante, 'warning');
      else window.toast?.('BOM e lista de corte gerados.', 'success');
      reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setGerando(false); }
  };

  const cruzarErp = async () => {
    setCruzando(true);
    try {
      const r = await window.QuadroComandoStore.cruzarComErp(quadroId);
      setCruzamento(r.linhas);
      setCatalogoNaoUsado(r.catalogoNaoUsado);
      const semCadastro = r.linhas.filter((l) => l.status === 'solicitado_sem_cadastro').length;
      window.toast?.(
        semCadastro ? `Cruzamento feito — ${semCadastro} SKU(s) sem cadastro no Omie.` : 'Cruzamento feito — todos os SKUs cadastrados no Omie.',
        semCadastro ? 'warning' : 'success',
      );
    } catch (e) { window.toast?.('Erro ao cruzar com o Omie: ' + e.message, 'error'); }
    finally { setCruzando(false); }
  };

  const gerarChecklist = async () => {
    setGerandoChecklist(true);
    try {
      const r = await window.QuadroComandoStore.gerarChecklistSeparacao(quadroId);
      window.toast?.(`Checklist de separação gerado (versão ${r.versao}, ${r.total} itens).`, 'success');
      reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setGerandoChecklist(false); }
  };

  const marcar = async (item) => {
    await window.QuadroComandoStore.marcarChecklistItem(item.id, !item.feito);
    reload();
  };

  const grupos = { caixa: 'Caixa metálica', componentes: 'Componentes internos', fiacao: 'Fiação de poço e cabo de manobra' };

  return (
    <>
      <Card title="Especificação de fabricação / compra"
        action={<Button variant="primary" size="sm" disabled={gerando || !podeGerar} onClick={gerarBom}>{gerando ? 'Gerando…' : 'Gerar BOM + lista de corte'}</Button>}>
        <div className="small muted" style={{ marginBottom: 10 }}>Recalcula do zero a partir do que está preenchido acima — não altera o que já foi digitado no formulário.</div>
        {!bom.length && !cortes.length && <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>Nada gerado ainda.</div>}
        {!!bom.length && (
          <>
            <h4 className="small" style={{ marginTop: 8 }}>Lista de compra (BOM)</h4>
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="t">
                <thead><tr><th>SKU</th><th>Descrição</th><th>Grupo</th><th>Qtd</th><th>Un.</th><th>Confiança</th></tr></thead>
                <tbody>
                  {bom.map((i) => (
                    <tr key={i.id}>
                      <td>{i.sku}</td><td>{i.descricao}</td><td>{i.grupo_separacao}</td>
                      <td>{i.quantidade}</td><td>{i.unidade}</td>
                      <td><QcOrigemBadge confianca={i.confianca}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!!cortes.length && (
          <>
            <h4 className="small" style={{ marginTop: 16 }}>Lista de corte (fiação fixa + cabo de manobra)</h4>
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="t">
                <thead><tr><th>Tipo</th><th>Origem</th><th>Destino</th><th>Comprimento final</th><th>Confiança</th><th>Fórmula</th></tr></thead>
                <tbody>
                  {cortes.map((t) => (
                    <tr key={t.id}>
                      <td>{t.tipo_cabo}</td><td>{t.origem_fisica}</td><td>{t.destino_fisico}</td>
                      <td>{t.comprimento_final_mm != null ? `${t.comprimento_final_mm} mm` : '—'}</td>
                      <td><QcOrigemBadge confianca={t.confianca}/></td>
                      <td className="small muted" style={{ maxWidth: 320 }}>{t.formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="Cruzamento com o ERP (Omie)" sub="Consulta ao vivo se cada SKU da BOM está realmente cadastrado no Omie, e se descrição/unidade batem — nunca cadastra nem altera nada, só diagnóstico."
        action={<Button variant="outline" size="sm" disabled={cruzando || !bom.length} onClick={cruzarErp}>{cruzando ? 'Consultando Omie…' : 'Cruzar com o ERP'}</Button>}>
        {!cruzamento.length && <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>{bom.length ? 'Ainda não cruzado com o Omie nesta sessão.' : 'Gere o BOM primeiro.'}</div>}
        {!!cruzamento.length && (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="t">
              <thead><tr><th>SKU</th><th>Descrição (local)</th><th>Descrição (Omie)</th><th>Unidade</th><th>Status</th><th>Qtd. necessária</th><th>Qtd. em estoque (Omie)</th></tr></thead>
              <tbody>
                {cruzamento.map((l) => (
                  <tr key={l.id || l.sku}>
                    <td>{l.sku}</td>
                    <td>{l.descricao_local}</td>
                    <td className={l.divergencia_descricao ? 'small' : 'small muted'} style={l.divergencia_descricao ? { color: '#a11d1d', fontWeight: 600 } : undefined}>
                      {l.descricao_omie || '—'}{l.divergencia_descricao && ' (diverge do local)'}
                    </td>
                    <td className={l.divergencia_unidade ? 'small' : 'small muted'} style={l.divergencia_unidade ? { color: '#a11d1d', fontWeight: 600 } : undefined}>
                      {l.unidade_local}{l.unidade_omie && l.unidade_omie !== l.unidade_local ? ` (Omie: ${l.unidade_omie})` : ''}
                    </td>
                    <td><QcCruzamentoBadge status={l.status}/>{l.erro && <div className="small muted" style={{ marginTop: 2 }}>{l.erro}</div>}</td>
                    <td>{l.quantidade_necessaria != null ? l.quantidade_necessaria : '—'}</td>
                    <td>
                      {l.estoque_status !== 'erro_consulta' && <span style={{ marginRight: 6 }}>{l.quantidade_estoque_omie != null ? l.quantidade_estoque_omie : 0}</span>}
                      <QcEstoqueBadge status={l.estoque_status}/>
                      {l.estoque_erro && <div className="small muted" style={{ marginTop: 2 }}>{l.estoque_erro}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!(catalogoNaoUsado && catalogoNaoUsado.length) && (
          <div className="small muted" style={{ marginTop: 12 }}>
            <b>{catalogoNaoUsado.length}</b> SKU(s) do catálogo de materiais não entraram nesta BOM (podem ser de outra variante de potência/tensão — não é necessariamente um erro): {catalogoNaoUsado.map((c) => c.sku).join(', ')}.
          </div>
        )}
      </Card>

      <Card title="Checklist digital de separação" sub="Chão de fábrica — só gere quando quiser começar a separar de fato (não é automático na aprovação)."
        action={<Button variant="outline" size="sm" disabled={gerandoChecklist || !bom.length} onClick={gerarChecklist}>{gerandoChecklist ? 'Gerando…' : 'Gerar checklist de separação'}</Button>}>
        {!checklist.length && <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>Nenhum checklist gerado ainda.</div>}
        {['caixa', 'componentes', 'fiacao'].map((g) => {
          const itens = checklist.filter((i) => i.grupo === g);
          if (!itens.length) return null;
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <h4 className="small">{grupos[g]}</h4>
              {itens.map((i) => (
                <label key={i.id} className="small" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', textDecoration: i.feito ? 'line-through' : 'none', opacity: i.feito ? .6 : 1 }}>
                  <input type="checkbox" checked={!!i.feito} onChange={() => marcar(i)}/>
                  {i.sku ? `${i.sku} — ` : ''}{i.descricao} {i.quantidade ? `(${i.quantidade}${i.unidade ? ' ' + i.unidade : ''})` : ''}{i.medida_mm ? ` — ${i.medida_mm}mm` : ''}
                </label>
              ))}
            </div>
          );
        })}
      </Card>
    </>
  );
}

/* ---------- Ramo B — comprar pronto de fornecedor ----------
   Reusa CotacaoElevadorFornecedorStore (token, envio WhatsApp/E-mail/Link,
   portal público, Inbox) com categoria 'quadro_comando'. Único requisito
   real: o quadro precisa estar vinculado a uma Unidade de um Formulário de
   Elevador já existente (FK NOT NULL de cotacoes_elevador_fornecedor). */
function QcRamoBComprado({ quadro, setQuadro, quadroId }) {
  const [buscaCotacao, setBuscaCotacao] = React.useState('');
  const [unidadesEncontradas, setUnidadesEncontradas] = React.useState(null);
  const [buscando, setBuscando] = React.useState(false);
  const [vinculando, setVinculando] = React.useState(false);
  const [fornecedor, setFornecedor] = React.useState('');
  const [fornecedoresCadastro, setFornecedoresCadastro] = React.useState([]);
  const [contato, setContato] = React.useState({ telefone: '', email: '' });
  const [cot, setCot] = React.useState(null);
  const [enviando, setEnviando] = React.useState(null);

  React.useEffect(() => {
    if (window.FormularioElevadorStore) window.FormularioElevadorStore.listarFornecedores().then(setFornecedoresCadastro).catch(() => {});
  }, []);

  const carregarCot = React.useCallback(() => {
    if (quadro.cotacao_fornecedor_id && window.CotacaoElevadorFornecedorStore) {
      window.CotacaoElevadorFornecedorStore.getById(quadro.cotacao_fornecedor_id).then(setCot);
    } else setCot(null);
  }, [quadro.cotacao_fornecedor_id]);
  React.useEffect(() => { carregarCot(); }, [carregarCot]);

  const buscar = async () => {
    const n = Number(buscaCotacao);
    if (!n) { window.toast?.('Informe um Nº da Cotação válido.', 'warning'); return; }
    setBuscando(true);
    try {
      const unidades = await window.QuadroComandoStore.buscarUnidadesElevadorPorCotacao(n);
      setUnidadesEncontradas(unidades);
      if (!unidades.length) window.toast?.('Nenhuma Unidade encontrada para essa Cotação.', 'warning');
    } catch (e) { window.toast?.('Erro na busca: ' + e.message, 'error'); }
    finally { setBuscando(false); }
  };

  const vincular = async (unidadeId) => {
    setVinculando(true);
    try {
      await window.QuadroComandoStore.vincularFormularioElevador(quadroId, unidadeId);
      setQuadro({ ...quadro, formulario_elevador_unidade_id: unidadeId });
      window.toast?.('Quadro vinculado à Unidade do Formulário de Elevador.', 'success');
    } catch (e) { window.toast?.('Erro ao vincular: ' + e.message, 'error'); }
    finally { setVinculando(false); }
  };

  const enviar = async (canal) => {
    if (!fornecedor) { window.toast?.('Escolha o fornecedor.', 'warning'); return; }
    setEnviando(canal);
    try {
      const cotAtual = await window.QuadroComandoStore.obterOuCriarCotacaoFornecedor(quadroId, fornecedor);
      const url = window.CotacaoElevadorFornecedorStore.cotacaoUrl(cotAtual.token);
      const msg = `Solicitação de cotação técnica ${cotAtual.numero_documento} — VerticalParts\n` +
        `Segue o link com as especificações do Quadro de Comando para cotação:\n${url}`;
      if (canal === 'whatsapp') window.open(window.PFStore.whatsAppHref(contato.telefone, msg), '_blank');
      if (canal === 'email') window.open(window.PFStore.mailtoHref(contato.email, `Cotação técnica ${cotAtual.numero_documento} — VerticalParts`, msg), '_blank');
      if (canal === 'link') { try { await navigator.clipboard.writeText(url); } catch (e) {} window.toast?.('Link copiado.', 'success'); }
      await window.CotacaoElevadorFornecedorStore.marcarEnviado(cotAtual.id, canal, contato);
      setQuadro({ ...quadro, cotacao_fornecedor_id: cotAtual.id });
      window.toast?.('Cotação marcada como enviada.', 'success');
      carregarCot();
    } catch (e) { window.toast?.('Erro ao enviar: ' + e.message, 'error'); }
    finally { setEnviando(null); }
  };

  return (
    <>
      <Card title="Vínculo com Formulário de Elevador" sub="Obrigatório pra enviar cotação a fornecedor — é o projeto/cotação que o fornecedor vai referenciar.">
        {quadro.formulario_elevador_unidade_id ? (
          <p className="small">Vinculado à Unidade <code>{quadro.formulario_elevador_unidade_id}</code>. <Button variant="ghost" size="sm" onClick={() => setQuadro({ ...quadro, formulario_elevador_unidade_id: null })}>Trocar vínculo</Button></p>
        ) : (
          <>
            <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
              <QcField label="Nº da Cotação (Formulário de Elevador)">
                <QcInput type="number" value={buscaCotacao} onChange={setBuscaCotacao}/>
              </QcField>
              <Button variant="outline" disabled={buscando} onClick={buscar}>{buscando ? 'Buscando…' : 'Buscar unidades'}</Button>
            </div>
            {unidadesEncontradas && !!unidadesEncontradas.length && (
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="t">
                  <thead><tr><th>Identificação</th><th>Tipo</th><th>Capacidade</th><th>Velocidade</th><th></th></tr></thead>
                  <tbody>
                    {unidadesEncontradas.map((u) => (
                      <tr key={u.id}>
                        <td>{u.identificador}</td><td>{u.tipo}</td><td>{u.capacidade_kg ? `${u.capacidade_kg}kg` : '—'}</td><td>{u.velocidade_ms ? `${u.velocidade_ms}m/s` : '—'}</td>
                        <td><Button variant="primary" size="sm" disabled={vinculando} onClick={() => vincular(u.id)}>Vincular</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Enviar cotação técnica ao fornecedor" sub="Mesmo mecanismo do RFQ de elevadores — token público, portal de resposta, Inbox.">
        {!quadro.formulario_elevador_unidade_id && <p className="small muted">Vincule uma Unidade de Formulário de Elevador acima antes de enviar.</p>}
        {cot ? (
          <p className="small">Cotação <b>{cot.numero_documento}</b> — status: <b>{cot.status}</b>. {cot.envios?.length ? `Enviada ${cot.envios.length}x.` : 'Ainda não enviada.'}</p>
        ) : (
          <div className="grid-3" style={{ gap: 12 }}>
            <QcField label="Fornecedor">
              <QcSelect value={fornecedor} options={fornecedoresCadastro.map((f) => ({ value: f, label: f }))} onChange={setFornecedor}/>
            </QcField>
            <QcField label="Telefone (WhatsApp)"><QcInput value={contato.telefone} onChange={(v) => setContato({ ...contato, telefone: v })}/></QcField>
            <QcField label="E-mail"><QcInput value={contato.email} onChange={(v) => setContato({ ...contato, email: v })}/></QcField>
          </div>
        )}
        <div className="row gap-2" style={{ marginTop: 8 }}>
          <Button variant="outline" disabled={!quadro.formulario_elevador_unidade_id || enviando} onClick={() => enviar('whatsapp')}>{enviando === 'whatsapp' ? 'Enviando…' : 'WhatsApp'}</Button>
          <Button variant="outline" disabled={!quadro.formulario_elevador_unidade_id || enviando} onClick={() => enviar('email')}>{enviando === 'email' ? 'Enviando…' : 'E-mail'}</Button>
          <Button variant="outline" disabled={!quadro.formulario_elevador_unidade_id || enviando} onClick={() => enviar('link')}>{enviando === 'link' ? 'Copiando…' : 'Copiar link'}</Button>
        </div>
      </Card>
    </>
  );
}

/* ---------- Página principal ---------- */
function QuadroComandoDetail({ quadroId, onClose }) {
  const [quadro, setQuadro] = React.useState(null);
  const [podeDecidir, setPodeDecidir] = React.useState(false);
  const [tab, setTab] = React.useState('escopo');
  const [saving, setSaving] = React.useState(false);
  const [errosVisiveis, setErrosVisiveis] = React.useState({});

  const reload = React.useCallback(() => {
    window.QuadroComandoStore.obter(quadroId).then(setQuadro);
  }, [quadroId]);
  React.useEffect(() => { reload(); }, [reload]);
  React.useEffect(() => { window.QuadroComandoStore.podeDecidirOrigemFabricacao().then(setPodeDecidir); }, []);

  if (!quadro) return <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Carregando…</div>;

  const engine = window.QuadroComandoBomEngine;
  const varianteKey = engine ? engine.chaveVariante(quadro.maquina.potencia_kw, quadro.maquina.tensao_v) : null;
  const varianteLabel = varianteKey && engine.listarVariantes().find((v) => v.key === varianteKey)?.label;

  const validarFormulario = () => {
    const errosMap = {};
    if (!quadro.maquina?.potencia_kw) errosMap.potencia_kw = 'Obrigatório';
    if (!quadro.maquina?.tensao_v) errosMap.tensao_v = 'Obrigatório';
    if (!quadro.maquina?.fases) errosMap.fases = 'Obrigatório';
    if (!quadro.maquina?.frequencia_hz) errosMap.frequencia_hz = 'Obrigatório';
    if (!quadro.maquina?.freio_tipo) errosMap.freio_tipo = 'Obrigatório';
    return errosMap;
  };

  const scrollParaCampoComErro = (nomeDoErro) => {
    const campo = document.querySelector(`input[data-field="${nomeDoErro}"]`) || document.querySelector(`select[data-field="${nomeDoErro}"]`);
    if (campo) {
      campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campo.focus();
    }
  };

  const salvarTudo = async () => {
    const errosMap = validarFormulario();
    const temErros = Object.keys(errosMap).length > 0;
    if (temErros) {
      setErrosVisiveis(errosMap);
      const primeiroErro = Object.keys(errosMap)[0];
      window.toast?.(`Campo obrigatório: ${primeiroErro.replace(/_/g, ' ')}`, 'warning');
      setTimeout(() => scrollParaCampoComErro(primeiroErro), 100);
      return;
    }
    setErrosVisiveis({});
    setSaving(true);
    try {
      await window.QuadroComandoStore.salvar(quadroId, {
        tipo_aplicacao: quadro.tipo_aplicacao, novo_ou_modernizacao: quadro.novo_ou_modernizacao,
        origem_fabricacao: quadro.origem_fabricacao, fabricante_comando: quadro.fabricante_comando,
        modelo_comando: quadro.modelo_comando, escopo_fornecimento: quadro.escopo_fornecimento,
      });
      await window.QuadroComandoStore.salvarParadas(quadroId, quadro.paradas);
      await window.QuadroComandoStore.salvarIntervalos(quadroId, quadro.intervalos);
      await window.QuadroComandoStore.salvarGeometria(quadroId, quadro.geometria);
      await window.QuadroComandoStore.salvarMaquina(quadroId, quadro.maquina);
      await window.QuadroComandoStore.salvarComponentes(quadroId, quadro.componentes);
      window.toast?.('Quadro de comando salvo.', 'success');
      reload();
    } catch (e) { window.toast?.('Erro ao salvar: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const origemTravada = !podeDecidir && quadro.origem_fabricacao !== 'interno';

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários · Quadro de Comando</div>
          <h1 className="page-head__title">Quadro de Comando</h1>
          <p className="page-head__sub">Pedido Nº {quadro.numero_pedido} · Status: <b>{quadro.status}</b>{quadro.numero_cotacao ? ` · Cotação Nº ${quadro.numero_cotacao}` : ''}</p>
        </div>
        <div className="row gap-2">
          {onClose && <Button variant="ghost" onClick={onClose}>Voltar</Button>}
          <Button variant="primary" disabled={saving} onClick={salvarTudo}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>

      <Card title="Origem de fabricação" sub="Decide se este quadro é fabricado pela VerticalParts (Ramo A) ou comprado pronto de um fornecedor (Ramo B, mesmo fluxo do RFQ de elevadores).">
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <QcSelect value={quadro.origem_fabricacao} disabled={!podeDecidir}
            options={[{ value: 'interno', label: 'Fabricar interno (VerticalParts)' }, { value: 'comprado', label: 'Comprar pronto de fornecedor' }]}
            onChange={(v) => setQuadro({ ...quadro, origem_fabricacao: v })}/>
          {!podeDecidir && <span className="small muted">Sem a alçada "Decide fabricar interno ou comprar pronto" (Configurações → Permissões), este campo fica travado.</span>}
        </div>
        <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
          <QcField label="Tipo de aplicação"><QcSelect value={quadro.tipo_aplicacao}
            options={[{ value: 'MR', label: 'MR (com casa de máquinas)' }, { value: 'MRL', label: 'MRL (sem casa de máquinas)' }]}
            onChange={(v) => setQuadro({ ...quadro, tipo_aplicacao: v })}/></QcField>
          <QcField label="Novo ou modernização"><QcSelect value={quadro.novo_ou_modernizacao}
            options={[{ value: 'novo', label: 'Novo' }, { value: 'modernizacao', label: 'Modernização' }]}
            onChange={(v) => setQuadro({ ...quadro, novo_ou_modernizacao: v })}/></QcField>
          <QcField label="Fabricante do comando"><QcInput value={quadro.fabricante_comando} onChange={(v) => setQuadro({ ...quadro, fabricante_comando: v })}/></QcField>
        </div>
      </Card>

      {quadro.origem_fabricacao === 'comprado' ? (
        <QcRamoBComprado quadro={quadro} setQuadro={setQuadro} quadroId={quadroId}/>
      ) : (
        <>
          <Tabs tabs={[
            { key: 'escopo', label: 'Escopo' },
            { key: 'configuracao', label: 'Configuração' },
            { key: 'paradas', label: 'Paradas e portas' },
            { key: 'maquina', label: 'Quadro/máquina' },
            { key: 'componentes', label: 'Componentes internos' },
            { key: 'geometria', label: 'Geometria p/ fiação' },
            { key: 'resultado', label: 'BOM / lista de corte / checklist' },
          ]} active={tab} onChange={setTab}/>
          <div style={{ marginTop: 16 }}>
            {tab === 'escopo' && <QcEscopoSecao escopo={quadro.escopo_fornecimento || {}} onChange={(v) => setQuadro({ ...quadro, escopo_fornecimento: v })}/>}
            {tab === 'configuracao' && <QcConfiguracaoSecao config={quadro.configuracao || {}} paradas={quadro.paradas} onChange={(v) => setQuadro({ ...quadro, configuracao: v })}/>}
            {tab === 'paradas' && <QcParadasSecao paradas={quadro.paradas} onChange={(v) => setQuadro({ ...quadro, paradas: v })}/>}
            {tab === 'maquina' && <QcMaquinaSecao maquina={quadro.maquina} varianteLabel={varianteLabel} errosVisiveis={errosVisiveis} onChange={(v) => setQuadro({ ...quadro, maquina: v })}/>}
            {tab === 'componentes' && <QcComponentesSecao componentes={quadro.componentes || {}} onChange={(v) => setQuadro({ ...quadro, componentes: v })}/>}
            {tab === 'geometria' && <QcGeometriaSecao geometria={quadro.geometria} intervalos={quadro.intervalos}
              onGeom={(v) => setQuadro({ ...quadro, geometria: v })} onIntervalos={(v) => setQuadro({ ...quadro, intervalos: v })}/>}
            {tab === 'resultado' && <QcResultadoSecao quadroId={quadroId} podeGerar={true}/>}
          </div>
        </>
      )}
    </div>
  );
}

function QuadroComandoPage({ setRoute, subsel }) {
  const initialId = typeof subsel === 'string' ? subsel : ((window.VpRouter && window.VpRouter.parseLocation().id) || null);
  const [abertoId, setAbertoId] = React.useState(() => initialId);
  const [criando, setCriando] = React.useState(false);

  // Sem número de cotação fixo aqui: lista geral (por cotação) fica pra uma
  // fase futura — hoje o ponto de entrada real é "Novo quadro de comando"
  // abaixo (avulso) ou a partir do Formulário de Elevador.

  const novo = async () => {
    setCriando(true);
    try {
      const q = await window.QuadroComandoStore.criar({});
      setAbertoId(q.id);
      if (window.VpRouter) window.VpRouter.navigate('formulario-quadro-comando', q.id);
    } catch (e) { window.toast?.('Erro ao criar: ' + e.message, 'error'); }
    finally { setCriando(false); }
  };

  if (abertoId) {
    return <QuadroComandoDetail quadroId={abertoId} onClose={() => { setAbertoId(null); setRoute && setRoute('formularios'); }}/>;
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Formulários</div>
          <h1 className="page-head__title">Quadro de Comando</h1>
          <p className="page-head__sub">Coleta de dados pra fabricação/cotação do quadro de comando — fabricar interno ou comprar pronto de fornecedor.</p>
        </div>
        <Button variant="primary" disabled={criando} onClick={novo}>{criando ? 'Criando…' : 'Novo quadro de comando'}</Button>
      </div>
    </div>
  );
}

Object.assign(window, { QuadroComandoPage, QuadroComandoDetail });
