/* ============================================================
   mes-cadastros.jsx — MES · Fase 0 · Cadastros do chão de fábrica.
   Abas: Frentes · Postos · Etapas modelo · Jornada · Operadores.
   (Motivos de parada/problema/refugo: o MES existente — mes.jsx — já tem bloqueios, pausas e NC.)
   Regras em mes-cadastros-calc.js; gravação em mes-cadastros-store.js.
   Posto = recurso do PCP (pcp_recursos) com frente. Nada é apagado: desativa-se.
   ============================================================ */

const MESC_ABAS = [
  ['frentes', 'Frentes'], ['postos', 'Postos'],
  ['etapas', 'Etapas modelo'], ['jornada', 'Jornada'], ['operadores', 'Operadores'],
];

function mescNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* Carrega uma lista e devolve { dados, erro, recarregar } */
function useMescLista(fn, deps) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const recarregar = React.useCallback(async () => {
    try { setErro(null); setDados(await fn()); } catch (e) { setErro(e.message || String(e)); }
  }, deps); // eslint-disable-line
  React.useEffect(() => { recarregar(); }, [recarregar]);
  return { dados, erro, recarregar };
}

async function mescTentar(fn, okMsg) {
  try { await fn(); if (okMsg) window.toast?.(okMsg); return true; }
  catch (e) { window.toast?.(e.message || 'Não foi possível salvar.'); return false; }
}

function MescEstado({ dados, erro }) {
  if (erro) return <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>;
  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  return null;
}

function MescBadgeAtivo({ ativo }) {
  return <span style={{ color: ativo ? 'var(--vp-success, #2e7d32)' : 'var(--fg3)' }}>{ativo ? 'Ativo' : 'Inativo'}</span>;
}

/* ---------------- Frentes ---------------- */
function MescFrentes({ pode }) {
  const S = window.MesCadastrosStore;
  const { dados, erro, recarregar } = useMescLista(() => S.listarFrentes(), []);
  const [edit, setEdit] = React.useState(null);
  const [form, setForm] = React.useState({ codigo: '', nome: '', ordem: 0 });
  const [inativos, setInativos] = React.useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const abrir = (f) => { setEdit(f ? f.id : 'novo'); setForm(f ? { codigo: f.codigo, nome: f.nome, ordem: f.ordem } : { codigo: '', nome: '', ordem: ((dados || []).length + 1) * 10 }); };
  const salvar = async () => { if (await mescTentar(() => S.salvarFrente(edit === 'novo' ? null : edit, form), 'Frente salva.')) { setEdit(null); recarregar(); } };
  const ativar = async (f, a) => { if (await mescTentar(() => S.ativarFrente(f, a))) recarregar(); };
  const est = MescEstado({ dados, erro });
  if (est) return est;
  const lista = dados.filter(f => inativos || f.ativo);
  return (
    <div className="card table-wrap">
      <table className="t pcp-grid pcp-cruz" onMouseOver={window.pcpColHover} onMouseLeave={window.pcpColHover}>
        <thead><tr><th>Código</th><th>Nome</th><th className="text-right">Ordem</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {lista.map(f => (
            <tr key={f.id} style={f.ativo ? undefined : { opacity: 0.55 }}>
              <td><code>{f.codigo}</code></td>
              {edit === f.id ? (<>
                <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
                <td className="text-right"><input className="input" type="number" style={{ width: 70 }} value={form.ordem} onChange={e => set('ordem', e.target.value)}/></td>
              </>) : (<><td>{f.nome}</td><td className="text-right">{f.ordem}</td></>)}
              <td><MescBadgeAtivo ativo={f.ativo}/></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {pode && (edit === f.id ? (<>
                  <button className="btn btn--sm btn--primary" onClick={salvar}>Salvar</button>{' '}
                  <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
                </>) : (<>
                  <button className="btn btn--sm" onClick={() => abrir(f)}>Editar</button>{' '}
                  <button className="btn btn--sm" onClick={() => ativar(f, !f.ativo)}>{f.ativo ? 'Desativar' : 'Reativar'}</button>
                </>))}
              </td>
            </tr>
          ))}
          {edit === 'novo' && (
            <tr>
              <td><input className="input" placeholder="ex.: corrimao" value={form.codigo} onChange={e => set('codigo', e.target.value)} style={{ width: 130 }}/></td>
              <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
              <td className="text-right"><input className="input" type="number" style={{ width: 70 }} value={form.ordem} onChange={e => set('ordem', e.target.value)}/></td>
              <td></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn--sm btn--primary" onClick={salvar}>Salvar</button>{' '}
                <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
              </td>
            </tr>
          )}
          {lista.length === 0 && edit !== 'novo' && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhuma frente.</td></tr>}
        </tbody>
      </table>
      <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {pode && edit == null && <button className="btn btn--sm" onClick={() => abrir(null)}>+ Adicionar frente</button>}
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}><input type="checkbox" checked={inativos} onChange={e => setInativos(e.target.checked)}/> mostrar inativas</label>
      </div>
      <div style={{ padding: '0 12px 12px', fontSize: 12, color: 'var(--fg3)' }}>
        O código é o mesmo que as OPs já usam (<code>quadro</code>, <code>fiacao</code>, <code>botoeiras</code>, <code>cabos_aco</code>, <code>corte</code>) e não muda depois de criado. Frente desativada some das listas novas, mas as OPs antigas continuam intactas.
      </div>
    </div>
  );
}

