/* ============================================================
   evolucao-fabricacao-quadro.jsx — Fabricação · Evolução da
   Fabricação (19/10/2026, Task 4 do plano "Evolução da Fabricação
   do Quadro de Comando"). Tela interna: 1 card por OP de quadro em
   aberto (pcp_ordens, frente='quadro'), com a trilha de 6 etapas
   fixas (fabricacao_quadro_itens), o link público pra flegar de
   fora e as ocorrências que pausam a fabricação.

   Reaproveita o motor puro de window.FabricacaoQuadroCalc (Task 2)
   e o store window.FabricacaoQuadroStore (Task 3) — nenhum cálculo
   de progresso/pausa mora aqui, só carga/ação + apresentação.

   Visualmente é uma versão mais simples do padrão de
   evolucao-equipamentos.jsx (.ev-trilha/.ev-no, nó "atual" pulsando)
   — aqui são sempre 6 etapas fixas, sem marcos/previsões: cada nó é
   uma checkbox clicável (flegado/não flegado), e o nó "atual" (1ª
   não flegada, via etapaAtualId) pulsa.

   window.EvolucaoFabricacaoQuadroPage
   ============================================================ */

const FQ_STATUS_LABEL = { aguardando: 'Aguardando', em_producao: 'Em produção' };

const FQ_CSS = `
.fq-card{border:1px solid var(--border);border-radius:10px;background:var(--bg-elev, var(--bg, #fff));padding:16px 18px;margin-bottom:14px}
.fq-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.fq-tit{font-size:14px;font-weight:700}
.fq-cliente{font-size:13px;color:var(--fg2);margin-top:2px}
.fq-meta{font-size:12px;color:var(--fg3);margin-top:2px}
.fq-pct{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fq-anel{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--fg1)}
.fq-anel>span{width:36px;height:36px;border-radius:50%;background:var(--bg-elev, var(--bg, #fff));display:grid;place-items:center}
.fq-trilha{display:flex;margin-top:16px;overflow-x:auto;padding-bottom:4px}
.fq-passo{flex:1 0 110px;min-width:110px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;cursor:pointer}
.fq-passo.is-disabled{cursor:default}
.fq-passo::before{content:"";position:absolute;top:13px;left:-50%;width:100%;height:3px;background:var(--border);z-index:0}
.fq-passo:first-child::before{display:none}
.fq-passo.is-ok::before{background:#16a34a}
.fq-checkbox{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.fq-no{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;z-index:1;border:2px solid var(--border);background:var(--bg-elev, var(--bg, #fff));color:var(--fg3)}
.fq-no.feito{background:#16a34a;border-color:#16a34a;color:#fff}
.fq-no.atual{border-color:#f59e0b;background:#fef3c7;color:#92400e;box-shadow:0 0 0 0 rgba(245,158,11,.55);animation:fq-pulso 1.8s infinite}
.fq-no.atual.pausado{border-color:#dc2626;background:#fee2e2;color:#991b1b;box-shadow:0 0 0 0 rgba(220,38,38,.5)}
@keyframes fq-pulso{0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}70%{box-shadow:0 0 0 9px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
@media (prefers-reduced-motion: reduce){.fq-no.atual{animation:none}.fq-oc-dot.aberta{animation:none}}
.fq-rot{font-size:11.5px;font-weight:600;margin-top:6px;color:var(--fg1);line-height:1.25;padding:0 4px}
.fq-dt{font-size:11px;color:var(--fg3);margin-top:2px}
.fq-oc{margin-top:14px;border-top:1px dashed var(--border);padding-top:10px}
.fq-oc-h{font-size:13px;font-weight:700;margin-bottom:6px}
.fq-oc-item{display:flex;gap:10px;align-items:flex-start;padding:6px 0;font-size:12.5px}
.fq-oc-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px;margin-top:4px;background:var(--border)}
.fq-oc-dot.aberta{background:#f59e0b;box-shadow:0 0 0 0 rgba(245,158,11,.55);animation:fq-pulso 1.8s infinite}
.fq-oc-dot.aberta.sem-frente{background:#dc2626;box-shadow:0 0 0 0 rgba(220,38,38,.5)}
.fq-oc-dot.resolvida{background:#16a34a}
.fq-link-box{background:var(--vp-info-tint);border:1px solid var(--vp-info);border-radius:6px;padding:10px;margin-top:10px;font-size:12px;word-break:break-all}
.fq-fiacao{margin-top:16px;border-top:1px dashed var(--border);padding-top:12px}
.fq-fiacao-h{font-size:13px;font-weight:700;margin-bottom:8px}
.fq-fiacao-item{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer}
.fq-fiacao-item.feito{border-color:#16a34a;background:#f0fdf4}
.fq-fiacao-item.is-disabled{cursor:default}
.fq-fiacao-check{width:20px;height:20px;margin-top:1px;flex:0 0 20px}
.fq-concluido{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#0a7a3d;background:#dcfce7;border-radius:999px;padding:4px 12px;margin-top:8px}
`;

