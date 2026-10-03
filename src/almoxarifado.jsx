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
function AlmoxarifadoEstoque() {
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [familia, setFamilia] = React.useState('todas');

  const [sincronizando, setSincronizando] = React.useState(false);
  const [ultimaSync, setUltimaSync] = React.useState(null);
  const [podeEscrever, setPodeEscrever] = React.useState(false);
  const [podeContar, setPodeContar] = React.useState(false);     // registra o estoque físico (contagem real)
  const [podeVerCusto, setPodeVerCusto] = React.useState(null); // null = ainda verificando
  const [modalReq, setModalReq] = React.useState(null);
  const [modalMov, setModalMov] = React.useState(null);
  const [modalEd, setModalEd] = React.useState(null);
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
    c.from('pcp_produtos')
      .select('codigo, descricao, unidade, familia, estoque_minimo, leadtime_dias, endereco, observacao_interna, pcp_estoque(quantidade), pcp_estoque_fisico(quantidade, contado_em, contado_por)' + (podeVerCusto ? ', preco_custo, custo_manual' : ''))
      .eq('ativo', true).order('familia').order('codigo')
      .then(({ data, error }) => {
        if (error) { setErro(error.message); setLinhas([]); return; }
        setLinhas((data || []).map((p) => {
          const f = Array.isArray(p.pcp_estoque_fisico) ? p.pcp_estoque_fisico[0] : p.pcp_estoque_fisico;   // 1:1, mas tolera as duas formas
          return {
            ...p,
            saldo: (p.pcp_estoque || []).reduce((s, e) => s + Number(e.quantidade || 0), 0),
            temSaldo: (p.pcp_estoque || []).length > 0,
            fisico: f ? Number(f.quantidade) : null,
            fisicoEm: f ? f.contado_em : null,
            fisicoPor: f ? f.contado_por : null,
          };
        }));
      });
    c.from('pcp_sync_log').select('finalizado_em').eq('ok', true).order('finalizado_em', { ascending: false }).limit(1)
      .then(({ data }) => setUltimaSync((data && data[0] && data[0].finalizado_em) || null));
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
    await c.from('pcp_estoque_contagens').insert({
      codigo: l.codigo, quantidade_fisica: q, quantidade_omie: l.saldo, diferenca: q - l.saldo, contado_por: quem, contado_em: agora,
    });
    window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Registrou estoque físico', alvo: `${l.codigo}: físico ${q} × Omie ${l.saldo}` });
    carregar();
  };

  const sincronizar = async () => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    setSincronizando(true);
    try {
      const { data, error } = await c.functions.invoke('sync-pcp-omie', { body: { escopo: 'tudo' } });
      if (error) throw error;
      if (data && data.ok === false) throw new Error((data.erros || []).slice(0, 2).join(' · ') || 'falha parcial');
      window.toast?.('Sincronizado com o Omie.', 'success');
      carregar();
    } catch (e) {
      window.toast?.('Erro ao sincronizar: ' + (e.message || e), 'error');
    } finally { setSincronizando(false); }
  };

  if (linhas === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const familias = Array.from(new Set(linhas.map((l) => l.familia).filter(Boolean)));
  const q = busca.trim().toLowerCase();
  const visiveis = linhas.filter((l) =>
    (familia === 'todas' || l.familia === familia) &&
    (!q || l.codigo.toLowerCase().includes(q) || (l.descricao || '').toLowerCase().includes(q)));

  return (
    <>
      {erro && <div className="card" style={{ padding: 12, color: 'var(--vp-danger)', marginBottom: 12 }}>Erro: {erro}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <select className="input" style={{ maxWidth: 260 }} value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="todas">Todas as famílias</option>
          {familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{visiveis.length} produto(s)</span>
        <span style={{ flex: 1 }}/>
        <span className="muted" style={{ fontSize: 12 }}>{ultimaSync ? 'Sincronizado com o Omie em ' + new Date(ultimaSync).toLocaleString('pt-BR') : 'Ainda não sincronizado'}</span>
        <Button variant="primary" disabled={sincronizando} onClick={sincronizar}>{sincronizando ? 'Sincronizando…' : 'Sincronizar com Omie'}</Button>
      </div>
      <Card title="Estoque do PCP" sub="Espelho do cadastro do Omie">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead>
              <tr>
                <th>Código</th><th>Descrição</th><th>Família</th><th>Un.</th>
                <th className="text-right" title="Saldo do sistema (Omie)">Estoque Omie</th>
                <th className="text-right" title="Contagem real na prateleira">Estoque Físico</th>
                <th className="text-right" title="Físico − Omie">Diferença</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right" title={podeVerCusto ? '' : 'Sem permissão para ver custos'}>Custo (R$)</th>
                <th>Endereço</th>
                <th className="text-right">Lead time (d)</th>
                {podeEscrever && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum produto.</td></tr>}
              {visiveis.map((l) => {
                const abaixo = l.temSaldo && l.estoque_minimo != null && l.saldo < Number(l.estoque_minimo);
                return (
                  <tr key={l.codigo}>
                    <td className="mono">{l.codigo}</td>
                    <td>{l.descricao}</td>
                    <td className="small muted">{l.familia || '—'}</td>
                    <td>{l.unidade || '—'}</td>
                    <td className="text-right" style={{ color: abaixo ? 'var(--vp-danger)' : undefined, fontWeight: abaixo ? 700 : undefined }}>{l.temSaldo ? almFmt(l.saldo, 2) : '—'}</td>
                    <td className="text-right" title={l.fisicoEm ? `Contado em ${new Date(l.fisicoEm).toLocaleString('pt-BR')}${l.fisicoPor ? ' por ' + l.fisicoPor : ''}` : 'Ainda não contado'}>
                      {podeContar
                        ? <input className="input" type="number" min="0" step="any" placeholder="—" key={l.codigo + '-' + (l.fisico ?? '') + '-' + (l.fisicoEm || '')}
                            defaultValue={l.fisico ?? ''} style={{ width: 90, textAlign: 'right' }} onBlur={(e) => contar(l, e.target.value)}/>
                        : (l.fisico != null ? almFmt(l.fisico, 2) : '—')}
                    </td>
                    {(() => {
                      if (l.fisico == null) return <td className="text-right" style={{ color: 'var(--fg3)' }}>—</td>;
                      const dif = l.fisico - l.saldo;
                      return <td className="text-right" style={Math.abs(dif) > 1e-9 ? { color: 'var(--vp-danger)', fontWeight: 600 } : { color: 'var(--fg3)' }}
                        title={Math.abs(dif) > 1e-9 ? 'O estoque físico não bate com o Omie' : 'Bate com o Omie'}>{Math.abs(dif) > 1e-9 ? (dif > 0 ? '+' : '') + almFmt(dif, 2) : 'ok'}</td>;
                    })()}
                    <td className="text-right">{almFmt(l.estoque_minimo)}</td>
                    <td className="text-right" title={podeVerCusto ? '' : 'Sem permissão para ver custos'}
                      style={podeVerCusto ? undefined : { filter: 'blur(6px)', userSelect: 'none' }}>
                      {podeVerCusto ? (Number(l.preco_custo) > 0 ? almFmt(l.preco_custo, 2) : (Number(l.custo_manual) > 0 ? <span title="Custo manual (estimado): o Omie ainda não tem custo deste item">{almFmt(l.custo_manual, 2)} ⓜ</span> : almFmt(l.preco_custo, 2))) : '00,00'}
                    </td>
                    <td>{l.endereco || '—'}</td>
                    <td className="text-right">{almFmt(l.leadtime_dias)}</td>
                    {podeEscrever && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Button variant="ghost" size="sm" onClick={() => setModalReq(l)}>Requisitar</Button>{' '}
                        <Button variant="ghost" size="sm" onClick={() => setModalMov(l)}>Movimentar</Button>{' '}
                        <Button variant="ghost" size="sm" onClick={() => setModalEd(l)}>Editar</Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {modalReq && <AlmModalRequisicao prod={modalReq} onClose={() => setModalReq(null)} onDone={carregar}/>}
      {modalMov && <AlmModalMovimento prod={modalMov} onClose={() => setModalMov(null)} onDone={carregar}/>}
      {modalEd && <AlmModalEditarProduto prod={modalEd} onClose={() => setModalEd(null)} onDone={carregar}/>}
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
  const [aba, setAba] = React.useState('estoque');
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
  if (aba === 'pedidos' && pedidos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const lista = pedidos || [];
  const pendentes = lista.filter((p) => p.status === 'pendente');
  const aprovados = lista.filter((p) => p.status === 'aprovado');

  const cabecalho = (
    <>
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística · Almoxarifado</div>
          <h1 className="page-head__title">{emEstoque ? 'Estoque' : emEstrutura ? 'Estrutura dos produtos' : emCustos ? 'Custos' : 'Pedidos de Compra (Varejo)'}</h1>
          <p className="page-head__sub">{emEstoque
            ? 'Estoque do PCP — cabos de aço, cabos de manobra, corrimãos e componentes dos Quadros de Comando.'
            : emEstrutura
              ? 'Lista de materiais dos Quadros de Comando. Alterações são gravadas no Omie.'
              : emCustos
                ? 'Custo manual (estimado) dos itens que o Omie ainda não tem custo — necessário para o lucro real dos relatórios.'
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
        <Button variant={aba === 'pedidos' ? 'primary' : 'ghost'} onClick={() => setAba('pedidos')}>Pedidos de compra</Button>
      </div>
    </>
  );

  if (emEstoque) return <div className="page fade-in">{cabecalho}<AlmoxarifadoEstoque/></div>;
  if (emEstrutura) return <div className="page fade-in">{cabecalho}<AlmoxarifadoEstrutura/></div>;
  if (emCustos) return <div className="page fade-in">{cabecalho}<AlmoxarifadoCustos/></div>;

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
