/* ============================================================
   linha-do-tempo.jsx — Linha do Tempo da Cotação (15/08)
   Busca por Nº Cotação (o "Ator principal", nasce no Formulário e nunca
   muda) e mostra tudo que já aconteceu, em ordem, com quem fez o quê.
   Fonte dos dados: linha-do-tempo-store.js.
   ============================================================ */

const LT_PAPEL_COR = {
  Cliente: '#4a4a4a', Vendedor: '#1f6feb', Fornecedor: '#8a6d3b',
  Financeiro: '#0a7a3d', Jurídico: '#7a3b8a', Engenharia: '#b5540a',
  Importação: '#0f8a8a', CEO: '#c0392b', RH: '#c2358a',
  'Transporte marítimo': '#1f5f8a', Despachante: '#6b6b6b',
  'Transporte terrestre': '#a35a2e', Instalador: '#b5540a', Gestão: '#555',
  Logística: '#0f8a8a', 'Gestor Comercial': '#1f6feb',
};
function ltCor(papel) { return LT_PAPEL_COR[papel] || '#777'; }

function ltFmtDataHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function ltFmtData(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function LinhaDoTempoPage() {
  const [busca, setBusca] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resultado, setResultado] = React.useState(null); // { numeroCotacao, dossier, itens } | 'not-found' | null

  const buscar = async () => {
    const numero = window.LinhaDoTempoStore.resolverNumero(busca);
    if (numero == null) return window.toast?.('Digite um Nº Cotação válido (ex.: 902 ou VPEL-EL0902).', 'warning');
    setLoading(true);
    try {
      const r = await window.LinhaDoTempoStore.obterPorCotacao(numero);
      setResultado(r.itens.length === 0 && !r.dossier ? 'not-found' : r);
    } catch (e) {
      window.toast?.('Erro ao buscar: ' + e.message, 'error');
      setResultado('not-found');
    } finally {
      setLoading(false);
    }
  };

  const masterIdLabel = (numero) => (window.MasterIdEngine ? window.MasterIdEngine.baseId('elevador', numero) : String(numero));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Dossiê da Obra</div>
          <h1 className="page-head__title">Linha do Tempo da Cotação</h1>
          <p className="page-head__sub">Do primeiro contato do cliente até a entrega — quem fez o quê, em ordem, numa cotação só.</p>
        </div>
      </div>

      <Card>
        <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 320 }}>
            <label className="up-eyebrow muted" style={{ display: 'block', marginBottom: 4 }}>Nº Cotação</label>
            <input className="input" placeholder="ex.: 902 ou VPEL-EL0902" value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}/>
          </div>
          <Button variant="primary" onClick={buscar} disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</Button>
        </div>
      </Card>

      {resultado === 'not-found' && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>
          Nenhum registro encontrado pra essa cotação — ou ela ainda não tem nenhum evento gravado no sistema.
        </div>
      )}

      {resultado && resultado !== 'not-found' && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            background: '#0b1220', color: '#FBB039', borderRadius: 8, padding: '16px 20px',
            marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa7bd' }}>Cotação</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{masterIdLabel(resultado.numeroCotacao)}</div>
              {resultado.dossier && <div style={{ fontSize: 13, color: '#c7cfda', marginTop: 2 }}>{resultado.dossier.building_name} · {resultado.dossier.client_name}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#9aa7bd' }}>Nasceu em</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{resultado.itens[0] ? ltFmtData(resultado.itens[0].ts) : '—'}</div>
              {resultado.dossier && (
                <div style={{ fontSize: 11, color: '#9aa7bd', marginTop: 4 }}>{resultado.dossier.status_master || 'em andamento'}</div>
              )}
            </div>
          </div>

          {resultado.itens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>
              Cotação existe (Dossiê {resultado.dossier?.id}) mas ainda sem eventos com data registrada.
            </div>
          ) : (
            <div className="timeline">
              {resultado.itens.map((it, i) => (
                <div key={i} className={"timeline__row " + (i === resultado.itens.length - 1 ? "current" : "done")}>
                  <div className="timeline__node" style={{ background: ltCor(it.papel), borderColor: ltCor(it.papel) }}/>
                  <div>
                    <div className="timeline__title">
                      <span style={{
                        display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#fff',
                        background: ltCor(it.papel), borderRadius: 20, padding: '1px 8px', marginRight: 8,
                      }}>{it.papel}</span>
                      {it.acao}
                    </div>
                    <div className="timeline__sub">{it.ator ? 'por ' + it.ator + ' · ' : ''}{it.fonte}</div>
                  </div>
                  <div className="timeline__meta">{ltFmtDataHora(it.ts)}</div>
                  <div className="timeline__rail"/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.LinhaDoTempoPage = LinhaDoTempoPage;
