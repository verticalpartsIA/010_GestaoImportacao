/* ============================================================
   decisoes.jsx — Central de Decisões (Fase 1)
   Caixa de entrada pessoal: cada usuário logado vê só as decisões
   gerenciais que esperam por ele (CEO, Owner, Gestor Comercial, RH,
   Engenharia, Logística — ver decisoes-store.js).
   ============================================================ */

function fmtDataHora(d) { return d ? new Date(d).toLocaleString('pt-BR') : '—'; }

function DecModalReprovar({ decisao, onClose, onSaved }) {
  const [motivo, setMotivo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const salvar = async () => {
    if (!motivo.trim()) return window.toast?.('Informe o motivo da reprovação.', 'warning');
    setSaving(true);
    try {
      await window.DecisoesStore.reprovar(decisao.id, motivo);
      window.toast?.('Decisão reprovada.', 'warning');
      onSaved(); onClose();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Reprovar decisão" onClose={onClose} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar reprovação'}</Button>
      </>}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</p>
        <label className="up-eyebrow muted">Motivo</label>
        <textarea className="input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique o motivo da reprovação…"/>
      </div>
    </Modal>
  );
}

function DecCard({ decisao, onReload }) {
  const [busy, setBusy] = React.useState(false);
  const [reprovando, setReprovando] = React.useState(false);
  const ctx = decisao.contexto || {};

  const aprovar = async () => {
    setBusy(true);
    try {
      await window.DecisoesStore.aprovar(decisao.id);
      window.toast?.('Decisão aprovada.', 'success');
      onReload();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="up-eyebrow muted">{window.DecisoesStore.TIPO_LABEL[decisao.tipo] || decisao.tipo}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{ctx.cliente || ctx.titulo || ctx.item || ctx.obra || `Cotação Nº ${decisao.numero_cotacao ?? '—'}`}</div>
        <div className="cell-sub mono">
          {decisao.numero_cotacao != null && <>Cotação {decisao.numero_cotacao} · </>}
          {ctx.quantidade != null && <>{ctx.quantidade}{ctx.unidade ? ' ' + ctx.unidade : ''} · </>}
          {ctx.solicitante && <>{ctx.solicitante} · </>}
          {ctx.valor != null ? `R$ ${Number(ctx.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
        </div>
        <div className="small muted" style={{ marginTop: 2 }}>Aberta em {fmtDataHora(decisao.criado_em)}</div>
      </div>
      <div className="row gap-2">
        <Button variant="danger" size="sm" onClick={() => setReprovando(true)} disabled={busy}>Reprovar</Button>
        <Button variant="primary" size="sm" onClick={aprovar} disabled={busy}>{busy ? 'Salvando…' : 'Aprovar'}</Button>
      </div>
      {reprovando && <DecModalReprovar decisao={decisao} onClose={() => setReprovando(false)} onSaved={onReload}/>}
    </div>
  );
}

function DecisoesPage() {
  const [pendentes, setPendentes] = React.useState(null);

  const reload = React.useCallback(() => {
    window.DecisoesStore.listarPendentesParaMim().then(setPendentes).catch(() => setPendentes([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (pendentes === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Geral · Decisões</div>
          <h1 className="page-head__title">Central de Decisões</h1>
          <p className="page-head__sub">Tudo que precisa da sua aprovação, de qualquer módulo — em um só lugar.</p>
        </div>
      </div>

      <Card title="Aguardando você" sub={`${pendentes.length} decisão(ões) pendente(s)`}>
        <div className="stack" style={{ gap: 10 }}>
          {pendentes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Nenhuma decisão pendente pra você no momento.
            </div>
          )}
          {pendentes.map((d) => <DecCard key={d.id} decisao={d} onReload={reload}/>)}
        </div>
      </Card>
    </div>
  );
}

window.DecisoesPage = DecisoesPage;
