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

  /* ---------- Vistorias (3 fases inclusas + avulsas) ---------- */
  async function obterVistoria(dossierId) {
    const c = sb(); if (!c || !dossierId) return null;
    const { data } = await c.from('dossier_obra').select('vistoria').eq('id', dossierId).maybeSingle();
    return (data && data.vistoria) || null;
  }

  async function criarVistoria(dossierId, orcamentoInicial) {
    const c = sb(); if (!c || !dossierId) throw new Error('dossierId inválido');
    const vistoria = {
      fases: [
        { numero: 1, status: 'pendente', data: null, custo: 0, observacoes: '' },
        { numero: 2, status: 'pendente', data: null, custo: 0, observacoes: '' },
        { numero: 3, status: 'pendente', data: null, custo: 0, observacoes: '' },
      ],
      avulsas: [], // vistorias além das 3 inclusas — cobradas à parte (regra do issue #9)
      orcamento_inicial: orcamentoInicial || 0,
      liberada: false, liberada_em: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await c.from('dossier_obra').update({ vistoria, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    return vistoria;
  }

  async function atualizarFaseVistoria(dossierId, numeroFase, dadosFase) {
    const c = sb(); if (!c || !dossierId) throw new Error('dossierId inválido');
    const vistoria = await obterVistoria(dossierId);
    if (!vistoria) throw new Error('Nenhum plano de vistorias criado ainda.');
    vistoria.fases = vistoria.fases.map((f) => f.numero === numeroFase ? { ...f, ...dadosFase, status: dadosFase.status || 'concluida' } : f);
    vistoria.atualizado_em = new Date().toISOString();
    const { error } = await c.from('dossier_obra').update({ vistoria, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    return vistoria;
  }

  /* Vistoria avulsa — além das 3 inclusas, cobrada à parte e registrada no dossiê. */
  async function adicionarVistoriaAvulsa(dossierId, { data, custo, observacoes }) {
    const c = sb(); if (!c || !dossierId) throw new Error('dossierId inválido');
    const vistoria = await obterVistoria(dossierId);
    if (!vistoria) throw new Error('Nenhum plano de vistorias criado ainda.');
    vistoria.avulsas = [...(vistoria.avulsas || []), {
      data: data || new Date().toISOString(), custo: Number(custo) || 0, observacoes: observacoes || '',
    }];
    vistoria.atualizado_em = new Date().toISOString();
    const { error } = await c.from('dossier_obra').update({ vistoria, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    return vistoria;
  }

  async function liberarObraVistoriada(dossierId) {
    const c = sb(); if (!c || !dossierId) throw new Error('dossierId inválido');
    const vistoria = await obterVistoria(dossierId);
    if (!vistoria) throw new Error('Nenhum plano de vistorias criado ainda.');
    vistoria.liberada = true;
    vistoria.liberada_em = new Date().toISOString();
    const { error } = await c.from('dossier_obra').update({ vistoria, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    return vistoria;
  }

  function calcularProgressoVistoria(vistoria) {
    if (!vistoria) return 0;
    const concluidas = (vistoria.fases || []).filter((f) => f.status === 'concluida').length;
    return Math.round((concluidas / 3) * 100);
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
  }

  async function marcarAndaimeMunck(dossierId, { necessario, providenciado }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const patch = { updated_at: new Date().toISOString() };
    if (necessario != null) patch.andaime_munck_necessario = !!necessario;
    if (providenciado != null) {
      patch.andaime_munck_providenciado = !!providenciado;
      patch.andaime_munck_em = providenciado ? new Date().toISOString() : null;
    }
    const { error } = await c.from('dossier_obra').update(patch).eq('id', dossierId);
    if (error) throw error;
  }

  /* Vincular um parceiro dispara a decisão do RH pra ESTE par (obra,
     parceiro) — mesmo que ele já esteja homologado em geral, RH ainda
     precisa liberar a entrada dele nesta obra específica (issue #9 Fase 2). */
  async function vincularParceiroInstalador(dossierId, parceiroId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('dossier_obra').update({ parceiro_instalador_id: parceiroId || null, updated_at: new Date().toISOString() }).eq('id', dossierId);
    if (error) throw error;
    if (parceiroId && window.DecisoesStore) {
      const { data: dossier } = await c.from('dossier_obra').select('building_name, client_name').eq('id', dossierId).maybeSingle();
      const { data: parceiro } = await c.from('parceiros_instaladores').select('nome').eq('id', parceiroId).maybeSingle();
      await window.DecisoesStore.podeMontadorEntrarObra(dossierId, parceiroId, {
        obra: dossier && dossier.building_name, cliente: dossier && dossier.client_name, parceiro: parceiro && parceiro.nome,
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

    // 5. Obra vistoriada e liberada
    const vistoria = dossier.vistoria;
    const vistoriada = !!(vistoria && vistoria.liberada);
    itens.push({ chave: 'vistoria', ok: vistoriada, label: 'Obra vistoriada e liberada', detalhe: vistoriada ? fmtData(vistoria.liberada_em) : (vistoria ? `${calcularProgressoVistoria(vistoria)}% das vistorias concluídas` : 'Nenhuma vistoria iniciada') });

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
      const { data: decisaoRh } = await c.from('decisoes_gerenciais').select('*')
        .eq('dossier_id', dossierId).eq('tipo', 'montador_entra_obra_rh').eq('referencia_id', dossier.parceiro_instalador_id).maybeSingle();
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
    obterVistoria, criarVistoria, atualizarFaseVistoria, adicionarVistoriaAvulsa, liberarObraVistoriada, calcularProgressoVistoria,
    marcarEquipamentoEntregue, marcarAndaimeMunck, vincularParceiroInstalador, obterChecklistObraPronta,
    fmtBRL, fmtData,
  };
}());
