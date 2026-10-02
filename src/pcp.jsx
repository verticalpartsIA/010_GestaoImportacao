/* ============================================================
   pcp.jsx — PCP · Planejamento e Controle da Produção (Logística Interna).
   Casca inicial: o escopo (ordens de produção, consumo de insumos do
   Almoxarifado, acompanhamento de montagem…) ainda será definido.
   ============================================================ */

function PCPPage() {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · PCP</div>
          <h1 className="page-head__title">PCP — Planejamento e Controle da Produção</h1>
          <p className="page-head__sub">Área de produção da Logística Interna.</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum conteúdo ainda.</div>
    </div>
  );
}

Object.assign(window, { PCPPage });
