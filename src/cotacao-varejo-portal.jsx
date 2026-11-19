/* ============================================================
   cotacao-varejo.jsx — portal PÚBLICO do fornecedor (/cotacao-varejo/<token>), somente em inglês.
   Fala só com as RPCs public_ivc_obter / public_ivc_visualizado / public_ivc_responder (token do convite): o fornecedor vê
   apenas os itens do lote dele e nunca os preços de outros fornecedores. Preço por faixa de quantidade, prazo, observação, fotos e certificado (quando o item exige).
   ============================================================ */
const { useState, useEffect } = React;

const T = (en) => en; // portal somente em inglês (11/11/2026, pedido do Gelson)
const NFAIXAS = 1; // só a linha "a partir de 1 → preço" (pedido do Gelson, 11/11/2026)
const MAX_FOTOS = 5;
const CERT_MAX_MB = 10;

function tokenDaUrl() {
  const p = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(p[p.length - 1] || '');
}
function sbc() { return window.__VP_SB.sb; }

function inicial(item, resp) {
  const f = ((resp && resp.faixas) || []).slice(0, NFAIXAS).map((x) => ({ min: '1', preco: String(x.preco) }));
  while (f.length < NFAIXAS) f.push({ min: f.length === 0 ? '1' : '', preco: '' });
  return { f, lt: resp && resp.lead_time_dias != null ? String(resp.lead_time_dias) : '', cert: (resp && resp.certificado_url) ? { url: resp.certificado_url, nome: resp.certificado_nome || 'certificate' } : null, obs: (resp && resp.obs) || '', foto: (resp && resp.foto_fornecedor) || '', fotos: (resp && Array.isArray(resp.fotos_fornecedor)) ? resp.fotos_fornecedor : [] };
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
  const [gerando, setGerando] = useState(false);

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

  if (dados === undefined) return <Caixa>{T('Loading…')}</Caixa>;
  if (dados === null) return <Caixa><h2>{T('Invalid or expired link')}</h2><p>{T('Please ask VerticalParts for a new link.')}</p></Caixa>;

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
        if (f.size > 8 * 1024 * 1024) { setErro(T('Image larger than 8 MB was skipped.')); continue; }
        const ext = ((f.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
        const path = 'cotacoes-varejo/fornecedor/' + token + '/' + itemId + '/' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
        const up = await sbc().storage.from('engenharia').upload(path, f, { upsert: false, contentType: f.type });
        if (up.error) throw up.error;
        fotos = fotos.concat([sbc().storage.from('engenharia').getPublicUrl(path).data.publicUrl]);
        set(itemId, 'fotos', fotos);
      }
    } catch (e) { setErro(T('Could not upload the photo. Try again.')); }
    setSubindo(null);
  };

  const addCert = async (itemId, file) => {
    if (!file) return;
    if (!(/^image\//.test(file.type || '') || file.type === 'application/pdf')) { setErro(T('Please attach a PDF or an image.')); return; }
    if (file.size > CERT_MAX_MB * 1024 * 1024) { setErro(T('Certificate larger than ' + CERT_MAX_MB + ' MB.')); return; }
    setSubindo('cert:' + itemId); setErro(null);
    try {
      const ext = ((file.name || '').split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
      const path = 'cotacoes-varejo/fornecedor/' + token + '/' + itemId + '/cert-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
      const up = await sbc().storage.from('engenharia').upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      set(itemId, 'cert', { url: sbc().storage.from('engenharia').getPublicUrl(path).data.publicUrl, nome: (file.name || 'certificate').slice(0, 120) });
    } catch (e) { setErro(T('Could not upload the certificate. Try again.')); }
    setSubindo(null);
  };

  const enviar = async () => {
    setEnviando(true); setErro(null);
    const respostas = itens.map((i) => {
      const x = form[i.id];
      const faixas = x.f.filter((r) => num(r.preco) > 0).map((r) => ({ min: Math.max(1, num(r.min) || 1), preco: num(r.preco) }));
      return { item_id: i.id, faixas, lead_time_dias: x.lt === '' ? null : Math.round(num(x.lt)), obs: x.obs, foto_fornecedor: x.foto, fotos_fornecedor: x.fotos, certificado_url: x.cert ? x.cert.url : null, certificado_nome: x.cert ? x.cert.nome : null };
    }).filter((r) => r.faixas.length || r.lead_time_dias != null || r.obs || r.certificado_url || (r.fotos_fornecedor || []).length);
    if (!respostas.length) { setErro(T('Fill in at least one price.')); setEnviando(false); return; }
    const semCert = itens.filter((i) => i.exige_certificado && form[i.id] && form[i.id].f.some((r) => num(r.preco) > 0) && !form[i.id].cert);
    if (semCert.length) { setErro(T('Certificate required: please attach the certificate for ' + semCert.map((i) => i.codigo).join(', ') + ' before sending.')); setEnviando(false); return; }
    const fora = itens.filter((i) => form[i.id] && faixasForaDeOrdem(form[i.id].f));
    if (fora.length && !window.confirm(T('The price goes UP with quantity for: ' + fora.map((i) => i.codigo).join(', ') + '. Normally a larger quantity has a lower or equal price. Send anyway?'))) { setEnviando(false); return; }
    const semFoto = respostas.filter((r) => r.faixas.length && !(r.fotos_fornecedor || []).length).length;
    if (semFoto && !window.confirm(T(semFoto + ' priced item(s) have no photo of your product. Send anyway?'))) { setEnviando(false); return; }
    const { data, error } = await sbc().rpc('public_ivc_responder', { p_token: token, p_respostas: respostas, p_moeda: moeda });
    setEnviando(false);
    if (error || !data || !data.ok) {
      if (error && /certificado_obrigatorio/.test(error.message || '')) { setErro(T('Certificate required: attach the certificate of every item marked "Certificate required" that has a price.')); return; }
      setErro(data && data.erro === 'cotacao_encerrada' ? T('This quotation is closed.') : T('Could not save. Try again.'));
      return;
    }
    try { localStorage.removeItem('ivc-rascunho:' + token); } catch (e) { /* ok */ }
    setFeito(true); window.scrollTo(0, 0);
  };

  /* Planilha (CSV abre no Excel): baixa com os nossos itens, o fornecedor preenche e importa de volta — sem digitar item por item. */
  const CSV_COLS = ['ref', 'description', 'qty_needed', 'unit', 'certificate_required', 'unit_price', 'lead_time_days', 'remarks'];
  const csvCel = (v) => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  /* Excel (.xlsx) com a foto de cada item embutida: o trader pode encaminhar o arquivo à fábrica sem perder a referência visual. ExcelJS 4.4.0 (cdnjs), carregado só quando o fornecedor pede o Excel. */
  const carregarExcelJS = () => new Promise((ok, falha) => {
    if (window.ExcelJS) return ok(window.ExcelJS);
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    sc.onload = () => (window.ExcelJS ? ok(window.ExcelJS) : falha(new Error('exceljs'))); sc.onerror = () => falha(new Error('exceljs')); document.head.appendChild(sc);
  });
  const baixarImagem = async (url) => {
    try {
      const r = await fetch(url); if (!r.ok) return null; const bmp = await createImageBitmap(await r.blob());
      const esc = Math.min(1, 300 / Math.max(bmp.width, bmp.height)); const w = Math.max(1, Math.round(bmp.width * esc)); const h = Math.max(1, Math.round(bmp.height * esc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85)); if (!blob) return null;
      return { buffer: await blob.arrayBuffer(), extension: 'jpeg', w, h };
    } catch (e) { return null; }
  };
  const baixarExcel = async () => {
    setErro(null); setAviso(null); setGerando(true);
    try {
      const EJ = await carregarExcelJS();
      const wb = new EJ.Workbook(); const ws = wb.addWorksheet('Quotation');
      const cols = [['photo', 20], ['ref', 18], ['description', 48], ['qty_needed', 11], ['unit', 8], ['certificate_required', 12], ['unit_price', 12], ['lead_time_days', 12], ['remarks', 30], ['photo_url', 30]];
      ws.columns = cols.map(([header, width]) => ({ header, key: header, width }));
      /* Título com espaços no fim: se o fornecedor usar "ajustar largura da coluna" no Excel, a coluna A não encolhe e as fotos não passam por cima do ref. */
      ws.getCell('A1').value = 'photo' + ' '.repeat(20);
      ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
      const cache = {}; const fotoDe = (i) => [i.foto_url, i.foto_url2].concat(i.fotos_manuais || []).filter(Boolean)[0] || '';
      const urls = Array.from(new Set(itens.map(fotoDe).filter(Boolean)));
      for (let k = 0; k < urls.length; k += 6) await Promise.all(urls.slice(k, k + 6).map(async (u) => { const im = await baixarImagem(u); if (im) cache[u] = { id: wb.addImage({ buffer: im.buffer, extension: im.extension }), w: im.w, h: im.h }; }));
      itens.forEach((i, idx) => {
        const x = form[i.id] || inicial(i, null); const u = fotoDe(i);
        const row = ws.addRow({ photo: '', ref: i.codigo, description: descricaoEN(i), qty_needed: i.quantidade, unit: unidadeEN(i.unidade), certificate_required: i.exige_certificado ? 'yes' : 'no', unit_price: x.f[0].preco === '' ? null : Number(String(x.f[0].preco).replace(',', '.')) || x.f[0].preco, lead_time_days: x.lt === '' ? null : Number(x.lt) || x.lt, remarks: x.obs, photo_url: u });
        row.height = 80; row.alignment = { vertical: 'middle', wrapText: true };
        if (u && cache[u]) {
          /* Foto centralizada na célula A, tamanho fixo e proporção original (caixa 135 × 97 px dentro de 145 × 107). Posição em EMU exato (o ExcelJS erra posição fracionada). */
          const c = cache[u]; const esc = Math.min(135 / c.w, 97 / c.h); const pw = c.w * esc; const ph = c.h * esc;
          ws.addImage(c.id, { tl: { nativeCol: 0, nativeColOff: Math.round((145 - pw) / 2 * 9525), nativeRow: idx + 1, nativeRowOff: Math.round((107 - ph) / 2 * 9525) }, ext: { width: pw, height: ph }, editAs: 'oneCell' });
        }
      });
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = lote.numero + '-quotation.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { setErro(T('Could not create the Excel file. Use the CSV instead.')); }
    setGerando(false);
  };
  /* CSV 100% em inglês (pedido do Gelson, 19/11/2026): a descrição é o texto técnico em inglês da VerticalParts (obs_vp); só cai para a descrição do cadastro (português) se o item ainda não tem texto em inglês. Unidades em inglês. */
  const UNID_EN = { PC: 'pcs', PCS: 'pcs', UN: 'unit', UND: 'unit', UNID: 'unit', PAR: 'pair', PR: 'pair', M: 'm', MT: 'm', KIT: 'kit', JG: 'set', CJ: 'set' };
  const unidadeEN = (u) => { const k = String(u || '').trim().toUpperCase(); return UNID_EN[k] || String(u || '').trim(); };
  const descricaoEN = (i) => String(i.obs_vp || '').trim() || i.descricao || '';
  const baixarPlanilha = () => {
    const linhas = itens.map((i) => { const x = form[i.id] || inicial(i, null); return [i.codigo, descricaoEN(i), i.quantidade, unidadeEN(i.unidade), i.exige_certificado ? 'yes' : 'no', x.f[0].preco, x.lt, x.obs]; });
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
      let rows;
      if (/\.xlsx$/i.test(file.name || '')) {
        const EJ = await carregarExcelJS(); const wb = new EJ.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets[0]; rows = [];
        const txt = (v) => (v == null ? '' : typeof v === 'object' ? (v.result != null ? String(v.result) : v.text != null ? String(v.text) : (v.richText || []).map((t) => t.text).join('')) : String(v));
        ws.eachRow({ includeEmpty: false }, (row) => { const arr = []; for (let c = 1; c <= row.cellCount; c++) arr.push(txt(row.getCell(c).value)); rows.push(arr); });
      } else rows = lerCSV((await file.text()).replace(/^\ufeff/, ''));
      const cab = (rows[0] || []).map((h) => String(h).trim().toLowerCase()); const col = (n) => cab.indexOf(n);
      if (col('ref') < 0) throw new Error('x');
      let n = 0; const novo = { ...form };
      rows.slice(1).forEach((r) => {
        const it = itens.find((i) => String(i.codigo).toUpperCase() === String(r[col('ref')] || '').trim().toUpperCase()); if (!it) return;
        const g = (nome) => (col(nome) >= 0 ? String(r[col(nome)] == null ? '' : r[col(nome)]).trim() : '');
        const base = novo[it.id] || inicial(it, null);
        const f = [{ min: '1', preco: g('unit_price') }];
        novo[it.id] = { ...base, f, lt: g('lead_time_days') || base.lt, obs: g('remarks') || base.obs }; n++;
      });
      setForm(novo); setErro(null);
      setAviso(T(n + ' item(s) loaded from the file. Review and click Send.'));
    } catch (e) { setErro(T('Could not read the file. Use the template downloaded here (Excel or CSV).')); }
  };

  const th = { textAlign: 'left', padding: '8px 6px', fontSize: 12, borderBottom: '2px solid #222', background: '#ece9e0', position: 'sticky', top: 0 };
  const td = { padding: '8px 6px', borderBottom: '1px solid #e5e5e0', verticalAlign: 'top', fontSize: 13 };
  const inp = { padding: '6px 8px', border: '1px solid #bbb', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'Poppins, Arial, sans-serif', color: '#222', width: '100%', boxSizing: 'border-box', margin: 0, padding: '16px 20px 48px' }}>
      <div style={{ background: '#111', color: '#fff', padding: '16px 20px', borderRadius: 12, borderBottom: '4px solid #f6c000' }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: '#f6c000' }}>VERTICALPARTS</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>{T('Request for Quotation')} {lote.numero}</h1>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 4 }}>{convite.fornecedor_nome}{convite.rodada > 1 ? ' — ' + T('updated round ' + convite.rodada) : ''}</div>
      </div>

      {feito && <div style={{ background: '#e6f6ea', border: '1px solid #8bc79a', padding: 14, borderRadius: 10, marginTop: 14 }}><b>{T('Thank you! Your quotation was received.')}</b> {T('You can edit and send again while the request is open.')}</div>}
      {encerrado && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 14, borderRadius: 10, marginTop: 14 }}><b>{T('This quotation is closed.')}</b></div>}

      <p style={{ fontSize: 13, lineHeight: 1.5, margin: '14px 2px' }}>
        {T('Enter the UNIT price of each item. The "Qty" column is how many we need. Enter the price of ONE piece; the total is calculated for the quantity we need. Lead time in days. Items marked "Certificate required" need their certificate attached before you send.')}
      </p>

      <div style={{ margin: '0 0 10px', fontSize: 13 }}>
        {!encerrado && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input style={{ ...inp, width: 260 }} placeholder={T('Search item by REF. or description…')} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button type="button" onClick={baixarExcel} disabled={gerando} title={T('Excel file with the product photos')} style={{ ...inp, width: 'auto', cursor: 'pointer', background: '#fff' }}>{gerando ? T('Preparing Excel…') : T('Download Excel (with photos)')}</button>
            <button type="button" onClick={baixarPlanilha} style={{ ...inp, width: 'auto', cursor: 'pointer', background: '#fff' }}>{T('Download spreadsheet (CSV)')}</button>
            <label style={{ ...inp, width: 'auto', cursor: 'pointer', background: '#fff' }}>{T('Upload filled spreadsheet')}<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={(e) => { importarPlanilha(e.target.files && e.target.files[0]); e.target.value = ''; }} /></label>
            <span style={{ fontSize: 11, color: '#666' }}>{T('Your typing is kept on this computer until you send.')}</span>
          </div>
        )}
        {aviso && <div style={{ background: '#e6f6ea', border: '1px solid #8bc79a', padding: 8, borderRadius: 8, marginBottom: 8, fontSize: 13 }}>{aviso}</div>}
        <label>{T('Currency')}: <select value={moeda} onChange={(e) => setMoeda(e.target.value)} disabled={encerrado} style={{ ...inp, width: 'auto' }}><option value="USD">USD</option><option value="RMB">RMB (CNY)</option><option value="EUR">EUR</option><option value="BRL">BRL</option></select></label>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '82vh', background: '#fff', borderRadius: 12, border: '1px solid #e5e5e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={th}>{T('Photo')}</th>
              <th style={th}>REF.</th>
              <th style={th}>{T('Description')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{T('Qty')}</th>
              <th style={th}>{T('Unit price (' + moeda + ')')}</th>
              <th style={th}>{T('Total (' + moeda + ')')}</th>
              <th style={th}>{T('Lead time (days)')}</th>
              <th style={th}>{T('Certificate')}</th>
              <th style={th}>{T('Remarks')}</th>
            </tr>
          </thead>
          <tbody>
            {itens.filter((i) => { const t = busca.trim().toLowerCase(); return !t || ((i.codigo || '') + ' ' + (i.descricao || '')).toLowerCase().includes(t); }).map((i) => {
              const x = form[i.id]; if (!x) return null;
              return (
                <tr key={i.id}>
                  <td style={td}><div style={{ display: 'flex', gap: 6 }}>{[i.foto_url, i.foto_url2].concat(i.fotos_manuais || []).filter(Boolean).map((u, k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" title="Click to enlarge"><img src={u} alt={i.codigo} style={{ width: 96, height: 96, objectFit: 'contain', background: '#fff', border: '1px solid #e5e5df', borderRadius: 6 }} /></a>)}{!i.foto_url && !(i.fotos_manuais || []).length && <div style={{ width: 64, height: 64, background: '#f0f0ec', borderRadius: 6 }} />}</div></td>
                  <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{i.codigo}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{i.descricao}{i.obs_vp && <div style={{ fontSize: 12, color: '#8a6d00', marginTop: 4, whiteSpace: 'pre-wrap' }}><b>VerticalParts:</b> {i.obs_vp}</div>}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><b>{Number(i.quantidade).toLocaleString('en-US')}</b> {i.unidade || T('pcs')}<div style={{ fontSize: 10, color: '#666' }}>{T('we need')}</div></td>
                  <td style={{ ...td, minWidth: 130 }}>
                    <input style={{ ...inp, width: 110 }} inputMode="decimal" placeholder={moeda} value={x.f[0].preco} disabled={encerrado} onChange={(e) => setFaixa(i.id, 0, 'preco', e.target.value)} />
                  </td>
                  <td style={{ ...td, minWidth: 130, whiteSpace: 'nowrap' }}>
                    {num(x.f[0].preco) > 0 ? <b>{(num(x.f[0].preco) * Number(i.quantidade)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> : <span style={{ color: '#aaa' }}>—</span>}
                  </td>
                  <td style={td}><input style={{ ...inp, width: 80 }} inputMode="numeric" value={x.lt} disabled={encerrado} onChange={(e) => set(i.id, 'lt', e.target.value)} /></td>
                  <td style={{ ...td, minWidth: 150 }}>
                    {!i.exige_certificado ? <span style={{ fontSize: 12, color: '#888' }}>{T('Not required')}</span> : (
                      <div style={{ fontSize: 12 }}>
                        <div style={{ color: '#b45309', fontWeight: 700, marginBottom: 4 }}>{T('Certificate required')}</div>
                        {x.cert ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <a href={x.cert.url} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>{x.cert.nome}</a>
                            {!encerrado && <button type="button" title="Remove" onClick={() => set(i.id, 'cert', null)} style={{ width: 18, height: 18, borderRadius: 9, border: 0, background: '#c00', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0, flex: 'none' }}>×</button>}
                          </div>
                        ) : (!encerrado && (
                          <label style={{ display: 'inline-block', padding: '5px 10px', border: '1px dashed #b45309', borderRadius: 6, cursor: 'pointer', background: '#fffbeb' }}>
                            {subindo === 'cert:' + i.id ? '…' : T('Attach certificate')}
                            <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={subindo === 'cert:' + i.id} onChange={(e) => { addCert(i.id, e.target.files && e.target.files[0]); e.target.value = ''; }} />
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 11, color: '#8a6d00', marginBottom: 3 }}>{T('Does your product match? Say if it is identical or different (size, material, finish…).')}</div>
                    <textarea style={{ ...inp, minHeight: 54 }} value={x.obs} disabled={encerrado} onChange={(e) => set(i.id, 'obs', e.target.value)} />
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <div style={{ color: '#8a6d00', marginBottom: 3 }}>{T('Please send photos of YOUR product so we can compare.')}</div>
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
                          {subindo === i.id ? '…' : T('+ Your photos (' + x.fotos.length + '/' + MAX_FOTOS + ')')}
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
            {enviando ? '…' : T('Send quotation')}
          </button>
        </div>
      )}
      <Mensagens token={token} encerrado={encerrado} />
    </div>
  );
}

/* Mensagem + arquivos do fornecedor para a VerticalParts (cai nas Tratativas da RFQ Importação). Só RPC com o token. */
const MSG_MAX_MB = 25;
function Mensagens({ token, encerrado }) {
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [subindo, setSubindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const carregar = () => sbc().rpc('public_ivc_tratativas_listar', { p_token: token }).then(({ data }) => setLista(Array.isArray(data) ? data : []));
  useEffect(() => { carregar(); }, []);
  const addArquivos = async (files) => {
    setMsg(null); setSubindo(true);
    try {
      for (const f of Array.from(files || [])) {
        if (anexos.length >= 5) { setMsg({ erro: T('Up to 5 files per message.') }); break; }
        if (f.size > MSG_MAX_MB * 1024 * 1024) { setMsg({ erro: T('"' + f.name + '" is larger than ' + MSG_MAX_MB + ' MB.') }); continue; }
        const path = 'cotacao-varejo-msg/' + token.slice(0, 12) + '/' + Date.now() + '_' + (f.name || 'file').replace(/[^\w.\-]/g, '_');
        const up = await sbc().storage.from('engenharia').upload(path, f, { upsert: false, contentType: f.type || 'application/octet-stream' });
        if (up.error) throw up.error;
        setAnexos((a) => a.concat([{ nome: (f.name || 'file').slice(0, 120), url: sbc().storage.from('engenharia').getPublicUrl(path).data.publicUrl, tipo: f.type || '', tamanho: f.size }]));
      }
    } catch (e) { setMsg({ erro: T('Could not upload the file. Try again.') }); }
    setSubindo(false);
  };
  const enviarMsg = async () => {
    setEnviando(true); setMsg(null);
    const { data, error } = await sbc().rpc('public_ivc_tratativa_enviar', { p_token: token, p_mensagem: texto, p_anexos: anexos });
    setEnviando(false);
    if (error || !data || !data.ok) { setMsg({ erro: data && data.erro === 'cotacao_encerrada' ? T('This quotation is closed.') : T('Could not send. Try again.') }); return; }
    setTexto(''); setAnexos([]); setMsg({ ok: T('Message sent to VerticalParts.') }); carregar();
  };
  const dt = (v) => { try { return new Date(v).toLocaleString('en-GB'); } catch (e) { return ''; } };
  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #e5e5df', paddingTop: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{T('Messages and files for VerticalParts')}</h3>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>{T('Send us a question, a comment or documents (PDF, images, Excel, Word — up to 25 MB each).')}</div>
      {lista.map((m, i) => (
        <div key={i} style={{ border: '1px solid #e5e5df', borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: m.origem === 'fornecedor' ? '#fffbe6' : '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><b>{m.autor}</b><span style={{ color: '#888' }}>{dt(m.em)}</span></div>
          {m.mensagem && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.mensagem}</div>}
          {(m.anexos || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{m.anexos.map((a, k) => <a key={k} href={a.url} target="_blank" rel="noopener noreferrer" style={{ border: '1px solid #ddd', padding: '3px 8px', fontSize: 12, borderRadius: 6 }}>{a.nome}</a>)}</div>}
        </div>
      ))}
      {!encerrado && (
        <div>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={4000} placeholder={T('Write your message to VerticalParts…')} style={{ width: '100%', boxSizing: 'border-box', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0' }}>
            {anexos.map((a, i) => <span key={i} style={{ border: '1px solid #ddd', padding: '3px 8px', fontSize: 12, borderRadius: 6 }}>{a.nome} <button type="button" onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))} style={{ border: 0, background: 'none', cursor: 'pointer' }}>×</button></span>)}
            <label style={{ border: '1px solid #ccc', padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: '#fff' }}>{subindo ? '…' : T('Attach file')}<input type="file" multiple style={{ display: 'none' }} disabled={subindo} onChange={(e) => { addArquivos(e.target.files); e.target.value = ''; }} /></label>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.erro ? '#b00' : '#1a7f37', marginBottom: 6 }}>{msg.erro || msg.ok}</div>}
          <button type="button" onClick={enviarMsg} disabled={enviando || subindo || (!texto.trim() && !anexos.length)} style={{ background: '#f6c000', border: 0, padding: '8px 18px', fontWeight: 700, borderRadius: 6, cursor: 'pointer', opacity: enviando || subindo || (!texto.trim() && !anexos.length) ? .5 : 1 }}>{enviando ? '…' : T('Send message')}</button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('cv-root')).render(<Portal />);
