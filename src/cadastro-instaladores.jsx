/* ============================================================
   cadastro-instaladores.jsx — Cadastros · Empresas Instaladoras
   Cadastro raso de empresas parceiras (mesma tabela parceiros_instaladores
   usada pela Homologação em RH Operacional) + colaboradores (pessoa
   física) de cada empresa. Não mexe em certificações/documentos —
   isso é RH Operacional → Homologação de Instaladores.
   ============================================================ */

/* status_master de dossier_obra (STATUS_FLOW em dossier-store.js) — usado
   só pra classificar cada obra vinculada nos 3 baldes da aba Obras. */
const CI_OBRA_CONCLUIDA = new Set(['Entregue', 'Manutenção preventiva']);

function CadastroInstaladoresPage({ setRoute, setSubsel }) {
  const [empresas, setEmpresas] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [colaboradores, setColaboradores] = React.useState([]);
  const [obras, setObras] = React.useState(null);
  const [showEmpresaModal, setShowEmpresaModal] = React.useState(false);
  const [editingEmpresa, setEditingEmpresa] = React.useState(null);
  const [showColaboradorModal, setShowColaboradorModal] = React.useState(false);
  const [editingColaborador, setEditingColaborador] = React.useState(null);
  const [search, setSearch] = React.useState('');

  const reloadEmpresas = React.useCallback(() => {
    window.RHHomologacao.listarMontadores().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);
  React.useEffect(() => { reloadEmpresas(); }, [reloadEmpresas]);

  const reloadColaboradores = React.useCallback(async (empresaId) => {
    const list = await window.RHHomologacao.listarColaboradoresPorEmpresa(empresaId);
    setColaboradores(list);
  }, []);

  const reloadObras = React.useCallback(async (empresaId) => {
    setObras(null);
    const list = await window.RHHomologacao.listarObrasPorInstalador(empresaId);
    setObras(list);
  }, []);

  const selectEmpresa = async (emp) => {
    setSelected(emp);
    await Promise.all([reloadColaboradores(emp.id), reloadObras(emp.id)]);
  };

  const abrirObra = (obraId) => {
    setSubsel && setSubsel(obraId);
    setRoute && setRoute('dossier-obra');
  };

  if (empresas === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = empresas.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.nome || '').toLowerCase().includes(q) || (e.cnpj || '').includes(q);
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />Cadastros · Empresas Instaladoras</div>
          <h1 className="page-head__title">Empresas Instaladoras</h1>
          <p className="page-head__sub">Cadastro completo dos parceiros de instalação — dados da empresa e colaboradores. Certificações e vencimento de documentos ficam em RH Operacional → Homologação de Instaladores.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditingEmpresa(null); setShowEmpresaModal(true); }}>Nova empresa</Button>
        </div>
      </div>

      <input className="input" style={{ marginBottom: 14 }} placeholder="Buscar por nome ou CNPJ…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="small muted" style={{ marginBottom: 10 }}>{filtered.length} empresa(s) encontrada(s)</div>

      <div className="grid-3" style={{ gap: 20 }}>
        <Card title="Empresas Instaladoras" sub={`${empresas.length} registros`}>
          <div className="stack" style={{ gap: 12 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13 }}>
                Nenhuma empresa encontrada.
              </div>
            )}
            {filtered.map((e) => (
              <div key={e.id} style={{
                background: selected?.id === e.id ? "var(--vp-gray-50)" : "#fff",
                border: "1px solid " + (selected?.id === e.id ? "#000" : "var(--border)"),
                padding: 14,
                cursor: "pointer",
                position: "relative",
              }} onClick={() => selectEmpresa(e)}>
                <span style={{ position: "absolute", top: 0, left: 0, width: 24, height: 3, background: "var(--vp-yellow)" }} />
                <div className="row sb">
                  <div>
                    <div className="cell-main" style={{ fontSize: 14 }}>{e.nome}</div>
                    <div className="cell-sub">{e.id} · {e.cnpj || '—'}</div>
                  </div>
                  <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={(ev) => { ev.stopPropagation(); setEditingEmpresa(e); setShowEmpresaModal(true); }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6 }}>
                  {e.email || e.telefone || '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card title={`Colaboradores · ${selected.nome}`} sub={`${colaboradores.length} pessoa(s)`}
            action={<Button variant="outline" size="sm" icon="plus" onClick={() => { setEditingColaborador(null); setShowColaboradorModal(true); }}>Novo colaborador</Button>}>
            <div className="stack" style={{ gap: 8 }}>
              {colaboradores.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>
                  Nenhum colaborador cadastrado.
                </div>
              )}
              {colaboradores.map((col) => (
                <div key={col.id} className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10 }}>
                  <div>
                    <div className="cell-main" style={{ fontSize: 13 }}>{col.nome_completo}</div>
                    <div className="cell-sub">{col.cpf || col.cnh || '—'}{col.status && col.status !== 'Ativo' ? ` · ${col.status}` : ''}</div>
                  </div>
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => { setEditingColaborador(col); setShowColaboradorModal(true); }} />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', color: 'var(--fg3)', fontSize: 13, padding: '60px 20px', textAlign: 'center' }}>
            Selecione uma empresa à esquerda pra ver/gerenciar os colaboradores.
          </div>
        )}

        {selected ? (
          <Card title="Obras" sub={obras ? `${obras.length} vinculada(s)` : 'Carregando…'}>
            <CIObrasList obras={obras} onAbrir={abrirObra} />
          </Card>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', color: 'var(--fg3)', fontSize: 13, padding: '60px 20px', textAlign: 'center' }}>
            Selecione uma empresa pra ver em quais obras ela está montando ou já montou.
          </div>
        )}
      </div>

      {showEmpresaModal && (
        <ModalNovoMontador
          initialData={editingEmpresa}
          isEdit={!!editingEmpresa}
          onClose={() => setShowEmpresaModal(false)}
          onSaved={async () => {
            await reloadEmpresas();
            if (selected && editingEmpresa && selected.id === editingEmpresa.id) {
              const full = await window.RHHomologacao.obterMontador(selected.id);
              setSelected(full);
            }
          }}
        />
      )}

      {showColaboradorModal && selected && (
        <ModalColaborador
          empresaId={selected.id}
          initialData={editingColaborador}
          isEdit={!!editingColaborador}
          onClose={() => setShowColaboradorModal(false)}
          onSaved={() => reloadColaboradores(selected.id)}
        />
      )}
    </div>
  );
}

