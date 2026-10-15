/* ============================================================
   pagamentos-instalador-recibos.jsx
   Aba "Recibos" de Pagamentos a Instaladores (15/10/2026).
   Omie paga -> o sistema registra aqui -> link de recibo -> o montador assina -> cai neste quadro.
   Recibo de ADIANTAMENTO assinado é abatido das parcelas do contrato (aba Parcelas).
   ============================================================ */
const PIR_fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PIR_data = (d) => { if (!d) return '—'; const [a, m, di] = String(d).slice(0, 10).split('-'); return `${di}/${m}/${a}`; };
const PIR_mask = (v) => { const d = String(v || '').replace(/\D/g, ''); return d ? (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; };
const PIR_hoje = () => new Date().toISOString().slice(0, 10);

function PIR_mensagemWhatsApp(rec, link) {
  return `Olá! Segue o recibo do pagamento de ${PIR_fmt(rec.valor)} feito pela Vertical Parts em ${PIR_data(rec.data_pagamento)}${rec.dossier_id ? ` (Dossiê ${rec.dossier_id})` : ''}. ` +
    `Por favor, abra o link, confira e assine para confirmar o recebimento:\n${link}`;
}
function PIR_abrirWhatsApp(telefone, texto) {
  let n = String(telefone || '').replace(/\D/g, '');
  if (n && !n.startsWith('55')) n = '55' + n;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}
async function PIR_copiar(texto) {
  try { await navigator.clipboard.writeText(texto); window.toast?.('Link copiado.', 'success'); }
  catch (_) { window.prompt('Copie o link:', texto); }
}

function PIR_Status({ s }) {
  const m = { pendente: ['warning', 'Aguardando assinatura'], assinado: ['success', 'Assinado'], recusado: ['danger', 'Recusado'], cancelado: ['neutral', 'Cancelado'] }[s] || ['neutral', s];
  return <Badge variant={m[0]} style={{ whiteSpace: 'nowrap' }}>{m[1]}</Badge>;
}

function PIR_ModalNovo({ acordos, montadores, onClose, onCreated }) {
  const [f, setF] = React.useState({ tipo: 'adiantamento', acordo_id: '', parceiro_instalador_id: '', valor: '', data_pagamento: PIR_hoje(), forma: 'PIX', descricao: '' });
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const acordo = acordos.find((a) => a.id === f.acordo_id);

  const escolherAcordo = (id) => {
    const a = acordos.find((x) => x.id === id);
    setF((p) => ({ ...p, acordo_id: id, parceiro_instalador_id: a ? a.parceiro_instalador_id : p.parceiro_instalador_id }));
  };

  const salvar = async () => {
    setErro('');
    const m = montadores.find((x) => x.id === f.parceiro_instalador_id);
    const payload = {
      ...f, valor: window.InstaladorAcordosStore.moedaParaNumero(f.valor),
      dossier_id: acordo ? acordo.dossier_id : null, acordo_id: acordo ? acordo.id : null, contrato_id: acordo ? acordo.contrato_id : null,
      instalador_nome: m ? m.nome : (acordo ? acordo.instalador_nome : null), instalador_cnpj: m ? m.cnpj : null,
    };
    const erros = window.InstaladorRecibosStore.validar(payload);
    if (erros.length) { setErro(erros.join(' ')); return; }
    setSalvando(true);
    try { const rec = await window.InstaladorRecibosStore.criar(payload); onCreated(rec, m); }
    catch (e) { setErro(e.message || 'Não foi possível gerar o recibo.'); }
    setSalvando(false);
  };

  return (
    <Modal title="Novo recibo de pagamento" onClose={onClose} width={620}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={salvando} onClick={salvar}>{salvando ? 'Gerando…' : 'Gerar recibo'}</Button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="small muted">Tipo</label>
          <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="adiantamento">Adiantamento (será abatido das parcelas)</option>
            <option value="parcela">Pagamento de parcela do contrato</option>
          </select>
        </div>
        <div>
          <label className="small muted">Equipamento / Dossiê com preço combinado</label>
          <select className="input" value={f.acordo_id} onChange={(e) => escolherAcordo(e.target.value)}>
            <option value="">— sem vínculo (escolher só a empresa) —</option>
            {acordos.map((a) => <option key={a.id} value={a.id}>{a.dossier_id} · {a.instalador_nome || a.parceiro_instalador_id} · {PIR_fmt(a.valor_combinado)}</option>)}
          </select>
        </div>
        <div>
          <label className="small muted">Empresa instaladora *</label>
          <select className="input" value={f.parceiro_instalador_id} onChange={(e) => set('parceiro_instalador_id', e.target.value)} disabled={!!acordo}>
            <option value="">— escolha —</option>
            {montadores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div><label className="small muted">Valor pago (R$) *</label><input className="input" inputMode="numeric" value={f.valor} onChange={(e) => set('valor', PIR_mask(e.target.value))} placeholder="0,00" /></div>
          <div><label className="small muted">Data do pagamento *</label><input className="input" type="date" value={f.data_pagamento} onChange={(e) => set('data_pagamento', e.target.value)} /></div>
          <div><label className="small muted">Forma</label>
            <select className="input" value={f.forma} onChange={(e) => set('forma', e.target.value)}><option>PIX</option><option>TED</option><option>Boleto</option><option>Dinheiro</option></select></div>
        </div>
        <div><label className="small muted">Descrição (aparece no recibo)</label>
          <input className="input" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex.: Adiantamento para compra de material — Dossiê DOS-M013" /></div>
        {erro && <div className="small" style={{ color: 'var(--vp-danger)' }}>{erro}</div>}
      </div>
    </Modal>
  );
}

function PagamentosRecibosAba() {
  const [recibos, setRecibos] = React.useState(null);
  const [acordos, setAcordos] = React.useState([]);
  const [montadores, setMontadores] = React.useState([]);
  const [modal, setModal] = React.useState(false);
  const [criado, setCriado] = React.useState(null);   // { rec, montador } — mostra o link logo depois de gerar
  const [podeEditar, setPodeEditar] = React.useState(false);

  const reload = React.useCallback(() => { window.InstaladorRecibosStore.listar().then(setRecibos).catch(() => setRecibos([])); }, []);
  React.useEffect(() => {
    reload();
    window.InstaladorAcordosStore.listar().then((l) => setAcordos((l || []).filter((a) => a.status !== 'cancelado'))).catch(() => {});
    window.RHHomologacao?.listarMontadores().then((l) => setMontadores(l || [])).catch(() => {});
    Promise.resolve(window.PropostaStore?.temCapacidade?.('pagamentos-instalador', 'editar')).then((ok) => setPodeEditar(!!ok)).catch(() => {});
  }, [reload]);

  if (recibos === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const soma = (pred) => recibos.filter(pred).reduce((t, r) => t + Number(r.valor || 0), 0);
  const telefoneDe = (r) => (montadores.find((m) => m.id === r.parceiro_instalador_id) || {}).telefone || '';
  const enviarWhats = async (r) => {
    const link = window.InstaladorRecibosStore.linkPublico(r.token);
    PIR_abrirWhatsApp(telefoneDe(r), PIR_mensagemWhatsApp(r, link));
    await window.InstaladorRecibosStore.marcarEnviado(r.id); reload();
  };
  const cancelar = async (r) => {
    if (!window.confirm(`Cancelar o recibo ${r.id}?`)) return;
    try { await window.InstaladorRecibosStore.cancelar(r.id); reload(); } catch (e) { window.toast?.(e.message, 'warning'); }
  };

  return (
    <>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <KPI label="Aguardando assinatura" value={PIR_fmt(soma((r) => r.status === 'pendente'))} sub={`${recibos.filter((r) => r.status === 'pendente').length} recibo(s)`} icon="clock" />
        <KPI label="Confirmados pelo montador" value={PIR_fmt(soma((r) => r.status === 'assinado'))} sub={`${recibos.filter((r) => r.status === 'assinado').length} recibo(s) assinado(s)`} icon="check" />
        <KPI label="Adiantamentos a abater" value={PIR_fmt(soma((r) => r.status === 'assinado' && r.tipo === 'adiantamento'))} sub="descontado das parcelas dos contratos" icon="dollar" />
      </div>
      <div style={{ display: 'flex', marginBottom: 12 }}>
        <div style={{ flex: 1 }} />
        {podeEditar && <Button variant="primary" onClick={() => setModal(true)}>+ Novo recibo</Button>}
      </div>
      <Card title="Recibos de pagamento" sub="O montador assina pelo link e o recibo fica registrado aqui">
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="t pcp-grid">
            <thead><tr><th>Recibo</th><th>Instalador</th><th>Dossiê</th><th>Tipo</th><th>Valor</th><th>Pago em</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {recibos.length === 0 && <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum recibo gerado ainda.</td></tr>}
              {recibos.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.id}</td>
                  <td>{r.instalador_nome || r.parceiro_instalador_id}</td>
                  <td className="mono">{r.dossier_id || '—'}</td>
                  <td className="small">{r.tipo === 'adiantamento' ? 'Adiantamento' : 'Parcela'}</td>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}><b>{PIR_fmt(r.valor)}</b></td>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{PIR_data(r.data_pagamento)}</td>
                  <td><PIR_Status s={r.status} />{r.status === 'assinado' && <div className="small muted">{(r.audit || {}).signerName}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {r.status === 'pendente' && <>
                      <Button size="sm" variant="ghost" onClick={() => PIR_copiar(window.InstaladorRecibosStore.linkPublico(r.token))}>Copiar link</Button>
                      <Button size="sm" variant="ghost" onClick={() => enviarWhats(r)}>WhatsApp</Button>
                      {podeEditar && <Button size="sm" variant="ghost" onClick={() => cancelar(r)}>Cancelar</Button>}
                    </>}
                    {r.status === 'assinado' && <Button size="sm" variant="ghost" onClick={() => window.open(window.InstaladorRecibosStore.linkPublico(r.token), '_blank', 'noopener')}>Ver recibo</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && <PIR_ModalNovo acordos={acordos} montadores={montadores} onClose={() => setModal(false)}
        onCreated={(rec, m) => { setModal(false); setCriado({ rec, montador: m }); reload(); }} />}
      {criado && (
        <Modal title="Recibo gerado" onClose={() => setCriado(null)} width={520}
          footer={<Button variant="primary" onClick={() => setCriado(null)}>Fechar</Button>}>
          <p style={{ fontSize: 14 }}>Recibo <b className="mono">{criado.rec.id}</b> de <b>{PIR_fmt(criado.rec.valor)}</b> para <b>{criado.rec.instalador_nome || 'o montador'}</b>. Envie o link para ele assinar:</p>
          <input className="input" readOnly value={window.InstaladorRecibosStore.linkPublico(criado.rec.token)} onFocus={(e) => e.target.select()} style={{ marginTop: 10 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="ghost" onClick={() => PIR_copiar(window.InstaladorRecibosStore.linkPublico(criado.rec.token))}>Copiar link</Button>
            <Button variant="primary" onClick={() => { enviarWhats(criado.rec); }}>Enviar por WhatsApp</Button>
          </div>
          {!(criado.montador && criado.montador.telefone) && <p className="small muted" style={{ marginTop: 8 }}>A empresa não tem telefone no cadastro — o WhatsApp abre sem destinatário; escolha o contato.</p>}
        </Modal>
      )}
    </>
  );
}

window.PagamentosRecibosAba = PagamentosRecibosAba;
