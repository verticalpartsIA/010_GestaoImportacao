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
  const [estatisticas, setEstatisticas] = React.useState({});
  const [pagamentosPorEmpresa, setPagamentosPorEmpresa] = React.useState({});
  const [pagamentosPorObra, setPagamentosPorObra] = React.useState({});
  const [naoVinculados, setNaoVinculados] = React.useState(null);
  const [ultimoSync, setUltimoSync] = React.useState(null);
  const [sincronizando, setSincronizando] = React.useState(false);

  const reloadEmpresas = React.useCallback(() => {
    window.RHHomologacao.listarMontadores().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);
  React.useEffect(() => { reloadEmpresas(); }, [reloadEmpresas]);
  React.useEffect(() => {
    window.RHHomologacao.estatisticasTodasEmpresas().then(setEstatisticas).catch(() => setEstatisticas({}));
  }, []);

  const reloadPagamentos = React.useCallback(() => {
    window.OmiePagamentosStore?.resumoPorEmpresa().then(setPagamentosPorEmpresa).catch(() => setPagamentosPorEmpresa({}));
    window.OmiePagamentosStore?.ultimoSync().then(setUltimoSync).catch(() => setUltimoSync(null));
  }, []);
  React.useEffect(() => { reloadPagamentos(); }, [reloadPagamentos]);

  const sincronizarOmie = async () => {
    setSincronizando(true);
    try {
      const r = await window.OmiePagamentosStore.sincronizar();
      window.toast?.(`Pagamentos atualizados — ${r.titulos_gravados} título(s) do Omie.`, 'success');
      reloadPagamentos();
    } catch (e) {
      window.toast?.('Erro ao sincronizar com o Omie: ' + e.message, 'error');
    } finally {
      setSincronizando(false);
    }
  };

  const reloadColaboradores = React.useCallback(async (empresaId) => {
    const list = await window.RHHomologacao.listarColaboradoresPorEmpresa(empresaId);
    setColaboradores(list);
  }, []);

  const reloadObras = React.useCallback(async (empresaId) => {
    setObras(null);
    setNaoVinculados(null);
    const list = await window.RHHomologacao.listarHierarquiaClientesDoInstalador(empresaId);
    setObras(list);
    const dossierIds = list.flatMap(({ obras: os }) => os.map((o) => o.id));
    window.OmiePagamentosStore?.resumoPorDossier(dossierIds).then(setPagamentosPorObra).catch(() => setPagamentosPorObra({}));
    window.OmiePagamentosStore?.naoVinculadosPorEmpresa(empresaId).then(setNaoVinculados).catch(() => setNaoVinculados(null));
  }, []);

  const selectEmpresa = async (emp) => {
    setSelected(emp);
    await Promise.all([reloadColaboradores(emp.id), reloadObras(emp.id)]);
  };

  const abrirObra = (obraId) => {
    setSubsel && setSubsel(obraId);
    setRoute && setRoute('dossier-obra');
  };

  const excluirEmpresa = async (emp) => {
    if (!window.confirm(`Excluir a empresa "${emp.nome}"? Isso não pode ser desfeito.`)) return;
    try {
      await window.RHHomologacao.excluirMontador(emp.id);
      window.toast?.('Empresa excluída.', 'success');
      if (selected?.id === emp.id) { setSelected(null); setColaboradores([]); setObras(null); }
      reloadEmpresas();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const excluirColab = async (col) => {
    if (!window.confirm(`Excluir o colaborador "${col.nome_completo}"?`)) return;
    try {
      await window.RHHomologacao.excluirColaborador(col.id);
      window.toast?.('Colaborador excluído.', 'success');
      reloadColaboradores(selected.id);
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const desvincularObra = async (obra) => {
    if (!window.confirm('Desvincular esta empresa deste equipamento/obra?')) return;
    try {
      await window.RHHomologacao.desvincularDaObra(selected.id, obra.id);
      window.toast?.('Vínculo removido.', 'success');
      reloadObras(selected.id);
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
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
          <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
            <Button variant="outline" icon="refresh" onClick={sincronizarOmie} disabled={sincronizando}>
              {sincronizando ? 'Sincronizando…' : 'Atualizar pagamentos (Omie)'}
            </Button>
            {ultimoSync?.concluido_em && (
              <span className="small muted">
                Última sinc.: {new Date(ultimoSync.concluido_em).toLocaleString('pt-BR')}
                {ultimoSync.erro ? ` · ⚠️ ${ultimoSync.erro}` : ''}
              </span>
            )}
          </div>
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
                  <div className="row gap-1">
                    <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={(ev) => { ev.stopPropagation(); setEditingEmpresa(e); setShowEmpresaModal(true); }} />
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={(ev) => { ev.stopPropagation(); excluirEmpresa(e); }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6 }}>
                  {e.email || e.telefone || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 8, display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 6, flexWrap: 'wrap' }}>
                  <span>👥 Funcionários: <b>{estatisticas[e.id]?.funcionarios ?? 0}</b></span>
                  <span>🛗 Elevadores: <b>{estatisticas[e.id]?.elevadores ?? 0}</b></span>
                  <span>
                    💰 Pagamentos: {pagamentosPorEmpresa[e.id] ? (
                      <b>{window.OmiePagamentosStore.fmtMoeda(pagamentosPorEmpresa[e.id].valorPago)} pago · {window.OmiePagamentosStore.fmtMoeda(pagamentosPorEmpresa[e.id].valorTotal)} previsto</b>
                    ) : <b>—</b>}
                  </span>
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
                  <div className="row gap-1">
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => { setEditingColaborador(col); setShowColaboradorModal(true); }} />
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => excluirColab(col)} />
                  </div>
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
          <Card title="Clientes atendidos" sub={obras ? `${obras.length} cliente(s)` : 'Carregando…'}>
            <CIHierarquiaClientes clientes={obras} onAbrir={abrirObra} onDesvincular={desvincularObra} pagamentosPorObra={pagamentosPorObra} />
            {naoVinculados && naoVinculados.itens.length > 0 && (
              <div style={{ marginTop: 16, padding: 10, background: '#fff8e6', border: '1px solid #f0d787', borderRadius: 4, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  ⚠️ {window.OmiePagamentosStore.fmtMoeda(naoVinculados.valorTotal)} no Omie pra este fornecedor sem obra vinculada aqui no sistema
                  {' '}(por isso a soma acima do card não bate com a soma das obras abaixo):
                </div>
                <div className="stack" style={{ gap: 2 }}>
                  {naoVinculados.itens.map((it) => (
                    <div key={it.texto} className="row sb" style={{ color: 'var(--fg3)' }}>
                      <span>{it.texto}</span>
                      <span>{window.OmiePagamentosStore.fmtMoeda(it.valorPago)} pago · {window.OmiePagamentosStore.fmtMoeda(it.valorTotal)} previsto</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', color: 'var(--fg3)', fontSize: 13, padding: '60px 20px', textAlign: 'center' }}>
            Selecione uma empresa pra ver quais clientes ela atendeu e o que montou em cada um.
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

/* Status de cada obra dentro da árvore do cliente. Quando dá pra saber o
   progresso real do Diário de Obra / Acompanhamento de Obra (flags
   datados que o Montador envia pelo link fixo, ponderados pelos pesos
   de "não commitar/AcompanhamentoObra.md",
   window.AcompanhamentoObraStore.resumoProgresso — trocado de
   InstalacaoChecklistStore em 04/09), usa ele — é mais fiel que o
   status_master genérico (ex.: dois equipamentos podem estar os dois
   com status_master="Instalação" mas um já com itens concluídos e o
   outro com zero, ver achado de 01/09). Sem link do diário gerado
   ainda (checklist.criado===false), cai pro status_master puro (mesma
   classificação de antes). */
function CIObraStatusBadge({ statusMaster, checklist, pagamento }) {
  const concluida = CI_OBRA_CONCLUIDA.has(statusMaster);
  if (checklist && checklist.criado) {
    if (checklist.pct >= 100) {
      /* "Obra Concluída" (Trilha B, 01/09) = instalação 100% E as
         parcelas do contrato que cobre este dossiê já estão 100% pagas —
         sem contrato vinculado ou com parcela pendente, fica no estado
         intermediário "Instalação concluída". */
      if (pagamento && pagamento.temContrato && pagamento.tudoPago) {
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#00aa00' }}>🏁 Obra Concluída</span>;
      }
      if (pagamento && pagamento.temContrato && !pagamento.tudoPago) {
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#cc7700' }}>Instalação concluída · pagamento pendente</span>;
      }
      return <span style={{ fontSize: 11, fontWeight: 600, color: '#00aa00' }}>Concluída · 100%</span>;
    }
    return <span style={{ fontSize: 11, fontWeight: 600, color: '#cc7700' }}>Instalando — {checklist.pct}%</span>;
  }
  if (statusMaster === 'Instalação') return <span style={{ fontSize: 11, fontWeight: 600, color: '#999' }}>Não iniciado</span>;
  const instalando = statusMaster === 'Instalação';
  const cor = concluida ? '#00aa00' : instalando ? '#cc7700' : '#999';
  const label = concluida ? 'Concluída' : instalando ? 'Instalando agora' : (statusMaster || '—');
  return <span style={{ fontSize: 11, fontWeight: 600, color: cor }}>{label}</span>;
}

function CIFmtData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }

/* Barra comparativa "dinheiro pago" (amarelo) × "progresso físico da
   obra" (traço preto) — pedido do usuário 04/09: dar uma cara de
   gráfico ao card, e deixar visualmente óbvio quando o pago passou do
   traço (pagou adiantado) ou o traço passou do amarelo (obra andou
   mais que o pagamento, marco batido pede atenção do supervisor). */
function CIBarraPagoProgresso({ pctPago, checklist }) {
  if (!checklist || !checklist.criado) return null;
  const pctObra = checklist.pct || 0;
  return (
    <div style={{ padding: '8px 10px 6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg3)', marginBottom: 3, fontWeight: 600 }}>
        <span>💰 Pago {pctPago}%</span>
        <span>🏗️ Obra {pctObra}%</span>
      </div>
      <div style={{ position: 'relative', height: 8, background: '#eee', borderRadius: 4, overflow: 'visible' }}>
        <div style={{ position: 'absolute', inset: 0, width: Math.min(pctPago, 100) + '%', background: 'var(--vp-yellow, #f5c518)', borderRadius: 4 }} />
        <div title={`Progresso físico: ${pctObra}%`} style={{ position: 'absolute', top: -2, bottom: -2, left: `calc(${Math.min(pctObra, 100)}% - 1px)`, width: 2, background: '#333', borderRadius: 1 }} />
      </div>
    </div>
  );
}

/* Regra de negócio do usuário (04/09): todo contrato de instalação tem
   SEMPRE 4 parcelas — Entrada (sinal), 50%, 75%, 100% — mesmo que
   alguma ainda não tenha sido lançada no Omie. A tabela sempre mostra
   as 4 linhas; o que faltar aparece vazio/pendente, nunca some. Se por
   algum motivo houver mais de 4 títulos vinculados (raro), os extras
   aparecem depois com numeração genérica em vez de sumir dado real. */
const CI_PARCELA_LABELS = ['Entrada (sinal)', '50%', '75%', '100%'];

/* "Planilhinha" de parcelas do card de obra (04/09) — cada título do
   Omie vinculado a este dossier vira 1 linha, listrada de amarelo
   quando paga. Junto vem a barra comparativa e, quando faz sentido, um
   aviso: dinheiro à frente do progresso físico (alerta) ou obra bateu
   marco que o pagamento ainda não alcançou (sugestão — nunca some
   automaticamente: precisa do aval do supervisor). */
function CITabelaPagamentos({ pagamento, checklist }) {
  const fmt = window.OmiePagamentosStore?.fmtMoeda || ((v) => v);
  if (!pagamento) {
    return <div className="small muted" style={{ marginTop: 4 }}>Valor da instalação: — · Pago: —%</div>;
  }
  const parcelasReais = pagamento.parcelas || [];
  const totalLinhas = Math.max(CI_PARCELA_LABELS.length, parcelasReais.length);
  const linhas = Array.from({ length: totalLinhas }, (_, i) => parcelasReais[i] || null);
  const alerta = window.OmiePagamentosStore?.comparaPagoComProgresso(pagamento.pctPago, checklist);
  return (
    <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', fontSize: 11 }} onClick={(ev) => ev.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--vp-gray-50)', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon.dollar size={12} /> Valor da instalação</span>
        <span>{fmt(pagamento.valorTotal)}</span>
      </div>
      <div>
        {linhas.map((p, i) => (
          <div key={p?.chave || `vazia-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
            background: p?.pago ? '#fff8d6' : '#fff',
            borderBottom: i < linhas.length - 1 ? '1px solid var(--border)' : 'none',
            opacity: p ? 1 : 0.55,
          }}>
            <span style={{ flex: '0 0 90px', color: 'var(--fg3)' }}>{CI_PARCELA_LABELS[i] || `${i + 1}ª parcela`}</span>
            <span style={{ flex: '0 0 36px', textAlign: 'right', color: 'var(--fg3)' }}>{p ? `${p.pctDoValor}%` : '—'}</span>
            <span style={{ flex: '1', textAlign: 'right', fontWeight: 600 }}>{p ? fmt(p.valor) : '—'}</span>
            <span style={{ flex: '0 0 84px', textAlign: 'right', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', color: p?.pago ? '#8a6d00' : 'var(--fg3)' }}>
              {p ? (p.pago ? <><Icon.check size={10} /> {CIFmtData(p.dataPagamento)}</> : <><Icon.calendar size={10} /> —</>) : <><Icon.calendar size={10} /> não lançado</>}
            </span>
          </div>
        ))}
      </div>
      <CIBarraPagoProgresso pctPago={pagamento.pctPago} checklist={checklist} />
      {alerta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          background: alerta.tipo === 'alerta' ? '#fdecec' : '#eaf2ff',
          color: alerta.tipo === 'alerta' ? '#a33333' : '#224488',
          borderTop: '1px solid var(--border)', fontWeight: 600, fontSize: 11,
        }}>
          {alerta.tipo === 'alerta' ? <Icon.warning size={12} /> : <Icon.info size={12} />}
          {alerta.texto}
        </div>
      )}
    </div>
  );
}

/* Linha de marcos técnicos (Iniciou / Guias / Cabina / Portas / Elétrica /
   Entrega) — só aparece quando o cronograma já foi criado pra essa obra
   (checklist.criado), pra não poluir a lista com "—" repetido nas obras
   que ainda nem começaram. */
function CIMarcosTecnicos({ checklist }) {
  if (!checklist || !checklist.criado) return null;
  return (
    <div className="small muted" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
      <span>Iniciou {CIFmtData(checklist.iniciadoEm)}</span>
      {checklist.marcos.map((m) => (
        <span key={m.id}>{m.label} {m.completo ? CIFmtData(m.dataConclusao) : '—'}</span>
      ))}
    </div>
  );
}

/* "Vida da Instaladora" — Empresa (já selecionada acima) -> Cliente ->
   Equipamentos. Uma empresa pode chegar a uma obra por 3 vínculos
   diferentes (principal, roster, por equipamento) — já vêm unidos e
   deduplicados por listarHierarquiaClientesDoInstalador. */
function CIHierarquiaClientes({ clientes, onAbrir, onDesvincular, pagamentosPorObra }) {
  if (clientes === null) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;
  if (clientes.length === 0) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhum cliente vinculado a esta empresa ainda.</div>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {clientes.map(({ cliente, obras }) => (
        <div key={cliente}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🏢 {cliente} <span className="small muted">({obras.length})</span></div>
          <div className="stack" style={{ gap: 6, marginLeft: 12 }}>
            {obras.map((o) => (
              <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10, cursor: 'pointer' }}
                onClick={() => onAbrir(o.id)}>
                <div className="row sb" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="cell-main" style={{ fontSize: 13 }}>{o.numero_serie ? `Nº ${o.numero_serie}` : (o.building_name || '—')}</div>
                    {o.numero_serie && <div className="cell-sub">{o.building_name}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Button variant="ghost" size="sm" icon="trash" title="Desvincular"
                      onClick={(ev) => { ev.stopPropagation(); onDesvincular?.(o); }} />
                    <Icon.chevRight size={14} />
                  </div>
                </div>
                <CIMarcosTecnicos checklist={o.checklist} />
                <CITabelaPagamentos pagamento={pagamentosPorObra?.[o.id]} checklist={o.checklist} />
                <div style={{ marginTop: 8 }}>
                  <CIObraStatusBadge statusMaster={o.status_master} checklist={o.checklist} pagamento={o.pagamento} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

window.CadastroInstaladoresPage = CadastroInstaladoresPage;
