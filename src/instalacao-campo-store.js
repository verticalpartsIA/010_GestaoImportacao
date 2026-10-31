/* ============================================================
   instalacao-campo-store.js — carrega os dados reais da página
   "Instalação em Campo" (29/10/2026). Só leitura, uma única rodada de
   4 consultas em paralelo (sem repetir chamadas ao Supabase por grupo
   nem por clique) — o agrupamento em si é feito no navegador por
   window.InstalacaoCampoCalc.agruparPorCliente.
   `dossier_obra_instaladores` é o elenco de instaladores por obra
   (mesma tabela que o Mapa de Obras já junta ao `parceiro_instalador_id`
   legado) — uma obra pode ter mais de um instalador cadastrado só ali
   (achado real de revisão: DOS-M022 tem 2, além do legado).
   window.InstalacaoCampoStore
   ============================================================ */
(function () {
  'use strict';

  async function carregar() {
    const sb = (window.__VP_SB || {}).sb;
    if (!sb) throw new Error('Banco de dados indisponível.');
    const [dRes, eRes, pRes, rRes] = await Promise.all([
      sb.from('dossier_obra').select('id, client_name, building_name, city, state, status_master, equipamento_entregue, equipamento_entregue_em, numero_cotacao, parceiro_instalador_id, codigo_obra'),
      sb.from('equipamentos_obra').select('id, dossier_id, numero_serie, tipo, descricao'),
      sb.from('parceiros_instaladores').select('id, nome'),
      sb.from('dossier_obra_instaladores').select('dossier_id, parceiro_instalador_id'),
    ]);
    if (dRes.error) throw dRes.error;
    if (eRes.error) throw eRes.error;
    if (pRes.error) throw pRes.error;
    if (rRes.error) throw rRes.error;
    return { dossies: dRes.data || [], equipamentos: eRes.data || [], instaladores: pRes.data || [], elenco: rRes.data || [] };
  }

  window.InstalacaoCampoStore = { carregar };
}());
