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
  const [filtroCadeia, setFiltroCadeia] = React.useState(null);   // null = escolhe sozinho (atrasadas, se houver)
  const [buscaCadeia, setBuscaCadeia] = React.useState('');

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
    /* 23/08 (achado real, Gelson): cotação 903 tem o nó "Financeiro
       precificando" fechado, mas nasceu via garantirNo (backfill retroativo
       de etapa pulada) — nunca existiu precificacoes_elevador de verdade.
       Sem essa checagem o clique caía direto na lista genérica sem
       explicação. Nó com resolverSubsel que não achou nada = ser honesto,
       não fingir que existe documento. */
    if (alvo.subsel === null) {
      const node = window.GatilhosEngine.NODES.find(
        (n) => n.key === String(g.evento_key || '').replace(/^LEMBRETE__/, '')
      );
      if (node?.resolverSubsel) {
        alert('Não há documento real para esta etapa — provavelmente foi registrada retroativamente (etapa pulada no fluxo) e nunca teve um documento gerado de verdade.');
        return;
      }
    }
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
    /* Vistorias não agendadas dentro do prazo (23/08) — mesmo padrão sem
       cron, roda toda vez que a tela abre. Não altera `rows`, só gera
       alertas em `alertas` (recarregados por reloadAlertas logo abaixo). */
    if (window.InstalacaoObraStore) window.InstalacaoObraStore.verificarPrazoVistorias().then(() => reloadAlertas());
    /* Gatilhos manuais gravam days_left como número fixo na criação
       (ver ModalNovoGatilho.save) e nada recalculava depois — "vence em
       Xd"/"atrasado há Xd" e os KPIs de 7d/atrasados ficavam desatualizados
       com o passar do tempo. Recalcula aqui, a cada carregamento da tela,
       a partir de due_date — mesmo padrão que os gatilhos automáticos já
       usam (recalculam via GanttBarMini/labelPrazo a cada render). Não
       grava de volta no banco: é só a leitura que passa a ser fresca. */
    rows = rows.map((g) => (
      g.origem !== 'automatico' && g.due_date
        ? { ...g, days_left: Math.round((new Date(g.due_date) - new Date()) / 86400000) }
        : g
    ));
    setGatilhos(rows);
    setLoading(false);
  };
  const reloadAlertas = () => {
    // Mesma regra de destinatário da Central de Notificações: alerta dirigido a uma pessoa não aparece para as outras.
    const emailAlertas = (window.__VP_USER || {}).email || null;
    const baseAlertas = window.__VP_SB.sb.from('alertas').select('*').eq('resolved', false);
    (emailAlertas ? baseAlertas.or(`destinatario_email.is.null,destinatario_email.eq.${emailAlertas}`) : baseAlertas.is('destinatario_email', null))
      .order('created_at', { ascending: false })
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

  /* Resumo de cada cadeia: o que está atrasado, o que é só rascunho de formulário
     e o que já terminou. Etapas "opcionais" (score/aval de venda) e lembretes não
     contam como pendência. */
  const E = window.GatilhosEngine;
  const resumoDaCadeia = (nos) => {
    const principais = nos.filter(g => !String(g.evento_key || '').startsWith('LEMBRETE__'));
    const encerrada = principais.some(g => g.status === 'encerrado');
    const abertos = principais.filter(g => !g.concluido_em && !(E?.nodeByKey(g.evento_key)?.opcional));
    const atrasadas = E ? abertos.filter(g => E.emAtraso(g)) : [];
    const maxAtrasoMs = atrasadas.reduce((m, g) => Math.max(m, Date.now() - E.prazoEfetivo(g).getTime()), 0);
    const soFormulario = principais.length > 0 && principais.every(g => g.evento_key === 'FORMULARIO');
    const tipo = encerrada ? 'encerrada'
      : abertos.length === 0 ? 'concluida'
      : atrasadas.length ? 'atrasada'
      : soFormulario ? 'rascunho'
      : 'andamento';
    return { tipo, atrasadas, abertos, maxAtrasoMs };
  };
  const cadeias = Object.entries(cadeiasPorCotacao).map(([numero, nos]) => ({ numero, nos, ...resumoDaCadeia(nos) }));
  const contagem = cadeias.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {});
  const filtroAtivo = filtroCadeia || (contagem.atrasada ? 'atrasada' : 'andamento');
  const termoCadeia = buscaCadeia.trim().replace(/\D/g, '');
  const cadeiasVisiveis = cadeias
    .filter(c => filtroAtivo === 'todas' || (filtroAtivo === 'fim' ? ['concluida', 'encerrada'].includes(c.tipo) : c.tipo === filtroAtivo))
    .filter(c => !termoCadeia || String(c.numero).includes(termoCadeia))
    .sort((a, b) => (b.maxAtrasoMs - a.maxAtrasoMs) || (Number(b.numero) - Number(a.numero)));
  const etapasAtrasadas = cadeias.reduce((n, c) => n + c.atrasadas.length, 0);

  /* Exporta TODAS as etapas (cadeias automáticas + avulsos), não só os avulsos. */
  const exportarFluxo = () => {
    const f = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '');
    const linhasAuto = automaticos.map(g => {
      const prazo = E?.prazoEfetivo(g);
      return { cotacao: g.numero_cotacao, etapa: g.trigger_name, nasceu: f(g.nascido_em), prazo: f(prazo), concluida: f(g.concluido_em),
        situacao: g.status === 'encerrado' ? 'encerrada' : g.concluido_em ? (E?.ehRetroativo(g) ? 'registrada retroativamente' : 'concluída') : (E?.emAtraso(g) ? 'atrasada' : 'em andamento'),
        origem: 'automático' };
    });
    const linhasManuais = manuais.map(g => ({ cotacao: g.projeto || g.project_id || '', etapa: `${g.trigger || g.trigger_name || ''} — ${g.building || ''}`, nasceu: '',
      prazo: g.due_date || '', concluida: f(g.concluido_em), situacao: g.concluido_em ? 'concluída' : (g.days_left < 0 ? 'atrasada' : 'em andamento'), origem: 'avulso' }));
    window.csvDownload([...linhasAuto, ...linhasManuais], 'prazos-e-pendencias.csv');
  };

  /* Alerta clicado: abre o link gravado em `alertas.rota` (mesma regra da Central
     de Notificações); sem link, cai na Central. */
  const abrirAlerta = (a) => {
    const NP = window.NotificacoesProcessamento;
    const url = NP && NP.urlSegura(a.rota, window.VpRouter && window.VpRouter.isKnownRoute);
    if (url) { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); return; }
    setRoute?.('notificacoes');
  };
  const alertasPrincipais = [...alertas]
    .sort((a, b) => (['danger', 'critical', 'warning'].includes(b.level) ? 1 : 0) - (['danger', 'critical', 'warning'].includes(a.level) ? 1 : 0))
    .slice(0, 6);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Geral · Prazos</div>
          <h1 className="page-head__title">Prazos & Pendências</h1>
          <p className="page-head__sub">Cada etapa nasce ao concluir a anterior, por Nº da Cotação. Prazos contam só segunda a sexta (exceto espera do cliente e embarque).</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="download" onClick={exportarFluxo}>Exportar fluxo</Button>
          <Button variant="primary" icon="plus" onClick={() => setShowGatilho(true)}>Novo gatilho</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Cotações em andamento" value={(contagem.andamento || 0) + (contagem.atrasada || 0)} sub="já passaram do formulário, não encerradas" delta="—" deltaDir="up" icon="zap"/>
        <KPI label="Com prazo estourado" value={contagem.atrasada || 0} sub={`${etapasAtrasadas} etapa(s) atrasada(s)`} delta="—" deltaDir="down" icon="warning"/>
        <KPI label="Ação do Financeiro pendente" value={automaticos.filter(g => ['AGUARDA_BOLETO', 'AVAL_PAGAMENTO'].includes(g.evento_key) && !g.concluido_em).length} sub="boleto ou aval de pagamento" delta="—" deltaDir="up" icon="dollar"/>
        <KPI label="Formulários sem envio" value={contagem.rascunho || 0} sub="salvos, ainda não enviados ao fornecedor" delta="—" deltaDir="up" icon="clock"/>
      </div>

      {contagem.atrasada > 0 && (
        <div className="alert danger" style={{ marginBottom: 20 }}>
          <Icon.warning/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">{contagem.atrasada} cotaç{contagem.atrasada > 1 ? 'ões' : 'ão'} com etapa atrasada</div>
            <div className="alert__sub">{etapasAtrasadas} etapa(s) passaram do prazo — a mais antiga está no topo da lista abaixo. Um aviso diário é enviado à Central de Notificações.</div>
          </div>
          <Button variant="secondary" size="sm" iconRight="arrowRight" onClick={() => { setFiltroCadeia('atrasada'); document.getElementById('cadeia-gatilhos-cotacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Ver atrasadas</Button>
        </div>
      )}

      {urgentes.length > 0 && (
        <div className="alert danger" style={{ marginBottom: 20 }}>
          <Icon.warning/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">{urgentes.length} gatilho{urgentes.length > 1 ? 's' : ''} vence{urgentes.length === 1 ? '' : 'm'} em até 2 dias</div>
            <div className="alert__sub">Verifique os gatilhos abaixo e confirme os pagamentos pendentes.</div>
          </div>
          <Button variant="secondary" size="sm" iconRight="arrowRight" onClick={() => document.getElementById('cadeia-gatilhos-cotacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver agora</Button>
        </div>
      )}

      <Card title="Alertas recentes" sub="os que mais pedem atenção — o resto está em Notificações" style={{ marginBottom: 20 }}
        action={<Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setRoute?.("notificacoes")}>Ver tudo ({alertas.length})</Button>}>
        <div className="stack">
          {alertas.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhum alerta pendente.
            </div>
          )}
          {alertasPrincipais.map((a) => (
            <AlertRow key={a.id} alert={a} onClick={() => abrirAlerta(a)}/>
          ))}
        </div>
      </Card>

      <Card id="cadeia-gatilhos-cotacao" title="Cadeia de etapas por Cotação" sub={`${cadeiasVisiveis.length} de ${cadeias.length} cotações · Formulário → Compra liberada · mais atrasadas primeiro`} style={{ marginBottom: 20 }}>
        <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          {[['atrasada', 'Atrasadas'], ['andamento', 'Em andamento'], ['rascunho', 'Formulário sem envio'], ['fim', 'Concluídas/Encerradas'], ['todas', 'Todas']].map(([k, label]) => {
            const n = k === 'todas' ? cadeias.length : k === 'fim' ? (contagem.concluida || 0) + (contagem.encerrada || 0) : (contagem[k] || 0);
            return (
              <Button key={k} size="sm" variant={filtroAtivo === k ? 'primary' : 'outline'} onClick={() => setFiltroCadeia(k)}>{label} ({n})</Button>
            );
          })}
          <input className="input" style={{ maxWidth: 160, marginLeft: 'auto' }} placeholder="Buscar Nº da cotação"
            value={buscaCadeia} onChange={(e) => setBuscaCadeia(e.target.value)}/>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          {cadeias.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhuma cadeia automática ainda — nasce ao preencher o primeiro Formulário de Elevador.
            </div>
          )}
          {cadeias.length > 0 && cadeiasVisiveis.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
              Nenhuma cotação neste filtro.
            </div>
          )}
          {cadeiasVisiveis.map((c) => (
            <CadeiaGatilhosCotacao key={c.numero} numeroCotacao={c.numero} nos={c.nos}
              onConfirmarSinal={setConfirmarSinalDe} onConfirmarAval={setConfirmarAvalDe}
              onFecharLembrete={fecharLembrete} onAbrirGatilho={abrirGatilho} onFecharComMotivo={reloadGatilhos}/>
          ))}
        </div>
      </Card>

      {manuais.length > 0 && (
        <Card title="Gatilhos Financeiros Avulsos" sub={`${manuais.length} registros cadastrados manualmente`}>
          <div className="stack" style={{ gap: 14 }}>
            {manuais.map((g) => (
              <GatilhoCard key={g.id} g={g} onSaved={reloadGatilhos}/>
            ))}
          </div>
        </Card>
      )}
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

/* "levou 2h" / "levou 3d 4h" — tempo REAL que uma etapa concluída levou,
   registrado depois do fato (nascido_em → concluido_em). Sem SLA nenhum
   envolvido — decisão de 23/08: nada de prazo previsto pras etapas novas,
   só o fato consumado. Depois de 4-6 casos reais dá pra pensar em prazo
   fixo; hoje é só observação. */
function fmtDuracao(ms) {
  if (ms == null || ms < 0) return null;
  const horas = ms / 3600000;
  if (horas < 1) return `${Math.max(1, Math.round(ms / 60000))}min`;
  if (horas < 24) return `${Math.round(horas)}h`;
  const totalHoras = Math.round(horas);       // arredonda ANTES de dividir (senão saía "15d 24h")
  const dias = Math.floor(totalHoras / 24);
  const restoHoras = totalHoras % 24;
  return restoHoras > 0 ? `${dias}d ${restoHoras}h` : `${dias}d`;
}

/* Modal de fechamento manual — hoje só usado pelo "Cemitério" (Aguardando
   Cliente parado há mais de 10 dias, ver SLA_HORAS.AGUARDA_CLIENTE em
   gatilhos-engine.js). Só o cliente tem poder de matar o fluxo (decisão
   de 23/08) — este botão é o vendedor registrando o que descobriu por
   fora (ligou, sumiu, concorrente, etc.), nunca um fechamento automático. */
function ModalFecharComMotivo({ g, onClose, onSaved }) {
  const [motivo, setMotivo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    if (!motivo.trim()) return window.toast('Descreva o motivo antes de fechar.', 'warning');
    setSalvando(true);
    try {
      await window.GatilhosEngine.fecharComMotivo(g.id, motivo);
      window.toast('Ciclo encerrado.', 'success');
      onSaved?.();
    } catch (e) {
      window.toast('Erro: ' + (e.message || e), 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title="Fechar ciclo com motivo" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Encerrar ciclo'}</Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <div className="small muted">{g.trigger_name} — Cotação Nº {g.numero_cotacao}</div>
        <label className="up-eyebrow muted">O que aconteceu?</label>
        <textarea className="input" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: cliente não responde há 3 semanas, liguei e caiu na caixa postal duas vezes…" autoFocus/>
      </div>
    </Modal>
  );
}

/* ---------- Cadeia automática (GatilhosEngine) ----------
   Fechada: uma linha-resumo por cotação (clicável, mini-Gantt do nó
   atual). Aberta: percorre as 47 etapas da engine (não só as que já
   nasceram na tabela `gatilhos`) — decisão de 23/08: a cadeia inteira
   fica sempre visível, concluídas mostram tempo real que levaram, a(s)
   etapa(s) atual(is) ficam destacadas, e o resto aparece opaco (sem
   número inventado) até chegar a vez. Etapas com `fecha: null` (sem
   ponto de ação real no código ainda, ver gatilhos-engine.js) ganham
   rótulo "sem rastreio automático" em vez de fingir monitoramento. */
function CadeiaGatilhosCotacao({ numeroCotacao, nos, onConfirmarSinal, onConfirmarAval, onFecharLembrete, onAbrirGatilho, onFecharComMotivo, defaultOpen }) {
  const [aberta, setAberta] = React.useState(!!defaultOpen);
  const [fechandoMotivo, setFechandoMotivo] = React.useState(null);
  const engine = window.GatilhosEngine;
  const NODES = engine?.NODES || [];

  const principais = nos.filter(g => !String(g.evento_key || '').startsWith('LEMBRETE__'))
    .sort((a, b) => new Date(a.nascido_em || 0) - new Date(b.nascido_em || 0));
  const lembretesPorPai = nos.filter(g => String(g.evento_key || '').startsWith('LEMBRETE__'))
    .reduce((acc, g) => { (acc[g.predecessor_id] = acc[g.predecessor_id] || []).push(g); return acc; }, {});
  const porChave = principais.reduce((acc, g) => { acc[g.evento_key] = g; return acc; }, {});

  const ehOpcional = (g) => !!(engine?.nodeByKey(g.evento_key)?.opcional);
  const encerrada = principais.some(g => g.status === 'encerrado');
  const pendentes = principais.filter(g => !g.concluido_em && !ehOpcional(g));
  const concluida = principais.length > 0 && pendentes.length === 0;
  const noAtual = pendentes[0] || principais[principais.length - 1];
  const atrasada = !encerrada && pendentes.some(g => engine?.emAtraso(g));
  const statusLabel = encerrada ? 'Encerrada' : concluida ? 'Concluída' : atrasada ? 'Atrasada' : 'Em andamento';
  const statusVariant = encerrada ? 'neutral' : concluida ? 'success' : atrasada ? 'danger' : 'warning';

  return (
    <div>
      <div className="row sb" style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => setAberta((v) => !v)}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <Icon.chevRight size={12} style={{ transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
          <div className="up-eyebrow muted">Cotação Nº {numeroCotacao}</div>
          {!aberta && noAtual && (
            <>
              <span className="small muted">{engine?.nodeByKey(noAtual.evento_key)?.label || noAtual.trigger_name}</span>
              <GanttBarMini nascidoEm={noAtual.nascido_em} prazoEm={engine?.prazoEfetivo(noAtual) || noAtual.prazo_em} concluidoEm={noAtual.concluido_em} encerrado={encerrada}/>
            </>
          )}
        </div>
        <Badge variant={statusVariant} dot>{statusLabel}</Badge>
      </div>

      {aberta && (
        <div style={{ marginTop: 8, marginLeft: 20 }}>
          {NODES.map((node) => {
            const g = porChave[node.key];
            const nivel = engine ? engine.profundidade(node.key) : 0;
            const semAutomacao = node.fecha == null;

            /* Etapa futura — ainda não nasceu na tabela `gatilhos`.
               Aparece opaca, sem número de prazo inventado. */
            if (!g) {
              return (
                <div key={node.key} className="row gap-2" style={{
                  alignItems: 'center', padding: '5px 8px', marginLeft: nivel * 20, opacity: 0.4,
                }}>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 700, width: 20 }}>{(node.predecessores[0] || {}).rel || 'FS'}</span>
                  <span className="small" style={{ flex: 1 }}>{node.label}</span>
                  {semAutomacao && <span className="mono" style={{ fontSize: 9 }}>sem rastreio automático</span>}
                </div>
              );
            }

            const isOpen = !g.concluido_em && !ehOpcional(g);
            const retroativo = engine?.ehRetroativo(g);
            const cemiterio = isOpen && g.status === 'revisao_necessaria';
            const podeConfirmarSinal = g.evento_key === 'AGUARDA_BOLETO' && isOpen;
            const podeConfirmarAval = g.evento_key === 'AVAL_PAGAMENTO' && isOpen;
            const lembretes = lembretesPorPai[g.id] || [];
            const clicavel = !!node.rota;
            const duracao = g.concluido_em && g.nascido_em ? fmtDuracao(new Date(g.concluido_em) - new Date(g.nascido_em)) : null;
            const cor = cemiterio ? 'var(--vp-warning)' : g.status === 'encerrado' ? 'var(--fg3)' : g.concluido_em ? 'var(--vp-success)' : 'var(--fg1)';
            const diasParado = cemiterio && g.nascido_em ? Math.floor((Date.now() - new Date(g.nascido_em).getTime()) / 86400000) : null;

            return (
              <div key={g.id}>
                <div className="row gap-2" style={{
                  alignItems: 'center', padding: '6px 8px', marginLeft: nivel * 20,
                  borderLeft: nivel > 0 ? '2px solid var(--border)' : 'none',
                  background: isOpen && !cemiterio ? 'var(--vp-gray-50)' : 'transparent',
                  cursor: clicavel ? 'pointer' : 'default',
                }} onClick={clicavel ? () => onAbrirGatilho(g) : undefined} title={clicavel ? 'Abrir' : undefined}>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg3)', width: 20 }}>{g.tipo_relacionamento || 'FS'}</span>
                  <span className="small" style={{ color: cor, fontWeight: isOpen ? 700 : 400, flex: 1 }}>
                    {node.label}{ehOpcional(g) && !g.concluido_em ? ' (opcional — não trava o fluxo)' : ''}
                    {g.status === 'encerrado' && g.motivo_fechamento ? ` — encerrado: "${g.motivo_fechamento}"` : g.status === 'encerrado' ? ' — encerrado' : ''}
                  </span>
                  {g.concluido_em ? (
                    <span className="mono small" style={{ color: cor, whiteSpace: 'nowrap' }}>
                      {g.status === 'encerrado' ? (g.motivo_fechamento ? 'fechado manualmente' : 'encerrado') : retroativo ? 'etapa pulada · registrada retroativamente' : duracao ? `concluído · levou ${duracao}` : 'concluído'}
                    </span>
                  ) : cemiterio ? (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setFechandoMotivo(g); }}>Fechar com motivo</Button>
                  ) : (
                    <GanttBarMini nascidoEm={g.nascido_em} prazoEm={engine?.prazoEfetivo(g) || g.prazo_em} concluidoEm={null} comLabel/>
                  )}
                  {podeConfirmarSinal && (
                    <Button size="sm" variant="primary" icon="check"
                      onClick={(e) => { e.stopPropagation(); onConfirmarSinal(g); }}>Boleto pago</Button>
                  )}
                  {podeConfirmarAval && (
                    <Button size="sm" variant="primary" icon="check"
                      title="Libera a compra ao fornecedor (junto com o Aval Jurídico). Não é o aval de venda/score." onClick={(e) => { e.stopPropagation(); onConfirmarAval(g); }}>Dar Aval de Pagamento</Button>
                  )}
                </div>
                {cemiterio && (
                  <div style={{ marginLeft: (nivel + 1) * 20, padding: '4px 8px', fontSize: 11, color: 'var(--vp-warning)' }}>
                    ⚠ Parado há {diasParado} dia{diasParado === 1 ? '' : 's'} sem resposta do cliente — investigue e feche o ciclo, ou deixe em aberto se ainda faz sentido esperar.
                  </div>
                )}
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

      {fechandoMotivo && (
        <ModalFecharComMotivo g={fechandoMotivo} onClose={() => setFechandoMotivo(null)}
          onSaved={() => { setFechandoMotivo(null); onFecharComMotivo?.(); }}/>
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
          Checkpoint manual do Financeiro depois do sinal pago. Junto com o Aval Jurídico
          (manual) e o contrato assinado, libera a compra ao Fornecedor.
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
  const [archivedIds, setArchivedIds] = React.useState([]);
  const [prefs, setPrefs] = React.useState(() => window.NotificacoesLidasStore.lerPreferencias());
  const filters = ["Todas", "Não lidas", "Arquivadas"];
  const NP = window.NotificacoesProcessamento;
  const LidasStore = window.NotificacoesLidasStore;

  // Busca de alertas e leitura do estado "lido" são independentes: carregar
  // uma não deve refazer a outra (candidato 2 da revisão de arquitetura —
  // antes o estado "lido" vinha do localStorage embutido na própria busca
  // de alertas, e reabria a query toda vez que uma notificação era marcada).
  React.useEffect(() => {
    setLoading(true);
    // A leitura (globais + dirigidos ao e-mail + sintéticos do Dashboard) fica no store, a MESMA que o sino do cabeçalho usa.
    LidasStore.carregarAlertas()
      .then((lista) => { setAlertasRaw(lista); setLoading(false); })
      .catch((err) => { window.toast('Erro ao carregar notificações: ' + (err.message || err), 'error'); setAlertasRaw([]); setLoading(false); });
  }, []);

  React.useEffect(() => { LidasStore.carregarEstado().then((e) => { setReadIds(e.lidas); setArchivedIds(e.arquivadas); }); }, []);

  // Preferências mudadas no modal (ou em outra aba do app) refletem aqui sem recarregar.
  React.useEffect(() => {
    const h = () => setPrefs(LidasStore.lerPreferencias());
    window.addEventListener('vp:notificacoes', h);
    return () => window.removeEventListener('vp:notificacoes', h);
  }, []);

  const markRead = (id) => {
    const idStr = String(id);
    if (readIds.includes(idStr)) return;
    setReadIds((prev) => [...prev, idStr]);
    LidasStore.marcarLida(id);
  };
  const markAllRead = () => {
    const ids = notificationsVisiveis.map((n) => String(n.id));
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
    LidasStore.marcarTodasLidas(ids);
    window.toast("Notificações marcadas como lidas", "success");
  };
  // Arquivar/restaurar é POR PESSOA (some só da lista de quem arquivou). Arquivar também conta como lida.
  const archive = async (ids) => {
    const strs = ids.map(String);
    setArchivedIds((prev) => Array.from(new Set([...prev, ...strs])));
    setReadIds((prev) => Array.from(new Set([...prev, ...strs])));
    const ok = await LidasStore.arquivar(strs);
    if (!ok) setArchivedIds((prev) => prev.filter((x) => !strs.includes(x)));
    else window.toast(strs.length > 1 ? `${strs.length} notificações arquivadas` : 'Notificação arquivada', 'success');
  };
  const restore = async (ids) => {
    const strs = ids.map(String);
    setArchivedIds((prev) => prev.filter((x) => !strs.includes(x)));
    const ok = await LidasStore.desarquivar(strs);
    if (!ok) setArchivedIds((prev) => Array.from(new Set([...prev, ...strs])));
    else window.toast('Notificação restaurada', 'success');
  };

  // Todas as notificações respeitando as Preferências; "ativas" = sem as arquivadas desta pessoa.
  const notificationsPref = NP.processarAlertas(alertasRaw, readIds).filter((n) => NP.visivelPorPreferencia(n, prefs));
  const notificationsVisiveis = notificationsPref.filter((n) => !archivedIds.includes(String(n.id)));
  const notifications = filter === "Arquivadas" ? notificationsPref.filter((n) => archivedIds.includes(String(n.id))) : notificationsVisiveis;
  const naoLidasCount = NP.naoLidas(notificationsVisiveis).length;
  // Avisa o sino do cabeçalho na hora (sem esperar o intervalo de 5 min).
  React.useEffect(() => { if (!loading) LidasStore.avisar({ naoLidas: naoLidasCount }); }, [naoLidasCount, loading]);
  const modules = ["Todos", ...Array.from(new Set(notifications.map(n => n.module))).sort()];
  const rows = notifications.filter(n => {
    if (filter === "Não lidas" && !n.unread) return false;
    if (moduleFilter !== "Todos" && n.module !== moduleFilter) return false;
    return true;
  });
  const archiveReadVisible = () => archive(notificationsVisiveis.filter((n) => !n.unread).map((n) => n.id));
  const groups = NP.agruparPorPeriodo(rows);
  const openNotification = (n) => {
    markRead(n.id);
    // Link composto (alertas.rota, ex.: /logistica/almoxarifado/reposicao): abre a aba certa. Passa pelo roteador por URL
    // (pushState + popstate, como o Voltar do navegador), e só aceita caminho relativo de rota conhecida (urlSegura).
    const url = NP.urlSegura(n.rota, window.VpRouter && window.VpRouter.isKnownRoute);
    if (url) {
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    setRoute(NP.rotaPara(n.module));
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Central</div>
          <h1 className="page-head__title">Notificações</h1>
          <p className="page-head__sub">{naoLidasCount} não lida(s) · agrupadas por período · arquivar tira da sua lista (os alertas somem sozinhos depois de 14 dias, ou 45 se forem avisos/críticos)</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="settings" onClick={() => setPrefsOpen(true)}>Preferências</Button>
          <Button variant="outline" icon="x" onClick={archiveReadVisible} disabled={!notificationsVisiveis.some((n) => !n.unread)}>Arquivar lidas</Button>
          <Button variant="primary" icon="check" onClick={markAllRead} disabled={!naoLidasCount}>Marcar todas como lidas</Button>
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
                    {filter === "Arquivadas"
                      ? <Button variant="ghost" size="sm" aria-label="Restaurar" onClick={(e) => { e.stopPropagation(); restore([n.id]); }}>Restaurar</Button>
                      : <>
                          <Button variant="ghost" size="sm" icon="check" aria-label="Marcar como lida" disabled={!n.unread}
                            onClick={(e) => { e.stopPropagation(); markRead(n.id); window.toast('Notificação marcada como lida', 'success'); }}/>
                          <Button variant="ghost" size="sm" icon="x" aria-label="Arquivar"
                            onClick={(e) => { e.stopPropagation(); archive([n.id]); }}/>
                        </>}
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
          {archivedIds.includes(String(details.id))
            ? <Button variant="ghost" onClick={() => { restore([details.id]); setDetails(null); }}>Restaurar</Button>
            : <Button variant="ghost" onClick={() => { archive([details.id]); setDetails(null); }}>Arquivar</Button>}
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
  // Preferências REAIS: a Central e o contador do sino leem esta mesma configuração (NotificacoesLidasStore). Ficam neste
  // navegador. Jurídico e Central de Decisões nunca são ocultados. (Antes: "Resumo por e-mail" e "Alertas no sistema" eram
  // chaves salvas que nada lia — removidas; não existe envio de resumo por e-mail.)
  const [prefs, setPrefs] = React.useState(() => window.NotificacoesLidasStore.lerPreferencias());
  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));
  const save = () => {
    window.NotificacoesLidasStore.salvarPreferencias(prefs);
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
        <div className="muted" style={{ fontSize: 12 }}>Escolha o que aparece na Central e no contador do sino (vale só neste navegador). Jurídico e Central de Decisões sempre aparecem.</div>
        {row('financeiro', 'Financeiro', 'Avais, estouro de teto, comissões e pagamentos.')}
        {row('operacoes', 'Operações', 'Importação, Engenharia, Almoxarifado/PCP e instalação.')}
        {row('comercial', 'Comercial', 'Propostas, cotações a fornecedor e compras.')}
      </div>
    </Modal>
  );
}

/* ---------- CONFIGURAÇÕES ---------- */
function ConfiguracoesPage() {
  /* Aba inicial vem da URL quando é deep link (ex.: .../admin/configuracoes/permissoes)
     — mesmo padrão de dossier-obra.jsx. "configuracoes" não tem id de
     registro (não é uma tela de detalhe), então o 2º segmento da URL é
     usado como identificador da aba em vez de um id de banco. */
  const [tab, setTab] = React.useState(() =>
    (window.VpRouter && window.VpRouter.parseLocation().id) || "usuarios");

  /* Espelha a aba ativa na URL — replace (não push) pra não lotar o
     histórico a cada clique de aba. Roda independente do efeito de
     sincronização de rota em app.jsx (que não reage a mudança de aba). */
  React.useEffect(() => {
    if (!window.VpRouter) return;
    window.VpRouter.navigate('configuracoes', tab, null, { replace: true });
  }, [tab]);

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
                  <td><Button variant="ghost" size="sm" icon="more" disabled title="Em desenvolvimento — ações do usuário ainda não implementadas"/></td>
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
    <>
      <ConfigAlcadasPropostas/>
      <div style={{ marginTop: 16 }}>
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
      </div>
    </>
  );
}

/* Alçadas de Propostas — sistema genérico e delegável (pedido do usuário,
   19/08): nada de lista de e-mail fixa no código. Administrador sempre tem
   tudo (perfis.nivel); qualquer outra pessoa só tem o que estiver marcado
   em alcadas_capacidade. "Conceder alçadas" é recursiva — quem tem essa
   capacidade pode dar QUALQUER uma das 4, inclusive essa mesma, pra
   qualquer pessoa (assim Diego/Gelson repassam o poder sem precisar de
   código novo). Card só aparece pra quem já tem essa capacidade — não é
   um ajuste que qualquer um com acesso a Configurações consiga mexer. */
const ALCADAS_PROPOSTAS = [
  { modulo: 'propostas', capacidade: 'ver_todas', label: 'Vê todas as propostas', hint: 'Sem isso, só vê as próprias.' },
  { modulo: 'propostas', capacidade: 'precificar_manual', label: 'Precifica manualmente', hint: 'Preço combinado por fora (CEO/Financeiro), sem depender de Cotação + Precificação formal.' },
  { modulo: 'propostas', capacidade: 'destravar_aprovada', label: 'Destrava proposta aprovada', hint: 'Reabre pra edição uma proposta já aprovada pelo cliente.' },
  { modulo: 'propostas', capacidade: 'excluir', label: 'Exclui propostas', hint: 'Apaga a proposta de vez — sem volta.' },
  { modulo: 'admin', capacidade: 'conceder_alcadas', label: 'Concede alçadas', hint: 'Pode dar (ou tirar) qualquer uma destas capacidades pra qualquer pessoa.' },
  { modulo: 'quadro_comando', capacidade: 'decidir_fabricacao', label: 'Decide fabricar interno ou comprar pronto (Quadro de Comando)', hint: 'Sem isso, a Origem de Fabricação do Quadro de Comando fica travada em "Fabricar interno".' },
  { modulo: 'instalacao', capacidade: 'editar_status_obra', label: 'Edita status do Acompanhamento de Obra', hint: 'Pode desflegar uma atividade do Diário de Obra e avançar/reverter manualmente o status do card em Cadastro de Instaladores.' },
  { modulo: 'decisoes', capacidade: 'ceo', label: 'Atua como CEO (Central de Decisões)', hint: 'Aprova/reprova qualquer decisão que hoje só o CEO decide (envio de proposta, desconto acima de 7%, etc.), além do e-mail fixo do Diego — uso normal: só pra teste. Só vale pra decisões criadas depois de conceder.' },
  { modulo: 'decisoes', capacidade: 'gestor_comercial', label: 'Atua como Gestor Comercial (Central de Decisões)', hint: 'Aprova/reprova qualquer decisão que hoje só o Gestor Comercial decide (liberar envio de proposta ao cliente, desconto até 7%, pagamento de parcela ao instalador), além dos e-mails fixos de Regiane/Guilherme. Só vale pra decisões criadas depois de conceder.' },
];

function ConfigAlcadasPropostas() {
  const sb = window.__VP_SB.sb;
  const [autorizado, setAutorizado] = React.useState(null);
  const [perfis, setPerfis] = React.useState(null);
  const [concedidas, setConcedidas] = React.useState({});
  const [salvandoChave, setSalvandoChave] = React.useState(null);

  const load = React.useCallback(async () => {
    const pode = await window.PropostaStore.podeConcederAlcadas();
    setAutorizado(pode);
    if (!pode) return;
    const { perfis: p, concedidas: c } = await window.PropostaStore.listarAlcadas();
    setPerfis(p);
    const map = {};
    c.forEach((row) => { map[row.perfil_id + '.' + row.modulo + '.' + row.capacidade] = true; });
    setConcedidas(map);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const alternar = async (perfil, modulo, capacidade, conceder) => {
    const chave = perfil.id + '.' + modulo + '.' + capacidade;
    setSalvandoChave(chave);
    try {
      await window.PropostaStore.concederAlcada(perfil.id, modulo, capacidade, conceder);
      if (window.VPLog) window.VPLog.registrar({ modulo: 'Admin', acao: 'Alçada alterada', alvo: perfil.email, detalhe: { modulo, capacidade, conceder } });
      setConcedidas((prev) => { const n = { ...prev }; if (conceder) n[chave] = true; else delete n[chave]; return n; });
    } catch (e) {
      window.toast?.('Erro: ' + (e.message || e), 'error');
    } finally {
      setSalvandoChave(null);
    }
  };

  if (autorizado === null || (autorizado && !perfis)) {
    return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;
  }
  if (!autorizado) {
    return (
      <Card title="Alçadas de Propostas">
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg3)', fontSize:13 }}>
          Você não tem a alçada "Concede alçadas" — peça pra quem já tem liberar essa tela pra você.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Alçadas de Propostas" sub="Quem pode ver tudo, precificar manualmente, destravar aprovada ou conceder essas alçadas pra outros">
      <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--vp-warning-tint, #f8eed7)", border: "1px solid var(--border)", fontSize: 12, color: "var(--fg2)" }}>
        Administradores sempre têm as 4 primeiras alçadas (traço = já tem, automático). <b>"Atua como CEO" e "Atua como Gestor Comercial" são diferentes</b> — nem Administrador tem isso de graça, precisa ligar o toggle mesmo sendo Admin (é a Central de Decisões que decide quem aprova o quê, não o nível de acesso).
      </div>
      {/* Lista de colaboradores costuma passar de uma tela — cabeçalho fixo
         (sticky, relativo a este container com scroll próprio) e barra de
         rolagem horizontal visível pra tabela larga (muitas capacidades),
         só nesta tabela — não mexe na classe .table-wrap compartilhada
         pelo resto do sistema. */}
      <div className="table-wrap" style={{ border: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh' }}>
        <table className="t">
          <thead><tr>
            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--vp-gray-50)' }}>Nome</th>
            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--vp-gray-50)' }}>Nível</th>
            {ALCADAS_PROPOSTAS.map((a) => (
              <th key={a.modulo + a.capacidade} style={{ textAlign:'center', position: 'sticky', top: 0, zIndex: 1, background: 'var(--vp-gray-50)' }} title={a.hint}>{a.label}</th>
            ))}
          </tr></thead>
          <tbody>
            {perfis.map((p) => {
              const admin = p.nivel === 'Administrador';
              return (
                <tr key={p.id}>
                  <td><span className="cell-main">{p.nome || p.email}</span><br/><span className="mono small muted">{p.email}</span></td>
                  <td><Badge variant="ink">{p.nivel}</Badge></td>
                  {ALCADAS_PROPOSTAS.map((a) => {
                    const chave = p.id + '.' + a.modulo + '.' + a.capacidade;
                    /* "Administrador sempre tem" só vale pras 4 alçadas originais
                       (checadas por temCapacidade(), que trata nivel==='Administrador'
                       como bypass automático). "Atua como CEO"/"Atua como Gestor
                       Comercial" (modulo='decisoes') são resolvidas por
                       decisoes-store.js, que NUNCA olha o nível — só e-mail fixo
                       ou concessão real nesta mesma tabela. Mostrar "—" pra Admin
                       nessas duas colunas seria mentir: ele não tem esse poder só
                       por ser Admin, precisa do toggle igual todo mundo. */
                    const bypassAdmin = admin && a.modulo !== 'decisoes';
                    const tem = bypassAdmin || !!concedidas[chave];
                    return (
                      <td key={chave} style={{ textAlign:'center' }}>
                        {bypassAdmin ? (
                          <span className="small muted" title="Administrador sempre tem">—</span>
                        ) : (
                          <input type="checkbox" checked={tem} disabled={salvandoChave === chave}
                            onChange={(e) => alternar(p, a.modulo, a.capacidade, e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: 'var(--vp-yellow)' }}/>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
    { name: "IMAP — compras@verticalparts.com.br", desc: "Inbox Importação Varejo" },
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
