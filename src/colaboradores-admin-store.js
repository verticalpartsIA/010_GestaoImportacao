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

  /* ---------- Alçadas granulares (módulo → submódulo → ação) ----------
     Pedido do usuário 19/08: "Alocar em Módulo" não pode parar no grupo
     (Engenharia sim/não) — precisa entrar em cada submódulo (Ficha
     Técnica, Projeto de Elevadores...) e dentro dele dizer Criar/Editar/
     Excluir pra QUALQUER pessoa da empresa, não só vendedor. Catálogo é
     cópia estática dos itens navegáveis de NAV_GROUPS (shell.jsx) pelo
     mesmo motivo do GRUPOS_MODULO acima: não acoplar ordem de carga.
     Itens 'planned' (sem rota ainda) ficam de fora — não faz sentido dar
     alçada pra tela que não existe. Ações default cobrem o pedido
     explícito (Criar/Editar/Salvar~Editar/Excluir); Propostas mantém as
     3 capacidades específicas já em uso real (ver_todas,
     precificar_manual, destravar_aprovada — ver proposta-store.js). */
  const ACOES_PADRAO = [
    { chave: 'ver', label: 'Ver' },
    { chave: 'criar', label: 'Criar' },
    { chave: 'editar', label: 'Editar' },
    { chave: 'excluir', label: 'Excluir' },
  ];
  const CATALOGO_MODULOS = [
    { grupo: 'Administração geral', itens: [
      { modulo: 'admin', label: 'Conceder alçadas a outras pessoas', capacidades: [
        { chave: 'conceder_alcadas', label: 'Pode conceder (ou tirar) qualquer alçada de qualquer pessoa' },
      ]},
    ]},
    { grupo: 'Geral', itens: [
      { modulo: 'dashboard', label: 'Dashboard' },
      { modulo: 'notificacoes', label: 'Notificações' },
      { modulo: 'decisoes', label: 'Central de Decisões' },
      { modulo: 'financeiro', label: 'Gatilhos & Prazo' },
    ]},
    { grupo: 'Cadastros', itens: [
      { modulo: 'cadastro-clientes', label: 'Clientes' },
      { modulo: 'cadastro-fornecedores', label: 'Fornecedores' },
      { modulo: 'ncm-catalogo', label: 'Produtos' },
    ]},
    { grupo: 'Comercial', itens: [
      { modulo: 'leads', label: 'Leads' },
      { modulo: 'formularios', label: 'Formulários' },
      { modulo: 'propostas', label: 'Propostas', capacidades: [
        { chave: 'ver_todas', label: 'Vê propostas de outros vendedores' },
        { chave: 'precificar_manual', label: 'Precifica manualmente' },
        { chave: 'destravar_aprovada', label: 'Destrava proposta aprovada' },
        { chave: 'excluir', label: 'Exclui propostas' },
      ]},
      { modulo: 'controle-cotacoes', label: 'Controle de Cotações' },
    ]},
    { grupo: 'ADM/ Financeiro', itens: [
      { modulo: 'cotacoes-fornecedor', label: 'Cotações a Fornecedor' },
      { modulo: 'precificacao', label: 'Precificação' },
      { modulo: 'aval-financeiro', label: 'Aval Financeiro' },
    ]},
    { grupo: 'Jurídico | Importação | Suprimentos', itens: [
      { modulo: 'juridico', label: 'Jurídico' },
      { modulo: 'contrato-venda-equipamentos', label: 'Contrato Venda de Equipamentos' },
      { modulo: 'importacao', label: 'Importação' },
      { modulo: 'gi-painel', label: 'Painel (Gestão Importação)' },
      { modulo: 'pi-importacao', label: 'P.I.' },
      { modulo: 'rfq-importacao', label: 'RFQ' },
      { modulo: 'ims-importacao', label: 'IMS' },
      { modulo: 'embarques-importacao', label: 'Embarques' },
      { modulo: 'gi-analise-precos', label: 'Análise de Preços' },
      { modulo: 'compras', label: 'Compras Nacional' },
      { modulo: 'pedidos-acompanhamento', label: 'Pedidos' },
    ]},
    { grupo: 'Engenharia', itens: [
      { modulo: 'engenharia', label: 'Engenharia' },
      { modulo: 'eng-projeto-elevadores', label: 'Projeto de Elevadores' },
      { modulo: 'eng-configurador', label: 'Projeto de Equipamento' },
      { modulo: 'desenho-tecnico', label: 'Projetos ER/Es' },
      { modulo: 'ficha-tecnica', label: 'Ficha Técnica' },
      { modulo: 'contrato-instalador', label: 'Contrato Instalador' },
      { modulo: 'vistorias', label: 'Vistorias de Obras' },
      { modulo: 'instalacao', label: 'Instalação em Campo' },
      { modulo: 'status-obras', label: 'Status de Obras' },
      { modulo: 'linha-do-tempo', label: 'Linha do Tempo da Cotação' },
      { modulo: 'art', label: 'ART' },
      { modulo: 'cronograma', label: 'Cronograma' },
      { modulo: 'databook', label: 'Data Book & Termo' },
      { modulo: 'handover', label: 'Entrega Final' },
    ]},
    { grupo: 'Recursos Humanos', itens: [
      { modulo: 'rh-homologacao', label: 'Homologação de Parceiros Instaladores' },
    ]},
    { grupo: 'Logística', itens: [
      { modulo: 'almoxarifado', label: 'Almoxarifado' },
    ]},
    { grupo: 'Portal Admin', itens: [
      { modulo: 'logs', label: 'Logs de Atividade' },
    ]},
  ];

  async function listarCapacidadesConcedidas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('alcadas_capacidade').select('perfil_id, modulo, capacidade');
    if (error) return [];
    return data || [];
  }

  async function concederCapacidade(colaboradorId, modulo, capacidade, conceder) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (conceder) {
      const por = (window.__VP_USER || {}).email || null;
      const { error } = await c.from('alcadas_capacidade').upsert(
        { perfil_id: colaboradorId, modulo, capacidade, concedido_por: por, concedido_em: new Date().toISOString() },
        { onConflict: 'perfil_id,modulo,capacidade' },
      );
      if (error) throw error;
    } else {
      const { error } = await c.from('alcadas_capacidade').delete()
        .eq('perfil_id', colaboradorId).eq('modulo', modulo).eq('capacidade', capacidade);
      if (error) throw error;
    }
    if (window.PropostaStore) window.PropostaStore.resetAlcadasCache();
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
    ACOES_PADRAO, CATALOGO_MODULOS, listarCapacidadesConcedidas, concederCapacidade,
  };
}());
