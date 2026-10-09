/* ============================================================
   logs-admin.jsx — Admin · Logs de Atividade
   Registro central de auditoria: QUEM fez · O QUE fez · ONDE
   (módulo) · ALVO (documento) · DIA E HORA. Tabela vp_logs
   (append-only). Filtros: módulo, busca, período.
   window.LogsAdminPage — rota "logs" (restrita a admin).
   ============================================================ */
const { useState: _laUS, useEffect: _laUE, useCallback: _laUC } = React;

const LA_SETOR_COR = {
  comercial: '#2563eb', engenharia: '#7c3aed', financeiro: '#059669',
  importacao: '#b45309', juridico: '#9f1239', fornecedor: '#0e7490',
  externo: '#0e7490', admin: '#111111', sistema: '#64748b',
};
const LA_MODULO_ICON = {
  'Ficha Técnica': 'fileText', 'Catálogo': 'package', 'Pedido a Fornecedor': 'ship',
  'Contrato Instalador': 'signature', 'Contrato Venda': 'signature',
  'Proposta': 'proposal', 'Sistema': 'settings',
};

function LaSetorChip({ setor }) {
  if (!setor) return null;
  const cor = LA_SETOR_COR[setor] || '#64748b';
  const nome = setor === 'admin' ? 'Admin' : setor.charAt(0).toUpperCase() + setor.slice(1);
  return <span className="la-setor" style={{ background: cor }}>{nome}</span>;
}

function LaDetalhe({ d }) {
  if (!d || typeof d !== 'object') return <span className="muted">—</span>;
  const partes = [];
  if (d.de && d.para) partes.push(`${d.de} → ${d.para}`);
  if (d.motivo) partes.push(`“${d.motivo}”`);
  if (d.canal) partes.push(`canal: ${d.canal}`);
  if (d.para && !d.de) partes.push(`para: ${d.para}`);
  if (d.fornecedor) partes.push(`fornecedor: ${d.fornecedor}`);
  if (d.moeda) partes.push(`moeda: ${d.moeda}`);
  if (d.itens) partes.push(`${d.itens} itens`);
  if (d.nome) partes.push(d.nome);
  if (d.contratada) partes.push(d.contratada);
  if (d.comprador) partes.push(d.comprador);
  if (d.situacao) partes.push(`situação: ${d.situacao}`);
  if (d.versao) partes.push(`v${d.versao}`);
  if (d.ip) partes.push(`IP ${d.ip}`);
  if (!partes.length) return <span className="muted">—</span>;
  return <span>{partes.join(' · ')}</span>;
}

function LogsAdminPage() {
  const [rows, setRows] = _laUS(null);
  const [modulos, setModulos] = _laUS([]);
  const [fModulo, setFModulo] = _laUS('Todos');
  const [busca, setBusca] = _laUS('');
  const [de, setDe] = _laUS('');
  const [ate, setAte] = _laUS('');
  const [refreshing, setRefreshing] = _laUS(false);

  const carregar = _laUC(async () => {
    setRefreshing(true);
    const data = await window.VPLog.listar({ modulo: fModulo, busca, de, ate, limit: 400 });
    setRows(data);
    setRefreshing(false);
  }, [fModulo, busca, de, ate]);

  _laUE(() => { carregar(); }, [fModulo, de, ate]);
  _laUE(() => { window.VPLog.modulos().then(setModulos); }, []);
  /* busca com debounce */
  _laUE(() => { const t = setTimeout(carregar, 350); return () => clearTimeout(t); }, [busca]);

  const hoje = rows ? rows.filter(r => new Date(r.criado_em).toDateString() === new Date().toDateString()).length : 0;
  const atores = rows ? new Set(rows.map(r => r.ator_nome)).size : 0;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Admin · Auditoria</div>
          <h1 className="page-head__title">Logs de Atividade</h1>
          <p className="page-head__sub">Registro central e imutável: quem fez, o que fez, onde e quando. Nenhum registro pode ser alterado ou apagado.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh" onClick={carregar} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
      </div>

      <div className="grid-4" style={{ margin: '20px 0' }}>
        <KPI label="Registros (filtro atual)" value={rows ? rows.length : '…'} sub={rows && rows.length === 400 ? 'mostrando os 400 últimos' : 'todos carregados'} icon="history"/>
        <KPI label="Hoje" value={hoje} sub="ações registradas hoje" icon="clock"/>
        <KPI label="Atores distintos" value={atores} sub="pessoas/setores no filtro" icon="users"/>
        <KPI label="Módulos" value={modulos.length} sub="origens de eventos" icon="grid"/>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Buscar por pessoa, ação ou documento…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <input className="input" type="date" value={de} onChange={e => setDe(e.target.value)} style={{ width: 150 }} title="De"/>
        <input className="input" type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ width: 150 }} title="Até"/>
        <span className="small" style={{ color: 'var(--fg3)' }}>{rows ? rows.length : '…'} registro(s)</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['Todos'].concat(modulos).map(m => (
          <Button key={m} size="sm" variant={fModulo === m ? 'primary' : 'ghost'} onClick={() => setFModulo(m)}>{m}</Button>
        ))}
      </div>

      <Card title="Registros" sub="Imutáveis — nenhum registro pode ser alterado ou apagado">
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="t pcp-grid">
          <thead><tr>
            <th style={{ width: 150 }}>Data e hora</th>
            <th style={{ width: 130 }}>Quem</th>
            <th style={{ width: 105 }}>Setor</th>
            <th style={{ width: 160 }}>Onde (módulo)</th>
            <th>O que fez</th>
            <th style={{ width: 170 }}>Alvo</th>
            <th>Detalhe</th>
          </tr></thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={99}><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)' }}>Carregando…</div></td></tr>
            )}
            {rows && rows.length === 0 && (
              <tr><td colSpan={99}><div className="empty"><h4>Nenhum registro</h4><p>Nada encontrado com os filtros atuais.</p></div></td></tr>
            )}
            {rows && rows.map(r => {
              const MIco = Icon[LA_MODULO_ICON[r.modulo] || 'layers'] || Icon.layers;
              return (
                <tr key={r.id}>
                  <td><span className="mono small" style={{ whiteSpace: 'nowrap' }}>{window.VPLog.fmtDateTime(r.criado_em)}</span></td>
                  <td><b style={{ fontSize: 12 }}>{r.ator_nome}</b></td>
                  <td><LaSetorChip setor={r.ator_setor}/></td>
                  <td><span className="la-mod"><MIco size={11}/> {r.modulo}</span></td>
                  <td style={{ fontSize: 12.5 }}>{r.acao}</td>
                  <td>{r.alvo ? <span className="mono small">{r.alvo}</span> : <span className="muted">—</span>}</td>
                  <td className="small" style={{ color: 'var(--fg2)' }}><LaDetalhe d={r.detalhe}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </Card>
    </div>
  );
}

window.LogsAdminPage = LogsAdminPage;
