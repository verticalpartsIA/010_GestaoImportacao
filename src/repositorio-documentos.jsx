/* ============================================================
   repositorio-documentos.jsx — Entrega & Documentação › Repositório Documentos
   Tela nova, independente de Central de Documentos/Data Book & Termo/Entrega
   Final (que continuam exatamente como sempre foram — rotas próprias, item
   de menu próprio). Esta é um repositório genérico: a Engenharia sobe
   qualquer documento que ache necessário guardar e salva aqui — sem vínculo
   com cliente/obra/cotação, sem tipo de arquivo fixo. Mesmo padrão de
   Contratos Social (src/contratos-sociais.jsx): upload + lista + excluir.
   ============================================================ */

function rdFmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function rdFmtTam(b) {
  if (!b) return '—';
  return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}
function rdNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function RdOverlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', color: 'var(--text, inherit)', borderRadius: 10, padding: 22, width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function RdModalEnviar({ onClose, onSaved }) {
  const [titulo, setTitulo] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState('');

  async function salvar() {
    setErro('');
    if (!file) return setErro('Selecione o arquivo.');
    setSaving(true);
    try {
      await window.RepositorioDocumentosStore.salvar({ file, titulo, descricao });
      window.toast?.('Documento salvo.', 'success');
      onSaved();
    } catch (e) { setErro(e.message); setSaving(false); }
  }

  return (
    <RdOverlay onClose={saving ? () => {} : onClose}>
      <h3 style={{ marginTop: 0 }}>Enviar documento</h3>

      <label style={{ fontSize: 12, fontWeight: 600 }}>Arquivo * (máx. 25 MB)</label>
      <input type="file" style={{ display: 'block', margin: '4px 0 12px' }}
        onChange={e => setFile(e.target.files && e.target.files[0] || null)}/>

      <label style={{ fontSize: 12, fontWeight: 600 }}>Título (opcional — usa o nome do arquivo se vazio)</label>
      <input className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="Ex.: Manual do fabricante — motor VPB-320"
        value={titulo} onChange={e => setTitulo(e.target.value)}/>

      <label style={{ fontSize: 12, fontWeight: 600 }}>Descrição (opcional)</label>
      <textarea className="input" rows={3} style={{ width: '100%', marginBottom: 12, resize: 'vertical' }}
        placeholder="Alguma observação sobre esse documento?"
        value={descricao} onChange={e => setDescricao(e.target.value)}/>

      {erro && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{erro}</div>}
      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </RdOverlay>
  );
}

function RepositorioDocumentosPage() {
  const [itens, setItens] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busca, setBusca] = React.useState('');
  const [modal, setModal] = React.useState(false);
  const [excluirAlvo, setExcluirAlvo] = React.useState(null);
  const [podeCriar, setPodeCriar] = React.useState(true);
  const [podeExcluir, setPodeExcluir] = React.useState(true);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    try { setItens(await window.RepositorioDocumentosStore.listar()); }
    catch (e) { window.toast?.('Não foi possível carregar os documentos: ' + e.message, 'error'); setItens([]); }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    carregar();
    if (window.PropostaStore?.temCapacidade) {
      window.PropostaStore.temCapacidade('repositorio-documentos', 'criar').then(setPodeCriar).catch(() => {});
      window.PropostaStore.temCapacidade('repositorio-documentos', 'excluir').then(setPodeExcluir).catch(() => {});
    }
  }, [carregar]);

  const filtrados = React.useMemo(() => {
    const q = rdNorm(busca);
    if (!q) return itens;
    return itens.filter(i => rdNorm(`${i.titulo} ${i.descricao} ${i.arquivo_nome} ${i.enviado_por_nome}`).includes(q));
  }, [itens, busca]);

  async function confirmarExcluir() {
    const item = excluirAlvo;
    try {
      await window.RepositorioDocumentosStore.excluir(item.id);
      window.toast?.('Documento excluído.', 'success');
      setExcluirAlvo(null);
      carregar();
    } catch (e) { window.toast?.(e.message, 'error'); }
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Entrega & Documentação</div>
          <h1 className="page-head__title">Repositório Documentos</h1>
          <p className="page-head__sub">Qualquer documento que a Engenharia ache necessário guardar aqui</p>
        </div>
        <div className="row gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</Button>
          {podeCriar && <Button onClick={() => setModal(true)}>+ Enviar documento</Button>}
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <input className="input" style={{ width: '100%' }} placeholder="Buscar por título, descrição ou arquivo…"
          value={busca} onChange={e => setBusca(e.target.value)}/>
      </Card>

      <Card>
        {loading ? <div style={{ padding: 24 }}>Carregando…</div>
        : filtrados.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', opacity: .7 }}>
            {itens.length === 0 ? 'Nenhum documento salvo ainda. Clique em "Enviar documento".' : 'Nenhum resultado para a busca.'}
          </div>
        ) : (
          <table className="table tab-cruz" style={{ width: '100%' }}>
            <thead><tr>
              <th>Documento</th><th>Arquivo</th><th>Tamanho</th><th>Enviado por</th><th>Data</th><th style={{ width: 150 }}></th>
            </tr></thead>
            <tbody>
              {filtrados.map(i => (
                <tr key={i.id}>
                  <td><b>{i.titulo}</b>{i.descricao ? <div style={{ fontSize: 12, opacity: .7 }}>{i.descricao}</div> : null}</td>
                  <td>{i.arquivo_nome}</td>
                  <td>{rdFmtTam(i.tamanho_bytes)}</td>
                  <td>{i.enviado_por_nome || i.enviado_por_email || '—'}</td>
                  <td>{rdFmtData(i.criado_em)}</td>
                  <td>
                    <div className="row gap-2">
                      <a className="btn btn--outline" href={i.arquivo_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                      {podeExcluir && <button className="btn btn--outline" title="Excluir" onClick={() => setExcluirAlvo(i)}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && <RdModalEnviar onClose={() => setModal(false)} onSaved={() => { setModal(false); carregar(); }}/>}

      {excluirAlvo && (
        <RdOverlay onClose={() => setExcluirAlvo(null)}>
          <h3 style={{ marginTop: 0 }}>Excluir documento?</h3>
          <p><b>{excluirAlvo.titulo}</b><br/>{excluirAlvo.arquivo_nome}</p>
          <p style={{ fontSize: 13, opacity: .75 }}>O registro sai da lista (o arquivo fica guardado para recuperação pelo suporte).</p>
          <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setExcluirAlvo(null)}>Cancelar</Button>
            <Button onClick={confirmarExcluir}>Sim, excluir</Button>
          </div>
        </RdOverlay>
      )}
    </div>
  );
}

window.RepositorioDocumentosPage = RepositorioDocumentosPage;
