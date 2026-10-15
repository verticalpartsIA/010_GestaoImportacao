/* ============================================================
   instalador-acordos-store.js
   Preço COMBINADO com o montador, por equipamento/Dossiê (15/10/2026).
   A tabela de Atualização de Custos é só referência da Precificação; o que vale
   pro Contrato Instalador e pro Pagamento é o acordo gravado aqui.

   1 acordo = 1 equipamento. Hoje Dossiê (DOS-M013) = 1 equipamento, então
   equipamento_codigo = dossier_id; quando os equipamentos vierem da Proposta
   (VPEL-EL0955-1) o código passa a ser esse, sem mudar a tabela.
   Quem cadastra: Engenharia. Só 1 acordo ativo por equipamento (índice único).

   window.InstaladorAcordosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function agora() { return new Date().toISOString(); }
  function acordoId() { return 'ACO-' + Date.now().toString().slice(-7) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(); }
  function quem() { const u = window.__VP_USER || {}; return u.nome || u.email || null; }

  function moedaParaNumero(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
    if (!s) return 0;
    const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  /* Valida um acordo antes de gravar. Devolve lista de erros em português. */
  function validar(a) {
    const erros = [];
    if (!String(a.dossier_id || '').trim()) erros.push('Escolha o Dossiê (equipamento).');
    if (!String(a.parceiro_instalador_id || '').trim()) erros.push('Escolha a empresa instaladora.');
    if (!(moedaParaNumero(a.valor_combinado) > 0)) erros.push('Informe o valor combinado (maior que zero).');
    const p = Number(a.parcelas_qtd);
    if (!Number.isInteger(p) || p < 1 || p > 12) erros.push('Parcelas: de 1 a 12.');
    return erros;
  }

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('instalador_acordos').select('*').order('criado_em', { ascending: false }).limit(1000);
    if (error) { console.warn('[InstaladorAcordosStore] listar falhou', error); return []; }
    return data || [];
  }

  /* Acordo ativo (não cancelado) de um equipamento/Dossiê — usado pelo Contrato. */
  async function obterAtivoPorDossier(dossierId) {
    const c = sb(); if (!c || !dossierId) return null;
    const { data, error } = await c.from('instalador_acordos').select('*')
      .eq('dossier_id', dossierId).neq('status', 'cancelado').order('criado_em', { ascending: false }).limit(1);
    if (error) { console.warn('[InstaladorAcordosStore] obterAtivoPorDossier falhou', error); return null; }
    return (data || [])[0] || null;
  }

  /* Dossiês disponíveis pra escolher (1 linha por equipamento). */
  async function listarDossies() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('dossier_obra')
      .select('id, client_name, building_name, city, state, equip_type, parceiro_instalador_id, cliente_id, status_master')
      .order('id', { ascending: false }).limit(1000);
    if (error) { console.warn('[InstaladorAcordosStore] listarDossies falhou', error); return []; }
    return data || [];
  }

  /* Cria o acordo (ou, se já existe um ativo pro mesmo equipamento, atualiza). Acordo já 'contratado' não muda de valor. */
  async function salvar(a) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const erros = validar(a);
    if (erros.length) throw new Error(erros.join(' '));
    const codigo = String(a.equipamento_codigo || a.dossier_id).trim();
    const valor = moedaParaNumero(a.valor_combinado);
    const tabela = moedaParaNumero(a.valor_tabela);
    const { data: existente } = await c.from('instalador_acordos').select('id, status')
      .eq('equipamento_codigo', codigo).neq('status', 'cancelado').limit(1);
    const atual = (existente || [])[0];
    const campos = {
      dossier_id: String(a.dossier_id).trim(), equipamento_codigo: codigo,
      parceiro_instalador_id: a.parceiro_instalador_id, instalador_nome: a.instalador_nome || null,
      valor_tabela: tabela > 0 ? tabela : null, valor_combinado: valor,
      parcelas_qtd: Number(a.parcelas_qtd), observacao: (a.observacao || '').trim() || null,
      atualizado_em: agora(),
    };
    let row;
    if (atual) {
      if (atual.status === 'contratado') throw new Error('Este equipamento já tem contrato — o acordo não pode mais ser alterado.');
      const { data, error } = await c.from('instalador_acordos').update(campos).eq('id', atual.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await c.from('instalador_acordos').insert({ id: acordoId(), ...campos, criado_por: quem() }).select().single();
      if (error) throw error;
      row = data;
    }
    try {
      window.VPLog?.registrar({
        modulo: 'Pagamentos a Instaladores', acao: atual ? 'Alterou o preço combinado' : 'Cadastrou o preço combinado',
        alvo: `${codigo} · ${a.instalador_nome || a.parceiro_instalador_id}`, alvo_id: row.id,
        detalhe: { valor_combinado: valor, valor_tabela: tabela || null, parcelas: Number(a.parcelas_qtd) },
      });
    } catch (_) { /* log nunca impede o salvamento */ }
    return row;
  }

  async function cancelar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('instalador_acordos').update({ status: 'cancelado', atualizado_em: agora() })
      .eq('id', id).neq('status', 'contratado').select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Não foi possível cancelar (acordo já contratado ou inexistente).');
  }

  /* Marca o acordo como contratado quando o contrato nasce (etapa 2). */
  async function vincularContrato(dossierId, contratoId) {
    const c = sb(); if (!c || !dossierId || !contratoId) return;
    const { error } = await c.from('instalador_acordos').update({ status: 'contratado', contrato_id: contratoId, atualizado_em: agora() })
      .eq('dossier_id', dossierId).eq('status', 'combinado');
    if (error) console.warn('[InstaladorAcordosStore] vincularContrato falhou', error);
  }

  window.InstaladorAcordosStore = { listar, listarDossies, obterAtivoPorDossier, salvar, cancelar, vincularContrato, validar, moedaParaNumero };
}());
