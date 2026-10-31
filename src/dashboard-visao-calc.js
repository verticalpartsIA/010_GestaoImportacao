/* ============================================================
   dashboard-visao-calc.js — quem vê o quê no Dashboard (função pura, sem rede). Decisão do Gelson, 31/10/2026:
   o DEPARTAMENTO escolhe o conjunto de KPIs (perfil) e a ALÇADA (Administração › Alçadas) dá o limite do que a pessoa vê.
   Regras (docs/modulos/01_geral.md 1.1.10):
   - Administrador vê tudo e escolhe a visão (seletor "Visualizando como").
   - Perfil pelo departamento: Comercial, Engenharia, Adm/Financeiro e CEO ganham o seu; os demais (Logística, Importação,
     Marketing, Gente & Gestão, sem departamento) mantêm a visão COMPLETA de hoje (admin) até existir conjunto próprio.
   - Limite: cartão só aparece se a pessoa tem a alçada da tabela LIBERA. Quem não tem NENHUMA das alçadas de referência
     vê tudo; falha ao ler = vê tudo (nunca esconder por erro de leitura). Tarefas de Hoje: sempre.
   Exposto em window.DashboardVisao.
   ============================================================ */
(function () {
  'use strict';

  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const PERFIL_POR_DEPARTAMENTO = { 'comercial': 'comercial', 'engenharia': 'engenharia', 'adm/financeiro': 'financeiro', 'ceo': 'admin' };

  // modulo → ações que liberam. `propostas` usa ver_todas porque a ação `ver` não existe nesse módulo.
  const LIBERA = {
    leads: ['ver'], propostas: ['ver_todas'], 'cotacoes-fornecedor': ['ver'], financeiro: ['ver'], importacao: ['ver'],
    'eng-projeto-elevadores': ['ver'], 'ficha-tecnica': ['ver'], 'ncm-catalogo': ['ver'], 'contrato-venda-equipamentos': ['ver'],
    notificacoes: ['ver'],
  };
  // Alçadas que contam para a regra "nenhuma alçada de cartão = visão completa" (notificações fica de fora: quase todos a têm).
  const DE_REFERENCIA = Object.keys(LIBERA).filter((m) => m !== 'notificacoes');

  const MODULO_DO_CARTAO = {
    'Leads do mês': 'leads', 'Conversão Lead→Proposta': 'leads', 'Cot. em China': 'cotacoes-fornecedor', 'Propostas enviadas': 'propostas',
    'Projetos abertos': 'eng-projeto-elevadores', 'Fichas técnicas': 'ficha-tecnica', 'Catálogo (ativos)': 'ncm-catalogo', 'Alertas engenharia': 'notificacoes',
    'A receber': 'contrato-venda-equipamentos', 'Contratos abertos': 'contrato-venda-equipamentos', 'Comissões pendentes': 'financeiro', 'Gatilhos próx. 7d': 'financeiro',
    'Projetos ativos': 'financeiro', 'Embarques em trânsito': 'importacao', 'Alertas críticos': 'notificacoes', 'Faturamento (propostas assinadas)': 'propostas', 'Comissões (custo)': 'financeiro',
  };
  const MODULO_DO_BLOCO = {
    pipeline: 'propostas', origem: 'leads', ondeParou: 'financeiro', projetos: 'financeiro',
  };

  function perfilDoDepartamento(departamento) { return PERFIL_POR_DEPARTAMENTO[semAcento(departamento)] || null; }

  /* Perfil que carrega os KPIs. Admin escolhe; os demais seguem o departamento (sem perfil próprio = completo = 'admin').
     Sem dados (erro de leitura, sem login) = o que a pessoa escolheu, como hoje. */
  function perfilEfetivo({ ehAdmin, departamento, escolhido, semDados }) {
    if (semDados || ehAdmin) return escolhido;
    return perfilDoDepartamento(departamento) || 'admin';
  }

  const tem = (caps, modulo) => (LIBERA[modulo] || []).some((a) => caps.has(modulo + '.' + a));

  /* Devolve { limitado, pode(modulo) }. `caps` é um Set de "modulo.acao". */
  function visao({ ehAdmin, semDados, caps }) {
    if (ehAdmin || semDados || !caps) return { limitado: false, pode: () => true };
    const algumaDeReferencia = DE_REFERENCIA.some((m) => tem(caps, m));
    if (!algumaDeReferencia) return { limitado: false, pode: () => true };
    return { limitado: true, pode: (modulo) => !modulo || tem(caps, modulo) };
  }

  function filtrarCartoes(kpis, v) {
    const lista = kpis || [];
    const visiveis = lista.filter((k) => v.pode(MODULO_DO_CARTAO[k.label]));
    return { visiveis, ocultos: lista.length - visiveis.length };
  }
  const blocoVisivel = (bloco, v) => v.pode(MODULO_DO_BLOCO[bloco]);

  const api = { perfilDoDepartamento, perfilEfetivo, visao, filtrarCartoes, blocoVisivel, LIBERA, DE_REFERENCIA, MODULO_DO_CARTAO, MODULO_DO_BLOCO };
  if (typeof window !== 'undefined') window.DashboardVisao = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
