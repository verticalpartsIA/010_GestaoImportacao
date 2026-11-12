/* ============================================================
   quadros-pedidos.jsx — Quadros de Comando · Pedidos (04/11/2026, pedido do Gelson).
   1ª tela do módulo 14 (Quadros de Comando). SÓ LEITURA: a linha ainda NÃO é clicável e nenhum botão grava nada.
   Quem entra na lista (a união das duas fontes; uma linha por pedido):
   - pedidos do Omie na etapa 20 (Separar estoque / produção) que têm item que é quadro de comando (pcp_quadro_variante);
   - tudo o que a Evolução da Fabricação lista: pedido de qualquer OP de quadro ativa (aguardando/em produção), inclusive
     Ordem de Serviço (pedido da OP-mãe) e proposta (etapa 00).
   - NÃO entra OP de quadro sem pedido de venda do Omie (decisão do Gelson, 04/11/2026: não se fabrica o que não é pedido de venda).
     Em 04/11 eram 7 OPs (OP-0014-Q a OP-0020-Q) de 22/10, ligadas a quadros internos já apagados, cujos pedidos do Omie
     já têm outra OP: duplicatas. Elas continuam existindo na Evolução da Fabricação; aqui só ficam fora da lista.
   Colunas Fabricação e Separação:
   - Fabricação = barra de 0 a 100%: média do % das OPs de quadro do pedido, o MESMO % da Evolução da Fabricação
     (FabricacaoQuadroCalc). Quadro do pedido que ainda não tem OP conta como 0%. Embaixo: quantos quadros e quantos itens do kit
     (cabos, inclusive o de manobra, vão junto com o quadro — decisão do Gelson, 04/11/2026).
   - Separação = SÓ O MOTOR por enquanto (o status entra depois): quantos itens da proposta o almoxarifado separa = tudo o que não é
     quadro, cabo, matéria-prima (VPMP) nem serviço (VPSVC): botões, placa de display, botão de chamada, encoder…
     Mostra linhas e unidades. Lê só pcp_pedido_itens (funciona no localhost). Regras puras em quadros-pedidos-calc.js.
   Regras que existem por motivo:
   - O número que manda é o do OMIE (pcp_pedidos.numero_pedido); nada que nasce no hub aparece como número principal.
   - "Incluído no Omie" = pcp_pedidos.data_pedido (infoCadastro.dInc); "Prazo de entrega" = data_previsao do pedido.
   - Data pura AAAA-MM-DD é formatada por texto (new Date('aaaa-mm-dd') cai um dia antes no fuso do Brasil).
   ============================================================ */

function qpData(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }

/* 10/11/2026: o link do formulário POR PEDIDO VENDIDO (coluna "Formulário do cliente") saiu desta tela, a pedido do Gelson: o link nasce na pré-venda,
   antes de o quadro existir. As respostas dos clientes agora ficam em "Formulários Respondidos" (src/formularios-respondidos.jsx). */

// Barra de 0 a 100%. `info` = { pct, sub } ou null (mostra o traço com a explicação no balão).
function QpBarra({ info, vazio, titulo }) {
  if (!info) return <span style={{ color: 'var(--fg3)' }} title={titulo || ''}>{vazio || '—'}</span>;
  return (
    <div title={titulo || ''} style={{ minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: info.pct + '%', height: '100%', background: info.pct === 100 ? 'var(--vp-success, #2e9e5b)' : 'var(--vp-yellow)' }} />
        </div>
        <b style={{ fontWeight: 500, fontSize: 12, minWidth: 36, textAlign: 'right' }}>{info.pct}%</b>
      </div>
      {info.sub ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{info.sub}</div> : null}
    </div>
  );
}

// Botão "🔗 Link público": mostra o link secreto da página pública deste tipo (pedidos | separacao | separacao_fab), com Copiar e Trocar.
// Quem só vê (alçada "ver") obtém o link já criado; criar/trocar exige "editar". Trocar invalida o link antigo (ex.: celular perdido).
function QcLinkPublico({ tipo }) {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [url, setUrl] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const abrir = async (renovar) => {
    if (renovar && !window.confirm('Trocar o link? O link atual deixa de funcionar para quem o recebeu.')) return;
    setOcupado(true); setErro(null);
    try { setUrl(await window.QuadrosPedidosStore.linkPublico(sb, tipo, renovar)); }
    catch (e) { setErro(((e && e.message) || String(e)).replace(/^.*link QC: /, '')); }
    setOcupado(false);
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(url); window.toast?.('Link copiado.'); } catch (e) { window.prompt('Copie o link:', url); } };
  if (!url) return (<span><button className="btn" onClick={() => abrir(false)} disabled={ocupado} title="Mostra o link público desta tela (sem login)">🔗 Link público</button>{erro ? <div style={{ fontSize: 11, color: 'var(--vp-danger)', maxWidth: 260 }}>{erro}</div> : null}</span>);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ width: 260, fontSize: 11 }} />
      <button className="btn" onClick={copiar}>Copiar</button>
      <button className="btn" onClick={() => abrir(true)} disabled={ocupado} title="Gera um link novo; o atual deixa de funcionar">Trocar</button>
      <button className="btn" onClick={() => setUrl(null)}>×</button>
      {erro ? <div style={{ fontSize: 11, color: 'var(--vp-danger)' }}>{erro}</div> : null}
    </div>
  );
}
window.QcLinkPublico = QcLinkPublico;

function QuadrosPedidosPage() {
  const ord = window.useOrdenacao();
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  // A caixa da tabela ocupa só o que cabe na janela: assim a barra de rolagem lateral fica sempre à vista, no pé da caixa,
  // mesmo com a lista longa (a altura fixa "tela − 190px" do .pcp-rolagem não serve: o cabeçalho desta página é mais alto).
  const caixaRef = React.useRef(null);
  const [alturaCaixa, setAlturaCaixa] = React.useState(null);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase indisponível.'); return; }
    try { setLinhas(await window.QuadrosPedidosStore.carregar(sb)); setErro(null); }
    catch (e) { setErro((e && e.message) || String(e)); }
  }, [sb]);

  React.useEffect(() => { carregar(); }, [carregar]);
  // Atualiza sozinha (a cada minuto e ao voltar para a aba), como as outras telas que leem pcp_pedidos.
  React.useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    const vis = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);

  // Recalcula a cada renderização (avisos que surgem depois da carga empurram a caixa para baixo da janela) e ao redimensionar.
  const ajustarCaixa = () => {
    const el = caixaRef.current;
    if (el) { const h = Math.max(260, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 20)); setAlturaCaixa((a) => (a === h ? a : h)); }
  };
  React.useEffect(ajustarCaixa);
  React.useEffect(() => { window.addEventListener('resize', ajustarCaixa); return () => window.removeEventListener('resize', ajustarCaixa); }, []);

  const lista = linhas ? ord.aplicar(linhas, {
    pedido: (r) => (r.numero ? Number(r.numero) : null), cliente: (r) => r.cliente, vendedor: (r) => r.vendedor,
    incluido: (r) => r.incluido, prazo: (r) => r.prazo,
    fabricacao: (r) => (r.fab ? r.fab.pct : null), separacao: (r) => (r.sep && r.sep.linhas ? r.sep.linhas : null),
  }) : [];

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Quadros de Comando · Pedidos</div>
          <h1 className="page-head__title">Pedidos com Quadro de Comando</h1>
          <p className="page-head__sub">Pedidos do Omie com quadro de comando (etapa 20) e tudo o que está na Evolução da Fabricação. O número é o do Omie. As barras vão de 0 a 100%.</p>
        </div>
        <div className="page-head__r qc-no-print" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <QcLinkPublico tipo="pedidos" />
          <button className="btn" onClick={() => window.print()} disabled={!linhas} title="Abre a impressão desta lista">🖨 Imprimir</button>
        </div>
      </div>
      <div className="qc-print-only" style={{ fontSize: 11, marginBottom: 6 }}>Impresso em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{(window.__VP_USER || {}).nome ? ` por ${(window.__VP_USER || {}).nome}` : ''}</div>
      {erro ? <div className="card" style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar os pedidos: {erro}</div> : null}
      {!erro && !linhas ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div> : null}
      {linhas ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 8 }}>
            {linhas.length} linha(s)
          </div>
          <div ref={caixaRef} className="card table-wrap pcp-rolagem qc-caixa" style={{ overflow: 'auto', maxHeight: alturaCaixa || undefined }}>
            <table className="t pcp-grid">
              <thead><tr>
                {ord.th('pedido', 'Nº do pedido')}{ord.th('cliente', 'Cliente')}{ord.th('vendedor', 'Vendedor')}
                {ord.th('incluido', 'Incluído no Omie')}{ord.th('prazo', 'Prazo de entrega')}
                {ord.th('fabricacao', 'Fabricação')}{ord.th('separacao', 'Separação')}
              </tr></thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.chave}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{r.numero}</b>
                      {r.pedido.origem === 'ordem_servico' ? <span className="pcp-tag" style={{ marginLeft: 6 }}>OS</span> : null}
                      {r.pedido.etapa !== '20' ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>etapa {r.pedido.etapa} no Omie</div> : null}
                    </td>
                    <td style={{ minWidth: 220 }}>{r.cliente || '—'}</td>
                    <td>{r.vendedor || '—'}</td>
                    <td>{qpData(r.incluido)}</td>
                    <td>{qpData(r.prazo)}</td>
                    <td><QpBarra info={r.fab} titulo="Mesmo andamento da Evolução da Fabricação (média dos quadros do pedido)" /></td>
                    <td>
                      {r.sep && r.sep.linhas
                        ? <div title="Itens da proposta que o almoxarifado separa: tudo o que não é quadro, cabo (vai com o quadro), matéria-prima (VPMP) nem serviço">
                            <b style={{ fontWeight: 500 }}>{r.sep.linhas} {r.sep.linhas === 1 ? 'item' : 'itens'}</b>
                            <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{r.sep.unidades.toLocaleString('pt-BR')} un.</div>
                          </div>
                        : <span style={{ color: 'var(--fg3)' }} title="Nada a separar neste pedido (só quadro e cabos, ou serviço)">—</span>}
                    </td>
                  </tr>
                ))}
                {!lista.length ? <tr><td colSpan={7} style={{ color: 'var(--fg3)', padding: 16 }}>Nenhum pedido com quadro de comando.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

window.QuadrosPedidosPage = QuadrosPedidosPage;
