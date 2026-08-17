/* ============================================================
   financeiro.jsx — Gatilhos & Prazo, Comissões,
                    Notificações, Configurações
   ============================================================ */

function ModalNovoGatilho({ onClose, onSaved }) {
  const [f, setF] = React.useState({ projeto:'', building:'', trigger:'Pagamento entrada', value:'', due_date:'', status:'pendente', reverse_from:'' });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.building.trim()) return window.toast('Prédio é obrigatório.', 'warning');
    if (!f.due_date) return window.toast('Data de vencimento é obrigatória.', 'warning');
    setSaving(true);
    const id = 'GT-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('gatilhos').insert({
      id,
      project_id: f.projeto || null, building: f.building,
      trigger_name: f.trigger || 'Pagamento',
      value: f.value ? parseFloat(f.value) : null,
      due_date: f.due_date, status: f.status,
      reverse_from: f.reverse_from || null, chain: [],
      days_left: Math.round((new Date(f.due_date) - new Date()) / 86400000),
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Gatilho criado!', 'success');
    onSaved?.(); onClose();
  };

  const fld = (label, key, type='text', ph='', opts=null) => (
    <div className="stack" style={{ gap:4 }}>
      <label className="up-eyebrow muted">{label}</label>
      {opts
        ? <select className="input" value={f[key]} onChange={e => set(key, e.target.value)}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input className="input" type={type} value={f[key]} onChange={e => set(key, e.target.value)} placeholder={ph}/>
      }
    </div>
  );

  return (
    <Modal title="Novo Gatilho Financeiro" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Criar Gatilho'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Prédio / Projeto *', 'building', 'text', 'Ed. Itacolomi, Shopping Vila Olímpia…')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Código do projeto', 'projeto', 'text', 'Ex.: CT-2026-118')}
          {fld('Tipo de gatilho', 'trigger', 'text', '', ['Pagamento entrada','Pagamento embarque','Pagamento entrega','Sinal','Medição','Outro'])}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Valor (R$)', 'value', 'number', '0')}
          {fld('Vencimento *', 'due_date', 'date')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Status', 'status', 'text', '', ['pendente','atencao','ok'])}
          {fld('Base do prazo reverso', 'reverse_from', 'text', 'Ex.: Data de instalação')}
        </div>
      </div>
    </Modal>
  );
}

function FinanceiroPage({ setRoute, setSubsel }) {
  const [gatilhos, setGatilhos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showGatilho, setShowGatilho] = React.useState(false);
  const [confirmarSinalDe, setConfirmarSinalDe] = React.useState(null);
  const [confirmarAvalDe, setConfirmarAvalDe] = React.useState(null);
  const [alertas, setAlertas] = React.useState([]);

  const fecharLembrete = async (id) => {
    if (window.GatilhosEngine) await window.GatilhosEngine.fecharLembrete(id);
    reloadGatilhos();
  };

  /* Clique na linha do Gatilho leva pro objeto real (Financeiro vê
     "Fornecedor respondeu" → cai na Precificação; Vendedor vê
     "Precificado" → cai na Proposta). Nós sem rota ou sem resolver
     definido (ver gatilhos-engine.js) não são clicáveis. */
  const abrirGatilho = async (g) => {
    if (!window.GatilhosEngine) return;
    const alvo = await window.GatilhosEngine.navegarPara(g);
    if (!alvo) return;
    if (alvo.subsel !== null) setSubsel?.(alvo.subsel);
    setRoute?.(alvo.rota);
  };

  const reloadGatilhos = async () => {
    setLoading(true);
    const { data } = await window.__VP_SB.sb.from('gatilhos').select('*').order('numero_cotacao').order('nascido_em');
    let rows = data || [];
    /* Sem cron neste projeto — verifica lembretes/revisão de prazo toda vez
       que a tela é aberta (ver instrucaocompra.md). */
    if (window.GatilhosEngine) {
      const mudou = await window.GatilhosEngine.verificarPrazos(rows);
      if (mudou) {
        const { data: data2 } = await window.__VP_SB.sb.from('gatilhos').select('*').order('numero_cotacao').order('nascido_em');
        rows = data2 || rows;
      }
    }
    setGatilhos(rows);
    setLoading(false);
  };
  const reloadAlertas = () => {
    window.__VP_SB.sb.from('alertas').select('*').eq('resolved', false).order('created_at', { ascending: false })
      .then(({ data }) => setAlertas((data || []).map(a => ({ ...a, time: window.__VP_SB.timeAgo(a.created_at) }))));
  };
  React.useEffect(() => { reloadGatilhos(); reloadAlertas(); }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  /* Cadeia automática (nasce/fecha sozinha via GatilhosEngine, correlacionada
     por Nº da Cotação) separada dos gatilhos financeiros avulsos, cadastrados
     manualmente (ex.: marcos de pagamento sem Nº da Cotação associado). */
  const automaticos = gatilhos.filter(g => g.origem === 'automatico');
  const manuais = gatilhos.filter(g => g.origem !== 'automatico');
  const cadeiasPorCotacao = automaticos.reduce((acc, g) => {
    (acc[g.numero_cotacao] = acc[g.numero_cotacao] || []).push(g);
    return acc;
  }, {});

  const urgentes = manuais.filter(g => (g.days_left ?? g.daysLeft ?? 99) <= 2);
  const routeByModule = (m) =>
    m === "Importação"  ? "importacao"  :
    m === "Jurídico"    ? "juridico"    :
    m === "Financeiro"  ? "financeiro"  :
    m === "Engenharia"  ? "engenharia"  : "cotacoes-fornecedor";

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Gatilhos</div>
          <h1 className="page-head__title">Gatilhos & Prazo</h1>
          <p className="page-head__sub">Cada gatilho nasce automaticamente ao concluir a etapa anterior, correlacionado pelo Nº da Cotação.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(manuais.map(g => ({ projeto:g.projeto||g.project_id, building:g.building, trigger:g.trigger||g.trigger_name, valor:g.value, vencimento:g.due_date, dias_restantes:g.days_left, status:g.status })), 'gatilhos-fluxo.csv')}>Exportar fluxo</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowGatilho(true)}>Novo gatilho</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Cotações em andamento" value={Object.keys(cadeiasPorCotacao).length} sub="cadeias ativas" delta="—" deltaDir="up" icon="zap"/>
        <KPI label="Ação do Financeiro pendente" value={automaticos.filter(g => ['AGUARDA_BOLETO', 'AVAL_PAGAMENTO'].includes(g.evento_key) && !g.concluido_em).length} sub="boleto ou aval de pagamento" delta="—" deltaDir="up" icon="dollar"/>
        <KPI label="Gatilhos manuais próx. 7d" value={manuais.filter(g => (g.days_left ?? g.daysLeft ?? 99) <= 7 && (g.days_left ?? g.daysLeft ?? 99) > 0).length} sub="atenção" delta="—" deltaDir="up" icon="clock"/>
        <KPI label="Manuais em atraso" value={manuais.filter(g => (g.days_left ?? g.daysLeft ?? 0) < 0).length} sub="ação urgente" delta="—" deltaDir="down" icon="warning"/>
      </div>

      {urgentes.length > 0 && (
        <div className="alert danger" style={{ marginBottom: 20 }}>
          <Icon.warning/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">{urgentes.length} gatilho{urgentes.length > 1 ? 's' : ''} vence{urgentes.length === 1 ? '' : 'm'} em até 2 dias</div>
            <div className="alert__sub">Verifique os gatilhos abaixo e confirme os pagamentos pendentes.</div>
          </div>
          <Button variant="secondary" size="sm" iconRight="arrowRight">Ver agora</Button>
        </div>
      )}

      <Card title="Central de Alertas" sub="ações pendentes que requerem sua atenção" style={{ marginBottom: 20 }}
        action={<Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute?.("notificacoes")}>Ver tudo</Button>}>
        <div className="stack">
          {alertas.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhum alerta pendente.
            </div>
          )}
          {alertas.map((a) => (
            <AlertRow key={a.id} alert={a} onClick={() => setRoute?.(routeByModule(a.module))}/>
          ))}
        </div>
      </Card>

      <Card title="Cadeia de Gatilhos por Cotação" sub={`${Object.keys(cadeiasPorCotacao).length} cotações · Formulário → Compra liberada`} style={{ marginBottom: 20 }}>
        <div className="stack" style={{ gap: 20 }}>
          {Object.keys(cadeiasPorCotacao).length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhuma cadeia automática ainda — nasce ao preencher o primeiro Formulário de Elevador.
            </div>
          )}
          {Object.entries(cadeiasPorCotacao).map(([numeroCotacao, nos]) => (
            <CadeiaGatilhosCotacao key={numeroCotacao} numeroCotacao={numeroCotacao} nos={nos}
              onConfirmarSinal={setConfirmarSinalDe} onConfirmarAval={setConfirmarAvalDe}
              onFecharLembrete={fecharLembrete} onAbrirGatilho={abrirGatilho}/>
          ))}
        </div>
      </Card>

      <Card title="Gatilhos Financeiros Avulsos" sub={`${manuais.length} registros cadastrados manualmente`}>
        <div className="stack" style={{ gap: 14 }}>
          {manuais.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhum registro cadastrado.
            </div>
          )}
          {manuais.map((g) => (
            <GatilhoCard key={g.id} g={g} onSaved={reloadGatilhos}/>
          ))}
        </div>
      </Card>
      {showGatilho && <ModalNovoGatilho onClose={() => setShowGatilho(false)} onSaved={reloadGatilhos}/>}
      {confirmarSinalDe && <ModalConfirmarSinal g={confirmarSinalDe} onClose={() => setConfirmarSinalDe(null)} onSaved={reloadGatilhos}/>}
      {confirmarAvalDe && <ModalConfirmarAvalPagamento g={confirmarAvalDe} onClose={() => setConfirmarAvalDe(null)} onSaved={reloadGatilhos}/>}
    </div>
  );
}

