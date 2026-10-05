/* ============================================================
   almoxarifado.jsx — Pedidos de Compra de Varejo (insumos/peças pra
   estoque). Todo pedido nasce com uma decisão pendente do Chefe de
   Logística (Danilo) — ver pedidos-varejo-store.js / decisoes-store.js.
   ============================================================ */

const AV_URGENCIA_LABEL = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
const AV_STATUS_LABEL = { pendente: 'Aguardando Logística', aprovado: 'Aprovado', reprovado: 'Reprovado', comprado: 'Comprado', cancelado: 'Cancelado' };
function fmtBRL(v) { return v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function AVModalNovoPedido({ onClose, onSaved }) {
  const [item, setItem] = React.useState('');
  const [quantidade, setQuantidade] = React.useState(1);
  const [unidade, setUnidade] = React.useState('un');
  const [valorEstimado, setValorEstimado] = React.useState('');
  const [urgencia, setUrgencia] = React.useState('normal');
  const [justificativa, setJustificativa] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salvar = async () => {
    if (!item.trim()) return window.toast?.('Informe o item.', 'warning');
    setSaving(true);
    try {
      await window.PedidosVarejoStore.criarPedido({ item, quantidade, unidade, valorEstimado, urgencia, justificativa });
      window.toast?.('Pedido criado — aguardando aprovação da Logística.', 'success');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Novo pedido de compra de varejo" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Enviar pedido'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Item *</label>
          <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="ex.: Parafuso M8 inox, Cabo de aço 6mm…"/>
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Quantidade</label>
            <input className="input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)}/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Unidade</label>
            <input className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg, m…"/>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Valor estimado (R$)</label>
            <input className="input" type="number" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="0,00"/>
          </div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Urgência</label>
          <select className="input" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
            {Object.entries(AV_URGENCIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Justificativa</label>
          <textarea className="input" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que esse item é necessário…"/>
        </div>
      </div>
    </Modal>
  );
}

function almFmt(v, casas = 0) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

async function almErroFuncao(error, data) {
  if (data && data.error) return data.error;
  try {
    if (error && error.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json();
      if (body && body.error) return body.error;
    }
  } catch (e) { /* corpo não era JSON */ }
  return (error && error.message) || 'Erro desconhecido';
}
function almSolicitante() {
  return (window.__VP_USER && window.__VP_USER.email) || '';
}

/* Requisição de compra — grava no Omie (Edge Function pcp-omie-escrever). */
function AlmModalRequisicao({ prod, onClose, onDone }) {
  const [quantidade, setQuantidade] = React.useState('');
  const [obs, setObs] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const enviar = async () => {
    const q = Number(String(quantidade).replace(',', '.'));
    if (!(q > 0)) return window.toast?.('Informe a quantidade.', 'warning');
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', {
        body: { acao: 'requisicao_compra', solicitante: almSolicitante(), itens: [{ codigo: prod.codigo, quantidade: q, obs }] },
      });
      if (error || !data || data.ok === false) throw new Error(await almErroFuncao(error, data) || ((data && data.resultados && data.resultados[0] && data.resultados[0].erro) || 'falha'));
      const cod = data.resultados && data.resultados[0] && data.resultados[0].resposta && data.resultados[0].resposta.codReqCompra;
      window.toast?.('Requisição enviada ao Omie' + (cod ? ' (nº ' + cod + ')' : '') + '.', 'success');
      onDone && onDone(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={'Requisição de compra — ' + prod.codigo} onClose={onClose} width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={enviar} disabled={saving}>{saving ? 'Enviando…' : 'Enviar ao Omie'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{prod.descricao}</div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Quantidade ({prod.unidade || 'un'}) *</label>
          <input className="input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} autoFocus/>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observação</label>
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional"/>
        </div>
        <div className="small muted">Cria a requisição de compra no Omie (categoria pela origem do produto). Não dá para desfazer por aqui.</div>
      </div>
    </Modal>
  );
}

/* Movimento de estoque — entrada, saída ou acerto de saldo no local VERTICAL MP. */
const ALM_MOVIMENTOS = {
  ENT: { label: 'Entrada', motivos: { INV: 'Ajuste por inventário', INI: 'Estoque inicial' } },
  SAI: { label: 'Saída', motivos: { INV: 'Ajuste por inventário', PER: 'Perda ou quebra' } },
  SLD: { label: 'Acertar saldo (informar o saldo correto)', motivos: { INV: 'Ajuste por inventário', INI: 'Estoque inicial' } },
};
function AlmModalMovimento({ prod, onClose, onDone }) {
  const [tipo, setTipo] = React.useState('ENT');
  const [motivo, setMotivo] = React.useState('INV');
  const [quantidade, setQuantidade] = React.useState('');
  const [valor, setValor] = React.useState('');
  const [obs, setObs] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const trocarTipo = (t) => { setTipo(t); setMotivo(Object.keys(ALM_MOVIMENTOS[t].motivos)[0]); };
  const enviar = async () => {
    const q = Number(String(quantidade).replace(',', '.'));
    if (quantidade === '' || !(tipo === 'SLD' ? q >= 0 : q > 0)) return window.toast?.('Informe a quantidade.', 'warning');
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', {
        body: { acao: 'ajuste_estoque', solicitante: almSolicitante(), codigo: prod.codigo, tipo, motivo, quantidade: q, obs,
          valor: Number(String(valor).replace(',', '.')) > 0 ? Number(String(valor).replace(',', '.')) : undefined },
      });
      if (error || !data || data.ok === false) throw new Error(await almErroFuncao(error, data) || (data && data.erro) || 'falha');
      window.toast?.('Movimento gravado no Omie.', 'success');
      onDone && onDone(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={'Movimentar estoque — ' + prod.codigo} onClose={onClose} width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={enviar} disabled={saving}>{saving ? 'Gravando…' : 'Gravar no Omie'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{prod.descricao} · saldo atual: {prod.temSaldo ? almFmt(prod.saldo, 2) : '—'} {prod.unidade || ''}</div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
            {Object.entries(ALM_MOVIMENTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Motivo</label>
          <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {Object.entries(ALM_MOVIMENTOS[tipo].motivos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">{tipo === 'SLD' ? 'Saldo correto' : 'Quantidade'} ({prod.unidade || 'un'}) *</label>
          <input className="input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} autoFocus/>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Valor unitário (R$)</label>
          <input className="input" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="deixe em branco para usar o custo cadastrado"/>
          <div className="small muted">O Omie exige um valor. Só preencha se o produto ainda não tiver custo cadastrado.</div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observação</label>
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional"/>
        </div>
        <div className="small muted">Grava no Omie, local VERTICAL MP. Não dá para desfazer por aqui.</div>
      </div>
    </Modal>
  );
}

/* Edita o cadastro do produto no Omie: descrição, observação interna e estoque mínimo. */
function AlmModalEditarProduto({ prod, onClose, onDone }) {
  const [descricao, setDescricao] = React.useState(prod.descricao || '');
  const [obs, setObs] = React.useState(prod.observacao_interna || '');
  const [minimo, setMinimo] = React.useState(prod.estoque_minimo == null ? '' : String(prod.estoque_minimo));
  const [saving, setSaving] = React.useState(false);
  const enviar = async () => {
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', {
        body: { acao: 'produto_editar', solicitante: almSolicitante(), codigo: prod.codigo, descricao, observacao_interna: obs, estoque_minimo: minimo === '' ? undefined : Number(minimo) },
      });
      if (error || !data || data.ok === false) {
        const falha = data && data.resultados && data.resultados.find((r) => r.ok === false);
        throw new Error(await almErroFuncao(error, data) || (falha && falha.erro) || 'falha');
      }
      window.toast?.('Cadastro atualizado no Omie.', 'success');
      onDone && onDone(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={'Editar cadastro — ' + prod.codigo} onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={enviar} disabled={saving}>{saving ? 'Gravando…' : 'Gravar no Omie'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Descrição *</label>
          <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120}/>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Estoque mínimo ({prod.unidade || 'un'})</label>
          <input className="input" type="number" value={minimo} onChange={(e) => setMinimo(e.target.value)}/>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observação interna</label>
          <textarea className="input" rows={4} value={obs} onChange={(e) => setObs(e.target.value)}/>
        </div>
        <div className="small muted">Grava no cadastro do produto no Omie. Só o que mudou é enviado.</div>
      </div>
    </Modal>
  );
}

/* Estrutura (BOM) dos produtos fabricados — lê do PCP; alterações gravam no Omie. */
function AlmModalEstruturaLinha({ pai, linha, produtos, onClose, onDone }) {
  const [filho, setFilho] = React.useState(linha ? linha.codigo_filho : '');
  const [busca, setBusca] = React.useState('');
  const [quantidade, setQuantidade] = React.useState(linha ? String(linha.quantidade) : '');
  const [saving, setSaving] = React.useState(false);
  const novo = !linha;
  const soPcp = linha && linha.origem === 'pcp';
  const chamar = async (acao) => {
    const q = Number(String(quantidade).replace(',', '.'));
    if (acao !== 'estrutura_excluir' && !(q > 0)) return window.toast?.('Informe a quantidade.', 'warning');
    if (!filho) return window.toast?.('Escolha o componente.', 'warning');
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', {
        body: { acao, solicitante: almSolicitante(), pai, filho, quantidade: q },
      });
      if (error || !data || data.ok === false) throw new Error(await almErroFuncao(error, data) || (data && data.erro) || 'falha');
      window.toast?.('Estrutura atualizada no Omie.', 'success');
      onDone && onDone(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  const opcoes = produtos.filter((p) => p.codigo !== pai && (!busca || p.codigo.toLowerCase().includes(busca.toLowerCase()) || (p.descricao || '').toLowerCase().includes(busca.toLowerCase()))).slice(0, 60);
  return (
    <Modal title={(novo ? 'Adicionar componente' : 'Componente') + ' — ' + pai} onClose={onClose} width={520}
      footer={<>
        {!novo && !soPcp && <Button variant="ghost" disabled={saving} onClick={() => { if (window.confirm('Remover ' + filho + ' da estrutura no Omie?')) chamar('estrutura_excluir'); }}>Remover</Button>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={saving} onClick={() => chamar(novo || soPcp ? 'estrutura_incluir' : 'estrutura_alterar')}>
          {saving ? 'Gravando…' : (soPcp ? 'Enviar ao Omie' : 'Gravar no Omie')}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        {novo ? (
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Componente *</label>
            <input className="input" placeholder="Buscar código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
            <select className="input" size={6} value={filho} onChange={(e) => setFilho(e.target.value)}>
              {opcoes.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descricao}</option>)}
            </select>
          </div>
        ) : (
          <div className="small"><b>{linha.codigo_filho}</b> — {linha.descricao}</div>
        )}
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Quantidade por unidade do produto *</label>
          <input className="input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} autoFocus/>
        </div>
        {soPcp && <div className="small muted">Esta linha existe só no PCP. "Enviar ao Omie" a inclui na estrutura de lá.</div>}
        <div className="small muted">Grava na estrutura do produto no Omie. Não dá para desfazer por aqui.</div>
      </div>
    </Modal>
  );
}

function AlmoxarifadoEstrutura() {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [pai, setPai] = React.useState('');
  const [podeEscrever, setPodeEscrever] = React.useState(false);
  const [modal, setModal] = React.useState(null); // { linha | null }
  React.useEffect(() => {
    if (!window.PropostaStore) return;
    window.PropostaStore.temCapacidade('almoxarifado', 'escrever_omie').then(setPodeEscrever).catch(() => {});
  }, []);
  const carregar = React.useCallback(async () => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) { setErro('Supabase não carregou.'); setDados({ produtos: [], linhas: [] }); return; }
    const [pr, es] = await Promise.all([
      c.from('pcp_produtos').select('codigo, descricao, unidade').eq('ativo', true).order('codigo').range(0, 999),
      c.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, origem').range(0, 4999),
    ]);
    if (pr.error || es.error) { setErro((pr.error || es.error).message); setDados({ produtos: [], linhas: [] }); return; }
    setDados({ produtos: pr.data || [], linhas: es.data || [] });
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);
  if (!dados) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const porCodigo = new Map(dados.produtos.map((p) => [p.codigo, p]));
  const pais = Array.from(new Set(dados.linhas.map((l) => l.codigo_pai))).sort();
  const paiAtual = pai || pais[0] || '';
  const linhas = dados.linhas.filter((l) => l.codigo_pai === paiAtual)
    .map((l) => ({ ...l, descricao: (porCodigo.get(l.codigo_filho) || {}).descricao || '', unidade: (porCodigo.get(l.codigo_filho) || {}).unidade || '' }))
    .sort((a, b) => a.codigo_filho.localeCompare(b.codigo_filho));

  return (
    <>
      {erro && <div className="card" style={{ padding: 12, color: 'var(--vp-danger)', marginBottom: 12 }}>Erro: {erro}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 520 }} value={paiAtual} onChange={(e) => setPai(e.target.value)}>
          {pais.map((p) => <option key={p} value={p}>{p} — {(porCodigo.get(p) || {}).descricao || ''}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{linhas.length} componente(s)</span>
        <span style={{ flex: 1 }}/>
        {podeEscrever && paiAtual && <Button variant="primary" onClick={() => setModal({ linha: null })}>+ Adicionar componente</Button>}
      </div>
      <Card title="Estrutura do produto" sub="Componentes e quantidade por unidade fabricada">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Componente</th><th>Descrição</th><th>Un.</th><th className="text-right">Quantidade</th><th>Origem</th>{podeEscrever && <th></th>}</tr></thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Sem componentes.</td></tr>}
              {linhas.map((l) => (
                <tr key={l.codigo_filho}>
                  <td className="mono">{l.codigo_filho}</td>
                  <td>{l.descricao}</td>
                  <td>{l.unidade || '—'}</td>
                  <td className="text-right">{almFmt(l.quantidade, l.quantidade % 1 ? 2 : 0)}</td>
                  <td>{l.origem === 'pcp' ? <Badge variant="warning">Só no PCP</Badge> : <span className="small muted">Omie</span>}</td>
                  {podeEscrever && <td><Button variant="ghost" size="sm" onClick={() => setModal({ linha: l })}>{l.origem === 'pcp' ? 'Enviar ao Omie' : 'Editar'}</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && <AlmModalEstruturaLinha pai={paiAtual} linha={modal.linha} produtos={dados.produtos} onClose={() => setModal(null)} onDone={carregar}/>}
    </>
  );
}

/* Estoque do PCP — espelho do cadastro do Omie (pcp_produtos + pcp_estoque).
   Leitura vem do sync Omie → PCP; requisição e movimento gravam no Omie. */
/* Histórico de contagens de UM item (somente leitura): contagem × saldo do Omie na hora, para auditar divergências. */
function AlmModalHistoricoContagem({ prod, onClose }) {
  const [linhas, setLinhas] = React.useState(null);
  React.useEffect(() => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) { setLinhas([]); return; }
    c.from('pcp_estoque_contagens').select('quantidade_fisica, quantidade_omie, diferenca, contado_por, contado_em')
      .eq('codigo', prod.codigo).order('contado_em', { ascending: false }).limit(50)
      .then(({ data }) => setLinhas(data || []));
  }, [prod.codigo]);
  return (
    <Modal title={'Histórico de contagens — ' + prod.codigo} onClose={onClose} width={620} footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="small muted" style={{ marginBottom: 8 }}>{prod.descricao}</div>
      {linhas === null ? <div className="muted small">Carregando…</div> : linhas.length === 0 ? <div className="muted small">Nenhuma contagem registrada.</div> : (
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Quando</th><th className="text-right">Contagem</th><th className="text-right">Omie na hora</th><th className="text-right">Diferença</th><th>Quem</th></tr></thead>
            <tbody>{linhas.map((h, i) => {
              const d = Number(h.diferenca);
              return (
                <tr key={i}>
                  <td>{new Date(h.contado_em).toLocaleString('pt-BR')}</td>
                  <td className="text-right">{almFmt(h.quantidade_fisica, 2)}</td>
                  <td className="text-right">{almFmt(h.quantidade_omie, 2)}</td>
                  <td className="text-right" style={Math.abs(d) > 1e-9 ? { color: 'var(--vp-danger)', fontWeight: 600 } : { color: 'var(--fg3)' }}>{Math.abs(d) > 1e-9 ? (d > 0 ? '+' : '') + almFmt(d, 2) : 'ok'}</td>
                  <td className="small muted">{h.contado_por || '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* Acerto do saldo do Omie pela contagem real (grava no Omie: "acertar saldo" no local VERTICAL MP).
   Sempre passa por uma PRÉVIA (a função devolve o que enviaria, sem gravar nada) e por uma confirmação explícita.
   Avisa quando o saldo do Omie mudou depois da contagem (venda/entrada no meio do caminho) ou quando a contagem é antiga:
   nesses casos o certo é recontar antes de acertar. */
function almAvisosAcerto(prod, ultima, agora) {
  const av = [];
  if (!prod || prod.fisico == null) return av;
  if (ultima && ultima.quantidade_omie != null && Math.abs(Number(ultima.quantidade_omie) - prod.saldo) > 1e-9) {
    av.push('O saldo do Omie mudou depois da contagem (era ' + almFmt(ultima.quantidade_omie, 2) + ', agora ' + almFmt(prod.saldo, 2) + '): pode ter havido venda, entrada ou consumo. Recontar antes de acertar é o mais seguro.');
  }
  if (prod.fisicoEm && (agora - new Date(prod.fisicoEm).getTime()) > 24 * 3600 * 1000) {
    av.push('Esta contagem tem mais de 24 horas (feita em ' + new Date(prod.fisicoEm).toLocaleString('pt-BR') + ').');
  }
  return av;
}
function AlmModalAcerto({ prod, onClose, onDone }) {
  const [ultima, setUltima] = React.useState(undefined);       // última linha do histórico de contagens (undefined = carregando)
  const [previa, setPrevia] = React.useState({ estado: 'carregando' });   // carregando | ok | erro
  const [valor, setValor] = React.useState('');
  const [ciente, setCiente] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const quando = prod.fisicoEm ? new Date(prod.fisicoEm).toLocaleString('pt-BR') : '—';
  const obs = 'Acerto pela contagem física de ' + quando + (prod.fisicoPor ? ' (' + prod.fisicoPor + ')' : '');
  const corpo = (extra) => ({ acao: 'ajuste_estoque', solicitante: almSolicitante(), codigo: prod.codigo, tipo: 'SLD', motivo: 'INV', quantidade: prod.fisico, obs,
    valor: Number(String(valor).replace(',', '.')) > 0 ? Number(String(valor).replace(',', '.')) : undefined, ...extra });

  React.useEffect(() => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) { setUltima(null); return; }
    c.from('pcp_estoque_contagens').select('quantidade_omie, contado_em').eq('codigo', prod.codigo).order('contado_em', { ascending: false }).limit(1)
      .then(({ data }) => setUltima((data && data[0]) || null));
  }, [prod.codigo]);

  // Prévia: a função monta o ajuste e devolve, sem gravar em lugar nenhum (simular: true). Refaz ao informar o valor unitário.
  React.useEffect(() => {
    let vivo = true;
    setPrevia({ estado: 'carregando' });
    const t = setTimeout(async () => {
      try {
        const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', { body: corpo({ simular: true }) });
        if (!vivo) return;
        if (error || !data || data.ok === false || data.error) throw new Error(await almErroFuncao(error, data) || 'falha');
        setPrevia({ estado: 'ok', ajuste: data.ajuste });
      } catch (e) { if (vivo) setPrevia({ estado: 'erro', msg: String(e.message || e) }); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [valor]);

  const avisos = ultima === undefined ? [] : almAvisosAcerto(prod, ultima, Date.now());
  const precisaValor = previa.estado === 'erro' && /valor unit/i.test(previa.msg || '');
  const dif = prod.fisico - prod.saldo;
  const podeEnviar = previa.estado === 'ok' && ciente && !saving && ultima !== undefined;
  const enviar = async () => {
    setSaving(true);
    try {
      const { data, error } = await window.__VP_SB.sb.functions.invoke('pcp-omie-escrever', { body: corpo({}) });
      if (error || !data || data.ok === false) throw new Error(await almErroFuncao(error, data) || (data && data.erro) || 'falha');
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Acertou o saldo do Omie pela contagem', alvo: prod.codigo + ': Omie ' + almFmt(prod.saldo, 2) + ' → ' + almFmt(prod.fisico, 2) });
      window.toast?.('Saldo acertado no Omie: ' + prod.codigo + ' = ' + almFmt(prod.fisico, 2) + '.', 'success');
      onDone && onDone(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={'Acertar saldo no Omie — ' + prod.codigo} onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={enviar} disabled={!podeEnviar}>{saving ? 'Gravando…' : 'Acertar saldo no Omie'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{prod.descricao}</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <tbody>
              <tr><td>Saldo do Omie agora</td><td className="text-right">{almFmt(prod.saldo, 2)} {prod.unidade || ''}</td></tr>
              <tr><td>Contagem na prateleira</td><td className="text-right"><b>{almFmt(prod.fisico, 2)} {prod.unidade || ''}</b></td></tr>
              <tr><td>Diferença</td><td className="text-right" style={{ color: 'var(--vp-danger)', fontWeight: 600 }}>{(dif > 0 ? '+' : '') + almFmt(dif, 2)}</td></tr>
              <tr><td>Contado em / por</td><td className="text-right small">{quando}{prod.fisicoPor ? ' · ' + prod.fisicoPor : ''}</td></tr>
            </tbody>
          </table>
        </div>
        {avisos.map((a, i) => <div key={i} className="card" style={{ padding: 10, fontSize: 12, borderLeft: '3px solid var(--vp-yellow)' }}>⚠ {a}</div>)}
        {previa.estado === 'carregando' && <div className="small muted">Montando a prévia…</div>}
        {previa.estado === 'ok' && previa.ajuste && (
          <div className="small" style={{ color: 'var(--fg2)' }}>
            Prévia do que será enviado ao Omie: <b>acertar o saldo para {almFmt(prod.fisico, 2)}</b> no local VERTICAL MP, motivo “ajuste por inventário”, valor unitário R$ {almFmt(previa.ajuste.valor, 2)}. Nada foi gravado ainda.
          </div>
        )}
        {previa.estado === 'erro' && <div className="card" style={{ padding: 10, fontSize: 12, borderLeft: '3px solid var(--vp-danger)', color: 'var(--vp-danger)' }}>{previa.msg}</div>}
        {precisaValor && (
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Valor unitário (R$) *</label>
            <input className="input" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="o produto não tem custo cadastrado; o Omie exige um valor"/>
          </div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5 }}>
          <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} style={{ marginTop: 2 }}/>
          <span>Conferi a contagem e entendo que isto <b>altera o estoque no Omie</b> e não dá para desfazer por aqui.</span>
        </label>
      </div>
    </Modal>
  );
}

/* Cadastro incompleto de um item do estoque: o que falta e onde se corrige. Não bloqueia nada; só sinaliza. */
function almFaltas(l, podeVerCusto) {
  const f = [];
  if (!l.codigo_produto_omie) f.push({ id: 'semvinc', curto: 'sem vínculo no Omie', como: 'sincronize com o Omie; se persistir, o produto não existe lá com este código' });
  if (!(l.endereco || '').trim()) f.push({ id: 'semend', curto: 'sem endereço', como: 'preencha o endereço na coluna Endereço' });
  if (!(Number(l.leadtime_dias) > 0)) f.push({ id: 'semlead', curto: 'sem lead time', como: 'cadastre o lead time no produto, no Omie' });
  if (podeVerCusto && !(l.custo > 0)) f.push({ id: 'semcusto', curto: 'sem custo', como: 'informe o custo na aba Custos' });
  return f;
}

/* Aba "Estoque": o saldo do Omie (físico, reservado, disponível, a caminho) ao lado da contagem real da prateleira.
   - "Omie (físico)" vem de pcp_estoque (sync 4x/dia); reservado e a caminho vêm de pcp_posicao_compra (sync diário).
     Disponível = físico − reservado (mesma conta do Omie), então não fica velho se só o físico mudou.
   - Diferença = contagem − Omie FÍSICO (a prateleira conta o que está lá, inclusive o que já está reservado).
   - A data de "sincronizado" olha a última execução FINALIZADA, com ou sem avisos (antes só contava ok=true e ficava dias velha). */
function AlmoxarifadoEstoque() {
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [familia, setFamilia] = React.useState('todas');
  const [filtro, setFiltro] = React.useState('todos');
  const [ordem, setOrdem] = React.useState({ chave: null, dir: 1 });

  const [sincronizando, setSincronizando] = React.useState(false);
  const [ultimaSync, setUltimaSync] = React.useState(null);   // { em, ok, avisos: [] }
  const [posicaoEm, setPosicaoEm] = React.useState(null);
  const [podeEscrever, setPodeEscrever] = React.useState(false);
  const [podeContar, setPodeContar] = React.useState(false);     // registra o estoque físico (contagem real)
  const [podeVerCusto, setPodeVerCusto] = React.useState(null); // null = ainda verificando
  const [modalReq, setModalReq] = React.useState(null);
  const [modalMov, setModalMov] = React.useState(null);
  const [modalEd, setModalEd] = React.useState(null);
  const [modalHist, setModalHist] = React.useState(null);
  const [modalAcerto, setModalAcerto] = React.useState(null);
  // Colunas secundárias (Família, Mínimo, Custo, Lead time) ficam recolhidas para a tela caber; preferência por pessoa no navegador.
  const [maisCols, setMaisCols] = React.useState(() => { try { return localStorage.getItem('vp_alm_cols') === '1'; } catch (e) { return false; } });
  const alternarCols = () => setMaisCols((v) => { try { localStorage.setItem('vp_alm_cols', v ? '0' : '1'); } catch (e) { /* sem storage */ } return !v; });
  const [menuAcao, setMenuAcao] = React.useState(null);   // { l, x, y } — menu "⋯" da linha (fixo na tela, não é cortado pela rolagem)
  React.useEffect(() => {
    if (!menuAcao) return undefined;
    const fechar = () => setMenuAcao(null);
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('click', fechar); window.addEventListener('scroll', fechar, true); window.addEventListener('keydown', tecla); window.addEventListener('resize', fechar);
    return () => { window.removeEventListener('click', fechar); window.removeEventListener('scroll', fechar, true); window.removeEventListener('keydown', tecla); window.removeEventListener('resize', fechar); };
  }, [menuAcao]);
  React.useEffect(() => {
    if (!window.PropostaStore) { setPodeVerCusto(false); return; }
    window.PropostaStore.temCapacidade('almoxarifado', 'escrever_omie').then(setPodeEscrever).catch(() => {});
    window.PropostaStore.temCapacidade('almoxarifado', 'editar').then(setPodeContar).catch(() => {});
    window.PropostaStore.temCapacidade('almoxarifado', 'ver_custo').then(setPodeVerCusto).catch(() => setPodeVerCusto(false));
  }, []);

  const carregar = React.useCallback(() => {
    if (podeVerCusto === null) return;
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) { setErro('Supabase não carregou.'); setLinhas([]); return; }
    // Sem a alçada "ver_custo" o custo real nem é pedido ao banco: a coluna mostra só um valor de enfeite borrado.
    const pProdutos = c.from('pcp_produtos')
      .select('codigo, codigo_produto_omie, descricao, unidade, familia, estoque_minimo, leadtime_dias, endereco, observacao_interna, pcp_estoque(quantidade), pcp_estoque_fisico(quantidade, contado_em, contado_por)' + (podeVerCusto ? ', preco_custo, custo_manual' : ''))
      .eq('ativo', true).order('familia').order('codigo');
    const pPosicao = c.from('pcp_posicao_compra').select('codigo, reservado, pendente, atualizado_em').range(0, 4999);
    Promise.all([pProdutos, pPosicao]).then(([rp, rq]) => {
      if (rp.error) { setErro(rp.error.message); setLinhas([]); return; }
      const pos = {};
      let maisRecente = null;
      ((rq && rq.data) || []).forEach((p) => { pos[p.codigo] = p; if (p.atualizado_em && (!maisRecente || p.atualizado_em > maisRecente)) maisRecente = p.atualizado_em; });
      setPosicaoEm(maisRecente);
      setLinhas((rp.data || []).map((p) => {
        const f = Array.isArray(p.pcp_estoque_fisico) ? p.pcp_estoque_fisico[0] : p.pcp_estoque_fisico;   // 1:1, mas tolera as duas formas
        const saldo = (p.pcp_estoque || []).reduce((s, e) => s + Number(e.quantidade || 0), 0);
        const ps = pos[p.codigo];
        const reservado = ps && ps.reservado != null ? Number(ps.reservado) : null;
        return {
          ...p,
          saldo,
          temSaldo: (p.pcp_estoque || []).length > 0,
          reservado,
          pendente: ps && ps.pendente != null ? Number(ps.pendente) : null,
          disponivel: reservado != null ? saldo - reservado : null,
          fisico: f ? Number(f.quantidade) : null,
          fisicoEm: f ? f.contado_em : null,
          fisicoPor: f ? f.contado_por : null,
          dif: f ? Number(f.quantidade) - saldo : null,
          custo: podeVerCusto ? (Number(p.preco_custo) > 0 ? Number(p.preco_custo) : (Number(p.custo_manual) > 0 ? Number(p.custo_manual) : 0)) : null,
          faltas: [],
        };
      }));
    });
    c.from('pcp_sync_log').select('finalizado_em, ok, resumo').not('finalizado_em', 'is', null).order('finalizado_em', { ascending: false }).limit(1)
      .then(({ data }) => {
        const s = data && data[0];
        setUltimaSync(s ? { em: s.finalizado_em, ok: s.ok, avisos: (s.resumo && Array.isArray(s.resumo.erros)) ? s.resumo.erros : [] } : null);
      });
  }, [podeVerCusto]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // Registra a contagem física (não escreve no Omie): atualiza o saldo físico atual e guarda no histórico
  // o saldo do Omie naquele momento, para auditar a diferença.
  const contar = async (l, valor) => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    if (valor === '') return;
    const q = Number(valor);
    if (!(q >= 0)) { window.toast?.('Quantidade inválida.'); return; }
    if (l.fisico != null && Math.abs(q - l.fisico) < 1e-9) return;
    const quem = (window.__VP_USER && window.__VP_USER.email) || null;
    const agora = new Date().toISOString();
    const r1 = await c.from('pcp_estoque_fisico').upsert({ codigo: l.codigo, quantidade: q, contado_em: agora, contado_por: quem }, { onConflict: 'codigo' });
    if (r1.error) { window.toast?.('Não foi possível salvar a contagem: ' + r1.error.message); carregar(); return; }
    const r2 = await c.from('pcp_estoque_contagens').insert({
      codigo: l.codigo, quantidade_fisica: q, quantidade_omie: l.saldo, diferenca: q - l.saldo, contado_por: quem, contado_em: agora,
    });
    if (r2.error) window.toast?.('Contagem salva, mas o histórico não foi gravado: ' + r2.error.message);
    window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Registrou estoque físico', alvo: `${l.codigo}: físico ${q} × Omie ${l.saldo}` });
    carregar();
  };

  // Endereço da prateleira: dado só do PCP (a sincronização com o Omie não mexe nele), então se completa aqui mesmo.
  const salvarEndereco = async (l, valor) => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    const novo = String(valor || '').trim().slice(0, 60);
    if (novo === String(l.endereco || '').trim()) return;
    const r = await c.from('pcp_produtos').update({ endereco: novo || null }).eq('codigo', l.codigo).select('codigo');
    if (r.error || !r.data || r.data.length === 0) { window.toast?.('Não foi possível salvar o endereço' + (r.error ? ': ' + r.error.message : '.')); carregar(); return; }
    window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Definiu o endereço do item', alvo: `${l.codigo}: ${novo || '(vazio)'}` });
    carregar();
  };

  const sincronizar = async () => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    setSincronizando(true);
    try {
      const { data, error } = await c.functions.invoke('sync-pcp-omie', { body: { escopo: 'tudo' } });
      if (error) throw error;
      if (data && data.ok === false) {
        // Os dados foram gravados; só alguns itens deram aviso (ex.: produto sem vínculo no Omie).
        window.toast?.('Sincronizado, com ' + ((data.erros || []).length || 'alguns') + ' aviso(s): ' + (data.erros || []).slice(0, 2).join(' · '), 'warning');
      } else window.toast?.('Sincronizado com o Omie.', 'success');
      carregar();
    } catch (e) {
      window.toast?.('Erro ao sincronizar: ' + (e.message || e), 'error');
    } finally { setSincronizando(false); }
  };

  if (linhas === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  linhas.forEach((l) => { l.faltas = almFaltas(l, podeVerCusto); });   // campo derivado (não vem do banco)
  const EPS = 1e-9;
  const abaixoMin = (l) => l.temSaldo && l.estoque_minimo != null && l.saldo < Number(l.estoque_minimo);
  const FILTROS = [
    { id: 'todos', label: 'Todos', fn: () => true },
    { id: 'dif', label: 'Com diferença', fn: (l) => l.fisico != null && Math.abs(l.dif) > EPS },
    { id: 'semcont', label: 'Sem contagem', fn: (l) => l.fisico == null },
    { id: 'abaixo', label: 'Abaixo do mínimo', fn: abaixoMin },
    { id: 'reserv', label: 'Com reservado', fn: (l) => (l.reservado || 0) > 0 },
    ...(podeVerCusto ? [{ id: 'semcusto', label: 'Sem custo', fn: (l) => !(l.custo > 0) }] : []),
    { id: 'semend', label: 'Sem endereço', fn: (l) => l.faltas.some((x) => x.id === 'semend') },
    { id: 'semlead', label: 'Sem lead time', fn: (l) => l.faltas.some((x) => x.id === 'semlead') },
    { id: 'semvinc', label: 'Sem vínculo no Omie', fn: (l) => l.faltas.some((x) => x.id === 'semvinc') },
  ];
  const familias = Array.from(new Set(linhas.map((l) => l.familia).filter(Boolean)));
  const q = busca.trim().toLowerCase();
  const base = linhas.filter((l) =>
    (familia === 'todas' || l.familia === familia) &&
    (!q || l.codigo.toLowerCase().includes(q) || (l.descricao || '').toLowerCase().includes(q)));
  const contagemPor = {};
  FILTROS.forEach((f) => { contagemPor[f.id] = base.filter(f.fn).length; });
  const filtroAtual = FILTROS.find((f) => f.id === filtro) || FILTROS[0];
  let visiveis = base.filter(filtroAtual.fn);
  if (ordem.chave) {
    const k = ordem.chave;
    const texto = k === 'codigo' || k === 'descricao' || k === 'familia';
    visiveis = visiveis.slice().sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;      // vazios sempre no fim, qualquer que seja o sentido
      if (vb == null) return -1;
      return (texto ? String(va).localeCompare(String(vb), 'pt-BR') : va - vb) * ordem.dir;
    });
  }
  const alternarOrdem = (chave) => setOrdem((o) => o.chave !== chave ? { chave, dir: 1 } : (o.dir === 1 ? { chave, dir: -1 } : { chave: null, dir: 1 }));
  const Th = ({ chave, children, right, title }) => (
    <th className={right ? 'text-right' : undefined} title={title} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => alternarOrdem(chave)}>
      {children}{ordem.chave === chave ? (ordem.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const nContados = linhas.filter((l) => l.fisico != null).length;
  const nDif = linhas.filter((l) => l.fisico != null && Math.abs(l.dif) > EPS).length;
  const nCompletos = linhas.filter((l) => l.faltas.length === 0).length;

  return (
    <>
      {erro && <div className="card" style={{ padding: 12, color: 'var(--vp-danger)', marginBottom: 12 }}>Erro: {erro}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <select className="input" style={{ maxWidth: 260 }} value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="todas">Todas as famílias</option>
          {familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{visiveis.length} produto(s)</span>
        <span style={{ flex: 1 }}/>
        <span className="muted" style={{ fontSize: 12 }}>{ultimaSync ? 'Sincronizado com o Omie em ' + new Date(ultimaSync.em).toLocaleString('pt-BR') : 'Ainda não sincronizado'}</span>
        {ultimaSync && !ultimaSync.ok && ultimaSync.avisos.length > 0 && (
          <Badge variant="warning" style={{ cursor: 'help' }}>
            <span title={'A sincronização terminou, mas com avisos de cadastro no Omie:\n' + ultimaSync.avisos.join('\n')}>{ultimaSync.avisos.length} aviso(s) de cadastro</span>
          </Badge>
        )}
        <Button variant="primary" disabled={sincronizando} onClick={sincronizar}>{sincronizando ? 'Sincronizando…' : 'Sincronizar com Omie'}</Button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTROS.filter((f) => !['semend', 'semlead', 'semvinc'].includes(f.id) || contagemPor[f.id] > 0 || filtro === f.id).map((f) => (
          <Button key={f.id} size="sm" variant={filtro === f.id ? 'primary' : 'ghost'} onClick={() => setFiltro(f.id)}>
            {f.label} <span style={{ opacity: 0.7 }}>({contagemPor[f.id]})</span>
          </Button>
        ))}
        <span style={{ flex: 1 }}/>
        <Button size="sm" variant="ghost" title="Mostrar ou esconder Família, Mínimo, Custo e Lead time" onClick={alternarCols}>{maisCols ? '◂ Menos colunas' : 'Mais colunas ▸'}</Button>
        <span className="muted" style={{ fontSize: 12 }}>
          Cadastro completo: {nCompletos} de {linhas.length} · Contagem: {nContados} de {linhas.length}{nDif > 0 ? ` · ${nDif} com diferença` : ''}
        </span>
      </div>
      <Card title="Estoque do PCP" sub="Saldo do Omie × contagem real da prateleira · clique no título da coluna para ordenar">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid pcp-estoque">
            <thead>
              <tr>
                <Th chave="codigo">Código</Th><Th chave="descricao">Descrição</Th>{maisCols && <Th chave="familia">Família</Th>}<th>Un.</th>
                <Th chave="saldo" right title="Saldo físico total no Omie (inclui o que já está reservado)">Omie (físico)</Th>
                <Th chave="reservado" right title={'Separado para pedidos no Omie' + (posicaoEm ? ' · atualizado em ' + new Date(posicaoEm).toLocaleString('pt-BR') : '')}>Reservado</Th>
                <Th chave="disponivel" right title="Físico − reservado: o que realmente dá para usar">Disponível</Th>
                <Th chave="pendente" right title="Pedido de compra aberto no Omie, ainda não recebido">A caminho</Th>
                <Th chave="fisico" right title="Contagem real na prateleira (digite aqui)">Contagem</Th>
                <Th chave="dif" right title="Contagem − Omie (físico)">Diferença</Th>
                {maisCols && <Th chave="estoque_minimo" right>Mínimo</Th>}
                {maisCols && <Th chave="custo" right title={podeVerCusto ? '' : 'Sem permissão para ver custos'}>Custo (R$)</Th>}
                <th>Endereço</th>
                {maisCols && <Th chave="leadtime_dias" right>Lead time (d)</Th>}
                {podeEscrever && <th className="pcp-acao" title="Ações"></th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum produto neste filtro.</td></tr>}
              {visiveis.map((l) => {
                const abaixo = abaixoMin(l);
                return (
                  <tr key={l.codigo}>
                    <td className="mono">
                      {l.faltas.length > 0 && <span style={{ color: 'var(--vp-yellow)', cursor: 'help' }} title={'Cadastro incompleto:\n' + l.faltas.map((x) => '• ' + x.curto + ' — ' + x.como).join('\n')}>● </span>}
                      {l.codigo}
                    </td>
                    <td>{l.descricao}</td>
                    {maisCols && <td className="small muted">{l.familia || '—'}</td>}
                    <td>{l.unidade || '—'}</td>
                    <td className="text-right" style={{ color: abaixo ? 'var(--vp-danger)' : undefined, fontWeight: abaixo ? 700 : undefined }}
                      title={abaixo ? 'Abaixo do estoque mínimo cadastrado (' + almFmt(l.estoque_minimo) + ')' : ''}>{l.temSaldo ? almFmt(l.saldo, 2) : '—'}</td>
                    <td className="text-right" style={{ color: (l.reservado || 0) > 0 ? undefined : 'var(--fg3)' }}>{l.reservado == null ? '—' : almFmt(l.reservado, 2)}</td>
                    <td className="text-right" style={l.disponivel != null && l.disponivel <= 0 && l.saldo > 0 ? { color: 'var(--vp-danger)', fontWeight: 600 } : undefined}
                      title={l.disponivel != null && l.disponivel <= 0 && l.saldo > 0 ? 'Tudo o que há em estoque já está reservado' : ''}>{l.disponivel == null ? '—' : almFmt(l.disponivel, 2)}</td>
                    <td className="text-right" style={{ color: (l.pendente || 0) > 0 ? undefined : 'var(--fg3)' }}>{l.pendente == null || l.pendente === 0 ? '—' : almFmt(l.pendente, 2)}</td>
                    <td className="text-right" title={l.fisicoEm ? `Contado em ${new Date(l.fisicoEm).toLocaleString('pt-BR')}${l.fisicoPor ? ' por ' + l.fisicoPor : ''}` : 'Ainda não contado'}>
                      {podeContar
                        ? <input className="input" type="number" min="0" step="any" placeholder="—" key={l.codigo + '-' + (l.fisico ?? '') + '-' + (l.fisicoEm || '')}
                            defaultValue={l.fisico ?? ''} style={{ width: 90, textAlign: 'right' }} onBlur={(e) => contar(l, e.target.value)}/>
                        : (l.fisico != null ? almFmt(l.fisico, 2) : '—')}
                    </td>
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      {l.fisico == null ? <span style={{ color: 'var(--fg3)' }}>—</span> : (
                        <>
                          <span style={Math.abs(l.dif) > EPS ? { color: 'var(--vp-danger)', fontWeight: 600 } : { color: 'var(--fg3)' }}
                            title={Math.abs(l.dif) > EPS ? 'A contagem não bate com o Omie' : 'Bate com o Omie'}>{Math.abs(l.dif) > EPS ? (l.dif > 0 ? '+' : '') + almFmt(l.dif, 2) : 'ok'}</span>
                          {podeEscrever && Math.abs(l.dif) > EPS && (
                            <>{' '}<Button variant="primary" size="sm" title="Acertar o saldo do Omie com esta contagem (grava no Omie, com prévia e confirmação)" onClick={() => setModalAcerto(l)}>Acertar</Button></>
                          )}
                          {' '}<Button variant="ghost" size="sm" title="Histórico de contagens deste item" onClick={() => setModalHist(l)}>↺</Button>
                        </>
                      )}
                    </td>
                    {maisCols && <td className="text-right">{almFmt(l.estoque_minimo)}</td>}
                    {maisCols && <td className="text-right" title={podeVerCusto ? '' : 'Sem permissão para ver custos'}
                      style={podeVerCusto ? undefined : { filter: 'blur(6px)', userSelect: 'none' }}>
                      {podeVerCusto ? (Number(l.preco_custo) > 0 ? almFmt(l.preco_custo, 2) : (Number(l.custo_manual) > 0 ? <span title="Custo manual (estimado): o Omie ainda não tem custo deste item">{almFmt(l.custo_manual, 2)} ⓜ</span> : almFmt(l.preco_custo, 2))) : '00,00'}
                    </td>}
                    <td>
                      {podeContar
                        ? <input className="input" type="text" maxLength={60} placeholder="falta" key={l.codigo + '-end-' + (l.endereco || '')}
                            defaultValue={l.endereco || ''} style={{ width: 76 }} title="Endereço na prateleira (só do PCP)" onBlur={(e) => salvarEndereco(l, e.target.value)}/>
                        : (l.endereco || <span style={{ color: 'var(--fg3)' }}>falta</span>)}
                    </td>
                    {maisCols && <td className="text-right">{almFmt(l.leadtime_dias)}</td>}
                    {podeEscrever && (
                      <td className="pcp-acao">
                        <Button variant="ghost" size="sm" title="Requisitar, movimentar ou editar este item" onClick={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenuAcao(menuAcao && menuAcao.l.codigo === l.codigo ? null : { l, x: Math.max(8, r.right - 196), y: r.bottom + 4 });
                        }}>⋯</Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {menuAcao && (
        <div role="menu" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: menuAcao.x, top: menuAcao.y, width: 196, zIndex: 60, background: 'var(--vp-white, #fff)', border: '1px solid var(--vp-gray-200, #d9dce1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: 4, display: 'flex', flexDirection: 'column' }}>
          <div className="small muted" style={{ padding: '4px 10px', fontFamily: 'monospace' }}>{menuAcao.l.codigo}</div>
          <Button variant="ghost" size="sm" style={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }} onClick={() => { setModalReq(menuAcao.l); setMenuAcao(null); }}>Requisitar compra</Button>
          <Button variant="ghost" size="sm" style={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }} onClick={() => { setModalMov(menuAcao.l); setMenuAcao(null); }}>Movimentar estoque</Button>
          <Button variant="ghost" size="sm" style={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }} onClick={() => { setModalEd(menuAcao.l); setMenuAcao(null); }}>Editar cadastro</Button>
          {menuAcao.l.fisico != null && Math.abs(menuAcao.l.dif) > EPS && (
            <Button variant="ghost" size="sm" style={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }} onClick={() => { setModalAcerto(menuAcao.l); setMenuAcao(null); }}>Acertar saldo pela contagem</Button>
          )}
        </div>
      )}
      {modalReq && <AlmModalRequisicao prod={modalReq} onClose={() => setModalReq(null)} onDone={carregar}/>}
      {modalMov && <AlmModalMovimento prod={modalMov} onClose={() => setModalMov(null)} onDone={carregar}/>}
      {modalEd && <AlmModalEditarProduto prod={modalEd} onClose={() => setModalEd(null)} onDone={carregar}/>}
      {modalHist && <AlmModalHistoricoContagem prod={modalHist} onClose={() => setModalHist(null)}/>}
      {modalAcerto && <AlmModalAcerto prod={modalAcerto} onClose={() => setModalAcerto(null)} onDone={carregar}/>}
    </>
  );
}

/* Aba "Custos": preenche o custo MANUAL (estimado) dos itens que o Omie ainda não tem custo (nunca comprados).
   Regras: o custo do Omie sempre vence; o manual só vale quando o Omie não tem (rpCustoEfetivo, relatorios-pcp-custos.jsx).
   Ver exige almoxarifado.ver_custo; gravar exige almoxarifado.custo_manual. A coluna é própria (custo_manual*): a
   sincronização com o Omie sobrescreve preco_custo e apagaria o ajuste. Lista primeiro o que trava o lucro dos
   produtos JÁ VENDIDOS (componentes das estruturas dos itens de pcp_pedido_itens). */
function AlmoxarifadoCustos() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [pVer, setPVer] = React.useState(null);
  const [pEditar, setPEditar] = React.useState(false);
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('pendentes');   // pendentes | manuais | todos
  const [soVendidos, setSoVendidos] = React.useState(true);
  const [busca, setBusca] = React.useState('');
  const [edits, setEdits] = React.useState({});               // codigo -> { valor, obs }
  const [salvando, setSalvando] = React.useState(null);

  React.useEffect(() => {
    const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setPVer(!!v)).catch(() => setPVer(false));
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'custo_manual')).then(v => setPEditar(!!v)).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase não carregou.'); return; }
    const [pr, es, it] = await Promise.all([
      sb.from('pcp_produtos').select('codigo, descricao, unidade, preco_custo, custo_manual, custo_manual_obs, custo_manual_por, custo_manual_em').eq('ativo', true).order('codigo').limit(5000),
      sb.from('pcp_estrutura').select('codigo_pai, codigo_filho').limit(5000),
      sb.from('pcp_pedido_itens').select('codigo').eq('item_pcp', true).limit(20000),
    ]);
    const err = pr.error || es.error || it.error;
    if (err) { setErro(err.message); return; }
    const filhos = {}; (es.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
    const vendidos = Array.from(new Set((it.data || []).map(x => x.codigo)));
    const usadoEm = {};                                          // folha -> produtos vendidos que dependem dela
    vendidos.forEach(raiz => { rpFolhasOnde(raiz, filhos, () => true).forEach(f => { (usadoEm[f] = usadoEm[f] || new Set()).add(raiz); }); });
    setErro(null); setDados({ produtos: pr.data || [], usadoEm, temFilhos: new Set(Object.keys(filhos)) });
  }, [sb]);
  React.useEffect(() => { if (pVer) carregar(); }, [pVer, carregar]);

  if (pVer === null) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Verificando permissão…</div>;
  if (!pVer) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Você não tem a alçada para ver custos (almoxarifado › Vê os preços de custo).</div>;
  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>{erro}</div>;
  if (!dados) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const semOmie = (p) => !(Number(p.preco_custo) > 0);
  const eFolha = (p) => !dados.temFilhos.has(p.codigo);           // custo de montagem sai da estrutura; só folha precisa de custo próprio
  const usado = (p) => dados.usadoEm[p.codigo] ? Array.from(dados.usadoEm[p.codigo]) : [];
  const pendentes = dados.produtos.filter(p => semOmie(p) && eFolha(p) && !(Number(p.custo_manual) > 0));
  const pendUsados = pendentes.filter(p => usado(p).length);
  const comManual = dados.produtos.filter(p => Number(p.custo_manual) > 0);
  const q = busca.trim().toLowerCase();
  let lista = dados.produtos.filter(p => eFolha(p) || Number(p.custo_manual) > 0);
  if (filtro === 'pendentes') lista = lista.filter(p => semOmie(p) && !(Number(p.custo_manual) > 0));
  else if (filtro === 'manuais') lista = lista.filter(p => Number(p.custo_manual) > 0);
  else lista = lista.filter(p => semOmie(p) || Number(p.custo_manual) > 0);
  if (soVendidos && filtro !== 'manuais') lista = lista.filter(p => usado(p).length);
  if (q) lista = lista.filter(p => (p.codigo + ' ' + (p.descricao || '')).toLowerCase().includes(q));
  lista = lista.sort((a, b) => usado(b).length - usado(a).length || a.codigo.localeCompare(b.codigo)).slice(0, 300);

  const ed = (p) => edits[p.codigo] || { valor: p.custo_manual != null ? String(p.custo_manual).replace('.', ',') : '', obs: p.custo_manual_obs || '' };
  const mudou = (p) => { const e = edits[p.codigo]; return !!e && (e.valor !== (p.custo_manual != null ? String(p.custo_manual).replace('.', ',') : '') || e.obs !== (p.custo_manual_obs || '')); };
  const salvar = async (p) => {
    const e = ed(p), txt = String(e.valor).trim().replace(/\./g, '').replace(',', '.');
    const v = txt === '' ? null : Number(txt);
    if (v !== null && !(v > 0)) { window.toast?.('Informe um valor maior que zero (ou deixe vazio para limpar).', 'error'); return; }
    setSalvando(p.codigo);
    const quem = (window.__VP_USER && window.__VP_USER.email) || null;
    const { data, error } = await sb.from('pcp_produtos').update({
      custo_manual: v, custo_manual_obs: v === null ? null : (e.obs.trim() || null),
      custo_manual_por: v === null ? null : quem, custo_manual_em: v === null ? null : new Date().toISOString(),
    }).eq('codigo', p.codigo).select('codigo');
    setSalvando(null);
    if (error || !data || !data.length) { window.toast?.('Não foi possível salvar: ' + (error ? error.message : 'nenhuma linha alterada'), 'error'); return; }
    window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: v === null ? 'Removeu custo manual' : 'Informou custo manual', alvo: `${p.codigo} — ${v === null ? 'removido' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` });
    window.toast?.(v === null ? 'Custo manual removido.' : 'Custo manual salvo.', 'success');
    setEdits(x => { const n = { ...x }; delete n[p.codigo]; return n; });
    await carregar();
  };

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <KPI label="Sem custo, usados em produtos vendidos" value={pendUsados.length} sub="travam o lucro real" delta="—" deltaDir="up" icon="alert"/>
        <KPI label="Sem custo no total" value={pendentes.length} sub="componentes sem custo no Omie nem manual" delta="—" deltaDir="up" icon="package"/>
        <KPI label="Com custo manual" value={comManual.length} sub="estimativas lançadas no PCP" delta="—" deltaDir="up" icon="check"/>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant={filtro === 'pendentes' ? 'primary' : 'ghost'} onClick={() => setFiltro('pendentes')}>Pendentes</Button>
        <Button variant={filtro === 'manuais' ? 'primary' : 'ghost'} onClick={() => setFiltro('manuais')}>Com custo manual</Button>
        <Button variant={filtro === 'todos' ? 'primary' : 'ghost'} onClick={() => setFiltro('todos')}>Sem custo no Omie (todos)</Button>
        <label style={{ fontSize: 12, color: 'var(--fg3)' }}><input type="checkbox" checked={soVendidos} onChange={e => setSoVendidos(e.target.checked)}/> só os usados em produtos já vendidos</label>
        <input className="input" placeholder="Buscar código ou descrição" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 240 }}/>
      </div>
      <Card title="Custos sem cadastro no Omie" sub={`${lista.length} item(ns)${pEditar ? '' : ' · somente leitura (sem a alçada de custo manual)'}`}>
        <div className="table-wrap" style={{ border: 0, overflowX: 'auto' }}>
          <table className="t pcp-grid">
            <thead><tr><th>Código</th><th>Descrição</th><th>Usado em</th><th className="text-right">Custo Omie</th><th className="text-right">Custo manual (R$)</th><th>Observação / fonte</th><th></th></tr></thead>
            <tbody>
              {lista.map(p => {
                const e = ed(p), omie = !semOmie(p);
                return (
                  <tr key={p.codigo}>
                    <td><b style={{ fontWeight: 500 }}>{p.codigo}</b></td>
                    <td style={{ minWidth: 220 }}>{p.descricao}<div style={{ fontSize: 10, color: 'var(--fg3)' }}>{p.unidade || ''}{p.custo_manual_por ? ` · manual por ${p.custo_manual_por} em ${new Date(p.custo_manual_em).toLocaleDateString('pt-BR')}` : ''}</div></td>
                    <td style={{ fontSize: 12 }}>{usado(p).length ? usado(p).join(', ') : <span style={{ color: 'var(--fg3)' }}>nenhum vendido</span>}</td>
                    <td className="text-right">{omie ? almFmt(p.preco_custo, 2) : <span style={{ color: 'var(--vp-yellow)' }}>sem custo</span>}</td>
                    <td className="text-right">
                      <input className="input" style={{ width: 110, textAlign: 'right' }} disabled={!pEditar || omie} placeholder="0,00" value={e.valor}
                        onChange={ev => setEdits({ ...edits, [p.codigo]: { ...e, valor: ev.target.value } })}/>
                      {omie && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>o custo do Omie vale</div>}
                    </td>
                    <td><input className="input" style={{ width: 200 }} disabled={!pEditar || omie} placeholder="ex.: orçamento do fornecedor X" value={e.obs}
                      onChange={ev => setEdits({ ...edits, [p.codigo]: { ...e, obs: ev.target.value } })}/></td>
                    <td>{pEditar && !omie && <Button variant="primary" disabled={!mudou(p) || salvando === p.codigo} onClick={() => salvar(p)}>{salvando === p.codigo ? 'Salvando…' : 'Salvar'}</Button>}</td>
                  </tr>
                );
              })}
              {lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>{filtro === 'pendentes' ? 'Nenhum componente pendente com os filtros atuais.' : 'Nada para mostrar com os filtros atuais.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        O custo manual é uma <b style={{ fontWeight: 500 }}>estimativa do PCP</b> e só vale enquanto o Omie não tiver custo do item; quando o Omie passar a ter (primeira compra), o do Omie assume sozinho. Entra no lucro dos relatórios com o marcador ⓜ. Limpe o campo e salve para remover.
      </div>
    </div>
  );
}

function AlmoxarifadoPage() {
  const [aba, setAba] = window.useRouteTab('almoxarifado', 'estoque', ['estoque', 'estrutura', 'custos', 'reposicao', 'necessidade', 'pedidos'], false, true);
  const [pedidos, setPedidos] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(null);

  const reload = React.useCallback(() => {
    window.PedidosVarejoStore.listarPedidos().then(setPedidos).catch(() => setPedidos([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const comprar = async (p) => {
    setBusy(p.id);
    try { await window.PedidosVarejoStore.marcarComprado(p.id); window.toast?.('Marcado como comprado.', 'success'); reload(); }
    catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(null); }
  };

  const emEstoque = aba === 'estoque';
  const emEstrutura = aba === 'estrutura';
  const emCustos = aba === 'custos';
  const emReposicao = aba === 'reposicao';
  const emNecessidade = aba === 'necessidade';
  if (aba === 'pedidos' && pedidos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const lista = pedidos || [];
  const pendentes = lista.filter((p) => p.status === 'pendente');
  const aprovados = lista.filter((p) => p.status === 'aprovado');

  const cabecalho = (
    <>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Almoxarifado</div>
          <h1 className="page-head__title">{emEstoque ? 'Estoque' : emEstrutura ? 'Estrutura dos produtos' : emCustos ? 'Custos' : emReposicao ? 'Reposição' : emNecessidade ? 'Necessidade de materiais' : 'Pedidos de Compra (Varejo)'}</h1>
          <p className="page-head__sub">{emEstoque
            ? 'Estoque do PCP — cabos de aço, cabos de manobra, corrimãos e componentes dos Quadros de Comando.'
            : emEstrutura
              ? 'Lista de materiais dos Quadros de Comando. Alterações são gravadas no Omie.'
              : emCustos
                ? 'Custo manual (estimado) dos itens que o Omie ainda não tem custo — necessário para o lucro real dos relatórios.'
                : emReposicao
                  ? 'O que comprar e quando: consumo médio real × prazo de chegada (importado ≈ 90 dias), não estoque mínimo.'
                  : emNecessidade
                    ? 'O que falta de material para atender os pedidos já vendidos (carteira) e até quando comprar.'
                    : 'Insumos e peças para estoque — não equipamento de venda. Exige aprovação do Chefe de Logística.'}</p>
        </div>
        <div className="page-head__r">
          {aba === 'pedidos' && <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>Novo pedido</Button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant={emEstoque ? 'primary' : 'ghost'} onClick={() => setAba('estoque')}>Estoque</Button>
        <Button variant={emEstrutura ? 'primary' : 'ghost'} onClick={() => setAba('estrutura')}>Estrutura</Button>
        <Button variant={emCustos ? 'primary' : 'ghost'} onClick={() => setAba('custos')}>Custos</Button>
        <Button variant={emReposicao ? 'primary' : 'ghost'} onClick={() => setAba('reposicao')}>Reposição</Button>
        <Button variant={emNecessidade ? 'primary' : 'ghost'} onClick={() => setAba('necessidade')}>Necessidade</Button>
        <Button variant={aba === 'pedidos' ? 'primary' : 'ghost'} onClick={() => setAba('pedidos')}>Pedidos de compra</Button>
      </div>
    </>
  );

  if (emEstoque) return <div className="page fade-in">{cabecalho}<AlmoxarifadoEstoque/></div>;
  if (emEstrutura) return <div className="page fade-in">{cabecalho}<AlmoxarifadoEstrutura/></div>;
  if (emCustos) return <div className="page fade-in">{cabecalho}<AlmoxarifadoCustos/></div>;
  if (emReposicao) return <div className="page fade-in">{cabecalho}<AlmoxarifadoReposicao/></div>;
  if (emNecessidade) return <div className="page fade-in">{cabecalho}<AlmoxarifadoNecessidade/></div>;

  return (
    <div className="page fade-in">
      {cabecalho}

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <KPI label="Aguardando Logística" value={pendentes.length} sub="decisão pendente" delta="—" deltaDir="up" icon="clock"/>
        <KPI label="Aprovados, aguardando compra" value={aprovados.length} sub="liberados" delta="—" deltaDir="up" icon="check"/>
        <KPI label="Total de pedidos" value={pedidos.length} sub="histórico" delta="—" deltaDir="up" icon="package"/>
      </div>

      <Card title="Pedidos" sub={`${pedidos.length} no total`}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Nº</th><th>Item</th><th>Qtd</th><th className="text-right">Valor est.</th><th>Urgência</th><th>Solicitante</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {pedidos.length === 0 && (
                <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum pedido ainda.</td></tr>
              )}
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.numero_documento}</td>
                  <td>{p.item}</td>
                  <td>{p.quantidade} {p.unidade || ''}</td>
                  <td className="cell-money">{fmtBRL(p.valor_estimado)}</td>
                  <td><StatusBadge status={AV_URGENCIA_LABEL[p.urgencia] || p.urgencia}/></td>
                  <td className="small muted">{p.solicitante_nome || '—'}</td>
                  <td>
                    <StatusBadge status={AV_STATUS_LABEL[p.status] || p.status}/>
                    {p.status === 'reprovado' && p.motivo && <div className="small muted" style={{ marginTop: 2 }}>{p.motivo}</div>}
                  </td>
                  <td>
                    {p.status === 'aprovado' && <Button variant="primary" size="sm" disabled={busy === p.id} onClick={() => comprar(p)}>{busy === p.id ? '…' : 'Marcar comprado'}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && <AVModalNovoPedido onClose={() => setModalOpen(false)} onSaved={reload}/>}
    </div>
  );
}

window.AlmoxarifadoPage = AlmoxarifadoPage;
