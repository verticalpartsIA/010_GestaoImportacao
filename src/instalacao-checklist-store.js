/* ============================================================
   instalacao-checklist-store.js
   Cronograma de Instalação (15/08) — checklist detalhado de execução da
   obra, dividido em semanas, "camaleão" por tipo de equipamento (o
   template muda conforme elevador/escada/esteira — pedido do usuário).

   Dois níveis:
   - instalacao_checklist_templates: a receita, por tipo_equipamento.
     Qualquer usuário pode adicionar item novo (mesmo padrão da
     biblioteca compartilhada da Ficha Técnica — ver CLAUDE.md) — é assim
     que o usuário vai alimentar os templates de escada/esteira, que hoje
     só têm o de elevador (28 itens, transcritos do infográfico dele).
   - instalacao_checklist_itens: a cópia POR OBRA, tirada do template no
     momento em que o checklist é criado (snapshot — igual
     fichas_tecnicas.cats: mudar o template depois não altera obras que já
     têm o checklist criado).

   Ordem de conclusão é livre (não força sequência) — o próprio
   infográfico do usuário avisa que corte civil e elétrica podem rodar em
   paralelo; a semana é só agrupamento visual, não gate.

   window.InstalacaoChecklistStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* dossier_obra.equip_type tem lixo histórico (ex.: "1× elevador (1
     paradas)" em vez de "elevador") — normaliza pra bater com o
     tipo_equipamento do template. */
  function normalizarTipoEquipamento(raw) {
    const s = (raw || '').toLowerCase();
    if (s.includes('escada')) return 'escada';
    if (s.includes('esteira')) return 'esteira';
    return 'elevador'; // default — é o único template que existe hoje
  }

  const SEMANA_META = {
    1: { titulo: 'Preparação e liberação', cor: '#1f3a6e' },
    2: { titulo: 'Ajustes civis e preparação', cor: '#2f7d5f' },
    3: { titulo: 'Estruturação mecânica I', cor: '#b5540a' },
    4: { titulo: 'Mecânica II', cor: '#a83232' },
    5: { titulo: 'Montagem da cabina e portas', cor: '#7a3b8a' },
    6: { titulo: 'Instalação elétrica', cor: '#1f6feb' },
    7: { titulo: 'Testes e entrega', cor: '#0f8a72' },
  };
  function semanaTitulo(n) { return (SEMANA_META[n] || {}).titulo || `Semana ${n}`; }
  function semanaCor(n) { return (SEMANA_META[n] || {}).cor || '#555'; }

  async function listarTemplate(tipoEquipamento) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('instalacao_checklist_templates')
      .select('*').eq('tipo_equipamento', tipoEquipamento).order('semana').order('ordem');
    if (error) { console.warn('[InstalacaoChecklistStore] listarTemplate falhou', error); return []; }
    return data || [];
  }

  async function adicionarItemTemplate({ tipoEquipamento, semana, etapa, servicos, resultadoEsperado }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existentes = await listarTemplate(tipoEquipamento);
    const proximaOrdem = existentes.length ? Math.max(...existentes.map((i) => i.ordem)) + 1 : 1;
    const row = {
      tipo_equipamento: tipoEquipamento, semana: Number(semana) || 1, ordem: proximaOrdem,
      etapa, servicos: (servicos || []).filter(Boolean),
      resultado_esperado: resultadoEsperado || null,
      criado_por: (window.__VP_USER || {}).email || null,
    };
    const { data, error } = await c.from('instalacao_checklist_templates').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  /* Idempotente: se o dossiê já tem itens, retorna eles direto (não
     recria — respeitaria progresso já marcado). */
  async function criarChecklistDossier(dossierId, equipTypeRaw) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existentes = await listarPorDossier(dossierId);
    if (existentes.length) return existentes;
    const tipo = normalizarTipoEquipamento(equipTypeRaw);
    const template = await listarTemplate(tipo);
    if (!template.length) throw new Error(`Sem template cadastrado ainda para "${tipo}" — adicione itens ao template primeiro.`);
    const rows = template.map((t) => ({
      dossier_id: dossierId, tipo_equipamento: tipo, semana: t.semana, ordem: t.ordem,
      etapa: t.etapa, servicos: t.servicos, resultado_esperado: t.resultado_esperado,
      status: 'pendente',
    }));
    const { data, error } = await c.from('instalacao_checklist_itens').insert(rows).select();
    if (error) throw error;
    return data.sort((a, b) => a.semana - b.semana || a.ordem - b.ordem);
  }

  async function listarPorDossier(dossierId) {
    const c = sb(); if (!c || !dossierId) return [];
    const { data, error } = await c.from('instalacao_checklist_itens')
      .select('*').eq('dossier_id', dossierId).order('semana').order('ordem');
    if (error) { console.warn('[InstalacaoChecklistStore] listarPorDossier falhou', error); return []; }
    return data || [];
  }

  async function marcarItem(itemId, { status, observacoes }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const patch = { status, observacoes: observacoes ?? undefined };
    if (status === 'concluido') { patch.concluido_em = new Date().toISOString(); patch.concluido_por = user.nome || user.email || null; }
    else { patch.concluido_em = null; patch.concluido_por = null; }
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    const { error } = await c.from('instalacao_checklist_itens').update(patch).eq('id', itemId);
    if (error) throw error;
  }

  function gtId() { return 'stt-' + Math.random().toString(36).slice(2, 10); }

  /* Link público — mesmo padrão de token das outras páginas públicas
     (proposta, formulário do cliente): rota dedicada fora do SPA
     autenticado, servida por server.js (/status-obra/:token). */
  async function gerarLinkPublico(dossierId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual } = await c.from('dossier_obra').select('link_publico_token').eq('id', dossierId).maybeSingle();
    let token = atual && atual.link_publico_token;
    if (!token) {
      token = gtId();
      const { error } = await c.from('dossier_obra').update({ link_publico_token: token }).eq('id', dossierId);
      if (error) throw error;
    }
    return `${window.location.origin}/status-obra/${encodeURIComponent(token)}`;
  }

  async function obterPorToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data: dossier } = await c.from('dossier_obra').select('*').eq('link_publico_token', token).maybeSingle();
    if (!dossier) return null;
    const itens = await listarPorDossier(dossier.id);
    return { dossier, itens };
  }

  window.InstalacaoChecklistStore = {
    normalizarTipoEquipamento, semanaTitulo, semanaCor,
    listarTemplate, adicionarItemTemplate,
    criarChecklistDossier, listarPorDossier, marcarItem,
    gerarLinkPublico, obterPorToken,
  };
}());
