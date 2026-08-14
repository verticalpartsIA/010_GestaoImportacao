/* ============================================================
   embarques-importacao.jsx — Gestão Importação · Embarques
   Fase 4 da consolidação de importação dentro do VP Gestão. NÃO é o
   "Mapa de navios" (rastreamento AIS, tabela `embarques`) — esse
   continua separado e intocado. Este é o Embarques rico, vinculado às
   P.I. (pi_importacao.embarque_id).
   ============================================================ */

const EI_STATUS = ['Pagamento', 'Produção', 'Embarque', 'Desembaraço', 'Entrega', 'Concluído'];
const EI_TIPOS_FRETE = ['Marítimo', 'Aéreo', 'Rodoviário'];
const EI_MODALIDADES = ['FOB', 'FCA', 'EXW'];
const EI_CANAIS = ['Verde', 'Amarelo', 'Vermelho', 'Cinza'];
const EI_STATUS_REEMBOLSO = ['Não solicitado', 'Solicitado', 'Em análise', 'Aprovado', 'Pago', 'Cancelado'];
const EI_CONTAINER_TIPOS = ["20'DV", "40'DV", "40'HC", "20'RF", "40'RF", "20'OT", "40'OT", "20'FR", "40'FR", 'Outro'];
const EI_NFE_STATUS = ['Autorizada', 'Cancelada', 'Denegada'];

function eiFmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
function eiFmtMoeda(v, moeda) { return (v == null || v === '' || isNaN(v)) ? '—' : `${moeda || 'BRL'} ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

/* ---------- PIs vinculadas (somente leitura — fonte é a P.I.) ---------- */
function EIPIsVinculadas({ pis }) {
  const store = window.EmbarquesImportacaoStore;
  const resumo = store.resumoPIs(pis);
  return (
    <Card title="PIs vinculadas" sub="Fornecedor, incoterms, categorias e pagamentos vêm automaticamente das P.I. vinculadas a este embarque — edite-os lá.">
      {pis.length === 0 ? (
        <p className="small muted" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhuma P.I. vinculada ainda. Vincule pela tela de P.I. (botão "Vincular embarque").</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div className="grid-3" style={{ gap: 8, fontSize: 12 }}>
            <div><span className="muted">Fornecedores: </span>{resumo.fornecedores.join(', ') || '—'}</div>
            <div><span className="muted">Incoterms: </span>{resumo.incoterms.join(', ') || '—'}</div>
            <div><span className="muted">Categorias: </span>{resumo.categorias.join(', ') || '—'}</div>
            <div><span className="muted">Nºs de série: </span>{resumo.numerosSerie.join(', ') || '—'}</div>
            <div><span className="muted">Nº requisição: </span>{resumo.numerosRequisicao.join(', ') || '—'}</div>
            <div><span className="muted">Data P.I.: </span>{eiFmtDate(resumo.dataPi)}</div>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Nº P.I.</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>
                {pis.map((p) => <tr key={p.id}><td>{p.numero_pi}</td><td><StatusBadge status={p.status}/></td><td>{eiFmtMoeda(p.valor_total, p.moeda)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Pagamentos (leitura, agregado das PIs) ---------- */
function EIPagamentos({ pis }) {
  const store = window.EmbarquesImportacaoStore;
  const resumo = store.resumoPIs(pis);
  if (pis.length === 0) return <Card title="Pagamentos"><p className="small muted" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhuma P.I. vinculada. Os pagamentos aparecem aqui assim que uma P.I. for vinculada.</p></Card>;
  return (
    <Card title="Pagamentos" sub="Preenchidos automaticamente a partir das P.I. vinculadas — edite pela P.I.">
      <div style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
        <span className="small muted">Valor total do embarque: </span><b>{eiFmtMoeda(resumo.valorTotal, resumo.moeda)}</b>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {pis.map((pi) => (
          <div key={pi.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10 }}>
            <div className="row sb"><b className="small">P.I. {pi.numero_pi}{pi.fornecedor ? ` — ${pi.fornecedor}` : ''}</b><span className="small">{eiFmtMoeda(pi.valor_total, pi.moeda)}</span></div>
            <div className="grid-2" style={{ gap: 8, marginTop: 6, fontSize: 12 }}>
              <div>1º pagto: {eiFmtDate(pi.data_primeiro_pagamento)} · {eiFmtMoeda(pi.valor_primeiro_pagamento, pi.moeda)}</div>
              <div>2º pagto: {eiFmtDate(pi.data_segundo_pagamento)} · {eiFmtMoeda(pi.valor_segundo_pagamento, pi.moeda)}</div>
            </div>
            {(pi.pagamentos_adicionais || []).length > 0 && <div className="small muted" style={{ marginTop: 4 }}>+{pi.pagamentos_adicionais.length} pagamento(s) adicional(is)</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Containers ---------- */
function EIContainers({ containers, onChange }) {
  const list = containers || [];
  const add = () => onChange([...list, { numero: '', tipo_tamanho: '', lacre: '', peso: '', data_embarque: '', data_chegada: '' }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const update = (i, field, v) => onChange(list.map((c, idx) => (idx === i ? { ...c, [field]: v } : c)));
  return (
    <div>
      <div className="row sb" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Containers</h4>
        <Button variant="outline" size="sm" icon="plus" onClick={add}>Adicionar container</Button>
      </div>
      {list.length === 0 && <p className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>Nenhum container cadastrado.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {list.map((c, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10 }}>
            <div className="row sb" style={{ marginBottom: 6 }}><span className="small muted">Container {i + 1}</span><Button variant="ghost" size="sm" icon="trash" onClick={() => remove(i)}/></div>
            <div className="grid-3" style={{ gap: 8 }}>
              <PIField label="Número"><PIInput value={c.numero} onChange={(v) => update(i, 'numero', v)} placeholder="ABCD1234567"/></PIField>
              <PIField label="Tipo/tamanho"><PISelect value={c.tipo_tamanho} onChange={(v) => update(i, 'tipo_tamanho', v)} options={EI_CONTAINER_TIPOS}/></PIField>
              <PIField label="Lacre"><PIInput value={c.lacre} onChange={(v) => update(i, 'lacre', v)}/></PIField>
              <PIField label="Peso (kg)"><PIInput type="number" value={c.peso} onChange={(v) => update(i, 'peso', v)}/></PIField>
              <PIField label="Data embarque"><PIInput type="date" value={c.data_embarque} onChange={(v) => update(i, 'data_embarque', v)}/></PIField>
              <PIField label="Data chegada"><PIInput type="date" value={c.data_chegada} onChange={(v) => update(i, 'data_chegada', v)}/></PIField>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- NFes ---------- */
function EINFes({ nfes, onChange }) {
  const list = nfes || [];
  const add = () => onChange([...list, { numero: '', chave_acesso: '', data_emissao: '', cliente_destinatario: '', valor: '', status: 'Autorizada' }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const update = (i, field, v) => onChange(list.map((n, idx) => (idx === i ? { ...n, [field]: v } : n)));
  return (
    <div>
      <div className="row sb" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Notas fiscais</h4>
        <Button variant="outline" size="sm" icon="plus" onClick={add}>Adicionar NF-e</Button>
      </div>
      {list.length === 0 && <p className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>Nenhuma NF-e cadastrada.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {list.map((n, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10 }}>
            <div className="row sb" style={{ marginBottom: 6 }}><span className="small muted">NF-e {i + 1}</span><Button variant="ghost" size="sm" icon="trash" onClick={() => remove(i)}/></div>
            <div className="grid-3" style={{ gap: 8 }}>
              <PIField label="Número"><PIInput value={n.numero} onChange={(v) => update(i, 'numero', v)}/></PIField>
              <PIField label="Chave de acesso" span={2}><PIInput value={n.chave_acesso} onChange={(v) => update(i, 'chave_acesso', v)}/></PIField>
              <PIField label="Data emissão"><PIInput type="date" value={n.data_emissao} onChange={(v) => update(i, 'data_emissao', v)}/></PIField>
              <PIField label="Cliente/destinatário"><PIInput value={n.cliente_destinatario} onChange={(v) => update(i, 'cliente_destinatario', v)}/></PIField>
              <PIField label="Valor"><PIInput type="number" value={n.valor} onChange={(v) => update(i, 'valor', v)}/></PIField>
              <PIField label="Status"><PISelect value={n.status} onChange={(v) => update(i, 'status', v)} options={EI_NFE_STATUS}/></PIField>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Rolagens de ETD ---------- */
function EIRolagens({ form, set }) {
  const [nova, setNova] = React.useState({ nova_data: '', motivo: '', data_comunicacao: '' });
  const registrar = () => {
    if (!nova.nova_data) return;
    const anterior = form.etd_atual || form.etd_original || '';
    set('historico_rolagens')([...(form.historico_rolagens || []), { data_anterior: anterior, ...nova }]);
    set('etd_original')(form.etd_original || anterior);
    set('etd_atual')(nova.nova_data);
    set('houve_rolagem')(true);
    setNova({ nova_data: '', motivo: '', data_comunicacao: '' });
  };
  return (
    <div>
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>ETD — Estimated Time of Departure</h4>
        {form.houve_rolagem && <span className="badge" style={{ color: 'var(--vp-warning-ink)' }}>⚠ Houve rolagem</span>}
      </div>
      <div className="grid-3" style={{ gap: 10 }}>
        <PIField label="ETD original"><PIInput type="date" value={form.etd_original} onChange={set('etd_original')}/></PIField>
        <PIField label="ETD atual"><PIInput type="date" value={form.etd_atual} onChange={set('etd_atual')}/></PIField>
      </div>
      <div style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 10, marginTop: 10 }}>
        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Registrar rolagem pelo armador</div>
        <div className="grid-3" style={{ gap: 10 }}>
          <PIField label="Nova data ETD"><PIInput type="date" value={nova.nova_data} onChange={(v) => setNova((n) => ({ ...n, nova_data: v }))}/></PIField>
          <PIField label="Data comunicação"><PIInput type="date" value={nova.data_comunicacao} onChange={(v) => setNova((n) => ({ ...n, data_comunicacao: v }))}/></PIField>
          <PIField label="Motivo"><PIInput value={nova.motivo} onChange={(v) => setNova((n) => ({ ...n, motivo: v }))}/></PIField>
        </div>
        <div style={{ textAlign: 'right', marginTop: 8 }}><Button variant="outline" size="sm" onClick={registrar} disabled={!nova.nova_data}>Registrar rolagem</Button></div>
      </div>
      {(form.historico_rolagens || []).length > 0 && (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="t">
            <thead><tr><th>#</th><th>Data anterior</th><th>Nova data</th><th>Motivo</th><th>Comunicação</th></tr></thead>
            <tbody>{form.historico_rolagens.map((r, i) => <tr key={i}><td>{i + 1}ª</td><td>{eiFmtDate(r.data_anterior)}</td><td>{eiFmtDate(r.nova_data)}</td><td>{r.motivo || '—'}</td><td>{eiFmtDate(r.data_comunicacao)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Formulário completo ---------- */
const EI_EMPTY = {
  nome_embarque: '', status_etapa: 'Pagamento', referencia_embarque: '', porto_origem: '', porto_destino: '',
  navio: '', awb_bl: '', redestinacao: '', data_pedido_redestinacao: '',
  etd_original: '', etd_atual: '', houve_rolagem: false, historico_rolagens: [], containers: [],
  tipo_frete: '', modalidade_frete: '', agente_carga: '', cotacao_frete: '', moeda_frete: 'USD',
  aprovacao_frete: 'Pendente', pedido_booking: '', transit_time: '', free_time: '',
  referencia_despachante: '', custos_estimativa: '', documentos_marimex: '', transit_time_total: '',
  di: '', data_registro_di: '', canal_parametrizacao: '', ultima_data_free_time: '', eta_santos: '', historico_eta: [],
  empresa_desembaraco: '', faturamento_desembaraco: '', numerario_desembaraco: '', valor_reembolso: '',
  status_reembolso: 'Não solicitado', data_solicitacao_reembolso: '', data_recebimento_reembolso: '', observacoes_financeiras: '',
  data_limite_entrega: '', local_entrega: '', data_carregamento: '', data_entrega: '', devolucao_container: '', nfes: [],
  observacoes: '', historico: [], arquivado: false,
};

function EmbarqueImportacaoForm({ initialData, isEdit, pis, onSubmit, onCancel, saving }) {
  const [form, setForm] = React.useState(() => (initialData ? { ...EI_EMPTY, ...initialData } : EI_EMPTY));
  const [tab, setTab] = React.useState('identificacao');
  const set = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));

  return (
    <Card title={isEdit ? `Editar embarque ${form.nome_embarque || ''}` : 'Novo embarque'}>
      <Tabs tabs={[
        { key: 'identificacao', label: 'Identificação', icon: 'fileText' },
        { key: 'pagamentos', label: 'Pagamentos', icon: 'dollar' },
        { key: 'embarque', label: 'Embarque', icon: 'ship' },
        { key: 'frete', label: 'Frete', icon: 'truck' },
        { key: 'desembaraco', label: 'Aduaneiro', icon: 'shield' },
        { key: 'faturamento', label: 'Faturamento', icon: 'fileSearch' },
        { key: 'entrega', label: 'Entrega', icon: 'package' },
      ]} active={tab} onChange={setTab}/>

      {tab === 'identificacao' && (
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <div style={{ background: 'var(--vp-gray-50)', borderRadius: 6, padding: 12 }}>
            <label className="up-eyebrow muted">Nome do embarque (destaque)</label>
            <input className="input" style={{ fontSize: 16, fontWeight: 700 }} value={form.nome_embarque} onChange={(e) => set('nome_embarque')(e.target.value)} placeholder="Ex: Embarque China - Equipamentos Elétricos"/>
          </div>
          <PIField label="Status da etapa"><PISelect value={form.status_etapa} onChange={set('status_etapa')} options={EI_STATUS}/></PIField>
          {isEdit ? <EIPIsVinculadas pis={pis}/> : <p className="small muted">Salve o embarque para poder vincular P.I. a ele (pela tela de P.I.).</p>}
        </div>
      )}

      {tab === 'pagamentos' && <div style={{ marginTop: 14 }}><EIPagamentos pis={pis}/></div>}

      {tab === 'embarque' && (
        <div className="stack" style={{ gap: 16, marginTop: 14 }}>
          <div className="grid-3" style={{ gap: 10 }}>
            <PIField label="Ref. embarque"><PIInput value={form.referencia_embarque} onChange={set('referencia_embarque')}/></PIField>
            <PIField label="Porto de origem"><PIInput value={form.porto_origem} onChange={set('porto_origem')}/></PIField>
            <PIField label="Porto de destino"><PIInput value={form.porto_destino} onChange={set('porto_destino')}/></PIField>
            <PIField label="Navio"><PIInput value={form.navio} onChange={set('navio')}/></PIField>
            <PIField label="AWB/BL"><PIInput value={form.awb_bl} onChange={set('awb_bl')}/></PIField>
            <PIField label="Redestinação"><PIInput value={form.redestinacao} onChange={set('redestinacao')}/></PIField>
            <PIField label="Data pedido redestinação"><PIInput type="date" value={form.data_pedido_redestinacao} onChange={set('data_pedido_redestinacao')}/></PIField>
          </div>
          <EIRolagens form={form} set={set}/>
          <EIContainers containers={form.containers} onChange={set('containers')}/>
        </div>
      )}

      {tab === 'frete' && (
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <div className="grid-3" style={{ gap: 10 }}>
            <PIField label="Tipo de frete"><PISelect value={form.tipo_frete} onChange={set('tipo_frete')} options={EI_TIPOS_FRETE}/></PIField>
            <PIField label="Modalidade"><PISelect value={form.modalidade_frete} onChange={set('modalidade_frete')} options={EI_MODALIDADES}/></PIField>
            <PIField label="Cotação frete"><PIInput type="number" value={form.cotacao_frete} onChange={set('cotacao_frete')}/></PIField>
            <PIField label="Moeda frete"><PISelect value={form.moeda_frete} onChange={set('moeda_frete')} options={['USD', 'EUR', 'BRL', 'CNY', 'GBP']}/></PIField>
            <PIField label="Transit time (dias)"><PIInput type="number" value={form.transit_time} onChange={set('transit_time')}/></PIField>
            <PIField label="Free time (dias)"><PIInput type="number" value={form.free_time} onChange={set('free_time')}/></PIField>
            <PIField label="Pedido de booking"><PIInput type="date" value={form.pedido_booking} onChange={set('pedido_booking')}/></PIField>
            <PIField label="Aprovação do frete"><PISelect value={form.aprovacao_frete} onChange={set('aprovacao_frete')} options={['Pendente', 'Aprovado', 'Reprovado']}/></PIField>
          </div>
          <PIField label="Agente de carga / freight forwarder">
            <PIInput value={form.agente_carga} onChange={set('agente_carga')} list="dl-agentes-carga-emb"/>
            <CadFornecedorDatalist id="dl-agentes-carga-emb" categoria="Agente de Carga"/>
          </PIField>
          <p className="small muted">Comparativo de cotações de frete entre agentes fica para uma fase seguinte — aqui o agente vencedor é registrado diretamente.</p>
        </div>
      )}

      {tab === 'desembaraco' && (
        <div className="grid-3" style={{ gap: 10, marginTop: 14 }}>
          <PIField label="Ref. despachante"><PIInput value={form.referencia_despachante} onChange={set('referencia_despachante')}/></PIField>
          <PIField label="Custos/estimativa (R$)"><PIInput type="number" value={form.custos_estimativa} onChange={set('custos_estimativa')}/></PIField>
          <PIField label="Docs Marimex"><PIInput value={form.documentos_marimex} onChange={set('documentos_marimex')}/></PIField>
          <PIField label="TT total (dias)"><PIInput type="number" value={form.transit_time_total} onChange={set('transit_time_total')}/></PIField>
          <PIField label="DUIMP"><PIInput value={form.di} onChange={set('di')}/></PIField>
          <PIField label="Data registro DUIMP"><PIInput type="date" value={form.data_registro_di} onChange={set('data_registro_di')}/></PIField>
          <PIField label="Canal parametrização"><PISelect value={form.canal_parametrizacao} onChange={set('canal_parametrizacao')} options={EI_CANAIS}/></PIField>
          <PIField label="Última data free time"><PIInput type="date" value={form.ultima_data_free_time} onChange={set('ultima_data_free_time')}/></PIField>
          <PIField label="ETA Santos"><PIInput type="date" value={form.eta_santos} onChange={set('eta_santos')}/></PIField>
        </div>
      )}

      {tab === 'faturamento' && (
        <div className="stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="grid-3" style={{ gap: 10 }}>
            <PIField label="Empresa de desembaraço">
              <PIInput value={form.empresa_desembaraco} onChange={set('empresa_desembaraco')} list="dl-desembaraco-emb"/>
              <CadFornecedorDatalist id="dl-desembaraco-emb"/>
            </PIField>
            <PIField label="Valor do faturamento (R$)"><PIInput type="number" value={form.faturamento_desembaraco} onChange={set('faturamento_desembaraco')}/></PIField>
            <PIField label="Valor do numerário (R$)"><PIInput type="number" value={form.numerario_desembaraco} onChange={set('numerario_desembaraco')}/></PIField>
            <PIField label="Valor do reembolso (R$)"><PIInput type="number" value={form.valor_reembolso} onChange={set('valor_reembolso')}/></PIField>
            <PIField label="Status do reembolso"><PISelect value={form.status_reembolso} onChange={set('status_reembolso')} options={EI_STATUS_REEMBOLSO}/></PIField>
            <PIField label="Data solicitação reembolso"><PIInput type="date" value={form.data_solicitacao_reembolso} onChange={set('data_solicitacao_reembolso')}/></PIField>
            <PIField label="Data recebimento reembolso"><PIInput type="date" value={form.data_recebimento_reembolso} onChange={set('data_recebimento_reembolso')}/></PIField>
          </div>
          <div>
            <label className="up-eyebrow muted">Observações financeiras</label>
            <textarea className="input" rows={3} value={form.observacoes_financeiras} onChange={(e) => set('observacoes_financeiras')(e.target.value)}/>
          </div>
        </div>
      )}

      {tab === 'entrega' && (
        <div className="stack" style={{ gap: 16, marginTop: 14 }}>
          <div className="grid-3" style={{ gap: 10 }}>
            <PIField label="Data limite entrega"><PIInput type="date" value={form.data_limite_entrega} onChange={set('data_limite_entrega')}/></PIField>
            <PIField label="Local de entrega"><PIInput value={form.local_entrega} onChange={set('local_entrega')}/></PIField>
            <PIField label="Data carregamento"><PIInput type="date" value={form.data_carregamento} onChange={set('data_carregamento')}/></PIField>
            <PIField label="Data entrega"><PIInput type="date" value={form.data_entrega} onChange={set('data_entrega')}/></PIField>
            <PIField label="Devolução container"><PIInput type="date" value={form.devolucao_container} onChange={set('devolucao_container')}/></PIField>
          </div>
          <EINFes nfes={form.nfes} onChange={set('nfes')}/>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="up-eyebrow muted">Observações gerais</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes')(e.target.value)}/>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={() => onSubmit(form)} disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Cadastrar embarque')}</Button>
      </div>
    </Card>
  );
}

/* ---------- Card da lista ---------- */
function EICard({ e, pis, onEdit, onDelete, onArchive }) {
  const store = window.EmbarquesImportacaoStore;
  const resumo = store.resumoPIs(pis);
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
      <div className="row sb" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          {e.nome_embarque && <div style={{ fontWeight: 800, fontSize: 15 }}>{e.nome_embarque}</div>}
          <div className="row gap-2" style={{ flexWrap: 'wrap', margin: '4px 0' }}>
            <span className="small">PI: {resumo.piNumbers.length ? resumo.piNumbers.join(', ') : '—'}</span>
            <StatusBadge status={e.status_etapa}/>
            {e.aprovacao_frete && <span className="badge">Frete: {e.aprovacao_frete}</span>}
            {e.arquivado && <span className="badge">Arquivado</span>}
          </div>
          <div className="cell-sub mono">
            Fornecedor: {resumo.fornecedores.join(', ') || '—'} · ETD: {eiFmtDate(e.etd_atual || e.etd_original)}{e.houve_rolagem ? ' (rolado)' : ''} · ETA: {eiFmtDate(e.eta_santos)}
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--vp-success, #0a7)', fontWeight: 700 }}>{eiFmtMoeda(resumo.valorTotal || e.valor_total, resumo.moeda || e.moeda_valor_total)}</span>
            {resumo.incoterms.length > 0 && <span className="muted"> · {resumo.incoterms.join(', ')}</span>}
            {(e.containers || []).length > 0 && <span className="muted"> · {e.containers.length} container(es)</span>}
          </div>
        </div>
        <div className="row gap-1">
          <Button variant="ghost" size="sm" icon="edit" title="Editar" onClick={onEdit}/>
          {e.status_etapa === 'Concluído' && <Button variant="ghost" size="sm" icon="archive" title={e.arquivado ? 'Desarquivar' : 'Arquivar'} onClick={() => onArchive(!e.arquivado)}/>}
          <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={onDelete}/>
        </div>
      </div>
    </div>
  );
}

/* ---------- Página ---------- */
function EmbarquesImportacaoPage() {
  const [items, setItems] = React.useState(null);
  const [pisByEmbarque, setPisByEmbarque] = React.useState({});
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('Todos');
  const [showArchived, setShowArchived] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const store = window.EmbarquesImportacaoStore;

  const reload = React.useCallback(async () => {
    const embs = await store.listarTodas().catch(() => []);
    setItems(embs);
    const pairs = await Promise.all(embs.map(async (e) => [e.id, await store.listarPIsVinculadas(e.id)]));
    setPisByEmbarque(Object.fromEntries(pairs));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const salvar = async (form) => {
    setSaving(true);
    try {
      const pis = editing ? (pisByEmbarque[editing.id] || []) : [];
      if (editing) await store.atualizar(editing.id, form, pis);
      else await store.criar(form, pis);
      window.toast?.(editing ? 'Embarque atualizado.' : 'Embarque criado.', 'success');
      setShowForm(false); setEditing(null); reload();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excluir = async (e) => {
    if (!window.confirm(`Excluir o embarque "${e.nome_embarque || e.referencia_embarque || 'sem nome'}"? Esta ação não pode ser desfeita.`)) return;
    try { await store.remover(e.id); window.toast?.('Embarque excluído.', 'success'); reload(); }
    catch (err) { window.toast?.('Erro: ' + err.message, 'error'); }
  };

  const arquivar = async (e, arquivado) => {
    try { await store.arquivar(e.id, arquivado); reload(); }
    catch (err) { window.toast?.('Erro: ' + err.message, 'error'); }
  };

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const filtered = items.filter((e) => {
    if (!showArchived && e.arquivado) return false;
    const pis = pisByEmbarque[e.id] || [];
    const resumo = store.resumoPIs(pis);
    const q = search.toLowerCase();
    const matchSearch = !q || (e.nome_embarque || '').toLowerCase().includes(q) || (e.referencia_embarque || '').toLowerCase().includes(q)
      || resumo.piNumbers.join(' ').toLowerCase().includes(q) || resumo.fornecedores.join(' ').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Todos' || e.status_etapa === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Jurídico · Importação · Gestão Importação</div>
          <h1 className="page-head__title">Embarques</h1>
          <p className="page-head__sub">Controle de processos de importação — identificação, logística, aduaneiro, faturamento e entrega.</p>
        </div>
        <div className="page-head__r">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setShowForm(true); }}>Novo embarque</Button>
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <EmbarqueImportacaoForm initialData={editing} isEdit={!!editing} pis={editing ? (pisByEmbarque[editing.id] || []) : []} saving={saving}
            onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }}/>
        </div>
      )}

      <div className="row gap-2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por PI, fornecedor, referência ou nome…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select className="input" style={{ width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {EI_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button variant={showArchived ? 'primary' : 'outline'} size="sm" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}</Button>
      </div>

      <div className="small muted" style={{ marginBottom: 10 }}>{filtered.length} embarque(s) encontrado(s)</div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>Nenhum embarque encontrado.</div>
      )}

      <div className="stack" style={{ gap: 10 }}>
        {filtered.map((e) => (
          <EICard key={e.id} e={e} pis={pisByEmbarque[e.id] || []} onEdit={() => { setEditing(e); setShowForm(true); }} onDelete={() => excluir(e)} onArchive={(v) => arquivar(e, v)}/>
        ))}
      </div>
    </div>
  );
}

window.EmbarquesImportacaoPage = EmbarquesImportacaoPage;
