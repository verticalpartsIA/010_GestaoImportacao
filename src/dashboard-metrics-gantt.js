/* ============================================================
   dashboard-metrics-gantt.js
   Dashboard · geração das fases sintéticas do Gantt/Kanban de projetos —
   4º módulo extraído de loadDashboardData() (ver
   dashboard-metrics-comercial.js pro raciocínio completo). Funções
   puras, zero I/O.

   Issue #274 fechada em 23/08: a tabela `projetos` é legada e tem 0
   linhas em produção (nunca é escrita pela esteira real) — o card
   "Projetos em Andamento" sempre mostrava zero mesmo com cotações
   ativas de verdade. `projetosDaEsteira()` reconstrói a mesma forma
   de "projeto" (id/name/client/start_date/current_phase) a partir dos
   dados reais: `gatilhos` (motor gatilhos-engine.js) + `formularios_
   elevador` (cliente/obra). `projetosComFases`/`compute` continuam
   aceitando `projetos` no formato antigo — só troca a origem dos dados,
   não o contrato dessas duas funções (testes existentes continuam
   valendo).

   window.ProjetosGanttMetrics
   ============================================================ */
(function () {
  'use strict';

  const DIA_MS = 86_400_000;
  const GANTT_PHASES = ['Projeto', 'Fabricação', 'Importação', 'Instalação', 'Entrega'];

  /* Cada nó do motor de Gatilhos (gatilhos-engine.js) mapeado pra uma das
     5 fases sintéticas do Gantt/Kanban. Nó sem entrada aqui cai em
     'Projeto' (fallback conservador — melhor mostrar cedo demais do
     que não mostrar). */
  const FASE_POR_NODE = {
    FORMULARIO: 'Projeto', SLA_FORNECEDOR: 'Projeto', PRECIFICACAO: 'Projeto',
    PROPOSTA_PREP: 'Projeto', AGUARDA_CLIENTE: 'Projeto', FIN_SCORE: 'Projeto',
    FIN_AVAL_VENDA: 'Projeto', REVISAO_INTERNA: 'Projeto', PROPOSTA_REVISADA_REENVIO: 'Projeto',
    CONTRATO_ENVIADO: 'Projeto', PROJETO_ENVIADO: 'Projeto', AGUARDA_ASSINATURA: 'Projeto',
    AGUARDA_BOLETO: 'Projeto', AVAL_PAGAMENTO: 'Projeto', CEO_APROVOU: 'Projeto',
    OWNER_APROVOU: 'Projeto', COMPRA_LIBERADA: 'Projeto',

    PROJETO_CRIADO: 'Fabricação', PROJETO_APROVADO: 'Fabricação', FICHA_CRIADA: 'Fabricação',
    PI_CRIADA: 'Fabricação', PAGAMENTO_1_SOLICITADO: 'Fabricação', PAGAMENTO_1_CONFIRMADO: 'Fabricação',
    NEGOCIACAO_COMPRA: 'Fabricação',

    CARGO_READY: 'Importação', RFQ_FRETE: 'Importação', AGENTE_DEFINIDO: 'Importação',
    EMBARQUE_CRIADO: 'Importação', EMBARQUE_ATUALIZADO: 'Importação',
    EMBARQUE_CHEGADA: 'Importação', EMBARQUE_CHEGADA_BRASIL: 'Importação',
    EMBARQUE_ENTREGA_OBRA: 'Importação',

    DOSSIE_CRIADO: 'Instalação', VISTORIA_AGENDADA: 'Instalação', VISTORIA_REALIZADA: 'Instalação',
    PENDENCIAS_RESOLVIDAS: 'Instalação', INSTALADOR_VINCULADO: 'Instalação', CI_GERADO: 'Instalação',
    CI_ASSINADO: 'Instalação', IMS_CONTRATADO: 'Instalação', EQUIPAMENTO_RECEBIDO: 'Instalação',
    INSTALACAO_INICIADA: 'Instalação', PENDENCIA_INSTALACAO: 'Instalação',
    INSTALACAO_CONCLUIDA: 'Instalação', ART_EMITIDA: 'Instalação', TESTES_REALIZADOS: 'Instalação',
    DATABOOK_MONTADO: 'Instalação',

    TERMO_PREPARADO: 'Entrega', TERMO_ASSINADO: 'Entrega', HANDOVER_CONCLUIDO: 'Entrega',
    POS_VENDA_ATIVADO: 'Entrega',
  };

  /* projetosDaEsteira({ gatilhos, formularios, clientesPorId }) — agrupa
     gatilhos por numero_cotacao e devolve um "projeto" sintético por
     cotação com pelo menos um gatilho ainda aberto (cotações com a
     cadeia inteira fechada não entram — não é mais "em andamento").
     current_phase = fase do gatilho aberto mais antigo (o gargalo
     atual, mesma lógica de "quem tem a bola agora" do OndeParouWidget). */
  function projetosDaEsteira({ gatilhos, formularios, clientesPorId } = {}) {
    const porFormulario = new Map((formularios || []).map((f) => [f.numero_cotacao, f]));
    const clientes = clientesPorId || {};
    const porCotacao = new Map();
    (gatilhos || []).forEach((g) => {
      if (!g.numero_cotacao || String(g.evento_key || '').startsWith('LEMBRETE__')) return;
      if (!porCotacao.has(g.numero_cotacao)) porCotacao.set(g.numero_cotacao, []);
      porCotacao.get(g.numero_cotacao).push(g);
    });

    const projetos = [];
    porCotacao.forEach((lista, numeroCotacao) => {
      const abertos = lista.filter((g) => !g.concluido_em);
      if (!abertos.length) return; // cadeia inteira fechada — não é "em andamento"
      const atual = abertos.reduce((a, b) => (new Date(a.nascido_em) < new Date(b.nascido_em) ? a : b));
      const inicio = lista.reduce((min, g) => Math.min(min, +new Date(g.nascido_em)), Infinity);
      const form = porFormulario.get(numeroCotacao);
      const cliente = form ? clientes[form.cliente_id] : null;
      const nomeCliente = cliente ? (cliente.nome_fantasia || cliente.razao_social) : null;
      projetos.push({
        id: numeroCotacao,
        name: nomeCliente ? `${nomeCliente} · Cotação ${numeroCotacao}` : `Cotação ${numeroCotacao}`,
        client: nomeCliente || (form ? form.local_obra_cidade : null) || '—',
        start_date: Number.isFinite(inicio) ? new Date(inicio).toISOString().slice(0, 10) : null,
        end_date: null,
        current_phase: FASE_POR_NODE[atual.evento_key] || 'Projeto',
        numero_cotacao: numeroCotacao,
      });
    });
    return projetos.sort((a, b) => a.numero_cotacao - b.numero_cotacao);
  }

  /* Início da timeline: o projeto mais antigo por start_date, ou agora se
     não houver nenhum. */
  function ganttStart(projetos) {
    const startMs = (projetos || []).map((p) => +new Date(p.start_date)).filter(Boolean);
    return startMs.length ? Math.min(...startMs) : Date.now();
  }

  /* "Hoje" em dias desde o início da timeline — posição da linha vertical
     "HOJE" no gráfico. */
  function ganttToday(projetos, agora) {
    const inicio = ganttStart(projetos);
    return Math.max(0, Math.floor(((agora || Date.now()) - inicio) / DIA_MS));
  }

  /* Converte projetos (Supabase) → formato que o GanttChart/Kanban
     entendem: 5 fases sintéticas de tamanho igual, divididas pelo
     período total do projeto, com a fase atual marcada por
     current_phase. */
  function projetosComFases(projetos, inicio) {
    const base = inicio == null ? ganttStart(projetos) : inicio;
    return (projetos || []).map((p) => {
      const pStart = p.start_date ? +new Date(p.start_date) : base;
      const pEnd   = p.end_date   ? +new Date(p.end_date)   : pStart + 150 * DIA_MS;
      const pDay0  = Math.max(0, Math.floor((pStart - base) / DIA_MS));
      const totalD = Math.max(30, Math.floor((pEnd - pStart) / DIA_MS));
      const phLen  = Math.floor(totalD / GANTT_PHASES.length);
      const curIdx = Math.max(0, GANTT_PHASES.findIndex((ph) => (p.current_phase || '').includes(ph)));
      return {
        ...p,
        phases: GANTT_PHASES.map((name, i) => ({
          name,
          start:  pDay0 + i * phLen,
          end:    pDay0 + (i + 1) * phLen,
          status: i < curIdx ? 'done' : i === curIdx ? 'current' : 'future',
        })),
      };
    });
  }

  function compute({ projetos, agora }) {
    const inicio = ganttStart(projetos);
    return {
      ganttToday: ganttToday(projetos, agora),
      ganttProjetos: projetosComFases(projetos, inicio),
    };
  }

  window.ProjetosGanttMetrics = {
    GANTT_PHASES, FASE_POR_NODE, ganttStart, ganttToday, projetosComFases, projetosDaEsteira, compute,
  };
}());
