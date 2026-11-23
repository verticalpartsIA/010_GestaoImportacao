/* ============================================================
   calculadora-cabos.jsx — Quadros de Comando · Calculadora de Cabos (06/11/2026, pedido do Gelson).
   Hoje: cabo de manobra. SÓ CÁLCULO NA TELA: não lê nem grava nada no banco. A conta mora em calculadora-cabo-manobra-calc.js
   (window.CaboManobraCalc). O tipo de elevador fica na URL (/quadros-de-comando/quadros-calculadora-cabos/mrl | /mr), para recarregar
   e compartilhar o link sem perder a escolha (Art. 22).
   ============================================================ */

function CcCampo({ rotulo, ajuda, valor, onChange, step, min }) {
  return (
    <div className="field">
      <label>{rotulo}</label>
      <input className="input" type="number" inputMode="decimal" step={step || '0.01'} min={min} value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo} />
      {ajuda ? <div className="help">{ajuda}</div> : null}
    </div>
  );
}

function CcLinha({ rotulo, valor, destaque }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px dashed var(--border)', fontSize: destaque ? 15 : 13, fontWeight: destaque ? 700 : 400 }}>
      <span style={{ color: destaque ? 'var(--fg1)' : 'var(--fg2)' }}>{rotulo}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}

function CalculadoraCabosPage() {
  const C = window.CaboManobraCalc;
  const [aba, setAba] = window.useRouteTab('quadros-calculadora-cabos', 'mrl', ['mrl', 'mr'], false, true);
  const tipo = aba === 'mr' ? 'MR' : 'MRL';
  const [f, setF] = React.useState({ paradas: String(C.PADRAO.paradas), pisoAPiso: String(C.PADRAO.pisoAPiso), profundidadePoco: String(C.PADRAO.profundidadePoco), overhead: String(C.PADRAO.overhead), margemMrl: String(C.PADRAO.margemMrl), distanciaMr: String(C.PADRAO.distanciaMr) });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }));
  const r = C.calcular({ ...f, tipo });
  const m = (n) => n.toFixed(2).replace('.', ',') + ' m';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Quadros de Comando · Calculadora de Cabos</div>
          <h1 className="page-head__title">Calculadora de Cabos</h1>
          <p className="page-head__sub">Cabo de manobra do elevador: informe o poço e o tipo de casa de máquinas. O resultado muda enquanto você digita. Nada é gravado.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: '1 1 320px', minWidth: 0 }}>
          <div className="field">
            <label>Tipo de elevador</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={'btn' + (tipo === 'MRL' ? ' btn--primary' : '')} aria-pressed={tipo === 'MRL'} onClick={() => setAba('mrl')}>Sem casa de máquinas (MRL)</button>
              <button className={'btn' + (tipo === 'MR' ? ' btn--primary' : '')} aria-pressed={tipo === 'MR'} onClick={() => setAba('mr')}>Com casa de máquinas</button>
            </div>
          </div>
          <CcCampo rotulo="Quantidade de paradas (pavimentos)" valor={f.paradas} onChange={set('paradas')} step="1" min="2" />
          <CcCampo rotulo="Medida piso a piso (m)" ajuda="Distância vertical de um piso acabado até o piso do pavimento seguinte (inclui a laje)." valor={f.pisoAPiso} onChange={set('pisoAPiso')} min="1" />
          <CcCampo rotulo="Profundidade do poço — P (m)" valor={f.profundidadePoco} onChange={set('profundidadePoco')} min="0.5" />
          <CcCampo rotulo="Altura da última laje / overhead — K (m)" valor={f.overhead} onChange={set('overhead')} min="1" />
          {tipo === 'MRL'
            ? <CcCampo rotulo="Margem de travessia externa — MRL (m)" ajuda="Distância da parede do último andar até o quadro de comando." valor={f.margemMrl} onChange={set('margemMrl')} step="0.1" min="0" />
            : <CcCampo rotulo="Distância do quadro até o furo da laje (m)" ajuda="Caminho do cabo dentro da casa de máquinas." valor={f.distanciaMr} onChange={set('distanciaMr')} step="0.1" min="0" />}
          <div style={{ fontSize: 11, color: 'var(--fg3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <b>Constantes fixas:</b> largura da cabine {C.CABINE_LARGURA_M.toFixed(2).replace('.', ',')} m · altura da cabine {C.CABINE_ALTURA_M.toFixed(2).replace('.', ',')} m · sobra do topo {C.SOBRA_TOPO_M.toFixed(2).replace('.', ',')} m · folga do seio no fundo {Math.round(C.FOLGA_SEIO_FUNDO_M * 100)} cm.
          </div>
        </div>

        <div className="card" style={{ padding: 20, flex: '1 1 320px', maxWidth: 440, minWidth: 0 }} aria-live="polite">
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg2)', marginBottom: 6 }}>Resultado</div>
          {!r.ok ? (
            <div style={{ color: 'var(--vp-danger)', fontSize: 13, padding: '8px 0' }}>{r.erro}</div>
          ) : (
            <div>
              <CcLinha rotulo="Curso total (vãos)" valor={m(r.curso)} />
              <CcLinha rotulo="Seio (descida + curva + subida)" valor={m(r.seio)} />
              <CcLinha rotulo="Percurso na cabine (largura + altura + sobra)" valor={m(r.cabine)} />
              <CcLinha rotulo={r.extraRotulo} valor={m(r.extra)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14, paddingTop: 12, borderTop: '2px solid var(--vp-yellow)' }}>
                <span style={{ fontWeight: 700 }}>Comprimento total</span>
                <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m(r.total)}</span>
              </div>
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--vp-yellow)', color: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Comprar (arredondado)</span>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{r.comprar} m</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
window.CalculadoraCabosPage = CalculadoraCabosPage;
