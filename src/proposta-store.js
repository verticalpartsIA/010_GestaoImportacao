/* ============================================================
   proposta-store.js
   Assinatura digital da Proposta Comercial — mesmo padrão de
   contrato-instalador-store.js / contrato-venda-store.js, pra reaproveitar
   a página pública unificada /assinar/:token. O cliente lê a proposta,
   assina (desenho ou nome digitado) sem login, e pode baixar sua própria
   cópia — sem precisar de nenhum cadastro separado.
   Expõe window.PropostaStore = { ... }
   ============================================================ */
(function () {
  'use strict';

  /* sb: cliente Supabase do host. No assinar.html (página pública) o cliente
     é criado inline e atribuído a window.__VP_SB.sb antes de carregar este script. */
  function sb() { return (window.__VP_SB || {}).sb; }

  /* ---------- IDs / token público ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  /* ---------- IP / UA / device (auditoria) ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }
  function deviceLabel(ua) {
    ua = ua || navigator.userAgent;
    let os = 'Desktop';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    let app = 'Navegador';
    if (/whatsapp/i.test(ua)) app = 'WhatsApp';
    else if (/edg/i.test(ua)) app = 'Edge';
    else if (/chrome/i.test(ua)) app = 'Chrome';
    else if (/firefox/i.test(ua)) app = 'Firefox';
    else if (/safari/i.test(ua)) app = 'Safari';
    return `${app} / ${os}`;
  }
  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) {
      let h = 0; for (let i = 0; i < text.length; i++) { h = (h<<5)-h+text.charCodeAt(i); h |= 0; }
      return 'fallback-' + (h>>>0).toString(16);
    }
  }

  /* ---------- Formatadores / links ---------- */
  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function signUrl(token) { return `${window.location.origin}/assinar/${encodeURIComponent(token)}`; }
  function prettyUrl(token) { return `verticalparts.com.br/assinar/${token}`; }
  function whatsAppHref(phone, message) {
    let p = (phone || '').replace(/\D/g, '');
    // Celular BR sem DDI: DDD (2) + "9" (nono dígito, prefixo de celular
    // desde 2016, sempre na 3ª posição) + 8 dígitos = 11 dígitos. Assinatura
    // específica pra não colidir com números internacionais de mesmo
    // tamanho (ex.: NANP +1 212 555 1234 vira "12125551234", 3ª posição ≠ 9).
    if (p.length === 11 && p[2] === '9') p = '55' + p;
    const base = p ? 'https://wa.me/' + p : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(message);
  }
  function mailtoHref(email, subject, body) {
    return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- Notificação interna (Geral › Notificações) ---------- */
  async function pushNotification(rec, newStatus, meta) {
    const contraparte = (rec.recipient && rec.recipient.name) || (rec.data_json && rec.data_json.cliente && rec.data_json.cliente.nome) || 'Cliente';
    if (window.VPLog) {
      const MAP = {
        enviada:     { acao: 'enviou a proposta p/ assinatura' },
        visualizada: { acao: 'cliente visualizou a proposta', ator: contraparte, setor: 'externo' },
        aprovada:    { acao: 'proposta assinada', ator: (meta && meta.signerName) || contraparte, setor: 'externo' },
        recusada:    { acao: 'assinatura da proposta recusada', ator: contraparte, setor: 'externo' },
        revisao_solicitada: { acao: 'cliente pediu revisão da proposta', ator: contraparte, setor: 'externo' },
      };
      const m = MAP[newStatus];
      if (m) window.VPLog.registrar({
        ator_nome: m.ator, ator_setor: m.setor,
        modulo: 'Proposta Comercial', acao: m.acao,
        alvo: rec.numero_documento, alvo_id: rec.id,
        detalhe: meta && meta.channel ? { canal: meta.channel } : null,
      });
    }
    try {
      const map = {
        enviada:     { level: 'info',    title: `Proposta ${rec.numero_documento} enviada`, sub: `Para ${(rec.recipient && rec.recipient.name) || ''} · canal ${meta && meta.channel ? (meta.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail') : '—'}` },
        visualizada: { level: 'warning', title: `Proposta ${rec.numero_documento} foi VISUALIZADA`, sub: `Aberta por ${(rec.recipient && rec.recipient.name) || ''} · ${meta && meta.ip ? 'IP ' + meta.ip + ' · ' : ''}${fmtDateTime(Date.now())}` },
        aprovada:    { level: 'info',    title: `Proposta ${rec.numero_documento} ASSINADA`, sub: `Por ${meta && meta.signerName ? meta.signerName : ''} · ${meta && meta.ip ? 'IP ' + meta.ip : ''}` },
        recusada:    { level: 'danger',  title: `Proposta ${rec.numero_documento} foi RECUSADA`, sub: `Recusada pelo cliente em ${fmtDateTime(Date.now())}` },
        revisao_solicitada: { level: 'warning', title: `Proposta ${rec.numero_documento} — cliente pediu revisão`, sub: (meta && meta.texto) ? meta.texto.slice(0, 140) : `Em ${fmtDateTime(Date.now())}` },
      };
      const cfg = map[newStatus];
      if (!cfg) return;
      const c = sb(); if (!c) return;
      await c.from('alertas').insert({
        id: 'prop-' + uuid(), level: cfg.level, title: cfg.title, sub: cfg.sub, module: 'Comercial', resolved: false,
      });
    } catch (e) { console.warn('[PropostaStore] notification failed', e); }
  }

  /* ---------- CRUD mínimo pra assinatura ---------- */
  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('*').eq('id', id).maybeSingle();
    return data || null;
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  /* Garante um token público estável (não regenera se já existir). */
  async function garantirToken(id) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const cur = await getById(id);
    if (!cur) throw new Error('Proposta não encontrada');
    if (cur.token) return cur.token;
    const token = shortToken();
    const { error } = await c.from('propostas').update({ token }).eq('id', id);
    if (error) throw error;
    return token;
  }

  /* ---------- Publicar = congelar a versão oficial ----------
     Tira uma cópia imutável do data_json. A página de assinatura passa a
     mostrar (e o hash da assinatura a cobrir) essa cópia, não o rascunho
     vivo — assim o cliente não assina algo diferente do que leu. Publicar
     de novo incrementa a versão. */
  async function publicar(id) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const cur = await getById(id);
    if (!cur) throw new Error('Proposta não encontrada');
    if (!cur.data_json || !Object.keys(cur.data_json).length) {
      throw new Error('Salve a proposta antes de publicar.');
    }
    const now = new Date().toISOString();
    const jaPublicada = !!cur.publicado_em;
    const versao = jaPublicada ? (Number(cur.version) || 1) + 1 : (Number(cur.version) || 1);
    const log = (cur.log || []).slice();
    log.push({ status: 'publicada', at: now, meta: { versao } });
    const patch = {
      versao_publicada: cur.data_json,
      publicado_em: now,
      publicado_por: (window.__VP_USER || {}).email || null,
      version: versao,
      log,
      atualizado_em: now,
    };
    const { error } = await c.from('propostas').update(patch).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Proposta Comercial',
      acao: jaPublicada ? `republicou a proposta (v${versao})` : `publicou a proposta (v${versao})`,
      alvo: cur.numero_documento, alvo_id: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* O que o cliente deve ver: a versão publicada quando existir; senão,
     o rascunho (compatível com propostas antigas, nunca publicadas). */
  function conteudoVigente(rec) {
    if (!rec) return {};
    return rec.versao_publicada || rec.data_json || {};
  }

  /* Marca como enviado (gera notificação interna).
     Primeiro envio publica automaticamente (congela versao_publicada) —
     assim o cliente sempre lê uma versão congelada, sem exigir que o
     vendedor lembre de clicar em "Publicar" antes de enviar. Reenvios de
     uma proposta JÁ publicada não republicam sozinhos: se o vendedor editou
     depois de publicar, republicar é ação explícita ("Republicar"), pra não
     trocar silenciosamente o que o cliente vai ler. */
  async function markSent(id, channel, recipient) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const now = new Date();
    const expires = new Date(now.getTime() + 7*24*3600*1000);
    const log = (cur.log || []).slice();
    log.push({ status:'enviada', at: now.toISOString(), meta:{ channel } });
    const primeiraPublicacao = !cur.publicado_em;
    if (primeiraPublicacao) log.push({ status:'publicada', at: now.toISOString(), meta:{ versao: Number(cur.version) || 1, automatica: true } });
    const patch = {
      status: 'enviada', channel, recipient: recipient || cur.recipient || {},
      sent_at: now.toISOString(), expires_at: expires.toISOString(),
      enviada_em: cur.enviada_em || now.toISOString(),
      ...(primeiraPublicacao ? {
        versao_publicada: cur.data_json,
        publicado_em: now.toISOString(),
        publicado_por: (window.__VP_USER || {}).email || null,
        version: Number(cur.version) || 1,
      } : {}),
      log, atualizado_em: now.toISOString(),
    };
    await c.from('propostas').update(patch).eq('id', id);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'enviada', { channel });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'PROPOSTA_ENVIADA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id, detalhe: { channel },
    });
    return updated;
  }

  /* Página pública chama no mount. Só avança enviada→visualizada, nunca regride. */
  async function markViewed(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviada') return cur;

    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const audit = { ...(cur.audit || {}), viewedAt: now.toISOString(), viewIp: ip, viewUa: ua, viewDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status:'visualizada', at: now.toISOString(), meta:{ ip, ua } });
    const patch = { status: 'visualizada', viewed_at: now.toISOString(), audit, log, atualizado_em: now.toISOString() };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'visualizada', { ip });
    return updated;
  }

  /* Marca como assinada (status 'aprovada' — já existia na tabela). sig = { type:'draw'|'type', data, signerName } */
  async function markSigned(token, sig) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    /* O hash cobre EXATAMENTE o que o cliente leu (a versão publicada),
       não o rascunho vivo — senão editar depois do envio invalidava a
       correspondência entre documento lido e documento assinado. */
    const assinado = conteudoVigente(cur);
    const hash = await sha256Hex(JSON.stringify(assinado) + '|' + (sig.signerName || ''));
    const audit = {
      ...(cur.audit || {}),
      signedAt: now.toISOString(), signIp: ip, signUa: ua, signDevice: device,
      signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data,
      consent: true, hash,
      // Deixa registrado QUAL versão foi assinada (auditoria).
      versaoAssinada: cur.publicado_em ? (Number(cur.version) || 1) : null,
      assinouRascunho: !cur.publicado_em,
    };
    const log = (cur.log || []).slice();
    log.push({ status:'aprovada', at: now.toISOString(), meta:{ ip, ua, hash } });
    const patch = {
      status: 'aprovada', signed_at: now.toISOString(), aprovada_em: now.toISOString(),
      audit, log, atualizado_em: now.toISOString(),
    };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'aprovada', { ip, signerName: sig.signerName });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
      detalhe: { resposta: 'aprovada', signerName: sig.signerName },
    });
    /* Cliente aprovou → dispara a aprovação do CEO pra comprar o
       equipamento, bem antes do contrato assinado ou do sinal pago
       (pedido do usuário em 15/08 — equipamentos caros demais pra deixar
       sem aprovação). O "start" real da compra fica travado até os outros
       gatilhos também liberarem — ver DecisoesStore.verificarGateCompra,
       checado na criação da P.I. */
    if (window.DecisoesStore && updated.numero_cotacao != null) {
      window.DecisoesStore.podeComprarEquipamento(updated.numero_cotacao, {
        proposta: updated.titulo || updated.numero_documento,
      }).catch((e) => console.warn('[PropostaStore] podeComprarEquipamento falhou', e));
    }
    /* Cliente assinou = a venda aconteceu — é o único gatilho de conversão
       do Lead em Cliente (decisão 21/08: visita, workshop, cotação, proposta
       enviada... nada disso converte, só mantém o Lead em qualificação).
       Rastreia numero_cotacao -> formularios_elevador.lead_id -> leads —
       só existe esse vínculo quando o Formulário nasceu do "Criar Cotação
       China" (comercial.jsx); formulário criado direto, sem Lead, não tem
       o que converter, e tudo aqui é best-effort (não trava a assinatura). */
    if (updated.numero_cotacao != null) {
      (async () => {
        try {
          const { data: form } = await c.from('formularios_elevador').select('lead_id').eq('numero_cotacao', updated.numero_cotacao).maybeSingle();
          if (!form?.lead_id) return;
          const { data: leadRow } = await c.from('leads').select('id, building, contact, phone, email').eq('id', form.lead_id).maybeSingle();
          if (!leadRow) return;
          const { error: errLead } = await c.from('leads').update({ status: 'Convertido' }).eq('id', leadRow.id);
          if (errLead) { console.warn('[PropostaStore] falha ao marcar lead como Convertido', errLead); return; }
          if (window.CadastrosClientesStore) await window.CadastrosClientesStore.criarOuVincularDeLead(leadRow);
        } catch (e) { console.warn('[PropostaStore] falha ao converter lead em cliente', e); }
      })();
    }
    return updated;
  }

  async function refuse(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date();
    const log = (cur.log || []).slice();
    log.push({ status:'recusada', at: now.toISOString() });
    const patch = { status: 'recusada', log, atualizado_em: now.toISOString() };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'recusada', {});
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
      detalhe: { resposta: 'recusada' },
    });
    return updated;
  }

  /* ---------- Pedido de revisão ----------
     Terceira saída da página pública, além de aprovar/recusar (pedido do
     usuário, 19/08): o cliente ainda não recusou, só quer ajuste (preço,
     acabamento, prazo...) — texto livre, sem sugestões prontas na tela
     (ex.: nunca oferecer "desconto" como opção, isso o cliente pede por
     fora se quiser). Volta pro vendedor decidir/renegociar e reenviar;
     markSent já recoloca em 'enviada' normalmente, sem tratamento especial. */
  async function solicitarRevisao(token, texto) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const txt = String(texto || '').trim();
    if (!txt) throw new Error('Descreva o que você gostaria de revisar.');
    const now = new Date();
    const log = (cur.log || []).slice();
    log.push({ status: 'revisao_solicitada', at: now.toISOString(), meta: { texto: txt } });
    const patch = {
      status: 'revisao_solicitada', revisao_texto: txt, revisao_solicitada_em: now.toISOString(),
      log, atualizado_em: now.toISOString(),
    };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'revisao_solicitada', { texto: txt });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
      detalhe: { resposta: 'revisao_solicitada', texto: txt },
    });
    return updated;
  }

  /* ---------- Criar/atualizar (rascunho) ----------
     Movido de proposta-editor.jsx (revisão de arquitetura 18/08, candidato
     2): o store nunca fazia insert(), só update() — quem montava a linha,
     resolvia vendedor_id e decidia insert-vs-update era o componente de
     UI. Agora o store é dono da forma da linha, igual aos outros stores
     já revisados nesta sessão. */

  /* vendedor_id aponta pra public.perfis; a identidade vem do SSO (e-mail).
     Cacheado por sessão — não faz sentido consultar a cada salvamento. */
  let _vendedorIdCache;
  async function resolverVendedorId() {
    if (_vendedorIdCache !== undefined) return _vendedorIdCache;
    const email = (window.__VP_USER || {}).email;
    if (!email || !sb()) { _vendedorIdCache = null; return null; }
    try {
      const { data } = await sb().from('perfis').select('id').eq('email', email).maybeSingle();
      _vendedorIdCache = data ? data.id : null;
    } catch (e) { _vendedorIdCache = null; }
    return _vendedorIdCache;
  }

  /* Escopo de visibilidade — "quem vê proposta de quem" precisa ser
     configurável por botão em Configurações do Sistema (aba Permissões),
     nunca uma lista de e-mails fixa no código: gente troca de função e
     ninguém pode ficar dependendo de uma sessão de IA pra atualizar isso.
     Regra: Administrador (perfis.nivel) sempre vê tudo; qualquer outra
     pessoa só vê tudo se tiver linha 'todas' em proposta_visibilidade_escopo
     — ausência de linha = só vê as próprias (mesma convenção "sem linha =
     padrão" já usada no Portal Admin pra module_permissions). */
  let _escopoCache;
  function resetEscopoVisibilidadeCache() { _escopoCache = undefined; }
  async function resolverEscopoVisibilidade() {
    if (_escopoCache !== undefined) return _escopoCache;
    const c = sb();
    const email = (window.__VP_USER || {}).email;
    const aberto = { vendedorId: null, veTudo: true };
    if (!email || !c) { _escopoCache = aberto; return aberto; }
    try {
      const { data: perfil } = await c.from('perfis').select('id, nivel').eq('email', email).maybeSingle();
      if (!perfil) { _escopoCache = aberto; return aberto; }
      if (perfil.nivel === 'Administrador') {
        _escopoCache = { vendedorId: perfil.id, veTudo: true };
        return _escopoCache;
      }
      const { data: escopo } = await c.from('proposta_visibilidade_escopo').select('escopo').eq('perfil_id', perfil.id).maybeSingle();
      _escopoCache = { vendedorId: perfil.id, veTudo: escopo?.escopo === 'todas' };
    } catch (e) { _escopoCache = aberto; }
    return _escopoCache;
  }

  /* data/eq: o shape completo do editor (cliente/obra/elevador|escada|
     esteira/...). valorTotal: calculado pelo editor (calcularValorTotal),
     que já entende o shape por equipamento — o store não precisa saber
     como somar preço × quantidade de 3 formatos diferentes.
     Retorna { id, token } da linha salva, ou { erro } em falha — nunca
     lança, quem chama decide o que fazer com o erro (toast, etc). */
  async function salvar({ data, eq, editId, valorTotal }) {
    const c = sb(); if (!c) return { erro: 'Sem conexão com o sistema.' };
    // Evita poluir a tabela real com rascunhos em branco: só persiste com cliente.
    if (!data?.cliente?.nome?.trim()) return { erro: 'Preencha o nome do cliente para salvar.' };

    const vpUser = window.__VP_USER || {};
    const chave = (data.numero || '').trim() || null; // → numero_documento (texto)
    try {
      const payload = {
        numero_documento: chave,
        proposal_type: eq,
        titulo: [data.cliente?.nome, data.obra?.nome].filter(Boolean).join(' · ') || chave,
        data_json: { ...data, _vp_user: { email: vpUser.email || null, nome: vpUser.nome || null } },
        master_id: data.masterId || null,
        precificacao_id: data.precificacaoId || null,
        valor_total: valorTotal,
        numero_cotacao: window.MasterIdEngine.parseNumeroCotacao(data.numeroCotacao),
        atualizado_em: new Date().toISOString(),
      };

      /* vendedor_id é NOT NULL — só mandamos quando resolve, pra um update
         não apagar o vendedor que já estava gravado. */
      const vendedorId = await resolverVendedorId();
      if (vendedorId) payload.vendedor_id = vendedorId;

      // Alvo do update: se veio de "Editar" (editId), usa o id diretamente;
      // senão, chave de negócio = numero_documento (texto). O `numero` (int)
      // é auto-sequencial no banco, então não o enviamos no insert. Status
      // só é definido na CRIAÇÃO — salvar de novo não regride o status de
      // uma proposta já enviada/assinada.
      let existing = editId ? { id: editId } : null;
      if (!existing && chave) {
        const { data: rows } = await c.from('propostas').select('id')
          .eq('numero_documento', chave).order('criado_em', { ascending: false }).limit(1);
        existing = rows && rows[0];
      }

      if (existing?.id) {
        const { data: row, error } = await c.from('propostas').update(payload).eq('id', existing.id).select('id, token').single();
        if (error) throw error;
        return row;
      } else {
        const { data: row, error } = await c.from('propostas').insert([{ ...payload, status: 'rascunho' }]).select('id, token').single();
        if (error) throw error;
        if (window.EventosFluxo) window.EventosFluxo.registrar({
          evento: 'PROPOSTA_ELABORADA', numeroCotacao: payload.numero_cotacao,
          alvoLabel: payload.titulo, alvoId: row.id,
        });
        return row;
      }
    } catch (e) {
      // Antes o erro era engolido e o usuário via "salva localmente" — uma
      // falha total (ex.: not-null de vendedor_id) parecia sucesso parcial.
      console.error('PropostaStore.salvar falhou:', e);
      return { erro: e.message || String(e) };
    }
  }

  window.PropostaStore = {
    uuid, shortToken, getPublicIP,
    fmtDateTime, signUrl, prettyUrl, whatsAppHref, mailtoHref,
    getById, getByToken, garantirToken,
    publicar, conteudoVigente,
    markSent, markViewed, markSigned, refuse, solicitarRevisao,
    salvar,
    resolverEscopoVisibilidade, resetEscopoVisibilidadeCache,
  };
}());
