/* ============================================================
   carga-maquina.jsx — Logística Interna · Carga Máquina.
   Cadastro de recursos produtivos (pcp_recursos): mão de obra e máquinas.
   Capacidade em HORAS líquidas/mês = qtd × horas/dia × dias/mês × eficiência.
   Capacidade em unidades é opcional (só se informado "unidades por hora").
   A 3ª aba (Capacidade por Recursos) compara com a carga das ordens de produção,
   que ainda não existem — por ora mostra só a capacidade disponível.
   ============================================================ */

const CM_VAZIO = { codigo: '', nome: '', quantidade: 1, horas_dia: 8, dias_mes: 22, eficiencia_pct: 100, unidades_por_hora: '', observacao: '' };

function cmNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function cmFmt(v, d = 1) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function cmCalc(r) {
  const brutas = cmNum(r.quantidade) * cmNum(r.horas_dia) * cmNum(r.dias_mes);
  const liquidas = brutas * cmNum(r.eficiencia_pct) / 100;
  const uph = r.unidades_por_hora === '' || r.unidades_por_hora == null ? null : cmNum(r.unidades_por_hora);
  return { brutas, liquidas, unidades: uph == null ? null : liquidas * uph };
}

function CMTabelaRecursos({ tipo, recursos, podeEditar, onSalvar, onDesativar }) {
  const ehMO = tipo === 'mao_de_obra';
  const [edit, setEdit] = React.useState(null); // linha em edição (id ou 'novo')
  const [form, setForm] = React.useState(CM_VAZIO);
  const [salvando, setSalvando] = React.useState(false);
  const lista = recursos.filter(r => r.tipo === tipo);

  const abrir = (r) => { setEdit(r ? r.id : 'novo'); setForm(r ? { ...CM_VAZIO, ...r, unidades_por_hora: r.unidades_por_hora ?? '' } : CM_VAZIO); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const salvar = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) { window.toast?.('Informe código e nome.'); return; }
    setSalvando(true);
    const ok = await onSalvar(tipo, edit === 'novo' ? null : edit, form);
    setSalvando(false);
    if (ok) setEdit(null);
  };
  const campo = (k, props = {}) => (
    <input className="input" type="number" min="0" step="any" value={form[k]} onChange={e => set(k, e.target.value)} style={{ width: 90 }} {...props}/>
  );

  return (
    <div className="card table-wrap" style={{ overflowX: 'auto' }}>
      <table className="t pcp-grid">
        <thead>
          <tr>
            <th>Código</th><th>{ehMO ? 'Equipe / função' : 'Máquina'}</th>
            <th className="text-right">{ehMO ? 'Nº pessoas' : 'Qtd'}</th>
            <th className="text-right">Horas/dia</th><th className="text-right">Dias/mês</th>
            <th className="text-right">Eficiência %</th><th className="text-right">Unid./hora</th>
            <th className="text-right">Horas brutas/mês</th><th className="text-right">Horas líquidas/mês</th>
            <th className="text-right">Capacidade (unid./mês)</th><th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map(r => {
            const emEdicao = edit === r.id;
            const c = cmCalc(emEdicao ? form : r);
            return (
              <tr key={r.id}>
                <td><b style={{ fontWeight: 500 }}>{r.codigo}</b></td>
                {emEdicao ? (<>
                  <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
                  <td className="text-right">{campo('quantidade', { min: 1 })}</td>
                  <td className="text-right">{campo('horas_dia', { max: 24 })}</td>
                  <td className="text-right">{campo('dias_mes', { max: 31 })}</td>
                  <td className="text-right">{campo('eficiencia_pct', { max: 100 })}</td>
                  <td className="text-right">{campo('unidades_por_hora')}</td>
                </>) : (<>
                  <td>{r.nome}</td>
                  <td className="text-right">{cmFmt(r.quantidade, 0)}</td>
                  <td className="text-right">{cmFmt(r.horas_dia)}</td>
                  <td className="text-right">{cmFmt(r.dias_mes)}</td>
                  <td className="text-right">{cmFmt(r.eficiencia_pct)}</td>
                  <td className="text-right">{r.unidades_por_hora != null ? cmFmt(r.unidades_por_hora) : '—'}</td>
                </>)}
                <td className="text-right">{cmFmt(c.brutas)}</td>
                <td className="text-right"><b>{cmFmt(c.liquidas)}</b></td>
                <td className="text-right">{c.unidades != null ? cmFmt(c.unidades, 0) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {podeEditar && (emEdicao ? (<>
                    <button className="btn btn--sm btn--primary" disabled={salvando} onClick={salvar}>Salvar</button>{' '}
                    <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
                  </>) : (<>
                    <button className="btn btn--sm" onClick={() => abrir(r)}>Editar</button>{' '}
                    <button className="btn btn--sm" onClick={() => onDesativar(r)}>Desativar</button>
                  </>))}
                </td>
              </tr>
            );
          })}
          {edit === 'novo' && (
            <tr>
              <td><input className="input" placeholder={ehMO ? 'MO-01' : 'MAQ-01'} value={form.codigo} onChange={e => set('codigo', e.target.value)} style={{ width: 90 }}/></td>
              <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
              <td className="text-right">{campo('quantidade', { min: 1 })}</td>
              <td className="text-right">{campo('horas_dia', { max: 24 })}</td>
              <td className="text-right">{campo('dias_mes', { max: 31 })}</td>
              <td className="text-right">{campo('eficiencia_pct', { max: 100 })}</td>
              <td className="text-right">{campo('unidades_por_hora')}</td>
              <td className="text-right">{cmFmt(cmCalc(form).brutas)}</td>
              <td className="text-right"><b>{cmFmt(cmCalc(form).liquidas)}</b></td>
              <td className="text-right">{cmCalc(form).unidades != null ? cmFmt(cmCalc(form).unidades, 0) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn--sm btn--primary" disabled={salvando} onClick={salvar}>Salvar</button>{' '}
                <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
              </td>
            </tr>
          )}
          {lista.length === 0 && edit !== 'novo' && (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum cadastro.</td></tr>
          )}
        </tbody>
      </table>
      {podeEditar && edit == null && (
        <div style={{ padding: 12 }}>
          <button className="btn btn--sm" onClick={() => abrir(null)}>+ {ehMO ? 'Adicionar equipe' : 'Adicionar máquina'}</button>
        </div>
      )}
    </div>
  );
}

