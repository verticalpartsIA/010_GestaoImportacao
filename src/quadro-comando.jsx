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

function QcInput({ value, onChange, type, placeholder, disabled }) {
  return (
    <input className="input" type={type || 'text'} value={value == null ? '' : value} placeholder={placeholder}
      disabled={disabled}
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

/* ---------- Escopo de fornecimento (item 1 da instrução) ---------- */
const QC_ESCOPO_ITENS = [
  { key: 'cop', label: 'COP (botoeira de cabina)' },
  { key: 'lop', label: 'LOP (botoeiras de pavimento)' },
  { key: 'lip', label: 'LIP / indicadores' },
  { key: 'operador_porta', label: 'Operador de porta' },
  { key: 'resgate_automatico', label: 'Resgate automático' },
  { key: 'interfone', label: 'Interfone' },
  { key: 'inspecao_teto', label: 'Inspeção no teto' },
  { key: 'caixa_botao_parada_poco', label: 'Caixa e botão de parada do poço' },
  { key: 'iluminacao_tomada', label: 'Iluminação/tomada' },
  { key: 'acessorios_seguranca', label: 'Acessórios de segurança' },
  { key: 'cabos', label: 'Cabos (fiação fixa + cabo de manobra)' },
];
const QC_ESCOPO_OPCOES = [
  { value: 'fornecer', label: 'Fornecer' },
  { value: 'reutilizar', label: 'Reutilizar existente' },
  { value: 'terceiro', label: 'Fornecido por terceiro' },
  { value: 'nao_aplica', label: 'Não se aplica' },
];

function QcEscopoSecao({ escopo, onChange, disabled }) {
  return (
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
  );
}

/* ---------- Configuração + Paradas (item 2) ---------- */
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
function QcMaquinaSecao({ maquina, onChange, disabled, varianteLabel }) {
  const set = (patch) => onChange({ ...maquina, ...patch });
  return (
    <Card title="Quadro, máquina e acionamentos" sub={varianteLabel ? `Variante reconhecida: ${varianteLabel}` : 'Preencha potência e tensão pra reconhecer a variante do quadro (7,5/15 kW × 220/380 V).'}>
      <div className="grid-3" style={{ gap: 12 }}>
        <QcField label="Tipo de máquina"><QcSelect value={maquina.tipo_maquina} disabled={disabled}
          options={[{ value: 'sincrona', label: 'Síncrona (ímãs permanentes)' }, { value: 'assincrona', label: 'Assíncrona (indução)' }]}
          onChange={(v) => set({ tipo_maquina: v })}/></QcField>
        <QcField label="Fabricante/modelo da máquina"><QcInput value={maquina.fabricante_maquina} disabled={disabled} onChange={(v) => set({ fabricante_maquina: v })}/></QcField>
        <QcField label="Potência (kW)"><QcInput type="number" value={maquina.potencia_kw} disabled={disabled} onChange={(v) => set({ potencia_kw: v })}/></QcField>
        <QcField label="Corrente (A)"><QcInput type="number" value={maquina.corrente_a} disabled={disabled} onChange={(v) => set({ corrente_a: v })}/></QcField>
        <QcField label="Tensão da rede (V)"><QcSelect value={maquina.tensao_v} disabled={disabled}
          options={[{ value: '220', label: '220V' }, { value: '380', label: '380V' }]}
          onChange={(v) => set({ tensao_v: v ? Number(v) : null })}/></QcField>
        <QcField label="Velocidade (rpm)"><QcInput type="number" value={maquina.velocidade_rpm} disabled={disabled} onChange={(v) => set({ velocidade_rpm: v })}/></QcField>
        <QcField label="Freio — tipo"><QcInput value={maquina.freio_tipo} disabled={disabled} onChange={(v) => set({ freio_tipo: v })}/></QcField>
        <QcField label="Freio — tensão de acionamento"><QcInput type="number" value={maquina.freio_tensao_acionamento} disabled={disabled} onChange={(v) => set({ freio_tensao_acionamento: v })}/></QcField>
        <QcField label="Freio — tensão de manutenção"><QcInput type="number" value={maquina.freio_tensao_manutencao} disabled={disabled} onChange={(v) => set({ freio_tensao_manutencao: v })}/></QcField>
        <QcField label="Encoder — fabricante"><QcInput value={maquina.encoder_fabricante} disabled={disabled} onChange={(v) => set({ encoder_fabricante: v })}/></QcField>
        <QcField label="Encoder — modelo/referência exata"><QcInput value={maquina.encoder_modelo} disabled={disabled} onChange={(v) => set({ encoder_modelo: v })}/></QcField>
        <QcField label="Encoder — tecnologia/protocolo" hint="Ex.: incremental, EnDat, Hiperface. Combinações incomuns vão pra validação técnica, não são corrigidas automaticamente.">
          <QcInput value={maquina.encoder_tecnologia} disabled={disabled} onChange={(v) => set({ encoder_tecnologia: v })}/></QcField>
      </div>
    </Card>
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
  const [gerando, setGerando] = React.useState(false);
  const [gerandoChecklist, setGerandoChecklist] = React.useState(false);

  const reload = React.useCallback(() => {
    window.QuadroComandoStore.obterBomECortes(quadroId).then(({ bomItens, trechos }) => { setBom(bomItens); setCortes(trechos); });
    window.QuadroComandoStore.obterChecklist(quadroId).then(setChecklist);
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

/* ---------- Página principal ---------- */
function QuadroComandoDetail({ quadroId, onClose }) {
  const [quadro, setQuadro] = React.useState(null);
  const [podeDecidir, setPodeDecidir] = React.useState(false);
  const [tab, setTab] = React.useState('escopo');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => {
    window.QuadroComandoStore.obter(quadroId).then(setQuadro);
  }, [quadroId]);
  React.useEffect(() => { reload(); }, [reload]);
  React.useEffect(() => { window.QuadroComandoStore.podeDecidirOrigemFabricacao().then(setPodeDecidir); }, []);

  if (!quadro) return <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>Carregando…</div>;

  const engine = window.QuadroComandoBomEngine;
  const varianteKey = engine ? engine.chaveVariante(quadro.maquina.potencia_kw, quadro.maquina.tensao_v) : null;
  const varianteLabel = varianteKey && engine.listarVariantes().find((v) => v.key === varianteKey)?.label;

  const salvarTudo = async () => {
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
          <p className="page-head__sub">Status: <b>{quadro.status}</b>{quadro.numero_cotacao ? ` · Cotação Nº ${quadro.numero_cotacao}` : ''}</p>
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
        <Card title="Comprar pronto de fornecedor" sub="Ramo B — ainda não implementado nesta fase.">
          <p className="small muted">
            Este ramo deve reusar exatamente o mesmo mecanismo de "Cotação a Fornecedor" já usado pros elevadores
            (token público, envio por WhatsApp/E-mail/Link, resposta no portal, Inbox) — só falta cadastrar a
            especificação técnica bilíngue (equivalente à E-PACKAGE SPECS COLLECTION TABLE) pra categoria
            <code> quadro_comando</code>, que já existe como valor no modelo de dados. Combine comigo os campos
            dessa especificação antes de eu implementar esta parte.
          </p>
        </Card>
      ) : (
        <>
          <Tabs tabs={[
            { key: 'escopo', label: 'Escopo' },
            { key: 'paradas', label: 'Configuração e portas' },
            { key: 'maquina', label: 'Quadro/máquina' },
            { key: 'geometria', label: 'Geometria p/ fiação' },
            { key: 'resultado', label: 'BOM / lista de corte / checklist' },
          ]} active={tab} onChange={setTab}/>
          <div style={{ marginTop: 16 }}>
            {tab === 'escopo' && <QcEscopoSecao escopo={quadro.escopo_fornecimento || {}} onChange={(v) => setQuadro({ ...quadro, escopo_fornecimento: v })}/>}
            {tab === 'paradas' && <QcParadasSecao paradas={quadro.paradas} onChange={(v) => setQuadro({ ...quadro, paradas: v })}/>}
            {tab === 'maquina' && <QcMaquinaSecao maquina={quadro.maquina} varianteLabel={varianteLabel} onChange={(v) => setQuadro({ ...quadro, maquina: v })}/>}
            {tab === 'geometria' && <QcGeometriaSecao geometria={quadro.geometria} intervalos={quadro.intervalos}
              onGeom={(v) => setQuadro({ ...quadro, geometria: v })} onIntervalos={(v) => setQuadro({ ...quadro, intervalos: v })}/>}
            {tab === 'resultado' && <QcResultadoSecao quadroId={quadroId} podeGerar={true}/>}
          </div>
        </>
      )}
    </div>
  );
}

function QuadroComandoPage() {
  const [abertoId, setAbertoId] = React.useState(() => (window.VpRouter && window.VpRouter.parseLocation().id) || null);
  const [criando, setCriando] = React.useState(false);

  // Sem número de cotação fixo aqui: lista geral (por cotação) fica pra uma
  // fase futura — hoje o ponto de entrada real é "Novo quadro de comando"
  // abaixo (avulso) ou a partir do Formulário de Elevador.

  const novo = async () => {
    setCriando(true);
    try {
      const q = await window.QuadroComandoStore.criar({});
      setAbertoId(q.id);
      if (window.VpRouter) window.VpRouter.navigate('quadro-comando', q.id);
    } catch (e) { window.toast?.('Erro ao criar: ' + e.message, 'error'); }
    finally { setCriando(false); }
  };

  if (abertoId) {
    return <QuadroComandoDetail quadroId={abertoId} onClose={() => { setAbertoId(null); if (window.VpRouter) window.VpRouter.navigate('formularios'); }}/>;
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
