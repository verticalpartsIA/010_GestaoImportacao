/* ============================================================
   pagamentos-instalador.jsx
   ADM/Financeiro · Pagamentos a Instaladores — Trilha B (01/09).
   Lista as parcelas geradas por contrato-instalador-parcelas-store.js
   (uma por contrato, conforme formaPagamento), liberadas automaticamente
   pelo progresso real do Cronograma de Instalação. Confirmar que a
   parcela foi REALMENTE paga é sempre manual — o sistema não movimenta
   dinheiro, só sinaliza quando já pode ser paga.
   ============================================================ */
function PagamentosInstaladorPage() {
  const [parcelas, setParcelas] = React.useState(null);
  const [filtro, setFiltro] = React.useState('liberadas');

  const reload = React.useCallback(() => {
    window.ContratoInstaladorParcelasStore.listarTodasComContrato().then(setParcelas).catch(() => setParcelas([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const marcarPaga = async (id) => {
    try {
      await window.ContratoInstaladorParcelasStore.marcarPaga(id);
      window.toast?.('Parcela marcada como paga.', 'success');
      reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const reabrir = async (id) => {
    if (!window.confirm('Reabrir esta parcela (voltar pra pendente)?')) return;
    try {
      await window.ContratoInstaladorParcelasStore.reabrirParcela(id);
      window.toast?.('Parcela reaberta.', 'success');
      reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (parcelas === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtradas = parcelas.filter((p) => {
    if (filtro === 'liberadas') return p.status === 'pendente' && p.liberada;
    if (filtro === 'aguardando') return p.status === 'pendente' && !p.liberada;
    if (filtro === 'pagas') return p.status === 'paga';
    return true;
  });

  const fmtMoeda = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
  const labelGatilho = (chave) => (chave && window.EventosFluxo?.EVENTOS?.[chave]?.label) || 'manual (sem gatilho automático)';

  const contagem = {
    liberadas: parcelas.filter((p) => p.status === 'pendente' && p.liberada).length,
    aguardando: parcelas.filter((p) => p.status === 'pendente' && !p.liberada).length,
    pagas: parcelas.filter((p) => p.status === 'paga').length,
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />ADM/ Financeiro</div>
          <h1 className="page-head__title">Pagamentos a Instaladores</h1>
          <p className="page-head__sub">Parcelas do Contrato Instalador — liberadas automaticamente conforme a instalação avança no Cronograma de Instalação. Confirmar o pagamento é sempre manual.</p>
        </div>
      </div>

      <div className="row gap-2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { id: 'liberadas', label: `Liberadas p/ pagar (${contagem.liberadas})` },
          { id: 'aguardando', label: `Aguardando marco (${contagem.aguardando})` },
          { id: 'pagas', label: `Pagas (${contagem.pagas})` },
          { id: 'todas', label: 'Todas' },
        ].map((f) => (
          <button key={f.id}
            className="badge"
            style={{ cursor: 'pointer', border: filtro === f.id ? '2px solid var(--vp-yellow, #ffd400)' : '1px solid var(--border)' }}
            onClick={() => setFiltro(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Instalador</th><th>Contrato</th><th>Parcela</th><th>Valor</th><th>Situação</th><th>Pago em</th><th></th></tr></thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma parcela encontrada.</td></tr>}
            {filtradas.map((p) => {
              const contrato = p.contratos_instalador || {};
              return (
                <tr key={p.id}>
                  <td><div className="cell-main">{contrato.contratada_nome || '—'}</div></td>
                  <td className="mono">{contrato.numero_documento || '—'}</td>
                  <td>{p.numero}. {p.descricao}</td>
                  <td className="mono">{fmtMoeda(p.valor)}</td>
                  <td className="small">
                    {p.status === 'paga'
                      ? <StatusBadge status="Ativo" />
                      : p.liberada
                        ? <span style={{ color: '#cc7700', fontWeight: 600 }}>Liberada — aguardando pagamento</span>
                        : <span className="muted">Aguardando: {labelGatilho(p.gatilho_evento)}</span>}
                  </td>
                  <td className="small">{p.status === 'paga' ? `${fmtData(p.pago_em)}${p.pago_por ? ' · ' + p.pago_por : ''}` : '—'}</td>
                  <td>
                    {p.status === 'paga'
                      ? <Button variant="ghost" size="sm" onClick={() => reabrir(p.id)}>Reabrir</Button>
                      : <Button variant="primary" size="sm" disabled={!p.liberada} onClick={() => marcarPaga(p.id)}>Marcar paga</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.PagamentosInstaladorPage = PagamentosInstaladorPage;
