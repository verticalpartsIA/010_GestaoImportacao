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

/* Um item do catálogo — se abre (chevron), mostra as ações indentadas
   uma unidade a mais. Sem capacidades definidas usa ACOES_PADRAO
   (Ver/Criar/Editar/Excluir); Propostas (e futuros módulos especiais)
   trazem as próprias. */
function CatalogoItemLinha({ item, concedidas, onToggle, salvandoChave }) {
  const [aberto, setAberto] = React.useState(false);
  const acoes = item.capacidades || window.ColaboradoresAdminStore.ACOES_PADRAO.map((a) => ({ chave: a.chave, label: a.label }));
  const nConcedidas = acoes.filter((a) => concedidas.has(item.modulo + '.' + a.chave)).length;
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div className="row sb" style={{ cursor: 'pointer', padding: '8px 0' }} onClick={() => setAberto((v) => !v)}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <Icon.chevRight size={12} style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
          <span className="small" style={{ fontWeight: 600 }}>{item.label}</span>
        </div>
        <span className="small muted mono">{nConcedidas}/{acoes.length}</span>
      </div>
      {aberto && (
        <div style={{ marginLeft: 20, paddingBottom: 8 }}>
          {acoes.map((a) => {
            const chave = item.modulo + '.' + a.chave;
            const tem = concedidas.has(chave);
            return (
              <label key={chave} className="row gap-2" style={{ alignItems: 'center', padding: '5px 0', cursor: salvandoChave ? 'wait' : 'pointer' }}>
                <input type="checkbox" checked={tem} disabled={salvandoChave === chave}
                  onChange={(e) => onToggle(item.modulo, a.chave, e.target.checked)}/>
                <span className="small">{a.label}</span>
                {salvandoChave === chave && <span className="small muted">salvando…</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Um grupo (Comercial, Engenharia...) — abre e mostra os módulos daquele
   grupo, cada um com sua própria linha expansível (CatalogoItemLinha). */
function CatalogoGrupo({ grupo, itens, concedidas, onToggle, salvandoChave }) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: '#fff', marginBottom: 6 }}>
      <button type="button" onClick={() => setAberto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: 0, background: 'var(--vp-gray-50)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
        <span>{grupo}</span>
        <span className="row gap-2">
          <span className="badge">{itens.length}</span>
          <Icon.chevDown size={13} style={{ transform: aberto ? undefined : 'rotate(-90deg)' }}/>
        </span>
      </button>
      {aberto && (
        <div style={{ padding: '0 14px' }}>
          {itens.map((item) => (
            <CatalogoItemLinha key={item.modulo} item={item} concedidas={concedidas} onToggle={onToggle} salvandoChave={salvandoChave}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* Painel cheio (não modal pequeno) — pedido explícito do usuário 19/08:
   lista, mesmo indentada, é grande, então precisa de rolagem natural da
   página inteira, nada travado em cima/embaixo. Fica no lugar da lista
   de colaboradores enquanto aberto; "Voltar" retorna pra lista. */
function PainelAlocacaoModulos({ colaborador, onVoltar, onChange }) {
  const [alocadosGrupo, setAlocadosGrupo] = React.useState(colaborador.alocacoes || []);
  const [concedidas, setConcedidas] = React.useState(null);
  const [busyGrupo, setBusyGrupo] = React.useState(null);
  const [salvandoChave, setSalvandoChave] = React.useState(null);

  const carregarCapacidades = React.useCallback(() => {
    window.ColaboradoresAdminStore.listarCapacidadesConcedidas().then((rows) => {
      const set = new Set(rows.filter((r) => r.perfil_id === colaborador.id).map((r) => r.modulo + '.' + r.capacidade));
      setConcedidas(set);
    });
  }, [colaborador.id]);
  React.useEffect(() => { carregarCapacidades(); }, [carregarCapacidades]);

  const toggleGrupo = async (grupo) => {
    setBusyGrupo(grupo);
    try {
      const S = window.ColaboradoresAdminStore;
      const marcando = !alocadosGrupo.includes(grupo);
      if (marcando) await S.alocar(colaborador.id, grupo);
      else await S.desalocar(colaborador.id, grupo);
      /* Grupo inteiro = todos os módulos do grupo com todas as ações
         (marcar) ou nenhum (desmarcar) — ajustes finos ficam por módulo. */
      const afetadas = await S.concederGrupoInteiro(colaborador.id, grupo, marcando);
      setAlocadosGrupo((a) => marcando ? [...a, grupo] : a.filter((g) => g !== grupo));
      setConcedidas((prev) => {
        const n = new Set(prev || []);
        afetadas.forEach((l) => { const k = l.modulo + '.' + l.capacidade; marcando ? n.add(k) : n.delete(k); });
        return n;
      });
      onChange && onChange();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusyGrupo(null); }
  };

  const toggleCapacidade = async (modulo, capacidade, conceder) => {
    const chave = modulo + '.' + capacidade;
    setSalvandoChave(chave);
    try {
      await window.ColaboradoresAdminStore.concederCapacidade(colaborador.id, modulo, capacidade, conceder);
      setConcedidas((prev) => { const n = new Set(prev); conceder ? n.add(chave) : n.delete(chave); return n; });
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSalvandoChave(null); }
  };

  return (
    <div>
      <button type="button" className="row gap-2" onClick={onVoltar}
        style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--fg2)', fontSize: 12.5, padding: '4px 0', marginBottom: 14 }}>
        <Icon.chevLeft size={13}/> Voltar pra lista de colaboradores
      </button>

      <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 6 }}>
        <AvatarColaborador src={colaborador.avatar_url} nome={colaborador.nome} size="lg"/>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{colaborador.nome}</div>
          <div className="small muted">{colaborador.email || '—'}{colaborador.nivel ? ` · ${colaborador.nivel}` : ''}</div>
        </div>
      </div>

      <p className="small muted" style={{ marginBottom: 18 }}>
        Acesso ao grupo controla o que aparece na sidebar. Dentro de cada módulo, marque exatamente o que{' '}
        {colaborador.nome.split(' ')[0]} pode fazer — Ver, Criar, Editar, Excluir (ou as opções específicas do módulo).
      </p>

      <div style={{ padding: '10px 12px', marginBottom: 16, background: 'var(--vp-gray-50)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--fg2)' }}>
        Acesso por grupo (sidebar)
        <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {window.ColaboradoresAdminStore.GRUPOS_MODULO.map((grupo) => (
            <label key={grupo} className="row gap-1" style={{ alignItems: 'center', cursor: busyGrupo ? 'wait' : 'pointer', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', background: alocadosGrupo.includes(grupo) ? '#fff' : 'transparent' }}>
              <input type="checkbox" checked={alocadosGrupo.includes(grupo)} disabled={busyGrupo === grupo} onChange={() => toggleGrupo(grupo)}/>
              <span className="small">{grupo}</span>
            </label>
          ))}
        </div>
      </div>

      {concedidas === null ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      ) : (
        window.ColaboradoresAdminStore.CATALOGO_MODULOS.map((g) => (
          <CatalogoGrupo key={g.grupo} grupo={g.grupo} itens={g.itens} concedidas={concedidas} onToggle={toggleCapacidade} salvandoChave={salvandoChave}/>
        ))
      )}
    </div>
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
          {colaborador.alocacoes.includes('__acesso_restrito__') ? (
            <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              <span className="badge" style={{ fontSize: 10 }} title="Acesso removido — só vê Geral até ser alocado de novo">🔒 Acesso bloqueado</span>
            </div>
          ) : colaborador.alocacoes.length > 0 && (
            <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {colaborador.alocacoes.map((g) => <span key={g} className="badge" style={{ fontSize: 10 }}>{g}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="row gap-1">
        <Button variant="outline" size="sm" icon="edit" onClick={onEditar}>Alocar em Módulo</Button>
        <Button variant="ghost" size="sm" icon="trash" title="Remover acesso (só as alocações — não apaga o colaborador)" onClick={onExcluir}/>
      </div>
    </div>
  );
}

function MatrizPermissoes() {
  const [colaboradores, setColaboradores] = React.useState([]);
  const [alocacoes, setAlocacoes] = React.useState({});
  const [salvando, setSalvando] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [busca, setBusca] = React.useState('');

  const grupos = window.ColaboradoresAdminStore?.GRUPOS_MODULO || [];

  const carregar = React.useCallback(async () => {
    try {
      const cols = await window.ColaboradoresAdminStore?.listarColaboradores?.();
      const alocs = await window.ColaboradoresAdminStore?.listarAlocacoes?.();

      setColaboradores((cols || []).sort((a, b) => a.nome.localeCompare(b.nome)));

      const map = {};
      (alocs || []).forEach(a => {
        map[a.colaborador_id] = map[a.colaborador_id] || new Set();
        if (a.grupo_modulo !== '__acesso_restrito__') {
          map[a.colaborador_id].add(a.grupo_modulo);
        }
      });
      setAlocacoes(map);
    } catch (e) { console.warn('Erro ao carregar', e); }
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const toggle = async (colId, grupo) => {
    setSalvando(`${colId}|${grupo}`);
    try {
      const temAcesso = (alocacoes[colId] || new Set()).has(grupo);
      if (temAcesso) {
        await window.ColaboradoresAdminStore.desalocar(colId, grupo);
      } else {
        await window.ColaboradoresAdminStore.alocar(colId, grupo);
      }
      await carregar();
      setStatus('✓ Salvo!');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      window.toast?.('Erro: ' + e.message, 'error');
    } finally {
      setSalvando(null);
    }
  };

  const buscaLower = busca.toLowerCase();
  const colsFiltrados = colaboradores.filter(c => c.nome?.toLowerCase().includes(buscaLower));

  return (
    <div style={{ padding: '1rem 0' }}>
      <h3 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Matriz de permissões</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 1rem' }}>Marque os módulos que cada usuário pode acessar.</p>

      <input type="text" className="input" style={{ marginBottom: '1rem' }} placeholder="Buscar usuário…" value={busca} onChange={(e) => setBusca(e.target.value)}/>

      {colsFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
          {colaboradores.length === 0 ? 'Carregando…' : 'Nenhum usuário encontrado'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '0.5px solid var(--border)', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--vp-gray-50)', borderBottom: '0.5px solid var(--border)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 500, minWidth: 120, borderRight: '0.5px solid var(--border)' }}>Usuário</th>
                {grupos.map(g => (
                  <th key={g} style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 400,
                    minWidth: 80,
                    borderRight: '0.5px solid var(--border)',
                    fontSize: 11,
                    background: g === 'Suprimentos & Importação' ? '#EEF5FF' : 'transparent',
                  }}>
                    {g.split('&')[0].split('|')[0].trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colsFiltrados.map(col => (
                <tr key={col.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500, borderRight: '0.5px solid var(--border)', color: 'var(--text-primary)' }}>
                    {col.nome}
                  </td>
                  {grupos.map(g => {
                    const temAcesso = (alocacoes[col.id] || new Set()).has(g);
                    const key = `${col.id}|${g}`;
                    return (
                      <td key={g} style={{
                        padding: '8px',
                        textAlign: 'center',
                        borderRight: '0.5px solid var(--border)',
                        background: g === 'Suprimentos & Importação' ? '#EEF5FF' : 'transparent',
                      }}>
                        <input type="checkbox" checked={temAcesso} disabled={salvando === key} onChange={() => toggle(col.id, g)} style={{ cursor: salvando === key ? 'wait' : 'pointer', width: 16, height: 16 }}/>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: '0.5rem', fontSize: 12, color: 'var(--text-secondary)' }}>{colsFiltrados.length} usuário(s)</div>
      {status && <div style={{ marginTop: '1rem', padding: '8px 12px', background: '#E8F5E9', color: '#2E7D32', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{status}</div>}
    </div>
  );
}

function ColaboradoresAdminPage() {
  const [arvore, setArvore] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [recolhidos, setRecolhidos] = React.useState(() => new Set());
  /* Esta tela vive dentro da aba "administracao" de Configurações
     (financeiro.jsx › ConfiguracoesPage), que já escreve o 2º segmento da
     URL com o nome da aba — aqui lê/escreve o 3º (/admin/configuracoes/
     administracao/<id do colaborador>|matriz), igual ao padrão já usado no
     PCP (window.useRotaItem). "Alocar em Módulo" e "Ver em matriz" trocam a
     tela inteira (sem lista por trás), então os dois cabem no mesmo slot. */
  const [rotaItem, setRotaItem] = window.useRotaItem('configuracoes', 'administracao');
  const editando = (arvore && rotaItem && rotaItem !== 'matriz')
    ? arvore.flatMap((g) => g.colaboradores).find((c) => c.id === rotaItem) || null
    : null;
  const visualizacao = rotaItem === 'matriz' ? 'matriz' : 'padrão';
  const abrirEditar = (c) => setRotaItem(c.id);
  const abrirMatriz = () => setRotaItem('matriz');
  const fecharPainel = () => setRotaItem(null);

  const reload = React.useCallback(() => { window.ColaboradoresAdminStore.arvoreDepartamentos().then(setArvore).catch(() => setArvore([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const excluirAcesso = async (col) => {
    if (!window.confirm(`Remover TODOS os acessos de módulo de "${col.nome}"? Isso não apaga o colaborador — ele continua existindo no vpsistema, só deixa de ver qualquer módulo aqui até ser alocado de novo.`)) return;
    try { await window.ColaboradoresAdminStore.removerTodasAlocacoes(col.id); window.toast?.('Acesso removido.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const toggleDep = (dep) => setRecolhidos((s) => { const n = new Set(s); n.has(dep) ? n.delete(dep) : n.add(dep); return n; });

  if (arvore === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  if (editando) {
    return <PainelAlocacaoModulos colaborador={editando} onVoltar={fecharPainel} onChange={reload}/>;
  }

  if (visualizacao === 'matriz') {
    return (
      <div>
        <div className="row gap-2" style={{ marginBottom: 16 }}>
          <button onClick={fecharPainel} style={{ padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            ← Voltar
          </button>
          <div className="small muted">Visualização em matriz — clique rápido para alterar permissões</div>
        </div>
        <MatrizPermissoes />
      </div>
    );
  }

  const q = search.toLowerCase();
  const arvoreFiltrada = q
    ? arvore.map((g) => ({ ...g, colaboradores: g.colaboradores.filter((c) => c.nome.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) })).filter((g) => g.colaboradores.length > 0)
    : arvore;

  const totalColaboradores = arvore.reduce((s, g) => s + g.colaboradores.length, 0);

  return (
    <div>
      <div className="row sb" style={{ marginBottom: 16, alignItems: 'center' }}>
        <div>
          <p className="small muted" style={{ marginTop: 0, marginBottom: 8 }}>
            Espelho de vpsistema.com (Gestão de Colaboradores) — nome, foto e departamento vêm de lá.
            O que dá pra editar é a <b>alocação de módulos do VP Gestão</b>.
          </p>
        </div>
        <button onClick={abrirMatriz} style={{ padding: '8px 14px', background: 'var(--fill-accent)', color: 'white', border: '0.5px solid var(--fill-accent)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          Ver em matriz →
        </button>
      </div>

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
                    <ColabRow key={c.id} colaborador={c} onEditar={() => abrirEditar(c)} onExcluir={() => excluirAcesso(c)}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.ColaboradoresAdminPage = ColaboradoresAdminPage;
