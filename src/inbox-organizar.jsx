/* ============================================================
   inbox-organizar.jsx — Marcadores, Suspender e Spam do Inbox (04/10/2026, fase 4A). Regras puras: inbox-organizar-calc.js.
     - useInboxMarcadores(emails)     → marcadores visíveis (pessoais meus + da equipe), quais e-mails têm quais, criar/apagar/aplicar
     - inboxMarcarSpam(ids, marcar)   → spam COMPARTILHADO; a trava (sem cotação/documento) vale no banco também (filtros do update)
     - InboxModalMarcador             → "Novo marcador" (nome, cor, só meu / da equipe, organizar dentro de)
     - InboxMenuSuspender             → hoje à tarde / amanhã / segunda / escolher data e hora
     - InboxMenuMarcadores            → aplicar marcadores ou "Mover para" (aplica e arquiva)
     - InboxSecaoMarcadores           → seção "Marcadores" da sidebar
   Nomes globais com prefixo IO_ para não colidir com os outros arquivos (scripts clássicos compartilham o escopo).
   ============================================================ */
const IO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useInboxMarcadores(emails) {
  const eu = String((window.__VP_USER || {}).email || '').toLowerCase();
  const [dados, setDados] = React.useState({ marcadores: [], porEmail: {}, pronto: false });
  const [versao, setVersao] = React.useState(0);
  const chave = (emails || []).map((e) => e.id).filter((id) => IO_UUID.test(String(id))).sort().join(',');
  React.useEffect(() => {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb || !window.InboxOrganizar) { setDados({ marcadores: [], porEmail: {}, pronto: true }); return; }
    let vivo = true;
    (async () => {
      const [rm, rv] = await Promise.all([
        sb.from('inbox_marcadores').select('id, nome, cor, escopo, dono_email, pai_id').order('nome'),
        chave ? sb.from('inbox_email_marcador').select('email_id, marcador_id').in('email_id', chave.split(',')) : Promise.resolve({ data: [] }),
      ]);
      if (!vivo) return;
      const porEmail = {};
      (rv.data || []).forEach((v) => { (porEmail[v.email_id] = porEmail[v.email_id] || []).push(v.marcador_id); });
      setDados({ marcadores: window.InboxOrganizar.marcadoresVisiveis(rm.data || [], eu), porEmail, pronto: true });
    })().catch(() => { if (vivo) setDados({ marcadores: [], porEmail: {}, pronto: true }); });     // sem marcadores a tela funciona como sempre
    return () => { vivo = false; };
  }, [chave, versao, eu]);

  const recarregar = React.useCallback(() => setVersao((v) => v + 1), []);

  /* devolve null se deu certo, ou o texto do erro */
  const criar = React.useCallback(async ({ nome, cor, escopo, paiId }) => {
    const sb = window.__VP_SB.sb;
    const { error } = await sb.from('inbox_marcadores').insert({ nome: String(nome || '').trim(), cor: cor || '#64748b', escopo, dono_email: eu, pai_id: paiId || null });
    if (error) return error.code === '23505' ? 'Já existe um marcador com esse nome.' : (error.message || 'Erro ao criar o marcador.');
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: 'Criou marcador', alvo: String(nome).trim(), detalhe: { escopo } });
    recarregar();
    return null;
  }, [eu, recarregar]);

  const apagar = React.useCallback(async (id) => {
    const sb = window.__VP_SB.sb;
    const { error } = await sb.from('inbox_marcadores').delete().eq('id', id);          // os vínculos caem junto; os e-mails ficam intactos
    if (error) return error.message || 'Erro ao apagar o marcador.';
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: 'Apagou marcador', alvo_id: id });
    recarregar();
    return null;
  }, [recarregar]);

  /* aplicar(ids, marcadorId, sim) — liga ou desliga o marcador nesses e-mails. Atualização otimista. */
  const aplicar = React.useCallback(async (emailIds, marcadorId, sim) => {
    const sb = window.__VP_SB.sb;
    const ids = (emailIds || []).filter((id) => IO_UUID.test(String(id)));
    if (!ids.length) return null;
    setDados((d) => {
      const porEmail = { ...d.porEmail };
      ids.forEach((id) => {
        const atual = new Set(porEmail[id] || []);
        if (sim) atual.add(marcadorId); else atual.delete(marcadorId);
        porEmail[id] = [...atual];
      });
      return { ...d, porEmail };
    });
    const { error } = sim
      ? await sb.from('inbox_email_marcador').upsert(ids.map((id) => ({ email_id: id, marcador_id: marcadorId, aplicado_por: eu })), { onConflict: 'email_id,marcador_id', ignoreDuplicates: true })
      : await sb.from('inbox_email_marcador').delete().in('email_id', ids).eq('marcador_id', marcadorId);
    if (error) { recarregar(); return error.message || 'Erro ao aplicar o marcador.'; }
    return null;
  }, [eu, recarregar]);

  return { ...dados, recarregar, criar, apagar, aplicar };
}

