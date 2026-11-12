/* Financeiro & Preços › Boletos Avisos — ver boletos-avisos-store.js e docs/modulos/05_financeiro_precos.md (5.5) */
function BavSemaforo({ situacao, dias }) {
  const C = window.BoletosAvisosCalc;
  const s = C.SITUACOES[situacao] || C.SITUACOES.em_dia;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: s.cor, display: 'inline-block' }}/>
      <b>{s.rotulo}</b>
      {situacao === 'atrasado' && dias > 0 && <span className="muted">{dias} dia{dias > 1 ? 's' : ''}</span>}
    </span>
  );
}

function BavDetalhe({ cliente }) {
  const S = window.BoletosAvisosStore, C = window.BoletosAvisosCalc;
  const [boletos, setBoletos] = React.useState(null);
  const [log, setLog] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const hoje = C.hojeBrasil();

  const carregar = React.useCallback(async () => {
    try {
      const [b, l] = await Promise.all([S.boletosDoCliente(cliente.codigo_cliente_omie), S.logDoCliente(cliente.codigo_cliente_omie)]);
      setBoletos(b); setLog(l); setErro(null);
    } catch (e) { setErro(e.message); }
  }, [cliente.codigo_cliente_omie]);
  React.useEffect(() => {
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  return (
    <div style={{ padding: '8px 16px 16px 40px', display: 'grid', gap: 16 }}>
      {erro && <div style={{ color: 'var(--vp-danger)' }}>{erro}</div>}
      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Boletos em aberto</div>
        <table className="t pcp-grid">
          <thead><tr><th>Situação</th><th>NF · parcela</th><th>Vencimento</th><th>Valor</th><th>Boleto</th></tr></thead>
          <tbody>
            {boletos === null && <tr><td colSpan={5}>Carregando…</td></tr>}
            {(boletos || []).map(b => (
              <tr key={b.codigo_lancamento_omie}>
                <td><BavSemaforo situacao={C.situacaoDoBoleto(b.data_vencimento, hoje)} dias={C.diasDesdeVencimento(b.data_vencimento, hoje)}/></td>
                <td>{[b.numero_documento, b.numero_parcela].filter(Boolean).join(' · ') || '—'}</td>
                <td>{C.dataBR(b.data_vencimento)}</td>
                <td>{C.moedaBR(b.valor)}</td>
                <td>{b.numero_boleto || '—'}</td>
              </tr>
            ))}
          </tbody>
          {boletos && boletos.length > 0 && <tfoot><tr><td colSpan={3}><b>Total em aberto deste cliente</b></td><td colSpan={2}><b>{C.moedaBR(boletos.reduce((a, b) => a + Math.round(Number(b.valor || 0) * 100), 0) / 100)}</b></td></tr></tfoot>}
        </table>
      </div>
      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Log de envios e respostas</div>
        {log !== null && !log.length && <div className="muted">Nenhum aviso enviado a este cliente ainda.</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {(log || []).map(e => (
            <div key={e.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{new Date(e.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</b>
                <Badge variant={e.status === 'enviado' ? 'success' : 'danger'}>{e.status === 'enviado' ? 'Enviado' : 'Erro'}</Badge>
                <Badge variant="neutral">{C.ETAPA_ROTULO[e.etapa] || e.etapa}</Badge>
                <span className="muted small">{e.origem === 'manual' ? `manual · ${e.enviado_por || ''}` : 'automático'}</span>
                {e.modo_teste && <Badge variant="warning">modo teste</Badge>}
              </div>
              <div className="small" style={{ marginTop: 4 }}>Para: {(e.para || []).join(', ') || '—'}</div>
              <div className="small muted">{e.assunto}</div>
              {e.erro && <div className="small" style={{ color: 'var(--vp-danger)' }}>{e.erro}</div>}
              {e.respostas.length > 0
                ? e.respostas.map(r => (
                  <div key={r.id} style={{ marginTop: 8, borderLeft: '3px solid #16a34a', paddingLeft: 10 }}>
                    <div className="small"><b>Resposta do cliente</b> · {r.de_nome || r.de_email} · {new Date(r.data_mensagem).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{String(r.corpo_texto || '').slice(0, 600) || '(sem texto)'}</div>
                  </div>
                ))
                : <div className="small muted" style={{ marginTop: 6 }}>Sem resposta do cliente.</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoletosAvisosPage() {
  const S = window.BoletosAvisosStore, C = window.BoletosAvisosCalc;
  const [acesso, setAcesso] = React.useState(null);
  const [lista, setLista] = React.useState(null);
  const [abertos, setAbertos] = React.useState([]);
  const [cfg, setCfg] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  const [aberto, setAberto] = window.useRotaId ? window.useRotaId('boletos-avisos') : React.useState(null);
  const [q, setQ] = window.useQueryParam ? window.useQueryParam('q', '') : React.useState('');

  const carregar = React.useCallback(async () => {
    try {
      const [l, c, b] = await Promise.all([S.listarClientes(), S.config(), S.boletosAbertos()]);
      setLista(l); setCfg(c); setAbertos(b); setErro(null);
    } catch (e) { setErro(e.message); setLista([]); }
  }, []);
  React.useEffect(() => {
    let vivo = true;
    S.pode().then(ok => { if (vivo) { setAcesso(ok); if (ok) carregar(); } });
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [carregar]);

  if (acesso === null) return <div className="page fade-in"><div className="muted" style={{ padding: 24 }}>Carregando…</div></div>;
  if (!acesso) {
    return (
      <div className="page fade-in">
        <div className="page-head"><div className="page-head__l"><h1 className="page-head__title">Boletos Avisos</h1></div></div>
        <Card><div style={{ padding: 24 }}>Esta tela é restrita. Seu usuário não tem acesso.</div></Card>
      </div>
    );
  }

  const rodar = async (chave, fn, msgOk) => {
    setBusy(chave);
    try { const r = await fn(); if (msgOk) window.toast?.(msgOk(r), 'success'); await carregar(); }
    catch (e) { window.toast?.(e.message, 'error'); }
    setBusy(null);
  };
  const enviar = (c) => {
    const para = (c.emails || []).join(', ');
    const teste = cfg && cfg.destino_teste;
    if (!confirm(teste ? `MODO TESTE: o aviso de ${c.razao_social} vai só para ${cfg.destino_teste}. Enviar?` : `Enviar aviso de boleto para ${c.razao_social}?\n\nPara: ${para}`)) return;
    rodar('env' + c.codigo_cliente_omie, () => S.enviarAviso(c), (r) => `Aviso enviado para ${(r.para || []).join(', ')}.`);
  };
  const alternarAutomatico = () => {
    const ligar = !(cfg && cfg.envio_automatico);
    const texto = ligar
      ? 'LIGAR o envio automático?\n\nDe segunda a sexta, às 08h30, o sistema manda e-mail real aos clientes: 5 dias antes, 1 dia antes, no dia e 1 dia depois do vencimento, e avisa a Juliana dos atrasos.' + (cfg && cfg.destino_teste ? `\n\nModo teste ATIVO: tudo vai só para ${cfg.destino_teste}.` : '\n\nO modo teste está DESLIGADO: os e-mails vão para os clientes de verdade.')
      : 'Desligar o envio automático? Nenhum aviso sai sozinho até religar.';
    if (!confirm(texto)) return;
    rodar('auto', () => S.salvarConfig({ envio_automatico: ligar }), () => ligar ? 'Envio automático LIGADO.' : 'Envio automático desligado.');
  };
  const definirTeste = () => {
    const v = prompt('Modo teste: todo e-mail vai SÓ para este endereço (deixe vazio para desligar o modo teste e enviar aos clientes de verdade).', (cfg && cfg.destino_teste) || '');
    if (v === null) return;
    const e = v.trim().toLowerCase();
    if (e && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(e)) { window.toast?.('E-mail inválido.', 'error'); return; }
    rodar('teste', () => S.salvarConfig({ destino_teste: e || null }), () => e ? `Modo teste ligado: avisos só para ${e}.` : 'Modo teste desligado.');
  };
  const sincronizar = () => rodar('sync', () => S.sincronizar(), (r) => `Omie lido: ${r.boletosAbertos} boletos em aberto de ${r.clientes} clientes.`);
  const simular = () => rodar('sim', async () => {
    const r = await S.simularAutomatico();
    alert(`Simulação de hoje (${C.dataBR(r.hoje)}): ${r.clientesComAviso} cliente(s) com aviso devido; ${r.semEmail} sem e-mail.\n\n` + (r.simulados || []).map(x => `• ${x.cliente} — ${x.etapa} → ${(x.para || []).join(', ')}`).join('\n'));
    return r;
  });

  const filtrada = (lista || []).filter(c => !q || `${c.razao_social} ${c.cnpj || ''}`.toLowerCase().includes(q.toLowerCase()));
  const fin = C.resumoFinanceiro(abertos, C.hojeBrasil());
  const atrasadoDoCliente = new Map();
  for (const b of abertos) { if (C.situacaoDoBoleto(b.data_vencimento, C.hojeBrasil()) === 'atrasado') atrasadoDoCliente.set(b.codigo_cliente_omie, Math.round(((atrasadoDoCliente.get(b.codigo_cliente_omie) || 0) + Number(b.valor || 0)) * 100) / 100); }
  const tot = (lista || []).reduce((a, c) => { a.boletos += Number(c.qtd_boletos || 0); if (c.situacao === 'atrasado') a.atr++; if (c.situacao === 'vence_hoje') a.hoje++; if (!(c.emails || []).length) a.semEmail++; return a; }, { boletos: 0, atr: 0, hoje: 0, semEmail: 0 });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro &amp; Preços · Boletos Avisos</div>
          <h1 className="page-head__title">Boletos Avisos</h1>
          <p className="page-head__sub">Clientes com boleto em aberto no Omie. O sistema avisa por e-mail 5 dias antes, 1 dia antes, no dia e 1 dia depois do vencimento; a Juliana é avisada dos atrasos. Tela restrita: Gelson, Diego e Juliana.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Button size="sm" variant="outline" disabled={busy === 'sync'} onClick={sincronizar}>{busy === 'sync' ? 'Lendo o Omie…' : 'Atualizar do Omie'}</Button>
          <Button size="sm" variant="outline" disabled={busy === 'sim'} onClick={simular}>Simular envio de hoje</Button>
        </div>
      </div>

      <Card>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input type="checkbox" checked={!!(cfg && cfg.envio_automatico)} disabled={busy === 'auto'} onChange={alternarAutomatico}/>
            Envio automático {cfg && cfg.envio_automatico ? 'LIGADO' : 'desligado'}
          </label>
          <span className="small">Modo teste: {cfg && cfg.destino_teste ? <b>{cfg.destino_teste}</b> : <span className="muted">desligado (vai para os clientes)</span>} · <a href="#" onClick={e => { e.preventDefault(); definirTeste(); }}>alterar</a></span>
          <span className="small muted">Última leitura do Omie: {cfg && cfg.sincronizado_em ? new Date(cfg.sincronizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'}</span>
        </div>
        <div style={{ padding: '4px 16px 12px', display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {[
            { t: 'Total em aberto', v: fin.total, cor: '#111827', sub: fin.total.clientes + ' clientes · ' + fin.total.boletos + ' boletos' },
            { t: 'A vencer', v: fin.aVencer, cor: '#16a34a', sub: fin.aVencer.clientes + ' clientes · ' + fin.aVencer.boletos + ' boletos' },
            { t: 'Vence hoje', v: fin.venceHoje, cor: '#a16207', sub: fin.venceHoje.clientes + ' clientes · ' + fin.venceHoje.boletos + ' boletos' },
            { t: 'Atrasado (1 a 30 dias)', v: fin.atrasado30, cor: '#dc2626', sub: fin.atrasado30.clientes + ' clientes · ' + fin.atrasado30.boletos + ' boletos' },
            { t: 'Atrasado (mais de 30 dias)', v: fin.atrasadoMais30, cor: '#991b1b', sub: fin.atrasadoMais30.clientes + ' clientes · ' + fin.atrasadoMais30.boletos + ' boletos' },
          ].map(k => (
            <div key={k.t} style={{ border: '1px solid var(--border, #e5e7eb)', borderLeft: '4px solid ' + k.cor, borderRadius: 6, padding: '8px 12px' }}>
              <div className="small muted">{k.t}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.cor }}>{C.moedaBR(k.v.valor)}</div>
              <div className="small muted">{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 16, flexWrap: 'wrap' }} className="small">
          <span><b>{fin.pctAtrasado.toLocaleString('pt-BR')}%</b> do valor em aberto está atrasado ({C.moedaBR(fin.atrasado.valor)} de {fin.atrasado.clientes} clientes)</span>
          <span className="muted"><b>{tot.semEmail}</b> sem e-mail</span>
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <input className="input" placeholder="Buscar por razão social ou CNPJ…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }}/>
        </div>
        {erro && <div style={{ padding: 16, color: 'var(--vp-danger)' }}>{erro}</div>}
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th style={{ width: 28 }}></th><th>Situação</th><th>Razão Social</th><th style={{ textAlign: 'right' }}>Qtd de Boletos</th><th style={{ textAlign: 'right' }}>Valor em aberto</th><th>E-mail</th><th>Último aviso</th><th></th></tr></thead>
            <tbody>
              {lista === null && <tr><td colSpan={8}>Carregando…</td></tr>}
              {lista && !filtrada.length && <tr><td colSpan={8} className="muted">{(lista || []).length ? 'Nenhum cliente encontrado.' : 'Nenhum boleto em aberto lido do Omie ainda. Clique em "Atualizar do Omie".'}</td></tr>}
              {filtrada.map(c => {
                const id = String(c.codigo_cliente_omie), isOpen = aberto === id;
                const semEmail = !(c.emails || []).length;
                return (
                  <React.Fragment key={id}>
                    <tr onClick={() => setAberto(isOpen ? null : id)} style={{ cursor: 'pointer', background: isOpen ? 'var(--surface-2, #fafafa)' : undefined }}>
                      <td>{isOpen ? '▾' : '▸'}</td>
                      <td><BavSemaforo situacao={c.situacao} dias={c.dias_atraso}/></td>
                      <td><b>{c.razao_social}</b>{c.cnpj ? <span className="muted small"> · {c.cnpj}</span> : null}</td>
                      <td style={{ textAlign: 'right' }}>{c.qtd_boletos}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{C.moedaBR(c.valor_total)}</b>{atrasadoDoCliente.get(c.codigo_cliente_omie) > 0 && <div className="small" style={{ color: '#dc2626' }}>{C.moedaBR(atrasadoDoCliente.get(c.codigo_cliente_omie))} atrasado</div>}</td>
                      <td>{semEmail ? <Badge variant="warning">sem e-mail</Badge> : <span className="small" title={c.emails.join(', ')}>{c.emails[0]}{c.emails.length > 1 ? ` +${c.emails.length - 1}` : ''}</span>}</td>
                      <td className="small">{c.ultimo_aviso_em ? <>{new Date(c.ultimo_aviso_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {C.ETAPA_ROTULO[c.ultimo_aviso_etapa] || c.ultimo_aviso_etapa}{c.ultimo_aviso_status === 'erro' ? ' (erro)' : ''}</> : <span className="muted">—</span>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="primary" disabled={semEmail || busy === 'env' + id} onClick={() => enviar(c)}>{busy === 'env' + id ? 'Enviando…' : 'Enviar aviso'}</Button>
                      </td>
                    </tr>
                    {isOpen && <tr><td colSpan={8} style={{ padding: 0 }}><BavDetalhe cliente={c}/></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
Object.assign(window, { BoletosAvisosPage });
