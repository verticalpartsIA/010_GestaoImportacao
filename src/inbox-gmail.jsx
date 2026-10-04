/* ============================================================
   inbox-gmail.jsx — o layout do Gmail no Inbox (04/10/2026, fase 3).
   Visto no Gmail do usuário: pesquisa em pílula com opções avançadas, ⚙ configurações rápidas (densidade, painel de leitura,
   tipo de caixa), "?" (ajuda, treinamento, feedback), barra de ferramentas sobre a lista com seleção em massa, janela
   "Escrever" flutuante. Só entra o que FUNCIONA com o backend de hoje; Arquivar / Marcadores / Adiados / Spam / Mover para
   dependem do backend da fase 4 e não aparecem (item visível tem que fazer algo).
   Preferências visuais (densidade, painel, ordem) ficam no navegador de cada pessoa (localStorage) — conveniência, não dado.
   ============================================================ */
const IG_PREFS_PADRAO = { densidade: 'padrao', painel: 'direita', ordem: 'padrao' };

function useInboxPrefs() {
  const eu = String((window.__VP_USER || {}).email || 'anon').toLowerCase();
  const chave = 'vp_inbox_prefs_' + eu;
  const [prefs, setPrefs] = React.useState(() => {
    try { return { ...IG_PREFS_PADRAO, ...JSON.parse(localStorage.getItem(chave) || '{}') }; } catch (_) { return { ...IG_PREFS_PADRAO }; }
  });
  const atualizar = React.useCallback((patch) => {
    setPrefs((p) => {
      const n = { ...p, ...patch };
      try { localStorage.setItem(chave, JSON.stringify(n)); } catch (_) { /* sem armazenamento: vale só nesta sessão */ }
      return n;
    });
  }, [chave]);
  return [prefs, atualizar];
}

/* Data no estilo do Gmail: hoje → hora; este ano → "3 de out."; antes → dd/mm/aaaa. */
function igQuando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const agora = new Date();
  if (d.toDateString() === agora.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === agora.getFullYear()) return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  return d.toLocaleDateString('pt-BR');
}

const IG_EM_OPCOES = [['todos', 'Todos os e-mails'], ['entrada', 'Caixa de entrada'], ['enviados', 'Enviados'], ['estrela', 'Com estrela'], ['meus', 'Atribuídos a mim'], ['triagem', 'Sem responsável'], ['adiados', 'Adiados'], ['spam', 'Spam']];
const IG_FORM_VAZIO = { de: '', para: '', assunto: '', contem: '', naoTem: '', depois: '', antes: '', em: 'todos', anexo: false, naoLida: false, estrela: false };

/* ---------- Pesquisa em pílula + opções avançadas ---------- */
function InboxBarraBusca({ valor, onChange }) {
  const [aberto, setAberto] = React.useState(false);
  const [f, setF] = React.useState(IG_FORM_VAZIO);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const pesquisar = () => { onChange(window.InboxBusca.montarConsulta(f)); setAberto(false); };
  const limpar = () => { setF(IG_FORM_VAZIO); onChange(''); setAberto(false); };
  const campo = (rotulo, k, tipo) => (
    <div className="ig-busca__linha"><label>{rotulo}</label>
      <input className="input" type={tipo || 'text'} value={f[k]} onChange={(e) => set(k, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pesquisar()}/></div>
  );
  return (
    <div className="ig-busca">
      <div className="ig-busca__pilula">
        <Icon.search size={16}/>
        <input placeholder="Pesquisar e-mail  (ex.: de:kimmy tem:anexo)" value={valor} onChange={(e) => onChange(e.target.value)}/>
        {valor ? <button className="ig-iconbtn" title="Limpar pesquisa" onClick={limpar}><Icon.x size={14}/></button> : null}
        <button className="ig-iconbtn" title="Opções de pesquisa avançada" onClick={() => setAberto((a) => !a)}><Icon.filter size={16}/></button>
      </div>
      {aberto && (
        <>
          <div className="ig-backdrop" onClick={() => setAberto(false)}/>
          <div className="ig-busca__painel">
            {campo('De', 'de')}{campo('Para', 'para')}{campo('Assunto', 'assunto')}
            {campo('Contém as palavras', 'contem')}{campo('Não tem', 'naoTem')}
            <div className="ig-busca__linha"><label>Data entre</label>
              <input className="input" type="date" value={f.depois} onChange={(e) => set('depois', e.target.value)}/>
              <span className="muted small">e</span>
              <input className="input" type="date" value={f.antes} onChange={(e) => set('antes', e.target.value)}/></div>
            <div className="ig-busca__linha"><label>Pesquisar em</label>
              <select className="input" value={f.em} onChange={(e) => set('em', e.target.value)}>
                {IG_EM_OPCOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select></div>
            <div className="ig-busca__linha ig-busca__checks">
              <label><input type="checkbox" checked={f.anexo} onChange={(e) => set('anexo', e.target.checked)}/> Com anexo</label>
              <label><input type="checkbox" checked={f.naoLida} onChange={(e) => set('naoLida', e.target.checked)}/> Não lidas</label>
              <label><input type="checkbox" checked={f.estrela} onChange={(e) => set('estrela', e.target.checked)}/> Com estrela</label>
            </div>
            <div className="ig-busca__rodape">
              <span className="muted small">A pesquisa olha os e-mails carregados na tela (recentes).</span>
              <span className="row gap-2"><Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button><Button variant="primary" size="sm" onClick={pesquisar}>Pesquisar</Button></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- ⚙ Configurações rápidas ---------- */
function InboxConfigRapida({ prefs, atualizar, foco, setFoco, onClose }) {
  const grupo = (titulo, chave, opcoes) => (
    <div className="ig-config__grupo">
      <div className="ig-config__titulo">{titulo}</div>
      {opcoes.map(([v, r, dica]) => (
        <label key={v} className="ig-config__opcao">
          <input type="radio" name={'ig-' + chave} checked={prefs[chave] === v} onChange={() => atualizar({ [chave]: v })}/>
          <span>{r}{dica ? <span className="muted small"> — {dica}</span> : null}</span>
        </label>
      ))}
    </div>
  );
  return (
    <div className="ig-config">
      <div className="ig-config__cab"><b>Configurações rápidas</b><button className="ig-iconbtn" onClick={onClose} title="Fechar"><Icon.x size={14}/></button></div>
      {grupo('Densidade', 'densidade', [['padrao', 'Padrão', 'duas linhas por e-mail'], ['regular', 'Regular', 'uma linha'], ['compacto', 'Compacto', 'uma linha, mais junto']])}
      {grupo('Painel de leitura', 'painel', [['direita', 'À direita da lista'], ['abaixo', 'Abaixo da lista'], ['sem', 'Sem divisão', 'o e-mail abre no lugar da lista']])}
      {grupo('Tipo de caixa de entrada', 'ordem', [['padrao', 'Padrão', 'mais recentes primeiro'], ['nao_lidas', 'Não lidas primeiro'], ['estrela', 'Com estrela primeiro'], ['importantes', 'Precisa de você primeiro']])}
      <div className="ig-config__grupo">
        <div className="ig-config__titulo">E-mails automáticos</div>
        <label className="ig-config__opcao"><input type="checkbox" checked={foco} onChange={() => setFoco((f) => !f)}/><span>Ocultar newsletters e avisos automáticos <span className="muted small">— nunca apaga; “ver tudo” devolve</span></span></label>
      </div>
      <div className="muted small" style={{ padding: '4px 16px 12px' }}>Estas escolhas valem só para você, neste navegador.</div>
    </div>
  );
}

/* ---------- ? Ajuda / Treinamento / Feedback ---------- */
function InboxMenuAjuda({ onAbrir }) {
  const [aberto, setAberto] = React.useState(false);
  const item = (rotulo, aba) => <div className="ig-menu__item" onClick={() => { setAberto(false); onAbrir(aba); }}>{rotulo}</div>;
  return (
    <div className="ig-menu">
      <button className="ig-iconbtn ig-iconbtn--grande" title="Suporte" onClick={() => setAberto((a) => !a)}><b>?</b></button>
      {aberto && (<><div className="ig-backdrop" onClick={() => setAberto(false)}/>
        <div className="ig-menu__lista">{item('Ajuda', 'guia')}{item('Treinamento', 'passo')}{item('Enviar feedback', 'feedback')}</div></>)}
    </div>
  );
}

function InboxAjudaModal({ aba, onTrocar, onClose }) {
  const abas = [['guia', 'Ajuda'], ['passo', 'Treinamento']];
  return (
    <Modal title="Ajuda do Inbox" onClose={onClose} width={640} footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <div className="row gap-2" style={{ marginBottom: 10 }}>
        {abas.map(([v, r]) => <Button key={v} size="sm" variant={aba === v ? 'primary' : 'outline'} onClick={() => onTrocar(v)}>{r}</Button>)}
      </div>
      {aba === 'passo' ? (
        <ol className="ig-ajuda">
          <li><b>Veja o que importa primeiro.</b> A faixa amarela “Precisa de você” mostra só o que tem prioridade alta, reclamação ou pede resposta. O resto fica na lista, sem alarde.</li>
          <li><b>Abra o e-mail.</b> Ele passa a contar como lido <i>para você</i> (os colegas continuam vendo como novo). A estrela ☆ também é só sua.</li>
          <li><b>Confira o responsável.</b> Abaixo do assunto aparece quem responde por aquele e-mail. Sem responsável? Ele está na fila de <i>Sem responsável</i> — use <b>Atribuir</b>.</li>
          <li><b>Vincule à cotação.</b> Se o robô achar a cotação provável, aparece uma barra com <b>Vincular</b>. Você decide.</li>
          <li><b>Responda.</b> Se o e-mail é de outra pessoa, o sistema avisa antes e avisa a ela depois.</li>
          <li><b>Escreva.</b> O botão <b>Escrever</b> abre a janela no canto da tela. Se faltar o Nº da cotação, o sistema pode sugerir uma antes de enviar.</li>
          <li><b>Pesquise.</b> Use a caixa de cima, ou o ícone de filtro para a pesquisa avançada.</li>
        </ol>
      ) : (
        <div className="ig-ajuda">
          <h4>Operadores de pesquisa</h4>
          <table className="t"><tbody>
            {[['de:kimmy', 'remetente contém “kimmy”'], ['para:suporte', 'destinatário'], ['assunto:cotação', 'palavra no assunto'], ['cotacao:955', 'e-mails da cotação 955'],
              ['tem:anexo', 'com anexo'], ['é:nao-lida · é:lida · é:estrela', 'estado (seu)'], ['depois:2026-10-01  antes:2026-10-31', 'período'],
              ['em:enviados · em:meus · em:triagem', 'onde pesquisar'], ['-spam', 'exclui a palavra'], ['"prazo de produção"', 'frase exata']]
              .map(([a, b]) => <tr key={a}><td className="mono">{a}</td><td>{b}</td></tr>)}
          </tbody></table>
          <h4>O que cada coisa significa</h4>
          <ul>
            <li><b>Etiqueta “Fornecedor · Importação · Média”:</b> o que o sistema entendeu do e-mail (assunto · área · prioridade). É uma sugestão por regras — passe o mouse para ver a confiança.</li>
            <li><b>“Precisa de você”:</b> prioridade alta, reclamação ou e-mail que pede resposta.</li>
            <li><b>Responsável:</b> o dono do e-mail (quem enviou) ou quem recebeu a atribuição. O autor original nunca muda.</li>
            <li><b>Limite:</b> a pesquisa olha os e-mails carregados na tela, não todo o histórico. Arquivar, marcadores e histórico completo chegam na próxima etapa.</li>
          </ul>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Barra de ferramentas sobre a lista ---------- */
/* `selecionadas` = caixas marcadas; `alvos` = sobre quantos e-mails as ações agem (marcados, ou o e-mail aberto se nada estiver marcado);
   `extras` = botões da fase 4A (Arquivar, Spam, Suspender, Mover para, Marcadores) montados pelo Inbox. */
function InboxToolbarLista({ total, selecionadas, alvos, rotuloAlvo, extras, todasMarcadas, onToggleTodas, onLida, onNaoLida, onExcluir, onAtualizar, carregando, podeEditar }) {
  const ref = React.useRef(null);
  const nAlvos = alvos != null ? alvos : selecionadas;
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = selecionadas > 0 && !todasMarcadas; }, [selecionadas, todasMarcadas]);
  return (
    <div className="ig-toolbar">
      <label className="ig-check" title="Selecionar todos"><input ref={ref} type="checkbox" checked={todasMarcadas && total > 0} onChange={onToggleTodas}/></label>
      {nAlvos > 0 ? (
        <>
          <span className="small muted">{rotuloAlvo || `${nAlvos} selecionado(s)`}</span>
          {extras}
          <Button variant="ghost" size="sm" disabled={!podeEditar} onClick={onLida}>Marcar como lida</Button>
          <Button variant="ghost" size="sm" disabled={!podeEditar} onClick={onNaoLida}>Marcar como não lida</Button>
          <Button variant="ghost" size="sm" icon="trash" onClick={onExcluir}>Excluir</Button>
        </>
      ) : (
        <button className="ig-iconbtn" title="Atualizar" disabled={carregando} onClick={onAtualizar}><Icon.refresh size={15}/></button>
      )}
      <span className="ig-toolbar__fim small muted">{total === 0 ? '0' : `1–${total} de ${total}`}</span>
    </div>
  );
}

/* ---------- Janela "Escrever" flutuante (canto inferior direito) ---------- */
function InboxJanela({ titulo, onClose, children, footer }) {
  const [min, setMin] = React.useState(false);
  const [max, setMax] = React.useState(false);
  return (
    <div className={'ig-janela' + (min ? ' is-min' : '') + (max ? ' is-max' : '')}>
      <div className="ig-janela__cab" onClick={() => min && setMin(false)}>
        <b>{titulo}</b>
        <span className="row gap-1">
          <button className="ig-iconbtn ig-iconbtn--claro" title={min ? 'Restaurar' : 'Minimizar'} onClick={(e) => { e.stopPropagation(); setMin((m) => !m); }}>–</button>
          <button className="ig-iconbtn ig-iconbtn--claro" title={max ? 'Reduzir' : 'Ampliar'} onClick={(e) => { e.stopPropagation(); setMax((m) => !m); setMin(false); }}>⤢</button>
          <button className="ig-iconbtn ig-iconbtn--claro" title="Fechar" onClick={(e) => { e.stopPropagation(); onClose(); }}><Icon.x size={13}/></button>
        </span>
      </div>
      {!min && <div className="ig-janela__corpo">{children}</div>}
      {!min && footer ? <div className="ig-janela__rodape">{footer}</div> : null}
    </div>
  );
}

Object.assign(window, { useInboxPrefs, igQuando, InboxBarraBusca, InboxConfigRapida, InboxMenuAjuda, InboxAjudaModal, InboxToolbarLista, InboxJanela });