/* Spam COMPARTILHADO. A trava vale também no banco: só e-mail de ENTRADA sem cotação e sem documento é alterado
   (o update filtra por isso), mesmo que a tela se engane. Devolve quantos foram de fato alterados. */
async function inboxMarcarSpam(ids, marcar) {
  const sb = window.__VP_SB.sb;
  const eu = String((window.__VP_USER || {}).email || '').toLowerCase();
  const lista = (ids || []).filter((id) => IO_UUID.test(String(id)));
  if (!lista.length) return 0;
  const q = sb.from('emails_projeto');
  const { data, error } = marcar
    ? await q.update({ spam_em: new Date().toISOString(), spam_por: eu }).in('id', lista).eq('direcao', 'entrada').is('numero_cotacao', null).is('referencia_id', null).select('id')
    : await q.update({ spam_em: null, spam_por: null }).in('id', lista).select('id');
  if (error) throw error;
  if (window.VPLog) window.VPLog.registrar({ modulo: 'Inbox de E-mail', acao: marcar ? 'Marcou como spam' : 'Tirou do spam', alvo: `${(data || []).length} e-mail(s)` });
  return (data || []).length;
}

/* ---------- Novo marcador ---------- */
function InboxModalMarcador({ marcadores, caps, onCriar, onClose }) {
  const O = window.InboxOrganizar;
  const [nome, setNome] = React.useState('');
  const [cor, setCor] = React.useState(O.CORES[0]);
  const [escopo, setEscopo] = React.useState('pessoal');
  const [paiId, setPaiId] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const podeEquipe = O.podeCriarMarcador('equipe', caps);
  const paiOpcoes = O.arvoreMarcadores(marcadores.filter((m) => m.escopo === escopo));          // o marcador "filho" precisa ter o mesmo alcance do "pai"
  const salvar = async () => {
    if (!nome.trim()) { setErro('Dê um nome ao marcador.'); return; }
    setSalvando(true); setErro('');
    const e = await onCriar({ nome, cor, escopo, paiId: paiId || null });
    setSalvando(false);
    if (e) setErro(e); else onClose();
  };
  return (
    <Modal title="Novo marcador" onClose={onClose} width={440}
      footer={<div className="row gap-2"><Button variant="primary" disabled={salvando} onClick={salvar}>{salvando ? 'Criando…' : 'Criar'}</Button><Button variant="ghost" onClick={onClose}>Cancelar</Button></div>}>
      <div className="stack" style={{ gap: 10 }}>
        <input className="input" autoFocus placeholder="Nome do marcador (ex.: Aguardando fornecedor)" value={nome} maxLength={60}
          onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()}/>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="small muted">Cor</span>
          {O.CORES.map((c) => <span key={c} className={'io-cor' + (cor === c ? ' on' : '')} style={{ background: c }} onClick={() => setCor(c)} title={c}/>)}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <label className="io-opcao"><input type="radio" name="io-escopo" checked={escopo === 'pessoal'} onChange={() => { setEscopo('pessoal'); setPaiId(''); }}/> Só meu <span className="muted small">— só você vê este marcador</span></label>
          <label className="io-opcao" style={{ opacity: podeEquipe ? 1 : .5 }}>
            <input type="radio" name="io-escopo" disabled={!podeEquipe} checked={escopo === 'equipe'} onChange={() => { setEscopo('equipe'); setPaiId(''); }}/> Da equipe <span className="muted small">— {podeEquipe ? 'todos que veem o e-mail veem o marcador' : 'exige a alçada de triagem ou “vê tudo”'}</span>
          </label>
        </div>
        <label className="small muted">Organizar marcador dentro de</label>
        <select className="input" value={paiId} onChange={(e) => setPaiId(e.target.value)}>
          <option value="">(nenhum — marcador principal)</option>
          {paiOpcoes.map((m) => <option key={m.id} value={m.id}>{'— '.repeat(m.nivel) + m.nome}</option>)}
        </select>
        {erro ? <div className="small" style={{ color: 'var(--vp-danger)' }}>{erro}</div> : null}
      </div>
    </Modal>
  );
}

