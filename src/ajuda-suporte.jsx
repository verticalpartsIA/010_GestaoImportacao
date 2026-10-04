/* ============================================================
   ajuda-suporte.jsx — menu "?" (Suporte) do cabeçalho, em TODAS as telas:
     · Ajuda            → instrução rápida da tela em que a pessoa está
     · Treinamento      → abre o tutorial HTML da tela (/TreinamentoVP/<pasta>/) em nova aba; sem tutorial = "em breve"
     · Enviar feedback  → formulário guiado que vira uma issue no GitHub (POST /api/feedback, ver server.js)
   Props (vêm do Header, src/shell.jsx): route, telaNome, ajudaTexto, tutorial.
   A issue leva só o primeiro nome do colaborador (server-lib/feedback-issue.js). O token do GitHub fica no servidor.
   ============================================================ */

const AJ_TIPOS = [
  ['erro', 'Erro', 'Algo não funciona como deveria'],
  ['duvida', 'Dúvida', 'Não sei como fazer algo'],
  ['sugestao', 'Sugestão', 'Uma ideia para melhorar'],
];
const AJ_GRAVIDADES = [
  ['bloqueia', 'Não consigo trabalhar'],
  ['atrapalha', 'Atrapalha, mas dá para contornar'],
  ['detalhe', 'Detalhe / incômodo pequeno'],
];
const AJ_ROTULOS = {
  erro:     { fazendo: 'O que você estava fazendo?', aconteceu: 'O que aconteceu?', ph: 'Ex.: cliquei em Aprovar e nada mudou na tela' },
  duvida:   { fazendo: 'O que você está tentando fazer?', aconteceu: 'Qual é a sua dúvida?', ph: 'Ex.: onde vejo as decisões que já foram aprovadas?' },
  sugestao: { fazendo: 'Em que momento você sentiu falta disso?', aconteceu: 'Qual é a sua ideia?', ph: 'Ex.: um filtro por cliente na lista' },
};

/* Mesma regra do servidor (server-lib/feedback-issue.js): "gelson.simoes@x.com" -> "Gelson". */
function ajPrimeiroNome(email) {
  const local = String(email || '').split('@')[0] || '';
  const p = (local.split(/[._\-+\s]+/)[0] || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Colaborador';
}

function AjudaItem({ titulo, sub, onClick, disabled }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--vp-gray-50, #f5f5f5)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '10px 16px', font: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--fg3, #777)', marginTop: 2 }}>{sub}</div>
    </button>
  );
}

function AjudaModal({ telaNome, ajudaTexto, tutorial, onClose }) {
  return (
    <Modal title={'Ajuda — ' + telaNome} onClose={onClose} width={620}
      footer={<Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>}>
      <div className="help-ctx">
        <div className="up-eyebrow muted" style={{ marginBottom: 6 }}>Você está em</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{telaNome}</div>
        <p className="vp-small" style={{ marginTop: 0 }}>
          {ajudaTexto || 'Use o menu à esquerda para navegar entre os módulos. Cada tela tem suas próprias ações no topo e na lista.'}
        </p>
        <p className="vp-small" style={{ marginBottom: 0 }}>
          {tutorial
            ? <>Quer o passo a passo com imagens? Abra <b>Treinamento</b> no menu <b>?</b>.</>
            : <>O treinamento desta tela ainda não foi publicado — está em preparação.</>}
        </p>
      </div>
      <div className="up-eyebrow muted" style={{ margin: '16px 0 8px' }}>Perguntas frequentes</div>
      <dl className="help-faq">
        <dt>Como faço login?</dt>
        <dd>O acesso é via SSO do portal vpsistema.com — você entra pelo portal e o VP Gestão abre já autenticado.</dd>
        <dt>Não encontro um módulo no menu</dt>
        <dd>O menu respeita o seu perfil (Comercial/Engenharia/Financeiro/Admin). Troque o perfil no topo à direita se tiver permissão.</dd>
        <dt>Um botão não fez nada</dt>
        <dd>Alguns fluxos dependem de uma etapa anterior (ex.: precificar exige Análise Técnica aprovada). Verifique o status da obra no Dossiê.</dd>
        <dt>Preciso de suporte humano</dt>
        <dd>Abra o menu <b>?</b> e escolha <b>Enviar feedback</b>: conte o que aconteceu e o gestor entra em contato.</dd>
      </dl>
    </Modal>
  );
}

