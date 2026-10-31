/* ============================================================
   vp-log.js — Registro central de atividades (auditoria global).
   Toda ação relevante de qualquer módulo passa por aqui:
   quem fez · o que fez · onde (módulo) · alvo · dia e hora.
   Tabela vp_logs (append-only — RLS só INSERT+SELECT).
   Carregar logo após supabase.js. window.VPLog.
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Ator: prioriza a identidade real vinda do SSO do vpsistema
     (window.__VP_USER — nome + e-mail do convite); o role do app vira o
     setor. Fallback: rótulo do setor. Pode ser sobrescrito por ev.ator_nome
     (ex.: fornecedor no portal público). */
  function ator() {
    let r = 'admin';
    try { r = JSON.parse(localStorage.getItem('vpprd.role')) || 'admin'; } catch (e) {}
    let u = window.__VP_USER;
    if (!u) { try { u = JSON.parse(sessionStorage.getItem('vpprd_user')); } catch (e) {} }
    const nomes = { comercial: 'Comercial', engenharia: 'Engenharia', financeiro: 'Financeiro', importacao: 'Importação', admin: 'Admin' };
    return {
      nome: (u && u.nome) || nomes[r] || r,
      setor: r,
      email: (u && u.email) || null,
    };
  }

  /* Registrar evento. Best-effort: nunca quebra o fluxo principal. */
  async function registrar(ev) {
    try {
      const c = sb(); if (!c || !ev || !ev.acao) return;
      const a = ator();
      let detalhe = ev.detalhe || null;
      // Texto solto vira { texto } — senão o espalhamento abaixo transforma "OP liberada" em {0:'O',1:'P',…} (logs do MES).
      if (typeof detalhe === 'string') detalhe = { texto: detalhe };
      /* anexa o e-mail real do SSO quando o ator é o usuário logado */
      if (!ev.ator_nome && a.email) detalhe = { ...(detalhe || {}), email: a.email };
      const { error } = await c.from('vp_logs').insert({
        ator_nome: ev.ator_nome || a.nome,
        ator_setor: ev.ator_setor || a.setor,
        modulo: ev.modulo || 'Sistema',
        acao: ev.acao,
        alvo: ev.alvo || null,
        alvo_id: ev.alvo_id != null ? String(ev.alvo_id) : null,
        detalhe,
      });
      // supabase-js não lança em erro do PostgREST (RLS, constraint): sem isto a falha some em silêncio.
      if (error) console.warn('[VPLog] registrar não gravou', error.message || error);
    } catch (e) { console.warn('[VPLog] registrar falhou', e); }
  }

  /* Listar com filtros: { modulo, busca, de, ate, limit } */
  async function listar(f) {
    const c = sb(); if (!c) return [];
    f = f || {};
    let q = c.from('vp_logs').select('*').order('criado_em', { ascending: false }).limit(f.limit || 300);
    if (f.modulo && f.modulo !== 'Todos') q = q.eq('modulo', f.modulo);
    if (f.de) q = q.gte('criado_em', f.de);
    if (f.ate) q = q.lte('criado_em', f.ate + 'T23:59:59');
    if (f.busca) {
      const s = f.busca.replace(/[%,()]/g, ' ').trim();
      if (s) q = q.or(`ator_nome.ilike.%${s}%,acao.ilike.%${s}%,alvo.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) { console.warn('[VPLog] listar falhou', error.message); return []; }
    return data || [];
  }

  async function modulos() {
    const c = sb(); if (!c) return [];
    const { data } = await c.from('vp_logs').select('modulo').limit(1000);
    return Array.from(new Set((data || []).map(r => r.modulo))).sort();
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  window.VPLog = { registrar, listar, modulos, ator, fmtDateTime };
}());
