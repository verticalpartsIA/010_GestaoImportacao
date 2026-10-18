/* ============================================================
   ajustes-estoque.jsx — Logística Interna · Almoxarifado · aba "Ajustes".
   Tela de confirmação do livro-razão de estoque (tabela estoque_movimentos, fase 4 do plano de estoque).
   Cada contagem com diferença vira um ajuste "pendente"; aqui uma pessoa com alçada CONFIRMA ou DESCARTA, item a item.
   Regras que existem por motivo real:
   - CONFIRMAR NÃO ENVIA nada ao Omie (o envio real é a etapa 3, ainda não feita) — só registra a decisão.
   - A decisão passa pela função estoque_decidir_movimento (só administrador ou alçada almoxarifado.escrever_omie); o movimento em si
     é imutável no banco (só a decisão muda).
   - A tabela só é legível por usuário logado (RLS fechada): sem sessão, a lista vem vazia.
   ============================================================ */

const AJE_FILTROS = [
  { id: 'pendente_confirmacao', label: 'Pendentes' },
  { id: 'confirmado', label: 'Confirmados' },
  { id: 'descartado', label: 'Descartados' },
  { id: 'enviado', label: 'Já enviados ao Omie' },
];
const AJE_STATUS = {
  pendente_confirmacao: { label: 'Pendente', variant: 'warning' },
  confirmado: { label: 'Confirmado', variant: 'success' },
  descartado: { label: 'Descartado', variant: 'neutral' },
  enviado: { label: 'Enviado', variant: 'info' },
};
const ajeDataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(',', '');
};
const ajeQtd = (v) => { const n = Number(v); return (n > 0 ? '+' : '') + n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }); };

