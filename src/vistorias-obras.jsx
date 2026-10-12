/* ============================================================
   vistorias-obras.jsx
   Módulo: Vistorias de Obras — fonte única de verdade pra vistoria
   Descrição: Resultado das vistorias da obra — progresso das 3 inclusas e
   checklists digitais despachados (fonte: vistorias_atividades).
   O agendamento manual (tabela vistorias_obras, vazia e sem leitor) foi
   removido em 12/10/2026 (auditoria #843 A3): quem agenda é o Despachar.

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
  /* Bug real (varredura de URLs, 09/10): a rota "vistorias" não recebe
     `setSubsel` de app.jsx (só `obraId={subsel}`), então escolher uma obra
     no seletor (abaixo) nunca escrevia a URL — F5 ou compartilhar o link
     sempre voltava pro seletor de obras, mesmo depois de escolher uma.
     `obraIdProp` também só era lido uma vez no mount — Voltar/Avançar do
     navegador (ou um link de outra tela, ex. Gatilhos, que PASSA setSubsel)
     não trocava a obra aberta. Escreve/lê o 2º segmento direto
     (/engenharia/vistorias/<obraId>) sem depender de setSubsel; não mexe
     no modo `embedded` (usado dentro do Dossiê da Obra, sem rota própria). */
  React.useEffect(() => { setObraId(obraIdProp || null); }, [obraIdProp]);
  const escolherObra = (o) => {
    setObraId(o.id); setObra({ nome: o.building_name });
    if (!embedded && window.VpRouter) window.VpRouter.navigate('vistorias', o.id);
  };
  const [obras, setObras] = React.useState([]);
  const [equipPorObra, setEquipPorObra] = React.useState({}); // dossier_id -> [numero_serie,...]
  const [loadingObras, setLoadingObras] = React.useState(!obraIdProp);
  const [buscaObra, setBuscaObra] = React.useState('');
  const [clienteAberto, setClienteAberto] = React.useState(null);
  const [progressoReal, setProgressoReal] = React.useState({ fases: [1, 2, 3].map((n) => ({ numero: n, concluida: false })), liberada: false, concluidas: 0 });

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

  /* Progresso real (04/09) — trocado de `vistorias` (vistorias_obras,
     agendador manual obsoleto) pra window.InstalacaoObraStore, que agora
     lê `vistorias_atividades` (módulo real de campo). Ver comentário em
     instalacao-obra-store.js:obterProgressoVistoria. */
  React.useEffect(() => {
    if (!obraId || !window.InstalacaoObraStore) return;
    window.InstalacaoObraStore.obterProgressoVistoria(obraId).then(setProgressoReal).catch(() => {});
  }, [obraId]);

  // Progresso real (04/09): vem de vistorias_atividades via InstalacaoObraStore,
  // não mais do agendador manual vistorias_obras — ver efeito acima.
  const fasesInclusas = progressoReal.fases;
  const obraLiberada = progressoReal.liberada;

  // Sem obraId (nem vindo por prop, nem escolhido ainda): mostra o seletor de obras
  if (!obraId) {
    return (
      <div className="vistorias-obras">
        {!embedded && (
          <div className="page-header" style={{ marginBottom: '2rem' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🏗️ Resultado Vistorias de Obras</h1>
              <p style={{ color: 'var(--vp-gray-500)', fontSize: '0.95rem' }}>Escolha a obra pra ver o andamento das vistorias.</p>
            </div>
          </div>
        )}
        {loadingObras ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ Carregando obras...</div>
        ) : obras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--vp-gray-50)', borderRadius: '8px', color: 'var(--fg2)' }}>
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
            onEscolher={escolherObra}
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
        </div>
      )}
      {embedded && (
        <div className="row sb" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--fg3)' }}>3 vistorias inclusas no contrato · vistorias avulsas cobradas à parte · o que libera a obra são as vistorias concluídas em "Checklists digitais despachados"</div>
        </div>
      )}

      {/* PROGRESSO DAS 3 VISTORIAS INCLUSAS — 04/09: fonte real é
          vistorias_atividades (progressoReal), não mais o agendamento
          manual desta tela. Sem conceito de "fase" numerada na vistoria
          de campo, então cada quadro é só a Nª vistoria concluída. */}
      <div style={{
        background: obraLiberada ? 'var(--vp-success-tint)' : 'var(--vp-gray-50)',
        border: '1px solid ' + (obraLiberada ? 'var(--vp-success)' : 'var(--border)'),
        borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
      }}>
        <div className="row sb" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: obraLiberada ? 'var(--vp-success-ink)' : 'inherit' }}>
            {obraLiberada ? '✅ Obra vistoriada e liberada (3 vistorias concluídas)' : `Progresso das vistorias inclusas — ${progressoReal.concluidas} de 3 concluídas`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {fasesInclusas.map((f) => (
            <div key={f.numero} style={{
              flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: 6,
              background: f.concluida ? 'var(--vp-success-tint)' : 'var(--bg)',
              border: '1px solid ' + (f.concluida ? 'var(--vp-success)' : 'var(--border)'),
              fontSize: '0.85rem', fontWeight: 600,
            }}>
              {f.concluida ? '✅' : '○'} {f.numero}ª vistoria
            </div>
          ))}
        </div>
      </div>

      {/* CHECKLISTS DIGITAIS DESPACHADOS (Fase 4 — resultado de Vistorias de Obras/vistorias-envio.jsx) */}
      <ChecklistsDigitaisObra obraId={obraId}/>

    </div>
  );
}

/* Checklists digitais despachados (Fase 4) — mostra o resultado das
   Atividades criadas na aba Despachar de vistorias-envio.jsx e
   preenchidas pelo técnico em vistoria-execucao.jsx. Fonte separada de
   `vistorias_obras` (agendamento manual, que continua existindo em
   paralelo) — aqui é só leitura do que já foi respondido/anexado. */
const STATUS_ATIVIDADE_RESULTADO = {
  pendente: { label: 'Pendente', variant: 'warning' },
  em_execucao: { label: 'Em execução', variant: 'info' },
  concluida: { label: 'Concluída', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'neutral' },
};

function ChecklistsDigitaisObra({ obraId }) {
  const [atividades, setAtividades] = React.useState(null);
  const [detalhe, setDetalhe] = React.useState(null);

  React.useEffect(() => {
    window.VistoriasQuestionariosStore.listarAtividadesPorDossier(obraId)
      .then(setAtividades)
      .catch(() => setAtividades([]));
  }, [obraId]);

  // Sem dado ou obra sem nenhum checklist digital ainda — não polui a
  // tela com uma seção vazia antes que a Fase 2/3 sejam usadas de fato.
  if (!atividades || atividades.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>📲 Checklists digitais despachados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {atividades.map((a) => {
          const st = STATUS_ATIVIDADE_RESULTADO[a.status] || { label: a.status, variant: 'neutral' };
          return (
            <div key={a.id} onClick={() => setDetalhe(a)}
              style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.vistorias_questionarios?.nome}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg3)', marginTop: 2 }}>
                  {a.equipamentos_obra?.numero_serie ? `${a.equipamentos_obra.numero_serie} · ` : ''}
                  {a.colaboradores_vpsistema?.nome || 'Técnico a definir'}
                  {a.concluido_em ? ` · concluída em ${new Date(a.concluido_em).toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
          );
        })}
      </div>
      {detalhe && <ResultadoAtividadeModal atividade={detalhe} onClose={() => setDetalhe(null)}/>}
    </div>
  );
}

/* Modal read-only com o checklist inteiro respondido — mesma lógica de
   visibilidade condicional de vistoria-execucao.jsx (esconde perguntas
   cujo gatilho não foi disparado, pra mostrar exatamente o que o
   técnico viu). */
/* ---- Edição de uma resposta pelo operador (dentro do "Ver resultado") —
   um controle por tipo_campo, cada mudança salva na hora via onSalvar.
   Assinatura fica só leitura (reassinar não faz sentido pra quem não
   é o vistoriador/responsável); foto permite editar legenda, remover E
   enviar foto nova (ex.: o operador tem uma foto melhor que o
   vistoriador não mandou, ou quer complementar o registro). */
function CampoEditavel({ pergunta, resposta, onSalvar, atividadeId }) {
  const [textoLocal, setTextoLocal] = React.useState(resposta?.valor ?? '');
  const [enviandoFoto, setEnviandoFoto] = React.useState(false);
  React.useEffect(() => { setTextoLocal(resposta?.valor ?? ''); }, [pergunta.id, resposta?.valor]);

  const adicionarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const sb = window.__VP_SB.sb;
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${atividadeId}/${pergunta.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: eUp } = await sb.storage.from('vistorias-anexos').upload(path, file, { upsert: true, contentType: file.type });
      if (eUp) throw eUp;
      const { data } = sb.storage.from('vistorias-anexos').getPublicUrl(path);
      onSalvar({ anexos: (resposta?.anexos || []).concat([{ url: data.publicUrl, legenda: '' }]) });
    } catch (err) { window.toast?.('Erro ao enviar a foto: ' + err.message, 'error'); }
    finally { setEnviandoFoto(false); e.target.value = ''; }
  };

  if (pergunta.tipo_campo === 'informativa') return null;
  const salvarTexto = () => onSalvar({ valor: textoLocal });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pergunta.tipo_campo === 'texto' && (
        <input className="input" value={textoLocal} onChange={(e) => setTextoLocal(e.target.value)} onBlur={salvarTexto}/>
      )}
      {pergunta.tipo_campo === 'numerico' && (
        <input className="input" type="number" value={textoLocal} onChange={(e) => setTextoLocal(e.target.value)} onBlur={salvarTexto}/>
      )}
      {pergunta.tipo_campo === 'data' && (
        <input className="input" type="date" value={textoLocal} onChange={(e) => { setTextoLocal(e.target.value); onSalvar({ valor: e.target.value }); }}/>
      )}
      {pergunta.tipo_campo === 'sim_nao' && (
        <div className="row" style={{ gap: 6 }}>
          {['Sim', 'Não'].map((op) => (
            <Button key={op} size="sm" variant={resposta?.valor === op ? 'primary' : 'outline'} onClick={() => onSalvar({ valor: op })}>{op}</Button>
          ))}
        </div>
      )}
      {pergunta.tipo_campo === 'selecao_unica' && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(pergunta.opcoes || []).map((op) => (
            <Button key={op} size="sm" variant={resposta?.valor === op ? 'primary' : 'outline'} onClick={() => onSalvar({ valor: op })}>{op}</Button>
          ))}
        </div>
      )}
      {pergunta.tipo_campo === 'multipla_escolha' && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(pergunta.opcoes || []).map((op) => {
            const marcado = (resposta?.valor_lista || []).includes(op);
            return (
              <Button key={op} size="sm" variant={marcado ? 'primary' : 'outline'} onClick={() => {
                const atual = resposta?.valor_lista || [];
                onSalvar({ valor_lista: marcado ? atual.filter((v) => v !== op) : atual.concat([op]) });
              }}>{op}</Button>
            );
          })}
        </div>
      )}
      {pergunta.tipo_campo === 'foto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(resposta?.anexos || []).length ? resposta.anexos.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <img src={a.url} alt="" style={{ width: 70, height: 52, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <input className="input" style={{ fontSize: 12 }} defaultValue={a.legenda || ''} placeholder="Legenda"
                  onBlur={(e) => onSalvar({ anexos: resposta.anexos.map((x, idx) => (idx === i ? { ...x, legenda: e.target.value } : x)) })}/>
                <Button size="sm" variant="ghost" onClick={() => onSalvar({ anexos: resposta.anexos.filter((_, idx) => idx !== i) })}>Remover foto</Button>
              </div>
            </div>
          )) : <span style={{ color: 'var(--fg3)', fontSize: 13 }}>— sem fotos —</span>}
          <label className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            {enviandoFoto ? 'Enviando…' : 'Adicionar foto'}
            <input type="file" accept="image/*" onChange={adicionarFoto} hidden disabled={enviandoFoto}/>
          </label>
        </div>
      )}
      {pergunta.tipo_campo === 'assinatura' && (
        resposta?.anexo_url
          ? <img src={resposta.anexo_url} alt="" style={{ maxWidth: 160, maxHeight: 120, borderRadius: 6, border: '1px solid var(--border)' }}/>
          : <span style={{ color: 'var(--fg3)', fontSize: 13 }}>— sem assinatura — (não editável aqui)</span>
      )}
      {!window.VistoriasQuestionariosStore.ehPerguntaCompanion(pergunta) && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--vp-danger-ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!resposta?.pendencia} onChange={(e) => onSalvar({ pendencia: e.target.checked })}/>
          Marcar como pendência
        </label>
      )}
    </div>
  );
}

function ResultadoAtividadeModal({ atividade, onClose }) {
  const [estrutura, setEstrutura] = React.useState(null);
  const [respostas, setRespostas] = React.useState(null);

  React.useEffect(() => {
    Promise.all([
      window.VistoriasQuestionariosStore.carregarEstrutura(atividade.questionario_id),
      window.VistoriasQuestionariosStore.listarRespostas(atividade.id),
    ]).then(([est, resp]) => {
      setEstrutura(est);
      const mapa = {};
      resp.forEach((r) => { mapa[r.pergunta_id + ':' + (r.pavimento_index || 0)] = r; });
      setRespostas(mapa);
    }).catch((e) => window.toast?.('Erro: ' + e.message, 'error'));
  }, [atividade.id]);

  const chave = (perguntaId, pav) => perguntaId + ':' + (pav || 0);
  const visivel = (p, pav) => {
    if (!p.regra_pai_pergunta_id) return true;
    const r = respostas?.[chave(p.regra_pai_pergunta_id, pav)] || respostas?.[chave(p.regra_pai_pergunta_id, 0)];
    return !!r && r.valor === p.regra_valor_gatilho;
  };

  const formatarValor = (pergunta, r) => {
    if (pergunta.tipo_campo === 'foto') {
      return (r?.anexos || []).length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {r.anexos.map((a, i) => (
            <div key={i}>
              <img src={a.url} alt={pergunta.texto} style={{ maxWidth: 160, maxHeight: 120, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }}/>
              {a.legenda && <div style={{ fontSize: 11, color: 'var(--fg3)', maxWidth: 160 }}>{a.legenda}</div>}
            </div>
          ))}
        </div>
      ) : <span style={{ color: 'var(--fg3)' }}>— sem resposta —</span>;
    }
    if (pergunta.tipo_campo === 'assinatura') {
      return r?.anexo_url
        ? <img src={r.anexo_url} alt={pergunta.texto} style={{ maxWidth: 160, maxHeight: 120, borderRadius: 6, border: '1px solid var(--border)' }}/>
        : <span style={{ color: 'var(--fg3)' }}>— sem resposta —</span>;
    }
    if (pergunta.tipo_campo === 'multipla_escolha') {
      return (r?.valor_lista || []).length ? r.valor_lista.join(', ') : <span style={{ color: 'var(--fg3)' }}>— sem resposta —</span>;
    }
    return r?.valor ? r.valor : <span style={{ color: 'var(--fg3)' }}>— sem resposta —</span>;
  };

  const [editando, setEditando] = React.useState(false);
  const salvarResposta = async (perguntaId, pav, campos) => {
    const k = chave(perguntaId, pav);
    setRespostas((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), pergunta_id: perguntaId, pavimento_index: pav || 0, ...campos } }));
    try {
      const sb = window.__VP_SB.sb;
      const { error } = await sb.from('vistorias_respostas')
        .upsert({ atividade_id: atividade.id, pergunta_id: perguntaId, pavimento_index: pav || 0, ...campos }, { onConflict: 'atividade_id,pergunta_id,pavimento_index' });
      if (error) throw error;
    } catch (e) { window.toast?.('Erro ao salvar: ' + e.message, 'error'); }
  };

  const [baixandoPdf, setBaixandoPdf] = React.useState(false);
  const baixarPdf = async () => {
    if (!window.VistoriaReactPdf) { window.toast?.('Motor de PDF ainda carregando — tente de novo em instantes.', 'warning'); return; }
    setBaixandoPdf(true);
    try {
      const tipoLabel = window.VistoriasQuestionariosStore.TIPO_LABEL[atividade.vistorias_questionarios?.tipo] || 'Vistoria';
      const dadosPdf = {
        atividade: {
          numeroLabel: atividade.numero_sequencial ? `${atividade.numero_sequencial}ª` : '—',
          tipoLabel,
          obraNome: atividade.dossier_obra?.building_name || atividade.dossier_obra?.client_name,
          clienteNome: atividade.dossier_obra?.client_name,
          equipamentoSerie: atividade.equipamentos_obra?.numero_serie,
          tecnicoNome: atividade.colaboradores_vpsistema?.nome,
          checkinTxt: atividade.checkin_em ? new Date(atividade.checkin_em).toLocaleString('pt-BR') : null,
          concluidoTxt: atividade.concluido_em ? new Date(atividade.concluido_em).toLocaleString('pt-BR') : null,
          paradas: atividade.paradas,
        },
        estrutura,
        respostas,
      };
      const nome = [tipoLabel, atividade.numero_sequencial ? `${atividade.numero_sequencial}ª` : null, atividade.dossier_obra?.building_name || atividade.dossier_obra?.client_name].filter(Boolean).join(' - ') + '.pdf';
      const r = await window.VistoriaReactPdf.baixar(dadosPdf, nome);
      if (r?.falhasDeImagem?.length) window.toast?.('⚠ PDF gerado, mas com falha em alguma imagem: ' + r.falhasDeImagem.join('; '), 'warning');
    } catch (e) { window.toast?.('Erro ao gerar PDF: ' + e.message, 'error'); }
    finally { setBaixandoPdf(false); }
  };

  const linkMapa = (lat, lng) => (lat != null && lng != null) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <Modal title={atividade.vistorias_questionarios?.nome || 'Checklist'} onClose={onClose} width={620}
      footer={(
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Button variant={editando ? 'primary' : 'outline'} icon="edit" onClick={() => setEditando((v) => !v)} disabled={estrutura === null}>
            {editando ? 'Concluir edição' : 'Editar respostas'}
          </Button>
          <Button variant="primary" icon="download" onClick={baixarPdf} disabled={baixandoPdf || estrutura === null}>{baixandoPdf ? 'Gerando PDF…' : 'Baixar PDF'}</Button>
        </div>
      )}>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--fg2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div>Técnico: <b>{atividade.colaboradores_vpsistema?.nome || 'a definir'}</b></div>
        {atividade.checkin_em && (
          <div>Check-in: {new Date(atividade.checkin_em).toLocaleString('pt-BR')}
            {linkMapa(atividade.checkin_lat, atividade.checkin_lng) && <> · <a href={linkMapa(atividade.checkin_lat, atividade.checkin_lng)} target="_blank" rel="noreferrer">ver no mapa</a></>}
          </div>
        )}
        {atividade.concluido_em && (
          <div>Concluída: {new Date(atividade.concluido_em).toLocaleString('pt-BR')}
            {linkMapa(atividade.checkout_lat, atividade.checkout_lng) && <> · <a href={linkMapa(atividade.checkout_lat, atividade.checkout_lng)} target="_blank" rel="noreferrer">ver no mapa</a></>}
          </div>
        )}
      </div>

      {estrutura === null ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--fg3)' }}>Carregando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {estrutura.map((categoria) => {
            const pavs = window.VistoriasQuestionariosStore.pavsDaCategoria(categoria, atividade.paradas);
            return (
              <div key={categoria.id}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, textTransform: 'uppercase', color: 'var(--fg2)' }}>{categoria.nome}</div>
                {pavs.map((pav) => (
                  <div key={pav} style={{ marginBottom: pavs.length > 1 ? 10 : 0 }}>
                    {categoria.repete_por_pavimento && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', marginBottom: 6 }}>Pavimento {pav}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {categoria.perguntas.filter((p) => visivel(p, pav)).map((p) => {
                        if (p.tipo_campo === 'informativa') return null;
                        const r = respostas[chave(p.id, pav)];
                        return (
                          <div key={p.id + ':' + pav} style={{ borderBottom: '1px solid var(--vp-gray-100)', paddingBottom: 8 }}>
                            <div style={{ fontSize: 13, color: 'var(--fg1)', marginBottom: 4 }}>{p.texto}</div>
                            {editando ? (
                              <CampoEditavel pergunta={p} resposta={r} atividadeId={atividade.id} onSalvar={(campos) => salvarResposta(p.id, pav, campos)}/>
                            ) : (
                              <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {formatarValor(p, r)}
                                {r?.pendencia && <Badge variant="warning">Pendência</Badge>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
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
        style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.9rem', marginBottom: '1rem' }}
      />
      {clientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg2)' }}>Nenhuma obra encontrada.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {clientes.map((cliente) => {
            const lista = porCliente[cliente];
            const aberto = forcarAberto || clienteAberto === cliente;
            return (
              <div key={cliente} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
                <div
                  onClick={() => setClienteAberto(clienteAberto === cliente ? null : cliente)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem', userSelect: 'none',
                  }}>
                  <span style={{ display: 'inline-block', transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                  🏢 {cliente}
                  <span style={{ fontWeight: 400, color: 'var(--fg3)', fontSize: '0.82rem' }}>({lista.length})</span>
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
                            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center', gap: 8,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vp-gray-50)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{o.building_name || 'Obra sem nome'}</div>
                            {seriais.length > 0 && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--fg3)', marginTop: 2 }}>
                                🔧 {seriais.join(', ')}
                              </div>
                            )}
                          </div>
                          <span style={{ color: 'var(--fg3)', fontSize: '0.85rem' }}>›</span>
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