/* ============================================================
   contrato-venda-engine.js
   Template do Contrato de Compra e Venda de Equipamentos (Cliente).
   Reproduz a minuta oficial "MINUTA CONTRATUAL VERTICALPARTS" (16 páginas,
   revisada pelo Jurídico) cláusula por cláusula — nada resumido.
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

  /* ---------- Contatos fixos da VENDEDORA (cláusula 10.1) ---------- */
  const CONTATOS_VP = [
    { nome: 'Diego Yutaka Maeno', cargo: 'CEO',         tel: '(11) 99462-1946', email: 'diego@verticalparts.com.br' },
    { nome: 'Marcus Braz',        cargo: 'Comercial',   tel: '(11) 99898-1275', email: 'marcus.braz@verticalparts.com.br' },
    { nome: 'Arilene Avila',      cargo: 'Operacional', tel: '(11) 96407-7688', email: 'arilene.avila@verticalparts.com.br' },
    { nome: 'Juliana Anderson',   cargo: 'Financeiro',  tel: '(11) 94460-6396', email: 'juliana@verticalparts.com.br' },
  ];

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
  /* Escapa entidades HTML — os parágrafos com `{ html: true }` misturam
     marcação estática (<b>) com dados do comprador digitados em formulário
     (razão social, endereço...); sem isso, um campo com `<script>` ou
     `<img onerror=...>` executa na prévia/PDF do contrato (XSS armazenado). */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function extenso(n) {
    /* Sem lib de números por extenso — a minuta oficial sempre traz o valor
       por extenso ao lado do numérico; aqui deixamos o campo para o
       Jurídico/Comercial completar antes do envio, igual a outros pontos
       da minuta que ficam como lacuna editável (RG, endereço residencial). */
    return '(valor por extenso)';
  }

  function descEquipamento(f) {
    if (!f || !f.tipoEquip) return '—';
    const e = EQUIPAMENTOS[f.tipoEquip];
    const qtd = f.qtd || 1;
    if (f.tipoEquip === 'ELEVADOR') {
      const p = f.paradas ? `, ${f.paradas} paradas` : '';
      const c = f.carga ? `, ${f.carga}kg` : '';
      const m = f.modelo ? ` ${f.modelo}` : '';
      return `${qtd}× Elevador ${f.tipo || ''}${m}${c}${p}`.replace(/\s+/g, ' ').trim();
    }
    const m = f.modelo ? ` ${f.modelo}` : '';
    const l = f.largura ? `, ${f.largura}` : '';
    return `${qtd}× ${e.label}${m}${l}`.replace(/\s+/g, ' ').trim();
  }

  function defaultState() {
    return {
      dossier_id: null,  // ISSUE #6: Vinculação ao Dossier da Obra
      masterId: null, propostaId: null,  // Master ID Fase 2 — herda da Proposta selecionada
      comprador: {
        razao: '', cnpj: '', endereco: '',
        rep: '', repCargo: '', repCpf: '', email: '', tel: '',
        /* Qualificação do representante — cláusula do preâmbulo (minuta oficial) */
        repNacionalidade: '', repEstadoCivil: '', repProfissao: '', repRg: '', repEnderecoResidencial: '',
      },
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
    const compCpf   = c.repCpf || 'XXX';
    const compNac   = c.repNacionalidade || 'nacionalidade';
    const compEstCivil = c.repEstadoCivil || 'estado civil';
    const compProf  = c.repProfissao || 'profissão';
    const compRg    = c.repRg || 'XXX';
    const compEndResp = c.repEnderecoResidencial || 'Rua XXX, nº XXX, bairro, cidade/estado, CEP XX.XXX-XX';

    const sections = [];
    const p = (text, opts = {}) => ({ text, ...opts });

    /* Preâmbulo */
    sections.push({
      id: 'preambulo', kind: 'preamble',
      body: [
        p('Pelo presente instrumento particular e na melhor forma de direito, as partes a seguir nomeadas:'),
        p(`<b>VENDEDORA:</b> ${esc(V.razao)}, inscrita no CNPJ sob o nº ${esc(V.cnpj)}, com sede à ${esc(V.endereco)}, neste ato representada nos termos de seu Contrato social por <b>${esc(V.rep)}</b>, ${esc(V.repQualif)}, com escritório no endereço acima mencionado e;`, { html: true }),
        p(`<b>COMPRADOR:</b> ${esc(compRazao)}, inscrito no CNPJ sob o nº ${esc(compCnpj)}, com sede à ${esc(compEnd)}, neste ato representada nos termos de seu ato constitutivo por <b>${esc(compRep)}</b>, ${esc(compNac)}, ${esc(compEstCivil)}, ${esc(compProf)}, portador da cédula de identidade RG de nº ${esc(compRg)}, inscrito no CPF nº ${esc(compCpf)}, residente e domiciliado na ${esc(compEndResp)}.`, { html: true }),
        p('Têm, entre si, certo e ajustado o presente Contrato de compra e venda de equipamento, o qual se regerá pelas disposições do Código Civil e demais condições abaixo, às quais as partes mutuamente se obrigam.'),
      ],
    });

    /* 1. OBJETO */
    sections.push({
      id: 's1', num: '1', title: 'OBJETO DO CONTRATO',
      body: [
        p('<b>1.1 Objeto.</b> O objeto deste Contrato consiste no descrito a seguir, observados e respeitados os termos e as condições estabelecidos neste instrumento contratual:', { html: true }),
        p(`Compra e venda de <b>${esc(descEq)}</b> (DESCREVER CONFORME PROPOSTA COMERCIAL), denominado equipamentos, conforme especificações dos Anexos I e II.`, { html: true, li: true }),
        p('Modalidade: "CIF" (Cost, Insurance and Freight).', { li: true }),
        p('Instalação dos equipamentos mencionados acima de forma a entregá-los ao COMPRADOR em condições de uso imediato ("turn key"). A instalação compreende as seguintes atividades:', { li: true }),
        p('Frete (transporte e desembarque);', { li: true, indent: true }),
        p('Entrega, Instalação e montagem dos equipamentos ocorrerão no endereço abaixo e qualquer alteração no CEP do local de entrega poderá sofrer reajuste de preço.', { li: true, indent: true }),
        p(`<b>LOCAL DE ENTREGA:</b> ${esc(localObra)}.`, { html: true, callout: true }),
        p('<b>1.1.1</b> Os seguintes anexos a este Contrato constituem parte indissociável e podem servir para complementar os termos e as condições firmadas neste instrumento contratual.', { html: true }),
        p(null, { anexos: [
          ['Anexo I', 'Proposta Comercial nº ' + numero],
          ['Anexo II', 'Desenho(s) Técnico(s)'],
        ] }),
      ],
    });

    /* 2. ENTREGA E INSTALAÇÃO */
    const s2 = {
      id: 's2', num: '2', title: 'INFORMAÇÕES SOBRE A ENTREGA E A INSTALAÇÃO DOS EQUIPAMENTOS',
      body: [
        p('<b>2.1 Instalação e funcionamento dos equipamentos.</b> A instalação dos equipamentos a serem entregues ao COMPRADOR observarão as normas técnicas pertinentes à natureza do trabalho. O COMPRADOR declara ciência de que o funcionamento definitivo desses equipamentos dependerá das boas condições do local em que serão montados e ainda das instalações elétricas adequadas e permanentes que os alimentarão.', { html: true }),
        p('<b>2.1.1</b> As instalações elétricas deverão ser providenciadas, antecipada e exclusivamente, pelo COMPRADOR, seguindo as especificações técnicas contidas nos Anexos I e II, para que após aprovação seja iniciada produção dos equipamentos, vide cláusula 2.8.', { html: true, indent: true }),
        p('<b>2.2 Guarda e manutenção.</b> O COMPRADOR se obriga a receber os equipamentos, dentro do prazo acordado para a entrega, vide cláusula 2.4, e a mantê-los devidamente protegidos contra qualquer tipo de avaria, dano e/ou deterioração, incluindo a proteção contra detritos originados das obras civis, como por exemplo: cimento, gesso, massa corrida, poeira, tinta, umidade, chuva, entre outros.', { html: true }),
        p('<b>2.2.1</b> Essa obrigação perdurará do ato de entrega dos equipamentos no local da instalação até a vistoria final e a efetiva entrega dos mesmos em pleno funcionamento. Ocasião na qual deverá ser assinado o Termo de Conclusão da Instalação pelas partes deste Contrato e pela empresa designada para a manutenção dos equipamentos.', { html: true, indent: true }),
        p('<b>2.2.2</b> Caso a obra não esteja apta ao recebimento dos equipamentos até a data de entrega, o COMPRADOR deverá indicar um local para a entrega, vide cláusula 1.1, se o COMPRADOR não indicar o local, os equipamentos serão armazenados em local de terceiros e todos os custos decorrentes da armazenagem e posterior movimentação dos equipamentos para a obra, serão de total responsabilidade do COMPRADOR.', { html: true, indent: true }),
        p('<b>2.3 Autorização para descarga.</b> A descarga dos equipamentos será realizada diretamente no local da obra indicado na cláusula 1.1. O COMPRADOR se obriga a providenciar junto às autoridades competentes a autorização para descarga no endereço da obra dos equipamentos em dia e horário previamente agendado entre as Partes.', { html: true }),
        p('<b>2.4 Frete.</b> A VENDEDORA garante o frete rodoviário e marítimo sem custo para o COMPRADOR desde que a obra esteja pronta na data de entrega dos equipamentos, vide cláusula 2.5. Em caso de descumprimento dessa condição, será de inteira responsabilidade do COMPRADOR quaisquer custos referentes ao frete rodoviário, à descarga e ao armazenamento dos equipamentos.', { html: true }),
        p('<b>2.5 Prazo de entrega na obra.</b> A VENDEDORA se compromete a entregar os equipamentos adquiridos no prazo de 120 (cento e vinte) a 150 (cento e cinquenta) dias, a contar da data que o último requisito for preenchido, quais sejam: assinatura do Contrato, pagamento do sinal e aprovação do projeto. A conclusão desses 03 (três) requisitos são condições essenciais e indispensáveis para o início da contagem do prazo de entrega dos equipamentos.', { html: true }),
        p('<b>2.5.1</b> Caso a VENDEDORA não realize a entrega dos equipamentos na obra no prazo convencionado, ficará sujeita ao pagamento da multa moratória diária de 0,05% (cinco centésimos por cento) limitado até 2% (dois por cento) sobre o valor do(s) equipamento(s) em atraso.', { html: true, indent: true }),
        p('<b>2.6 Cronograma de Obra.</b> O COMPRADOR deverá apresentar à validação da VENDEDORA o cronograma de obra contendo as datas de liberação para início das montagens e datas finais de entrega.', { html: true }),
        p('<b>2.6.1 Procedimento e Prazos para Instalação:</b> O processo de instalação dos equipamentos seguirá conforme abaixo:', { html: true, indent: true }),
        p('<b>a)</b> O COMPRADOR deverá notificar a VENDEDORA por escrito para que esta inicie a instalação dos equipamentos, respeitado o cronograma de obras, e em prazo que não poderá ser superior a 90 (noventa) dias após a entrega, sob pena da resolução deste contrato aplicando-se o disposto na alínea “b” do item 8.2.2 do contrato;', { html: true, indent: true }),
        p('<b>b)</b> Em até 05 (cinco) dias após a notificação do COMPRADOR, a VENDEDORA apresentará a relação de atividades a serem realizadas e os respectivos prazos, podendo a disponibilização da equipe de montagem — e, consequentemente, o início das atividades — ocorrer em até 90 (noventa) dias, conforme a disponibilidade das equipes;', { html: true, indent: true }),
        p('<b>c)</b> A VENDEDORA iniciará a instalação dos equipamentos de acordo com o cronograma apresentado ao COMPRADOR.', { html: true, indent: true }),
        p('<b>2.6.2</b> A VENDEDORA compromete-se a realizar a instalação e a montagem de cada equipamento em até 30 (trinta) dias após sua entrega, desde que a obra esteja concluída na data de entrega dos equipamentos, podendo os prazos de instalação serem cumulativos conforme o número de equipamentos.', { html: true, indent: true }),
        p('<b>2.6.2.1</b> Para fins da cláusula 2.6, considera-se a obra concluída quando:', { html: true, indent: true }),
        p('a) no caso de elevadores, o(s) poço(s) estiver(em) devidamente liberado(s) para instalação;', { indent: true }),
        p('b) no caso de escadas ou esteiras rolantes, os “berços” (inferior e superior) estiverem totalmente finalizados.', { indent: true }),
        p('<b>2.6.3</b> A VENDEDORA não se responsabiliza por eventual atraso na instalação e montagem dos equipamentos por alterações no cronograma de obra ou por motivos a que o COMPRADOR der causa.', { html: true, indent: true }),
        p('<b>2.7 Alterações nos prazos acordados.</b> Todos os prazos com os quais a VENDEDORA se compromete estão sujeitos a alterações em caso de eventuais paralisações, interrupções ou atrasos na atividade em decorrência de situações imprevisíveis, irresistíveis e/ou inevitáveis (“caso fortuito ou força maior”) que impeçam ou dificultem o cumprimento do acordado.', { html: true }),
        p('<b>2.7.1</b> São exemplos de situações imprevisíveis: pandemia, epidemia, calamidades públicas, greves, trâmites aduaneiros entre outros.', { html: true, indent: true }),
        p('<b>2.8 Aprovação de projetos.</b> O COMPRADOR deverá aprovar os projetos referentes aos equipamentos na data de assinatura deste Contrato.', { html: true }),
        p('<b>2.9 Condições importantes.</b> O cumprimento dos prazos acordados também está condicionado à permissão de acesso à VENDEDORA ao local de execução dos serviços, à existência de um ambiente de trabalho seguro conforme as normas aplicáveis e à disponibilidade no mercado de Equipamento de Proteção Individual, mão-de-obra e material necessários para o devido cumprimento do Contrato.', { html: true }),
      ],
    };
    sections.push(s2);

    /* 3. PREÇO E PAGAMENTO */
    sections.push({
      id: 's3', num: '3', title: 'PREÇO E CONDIÇÕES DE PAGAMENTO',
      body: [
        p(`<b>3.1 Preço.</b> Pela compra dos equipamentos e prestação dos serviços de instalação e montagem, o COMPRADOR pagará à VENDEDORA o valor total de <b>${brl(valor)} (${extenso(valor)})</b>. O pagamento deverá ser efetuado conforme cronograma abaixo:`, { html: true }),
        p('__TABELA_PARCELAS__', { table: tabela }),
        p('<b>3.2 Serviços.</b> A porcentagem de serviços em relação ao preço total pode chegar a até 30% (trinta por cento) podendo ser considerado serviço a instalação, frete rodoviário, projetos de engenharia, treinamentos entre outros.', { html: true }),
        p('<b>3.3 Formas de pagamento.</b> Todos os valores acima mencionados poderão ser pagos pelo COMPRADOR por meio de boleto, depósito bancário ou transferência eletrônica bancária diretamente na conta corrente da VENDEDORA ou de outra forma que as partes combinarem.', { html: true }),
        p('<b>3.4 Penalidades por atraso no pagamento.</b> Caso o COMPRADOR não realize qualquer pagamento na data prevista, sobre o valor em atraso incidirá multa de 2% (dois por cento), juros moratórios de 1% (um por cento) ao mês, calculado por dia de atraso (pro rata die) e correção monetária pelo índice IGPM ou outro que o substitua.', { html: true }),
        p('<b>3.4.1</b> Além das penalidades previstas acima, o atraso no pagamento de qualquer valor por mais de 30 (trinta) dias importará no vencimento integral e antecipado do débito total vencendo, sujeitando o COMPRADOR ao protesto extrajudicial, à negativação nos órgãos de proteção ao crédito e à execução imediata do presente instrumento, independentemente de notificação, intimação, interpelação ou qualquer outra formalidade.', { html: true, indent: true }),
        p('<b>3.4.2</b> Também será caso de vencimento antecipado a falência, a recuperação judicial, a alteração societária, a dissolução ou o encerramento de fato das atividades (apurado pela verificação do fechamento do estabelecimento comercial) do COMPRADOR.', { html: true, indent: true }),
        p('<b>3.4.3</b> Não será concedido ao COMPRADOR qualquer prorrogação, novação ou prazo de carência. Porém, qualquer concessão ou outro benefício dado ao COMPRADOR pela VENDEDORA não implicará em novação da dívida ou alteração das condições pactuadas neste Contrato, sendo mera liberalidade e, portanto, mantendo-se o pactuado inalterado, válido e exigível.', { html: true, indent: true }),
        p('<b>3.5 Tributos e Contribuições.</b> Os impostos serão lançados na época de sua exigibilidade e serão calculados e lançados em função do objeto e/ou serviço fornecido, na forma legal própria.', { html: true }),
        p('<b>3.5.1</b> Estão inclusos no preço todos os impostos decorrentes de emissão de Notas Fiscais de venda/serviços, montagem, instalação dos equipamentos, bem como ART’S.', { html: true, indent: true }),
        p('<b>3.5.2</b> Não estão inclusos no preço taxas de alvará de funcionamento ou outras licenças de qualquer natureza vinculadas às obrigações do COMPRADOR, bem como majorações de taxas e impostos, a exemplo de DIFAL de ICMS e de tributos e encargos incidentes sobre a importação e nacionalização das mercadorias (incluindo, sem limitação, Imposto de Importação (II), IPI, PIS/COFINS-Importação, ICMS-importação, AFRMM e taxa SISCOMEX), havidos após a emissão desta proposta ou da NF de venda.', { html: true, indent: true }),
      ],
    });

    /* 4. OBRIGAÇÕES DA VENDEDORA */
    sections.push({
      id: 's4', num: '4', title: 'OBRIGAÇÕES DA VENDEDORA',
      body: [
        p('<b>4.1 Normas seguidas.</b> A VENDEDORA se obriga a adotar todas as disposições das Normas Regulamentadoras de Segurança e Saúde no Trabalho do Ministério do Trabalho e Emprego referentes aos serviços prestados, responsabilizando-se pelo fornecimento e uso adequado e regular de Equipamentos de Proteção Individuais (EPIs) e coletivos (EPCs) por sua equipe de profissionais.', { html: true }),
        p('<b>4.2 Providência de material e pessoal.</b> A VENDEDORA providenciará todo o material e a mão-de-obra necessários à execução dos serviços contratados. Igualmente, a VENDEDORA manterá a sua equipe de profissionais devidamente uniformizada e identificada por crachás de fácil visualização durante a permanência deles nas dependências do COMPRADOR.', { html: true }),
        p('<b>4.3 Responsabilidade por funcionários.</b> A VENDEDORA é a única e integral responsável por seus funcionários e/ou prepostos, seja pela segurança deles, seja por seus atos ou omissões. A VENDEDORA arcará, inclusive, em caráter de exclusividade, com todas as responsabilidades trabalhistas, previdenciárias e sociais advindas da relação estabelecida com os empregados contratados, isentando o COMPRADOR de qualquer responsabilidade daí decorrente.', { html: true }),
        p('<b>4.4 Indenização por danos.</b> Na hipótese de danos materiais ou morais comprovadamente causados por dolo ou culpa grave dos profissionais da VENDEDORA durante a execução dos serviços no estabelecimento da COMPRADORA, esta será indenizada exclusivamente por danos diretos, limitados ao valor total do Contrato, mediante nexo causal apurado em juízo. Reciprocamente, a COMPRADORA indenizará a VENDEDORA por danos causados por atos ou omissões de seus prepostos ou instalações inadequadas. A parte responsável arcará com custos, despesas e honorários advocatícios comprovados.', { html: true }),
      ],
    });

    /* 5. OBRIGAÇÕES DO COMPRADOR */
    sections.push({
      id: 's5', num: '5', title: 'OBRIGAÇÕES DO COMPRADOR',
      body: [
        p('<b>5.1 Cumprimento de obrigações.</b> O COMPRADOR se obriga a cumprir as suas obrigações contratuais, principalmente no que se refere ao pagamento em dia do preço previsto em Contrato e aos prazos de execução das obras civis e elétricas de sua responsabilidade.', { html: true }),
        p('<b>5.2 Colaboração.</b> O COMPRADOR se obriga a propiciar à VENDEDORA as condições necessárias para que esta execute os serviços contratados, notadamente no que se refere a acesso e a movimentação externa e interna no local de instalação dos equipamentos.', { html: true }),
        p('<b>5.3 Armazenamento de peças e ferramentas.</b> O COMPRADOR se obriga a oferecer à VENDEDORA um local fechado adequado para o armazenamento de peças e ferramentas utilizadas na execução dos serviços. O COMPRADOR declara ciência de que se responsabilizará pela guarda desses materiais enquanto os tiver em suas dependências.', { html: true }),
        p('<b>5.3.1</b> Caso o COMPRADOR não cumpra com a obrigação acima, deverá ressarcir a VENDEDORA por todos os custos que forem necessários para o armazenamento dos equipamentos em local seguro e apropriado.', { html: true, indent: true }),
        p('<b>5.4 Custeio de valores extras.</b> O COMPRADOR deverá custear qualquer obra, projeto civil ou reforma que se faça necessário para a instalação dos equipamentos, conforme projeto executivo entregue pela VENDEDORA. Igualmente, o COMPRADOR deverá arcar com quaisquer custos que não estejam abarcados pelo preço deste Contrato, mesmo que sejam necessários à execução do serviço pela VENDEDORA.', { html: true }),
        p('<b>5.5 Providências necessárias.</b> O COMPRADOR se obriga a providenciar, custear e executar, sem atraso, todas as obras civis e elétricas de sua responsabilidade no que dizem respeito à instalação, ao funcionamento, ao acabamento e à decoração externa final dos equipamentos adquiridos, bem como a providenciar os pontos para o içamento, sob pena de adiamento da data de entrega final, sem que isso configure quebra de Contrato.', { html: true }),
        p('<b>5.6 Proibições.</b> É vedado ao COMPRADOR a instalação de equipamentos elétricos e extensões nos pontos de energia destinados à utilização da montagem do(s) equipamento(s) da VENDEDORA que sejam estranhas à instalação dos equipamentos ora adquiridos.', { html: true }),
      ],
    });

    /* 6. GARANTIAS */
    sections.push({
      id: 's6', num: '6', title: 'GARANTIAS',
      body: [
        p('<b>6.1 Prazo de garantia.</b> Os equipamentos da VENDEDORA terão garantia das peças de 90 (noventa) dias a contar da data de assinatura do Termo de Conclusão da Instalação. Esse prazo poderá ser estendido por mais 9 (nove) meses, desde que os equipamentos estejam sob assistência técnica da VENDEDORA ou de empresa por esta homologada.', { html: true }),
        p('<b>6.2 Cobertura da garantia.</b> Durante o prazo de garantia acima estipulado, a VENDEDORA ou empresa por ela autorizada e homologada, realizará o reparo gratuito de defeito de fabricação ou instalação nos equipamentos.', { html: true }),
        p('<b>6.2.1</b> A garantia não abrangerá reparos necessários por: desgastes normais do uso e/ou do tempo; mau uso ou vandalismo de terceiros ou do COMPRADOR; infiltração de água na casa de máquina e/ou no poço; utilização inadequada do equipamento com carga acima da permitida e/ou para fins diferentes do previsto; quedas ou sobrecarga de tensão elétrica e/ou frequência diferindo mais de 5% (cinco por cento) dos valores nominais; falta de energia elétrica; deficiência no sistema de proteção elétrica e para-raios; uso de extintores ou qualquer líquido nos equipamentos; casos fortuitos ou de força maior; deficiências de construção civil ou alterações da estrutura do edifício posteriores à instalação dos equipamentos; incêndio; ou ausência de manutenção ou manutenção inadequada. Caso ocorra alguma das situações acima mencionadas, a garantia será perdida.', { html: true, indent: true }),
        p('<b>6.2.2</b> A garantia também não se estenderá a materiais de concepção frágil, a exemplo de lâmpadas, acabamentos, fusíveis, micros de qualquer natureza, sensores de qualquer natureza.', { html: true, indent: true }),
        p('<b>6.3 Autorização de inspeções.</b> O COMPRADOR autoriza a VENDEDORA a realizar inspeções, dentro do prazo de garantia, com o objetivo de avaliar as condições técnicas e mecânicas dos equipamentos, bem como para verificar se as manutenções preventivas estão sendo realizadas, exceto quando o COMPRADOR realizar as manutenções preventivas com a empresa por ela autorizada e homologada. Fica acordado entre as partes que as inspeções deverão ser agendadas e acompanhadas por um preposto definido pelo COMPRADOR.', { html: true }),
      ],
    });

    /* 7. PENALIDADES */
    sections.push({
      id: 's7', num: '7', title: 'PENALIDADES POR DESCUMPRIMENTO',
      body: [
        p('<b>7.1 Multa por descumprimento do Contrato.</b> Convencionam as partes que, no caso de descumprimento de qualquer cláusula deste Contrato, para a qual não seja prevista multa específica, arcará a parte infratora com multa no valor de 2% (dois por cento) sobre o valor do Contrato.', { html: true }),
        p('<b>7.1.1</b> O pagamento da multa deverá ser realizado de forma integral, à vista, dentro do prazo de 10 (dez) dias a contar da data violação do Contrato, mesmo sem a interposição de medida judicial ou extrajudicial pela parte prejudicada.', { html: true, indent: true }),
        p('<b>7.1.2</b> Se a parte infratora não cumprir com o pagamento da multa estipulada, seja nesta cláusula ou em cláusula específica, de forma que a parte prejudicada precise tomar alguma medida, a parte infratora também deverá arcar com os custos suportados pela parte prejudicada, incluindo emolumentos, taxas, custas processuais e honorários advocatícios em 20% (vinte por cento).', { html: true, indent: true }),
      ],
    });

    /* 8. ENCERRAMENTO */
    sections.push({
      id: 's8', num: '8', title: 'CONDIÇÕES DE ENCERRAMENTO DO CONTRATO',
      body: [
        p('<b>8.1 Encerramento por falta de pagamento.</b> Fica expressamente convencionado que, decorrido 30 (trinta) dias de atraso no pagamento de qualquer quantia integrante do preço ajustado, sem justificativa por parte da COMPRADORA, a VENDEDORA notificará a COMPRADORA por escrito, concedendo-lhe prazo de 5 (cinco) dias úteis para regularizar a obrigação. Não efetuado o pagamento nesse prazo, o presente Contrato estará rescindido de pleno direito, de forma automática e irrevogável, sem necessidade de interpelação judicial ou extrajudicial adicional.', { html: true }),
        p('<b>8.1.1</b> O encerramento do Contrato nessa situação não impedirá que a VENDEDORA utilize de medidas judiciais e extrajudiciais cabíveis, incluindo a retenção e/ou busca e apreensão dos equipamentos já instalados ou a instalar, bem como a retenção de todos os valores já pagos e a busca por indenização em perdas e danos, sem prejuízo da aplicação das demais penalidades previstas neste contrato.', { html: true, indent: true }),
        p('<b>8.2 Encerramento por desistência ou arrependimento do Comprador.</b> Em caso de arrependimento ou desistência deste Contrato pelo COMPRADOR, serão aplicadas as seguintes disposições:', { html: true }),
        p('<b>8.2.1 Desistência do Comprador Antes da Ordem de Fabricação dos Equipamentos:</b> Caso o COMPRADOR desista deste contrato antes do pagamento da entrada/da ordem de fabricação dos equipamentos, o COMPRADOR deverá indenizar a VENDEDORA pelos serviços que já tiverem sido prestados.', { html: true, indent: true }),
        p('<b>8.2.2 Desistência do Comprador Após a Ordem de Fabricação dos Equipamentos:</b> Caso o COMPRADOR desista deste contrato após o pagamento da entrada/da ordem de fabricação dos equipamentos, serão aplicadas as penalidades seguintes:', { html: true, indent: true }),
        p('<b>a) Manutenção do Pagamento Referente à Aquisição dos Equipamentos:</b> Permanecerão devidos à VENDEDORA o valor proporcional a 70% (setenta por cento) do valor total do contrato, que são referentes à fabricação e entrega dos equipamentos fabricados sob medida para o COMPRADOR, que serão entregues ao COMPRADOR pela VENDEDORA, mesmo na hipótese de desistência deste contrato pelo COMPRADOR;', { html: true, indent: true }),
        p('<b>b) Indenização Sobre o Valor Referente aos Serviços de Instalação e Montagem dos Equipamentos:</b> Além da aplicação da alínea “a” deste item, o COMPRADOR deverá pagar à VENDEDORA, a título de indenização, o valor proporcional a 50% (cinquenta por cento) do valor deduzido do percentual previsto na referida alínea.', { html: true, indent: true }),
        p('<b>8.3 Encerramento por descumprimento da VENDEDORA.</b> O COMPRADOR poderá considerar encerrado o presente Contrato, após prévia notificação de 30 (trinta) dias à VENDEDORA, nas seguintes hipóteses:', { html: true }),
        p('<b>i.</b> Se a VENDEDORA paralisar, interromper ou suspender a execução dos serviços contratados sem justificativa respaldada por este Contrato ou pela lei;', { indent: true }),
        p('<b>ii.</b> Se a VENDEDORA, comprovadamente, não realizar os serviços de acordo com este Contrato ou em desacordo com as regras técnicas em vigor.', { indent: true }),
        p('<b>8.4 Encerramento em comum acordo.</b> O presente Contrato poderá ser encerrado em comum acordo, situação em que as partes deverão manifestar à vontade por escrito e estipular a data para o encerramento do Contrato, caso não seja de efeito imediato.', { html: true }),
        p('<b>8.5 Encerramento por condições específicas.</b> O Contrato será considerado encerrado caso qualquer das partes suporte falência, recuperação judicial, dissolução ou encerramento de fato das atividades (apurado pela verificação do fechamento do estabelecimento comercial). Nessas situações, a outra parte poderá requerer qualquer indenização a que tenha direito, nos termos da lei.', { html: true }),
      ],
    });

    /* 9. CASO FORTUITO */
    sections.push({
      id: 's9', num: '9', title: 'CASO FORTUITO E FORÇA MAIOR',
      body: [
        p('<b>9.1 Limitação da responsabilidade.</b> As partes não serão responsáveis por eventual descumprimento deste Contrato em decorrência de situações imprevisíveis, irresistíveis e/ou inevitáveis (“caso fortuito ou de força maior”), as quais, comprovadamente, impeçam a execução do Contrato ou a tornem extremamente onerosa para alguma das partes, nos termos do artigo 393, parágrafo único, do Código Civil Brasileiro.', { html: true }),
        p('<b>9.2 Suspensão do Contrato.</b> Na hipótese de o evento decorrente de caso fortuito ou de força maior impossibilitar a qualquer das partes o cumprimento das obrigações previstas neste Contrato, o instrumento contratual permanecerá em vigor, mantendo-se suspensas as obrigações afetadas, enquanto perdurarem as causas que impedem o seu devido cumprimento.', { html: true }),
        p('<b>9.2.1</b> Caso as partes assim acordem, em vez de prosseguirem com a suspensão do Contrato, poderão optar pelo seu encerramento ou pela renegociação dos seus termos e condições.', { html: true, indent: true }),
        p('<b>9.3 Exceção.</b> As partes expressamente anuem que não serão consideradas hipóteses de caso fortuito ou de força maior as seguintes situações:', { html: true }),
        p('<b>i.</b> Problemas e/ou dificuldades de ordem econômico-financeira de qualquer das partes;', { indent: true }),
        p('<b>ii.</b> Ação de Autoridade Governamental que pudesse ser evitada se a parte responsável tivesse cumprido com as suas obrigações legais;', { indent: true }),
        p('<b>iii.</b> Insolvência, liquidação, falência, reorganização, encerramento, término ou evento semelhante de uma parte ou de terceiros;', { indent: true }),
        p('<b>iv.</b> Perda de mercado;', { indent: true }),
        p('<b>v.</b> Greve e/ou interrupções trabalhistas ou medidas semelhantes, seja de empregados e contratados diretos de uma das partes e/ou de terceirizadas;', { indent: true }),
        p('<b>vi.</b> Condições climáticas adversas que, considerando a história climática local, pudessem ser anteriormente previstas.', { indent: true }),
      ],
    });

    /* 10. DISPOSIÇÕES FINAIS */
    const contatoCompradorNome = c.rep || '(nome completo)';
    const contatoCompradorCargo = c.repCargo || '(descrição)';
    const contatoCompradorEmail = c.email || '(de preferência, ter mais de um contato)';
    const contatosVpHtml = CONTATOS_VP.map((p2) =>
      `Nome: ${p2.nome}<br/>${p2.nome === V.rep ? 'Cargo' : 'Depto.'}: ${p2.cargo}<br/>Tel.: ${p2.tel}<br/>E-mail: ${p2.email}`
    ).join('<br/><br/>');

    sections.push({
      id: 's10', num: '10', title: 'DISPOSIÇÕES FINAIS',
      body: [
        p('<b>10.1 Dados para comunicação.</b> Fica estabelecido que o relacionamento entre as Partes, visando resguardar responsabilidades, será normalmente pela forma escrita (inclusive via e-mail) através de consultas e respostas. As partes deverão utilizar os dados para contato dispostos abaixo a fim de manterem comunicação entre si. É de responsabilidade de cada parte manter os seus dados atualizados e informados à outra parte.', { html: true }),
        p(`<b>Dados do COMPRADOR:</b><br/>Nome: ${esc(contatoCompradorNome)}<br/>Cargo: ${esc(contatoCompradorCargo)}<br/>E-mail: ${esc(contatoCompradorEmail)}`, { html: true, callout: true }),
        p(`<b>Dados da VENDEDORA</b><br/>${contatosVpHtml}`, { html: true, callout: true }),
        p('<b>10.2 Manutenção do direito e novação.</b> A tolerância de qualquer das Partes quanto a qualquer violação a dispositivos deste contrato será sempre entendida como mera liberalidade, não constituindo ou configurando desistência, transigência ou novação, podendo, a qualquer momento, exercer a plenitude de seus direitos.', { html: true }),
        p('<b>10.3 Cessão do Contrato.</b> As Partes não poderão ceder e/ou transferir os direitos e obrigações decorrentes do presente Contrato ou aliená-los, a qualquer título, sem que tenha prévia e expressa anuência por escrito da VENDEDORA e desde que esteja em dia com todas as obrigações assumidas.', { html: true }),
        p('<b>10.4 Responsabilização Perante Terceiros.</b> Cada parte será única e exclusivamente responsável, em qualquer esfera, por quaisquer danos causados pela respectiva parte a terceiros, oriundas da execução das suas atividades, dolosa ou culposamente, ainda que praticados pelos seus auxiliares.', { html: true }),
        p('<b>10.5 Sucessão contratual.</b> O presente Contrato vincula e obriga as partes, bem como os seus respectivos herdeiros ou sucessores, na forma da lei.', { html: true }),
        p('<b>10.6 Vínculos.</b> As Partes reconhecem que não existe entre elas qualquer relação de sociedade, associação, agenciamento ou vínculo trabalhista em decorrência deste Contrato e que nenhuma parte terá qualquer direito, poder ou autoridade de agir ou vincular a outra, de qualquer maneira e a qualquer título, exceto na medida em que esteja expressamente previsto neste instrumento.', { html: true }),
        p('<b>10.7 Validade contratual.</b> Se qualquer disposição do presente contrato for declarada inválida, ilegal ou inexequível de qualquer forma, a validade, legalidade ou exequibilidade das demais disposições não serão afetadas ou prejudicadas de qualquer maneira em virtude do referido fato. As Partes negociarão de boa-fé a substituição das disposições inválidas, ilegais ou inexequíveis por disposições válidas, cujo efeito econômico se aproxime o máximo possível do efeito econômico das disposições invalidadas.', { html: true }),
        p('<b>10.8 Declarações do Comprador Acerca de seus Poderes de Representação:</b> O COMPRADOR, por meio do seu representante legal qualificado neste contrato, declara que o representante legal nomeado possui, na data de assinatura deste contrato, os regulares poderes legais de representação do COMPRADOR, necessários para formalizar e conferir os efeitos jurídicos a este instrumento em nome do COMPRADOR, sob pena da aplicação do disposto no artigo 299 do Decreto-Lei n.º 2.848/40, e a responsabilização pessoal do representante qualificado perante quaisquer prejuízos que a VENDEDORA venha a sofrer em razão da falsidade da presente declaração.', { html: true }),
        p('<b>10.8.1</b> O COMPRADOR não poderá futuramente, questionar a regularidade ou validade deste contrato e dos direitos e obrigações dele decorrentes para qualquer uma das partes, ou sustar quaisquer pagamentos devidos à VENDEDORA em razão da falsidade das declarações prestadas no item 10.8 deste contrato, responsabilizando-se o COMPRADOR e seu representante perante quaisquer prejuízos a VENDEDORA venha a sofrer em razão da falsidade dessas declarações, na forma do parágrafo segundo do artigo 167 da Lei n.º 10.406/2002.', { html: true, indent: true }),
        p('<b>10.9 Título Executivo Extrajudicial:</b> As Partes reconhecem o presente contrato enquanto título executivo extrajudicial, na forma do inciso III do artigo 784 do Código de Processo Civil.', { html: true }),
        p('<b>10.10 Ciência inequívoca.</b> As partes contratantes declaram expressamente que leram e entenderam o conteúdo do presente contrato, ficando vedada qualquer arguição quanto à validade de todas as suas cláusulas e condições aqui ajustadas.', { html: true }),
        p('<b>10.11 Ato Jurídico Perfeito:</b> Este contrato representa um ato jurídico perfeito firmado entre as partes, sem que haja ou tenha havido, nas negociações preliminares, qualquer das hipóteses de anulabilidade ou nulidade do negócio jurídico ora firmado.', { html: true }),
        p('<b>10.12 Foro.</b> Fica eleito o Foro Central (João Mendes) da Comarca de São Paulo, capital do estado de São Paulo, prevalecendo sobre qualquer outro, por mais privilegiado que seja, para dirimir eventuais dúvidas ou controvérsias judiciais ou extrajudiciais oriundas do presente Contrato.', { html: true }),
        p('<b>10.13 Assinatura digital.</b> As Partes desde já estabelecem que o presente contrato ou outros instrumentos necessários à sua continuação poderão ser firmados por meios eletrônicos, digitais e informáticos, com uso de assinatura eletrônica, e que as testemunhas, reconhecem a forma de contratação por meios eletrônicos, digitais e informáticos com válida e plenamente eficaz, constituindo título executivo extrajudicial para todos os fins de direito, ainda que seja estabelecida com assinatura eletrônica ou certificado fora dos padrões ICP – BRASIL, conforme disposto pelo art. 10 da Medida Provisória n. 2.200/2011 em vigor no Brasil.', { html: true }),
        p(`Guarulhos, ${dataBR(new Date())}.`, { center: true, sign: true }),
      ],
    });

    return {
      sections,
      meta: { especial, longa, dist, descEq, numero, valor, compRazao, compRep, compCpf },
      contratante: V,
      comprador: { razao: compRazao, cnpj: compCnpj, endereco: compEnd, rep: compRep, repCpf: compCpf, repCargo: c.repCargo },
      titulo: 'CONTRATO DE COMPRA E VENDA DE EQUIPAMENTOS E PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO',
      numero,
      /* Bloco de assinaturas + testemunhas — renderizado à parte pelo preview,
         não como cláusula numerada (mesma estrutura da minuta oficial). */
      assinatura: {
        vendedora: { nome: V.rep, cpf: V.repCpf },
        comprador: { razaoLabel: compRazao, nome: c.rep || '', cpf: c.repCpf || '' },
      },
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

  /* ISSUE #6: prazo de entrega = D0 + N dias (contrato cita 120 a 150 — usamos
     120, o mínimo contratual, como data prevista de referência). */
  function addDias(dataISO, dias) {
    if (!dataISO) return null;
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  }

  /* ---------- Exporta tudo em window.CV ---------- */
  window.CV = {
    VENDEDORA, EQUIPAMENTOS, CONTATOS_VP,
    onlyDigits, maskCNPJ, maskCPF, maskPhone, maskCEP, maskMoney, parseMoney, brl, dataBR,
    descEquipamento, defaultState,
    buildContract,
    calcularD0, addDias,  // ISSUE #6
  };
}());
