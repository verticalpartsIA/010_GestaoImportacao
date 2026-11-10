/* ============================================================
   formularios-respondidos.jsx — Quadros de Comando · Formulários Respondidos (10/11/2026, pedido do Gelson).
   Lista as respostas que os clientes enviaram pelo LINK PÚBLICO de orçamento de quadro de comando
   (quadros_comando.origem_envio = 'formulario_publico', não excluídas). SÓ LEITURA: nada é gravado aqui e nada vai ao Omie.
   Ao clicar numa linha, abre as respostas completas (mesmo texto legível do PDF: QcRespostasCalc.montarResumo) e o botão de PDF.
   Cliente × Lead: a regra é da Edge Function capturar-lead-quadro-comando (CNPJ no Omie = cliente, não cria Lead; fora do Omie = Lead).
   Esta tela só MOSTRA a etiqueta (cliente_id preenchido = cliente; senão Lead). Descrição de máquina/porta vem do catálogo público
   (ação 'catalogo' da mesma função); se não carregar, mostra o código.
   Spec e regras: docs/modulos/14_quadros_comando.md (14.5).
   ============================================================ */

function frData(d) { return d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—'; }
const FR_EDGE_URL = 'https://jxtqwzmpgofwctqajewt.functions.supabase.co/capturar-lead-quadro-comando';

function frTotalLop(f) {
  const n = parseInt(f.num_paradas, 10) || 0;
  return n + (f.porta_oposta === 'sim' ? (f.porta_oposta_paradas || []).length : 0);
}

function FrEtiqueta({ r }) {
  return r.cliente_id
    ? <span className="badge" style={{ background: '#e6f4ea', color: '#1e7a34', fontSize: 11 }} title="O CNPJ já está cadastrado no Omie — por regra, quem já é cliente não é lead.">Cliente (já no Omie)</span>
    : <span className="badge" style={{ background: '#e8f0fe', color: '#1a4fa0', fontSize: 11 }} title="CNPJ fora do Omie (ou sem CNPJ): é lead até comprar.">Lead</span>;
}

function FrDetalhe({ r, catalogo, onClose }) {
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const C = window.QcRespostasCalc;
  const f = r.respostas_publico || {};
  const linhas = C.montarResumo(f, catalogo, frTotalLop(f));
  const baixar = async () => {
    if (!window.QcRespostasReactPdf) { setErro('Gerador de PDF não carregou. Recarregue a página.'); return; }
    setOcupado(true); setErro(null);
    try {
      await window.QcRespostasReactPdf.baixar({ numeroPedido: '', cliente: f.empresa || f.solicitante || '', linhas, respondidoEm: frData(r.created_at) },
        `Formulario-Quadro-de-Comando-${String(f.empresa || f.solicitante || 'cliente').replace(/[^0-9A-Za-z]+/g, '-').slice(0, 40)}.pdf`);
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
          {r.cliente ? <span> · Cliente cadastrado: {r.cliente.codigo ? `${r.cliente.codigo} · ` : ''}{r.cliente.razao_social}</span> : null}
          {r.lead_id ? <span className="mono"> · {r.lead_id}</span> : null}
        </div>
        <table className="t"><tbody>
          {linhas.map((p, i) => (
            <tr key={i}><td style={{ width: '34%', fontWeight: 500 }}>{p[0]}</td><td>{p[1]}</td></tr>
          ))}
          {f.logo_url ? <tr><td style={{ fontWeight: 500 }}>Logo enviada</td><td><a href={f.logo_url} target="_blank" rel="noopener noreferrer">Abrir arquivo</a></td></tr> : null}
        </tbody></table>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={baixar} disabled={ocupado}>⬇ Baixar PDF</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
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
  const [aberto, setAberto] = React.useState(null);
  const [catalogo, setCatalogo] = React.useState({ maquinas: [], portas_cabina: [], portas_pavimento: [] });

  const carregar = React.useCallback(async () => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) { setErro('Supabase indisponível.'); return; }
    try {
      const { data, error } = await sb.from('quadros_comando')
        .select('id, numero_pedido, created_at, lead_id, cliente_id, respostas_publico, cliente:clientes(razao_social, codigo)')
        .eq('origem_envio', 'formulario_publico').is('excluido_em', null)
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      setRows(data || []); setErro(null);
    } catch (e) { setErro((e && e.message) || String(e)); }
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  // Catálogo público de máquinas/portas só para trocar o código pela descrição no detalhe; se falhar, o código aparece.
  React.useEffect(() => {
    if (!aberto || catalogo.carregado) return;
    fetch(FR_EDGE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'catalogo' }) })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (d && d.success) setCatalogo({ maquinas: d.maquinas || [], portas_cabina: d.portas_cabina || [], portas_pavimento: d.portas_pavimento || [], carregado: true }); })
      .catch(() => {});
  }, [aberto, catalogo.carregado]);

  const linhas = (rows || []).map((r) => {
    const f = r.respostas_publico || {};
    const variante = (window.QcRespostasCalc.VARIANTES_QUADRO.find((v) => v.value === f.variante_quadro) || {}).label || '';
    return { r, empresa: f.empresa || '', solicitante: f.solicitante || '', obra: f.identificacao || '', variante, cnpj: String(f.cnpj || ''), quando: r.created_at };
  });
  const filtradas = linhas.filter((x) => {
    if (fTipo === 'cliente' && !x.r.cliente_id) return false;
    if (fTipo === 'lead' && x.r.cliente_id) return false;
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    const tDig = t.replace(/\D/g, '');
    return [x.empresa, x.solicitante, x.obra].some((s) => s.toLowerCase().includes(t)) || (tDig && x.cnpj.replace(/\D/g, '').includes(tDig));
  });
  const lista = ord.aplicar(filtradas, { empresa: (x) => x.empresa, solicitante: (x) => x.solicitante, obra: (x) => x.obra, modelo: (x) => x.variante, quando: (x) => x.quando });

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
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por empresa, solicitante, obra ou CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input" style={{ minWidth: 170 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="todos">Todos</option><option value="cliente">Só clientes do Omie</option><option value="lead">Só leads</option>
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
                {ord.th('modelo', 'Modelo do quadro')}<th>Situação</th>{ord.th('quando', 'Respondido em')}
              </tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.r.id} onClick={() => setAberto(x.r)} style={{ cursor: 'pointer' }} title="Clique para ver as respostas">
                    <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{x.empresa || '—'}</b>{x.r.cliente ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{x.r.cliente.codigo ? `${x.r.cliente.codigo} · ` : ''}{x.r.cliente.razao_social}</div> : null}</td>
                    <td>{x.solicitante || '—'}</td>
                    <td>{x.obra || '—'}</td>
                    <td>{x.variante || '—'}</td>
                    <td><FrEtiqueta r={x.r} /></td>
                    <td>{frData(x.quando)}</td>
                  </tr>
                ))}
                {!lista.length ? <tr><td colSpan={6} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhum formulário respondido ainda.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {aberto ? <FrDetalhe r={aberto} catalogo={catalogo} onClose={() => setAberto(null)} /> : null}
    </div>
  );
}

window.FormulariosRespondidosPage = FormulariosRespondidosPage;