/* ---------------- Postos (recursos do PCP com frente) ---------------- */
const MESC_TIPOS_POSTO = [['mao_de_obra', 'Mão de obra'], ['maquina', 'Máquina']];

function MescPostos({ pode }) {
  const S = window.MesCadastrosStore;
  const { dados, erro, recarregar } = useMescLista(async () => ({ postos: await S.listarPostos(), frentes: await S.listarFrentes() }), []);
  const [edit, setEdit] = React.useState(null);
  const vazio = { codigo: '', nome: '', tipo: 'mao_de_obra', frente_codigo: '' };
  const [form, setForm] = React.useState(vazio);
  const [inativos, setInativos] = React.useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const abrir = (p) => { setEdit(p ? p.id : 'novo'); setForm(p ? { codigo: p.codigo, nome: p.nome, tipo: p.tipo, frente_codigo: p.frente_codigo || '' } : vazio); };
  const salvar = async () => { if (await mescTentar(() => S.salvarPosto(edit === 'novo' ? null : edit, form), 'Posto salvo.')) { setEdit(null); recarregar(); } };
  const ativar = async (p, a) => { if (await mescTentar(() => S.ativarPosto(p, a))) recarregar(); };
  const est = MescEstado({ dados, erro });
  if (est) return est;
  const nomeFrente = (c) => (dados.frentes.find(f => f.codigo === c) || {}).nome || '—';
  const lista = dados.postos.filter(p => inativos || p.ativo);
  const seletorFrente = (
    <select className="input" value={form.frente_codigo} onChange={e => set('frente_codigo', e.target.value)}>
      <option value="">— escolha —</option>
      {dados.frentes.filter(f => f.ativo || f.codigo === form.frente_codigo).map(f => <option key={f.codigo} value={f.codigo}>{f.nome}</option>)}
    </select>
  );
  const seletorTipo = (
    <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
      {MESC_TIPOS_POSTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
    </select>
  );
  const semFrente = dados.postos.filter(p => p.ativo && !p.frente_codigo).length;
  return (
    <div className="card table-wrap">
      <table className="t pcp-grid pcp-cruz" onMouseOver={window.pcpColHover} onMouseLeave={window.pcpColHover}>
        <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Frente</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {lista.map(p => (
            <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.55 }}>
              <td><b style={{ fontWeight: 500 }}>{p.codigo}</b></td>
              {edit === p.id ? (<>
                <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
                <td>{seletorTipo}</td><td>{seletorFrente}</td>
              </>) : (<>
                <td>{p.nome}</td>
                <td>{(MESC_TIPOS_POSTO.find(t => t[0] === p.tipo) || [])[1] || p.tipo}</td>
                <td>{p.frente_codigo ? nomeFrente(p.frente_codigo) : <span style={{ color: 'var(--vp-danger)' }}>sem frente</span>}</td>
              </>)}
              <td><MescBadgeAtivo ativo={p.ativo}/></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {pode && (edit === p.id ? (<>
                  <button className="btn btn--sm btn--primary" onClick={salvar}>Salvar</button>{' '}
                  <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
                </>) : (<>
                  <button className="btn btn--sm" onClick={() => abrir(p)}>Editar</button>{' '}
                  <button className="btn btn--sm" onClick={() => ativar(p, !p.ativo)}>{p.ativo ? 'Desativar' : 'Reativar'}</button>
                </>))}
              </td>
            </tr>
          ))}
          {edit === 'novo' && (
            <tr>
              <td><input className="input" placeholder="ex.: BQ-01" value={form.codigo} onChange={e => set('codigo', e.target.value)} style={{ width: 110 }}/></td>
              <td><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}/></td>
              <td>{seletorTipo}</td><td>{seletorFrente}</td><td></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn--sm btn--primary" onClick={salvar}>Salvar</button>{' '}
                <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
              </td>
            </tr>
          )}
          {lista.length === 0 && edit !== 'novo' && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum posto cadastrado.</td></tr>}
        </tbody>
      </table>
      <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {pode && edit == null && <button className="btn btn--sm" onClick={() => abrir(null)}>+ Adicionar posto</button>}
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}><input type="checkbox" checked={inativos} onChange={e => setInativos(e.target.checked)}/> mostrar inativos</label>
      </div>
      <div style={{ padding: '0 12px 12px', fontSize: 12, color: 'var(--fg3)' }}>
        Posto é o mesmo cadastro de recursos da Carga Máquina (mão de obra e máquinas), agora ligado a uma frente. Capacidade, horas e eficiência continuam sendo editadas na Carga Máquina.
        {semFrente > 0 && <span style={{ color: 'var(--vp-danger)' }}> {semFrente} recurso(s) ativo(s) ainda sem frente.</span>}
      </div>
    </div>
  );
}

