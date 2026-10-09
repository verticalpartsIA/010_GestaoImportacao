/* ============================================================
   decisoes.jsx — Central de Decisões
   Caixa de entrada pessoal: cada usuário logado vê só as decisões
   gerenciais que esperam por ele (CEO, Owner, Gestor Comercial,
   Engenharia, Logística — ver decisoes-store.js). Abas: Pendentes e
   Decididas (histórico: aprovadas, reprovadas e canceladas).
   ============================================================ */

function fmtDataHora(d) { return d ? new Date(d).toLocaleString('pt-BR') : '—'; }
function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function avisarDecisoesMudaram() { try { window.dispatchEvent(new CustomEvent('vp:decisoes')); } catch (_) { /* sem DOM de eventos */ } }

/* Gera navegação pra abrir o documento que precisa ser aprovado.
   Retorna {page, id} | {page, numeroCotacao} | {page, propostaId} | {page, propostaPorCotacao, numeroCotacao} | {page, aba} | null.
   `numeroCotacao` (em vez de `id`) sinaliza pro clique em "Ver documento"
   que precisa resolver pro id real do registro antes de navegar — ver
   abrirDocumento() em DecCard: numero_cotacao é o Nº legível da cotação,
   não o id (uuid) de formularios_elevador que a página de destino espera. */
function gerarLinkDecisao(decisao) {
  // Desconto: o que se decide está na PROPOSTA (não no formulário da cotação)
  if (decisao.referencia_tabela === 'propostas' && decisao.referencia_id) {
    return { page: 'proposta-editor', propostaId: decisao.referencia_id };
  }

  // Envio de proposta: abre a proposta daquela cotação; sem proposta ainda, cai no formulário
  if (decisao.numero_cotacao != null && String(decisao.tipo || '').startsWith('envio_proposta')) {
    return { page: 'proposta-editor', propostaPorCotacao: true, numeroCotacao: decisao.numero_cotacao };
  }

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
      'contratos_instalador': 'contrato-instalador',
      'pedidos_compra_varejo': 'almoxarifado',
      'emails_projeto': 'inbox',
    };
    const page = tabelaPagina[decisao.referencia_tabela];
    if (!page) return null;
    // Almoxarifado guarda os pedidos de varejo na aba "Pedidos"; as telas de pagamento/contrato do instalador abrem na lista.
    if (page === 'almoxarifado') return { page, aba: 'pedidos' };
    if (page === 'pagamentos-instalador' || page === 'contrato-instalador') return { page };
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

