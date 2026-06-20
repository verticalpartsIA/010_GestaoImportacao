/* ============================================================
   contrato-venda-engine.js
   Template do Contrato de Compra e Venda de Equipamentos (Cliente).
   Adaptado do gerador externo "Contrato Compra e Venda Equipamentos".
   Exporta window.CV = { ... } pra não colidir.
   Sem React, sem persistência — só lógica do documento.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- VENDEDORA (fixo) ---------- */
  const VENDEDORA = {
    razao: 'VERTICAL PARTS — INDÚSTRIA E COMÉRCIO DE PEÇAS PARA ESCADAS, ESTEIRAS ROLANTES E ELEVADORES LTDA-ME',
    fantasia: 'Vertical Parts',
    cnpj: '15.822.325/0001-27',
    endereco: 'Rua Armandina Braga de Almeida, nº 383, Jd. Santa Emilia, Guarulhos/SP, CEP 07.141-003',
    cidade: 'Guarulhos/SP',
    rep: 'DIEGO YUTAKA MAENO',
    repQualif: 'brasileiro, casado, empresário, portador do RG 23.401.535-4 SSP/SP, inscrito no CPF nº 249.432.208-19',
    repCpf: '249.432.208-19',
    repCargo: 'CEO',
  };

  const EQUIPAMENTOS = {
    ELEVADOR: {
      key: 'ELEVADOR', label: 'Elevador', glyph: 'elevador',
      fields: [
        { id: 'tipo',          label: 'Tipo de elevador',           type: 'select', options: ['Panorâmico', 'Carga', 'Social', 'Montacargas'] },
        { id: 'carga',         label: 'Capacidade de carga (kg)',   type: 'number', placeholder: 'ex: 630', suffix: 'kg' },
        { id: 'paradas',       label: 'Quantidade de paradas',      type: 'select', options: ['5', '10', '15', '20', '25+', 'Personalizado'] },
        { id: 'cargaEspecial', label: 'Marcar como Carga Especial', type: 'toggle' },
      ],
    },
    ESCADA: {
      key: 'ESCADA', label: 'Escada Rolante', glyph: 'escada',
      fields: [
        { id: 'modelo',     label: 'Modelo',                type: 'text',   placeholder: 'ex: OAK 30°' },
        { id: 'largura',    label: 'Largura do degrau',     type: 'select', options: ['600mm', '800mm', '1000mm', '1200mm'] },
        { id: 'velocidade', label: 'Velocidade',            type: 'select', options: ['0,5 m/s', '0,65 m/s'] },
        { id: 'desnivel',   label: 'Desnível / altura (m)', type: 'number', placeholder: 'ex: 4,5', suffix: 'm' },
      ],
    },
    ESTEIRA: {
      key: 'ESTEIRA', label: 'Esteira Rolante', glyph: 'esteira',
      fields: [
        { id: 'modelo',     label: 'Modelo',                       type: 'text',   placeholder: 'ex: TRAVELLATOR 12°' },
        { id: 'largura',    label: 'Largura da esteira',           type: 'select', options: ['800mm', '1000mm', '1200mm'] },
        { id: 'velocidade', label: 'Velocidade',                   type: 'select', options: ['0,5 m/s', '0,65 m/s'] },
        { id: 'desnivel',   label: 'Desnível / comprimento (m)',   type: 'number', placeholder: 'ex: 22', suffix: 'm' },
      ],
    },
  };

  /* ---------- Máscaras / formatação ---------- */
  function onlyDigits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function maskCNPJ(v) {
    const d = onlyDigits(v).slice(0, 14);
    if (d.length > 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    if (d.length > 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    if (d.length > 5)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length > 2)  return `${d.slice(0,2)}.${d.slice(2)}`;
    return d;
  }
  function maskCPF(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length > 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    if (d.length > 6) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0,3)}.${d.slice(3)}`;
    return d;
  }
  function maskPhone(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    const ddd = d.slice(0, 2), rest = d.slice(2);
    if (d.length <= 10) { const a = rest.slice(0, 4), b = rest.slice(4); return `(${ddd}) ${a}${b ? '-' + b : ''}`; }
    const a = rest.slice(0, 5), b = rest.slice(5); return `(${ddd}) ${a}${b ? '-' + b : ''}`;
  }
  function maskCEP(v) {
    const d = onlyDigits(v).slice(0, 8);
    if (d.length > 5) return `${d.slice(0,5)}-${d.slice(5)}`;
    return d;
  }
  function maskMoney(v) {
    const d = onlyDigits(v);
    if (!d) return '';
    return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseMoney(v) { const d = onlyDigits(v); return d ? parseInt(d, 10) / 100 : 0; }
  function brl(n) {
    if (n == null || isNaN(n)) return 'R$ 0,00';
    return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function dataBR(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function descEquipamento(f) {
    if (!f || !f.tipoEquip) return '—';
    const e = EQUIPAMENTOS[f.tipoEquip];
    const qtd = f.qtd || 1;
    if (f.tipoEquip === 'ELEVADOR') {
      const p = f.paradas ? `, ${f.paradas} paradas` : '';
      const c = f.carga ? `, ${f.carga}kg` : '';
      return `${qtd}× Elevador ${f.tipo || ''}${c}${p}`.replace(/\s+/g, ' ').trim();
    }
    const m = f.modelo ? ` ${f.modelo}` : '';
    const l = f.largura ? `, ${f.largura}` : '';
    return `${qtd}× ${e.label}${m}${l}`.replace(/\s+/g, ' ').trim();
  }

  function defaultState() {
    return {
      dossier_id: null,  // ISSUE #6: Vinculação ao Dossier da Obra
      comprador: { razao: '', cnpj: '', endereco: '', rep: '', repCargo: '', repCpf: '', email: '', tel: '' },
      tipoEquip: 'ELEVADOR', qtd: 1,
      tipo: 'Social', carga: '', paradas: '10', cargaEspecial: false,
      modelo: '', largura: '', velocidade: '0,5 m/s', desnivel: '',
      distancia: '', localObra: '',
      valor: '', sinalPct: 30, parcelas: 5,
      checklist: { proposta: false, desenho: false, nrs: false },
      d0_entrada: null,      // ISSUE #6: Data de pagamento da entrada
      d0_assinatura: null,   // ISSUE #6: Data de assinatura do contrato
      d0_projeto: null,      // ISSUE #6: Data de aprovação do projeto
    };
  }

  /* ---------- Builder do documento ---------- */
  function buildContract(ctx) {
    const f = ctx.form || {};
    const c = (ctx.comprador || f.comprador) || {};
    const V = VENDEDORA;
    const valor = ctx.valor || 0;
    const sinalPct = ctx.sinalPct != null ? ctx.sinalPct : 30;
    const parcelas = ctx.parcelas != null ? ctx.parcelas : 5;
    const numero = ctx.numero || 'VPVE________';

    const cargaNum = parseFloat(String(f.carga || '0').replace(',', '.')) || 0;
    const isElevador = f.tipoEquip === 'ELEVADOR';
    const especial = isElevador && (cargaNum >= 1000 || f.cargaEspecial);
    const dist = parseFloat(String(f.distancia || '0').replace(',', '.')) || 0;
    const longa = dist >= 100;
    const descEq = descEquipamento(f);
    const localObra = f.localObra || '(ENDEREÇO COMPLETO DO LOCAL DE ENTREGA)';

    /* Tabela de parcelas */
    const sinalValor = valor * (sinalPct / 100);
    const saldo = valor - sinalValor;
    const parcValor = parcelas > 0 ? saldo / parcelas : 0;
    const tabela = [{ label: 'Sinal / entrada', quando: 'Na assinatura', pct: sinalPct, valor: sinalValor }];
    for (let i = 1; i <= parcelas; i++) {
      tabela.push({ label: `Parcela ${i} de ${parcelas}`, quando: `${i * 30} dias`, pct: (100 - sinalPct) / parcelas, valor: parcValor });
    }

    const compRazao = c.razao || 'RAZÃO SOCIAL';
    const compCnpj  = c.cnpj  || 'XX.XXX.XXX/XXXX-XX';
    const compEnd   = c.endereco || 'Rua XXX, nº XXX, bairro, cidade/estado, CEP XX.XXX-XX';
    const compRep   = c.rep   || 'NOME DO RESPONSÁVEL';
    const compCpf   = c.repCpf || '';

    const sections = [];
    const p = (text, opts = {}) => ({ text, ...opts });

    /* Preâmbulo */
    sections.push({
      id: 'preambulo', kind: 'preamble',
      body: [
        p('Pelo presente instrumento particular e na melhor forma de direito, as partes a seguir nomeadas:'),
        p(`<b>VENDEDORA:</b> ${V.razao}, inscrita no CNPJ sob o nº ${V.cnpj}, com sede à ${V.endereco}, neste ato representada nos termos de seu Contrato social por <b>${V.rep}</b>, ${V.repQualif}, com escritório no endereço acima mencionado e;`, { html: true }),
        p(`<b>COMPRADOR:</b> ${compRazao}, inscrito no CNPJ sob o nº ${compCnpj}, com sede à ${compEnd}, neste ato representada nos termos de seu ato constitutivo por <b>${compRep}</b>${c.repCargo ? `, ${c.repCargo}` : ''}${compCpf ? `, inscrito no CPF nº ${compCpf}` : ''}.`, { html: true }),
        p('Têm, entre si, certo e ajustado o presente Contrato de compra e venda de equipamento, o qual se regerá pelas disposições do Código Civil e demais condições abaixo, às quais as partes mutuamente se obrigam.'),
      ],
    });

    /* 1. OBJETO */
    sections.push({
      id: 's1', num: '1', title: 'OBJETO DO CONTRATO',
      body: [
        p('<b>1.1 Objeto.</b> O objeto deste Contrato consiste no descrito a seguir, observados e respeitados os termos e as condições estabelecidos neste instrumento contratual:', { html: true }),
        p(`Compra e venda de <b>${descEq}</b> (DESCREVER CONFORME PROPOSTA COMERCIAL), denominado equipamentos, conforme especificações dos Anexos I e II.`, { html: true, li: true }),
        p('Modalidade: "CIF" (Cost, Insurance and Freight).', { li: true }),
        p('Instalação dos equipamentos de forma a entregá-los ao COMPRADOR em condições de uso imediato ("turn key"), compreendendo frete (transporte e desembarque), entrega, instalação e montagem.', { li: true }),
        p(`<b>LOCAL DE ENTREGA:</b> ${localObra}. Qualquer alteração no CEP do local de entrega poderá sofrer reajuste de preço.`, { html: true, callout: true }),
        p('<b>1.1.1</b> Os anexos a este Contrato constituem parte indissociável: Anexo I — Proposta Comercial nº ' + numero + '; Anexo II — Desenho(s) Técnico(s).', { html: true }),
      ],
    });

    /* 2. ENTREGA E INSTALAÇÃO (+ condicionais) */
    const s2 = {
      id: 's2', num: '2', title: 'INFORMAÇÕES SOBRE A ENTREGA E A INSTALAÇÃO',
      body: [
        p('<b>2.1 Instalação e funcionamento.</b> A instalação observará as normas técnicas pertinentes. O COMPRADOR declara ciência de que o funcionamento definitivo dependerá das boas condições do local e das instalações elétricas adequadas e permanentes que os alimentarão.', { html: true }),
        p('<b>2.2 Guarda e manutenção.</b> O COMPRADOR se obriga a receber os equipamentos dentro do prazo acordado e a mantê-los protegidos contra avaria, dano e/ou deterioração, incluindo proteção contra detritos de obra (cimento, gesso, poeira, tinta, umidade, chuva).', { html: true }),
        p('<b>2.3 Autorização para descarga.</b> A descarga será realizada no local da obra indicado na cláusula 1.1, cabendo ao COMPRADOR obter as autorizações junto às autoridades competentes.', { html: true }),
        p('<b>2.4 Frete.</b> A VENDEDORA garante o frete rodoviário e marítimo sem custo desde que a obra esteja pronta na data de entrega. Em caso de descumprimento, os custos de frete, descarga e armazenamento serão de responsabilidade do COMPRADOR.', { html: true }),
        p('<b>2.5 Prazo de entrega.</b> O prazo de entrega é de <b>120 a 150 dias</b>, contados da data em que TODOS os seguintes requisitos forem cumpridos cumulativamente: (a) assinatura deste contrato; (b) compensação bancária do pagamento do sinal; (c) aprovação formal do projeto/desenho técnico pelo COMPRADOR; (d) liberação formal do local (poço civil para elevadores ou berços inferior/superior para escadas/esteiras) conforme laudo técnico.', { html: true }),
        p('<b>2.5.1</b> Em caso de atraso da VENDEDORA, incidirá multa moratória diária de 0,05%, limitada a 2% sobre o valor do(s) equipamento(s) em atraso.', { html: true }),
        p('<b>2.6.2 Da dependência da obra civil.</b> A instalação está condicionada à perfeita conclusão das obras civis e elétricas pelo COMPRADOR. Caso o local não esteja apto (ex.: poço sem fundo, sem alimentação trifásica, ou berços sem acabamento), a VENDEDORA poderá paralisar os serviços. A paralisação por culpa do COMPRADOR acarretará redesenho do cronograma e poderá gerar cobrança de taxa de desmobilização e remobilização da equipe, além de custos de armazenamento dos equipamentos.', { html: true }),
      ],
    };
    if (especial) {
      s2.body.push(p(`<b>2.10 Cláusula de Equipamento Especial.</b> Em razão da capacidade de carga declarada (${f.carga || '≥1.000'} kg) e/ou da classificação como carga especial, o COMPRADOR reconhece a necessidade de <b>reforço de estrutura</b>, <b>logística de içamento diferenciada</b> e emissão de <b>ART específica</b>, cujos custos e providências observarão o projeto executivo entregue pela VENDEDORA.`, { html: true, injected: true, tag: 'Injetada · Carga ≥ 1.000 kg' }));
    }
    if (longa) {
      s2.body.push(p(`<b>2.11 Cláusula de Logística e Deslocamento.</b> Considerando a distância superior a 100 km da sede da VENDEDORA (${dist} km), ficam sob responsabilidade do COMPRADOR as despesas de transporte, hospedagem e alimentação da equipe técnica durante o período de instalação, bem como o prazo de execução será acrescido de 2 (dois) dias úteis para cada 100 km adicionais, salvo acordo em contrário.`, { html: true, injected: true, tag: `Injetada · Obra a ${dist} km` }));
    }
    sections.push(s2);

    /* 3. PREÇO E PAGAMENTO */
    sections.push({
      id: 's3', num: '3', title: 'PREÇO E CONDIÇÕES DE PAGAMENTO',
      body: [
        p(`<b>3.1 Preço.</b> Pela compra dos equipamentos e prestação dos serviços de instalação e montagem, o COMPRADOR pagará à VENDEDORA o valor total de <b>${brl(valor)}</b>, conforme cronograma abaixo:`, { html: true }),
        p('__TABELA_PARCELAS__', { table: tabela }),
        p('<b>3.2 Serviços.</b> A porcentagem de serviços em relação ao preço total pode chegar a até 30%, podendo ser considerado serviço a instalação, frete rodoviário, projetos de engenharia e treinamentos.', { html: true }),
        p('<b>3.3 Formas de pagamento.</b> Boleto, depósito bancário ou transferência eletrônica diretamente na conta corrente da VENDEDORA.', { html: true }),
        p('<b>3.4 Penalidades por atraso.</b> Sobre o valor em atraso incidirá multa de 2%, juros moratórios de 1% ao mês (pro rata die) e correção monetária pelo IGPM. Atraso superior a 30 dias importa vencimento integral e antecipado do débito, protesto e negativação.', { html: true }),
      ],
    });

    /* 4. OBRIGAÇÕES DA VENDEDORA */
    sections.push({
      id: 's4', num: '4', title: 'OBRIGAÇÕES DA VENDEDORA',
      body: [
        p('<b>4.1</b> Adotar as Normas Regulamentadoras de Segurança e Saúde no Trabalho, responsabilizando-se pelo fornecimento e uso de EPIs e EPCs por sua equipe.', { html: true }),
        p('<b>4.2</b> Providenciar todo o material e mão-de-obra, mantendo a equipe uniformizada e identificada por crachás.', { html: true }),
        p('<b>4.3</b> Ser a única responsável por seus funcionários e prepostos, inclusive por encargos trabalhistas, previdenciários e sociais, isentando o COMPRADOR.', { html: true }),
      ],
    });

    /* 5. OBRIGAÇÕES DO COMPRADOR */
    sections.push({
      id: 's5', num: '5', title: 'OBRIGAÇÕES DO COMPRADOR',
      body: [
        p('<b>5.1</b> Cumprir suas obrigações, especialmente o pagamento em dia e os prazos de execução das obras civis e elétricas de sua responsabilidade.', { html: true }),
        p('<b>5.3</b> Oferecer local fechado e adequado para armazenamento de peças e ferramentas, responsabilizando-se por sua guarda.', { html: true }),
        p('<b>5.5</b> Providenciar, custear e executar sem atraso todas as obras civis e elétricas de sua responsabilidade, bem como os pontos para içamento, sob pena de adiamento da entrega final.', { html: true }),
      ],
    });

    /* 6. GARANTIAS */
    sections.push({
      id: 's6', num: '6', title: 'GARANTIAS E EXCLUSÕES',
      body: [
        p('<b>6.1 Prazo.</b> A garantia é de <b>90 (noventa) dias</b> para peças e mão de obra, contados do Termo de Aceite Final, podendo ser estendida por mais 9 meses desde que sob assistência técnica da VENDEDORA ou empresa homologada.', { html: true }),
        p('<b>6.2 Exclusões.</b> A garantia é <b>automaticamente anulada</b> em casos de: (a) infiltração de água no poço do elevador ou nas máquinas de escada/esteira; (b) oscilação ou falta de energia fora dos padrões nominais; (c) mau uso, vandalismo ou operação por pessoas não treinadas; (d) interferência de terceiros ou empresas não homologadas pela VENDEDORA.', { html: true }),
        p('<b>6.2.2</b> A garantia não se estende a materiais de concepção frágil (lâmpadas, acabamentos, fusíveis, sensores e micros de qualquer natureza).', { html: true }),
      ],
    });

    /* 7. PENALIDADES */
    sections.push({
      id: 's7', num: '7', title: 'PENALIDADES POR DESCUMPRIMENTO',
      body: [
        p('<b>7.1</b> Para descumprimento de cláusula sem multa específica, a parte infratora arcará com multa de 2% sobre o valor do Contrato, paga à vista em até 10 dias da violação.', { html: true }),
        p('<b>7.1.2</b> Não cumprida a multa, a parte infratora arcará também com emolumentos, taxas, custas processuais e honorários advocatícios em 20%.', { html: true }),
      ],
    });

    /* 8. ENCERRAMENTO */
    sections.push({
      id: 's8', num: '8', title: 'CONDIÇÕES DE ENCERRAMENTO',
      body: [
        p('<b>8.1</b> Decorridos 30 dias de atraso no pagamento sem justificativa, a VENDEDORA notificará o COMPRADOR concedendo 5 dias úteis para regularização; não efetuado o pagamento, o Contrato estará rescindido de pleno direito.', { html: true }),
        p('<b>8.2 Da desistência.</b> Em caso de desistência pelo COMPRADOR <b>após a emissão da Ordem de Fabricação</b>, este deverá pagar <b>70% (setenta por cento)</b> do valor total dos equipamentos (em razão da natureza customizada/sob medida) e <b>50% (cinquenta por cento)</b> do valor dos serviços de instalação, a título de cláusula penal compensatória, sem prejuízo de perdas e danos.', { html: true }),
      ],
    });

    /* 9. CASO FORTUITO */
    sections.push({
      id: 's9', num: '9', title: 'CASO FORTUITO E FORÇA MAIOR',
      body: [
        p('<b>9.1</b> As partes não respondem por descumprimento decorrente de situações imprevisíveis, irresistíveis e/ou inevitáveis (art. 393, parágrafo único, do Código Civil).', { html: true }),
        p('<b>9.3</b> Não se consideram caso fortuito: dificuldades econômico-financeiras; perda de mercado; insolvência; greves; e condições climáticas previsíveis pela história local.', { html: true }),
      ],
    });

    /* 10. DISPOSIÇÕES FINAIS */
    sections.push({
      id: 's10', num: '10', title: 'DISPOSIÇÕES FINAIS',
      body: [
        p('<b>10.9 Título executivo.</b> As Partes reconhecem o presente contrato enquanto título executivo extrajudicial (art. 784, III, CPC).', { html: true }),
        p('<b>10.12 Foro.</b> Fica eleito o Foro Central (João Mendes) da Comarca de São Paulo/SP.', { html: true }),
        p('<b>10.13 Assinatura digital.</b> As Partes estabelecem que o contrato poderá ser firmado por meios eletrônicos, com assinatura eletrônica válida e plenamente eficaz, constituindo título executivo extrajudicial, nos termos do art. 10 da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.', { html: true }),
        p(`Guarulhos, ${dataBR(new Date())}.`, { center: true, sign: true }),
      ],
    });

    return {
      sections,
      meta: { especial, longa, dist, descEq, numero, valor, compRazao, compRep, compCpf },
      contratante: V,
      comprador: { razao: compRazao, cnpj: compCnpj, endereco: compEnd, rep: compRep, repCpf: compCpf, repCargo: c.repCargo },
      titulo: 'CONTRATO DE COMPRA E VENDA DE EQUIPAMENTO — ' + descEq,
      numero,
    };
  }

  /* ---------- ISSUE #6: Calcular D0 ---------- */
  function calcularD0(d0_entrada, d0_assinatura, d0_projeto) {
    // D0 é o MÁXIMO entre:
    // 1. Data de pagamento da entrada
    // 2. Data de assinatura do contrato
    // 3. Data de aprovação do projeto
    const datas = [];
    if (d0_entrada) datas.push(new Date(d0_entrada).getTime());
    if (d0_assinatura) datas.push(new Date(d0_assinatura).getTime());
    if (d0_projeto) datas.push(new Date(d0_projeto).getTime());

    if (datas.length === 0) return null;
    const d0Timestamp = Math.max(...datas);
    return new Date(d0Timestamp).toISOString().split('T')[0];  // retorna YYYY-MM-DD
  }

  /* ---------- Exporta tudo em window.CV ---------- */
  window.CV = {
    VENDEDORA, EQUIPAMENTOS,
    onlyDigits, maskCNPJ, maskCPF, maskPhone, maskCEP, maskMoney, parseMoney, brl, dataBR,
    descEquipamento, defaultState,
    buildContract,
    calcularD0,  // ISSUE #6
  };
}());
