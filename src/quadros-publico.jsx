/* ============================================================
   quadros-publico.jsx — páginas PÚBLICAS do módulo Quadros de Comando (05/11/2026, pedido do Gelson). Sem login, só com o link secreto:
     /quadros-publico/pedidos/<token>        gestores: status da fabricação e da separação (SÓ LEITURA);
     /quadros-publico/separacao/<token>      separador, pelo celular: marca "Peguei" (Separação PV QC);
     /quadros-publico/separacao_fab/<token>  idem (Separação FAB QC: cabos do kit + componentes do quadro).
   Fala só com duas funções do banco (migration 20261105100000): qc_publico_dados (leitura) e qc_publico_peguei (marcar).
   Os dados chegam brutos e são montados pelo MESMO código da tela interna (QuadrosPedidosStore.montar), então os números batem.
   "Peguei" pelo link grava o NOME digitado pelo separador (guardado no celular), como "link: <nome>".
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;

const COR = { amarelo: '#f6c000', verde: '#2e9e5b', vermelho: '#d64545', texto: '#171717', mudo: '#6b6b6b', borda: '#e3e3e3', fundo: '#f5f5f3' };
const sbc = () => window.__VP_SB.sb;

function lerUrl() {
  const p = window.location.pathname.split('/').filter(Boolean);   // ['quadros-publico', tipo, token]
  return { tipo: decodeURIComponent(p[1] || ''), token: decodeURIComponent(p[2] || '') };
}
const data = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const qtd = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const quando = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''; };
const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

function Barra({ pct, rotulo, sub }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COR.mudo }}><span>{rotulo}</span><b style={{ color: COR.texto }}>{p}%</b></div>
      <div style={{ height: 9, borderRadius: 5, background: '#e9e9e6', overflow: 'hidden', marginTop: 3 }}>
        <div style={{ width: p + '%', height: '100%', background: p === 100 ? COR.verde : COR.amarelo }} />
      </div>
      {sub ? <div style={{ fontSize: 11, color: COR.mudo, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function Cabecalho({ titulo, sub, extra }) {
  return (
    <div style={{ background: '#111', color: '#fff', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 5 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, color: COR.amarelo, textTransform: 'uppercase' }}>Quadros de Comando</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{titulo}</div>
      {sub ? <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{sub}</div> : null}
      {extra}
    </div>
  );
}

// ---------- Gestores: Pedidos com Quadro (só leitura) ----------
function PaginaPedidos({ linhas, pegos }) {
  const [busca, setBusca] = useState('');
  const hoje = hojeISO();
  const f = busca.trim().toLowerCase();
  const lista = linhas.filter((r) => !f || [r.numero, r.cliente, r.vendedor].some((x) => String(x || '').toLowerCase().includes(f)));
  const progresso = (itens, chave) => {
    const total = itens.length, ok = itens.filter((i) => pegos[window.QuadrosPedidosStore.chavePeguei(chave, i.codigo)]).length;
    return { total, ok, pct: total ? (ok / total) * 100 : 0 };
  };
  return (
    <>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente ou vendedor" style={campoBusca} />
      <div style={{ padding: '0 12px 24px' }}>
        {lista.map((r) => {
          const atrasado = r.prazo && String(r.prazo).slice(0, 10) < hoje;
          const pv = progresso(r.itensSeparar, r.chave), fab = progresso([...r.itensKit, ...r.itensComponentes], r.chave);
          return (
            <div key={r.chave} style={cartao}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 16 }}>Pedido {r.numero}</b>
                <span style={{ fontSize: 12, color: atrasado ? COR.vermelho : COR.mudo, fontWeight: atrasado ? 700 : 400 }}>Prazo {data(r.prazo)}{atrasado ? ' · atrasado' : ''}</span>
              </div>
              <div style={{ fontSize: 13 }}>{r.cliente || '—'}</div>
              <div style={{ fontSize: 12, color: COR.mudo }}>Vendedor: {r.vendedor || '—'} · Incluído no Omie {data(r.incluido)}</div>
              {r.fab ? <Barra pct={r.fab.pct} rotulo="Fabricação" sub={r.fab.sub} /> : <div style={{ fontSize: 12, color: COR.mudo, marginTop: 8 }}>Fabricação: sem OP</div>}
              {pv.total ? <Barra pct={pv.pct} rotulo="Separação (itens do pedido)" sub={`${pv.ok} de ${pv.total} itens pegos`} /> : null}
              {fab.total ? <Barra pct={fab.pct} rotulo="Separação do kit e componentes" sub={`${fab.ok} de ${fab.total} itens pegos`} /> : null}
            </div>
          );
        })}
        {!lista.length ? <div style={{ textAlign: 'center', color: COR.mudo, padding: 40 }}>Nenhum pedido.</div> : null}
      </div>
    </>
  );
}

// ---------- Separador: marcar Peguei pelo celular ----------
function PaginaSeparacao({ tipo, linhas, pegos, token, aoMudar }) {
  const [nome, setNome] = useState(() => { try { return localStorage.getItem('qp_nome') || ''; } catch (e) { return ''; } });
  const [digitando, setDigitando] = useState('');
  const [aberto, setAberto] = useState(null);
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const itensDe = (r) => (tipo === 'separacao_fab' ? [...r.itensKit, ...r.itensComponentes] : r.itensSeparar);
  const K = window.QuadrosPedidosStore.chavePeguei;

  if (!nome) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ ...cartao, margin: 0 }}>
          <b style={{ fontSize: 16 }}>Quem está separando?</b>
          <div style={{ fontSize: 13, color: COR.mudo, margin: '6px 0 12px' }}>Digite seu nome. Ele fica gravado em cada item que você marcar como "Peguei".</div>
          <input value={digitando} onChange={(e) => setDigitando(e.target.value)} placeholder="Seu nome" maxLength={60} style={{ ...campoBusca, margin: 0 }} />
          <button disabled={digitando.trim().length < 2} onClick={() => { const n = digitando.trim(); try { localStorage.setItem('qp_nome', n); } catch (e) { /* sem armazenamento */ } setNome(n); }}
            style={{ ...botao, width: '100%', marginTop: 12, opacity: digitando.trim().length < 2 ? 0.5 : 1 }}>Continuar</button>
        </div>
      </div>
    );
  }

  const marcar = async (r, i, peguei) => {
    const k = K(r.chave, i.codigo);
    setOcupado(k); setMsg(null);
    try {
      const { error } = await sbc().rpc('qc_publico_peguei', { p_token: token, p_codigo_pedido: Number(r.chave), p_codigo: String(i.codigo), p_peguei: peguei, p_nome: nome });
      if (error) throw error;
      aoMudar(k, peguei ? { por: 'link: ' + nome, em: new Date().toISOString() } : null);
    } catch (e) { setMsg(((e && e.message) || String(e)).replace(/^.*link QC: /, '')); }
    setOcupado(null);
  };

  const f = busca.trim().toLowerCase();
  const lista = linhas.filter((r) => itensDe(r).length && (!f || [r.numero, r.cliente].some((x) => String(x || '').toLowerCase().includes(f))));
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 0', fontSize: 12, color: COR.mudo }}>
        <span>Separando como <b style={{ color: COR.texto }}>{nome}</b></span>
        <button onClick={() => { try { localStorage.removeItem('qp_nome'); } catch (e) { /* ok */ } setNome(''); }} style={{ background: 'none', border: 0, color: COR.mudo, textDecoration: 'underline', fontSize: 12 }}>trocar</button>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido ou cliente" style={campoBusca} />
      {msg ? <div style={{ margin: '0 12px 8px', padding: 10, borderRadius: 8, background: '#fdeaea', color: COR.vermelho, fontSize: 13 }}>{msg}</div> : null}
      <div style={{ padding: '0 12px 24px' }}>
        {lista.map((r) => {
          const itens = itensDe(r), feitos = itens.filter((i) => pegos[K(r.chave, i.codigo)]).length, abre = aberto === r.chave;
          return (
            <div key={r.chave} style={cartao}>
              <div onClick={() => setAberto(abre ? null : r.chave)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: 16 }}>Pedido {r.numero}</b><span style={{ fontSize: 13 }}>{abre ? '▾' : '▸'}</span></div>
                <div style={{ fontSize: 13 }}>{r.cliente || '—'}</div>
                <div style={{ fontSize: 12, color: feitos === itens.length ? COR.verde : COR.mudo }}>{feitos} de {itens.length} itens pegos · prazo {data(r.prazo)}</div>
              </div>
              {abre ? (
                <div style={{ marginTop: 10 }}>
                  {itens.map((i) => {
                    const k = K(r.chave, i.codigo), p = pegos[k];
                    return (
                      <label key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${COR.borda}`, opacity: ocupado === k ? 0.5 : 1 }}>
                        <input type="checkbox" checked={!!p} disabled={ocupado === k} onChange={(e) => marcar(r, i, e.target.checked)} style={{ width: 26, height: 26, marginTop: 2, flex: '0 0 auto' }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: 14, wordBreak: 'break-word' }}>{i.rotulo || i.codigo}</b>
                          <span style={{ display: 'block', fontSize: 12, color: COR.mudo, wordBreak: 'break-word' }}>{i.descricao || ''}</span>
                          <span style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                            Qtd <b>{qtd(i.quantidade)}</b> {i.unidade || ''}
                            {i.estoque != null ? <> · em estoque {qtd(i.estoque)}</> : null}
                            {i.falta > 0 ? <b style={{ color: COR.vermelho }}> · falta {qtd(i.falta)}</b> : null}
                          </span>
                          {p ? <span style={{ display: 'block', fontSize: 11, color: COR.verde }}>Pego por {String(p.por || '').replace(/^link: /, '').split('@')[0]} {quando(p.em)}</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {!lista.length ? <div style={{ textAlign: 'center', color: COR.mudo, padding: 40 }}>Nenhum pedido com itens para separar.</div> : null}
      </div>
    </>
  );
}

const cartao = { background: '#fff', border: `1px solid ${COR.borda}`, borderRadius: 12, padding: 14, margin: '10px 0' };
const campoBusca = { width: 'calc(100% - 24px)', boxSizing: 'border-box', margin: '10px 12px', padding: '12px 14px', fontSize: 16, border: `1px solid ${COR.borda}`, borderRadius: 10, fontFamily: 'inherit' };
const botao = { background: COR.amarelo, border: 0, borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' };

const TITULOS = { pedidos: ['Acompanhe a Fabricação de Quadros', 'Somente leitura · atualiza sozinho'], separacao: ['Separação dos pedidos', 'Marque "Peguei" em cada item'], separacao_fab: ['Separação FAB QC', 'Cabos do kit e componentes do quadro'] };

function Pagina() {
  const { tipo, token } = lerUrl();
  const [estado, setEstado] = useState({ carregando: true });
  const ultimo = useRef(0);

  const carregar = useCallback(async () => {
    try {
      const { data: r, error } = await sbc().rpc('qc_publico_dados', { p_token: token });
      if (error) throw error;
      if (!r) { setEstado({ invalido: true }); return; }
      const linhas = window.QuadrosPedidosStore.montar(r.dados);
      const pegos = {};
      (r.pegos || []).forEach((x) => { pegos[window.QuadrosPedidosStore.chavePeguei(x.codigo_pedido, x.codigo)] = { por: x.peguei_por, em: x.peguei_em }; });
      ultimo.current = Date.now();
      setEstado({ r, linhas, pegos, tipoReal: r.tipo });
    } catch (e) { setEstado((s) => (s.linhas ? { ...s, erro: (e && e.message) || String(e) } : { erro: (e && e.message) || String(e) })); }
  }, [token]);

  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible' && Date.now() - ultimo.current > 15000) carregar(); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, [carregar]);

  const [tit, subtit] = TITULOS[tipo] || ['Quadros de Comando', ''];
  if (estado.invalido || (estado.tipoReal && estado.tipoReal !== tipo)) return (<><Cabecalho titulo={tit} /><div style={{ padding: 30, textAlign: 'center' }}>Link inválido ou trocado. Peça um link novo.</div></>);
  if (estado.carregando) return (<><Cabecalho titulo={tit} /><div style={{ padding: 30, textAlign: 'center', color: COR.mudo }}>Carregando…</div></>);
  if (!estado.linhas) return (<><Cabecalho titulo={tit} /><div style={{ padding: 30, textAlign: 'center', color: COR.vermelho }}>Não foi possível carregar: {estado.erro}</div></>);

  const aoMudar = (k, v) => setEstado((s) => { const p = { ...s.pegos }; if (v) p[k] = v; else delete p[k]; return { ...s, pegos: p }; });
  return (
    <>
      <Cabecalho titulo={tit} sub={`${subtit} · atualiza sozinha`} />
      {estado.erro ? <div style={{ padding: '6px 14px', fontSize: 12, color: COR.vermelho }}>Sem conexão agora; mostrando a última leitura.</div> : null}
      {tipo === 'pedidos' ? <PaginaPedidos linhas={estado.linhas} pegos={estado.pegos} /> : <PaginaSeparacao tipo={tipo} linhas={estado.linhas} pegos={estado.pegos} token={token} aoMudar={aoMudar} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('qp-root')).render(<Pagina />);
