/* ============================================================
   compra-pcp.jsx — Logística Interna · Almoxarifado · enviar a compra ao Omie a partir das abas Reposição e Necessidade.
   ⚠️ O envio REAL grava uma Requisição de Compra no Omie (Edge Function pcp-omie-escrever, acao 'requisicao_compra').
   Por isso o modal tem 3 passos e não dá para pular nenhum:
     1) conferir/editar quantidades  →  2) SIMULAR (a função devolve o que seria enviado, sem gravar nada em lugar nenhum)
     →  3) confirmar e enviar. O botão de envio só libera quando a simulação é dos MESMOS itens/quantidades que estão na tela,
     a caixa de confirmação está marcada e a pessoa tem a alçada almoxarifado.escrever_omie.
   Regras que existem por motivo real:
   - A função agrupa por origem do produto (nacional → 2.01.90, importada → 2.01.99), grava a ação em pcp_omie_fila ANTES de
     chamar o Omie e usa chave idempotente; nada disso é refeito aqui.
   - Anti-duplicata: pcp_omie_fila dos últimos 7 dias (status 'enviado') alimenta o aviso "já pedido em dd/mm (N un)" e exige
     uma 2ª confirmação para reenviar o mesmo item. A requisição só vira pedido de compra (e só então entra em "a caminho")
     depois que o comprador converte no Omie — por isso o aviso existe: o item continua aparecendo como "comprar" até lá.
   - Item fabricado pelo PCP (tem estrutura) não é comprado: quem chama deve filtrar antes.
   - Preço da requisição = custo do Omie (CMC) que a função já usa; fornecedor não faz parte da requisição (quem recebe decide).
   Reusa de almoxarifado.jsx: almErroFuncao, almSolicitante. Exposto: PcpModalCompra, usePcpRequisicoesRecentes, PcpTagRequisicao.
   ============================================================ */

const COMPRA_CATEGORIAS = { '2.01.90': 'Matéria-prima nacional', '2.01.99': 'Matéria-prima importada' };
const compraData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '';
const compraFmt = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Mapa codigo -> [{ qtd, em, por }] das requisições ENVIADAS ao Omie nos últimos `dias` dias.
function usePcpRequisicoesRecentes(dias = 7) {
  const [mapa, setMapa] = React.useState({});
  const carregar = React.useCallback(async () => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) return;
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    const { data } = await sb.from('pcp_omie_fila').select('payload, solicitante_email, enviado_em, criado_em')
      .eq('tipo', 'requisicao_compra').eq('status', 'enviado').gte('criado_em', desde).order('criado_em', { ascending: false }).limit(500);
    const m = {};
    (data || []).forEach(r => ((r.payload && r.payload.meta && r.payload.meta.itens) || []).forEach(i => {
      (m[i.codigo] = m[i.codigo] || []).push({ qtd: Number(i.quantidade), em: r.enviado_em || r.criado_em, por: r.solicitante_email });
    }));
    setMapa(m);
  }, [dias]);
  React.useEffect(() => { carregar(); }, [carregar]);
  return [mapa, carregar];
}

// Pequena marca na linha: "Req. 03/10 · 50".
function PcpTagRequisicao({ lista }) {
  if (!lista || !lista.length) return null;
  const t = lista[0];
  return <div style={{ fontSize: 10, color: 'var(--vp-info)' }} title={`Requisição enviada ao Omie em ${compraData(t.em)} por ${t.por || '—'}: ${compraFmt(t.qtd)}${lista.length > 1 ? ` (+${lista.length - 1} outra(s))` : ''}`}>Req. {compraData(t.em)} · {compraFmt(t.qtd)}</div>;
}

