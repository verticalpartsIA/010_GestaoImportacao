/* ============================================================
   precificacao.jsx — Calculadora ao vivo + histórico de versões
   propostas.jsx — Wizard + Preview PDF
   ============================================================ */

/* Aba "Precificação" tem 2 modos: Elevadores (por Cotação Nº, fluxo real
   herdando o Formulário de Elevadores + resposta do fornecedor) e Outros
   projetos (calculadora antiga baseada em Leads/Análise Técnica — mantida
   como estava). */
function PrecificacaoModoTabs({ modo, setModo }) {
  return (
    <div className="seg">
      <button type="button" className={modo === 'elevador' ? 'is-active' : ''} onClick={() => setModo('elevador')}>Elevadores</button>
      <button type="button" className={modo === 'leads' ? 'is-active' : ''} onClick={() => setModo('leads')}>Outros projetos</button>
    </div>
  );
}

function PrecificacaoPage({ setRoute, setSubsel, subsel }) {
  const [modo, setModo] = React.useState('elevador');
  return modo === 'elevador'
    ? <window.PrecificacaoElevadorPage setRoute={setRoute} setSubsel={setSubsel} modo={modo} setModo={setModo} subsel={subsel}/>
    : <PrecificacaoLeadsPage setRoute={setRoute} setSubsel={setSubsel} modo={modo} setModo={setModo}/>;
}

