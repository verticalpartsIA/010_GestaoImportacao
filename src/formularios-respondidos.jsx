/* ============================================================
   formularios-respondidos.jsx — Quadros de Comando · Formulários Respondidos (10/11/2026, pedido do Gelson).
   Lista as respostas que os clientes enviaram pelo LINK PÚBLICO de orçamento de quadro de comando
   (quadros_comando.origem_envio = 'formulario_publico', não excluídas). Nada vai ao Omie; a única gravação é ligar/desligar o PV à mão (qc_pv_ligar).
   Ao clicar numa linha, abre as respostas completas (mesmo texto legível do PDF: QcRespostasCalc.montarResumo) e o botão de PDF.
   Cliente × Lead: a regra é da Edge Function capturar-lead-quadro-comando (CNPJ no Omie = cliente, não cria Lead; fora do Omie = Lead).
   Esta tela só MOSTRA a etiqueta (cliente_id preenchido = cliente; senão Lead). Descrição de máquina/porta vem do catálogo público
   (ação 'catalogo' da mesma função); se não carregar, mostra o código.
   ID_TAG e PV no Omie (10/11/2026): cada resposta ganha uma ID_TAG (ID-QC0001…); o vendedor a digita em "Observações do pedido" no Omie e o banco
   preenche o PV (gatilho em pcp_pedidos); também dá para ligar à mão (qc_pv_ligar). Pedido cancelado aparece em vermelho e não conta como vendido.
   Spec e regras: docs/modulos/14_quadros_comando.md (14.6).
   ============================================================ */

