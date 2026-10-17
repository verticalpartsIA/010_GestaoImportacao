/* ============================================================
   cotacao-varejo.jsx — portal PÚBLICO do fornecedor (/cotacao-varejo/<token>), trilíngue (EN · PT · 中文).
   Fala só com as RPCs public_ivc_obter / public_ivc_visualizado / public_ivc_responder (token do convite): o fornecedor vê
   apenas os itens do lote dele e nunca os preços de outros fornecedores. Preço por faixa de quantidade, prazo e MOQ.
   ============================================================ */
const { useState, useEffect } = React;

const T = (en, pt, zh) => en + ' · ' + pt + ' · ' + zh;
const NFAIXAS = 3;

function tokenDaUrl() {
  const p = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(p[p.length - 1] || '');
}
function sbc() { return window.__VP_SB.sb; }

function inicial(item, resp) {
  const f = ((resp && resp.faixas) || []).map((x) => ({ min: String(x.min), preco: String(x.preco) }));
  while (f.length < NFAIXAS) f.push({ min: f.length === 0 ? '1' : '', preco: '' });
  return { f, lt: resp && resp.lead_time_dias != null ? String(resp.lead_time_dias) : '', moq: resp && resp.moq != null ? String(resp.moq) : '', obs: (resp && resp.obs) || '', foto: (resp && resp.foto_fornecedor) || '' };
}
function num(v) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }

function Caixa({ children, tom }) {
  return <div style={{ maxWidth: 720, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e0', fontFamily: 'Poppins, Arial, sans-serif', color: tom || '#222' }}>{children}</div>;
}

function Portal() {
  const token = tokenDaUrl();
  const [dados, setDados] = useState(undefined);        // undefined = carregando, null = link inválido
  const [form, setForm] = useState({});
  const [moeda, setMoeda] = useState('USD');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    sbc().rpc('public_ivc_obter', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setDados(null); return; }
      setDados(data);
      setMoeda(data.convite.moeda || 'USD');
      const m = {}; (data.respostas || []).forEach((r) => { m[r.item_id] = r; });
      const f = {}; data.itens.forEach((i) => { f[i.id] = inicial(i, m[i.id]); });
      setForm(f);
      sbc().rpc('public_ivc_visualizado', { p_token: token }).then(() => {});
    });
  }, []);

  if (dados === undefined) return <Caixa>{T('Loading…', 'Carregando…', '加载中…')}</Caixa>;
  if (dados === null) return <Caixa><h2>{T('Invalid or expired link', 'Link inválido ou expirado', '链接无效或已过期')}</h2><p>{T('Please ask VerticalParts for a new link.', 'Peça um novo link à VerticalParts.', '请向 VerticalParts 索取新链接。')}</p></Caixa>;

  const { convite, lote, itens } = dados;
  const encerrado = lote.encerrado;

  const set = (id, campo, v) => setForm((p) => ({ ...p, [id]: { ...p[id], [campo]: v } }));
  const setFaixa = (id, idx, campo, v) => setForm((p) => { const f = p[id].f.map((x, i) => (i === idx ? { ...x, [campo]: v } : x)); return { ...p, [id]: { ...p[id], f } }; });

  const enviar = async () => {
    setEnviando(true); setErro(null);
    const respostas = itens.map((i) => {
      const x = form[i.id];
      const faixas = x.f.filter((r) => num(r.preco) > 0).map((r) => ({ min: Math.max(1, num(r.min) || 1), preco: num(r.preco) }));
      return { item_id: i.id, faixas, lead_time_dias: x.lt === '' ? null : Math.round(num(x.lt)), moq: x.moq === '' ? null : num(x.moq), obs: x.obs, foto_fornecedor: x.foto };
    }).filter((r) => r.faixas.length || r.lead_time_dias != null || r.moq != null || r.obs);
    if (!respostas.length) { setErro(T('Fill in at least one price.', 'Preencha ao menos um preço.', '请至少填写一个价格。')); setEnviando(false); return; }
    const { data, error } = await sbc().rpc('public_ivc_responder', { p_token: token, p_respostas: respostas, p_moeda: moeda });
    setEnviando(false);
    if (error || !data || !data.ok) {
      setErro(data && data.erro === 'cotacao_encerrada' ? T('This quotation is closed.', 'Esta cotação foi encerrada.', '此询价已关闭。') : T('Could not save. Try again.', 'Não foi possível salvar. Tente novamente.', '保存失败，请重试。'));
      return;
    }
    setFeito(true); window.scrollTo(0, 0);
  };

  const th = { textAlign: 'left', padding: '8px 6px', fontSize: 12, borderBottom: '2px solid #222', background: '#ece9e0', position: 'sticky', top: 0 };
  const td = { padding: '8px 6px', borderBottom: '1px solid #e5e5e0', verticalAlign: 'top', fontSize: 13 };
  const inp = { padding: '6px 8px', border: '1px solid #bbb', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'Poppins, Arial, sans-serif', color: '#222', maxWidth: 1180, margin: '0 auto', padding: '20px 12px 60px' }}>
      <div style={{ background: '#111', color: '#fff', padding: '16px 20px', borderRadius: 12, borderBottom: '4px solid #f6c000' }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: '#f6c000' }}>VERTICALPARTS</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>{T('Request for Quotation', 'Solicitação de Cotação', '询价单')} {lote.numero}</h1>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 4 }}>{convite.fornecedor_nome}{convite.rodada > 1 ? ' — ' + T('updated round ' + convite.rodada, 'rodada atualizada ' + convite.rodada, '更新报价第 ' + convite.rodada + ' 轮') : ''}</div>
      </div>

      {feito && <div style={{ background: '#e6f6ea', border: '1px solid #8bc79a', padding: 14, borderRadius: 10, marginTop: 14 }}><b>{T('Thank you! Your quotation was received.', 'Obrigado! Sua cotação foi recebida.', '谢谢！我们已收到您的报价。')}</b> {T('You can edit and send again while the request is open.', 'Você pode editar e enviar de novo enquanto a solicitação estiver aberta.', '询价未关闭前，您可以修改并重新提交。')}</div>}
      {encerrado && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 14, borderRadius: 10, marginTop: 14 }}><b>{T('This quotation is closed.', 'Esta cotação foi encerrada.', '此询价已关闭。')}</b></div>}

      <p style={{ fontSize: 13, lineHeight: 1.5, margin: '14px 2px' }}>
        {T('Enter the unit price for each item. If your price changes with quantity, use the quantity breaks (e.g. from 1 pc: 4.10; from 100 pcs: 3.80). Lead time in days; MOQ = minimum order quantity.',
          'Informe o preço unitário de cada item. Se o preço muda com a quantidade, use as faixas (ex.: a partir de 1 un.: 4,10; a partir de 100 un.: 3,80). Prazo em dias; MOQ = quantidade mínima de pedido.',
          '请填写每个产品的单价。如价格随数量变化，请使用数量阶梯（例如：1 件起 4.10；100 件起 3.80）。交货期以天计；MOQ = 最小起订量。')}
      </p>

      <div style={{ margin: '0 0 10px', fontSize: 13 }}>
        <label>{T('Currency', 'Moeda', '币种')}: <select value={moeda} onChange={(e) => setMoeda(e.target.value)} disabled={encerrado} style={{ ...inp, width: 'auto' }}><option value="USD">USD</option><option value="BRL">BRL</option></select></label>
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e5e5e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr>
              <th style={th}>{T('Photo', 'Foto', '图片')}</th>
              <th style={th}>REF.</th>
              <th style={th}>{T('Description', 'Descrição', '描述')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{T('Qty', 'Qtd.', '数量')}</th>
              <th style={th}>{T('Price by quantity (from qty → unit price)', 'Preço por quantidade (a partir de → preço unit.)', '阶梯价（起订数量 → 单价）')}</th>
              <th style={th}>{T('Lead time (days)', 'Prazo (dias)', '交货期（天）')}</th>
              <th style={th}>MOQ</th>
              <th style={th}>{T('Remarks', 'Observações', '备注')}</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const x = form[i.id]; if (!x) return null;
              return (
                <tr key={i.id}>
                  <td style={td}><div style={{ display: 'flex', gap: 6 }}>{[i.foto_url, i.foto_url2].filter(Boolean).map((u, k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" title="Click to enlarge · 点击放大"><img src={u} alt={i.codigo} style={{ width: 96, height: 96, objectFit: 'contain', background: '#fff', border: '1px solid #e5e5df', borderRadius: 6 }} /></a>)}{!i.foto_url && <div style={{ width: 64, height: 64, background: '#f0f0ec', borderRadius: 6 }} />}</div></td>
                  <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{i.codigo}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{i.descricao}{i.obs_vp && <div style={{ fontSize: 12, color: '#8a6d00', marginTop: 4 }}>VerticalParts: {i.obs_vp}</div>}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><b>{Number(i.quantidade).toLocaleString('en-US')}</b> {i.unidade || ''}</td>
                  <td style={{ ...td, minWidth: 250 }}>
                    {x.f.map((r, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#666', width: 38 }}>{idx === 0 ? T('from', 'de', '起') : ''}</span>
                        <input style={{ ...inp, width: 70 }} inputMode="decimal" placeholder="qty" value={r.min} disabled={encerrado} onChange={(e) => setFaixa(i.id, idx, 'min', e.target.value)} />
                        <span>→</span>
                        <input style={{ ...inp, width: 96 }} inputMode="decimal" placeholder={moeda} value={r.preco} disabled={encerrado} onChange={(e) => setFaixa(i.id, idx, 'preco', e.target.value)} />
                      </div>
                    ))}
                  </td>
                  <td style={td}><input style={{ ...inp, width: 80 }} inputMode="numeric" value={x.lt} disabled={encerrado} onChange={(e) => set(i.id, 'lt', e.target.value)} /></td>
                  <td style={td}><input style={{ ...inp, width: 80 }} inputMode="decimal" value={x.moq} disabled={encerrado} onChange={(e) => set(i.id, 'moq', e.target.value)} /></td>
                  <td style={td}>
                    <textarea style={{ ...inp, minHeight: 54 }} value={x.obs} disabled={encerrado} onChange={(e) => set(i.id, 'obs', e.target.value)} />
                    <input style={{ ...inp, marginTop: 4, fontSize: 12 }} placeholder={T('Your photo/drawing link (optional)', 'Link da sua foto/desenho (opcional)', '您的图片/图纸链接（可选）')} value={x.foto} disabled={encerrado} onChange={(e) => set(i.id, 'foto', e.target.value)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10, marginTop: 14 }}>{erro}</div>}
      {!encerrado && (
        <div style={{ marginTop: 16 }}>
          <button onClick={enviar} disabled={enviando} style={{ background: '#f6c000', border: 0, padding: '12px 28px', fontSize: 15, fontWeight: 800, borderRadius: 8, cursor: 'pointer' }}>
            {enviando ? '…' : T('Send quotation', 'Enviar cotação', '提交报价')}
          </button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('cv-root')).render(<Portal />);
