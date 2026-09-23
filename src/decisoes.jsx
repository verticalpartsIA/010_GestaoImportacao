/* ============================================================
   decisoes.jsx — Central de Decisões (Fase 1)
   Caixa de entrada pessoal: cada usuário logado vê só as decisões
   gerenciais que esperam por ele (CEO, Owner, Gestor Comercial,
   Engenharia, Logística — ver decisoes-store.js).
   ============================================================ */

function fmtDataHora(d) { return d ? new Date(d).toLocaleString('pt-BR') : '—'; }

/* Gera navegação pra abrir o documento que precisa ser aprovado.
   Retorna {page, id} | {page, numeroCotacao} | null.
   `numeroCotacao` (em vez de `id`) sinaliza pro clique em "Ver documento"
   que precisa resolver pro id real do registro antes de navegar — ver
   abrirDocumento() em DecCard: numero_cotacao é o Nº legível da cotação,
   não o id (uuid) de formularios_elevador que a página de destino espera. */
function gerarLinkDecisao(decisao) {
  const ctx = decisao.contexto || {};

  // Cotação — vai pro formulário de cotação
  if (decisao.numero_cotacao != null) {
    return { page: 'formulario-elevador', numeroCotacao: decisao.numero_cotacao };
  }

  // Dossier de obra
  if (decisao.dossier_id) {
    return { page: 'dossier-obra', id: decisao.dossier_id };
  }

  // Referência genérica (tabela + id) — aqui referencia_id já É o id real
  // do registro (diferente do numero_cotacao acima). Só tabelas com
  // mapeamento conhecido pra uma rota real geram link; o resto fica sem
  // botão em vez de gerar um link quebrado (window.VpRouter.KNOWN_ROUTES
  // não tem 'formularios_rfq'/'formularios_ims'/nome-cru-da-tabela).
  if (decisao.referencia_tabela && decisao.referencia_id) {
    const tabelaPagina = {
      'formularios_elevador': 'formulario-elevador',
      'parceiros_instaladores': 'cadastro-instaladores',
      'contrato_instalador_parcelas': 'pagamentos-instalador',
      'pedidos_compra_varejo': 'almoxarifado',
    };
    const page = tabelaPagina[decisao.referencia_tabela];
    if (!page) return null;
    return { page, id: decisao.referencia_id };
  }

  // Fallback: nenhum link
  return null;
}