function PrecificacaoLeadsPage({ setRoute, setSubsel, modo, setModo }) {
  const [projetos, setProjetos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErro(false);
        const sb = window.__VP_SB.sb;
        /* Não filtra mais por leads.status='Convertido' — desde 21/08 esse
           status só passa a existir depois que o cliente assina a Proposta
           (venda fechada), bem mais tarde do que "pronto pra calcular
           preço". O gate de verdade pra essa fila é ter Dossiê com Análise
           Técnica aprovada — igual já era antes de 'Convertido' existir. */
        const [{ data: leads, error: e1 }, { data: dossies, error: e2 }] = await Promise.all([
          sb.from('leads').select('id,building,contact,value'),
          sb.from('dossier_obra').select('id,lead_id'),
        ]);
        if (e1 || e2) throw (e1 || e2);
        const dossieIdPorLead = {};
        (dossies || []).forEach(d => { if (d.lead_id) dossieIdPorLead[d.lead_id] = d.id; });
        const withDossier = (leads || [])
          .map(l => ({ ...l, dossier_id: dossieIdPorLead[l.id] || null }))
          .filter(l => l.dossier_id);
        /* Status REAL derivado da Análise Técnica aprovada — precedente
           obrigatório da precificação (sem números inventados). */
        const dossierIds = withDossier.map(p => p.dossier_id).filter(Boolean);
        let aprovados = new Set();
        if (dossierIds.length) {
          const { data: analises } = await sb.from('analise_tecnica')
            .select('dossier_id,status').in('dossier_id', dossierIds).eq('status', 'aprovada');
          aprovados = new Set((analises || []).map(a => a.dossier_id));
        }
        const enriched = withDossier.map(p => ({ ...p, analiseAprovada: p.dossier_id ? aprovados.has(p.dossier_id) : false }));
        if (alive) { setProjetos(enriched); setLoading(false); }
      } catch (e) {
        if (alive) { setErro(true); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;
  if (erro) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--vp-danger)', fontSize:13 }}>Não foi possível carregar a precificação. Tente recarregar a página.</div>;

  const statusLabel = (p) => p.analiseAprovada ? 'Pronto para precificar' : (p.dossier_id ? 'Aguardando análise técnica' : 'Sem dossiê da obra');
  const items = projetos.map((p) => ({
    ...p,
    name: p.building || p.name,
    client: p.contact || p.client,
    status: statusLabel(p),
  }));

  const prontos = items.filter(i => i.analiseAprovada).length;
  const valorPipeline = items.reduce((s, p) => s + (p.value || 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Precificação</div>
          <h1 className="page-head__title">Precificação</h1>
          <p className="page-head__sub">Calcule preço final com FOB China + impostos + frete + margem. Acesso restrito a Comercial Sr. / Financeiro / Admin.</p>
        </div>
        <div className="page-head__r">
          <PrecificacaoModoTabs modo={modo} setModo={setModo}/>
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(items.map(i => ({ id:i.id, projeto:i.name, cliente:i.client, status:i.status, valor:i.value })), 'precificacao.csv')}>Exportar planilhas</Button>
          <Button variant="primary" icon="plus" onClick={() => setSelectedProject({})}>Nova precificação</Button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <KPI label="Projetos convertidos" value={items.length} sub="base para precificação" icon="calculator"/>
        <KPI label="Com análise aprovada" value={prontos} sub={items.length > 0 ? `${prontos}/${items.length} liberados` : "aguardando"} icon="check"/>
        <KPI label="Valor em pipeline" value={fmtBRL(valorPipeline)} sub="soma dos leads convertidos" icon="trending"/>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Projeto</th><th>Cliente</th>
            <th className="text-right">Valor</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum registro cadastrado.
              </td></tr>
            )}
            {items.map((p) => (
              <tr key={p.id}
                style={{ cursor:'pointer', background: selectedProject?.id === p.id ? 'var(--vp-gray-50)' : '' }}
                onClick={() => setSelectedProject(p)}>
                <td>
                  <div className="cell-main">{p.name}</div>
                  <div className="cell-sub">{p.id}</div>
                </td>
                <td>{p.client}</td>
                <td className="cell-money">{fmtBRL(p.value)}</td>
                <td><Badge variant={p.analiseAprovada ? "success" : "warning"} dot>{p.status}</Badge></td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProject !== null ? (
        <div style={{ marginTop: 20 }}>
          <PrecificacaoDetail project={selectedProject} setRoute={setRoute} setSubsel={setSubsel}/>
        </div>
      ) : items.length > 0 && (
        <div style={{ marginTop: 20, textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13, border:'1px dashed var(--border)' }}>
          Selecione um projeto acima para abrir a calculadora de precificação.
        </div>
      )}
    </div>
  );
}

function PrecificacaoDetail({ project = {}, setRoute, setSubsel }) {
  // Carregar análise técnica se existir
  const [analise, setAnalise] = React.useState(null);
  const [loading, setLoading] = React.useState(!!project.dossier_id);

  React.useEffect(() => {
    if (project.dossier_id && window.__ANALISE_TECNICA) {
      (async () => {
        try {
          const { data } = await window.__VP_SB.sb
            .from('analise_tecnica')
            .select('*')
            .eq('dossier_id', project.dossier_id)
            .single();
          if (data && data.status === 'aprovada') {
            setAnalise(data);
          }
        } catch (e) {
          // sem análise ainda
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [project.dossier_id]);

  // Live calculator state — COMs VALORES TÉCNICOS
  const [fobUSD, setFobUSD] = React.useState(0);
  const [usdRate, setUsdRate] = React.useState(5.20);
  const [freteUSD, setFreteUSD] = React.useState(0);
  const [seguroPct, setSeguroPct] = React.useState(1.2);
  const [iiPct, setIiPct] = React.useState(14);
  const [ipiPct, setIpiPct] = React.useState(8);
  const [pisCofinsPct, setPisCofinsPct] = React.useState(11.75);
  const [icmsPct, setIcmsPct] = React.useState(18);
  const [despAduana, setDespAduana] = React.useState(0);
  const [freteBR, setFreteBR] = React.useState(0);
  const [custMunck, setCustMunck] = React.useState(0);
  const [custAndaime, setCustAndaime] = React.useState(0);
  const [custVistorias, setCustVistorias] = React.useState(0);
  const [custInstalacao, setCustInstalacao] = React.useState(0);
  const [custSupervisor, setCustSupervisor] = React.useState(0);
  const [custHospedagem, setCustHospedagem] = React.useState(0);
  const [custRisco, setCustRisco] = React.useState(0);
  const [margemPct, setMargemPct] = React.useState(32);
  const [comissaoPct, setComissaoPct] = React.useState(4);

  // Se análise técnica existe, popula custos estimados automaticamente
  React.useEffect(() => {
    if (analise && analise.status === 'aprovada') {
      // Calcular custos baseados em variáveis técnicas
      const freteIntEstimado = analise.distancia_santos_km > 1000 ? 5000 :
                               analise.distancia_santos_km > 500 ? 3000 : 1000;
      setFreteBR(freteIntEstimado);

      if (analise.necessidade_munck === '1-munck') setCustMunck(8000);
      else if (analise.necessidade_munck === '2-munks') setCustMunck(16000);

      if (analise.necessidade_andaime && analise.responsavel_andaime === 'VerticalParts') {
        setCustAndaime(5000);
      }

      // Vistorias: 3 inclusas + cobrar as avulsas
      const vistoriasAvulsas = Math.max(0, analise.vistorias_inclusas - 3);
      setCustVistorias(vistoriasAvulsas * (analise.valor_vistoria_avulsa || 500));

      // Instalação: dias × valor/dia
      setCustInstalacao((analise.dias_instalacao_est || 5) * 1500);

      if (analise.necessidade_supervisor) {
        setCustSupervisor((analise.dias_instalacao_est || 5) * 800);
      }

      if (analise.hospedagem_necessaria) {
        setCustHospedagem((analise.dias_hospedagem_est || 3) * 250);
      }

      // Risco genérico (5% do custo técnico)
      setCustRisco(freteIntEstimado * 0.05);
    }
  }, [analise])

  // calc — INCLUINDO CUSTOS TÉCNICOS
  const fobBRL = fobUSD * usdRate;
  const freteIntBRL = freteUSD * usdRate;
  const seguroBRL = (fobBRL + freteIntBRL) * (seguroPct / 100);
  const cifBRL = fobBRL + freteIntBRL + seguroBRL;
  const iiBRL = cifBRL * (iiPct / 100);
  const ipiBRL = (cifBRL + iiBRL) * (ipiPct / 100);
  const pisCofinsBRL = (cifBRL + iiBRL + ipiBRL) * (pisCofinsPct / 100);
  const icmsBRL = (cifBRL + iiBRL + ipiBRL + pisCofinsBRL) * (icmsPct / 100);
  const totalImpostos = iiBRL + ipiBRL + pisCofinsBRL + icmsBRL;

  // Custos técnicos (engenharia/instalação)
  const totalCustosTecnicos = custMunck + custAndaime + custVistorias + custInstalacao + custSupervisor + custHospedagem + custRisco;

  // Custo TOTAL = CIF + Impostos + Despesas Locais + Custos Técnicos
  const custoTotal = cifBRL + totalImpostos + despAduana + freteBR + totalCustosTecnicos;
  const valorComMargem = custoTotal * (1 + margemPct / 100);
  const valorFinal = valorComMargem * (1 + comissaoPct / 100);
  const margemBRL = valorFinal - custoTotal;

  const versions = [
    { v: 1, when: "agora", who: "Você", change: "Rascunho inicial", value: valorFinal, current: true },
  ];

  if (loading) {
    return <Card title="Carregando…">
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)' }}>⏳ Buscando Análise Técnica…</div>
    </Card>;
  }

  if (project.dossier_id && !analise) {
    return <Card title="Análise Técnica necessária" sub="Preencha a análise técnica antes de precificar">
      <div style={{ padding: '20px', background: '#fff8e6', border: '1px solid #ff9900', borderRadius: '6px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>⚠️ Análise Técnica não aprovada</div>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Para precificar com base em variáveis técnicas, complete e aprove a Análise Técnica primeiro.</p>
        <Button style={{ marginTop: 12 }} variant="primary" size="sm" onClick={() => { setSubsel?.(project.dossier_id); setRoute?.('dossier-obra'); }}>Ir para Análise Técnica</Button>
      </div>
    </Card>;
  }

  return (
    <Card title={project.name ? `Cálculo: ${project.name}` : "Nova Precificação"} sub={project.id ? `Lead ${project.id}` : "Preencha os campos para calcular o preço final"}
      action={<>
        <Button variant="outline" size="sm" icon="history">Versões</Button>
        <Button variant="outline" size="sm" icon="copy">Duplicar</Button>
        <Button variant="primary" size="sm" icon="proposal" onClick={() => setRoute && setRoute("proposta-editor")}>Gerar proposta</Button>
      </>}
      sharp={true}>
      <div className="split--wide split">
        <div className="stack">
          <Section title="1 · FOB China (USD)" icon="globe">
            <div className="calc-row">
              <label>Total FOB cotação</label>
              <input className="input" type="number" value={fobUSD} onChange={(e) => setFobUSD(+e.target.value || 0)}/>
              <div className="total">{fmtUSD(fobUSD)}</div>
            </div>
            <div className="calc-row">
              <label>Câmbio USD → BRL</label>
              <input className="input" type="number" step="0.01" value={usdRate} onChange={(e) => setUsdRate(+e.target.value || 0)}/>
              <div className="total mono">R$ {usdRate.toFixed(2)}</div>
            </div>
            <div className="calc-row">
              <label>Frete internacional (USD)</label>
              <input className="input" type="number" value={freteUSD} onChange={(e) => setFreteUSD(+e.target.value || 0)}/>
              <div className="total">{fmtUSD(freteUSD)}</div>
            </div>
            <div className="calc-row">
              <label>Seguro internacional (%)</label>
              <input className="input" type="number" step="0.1" value={seguroPct} onChange={(e) => setSeguroPct(+e.target.value || 0)}/>
              <div className="total">{fmtBRL(seguroBRL)}</div>
            </div>
            <div className="calc-row" style={{ background: "var(--vp-gray-50)", padding: "12px 14px", margin: "8px -14px -8px", borderRadius: 0, borderBottom: "none" }}>
              <label style={{ fontWeight: 800, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" }}>= Valor CIF (BRL)</label>
              <div/>
              <div className="total" style={{ fontSize: 15 }}>{fmtBRL(cifBRL)}</div>
            </div>
          </Section>

          <Section title="2 · Impostos de importação" icon="scale">
            <ImpostoRow label="II — Imposto de Importação" pct={iiPct} setPct={setIiPct} valor={iiBRL}/>
            <ImpostoRow label="IPI" pct={ipiPct} setPct={setIpiPct} valor={ipiBRL}/>
            <ImpostoRow label="PIS+COFINS" pct={pisCofinsPct} setPct={setPisCofinsPct} valor={pisCofinsBRL}/>
            <ImpostoRow label="ICMS (SP)" pct={icmsPct} setPct={setIcmsPct} valor={icmsBRL}/>
            <div className="calc-row" style={{ background: "var(--vp-gray-50)", padding: "12px 14px", margin: "8px -14px -8px" }}>
              <label style={{ fontWeight: 800, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" }}>= Total impostos</label>
              <div/>
              <div className="total" style={{ fontSize: 15 }}>{fmtBRL(totalImpostos)}</div>
            </div>
          </Section>

          {analise && analise.status === 'aprovada' && (
            <Section title="3 · Custos de Engenharia & Instalação" icon="zap">
              {analise.necessidade_munck && (
                <div className="calc-row">
                  <label>Munck ({analise.necessidade_munck})</label>
                  <input className="input" type="number" value={custMunck} onChange={(e) => setCustMunck(+e.target.value || 0)}/>
                  <div className="total">{fmtBRL(custMunck)}</div>
                </div>
              )}
              {analise.necessidade_andaime && (
                <div className="calc-row">
                  <label>Andaime</label>
                  <input className="input" type="number" value={custAndaime} onChange={(e) => setCustAndaime(+e.target.value || 0)}/>
                  <div className="total">{fmtBRL(custAndaime)}</div>
                </div>
              )}
              <div className="calc-row">
                <label>Vistorias avulsas ({Math.max(0, analise.vistorias_inclusas - 3)})</label>
                <input className="input" type="number" value={custVistorias} onChange={(e) => setCustVistorias(+e.target.value || 0)}/>
                <div className="total">{fmtBRL(custVistorias)}</div>
              </div>
              <div className="calc-row">
                <label>Instalação ({analise.dias_instalacao_est} dias)</label>
                <input className="input" type="number" value={custInstalacao} onChange={(e) => setCustInstalacao(+e.target.value || 0)}/>
                <div className="total">{fmtBRL(custInstalacao)}</div>
              </div>
              {analise.necessidade_supervisor && (
                <div className="calc-row">
                  <label>Supervisor VerticalParts</label>
                  <input className="input" type="number" value={custSupervisor} onChange={(e) => setCustSupervisor(+e.target.value || 0)}/>
                  <div className="total">{fmtBRL(custSupervisor)}</div>
                </div>
              )}
              {analise.hospedagem_necessaria && (
                <div className="calc-row">
                  <label>Hospedagem equipe ({analise.dias_hospedagem_est} dias)</label>
                  <input className="input" type="number" value={custHospedagem} onChange={(e) => setCustHospedagem(+e.target.value || 0)}/>
                  <div className="total">{fmtBRL(custHospedagem)}</div>
                </div>
              )}
              <div className="calc-row">
                <label>Risco técnico</label>
                <input className="input" type="number" value={custRisco} onChange={(e) => setCustRisco(+e.target.value || 0)}/>
                <div className="total">{fmtBRL(custRisco)}</div>
              </div>
              <div className="calc-row" style={{ background: "var(--vp-gray-50)", padding: "12px 14px", margin: "8px -14px -8px" }}>
                <label style={{ fontWeight: 800, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" }}>= Subtotal Técnico</label>
                <div/>
                <div className="total" style={{ fontSize: 15 }}>{fmtBRL(totalCustosTecnicos)}</div>
              </div>
            </Section>
          )}

          <Section title="4 · Despesas locais" icon="truck">
            <div className="calc-row">
              <label>Despachante + taxas aduana</label>
              <input className="input" type="number" value={despAduana} onChange={(e) => setDespAduana(+e.target.value || 0)}/>
              <div className="total">{fmtBRL(despAduana)}</div>
            </div>
            <div className="calc-row">
              <label>Frete nacional CD → cliente</label>
              <input className="input" type="number" value={freteBR} onChange={(e) => setFreteBR(+e.target.value || 0)}/>
              <div className="total">{fmtBRL(freteBR)}</div>
            </div>
          </Section>

          <Section title="5 · Margem + comissão" icon="dollar">
            <div className="calc-row">
              <label>Margem comercial (%)</label>
              <input className="input" type="number" step="0.5" value={margemPct} onChange={(e) => setMargemPct(+e.target.value || 0)}/>
              <div className="total">{fmtBRL(valorComMargem - custoTotal)}</div>
            </div>
            <div className="calc-row">
              <label>Comissão vendedor (%)</label>
              <input className="input" type="number" step="0.5" value={comissaoPct} onChange={(e) => setComissaoPct(+e.target.value || 0)}/>
              <div className="total">{fmtBRL(valorFinal - valorComMargem)}</div>
            </div>
          </Section>
        </div>

        <div className="stack">
          <div className="calc-summary">
            <div className="up-eyebrow" style={{ color: "var(--vp-yellow)" }}>Resumo · v{versions[0]?.v ?? 1} (rascunho) {analise && '· COM ANÁLISE TÉCNICA'}</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, textTransform: "uppercase", margin: "8px 0 16px", color: "#fff" }}>Preço final ao cliente</h3>
            <div className="calc-summary__row"><span>CIF (Cost+Insur+Freight)</span><b>{fmtBRL(cifBRL)}</b></div>
            <div className="calc-summary__row"><span>Impostos</span><b>{fmtBRL(totalImpostos)}</b></div>
            <div className="calc-summary__row"><span>Despesas locais</span><b>{fmtBRL(despAduana + freteBR)}</b></div>
            {totalCustosTecnicos > 0 && (
              <div className="calc-summary__row"><span>Custos de Engenharia & Instalação</span><b>{fmtBRL(totalCustosTecnicos)}</b></div>
            )}
            <div className="calc-summary__row"><span>= Custo total</span><b>{fmtBRL(custoTotal)}</b></div>
            <div className="calc-summary__row"><span>+ Margem ({margemPct}%)</span><b>{fmtBRL(margemBRL - (valorFinal - valorComMargem))}</b></div>
            <div className="calc-summary__row"><span>+ Comissão ({comissaoPct}%)</span><b>{fmtBRL(valorFinal - valorComMargem)}</b></div>

            <div className="calc-summary__final">
              <div className="calc-summary__final-lbl">Preço final BRL</div>
              <div className="calc-summary__final-val">{fmtBRL(valorFinal)}</div>
              <div className="row sb" style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,.6)", fontFamily: "var(--font-mono)" }}>
                <span>Margem efetiva: <b style={{ color: "#fff" }}>{valorFinal > 0 ? (margemBRL / valorFinal * 100).toFixed(1) : '—'}%</b></span>
                <span>Câmbio: <b style={{ color: "#fff" }}>R$ {usdRate.toFixed(2)}</b></span>
              </div>
            </div>
          </div>

          <Card title="Histórico de Versões" sub={`${versions.length} alterações`} sharp={true}>
            <div className="stack" style={{ gap: 0 }}>
              {versions.map((v) => (
                <div key={v.v} className="version-row" style={{
                  display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: v.current ? "#FFFBE6" : "transparent",
                  margin: v.current ? "0 -14px" : "0",
                  paddingLeft: v.current ? 14 : 0,
                  paddingRight: v.current ? 14 : 0,
                }}>
                  <div style={{ width: 28, height: 28, background: v.current ? "#000" : "var(--vp-gray-100)", color: v.current ? "var(--vp-yellow)" : "var(--fg2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11 }}>v{v.v}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--fg1)", fontWeight: 500 }}>{v.change}</div>
                    <div className="cell-sub">{v.who} · {v.when}</div>
                  </div>
                  <div className="cell-money mono" style={{ fontSize: 12 }}>{fmtBRL(v.value)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Card>
  );
}

function Section({ title, icon, children }) {
  const I = Icon[icon] || Icon.bolt;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", padding: "14px 14px 6px" }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, background: "#000", color: "var(--vp-yellow)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I size={14}/>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".02em" }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function ImpostoRow({ label, pct, setPct, valor }) {
  return (
    <div className="calc-row">
      <label>{label}</label>
      <input className="input" type="number" step="0.5" value={pct} onChange={(e) => setPct(+e.target.value || 0)}/>
      <div className="total">{fmtBRL(valor)}</div>
    </div>
  );
}

/* ---------- PROPOSTAS ---------- */
/* Mesmo padrão do Controle de Cotações: tabela única, filtro por status +
   busca, clique na linha abre a proposta — sem coluna lateral. */
function PropostasPage({ setRoute, setSubsel }) {
  const [rows, setRows] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fStatus, setFStatus] = React.useState('Todos');
  const [prontas, setProntas] = React.useState([]);
  const [escopo, setEscopo] = React.useState(null);
  const [podeExcluir, setPodeExcluir] = React.useState(false);
  const [excluindoId, setExcluindoId] = React.useState(null);

  // Escopo de visibilidade (Configurações do Sistema › Permissões) — resolve
  // antes de carregar, pra montar a query já filtrada por vendedor_id em vez
  // de buscar tudo e esconder na tela (dado sensível não deve nem sair do banco).
  React.useEffect(() => { window.PropostaStore.resolverEscopoVisibilidade().then(setEscopo); }, []);
  React.useEffect(() => { window.PropostaStore.temCapacidade('propostas', 'excluir').then(setPodeExcluir); }, []);

  /* Não traz data_json aqui — é só pra abrir UMA proposta específica no
     editor, não pra listar. Nas 307 migradas do site antigo (18/08) esse
     campo tem até ~34KB cada; buscar pra todas as linhas só pra montar a
     tabela deixava a lista lenta à toa (achado ao vivo, mesmo dia da
     migração). */
  const carregar = React.useCallback(() => {
    if (!escopo) return;
    let q = window.__VP_SB.sb.from('propostas')
      .select('id, numero_documento, titulo, status, valor_total, master_id, numero_cotacao, proposal_type, criado_em, revisao_texto, clientes(razao_social, cnpj), perfis(nome, email)');
    if (!escopo.veTudo && escopo.vendedorId) q = q.eq('vendedor_id', escopo.vendedorId);
    q.order('criado_em', { ascending: false }).limit(300)
      .then(({ data }) => setRows(data || []));
  }, [escopo]);
  React.useEffect(() => { carregar(); }, [carregar]);

  /* "Prontas para enviar" — Precificação terminou o cálculo, mas quem
     decide analisar e enviar é o Comercial, não o Financeiro. Lista toda
     precificação calculada OU já aprovada (status 'finalizado' — "aprovada"
     não é menos pronta que "calculada", é mais; antes o filtro só pegava
     'calculado' e o item sumia daqui bem no momento em que devia estar mais
     pronto pra virar proposta — achado da revisão de arquitetura de 18/08)
     cujo Nº da Cotação ainda não tem proposta. */
  const carregarProntas = React.useCallback(async () => {
    const { data: pz } = await window.__VP_SB.sb.from('precificacoes_elevador')
      .select('id, numero_documento, numero_cotacao').in('status', ['calculado', 'finalizado'])
      .order('numero_cotacao', { ascending: false });
    const { data: props } = await window.__VP_SB.sb.from('propostas').select('numero_cotacao').not('numero_cotacao', 'is', null);
    const jaTemProposta = new Set((props || []).map((p) => p.numero_cotacao));
    setProntas((pz || []).filter((p) => p.numero_cotacao != null && !jaTemProposta.has(p.numero_cotacao)));
  }, []);
  React.useEffect(() => { carregarProntas(); }, [carregarProntas]);

  /* Mesma engenharia da herança que o vendedor dispara pelo Nº da Cotação
     no editor — fonte única, pra não existirem duas regras divergentes de
     "de onde vêm os dados da proposta" (antes vivia em Precificação). */
  const abrirDaPrecificacao = async (pz) => {
    try {
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(pz.numero_cotacao);
      if (!r.encontrado) {
        window.toast?.('Não foi possível localizar o formulário desta cotação.', 'error');
        return;
      }
      /* Nº da Proposta pré-preenchido com o Master ID universal de ETAPA
         (VPPR-0950 — mesmo número da cotação, prefixo da Proposta), não um
         rótulo inventado. Vendedor pode editar, mas o padrão precisa ser o
         código que todo mundo na empresa reconhece. */
      const numero = pz.numero_cotacao != null ? window.MasterIdEngine.etapaId('proposta', pz.numero_cotacao) : (pz.numero_documento || '');
      const prefill = { ...r.prefill, numero };
      setSubsel(prefill);
      setRoute('proposta-editor');
    } catch (e) {
      window.toast?.('Erro ao preparar a proposta: ' + e.message, 'error');
    }
  };

  const statusDisponiveis = React.useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.status).filter(Boolean))];
  }, [rows]);

  const EQUIPAMENTO_LABEL = { elevador: 'Elevador', escada: 'Escada Rolante', esteira: 'Esteira Rolante' };

  const filtradas = React.useMemo(() => {
    if (!rows) return [];
    const termo = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== 'Todos' && r.status !== fStatus) return false;
      if (!termo) return true;
      // Código, cliente, CNPJ, equipamento, Nº da cotação e vendedor — o
      // vendedor é o mais pedido: puxa TODAS as propostas daquele vendedor
      // (nome ou email) numa busca só, sem precisar de filtro separado.
      return [
        r.numero_documento, r.titulo, r.master_id,
        r.clientes?.razao_social, r.clientes?.cnpj,
        EQUIPAMENTO_LABEL[r.proposal_type] || r.proposal_type,
        r.numero_cotacao != null ? String(r.numero_cotacao) : null,
        r.perfis?.nome, r.perfis?.email,
      ].some((v) => (v || '').toString().toLowerCase().includes(termo));
    });
  }, [rows, busca, fStatus]);

  // Só soma propostas com numero_documento — um rascunho sem número ainda
  // não é um compromisso comercial identificável, e dados de demonstração
  // legados (sem numero_documento, valores de centenas de milhões) já
  // infl(aram o "potencial" pra R$ 6741.1M no reteste E2E. Limpamos as 203
  // linhas de demo do banco; este filtro é a rede de segurança pra não
  // repetir se sobrar/entrar lixo parecido de novo.
  const propostasIdentificadas = (rows || []).filter((p) => p.numero_documento);
  const totalValor = propostasIdentificadas.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const fmtValorTotal = propostasIdentificadas.length > 0
    ? (totalValor >= 1e6 ? `R$ ${(totalValor / 1e6).toFixed(1)}M` : fmtBRL(totalValor))
    : '—';
  const comMasterId = (rows || []).filter((p) => p.master_id).length;

  const abrirNova = () => { setSubsel && setSubsel(null); setRoute("proposta-editor"); };
  const abrirExistente = (p) => { setSubsel && setSubsel({ __editId: p.id }); setRoute("proposta-editor"); };

  const excluirProposta = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir a proposta ${p.numero_documento || p.titulo}? Isso apaga de vez, sem volta.`)) return;
    setExcluindoId(p.id);
    try {
      await window.PropostaStore.excluir(p.id);
      window.toast?.('Proposta excluída.', 'success');
      setRows((prev) => (prev || []).filter((r) => r.id !== p.id));
    } catch (err) {
      window.toast?.('Erro ao excluir: ' + (err.message || err), 'error');
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Propostas</div>
          <h1 className="page-head__title">Propostas Comerciais</h1>
          <p className="page-head__sub">Clique numa proposta pra abrir — herda dados do Formulário + valores da Precificação (Master ID).</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload((rows || []).map(p => ({ id:p.id, numero_documento:p.numero_documento, titulo:p.titulo, status:p.status, master_id:p.master_id, valor_total:p.valor_total, criado_em:p.criado_em })), 'propostas.csv')}>Exportar pacote</Button>
          <Button variant="primary" icon="plus" onClick={abrirNova}>Nova proposta</Button>
        </div>
      </div>

      {prontas.length > 0 && (
        <Card title="Prontas para enviar" sub={`${prontas.length} precificação(ões) aguardando análise e envio`} style={{ marginBottom: 20 }}>
          <div className="stack" style={{ gap: 8 }}>
            {prontas.map((pz) => (
              <div key={pz.id} className="row sb" style={{ padding: '10px 14px', background: 'var(--vp-warning-tint)' }}>
                <div>
                  <b>{window.MasterIdEngine.etapaId('cotacao', pz.numero_cotacao)}</b> precificado — analise e envie a proposta
                  <div className="muted small">{pz.numero_documento}</div>
                </div>
                <Button variant="primary" size="sm" icon="proposal" onClick={() => abrirDaPrecificacao(pz)}>Analisar e enviar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows && rows.some((p) => p.status === 'revisao_solicitada') && (
        <Card title="Pedidos de revisão" sub="cliente leu e pediu ajuste — analise, edite e reenvie" style={{ marginBottom: 20 }}>
          <div className="stack" style={{ gap: 8 }}>
            {rows.filter((p) => p.status === 'revisao_solicitada').map((p) => (
              <div key={p.id} className="row sb" style={{ padding: '10px 14px', background: 'var(--vp-warning-tint)' }}>
                <div>
                  <b>{p.numero_documento || p.titulo}</b>
                  <div className="muted small">"{p.revisao_texto}"</div>
                </div>
                <Button variant="primary" size="sm" icon="edit" onClick={() => abrirExistente(p)}>Analisar e reenviar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Propostas" value={rows ? rows.length : '…'} sub="total cadastrado" icon="proposal"/>
        <KPI label="Valor proposto" value={fmtValorTotal} sub="potencial" icon="dollar"/>
        <KPI label="Com Master ID" value={comMasterId} sub="rastreáveis à Precificação" icon="grid"/>
        <KPI label="Aprovadas" value={(rows || []).filter((p) => p.status === 'aprovada').length} sub="fecharam negócio" icon="check"/>
      </div>

      <div className="tbar">
        <div className="seg">
          {['Todos'].concat(statusDisponiveis).map((s) => (
            <button key={s} className={fStatus === s ? 'is-active' : ''} onClick={() => setFStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="spacer"/>
        <div className="search">
          <Icon.search size={12} color="var(--fg3)"/>
          <input placeholder="Buscar por código, cliente, CNPJ, equipamento, cotação ou vendedor…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table className="t la-table">
          <thead><tr>
            <th>Nº Documento</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Master ID</th>
            <th className="text-right">Valor</th>
            <th>Status</th>
            <th>Data</th>
            {podeExcluir && <th></th>}
          </tr></thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={99}><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)' }}>Carregando…</div></td></tr>
            )}
            {rows !== null && filtradas.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhuma proposta encontrada</h4><p>Nada encontrado com os filtros atuais.</p></div></td></tr>
            )}
            {filtradas.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => abrirExistente(p)}>
                <td><span className="mono small">{p.numero_documento || '—'}</span></td>
                <td style={{ fontSize: 12.5 }}>{p.clientes?.razao_social || p.titulo || <span className="muted">—</span>}</td>
                <td style={{ fontSize: 12.5 }}>{p.perfis?.nome || <span className="muted">—</span>}</td>
                <td><span className="mono small">{p.master_id || <span className="muted">—</span>}</span></td>
                <td className="cell-money">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</td>
                <td><StatusBadge status={p.status || 'rascunho'}/></td>
                <td><span className="mono small" style={{ whiteSpace: 'nowrap' }}>{p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}</span></td>
                {podeExcluir && (
                  <td>
                    <Button variant="ghost" size="sm" icon="trash" disabled={excluindoId === p.id}
                      title="Excluir proposta" onClick={(e) => excluirProposta(p, e)}/>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { PrecificacaoPage, PropostasPage });
