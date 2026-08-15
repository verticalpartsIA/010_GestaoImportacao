/* ============================================================
   colaboradores-admin.jsx — Administração (Configurações › Administração)
   Réplica da tela de colaboradores por departamento do vpsistema.com —
   foto real em vez de quadradinho de iniciais, departamentos identados.
   Diferença proposital: aqui um colaborador pode ser alocado em VÁRIOS
   grupos de módulo do VP Gestão (não é o departamento real, que é único
   e vem do RH) — é essa alocação que decide o que ele vê na sidebar.
   ============================================================ */

/* ---------- Avatar com foto real (fallback: iniciais) ----------
   Reused pela própria sidebar (shell.jsx) via window.AvatarColaborador. */
function AvatarColaborador({ src, nome, size }) {
  const iniciais = (nome || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const cls = 'avatar' + (size === 'lg' ? ' lg' : size === 'sm' ? ' sm' : '');
  if (src) return <div className={cls}><img src={src} alt={nome || ''} referrerPolicy="no-referrer"/></div>;
  return <div className={cls}>{iniciais}</div>;
}
window.AvatarColaborador = AvatarColaborador;

function ColabPainelAlocacao({ colaborador, onClose, onChange }) {
  const [alocados, setAlocados] = React.useState(colaborador.alocacoes || []);
  const [busy, setBusy] = React.useState(null);

  const toggle = async (grupo) => {
    setBusy(grupo);
    try {
      if (alocados.includes(grupo)) {
        await window.ColaboradoresAdminStore.desalocar(colaborador.id, grupo);
        setAlocados((a) => a.filter((g) => g !== grupo));
      } else {
        await window.ColaboradoresAdminStore.alocar(colaborador.id, grupo);
        setAlocados((a) => [...a, grupo]);
      }
      onChange && onChange();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusy(null); }
  };

  return (
    <Modal title={`Alocação de módulos — ${colaborador.nome}`} onClose={onClose} width={480}
      footer={<Button variant="primary" onClick={onClose}>Concluído</Button>}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Marque os grupos de módulos que {colaborador.nome.split(' ')[0]} deve ver na sidebar. Pode marcar mais de um —
        diferente do departamento do RH (único), a alocação de acesso aqui é livre.
      </p>
      <div className="stack" style={{ gap: 8 }}>
        {window.ColaboradoresAdminStore.GRUPOS_MODULO.map((grupo) => (
          <label key={grupo} className="row gap-2" style={{ cursor: busy ? 'wait' : 'pointer', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', background: alocados.includes(grupo) ? 'var(--vp-gray-50)' : '#fff' }}>
            <input type="checkbox" checked={alocados.includes(grupo)} disabled={busy === grupo} onChange={() => toggle(grupo)}/>
            <span className="small">{grupo}</span>
            {busy === grupo && <span className="small muted">salvando…</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
}

function ColabRow({ colaborador, onEditar, onExcluir }) {
  return (
    <div className="row sb" style={{ padding: '8px 0 8px 34px', borderBottom: '1px solid var(--border)' }}>
      <div className="row gap-3" style={{ minWidth: 0 }}>
        <AvatarColaborador src={colaborador.avatar_url} nome={colaborador.nome}/>
        <div style={{ minWidth: 0 }}>
          <div className="row gap-2">
            <span className="cell-main">{colaborador.nome}</span>
            {colaborador.is_department_lead && <span className="badge">Líder</span>}
            {colaborador.is_active === false && <span className="badge">Inativo</span>}
          </div>
          <div className="cell-sub">
            {colaborador.email || '—'}{colaborador.nivel ? ` · ${colaborador.nivel}` : ''}
          </div>
          {colaborador.alocacoes.length > 0 && (
            <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {colaborador.alocacoes.map((g) => <span key={g} className="badge" style={{ fontSize: 10 }}>{g}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="row gap-1">
        <Button variant="ghost" size="sm" icon="edit" title="Alocar em módulos" onClick={onEditar}/>
        <Button variant="ghost" size="sm" icon="trash" title="Remover acesso (só as alocações — não apaga o colaborador)" onClick={onExcluir}/>
      </div>
    </div>
  );
}

function ColaboradoresAdminPage() {
  const [arvore, setArvore] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [editando, setEditando] = React.useState(null);
  const [recolhidos, setRecolhidos] = React.useState(() => new Set());

  const reload = React.useCallback(() => { window.ColaboradoresAdminStore.arvoreDepartamentos().then(setArvore).catch(() => setArvore([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const excluirAcesso = async (col) => {
    if (!window.confirm(`Remover TODOS os acessos de módulo de "${col.nome}"? Isso não apaga o colaborador — ele continua existindo no vpsistema, só deixa de ver qualquer módulo aqui até ser alocado de novo.`)) return;
    try { await window.ColaboradoresAdminStore.removerTodasAlocacoes(col.id); window.toast?.('Acesso removido.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const toggleDep = (dep) => setRecolhidos((s) => { const n = new Set(s); n.has(dep) ? n.delete(dep) : n.add(dep); return n; });

  if (arvore === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const q = search.toLowerCase();
  const arvoreFiltrada = q
    ? arvore.map((g) => ({ ...g, colaboradores: g.colaboradores.filter((c) => c.nome.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) })).filter((g) => g.colaboradores.length > 0)
    : arvore;

  const totalColaboradores = arvore.reduce((s, g) => s + g.colaboradores.length, 0);

  return (
    <div>
      <p className="small muted" style={{ marginTop: 0, marginBottom: 14 }}>
        Espelho de vpsistema.com (Gestão de Colaboradores) — nome, foto e departamento vêm de lá, sem edição por aqui.
        O que dá pra editar é a <b>alocação de módulos do VP Gestão</b>: um colaborador pode estar em vários grupos ao mesmo tempo,
        e é isso que decide o que ele vê na sidebar.
      </p>

      <input className="input" style={{ marginBottom: 14 }} placeholder="Buscar colaborador por nome ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)}/>
      <div className="small muted" style={{ marginBottom: 10 }}>{totalColaboradores} colaborador(es) em {arvore.length} departamento(s)</div>

      {arvoreFiltrada.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>Nenhum colaborador encontrado.</div>
      )}

      <div className="stack" style={{ gap: 4 }}>
        {arvoreFiltrada.map((g) => {
          const recolhido = recolhidos.has(g.departamento);
          return (
            <div key={g.departamento} style={{ border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
              <button type="button" onClick={() => toggleDep(g.departamento)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: 0, background: 'var(--vp-gray-50)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                <span>{g.departamento}</span>
                <span className="row gap-2">
                  <span className="badge">{g.colaboradores.length}</span>
                  <Icon.chevDown size={13} style={{ transform: recolhido ? 'rotate(-90deg)' : undefined }}/>
                </span>
              </button>
              {!recolhido && (
                <div style={{ padding: '0 14px' }}>
                  {g.colaboradores.map((c) => (
                    <ColabRow key={c.id} colaborador={c} onEditar={() => setEditando(c)} onExcluir={() => excluirAcesso(c)}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editando && (
        <ColabPainelAlocacao colaborador={editando} onClose={() => setEditando(null)} onChange={reload}/>
      )}
    </div>
  );
}

window.ColaboradoresAdminPage = ColaboradoresAdminPage;
