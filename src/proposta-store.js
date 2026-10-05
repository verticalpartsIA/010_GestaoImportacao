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
        recusada:    { acao: 'assinatura da proposta recusada' + (meta && meta.motivo ? ` — Motivo: ${meta.motivo}` : ''), ator: (meta && meta.nome) || contraparte, setor: 'externo' },
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
        recusada:    { level: 'danger',  title: `Proposta ${rec.numero_documento} foi RECUSADA`, sub: `Recusada por ${(meta && meta.nome) || contraparte} em ${fmtDateTime(Date.now())}${meta && meta.motivo ? ' — Motivo: ' + meta.motivo : ''}` },
        revisao_solicitada: { level: 'warning', title: `Proposta ${rec.numero_documento} — cliente pediu revisão`, sub: (meta && meta.texto) ? meta.texto.slice(0, 140) : `Em ${fmtDateTime(Date.now())}` },
      };
      const cfg = map[newStatus];
      if (!cfg) return;
      const c = sb(); if (!c) return;
      await c.from('alertas').insert({
        id: 'prop-' + uuid(), level: cfg.level, title: cfg.title, sub: cfg.sub, module: 'Comercial', resolved: false,
        rota: rec.id ? '/comercial/proposta-editor/' + encodeURIComponent(String(rec.id)) : null,   // abre ESTA proposta no editor
      });
    } catch (e) { console.warn('[PropostaStore] notification failed', e); }
  }

  /* ---------- CRUD mínimo pra assinatura ---------- */
  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('*').eq('id', id).maybeSingle();
    return data || null;
  }
  /* Segurança real (#571, Fase 3/Task 9): a página pública (/assinar/:token) fala com o banco por RPC `public_proposta_*`
     (recebem só o TOKEN e mexem só naquele registro; a regra de status e a troca da modalidade 120×90 são decididas no
     servidor). Interruptor de emergência: localStorage.vp_public_rpc = 'off' volta ao caminho antigo (update direto na
     tabela). Se a RPC falhar por rede/erro, cada função cai no caminho antigo (enquanto as tabelas ainda estão abertas). */
  function usarRpcPublica() {
    try { return localStorage.getItem('vp_public_rpc') !== 'off'; } catch (e) { return true; }
  }
  const MSG_RPC = {
    link_invalido: 'Link inválido ou expirado.',
    expirada: 'Esta proposta expirou.',
    nome_obrigatorio: 'Informe o seu nome para assinar.',
    escolha_obrigatoria: 'Escolha a modalidade de entrega (120 ou 90 dias) para aprovar a proposta.',
    texto_obrigatorio: 'Descreva o que você gostaria de revisar.',
  };
  function erroDaRpc(res) {
    const e = res && res.erro;
    if (MSG_RPC[e]) return new Error(MSG_RPC[e]);
    if (e && String(e).indexOf('status_') === 0) return new Error('Esta proposta não está mais disponível para esta ação (situação atual: ' + String(e).slice(7) + ').');
    return new Error('Não foi possível concluir a ação. Tente novamente.');
  }
  async function chamarRpcPublica(c, nome, args) {
    try {
      const { data, error } = await c.rpc(nome, args);
      if (error) { console.warn('[PropostaStore] RPC ' + nome + ' falhou — usando caminho antigo', error); return { falhou: true }; }
      return { data };
    } catch (e) { console.warn('[PropostaStore] RPC ' + nome + ' indisponível — usando caminho antigo', e); return { falhou: true }; }
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_proposta_obter', { p_token: token });
      if (!r.falhou) return r.data || null;
    }
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

  /* ---------- Tipo de equipamento (eq) de uma proposta ----------
     NÃO confie em `proposal_type`: das 311 propostas, 290 (as importadas
     do sistema antigo) têm esse campo NULO, e as 21 restantes gravaram em
     3 formatos diferentes ("elevador", "Elevador de Passageiros",
     "Escada Rolante"). Como todo mundo fazia `proposal_type || 'elevador'`,
     16 propostas de Escada e 23 de Esteira abriam e geravam PDF com o
     layout de ELEVADOR (achado 21/08, conferindo título x campo no banco).

     Ordem de confiança:
       1) o conteúdo já convertido — se tem .escada/.esteira preenchido,
          é isso e ponto (o conversor legado sabe distinguir, só não
          contava pra ninguém);
       2) proposal_type normalizado (aceita os 3 formatos gravados);
       3) o título ("... - Escada"), última pista das legadas;
       4) elevador como padrão. */
  function normalizarEq(valor) {
    const t = String(valor || '').toLowerCase();
    if (!t) return null;
    if (t.includes('escada')) return 'escada';
    if (t.includes('esteira') || t.includes('rolante esteira')) return 'esteira';
    if (t.includes('elevador')) return 'elevador';
    if (t === 'escalator') return 'escada';
    if (t === 'walkway') return 'esteira';
    return null;
  }

  /* Critério deliberadamente ESTREITO: só conta como "tem equipamento" se
     houver UNIDADE cadastrada. É o mesmo critério do conversor legado
     (`if (!unidades.length) return null`), e é o único seguro aqui: toda
     proposta nova nasce com os três equipamentos preenchidos de textos
     padrão (garantia, condições...), então qualquer teste mais frouxo
     acusaria "tem escada" numa proposta de elevador. */
  function temUnidade(o) {
    if (!o || typeof o !== 'object') return false;
    const u = o.especificacoes || o.unidades;
    return Array.isArray(u) && u.length > 0;
  }

  function resolverEq(rec, dadosConvertidos) {
    const d = dadosConvertidos;
    if (d) {
      /* MESMA ORDEM do converterPropostaLegado (elevador → escada →
         esteira). Inverter aqui daria resultado diferente do conversor
         nas legadas, que trazem os 3 blocos no mesmo registro. */
      if (temUnidade(d.elevador)) return 'elevador';
      if (temUnidade(d.escada)) return 'escada';
      if (temUnidade(d.esteira)) return 'esteira';
    }
    return normalizarEq(rec && rec.proposal_type)
      || normalizarEq(rec && rec.titulo)
      || 'elevador';
  }

  /* Conteúdo pronto pra renderizar: converte o formato legado quando
     preciso e devolve junto o eq correto. Antes disto só o editor
     convertia — a página pública /assinar entregava o formato antigo
     cru pro PEPreview, que não o entende. */
  function conteudoRenderizavel(rec) {
    const bruto = conteudoVigente(rec);
    const legado = !!(window.PropostaLegado && window.PropostaLegado.ehPropostaSchemaLegado(bruto));
    const data = legado
      ? window.PropostaLegado.converterPropostaLegado(bruto, rec && rec.titulo)
      : bruto;
    return { data, eq: resolverEq(rec, data), legado };
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
    /* 23/08 (Dossiê PCB §9.6): reenvio depois de revisão ACEITA é um
       desfecho distinto de "primeiro envio" — fecha PROPOSTA_REVISADA_
       REENVIO em vez de nascer AGUARDA_CLIENTE do zero (esse já existe
       e reabre sozinho pelo mesmo CLIENTE_RESPONDEU_PROPOSTA de sempre).
       Só conta como reenvio-pós-revisão se a revisão foi ACEITA — reenviar
       sem decisão registrada (recusada_interna nunca chega aqui, o editor
       não deixa editar) continua dando PROPOSTA_ENVIADA normal. */
    const foiRevisaoAceita = cur.status === 'revisao_solicitada' && cur.revisao_decisao === 'aceita';
    const now = new Date();
    const expires = new Date(now.getTime() + 7*24*3600*1000);
    const log = (cur.log || []).slice();
    log.push({ status:'enviada', at: now.toISOString(), meta:{ channel, apos_revisao: foiRevisaoAceita || undefined } });
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
    const { error } = await c.from('propostas').update(patch).eq('id', id);
    if (error) throw error;
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'enviada', { channel });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: foiRevisaoAceita ? 'PROPOSTA_REENVIADA' : 'PROPOSTA_ENVIADA', numeroCotacao: updated.numero_cotacao,
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
    /* 28/09 — achado real (mesmo padrão do erro engolido em send-email):
       este update nunca checava `.error`. Diferente de markSent/markSigned/
       refuse (ações explícitas com toast/alert no chamador), este roda
       sozinho no mount da página pública sem nenhum tratamento de erro do
       lado de quem chama (assinar-app.jsx) — lançar aqui prenderia o
       cliente pra sempre em "Carregando…" por uma falha só de auditoria.
       Best-effort de propósito: loga pra suporte investigar, nunca trava
       a leitura da proposta pelo cliente. */
    let updated = null;
    let viaRpc = false;   // via RPC o aviso (alertas) e a auditoria (vp_logs) já são gravados NO BANCO (Task 10)
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_proposta_visualizada', { p_token: token, p_audit: { viewUa: ua, viewDevice: device, viewIp: ip } });
      if (!r.falhou && r.data && r.data.ok && r.data.rec) { updated = r.data.rec; viaRpc = true; }
    }
    if (!updated) {
      const { error } = await c.from('propostas').update(patch).eq('token', token);
      if (error) console.warn('[PropostaStore] falha ao registrar visualização (best-effort, não bloqueia o cliente)', error);
      updated = { ...cur, ...patch };
    }
    if (!viaRpc) await pushNotification(updated, 'visualizada', { ip });
    return updated;
  }

  /* Cascata pós-assinatura (eventos/gatilhos, decisão do CEO, Dossiê, Lead→Cliente). Segurança real (#571, Task 10): ela
     NÃO roda mais no navegador do cliente — a RPC `public_proposta_assinar` enfileira em `fluxo_pendentes` e um usuário
     interno logado a executa (src/fluxo-pendentes.js chama esta MESMA função, então a regra é uma só). O caminho antigo
     (RPC indisponível) ainda a chama inline. Cada passo é best-effort e isolado; devolve a lista de falhas. */
  async function executarEfeitosAssinatura(updated, meta) {
    const c = sb();
    const falhas = [];
    const signerName = meta && meta.signerName;
    const passo = async (nome, fn) => { try { await fn(); } catch (e) { falhas.push(nome + ': ' + ((e && e.message) || e)); console.warn('[PropostaStore] ' + nome + ' falhou', e); } };
    await passo('evento', async () => {
      if (!window.EventosFluxo) return;
      await window.EventosFluxo.registrar({
        evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
        alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
        detalhe: { resposta: 'aprovada', signerName, ...(meta && meta.modalidadeEntrega ? { modalidadeEntrega: meta.modalidadeEntrega } : {}) },
        atorNome: signerName || 'Cliente (assinatura pública)',
      });
    });
    /* Cliente aprovou → dispara a aprovação do CEO pra comprar o equipamento (só quando a margem sai da regra), bem antes
       do contrato assinado ou do sinal pago (pedido do usuário em 15/08). O "start" real da compra fica travado até os
       outros gatilhos também liberarem — ver DecisoesStore.verificarGateCompra, checado na criação da P.I. */
    await passo('decisão do CEO', async () => {
      if (window.DecisoesStore && updated.numero_cotacao != null) {
        await window.DecisoesStore.podeComprarEquipamento(updated.numero_cotacao, { proposta: updated.titulo || updated.numero_documento, origem_cliente: true });
      }
    });
    /* Proposta ganha → Dossiê da Obra nasce sozinho (pedido do usuário 19/08). */
    await passo('dossiê', async () => {
      if (window.__DOSSIER && updated.numero_cotacao != null) await window.__DOSSIER.criarDeProposta(updated);
    });
    /* Cliente assinou = a venda aconteceu — é o único gatilho de conversão do Lead em Cliente (decisão 21/08). Rastreia
       numero_cotacao -> formularios_elevador.lead_id -> leads; formulário sem Lead não tem o que converter. */
    await passo('lead→cliente', async () => {
      if (updated.numero_cotacao == null) return;
      const { data: form } = await c.from('formularios_elevador').select('lead_id').eq('numero_cotacao', updated.numero_cotacao).maybeSingle();
      if (!form?.lead_id) return;
      const { data: leadRow } = await c.from('leads').select('id, building, contact, phone, email').eq('id', form.lead_id).maybeSingle();
      if (!leadRow) return;
      const { error: errLead } = await c.from('leads').update({ status: 'Convertido' }).eq('id', leadRow.id);
      if (errLead) throw errLead;
      if (window.CadastrosClientesStore) await window.CadastrosClientesStore.criarOuVincularDeLead(leadRow);
    });
    return falhas;
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
    /* Duas modalidades de entrega (120 × 90 dias — ver proposta-opcoes.js): com as duas
       na proposta, o cliente PRECISA escolher uma pra aprovar; a escolha entra no hash e
       na trilha de auditoria. Proposta sem opção (caso de sempre) não muda em nada. */
    const O = window.PropostaOpcoes;
    const escolha = sig && sig.opcaoEntrega;
    if (O && O.temOpcoes(assinado) && escolha !== '120' && escolha !== '90') {
      throw new Error('Escolha a modalidade de entrega (120 ou 90 dias) para aprovar a proposta.');
    }
    const escolhaValida = O && O.temOpcao90(assinado) && (escolha === '120' || escolha === '90') ? escolha : null;
    const hash = await sha256Hex(JSON.stringify(assinado) + (escolhaValida ? '|opcao:' + escolhaValida : '') + '|' + (sig.signerName || ''));
    const audit = {
      ...(cur.audit || {}),
      ...(escolhaValida ? { opcaoEntrega: escolhaValida } : {}),
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
    /* Modalidade escolhida vira o preço OFICIAL da proposta (é o que Contrato, Aval e
       dashboards herdam): troca os campos de valor nos dados (rascunho e versão
       publicada) e atualiza valor_total. A opção não escolhida fica guardada, só não aparece. */
    if (escolhaValida) {
      const aplicadoRascunho = O.aplicarEscolha(cur.data_json, escolhaValida);
      patch.data_json = aplicadoRascunho;
      if (cur.versao_publicada) patch.versao_publicada = O.aplicarEscolha(cur.versao_publicada, escolhaValida);
      if (escolhaValida === '90') {
        const total = O.totalOficial(aplicadoRascunho || cur.versao_publicada || {});
        if (total > 0) patch.valor_total = total;
      }
    }
    let updated = null;
    let viaRpc = false;
    if (usarRpcPublica()) {
      /* O servidor decide status/valores/troca da modalidade e carimba hora e IP; daqui só vão os dados da assinatura. */
      const r = await chamarRpcPublica(c, 'public_proposta_assinar', {
        p_token: token,
        p_opcao: escolhaValida || null,
        p_audit: {
          signUa: ua, signDevice: device, signIp: ip, signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data,
          hash, versaoAssinada: audit.versaoAssinada, assinouRascunho: audit.assinouRascunho,
        },
      });
      if (!r.falhou) {
        if (!r.data || !r.data.ok) throw erroDaRpc(r.data);
        updated = r.data.rec; viaRpc = true;
      }
    }
    if (!updated) {
      const { error } = await c.from('propostas').update(patch).eq('token', token);
      if (error) throw error;
      updated = { ...cur, ...patch };
    }
    if (viaRpc) return updated;   // aviso/auditoria já gravados no banco; a cascata abaixo roda pela fila (src/fluxo-pendentes.js) — Task 10
    await pushNotification(updated, 'aprovada', { ip, signerName: sig.signerName });
    executarEfeitosAssinatura(updated, { signerName: sig.signerName, modalidadeEntrega: escolhaValida ? escolhaValida + ' dias' : null });
    return updated;
  }

  /* 01/10 — mesmo achado real do Contrato de Venda (cotação 955/AKAI):
     recusa não registrava quem recusou nem por quê. Agora recebe
     { nome, motivo } de `assinar-app.jsx` e grava com IP/dispositivo,
     mesmo padrão de auditoria de `markViewed`/`markSigned`. */
  async function refuse(token, info) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date();
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const nome = ((info && info.nome) || '').trim() || null;
    const motivo = ((info && info.motivo) || '').trim() || null;
    const audit = { ...(cur.audit || {}), refusedAt: now.toISOString(), refusedBy: nome, refusedReason: motivo, refuseIp: ip, refuseUa: ua, refuseDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status:'recusada', at: now.toISOString(), meta:{ nome, motivo, ip } });
    const patch = { status: 'recusada', log, audit, atualizado_em: now.toISOString() };
    let updated = null;
    let viaRpc = false;
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_proposta_recusar', { p_token: token, p_nome: nome, p_motivo: motivo, p_audit: { refuseUa: ua, refuseDevice: device, refuseIp: ip } });
      if (!r.falhou) {
        if (!r.data || !r.data.ok) throw erroDaRpc(r.data);
        updated = r.data.rec; viaRpc = true;
      }
    }
    if (!updated) {
      const { error } = await c.from('propostas').update(patch).eq('token', token);
      if (error) throw error;
      updated = { ...cur, ...patch };
    }
    if (viaRpc) return updated;   // aviso/auditoria no banco; o evento roda pela fila (src/fluxo-pendentes.js)
    await pushNotification(updated, 'recusada', { nome, motivo });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
      detalhe: { resposta: 'recusada', nome, motivo },
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
    let updated = null;
    let viaRpc = false;
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_proposta_revisao', { p_token: token, p_texto: txt });
      if (!r.falhou) {
        if (!r.data || !r.data.ok) throw erroDaRpc(r.data);
        updated = r.data.rec; viaRpc = true;
      }
    }
    if (!updated) {
      const { error } = await c.from('propostas').update(patch).eq('token', token);
      if (error) throw error;
      updated = { ...cur, ...patch };
    }
    if (viaRpc) return updated;   // aviso/auditoria no banco; o evento roda pela fila (src/fluxo-pendentes.js)
    await pushNotification(updated, 'revisao_solicitada', { texto: txt });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CLIENTE_RESPONDEU_PROPOSTA', numeroCotacao: updated.numero_cotacao,
      alvoLabel: updated.titulo || updated.numero_documento, alvoId: updated.id,
      detalhe: { resposta: 'revisao_solicitada', texto: txt },
    });
    return updated;
  }

  /* ---------- Decisão INTERNA da VerticalParts sobre a revisão pedida ----------
     23/08 (achado do Dossiê PCB, §9.6): antes disso, "cliente pediu revisão"
     e "vendedor decide o que fazer" eram a mesma ação implícita — não tinha
     decisão formal, nem distinção entre "revisão aceitável" e "cliente
     pediu algo fora do combinado". Nunca confundir com recusar() acima:
     aquilo é o CLIENTE recusando a proposta original; isto é a
     VERTICALPARTS recusando um PEDIDO DE AJUSTE do cliente.
     `aceita=true`: só registra a decisão, o vendedor edita e reenvia
     normalmente (markSent, mais abaixo, fecha o ciclo).
     `aceita=false`: motivo é obrigatório, encerra o ciclo de revisão —
     a proposta ORIGINAL continua o que está valendo (não é uma recusa da
     proposta em si, só do pedido de ajuste). */
  async function decidirRevisao(id, aceita, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Proposta não encontrada.');
    if (cur.status !== 'revisao_solicitada') throw new Error('Esta proposta não está com revisão pendente.');
    if (!aceita && !(motivo || '').trim()) throw new Error('Descreva o motivo da recusa interna.');
    const now = new Date();
    const patch = {
      revisao_decisao: aceita ? 'aceita' : 'recusada_interna',
      revisao_decidida_em: now.toISOString(),
      revisao_decidida_por: (window.__VP_USER || {}).email || null,
      motivo_recusa_interna: aceita ? null : motivo.trim(),
      atualizado_em: now.toISOString(),
    };
    const { error } = await c.from('propostas').update(patch).eq('id', id);
    if (error) throw error;
    const updated = { ...cur, ...patch };
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Proposta Comercial', acao: aceita ? 'aceitou a revisão pedida pelo cliente' : 'recusou internamente a revisão pedida',
      alvo: updated.numero_documento, alvo_id: id, detalhe: aceita ? null : { motivo: patch.motivo_recusa_interna },
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: aceita ? 'VERTICALPARTS_ACEITOU_REVISAO' : 'VERTICALPARTS_RECUSOU_REVISAO',
      numeroCotacao: updated.numero_cotacao, alvoLabel: updated.titulo || updated.numero_documento, alvoId: id,
      detalhe: aceita ? null : { motivo: patch.motivo_recusa_interna },
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

  /* ---------- Alçadas ----------
     Sistema genérico de permissões delegáveis (pedido do usuário, 19/08):
     nada de lista de e-mail fixa no código nem regra que só eu consigo
     mudar. Cada linha em alcadas_capacidade é "esta pessoa TEM esta
     capacidade neste módulo" — ausência de linha = não tem (mesma
     convenção "sem linha = padrão" do Portal Admin). A capacidade
     especial modulo='admin' capacidade='conceder_alcadas' é recursiva:
     quem tem ela pode conceder QUALQUER capacidade pra QUALQUER pessoa,
     inclusive conceder essa mesma capacidade pra outra pessoa — é assim
     que Diego/Gelson repassam o poder pra Bianca/Juliana/Guilherme sem
     precisar de código novo. Administrador (perfis.nivel) sempre tem
     todas as capacidades — não dá pra se autoexcluir por engano. */
  let _perfilAtualCache;
  async function resolverPerfilAtual() {
    if (_perfilAtualCache !== undefined) return _perfilAtualCache;
    const c = sb();
    const email = (window.__VP_USER || {}).email;
    if (!email || !c) { _perfilAtualCache = null; return null; }
    try {
      const { data } = await c.from('perfis').select('id, nivel, nome, email').eq('email', email).maybeSingle();
      _perfilAtualCache = data || null;
    } catch (e) { _perfilAtualCache = null; }
    return _perfilAtualCache;
  }

  const _capacidadeCache = {};
  function resetAlcadasCache() { _perfilAtualCache = undefined; Object.keys(_capacidadeCache).forEach((k) => delete _capacidadeCache[k]); }
  async function temCapacidade(modulo, capacidade) {
    const perfil = await resolverPerfilAtual();
    if (!perfil) return false;
    if (perfil.nivel === 'Administrador') return true;
    const chave = modulo + '.' + capacidade;
    if (_capacidadeCache[chave] !== undefined) return _capacidadeCache[chave];
    const c = sb();
    try {
      const { data } = await c.from('alcadas_capacidade').select('id')
        .eq('perfil_id', perfil.id).eq('modulo', modulo).eq('capacidade', capacidade).maybeSingle();
      _capacidadeCache[chave] = !!data;
    } catch (e) { _capacidadeCache[chave] = false; }
    return _capacidadeCache[chave];
  }
  async function podeConcederAlcadas() { return temCapacidade('admin', 'conceder_alcadas'); }

  /* Escopo de visibilidade de Propostas — agora é só mais uma capacidade
     (modulo='propostas', capacidade='ver_todas') dentro do sistema geral
     de alçadas acima. Nome da função mantido (chamado por precificacao.jsx). */
  function resetEscopoVisibilidadeCache() { resetAlcadasCache(); }
  async function resolverEscopoVisibilidade() {
    const perfil = await resolverPerfilAtual();
    if (!perfil) return { vendedorId: null, veTudo: true };
    const veTudo = await temCapacidade('propostas', 'ver_todas');
    return { vendedorId: perfil.id, veTudo };
  }

  /* Painel de administração (Configurações do Sistema › Alçadas) — lista
     todo mundo com o que já tem concedido, pra montar a grade de toggles. */
  async function listarAlcadas() {
    const c = sb(); if (!c) return { perfis: [], concedidas: [] };
    const [{ data: perfis }, { data: concedidas }] = await Promise.all([
      c.from('perfis').select('id, nome, email, nivel, departamento, ativo').eq('ativo', true).order('nome'),
      c.from('alcadas_capacidade').select('perfil_id, modulo, capacidade'),
    ]);
    return { perfis: perfis || [], concedidas: concedidas || [] };
  }
  async function concederAlcada(perfilId, modulo, capacidade, conceder) {
    const c = sb(); if (!c) return;
    if (conceder) {
      const por = (window.__VP_USER || {}).email || null;
      await c.from('alcadas_capacidade').upsert(
        { perfil_id: perfilId, modulo, capacidade, concedido_por: por, concedido_em: new Date().toISOString() },
        { onConflict: 'perfil_id,modulo,capacidade' },
      );
    } else {
      await c.from('alcadas_capacidade').delete().eq('perfil_id', perfilId).eq('modulo', modulo).eq('capacidade', capacidade);
    }
    resetAlcadasCache();
  }

  /* ---------- Trava por aprovação ----------
     Cliente aprovou = editor trava pro vendedor. Quem tem a capacidade
     'destravar_aprovada' pode reabrir — fica editável até o próximo
     Salvar, que retrava sozinho (não fica aberto pra sempre). */
  async function destravar(id) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const por = (window.__VP_USER || {}).email || null;
    const now = new Date().toISOString();
    const { error } = await c.from('propostas').update({ destravada_em: now, destravada_por: por }).eq('id', id);
    if (error) throw error;
    return { destravada_em: now, destravada_por: por };
  }

  /* Excluir — pedido do usuário 19/08, fase de muito teste no ar: precisa
     de um jeito rápido de limpar propostas de teste. Gate pela mesma
     alçada 'excluir' (módulo 'propostas'), não hardcoded — quem não tem
     não passa daqui, mesmo chamando a função direto. Hard delete mesmo
     (não é soft-delete) — é exatamente o que a fase de teste pede. */
  async function excluir(id) {
    const pode = await temCapacidade('propostas', 'excluir');
    if (!pode) throw new Error('Você não tem a alçada "Excluir" em Propostas.');
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const { error } = await c.from('propostas').delete().eq('id', id);
    if (error) throw error;
    return true;
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
      /* Trava por aprovação: editar uma proposta aprovada exige destrave
         prévio (capacidade 'destravar_aprovada'). Checagem aqui, não só na
         UI — quem chama salvar() direto não deveria conseguir passar por
         cima do botão desabilitado. Ao salvar, retrava sozinho na hora. */
      let destravadaAgora = false;
      if (editId) {
        const { data: atual } = await c.from('propostas').select('status, destravada_em').eq('id', editId).maybeSingle();
        if (atual && atual.status === 'aprovada' && !atual.destravada_em) {
          return { erro: 'Proposta aprovada está travada para edição. Peça destrave a quem tem essa alçada.' };
        }
        if (atual && atual.destravada_em) destravadaAgora = true;
      }
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
        ...(destravadaAgora ? { destravada_em: null, destravada_por: null } : {}),
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

      /* precificacao_id pendurado: um rascunho salvo no navegador (ver
         "rascunho salvo automaticamente" no editor) pode carregar um
         precificacaoId de uma herança antiga cuja Precificação foi
         apagada do banco depois — a proposta nunca mais salva, sempre
         com "violates foreign key constraint propostas_precificacao_id_
         fkey" (achado 20/08, cotação-teste 903). Em vez de travar o
         vendedor pra sempre, se o vínculo estiver morto salva sem ele
         (a proposta continua completa, só perde o rastreio automático
         até a Precificação) e avisa quem chamou. */
      const ehFkPrecificacaoMorta = (err) => /precificacao_id_fkey/i.test(err?.message || '');
      let precificacaoOrfa = false;

      /* Trava (02/10, cotação 982): um Nº de cotação digitado ANTES de a cotação
         andar virou "Proposta elaborada" de verdade, pulou Fornecedor e
         Precificação na linha do tempo e colou a proposta de outro vendedor na
         cotação do Vagner. Proposta de elevador só pode ficar ligada a um Nº que
         já tenha Precificação OU que tenha sido enviado direto pra Precificação
         (preço combinado por fora, formulario-elevador.jsx). Só confere quando
         é proposta NOVA ou o Nº mudou — propostas antigas já ligadas continuam
         salvando normalmente. */
      if (payload.numero_cotacao != null) {
        let numeroAnterior = null;
        if (existing?.id) {
          const { data: ant } = await c.from('propostas').select('numero_cotacao').eq('id', existing.id).maybeSingle();
          numeroAnterior = ant ? ant.numero_cotacao : null;
        }
        if (!existing?.id || numeroAnterior !== payload.numero_cotacao) {
          /* Um Nº de cotação, uma proposta por tipo de equipamento — outra
             pessoa não pode "pegar" o Nº de uma proposta que já existe. */
          const { data: dup, error: dupErr } = await c.from('propostas')
            .select('id, numero_documento').eq('numero_cotacao', payload.numero_cotacao).eq('proposal_type', eq).limit(1);
          if (dupErr) throw dupErr;
          if (dup && dup.length && dup[0].id !== existing?.id) {
            return { erro: `A cotação Nº ${payload.numero_cotacao} já tem a proposta ${dup[0].numero_documento}. Abra essa proposta em vez de criar outra com o mesmo Nº.` };
          }
          if (eq === 'elevador') {
            const { data: precif, error: precifErr } = await c.from('precificacoes_elevador')
              .select('id').eq('numero_cotacao', payload.numero_cotacao).limit(1);
            if (precifErr) throw precifErr;
            let liberada = !!(precif && precif.length);
            if (!liberada) {
              const { data: diretos, error: diretoErr } = await c.from('formularios_elevador')
                .select('id').eq('numero_cotacao', payload.numero_cotacao)
                .not('envio_direto_precificacao_em', 'is', null).limit(1);
              if (diretoErr) throw diretoErr;
              liberada = !!(diretos && diretos.length);
            }
            if (!liberada) {
              return { erro: `A cotação Nº ${payload.numero_cotacao} ainda não tem Precificação (o fornecedor precisa responder e o Financeiro precificar antes). Apague o Nº da cotação pra salvar como rascunho solto, ou confira o número.` };
            }
          } else {
            /* Escada/esteira não têm Precificação própria no sistema: o mínimo
               é o Nº existir de verdade (ter nascido de um Formulário). */
            const { data: form, error: formErr } = await c.from('formularios_elevador')
              .select('id').eq('numero_cotacao', payload.numero_cotacao).limit(1);
            if (formErr) throw formErr;
            if (!form || !form.length) {
              return { erro: `A cotação Nº ${payload.numero_cotacao} não existe (nenhum Formulário com esse número). Confira o número ou deixe em branco.` };
            }
          }
        }
      }

      if (existing?.id) {
        let { data: row, error } = await c.from('propostas').update(payload).eq('id', existing.id).select('id, token').single();
        if (error && ehFkPrecificacaoMorta(error)) {
          precificacaoOrfa = true;
          ({ data: row, error } = await c.from('propostas').update({ ...payload, precificacao_id: null }).eq('id', existing.id).select('id, token').single());
        }
        if (error) throw error;
        return { ...row, precificacaoOrfa };
      } else {
        let { data: row, error } = await c.from('propostas').insert([{ ...payload, status: 'rascunho' }]).select('id, token').single();
        if (error && ehFkPrecificacaoMorta(error)) {
          precificacaoOrfa = true;
          ({ data: row, error } = await c.from('propostas').insert([{ ...payload, precificacao_id: null, status: 'rascunho' }]).select('id, token').single());
        }
        if (error) throw error;
        if (window.EventosFluxo) window.EventosFluxo.registrar({
          evento: 'PROPOSTA_ELABORADA', numeroCotacao: payload.numero_cotacao,
          alvoLabel: payload.titulo, alvoId: row.id,
        });
        return { ...row, precificacaoOrfa };
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
    publicar, conteudoVigente, conteudoRenderizavel, resolverEq, normalizarEq,
    markSent, markViewed, markSigned, refuse, solicitarRevisao, decidirRevisao,
    executarEfeitosAssinatura,
    salvar,
    resolverEscopoVisibilidade, resetEscopoVisibilidadeCache,
    resolverPerfilAtual, temCapacidade, podeConcederAlcadas, resetAlcadasCache,
    listarAlcadas, concederAlcada, destravar, excluir,
  };
}());
