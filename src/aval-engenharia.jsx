/* ============================================================
   aval-engenharia.jsx — Aval Engenharia (08/10/2026)
   Terceiro aval da compra na China, por cotação: o cliente assinou o Projeto de Instalação.
   Peças: AvalEngenhariaBadge (selo), AvaisDaCotacao (os 3 avais lado a lado — Aval Jurídico) e AvalEngenhariaCard
   (painel por cotação, mora em Projeto de Elevadores). Regra e dados: aval-engenharia-store.js.
   ============================================================ */

const AE_VARIANTE = { ok: 'success', aguardando: 'warning', recusado: 'danger', sem_projeto: 'warning', erro: 'neutral' };
const AE_TEXTO = { ok: 'Aval Engenharia OK', aguardando: 'Aval Engenharia pendente', recusado: 'Aval Engenharia: projeto recusado', sem_projeto: 'Aval Engenharia pendente (projeto não salvo)', erro: 'Aval Engenharia: sem leitura' };

function useAvalEngenharia(numeroCotacao, versao) {
  const [st, setSt] = React.useState(undefined); // undefined = carregando
  React.useEffect(() => {
    let vivo = true;
    setSt(undefined);
    if (numeroCotacao == null || !window.AvalEngenhariaStore) { setSt(null); return undefined; }
    window.AvalEngenhariaStore.status(numeroCotacao).then((r) => { if (vivo) setSt(r); });
    return () => { vivo = false; };
  }, [numeroCotacao, versao]);
  return st;
}

function AvalEngenhariaBadge({ numeroCotacao, versao }) {
  const st = useAvalEngenharia(numeroCotacao, versao);
  if (!st) return null;
  const parcial = st.total > 0 && st.estado !== 'ok' ? ` · ${st.assinados}/${st.total} assinado${st.total === 1 ? '' : 's'}` : '';
  return <Badge variant={AE_VARIANTE[st.estado] || 'neutral'} dot>{(AE_TEXTO[st.estado] || AE_TEXTO.erro) + parcial}</Badge>;
}

/* Os 3 avais da cotação (Pagamento · Jurídico · Projeto) — usado na tela Aval Jurídico. */
function AvaisDaCotacao({ numeroCotacao, juridicoStatus }) {
  const [pag, setPag] = React.useState(undefined);
  React.useEffect(() => {
    let vivo = true;
    const s = window.AvalFinanceiroStore;
    if (numeroCotacao == null || !s) { setPag(null); return undefined; }
    s.getByNumeroCotacao(numeroCotacao).then((r) => { if (vivo) setPag(r); }).catch(() => { if (vivo) setPag(null); });
    return () => { vivo = false; };
  }, [numeroCotacao]);
  if (numeroCotacao == null) return null;
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 6 }}>
      {pag !== undefined && (pag && pag.aval_pagamento_confirmado
        ? <Badge variant="success" dot>Aval de Pagamento OK</Badge>
        : <Badge variant="warning" dot>Aval de Pagamento pendente</Badge>)}
      <Badge variant={juridicoStatus === 'aprovado' ? 'success' : juridicoStatus === 'reprovado' ? 'danger' : 'warning'} dot>
        {juridicoStatus === 'aprovado' ? 'Aval Jurídico OK' : juridicoStatus === 'reprovado' ? 'Aval Jurídico reprovado' : 'Aval Jurídico pendente'}
      </Badge>
      <AvalEngenhariaBadge numeroCotacao={numeroCotacao}/>
    </div>
  );
}

/* Painel por cotação, abaixo da lista de Projeto de Elevadores. `versao` muda quando alguém cria/atualiza uma assinatura. */
function AvalEngenhariaCard({ versao }) {
  const [linhas, setLinhas] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  React.useEffect(() => {
    let vivo = true;
    setErro(null);
    if (!window.AvalEngenhariaStore) { setLinhas([]); return undefined; }
    window.AvalEngenhariaStore.resumoTodas()
      .then((r) => { if (vivo) setLinhas(r.sort((a, b) => Number(b.numero_cotacao) - Number(a.numero_cotacao))); })
      .catch((e) => { if (vivo) { setErro(e.message || String(e)); setLinhas([]); } });
    return () => { vivo = false; };
  }, [versao]);
  const ROT = { assinado: 'assinado', aguardando: 'aguardando o cliente', recusado: 'recusado', sem_link: 'sem link de assinatura' };
  return (
    <Card title="Aval Engenharia — assinatura do Projeto de Instalação" sub="Por cotação: o cliente precisa assinar todos os Projetos de Instalação para liberar a compra na China (junto com o Aval de Pagamento e o Aval Jurídico)." style={{ marginTop: 18 }}>
      {erro && <div className="small" style={{ color: '#9f1239' }}>Não foi possível carregar: {erro}</div>}
      {linhas === null && <div className="muted small">Carregando…</div>}
      {linhas !== null && linhas.length === 0 && !erro && <div className="muted small">Nenhuma cotação com Projeto de Instalação salvo ainda. Salve o projeto da obra com o Nº da cotação para ele entrar aqui.</div>}
      {linhas !== null && linhas.length > 0 && (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Nº Cotação</th><th>Cliente</th><th>Aval Engenharia</th><th>Projetos</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.numero_cotacao}>
                  <td><span className="mono small">{l.numero_cotacao}</span></td>
                  <td>{l.cliente_nome || '—'}</td>
                  <td><Badge variant={AE_VARIANTE[l.estado]} dot>{l.estado === 'ok' ? 'OK' : l.estado === 'recusado' ? 'Recusado' : 'Pendente'} · {l.assinados}/{l.total} assinado{l.total === 1 ? '' : 's'}</Badge></td>
                  <td className="small">{l.itens.map((i) => <div key={i.id}>{i.referencia || i.arquivo_nome} — {ROT[i.estado] || i.estado}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

Object.assign(window, { AvalEngenhariaBadge, AvaisDaCotacao, AvalEngenhariaCard });
