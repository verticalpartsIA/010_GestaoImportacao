/* ============================================================
   entrega.jsx — Etapas finais do workflow (pós-instalação)
   ART · Cronograma de pagamento da instalação · Data Book / Termo
   ============================================================ */

function ArtPage({ setRoute }) {
  const irObras = () => setRoute && setRoute('status-obras');
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Instalação &amp; Entrega · ART</div>
          <h1 className="page-head__title">ART de Instalação</h1>
          <p className="page-head__sub">As ARTs e demais documentos da obra são geridos por obra, na aba Documentos do Dossiê.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="arrowRight" onClick={irObras}>Abrir obras</Button>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', background: 'var(--vp-gray-50)', padding: '32px', maxWidth: 760, margin: '8px auto 0' }}>
        <p style={{ fontSize: 13, color: 'var(--fg1)', lineHeight: 1.8, margin: 0 }}>
          Para guardar a ART de uma obra: emita a ART no site do CREA, baixe o PDF e anexe-o na aba
          {' '}<b>Documentos</b> da <b>Dossiê da Obra</b> correspondente (VPEL-EL). No mesmo lugar ficam
          {' '}Termo de Vistoria, DataBook, Alvará e Termo de Entrega Final — com checklist de prontidão por obra,
          {' '}para quem precisar do documento só pegar e enviar.
        </p>
        <div style={{ marginTop: 16 }}>
          <Button variant="outline" icon="briefcase" onClick={irObras}>Ir para a lista de obras</Button>
        </div>
      </div>
    </div>
  );
}

/* Antes lia/gravava a tabela legada `projetos` (issue #274, desconectada
   da esteira real) — duplicava, pior, o que o Dossiê da Obra já faz: a
   aba Documentos já trata "DataBook" como um dos tipos de documento
   obrigatórios da obra (TIPOS_DOC_OBRA em dossier-obra.jsx), com
   checklist de prontidão. Vira redirect, mesmo padrão já usado por
   ArtPage acima — achado "Importante" da auditoria de código. */
function DataBookPage({ setRoute }) {
  const irObras = () => setRoute && setRoute('status-obras');
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Instalação & Entrega · Encerramento</div>
          <h1 className="page-head__title">Data Book & Termo de Conclusão</h1>
          <p className="page-head__sub">O Data Book de cada obra é gerido por obra, na aba Documentos do Dossiê.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="arrowRight" onClick={irObras}>Abrir obras</Button>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', background: 'var(--vp-gray-50)', padding: '32px', maxWidth: 760, margin: '8px auto 0' }}>
        <p style={{ fontSize: 13, color: 'var(--fg1)', lineHeight: 1.8, margin: 0 }}>
          Para guardar o Data Book de uma obra: compile a documentação técnica final, manuais e
          {' '}certificados, e anexe na aba <b>Documentos</b> da <b>Dossiê da Obra</b> correspondente
          {' '}(tipo "DataBook (Ebook técnico)"). O checklist de prontidão da obra mostra se esse e os
          {' '}demais documentos obrigatórios (ART, Termo de Vistoria, Termo de Entrega) já foram anexados.
        </p>
        <div style={{ marginTop: 16 }}>
          <Button variant="outline" icon="briefcase" onClick={irObras}>Ir para a lista de obras</Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CRONOGRAMA DE PAGAMENTO DA INSTALAÇÃO (mão de obra · 4 fases)
   ============================================================ */

const CRON_FASES = [
  { key: 'f1', label: '1ª Fase', marco: 'Início da instalação' },
  { key: 'f2', label: '2ª Fase', marco: 'Equipamento tracionado' },
  { key: 'f3', label: '3ª Fase', marco: 'Portas de pavimento + elétrica prontos' },
  { key: 'f4', label: '4ª Fase', marco: 'Conclusão do equipamento' },
];
const cronStatusVariant = (s) => s === 'Paga' ? 'success' : s === 'Liberada' ? 'warning' : 'neutral';
const cronPago = (r) => CRON_FASES.reduce((s, f) => s + (r[f.key + '_status'] === 'Paga' ? Number(r[f.key + '_valor'] || 0) : 0), 0);

function CronogramaPage() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNovo, setShowNovo] = React.useState(false);
  const [sel, setSel] = React.useState(null);

  const reload = () => {
    setLoading(true);
    window.__VP_SB.sb.from('instalacao_cronograma').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  };
  React.useEffect(reload, []);

  const advance = async (row, key) => {
    const cur = row[key + '_status'];
    const next = cur === 'Pendente' ? 'Liberada' : cur === 'Liberada' ? 'Paga' : 'Paga';
    const { error } = await window.__VP_SB.sb.from('instalacao_cronograma')
      .update({ [key + '_status']: next }).eq('id', row.id);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast(`${key.toUpperCase()} → ${next}`, 'success');
    setSel(s => s ? { ...s, [key + '_status']: next } : s);
    reload();
  };

  if (loading) return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg3)', fontSize:13 }}>Carregando…</div>;

  const totalContratado = rows.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const totalPago = rows.reduce((s, r) => s + cronPago(r), 0);
  const aLiberar = rows.reduce((s, r) => s + CRON_FASES.reduce((a, f) => a + (r[f.key + '_status'] === 'Liberada' ? Number(r[f.key + '_valor'] || 0) : 0), 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Instalação & Entrega · Cronograma</div>
          <h1 className="page-head__title">Cronograma de Pagamento da Instalação</h1>
          <p className="page-head__sub">Pagamento da mão de obra de instalação em 4 fases, liberadas por marco físico do equipamento.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo cronograma</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Equipamentos" value={String(rows.length)} sub="com cronograma" icon="hardhat"/>
        <KPI label="Total contratado" value={fmtBRL(totalContratado)} sub="mão de obra" icon="dollar"/>
        <KPI label="Já pago" value={fmtBRL(totalPago)} sub={totalContratado ? `${Math.round(totalPago/totalContratado*100)}% do total` : '—'} icon="check"/>
        <KPI label="A liberar" value={fmtBRL(aLiberar)} sub="marco atingido" icon="clock"/>
      </div>

      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="t">
          <thead><tr>
            <th>Endereço</th><th>Montador</th><th>Paradas</th><th>Carga</th>
            <th className="text-right">Valor total</th><th>Progresso</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign:'center', padding:'48px 0', color:'var(--fg3)', fontSize:13 }}>
                Nenhum cronograma cadastrado.
              </td></tr>
            )}
            {rows.map((r) => {
              const pago = cronPago(r);
              const pct = r.valor_total ? Math.round(pago / Number(r.valor_total) * 100) : 0;
              const pagas = CRON_FASES.filter(f => r[f.key + '_status'] === 'Paga').length;
              return (
                <tr key={r.id} style={{ cursor:'pointer', background: sel?.id === r.id ? 'var(--vp-gray-50)' : '' }}
                  onClick={() => setSel(r)}>
                  <td>
                    <div className="cell-main">{r.endereco}</div>
                    <div className="cell-sub">{r.id}</div>
                  </td>
                  <td>{r.montador || <span className="muted">—</span>}</td>
                  <td><span className="cell-num">{r.paradas ?? '—'}</span></td>
                  <td><span className="cell-num">{r.carga_kg ? r.carga_kg + 'kg' : '—'}</span></td>
                  <td className="cell-money">{fmtBRL(r.valor_total)}</td>
                  <td style={{ width: 180 }}>
                    <div className="progress" style={{ marginBottom: 4 }}><span style={{ width: pct + '%' }}/></div>
                    <div className="mono small" style={{ color: 'var(--fg3)' }}>{pagas}/4 fases · {pct}%</div>
                  </td>
                  <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel ? (
        <Card title={`Fases de pagamento · ${sel.endereco}`}
          sub={`${sel.montador || 'Montador não informado'} · ${sel.paradas ?? '—'} paradas · ${sel.carga_kg ? sel.carga_kg + 'kg' : '—'} · total ${fmtBRL(sel.valor_total)}`}>
          <div className="stack" style={{ gap: 10 }}>
            {CRON_FASES.map((f) => {
              const status = sel[f.key + '_status'];
              return (
                <div key={f.key} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:14, alignItems:'center', padding:'12px 14px', border:'1px solid var(--border)', background: status==='Paga' ? 'var(--vp-gray-50)' : '#fff' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{f.label} — {fmtBRL(sel[f.key + '_valor'])}</div>
                    <div className="cell-sub">{f.marco}</div>
                  </div>
                  <Badge variant={cronStatusVariant(status)} dot>{status}</Badge>
                  {status === 'Paga'
                    ? <span className="row gap-2" style={{ color:'var(--vp-success)', fontSize:12, fontWeight:700 }}><Icon.check size={14}/> Pago</span>
                    : <Button variant={status === 'Liberada' ? 'primary' : 'outline'} size="sm"
                        icon={status === 'Liberada' ? 'dollar' : 'check'}
                        onClick={() => advance(sel, f.key)}>
                        {status === 'Pendente' ? 'Liberar (marco atingido)' : 'Registrar pagamento'}
                      </Button>}
                </div>
              );
            })}
          </div>
        </Card>
      ) : rows.length > 0 ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', color:'var(--fg3)', fontSize:13, padding:'40px 20px', textAlign:'center' }}>
          Selecione um equipamento acima para gerenciar as 4 fases de pagamento.
        </div>
      ) : null}

      {showNovo && <ModalNovoCronograma onClose={() => setShowNovo(false)} onSaved={reload}/>}
    </div>
  );
}

function ModalNovoCronograma({ onClose, onSaved }) {
  const [f, setF] = React.useState({
    endereco: '', montador: '', paradas: '', carga_kg: '',
    valor_total: '', f1: '', f2: '', f3: '', f4: '',
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const num = (v) => parseFloat(String(v).replace(',', '.')) || 0;

  const total = num(f.valor_total);
  const somaFases = num(f.f1) + num(f.f2) + num(f.f3) + num(f.f4);
  const saldo = total - somaFases;
  const fechou = total > 0 && Math.abs(saldo) < 0.01;

  const save = async () => {
    if (!f.endereco.trim()) return window.toast('Endereço é obrigatório.', 'warning');
    if (total <= 0)         return window.toast('Informe o valor disponível para instalação.', 'warning');
    if (!fechou)            return window.toast('A soma das 4 fases deve ser igual ao valor disponível.', 'warning');
    setSaving(true);
    const id = 'IC-' + Date.now().toString().slice(-6);
    const { error } = await window.__VP_SB.sb.from('instalacao_cronograma').insert({
      id, endereco: f.endereco, montador: f.montador || null,
      paradas: f.paradas ? parseInt(f.paradas) : null,
      carga_kg: f.carga_kg ? parseInt(f.carga_kg) : null,
      valor_total: total,
      f1_valor: num(f.f1), f2_valor: num(f.f2), f3_valor: num(f.f3), f4_valor: num(f.f4),
      f1_status: 'Liberada', f2_status: 'Pendente', f3_status: 'Pendente', f4_status: 'Pendente',
    });
    setSaving(false);
    if (error) return window.toast('Erro: ' + error.message, 'error');
    window.toast('Cronograma de instalação criado.', 'success');
    onSaved?.();
    onClose();
  };

  const money = (label, key, ph) => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:13, color:'var(--fg3)', fontWeight:700 }}>R$</span>
        <input className="input" type="number" min="0" step="0.01" value={f[key]}
          onChange={e => set(key, e.target.value)} placeholder={ph} style={{ flex:1 }}/>
      </div>
    </div>
  );

  return (
    <Modal title="Novo Cronograma de Instalação" onClose={onClose} width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Criar cronograma'}</Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Identificação */}
        <div className="stack" style={{ gap:4 }}>
          <label className="up-eyebrow muted">Endereço de instalação *</label>
          <input className="input" value={f.endereco} onChange={e => set('endereco', e.target.value)}
            placeholder="Onde o equipamento será instalado"/>
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="stack" style={{ gap:4 }}>
            <label className="up-eyebrow muted">Montador (PJ)</label>
            <input className="input" value={f.montador} onChange={e => set('montador', e.target.value)} placeholder="Empresa / responsável pela instalação"/>
          </div>
          <div className="grid-2" style={{ gap:12 }}>
            <div className="stack" style={{ gap:4 }}>
              <label className="up-eyebrow muted">Paradas</label>
              <input className="input" type="number" min="1" value={f.paradas} onChange={e => set('paradas', e.target.value)} placeholder="Ex: 8"/>
            </div>
            <div className="stack" style={{ gap:4 }}>
              <label className="up-eyebrow muted">Carga (kg)</label>
              <input className="input" type="number" min="1" value={f.carga_kg} onChange={e => set('carga_kg', e.target.value)} placeholder="Ex: 600"/>
            </div>
          </div>
        </div>

        {/* Contratação do montador */}
        <div style={{ background:'var(--vp-gray-50)', border:'1px solid var(--border)', padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>Contratação do montador</div>
          {money('Valor disponível para instalação *', 'valor_total', '0,00')}
          <div className="grid-2" style={{ gap:12, marginTop:12 }}>
            {money('1ª Fase — início da instalação', 'f1', '0,00')}
            {money('2ª Fase — equipamento tracionado', 'f2', '0,00')}
            {money('3ª Fase — portas de pavimento + elétrica', 'f3', '0,00')}
            {money('4ª Fase — conclusão do equipamento', 'f4', '0,00')}
          </div>
          <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'8px 12px', border:'1px solid ' + (fechou ? 'var(--vp-success)' : 'var(--border)'),
            background: fechou ? 'rgba(0,150,0,.06)' : '#fff' }}>
            <span className="up-eyebrow muted">Soma das fases</span>
            <span style={{ fontSize:13, fontWeight:700 }}>
              {fmtBRL(somaFases)} / {fmtBRL(total)}
              {' · '}
              <span style={{ color: fechou ? 'var(--vp-success)' : 'var(--vp-danger)' }}>
                {fechou ? 'fecha ✓' : (saldo > 0 ? `falta ${fmtBRL(saldo)}` : `excede ${fmtBRL(-saldo)}`)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { ArtPage, CronogramaPage, DataBookPage });