function fqData(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}
function fqDataHora(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('pt-BR');
}

function fqCliente(ordem) {
  const c = ordem.quadros_comando && ordem.quadros_comando.clientes;
  return (c && (c.nome_fantasia || c.razao_social)) || ordem.cliente || 'Cliente não informado';
}

function fqTensaoPotencia(ordem) {
  const m = ordem.quadros_comando && ordem.quadros_comando.quadros_comando_maquina;
  if (!m || (m.potencia_kw == null && m.tensao_v == null)) return null;
  const kw = m.potencia_kw != null ? `${m.potencia_kw} kW` : '—';
  const v = m.tensao_v != null ? `${m.tensao_v} V` : '—';
  return `${kw} / ${v}`;
}

/* Junta o checklist fixo (6 itens, mesmo pra toda OP) com o que já foi
   flegado desta OP — item sem linha em fabricacao_quadro_status ainda
   (OP nunca teve link gerado nem foi flegada de dentro do sistema) entra
   como "não flegado", pra resumoProgresso/etapaAtualId sempre verem a
   lista completa de 6 passos, nunca só o que por acaso já existe no banco. */
function fqMergeStatus(itens, status) {
  const porItem = {};
  (status || []).forEach((s) => { porItem[s.item_id] = s; });
  return (itens || []).map((it) => {
    const s = porItem[it.id];
    return {
      item_id: it.id,
      flegado: !!(s && s.flegado),
      flegado_em: s ? s.flegado_em : null,
      flegado_por: s ? s.flegado_por : null,
      fabricacao_quadro_itens: it,
    };
  });
}

