/* ============================================================
   precificacao.jsx — Calculadora ao vivo + histórico de versões
   propostas.jsx — Wizard + Preview PDF
   ============================================================ */

function PrecificacaoPage({ setRoute }) {
  const [projetos, setProjetos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedProject, setSelectedProject] = React.useState(null);

  React.useEffect(() => {
    // Busca clientes convertidos como base de precificação
    window.__VP_SB.sb.from('leads').select('id,building,contact,value').eq('status', 'Convertido')
      .then(({ data }) => { setProjetos(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const statusArr = ["Em cálculo", "Versão final", "Aprovada", "Em cálculo", "Aprovada"];
  const margemArr = [32, 28, 35, 38, 31];
  const versionsArr = [4, 7, 3, 1, 5];
  const items = projetos.map((p, idx) => ({
    ...p,
    name: p.building || p.name,
    client: p.contact || p.client,
    status: statusArr[idx % statusArr.length],
    margem: margemArr[idx % margemArr.length],
    versions: versionsArr[idx % versionsArr.length],
  }));

  const margemMedia = items.length > 0
    ? (items.reduce((s, p) => s + p.margem, 0) / items.length).toFixed(1)
    : '—';
  const totalVersoes = items.reduce((s, p) => s + p.versions, 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Precificação</div>
          <h1 className="page-head__title">Precificação</h1>
          <p className="page-head__sub">Calcule preço final com FOB China + impostos + frete + margem. Acesso restrito a Comercial Sr. / Financeiro / Admin.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(items.map(i => ({ id:i.id, projeto:i.name, cliente:i.client, status:i.status, margem_pct:i.margem, versoes:i.versions, valor:i.value })), 'precificacao.csv')}>Exportar planilhas</Button>
          <Button variant="primary" icon="plus" onClick={() => setSelectedProject({})}>Nova precificação</Button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <KPI label="Margem média" value={margemMedia} unit={items.length > 0 ? "%" : ""} sub="projetos convertidos" icon="trending"/>
        <KPI label="Cálculos abertos" value={items.length} sub="ativos" icon="calculator"/>
        <KPI label="Versões geradas" value={totalVersoes} sub={items.length > 0 ? `média ${(totalVersoes/items.length).toFixed(1)}/projeto` : "aguardando dados"} icon="history"/>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Projeto</th><th>Cliente</th><th>Versões</th>
            <th className="text-right">Valor final</th><th className="text-right">Margem</th>
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
                <td><span className="cell-num">v{p.versions}</span></td>
                <td className="cell-money">{fmtBRL(p.value)}</td>
                <td className="cell-money" style={{ color: p.margem >= 32 ? "var(--vp-success)" : "var(--vp-warning-ink)" }}>{p.margem}%</td>
                <td><StatusBadge status={p.status === "Em cálculo" ? "Em análise" : p.status === "Versão final" ? "Recebida" : "Aprovada"}/></td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProject !== null ? (
        <div style={{ marginTop: 20 }}>
          <PrecificacaoDetail project={selectedProject} setRoute={setRoute}/>
        </div>
      ) : items.length > 0 && (
        <div style={{ marginTop: 20, textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13, border:'1px dashed var(--border)' }}>
          Selecione um projeto acima para abrir a calculadora de precificação.
        </div>
      )}
    </div>
  );
}

function PrecificacaoDetail({ project = {}, setRoute }) {
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
        <Button style={{ marginTop: 12 }} variant="primary" size="sm">Ir para Análise Técnica</Button>
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

/* ---------- PROPOSTAS (Wizard + PDF preview) ---------- */
function PropostasPage({ setRoute }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.__VP_SB.sb.from('cotacoes').select('*').order('date', { ascending: false })
      .then(({ data }) => { setList(data || []); setLoading(false); });
  }, []);

  const totalValor = list.reduce((s, p) => s + (p.total || 0), 0);
  const fmtValorTotal = list.length > 0
    ? (totalValor >= 1e6 ? `R$ ${(totalValor / 1e6).toFixed(1)}M` : fmtBRL(totalValor))
    : '—';

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Propostas</div>
          <h1 className="page-head__title">Propostas Comerciais</h1>
          <p className="page-head__sub">Wizard de 5 etapas · gera PDF + envia para assinatura digital · vincula contrato jurídico</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(list.map(p => ({ id:p.id, building:p.building, supplier:p.supplier, status:p.status, data:p.date, total_usd:p.total })), 'propostas.csv')}>Exportar pacote</Button>
          <Button variant="primary" icon="plus" onClick={() => setRoute("proposta-editor")}>Nova proposta</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Propostas no ar" value={list.length} sub="aguardando cliente" icon="proposal"/>
        <KPI label="Valor proposto" value={fmtValorTotal} sub="potencial" icon="dollar"/>
        <KPI label="Conversão proposta" value="—" sub="sem dados suficientes" icon="trending"/>
        <KPI label="Tempo médio aprovação" value="—" sub="sem dados suficientes" icon="clock"/>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <Card title="Propostas em andamento" sub={`${list.length} registros`} action={<Button variant="ghost" size="sm" icon="filter"/>}>
          <div className="stack" style={{ gap: 12 }}>
            {loading && <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>}
            {!loading && list.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhuma proposta cadastrada.
              </div>
            )}
            {list.map((p) => (
              <div key={p.id} className="card" style={{ padding: 14, cursor: "pointer" }} onClick={() => setRoute("proposta-editor")}>
                <div className="row sb">
                  <div>
                    <div className="cell-main" style={{ fontSize: 14 }}>{p.origin || p.id}</div>
                    <div className="cell-sub">{p.id} · {p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '—'}</div>
                  </div>
                  <StatusBadge status={p.status || "Em andamento"}/>
                </div>
                <div className="row sb" style={{ marginTop: 10 }}>
                  <div className="cell-money mono" style={{ fontSize: 16, fontWeight: 700 }}>{p.total ? fmtUSD(p.total) : '—'}</div>
                  <Button variant="ghost" size="sm" iconRight="arrowRight">Editar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Acesso Rápido" sub="abra o editor com um clique" sharp
          action={<Button variant="primary" size="sm" icon="plus" onClick={() => setRoute("proposta-editor")}>Nova proposta</Button>}>
          <div className="stack" style={{ gap: 10 }}>
            <div onClick={() => setRoute("proposta-editor")} style={{ padding: 18, background: "#000", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
              <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>
              <Icon.proposal size={28} color="var(--vp-yellow)"/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>Abrir Editor de Proposta</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", fontFamily: "var(--font-mono)", marginTop: 2, letterSpacing: ".04em" }}>3 abas · Elevador · Escada · Esteira · Preview ao vivo</div>
              </div>
              <Icon.arrowRight color="var(--vp-yellow)"/>
            </div>

            <div className="grid-3" style={{ gap: 8 }}>
              <div onClick={() => setRoute("proposta-editor")} style={{ padding: 12, background: "#fff", border: "1px solid var(--border)", cursor: "pointer", textAlign: "center", aspectRatio: "0.72", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                <img src="assets/capa-elevador.png" style={{ width: "100%", aspectRatio: "0.72", objectFit: "cover", objectPosition: "top", marginTop: -12, marginLeft: -12, marginRight: -12, width: "calc(100% + 24px)" }}/>
                <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", background: "rgba(255,255,255,.92)", padding: "4px 6px" }}>Elevador</div>
              </div>
              <div onClick={() => setRoute("proposta-editor")} style={{ padding: 12, background: "#fff", border: "1px solid var(--border)", cursor: "pointer", textAlign: "center", aspectRatio: "0.72", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                <img src="assets/capa-escada-rolante.png" style={{ width: "100%", aspectRatio: "0.72", objectFit: "cover", objectPosition: "top", marginTop: -12, marginLeft: -12, marginRight: -12, width: "calc(100% + 24px)" }}/>
                <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", background: "rgba(255,255,255,.92)", padding: "4px 6px" }}>Escada</div>
              </div>
              <div onClick={() => setRoute("proposta-editor")} style={{ padding: 12, background: "#fff", border: "1px solid var(--border)", cursor: "pointer", textAlign: "center", aspectRatio: "0.72", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                <img src="assets/capa-esteira-rolante.png" style={{ width: "100%", aspectRatio: "0.72", objectFit: "cover", objectPosition: "top", marginTop: -12, marginLeft: -12, marginRight: -12, width: "calc(100% + 24px)" }}/>
                <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", background: "rgba(255,255,255,.92)", padding: "4px 6px" }}>Esteira</div>
              </div>
            </div>

            <p className="small muted" style={{ marginTop: 6 }}>O editor é a forma recomendada de criar/editar propostas. O wizard antigo abaixo é apenas demonstrativo.</p>
          </div>
        </Card>
      </div>

      <Card title="Editor de Proposta — Demonstrativo" sub="exemplo do wizard de 5 etapas"
        style={{ marginTop: 20 }}
        action={<Button variant="primary" size="sm" iconRight="arrowRight" onClick={() => setRoute("proposta-editor")}>Abrir editor completo</Button>}>
        <PropostaWizard/>
      </Card>
    </div>
  );
}

function PropostaWizard() {
  const steps = ["Identificação", "Escopo", "Comercial", "Termos", "Revisão"];
  const [step, setStep] = React.useState(2); // 0-indexed → "Comercial"
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 0, marginBottom: 18 }}>
        {steps.map((s, i) => (
          <div key={s} onClick={() => setStep(i)} style={{
            padding: "10px 8px",
            background: i === step ? "#000" : i < step ? "var(--vp-yellow)" : "var(--vp-gray-100)",
            color: i === step ? "var(--vp-yellow)" : i < step ? "#000" : "var(--fg3)",
            fontSize: 10, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase",
            textAlign: "center", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            borderRight: i === steps.length - 1 ? "none" : "2px solid #fff",
          }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{i + 1}</span>
            <span>{s}</span>
            {i < step ? <Icon.check size={12}/> : null}
          </div>
        ))}
      </div>

      <div style={{ background: "var(--vp-gray-50)", padding: 14, marginBottom: 14 }}>
        <div className="up-eyebrow muted">Etapa atual</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, textTransform: "uppercase", marginTop: 4 }}>3 · Condições Comerciais</div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="grid-2">
          <div className="field"><label>Valor total</label><input className="input" defaultValue="R$ 1.840.000,00" readOnly/></div>
          <div className="field"><label>Forma de pagamento</label>
            <select className="input">
              <option>30% entrada · 50% embarque · 20% instalação</option>
              <option>50% entrada · 50% entrega</option>
              <option>À vista (5% desconto)</option>
            </select>
          </div>
        </div>
        <div className="grid-3">
          <div className="field"><label>Validade</label><input className="input" defaultValue="30 dias"/></div>
          <div className="field"><label>Prazo entrega</label><input className="input" defaultValue="120 dias"/></div>
          <div className="field"><label>Prazo instalação</label><input className="input" defaultValue="45 dias"/></div>
        </div>
        <div className="field"><label>Garantia</label><input className="input" defaultValue="24 meses contra defeitos de fabricação · 12 meses serviço"/></div>
        <div className="field"><label>Observações comerciais</label>
          <textarea className="input" rows={3} defaultValue="Frete CIF Santos incluso. Instalação por equipe própria certificada. Treinamento operacional para equipe de manutenção do hospital incluído."/>
        </div>
      </div>

      <div className="row sb" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <Button variant="outline" size="sm" icon="chevLeft" onClick={() => setStep(Math.max(0, step - 1))}>Voltar</Button>
        <div className="row gap-2">
          <Button variant="ghost" size="sm" icon="eye">Preview PDF</Button>
          <Button variant="ghost" size="sm" icon="download">Salvar rascunho</Button>
          <Button variant="primary" size="sm" iconRight="arrowRight" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Próxima etapa</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PrecificacaoPage, PropostasPage });
