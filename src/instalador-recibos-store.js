/* ============================================================
   instalador-recibos-store.js
   Recibos de pagamento ao montador (15/10/2026). O Financeiro registra o pagamento feito (Omie), o sistema gera um
   link, o montador assina e atesta o recebimento; recibo ASSINADO do tipo 'adiantamento' é abatido das parcelas
   do contrato (aplicarAbatimento). Página pública do montador: /recibo/<token> (só RPCs por token).
   window.InstaladorRecibosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function agora() { return new Date().toISOString(); }
  function reciboId() { return 'REC-' + Date.now().toString().slice(-7) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(); }
  function quem() { const u = window.__VP_USER || {}; return u.nome || u.email || null; }

  /* Abatimento: recibos de ADIANTAMENTO já ASSINADOS descontam das parcelas PENDENTES, da primeira à última
     (parcela já paga não muda). Devolve, por parcela, { abatido, aPagar }. Em centavos pra não errar arredondamento. */
  function aplicarAbatimento(parcelas, recibos) {
    let sobra = Math.round((recibos || []).filter((r) => r.tipo === 'adiantamento' && r.status === 'assinado')
      .reduce((t, r) => t + Number(r.valor || 0), 0) * 100);
    const totalAbativel = sobra;
    const out = {};
    [...(parcelas || [])].sort((a, b) => (a.numero || 0) - (b.numero || 0)).forEach((p) => {
      const valor = Math.round(Number(p.valor || 0) * 100);
      if (p.status === 'paga') { out[p.id] = { abatido: 0, aPagar: valor / 100 }; return; }
      const ab = Math.min(sobra, valor);
      sobra -= ab;
      out[p.id] = { abatido: ab / 100, aPagar: (valor - ab) / 100 };
    });
    return { porParcela: out, totalAbativel: totalAbativel / 100, excedente: sobra / 100 };
  }

  function linkPublico(token) { return location.origin + '/recibo/' + token; }

  function validar(r) {
    const e = [];
    if (!r.parceiro_instalador_id) e.push('Escolha a empresa instaladora.');
    if (!(Number(r.valor) > 0)) e.push('Informe o valor pago (maior que zero).');
    if (!r.data_pagamento) e.push('Informe a data do pagamento.');
    if (r.tipo !== 'adiantamento' && r.tipo !== 'parcela') e.push('Tipo inválido.');
    return e;
  }

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('instalador_recibos').select('*').order('criado_em', { ascending: false }).limit(1000);
    if (error) { console.warn('[InstaladorRecibosStore] listar falhou', error); return []; }
    return data || [];
  }

  async function criar(r) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const erros = validar(r);
    if (erros.length) throw new Error(erros.join(' '));
    const row = {
      id: reciboId(), tipo: r.tipo, acordo_id: r.acordo_id || null, contrato_id: r.contrato_id || null, parcela_id: r.parcela_id || null,
      dossier_id: r.dossier_id || null, parceiro_instalador_id: r.parceiro_instalador_id, instalador_nome: r.instalador_nome || null,
      instalador_cnpj: r.instalador_cnpj || null, valor: Number(r.valor), data_pagamento: r.data_pagamento, forma: r.forma || null,
      descricao: (r.descricao || '').trim() || null, criado_por: quem(),
      log: [{ status: 'pendente', at: agora(), meta: { por: quem() } }],
    };
    const { data, error } = await c.from('instalador_recibos').insert(row).select().single();
    if (error) throw error;
    try {
      window.VPLog?.registrar({ modulo: 'Pagamentos a Instaladores', acao: 'Gerou recibo de pagamento', alvo: `${row.id} · ${row.instalador_nome || row.parceiro_instalador_id}`,
        alvo_id: row.id, detalhe: { valor: row.valor, tipo: row.tipo, dossier: row.dossier_id } });
    } catch (_) { /* log não impede */ }
    return data;
  }

  async function marcarEnviado(id) {
    const c = sb(); if (!c) return;
    await c.from('instalador_recibos').update({ enviado_em: agora(), atualizado_em: agora() }).eq('id', id).is('enviado_em', null);
  }

  async function cancelar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('instalador_recibos').update({ status: 'cancelado', atualizado_em: agora() })
      .eq('id', id).eq('status', 'pendente').select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Só é possível cancelar recibo pendente (ainda não assinado).');
  }

  /* ---- lado público (montador) — só por token, via RPC ---- */
  async function obterPorToken(token) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.rpc('public_recibo_obter', { p_token: token });
    if (error) { console.warn('[InstaladorRecibosStore] obter falhou', error); return null; }
    return data || null;
  }
  async function visualizado(token) { try { await sb().rpc('public_recibo_visualizado', { p_token: token }); } catch (_) { /* auditoria best-effort */ } }
  async function assinar(token, audit) {
    const { data, error } = await sb().rpc('public_recibo_assinar', { p_token: token, p_audit: audit });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.erro === 'nome_obrigatorio' ? 'Digite seu nome para assinar.' : 'Não foi possível assinar este recibo (' + ((data && data.erro) || 'erro') + ').');
    return data;
  }
  async function recusar(token, nome, motivo, audit) {
    const { data, error } = await sb().rpc('public_recibo_recusar', { p_token: token, p_nome: nome, p_motivo: motivo, p_audit: audit || {} });
    if (error) throw error;
    if (!data || !data.ok) throw new Error('Não foi possível registrar (' + ((data && data.erro) || 'erro') + ').');
    return data;
  }

  window.InstaladorRecibosStore = { aplicarAbatimento, linkPublico, validar, listar, criar, marcarEnviado, cancelar, obterPorToken, visualizado, assinar, recusar };
}());
