/* ============================================================
   omie-pagamentos-store.js — leitura do cache de pagamentos do Omie
   (omie_pagamentos_cache), sincronizado pela Edge Function
   omie_sync_pagamentos_instaladores.

   Frontend NUNCA fala com o Omie direto — só lê o cache no Supabase
   (rápido, sem esperar rate-limit do Omie) e pode disparar uma nova
   sincronização (que roda no servidor).

   window.OmiePagamentosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const fmtMoeda = (v) => (v || v === 0) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  /* {empresaId: {valorTotal, valorPago, pctPago}} pra todas as empresas
     de uma vez (card "Empresas Instaladoras" — sem N+1).

     Quem manda aqui são as obras: só soma títulos já casados com um
     dossier_id (equipamento/obra conciliada no sistema) — pedido do
     usuário 04/09, "o card principal" deve refletir o que nasceu de
     uma conciliação empresa↔equipamento, não tudo que o Omie tem pra
     aquele CNPJ/CPF (que pode incluir jobs antigos sem obra aqui).
     Esses "órfãos" continuam visíveis, só que à parte, em
     naoVinculadosPorEmpresa — pra não sumir dinheiro real da tela. */
  async function resumoPorEmpresa() {
    const c = sb();
    if (!c) return {};
    const { data } = await c.from('omie_pagamentos_cache')
      .select('empresa_id, valor_documento, pago')
      .not('dossier_id', 'is', null);
    const porEmpresa = {};
    (data || []).forEach((r) => {
      if (!r.empresa_id) return;
      const e = (porEmpresa[r.empresa_id] = porEmpresa[r.empresa_id] || { valorTotal: 0, valorPago: 0 });
      e.valorTotal += Number(r.valor_documento) || 0;
      if (r.pago) e.valorPago += Number(r.valor_documento) || 0;
    });
    Object.values(porEmpresa).forEach((e) => { e.pctPago = e.valorTotal > 0 ? Math.round((e.valorPago / e.valorTotal) * 100) : 0; });
    return porEmpresa;
  }

  /* {dossierId: {valorTotal, valorPago, pctPago, ultimoPagamento, parcelas}}
     — só pros títulos que conseguimos casar com uma obra (dossier_id não
     nulo); melhor esforço, ver comentário no matching da Edge Function.
     parcelas: cada título vira uma linha da "planilhinha" do card (04/09)
     — numero (do numero_pedido do Omie, "001/003"), pctDoValor (fatia
     desta parcela sobre o valor total da obra, não confundir com
     progresso físico), valor, pago, dataPagamento. */
  async function resumoPorDossier(dossierIds) {
    const c = sb();
    if (!c || !dossierIds || !dossierIds.length) return {};
    const { data } = await c.from('omie_pagamentos_cache')
      .select('dossier_id, valor_documento, pago, data_pagamento, numero_pedido, codigo_lancamento_omie')
      .in('dossier_id', dossierIds);
    const porDossier = {};
    (data || []).forEach((r) => {
      if (!r.dossier_id) return;
      const d = (porDossier[r.dossier_id] = porDossier[r.dossier_id] || { valorTotal: 0, valorPago: 0, ultimoPagamento: null, parcelas: [] });
      const valor = Number(r.valor_documento) || 0;
      d.valorTotal += valor;
      if (r.pago) {
        d.valorPago += valor;
        if (r.data_pagamento && (!d.ultimoPagamento || r.data_pagamento > d.ultimoPagamento)) d.ultimoPagamento = r.data_pagamento;
      }
      d.parcelas.push({ numero: r.numero_pedido, valor, pago: r.pago, dataPagamento: r.data_pagamento, chave: r.codigo_lancamento_omie });
    });
    Object.values(porDossier).forEach((d) => {
      d.pctPago = d.valorTotal > 0 ? Math.round((d.valorPago / d.valorTotal) * 100) : 0;
      d.parcelas.sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));
      d.parcelas.forEach((p) => { p.pctDoValor = d.valorTotal > 0 ? Math.round((p.valor / d.valorTotal) * 100) : 0; });
    });
    return porDossier;
  }

  /* Cruza dinheiro pago (%) com progresso físico real da obra
     (checklist.pct, vindo do Diário de Obra/Acompanhamento de Obra) —
     pedido do usuário 04/09: "isso vai dizer ao gestor se um montador
     recebeu mais do que a porcentagem da obra". Os marcos físicos são
     sempre 50/75/100 (AcompanhamentoObraStore); os valores pagos podem
     não bater exatamente com isso (parcelas contratuais têm valores
     próprios) — o que importa é a direção do desvio:
       - pago > progresso físico → alerta (pagou adiantado, sem lastro
         de obra concluída pra justificar).
       - progresso físico bateu um marco (50/75/100) que o pago ainda
         não alcançou → sugestão de pagamento, mas nunca automática:
         precisa do aval do supervisor, não da palavra do montador.
     Retorna null quando não há nada a dizer (dentro do esperado). */
  function comparaPagoComProgresso(pctPago, checklist) {
    if (!checklist || !checklist.criado) return null;
    const pctObra = checklist.pct || 0;
    if (pctPago > pctObra + 1) {
      return { tipo: 'alerta', texto: `Pago ${pctPago}% acima do progresso físico da obra (${pctObra}%)` };
    }
    const marcoAlcancado = [...(checklist.marcos || [])].reverse().find((m) => m.completo);
    if (marcoAlcancado) {
      const alvo = parseInt(marcoAlcancado.label, 10);
      if (alvo > pctPago + 1) {
        return { tipo: 'sugestao', texto: `Obra atingiu ${marcoAlcancado.label} — sugere pagamento até lá (aguarda aval do supervisor)` };
      }
    }
    return null;
  }

  /* Títulos do fornecedor (empresa + colaboradores) que o Omie tem mas
     que não conseguimos casar com nenhuma obra do sistema — existem de
     verdade (dinheiro pago pra esse CNPJ/CPF), só não têm dossier_id.
     Sem mostrar isso, a soma do card da empresa (todos os títulos) não
     bate com a soma dos cards de obra (só os vinculados) e parece erro
     de conta — ver 04/09, usuário reportou a diferença exata de um job
     antigo (FUNCEF ENGECOP) sem obra correspondente aqui. Agrupado por
     texto do Projeto pra não listar cada parcela solta. */
  async function naoVinculadosPorEmpresa(empresaId) {
    const c = sb();
    if (!c || !empresaId) return { valorTotal: 0, valorPago: 0, itens: [] };
    const { data } = await c.from('omie_pagamentos_cache')
      .select('projeto_texto, valor_documento, pago')
      .eq('empresa_id', empresaId)
      .is('dossier_id', null);
    const porTexto = {};
    (data || []).forEach((r) => {
      const key = r.projeto_texto || '(sem descrição no Omie)';
      const it = (porTexto[key] = porTexto[key] || { texto: key, valorTotal: 0, valorPago: 0 });
      it.valorTotal += Number(r.valor_documento) || 0;
      if (r.pago) it.valorPago += Number(r.valor_documento) || 0;
    });
    const itens = Object.values(porTexto).sort((a, b) => b.valorTotal - a.valorTotal);
    const valorTotal = itens.reduce((s, i) => s + i.valorTotal, 0);
    const valorPago = itens.reduce((s, i) => s + i.valorPago, 0);
    return { valorTotal, valorPago, itens };
  }

  async function ultimoSync() {
    const c = sb();
    if (!c) return null;
    const { data } = await c.from('omie_pagamentos_sync_log').select('*').order('iniciado_em', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  /* Dispara a sincronização no servidor (Edge Function) — pode demorar
     (varre todas as empresas + colaboradores no Omie, respeitando o
     rate-limit dele). empresaId opcional pra sincronizar só uma. */
  async function sincronizar(empresaId) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    const { data, error } = await c.functions.invoke('omie_sync_pagamentos_instaladores', {
      body: empresaId ? { empresa_id: empresaId } : {},
    });
    if (error) {
      let msg = error.message || 'Erro ao sincronizar com o Omie';
      try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch (e) { /* mantém msg */ }
      throw new Error(msg);
    }
    if (data?.erro) throw new Error(data.erro);
    return data;
  }

  /* Fire-and-forget pra chamar logo depois que um vínculo empresa↔obra/
     equipamento nasce (instalacao-obra-store.js:vincularParceiroInstalador,
     dossier-store.js:vincularInstaladorRoster, dossier-obra.jsx:
     TabEquipamentos ao setar parceiro num equipamento) — pedido do
     usuário 04/09: a conciliação deve provocar a busca no Omie sozinha,
     sem esperar o botão manual. Nunca lança erro pra quem chamou (a
     ação de vincular já terminou com sucesso; se o Omie falhar ou
     estiver com rate-limit, só loga — o botão "Atualizar pagamentos"
     continua disponível como fallback manual). */
  function dispararSyncSilencioso(empresaId) {
    if (!empresaId) return;
    sincronizar(empresaId).catch((e) => console.warn('[OmiePagamentosStore] sync pós-vínculo falhou', e.message));
  }

  window.OmiePagamentosStore = { resumoPorEmpresa, resumoPorDossier, naoVinculadosPorEmpresa, comparaPagoComProgresso, ultimoSync, sincronizar, dispararSyncSilencioso, fmtMoeda };
}());
