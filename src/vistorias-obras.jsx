/* ============================================================
   vistorias-obras.jsx
   Módulo: Vistorias de Obras — fonte única de verdade pra vistoria
   Descrição: Gerenciamento completo de vistorias com agendamento,
   documentação (PDF), imagens e rastreamento de vistoriadores

   Consolidação (15/08): esta era uma de 3 implementações de vistoria
   que existiam em paralelo sem se falar (achado documentado no
   FluxogramaPortal.md). Escolhida como oficial por ser a mais completa;
   as outras duas (vistoria-tracker.js em operacoes.jsx, e o mini-plano
   que existia dentro de instalacao-obra-store.js) foram aposentadas.
   `obra_id` aqui é sempre `dossier_obra.id` — a entidade central da obra.

   Antes, `obraId` só chegava via prop vinda de outra tela; entrando pelo
   menu lateral direto, obraId nunca era passado e a tela ficava sempre
   vazia sem nenhum jeito de escolher a obra. Agora, sem obraId, mostra
   um seletor de obras (dossier_obra) antes de carregar qualquer coisa.

   `embedded`: quando true, esconde o cabeçalho de página grande — usado
   pela aba Instalação do Dossiê da Obra, que já tem seu próprio título.

   Renomeado (01/09) pra "Resultado Vistorias de Obras" na sidebar/rota
   `vistorias` — continua sendo o CRUD/histórico real de vistorias
   (agendar, concluir, anexar). O rótulo "Vistorias de Obras" (rota nova
   `vistorias-envio`, ver src/vistorias-envio.jsx) fica reservado pra a
   futura solução de disparo de vistoria pro celular do técnico; quando
   essa solução existir, o fluxo deve ser: vistorias-envio dispara →
   técnico executa no celular → resultado cai aqui.
   ============================================================ */