// itens: [{ codigo, descricao, unidade, quantidade, obs }]  requisicoes: mapa do hook acima
function PcpModalCompra({ itens, requisicoes, onClose, onEnviado }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [linhas, setLinhas] = React.useState(() => itens.map(i => ({ ...i, quantidade: String(i.quantidade) })));
  const [plano, setPlano] = React.useState(null);               // { assinatura, requisicoes, erros }
  const [resultado, setResultado] = React.useState(null);
  const [busy, setBusy] = React.useState(null);                 // 'simulando' | 'enviando'
  const [confirma, setConfirma] = React.useState(false);
  const [duplicadoOk, setDuplicadoOk] = React.useState(false);
  const [pode, setPode] = React.useState(null);
  const [erro, setErro] = React.useState(null);

  React.useEffect(() => {
    Promise.resolve(window.PropostaStore?.temCapacidade?.('almoxarifado', 'escrever_omie')).then(v => setPode(!!v)).catch(() => setPode(false));
  }, []);

  const q = (l) => Number(String(l.quantidade).replace(',', '.'));
  const validos = linhas.filter(l => q(l) > 0);
  const envio = validos.map(l => ({ codigo: l.codigo, quantidade: q(l), obs: l.obs || '' }));
  const assinatura = JSON.stringify(envio);
  const planoAtual = plano && plano.assinatura === assinatura;
  const duplicados = validos.filter(l => requisicoes && requisicoes[l.codigo] && requisicoes[l.codigo].length);

  const chamar = async (simular) => {
    const { data, error } = await sb.functions.invoke('pcp-omie-escrever', {
      body: { acao: 'requisicao_compra', simular, solicitante: almSolicitante(), itens: envio },
    });
    if (error || !data) throw new Error(await almErroFuncao(error, data));
    return data;
  };
  const simular = async () => {
    setBusy('simulando'); setErro(null);
    try {
      const r = await chamar(true);
      setPlano({ assinatura, requisicoes: r.requisicoes || [], erros: r.erros || [] });
      setConfirma(false); setDuplicadoOk(false);
    } catch (e) { setErro(e.message || String(e)); }
    finally { setBusy(null); }
  };
  const enviar = async () => {
    setBusy('enviando'); setErro(null);
    try {
      const r = await chamar(false);
      setResultado(r);
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Enviou requisição de compra ao Omie', alvo: `${envio.length} item(ns) em ${(r.resultados || []).length} requisição(ões)` });
      if (r.ok) window.toast?.('Requisição enviada ao Omie.', 'success'); else window.toast?.('Enviado com problemas — veja o resultado.', 'warning');
      onEnviado && onEnviado();
    } catch (e) { setErro(e.message || String(e)); }
    finally { setBusy(null); }
  };

  const podeEnviar = pode && planoAtual && plano.requisicoes.length > 0 && confirma && (duplicados.length === 0 || duplicadoOk) && !busy;

  const rodape = resultado
    ? <Button variant="primary" onClick={onClose}>Fechar</Button>
    : <>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant="ghost" onClick={simular} disabled={!!busy || validos.length === 0 || validos.length > 100}>{busy === 'simulando' ? 'Simulando…' : (planoAtual ? 'Simular de novo' : '1) Simular (não envia nada)')}</Button>
      <Button variant="primary" onClick={enviar} disabled={!podeEnviar}>{busy === 'enviando' ? 'Enviando…' : '2) Enviar ao Omie'}</Button>
    </>;

  return (
    <Modal title="Enviar compra ao Omie" onClose={onClose} width={760} footer={rodape}>
      <div className="stack" style={{ gap: 12 }}>
        {resultado ? (
          <div className="stack" style={{ gap: 8 }}>
            {(resultado.resultados || []).map((r, i) => (
              <div key={i} style={{ padding: 10, border: '1px solid var(--border, #e3e3e3)', borderRadius: 8 }}>
                <b>{COMPRA_CATEGORIAS[r.categoria] || r.categoria}</b> ({r.categoria}):{' '}
                {r.ok ? <span style={{ color: 'var(--vp-success-ink, green)' }}>enviada{r.resposta && r.resposta.codReqCompra ? ` — requisição nº ${r.resposta.codReqCompra}` : ''}</span> : <span style={{ color: 'var(--vp-danger)' }}>erro: {r.erro || 'falha ao enviar'} (fica na fila; dá para reenviar)</span>}
              </div>
            ))}
            {(resultado.erros || []).length > 0 && <div className="small" style={{ color: 'var(--vp-danger)' }}>Itens ignorados: {resultado.erros.map(e => `${e.codigo} (${e.motivo})`).join('; ')}</div>}
            <div className="small muted">A requisição aparece no Omie para o comprador converter em pedido de compra. Até lá estes itens continuam em "comprar", com a marca "Req.".</div>
          </div>
        ) : (
          <>
            <div className="small muted">Confira as quantidades. Nada é enviado ao Omie antes de você <b>simular</b>, marcar a confirmação e clicar em <b>Enviar</b>.</div>
            <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
              <table className="t pcp-grid">
                <thead><tr><th>Item</th><th style={{ width: 130 }}>Quantidade</th><th>Observação</th><th style={{ width: 24 }}/></tr></thead>
                <tbody>
                  {linhas.map((l, i) => {
                    const dup = requisicoes && requisicoes[l.codigo];
                    return (
                      <tr key={l.codigo}>
                        <td style={{ minWidth: 200 }}><b style={{ fontWeight: 500 }}>{l.codigo}</b><div style={{ fontSize: 11, color: 'var(--fg3)' }}>{l.descricao}</div>
                          {dup && dup.length > 0 && <div style={{ fontSize: 11, color: 'var(--vp-warning-ink, #a60)' }}>⚠ já pedido em {compraData(dup[0].em)} ({compraFmt(dup[0].qtd)})</div>}</td>
                        <td><input className="input" style={{ width: 90 }} value={l.quantidade} onChange={e => setLinhas(ls => ls.map((x, j) => j === i ? { ...x, quantidade: e.target.value } : x))}/> <span className="small muted">{l.unidade || ''}</span></td>
                        <td><input className="input" style={{ width: '100%' }} value={l.obs || ''} onChange={e => setLinhas(ls => ls.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))}/></td>
                        <td><button className="btn btn--sm" title="Tirar da compra" onClick={() => setLinhas(ls => ls.filter((_, j) => j !== i))}>×</button></td>
                      </tr>
                    );
                  })}
                  {linhas.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item.</td></tr>}
                </tbody>
              </table>
            </div>
            {validos.length > 100 && <div className="small" style={{ color: 'var(--vp-danger)' }}>Máximo de 100 itens por envio: tire {validos.length - 100}.</div>}

            {planoAtual && (
              <div style={{ padding: 10, border: '1px solid var(--vp-info)', borderRadius: 8 }}>
                <b>Simulação (nada foi enviado):</b>
                {plano.requisicoes.map((r, i) => (
                  <div key={i} className="small">• {COMPRA_CATEGORIAS[r.codCateg] || r.codCateg} ({r.codCateg}): {(r.ItensReqCompra || []).length} item(ns)</div>
                ))}
                {plano.erros.length > 0 && <div className="small" style={{ color: 'var(--vp-danger)' }}>Serão ignorados: {plano.erros.map(e => `${e.codigo} — ${e.motivo}`).join('; ')}</div>}
                {plano.requisicoes.length === 0 && <div className="small" style={{ color: 'var(--vp-danger)' }}>Nenhum item válido para enviar.</div>}
              </div>
            )}
            {plano && !planoAtual && <div className="small muted">Você mudou os itens ou quantidades depois da simulação — simule de novo.</div>}

            {planoAtual && duplicados.length > 0 && (
              <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={duplicadoOk} onChange={e => setDuplicadoOk(e.target.checked)}/>
                <span><b>{duplicados.length} item(ns) já têm requisição enviada nos últimos 7 dias.</b> Marque para enviar mesmo assim ({duplicados.map(d => d.codigo).join(', ')}).</span></label>
            )}
            {planoAtual && (
              <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={confirma} onChange={e => setConfirma(e.target.checked)}/>
                <span>Entendo que isso <b>cria a requisição de compra no Omie</b> e não dá para desfazer por aqui.</span></label>
            )}
            {pode === false && <div className="small" style={{ color: 'var(--vp-danger)' }}>Você não tem a alçada para gravar no Omie (Almoxarifado › Grava no Omie). Dá para simular, mas não enviar.</div>}
            {erro && <div className="small" style={{ color: 'var(--vp-danger)' }}>Erro: {erro}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

Object.assign(window, { PcpModalCompra, usePcpRequisicoesRecentes, PcpTagRequisicao });