/* Aprovar com resumo do que está sendo aprovado + comentário opcional (o store já aceitava o motivo; a tela nunca o pedia). */
function DecModalAprovar({ decisao, resumo, onClose, onSaved }) {
  const [motivo, setMotivo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    setSaving(true);
    try {
      await window.DecisoesStore.aprovar(decisao.id, motivo.trim() || undefined);
      window.toast?.('Decisão aprovada.', 'success');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Aprovar decisão" onClose={onClose} width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar aprovação'}</Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</p>
        <div style={{ fontWeight: 700 }}>{resumo}</div>
        <label className="up-eyebrow muted">Comentário (opcional)</label>
        <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: aprovado com a condição de…"/>
      </div>
    </Modal>
  );
}

/* Cancelar (só Administrador): decisão que perdeu o sentido. Fica no histórico. */
function DecModalCancelar({ decisao, onClose, onSaved }) {
  const [motivo, setMotivo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    if (!motivo.trim()) return window.toast?.('Informe o motivo do cancelamento.', 'warning');
    setSaving(true);
    try {
      await window.DecisoesStore.cancelar(decisao.id, motivo);
      window.toast?.('Decisão cancelada.', 'warning');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Cancelar decisão" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Voltar</Button>
        <Button variant="danger" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Cancelar decisão'}</Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo} — não é aprovação nem reprovação: a decisão deixa de valer e sai da fila de quem decide.</p>
        <label className="up-eyebrow muted">Motivo</label>
        <textarea className="input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cotação descartada, proposta substituída…"/>
      </div>
    </Modal>
  );
}

const DEC_STATUS_LABEL = { pendente: 'Pendente', bloqueada_por_dependencia: 'Bloqueada', aprovada: 'Aprovada', reprovada: 'Reprovada', cancelada: 'Cancelada' };
const DEC_STATUS_COR = { aprovada: 'var(--vp-success, #1a7f37)', reprovada: 'var(--vp-danger, #c62828)', cancelada: 'var(--fg3)' };

function DecCard({ decisao, onReload, setRoute, setSubsel, modoAdmin, historico, modalAberto, onAbrirModal, onFecharModal }) {
  // Qual modal (aprovar/reprovar/cancelar) está aberto vem da URL
  // (/geral/decisoes/<id>/<tipo>) — ver DecisoesPage. Antes era só useState
  // local, então abrir um modal nunca aparecia no endereço do navegador.
  const aprovando = modalAberto === 'aprovar';
  const reprovando = modalAberto === 'reprovar';
  const cancelando = modalAberto === 'cancelar';
  const [abrindo, setAbrindo] = React.useState(false);
  const [reabrindo, setReabrindo] = React.useState(false);
  const ctx = decisao.contexto || {};
  /* Visão de Administrador mostra decisões de qualquer pessoa (ver
     listarTodasEmAberto em decisoes-store.js) — mas aprovar()/reprovar()
     continuam travados no servidor por souAprovador(). Em vez de deixar o
     Admin clicar e tomar um erro, já esconde os botões e explica quem
     decide de verdade — visualização, não aprovação (pedido explícito do
     usuário: "não vou aprovar nada"). */
  const souAprovador = window.DecisoesStore.souAprovador(decisao);
  const bloqueada = decisao.status === 'bloqueada_por_dependencia';
  const emAberto = decisao.status === 'pendente' || bloqueada;

  const titulo = ctx.cliente || ctx.titulo || ctx.item || ctx.obra || `Cotação Nº ${decisao.numero_cotacao ?? '—'}`;
  const resumo = [titulo, ctx.parceiro ? `Montador: ${ctx.parceiro}` : null, ctx.valor != null ? fmtBRL(ctx.valor) : null].filter(Boolean).join(' · ');

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
      let page = linkDocumento.page;
      if (linkDocumento.propostaId) {
        setSubsel({ __editId: linkDocumento.propostaId });
      } else if (linkDocumento.propostaPorCotacao) {
        // Envio de proposta: abre a proposta da cotação; se ainda não existe, cai no formulário.
        const { data: prop } = await window.__VP_SB.sb.from('propostas').select('id')
          .eq('numero_cotacao', linkDocumento.numeroCotacao).order('updated_at', { ascending: false }).limit(1);
        if (prop && prop[0]) {
          setSubsel({ __editId: prop[0].id });
        } else {
          const { data, error } = await window.__VP_SB.sb.from('formularios_elevador')
            .select('id').eq('numero_cotacao', linkDocumento.numeroCotacao).maybeSingle();
          if (error || !data) { window.toast?.('Não foi possível localizar a proposta nem o formulário desta cotação.', 'error'); return; }
          page = 'formulario-elevador';
          setSubsel(data.id);
        }
      } else if (linkDocumento.numeroCotacao != null) {
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
      setRoute(page);
      // Almoxarifado guarda o pedido de varejo na aba "Pedidos": a aba vem da URL (useRouteTab).
      if (linkDocumento.aba && window.VpRouter) {
        setTimeout(() => {
          window.VpRouter.navigate(page, linkDocumento.aba);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 0);
      }
    } finally {
      setAbrindo(false);
    }
  };

  const reabrir = async () => {
    setReabrindo(true);
    try {
      await window.DecisoesStore.reabrir(decisao.id);
      window.toast?.('Decisão solicitada novamente.', 'success');
      onReload();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setReabrindo(false); }
  };

  const linhas = [];
  if (decisao.numero_cotacao != null) linhas.push(`Cotação ${decisao.numero_cotacao}`);
  if (ctx.proposta) linhas.push(`Proposta ${ctx.proposta}`);
  if (ctx.parceiro) linhas.push(`Montador: ${ctx.parceiro}`);
  if (ctx.quantidade != null) linhas.push(`${ctx.quantidade}${ctx.unidade ? ' ' + ctx.unidade : ''}`);
  if (ctx.valor != null) linhas.push(fmtBRL(ctx.valor));
  if (ctx.margem_efetiva_pct != null) linhas.push(`Margem efetiva ${(Number(ctx.margem_efetiva_pct) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  if (ctx.desconto_valor != null) linhas.push(`Desconto ${ctx.desconto_tipo === 'percentual' ? ctx.desconto_valor + '%' : fmtBRL(ctx.desconto_valor)}${ctx.pct_equivalente != null ? ` (${(ctx.pct_equivalente * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do valor)` : ''}`);
  const solicitante = ctx.solicitante || decisao.solicitado_por;
  if (solicitante) linhas.push(`Pedido por ${solicitante}`);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div className="up-eyebrow muted">{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
        <div className="cell-sub mono">{linhas.join(' · ')}</div>
        <div className="small muted" style={{ marginTop: 2 }}>Aberta em {fmtDataHora(decisao.criado_em)}</div>
        {historico && (
          <div className="small" style={{ marginTop: 6, color: DEC_STATUS_COR[decisao.status] || 'var(--fg2)' }}>
            <b>{DEC_STATUS_LABEL[decisao.status] || decisao.status}</b>{decisao.decidido_por ? ` por ${decisao.decidido_por}` : ''} em {fmtDataHora(decisao.decidido_em)}
            {decisao.motivo ? <> — “{decisao.motivo}”</> : null}
          </div>
        )}
        {historico && (ctx.reaberturas || []).length > 0 && (
          <div className="small muted" style={{ marginTop: 2 }}>Solicitada de novo {(ctx.reaberturas || []).length}x</div>
        )}
        {emAberto && !souAprovador && (
          <div className="small" style={{ marginTop: 6, color: 'var(--fg2)' }}>
            {bloqueada
              ? <>⏳ Bloqueada — depende de outra decisão ser aprovada primeiro.</>
              : <>👁 Só você está vendo (Administrador) — quem decide: <b>{(decisao.aprovadores_esperados || []).join(', ') || '—'}</b></>}
          </div>
        )}
      </div>
      <div className="row gap-2">
        {linkDocumento && <Button variant="outline" size="sm" onClick={abrirDocumento} disabled={abrindo}>{abrindo ? 'Abrindo…' : 'Ver documento'}</Button>}
        {emAberto && souAprovador && !bloqueada && (
          <>
            <Button variant="danger" size="sm" onClick={() => onAbrirModal('reprovar')}>Reprovar</Button>
            <Button variant="primary" size="sm" onClick={() => onAbrirModal('aprovar')}>Aprovar</Button>
          </>
        )}
        {emAberto && modoAdmin && <Button variant="ghost" size="sm" onClick={() => onAbrirModal('cancelar')}>Cancelar</Button>}
        {historico && (decisao.status === 'reprovada' || decisao.status === 'cancelada') && (
          <Button variant="outline" size="sm" onClick={reabrir} disabled={reabrindo}>{reabrindo ? 'Solicitando…' : 'Solicitar novamente'}</Button>
        )}
      </div>
      {aprovando && <DecModalAprovar decisao={decisao} resumo={resumo} onClose={onFecharModal} onSaved={onReload}/>}
      {reprovando && <DecModalReprovar decisao={decisao} onClose={onFecharModal} onSaved={onReload}/>}
      {cancelando && <DecModalCancelar decisao={decisao} onClose={onFecharModal} onSaved={onReload}/>}
    </div>
  );
}

function DecisoesPage({ setRoute, setSubsel }) {
  const [aba, setAba] = React.useState('pendentes');
  const [pendentes, setPendentes] = React.useState(null);
  const [decididas, setDecididas] = React.useState(null);
  const [erro, setErro] = React.useState(false);
  const [modoAdmin, setModoAdmin] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  // Modal aberto (aprovar/reprovar/cancelar) de uma decisão específica,
  // refletido na URL (/geral/decisoes/<id da decisão>/<tipo>) — antes
  // ficava só em useState dentro de cada DecCard, sem aparecer no endereço.
  const [rotaId] = window.useRotaId('decisoes');
  const [tipoModal] = window.useRotaItem('decisoes', rotaId);
  const abrirModalDecisao = (decisaoId, tipo) => { if (window.VpRouter) window.VpRouter.navigate('decisoes', decisaoId, tipo); };
  const fecharModalDecisao = () => { if (window.VpRouter) window.VpRouter.navigate('decisoes', null); };

  /* "Ver tudo" pra Administrador — pedido explícito do usuário (criador do
     site): precisa entender/instruir qualquer decisão do sistema, mesmo
     sem poder de aprovar ("não vou aprovar nada"). Natural (automático
     por nivel), não depende de alçada — DecCard já esconde os botões de
     ação pra quem não é aprovador de verdade (ver souAprovador acima). */
  const reload = React.useCallback(async () => {
    setErro(false);
    try {
      const admin = await window.DecisoesStore.ehAdministrador();
      setModoAdmin(admin);
      const lista = admin ? await window.DecisoesStore.listarTodasEmAberto() : await window.DecisoesStore.listarPendentesParaMim();
      setPendentes(lista);
      setDecididas(await window.DecisoesStore.listarDecididas({ todas: admin }));
      avisarDecisoesMudaram();
    } catch (e) { setErro(true); setPendentes((p) => p || []); setDecididas((d) => d || []); }
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  /* Atualiza sozinha: a cada 60 s e ao voltar para a aba do navegador (decisão nova de outra pessoa aparece sem F5). */
  React.useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) reload(); }, 60000);
    const vis = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [reload]);

  if (pendentes === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const historico = aba === 'decididas';
  const base = (historico ? decididas : pendentes) || [];
  const tiposPresentes = [...new Set([...(pendentes || []), ...(decididas || [])].map((d) => d.tipo))];
  const q = busca.trim().toLowerCase();
  const lista = base.filter((d) => {
    if (tipo && d.tipo !== tipo) return false;
    if (!q) return true;
    const c = d.contexto || {};
    return [d.numero_cotacao, c.cliente, c.titulo, c.item, c.obra, c.parceiro, c.proposta, c.solicitante, d.solicitado_por, d.decidido_por, d.motivo]
      .some((v) => v != null && String(v).toLowerCase().includes(q));
  });

  const tabBtn = (id, label, n) => (
    <Button key={id} variant={aba === id ? 'primary' : 'outline'} size="sm" onClick={() => setAba(id)}>{label} ({n})</Button>
  );

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

      <Card title={historico ? 'Decididas' : (modoAdmin ? 'Tudo em aberto no sistema' : 'Aguardando você')}
        sub={`${lista.length} decisão(ões)${lista.length !== base.length ? ` de ${base.length}` : ''}`}>
        <div className="row gap-2" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {tabBtn('pendentes', 'Pendentes', (pendentes || []).length)}
          {tabBtn('decididas', 'Decididas', (decididas || []).length)}
          <input className="input" style={{ maxWidth: 260, marginLeft: 'auto' }} placeholder="Buscar cotação, cliente, pessoa…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
          <select className="input" style={{ maxWidth: 280 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tiposPresentes.map((t) => <option key={t} value={t}>{window.DecisoesStore.TIPO_LABEL[t] || t}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {lista.length === 0 && erro && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Não foi possível carregar suas decisões agora.
              <div style={{ marginTop: 10 }}><Button variant="outline" size="sm" onClick={reload}>Tentar novamente</Button></div>
            </div>
          )}
          {lista.length === 0 && !erro && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              {base.length > 0 ? 'Nada encontrado com esses filtros.'
                : historico ? 'Nenhuma decisão decidida ainda.'
                : modoAdmin ? 'Nenhuma decisão em aberto no sistema no momento.' : 'Nenhuma decisão pendente pra você no momento.'}
            </div>
          )}
          {lista.map((d) => (
            <DecCard key={d.id} decisao={d} onReload={reload} setRoute={setRoute} setSubsel={setSubsel} modoAdmin={modoAdmin} historico={historico}
              modalAberto={rotaId === String(d.id) ? tipoModal : null}
              onAbrirModal={(tipo) => abrirModalDecisao(d.id, tipo)}
              onFecharModal={fecharModalDecisao}/>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.DecisoesPage = DecisoesPage;