function FeedbackModal({ telaNome, route, onClose }) {
  const user = window.__VP_USER || {};
  const [f, setF] = React.useState({ tipo: 'erro', gravidade: '', resumo: '', fazendo: '', aconteceu: '', esperava: '', livre: '', contato: true });
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [feito, setFeito] = React.useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const rot = AJ_ROTULOS[f.tipo];
  const valido = f.resumo.trim().length >= 5
    && (f.tipo !== 'erro' || !!f.gravidade)
    && (f.aconteceu.trim().length >= 10 || f.livre.trim().length >= 10);

  const enviar = async () => {
    if (!valido || enviando) return;
    setErro(''); setEnviando(true);
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: f.tipo, gravidade: f.tipo === 'erro' ? f.gravidade : undefined, resumo: f.resumo, fazendo: f.fazendo,
          aconteceu: f.aconteceu, esperava: f.tipo === 'erro' ? f.esperava : '', livre: f.livre, contato: f.contato,
          tela: telaNome, rota: route, caminho: window.location.pathname, email: user.email || '',
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) setFeito({ numero: d.numero, simulado: !!d.simulado });
      else setErro(d.mensagem || 'Não foi possível enviar agora. Tente de novo em instantes.');
    } catch (e) {
      setErro('Sem conexão com o servidor. Confira a internet e tente de novo.');
    } finally { setEnviando(false); }
  };

  const rotulo = { display: 'block', fontWeight: 600, fontSize: 13, margin: '14px 0 4px' };
  const campo = { width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };

  if (feito) {
    return (
      <Modal title="Feedback enviado" onClose={onClose} width={520} footer={<Button variant="primary" size="sm" onClick={onClose}>Fechar</Button>}>
        <p style={{ marginTop: 0 }}><b>Obrigado!</b> Seu feedback foi registrado{feito.simulado ? ' (teste, nada foi criado)' : <> com o número <b>#{feito.numero}</b></>}.</p>
        <p className="vp-small" style={{ marginBottom: 0 }}>O gestor do site vai ler e, se precisar entender melhor, conversa com você antes de resolver.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Enviar feedback" onClose={onClose} width={640}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar feedback'}</Button>
      </>}>
      <div className="vp-small" style={{ background: 'rgba(245,196,0,.14)', border: '1px solid var(--vp-yellow, #F5C400)', borderRadius: 6, padding: '8px 12px' }}>
        <b>Não digite senhas nem dados de clientes</b> (nome, CNPJ, valores). Só o seu <b>primeiro nome</b> ({ajPrimeiroNome(user.email)}) vai no registro, junto com a tela em que você está: <b>{telaNome}</b>.
      </div>

      <span style={rotulo}>O que você quer enviar?</span>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        {AJ_TIPOS.map(([v, r]) => <Button key={v} size="sm" variant={f.tipo === v ? 'primary' : 'outline'} onClick={() => set('tipo', v)}>{r}</Button>)}
      </div>
      <div className="vp-small muted" style={{ marginTop: 4 }}>{AJ_TIPOS.find((t) => t[0] === f.tipo)[2]}</div>

      <label style={rotulo} htmlFor="aj-resumo">Em poucas palavras *</label>
      <input id="aj-resumo" className="input" style={campo} maxLength={100} value={f.resumo} onChange={(e) => set('resumo', e.target.value)} placeholder="Ex.: o botão Aprovar não responde"/>

      {f.tipo === 'erro' && (<>
        <label style={rotulo} htmlFor="aj-grav">O quanto isso atrapalha? *</label>
        <select id="aj-grav" className="input" style={campo} value={f.gravidade} onChange={(e) => set('gravidade', e.target.value)}>
          <option value="">Escolha…</option>
          {AJ_GRAVIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </>)}

      <label style={rotulo} htmlFor="aj-fazendo">{rot.fazendo}</label>
      <textarea id="aj-fazendo" className="input" style={campo} rows={2} maxLength={1000} value={f.fazendo} onChange={(e) => set('fazendo', e.target.value)}/>

      <label style={rotulo} htmlFor="aj-aconteceu">{rot.aconteceu} *</label>
      <textarea id="aj-aconteceu" className="input" style={campo} rows={3} maxLength={2000} value={f.aconteceu} onChange={(e) => set('aconteceu', e.target.value)} placeholder={rot.ph}/>

      {f.tipo === 'erro' && (<>
        <label style={rotulo} htmlFor="aj-esperava">O que você esperava que acontecesse?</label>
        <textarea id="aj-esperava" className="input" style={campo} rows={2} maxLength={2000} value={f.esperava} onChange={(e) => set('esperava', e.target.value)}/>
      </>)}

      <label style={rotulo} htmlFor="aj-livre">Quer acrescentar mais alguma coisa? (texto livre)</label>
      <textarea id="aj-livre" className="input" style={campo} rows={3} maxLength={3000} value={f.livre} onChange={(e) => set('livre', e.target.value)}/>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13 }}>
        <input type="checkbox" checked={f.contato} onChange={(e) => set('contato', e.target.checked)}/>
        Posso ser chamado para explicar melhor
      </label>

      {erro && <div role="alert" style={{ marginTop: 12, color: 'var(--vp-danger, #c62828)', fontWeight: 600, fontSize: 13 }}>{erro}</div>}
      <div className="vp-small muted" style={{ marginTop: 10 }}>* obrigatório. Em “O que aconteceu” ou no texto livre, escreva pelo menos 10 letras.</div>
    </Modal>
  );
}

function AjudaSuporte({ route, telaNome, ajudaTexto, tutorial }) {
  const [menu, setMenu] = React.useState(false);
  const [modal, setModal] = React.useState(null);   // 'ajuda' | 'feedback'
  React.useEffect(() => {
    if (!menu) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);
  const abrir = (qual) => { setMenu(false); setModal(qual); };
  const abrirTutorial = () => { setMenu(false); window.open('/TreinamentoVP/' + tutorial + '/', '_blank', 'noopener'); };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="header__btn" title="Suporte" aria-label="Suporte" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: '1.7px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>?</span>
      </button>
      {menu && (<>
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 900 }}/>
        <div role="menu" aria-label="Suporte" style={{ position: 'absolute', right: 0, top: 44, zIndex: 901, minWidth: 280, background: '#fff', border: '1px solid var(--border-strong, #ddd)', boxShadow: '0 8px 24px rgba(0,0,0,.18)', borderRadius: 8, padding: '6px 0' }}>
          <AjudaItem titulo="Ajuda" sub="Instrução rápida desta tela" onClick={() => abrir('ajuda')}/>
          <AjudaItem titulo="Treinamento" sub={tutorial ? 'Passo a passo com imagens (abre em nova aba)' : 'Em breve para esta tela'} disabled={!tutorial} onClick={abrirTutorial}/>
          <AjudaItem titulo="Enviar feedback" sub="Conte um erro, uma dúvida ou uma sugestão" onClick={() => abrir('feedback')}/>
        </div>
      </>)}
      {modal === 'ajuda' && <AjudaModal telaNome={telaNome} ajudaTexto={ajudaTexto} tutorial={tutorial} onClose={() => setModal(null)}/>}
      {modal === 'feedback' && <FeedbackModal telaNome={telaNome} route={route} onClose={() => setModal(null)}/>}
    </div>
  );
}

Object.assign(window, { AjudaSuporte });