function frData(d) { return d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—'; }
const FR_EDGE_URL = 'https://jxtqwzmpgofwctqajewt.functions.supabase.co/capturar-lead-quadro-comando';

const NI_FR = 'Não informado';
function frTotalLop(f) {
  const n = parseInt(f.num_paradas, 10) || 0;
  return n + (f.porta_oposta === 'sim' ? (f.porta_oposta_paradas || []).length : 0);
}

function FrEtiqueta({ r }) {
  return r.cliente_id
    ? <span className="badge" style={{ background: '#e6f4ea', color: '#1e7a34', fontSize: 11 }} title="O CNPJ já está cadastrado no Omie — por regra, quem já é cliente não é lead.">Cliente (já no Omie)</span>
    : <span className="badge" style={{ background: '#e8f0fe', color: '#1a4fa0', fontSize: 11 }} title="CNPJ fora do Omie (ou sem CNPJ): é lead até comprar.">Lead</span>;
}

/* PV_Omie (10/11/2026): "vendido" = há pedido do Omie ligado e ele NÃO está cancelado. O pedido nasce da ID_TAG digitada em "Observações do pedido"
   no Omie (banco: gatilho em pcp_pedidos) ou da ligação manual. Pedido cancelado continua aparecendo, em vermelho, e não conta como vendido. */
function FrPV({ r }) {
  if (!r.pv_omie) return <span style={{ color: 'var(--fg3)' }}>Não vendido</span>;
  return (
    <div>
      {r.pv_cancelado
        ? <b style={{ fontWeight: 600, color: 'var(--vp-danger, #c0392b)' }} title="O pedido do Omie foi cancelado: este quadro não conta como vendido.">PV {r.pv_omie} · Cancelado</b>
        : <b style={{ fontWeight: 600, color: 'var(--vp-success, #2e9e5b)' }} title="Quadro vendido: número do pedido de venda no Omie">PV {r.pv_omie}</b>}
      <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{r.pv_origem === 'manual' ? `ligado à mão${r.pv_ligado_por ? ' por ' + r.pv_ligado_por : ''}` : 'achado pela ID_TAG'}</div>
      {r.pv_multiplos ? <div style={{ fontSize: 10, color: 'var(--vp-danger, #c0392b)' }} title="A mesma ID_TAG aparece em mais de um pedido não cancelado; vale o mais antigo.">⚠ tag em mais de um pedido</div> : null}
    </div>
  );
}

async function frCopiar(texto) {
  try { await navigator.clipboard.writeText(texto); window.toast?.('ID_TAG copiada.'); } catch (e) { window.prompt('Copie a ID_TAG:', texto); }
}

/* Ligar/desligar à mão (função qc_pv_ligar, exige a alçada "editar" desta tela). Sugere os pedidos do mesmo CNPJ (raiz de 8 dígitos, cobre filiais). */
function FrLigar({ r, onClose, aoMudar }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const f = r.respostas_publico || {};
  const [sug, setSug] = React.useState(null);
  const [numero, setNumero] = React.useState(r.pv_origem === 'manual' ? String(r.pv_omie || '') : '');
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const d = String(f.cnpj || '').replace(/\D/g, '');
      if (!sb || d.length < 8) { setSug([]); return; }
      const r8 = d.slice(0, 8);
      try {
        const { data, error } = await sb.from('pcp_pedidos').select('numero_pedido, data_pedido, etapa, valor_total, cancelado, cliente_nome')
          .ilike('cliente_documento', `${r8.slice(0, 2)}.${r8.slice(2, 5)}.${r8.slice(5, 8)}/%`).order('data_pedido', { ascending: false }).limit(60);
        if (error) throw error;
        const vistos = new Set(); const lista = [];
        (data || []).forEach((p) => { if (!vistos.has(p.numero_pedido)) { vistos.add(p.numero_pedido); lista.push(p); } });
        if (vivo) setSug(lista.slice(0, 25));
      } catch (e) { if (vivo) setSug([]); }
    })();
    return () => { vivo = false; };
  }, []);
  const gravar = async (n) => {
    setOcupado(true); setErro(null);
    try {
      const { error } = await sb.rpc('qc_pv_ligar', { p_id: r.id, p_numero: n });
      if (error) throw error;
      window.VPLog?.registrar({ modulo: 'Quadros de Comando', acao: n ? 'Ligou o formulário respondido a um pedido do Omie' : 'Desfez a ligação do formulário com o pedido do Omie', alvo: r.id_tag || '', alvo_id: String(r.id), detalhe: { pedido: n || null } });
      window.toast?.(n ? `Ligado ao pedido ${n}.` : 'Ligação desfeita.');
      await aoMudar();
      onClose();
    } catch (e) { setErro(((e && e.message) || String(e)).replace(/^.*PV Omie: /, '')); }
    setOcupado(false);
  };
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 94vw)', maxHeight: '86vh', overflow: 'auto', padding: 20, background: 'var(--bg, #fff)' }}>
        <h3 style={{ marginTop: 0 }}>Ligar ao pedido do Omie — {r.id_tag}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 10 }}>{f.empresa || f.solicitante || ''}. Normalmente o vendedor digita a ID_TAG em "Observações do pedido" no Omie e a ligação nasce sozinha; use isto só quando precisar ligar ou corrigir à mão.</div>
        <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 4 }}>Pedidos deste cliente no Omie</div>
        {sug === null ? <div style={{ color: 'var(--fg3)', fontSize: 12 }}>Carregando…</div> : null}
        {sug && !sug.length ? <div style={{ color: 'var(--fg3)', fontSize: 12 }}>Nenhum pedido encontrado pelo CNPJ do formulário. Digite o número abaixo.</div> : null}
        {sug && sug.length ? (
          <table className="t"><tbody>
            {sug.map((p) => (
              <tr key={p.numero_pedido}>
                <td><b style={{ fontWeight: 500 }}>{p.numero_pedido}</b>{p.cancelado ? <span style={{ color: 'var(--vp-danger, #c0392b)', marginLeft: 6, fontSize: 11 }}>cancelado</span> : null}</td>
                <td>{p.data_pedido ? String(p.data_pedido).slice(0, 10).split('-').reverse().join('/') : '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--fg3)' }}>etapa {p.etapa}</td>
                <td style={{ textAlign: 'right' }}><button className="btn" disabled={ocupado} onClick={() => gravar(String(p.numero_pedido))}>Ligar</button></td>
              </tr>
            ))}
          </tbody></table>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 200 }} placeholder="Nº do pedido no Omie" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          <button className="btn btn--primary" disabled={ocupado || !numero} onClick={() => gravar(numero)}>Ligar este número</button>
          {r.pv_omie ? <button className="btn" disabled={ocupado} onClick={() => gravar('')} title="Tira a ligação; se a ID_TAG estiver em algum pedido, ela volta sozinha">Desfazer ligação</button> : null}
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        {erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 8 }}>{erro}</div> : null}
      </div>
    </div>
  );
}

