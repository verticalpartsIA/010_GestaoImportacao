/* ============================================================
   inbox-preco.jsx — Inbox: "Extrair preço" do e-mail de resposta do fornecedor (04/10/2026).
   Lê o corpo do e-mail (regras em inbox-preco-calc.js, sem IA), PROPÕE preço por unidade e condições, e só grava depois que uma
   pessoa confere e confirma — no formato da resposta do formulário do fornecedor (CotacaoElevadorFornecedorStore.registrarRespostaPorEmail),
   que é o que a Precificação já lê. Nada é gravado sem o clique em "Registrar resposta do fornecedor".
   window.InboxModalPrecoEmail
   ============================================================ */
const IP_TERMOS = [
  ['incoterm_porto', 'Incoterm / porto'], ['container_no', 'Containers'], ['prazo_fabricacao', 'Prazo de fabricação'], ['validade_dias', 'Validade (dias)'],
  ['garantia', 'Garantia'], ['condicoes_pagamento', 'Condições de pagamento'], ['frete_internacional_usd', 'Frete internacional (valor)'],
];

function ipUnidadesDe(cot) {
  return ((cot && cot.dados_envio && cot.dados_envio.unidades) || []).map((u) => ({
    unidade_id: u.unidade_id, identificador: u.identificador || '', indice_ativo: u.indice_ativo, quantidade: Number(u.quantidade) > 0 ? Number(u.quantidade) : 1,
    modelo: u.modelo || '', capacidade_kg: u.capacidade_kg || null, paradas: u.paradas || null,
  }));
}

