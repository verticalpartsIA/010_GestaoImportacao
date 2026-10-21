/* ============================================================
   separacao-tv.jsx — painel PÚBLICO de TV da separação de pedidos (/separacao-tv/<token>).
   Fala só com a RPC separacao_tv_dados (token do link, gerado em Logística › Separação). Atualiza a cada 30 s.
   Mostra só: nº do pedido, status, SLA e CÓDIGOS de produto (com separado/pedido). Nunca cliente, descrição, valor nem nome de pessoa.
   SLA = horas úteis desde que o pedido entrou no hub até "separado" (o relógio para quando separa). Regras no SQL (migration 20261017180000).
   Aviso na tela quando um pedido chega, é pego, separado ou sai da fila (diferença entre uma atualização e a anterior).
   ============================================================ */
const { useState, useEffect, useRef } = React;

const POLL_MS = 30000;
const COR = { fundo: '#0b0b0b', cartao: '#171717', borda: '#2a2a2a', amarelo: '#f6c000', verde: '#3ddc84', vermelho: '#ff5252', texto: '#f2f2f2', mudo: '#9a9a9a' };

function tokenDaUrl() {
  const p = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(p[p.length - 1] || '');
}
const sbc = () => window.__VP_SB.sb;
const pad = (n) => String(n).padStart(2, '0');
function fmtMin(m) {
  const n = Math.max(0, Math.round(m || 0));
  const h = Math.floor(n / 60), r = n % 60;
  return h ? `${h}h ${pad(r)}min` : `${r}min`;
}
function corSla(dec, sla) {
  const r = sla > 0 ? dec / sla : 0;
  return r >= 1 ? COR.vermelho : r >= 0.75 ? COR.amarelo : COR.verde;
}
const qtd = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }); };

const ROTULO = {
  chegou: (n) => `Chegou o pedido ${n}`,
  pego: (n) => `Pedido ${n}: separação iniciada`,
  separado: (n) => `Pedido ${n} separado`,
  parcial: (n) => `Pedido ${n}: parcial — aguardando fabricação/chegada`,
  voltou: (n) => `Pedido ${n} voltou para a fila`,
  saiu: (n) => `Pedido ${n} saiu da fila`,
};
function detectarEventos(antes, depois) {
  const ev = [];
  const mapaAntes = new Map(antes.map((p) => [p.id, p]));
  const mapaDepois = new Map(depois.map((p) => [p.id, p]));
  depois.forEach((p) => {
    const a = mapaAntes.get(p.id);
    if (!a) { ev.push({ tipo: p.status === 'separado' ? 'separado' : p.status === 'parcial' ? 'parcial' : p.status === 'em_separacao' ? 'pego' : 'chegou', n: p.numero_pedido }); return; }
    if (a.status === p.status) return;
    if (p.status === 'separado') ev.push({ tipo: 'separado', n: p.numero_pedido });
    else if (p.status === 'parcial') ev.push({ tipo: 'parcial', n: p.numero_pedido });
    else if (p.status === 'em_separacao') ev.push({ tipo: 'pego', n: p.numero_pedido });
    else ev.push({ tipo: 'voltou', n: p.numero_pedido });
  });
  antes.forEach((a) => { if (!mapaDepois.has(a.id) && a.status !== 'separado') ev.push({ tipo: 'saiu', n: a.numero_pedido }); });
  return ev;
}

function Caixa({ children }) {
  return <div style={{ maxWidth: 640, margin: '80px auto', padding: 28, background: COR.cartao, border: `1px solid ${COR.borda}`, borderRadius: 14, fontFamily: 'Poppins, Arial, sans-serif', color: COR.texto, textAlign: 'center' }}>{children}</div>;
}