/* ---------- Suspender ---------- */
function InboxMenuSuspender({ onEscolher, desabilitado }) {
  const [aberto, setAberto] = React.useState(false);
  const [livre, setLivre] = React.useState('');
  const opcoes = aberto ? window.InboxOrganizar.opcoesAdiar(new Date()) : [];
  const fmt = (d) => d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const escolher = (quando) => { setAberto(false); setLivre(''); onEscolher(quando); };
  return (
    <div className="ig-menu" style={{ display: 'inline-block' }}>
      <Button variant="ghost" size="sm" icon="clock" disabled={desabilitado} onClick={() => setAberto((a) => !a)}>Suspender</Button>
      {aberto && (<><div className="ig-backdrop" onClick={() => setAberto(false)}/>
        <div className="ig-menu__lista" style={{ left: 0, right: 'auto', top: 34, minWidth: 260 }}>
          <div className="small muted" style={{ padding: '4px 16px' }}>Voltar à Caixa de entrada em…</div>
          {opcoes.map((o) => <div key={o.id} className="ig-menu__item" onClick={() => escolher(o.quando)}>{o.rotulo} <span className="muted small">— {fmt(o.quando)}</span></div>)}
          <div style={{ padding: '6px 16px 8px' }}>
            <input className="input" type="datetime-local" value={livre} onChange={(e) => setLivre(e.target.value)}/>
            <Button variant="outline" size="sm" disabled={!livre || new Date(livre) <= new Date()} onClick={() => escolher(new Date(livre))} style={{ marginTop: 6 }}>Escolher data e hora</Button>
          </div>
        </div></>)}
    </div>
  );
}

/* ---------- Marcadores / Mover para ---------- */
function InboxMenuMarcadores({ rotulo, icone, marcadores, estadoDe, onEscolher, onNovo, desabilitado }) {
  const [aberto, setAberto] = React.useState(false);
  const arvore = window.InboxOrganizar.arvoreMarcadores(marcadores);
  return (
    <div className="ig-menu" style={{ display: 'inline-block' }}>
      <Button variant="ghost" size="sm" icon={icone} disabled={desabilitado} onClick={() => setAberto((a) => !a)}>{rotulo}</Button>
      {aberto && (<><div className="ig-backdrop" onClick={() => setAberto(false)}/>
        <div className="ig-menu__lista" style={{ left: 0, right: 'auto', top: 34, minWidth: 250, maxHeight: 320, overflowY: 'auto' }}>
          {arvore.length === 0 && <div className="small muted" style={{ padding: '8px 16px' }}>Você ainda não tem marcadores.</div>}
          {arvore.map((m) => {
            const st = estadoDe(m.id);
            return (
              <div key={m.id} className="ig-menu__item io-item" style={{ paddingLeft: 12 + m.nivel * 14 }} onClick={() => { onEscolher(m, st); }}>
                <input type="checkbox" readOnly checked={st === 'todos'} ref={(el) => { if (el) el.indeterminate = st === 'alguns'; }}/>
                <span className="io-bolinha" style={{ background: m.cor }}/> {m.nome}
                {m.escopo === 'equipe' ? <span className="muted small"> · equipe</span> : null}
              </div>
            );
          })}
          <div className="ig-menu__item" style={{ borderTop: '1px solid var(--border)' }} onClick={() => { setAberto(false); onNovo(); }}>＋ Criar novo marcador</div>
        </div></>)}
    </div>
  );
}

/* ---------- Sidebar: seção Marcadores ---------- */
function InboxSecaoMarcadores({ arvore, pasta, onAbrir, onNovo, contagem, podeGerir, onApagar }) {
  return (
    <>
      <div className="inbox__folders-sep io-sep">
        <span>Marcadores</span>
        <span className="io-mais" title="Criar marcador" onClick={onNovo}>＋</span>
      </div>
      {arvore.length === 0 && <div className="small muted" style={{ padding: '2px 24px' }}>Nenhum ainda. Clique em ＋.</div>}
      {arvore.map((m) => (
        <div key={m.id} className={'inbox__folder io-marcador ' + (pasta === 'm:' + m.id ? 'is-active' : '')} style={{ paddingLeft: 24 + m.nivel * 14 }} onClick={() => onAbrir('m:' + m.id)}
          title={m.escopo === 'equipe' ? 'Marcador da equipe' : 'Só seu'}>
          <span className="io-bolinha" style={{ background: m.cor }}/>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
          {contagem(m.id) ? <span className="count">{contagem(m.id)}</span> : null}
          {podeGerir(m) ? <span className="io-apagar" title="Apagar marcador" onClick={(ev) => { ev.stopPropagation(); onApagar(m); }}>×</span> : null}
        </div>
      ))}
    </>
  );
}

/* ---------- Chips coloridos na linha ---------- */
function InboxChipsMarcadores({ ids, porId }) {
  return (ids || []).map((id) => porId[id]).filter(Boolean).map((m) => (
    <span key={m.id} className="io-chip" style={{ background: m.cor + '22', color: m.cor, borderColor: m.cor + '66' }} title={m.escopo === 'equipe' ? 'Marcador da equipe' : 'Marcador seu'}>{m.nome}</span>
  ));
}

Object.assign(window, { useInboxMarcadores, inboxMarcarSpam, InboxModalMarcador, InboxMenuSuspender, InboxMenuMarcadores, InboxSecaoMarcadores, InboxChipsMarcadores });