function InboxModalPrecoEmail({ email, eu, onClose, onRegistrado }) {
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [corpo, setCorpo] = React.useState('');
  const [candidatas, setCandidatas] = React.useState([]);
  const [cotId, setCotId] = React.useState('');
  const [sugestao, setSugestao] = React.useState(null);         // resultado de InboxPreco.extrair
  const [atrib, setAtrib] = React.useState([]);                  // [{ ...valorEncontrado, tipo, unidadeId }]
  const [precos, setPrecos] = React.useState({});                // { unidade_id: 'texto' }
  const [termos, setTermos] = React.useState({});
  const [conferi, setConferi] = React.useState(false);
  const [substituir, setSubstituir] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const cot = candidatas.find((c) => c.id === cotId) || null;
  const unidades = React.useMemo(() => ipUnidadesDe(cot), [cot]);

  /* 1) carrega o corpo completo do e-mail e as cotações de fornecedor candidatas */
  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sb = window.__VP_SB.sb;
        const { data: row, error } = await sb.from('emails_projeto').select('referencia_tipo,referencia_id,numero_cotacao,corpo_texto,corpo_html').eq('id', email.id).maybeSingle();
        if (error) throw error;
        const texto = (row && row.corpo_texto) || String((row && row.corpo_html) || email.preview || '').replace(/<[^>]+>/g, ' ');
        let lista = [];
        if (row && row.referencia_id && ['cotacao_fornecedor', 'tratativa_cotacao'].includes(row.referencia_tipo)) {
          const c = await window.CotacaoElevadorFornecedorStore.getById(row.referencia_id);
          if (c && !c.excluido_em) lista = [c];
        }
        const nCot = (row && row.numero_cotacao) ?? email.numeroCotacao;
        if (!lista.length && nCot != null) {
          const { data } = await sb.from('cotacoes_elevador_fornecedor').select('*').filter('dados_envio->header->>numero_cotacao', 'eq', String(nCot)).is('excluido_em', null);
          lista = data || [];
        }
        if (!vivo) return;
        setCorpo(texto); setCandidatas(lista); setCotId(lista[0] ? lista[0].id : '');
        if (!lista.length) setErro('Este e-mail não está ligado a uma cotação de fornecedor. Vincule o e-mail à cotação (botão Vincular) e tente de novo.');
      } catch (e) { if (vivo) setErro('Não consegui ler o e-mail: ' + (e.message || e)); }
      finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [email.id]);

  /* 2) ao escolher/trocar a cotação, roda as regras e preenche a proposta */
  React.useEffect(() => {
    if (!cot || !window.InboxPreco) return;
    const r = window.InboxPreco.extrair(corpo, unidades);
    setSugestao(r);
    setAtrib(r.valores.map((v) => ({ ...v })));
    const p = {};
    r.valores.forEach((v) => {
      if (!v.unidadeId || p[v.unidadeId] != null) return;
      const u = unidades.find((x) => x.unidade_id === v.unidadeId);
      const unit = v.tipo === 'total' && u ? v.valor / u.quantidade : v.valor;
      p[v.unidadeId] = String(Math.round(unit * 100) / 100);
    });
    setPrecos(p);
    const base = cot.respostas || {};
    const t = {};
    IP_TERMOS.forEach(([k]) => { t[k] = r.termos[k] || base[k] || ''; });
    t.moeda = r.termos.moeda || base.moeda || 'USD';
    setTermos(t);
    setSubstituir(false); setConferi(false);
  }, [cotId, corpo]);

  const atribuir = (idx, patch) => setAtrib((lista) => {
    const nova = lista.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    const v = nova[idx];
    if (v.unidadeId) {
      const u = unidades.find((x) => x.unidade_id === v.unidadeId);
      const unit = v.tipo === 'total' && u ? v.valor / u.quantidade : v.valor;
      setPrecos((p) => ({ ...p, [v.unidadeId]: String(Math.round(unit * 100) / 100) }));
    }
    return nova;
  });

  const numero = (s) => { const n = window.InboxPreco.numeroDe(s); return n == null ? 0 : n; };
  const semPreco = unidades.filter((u) => !(numero(precos[u.unidade_id]) > 0));
  const totalGeral = unidades.reduce((s, u) => s + numero(precos[u.unidade_id]) * u.quantidade, 0);
  const jaRespondeu = cot && cot.status === 'respondido';
  const podeRegistrar = !!cot && !semPreco.length && conferi && (!jaRespondeu || substituir) && !salvando;
  const fmt = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const registrar = async () => {
    setSalvando(true);
    try {
      const precosNum = {};
      unidades.forEach((u) => { precosNum[u.unidade_id] = { preco_unitario: numero(precos[u.unidade_id]) }; });
      const respostas = window.InboxPreco.montarRespostas({ atual: cot.respostas, unidades, precos: precosNum, termos });
      await window.CotacaoElevadorFornecedorStore.registrarRespostaPorEmail(cot.id, respostas, { emailId: email.id, por: eu, substituir });
      window.toast?.('Resposta do fornecedor registrada — já aparece na Precificação.', 'success');
      onRegistrado && onRegistrado(); onClose();
    } catch (e) { window.toast?.('Não consegui registrar: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };

  const corConf = { alta: 'var(--success, #2f855a)', media: 'var(--warning, #b7791f)', baixa: 'var(--danger, #c53030)' };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820, maxHeight: '90vh', overflowY: 'auto' }} onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head"><b>Extrair preço do e-mail</b><button className="ig-iconbtn" onClick={onClose} title="Fechar"><Icon.x size={14}/></button></div>
        <div className="modal__body" style={{ display: 'grid', gap: 14 }}>
          {carregando && <div className="muted">Lendo o e-mail…</div>}
          {!carregando && erro && <div className="alert warning"><Icon.warning/><div style={{ flex: 1 }}>{erro}</div></div>}
          {!carregando && !erro && cot && (
            <>
              <div className="small muted">
                O sistema <b>propõe</b> os valores abaixo lendo o texto do e-mail (por regras — pode errar). Confira cada número com o e-mail e só então registre.
                Nada é gravado antes do seu clique.
              </div>
              {candidatas.length > 1 && (
                <label className="field"><span className="field__label">Cotação do fornecedor</span>
                  <select className="input" value={cotId} onChange={(e) => setCotId(e.target.value)}>
                    {candidatas.map((c) => <option key={c.id} value={c.id}>{c.numero_documento} — {c.fornecedor} ({c.status})</option>)}
                  </select>
                </label>
              )}
              <div><b>{cot.numero_documento}</b> · {cot.fornecedor} · {unidades.length} unidade(s) · situação: <b>{cot.status}</b></div>
              {jaRespondeu && (
                <label className="alert warning" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)}/>
                  <span>Este fornecedor <b>já respondeu pelo formulário</b>. Marque para <b>substituir</b> os valores pelos conferidos do e-mail (a resposta anterior fica guardada no registro).</span>
                </label>
              )}

              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Preço por unidade ({termos.moeda || 'USD'})</div>
                <table className="t pcp-grid" style={{ width: '100%' }}>
                  <thead><tr><th>Unidade</th><th>Qtd</th><th>Preço unitário</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {unidades.map((u) => (
                      <tr key={u.unidade_id}>
                        <td><b>{u.identificador || u.unidade_id}</b><div className="small muted">{[u.modelo, u.capacidade_kg ? u.capacidade_kg + ' kg' : '', u.paradas ? u.paradas + ' paradas' : ''].filter(Boolean).join(' · ')}</div></td>
                        <td>{u.quantidade}</td>
                        <td><input className="input" style={{ maxWidth: 140 }} inputMode="decimal" value={precos[u.unidade_id] || ''} onChange={(e) => setPrecos((p) => ({ ...p, [u.unidade_id]: e.target.value }))} placeholder="0,00"/></td>
                        <td style={{ textAlign: 'right' }}>{fmt(numero(precos[u.unidade_id]) * u.quantidade)}</td>
                      </tr>
                    ))}
                    <tr><td colSpan={3} style={{ textAlign: 'right' }}><b>Total geral</b></td><td style={{ textAlign: 'right' }}><b>{fmt(totalGeral)}</b></td></tr>
                  </tbody>
                </table>
                {semPreco.length > 0 && <div className="small" style={{ color: 'var(--warning, #b7791f)', marginTop: 4 }}>Falta preço em: {semPreco.map((u) => u.identificador || u.unidade_id).join(', ')}.</div>}
              </div>

              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Valores encontrados no e-mail {sugestao && sugestao.valores.length === 0 ? '— nenhum' : ''}</div>
                {sugestao && sugestao.avisos.map((a) => <div key={a} className="small muted">• {a}</div>)}
                {atrib.map((v, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px 190px', gap: 8, alignItems: 'center', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <b>{fmt(v.valor)}</b>
                    <span className="small muted" title={v.linha} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{v.linha}” <span style={{ color: corConf[v.confianca] }}>· confiança {v.confianca}</span></span>
                    <select className="input" value={v.tipo === 'total' ? 'total' : 'unitario'} onChange={(e) => atribuir(i, { tipo: e.target.value })}>
                      <option value="unitario">preço unitário</option><option value="total">total da linha</option>
                    </select>
                    <select className="input" value={v.unidadeId || ''} onChange={(e) => atribuir(i, { unidadeId: e.target.value || null })}>
                      <option value="">— não usar —</option>
                      {unidades.map((u) => <option key={u.unidade_id} value={u.unidade_id}>{u.identificador || u.unidade_id}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Condições</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label className="field"><span className="field__label">Moeda</span>
                    <select className="input" value={termos.moeda || 'USD'} onChange={(e) => setTermos((t) => ({ ...t, moeda: e.target.value }))}>
                      {['USD', 'EUR', 'CNY', 'BRL'].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  {IP_TERMOS.map(([k, rot]) => (
                    <label key={k} className="field"><span className="field__label">{rot}</span>
                      <input className="input" value={termos[k] || ''} onChange={(e) => setTermos((t) => ({ ...t, [k]: e.target.value }))}/>
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)}/>
                <span>Conferi os valores e as condições com o e-mail do fornecedor.</span>
              </label>
            </>
          )}
        </div>
        <div className="modal__foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!podeRegistrar} onClick={registrar}>{salvando ? 'Registrando…' : 'Registrar resposta do fornecedor'}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InboxModalPrecoEmail });
