/* ============================================================
   gestao-importacao-painel.jsx — Gestão Importação · Painel & Análise de Preços
   Duas telas de leitura, sem tabela nova: agregam dados que já existem em
   pi_importacao / rfq_importacao / ims_importacao / embarques_importacao.
   ============================================================ */

/* ---------- Painel ---------- */
function GIPainelPage() {
  const [dados, setDados] = React.useState(null);

  React.useEffect(() => {
    Promise.all([
      window.PIStore.listarTodas(),
      window.RFQStore.listarTodas(),
      window.IMSStore.listarTodas(),
      window.EmbarquesImportacaoStore.listarTodas(),
    ]).then(([pis, rfqs, ims, embarques]) => setDados({ pis, rfqs, ims, embarques })).catch(() => setDados({ pis: [], rfqs: [], ims: [], embarques: [] }));
  }, []);

  if (dados === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const { pis, rfqs, ims, embarques } = dados;
  const pisAbertas = pis.filter((p) => !['Concluída', 'Cancelada'].includes(p.status));
  const valorPisAbertas = pisAbertas.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const rfqsAbertas = rfqs.filter((r) => r.status === 'Aberta' || r.status === 'Em análise');
  const imsPendentes = ims.filter((s) => s.aprovado === false && !s.arquivado);
  const imsAtrasados = ims.filter((s) => window.IMSStore.estaAtrasado(s));
  const embarquesAtivos = embarques.filter((e) => e.status_etapa !== 'Concluído' && !e.arquivado);
  const porEtapa = {};
  embarquesAtivos.forEach((e) => { porEtapa[e.status_etapa] = (porEtapa[e.status_etapa] || 0) + 1; });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">Painel</h1>
          <p className="page-head__sub">Visão geral de P.I., RFQ, IMS e Embarques.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="P.I. abertas" value={pisAbertas.length} sub={window.PIStore.fmtMoeda(valorPisAbertas, pisAbertas[0]?.moeda || 'USD')} icon="fileText"/>
        <KPI label="RFQ abertas" value={rfqsAbertas.length} sub="aguardando/analisando" icon="fileSearch"/>
        <KPI label="IMS pendentes" value={imsPendentes.length} sub={imsAtrasados.length ? `${imsAtrasados.length} atrasada(s)` : 'nenhuma atrasada'} icon="package"/>
        <KPI label="Embarques ativos" value={embarquesAtivos.length} sub="em andamento" icon="ship"/>
      </div>

      <Card title="Embarques por etapa">
        {Object.keys(porEtapa).length === 0 ? (
          <p className="small muted" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhum embarque ativo.</p>
        ) : (
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            {Object.entries(porEtapa).map(([etapa, n]) => (
              <div key={etapa} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '10px 16px', minWidth: 140 }}>
                <div className="small muted">{etapa}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{n}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Análise de Preços ---------- */
function GIAnalisePrecosPage() {
  const [rfqs, setRfqs] = React.useState(null);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => { window.RFQStore.listarTodas().then(setRfqs).catch(() => setRfqs([])); }, []);

  if (rfqs === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  /* Agrupa por nome de item (case-insensitive) — cada cotação de preço de
     cada RFQ vira uma linha: fornecedor, valor, moeda, RFQ de origem. */
  const grupos = {};
  rfqs.forEach((rfq) => {
    (rfq.itens || []).forEach((item) => {
      const chave = (item.nome || '').trim().toLowerCase();
      if (!chave) return;
      if (!grupos[chave]) grupos[chave] = { nome: item.nome, cotacoes: [] };
      (item.precos || []).forEach((p) => {
        if (typeof p.valor_unitario !== 'number') return;
        const forn = (rfq.fornecedores || []).find((f) => f.fornecedor_id === p.fornecedor_id);
        grupos[chave].cotacoes.push({
          fornecedor: forn ? forn.fornecedor_nome : '—', moeda: forn ? forn.moeda : 'BRL',
          valor: p.valor_unitario, rfqNumero: rfq.numero_rfq, data: rfq.data,
        });
      });
    });
  });
  const itens = Object.values(grupos).filter((g) => !search || g.nome.toLowerCase().includes(search.toLowerCase()));
  itens.forEach((g) => g.cotacoes.sort((a, b) => a.valor - b.valor));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">Análise de Preços</h1>
          <p className="page-head__sub">Comparativo de preços por item, a partir do histórico de todas as RFQs.</p>
        </div>
      </div>

      <input className="input" style={{ marginBottom: 14 }} placeholder="Buscar por nome do item…" value={search} onChange={(e) => setSearch(e.target.value)}/>

      {itens.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>
          {rfqs.length === 0 ? 'Nenhuma RFQ cadastrada ainda — a análise usa o histórico de preços cotados nas RFQs.' : 'Nenhum item encontrado.'}
        </div>
      )}

      <div className="stack" style={{ gap: 14 }}>
        {itens.map((g) => (
          <Card key={g.nome} title={g.nome} sub={`${g.cotacoes.length} cotação(ões) de preço registrada(s)`}>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Fornecedor</th><th>Valor unitário</th><th>RFQ</th><th>Data</th></tr></thead>
                <tbody>
                  {g.cotacoes.map((c, i) => (
                    <tr key={i}>
                      <td>{c.fornecedor}</td>
                      <td style={{ fontWeight: i === 0 ? 800 : 400, color: i === 0 ? 'var(--vp-success, #0a7)' : undefined }}>{window.RFQStore.fmtMoeda(c.valor, c.moeda)}{i === 0 ? ' · menor preço' : ''}</td>
                      <td className="mono">{c.rfqNumero}</td>
                      <td>{c.data ? new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

window.GIPainelPage = GIPainelPage;
window.GIAnalisePrecosPage = GIAnalisePrecosPage;
