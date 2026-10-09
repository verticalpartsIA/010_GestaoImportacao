/* ============================================================
   contratos-sociais.jsx — Comercial | Pré-venda › Contratos Social
   Repositório de PDFs: o vendedor identifica o cliente (Cadastros › Clientes)
   e salva o contrato social. Lista por cliente, com busca, abrir e excluir.
   ============================================================ */

function csFmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function csFmtTam(b) {
  if (!b) return '—';
  return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}
function csNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ContratosSociaisPage() {
  const [itens, setItens] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busca, setBusca] = React.useState('');
  const [modal, setModal] = React.useState(false);
  const [excluir, setExcluir] = React.useState(null);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    try { setItens(await window.ContratosSociaisStore.listar()); }
    catch (e) { window.toast?.('Não foi possível carregar os contratos sociais: ' + e.message, 'error'); setItens([]); }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    carregar();
    window.CadastrosClientesStore?.listarTodos().then(setClientes).catch(() => {});
  }, [carregar]);

  const filtrados = React.useMemo(() => {
    const q = csNorm(busca);
    if (!q) return itens;
    return itens.filter(i => csNorm(`${i.cliente_nome} ${i.cliente_documento} ${i.arquivo_nome} ${i.enviado_por_nome}`).includes(q));
  }, [itens, busca]);

  async function confirmarExcluir() {
    const item = excluir;
    try {
      await window.ContratosSociaisStore.excluir(item.id);
      window.toast?.('Contrato social excluído.', 'success');
      setExcluir(null);
      carregar();
    } catch (e) { window.toast?.(e.message, 'error'); }
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Comercial · Pré-venda</div>
          <h1 className="page-head__title">Contratos Social</h1>
          <p className="page-head__sub">Repositório dos contratos sociais (PDF) dos clientes</p>
        </div>
        <div className="row gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</Button>
          <Button onClick={() => setModal(true)}>+ Salvar contrato social</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <input className="input" style={{ width: '100%' }} placeholder="Buscar por cliente, CNPJ/CPF ou arquivo…"
          value={busca} onChange={e => setBusca(e.target.value)}/>
      </Card>

      <Card>
        {loading ? <div style={{ padding: 24 }}>Carregando…</div>
        : filtrados.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', opacity: .7 }}>
            {itens.length === 0 ? 'Nenhum contrato social salvo ainda. Clique em "Salvar contrato social".' : 'Nenhum resultado para a busca.'}
          </div>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead><tr>
              <th>Cliente</th><th>CNPJ/CPF</th><th>Arquivo</th><th>Tamanho</th><th>Salvo por</th><th>Data</th><th style={{ width: 150 }}></th>
            </tr></thead>
            <tbody>
              {filtrados.map(i => (
                <tr key={i.id}>
                  <td><b>{i.cliente_nome}</b>{i.observacao ? <div style={{ fontSize: 12, opacity: .7 }}>{i.observacao}</div> : null}</td>
                  <td>{i.cliente_documento || '—'}</td>
                  <td>{i.arquivo_nome}</td>
                  <td>{csFmtTam(i.tamanho_bytes)}</td>
                  <td>{i.enviado_por_nome || i.enviado_por_email || '—'}</td>
                  <td>{csFmtData(i.criado_em)}</td>
                  <td>
                    <div className="row gap-2">
                      <a className="btn btn--outline" href={i.arquivo_url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
                      <button className="btn btn--outline" title="Excluir" onClick={() => setExcluir(i)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && <ContratoSocialModal clientes={clientes} onClose={() => setModal(false)}
        onSaved={() => { setModal(false); carregar(); }}/>}

      {excluir && (
        <CsOverlay onClose={() => setExcluir(null)}>
          <h3 style={{ marginTop: 0 }}>Excluir contrato social?</h3>
          <p><b>{excluir.cliente_nome}</b><br/>{excluir.arquivo_nome}</p>
          <p style={{ fontSize: 13, opacity: .75 }}>O registro sai da lista (o arquivo fica guardado para recuperação pelo suporte).</p>
          <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button onClick={confirmarExcluir}>Sim, excluir</Button>
          </div>
        </CsOverlay>
      )}
    </div>
  );
}

function CsOverlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', color: 'var(--text, inherit)', borderRadius: 10, padding: 22, width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function ContratoSocialModal({ clientes, onClose, onSaved }) {
  const [busca, setBusca] = React.useState('');
  const [cliente, setCliente] = React.useState(null);
  const [file, setFile] = React.useState(null);
  const [obs, setObs] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const sugestoes = React.useMemo(() => {
    const q = csNorm(busca).trim();
    if (q.length < 2) return [];
    const qd = q.replace(/\D/g, '');
    return clientes.filter(c =>
      csNorm(`${c.razao_social} ${c.nome_fantasia}`).includes(q) ||
      (qd.length >= 3 && String(c.cnpj || c.cpf || '').replace(/\D/g, '').includes(qd))
    ).slice(0, 8);
  }, [busca, clientes]);

  /* Documento completo (CNPJ 14 / CPF 11 dígitos) com 1 único cliente
     correspondente já seleciona sozinho — antes o vendedor digitava o CNPJ,
     via o cliente na lista e salvava sem clicar nele ("Identifique o cliente"). */
  React.useEffect(() => {
    if (cliente) return;
    const d = busca.replace(/\D/g, '');
    if ((d.length === 14 || d.length === 11) && sugestoes.length === 1) setCliente(sugestoes[0]);
  }, [busca, sugestoes, cliente]);

  async function salvar() {
    setErro('');
    if (!cliente) return setErro(sugestoes.length ? 'Clique no cliente na lista para selecioná-lo antes de salvar.' : 'Identifique o cliente (busque pelo nome ou CNPJ).');
    if (!file) return setErro('Selecione o PDF do contrato social.');
    setSaving(true);
    try {
      await window.ContratosSociaisStore.salvar({ cliente, file, observacao: obs.trim() });
      window.toast?.('Contrato social salvo.', 'success');
      onSaved();
    } catch (e) { setErro(e.message); setSaving(false); }
  }

  return (
    <CsOverlay onClose={saving ? () => {} : onClose}>
      <h3 style={{ marginTop: 0 }}>Salvar contrato social</h3>

      <label style={{ fontSize: 12, fontWeight: 600 }}>Cliente *</label>
      {cliente ? (
        <div className="row gap-2" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border, #ddd)', borderRadius: 6, marginBottom: 12 }}>
          <div><b>{cliente.razao_social || cliente.nome_fantasia}</b><div style={{ fontSize: 12, opacity: .7 }}>{cliente.cnpj || cliente.cpf || 'sem documento'}</div></div>
          <button className="btn btn--outline" onClick={() => { setCliente(null); setBusca(''); }}>Trocar</button>
        </div>
      ) : (
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <input className="input" style={{ width: '100%' }} autoFocus placeholder="Digite o nome ou CNPJ do cliente…"
            value={busca} onChange={e => setBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && sugestoes.length) { e.preventDefault(); setCliente(sugestoes[0]); } }}/>
          {clientes.length === 0 && <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>Carregando clientes…</div>}
          {busca.trim().length >= 2 && (
            <div style={{ border: '1px solid var(--border, #ddd)', borderRadius: 6, marginTop: 4 }}>
              {sugestoes.length === 0
                ? <div style={{ padding: 10, fontSize: 13, opacity: .7 }}>Cliente não encontrado. Cadastre em Cadastros Mestres › Clientes.</div>
                : <div style={{ padding: '6px 10px', fontSize: 12, opacity: .7 }}>Clique no cliente para selecioná-lo:</div>}
              {sugestoes.map(c => (
                  <div key={c.id} onClick={() => setCliente(c)} onMouseEnter={e => e.currentTarget.style.background = 'rgba(127,127,127,.15)'} onMouseLeave={e => e.currentTarget.style.background = ''} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border, #eee)' }}>
                    <b>{c.razao_social || c.nome_fantasia}</b>
                    <div style={{ fontSize: 12, opacity: .7 }}>{c.cnpj || c.cpf || 'sem documento'}{c.cidade ? ` · ${c.cidade}` : ''}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <label style={{ fontSize: 12, fontWeight: 600 }}>PDF do contrato social * (máx. 20 MB)</label>
      <input type="file" accept="application/pdf,.pdf" style={{ display: 'block', margin: '4px 0 12px' }}
        onChange={e => setFile(e.target.files && e.target.files[0] || null)}/>

      <label style={{ fontSize: 12, fontWeight: 600 }}>Observação (opcional)</label>
      <input className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="Ex.: 3ª alteração contratual"
        value={obs} onChange={e => setObs(e.target.value)}/>

      {erro && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{erro}</div>}
      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </CsOverlay>
  );
}

window.ContratosSociaisPage = ContratosSociaisPage;
