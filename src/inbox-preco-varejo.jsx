/* ============================================================
   inbox-preco-varejo.jsx — Inbox: resposta de fornecedor de COTAÇÃO DE VAREJO recebida por e-mail → mapa do lote (20/10/2026).
   Mesmo desenho do "Extrair preço" do RFQ de elevador (inbox-preco.jsx): lê o texto do e-mail por REGRAS (inbox-preco-calc.js, sem IA),
   PROPÕE preço por produto (identificado pelo código do item) e só grava depois que uma pessoa confere e marca "Conferi".
   Grava em iv_cotacao_respostas pelo CotacoesVarejoStore.registrarRespostaPorEmail (preço = faixa única a partir de 1 un.).
   window.InboxModalPrecoVarejo
   ============================================================ */
function InboxModalPrecoVarejo({ email, eu, onClose, onRegistrado }) {
  const S = window.CotacoesVarejoStore;
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [corpo, setCorpo] = React.useState('');
  const [convites, setConvites] = React.useState([]);          // candidatos (o ligado ao e-mail, ou todos os abertos)
  const [conviteId, setConviteId] = React.useState('');
  const [itens, setItens] = React.useState([]);
  const [existentes, setExistentes] = React.useState([]);
  const [precos, setPrecos] = React.useState({});              // { item_id: { preco, lt, moq, obs } }
  const [moeda, setMoeda] = React.useState('USD');
  const [achados, setAchados] = React.useState([]);
  const [conferi, setConferi] = React.useState(false);
  const [substituir, setSubstituir] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const convite = convites.find((c) => c.id === conviteId) || null;

  /* 1) corpo do e-mail + convite ligado (referencia_id) ou lista dos convites abertos para escolher */
  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sb = window.__VP_SB.sb;
        const { data: row, error } = await sb.from('emails_projeto').select('referencia_tipo,referencia_id,corpo_texto,corpo_html').eq('id', email.id).maybeSingle();
        if (error) throw error;
        const texto = (row && row.corpo_texto) || String((row && row.corpo_html) || email.preview || '').replace(/<[^>]+>/g, ' ');
        const todos = await S.convitesEmCotacao();
        const ligado = row && row.referencia_tipo === 'cotacao_varejo' && row.referencia_id ? todos.find((c) => c.id === row.referencia_id) : null;
        if (!vivo) return;
        setCorpo(texto);
        setConvites(ligado ? [ligado] : todos);
        setConviteId(ligado ? ligado.id : '');
        if (!todos.length) setErro('Não há nenhuma Cotação de Varejo em andamento para ligar a este e-mail.');
        else if (row && row.referencia_tipo === 'cotacao_varejo' && !ligado) setErro('O lote deste e-mail não está mais em cotação (foi aprovado ou cancelado).');
      } catch (e) { if (vivo) setErro('Não consegui ler o e-mail: ' + (e.message || e)); }
      finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [email.id]);

  /* 2) ao escolher o convite, carrega os itens do lote e propõe os preços lendo o e-mail */
  React.useEffect(() => {
    if (!convite) { setItens([]); return; }
    let vivo = true;
    (async () => {
      try {
        const c = window.__VP_SB.sb;
        const [it, rs] = await Promise.all([
          c.from('iv_cotacao_itens').select('id, codigo, descricao, unidade, quantidade_pedida, ordem').eq('lote_id', convite.lote_id).order('ordem').order('codigo'),
          c.from('iv_cotacao_respostas').select('*').eq('convite_id', convite.id),
        ]);
        if (it.error) throw it.error;
        if (!vivo) return;
        const lista = it.data || [];
        const unidades = lista.map((x, i) => ({ unidade_id: x.id, identificador: x.codigo, indice_ativo: i + 1, quantidade: Number(x.quantidade_pedida) || 1 }));
        const r = window.InboxPreco.extrair(corpo, unidades, { minValor: 0.01 });
        const base = {}; (rs.data || []).forEach((x) => { base[x.item_id] = x; });
        const p = {};
        lista.forEach((x) => { const e = base[x.id]; p[x.id] = { preco: '', lt: e && e.lead_time_dias != null ? String(e.lead_time_dias) : '', moq: e && e.moq != null ? String(e.moq) : '', obs: (e && e.obs) || '' }; });
        r.valores.forEach((v) => {
          if (!v.unidadeId || !p[v.unidadeId] || p[v.unidadeId].preco !== '') return;
          const q = (unidades.find((u) => u.unidade_id === v.unidadeId) || {}).quantidade || 1;
          const unit = v.tipo === 'total' ? v.valor / q : v.valor;
          p[v.unidadeId].preco = String(Math.round(unit * 10000) / 10000);
        });
        setItens(lista); setExistentes(rs.data || []); setPrecos(p); setAchados(r.valores);
        setMoeda(r.termos.moeda || convite.moeda || 'USD');
        setConferi(false); setSubstituir(false);
      } catch (e) { if (vivo) setErro('Não consegui carregar os itens do lote: ' + (e.message || e)); }
    })();
    return () => { vivo = false; };
  }, [conviteId, corpo]);

  const numero = (s) => { const n = window.InboxPreco.numeroDe(s); return n == null ? 0 : n; };
  const set = (id, campo, v) => setPrecos((p) => ({ ...p, [id]: { ...p[id], [campo]: v } }));
  const comPreco = itens.filter((i) => numero((precos[i.id] || {}).preco) > 0);
  const jaRespondeu = existentes.some((r) => Array.isArray(r.faixas) && r.faixas.length);
  const podeRegistrar = !!convite && comPreco.length > 0 && conferi && (!jaRespondeu || substituir) && !salvando;
  const fmt = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const registrar = async () => {
    setSalvando(true);
    try {
      const respostas = itens.map((i) => {
        const x = precos[i.id] || {};
        return { item_id: i.id, preco: numero(x.preco), lead_time_dias: x.lt === '' ? null : numero(x.lt), moq: x.moq === '' ? null : numero(x.moq), obs: x.obs || '' };
      });
      const r = await S.registrarRespostaPorEmail(convite, respostas, { emailId: email.id, por: eu, moeda, substituir });
      window.toast?.('Resposta registrada no mapa do lote (' + r.itens + ' item(ns)).', 'success');
      onRegistrado && onRegistrado(); onClose();
    } catch (e) { window.toast?.('Não consegui registrar: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };

  const abrirLote = () => { if (convite) { window.history.pushState({}, '', '/logistica/cotacoes-varejo/' + convite.lote_id); window.dispatchEvent(new PopStateEvent('popstate')); onClose(); } };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }} onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head"><b>Preço do e-mail → Cotação de Varejo</b><button className="ig-iconbtn" onClick={onClose} title="Fechar"><Icon.x size={14}/></button></div>
        <div className="modal__body" style={{ display: 'grid', gap: 14 }}>
          {carregando && <div className="muted">Lendo o e-mail…</div>}
          {!carregando && erro && <div className="alert warning"><Icon.warning/><div style={{ flex: 1 }}>{erro}</div></div>}
          {!carregando && !erro && (
            <>
              <div className="small muted">
                O sistema <b>propõe</b> os preços lendo o texto do e-mail, ligando cada valor ao <b>código do produto</b> (por regras — pode errar). Confira com o e-mail e só então registre.
                O preço entra como <b>preço unitário a partir de 1 un.</b>; se o fornecedor deu faixas por quantidade, é melhor ele usar o link do portal.
              </div>
              <label className="field"><span className="field__label">Fornecedor / lote</span>
                <select className="input" value={conviteId} onChange={(e) => setConviteId(e.target.value)}>
                  {convites.length !== 1 && <option value="">— escolha —</option>}
                  {convites.map((c) => <option key={c.id} value={c.id}>{c.lote_numero} — {c.fornecedor_nome} ({c.status})</option>)}
                </select>
              </label>
              {convite && jaRespondeu && (
                <label className="alert warning" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)}/>
                  <span>Este fornecedor <b>já tem preço no mapa</b> (pelo portal ou por e-mail). Marque para <b>substituir</b> pelos valores conferidos aqui (o anterior vai para o histórico se for outra rodada).</span>
                </label>
              )}
              {convite && (
                <>
                  <label className="field" style={{ maxWidth: 160 }}><span className="field__label">Moeda</span>
                    <select className="input" value={moeda} onChange={(e) => setMoeda(e.target.value)}>{['USD', 'EUR', 'CNY', 'BRL', 'RMB'].map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  </label>
                  <table className="t pcp-grid" style={{ width: '100%' }}>
                    <thead><tr><th>Código</th><th>Qtd.</th><th>Preço unit.</th><th>Prazo (d)</th><th>MOQ</th><th>Obs.</th></tr></thead>
                    <tbody>
                      {itens.map((i) => { const x = precos[i.id] || {}; return (
                        <tr key={i.id}>
                          <td><b>{i.codigo}</b><div className="small muted">{i.descricao}</div></td>
                          <td>{fmt(i.quantidade_pedida)}</td>
                          <td><input className="input" style={{ maxWidth: 110 }} inputMode="decimal" value={x.preco || ''} onChange={(e) => set(i.id, 'preco', e.target.value)} placeholder="0,00"/></td>
                          <td><input className="input" style={{ maxWidth: 70 }} inputMode="numeric" value={x.lt || ''} onChange={(e) => set(i.id, 'lt', e.target.value)}/></td>
                          <td><input className="input" style={{ maxWidth: 80 }} inputMode="decimal" value={x.moq || ''} onChange={(e) => set(i.id, 'moq', e.target.value)}/></td>
                          <td><input className="input" value={x.obs || ''} onChange={(e) => set(i.id, 'obs', e.target.value)}/></td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                  {!comPreco.length && <div className="small" style={{ color: 'var(--warning, #b7791f)' }}>Nenhum preço proposto — digite os preços na tabela.</div>}
                  <div>
                    <div className="field__label" style={{ marginBottom: 4 }}>Valores encontrados no e-mail {achados.length === 0 ? '— nenhum' : ''}</div>
                    {achados.map((v, i) => (
                      <div key={i} className="small" style={{ padding: '3px 0', borderTop: '1px solid var(--border)' }}>
                        <b>{fmt(v.valor)}</b> <span className="muted">“{v.linha}”</span> {v.unidadeId ? <span>→ {(itens.find((x) => x.id === v.unidadeId) || {}).codigo}</span> : <span className="muted">· sem produto identificado</span>}
                      </div>
                    ))}
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)}/>
                    <span>Conferi os valores com o e-mail do fornecedor.</span>
                  </label>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal__foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {convite && <Button variant="ghost" onClick={abrirLote}>Abrir o lote</Button>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!podeRegistrar} onClick={registrar}>{salvando ? 'Registrando…' : 'Registrar no mapa do lote'}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InboxModalPrecoVarejo });