/* Interpola azul (início do prazo) → vermelho (prazo estourado). */
function corGantt(pct) {
  const p = Math.max(0, Math.min(1, pct));
  const de = [37, 99, 235];   // --vp-info / azul
  const para = [220, 38, 38]; // --vp-danger / vermelho
  const rgb = de.map((v, i) => Math.round(v + (para[i] - v) * p));
  return `rgb(${rgb.join(',')})`;
}

/* "faltam Xh" / "prazo estourado" / "concluído" — reaproveitado pelo
   mini-Gantt tanto no resumo fechado quanto nas linhas da árvore aberta. */
function labelPrazo(nascidoEm, prazoEm, concluidoEm) {
  if (concluidoEm) return "concluído dentro do prazo";
  if (!prazoEm || !nascidoEm) return null;
  const end = new Date(prazoEm).getTime();
  const restanteMs = end - Date.now();
  if (restanteMs <= 0) return "prazo estourado";
  return restanteMs > 3600000 ? `faltam ${Math.round(restanteMs / 3600000)}h` : `faltam ${Math.max(0, Math.round(restanteMs / 60000))}min`;
}

/* Barra de Gantt compacta — usada no resumo fechado da cadeia e nas
   linhas da árvore expandida. `comLabel` mostra "faltam Xh" ao lado. */