function AlmoxarifadoAjustes() {
  const [filtro, setFiltro] = React.useState('pendente_confirmacao');
  const [linhas, setLinhas] = React.useState(null);
  const [desc, setDesc] = React.useState({});
  const [erro, setErro] = React.useState(null);
  const [podeDecidir, setPodeDecidir] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(null);

  React.useEffect(() => {
    if (!window.PropostaStore) return;
    window.PropostaStore.temCapacidade('almoxarifado', 'escrever_omie').then(setPodeDecidir).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) { setErro('Supabase não carregou.'); setLinhas([]); return; }
    setErro(null);
    const { data, error } = await c.from('estoque_movimentos')
      .select('id, codigo, quantidade, origem, enviar_omie, status_omie, observacao, criado_em, decidido_por, decidido_em')
      .eq('status_omie', filtro).order('criado_em', { ascending: false }).limit(500);
    if (error) { setErro(error.message); setLinhas([]); return; }
    setLinhas(data || []);
    const cods = Array.from(new Set((data || []).map((l) => l.codigo)));
    if (cods.length) {
      const { data: ps } = await c.from('pcp_produtos').select('codigo, descricao').in('codigo', cods);
      const { data: iv } = await c.from('importacao_varejo_produtos').select('codigo, descricao').in('codigo', cods);
      const m = {};
      (iv || []).forEach((p) => { m[String(p.codigo).toUpperCase()] = p.descricao; });
      (ps || []).forEach((p) => { m[String(p.codigo).toUpperCase()] = p.descricao; });
      setDesc(m);
    }
  }, [filtro]);
  React.useEffect(() => { setLinhas(null); carregar(); }, [carregar]);

  // Etapa 3: envio REAL ao Omie, um ajuste confirmado por vez. Simula primeiro (nada é gravado) e só envia depois do "OK" da pessoa.
  const enviarOmie = async (l) => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    const quem = (window.__VP_USER && window.__VP_USER.email) || '';
    const chamar = async (simular, valor) => {
      const { data, error } = await c.functions.invoke('pcp-omie-escrever', { body: { acao: 'enviar_movimento', movimento_id: l.id, solicitante: quem, simular, ...(valor ? { valor } : {}) } });
      if (error || !data || data.error || data.ok === false) {
        let msg = (data && (data.error || data.erro)) || '';
        if (!msg && error && error.context && typeof error.context.json === 'function') { try { const j = await error.context.json(); msg = j.error || j.erro || ''; } catch (e) {} }
        throw new Error(msg || (error && error.message) || 'falha');
      }
      return data;
    };
    setOcupado(l.id);
    try {
      let valor = null;
      let sim;
      try { sim = await chamar(true); }
      catch (e) {
        if (!/valor unit/i.test(e.message)) throw e;
        const v = window.prompt('Este produto não tem custo cadastrado e o Omie exige um valor. Informe o valor unitário (R$):');
        valor = Number(String(v || '').replace(',', '.'));
        if (!(valor > 0)) return;
        sim = await chamar(true, valor);
      }
      const a = sim.ajuste || {};
      const ok = window.confirm('Enviar ao Omie AGORA?\n\n' + l.codigo + ' — ' + (a.tipo === 'ENT' ? 'ENTRADA' : 'SAÍDA') + ' de ' + a.quan + ' un.\nLocal: VERTICAL MP · valor unitário R$ ' + a.valor + (sim.reenvio ? '\n(repetição de um envio que deu erro antes)' : '') + '\n\nIsso altera o estoque no Omie.');
      if (!ok) return;
      const r = await chamar(false, valor);
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Enviou ajuste de estoque ao Omie', alvo: `${l.codigo}: ${ajeQtd(l.quantidade)}` });
      window.toast?.(r.ja_enviado ? 'Esse ajuste já estava no Omie; marcado como enviado.' : 'Ajuste enviado ao Omie.', 'success');
    } catch (e) { window.toast?.('Não foi possível enviar ao Omie: ' + (e.message || e), 'error'); }
    finally { setOcupado(null); carregar(); }
  };

  const decidir = async (l, confirmar) => {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) return;
    setOcupado(l.id);
    const { error } = await c.rpc('estoque_decidir_movimento', { p_id: l.id, p_confirmar: confirmar });
    setOcupado(null);
    if (error) { window.toast?.('Não foi possível registrar a decisão: ' + error.message, 'error'); carregar(); return; }
    window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: confirmar ? 'Confirmou ajuste de estoque' : 'Descartou ajuste de estoque', alvo: `${l.codigo}: ${ajeQtd(l.quantidade)}` });
    window.toast?.(confirmar ? 'Ajuste confirmado (ainda não enviado ao Omie).' : 'Ajuste descartado.', 'success');
    carregar();
  };

  return (
    <Card title="Ajustes de estoque vindos de contagem" sub="Cada contagem com diferença vira um ajuste. Confirmar registra a decisão; depois, 'Enviar ao Omie' lança o ajuste no estoque do Omie (um por vez, com conferência).">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {AJE_FILTROS.map((f) => <Button key={f.id} variant={filtro === f.id ? 'primary' : 'ghost'} onClick={() => setFiltro(f.id)}>{f.label}</Button>)}
        <Button variant="ghost" onClick={() => { setLinhas(null); carregar(); }}>Atualizar</Button>
      </div>
      {!podeDecidir && filtro === 'pendente_confirmacao' ? <div className="alert alert--info" style={{ marginBottom: 12 }}>Somente leitura: confirmar ou descartar exige a alçada de escrita no Omie (Almoxarifado).</div> : null}
      {erro ? <div className="alert alert--danger">{erro}</div> : null}
      {linhas === null ? <div style={{ color: 'var(--fg3)' }}>Carregando…</div> : linhas.length === 0 ? (
        <div style={{ color: 'var(--fg3)', padding: 16 }}>{filtro === 'pendente_confirmacao' ? 'Nenhum ajuste pendente. Novas contagens com diferença aparecem aqui.' : 'Nada nesta situação.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr><th>Quando</th><th>Código</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Ajuste</th><th>Origem</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {linhas.map((l) => {
                const st = AJE_STATUS[l.status_omie] || AJE_STATUS.pendente_confirmacao;
                return (
                  <tr key={l.id}>
                    <td>{ajeDataHora(l.criado_em)}</td>
                    <td className="mono">{l.codigo}</td>
                    <td>{desc[String(l.codigo).toUpperCase()] || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: Number(l.quantidade) < 0 ? 'var(--vp-danger)' : 'inherit' }}>{ajeQtd(l.quantidade)}</td>
                    <td style={{ fontSize: 12 }}>{l.observacao || (l.origem === 'pcp_ajuste' ? 'Ajuste do PCP' : 'Contagem')}</td>
                    <td><Badge variant={st.variant}>{st.label}</Badge>{l.decidido_por ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{l.decidido_por} · {ajeDataHora(l.decidido_em)}</div> : null}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {l.status_omie === 'pendente_confirmacao' ? <>
                        <Button variant="primary" disabled={!podeDecidir || ocupado === l.id} onClick={() => decidir(l, true)}>Confirmar</Button>{' '}
                        <Button variant="ghost" disabled={!podeDecidir || ocupado === l.id} onClick={() => decidir(l, false)}>Descartar</Button>
                      </> : null}
                      {l.status_omie === 'confirmado' && l.enviar_omie ? <Button variant="primary" disabled={!podeDecidir || ocupado === l.id} onClick={() => enviarOmie(l)}>{ocupado === l.id ? 'Enviando…' : 'Enviar ao Omie'}</Button> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

window.AlmoxarifadoAjustes = AlmoxarifadoAjustes;
