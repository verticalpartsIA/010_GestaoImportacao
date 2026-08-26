/* ============================================================
   central-documentos-store.js
   Central de Documentos (Biblioteca Virtual) — Fase 1: leitura agregada
   por OBRA (= cliente). ART e Documentação do Montador são por obra;
   dossier_obra hoje tem 1 linha por equipamento/cotação, então "obra"
   aqui é o agrupamento por client_name — várias linhas de dossier_obra
   do mesmo cliente viram uma única entrada, e os documentos são a
   união de todas elas. Vistoria é por equipamento (fora do escopo
   desta fase — entra numa aba "Equipamentos" futura).
   Consolida, sem duplicar dado nenhum:
     - dossier_documentos   (ART, Termo de Vistoria, DataBook, etc.)
     - parceiros_documentos_colaborador, via equipamentos_obra →
       parceiros_instaladores → parceiros_colaboradores
   Fase 1 é só leitura: sem pipeline de envio, sem tabela de log.
   window.CentralDocumentos — expõe as funções de agregação.
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Mesmo catálogo de TIPOS_DOC_OBRA usado em dossier-obra.jsx — duplicado
     de propósito (é só rótulo/obrigatoriedade pra exibição, a fonte de
     verdade continua sendo a linha em dossier_documentos). Se um dia esse
     catálogo virar tabela, os dois lugares leem da mesma fonte. */
  const TIPOS_DOC_OBRA = [
    { tipo: 'ART', label: 'ART (CREA)', obrigatorio: true },
    { tipo: 'Termo de Vistoria', label: 'Termo de Vistoria', obrigatorio: true },
    { tipo: 'DataBook', label: 'DataBook (Ebook técnico)', obrigatorio: true },
    { tipo: 'Termo de Entrega', label: 'Termo de Entrega Final', obrigatorio: true },
    { tipo: 'Alvará', label: 'Alvará', obrigatorio: false },
    { tipo: 'Contrato Instalador', label: 'Contrato VerticalParts x Parceiro Instalador', obrigatorio: false },
    { tipo: 'NRs', label: 'NRs (NR-10/NR-35 do parceiro instalador)', obrigatorio: false },
    { tipo: 'ASO', label: 'ASO (Atestado de Saúde Ocupacional)', obrigatorio: false },
    { tipo: 'PCMSO/PGR', label: 'PCMSO/PGR', obrigatorio: false },
    { tipo: 'Cronograma', label: 'Cronograma de compra, importação e montagem', obrigatorio: false },
  ];

  /* Lista de obras (agrupadas por cliente) pro seletor. Cada obra carrega
     a lista de dossier_ids dos equipamentos que a compõem — é essa lista
     que alimenta a agregação de documentos. */
  async function listarObras() {
    const c = sb();
    if (!c) return [];
    const { data } = await c.from('dossier_obra')
      .select('id, building_name, client_name, numero_cotacao, status_master, parceiro_instalador_id')
      .order('client_name', { ascending: true });

    const map = {};
    (data || []).forEach((r) => {
      const key = r.client_name || '(sem cliente)';
      if (!map[key]) map[key] = { client_name: key, dossierIds: [], equipamentos: [], parceiroInstaladorIds: [], status_master: r.status_master };
      map[key].dossierIds.push(r.id);
      map[key].equipamentos.push({ id: r.id, building_name: r.building_name, numero_cotacao: r.numero_cotacao });
      if (r.parceiro_instalador_id && !map[key].parceiroInstaladorIds.includes(r.parceiro_instalador_id)) {
        map[key].parceiroInstaladorIds.push(r.parceiro_instalador_id);
      }
    });
    return Object.values(map);
  }

  async function _documentosDaObra(dossierIds) {
    const c = sb();
    const { data } = await c.from('dossier_documentos')
      .select('*').in('dossier_id', dossierIds)
      .order('data_criacao', { ascending: false });
    const byType = {};
    (data || []).forEach((d) => { (byType[d.tipo] = byType[d.tipo] || []).push(d); });
    return TIPOS_DOC_OBRA.map((t) => {
      const items = byType[t.tipo] || [];
      return {
        tipo: t.tipo, label: t.label, obrigatorio: t.obrigatorio, itens: items,
        status: items.length > 0 ? 'disponivel' : (t.obrigatorio ? 'pendente' : 'na'),
      };
    });
  }

  /* Empresa(s) instaladora(s) vinculada(s) à obra — vínculo oficial é
     dossier_obra.parceiro_instalador_id, escrito por
     InstalacaoObraStore.vincularParceiroInstalador() na tela Dossiê da
     Obra (não equipamentos_obra, que é um campo por-equipamento
     diferente, usado só na aba de instalação). Uma obra pode juntar
     dossiers com instaladores distintos (raro, mas possível) — daí a
     lista de ids em vez de um único id. */
  async function _montadorDaObra(parceiroInstaladorIds) {
    const c = sb();
    if (!parceiroInstaladorIds?.length) return [];
    const { data: empresas } = await c.from('parceiros_instaladores')
      .select('id, nome').in('id', parceiroInstaladorIds);

    const resultado = [];
    for (const empresa of (empresas || [])) {
      const { data: colaboradores } = await c.from('parceiros_colaboradores')
        .select('id, nome_completo').eq('empresa_id', empresa.id);
      const colabsComDocs = [];
      for (const colab of (colaboradores || [])) {
        const { data: docs } = await c.from('parceiros_documentos_colaborador')
          .select('*, parceiros_doc_catalogo(nome, obrigatorio)')
          .eq('colaborador_id', colab.id);
        colabsComDocs.push({
          ...colab,
          documentos: (docs || []).map((d) => ({
            ...d,
            status: d.status === 'VALIDO' ? 'disponivel' : (d.status === 'VENCIDO' ? 'pendente' : 'na'),
          })),
        });
      }
      resultado.push({ empresa, colaboradores: colabsComDocs });
    }
    return resultado;
  }

  /* Agregado único pra uma obra (união de todos os dossierIds do cliente).
     Fase 1: sem vistoria (é por equipamento — vem na aba Equipamentos) e
     sem status "enviado" (não existe campo de rastreio de envio ainda —
     isso é a Fase 2 do módulo). */
  async function carregarChecklistObra(dossierIds, parceiroInstaladorIds) {
    const c = sb();
    if (!c || !dossierIds?.length) return null;
    const [documentosObra, montador] = await Promise.all([
      _documentosDaObra(dossierIds),
      _montadorDaObra(parceiroInstaladorIds),
    ]);
    return { documentosObra, montador };
  }

  window.CentralDocumentos = {
    TIPOS_DOC_OBRA,
    listarObras,
    carregarChecklistObra,
  };
})();
