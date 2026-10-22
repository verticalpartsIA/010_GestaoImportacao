/* ============================================================
   fabricacao-oficina-app.jsx — página pública do chão de fábrica para
   Corrimão e Corte (22/10/2026). Rota: /fabricacao-oficina/<token>.
   Sem login: o token (link fixo por OP) é a credencial e só chega ao
   banco por RPC (public_fab_*). Marca etapas, relata/resolve falta de
   material e (Corte) registra a sobra. Nunca desmarca etapa.
   ============================================================ */
(function () {
  'use strict';
  const U = window.FabOficinaUI, C = window.FabOficinaCalc, S = window.FabricacaoOficinaStore;

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/fabricacao-oficina\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function App() {
    const token = tokenDoPath();
    const [estado, setEstado] = React.useState(undefined); // undefined = carregando, null = link inválido
    const [erro, setErro] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [nome, setNome] = React.useState(() => { try { return localStorage.getItem('fo_nome') || ''; } catch (e) { return ''; } });

    const carregar = React.useCallback(async () => {
      try { setEstado(await S.obterPorToken(token)); setErro(null); }
      catch (e) { setErro(e.message || String(e)); }
    }, [token]);
    React.useEffect(() => { if (token) carregar(); else setEstado(null); }, [carregar, token]);

    const agir = async (fn) => {
      setBusy(true);
      try { await fn(); await carregar(); }
      catch (e) { window.alert((e.message || String(e)).replace(/^fabricação: /, '')); }
      finally { setBusy(false); }
    };
    const guardarNome = (v) => { setNome(v); try { localStorage.setItem('fo_nome', v); } catch (e) {} };

    const caixa = { maxWidth: 760, margin: '0 auto', padding: 16 };
    if (erro && estado === undefined) return <div style={caixa}><div className="fo-card">Não foi possível carregar: {erro}</div></div>;
    if (estado === undefined) return <div style={{ ...caixa, color: '#666' }}>Carregando…</div>;
    if (estado === null) return <div style={caixa}><div className="fo-card">Link não encontrado ou expirado.</div></div>;

    const { ordem, etapas, ocorrencias, sobra, destino } = estado;
    const pausado = C.pausado(ocorrencias);
    const un = C.unidadeDoTitulo(ordem.titulo);
    return (
      <div style={caixa}>
        <style>{U.CSS}</style>
        <div className="fo-card">
          <div className="fo-head">
            <div>
              <div className="fo-meta">{destino === 'corrimao' ? 'Fabricação de corrimão' : 'Fabricação — corte'}</div>
              <div className="fo-tit">{ordem.numero}{un ? ` · unidade ${un.n}/${un.de}` : ''}</div>
              <div className="fo-sub">{ordem.titulo}</div>
              <div className="fo-meta">{ordem.cliente || ''}{ordem.prazo_entrega ? ' · entrega ' + U.fmtData(ordem.prazo_entrega) : ''}{destino === 'corte' && ordem.quantidade ? ' · qtd ' + ordem.quantidade : ''}</div>
              {pausado && <div className="fo-pausa">PAUSADA — falta de material</div>}
              {ordem.status === 'concluida' && <div className="fo-ok">✓ Concluída</div>}
            </div>
            <div className="fo-pct">{C.progresso(etapas)}%</div>
          </div>
          <div className="fo-form"><input className="fo-in" placeholder="Seu nome (fica no registro)" value={nome} onChange={(e) => guardarNome(e.target.value)} /></div>
          <U.Trilha etapas={etapas} pausado={pausado} podeDesmarcar={false} busy={busy}
            onToggle={(id, marcar) => { if (marcar) agir(() => S.flegar(token, id, true, nome)); }} />
          <U.Ocorrencias ocorrencias={ocorrencias} busy={busy}
            onAbrir={(cod, desc, frente) => agir(() => S.abrirOcorrencia(token, cod, desc, frente))}
            onResolver={(id) => agir(() => S.resolverOcorrencia(token, id))} />
          {destino === 'corte' && <U.Sobra sobra={sobra} busy={busy} onSalvar={(q, obs) => agir(() => S.registrarSobra(token, q, obs))} />}
        </div>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('fo-root')).render(<App />);
})();
