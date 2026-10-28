/* ============================================================
   repositorio-documentos.jsx — Entrega & Documentação › Repositório Documentos
   Casa única das 3 telas de fechamento documental da obra: Central de
   Documentos (central-documentos), Data Book & Termo (databook) e Entrega
   Final (handover). Cada uma continua sendo a MESMA rota de sempre (nada
   muda nos componentes, nos dados nem nas permissões) — só ganham uma
   faixa de abas comum no topo, pra virarem um módulo só aos olhos de quem
   usa. Isso preserva de propósito os deep links que já apontam pra
   'databook'/'handover' (Central de Decisões, Prazos & Pendências,
   Dashboard, via gatilhos-engine.js `rota: 'databook'|'handover'`).
   ============================================================ */
(function () {
  'use strict';

  const ABAS = [
    { rota: 'central-documentos', label: 'Central de Documentos' },
    { rota: 'databook', label: 'Data Book & Termo' },
    { rota: 'handover', label: 'Entrega Final' },
  ];

  function RepositorioDocumentosAbas({ route, setRoute }) {
    return (
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', flexShrink: 0 }}>
        {ABAS.map((a) => (
          <Button key={a.rota}
            variant={route === a.rota ? 'primary' : 'ghost'}
            onClick={() => setRoute && setRoute(a.rota)}>
            {a.label}
          </Button>
        ))}
      </div>
    );
  }

  function RepositorioDocumentosShell({ route, setRoute, children }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <RepositorioDocumentosAbas route={route} setRoute={setRoute}/>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    );
  }

  window.RepositorioDocumentosShell = RepositorioDocumentosShell;
})();
