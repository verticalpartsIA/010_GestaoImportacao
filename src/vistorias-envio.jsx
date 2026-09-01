/* ============================================================
   vistorias-envio.jsx
   Módulo: Vistorias de Obras (rota `vistorias-envio`)

   Fase 1: builder do motor de questionários (Questionário -> Categoria
   -> Pergunta, com ramo condicional). Consome window.VistoriasQuestionariosStore
   (vistorias-questionarios-store.js). Estrutura de criação apenas —
   nasce vazia, sem dados importados de nenhum sistema externo (ver
   dossiê de engenharia reversa do Btime no README.md pro modelo de
   referência).

   Ainda não implementado aqui (fases futuras, ver README):
   disparo pro celular do técnico (Fase 2), execução mobile (Fase 3),
   resultado alimentando src/vistorias-obras.jsx (Fase 4).
   ============================================================ */

function VistoriasEnvio({ setRoute }) {
  const [questionarios, setQuestionarios] = React.useState(null);
  const [questionarioAberto, setQuestionarioAberto] = React.useState(null);
  const [showNovo, setShowNovo] = React.useState(false);

  const carregarLista = React.useCallback(() => {
    window.VistoriasQuestionariosStore.listarQuestionarios()
      .then(setQuestionarios)
      .catch((e) => { window.toast?.('Erro ao carregar questionários: ' + e.message, 'error'); setQuestionarios([]); });
  }, []);
  React.useEffect(() => { carregarLista(); }, [carregarLista]);

  const abrirQuestionario = (q) => setQuestionarioAberto(q);
  const voltarParaLista = () => { setQuestionarioAberto(null); carregarLista(); };

  const excluirQuestionario = async (q) => {
    if (!window.confirm(`Excluir o questionário "${q.nome}"? Todas as categorias e perguntas dele vão junto.`)) return;
    try {
      await window.VistoriasQuestionariosStore.excluirQuestionario(q.id);
      window.toast?.('Questionário excluído', 'success');
      carregarLista();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const alternarAtivo = async (q) => {
    try {
      await window.VistoriasQuestionariosStore.atualizarQuestionario(q.id, { ativo: !q.ativo });
      carregarLista();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  if (questionarioAberto) {
    return <QuestionarioEditor questionario={questionarioAberto} onVoltar={voltarParaLista} onAtualizado={(patch) => setQuestionarioAberto((q) => ({ ...q, ...patch }))}/>;
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Vistorias de Obras</div>
          <h1 className="page-head__title">Vistorias de Obras</h1>
          <p className="page-head__sub">Monte os questionários de vistoria aqui. O envio pro celular do técnico é a próxima fase — por enquanto, esta tela é só o construtor do checklist.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setShowNovo(true)}>Novo Questionário</Button>
      </div>

      {questionarios === null ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      ) : questionarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--fg3)' }}>
          <Icon.fileText size={28} style={{ marginBottom: 10, opacity: .6 }}/>
          <p style={{ margin: 0, fontSize: 13.5 }}>Nenhum questionário criado ainda.</p>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 14 }} onClick={() => setShowNovo(true)}>Criar o primeiro</Button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Ativo</th>
              <th>Atualizado</th>
              <th></th>
            </tr></thead>
            <tbody>
              {questionarios.map((q) => (
                <tr key={q.id} onClick={() => abrirQuestionario(q)} style={{ cursor: 'pointer' }}>
                  <td className="cell-main">{q.nome}</td>
                  <td style={{ textTransform: 'capitalize' }}>{q.tipo}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!q.ativo} onChange={() => alternarAtivo(q)}/>
                      <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{q.ativo ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{q.atualizado_em ? new Date(q.atualizado_em).toLocaleDateString('pt-BR') : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" icon="chevRight" onClick={() => abrirQuestionario(q)}>Abrir</Button>
                      <Button variant="ghost" size="sm" icon="trash" title="Excluir" aria-label="Excluir" onClick={() => excluirQuestionario(q)}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNovo && (
        <NovoQuestionarioModal
          onClose={() => setShowNovo(false)}
          onCriado={(q) => { setShowNovo(false); carregarLista(); abrirQuestionario(q); }}
        />
      )}
    </div>
  );
}

/* ---- Modal: criar questionário (só nome + tipo pra já abrir no editor) ---- */
function NovoQuestionarioModal({ onClose, onCriado }) {
  const [nome, setNome] = React.useState('');
  const [tipo, setTipo] = React.useState('vistoria');
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    if (!nome.trim()) { window.toast?.('Dê um nome pro questionário', 'warning'); return; }
    setSalvando(true);
    try {
      const q = await window.VistoriasQuestionariosStore.criarQuestionario({ nome: nome.trim(), tipo });
      window.toast?.('Questionário criado — agora monte as categorias e perguntas', 'success');
      onCriado(q);
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal title="Novo Questionário" onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={salvar} disabled={salvando}>{salvando ? 'Criando…' : 'Criar e montar'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="up-eyebrow muted">Nome</span>
          <input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Checklist de Entrega de Elevador"/>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="up-eyebrow muted">Tipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="vistoria">Vistoria</option>
            <option value="entrega">Entrega</option>
            <option value="servico">Serviço</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

/* ---- Editor: categorias + perguntas de UM questionário ---- */
function QuestionarioEditor({ questionario, onVoltar, onAtualizado }) {
  const [estrutura, setEstrutura] = React.useState(null);
  const [novaCategoria, setNovaCategoria] = React.useState('');
  const Store = window.VistoriasQuestionariosStore;

  const carregar = React.useCallback(() => {
    Store.carregarEstrutura(questionario.id).then(setEstrutura)
      .catch((e) => { window.toast?.('Erro: ' + e.message, 'error'); setEstrutura([]); });
  }, [questionario.id]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    try {
      await Store.criarCategoria(questionario.id, novaCategoria.trim());
      setNovaCategoria('');
      carregar();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const excluirCategoria = async (categoria) => {
    if (!window.confirm(`Excluir a categoria "${categoria.nome}" e todas as suas perguntas?`)) return;
    try { await Store.excluirCategoria(categoria.id); carregar(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  // todas as perguntas do questionário, achatadas — usadas como candidatas a "pergunta-pai" de regra condicional
  const todasPerguntas = React.useMemo(
    () => (estrutura || []).flatMap((c) => c.perguntas.map((p) => ({ ...p, categoriaNome: c.nome }))),
    [estrutura]
  );

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <Button variant="ghost" size="sm" icon="chevLeft" onClick={onVoltar} style={{ marginBottom: 8 }}>Todos os questionários</Button>
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Vistorias de Obras</div>
          <h1 className="page-head__title">{questionario.nome}</h1>
          <p className="page-head__sub" style={{ textTransform: 'capitalize' }}>Tipo: {questionario.tipo}</p>
        </div>
      </div>

      {estrutura === null ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {estrutura.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 6 }}>
              Nenhuma categoria ainda. Comece adicionando uma abaixo (ex.: "Casa de Máquinas", "Cabina"…).
            </div>
          )}
          {estrutura.map((categoria) => (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              todasPerguntas={todasPerguntas}
              onExcluirCategoria={() => excluirCategoria(categoria)}
              onMudou={carregar}
            />
          ))}

          <Card>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Nome da nova categoria…"
                value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarCategoria(); }}/>
              <Button variant="outline" icon="plus" onClick={adicionarCategoria} disabled={!novaCategoria.trim()}>Adicionar categoria</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---- Uma categoria: cabeçalho + lista de perguntas + form de nova pergunta ---- */
function CategoriaCard({ categoria, todasPerguntas, onExcluirCategoria, onMudou }) {
  const [formAberto, setFormAberto] = React.useState(false);
  const [perguntaEditando, setPerguntaEditando] = React.useState(null);
  const Store = window.VistoriasQuestionariosStore;

  const perguntasOrdenadas = [...categoria.perguntas].sort((a, b) => a.ordem - b.ordem);

  const excluirPergunta = async (p) => {
    if (!window.confirm(`Excluir a pergunta "${p.texto}"?`)) return;
    try { await Store.excluirPergunta(p.id); onMudou(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  const mover = async (p, direcao) => {
    const idx = perguntasOrdenadas.findIndex((x) => x.id === p.id);
    const alvo = perguntasOrdenadas[idx + direcao];
    if (!alvo) return;
    try { await Store.reordenarPerguntas(p, alvo); onMudou(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  return (
    <Card
      title={categoria.nome}
      sub={`${perguntasOrdenadas.length} pergunta${perguntasOrdenadas.length === 1 ? '' : 's'}`}
      action={<Button variant="ghost" size="sm" icon="trash" title="Excluir categoria" aria-label="Excluir categoria" onClick={onExcluirCategoria}/>}>
      <div className="stack" style={{ gap: 6 }}>
        {perguntasOrdenadas.map((p, idx) => (
          <PerguntaRow
            key={p.id}
            pergunta={p}
            isFirst={idx === 0}
            isLast={idx === perguntasOrdenadas.length - 1}
            onMoverCima={() => mover(p, -1)}
            onMoverBaixo={() => mover(p, 1)}
            onEditar={() => { setPerguntaEditando(p); setFormAberto(true); }}
            onExcluir={() => excluirPergunta(p)}
          />
        ))}
      </div>

      {formAberto ? (
        <PerguntaForm
          categoriaId={categoria.id}
          pergunta={perguntaEditando}
          candidatasRegra={todasPerguntas.filter((c) => c.id !== (perguntaEditando && perguntaEditando.id))}
          onCancelar={() => { setFormAberto(false); setPerguntaEditando(null); }}
          onSalvo={() => { setFormAberto(false); setPerguntaEditando(null); onMudou(); }}
        />
      ) : (
        <Button variant="outline" size="sm" icon="plus" style={{ marginTop: perguntasOrdenadas.length ? 10 : 0 }}
          onClick={() => { setPerguntaEditando(null); setFormAberto(true); }}>Adicionar pergunta</Button>
      )}
    </Card>
  );
}

/* ---- Uma linha de pergunta (modo leitura) ---- */
function PerguntaRow({ pergunta, isFirst, isLast, onMoverCima, onMoverBaixo, onEditar, onExcluir }) {
  const tipoLabel = (window.VistoriasQuestionariosStore.TIPOS_CAMPO.find((t) => t.value === pergunta.tipo_campo) || {}).label || pergunta.tipo_campo;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
      <div className="row sb" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5 }}>{pergunta.texto}</div>
          <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="neutral">{tipoLabel}</Badge>
            {pergunta.obrigatoria ? <Badge variant="info">Obrigatória</Badge> : null}
            {pergunta.regra_pai_pergunta_id ? <Badge variant="warning">Condicional</Badge> : null}
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <Button variant="ghost" size="sm" icon="chevUp" disabled={isFirst} title="Mover pra cima" aria-label="Mover pra cima" onClick={onMoverCima}/>
          <Button variant="ghost" size="sm" icon="chevDown" disabled={isLast} title="Mover pra baixo" aria-label="Mover pra baixo" onClick={onMoverBaixo}/>
          <Button variant="ghost" size="sm" icon="edit" title="Editar" aria-label="Editar" onClick={onEditar}/>
          <Button variant="ghost" size="sm" icon="trash" title="Excluir" aria-label="Excluir" onClick={onExcluir}/>
        </div>
      </div>
    </div>
  );
}

/* ---- Form inline de criar/editar pergunta, incluindo a regra condicional ---- */
function PerguntaForm({ categoriaId, pergunta, candidatasRegra, onCancelar, onSalvo }) {
  const editando = !!pergunta;
  const [texto, setTexto] = React.useState(pergunta?.texto || '');
  const [tipoCampo, setTipoCampo] = React.useState(pergunta?.tipo_campo || 'texto');
  const [obrigatoria, setObrigatoria] = React.useState(pergunta ? !!pergunta.obrigatoria : true);
  const [opcoesTexto, setOpcoesTexto] = React.useState((pergunta?.opcoes || []).join('\n'));
  const [regraPaiId, setRegraPaiId] = React.useState(pergunta?.regra_pai_pergunta_id || '');
  const [regraValor, setRegraValor] = React.useState(pergunta?.regra_valor_gatilho || '');
  const [salvando, setSalvando] = React.useState(false);
  const Store = window.VistoriasQuestionariosStore;

  const paiEscolhido = candidatasRegra.find((c) => c.id === regraPaiId);
  const opcoesDoPai = paiEscolhido?.tipo_campo === 'sim_nao' ? ['Sim', 'Não']
    : Store.TIPOS_CAMPO_COM_OPCOES.includes(paiEscolhido?.tipo_campo) ? (paiEscolhido.opcoes || []) : null;

  const precisaOpcoes = Store.TIPOS_CAMPO_COM_OPCOES.includes(tipoCampo);

  const salvar = async () => {
    if (!texto.trim()) { window.toast?.('Escreva o texto da pergunta', 'warning'); return; }
    if (precisaOpcoes && !opcoesTexto.trim()) { window.toast?.('Liste ao menos uma opção (uma por linha)', 'warning'); return; }
    if (regraPaiId && !regraValor) { window.toast?.('Escolha o valor que dispara esta pergunta condicional', 'warning'); return; }

    const campos = {
      texto: texto.trim(),
      tipo_campo: tipoCampo,
      obrigatoria,
      opcoes: precisaOpcoes ? opcoesTexto.split('\n').map((s) => s.trim()).filter(Boolean) : null,
      regra_pai_pergunta_id: regraPaiId || null,
      regra_valor_gatilho: regraPaiId ? regraValor : null,
    };

    setSalvando(true);
    try {
      if (editando) await Store.atualizarPergunta(pergunta.id, campos);
      else await Store.criarPergunta(categoriaId, campos);
      onSalvo();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 10, background: 'var(--bg2, #fafafa)' }}>
      <div className="stack" style={{ gap: 10 }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="up-eyebrow muted">Pergunta</span>
          <input className="input" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: A casa de máquinas está livre de objetos estranhos?"/>
        </label>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="stack" style={{ gap: 4, minWidth: 180 }}>
            <span className="up-eyebrow muted">Tipo de campo</span>
            <select className="input" value={tipoCampo} onChange={(e) => setTipoCampo(e.target.value)}>
              {Store.TIPOS_CAMPO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="row" style={{ gap: 6, alignSelf: 'flex-end', marginBottom: 8 }}>
            <input type="checkbox" checked={obrigatoria} onChange={(e) => setObrigatoria(e.target.checked)}/>
            <span style={{ fontSize: 13 }}>Obrigatória</span>
          </label>
        </div>

        {precisaOpcoes && (
          <label className="stack" style={{ gap: 4 }}>
            <span className="up-eyebrow muted">Opções (uma por linha)</span>
            <textarea className="input" style={{ minHeight: 70, fontFamily: 'inherit' }}
              value={opcoesTexto} onChange={(e) => setOpcoesTexto(e.target.value)} placeholder={'Sim\nNão\nN/A'}/>
          </label>
        )}

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <label className="stack" style={{ gap: 4, minWidth: 220, flex: 1 }}>
            <span className="up-eyebrow muted">Só mostrar se… (opcional)</span>
            <select className="input" value={regraPaiId} onChange={(e) => { setRegraPaiId(e.target.value); setRegraValor(''); }}>
              <option value="">Sempre mostrar</option>
              {candidatasRegra.map((c) => <option key={c.id} value={c.id}>{c.categoriaNome} · {c.texto}</option>)}
            </select>
          </label>
          {regraPaiId && (
            <label className="stack" style={{ gap: 4, minWidth: 160 }}>
              <span className="up-eyebrow muted">Responder</span>
              {opcoesDoPai ? (
                <select className="input" value={regraValor} onChange={(e) => setRegraValor(e.target.value)}>
                  <option value="">—</option>
                  {opcoesDoPai.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" value={regraValor} onChange={(e) => setRegraValor(e.target.value)} placeholder="Valor exato da resposta"/>
              )}
            </label>
          )}
        </div>

        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onCancelar}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </div>
    </div>
  );
}

window.VistoriasEnvio = VistoriasEnvio;
