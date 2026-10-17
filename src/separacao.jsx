/* ============================================================
   separacao.jsx — Logística Interna · Separação (links do painel TV + SLA).
   O painel em si é uma página pública (/separacao-tv/<token>, separacao-tv.jsx); aqui só se gera, copia e revoga o link e se define a meta de SLA.
   Alçadas (módulo `separacao`): ver = vê os links e o SLA; editar = gera/revoga links e muda o SLA. O banco confere de novo (RPCs separacao_tv_*).
   O link É a senha da TV: quem o tiver vê o painel (só nº do pedido, status, SLA e códigos de produto). Revogue se vazar.
   ============================================================ */
const SEP_SB = () => (window.__VP_SB && window.__VP_SB.sb) || null;
const sepToast = (m) => { if (window.toast) window.toast(m); };
const sepUrl = (token) => `${window.location.origin}/separacao-tv/${token}`;
const sepData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

async function sepCopiar(texto) {
  try { await navigator.clipboard.writeText(texto); sepToast('Link copiado.'); }
  catch (e) { window.prompt('Copie o link:', texto); }
}

function SeparacaoPage() {
  const [caps, setCaps] = React.useState({ carregado: false, ver: false, editar: false });
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [nome, setNome] = React.useState('');
  const [sla, setSla] = React.useState('4');
  const [ocupado, setOcupado] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const sb = SEP_SB();
    if (!sb) { setErro('Sistema ainda carregando.'); return; }
    const { data, error } = await sb.rpc('separacao_tv_listar');
    if (error) { setErro(error.message); return; }
    setErro(null); setDados(data); setSla(String(data.sla_horas));
  }, []);

  React.useEffect(() => {
    let vivo = true;
    const cap = async (c) => { try { return !!(await window.PropostaStore?.temCapacidade?.('separacao', c)); } catch (e) { return false; } };
    Promise.all([cap('ver'), cap('editar')]).then(([ver, editar]) => {
      if (!vivo) return;
      setCaps({ carregado: true, ver, editar });
      if (ver) carregar();
    });
    return () => { vivo = false; };
  }, [carregar]);

  async function gerar() {
    if (!nome.trim()) { sepToast('Dê um nome ao link (ex.: TV do almoxarifado).'); return; }
    setOcupado(true);
    const { data, error } = await SEP_SB().rpc('separacao_tv_gerar', { p_nome: nome.trim() });
    setOcupado(false);
    if (error) { sepToast('Não gerou: ' + error.message); return; }
    setNome('');
    sepToast('Link criado.');
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Criou link do painel TV', alvo: data.nome });
    carregar();
  }
  async function revogar(l) {
    if (!window.confirm(`Revogar o link "${l.nome}"? A TV que usa esse link para de mostrar o painel.`)) return;
    const { error } = await SEP_SB().rpc('separacao_tv_revogar', { p_token: l.token });
    if (error) { sepToast('Não revogou: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Revogou link do painel TV', alvo: l.nome });
    carregar();
  }
  async function salvarSla() {
    const h = Number(String(sla).replace(',', '.'));
    if (!(h > 0 && h <= 72)) { sepToast('Informe um SLA entre 0 e 72 horas.'); return; }
    const { error } = await SEP_SB().rpc('separacao_tv_config_salvar', { p_sla_horas: h });
    if (error) { sepToast('Não salvou: ' + error.message); return; }
    window.VPLog?.registrar?.({ modulo: 'Separação', acao: 'Mudou o SLA da separação', alvo: `${h} h úteis` });
    sepToast('SLA salvo.'); carregar();
  }

  const cabecalho = (sub) => (
    <div className="page-head"><div className="page-head__l">
      <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Separação</div>
      <h1 className="page-head__title">Separação</h1>
      <p className="page-head__sub">{sub}</p>
    </div></div>
  );
  if (caps.carregado && !caps.ver) {
    return <div className="page fade-in">{cabecalho('Você não tem acesso a esta tela. Peça ao gestor a alçada "Separação › Ver" em Administração › Alçadas.')}</div>;
  }
  const links = (dados && dados.links) || [];
  return (
    <div className="page fade-in">
      {cabecalho('Links do painel de TV da separação de pedidos. O painel mostra, ao vivo (a cada 30 s), os pedidos aguardando, em separação e separados hoje, só com o nº do pedido, os códigos de produto e o SLA.')}
      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10, marginBottom: 12 }}>{erro}</div>}

      <Card title="SLA da separação" sub="Horas úteis (seg–sex, 8h–18h) entre o pedido entrar no hub e ser marcado como separado. O relógio para quando separa.">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 90 }} value={sla} disabled={!caps.editar} onChange={(e) => setSla(e.target.value)} />
          <span>horas úteis</span>
          <button className="btn btn--sm btn--primary" disabled={!caps.editar} onClick={salvarSla}>Salvar</button>
          {!caps.editar && <span style={{ color: 'var(--fg3)', fontSize: 12 }}>Só quem tem a alçada "Separação › Editar" muda.</span>}
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Links do painel TV" sub="Cada TV usa um link. O link é a senha: quem o tiver vê o painel. Revogue se vazar.">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ minWidth: 260 }} placeholder="Nome do link (ex.: TV do almoxarifado)" value={nome} maxLength={60}
                 disabled={!caps.editar} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') gerar(); }} />
          <button className="btn btn--sm btn--primary" disabled={!caps.editar || ocupado} onClick={gerar}>Gerar link</button>
          {!caps.editar && <span style={{ color: 'var(--fg3)', fontSize: 12, alignSelf: 'center' }}>Gerar exige a alçada "Separação › Editar".</span>}
        </div>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Nome</th><th>Criado por</th><th>Criado em</th><th>Último acesso</th><th></th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.token}>
                  <td><b>{l.nome}</b></td><td>{(l.criado_por || '—').split('@')[0]}</td><td>{sepData(l.criado_em)}</td><td>{sepData(l.ultimo_acesso)}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn btn--sm" onClick={() => sepCopiar(sepUrl(l.token))}>Copiar link</button>{' '}
                    <a className="btn btn--sm" href={sepUrl(l.token)} target="_blank" rel="noopener">Abrir</a>{' '}
                    {caps.editar && <button className="btn btn--sm" onClick={() => revogar(l)}>Revogar</button>}
                  </td>
                </tr>
              ))}
              {dados && !links.length && <tr><td colSpan={5} style={{ padding: 18, color: 'var(--fg3)' }}>Nenhum link ainda. Gere um para a TV.</td></tr>}
              {!dados && !erro && <tr><td colSpan={5} style={{ padding: 18, color: 'var(--fg3)' }}>Carregando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SeparacaoPage });
