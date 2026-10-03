/* ============================================================
   pcp.jsx — PCP · Planejamento e Controle da Produção (Logística Interna).
   1ª entrega: Ordens de Produção com etapas (pcp_ordens, pcp_ordem_etapas, pcp_ordem_materiais).
   A OP guarda um snapshot dos materiais da estrutura (pcp_estrutura) na abertura, tem etapas
   com status/responsável/data e, ao concluir, registra produzido × perdido (eficiência).
   Interna por ora: não escreve no Omie (omie_op_id reservado para a futura ligação com produtos/op).
   Planejamento mensal (pcp_plano) e Controle (leitura das OPs) completam o módulo.
   ============================================================ */

const PCP_STATUS = { aguardando: 'Aguardando', em_producao: 'Em produção', concluida: 'Concluída', cancelada: 'Cancelada' };
const PCP_ETAPA_STATUS = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };

function pcpFmt(v, d = 3) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); }
function pcpData(d) { return d ? d.split('-').reverse().join('/') : '—'; }
function pcpEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pcpMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function pcpHoje() { return new Date().toISOString().slice(0, 10); }
function pcpUsuario() { return (window.__VP_USER && window.__VP_USER.email) || null; }

// Explode a estrutura até os materiais folha (por 1 unidade, já com perda). Protege contra ciclo.
function pcpExplodir(raiz, filhos, mult, acc, pilha) {
  (filhos[raiz] || []).forEach(f => {
    if (pilha.includes(f.codigo_filho)) return;
    const q = Number(f.quantidade || 0) * mult * (1 + Number(f.perda_pct || 0) / 100);
    if ((filhos[f.codigo_filho] || []).length) pcpExplodir(f.codigo_filho, filhos, q, acc, [...pilha, f.codigo_filho]);
    else acc[f.codigo_filho] = (acc[f.codigo_filho] || 0) + q;
  });
  return acc;
}

function PCPStatusTag({ status, mapa }) {
  const cor = status === 'concluida' ? 'color-mix(in srgb, #2e9e5b 25%, transparent)'
    : status === 'em_producao' || status === 'em_andamento' ? 'color-mix(in srgb, var(--vp-yellow) 35%, transparent)'
    : status === 'cancelada' ? 'color-mix(in srgb, var(--vp-danger, #c0392b) 20%, transparent)' : undefined;
  return <span className="pcp-tag" style={cor ? { background: cor } : undefined}>{mapa[status] || status}</span>;
}

/* ---------------- Nova OP ---------------- */
function PCPNovaOrdem({ ctx, onCriada, onCancelar }) {
  const { sb, dados } = ctx;
  const [f, setF] = React.useState({ produto: '', quantidade: 1, cliente: '', numero_cotacao: '', previsao_inicio: '', prazo_entrega: '', observacao: '' });
  const [salvando, setSalvando] = React.useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const materiais = React.useMemo(() => f.produto ? pcpExplodir(f.produto, dados.filhos, 1, {}, [f.produto]) : {}, [f.produto, dados]);

  const criar = async () => {
    const qtd = Number(f.quantidade);
    if (!f.produto) { window.toast?.('Escolha o produto.'); return; }
    if (!(qtd > 0)) { window.toast?.('Informe uma quantidade maior que zero.'); return; }
    setSalvando(true);
    try {
      const { data: op, error } = await sb.from('pcp_ordens').insert({
        produto: f.produto, quantidade: qtd, cliente: f.cliente.trim() || null,
        numero_cotacao: f.numero_cotacao ? Number(f.numero_cotacao) : null,
        previsao_inicio: f.previsao_inicio || null, prazo_entrega: f.prazo_entrega || null,
        observacao: f.observacao.trim() || null, criado_por: pcpUsuario(),
      }).select('id, numero').single();
      if (error || !op) throw new Error(error?.message || 'sem permissão');
      const mats = Object.keys(materiais).sort().map(c => ({ ordem_id: op.id, codigo: c, quantidade_unit: materiais[c], necessario: materiais[c] * qtd }));
      if (mats.length) { const r = await sb.from('pcp_ordem_materiais').insert(mats); if (r.error) throw new Error(r.error.message); }
      const { data: modelo } = await sb.from('pcp_etapas_modelo').select('posicao, nome, setor').eq('ativo', true).order('posicao');
      const etapas = (modelo || []).map(m => ({ ordem_id: op.id, posicao: m.posicao, nome: m.nome, setor: m.setor }));
      if (etapas.length) { const r = await sb.from('pcp_ordem_etapas').insert(etapas); if (r.error) throw new Error(r.error.message); }
      window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Abriu ordem de produção', alvo: `${op.numero} — ${f.produto} × ${qtd}` });
      window.toast?.(`${op.numero} criada.`);
      onCriada(op.id);
    } catch (e) {
      window.toast?.('Não foi possível criar a OP: ' + e.message);
    }
    setSalvando(false);
  };

  return (
    <div className="card pcp-toolbar" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" value={f.produto} onChange={e => set('produto', e.target.value)} style={{ minWidth: 320 }}>
          <option value="">Produto…</option>
          {ctx.pais.map(c => <option key={c} value={c}>{c} — {dados.prods[c]?.descricao || ''}</option>)}
        </select>
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Qtd <input className="input" type="number" min="1" value={f.quantidade} onChange={e => set('quantidade', e.target.value)} style={{ width: 80 }}/></label>
        <input className="input" placeholder="Cliente" value={f.cliente} onChange={e => set('cliente', e.target.value)} style={{ width: 200 }}/>
        <input className="input" type="number" placeholder="Nº cotação" value={f.numero_cotacao} onChange={e => set('numero_cotacao', e.target.value)} style={{ width: 110 }}/>
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Início <input className="input" type="date" value={f.previsao_inicio} onChange={e => set('previsao_inicio', e.target.value)}/></label>
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Prazo <input className="input" type="date" value={f.prazo_entrega} onChange={e => set('prazo_entrega', e.target.value)}/></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Observação (opcional)" value={f.observacao} onChange={e => set('observacao', e.target.value)} style={{ flex: 1, minWidth: 240 }}/>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{f.produto ? `${Object.keys(materiais).length} materiais serão listados` : ''}</span>
        <button className="btn btn--sm btn--primary" disabled={salvando} onClick={criar}>Criar OP</button>
        <button className="btn btn--sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/* ---------------- Detalhe da OP ---------------- */
/* Baixa de produção no estoque do Omie: ao concluir a OP, a matéria-prima SAI e o produto acabado ENTRA.
   ESCRITA REAL no Omie (função pcp-omie-escrever, ação baixa_producao): primeiro mostra o que será lançado
   (simulação, sem gravar nada), o almoxarife pode corrigir o consumo real e só então confirma.
   Só OP com produto acabado; corte não movimenta (a NF do pedido já dá a saída). */
function PCPBaixaOmie({ op, prods, onMudou }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [pode, setPode] = React.useState(false);
  const [plano, setPlano] = React.useState(null);
  const [consumo, setConsumo] = React.useState({});
  const [ocupado, setOcupado] = React.useState(false);
  const [aviso, setAviso] = React.useState(null);
  const [decisoes, setDecisoes] = React.useState({});   // 'TIPO:CODIGO' -> 'lancar' (só vale p/ linhas que o Omie já tem)
  const [valores, setValores] = React.useState({});     // custo informado para componente sem custo cadastrado
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'escrever_omie')).then(v => { if (vivo) setPode(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (op.status !== 'concluida' || !op.produto) return null;
  if (op.baixa_omie_em) {
    const r = op.baixa_omie_resumo || {};
    return (
      <div className="card pcp-total" style={{ padding: 14, marginBottom: 12, fontSize: 13 }}>
        <b style={{ fontWeight: 500 }}>Baixa no estoque do Omie lançada</b> em {new Date(op.baixa_omie_em).toLocaleString('pt-BR')} por {op.baixa_omie_por || '—'}
        {' '}· {r.saidas ?? 0} componente(s){r.ja_no_omie ? ` (${r.ja_no_omie} linha(s) já constavam no Omie e não foram tocadas)` : ' baixado(s)'}{r.entrada ? ` · entrada de ${pcpFmt(r.entrada.quantidade, 0)} × ${r.entrada.codigo}` : ''}.
      </div>
    );
  }
  if (!pode) return null;

  const chamar = async (corpo) => {
    const { data, error } = await sb.functions.invoke('pcp-omie-escrever', { body: { solicitante: pcpUsuario(), acao: 'baixa_producao', ordem_id: op.id, ...corpo } });
    if (!error) return data;
    let j = null; try { j = await error.context.json(); } catch (e) { /* sem corpo */ }
    return j || { error: error.message };
  };
  const valoresNum = () => { const v = {}; Object.entries(valores).forEach(([k, x]) => { const n = Number(String(x).replace(',', '.')); if (n > 0) v[k] = n; }); return v; };
  const preparar = async () => {
    setOcupado(true); setAviso(null);
    const r = await chamar({ simular: true, decisoes: {}, consumo: Object.keys(consumo).length ? numConsumo() : undefined, valores: valoresNum() });
    setOcupado(false);
    if (r.error) { setPlano(null); setAviso({ texto: r.error, problemas: r.problemas || [] }); return; }
    setPlano(r); setDecisoes({});
    const c = {}; r.linhas.filter(l => l.tipo === 'SAI').forEach(l => { c[l.codigo] = String(l.quantidade); });
    setConsumo(c);
  };
  const numConsumo = () => { const o = {}; Object.entries(consumo).forEach(([k, v]) => { o[k] = Number(String(v).replace(',', '.')); }); return o; };
  const confirmar = async () => {
    const alvo = plano.linhas.filter(vaiLancar);
    const jaTem = plano.linhas.length - alvo.length;
    const msg = alvo.length
      ? `Lançar NO OMIE (estoque real): ${alvo.length} movimento(s) novo(s) de ${op.numero}.${jaTem ? `
${jaTem} linha(s) já constam no Omie e NÃO serão tocadas.` : ''}`
      : `Todas as ${plano.linhas.length} linhas já constam no Omie. Nada será lançado; a baixa de ${op.numero} será apenas marcada como feita. Continuar?`;
    if (!window.confirm(msg)) return;
    setOcupado(true); setAviso(null);
    const r = await chamar({ consumo: numConsumo(), valores: valoresNum(), decisoes });
    setOcupado(false);
    window.VPLog?.registrar?.({ modulo: 'PCP', acao: r.ok ? 'Lançou baixa de produção no Omie' : 'Tentou baixa de produção no Omie', alvo: `${op.numero} — ${r.ok ? `${r.feitas} movimento(s)` : (r.error || 'incompleta')}` });
    if (r.ok) { window.toast?.('Baixa lançada no Omie.'); setPlano(null); onMudou && onMudou(); return; }
    setAviso({ texto: r.error || (r.parcial ? `Parou por tempo: ${r.feitas} lançado(s), faltam ${r.restantes}. Clique em Confirmar de novo para continuar (o que já foi não se repete).` : `${r.feitas || 0} lançado(s); houve falhas. Corrija e confirme de novo (o que já foi não se repete).`), erros: r.erros || [], problemas: r.problemas || [] });
  };
  const vaiLancar = (l) => l.situacao === 'novo' || decisoes[l.tipo + ':' + l.codigo] === 'lancar';
  const qtdIgual = (l) => Number(String(consumo[l.codigo] ?? l.quantidade).replace(',', '.')) === l.quantidade;

  return (
    <div className="card pcp-total" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontWeight: 500 }}>Baixa no estoque do Omie</b>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>OP concluída: lança a saída dos componentes e a entrada do produto acabado.</span>
        <span style={{ flex: 1 }}/>
        {!plano && <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={preparar}>{ocupado ? 'Calculando…' : 'Preparar baixa'}</button>}
        {plano && <button className="btn btn--sm" disabled={ocupado} onClick={() => { setPlano(null); setAviso(null); }}>Cancelar</button>}
        {plano && <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={confirmar}>{ocupado ? 'Lançando no Omie…' : 'Confirmar e lançar no Omie'}</button>}
      </div>
      {aviso && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--vp-danger)' }}>
          {aviso.texto}
          {(aviso.problemas || []).map(p => (
            <div key={p.codigo} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span>• {p.codigo}: {p.motivo}</span>
              {/custo/i.test(p.motivo) && <input className="input" style={{ width: 90, textAlign: 'right' }} placeholder="R$ unit." value={valores[p.codigo] ?? ''} onChange={e => setValores({ ...valores, [p.codigo]: e.target.value })}/>}
            </div>
          ))}
          {(aviso.problemas || []).some(p => /custo/i.test(p.motivo)) && <button className="btn btn--sm" style={{ marginTop: 6 }} disabled={ocupado} onClick={preparar}>Recalcular com os valores informados</button>}
          {(aviso.erros || []).map((e, i) => <div key={i}>• {e.codigo} ({e.tipo}): {e.erro}</div>)}
        </div>
      )}
      {plano && (
        <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 10 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Movimento</th><th>Código</th><th>Descrição</th><th className="text-right">Quantidade</th><th>Situação no Omie</th></tr></thead>
            <tbody>
              {plano.linhas.map(l => (
                <tr key={l.tipo + l.codigo}>
                  <td><span className="pcp-tag" style={l.tipo === 'ENT' ? { background: 'color-mix(in srgb, #2e9e5b 25%, transparent)' } : undefined}>{l.tipo === 'SAI' ? 'Saída (consumo)' : 'Entrada (acabado)'}</span></td>
                  <td>{l.codigo}</td>
                  <td>{(prods[l.codigo] || {}).descricao || ''}</td>
                  <td className="text-right">{l.tipo === 'SAI'
                    ? <input className="input" style={{ width: 90, textAlign: 'right', ...(qtdIgual(l) ? {} : { outline: '2px solid var(--vp-yellow)' }) }} value={consumo[l.codigo] ?? ''} onChange={e => setConsumo({ ...consumo, [l.codigo]: e.target.value })}/>
                    : pcpFmt(l.quantidade, 0)}</td>
                  <td style={{ minWidth: 250, fontSize: 12 }}>
                    {l.situacao === 'novo' && <span className="pcp-tag">novo — será lançado</span>}
                    {l.situacao !== 'novo' && (<>
                      <span className="pcp-tag" style={{ background: l.situacao === 'igual' ? 'color-mix(in srgb, #2e9e5b 25%, transparent)' : 'color-mix(in srgb, var(--vp-yellow) 40%, transparent)' }}>
                        {l.situacao === 'igual' ? 'já consta no Omie — não mexer' : 'Omie tem quantidade diferente'}
                      </span>
                      <div style={{ color: 'var(--fg3)' }}>{l.omie.map((o, i) => <span key={i}>{o.data.split('-').reverse().join('/')}: {o.tipo === 'SAI' ? 'saída' : 'entrada'} de {pcpFmt(o.quantidade)}{o.origem_pcp ? ' (PCP)' : ' (manual)'}{i < l.omie.length - 1 ? ' · ' : ''}</span>)}</div>
                      <select className="input" style={{ marginTop: 3 }} value={decisoes[l.tipo + ':' + l.codigo] || 'pular'} onChange={e => setDecisoes({ ...decisoes, [l.tipo + ':' + l.codigo]: e.target.value })}>
                        <option value="pular">Não mexer</option>
                        <option value="lancar">Lançar mesmo assim</option>
                      </select>
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>
            Antes de lançar, cada linha é comparada com os ajustes que o Omie já tem (a partir de 7 dias antes da abertura da OP): o que já consta não é tocado. Consumo proporcional ao produzido + perdido ({pcpFmt(plano.produzida, 0)} + {pcpFmt(plano.perdida, 0)}); corrija se o consumo real foi outro. No Omie os lançamentos aparecem como ajuste de estoque (motivo “Inventário”) com a OP na observação.
          </div>
        </div>
      )}
    </div>
  );
}

function PCPOrdemDetalhe({ ctx, id, onVoltar, onMudou, abrir }) {
  const { sb, dados, podeEditar } = ctx;
  const [op, setOp] = React.useState(null);
  const [etapas, setEtapas] = React.useState([]);
  const [mats, setMats] = React.useState([]);
  const [lista, setLista] = React.useState([]);     // checklist da OP
  const [filhos, setFilhos] = React.useState([]);    // frentes (quando é OP-mãe)
  const [mae, setMae] = React.useState(null);        // OP-mãe (quando é frente)
  const [fim, setFim] = React.useState({ produzida: '', perdida: 0, causa: '', acao: '' });
  const [mostrarFim, setMostrarFim] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const [o, e, m, ck, fl] = await Promise.all([
      sb.from('pcp_ordens').select('*').eq('id', id).single(),
      sb.from('pcp_ordem_etapas').select('*').eq('ordem_id', id).order('posicao'),
      sb.from('pcp_ordem_materiais').select('*').eq('ordem_id', id).order('codigo'),
      sb.from('pcp_ordem_checklist').select('*').eq('ordem_id', id).order('posicao'),
      sb.from('pcp_ordens').select('id, numero, titulo, produto, frente, status').eq('ordem_mae_id', id).order('numero'),
    ]);
    if (o.data) { setOp(o.data); setFim(f => ({ ...f, produzida: f.produzida === '' ? o.data.quantidade : f.produzida })); }
    setEtapas(e.data || []); setMats(m.data || []); setLista(ck.data || []); setFilhos(fl.data || []);
    if (o.data && o.data.ordem_mae_id) {
      const { data: mm } = await sb.from('pcp_ordens').select('id, numero, titulo').eq('id', o.data.ordem_mae_id).single();
      setMae(mm || null);
    } else setMae(null);
  }, [sb, id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // ---- mão de obra (hora-homem): o operador escolhe QUEM e QUANTAS HORAS; o valor da hora vem do Omie pela função pcp-hh e fica oculto ----
  const [hh, setHh] = React.useState([]);
  const [pessoas, setPessoas] = React.useState([]);
  const [podeHH, setPodeHH] = React.useState(false);
  const [verHH, setVerHH] = React.useState(false);
  const [podeVerCustoMat, setPodeVerCustoMat] = React.useState(false);
  const [custosHH, setCustosHH] = React.useState({});
  const [totalHH, setTotalHH] = React.useState(null);
  const [totalMat, setTotalMat] = React.useState(null);
  const [formHH, setFormHH] = React.useState({ email: '', horas: '', obs: '' });
  const [editHH, setEditHH] = React.useState(null);
  const [avisoHH, setAvisoHH] = React.useState(null);
  const [ocupadoHH, setOcupadoHH] = React.useState(false);
  const [cands, setCands] = React.useState([]);              // favorecidos das categorias de salário no Omie (só nomes)
  const [escolhaFolha, setEscolhaFolha] = React.useState('');
  const [carregandoFolha, setCarregandoFolha] = React.useState(false);

  const idsOrdem = React.useMemo(() => [id, ...filhos.map(f => f.id)], [id, filhos]);
  const chamarHH = React.useCallback(async (corpo) => {
    const { data, error } = await sb.functions.invoke('pcp-hh', { body: { ...corpo, solicitante_email: pcpUsuario() } });
    if (error) { let msg = error.message; try { const j = await error.context.json(); msg = j.error || msg; } catch (e) { /* mantém */ } throw new Error(msg); }
    return data;
  }, [sb]);
  const carregarHH = React.useCallback(async () => {
    const { data } = await sb.from('pcp_hh_apontamentos').select('*').in('ordem_id', idsOrdem).order('created_at');
    setHh(data || []);
    if (verHH && (data || []).length) {
      try {
        const r = await chamarHH({ acao: 'custos', ordem_ids: idsOrdem });
        setCustosHH(r.custos || {});
        setTotalHH(Object.values(r.total_por_ordem || {}).reduce((s, v) => s + Number(v), 0));
      } catch (e) { setCustosHH({}); setTotalHH(null); }
    } else { setCustosHH({}); setTotalHH(verHH ? 0 : null); }
  }, [sb, idsOrdem, verHH, chamarHH]);
  React.useEffect(() => { carregarHH(); }, [carregarHH]);
  React.useEffect(() => {
    let vivo = true; const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('pcp', 'apontar_hh')).then(v => { if (vivo) setPodeHH(!!v); }).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('pcp', 'ver_hh')).then(v => { if (vivo) setVerHH(!!v); }).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => { if (vivo) setPodeVerCustoMat(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  React.useEffect(() => {
    if (!podeHH) return;
    sb.from('perfis').select('email, nome, departamento').eq('ativo', true).order('nome').then(({ data }) => setPessoas(data || []));
  }, [sb, podeHH]);
  React.useEffect(() => {   // custo dos materiais: só é buscado por quem pode ver custo
    if (!podeVerCustoMat) { setTotalMat(null); return; }
    let vivo = true;
    (async () => {
      const { data: ms } = await sb.from('pcp_ordem_materiais').select('codigo, necessario').in('ordem_id', idsOrdem);
      const cods = Array.from(new Set((ms || []).map(m => m.codigo)));
      if (!cods.length) { if (vivo) setTotalMat(0); return; }
      const { data: ps } = await sb.from('pcp_produtos').select('codigo, preco_custo, custo_manual').in('codigo', cods);
      const c = {}; (ps || []).forEach(p => { c[p.codigo] = rpCustoEfetivo(p); });
      if (vivo) setTotalMat((ms || []).reduce((s, m) => s + Number(m.necessario) * (c[m.codigo] || 0), 0));
    })();
    return () => { vivo = false; };
  }, [sb, idsOrdem, podeVerCustoMat, mats]);

  if (!op) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const encerrada = op.status === 'concluida' || op.status === 'cancelada';
  const editavel = podeEditar && !encerrada;
  const ehMae = op.frente === 'pedido';
  const todasConcluidas = ehMae
    ? filhos.length > 0 && filhos.every(f => f.status === 'concluida' || f.status === 'cancelada')
    : etapas.length > 0 && etapas.every(e => e.status === 'concluida');

  const atualizarOp = async (patch, log) => {
    const { data, error } = await sb.from('pcp_ordens').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível salvar.'); return false; }
    if (log) window.VPLog?.registrar?.({ modulo: 'PCP', acao: log, alvo: `${op.numero} — ${op.titulo || op.produto}` });
    await carregar(); onMudou();
    return true;
  };
  const atualizarEtapa = async (e, patch) => {
    const p = { ...patch };
    if (patch.status === 'concluida') p.data_conclusao = pcpHoje();
    if (patch.status && patch.status !== 'concluida') p.data_conclusao = null;
    const { data, error } = await sb.from('pcp_ordem_etapas').update(p).eq('id', e.id).select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível salvar a etapa.'); return; }
    if (patch.status) window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Etapa da OP: ' + PCP_ETAPA_STATUS[patch.status], alvo: `${op.numero} — ${e.nome}` });
    if (patch.status && patch.status !== 'pendente' && op.status === 'aguardando') await atualizarOp({ status: 'em_producao' }, 'Iniciou produção');
    else { await carregar(); onMudou(); }
  };
  const atualizarMat = async (m, separado) => {
    const v = Number(separado);
    if (!(v >= 0) || v === Number(m.separado)) return;
    const { data, error } = await sb.from('pcp_ordem_materiais').update({ separado: v }).eq('id', m.id).select('id');
    if (error || !data || !data.length) window.toast?.('Não foi possível salvar o material.');
    await carregar();
  };
  // ---- mão de obra: ações (o valor da hora nunca passa por aqui; quem calcula é a função pcp-hh) ----
  const nomePessoa = (email) => (pessoas.find(p => p.email === email) || {}).nome || email;
  const apontarHH = async () => {
    if (!formHH.email || !(Number(String(formHH.horas).replace(',', '.')) > 0)) { window.toast?.('Escolha a pessoa e informe as horas.'); return; }
    setOcupadoHH(true); setAvisoHH(null);
    try {
      const r = await chamarHH({ acao: 'apontar', ordem_id: id, colaborador_email: formHH.email, horas: formHH.horas, observacao: formHH.obs });
      if (r.custo_calculado === false) { setAvisoHH({ mensagem: r.mensagem, apontamento_id: r.apontamento_id }); setCands(r.candidatos || []); }
      window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Apontou mão de obra', alvo: `${op.numero} — ${nomePessoa(formHH.email)}: ${formHH.horas} h` });
      setFormHH({ email: '', horas: '', obs: '' }); await carregarHH(); onMudou();
    } catch (e) { window.toast?.(e.message); }
    setOcupadoHH(false);
  };
  const salvarEdicaoHH = async () => {
    if (!editHH || !(Number(String(editHH.horas).replace(',', '.')) > 0)) { window.toast?.('Informe as horas.'); return; }
    setOcupadoHH(true); setAvisoHH(null);
    try {
      const r = await chamarHH({ acao: 'editar', apontamento_id: editHH.id, colaborador_email: editHH.email, horas: editHH.horas });
      if (r.custo_calculado === false) { setAvisoHH({ mensagem: r.mensagem, apontamento_id: r.apontamento_id }); setCands(r.candidatos || []); }
      window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Alterou mão de obra', alvo: `${op.numero} — ${nomePessoa(editHH.email)}: ${editHH.horas} h` });
      setEditHH(null); await carregarHH();
    } catch (e) { window.toast?.(e.message); }
    setOcupadoHH(false);
  };
  const removerHH = async (a) => {
    if (!window.confirm(`Remover o apontamento de ${a.colaborador_nome || a.colaborador_email}?`)) return;
    try {
      await chamarHH({ acao: 'remover', apontamento_id: a.id });
      window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Removeu mão de obra', alvo: `${op.numero} — ${a.colaborador_nome || a.colaborador_email}` });
      await carregarHH();
    } catch (e) { window.toast?.(e.message); }
  };
  const vincularCpfHH = async (a) => {
    const cpf = window.prompt('CPF ou CNPJ da pessoa (só serve para localizar o cadastro dela no Omie; fica salvo como vínculo):');
    if (!cpf) return;
    try {
      const r = await chamarHH({ acao: 'editar', apontamento_id: a.id, horas: a.horas, cpf });
      setAvisoHH(r.custo_calculado === false ? { mensagem: r.mensagem, apontamento_id: a.id } : null);
      await carregarHH();
    } catch (e) { window.toast?.(e.message); }
  };
  const carregarFolhaHH = async (recarregar) => {
    setCarregandoFolha(true);
    try {
      const r = await chamarHH({ acao: 'candidatos', recarregar: !!recarregar });
      setCands(r.candidatos || []);
      if (r.completo === false) window.toast?.('A leitura do Omie foi parcial; recarregue a lista para completar.');
    } catch (e) { window.toast?.(e.message); }
    setCarregandoFolha(false);
  };
  const vincularEscolhaHH = async (apontamentoId, codigo) => {
    const a = hh.find(x => x.id === apontamentoId);
    if (!a || !codigo) return;
    setOcupadoHH(true);
    try {
      const r = await chamarHH({ acao: 'editar', apontamento_id: a.id, horas: a.horas, omie_codigo: codigo });
      setAvisoHH(r.custo_calculado === false ? { mensagem: r.mensagem, apontamento_id: a.id } : null);
      if (r.custo_calculado !== false) setEscolhaFolha('');
      window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Vinculou colaborador ao Omie', alvo: `${op.numero} — ${a.colaborador_nome || a.colaborador_email}` });
      await carregarHH();
    } catch (e) { window.toast?.(e.message); }
    setOcupadoHH(false);
  };
  const nomeOpHH = (oid) => oid === id ? op.numero : ((filhos.find(f => f.id === oid) || {}).numero || '');
  const totalHoras = hh.reduce((s, a) => s + Number(a.horas), 0);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const doSetor = (p) => /logistica|engenharia|producao/.test(norm(p.departamento));
  const opcoesPessoa = (valor, onChange) => (
    <select className="input" value={valor} onChange={e => onChange(e.target.value)} style={{ minWidth: 240 }}>
      <option value="">Quem trabalhou…</option>
      <optgroup label="Logística, Engenharia e Produção">{pessoas.filter(doSetor).map(p => <option key={p.email} value={p.email}>{p.nome}{p.departamento ? ' · ' + p.departamento : ''}</option>)}</optgroup>
      <optgroup label="Outros setores">{pessoas.filter(p => !doSetor(p)).map(p => <option key={p.email} value={p.email}>{p.nome}{p.departamento ? ' · ' + p.departamento : ''}</option>)}</optgroup>
    </select>
  );
  const marcarCk = async (it, feito) => {
    const quem = (window.__VP_USER && window.__VP_USER.email) || null;
    const { data, error } = await sb.from('pcp_ordem_checklist').update({ feito, feito_por: feito ? quem : null, feito_em: feito ? new Date().toISOString() : null }).eq('id', it.id).select('id');
    if (error || !data || !data.length) { window.toast?.('Não foi possível salvar o checklist.'); return; }
    window.VPLog?.registrar?.({ modulo: 'PCP', acao: feito ? 'Marcou item do checklist' : 'Desmarcou item do checklist', alvo: `${op.numero} — ${it.descricao}` });
    await carregar();
  };
  const concluirMae = async () => {
    if (!window.confirm(`Concluir o pedido ${op.numero}? Todas as frentes estão concluídas.`)) return;
    await atualizarOp({ status: 'concluida', data_finalizacao: pcpHoje(), qtd_produzida: op.quantidade, qtd_perdida: 0 }, 'Concluiu pedido');
  };
  const concluir = async () => {
    const prod = Number(fim.produzida), perd = Number(fim.perdida) || 0;
    if (!(prod >= 0)) { window.toast?.('Informe a quantidade produzida.'); return; }
    const ok = await atualizarOp({ status: 'concluida', data_finalizacao: pcpHoje(), qtd_produzida: prod, qtd_perdida: perd, causa_perda: fim.causa.trim() || null, acao_corretiva: fim.acao.trim() || null }, 'Concluiu ordem de produção');
    if (ok) setMostrarFim(false);
  };
  const cancelar = async () => {
    if (!window.confirm(`Cancelar a ${op.numero}? Ela continua no histórico.`)) return;
    await atualizarOp({ status: 'cancelada' }, 'Cancelou ordem de produção');
  };
  const imprimir = () => {
    const prod = dados.prods[op.produto];
    const linhasMat = mats.map((m, i) => `<tr><td>${i + 1}</td><td>${pcpEsc(m.codigo)}</td><td>${pcpEsc(dados.prods[m.codigo]?.descricao || '')}</td><td style="text-align:right">${pcpFmt(m.quantidade_unit)}</td><td style="text-align:right">${pcpFmt(m.necessario)}</td><td>${pcpEsc(dados.prods[m.codigo]?.unidade || '')}</td><td style="text-align:right">${pcpFmt(m.separado)}</td></tr>`).join('');
    const linhasCk = lista.map(it => `<tr><td>${it.feito ? '☑' : '☐'}</td><td>${pcpEsc(it.descricao)}</td><td style="text-align:right">${it.quantidade != null ? pcpFmt(it.quantidade) : ''}</td><td>${pcpEsc(it.unidade || '')}</td><td>${pcpEsc(it.observacao || '')}</td></tr>`).join('');
    const linhasEt = etapas.map(e => `<tr><td>${e.posicao}</td><td>${pcpEsc(e.nome)}</td><td>${pcpEsc(e.setor || '')}</td><td>${pcpEsc(e.responsavel || '')}</td><td>${pcpData(e.data_prevista)}</td><td>${PCP_ETAPA_STATUS[e.status]}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) { window.toast?.('Permita pop-ups para imprimir.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${pcpEsc(op.numero)}</title><style>
      body{font-family:Poppins,Arial,sans-serif;font-weight:300;font-size:12px;margin:28px;color:#111}
      h1{font-size:18px;font-weight:500;text-align:center;margin:0 0 14px}
      table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#eee;font-weight:500;font-size:11px;text-transform:uppercase}
      .g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 18px;margin-bottom:8px}.g b{font-weight:500}
      .ass{display:flex;gap:40px;margin-top:60px}.ass div{flex:1;border-top:1px solid #111;text-align:center;padding-top:4px}
    </style></head><body>
      <h1>ORDEM DE PRODUÇÃO ${pcpEsc(op.numero)}</h1>
      <div class="g"><div><b>Produto:</b> ${pcpEsc(op.produto || op.titulo || '')}</div><div><b>Quantidade:</b> ${pcpFmt(op.quantidade, 0)}</div><div><b>Cliente:</b> ${pcpEsc(op.cliente || '—')}</div>
      <div><b>Descrição:</b> ${pcpEsc(prod?.descricao || '')}</div><div><b>Início previsto:</b> ${pcpData(op.previsao_inicio)}</div><div><b>Prazo de entrega:</b> ${pcpData(op.prazo_entrega)}</div>
      <div><b>Abertura:</b> ${pcpData(op.data_abertura)}</div><div><b>Cotação:</b> ${op.numero_cotacao ?? '—'}</div><div><b>Finalização:</b> ${pcpData(op.data_finalizacao)}</div></div>
      ${op.observacao ? `<p><b>Observação:</b> ${pcpEsc(op.observacao)}</p>` : ''}
      ${lista.length ? '<h3 style="font-weight:500">Checklist</h3><table><tr><th></th><th>Item</th><th>Qtd</th><th>Un.</th><th>Observação</th></tr>' + linhasCk + '</table>' : ''}
      ${etapas.length ? '<h3 style="font-weight:500">Etapas</h3><table><tr><th>#</th><th>Etapa</th><th>Setor</th><th>Responsável</th><th>Prevista</th><th>Status</th></tr>' + linhasEt + '</table>' : ''}
      <!--<tr><th>#</th><th>Etapa</th><th>Setor</th><th>Responsável</th><th>Prevista</th><th>Status</th></tr>${linhasEt}</table>-->
      ${mats.length ? '<h3 style="font-weight:500">Materiais</h3>' : ''}<table><tr><th>Item</th><th>Código</th><th>Componente</th><th>Qtd por un.</th><th>Total necessário</th><th>Un.</th><th>Separado</th></tr>${linhasMat}</table>
      <div class="ass"><div>Responsável pela produção</div><div>Qualidade</div><div>Almoxarifado</div></div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  const eficiencia = op.status === 'concluida' && op.qtd_produzida != null ? (Number(op.qtd_produzida) / Number(op.quantidade)) * 100 : null;
  const perdida = Number(op.qtd_perdida || 0);

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={onVoltar}>← Ordens</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{op.numero}{op.titulo ? ' · ' + op.titulo : ''}</b>
        <PCPStatusTag status={op.status} mapa={PCP_STATUS}/>
        {mae && <button className="pcp-cod" title="Abrir o pedido (OP-mãe)" onClick={() => abrir(mae.id)}>pedido {mae.numero}</button>}
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm" onClick={imprimir}>Imprimir / PDF</button>
        {editavel && op.status === 'aguardando' && <button className="btn btn--sm" onClick={() => atualizarOp({ status: 'em_producao' }, 'Iniciou produção')}>Iniciar produção</button>}
        {editavel && <button className="btn btn--sm btn--primary" disabled={!todasConcluidas} title={todasConcluidas ? '' : (ehMae ? 'Conclua todas as frentes primeiro' : 'Conclua todas as etapas primeiro')} onClick={() => (ehMae ? concluirMae() : setMostrarFim(m => !m))}>{ehMae ? 'Concluir pedido' : 'Concluir OP'}</button>}
        {editavel && <button className="btn btn--sm" onClick={cancelar}>Cancelar OP</button>}
      </div>

      <div className="card pcp-total" style={{ padding: 14, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px 20px', fontSize: 13 }}>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{op.produto ? 'Produto' : 'Frente'}</div>{op.produto ? <><button className="pcp-cod" onClick={() => window.pcpIrPara?.(ctx.nav, 'montagem-produto', 'vp_pcp_pai', op.produto)}>{op.produto}</button><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{dados.prods[op.produto]?.descricao}</div></> : (op.titulo || '—')}</div>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Quantidade</div>{pcpFmt(op.quantidade, 0)}</div>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Cliente</div>{op.cliente || '—'}{op.numero_cotacao ? ` · cotação ${op.numero_cotacao}` : ''}</div>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Início previsto</div>{pcpData(op.previsao_inicio)}</div>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Prazo de entrega</div>{pcpData(op.prazo_entrega)}</div>
        <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Abertura / finalização</div>{pcpData(op.data_abertura)} → {pcpData(op.data_finalizacao)}</div>
        {eficiencia != null && <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Resultado</div>{pcpFmt(op.qtd_produzida, 0)} produzidas · {pcpFmt(perdida, 0)} perdidas · eficiência {pcpFmt(eficiencia, 1)}%{op.causa_perda ? ` · causa: ${op.causa_perda}` : ''}{op.acao_corretiva ? ` · ação: ${op.acao_corretiva}` : ''}</div>}
        {op.observacao && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Observação</div>{op.observacao}</div>}
      </div>

      {mostrarFim && (
        <div className="card pcp-toolbar" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Produzidas <input className="input" type="number" min="0" value={fim.produzida} onChange={e => setFim({ ...fim, produzida: e.target.value })} style={{ width: 90 }}/></label>
          <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Perdidas <input className="input" type="number" min="0" value={fim.perdida} onChange={e => setFim({ ...fim, perdida: e.target.value })} style={{ width: 90 }}/></label>
          <input className="input" placeholder="Causa da perda (se houver)" value={fim.causa} onChange={e => setFim({ ...fim, causa: e.target.value })} style={{ flex: 1, minWidth: 200 }}/>
          <input className="input" placeholder="Ação corretiva" value={fim.acao} onChange={e => setFim({ ...fim, acao: e.target.value })} style={{ flex: 1, minWidth: 200 }}/>
          <button className="btn btn--sm btn--primary" onClick={concluir}>Confirmar conclusão</button>
        </div>
      )}

      <PCPBaixaOmie op={op} prods={dados.prods} onMudou={async () => { await carregar(); onMudou(); }}/>

      {(verHH || podeVerCustoMat) && (
        <div className="card pcp-total" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Materiais</div><b style={{ fontWeight: 500 }}>{totalMat != null ? pcpMoeda(totalMat) : '—'}</b></div>
          <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Mão de obra ({pcpFmt(totalHoras)} h)</div><b style={{ fontWeight: 500 }}>{totalHH != null ? pcpMoeda(totalHH) : '—'}</b></div>
          {totalMat != null && totalHH != null && <div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>Custo total estimado</div><b style={{ fontWeight: 500, fontSize: 18 }}>{pcpMoeda(totalMat + totalHH)}</b></div>}
          <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Valores visíveis só para quem tem a alçada de custo.</div>
        </div>
      )}

      {(!ehMae || hh.length > 0) && (<>
        <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Mão de obra (hora-homem){hh.length ? ` · ${pcpFmt(totalHoras)} h` : ''}</h3>
        <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="t pcp-grid">
            <thead><tr>{ehMae && <th>OP</th>}<th>Colaborador</th><th>Setor</th><th className="text-right">Horas</th>{verHH && <th className="text-right">Valor da hora</th>}{verHH && <th className="text-right">Custo</th>}<th></th></tr></thead>
            <tbody>
              {hh.map(a => {
                const c = custosHH[a.id];
                const emEdicao = editHH && editHH.id === a.id;
                return (
                  <tr key={a.id}>
                    {ehMae && <td>{nomeOpHH(a.ordem_id)}</td>}
                    <td>{emEdicao ? opcoesPessoa(editHH.email, v => setEditHH({ ...editHH, email: v })) : (a.colaborador_nome || a.colaborador_email)}</td>
                    <td>{a.departamento || '—'}</td>
                    <td className="text-right">{emEdicao ? <input className="input" type="number" min="0" step="any" value={editHH.horas} onChange={e => setEditHH({ ...editHH, horas: e.target.value })} style={{ width: 80 }}/> : pcpFmt(a.horas)}</td>
                    {verHH && <td className="text-right">{c ? pcpMoeda(c.valor_hora) : <button className="pcp-cod" title="Vincular esta pessoa ao cadastro dela no Omie" onClick={() => { setAvisoHH({ mensagem: 'Vincule esta pessoa ao cadastro dela no Omie para calcular o valor da hora.', apontamento_id: a.id }); carregarFolhaHH(false); }}>sem valor — vincular</button>}</td>}
                    {verHH && <td className="text-right" title={c ? c.origem : ''}><b style={{ fontWeight: 500 }}>{c ? pcpMoeda(c.custo) : '—'}</b></td>}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {podeHH && editavel && (emEdicao
                        ? <><button className="btn btn--sm btn--primary" disabled={ocupadoHH} onClick={salvarEdicaoHH}>Salvar</button>{' '}<button className="btn btn--sm" onClick={() => setEditHH(null)}>Cancelar</button></>
                        : <><button className="btn btn--sm" onClick={() => setEditHH({ id: a.id, email: a.colaborador_email, horas: a.horas })}>Trocar</button>{' '}<button className="btn btn--sm" onClick={() => removerHH(a)}>Remover</button></>)}
                    </td>
                  </tr>
                );
              })}
              {hh.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--fg3)' }}>Nenhuma mão de obra apontada.</td></tr>}
            </tbody>
          </table>
          {podeHH && editavel && !ehMae && (
            <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
              {opcoesPessoa(formHH.email, v => setFormHH({ ...formHH, email: v }))}
              <input className="input" type="number" min="0" step="any" placeholder="Horas" value={formHH.horas} onChange={e => setFormHH({ ...formHH, horas: e.target.value })} style={{ width: 90 }}/>
              <button className="btn btn--sm btn--primary" disabled={ocupadoHH} onClick={apontarHH}>{ocupadoHH ? 'Calculando…' : 'Apontar'}</button>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}>O valor da hora é buscado no Omie e fica oculto.</span>
            </div>
          )}
          {avisoHH && (
            <div style={{ padding: '0 12px 12px', fontSize: 12 }}>
              <div style={{ color: 'var(--vp-danger)' }}>{avisoHH.mensagem}</div>
              {podeHH && (
                <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                  {cands.length > 0 && <>
                    <select className="input" value={escolhaFolha} onChange={e => setEscolhaFolha(e.target.value)} style={{ minWidth: 280 }}>
                      <option value="">Quem é na folha do Omie…</option>
                      {cands.map(c => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                    </select>
                    <button className="btn btn--sm btn--primary" disabled={!escolhaFolha || ocupadoHH} onClick={() => vincularEscolhaHH(avisoHH.apontamento_id, escolhaFolha)}>{ocupadoHH ? 'Calculando…' : 'Vincular'}</button>
                  </>}
                  <button className="btn btn--sm" disabled={carregandoFolha} onClick={() => carregarFolhaHH(true)}>{carregandoFolha ? 'Lendo o Omie…' : (cands.length ? 'Recarregar lista da folha' : 'Carregar lista da folha do Omie')}</button>
                  <button className="pcp-cod" onClick={() => { const a = hh.find(x => x.id === avisoHH.apontamento_id); if (a) vincularCpfHH(a); }}>ou informar CPF / CNPJ</button>
                </div>
              )}
            </div>
          )}
        </div>
      </>)}

      {ehMae && (<>
        <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Frentes de produção</h3>
        <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="t pcp-grid">
            <thead><tr><th>OP</th><th>Frente</th><th>Produto</th><th>Status</th></tr></thead>
            <tbody>
              {filhos.map(f => (
                <tr key={f.id}>
                  <td><button className="pcp-cod" onClick={() => abrir(f.id)}>{f.numero}</button></td>
                  <td>{f.titulo || '—'}</td>
                  <td>{f.produto || '—'}</td>
                  <td><PCPStatusTag status={f.status} mapa={PCP_STATUS}/></td>
                </tr>
              ))}
              {filhos.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--fg3)' }}>Sem frentes.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {lista.length > 0 && (<>
        <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Checklist {lista.filter(i => i.feito).length}/{lista.length}</h3>
        <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="t pcp-grid">
            <thead><tr><th style={{ width: 40 }}></th><th>Item</th><th className="text-right">Qtd</th><th>Un.</th><th>Observação</th><th>Feito por</th></tr></thead>
            <tbody>
              {lista.map(it => (
                <tr key={it.id}>
                  <td><input type="checkbox" checked={!!it.feito} disabled={!podeEditar || op.status === 'cancelada'} onChange={e => marcarCk(it, e.target.checked)}/></td>
                  <td>{it.grupo && <span className="pcp-tag" style={{ marginRight: 6 }}>{it.grupo}</span>}{it.descricao}</td>
                  <td className="text-right">{it.quantidade != null ? pcpFmt(it.quantidade) : '—'}</td>
                  <td>{it.unidade || '—'}</td>
                  <td style={{ color: 'var(--fg3)' }}>{it.observacao || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg3)' }}>{it.feito ? (it.feito_por || '') + (it.feito_em ? ' · ' + new Date(it.feito_em).toLocaleDateString('pt-BR') : '') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {!ehMae && (<>
      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Etapas</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="t pcp-grid">
          <thead><tr><th>#</th><th>Etapa</th><th>Setor</th><th>Responsável</th><th>Prevista</th><th>Concluída em</th><th>Status</th></tr></thead>
          <tbody>
            {etapas.map(e => (
              <tr key={e.id}>
                <td>{e.posicao}</td>
                <td>{e.nome}</td>
                <td>{e.setor || '—'}</td>
                <td>{editavel ? <input className="input" defaultValue={e.responsavel || ''} placeholder="—" onBlur={ev => { if (ev.target.value !== (e.responsavel || '')) atualizarEtapa(e, { responsavel: ev.target.value.trim() || null }); }}/> : (e.responsavel || '—')}</td>
                <td>{editavel ? <input className="input" type="date" defaultValue={e.data_prevista || ''} onBlur={ev => { if (ev.target.value !== (e.data_prevista || '')) atualizarEtapa(e, { data_prevista: ev.target.value || null }); }}/> : pcpData(e.data_prevista)}</td>
                <td>{pcpData(e.data_conclusao)}</td>
                <td>{editavel
                  ? <select className="input" value={e.status} onChange={ev => atualizarEtapa(e, { status: ev.target.value })}>{Object.keys(PCP_ETAPA_STATUS).map(k => <option key={k} value={k}>{PCP_ETAPA_STATUS[k]}</option>)}</select>
                  : <PCPStatusTag status={e.status} mapa={PCP_ETAPA_STATUS}/>}</td>
              </tr>
            ))}
            {etapas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--fg3)' }}>Sem etapas.</td></tr>}
          </tbody>
        </table>
      </div>
      </>)}

      {(mats.length > 0 || !op.frente) && (<>
      <h3 style={{ margin: '8px 0', fontWeight: 500, fontSize: 14 }}>Materiais</h3>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Código</th><th>Componente</th><th className="text-right">Por unidade</th><th className="text-right">Total necessário</th><th>Un.</th><th className="text-right">Em estoque</th><th className="text-right">Falta</th><th className="text-right">Separado</th></tr></thead>
          <tbody>
            {mats.map(m => {
              const est = dados.estoque[m.codigo] || 0;
              const falta = Math.max(0, Number(m.necessario) - est - 0);
              return (
                <tr key={m.id}>
                  <td><button className="pcp-cod" title="Abrir no cadastro" onClick={() => ctx.irParaItem(m.codigo)}>{m.codigo}</button></td>
                  <td>{m.descricao || dados.prods[m.codigo]?.descricao || '—'}</td>
                  <td className="text-right">{pcpFmt(m.quantidade_unit)}</td>
                  <td className="text-right"><b style={{ fontWeight: 500 }}>{pcpFmt(m.necessario)}</b></td>
                  <td>{m.unidade || dados.prods[m.codigo]?.unidade || '—'}</td>
                  <td className="text-right">{pcpFmt(est)}</td>
                  <td className="text-right" style={falta > 0 && !encerrada ? { color: 'var(--vp-danger)', fontWeight: 500 } : { color: 'var(--fg3)' }}>{falta > 0 ? pcpFmt(falta) : '—'}</td>
                  <td className="text-right">{editavel ? <input className="input" type="number" min="0" step="any" defaultValue={m.separado} style={{ width: 90 }} onBlur={ev => atualizarMat(m, ev.target.value)}/> : pcpFmt(m.separado)}</td>
                </tr>
              );
            })}
            {mats.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--fg3)' }}>Este produto não tinha estrutura cadastrada quando a OP foi aberta.</td></tr>}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}

/* ---------------- Lista de OPs ---------------- */
function PCPOrdens({ ctx }) {
  const { sb, dados, podeCriar } = ctx;
  const [ordens, setOrdens] = React.useState(null);
  const [progresso, setProgresso] = React.useState({});
  const [aberta, setAberta] = React.useState(() => {
    try { const v = sessionStorage.getItem('vp_pcp_op') || null; sessionStorage.removeItem('vp_pcp_op'); return v; } catch (e) { return null; }
  });
  const [nova, setNova] = React.useState(false);
  const [filtro, setFiltro] = React.useState('');

  const carregar = React.useCallback(async () => {
    const [o, e] = await Promise.all([
      sb.from('pcp_ordens').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('pcp_ordem_etapas').select('ordem_id, status').limit(10000),
    ]);
    const prog = {};
    (e.data || []).forEach(x => { const p = (prog[x.ordem_id] = prog[x.ordem_id] || { total: 0, ok: 0 }); p.total++; if (x.status === 'concluida') p.ok++; });
    setProgresso(prog); setOrdens(o.data || []);
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);

  if (aberta) return <PCPOrdemDetalhe ctx={ctx} id={aberta} onVoltar={() => { setAberta(null); carregar(); }} onMudou={carregar} abrir={setAberta}/>;
  const filtradas = (ordens || []).filter(o => !filtro || o.status === filtro);
  const idsVisiveis = new Set(filtradas.map(o => o.id));
  const sobMae = (o) => !!(o.ordem_mae_id && idsVisiveis.has(o.ordem_mae_id));
  const frentesDe = {};
  filtradas.forEach(o => { if (sobMae(o)) (frentesDe[o.ordem_mae_id] = frentesDe[o.ordem_mae_id] || []).push(o); });
  const lista = filtradas.filter(o => !sobMae(o)).flatMap(o => [o, ...(frentesDe[o.id] || []).sort((a, b) => a.numero.localeCompare(b.numero))]);

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.keys(PCP_STATUS).map(k => <option key={k} value={k}>{PCP_STATUS[k]}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{ordens ? `${lista.length} ordem(ns)` : ''}</span>
        <span style={{ flex: 1 }}/>
        {podeCriar && !nova && <button className="btn btn--sm btn--primary" onClick={() => setNova(true)}>+ Nova OP</button>}
      </div>
      {nova && <PCPNovaOrdem ctx={ctx} onCancelar={() => setNova(false)} onCriada={(id) => { setNova(false); setAberta(id); }}/>}
      {!ordens && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {ordens && (
        <div className="card table-wrap" style={{ overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Nº</th><th>Produto</th><th className="text-right">Qtd</th><th>Cliente</th><th>Prazo</th><th>Etapas</th><th>Status</th></tr></thead>
            <tbody>
              {lista.map(o => {
                const p = progresso[o.id] || { total: 0, ok: 0 };
                const nivel = sobMae(o) ? 1 : 0;
                const fr = o.frente === 'pedido' ? (ordens || []).filter(x => x.ordem_mae_id === o.id) : null;
                return (
                  <tr key={o.id}>
                    <td style={{ paddingLeft: 12 + nivel * 22 }}>{nivel ? '↳ ' : ''}<button className="pcp-cod" onClick={() => setAberta(o.id)}>{o.numero}</button></td>
                    <td>{o.produto ? <>{o.produto} <span style={{ color: 'var(--fg3)' }}>· {dados.prods[o.produto]?.descricao || ''}</span></> : <b style={{ fontWeight: 500 }}>{o.titulo || '—'}</b>}</td>
                    <td className="text-right">{pcpFmt(o.quantidade, 0)}</td>
                    <td>{o.cliente || '—'}</td>
                    <td>{pcpData(o.prazo_entrega)}</td>
                    <td>{fr ? `${fr.filter(x => x.status === 'concluida').length}/${fr.length} frentes` : (p.total ? `${p.ok}/${p.total}` : '—')}</td>
                    <td><PCPStatusTag status={o.status} mapa={PCP_STATUS}/></td>
                  </tr>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhuma ordem de produção ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Planejamento mensal ---------------- */
const PCP_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function PCPPlanejamento({ ctx }) {
  const { sb, dados, podeEditar } = ctx;
  const [ano, setAno] = React.useState(new Date().getFullYear());
  const [plano, setPlano] = React.useState(null);       // { produto: { mes: qtd } }
  const [emOp, setEmOp] = React.useState({});           // { produto: { mes: qtd em OP } }
  const [extras, setExtras] = React.useState([]);       // produtos adicionados à grade e ainda sem valor
  const [novo, setNovo] = React.useState('');

  const carregar = React.useCallback(async () => {
    const [p, o] = await Promise.all([
      sb.from('pcp_plano').select('produto, mes, quantidade').eq('ano', ano).limit(5000),
      sb.from('pcp_ordens').select('produto, quantidade, previsao_inicio, prazo_entrega, data_abertura, status').neq('status', 'cancelada').not('produto', 'is', null).limit(5000),
    ]);
    const g = {};
    (p.data || []).forEach(l => { (g[l.produto] = g[l.produto] || {})[l.mes] = Number(l.quantidade); });
    const abertas = {};
    (o.data || []).forEach(l => {
      const d = l.prazo_entrega || l.previsao_inicio || l.data_abertura;
      if (!d || Number(d.slice(0, 4)) !== ano) return;
      const m = Number(d.slice(5, 7));
      const x = (abertas[l.produto] = abertas[l.produto] || {});
      x[m] = (x[m] || 0) + Number(l.quantidade);
    });
    setPlano(g); setEmOp(abertas);
  }, [sb, ano]);
  React.useEffect(() => { carregar(); }, [carregar]);

  if (!plano) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const produtos = Array.from(new Set([...Object.keys(plano), ...extras])).sort();
  const total = (cod) => PCP_MESES.reduce((s, _, i) => s + (plano[cod]?.[i + 1] || 0), 0);
  const totalMes = (m) => produtos.reduce((s, c) => s + (plano[c]?.[m] || 0), 0);

  const salvar = async (cod, mes, valor) => {
    const q = valor === '' ? 0 : Number(valor);
    if (!(q >= 0)) { window.toast?.('Quantidade inválida.'); await carregar(); return; }
    if (q === (plano[cod]?.[mes] || 0)) return;
    const { error } = await sb.from('pcp_plano').upsert(
      { produto: cod, ano, mes, quantidade: q, atualizado_por: pcpUsuario(), updated_at: new Date().toISOString() },
      { onConflict: 'produto,ano,mes' });
    if (error) { window.toast?.('Não foi possível salvar: ' + error.message); await carregar(); return; }
    window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Alterou planejamento mensal', alvo: `${cod} ${PCP_MESES[mes - 1]}/${ano} = ${q}` });
    await carregar();
  };
  const remover = async (cod) => {
    if (!window.confirm(`Remover ${cod} do planejamento de ${ano}?`)) return;
    const { error } = await sb.from('pcp_plano').delete().eq('produto', cod).eq('ano', ano);
    if (error) { window.toast?.('Não foi possível remover.'); return; }
    setExtras(x => x.filter(c => c !== cod));
    window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Removeu produto do planejamento', alvo: `${cod} / ${ano}` });
    await carregar();
  };
  const adicionar = () => {
    if (!novo) return;
    if (!produtos.includes(novo)) setExtras(x => [...x, novo]);
    setNovo('');
  };
  const disponiveis = ctx.pais.filter(c => !produtos.includes(c));

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
        <span style={{ flex: 1 }}/>
        {podeEditar && (<>
          <select className="input" value={novo} onChange={e => setNovo(e.target.value)} style={{ minWidth: 300 }}>
            <option value="">Adicionar produto ao planejamento…</option>
            {disponiveis.map(c => <option key={c} value={c}>{c} — {dados.prods[c]?.descricao || ''}</option>)}
          </select>
          <button className="btn btn--sm" disabled={!novo} onClick={adicionar}>Adicionar</button>
        </>)}
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr>
            <th>Produto</th>
            {PCP_MESES.map(m => <th key={m} className="text-right">{m}</th>)}
            <th className="text-right">Total</th><th></th>
          </tr></thead>
          <tbody>
            {produtos.map(c => (
              <tr key={c}>
                <td style={{ minWidth: 260 }}>
                  <button className="pcp-cod" onClick={() => window.pcpIrPara?.(ctx.nav, 'montagem-produto', 'vp_pcp_pai', c)}>{c}</button>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{dados.prods[c]?.descricao || ''}</div>
                </td>
                {PCP_MESES.map((_, i) => {
                  const m = i + 1, q = plano[c]?.[m] || 0, op = emOp[c]?.[m] || 0;
                  return (
                    <td key={m} className="text-right" style={{ minWidth: 70 }}>
                      {podeEditar
                        ? <input className="input" type="number" min="0" step="any" defaultValue={q || ''} placeholder="—" style={{ width: 64, textAlign: 'right' }}
                            key={ano + c + m + q} onBlur={e => salvar(c, m, e.target.value)}/>
                        : (q ? pcpFmt(q, 0) : '—')}
                      {op > 0 && <div title="Quantidade já aberta em OPs neste mês" style={{ fontSize: 10, color: op > q ? 'var(--vp-danger)' : 'var(--fg3)' }}>{pcpFmt(op, 0)} em OP</div>}
                    </td>
                  );
                })}
                <td className="text-right"><b style={{ fontWeight: 500 }}>{pcpFmt(total(c), 0)}</b></td>
                <td>{podeEditar && <button className="btn btn--sm" onClick={() => remover(c)}>Remover</button>}</td>
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={15} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum produto planejado em {ano}. Use “Adicionar produto”.</td></tr>}
            {produtos.length > 0 && (
              <tr>
                <td><b style={{ fontWeight: 500 }}>Total do mês</b></td>
                {PCP_MESES.map((_, i) => <td key={i} className="text-right"><b style={{ fontWeight: 500 }}>{pcpFmt(totalMes(i + 1), 0)}</b></td>)}
                <td className="text-right"><b style={{ fontWeight: 500 }}>{pcpFmt(produtos.reduce((s, c) => s + total(c), 0), 0)}</b></td><td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        A quantidade em vermelho “em OP” indica que as ordens abertas no mês já passam do planejado. O mês da OP é o do prazo de entrega (ou início previsto).
      </div>
    </div>
  );
}

/* ---------------- Controle ---------------- */
// Custo unitário de um produto pela estrutura (folha = preco_custo; subconjunto = soma dos filhos com perda).
function pcpCustoUnit(codigo, filhos, custo, pilha = []) {
  const sub = filhos[codigo] || [];
  if (!sub.length) return Number(custo[codigo] || 0);
  return sub.reduce((s, f) => pilha.includes(f.codigo_filho) ? s
    : s + Number(f.quantidade || 0) * (1 + Number(f.perda_pct || 0) / 100) * pcpCustoUnit(f.codigo_filho, filhos, custo, [...pilha, codigo]), 0);
}

function PCPControle({ ctx }) {
  const { sb, dados } = ctx;
  const [ordens, setOrdens] = React.useState(null);
  const [verCusto, setVerCusto] = React.useState(false);
  const [custo, setCusto] = React.useState({});
  const [ano, setAno] = React.useState(new Date().getFullYear());
  const [mes, setMes] = React.useState(0);          // 0 = ano todo
  const [produto, setProduto] = React.useState('');

  React.useEffect(() => {
    let vivo = true;
    sb.from('pcp_ordens').select('*').neq('status', 'cancelada').not('produto', 'is', null).order('prazo_entrega', { ascending: false }).limit(2000)
      .then(({ data }) => { if (vivo) setOrdens(data || []); });
    // O custo só é buscado no banco se a pessoa tem a alçada almoxarifado.ver_custo.
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'ver_custo')).then(async (ok) => {
      if (!vivo || !ok) return;
      setVerCusto(true);
      const { data } = await sb.from('pcp_produtos').select('codigo, preco_custo, custo_manual').limit(5000);
      const c = {}; (data || []).forEach(l => { c[l.codigo] = rpCustoEfetivo(l); });
      if (vivo) setCusto(c);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [sb]);

  if (!ordens) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const hoje = pcpHoje();
  const dataRef = (o) => o.data_finalizacao || o.prazo_entrega || o.previsao_inicio || o.data_abertura;
  const lista = ordens.filter(o => {
    const d = dataRef(o);
    if (!d || Number(d.slice(0, 4)) !== ano) return false;
    if (mes && Number(d.slice(5, 7)) !== mes) return false;
    return !produto || o.produto === produto;
  });
  const concl = lista.filter(o => o.status === 'concluida');
  const planejadaConcl = concl.reduce((s, o) => s + Number(o.quantidade), 0);
  const produzida = concl.reduce((s, o) => s + Number(o.qtd_produzida || 0), 0);
  const perdida = concl.reduce((s, o) => s + Number(o.qtd_perdida || 0), 0);
  const eficiencia = planejadaConcl ? (produzida / planejadaConcl) * 100 : null;
  const atrasada = (o) => o.prazo_entrega && ((o.status === 'concluida' ? o.data_finalizacao : hoje) > o.prazo_entrega);
  const diasAtraso = (o) => Math.round((new Date((o.status === 'concluida' ? o.data_finalizacao : hoje) + 'T00:00') - new Date(o.prazo_entrega + 'T00:00')) / 86400000);
  const custoPerdido = concl.reduce((s, o) => s + Number(o.qtd_perdida || 0) * pcpCustoUnit(o.produto, dados.filhos, custo), 0);
  const nAtrasadas = lista.filter(atrasada).length;
  const borrado = verCusto ? undefined : { filter: 'blur(6px)', userSelect: 'none' };
  const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const kpi = (rot, val, extra, estilo) => (
    <div className="card pcp-total" style={{ padding: 14, flex: '1 1 170px' }}>
      <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{rot}</div>
      <div style={{ fontSize: 22, fontWeight: 500, ...(estilo || {}) }}>{val}</div>
      {extra && <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{extra}</div>}
    </div>
  );
  const produtosNaLista = Array.from(new Set(ordens.map(o => o.produto))).sort();

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={() => setAno(a => a - 1)}>←</button>
        <b style={{ fontWeight: 500, fontSize: 16 }}>{ano}</b>
        <button className="btn btn--sm" onClick={() => setAno(a => a + 1)}>→</button>
        <select className="input" value={mes} onChange={e => setMes(Number(e.target.value))}>
          <option value={0}>Ano todo</option>
          {PCP_MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" value={produto} onChange={e => setProduto(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">Todos os produtos</option>
          {produtosNaLista.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi('Eficiência', eficiencia != null ? pcpFmt(eficiencia, 1) + '%' : '—', `${pcpFmt(produzida, 0)} produzidas de ${pcpFmt(planejadaConcl, 0)} planejadas`)}
        {kpi('Perdas', pcpFmt(perdida, 0), `${concl.length} OP(s) concluída(s)`)}
        {kpi('Custo perdido', verCusto ? moeda(custoPerdido) : 'R$ 00.000,00', verCusto ? 'pelo custo da estrutura' : 'sem permissão para ver custos', borrado)}
        {kpi('OPs atrasadas', nAtrasadas, 'abertas vencidas + concluídas fora do prazo', nAtrasadas ? { color: 'var(--vp-danger)' } : undefined)}
      </div>
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr>
            <th>OP</th><th>Produto</th><th>Prazo</th><th>Finalização</th><th>Status</th>
            <th className="text-right">Planejada</th><th className="text-right">Produzida</th><th className="text-right">Perdida</th>
            <th className="text-right">Eficiência</th><th className="text-right">Custo perdido</th><th className="text-right">Custo por un.</th>
            <th>Causa da perda</th><th>Ação corretiva</th>
          </tr></thead>
          <tbody>
            {lista.map(o => {
              const fin = o.status === 'concluida';
              const cu = pcpCustoUnit(o.produto, dados.filhos, custo);
              const atr = atrasada(o);
              return (
                <tr key={o.id}>
                  <td><button className="pcp-cod" onClick={() => { try { sessionStorage.setItem('vp_pcp_op', o.id); } catch (e) {} ctx.abrirOp(o.id); }}>{o.numero}</button></td>
                  <td>{o.produto}</td>
                  <td>{pcpData(o.prazo_entrega)}{atr && <div style={{ fontSize: 10, color: 'var(--vp-danger)' }}>{diasAtraso(o)} dia(s) de atraso</div>}</td>
                  <td>{pcpData(o.data_finalizacao)}</td>
                  <td><PCPStatusTag status={o.status} mapa={PCP_STATUS}/></td>
                  <td className="text-right">{pcpFmt(o.quantidade, 0)}</td>
                  <td className="text-right">{fin ? pcpFmt(o.qtd_produzida || 0, 0) : '—'}</td>
                  <td className="text-right" style={fin && Number(o.qtd_perdida) > 0 ? { color: 'var(--vp-danger)', fontWeight: 500 } : undefined}>{fin ? pcpFmt(o.qtd_perdida || 0, 0) : '—'}</td>
                  <td className="text-right">{fin ? pcpFmt((Number(o.qtd_produzida || 0) / Number(o.quantidade)) * 100, 1) + '%' : '—'}</td>
                  <td className="text-right" style={borrado}>{verCusto ? (fin ? moeda(Number(o.qtd_perdida || 0) * cu) : '—') : 'R$ 0,00'}</td>
                  <td className="text-right" style={borrado}>{verCusto ? (cu > 0 ? moeda(cu) : <span title="Estrutura com itens sem custo">—</span>) : 'R$ 0,00'}</td>
                  <td>{o.causa_perda || '—'}</td>
                  <td>{o.acao_corretiva || '—'}</td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={13} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhuma ordem de produção neste período.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        O Controle lê as ordens de produção: produzido, perdido, causa e ação são lançados ao concluir a OP. Eficiência = produzida ÷ planejada. O período usa a data de finalização (ou o prazo, se ainda aberta).
      </div>
    </div>
  );
}

/* ---------------- Pedidos para produzir (pedido de venda do Omie na etapa 20 → OPs) ---------------- */
async function pcpSyncPedidos(sb, corpo) {
  try {
    const { data, error } = await sb.functions.invoke('sync-pcp-pedidos', { body: corpo });
    if (error) {
      let msg = error.message; try { const j = await error.context.json(); msg = j.error || msg; } catch (e) { /* mantém */ }
      return { ok: false, erro: msg };
    }
    return { ok: !!data && data.ok !== false, dados: data, erro: data && data.erros && data.erros[0] };
  } catch (e) { return { ok: false, erro: e.message }; }
}

// Um pedido de venda do Omie vira: OP-mãe (checklist de separação dos itens que NÃO são do PCP) + uma OP por produto do PCP.
//   produto com estrutura (quadro de comando) → OP de montagem com os materiais da estrutura padrão do Omie × quantidade;
//   produto sem estrutura (cabo de aço, cabo de manobra, corrimão: cortado sob medida) → OP de corte com o material em metros.
function pcpPlanoDoPedido(itens, dados) {
  const pcp = itens.filter(i => i.item_pcp);
  const outros = itens.filter(i => !i.item_pcp);
  const porCodigo = {}; pcp.forEach(i => { porCodigo[i.codigo] = (porCodigo[i.codigo] || 0) + Number(i.quantidade); });
  const frentes = Object.keys(porCodigo).map(codigo => {
    const qtd = porCodigo[codigo];
    const montagem = (dados.filhos[codigo] || []).length > 0;
    return { codigo, qtd, tipo: montagem ? 'quadro' : 'corte', descricao: dados.prods[codigo]?.descricao || codigo, unidade: dados.prods[codigo]?.unidade || null };
  });
  return { frentes, outros };
}

async function pcpGerarOpsDoPedido(sb, pedido, itens, dados, opcoes) {
  const plano = pcpPlanoDoPedido(itens, dados);
  const quem = pcpUsuario();
  const { data: mae, error: e0 } = await sb.from('pcp_ordens').insert({
    titulo: `Pedido ${pedido.numero_pedido}${pedido.cliente_nome ? ' — ' + pedido.cliente_nome : ''}`, frente: 'pedido', pedido_codigo: pedido.codigo_pedido,
    quantidade: 1, cliente: pedido.cliente_nome || null, prazo_entrega: opcoes.prazo_entrega || pedido.data_previsao || null,
    previsao_inicio: opcoes.previsao_inicio || null, criado_por: quem,
    observacao: `Gerada do pedido de venda ${pedido.numero_pedido} do Omie (etapa 20 — Separar estoque / produção).`,
  }).select('id, numero').single();
  if (e0 || !mae) throw new Error(e0?.message || 'sem permissão');
  if (plano.outros.length) {
    const r = await sb.from('pcp_ordem_checklist').insert(plano.outros.map((i, k) => ({
      ordem_id: mae.id, posicao: k, grupo: 'separação', descricao: `${i.codigo} — ${i.descricao}`, quantidade: Number(i.quantidade), unidade: i.unidade || null,
    })));
    if (r.error) throw new Error(r.error.message);
  }
  let nQ = 0, nC = 0;
  for (const f of plano.frentes) {
    const quadro = f.tipo === 'quadro';
    const n = quadro ? ++nQ : ++nC;
    const { data: op, error } = await sb.from('pcp_ordens').insert({
      numero: `${mae.numero}-${quadro ? 'Q' : 'C'}${n}`, titulo: quadro ? `Montagem — ${f.codigo}` : `Corte — ${f.codigo}`, frente: quadro ? 'quadro' : 'corte',
      ordem_mae_id: mae.id, pedido_codigo: pedido.codigo_pedido, produto: quadro ? f.codigo : null, quantidade: quadro ? f.qtd : 1,
      cliente: pedido.cliente_nome || null, prazo_entrega: opcoes.prazo_entrega || pedido.data_previsao || null, previsao_inicio: opcoes.previsao_inicio || null, criado_por: quem,
    }).select('id').single();
    if (error || !op) throw new Error(error?.message || 'sem permissão');
    const etapas = (quadro
      ? [['Separar materiais', 'Almoxarifado'], ['Montagem do produto', 'Produção'], ['Qualidade / aprovação', 'Qualidade']]
      : [['Separar materiais', 'Almoxarifado'], ['Corte', 'Produção'], ['Qualidade / aprovação', 'Qualidade']]).map(([nome, setor], i) => ({ ordem_id: op.id, posicao: i + 1, nome, setor }));
    let r = await sb.from('pcp_ordem_etapas').insert(etapas); if (r.error) throw new Error(r.error.message);
    if (quadro) {
      const mats = pcpMateriaisOmie(dados, f.codigo).map(m => ({ ...m, necessario: m.quantidade_unit * f.qtd, ordem_id: op.id }));
      if (mats.length) { r = await sb.from('pcp_ordem_materiais').insert(mats); if (r.error) throw new Error(r.error.message); }
    } else {
      r = await sb.from('pcp_ordem_materiais').insert([{ ordem_id: op.id, codigo: f.codigo, descricao: f.descricao, unidade: f.unidade || 'M', quantidade_unit: f.qtd, necessario: f.qtd }]); if (r.error) throw new Error(r.error.message);
      r = await sb.from('pcp_ordem_checklist').insert([{ ordem_id: op.id, posicao: 0, grupo: 'corte', descricao: `${pcpFmt(f.qtd)} ${f.unidade || 'm'} de ${f.codigo}`, quantidade: f.qtd, unidade: f.unidade || 'm', observacao: f.descricao }]); if (r.error) throw new Error(r.error.message);
    }
  }
  window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Gerou OPs do pedido do Omie', alvo: `${mae.numero} ← pedido ${pedido.numero_pedido} (${plano.frentes.length} frente(s))` });
  return mae;
}

function PCPFilaProducao({ ctx, abrirOp }) {
  const { sb, dados, podeCriar } = ctx;
  const [pedidos, setPedidos] = React.useState(null);
  const [itens, setItens] = React.useState({});
  const [maes, setMaes] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [preparo, setPreparo] = React.useState(null);

  const carregar = React.useCallback(async () => {
    const { data: p } = await sb.from('pcp_pedidos').select('*').eq('etapa', '20').eq('cancelado', false).order('data_previsao', { ascending: true }).limit(200);
    const ids = (p || []).map(x => x.codigo_pedido);
    const [i, o] = await Promise.all([
      ids.length ? sb.from('pcp_pedido_itens').select('codigo_pedido, seq, codigo, descricao, unidade, quantidade, item_pcp').in('codigo_pedido', ids).order('seq').limit(5000) : Promise.resolve({ data: [] }),
      sb.from('pcp_ordens').select('id, numero, pedido_codigo, status').eq('frente', 'pedido').not('pedido_codigo', 'is', null),
    ]);
    const it = {}; (i.data || []).forEach(x => { (it[x.codigo_pedido] = it[x.codigo_pedido] || []).push(x); });
    const m = {}; (o.data || []).forEach(x => { m[x.pedido_codigo] = x; });
    setItens(it); setMaes(m); setPedidos(p || []);
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const buscarOmie = async () => {
    setBusy(true);
    const r = await pcpSyncPedidos(sb, { etapa: '20' });
    setBusy(false);
    if (!r.ok) window.toast?.('Não foi possível ler o Omie: ' + (r.erro || 'erro')); else window.toast?.(`Omie lido: ${r.dados.lidos} pedido(s) na etapa 20; ${r.dados.gravados} com quadro, corrimão ou cabo.`);
    carregar();
  };
  const criar = async () => {
    setBusy(true);
    try {
      const mae = await pcpGerarOpsDoPedido(sb, preparo.pedido, itens[preparo.pedido.codigo_pedido] || [], dados, preparo.opcoes);
      window.toast?.(`${mae.numero} criada com ${pcpPlanoDoPedido(itens[preparo.pedido.codigo_pedido] || [], dados).frentes.length} OP(s) de produção.`);
      setPreparo(null); await carregar();
    } catch (e) { window.toast?.('Não foi possível gerar as OPs: ' + e.message); }
    setBusy(false);
  };

  if (!pedidos) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const ultima = pedidos.reduce((m, p) => (p.atualizado_em > m ? p.atualizado_em : m), '');
  const plano = preparo ? pcpPlanoDoPedido(itens[preparo.pedido.codigo_pedido] || [], dados) : null;

  return (
    <div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontWeight: 500 }}>{pedidos.filter(p => !maes[p.codigo_pedido]).length} aguardando OP</b>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{ultima ? 'Omie lido em ' + new Date(ultima).toLocaleString('pt-BR') : 'Ainda não lido do Omie'}</span>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--sm btn--primary" disabled={busy} onClick={buscarOmie} title="Lê no Omie os pedidos de venda na etapa 20 (Separar estoque / produção)">{busy ? 'Lendo o Omie…' : 'Buscar pedidos liberados no Omie'}</button>
      </div>

      {preparo && (
        <div className="card pcp-total" style={{ padding: 14, marginBottom: 14 }}>
          <b style={{ fontWeight: 500, fontSize: 15 }}>Gerar OPs do pedido {preparo.pedido.numero_pedido} — {preparo.pedido.cliente_nome}</b>
          <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Início <input className="input" type="date" value={preparo.opcoes.previsao_inicio} onChange={e => setPreparo({ ...preparo, opcoes: { ...preparo.opcoes, previsao_inicio: e.target.value } })}/></label>
            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Prazo <input className="input" type="date" value={preparo.opcoes.prazo_entrega} onChange={e => setPreparo({ ...preparo, opcoes: { ...preparo.opcoes, prazo_entrega: e.target.value } })}/></label>
          </div>
          <table className="t pcp-grid">
            <thead><tr><th>Será criado</th><th>Conteúdo</th></tr></thead>
            <tbody>
              <tr><td><b style={{ fontWeight: 500 }}>OP-mãe (o pedido)</b></td><td>{plano.outros.length ? `Checklist de separação com ${plano.outros.length} item(ns) que não são fabricados (botoeiras, máquina, portas…)` : 'Sem itens de separação'}</td></tr>
              {plano.frentes.map(f => (
                <tr key={f.codigo}>
                  <td>{f.tipo === 'quadro' ? 'Montagem' : 'Corte'} — {f.codigo}</td>
                  <td>{f.tipo === 'quadro' ? `${pcpFmt(f.qtd, 0)} un. · materiais da estrutura padrão do Omie (${(pcpMateriaisOmie(dados, f.codigo)).length} itens) · etapas: Separar → Montagem → Qualidade`
                    : `${pcpFmt(f.qtd)} ${f.unidade || 'm'} de ${f.descricao} · etapas: Separar → Corte → Qualidade`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn--sm btn--primary" disabled={busy} onClick={criar}>{busy ? 'Criando…' : 'Criar OPs'}</button>
            <button className="btn btn--sm" disabled={busy} onClick={() => setPreparo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Previsão</th><th>Itens do PCP</th><th className="text-right">Outros itens</th><th className="text-right">Total do pedido</th><th>OP no PCP</th></tr></thead>
          <tbody>
            {pedidos.map(p => {
              const its = itens[p.codigo_pedido] || [];
              const pcp = its.filter(x => x.item_pcp), outros = its.filter(x => !x.item_pcp);
              const mae = maes[p.codigo_pedido];
              return (
                <tr key={p.codigo_pedido}>
                  <td><b style={{ fontWeight: 500 }}>{p.numero_pedido}</b></td>
                  <td style={{ minWidth: 200 }}>{p.cliente_nome || '—'}</td>
                  <td>{pcpData(p.data_previsao)}</td>
                  <td style={{ minWidth: 220 }}>{pcp.map(x => `${x.codigo}${x.codigo_original ? ' (' + x.codigo_original + ')' : ''} × ${pcpFmt(x.quantidade)}`).join(', ') || '—'}</td>
                  <td className="text-right">{outros.length || '—'}</td>
                  <td className="text-right">{pcpMoeda(p.valor_total)}</td>
                  <td>{mae
                    ? <button className="pcp-cod" onClick={() => abrirOp(mae.id)}>{mae.numero}</button>
                    : (podeCriar ? <button className="btn btn--sm" disabled={busy} onClick={() => setPreparo({ pedido: p, opcoes: { previsao_inicio: '', prazo_entrega: p.data_previsao || '' } })}>Gerar OPs</button> : '—')}</td>
                </tr>
              );
            })}
            {pedidos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum pedido liberado com quadro, corrimão ou cabo. Use “Buscar pedidos liberados no Omie”.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Aqui chega o pedido para disparar a fabricação: pedidos de venda do Omie na etapa <b style={{ fontWeight: 500 }}>20 — Separar Estoque / Produção</b> que têm quadro de comando, corrimão ou cabo. Pedidos que já viraram OP mostram o número da OP-mãe. Para detalhar um quadro com escopo, geometria e botoeiras use a aba “Pedidos de Quadro”.
      </div>
    </div>
  );
}

/* ---------------- Pedidos de Quadro (formulário → OP-mãe + frentes) ---------------- */
const PCP_ESCOPO_NUM = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };

function pcpVarianteDe(maquina) {
  const m = Array.isArray(maquina) ? maquina[0] : maquina;
  if (!m || m.potencia_kw == null || m.tensao_v == null) return null;
  return `${Number(m.potencia_kw)}_${Number(m.tensao_v)}`;
}

// Materiais do produto pela estrutura padrão do Omie (usado quando o formulário não gerou lista própria).
function pcpMateriaisOmie(dados, produto) {
  if (!dados || !produto) return [];
  const acc = pcpExplodir(produto, dados.filhos, 1, {}, [produto]);
  return Object.keys(acc).sort().map(c => ({ codigo: c, descricao: dados.prods[c]?.descricao || null, unidade: dados.prods[c]?.unidade || null, quantidade_unit: acc[c], necessario: acc[c] }));
}

// Monta (sem gravar) o que será criado: frentes, materiais, checklists e etapas.
// extra = { dados, produto } — dados do PCP e produto escolhido para o quadro (fallback: estrutura do Omie).
function pcpMontarPedidoQuadro(b, extra) {
  const { quadro, paradas, bom, cortes, maquina } = b;
  const esc = quadro.escopo_fornecimento || {};
  const cfg = quadro.configuracao || {};
  const dec = (k) => (esc[k] || {}).decisao;
  const forn = (k) => dec(k) === 'fornecer';
  const fora = (k) => ['reutilizar', 'terceiro', 'nao_aplica'].includes(dec(k));    // não é fornecimento da VerticalParts
  const det = (k) => PCP_ESCOPO_NUM((esc[k] || {}).detalhe);
  const lopTotal = paradas.reduce((s, p) => s + (p.qtd_lop_frontal || 0) + (p.qtd_lop_traseira || 0), 0);
  let pos = 0;
  const ck = (grupo, descricao, quantidade, unidade, observacao) => ({ posicao: pos++, grupo, descricao, quantidade: quantidade ?? null, unidade: unidade || null, observacao: observacao || null });

  // Separação (portas, máquina...) — fica no pedido (OP-mãe): só separa/compra.
  const separacao = [];
  const portasPav = paradas.filter(p => p.abertura_frontal).length + paradas.filter(p => p.abertura_traseira).length;
  if (!fora('portas')) {
    if (portasPav) separacao.push(ck('separação', 'Portas de pavimento (uma por abertura de parada)', portasPav, 'un.', `${paradas.length} parada(s)`));
    separacao.push(ck('separação', 'Porta de cabina', cfg.portas_opostas_cabina ? 2 : 1, 'un.', cfg.portas_opostas_cabina ? 'portas opostas na cabina' : null));
  }
  const mq = Array.isArray(maquina) ? maquina[0] : maquina;
  if (!fora('maquina_tracao') && mq && (mq.modelo_maquina || mq.potencia_kw)) separacao.push(ck('separação', 'Máquina de tração', 1, 'un.', [mq.fabricante_maquina, mq.modelo_maquina, mq.potencia_kw ? mq.potencia_kw + ' kW' : null, mq.tensao_v ? mq.tensao_v + ' V' : null].filter(Boolean).join(' · ')));
  if (forn('operador_porta')) separacao.push(ck('separação', 'Operador de portas', det('operador_porta') || 1, 'un.', esc.operador_porta_modelo || null));

  // Quadro: lista própria do formulário; se não houver, a estrutura padrão do produto no Omie.
  let materiaisQuadro = bom.filter(i => ['componentes', 'caixa'].includes(i.grupo_separacao))
    .map(i => ({ codigo: i.sku, descricao: i.descricao, unidade: i.unidade, quantidade_unit: Number(i.quantidade), necessario: Number(i.quantidade) }));
  let origemMat = 'lista do formulário';
  if (!materiaisQuadro.length && !fora('quadro_comando') && extra && extra.dados && extra.produto) {
    materiaisQuadro = pcpMateriaisOmie(extra.dados, extra.produto);
    origemMat = 'estrutura padrão do Omie';
  }

  // Fiação
  pos = 0;
  const fiacao = cortes.map(c => ck('corte', `${c.tipo_cabo || 'Cabo'}${c.vias_bitola ? ' ' + c.vias_bitola : ''} — ${pcpFmt(c.comprimento_final_mm, 0)} mm`, c.quantidade_pedacos, 'peça(s)', [c.origem_fisica, c.destino_fisico].filter(Boolean).join(' → ')));
  if (forn('cabos')) fiacao.push(ck('cabo de manobra', 'Cabo de manobra (quadro de comando → cabina)', det('cabos') || 1, 'un.', null));

  // Botoeiras
  pos = 0;
  const botoeiras = [];
  const temFuracao = !!esc.botoeiras_furacoes_totem && esc.botoeiras_furacoes_totem !== 'nao';
  if (forn('cop')) botoeiras.push(ck('botoeira', 'COP — Botoeira de cabina', det('cop') || 1, 'un.', esc.cop_com_display ? 'display: ' + (esc.cop_display_modelo || esc.cop_com_display) : null));
  if (forn('lop')) botoeiras.push(ck('botoeira', 'LOP — Botoeira de pavimento', det('lop') || lopTotal || 1, 'un.', null));
  if (forn('lip')) botoeiras.push(ck('botoeira', 'LIP — Indicador de posição sobre as portas', det('lip') || 1, 'un.', null));
  if (esc.botoeiras_logo_cliente) botoeiras.push(ck('gravação', 'Gravar logo do cliente nas botoeiras', (det('cop') || (forn('cop') ? 1 : 0)) + (det('lop') || (forn('lop') ? lopTotal : 0)) || null, 'un.', null));
  if (temFuracao) botoeiras.push(ck('furação', 'Furação do totem (botoeira de cabina)', null, null, esc.botoeiras_furacoes_totem === 'custom' ? esc.botoeiras_furacoes_custom : esc.botoeiras_furacoes_totem));

  const frentes = [];
  if (!fora('quadro_comando') && (materiaisQuadro.length || forn('quadro_comando'))) frentes.push({ sufixo: 'Q', frente: 'quadro', titulo: 'Quadro de comando', origemMat, etapas: [['Separar materiais', 'Almoxarifado'], ['Montagem do quadro', 'Produção'], ['Qualidade / aprovação', 'Qualidade']], materiais: materiaisQuadro, checklist: [] });
  if (fiacao.length) frentes.push({ sufixo: 'F', frente: 'fiacao', titulo: 'Fiação e cabos', etapas: [['Separar materiais', 'Almoxarifado'], ['Corte', 'Produção'], ['Montagem / fiação', 'Produção'], ['Qualidade / aprovação', 'Qualidade']], materiais: [], checklist: fiacao });
  if (botoeiras.length) frentes.push({ sufixo: 'B', frente: 'botoeiras', titulo: 'Botoeiras', etapas: [['Separar materiais', 'Almoxarifado'], ...(temFuracao ? [['Furação', 'Produção']] : []), ...(esc.botoeiras_logo_cliente ? [['Gravação do logo', 'Produção']] : []), ['Qualidade / aprovação', 'Qualidade']], materiais: [], checklist: botoeiras });

  // Cabos de aço (tração): material = metros totais do cabo; checklist de corte.
  const ca = esc.cabos_aco || {};
  if (forn('cabos_aco')) {
    const n = PCP_ESCOPO_NUM(ca.qtd_cabos), m = Number(String(ca.comprimento_m || '').replace(',', '.'));
    if (ca.produto && n && m > 0) {
      const total = n * m;
      pos = 0;
      frentes.push({ sufixo: 'C', frente: 'cabos_aco', titulo: 'Cabos de aço', etapas: [['Separar materiais', 'Almoxarifado'], ['Corte', 'Produção'], ['Qualidade / aprovação', 'Qualidade']],
        materiais: [{ codigo: ca.produto, descricao: (extra && extra.dados && extra.dados.prods[ca.produto]?.descricao) || null, unidade: 'M', quantidade_unit: total, necessario: total }],
        checklist: [ck('corte', `${n} cabo(s) de ${pcpFmt(m)} m — ${ca.produto}`, n, 'cabo(s)', `total ${pcpFmt(total)} m`)] });
    }
  }
  return { separacao, frentes };
}

async function pcpGerarPedidoQuadro(sb, b, opcoes, extra) {
  const montagem = pcpMontarPedidoQuadro(b, extra);
  const quem = pcpUsuario();
  const { data: mae, error: e0 } = await sb.from('pcp_ordens').insert({
    titulo: `Pedido ${b.quadro.numero_pedido}${opcoes.cliente ? ' — ' + opcoes.cliente : ''}`, frente: 'pedido', quadro_comando_id: b.quadro.id,
    quantidade: 1, cliente: opcoes.cliente || null, numero_cotacao: PCP_ESCOPO_NUM(b.quadro.numero_cotacao),
    previsao_inicio: opcoes.previsao_inicio || null, prazo_entrega: opcoes.prazo_entrega || null, criado_por: quem,
    observacao: `Gerada do pedido de quadro Nº ${b.quadro.numero_pedido} (${b.quadro.novo_ou_modernizacao || 'sem tipo'}).`,
  }).select('id, numero').single();
  if (e0 || !mae) throw new Error(e0?.message || 'sem permissão');
  if (montagem.separacao.length) {
    const r = await sb.from('pcp_ordem_checklist').insert(montagem.separacao.map(c => ({ ...c, ordem_id: mae.id })));
    if (r.error) throw new Error(r.error.message);
  }
  for (const f of montagem.frentes) {
    const { data: op, error } = await sb.from('pcp_ordens').insert({
      numero: `${mae.numero}-${f.sufixo}`, titulo: f.titulo, frente: f.frente, ordem_mae_id: mae.id, quadro_comando_id: b.quadro.id,
      produto: f.frente === 'quadro' ? opcoes.produto : null, quantidade: 1, cliente: opcoes.cliente || null,
      numero_cotacao: PCP_ESCOPO_NUM(b.quadro.numero_cotacao), previsao_inicio: opcoes.previsao_inicio || null, prazo_entrega: opcoes.prazo_entrega || null, criado_por: quem,
    }).select('id').single();
    if (error || !op) throw new Error(error?.message || 'sem permissão');
    const etapas = f.etapas.map(([nome, setor], i) => ({ ordem_id: op.id, posicao: i + 1, nome, setor }));
    let r = await sb.from('pcp_ordem_etapas').insert(etapas); if (r.error) throw new Error(r.error.message);
    if (f.materiais.length) { r = await sb.from('pcp_ordem_materiais').insert(f.materiais.map(m => ({ ...m, ordem_id: op.id }))); if (r.error) throw new Error(r.error.message); }
    if (f.checklist.length) { r = await sb.from('pcp_ordem_checklist').insert(f.checklist.map(c => ({ ...c, ordem_id: op.id }))); if (r.error) throw new Error(r.error.message); }
  }
  window.VPLog?.registrar?.({ modulo: 'PCP', acao: 'Gerou OPs do pedido de quadro', alvo: `${mae.numero} ← pedido ${b.quadro.numero_pedido} (${montagem.frentes.length} frente(s))` });
  return mae;
}

function PCPPedidosQuadro({ ctx, abrirOp }) {
  const { sb, dados, podeCriar } = ctx;
  const [linhas, setLinhas] = React.useState(null);
  const [maes, setMaes] = React.useState({});
  const [variantes, setVariantes] = React.useState({});
  const [preparo, setPreparo] = React.useState(null);     // { bundle, opcoes, montagem }
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const [q, o, v] = await Promise.all([
      sb.from('quadros_comando').select('id, numero_pedido, numero_cotacao, status, novo_ou_modernizacao, cliente_id, created_at, escopo_fornecimento, quadros_comando_paradas(count), quadros_comando_bom_itens(count), quadros_comando_trechos_corte(count), quadros_comando_maquina(potencia_kw, tensao_v)').is('excluido_em', null).order('created_at', { ascending: false }).limit(200),
      sb.from('pcp_ordens').select('id, numero, quadro_comando_id, status').eq('frente', 'pedido'),
      sb.from('pcp_quadro_variante').select('variante, codigo_produto'),
    ]);
    const m = {}; (o.data || []).forEach(x => { m[x.quadro_comando_id] = x; });
    const vv = {}; (v.data || []).forEach(x => { vv[x.variante] = x.codigo_produto; });
    setMaes(m); setVariantes(vv);
    const cnt = (x) => (x && x[0] && x[0].count) || 0;
    setLinhas((q.data || []).map(r => ({ ...r, nParadas: cnt(r.quadros_comando_paradas), nBom: cnt(r.quadros_comando_bom_itens), nCortes: cnt(r.quadros_comando_trechos_corte), variante: pcpVarianteDe(r.quadros_comando_maquina) })));
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const preparar = async (r) => {
    setBusy(true);
    const [pa, bo, co, ma, q, cl] = await Promise.all([
      sb.from('quadros_comando_paradas').select('*').eq('quadro_comando_id', r.id).order('ordem'),
      sb.from('quadros_comando_bom_itens').select('sku, descricao, grupo_separacao, quantidade, unidade').eq('quadro_comando_id', r.id),
      sb.from('quadros_comando_trechos_corte').select('*').eq('quadro_comando_id', r.id),
      sb.from('quadros_comando_maquina').select('*').eq('quadro_comando_id', r.id).maybeSingle(),
      sb.from('quadros_comando').select('*').eq('id', r.id).single(),
      r.cliente_id ? sb.from('clientes').select('razao_social, nome_fantasia').eq('id', r.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const bundle = { quadro: q.data, paradas: pa.data || [], bom: bo.data || [], cortes: co.data || [], maquina: ma.data };
    const vkey = ((q.data && q.data.escopo_fornecimento && q.data.escopo_fornecimento.quadro_comando) || {}).detalhe || r.variante;
    setPreparo({
      bundle,
      opcoes: { produto: variantes[vkey] || '', cliente: (cl.data && (cl.data.razao_social || cl.data.nome_fantasia)) || '', previsao_inicio: '', prazo_entrega: '' },
    });
    setBusy(false);
  };
  const montagem = preparo ? pcpMontarPedidoQuadro(preparo.bundle, { dados, produto: preparo.opcoes.produto }) : null;
  const criar = async () => {
    const o = preparo.opcoes;
    if (montagem.frentes.some(f => f.frente === 'quadro') && !o.produto) { window.toast?.('Escolha o produto do quadro de comando.'); return; }
    setBusy(true);
    try {
      const mae = await pcpGerarPedidoQuadro(sb, preparo.bundle, o, { dados, produto: o.produto });
      window.toast?.(`${mae.numero} criada com ${montagem.frentes.length} frente(s).`);
      try { sessionStorage.setItem('vp_pcp_op', ''); } catch (e) { /* ok */ }
      setPreparo(null); await carregar();
    } catch (e) { window.toast?.('Não foi possível gerar as OPs: ' + e.message); }
    setBusy(false);
  };
  const setOpc = (k, v) => setPreparo(p => ({ ...p, opcoes: { ...p.opcoes, [k]: v } }));

  if (!linhas) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  return (
    <div>
      {preparo && (
        <div className="card pcp-total" style={{ padding: 14, marginBottom: 14 }}>
          <b style={{ fontWeight: 500, fontSize: 15 }}>Gerar OPs do pedido {preparo.bundle.quadro.numero_pedido}</b>
          <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
            <select className="input" value={preparo.opcoes.produto} onChange={e => setOpc('produto', e.target.value)} style={{ minWidth: 300 }}>
              <option value="">Produto do quadro de comando…</option>
              {ctx.pais.map(c => <option key={c} value={c}>{c} — {dados.prods[c]?.descricao || ''}</option>)}
            </select>
            <input className="input" placeholder="Cliente" value={preparo.opcoes.cliente} onChange={e => setOpc('cliente', e.target.value)} style={{ width: 220 }}/>
            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Início <input className="input" type="date" value={preparo.opcoes.previsao_inicio} onChange={e => setOpc('previsao_inicio', e.target.value)}/></label>
            <label style={{ fontSize: 12, color: 'var(--fg3)' }}>Prazo <input className="input" type="date" value={preparo.opcoes.prazo_entrega} onChange={e => setOpc('prazo_entrega', e.target.value)}/></label>
          </div>
          <table className="t pcp-grid">
            <thead><tr><th>Será criado</th><th>Conteúdo</th></tr></thead>
            <tbody>
              <tr><td><b style={{ fontWeight: 500 }}>OP-mãe (o pedido)</b></td><td>Checklist de separação: {montagem.separacao.map(s => s.descricao.split(' (')[0]).join(', ') || '—'}</td></tr>
              {montagem.frentes.map(f => (
                <tr key={f.sufixo}><td>{f.titulo}</td><td>{f.materiais.length ? `${f.materiais.length} materiais (${f.origemMat || (f.frente === 'cabos_aco' ? 'escopo do pedido' : 'lista')}) · ` : (f.frente === 'quadro' ? 'sem materiais — escolha o produto acima · ' : '')}{f.checklist.length ? `${f.checklist.length} item(ns) de checklist · ` : ''}etapas: {f.etapas.map(e => e[0]).join(' → ')}</td></tr>
              ))}
              {montagem.frentes.length === 0 && <tr><td colSpan={2} style={{ color: 'var(--vp-danger)' }}>Este pedido não tem lista de materiais, cortes nem botoeiras definidos no formulário.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn--sm btn--primary" disabled={busy || !montagem.frentes.length} onClick={criar}>{busy ? 'Criando…' : 'Criar OPs'}</button>
            <button className="btn btn--sm" disabled={busy} onClick={() => setPreparo(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t pcp-grid">
          <thead><tr><th>Pedido</th><th>Cotação</th><th>Tipo</th><th>Máquina</th><th className="text-right">Paradas</th><th className="text-right">Itens da lista</th><th className="text-right">Cortes</th><th>Formulário</th><th>OP no PCP</th></tr></thead>
          <tbody>
            {linhas.map(r => {
              const mae = maes[r.id];
              const esc = r.escopo_fornecimento || {};
              const pronto = r.nParadas > 0 || r.nBom > 0 || (esc.quadro_comando || {}).decisao === 'fornecer' || (esc.cabos_aco || {}).decisao === 'fornecer';
              const m = Array.isArray(r.quadros_comando_maquina) ? r.quadros_comando_maquina[0] : r.quadros_comando_maquina;
              return (
                <tr key={r.id}>
                  <td><b style={{ fontWeight: 500 }}>{r.numero_pedido}</b></td>
                  <td>{r.numero_cotacao || '—'}</td>
                  <td>{r.novo_ou_modernizacao === 'modernizacao' ? 'Modernização' : r.novo_ou_modernizacao === 'novo' ? 'Novo' : '—'}</td>
                  <td>{m && m.potencia_kw ? `${m.potencia_kw} kW / ${m.tensao_v} V` : '—'}</td>
                  <td className="text-right">{r.nParadas}</td><td className="text-right">{r.nBom}</td><td className="text-right">{r.nCortes}</td>
                  <td><span className="pcp-tag">{r.status}</span></td>
                  <td>{mae ? <button className="pcp-cod" onClick={() => abrirOp(mae.id)}>{mae.numero}</button>
                    : (podeCriar ? <button className="btn btn--sm" disabled={!pronto || busy} title={pronto ? '' : 'Preencha o escopo, as paradas ou a lista de materiais no formulário do quadro'} onClick={() => preparar(r)}>Gerar OPs</button> : '—')}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum pedido de quadro de comando.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        Pedidos vindos do formulário do quadro de comando. “Gerar OPs” cria a OP-mãe (pedido, com checklist de separação de portas e máquina) e uma OP por frente: quadro, fiação e botoeiras (furação e gravação de logo quando o formulário pede).
      </div>
    </div>
  );
}

/* ---------------- Página ---------------- */
function PCPPage({ setRoute, setSubsel }) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [aba, setAba] = window.useRouteTab('pcp', 'ordens', ['ordens', 'fila', 'pedidos', 'planejamento', 'controle']);
  const [podeCriar, setPodeCriar] = React.useState(false);
  const [podeEditar, setPodeEditar] = React.useState(false);
  const sb = window.__VP_SB && window.__VP_SB.sb;

  React.useEffect(() => {
    let vivo = true;
    if (!sb) { setErro('Supabase indisponível.'); return; }
    Promise.all([
      sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').limit(5000),
      sb.from('pcp_produtos').select('codigo, descricao, unidade, tipo_sped').eq('ativo', true).limit(5000),
      sb.from('pcp_estoque').select('codigo, quantidade').limit(10000),
    ]).then(([e, p, s]) => {
      if (!vivo) return;
      const err = e.error || p.error || s.error;
      if (err) { setErro(err.message); return; }
      const filhos = {}; (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const prods = {}; (p.data || []).forEach(l => { prods[l.codigo] = l; });
      const estoque = {}; (s.data || []).forEach(l => { estoque[l.codigo] = (estoque[l.codigo] || 0) + Number(l.quantidade || 0); });
      setDados({ filhos, prods, estoque });
    });
    const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('pcp', 'criar')).then(v => { if (vivo) setPodeCriar(!!v); }).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('pcp', 'editar')).then(v => { if (vivo) setPodeEditar(!!v); }).catch(() => {});
    return () => { vivo = false; };
  }, [sb]);

  const nav = { setRoute, setSubsel };
  const ctx = dados && {
    sb, dados, podeCriar, podeEditar, nav, pais: Object.keys(dados.filhos).sort(), abrirOp: () => setAba('ordens'),
    irParaItem: (codigo) => window.pcpIrPara?.(nav, dados.prods[codigo]?.tipo_sped === '01' ? 'cadastro-materias-primas' : 'cadastro-produtos', 'vp_pcp_busca', codigo),
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · PCP</div>
          <h1 className="page-head__title">PCP — Planejamento e Controle da Produção</h1>
          <p className="page-head__sub">Ordens de produção com etapas, materiais da estrutura e resultado (produzido × perdido).</p>
        </div>
      </div>
      <div className="pcp-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (aba === 'ordens' ? ' btn--primary' : '')} onClick={() => setAba('ordens')}>Ordens de Produção</button>
        <button className={'btn btn--sm' + (aba === 'fila' ? ' btn--primary' : '')} onClick={() => setAba('fila')}>Pedidos para Produzir</button>
        <button className={'btn btn--sm' + (aba === 'pedidos' ? ' btn--primary' : '')} onClick={() => setAba('pedidos')}>Pedidos de Quadro</button>
        <button className={'btn btn--sm' + (aba === 'planejamento' ? ' btn--primary' : '')} onClick={() => setAba('planejamento')}>Planejamento</button>
        <button className={'btn btn--sm' + (aba === 'controle' ? ' btn--primary' : '')} onClick={() => setAba('controle')}>Controle</button>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: 12 }}>{erro}</div>}
      {!erro && !dados && <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>}
      {ctx && aba === 'ordens' && <PCPOrdens ctx={ctx}/>}
      {ctx && aba === 'fila' && <PCPFilaProducao ctx={ctx} abrirOp={(id) => { try { sessionStorage.setItem('vp_pcp_op', id); } catch (e) { /* ok */ } setAba('ordens'); }}/>}
      {ctx && aba === 'pedidos' && <PCPPedidosQuadro ctx={ctx} abrirOp={(id) => { try { sessionStorage.setItem('vp_pcp_op', id); } catch (e) { /* ok */ } setAba('ordens'); }}/>}
      {ctx && aba === 'planejamento' && <PCPPlanejamento ctx={ctx}/>}
      {ctx && aba === 'controle' && <PCPControle ctx={ctx}/>}
    </div>
  );
}

Object.assign(window, { PCPPage });
