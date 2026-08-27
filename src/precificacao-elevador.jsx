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
    return <PrecificacaoElevadorDetalhe id={pzId} onVoltar={() => { setPzId(null); carregar(); }}/>;
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
function PrecificacaoElevadorDetalhe({ id, onVoltar }) {
  const [pz, setPz] = React.useState(null);
  const [calculando, setCalculando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [aprovando, setAprovando] = React.useState(false);
  const [mostrarParametros, setMostrarParametros] = React.useState(false);
  const [ressincronizando, setRessincronizando] = React.useState(false);
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
  const difal = pz.difal && pz.difal.mensagem ? pz.difal : null;
  const params = pz.parametros_fiscais_snapshot || {};
  const margemMinima = Number(params.margem_minima_pct) || 0;
  const margemAbaixoMinima = !!resultado && resultado.margemFinalPct < margemMinima;
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
  /* resultado implausível: preço-venda muito acima do custo esperado do FOB
     (FOB USD × câmbio). Pega tanto o câmbio errado quanto % digitado como
     inteiro (ex.: markup 39,2 em vez de 0,392). */
  const fobBrlEsperado = (Number(pz.vmle_usd) || 0) * cambioNum;
  const resultadoImplausivel = !!resultado && (cambioForaFaixa || (fobBrlEsperado > 0 && Number(resultado.precoVendaProposta) > fobBrlEsperado * 50));

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
            : `O preço de venda calculado (${fmtBRL2(resultado.precoVendaProposta)}) está muito acima do custo esperado do FOB (${fmtBRL2(fobBrlEsperado)}). Confira câmbio, mark-up e percentuais (devem ser decimais, ex.: 0,392 = 39,2%).`}
        </div>
      )}

      <Card title="Unidades desta cotação" sub="herdado do Formulário de Elevadores + resposta do fornecedor"
        action={pz.cotacao_fornecedor_id && (
          <Button variant="outline" size="sm" icon="refresh" onClick={ressincronizarDoFornecedor} disabled={ressincronizando}>
            {ressincronizando ? 'Ressincronizando…' : 'Ressincronizar do fornecedor'}
          </Button>
        )}>
        {pz.cotacao_fornecedor_id && (
          <div className="row gap-3" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <span className="mono small muted">
              Câmbio no dia da cotação (congelado): {pz.cambio_na_cotacao_usd_brl != null ? fmtBRL2(pz.cambio_na_cotacao_usd_brl) : '— (fornecedor respondeu antes dessa feature existir)'}
            </span>
            <span className="mono small muted">
              Câmbio agora: {cambioVivo && cambioVivo !== 'erro' ? fmtBRL2(cambioVivo.valor) : 'indisponível'}
            </span>
          </div>
        )}
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>Unidade</th><th>Modelo (fornecedor)</th><th>Quantidade</th><th>Custo Fornecedor (USD)</th>
              <th>R$ no dia da cotação</th><th>R$ agora (ao vivo)</th>
            </tr></thead>
            <tbody>
              {(pz.modelos || []).length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma unidade encontrada.</td></tr>
              )}
              {(pz.modelos || []).map((m, i) => (
                <tr key={m.unidadeId || i}>
                  <td>{m.identificador}</td>
                  <td><PZInput value={m.modelo} onChange={setModelo(i, 'modelo')}/></td>
                  <td><PZInput type="number" value={m.quantidade} onChange={setModelo(i, 'quantidade')}/></td>
                  <td><PZInput type="number" value={m.valorUnitarioUsd} onChange={setModelo(i, 'valorUnitarioUsd')}/></td>
                  <td className="mono muted" title="Câmbio congelado no dia em que o fornecedor respondeu × custo em USD — não é o valor usado no cálculo oficial (esse usa o Câmbio abaixo)">
                    {pz.cambio_na_cotacao_usd_brl != null ? fmtBRL2((Number(m.valorUnitarioUsd) || 0) * pz.cambio_na_cotacao_usd_brl) : '—'}
                  </td>
                  <td className="mono muted" title="Câmbio de agora × custo em USD — referência de quanto custaria hoje, não é o valor usado no cálculo oficial (esse usa o Câmbio abaixo)">
                    {cambioVivo && cambioVivo !== 'erro' ? fmtBRL2((Number(m.valorUnitarioUsd) || 0) * cambioVivo.valor) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Despesas de importação" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="VMLE (USD)"><PZInput type="number" value={pz.vmle_usd} onChange={set('vmle_usd')}/></PZField>
          <PZField label="Seguro (USD)"><PZInput type="number" value={pz.seguro_usd} onChange={set('seguro_usd')}/></PZField>
          <PZField label="Frete + Seguro + Capatazia (USD)"><PZInput type="number" value={pz.frete_seguro_capatazia_usd} onChange={set('frete_seguro_capatazia_usd')}/></PZField>
          <PZField label="Siscomex (R$)"><PZInput type="number" value={pz.siscomex_rs} onChange={set('siscomex_rs')}/></PZField>
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
          <PZField label="Outras despesas (R$)"><PZInput type="number" value={pz.outras_despesas_importacao_rs} onChange={set('outras_despesas_importacao_rs')}/></PZField>
          <PZField label="Despachante + Desembaraço (R$)"><PZInput type="number" value={pz.despachante_desembaraco_rs} onChange={set('despachante_desembaraco_rs')}/></PZField>
          <PZField label="Demurrage (R$)"><PZInput type="number" value={pz.demurrage_rs} onChange={set('demurrage_rs')}/></PZField>
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
                <input className="input" style={{ width: 160 }} type="number" value={ct.preco_rs ?? 0} onChange={(e) => setContainer(i, 'preco_rs')(Number(e.target.value) || 0)} placeholder="Preço (R$)"/>
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
                <input className="input" style={{ width: 160 }} type="number" value={it.valor || 0} onChange={(e) => setItemInstalacao(i, 'valor')(Number(e.target.value) || 0)} placeholder="0,00"/>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItemInstalacao(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addItemInstalacao}>+ Adicionar item</Button>
        </div>
      </Card>

      <Card title="Despesas Extras" sub="catch-all — recorrentes ou planejadas que ainda não têm seção própria" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Frete interno (R$)"><PZInput type="number" value={pz.frete_interno_rs} onChange={set('frete_interno_rs')}/></PZField>
          <PZField label="Armazenagem (R$)"><PZInput type="number" value={pz.armazenagem_rs} onChange={set('armazenagem_rs')}/></PZField>
          <PZField label="% de Serviços"><PZInput type="number" value={pz.percentual_servicos} onChange={set('percentual_servicos')}/></PZField>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Itens avulsos <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— despesas recorrentes ou planejadas sem campo próprio ainda</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.itens_despesas_extras || []).map((it, i) => (
              <div key={i} className="row gap-2">
                <input className="input" style={{ flex: 1 }} value={it.descricao || ''} onChange={(e) => setItemExtra(i, 'descricao')(e.target.value)} placeholder="ex.: Seguro adicional, taxa bancária..."/>
                <input className="input" style={{ width: 160 }} type="number" value={it.valor || 0} onChange={(e) => setItemExtra(i, 'valor')(Number(e.target.value) || 0)} placeholder="0,00"/>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItemExtra(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addItemExtra}>+ Adicionar item</Button>
        </div>
      </Card>

      <Card title="Alavancas do Financeiro" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Mark-up (%)"><PZInput type="number" value={pz.mark_up_pct} onChange={set('mark_up_pct')}/></PZField>
          <PZField label="Comissão consultoria (%)"><PZInput type="number" value={pz.comissao_consultoria_pct} onChange={set('comissao_consultoria_pct')}/></PZField>
          <PZField label="Comissão vendedor (%)"><PZInput type="number" value={pz.comissao_vendedor_pct} onChange={set('comissao_vendedor_pct')}/></PZField>
          <PZField label="Comissão indicação (%)"><PZInput type="number" value={pz.comissao_indicacao_pct} onChange={set('comissao_indicacao_pct')}/></PZField>
          <PZField label="Margem mínima (%)"><PZInput type="number" value={params.margem_minima_pct} onChange={setParam('margem_minima_pct')}/></PZField>
        </div>

        <Button variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => setMostrarParametros((v) => !v)}>
          {mostrarParametros ? 'Ocultar' : 'Ver/editar'} parâmetros fiscais (regime, impostos)
        </Button>
        {mostrarParametros && (
          <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
            <PZField label="Regime tributário"><PZInput value={params.regime_tributario} onChange={setParam('regime_tributario')}/></PZField>
            <PZField label="ICMS importação (%)"><PZInput type="number" value={params.icms_importacao_pct} onChange={setParam('icms_importacao_pct')}/></PZField>
            <PZField label="IPI importação (%)"><PZInput type="number" value={params.ipi_importacao_pct} onChange={setParam('ipi_importacao_pct')}/></PZField>
            <PZField label="PIS importação (%)"><PZInput type="number" value={params.pis_importacao_pct} onChange={setParam('pis_importacao_pct')}/></PZField>
            <PZField label="COFINS importação (%)"><PZInput type="number" value={params.cofins_importacao_pct} onChange={setParam('cofins_importacao_pct')}/></PZField>
            <PZField label="II importação (%)"><PZInput type="number" value={params.ii_importacao_pct} onChange={setParam('ii_importacao_pct')}/></PZField>
            <PZField label="ICMS venda (%)"><PZInput type="number" value={params.icms_venda_pct} onChange={setParam('icms_venda_pct')}/></PZField>
            <PZField label="PIS venda (%)"><PZInput type="number" value={params.pis_venda_pct} onChange={setParam('pis_venda_pct')}/></PZField>
            <PZField label="COFINS venda (%)"><PZInput type="number" value={params.cofins_venda_pct} onChange={setParam('cofins_venda_pct')}/></PZField>
            <PZField label="IRPJ venda (%)"><PZInput type="number" value={params.irpj_venda_pct} onChange={setParam('irpj_venda_pct')}/></PZField>
            <PZField label="CSLL venda (%)"><PZInput type="number" value={params.csll_venda_pct} onChange={setParam('csll_venda_pct')}/></PZField>
            <PZField label="Impostos a pagar — serviços (%)"><PZInput type="number" value={params.impostos_pagar_servicos_pct} onChange={setParam('impostos_pagar_servicos_pct')}/></PZField>
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

      {resultado && (
        <Card title="Resultado" style={{ marginTop: 16 }}>
          <div className="grid-3" style={{ gap: 16 }}>
            <div><span className="up-eyebrow muted">Custo total mercadorias</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(importacao.custoTotalMercadorias)}</div></div>
            <div><span className="up-eyebrow muted">Custo por equipamento</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(importacao.custoPorEquipamento)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda na proposta</span><div className="cell-money" style={{ fontSize: 18, fontWeight: 800 }}>{fmtBRL2(resultado.precoVendaProposta)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda — produto</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaProduto)}</div></div>
            <div><span className="up-eyebrow muted">Preço de venda — serviços</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaServicos)}</div></div>
            <div><span className="up-eyebrow muted">Preço por equipamento</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.precoVendaPorEquipamento)}</div></div>
            <div><span className="up-eyebrow muted">Lucro final</span><div className="cell-money" style={{ fontSize: 16, color: resultado.lucroFinal >= 0 ? 'var(--vp-success)' : 'var(--vp-warning-ink)' }}>{fmtBRL2(resultado.lucroFinal)}</div></div>
            <div>
              <span className="up-eyebrow muted">Margem final</span>
              <div className="cell-money" style={{ fontSize: 16, color: margemAbaixoMinima ? 'var(--vp-warning-ink)' : undefined }}>{fmtPct2(resultado.margemFinalPct)}</div>
              {margemMinima > 0 && <div className="small muted" style={{ marginTop: 2 }}>mínima {fmtPct2(margemMinima)}</div>}
            </div>
            <div><span className="up-eyebrow muted">DIFAL (custo VerticalParts)</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.difalRs)}</div></div>
          </div>
          {margemAbaixoMinima && (
            <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
              ⚠ Margem final ({fmtPct2(resultado.margemFinalPct)}) abaixo da mínima configurada ({fmtPct2(margemMinima)}). É possível aprovar mesmo assim, com confirmação.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { PrecificacaoElevadorPage });
