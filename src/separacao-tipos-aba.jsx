/* ============================================================
   separacao-tipos-aba.jsx — Separação › aba "Tipos de item" (21/10/2026, issue #1027, fase 1).
   Lista de CÓDIGOS que a Separação trata como cabo de aço, cabo de manobra, cabo modular, corrimão ou cabo de aço de porta.
   Só cadastra e mostra: nenhuma regra de pedido, OP ou item_pcp muda por causa desta aba (isso é a fase 2 em diante).
   Alçadas (módulo `separacao`): ver = vê a lista; editar = inclui, troca o tipo e remove. O banco confere de novo (RPC separacao_tipos).
   ============================================================ */
const STA_SB = () => (window.__VP_SB && window.__VP_SB.sb) || null;
const staToast = (m) => { if (window.toast) window.toast(m); };

async function staChamar(acao, args) {
  const sb = STA_SB();
  if (!sb) throw new Error('Sistema ainda carregando.');
  const { data, error } = await sb.rpc('separacao_tipos', { p_acao: acao, p_args: args || {} });
  if (error) throw new Error((error.message || '').replace(/^separação: /, ''));
  return data;
}

function SeparacaoTiposAba({ caps }) {
  const T = window.SeparacaoTipos;
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [novo, setNovo] = React.useState({ codigo: '', tipo: 'cabo_aco', observacao: '' });
  const [sug, setSug] = React.useState({}); // tipo escolhido por código sugerido

  const carregar = React.useCallback(async () => {
    try { setD(await staChamar('listar')); setErro(null); } catch (e) { setErro(e.message); }
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  async function agir(acao, args, ok, log, alvo) {
    setOcupado(true);
    try {
      await staChamar(acao, args);
      staToast(ok);
      window.VPLog?.registrar?.({ modulo: 'Separação', acao: log, alvo });
      await carregar();
      return true;
    } catch (e) { staToast(e.message); return false; }
    finally { setOcupado(false); }
  }
  async function adicionar() {
    const codigo = T.norm(novo.codigo);
    if (!codigo) { staToast('Informe o código do item.'); return; }
    const ok = await agir('salvar', { codigo, tipo: novo.tipo, observacao: novo.observacao }, 'Código cadastrado.', 'Cadastrou tipo de item', `${codigo} → ${T.rotulo(novo.tipo)}`);
    if (ok) setNovo({ codigo: '', tipo: novo.tipo, observacao: '' });
  }

  if (erro && !d) return <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 12, borderRadius: 10 }}>{erro}</div>;
  if (!d) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const podeEditar = !!caps.editar;
  const ativos = (d.tipos || []).filter((t) => t.ativo);
  const idx = T.indice(d.tipos);
  const sugestoes = T.sugestoes(d.itens, idx);
  const opcoes = Object.keys(T.TIPOS);
  const selTipo = (valor, onChange, desabilitado) => (
    <select className="input" style={{ width: 'auto' }} value={valor} disabled={desabilitado} onChange={(e) => onChange(e.target.value)}>
      {opcoes.map((k) => <option key={k} value={k}>{T.rotulo(k)}</option>)}
    </select>
  );

  return (
    <div>
      <div style={{ background: '#eef4ff', border: '1px solid #9db8e8', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
        Aqui fica a lista de <b>códigos</b> que a Separação trata como cabo de aço, cabo de manobra, cabo elétrico modular ou corrimão — é por código porque o cadastro do Omie não separa esses itens por família.
        Por enquanto a lista só <b>identifica</b> o item; os botões de corte e de envio à produção vêm nas próximas etapas.
      </div>
      {!podeEditar && <div style={{ background: '#fff7df', border: '1px solid #e6c766', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>Você só consulta. Para mudar a lista é preciso a alçada "Separação › Editar", em Administração › Alçadas.</div>}
      {erro && <div style={{ background: '#fdecec', border: '1px solid #e49a9a', padding: 10, borderRadius: 10, marginBottom: 12 }}>{erro}</div>}

      {podeEditar && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <b>Cadastrar código</b>
          <input className="input" style={{ width: 140 }} placeholder="Código (ex.: VPEL-125)" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value.toUpperCase() })} onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }} />
          {selTipo(novo.tipo, (v) => setNovo({ ...novo, tipo: v }), false)}
          <input className="input" style={{ minWidth: 220, flex: 1 }} maxLength={300} placeholder="Observação (opcional)" value={novo.observacao} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }} />
          <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={adicionar}>Cadastrar</button>
        </div>
      )}

      {sugestoes.length > 0 && (
        <div className="card table-wrap" style={{ marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', fontSize: 13 }}><b>Parecem cabo ou corrimão e ainda não estão na lista ({sugestoes.length})</b> — itens que já apareceram em pedidos. Só entra na lista o que você confirmar.</div>
          <table className="t pcp-grid">
            <thead><tr><th>Código</th><th>Descrição</th>{podeEditar && <th>Cadastrar como</th>}</tr></thead>
            <tbody>
              {sugestoes.map((s) => {
                const tipo = sug[s.codigo] || s.tipo_sugerido || 'cabo_aco';
                return (
                  <tr key={s.codigo}>
                    <td><b>{s.codigo}</b></td>
                    <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{s.descricao}</td>
                    {podeEditar && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {selTipo(tipo, (v) => setSug({ ...sug, [s.codigo]: v }), ocupado)}{' '}
                        <button className="btn btn--sm" disabled={ocupado} onClick={() => agir('salvar', { codigo: s.codigo, tipo }, 'Código cadastrado.', 'Cadastrou tipo de item', `${s.codigo} → ${T.rotulo(tipo)}`)}>Cadastrar</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card table-wrap">
        <table className="t pcp-grid">
          <thead><tr><th>Código</th><th>Tipo</th><th>Descrição</th><th>Observação</th><th>Última mudança</th>{podeEditar && <th></th>}</tr></thead>
          <tbody>
            {ativos.map((t) => (
              <tr key={t.codigo}>
                <td><b>{t.codigo}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {podeEditar
                    ? selTipo(t.tipo, (v) => agir('salvar', { codigo: t.codigo, tipo: v, observacao: t.observacao || '' }, 'Tipo atualizado.', 'Trocou tipo de item', `${t.codigo} → ${T.rotulo(v)}`), ocupado)
                    : <Badge variant="neutral">{T.rotulo(t.tipo)}</Badge>}
                </td>
                <td style={{ minWidth: 240, maxWidth: 360, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{t.descricao || <span style={{ color: 'var(--fg3)' }}>sem descrição nos cadastros</span>}</td>
                <td style={{ whiteSpace: 'normal', fontSize: 12 }}>{t.observacao || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--fg3)' }}>{(t.atualizado_por || '').split('@')[0]}{t.atualizado_em ? ' · ' + new Date(t.atualizado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''}</td>
                {podeEditar && <td><button className="btn btn--sm" disabled={ocupado} title="Tira da lista (o código volta a ser um item comum)" onClick={() => { if (window.confirm(`Tirar ${t.codigo} da lista de tipos?`)) agir('remover', { codigo: t.codigo }, 'Código removido da lista.', 'Removeu tipo de item', t.codigo); }}>Remover</button></td>}
              </tr>
            ))}
            {!ativos.length && <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Nenhum código cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 8 }}>{ativos.length} código(s) na lista. Remover só tira o código da lista; o histórico de quem mexeu fica no banco.</div>
    </div>
  );
}

Object.assign(window, { SeparacaoTiposAba });
