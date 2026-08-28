/* ============================================================
   precificacao-elevador.jsx
   Precificação de Elevador (ADM/Financeiro) — herda o Cotação Nº do
   Formulário de Elevadores e os custos já respondidos pelo fornecedor,
   calcula o preço de venda (PrecificacaoElevadorEngine) e o DIFAL
   (DifalEngine). Lista as cotações respondidas + tela de cálculo.
   ============================================================ */

function fmtBRL2(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtPct2(v) { return ((Number(v) || 0) * 100).toFixed(2) + '%'; }

function PZField({ label, children, span }) {
  return (
    <div className="stack" style={{ gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label className="up-eyebrow muted">{label}</label>
      {children}
    </div>
  );
}
function PZInput({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input className="input" type={type} value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder} disabled={disabled}/>
  );
}
/* Todo campo "(%)" nesta tela guarda fração (0,175) por baixo — é o
   formato que o motor de cálculo e o banco sempre usaram (ver
   precificacao-elevador-engine.js e o teste de regressão em
   precificacao-elevador-engine.test.js). Mas digitar fração manualmente
   não é como humano pensa em porcentagem, e digitar "22" pensando em
   22% sem perceber que precisava ser "0,22" zerava o preço de venda em
   silêncio (achado real, sessão 27/08 — ver validarAntesDeCalcular/
   markUpForaFaixa mais abaixo). Este input mostra/recebe ponto
   percentual (17,5 = 17,5%) e converte pra fração só na borda — value/
   onChange continuam em fração pro resto do código nem perceber.
   round() evita cauda de ponto flutuante (0.175*100 → 17.499999999999996
   em alguns casos) sem cortar a precisão que essa tela realmente usa. */
function round(n, decimais) { const f = Math.pow(10, decimais); return Math.round(n * f) / f; }
function PZPercentInput({ value, onChange, disabled, placeholder }) {
  const display = value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? '' : round(Number(value) * 100, 4);
  return (
    <input className="input" type="number" step="0.01" value={display}
      onChange={(e) => onChange(e.target.value === '' ? '' : round(Number(e.target.value) / 100, 6))}
      placeholder={placeholder} disabled={disabled}/>
  );
}
/* Todo campo de "Preço"/valor monetário precisa mostrar o formato da
   própria moeda. BRL usa vírgula decimal + ponto de milhar (R$ 1.234,56,
   padrão brasileiro). USD (pedido explícito do usuário, 28/08: só o
   ponto decimal, sem separador de milhar — "vírgula e ponto não existe")
   usa só ponto decimal e nada mais: US$ 33580.00, não US$ 33,580.00. Em
   vez do número cru que <input type="number"> força (nunca mostra
   símbolo nem 2 casas fixas). Foco = edição crua (facilita apagar/
   digitar); blur = reformata. `value`/onChange continuam número puro
   por baixo (mesmo formato que motor de cálculo e banco sempre
   usaram) — só a exibição muda, igual PZPercentInput fez pra "%".
   window.parseMoeda (utils.js) já é tolerante a "," ou "." como
   decimal, então aceita o que o financeiro digitar. */
function PZCurrencyInput({ value, onChange, moeda = 'BRL', disabled }) {
  const [editando, setEditando] = React.useState(false);
  const [bruto, setBruto] = React.useState('');
  const prefixo = moeda === 'USD' ? 'US$' : 'R$';
  const formatado = moeda === 'USD'
    ? (Number(value) || 0).toFixed(2)
    : (Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', fontSize: 13, pointerEvents: 'none' }}>{prefixo}</span>
      <input className="input" style={{ paddingLeft: 38 }} type="text" inputMode="decimal"
        value={editando ? bruto : formatado}
        onFocus={() => { setBruto(value === '' || value === null || value === undefined ? '' : String(value).replace('.', moeda === 'USD' ? '.' : ',')); setEditando(true); }}
        onChange={(e) => setBruto(e.target.value)}
        onBlur={() => { setEditando(false); onChange(window.parseMoeda(bruto)); }}
        disabled={disabled}/>
    </div>
  );
}
function PZSelect({ value, onChange, options, placeholder }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || '—'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
// Mesmo vocabulário de tamanhos usado depois no embarque físico (ver
// EI_CONTAINER_TIPOS em embarques-importacao.jsx).
const PZ_CONTAINER_TIPOS = ["20'DV", "40'DV", "40'HC", "20'RF", "40'RF", "20'OT", "40'OT", "20'FR", "40'FR", 'Outro'];

/* ---------- Lista — cotações de fornecedor já respondidas ---------- */
function PrecificacaoElevadorPage({ setRoute, setSubsel, modo, setModo, subsel }) {
  const [pendentes, setPendentes] = React.useState(null);
  /* 23/08 (achado real, Gelson): clicar no nó "Financeiro precificando" da
     Cadeia de Gatilhos caía na lista genérica, não no documento da cotação.
     pzId agora pode nascer do subsel (id de precificacoes_elevador vindo
     do deep-link), não só do clique manual na lista. */
  const [pzId, setPzId] = React.useState(subsel && typeof subsel === 'string' ? subsel : null);

  const carregar = React.useCallback(() => {
    window.PrecificacaoElevadorStore.listarPendentes().then(setPendentes).catch(() => setPendentes([]));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const abrir = async (item) => {
    if (item.precificacaoId) { setPzId(item.precificacaoId); return; }
    try {
      const pz = await window.PrecificacaoElevadorStore.criar(item.formularioElevadorId, item.cotacaoFornecedorId);
      setPzId(pz.id);
    } catch (e) {
      window.toast?.('Erro ao abrir precificação: ' + e.message, 'error');
    }
  };

  if (pzId) {
    return <PrecificacaoElevadorDetalhe id={pzId} onVoltar={() => { setPzId(null); carregar(); }} setRoute={setRoute} setSubsel={setSubsel}/>;
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">Precificação — Equipamentos</h1>
          <p className="page-head__sub">Cotações já respondidas pelo fornecedor, ou formulários enviados direto (preço já combinado por fora) — prontas para calcular o preço de venda.</p>
        </div>
        <div className="page-head__r"><PrecificacaoModoTabs modo={modo} setModo={setModo}/></div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Cotação Nº</th><th>Cliente</th><th>Fornecedor</th><th>Respondido em</th><th>Decisão de compra</th><th>Precificação</th><th></th></tr></thead>
          <tbody>
            {pendentes === null && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</td></tr>
            )}
            {pendentes !== null && pendentes.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma cotação respondida nem formulário enviado direto ainda.</td></tr>
            )}
            {(pendentes || []).map((item) => (
              <tr key={item.cotacaoFornecedorId || ('direto-' + item.formularioElevadorId)} style={{ cursor: 'pointer' }} onClick={() => abrir(item)}>
                <td className="mono">{item.numeroCotacao ?? '—'}</td>
                <td>{item.clienteNome || '—'}</td>
                <td>{item.direto ? <span className="small" title="Preço combinado por fora — sem Cotação a Fornecedor">Direto (sem fornecedor)</span> : item.fornecedor}</td>
                <td>{item.respondedAt ? new Date(item.respondedAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td>{item.direto ? <span className="muted small">—</span> : <StatusBadge status={window.CotacaoElevadorFornecedorStore.statusGroupLabel(item.statusCotacao)}/>}</td>
                <td>{item.precificacaoStatus ? <StatusBadge status={item.precificacaoStatus === 'finalizado' ? 'Aprovada' : item.precificacaoStatus === 'calculado' ? 'Em análise' : 'Recebida'}/> : <span className="muted small">Não iniciada</span>}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Detalhe — motor de cálculo ---------- */
function PrecificacaoElevadorDetalhe({ id, onVoltar, setRoute, setSubsel }) {
  const [pz, setPz] = React.useState(null);
  const [calculando, setCalculando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [aprovando, setAprovando] = React.useState(false);
  const [mostrarParametros, setMostrarParametros] = React.useState(false);
  const [ressincronizando, setRessincronizando] = React.useState(false);
  const [atualizandoMo, setAtualizandoMo] = React.useState(false);
  // Câmbio USD/BRL ao vivo — só referência/comparação (ver cambio-api.js).
  // Não substitui tx_cambial sozinho; o Financeiro aplica clicando "Usar".
  const [cambioVivo, setCambioVivo] = React.useState(null); // null | { valor, timestamp } | 'erro'

  const carregar = React.useCallback(() => {
    window.PrecificacaoElevadorStore.obter(id).then(setPz);
  }, [id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    window.CambioAPI.buscarUsdBrl().then(setCambioVivo).catch(() => setCambioVivo('erro'));
  }, []);

  const ressincronizarDoFornecedor = async () => {
    setRessincronizando(true);
    try {
      await window.PrecificacaoElevadorStore.ressincronizarDoFornecedor(pz.id);
      await carregar();
      window.toast?.('Valores do fornecedor ressincronizados.', 'success');
    } catch (e) {
      window.toast?.('Erro ao ressincronizar: ' + e.message, 'error');
    } finally {
      setRessincronizando(false);
    }
  };

  const irParaFormulario = () => {
    if (!pz.formulario_elevador_id) return;
    setSubsel?.(pz.formulario_elevador_id);
    setRoute?.('formulario-elevador');
  };

  const atualizarMaoDeObra = async () => {
    setAtualizandoMo(true);
    try {
      await window.PrecificacaoElevadorStore.atualizarMaoDeObra(pz.id);
      await carregar();
      window.toast?.('Mão de obra recalculada a partir da tabela de referência.', 'success');
    } catch (e) {
      window.toast?.('Erro ao recalcular mão de obra: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  if (!pz) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const set = (k) => (v) => setPz((p) => ({ ...p, [k]: v }));
  const setParam = (k) => (v) => setPz((p) => ({ ...p, parametros_fiscais_snapshot: { ...p.parametros_fiscais_snapshot, [k]: v } }));
  const setModelo = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.modelos || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, modelos: arr };
  });

  const addItemInstalacao = () => setPz((p) => ({ ...p, itens_instalacao_montagem: [...(p.itens_instalacao_montagem || []), { descricao: '', valor: 0 }] }));
  const setItemInstalacao = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.itens_instalacao_montagem || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, itens_instalacao_montagem: arr };
  });
  const removeItemInstalacao = (i) => setPz((p) => ({ ...p, itens_instalacao_montagem: (p.itens_instalacao_montagem || []).filter((_, idx) => idx !== i) }));

  const addContainer = () => setPz((p) => ({ ...p, containers: [...(p.containers || []), { tipo_tamanho: '', quantidade: 1, preco_rs: 0 }] }));
  const setContainer = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.containers || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, containers: arr };
  });
  const removeContainer = (i) => setPz((p) => ({ ...p, containers: (p.containers || []).filter((_, idx) => idx !== i) }));
  const containersTotalRs = (pz.containers || []).reduce((s, c) => s + (Number(c.quantidade) || 0) * (Number(c.preco_rs) || 0), 0);

  const addItemExtra = () => setPz((p) => ({ ...p, itens_despesas_extras: [...(p.itens_despesas_extras || []), { descricao: '', valor: 0 }] }));
  const setItemExtra = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.itens_despesas_extras || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, itens_despesas_extras: arr };
  });
  const removeItemExtra = (i) => setPz((p) => ({ ...p, itens_despesas_extras: (p.itens_despesas_extras || []).filter((_, idx) => idx !== i) }));

  const payloadSalvar = () => ({
    vmle_usd: pz.vmle_usd, seguro_usd: pz.seguro_usd, frete_seguro_capatazia_usd: pz.frete_seguro_capatazia_usd,
    siscomex_rs: pz.siscomex_rs, tx_cambial: pz.tx_cambial, outras_despesas_importacao_rs: pz.outras_despesas_importacao_rs,
    despachante_desembaraco_rs: pz.despachante_desembaraco_rs, demurrage_rs: pz.demurrage_rs,
    frete_interno_rs: pz.frete_interno_rs, armazenagem_rs: pz.armazenagem_rs,
    itens_instalacao_montagem: pz.itens_instalacao_montagem, containers: pz.containers,
    itens_despesas_extras: pz.itens_despesas_extras, percentual_servicos: pz.percentual_servicos,
    modelos: pz.modelos, parametros_fiscais_snapshot: pz.parametros_fiscais_snapshot,
    mark_up_pct: pz.mark_up_pct, comissao_consultoria_pct: pz.comissao_consultoria_pct,
    comissao_vendedor_pct: pz.comissao_vendedor_pct, comissao_indicacao_pct: pz.comissao_indicacao_pct,
    modo_formacao_preco: pz.modo_formacao_preco, margem_desejada_pct: pz.margem_desejada_pct,
    contingencia_valor: pz.contingencia_valor, outros_custos_nao_recuperaveis_rs: pz.outros_custos_nao_recuperaveis_rs,
  });

  const salvar = async () => {
    setSalvando(true);
    try { await window.PrecificacaoElevadorStore.salvar(pz.id, payloadSalvar()); window.toast?.('Rascunho salvo.', 'success'); }
    catch (e) { window.toast?.('Erro ao salvar: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  /* Travas de sanidade — garante-lixo-em-garante-lixo-fora catastrófico.
     O câmbio (R$/US$) é o multiplicador de todo o custo importado; um valor
     fora da faixa real (ex.: 678,91 digitado no lugar de 5,50) explode a
     proposta pra dezenas de milhões sem nenhum aviso. */
  const CAMBIO_MIN = 1, CAMBIO_MAX = 20;
  const validarAntesDeCalcular = () => {
    const cambio = Number(pz.tx_cambial) || 0;
    if (cambio <= 0) { window.toast?.('Informe o Câmbio (R$/US$) antes de calcular.', 'warning'); return false; }
    if (cambio < CAMBIO_MIN || cambio > CAMBIO_MAX) {
      window.toast?.(`Câmbio ${cambio} fora da faixa esperada (${CAMBIO_MIN}–${CAMBIO_MAX} R$/US$). Verifique — parece que um valor de outro campo (taxa/frete) foi digitado no Câmbio.`, 'error');
      return false;
    }
    if ((Number(pz.vmle_usd) || 0) <= 0) { window.toast?.('VMLE (USD) precisa ser maior que zero.', 'warning'); return false; }
    /* Mark-up ≥ 100% é implausível pra esse negócio e sempre zera o preço
       de venda (K65_precoVendaPct = 1 - impostos - markUp fica ≤ 0) — fica
       como trava de sanidade mesmo com o campo já em ponto percentual
       (PZPercentInput), pra pegar dado antigo já salvo errado de antes
       dessa conversão, ou um "100" digitado por engano (achado real,
       sessão 27/08). */
    if (markUpForaFaixa) {
      window.toast?.(`Mark-up de ${fmtPct2(pz.mark_up_pct)} é implausível e zera o preço de venda calculado. Confira o valor.`, 'error');
      return false;
    }
    return true;
  };

  const calcular = async () => {
    if (!validarAntesDeCalcular()) return;
    setCalculando(true);
    try {
      await window.PrecificacaoElevadorStore.salvar(pz.id, payloadSalvar());
      await window.PrecificacaoElevadorStore.calcularEsalvar(pz.id);
      await carregar();
      window.toast?.('Cálculo atualizado.', 'success');
    } catch (e) {
      window.toast?.('Erro ao calcular: ' + e.message, 'error');
    } finally {
      setCalculando(false);
    }
  };

  const resultado = pz.resultado && pz.resultado.precificacao;
  const importacao = pz.resultado && pz.resultado.importacao;
  const resultadoV2 = pz.resultado_v2 && pz.resultado_v2.precificacao ? pz.resultado_v2 : null;
  const margemEfetivaV2Negativa = !!resultadoV2 && resultadoV2.precificacao.margemEfetivaPct < 0;
  const difal = pz.difal && pz.difal.mensagem ? pz.difal : null;
  const params = pz.parametros_fiscais_snapshot || {};
  const margemMinima = Number(params.margem_minima_pct) || 0;
  // V2 é o motor oficial (decisão 29/08) — a trava de aprovação usa a
  // margem dele; cai pro V1 só quando ainda não existe resultado_v2
  // (precificação nunca recalculada desde a migração).
  const margemOficialPct = pz.resultado_v2 && pz.resultado_v2.precificacao ? pz.resultado_v2.precificacao.margemEfetivaPct : (resultado ? resultado.margemFinalPct : null);
  const margemAbaixoMinima = margemOficialPct != null && margemOficialPct < margemMinima;
  const aprovado = pz.status === 'finalizado';

  const aprovar = async (forcar) => {
    setAprovando(true);
    try {
      await window.PrecificacaoElevadorStore.aprovar(pz.id, { forcarAbaixoMinima: forcar });
      await carregar();
      window.toast?.('Precificação aprovada.', 'success');
    } catch (e) {
      if (e.margemAbaixoMinima) {
        if (window.confirm(`${e.message}\n\nAprovar mesmo assim?`)) return aprovar(true);
      } else {
        window.toast?.('Erro ao aprovar: ' + e.message, 'error');
      }
    } finally {
      setAprovando(false);
    }
  };

  const cambioNum = Number(pz.tx_cambial) || 0;
  const cambioForaFaixa = cambioNum > 0 && (cambioNum < CAMBIO_MIN || cambioNum > CAMBIO_MAX);
  /* Mark-up ≥ 100% é implausível pra esse negócio e sempre zera o preço de
     venda (K65_precoVendaPct = 1 - impostos - markUp fica ≤ 0) — sintoma
     visível era "Margem final 0,00% abaixo da mínima", sem apontar a causa
     real (achado real, sessão 27/08). Todo campo "(%)" agora é digitado em
     ponto percentual (PZPercentInput), então isso só deveria disparar com
     dado antigo salvo de antes dessa mudança, ou erro de digitação grosseiro. */
  const markUpForaFaixa = Number(pz.mark_up_pct) >= 1;
  // resultado implausível: preço-venda muito acima do custo esperado do FOB (FOB USD × câmbio).
  const fobBrlEsperado = (Number(pz.vmle_usd) || 0) * cambioNum;
  const resultadoImplausivel = !!resultado && (cambioForaFaixa || markUpForaFaixa || (fobBrlEsperado > 0 && Number(resultado.precoVendaProposta) > fobBrlEsperado * 50));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">{pz.numero_documento}</h1>
          <div className="row gap-2" style={{ marginTop: 6 }}>
            <div className="mono" style={{ display: 'inline-flex', background: '#111', color: '#FBB039', fontWeight: 700, padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
              Cotação Nº {pz.numero_cotacao ?? '—'}
            </div>
            <div className="mono small muted" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 0' }}>
              Precificação {pz.numero_documento}
            </div>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button>
          <Button variant="outline" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" icon="calculator" onClick={calcular} disabled={calculando}>{calculando ? 'Calculando…' : 'Calcular'}</Button>
          {resultado && !aprovado && (
            <Button variant="outline" icon="check" onClick={() => aprovar(false)} disabled={aprovando}>{aprovando ? 'Aprovando…' : 'Aprovar precificação'}</Button>
          )}
          {aprovado && (
            <span className="badge" style={{ background: 'var(--vp-success)', color: '#fff', display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
              ✓ Aprovada {pz.aprovado_em ? `em ${new Date(pz.aprovado_em).toLocaleDateString('pt-BR')}` : ''}
            </span>
          )}
          {resultado && !aprovado && <span className="muted small" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>Calculado — aprove antes de gerar a proposta</span>}
        </div>
      </div>

      {(cambioForaFaixa || resultadoImplausivel) && (
        <div style={{ margin: '0 0 16px', padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 13 }}>
          <b>⚠ Verifique os valores antes de enviar.</b>{' '}
          {cambioForaFaixa
            ? `O Câmbio informado é ${cambioNum} R$/US$ — fora da faixa real (${CAMBIO_MIN}–${CAMBIO_MAX}). Provável troca de campo (taxa/frete digitados no Câmbio). Corrija o Câmbio e recalcule.`
            : markUpForaFaixa
            ? `Mark-up de ${fmtPct2(pz.mark_up_pct)} é implausível — isso zera o preço de venda calculado. Confira o valor.`
            : `O preço de venda calculado (${fmtBRL2(resultado.precoVendaProposta)}) está muito acima do custo esperado do FOB (${fmtBRL2(fobBrlEsperado)}). Confira câmbio, mark-up e percentuais.`}
        </div>
      )}

      <Card title="Unidades desta cotação" sub="herdado do Formulário de Elevadores + resposta do fornecedor"
        action={pz.cotacao_fornecedor_id && (
          <Button variant="outline" size="sm" icon="refresh" onClick={ressincronizarDoFornecedor} disabled={ressincronizando}>
            {ressincronizando ? 'Ressincronizando…' : 'Ressincronizar do fornecedor'}
          </Button>
        )}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>UNIDADE</th><th>Modelo (fornecedor)</th><th>Quantidade</th>
              <th>(USD) PTAX No dia da Cotação</th><th>(USD) PTAX Agora</th><th>Custo Fornecedor (USD)</th>
              <th>R$ no dia da cotação</th><th>R$ agora (ao vivo)</th>
            </tr></thead>
            <tbody>
              {(pz.modelos || []).length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma unidade encontrada.</td></tr>
              )}
              {(pz.modelos || []).map((m, i) => {
                const custoUsd = Number(m.valorUnitarioUsd) || 0;
                const ptaxCotacao = pz.cambio_na_cotacao_usd_brl;
                const ptaxAgora = cambioVivo && cambioVivo !== 'erro' ? cambioVivo.valor : null;

                return (
                  <tr key={m.unidadeId || i}>
                    <td>{m.identificador}</td>
                    <td><PZInput value={m.modelo} onChange={setModelo(i, 'modelo')}/></td>
                    <td><PZInput type="number" value={m.quantidade} onChange={setModelo(i, 'quantidade')}/></td>
                    <td className="mono muted" title="PTAX congelada no dia em que o fornecedor respondeu.">
                      {ptaxCotacao != null ? fmtBRL2(ptaxCotacao) : '—'}
                    </td>
                    <td className="mono muted" title="PTAX consultada agora, para referência ao vivo.">
                      {ptaxAgora != null ? fmtBRL2(ptaxAgora) : 'indisponível'}
                    </td>
                    <td><PZInput type="number" value={m.valorUnitarioUsd} onChange={setModelo(i, 'valorUnitarioUsd')}/></td>
                    <td className="mono muted" title="PTAX do dia da cotação × custo em USD — referência; o cálculo oficial continua usando o Câmbio abaixo.">
                      {ptaxCotacao != null ? fmtBRL2(custoUsd * ptaxCotacao) : '—'}
                    </td>
                    <td className="mono muted" title="PTAX de agora × custo em USD — referência ao vivo; o cálculo oficial continua usando o Câmbio abaixo.">
                      {ptaxAgora != null ? fmtBRL2(custoUsd * ptaxAgora) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Mão de obra — busca automática" sub="tração × capacidade × paradas em Cadastros → Atualização de Custos"
        style={{ marginTop: 16 }}
        action={<Button variant="outline" size="sm" icon="refresh" onClick={atualizarMaoDeObra} disabled={atualizandoMo}>{atualizandoMo ? 'Recalculando…' : 'Recalcular'}</Button>}>
        {!(pz.mo_lookup || []).length && <p className="small muted" style={{ margin: 0 }}>Nenhuma unidade elevador com dados suficientes ainda.</p>}
        {!!(pz.mo_lookup || []).length && (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Unidade</th><th>Tração</th><th>Capacidade</th><th>Paradas</th><th>Situação</th><th>Regra usada</th><th>Valor (R$)</th><th></th></tr></thead>
              <tbody>
                {pz.mo_lookup.map((mo, i) => (
                  <tr key={mo.unidadeId || i}>
                    <td>{mo.identificador || '—'}</td>
                    <td>{mo.tracao || '—'}</td>
                    <td>{mo.capacidadeKg != null ? `${mo.capacidadeKg} kg` : '—'}</td>
                    <td>{mo.paradas != null ? mo.paradas : '—'}</td>
                    <td>
                      {mo.situacao === 'confirmado' && <span className="badge" style={{ background: 'var(--vp-success)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Confirmado</span>}
                      {mo.projetoEspecial && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Projeto especial</span>}
                      {mo.situacao === 'pendente' && !mo.projetoEspecial && <span className="badge" style={{ background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Pendente</span>}
                    </td>
                    <td className="small muted" title={mo.motivo || ''}>{mo.regraUsada || mo.motivo || '—'}</td>
                    <td className="mono">{mo.valorRs ? fmtBRL2(mo.valorRs) : '—'}</td>
                    <td>
                      {mo.origem === 'manual' && (
                        <Button variant="ghost" size="sm" icon="chevRight" title="Preencher tração/capacidade/paradas no Formulário de Elevadores" onClick={irParaFormulario}>
                          Preencher no Formulário
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(pz.mo_lookup || []).some((mo) => mo.projetoEspecial) && (
          <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
            ⚠ Uma ou mais unidades caíram fora da cobertura da tabela de MO — trate como projeto especial (estimativa não confirmada, exige justificativa e aprovação técnica/financeira antes de aprovar a precificação). O valor não entra sozinho na conta — adicione manualmente em "Instalação e Montagem" abaixo quando tiver uma cotação de instalador/engenharia.
          </p>
        )}
      </Card>

      <Card title="Despesas de importação" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="VMLE (USD)"><PZCurrencyInput moeda="USD" value={pz.vmle_usd} onChange={set('vmle_usd')}/></PZField>
          <PZField label="Seguro (USD)"><PZCurrencyInput moeda="USD" value={pz.seguro_usd} onChange={set('seguro_usd')}/></PZField>
          <PZField label="Frete + Seguro + Capatazia (USD)"><PZCurrencyInput moeda="USD" value={pz.frete_seguro_capatazia_usd} onChange={set('frete_seguro_capatazia_usd')}/></PZField>
          <PZField label="Siscomex (R$)"><PZCurrencyInput moeda="BRL" value={pz.siscomex_rs} onChange={set('siscomex_rs')}/></PZField>
          <PZField label="Câmbio (R$/US$)">
            <PZInput type="number" value={pz.tx_cambial} onChange={set('tx_cambial')}/>
            {cambioForaFaixa && <div style={{ color: '#991b1b', fontSize: 11, marginTop: 4 }}>Fora da faixa {CAMBIO_MIN}–{CAMBIO_MAX}. Confira se não digitou aqui um valor de taxa/frete.</div>}
            {cambioVivo && cambioVivo !== 'erro' && (
              <div className="row gap-2" style={{ marginTop: 4, alignItems: 'center' }}>
                <span className="mono small muted">Dólar agora: {fmtBRL2(cambioVivo.valor)}</span>
                <Button variant="ghost" size="sm" onClick={() => set('tx_cambial')(cambioVivo.valor)}>Usar</Button>
              </div>
            )}
            {cambioVivo === 'erro' && <div className="muted small" style={{ marginTop: 4 }}>Câmbio ao vivo indisponível agora.</div>}
          </PZField>
          <PZField label="Outras despesas (R$)"><PZCurrencyInput moeda="BRL" value={pz.outras_despesas_importacao_rs} onChange={set('outras_despesas_importacao_rs')}/></PZField>
          <PZField label="Despachante + Desembaraço (R$)"><PZCurrencyInput moeda="BRL" value={pz.despachante_desembaraco_rs} onChange={set('despachante_desembaraco_rs')}/></PZField>
          <PZField label="Demurrage (R$)"><PZCurrencyInput moeda="BRL" value={pz.demurrage_rs} onChange={set('demurrage_rs')}/></PZField>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Containers <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tamanho/quantidade herdados da resposta do fornecedor quando possível; preço do frete por container, digitado pelo Financeiro</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.containers || []).map((ct, i) => (
              <div key={i} className="row gap-2">
                <div style={{ width: 140 }}><PZSelect value={ct.tipo_tamanho} onChange={setContainer(i, 'tipo_tamanho')} options={PZ_CONTAINER_TIPOS} placeholder="Tamanho"/></div>
                <input className="input" style={{ width: 100 }} type="number" value={ct.quantidade ?? 1} onChange={(e) => setContainer(i, 'quantidade')(Number(e.target.value) || 0)} placeholder="Qtd"/>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={ct.preco_rs} onChange={setContainer(i, 'preco_rs')}/></div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeContainer(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addContainer}>+ Adicionar container</Button>
          {(pz.containers || []).length > 0 && <div className="small muted" style={{ marginTop: 8 }}>Subtotal Containers: <b>{fmtBRL2(containersTotalRs)}</b></div>}
        </div>
      </Card>

      <Card title="Despesas Operacionais" sub="custos itemizados — instalação/montagem e o que mais entrar aqui no futuro" style={{ marginTop: 16 }}>
        <div>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Instalação e Montagem <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— itens de outros departamentos (Engenharia/Logística), preenchimento avulso por enquanto</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.itens_instalacao_montagem || []).map((it, i) => (
              <div key={i} className="row gap-2">
                <input className="input" style={{ flex: 1 }} value={it.descricao || ''} onChange={(e) => setItemInstalacao(i, 'descricao')(e.target.value)} placeholder="ex.: Guincho, Andaime, Mão de obra..."/>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={it.valor} onChange={setItemInstalacao(i, 'valor')}/></div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItemInstalacao(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addItemInstalacao}>+ Adicionar item</Button>
        </div>
      </Card>

      <Card title="Despesas Extras" sub="catch-all — recorrentes ou planejadas que ainda não têm seção própria" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Frete interno (R$)"><PZCurrencyInput moeda="BRL" value={pz.frete_interno_rs} onChange={set('frete_interno_rs')}/></PZField>
          <PZField label="Armazenagem (R$)"><PZCurrencyInput moeda="BRL" value={pz.armazenagem_rs} onChange={set('armazenagem_rs')}/></PZField>
          <PZField label="% de Serviços"><PZPercentInput value={pz.percentual_servicos} onChange={set('percentual_servicos')}/></PZField>
          <PZField label="Contingência (R$)"><PZCurrencyInput moeda="BRL" value={pz.contingencia_valor} onChange={set('contingencia_valor')}/></PZField>
          <PZField label="Outros custos não recuperáveis (R$)"><PZCurrencyInput moeda="BRL" value={pz.outros_custos_nao_recuperaveis_rs} onChange={set('outros_custos_nao_recuperaveis_rs')}/></PZField>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Contingência e outros custos não recuperáveis entram no motor oficial (custo econômico completo) — ver "Formação do Preço" abaixo. O V1 (legado, só referência) ignora esses dois campos.</p>

        <div style={{ marginTop: 20 }}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Itens avulsos <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— despesas recorrentes ou planejadas sem campo próprio ainda</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.itens_despesas_extras || []).map((it, i) => (
              <div key={i} className="row gap-2">
                <input className="input" style={{ flex: 1 }} value={it.descricao || ''} onChange={(e) => setItemExtra(i, 'descricao')(e.target.value)} placeholder="ex.: Seguro adicional, taxa bancária..."/>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={it.valor} onChange={setItemExtra(i, 'valor')}/></div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItemExtra(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addItemExtra}>+ Adicionar item</Button>
        </div>
      </Card>

      <Card title="Alavancas do Financeiro" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Markup sobre o custo (%)">
            <PZPercentInput value={pz.mark_up_pct} onChange={set('mark_up_pct')}/>
            {markUpForaFaixa && <div style={{ color: '#991b1b', fontSize: 11, marginTop: 4 }}>Markup de {fmtPct2(pz.mark_up_pct)} parece implausível — confira o valor (zera o preço de venda no V1).</div>}
          </PZField>
          <PZField label="Comissão consultoria (%)"><PZPercentInput value={pz.comissao_consultoria_pct} onChange={set('comissao_consultoria_pct')}/></PZField>
          <PZField label="Comissão vendedor (%)"><PZPercentInput value={pz.comissao_vendedor_pct} onChange={set('comissao_vendedor_pct')}/></PZField>
          <PZField label="Comissão indicação (%)"><PZPercentInput value={pz.comissao_indicacao_pct} onChange={set('comissao_indicacao_pct')}/></PZField>
          <PZField label="Margem mínima (%)"><PZPercentInput value={params.margem_minima_pct} onChange={setParam('margem_minima_pct')}/></PZField>
        </div>

        <Button variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => setMostrarParametros((v) => !v)}>
          {mostrarParametros ? 'Ocultar' : 'Ver/editar'} parâmetros fiscais (regime, impostos)
        </Button>
        {mostrarParametros && (
          <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
            <PZField label="Regime tributário"><PZInput value={params.regime_tributario} onChange={setParam('regime_tributario')}/></PZField>
            <PZField label="ICMS importação (%)"><PZPercentInput value={params.icms_importacao_pct} onChange={setParam('icms_importacao_pct')}/></PZField>
            <PZField label="IPI importação (%)"><PZPercentInput value={params.ipi_importacao_pct} onChange={setParam('ipi_importacao_pct')}/></PZField>
            <PZField label="PIS importação (%)"><PZPercentInput value={params.pis_importacao_pct} onChange={setParam('pis_importacao_pct')}/></PZField>
            <PZField label="COFINS importação (%)"><PZPercentInput value={params.cofins_importacao_pct} onChange={setParam('cofins_importacao_pct')}/></PZField>
            <PZField label="II importação (%)"><PZPercentInput value={params.ii_importacao_pct} onChange={setParam('ii_importacao_pct')}/></PZField>
            <PZField label="ICMS venda (%)"><PZPercentInput value={params.icms_venda_pct} onChange={setParam('icms_venda_pct')}/></PZField>
            <PZField label="PIS venda (%)"><PZPercentInput value={params.pis_venda_pct} onChange={setParam('pis_venda_pct')}/></PZField>
            <PZField label="COFINS venda (%)"><PZPercentInput value={params.cofins_venda_pct} onChange={setParam('cofins_venda_pct')}/></PZField>
            <PZField label="IRPJ venda (%)"><PZPercentInput value={params.irpj_venda_pct} onChange={setParam('irpj_venda_pct')}/></PZField>
            <PZField label="CSLL venda (%)"><PZPercentInput value={params.csll_venda_pct} onChange={setParam('csll_venda_pct')}/></PZField>
            <PZField label="Impostos a pagar — serviços (%)"><PZPercentInput value={params.impostos_pagar_servicos_pct} onChange={setParam('impostos_pagar_servicos_pct')}/></PZField>
            <p className="small muted" style={{ gridColumn: 'span 3', margin: 0 }}>
              Esses % são regulatórios (lei federal/estadual) e mudam com o tempo — editar aqui afeta só esta precificação. Para mudar o padrão do sistema, atualize em Parâmetros Fiscais.
            </p>
          </div>
        )}
      </Card>

      {difal && (
        <Card title="DIFAL" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, margin: 0 }}>{difal.mensagem}</p>
          {difal.alerta && (
            <p style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #FBB039', padding: '8px 12px', marginTop: 10 }}>{difal.alerta}</p>
          )}
        </Card>
      )}

      <Card title="Formação do Preço — motor oficial"
        sub="custo econômico completo: instalação/frete interno/armazenagem entram na BASE do preço, não só no lucro depois — trava aprovação e alimenta a Proposta"
        style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Modo de formação do preço">
            <select className="input" value={pz.modo_formacao_preco || 'markup_sobre_custo'} onChange={(e) => set('modo_formacao_preco')(e.target.value)}>
              <option value="markup_sobre_custo">Markup sobre o custo</option>
              <option value="margem_sobre_venda">Margem desejada sobre a venda</option>
            </select>
          </PZField>
          {pz.modo_formacao_preco !== 'markup_sobre_custo' && (
            <PZField label="Margem desejada sobre a venda (%)"><PZPercentInput value={pz.margem_desejada_pct} onChange={set('margem_desejada_pct')}/></PZField>
          )}
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Markup sobre o custo usa o mesmo % de "Markup sobre o custo" das Alavancas do Financeiro, acima. Contingência e outros custos não recuperáveis vêm do card "Despesas Extras".
        </p>

        {resultadoV2 && (
          <>
            <div className="grid-3" style={{ gap: 16, marginTop: 16 }}>
              <div><span className="up-eyebrow muted">Custo econômico completo</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultadoV2.custoEconomicoCompleto)}</div></div>
              <div><span className="up-eyebrow muted">Preço de venda na proposta</span><div className="cell-money" style={{ fontSize: 18, fontWeight: 800 }}>{fmtBRL2(resultadoV2.precificacao.precoVendaProposta)}</div></div>
              <div>
                <span className="up-eyebrow muted">Margem efetiva calculada (%)</span>
                <div className="cell-money" style={{ fontSize: 16, color: margemAbaixoMinima ? 'var(--vp-warning-ink)' : 'var(--vp-success)' }}>{fmtPct2(resultadoV2.precificacao.margemEfetivaPct)}</div>
                {margemMinima > 0 && <div className="small muted" style={{ marginTop: 2 }}>mínima {fmtPct2(margemMinima)}</div>}
              </div>
              <div><span className="up-eyebrow muted">Lucro final</span><div className="cell-money" style={{ fontSize: 16, color: resultadoV2.precificacao.lucroFinal >= 0 ? 'var(--vp-success)' : 'var(--vp-warning-ink)' }}>{fmtBRL2(resultadoV2.precificacao.lucroFinal)}</div></div>
              <div><span className="up-eyebrow muted">Preço de venda (V1, legado)</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultadoV2.v1Comparacao.precoVendaProposta)}</div></div>
              <div><span className="up-eyebrow muted">Diferença oficial − V1</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultadoV2.precificacao.precoVendaProposta - resultadoV2.v1Comparacao.precoVendaProposta)}</div></div>
            </div>
            {!resultadoV2.divisorValido && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Divisor inválido (markup/margem + impostos + comissões somam 100% ou mais) — não é possível formar preço nesse cenário. Reduza o markup/margem desejada ou os percentuais de venda.
              </p>
            )}
            {resultadoV2.divisorValido && margemEfetivaV2Negativa && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Margem efetiva negativa — este cenário não deveria ser aprovado como está. Revise custos operacionais, markup/margem ou comissões.
              </p>
            )}
            {resultadoV2.divisorValido && !margemEfetivaV2Negativa && margemAbaixoMinima && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Margem efetiva ({fmtPct2(resultadoV2.precificacao.margemEfetivaPct)}) abaixo da mínima configurada ({fmtPct2(margemMinima)}). É possível aprovar mesmo assim, com confirmação.
              </p>
            )}
          </>
        )}
        {!resultadoV2 && <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Clique em "Calcular" pra ver o resultado.</p>}
      </Card>

      {resultado && (
        <Card title="Resultado — V1 (legado, referência)" sub="mantido só pra comparação — não trava mais aprovação nem alimenta a Proposta" style={{ marginTop: 16 }}>
          <div className="grid-3" style={{ gap: 16 }}>
            <div><span className="up-eyebrow muted">Custo total mercadorias</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(importacao.custoTotalMercadorias)}</div></div>
            <div><span className="up-eyebrow muted">Custo por equipamento</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(importacao.custoPorEquipamento)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda na proposta</span><div className="cell-money" style={{ fontSize: 18, fontWeight: 800 }}>{fmtBRL2(resultado.precoVendaProposta)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda — produto</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaProduto)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda — serviços</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaServicos)}</div></div>
            <div><span className="up-eyebrow muted">Preço por equipamento</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaPorEquipamento)}</div></div>
            <div><span className="up-eyebrow muted">Lucro final</span><div className="cell-money" style={{ fontSize: 16, color: resultado.lucroFinal >= 0 ? 'var(--vp-success)' : 'var(--vp-warning-ink)' }}>{fmtBRL2(resultado.lucroFinal)}</div></div>
            <div><span className="up-eyebrow muted">Margem final (V1)</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtPct2(resultado.margemFinalPct)}</div></div>
            <div><span className="up-eyebrow muted">DIFAL (custo VerticalParts)</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.difalRs)}</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { PrecificacaoElevadorPage });
