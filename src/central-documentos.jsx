/* ============================================================
   central-documentos.jsx — Central de Documentos (Biblioteca Virtual)
   Fase 1: leitura agregada por obra — Vistoria, Documentos da Obra
   (ART/DataBook/Termo…) e Documentação do Montador (RH). Sem pipeline
   de envio ainda (Fase 2): essa tela não escreve nada, só consolida.
   ============================================================ */
(function () {
  'use strict';

  const STATUS_META = {
    disponivel: { label: 'Disponível', color: '#00aa00', mark: '✓' },
    pendente:   { label: 'Pendente',   color: '#cc7700', mark: '○' },
    na:         { label: '—',          color: '#999',    mark: '–' },
  };

  function StatusBadge({ status }) {
    const m = STATUS_META[status] || STATUS_META.na;
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: m.color, border: `1px solid ${m.color}`,
        borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
        {m.mark} {m.label}
      </span>
    );
  }

  function Secao({ titulo, subtitulo, children }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#333', marginBottom: 2 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{subtitulo}</div>}
        {children}
      </div>
    );
  }

  const rowBox = { border: '1px solid #ddd', borderRadius: 6, padding: '10px 14px', marginBottom: 8,
    display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' };

  function LinhaDocumento({ label, sub, status, link }) {
    return (
      <div style={rowBox}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#0066cc', fontWeight: 600 }}>⬇ Ver</a>}
          <StatusBadge status={status} />
        </div>
      </div>
    );
  }

  function CentralDocumentosPage({ setRoute, setSubsel, subsel }) {
    const [obras, setObras] = React.useState([]);
    const obraId = subsel || '';
    const setObraId = (clientName) => { setSubsel && setSubsel(clientName || null); };
    const [checklist, setChecklist] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [busca, setBusca] = React.useState('');

    React.useEffect(() => {
      window.CentralDocumentos.listarObras().then(setObras);
    }, []);

    React.useEffect(() => {
      if (!obraId) { setChecklist(null); return; }
      const obra = obras.find((o) => o.client_name === obraId);
      if (!obra) return;
      setLoading(true);
      window.CentralDocumentos.carregarChecklistObra(obra.dossierIds, obra.parceiroInstaladorIds)
        .then(setChecklist)
        .finally(() => setLoading(false));
    }, [obraId, obras]);

    const irParaDossier = (obra) => {
      if (!obra) return;
      setSubsel && setSubsel(obra.equipamentos[0]?.id);
      setRoute && setRoute('dossier-obra');
    };
    const irParaHomologacao = () => { setRoute && setRoute('rh-homologacao'); };

    const obrasFiltradas = React.useMemo(() => {
      const q = busca.trim().toLowerCase();
      if (!q) return obras;
      return obras.filter((o) => (o.client_name || '').toLowerCase().includes(q)
        || o.equipamentos.some((e) => (e.building_name || '').toLowerCase().includes(q)
          || String(e.numero_cotacao || '').includes(q)));
    }, [obras, busca]);

    const obraSelecionada = obras.find((o) => o.client_name === obraId);

    return (
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        {/* Coluna esquerda — seletor de obras (a "estante" da biblioteca) */}
        <div style={{ width: 300, borderRight: '1px solid #e5e5e5', padding: 16, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📁 Central de Documentos</div>
          <input
            type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar obra (cliente)…"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {obrasFiltradas.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Nenhuma obra encontrada.</div>}
          {obrasFiltradas.map((o) => (
            <div key={o.client_name} onClick={() => setObraId(o.client_name)}
              style={{
                padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                background: o.client_name === obraId ? '#eaf2ff' : 'transparent',
                border: o.client_name === obraId ? '1px solid #0066cc' : '1px solid transparent',
              }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.client_name || '—'}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{o.equipamentos.length} equipamento{o.equipamentos.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>

        {/* Coluna direita — checklist matrix da obra selecionada */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!obraId && (
            <div style={{ color: '#999', fontSize: 13, marginTop: 40, textAlign: 'center' }}>
              Selecione uma obra à esquerda pra ver o checklist de documentos.
            </div>
          )}

          {obraId && loading && <div style={{ color: '#999', fontSize: 13 }}>Carregando…</div>}

          {obraId && !loading && checklist && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{obraSelecionada?.client_name}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {obraSelecionada?.equipamentos.length} equipamento{obraSelecionada?.equipamentos.length !== 1 ? 's' : ''}
                  {' · '}{obraSelecionada?.equipamentos.map((e) => e.building_name).join(', ')}
                </div>
              </div>

              <Secao titulo="Documentos da Obra" subtitulo="ART, Termo de Vistoria, DataBook, Termo de Entrega e demais — documentação da obra como um todo">
                <button type="button" onClick={() => irParaDossier(obraSelecionada)}
                  style={{ fontSize: 12, color: '#0066cc', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>
                  📎 Anexar ou atualizar no Dossiê da Obra →
                </button>
                {checklist.documentosObra.map((d) => (
                  <LinhaDocumento key={d.tipo}
                    label={d.label + (!d.obrigatorio ? ' · opcional' : '')}
                    sub={d.itens.length ? d.itens.map((i) => i.nome || d.label).join(', ') : (d.obrigatorio ? 'Pendente' : 'Não anexado')}
                    status={d.status}
                    link={d.itens[0]?.arquivo_url} />
                ))}
              </Secao>

              <Secao titulo="Documentação do Montador" subtitulo="Empresa instaladora vinculada e documentos de cada colaborador">
                {checklist.montador.length === 0 && (
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                    Nenhum instalador vinculado a esta obra ainda.{' '}
                    <button type="button" onClick={() => irParaDossier(obraSelecionada)}
                      style={{ fontSize: 12, color: '#0066cc', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Vincular no Dossiê da Obra →
                    </button>
                  </div>
                )}
                {checklist.montador.length > 0 && (
                  <button type="button" onClick={irParaHomologacao}
                    style={{ fontSize: 12, color: '#0066cc', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>
                    📎 Anexar ou atualizar em Homologação de Instaladores →
                  </button>
                )}
                {checklist.montador.map(({ empresa, colaboradores }) => (
                  <div key={empresa.id} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>🏢 {empresa.nome}</div>
                    {colaboradores.length === 0 && <div style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>Sem colaboradores cadastrados.</div>}
                    {colaboradores.map((c) => (
                      <div key={c.id} style={{ marginLeft: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>{c.nome_completo}</div>
                        {c.documentos.length === 0
                          ? <div style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>Nenhum documento cadastrado.</div>
                          : c.documentos.map((d) => (
                            <LinhaDocumento key={d.id}
                              label={d.parceiros_doc_catalogo?.nome || d.tipo || 'Documento'}
                              sub={d.data_vencimento ? `Vencimento: ${d.data_vencimento}` : null}
                              status={d.status} />
                          ))}
                      </div>
                    ))}
                  </div>
                ))}
              </Secao>

              <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, borderTop: '1px solid #eee', paddingTop: 10, lineHeight: 1.6 }}>
                Vistorias (Dados Coletados na Obra) são por equipamento — vão morar numa aba "Equipamentos" dentro desta mesma tela, ainda não implementada.<br/>
                Envio para cliente/construtora com rastreabilidade (checklist "Enviado" + log) é a próxima fase deste módulo — ainda não implementado.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  window.CentralDocumentosPage = CentralDocumentosPage;
})();
