/* ============================================================
   importacao-varejo.jsx — Importação Varejo
   Estoque Omie CACHEADO (4x/dia, sync-importacao-varejo-estoque) +
   Curva ABC-D + Sugestão de Compra pra produtos importados vendidos
   avulsos ("varejo"). Pedido do usuário (29/09/2026) — porta a lógica do
   Estoque Omie (repo verticalpartsIA/003_requisicoes) adaptada: escopo =
   produtos com origem_mercadoria='1' (fiscal, confirmado ao vivo que
   bate em VPER/VPMP/VPB), giro/Curva calculado desde 01/01/2024 (não
   janela móvel). Estoque começou "ao vivo" (consulta direta ao Omie a
   cada load) e foi trocado pra cache 4x/dia em 30/09/2026 — pedido
   explícito do usuário depois de sentir a tela lenta ("não seria legal
   se isso morasse no Supabase e lá dentro atualizasse tipo 4 vezes por
   dia?"); ver list-importacao-varejo/sync-importacao-varejo-estoque.
   Rota/menu continuam com o id interno `compras` (não trocar — ver
   alçadas em colaboradores-admin-store.js).
   ============================================================ */

function ivFmtNum(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
function ivFmtMoeda(v) {
  return (v == null || isNaN(v)) ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ivFmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function ivFmtDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

const IV_CURVA_STYLE = {
  A: { background: 'var(--vp-green-50, #ecfdf5)', color: 'var(--vp-green-700, #047857)' },
  B: { background: 'var(--vp-blue-50, #eff6ff)', color: 'var(--vp-blue-700, #1d4ed8)' },
  C: { background: 'var(--vp-amber-50, #fffbeb)', color: 'var(--vp-amber-700, #b45309)' },
  D: { background: 'var(--vp-gray-100, #f3f4f6)', color: 'var(--fg3, #6b7280)' },
};
function IVCurvaBadge({ curva }) {
  return (
    <span style={{ ...IV_CURVA_STYLE[curva] || IV_CURVA_STYLE.D, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 800 }}>
      {curva}
    </span>
  );
}

function ivStatusDoItem(item) {
  if (item.sugestaoCompra > 0) return 'vermelha';
  if (item.estoqueDisponivel <= item.estoqueMinimo) return 'amarela';
  return 'branca';
}
const IV_LINHA_STYLE = {
  vermelha: { background: 'var(--vp-red-100, #fecaca)' },
  amarela: { background: 'var(--vp-yellow-100, #fef08a)' },
  branca: {},
};

/* ---------- Modal: revisar lote (múltiplo/lote mínimo) ---------- */
function IVModalLote({ item, onClose, onSaved }) {
  const [multiplo, setMultiplo] = React.useState(item.multiploCompra != null ? String(item.multiploCompra) : '');
  const [loteMinimo, setLoteMinimo] = React.useState(item.loteMinimo != null ? String(item.loteMinimo) : '');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    setSaving(true);
    try {
      await window.ImportacaoVarejoStore.salvarLoteConfig({ codigo: item.codigo, multiploCompra: multiplo, loteMinimo });
      window.toast?.('Lote atualizado.', 'success');
      onSaved();
    } catch (e) { window.toast?.('Erro ao salvar lote: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Lote de compra — ${item.codigo}`} onClose={onClose} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar lote'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{item.descricao}</div>
        <div>
          <label className="up-eyebrow muted">Múltiplo de compra</label>
          <input className="input" type="number" min="0" step="1" value={multiplo} onChange={(e) => setMultiplo(e.target.value)} placeholder="ex.: 700 (bobina)" />
        </div>
        <div>
          <label className="up-eyebrow muted">Lote mínimo</label>
          <input className="input" type="number" min="0" step="1" value={loteMinimo} onChange={(e) => setLoteMinimo(e.target.value)} placeholder="ex.: 700" />
        </div>
        <p className="small muted">Necessidade calculada agora: <b>{ivFmtNum(item.sugestaoBruta)}</b> {item.unidade || ''}. Deixe em branco pra não aplicar lote (sugestão sai arredondada pra cima, sem ajuste).</p>
      </div>
    </Modal>
  );
}

/* ---------- Modal: lançar "Comprado" ---------- */
function IVModalComprado({ item, onClose, onSaved }) {
  const [quantidade, setQuantidade] = React.useState('');
  const [previsao, setPrevisao] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const lancar = async () => {
    setSaving(true);
    try {
      await window.ImportacaoVarejoStore.lancarComprado({ codigo: item.codigo, quantidade, previsaoChegada: previsao });
      window.toast?.('Comprado lançado.', 'success');
      onSaved();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };
  const excluir = async (id) => {
    if (!window.confirm('Excluir este lançamento?')) return;
    try { await window.ImportacaoVarejoStore.excluirComprado(id); onSaved(); }
    catch (e) { window.toast?.('Erro ao excluir: ' + e.message, 'error'); }
  };
  return (
    <Modal title={`Comprado — ${item.codigo}`} onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" onClick={lancar} disabled={saving}>{saving ? 'Salvando…' : 'Lançar'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{item.descricao}</div>
        {item.pedidosComprado.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="small" style={{ fontWeight: 700 }}>Já lançado (aguardando previsão)</div>
            {item.pedidosComprado.map((p, i) => (
              <div key={i} className="row sb small" style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: '6px 10px' }}>
                <span>{ivFmtNum(p.quantidade)} — chega {ivFmtData(p.previsao)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid-2" style={{ gap: 10 }}>
          <div>
            <label className="up-eyebrow muted">Quantidade</label>
            <input className="input" type="number" min="0" step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <label className="up-eyebrow muted">Previsão de chegada</label>
            <input className="input" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Modal: enviar requisição em massa pro Omie ---------- */
function IVModalEnviarOmie({ itens, onClose, onEnviado }) {
  const [enviando, setEnviando] = React.useState(false);
  const itensParaEnviar = itens.filter((i) => i.sugestaoCompra > 0);
  const itensIgnorados = itens.filter((i) => i.sugestaoCompra <= 0);
  const enviar = async () => {
    setEnviando(true);
    try {
      const resultado = await window.ImportacaoVarejoStore.enviarRequisicaoOmie(
        itensParaEnviar.map((i) => ({ codigo: i.codigo, descricao: i.descricao, quantidade: i.sugestaoCompra })),
      );
      if (resultado.itensComErro && resultado.itensComErro.length) {
        window.toast?.(`Requisição ${resultado.codReqCompra} criada com ${resultado.quantidadeItens} itens. ${resultado.itensComErro.length} não puderam ser incluídos.`, 'warning');
      } else {
        window.toast?.(`Requisição de compra ${resultado.codReqCompra} criada no Omie com ${resultado.quantidadeItens} itens.`, 'success');
      }
      onEnviado();
    } catch (e) { window.toast?.('Erro ao criar requisição no Omie: ' + e.message, 'error'); }
    finally { setEnviando(false); }
  };
  return (
    <Modal title="Enviar requisição de compra em massa" onClose={onClose} width={640}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
        <Button variant="primary" icon="send" onClick={enviar} disabled={enviando || itensParaEnviar.length === 0}>
          {enviando ? 'Enviando…' : 'Confirmar e enviar ao Omie'}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small">Será criada 1 Requisição de Compra no Omie ("Compras de Mercadorias para Revenda Importada") com {itensParaEnviar.length} {itensParaEnviar.length === 1 ? 'item' : 'itens'}, usando a Sugestão de Compra de cada produto.</p>
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd.</th></tr></thead>
            <tbody>
              {itensParaEnviar.map((i) => (
                <tr key={i.codigo}><td className="mono">{i.codigo}</td><td>{i.descricao}</td><td className="text-right">{i.sugestaoCompra}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {itensIgnorados.length > 0 && (
          <p className="small muted">{itensIgnorados.length} item(ns) selecionado(s) sem sugestão de compra (zerada) foram ignorados: {itensIgnorados.map((i) => i.codigo).join(', ')}</p>
        )}
      </div>
    </Modal>
  );
}

function ImportacaoVarejoPage({ setRoute }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState(null);
  const [aviso, setAviso] = React.useState(null);
  const [lastEstoqueSyncAt, setLastEstoqueSyncAt] = React.useState(null);
  const [lastGiroSyncAt, setLastGiroSyncAt] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [corFiltro, setCorFiltro] = React.useState('todas');
  const [curvaFiltro, setCurvaFiltro] = React.useState('todas');
  const [selecionados, setSelecionados] = React.useState(() => new Set());
  const [modalLote, setModalLote] = React.useState(null);
  const [modalComprado, setModalComprado] = React.useState(null);
  const [modalEnviar, setModalEnviar] = React.useState(false);
  const [podeGerenciar, setPodeGerenciar] = React.useState(false);
  const [sincronizando, setSincronizando] = React.useState(false);

  React.useEffect(() => {
    window.PropostaStore?.temCapacidade?.('compras', 'criar').then(setPodeGerenciar).catch(() => setPodeGerenciar(false));
  }, []);

  const carregar = React.useCallback(() => {
    setLoading(true); setErro(null);
    window.ImportacaoVarejoStore.carregar()
      .then((data) => {
        setItems(data.items || []);
        setLastEstoqueSyncAt(data.lastEstoqueSyncAt || null);
        setLastGiroSyncAt(data.lastGiroSyncAt || null);
        setAviso(data.aviso || null);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((i) => {
      const combinaTexto = !q || i.codigo.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q);
      const combinaCor = corFiltro === 'todas' || ivStatusDoItem(i) === corFiltro;
      const combinaCurva = curvaFiltro === 'todas' || i.curva === curvaFiltro;
      return combinaTexto && combinaCor && combinaCurva;
    });
  }, [items, busca, corFiltro, curvaFiltro]);

  const totais = React.useMemo(() => filtrados.reduce((acc, i) => ({
    estoqueFisico: acc.estoqueFisico + i.estoqueFisico,
    estoqueDisponivel: acc.estoqueDisponivel + i.estoqueDisponivel,
    sugestaoCompra: acc.sugestaoCompra + i.sugestaoCompra,
    comprado: acc.comprado + i.comprado,
  }), { estoqueFisico: 0, estoqueDisponivel: 0, sugestaoCompra: 0, comprado: 0 }), [filtrados]);

  const forcarSync = async () => {
    setSincronizando(true);
    try {
      await window.ImportacaoVarejoStore.dispararSyncManual();
      window.toast?.('Sincronização de catálogo/giro disparada — pode levar alguns minutos pra terminar (roda em segundo plano).', 'success');
    } catch (e) { window.toast?.('Erro ao disparar sincronização: ' + e.message, 'error'); }
    finally { setSincronizando(false); }
  };

  const [sincronizandoEstoque, setSincronizandoEstoque] = React.useState(false);
  const forcarSyncEstoque = async () => {
    setSincronizandoEstoque(true);
    try {
      await window.ImportacaoVarejoStore.dispararSyncEstoqueManual();
      window.toast?.('Estoque sincronizado com o Omie agora.', 'success');
      carregar();
    } catch (e) { window.toast?.('Erro ao sincronizar estoque: ' + e.message, 'error'); }
    finally { setSincronizandoEstoque(false); }
  };

  const toggleSelecionado = (codigo) => setSelecionados((prev) => {
    const next = new Set(prev);
    if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
    return next;
  });
  const itensSelecionados = items.filter((i) => selecionados.has(i.codigo));
  const todosFiltradosSelecionados = filtrados.length > 0 && filtrados.every((i) => selecionados.has(i.codigo));
  const algunsFiltradosSelecionados = !todosFiltradosSelecionados && filtrados.some((i) => selecionados.has(i.codigo));
  const toggleSelecionarTodosFiltrados = () => setSelecionados((prev) => {
    const next = new Set(prev);
    if (todosFiltradosSelecionados) {
      filtrados.forEach((i) => next.delete(i.codigo));
    } else {
      filtrados.forEach((i) => next.add(i.codigo));
    }
    return next;
  });

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando Importação Varejo…</div>;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Logística · Importação Varejo</div>
          <h1 className="page-head__title">Importação Varejo</h1>
          <p className="page-head__sub">Estoque (sincronizado 4x/dia), giro de vendas (desde 01/01/2024) e Sugestão de Compra dos produtos importados vendidos avulsos.</p>
        </div>
        <div className="page-head__r">
          {podeGerenciar && (
            <Button variant="outline" icon="refresh" onClick={forcarSyncEstoque} disabled={sincronizandoEstoque} data-tip="Consulta o estoque no Omie agora, sem esperar a próxima janela de sincronização (4x/dia)">
              {sincronizandoEstoque ? 'Sincronizando…' : 'Sincronizar estoque agora'}
            </Button>
          )}
          {podeGerenciar && (
            <Button variant="outline" icon="refresh" onClick={forcarSync} disabled={sincronizando}>
              {sincronizando ? 'Disparando…' : 'Forçar sincronização de catálogo/giro'}
            </Button>
          )}
          <Button variant="outline" icon="refresh" onClick={carregar} disabled={loading}>Atualizar</Button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="small muted">Estoque sincronizado em: <b>{ivFmtDataHora(lastEstoqueSyncAt)}</b></span>
        <span className="small muted">Giro/Curva calculados em: <b>{ivFmtDataHora(lastGiroSyncAt)}</b></span>
      </div>

      {erro && (
        <div className="alert danger" style={{ marginBottom: 16 }}>
          <Icon.warning />
          <div><div className="alert__title">Erro ao consultar</div><div className="alert__sub">{erro}</div></div>
        </div>
      )}
      {aviso && !erro && (
        <div className="alert warning" style={{ marginBottom: 16 }}>
          <Icon.warning />
          <div><div className="alert__title">Catálogo vazio</div><div className="alert__sub">{aviso}</div></div>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI
          label="Precisa comprar"
          value={filtrados.filter((i) => ivStatusDoItem(i) === 'vermelha').length}
          sub={corFiltro === 'vermelha' ? 'filtrando — clique pra limpar' : 'linhas vermelhas'}
          icon="warning"
          onClick={() => setCorFiltro(corFiltro === 'vermelha' ? 'todas' : 'vermelha')}
          style={corFiltro === 'vermelha' ? { boxShadow: '0 0 0 2px var(--vp-danger)' } : undefined}
        />
        <KPI
          label="Alerta (no mínimo)"
          value={filtrados.filter((i) => ivStatusDoItem(i) === 'amarela').length}
          sub={corFiltro === 'amarela' ? 'filtrando — clique pra limpar' : 'linhas amarelas'}
          icon="clock"
          onClick={() => setCorFiltro(corFiltro === 'amarela' ? 'todas' : 'amarela')}
          style={corFiltro === 'amarela' ? { boxShadow: '0 0 0 2px var(--vp-yellow)' } : undefined}
        />
        <KPI label="Sugestão total" value={ivFmtNum(totais.sugestaoCompra)} sub="unidades" icon="package" />
        <KPI label="Curva D com estoque parado" value={filtrados.filter((i) => i.conselho).length} sub="considere pausar compra" icon="fileSearch" />
      </div>

      <div className="tbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="seg">
          {['todas', 'vermelha', 'amarela', 'branca'].map((v) => (
            <button key={v} className={corFiltro === v ? 'is-active' : ''} onClick={() => setCorFiltro(v)}>
              {v === 'todas' ? 'Todas' : v === 'vermelha' ? 'Precisa comprar' : v === 'amarela' ? 'Alerta' : 'Ok'}
            </button>
          ))}
        </div>
        <div className="seg">
          {['todas', 'A', 'B', 'C', 'D'].map((v) => (
            <button key={v} className={curvaFiltro === v ? 'is-active' : ''} onClick={() => setCurvaFiltro(v)}>{v === 'todas' ? 'Curva' : v}</button>
          ))}
        </div>
        <div className="spacer" />
        <span className="small muted">{filtrados.length} de {items.length} produtos</span>
        {podeGerenciar && selecionados.size > 0 && (
          <Button variant="primary" size="sm" icon="send" onClick={() => setModalEnviar(true)}>
            Enviar {selecionados.size} ao Omie
          </Button>
        )}
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            {podeGerenciar && (
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={todosFiltradosSelecionados}
                  ref={(el) => { if (el) el.indeterminate = algunsFiltradosSelecionados; }}
                  onChange={toggleSelecionarTodosFiltrados}
                  disabled={filtrados.length === 0}
                  title="Selecionar todos os produtos filtrados"
                  data-tip="Selecionar todos os produtos filtrados, pra compra em massa"
                />
              </th>
            )}
            <th>Código</th>
            <th>Descrição</th>
            <th className="text-center">Curva</th>
            <th className="text-right">Físico</th>
            <th className="text-right">Reservado</th>
            <th className="text-right">Disponível</th>
            <th className="text-right">Mínimo</th>
            <th className="text-right">Pendente</th>
            <th className="text-right">Comprado</th>
            <th className="text-right">Sugestão</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum produto encontrado.</td></tr>
            )}
            {filtrados.map((item) => {
              const status = ivStatusDoItem(item);
              return (
                <React.Fragment key={item.codigo}>
                  <tr style={IV_LINHA_STYLE[status]}>
                    {podeGerenciar && (
                      <td><input type="checkbox" checked={selecionados.has(item.codigo)} onChange={() => toggleSelecionado(item.codigo)} /></td>
                    )}
                    <td className="mono small">{item.codigo}</td>
                    <td className="cell-main" title={item.descricao} style={{ maxWidth: 320 }}>{item.descricao}</td>
                    <td className="text-center"><IVCurvaBadge curva={item.curva} /></td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueFisico)}</td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueReservado)}</td>
                    <td className="text-right cell-num" style={{ fontWeight: 700 }}>{ivFmtNum(item.estoqueDisponivel)}</td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueMinimo)}</td>
                    <td className="text-right cell-num">{ivFmtNum(item.pendenteOmie)}</td>
                    <td className="text-right cell-num">
                      {item.comprado > 0 ? (
                        <button className="link-btn" onClick={() => setModalComprado(item)}>{ivFmtNum(item.comprado)}</button>
                      ) : podeGerenciar ? (
                        <button className="link-btn muted" onClick={() => setModalComprado(item)}>lançar</button>
                      ) : '—'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 800 }}>
                      {ivFmtNum(item.sugestaoCompra)}
                      {podeGerenciar && (
                        <button className="link-btn" title="Revisar lote de compra" onClick={() => setModalLote(item)} style={{ marginLeft: 6 }}>
                          <Icon.ruler size={13} />
                        </button>
                      )}
                    </td>
                    <td>{item.semRegistroEstoque && <Badge variant="neutral" title="Sem registro de estoque no Omie">sem estoque</Badge>}</td>
                  </tr>
                  {item.conselho && (
                    <tr>
                      <td colSpan={99} style={{ padding: '4px 12px 10px', background: 'var(--vp-gray-50)' }}>
                        <span className="small" style={{ color: 'var(--fg3)' }}><Icon.fileSearch size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{item.conselho}</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={podeGerenciar ? 4 : 3}>Total</td>
                <td className="text-right">{ivFmtNum(totais.estoqueFisico)}</td>
                <td></td>
                <td className="text-right">{ivFmtNum(totais.estoqueDisponivel)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{ivFmtNum(totais.comprado)}</td>
                <td className="text-right">{ivFmtNum(totais.sugestaoCompra)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {modalLote && <IVModalLote item={modalLote} onClose={() => setModalLote(null)} onSaved={() => { setModalLote(null); carregar(); }} />}
      {modalComprado && <IVModalComprado item={modalComprado} onClose={() => setModalComprado(null)} onSaved={() => { setModalComprado(null); carregar(); }} />}
      {modalEnviar && <IVModalEnviarOmie itens={itensSelecionados} onClose={() => setModalEnviar(false)} onEnviado={() => { setModalEnviar(false); setSelecionados(new Set()); carregar(); }} />}
    </div>
  );
}

Object.assign(window, { ImportacaoVarejoPage });
