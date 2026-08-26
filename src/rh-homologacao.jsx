/* ============================================================
   rh-homologacao.jsx — RH Operacional · Homologação de Instaladores
   Navega Empresa → Colaborador → Documentos (catálogo real de 79 tipos,
   vencimento por pessoa). Cadastro raso da empresa (nome/CNPJ/endereço)
   e do colaborador (nome/CPF/RG) vive em Cadastros → Empresas
   Instaladoras (cadastro-instaladores.jsx) — esta tela só trata
   compliance documental.
   ============================================================ */

function RHHomologacaoPage() {
  const [empresas, setEmpresas] = React.useState(null);
  const [resumo, setResumo] = React.useState({});
  const [search, setSearch] = React.useState('');
  const [selectedEmpresa, setSelectedEmpresa] = React.useState(null);
  const [colaboradores, setColaboradores] = React.useState([]);
  const [selectedColaborador, setSelectedColaborador] = React.useState(null);
  const [documentos, setDocumentos] = React.useState([]);
  const [catalogo, setCatalogo] = React.useState([]);
  const [editingDoc, setEditingDoc] = React.useState(null); // { doc } | { novo: true }

  const reload = React.useCallback(async () => {
    const [list, res] = await Promise.all([
      window.RHHomologacao.listarMontadores(),
      window.RHHomologacao.resumoDocumentosPorEmpresa(),
    ]);
    setEmpresas(list);
    setResumo(res);
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  React.useEffect(() => { window.RHHomologacao.listarDocCatalogo().then(setCatalogo); }, []);

  const selectEmpresa = async (emp) => {
    setSelectedEmpresa(emp);
    setSelectedColaborador(null);
    setDocumentos([]);
    const list = await window.RHHomologacao.listarColaboradoresPorEmpresa(emp.id);
    setColaboradores(list);
  };

  const selectColaborador = async (col) => {
    setSelectedColaborador(col);
    const docs = await window.RHHomologacao.listarDocumentosColaborador(col.id);
    setDocumentos(docs);
  };

  const reloadDocumentos = async () => {
    if (!selectedColaborador) return;
    const docs = await window.RHHomologacao.listarDocumentosColaborador(selectedColaborador.id);
    setDocumentos(docs);
    reload();
  };

  if (empresas === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const totais = Object.values(resumo).reduce((acc, r) => ({
    vencido: acc.vencido + r.vencido, valido: acc.valido + r.valido, na: acc.na + r.na,
  }), { vencido: 0, valido: 0, na: 0 });

  const filtered = empresas.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.nome || '').toLowerCase().includes(q) || (e.cnpj || '').includes(q);
  });

  const catalogoColaborador = catalogo.filter((c) => c.escopo === 'colaborador');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule" />RH Operacional · Homologação de Instaladores</div>
          <h1 className="page-head__title">Homologação de Instaladores</h1>
          <p className="page-head__sub">Compliance documental por colaborador — RG, CNH, ASO, NRs e demais documentos do catálogo, com vencimento real. Cadastro da empresa/colaborador fica em Cadastros → Empresas Instaladoras.</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPI label="Empresas" value={String(empresas.length)} sub="parceiros cadastrados" icon="users" />
        <KPI label="Documentos vencidos" value={String(totais.vencido)} sub="ação necessária" icon="alertTriangle" />
        <KPI label="Documentos válidos" value={String(totais.valido)} sub="em dia" icon="check" />
        <KPI label="Sem vencimento (N/A)" value={String(totais.na)} sub="documento existe, sem data" icon="minus" />
      </div>

      <input className="input" style={{ marginBottom: 14 }} placeholder="Buscar empresa por nome ou CNPJ…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid-3" style={{ gap: 16 }}>
        <Card title="Empresas" sub={`${filtered.length} registros`}>
          <div className="stack" style={{ gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma empresa encontrada.</div>
            )}
            {filtered.map((e) => {
              const r = resumo[e.id];
              return (
                <div key={e.id} style={{
                  background: selectedEmpresa?.id === e.id ? "var(--vp-gray-50)" : "#fff",
                  border: "1px solid " + (selectedEmpresa?.id === e.id ? "#000" : "var(--border)"),
                  padding: 12, cursor: "pointer", position: "relative",
                }} onClick={() => selectEmpresa(e)}>
                  <span style={{ position: "absolute", top: 0, left: 0, width: 20, height: 3, background: "var(--vp-yellow)" }} />
                  <div className="cell-main" style={{ fontSize: 13 }}>{e.nome}</div>
                  <div className="cell-sub" style={{ marginBottom: 6 }}>{e.id}</div>
                  {r ? (
                    <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                      {r.vencido > 0 && <Badge variant="danger">{r.vencido} vencido{r.vencido > 1 ? 's' : ''}</Badge>}
                      {r.valido > 0 && <Badge variant="success">{r.valido} válido{r.valido > 1 ? 's' : ''}</Badge>}
                    </div>
                  ) : <span className="small muted">sem documentos lançados</span>}
                </div>
              );
            })}
          </div>
        </Card>

        {selectedEmpresa ? (
          <Card title="Colaboradores" sub={`${colaboradores.length} pessoa(s) · ${selectedEmpresa.nome}`}>
            <div className="stack" style={{ gap: 8 }}>
              {colaboradores.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>
                  Nenhum colaborador cadastrado — adicione em Cadastros → Empresas Instaladoras.
                </div>
              )}
              {colaboradores.map((col) => (
                <div key={col.id} style={{
                  background: selectedColaborador?.id === col.id ? "var(--vp-gray-50)" : "#fff",
                  border: "1px solid " + (selectedColaborador?.id === col.id ? "#000" : "var(--border)"),
                  padding: 10, cursor: "pointer",
                }} onClick={() => selectColaborador(col)}>
                  <div className="cell-main" style={{ fontSize: 13 }}>{col.nome_completo}</div>
                  <div className="cell-sub">{col.cpf || col.cnh || '—'}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', color: 'var(--fg3)', fontSize: 13, padding: '40px 16px', textAlign: 'center' }}>
            Selecione uma empresa pra ver os colaboradores.
          </div>
        )}

        {selectedColaborador ? (
          <Card title="Documentos" sub={selectedColaborador.nome_completo}
            action={<Button variant="outline" size="sm" icon="plus" onClick={() => setEditingDoc({ novo: true })}>Adicionar</Button>}>
            <div className="stack" style={{ gap: 10 }}>
              {documentos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum documento lançado.</div>
              )}
              {documentos.map((doc) => {
                const status = doc.status || 'N/A';
                const cor = status === 'VENCIDO' ? '#dc2626' : status === 'VALIDO' ? '#10b981' : 'var(--border)';
                const bg = status === 'VENCIDO' ? '#fef2f2' : status === 'VALIDO' ? '#f0fdf4' : '#fff';
                const icone = status === 'VENCIDO' ? '❌' : status === 'VALIDO' ? '✅' : '⏳';
                return (
                  <div key={doc.id} style={{ padding: 10, border: `1px solid ${cor}`, background: bg, borderRadius: 4, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>{icone}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.parceiros_doc_catalogo?.nome || doc.documento_id}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                        {doc.data_vencimento ? `Vence em ${window.RHHomologacao.fmtData(doc.data_vencimento)}` : 'Sem data de vencimento'}
                      </div>
                      {doc.arquivo_link && (
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          📎 <a href="#" onClick={async (ev) => {
                            ev.preventDefault();
                            try {
                              const url = await window.RHHomologacao.urlCertificadoArquivo(doc.arquivo_link);
                              window.open(url, '_blank');
                            } catch (err) { window.toast('Erro ao abrir arquivo: ' + err.message, 'error'); }
                          }}>abrir documento</a>
                        </div>
                      )}
                      {doc.observacao && <div className="small muted" style={{ marginTop: 2 }}>{doc.observacao}</div>}
                    </div>
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditingDoc({ doc })} />
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', color: 'var(--fg3)', fontSize: 13, padding: '40px 16px', textAlign: 'center' }}>
            Selecione um colaborador pra ver os documentos.
          </div>
        )}
      </div>

      {editingDoc && selectedColaborador && (
        <ModalDocumentoColaborador
          colaboradorId={selectedColaborador.id}
          documento={editingDoc.doc || null}
          catalogo={catalogoColaborador}
          onSave={async () => { setEditingDoc(null); await reloadDocumentos(); }}
          onCancel={() => setEditingDoc(null)}
        />
      )}
    </div>
  );
}

/* Reaproveitado por Cadastros → Empresas Instaladoras (cadastro-instaladores.jsx,
   carregado depois deste arquivo) pra criar/editar o cadastro raso da empresa. */
const MNT_ENDERECO_EMPTY = {
  endereco_logradouro: '', endereco_complemento: '', endereco_bairro: '',
  endereco_cep: '', endereco_cidade: '', endereco_estado: '',
};

function ModalNovoMontador({ initialData, isEdit, onClose, onSaved }) {
  const [f, setF] = React.useState(() => ({
    nome: '', cnpj: '', email: '', telefone: '', contato: '',
    ...MNT_ENDERECO_EMPTY,
    ...(initialData || {}),
  }));
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  // CadEnderecoFields (definido em cadastros.jsx) espera set(field) => (v) => ...
  const setField = (k) => (v) => set(k, v);

  const save = async () => {
    if (!f.nome.trim()) return window.toast('Nome é obrigatório.', 'warning');

    setSaving(true);
    try {
      await window.RHHomologacao.salvarMontador({
        ...f,
        certificacoes: f.certificacoes || {},
      });
      window.toast(isEdit ? 'Dados atualizados com sucesso!' : 'Parceiro criado com sucesso!', 'success');
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
      <input className="input" type={type} value={f[key] || ''}
        onChange={e => set(key, e.target.value)} placeholder={ph}/>
    </div>
  );

  return (
    <Modal title={isEdit ? `Editar dados · ${f.nome || ''}` : 'Novo Parceiro Instalador'} onClose={onClose} width={560}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar parceiro')}
        </Button>
      </>}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {fld('Nome da empresa *', 'nome', 'text', 'Empresa de Instalação XYZ')}
        <div className="grid-2" style={{ gap:12 }}>
          {fld('CNPJ', 'cnpj', 'text', '00.000.000/0000-00')}
          {fld('Contato', 'contato', 'text', 'Nome do responsável')}
        </div>
        <div className="grid-2" style={{ gap:12 }}>
          {fld('Email', 'email', 'email', 'contato@empresa.com')}
          {fld('Telefone / WhatsApp', 'telefone', 'tel', '(11) 99999-9999')}
        </div>
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Endereço</h4>
          <CadEnderecoFields form={f} set={setField}/>
        </div>
      </div>
    </Modal>
  );
}

/* Carteira de Vacinação (DOC-080) — a carteira em si não expira (é só um
   scan), quem expira é cada vacina dentro dela. Por isso, ao escolher esse
   tipo, a UI troca 1 campo de data por um checklist de vacinas reais
   (pesquisa fornecida pelo usuário 26/08), cada uma com data opcional —
   e o save grava várias linhas em parceiros_documentos_colaborador (uma
   por vacina marcada + uma pra carteira em si), não uma só. */
const VACINAS_CATALOGO = [
  'DOC-081', 'DOC-082', 'DOC-083', 'DOC-084', 'DOC-085', 'DOC-086', 'DOC-087',
];
const CARTEIRA_VACINACAO_ID = 'DOC-080';

function statusPorData(data) {
  if (!data) return 'N/A';
  const hoje = new Date(new Date().toDateString());
  return new Date(data) < hoje ? 'VENCIDO' : 'VALIDO';
}

function ModalDocumentoColaborador({ colaboradorId, documento, catalogo, onSave, onCancel }) {
  const isEdit = !!documento;
  const [documentoId, setDocumentoId] = React.useState(documento?.documento_id || (catalogo[0]?.id || ''));
  const [dataVencimento, setDataVencimento] = React.useState(documento?.data_vencimento ? documento.data_vencimento.slice(0, 10) : '');
  const [observacao, setObservacao] = React.useState(documento?.observacao || '');
  const [arquivoAtual, setArquivoAtual] = React.useState(documento?.arquivo_link || null);
  const [arquivoNovo, setArquivoNovo] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [vacinas, setVacinas] = React.useState({}); // { [docId]: { aplicada, data } }

  const nomeDoc = documento?.parceiros_doc_catalogo?.nome || catalogo.find((c) => c.id === documentoId)?.nome || documentoId;
  const tipoSelecionado = catalogo.find((c) => c.id === documentoId);
  const isCarteiraVacinacao = !isEdit && documentoId === CARTEIRA_VACINACAO_ID;
  const toggleVacina = (id, patch) => setVacinas((p) => ({ ...p, [id]: { ...(p[id] || { aplicada: false, data: '' }), ...patch } }));

  const save = async () => {
    if (!documentoId) return window.toast('Selecione o tipo de documento.', 'warning');
    setSaving(true);
    try {
      if (isCarteiraVacinacao) {
        let arquivoPath = null;
        if (arquivoNovo) {
          const up = await window.RHHomologacao.uploadDocumentoColaboradorArquivo(colaboradorId, CARTEIRA_VACINACAO_ID, arquivoNovo);
          arquivoPath = up.path;
        }
        await window.RHHomologacao.salvarDocumentoColaborador({
          colaborador_id: colaboradorId, documento_id: CARTEIRA_VACINACAO_ID,
          data_vencimento: null, status: 'N/A', arquivo_link: arquivoPath, observacao: observacao || null,
        });
        const marcadas = VACINAS_CATALOGO.filter((id) => vacinas[id]?.aplicada);
        for (const vid of marcadas) {
          const data = vacinas[vid].data || '';
          await window.RHHomologacao.salvarDocumentoColaborador({
            colaborador_id: colaboradorId, documento_id: vid,
            data_vencimento: data || null, status: statusPorData(data), arquivo_link: null, observacao: null,
          });
        }
        window.toast(`Carteira salva — ${marcadas.length} vacina(s) registrada(s).`, 'success');
      } else {
        let arquivoPath = arquivoAtual;
        if (arquivoNovo) {
          const up = await window.RHHomologacao.uploadDocumentoColaboradorArquivo(colaboradorId, documentoId, arquivoNovo);
          arquivoPath = up.path;
        }
        await window.RHHomologacao.salvarDocumentoColaborador({
          id: documento?.id,
          colaborador_id: colaboradorId,
          documento_id: documentoId,
          data_vencimento: dataVencimento || null,
          status: statusPorData(dataVencimento),
          arquivo_link: arquivoPath || null,
          observacao: observacao || null,
        });
        window.toast('Documento salvo!', 'success');
      }
      onSave?.();
    } catch (err) {
      window.toast('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Editar: ${nomeDoc}` : 'Adicionar documento'} onClose={onCancel} width={480}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!isEdit && (
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Tipo de documento *</label>
            <select className="input" value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>
              {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {isCarteiraVacinacao ? (
          <div className="stack" style={{ gap: 6 }}>
            <label className="up-eyebrow muted">Vacinas aplicadas</label>
            <div className="small muted" style={{ marginBottom: 2 }}>Marque as que o colaborador tem e, se souber, a data de vencimento de cada uma. A carteira em si não expira.</div>
            {VACINAS_CATALOGO.map((vid) => {
              const cat = catalogo.find((c) => c.id === vid);
              const v = vacinas[vid] || { aplicada: false, data: '' };
              return (
                <div key={vid} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 8 }}>
                  <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={v.aplicada} onChange={(e) => toggleVacina(vid, { aplicada: e.target.checked })} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{cat?.nome || vid}</span>
                  </label>
                  {v.aplicada && (
                    <div style={{ marginTop: 6, marginLeft: 24 }}>
                      <label className="small muted" style={{ display: 'block', marginBottom: 2 }}>Quando expira essa vacina? (opcional)</label>
                      <input className="input" type="date" style={{ maxWidth: 200 }} value={v.data} onChange={(e) => toggleVacina(vid, { data: e.target.value })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            <label className="up-eyebrow muted">Quando expira esse documento?</label>
            <input className="input" type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            <div className="small muted">
              {tipoSelecionado?.periodicidade === 'indeterminado'
                ? 'Este documento normalmente não expira — pode deixar em branco (fica marcado N/A).'
                : 'Deixe em branco se o documento não tem vencimento (fica marcado N/A).'}
            </div>
          </div>
        )}

        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">{isCarteiraVacinacao ? 'Scan da carteira (PDF ou imagem)' : 'Documento (PDF ou imagem)'}</label>
          {arquivoAtual && !arquivoNovo && (
            <div className="row sb" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 8 }}>
              <span className="small">📎 arquivo já enviado</span>
              <Button variant="ghost" size="sm" icon="trash" onClick={() => setArquivoAtual(null)} />
            </div>
          )}
          {arquivoNovo && <div className="small muted">Novo arquivo selecionado: {arquivoNovo.name} (substitui ao salvar)</div>}
          <input className="input" type="file" accept="application/pdf,image/*" onChange={(e) => setArquivoNovo(e.target.files?.[0] || null)} />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="up-eyebrow muted">Observações</label>
          <textarea className="input" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  );
}

window.RHHomologacaoPage = RHHomologacaoPage;
