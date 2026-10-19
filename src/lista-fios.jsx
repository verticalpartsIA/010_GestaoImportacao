/* ============================================================
   lista-fios.jsx — Fabricação · Montagem do Produto › Lista de fios do quadro de comando.
   A Engenharia dita bitola/comprimento (edita); a Produção só usa. Uma lista única para todas as variantes:
   só a bitola grossa muda com a variante (tabela "Bitola por variante"). O cálculo é de FiacaoQuadro (fiacao-quadro-engine.js).
   Nada daqui vai ao Omie. Importação: colar as linhas do Excel (mesmas colunas da planilha da Engenharia).
   Link: /logistica/montagem-produto/lista-de-fios
   ============================================================ */
const LF_VARIANTES = ['7.5_220', '7.5_380', '15_220', '15_380', '30_220', '30_380'];
const LF_TIPOS = ['Tubular', 'Tubular duplo', 'Mini fit', 'Forquilha', 'Olhal', 'Faston'];
const LF_ROT = { '7.5_220': '7,5 kW / 220 V', '7.5_380': '7,5 kW / 380 V', '15_220': '15 kW / 220 V', '15_380': '15 kW / 380 V', '30_220': '30 kW / 220 V', '30_380': '30 kW / 380 V' };

// Lê as linhas coladas do Excel (colunas: Tag, Comp.Orig, Borne Orig, Tipo Orig, Comp.Dest, Borne Dest, Tipo Dest, Cor, Bitola, Comprimento cm).
function lfLerColado(texto) {
  const num = (v) => Number(String(v || '').trim().replace(',', '.'));
  const linhas = String(texto || '').split(/\r?\n/).map(l => l.split('\t')).filter(c => c.length >= 10);
  const fios = []; const ignoradas = [];
  linhas.forEach((c, i) => {
    const b = num(c[8]), cm = num(c[9]);
    if (!(b > 0) || !(cm > 0) || !String(c[7] || '').trim()) { ignoradas.push(i + 1); return; }   // cabeçalho ou linha em branco
    fios.push({ ordem: fios.length, tag: c[0].trim() || null, origem_comp: c[1].trim() || null, origem_borne: c[2].trim() || null, origem_tipo: c[3].trim() || null,
      destino_comp: c[4].trim() || null, destino_borne: c[5].trim() || null, destino_tipo: c[6].trim() || null, cor: c[7].trim(), bitola: b, comprimento_cm: cm });
  });
  return { fios, ignoradas };
}
const lfParaMotor = (f) => ({ tag: f.tag, origem: { comp: f.origem_comp, borne: f.origem_borne, tipo: f.origem_tipo }, destino: { comp: f.destino_comp, borne: f.destino_borne, tipo: f.destino_tipo }, cor: f.cor, bitola: f.bitola, comprimentoCm: f.comprimento_cm });
const lfCfg = (d) => ({
  bitolaBase: 6,
  bitolaGrossaPorVariante: Object.fromEntries((d.bitolas || []).map(x => [x.variante, Number(x.bitola_grossa)])),
  fios: (d.depara || []).filter(x => x.categoria === 'fio').map(x => ({ cor: x.cor, bitola: Number(x.bitola), codigo: x.codigo })),
  terminais: (d.depara || []).filter(x => x.categoria === 'terminal').map(x => ({ tipo: x.tipo, bitola: x.bitola == null ? null : Number(x.bitola), codigo: x.codigo })),
  conectores: (d.conectores || []).map(x => ({ nome: x.nome, vias: x.vias, codigo: x.codigo })),
});
// Usado pela geração da OP (pcp.jsx): carrega a lista + cadastros e devolve o cálculo da variante (ou null).
async function lfCalcularParaVariante(sb, variante) {
  const [f, b, d, c] = await Promise.all([
    sb.from('fiacao_fios').select('*').order('ordem'), sb.from('fiacao_bitola_variante').select('*'),
    sb.from('fiacao_depara').select('*'), sb.from('fiacao_conectores').select('*')]);
  if (f.error || !(f.data || []).length) return null;
  return window.FiacaoQuadro.calcular(f.data.map(lfParaMotor), variante, lfCfg({ bitolas: b.data, depara: d.data, conectores: c.data }));
}

