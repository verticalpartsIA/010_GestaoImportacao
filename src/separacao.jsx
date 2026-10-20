/* ============================================================
   separacao.jsx — Logística Interna · Separação. Duas abas (20/10/2026): "Pedidos a separar" (primeira — o operador separa aqui, mesma fila e regras do
   celular, via RPC separacao_hub → estoque_separacao_chamar) e "Painel TV" (links + SLA, abaixo).
   O painel em si é uma página pública (/separacao-tv/<token>, separacao-tv.jsx); aqui só se gera, copia e revoga o link e se define a meta de SLA.
   Alçadas (módulo `separacao`): ver = vê os links e o SLA; editar = gera/revoga links e muda o SLA. O banco confere de novo (RPCs separacao_tv_*).
   O link É a senha da TV: quem o tiver vê o painel (só nº do pedido, status, SLA e códigos de produto). Revogue se vazar.
   ============================================================ */
const SEP_SB = () => (window.__VP_SB && window.__VP_SB.sb) || null;
const sepToast = (m) => { if (window.toast) window.toast(m); };
const sepUrl = (token) => `${window.location.origin}/separacao-tv/${token}`;
const sepData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

async function sepCopiar(texto) {
  try { await navigator.clipboard.writeText(texto); sepToast('Link copiado.'); }
  catch (e) { window.prompt('Copie o link:', texto); }
}

function SeparacaoTvAba({ caps }) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [nome, setNome] = React.useState('');
  const [sla, setSla] = React.useState('4');
  const [ocupado, setOcupado] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const sb = SEP_SB();
    if (!sb) { setErro('Sistema ainda carregando.'); return; }
    const { data, error } = await sb.rpc('separacao_tv_listar');
    if (error) { setErro(error.message); return; }
    setErro(null); setDados(data); setSla(String(data.sla_horas));
  }, []);

  React.useEffect(() => { if (caps.ver) carregar(); }, [carregar, caps.ver]);

  async function gerar() {
    if (!nome.trim()) { sepToast('Dê um nome ao link (ex.: TV do almoxarifado).'); return; }
    setOcupado(true);
    const { data, error } = await SEP_SB().rpc('separacao_tv_gerar', { p_nome: nome.trim() });
    setOcupado(false);
    if (error) { sepToast('Não gerou: ' + error.message); return; }
    setNome('');
    sepToast('Link criado.');
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Criou link do painel TV', alvo: data.nome });
    carregar();
  }
  async function revogar(l) {
    if (!window.confirm(`Revogar o link "${l.nome}"? A TV que usa esse link para de mostrar o painel.`)) return;
    const { error } = await SEP_SB().rpc('separacao_tv_revogar', { p_token: l.token });
    if (error) { sepToast('Não revogou: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Revogou link do painel TV', alvo: l.nome });
    carregar();
  }
  async function salvarSla() {
    const h = Number(String(sla).replace(',', '.'));
    if (!(h > 0 && h <= 72)) { sepToast('Informe um SLA entre 0 e 72 horas.'); return; }
    const { error } = await SEP_SB().rpc('separacao_tv_config_salvar', { p_sla_horas: h });
    if (error) { sepToast('Não salvou: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Mudou o SLA da separação', alvo: `${h} h úteis` });
    sepToast('SLA salvo.'); carregar();
  }

  const links = (dados && dados.links) || [];
  return (
    <div>
      <p style={{ color: 'var(--fg3)', marginTop: 0 }}>Links do painel de TV da separação de pedidos. O painel mostra, ao vivo (a cada 30 s), os pedidos aguardando, em separação e separados hoje, só com o nº do pedido, os códigos de produto e o SLA.</p>
      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10, marginBottom: 12 }}>{erro}</div>}

      <Card title="SLA da separação" sub="Horas úteis (seg–sex, 8h–18h) entre o pedido entrar no hub e ser marcado como separado. O relógio para quando separa.">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 90 }} value={sla} disabled={!caps.editar} onChange={(e) => setSla(e.target.value)} />
          <span>horas úteis</span>
          <button className="btn btn--sm btn--primary" disabled={!caps.editar} onClick={salvarSla}>Salvar</button>
          {!caps.editar && <span style={{ color: 'var(--fg3)', fontSize: 12 }}>Só quem tem a alçada "Separação › Editar" muda.</span>}
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Links do painel TV" sub="Cada TV usa um link. O link é a senha: quem o tiver vê o painel. Revogue se vazar.">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ minWidth: 260 }} placeholder="Nome do link (ex.: TV do almoxarifado)" value={nome} maxLength={60}
                 disabled={!caps.editar} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') gerar(); }} />
          <button className="btn btn--sm btn--primary" disabled={!caps.editar || ocupado} onClick={gerar}>Gerar link</button>
          {!caps.editar && <span style={{ color: 'var(--fg3)', fontSize: 12, alignSelf: 'center' }}>Gerar exige a alçada "Separação › Editar".</span>}
        </div>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Nome</th><th>Criado por</th><th>Criado em</th><th>Último acesso</th><th></th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.token}>
                  <td><b>{l.nome}</b></td><td>{(l.criado_por || '—').split('@')[0]}</td><td>{sepData(l.criado_em)}</td><td>{sepData(l.ultimo_acesso)}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn btn--sm" onClick={() => sepCopiar(sepUrl(l.token))}>Copiar link</button>{' '}
                    <a className="btn btn--sm" href={sepUrl(l.token)} target="_blank" rel="noopener">Abrir</a>{' '}
                    {caps.editar && <button className="btn btn--sm" onClick={() => revogar(l)}>Revogar</button>}
                  </td>
                </tr>
              ))}
              {dados && !links.length && <tr><td colSpan={5} style={{ padding: 18, color: 'var(--fg3)' }}>Nenhum link ainda. Gere um para a TV.</td></tr>}
              {!dados && !erro && <tr><td colSpan={5} style={{ padding: 18, color: 'var(--fg3)' }}>Carregando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const sepMin = (m) => { const n = Math.max(0, Math.round(m || 0)); const h = Math.floor(n / 60); return h ? `${h}h ${String(n % 60).padStart(2, '0')}min` : `${n}min`; };
const sepQtd = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }); };
const sepNome = (e) => (e || '').split('@')[0];
const SEP_STATUS = { livre: ['Aguardando', 'warning'], em_separacao: ['Em separação', 'info'], separado: ['Separado', 'success'] };

