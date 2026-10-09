/* ============================================================
   inbox-historico.jsx — Inbox fase 4B (04/10/2026): busca no HISTÓRICO COMPLETO (servidor) e "Carregar mais".
   A tela só carrega os 25 últimos recebidos (read-inbox) e os 50 últimos enviados; ao pesquisar, este hook consulta
   emails_projeto inteiro (função inbox_buscar_historico, sem acento) e devolve as linhas já no formato da lista. SÓ LEITURA — não toca read-inbox,
   send-email, vínculo nem exclusão. Linhas que o banco devolve respeitam as mesmas regras de visibilidade da tela.
   window.useInboxHistorico(consulta, ativo) → { entrada, saida, carregando, truncado }
   ============================================================ */
const IH_LIMITE = 100;

/* mesmo formato que read-inbox (entrada) e que a lista de Enviados usam */
function ihNormalizar(e) {
  const saida = e.direcao === 'saida';
  return saida ? {
    id: e.id, _pasta: 'sent', _historico: true, dono: e.dono_email || null, atribuido: e.atribuido_a || null,
    from: (e.para && e.para[0]) || '', fromName: 'Para: ' + ((e.para || []).join(', ') || '—'),
    subject: e.assunto || '(sem assunto)', date: e.data_mensagem, unread: false,
    preview: (e.corpo_texto || '').slice(0, 2000), html: e.corpo_html || null,
    numeroCotacao: e.numero_cotacao, vinculoConfianca: e.vinculo_confianca, referenciaTipo: e.referencia_tipo,
    anexos: (e.anexos || []).map((a) => ({ ...a, url: a.url || null })), to: e.para || [], cc: [],
  } : {
    id: e.id, _historico: true, dono: e.dono_email || null, atribuido: e.atribuido_a || null,
    from: e.de_email || '', fromName: e.de_nome || '', subject: e.assunto || '(sem assunto)', date: e.data_mensagem || e.criado_em,
    unread: !e.lido, preview: (e.corpo_texto || '').slice(0, 2000), html: e.corpo_html || null,
    numeroCotacao: e.numero_cotacao, vinculoConfianca: e.vinculo_confianca, referenciaTipo: e.referencia_tipo,
    anexos: (e.anexos || []).map((a) => ({ ...a, url: a.url || null })), to: e.para || [], cc: [],
  };
}

function useInboxHistorico(consulta, ativo) {
  const [estado, setEstado] = React.useState({ entrada: [], saida: [], carregando: false, truncado: false });
  const f = ativo && window.InboxBusca ? window.InboxBusca.filtroServidor(consulta) : null;
  const chave = f ? JSON.stringify([f.termos, f.de, f.assunto, f.cotacao, f.depois && +f.depois, f.antes && +f.antes]) : '';
  React.useEffect(() => {
    if (!f) { setEstado((s) => (s.entrada.length || s.saida.length || s.carregando ? { entrada: [], saida: [], carregando: false, truncado: false } : s)); return undefined; }
    let vivo = true;
    setEstado((s) => ({ ...s, carregando: true }));
    const t = setTimeout(async () => {
      try {
        const sb = window.__VP_SB.sb;
        // função do banco (migration 20261004160000): ignora acento e maiúscula, só lê
        const { data, error } = await sb.rpc('inbox_buscar_historico', {
          p_termos: f.termos, p_de: f.de, p_assunto: f.assunto, p_cotacao: Number.isFinite(f.cotacao) ? f.cotacao : null,
          p_depois: f.depois ? f.depois.toISOString() : null, p_antes: f.antes ? f.antes.toISOString() : null, p_limite: IH_LIMITE });
        if (error) throw error;
        const rows = data || [];
        const paths = [...new Set(rows.flatMap((r) => (r.anexos || []).map((a) => a.path).filter(Boolean)))].slice(0, 100);
        let urls = {};
        if (paths.length) {
          try { const { data: sg, error: e2 } = await sb.functions.invoke('sign-email-anexos', { body: { paths } }); if (!e2 && sg && sg.urls) urls = sg.urls; } catch (_) { /* sem link: o anexo aparece sem download */ }
        }
        if (!vivo) return;
        const norm = rows.map((r) => ihNormalizar({ ...r, anexos: (r.anexos || []).map((a) => ({ ...a, url: (a.path && urls[a.path]) || null })) }));
        setEstado({ entrada: norm.filter((m) => m._pasta !== 'sent'), saida: norm.filter((m) => m._pasta === 'sent'), carregando: false, truncado: rows.length >= IH_LIMITE });
      } catch (e) {
        console.warn('[Inbox] busca no histórico falhou', e);
        if (vivo) setEstado({ entrada: [], saida: [], carregando: false, truncado: false });
      }
    }, 450);
    return () => { vivo = false; clearTimeout(t); };
  }, [chave]);
  return estado;
}

Object.assign(window, { useInboxHistorico });