const COL_ENDERECO_EMPTY = {
  endereco_logradouro: '', endereco_complemento: '', endereco_bairro: '',
  endereco_cep: '', endereco_cidade: '', endereco_estado: '',
};

function ModalColaborador({ empresaId, initialData, isEdit, onClose, onSaved }) {
  const [f, setF] = React.useState(() => ({
    nome_completo: '', cpf: '', rg: '', cnh: '', tipo_vinculo: '', status: 'Ativo', observacao: '',
    ...COL_ENDERECO_EMPTY,
    ...(initialData || {}),
  }));
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setField = (k) => (v) => set(k, v);

  const save = async () => {
    if (!f.nome_completo.trim()) return window.toast('Nome é obrigatório.', 'warning');
    setSaving(true);
    try {
      await window.RHHomologacao.salvarColaborador({ ...f, empresa_id: empresaId });
      window.toast(isEdit ? 'Colaborador atualizado!' : 'Colaborador criado!', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      window.toast('Erro: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fld = (label, key, type = 'text', ph = '') => (
    <div className="stack" style={{ gap: 4 }}>
      <label className="up-eyebrow muted">{label}</label>
      <input className="input" type={type} value={f[key] || ''} onChange={(e) => set(key, e.target.value)} placeholder={ph} />
    </div>
  );

  return (
    <Modal title={isEdit ? `Editar colaborador · ${f.nome_completo}` : 'Novo Colaborador'} onClose={onClose} width={560}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar colaborador')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fld('Nome completo *', 'nome_completo', 'text', 'Nome do colaborador')}
        <div className="grid-3" style={{ gap: 12 }}>
          {fld('CPF', 'cpf')}
          {fld('RG', 'rg')}
          {fld('CNH', 'cnh')}
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          {fld('Tipo de vínculo', 'tipo_vinculo', 'text', 'CLT, MEI, autônomo…')}
          <PIField label="Status"><PISelect value={f.status} onChange={setField('status')} options={['Ativo', 'Inativo', 'A_CONFIRMAR']} /></PIField>
        </div>
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Endereço</h4>
          <CadEnderecoFields form={f} set={setField} />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={2} value={f.observacao || ''} onChange={(e) => set('observacao', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function CIObraRow({ obra, onAbrir }) {
  return (
    <div className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10, cursor: 'pointer' }}
      onClick={() => onAbrir(obra.id)}>
      <div>
        <div className="cell-main" style={{ fontSize: 13 }}>{obra.client_name || '—'}</div>
        <div className="cell-sub">{obra.building_name}</div>
      </div>
      <Icon.chevRight size={14} />
    </div>
  );
}

/* Atual (instalando agora) / Concluídas (histórico) / Outras (vinculado mas
   ainda não chegou na fase de instalação) — os dois vínculos possíveis
   (obra inteira ou por equipamento) já vêm unidos por
   listarObrasPorInstalador. */
function CIObrasList({ obras, onAbrir }) {
  if (obras === null) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;
  if (obras.length === 0) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma obra vinculada a esta empresa ainda.</div>;

  const atuais = obras.filter((o) => o.status_master === 'Instalação');
  const concluidas = obras.filter((o) => CI_OBRA_CONCLUIDA.has(o.status_master));
  const outras = obras.filter((o) => o.status_master !== 'Instalação' && !CI_OBRA_CONCLUIDA.has(o.status_master));

  return (
    <div className="stack" style={{ gap: 16 }}>
      {atuais.length > 0 && (
        <div>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Instalando agora ({atuais.length})</div>
          <div className="stack" style={{ gap: 8 }}>{atuais.map((o) => <CIObraRow key={o.id} obra={o} onAbrir={onAbrir} />)}</div>
        </div>
      )}
      {concluidas.length > 0 && (
        <div>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Concluídas ({concluidas.length})</div>
          <div className="stack" style={{ gap: 8 }}>{concluidas.map((o) => <CIObraRow key={o.id} obra={o} onAbrir={onAbrir} />)}</div>
        </div>
      )}
      {outras.length > 0 && (
        <div>
          <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Vinculada, instalação ainda não iniciada ({outras.length})</div>
          <div className="stack" style={{ gap: 8 }}>{outras.map((o) => <CIObraRow key={o.id} obra={o} onAbrir={onAbrir} />)}</div>
        </div>
      )}
    </div>
  );
}

window.CadastroInstaladoresPage = CadastroInstaladoresPage;