function ListaFiosView({ setPai }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [aba, setAba] = React.useState('fios');
  const [podeEditar, setPodeEditar] = React.useState(false);
  const [colar, setColar] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [variante, setVariante] = React.useState('30_380');

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const [f, b, p, c] = await Promise.all([
      sb.from('fiacao_fios').select('*').order('ordem').limit(2000), sb.from('fiacao_bitola_variante').select('*'),
      sb.from('fiacao_depara').select('*').order('categoria').order('codigo'), sb.from('fiacao_conectores').select('*').order('nome')]);
    const e = f.error || b.error || p.error || c.error;
    if (e) setErro(e.message); else { setErro(null); setD({ fios: f.data || [], bitolas: b.data || [], depara: p.data || [], conectores: c.data || [] }); }
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('lista-fios', 'editar')).then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const resultado = React.useMemo(() => d && d.fios.length ? window.FiacaoQuadro.calcular(d.fios.map(lfParaMotor), variante, lfCfg(d)) : null, [d, variante]);
  const aviso = (t) => { setMsg(t); window.toast?.(t); };
  const log = (acao, detalhe) => window.VPLog?.registrar?.({ modulo: 'Lista de fios', acao, alvo: 'Lista de fios do quadro', alvo_id: 'lista-fios', detalhe });

  const importar = async () => {
    const { fios, ignoradas } = lfLerColado(colar);
    if (!fios.length) { aviso('Nenhum fio válido no texto colado (precisa de 10 colunas separadas por tabulação, com cor, bitola e comprimento).'); return; }
    if (!window.confirm(`Substituir a lista atual (${d.fios.length} fios) por ${fios.length} fios colados?${ignoradas.length ? ` ${ignoradas.length} linha(s) ignorada(s) (cabeçalho/em branco).` : ''}`)) return;
    const del = await sb.from('fiacao_fios').delete().gte('ordem', 0).select('id');
    if (del.error) { aviso('Não foi possível limpar a lista: ' + del.error.message); return; }
    for (let i = 0; i < fios.length; i += 200) {
      const r = await sb.from('fiacao_fios').insert(fios.slice(i, i + 200));
      if (r.error) { aviso('Falha ao gravar (a lista pode ter ficado incompleta — cole de novo): ' + r.error.message); await carregar(); return; }
    }
    log('Importou a lista de fios', { fios: fios.length, ignoradas: ignoradas.length });
    setColar(''); aviso(`${fios.length} fios importados.`); carregar();
  };
  const salvarFio = async (f, campo, valor) => {
    const v = ['bitola', 'comprimento_cm'].includes(campo) ? Number(String(valor).replace(',', '.')) : (valor.trim() || null);
    if (['bitola', 'comprimento_cm'].includes(campo) && !(v > 0)) { aviso('Valor inválido.'); return; }
    const r = await sb.from('fiacao_fios').update({ [campo]: v }).eq('id', f.id).select('id');
    if (r.error || !(r.data || []).length) { aviso('Não foi possível salvar: ' + (r.error?.message || 'sem permissão')); return; }
    log('Editou um fio', { tag: f.tag, campo, antes: f[campo], depois: v }); carregar();
  };
  const upsert = async (tabela, linha, chave) => {
    const r = await sb.from(tabela).upsert(linha, { onConflict: chave }).select();
    if (r.error || !(r.data || []).length) { aviso('Não foi possível salvar: ' + (r.error?.message || 'sem permissão')); return false; }
    log('Alterou cadastro da lista de fios', { tabela, ...linha }); carregar(); return true;
  };
  const apagar = async (tabela, col, val) => {
    if (!window.confirm('Apagar esta linha?')) return;
    const r = await sb.from(tabela).delete().eq(col, val).select();
    if (r.error || !(r.data || []).length) { aviso('Não foi possível apagar: ' + (r.error?.message || 'sem permissão')); return; }
    log('Apagou linha de cadastro da lista de fios', { tabela, [col]: val }); carregar();
  };

  const abas = [['fios', 'Fios'], ['bitolas', 'Bitola por variante'], ['depara', 'Códigos (de-para)'], ['conectores', 'Conectores'], ['resultado', 'Resultado por variante']];
  const th = { textAlign: 'left' };
  const ed = (f, campo, w) => podeEditar
    ? <input className="input" defaultValue={f[campo] ?? ''} style={{ width: w || 90 }} onBlur={e => { if (e.target.value !== String(f[campo] ?? '')) salvarFio(f, campo, e.target.value); }}/>
    : (f[campo] ?? '—');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Fabricação · Montagem do Produto</div>
          <h1 className="page-head__title">Lista de fios do quadro de comando</h1>
          <p className="page-head__sub">Uma lista única para todas as variantes. Só a bitola grossa muda com a potência/tensão. A Engenharia edita; a Produção usa na separação da OP.</p>
        </div>
        <div className="page-head__r"><button className="btn btn--ghost" onClick={() => setPai('')}>← Estrutura do produto</button></div>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {msg && <div style={{ padding: '6px 0', fontSize: 13, color: 'var(--fg2)' }}>{msg}</div>}
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {abas.map(([k, r]) => <button key={k} className={'btn ' + (aba === k ? 'btn--primary' : 'btn--ghost')} onClick={() => setAba(k)}>{r}</button>)}
        {!podeEditar && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--fg3)' }}>Somente leitura (sem a alçada "Lista de fios › Editar").</span>}
      </div>
      {!erro && !d && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {d && aba === 'fios' && (<>
        {podeEditar && (
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}><b>Importar do Excel</b> — copie as linhas da planilha (colunas: Tag, Componente/Borne/Tipo de origem, Componente/Borne/Tipo de destino, Cor, Bitola, Comprimento em cm) e cole aqui. Substitui a lista inteira.</div>
            <textarea className="input" rows={4} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} value={colar} onChange={e => setColar(e.target.value)} placeholder="Cole aqui…"/>
            <button className="btn btn--primary" style={{ marginTop: 6 }} disabled={!colar.trim()} onClick={importar}>Importar e substituir</button>
          </div>)}
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Tag</th><th>Origem</th><th>Tipo</th><th>Destino</th><th>Tipo</th><th>Cor</th><th>Bitola mm²</th><th>Compr. cm</th></tr></thead>
            <tbody>
              {d.fios.map(f => (
                <tr key={f.id}>
                  <td>{f.tag || '—'}</td>
                  <td>{[f.origem_comp, f.origem_borne].filter(Boolean).join(' · ') || '—'}</td><td>{f.origem_tipo || '—'}</td>
                  <td>{[f.destino_comp, f.destino_borne].filter(Boolean).join(' · ') || '—'}</td><td>{f.destino_tipo || '—'}</td>
                  <td>{ed(f, 'cor', 70)}</td><td>{ed(f, 'bitola', 70)}</td><td>{ed(f, 'comprimento_cm', 80)}</td>
                </tr>))}
              {d.fios.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum fio cadastrado — cole a planilha acima.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
      {d && aba === 'bitolas' && (
        <div className="card table-wrap"><table className="t pcp-grid">
          <thead><tr><th style={th}>Variante (potência / tensão)</th><th>Bitola grossa (mm²)</th><th>Observação</th></tr></thead>
          <tbody>{LF_VARIANTES.map(v => {
            const x = d.bitolas.find(b => b.variante === v);
            return (<tr key={v}><td>{LF_ROT[v]}</td>
              <td>{podeEditar ? <input className="input" style={{ width: 80 }} defaultValue={x?.bitola_grossa ?? ''} placeholder="—"
                onBlur={e => { const n = Number(e.target.value.replace(',', '.')); if (n > 0 && n !== Number(x?.bitola_grossa)) upsert('fiacao_bitola_variante', { variante: v, bitola_grossa: n }, 'variante'); }}/> : (x?.bitola_grossa ?? <span style={{ color: 'var(--vp-danger)' }}>não definida</span>)}</td>
              <td>{x?.observacao || ''}</td></tr>);
          })}</tbody></table>
          <div style={{ padding: 10, fontSize: 12, color: 'var(--fg3)' }}>Variante sem bitola definida: a lista de fios NÃO é aplicada na OP dela (a OP segue como antes e a tela avisa).</div>
        </div>)}
      {d && aba === 'depara' && (
        <div className="card table-wrap"><table className="t pcp-grid">
          <thead><tr><th>Tipo</th><th>Fio / Terminal</th><th>Cor</th><th>Bitola mm²</th><th>Código do item</th>{podeEditar && <th/>}</tr></thead>
          <tbody>{d.depara.map(x => (
            <tr key={x.id}><td>{x.categoria === 'fio' ? 'Fio' : 'Terminal'}</td><td>{x.tipo || '—'}</td><td>{x.cor || '—'}</td><td>{x.bitola ?? 'qualquer'}</td>
              <td>{podeEditar ? <input className="input" style={{ width: 120 }} defaultValue={x.codigo} onBlur={e => { const c = e.target.value.trim().toUpperCase(); if (c && c !== x.codigo) upsert('fiacao_depara', { id: x.id, categoria: x.categoria, tipo: x.tipo, cor: x.cor, bitola: x.bitola, codigo: c }, 'id'); }}/> : x.codigo}</td>
              {podeEditar && <td><button className="btn btn--ghost" onClick={() => apagar('fiacao_depara', 'id', x.id)}>Apagar</button></td>}</tr>))}</tbody></table>
          <div style={{ padding: 10, fontSize: 12, color: 'var(--fg3)' }}>Códigos que ainda não existem no Omie (forquilha 0,75, faston, fio azul 0,75) ficam sem código e aparecem como aviso no Resultado até serem cadastrados aqui.</div>
        </div>)}
      {d && aba === 'conectores' && (<>
        <div className="card table-wrap"><table className="t pcp-grid">
          <thead><tr><th>Conector</th><th>Vias</th><th>Código do item</th>{podeEditar && <th/>}</tr></thead>
          <tbody>{d.conectores.map(x => (
            <tr key={x.nome}><td>{x.nome}</td>
              <td>{podeEditar ? <input className="input" style={{ width: 60 }} defaultValue={x.vias ?? ''} onBlur={e => { const n = parseInt(e.target.value, 10); if (n > 0 && n !== x.vias) upsert('fiacao_conectores', { ...x, vias: n }, 'nome'); }}/> : (x.vias ?? '—')}</td>
              <td>{podeEditar ? <input className="input" style={{ width: 120 }} defaultValue={x.codigo ?? ''} onBlur={e => { const c = e.target.value.trim().toUpperCase(); if (c !== (x.codigo || '')) upsert('fiacao_conectores', { ...x, codigo: c || null }, 'nome'); }}/> : (x.codigo || '—')}</td>
              {podeEditar && <td><button className="btn btn--ghost" onClick={() => apagar('fiacao_conectores', 'nome', x.nome)}>Apagar</button></td>}</tr>))}
            {d.conectores.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum conector cadastrado. Os conectores usados na lista aparecem em "Resultado por variante"; cadastre as vias e o código de cada um.</td></tr>}
          </tbody></table></div>
        {podeEditar && (() => {
          const usados = Array.from(new Set(d.fios.flatMap(f => [[f.origem_tipo, f.origem_borne], [f.destino_tipo, f.destino_borne]]).filter(([t, b]) => /mini/i.test(t || '') && b).map(([, b]) => window.FiacaoQuadro.conectorDe(b)))).filter(n => !d.conectores.some(c => c.nome === n));
          return usados.length ? <div style={{ marginTop: 10 }}><button className="btn btn--ghost" onClick={async () => { const r = await sb.from('fiacao_conectores').insert(usados.map(nome => ({ nome }))); if (r.error) aviso(r.error.message); else { log('Cadastrou conectores da lista', { n: usados.length }); carregar(); } }}>Cadastrar os {usados.length} conectores usados na lista (vias a preencher)</button></div> : null;
        })()}
      </>)}
      {d && aba === 'resultado' && (<>
        <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select className="input" value={variante} onChange={e => setVariante(e.target.value)}>{LF_VARIANTES.map(v => <option key={v} value={v}>{LF_ROT[v]}</option>)}</select>
        </div>
        {!resultado && <div style={{ padding: 24, color: 'var(--fg3)' }}>Cadastre os fios primeiro.</div>}
        {resultado && !resultado.ok && <div className="card" style={{ padding: 14, color: 'var(--vp-danger)' }}>{resultado.motivo}</div>}
        {resultado && resultado.ok && (<>
          <div className="card table-wrap" style={{ marginBottom: 12 }}><table className="t pcp-grid">
            <thead><tr><th>Item</th><th>Código</th><th className="text-right">Quantidade</th><th>Un.</th></tr></thead>
            <tbody>{resultado.itens.map((i, k) => (
              <tr key={k}><td>{i.descricao}{i.tipo === 'terminal' && i.pontas !== i.quantidade ? ` (${i.pontas} pontas)` : ''}</td>
                <td>{i.codigo || <span style={{ color: 'var(--vp-danger)' }}>sem código</span>}</td>
                <td className="text-right">{Number(i.quantidade).toLocaleString('pt-BR')}</td><td>{i.unidade}</td></tr>))}</tbody></table></div>
          {resultado.avisos.length > 0 && <div className="card" style={{ padding: 12, fontSize: 13 }}><b>Pendências para a OP usar a lista por completo:</b><ul style={{ margin: '6px 0 0 18px' }}>{resultado.avisos.map((a, k) => <li key={k}>{a}</li>)}</ul>Itens sem código não entram na separação.</div>}
        </>)}
      </>)}
    </div>
  );
}

Object.assign(window, { ListaFiosView, lfCalcularParaVariante, lfLerColado });
