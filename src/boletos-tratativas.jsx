/* ============================================================
   boletos-tratativas.jsx — Financeiro & Preços › Boletos Avisos › aba "Tratativas" (19/11/2026, pedido do Gelson).
   Um caso por cliente: avisos enviados, respostas, devoluções e anotações numa linha do tempo só.
   Lista: /adm-financeiro/boletos-avisos/tratativas · Caso: /adm-financeiro/boletos-avisos/tratativas/<cliente>
   Quem só lê vê tudo sem os controles; os 3 fixos e quem tem a caixa "tratar" anotam e mudam o caso (o banco confere de novo).
   Regras em boletos-tratativas-calc.js; leitura e gravação em BoletosAvisosStore. Responder por e-mail é a etapa 2.
   ============================================================ */
const BT_COR = { novo: '#2563eb', aberto: '#d97706', em_tratativa: '#7c3aed', aguardando_cliente: '#0891b2', resolvido: '#16a34a' };
const BT_COR_TIPO = { aviso: '#2563eb', aviso_erro: '#dc2626', resposta: '#16a34a', devolucao: '#dc2626', nota: '#7c3aed', status: '#6b7280', atribuicao: '#6b7280', promessa: '#d97706', resposta_enviada: '#0891b2' };

function BtStatus({ s }) {
  const T = window.BoletosTratativasCalc;
  const cor = BT_COR[s] || '#6b7280';
  return <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: cor + '22', color: cor, border: '1px solid ' + cor }}>{T.ROTULO_STATUS[s] || s}</span>;
}
const btQuando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function BtCaso({ cod, rotulo, caso, podeTratar, voltar, recarregar }) {
  const S = window.BoletosAvisosStore, T = window.BoletosTratativasCalc, C = window.BoletosAvisosCalc;
  const n = Number(cod);
  const [log, setLog] = React.useState(null);
  const [trat, setTrat] = React.useState(null);
  const [boletos, setBoletos] = React.useState(null);
  const [pessoas, setPessoas] = React.useState([]);
  const [erro, setErro] = React.useState(null);
  const [status, setStatus] = React.useState(caso ? caso.status : 'aberto');
  const [resp, setResp] = React.useState(caso ? caso.responsavel_email || '' : '');
  const [prom, setProm] = React.useState(caso ? caso.promessa_pagamento || '' : '');
  const [nota, setNota] = React.useState('');
  const [busy, setBusy] = React.useState(null);

  const carregar = React.useCallback(async () => {
    try {
      const [l, t, b] = await Promise.all([S.logDoCliente(n), S.tratativasDoCliente(n), S.boletosDoCliente(n)]);
      setLog(l); setTrat(t); setBoletos(b); setErro(null);
    } catch (e) { setErro(e.message); setLog(l => l || []); setTrat(t => t || []); }
  }, [n]);
  React.useEffect(() => {
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);
  React.useEffect(() => { S.responsaveis().then(setPessoas).catch(() => setPessoas([])); }, []);
  React.useEffect(() => {   // quando o caso muda no banco (salvar, recarregar), os campos acompanham
    setStatus(caso ? caso.status : 'aberto'); setResp(caso ? caso.responsavel_email || '' : ''); setProm(caso ? caso.promessa_pagamento || '' : '');
  }, [caso && caso.status, caso && caso.responsavel_email, caso && caso.promessa_pagamento]);

  const salvarCaso = async () => {
    const patch = {};
    if (!caso || status !== caso.status) patch.status = status;
    if ((resp || '') !== ((caso && caso.responsavel_email) || '')) patch.responsavel_email = resp || null;
    if ((prom || '') !== ((caso && caso.promessa_pagamento) || '')) patch.promessa_pagamento = prom || null;
    if (!Object.keys(patch).length) { window.toast?.('Nada mudou no caso.', 'info'); return; }
    setBusy('caso');
    try { await S.mudarCaso(n, patch, rotulo); window.toast?.('Caso atualizado.', 'success'); await Promise.all([carregar(), recarregar()]); }
    catch (e) { window.toast?.(e.message, 'error'); }
    setBusy(null);
  };
  const registrar = async () => {
    const txt = nota.trim();
    if (txt.length < 3) { window.toast?.('Escreva a tratativa (mínimo 3 letras).', 'error'); return; }
    setBusy('nota');
    try { await S.anotarTratativa(n, txt, rotulo); setNota(''); window.toast?.('Tratativa registrada.', 'success'); await Promise.all([carregar(), recarregar()]); }
    catch (e) { window.toast?.(e.message, 'error'); }
    setBusy(null);
  };

  const itens = T.linhaDoTempo(log || [], trat || []).slice().reverse();   // mais recente primeiro
  const totalAberto = (boletos || []).reduce((a, b) => a + Math.round(Number(b.valor || 0) * 100), 0) / 100;
  const nomes = Object.fromEntries(pessoas.map(p => [p.email.toLowerCase(), p.nome || p.email]));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro &amp; Preços · Boletos Avisos · Tratativas</div>
          <h1 className="page-head__title">{rotulo}</h1>
          <p className="page-head__sub">Tudo deste cliente em um lugar: o que foi enviado, o que ele respondeu ou devolveu e o que o time fez. {boletos ? (boletos.length + ' título(s) em aberto, ' + C.moedaBR(totalAberto) + '.') : ''}</p>
        </div>
        <div><Button size="sm" variant="outline" onClick={voltar}>← Voltar aos casos</Button></div>
      </div>
      {erro && <div style={{ color: 'var(--vp-danger)', padding: '0 16px 8px' }}>{erro}</div>}

      <Card>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="small" style={{ display: 'grid', gap: 2 }}>Status do caso
              <select className="input" aria-label="Status do caso" value={status} disabled={!podeTratar} onChange={e => setStatus(e.target.value)}>
                {T.STATUS.map(s => <option key={s.chave} value={s.chave}>{s.rotulo}</option>)}
              </select>
            </label>
            <label className="small" style={{ display: 'grid', gap: 2 }}>Responsável
              <select className="input" aria-label="Responsável" value={resp} disabled={!podeTratar} onChange={e => setResp(e.target.value)}>
                <option value="">— ninguém —</option>
                {pessoas.map(p => <option key={p.email} value={p.email}>{p.nome || p.email}</option>)}
                {resp && !nomes[resp.toLowerCase()] && <option value={resp}>{resp}</option>}
              </select>
            </label>
            <label className="small" style={{ display: 'grid', gap: 2 }}>Promessa de pagamento
              <input type="date" className="input" aria-label="Promessa de pagamento" value={prom} disabled={!podeTratar} onChange={e => setProm(e.target.value)}/>
            </label>
            {podeTratar && <Button size="sm" variant="primary" disabled={busy === 'caso'} onClick={salvarCaso}>{busy === 'caso' ? 'Salvando…' : (caso ? 'Salvar caso' : 'Abrir caso')}</Button>}
          </div>
          {caso && T.promessaVencida(caso, C.hojeBrasil()) && <div role="alert" style={{ color: '#b45309' }}>A promessa de pagamento era para {C.dataBR(caso.promessa_pagamento)} e o caso não foi resolvido.</div>}
          {!podeTratar && <div className="small muted">Você pode ler este caso. Para anotar ou mudar o status, peça a caixa "Trata os casos" em Administração › Alçadas.</div>}
          {podeTratar && (
            <div style={{ display: 'grid', gap: 6 }}>
              <textarea className="input" aria-label="Registrar tratativa" rows={3} maxLength={4000} placeholder="Registrar tratativa (ex.: liguei, o cliente vai pagar na sexta). Fica só aqui, não vai para o cliente." value={nota} onChange={e => setNota(e.target.value)}/>
              <div><Button size="sm" variant="outline" disabled={busy === 'nota' || nota.trim().length < 3} onClick={registrar}>{busy === 'nota' ? 'Registrando…' : 'Registrar tratativa'}</Button></div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ padding: 16, display: 'grid', gap: 10 }} aria-label="Linha do tempo do caso">
          <div style={{ fontWeight: 700 }}>Linha do tempo</div>
          {log === null && <div className="muted">Carregando…</div>}
          {log !== null && !itens.length && <div className="muted">Nada registrado ainda para este cliente.</div>}
          {itens.map(i => (
            <div key={i.id} data-tipo={i.tipo} style={{ borderLeft: '4px solid ' + (BT_COR_TIPO[i.tipo] || '#9ca3af'), paddingLeft: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <b style={i.tipo === 'devolucao' || i.tipo === 'aviso_erro' ? { color: '#dc2626' } : undefined}>{i.titulo}</b>
                <span className="small muted">{btQuando(i.quando)}{i.autor ? ' · ' + (nomes[String(i.autor).toLowerCase()] || i.autor) : ''}{i.de ? ' · ' + i.de : ''}</span>
              </div>
              {i.para && i.para.length > 0 && <div className="small muted">Para: {i.para.join(', ')}</div>}
              {i.texto && <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{String(i.texto).slice(0, 1200)}</div>}
              {i.erro && <div className="small" style={{ color: 'var(--vp-danger)' }}>{i.erro}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BoletosTratativas({ voltar, casos, painel, lista, recarregar, podeTratar }) {
  const T = window.BoletosTratativasCalc, C = window.BoletosAvisosCalc;
  const [cod, setCod] = window.useRotaItem('boletos-avisos', 'tratativas');
  const ord = window.useOrdenacao ? window.useOrdenacao() : { th: (k, r) => <th>{r}</th>, aplicar: (l) => l };
  const [fStatus, setFStatus] = React.useState('');
  const [fResp, setFResp] = React.useState('');
  const [soSem, setSoSem] = React.useState(false);
  const [q, setQ] = React.useState('');

  if (cod) {
    const base = (lista || []).find(c => String(c.codigo_cliente_omie) === String(cod)) || (casos || []).find(c => String(c.codigo_cliente_omie) === String(cod));
    const caso = ((painel && painel.casos) || []).find(c => String(c.codigo_cliente_omie) === String(cod)) || null;
    return <BtCaso cod={cod} rotulo={(base && base.razao_social) || 'Cliente ' + cod} caso={caso} podeTratar={podeTratar} voltar={() => setCod(null)} recarregar={recarregar}/>;
  }

  const termo = q.trim().toLowerCase();
  const filtrados = (casos || []).filter(c => (!fStatus || c.status === fStatus) && (!fResp || (fResp === '-' ? !c.responsavel : c.responsavel === fResp)) && (!soSem || c.semRespostaNossa)
    && (!termo || (c.razao_social || '').toLowerCase().includes(termo) || String(c.cnpj || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '') || '§')));
  const ordem = { novo: 0, aberto: 1, em_tratativa: 2, aguardando_cliente: 3, resolvido: 4 };
  const linhas = ord.aplicar(filtrados, {
    razao: (c) => c.razao_social, status: (c) => ordem[c.status], resp: (c) => c.responsavel || '', ultima: (c) => (c.ultima ? Date.parse(c.ultima.quando) : null),
    promessa: (c) => c.promessa || '',
  });
  const responsaveis = [...new Set((casos || []).map(c => c.responsavel).filter(Boolean))].sort();
  const hoje = C.hojeBrasil();

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro &amp; Preços · Boletos Avisos · Tratativas</div>
          <h1 className="page-head__title">Tratativas</h1>
          <p className="page-head__sub">Clientes que responderam, reclamaram ou tiveram o e-mail devolvido, e os casos em andamento. Abra um cliente para ver tudo o que foi enviado e respondido, anotar o que foi combinado e acompanhar até resolver. Quem só lê vê tudo, sem os botões.</p>
        </div>
        <div><Button size="sm" variant="outline" onClick={voltar}>← Voltar aos boletos</Button></div>
      </div>

      <Card>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          {painel && painel.semTabelas && <div role="alert" style={{ color: '#b45309' }}>As tabelas de tratativas ainda não foram criadas no banco. Os e-mails respondidos e devolvidos já aparecem; anotar e mudar o status só funcionam depois disso.</div>}
          {painel && painel.erro && <div role="alert" style={{ color: 'var(--vp-danger)' }}>Não consegui ler todas as tratativas: {painel.erro}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" placeholder="Buscar por razão social ou CNPJ…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 300 }}/>
            <select className="input" aria-label="Filtrar por status" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="novo">Novo</option>
              {T.STATUS.filter(s => s.chave !== 'resolvido').map(s => <option key={s.chave} value={s.chave}>{s.rotulo}</option>)}
            </select>
            <select className="input" aria-label="Filtrar por responsável" value={fResp} onChange={e => setFResp(e.target.value)}>
              <option value="">Todos os responsáveis</option>
              <option value="-">Sem responsável</option>
              {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={soSem} onChange={e => setSoSem(e.target.checked)}/> Só os que ainda esperam nossa resposta</label>
            <span className="small muted">{linhas.length} caso(s)</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>{ord.th('razao', 'Cliente')}{ord.th('status', 'Status')}{ord.th('resp', 'Responsável')}{ord.th('ultima', 'Última mensagem')}{ord.th('promessa', 'Promessa')}<th>Alertas</th></tr></thead>
            <tbody>
              {!(casos || []).length && <tr><td colSpan={6} className="muted">Nenhum caso pedindo atenção. Quando um cliente responder um aviso, ou um e-mail for devolvido, ele aparece aqui.</td></tr>}
              {(casos || []).length > 0 && !linhas.length && <tr><td colSpan={6} className="muted">Nenhum caso com esses filtros.</td></tr>}
              {linhas.map(c => (
                <tr key={c.codigo_cliente_omie} data-cliente={c.codigo_cliente_omie} onClick={() => setCod(String(c.codigo_cliente_omie))} style={{ cursor: 'pointer' }}>
                  <td><b>{c.razao_social}</b>{c.cnpj ? <span className="muted small"> · {c.cnpj}</span> : null}</td>
                  <td><BtStatus s={c.status}/></td>
                  <td className="small">{c.responsavel || <span className="muted">—</span>}</td>
                  <td className="small">{c.ultima ? <><b>{btQuando(c.ultima.quando)}</b> · {c.ultima.tipo === 'resposta' ? 'respondeu' : c.ultima.tipo === 'devolvido' ? 'e-mail devolvido' : 'falha no envio'}<div className="muted">{c.ultima.trecho}</div></> : <span className="muted">—</span>}</td>
                  <td className="small">{c.promessa ? C.dataBR(c.promessa) : <span className="muted">—</span>}</td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.semRespostaNossa && <Badge variant="danger">espera nossa resposta</Badge>}
                    {c.devolvido && <Badge variant="danger">e-mail devolvido</Badge>}
                    {c.falha && <Badge variant="warning">falha no envio</Badge>}
                    {c.promessaVencida && <Badge variant="warning">promessa vencida</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { BoletosTratativas });
