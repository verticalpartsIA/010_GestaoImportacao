/* ============================================================
   contrato-venda-store.js
   Persistência do Contrato de Venda de Equipamentos no vpprd.
   Tabela: contratos_venda_equipamentos. Prefixo: VPVE.
   Expõe window.CVStore = { ... }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() {
    const a = uuid().split('-').join('');
    return a.slice(0, 16);
  }

  /* ---------- Auditoria (IP / UA / device / hash) ---------- */
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

  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : '—'; }
  function relative(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff/60000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m/60); if (h < 24) return `há ${h} h`;
    const d = Math.floor(h/24); return `há ${d} d`;
  }
  function signUrl(token) {
    return `${window.location.origin}/assinar/${encodeURIComponent(token)}`;
  }
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

  const STATUS = {
    rascunho:    { id:'rascunho',    label:'Rascunho',    icon:'📝', tone:'gray',   order:0 },
    enviado:     { id:'enviado',     label:'Enviado',     icon:'📤', tone:'blue',   order:1 },
    visualizado: { id:'visualizado', label:'Visualizado', icon:'👁',  tone:'yellow', order:2 },
    aguardando_signatarios: { id:'aguardando_signatarios', label:'Aguardando outras assinaturas', icon:'✍', tone:'yellow', order:3 },
    assinado:    { id:'assinado',    label:'Assinado',    icon:'✍',  tone:'green',  order:4 },
    expirado:    { id:'expirado',    label:'Expirado',    icon:'⚠',  tone:'red',    order:4 },
    recusado:    { id:'recusado',    label:'Recusado',    icon:'✕',  tone:'red',    order:4 },
  };

  /* ---------- Notificações em alertas (Geral › Notificações) ---------- */
  async function pushNotification(rec, newStatus, meta) {
    /* Espelha no registro central (Admin > Logs) */
    if (window.VPLog) {
      const contraparte = (rec.recipient && rec.recipient.name) || rec.responsavel_nome || rec.comprador_razao_social || 'Contraparte';
      const MAP = {
        enviado:     { acao: 'enviou p/ assinatura' },
        visualizado: { acao: 'contraparte visualizou', ator: contraparte, setor: 'externo' },
        assinado:    { acao: 'contrato assinado', ator: (meta && meta.signerName) || contraparte, setor: 'externo' },
        assinado_representante: { acao: 'representante assinou — aguardando outros signatários (sócios/jurídico)', ator: (meta && meta.signerName) || contraparte, setor: 'externo' },
        recusado:    { acao: 'assinatura recusada', ator: contraparte, setor: 'externo' },
        expirado:    { acao: 'link de assinatura expirou', ator: 'Sistema', setor: 'sistema' },
      };
      const m = MAP[newStatus];
      if (m) window.VPLog.registrar({
        ator_nome: m.ator, ator_setor: m.setor,
        modulo: 'Contrato Venda', acao: m.acao,
        alvo: rec.numero_documento, alvo_id: rec.id,
        detalhe: meta && meta.channel ? { canal: meta.channel } : null,
      });
    }
    try {
      const num = rec.numero_documento;
      const titularNome = (rec.recipient && rec.recipient.name) || rec.responsavel_nome || rec.comprador_razao_social || '';
      const map = {
        enviado:     { level: 'info',    title: `Contrato venda ${num} enviado`,                 sub: `Para ${titularNome} · canal ${meta && meta.channel ? (meta.channel === 'whatsapp' ? 'WhatsApp' : meta.channel === 'email' ? 'E-mail' : 'Link') : '—'}` },
        visualizado: { level: 'warning', title: `Contrato venda ${num} foi VISUALIZADO`,         sub: `Aberto por ${titularNome} · ${meta && meta.ip ? 'IP ' + meta.ip + ' · ' : ''}${fmtDateTime(Date.now())}` },
        assinado:    { level: 'info',    title: `Contrato venda ${num} ASSINADO`,                sub: `Por ${meta && meta.signerName ? meta.signerName : titularNome} · ${meta && meta.ip ? 'IP ' + meta.ip : ''}` },
        assinado_representante: { level: 'info', title: `Contrato venda ${num} — representante assinou`, sub: `Aguardando outros signatários (sócios/jurídico) para concluir · ${meta && meta.signerName ? meta.signerName : titularNome}` },
        recusado:    { level: 'danger',  title: `Contrato venda ${num} foi RECUSADO`,            sub: `Recusado pelo destinatário em ${fmtDateTime(Date.now())}` },
        expirado:    { level: 'warning', title: `Contrato venda ${num} EXPIROU`,                 sub: `Link aguardando assinatura por 7 dias sem retorno` },
      };
      const cfg = map[newStatus];
      if (!cfg) return;
      const c = sb(); if (!c) return;
      await c.from('alertas').insert({
        id: 'cv-' + uuid(),
        level: cfg.level,
        title: cfg.title,
        sub: cfg.sub,
        module: 'Jurídico',
        resolved: false,
      });
    } catch (e) { console.warn('[CVStore] notification failed', e); }
  }

  /* ---------- CRUD ---------- */
  async function listAll() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('contratos_venda_equipamentos')
      .select('*')
      .not('token', 'is', null)            // só os criados pelo novo fluxo
      .order('criado_em', { ascending: false });
    if (error) { console.warn('[CVStore] list error', error); return []; }
    return data || [];
  }
  /* Cria (ou reaproveita) o Dossier da Obra exigido pelo Passo 5 — Revisão.
     O fluxo Formulário → Fornecedor → Precificação → Proposta nunca passa
     pelo pipeline de Leads (onde o Dossier normalmente nasce, ver
     dossier-store.js), então sem isto o contrato ficava permanentemente
     bloqueado em "Contrato deve estar vinculado a um Dossier da Obra" — não
     havia NENHUM jeito na UI de vincular um (achado E2E). Cria um dossiê
     real com os dados já preenchidos no wizard, em vez de travar o usuário. */
  async function garantirDossier(formState) {
    if (formState.dossier_id) return formState.dossier_id;
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    /* Reaproveita o Dossiê que já existe pra esta cotação — a assinatura da
       Proposta já cria um (DossierStore.criarDeProposta, idempotente por
       numero_cotacao). Antes esta função só olhava formState.dossier_id (sempre
       null no assistente), então criava um SEGUNDO dossiê pra mesma cotação, o
       que quebra buscas por numero_cotacao (ex.: Linha do Tempo). */
    const numeroCotacaoExistente = window.MasterIdEngine?.parseNumeroCotacao?.(formState.masterId) ?? null;
    if (numeroCotacaoExistente != null) {
      const { data: existentes } = await c.from('dossier_obra').select('id')
        .eq('numero_cotacao', numeroCotacaoExistente).order('created_at', { ascending: true }).limit(1);
      if (existentes && existentes.length) return existentes[0].id;
    }
    /* Cidade/UF: preferem os campos estruturados herdados da obra; senão
       extrai do texto "rua, nº, bairro, cidade, UF" — só o ÚLTIMO trecho
       antes da UF é a cidade (antes a rua e o número iam junto pro campo
       cidade). */
    const localObra = String(formState.localObra || '').replace(/,?\s*CEP\b.*$/i, '').trim();
    const m = localObra.match(/^(.*?)[\s,/-]+([A-Za-z]{2})$/);
    const cidadeTexto = m ? m[1].split(',').pop().trim() : (localObra || null);
    const city = (formState.obraCidade && String(formState.obraCidade).trim()) || cidadeTexto || null;
    const state = ((formState.obraUf && String(formState.obraUf).trim()) || (m ? m[2] : '') || '').toUpperCase() || null;
    const equipMap = { ELEVADOR: 'elevador', ESCADA: 'escada', ESTEIRA: 'esteira' };
    const id = 'DOS-' + Date.now().toString(36).toUpperCase();
    // numero_cotacao é a chave que o resto da esteira usa pra correlacionar
    // (Formulário/Cotação Fornecedor/Precificação/Proposta/Aval/Importação) —
    // sem ela o Dossiê fica ilha, incapaz de somar sinais de outros módulos
    // pro checklist de "obra pronta" (issue #9).
    const numeroCotacao = window.MasterIdEngine?.parseNumeroCotacao?.(formState.masterId) ?? null;
    const rec = {
      id,
      client_name: formState.comprador.razao || 'Cliente sem nome',
      building_name: formState.masterId ? `Obra ${formState.masterId}` : (formState.comprador.razao || 'Obra sem nome'),
      city, state,
      equip_type: equipMap[formState.tipoEquip] || 'elevador',
      status_master: 'Dossier criado',
      numero_cotacao: numeroCotacao,
      created_by: (window.__VP_USER || {}).email || null,
    };
    const { error } = await c.from('dossier_obra').insert(rec);
    if (error) throw error;
    return id;
  }

  /* Propostas ASSINADAS que ainda não têm contrato — a fila "aguardando
     contrato" do Painel. O contrato não nasce sozinho (precisa do aval do
     Financeiro antes de fechar — ver createDraft/podeEnviarContrato), então
     sem isto uma proposta aceita ficava invisível aqui e o Painel mostrava
     "0 contratos" mesmo com venda ganha (achado E2E reteste B). */
  async function listarPropostasAguardandoContrato() {
    const c = sb(); if (!c) return [];
    const { data: assinadas } = await c.from('propostas')
      .select('id, master_id, numero_documento, titulo, valor_total, data_json, aprovada_em')
      .eq('status', 'aprovada').order('aprovada_em', { ascending: false }).limit(50);
    if (!assinadas || !assinadas.length) return [];
    const { data: contratos } = await c.from('contratos_venda_equipamentos').select('proposta_id');
    const comContrato = new Set((contratos || []).map((x) => x.proposta_id).filter(Boolean));
    return assinadas.filter((p) => !comContrato.has(p.id));
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contratos_venda_equipamentos').select('*').eq('id', id).maybeSingle();
    return data || null;
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contratos_venda_equipamentos').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  /* Contrato de Venda não guarda numero_cotacao direto — só dá pra
     correlacionar em eventos_fluxo indo buscar na Proposta de origem. */
  async function numeroCotacaoDaProposta(propostaId) {
    if (!propostaId) return null;
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('numero_cotacao').eq('id', propostaId).maybeSingle();
    return data ? data.numero_cotacao : null;
  }

  /* Primeiro livre entre base, base-2, base-3… */
  function proximoNumeroLivre(base, usados) {
    const set = new Set(usados || []);
    if (!set.has(base)) return base;
    let n = 2;
    while (set.has(base + '-' + n)) n++;
    return base + '-' + n;
  }

  /* Cria rascunho. Gera VPVE numero_documento via RPC */
  async function createDraft(formState, opts) {
    opts = opts || {};
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');

    // Gate: Financeiro precisa ter dado o aval (consultou score + aprovou a
    // venda) antes do contrato poder nem ser gerado — ver aval-financeiro-store.js.
    if (window.AvalFinanceiroStore && formState.propostaId) {
      const gate = await window.AvalFinanceiroStore.podeEnviarContrato(formState.propostaId);
      if (!gate.ok) throw new Error(gate.motivo);
    }

    const { data: numRows, error: numErr } = await c.rpc('next_doc_number', { p_prefixo: 'VPVE' });
    if (numErr) throw numErr;
    const num = (Array.isArray(numRows) ? numRows[0] : numRows) || {};
    /* Nº exibido (revisão 27/08): reaproveita o Nº da Cotação da Proposta de
       origem (VPCV-0950), em vez da sequência mensal própria "VPVE-...".
       seq_mes/ano_mes continuam vindo do RPC — só usados pro id legado
       (idText abaixo), não mudam. Sem propostaId (raro/legado), mantém o
       número gerado pelo RPC como está. */
    const numeroCotacaoOrigem = await numeroCotacaoDaProposta(formState.propostaId);
    if (numeroCotacaoOrigem != null) {
      /* numero_documento é UNIQUE: um 2º contrato da mesma cotação (aditivo,
         ex.: equipamento especial ≥ 1000 kg) batia na constraint com erro
         técnico. Agora ganha sufixo -2, -3… (parseNumeroCotacao continua
         extraindo o mesmo Nº da cotação). */
      const base = window.MasterIdEngine.etapaId('contrato_venda', numeroCotacaoOrigem);
      const { data: usados } = await c.from('contratos_venda_equipamentos').select('numero_documento').ilike('numero_documento', base + '%');
      num.numero_documento = proximoNumeroLivre(base, (usados || []).map((r) => r.numero_documento));
    }

    const valor = window.CV.parseMoney(formState.valor);
    const doc = window.CV.buildContract({
      form: formState, comprador: formState.comprador,
      valor, sinalPct: formState.sinalPct, parcelas: formState.parcelas,
      numero: num.numero_documento,
    });
    const titulo = doc.titulo;
    const objetoResumo = window.CV.descEquipamento(formState);

    const idText = 'CVE-' + num.seq_mes + '/' + num.ano_mes; // id text PK legado
    const rec = {
      id: idText,
      numero_documento: num.numero_documento,
      seq_mes: num.seq_mes,
      ano_mes: num.ano_mes,
      token: shortToken(),
      titulo,
      comprador_razao_social: formState.comprador.razao,
      comprador_cnpj: formState.comprador.cnpj,
      responsavel_nome: formState.comprador.rep,
      responsavel_cpf: formState.comprador.repCpf || '',
      valor_total_num: valor,
      objeto_resumo: objetoResumo,
      vendedor_id: opts.vendedorId || null,
      master_id: formState.masterId || null,
      proposta_id: formState.propostaId || null,
      status: 'rascunho',
      channel: null,
      recipient: { name: formState.comprador.rep, contact: formState.comprador.email || formState.comprador.tel || '' },
      form_state: formState,
      doc,
      log: [{ status: 'rascunho', at: new Date().toISOString(), meta: null }],
      audit: {},
      sent_at: null, viewed_at: null, signed_at: null, expires_at: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      // legados (mantém compat com Jurídico antigo)
      client: formState.comprador.razao,
      value: Math.round(valor) || null,
      issued_date: new Date().toISOString().slice(0,10),
      tipo_contrato: 'cliente',
      dados: { numero_documento: num.numero_documento },
    };

    const { error } = await c.from('contratos_venda_equipamentos').insert(rec);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Contrato Venda', acao: 'criou o contrato', alvo: rec.numero_documento, alvo_id: rec.id, detalhe: { comprador: rec.comprador_razao_social } });
    if (window.AvalFinanceiroStore && formState.propostaId) window.AvalFinanceiroStore.vincularContrato(formState.propostaId, rec.id);
    return rec;
  }

  async function updateFormState(id, formState) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const valor = window.CV.parseMoney(formState.valor);
    const doc = window.CV.buildContract({
      form: formState, comprador: formState.comprador,
      valor, sinalPct: formState.sinalPct, parcelas: formState.parcelas,
      numero: cur.numero_documento,
    });
    const patch = {
      titulo: doc.titulo,
      comprador_razao_social: formState.comprador.razao,
      comprador_cnpj: formState.comprador.cnpj,
      responsavel_nome: formState.comprador.rep,
      responsavel_cpf: formState.comprador.repCpf || '',
      valor_total_num: valor,
      objeto_resumo: window.CV.descEquipamento(formState),
      master_id: formState.masterId || null,
      proposta_id: formState.propostaId || null,
      form_state: formState,
      doc,
      atualizado_em: new Date().toISOString(),
    };
    await c.from('contratos_venda_equipamentos').update(patch).eq('id', id);
    return { ...cur, ...patch };
  }

  async function markSent(id, channel, recipient) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const now = new Date();
    const expires = new Date(now.getTime() + 7*24*3600*1000);
    const log = (cur.log || []).slice();
    log.push({ status:'enviado', at: now.toISOString(), meta:{ channel } });
    const patch = {
      status: 'enviado',
      channel,
      recipient: recipient || cur.recipient || {},
      sent_at: now.toISOString(),
      expires_at: expires.toISOString(),
      log,
      atualizado_em: now.toISOString(),
    };
    const { error } = await c.from('contratos_venda_equipamentos').update(patch).eq('id', id);
    if (error) throw error;
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'enviado', { channel });
    if (window.EventosFluxo) {
      const numeroCotacao = await numeroCotacaoDaProposta(updated.proposta_id);
      window.EventosFluxo.registrar({
        evento: 'CONTRATO_VENDA_ENVIADO', numeroCotacao,
        alvoLabel: `${updated.comprador_razao_social || ''} · ${updated.numero_documento || ''}`, alvoId: updated.id,
      });
    }
    return updated;
  }

  async function markViewed(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado' && cur.status !== 'rascunho') return cur;

    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const audit = { ...(cur.audit || {}), viewedAt: now.toISOString(), viewIp: ip, viewUa: ua, viewDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status:'visualizado', at: now.toISOString(), meta:{ ip, ua } });
    const patch = {
      status: 'visualizado',
      viewed_at: now.toISOString(),
      audit, log,
      atualizado_em: now.toISOString(),
    };
    /* 29/09 — mesmo achado do send-email/proposta-store: best-effort de
       propósito (console.warn, não lança) porque é rastreamento automático
       no mount da página pública (assinar-app.jsx), sem ação do usuário —
       lançar aqui travaria a leitura do contrato por uma falha só de
       auditoria. */
    const { error } = await c.from('contratos_venda_equipamentos').update(patch).eq('token', token);
    if (error) console.warn('[CVStore] falha ao registrar visualização (best-effort, não bloqueia o cliente)', error);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'visualizado', { ip });
    return updated;
  }

  /* Recalcula D0/entrega a partir da assinatura — usado nos dois lugares
     que podem finalizar o contrato como 'assinado' de verdade (markSigned
     quando não há signatário extra pendente, e
     tentarFinalizarAposSignatarioExtra quando o último deles assina). Só
     monta o formState — quem grava é o call-site, cada um com seu próprio
     log/patch, pra não duplicar entrada de log num caminho que só precisa
     de 1 gravação (ver markSigned). */
  function _formStateFinalizado(cur, now) {
    const formState = { ...(cur.form_state || {}) };
    if (!formState.d0_assinatura) formState.d0_assinatura = now.toISOString().slice(0, 10);
    const d0 = window.CV.calcularD0(formState.d0_entrada, formState.d0_assinatura, formState.d0_projeto);
    formState.d0 = d0;
    formState.entrega_prevista = d0 ? window.CV.addDias(d0, 120) : null;
    return formState;
  }

  /* Signatários adicionais (sócios/jurídico do Comprador, pedido do
     usuário — ver contrato-venda-signatarios-store.js) — opcional. Um
     contrato sem nenhum signatário adicional cadastrado se comporta
     EXATAMENTE como antes desta feature: o representante assinando já
     fecha tudo numa única gravação. Só quando existem signatários extras
     é que o representante assinar primeiro deixa o contrato em
     'aguardando_signatarios' até o último deles também assinar (ver
     tentarFinalizarAposSignatarioExtra abaixo). */
  async function markSigned(token, sig) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const hash = await sha256Hex(JSON.stringify(cur.form_state) + '|' + (sig.signerName || ''));
    const audit = {
      ...(cur.audit || {}),
      signedAt: now.toISOString(),
      signIp: ip, signUa: ua, signDevice: device,
      signerName: sig.signerName,
      signatureType: sig.type,
      signatureData: sig.data,
      consent: true, hash,
    };
    const log = (cur.log || []).slice();
    log.push({ status:'assinado', at: now.toISOString(), meta:{ ip, ua, hash } });

    const pendentesExtras = window.CVSignatarioStore ? await window.CVSignatarioStore.contarPendentes(cur.id) : 0;
    const statusFinal = pendentesExtras > 0 ? 'aguardando_signatarios' : 'assinado';

    let patch = { audit, log, status: statusFinal, atualizado_em: now.toISOString() };
    if (statusFinal === 'assinado') {
      // ISSUE #6: assinatura é um dos 3 marcos do D0 — preenche sozinho
      // (evento real), sem precisar de entrada manual, e recalcula D0/entrega.
      patch.form_state = _formStateFinalizado(cur, now);
      patch.signed_at = now.toISOString();
    }
    const { error } = await c.from('contratos_venda_equipamentos').update(patch).eq('token', token);
    if (error) throw error;
    const updated = { ...cur, ...patch };

    if (statusFinal === 'assinado') {
      await pushNotification(updated, 'assinado', { ip, signerName: sig.signerName });
      if (window.EventosFluxo) {
        const numeroCotacao = await numeroCotacaoDaProposta(updated.proposta_id);
        window.EventosFluxo.registrar({
          evento: 'CONTRATO_VENDA_ASSINADO', numeroCotacao,
          alvoLabel: `${updated.comprador_razao_social || ''} · ${updated.numero_documento || ''}`, alvoId: updated.id,
        });
      }
    } else {
      await pushNotification(updated, 'assinado_representante', { ip, signerName: sig.signerName });
      if (window.EventosFluxo) {
        const numeroCotacao = await numeroCotacaoDaProposta(updated.proposta_id);
        window.EventosFluxo.registrar({
          evento: 'CONTRATO_VENDA_REPRESENTANTE_ASSINOU', numeroCotacao,
          alvoLabel: `${updated.comprador_razao_social || ''} · ${updated.numero_documento || ''}`, alvoId: updated.id,
        });
      }
    }
    return updated;
  }

  /* Chamado por CVSignatarioStore.markSigned depois de gravar a assinatura
     de um signatário extra — só finaliza o contrato quando o representante
     JÁ tiver assinado (audit.signedAt) e não sobrar mais ninguém pendente;
     idempotente (não faz nada se o contrato já estiver 'assinado'). */
  async function tentarFinalizarAposSignatarioExtra(contratoId) {
    const c = sb();
    const cur = await getById(contratoId);
    if (!cur) return null;
    if (cur.status === 'assinado') return cur;
    if (!cur.audit || !cur.audit.signedAt) return cur; // representante ainda não assinou
    const pendentes = window.CVSignatarioStore ? await window.CVSignatarioStore.contarPendentes(contratoId) : 0;
    if (pendentes > 0) return cur;

    const now = new Date();
    const formState = _formStateFinalizado(cur, now);
    const log = (cur.log || []).slice();
    log.push({ status: 'assinado', at: now.toISOString(), meta: { ultimoSignatario: true } });
    const patch = { status: 'assinado', signed_at: now.toISOString(), form_state: formState, log, atualizado_em: now.toISOString() };
    const { error } = await c.from('contratos_venda_equipamentos').update(patch).eq('id', contratoId);
    if (error) throw error;
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'assinado', {});
    if (window.EventosFluxo) {
      const numeroCotacao = await numeroCotacaoDaProposta(updated.proposta_id);
      window.EventosFluxo.registrar({
        evento: 'CONTRATO_VENDA_ASSINADO', numeroCotacao,
        alvoLabel: `${updated.comprador_razao_social || ''} · ${updated.numero_documento || ''}`, alvoId: updated.id,
      });
    }
    return updated;
  }

  async function refuse(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date();
    const log = (cur.log || []).slice();
    log.push({ status:'recusado', at: now.toISOString(), meta:{ at: now.toISOString() } });
    const patch = { status:'recusado', log, atualizado_em: now.toISOString() };
    const { error } = await c.from('contratos_venda_equipamentos').update(patch).eq('token', token);
    if (error) throw error;
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'recusado', {});
    return updated;
  }

  async function sweepExpired() {
    const c = sb();
    const now = new Date();
    const { data } = await c.from('contratos_venda_equipamentos')
      .select('id,status,expires_at,log,numero_documento,recipient,responsavel_nome,comprador_razao_social')
      .in('status', ['enviado', 'visualizado'])
      .lt('expires_at', now.toISOString());
    for (const r of (data || [])) {
      const log = (r.log || []).slice();
      log.push({ status:'expirado', at: now.toISOString(), meta: null });
      await c.from('contratos_venda_equipamentos').update({ status:'expirado', log, atualizado_em: now.toISOString() }).eq('id', r.id);
      await pushNotification(r, 'expirado', {});
    }
  }

  /* ---------- Desenho do Projeto de Instalação ----------
     Deixou de ser anexado no wizard (checklist "Anexo II") e passou a ser
     enviado separadamente pela Engenharia, só depois de sinal pago (Aval
     Financeiro) + contrato assinado + Aval Jurídico — ver
     CVDesenhoInstalacaoSection em contrato-venda.jsx e os gates em
     aval-financeiro-store.js/aval-juridico-store.js. Mesmo padrão de
     upload real de projeto-elevador-store.js (bucket `engenharia`). */
  async function uploadDesenhoInstalacao(id, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const cur = await getById(id);
    if (!cur) throw new Error('Contrato não encontrado.');
    const path = `desenho-instalacao/${id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error: upErr } = await c.storage.from('engenharia').upload(path, file, { upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);
    const now = new Date().toISOString();
    const arquivo = {
      nome: file.name, url: pub.publicUrl, tipo: file.type, tamanho: file.size, path,
      anexado_por: (window.__VP_USER || {}).email || null, anexado_em: now,
    };
    const desenho = { ...(cur.desenho_instalacao || {}), arquivo, envios: (cur.desenho_instalacao || {}).envios || [] };
    const { error } = await c.from('contratos_venda_equipamentos')
      .update({ desenho_instalacao: desenho, atualizado_em: now }).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contrato Venda', acao: 'anexou o Desenho do Projeto de Instalação',
      alvo: cur.numero_documento, alvo_id: id,
    });
    if (window.EventosFluxo) {
      const numeroCotacao = await numeroCotacaoDaProposta(cur.proposta_id);
      window.EventosFluxo.registrar({
        evento: 'DESENHO_INSTALACAO_ANEXADO', numeroCotacao,
        alvoLabel: cur.comprador_razao_social || cur.numero_documento, alvoId: id,
      });
    }
    return { ...cur, desenho_instalacao: desenho };
  }

  /* Envia o arquivo já anexado por e-mail real (mesma Edge Function
     `send-email` do RFQ a fornecedor — ver formulario-elevador.jsx) — fica
     registrado em emails_projeto (Inbox/Enviados/Linha do Tempo), não é o
     mailto: usado no CVSendModal. Histórico em desenho_instalacao.envios
     permite reenvio sem precisar anexar o arquivo de novo. */
  async function enviarDesenhoInstalacao(id) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const cur = await getById(id);
    if (!cur) throw new Error('Contrato não encontrado.');
    const arquivo = (cur.desenho_instalacao || {}).arquivo;
    if (!arquivo) throw new Error('Anexe o arquivo do Desenho de Instalação antes de enviar.');
    const destinatario = (cur.form_state && cur.form_state.comprador && cur.form_state.comprador.email) || null;
    if (!destinatario) throw new Error('E-mail do comprador não encontrado neste contrato.');

    const resp = await fetch(arquivo.url);
    if (!resp.ok) throw new Error('Não foi possível ler o arquivo anexado pra enviar.');
    const blob = await resp.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const numeroCotacao = await numeroCotacaoDaProposta(cur.proposta_id);
    const { data: emailData, error: emailError } = await c.functions.invoke('send-email', {
      body: {
        to: destinatario,
        subject: `Projeto de Instalação — Contrato ${cur.numero_documento} — VerticalParts`,
        text: `Olá,\n\nSegue em anexo o Desenho do Projeto de Instalação referente ao Contrato ${cur.numero_documento}.\n\nAtenciosamente,\nVerticalParts`,
        numeroCotacao, referenciaTipo: 'contrato_venda', referenciaId: id,
        attachments: [{ filename: arquivo.nome, contentType: arquivo.tipo || 'application/octet-stream', base64 }],
      },
    });
    if (emailError) throw new Error(emailError.message || 'Falha ao enviar o e-mail.');

    const now = new Date().toISOString();
    const envios = ((cur.desenho_instalacao || {}).envios || []).slice();
    envios.push({ enviado_em: now, enviado_por: (window.__VP_USER || {}).email || null, destinatario });
    const desenho = { ...(cur.desenho_instalacao || {}), envios };
    await c.from('contratos_venda_equipamentos').update({ desenho_instalacao: desenho, atualizado_em: now }).eq('id', id);

    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contrato Venda', acao: 'enviou o Desenho do Projeto de Instalação ao cliente',
      alvo: cur.numero_documento, alvo_id: id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'DESENHO_INSTALACAO_ENVIADO', numeroCotacao,
      alvoLabel: cur.comprador_razao_social || cur.numero_documento, alvoId: id, detalhe: { destinatario },
    });
    if (emailData && emailData.avisoPersistencia) window.toast?.(emailData.avisoPersistencia, 'warning');
    return { ...cur, desenho_instalacao: desenho };
  }

  async function remove(id) {
    const c = sb();
    await c.from('contratos_venda_equipamentos').delete().eq('id', id);
  }

  window.CVStore = {
    STATUS,
    uuid, shortToken,
    fmtDateTime, fmtDate, relative,
    signUrl, prettyUrl, whatsAppHref, mailtoHref,
    listAll, listarPropostasAguardandoContrato, garantirDossier, getById, getByToken,
    numeroCotacaoDaProposta,
    createDraft, updateFormState, proximoNumeroLivre,
    markSent, markViewed, markSigned, refuse,
    tentarFinalizarAposSignatarioExtra,
    uploadDesenhoInstalacao, enviarDesenhoInstalacao,
    sweepExpired, remove,
    getPublicIP, deviceLabel, sha256Hex,
  };
}());
