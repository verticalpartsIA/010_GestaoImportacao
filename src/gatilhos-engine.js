/* ============================================================
   gatilhos-engine.js
   Motor de "Gatilhos & Prazo" — cada nó nasce automaticamente quando
   o evento anterior da cadeia acontece (EventosFluxo), e fecha quando
   o próprio evento dele acontece. Cadeia de tarefas por Nº da Cotação,
   igual dependência de tarefas em ProjectLibre/MS Project — hoje só
   usamos TI (FS, término-início) e II (SS, início-início); ver
   instrucaocompra.md na raiz do repo para o desenho completo e os
   tipos de relacionamento ainda não usados (TT/IT).

   Prazos (SLA_HORAS) são os números reais passados pelo usuário —
   não são mais placeholder. `due_date` (coluna `date`, legado) fica
   como derivado pra CSV/ordenação; `prazo_em` (timestamptz) é a
   referência de verdade pra cálculo de Gantt em horas.

   window.GatilhosEngine = { NODES, SLA_HORAS, LEMBRETES, onEvento,
                              verificarPrazos, fecharLembrete, navegarPara,
                              profundidade }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const SLA_HORAS = {
    SLA_FORNECEDOR: 48,
    PRECIFICACAO: 5,
    /* 10 dias (23/08, Gelson) — não é mais só um SLA informativo: é o
       limiar do "Cemitério". Depois disso, verificarPrazos() marca
       status 'revisao_necessaria' e a tela de Gatilhos destaca "parado
       há Xd sem resposta do cliente", com botão pro vendedor investigar
       e fechar o ciclo com motivo (fecharComMotivo) — só o cliente tem
       poder de matar o fluxo; até lá, ninguém mais fecha essa etapa. */
    AGUARDA_CLIENTE: 10 * 24,      // 240h — limiar do Cemitério
    CONTRATO_ENVIADO: 24,
    PROJETO_ENVIADO: 24,
    AGUARDA_ASSINATURA: 5 * 24,    // 120h
    AGUARDA_BOLETO: 3 * 24,        // 72h
    AVAL_PAGAMENTO: 4,
    NEGOCIACAO_COMPRA: 7 * 24,     // 168h
    EMBARQUE_CHEGADA: 90 * 24,     // 2160h
  };

  /* Lembretes de cobrança — nascem como um gatilho-filho (evento_key
     'LEMBRETE__<chaveDoPai>') quando o nó pai passa de X horas sem
     fechar. Verificados sob demanda em verificarPrazos() — não há
     cron neste projeto, então só atualiza quando alguém abre a tela
     "Gatilhos & Prazo" (ver instrucaocompra.md). */
  const LEMBRETES = {
    AGUARDA_CLIENTE:     { apósHoras: 7 * 24,  label: 'Cobrar cliente sobre a Proposta' },
    AGUARDA_ASSINATURA:  { apósHoras: 3 * 24,  label: 'Cobrar cliente sobre a assinatura do Contrato' },
  };

  /* Resolvers de navegação (etapa 3) — dado o alvo_id gravado no nó,
     devolvem o `subsel` no formato que a rota de destino já espera (ver
     app.jsx). Onde a tela ainda não aceita deep-link (Contrato de Venda,
     Aval Financeiro, Projeto de Engenharia, Precificação), o nó só
     declara `rota` — clique pousa na lista, sem subsel. */
  const resolverIdDireto = async (alvoId) => alvoId || null;
  const resolverEditProposta = async (alvoId) => (alvoId ? { __editId: alvoId } : null);
  const resolverCotacaoFornecedor = async (alvoId) => {
    if (!alvoId || !window.CotacaoElevadorFornecedorStore) return null;
    try { return await window.CotacaoElevadorFornecedorStore.getById(alvoId); }
    catch (e) { console.warn('[GatilhosEngine] resolverCotacaoFornecedor falhou', e); return null; }
  };

  /* Cada nó: { key, label, predecessores:[{key, rel}], nasce, fecha,
     fechamentoTipo, condicaoNasce(detalhe) opcional para branches,
     rota (nome da rota em app.jsx), resolverSubsel (opcional). */
  const NODES = [
    { key: 'FORMULARIO', label: 'Formulário preenchido',
      predecessores: [], nasce: 'FORMULARIO_PREENCHIDO', fecha: 'COTACAO_ENVIADA_FORNECEDOR',
      fechamentoTipo: 'automatico', rota: 'formulario-elevador', resolverSubsel: resolverIdDireto },

    { key: 'SLA_FORNECEDOR', label: 'Aguardando resposta do Fornecedor (SLA 48h)',
      predecessores: [{ key: 'FORMULARIO', rel: 'FS' }],
      nasce: 'COTACAO_ENVIADA_FORNECEDOR', fecha: 'FORNECEDOR_RESPONDEU',
      fechamentoTipo: 'automatico', rota: 'cotacao-fornecedor-detail', resolverSubsel: resolverCotacaoFornecedor },

    { key: 'PRECIFICACAO', label: 'Financeiro precificando (SLA 5h)',
      predecessores: [{ key: 'SLA_FORNECEDOR', rel: 'FS' }],
      nasce: 'FORNECEDOR_RESPONDEU', fecha: 'PROPOSTA_ELABORADA',
      fechamentoTipo: 'automatico', rota: 'precificacao' },

    { key: 'PROPOSTA_PREP', label: 'Proposta pronta — aguardando envio manual',
      predecessores: [{ key: 'PRECIFICACAO', rel: 'FS' }],
      nasce: 'PROPOSTA_ELABORADA', fecha: 'PROPOSTA_ENVIADA',
      fechamentoTipo: 'manual', rota: 'proposta-editor', resolverSubsel: resolverEditProposta },

    { key: 'AGUARDA_CLIENTE', label: 'Aguardando resposta do Cliente (SLA 10 dias)',
      predecessores: [{ key: 'PROPOSTA_PREP', rel: 'FS' }],
      nasce: 'PROPOSTA_ENVIADA', fecha: 'CLIENTE_RESPONDEU_PROPOSTA',
      fechamentoTipo: 'automatico', rota: 'proposta-editor', resolverSubsel: resolverEditProposta },

    { key: 'CONTRATO_ENVIADO', label: 'Contrato enviado ao Cliente (SLA 24h)',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'aprovada',
      fecha: 'CONTRATO_VENDA_ENVIADO', fechamentoTipo: 'automatico', rota: 'contrato-venda-equipamentos' },

    { key: 'PROJETO_ENVIADO', label: 'Projeto de Engenharia enviado ao Cliente (SLA 24h)',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }, { key: 'CONTRATO_ENVIADO', rel: 'SS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'aprovada',
      fecha: 'PROJETO_ELEVADOR_FINALIZADO', fechamentoTipo: 'automatico', rota: 'eng-projeto-elevadores' },

    { key: 'AGUARDA_ASSINATURA', label: 'Aguardando assinatura do Contrato (SLA 5 dias)',
      predecessores: [{ key: 'CONTRATO_ENVIADO', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ENVIADO', fecha: 'CONTRATO_VENDA_ASSINADO',
      fechamentoTipo: 'automatico', rota: 'contrato-venda-equipamentos' },

    { key: 'AGUARDA_BOLETO', label: 'Aguardando pagamento do Boleto (SLA 3 dias)',
      predecessores: [{ key: 'AGUARDA_ASSINATURA', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ASSINADO', fecha: 'SINAL_PAGO',
      fechamentoTipo: 'manual' /* Financeiro clica "Boleto pago" — AvalFinanceiroStore.confirmarSinal() */,
      rota: 'aval-financeiro' },

    { key: 'AVAL_PAGAMENTO', label: 'Aguardando Aval de Pagamento (SLA 4h)',
      predecessores: [{ key: 'AGUARDA_BOLETO', rel: 'FS' }],
      nasce: 'SINAL_PAGO', fecha: 'AVAL_PAGAMENTO_CONFIRMADO',
      fechamentoTipo: 'manual' /* Financeiro clica "Dar Aval de Pagamento" — confirmarAvalPagamento() */,
      rota: 'aval-financeiro' },

    { key: 'COMPRA_LIBERADA', label: 'Compra ao Fornecedor liberada',
      predecessores: [{ key: 'AVAL_PAGAMENTO', rel: 'FS' }],
      nasce: 'AVAL_PAGAMENTO_CONFIRMADO', fecha: 'COMPRA_FORNECEDOR_INICIADA',
      fechamentoTipo: 'automatico' /* botão "Decidir Comprar" já existente em Cotação a Fornecedor */,
      rota: 'cotacao-fornecedor-detail', resolverSubsel: resolverCotacaoFornecedor },

    { key: 'NEGOCIACAO_COMPRA', label: 'Negociação e Compra do Produto (SLA 7 dias)',
      predecessores: [{ key: 'COMPRA_LIBERADA', rel: 'FS' }],
      nasce: 'COMPRA_FORNECEDOR_INICIADA', fecha: 'COMPRA_FORNECEDOR_CONFIRMADA',
      fechamentoTipo: 'automatico', rota: 'cotacao-fornecedor-detail', resolverSubsel: resolverCotacaoFornecedor },

    { key: 'EMBARQUE_CHEGADA', label: 'Embarque até chegada no Brasil (SLA 90 dias)',
      predecessores: [{ key: 'NEGOCIACAO_COMPRA', rel: 'FS' }],
      nasce: 'COMPRA_FORNECEDOR_CONFIRMADA', fecha: null /* ainda sem evento — logística não é wired em eventos_fluxo */,
      fechamentoTipo: 'manual', rota: 'cotacao-fornecedor-detail', resolverSubsel: resolverCotacaoFornecedor },

    /* ==========================================================
       Extensão 23/08 — checklist completo de 73 etapas (ver Gatilhos.md
       do usuário). Cobre os itens que a versão original da engine (acima)
       deixava de fora: gates 21/22/27/28 (existiam como evento, sem nó),
       e 33-73 inteiros (Engenharia final, Compra/Embarque, Dossiê/Vistoria,
       RH/Instalador, Instalação, Documentação final/Handover).

       `fecha: null` = o evento existe no catálogo (eventos-fluxo-store.js)
       mas NENHUM lugar do código dispara ele ainda — ou porque a ação não
       tem tela/campo hoje (ex.: aprovação do Projeto pelo Cliente), ou
       porque é um dado sem ponto de ação claro (ex.: Cargo Ready, hoje
       provavelmente só uma data digitada, não um clique). Isso é
       intencional: fica visível no checklist como "planejado, não
       automatizado" em vez de fingir que existe.
       ========================================================== */

    /* ---- Gates 21/22 (Score + Aval de Venda) — evento já existia
       (aval-financeiro-store.js), só faltava o nó. Nasce junto com
       Contrato/Projeto Enviado (mesmo gatilho de disparo: proposta
       aprovada pelo cliente).

       Nuance registrada por Gelson (23/08), ainda não modelada no código:
       Score só é *obrigatório* consultar se o cliente é NOVO; cliente
       recorrente já é "VerticalParts" e o Score pode ou não ser
       reconsultado. Hoje o nó FIN_SCORE trata os dois casos igual
       (nasce sempre, fecha manual sempre) — não há campo "cliente novo vs
       recorrente" em `clientes` pra diferenciar automaticamente ainda.
       Refinamento futuro: se esse campo existir, FIN_SCORE deveria
       condicionar `condicaoNasce` a cliente novo, e "Financeiro Responde
       Sim" cobrir as duas respostas (Score + Sinal) num fluxo só quando
       recorrente. */
    { key: 'FIN_SCORE', label: 'Financeiro consultando score do cliente',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'aprovada',
      fecha: 'FINANCEIRO_CONSULTOU_SCORE', fechamentoTipo: 'manual', rota: 'aval-financeiro' },

    { key: 'FIN_AVAL_VENDA', label: 'Financeiro decidindo o Aval de Venda',
      predecessores: [{ key: 'FIN_SCORE', rel: 'FS' }],
      nasce: 'FINANCEIRO_CONSULTOU_SCORE', fecha: 'FINANCEIRO_APROVOU_VENDA',
      fechamentoTipo: 'manual', rota: 'aval-financeiro' },

    /* ---- Subcircuito de revisão de proposta (23/08, achado do Dossiê PCB) —
       separa "cliente pediu revisão" de "VerticalParts aceita/recusa o
       pedido". O desfecho de recusa é tratado como caso especial em
       onEvento() (ver acima) — este nó fecha oficialmente em
       VERTICALPARTS_ACEITOU_REVISAO, mas VERTICALPARTS_RECUSOU_REVISAO
       também o encerra, como 'encerrado'. Loop de múltiplas rodadas de
       revisão (sugestão do documento: máx. 3 sem decisão gerencial) NÃO
       implementado nesta primeira passada — cada rodada nova de revisão
       hoje reabriria o mesmo AGUARDA_CLIENTE por cima, o que já funciona
       (fecharNo é idempotente, não quebra), só não tem alerta de "3ª vez
       sem decisão" ainda. */
    { key: 'REVISAO_INTERNA', label: 'VerticalParts decidindo sobre a revisão pedida pelo cliente',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'revisao_solicitada',
      fecha: 'VERTICALPARTS_ACEITOU_REVISAO', fechamentoTipo: 'manual', rota: 'proposta-editor', resolverSubsel: resolverEditProposta },

    { key: 'PROPOSTA_REVISADA_REENVIO', label: 'Proposta revisada — aguardando reenvio ao cliente',
      predecessores: [{ key: 'REVISAO_INTERNA', rel: 'FS' }],
      nasce: 'VERTICALPARTS_ACEITOU_REVISAO', fecha: 'PROPOSTA_REENVIADA',
      fechamentoTipo: 'automatico', rota: 'proposta-editor', resolverSubsel: resolverEditProposta },

    /* ---- Gates 27/28 (CEO + Owner) — mesmo padrão: evento já existia
       (aprovarComoCEO/aprovarComoOwner em aval-financeiro-store.js,
       parte do gate podeIniciarCompra), só faltava o nó. Nascem junto
       com o Aval de Pagamento, quando o sinal é pago.

       ESPECIFICAÇÃO PENDENTE (23/08, Gelson) — o CEO_APROVOU aqui é só o
       gate único pré-compra que já existe hoje. Existe uma segunda coisa,
       AINDA NÃO IMPLEMENTADA, que não é este nó: um TETO DE CUSTO contínuo
       por cotação.
         - O Formulário de Precificação precisa listar TODOS os custos
           previstos da cotação (equipamento, ART, frete, locação de
           andaime/munck, contrato instalador etc.) — isso vira o teto
           (ex.: custo 100k, venda 135k → 35k de margem é o teto de gasto
           extra aceito sem aviso).
         - Cada ação que gera custo real ao longo da cotação (compra ao
           fornecedor, emissão de ART, contratação de frete/munck,
           Contrato Instalador assinado, IMS contratado etc.) precisa
           SOMAR ao acumulado da cotação e comparar contra o teto.
         - Se o acumulado ULTRAPASSAR o teto em qualquer ponto (não só na
           liberação da compra) — mesmo passado o CEO_APROVOU inicial —
           um alerta novo precisa acionar o CEO de novo, especificando
           qual compra estourou e por quanto.
       Isso exige: (1) campos de custo obrigatórios no formulário de
       precificação, hoje inexistentes; (2) uma "conta corrente" por
       numero_cotacao somando custo real vs. teto; (3) um alerta disparado
       no ponto de cada compra, não só um gate único no início. Não
       construí isso ainda — precisa de mais instrução sua sobre onde essa
       conta corrente deve morar (nova tabela? campo em avais_financeiros?)
       antes de desenhar. */
    { key: 'CEO_APROVOU', label: 'Aguardando aprovação do CEO',
      predecessores: [{ key: 'AVAL_PAGAMENTO', rel: 'SS' }],
      nasce: 'SINAL_PAGO', fecha: 'FINANCEIRO_APROVOU_CEO',
      fechamentoTipo: 'manual', rota: 'aval-financeiro' },

    { key: 'OWNER_APROVOU', label: 'Aguardando aprovação do responsável pelo sistema',
      predecessores: [{ key: 'AVAL_PAGAMENTO', rel: 'SS' }],
      nasce: 'SINAL_PAGO', fecha: 'FINANCEIRO_APROVOU_OWNER',
      fechamentoTipo: 'manual', rota: 'aval-financeiro' },

    /* ---- 33-37: Engenharia final + Ficha Técnica ---- */
    { key: 'PROJETO_CRIADO', label: 'Projeto de Elevadores criado',
      predecessores: [{ key: 'AGUARDA_ASSINATURA', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ASSINADO', fecha: 'PROJETO_ELEVADOR_CRIADO',
      fechamentoTipo: 'automatico', rota: 'eng-projeto-elevadores' },

    { key: 'PROJETO_APROVADO', label: 'Aguardando Cliente aprovar o Projeto',
      predecessores: [{ key: 'PROJETO_CRIADO', rel: 'FS' }],
      nasce: 'PROJETO_ELEVADOR_CRIADO',
      fecha: null /* sem fluxo de aprovação do projeto pelo cliente hoje — item pendente de decisão de produto */,
      fechamentoTipo: 'manual', rota: 'eng-projeto-elevadores' },
    /* Item 36 "Engenharia Finalizou Projeto" já é coberto pelo nó
       PROJETO_ENVIADO (acima), que fecha em PROJETO_ELEVADOR_FINALIZADO —
       não duplicado aqui de propósito. */

    { key: 'FICHA_CRIADA', label: 'Ficha Técnica criada',
      predecessores: [{ key: 'PROJETO_CRIADO', rel: 'SS' }],
      nasce: 'PROJETO_ELEVADOR_CRIADO',
      fecha: null /* Ficha Técnica é por PRODUTO (catalogo_produtos), sem numero_cotacao — não dá pra fechar
                     um nó de cotação a partir dela sem redesenhar o schema. Mesma limitação de Instalador
                     Homologado (52). Evento FICHA_TECNICA_CRIADA fica no catálogo, sem call-site. */,
      fechamentoTipo: 'manual', rota: 'ficha-tecnica' },

    /* ---- 38-47: Compra / Embarque (38 = COMPRA_LIBERADA, já existe acima) ----
       PI_CRIADA nasce direto do Projeto (não da Ficha) — ver nota acima
       sobre por que a Ficha não fecha nada nesta cadeia. */
    { key: 'PI_CRIADA', label: 'P.I. criada',
      predecessores: [{ key: 'PROJETO_CRIADO', rel: 'SS' }],
      nasce: 'PROJETO_ELEVADOR_CRIADO', fecha: 'PI_CRIADA',
      fechamentoTipo: 'automatico', rota: 'pi-importacao' },

    { key: 'PAGAMENTO_1_SOLICITADO', label: '1º pagamento ao fornecedor — solicitar',
      predecessores: [{ key: 'PI_CRIADA', rel: 'FS' }],
      nasce: 'PI_CRIADA',
      fecha: null /* sem campo/ação distinta em pi-store.js hoje */,
      fechamentoTipo: 'manual', rota: 'pi-importacao' },

    { key: 'PAGAMENTO_1_CONFIRMADO', label: '1º pagamento ao fornecedor — confirmar',
      predecessores: [{ key: 'PAGAMENTO_1_SOLICITADO', rel: 'FS' }],
      nasce: 'PAGAMENTO_FORNECEDOR_1_SOLICITADO',
      fecha: null /* idem — depende do nó anterior nunca fechar sozinho hoje */,
      fechamentoTipo: 'manual', rota: 'pi-importacao' },
    /* Item 42 "Produção Acompanhada" já é coberto pelo nó NEGOCIACAO_COMPRA
       (acima), que fecha em COMPRA_FORNECEDOR_CONFIRMADA — não duplicado. */

    { key: 'CARGO_READY', label: 'Aguardando Cargo Ready',
      predecessores: [{ key: 'NEGOCIACAO_COMPRA', rel: 'FS' }],
      nasce: 'COMPRA_FORNECEDOR_CONFIRMADA',
      fecha: null /* provável campo de data em pi_importacao/embarques_importacao, não uma ação clicável hoje */,
      fechamentoTipo: 'manual', rota: 'pi-importacao' },

    { key: 'RFQ_FRETE', label: 'RFQ de frete enviado',
      /* (Gelson me deve instrução: hoje disparo em CIMA de qualquer RFQ
         criado, não só RFQ de frete especificamente — rfq-importacao não
         distingue tipo de RFQ. Confirmar se precisa separar.) */
      predecessores: [{ key: 'CARGO_READY', rel: 'SS' }],
      nasce: 'COMPRA_FORNECEDOR_CONFIRMADA', fecha: 'RFQ_FRETE_ENVIADO',
      fechamentoTipo: 'automatico', rota: 'rfq-importacao' },

    { key: 'AGENTE_DEFINIDO', label: 'Agente de carga definido',
      /* (Gelson me deve instrução: não existe campo "agente de carga"
         estruturado em nenhuma tabela hoje — preciso saber onde/como esse
         dado deveria ser registrado antes de wiring.) */
      predecessores: [{ key: 'RFQ_FRETE', rel: 'FS' }],
      nasce: 'RFQ_FRETE_ENVIADO',
      fecha: null /* sem campo estruturado de "agente de carga" hoje — ver documento de fluxo */,
      fechamentoTipo: 'manual', rota: 'rfq-importacao' },

    { key: 'EMBARQUE_CRIADO', label: 'Embarque criado',
      predecessores: [{ key: 'AGENTE_DEFINIDO', rel: 'FS' }],
      nasce: 'AGENTE_CARGA_DEFINIDO', fecha: 'EMBARQUE_CRIADO',
      fechamentoTipo: 'automatico', rota: 'embarques-importacao' },

    { key: 'EMBARQUE_ATUALIZADO', label: 'Embarque em acompanhamento',
      predecessores: [{ key: 'EMBARQUE_CRIADO', rel: 'FS' }],
      nasce: 'EMBARQUE_CRIADO', fecha: 'EMBARQUE_ATUALIZADO',
      fechamentoTipo: 'automatico', rota: 'embarques-importacao' },

    /* ---- 48-51: Dossiê + Vistoria ---- */
    { key: 'DOSSIE_CRIADO', label: 'Dossiê da Obra criado',
      predecessores: [{ key: 'AGUARDA_ASSINATURA', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ASSINADO', fecha: 'DOSSIE_CRIADO',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },

    { key: 'VISTORIA_AGENDADA', label: 'Vistoria agendada',
      predecessores: [{ key: 'DOSSIE_CRIADO', rel: 'FS' }],
      nasce: 'DOSSIE_CRIADO', fecha: 'VISTORIA_AGENDADA',
      fechamentoTipo: 'automatico', rota: 'vistorias', resolverSubsel: resolverIdDireto },

    { key: 'VISTORIA_REALIZADA', label: 'Vistoria realizada',
      predecessores: [{ key: 'VISTORIA_AGENDADA', rel: 'FS' }],
      nasce: 'VISTORIA_AGENDADA', fecha: 'VISTORIA_REALIZADA',
      fechamentoTipo: 'automatico', rota: 'vistorias', resolverSubsel: resolverIdDireto },

    { key: 'PENDENCIAS_RESOLVIDAS', label: 'Pendências da obra resolvidas',
      predecessores: [{ key: 'VISTORIA_REALIZADA', rel: 'FS' }],
      nasce: 'VISTORIA_REALIZADA', fecha: 'PENDENCIA_RESOLVIDA',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },
    /* Item 52 "Instalador Homologado" NÃO virou nó aqui de propósito: é
       uma qualificação do PARCEIRO (parceiros_instaladores), não uma
       etapa por Nº de Cotação — não encaixa no modelo de `gatilhos`
       (chave numero_cotacao). Evento fica no catálogo pra uso futuro
       (ex.: um painel separado por instalador), sem nó na cadeia. */

    /* ---- 53-55: Instalador ---- */
    { key: 'INSTALADOR_VINCULADO', label: 'Instalador vinculado à obra',
      predecessores: [{ key: 'PENDENCIAS_RESOLVIDAS', rel: 'FS' }],
      nasce: 'PENDENCIA_RESOLVIDA', fecha: 'INSTALADOR_VINCULADO',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },

    { key: 'CI_GERADO', label: 'Contrato Instalador gerado',
      predecessores: [{ key: 'INSTALADOR_VINCULADO', rel: 'FS' }],
      nasce: 'INSTALADOR_VINCULADO', fecha: 'CONTRATO_INSTALADOR_GERADO',
      fechamentoTipo: 'automatico', rota: 'contrato-instalador' },

    { key: 'CI_ASSINADO', label: 'Contrato Instalador assinado',
      predecessores: [{ key: 'CI_GERADO', rel: 'FS' }],
      nasce: 'CONTRATO_INSTALADOR_GERADO', fecha: 'CONTRATO_INSTALADOR_ASSINADO',
      fechamentoTipo: 'automatico', rota: 'contrato-instalador' },

    /* ---- 56-63: Recursos + Instalação ---- */
    { key: 'IMS_CONTRATADO', label: 'Recursos IMS contratados',
      predecessores: [{ key: 'CI_ASSINADO', rel: 'FS' }],
      nasce: 'CONTRATO_INSTALADOR_ASSINADO', fecha: 'IMS_CONTRATADO',
      fechamentoTipo: 'automatico', rota: 'ims-importacao' },
    /* Item 56 "Recursos Verificados" não virou nó — não achei ação
       distinta de "contratar" (IMS_CONTRATADO acima) no código; evento
       fica no catálogo, sem nó, mesmo motivo de itens acima. */

    { key: 'EQUIPAMENTO_RECEBIDO', label: 'Equipamento recebido na obra',
      predecessores: [{ key: 'IMS_CONTRATADO', rel: 'FS' }],
      nasce: 'IMS_CONTRATADO', fecha: 'EQUIPAMENTO_RECEBIDO',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },
    /* Item 59 "Equipamento Conferido" não virou nó — instalacao-obra-store
       só tem marcarEquipamentoEntregue, sem campo de conferência distinto
       de recebimento; mesmo call-site cobre os dois hoje. */

    { key: 'INSTALACAO_INICIADA', label: 'Instalação iniciada',
      predecessores: [{ key: 'EQUIPAMENTO_RECEBIDO', rel: 'FS' }],
      nasce: 'EQUIPAMENTO_RECEBIDO', fecha: 'INSTALACAO_INICIADA',
      fechamentoTipo: 'automatico', rota: 'instalacao' },

    { key: 'PENDENCIA_INSTALACAO', label: 'Pendência de instalação em aberto',
      predecessores: [{ key: 'INSTALACAO_INICIADA', rel: 'SS' }],
      nasce: 'INSTALACAO_INICIADA', fecha: 'PENDENCIA_INSTALACAO_REGISTRADA',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },

    { key: 'INSTALACAO_CONCLUIDA', label: 'Instalação concluída',
      predecessores: [{ key: 'INSTALACAO_INICIADA', rel: 'FS' }],
      nasce: 'INSTALACAO_INICIADA', fecha: 'INSTALACAO_CONCLUIDA',
      fechamentoTipo: 'automatico', rota: 'instalacao' },

    /* ---- 64-68: ART, testes, Data Book ---- */
    { key: 'ART_EMITIDA', label: 'ART emitida',
      predecessores: [{ key: 'INSTALACAO_CONCLUIDA', rel: 'FS' }],
      nasce: 'INSTALACAO_CONCLUIDA', fecha: 'ART_EMITIDA',
      fechamentoTipo: 'automatico', rota: 'art' },

    { key: 'TESTES_REALIZADOS', label: 'Testes realizados',
      predecessores: [{ key: 'INSTALACAO_CONCLUIDA', rel: 'SS' }],
      nasce: 'INSTALACAO_CONCLUIDA',
      fecha: null /* sem checklist/campo distinto de "teste" hoje — costuma estar embutido no checklist geral de instalação */,
      fechamentoTipo: 'manual', rota: 'instalacao' },

    { key: 'DATABOOK_MONTADO', label: 'Data Book montado',
      predecessores: [{ key: 'ART_EMITIDA', rel: 'FS' }],
      nasce: 'ART_EMITIDA', fecha: 'DATABOOK_MONTADO',
      fechamentoTipo: 'automatico', rota: 'databook' },
    /* Itens 67/68 "Data Book Enviado" / "Cliente Aprovou Data Book" não
       viraram nó — hoje só existe o upload (item 66, acima); não há
       envio/aprovação distintos rastreados. */

    /* ---- 69-73: Termo de Entrega + Handover (construído nesta mesma sessão) ---- */
    { key: 'TERMO_PREPARADO', label: 'Termo de Entrega — link gerado',
      predecessores: [{ key: 'DATABOOK_MONTADO', rel: 'FS' }],
      nasce: 'DATABOOK_MONTADO', fecha: 'TERMO_PREPARADO',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },
    /* Item 70 "Termo Enviado" não virou nó separado — gerar o link (69) e
       "enviar" são o mesmo clique hoje (o link sai por WhatsApp fora do
       sistema, não há botão de "enviar" distinto). */

    { key: 'TERMO_ASSINADO', label: 'Termo de Entrega assinado',
      predecessores: [{ key: 'TERMO_PREPARADO', rel: 'FS' }],
      nasce: 'TERMO_PREPARADO', fecha: 'TERMO_ASSINADO',
      fechamentoTipo: 'automatico', rota: 'dossier-obra', resolverSubsel: resolverIdDireto },

    { key: 'HANDOVER_CONCLUIDO', label: 'Handover concluído',
      predecessores: [{ key: 'TERMO_ASSINADO', rel: 'FS' }],
      nasce: 'TERMO_ASSINADO', fecha: 'HANDOVER_CONCLUIDO',
      fechamentoTipo: 'automatico', rota: 'handover' },

    { key: 'POS_VENDA_ATIVADO', label: 'Pós-venda ativado',
      predecessores: [{ key: 'HANDOVER_CONCLUIDO', rel: 'FS' }],
      nasce: 'HANDOVER_CONCLUIDO', fecha: 'POS_VENDA_ATIVADO',
      fechamentoTipo: 'automatico', rota: 'handover' },
  ];

  function nodeByKey(key) { return NODES.find((n) => n.key === key); }

  /* profundidade(key) — nível de indentação na árvore visual (etapa 4).
     Anda a cadeia de predecessores TI (FS); irmãos II (SS) — ex.: Contrato
     e Projeto de Engenharia, que nascem juntos — ficam no mesmo nível. */
  function profundidade(key) {
    const node = nodeByKey(key);
    if (!node || !node.predecessores.length) return 0;
    const predFS = node.predecessores.find((p) => p.rel === 'FS') || node.predecessores[0];
    return 1 + profundidade(predFS.key);
  }

  function gtId(numeroCotacao, key) { return `GT-${numeroCotacao}-${key}`; }

  async function getRow(numeroCotacao, key) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('gatilhos').select('*')
      .eq('numero_cotacao', numeroCotacao).eq('evento_key', key).maybeSingle();
    return data || null;
  }

  async function fecharNo(numeroCotacao, node, statusFinal) {
    const c = sb(); if (!c) return null;
    const row = await getRow(numeroCotacao, node.key);
    if (!row || row.concluido_em) return row; // já fechado ou nunca nasceu
    const now = new Date().toISOString();
    const { data, error } = await c.from('gatilhos').update({
      concluido_em: now, status: statusFinal || 'ok',
    }).eq('id', row.id).select().single();
    if (error) { console.warn('[GatilhosEngine] fecharNo falhou', error); return row; }
    return data;
  }

  async function nascerNo(numeroCotacao, node, predecessorId, alvoId) {
    const c = sb(); if (!c) return null;
    const existente = await getRow(numeroCotacao, node.key);
    if (existente) return existente; // idempotente
    const now = new Date();
    const nowIso = now.toISOString();
    const slaHoras = SLA_HORAS[node.key] ?? null;
    const prazoEm = slaHoras != null ? new Date(now.getTime() + slaHoras * 3600000) : null;
    const relPrincipal = (node.predecessores[0] || {}).rel || 'FS';
    const row = {
      id: gtId(numeroCotacao, node.key),
      numero_cotacao: numeroCotacao,
      evento_key: node.key,
      trigger_name: node.label,
      predecessor_id: predecessorId || null,
      alvo_id: alvoId != null ? String(alvoId) : null,
      tipo_relacionamento: relPrincipal,
      origem: 'automatico',
      conclusao_tipo: node.fechamentoTipo,
      nascido_em: nowIso,
      prazo_em: prazoEm ? prazoEm.toISOString() : null,
      due_date: prazoEm ? prazoEm.toISOString().slice(0, 10) : null,
      days_left: slaHoras != null ? Math.round(slaHoras / 24) : null,
      status: 'pendente',
      chain: [],
    };
    const { data, error } = await c.from('gatilhos').insert(row).select().single();
    if (error) { console.warn('[GatilhosEngine] nascerNo falhou', error); return null; }
    return data;
  }

  /* garantirNo(numeroCotacao, key) — o app permite pular etapas "formais"
     (ex.: Proposta publicada e assinada direto pelo link, sem passar pelo
     clique de "Enviar Proposta") — o evento de fechamento correspondente
     nunca dispara, e o nó sucessor nasceria órfão (predecessor_id null).
     Aqui a cadeia se auto-reconstrói: se o predecessor não existe, ele
     nasce e fecha retroativamente (status 'ok', mesmo instante) antes do
     nó pedido nascer — nunca deixa buraco na árvore visual. */
  async function garantirNo(numeroCotacao, key) {
    let row = await getRow(numeroCotacao, key);
    if (row) {
      if (!row.concluido_em) row = await fecharNo(numeroCotacao, nodeByKey(key), 'ok');
      return row;
    }
    const node = nodeByKey(key);
    if (!node) return null;
    const predKey = (node.predecessores[0] || {}).key;
    const predRow = predKey ? await garantirNo(numeroCotacao, predKey) : null;
    row = await nascerNo(numeroCotacao, node, predRow ? predRow.id : null, predRow ? predRow.alvo_id : null);
    if (row) row = await fecharNo(numeroCotacao, node, 'ok');
    return row;
  }

  /* onEvento({ evento, numeroCotacao, alvoId, detalhe })
     Chamada única disparada por EventosFluxo.registrar(). Nunca derruba
     o fluxo principal por falha — é automação, não obrigação transacional.
     `alvoId` é o id do registro que disparou o evento (ex.: id da cotação
     a fornecedor, da proposta) — gravado no nó que nasce, pra dar pra
     clicar na linha e abrir o objeto real (ver navegarPara). */
  async function onEvento({ evento, numeroCotacao, alvoId, detalhe } = {}) {
    if (numeroCotacao == null) return;
    try {
      /* 1) fecha quem tiver esse evento como fechamento. Caso especial:
         cliente recusou a proposta — AGUARDA_CLIENTE fecha como
         "encerrado" (não "ok"), e a cadeia para aí, sem abrir
         Contrato/Projeto. Precisa decidir o status ANTES de fechar —
         fecharNo é idempotente e não deixa reabrir pra trocar depois. */
      const recusada = evento === 'CLIENTE_RESPONDEU_PROPOSTA' && (detalhe || {}).resposta === 'recusada';
      /* Recusa INTERNA de revisão (23/08) — mesmo padrão da recusa do
         cliente acima, mas fecha o nó REVISAO_INTERNA como 'encerrado' em
         vez do nó cujo `fecha` bate literalmente com o evento (esse nó
         fecha oficialmente em VERTICALPARTS_ACEITOU_REVISAO — a recusa é
         o outro desfecho possível do mesmo nó, não um evento que ele
         "escuta" via campo fecha). */
      if (evento === 'VERTICALPARTS_RECUSOU_REVISAO') {
        const revisaoNode = nodeByKey('REVISAO_INTERNA');
        if (revisaoNode) await fecharNo(numeroCotacao, revisaoNode, 'encerrado');
      }
      for (const node of NODES) {
        if (node.fecha !== evento) continue;
        const status = recusada && node.key === 'AGUARDA_CLIENTE' ? 'encerrado' : 'ok';
        await fecharNo(numeroCotacao, node, status);
      }

      /* 2) nasce quem tiver esse evento como nascimento */
      for (const node of NODES) {
        if (node.nasce !== evento) continue;
        if (node.condicaoNasce && !node.condicaoNasce(detalhe)) continue;
        const predKey = (node.predecessores[0] || {}).key;
        const predRow = predKey ? await garantirNo(numeroCotacao, predKey) : null;
        await nascerNo(numeroCotacao, node, predRow ? predRow.id : null, alvoId);
      }
    } catch (e) {
      console.warn('[GatilhosEngine] onEvento falhou', e);
    }
  }

  /* navegarPara(g) — dado um gatilho (linha da tabela `gatilhos`), resolve
     { rota, subsel } pra abrir o objeto real. Linhas de lembrete
     (evento_key 'LEMBRETE__<chave>') seguem o mesmo destino do nó pai. */
  async function navegarPara(g) {
    if (!g) return null;
    const chave = String(g.evento_key || '').replace(/^LEMBRETE__/, '');
    const node = nodeByKey(chave);
    if (!node || !node.rota) return null;
    const subsel = node.resolverSubsel ? await node.resolverSubsel(g.alvo_id) : null;
    return { rota: node.rota, subsel };
  }

  /* verificarPrazos(rows) — chamado ao carregar a tela "Gatilhos & Prazo"
     (não há cron neste projeto). Recebe os gatilhos automáticos já
     carregados em memória, nasce lembretes de cobrança quando o prazo
     do nó pai já passou do limite parcial (LEMBRETES), e marca
     AGUARDA_CLIENTE como "revisao_necessaria" quando estourar os 15
     dias sem fechar. Retorna true se algo mudou (chamador deve
     recarregar). */
  async function verificarPrazos(rows) {
    const c = sb(); if (!c) return false;
    let mudou = false;
    const abertos = (rows || []).filter((r) =>
      r.origem === 'automatico' && !r.concluido_em && !String(r.evento_key || '').startsWith('LEMBRETE__'));

    for (const r of abertos) {
      const nascidoEm = r.nascido_em ? new Date(r.nascido_em).getTime() : null;
      if (!nascidoEm) continue;
      const horasDecorridas = (Date.now() - nascidoEm) / 3600000;

      const lembrete = LEMBRETES[r.evento_key];
      if (lembrete && horasDecorridas >= lembrete.apósHoras) {
        const chaveLembrete = 'LEMBRETE__' + r.evento_key;
        const jaExiste = (rows || []).some((x) => x.numero_cotacao === r.numero_cotacao && x.evento_key === chaveLembrete);
        if (!jaExiste) {
          const { error } = await c.from('gatilhos').insert({
            id: gtId(r.numero_cotacao, chaveLembrete),
            numero_cotacao: r.numero_cotacao,
            evento_key: chaveLembrete,
            trigger_name: lembrete.label,
            predecessor_id: r.id,
            tipo_relacionamento: 'FS',
            origem: 'automatico',
            conclusao_tipo: 'manual',
            nascido_em: new Date().toISOString(),
            status: 'atencao',
            chain: [],
          });
          if (error) console.warn('[GatilhosEngine] lembrete falhou', error);
          else mudou = true;
        }
      }

      if (r.evento_key === 'AGUARDA_CLIENTE' && horasDecorridas >= SLA_HORAS.AGUARDA_CLIENTE && r.status !== 'revisao_necessaria') {
        const { error } = await c.from('gatilhos').update({ status: 'revisao_necessaria' }).eq('id', r.id);
        if (error) console.warn('[GatilhosEngine] revisão falhou', error);
        else mudou = true;
      }
    }
    return mudou;
  }

  /* Fecha manualmente um gatilho que nunca vai receber o evento normal de
     conclusão — hoje só o "Cemitério" (AGUARDA_CLIENTE parado há mais de
     10 dias, ver SLA_HORAS acima): o cliente sumiu, o vendedor investigou
     por fora e decide encerrar o ciclo com uma justificativa em texto
     livre (23/08, Gelson — "só o cliente mata o fluxo", então isso é
     sempre uma decisão humana registrada, nunca automática). */
  async function fecharComMotivo(id, motivo) {
    const c = sb(); if (!c) return null;
    if (!motivo || !motivo.trim()) throw new Error('Motivo é obrigatório.');
    const { data, error } = await c.from('gatilhos').update({
      concluido_em: new Date().toISOString(), status: 'encerrado', motivo_fechamento: motivo.trim(),
    }).eq('id', id).select().single();
    if (error) { console.warn('[GatilhosEngine] fecharComMotivo falhou', error); throw error; }
    return data;
  }

  /* Fecha um gatilho-filho de lembrete manualmente ("marquei que já cobrei o cliente"). */
  async function fecharLembrete(id) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.from('gatilhos').update({
      concluido_em: new Date().toISOString(), status: 'ok',
    }).eq('id', id).select().single();
    if (error) { console.warn('[GatilhosEngine] fecharLembrete falhou', error); return null; }
    return data;
  }

  window.GatilhosEngine = { NODES, SLA_HORAS, LEMBRETES, onEvento, verificarPrazos, fecharLembrete, fecharComMotivo, navegarPara, profundidade };
}());