function FrDetalhe({ r, catalogo, onClose, podeLigar, aoMudar }) {
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [ligando, setLigando] = React.useState(false);
  const C = window.QcRespostasCalc;
  const f = r.respostas_publico || {};
  const vendido = !!r.pv_omie && !r.pv_cancelado;
  const linhas = [
    ['§ Identificação do formulário', ''],
    ['ID_TAG', r.id_tag || NI_FR],
    ['PV no Omie', r.pv_omie ? (r.pv_cancelado ? `${r.pv_omie} (pedido cancelado)` : r.pv_omie) : 'Não vendido'],
    ['Respondido em', frData(r.created_at)],
    ...C.montarResumoCompleto(f, catalogo, frTotalLop(f)),
  ];
  const baixar = async () => {
    if (!window.QcRespostasReactPdf) { setErro('Gerador de PDF não carregou. Recarregue a página.'); return; }
    setOcupado(true); setErro(null);
    try {
      await window.QcRespostasReactPdf.baixar({ numeroPedido: vendido ? r.pv_omie : '', cliente: f.empresa || f.solicitante || '', linhas, respondidoEm: frData(r.created_at) },
        `Formulario-Quadro-de-Comando-${r.id_tag || String(f.empresa || f.solicitante || 'cliente').replace(/[^0-9A-Za-z]+/g, '-').slice(0, 40)}${vendido ? '-PV-' + r.pv_omie : ''}.pdf`);
      window.VPLog?.registrar({ modulo: 'Quadros de Comando', acao: 'Baixou o PDF de um formulário respondido', alvo: f.empresa || f.solicitante || '', alvo_id: String(r.id) });
    } catch (e) { setErro('Não foi possível gerar o PDF: ' + ((e && e.message) || e)); }
    setOcupado(false);
  };
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 94vw)', maxHeight: '88vh', overflow: 'auto', padding: 20, background: 'var(--bg, #fff)' }}>
        <h3 style={{ marginTop: 0 }}>{f.empresa || f.solicitante || 'Formulário respondido'}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 10 }}>
          Respondido em {frData(r.created_at)} · <FrEtiqueta r={r} />
          {r.id_tag ? <span> · ID_TAG <b className="mono" style={{ fontWeight: 600 }}>{r.id_tag}</b></span> : null}
          {r.pv_omie ? <span> · PV {r.pv_omie}{r.pv_cancelado ? ' (cancelado)' : ''}</span> : <span> · não vendido</span>}
          {r.cliente ? <span> · Cliente cadastrado: {r.cliente.codigo ? `${r.cliente.codigo} · ` : ''}{r.cliente.razao_social}</span> : null}
          {r.lead_id ? <span className="mono"> · {r.lead_id}</span> : null}
        </div>
        <table className="t"><tbody>
          {linhas.map((p, i) => (String(p[0]).indexOf('§ ') === 0
            ? <tr key={i}><td colSpan={2} style={{ background: 'var(--bg-2, #f3f3f3)', fontWeight: 700, fontSize: 12, paddingTop: 8 }}>{String(p[0]).slice(2)}</td></tr>
            : <tr key={i}><td style={{ width: '34%', fontWeight: 500 }}>{p[0]}</td><td>{p[1]}</td></tr>
          ))}
          {f.logo_url ? <tr><td style={{ fontWeight: 500 }}>Logo enviada</td><td><a href={f.logo_url} target="_blank" rel="noopener noreferrer">Abrir arquivo</a></td></tr> : null}
        </tbody></table>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {podeLigar ? <button className="btn" onClick={() => setLigando(true)} disabled={ocupado}>🔗 Ligar ao pedido do Omie</button> : null}
          {r.id_tag ? <button className="btn" onClick={() => frCopiar(r.id_tag)} title="Copia a ID_TAG para colar em Observações do pedido no Omie">Copiar ID_TAG</button> : null}
          <button className="btn" onClick={baixar} disabled={ocupado}>⬇ Baixar PDF</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        {ligando ? <FrLigar r={r} onClose={() => setLigando(false)} aoMudar={aoMudar} /> : null}
        {erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 8 }}>{erro}</div> : null}
      </div>
    </div>
  );
}

