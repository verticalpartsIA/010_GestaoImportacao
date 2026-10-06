/* ============================================================
   pcp-etapas-omie.js — nomes das etapas do pedido de VENDA do Omie, compartilhados pelas telas do PCP
   (Relatórios, Painel de Fluxo de Caixa, Emissão de NF). Antes cada tela tinha a sua cópia da tabela.
   A etapa 80 é personalizada na conta do Omie da empresa (não faz parte das etapas padrão).
   Também: pcpDiasTxt (texto de tempo padronizado) e pcpIrParaUrl (abre uma aba do PCP pelo endereço, como o Voltar do navegador).
   ============================================================ */
window.PCP_ETAPAS_OMIE = { '00': 'Proposta', '10': 'Pedido de Venda', '20': 'Separar estoque / produção', '50': 'Faturar', '60': 'Faturado', '70': 'Entrega', '80': 'Etapa 80 (personalizada no Omie)' };
window.pcpEtapaNome = function (e) { return window.PCP_ETAPAS_OMIE[e] || (e ? 'Etapa ' + e : '—'); };
window.pcpDiasTxt = function (n) { return n == null ? '—' : n <= 0 ? 'hoje' : n === 1 ? '1 dia' : n + ' dias'; };
window.pcpIrParaUrl = function (path) {
  try { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) { /* ok */ }
};
