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
  if (item.precisaRevisao) return 'amarela';   // venda esporádica aguardando o comprador
  // Com sugestão de estoque calculada: amarelo = a posição está a menos de 25% acima do mínimo sugerido (vai precisar comprar logo).
  if (item.estMaxSug != null) return item.estMaxSug > 0 && item.posicaoEstoque <= item.estMinSug * 1.25 ? 'amarela' : 'branca';
  if (item.estoqueDisponivel <= item.estoqueMinimo) return 'amarela';
  return 'branca';
}

const IV_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function ivRotuloMes(iso, comAno) {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 10).split('-').map(Number);
  return IV_MESES[m - 1] + (comAno ? '/' + String(y).slice(2) : '');
}
// mês i da série (0 = o mais antigo) a partir do mês inicial
function ivMesDaSerie(inicioIso, i) {
  const [y, m] = String(inicioIso).slice(0, 10).split('-').map(Number);
  const d = new Date(y, m - 1 + i, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
}
const IV_TEND = {
  alta:      { seta: '▲', cor: 'var(--vp-green-700, #047857)', rotulo: 'em alta' },
  baixa:     { seta: '▼', cor: 'var(--vp-danger, #b91c1c)',    rotulo: 'em baixa' },
  estavel:   { seta: '►', cor: 'var(--fg3, #6b7280)',          rotulo: 'estável' },
  nova:      { seta: '▲', cor: 'var(--vp-info, #1d4ed8)',      rotulo: 'voltou a vender' },
  sem_venda: { seta: '—', cor: 'var(--fg3, #6b7280)',          rotulo: 'sem venda' },
};
/* Gráfico de linha dos últimos 12 meses de venda (unidades): ponto verde = mês de maior venda, vermelho = mês de menor venda. */
function IVSparkline({ serie, inicio, cor, pico, vale, rup }) {
  if (!serie || serie.length < 2) return null;
  const W = 92, H = 26, P = 3;
  const max = Math.max(...serie, 1);
  const x = (i) => P + (i * (W - 2 * P)) / (serie.length - 1);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const pts = serie.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const idx = (iso) => { for (let i = 0; i < serie.length; i++) if (ivMesDaSerie(inicio, i) === String(iso).slice(0, 10)) return i; return -1; };
  const ip = pico ? idx(pico) : -1, iv = vale ? idx(vale) : -1;
  const rupOk = Array.isArray(rup) && rup.length === serie.length;
  const dica = serie.map((v, i) => ivRotuloMes(ivMesDaSerie(inicio, i), true) + ': ' + ivFmtNum(v) + (rupOk && rup[i] >= 0.3 ? '  ⚠ sem estoque em ' + Math.round(rup[i] * 100) + '% dos dias' : '')).join('\n');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vendas dos últimos 12 meses" style={{ display: 'block' }}>
      <title>{dica}</title>
      {rupOk && serie.map((v, i) => rup[i] >= 0.3 && <rect key={i} x={x(i) - 3} y={H - 3} width="6" height="3" rx="1" fill="var(--vp-amber-700, #b45309)" />)}
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {ip >= 0 && <circle cx={x(ip)} cy={y(serie[ip])} r="2.6" fill="var(--vp-green-700, #047857)" />}
      {iv >= 0 && iv !== ip && <circle cx={x(iv)} cy={y(serie[iv])} r="2.6" fill="var(--vp-danger, #b91c1c)" />}
    </svg>
  );
}
/* Célula de texto/número editável direto na tabela: grava ao sair do campo ou com Enter; Esc desfaz.
   Sem permissão de gerenciar, mostra só o valor. */
function IVCelulaEditavel({ valor, tipo, placeholder, podeEditar, onSave, largura, alinhar }) {
  const [txt, setTxt] = React.useState(valor == null ? '' : String(valor));
  const [salvando, setSalvando] = React.useState(false);
  React.useEffect(() => { setTxt(valor == null ? '' : String(valor)); }, [valor]);
  if (!podeEditar) return <span>{valor == null || valor === '' ? '—' : valor}</span>;
  const confirmar = async () => {
    const novo = txt.trim();
    if (novo === (valor == null ? '' : String(valor))) return;
    setSalvando(true);
    try { await onSave(novo); }
    catch (e) { window.toast?.('Erro ao salvar: ' + (e.message || e), 'error'); setTxt(valor == null ? '' : String(valor)); }
    finally { setSalvando(false); }
  };
  return (
    <input
      className="input"
      type={tipo === 'numero' ? 'number' : 'text'}
      min={tipo === 'numero' ? '0' : undefined}
      step={tipo === 'numero' ? 'any' : undefined}
      value={txt}
      placeholder={placeholder}
      disabled={salvando}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setTxt(valor == null ? '' : String(valor)); e.currentTarget.blur(); }
      }}
      style={{ width: largura || 80, height: 28, padding: '2px 6px', fontSize: 12, textAlign: alinhar || 'left' }}
    />
  );
}