async function sepChamar(acao, args) {
  const sb = SEP_SB();
  if (!sb) throw new Error('Sistema ainda carregando.');
  const { data, error } = await sb.rpc('separacao_hub', { p_acao: acao, p_args: args || {} });
  if (error) throw new Error((error.message || '').replace(/^(estoque|separação): /, ''));
  return data;
}

function SepDetalhe({ codigo, caps, voltar, onMudou }) {
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [campos, setCampos] = React.useState({});   // por código do item: { qtd, endereco }

  const carregar = React.useCallback(async () => {
    try { setD(await sepChamar('itens', { codigo_pedido: codigo })); setErro(null); }
    catch (e) { setErro(e.message); }
  }, [codigo]);
  React.useEffect(() => { setD(null); carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);

  async function agir(acao, args, ok, log) {
    setOcupado(true);
    try {
      await sepChamar(acao, { codigo_pedido: codigo, ...(args || {}) });
      if (ok) sepToast(ok);
      window.VPLog?.registrar?.({ modulo: 'Separação', acao: log || acao, alvo: 'Pedido ' + (d && d.pedido.numero_pedido) });
      await carregar(); onMudou();
    } catch (e) { sepToast(e.message); }
    setOcupado(false);
  }
  async function concluir() {
    const faltam = (d.itens || []).filter((i) => Number(i.qtd_separada) < Number(i.qtd_pedida)).length;
    if (faltam && !window.confirm(`Faltam ${faltam} item(ns) para separar. Concluir mesmo assim, com falta?`)) return;
    agir('concluir', { forcar: faltam > 0 }, 'Pedido separado.', 'Concluiu a separação');
  }

  if (erro && !d) return <div><button className="btn btn--sm" onClick={voltar}>← Pedidos</button><div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10, marginTop: 12 }}>{erro}</div></div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;
  const p = d.pedido, eu = (window.__VP_USER && window.__VP_USER.email || '').toLowerCase();
  const meu = p.pego_por && p.pego_por.toLowerCase() === eu;
  const podeAgir = caps.saida;
  const [rot, vari] = SEP_STATUS[p.status] || SEP_STATUS.livre;
  const itens = d.itens || [];
  const set = (c, k, v) => setCampos((m) => ({ ...m, [c]: { ...(m[c] || {}), [k]: v } }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn--sm" onClick={voltar}>← Pedidos</button>
        <h2 style={{ margin: 0 }}>Pedido {p.numero_pedido}</h2>
        <Badge variant={vari}>{rot}</Badge>
        <span style={{ color: 'var(--fg3)' }}>{p.cliente || '—'}{p.pego_por ? ` · com ${sepNome(p.pego_por)} desde ${sepData(p.pego_em)}` : ''}{p.separado_em ? ` · separado por ${sepNome(p.separado_por)} em ${sepData(p.separado_em)}` : ''}</span>
        <span style={{ flex: 1 }} />
        {podeAgir && p.status === 'livre' && <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={() => agir('pegar', null, 'Pedido seu. Pode separar.', 'Pegou o pedido')}>Pegar pedido</button>}
        {podeAgir && p.status === 'em_separacao' && !meu && <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={() => agir('assumir', null, 'Você assumiu o pedido.', 'Assumiu o pedido')}>Assumir de {sepNome(p.pego_por)}</button>}
        {podeAgir && p.status === 'em_separacao' && <button className="btn btn--sm" disabled={ocupado} onClick={() => agir('soltar', null, 'Pedido liberado para outra pessoa.', 'Soltou o pedido')}>Soltar</button>}
        {podeAgir && meu && p.status === 'em_separacao' && <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={concluir}>Concluir separação</button>}
      </div>
      {!podeAgir && <div style={{ background: '#fff7df', border: '1px solid #e6c766', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>Você só consulta. Para separar é preciso a alçada "VP Estoque › Saída" (a mesma do celular), em Administração › Alçadas.</div>}
      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 10, borderRadius: 10, marginBottom: 12 }}>{erro}</div>}
      <Card title="Itens do pedido" sub="Escolha o endereço de onde tirou, informe a quantidade e clique em Separar. Não dá para separar mais que o pedido. Separar não baixa o estoque (a NF de saída baixa).">
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Código</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Pedido</th><th style={{ textAlign: 'right' }}>Separado</th><th>De onde saiu</th>{podeAgir && meu && p.status === 'em_separacao' && <th>Separar agora</th>}</tr></thead>
            <tbody>
              {itens.map((i) => {
                const completo = Number(i.qtd_separada) >= Number(i.qtd_pedida);
                const c = campos[i.codigo] || {};
                const end = c.endereco != null ? c.endereco : ((i.enderecos || [])[0] || '');
                const falta = Number(i.qtd_pedida) - Number(i.qtd_separada);
                return (
                  <tr key={i.codigo}>
                    <td><b>{i.codigo}</b></td>
                    <td style={{ maxWidth: 320 }}>{i.descricao || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{sepQtd(i.qtd_pedida)} {i.unidade || ''}</td>
                    <td style={{ textAlign: 'right', color: completo ? 'var(--vp-success, #1a8f4a)' : undefined, fontWeight: 600 }}>{sepQtd(i.qtd_separada)}</td>
                    <td>
                      {(i.separacoes || []).map((s) => (
                        <div key={s.endereco} style={{ fontSize: 12 }}>
                          {s.endereco}: {sepQtd(s.qtd)}{' '}
                          {podeAgir && meu && p.status === 'em_separacao' && <a href="#" title="Desfazer esta quantidade" onClick={(ev) => { ev.preventDefault(); agir('separar', { codigo: i.codigo, endereco: s.endereco, quantidade: -Number(s.qtd) }, 'Quantidade desfeita.', 'Desfez separação'); }}>desfazer</a>}
                        </div>
                      ))}
                      {!(i.separacoes || []).length && <span style={{ color: 'var(--fg3)', fontSize: 12 }}>{(i.enderecos || []).length ? 'endereço conhecido: ' + i.enderecos.join(', ') : 'sem endereço cadastrado'}</span>}
                    </td>
                    {podeAgir && meu && p.status === 'em_separacao' && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <input className="input" style={{ width: 80 }} placeholder="Endereço" list={'ends-' + i.codigo} value={end} onChange={(e) => set(i.codigo, 'endereco', e.target.value.toUpperCase())} />
                        <datalist id={'ends-' + i.codigo}>{(i.enderecos || []).map((e) => <option key={e} value={e} />)}</datalist>{' '}
                        <input className="input" style={{ width: 70 }} placeholder={falta > 0 ? sepQtd(falta) : '0'} value={c.qtd || ''} onChange={(e) => set(i.codigo, 'qtd', e.target.value)} />{' '}
                        <button className="btn btn--sm" disabled={ocupado || completo} onClick={() => {
                          const q = Number(String(c.qtd || falta).replace(',', '.'));
                          if (!(q > 0)) { sepToast('Informe a quantidade.'); return; }
                          if (!end.trim()) { sepToast('Informe o endereço de onde tirou.'); return; }
                          agir('separar', { codigo: i.codigo, endereco: end.trim(), quantidade: q }, null, 'Separou item').then(() => set(i.codigo, 'qtd', ''));
                        }}>Separar</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SepPedidosAba({ caps, irTv }) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [filtro, setFiltro] = React.useState('abertos');
  const [busca, setBusca] = React.useState('');
  const [aberto, setAberto] = window.useRotaItem('separacao', 'pedidos');

  const carregar = React.useCallback(async () => {
    try { setDados(await sepChamar('fila')); setErro(null); } catch (e) { setErro(e.message); }
  }, []);
  React.useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);

  async function copiarLinkTv() {
    const { data, error } = await SEP_SB().rpc('separacao_tv_listar');
    if (error) { sepToast('Não consegui ler os links: ' + error.message); return; }
    const l = (data.links || [])[0];
    if (!l) { sepToast('Ainda não há link de TV. Gere um na aba Painel TV.'); irTv(); return; }
    sepCopiar(sepUrl(l.token));
  }

  if (aberto) return <SepDetalhe codigo={aberto} caps={caps} voltar={() => setAberto('')} onMudou={carregar} />;

  const sla = (dados && dados.sla_min) || 240;
  const lista = ((dados && dados.pedidos) || []).filter((p) => {
    if (filtro === 'abertos' && p.status === 'separado') return false;
    if (filtro === 'livre' && p.status !== 'livre') return false;
    if (filtro === 'em_separacao' && p.status !== 'em_separacao') return false;
    if (filtro === 'separado' && p.status !== 'separado') return false;
    const b = busca.trim().toLowerCase();
    return !b || String(p.numero_pedido).toLowerCase().includes(b) || String(p.cliente || '').toLowerCase().includes(b);
  });
  const cont = (st) => ((dados && dados.pedidos) || []).filter((p) => p.status === st).length;
  const atrasados = ((dados && dados.pedidos) || []).filter((p) => p.status !== 'separado' && p.decorrido_min >= sla).length;
  const filtros = [['abertos', 'A separar'], ['livre', `Aguardando (${cont('livre')})`], ['em_separacao', `Em separação (${cont('em_separacao')})`], ['separado', `Separados hoje (${cont('separado')})`], ['todos', 'Todos']];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {filtros.map(([k, r]) => <button key={k} className={'btn btn--sm' + (filtro === k ? ' btn--primary' : '')} onClick={() => setFiltro(k)}>{r}</button>)}
        <input className="input" style={{ width: 220 }} placeholder="Buscar pedido ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span style={{ flex: 1 }} />
        {atrasados > 0 && <Badge variant="danger">{atrasados} fora do SLA</Badge>}
        <button className="btn btn--sm" onClick={copiarLinkTv}>Copiar link da TV</button>
        <button className="btn btn--sm" onClick={irTv}>Painel TV ▸</button>
        <button className="btn btn--sm" onClick={carregar}>Atualizar</button>
      </div>
      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10, marginBottom: 12 }}>{erro}</div>}
      <Card title="Pedidos a separar" sub={`Pedidos do Omie na etapa "Separar estoque" (atualizados a cada 30 min) e os separados hoje. SLA: ${sepMin(sla)} úteis desde a entrada no hub. Clique no pedido para separar.`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Previsão</th><th>Itens separados</th><th>Situação</th><th>Com</th><th>SLA</th></tr></thead>
            <tbody>
              {lista.map((p) => {
                const [rot, vari] = SEP_STATUS[p.status] || SEP_STATUS.livre;
                const est = p.decorrido_min >= sla;
                return (
                  <tr key={p.codigo_pedido} style={{ cursor: 'pointer' }} onClick={() => setAberto(String(p.codigo_pedido))}>
                    <td><b>{p.numero_pedido}</b></td>
                    <td>{p.cliente || '—'}</td>
                    <td>{p.data_previsao ? new Date(p.data_previsao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{p.separados}/{p.itens}</td>
                    <td><Badge variant={vari}>{rot}</Badge></td>
                    <td>{sepNome(p.pego_por || p.separado_por) || '—'}</td>
                    <td style={{ color: est && p.status !== 'separado' ? 'var(--vp-danger)' : undefined, fontWeight: est ? 700 : 400 }}>{sepMin(p.decorrido_min)}{est ? (p.status === 'separado' ? ' (fora)' : ' ⚠') : ''}</td>
                  </tr>
                );
              })}
              {dados && !lista.length && <tr><td colSpan={7} style={{ padding: 18, color: 'var(--fg3)' }}>Nenhum pedido neste filtro.</td></tr>}
              {!dados && !erro && <tr><td colSpan={7} style={{ padding: 18, color: 'var(--fg3)' }}>Carregando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SeparacaoPage() {
  const [aba, setAba] = window.useRouteTab('separacao', 'pedidos', ['pedidos', 'tv'], false, true);
  const [caps, setCaps] = React.useState({ carregado: false, ver: false, editar: false, saida: false });
  React.useEffect(() => {
    let vivo = true;
    const cap = async (m, c) => { try { return !!(await window.PropostaStore?.temCapacidade?.(m, c)); } catch (e) { return false; } };
    Promise.all([cap('separacao', 'ver'), cap('separacao', 'editar'), cap('estoque', 'saida')]).then(([ver, editar, saida]) => {
      if (vivo) setCaps({ carregado: true, ver, editar, saida });
    });
    return () => { vivo = false; };
  }, []);

  const cabecalho = (sub) => (
    <div className="page-head"><div className="page-head__l">
      <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Separação</div>
      <h1 className="page-head__title">Separação</h1>
      <p className="page-head__sub">{sub}</p>
    </div></div>
  );
  if (caps.carregado && !caps.ver) {
    return <div className="page fade-in">{cabecalho('Você não tem acesso a esta tela. Peça ao gestor a alçada "Separação › Ver" em Administração › Alçadas.')}</div>;
  }
  return (
    <div className="page fade-in">
      {cabecalho('Separe aqui os pedidos de venda que o Omie liberou para separar estoque (a mesma fila do celular). O painel de TV mostra a fila ao vivo.')}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={'btn btn--sm' + (aba === 'pedidos' ? ' btn--primary' : '')} onClick={() => setAba('pedidos')}>Pedidos a separar</button>
        <button className={'btn btn--sm' + (aba === 'tv' ? ' btn--primary' : '')} onClick={() => setAba('tv')}>Painel TV</button>
      </div>
      {caps.carregado && aba === 'pedidos' && <SepPedidosAba caps={caps} irTv={() => setAba('tv')} />}
      {caps.carregado && aba === 'tv' && <SeparacaoTvAba caps={caps} />}
    </div>
  );
}

Object.assign(window, { SeparacaoPage });
