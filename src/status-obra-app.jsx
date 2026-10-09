/* ============================================================
   status-obra-app.jsx — página pública de status da obra (15/08)
   Rota: /status-obra/<token> (server.js entrega status-obra.html, token
   lido do path aqui). Somente leitura — sem SSO, sem edição. Pra que o
   cliente/fornecedor veja o andamento da instalação sem precisar logar.
   ============================================================ */
(function () {
  'use strict';

  /* Duas rotas, mesmo arquivo: /status-obra/<token> (cliente, só leitura)
     e /status-obra-interno/<token> (equipe, com anotação). */
  function modoDoPath() {
    return window.location.pathname.startsWith('/status-obra-interno/') ? 'interno' : 'cliente';
  }
  function tokenDoPath() {
    const m = window.location.pathname.match(/\/status-obra(?:-interno)?\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fmtData(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  }
  function fmtDataHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* Bloco de anotação embutido no card — "Anotar" expande dentro do
     próprio card (não some pro rodapé), quem está justificando em
     reunião já escreve ali na hora. Reusado pelos itens do Cronograma
     e pelos da Sessão Administrativa — mesma tabela (status_obra_
     anotacoes), chave por item.id ou item.chave conforme o caso. Sem
     SSO nessa página, então quem anota digita o próprio nome na hora. */
  function AnotacaoInline({ chave, anotacao, modo, podeAnotar, onSalvarAnotacao }) {
    const [aberto, setAberto] = React.useState(false);
    const [nomeQuemAnota, setNomeQuemAnota] = React.useState('');
    const [rascunho, setRascunho] = React.useState({ naoAplicavel: false, previsaoData: '', nota: '' });

    if (modo !== 'interno' || !podeAnotar) return null;

    const abrir = () => {
      const a = anotacao || {};
      setRascunho({ naoAplicavel: !!a.nao_aplicavel, previsaoData: a.previsao_data || '', nota: a.nota || '' });
      setAberto(true);
    };
    const salvar = async () => {
      await onSalvarAnotacao(chave, { ...rascunho, atualizadoPor: nomeQuemAnota || 'Equipe' });
      setAberto(false);
    };

    if (!aberto) {
      return <button onClick={abrir} style={{ fontSize: 11, color: '#0066cc', background: 'none', border: '1px solid #0066cc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Anotar</button>;
    }
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <input placeholder="Seu nome" value={nomeQuemAnota} onChange={(e) => setNomeQuemAnota(e.target.value)} style={{ fontSize: 12, padding: 6, border: '1px solid #ddd', borderRadius: 4 }} />
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={rascunho.naoAplicavel} onChange={(e) => setRascunho((r) => ({ ...r, naoAplicavel: e.target.checked }))} />
          Não se aplica a esta obra
        </label>
        {!rascunho.naoAplicavel && (
          <div>
            <label style={{ fontSize: 11, color: '#666' }}>Previsão de conclusão</label>
            <input type="date" value={rascunho.previsaoData} onChange={(e) => setRascunho((r) => ({ ...r, previsaoData: e.target.value }))} style={{ display: 'block', fontSize: 12, padding: 6, border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
        )}
        <textarea placeholder="Nota (opcional)" rows={2} value={rascunho.nota} onChange={(e) => setRascunho((r) => ({ ...r, nota: e.target.value }))} style={{ fontSize: 12, padding: 6, border: '1px solid #ddd', borderRadius: 4, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={salvar} style={{ fontSize: 12, background: '#0066cc', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>Salvar</button>
          <button onClick={() => setAberto(false)} style={{ fontSize: 12, background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    );
  }

  function AnotacaoTexto({ anotacao }) {
    const a = anotacao;
    if (!a) return null;
    if (a.nao_aplicavel) return <div style={{ fontSize: 11.5, color: '#888', marginTop: 3 }}>Não se aplica a esta obra{a.nota ? ` — ${a.nota}` : ''}</div>;
    if (a.previsao_data) return <div style={{ fontSize: 11.5, color: '#b5540a', marginTop: 3 }}>Previsão: {fmtData(a.previsao_data)}{a.nota ? ` — ${a.nota}` : ''}</div>;
    if (a.nota) return <div style={{ fontSize: 11.5, color: '#666', marginTop: 3 }}>📝 {a.nota}</div>;
    return null;
  }

  /* Sessão Administrativa — mesmos itens nos dois modos; anotação só é
     editável no modo interno. */
  function SessaoAdministrativa({ itens, modo, anotacoes, onSalvarAnotacao }) {
    return (
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 Sessão Administrativa</div>
        {itens.map((item) => {
          const a = anotacoes[item.chave];
          const naoAplicavel = a?.nao_aplicavel;
          const ok = item.informativo || item.concluido;
          return (
            <div key={item.chave} style={{
              background: '#fff', border: '1px solid ' + (naoAplicavel ? '#ccc' : ok ? '#10b981' : '#e5e5e5'),
              borderRadius: 8, padding: '12px 16px', marginBottom: 8, opacity: naoAplicavel ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 18, marginTop: 1 }}>{item.informativo ? '👤' : naoAplicavel ? '➖' : item.concluido ? '✅' : '⬜'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.titulo}</div>
                  {item.informativo && <div style={{ fontSize: 12, color: '#444', marginTop: 3 }}>{item.pessoa}</div>}
                  {!item.informativo && item.concluido && (
                    <div style={{ fontSize: 11.5, color: '#888', marginTop: 3 }}>
                      Concluído {item.pessoa ? `por ${item.pessoa} ` : ''}em {fmtDataHora(item.data)}
                    </div>
                  )}
                  {!item.informativo && !item.concluido && <AnotacaoTexto anotacao={a} />}
                </div>
                {!item.informativo && !item.concluido && (
                  <AnotacaoInline chave={item.chave} anotacao={a} modo={modo} podeAnotar onSalvarAnotacao={onSalvarAnotacao} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function StatusObraApp() {
    const [estado, setEstado] = React.useState(null); // null=carregando, 'not-found', {dossier, itens}
    const [sessaoAdmin, setSessaoAdmin] = React.useState(null); // null=carregando
    const [anotacoes, setAnotacoes] = React.useState({});
    const modo = modoDoPath();

    React.useEffect(() => {
      const token = tokenDoPath();
      if (!token) { setEstado('not-found'); return; }
      const store = window.InstalacaoChecklistStore;
      const fetchFn = modo === 'interno' ? store.obterPorTokenInterno : store.obterPorToken;
      fetchFn(token)
        .then(async (r) => {
          setEstado(r || 'not-found');
          if (r) {
            store.obterSessaoAdministrativa(r.dossier).then(setSessaoAdmin);
            if (modo === 'interno') store.listarAnotacoes(r.dossier.id).then(setAnotacoes);
          }
        })
        .catch(() => setEstado('not-found'));
    }, []);

    const salvarAnotacaoItem = async (itemChave, patch) => {
      if (estado === null || estado === 'not-found') return;
      await window.InstalacaoChecklistStore.salvarAnotacao(estado.dossier.id, itemChave, patch);
      const fresh = await window.InstalacaoChecklistStore.listarAnotacoes(estado.dossier.id);
      setAnotacoes(fresh);
    };

    if (estado === null) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#666', fontSize: 14 }}>Carregando…</div>;
    }
    if (estado === 'not-found') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 10, color: '#666' }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Link não encontrado</div>
          <div style={{ fontSize: 13 }}>Confira o link recebido — pode ter sido digitado errado.</div>
        </div>
      );
    }

    const { dossier, itens } = estado;
    const store = window.InstalacaoChecklistStore;
    const total = itens.length;
    const concluidos = itens.filter((i) => i.status === 'concluido').length;
    const pct = total ? Math.round((concluidos / total) * 100) : 0;
    const semanas = [...new Set(itens.map((i) => i.semana))].sort((a, b) => a - b);

    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)', color: '#fff', borderRadius: 10, padding: '28px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.8, display: 'flex', gap: 8, alignItems: 'center' }}>
            Status da Instalação
            {modo === 'interno' && <span style={{ background: 'rgba(255,255,255,.2)', padding: '1px 8px', borderRadius: 10, fontSize: 10 }}>🔒 uso interno</span>}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{dossier.building_name || 'Obra'}</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>Cliente: {dossier.client_name}</div>
          {total > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{concluidos} de {total} etapas concluídas</span>
                <span style={{ fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,.25)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: '#ffd400', height: '100%', width: pct + '%' }}/>
              </div>
            </div>
          )}
        </div>

        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 13 }}>
            O cronograma de instalação desta obra ainda não foi iniciado.
          </div>
        ) : semanas.map((sem) => (
          <div key={sem} style={{ marginBottom: 22 }}>
            <div style={{ borderLeft: `4px solid ${store.semanaCor(sem)}`, paddingLeft: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: store.semanaCor(sem), fontWeight: 700 }}>Semana {sem}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{store.semanaTitulo(sem)}</div>
            </div>
            {itens.filter((i) => i.semana === sem).map((item) => {
              const a = anotacoes[item.id];
              return (
              <div key={item.id} style={{
                background: '#fff', border: '1px solid ' + (item.status === 'concluido' ? '#10b981' : '#e5e5e5'),
                borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
                opacity: item.status === 'nao_aplicavel' ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 18, marginTop: 1 }}>
                  {item.status === 'concluido' ? '✅' : item.status === 'nao_aplicavel' ? '➖' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.etapa}</div>
                  {item.servicos && item.servicos.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                      {item.servicos.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {item.resultado_esperado && (
                    <div style={{ fontSize: 12, color: '#0a7a3d', marginTop: 4 }}>✓ {item.resultado_esperado}</div>
                  )}
                  {item.status === 'concluido' && (
                    <div style={{ fontSize: 11.5, color: '#888', marginTop: 6 }}>Concluído em {fmtData(item.concluido_em)}</div>
                  )}
                  {item.status !== 'concluido' && <AnotacaoTexto anotacao={a} />}
                </div>
                {item.status !== 'concluido' && (
                  <AnotacaoInline chave={item.id} anotacao={a} modo={modo} podeAnotar onSalvarAnotacao={salvarAnotacaoItem} />
                )}
              </div>
              );
            })}
          </div>
        ))}

        {sessaoAdmin === null && (
          <div style={{ marginTop: 28, fontSize: 12, color: '#999' }}>Carregando Sessão Administrativa…</div>
        )}
        {sessaoAdmin !== null && sessaoAdmin.length > 0 && (
          <SessaoAdministrativa itens={sessaoAdmin} modo={modo} anotacoes={anotacoes} onSalvarAnotacao={salvarAnotacaoItem} />
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: '#aaa' }}>Vertical Parts</div>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('so-root')).render(<StatusObraApp/>);
}());
