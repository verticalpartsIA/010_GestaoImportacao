/* ============================================================
   master-id-engine.js — Padrão universal de codificação de IDs

   DOIS níveis, propositalmente separados (revisão de fluxo, 27/08):

   1) Nº DA COTAÇÃO — um único número (formularios_elevador.numero_cotacao)
      acompanha o negócio do início ao fim. Cada ETAPA do fluxo mostra esse
      MESMO número, só trocando o prefixo de 2 letras (etapaId):
        Cotação .......... VPCT-0950
        Precificação ..... VPPC-0950
        Proposta ......... VPPR-0950
        Contrato Venda ... VPCV-0950
        Contrato Montagem  VPCM-0950
        Obra ............. VPOB-0950
      "0950" NUNCA leva letra de tipo de equipamento — isso é ambíguo (uma
      cotação pode ter elevador + escada juntos) e não é o número da etapa,
      é o número DELA (o negócio).

   2) ID DE EQUIPAMENTO — dentro de uma cotação/obra, cada unidade alocada
      no Formulário (elevador, escada rolante, esteira rolante) tem seu
      próprio código alfanumérico (baseId/masterId), sim com o tipo:
        Base .......... VPEL-EL0950        (elevador)
        Com revisão ... VPEL-EL0950-A      (reenvio ao fornecedor por mudança de especificação)
        Com ativo ..... VPEL-EL0950-A-1    (elevador nº 1 daquela cotação/revisão)
        Escada rolante  VPER-ER0950-1
        Esteira rolante VPES-ES0950-1

   Cotações antigas (VPEL-0001..0003, formato sequencial simples) NÃO são
   migradas — o padrão novo vale só a partir daqui. window.MasterIdEngine
   ============================================================ */
(function () {
  'use strict';

  /* PREFIXO-TIPO por categoria de produto (nível 2 — ID DE EQUIPAMENTO).
     Só "elevador" está em uso hoje (Glarie); escada/esteira ficam prontos
     pro dia que os fornecedores entrarem, sem precisar mexer no motor de novo. */
  const PREFIXO_TIPO = {
    elevador: 'VPEL-EL',
    escada_rolante: 'VPER-ER',
    esteira_rolante: 'VPES-ES',
    quadro_comando: 'VPQC-QC',
  };

  function baseId(categoriaProduto, numeroCotacao) {
    const prefixo = PREFIXO_TIPO[categoriaProduto];
    if (!prefixo) throw new Error(`Master ID: sem PREFIXO-TIPO definido para categoria "${categoriaProduto}"`);
    if (numeroCotacao == null) throw new Error('Master ID: numeroCotacao é obrigatório');
    return `${prefixo}${String(numeroCotacao).padStart(4, '0')}`;
  }

  /* PREFIXO-ETAPA (nível 1 — Nº DA COTAÇÃO, mesmo número em toda etapa).
     2 letras só, sem acento (nunca "Ç" — quebraria o parse de
     parseNumeroCotacao e outros usos de texto/URL/arquivo). */
  const PREFIXO_ETAPA = {
    cotacao: 'VPCT',
    precificacao: 'VPPC',
    proposta: 'VPPR',
    contrato_venda: 'VPCV',
    contrato_montagem: 'VPCM',
    contrato_instalador: 'VPNI',  // Contrato Instalador (29/09): VPNI-<Nº da cotação ou do equipamento>
    obra: 'VPOB',
  };

  /* revisao (opcional, 22/10): sufixo de letra (A, B...) pendurado no final —
     mesma letra que cotacoes_elevador_fornecedor.revisao já usa pra revisão de
     fornecedor. Sem ela (chamada com 2 args, como sempre foi), o Nº sai igual
     a antes — retrocompatível. Existe pra dar Nº PRÓPRIO a cada revisão de uma
     mesma etapa (ex.: precificação de uma 2ª resposta do fornecedor), evitando
     colisão no numero_documento UNIQUE quando a etapa da revisão anterior já
     existe (achado real: cotação 990 virou revisão B e a Precificação não
     conseguia abrir um registro novo porque "VPPC-0990" já estava em uso). */
  function etapaId(etapa, numero, revisao) {
    const prefixo = PREFIXO_ETAPA[etapa];
    if (!prefixo) throw new Error(`Master ID: sem PREFIXO-ETAPA definido para etapa "${etapa}"`);
    if (numero == null) throw new Error('Master ID: numero é obrigatório');
    const base = `${prefixo}-${String(numero).padStart(4, '0')}`;
    return revisao ? `${base}-${revisao}` : base;
  }

  /* 1º envio ao fornecedor não tem sufixo de revisão. Cada reenvio (troca de
     especificação técnica pedida pelo Vendedor) soma a próxima letra: A, B,
     C... Z, AA, AB... (overflow raro, mas não quebra). */
  function proximaRevisao(revisaoAtual) {
    if (!revisaoAtual) return 'A';
    const chars = revisaoAtual.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      if (chars[i] !== 'Z') { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); return chars.join(''); }
      chars[i] = 'A'; i -= 1;
    }
    return 'A' + chars.join('');
  }

  function masterId({ categoriaProduto, numeroCotacao, revisao, indiceAtivo }) {
    let id = baseId(categoriaProduto, numeroCotacao);
    if (revisao) id += `-${revisao}`;
    if (indiceAtivo != null) id += `-${indiceAtivo}`;
    return id;
  }

  /* Aceita tanto o nº puro (898) quanto o Master ID completo (VPEL-EL0898,
     com ou sem sufixo de revisão/ativo) — usado onde o vendedor digita a
     referência da cotação de cabeça (ex.: herança de proposta). */
  function parseNumeroCotacao(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    // Cobre os dois formatos: etapa "VPCT-0950" (sem letra após o traço) e
    // equipamento "VPEL-EL0950" (com letra de tipo após o traço).
    const m = s.match(/^VP[A-Z]{2}-[A-Z]*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  /* Extrai a letra de revisão de um numero_documento no formato etapaId
     ("VPPR-0990-B" → "B"; "VPPR-0990" → null) — inverso de etapaId(etapa,
     numero, revisao). 23/10: usado pra escopar "já existe um documento
     dessa etapa pra essa cotação" POR REVISÃO (não só pelo Nº da cotação) —
     sem isso, uma reprecificação (revisão B do fornecedor) nunca conseguia
     gerar a Proposta própria dela: a trava de "uma proposta por cotação"
     barrava contra a Proposta já existente da revisão ANTERIOR. Só
     reconhece o formato de etapa (PREFIXO-0000[-LETRA]); numero_documento
     fora desse padrão (digitado à mão) devolve null, tratado como "sem
     revisão" — igual sempre foi. */
  function parseRevisao(numeroDocumento) {
    const s = String(numeroDocumento == null ? '' : numeroDocumento).trim();
    const m = s.match(/^VP[A-Z]{2}-\d+-([A-Za-z]+)$/);
    return m ? m[1] : null;
  }

  window.MasterIdEngine = { PREFIXO_TIPO, baseId, proximaRevisao, masterId, parseNumeroCotacao, parseRevisao, PREFIXO_ETAPA, etapaId };
}());
