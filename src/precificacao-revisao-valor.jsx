/* ============================================================
   precificacao-revisao-valor.jsx — faixa no DETALHE da Precificação com o que o
   Comercial pediu pelo "Alterar valor" da Proposta (06/11/2026).

   Caso real (VPPR-0993): o pedido existia, mas só a lista da Precificação tinha uma
   marca pequena; dentro da precificação o Financeiro não via o que fora pedido nem
   o que fazer. Aqui mostra, por equipamento, o valor da proposta e o pedido, o preço
   atual da Precificação e o MARK-UP que leva ao total pedido (conta inversa do motor,
   `alavancaParaPreco`); o botão só preenche o campo — depois é Calcular e Aprovar.

   Só leitura dos pedidos; nada é gravado aqui. window.PZRevisaoValor
   ============================================================ */
function PZRevisaoValor({ numeroCotacao, res, onAplicar, pz, onAplicarColuna }) {
  const A = window.PropostaAumento;
  const AJ = window.PrecificacaoAjustes;
  const E = window.PrecificacaoElevadorEngine;
  const [pedidos, setPedidos] = React.useState(null);
  const precoAtual = res && res.precificacao ? res.precificacao.precoVendaProposta : null;

  React.useEffect(() => {
    let vivo = true;
    if (numeroCotacao == null || !window.PropostaAumentoStore) { setPedidos([]); return undefined; }
    window.PropostaAumentoStore.pendentesPorCotacao([numeroCotacao])
      .then((m) => { if (vivo) setPedidos(m[String(numeroCotacao)] || []); })
      .catch(() => { if (vivo) setPedidos([]); });
    return () => { vivo = false; };
  }, [numeroCotacao, precoAtual]);

  if (!A || !pedidos || !pedidos.length) return null;

  const alvo = A.alvoTotal(pedidos[0].propostaTotal, pedidos);
  const alav = res && E && E.alavancaParaPreco ? E.alavancaParaPreco(res, alvo) : null;
  const pct = (n) => (Number(n) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const jaAlcanca = precoAtual != null && precoAtual + 0.01 >= alvo;
  const quem = pedidos[0].pedido.solicitadoPor || 'Comercial';

  /* Segunda opção (coluna "Alterar valor"): a diferença de cada equipamento é o valor pedido MENOS o que a coluna
     "VLR Proposta" mostra aqui (e não o valor da proposta, que pode estar defasado — caso VPPR-0993). */
  let colunaPatch = null; let difs = [];
  if (AJ && pz && onAplicarColuna && E && E.ratearPorModelo && precoAtual != null && pedidos.every((p) => p.nivel === 'equipamento')) {
    const baseTotal = precoAtual - (res.ajustes ? Number(res.ajustes.total) || 0 : 0);
    const porUnidade = {}; E.ratearPorModelo(pz.modelos, baseTotal).forEach((m) => { porUnidade[m.unidadeId] = m.valorUnitarioRs; });
    colunaPatch = {};
    pedidos.forEach((p) => {
      const f = (pz.mo_lookup || []).find((x) => x.identificador === p.itemId);
      if (!f) return;
      const chave = `${f.unidadeId}:${f.equipamentoIndice || 1}`;
      const vlr = porUnidade[f.unidadeId];
      if (vlr == null) return;
      const dif = AJ.diferencaParaPedido(p.pedido.valorPedido, vlr);
      colunaPatch[chave] = dif;
      difs.push({ id: p.itemId, vlr, dif });
    });
    if (!Object.keys(colunaPatch).length) colunaPatch = null;
  }

  return (
    <div style={{ margin: '0 0 16px', padding: '12px 16px', background: 'var(--vp-warning-tint, #f8eed7)', border: '1px solid #e0b14f', borderRadius: 6 }}>
      <b>Revisão de valor pedida pelo Comercial</b>
      <span className="small muted"> — {quem}; a proposta só muda depois que você ajustar aqui, clicar em Calcular e Aprovar.</span>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="t">
          <thead><tr><th>Equipamento</th><th>Na proposta</th><th>Valor pedido</th><th>Motivo</th><th>Pedido em</th></tr></thead>
          <tbody>
            {pedidos.map((p, i) => (
              <tr key={i}>
                <td className="mono">{p.nivel === 'proposta' ? 'Valor total da proposta' : p.itemId}</td>
                <td>{A.brl(p.pedido.valorAtual)}</td>
                <td><b>{A.brl(p.pedido.valorPedido)}</b></td>
                <td>{p.pedido.motivo || '—'}</td>
                <td className="small muted">{p.pedido.solicitadoEm ? new Date(p.pedido.solicitadoEm).toLocaleString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8 }}>
        Total pedido: <b>{A.brl(alvo)}</b>
        {precoAtual != null && <> · Preço calculado hoje nesta Precificação: <b>{A.brl(precoAtual)}</b> {jaAlcanca ? <span style={{ color: '#15803d' }}>(já alcança o pedido)</span> : <span style={{ color: '#b45309' }}>(faltam {A.brl(alvo - precoAtual)})</span>}</>}
      </div>
      {alav && alav.valido && !jaAlcanca && (
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <span>Para o cálculo chegar nesse total: <b>{alav.campo === 'mark_up_pct' ? 'Mark-up' : 'Margem desejada'} = {pct(alav.valor)}</b>.</span>
          {onAplicar && <Button variant="primary" size="sm" onClick={() => onAplicar(alav.campo, Math.round(alav.valor * 1e6) / 1e6)}>Preencher o mark-up</Button>}
          <span className="small muted">(depois clique em Calcular e em Aprovar precificação; em seguida o Comercial clica em Herdar Dados)</span>
        </div>
      )}
      {colunaPatch && (
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <span>Ou, equipamento a equipamento, na coluna <b>Alterar valor</b>: {difs.map((d) => `${d.id} ${d.dif >= 0 ? '+' : '−'}${A.brl(Math.abs(d.dif))}`).join(' · ')}.</span>
          <Button variant="outline" size="sm" onClick={() => onAplicarColuna(colunaPatch)}>Aplicar os pedidos na coluna</Button>
        </div>
      )}
      {alav && !alav.valido && <div style={{ color: '#991b1b', marginTop: 8 }}>⚠ Esse total fica abaixo do custo + impostos: o cálculo não consegue chegar nele.</div>}
      {!res && <div className="small muted" style={{ marginTop: 8 }}>Calcule a precificação para ver o mark-up necessário.</div>}
    </div>
  );
}
window.PZRevisaoValor = PZRevisaoValor;