/* ---------------- Etapas modelo ---------------- */
function MescEtapas({ pode }) {
  const S = window.MesCadastrosStore, C = window.MesCadastrosCalc;
  const { dados, erro, recarregar } = useMescLista(() => S.listarEtapasModelo(), []);
  const [edit, setEdit] = React.useState(null);
  const [form, setForm] = React.useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const salvar = async () => { if (await mescTentar(() => S.salvarEtapaModelo(edit, form), 'Etapa salva.')) { setEdit(null); recarregar(); } };
  const est = MescEstado({ dados, erro });
  if (est) return est;
  return (
    <div className="card table-wrap">
      <table className="t pcp-grid pcp-cruz" onMouseOver={window.pcpColHover} onMouseLeave={window.pcpColHover}>
        <thead><tr><th className="text-right">#</th><th>Etapa</th><th>Setor</th><th>Tipo</th><th className="text-right">Operadores</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {dados.map(e => (
            <tr key={e.id} style={e.ativo ? undefined : { opacity: 0.55 }}>
              <td className="text-right">{e.posicao}</td>
              {edit === e.id ? (<>
                <td><input className="input" value={form.nome} onChange={x => set('nome', x.target.value)}/></td>
                <td><input className="input" value={form.setor || ''} onChange={x => set('setor', x.target.value)} style={{ width: 130 }}/></td>
                <td><select className="input" value={form.tipo} onChange={x => set('tipo', x.target.value)}>{C.TIPOS_ETAPA.map(t => <option key={t} value={t}>{C.ROTULO_TIPO_ETAPA[t]}</option>)}</select></td>
                <td className="text-right"><input className="input" type="number" min="1" step="1" style={{ width: 70 }} value={form.operadores} onChange={x => set('operadores', x.target.value)}/></td>
              </>) : (<>
                <td>{e.nome}</td><td>{e.setor || '—'}</td><td>{C.ROTULO_TIPO_ETAPA[e.tipo] || e.tipo}</td><td className="text-right">{e.operadores}</td>
              </>)}
              <td><MescBadgeAtivo ativo={e.ativo}/></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {pode && (edit === e.id ? (<>
                  <button className="btn btn--sm btn--primary" onClick={salvar}>Salvar</button>{' '}
                  <button className="btn btn--sm" onClick={() => setEdit(null)}>Cancelar</button>
                </>) : <button className="btn btn--sm" onClick={() => { setEdit(e.id); setForm({ nome: e.nome, setor: e.setor, tipo: e.tipo, operadores: e.operadores }); }}>Editar</button>)}
              </td>
            </tr>
          ))}
          {dados.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhuma etapa modelo.</td></tr>}
        </tbody>
      </table>
      <div style={{ padding: 12, fontSize: 12, color: 'var(--fg3)' }}>
        São as etapas que toda OP nova herda. <b>Inspeção / conferência</b> separa as checagens de qualidade das etapas de fabricação. O número de operadores é quantas pessoas a etapa precisa ao mesmo tempo. Vale para as próximas OPs; as já abertas não mudam.
      </div>
    </div>
  );
}

