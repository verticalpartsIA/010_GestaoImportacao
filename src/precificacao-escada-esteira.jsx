/* Precificação de Escada/Esteira Rolante (05/11/2026, cotação 1009).
   Sem motor de cálculo: o Financeiro vê o custo do fornecedor e lança o preço de
   venda por equipamento; ao finalizar, o valor segue para a Proposta ("Herdar dados"). */
function PZEEDetalhe({ id, onVoltar }) {
  const C = window.PrecificacaoEscEstCalc;
  const S = window.PrecificacaoEscEstStore;
  const [pz, setPz] = React.useState(null);
  const [itens, setItens] = React.useState([]);
  const [obs, setObs] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    S.obter(id).then((d) => { if (!vivo) return; setPz(d); setItens(d.itens || []); setObs(d.observacao || ''); })
      .catch((e) => vivo && setErro(e.message || String(e)));
    return () => { vivo = false; };
  }, [id]);

  if (erro) return <div className="page fade-in"><p style={{ color: 'var(--vp-danger)' }}>Erro: {erro}</p><Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button></div>;
  if (!pz) return <div className="page fade-in"><p className="muted">Carregando…</p></div>;

  const cat = C.CATEGORIAS[pz.categoria] || {};
  const travado = pz.status === 'finalizado';
  const tot = C.totais(itens);
  const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setPreco = (i, v) => setItens((l) => l.map((x, k) => (k === i ? { ...x, precoVendaUnit: v } : x)));

  const rodar = async (fn, ok) => {
    setOcupado(true);
    try { await fn(); window.toast?.(ok, 'success'); setPz(await S.obter(id)); }
    catch (e) { window.toast?.(e.message || String(e), 'error'); }
    finally { setOcupado(false); }
  };

  return (
    <div className="page fade-in pl">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">{pz.numero_documento} — {cat.rotulo}</h1>
          <p className="page-head__sub">Sem motor de cálculo: confira o custo do fornecedor e lance o preço de venda de cada equipamento. Ao finalizar, o valor vai para a Proposta.</p>
        </div>
        <div className="page-head__r"><Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button></div>
      </div>

      <Card title="Equipamentos" sub={travado ? 'Finalizada — reabra para editar' : 'preço de venda por equipamento, em R$'}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Equipamento</th><th>Modelo</th><th style={{ textAlign: 'right' }}>Qtd.</th><th style={{ textAlign: 'right' }}>Custo fornecedor (US$ un.)</th><th style={{ textAlign: 'right' }}>Preço de venda un. (R$)</th><th style={{ textAlign: 'right' }}>Total (R$)</th></tr></thead>
            <tbody>
              {itens.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum equipamento neste documento.</td></tr>}
              {itens.map((it, i) => (
                <tr key={it.unidadeId || i}>
                  <td className="mono">{it.identificador || '—'}</td>
                  <td>{it.modelo || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{it.quantidade}</td>
                  <td style={{ textAlign: 'right' }}>{it.custoUnitarioUsd > 0 ? fmt(it.custoUnitarioUsd) : <span className="muted small" title="O fornecedor ainda não respondeu (ou envio direto)">sem custo</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <input className="input" inputMode="decimal" disabled={travado} value={it.precoVendaUnit || ''} placeholder="0,00"
                      onChange={(e) => setPreco(i, e.target.value)} style={{ width: 150, textAlign: 'right' }} aria-label={`Preço de venda de ${it.identificador || 'equipamento'}`}/>
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmt((Number(it.quantidade) || 0) * C.parseValor(it.precoVendaUnit))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={3}><strong>Total da cotação</strong></td>
              <td style={{ textAlign: 'right' }}>{tot.custoUsd > 0 ? 'US$ ' + fmt(tot.custoUsd) : '—'}</td>
              <td></td>
              <td style={{ textAlign: 'right' }}><strong>R$ {fmt(tot.venda)}</strong></td>
            </tr></tfoot>
          </table>
        </div>
      </Card>

      <Card title="Observação" style={{ marginTop: 16 }}>
        <textarea className="input" rows={3} disabled={travado} value={obs} onChange={(e) => setObs(e.target.value)} style={{ width: '100%' }} placeholder="Base do preço, desconto combinado, etc."/>
      </Card>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {!travado && <Button variant="ghost" disabled={ocupado} onClick={() => rodar(() => S.salvar(id, { itens, observacao: obs }), 'Rascunho salvo.')}>Salvar rascunho</Button>}
        {!travado && <Button variant="primary" disabled={ocupado} onClick={() => rodar(() => S.finalizar(id, { itens, observacao: obs }), 'Precificação finalizada. Use "Herdar dados" na Proposta para trazer os valores.')}>Finalizar</Button>}
        {travado && <Button variant="ghost" disabled={ocupado} onClick={() => { if (confirm('Reabrir esta precificação para edição? A Proposta só usa o valor depois que for finalizada de novo.')) rodar(() => S.reabrir(id), 'Reaberta para edição.'); }}>Reabrir</Button>}
      </div>
    </div>
  );
}

Object.assign(window, { PZEEDetalhe });
