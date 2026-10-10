/* ============================================================
   precificacao-memoria.jsx — "Memória de cálculo" da Precificação (10/10/2026)

   Mostra, em abas e com a cara da planilha do Financeiro ("JA - COTAÇÃO N° 963"),
   cada passo do cálculo do MÉTODO DA PLANILHA: parâmetros, importação (CIF),
   formação dos impostos, despesas, impostos/créditos da venda, preço, comissões,
   lucro e o preço de cada equipamento (explodido, 1..N). É recalculado ao vivo a
   partir dos campos da própria tela (função pura PrecificacaoElevadorEngine.
   calcularPlanilha — reproduz o Excel ao centavo, ver teste "golden 963"), então
   é o mesmo cálculo que gera o preço oficial. Só leitura.
   Classes visuais: ver styles/planilha.css (pl-*). window.PZMemoriaCalculo
   ============================================================ */
const PM_ABAS = [
  ['resumo', 'Resumo'], ['importacao', '1 · Importação (CIF)'], ['impostos', '2 · Impostos da importação'],
  ['despesas', '3 · Instalação e despesas'], ['venda', '4 · Impostos e créditos da venda'],
  ['preco', '5 · Preço, comissões e lucro'], ['equipamentos', '6 · Equipamentos'], ['containers', '7 · Containers e frete'],
];
const pmBrl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pmUsd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
const pmPct = (v, d = 2) => `${((Number(v) || 0) * 100).toFixed(d).replace('.', ',')}%`;

/* Linha rótulo/valor calculado (cinza). `forte` = linha de total (azul). */
function PMLinha({ rotulo, valor, nota, forte }) {
  return (
    <tr className={forte ? 'pl-total' : ''}>
      <td>{rotulo}{nota ? <div className="small muted" style={{ fontWeight: 400 }}>{nota}</div> : null}</td>
      <td className="pl-calc-cell mono">{valor}</td>
    </tr>
  );
}