function Cartao({ p, sla }) {
  const sep = p.status === 'separado';
  const par = p.status === 'parcial';
  const cor = par ? '#8fb4ff' : corSla(p.decorrido_min, sla);
  const atrasado = !par && p.decorrido_min >= sla;
  const pct = Math.min(100, sla > 0 ? (p.decorrido_min / sla) * 100 : 0);
  const MAX = 10;
  const itens = p.itens || [];
  return (
    <div style={{ background: COR.cartao, border: `2px solid ${atrasado ? cor : COR.borda}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12 }} className={atrasado && !sep ? 'st-pulsa' : ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 'clamp(18px, 1.7vw, 30px)', fontWeight: 800, color: COR.amarelo, whiteSpace: 'nowrap' }}>Pedido {p.numero_pedido}</span>
        <span style={{ fontSize: 'clamp(16px, 1.5vw, 26px)', fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}>{fmtMin(p.decorrido_min)}</span>
      </div>
      <div style={{ height: 10, background: '#2a2a2a', borderRadius: 6, margin: '8px 0 4px' }}>
        <div style={{ width: pct + '%', height: 10, background: cor, borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 'clamp(11px, 1vw, 15px)', color: COR.mudo, marginBottom: 8 }}>
        {par
          ? `Aguardando fabricação/chegada há ${fmtMin(p.espera_min)} · separação do almoxarifado levou ${fmtMin(p.decorrido_min)} (meta ${fmtMin(sla)})`
          : sep
          ? (atrasado ? `Separado fora do SLA (meta ${fmtMin(sla)})` : `Separado dentro do SLA (meta ${fmtMin(sla)})`)
          : (atrasado ? `SLA estourado há ${fmtMin(p.decorrido_min - sla)} (meta ${fmtMin(sla)})` : `Restam ${fmtMin(sla - p.decorrido_min)} do SLA (meta ${fmtMin(sla)})`)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {itens.slice(0, MAX).map((i) => {
          const completo = Number(i.separada) >= Number(i.pedida);
          const pendente = !completo && i.pendente;
          return (
            <span key={i.codigo} style={{ fontSize: 'clamp(12px, 1.2vw, 19px)', fontWeight: 600, padding: '3px 9px', borderRadius: 8, border: `1px solid ${completo ? COR.verde : pendente ? '#8fb4ff' : COR.borda}`, color: completo ? COR.verde : pendente ? '#8fb4ff' : COR.texto, background: '#101010' }}>
              {i.codigo} <span style={{ color: COR.mudo, fontWeight: 500 }}>{qtd(i.separada)}/{qtd(i.pedida)}</span>
            </span>
          );
        })}
        {itens.length > MAX && <span style={{ fontSize: 'clamp(12px, 1.2vw, 19px)', color: COR.mudo, alignSelf: 'center' }}>+{itens.length - MAX} itens</span>}
      </div>
    </div>
  );
}

function Coluna({ titulo, cor, lista, total, sla, vazio, larga }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, borderBottom: `3px solid ${cor}`, paddingBottom: 6 }}>
        <span style={{ fontSize: 'clamp(16px, 1.8vw, 28px)', fontWeight: 800, letterSpacing: '.04em', color: cor }}>{titulo}</span>
        <span style={{ fontSize: 'clamp(16px, 1.8vw, 28px)', fontWeight: 800, color: COR.texto }}>{total}</span>
        {total > lista.length && <span style={{ fontSize: 'clamp(11px, 1vw, 15px)', color: COR.mudo }}>(mostrando {lista.length})</span>}
      </div>
      <div style={larga ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', columnGap: 12 } : undefined}>
        {lista.map((p) => <Cartao key={p.id} p={p} sla={sla} />)}
      </div>
      {!lista.length && <div style={{ color: COR.mudo, padding: '18px 4px', fontSize: 'clamp(13px, 1.3vw, 20px)' }}>{vazio}</div>}
    </div>
  );
}

function Painel() {
  const token = tokenDaUrl();
  const [dados, setDados] = useState(undefined);      // undefined = carregando, null = link inválido/revogado
  const [offline, setOffline] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [som, setSom] = useState(false);
  const [agora, setAgora] = useState(new Date());
  const raiz = useRef(null);
  const anterior = useRef(null);
  const audioCtx = useRef(null);
  const somRef = useRef(false);
  somRef.current = som;

  function bip() {
    try {
      const ctx = audioCtx.current; if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35);
    } catch (e) { /* sem som */ }
  }
  function alternarSom() {
    if (!som) { try { audioCtx.current = audioCtx.current || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.current.resume(); } catch (e) { /* ignora */ } }
    setSom(!som);
  }

  async function carregar() {
    try {
      const { data, error } = await sbc().rpc('separacao_tv_dados', { p_token: token });
      if (error) { setOffline(true); return; }
      setOffline(false);
      if (!data) { setDados(null); return; }
      const novos = data.pedidos || [];
      if (anterior.current) {
        const ev = detectarEventos(anterior.current, novos).map((e, i) => ({ ...e, id: Date.now() + '-' + i, em: Date.now() }));
        if (ev.length) {
          setEventos((lista) => [...ev, ...lista].slice(0, 6));
          if (somRef.current && ev.some((e) => e.tipo === 'chegou' || e.tipo === 'separado')) bip();
        }
      }
      anterior.current = novos;
      setDados(data);
      setAtualizadoEm(new Date());
    } catch (e) { setOffline(true); }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => { setAgora(new Date()); setEventos((l) => l.filter((e) => Date.now() - e.em < 90000)); }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {      // mantém a TV acordada (quando o navegador permite)
    let lock = null, vivo = true;
    const pedir = () => { try { navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => { if (vivo) lock = l; else l.release(); }).catch(() => {}); } catch (e) { /* ignora */ } };
    pedir();
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; document.removeEventListener('visibilitychange', vis); if (lock) lock.release().catch(() => {}); };
  }, []);

  useEffect(() => {      // TV: se a lista passa da tela, rola sozinha (uma tela a cada 12 s) e volta ao topo
    const t = setInterval(() => {
      const h = document.documentElement.scrollHeight, v = window.innerHeight;
      if (h <= v + 20) return;
      if (window.scrollY + v >= h - 10) window.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollBy({ top: v * 0.85, behavior: 'smooth' });
    }, 12000);
    return () => clearInterval(t);
  }, []);

  function telaCheia() {
    const el = raiz.current;
    if (document.fullscreenElement) document.exitFullscreen(); else if (el && el.requestFullscreen) el.requestFullscreen();
  }

  if (dados === undefined && offline) return <Caixa><div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Sem conexão com o sistema</div><div style={{ color: COR.mudo }}>Tentando de novo a cada 30 s…</div></Caixa>;
  if (dados === undefined) return <Caixa>Carregando…</Caixa>;
  if (dados === null) return <Caixa><div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link inválido ou revogado</div><div style={{ color: COR.mudo }}>Peça um novo link em Logística › Separação, no sistema.</div></Caixa>;

  const sla = dados.sla_min || 240;
  const pedidos = dados.pedidos || [];
  const aguardando = pedidos.filter((p) => p.status === 'aguardando');
  const emSep = pedidos.filter((p) => p.status === 'em_separacao');
  const parciais = pedidos.filter((p) => p.status === 'parcial');
  const separados = pedidos.filter((p) => p.status === 'separado').sort((a, b) => String(b.separado_em).localeCompare(String(a.separado_em)));
  const tot = dados.totais || {};      // totais sem corte (as listas acima vêm limitadas por coluna); sem `totais` (RPC antiga), cai nas listas
  const nAguardando = tot.aguardando ?? aguardando.length, nEmSep = tot.em_separacao ?? emSep.length, nSeparados = tot.separados ?? separados.length, nParcial = tot.parcial ?? parciais.length;
  const atrasados = tot.atrasados ?? [...aguardando, ...emSep].filter((p) => p.decorrido_min >= sla).length;
  const hora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const data = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });
  const btn = { background: 'transparent', border: `1px solid ${COR.borda}`, color: COR.mudo, borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div ref={raiz} style={{ minHeight: '100vh', background: COR.fundo, color: COR.texto, fontFamily: 'Poppins, Arial, sans-serif', padding: '16px 20px', boxSizing: 'border-box' }}>
      <style>{`@keyframes stPulsa { 0%,100% { box-shadow: 0 0 0 0 rgba(255,82,82,.0) } 50% { box-shadow: 0 0 18px 2px rgba(255,82,82,.55) } } .st-pulsa { animation: stPulsa 1.6s ease-in-out infinite; }
      @keyframes stEntra { from { transform: translateY(-12px); opacity: 0 } to { transform: none; opacity: 1 } } .st-entra { animation: stEntra .35s ease-out; }
      @media (max-width: 900px) { .st-grade { grid-template-columns: 1fr !important; } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 'clamp(24px, 3vw, 46px)', fontWeight: 800, lineHeight: 1.1 }}><span style={{ color: COR.amarelo }}>Separação</span> de pedidos</div>
          <div style={{ fontSize: 'clamp(12px, 1.1vw, 17px)', color: COR.mudo }}>{data.charAt(0).toUpperCase() + data.slice(1)} · SLA da separação: {fmtMin(sla)} úteis (seg–sex, 8h–18h)</div>
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 'clamp(26px, 3vw, 46px)', fontWeight: 800, color: atrasados ? COR.vermelho : COR.verde }}>{atrasados}</div><div style={{ fontSize: 12, color: COR.mudo }}>fora do SLA</div></div>
          <div style={{ fontSize: 'clamp(28px, 3.4vw, 54px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={btn} onClick={telaCheia}>Tela cheia</button>
            <button style={btn} onClick={alternarSom}>Som: {som ? 'ligado' : 'desligado'}</button>
          </div>
        </div>
      </div>

      {offline && <div style={{ background: '#3a1f1f', border: `1px solid ${COR.vermelho}`, color: '#ffb4b4', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: 15 }}>Sem conexão com o sistema — mostrando os dados da última atualização{atualizadoEm ? ` (${pad(atualizadoEm.getHours())}:${pad(atualizadoEm.getMinutes())})` : ''}. Tentando de novo…</div>}

      {eventos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {eventos.map((e) => (
            <div key={e.id} className="st-entra" style={{ background: e.tipo === 'chegou' ? COR.amarelo : e.tipo === 'separado' ? COR.verde : '#2a2a2a', color: e.tipo === 'chegou' || e.tipo === 'separado' ? '#000' : COR.texto, borderRadius: 10, padding: '8px 16px', marginBottom: 6, fontWeight: 700, fontSize: 'clamp(15px, 1.7vw, 26px)' }}>
              {ROTULO[e.tipo](e.n)}
            </div>
          ))}
        </div>
      )}

      <div className="st-grade" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <Coluna titulo="AGUARDANDO" cor={COR.amarelo} lista={aguardando} total={nAguardando} sla={sla} vazio="Nenhum pedido na fila." larga />
        <Coluna titulo="EM SEPARAÇÃO" cor="#4da3ff" lista={emSep} total={nEmSep} sla={sla} vazio="Ninguém separando agora." />
        <Coluna titulo="AGUARDANDO FABRICAÇÃO" cor="#8fb4ff" lista={parciais} total={nParcial} sla={sla} vazio="Nenhum pedido parcial." />
        <Coluna titulo="SEPARADOS HOJE" cor={COR.verde} lista={separados} total={nSeparados} sla={sla} vazio="Nenhum separado hoje." />
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: COR.mudo, textAlign: 'right' }}>
        Atualiza a cada 30 s{atualizadoEm ? ` · última atualização ${pad(atualizadoEm.getHours())}:${pad(atualizadoEm.getMinutes())}:${pad(atualizadoEm.getSeconds())}` : ''}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('st-root')).render(<Painel />);
