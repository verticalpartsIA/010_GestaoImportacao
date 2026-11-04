/* ============================================================
   quadros-separacao.jsx — Quadros de Comando · Separação PV QC e Separação FAB QC (04/11/2026, pedido do Gelson).
   "Separação Pedidos de Venda Quadro de Comando". Duas colunas: Nº do Pedido (o do Omie) e Cliente. Clicar na linha expande e
   mostra o que há para SEPARAR naquele pedido, cada item com uma caixa "Peguei".
   Os pedidos são os mesmos da tela "Pedidos com Quadro" (QuadrosPedidosStore). O que se separa = o motor da coluna Separação de lá:
   tudo do pedido MENOS o quadro, os cabos (vão com o quadro, inclusive o de manobra), a matéria-prima (VPMP) e o serviço (VPSVC);
   a máquina de tração entra (decisão do Gelson, 04/11/2026).
   "Peguei" é gravado no banco (qc_separacao_itens, migration 20261104120000) só pelas funções qc_separacao_listar/marcar, que exigem
   sessão real do portal e a alçada quadros-separacao (ver/editar). Mostra quem pegou e quando; o histórico fica em qc_separacao_hist.
   Com a chave pública (localhost "Dev Admin") a leitura e a gravação são recusadas: a tela avisa em vez de fingir que gravou.
   O pedido aberto fica na URL (/quadros-de-comando/quadros-separacao/<codigo_pedido>), então F5 e o botão Voltar funcionam.
   ============================================================ */

function qsQuem(email) { return String(email || '').split('@')[0]; }
function qsQuando(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
// Mensagem humana para a recusa do banco (sem sessão real / sem alçada).
function qsMsgErro(e) {
  const m = (e && e.message) || String(e);
  if (/permission denied|sem sess|JWT|not authorized/i.test(m)) return 'Esta sessão não tem acesso para gravar. Entre pela sua conta do portal.';
  if (/alçada/i.test(m)) return m.replace(/^.*?separação QC: /i, 'Sem permissão: ');
  return m;
}
function qsQtd(n) { return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
// Total por unidade de medida ('40 M · 40 PC'): metro e peça nunca se somam.
function qsTotais(itens) {
  const m = {};
  (itens || []).forEach((i) => { const u = String(i.unidade || 'un.').toUpperCase(); m[u] = (m[u] || 0) + (Number(i.quantidade) || 0); });
  return Object.keys(m).sort().map((u) => `${qsQtd(m[u])} ${u}`).join(' · ');
}

// Tela comum às duas separações. `campo` diz qual lista da linha mostrar (itensSeparar = PV QC; itensKit = FAB QC).
function QcSeparacaoTela({ rota, eyebrow, titulo, sub, campo, vazio, soComItens }) {
  // 'itensFab' = cabos do kit + componentes do quadro (montado aqui para a lista da linha continuar uma só).
  const itensDe = (r) => (campo === 'itensFab' ? [...r.itensKit, ...r.itensComponentes] : r[campo]);
  const ord = window.useOrdenacao();
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [peguei, setPeguei] = React.useState({});          // "<codigo_pedido>|<CODIGO>" → { por, em }
  const [erroPeguei, setErroPeguei] = React.useState(null);  // por que não leu/gravou as marcações
  const [gravando, setGravando] = React.useState(null);      // chave do item sendo gravado
  const [aberto, setAberto] = window.useRotaId(rota);   // codigo_pedido aberto (um por vez)
  // Caixa da tabela com a altura da janela: a barra de rolagem fica sempre à vista (mesma solução da tela de Pedidos).
  const caixaRef = React.useRef(null);
  const [alturaCaixa, setAlturaCaixa] = React.useState(null);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    try {
      const lista = await window.QuadrosPedidosStore.carregar(sb);
      setLinhas(lista); setErro(null);
      try { setPeguei(await window.QuadrosPedidosStore.listarPegos(sb, lista.map((r) => r.chave))); setErroPeguei(null); }
      catch (e) { setErroPeguei(qsMsgErro(e)); }
    } catch (e) { setErro((e && e.message) || String(e)); }
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    const t = setInterval(carregar, 60000);
    const vis = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);
  React.useEffect(() => {
    const ajustar = () => {
      const el = caixaRef.current;
      if (el) setAlturaCaixa(Math.max(260, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 20)));
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [linhas]);

  const chaveItem = (r, i) => window.QuadrosPedidosStore.chavePeguei(r.chave, i.codigo);
  const alternar = async (r, i) => {
    const k = chaveItem(r, i);
    if (gravando) return;
    const quer = !peguei[k];
    setGravando(k);
    try {
      const res = await window.QuadrosPedidosStore.marcar(sb, r.chave, i.codigo, quer);
      const n = { ...peguei };
      if (quer) n[k] = { por: res && res.por, em: new Date().toISOString() }; else delete n[k];
      setPeguei(n); setErroPeguei(null);
    } catch (e) {
      const msg = qsMsgErro(e);
      setErroPeguei(msg); window.toast?.('Não foi possível gravar: ' + msg);
    }
    setGravando(null);
  };
  const pegos = (r) => itensDe(r).filter((i) => peguei[chaveItem(r, i)]).length;

  const visiveis = linhas ? linhas.filter((r) => !soComItens || itensDe(r).length) : null;
  const lista = visiveis ? ord.aplicar(visiveis, { pedido: (r) => Number(r.numero), cliente: (r) => r.cliente }) : [];

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>{eyebrow}</div>
          <h1 className="page-head__title">{titulo}</h1>
          <p className="page-head__sub">{sub}</p>
        </div>
      </div>
      {erroPeguei ? <div className="card" style={{ padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--vp-danger)' }}>As marcações “Peguei” não puderam ser lidas ou gravadas: {erroPeguei}</div> : null}
      {erro ? <div className="card" style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar os pedidos: {erro}</div> : null}
      {!erro && !linhas ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div> : null}
      {linhas ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 8 }}>{visiveis.length} pedido(s)</div>
          <div ref={caixaRef} className="card table-wrap pcp-rolagem" style={{ overflow: 'auto', maxHeight: alturaCaixa || undefined }}>
            <table className="t pcp-grid">
              <thead><tr>{ord.th('pedido', 'Nº do Pedido')}{ord.th('cliente', 'Cliente')}</tr></thead>
              <tbody>
                {lista.map((r) => {
                  const abre = String(aberto) === String(r.chave);
                  const itensDoPedido = itensDe(r), n = itensDoPedido.length, p = pegos(r);
                  return (
                    <React.Fragment key={r.chave}>
                      <tr onClick={() => setAberto(abre ? null : r.chave)} style={{ cursor: 'pointer' }} aria-expanded={abre}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', width: 16, color: 'var(--fg3)' }}>{abre ? '▾' : '▸'}</span>
                          <b style={{ fontWeight: 500 }}>{r.numero}</b>
                          {r.pedido.origem === 'ordem_servico' ? <span className="pcp-tag" style={{ marginLeft: 6 }}>OS</span> : null}
                        </td>
                        <td style={{ minWidth: 260 }}>{r.cliente || '—'}</td>
                      </tr>
                      {abre ? (
                        <tr>
                          <td colSpan={2} style={{ background: 'var(--vp-gray-50)', padding: 12 }}>
                            {n ? (
                              <>
                                <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 6 }}>{p} de {n} itens pegos · {qsTotais(itensDoPedido)} no total</div>
                                <table className="t pcp-grid" style={{ background: 'var(--bg-elev, #fff)' }}>
                                  <thead><tr><th style={{ width: 120 }}>Peguei</th><th>Código</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Quantidade</th><th>Un.</th></tr></thead>
                                  <tbody>
                                    {itensDoPedido.map((i) => {
                                      const feito = !!peguei[chaveItem(r, i)];
                                      return (
                                        <tr key={i.codigo} style={feito ? { opacity: 0.6 } : undefined}>
                                          <td><label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={feito} disabled={gravando === chaveItem(r, i)} onChange={() => alternar(r, i)} aria-label={`Peguei ${i.codigo}`}/>
                                            <span style={{ fontSize: 12 }}>{feito ? 'Peguei' : ''}</span>
                                          </label>
                                          {feito && peguei[chaveItem(r, i)] ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{qsQuem(peguei[chaveItem(r, i)].por)} · {qsQuando(peguei[chaveItem(r, i)].em)}</div> : null}</td>
                                          <td><b style={{ fontWeight: 500 }}>{i.rotulo || i.codigo}</b>{i.grupo ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{i.grupo}</div> : null}</td>
                                          <td style={{ minWidth: 280 }}>{i.descricao || '—'}</td>
                                          <td style={{ textAlign: 'right' }}>{qsQtd(i.quantidade)}</td>
                                          <td>{i.unidade || '—'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </>
                            ) : <div style={{ color: 'var(--fg3)' }}>{vazio}</div>}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
                {!lista.length ? <tr><td colSpan={2} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhum pedido com quadro de comando.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

// Separação PV QC: itens da proposta que o almoxarifado separa (botões, placa de display, botão de chamada, encoder, máquina…).
function QuadrosSeparacaoPage() {
  return <QcSeparacaoTela rota="quadros-separacao" campo="itensSeparar"
    eyebrow="Quadros de Comando · Separação PV QC" titulo="Separação Pedidos de Venda Quadro de Comando"
    sub="Clique no pedido para ver o que o almoxarifado separa. Quadro, cabos (vão com o quadro), matéria-prima e serviço não entram."
    vazio="Nada para separar neste pedido (só quadro e cabos, ou serviço)." />;
}

// Separação FAB QC: o que ficou de fora da PV QC e vai com o quadro — cabo de manobra e cabos modulares (BST). Só pedidos que têm kit.
// Os componentes do quadro (inversor, placas, sensores…) vêm da observação do item no Omie (pcp_pedido_itens.obs_item, gravada por
// sync-pcp-pedidos desde 04/11/2026): uma linha por componente, quantidade da linha × nº de quadros do item. Pedido que ainda não foi
// relido pela rotina fica só com os cabos do kit.
function QuadrosSeparacaoFabPage() {
  return <QcSeparacaoTela rota="quadros-separacao-fab" campo="itensFab" soComItens
    eyebrow="Quadros de Comando · Separação FAB QC" titulo="Separação Fabricação Quadro de Comando"
    sub="Clique no pedido para ver o que vai com o quadro de comando: os cabos do kit (cabo de manobra e cabos modulares) e os componentes do quadro, como na proposta."
    vazio="Este pedido não tem kit nem componentes do quadro." />;
}

window.QuadrosSeparacaoPage = QuadrosSeparacaoPage;
window.QuadrosSeparacaoFabPage = QuadrosSeparacaoFabPage;