function PMTabela({ children, colunas }) {
  return (
    <div className="table-wrap">
      <table className="pl-grid">
        {colunas ? <thead><tr>{colunas.map((c, i) => <th key={i}>{c}</th>)}</tr></thead> : null}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function PZMemoriaCalculo({ pz }) {
  const E = window.PrecificacaoElevadorEngine;
  const S = window.PrecificacaoElevadorStore;
  const [aba, setAba] = React.useState('resumo');

  /* Os custos não dependem do mark-up: 1º calcula com mark-up 0 só para obter custo e impostos. */
  const base = React.useMemo(() => {
    try {
      const { baseInputs } = S.montarBaseInputs(pz);
      const difalCustoRs = pz.difal && pz.difal.responsavel_recolhimento === 'emitente_verticalparts' ? (Number(pz.difal.valor_difal) || 0) : 0;
      const extras = { difalCustoRs, contingenciaValor: pz.contingencia_valor, outrosCustosNaoRecuperaveisRs: pz.outros_custos_nao_recuperaveis_rs };
      return { baseInputs, extras, r0: E.calcularPlanilha({ ...baseInputs, ...extras, markUpPct: 0 }) };
    } catch (e) { return { erro: e.message }; }
  }, [pz]);

  /* O mark-up é o do campo "MARK-UP" das Alavancas do Financeiro (margem sobre o PREÇO de venda). */
  const markEff = Number(pz.mark_up_pct) || 0;
  const r = React.useMemo(() => {
    if (!base.r0) return null;
    try { return E.calcularPlanilha({ ...base.baseInputs, ...base.extras, markUpPct: markEff }); } catch (e) { return null; }
  }, [base, markEff]);

  if (!r) {
    return <Card title="Memória de cálculo — método da planilha" style={{ marginTop: 16 }}><p className="small muted" style={{ margin: 0 }}>Preencha os custos acima para ver a memória de cálculo{base.erro ? ` (${base.erro})` : ''}.</p></Card>;
  }
  const { baseInputs, extras } = base;
  const imp = r.importacao;
  const pv = r.precificacao;
  const par = baseInputs.parametros || {};
  const q = baseInputs.quantidadeEquipamentos;

  const ratear = r.modelos || [];
  const porUnidade = {};
  ratear.forEach((m) => { porUnidade[m.unidadeId] = m; });
  const fisicos = (pz.mo_lookup || []).filter((x) => x.identificador);
  const lucrosEq = E.ratearLucroPorEquipamento({
    lucroTotal: pv.lucroFinal, precoTotal: pv.precoVendaProposta,
    linhas: fisicos.map((f) => ({ preco: (porUnidade[f.unidadeId] || {}).valorUnitarioRs || 0, mo: Number(f.valorRs) || 0 })),
  });

  return (
    <Card title="Memória de cálculo — método da planilha" sub="cada passo da planilha do Financeiro, recalculado ao vivo com os campos desta tela" style={{ marginTop: 16 }}>
      <div className="pl-legenda" style={{ marginBottom: 0 }}>
        <span><i className="pl-l-edit"/> Campo editável (preenchido nas seções acima)</span>
        <span><i className="pl-l-calc"/> Campo calculado automaticamente</span>
      </div>
      <div className="pl-note" style={{ marginBottom: 12 }}>
        <b>MARK-UP usado:</b> {pmPct(markEff)} do preço de venda (campo "MARK-UP" das Alavancas do Financeiro). Para mudar, altere lá e clique em Calcular.
      </div>
      <div className="tbar" style={{ flexWrap: 'wrap' }}>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {PM_ABAS.map(([k, t]) => <button key={k} className={aba === k ? 'is-active' : ''} onClick={() => setAba(k)}>{t}</button>)}
        </div>
      </div>

      {aba === 'resumo' && (
        <div className="stack" style={{ gap: 12 }}>
          <PMTabela colunas={['', 'Valor']}>
            <tr><td>Preço de venda (proposta)</td><td className="pl-calc-cell mono">{pmBrl(pv.precoVendaProposta)}</td></tr>
            <tr><td>Preço por equipamento (média)</td><td className="pl-calc-cell mono">{pmBrl(pv.precoVendaPorEquipamento)}</td></tr>
            <tr><td>Custo para precificação (nota, já sem créditos)</td><td className="pl-calc-cell mono">{pmBrl(imp.custoTotalMercadorias)}</td></tr>
            <tr><td>Despesas (instalação, frete interno, armazenagem…)</td><td className="pl-calc-cell mono">{pmBrl(imp.despesasInstalacaoMontagem)}</td></tr>
            <tr><td>(−) DIFAL</td><td className="pl-calc-cell mono">{pmBrl(pv.difalRs)}</td></tr>
            <tr><td>Lucro líquido da venda (depois de custos, impostos, comissões e DIFAL)</td><td className="pl-calc-cell mono">{pmBrl(pv.lucroFinal)}</td></tr>
            <tr className="pl-total"><td>Margem de lucro líquido</td><td className="pl-calc-cell mono">{pmPct(pv.margemEfetivaPct)}</td></tr>
          </PMTabela>
        </div>
      )}

      {aba === 'importacao' && (
        <PMTabela colunas={['Item', 'US$', 'Câmbio', 'R$']}>
          <tr><td>VMLE — mercadorias no local de embarque</td><td className="pl-calc-cell mono">{pmUsd(baseInputs.vmleUsd)}</td><td className="pl-calc-cell mono">{(Number(baseInputs.txCambial) || 0).toFixed(4).replace('.', ',')}</td><td className="pl-calc-cell mono">{pmBrl(imp.vmleRs)}</td></tr>
          <tr><td>Seguro</td><td className="pl-calc-cell mono">{pmUsd(baseInputs.seguroUsd)}</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.seguroRs)}</td></tr>
          <tr><td>Frete internacional informado</td><td className="pl-calc-cell mono">{pmUsd(baseInputs.freteSeguroCapataziaUsd)}</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl((Number(baseInputs.freteSeguroCapataziaUsd) || 0) * (Number(baseInputs.txCambial) || 0))}</td></tr>
          <tr><td>Containers + capatazia + GRI (cadastro de Containers → entram no CIF, como na planilha)</td><td className="pl-calc-cell mono">{pmUsd(r.planilha.containersUsd)}</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(r.planilha.containersRs)}</td></tr>
          <tr className="pl-total"><td>VMLD — valor no local de destino (CIF)</td><td className="pl-calc-cell mono">{pmUsd(imp.vmldRs / (Number(baseInputs.txCambial) || 1))}</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.vmldRs)}</td></tr>
        </PMTabela>
      )}

      {aba === 'impostos' && (
        <PMTabela colunas={['Imposto', 'Base de cálculo', 'Alíquota', 'Valor']}>
          <tr><td>II — Imposto de Importação</td><td className="pl-calc-cell mono">{pmBrl(imp.vmldRs)}</td><td className="pl-calc-cell mono">{pmPct(par.iiImportacaoPct)}</td><td className="pl-calc-cell mono">{pmBrl(imp.ii)}</td></tr>
          <tr><td>IPI</td><td className="pl-calc-cell mono">{pmBrl(imp.vmldRs + imp.ii)}</td><td className="pl-calc-cell mono">{pmPct(par.ipiImportacaoPct)}</td><td className="pl-calc-cell mono">{pmBrl(imp.ipi)}</td></tr>
          <tr><td>PIS (importação)</td><td className="pl-calc-cell mono">{pmBrl(imp.vmldRs)}</td><td className="pl-calc-cell mono">{pmPct(par.pisImportacaoPct)}</td><td className="pl-calc-cell mono">{pmBrl(imp.pis)}</td></tr>
          <tr><td>COFINS (importação)</td><td className="pl-calc-cell mono">{pmBrl(imp.vmldRs)}</td><td className="pl-calc-cell mono">{pmPct(par.cofinsImportacaoPct)}</td><td className="pl-calc-cell mono">{pmBrl(imp.cofins)}</td></tr>
          <tr><td>Outras despesas da base do ICMS (Siscomex + AFRMM + outras)</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.outrasBaseIcms)}</td></tr>
          <tr><td>AFRMM (8% do frete marítimo, em R$)</td><td className="pl-calc-cell mono">{pmBrl(r.planilha.freteSeguroCapataziaUsdNaBase * (Number(baseInputs.txCambial) || 0))}</td><td className="pl-calc-cell mono">8,00%</td><td className="pl-calc-cell mono">{pmBrl(imp.afrmm)}</td></tr>
          <tr className="pl-total"><td>Total dos custos da nota antes do ICMS</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.totalAntesIcms)}</td></tr>
          <tr><td>ICMS (importação, por dentro)</td><td className="pl-calc-cell mono">{pmBrl(imp.bcIcms)}</td><td className="pl-calc-cell mono">{pmPct(par.icmsImportacaoPct)}</td><td className="pl-calc-cell mono">{pmBrl(imp.icms)}</td></tr>
          <tr className="pl-total"><td>Total da nota fiscal</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.totalNotaFiscal)}</td></tr>
          <tr><td>(−) Créditos de impostos aproveitados ({par.regimeTributario || 'Presumido'})</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.creditos)}</td></tr>
          <tr className="pl-total"><td>Custo para precificação</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.custoTotalMercadorias)}</td></tr>
          <tr><td>Custo por equipamento ({q})</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">—</td><td className="pl-calc-cell mono">{pmBrl(imp.custoPorEquipamento)}</td></tr>
        </PMTabela>
      )}

      {aba === 'despesas' && (
        <PMTabela colunas={['Despesa (só abate do lucro, não entra no preço)', 'Valor']}>
          <PMLinha rotulo="Despachante + desembaraço" valor={pmBrl(baseInputs.despachanteDesembaracoRs)}/>
          <PMLinha rotulo="Ad-valorem (0,1% do VMLD)" valor={pmBrl(imp.adValorem)}/>
          <PMLinha rotulo="Demurrage" valor={pmBrl(baseInputs.demurrageRs)}/>
          <PMLinha rotulo="Frete interno" valor={pmBrl(baseInputs.freteInternoRs)}/>
          <PMLinha rotulo="Armazenagem" valor={pmBrl(baseInputs.armazenagemRs)}/>
          {(baseInputs.itensInstalacaoMontagem || []).map((it, i) => (
            <PMLinha key={i} rotulo={`Instalação e montagem — ${it.descricao || 'item'}`} valor={pmBrl(it.valor)}/>
          ))}
          {(baseInputs.itensDespesasExtras || []).map((it, i) => (
            <PMLinha key={`x${i}`} rotulo={`Despesa extra — ${it.descricao || 'item'}`} valor={pmBrl(it.valor)}/>
          ))}
          <PMLinha rotulo="TOTAL das despesas" valor={pmBrl(imp.despesasInstalacaoMontagem)} forte/>
        </PMTabela>
      )}

      {aba === 'venda' && (
        <PMTabela colunas={['Item', 'Alíquota · Valor']}>
          <PMLinha rotulo="ICMS na venda" nota="sobre o preço de venda do produto" valor={`${pmPct(par.icmsVendaPct)}  ·  ${pmBrl(pv.custosIcmsVenda)}`}/>
          <PMLinha rotulo="IPI na venda" valor={`${pmPct(par.ipiVendaPct)}  ·  ${pmBrl(pv.custosIpiVenda)}`}/>
          <PMLinha rotulo="PIS na venda" nota="base = preço − ICMS" valor={`${pmPct(par.pisVendaPct, 3)}  ·  ${pmBrl(pv.custosPisVenda)}`}/>
          <PMLinha rotulo="COFINS na venda" nota="base = preço − ICMS" valor={`${pmPct(par.cofinsVendaPct)}  ·  ${pmBrl(pv.custosCofinsVenda)}`}/>
          <PMLinha rotulo="IRPJ" valor={`${pmPct(par.irpjVendaPct)}  ·  ${pmBrl(pv.custosIrpjVenda)}`}/>
          <PMLinha rotulo="CSLL" valor={`${pmPct(par.csllVendaPct, 3)}  ·  ${pmBrl(pv.custosCsllVenda)}`}/>
          <PMLinha rotulo="Crédito de ICMS da compra" valor={pmBrl(pv.creditoIcmsCompra)}/>
          <PMLinha rotulo="Crédito de IPI da compra" valor={pmBrl(pv.creditoIpiCompra)}/>
          <PMLinha rotulo="Crédito de PIS (1,65%) — só informativo no Presumido" valor={pmBrl(pv.creditoPisVenda)}/>
          <PMLinha rotulo="Crédito de COFINS (7,60%) — só informativo no Presumido" valor={pmBrl(pv.creditoCofinsVenda)}/>
          <PMLinha rotulo={`IMPOSTOS A PAGAR — PRODUTO (${pmPct(pv.impostosPagarProdutoPct, 3)} do preço, líquido de créditos)`} valor={pmBrl(pv.impostosPagarProdutoRs)} forte/>
          <PMLinha rotulo={`Impostos a pagar — serviços (${pmPct(par.impostosPagarServicosPct)} sobre a parte de serviços)`} valor={pmBrl(pv.impostosPagarServicosRs)}/>
        </PMTabela>
      )}

      {aba === 'preco' && (
        <PMTabela colunas={['Passo', 'Valor']}>
          <PMLinha rotulo="Custo para precificação (nota, sem créditos)" valor={pmBrl(imp.custoTotalMercadorias)}/>
          <PMLinha rotulo="Impostos da venda (soma das alíquotas)" valor={pmPct(pv.impostosPagarProdutoPct, 3)}/>
          <PMLinha rotulo="MARK-UP — margem sobre o preço de venda" valor={pmPct(pv.markUpPct)}/>
          <PMLinha rotulo="Divisor = 1 − impostos − mark-up" nota="o preço é o custo dividido por este número" valor={pmPct(pv.precoVendaPct, 3)}/>
          <PMLinha rotulo="PREÇO DE VENDA NA PROPOSTA" valor={pmBrl(pv.precoVendaProposta)} forte/>
          <PMLinha rotulo="Preço de venda — produto" valor={pmBrl(pv.precoVendaProduto)}/>
          <PMLinha rotulo="Preço de venda — serviços" valor={pmBrl(pv.precoVendaServicos)}/>
          <PMLinha rotulo="PREÇO DE VENDA POR EQUIPAMENTO (média)" valor={pmBrl(pv.precoVendaPorEquipamento)} forte/>
          <PMLinha rotulo="(−) Comissão diretoria/consultoria" valor={pmBrl(pv.comissaoConsultoriaRs)}/>
          <PMLinha rotulo="(−) Comissão do vendedor" valor={pmBrl(pv.comissaoVendedorRs)}/>
          <PMLinha rotulo="(−) Comissão de indicação" valor={pmBrl(pv.comissaoIndicacaoRs)}/>
          <PMLinha rotulo="TOTAL DE COMISSÕES" valor={pmBrl(pv.totalComissaoRs)} forte/>
          <PMLinha rotulo="(−) Despesas (aba 3)" valor={pmBrl(imp.despesasInstalacaoMontagem)}/>
          <PMLinha rotulo="(−) DIFAL" valor={pmBrl(pv.difalRs)}/>
          <PMLinha rotulo="LUCRO DA VENDA (já descontadas comissões, antes de IRPJ/CSLL adicionais)" valor={pmBrl(pv.lucroFinal)} forte/>
          <PMLinha rotulo="Percentual de lucro líquido (LL)" valor={pmPct(pv.margemEfetivaPct)} forte/>
          <PMLinha rotulo="Lucro por equipamento" valor={pmBrl(pv.lucroPorEquipamento)}/>
        </PMTabela>
      )}

      {aba === 'equipamentos' && (
        <div className="stack" style={{ gap: 16 }}>
          <div>
            <div className="pl-sub">Detalhamento por modelo (agrupado como o fornecedor cotou)</div>
            <PMTabela colunas={['Unidade', 'Modelo', 'Qtd', 'Valor unit. (US$)', 'Valor total (US$)', '%', 'Valor total (R$)', 'Valor unit. (R$)']}>
              {ratear.map((m, i) => (
                <tr key={m.unidadeId || i}>
                  <td>{m.identificador}</td>
                  <td>{m.modelo || '—'}</td>
                  <td className="pl-calc-cell mono">{m.quantidade}</td>
                  <td className="pl-calc-cell mono">{pmUsd(m.valorUnitarioUsd)}</td>
                  <td className="pl-calc-cell mono">{pmUsd(m.valorTotalUsd)}</td>
                  <td className="pl-calc-cell mono">{pmPct(m.percentual, 1)}</td>
                  <td className="pl-calc-cell mono">{pmBrl(m.valorTotalRs)}</td>
                  <td className="pl-calc-cell mono">{pmBrl(m.valorUnitarioRs)}</td>
                </tr>
              ))}
              <tr className="pl-total">
                <td>TOTAL</td><td/>
                <td className="pl-calc-cell mono">{ratear.reduce((s, m) => s + m.quantidade, 0)}</td><td/>
                <td className="pl-calc-cell mono">{pmUsd(ratear.reduce((s, m) => s + m.valorTotalUsd, 0))}</td>
                <td className="pl-calc-cell mono">100%</td>
                <td className="pl-calc-cell mono">{pmBrl(ratear.reduce((s, m) => s + m.valorTotalRs, 0))}</td><td/>
              </tr>
            </PMTabela>
          </div>
          <div>
            <div className="pl-sub">Cada equipamento separado (códigos corridos, da menor para a maior quantidade de paradas)</div>
            <PMTabela colunas={['Código', 'Modelo', 'Tração', 'Capacidade', 'Paradas', 'Mão de obra (R$)', 'Custo unit. (US$)', 'VLR Proposta (R$)', 'Lucro líquido (R$)']}>
              {fisicos.map((f, i) => {
                const g = porUnidade[f.unidadeId] || {};
                const liq = lucrosEq[i];
                return (
                  <tr key={f.identificador + i}>
                    <td style={{ fontWeight: 600 }}>{f.identificador}</td>
                    <td>{g.modelo || '—'}</td>
                    <td>{f.tracao || '—'}</td>
                    <td className="pl-calc-cell mono">{f.capacidadeKg != null ? `${f.capacidadeKg} kg` : '—'}</td>
                    <td className="pl-calc-cell mono">{f.paradas != null ? f.paradas : '—'}</td>
                    <td className="pl-calc-cell mono">{f.valorRs ? pmBrl(f.valorRs) : '—'}</td>
                    <td className="pl-calc-cell mono">{g.valorUnitarioUsd ? pmUsd(g.valorUnitarioUsd) : '—'}</td>
                    <td className="pl-calc-cell mono">{g.valorUnitarioRs ? pmBrl(g.valorUnitarioRs) : '—'}</td>
                    <td className="pl-calc-cell mono">{pmBrl(liq)}</td>
                  </tr>
                );
              })}
              <tr className="pl-total">
                <td>TOTAL ({fisicos.length} equipamentos)</td><td/><td/><td/><td/>
                <td className="pl-calc-cell mono">{pmBrl(fisicos.reduce((s, f) => s + (Number(f.valorRs) || 0), 0))}</td><td/>
                <td className="pl-calc-cell mono">{pmBrl(fisicos.reduce((s, f) => s + ((porUnidade[f.unidadeId] || {}).valorUnitarioRs || 0), 0))}</td>
                <td className="pl-calc-cell mono">{pmBrl(lucrosEq.reduce((s, v) => s + v, 0))}</td>
              </tr>
            </PMTabela>
          </div>
        </div>
      )}

      {aba === 'containers' && (
        <div className="stack" style={{ gap: 12 }}>
          <PMTabela colunas={['Tipo', 'Qtd', 'Preço do container (R$)', 'Capatazia (R$)', 'GRI (R$)', 'Total (R$)']}>
            {(baseInputs.containers || []).map((c, i) => {
              const qtd = Number(c.quantidade) || 0;
              const tot = qtd * ((Number(c.preco_rs) || 0) + (Number(c.capatazia_rs) || 0) + (Number(c.gri_rs) || 0));
              return (
                <tr key={i}>
                  <td>{c.tipo_tamanho || '—'}</td>
                  <td className="pl-calc-cell mono">{qtd}</td>
                  <td className="pl-calc-cell mono">{pmBrl(c.preco_rs)}</td>
                  <td className="pl-calc-cell mono">{pmBrl(c.capatazia_rs)}</td>
                  <td className="pl-calc-cell mono">{pmBrl(c.gri_rs)}</td>
                  <td className="pl-calc-cell mono">{pmBrl(tot)}</td>
                </tr>
              );
            })}
            <tr className="pl-total"><td>TOTAL em R$ → convertido para US$ pelo câmbio e somado ao CIF</td><td/><td/><td/><td/><td className="pl-calc-cell mono">{pmBrl(r.planilha.containersRs)}</td></tr>
          </PMTabela>
          <div className="pl-note">
            Em R$ → US$: {pmBrl(r.planilha.containersRs)} ÷ câmbio {(Number(baseInputs.txCambial) || 0).toFixed(4).replace('.', ',')} = <b>{pmUsd(r.planilha.containersUsd)}</b>, que entram no frete internacional (célula D8 da planilha)
            e, por isso, pagam II, PIS, COFINS, ICMS e AFRMM. O <b>frete interno</b> (Santos → obra) está em "Despesas Extras" e usa a tabela de Cadastros → Atualização de Custos → Frete interno.
          </div>
        </div>
      )}
    </Card>
  );
}

window.PZMemoriaCalculo = PZMemoriaCalculo;