function GanttBarMini({ nascidoEm, prazoEm, concluidoEm, encerrado, comLabel }) {
  const barra = (cor, pct) => (
    <div style={{ height: 4, width: 60, background: "var(--vp-gray-100)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: Math.min(Math.max(pct, 0), 1) * 100 + "%", height: "100%", background: cor }}/>
    </div>
  );
  let el;
  let cor = concluidoEm ? "var(--vp-success)" : "var(--fg3)";
  if (encerrado) {
    el = <div style={{ height: 4, background: "var(--vp-gray-300)", borderRadius: 2, width: 60 }}/>;
  } else if (!prazoEm || !nascidoEm) {
    el = <div style={{ height: 4, background: concluidoEm ? "var(--vp-success)" : "var(--vp-gray-200)", borderRadius: 2, width: 60 }}/>;
  } else {
    const start = new Date(nascidoEm).getTime();
    const end = new Date(prazoEm).getTime();
    const now = concluidoEm ? new Date(concluidoEm).getTime() : Date.now();
    const pct = end > start ? (now - start) / (end - start) : 0;
    cor = concluidoEm ? "var(--vp-success)" : corGantt(pct);
    el = barra(cor, pct);
  }
  if (!comLabel) return el;
  const label = labelPrazo(nascidoEm, prazoEm, concluidoEm);
  return (
    <div className="row gap-2" style={{ alignItems: 'center' }}>
      {el}
      {label && <span className="mono small" style={{ color: cor, whiteSpace: 'nowrap' }}>{label}</span>}
    </div>
  );
}

/* ---------- Cadeia automática (GatilhosEngine) ----------
   Fechada: uma linha-resumo por cotação (clicável, mini-Gantt do nó
   atual). Aberta: árvore vertical, cada nó indentado pela profundidade
   na cadeia (irmãos II/SS ficam no mesmo nível) — não mais cards lado
   a lado, que não escalam quando há muitas cotações na tela. */
function CadeiaGatilhosCotacao({ numeroCotacao, nos, onConfirmarSinal, onConfirmarAval, onFecharLembrete, onAbrirGatilho }) {
  const [aberta, setAberta] = React.useState(false);
  const engine = window.GatilhosEngine;

  const principais = nos.filter(g => !String(g.evento_key || '').startsWith('LEMBRETE__'))
    .sort((a, b) => new Date(a.nascido_em || 0) - new Date(b.nascido_em || 0));
  const lembretesPorPai = nos.filter(g => String(g.evento_key || '').startsWith('LEMBRETE__'))
    .reduce((acc, g) => { (acc[g.predecessor_id] = acc[g.predecessor_id] || []).push(g); return acc; }, {});

  const encerrada = principais.some(g => g.status === 'encerrado');
  const concluida = principais.every(g => g.concluido_em);
  const noAtual = principais.find(g => !g.concluido_em) || principais[principais.length - 1];
  const statusLabel = encerrada ? 'Encerrada (proposta recusada)' : concluida ? 'Concluída' : 'Em andamento';
  const statusVariant = encerrada ? 'neutral' : concluida ? 'success' : 'warning';

  return (
    <div>
      <div className="row sb" style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => setAberta((v) => !v)}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <Icon.chevRight size={12} style={{ transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
          <div className="up-eyebrow muted">Cotação Nº {numeroCotacao}</div>
          {!aberta && noAtual && (
            <>
              <span className="small muted">{noAtual.trigger_name}</span>
              <GanttBarMini nascidoEm={noAtual.nascido_em} prazoEm={noAtual.prazo_em} concluidoEm={noAtual.concluido_em} encerrado={encerrada}/>
            </>
          )}
        </div>
        <Badge variant={statusVariant} dot>{statusLabel}</Badge>
      </div>

      {aberta && (
        <div style={{ marginTop: 8, marginLeft: 20 }}>
          {principais.map((g) => {
            const isOpen = !g.concluido_em;
            const revisao = g.status === 'revisao_necessaria';
            const podeConfirmarSinal = g.evento_key === 'AGUARDA_BOLETO' && isOpen;
            const podeConfirmarAval = g.evento_key === 'AVAL_PAGAMENTO' && isOpen;
            const lembretes = lembretesPorPai[g.id] || [];
            const nodeDef = (engine?.NODES || []).find((n) => n.key === g.evento_key);
            const clicavel = !!(nodeDef && nodeDef.rota);
            const nivel = engine ? engine.profundidade(g.evento_key) : 0;
            const cor = revisao ? 'var(--vp-warning)' : g.concluido_em ? 'var(--vp-success)' : 'var(--fg2)';
            return (
              <div key={g.id}>
                <div className="row gap-2" style={{
                  alignItems: 'center', padding: '6px 8px', marginLeft: nivel * 20,
                  borderLeft: nivel > 0 ? '2px solid var(--border)' : 'none',
                  cursor: clicavel ? 'pointer' : 'default',
                }} onClick={clicavel ? () => onAbrirGatilho(g) : undefined} title={clicavel ? 'Abrir' : undefined}>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg3)', width: 20 }}>{g.tipo_relacionamento || 'FS'}</span>
                  <span className="small" style={{ color: cor, fontWeight: g.concluido_em ? 400 : 700, flex: 1 }}>
                    {g.trigger_name}
                    {revisao ? ' — requer revisão' : ''}
                  </span>
                  <GanttBarMini nascidoEm={g.nascido_em} prazoEm={g.prazo_em} concluidoEm={g.concluido_em} comLabel/>
                  {podeConfirmarSinal && (
                    <Button size="sm" variant="primary" icon="check"
                      onClick={(e) => { e.stopPropagation(); onConfirmarSinal(g); }}>Boleto pago</Button>
                  )}
                  {podeConfirmarAval && (
                    <Button size="sm" variant="primary" icon="check"
                      onClick={(e) => { e.stopPropagation(); onConfirmarAval(g); }}>Dar Aval</Button>
                  )}
                </div>
                {lembretes.map((l) => (
                  <div key={l.id} className="row sb" style={{
                    marginLeft: (nivel + 1) * 20, padding: '4px 8px', fontSize: 11,
                    background: 'var(--vp-warning-tint)', borderLeft: '2px solid var(--border)',
                  }}>
                    <span>⚠ {l.trigger_name}</span>
                    {!l.concluido_em && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onFecharLembrete(l.id); }}>Já cobrei</Button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModalConfirmarSinal({ g, onClose, onSaved }) {
  const [valor, setValor] = React.useState('');
  const [pagoEm, setPagoEm] = React.useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = React.useState(false);

  const confirmar = async () => {
    setSaving(true);
    try {
      const av = await window.AvalFinanceiroStore.getByNumeroCotacao(g.numero_cotacao);
      if (!av) throw new Error('Registro de Aval Financeiro não encontrado para essa cotação.');
      await window.AvalFinanceiroStore.confirmarSinal(av.id, { valor: valor ? parseFloat(valor) : null, pagoEm });
      window.toast('Boleto confirmado como pago — Gatilho fechado.', 'success');
      onSaved?.(); onClose();
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Confirmar Boleto Pago" onClose={onClose} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={confirmar} disabled={saving}>{saving ? 'Confirmando…' : 'Confirmar boleto pago'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Valor recebido (R$)</label>
          <input className="input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0"/>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Data do pagamento</label>
          <input className="input" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

function ModalConfirmarAvalPagamento({ g, onClose, onSaved }) {
  const [observacoes, setObservacoes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const confirmar = async () => {
    setSaving(true);
    try {
      const av = await window.AvalFinanceiroStore.getByNumeroCotacao(g.numero_cotacao);
      if (!av) throw new Error('Registro de Aval Financeiro não encontrado para essa cotação.');
      await window.AvalFinanceiroStore.confirmarAvalPagamento(av.id, observacoes);
      window.toast('Aval de Pagamento confirmado — Compra ao Fornecedor liberada.', 'success');
      onSaved?.(); onClose();
    } catch (e) {
      window.toast('Erro: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Dar Aval de Pagamento" onClose={onClose} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={confirmar} disabled={saving}>{saving ? 'Confirmando…' : 'Dar Aval de Pagamento'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <p className="muted" style={{ fontSize: 13 }}>
          Checkpoint final do Financeiro antes de liberar a compra ao Fornecedor — distinto do
          Aval Financeiro de score/crédito, que já rodou antes do contrato.
        </p>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações (opcional)</label>
          <input className="input" type="text" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: pagamento conciliado no extrato de hoje"/>
        </div>
      </div>
    </Modal>
  );
}

function GatilhoCard({ g, onSaved }) {
  const [saving, setSaving] = React.useState(false);
  const daysLeft = g.days_left ?? g.daysLeft ?? 0;
  const dueDate  = g.due_date  ?? g.dueDate  ?? null;
  const revFrom  = g.reverse_from ?? g.reverseFrom ?? null;
  const chain    = Array.isArray(g.chain) ? g.chain : [];
  const dueColor = daysLeft <= 2 ? "var(--vp-danger)" : daysLeft <= 7 ? "var(--vp-warning)" : "var(--vp-success)";
  const confirmado = !!g.concluido_em;

  const confirmar = async () => {
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.from('gatilhos')
        .update({ status: 'ok', concluido_em: new Date().toISOString(), conclusao_tipo: 'confirmado_manual' })
        .eq('id', g.id).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('sem permissão para atualizar (RLS).');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Gatilhos', acao: 'Gatilho confirmado', alvo: g.trigger_name || g.building, alvo_id: g.id });
      window.toast('Gatilho confirmado.', 'success');
      onSaved && onSaved();
    } catch (e) { window.toast('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", padding: 0, position: "relative" }}>
      <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }}/>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 200px", gap: 14, padding: "16px 20px", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="up-eyebrow muted">{(g.projeto || g.project_id || "")} · {(g.trigger || g.trigger_name || "")}</div>
          <div style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>{g.building}</div>
        </div>
        <div>
          <div className="up-eyebrow muted">Valor</div>
          <div className="cell-money mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmtBRL(g.value)}</div>
        </div>
        <div>
          <div className="up-eyebrow muted">Vencimento</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: dueColor }}>{fmtDateLong(dueDate)}</div>
          <div className="mono small" style={{ color: dueColor }}>{daysLeft > 0 ? `em ${daysLeft} dias` : daysLeft < 0 ? `vencido há ${-daysLeft}d` : "vence hoje"}</div>
        </div>
        <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
          {confirmado ? <Badge variant="success" dot>Confirmado</Badge>
           : g.status === "ok" ? <Badge variant="success" dot>OK</Badge>
           : g.status === "atencao" ? <Badge variant="warning" dot>Atenção</Badge>
           : <Badge variant="danger" dot>Pendente</Badge>}
          {!confirmado && (
            <Button variant={daysLeft <= 2 ? "primary" : "outline"} size="sm" icon="check" disabled={saving}
              onClick={confirmar}>{saving ? "Confirmando…" : "Confirmar"}</Button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 20px", background: "var(--vp-gray-50)" }}>
        <div className="up-eyebrow muted" style={{ marginBottom: 10 }}>
          <Icon.history size={11} style={{ verticalAlign: "middle", marginRight: 4 }}/>
          Prazo reverso · base: {revFrom || "—"}
        </div>
        {chain.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--fg3)", fontStyle: "italic" }}>Cadeia de prazos não configurada.</div>
        ) : (
          <div className="prazo-chain">
            {chain.map((c, i) => {
              const lastIdx = chain.length - 1;
              const cls = i === lastIdx ? "current" : i < lastIdx - 1 ? "success" : "warning";
              const label = String(c);
              return (
                <div key={i} className={"prazo-step " + cls}>
                  <div className="prazo-step__lbl">Etapa {i + 1}</div>
                  <div className="prazo-step__t">{label.split(" — ")[0] || label}</div>
                  {label.includes(" — ") ? <div className="prazo-step__d">{label.split(" — ")[1]}</div> : null}
                  {i < chain.length - 1 ? (
                    <div className="prazo-step__arrow"><Icon.arrowRight size={10}/></div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- COMISSÕES ---------- */
function ComissoesPage() {
  const [comissoes, setComissoes] = React.useState([]);
  const [aguardandoGeracao, setAguardandoGeracao] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [gerando, setGerando] = React.useState(null);

  const reload = React.useCallback(async () => {
    const { data } = await window.__VP_SB.sb.from('comissoes').select('*').order('id');
    setComissoes(data || []);
    try {
      setAguardandoGeracao(await window.ComissionamentoStore.listarPropostasAguardandoComissao());
    } catch (e) { setAguardandoGeracao([]); }
  }, []);
  React.useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const gerarComissao = async (p) => {
    setGerando(p.id);
    try {
      const linhas = await window.ComissionamentoStore.gerarComissoesDaProposta(p.id);
      window.toast?.(`${linhas.length} comissão(ões) gerada(s) para a Proposta ${p.numero_documento || p.numero_cotacao}.`, 'success');
      await reload();
    } catch (e) { window.toast?.('Erro ao gerar comissão: ' + e.message, 'error'); }
    finally { setGerando(null); }
  };

  const aprovarDiretoria = async (c) => {
    setBusy(true);
    try {
      const { data, error } = await window.__VP_SB.sb.from('comissoes')
        .update({ status: 'Aprovado' }).eq('id', c.id).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('sem permissão para atualizar (RLS).');
      window.toast?.(`Comissão acima do limite aprovada por diretoria (${c.aprovador_necessario || ''}).`, 'success');
      await reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  /* Persiste o status na tabela `comissoes`. Verifica linhas afetadas via
     .select() — se RLS bloquear, mostra erro honesto em vez de sucesso falso. */
  const setStatus = async (c, status, msg) => {
    setBusy(true);
    try {
      const { data, error } = await window.__VP_SB.sb.from('comissoes').update({ status }).eq('id', c.id).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('sem permissão para atualizar (RLS).');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Comissões', acao: msg, alvo: c.vendedor, alvo_id: c.id, detalhe: { comissao: c.comissao, status } });
      window.toast(msg + ' — ' + (c.vendedor || ''), 'success');
      await reload();
    } catch (e) { window.toast('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };
  const aprovar = (c) => setStatus(c, 'Aprovado', 'Comissão aprovada');
  const pagar = (c) => setStatus(c, 'Pago', 'Pagamento liberado');

  const aprovarTodas = async () => {
    const pendentes = comissoes.filter(c => c.status !== 'Aprovado' && c.status !== 'Pago' && !c.requer_aprovacao_diretoria);
    if (!pendentes.length) return window.toast('Nenhuma comissão pendente de aprovação (fora as que exigem diretoria).', 'info');
    setBusy(true);
    try {
      const ids = pendentes.map(c => c.id);
      const { data, error } = await window.__VP_SB.sb.from('comissoes').update({ status: 'Aprovado' }).in('id', ids).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('sem permissão para atualizar (RLS).');
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Comissões', acao: 'Aprovou ' + data.length + ' comissões pendentes', detalhe: { ids } });
      window.toast(data.length + ' comissões aprovadas.', 'success');
      await reload();
    } catch (e) { window.toast('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const total = comissoes.reduce((a, c) => a + (c.comissao || 0), 0);
  const totalAprovado = comissoes.filter(c => c.status === "Aprovado").reduce((a, c) => a + (c.comissao || 0), 0);
  const totalAguardando = comissoes.filter(c => c.status !== "Aprovado" && c.status !== "Pago").reduce((a, c) => a + (c.comissao || 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Comissões</div>
          <h1 className="page-head__title">Comissões — Q2/26</h1>
          <p className="page-head__sub">Comissionamento sobre faturamento líquido · liberação após confirmação de entrada</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={() => window.csvDownload(comissoes.map(c => ({ vendedor:c.vendedor, cargo:c.role, projetos:c.projetos??c.projetos_count, faturado:c.faturado, pct_comissao:c.pct, comissao:c.comissao, status:c.status })), 'folha-comissoes-q2.csv')}>Folha de pagto</Button>
          <Button variant="primary" icon="check" onClick={aprovarTodas} disabled={busy}>Aprovar todas</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Total comissões Q2" value={fmtBRL(total)} sub={`${comissoes.length} colaboradores`} delta="—" deltaDir="up" icon="award"/>
        <KPI label="Aprovado" value={fmtBRL(totalAprovado)} sub="liberado" delta="—" deltaDir="up" icon="check"/>
        <KPI label="Aguardando" value={fmtBRL(totalAguardando)} sub="trigger pendente" delta="—" deltaDir="up" icon="clock"/>
        <KPI label="Maior comissão" value={comissoes.length > 0 ? fmtBRL(Math.max(...comissoes.map(c => c.comissao || 0))) : "—"} sub="—" delta="—" deltaDir="flat" icon="award"/>
      </div>

      {aguardandoGeracao.length > 0 && (
        <Card title="Propostas assinadas aguardando geração de comissão" sub={`${aguardandoGeracao.length} proposta(s) — aplica a regra de comissionamento por origem da venda`} style={{ marginBottom: 16 }}>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="t">
              <thead><tr><th>Proposta</th><th>Cotação Nº</th><th className="text-right">Valor</th><th></th></tr></thead>
              <tbody>
                {aguardandoGeracao.map((p) => (
                  <tr key={p.id}>
                    <td>{p.numero_documento || p.titulo || '—'}</td>
                    <td className="mono">{p.numero_cotacao ?? '—'}</td>
                    <td className="cell-money">{fmtBRL(p.valor_total)}</td>
                    <td><Button variant="primary" size="sm" icon="award" disabled={gerando === p.id} onClick={() => gerarComissao(p)}>{gerando === p.id ? 'Gerando…' : 'Gerar comissão'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Resumo por vendedor" sub={`${comissoes.length} colaboradores · pagamento dia 10`}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr>
              <th>Vendedor</th>
              <th>Projetos fechados</th>
              <th className="text-right">Faturamento líquido</th>
              <th>%</th>
              <th className="text-right">Comissão Q2</th>
              <th>Progresso</th>
              <th>Status</th>
              <th></th>
            </tr></thead>
            <tbody>
              {comissoes.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                  Nenhum registro cadastrado.
                </td></tr>
              )}
              {comissoes.map((c, i) => (
                <tr key={c.id || c.vendedor}>
                  <td>
                    <div className="row gap-3">
                      <div className="avatar">{(c.vendedor || "?").split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                      <div>
                        <div className="cell-main">{c.vendedor}</div>
                        <div className="cell-sub">{c.role}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="cell-num">{c.projetos ?? c.projetos_count}</span></td>
                  <td className="cell-money">{fmtBRL(c.faturado)}</td>
                  <td><span className="cell-num">{c.pct}%</span></td>
                  <td className="cell-money" style={{ fontSize: 14, fontWeight: 800 }}>{fmtBRL(c.comissao)}</td>
                  <td style={{ width: 140 }}>
                    <div className="progress" style={{ marginBottom: 4 }}>
                      <span style={{ width: ((c.comissao / 150000) * 100) + "%", background: i % 2 ? "var(--vp-yellow-press)" : "var(--vp-yellow)" }}/>
                    </div>
                    <div className="cell-sub mono">{Math.round(c.comissao / 150000 * 100)}% meta Q</div>
                  </td>
                  <td>
                    <StatusBadge status={c.status}/>
                    {c.requer_aprovacao_diretoria && c.status !== 'Aprovado' && c.status !== 'Pago' && (
                      <div className="small muted" style={{ marginTop: 2 }}>acima do limite — requer {c.aprovador_necessario || 'diretoria'}</div>
                    )}
                  </td>
                  <td>
                    {c.status === "Aprovado" ? <Button variant="primary" size="sm" icon="dollar" disabled={busy} onClick={() => pagar(c)}>Pagar</Button>
                     : c.status === "Pago" ? <Button variant="ghost" size="sm" icon="check" disabled/>
                     : c.status === "Aguardando aprovação diretoria" ? <Button variant="outline" size="sm" icon="alert" disabled={busy} onClick={() => aprovarDiretoria(c)}>Aprovar (diretoria)</Button>
                     : <Button variant="outline" size="sm" icon="check" disabled={busy} onClick={() => aprovar(c)}>Aprovar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14, padding: "12px 16px", background: "#000", color: "var(--vp-yellow)" }} className="row sb">
        <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontWeight: 800, fontSize: 14 }}>Total a pagar Q2/26</span>
        <span className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{fmtBRL(total)}</span>
      </div>
    </div>
  );
}

/* ---------- NOTIFICAÇÕES ---------- */
function NotificacoesPage({ setRoute }) {
  const [alertasRaw, setAlertasRaw] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("Todas");
  const [moduleFilter, setModuleFilter] = React.useState("Todos");
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [details, setDetails] = React.useState(null);
  const [readIds, setReadIds] = React.useState([]);
  const filters = ["Todas", "Não lidas"];
  const NP = window.NotificacoesProcessamento;
  const LidasStore = window.NotificacoesLidasStore;

  // Busca de alertas e leitura do estado "lido" são independentes: carregar
  // uma não deve refazer a outra (candidato 2 da revisão de arquitetura —
  // antes o estado "lido" vinha do localStorage embutido na própria busca
  // de alertas, e reabria a query toda vez que uma notificação era marcada).
  React.useEffect(() => {
    setLoading(true);
    window.__VP_SB.sb.from('alertas').select('*').eq('resolved', false).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { window.toast('Erro ao carregar notificações: ' + error.message, 'error'); setAlertasRaw([]); }
        else setAlertasRaw(data || []);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => { LidasStore.carregar().then(setReadIds); }, []);

  const markRead = (id) => {
    const idStr = String(id);
    if (readIds.includes(idStr)) return;
    setReadIds((prev) => [...prev, idStr]);
    LidasStore.marcarLida(id);
  };
  const markAllRead = () => {
    const ids = alertasRaw.map((a) => String(a.id));
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
    LidasStore.marcarTodasLidas(ids);
    window.toast("Notificações marcadas como lidas", "success");
  };

  const notifications = NP.processarAlertas(alertasRaw, readIds);
  const modules = ["Todos", ...Array.from(new Set(notifications.map(n => n.module))).sort()];
  const rows = notifications.filter(n => {
    if (filter === "Não lidas" && !n.unread) return false;
    if (moduleFilter !== "Todos" && n.module !== moduleFilter) return false;
    return true;
  });
  const groups = NP.agruparPorPeriodo(rows);
  const openNotification = (n) => {
    markRead(n.id);
    setRoute(NP.rotaPara(n.module));
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Central</div>
          <h1 className="page-head__title">Notificações</h1>
          <p className="page-head__sub">Agrupadas por módulo · respostas rápidas inline</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="settings" onClick={() => setPrefsOpen(true)}>Preferências</Button>
          <Button variant="primary" icon="check" onClick={markAllRead}>Marcar todas como lidas</Button>
        </div>
      </div>

      <div className="tbar">
        <div className="seg">
          {filters.map(f => <button key={f} className={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <div className="spacer"/>
        <select className="input" style={{ width: 180, height: 30, fontSize: 12 }} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          {modules.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="table-wrap" style={{ padding: 0 }}>
        {loading && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
            Carregando notificações…
          </div>
        )}
        {!loading && Object.entries(groups).length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
            Nenhuma notificação encontrada.
          </div>
        )}
        {Object.entries(groups).map(([grp, items]) => (
          <div key={grp}>
            <div style={{ padding: "10px 20px", background: "var(--vp-gray-100)", fontSize: 10, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--fg2)", borderBottom: "1px solid var(--border)" }}>{grp}</div>
            {items.map((n) => {
              const I = Icon[n.icon] || Icon.bell;
              return (
                <div key={n.id} className={"notif-row " + (n.unread ? "unread" : "")} onClick={() => setDetails(n)}>
                  <div className="notif-row__icon"><I size={16}/></div>
                  <div className="notif-row__body">
                    <div className="notif-row__title">{n.title}</div>
                    <div className="notif-row__meta">
                      <span>{n.module}</span>
                      <span>·</span>
                      <span>{n.time}</span>
                    </div>
                  </div>
                  <div className="row gap-2">
                    <Button variant="ghost" size="sm" icon="check" aria-label="Marcar como lida"
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); window.toast('Notificação marcada como lida', 'success'); }}/>
                    <Button variant="ghost" size="sm" icon="arrowRight" aria-label="Abrir origem"
                      onClick={(e) => { e.stopPropagation(); openNotification(n); }}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {prefsOpen && <NotificationPrefsModal onClose={() => setPrefsOpen(false)}/>}
      {details && <Modal title="Detalhe da Notificação" onClose={() => setDetails(null)} width={520}
        footer={<>
          <Button variant="ghost" onClick={() => { markRead(details.id); setDetails(null); }}>Marcar como lida</Button>
          <Button variant="primary" iconRight="arrowRight" onClick={() => openNotification(details)}>Abrir origem</Button>
        </>}>
        <div className="stack">
          <Badge variant={details.level === 'danger' ? 'danger' : details.level === 'warning' ? 'warning' : 'info'} dot>{details.module}</Badge>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{details.title}</div>
          {details.sub ? <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{details.sub}</div> : null}
          <div className="mono small muted">{details.time}</div>
        </div>
      </Modal>}
    </div>
  );
}

function NotificationPrefsModal({ onClose }) {
  const [prefs, setPrefs] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vpprd.notificacoes.preferencias') || 'null') || {
        email: true, navegador: true, financeiro: true, operacoes: true, comercial: true,
      };
    } catch (e) {
      return { email: true, navegador: true, financeiro: true, operacoes: true, comercial: true };
    }
  });
  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));
  const save = () => {
    localStorage.setItem('vpprd.notificacoes.preferencias', JSON.stringify(prefs));
    window.toast('Preferências salvas', 'success');
    onClose();
  };
  const row = (key, label, sub) => (
    <label className="row sb" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
      <span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{label}</span>
        <span className="muted" style={{ fontSize: 12 }}>{sub}</span>
      </span>
      <input type="checkbox" checked={!!prefs[key]} onChange={() => toggle(key)} style={{ width: 18, height: 18, accentColor: 'var(--vp-yellow)' }}/>
    </label>
  );
  return (
    <Modal title="Preferências de Notificação" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save}>Salvar preferências</Button>
      </>}>
      <div className="stack">
        {row('navegador', 'Alertas no sistema', 'Exibir notificações dentro do VP Gestão.')}
        {row('email', 'Resumo por email', 'Receber consolidados operacionais no email cadastrado.')}
        {row('financeiro', 'Financeiro', 'Gatilhos, comissões e pagamentos.')}
        {row('operacoes', 'Operações', 'Importação, engenharia, NCM e instalação.')}
        {row('comercial', 'Comercial', 'Leads, cotações e propostas.')}
      </div>
    </Modal>
  );
}

/* ---------- CONFIGURAÇÕES ---------- */
function ConfiguracoesPage() {
  const [tab, setTab] = React.useState("usuarios");
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Admin · Configurações</div>
          <h1 className="page-head__title">Configurações do Sistema</h1>
          <p className="page-head__sub">Usuários, permissões, parâmetros financeiros, integrações de API.</p>
        </div>
      </div>

      <Tabs tabs={[
        { key: "administracao", label: "Administração", icon: "users" },
        { key: "usuarios", label: "Usuários & Perfis", icon: "users" },
        { key: "permissoes", label: "Permissões (RLS)", icon: "shield" },
        { key: "parametros", label: "Parâmetros", icon: "settings" },
        { key: "integracoes", label: "Integrações", icon: "globe" },
        { key: "buckets", label: "Buckets Storage", icon: "package" },
      ]} active={tab} onChange={setTab}/>

      <div style={{ marginTop: 24 }}>
        {tab === "administracao" && <window.ColaboradoresAdminPage/>}
        {tab === "usuarios" && <ConfigUsers/>}
        {tab === "permissoes" && <ConfigPermissions/>}
        {tab === "parametros" && <ConfigParams/>}
        {tab === "integracoes" && <ConfigIntegrations/>}
        {tab === "buckets" && <ConfigBuckets/>}
      </div>
    </div>
  );
}

function ConfigUsers() {
  const sb = window.__VP_SB.sb;
  const [users, setUsers] = React.useState([]);
  const [convites, setConvites] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showConvite, setShowConvite] = React.useState(false);

  const load = React.useCallback(async () => {
    const [u, c] = await Promise.all([
      sb.from('usuarios').select('*').order('name'),
      sb.from('convites').select('*').eq('status', 'pendente').order('created_at', { ascending: false }),
    ]);
    setUsers(u.data || []); setConvites(c.data || []); setLoading(false);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const revogar = async (c) => {
    const { error } = await sb.from('convites').update({ status: 'revogado' }).eq('id', c.id);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Convite revogado.', 'info'); load();
  };

  if (loading) return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  return (
    <>
      <Card title="Usuários" sub={`${users.length} cadastrados`}
        action={<Button variant="primary" size="sm" icon="plus" onClick={() => setShowConvite(true)}>Convidar usuário</Button>}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t">
            <thead><tr>
              <th>Nome</th><th>Perfil</th><th>Email</th><th>Último login</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                  Nenhum usuário cadastrado.
                </td></tr>
              )}
              {users.map(u => (
                <tr key={u.id || u.email}>
                  <td>
                    <div className="row gap-3">
                      <div className="avatar">{(u.name || u.email || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
                      <span className="cell-main">{u.name || u.email}</span>
                    </div>
                  </td>
                  <td><Badge variant="ink">{u.role || "—"}</Badge></td>
                  <td><span className="mono small">{u.email}</span></td>
                  <td><span className="mono small muted">{u.last_login ? fmtDate(u.last_login) : "—"}</span></td>
                  <td><Badge variant={u.active !== false ? "success" : "neutral"} dot>{u.active !== false ? "Ativo" : "Inativo"}</Badge></td>
                  <td><Button variant="ghost" size="sm" icon="more"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {convites.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title="Convites pendentes" sub={`${convites.length} aguardando criação de acesso`}>
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="t">
                <thead><tr><th>Email</th><th>Nome</th><th>Perfil</th><th>Convidado por</th><th>Quando</th><th></th></tr></thead>
                <tbody>
                  {convites.map(c => (
                    <tr key={c.id}>
                      <td><span className="mono small">{c.email}</span></td>
                      <td>{c.nome || '—'}</td>
                      <td><Badge variant="ink">{c.role || '—'}</Badge></td>
                      <td><span className="small muted">{c.convidado_por || '—'}</span></td>
                      <td><span className="mono small muted">{c.created_at ? fmtDate(c.created_at) : '—'}</span></td>
                      <td><Button variant="ghost" size="sm" onClick={() => revogar(c)}>Revogar</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {showConvite && <ModalConvidarUsuario onClose={() => setShowConvite(false)} onSaved={() => { setShowConvite(false); load(); }}/>}
    </>
  );
}

function ModalConvidarUsuario({ onClose, onSaved }) {
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("Comercial");
  const [saving, setSaving] = React.useState(false);
  const roles = ["Admin", "Comercial", "Engenharia", "Financeiro", "Jurídico", "Importação", "Instalação"];

  const salvar = async () => {
    const em = email.trim();
    if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return window.toast('Informe um e-mail válido.', 'warning');
    setSaving(true);
    try {
      const convidadoPor = (window.__VP_USER && window.__VP_USER.email) || 'admin';
      const { error } = await window.__VP_SB.sb.from('convites').insert({ email: em, nome: nome.trim() || null, role, convidado_por: convidadoPor });
      if (error) throw error;
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Admin', acao: 'Convite de usuário criado', alvo: em, detalhe: { role } });
      window.toast('Convite registrado para ' + em + '.', 'success');
      onSaved && onSaved();
    } catch (e) { window.toast('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Convidar usuário" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Registrando…' : 'Registrar convite'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div>
          <div className="pe-field-label">E-mail <span className="pe-req">*</span></div>
          <input className="pe-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@verticalparts.com.br"/>
        </div>
        <div>
          <div className="pe-field-label">Nome</div>
          <input className="pe-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"/>
        </div>
        <div>
          <div className="pe-field-label">Perfil</div>
          <select className="pe-input" value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <p className="small muted" style={{ margin: 0 }}>O convite fica registrado como pendente para acompanhamento. A criação do login em si é feita pelo time de TI (SSO do portal vpsistema).</p>
      </div>
    </Modal>
  );
}

function ConfigPermissions() {
  const modules = ["Leads", "Cotações", "Precificação", "Propostas", "Jurídico", "Engenharia", "Financeiro", "Importação", "Compras", "Instalação", "Comissões"];
  const perms = [
    { role: "Admin", access: modules.map(() => "rwx") },
    { role: "Comercial Sr.", access: ["rwx", "rwx", "rwx", "rwx", "r", "r", "r", "r", "r", "r", "r"] },
    { role: "Comercial Pleno", access: ["rwx", "rwx", "r", "rwx", "r", "r", "-", "r", "r", "r", "-"] },
    { role: "Engenharia", access: ["r", "r", "r", "r", "r", "rwx", "-", "rwx", "rwx", "rwx", "-"] },
    { role: "Jurídico", access: ["r", "r", "-", "r", "rwx", "r", "r", "r", "r", "r", "-"] },
    { role: "Financeiro", access: ["r", "r", "rwx", "r", "r", "r", "rwx", "rwx", "rwx", "r", "rwx"] },
    { role: "Instalação", access: ["-", "-", "-", "-", "-", "r", "-", "r", "r", "rwx", "-"] },
  ];
  return (
    <Card title="Matriz de Permissões — modelo de referência" sub="r=leitura · w=criar/editar · x=ações restritas">
      <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--vp-warning-tint, #f8eed7)", border: "1px solid var(--border)", fontSize: 12, color: "var(--fg2)" }}>
        Este quadro documenta o <b>modelo de acesso planejado</b> por perfil. O controle por linha (RLS) ainda não é gerido por esta tela — alterações de permissão são feitas via políticas no Supabase.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ minWidth: 880 }}>
          <thead><tr>
            <th style={{ position: "sticky", left: 0, background: "var(--vp-gray-50)", zIndex: 2 }}>Perfil</th>
            {modules.map(m => <th key={m} style={{ textAlign: "center" }}>{m}</th>)}
          </tr></thead>
          <tbody>
            {perms.map(p => (
              <tr key={p.role}>
                <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, fontWeight: 700 }}>{p.role}</td>
                {p.access.map((a, i) => (
                  <td key={i} style={{ textAlign: "center" }}>
                    <PermCell value={a}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PermCell({ value }) {
  if (value === "-") return <span style={{ color: "var(--vp-gray-300)" }}>—</span>;
  const color = value === "rwx" ? "var(--vp-success)" : value === "rw" ? "var(--vp-info)" : value === "r" ? "var(--vp-gray-400)" : "var(--vp-warning)";
  const bg = value === "rwx" ? "var(--vp-success-tint)" : value === "r" ? "var(--vp-gray-100)" : "var(--vp-warning-tint)";
  return <span style={{ display: "inline-block", padding: "2px 8px", background: bg, color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 10, letterSpacing: ".1em" }}>{value.toUpperCase()}</span>;
}

function ConfigParams() {
  return (
    <div className="grid-2" style={{ gap: 16 }}>
      <Card title="Parâmetros Financeiros" sharp>
        <div className="stack">
          <ParamRow label="Câmbio USD → BRL (manual)" value="R$ 5,18" mono/>
          <ParamRow label="Margem mínima projeto" value="22%" mono/>
          <ParamRow label="Margem padrão" value="32%" mono/>
          <ParamRow label="Comissão padrão vendedor" value="4%" mono/>
          <ParamRow label="ICMS padrão (SP)" value="18%" mono/>
          <ParamRow label="II padrão equipamentos" value="14%" mono/>
        </div>
      </Card>
      <Card title="Parâmetros Operacionais" sharp>
        <div className="stack">
          <ParamRow label="SLA visita técnica" value="5 dias úteis"/>
          <ParamRow label="SLA laudo engenharia" value="4 dias úteis"/>
          <ParamRow label="Tempo médio importação" value="55 dias"/>
          <ParamRow label="Validade padrão proposta" value="30 dias"/>
          <ParamRow label="Garantia padrão" value="24 meses fab + 12 meses serv."/>
          <ParamRow label="Reten. inst. (calendário)" value="1 obra/equipe simultânea"/>
        </div>
      </Card>
    </div>
  );
}

function ParamRow({ label, value, mono }) {
  return (
    <div className="row sb" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--fg2)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : "inherit", fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  );
}

function ConfigIntegrations() {
  /* O frontend não monitora a saúde real de cada serviço externo — em vez de
     exibir "Ativo" fixo (falsa sensação de controle), listamos as integrações
     previstas como "Não configurado". A ativação real é feita no ambiente. */
  const integrations = [
    { name: "Rastreamento marítimo (AIS)", desc: "Edge function ais-sync — posição de navios" },
    { name: "IMAP — cotacoes@verticalparts.com.br", desc: "Inbox Importação" },
    { name: "IMAP — compras@verticalparts.com.br", desc: "Inbox Compras Nacional" },
    { name: "SMTP — envio transacional", desc: "Notificações e propostas" },
    { name: "Assinatura digital", desc: "Assinatura de contratos e propostas" },
    { name: "Omie (faturamento)", desc: "Sincronização NF / contas a receber" },
    { name: "WhatsApp Business API", desc: "Notificações para vendedores" },
  ];
  return (
    <Card title="Integrações Externas" sub="status não é monitorado automaticamente — configure cada serviço no ambiente de deploy">
      <div className="grid-2" style={{ gap: 12 }}>
        {integrations.map((i) => (
          <div key={i.name} style={{ padding: 14, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "var(--vp-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg3)" }}>
              {React.createElement(Icon.globe, { size: 18 })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row sb">
                <span style={{ fontWeight: 700, fontSize: 13 }}>{i.name}</span>
                <Badge variant="neutral" dot>Não configurado</Badge>
              </div>
              <div className="cell-sub" style={{ marginTop: 2 }}>{i.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConfigBuckets() {
  /* Buckets reais do projeto Supabase (jxtqwzmpgofwctqajewt). */
  const buckets = [
    { name: "engenharia", policy: "Público", desc: "Fotos/docs de engenharia e documentos da obra (Dossiê)" },
    { name: "tratativas", policy: "Público", desc: "Anexos das tratativas com fornecedor" },
    { name: "cotacao-fornecedor-anexos", policy: "Privado", desc: "Anexos das cotações a fornecedor" },
    { name: "formulario-elevador-anexos", policy: "Privado", desc: "Anexos do Formulário de Elevadores" },
    { name: "propostas-imagens", policy: "Privado", desc: "Imagens das propostas comerciais" },
    { name: "fichas-imagens", policy: "Privado", desc: "Imagens das fichas técnicas" },
  ];
  return (
    <Card title="Supabase Storage Buckets" sub={`${buckets.length} buckets reais no ambiente`}>
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t">
          <thead><tr><th>Bucket</th><th>Uso</th><th>Acesso</th></tr></thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.name}>
                <td><span className="mono" style={{ fontWeight: 700 }}>{b.name}</span></td>
                <td><span className="cell-sub">{b.desc}</span></td>
                <td><Badge variant={b.policy === "Público" ? "warning" : "success"} dot>{b.policy}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

Object.assign(window, { FinanceiroPage, ComissoesPage, NotificacoesPage, ConfiguracoesPage });