function FormulariosRespondidosPage() {
  const ord = window.useOrdenacao();
  const [rows, setRows] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [fTipo, setFTipo] = React.useState('todos');
  const [abertoId, setAbertoId] = React.useState(null);
  const [fVenda, setFVenda] = React.useState('todos');
  const [podeLigar, setPodeLigar] = React.useState(false);
  const [catalogo, setCatalogo] = React.useState({ maquinas: [], portas_cabina: [], portas_pavimento: [] });

  const carregar = React.useCallback(async () => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setErro('Supabase indisponível.'); return; }
    try {
      const { data, error } = await sb.from('quadros_comando')
        .select('id, numero_pedido, created_at, lead_id, cliente_id, respostas_publico, id_tag, pv_omie, pv_origem, pv_cancelado, pv_multiplos, pv_ligado_por, cliente:clientes(razao_social, codigo)')
        .eq('origem_envio', 'formulario_publico').is('excluido_em', null)
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      setRows(data || []); setErro(null);
    } catch (e) { setErro((e && e.message) || String(e)); }
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    let vivo = true;
    const PS = window.PropostaStore;
    if (PS && PS.temCapacidade) PS.temCapacidade('quadros-formularios-respondidos', 'editar').then((ok) => { if (vivo) setPodeLigar(!!ok); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  React.useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  // Catálogo público de máquinas/portas só para trocar o código pela descrição no detalhe; se falhar, o código aparece.
  React.useEffect(() => {
    if (!abertoId || catalogo.carregado) return;
    fetch(FR_EDGE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'catalogo' }) })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (d && d.success) setCatalogo({ maquinas: d.maquinas || [], portas_cabina: d.portas_cabina || [], portas_pavimento: d.portas_pavimento || [], carregado: true }); })
      .catch(() => {});
  }, [abertoId, catalogo.carregado]);

  const aberto = (rows || []).find((x) => x.id === abertoId) || null;
  const linhas = (rows || []).map((r) => {
    const f = r.respostas_publico || {};
    const variante = (window.QcRespostasCalc.VARIANTES_QUADRO.find((v) => v.value === f.variante_quadro) || {}).label || '';
    return { r, empresa: f.empresa || '', solicitante: f.solicitante || '', obra: f.identificacao || '', variante, cnpj: String(f.cnpj || ''), quando: r.created_at };
  });
  const filtradas = linhas.filter((x) => {
    if (fTipo === 'cliente' && !x.r.cliente_id) return false;
    if (fTipo === 'lead' && x.r.cliente_id) return false;
    const vend = !!x.r.pv_omie && !x.r.pv_cancelado;
    if (fVenda === 'vendido' && !vend) return false;
    if (fVenda === 'nao' && vend) return false;
    if (fVenda === 'cancelado' && !(x.r.pv_omie && x.r.pv_cancelado)) return false;
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    const tDig = t.replace(/\D/g, '');
    return [x.empresa, x.solicitante, x.obra, x.r.id_tag || '', x.r.pv_omie || ''].some((s) => String(s).toLowerCase().includes(t)) || (tDig && x.cnpj.replace(/\D/g, '').includes(tDig));
  });
  const lista = ord.aplicar(filtradas, { empresa: (x) => x.empresa, solicitante: (x) => x.solicitante, obra: (x) => x.obra, modelo: (x) => x.variante, quando: (x) => x.quando, idtag: (x) => x.r.id_tag || '', pv: (x) => (x.r.pv_omie ? Number(x.r.pv_omie) : null) });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Quadros de Comando · Formulários Respondidos</div>
          <h1 className="page-head__title">Formulários Respondidos</h1>
          <p className="page-head__sub">Respostas que os clientes enviaram pelo link público de orçamento do quadro de comando. Clique numa linha para ver tudo o que ele preencheu.</p>
        </div>
        <div className="page-head__r"><button className="btn" onClick={carregar}>Atualizar</button></div>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por empresa, solicitante, obra, CNPJ, ID_TAG ou nº do pedido…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input" style={{ minWidth: 170 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="todos">Todos</option><option value="cliente">Só clientes do Omie</option><option value="lead">Só leads</option>
        </select>
        <select className="input" style={{ minWidth: 170 }} value={fVenda} onChange={(e) => setFVenda(e.target.value)}>
          <option value="todos">Vendido ou não</option><option value="vendido">Só vendidos (PV no Omie)</option><option value="nao">Só não vendidos</option><option value="cancelado">Só com pedido cancelado</option>
        </select>
      </div>
      {erro ? <div className="card" style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div> : null}
      {!erro && !rows ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div> : null}
      {rows ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 8 }}>{filtradas.length} de {rows.length} formulário(s)</div>
          <div className="card table-wrap" style={{ overflow: 'auto' }}>
            <table className="t pcp-grid">
              <thead><tr>
                {ord.th('empresa', 'Empresa / Cliente')}{ord.th('solicitante', 'Solicitante')}{ord.th('obra', 'Obra')}
                {ord.th('modelo', 'Modelo do quadro')}<th>Situação</th>{ord.th('idtag', 'ID_TAG')}{ord.th('pv', 'PV no Omie')}{ord.th('quando', 'Respondido em')}
              </tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.r.id} onClick={() => setAbertoId(x.r.id)} style={{ cursor: 'pointer' }} title="Clique para ver as respostas">
                    <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{x.empresa || '—'}</b>{x.r.cliente ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{x.r.cliente.codigo ? `${x.r.cliente.codigo} · ` : ''}{x.r.cliente.razao_social}</div> : null}</td>
                    <td>{x.solicitante || '—'}</td>
                    <td>{x.obra || '—'}</td>
                    <td>{x.variante || '—'}</td>
                    <td><FrEtiqueta r={x.r} /></td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{x.r.id_tag || '—'}</td>
                    <td><FrPV r={x.r} /></td>
                    <td>{frData(x.quando)}</td>
                  </tr>
                ))}
                {!lista.length ? <tr><td colSpan={8} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhum formulário respondido ainda.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {aberto ? <FrDetalhe r={aberto} catalogo={catalogo} onClose={() => setAbertoId(null)} podeLigar={podeLigar} aoMudar={carregar} /> : null}
    </div>
  );
}

window.FormulariosRespondidosPage = FormulariosRespondidosPage;