const IV_LINHA_STYLE = {
  vermelha: { background: 'var(--vp-danger-tint)' },
  amarela: { background: 'var(--vp-warning-tint)' },
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

/* ---------- Modal: o que está por chegar (P.I. + embarque, descontadas as notas de importação já lançadas) ---------- */
const IV_ESTAGIO_ROTULO = {
  a_caminho: 'A caminho (embarcado)',
  chegou_sem_nota: 'Chegou — falta lançar a nota no Omie',
  comprado_pi: 'Comprado — P.I. ainda não embarcou',
};
/* Filtros de mercadoria por chegar. "Comprado" = pedido sem embarque (lançamento do comprador ou P.I. ainda não embarcada). */
function ivCombinaCaminho(i, filtro) {
  if (filtro === 'tudo') return i.caminhoTotal > 0;
  // compradoEf = "Comprado" já abatido pelo que a P.I. cobre (o pedido que virou P.I. embarcada não é mais "sem embarque")
  if (filtro === 'comprado') return ((i.compradoEf != null ? i.compradoEf : i.comprado) > 0) || (i.compradoPi > 0);
  if (filtro === 'caminho') return i.aCaminho > 0;
  if (filtro === 'semnota') return i.chegouSemNota > 0;
  return true;
}
function ivFmtDataIso(s) {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}
function IVModalACaminho({ item, onClose }) {
  const linhas = item.caminhoDetalhe || [];
  return (
    <Modal title={`A caminho — ${item.codigo}`} onClose={onClose} width={680}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="small muted" style={{ marginBottom: 8 }}>
        Quantidade das P.I. deste produto que <b>ainda não virou nota de importação</b> no Omie. O status do embarque é preenchido à mão
        na Gestão de Importação; a nota no Omie é quem confirma que a mercadoria chegou.
      </div>
      <table className="t">
        <thead><tr>
          <th>P.I.</th><th>Fornecedor</th><th>Embarque</th><th>Situação</th><th>ETA</th><th className="text-right">Qtd.</th>
        </tr></thead>
        <tbody>
          {linhas.map((l, idx) => (
            <tr key={idx}>
              <td>{l.pi}</td>
              <td>{l.fornecedor}</td>
              <td>{l.embarque || <span className="muted">sem embarque</span>}{l.status_embarque ? <div className="small muted">{l.status_embarque}</div> : null}</td>
              <td>{IV_ESTAGIO_ROTULO[l.estagio] || l.estagio}</td>
              <td>{ivFmtDataIso(l.eta)}</td>
              <td className="text-right cell-num">{ivFmtNum(l.quantidade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small muted" style={{ marginTop: 8 }}>
        Essas quantidades já entram na posição do estoque da sugestão de compra, para o sistema não pedir de novo o que está vindo.
        {item.compradoEf != null && item.comprado > item.compradoEf ? ` O "Comprado" lançado (${ivFmtNum(item.comprado)}) foi abatido pelo que a P.I. já cobre.` : ''}
      </div>
    </Modal>
  );
}

/* ---------- Modal: lançar "Comprado" ---------- */
function IVModalComprado({ item, onClose, onSaved }) {
  const [quantidade, setQuantidade] = React.useState('');
  const [previsao, setPrevisao] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [linhas, setLinhas] = React.useState(null); // null = carregando; linhas abertas (com id) deste produto
  const [mudou, setMudou] = React.useState(false);
  const carregarLinhas = React.useCallback(() => {
    window.ImportacaoVarejoStore.listarCompradoAberto(item.codigo).then(setLinhas)
      .catch((e) => { setLinhas([]); window.toast?.('Erro ao ler os lançamentos: ' + e.message, 'error'); });
  }, [item.codigo]);
  React.useEffect(() => { carregarLinhas(); }, [carregarLinhas]);
  // A lista atrás do modal só recarrega se algo mudou aqui (onSaved fecha o modal e recarrega).
  const fechar = () => (mudou ? onSaved() : onClose());
  const corrigirPrevisao = async (id, data) => {
    try { await window.ImportacaoVarejoStore.atualizarPrevisaoComprado(id, data); setMudou(true); carregarLinhas(); }
    catch (e) { window.toast?.('Erro ao corrigir a previsão: ' + e.message, 'error'); carregarLinhas(); }
  };
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
    try { await window.ImportacaoVarejoStore.excluirComprado(id); setMudou(true); carregarLinhas(); }
    catch (e) { window.toast?.('Erro ao excluir: ' + e.message, 'error'); }
  };
  return (
    <Modal title={`Comprado — ${item.codigo}`} onClose={fechar} width={440}
      footer={<>
        <Button variant="ghost" onClick={fechar}>Fechar</Button>
        <Button variant="primary" onClick={lancar} disabled={saving}>{saving ? 'Salvando…' : 'Lançar'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{item.descricao}</div>
        {linhas && linhas.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="small" style={{ fontWeight: 700 }}>Já lançado (aguardando previsão)</div>
            {linhas.map((l) => (
              <div key={l.id} className="row sb small" style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: '6px 10px', gap: 8, alignItems: 'center' }}>
                <span>{ivFmtNum(l.quantidade)}{l.requisicao_omie ? ` · REQ ${l.requisicao_omie}` : ''} — chega</span>
                <input className="input" type="date" style={{ width: 150 }} defaultValue={l.previsao_chegada}
                  onBlur={(e) => { if (e.target.value && e.target.value !== l.previsao_chegada) corrigirPrevisao(l.id, e.target.value); }} />
                <Button variant="ghost" onClick={() => excluir(l.id)}>Excluir</Button>
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
  // Fornecedor/preço sugeridos (vindos do cache de último Pedido de Compra
  // real, ver sync-importacao-varejo-fornecedor) pré-preenchem aqui, mas o
  // comprador pode confirmar/editar antes de enviar — pedido do usuário
  // ("o comprador selecionaria o fornecedor e já ajuda a fazer o pedido em
  // massa"). O preço editado aqui vai como `precoUnit` real na Requisição
  // (antes sempre 0); o fornecedor vira só texto na observação do item —
  // Requisição de Compra não tem campo de fornecedor no Omie (decisão
  // confirmada com o usuário).
  const [overrides, setOverrides] = React.useState(() => Object.fromEntries(
    itensParaEnviar.map((i) => [i.codigo, {
      fornecedor: i.ultimoFornecedorNome || '',
      preco: i.ultimoPrecoUnitario != null ? String(i.ultimoPrecoUnitario) : '',
    }]),
  ));
  const setOverride = (codigo, campo, valor) => setOverrides((prev) => ({ ...prev, [codigo]: { ...prev[codigo], [campo]: valor } }));

  const valorTotalEstimado = itensParaEnviar.reduce((acc, i) => {
    const preco = Number(overrides[i.codigo]?.preco) || 0;
    return acc + preco * i.sugestaoCompra;
  }, 0);

  const enviar = async () => {
    setEnviando(true);
    try {
      const resultado = await window.ImportacaoVarejoStore.enviarRequisicaoOmie(
        itensParaEnviar.map((i) => ({
          codigo: i.codigo,
          descricao: i.descricao,
          quantidade: i.sugestaoCompra,
          precoUnitario: Number(overrides[i.codigo]?.preco) || 0,
          fornecedorNome: (overrides[i.codigo]?.fornecedor || '').trim() || undefined,
        })),
      );
      if (resultado.itensComErro && resultado.itensComErro.length) {
        window.toast?.(`Requisição ${resultado.codReqCompra} criada com ${resultado.quantidadeItens} itens. ${resultado.itensComErro.length} não puderam ser incluídos.`, 'warning');
      } else {
        window.toast?.(`Requisição de compra ${resultado.codReqCompra} criada no Omie com ${resultado.quantidadeItens} itens.`, 'success');
      }
      if (resultado.avisoRegistro) window.toast?.('Atenção: a requisição foi criada no Omie, mas não consegui registrá-la em "Comprado" (' + resultado.avisoRegistro + '). NÃO envie de novo; lance o "Comprado" na linha para a sugestão abater.', 'warning');
      onEnviado();
    } catch (e) { window.toast?.('Erro ao criar requisição no Omie: ' + e.message, 'error'); }
    finally { setEnviando(false); }
  };
  return (
    <Modal title="Enviar requisição de compra em massa" onClose={onClose} width={760}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
        <Button variant="primary" icon="send" onClick={enviar} disabled={enviando || itensParaEnviar.length === 0}>
          {enviando ? 'Enviando…' : 'Confirmar e enviar ao Omie'}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small">Será criada 1 Requisição de Compra no Omie ("Compras de Mercadorias para Revenda Importada") com {itensParaEnviar.length} {itensParaEnviar.length === 1 ? 'item' : 'itens'}, usando a Sugestão de Compra de cada produto. Fornecedor/preço abaixo vêm do último Pedido de Compra real de cada produto (quando existe) — confirme ou edite antes de enviar.</p>
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd.</th><th>Fornecedor</th><th className="text-right">Preço Unit. (R$)</th></tr></thead>
            <tbody>
              {itensParaEnviar.map((i) => (
                <tr key={i.codigo}>
                  <td className="mono">{i.codigo}</td>
                  <td>{i.descricao}</td>
                  <td className="text-right">{i.sugestaoCompra}</td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 180 }}
                      value={overrides[i.codigo]?.fornecedor ?? ''}
                      onChange={(e) => setOverride(i.codigo, 'fornecedor', e.target.value)}
                      placeholder="sem histórico"
                    />
                  </td>
                  <td className="text-right">
                    <input
                      className="input text-right"
                      style={{ minWidth: 100 }}
                      type="number" min="0" step="0.01"
                      value={overrides[i.codigo]?.preco ?? ''}
                      onChange={(e) => setOverride(i.codigo, 'preco', e.target.value)}
                      placeholder="0,00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ textAlign: 'right', fontWeight: 700 }}>Valor total estimado: {ivFmtMoeda(valorTotalEstimado)}</p>
        {itensIgnorados.length > 0 && (
          <p className="small muted">{itensIgnorados.length} item(ns) selecionado(s) sem sugestão de compra (zerada) foram ignorados: {itensIgnorados.map((i) => i.codigo).join(', ')}</p>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Modal: revisão do comprador (mínimo/máximo) ---------- */
function IVModalRevisao({ item, onClose, onSaved }) {
  const [minimo, setMinimo] = React.useState(String(item.estMinSug != null ? item.estMinSug : ''));
  const [maximo, setMaximo] = React.useState(String(item.estMaxSug != null ? item.estMaxSug : ''));
  const [obs, setObs] = React.useState((item.revisao && item.revisao.observacao) || '');
  const [saving, setSaving] = React.useState(false);
  const executar = async (acao) => {
    setSaving(true);
    try {
      await window.ImportacaoVarejoStore.salvarRevisao({ item, acao, minimo, maximo, observacao: obs });
      window.toast?.({ aprovar: 'Sugestão aprovada.', ajustar: 'Mínimo e máximo ajustados.', descartar: 'Produto marcado para não repor.', desfazer: 'Revisão desfeita.' }[acao], 'success');
      onSaved();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  const origem = { calculado: 'calculado pelo sistema', aprovado: 'sugestão aprovada pelo comprador', manual: 'ajustado pelo comprador', descartado: 'marcado para não repor' }[item.estOrigem] || '';
  const revisadoPor = item.revisao && item.revisao.revisado_por ? ` · ${item.revisao.revisado_por}, ${ivFmtData(item.revisao.revisado_em)}` : '';
  return (
    <Modal title={`Revisão do comprador — ${item.codigo}`} onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Fechar</Button>
        {item.revisao && item.revisao.status !== 'pendente' && <Button variant="ghost" onClick={() => executar('desfazer')} disabled={saving}>Desfazer revisão</Button>}
        <Button variant="outline" onClick={() => executar('descartar')} disabled={saving}>Não repor</Button>
        <Button variant="outline" onClick={() => executar('aprovar')} disabled={saving || !(item.estMaxSugCalc > 0)}>Aprovar sugestão</Button>
        <Button variant="primary" onClick={() => executar('ajustar')} disabled={saving}>Salvar ajuste</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{item.descricao}</div>
        {item.estSerie && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IVSparkline serie={item.estSerie} inicio={item.estSerieInicio} cor={(IV_TEND[item.estTendencia] || IV_TEND.estavel).cor} pico={item.estMesPico} vale={item.estMesVale} />
            <div className="small">
              Vendeu em <b>{item.estMesesVenda} de 6</b> meses · demanda base <b>{ivFmtNum(item.estDemandaMensal)}</b>/mês · confiança <b>{item.estConfianca}</b>
              {item.estMesPico && <> · maior venda em {ivRotuloMes(item.estMesPico, true)}</>}
            </div>
          </div>
        )}
        <div className="small" style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: '8px 10px' }}>
          <b>Por quê:</b> {item.estMotivo || '—'}.<br />
          Prazo de reposição <b>{item.estPrazoDias} dias</b> ({{ historico_exterior: 'prazo real das P.I.: da abertura à entrada no estoque, percentil 80', historico_nacional: 'prazo real dos pedidos nacionais no Omie, percentil 80', historico_produto: 'prazo real do próprio produto, percentil 80', fornecedor_exterior: 'fornecedor do exterior', fornecedor_nacional: 'fornecedor nacional', codigo_n: 'código terminado em N = nacional', padrao_importado: 'sem fornecedor conhecido: padrão importado' }[item.estPrazoOrigem] || '—'}).{' '}
          {item.estCusto != null
            ? <>Custo <b>{ivFmtMoeda(item.estCusto)}</b> ({item.estCustoOrigem === 'ultimo_preco' ? 'último preço pago' : 'custo médio do Omie'}), margem <b>{ivFmtMoeda(item.estMargem)}</b> ({item.estMargemOrigem === 'preco_venda' ? 'preço de venda − custo' : 'estimada em 30% do custo'}){item.estCapitalMax != null && item.estMaxSug > 0 ? <>; no máximo, <b>{ivFmtMoeda(item.estCapitalMax)}</b> parados em estoque</> : null}.</>
            : <>Custo desconhecido: o valor do item não entrou na conta.</>}
          <br />Sistema sugere: mínimo <b>{ivFmtNum(item.estMinSugCalc)}</b> · máximo <b>{ivFmtNum(item.estMaxSugCalc)}</b> (prazo {item.estPrazoDias} d + ciclo {item.estCicloDias} d).<br />
          Posição hoje: <b>{ivFmtNum(item.posicaoEstoque)}</b> (disponível + pendente + comprado). Em uso: {origem}{revisadoPor}.
          {item.precisaRevisao && <> Enquanto não for revisado, <b>este produto não gera compra</b>{item.sugestaoSeAprovada > 0 ? <> (aprovando, a sugestão seria <b>{ivFmtNum(item.sugestaoSeAprovada)}</b>)</> : null}.</>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="up-eyebrow muted">Mínimo (ponto de pedido)</label>
            <input className="input" type="number" min="0" step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="up-eyebrow muted">Máximo (comprar até)</label>
            <input className="input" type="number" min="0" step="1" value={maximo} onChange={(e) => setMaximo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="up-eyebrow muted">Observação (opcional)</label>
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: projeto especial do cliente X, comprar só sob pedido…" />
        </div>
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
  const [contFiltro, setContFiltro] = React.useState('todas');   // todas | divergentes | semcontagem
  const [tendFiltro, setTendFiltro] = React.useState('todas');   // todas | alta | baixa
  const [soDiaD, setSoDiaD] = React.useState(false);              // só itens com Dia D vencido ou chegando
  // Mercadoria por chegar: todas | tudo (qualquer coisa por chegar) | comprado (pedido sem embarque) | caminho (embarcado) | semnota (chegou, falta a nota)
  const [caminhoFiltro, setCaminhoFiltro] = React.useState('todas');
  const [avisoContagem, setAvisoContagem] = React.useState(null);
  const [selecionados, setSelecionados] = React.useState(() => new Set());
  /* Bug real (varredura de URLs, 09/10): os modais "Revisar lote de compra" e
     "Comprado"/"lançar" eram só useState — F5/link direto sempre voltavam
     pra lista. A tela não tem aba (useRouteTab), então as 2 ações dividem o
     2º segmento (/logistica/compras/<acao>:<código>), mesmo truque usado no
     Almoxarifado. */
  const [itemUrl, setItemUrl] = window.useRotaId('compras');
  const [acaoUrl, codigoUrl] = itemUrl ? (() => { const i = itemUrl.indexOf(':'); return i < 0 ? [itemUrl, ''] : [itemUrl.slice(0, i), itemUrl.slice(i + 1)]; })() : ['', ''];
  const itemModalUrl = (items && codigoUrl) ? items.find((it) => it.codigo === codigoUrl) || null : null;
  const abrirModalIv = (acao, item) => setItemUrl(acao + ':' + item.codigo);
  const fecharModalIv = () => setItemUrl(null);
  const modalLote = acaoUrl === 'lote' ? itemModalUrl : null;
  const modalComprado = acaoUrl === 'comprado' ? itemModalUrl : null;
  const modalCaminho = acaoUrl === 'caminho' ? itemModalUrl : null;
  const modalRevisao = acaoUrl === 'revisao' ? itemModalUrl : null;
  const [soRevisar, setSoRevisar] = React.useState(false);
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
        setAvisoContagem(data.avisoContagem || null);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((i) => {
      const combinaTexto = !q || i.codigo.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q) || (i.ultimoFornecedorNome || '').toLowerCase().includes(q);
      const combinaCor = corFiltro === 'todas' || ivStatusDoItem(i) === corFiltro;
      const combinaCurva = curvaFiltro === 'todas' || i.curva === curvaFiltro;
      const combinaCont = contFiltro === 'todas'
        || (contFiltro === 'divergentes' && i.acuracia && !i.acuracia.ok)
        || (contFiltro === 'semcontagem' && i.baseEstoque === 'omie');
      if (soRevisar && !i.precisaRevisao) return false;
      if (soDiaD && !(i.estDiaDStatus === 'atrasado' || i.estDiaDStatus === 'acordar')) return false;
      if (caminhoFiltro !== 'todas' && !ivCombinaCaminho(i, caminhoFiltro)) return false;
      const combinaTend = tendFiltro === 'todas' || i.estTendencia === tendFiltro || (tendFiltro === 'alta' && i.estTendencia === 'nova');
      return combinaTexto && combinaCor && combinaCurva && combinaCont && combinaTend;
    });
  }, [items, busca, corFiltro, curvaFiltro, contFiltro, tendFiltro, soRevisar, soDiaD, caminhoFiltro]);
  const nParaRevisar = React.useMemo(() => items.filter((i) => i.precisaRevisao).length, [items]);
  const resumoCaminho = React.useMemo(() => {
    const lista = items.filter((i) => i.caminhoTotal > 0);
    return {
      produtos: lista.length,
      unidades: lista.reduce((s, i) => s + i.caminhoTotal, 0),
      semNota: lista.filter((i) => i.chegouSemNota > 0).length,
    };
  }, [items]);

  // Acuracidade = % de itens contados em que a prateleira bateu com o sistema no dia da contagem.
  const resumoAcuracia = React.useMemo(() => {
    const contados = items.filter((i) => i.acuracia);
    const ok = contados.filter((i) => i.acuracia.ok).length;
    return {
      contados: contados.length, ok, divergentes: contados.length - ok,
      pct: contados.length ? Math.round((ok / contados.length) * 1000) / 10 : null,
      semContagemValida: items.filter((i) => i.baseEstoque === 'omie').length,
    };
  }, [items]);

  // Grava contagem/endereço e atualiza só a linha (sem recarregar a tela inteira): a sugestão da linha é recalculada na hora.
  const salvarContagemItem = async (item, campos) => {
    const row = await window.ImportacaoVarejoStore.salvarContagem({ item, ...campos });
    const linha = { quantidade: row.quantidade != null ? row.quantidade : null, saldo_sistemico: row.saldo_sistemico != null ? row.saldo_sistemico : null, contado_em: row.contado_em || null, contado_por: row.contado_por || null, endereco: row.endereco, observacao: row.observacao };
    setItems((prev) => prev.map((x) => (x.codigo === item.codigo ? window.ImportacaoVarejoStore.aplicarContagem(x, linha) : x)));
    window.toast?.(campos.quantidade != null && campos.quantidade !== '' ? 'Contagem registrada.' : 'Endereço salvo.', 'success');
  };

  const calcularTotais = (lista) => lista.reduce((acc, i) => {
    const temPrecoEPrecisaComprar = i.sugestaoCompra > 0 && i.ultimoPrecoUnitario != null;
    return {
      estoqueFisico: acc.estoqueFisico + i.estoqueFisico,
      estoqueDisponivel: acc.estoqueDisponivel + i.estoqueDisponivel,
      estoqueReservado: acc.estoqueReservado + (i.estoqueReservado || 0),
      pendente: acc.pendente + (i.pendenteOmie || 0),
      sugestaoCompra: acc.sugestaoCompra + i.sugestaoCompra,
      sugAteMax: acc.sugAteMax + (i.sugAteMax || 0),
      comprado: acc.comprado + i.comprado,
      caminho: acc.caminho + (i.caminhoTotal || 0),
      valorAPagar: acc.valorAPagar + (temPrecoEPrecisaComprar ? i.sugestaoCompra * i.ultimoPrecoUnitario : 0),
      itensSemPreco: acc.itensSemPreco + (i.sugestaoCompra > 0 && i.ultimoPrecoUnitario == null ? 1 : 0),
    };
  }, { estoqueFisico: 0, estoqueDisponivel: 0, estoqueReservado: 0, pendente: 0, sugestaoCompra: 0, sugAteMax: 0, comprado: 0, caminho: 0, valorAPagar: 0, itensSemPreco: 0 });
  const totais = React.useMemo(() => calcularTotais(filtrados), [filtrados]);

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

  /* Cotações de Varejo (16/10/2026): "Pedir cotação" cria um LOTE com os produtos marcados (nada vai ao Omie) e leva para a
     página Cotações de Varejo, onde os fornecedores respondem. O selo "em cotação" não abate a sugestão: só a compra aprovada abate. */
  const [emCotacao, setEmCotacao] = React.useState({});
  React.useEffect(() => { window.CotacoesVarejoStore?.codigosEmCotacao().then(setEmCotacao).catch(() => setEmCotacao({})); }, [items]);
  const [pedindoCotacao, setPedindoCotacao] = React.useState(false);
  const pedirCotacao = async () => {
    if (!window.CotacoesVarejoStore) { window.toast?.('Módulo de cotações não carregou — recarregue a página.', 'error'); return; }
    setPedindoCotacao(true);
    try {
      const lote = await window.CotacoesVarejoStore.criarLote(itensSelecionados.map((i) => ({
        codigo: i.codigo, descricao: i.descricao, quantidade: i.sugestaoCompra > 0 ? i.sugestaoCompra : 1,
      })));
      window.toast?.('Lote ' + lote.numero + ' criado com ' + itensSelecionados.length + ' produto(s). Escolha os fornecedores e envie.', 'success');
      setSelecionados(new Set());
      window.VpRouter.navigate('cotacoes-varejo', lote.id);
      setRoute && setRoute('cotacoes-varejo');
    } catch (e) { window.toast?.('Erro ao criar o lote de cotação: ' + (e.message || e), 'error'); }
    finally { setPedindoCotacao(false); }
  };

  const toggleSelecionado = (codigo) => setSelecionados((prev) => {
    const next = new Set(prev);
    if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
    return next;
  });
  const itensSelecionados = items.filter((i) => selecionados.has(i.codigo));
  const totaisSelecionados = calcularTotais(itensSelecionados);
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
          <p className="page-head__sub">Estoque (sincronizado 4x/dia), vendas reais do Omie (atualizadas todo dia) e Sugestão de Compra dos produtos importados vendidos avulsos: compra-se quando a posição chega ao mínimo sugerido e a quantidade leva até o máximo sugerido.</p>
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

      {avisoContagem && !erro && (
        <div className="alert warning" style={{ marginBottom: 16 }}>
          <Icon.warning />
          <div><div className="alert__title">Contagens físicas indisponíveis</div><div className="alert__sub">{avisoContagem}</div></div>
        </div>
      )}

      {resumoCaminho.produtos > 0 && !erro && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <Icon.info />
          <div style={{ flex: 1 }}>
            <div className="alert__title">{resumoCaminho.produtos} produto(s) com mercadoria por chegar ({ivFmtNum(resumoCaminho.unidades)} un.)</div>
            <div className="alert__sub">
              Vem de P.I. já abertas, cruzadas com as notas de importação do Omie. Já entra na posição do estoque, então a sugestão não pede de novo o que está vindo.
              {resumoCaminho.semNota > 0 ? ` ${resumoCaminho.semNota} item(ns) já chegaram e esperam a nota ser lançada (⚑).` : ''}
            </div>
          </div>
          <Button size="sm" variant={caminhoFiltro === 'tudo' ? 'primary' : 'outline'} onClick={() => setCaminhoFiltro(caminhoFiltro === 'tudo' ? 'todas' : 'tudo')}>{caminhoFiltro === 'tudo' ? 'Mostrar todos' : 'Ver quais'}</Button>
        </div>
      )}

      {nParaRevisar > 0 && !erro && (
        <div className="alert warning" style={{ marginBottom: 16 }}>
          <Icon.warning />
          <div style={{ flex: 1 }}>
            <div className="alert__title">{nParaRevisar} produto(s) de venda esporádica aguardam revisão do comprador</div>
            <div className="alert__sub">Vendem em poucos meses, então o sistema não gera compra automática para eles. Abra cada um, veja o histórico e aprove, ajuste mínimo/máximo ou marque "não repor".</div>
          </div>
          <Button size="sm" variant={soRevisar ? 'primary' : 'outline'} onClick={() => setSoRevisar(!soRevisar)}>{soRevisar ? 'Mostrar todos' : 'Ver a fila'}</Button>
        </div>
      )}

      <div className="grid-5" style={{ marginBottom: 20 }}>
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
        <KPI
          label="Valores a pagar (estimado)"
          value={ivFmtMoeda(selecionados.size > 0 ? totaisSelecionados.valorAPagar : totais.valorAPagar)}
          sub={selecionados.size > 0
            ? `${itensSelecionados.length} selecionado(s)${totaisSelecionados.itensSemPreco > 0 ? ` · ${totaisSelecionados.itensSemPreco} sem preço` : ''}`
            : (totais.itensSemPreco > 0 ? `${totais.itensSemPreco} item(ns) sem preço conhecido` : 'com base no último preço pago')}
          icon="dollar"
          style={selecionados.size > 0 ? { boxShadow: '0 0 0 2px var(--vp-info)' } : undefined}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Buscar por código, descrição ou fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="small" style={{ color: 'var(--fg3)' }}>{filtrados.length} de {items.length} produtos</span>
        <div className="spacer" style={{ flex: 1 }} />
        {podeGerenciar && selecionados.size > 0 && (
          <Button variant="primary" size="sm" icon="send" onClick={pedirCotacao} disabled={pedindoCotacao}
            data-tip="Cria um lote de cotação com os produtos marcados. Nada vai ao Omie até a compra ser aprovada na página Cotações de Varejo.">
            {pedindoCotacao ? 'Criando lote…' : 'Pedir cotação (' + selecionados.size + ')'}
          </Button>
        )}
        {podeGerenciar && selecionados.size > 0 && (
          <Button variant="outline" size="sm" icon="send" onClick={() => setModalEnviar(true)}
            data-tip="Compra direta, sem cotação: cria a Requisição de Compra no Omie agora, com o fornecedor/preço que você confirmar.">
            Comprar direto no Omie ({selecionados.size})
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['todas', 'vermelha', 'amarela', 'branca'].map((v) => (
          <Button key={v} size="sm" variant={corFiltro === v ? 'primary' : 'ghost'} onClick={() => setCorFiltro(v)}>
            {v === 'todas' ? 'Todas' : v === 'vermelha' ? 'Precisa comprar' : v === 'amarela' ? 'Alerta' : 'Ok'}{' '}
            <span style={{ opacity: .7 }}>({v === 'todas' ? items.length : items.filter((i) => ivStatusDoItem(i) === v).length})</span>
          </Button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
        {['todas', 'A', 'B', 'C', 'D'].map((v) => (
          <Button key={v} size="sm" variant={curvaFiltro === v ? 'primary' : 'ghost'} onClick={() => setCurvaFiltro(v)}>
            {v === 'todas' ? 'Todas as curvas' : `Curva ${v}`}
          </Button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
        <Button size="sm" variant={soRevisar ? 'primary' : 'ghost'} onClick={() => setSoRevisar(!soRevisar)} data-tip="Produtos de venda esporádica: o sistema não compra sozinho. O comprador aprova, ajusta ou marca 'não repor'.">
          ⚑ Para revisar <span style={{ opacity: .7 }}>({nParaRevisar})</span>
        </Button>
        <Button size="sm" variant={soDiaD ? 'primary' : 'ghost'} onClick={() => setSoDiaD(!soDiaD)} data-tip="Itens cujo Dia D (data-limite para decidir o pedido: 45 d para criar + 5 d de decisão + prazo de chegada) já passou ou chega em até 15 dias">
          ⏰ Dia D <span style={{ opacity: .7 }}>({items.filter((i) => i.estDiaDStatus === 'atrasado' || i.estDiaDStatus === 'acordar').length})</span>
        </Button>
        <Button size="sm" variant={tendFiltro === 'alta' ? 'primary' : 'ghost'} onClick={() => setTendFiltro(tendFiltro === 'alta' ? 'todas' : 'alta')} data-tip="Vendas dos últimos 3 meses pelo menos 20% acima dos 3 meses anteriores (ou produto que voltou a vender)">
          ▲ Em alta <span style={{ opacity: .7 }}>({items.filter((i) => i.estTendencia === 'alta' || i.estTendencia === 'nova').length})</span>
        </Button>
        <Button size="sm" variant={tendFiltro === 'baixa' ? 'primary' : 'ghost'} onClick={() => setTendFiltro(tendFiltro === 'baixa' ? 'todas' : 'baixa')} data-tip="Vendas dos últimos 3 meses pelo menos 20% abaixo dos 3 meses anteriores">
          ▼ Em baixa <span style={{ opacity: .7 }}>({items.filter((i) => i.estTendencia === 'baixa').length})</span>
        </Button>
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
        <Button size="sm" variant={caminhoFiltro === 'comprado' ? 'primary' : 'ghost'} onClick={() => setCaminhoFiltro(caminhoFiltro === 'comprado' ? 'todas' : 'comprado')} data-tip="Pedido feito, ainda sem embarque: 'Comprado' lançado pelo comprador (requisição) ou P.I. aberta que ainda não embarcou">
          📦 Comprado <span style={{ opacity: .7 }}>({items.filter((i) => ivCombinaCaminho(i, 'comprado')).length})</span>
        </Button>
        <Button size="sm" variant={caminhoFiltro === 'caminho' ? 'primary' : 'ghost'} onClick={() => setCaminhoFiltro(caminhoFiltro === 'caminho' ? 'todas' : 'caminho')} data-tip="Já embarcou (P.I. com embarque em andamento) e ainda não tem nota de importação no Omie">
          🚢 A caminho <span style={{ opacity: .7 }}>({items.filter((i) => ivCombinaCaminho(i, 'caminho')).length})</span>
        </Button>
        <Button size="sm" variant={caminhoFiltro === 'semnota' ? 'primary' : 'ghost'} onClick={() => setCaminhoFiltro(caminhoFiltro === 'semnota' ? 'todas' : 'semnota')} data-tip="Embarque concluído, mas a nota de importação ainda não foi lançada no Omie (o estoque só entra com a nota)">
          ⚑ Chegou, falta a nota <span style={{ opacity: .7 }}>({items.filter((i) => ivCombinaCaminho(i, 'semnota')).length})</span>
        </Button>
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
        <Button size="sm" variant={contFiltro === 'divergentes' ? 'primary' : 'ghost'} onClick={() => setContFiltro(contFiltro === 'divergentes' ? 'todas' : 'divergentes')} data-tip="Itens em que a contagem da prateleira não bateu com o saldo do sistema no dia da contagem">
          Divergentes <span style={{ opacity: .7 }}>({resumoAcuracia.divergentes})</span>
        </Button>
        <Button size="sm" variant={contFiltro === 'semcontagem' ? 'primary' : 'ghost'} onClick={() => setContFiltro(contFiltro === 'semcontagem' ? 'todas' : 'semcontagem')} data-tip="Sem contagem física nos últimos 30 dias: a sugestão usa só o saldo do Omie, que pode estar errado">
          Saldo não conferido <span style={{ opacity: .7 }}>({resumoAcuracia.semContagemValida})</span>
        </Button>
      </div>

      <Card title="Produtos importados" sub={`Estoque sincronizado em ${ivFmtDataHora(lastEstoqueSyncAt)} · Giro/Curva calculados em ${ivFmtDataHora(lastGiroSyncAt)} · Acuracidade da contagem: ${resumoAcuracia.pct != null ? resumoAcuracia.pct.toLocaleString('pt-BR') + '% (' + resumoAcuracia.ok + ' de ' + resumoAcuracia.contados + ' itens contados batem)' : 'sem contagens'} · Saldo não conferido (sem contagem dos últimos ${window.ImportacaoVarejoStore.CONTAGEM_VALIDADE_DIAS} dias): ${resumoAcuracia.semContagemValida} itens`}>
      <div className="table-wrap" style={{ border: 0, maxHeight: 'calc(100vh - 150px)', overflow: 'auto' }}>
        <style>{`table.t.pcp-grid.iv-grid th,table.t.pcp-grid.iv-grid td{padding-left:6px;padding-right:6px}
table.t.pcp-grid.iv-grid thead th{position:sticky;top:0;z-index:3;background:var(--vp-surface,#fff);box-shadow:0 1px 0 var(--vp-border,#e5e5e5)}`}</style>
        <table className="t pcp-grid iv-grid">
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
            <th>Endereço</th>
            <th className="text-center">Curva</th>
            <th className="text-right">Físico</th>
            <th className="text-right">Reservado</th>
            <th className="text-right">Disponível</th>
            <th className="text-right" title="Quantidade contada na prateleira. Vale por 30 dias e passa a mandar na sugestão de compra.">Contado</th>
            <th className="text-center" title="OK = a contagem bateu com o saldo do sistema no dia da contagem">Acuracidade</th>
            <th className="text-right" title="Mínimo cadastrado à mão no Omie (número inteiro). O mínimo que o sistema recomenda está na coluna ao lado.">Mín. Omie</th>
            <th className="text-right" title="Sugerido pelo sistema a partir das vendas reais do Omie (6 meses): ponto de pedido = demanda × prazo + segurança. Atualiza todo dia.">Mín. sug.</th>
            <th className="text-right" title="Sugerido pelo sistema: mínimo + demanda de um ciclo de compra (60 dias). Atualiza todo dia.">Máx. sug.</th>
            <th className="text-right">Pendente</th>
            <th className="text-right" title="Pedido feito pelo comprador (requisição ou lançamento manual) que ainda não virou P.I.">Comprado</th>
            <th className="text-right" title="Já tem P.I.: embarcado, chegou sem nota lançada, ou comprado e ainda não embarcou. Sai daqui quando a nota de importação é lançada no Omie. Clique para ver o detalhe.">A caminho</th>
            <th className="text-right">Sugestão</th>
            <th title="Dia D = data-limite para decidir o pedido = hoje + (dias de cobertura da posição − prazo total). Prazo total = criar e decidir o pedido (importados: 45 + 5 d) + prazo de chegada. Vermelho: já passou; âmbar: faltam até 15 dias.">Dia D</th>
            <th title="Vendas mês a mês dos últimos 12 meses. Seta = últimos 3 meses × 3 meses anteriores. Ponto verde = mês de maior venda; ponto vermelho = mês de menor venda.">Tendência (12 meses)</th>
            <th>Último Fornecedor</th>
            <th className="text-right">Último Preço Unit.</th>
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
                    <td className="mono small" style={{ whiteSpace: 'nowrap' }}>{item.codigo}</td>
                    <td className="cell-main" title={item.descricao} style={{ maxWidth: 200 }}>{item.descricao}
                      {emCotacao[item.codigo] && (
                        <div><button className="link-btn" title="Este produto está em um lote de cotação ainda não aprovado (não abate a sugestão)"
                          onClick={() => { window.VpRouter.navigate('cotacoes-varejo', emCotacao[item.codigo].id); setRoute && setRoute('cotacoes-varejo'); }}
                          style={{ fontSize: 11, fontWeight: 800 }}>🧾 em cotação · {emCotacao[item.codigo].numero}</button></div>
                      )}
                    </td>
                    <td>
                      <IVCelulaEditavel valor={item.endereco} podeEditar={podeGerenciar} placeholder="ex.: R2A4" largura={90}
                        onSave={(v) => salvarContagemItem(item, { endereco: v })} />
                    </td>
                    <td className="text-center"><IVCurvaBadge curva={item.curva} /></td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueFisico)}</td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueReservado)}</td>
                    <td className="text-right cell-num" style={{ fontWeight: 700 }}>
                      {ivFmtNum(item.estoqueDisponivel)}
                      {item.baseEstoque === 'contado'
                        ? <div className="small" style={{ fontWeight: 400, color: 'var(--vp-green-700, #047857)' }} title="Disponível = contado − reservado do Omie">contado</div>
                        : <div className="small" style={{ fontWeight: 400, color: 'var(--vp-amber-700, #b45309)' }} title={item.contagem && item.contagem.vencida ? 'Última contagem é antiga (mais de ' + window.ImportacaoVarejoStore.CONTAGEM_VALIDADE_DIAS + ' dias): vale o saldo do Omie' : 'Nunca contado: vale o saldo do Omie'}>não conferido</div>}
                    </td>
                    <td className="text-right cell-num">
                      <IVCelulaEditavel valor={item.contagem && item.contagem.quantidade != null ? item.contagem.quantidade : ''} tipo="numero" podeEditar={podeGerenciar} placeholder="contar" largura={70} alinhar="right"
                        onSave={(v) => (v === '' ? Promise.resolve() : salvarContagemItem(item, { quantidade: v }))} />
                      {item.contagem && item.contagem.quantidade != null && (
                        <div className="small" style={{ fontWeight: 400, color: item.contagem.vencida ? 'var(--vp-amber-700, #b45309)' : 'var(--fg3)', whiteSpace: 'nowrap' }}
                          title={item.contagem.vencida ? 'Contagem vencida (mais de ' + window.ImportacaoVarejoStore.CONTAGEM_VALIDADE_DIAS + ' dias)' : ''}>
                          {ivFmtData(item.contagem.contadoEm)}{item.contagem.contadoPor ? ' · ' + item.contagem.contadoPor : ''}
                        </div>
                      )}
                    </td>
                    <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                      {item.acuracia
                        ? (item.acuracia.ok
                          ? <Badge variant="success" title={'Sistema dizia ' + ivFmtNum(item.contagem.saldoSistemico) + ' e a prateleira tinha ' + ivFmtNum(item.contagem.quantidade)}>OK</Badge>
                          : <Badge variant="danger" title={'Sistema dizia ' + ivFmtNum(item.contagem.saldoSistemico) + ' e a prateleira tinha ' + ivFmtNum(item.contagem.quantidade)}>N/OK {item.acuracia.diferenca > 0 ? '+' : ''}{ivFmtNum(item.acuracia.diferenca)}</Badge>)
                        : <span className="muted">—</span>}
                    </td>
                    <td className="text-right cell-num">{ivFmtNum(item.estoqueMinimo)}</td>
                    {(() => {
                      const dica = item.estMaxSug == null ? '' : `${item.estMotivo ? item.estMotivo + ' · ' : ''}${item.estCusto != null ? 'custo ' + ivFmtMoeda(item.estCusto) + ' · ' : ''}Demanda ${ivFmtNum(item.estDemandaMensal)}/mês · ${item.estMesesVenda} de 6 meses com venda · prazo ${item.estPrazoDias} d · ciclo ${item.estCicloDias} d · segurança ${ivFmtNum(item.estSeguranca)} · confiança ${item.estConfianca}`;
                      const cor = item.estConfianca === 'baixa' ? 'var(--fg3)' : undefined;
                      if (item.estMaxSug === 0 && item.estOrigem !== 'manual') {
                        return <td colSpan={2} className="text-center small muted" title="Vende muito pouco: não vale manter estoque. Comprar só quando houver pedido de cliente. Clique para revisar."
                          style={{ cursor: podeGerenciar ? 'pointer' : undefined }} onClick={podeGerenciar ? () => abrirModalIv('revisao', item) : undefined}>sob demanda</td>;
                      }
                      return item.estMaxSug == null
                        ? <><td className="text-right muted">—</td><td className="text-right muted">—</td></>
                        : <>
                            <td className="text-right cell-num" title={dica + (podeGerenciar ? ' · clique para revisar' : '')} style={{ color: cor, fontWeight: item.abaixoMinSug ? 800 : 400, cursor: podeGerenciar ? 'pointer' : undefined }}
                              onClick={podeGerenciar ? () => abrirModalIv('revisao', item) : undefined}>{ivFmtNum(item.estMinSug)}{item.estOrigem === 'manual' && <span title="Ajustado pelo comprador"> ✎</span>}</td>
                            <td className="text-right cell-num" title={dica + (podeGerenciar ? ' · clique para revisar' : '')} style={{ color: cor, cursor: podeGerenciar ? 'pointer' : undefined }}
                              onClick={podeGerenciar ? () => abrirModalIv('revisao', item) : undefined}>{ivFmtNum(item.estMaxSug)}{item.estOrigem === 'manual' && <span title="Ajustado pelo comprador"> ✎</span>}</td>
                          </>;
                    })()}
                    <td className="text-right cell-num">{ivFmtNum(item.pendenteOmie)}</td>
                    <td className="text-right cell-num">
                      {item.comprado > 0 ? (
                        <button className="link-btn" onClick={() => abrirModalIv('comprado', item)}>{ivFmtNum(item.comprado)}</button>
                      ) : podeGerenciar ? (
                        <button className="link-btn muted" onClick={() => abrirModalIv('comprado', item)}>lançar</button>
                      ) : '—'}
                    </td>
                    <td className="text-right cell-num">
                      {item.caminhoTotal > 0 ? (
                        <button className="link-btn" onClick={() => abrirModalIv('caminho', item)}
                          title={[item.aCaminho > 0 && `${ivFmtNum(item.aCaminho)} embarcado(s)`, item.chegouSemNota > 0 && `${ivFmtNum(item.chegouSemNota)} chegou(aram), falta a nota`, item.compradoPi > 0 && `${ivFmtNum(item.compradoPi)} ainda não embarcou`].filter(Boolean).join(' · ')}>
                          {ivFmtNum(item.caminhoTotal)}{item.chegouSemNota > 0 ? ' ⚑' : ''}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 800 }}
                      title={item.estMaxSug == null ? '' : (item.abaixoMinSug
                        ? `Posição ${ivFmtNum(item.posicaoEstoque)} ≤ mínimo sugerido ${ivFmtNum(item.estMinSug)}: comprar até o máximo sugerido ${ivFmtNum(item.estMaxSug)}`
                        : `Posição ${ivFmtNum(item.posicaoEstoque)} acima do mínimo sugerido ${ivFmtNum(item.estMinSug)}: ainda não precisa comprar`)}>
                      {item.precisaRevisao
                        ? (podeGerenciar
                          ? <button className="link-btn" onClick={() => abrirModalIv('revisao', item)} title={'Venda esporádica: não compra sozinho' + (item.sugestaoSeAprovada > 0 ? ' (se aprovar, sugere ' + ivFmtNum(item.sugestaoSeAprovada) + ')' : '')} style={{ color: 'var(--vp-amber-700, #b45309)', fontWeight: 800 }}>⚑ revisar</button>
                          : <span title="Aguardando revisão do comprador" style={{ color: 'var(--vp-amber-700, #b45309)' }}>⚑ revisar</span>)
                        : ivFmtNum(item.sugestaoCompra)}
                      {podeGerenciar && (
                        <button className="link-btn" title="Revisar lote de compra" onClick={() => abrirModalIv('lote', item)} style={{ marginLeft: 6 }}>
                          <Icon.ruler size={13} />
                        </button>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                      title={item.estDiaDDias == null ? '' : `Cobertura ${ivFmtNum(item.estCoberturaDias)} d (posição ${ivFmtNum(item.posicaoEstoque)} ÷ ${ivFmtNum(item.estDemandaMensal)}/mês) − prazo total ${item.estLeadTotalDias} d (chegada ${item.estPrazoDias} d + ${item.estAtrasoDias} d para criar e decidir o pedido)`}>
                      {item.estDiaDDias == null || item.precisaRevisao ? <span className="muted">—</span> : (
                        <span style={{ fontWeight: item.estDiaDStatus === 'ok' ? 400 : 800, color: item.estDiaDStatus === 'atrasado' ? 'var(--vp-danger, #b91c1c)' : item.estDiaDStatus === 'acordar' ? 'var(--vp-amber-700, #b45309)' : undefined }}>
                          {item.estDiaDDias <= 0 ? `atrasado ${-item.estDiaDDias} d` : ivFmtData(item.estDiaDData)}
                          {item.estDiaDDias > 0 && <span style={{ opacity: .7 }}> (+{item.estDiaDDias} d)</span>}
                        </span>
                      )}
                      {item.estMesesRuptura > 0 && <div style={{ fontSize: 10, color: 'var(--vp-amber-700, #b45309)' }} title="Meses em que o item ficou sem estoque em ≥ 30% dos dias: a venda baixa desses meses foi corrigida no cálculo">⚠ {item.estMesesRuptura} mês(es) sem estoque</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(() => {
                        const t = IV_TEND[item.estTendencia];
                        if (!t || !item.estSerie) return <span className="muted">—</span>;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div title={t.rotulo + (item.estTendenciaPct != null ? ' (' + (item.estTendenciaPct > 0 ? '+' : '') + ivFmtNum(item.estTendenciaPct) + '%)' : '')} style={{ color: t.cor, fontWeight: 800, fontSize: 12, minWidth: 54 }}>
                              {t.seta} {item.estTendenciaPct != null ? (item.estTendenciaPct > 0 ? '+' : '') + Math.round(item.estTendenciaPct) + '%' : t.rotulo}
                            </div>
                            <div>
                              <IVSparkline serie={item.estSerie} inicio={item.estSerieInicio} cor={t.cor} pico={item.estMesPico} vale={item.estMesVale} rup={item.estRuptura} />
                              {item.estMesPico && (
                                <div className="small" style={{ fontSize: 10, color: 'var(--fg3)', lineHeight: 1.2 }}>
                                  <span style={{ color: 'var(--vp-green-700, #047857)' }}>● {ivRotuloMes(item.estMesPico)}</span>
                                  {item.estMesVale && <span style={{ color: 'var(--vp-danger, #b91c1c)', marginLeft: 6 }}>● {ivRotuloMes(item.estMesVale)}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td
                      className="small"
                      style={{ whiteSpace: 'nowrap' }}
                      title={
                        item.ultimoPedidoNumero
                          ? `${item.ultimoFornecedorFonte === 'pi_importacao' ? 'P.I.' : 'Pedido'} ${item.ultimoPedidoNumero} em ${ivFmtData(item.ultimoPedidoData)}`
                          : ''
                      }
                    >
                      {item.ultimoFornecedorNome ? (
                        <>
                          <span style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{item.ultimoFornecedorNome}</span>
                          {item.ultimoFornecedorExterior && <Badge variant="neutral" style={{ marginLeft: 6 }} title="Fornecedor estrangeiro">exterior</Badge>}
                          {item.ultimoFornecedorFonte === 'pi_importacao' && (
                            <Badge variant="info" style={{ marginLeft: 6 }} title="Veio de uma P.I. (fatura comercial real) do próprio site, não de Pedido de Compra do Omie">
                              P.I.
                            </Badge>
                          )}
                        </>
                      ) : <span className="muted">sem histórico</span>}
                    </td>
                    <td className="text-right cell-num">{item.ultimoPrecoUnitario != null ? ivFmtMoeda(item.ultimoPrecoUnitario) : '—'}</td>
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
                <td colSpan={podeGerenciar ? 5 : 4}>Total</td>
                {/* Uma célula por coluna do cabeçalho (conferido em 16/10: o bloco em branco tinha 7 colunas para 6 e deslocava todos os totais). */}
                <td className="text-right">{ivFmtNum(totais.estoqueFisico)}</td>
                <td className="text-right">{ivFmtNum(totais.estoqueReservado)}</td>
                <td className="text-right">{ivFmtNum(totais.estoqueDisponivel)}</td>
                <td colSpan={5}></td>{/* Contado, Acuracidade, Mín. Omie, Mín. sug., Máx. sug. */}
                <td className="text-right">{ivFmtNum(totais.pendente)}</td>
                <td className="text-right">{ivFmtNum(totais.comprado)}</td>
                <td className="text-right">{ivFmtNum(totais.caminho)}</td>
                <td className="text-right">{ivFmtNum(totais.sugestaoCompra)}</td>
                <td colSpan={3}></td>{/* Dia D, Tendência, Último Fornecedor */}
                <td className="text-right">{ivFmtMoeda(totais.valorAPagar)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </Card>

      {modalLote && <IVModalLote item={modalLote} onClose={fecharModalIv} onSaved={() => { fecharModalIv(); carregar(); }} />}
      {modalComprado && <IVModalComprado item={modalComprado} onClose={fecharModalIv} onSaved={() => { fecharModalIv(); carregar(); }} />}
      {modalCaminho && <IVModalACaminho item={modalCaminho} onClose={fecharModalIv} />}
      {modalRevisao && <IVModalRevisao item={modalRevisao} onClose={fecharModalIv} onSaved={() => { fecharModalIv(); carregar(); }} />}
      {modalEnviar && <IVModalEnviarOmie itens={itensSelecionados} onClose={() => setModalEnviar(false)} onEnviado={() => { setModalEnviar(false); setSelecionados(new Set()); carregar(); }} />}
    </div>
  );
}

Object.assign(window, { ImportacaoVarejoPage });