const CM_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Limites de utilização: até 85% OK · 85–100% atenção · acima de 100% sobrecarga.
function cmStatus(pct) { return pct > 100 ? 'Sobrecarga' : pct > 85 ? 'Atenção' : 'OK'; }

// Carrega roteiro (horas/unidade por produto×recurso) e produtos que têm estrutura (os "produtos finais").
function useCMRoteiro(sb) {
  const [dados, setDados] = React.useState(null);
  const carregar = React.useCallback(async () => {
    const [r, e, p] = await Promise.all([
      sb.from('pcp_roteiro').select('id, produto, recurso_id, horas_por_unidade').limit(10000),
      sb.from('pcp_estrutura').select('codigo_pai').limit(5000),
      sb.from('pcp_produtos').select('codigo, descricao').eq('ativo', true).limit(5000),
    ]);
    const desc = {}; (p.data || []).forEach(l => { desc[l.codigo] = l.descricao; });
    setDados({
      roteiro: r.data || [],
      produtos: Array.from(new Set((e.data || []).map(l => l.codigo_pai))).sort(),
      desc,
    });
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  return [dados, carregar];
}

/* Roteiro: horas para produzir 1 unidade de um produto, em cada recurso. */
function CMRoteiro({ sb, recursos, podeEditar }) {
  const [dados, recarregar] = useCMRoteiro(sb);
  const [produto, setProduto] = React.useState('');
  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const horas = (rid) => (dados.roteiro.find(x => x.produto === produto && x.recurso_id === rid) || {}).horas_por_unidade;

  const salvar = async (rec, valor) => {
    const v = valor === '' ? null : Number(valor);
    const atual = horas(rec.id);
    if ((v ?? null) === (atual ?? null)) return;
    if (v != null && !(v >= 0)) { window.toast?.('Valor inválido.'); await recarregar(); return; }
    const q = v == null || v === 0
      ? sb.from('pcp_roteiro').delete().eq('produto', produto).eq('recurso_id', rec.id)
      : sb.from('pcp_roteiro').upsert({ produto, recurso_id: rec.id, horas_por_unidade: v, updated_at: new Date().toISOString() }, { onConflict: 'produto,recurso_id' });
    const { error } = await q;
    if (error) { window.toast?.('Não foi possível salvar: ' + error.message); await recarregar(); return; }
    window.VPLog?.registrar?.({ modulo: 'Carga Máquina', acao: 'Alterou roteiro', alvo: `${produto} × ${rec.codigo} = ${v ?? 0} h/un.` });
    await recarregar();
  };

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={produto} onChange={e => setProduto(e.target.value)} style={{ minWidth: 340 }}>
          <option value="">Selecione o produto…</option>
          {dados.produtos.map(c => <option key={c} value={c}>{c} — {dados.desc[c] || ''}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Horas necessárias para produzir 1 unidade em cada recurso.</span>
      </div>
      {!produto && <div style={{ padding: 24, color: 'var(--fg3)' }}>Escolha um produto para informar o tempo em cada recurso.</div>}
      {produto && (
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Recurso</th><th>Tipo</th><th className="text-right">Horas por unidade</th></tr></thead>
            <tbody>
              {recursos.map(r => (
                <tr key={r.id}>
                  <td><b style={{ fontWeight: 500 }}>{r.codigo}</b> · {r.nome}</td>
                  <td><span className="pcp-tag">{r.tipo === 'maquina' ? 'Máquina' : 'Mão de obra (horas-homem)'}</span></td>
                  <td className="text-right">
                    {podeEditar
                      ? <input className="input" type="number" min="0" step="any" defaultValue={horas(r.id) ?? ''} placeholder="—" key={produto + r.id + (horas(r.id) ?? '')}
                          style={{ width: 90, textAlign: 'right' }} onBlur={e => salvar(r, e.target.value)}/>
                      : (horas(r.id) != null ? cmFmt(horas(r.id), 3) : '—')}
                  </td>
                </tr>
              ))}
              {recursos.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Cadastre mão de obra e máquinas primeiro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Capacidade por Recursos: horas requeridas (quantidade do mês × roteiro) × horas disponíveis. */
function CMCapacidadePorRecursos({ sb, recursos, irPara }) {
  const [dados] = useCMRoteiro(sb);
  const hoje = new Date();
  const [ano, setAno] = React.useState(hoje.getFullYear());
  const [mes, setMes] = React.useState(hoje.getMonth() + 1);
  const [fonte, setFonte] = React.useState('plano');            // 'plano' | 'ops'
  const [qtds, setQtds] = React.useState(null);                  // { produto: quantidade no mês }

  React.useEffect(() => {
    let vivo = true;
    setQtds(null);
    (async () => {
      const q = {};
      if (fonte === 'plano') {
        const { data } = await sb.from('pcp_plano').select('produto, quantidade').eq('ano', ano).eq('mes', mes).limit(5000);
        (data || []).forEach(l => { q[l.produto] = (q[l.produto] || 0) + Number(l.quantidade); });
      } else {
        const { data } = await sb.from('pcp_ordens').select('produto, quantidade, previsao_inicio, prazo_entrega, data_abertura, status').neq('status', 'cancelada').not('produto', 'is', null).limit(5000);
        (data || []).forEach(l => {
          const d = l.prazo_entrega || l.previsao_inicio || l.data_abertura;
          if (d && Number(d.slice(0, 4)) === ano && Number(d.slice(5, 7)) === mes) q[l.produto] = (q[l.produto] || 0) + Number(l.quantidade);
        });
      }
      if (vivo) setQtds(q);
    })();
    return () => { vivo = false; };
  }, [sb, ano, mes, fonte]);

  if (!dados || !qtds) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const produtos = Object.keys(qtds).filter(p => qtds[p] > 0).sort();
  const horasRoteiro = (p, rid) => (dados.roteiro.find(x => x.produto === p && x.recurso_id === rid) || {}).horas_por_unidade || 0;
  const requeridas = (rid) => produtos.reduce((s, p) => s + qtds[p] * horasRoteiro(p, rid), 0);
  const semRoteiro = produtos.filter(p => !dados.roteiro.some(x => x.produto === p));
  const classe = { 'OK': undefined, 'Atenção': 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)', 'Sobrecarga': 'color-mix(in srgb, var(--vp-danger, #c0392b) 25%, transparent)' };

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
        <select className="input" value={mes} onChange={e => setMes(Number(e.target.value))}>
          {CM_MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" value={fonte} onChange={e => setFonte(e.target.value)}>
          <option value="plano">Quantidade do Planejamento</option>
          <option value="ops">Quantidade das Ordens de Produção</option>
        </select>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table className="t pcp-grid">
          <thead><tr>
            <th>Produto</th><th className="text-right">Qtd no mês</th>
            {recursos.map(r => <th key={r.id} className="text-right" title={r.nome}>{r.codigo}</th>)}
          </tr></thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p}>
                <td style={{ minWidth: 240 }}><b style={{ fontWeight: 500 }}>{p}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{dados.desc[p] || ''}</div></td>
                <td className="text-right">{cmFmt(qtds[p], 0)}</td>
                {recursos.map(r => {
                  const h = qtds[p] * horasRoteiro(p, r.id);
                  return <td key={r.id} className="text-right">{h > 0 ? cmFmt(h) + ' h' : '—'}</td>;
                })}
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={2 + recursos.length} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nada {fonte === 'plano' ? 'planejado' : 'em ordens de produção'} em {CM_MESES[mes - 1]}/{ano}.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Recurso</th><th>Tipo</th><th className="text-right">Horas disponíveis</th><th className="text-right">Horas requeridas</th><th className="text-right">Utilização</th><th>Status</th></tr></thead>
          <tbody>
            {recursos.map(r => {
              const disp = cmCalc(r).liquidas, req = requeridas(r.id);
              const pct = disp > 0 ? (req / disp) * 100 : (req > 0 ? 999 : 0);
              const st = cmStatus(pct);
              return (
                <tr key={r.id}>
                  <td><button className="pcp-cod" title="Abrir o cadastro" onClick={() => irPara(r.tipo === 'maquina' ? 'maquinas' : 'capacidade')}>{r.codigo}</button> · {r.nome}</td>
                  <td><span className="pcp-tag">{r.tipo === 'maquina' ? 'Máquina' : 'Mão de obra'}</span></td>
                  <td className="text-right">{cmFmt(disp)}</td>
                  <td className="text-right">{cmFmt(req)}</td>
                  <td className="text-right"><b style={{ fontWeight: 500 }}>{pct >= 999 ? 'sem capacidade' : cmFmt(pct, 0) + '%'}</b></td>
                  <td><span className="pcp-tag" style={classe[st] ? { background: classe[st] } : undefined}>{st}</span></td>
                </tr>
              );
            })}
            {recursos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Cadastre mão de obra e máquinas nas outras abas.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Horas requeridas = quantidade do mês × horas por unidade (aba Roteiro). Até 85% OK · 85–100% atenção · acima de 100% sobrecarga.
        {semRoteiro.length > 0 && <span style={{ color: 'var(--vp-danger)' }}> Sem roteiro cadastrado: {semRoteiro.join(', ')} — a carga deles não está contada.</span>}
      </div>
    </div>
  );
}

function CargaMaquinaPage() {
  const [aba, setAba] = window.useRouteTab('carga-maquina', 'capacidade', ['capacidade', 'maquinas', 'roteiro', 'recursos'], false, true);
  const [recursos, setRecursos] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [podeEditar, setPodeEditar] = React.useState(false);
  const sb = window.__VP_SB && window.__VP_SB.sb;

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    const { data, error } = await sb.from('pcp_recursos').select('*').eq('ativo', true).order('codigo');
    if (error) setErro(error.message); else { setErro(null); setRecursos(data || []); }
  }, [sb]);

  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('carga-maquina', 'editar'))
      .then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const salvar = async (tipo, id, f) => {
    const payload = {
      tipo, codigo: f.codigo.trim(), nome: f.nome.trim(),
      quantidade: cmNum(f.quantidade) || 1, horas_dia: cmNum(f.horas_dia), dias_mes: cmNum(f.dias_mes),
      eficiencia_pct: cmNum(f.eficiencia_pct),
      unidades_por_hora: f.unidades_por_hora === '' ? null : cmNum(f.unidades_por_hora),
      updated_at: new Date().toISOString(),
    };
    if (!id) payload.criado_por = window.__VP_USER?.email || null;
    const q = id ? sb.from('pcp_recursos').update(payload).eq('id', id).select('id') : sb.from('pcp_recursos').insert(payload).select('id');
    const { data, error } = await q;
    if (error || !data || !data.length) { window.toast?.('Não foi possível salvar: ' + (error?.message || 'sem permissão')); return false; }
    window.VPLog?.registrar?.({ modulo: 'Carga Máquina', acao: id ? 'Editou recurso' : 'Criou recurso', alvo: `${payload.codigo} — ${payload.nome}` });
    await carregar();
    return true;
  };
  const desativar = async (r) => {
    if (!window.confirm(`Desativar ${r.codigo} — ${r.nome}?`)) return;
    const { data, error } = await sb.from('pcp_recursos').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', r.id).select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível desativar.'); return; }
    window.VPLog?.registrar?.({ modulo: 'Carga Máquina', acao: 'Desativou recurso', alvo: `${r.codigo} — ${r.nome}` });
    await carregar();
  };

  const abas = [['capacidade', 'Capacidade Produtiva'], ['maquinas', 'Cadastro de Máquinas'], ['roteiro', 'Roteiro (tempo por produto)'], ['recursos', 'Capacidade por Recursos']];
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Carga Máquina</div>
          <h1 className="page-head__title">Carga Máquina</h1>
          <p className="page-head__sub">Capacidade da mão de obra e das máquinas. Horas líquidas = qtd × horas/dia × dias/mês × eficiência.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {abas.map(([id, rot]) => (
          <button key={id} className={'btn btn--sm' + (aba === id ? ' btn--primary' : '')} onClick={() => setAba(id)}>{rot}</button>
        ))}
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {!erro && !recursos && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {recursos && aba === 'capacidade' && <CMTabelaRecursos tipo="mao_de_obra" recursos={recursos} podeEditar={podeEditar} onSalvar={salvar} onDesativar={desativar}/>}
      {recursos && aba === 'maquinas' && <CMTabelaRecursos tipo="maquina" recursos={recursos} podeEditar={podeEditar} onSalvar={salvar} onDesativar={desativar}/>}
      {recursos && aba === 'roteiro' && <CMRoteiro sb={sb} recursos={recursos} podeEditar={podeEditar}/>}
      {recursos && aba === 'recursos' && <CMCapacidadePorRecursos sb={sb} recursos={recursos} irPara={setAba}/>}
    </div>
  );
}

Object.assign(window, { CargaMaquinaPage });
