/* ============================================================
   colaboradores-admin.jsx — Administração (Configurações › Administração)
   Réplica da tela de colaboradores por departamento do vpsistema.com —
   foto real em vez de quadradinho de iniciais, departamentos identados.
   Desde 09/10/2026 é SÓ LEITURA: quem concede alçada é o
   vpsistema.com/administracao (árvore de alçadas), que alimenta
   alcadas_capacidade pela edge function vpsistema-sync.
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

/* Árvore de alçadas (Gelson, 09/10/2026): quem concede ou tira alçada agora
   é o vpsistema.com/administracao — esta tela só MOSTRA o que cada pessoa
   tem no VP Gestão (alcadas_capacidade, alimentada pelo vpsistema). */
function AvisoAlcadasNoVpsistema() {
  return (
    <div style={{ padding: '10px 12px', marginBottom: 16, background: 'var(--vp-warning-tint, #f8eed7)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, color: 'var(--fg2)' }}>
      <b>Somente leitura.</b> As alçadas são geridas em{' '}
      <a href="https://vpsistema.com/administracao" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>vpsistema.com/administracao</a>
      {' '}— o que for marcado lá chega aqui automaticamente.
    </div>
  );
}
window.AvisoAlcadasNoVpsistema = AvisoAlcadasNoVpsistema;

/* Um item do catálogo — se abre (chevron), mostra as ações indentadas
   uma unidade a mais. Sem capacidades definidas usa ACOES_PADRAO
   (Ver/Criar/Editar/Excluir); Propostas (e futuros módulos especiais)
   trazem as próprias. */
function CatalogoItemLinha({ item, concedidas }) {
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
              <label key={chave} className="row gap-2" style={{ alignItems: 'center', padding: '5px 0' }}>
                <input type="checkbox" checked={tem} disabled readOnly/>
                <span className="small">{a.label}</span>
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
function CatalogoGrupo({ grupo, itens, concedidas }) {
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
            <CatalogoItemLinha key={item.modulo} item={item} concedidas={concedidas}/>
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
function PainelAlocacaoModulos({ colaborador, onVoltar }) {
  const [concedidas, setConcedidas] = React.useState(null);

  React.useEffect(() => {
    window.ColaboradoresAdminStore.listarCapacidadesConcedidas().then((rows) => {
      setConcedidas(new Set(rows.filter((r) => r.perfil_id === colaborador.id).map((r) => r.modulo + '.' + r.capacidade)));
    });
  }, [colaborador.id]);

  return (
    <div>
      <button type="button" className="row gap-2" onClick={onVoltar}
        style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--fg2)', fontSize: 12.5, padding: '4px 0', marginBottom: 14 }}>
        <Icon.chevLeft size={13}/> Voltar pra lista de colaboradores
      </button>

      <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 12 }}>
        <AvatarColaborador src={colaborador.avatar_url} nome={colaborador.nome} size="lg"/>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{colaborador.nome}</div>
          <div className="small muted">{colaborador.email || '—'}{colaborador.nivel ? ` · ${colaborador.nivel}` : ''}</div>
        </div>
      </div>

      <AvisoAlcadasNoVpsistema/>

      {concedidas === null ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      ) : (
        window.ColaboradoresAdminStore.CATALOGO_MODULOS.map((g) => (
          <CatalogoGrupo key={g.grupo} grupo={g.grupo} itens={g.itens} concedidas={concedidas}/>
        ))
      )}
    </div>
  );
}

function ColabRow({ colaborador, onEditar }) {
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
        </div>
      </div>
      <div className="row gap-1">
        <Button variant="outline" size="sm" icon="eye" onClick={onEditar}>Ver alçadas</Button>
      </div>
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
     administracao/<id do colaborador>), igual ao padrão já usado no
     PCP (window.useRotaItem). "Ver alçadas" troca a tela inteira. */
  const [rotaItem, setRotaItem] = window.useRotaItem('configuracoes', 'administracao');
  const editando = (arvore && rotaItem)
    ? arvore.flatMap((g) => g.colaboradores).find((c) => c.id === rotaItem) || null
    : null;
  const abrirEditar = (c) => setRotaItem(c.id);
  const fecharPainel = () => setRotaItem(null);

  const reload = React.useCallback(() => { window.ColaboradoresAdminStore.arvoreDepartamentos().then(setArvore).catch(() => setArvore([])); }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const toggleDep = (dep) => setRecolhidos((s) => { const n = new Set(s); n.has(dep) ? n.delete(dep) : n.add(dep); return n; });

  if (arvore === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  if (editando) {
    return <PainelAlocacaoModulos colaborador={editando} onVoltar={fecharPainel}/>;
  }

  const q = search.toLowerCase();
  const arvoreFiltrada = q
    ? arvore.map((g) => ({ ...g, colaboradores: g.colaboradores.filter((c) => c.nome.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) })).filter((g) => g.colaboradores.length > 0)
    : arvore;

  const totalColaboradores = arvore.reduce((s, g) => s + g.colaboradores.length, 0);

  return (
    <div>
      <p className="small muted" style={{ marginTop: 0, marginBottom: 8 }}>
        Espelho de vpsistema.com (Gestão de Colaboradores) — nome, foto e departamento vêm de lá.
      </p>
      <AvisoAlcadasNoVpsistema/>

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
                    <ColabRow key={c.id} colaborador={c} onEditar={() => abrirEditar(c)}/>
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
