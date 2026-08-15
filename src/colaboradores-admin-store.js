/* ============================================================
   colaboradores-admin-store.js
   Administração — espelho de vpsistema.profiles (colaboradores_vpsistema,
   SÓ LEITURA — nome/foto/departamento real vêm de lá, nunca editados
   por aqui) + alocação de colaborador em grupo(s) de módulo do VP Gestão
   (colaborador_alocacoes, nossa própria tabela, essa sim editável).

   A alocação é o que controla o que cada colaborador vê na sidebar —
   diferente do departamento real (único, do RH): um mesmo colaborador
   pode estar alocado em vários grupos de módulo ao mesmo tempo.

   window.ColaboradoresAdminStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Mesma lista de labels usada em NAV_GROUPS (shell.jsx) — é o que existe
     pra alocar. Mantido aqui como cópia estática de propósito: evita
     acoplar a ordem de carregamento dos dois arquivos. */
  const GRUPOS_MODULO = [
    'Geral', 'Comercial', 'ADM/ Financeiro', 'Cadastros',
    'Jurídico | Importação | Suprimentos', 'Engenharia',
    'Recursos Humanos', 'Logística', 'Portal Admin',
  ];

  async function listarColaboradores() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('colaboradores_vpsistema').select('*').order('departamento').order('nome');
    if (error) { console.warn('[ColaboradoresAdminStore] listarColaboradores falhou', error); return []; }
    return data || [];
  }

  async function listarAlocacoes() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('colaborador_alocacoes').select('*');
    if (error) return [];
    return data || [];
  }

  /* Colaboradores agrupados por departamento real, cada um já com suas
     alocações de módulo — uma única leitura, monta tudo que a tela precisa. */
  async function arvoreDepartamentos() {
    const [colaboradores, alocacoes] = await Promise.all([listarColaboradores(), listarAlocacoes()]);
    const alocPorColaborador = {};
    alocacoes.forEach((a) => { (alocPorColaborador[a.colaborador_id] = alocPorColaborador[a.colaborador_id] || []).push(a.grupo_modulo); });

    const grupos = {};
    colaboradores.forEach((col) => {
      const dep = col.departamento || 'Sem departamento';
      (grupos[dep] = grupos[dep] || []).push({ ...col, alocacoes: alocPorColaborador[col.id] || [] });
    });
    Object.values(grupos).forEach((lista) => lista.sort((a, b) => (b.is_department_lead - a.is_department_lead) || a.nome.localeCompare(b.nome)));

    return Object.keys(grupos).sort((a, b) => (a === 'Sem departamento') - (b === 'Sem departamento') || a.localeCompare(b))
      .map((dep) => ({ departamento: dep, colaboradores: grupos[dep] }));
  }

  async function alocar(colaboradorId, grupoModulo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { error } = await c.from('colaborador_alocacoes').insert({ colaborador_id: colaboradorId, grupo_modulo: grupoModulo, alocado_por: user.email || null });
    if (error && error.code !== '23505') throw error; // 23505 = já alocado, idempotente
  }

  async function desalocar(colaboradorId, grupoModulo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('colaborador_alocacoes').delete().eq('colaborador_id', colaboradorId).eq('grupo_modulo', grupoModulo);
    if (error) throw error;
  }

  /* "Excluir" na tela de Administração — remove todas as alocações do
     colaborador (revoga o acesso aos módulos do VP Gestão). NÃO apaga o
     colaborador nem toca em nada no vpsistema — a pessoa continua existindo
     e o RH continua sendo a fonte da verdade sobre ela. */
  async function removerTodasAlocacoes(colaboradorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('colaborador_alocacoes').delete().eq('colaborador_id', colaboradorId);
    if (error) throw error;
  }

  /* Roda quando a identidade chega (evento 'vpprd:user' de supabase.js) —
     acha o colaborador correspondente pelo id (vem do JWT do vpsistema,
     mesmo id de profiles/colaboradores_vpsistema) e enriquece
     window.__VP_USER com foto real + os grupos alocados, depois redispara
     o evento pra Shell/sidebar re-renderizarem já com a foto. */
  async function enriquecerUsuarioLogado() {
    const c = sb(); const u = window.__VP_USER;
    if (!c || !u || !u.id || u.id === 'dev-local') return;
    try {
      const { data: col } = await c.from('colaboradores_vpsistema').select('id, avatar_url, departamento').eq('id', u.id).maybeSingle();
      if (!col) return;
      const { data: aloc } = await c.from('colaborador_alocacoes').select('grupo_modulo').eq('colaborador_id', col.id);
      window.__VP_USER = { ...u, avatarUrl: col.avatar_url || null, departamentoReal: col.departamento || null, gruposAlocados: (aloc || []).map((a) => a.grupo_modulo) };
      try { sessionStorage.setItem('vpprd_user', JSON.stringify(window.__VP_USER)); } catch (e) {}
      window.dispatchEvent(new CustomEvent('vpprd:user', { detail: window.__VP_USER }));
    } catch (e) { console.warn('[ColaboradoresAdminStore] enriquecerUsuarioLogado falhou', e); }
  }

  window.addEventListener('vpprd:user', () => { if (!(window.__VP_USER || {}).avatarUrl) enriquecerUsuarioLogado(); });
  if (window.__VP_USER) enriquecerUsuarioLogado();

  window.ColaboradoresAdminStore = {
    GRUPOS_MODULO, listarColaboradores, listarAlocacoes, arvoreDepartamentos,
    alocar, desalocar, removerTodasAlocacoes, enriquecerUsuarioLogado,
  };
}());
