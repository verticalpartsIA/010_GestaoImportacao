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
    rh: ['karla.silva@verticalparts.com.br'],
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
    rh: 'RH',
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
    montador_entra_obra_rh: 'Montador entra na obra — aprovação do RH',
    compra_equipamento_ceo: 'Compra do equipamento — aprovação do CEO',
    compra_varejo_logistica: 'Compra de varejo — aprovação da Logística',
  };

  async function resolverAprovadores(papel) {
    if (EMAILS_FIXOS[papel]) return EMAILS_FIXOS[papel];
    return [];
  }

  function souAprovador(decisao) {
    const email = meuEmail();
    if (!email) return false;
    return (decisao.aprovadores_esperados || []).some((e) => (e || '').toLowerCase() === email);
  }

  /* ---------- Criação ---------- */
  async function criarDecisao({ tipo, papelRequerido, numeroCotacao, dossierId, referenciaTabela, referenciaId, dependeDe, contexto }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const aprovadores = await resolverAprovadores(papelRequerido);
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
    };
    const { data, error } = await c.from('decisoes_gerenciais').insert(row).select().single();
    if (error) throw error;
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
    return (data || []).filter(souAprovador);
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
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'aprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo || null, atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
    await desbloquearDependentes(c, id);
    await notificarResultado(c, { ...decisao, motivo: motivo || null }, 'aprovada');
  }

  async function reprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da reprovação.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'reprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo.trim(), atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
    await notificarResultado(c, { ...decisao, motivo: motivo.trim() }, 'reprovada');
  }

  /* ---------- Gates ---------- */
  /* Envio de proposta exige Gestor Comercial (Regiane OU Guilherme) + CEO,
     nesta ordem — o registro do CEO nasce bloqueado até o do Gestor ser
     aprovado. Cria as decisões sob demanda (idempotente) se ainda não
     existirem pra essa cotação. */
  async function podeEnviarProposta(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let gestor = decisoes.find((d) => d.tipo === 'envio_proposta_gestor');
    let ceo = decisoes.find((d) => d.tipo === 'envio_proposta_ceo');
    if (!gestor) {
      gestor = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_gestor', papelRequerido: 'gestor_comercial', numeroCotacao });
    }
    if (!ceo) {
      ceo = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_ceo', papelRequerido: 'ceo', numeroCotacao, dependeDe: [gestor.id] });
    }
    if (gestor.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo Gestor Comercial (${gestor.decidido_por || ''}): ${gestor.motivo || 'sem motivo informado'}.` };
    if (gestor.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do Gestor Comercial (Regiane ou Guilherme) para enviar a proposta.' };
    if (ceo.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo CEO (${ceo.decidido_por || ''}): ${ceo.motivo || 'sem motivo informado'}.` };
    if (ceo.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para enviar a proposta.' };
    return { ok: true };
  }

  /* Contratação de mão de obra (Engenharia envia Contrato Instalador) exige
     aprovação do CEO antes do envio pro parceiro. */
  async function podeContratarInstalador(numeroCotacao, contexto) {
    if (numeroCotacao == null) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let decisao = decisoes.find((d) => d.tipo === 'contratacao_mao_obra_ceo');
    if (!decisao) {
      decisao = await criarDecisaoSeNaoExiste({ tipo: 'contratacao_mao_obra_ceo', papelRequerido: 'ceo', numeroCotacao, contexto });
    }
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
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Entrada na obra reprovada pelo RH (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do RH (Karla) para este montador entrar na obra.' };
    return { ok: true };
  }

  /* Compra do equipamento (elevador/escada rolante) — o pedido do usuário
     em 15/08: TODA compra de equipamento passa pelo CEO, disparada assim
     que o CLIENTE aprova a proposta — bem antes da assinatura do contrato
     ou do pagamento do sinal (equipamentos caros, só o frete marítimo já
     passa de R$ 7 mil). Ver hook em proposta-store.js (sign()). */
  async function podeComprarEquipamento(numeroCotacao, contexto) {
    if (numeroCotacao == null) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let decisao = decisoes.find((d) => d.tipo === 'compra_equipamento_ceo');
    if (!decisao) {
      decisao = await criarDecisaoSeNaoExiste({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao, contexto });
    }
    if (decisao.status === 'reprovada') return { ok: false, motivo: `Compra do equipamento reprovada pelo CEO (${decisao.decidido_por || ''}): ${decisao.motivo || 'sem motivo informado'}.` };
    if (decisao.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para comprar o equipamento deste pedido.' };
    return { ok: true };
  }

  /* Gate final antes do "start" real da compra (1ª P.I. criada pro
     fornecedor): exige a aprovação do CEO acima E que a cadeia automática
     de gatilhos já tenha liberado a compra — nó COMPRA_LIBERADA em
     gatilhos-engine.js, que só nasce depois de Contrato assinado + Sinal
     pago + Aval de Pagamento confirmado. Pedido explícito do usuário:
     aprovação do CEO é cedo (proposta aprovada), mas o start da compra em
     si só depois dos outros gatilhos. */
  async function verificarGateCompra(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    const aprovacaoCeo = await podeComprarEquipamento(numeroCotacao);
    if (!aprovacaoCeo.ok) return aprovacaoCeo;
    const { data } = await c.from('gatilhos').select('status').eq('numero_cotacao', numeroCotacao).eq('evento_key', 'COMPRA_LIBERADA').maybeSingle();
    if (!data || data.status !== 'ok') {
      return { ok: false, motivo: 'CEO já aprovou a compra do equipamento, mas o início ainda depende da cadeia automática: Contrato assinado + Sinal pago + Aval de Pagamento confirmado (nó "Compra ao Fornecedor liberada").' };
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

  window.DecisoesStore = {
    PAPEL_LABEL, TIPO_LABEL,
    resolverAprovadores, souAprovador,
    criarDecisao, criarDecisaoSeNaoExiste,
    listarPendentesParaMim, listarPorCotacao, listarPorDossier, statusMontadorObra,
    aprovar, reprovar,
    podeEnviarProposta, podeContratarInstalador, podeMontadorEntrarObra,
    podeComprarEquipamento, verificarGateCompra,
    criarDecisaoCompraVarejo,
  };
}());