function fqNorm(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* Texto pesquisável da OP: obra (título/produto/cliente), nº da OP e
   códigos do pedido (pedido de venda, nº do pedido do quadro, cotação). */
function fqTextoBusca(o, extra) {
  const q = o.quadros_comando || {};
  const e = extra || {};
  return fqNorm([o.numero, o.titulo, o.produto, fqCliente(o), o.pedido_codigo, q.numero_pedido, o.numero_cotacao,
    e.numeroPedidoOmie, (e.codigosFalta || []).join(' ')].join(' | '));
}

function FQPasso({ s, atual, pausado, podeDesmarcar, busy, onToggle }) {
  const item = s.fabricacao_quadro_itens;
  const flegado = s.flegado;
  const bloqueadoParaDesmarcar = flegado && !podeDesmarcar;
  const cls = ['fq-no'];
  if (flegado) cls.push('feito');
  else if (atual) { cls.push('atual'); if (pausado) cls.push('pausado'); }
  return (
    <label className={'fq-passo' + (flegado ? ' is-ok' : '') + (busy || bloqueadoParaDesmarcar ? ' is-disabled' : '')}
      title={item.texto + (flegado ? ' — concluída' : atual ? ' — etapa atual' : '')}>
      <input type="checkbox" className="fq-checkbox" checked={flegado} disabled={busy || bloqueadoParaDesmarcar}
        onChange={(e) => onToggle(item.id, e.target.checked)} aria-label={item.texto} />
      <span className={cls.join(' ')} aria-hidden="true">{flegado ? '✓' : atual ? '●' : ''}</span>
      <span className="fq-rot">{item.texto}</span>
      {flegado && <span className="fq-dt">{fqData(s.flegado_em) || 'sem data'}</span>}
    </label>
  );
}

/* Itens extras de fiação (Cabo de Manobra/Passadiço/Topo do Carro/Poço) —
   só aparece quando o store já determinou fiacaoAplicavel (OP ou OP-mãe
   ligada a um Pedido de Venda, ver fabricacao-quadro-store.js). Cada item
   é flegável independente, sem ordem entre si (decisão do usuário,
   20/10/2026) — por isso é uma lista simples, não a trilha do Quadro. */
function FQFiacaoItem({ s, podeDesmarcar, busy, onToggle }) {
  const item = s.fabricacao_quadro_itens;
  const flegado = s.flegado;
  const bloqueadoParaDesmarcar = flegado && !podeDesmarcar;
  return (
    <label className={'fq-fiacao-item' + (flegado ? ' feito' : '') + (busy || bloqueadoParaDesmarcar ? ' is-disabled' : '')}>
      <input type="checkbox" className="fq-fiacao-check" checked={flegado} disabled={busy || bloqueadoParaDesmarcar}
        onChange={(e) => onToggle(item.id, e.target.checked)} aria-label={item.texto} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.texto}</div>
        {item.descricao && <div className="fq-meta">{item.descricao}</div>}
        {flegado && <div className="fq-dt">{fqData(s.flegado_em) || 'sem data'}</div>}
      </div>
    </label>
  );
}

function FQFiacao({ fiacaoStatus, podeDesmarcar, busy, onToggle }) {
  if (!fiacaoStatus || !fiacaoStatus.length) return null;
  return (
    <div className="fq-fiacao">
      <div className="fq-fiacao-h">Fiação (elevador completo)</div>
      {fiacaoStatus.map((s) => (
        <FQFiacaoItem key={s.item_id} s={s} podeDesmarcar={podeDesmarcar} busy={busy} onToggle={onToggle} />
      ))}
    </div>
  );
}

