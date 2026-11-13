/* ============================================================
   precificacao.jsx — Calculadora ao vivo + histórico de versões
   propostas.jsx — Wizard + Preview PDF
   ============================================================ */

/* Precificação — só Elevadores (por Cotação Nº, fluxo real herdando o Formulário de Elevadores + resposta do fornecedor).
   13/11/2026 (Gelson: "não utiliza, confirmo a remoção"): a aba "Outros projetos" (calculadora antiga baseada em Leads/Análise
   Técnica, com percentuais próprios fora da planilha) foi removida, junto com PrecificacaoModoTabs/PrecificacaoLeadsPage/PrecificacaoDetail. */
function PrecificacaoPage({ setRoute, setSubsel, subsel }) {
  return <window.PrecificacaoElevadorPage setRoute={setRoute} setSubsel={setSubsel} subsel={subsel}/>;
}

/* ---------- PROPOSTAS ---------- */
/* Mesmo padrão do Controle de Cotações: tabela única, filtro por status +
   busca, clique na linha abre a proposta — sem coluna lateral. */
function PropostasPage({ setRoute, setSubsel }) {
  const [rows, setRows] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fStatus, setFStatus] = React.useState('Todos');
  const [prontas, setProntas] = React.useState([]);
  const [escopo, setEscopo] = React.useState(null);
  const [podeExcluir, setPodeExcluir] = React.useState(false);
  const [excluindoId, setExcluindoId] = React.useState(null);
  const ord = window.useOrdenacao(); // 23/10 (pedido do usuário) — ordenação por coluna

  // Escopo de visibilidade (Configurações do Sistema › Permissões) — resolve
  // antes de carregar, pra montar a query já filtrada por vendedor_id em vez
  // de buscar tudo e esconder na tela (dado sensível não deve nem sair do banco).
  React.useEffect(() => { window.PropostaStore.resolverEscopoVisibilidade().then(setEscopo); }, []);
  React.useEffect(() => { window.PropostaStore.temCapacidade('propostas', 'excluir').then(setPodeExcluir); }, []);

  /* Não traz data_json aqui — é só pra abrir UMA proposta específica no
     editor, não pra listar. Nas 307 migradas do site antigo (18/08) esse
     campo tem até ~34KB cada; buscar pra todas as linhas só pra montar a
     tabela deixava a lista lenta à toa (achado ao vivo, mesmo dia da
     migração). */
  const carregar = React.useCallback(() => {
    if (!escopo) return;
    let q = window.__VP_SB.sb.from('propostas')
      .select('id, numero_documento, titulo, status, valor_total, master_id, numero_cotacao, proposal_type, criado_em, revisao_texto, vigencia, substituida_por_id, clientes(razao_social, cnpj), perfis(nome, email)');
    if (!escopo.veTudo && escopo.vendedorId) q = q.eq('vendedor_id', escopo.vendedorId);
    q.order('criado_em', { ascending: false }).limit(300)
      .then(({ data }) => setRows(data || []));
  }, [escopo]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // Realtime (28/09): status muda sozinho na lista quando o cliente
  // visualiza/assina/recusa pela página pública /assinar/<token>.
  React.useEffect(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    const canal = sb.channel('propostas-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas' }, () => carregar())
      .subscribe();
    return () => sb.removeChannel(canal);
  }, [carregar]);

  /* "Prontas para enviar" — Precificação terminou o cálculo, mas quem
     decide analisar e enviar é o Comercial, não o Financeiro. Lista toda
     precificação calculada OU já aprovada (status 'finalizado' — "aprovada"
     não é menos pronta que "calculada", é mais; antes o filtro só pegava
     'calculado' e o item sumia daqui bem no momento em que devia estar mais
     pronto pra virar proposta — achado da revisão de arquitetura de 18/08)
     cujo Nº da Cotação ainda não tem proposta. */
  const carregarProntas = React.useCallback(async () => {
    const { data: pz } = await window.__VP_SB.sb.from('precificacoes_elevador')
      .select('id, numero_documento, numero_cotacao').in('status', ['calculado', 'finalizado'])
      .order('numero_cotacao', { ascending: false });
    const { data: props } = await window.__VP_SB.sb.from('propostas')
      .select('numero_cotacao, numero_documento').not('numero_cotacao', 'is', null).eq('proposal_type', 'elevador');
    /* 23/10 — "já tem proposta" é por REVISÃO (letra do numero_documento,
       ver master-id-engine.js parseRevisao), não só pelo Nº da cotação —
       senão uma Precificação de revisão nova (VPPC-0990-B) nunca aparecia
       aqui, escondida atrás da Proposta da revisão anterior (VPPR-0990). */
    const chaveRevisao = (numCot, numDoc) => `${numCot}|${window.MasterIdEngine.parseRevisao(numDoc) || ''}`;
    const revisoesComProposta = new Set((props || []).map((p) => chaveRevisao(p.numero_cotacao, p.numero_documento)));
    setProntas((pz || []).filter((p) => p.numero_cotacao != null && !revisoesComProposta.has(chaveRevisao(p.numero_cotacao, p.numero_documento))));
  }, []);
  React.useEffect(() => { carregarProntas(); }, [carregarProntas]);

  /* Mesma engenharia da herança que o vendedor dispara pelo Nº da Cotação
     no editor — fonte única, pra não existirem duas regras divergentes de
     "de onde vêm os dados da proposta" (antes vivia em Precificação). */
  const abrirDaPrecificacao = async (pz) => {
    try {
      /* precificacaoId: pz.id — pina NESTA precificação (achado real do
         Codex, 23/10): a tela "Prontas para enviar" pode listar uma
         revisão B ainda só 'calculado' enquanto a original já está
         'finalizado'; sem o pin, prefillPorNumeroCotacao() prefere a
         'finalizado' e devolveria os preços da revisão ERRADA, mesmo com
         o Nº da Proposta rotulado "-B" (ver `letra` abaixo). */
      const r = await window.PropostaHeranca.prefillPorNumeroCotacao(pz.numero_cotacao, { precificacaoId: pz.id });
      if (!r.encontrado) {
        window.toast?.('Não foi possível localizar o formulário desta cotação.', 'error');
        return;
      }
      /* Nº da Proposta pré-preenchido com o Master ID universal de ETAPA
         (VPPR-0950 — mesmo número da cotação, prefixo da Proposta), não um
         rótulo inventado. Vendedor pode editar, mas o padrão precisa ser o
         código que todo mundo na empresa reconhece. Herda a letra de
         revisão da própria Precificação (VPPC-0950-B → VPPR-0950-B, 23/10)
         — sem isso, abrir manualmente a Precificação de uma revisão nova
         geraria um Nº de Proposta que colide com a da revisão anterior. */
      const letra = pz.numero_documento != null ? window.MasterIdEngine.parseRevisao(pz.numero_documento) : null;
      const numero = pz.numero_cotacao != null ? window.MasterIdEngine.etapaId('proposta', pz.numero_cotacao, letra) : (pz.numero_documento || '');
      const prefill = { ...r.prefill, numero };
      setSubsel(prefill);
      setRoute('proposta-editor');
    } catch (e) {
      window.toast?.('Erro ao preparar a proposta: ' + e.message, 'error');
    }
  };

  const statusDisponiveis = React.useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.status).filter(Boolean))];
  }, [rows]);

  const EQUIPAMENTO_LABEL = { elevador: 'Elevador', escada: 'Escada Rolante', esteira: 'Esteira Rolante' };

  /* 23/10 — mesmo aviso que a fila da Precificação já mostra ("substituída
     por VPEL-EL0990-B") pra quando o fornecedor manda uma revisão nova.
     Fonte PRIMÁRIA: vigencia/substituida_por_id (colunas reais do sistema
     "Revisões Comerciais", migration 20261022100000/PR #1054, mantidas por
     proposta_aplicar_vigencia() — ao contrário de "mais nova por
     criado_em", essas colunas sabem que uma proposta APROVADA continua
     vigente mesmo com um rascunho mais novo por cima, achado real do
     Codex nesta mesma revisão). Só cai pro heurístico (mais nova por
     criado_em) quando vigencia ainda não foi calculada pro par (ex.:
     sibling recém-criado por este fluxo, 'em_negociacao', cujo trigger só
     roda ao mudar de status — substituida_por_id ainda null). */
  const substituidasPor = React.useMemo(() => {
    const porId = {}; (rows || []).forEach((p) => { porId[p.id] = p; });
    const map = {};
    (rows || []).forEach((p) => {
      if (p.numero_cotacao == null || p.vigencia === 'vigente') return; // vigência já diz que esta é a atual
      if (p.substituida_por_id) {
        // Vigência já calculada pelo motor real — confia nela, mesmo sem
        // achar a linha-alvo na página (não arrisca o heurístico por cima).
        const alvo = porId[p.substituida_por_id];
        if (alvo) map[p.id] = alvo.numero_documento;
        return;
      }
      // vigencia != 'vigente' mas o motor ainda não apontou quem a sucede
      // (ex.: sibling recém-criado 'em_negociacao' — o trigger só roda ao
      // mudar de status) — heurístico só pra não deixar a tela muda.
      const irmas = (rows || []).filter((o) => o.id !== p.id && o.numero_cotacao === p.numero_cotacao && o.proposal_type === p.proposal_type);
      const maisNovas = irmas.filter((o) => String(o.criado_em) > String(p.criado_em));
      maisNovas.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
      if (maisNovas[0]) map[p.id] = maisNovas[0].numero_documento;
    });
    return map;
  }, [rows]);

  const filtradas = React.useMemo(() => {
    if (!rows) return [];
    const termo = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== 'Todos' && r.status !== fStatus) return false;
      if (!termo) return true;
      // Código, cliente, CNPJ, equipamento, Nº da cotação e vendedor — o
      // vendedor é o mais pedido: puxa TODAS as propostas daquele vendedor
      // (nome ou email) numa busca só, sem precisar de filtro separado.
      return [
        r.numero_documento, r.titulo, r.master_id,
        r.clientes?.razao_social, r.clientes?.cnpj,
        EQUIPAMENTO_LABEL[r.proposal_type] || r.proposal_type,
        r.numero_cotacao != null ? String(r.numero_cotacao) : null,
        r.perfis?.nome, r.perfis?.email,
      ].some((v) => (v || '').toString().toLowerCase().includes(termo));
    });
  }, [rows, busca, fStatus]);

  // Só soma propostas com numero_documento — um rascunho sem número ainda
  // não é um compromisso comercial identificável, e dados de demonstração
  // legados (sem numero_documento, valores de centenas de milhões) já
  // infl(aram o "potencial" pra R$ 6741.1M no reteste E2E. Limpamos as 203
  // linhas de demo do banco; este filtro é a rede de segurança pra não
  // repetir se sobrar/entrar lixo parecido de novo.
  const propostasIdentificadas = (rows || []).filter((p) => p.numero_documento);
  const totalValor = propostasIdentificadas.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const fmtValorTotal = propostasIdentificadas.length > 0
    ? (totalValor >= 1e6 ? `R$ ${(totalValor / 1e6).toFixed(1)}M` : fmtBRL(totalValor))
    : '—';
  const comMasterId = (rows || []).filter((p) => p.master_id).length;

  const linhasOrdenadas = ord.aplicar(filtradas, {
    numeroDocumento: (p) => p.numero_documento,
    cliente: (p) => p.clientes?.razao_social || p.titulo,
    vendedor: (p) => p.perfis?.nome,
    masterId: (p) => p.master_id,
    valor: (p) => (p.valor_total != null ? Number(p.valor_total) : null),
    status: (p) => p.status,
    data: (p) => (p.criado_em ? new Date(p.criado_em).getTime() : null),
  });

  const abrirNova = () => { setSubsel && setSubsel(null); setRoute("proposta-editor"); };
  const abrirExistente = (p) => { setSubsel && setSubsel({ __editId: p.id }); setRoute("proposta-editor"); };

  const excluirProposta = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir a proposta ${p.numero_documento || p.titulo}? Isso apaga de vez, sem volta.`)) return;
    setExcluindoId(p.id);
    try {
      await window.PropostaStore.excluir(p.id);
      window.toast?.('Proposta excluída.', 'success');
      setRows((prev) => (prev || []).filter((r) => r.id !== p.id));
    } catch (err) {
      window.toast?.('Erro ao excluir: ' + (err.message || err), 'error');
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Propostas</div>
          <h1 className="page-head__title">Propostas Comerciais</h1>
          <p className="page-head__sub">Clique numa proposta pra abrir — herda dados do Formulário + valores da Precificação (Master ID).</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload((rows || []).map(p => ({ id:p.id, numero_documento:p.numero_documento, titulo:p.titulo, status:p.status, master_id:p.master_id, valor_total:p.valor_total, criado_em:p.criado_em })), 'propostas.csv')}>Exportar pacote</Button>
          <Button variant="primary" icon="plus" onClick={abrirNova}>Nova proposta</Button>
        </div>
      </div>

      {prontas.length > 0 && (
        <Card title="Prontas para enviar" sub={`${prontas.length} precificação(ões) aguardando análise e envio`} style={{ marginBottom: 20 }}>
          <div className="stack" style={{ gap: 8 }}>
            {prontas.map((pz) => (
              <div key={pz.id} className="row sb" style={{ padding: '10px 14px', background: 'var(--vp-warning-tint)' }}>
                <div>
                  <b>{window.MasterIdEngine.etapaId('cotacao', pz.numero_cotacao)}</b> precificado — analise e envie a proposta
                  <div className="muted small">{pz.numero_documento}</div>
                </div>
                <Button variant="primary" size="sm" icon="proposal" onClick={() => abrirDaPrecificacao(pz)}>Analisar e enviar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows && rows.some((p) => p.status === 'revisao_solicitada') && (
        <Card title="Pedidos de revisão" sub="cliente leu e pediu ajuste — analise, edite e reenvie" style={{ marginBottom: 20 }}>
          <div className="stack" style={{ gap: 8 }}>
            {rows.filter((p) => p.status === 'revisao_solicitada').map((p) => (
              <div key={p.id} className="row sb" style={{ padding: '10px 14px', background: 'var(--vp-warning-tint)' }}>
                <div>
                  <b>{p.numero_documento || p.titulo}</b>
                  <div className="muted small">"{p.revisao_texto}"</div>
                </div>
                <Button variant="primary" size="sm" icon="edit" onClick={() => abrirExistente(p)}>Analisar e reenviar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Propostas" value={rows ? rows.length : '…'} sub="total cadastrado" icon="proposal"/>
        <KPI label="Valor proposto" value={fmtValorTotal} sub="potencial" icon="dollar"/>
        <KPI label="Com Master ID" value={comMasterId} sub="rastreáveis à Precificação" icon="grid"/>
        <KPI label="Aprovadas" value={(rows || []).filter((p) => p.status === 'aprovada').length} sub="fecharam negócio" icon="check"/>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 420 }} placeholder="Buscar por código, cliente, CNPJ, equipamento, cotação ou vendedor…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <span className="small" style={{ color: 'var(--fg3)' }}>{rows ? filtradas.length : '…'} proposta(s)</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['Todos'].concat(statusDisponiveis).map((s) => (
          <Button key={s} size="sm" variant={fStatus === s ? 'primary' : 'ghost'} onClick={() => setFStatus(s)}>
            {String(s).replace(/_/g, ' ')} <span style={{ opacity: .7 }}>({s === 'Todos' ? (rows ? rows.length : 0) : (rows || []).filter((r) => r.status === s).length})</span>
          </Button>
        ))}
      </div>

      <Card title="Propostas" sub="Clique numa proposta para abrir no editor">
      <div className="table-wrap table-wrap--sticky" style={{ border: 0 }}>
        <table className="t pcp-grid">
          <thead><tr>
            {ord.th('numeroDocumento', 'Nº Documento')}
            {ord.th('cliente', 'Cliente')}
            {ord.th('vendedor', 'Vendedor')}
            {ord.th('masterId', 'Master ID')}
            {ord.th('valor', 'Valor', { className: 'text-right' })}
            {ord.th('status', 'Status')}
            {ord.th('data', 'Data')}
            {podeExcluir && <th></th>}
          </tr></thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={99}><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)' }}>Carregando…</div></td></tr>
            )}
            {rows !== null && filtradas.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhuma proposta encontrada</h4><p>Nada encontrado com os filtros atuais.</p></div></td></tr>
            )}
            {linhasOrdenadas.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => abrirExistente(p)}>
                <td>
                  <span className="mono small">{p.numero_documento || '—'}</span>
                  {substituidasPor[p.id] ? <span className="small" style={{ color: 'var(--vp-danger)', fontWeight: 700 }} title={`O cliente já tem uma proposta mais nova (${substituidasPor[p.id]}), de uma revisão do fornecedor. Envie essa, não esta.`}> · substituída por {substituidasPor[p.id]}</span> : null}
                </td>
                <td style={{ fontSize: 12.5 }}>{p.clientes?.razao_social || p.titulo || <span className="muted">—</span>}</td>
                <td style={{ fontSize: 12.5 }}>{p.perfis?.nome || <span className="muted">—</span>}</td>
                <td><span className="mono small">{p.master_id || <span className="muted">—</span>}</span></td>
                <td className="cell-money">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}><StatusBadge status={p.status || 'rascunho'}/></td>
                <td><span className="mono small" style={{ whiteSpace: 'nowrap' }}>{p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}</span></td>
                {podeExcluir && (
                  <td>
                    <Button variant="ghost" size="sm" icon="trash" disabled={excluindoId === p.id}
                      title="Excluir proposta" onClick={(e) => excluirProposta(p, e)}/>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
    </div>
  );
}

Object.assign(window, { PrecificacaoPage, PropostasPage });
