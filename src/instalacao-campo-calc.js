/* ============================================================
   instalacao-campo-calc.js — regras puras de "Instalação em Campo"
   (29/10/2026). Agrupa os dossiês ativos — mesma classificação do Mapa
   de Obras, window.MapaObrasCalc.classificar: "andamento" (Montando) e
   "aguardando" (Prestes a iniciar); "concluida" e fases antes do
   contrato ficam fora — por CLIENTE, listando os equipamentos
   (equipamentos_obra) de cada obra do cliente.

   Cada grupo ganha um "código Pai" (só exibição, nada é gravado):
     - obra NATIVA do site (numero_cotacao preenchido) → o mesmo VPNI
       que Contrato do Instalador/Contrato de Venda já usam
       (MasterIdEngine.etapaId('contrato_instalador', numeroCotacao));
     - obra LEGADA (sem cotação, id tipo "DOS-M0NN") → VPNI-OB<NNNN>,
       extraído do menor sufixo numérico entre os dossiês do cliente —
       estável (um dossiê novo nunca renumera os já existentes) e nunca
       persistido (não é um Master ID real, é só um rótulo desta tela).

   Só leitura — nada aqui grava no banco.
   window.InstalacaoCampoCalc
   ============================================================ */
(function () {
  'use strict';

  const limpo = (v) => String(v == null ? '' : v).trim();

  /* "DOS-M047" → 47. Sem esse padrão (id aleatório, planilha antiga…),
     um número estável derivado do próprio texto — nunca falha, mas
     também não inventa um Nº "bonito" só pra parecer sequencial. */
  function numeroLegado(dossierId) {
    const s = limpo(dossierId);
    const m = /^DOS-M0*(\d+)$/i.exec(s);
    if (m) return parseInt(m[1], 10);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 1000 + (h % 9000);
  }

  function codigoObraLegada(dossierId) {
    return 'VPNI-OB' + String(numeroLegado(dossierId)).padStart(4, '0');
  }

  /* Código Pai do GRUPO (cliente): usa o Nº de cotação do site quando
     algum dossiê do cliente já tem um (nunca houve, na prática, 2
     cotações distintas para o mesmo client_name — se acontecer um dia,
     a primeira encontrada vence); senão, o menor Nº legado entre os
     dossiês do cliente. */
  function codigoPaiGrupo(dossiesCliente) {
    const comCotacao = (dossiesCliente || []).find((d) => d && d.numero_cotacao != null);
    if (comCotacao && window.MasterIdEngine) {
      return {
        codigo: window.MasterIdEngine.etapaId('contrato_instalador', comCotacao.numero_cotacao),
        nativo: true,
        numeroCotacao: comCotacao.numero_cotacao,
      };
    }
    const menor = (dossiesCliente || []).slice().sort((a, b) => numeroLegado(a.id) - numeroLegado(b.id))[0];
    return { codigo: menor ? codigoObraLegada(menor.id) : null, nativo: false, numeroCotacao: null };
  }

  function slug(s) {
    return limpo(s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /**
   * @param dossies       linhas de dossier_obra
   * @param equipamentos  linhas de equipamentos_obra (dossier_id, numero_serie, descricao)
   * @param instaladores  linhas de parceiros_instaladores (id, nome)
   * @returns [{ clienteId, cliente, situacao, codigoPai, nativo, numeroCotacao,
   *             cidades, instaladores, nDossies, equipamentos:[{dossierId,descricao,codigo,status,entregue}] }]
   */
  function agruparPorCliente(dossies, equipamentos, instaladores) {
    const MO = window.MapaObrasCalc;
    if (!MO) return [];

    const eqPorDossie = {};
    (equipamentos || []).forEach((e) => {
      if (!e || !e.dossier_id) return;
      (eqPorDossie[e.dossier_id] = eqPorDossie[e.dossier_id] || []).push(e);
    });
    const instPorId = {};
    (instaladores || []).forEach((p) => { if (p && p.id) instPorId[p.id] = p.nome; });

    const porCliente = {};
    (dossies || []).forEach((d) => {
      const situacao = MO.classificar(d);
      if (situacao !== 'andamento' && situacao !== 'aguardando') return;
      const cliente = limpo(d.client_name) || '(sem cliente)';
      (porCliente[cliente] = porCliente[cliente] || []).push(d);
    });

    const grupos = Object.keys(porCliente).map((cliente) => {
      const dossiesCliente = porCliente[cliente];
      /* Situação do grupo: se o cliente tiver dossiês nas duas situações
         (não acontece hoje — conferido — mas não trava se um dia acontecer),
         "andamento" pesa mais: já tem obra sendo montada de verdade. */
      const situacao = dossiesCliente.some((d) => MO.classificar(d) === 'andamento') ? 'andamento' : 'aguardando';
      const pai = codigoPaiGrupo(dossiesCliente);
      const cidades = Array.from(new Set(dossiesCliente
        .map((d) => [limpo(d.city), limpo(d.state)].filter(Boolean).join('/'))
        .filter(Boolean)));
      const instaladoresGrupo = Array.from(new Set(dossiesCliente
        .map((d) => d.parceiro_instalador_id && instPorId[d.parceiro_instalador_id])
        .filter(Boolean)));

      const equipamentos2 = [];
      dossiesCliente
        .slice()
        .sort((a, b) => limpo(a.building_name).localeCompare(limpo(b.building_name), 'pt-BR', { numeric: true }))
        .forEach((d) => {
          const lista = (eqPorDossie[d.id] || []).slice()
            .sort((a, b) => limpo(a.numero_serie).localeCompare(limpo(b.numero_serie), 'pt-BR', { numeric: true }));
          if (!lista.length) {
            equipamentos2.push({
              dossierId: d.id, descricao: limpo(d.building_name) || '(sem descrição)',
              codigo: null, status: d.status_master, entregue: !!d.equipamento_entregue,
            });
            return;
          }
          lista.forEach((e) => equipamentos2.push({
            dossierId: d.id,
            descricao: limpo(e.descricao) || limpo(d.building_name) || '(sem descrição)',
            codigo: limpo(e.numero_serie) || null,
            status: d.status_master,
            entregue: !!d.equipamento_entregue,
          }));
        });

      return {
        clienteId: slug(cliente) || 'cliente',
        cliente,
        situacao,
        codigoPai: pai.codigo,
        nativo: pai.nativo,
        numeroCotacao: pai.numeroCotacao,
        cidades,
        instaladores: instaladoresGrupo,
        nDossies: dossiesCliente.length,
        equipamentos: equipamentos2,
      };
    });

    grupos.sort((a, b) => (a.situacao === b.situacao
      ? a.cliente.localeCompare(b.cliente, 'pt-BR')
      : (a.situacao === 'andamento' ? -1 : 1)));
    return grupos;
  }

  window.InstalacaoCampoCalc = { numeroLegado, codigoObraLegada, codigoPaiGrupo, agruparPorCliente };
}());
