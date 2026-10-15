/* ============================================================
   pagamentos-instalador-acordos.jsx
   Aba "Preços combinados" de Pagamentos a Instaladores (15/10/2026).
   A Engenharia cadastra, por equipamento/Dossiê (DOS-M013), a empresa
   instaladora e o valor FECHADO (ex.: tabela R$ 23k, combinado R$ 18k).
   O Contrato do Instalador herda esse valor; o pagamento é feito sobre ele.
   Tabela de Atualização de Custos continua só como referência.
   ============================================================ */
const PIA_fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PIA_mask = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const PIA_norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function PagamentosAcordosModal({ dossies, montadores, acordosAtivos, inicial, onClose, onSaved }) {
  const [f, setF] = React.useState(() => inicial ? {
    dossier_id: inicial.dossier_id, parceiro_instalador_id: inicial.parceiro_instalador_id, instalador_nome: inicial.instalador_nome,
    valor_combinado: PIA_mask(String(Math.round(Number(inicial.valor_combinado) * 100))),
    valor_tabela: inicial.valor_tabela ? PIA_mask(String(Math.round(Number(inicial.valor_tabela) * 100))) : '',
    parcelas_qtd: inicial.parcelas_qtd, observacao: inicial.observacao || '',
  } : { dossier_id: '', parceiro_instalador_id: '', instalador_nome: '', valor_combinado: '', valor_tabela: '', parcelas_qtd: 2, observacao: '' });
  const [busca, setBusca] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const editando = !!inicial;

  const dossie = dossies.find((d) => d.id === f.dossier_id);
  const jaTem = !editando && acordosAtivos.has(f.dossier_id);

  const opcoes = React.useMemo(() => {
    const q = PIA_norm(busca);
    return dossies.filter((d) => !acordosAtivos.has(d.id) && (!q || PIA_norm(`${d.id} ${d.client_name} ${d.building_name} ${d.city}`).includes(q))).slice(0, 40);
  }, [dossies, busca, acordosAtivos]);

  const escolherDossie = (d) => {
    setF((p) => {
      const m = montadores.find((x) => x.id === d.parceiro_instalador_id);
      return { ...p, dossier_id: d.id, parceiro_instalador_id: m ? m.id : p.parceiro_instalador_id, instalador_nome: m ? m.nome : p.instalador_nome };
    });
  };

  const salvar = async () => {
    setErro('');
    const erros = window.InstaladorAcordosStore.validar(f);
    if (erros.length) { setErro(erros.join(' ')); return; }
    setSalvando(true);
    try {
      await window.InstaladorAcordosStore.salvar(f);
      window.toast?.('Preço combinado salvo.', 'success');
      onSaved();
    } catch (e) { setErro(e.message || 'Não foi possível salvar.'); }
    setSalvando(false);
  };

  const diff = (() => {
    const t = window.InstaladorAcordosStore.moedaParaNumero(f.valor_tabela);
    const c = window.InstaladorAcordosStore.moedaParaNumero(f.valor_combinado);
    return t > 0 && c > 0 ? c - t : null;
  })();

  return (
    <Modal title={editando ? `Preço combinado — ${f.dossier_id}` : 'Novo preço combinado'} onClose={onClose} width={640}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={salvando || jaTem} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        {!editando && (
          <div>
            <label className="small muted">Equipamento (Dossiê) *</label>
            {dossie ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <b className="mono">{dossie.id}</b><span className="small">{dossie.client_name} — {dossie.building_name} ({dossie.city}/{dossie.state})</span>
                <Button size="sm" variant="ghost" onClick={() => set('dossier_id', '')}>trocar</Button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Buscar por nº do Dossiê (DOS-M013), cliente, obra ou cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
                <div style={{ maxHeight: 190, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 6 }}>
                  {opcoes.length === 0 && <div className="small muted" style={{ padding: 12 }}>Nenhum Dossiê sem preço combinado encontrado.</div>}
                  {opcoes.map((d) => (
                    <div key={d.id} onClick={() => escolherDossie(d)} style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vp-yellow-soft, #fff7d6)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                      <b className="mono">{d.id}</b> · {d.client_name} <span className="muted">— {d.building_name} · {d.city}/{d.state}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {jaTem && <div className="small" style={{ color: 'var(--vp-danger)', marginTop: 4 }}>Este equipamento já tem preço combinado.</div>}
          </div>
        )}
        <div>
          <label className="small muted">Empresa instaladora *</label>
          <select className="input" value={f.parceiro_instalador_id} onChange={(e) => {
            const m = montadores.find((x) => x.id === e.target.value);
            setF((p) => ({ ...p, parceiro_instalador_id: e.target.value, instalador_nome: m ? m.nome : '' }));
          }}>
            <option value="">— escolha —</option>
            {montadores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {dossie && !dossie.parceiro_instalador_id && <div className="small muted" style={{ marginTop: 3 }}>Este Dossiê ainda não tem instalador definido — a escolha aqui vale para o contrato.</div>}
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div><label className="small muted">Valor combinado (R$) *</label>
            <input className="input" inputMode="numeric" value={f.valor_combinado} onChange={(e) => set('valor_combinado', PIA_mask(e.target.value))} placeholder="0,00" /></div>
          <div><label className="small muted">Valor de tabela (referência)</label>
            <input className="input" inputMode="numeric" value={f.valor_tabela} onChange={(e) => set('valor_tabela', PIA_mask(e.target.value))} placeholder="0,00" /></div>
          <div><label className="small muted">Parcelas *</label>
            <select className="input" value={f.parcelas_qtd} onChange={(e) => set('parcelas_qtd', Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}x</option>)}
            </select></div>
        </div>
        {diff !== null && <div className="small" style={{ color: diff < 0 ? '#16794a' : '#a15c00' }}>{diff < 0 ? `Combinado ${PIA_fmt(-diff)} abaixo da tabela.` : diff > 0 ? `Combinado ${PIA_fmt(diff)} acima da tabela.` : 'Igual à tabela.'}</div>}
        <div><label className="small muted">Observação</label>
          <textarea className="input" rows={2} value={f.observacao} onChange={(e) => set('observacao', e.target.value)} placeholder="Ex.: inclui andaime; materiais por conta da VerticalParts…" /></div>
        {erro && <div className="small" style={{ color: 'var(--vp-danger)' }}>{erro}</div>}
      </div>
    </Modal>
  );
}

function PagamentosAcordosAba() {
  const [acordos, setAcordos] = React.useState(null);
  const [dossies, setDossies] = React.useState([]);
  const [montadores, setMontadores] = React.useState([]);
  const [modal, setModal] = React.useState(null);   // null | 'novo' | acordo
  const [busca, setBusca] = React.useState('');
  const [podeEditar, setPodeEditar] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    Promise.resolve(window.PropostaStore?.temCapacidade?.('contrato-instalador', 'editar')).then((ok) => { if (vivo) setPodeEditar(!!ok); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const reload = React.useCallback(() => {
    window.InstaladorAcordosStore.listar().then(setAcordos).catch(() => setAcordos([]));
  }, []);
  React.useEffect(() => {
    reload();
    window.InstaladorAcordosStore.listarDossies().then(setDossies).catch(() => {});
    window.RHHomologacao?.listarMontadores().then((l) => setMontadores(l || [])).catch(() => {});
  }, [reload]);

  if (acordos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const ativos = acordos.filter((a) => a.status !== 'cancelado');
  const ativosSet = new Set(ativos.map((a) => a.dossier_id));
  const q = PIA_norm(busca);
  const lista = ativos.filter((a) => {
    const d = dossies.find((x) => x.id === a.dossier_id) || {};
    return !q || PIA_norm(`${a.dossier_id} ${a.instalador_nome} ${d.client_name} ${d.building_name}`).includes(q);
  });
  const totalCombinado = ativos.reduce((t, a) => t + Number(a.valor_combinado || 0), 0);
  const totalTabela = ativos.reduce((t, a) => t + Number(a.valor_tabela || a.valor_combinado || 0), 0);

  const cancelar = async (a) => {
    if (!window.confirm(`Cancelar o preço combinado de ${a.dossier_id}?`)) return;
    try { await window.InstaladorAcordosStore.cancelar(a.id); window.toast?.('Acordo cancelado.', 'success'); reload(); }
    catch (e) { window.toast?.(e.message, 'warning'); }
  };

  return (
    <>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <KPI label="Equipamentos com preço" value={String(ativos.length)} sub={`${ativos.filter((a) => a.status === 'contratado').length} já contratado(s)`} icon="hardhat" />
        <KPI label="Total combinado" value={PIA_fmt(totalCombinado)} sub="soma dos acordos ativos" icon="dollar" />
        <KPI label="Economia sobre a tabela" value={PIA_fmt(Math.max(0, totalTabela - totalCombinado))} sub="onde há valor de tabela informado" icon="check" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 360 }} placeholder="Buscar por Dossiê, instalador ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div style={{ flex: 1 }} />
        {podeEditar && <Button variant="primary" onClick={() => setModal('novo')}>+ Novo preço combinado</Button>}
      </div>
      <Card title="Preço combinado por equipamento" sub="Cadastrado pela Engenharia. O Contrato do Instalador herda este valor.">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Dossiê</th><th>Obra / Cliente</th><th>Instalador</th><th>Tabela</th><th>Combinado</th><th>Parcelas</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum preço combinado cadastrado ainda.</td></tr>}
              {lista.map((a) => {
                const d = dossies.find((x) => x.id === a.dossier_id) || {};
                return (
                  <tr key={a.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{a.dossier_id}</td>
                    <td><div className="cell-main">{d.client_name || '—'}</div><div className="small muted">{d.building_name || ''}{d.city ? ` · ${d.city}/${d.state}` : ''}</div></td>
                    <td>{a.instalador_nome || a.parceiro_instalador_id}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{a.valor_tabela ? PIA_fmt(a.valor_tabela) : '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}><b>{PIA_fmt(a.valor_combinado)}</b></td>
                    <td>{a.parcelas_qtd}x</td>
                    <td>{a.status === 'contratado' ? <Badge variant="success">Contratado</Badge> : <Badge variant="info">Combinado</Badge>}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {podeEditar && a.status === 'combinado' && <>
                        <Button size="sm" variant="ghost" onClick={() => setModal(a)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelar(a)}>Cancelar</Button>
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && (
        <PagamentosAcordosModal dossies={dossies} montadores={montadores} acordosAtivos={ativosSet}
          inicial={modal === 'novo' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
    </>
  );
}

window.PagamentosAcordosAba = PagamentosAcordosAba;
