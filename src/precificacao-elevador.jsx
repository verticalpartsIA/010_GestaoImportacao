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

/* ---------- Lista — cotações de fornecedor já respondidas ---------- */
function PrecificacaoElevadorPage({ setRoute, modo, setModo }) {
  const [pendentes, setPendentes] = React.useState(null);
  const [pzId, setPzId] = React.useState(null);

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
          <h1 className="page-head__title">Precificação — Elevadores</h1>
          <p className="page-head__sub">Cotações já respondidas pelo fornecedor, prontas para calcular o preço de venda.</p>
        </div>
        <div className="page-head__r"><PrecificacaoModoTabs modo={modo} setModo={setModo}/></div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Cotação Nº</th><th>Cliente</th><th>Fornecedor</th><th>Respondido em</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {pendentes === null && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</td></tr>
            )}
            {pendentes !== null && pendentes.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma cotação respondida pelo fornecedor ainda.</td></tr>
            )}
            {(pendentes || []).map((item) => (
              <tr key={item.cotacaoFornecedorId} style={{ cursor: 'pointer' }} onClick={() => abrir(item)}>
                <td className="mono">{item.numeroCotacao ?? '—'}</td>
                <td>{item.clienteNome || '—'}</td>
                <td>{item.fornecedor}</td>
                <td>{item.respondedAt ? new Date(item.respondedAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td>{item.precificacaoStatus ? <StatusBadge status={item.precificacaoStatus === 'calculado' ? 'Em análise' : item.precificacaoStatus === 'finalizado' ? 'Aprovada' : 'Recebida'}/> : <span className="muted small">Não iniciada</span>}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight"/></td>
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
  const [mostrarParametros, setMostrarParametros] = React.useState(false);

  const carregar = React.useCallback(() => {
    window.PrecificacaoElevadorStore.obter(id).then(setPz);
  }, [id]);
  React.useEffect(() => { carregar(); }, [carregar]);

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

  const payloadSalvar = () => ({
    vmle_usd: pz.vmle_usd, seguro_usd: pz.seguro_usd, frete_seguro_capatazia_usd: pz.frete_seguro_capatazia_usd,
    siscomex_rs: pz.siscomex_rs, tx_cambial: pz.tx_cambial, outras_despesas_importacao_rs: pz.outras_despesas_importacao_rs,
    despachante_desembaraco_rs: pz.despachante_desembaraco_rs, demurrage_rs: pz.demurrage_rs,
    frete_interno_rs: pz.frete_interno_rs, armazenagem_rs: pz.armazenagem_rs,
    itens_instalacao_montagem: pz.itens_instalacao_montagem, percentual_servicos: pz.percentual_servicos,
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

  const calcular = async () => {
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

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">{pz.numero_documento}</h1>
          <div className="mono" style={{ display: 'inline-flex', marginTop: 6, background: '#111', color: '#FBB039', fontWeight: 700, padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
            Cotação Nº {pz.numero_cotacao ?? '—'}
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button>
          <Button variant="outline" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" icon="calculator" onClick={calcular} disabled={calculando}>{calculando ? 'Calculando…' : 'Calcular'}</Button>
        </div>
      </div>

      <Card title="Unidades desta cotação" sub="herdado do Formulário de Elevadores + resposta do fornecedor">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Unidade</th><th>Modelo (fornecedor)</th><th>Quantidade</th><th>Valor unitário (USD)</th></tr></thead>
            <tbody>
              {(pz.modelos || []).length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma unidade encontrada.</td></tr>
              )}
              {(pz.modelos || []).map((m, i) => (
                <tr key={m.unidadeId || i}>
                  <td>{m.identificador}</td>
                  <td><PZInput value={m.modelo} onChange={setModelo(i, 'modelo')}/></td>
                  <td><PZInput type="number" value={m.quantidade} onChange={setModelo(i, 'quantidade')}/></td>
                  <td><PZInput type="number" value={m.valorUnitarioUsd} onChange={setModelo(i, 'valorUnitarioUsd')}/></td>
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
          <PZField label="Câmbio (R$/US$)"><PZInput type="number" value={pz.tx_cambial} onChange={set('tx_cambial')}/></PZField>
          <PZField label="Outras despesas (R$)"><PZInput type="number" value={pz.outras_despesas_importacao_rs} onChange={set('outras_despesas_importacao_rs')}/></PZField>
        </div>
      </Card>

      <Card title="Despesas extras" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Despachante + Desembaraço (R$)"><PZInput type="number" value={pz.despachante_desembaraco_rs} onChange={set('despachante_desembaraco_rs')}/></PZField>
          <PZField label="Demurrage (R$)"><PZInput type="number" value={pz.demurrage_rs} onChange={set('demurrage_rs')}/></PZField>
          <PZField label="Frete interno (R$)"><PZInput type="number" value={pz.frete_interno_rs} onChange={set('frete_interno_rs')}/></PZField>
          <PZField label="Armazenagem (R$)"><PZInput type="number" value={pz.armazenagem_rs} onChange={set('armazenagem_rs')}/></PZField>
          <PZField label="% de Serviços"><PZInput type="number" value={pz.percentual_servicos} onChange={set('percentual_servicos')}/></PZField>
        </div>

        <div style={{ marginTop: 14 }}>
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

      <Card title="Alavancas do Financeiro" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Mark-up (%)"><PZInput type="number" value={pz.mark_up_pct} onChange={set('mark_up_pct')}/></PZField>
          <PZField label="Comissão consultoria (%)"><PZInput type="number" value={pz.comissao_consultoria_pct} onChange={set('comissao_consultoria_pct')}/></PZField>
          <PZField label="Comissão vendedor (%)"><PZInput type="number" value={pz.comissao_vendedor_pct} onChange={set('comissao_vendedor_pct')}/></PZField>
          <PZField label="Comissão indicação (%)"><PZInput type="number" value={pz.comissao_indicacao_pct} onChange={set('comissao_indicacao_pct')}/></PZField>
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
            <div><span className="up-eyebrow muted">Margem final</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtPct2(resultado.margemFinalPct)}</div></div>
            <div><span className="up-eyebrow muted">DIFAL (custo VerticalParts)</span><div className="cell-money" style={{ fontSize: 16 }}>{fmtBRL2(resultado.difalRs)}</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { PrecificacaoElevadorPage });
