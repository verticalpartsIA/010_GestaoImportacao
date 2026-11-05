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
   FALTA e PREVISÃO (04/11/2026): cada item mostra o estoque físico e quanto FALTA (quantidade do pedido − estoque; ex.: pede 20, tem 4, faltam 16).
   ESTOQUE REAL: o usuário digita o que há de verdade na prateleira (o sistema pode dizer 15 e não haver nada); a falta usa o real se digitado.
   O que falta pode ter PREVISÃO DE ENTREGA (data) e OBSERVAÇÕES (coluna própria), gravada em qc_separacao_previsao (migration 20261104140000), só por função com a
   mesma alçada do Peguei. Estoque desconhecido (componente do quadro, ou leitura que falhou) mostra "—", nunca zero.
   IMPRIMIR: o botão expande todos os pedidos e abre a impressão do navegador (estilos em styles/quadros-comando.css).
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
// Data 'AAAA-MM-DD' → 'dd/mm/aaaa' (sem passar por Date: evita o dia a menos do fuso).
function qsData(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
function qsQtd(n) { return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
// Total por unidade de medida ('40 M · 40 PC'): metro e peça nunca se somam.
function qsTotais(itens) {
  const m = {};
  (itens || []).forEach((i) => { const u = String(i.unidade || 'un.').toUpperCase(); m[u] = (m[u] || 0) + (Number(i.quantidade) || 0); });
  return Object.keys(m).sort().map((u) => `${qsQtd(m[u])} ${u}`).join(' · ');
}

// Número digitado ('12,5' ou '12.5') → número; vazio → null; inválido → NaN.
function qsNum(t) { const x = String(t == null ? '' : t).trim().replace(',', '.'); return x === '' ? null : Number(x); }

// As quatro células que o usuário trabalha em cada item: ESTOQUE REAL (conferido na prateleira), FALTA (recalculada com o real, se houver),
// PREVISÃO de entrega e OBSERVAÇÕES. Grava ao mudar a data e ao sair de um campo; na impressão saem só os textos.
// A falta usa o estoque real quando ele foi digitado (o sistema pode dizer 15 e na prateleira não ter nada); senão, o do sistema.
function QcCelulas({ i, atual, feito, gravando, podeGravar, onGravar }) {
  const dataRef = React.useRef(null), obsRef = React.useRef(null);
  const [real, setReal] = React.useState(atual && atual.estoque_real != null ? String(atual.estoque_real).replace('.', ',') : '');
  const n = qsNum(real);
  const efetivo = n != null && !isNaN(n) ? n : i.estoque;
  const falta = window.QuadrosPedidosCalc.calcularFalta(i.quantidade, efetivo);
  const salvar = () => {
    const v = qsNum(real);
    if (isNaN(v) || (v != null && v < 0)) { window.toast?.('Estoque real inválido: use um número de 0 em diante.'); return; }
    onGravar((dataRef.current && dataRef.current.value) || '', (obsRef.current && obsRef.current.value) || '', v);
  };
  const dis = !podeGravar || gravando;
  const precisaPrevisao = !feito && falta !== 0;      // sem falta (ou já pego) não há o que prever
  const prevTxt = atual && atual.previsao ? qsData(atual.previsao) : '';
  const campo = { fontSize: 11, padding: '2px 3px' };
  return (
    <>
      <td style={{ textAlign: 'right' }}>
        <input className="qc-no-print" type="text" inputMode="decimal" value={real} disabled={dis} onChange={(e) => setReal(e.target.value)} onBlur={salvar}
          placeholder="—" aria-label={`Estoque real de ${i.codigo}`} title="Quanto há de verdade na prateleira. Deixe em branco para usar o estoque do sistema." style={{ ...campo, width: 58, textAlign: 'right' }}/>
        <span className="qc-print-only">{real === '' ? '—' : real}</span>
      </td>
      <td style={{ textAlign: 'right', fontWeight: falta > 0 && !feito ? 600 : 400, color: falta > 0 && !feito ? 'var(--vp-danger)' : undefined }}>{feito || falta == null ? '—' : qsQtd(falta)}</td>
      <td>
        {precisaPrevisao ? (
          <>
            <input ref={dataRef} className="qc-no-print" type="date" defaultValue={(atual && atual.previsao) || ''} disabled={dis} onChange={salvar} aria-label="Previsão de entrega" style={campo}/>
            <span className="qc-print-only">{prevTxt || '—'}</span>
          </>
        ) : <span style={{ color: 'var(--fg3)' }}>—<input ref={dataRef} type="hidden" defaultValue={(atual && atual.previsao) || ''}/></span>}
      </td>
      <td style={{ minWidth: 130 }}>
        <input ref={obsRef} className="qc-no-print" type="text" maxLength={300} defaultValue={(atual && atual.obs) || ''} disabled={dis} onBlur={salvar} placeholder="Observações" aria-label="Observações" style={{ ...campo, width: '100%' }}/>
        <span className="qc-print-only">{(atual && atual.obs) || '—'}</span>
      </td>
    </>
  );
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
  const [previsoes, setPrevisoes] = React.useState({});     // o que veio do banco: "<codigo_pedido>|<CODIGO>" → { previsao, obs, estoque_real, por, em }
  const [edicoes, setEdicoes] = React.useState({});         // o que esta pessoa acabou de gravar (vale por cima do banco até a próxima leitura)
  const [imprimindo, setImprimindo] = React.useState(false); // expande todos os pedidos enquanto imprime
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
      try { setPrevisoes(await window.QuadrosPedidosStore.listarPrevisoes(sb, lista.map((r) => r.chave))); setEdicoes({}); }
      catch (e) { setErroPeguei((x) => x || qsMsgErro(e)); }
    } catch (e) { setErro((e && e.message) || String(e)); }
  }, [sb]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    const t = setInterval(carregar, 60000);
    const vis = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);
  // A altura é recalculada a cada renderização (e ao redimensionar): avisos que aparecem depois da carga empurram a caixa para baixo e,
  // com a altura calculada só uma vez, a barra de rolagem ficava para fora da janela.
  const ajustarCaixa = () => {
    const el = caixaRef.current;
    if (el) { const h = Math.max(260, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 20)); setAlturaCaixa((a) => (a === h ? a : h)); }
  };
  React.useEffect(ajustarCaixa);
  React.useEffect(() => { window.addEventListener('resize', ajustarCaixa); return () => window.removeEventListener('resize', ajustarCaixa); }, []);
  React.useEffect(() => {
    const fim = () => setImprimindo(false);
    window.addEventListener('afterprint', fim);
    return () => window.removeEventListener('afterprint', fim);
  }, []);
  const imprimir = () => { setImprimindo(true); setTimeout(() => window.print(), 250); };

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
  const [gravandoPrev, setGravandoPrev] = React.useState(null);
  const anotacao = (r, i) => { const k = chaveItem(r, i); return edicoes[k] !== undefined ? edicoes[k] : previsoes[k]; };
  const gravarPrevisao = async (r, i, data, obs, real) => {
    const k = chaveItem(r, i);
    setGravandoPrev(k);
    try {
      await window.QuadrosPedidosStore.gravarPrevisao(sb, r.chave, i.codigo, data, obs, real);
      const vazio = !data && !String(obs || '').trim() && real == null;
      setEdicoes((e) => ({ ...e, [k]: vazio ? null : { previsao: data || null, obs: String(obs || '').trim() || null, estoque_real: real, em: new Date().toISOString() } }));
      setErroPeguei(null);
    } catch (e) {
      const msg = qsMsgErro(e);
      setErroPeguei(msg); window.toast?.('Não foi possível gravar: ' + msg);
    }
    setGravandoPrev(null);
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
        <div className="page-head__r qc-no-print" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <window.QcLinkPublico tipo={campo === 'itensFab' ? 'separacao_fab' : 'separacao'} />
          <button className="btn" onClick={imprimir} disabled={!linhas} title="Abre a impressão com todos os pedidos expandidos">🖨 Imprimir</button>
        </div>
      </div>
      <div className="qc-print-only" style={{ fontSize: 11, marginBottom: 6 }}>Impresso em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{(window.__VP_USER || {}).nome ? ` por ${(window.__VP_USER || {}).nome}` : ''}</div>
      {erroPeguei ? <div className="card" style={{ padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--vp-danger)' }}>As marcações “Peguei” não puderam ser lidas ou gravadas: {erroPeguei}</div> : null}
      {erro ? <div className="card" style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar os pedidos: {erro}</div> : null}
      {!erro && !linhas ? <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div> : null}
      {linhas ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 8 }}>{visiveis.length} pedido(s)</div>
          {linhas.some((r) => r.estoqueErro) ? <div className="card qc-no-print" style={{ padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--vp-danger)' }}>Não foi possível ler o estoque ({linhas.find((r) => r.estoqueErro).estoqueErro}): as colunas Em estoque e Falta ficam em “—”.</div> : null}
          <div ref={caixaRef} className="card table-wrap pcp-rolagem qc-caixa" style={{ overflow: 'auto', maxHeight: alturaCaixa || undefined }}>
            <table className="t pcp-grid">
              <thead><tr>{ord.th('pedido', 'Nº do Pedido')}{ord.th('cliente', 'Cliente')}</tr></thead>
              <tbody>
                {lista.map((r) => {
                  const abre = imprimindo || String(aberto) === String(r.chave);
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
                          <td colSpan={2} className="qc-sub" style={{ background: 'var(--vp-gray-50)', padding: 12 }}>
                            {n ? (
                              <>
                                <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 6 }}>{p} de {n} itens pegos · {qsTotais(itensDoPedido)} no total{(() => { const nf = itensDoPedido.filter((i) => { const a = anotacao(r, i); return !peguei[chaveItem(r, i)] && window.QuadrosPedidosCalc.calcularFalta(i.quantidade, a && a.estoque_real != null ? a.estoque_real : i.estoque) > 0; }).length; return nf ? ` · ${nf} com falta de estoque` : ''; })()}</div>
                                <table className="t pcp-grid qc-itens" style={{ background: 'var(--bg-elev, #fff)' }}>
                                  <thead><tr style={{ whiteSpace: 'normal' }}><th style={{ width: 84 }}>Peguei</th><th>Código</th><th>Descrição</th><th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Qtd. pedida</th><th>Un.</th><th style={{ textAlign: 'right', whiteSpace: 'normal' }} title="Estoque físico no Omie (sistema)">Em estoque</th><th style={{ textAlign: 'right', minWidth: 64, whiteSpace: 'normal' }} title="Quanto há de verdade na prateleira (digite). Em branco = vale o do sistema">Estoque real</th><th style={{ textAlign: 'right' }} title="Quantidade do pedido − estoque (o real, se digitado)">Falta</th><th style={{ minWidth: 118 }}>Previsão</th><th style={{ minWidth: 130 }}>Observações</th></tr></thead>
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
                                          <td style={{ minWidth: 140, maxWidth: 240, fontSize: 12, whiteSpace: 'normal' }}>{i.descricao || '—'}</td>
                                          <td style={{ textAlign: 'right' }}>{qsQtd(i.quantidade)}</td>
                                          <td>{i.unidade || '—'}</td>
                                          <td style={{ textAlign: 'right' }}>{i.estoque == null ? '—' : qsQtd(i.estoque)}</td>
                                          <QcCelulas key={chaveItem(r, i) + '|' + JSON.stringify(previsoes[chaveItem(r, i)] || null)} i={i} atual={anotacao(r, i)} feito={feito}
                                            gravando={gravandoPrev === chaveItem(r, i)} podeGravar={!erroPeguei || !/acesso|permiss/i.test(erroPeguei)} onGravar={(d, o, v) => gravarPrevisao(r, i, d, o, v)} />
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
