/* ============================================================
   precificacao-revisao-valor.jsx — faixa no DETALHE da Precificação com o que o
   Comercial pediu pelo "Alterar valor" da Proposta (06/11/2026).

   Caso real (VPPR-0993): o pedido existia, mas só a lista da Precificação tinha uma
   marca pequena; dentro da precificação o Financeiro não via o que fora pedido nem
   o que fazer. Aqui mostra, por equipamento, o valor da proposta e o pedido, o preço
   atual da Precificação e o MARK-UP que leva ao total pedido (conta inversa do motor,
   `alavancaParaPreco`); o botão só preenche o campo — depois é Calcular e Aprovar.

   13/11/2026 (Gelson): o DESCONTO da Proposta é o mesmo pedido, para baixo. O Financeiro ACEITA (mesmo caminho: mark-up ou coluna "Alterar
   valor", Calcular e Aprovar) ou RECUSA aqui, com motivo (única gravação desta faixa: `PropostaAumentoStore.recusar`). Enquanto o pedido
   de desconto está aberto a proposta fica travada para envio ao cliente.

   window.PZRevisaoValor
   ============================================================ */
function PZRevisaoValor({ numeroCotacao, res, onAplicar, pz, onAplicarColuna }) {
  const A = window.PropostaAumento;
  const AJ = window.PrecificacaoAjustes;
  const E = window.PrecificacaoElevadorEngine;
  const [pedidos, setPedidos] = React.useState(null);
  const [recarga, setRecarga] = React.useState(0);
  const [recusando, setRecusando] = React.useState(null); // pedido (linha) que está sendo recusado
  const [motivoRecusa, setMotivoRecusa] = React.useState('');
  const [salvandoRecusa, setSalvandoRecusa] = React.useState(false);
  const precoAtual = res && res.precificacao ? res.precificacao.precoVendaProposta : null;

  React.useEffect(() => {
    let vivo = true;
    if (numeroCotacao == null || !window.PropostaAumentoStore) { setPedidos([]); return undefined; }
    window.PropostaAumentoStore.pendentesPorCotacao([numeroCotacao])
      .then((m) => { if (vivo) setPedidos(m[String(numeroCotacao)] || []); })
      .catch(() => { if (vivo) setPedidos([]); });
    return () => { vivo = false; };
  }, [numeroCotacao, precoAtual, recarga]);

  if (!A || !pedidos || !pedidos.length) return null;

  const alvo = A.alvoTotal(pedidos[0].propostaTotal, pedidos);
  const alav = res && E && E.alavancaParaPreco ? E.alavancaParaPreco(res, alvo) : null;
  const pct = (n) => (Number(n) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  /* Direção do pedido: alvo abaixo do total da proposta = desconto (alcança quando o preço calculado desceu até o alvo). */
  const totalProposta = Number(pedidos[0].propostaTotal) || 0;
  const ehDesconto = alvo < totalProposta - 0.005;
  const todosDesconto = pedidos.every((p) => p.pedido && p.pedido.tipo === 'desconto');
  const jaAlcanca = precoAtual != null && (ehDesconto ? precoAtual <= alvo + 0.01 : precoAtual + 0.01 >= alvo);
  const quem = pedidos[0].pedido.solicitadoPor || 'Comercial';
  const recusar = async () => {
    if (!recusando) return;
    setSalvandoRecusa(true);
    try {
      await window.PropostaAumentoStore.recusar({ propostaId: recusando.propostaId, nivel: recusando.nivel, itemId: recusando.itemId, motivo: motivoRecusa });
      window.toast?.('Desconto recusado. O Comercial foi avisado e a proposta pode ser enviada.', 'success');
      setRecusando(null); setMotivoRecusa(''); setRecarga((n) => n + 1);
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSalvandoRecusa(false); }
  };

  /* Margem no total pedido (07/11/2026, pendência 11 de 5.2.10): PREVIA pelo motor oficial com o mark-up que leva ao
     total (PrecificacaoRevisaoMargem). O que o Financeiro precisa saber antes de preencher o mark-up: quanto sobra.
     Já alcançando o pedido, mostra a margem do cálculo atual. Só leitura; o valor exato sai ao clicar em Calcular. */
  let previa = null;
  const PM = window.PrecificacaoRevisaoMargem;
  const S = window.PrecificacaoElevadorStore;
  if (PM && S && S.montarBaseInputs && pz && res && res.precificacao && alav && alav.valido && !jaAlcanca) {
    try {
      const { baseInputs, params } = S.montarBaseInputs(pz);
      const difalAtualRs = pz.difal && pz.difal.responsavel_recolhimento === 'emitente_verticalparts' ? Number(pz.difal.valor_difal) || 0 : 0;
      previa = PM.previaMargem({
        E, baseInputs, res, alvo, difalAtualRs,
        extras: {
          modoFormacaoPreco: 'planilha',
          margemDesejadaPct: pz.margem_desejada_pct != null ? pz.margem_desejada_pct : 0,
          contingenciaValor: pz.contingencia_valor,
          outrosCustosNaoRecuperaveisRs: pz.outros_custos_nao_recuperaveis_rs,
        },
      });
    } catch (e) { previa = null; }
  }
  const margemAtualPct = res && res.precificacao && res.precificacao.margemEfetivaPct != null ? Number(res.precificacao.margemEfetivaPct) : null;
  const lucroAtualRs = res && res.precificacao && res.precificacao.lucroFinal != null ? Number(res.precificacao.lucroFinal) : null;

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
      <b>{todosDesconto ? 'Desconto pedido pelo Comercial' : 'Revisão de valor pedida pelo Comercial'}</b>
      <span className="small muted">
        {todosDesconto
          ? ` — ${quem}; aceite ajustando aqui (mark-up ou "Alterar valor"), Calcular e Aprovar, ou recuse com motivo. Enquanto não responder, a proposta fica travada para envio ao cliente.`
          : ` — ${quem}; a proposta só muda depois que você ajustar aqui, clicar em Calcular e Aprovar.`}
      </span>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="t">
          <thead><tr><th>Equipamento</th><th>Tipo</th><th>Na proposta</th><th>Valor pedido</th><th>Motivo</th><th>Pedido em</th><th></th></tr></thead>
          <tbody>
            {pedidos.map((p, i) => (
              <tr key={i}>
                <td className="mono">{p.nivel === 'proposta' ? 'Valor total da proposta' : p.itemId}</td>
                <td>{p.pedido.tipo === 'desconto' ? <b style={{ color: '#b45309' }}>Desconto</b> : 'Aumento'}</td>
                <td>{A.brl(p.pedido.valorAtual)}</td>
                <td><b>{A.brl(p.pedido.valorPedido)}</b></td>
                <td>{p.pedido.motivo || '—'}</td>
                <td className="small muted">{p.pedido.solicitadoEm ? new Date(p.pedido.solicitadoEm).toLocaleString('pt-BR') : '—'}</td>
                <td>{p.pedido.tipo === 'desconto' && <Button variant="outline" size="sm" onClick={() => { setRecusando(p); setMotivoRecusa(''); }}>Recusar desconto</Button>}</td>
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
      {previa && (
        <div style={{ marginTop: 8 }}>
          Margem resultante nesse total: <b>{pct(previa.margemPct)}</b> · lucro <b>{A.brl(previa.lucroRs)}</b>
          <span className="small muted"> (prévia; o DIFAL é estimado — o valor exato sai ao clicar em Calcular)</span>
          {ehDesconto && previa.lucroRs < 0 && <div style={{ color: '#991b1b', marginTop: 4 }}>⚠ Com esse desconto o lucro fica negativo ({A.brl(previa.lucroRs)}): a venda ficaria abaixo do custo.</div>}
        </div>
      )}
      {jaAlcanca && margemAtualPct != null && (
        <div style={{ marginTop: 8 }}>
          Margem no cálculo atual: <b>{pct(margemAtualPct)}</b>{lucroAtualRs != null && <> · lucro <b>{A.brl(lucroAtualRs)}</b></>}
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
      {recusando && (
        <Modal title="Recusar desconto" onClose={() => setRecusando(null)} width={460}
          footer={<>
            <Button variant="ghost" onClick={() => setRecusando(null)}>Voltar</Button>
            <Button variant="primary" onClick={recusar} disabled={salvandoRecusa || motivoRecusa.trim().length < 3}>{salvandoRecusa ? 'Recusando…' : 'Recusar e avisar o Comercial'}</Button>
          </>}>
          <div className="stack" style={{ gap: 10 }}>
            <div>
              {recusando.nivel === 'proposta' ? 'Valor total da proposta' : recusando.itemId}: de <b>{A.brl(recusando.pedido.valorAtual)}</b> para <b>{A.brl(recusando.pedido.valorPedido)}</b>
            </div>
            <div className="small muted">O valor da proposta não muda. O Comercial (dono, gestor e Financeiro) recebe o aviso com o seu motivo e a proposta volta a poder ser enviada.</div>
            <label className="up-eyebrow muted">Motivo da recusa (obrigatório)</label>
            <textarea className="input" rows={3} value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} placeholder="Ex.: a margem não comporta esse desconto"/>
          </div>
        </Modal>
      )}
    </div>
  );
}
window.PZRevisaoValor = PZRevisaoValor;
