/* ============================================================
   vistorias-envio.jsx
   Módulo: Vistorias de Obras (rota `vistorias-envio`)

   Fase 1: builder do motor de questionários (Questionário -> Categoria
   -> Pergunta, com ramo condicional). Fase 2: despacho — cria uma
   Atividade (obra + equipamento + técnico + questionário) com um
   token/link único. Consome window.VistoriasQuestionariosStore
   (vistorias-questionarios-store.js). Estrutura de criação apenas —
   nasce vazia, sem dados importados de nenhum sistema externo (ver
   dossiê de engenharia reversa do Btime no README.md pro modelo de
   referência).

   O link gerado no despacho ainda não abre nada (a página pública de
   execução no celular é a Fase 3, não construída aqui) — o que existe
   até aqui é só o registro da Atividade + o link/token pra ela.
   Fase 4: resultado alimentando src/vistorias-obras.jsx.
   ============================================================ */

/* VPOB-0950 quando a obra tem numero_cotacao (funil normal); cai pro ID
   interno (obras legadas, sem cotação — ver resolverPorMasterId) senão. */
function veVpobLabel(obra) {
  if (!obra) return '';
  if (obra.numero_cotacao != null) return 'VPOB-' + String(obra.numero_cotacao).padStart(4, '0');
  return obra.id;
}

function VistoriasEnvio({ setRoute }) {
  const [aba, setAba] = React.useState('despacho');
  const [questionarioAberto, setQuestionarioAberto] = React.useState(null);

  if (questionarioAberto) {
    return <QuestionarioEditor questionario={questionarioAberto} onVoltar={() => setQuestionarioAberto(null)}/>;
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Vistorias de Obras</div>
          <h1 className="page-head__title">Vistorias de Obras</h1>
          <p className="page-head__sub">Monte os questionários e despache vistorias pro técnico. A execução no celular ainda é a próxima fase.</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'questionarios', label: 'Questionários', icon: 'fileText' },
          { key: 'despacho', label: 'Despachar', icon: 'send' },
          { key: 'calendario', label: 'Calendário', icon: 'calendar' },
        ]}
        active={aba}
        onChange={setAba}
      />

      <div style={{ marginTop: 16 }}>
        {aba === 'questionarios' && <ListaQuestionarios onAbrir={setQuestionarioAberto}/>}
        {aba === 'despacho' && <DespacharVistoria/>}
        {aba === 'calendario' && <CalendarioVistorias/>}
      </div>
    </div>
  );
}

/* ---- Aba "Questionários": lista + criar/excluir/ativar ---- */
function ListaQuestionarios({ onAbrir }) {
  const [questionarios, setQuestionarios] = React.useState(null);
  const [showNovo, setShowNovo] = React.useState(false);

  const carregarLista = React.useCallback(() => {
    window.VistoriasQuestionariosStore.listarQuestionarios()
      .then(setQuestionarios)
      .catch((e) => { window.toast?.('Erro ao carregar questionários: ' + e.message, 'error'); setQuestionarios([]); });
  }, []);
  React.useEffect(() => { carregarLista(); }, [carregarLista]);

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

  return (
    <div>
      <div className="row sb" style={{ marginBottom: 14 }}>
        <div className="small muted">Molde das perguntas — nenhuma vistoria é executada aqui ainda.</div>
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
                <tr key={q.id} onClick={() => onAbrir(q)} style={{ cursor: 'pointer' }}>
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
                      <Button variant="ghost" size="sm" icon="chevRight" onClick={() => onAbrir(q)}>Abrir</Button>
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
          onCriado={(q) => { setShowNovo(false); carregarLista(); onAbrir(q); }}
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

  const alternarRepetePorPavimento = async () => {
    try { await Store.atualizarCategoria(categoria.id, { repete_por_pavimento: !categoria.repete_por_pavimento }); onMudou(); }
    catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
  };

  return (
    <Card
      title={categoria.nome}
      sub={
        <label className="row" style={{ gap: 6, cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
          <span>{perguntasOrdenadas.length} pergunta{perguntasOrdenadas.length === 1 ? '' : 's'}</span>
          <span style={{ color: 'var(--fg3)' }}>·</span>
          <input type="checkbox" checked={!!categoria.repete_por_pavimento} onChange={alternarRepetePorPavimento}/>
          <span style={{ fontSize: 12 }}>Repetir por pavimento</span>
        </label>
      }
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

/* ---- Aba "Despachar": obra + equipamento + questionário + técnico -> Atividade ---- */
const STATUS_ATIVIDADE = {
  pendente: { label: 'Pendente', variant: 'warning' },
  em_execucao: { label: 'Em execução', variant: 'info' },
  concluida: { label: 'Concluída', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'neutral' },
};

function DespacharVistoria() {
  const [obras, setObras] = React.useState(null);
  const [equipPorObra, setEquipPorObra] = React.useState({});
  const [questionarios, setQuestionarios] = React.useState(null);
  const [tecnicos, setTecnicos] = React.useState(null);
  const [despachos, setDespachos] = React.useState(null);
  const [form, setForm] = React.useState({ dossierId: '', equipamentoId: '', questionarioId: '', tecnicoId: '', agendadoPara: '', paradas: '' });
  const [salvando, setSalvando] = React.useState(false);
  const [ultimoDespacho, setUltimoDespacho] = React.useState(null);
  const [masterIdInput, setMasterIdInput] = React.useState('');
  const [resolvendo, setResolvendo] = React.useState(false);
  const [erroMasterId, setErroMasterId] = React.useState(null);
  const [hidratado, setHidratado] = React.useState(null); // { obra, unidade } — última resolução via Master ID
  const Store = window.VistoriasQuestionariosStore;

  const carregar = React.useCallback(() => {
    const sb = window.__VP_SB?.sb;
    if (!sb) return;
    Promise.all([
      sb.from('dossier_obra').select('id, client_name, building_name, numero_cotacao').order('client_name'),
      sb.from('equipamentos_obra').select('id, dossier_id, numero_serie'),
      Store.listarQuestionarios(),
      sb.from('colaboradores_vpsistema').select('id, nome').eq('is_active', true).order('nome'),
      Store.listarAtividades(),
    ]).then(([obrasRes, eqRes, qs, tecRes, ativ]) => {
      setObras(obrasRes.data || []);
      const map = {};
      (eqRes.data || []).forEach((e) => { (map[e.dossier_id] = map[e.dossier_id] || []).push(e); });
      setEquipPorObra(map);
      setQuestionarios((qs || []).filter((q) => q.ativo));
      setTecnicos(tecRes.data || []);
      setDespachos(ativ);
    }).catch((e) => window.toast?.('Erro ao carregar: ' + e.message, 'error'));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const equipamentosDaObra = form.dossierId ? (equipPorObra[form.dossierId] || []) : [];

  const despachar = async () => {
    if (!form.dossierId) { window.toast?.('Escolha a obra', 'warning'); return; }
    if (!form.questionarioId) { window.toast?.('Escolha o questionário', 'warning'); return; }
    setSalvando(true);
    try {
      const atividade = await Store.criarAtividade({
        questionarioId: form.questionarioId,
        dossierId: form.dossierId,
        equipamentoId: form.equipamentoId || null,
        tecnicoId: form.tecnicoId || null,
        agendadoPara: form.agendadoPara ? new Date(form.agendadoPara).toISOString() : null,
        paradas: form.paradas ? parseInt(form.paradas, 10) : null,
      });
      const link = window.location.origin + '/vistoria/' + atividade.token;
      const questionario = questionarios.find((q) => q.id === form.questionarioId);
      const obra = obras.find((o) => o.id === form.dossierId);
      setUltimoDespacho({
        link, questionarioNome: questionario?.nome, obraNome: obra?.building_name,
        numeroLabel: `${atividade.numero_sequencial}ª Vistoria ${veVpobLabel(obra)}`,
      });
      setForm({ dossierId: '', equipamentoId: '', questionarioId: '', tecnicoId: '', agendadoPara: '', paradas: '' });
      setMasterIdInput('');
      setHidratado(null);
      window.toast?.('Vistoria despachada', 'success');
      carregar();
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  const resolverMasterId = async () => {
    if (!masterIdInput.trim()) return;
    setResolvendo(true);
    setErroMasterId(null);
    try {
      const resultado = await Store.resolverPorMasterId(masterIdInput);
      const obraExiste = obras.some((o) => o.id === resultado.obra.id);
      if (!obraExiste) throw new Error('Obra encontrada no Master ID, mas não está na lista de obras carregada — recarregue a página.');
      setForm((f) => ({ ...f, dossierId: resultado.obra.id, equipamentoId: '', paradas: resultado.unidade?.paradas ? String(resultado.unidade.paradas) : f.paradas }));
      setHidratado(resultado);
    } catch (e) { setErroMasterId(e.message); setHidratado(null); }
    finally { setResolvendo(false); }
  };

  const copiarLink = (link) => {
    navigator.clipboard?.writeText(link)
      .then(() => window.toast?.('Link copiado', 'success'))
      .catch(() => window.toast?.('Não deu pra copiar — selecione o link manualmente', 'warning'));
  };

  const abrirWhatsApp = (link, questionarioNome, obraNome) => {
    const msg = `Vistoria "${questionarioNome}" — ${obraNome}. Abra no celular pra preencher: ${link}`;
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
  };

  if (obras === null) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="Nova vistoria" sub="Obra e questionário são obrigatórios — equipamento e técnico são opcionais.">
        <div className="stack" style={{ gap: 12 }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="up-eyebrow muted">Buscar por Master ID (opcional)</span>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Ex.: VPOB-0950, VPEL-EL0950-1 ou o ID da obra (DOS-M045)"
                value={masterIdInput} onChange={(e) => setMasterIdInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') resolverMasterId(); }}/>
              <Button variant="outline" onClick={resolverMasterId} disabled={resolvendo || !masterIdInput.trim()}>{resolvendo ? 'Buscando…' : 'Buscar'}</Button>
            </div>
            <span className="small muted">Preenche Obra e mostra as especificações técnicas do ativo (quando o ID trouxer o índice do equipamento).</span>
          </label>
          {erroMasterId && <div className="alert warning"><Icon.warning/><div className="alert__title">{erroMasterId}</div></div>}
          {hidratado && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '0.75rem 1rem' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{hidratado.obra.client_name} — {hidratado.obra.building_name || 'sem nome'}</div>
              {hidratado.obra.city && <div className="small muted">{hidratado.obra.city}{hidratado.obra.state ? `/${hidratado.obra.state}` : ''}</div>}
              {hidratado.unidade ? (
                <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {hidratado.unidade.paradas != null && <Badge variant="info">{hidratado.unidade.paradas} paradas</Badge>}
                  {hidratado.unidade.percurso_mm != null && <Badge variant="neutral">Percurso {hidratado.unidade.percurso_mm}mm</Badge>}
                  {hidratado.unidade.overhead_mm != null && <Badge variant="neutral">Overhead {hidratado.unidade.overhead_mm}mm</Badge>}
                  {hidratado.unidade.poco_mm != null && <Badge variant="neutral">Poço {hidratado.unidade.poco_mm}mm</Badge>}
                  {(hidratado.unidade.caixa_largura_mm != null || hidratado.unidade.caixa_profundidade_mm != null) && (
                    <Badge variant="neutral">Caixa {hidratado.unidade.caixa_largura_mm ?? '—'}×{hidratado.unidade.caixa_profundidade_mm ?? '—'}mm</Badge>
                  )}
                  {(hidratado.unidade.porta_largura_mm != null || hidratado.unidade.porta_altura_mm != null) && (
                    <Badge variant="neutral">Porta {hidratado.unidade.porta_largura_mm ?? '—'}×{hidratado.unidade.porta_altura_mm ?? '—'}mm</Badge>
                  )}
                  {hidratado.unidade.tensao_principal && <Badge variant="neutral">{hidratado.unidade.tensao_principal}</Badge>}
                </div>
              ) : (
                <div className="small muted" style={{ marginTop: 4 }}>
                  {hidratado.parsed
                    ? 'Só a obra foi identificada — inclua o índice do ativo no ID (ex.: -1) pra trazer as especificações técnicas.'
                    : 'Obra legada (migrada direto, sem cotação vinculada) — sem especificações técnicas pra trazer aqui.'}
                </div>
              )}
            </div>
          )}

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
              <span className="up-eyebrow muted">Obra</span>
              <select className="input" value={form.dossierId}
                onChange={(e) => { setForm((f) => ({ ...f, dossierId: e.target.value, equipamentoId: '' })); setHidratado(null); }}>
                <option value="">Selecione…</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.client_name} — {o.building_name || 'sem nome'}</option>)}
              </select>
            </label>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 180 }}>
              <span className="up-eyebrow muted">Equipamento (opcional)</span>
              <select className="input" value={form.equipamentoId} disabled={!form.dossierId}
                onChange={(e) => setForm((f) => ({ ...f, equipamentoId: e.target.value }))}>
                <option value="">Vistoria geral da obra</option>
                {equipamentosDaObra.map((e) => <option key={e.id} value={e.id}>{e.numero_serie || e.id}</option>)}
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
              <span className="up-eyebrow muted">Questionário</span>
              <select className="input" value={form.questionarioId}
                onChange={(e) => setForm((f) => ({ ...f, questionarioId: e.target.value }))}>
                <option value="">Selecione…</option>
                {questionarios.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
              </select>
              {questionarios.length === 0 && <span className="small muted">Nenhum questionário ativo — crie um na aba Questionários.</span>}
            </label>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 180 }}>
              <span className="up-eyebrow muted">Técnico (opcional)</span>
              <select className="input" value={form.tecnicoId}
                onChange={(e) => setForm((f) => ({ ...f, tecnicoId: e.target.value }))}>
                <option value="">A definir</option>
                {(tecnicos || []).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
              <span className="up-eyebrow muted">Agendar para (opcional)</span>
              <input className="input" type="datetime-local" value={form.agendadoPara}
                onChange={(e) => setForm((f) => ({ ...f, agendadoPara: e.target.value }))}/>
              <span className="small muted">Sem data, a vistoria já entra na fila do vistoriador pra execução imediata.</span>
            </label>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 180 }}>
              <span className="up-eyebrow muted">Nº de paradas (opcional)</span>
              <input className="input" type="number" min="1" value={form.paradas}
                onChange={(e) => setForm((f) => ({ ...f, paradas: e.target.value }))} placeholder="Ex.: 5"/>
              <span className="small muted">Ajusta o checklist pra repetir as seções por pavimento. A busca por Master ID já preenche sozinha quando acha a especificação.</span>
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" icon="send" onClick={despachar} disabled={salvando}>{salvando ? 'Despachando…' : 'Despachar'}</Button>
          </div>
        </div>
      </Card>

      {ultimoDespacho && (
        <div className="alert info">
          <Icon.send/>
          <div style={{ flex: 1 }}>
            <div className="alert__title">{ultimoDespacho.numeroLabel} despachada — link pronto pra enviar</div>
            <div className="alert__sub" style={{ wordBreak: 'break-all' }}>{ultimoDespacho.link}</div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <Button variant="outline" size="sm" icon="copy" onClick={() => copiarLink(ultimoDespacho.link)}>Copiar link</Button>
              <Button variant="outline" size="sm" icon="message" onClick={() => abrirWhatsApp(ultimoDespacho.link, ultimoDespacho.questionarioNome, ultimoDespacho.obraNome)}>Enviar por WhatsApp</Button>
            </div>
          </div>
        </div>
      )}

      <Card title="Últimas vistorias despachadas">
        {despachos === null ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
        ) : despachos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma vistoria despachada ainda.</div>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr>
                <th>Nº</th>
                <th>Obra</th>
                <th>Equipamento</th>
                <th>Questionário</th>
                <th>Técnico</th>
                <th>Status</th>
                <th>Agendado</th>
                <th>Enviado</th>
              </tr></thead>
              <tbody>
                {despachos.map((a) => {
                  const st = STATUS_ATIVIDADE[a.status] || { label: a.status, variant: 'neutral' };
                  return (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontSize: 11 }}>{a.numero_sequencial ? `${a.numero_sequencial}ª · ${veVpobLabel(a.dossier_obra)}` : '—'}</td>
                      <td className="cell-main">{a.dossier_obra?.client_name} — {a.dossier_obra?.building_name || '—'}</td>
                      <td>{a.equipamentos_obra?.numero_serie || '—'}</td>
                      <td>{a.vistorias_questionarios?.nome || '—'}</td>
                      <td>{a.colaboradores_vpsistema?.nome || 'A definir'}</td>
                      <td><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{a.agendado_para ? new Date(a.agendado_para).toLocaleString('pt-BR') : '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--fg3)' }}>{a.enviado_em ? new Date(a.enviado_em).toLocaleString('pt-BR') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---- Aba "Calendário": visão mensal do agendamento (Módulo ADM) ----
   Só mostra atividades com agendado_para preenchido — despachos sem
   data (fila imediata) não aparecem aqui, ficam só na aba Despachar. */
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function CalendarioVistorias() {
  const hoje = React.useMemo(() => new Date(), []);
  const [mesRef, setMesRef] = React.useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [atividades, setAtividades] = React.useState(null);
  const [detalhe, setDetalhe] = React.useState(null);

  React.useEffect(() => {
    window.VistoriasQuestionariosStore.listarAtividadesAgendadas()
      .then(setAtividades)
      .catch(() => setAtividades([]));
  }, []);

  const porDia = React.useMemo(() => {
    const mapa = {};
    (atividades || []).forEach((a) => {
      const d = new Date(a.agendado_para);
      const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (mapa[chave] = mapa[chave] || []).push(a);
    });
    return mapa;
  }, [atividades]);

  const primeiroDiaSemana = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1).getDay();
  const diasNoMes = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  const mudarMes = (delta) => setMesRef((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div>
      <div className="row sb" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="ghost" size="sm" icon="chevLeft" aria-label="Mês anterior" onClick={() => mudarMes(-1)}/>
          <div style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>{MESES[mesRef.getMonth()]} {mesRef.getFullYear()}</div>
          <Button variant="ghost" size="sm" icon="chevRight" aria-label="Próximo mês" onClick={() => mudarMes(1)}/>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}>Hoje</Button>
      </div>

      {atividades === null ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface-2, #f6f6f6)' }}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg3)', textAlign: 'center' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {celulas.map((d, idx) => {
              if (d === null) return <div key={'v' + idx} style={{ minHeight: 90, borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--surface-2, #fafafa)' }}/>;
              const chave = `${mesRef.getFullYear()}-${mesRef.getMonth()}-${d}`;
              const doDia = porDia[chave] || [];
              const ehHoje = hoje.getFullYear() === mesRef.getFullYear() && hoje.getMonth() === mesRef.getMonth() && hoje.getDate() === d;
              return (
                <div key={d} style={{ minHeight: 90, padding: 4, borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                  <div style={{
                    fontSize: 11, fontWeight: ehHoje ? 800 : 600, color: ehHoje ? 'var(--vp-primary, #0066ff)' : 'var(--fg2)',
                    marginBottom: 3,
                  }}>{d}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {doDia.slice(0, 3).map((a) => {
                      const st = STATUS_ATIVIDADE[a.status] || { variant: 'neutral' };
                      const cor = { warning: '#b45309', info: '#1d4ed8', success: '#15803d', neutral: '#666' }[st.variant] || '#666';
                      const hora = new Date(a.agendado_para).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={a.id} onClick={() => setDetalhe(a)}
                          title={`${hora} · ${a.dossier_obra?.building_name || ''}`}
                          style={{ fontSize: 10, padding: '2px 4px', borderRadius: 3, background: cor + '20', color: cor, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hora} {a.dossier_obra?.building_name || a.dossier_obra?.client_name || '—'}
                        </div>
                      );
                    })}
                    {doDia.length > 3 && <div style={{ fontSize: 10, color: 'var(--fg3)' }}>+{doDia.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detalhe && (
        <Modal title={detalhe.vistorias_questionarios?.nome || 'Vistoria agendada'} onClose={() => setDetalhe(null)} width={440}>
          <div className="stack" style={{ gap: 6, fontSize: 13 }}>
            <div><b>Obra:</b> {detalhe.dossier_obra?.client_name} — {detalhe.dossier_obra?.building_name || '—'}</div>
            {detalhe.equipamentos_obra?.numero_serie && <div><b>Equipamento:</b> {detalhe.equipamentos_obra.numero_serie}</div>}
            {detalhe.numero_sequencial && <div><b>Vistoria:</b> {detalhe.numero_sequencial}ª · {veVpobLabel(detalhe.dossier_obra)}</div>}
            <div><b>Técnico:</b> {detalhe.colaboradores_vpsistema?.nome || 'A definir'}</div>
            <div><b>Agendado para:</b> {new Date(detalhe.agendado_para).toLocaleString('pt-BR')}</div>
            <div><b>Status:</b> {(STATUS_ATIVIDADE[detalhe.status] || {}).label || detalhe.status}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

window.VistoriasEnvio = VistoriasEnvio;
