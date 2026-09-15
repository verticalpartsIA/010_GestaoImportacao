/* ============================================================
   pagamentos-instalador.jsx
   ADM/Financeiro · Pagamentos a Instaladores — Trilha B (01/09).
   Lista as parcelas geradas por contrato-instalador-parcelas-store.js
   (uma por contrato, conforme formaPagamento), liberadas automaticamente
   pelo progresso real do Acompanhamento de Obra (Diário — ver A10 em
   não commitar/tour.md). Confirmar que a
   parcela foi REALMENTE paga é sempre manual — o sistema não movimenta
   dinheiro, só sinaliza quando já pode ser paga.

   Trava de aprovação (11-12/09, projeto de granularidade de custo de
   instalação): "liberada" (progresso da obra) NÃO é a mesma coisa que
   "aprovada pra pagar" — "Marcar paga" agora exige uma decisão do Gestor
   Comercial via decisoes-store.js (mesmo mecanismo genérico de Central de
   Decisões usado em desconto de proposta/contratação de mão de obra),
   não é mais um clique livre.
   ============================================================ */
function PagamentosInstaladorPage() {
  const [parcelas, setParcelas] = React.useState(null);
  const [decisoesPorParcela, setDecisoesPorParcela] = React.useState({});
  const [filtro, setFiltro] = React.useState('liberadas');

  const reload = React.useCallback(() => {
    window.ContratoInstaladorParcelasStore.listarTodasComContrato().then(async (lista) => {
      setParcelas(lista);
      // Trava de aprovação (Gestor Comercial) — busca de uma vez as decisões
      // já existentes pra essas parcelas, pra mostrar "aguardando aprovação"
      // em vez de deixar o usuário achar que o botão travou sozinho.
      const c = (window.__VP_SB || {}).sb;
      const ids = lista.map((p) => p.id);
      if (c && ids.length) {
        const { data } = await c.from('decisoes_gerenciais').select('*')
          .eq('tipo', 'pagamento_instalador_parcela').eq('referencia_tabela', 'contrato_instalador_parcelas').in('referencia_id', ids);
        const porParcela = {};
        (data || []).forEach((d) => { porParcela[d.referencia_id] = d; });
        setDecisoesPorParcela(porParcela);
      }
    }).catch(() => setParcelas([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const marcarPaga = async (p) => {
    try {
      const contrato = p.contratos_instalador || {};
      await window.ContratoInstaladorParcelasStore.marcarPaga(p.id, {
        titulo: `Pagamento — ${contrato.contratada_nome || 'Instalador'} · Parcela ${p.numero}`,
        contratada: contrato.contratada_nome || null, numero_documento: contrato.numero_documento || null,
        valor: p.valor,
      });
      window.toast?.('Parcela marcada como paga.', 'success');
      reload();
    } catch (e) { window.toast?.(e.message, 'warning'); reload(); }
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
          <p className="page-head__sub">Parcelas do Contrato Instalador — liberadas automaticamente conforme a instalação avança no Acompanhamento de Obra (Diário). Confirmar o pagamento exige aprovação do Gestor Comercial (Central de Decisões).</p>
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
              const decisao = decisoesPorParcela[p.id];
              const aprovada = decisao?.status === 'aprovada';
              const reprovada = decisao?.status === 'reprovada';
              const aguardandoGestor = decisao?.status === 'pendente';
              return (
                <tr key={p.id}>
                  <td><div className="cell-main">{contrato.contratada_nome || '—'}</div></td>
                  <td className="mono">{contrato.numero_documento || '—'}</td>
                  <td>{p.numero}. {p.descricao}</td>
                  <td className="mono">{fmtMoeda(p.valor)}</td>
                  <td className="small">
                    {p.status === 'paga'
                      ? <StatusBadge status="Ativo" />
                      : reprovada
                        ? <span style={{ color: '#991b1b', fontWeight: 600 }}>Pagamento reprovado pelo Gestor</span>
                        : aguardandoGestor
                          ? <span style={{ color: '#b45309', fontWeight: 600 }}>Aguardando aprovação do Gestor Comercial</span>
                          : p.liberada
                            ? <span style={{ color: '#cc7700', fontWeight: 600 }}>{aprovada ? 'Aprovada — pronta pra pagar' : 'Liberada — aguardando pagamento'}</span>
                            : <span className="muted">Aguardando: {labelGatilho(p.gatilho_evento)}</span>}
                  </td>
                  <td className="small">{p.status === 'paga' ? `${fmtData(p.pago_em)}${p.pago_por ? ' · ' + p.pago_por : ''}` : '—'}</td>
                  <td>
                    {p.status === 'paga'
                      ? <Button variant="ghost" size="sm" onClick={() => reabrir(p.id)}>Reabrir</Button>
                      : <Button variant="primary" size="sm" disabled={!p.liberada || reprovada} onClick={() => marcarPaga(p)}>
                          {aguardandoGestor ? 'Solicitar aprovação' : 'Marcar paga'}
                        </Button>}
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
