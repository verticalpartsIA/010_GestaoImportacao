/* ============================================================
   master-id-engine.js — Padrão universal de codificação de IDs
   (Fase 1: Cotação a Fornecedor + Precificação).

   Formato: [PREFIXO-TIPO][Nº DA COTAÇÃO]-[REVISÃO]-[ATIVO]
     Base .......... VPEL-EL0902        (reaproveita formularios_elevador.numero_cotacao)
     Com revisão ... VPEL-EL0902-A      (reenvio ao fornecedor por mudança de especificação)
     Com ativo ..... VPEL-EL0902-A-1    (elevador nº 1 daquela cotação/revisão)

   Cotações antigas (VPEL-0001..0003, formato sequencial simples) NÃO são
   migradas — o padrão novo vale só a partir daqui. window.MasterIdEngine
   ============================================================ */
(function () {
  'use strict';

  /* PREFIXO-TIPO por categoria de produto. Só "elevador" está em uso hoje
     (Glarie); escada/esteira ficam prontos pro dia que os fornecedores
     entrarem, sem precisar mexer no motor de novo. */
  const PREFIXO_TIPO = {
    elevador: 'VPEL-EL',
    escada_rolante: 'VPER-ER',
    esteira_rolante: 'VPES-ES',
  };

  function baseId(categoriaProduto, numeroCotacao) {
    const prefixo = PREFIXO_TIPO[categoriaProduto];
    if (!prefixo) throw new Error(`Master ID: sem PREFIXO-TIPO definido para categoria "${categoriaProduto}"`);
    if (numeroCotacao == null) throw new Error('Master ID: numeroCotacao é obrigatório');
    return `${prefixo}${String(numeroCotacao).padStart(4, '0')}`;
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

  window.MasterIdEngine = { PREFIXO_TIPO, baseId, proximaRevisao, masterId };
}());