function FQOcorrencias({ ocorrencias, bomItens, busy, onAbrir, onResolver }) {
  const [aberto, setAberto] = React.useState(false);
  const [codigo, setCodigo] = React.useState('');
  const [temFrente, setTemFrente] = React.useState(null);
  const descricaoDoCodigo = React.useMemo(() => {
    const alvo = codigo.trim().toLowerCase();
    const it = alvo && (bomItens || []).find((b) => (b.sku || '').toLowerCase() === alvo);
    return it ? it.descricao : null;
  }, [codigo, bomItens]);
  const podeEnviar = codigo.trim().length > 0 && temFrente !== null && !busy;
  const enviar = async () => {
    if (!podeEnviar) return;
    const ok = await onAbrir(codigo.trim(), descricaoDoCodigo, temFrente);
    if (ok) { setCodigo(''); setTemFrente(null); setAberto(false); }
  };
  const lista = React.useMemo(() => {
    const l = [...(ocorrencias || [])];
    l.sort((a, b) => (a.status === 'aberta' ? 0 : 1) - (b.status === 'aberta' ? 0 : 1));
    return l;
  }, [ocorrencias]);
  return (
    <div className="fq-oc">
      <div className="fq-oc-h">Ocorrências</div>
      {!lista.length && <div className="fq-meta">Nenhuma ocorrência registrada.</div>}
      {lista.map((oc) => {
        const aberta = oc.status === 'aberta';
        const dotCls = 'fq-oc-dot' + (aberta ? ' aberta' + (oc.tem_frente_trabalho ? '' : ' sem-frente') : ' resolvida');
        return (
          <div key={oc.id} className="fq-oc-item">
            <span className={dotCls} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><b>{oc.codigo_produto}</b>{oc.descricao_produto ? ' — ' + oc.descricao_produto : ''}</div>
              <div className="fq-meta">
                {aberta
                  ? (oc.tem_frente_trabalho ? 'Aberta · com frente de trabalho' : 'Aberta · SEM frente de trabalho — fabricação pausada')
                  : 'Resolvida' + (fqDataHora(oc.resolvida_em) ? ' em ' + fqDataHora(oc.resolvida_em) : '')}
                {' · desde ' + (fqDataHora(oc.aberta_em) || '—')}
              </div>
            </div>
            {aberta && <Button variant="outline" size="sm" disabled={busy} onClick={() => onResolver(oc.id)}>Chegou — resolver</Button>}
          </div>
        );
      })}
      {!aberto && <div style={{ marginTop: 8 }}><Button variant="outline" size="sm" onClick={() => setAberto(true)}>+ Criar ocorrência</Button></div>}
      {aberto && (
        <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div className="fq-oc-h">Nova ocorrência — falta de material</div>
          <input type="text" list={'fq-bom-' + (bomItens && bomItens.length ? 'dl' : 'x')} value={codigo} disabled={busy}
            onChange={(e) => setCodigo(e.target.value)} placeholder="Código do produto que falta (ex.: VPMP-303)"
            aria-label="Código do produto que falta"
            style={{ width: '100%', maxWidth: 420, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: 'var(--bg-elev, var(--bg, #fff))', color: 'var(--fg1)' }} />
          <datalist id="fq-bom-dl">{(bomItens || []).map((b) => <option key={b.sku} value={b.sku}>{b.descricao}</option>)}</datalist>
          {descricaoDoCodigo && <div className="fq-meta">{descricaoDoCodigo}</div>}
          <div className="fq-meta" style={{ margin: '8px 0 4px' }}>Tem frente de trabalho para continuar enquanto espera?</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button variant={temFrente === true ? 'primary' : 'outline'} size="sm" disabled={busy} onClick={() => setTemFrente(true)}>Sim, tem</Button>
            <Button variant={temFrente === false ? 'primary' : 'outline'} size="sm" disabled={busy} onClick={() => setTemFrente(false)}>Não, vai parar</Button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <Button variant="primary" size="sm" disabled={!podeEnviar} onClick={enviar}>Registrar ocorrência</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FQCard({ ordem, itens, estado, resumo, podeDesmarcar, onRecarregar }) {
  const [link, setLink] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    window.FabricacaoQuadroStore.obterLink(ordem.id).then((l) => { if (vivo) setLink(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [ordem.id]);

  const marcar = async (itemId) => {
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.marcarEtapa(ordem.id, itemId, window.__VP_USER?.email);
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const desmarcar = async (itemId) => {
    if (!window.confirm('Desmarcar esta etapa da fabricação? Isso volta o quadro pra "em andamento" nesse ponto.')) return;
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.desmarcarEtapa(ordem.id, itemId, window.__VP_USER?.email);
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const onToggle = (itemId, checked) => {
    if (checked) marcar(itemId);
    else if (podeDesmarcar) desmarcar(itemId);
  };

  const marcarFiacao = async (itemId) => {
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.marcarEtapaFiacao(ordem.id, itemId, window.__VP_USER?.email);
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const desmarcarFiacao = async (itemId) => {
    if (!window.confirm('Desmarcar este item de fiação?')) return;
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.desmarcarEtapaFiacao(ordem.id, itemId, window.__VP_USER?.email);
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const onToggleFiacao = (itemId, checked) => {
    if (checked) marcarFiacao(itemId);
    else if (podeDesmarcar) desmarcarFiacao(itemId);
  };

  const gerarLink = async () => {
    setBusy(true);
    try {
      const l = await window.FabricacaoQuadroStore.criarOuObterLink(ordem.id, window.__VP_USER?.email);
      setLink(l);
      const url = window.location.origin + '/fabricacao-quadro/' + l.token;
      try {
        await navigator.clipboard.writeText(url);
        window.toast?.('Link copiado — envie pro operador do quadro.', 'success');
      } catch (e) { window.toast?.('Link gerado (copie manualmente abaixo).', 'success'); }
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const copiarLink = async () => {
    const url = window.location.origin + '/fabricacao-quadro/' + link.token;
    try { await navigator.clipboard.writeText(url); window.toast?.('Link copiado.', 'success'); }
    catch (e) { window.toast?.('Não foi possível copiar — copie manualmente abaixo.', 'warning'); }
  };

  const bomItens = React.useMemo(() => {
    const lista = (estado && estado.ordem && estado.ordem.quadros_comando && estado.ordem.quadros_comando.quadros_comando_bom_itens) || [];
    const porSku = {}; lista.forEach((it) => { if (it && it.sku && !porSku[it.sku]) porSku[it.sku] = it; });
    return Object.values(porSku);
  }, [estado]);
  const abrirOcorrencia = async (codigo, descricao, temFrente) => {
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.abrirOcorrencia(ordem.id, codigo, descricao, temFrente);
      window.toast?.('Ocorrência registrada.', 'success');
      await onRecarregar();
      return true;
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); return false; }
    finally { setBusy(false); }
  };
  const resolverOcorrencia = async (id) => {
    setBusy(true);
    try {
      await window.FabricacaoQuadroStore.resolverOcorrencia(id);
      window.toast?.('Ocorrência resolvida.', 'success');
      await onRecarregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  const cliente = fqCliente(ordem);
  const nPedido = (ordem.quadros_comando && ordem.quadros_comando.numero_pedido) || null; // interno do site
  const nPedidoOmie = ordem.numero_pedido_omie || null;
  const itensPedido = Array.isArray(ordem.itens_pedido) ? ordem.itens_pedido : [];
  const tp = fqTensaoPotencia(ordem);
  const linkUrl = link ? window.location.origin + '/fabricacao-quadro/' + link.token : null;

  if (estado && estado.erro) {
    return (
      <div className="fq-card">
        <div className="fq-tit">{ordem.numero || ordem.titulo || 'OP'}</div>
        <div style={{ color: 'var(--vp-danger)', fontSize: 12.5, marginTop: 8 }}>Não foi possível carregar esta OP: {estado.erro}</div>
      </div>
    );
  }

  if (!estado || !resumo) {
    return (
      <div className="fq-card">
        <div className="fq-tit">{ordem.numero || ordem.titulo || 'OP'}</div>
        <div style={{ color: 'var(--fg3)', fontSize: 12.5, marginTop: 8 }}>Carregando…</div>
      </div>
    );
  }

  const { pct, atualId, pausado, statusMerged } = resumo;
  const idxAtual = statusMerged.findIndex((s) => s.item_id === atualId);
  const fiacaoStatus = estado.fiacaoStatus || [];
  const fiacaoCompleta = !fiacaoStatus.length || fiacaoStatus.every((s) => s.flegado);
  /* "Concluído" (decisão do usuário, 20/10/2026) é um rótulo calculado,
     nunca um clique a mais: Quadro 100% E (sem fiação aplicável OU os 4
     itens de fiação flegados). */
  const concluido = pct === 100 && fiacaoCompleta;

  return (
    <div className="fq-card">
      <div className="fq-head">
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="fq-tit">{ordem.numero || 'OP'}{ordem.titulo ? ' — ' + ordem.titulo : ''}</span>
            <Badge variant="neutral">{FQ_STATUS_LABEL[ordem.status] || ordem.status}</Badge>
          </div>
          <div className="fq-cliente">{cliente}</div>
          <div className="fq-meta">
            {[nPedidoOmie ? 'Pedido Omie: ' + nPedidoOmie : null, nPedido ? (nPedidoOmie ? 'Pedido de quadro interno: ' : 'Nº Pedido: ') + nPedido : null, tp ? 'Tensão/Potência: ' + tp : null,
              ordem.numero_cotacao ? 'Cotação Nº ' + ordem.numero_cotacao : null,
              ordem.prazo_entrega ? 'Prazo: ' + fqData(ordem.prazo_entrega) : null]
              .filter(Boolean).join(' · ')}
          </div>
          {itensPedido.length > 0 && <div className="fq-meta">Itens do pedido: {itensPedido.join(', ')}</div>}
          {concluido && <div className="fq-concluido">✓ Concluído</div>}
        </div>
        <div className="fq-pct">
          <div className="fq-anel" title="Progresso ponderado da fabricação"
            style={{ background: `conic-gradient(${pausado ? 'var(--vp-danger)' : 'var(--vp-success)'} ${pct * 3.6}deg, var(--border) 0)` }}>
            <span>{pct}%</span>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={link ? copiarLink : gerarLink}>
            {link ? '🔗 Copiar link' : '🔗 Gerar link'}
          </Button>
        </div>
      </div>

      {pausado && (
        <div className="alert danger" style={{ marginTop: 10, borderRadius: 6 }}>
          <div>
            <div className="alert__title">⏸ Fabricação pausada</div>
            <div className="alert__sub">Há uma ocorrência aberta sem frente de trabalho disponível — veja em Ocorrências abaixo.</div>
          </div>
        </div>
      )}

      {linkUrl && (
        <div className="fq-link-box">
          Link fixo do quadro (mande pro operador): <a href={linkUrl} target="_blank" rel="noopener noreferrer">{linkUrl}</a>
        </div>
      )}

      <div className="fq-trilha" role="list" aria-label="Etapas da fabricação do quadro">
        {statusMerged.map((s, i) => (
          <FQPasso key={s.item_id} s={s} atual={i === idxAtual} pausado={pausado}
            podeDesmarcar={podeDesmarcar} busy={busy} onToggle={onToggle} />
        ))}
      </div>

      <FQFiacao fiacaoStatus={fiacaoStatus} podeDesmarcar={podeDesmarcar} busy={busy} onToggle={onToggleFiacao} />

      <FQOcorrencias ocorrencias={estado.ocorrencias} bomItens={bomItens} busy={busy} onAbrir={abrirOcorrencia} onResolver={resolverOcorrencia} />
    </div>
  );
}

function EvolucaoFabricacaoQuadroPage({ setRoute, setSubsel }) {
  const [itens, setItens] = React.useState(null);
  const [ordens, setOrdens] = React.useState(null);
  const [estados, setEstados] = React.useState({});
  const [erroGeral, setErroGeral] = React.useState(null);
  const [podeDesmarcar, setPodeDesmarcar] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [numPedidos, setNumPedidos] = React.useState({});

  const carregarEstado = React.useCallback(async (ordemId) => {
    try {
      const { ordem, status, ocorrencias, fiacaoAplicavel, fiacaoStatus } = await window.FabricacaoQuadroStore.obterEstadoOrdem(ordemId);
      setEstados((prev) => ({ ...prev, [ordemId]: { ordem, status, ocorrencias, fiacaoAplicavel, fiacaoStatus } }));
    } catch (e) {
      setEstados((prev) => ({ ...prev, [ordemId]: { erro: e.message || String(e) } }));
    }
  }, []);

  const carregarTudo = React.useCallback(async () => {
    try {
      const [it, ops] = await Promise.all([
        window.FabricacaoQuadroStore.listarItens(),
        window.FabricacaoQuadroStore.listarOPsAbertas(),
      ]);
      setItens(it);
      setOrdens(ops);
      setErroGeral(null);
      // Nº do pedido de venda do Omie (a busca aceita o número que o cliente/vendas conhece, não só o código interno)
      try {
        const cods = [...new Set(ops.map((o) => o.pedido_codigo).filter((x) => x != null))];
        if (cods.length) {
          const { data: ps } = await window.__VP_SB.sb.from('pcp_pedidos').select('codigo_pedido, numero_pedido').in('codigo_pedido', cods);
          const m = {}; (ps || []).forEach((p) => { m[p.codigo_pedido] = p.numero_pedido; });
          setNumPedidos(m);
        }
      } catch (e) { /* a busca segue pelos outros campos */ }
      await Promise.all(ops.map((o) => carregarEstado(o.id)));
    } catch (e) {
      setErroGeral(e.message || String(e));
    }
  }, [carregarEstado]);

  React.useEffect(() => { carregarTudo(); }, [carregarTudo]);

  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('fabricacao', 'editar_status_quadro'))
      .then((v) => { if (vivo) setPodeDesmarcar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const resumos = React.useMemo(() => {
    if (!itens || !ordens) return {};
    const C = window.FabricacaoQuadroCalc;
    const out = {};
    ordens.forEach((o) => {
      const e = estados[o.id];
      if (!e || e.erro) return;
      const statusMerged = fqMergeStatus(itens, e.status);
      out[o.id] = {
        pct: C.resumoProgresso(statusMerged).pct,
        atualId: C.etapaAtualId(statusMerged),
        pausado: C.estaPausado(e.ocorrencias),
        statusMerged,
      };
    });
    return out;
  }, [itens, ordens, estados]);

  const ordensFiltradas = React.useMemo(() => {
    if (!ordens) return null;
    const termos = fqNorm(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return ordens;
    return ordens.filter((o) => {
      const oc = (estados[o.id] && estados[o.id].ocorrencias) || [];
      const t = fqTextoBusca(o, { numeroPedidoOmie: numPedidos[o.pedido_codigo], codigosFalta: oc.map((x) => x.codigo_produto) });
      return termos.every((x) => t.includes(x));
    });
  }, [ordens, busca, estados, numPedidos]);

  const totalOps = ordens ? ordens.length : 0;
  const listaResumos = Object.values(resumos);
  const pausadas = listaResumos.filter((r) => r.pausado).length;
  const pctMedio = listaResumos.length ? Math.round(listaResumos.reduce((a, r) => a + r.pct, 0) / listaResumos.length) : null;

  return (
    <div className="page fade-in">
      <style>{FQ_CSS}</style>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Fabricação · Evolução da Fabricação</div>
          <h1 className="page-head__title">Evolução da Fabricação</h1>
          <p className="page-head__sub">Acompanhe, OP a OP, as 6 etapas da fabricação do quadro de comando — gere o link pro operador flegar de fora e veja as ocorrências que pausam a produção.</p>
        </div>
      </div>

      {erroGeral && (
        <div className="alert danger" style={{ borderRadius: 6, marginBottom: 14 }}>
          <div><div className="alert__title">Não foi possível carregar</div><div className="alert__sub">{erroGeral}</div></div>
        </div>
      )}

      {!erroGeral && !ordens && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>}

      {ordens && ordens.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <KPI label="OPs em fabricação" value={String(totalOps)} />
          <KPI label="Pausadas" value={String(pausadas)} sub={pausadas ? 'aguardando frente de trabalho' : 'nenhuma pausada'} />
          <KPI label="Progresso médio" value={pctMedio != null ? pctMedio + '%' : '—'} />
        </div>
      )}

      {ordens && ordens.length > 0 && (
        <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, cliente ou nº do pedido…" aria-label="Buscar por código, cliente ou número do pedido"
            style={{ flex: '1 1 320px', maxWidth: 480, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg-elev, var(--bg, #fff))', color: 'var(--fg1)' }} />
          {busca && <Button variant="outline" size="sm" onClick={() => setBusca('')}>Limpar</Button>}
          {busca && <span className="fq-meta">{ordensFiltradas.length} de {totalOps} OP(s)</span>}
        </div>
      )}

      {ordensFiltradas && ordens.length > 0 && ordensFiltradas.length === 0 && (
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma OP encontrada para "{busca}".</div>
      )}

      {ordens && ordens.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma OP de quadro de comando em aberto no momento.</div>
      )}

      {ordensFiltradas && itens && ordensFiltradas.map((o) => (
        <FQCard key={o.id} ordem={o} itens={itens} estado={estados[o.id]} resumo={resumos[o.id]}
          podeDesmarcar={podeDesmarcar} onRecarregar={() => carregarEstado(o.id)} />
      ))}
    </div>
  );
}

window.EvolucaoFabricacaoQuadroPage = EvolucaoFabricacaoQuadroPage;
