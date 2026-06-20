/* ============================================================
   vistorias-obras.jsx
   Módulo: Vistorias de Obras
   Descrição: Gerenciamento completo de vistorias com agendamento,
   documentação (PDF), imagens e rastreamento de vistoriadores
   ============================================================ */

function VistoriasObras({ obraId, obra, setRoute }) {
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
    observacoes: '',
    documentos: [],
    imagens: [],
  });

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

      window.toast?.('Vistoria agendada com sucesso! 📋', 'success');
      setForm({
        data_agendada: '',
        vistoriador: '',
        tipo: 'vistoria',
        observacoes: '',
        documentos: [],
        imagens: [],
      });
      setShowForm(false);
      await loadVistorias();
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

      const { error } = await sb
        .from('vistorias_obras')
        .update({ status: 'concluida', atualizado_em: new Date().toISOString() })
        .eq('id', vistoriaId);

      if (error) throw error;
      window.toast?.('Vistoria marcada como concluída! ✅', 'success');
      await loadVistorias();
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

  return (
    <div className="vistorias-obras">
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
            🏗️ Vistorias de Obras
          </h1>
          {obra && (
            <p style={{ color: 'var(--vp-gray-500)', fontSize: '0.95rem' }}>
              Projeto: <strong>{obra.nome || 'Sem nome'}</strong>
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
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                  📅 {formatData(vistoria.data_agendada)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  👤 {vistoria.vistoriador}
                </div>
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