function VistoriasObras({ obraId: obraIdProp, obra: obraProp, setRoute, embedded, onChanged }) {
  const [obraId, setObraId] = React.useState(obraIdProp || null);
  const [obra, setObra] = React.useState(obraProp || null);
  const [obras, setObras] = React.useState([]);
  const [equipPorObra, setEquipPorObra] = React.useState({}); // dossier_id -> [numero_serie,...]
  const [loadingObras, setLoadingObras] = React.useState(!obraIdProp);
  const [buscaObra, setBuscaObra] = React.useState('');
  const [clienteAberto, setClienteAberto] = React.useState(null);
  const [vistorias, setVistorias] = React.useState([]);
  const [selectedVistoria, setSelectedVistoria] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState('todas');

  // Form state
  const [form, setForm] = React.useState({
    data_agendada: '',
    vistoriador: '',
    tipo: 'vistoria',
    numero_fase: '',
    custo: '',
    observacoes: '',
    documentos: [],
    imagens: [],
  });

  // Sem obraId vindo de fora: carrega a lista de obras (dossier_obra) pra escolher
  React.useEffect(() => {
    if (obraIdProp) return;
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    setLoadingObras(true);
    Promise.all([
      sb.from('dossier_obra').select('id, building_name, client_name').order('created_at', { ascending: false }),
      sb.from('equipamentos_obra').select('dossier_id, numero_serie'),
    ])
      .then(([{ data, error }, eqRes]) => {
        if (error) { console.error('Erro ao carregar obras:', error); window.toast?.('Erro ao carregar obras', 'error'); }
        setObras(data || []);
        const map = {};
        (eqRes.data || []).forEach((e) => {
          if (!e.numero_serie) return;
          (map[e.dossier_id] = map[e.dossier_id] || []).push(e.numero_serie);
        });
        setEquipPorObra(map);
        setLoadingObras(false);
      });
  }, [obraIdProp]);

  // Load vistorias
  React.useEffect(() => {
    if (!obraId) return;
    loadVistorias();
  }, [obraId]);

  const loadVistorias = async () => {
    try {
      setLoading(true);
      const sb = window.__VP_SB?.sb;
      if (!sb) return;

      const { data, error } = await sb
        .from('vistorias_obras')
        .select('*')
        .eq('obra_id', obraId)
        .order('data_agendada', { ascending: false });

      if (error) throw error;
      setVistorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar vistorias:', error);
      window.toast?.('Erro ao carregar vistorias', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVistoria = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      if (!form.data_agendada || !form.vistoriador) {
        window.toast?.('Preencha todos os campos obrigatórios', 'warning');
        return;
      }

      const sb = window.__VP_SB?.sb;
      if (!sb) return;

      const vistoriaData = {
        obra_id: obraId,
        data_agendada: form.data_agendada,
        vistoriador: form.vistoriador,
        tipo: form.tipo,
        numero_fase: form.numero_fase ? Number(form.numero_fase) : null,
        custo: form.custo !== '' ? Number(form.custo) : null,
        status: 'agendada',
        observacoes: form.observacoes,
        documentos: form.documentos,
        imagens: form.imagens,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };

      const { error } = await sb
        .from('vistorias_obras')
        .insert([vistoriaData]);

      if (error) throw error;

      if (window.EventosFluxo) {
        const { data: dossier } = await sb.from('dossier_obra').select('numero_cotacao, building_name').eq('id', obraId).maybeSingle();
        window.EventosFluxo.registrar({
          evento: 'VISTORIA_AGENDADA', numeroCotacao: dossier?.numero_cotacao ?? null,
          alvoLabel: dossier?.building_name, alvoId: obraId,
        });
      }

      window.toast?.('Vistoria agendada com sucesso! 📋', 'success');
      setForm({
        data_agendada: '',
        vistoriador: '',
        tipo: 'vistoria',
        numero_fase: '',
        custo: '',
        observacoes: '',
        documentos: [],
        imagens: [],
      });
      setShowForm(false);
      await loadVistorias();
      onChanged && onChanged();
    } catch (error) {
      console.error('Erro ao agendar vistoria:', error);
      window.toast?.('Erro ao agendar vistoria', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files || []);
    const maxFiles = type === 'imagens' ? 10 : 5;

    if (files.length + form[type].length > maxFiles) {
      window.toast?.(
        `Máximo de ${maxFiles} ${type === 'imagens' ? 'imagens' : 'documentos'} permitidos`,
        'warning'
      );
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result;
        setForm((prev) => ({
          ...prev,
          [type]: [
            ...prev[type],
            { nome: file.name, tipo: file.type, tamanho: file.size, dados: base64 },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (type, index) => {
    setForm((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const handleCompleteVistoria = async (vistoriaId) => {
    try {
      const sb = window.__VP_SB?.sb;
      if (!sb) return;

      const { data: v, error } = await sb
        .from('vistorias_obras')
        .update({ status: 'concluida', atualizado_em: new Date().toISOString() })
        .eq('id', vistoriaId).select().single();

      if (error) throw error;

      if (window.EventosFluxo && v?.obra_id) {
        const { data: dossier } = await sb.from('dossier_obra').select('numero_cotacao, building_name').eq('id', v.obra_id).maybeSingle();
        window.EventosFluxo.registrar({
          evento: 'VISTORIA_REALIZADA', numeroCotacao: dossier?.numero_cotacao ?? null,
          alvoLabel: dossier?.building_name, alvoId: v.obra_id,
        });
      }

      window.toast?.('Vistoria marcada como concluída! ✅', 'success');
      await loadVistorias();
      onChanged && onChanged();
      setSelectedVistoria(null);
    } catch (error) {
      console.error('Erro ao completar vistoria:', error);
      window.toast?.('Erro ao atualizar vistoria', 'error');
    }
  };

  const handleDeleteVistoria = async (vistoriaId) => {
    if (!confirm('Tem certeza que deseja deletar esta vistoria?')) return;

    try {
      const sb = window.__VP_SB?.sb;
      if (!sb) return;

      const { error } = await sb
        .from('vistorias_obras')
        .delete()
        .eq('id', vistoriaId);

      if (error) throw error;
      window.toast?.('Vistoria deletada com sucesso', 'success');
      await loadVistorias();
      onChanged && onChanged();
      setSelectedVistoria(null);
    } catch (error) {
      console.error('Erro ao deletar vistoria:', error);
      window.toast?.('Erro ao deletar vistoria', 'error');
    }
  };

  // Filtrar vistorias
  const vistoriasFiltered =
    filterStatus === 'todas'
      ? vistorias
      : vistorias.filter((v) => v.status === filterStatus);

  // Stats
  const stats = {
    total: vistorias.length,
    agendadas: vistorias.filter((v) => v.status === 'agendada').length,
    concluidas: vistorias.filter((v) => v.status === 'concluida').length,
    canceladas: vistorias.filter((v) => v.status === 'cancelada').length,
  };

  const formatData = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatDataHora = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      agendada: { label: '📅 Agendada', color: '#0066ff' },
      em_progresso: { label: '⏳ Em Progresso', color: '#ff9900' },
      concluida: { label: '✅ Concluída', color: '#00aa00' },
      cancelada: { label: '❌ Cancelada', color: '#cc0000' },
    };
    const config = statusConfig[status] || { label: status, color: '#666' };
    return <span style={{ color: config.color, fontWeight: 'bold' }}>{config.label}</span>;
  };

  // Progresso das 3 fases inclusas no contrato (avulsas não contam pra liberar a obra)
  const fasesInclusas = [1, 2, 3].map((n) => ({
    numero: n,
    concluida: vistorias.some((v) => v.numero_fase === n && v.status === 'concluida'),
  }));
  const obraLiberada = fasesInclusas.every((f) => f.concluida);

  // Sem obraId (nem vindo por prop, nem escolhido ainda): mostra o seletor de obras
  if (!obraId) {
    return (
      <div className="vistorias-obras">
        {!embedded && (
          <div className="page-header" style={{ marginBottom: '2rem' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🏗️ Resultado Vistorias de Obras</h1>
              <p style={{ color: 'var(--vp-gray-500)', fontSize: '0.95rem' }}>Escolha a obra pra ver e registrar as vistorias.</p>
            </div>
          </div>
        )}
        {loadingObras ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ Carregando obras...</div>
        ) : obras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', background: '#f8f9fa', borderRadius: '8px', color: '#666' }}>
            <p>Nenhuma obra cadastrada ainda (Dossiê da Obra).</p>
          </div>
        ) : (
          <SeletorObrasPorCliente
            obras={obras}
            equipPorObra={equipPorObra}
            busca={buscaObra}
            setBusca={setBuscaObra}
            clienteAberto={clienteAberto}
            setClienteAberto={setClienteAberto}
            onEscolher={(o) => { setObraId(o.id); setObra({ nome: o.building_name }); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="vistorias-obras">
      {/* HEADER */}
      {!embedded && (
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
              🏗️ Resultado Vistorias de Obras
            </h1>
            {obra && (
              <p style={{ color: 'var(--vp-gray-500)', fontSize: '0.95rem' }}>
                Obra: <strong>{obra.nome || 'Sem nome'}</strong>
                {obra.endereco && ` • ${obra.endereco}`}
              </p>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ height: '2.5rem', whiteSpace: 'nowrap' }}>
            {showForm ? '✕ Cancelar' : '+ Agendar Vistoria'}
          </button>
        </div>
      )}
      {embedded && (
        <div className="row sb" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--fg3)' }}>3 fases inclusas no contrato · vistorias avulsas cobradas à parte</div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            {showForm ? '✕ Cancelar' : '+ Agendar Vistoria'}
          </button>
        </div>
      )}

      {/* PROGRESSO DAS 3 FASES INCLUSAS */}
      <div style={{
        background: obraLiberada ? '#f0fdf4' : '#f8f9fa',
        border: '1px solid ' + (obraLiberada ? '#86efac' : '#e0e0e0'),
        borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
      }}>
        <div className="row sb" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: obraLiberada ? '#166534' : 'inherit' }}>
            {obraLiberada ? '✅ Obra vistoriada e liberada (3 fases concluídas)' : 'Progresso das vistorias inclusas'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {fasesInclusas.map((f) => (
            <div key={f.numero} style={{
              flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: 6,
              background: f.concluida ? '#dcfce7' : '#fff',
              border: '1px solid ' + (f.concluida ? '#10b981' : '#ddd'),
              fontSize: '0.85rem', fontWeight: 600,
            }}>
              {f.concluida ? '✅' : '○'} Fase {f.numero}
            </div>
          ))}
        </div>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Vistorias Totais</div>
        </div>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.agendadas}</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Agendadas</div>
        </div>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.concluidas}</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Concluídas</div>
        </div>
      </div>

      {/* FORM AGENDAR VISTORIA */}
      {showForm && (
        <div style={{
          background: '#f8f9fa',
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #e0e0e0',
          marginBottom: '2rem',
        }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>📋 Agendar Nova Vistoria</h3>
          <form onSubmit={handleAddVistoria}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Data */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Data & Hora da Vistoria *
                </label>
                <input
                  type="datetime-local"
                  value={form.data_agendada}
                  onChange={(e) => setForm({ ...form, data_agendada: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                  }}
                  required
                />
              </div>

              {/* Vistoriador */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Vistoriador *
                </label>
                <input
                  type="text"
                  placeholder="Nome do vistoriador"
                  value={form.vistoriador}
                  onChange={(e) => setForm({ ...form, vistoriador: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                  }}
                  required
                />
              </div>

              {/* Tipo de Vistoria */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Tipo de Vistoria
                </label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                  }}>
                  <option value="vistoria">Vistoria</option>
                  <option value="pre_obra">Pré-Obra</option>
                  <option value="insercao">Inserção</option>
                  <option value="pos_venda">Pós-Venda</option>
                </select>
              </div>

              {/* Fase (3 inclusas no contrato + avulsa) */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Fase
                </label>
                <select
                  value={form.numero_fase}
                  onChange={(e) => setForm({ ...form, numero_fase: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem' }}>
                  <option value="">Avulsa (cobrada à parte)</option>
                  <option value="1">Fase 1 (inclusa)</option>
                  <option value="2">Fase 2 (inclusa)</option>
                  <option value="3">Fase 3 (inclusa)</option>
                </select>
              </div>

              {/* Custo */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Custo (R$)
                </label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={form.custo}
                  onChange={(e) => setForm({ ...form, custo: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Observações */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Observações
              </label>
              <textarea
                placeholder="Observações adicionais sobre a vistoria..."
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '100px',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Upload Documentos */}
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #ddd' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                📄 Documentos (PDF, máx. 5 arquivos)
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload(e, 'documentos')}
                style={{ marginBottom: '0.75rem' }}
              />
              {form.documentos.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {form.documentos.map((doc, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                      }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        📎 {doc.nome} ({(doc.tamanho / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('documentos', idx)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#ff6b6b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Imagens */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                🖼️ Imagens (máx. 10 imagens)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'imagens')}
                style={{ marginBottom: '0.75rem' }}
              />
              {form.imagens.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '0.75rem',
                  marginTop: '1rem',
                }}>
                  {form.imagens.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        aspectRatio: '1',
                        border: '2px solid #e0e0e0',
                      }}>
                      <img
                        src={img.dados}
                        alt={`preview-${idx}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('imagens', idx)}
                        style={{
                          position: 'absolute',
                          top: '0.25rem',
                          right: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: '#ff6b6b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                        }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}>
                {loading ? '⏳ Agendando...' : '✓ Agendar Vistoria'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#e0e0e0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTROS */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {['todas', 'agendada', 'em_progresso', 'concluida', 'cancelada'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '0.5rem 1rem',
              background: filterStatus === status ? 'var(--vp-primary)' : '#f0f0f0',
              color: filterStatus === status ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: filterStatus === status ? 'bold' : 'normal',
            }}>
            {status === 'todas' ? '📋 Todas' : status === 'agendada' ? '📅 Agendadas' : status === 'em_progresso' ? '⏳ Em Progresso' : status === 'concluida' ? '✅ Concluídas' : '❌ Canceladas'}
          </button>
        ))}
      </div>

      {/* LISTA DE VISTORIAS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ Carregando vistorias...</div>
      ) : vistoriasFiltered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          color: '#666',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
          <p>Nenhuma vistoria encontrada</p>
          {filterStatus !== 'todas' && (
            <button
              onClick={() => setFilterStatus('todas')}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'var(--vp-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}>
              Ver Todas as Vistorias
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1rem',
        }}>
          {vistoriasFiltered.slice(0, 10).map((vistoria, idx) => (
            <div
              key={vistoria.id || idx}
              style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedVistoria(vistoria)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
              {/* Status Badge */}
              <div style={{ marginBottom: '1rem' }}>
                {getStatusBadge(vistoria.status)}
              </div>

              {/* Info Principal */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem' }}>
                  {vistoria.tipo?.toUpperCase() || 'VISTORIA'}
                  {vistoria.numero_fase ? ` · Fase ${vistoria.numero_fase}` : ' · Avulsa'}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                  📅 {formatData(vistoria.data_agendada)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: vistoria.custo != null ? '0.5rem' : 0 }}>
                  👤 {vistoria.vistoriador}
                </div>
                {vistoria.custo != null && (
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    💰 {Number(vistoria.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                )}
              </div>

              {/* Observações */}
              {vistoria.observacoes && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  background: '#f8f9fa',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  maxHeight: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {vistoria.observacoes}
                </div>
              )}

              {/* Arquivos */}
              {(vistoria.documentos?.length > 0 || vistoria.imagens?.length > 0) && (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: '#666',
                  marginBottom: '1rem',
                }}>
                  {vistoria.documentos?.length > 0 && (
                    <span>📄 {vistoria.documentos.length} doc(s)</span>
                  )}
                  {vistoria.imagens?.length > 0 && (
                    <span>🖼️ {vistoria.imagens.length} img(s)</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderTop: '1px solid #eee',
                paddingTop: '1rem',
              }}>
                {vistoria.status === 'agendada' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompleteVistoria(vistoria.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#00aa00',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}>
                    ✓ Concluir
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVistoria(vistoria.id);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}>
                  🗑️ Deletar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALHES */}
      {selectedVistoria && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedVistoria(null)}>
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Detalhes da Vistoria</h2>
              <button
                onClick={() => setSelectedVistoria(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666',
                }}>
                ✕
              </button>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <strong>Status:</strong> {getStatusBadge(selectedVistoria.status)}
            </div>

            {/* Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p>
                <strong>📅 Data:</strong> {formatDataHora(selectedVistoria.data_agendada)}
              </p>
              <p>
                <strong>👤 Vistoriador:</strong> {selectedVistoria.vistoriador}
              </p>
              <p>
                <strong>🏷️ Tipo:</strong> {selectedVistoria.tipo?.replace(/_/g, ' ').toUpperCase()}
              </p>
              {selectedVistoria.observacoes && (
                <p>
                  <strong>📝 Observações:</strong> {selectedVistoria.observacoes}
                </p>
              )}
            </div>

            {/* Documentos */}
            {selectedVistoria.documentos?.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>📄 Documentos</h4>
                {selectedVistoria.documentos.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      background: '#f8f9fa',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <span>📎 {doc.nome}</span>
                    <a
                      href={doc.dados}
                      download={doc.nome}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: 'var(--vp-primary)',
                        color: 'white',
                        borderRadius: '3px',
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                      }}>
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Imagens */}
            {selectedVistoria.imagens?.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>🖼️ Imagens</h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '0.75rem',
                }}>
                  {selectedVistoria.imagens.map((img, idx) => (
                    <a
                      key={idx}
                      href={img.dados}
                      download={img.nome}
                      style={{
                        borderRadius: '6px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}>
                      <img
                        src={img.dados}
                        alt={`img-${idx}`}
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                        }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              {selectedVistoria.status === 'agendada' && (
                <button
                  onClick={() => {
                    handleCompleteVistoria(selectedVistoria.id);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#00aa00',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}>
                  ✓ Marcar Concluída
                </button>
              )}
              <button
                onClick={() => {
                  handleDeleteVistoria(selectedVistoria.id);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}>
                🗑️ Deletar
              </button>
              <button
                onClick={() => setSelectedVistoria(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#e0e0e0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}>
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Seletor de obra agrupado por Cliente — lista indentada e recolhível,
   substitui a antiga grade de cards (um card gigante por obra, difícil
   de escanear quando o cliente tem várias obras/equipamentos). Clicar
   no cliente expande/recolhe as obras dele; clicar numa obra escolhe. */
function SeletorObrasPorCliente({ obras, equipPorObra, busca, setBusca, clienteAberto, setClienteAberto, onEscolher }) {
  const q = busca.trim().toLowerCase();
  const filtradas = !q ? obras : obras.filter((o) => {
    const seriais = (equipPorObra[o.id] || []).join(' ');
    return [o.client_name, o.building_name, seriais].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const porCliente = {};
  filtradas.forEach((o) => {
    const cliente = o.client_name || 'Sem cliente';
    (porCliente[cliente] = porCliente[cliente] || []).push(o);
  });
  const clientes = Object.keys(porCliente).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Com busca ativa, ou só 1 cliente no total, abre tudo sozinho pra não esconder resultado
  const forcarAberto = !!q || clientes.length <= 1;

  return (
    <div>
      <input
        className="input"
        placeholder="Buscar por cliente, obra ou nº de série…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem', marginBottom: '1rem' }}
      />
      {clientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Nenhuma obra encontrada.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {clientes.map((cliente) => {
            const lista = porCliente[cliente];
            const aberto = forcarAberto || clienteAberto === cliente;
            return (
              <div key={cliente} style={{ border: '1px solid #e0e0e0', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
                <div
                  onClick={() => setClienteAberto(clienteAberto === cliente ? null : cliente)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem', userSelect: 'none',
                  }}>
                  <span style={{ display: 'inline-block', transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                  🏢 {cliente}
                  <span style={{ fontWeight: 400, color: '#888', fontSize: '0.82rem' }}>({lista.length})</span>
                </div>
                {aberto && (
                  <div style={{ padding: '0 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {lista.map((o) => {
                      const seriais = equipPorObra[o.id] || [];
                      return (
                        <div key={o.id}
                          onClick={() => onEscolher(o)}
                          style={{
                            marginLeft: '1.5rem', padding: '0.6rem 0.85rem', borderRadius: 6,
                            border: '1px solid #eee', cursor: 'pointer', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center', gap: 8,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f9fa'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{o.building_name || 'Obra sem nome'}</div>
                            {seriais.length > 0 && (
                              <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
                                🔧 {seriais.join(', ')}
                              </div>
                            )}
                          </div>
                          <span style={{ color: '#aaa', fontSize: '0.85rem' }}>›</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}