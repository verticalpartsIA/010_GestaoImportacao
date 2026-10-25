/* ============================================================
   cotacoes-varejo.jsx — Suprimentos & Importação › Cotações de Varejo
   Lista de lotes + MAPA COMPARATIVO (produto × fornecedor). Pedido do usuário (16/10/2026): o comprador marca produtos na
   Importação Varejo e clica em "Pedir cotação"; aqui os fornecedores respondem (preço por faixa de quantidade, prazo, MOQ),
   o comprador escolhe vencedor(es) e QUANTIDADE por item (pode comprar mais ou menos que o pedido, e dividir entre
   fornecedores) e só ao APROVAR a Requisição de Compra vai ao Omie, uma por fornecedor vencedor.
   URL: /logistica/cotacoes-varejo[/<id do lote>]. window.CotacoesVarejoPage
   ============================================================ */

function cvNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function cvFmtNum(v) { return cvNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
function cvFmtMoeda(v, moeda) {
  const m = moeda === 'BRL' ? 'R$' : (moeda === 'EUR' ? '€' : 'US$');
  return m + ' ' + cvNum(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function cvFmtData(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

const CV_STATUS_LOTE = {
  rascunho: { label: 'Rascunho', variant: 'neutral' },
  em_cotacao: { label: 'Em cotação', variant: 'warning' },
  aprovado: { label: 'Aprovado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'danger' },
};
const CV_STATUS_CONVITE = {
  rascunho: { label: 'não enviado', variant: 'neutral' },
  enviado: { label: 'aguardando', variant: 'warning' },
  visualizado: { label: 'abriu o link', variant: 'info' },
  respondido: { label: 'respondeu', variant: 'success' },
};

/* ---------- Lista de lotes ---------- */
function CVLista({ onAbrir, setRoute }) {
  const [lotes, setLotes] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busca, setBusca] = React.useState(''); // 23/10 (pedido do usuário)
  const ord = window.useOrdenacao();
  const carregar = React.useCallback(() => {
    setErro(null);
    window.CotacoesVarejoStore.listarLotes().then(setLotes).catch((e) => { setErro(e.message || String(e)); setLotes([]); });
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Suprimentos · Cotações de Varejo</div>
          <h1 className="page-head__title">Cotações de Varejo</h1>
          <p className="page-head__sub">Produtos que o comprador mandou cotar na Importação Varejo. Cada lote reúne vários fornecedores no mesmo mapa comparativo; só depois da aprovação a compra vai ao Omie.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="truck" onClick={() => setRoute && setRoute('compras')}>Ir para Importação Varejo</Button>
          <Button variant="outline" icon="refresh" onClick={carregar}>Atualizar</Button>
        </div>
      </div>
      {erro && <div className="alert danger" style={{ marginBottom: 16 }}><Icon.warning /><div><div className="alert__title">Erro ao consultar</div><div className="alert__sub">{erro}</div></div></div>}
      {lotes === null ? <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando lotes…</div> : (
        <Card>
          <div style={{ display: 'flex', gap: 8, margin: '0 0 12px', flexWrap: 'wrap' }}>
            <input className="input" placeholder="Buscar por nº do lote, descrição ou quem criou…" value={busca}
              onChange={(e) => setBusca(e.target.value)} style={{ minWidth: 280 }}/>
          </div>
          <div className="table-wrap table-wrap--sticky">
            <table className="t">
              <thead><tr>
                {ord.th('lote', 'Lote')}{ord.th('descricao', 'Descrição')}{ord.th('status', 'Status')}
                {ord.th('itens', 'Itens', { className: 'text-right' })}{ord.th('fornecedores', 'Fornecedores', { className: 'text-right' })}
                {ord.th('responderam', 'Responderam', { className: 'text-right' })}{ord.th('criadoPor', 'Criado por')}{ord.th('criadoEm', 'Criado em')}
              </tr></thead>
              <tbody>
                {(() => {
                  const termo = busca.trim().toLowerCase();
                  const filtrados = !termo ? lotes : lotes.filter((l) =>
                    [l.numero, l.titulo, l.criado_por_nome, l.criado_por].some((v) => (v || '').toString().toLowerCase().includes(termo)));
                  const linhas = ord.aplicar(filtrados, {
                    lote: (l) => l.numero, descricao: (l) => l.titulo,
                    status: (l) => (CV_STATUS_LOTE[l.status] || CV_STATUS_LOTE.rascunho).label,
                    itens: (l) => l.qtdItens, fornecedores: (l) => l.qtdFornecedores, responderam: (l) => l.qtdRespondidos,
                    criadoPor: (l) => l.criado_por_nome || l.criado_por,
                    criadoEm: (l) => (l.created_at ? new Date(l.created_at).getTime() : null),
                  });
                  if (lotes.length === 0) return <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum lote ainda. Na Importação Varejo, marque os produtos e clique em "Pedir cotação".</td></tr>;
                  if (linhas.length === 0) return <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--fg3)' }}>Nenhum resultado para "{busca}".</td></tr>;
                  return linhas.map((l) => {
                    const st = CV_STATUS_LOTE[l.status] || CV_STATUS_LOTE.rascunho;
                    return (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => onAbrir(l.id)}>
                        <td className="mono"><b>{l.numero}</b></td>
                        <td>{l.titulo || '—'}</td>
                        <td><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="text-right">{l.qtdItens}</td>
                        <td className="text-right">{l.qtdFornecedores}</td>
                        <td className="text-right">{l.qtdRespondidos}/{l.qtdFornecedores}</td>
                        <td>{l.criado_por_nome || l.criado_por || '—'}</td>
                        <td>{cvFmtData(l.created_at)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Célula do fornecedor no mapa ---------- */
function CVCelula({ resp, qtdRef, melhor, editavel, valorQtd, onQtd, onTudo }) {
  const C = window.CotacoesVarejoCalc;
  const faixas = resp ? C.faixasOrdenadas(resp.faixas) : [];
  const aplicada = resp ? C.precoNaQuantidade(resp.faixas, qtdRef) : null;
  const moq = resp && resp.moq ? cvNum(resp.moq) : 0;
  const qtd = cvNum(valorQtd);
  const abaixoMoq = moq > 0 && qtd > 0 && qtd < moq;
  return (
    <div style={{ minWidth: 170, padding: '4px 2px', background: melhor ? 'rgba(34,160,90,.10)' : undefined, borderRadius: 6 }}>
      {!resp || !faixas.length ? <div className="small muted">sem preço</div> : (
        <div className="small" style={{ lineHeight: 1.45 }}>
          {faixas.map((f) => (
            <div key={f.min} style={{ fontWeight: aplicada && aplicada.min === f.min ? 800 : 400 }}>
              {cvFmtMoeda(f.preco, resp._moeda)} <span className="muted">{f.min > 1 ? '≥ ' + cvFmtNum(f.min) : 'un.'}</span>
            </div>
          ))}
          <div className="muted">{resp.lead_time_dias ? resp.lead_time_dias + ' d' : '— d'}{moq > 0 ? ' · MOQ ' + cvFmtNum(moq) : ''}</div>
          {resp.historico && resp.historico.length > 0 && (
            <div className="muted" title={resp.historico.map((h) => 'Rodada ' + h.rodada + ': ' + (h.faixas || []).map((f) => cvFmtMoeda(f.preco, resp._moeda) + (f.min > 1 ? ' (≥' + f.min + ')' : '')).join(' · ')).join('\n')}>
              rodada {resp.rodada} · antes: {cvFmtMoeda(((resp.historico[resp.historico.length - 1].faixas || [])[0] || {}).preco, resp._moeda)}
            </div>
          )}
          {aplicada && aplicada.abaixoMin && <div style={{ color: 'var(--vp-amber-700, #b45309)' }}>⚠ vende a partir de {cvFmtNum(aplicada.min)}</div>}
          {(() => { const fo = C.faixasForaDeOrdem(resp.faixas); return fo ? <div style={{ color: '#b91c1c', fontWeight: 700 }} title={'O preço sobe de ' + fo.de.preco + ' (a partir de ' + fo.de.min + ') para ' + fo.para.preco + ' (a partir de ' + fo.para.min + '). Confirme com o fornecedor.'}>⚠ preço sobe com a quantidade{fo.tipo === 'salto' ? ' (×' + (fo.para.preco / fo.de.preco).toFixed(0) + ') — confira' : ''}</div> : null; })()}
        </div>
      )}
      {resp && Array.isArray(resp.fotos_fornecedor) && resp.fotos_fornecedor.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', margin: '4px 0' }} title="Fotos do produto enviadas pelo fornecedor">
          {resp.fotos_fornecedor.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="foto do fornecedor" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border, #ccc)' }} /></a>)}
        </div>
      )}
      {resp && resp.obs && (
        <div className="small" style={{ margin: '4px 0', padding: '4px 6px', background: 'rgba(246,192,0,.15)', borderLeft: '3px solid var(--vp-yellow, #f6c000)', borderRadius: 4, maxWidth: 210, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <b>Obs. do fornecedor:</b> {resp.obs}
        </div>
      )}
      {editavel && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
          <input className="input text-right" style={{ width: 82 }} type="number" min="0" step="any" placeholder="qtd" value={valorQtd ?? ''} onChange={(e) => onQtd(e.target.value)} />
          <button className="link-btn" title="Comprar a quantidade pedida deste fornecedor" onClick={onTudo}>★</button>
        </div>
      )}
      {abaixoMoq && <div className="small" style={{ color: 'var(--vp-amber-700, #b45309)' }}>⚠ abaixo do MOQ ({cvFmtNum(moq)})</div>}
    </div>
  );
}

/* ---------- Modal: aprovar o vencedor e pedir a P.I. ---------- */
function CVModalAprovar({ resumo, cambio, onClose, onConfirmar, enviando }) {
  const nomes = Object.keys(resumo.porConvite);
  return (
    <Modal title="Aprovar o vencedor e pedir a P.I." onClose={onClose} width={720}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={enviando}>Voltar</Button>
        <Button variant="primary" icon="send" onClick={onConfirmar} disabled={enviando}>{enviando ? 'Enviando…' : 'Confirmar — é o martelo'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small">Será criada <b>1 P.I. em rascunho por fornecedor vencedor</b> (em Gestão Importação › P.I.), com os itens, quantidades e preços decididos abaixo, e enviaremos ao fornecedor, na tratativa, o <b>pedido de Proforma Invoice</b> em português, inglês e chinês. Os itens passam a constar como "Comprado" na Importação Varejo. <b>Nada vai ao Omie.</b> Depois de aprovado o lote não muda mais.{cambio > 0 ? ' Dólar da cotação: R$ ' + cvFmtNum(cambio) + '.' : ''}</p>
        {nomes.map((cid) => {
          const g = resumo.porConvite[cid];
          return (
            <div key={cid}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{g.nome} <span className="muted small">— {cvFmtMoeda(g.totalOriginal, g.moeda)}{g.totalBRL != null ? ' ≈ ' + cvFmtMoeda(g.totalBRL, 'BRL') : ''}</span></div>
              <div className="table-wrap"><table className="t">
                <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Qtd.</th><th className="text-right">Preço</th></tr></thead>
                <tbody>{g.itens.map((i) => <tr key={i.item_id}><td className="mono">{i.codigo}</td><td>{i.descricao}</td><td className="text-right">{cvFmtNum(i.quantidade)}</td><td className="text-right">{cvFmtMoeda(i.preco, g.moeda)}</td></tr>)}</tbody>
              </table></div>
            </div>
          );
        })}
        <p className="small" style={{ textAlign: 'right', fontWeight: 800 }}>Total do lote: {resumo.totalBRL != null ? cvFmtMoeda(resumo.totalBRL, 'BRL') : 'informe o câmbio'}</p>
      </div>
    </Modal>
  );
}

/* ---------- Modal: pedir a cotação aos fornecedores convidados (e-mail / WhatsApp / link) ---------- */
function CVModalPedirCotacao({ convites, forn, onClose, onEmail, onZap, onLink, onTodosEmail, enviandoTodos }) {
  const pendentes = convites.filter((cv) => cv.status === 'rascunho' && cv.email);
  return (
    <Modal title="Pedir cotação ao fornecedor" onClose={onClose} width={640}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" icon="send" onClick={onTodosEmail} disabled={!pendentes.length || enviandoTodos}>
          {enviandoTodos ? 'Enviando…' : 'Enviar por e-mail a todos que ainda não receberam (' + pendentes.length + ')'}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small">Cada fornecedor recebe um link próprio para informar preço por faixa de quantidade, prazo e quantidade mínima. Ele nunca vê os preços dos outros. Nada vai ao Omie nesta etapa.</p>
        {convites.map((cv) => {
          const s = CV_STATUS_CONVITE[cv.status] || CV_STATUS_CONVITE.rascunho;
          const f = forn.find((x) => x.id === cv.fornecedor_id);
          return (
            <div key={cv.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontWeight: 800 }}>{cv.fornecedor_nome} <Badge variant={s.variant}>{s.label}</Badge></div>
              <div className="small muted">{cv.email || 'sem e-mail no cadastro'}{f && f.telefone ? ' · ' + f.telefone : ''}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <Button variant="outline" size="sm" onClick={() => onEmail(cv)} disabled={!cv.email} title={cv.email ? '' : 'Complete o e-mail em Cadastros › Fornecedores'}>E-mail</Button>
                <Button variant="outline" size="sm" onClick={() => onZap(cv)} disabled={!(f && f.telefone)}>WhatsApp</Button>
                <Button variant="outline" size="sm" onClick={() => onLink(cv)}>Copiar link</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ---------- Modal de confirmação própria (window.confirm é bloqueado em alguns navegadores embutidos e some sem avisar) ---------- */
function CVModalConfirmar({ cfg, onClose }) {
  const [rodando, setRodando] = React.useState(false);
  const ok = async () => { setRodando(true); try { await cfg.acao(); onClose(); } catch (e) { window.toast?.(String((e && e.message) || e), 'error'); setRodando(false); } };
  return (
    <Modal title={cfg.titulo} onClose={onClose} width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={rodando}>Voltar</Button>
        <Button variant="primary" onClick={ok} disabled={rodando}>{rodando ? 'Aguarde…' : cfg.rotulo}</Button>
      </>}>
      <p className="small">{cfg.texto}</p>
    </Modal>
  );
}

/* ---------- NPS: mini-gráfico (barras por critério + evolução da nota geral) ---------- */
function NpsMini({ resumo, linhas }) {
  const S = window.CotacoesVarejoStore;
  if (!resumo) return <div className="small muted">Sem avaliações ainda.</div>;
  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1).replace('.', ','));
  const serie = (linhas || []).map((l) => Number(l.nota_geral)).filter((n) => Number.isFinite(n)).slice(-12);
  const W = 120, H = 28;
  const pts = serie.map((n, i) => (serie.length === 1 ? W / 2 : (i * W) / (serie.length - 1)).toFixed(1) + ',' + (H - 3 - (n / 5) * (H - 6)).toFixed(1)).join(' ');
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontWeight: 800 }}>★ {f1(resumo.geral)} <span className="small muted" style={{ fontWeight: 400 }}>({resumo.avaliacoes} avaliação(ões))</span></div>
      {S.NPS_CRITERIOS.map(([k, rot]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ width: 62 }}>{rot}</span>
          <span style={{ flex: 1, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: ((Number(resumo[k]) || 0) / 5 * 100) + '%', background: 'var(--vp-yellow, #f6c000)' }} /></span>
          <span style={{ width: 24, textAlign: 'right' }}>{f1(resumo[k])}</span>
        </div>
      ))}
      {serie.length > 1 && <svg width={W} height={H} style={{ marginTop: 2 }} aria-label="Evolução da nota geral"><polyline points={pts} fill="none" stroke="#111" strokeWidth="1.5" /></svg>}
    </div>
  );
}

function CVModalNPS({ lote, convite, onClose, onSalvo }) {
  const S = window.CotacoesVarejoStore;
  const [notas, setNotas] = React.useState({});
  const [coment, setComent] = React.useState('');
  const [hist, setHist] = React.useState([]);
  const [salvando, setSalvando] = React.useState(false);
  React.useEffect(() => { S.avaliacoesDoFornecedor(convite.fornecedor_id, convite.fornecedor_nome).then(setHist); }, [convite.id]);
  const resumo = hist.length ? (() => { const r = { avaliacoes: hist.length }; S.NPS_CRITERIOS.forEach(([k]) => { const v = hist.map((h) => h['nota_' + k]).filter((n) => n != null); r[k] = v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null; }); return r; })() : null;
  const salvar = async () => {
    setSalvando(true);
    try { await S.avaliarFornecedor({ lote, convite, notas, comentario: coment }); window.toast?.('Avaliação registrada.', 'success'); onSalvo && onSalvo(); onClose(); }
    catch (e) { window.toast?.(String(e.message || e), 'error'); setSalvando(false); }
  };
  return (
    <Modal title={'Avaliar ' + convite.fornecedor_nome} onClose={onClose} width={640}
      footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button><Button variant="primary" onClick={salvar} disabled={salvando || notas.geral == null}>{salvando ? 'Salvando…' : 'Registrar avaliação'}</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 190px', gap: 18 }}>
        <div className="stack" style={{ gap: 10 }}>
          <p className="small">Nota de 0 a 5 em cada critério (a geral é obrigatória). Fica no histórico do fornecedor e aparece quando você for convidá-lo em cotações futuras.</p>
          {S.NPS_CRITERIOS.map(([k, rot]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 82, fontWeight: k === 'geral' ? 800 : 400 }}>{rot}{k === 'geral' ? ' *' : ''}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setNotas((p) => ({ ...p, [k]: p[k] === n ? null : n }))} className={'btn btn--sm ' + (notas[k] === n ? 'btn--primary' : 'btn--outline')} style={{ minWidth: 34 }}>{n}</button>)}
              </div>
            </div>
          ))}
          <textarea className="input" rows={3} placeholder="Comentário (opcional) — o que foi bom ou ruim nesta cotação" value={coment} onChange={(e) => setComent(e.target.value)} />
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Histórico deste fornecedor</div>
          <NpsMini resumo={resumo} linhas={hist} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Descrição técnica do produto para o fornecedor ---------- */
function CVModalDescricao({ item, onClose, onSalvo }) {
  const S = window.CotacoesVarejoStore;
  const [d, setD] = React.useState({ aplicacao: '', equipamento: '', tensao: '', potencia: '', medidas: '', material: '', observacao: '', texto_pt: '', texto_en: '', texto_zh: '' });
  const [perguntas, setPerguntas] = React.useState([]);
  const [fontes, setFontes] = React.useState([]);
  const [bruta, setBruta] = React.useState('');
  const [ficha, setFicha] = React.useState('');
  const [web, setWeb] = React.useState(false);
  const [ia, setIa] = React.useState(false);
  const [gerando, setGerando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  React.useEffect(() => { S.obterDescricao(item.codigo).then((g) => { if (g) { const n = {}; Object.keys(g).forEach((k) => { if (g[k] != null) n[k] = g[k]; }); setD((p) => ({ ...p, ...n })); } }); }, [item.id]);
  const sugerir = async () => {
    setGerando(true);
    try {
      const r = await S.sugerirDescricaoIA({ ...d, codigo: item.codigo, descricao: item.descricao, ficha, web });
      setBruta(''); setPerguntas(r.perguntas); setFontes(r.fontes || []);
      if (r.texto_pt || r.texto_en || r.texto_zh) { setD((p) => ({ ...p, texto_pt: r.texto_pt || p.texto_pt, texto_en: r.texto_en || p.texto_en, texto_zh: r.texto_zh || p.texto_zh })); setIa(true); }
      else window.toast?.('A IA não escreveu o texto: precisa de mais dados (veja as perguntas). Cole a ficha técnica do fabricante e tente de novo.', 'warning');
    }
    catch (e) { setBruta(e.bruto || ''); window.toast?.(String(e.message || e), 'error'); }
    finally { setGerando(false); }
  };
  const salvar = async () => {
    setSalvando(true);
    try {
      await S.salvarDescricao(item.codigo, { ...d, gerado_por_ia: ia });
      await S.atualizarItem(item.id, { obs_vp: S.montarObsVP(d) || null });
      window.toast?.('Descrição salva e enviada ao lote (e guardada para os próximos).', 'success'); onSalvo && onSalvo(); onClose();
    } catch (e) { window.toast?.(String(e.message || e), 'error'); setSalvando(false); }
  };
  const campo = (k, rot, ph) => <label className="small" style={{ display: 'block' }}>{rot}<input className="input" style={{ width: '100%' }} placeholder={ph} value={d[k] || ''} onChange={(e) => set(k, e.target.value)} /></label>;
  const texto = (k, rot) => <label className="small" style={{ display: 'block' }}>{rot}<textarea className="input" rows={4} style={{ width: '100%' }} value={d[k] || ''} onChange={(e) => set(k, e.target.value)} /></label>;
  return (
    <Modal title={'Descrição para o fornecedor — ' + item.codigo} onClose={onClose} width={820}
      footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button><Button variant="primary" onClick={salvar} disabled={salvando || !(d.texto_pt || d.texto_en || d.texto_zh)}>{salvando ? 'Salvando…' : 'Salvar descrição'}</Button></>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small">Nossa descrição no Omie: <b>{item.descricao || '—'}</b>. Conte ao fornecedor onde a peça é usada e o que importa; a IA monta o texto em português, inglês e chinês. Você revisa antes de salvar — o que o fornecedor lê é o texto final.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {campo('aplicacao', 'Onde é aplicada', 'ex.: roldana do carro, porta de cabine…')}
          {campo('equipamento', 'Tipo de equipamento', 'elevador, escada rolante, esteira…')}
          {campo('tensao', 'Tensão', 'ex.: 220 VAC')}
          {campo('potencia', 'Potência', 'ex.: 0,75 kW')}
          {campo('medidas', 'Medidas', 'ex.: Ø 160 × 20 mm, furo 12 mm')}
          {campo('material', 'Material / acabamento', 'ex.: aço 304, nylon…')}
        </div>
        {campo('observacao', 'Observação nossa', 'qualquer detalhe que ajude o fornecedor a entender')}
        <label className="small" style={{ display: 'block' }}>Ficha técnica / texto do fabricante (cole aqui — é a melhor fonte para a IA)<textarea className="input" rows={5} style={{ width: '100%' }} placeholder="Cole o catálogo, a página do fabricante ou a descrição do fornecedor. A IA usa isto como base e não inventa além disso." value={ficha} onChange={(e) => setFicha(e.target.value)} /></label>
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} /> Tentar pesquisar na internet (só funciona se a IA da VPS tiver acesso à web; ela diz se não tiver)</label>
        <div><Button variant="outline" icon="send" onClick={sugerir} disabled={gerando}>{gerando ? 'A IA está escrevendo…' : 'Sugerir com IA'}</Button> <span className="small muted">usa o Copiloto da VPS (20 perguntas por hora por pessoa)</span></div>
        {bruta && <div className="alert warning"><div><div className="alert__title">O que a IA respondeu</div><div className="alert__sub" style={{ whiteSpace: 'pre-wrap' }}>{bruta}</div></div></div>}
        {fontes.length > 0 && <div className="small">Fontes usadas pela IA: {fontes.map((f, i) => <span key={i}>{i ? ' · ' : ''}{/^https?:\/\//.test(f) ? <a href={f} target="_blank" rel="noopener noreferrer">{f}</a> : f}</span>)}</div>}
        {perguntas.length > 0 && <div className="alert warning"><div><div className="alert__title">A IA precisa saber</div><div className="alert__sub">{perguntas.map((q, i) => <div key={i}>• {q}</div>)} Responda nos campos acima (ou cole a ficha) e peça a sugestão de novo.</div></div></div>}
        {texto('texto_en', 'English (o fornecedor lê primeiro)')}
        {texto('texto_zh', '中文')}
        {texto('texto_pt', 'Português (nosso)')}
      </div>
    </Modal>
  );
}

/* ---------- Detalhe do lote: mapa comparativo ---------- */
function CVDetalhe({ loteId, onVoltar, setRoute }) {
  const C = window.CotacoesVarejoCalc; const S = window.CotacoesVarejoStore;
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [qtd, setQtd] = React.useState({});            // 'item|convite' -> texto
  const [cambio, setCambio] = React.useState('');
  const [forn, setForn] = React.useState([]);
  const [novoForn, setNovoForn] = React.useState('');
  const [podeGerenciar, setPodeGerenciar] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [aprovando, setAprovando] = React.useState(false);
  const [modalAprovar, setModalAprovar] = React.useState(false);
  const [confirmar, setConfirmar] = React.useState(null);   // { titulo, texto, rotulo, acao }
  const [modalPedir, setModalPedir] = React.useState(false);
  const [enviandoTodos, setEnviandoTodos] = React.useState(false);
  const [sujo, setSujo] = React.useState(false);
  const [descItem, setDescItem] = React.useState(null);        // item cuja descrição p/ fornecedor está aberta
  const [npsConvite, setNpsConvite] = React.useState(null);    // convite sendo avaliado
  const [npsMap, setNpsMap] = React.useState({});
  const [busca, setBusca] = React.useState('');
  const [limite, setLimite] = React.useState(50);
  const [substituir, setSubstituir] = React.useState(null);   // convite que está sendo substituído
  const [subForn, setSubForn] = React.useState('');
  const [subMotivo, setSubMotivo] = React.useState('');
  const fotosTentadas = React.useRef(false);

  React.useEffect(() => { window.PropostaStore?.temCapacidade?.('cotacoes-varejo', 'criar').then(setPodeGerenciar).catch(() => setPodeGerenciar(false)); }, []);
  React.useEffect(() => { S.fornecedoresCadastrados().then(setForn).catch(() => setForn([])); }, []);

  const carregar = React.useCallback(async () => {
    try {
      const d = await S.obterLote(loteId);
      if (!d) { setErro('Lote não encontrado.'); return; }
      setDados(d);
      const m = {}; d.decisoes.forEach((x) => { m[x.item_id + '|' + x.convite_id] = String(x.quantidade); });
      setQtd(m); setSujo(false);
      setCambio((c) => c || (d.lote.cambio_usd_brl ? String(d.lote.cambio_usd_brl) : ''));
      return d;
    } catch (e) { setErro(e.message || String(e)); }
  }, [loteId]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // Câmbio sugerido (USD/BRL do dia) quando o lote ainda não tem um.
  React.useEffect(() => {
    if (!dados || !window.CambioAPI) return;
    window.CambioAPI.buscarUsdBrl().then((r) => {
      S.registrarCambioDia(r.valor);   // a resposta do fornecedor herda o dólar do dia (trigger no banco)
      if (!dados.lote.cambio_usd_brl) setCambio((c) => c || String(Number(r.valor).toFixed(4)));
    }).catch(() => {});
  }, [dados && dados.lote.id]);

  const carregarNps = React.useCallback(() => { S.npsDosFornecedores().then(setNpsMap).catch(() => {}); }, []);
  React.useEffect(() => { carregarNps(); }, [carregarNps]);
  // Descrições técnicas já guardadas do produto entram sozinhas nos itens sem observação (uma vez por abertura).
  const descTentadas = React.useRef(false);
  React.useEffect(() => {
    if (!dados || descTentadas.current || !podeGerenciar || !['rascunho', 'em_cotacao'].includes(dados.lote.status)) return;
    descTentadas.current = true;
    S.aplicarDescricoesGuardadas(dados.itens).then((n) => { if (n) carregar(); }).catch(() => {});
  }, [dados && dados.lote.id, podeGerenciar]);

  // Fotos: procura no banco / traz da Ficha Técnica uma vez por abertura.
  React.useEffect(() => {
    if (!dados || fotosTentadas.current) return;
    if (dados.itens.some((i) => !i.foto_url || !i.foto_url2)) { fotosTentadas.current = true; S.resolverFotos(dados.lote.id, dados.itens).then(() => carregar()).catch(() => {}); }
  }, [dados && dados.lote.id]);

  if (erro) return <div className="page fade-in"><div className="alert danger"><Icon.warning /><div><div className="alert__title">Erro</div><div className="alert__sub">{erro}</div></div></div><Button variant="outline" onClick={onVoltar}>← Voltar</Button></div>;
  if (!dados) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando lote…</div>;

  const { lote, itens, convites, respostasMap } = dados;
  const aberto = lote.status === 'rascunho' || lote.status === 'em_cotacao';
  const editavel = podeGerenciar && aberto;
  const st = CV_STATUS_LOTE[lote.status] || CV_STATUS_LOTE.rascunho;
  const respDe = (cid, iid) => { const r = respostasMap[cid + '|' + iid]; const cv = convites.find((x) => x.id === cid); return r ? { ...r, _moeda: cv && cv.moeda } : null; };

  const decisoesAtuais = [];
  Object.keys(qtd).forEach((k) => { const [item_id, convite_id] = k.split('|'); if (cvNum(qtd[k]) > 0) decisoesAtuais.push({ item_id, convite_id, quantidade: cvNum(qtd[k]) }); });
  const cambioNum = cvNum(String(cambio).replace(',', '.'));
  const calc = C.consolidarPorFornecedor(itens, decisoesAtuais, respostasMap, convites, cambioNum);
  const resumoModal = { totalBRL: calc.totalBRL, porConvite: {} };
  Object.keys(calc.porConvite).forEach((cid) => { const cv = convites.find((x) => x.id === cid); resumoModal.porConvite[cid] = { ...calc.porConvite[cid], nome: cv.fornecedor_nome, moeda: cv.moeda }; });

  const setQ = (iid, cid, v) => { setQtd((p) => ({ ...p, [iid + '|' + cid]: v })); setSujo(true); };
  const salvar = async (silencioso) => {
    setSalvando(true);
    try {
      await S.salvarDecisoes(lote.id, decisoesAtuais);
      if (cambioNum > 0 && cambioNum !== Number(lote.cambio_usd_brl || 0)) await S.atualizarLote(lote.id, { cambio_usd_brl: cambioNum, cambio_cotacao_em: new Date().toISOString(), cambio_fonte: 'informado' });
      if (!silencioso) window.toast?.('Decisões salvas.', 'success');
      await carregar();
    } catch (e) { window.toast?.('Erro ao salvar: ' + (e.message || e), 'error'); throw e; }
    finally { setSalvando(false); }
  };

  const convidar = async () => {
    const f = forn.find((x) => x.id === novoForn); if (!f) return;
    try { await S.convidarFornecedor(lote.id, f); setNovoForn(''); await carregar(); } catch (e) { window.toast?.(e.message || String(e), 'error'); }
  };
  const semQtd = itens.filter((i) => !(cvNum(i.quantidade_pedida) > 0));
  const travaQtd = () => {
    if (!semQtd.length) return false;
    window.toast?.('Informe a quantidade de ' + semQtd.length + ' produto(s) antes de pedir a cotação (' + semQtd.slice(0, 3).map((i) => i.codigo).join(', ') + (semQtd.length > 3 ? '…' : '') + '). O fornecedor precisa saber quanto queremos.', 'warning');
    return true;
  };
  const enviarEmail = async (cv) => {
    if (travaQtd()) return;
    try {
      const r = await S.enviarPorEmail(lote, cv);
      if (r.semEmail) { window.toast?.('Este fornecedor não tem e-mail no cadastro. Use "Link" ou "WhatsApp", ou complete o cadastro.', 'warning'); return; }
      if (r.enviouDireto) window.toast?.('E-mail enviado para ' + cv.email + '.', 'success');
      else { window.toast?.('Não consegui enviar direto — abrindo seu programa de e-mail.', 'warning'); window.open(r.mailto, '_blank'); }
      await carregar();
    } catch (e) { window.toast?.('Erro ao enviar: ' + (e.message || e), 'error'); }
  };
  const enviarTodosEmail = async () => {
    if (travaQtd()) return;
    setEnviandoTodos(true);
    let ok = 0, falha = 0;
    try {
      for (const cv of convites.filter((x) => x.status === 'rascunho' && x.email)) {
        try { const r = await S.enviarPorEmail(lote, cv); if (r.enviouDireto) ok++; else falha++; } catch (e) { falha++; }
      }
      window.toast?.(ok + ' e-mail(s) enviado(s)' + (falha ? ' · ' + falha + ' não saiu(ram) — use "Copiar link" ou WhatsApp nesses.' : '.'), falha ? 'warning' : 'success');
      await carregar();
    } finally { setEnviandoTodos(false); }
  };
  const copiarLink = async (cv) => {
    if (travaQtd()) return;
    const link = S.portalUrl(cv.token);
    try { await navigator.clipboard.writeText(link); window.toast?.('Link copiado.', 'success'); } catch (e) { window.prompt('Copie o link:', link); }
    try { await S.marcarEnviado({ ...cv, lote_id: lote.id }, 'link'); await carregar(); } catch (e) {}
  };
  const zap = async (cv) => {
    if (travaQtd()) return;
    const f = forn.find((x) => x.id === cv.fornecedor_id); const tel = f && f.telefone;
    if (!tel) { window.toast?.('Sem telefone no cadastro deste fornecedor.', 'warning'); return; }
    window.open(S.whatsAppHref(tel, lote, cv), '_blank');
    try { await S.marcarEnviado({ ...cv, lote_id: lote.id }, 'whatsapp', tel); await carregar(); } catch (e) {}
  };
  const rodada = async (cv) => { try { await S.novaRodada(cv); window.toast?.('Nova rodada aberta — reenvie o link ao fornecedor.', 'success'); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };
  const tirar = (cv) => setConfirmar({
    titulo: 'Remover fornecedor do lote', rotulo: 'Remover fornecedor',
    texto: 'Remover ' + cv.fornecedor_nome + ' deste lote? Ele sai do mapa e as quantidades que você digitou para ele são zeradas. O link que ele recebeu deixa de funcionar. O que ele respondeu e as conversas continuam guardados em "Fornecedores removidos" — nada é apagado. Para trocar por outro, use "Substituir".',
    acao: async () => {
      await S.removerConvite(cv.id, 'Removido pelo comprador');
      setQtd((p) => { const n = {}; Object.keys(p).forEach((k) => { if (k.split('|')[1] !== cv.id) n[k] = p[k]; }); return n; });
      window.toast?.(cv.fornecedor_nome + ' removido do lote.', 'success');
      await carregar();
    },
  });
  const cancelarLoteConfirmado = () => setConfirmar({
    titulo: 'Cancelar este lote', rotulo: 'Cancelar o lote',
    texto: 'Cancelar o lote ' + lote.numero + '? Ele sai da lista e os produtos deixam de aparecer "em cotação". Nada é enviado ao Omie.',
    acao: async () => { await S.cancelarLote(lote.id); window.toast?.('Lote ' + lote.numero + ' cancelado.', 'success'); onVoltar(); },
  });
  const trocarFoto = async (item, file) => {
    if (!file) return;
    try { const url = await S.enviarFoto(item.codigo, file); await S.atualizarItem(item.id, { foto_url: url }); await carregar(); window.toast?.('Foto salva no banco de fotos (' + item.codigo + ').', 'success'); }
    catch (e) { window.toast?.('Erro ao salvar a foto: ' + (e.message || e), 'error'); }
  };
  const addFotosManuais = async (item, files) => {
    let atual = item;
    try {
      for (const f of Array.from(files || [])) {
        if ((atual.fotos_manuais || []).length >= S.MAX_FOTOS_MANUAIS) { window.toast?.('Máximo de ' + S.MAX_FOTOS_MANUAIS + ' fotos manuais — as demais foram ignoradas.', 'warning'); break; }
        atual = { ...atual, fotos_manuais: await S.adicionarFotoManual(atual, f) };
      }
      await carregar();
    } catch (e) { window.toast?.('Erro ao enviar a foto: ' + (e.message || e), 'error'); await carregar(); }
  };
  const tirarFotoManual = async (item, url) => {
    if (!window.confirm('Remover esta foto?')) return;
    try { await S.removerFotoManual(item, url); await carregar(); } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
  };
  const editarItem = async (item, campo, valor) => { try { await S.atualizarItem(item.id, { [campo]: valor }); await carregar(); } catch (e) { window.toast?.(String(e.message || e), 'error'); } };
  const tirarItem = (item) => setConfirmar({
    titulo: 'Tirar produto do lote', rotulo: 'Tirar produto',
    texto: 'Tirar ' + item.codigo + ' deste lote? Ele sai do mapa e da cotação; as respostas já dadas pelos fornecedores ficam guardadas no histórico.',
    acao: async () => { await S.removerItem(item.id); await carregar(); },
  });

  const aprovar = async () => {
    setAprovando(true);
    try {
      await salvar(true);
      const d = await S.obterLote(lote.id);
      const res = await S.aprovarLote(d);
      if (res.erros.length) window.toast?.('Atenção: ' + res.erros.join(' | ') + (res.completo ? '' : ' — corrija e aprove de novo; o que já foi criado não se repete.'), 'warning');
      else window.toast?.('Lote aprovado. P.I. em rascunho criada(s): ' + res.requisicoes.map((r) => r.pi_numero).join(', ') + '. Acompanhe a Proforma na RFQ Importação.', 'success');
      setModalAprovar(false); await carregar();
    } catch (e) { window.toast?.('Erro ao aprovar: ' + (e.message || e), 'error'); }
    finally { setAprovando(false); }
  };

  const fornecedoresLivres = forn.filter((f) => !convites.some((c) => c.fornecedor_id === f.id));
  const termo = busca.trim().toLowerCase();
  const itensFiltrados = termo ? itens.filter((i) => ((i.codigo || '') + ' ' + (i.descricao || '')).toLowerCase().includes(termo)) : itens;
  const itensVisiveis = itensFiltrados.slice(0, limite);
  const chaveNps = (cv) => npsMap[cv.fornecedor_id] || npsMap[String(cv.fornecedor_nome || '').toLowerCase()] || null;
  const abrirSubstituir = (cv) => { setSubstituir(cv); setSubForn(''); setSubMotivo(''); };
  const confirmarSubstituir = async () => {
    const f = forn.find((x) => x.id === subForn); if (!f || !substituir) return;
    try {
      await S.substituirConvite(lote.id, substituir, f, subMotivo.trim() || null);
      setQtd((p) => { const n = {}; Object.keys(p).forEach((k) => { if (k.split('|')[1] !== substituir.id) n[k] = p[k]; }); return n; });
      window.toast?.(substituir.fornecedor_nome + ' substituído por ' + (f.nome_fantasia || f.razao_social) + '. Envie a cotação ao novo fornecedor.', 'success');
      setSubstituir(null); await carregar();
    } catch (e) { window.toast?.(String(e.message || e), 'error'); }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Suprimentos · Cotações de Varejo</div>
          <h1 className="page-head__title">{lote.numero} <Badge variant={st.variant}>{st.label}</Badge></h1>
          <p className="page-head__sub">{lote.titulo ? lote.titulo + ' · ' : ''}Criado por {lote.criado_por_nome || lote.criado_por || '—'} em {cvFmtData(lote.created_at)}. Em cada célula digite a quantidade que vai comprar daquele fornecedor (pode dividir, e pode ser mais ou menos que o pedido).</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" onClick={onVoltar}>← Lotes</Button>
          {editavel && sujo && <Button variant="outline" icon="check" onClick={() => salvar(false)} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar decisões'}</Button>}
          {editavel && <Button variant={convites.some((c) => c.status !== 'rascunho') ? 'outline' : 'primary'} icon="send" onClick={() => { if (!travaQtd()) setModalPedir(true); }} disabled={!convites.length} title={convites.length ? '' : 'Convide ao menos um fornecedor abaixo'}>Pedir cotação ao fornecedor</Button>}
          {editavel && <Button variant={convites.some((c) => c.status !== 'rascunho') ? 'primary' : 'outline'} icon="check" onClick={() => setModalAprovar(true)} disabled={!decisoesAtuais.length} title={decisoesAtuais.length ? '' : 'Só depois que os fornecedores responderem e você digitar as quantidades a comprar'}>Aprovar vencedor e pedir P.I.</Button>}
          {editavel && <Button variant="ghost" onClick={cancelarLoteConfirmado}>Cancelar lote</Button>}
        </div>
      </div>

      {lote.status === 'aprovado' && (
        <div className="alert success" style={{ marginBottom: 16 }}><Icon.check /><div><div className="alert__title">Lote aprovado em {cvFmtData(lote.aprovado_em)}</div>
          <div className="alert__sub">{(lote.requisicoes || []).map((r) => r.pi_numero ? r.fornecedor + ' → P.I. em rascunho ' + r.pi_numero + ' (' + r.itens + ' itens' + (r.proforma === 'enviada' ? ', Proforma pedida' : r.proforma ? ', Proforma: ver tratativa' : '') + ')' : r.fornecedor + ' → requisição ' + r.req_omie + ' (' + r.itens + ' itens)').join(' · ') || '—'}</div></div></div>
      )}

      <Card title="Fornecedores convidados" sub="Só fornecedores já cadastrados em Cadastros › Fornecedores. Cada um recebe um link próprio e nunca vê os preços dos outros.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {lote.cambio_usd_brl && <div className="small" style={{ flexBasis: '100%' }}><b>Dólar da cotação:</b> R$ {Number(lote.cambio_usd_brl).toFixed(4).replace('.', ',')}{lote.cambio_cotacao_em ? ' · fixado em ' + cvFmtData(lote.cambio_cotacao_em) : ' · ainda não fixado (fixa no 1º envio)'}{lote.cambio_fonte === 'ptax' ? ' · PTAX do dia' : lote.cambio_fonte === 'informado' ? ' · informado por você' : ''}</div>}
          {convites.length === 0 && <span className="small muted">Nenhum fornecedor convidado ainda.</span>}
          {convites.map((cv) => {
            const s = CV_STATUS_CONVITE[cv.status] || CV_STATUS_CONVITE.rascunho;
            return (
              <div key={cv.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: '8px 10px', minWidth: 230 }}>
                <div style={{ fontWeight: 800 }}>{cv.fornecedor_nome} <Badge variant={s.variant}>{s.label}</Badge></div>
                <div className="small muted">{cv.moeda} · rodada {cv.rodada}{cv.respondido_em ? ' · respondeu ' + cvFmtData(cv.respondido_em) : ''}</div>
                {(() => { const n = chaveNps(cv); return <div className="small" style={{ cursor: 'pointer' }} onClick={() => setNpsConvite(cv)} title="Ver e registrar a avaliação (NPS) deste fornecedor">{n ? '★ ' + Number(n.geral).toFixed(1).replace('.', ',') + ' · ' + n.avaliacoes + ' aval.' : 'sem avaliação'} <span style={{ color: 'var(--vp-info, #1d6fd1)' }}>{(cv.status === 'respondido' || lote.status === 'aprovado') ? '· avaliar' : '· ver'}</span></div>; })()}
                {(() => {
                  const rs = (dados.respostas || []).filter((r) => r.convite_id === cv.id && r.cambio_resposta).sort((a, b) => String(b.cambio_resposta_em).localeCompare(String(a.cambio_resposta_em)));
                  if (!rs.length) return null;
                  const base = Number(lote.cambio_usd_brl) || 0; const d = base > 0 ? (Number(rs[0].cambio_resposta) / base - 1) * 100 : null;
                  return <div className="small muted" title="Dólar do dia em que o fornecedor respondeu, comparado ao dólar fixado na cotação">Dólar na resposta: R$ {Number(rs[0].cambio_resposta).toFixed(4).replace('.', ',')}{d != null ? ' (' + (d >= 0 ? '+' : '') + d.toFixed(1).replace('.', ',') + '% vs. cotação)' : ''}</div>;
                })()}
                {editavel && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <button className="link-btn" onClick={() => enviarEmail(cv)}>E-mail</button>
                    <button className="link-btn" onClick={() => zap(cv)}>WhatsApp</button>
                    <button className="link-btn" onClick={() => copiarLink(cv)}>Link</button>
                    {cv.status === 'respondido' && <button className="link-btn" onClick={() => rodada(cv)} title="Pede ao fornecedor que atualize os preços (2ª rodada de negociação)">Nova rodada</button>}
                    <Button variant="outline" size="sm" onClick={() => abrirSubstituir(cv)} title="Troca este fornecedor por outro cadastrado; o antigo fica no histórico">Substituir</Button>
                    <Button variant="outline" size="sm" onClick={() => tirar(cv)} title="Tira este fornecedor do lote (para trocar por outro ou desistir de cotar com ele)">Remover fornecedor</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {editavel && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <select className="input" style={{ minWidth: 260 }} value={novoForn} onChange={(e) => setNovoForn(e.target.value)}>
              <option value="">Convidar fornecedor cadastrado…</option>
              {fornecedoresLivres.map((f) => { const n = npsMap[f.id]; return <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}{n ? ' ★' + Number(n.geral).toFixed(1).replace('.', ',') : ''}{f.email ? '' : ' (sem e-mail)'}</option>; })}
            </select>
            <Button variant="outline" size="sm" onClick={convidar} disabled={!novoForn}>Convidar</Button>
            <button className="link-btn" onClick={() => { if (setRoute) { setRoute('cadastro-fornecedores'); return; } try { window.VpRouter.navigate('cadastro-fornecedores'); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) { window.location.href = '/cadastros/cadastro-fornecedores'; } }} title="Fornecedor novo precisa existir no cadastro antes de entrar no lote">+ Cadastrar novo fornecedor</button>
            <div className="spacer" style={{ flex: 1 }} />
            <label className="small">Câmbio USD/BRL do lote&nbsp;
              <input className="input text-right" style={{ width: 90 }} value={cambio} onChange={(e) => { setCambio(e.target.value); setSujo(true); }} />
            </label>
          </div>
        )}
      </Card>

      {semQtd.length > 0 && editavel && (
        <div className="alert warning" style={{ marginTop: 12 }}><Icon.warning /><div><div className="alert__title">{semQtd.length} produto(s) sem quantidade</div><div className="alert__sub">Estes itens não tinham sugestão de compra. Preencha a coluna "Qtd. pedida" (campo amarelo) antes de enviar a cotação.</div></div></div>
      )}
      {(dados.convitesRemovidos || []).length > 0 && (
        <>
          <div style={{ height: 12 }} />
          <Card title="Fornecedores removidos ou substituídos (histórico)" sub="Ficam guardados: respostas, preços e conversas não se perdem. O link que receberam deixou de funcionar.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {dados.convitesRemovidos.map((cv) => {
                const nResp = (dados.respostas || []).filter((r) => r.convite_id === cv.id).length;
                const novo = dados.convites.find((x) => x.substitui_convite_id === cv.id);
                return (
                  <div key={cv.id} style={{ border: '1px dashed var(--border, #cbd5e1)', borderRadius: 8, padding: '8px 10px', minWidth: 230, opacity: .85 }}>
                    <div style={{ fontWeight: 800 }}>{cv.fornecedor_nome} <Badge variant="neutral">removido</Badge></div>
                    <div className="small muted">{cvFmtData(cv.removido_em)}{cv.removido_por ? ' · ' + cv.removido_por : ''}</div>
                    <div className="small">{cv.removido_motivo || '—'}{novo ? ' → substituído por ' + novo.fornecedor_nome : ''}</div>
                    <div className="small muted">{nResp} resposta(s) guardada(s){cv.respondido_em ? ' · respondeu ' + cvFmtData(cv.respondido_em) : ''}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      <div style={{ height: 12 }} />
      <Card title="Mapa comparativo" sub={convites.length ? 'Verde = menor preço para a quantidade em questão. ★ = comprar a quantidade pedida deste fornecedor.' : 'Convide fornecedores acima para montar o comparativo.'}>
        <style>{'.cv-mapa thead th{position:sticky;top:0;z-index:3;background:var(--surface,#fff)}'}</style>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ minWidth: 280 }} placeholder="Buscar produto por código ou descrição…" value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(50); }} />
          <span className="small muted">{itensFiltrados.length === itens.length ? itens.length + ' produto(s)' : itensFiltrados.length + ' de ' + itens.length + ' produto(s)'}</span>
        </div>
        <div className="table-wrap" style={{ overflow: 'auto', maxHeight: '75vh' }}>
          <table className="t cv-mapa">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Foto</th><th>Código</th><th>Descrição</th><th className="text-right">Qtd. pedida</th>
                {convites.map((cv) => <th key={cv.id}>{cv.fornecedor_nome}<div className="small muted" style={{ fontWeight: 400 }}>{cv.moeda}</div></th>)}
                <th className="text-right">Comprar</th>
              </tr>
            </thead>
            <tbody>
              {itensVisiveis.map((it) => {
                const decs = decisoesAtuais.filter((d) => d.item_id === it.id);
                const comprada = decs.reduce((a, d) => a + d.quantidade, 0);
                const qtdRef = comprada > 0 ? comprada : cvNum(it.quantidade_pedida);
                const respostasItem = {}; convites.forEach((cv) => { respostasItem[cv.id] = respDe(cv.id, it.id); });
                const melhor = C.melhorConvite(respostasItem, qtdRef);
                const dif = comprada - cvNum(it.quantidade_pedida);
                return (
                  <tr key={it.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 190, marginBottom: 4 }}>
                        {(it.fotos_manuais || []).map((u) => (
                          <span key={u} style={{ position: 'relative' }}>
                            <a href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={it.codigo + ' (manual)'} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--vp-yellow, #f6c000)' }} /></a>
                            {editavel && <button type="button" title="Remover esta foto" onClick={() => tirarFotoManual(it, u)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 0, background: '#c00', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>}
                          </span>
                        ))}
                      </div>
                      {editavel && (it.fotos_manuais || []).length < S.MAX_FOTOS_MANUAIS && (
                        <label className="small" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 4, color: 'var(--vp-info, #1d6fd1)' }} title="Até 5 fotos manuais por produto (o fornecedor vê junto com as do banco)">
                          + foto manual ({(it.fotos_manuais || []).length}/{S.MAX_FOTOS_MANUAIS})
                          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addFotosManuais(it, e.target.files); e.target.value = ''; }} />
                        </label>
                      )}
                      <label style={{ cursor: editavel ? 'pointer' : 'default' }} title={editavel ? 'Trocar a foto (fica no banco de fotos, nomeada pelo código)' : ''}>
                        {it.foto_url ? <span style={{ display: 'inline-flex', gap: 4 }}><img src={it.foto_url} alt={it.codigo} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />{it.foto_url2 && <img src={it.foto_url2} alt={it.codigo + ' (2)'} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />}</span> :<div style={{ width: 52, height: 52, border: '1px dashed var(--border, #ccc)', borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--fg3)' }}>sem foto</div>}
                        {editavel && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => trocarFoto(it, e.target.files && e.target.files[0])} />}
                      </label>
                    </td>
                    <td className="mono">{it.codigo}</td>
                    <td style={{ maxWidth: 260 }}>
                      {it.descricao}
                      {editavel
                        ? <>
                            <textarea key={it.obs_vp || ''} className="input" rows={(it.obs_vp || '').length > 90 ? 3 : 1} style={{ width: '100%', marginTop: 4, fontSize: 12 }} placeholder="Obs. VerticalParts (o fornecedor lê no portal)" defaultValue={it.obs_vp || ''} onBlur={(e) => { if ((e.target.value || '') !== (it.obs_vp || '')) editarItem(it, 'obs_vp', e.target.value || null); }} />
                            <button className="link-btn" onClick={() => setDescItem(it)} title="Descrição técnica em português, inglês e chinês, com ajuda da IA">{it.obs_vp ? '✎ descrição EN/中文' : '+ descrição EN/中文 (com IA)'}</button>
                          </>
                        : (it.obs_vp ? <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{it.obs_vp}</div> : null)}
                    </td>
                    <td className="text-right">
                      {editavel
                        ? <input className="input text-right" style={{ width: 80, ...(cvNum(it.quantidade_pedida) > 0 ? {} : { borderColor: '#d97706', background: '#fffbeb' }) }} placeholder="a definir" title={cvNum(it.quantidade_pedida) > 0 ? '' : 'Sem sugestão de compra: informe a quantidade que queremos cotar'} type="number" min="1" step="any" defaultValue={cvNum(it.quantidade_pedida) > 0 ? it.quantidade_pedida : ''} onBlur={(e) => { const v = cvNum(e.target.value); if (v > 0 && v !== cvNum(it.quantidade_pedida)) editarItem(it, 'quantidade_pedida', v); }} />
                        : cvFmtNum(it.quantidade_pedida)}
                      {editavel && <div><button className="link-btn muted" onClick={() => tirarItem(it)}>tirar</button></div>}
                    </td>
                    {convites.map((cv) => (
                      <td key={cv.id}>
                        <CVCelula resp={respDe(cv.id, it.id)} qtdRef={qtdRef} melhor={melhor === cv.id} editavel={editavel}
                          valorQtd={qtd[it.id + '|' + cv.id]} onQtd={(v) => setQ(it.id, cv.id, v)} onTudo={() => setQ(it.id, cv.id, String(it.quantidade_pedida))} />
                      </td>
                    ))}
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <b>{cvFmtNum(comprada)}</b>
                      {comprada > 0 && dif !== 0 && <div className="small" style={{ color: dif > 0 ? 'var(--vp-success, #15803d)' : 'var(--vp-amber-700, #b45309)' }}>{dif > 0 ? '+' : ''}{cvFmtNum(dif)} vs pedido</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {convites.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight: 800 }}>Total por fornecedor</td>
                  {convites.map((cv) => { const g = calc.porConvite[cv.id]; return <td key={cv.id}>{g ? <><b>{cvFmtMoeda(g.totalOriginal, cv.moeda)}</b>{g.totalBRL != null && cv.moeda !== 'BRL' && <div className="small muted">≈ {cvFmtMoeda(g.totalBRL, 'BRL')}</div>}</> : <span className="muted">—</span>}</td>; })}
                  <td className="text-right"><b>{calc.totalBRL != null ? cvFmtMoeda(calc.totalBRL, 'BRL') : (cambioNum > 0 ? '—' : 'informe o câmbio')}</b></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {itensFiltrados.length > itensVisiveis.length && (
          <div style={{ textAlign: 'center', marginTop: 8 }}><Button variant="outline" size="sm" onClick={() => setLimite((l) => l + 50)}>Mostrar mais 50 ({itensFiltrados.length - itensVisiveis.length} restantes)</Button></div>
        )}
      </Card>

      {modalPedir && <CVModalPedirCotacao convites={convites} forn={forn} onClose={() => setModalPedir(false)} onEmail={enviarEmail} onZap={zap} onLink={copiarLink} onTodosEmail={enviarTodosEmail} enviandoTodos={enviandoTodos} />}
      {confirmar && <CVModalConfirmar cfg={confirmar} onClose={() => setConfirmar(null)} />}
      {descItem && <CVModalDescricao item={descItem} onClose={() => setDescItem(null)} onSalvo={carregar} />}
      {npsConvite && <CVModalNPS lote={lote} convite={npsConvite} onClose={() => setNpsConvite(null)} onSalvo={carregarNps} />}
      {substituir && (
        <Modal title={'Substituir ' + substituir.fornecedor_nome} onClose={() => setSubstituir(null)} width={480}
          footer={<><Button variant="ghost" onClick={() => setSubstituir(null)}>Voltar</Button><Button variant="primary" onClick={confirmarSubstituir} disabled={!subForn}>Substituir</Button></>}>
          <div className="stack" style={{ gap: 10 }}>
            <p className="small">O novo fornecedor recebe um link próprio e entra no mapa. {substituir.fornecedor_nome} sai do mapa, mas o que ele respondeu e as conversas ficam guardados no histórico.</p>
            <select className="input" value={subForn} onChange={(e) => setSubForn(e.target.value)}>
              <option value="">Escolha o novo fornecedor cadastrado…</option>
              {fornecedoresLivres.map((f) => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}{f.email ? '' : ' (sem e-mail)'}</option>)}
            </select>
            <input className="input" placeholder="Motivo (opcional) — ex.: preço alto, não respondeu" value={subMotivo} onChange={(e) => setSubMotivo(e.target.value)} />
          </div>
        </Modal>
      )}
      {modalAprovar && <CVModalAprovar resumo={resumoModal} cambio={cambioNum} enviando={aprovando} onClose={() => setModalAprovar(false)} onConfirmar={aprovar} />}
    </div>
  );
}

/* O lote agora vive na RFQ Importação (abas Fornecedores e tratativas · Comparar e escolher vencedor · P.I.).
   O link antigo /logistica/cotacoes-varejo/<lote> continua valendo e leva para lá. */
function CotacoesVarejoPage({ setRoute }) {
  const [loteId] = window.useRotaId('cotacoes-varejo');
  React.useEffect(() => {
    if (!loteId) return;
    try { window.history.replaceState({}, '', '/gestao-importacao/rfq-importacao/' + loteId + '/comparar'); window.dispatchEvent(new PopStateEvent('popstate')); }
    catch (e) { window.location.href = '/gestao-importacao/rfq-importacao/' + loteId + '/comparar'; }
  }, [loteId]);
  if (loteId) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Abrindo o lote na RFQ Importação…</div>;
  return <CVLista onAbrir={(id) => { window.history.pushState({}, '', '/gestao-importacao/rfq-importacao/' + id + '/comparar'); window.dispatchEvent(new PopStateEvent('popstate')); }} setRoute={setRoute} />;
}

Object.assign(window, { CotacoesVarejoPage, CVDetalhe, NpsMini });
