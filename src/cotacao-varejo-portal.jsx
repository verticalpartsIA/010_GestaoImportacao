/* ============================================================
   cotacao-varejo.jsx — portal PÚBLICO do fornecedor (/cotacao-varejo/<token>), trilíngue (EN · PT · 中文).
   Fala só com as RPCs public_ivc_obter / public_ivc_visualizado / public_ivc_responder (token do convite): o fornecedor vê
   apenas os itens do lote dele e nunca os preços de outros fornecedores. Preço por faixa de quantidade, prazo e MOQ.
   ============================================================ */
const { useState, useEffect } = React;

const T = (en, pt, zh) => en + ' · ' + pt + ' · ' + zh;
const NFAIXAS = 3;
const MAX_FOTOS = 5;

function tokenDaUrl() {
  const p = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(p[p.length - 1] || '');
}
function sbc() { return window.__VP_SB.sb; }

function inicial(item, resp) {
  const f = ((resp && resp.faixas) || []).map((x) => ({ min: String(x.min), preco: String(x.preco) }));
  while (f.length < NFAIXAS) f.push({ min: f.length === 0 ? '1' : '', preco: '' });
  return { f, lt: resp && resp.lead_time_dias != null ? String(resp.lead_time_dias) : '', moq: resp && resp.moq != null ? String(resp.moq) : '', obs: (resp && resp.obs) || '', foto: (resp && resp.foto_fornecedor) || '', fotos: (resp && Array.isArray(resp.fotos_fornecedor)) ? resp.fotos_fornecedor : [] };
}
function num(v) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
/* Preço que SOBE quando a quantidade sobe (provável erro de digitação, ex.: 3,70 → 37). Só avisa. */
function faixasForaDeOrdem(f) {
  const l = f.filter((r) => num(r.preco) > 0).map((r) => ({ min: Math.max(1, num(r.min) || 1), preco: num(r.preco) })).sort((a, b) => a.min - b.min);
  for (let k = 1; k < l.length; k++) { if (l[k].min > l[k - 1].min && l[k].preco > l[k - 1].preco) return { de: l[k - 1], para: l[k], salto: l[k].preco >= l[k - 1].preco * 5 }; }
  return null;
}

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
  const [subindo, setSubindo] = useState(null);
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    sbc().rpc('public_ivc_obter', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setDados(null); return; }
      setDados(data);
      setMoeda(data.convite.moeda || 'USD');
      const m = {}; (data.respostas || []).forEach((r) => { m[r.item_id] = r; });
      const f = {}; data.itens.forEach((i) => { f[i.id] = inicial(i, m[i.id]); });
      // Lote grande: o que foi digitado e ainda não enviado volta sozinho (guardado só neste navegador).
      try {
        // Rascunho = {v:2, rodada, respondido_em, moeda, form}. Só vale se for da MESMA rodada e do mesmo estado de resposta do servidor
        // (senão é um rascunho velho de uma versão já enviada/renegociada). Vale também para item já respondido (edição ainda não enviada).
        const salvo = JSON.parse(localStorage.getItem('ivc-rascunho:' + token) || 'null');
        if (salvo && salvo.v === 2 && salvo.rodada === data.convite.rodada && (salvo.respondido_em || null) === (data.convite.respondido_em || null)) {
          data.itens.forEach((i) => { const sv = salvo.form && salvo.form[i.id]; if (sv && Array.isArray(sv.f) && sv.f.length === NFAIXAS) f[i.id] = sv; });
          if (salvo.moeda) setMoeda(salvo.moeda);
        }
      } catch (e) { /* sem rascunho */ }
      setForm(f);
      sbc().rpc('public_ivc_visualizado', { p_token: token }).then(() => {});
    });
  }, []);

  useEffect(() => {
    if (!dados || feito || !Object.keys(form).length) return;
    const t = setTimeout(() => { try { localStorage.setItem('ivc-rascunho:' + token, JSON.stringify({ v: 2, rodada: dados.convite.rodada, respondido_em: dados.convite.respondido_em || null, moeda, form })); } catch (e) { /* armazenamento bloqueado */ } }, 600);
    return () => clearTimeout(t);
  }, [form, moeda]);

  if (dados === undefined) return <Caixa>{T('Loading…', 'Carregando…', '加载中…')}</Caixa>;
  if (dados === null) return <Caixa><h2>{T('Invalid or expired link', 'Link inválido ou expirado', '链接无效或已过期')}</h2><p>{T('Please ask VerticalParts for a new link.', 'Peça um novo link à VerticalParts.', '请向 VerticalParts 索取新链接。')}</p></Caixa>;

  const { convite, lote, itens } = dados;
  const encerrado = lote.encerrado;

  const set = (id, campo, v) => setForm((p) => ({ ...p, [id]: { ...p[id], [campo]: v } }));
  const setFaixa = (id, idx, campo, v) => setForm((p) => { const f = p[id].f.map((x, i) => (i === idx ? { ...x, [campo]: v } : x)); return { ...p, [id]: { ...p[id], f } }; });

  const addFotos = async (itemId, files) => {
    const lista = Array.from(files || []).filter((f) => /^image\//.test(f.type || ''));
    if (!lista.length) return;
    setSubindo(itemId); setErro(null);
    try {
      let fotos = (form[itemId] && form[itemId].fotos) || [];
      for (const f of lista) {
        if (fotos.length >= MAX_FOTOS) break;
        if (f.size > 8 * 1024 * 1024) { setErro(T('Image larger than 8 MB was skipped.', 'Imagem maior que 8 MB foi ignorada.', '已跳过超过 8 MB 的图片。')); continue; }
        const ext = ((f.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
        const path = 'cotacoes-varejo/fornecedor/' + token + '/' + itemId + '/' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
        const up = await sbc().storage.from('engenharia').upload(path, f, { upsert: false, contentType: f.type });
        if (up.error) throw up.error;
        fotos = fotos.concat([sbc().storage.from('engenharia').getPublicUrl(path).data.publicUrl]);
        set(itemId, 'fotos', fotos);
      }
    } catch (e) { setErro(T('Could not upload the photo. Try again.', 'Não foi possível enviar a foto. Tente novamente.', '图片上传失败，请重试。')); }
    setSubindo(null);
  };

  const enviar = async () => {
    setEnviando(true); setErro(null);
    const respostas = itens.map((i) => {
      const x = form[i.id];
      const faixas = x.f.filter((r) => num(r.preco) > 0).map((r) => ({ min: Math.max(1, num(r.min) || 1), preco: num(r.preco) }));
      return { item_id: i.id, faixas, lead_time_dias: x.lt === '' ? null : Math.round(num(x.lt)), moq: x.moq === '' ? null : num(x.moq), obs: x.obs, foto_fornecedor: x.foto, fotos_fornecedor: x.fotos };
    }).filter((r) => r.faixas.length || r.lead_time_dias != null || r.moq != null || r.obs || (r.fotos_fornecedor || []).length);
    if (!respostas.length) { setErro(T('Fill in at least one price.', 'Preencha ao menos um preço.', '请至少填写一个价格。')); setEnviando(false); return; }
    const fora = itens.filter((i) => form[i.id] && faixasForaDeOrdem(form[i.id].f));
    if (fora.length && !window.confirm(T('The price goes UP with quantity for: ' + fora.map((i) => i.codigo).join(', ') + '. Normally a larger quantity has a lower or equal price. Send anyway?', 'O preço SOBE com a quantidade em: ' + fora.map((i) => i.codigo).join(', ') + '. Normalmente quantidade maior tem preço menor ou igual. Enviar mesmo assim?', '以下产品的单价随数量增加而上升：' + fora.map((i) => i.codigo).join(', ') + '。通常数量越大单价越低或相同。仍要提交吗？'))) { setEnviando(false); return; }
    const semFoto = respostas.filter((r) => r.faixas.length && !(r.fotos_fornecedor || []).length).length;
    if (semFoto && !window.confirm(T(semFoto + ' priced item(s) have no photo of your product. Send anyway?', semFoto + ' item(ns) com preço estão sem foto do seu produto. Enviar mesmo assim?', semFoto + ' 个已报价产品没有您的产品照片。仍要提交吗？'))) { setEnviando(false); return; }
    const { data, error } = await sbc().rpc('public_ivc_responder', { p_token: token, p_respostas: respostas, p_moeda: moeda });
    setEnviando(false);
    if (error || !data || !data.ok) {
      setErro(data && data.erro === 'cotacao_encerrada' ? T('This quotation is closed.', 'Esta cotação foi encerrada.', '此询价已关闭。') : T('Could not save. Try again.', 'Não foi possível salvar. Tente novamente.', '保存失败，请重试。'));
      return;
    }
    try { localStorage.removeItem('ivc-rascunho:' + token); } catch (e) { /* ok */ }
    setFeito(true); window.scrollTo(0, 0);
  };

  /* Planilha (CSV abre no Excel): baixa com os nossos itens, o fornecedor preenche e importa de volta — sem digitar item por item. */
  const CSV_COLS = ['ref', 'description', 'qty_needed', 'unit', 'from_qty_1', 'unit_price_1', 'from_qty_2', 'unit_price_2', 'from_qty_3', 'unit_price_3', 'lead_time_days', 'moq', 'remarks'];
  const csvCel = (v) => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const baixarPlanilha = () => {
    const linhas = itens.map((i) => { const x = form[i.id] || inicial(i, null); return [i.codigo, i.descricao || '', i.quantidade, i.unidade || '', x.f[0].min, x.f[0].preco, x.f[1].min, x.f[1].preco, x.f[2].min, x.f[2].preco, x.lt, x.moq, x.obs]; });
    const csv = '\ufeff' + [CSV_COLS].concat(linhas).map((r) => r.map(csvCel).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = lote.numero + '-quotation.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const lerCSV = (txt) => {
    const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = []; let r = []; let c = ''; let q = false;
    for (let k = 0; k < txt.length; k++) {
      const ch = txt[k];
      if (q) { if (ch === '"') { if (txt[k + 1] === '"') { c += '"'; k++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { r.push(c); c = ''; }
      else if (ch === '\n') { r.push(c); rows.push(r); r = []; c = ''; }
      else if (ch !== '\r') c += ch;
    }
    if (c !== '' || r.length) { r.push(c); rows.push(r); }
    return rows;
  };
  const importarPlanilha = async (file) => {
    if (!file) return;
    try {
      const rows = lerCSV((await file.text()).replace(/^\ufeff/, ''));
      const cab = (rows[0] || []).map((h) => String(h).trim().toLowerCase()); const col = (n) => cab.indexOf(n);
      if (col('ref') < 0) throw new Error('x');
      let n = 0; const novo = { ...form };
      rows.slice(1).forEach((r) => {
        const it = itens.find((i) => String(i.codigo).toUpperCase() === String(r[col('ref')] || '').trim().toUpperCase()); if (!it) return;
        const g = (nome) => (col(nome) >= 0 ? String(r[col(nome)] == null ? '' : r[col(nome)]).trim() : '');
        const base = novo[it.id] || inicial(it, null);
        const f = base.f.map((x, idx) => ({ min: g('from_qty_' + (idx + 1)) || (idx === 0 ? '1' : ''), preco: g('unit_price_' + (idx + 1)) }));
        novo[it.id] = { ...base, f, lt: g('lead_time_days') || base.lt, moq: g('moq') || base.moq, obs: g('remarks') || base.obs }; n++;
      });
      setForm(novo); setErro(null);
      setAviso(T(n + ' item(s) loaded from the file. Review and click Send.', n + ' item(ns) carregados da planilha. Confira e clique em Enviar.', '已从文件载入 ' + n + ' 个产品。请核对后点击提交。'));
    } catch (e) { setErro(T('Could not read the file. Use the template downloaded here (CSV).', 'Não consegui ler o arquivo. Use o modelo baixado aqui (CSV).', '无法读取文件。请使用此处下载的模板（CSV）。')); }
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
        {T('Enter the UNIT price of each item. The "Qty" column is how many we need. Each price row reads "from N pieces, each piece costs X": row 1 is normally from 1 piece (or your MOQ); use rows 2 and 3 only if the price drops for bigger quantities (e.g. from 1 pc: 4.10; from 100 pcs: 3.80). Leave them empty if the price is the same. Lead time in days; MOQ = minimum order quantity.',
          'Informe o preço UNITÁRIO de cada item. A coluna "Qtd." é quanto precisamos. Cada linha de preço significa "a partir de N peças, cada peça custa X": a linha 1 normalmente é a partir de 1 peça (ou do seu MOQ); use as linhas 2 e 3 só se o preço cai para quantidades maiores (ex.: a partir de 1 un.: 4,10; a partir de 100 un.: 3,80). Deixe vazias se o preço for o mesmo. Prazo em dias; MOQ = quantidade mínima de pedido.',
          '请填写每个产品的单价。“数量”列是我们需要的数量。每一行价格表示“从 N 件起，每件 X”：第 1 行通常是 1 件起（或您的 MOQ）；仅当数量更大价格更低时才填写第 2、3 行（例如：1 件起 4.10；100 件起 3.80）；价格相同则留空。交货期以天计；MOQ = 最小起订量。')}
      </p>

      <div style={{ margin: '0 0 10px', fontSize: 13 }}>
        {!encerrado && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input style={{ ...inp, width: 260 }} placeholder={T('Search item by REF. or description…', 'Buscar item por REF. ou descrição…', '按编号或描述搜索…')} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button type="button" onClick={baixarPlanilha} style={{ ...inp, width: 'auto', cursor: 'pointer', background: '#fff' }}>{T('Download spreadsheet (CSV)', 'Baixar planilha (CSV)', '下载表格（CSV）')}</button>
            <label style={{ ...inp, width: 'auto', cursor: 'pointer', background: '#fff' }}>{T('Upload filled spreadsheet', 'Enviar planilha preenchida', '上传已填写的表格')}<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { importarPlanilha(e.target.files && e.target.files[0]); e.target.value = ''; }} /></label>
            <span style={{ fontSize: 11, color: '#666' }}>{T('Your typing is kept on this computer until you send.', 'O que você digita fica guardado neste computador até enviar.', '您输入的内容会保存在本机，直到提交。')}</span>
          </div>
        )}
        {aviso && <div style={{ background: '#e6f6ea', border: '1px solid #8bc79a', padding: 8, borderRadius: 8, marginBottom: 8, fontSize: 13 }}>{aviso}</div>}
        <label>{T('Currency', 'Moeda', '币种')}: <select value={moeda} onChange={(e) => setMoeda(e.target.value)} disabled={encerrado} style={{ ...inp, width: 'auto' }}><option value="USD">USD</option><option value="RMB">RMB (CNY)</option><option value="EUR">EUR</option><option value="BRL">BRL</option></select></label>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '78vh', background: '#fff', borderRadius: 12, border: '1px solid #e5e5e0' }}>
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
            {itens.filter((i) => { const t = busca.trim().toLowerCase(); return !t || ((i.codigo || '') + ' ' + (i.descricao || '')).toLowerCase().includes(t); }).map((i) => {
              const x = form[i.id]; if (!x) return null;
              return (
                <tr key={i.id}>
                  <td style={td}><div style={{ display: 'flex', gap: 6 }}>{[i.foto_url, i.foto_url2].concat(i.fotos_manuais || []).filter(Boolean).map((u, k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" title="Click to enlarge · 点击放大"><img src={u} alt={i.codigo} style={{ width: 96, height: 96, objectFit: 'contain', background: '#fff', border: '1px solid #e5e5df', borderRadius: 6 }} /></a>)}{!i.foto_url && !(i.fotos_manuais || []).length && <div style={{ width: 64, height: 64, background: '#f0f0ec', borderRadius: 6 }} />}</div></td>
                  <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{i.codigo}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{i.descricao}{i.obs_vp && <div style={{ fontSize: 12, color: '#8a6d00', marginTop: 4, whiteSpace: 'pre-wrap' }}><b>VerticalParts:</b> {i.obs_vp}</div>}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><b>{Number(i.quantidade).toLocaleString('en-US')}</b> {i.unidade || T('pcs', 'un.', '件')}<div style={{ fontSize: 10, color: '#666' }}>{T('we need', 'precisamos', '需求量')}</div></td>
                  <td style={{ ...td, minWidth: 250 }}>
                    {x.f.map((r, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#666', width: 60, lineHeight: 1.2 }}>{T('from', 'a partir de', '起')}</span>
                        <input style={{ ...inp, width: 70 }} inputMode="decimal" placeholder="qty" value={r.min} disabled={encerrado} onChange={(e) => setFaixa(i.id, idx, 'min', e.target.value)} />
                        <span>→</span>
                        <input style={{ ...inp, width: 96 }} inputMode="decimal" placeholder={moeda} value={r.preco} disabled={encerrado} onChange={(e) => setFaixa(i.id, idx, 'preco', e.target.value)} />
                      </div>
                    ))}
                    {(() => { const fo = faixasForaDeOrdem(x.f); return fo ? <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>{T('Price goes up with quantity (' + fo.de.preco + ' → ' + fo.para.preco + ')' + (fo.salto ? ' — is there a typo? Please check.' : '. Please check.'), 'O preço sobe com a quantidade (' + fo.de.preco + ' → ' + fo.para.preco + ')' + (fo.salto ? ' — digitou errado? Confira.' : '. Confira.'), '单价随数量上升（' + fo.de.preco + ' → ' + fo.para.preco + '）' + (fo.salto ? ' — 是否输入有误？请检查。' : '。请检查。'))}</div> : null; })()}
                  </td>
                  <td style={td}><input style={{ ...inp, width: 80 }} inputMode="numeric" value={x.lt} disabled={encerrado} onChange={(e) => set(i.id, 'lt', e.target.value)} /></td>
                  <td style={td}><input style={{ ...inp, width: 80 }} inputMode="decimal" value={x.moq} disabled={encerrado} onChange={(e) => set(i.id, 'moq', e.target.value)} /></td>
                  <td style={td}>
                    <div style={{ fontSize: 11, color: '#8a6d00', marginBottom: 3 }}>{T('Does your product match? Say if it is identical or different (size, material, finish…).', 'Seu produto atende? Diga se é idêntico ou se há diferenças (medida, material, acabamento…).', '您的产品是否符合？请说明是否一致或有差异（尺寸、材质、表面处理等）。')}</div>
                    <textarea style={{ ...inp, minHeight: 54 }} value={x.obs} disabled={encerrado} onChange={(e) => set(i.id, 'obs', e.target.value)} />
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <div style={{ color: '#8a6d00', marginBottom: 3 }}>{T('Please send photos of YOUR product so we can compare.', 'Envie fotos do SEU produto para podermos comparar.', '请上传您产品的照片，以便我们对比。')}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {x.fotos.map((u) => (
                          <span key={u} style={{ position: 'relative' }}>
                            <a href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }} /></a>
                            {!encerrado && <button type="button" onClick={() => set(i.id, 'fotos', x.fotos.filter((y) => y !== u))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 0, background: '#c00', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>}
                          </span>
                        ))}
                      </div>
                      {!encerrado && x.fotos.length < MAX_FOTOS && (
                        <label style={{ display: 'inline-block', marginTop: 4, padding: '5px 10px', border: '1px dashed #999', borderRadius: 6, cursor: 'pointer' }}>
                          {subindo === i.id ? '…' : T('+ Your photos (' + x.fotos.length + '/' + MAX_FOTOS + ')', '+ Suas fotos (' + x.fotos.length + '/' + MAX_FOTOS + ')', '+ 您的图片（' + x.fotos.length + '/' + MAX_FOTOS + '）')}
                          <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={subindo === i.id} onChange={(e) => { addFotos(i.id, e.target.files); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
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
