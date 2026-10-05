/* ============================================================
   decisoes-store.js
   Central de Decisões — decisão gerencial genérica (Fase 1).

   Não cria um papel novo pra cada tipo de decisão: uma linha em
   `decisoes_gerenciais` descreve "isto precisa ser decidido por alguém",
   com dependência opcional em outra decisão (ex.: aprovação do CEO só
   libera depois da aprovação do Gestor Comercial).

   Identidade continua vindo do vpsistema (Supabase ubdkoqxfwcraftesgmbw) —
   RLS de lá bloqueia leitura direta do client-side deste app pra qualquer
   colaborador (só admin/self), então usamos um espelho somente-leitura
   (`colaboradores_vpsistema`), ressincronizado manualmente via MCP — o
   organograma muda pouco, não precisa ser em tempo real.

   window.DecisoesStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function meuEmail() { return ((window.__VP_USER || {}).email || '').trim().toLowerCase(); }

  /* Papéis fixos hoje (Fase 1) — evolui pra leitura 100% do espelho quando
     fizer sentido, mas os 5 primeiros são autoridades únicas e conhecidas;
     só o Gestor Comercial tem mais de um titular possível. */
  const EMAILS_FIXOS = {
    ceo: ['diego@verticalparts.com.br'],
    owner: ['gelson.simoes@verticalparts.com.br'],
    gestor_comercial: ['regiane.rocha@verticalparts.com.br', 'guilherme@verticalparts.com.br'],
    rh: ['arilene.avila@verticalparts.com.br'],
    engenharia_lider: ['arilene.avila@verticalparts.com.br'],
    logistica_lider: ['danilo@verticalparts.com.br'],
  };

  /* Nome de exibição por papel — mesmas chaves de EMAILS_FIXOS. Fonte única
     pra quem precisa mostrar "quem decide" sem expor a lista de e-mails
     (linha-do-tempo-store.js, hoje; antes tinha seu próprio mapa
     PAPEL_TIPO_DECISAO por tipo, que reinventava isso por fora). */
  const PAPEL_LABEL = {
    ceo: 'CEO',
    owner: 'Dono do Sistema',
    gestor_comercial: 'Gestor Comercial',
    rh: 'Engenharia',
    engenharia_lider: 'Engenharia',
    logistica_lider: 'Logística',
  };

  /* Rótulo completo por tipo de decisão — cresce a cada gate novo (Fase 1,
     2, 3...). Fonte única: antes decisoes.jsx tinha sua própria cópia
     (DEC_TIPO_LABEL) que precisava ser lembrada toda vez que um tipo novo
     nascia aqui. */
  const TIPO_LABEL = {
    envio_proposta_gestor: 'Envio de proposta — aprovação do Gestor Comercial',
    envio_proposta_ceo: 'Envio de proposta — aprovação do CEO',
    contratacao_mao_obra_ceo: 'Contratação de mão de obra — aprovação do CEO',
    montador_entra_obra_rh: 'Montador entra na obra — aprovação da Engenharia',
    compra_equipamento_ceo: 'Compra do equipamento — aprovação do CEO',
    compra_varejo_logistica: 'Compra de varejo — aprovação da Logística',
    desconto_proposta: 'Desconto em proposta',
    pagamento_instalador_parcela: 'Pagamento a instalador — aprovação do Gestor Comercial',
    inbox_decisao: 'Decisão pedida a partir de um e-mail',
  };

  /* Além dos e-mails fixos, qualquer papel pode ganhar aprovadores extras
     concedidos via admin (alcadas_capacidade, modulo='decisoes', capacidade=
     <papel>) — mesmo padrão genérico/delegável já usado em "Alçadas de
     Propostas" (financeiro.jsx), sem precisar hardcodar e-mail novo no
     código. Ex.: dar poder de CEO ao Gelson só pra teste, revogável, sem
     deploy. Só afeta decisões CRIADAS depois da concessão — o snapshot em
     aprovadores_esperados já gravado numa decisão pendente não muda sozinho. */
  async function extrasPorAlcada(papel) {
    const c = sb(); if (!c) return [];
    const { data: concedidas } = await c.from('alcadas_capacidade').select('perfil_id')
      .eq('modulo', 'decisoes').eq('capacidade', papel);
    if (!concedidas || !concedidas.length) return [];
    const { data: perfis } = await c.from('perfis').select('email').in('id', concedidas.map((r) => r.perfil_id));
    return (perfis || []).map((p) => (p.email || '').trim().toLowerCase()).filter(Boolean);
  }

  async function resolverAprovadores(papel) {
    const fixos = EMAILS_FIXOS[papel] || [];
    const extras = await extrasPorAlcada(papel);
    if (!fixos.length && !extras.length) return [];
    return [...new Set([...fixos, ...extras])];
  }

  function souAprovador(decisao) {
    const email = meuEmail();
    if (!email) return false;
    return (decisao.aprovadores_esperados || []).some((e) => (e || '').toLowerCase() === email);
  }

  /* `aprovadores_esperados` é um retrato do momento da criação — se o responsável do papel muda, decisões já abertas
     ficam apontando para quem não decide mais. Ao LER, recalcula pelo papel atual (fixos + alçadas); sem papel
     resolvível, mantém o retrato gravado. Decisões já decididas/canceladas não mudam (histórico). */
  async function atualizarAprovadores(lista) {
    const cache = {};
    const out = [];
    for (const d of lista || []) {
      if (!['pendente', 'bloqueada_por_dependencia'].includes(d.status) || !d.papel_requerido) { out.push(d); continue; }
      if (!(d.papel_requerido in cache)) cache[d.papel_requerido] = await resolverAprovadores(d.papel_requerido);
      const atuais = cache[d.papel_requerido];
      out.push(atuais.length ? { ...d, aprovadores_esperados: atuais } : d);
    }
    return out;
  }

  /* ---------- Criação ---------- */
  async function criarDecisao({ tipo, papelRequerido, numeroCotacao, dossierId, referenciaTabela, referenciaId, dependeDe, contexto, aprovadoresFixos }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    // aprovadoresFixos (opcional): quando quem pede escolhe as pessoas na hora (ex.: "Pedir decisão" no Inbox). Os outros gates seguem pelo papel.
    const aprovadores = (aprovadoresFixos && aprovadoresFixos.length) ? [...new Set(aprovadoresFixos.map((e) => String(e).trim().toLowerCase()).filter(Boolean))] : await resolverAprovadores(papelRequerido);
    const status = (dependeDe && dependeDe.length) ? 'bloqueada_por_dependencia' : 'pendente';
    const row = {
      tipo, papel_requerido: papelRequerido,
      numero_cotacao: numeroCotacao ?? null, dossier_id: dossierId ?? null,
      referencia_tabela: referenciaTabela ?? null, referencia_id: referenciaId ?? null,
      depende_de: dependeDe || [], status,
      aprovadores_esperados: aprovadores,
      // Nunca lido pelo app (souAprovador só olha o array acima) — mantido
      // porque existe idx_decisoes_aprovador em produção, sinal de que
      // serve pra consulta SQL direta fora do app. Ver migração
      // 20260817200000_decisoes_gerenciais_schema_doc.sql.
      aprovador_esperado_email: aprovadores[0] || null,
      contexto: contexto || {},
      // `origem_cliente`: decisão disparada pela assinatura do CLIENTE (processada por um usuário interno via fila) — sem
      // solicitante, como era quando rodava na página pública (o resultado avisa o grupo, não quem processou a fila).
      solicitado_por: (contexto && contexto.origem_cliente) ? null : (meuEmail() || null),
    };
    const { data, error } = await c.from('decisoes_gerenciais').insert(row).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Central de Decisões', acao: `Abriu decisão pendente — ${TIPO_LABEL[tipo] || tipo}`,
      alvo: numeroCotacao != null ? `Cotação Nº ${numeroCotacao}` : (data.id), alvo_id: data.id,
      detalhe: { tipo, papel_requerido: papelRequerido, aprovadores },
    });
    return data;
  }

  /* Idempotente por (tipo, numero_cotacao) — chamada de novo não duplica. */
  async function criarDecisaoSeNaoExiste(args) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: existente } = await c.from('decisoes_gerenciais').select('id')
      .eq('tipo', args.tipo).eq('numero_cotacao', args.numeroCotacao ?? null).maybeSingle();
    if (existente) return existente;
    return criarDecisao(args);
  }

  /* ---------- Consulta ---------- */
  async function listarPendentesParaMim() {
    const c = sb(); if (!c) return [];
    const email = meuEmail();
    if (!email) return [];
    const { data, error } = await c.from('decisoes_gerenciais')
      .select('*').in('status', ['pendente']).order('criado_em', { ascending: false });
    if (error) { console.warn('[DecisoesStore] listarPendentesParaMim falhou', error); return []; }
    return (await atualizarAprovadores(data || [])).filter(souAprovador);
  }

  /* Histórico (aprovadas, reprovadas e canceladas). `todas` = visão de Administrador; senão só o que eu decidi,
     era aprovador ou solicitei. */
  async function listarDecididas({ todas = false, limite = 200 } = {}) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('decisoes_gerenciais')
      .select('*').in('status', ['aprovada', 'reprovada', 'cancelada'])
      .order('decidido_em', { ascending: false, nullsFirst: false }).limit(limite);
    if (error) { console.warn('[DecisoesStore] listarDecididas falhou', error); return []; }
    if (todas) return data || [];
    const email = meuEmail();
    if (!email) return [];
    return (data || []).filter((d) => souAprovador(d) || (d.decidido_por || '').toLowerCase() === email || (d.solicitado_por || '').toLowerCase() === email);
  }

  /* Visão de Administrador — "ver tudo que está em aberto no sistema", sem
     filtrar por aprovador (pedido do usuário, criador do site: precisa
     entender/instruir qualquer decisão, mesmo sem poder de aprovar). Não
     concede poder de decidir — aprovar()/reprovar() continuam exigindo
     souAprovador(decisao); isso é só leitura ampliada, gate de nivel
     'Administrador' é decidido por quem chama (decisoes.jsx). */
  async function listarTodasEmAberto() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('decisoes_gerenciais')
      .select('*').in('status', ['pendente', 'bloqueada_por_dependencia']).order('criado_em', { ascending: false });
    if (error) { console.warn('[DecisoesStore] listarTodasEmAberto falhou', error); return []; }
    return atualizarAprovadores(data || []);
  }

  async function listarPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data } = await c.from('decisoes_gerenciais').select('*').eq('numero_cotacao', numeroCotacao).order('criado_em');
    return data || [];
  }

  async function listarPorDossier(dossierId) {
    const c = sb(); if (!c || !dossierId) return [];
    const { data } = await c.from('decisoes_gerenciais').select('*').eq('dossier_id', dossierId).order('criado_em');
    return data || [];
  }

  /* Status (sem side-effect) do gate de RH pra um montador numa obra —
     mesmo filtro que podeMontadorEntrarObra usa pra criar/checar o gate,
     exposto aqui pra quem só precisa ler (ex.: checklist de instalação)
     sem duplicar o where. */
  async function statusMontadorObra(dossierId, parceiroId) {
    const c = sb(); if (!c || !dossierId || !parceiroId) return null;
    const { data } = await c.from('decisoes_gerenciais').select('*')
      .eq('dossier_id', dossierId).eq('tipo', 'montador_entra_obra_rh').eq('referencia_id', parceiroId).maybeSingle();
    return data || null;
  }

  /* ---------- Notificação de resultado ---------- */
  /* `alertas` não tem coluna de destinatário — todo alerta é visível pra
     todo mundo na Central de Notificações (decisão consciente, candidato 2
     da revisão de arquitetura de hoje: mudar isso reabriria o módulo de
     Notificações fechado na mesma sessão). Isso ainda fecha o duto que
     faltava: antes, aprovar/reprovar não deixava rastro nenhum fora de
     `decisoes_gerenciais` — quem pediu tinha que clicar de novo e torcer. */
  async function notificarResultado(c, decisao, statusFinal) {
    const ctx = decisao.contexto || {};
    const alvo = ctx.cliente || ctx.titulo || ctx.item || ctx.obra
      || (decisao.numero_cotacao != null ? `Cotação Nº ${decisao.numero_cotacao}` : null);
    const verbo = statusFinal === 'aprovada' ? 'aprovada' : 'reprovada';
    const row = {
      id: 'dec_' + decisao.id + '_' + Date.now(),
      level: statusFinal === 'aprovada' ? 'info' : 'warning',
      title: `${TIPO_LABEL[decisao.tipo] || decisao.tipo} — ${verbo}`,
      sub: [alvo, decisao.motivo].filter(Boolean).join(' · ') || null,
      module: 'Central de Decisões',
      resolved: false,
      /* Quem pediu é avisado; sem solicitante conhecido (decisões antigas), segue global como antes. */
      destinatario_email: decisao.solicitado_por ? String(decisao.solicitado_por).toLowerCase() : null,
    };
    const { error } = await c.from('alertas').insert(row);
    if (error) console.warn('[DecisoesStore] notificarResultado falhou', error);
  }

  /* ---------- Decisão ---------- */
  async function desbloquearDependentes(c, decisaoId) {
    const { data: dependentes } = await c.from('decisoes_gerenciais')
      .select('id, depende_de').eq('status', 'bloqueada_por_dependencia').contains('depende_de', [decisaoId]);
    for (const dep of dependentes || []) {
      const { data: pais } = await c.from('decisoes_gerenciais').select('id, status').in('id', dep.depende_de);
      const todasAprovadas = (pais || []).every((p) => p.status === 'aprovada');
      if (todasAprovadas) {
        await c.from('decisoes_gerenciais').update({ status: 'pendente', atualizado_em: new Date().toISOString() }).eq('id', dep.id);
      }
    }
  }

  async function aprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: bruta, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    const [decisao] = await atualizarAprovadores([bruta]);
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    const now = new Date().toISOString();
    /* .eq('status','pendente') + select: se outra pessoa decidiu no meio tempo, 0 linhas voltam e não sobrescreve. */
    const { data: gravadas, error } = await c.from('decisoes_gerenciais').update({
      status: 'aprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo || null, atualizado_em: now,
    }).eq('id', id).eq('status', 'pendente').select('id');
    if (error) throw error;
    if (!gravadas || !gravadas.length) throw new Error('Esta decisão já foi decidida por outra pessoa.');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Central de Decisões', acao: `Aprovou decisão — ${TIPO_LABEL[decisao.tipo] || decisao.tipo}`,
      alvo: decisao.numero_cotacao != null ? `Cotação Nº ${decisao.numero_cotacao}` : id, alvo_id: id,
      detalhe: { motivo: motivo || null },
    });
    await desbloquearDependentes(c, id);
    await notificarResultado(c, { ...decisao, motivo: motivo || null }, 'aprovada');
  }

  async function reprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: bruta, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    const [decisao] = await atualizarAprovadores([bruta]);
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da reprovação.');
    const now = new Date().toISOString();
    const { data: gravadas, error } = await c.from('decisoes_gerenciais').update({
      status: 'reprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo.trim(), atualizado_em: now,
    }).eq('id', id).eq('status', 'pendente').select('id');
    if (error) throw error;
    if (!gravadas || !gravadas.length) throw new Error('Esta decisão já foi decidida por outra pessoa.');
    /* Quem dependia desta decisão (ex.: CEO depois do Gestor) não tem mais o que esperar: cancela com marca própria,
       para reabrir() restaurar se a decisão for solicitada de novo. */
    await c.from('decisoes_gerenciais').update({
      status: 'cancelada', decidido_por: 'sistema', decidido_em: now, atualizado_em: now, motivo: MOTIVO_DEPENDENCIA_REPROVADA,
    }).eq('status', 'bloqueada_por_dependencia').contains('depende_de', [id]);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Central de Decisões', acao: `Reprovou decisão — ${TIPO_LABEL[decisao.tipo] || decisao.tipo}`,
      alvo: decisao.numero_cotacao != null ? `Cotação Nº ${decisao.numero_cotacao}` : id, alvo_id: id,
      detalhe: { motivo: motivo.trim() },
    });
    await notificarResultado(c, { ...decisao, motivo: motivo.trim() }, 'reprovada');
  }

  /* ---------- Cancelar / reabrir ---------- */
  const MOTIVO_DEPENDENCIA_REPROVADA = 'Cancelada: a decisão da qual dependia foi reprovada.';

  async function ehAdministrador() {
    try {
      const perfil = window.PropostaStore ? await window.PropostaStore.resolverPerfilAtual() : null;
      return !!(perfil && perfil.nivel === 'Administrador');
    } catch (_) { return false; }
  }

  /* Só Administrador cancela (decisão que perdeu o sentido: cotação descartada, regra mudou). Fica no histórico. */
  async function cancelar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!(await ehAdministrador())) throw new Error('Só o Administrador pode cancelar uma decisão.');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo do cancelamento.');
    const now = new Date().toISOString();
    const { data, error } = await c.from('decisoes_gerenciais').update({
      status: 'cancelada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo.trim(), atualizado_em: now,
    }).eq('id', id).in('status', ['pendente', 'bloqueada_por_dependencia']).select('id, tipo, numero_cotacao');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Esta decisão já não está em aberto.');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Central de Decisões', acao: `Cancelou decisão — ${TIPO_LABEL[data[0].tipo] || data[0].tipo}`,
      alvo: data[0].numero_cotacao != null ? `Cotação Nº ${data[0].numero_cotacao}` : id, alvo_id: id, detalhe: { motivo: motivo.trim() },
    });
  }

  /* Solicita de novo uma decisão reprovada/cancelada: a MESMA linha volta a pendente (os gates procuram por tipo+cotação,
     então um registro novo conviveria com o reprovado e continuaria bloqueando). O que houve antes fica em
     contexto.reaberturas. Decisões que foram canceladas por depender desta voltam a "bloqueada". */
  async function reabrirInterno(c, d) {
    const [atual] = await atualizarAprovadores([{ ...d, status: 'pendente' }]);
    let status = 'pendente';
    if (d.depende_de && d.depende_de.length) {
      const { data: pais } = await c.from('decisoes_gerenciais').select('id, status').in('id', d.depende_de);
      if (!(pais || []).every((p) => p.status === 'aprovada')) status = 'bloqueada_por_dependencia';
    }
    const now = new Date().toISOString();
    const reaberturas = [...((d.contexto || {}).reaberturas || []), {
      em: now, por: meuEmail() || null, statusAnterior: d.status, decididoPor: d.decidido_por || null, motivoAnterior: d.motivo || null,
    }];
    const { data, error } = await c.from('decisoes_gerenciais').update({
      status, decidido_por: null, decidido_em: null, motivo: null, atualizado_em: now,
      aprovadores_esperados: atual.aprovadores_esperados, aprovador_esperado_email: (atual.aprovadores_esperados || [])[0] || null,
      contexto: { ...(d.contexto || {}), reaberturas },
    }).eq('id', d.id).in('status', ['reprovada', 'cancelada']).select('*').single();
    if (error) throw error;
    await c.from('decisoes_gerenciais').update({ status: 'bloqueada_por_dependencia', decidido_por: null, decidido_em: null, motivo: null, atualizado_em: now })
      .eq('status', 'cancelada').eq('motivo', MOTIVO_DEPENDENCIA_REPROVADA).contains('depende_de', [d.id]);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Central de Decisões', acao: `Solicitou novamente — ${TIPO_LABEL[d.tipo] || d.tipo}`,
      alvo: d.numero_cotacao != null ? `Cotação Nº ${d.numero_cotacao}` : d.id, alvo_id: d.id,
      detalhe: { statusAnterior: d.status, motivoAnterior: d.motivo || null },
    });
    return data;
  }

  async function reabrir(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: d, error } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (error) throw error;
    if (!['reprovada', 'cancelada'].includes(d.status)) throw new Error('Só dá para solicitar de novo uma decisão reprovada ou cancelada.');
    return reabrirInterno(c, d);
  }

  /* Gate que encontra a decisão cancelada (ex.: expirada) e precisa dela de novo: reabre em vez de ficar travado
     esperando algo que ninguém vê na fila. */
  async function garantirAtiva(d) {
    if (!d || d.status !== 'cancelada') return d;
    const c = sb(); if (!c) return d;
    try { return await reabrirInterno(c, d); } catch (e) { console.warn('[DecisoesStore] garantirAtiva falhou', e); return d; }
  }

  /* Dados que o aprovador precisa ver no card quando a decisão nasce de uma cotação (cliente, valor, margem). */
  async function contextoDaCotacao(numeroCotacao, extra) {
    const out = { ...(extra || {}) };
    const c = sb();
    if (!c || numeroCotacao == null) return out;
    try {
      const { data } = await c.from('propostas').select('titulo, valor_total, data_json, numero_documento')
        .eq('numero_cotacao', numeroCotacao).order('updated_at', { ascending: false }).limit(1);
      const p = data && data[0];
      if (p) {
        const cli = (p.data_json && p.data_json.cliente && p.data_json.cliente.nome) || p.titulo || null;
        if (!out.cliente && cli) out.cliente = cli;
        if (out.valor == null && p.valor_total != null) out.valor = Number(p.valor_total);
        if (!out.proposta) out.proposta = p.numero_documento || p.titulo || null;
      }
      if (out.margem_efetiva_pct == null) {
        const m = await margemEfetivaDaCotacao(numeroCotacao);
        if (m != null) out.margem_efetiva_pct = m;
      }
    } catch (e) { console.warn('[DecisoesStore] contextoDaCotacao falhou', e); }
    return out;
  }

  /* ---------- Gates ---------- */
  /* Regra combinada com o usuário (28/09, achado real na cotação 955: o
     CEO aprovou uma proposta com margem efetiva de 25,9%, bem acima da
     meta de 15%, só porque o gate mandava toda proposta pra ele sem
     checar nada — CEO tem pouco tempo, não deveria ver o que já está
     dentro da política). CEO só entra na alçada quando a margem efetiva
     da precificação fica ABAIXO da regra de 15% — dentro da regra, a
     aprovação do Gestor Comercial (Regiane ou Guilherme) já basta.
     Margem desconhecida (sem precificação finalizada pra essa cotação)
     mantém o CEO no circuito por segurança, igual ao comportamento
     anterior. */
  const LIMITE_MARGEM_SEM_CEO = 0.15;

  async function margemEfetivaDaCotacao(numeroCotacao) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('precificacoes_elevador')
      .select('status, resultado_v2, resultado, updated_at')
      .eq('numero_cotacao', numeroCotacao).order('updated_at', { ascending: false });
    if (!data || !data.length) return null;
    const pz = data.find((p) => p.status === 'finalizado') || data[0];
    const v2 = pz.resultado_v2 && pz.resultado_v2.precificacao;
    if (v2 && v2.margemEfetivaPct != null) return v2.margemEfetivaPct;
    if (pz.resultado && pz.resultado.margemFinalPct != null) return pz.resultado.margemFinalPct;
    return null;
  }

  /* {precisa, margem} — o CEO só precisa decidir quando a margem efetiva
     fica abaixo de LIMITE_MARGEM_SEM_CEO (ou é desconhecida). Usado também
     por AvalFinanceiroStore.podeIniciarCompra e pela tela Aval Financeiro
     (29/09: a mesma regra dos 15% vale pra compra na China). */
  async function precisaAprovacaoCeo(numeroCotacao) {
    if (numeroCotacao == null) return { precisa: true, margem: null };
    const margem = await margemEfetivaDaCotacao(numeroCotacao);
    return { precisa: margem == null || margem < LIMITE_MARGEM_SEM_CEO, margem };
  }

  /* Envio de proposta exige Gestor Comercial (Regiane OU Guilherme) sempre
     e, quando a margem sai da regra acima, também o CEO — nesta ordem, o
     registro do CEO (quando existe) nasce bloqueado até o do Gestor ser
     aprovado. Cria as decisões sob demanda (idempotente) se ainda não
     existirem pra essa cotação. */
  async function podeEnviarProposta(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let gestor = decisoes.find((d) => d.tipo === 'envio_proposta_gestor');
    let ceo = decisoes.find((d) => d.tipo === 'envio_proposta_ceo');
    if (!gestor) {
      gestor = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_gestor', papelRequerido: 'gestor_comercial', numeroCotacao, contexto: await contextoDaCotacao(numeroCotacao) });
    }
    gestor = await garantirAtiva(gestor);
    ceo = await garantirAtiva(ceo);
    if (gestor.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo Gestor Comercial (${gestor.decidido_por || ''}): ${gestor.motivo || 'sem motivo informado'}.` };
    if (gestor.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do Gestor Comercial (Regiane ou Guilherme) para enviar a proposta.' };
    if (!ceo) {
      const margem = await margemEfetivaDaCotacao(numeroCotacao);
      const precisaCeo = margem == null || margem < LIMITE_MARGEM_SEM_CEO;
      if (!precisaCeo) return { ok: true };
      ceo = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_ceo', papelRequerido: 'ceo', numeroCotacao, dependeDe: [gestor.id], contexto: await contextoDaCotacao(numeroCotacao, { margem_efetiva_pct: margem }) });
    }
    if (ceo.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo CEO (${ceo.decidido_por || ''}): ${ceo.motivo || 'sem motivo informado'}.` };
    if (ceo.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para enviar a proposta — a margem desta proposta ficou abaixo da regra de 15%.' };
    return { ok: true };
  }

  /* Contratação de mão de obra (Engenharia envia Contrato Instalador) exige
     aprovação do CEO antes do envio pro parceiro. */
  async function podeContratarInstalador(numeroCotacao, contexto) {
    /* Contrato avulso (sem Proposta/Nº de cotação): antes passava direto
       (`ok: true`), pulando a alçada do CEO. Agora a decisão é chaveada pelo
       id do próprio contrato (referencia_tabela/referencia_id). */
    if (numeroCotacao == null) {
      const contratoId = contexto && contexto.contratoInstaladorId;
      const c = sb();
      if (!contratoId || !c) return { ok: true };
      const { data: existentes } = await c.from('decisoes_gerenciais').select('*')
        .eq('tipo', 'contratacao_mao_obra_ceo').eq('referencia_tabela', 'contratos_instalador').eq('referencia_id', contratoId);
      let avulsa = (existentes || [])[0];
      if (!avulsa) {
        avulsa = await criarDecisao({ tipo: 'contratacao_mao_obra_ceo', papelRequerido: 'ceo', referenciaTabela: 'contratos_instalador', referenciaId: contratoId, contexto: { ...contexto, avulso: true } });
      }
      if (avulsa.status === 'reprovada') return { ok: false, motivo: `Contratação reprovada pelo CEO (${avulsa.decidido_por || ''}): ${avulsa.motivo || 'sem motivo informado'}.` };
      if (avulsa.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para contratar mão de obra deste parceiro instalador (contrato avulso, sem Proposta).' };
      return { ok: true };
    }
    let decisoes = await listarPorCotacao(numeroCotacao);
    let decisao = decisoes.find((d) => d.tipo === 'contratacao_mao_obra_ceo');
    if (!decisao) {
      decisao = await criarDecisaoSeNaoExiste({ tipo: 'contratacao_mao_obra_ceo', papelRequerido: 'ceo', numeroCotacao, contexto: await contextoDaCotacao(numeroCotacao, contexto) });
    }
    decisao = await garantirAtiva(decisao);
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Contratação reprovada pelo CEO (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para contratar mão de obra deste parceiro instalador.' };
    return { ok: true };
  }

  /* Montador entra na obra (parceiro vinculado a um dossiê) exige aprovação
     do RH — por obra, mesmo que o parceiro já esteja homologado em geral.
     Chave é (dossierId, parceiroId): trocar o parceiro vinculado exige uma
     decisão nova, não reaproveita a aprovação de um montador diferente. */
  async function podeMontadorEntrarObra(dossierId, parceiroId, contexto) {
    if (!dossierId || !parceiroId) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    const { data: existentes } = await c.from('decisoes_gerenciais').select('*')
      .eq('dossier_id', dossierId).eq('tipo', 'montador_entra_obra_rh').eq('referencia_id', parceiroId);
    let decisao = (existentes || [])[0];
    if (!decisao) {
      decisao = await criarDecisao({ tipo: 'montador_entra_obra_rh', papelRequerido: 'rh', dossierId, referenciaTabela: 'parceiros_instaladores', referenciaId: parceiroId, contexto });
    }
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Entrada na obra reprovada pela Engenharia (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação da Engenharia (Arilene) para este montador entrar na obra.' };
    return { ok: true };
  }

  /* Pagamento de parcela ao instalador — hoje "Marcar paga" era um botão
     livre pra qualquer um com acesso à tela (achado ao investigar a
     granularidade de custo de instalação, 11-12/09): o sistema sinaliza
     "liberada" automaticamente pelo progresso da obra, mas nada exigia
     aprovação de verdade antes do clique que confirma o pagamento. Chave é
     o id da própria parcela (referencia_id) — cada parcela pede sua
     própria aprovação, não uma por contrato inteiro. */
  async function podePagarParcela(parcelaId, contexto) {
    if (!parcelaId) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    const { data: existentes } = await c.from('decisoes_gerenciais').select('*')
      .eq('referencia_tabela', 'contrato_instalador_parcelas').eq('referencia_id', parcelaId).eq('tipo', 'pagamento_instalador_parcela');
    let decisao = (existentes || [])[0];
    if (!decisao) {
      decisao = await criarDecisao({ tipo: 'pagamento_instalador_parcela', papelRequerido: 'gestor_comercial', referenciaTabela: 'contrato_instalador_parcelas', referenciaId: parcelaId, contexto });
    }
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Pagamento reprovado pelo Gestor Comercial (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Solicitação de aprovação enviada ao Gestor Comercial (Regiane ou Guilherme) — aguarde antes de marcar como paga.' };
    return { ok: true };
  }

  /* Compra do equipamento (elevador/escada rolante) — o pedido do usuário
     em 15/08: TODA compra de equipamento passa pelo CEO, disparada assim
     que o CLIENTE aprova a proposta — bem antes da assinatura do contrato
     ou do pagamento do sinal (equipamentos caros, só o frete marítimo já
     passa de R$ 7 mil). Ver hook em proposta-store.js (sign()). */
  async function podeComprarEquipamento(numeroCotacao, contexto) {
    if (numeroCotacao == null) return { ok: true };
    /* 29/09 — CEO só em discrepância: margem >= 15% não cria (nem exige) a
       decisão de compra do CEO. Decisão já criada antes dessa regra fica
       na Central, mas deixa de travar. */
    const { precisa } = await precisaAprovacaoCeo(numeroCotacao);
    if (!precisa) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let decisao = decisoes.find((d) => d.tipo === 'compra_equipamento_ceo');
    if (!decisao) {
      decisao = await criarDecisaoSeNaoExiste({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao, contexto: await contextoDaCotacao(numeroCotacao, contexto) });
    }
    decisao = await garantirAtiva(decisao);
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Compra do equipamento reprovada pelo CEO (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para comprar o equipamento deste pedido.' };
    return { ok: true };
  }

  /* Gate final antes do "start" real da compra (1ª P.I. criada pro
     fornecedor): exige a aprovação do CEO acima (só quando a margem < 15%)
     E que a cadeia automática de gatilhos já tenha liberado a compra — nó
     COMPRA_LIBERADA em gatilhos-engine.js, que só nasce com Aval de
     Pagamento + Aval Jurídico. Pedido explícito do usuário:
     aprovação do CEO é cedo (proposta aprovada), mas o start da compra em
     si só depois dos outros gatilhos. */
  async function verificarGateCompra(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    const aprovacaoCeo = await podeComprarEquipamento(numeroCotacao);
    if (!aprovacaoCeo.ok) return aprovacaoCeo;
    const { data } = await c.from('gatilhos').select('status').eq('numero_cotacao', numeroCotacao).eq('evento_key', 'COMPRA_LIBERADA').maybeSingle();
    if (!data || data.status !== 'ok') {
      return { ok: false, motivo: 'O início da compra ainda depende dos dois avais: Aval de Pagamento do Financeiro (depois do sinal) + Aval Jurídico (nó "Compra ao Fornecedor liberada").' };
    }
    return { ok: true };
  }

  /* Compra de varejo pro estoque (Almoxarifado) — não é equipamento de
     venda, é insumo/peça. Exige aprovação do Chefe de Logística (Danilo).
     Cria a decisão vinculada ao pedido (referencia_tabela/id) na hora do
     pedido, não sob demanda como as outras — aqui o pedido É o gatilho. */
  async function criarDecisaoCompraVarejo(pedidoId, contexto) {
    return criarDecisao({
      tipo: 'compra_varejo_logistica', papelRequerido: 'logistica_lider',
      referenciaTabela: 'pedidos_compra_varejo', referenciaId: pedidoId, contexto,
    });
  }

  /* ---------- Inbox: "Pedir decisão" (04/10/2026) ----------
     Cria uma decisão ligada a um e-mail (referencia_tabela='emails_projeto'). De propósito SEM numero_cotacao na linha (o Nº vai em
     `contexto`): com numero_cotacao o botão "Ver documento" abriria o formulário da cotação em vez do e-mail. Papel 'inbox_decisao'
     não existe em EMAILS_FIXOS → os aprovadores escolhidos ficam como estão (atualizarAprovadores só recalcula papel conhecido).
     Qualquer um dos escolhidos pode decidir. */
  async function pedirDecisaoInbox({ emailId, assunto, de, numeroCotacao, pergunta, aprovadores }) {
    const lista = (aprovadores || []).filter(Boolean);
    if (!emailId) throw new Error('E-mail não informado.');
    if (!String(pergunta || '').trim()) throw new Error('Escreva a pergunta da decisão.');
    if (!lista.length) throw new Error('Escolha pelo menos uma pessoa para decidir.');
    const titulo = String(pergunta).trim().slice(0, 140);
    return criarDecisao({
      tipo: 'inbox_decisao', papelRequerido: 'inbox_decisao', referenciaTabela: 'emails_projeto', referenciaId: String(emailId),
      aprovadoresFixos: lista,
      contexto: { titulo: assunto ? `${titulo} — e-mail “${String(assunto).slice(0, 70)}”` : titulo, pergunta: String(pergunta).trim(), email_assunto: assunto || null, email_de: de || null, cotacao_do_email: numeroCotacao ?? null, solicitante: meuEmail() || null },
    });
  }

  window.DecisoesStore = {
    PAPEL_LABEL, TIPO_LABEL,
    resolverAprovadores, souAprovador, ehAdministrador,
    criarDecisao, criarDecisaoSeNaoExiste, contextoDaCotacao,
    cancelar, reabrir,
    listarPendentesParaMim, listarTodasEmAberto, listarDecididas, listarPorCotacao, listarPorDossier, statusMontadorObra,
    aprovar, reprovar,
    podeEnviarProposta, podeContratarInstalador, podeMontadorEntrarObra,
    podeComprarEquipamento, verificarGateCompra, precisaAprovacaoCeo,
    criarDecisaoCompraVarejo, podePagarParcela, pedirDecisaoInbox,
  };
}());