/* ---------------- Jornada ---------------- */
function MescJornada({ pode }) {
  const S = window.MesCadastrosStore, C = window.MesCadastrosCalc;
  const { dados, erro, recarregar } = useMescLista(() => S.obterJornada(), []);
  const [form, setForm] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  React.useEffect(() => {
    if (dados) setForm({ nome: dados.nome, inicio: String(dados.inicio).slice(0, 5), fim: String(dados.fim).slice(0, 5), intervalo_min: dados.intervalo_min, dias_semana: dados.dias_semana || [] });
  }, [dados]);
  if (erro) return <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>;
  if (!form) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const alternarDia = (n) => set('dias_semana', form.dias_semana.includes(n) ? form.dias_semana.filter(x => x !== n) : [...form.dias_semana, n]);
  const erros = C.validarJornada(form);
  const salvar = async () => {
    setSalvando(true);
    const ok = await mescTentar(() => S.salvarJornada(form), 'Jornada salva.');
    setSalvando(false);
    if (ok) recarregar();
  };
  return (
    <div className="card" style={{ padding: 16, maxWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <label>Início<input className="input" type="time" disabled={!pode} value={form.inicio} onChange={e => set('inicio', e.target.value)}/></label>
        <label>Fim<input className="input" type="time" disabled={!pode} value={form.fim} onChange={e => set('fim', e.target.value)}/></label>
        <label>Intervalo (min)<input className="input" type="number" min="0" step="5" disabled={!pode} value={form.intervalo_min} onChange={e => set('intervalo_min', e.target.value)}/></label>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 4 }}>Dias de trabalho</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {C.DIAS.map(d => (
            <label key={d.n}><input type="checkbox" disabled={!pode} checked={form.dias_semana.includes(d.n)} onChange={() => alternarDia(d.n)}/> {d.curto}</label>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 14 }}>
        Horas úteis por dia: <b>{C.horasUteisDia(form).toLocaleString('pt-BR')} h</b> · {C.resumoDias(form.dias_semana)}
      </div>
      {erros.length > 0 && <div style={{ marginTop: 8, color: 'var(--vp-danger)', fontSize: 13 }}>{erros.join(' ')}</div>}
      {pode && <div style={{ marginTop: 14 }}><button className="btn btn--sm btn--primary" disabled={salvando || erros.length > 0} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar jornada'}</button></div>}
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg3)' }}>
        Horário normal único para toda a fábrica. O intervalo de 60 min é um valor de partida — ajuste ao real. O Scheduler usará estas horas para a capacidade por dia.
      </div>
    </div>
  );
}

/* ---------------- Operadores (posto padrão) ---------------- */
function MescOperadores({ pode }) {
  const S = window.MesCadastrosStore;
  const { dados, erro, recarregar } = useMescLista(async () => ({ pessoas: await S.listarOperadores(), postos: (await S.listarPostos()).filter(p => p.ativo), frentes: await S.listarFrentes() }), []);
  const [busca, setBusca] = React.useState('');
  const [soComPosto, setSoComPosto] = React.useState(false);
  const est = MescEstado({ dados, erro });
  if (est) return est;
  const q = mescNorm(busca);
  const lista = dados.pessoas.filter(p => (!soComPosto || p.recurso_id) && (!q || mescNorm(p.nome + ' ' + p.email + ' ' + (p.departamento || '')).includes(q)));
  const trocar = async (p, id) => { if (await mescTentar(() => S.salvarPostoPadrao(p.email, id || null))) recarregar(); };
  const nomeFrente = (c) => (dados.frentes.find(f => f.codigo === c) || {}).nome || 'sem frente';
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar por nome, e-mail ou departamento" value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 340 }}/>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={soComPosto} onChange={e => setSoComPosto(e.target.checked)}/> só quem já tem posto</label>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{lista.length} de {dados.pessoas.length} colaboradores</span>
      </div>
      <div className="card table-wrap">
        <table className="t pcp-grid pcp-cruz" onMouseOver={window.pcpColHover} onMouseLeave={window.pcpColHover}>
          <thead><tr><th>Colaborador</th><th>Departamento</th><th>Cargo</th><th>Posto padrão</th></tr></thead>
          <tbody>
            {lista.map(p => (
              <tr key={p.email}>
                <td>{p.nome}<div style={{ fontSize: 11, color: 'var(--fg3)' }}>{p.email}</div></td>
                <td>{p.departamento || '—'}</td><td>{p.cargo || '—'}</td>
                <td>
                  <select className="input" disabled={!pode} value={p.recurso_id || ''} onChange={e => trocar(p, e.target.value)}>
                    <option value="">— nenhum —</option>
                    {dados.postos.map(x => <option key={x.id} value={x.id}>{x.codigo} — {x.nome} ({nomeFrente(x.frente_codigo)})</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Ninguém encontrado.</td></tr>}
          </tbody>
        </table>
        <div style={{ padding: 12, fontSize: 12, color: 'var(--fg3)' }}>
          Cada operador entra com o próprio login; o posto padrão só diz onde ele costuma trabalhar (a tela do tablet vai abrir já nele). Escolha entre os postos ativos da aba Postos.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Página ---------------- */
function MESCadastrosPage() {
  const [aba, setAba] = window.useRouteTab('mes-cadastros', 'frentes', MESC_ABAS.map(a => a[0]), false, true);
  const [pode, setPode] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('mes-cadastros', 'editar'))
      .then(v => { if (vivo) setPode(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · MES</div>
          <h1 className="page-head__title">Cadastros do MES</h1>
          <p className="page-head__sub">A base do chão de fábrica: frentes, postos, etapas modelo, jornada e operadores.</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {MESC_ABAS.map(([id, rot]) => (
          <button key={id} className={'btn btn--sm' + (aba === id ? ' btn--primary' : '')} onClick={() => setAba(id)}>{rot}</button>
        ))}
      </div>
      {!pode && <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 8 }}>Você pode consultar, mas não editar (falta a alçada "Editar" do MES — Cadastros).</div>}
      {aba === 'frentes' && <MescFrentes pode={pode}/>}
      {aba === 'postos' && <MescPostos pode={pode}/>}
      {aba === 'etapas' && <MescEtapas pode={pode}/>}
      {aba === 'jornada' && <MescJornada pode={pode}/>}
      {aba === 'operadores' && <MescOperadores pode={pode}/>}
    </div>
  );
}

Object.assign(window, { MESCadastrosPage });
