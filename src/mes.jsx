/* ============================================================
   mes.jsx — Logística Interna · MES (Sistema de Execução da Manufatura).
   Casca inicial: o conteúdo ainda será definido.
   ============================================================ */

function MESPage() {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · MES</div>
          <h1 className="page-head__title">MES — Sistema de Execução da Manufatura</h1>
          <p className="page-head__sub">Execução da produção no chão de fábrica.</p>
        </div>
      </div>
      <div style={{ padding: 24, color: 'var(--fg3)' }}>Nenhum conteúdo ainda.</div>
    </div>
  );
}

Object.assign(window, { MESPage });