function DecModalReprovar({ decisao, onClose, onSaved }) {
  const [motivo, setMotivo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    if (!motivo.trim()) return window.toast?.('Informe o motivo da reprovação.', 'warning');
    setSaving(true);
    try {
      await window.DecisoesStore.reprovar(decisao.id, motivo);
      window.toast?.('Decisão reprovada.', 'warning');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Reprovar decisão" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar reprovação'}</Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</p>
        <label className="up-eyebrow muted">Motivo</label>
        <textarea className="input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique o motivo da reprovação…"/>
      </div>
    </Modal>
  );
}

function DecCard({ decisao, onReload, setRoute, setSubsel }) {
  const [busy, setBusy] = React.useState(false);
  const [reprovando, setReprovando] = React.useState(false);
  const [abrindo, setAbrindo] = React.useState(false);
  const ctx = decisao.contexto || {};
  /* Visão de Administrador mostra decisões de qualquer pessoa (ver
     listarTodasEmAberto em decisoes-store.js) — mas aprovar()/reprovar()
     continuam travados no servidor por souAprovador(). Em vez de deixar o
     Admin clicar e tomar um erro, já esconde os botões e explica quem
     decide de verdade — visualização, não aprovação (pedido explícito do
     usuário: "não vou aprovar nada"). */
  const souAprovador = window.DecisoesStore.souAprovador(decisao);
  const bloqueada = decisao.status === 'bloqueada_por_dependencia';

  const aprovar = async () => {
    setBusy(true);
    try {
      await window.DecisoesStore.aprovar(decisao.id);
      window.toast?.('Decisão aprovada.', 'success');
      onReload();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const linkDocumento = gerarLinkDecisao(decisao);

  /* Navega de verdade pro documento. window.VpRouter.navigate() sozinho só
     reescreve a URL (pushState) — não dispara popstate, então o estado
     route/subsel do App (que decide o que renderiza) nunca era avisado e a
     tela ficava parada em "Central de Decisões" com a URL trocada por
     baixo. setRoute/setSubsel (recebidos do App) são quem de fato manda. */
  const abrirDocumento = async () => {
    if (!linkDocumento || !setRoute || !setSubsel) return;
    setAbrindo(true);
    try {
      if (linkDocumento.numeroCotacao != null) {
        // numero_cotacao (Nº legível) != id (uuid) que formulario-elevador
        // espera em subsel — resolve pro registro real antes de navegar.
        const { data, error } = await window.__VP_SB.sb.from('formularios_elevador')
          .select('id').eq('numero_cotacao', linkDocumento.numeroCotacao).maybeSingle();
        if (error || !data) {
          window.toast?.('Não foi possível localizar o formulário desta cotação.', 'error');
          return;
        }
        setSubsel(data.id);
      } else {
        setSubsel(linkDocumento.id ?? null);
      }
      setRoute(linkDocumento.page);
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="up-eyebrow muted">{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{ctx.cliente || ctx.titulo || ctx.item || ctx.obra || `Cotação Nº ${decisao.numero_cotacao ?? '—'}`}</div>
        <div className="cell-sub mono">
          {decisao.numero_cotacao != null && <>Cotação {decisao.numero_cotacao} · </>}
          {ctx.quantidade != null && <>{ctx.quantidade}{ctx.unidade ? ' ' + ctx.unidade : ''} · </>}
          {ctx.solicitante && <>{ctx.solicitante} · </>}
          {ctx.valor != null ? `R$ ${Number(ctx.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
        </div>
        <div className="small muted" style={{ marginTop: 2 }}>Aberta em {fmtDataHora(decisao.criado_em)}</div>
        {!souAprovador && (
          <div className="small" style={{ marginTop: 6, color: 'var(--fg2)' }}>
            {bloqueada
              ? <>⏳ Bloqueada — depende de outra decisão ser aprovada primeiro.</>
              : <>👁 Só você está vendo (Administrador) — quem decide: <b>{(decisao.aprovadores_esperados || []).join(', ') || '—'}</b></>}
          </div>
        )}
      </div>
      {souAprovador && (
        <div className="row gap-2">
          {linkDocumento && <Button variant="outline" size="sm" onClick={abrirDocumento} disabled={abrindo}>{abrindo ? 'Abrindo…' : 'Ver documento'}</Button>}
          <Button variant="danger" size="sm" onClick={() => setReprovando(true)} disabled={busy}>Reprovar</Button>
          <Button variant="primary" size="sm" onClick={aprovar} disabled={busy}>{busy ? 'Salvando…' : 'Aprovar'}</Button>
        </div>
      )}
      {reprovando && <DecModalReprovar decisao={decisao} onClose={() => setReprovando(false)} onSaved={onReload}/>}
    </div>
  );
}

function DecisoesPage({ setRoute, setSubsel }) {
  const [pendentes, setPendentes] = React.useState(null);
  const [erro, setErro] = React.useState(false);
  const [modoAdmin, setModoAdmin] = React.useState(false);

  /* "Ver tudo" pra Administrador — pedido explícito do usuário (criador do
     site): precisa entender/instruir qualquer decisão do sistema, mesmo
     sem poder de aprovar ("não vou aprovar nada"). Natural (automático
     por nivel), não depende de alçada — DecCard já esconde os botões de
     ação pra quem não é aprovador de verdade (ver souAprovador acima). */
  const reload = React.useCallback(async () => {
    setErro(false);
    try {
      const perfil = window.PropostaStore ? await window.PropostaStore.resolverPerfilAtual() : null;
      const admin = !!(perfil && perfil.nivel === 'Administrador');
      setModoAdmin(admin);
      const lista = admin ? await window.DecisoesStore.listarTodasEmAberto() : await window.DecisoesStore.listarPendentesParaMim();
      setPendentes(lista);
    } catch (e) { setErro(true); setPendentes([]); }
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (pendentes === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Geral · Decisões</div>
          <h1 className="page-head__title">Central de Decisões</h1>
          <p className="page-head__sub">
            {modoAdmin
              ? 'Modo Administrador: você está vendo tudo que está em aberto no sistema, de qualquer pessoa — não é aprovação, é visão completa pra instruir quem decide.'
              : 'Tudo que precisa da sua aprovação, de qualquer módulo — em um só lugar.'}
          </p>
        </div>
      </div>

      <Card title={modoAdmin ? 'Tudo em aberto no sistema' : 'Aguardando você'} sub={`${pendentes.length} decisão(ões) em aberto`}>
        <div className="stack" style={{ gap: 10 }}>
          {pendentes.length === 0 && erro && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Não foi possível carregar suas decisões pendentes agora.
              <div style={{ marginTop: 10 }}><Button variant="outline" size="sm" onClick={reload}>Tentar novamente</Button></div>
            </div>
          )}
          {pendentes.length === 0 && !erro && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              {modoAdmin ? 'Nenhuma decisão em aberto no sistema no momento.' : 'Nenhuma decisão pendente pra você no momento.'}
            </div>
          )}
          {pendentes.map((d) => <DecCard key={d.id} decisao={d} onReload={reload} setRoute={setRoute} setSubsel={setSubsel}/>)}
        </div>
      </Card>
    </div>
  );
}

window.DecisoesPage = DecisoesPage;
