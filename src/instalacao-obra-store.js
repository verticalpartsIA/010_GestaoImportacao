/* ============================================================
   instalacao-obra-store.js
   Fase 1 do issue #9 — checklist de "obra pronta" antes da instalação +
   controle das 3 vistorias inclusas (avulsas cobradas à parte).

   Ancorado no Dossiê da Obra (dossier_obra), não na tabela legada
   `projetos` — é a única entidade com `numero_cotacao` real, o que permite
   somar sinais de módulos já existentes (contrato assinado, sinal pago,
   projeto de engenharia aprovado, parceiro homologado) num único checklist,
   em vez de reconstruir tudo do zero.

   window.InstalacaoObraStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* ---------- Vistorias ----------
     Consolidação (15/08): as 3 fases inclusas + avulsas viviam num jsonb
     próprio (dossier_obra.vistoria), duplicando duas outras implementações
     de vistoria que já existiam no sistema (vistorias-obras.jsx e
     vistoria-tracker.js) sem nenhuma delas se falar — achado documentado
     no FluxogramaPortal.md. Consolidado em `vistorias_obras`
     (obra_id = dossier_obra.id), que agora é a única fonte de verdade. */
  async function obterProgressoVistoria(dossierId) {
    const c = sb(); if (!c || !dossierId) return { fases: [], liberada: false };
    const { data } = await c.from('vistorias_obras').select('numero_fase, status').eq('obra_id', dossierId);
    const fases = [1, 2, 3].map((n) => ({
      numero: n,
      concluida: (data || []).some((v) => v.numero_fase === n && v.status === 'concluida'),
    }));
    return { fases, liberada: fases.every((f) => f.concluida) };
  }

  function fmtBRL(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtData(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }

  /* ---------- Checklist de obra pronta ---------- */
  /* Marca manual dos itens que não têm sinal em nenhum outro módulo.
     `recebidoPor`/`qtdPessoas` registram quem recebeu o equipamento e com
     quantas pessoas — vazio real detectado no WBS: a recepção mínima de
     2 pessoas no cliente não tinha nenhum campo até aqui. */
  async function marcarEquipamentoEntregue(dossierId, entregue, { recebidoPor, qtdPessoas } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const patch = {
      equipamento_entregue: !!entregue,
      equipamento_entregue_em: entregue ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (entregue) {
      patch.equipamento_recebido_por = recebidoPor || null;
      patch.equipamento_qtd_pessoas_recebimento = qtdPessoas != null && qtdPessoas !== '' ? Number(qtdPessoas) : null;
    } else {
      patch.equipamento_recebido_por = null;
      patch.equipamento_qtd_pessoas_recebimento = null;
    }
    const { error } = await c.from('dossier_obra').update(patch).eq('id', dossierId);
    if (error) throw error;
    if (entregue && window.EventosFluxo) {
      const { data: dossier } = await c.from('dossier_obra').select('numero_cotacao, building_name').eq('id', dossierId).maybeSingle();
      window.EventosFluxo.registrar({
        evento: 'EQUIPAMENTO_RECEBIDO', numeroCotacao: dossier?.numero_cotacao ?? null,
        alvoLabel: dossier?.building_name, alvoId: dossierId,
      });
    }
  }

  async function marcarAndaimeMunck(dossierId, { necessario, providenciado, valor }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const patch = { updated_at: new Date().toISOString() };
    if (necessario != null) patch.andaime_munck_necessario = !!necessario;
    if (providenciado != null) {
      patch.andaime_munck_providenciado = !!providenciado;
      patch.andaime_munck_em = providenciado ? new Date().toISOString() : null;
      /* 23/08 (Gelson): valor não informado aqui é um buraco conhecido — a
         regra futura é bloquear e apontar pro CEO (Diego) quando isso
         acontecer. Ainda não implementado; hoje só grava null e segue. */
      patch.andaime_munck_valor = providenciado ? (valor != null && valor !== '' ? Number(valor) : null) : null;
    }
    const { data: dossier, error } = await c.from('dossier_obra').update(patch).eq('id', dossierId)
      .select('numero_cotacao, building_name').single();
    if (error) throw error;
    if (providenciado && window.AvalFinanceiroStore && dossier?.numero_cotacao != null && valor != null && valor !== '') {
      window.AvalFinanceiroStore.registrarCustoReal({
        numeroCotacao: dossier.numero_cotacao, origem: 'andaime_munck',
        descricao: 'Andaime/Munck — ' + (dossier.building_name || dossierId), valor,
      });
    }
  }

  /* Vincular um parceiro dispara a decisão do RH pra ESTE par (obra,
     parceiro) — mesmo que ele já esteja homologado em geral, RH ainda
     precisa liberar a entrada dele nesta obra específica (issue #9 Fase 2). */
  async function vincularParceiroInstalador(dossierId, parceiroId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('dossier_obra').update({ parceiro_instalador_id: parceiroId || null, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    if (parceiroId) {
      const { data: dossier } = await c.from('dossier_obra').select('numero_cotacao, building_name, client_name').eq('id', dossierId).maybeSingle();
      if (window.DecisoesStore) {
        const { data: parceiro } = await c.from('parceiros_instaladores').select('nome').eq('id', parceiroId).maybeSingle();
        await window.DecisoesStore.podeMontadorEntrarObra(dossierId, parceiroId, {
          obra: dossier && dossier.building_name, cliente: dossier && dossier.client_name, parceiro: parceiro && parceiro.nome,
        });
      }
      if (window.EventosFluxo) window.EventosFluxo.registrar({
        evento: 'INSTALADOR_VINCULADO', numeroCotacao: dossier?.numero_cotacao ?? null,
        alvoLabel: dossier?.building_name, alvoId: dossierId,
      });
    }
  }

  /* Soma os sinais de todos os módulos + os itens manuais num checklist único.
     Cada item é { ok, label, detalhe }. `pronta` só é true se TODOS os
     obrigatórios estiverem ok (o item de andaime/munck só entra na conta
     se `andaime_munck_necessario` estiver marcado — "quando aplicável"). */
  async function obterChecklistObraPronta(dossierId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: dossier, error } = await c.from('dossier_obra').select('*').eq('id', dossierId).single();
    if (error) throw error;

    const itens = [];
    const numeroCotacao = dossier.numero_cotacao;

    if (!numeroCotacao) {
      itens.push({ chave: 'sem_cotacao', ok: false, label: 'Dossiê sem Nº de Cotação vinculado', detalhe: 'Sem essa correlação não é possível checar os demais sinais.' });
      return { pronta: false, itens, dossier };
    }

    // 1. Contrato assinado (via proposta_id — contratos_venda_equipamentos não tem numero_cotacao direto)
    const { data: propostaDaCotacao } = await c.from('propostas').select('id').eq('numero_cotacao', numeroCotacao).maybeSingle();
    let contrato = null;
    if (propostaDaCotacao) {
      const { data } = await c.from('contratos_venda_equipamentos').select('signed_at').eq('proposta_id', propostaDaCotacao.id).maybeSingle();
      contrato = data;
    }
    const contratoAssinado = !!(contrato && contrato.signed_at);
    itens.push({ chave: 'contrato', ok: contratoAssinado, label: 'Contrato assinado', detalhe: contratoAssinado ? fmtData(contrato.signed_at) : 'Pendente' });

    // 2. Entrada paga (sinal)
    const { data: aval } = await c.from('avais_financeiros').select('sinal_pago').eq('numero_cotacao', numeroCotacao).maybeSingle();
    const sinalPago = !!(aval && aval.sinal_pago);
    itens.push({ chave: 'sinal', ok: sinalPago, label: 'Entrada (sinal) paga', detalhe: sinalPago ? 'Confirmado' : 'Pendente' });

    // 3. Projeto de Engenharia aprovado
    const { data: projeto } = await c.from('projetos_elevador').select('status').eq('numero_cotacao', numeroCotacao).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const projetoAprovado = !!(projeto && projeto.status === 'finalizado');
    itens.push({ chave: 'projeto', ok: projetoAprovado, label: 'Projeto traduzido/aprovado pela Engenharia', detalhe: projeto ? projeto.status : 'Não iniciado' });

    // 4. Equipamento entregue e armazenado na obra (manual)
    let equipamentoDetalhe = 'Pendente';
    if (dossier.equipamento_entregue) {
      equipamentoDetalhe = fmtData(dossier.equipamento_entregue_em);
      if (dossier.equipamento_recebido_por) equipamentoDetalhe += ` · recebido por ${dossier.equipamento_recebido_por}`;
      if (dossier.equipamento_qtd_pessoas_recebimento) equipamentoDetalhe += ` · ${dossier.equipamento_qtd_pessoas_recebimento} pessoa(s) na recepção`;
    }
    itens.push({ chave: 'equipamento', ok: !!dossier.equipamento_entregue, label: 'Equipamento entregue e armazenado na obra', detalhe: equipamentoDetalhe });

    // 5. Obra vistoriada e liberada (3 fases inclusas concluídas em vistorias_obras)
    const progressoVistoria = await obterProgressoVistoria(dossierId);
    const concluidasCount = progressoVistoria.fases.filter((f) => f.concluida).length;
    itens.push({ chave: 'vistoria', ok: progressoVistoria.liberada, label: 'Obra vistoriada e liberada', detalhe: progressoVistoria.liberada ? '3 de 3 fases concluídas' : `${concluidasCount} de 3 fases concluídas` });

    // 6. Parceiro instalador homologado (certificações válidas em geral)
    let certOk = false, certDetalhe = 'Nenhum parceiro vinculado';
    if (dossier.parceiro_instalador_id && window.RHHomologacao) {
      const { data: parceiro } = await c.from('parceiros_instaladores').select('*').eq('id', dossier.parceiro_instalador_id).maybeSingle();
      if (parceiro) {
        const status = window.RHHomologacao.statusGeral(parceiro);
        certOk = status === 'ok';
        certDetalhe = `${parceiro.nome} — ${status}`;
      }
    }
    itens.push({ chave: 'parceiro', ok: certOk, label: 'Parceiro instalador homologado (NRs/ASO/PCMSO/PGR válidos)', detalhe: certDetalhe });

    // 7. RH liberou ESTE montador pra ESTA obra (issue #9 Fase 2) — distinto
    // da homologação geral: a certificação pode estar válida e ainda assim
    // o RH não ter liberado a entrada dele nesta obra específica.
    if (dossier.parceiro_instalador_id) {
      const decisaoRh = await window.DecisoesStore.statusMontadorObra(dossierId, dossier.parceiro_instalador_id);
      const rhOk = decisaoRh && decisaoRh.status === 'aprovada';
      const rhDetalhe = !decisaoRh ? 'Aguardando RH'
        : decisaoRh.status === 'aprovada' ? `Liberado por ${decisaoRh.decidido_por || 'RH'}`
        : decisaoRh.status === 'reprovada' ? `Reprovado pelo RH: ${decisaoRh.motivo || 'sem motivo'}`
        : 'Aguardando RH';
      itens.push({ chave: 'montador_rh', ok: !!rhOk, label: 'RH liberou este montador para esta obra', detalhe: rhDetalhe });
    }

    // 8. Andaime ou munck, quando aplicável
    if (dossier.andaime_munck_necessario) {
      itens.push({ chave: 'andaime_munck', ok: !!dossier.andaime_munck_providenciado, label: 'Andaime/munck providenciado', detalhe: dossier.andaime_munck_providenciado ? fmtData(dossier.andaime_munck_em) : 'Pendente' });
    }

    const pronta = itens.every((i) => i.ok);
    return { pronta, itens, dossier };
  }

  window.InstalacaoObraStore = {
    obterProgressoVistoria,
    marcarEquipamentoEntregue, marcarAndaimeMunck, vincularParceiroInstalador, obterChecklistObraPronta,
    fmtBRL, fmtData,
  };
}());
