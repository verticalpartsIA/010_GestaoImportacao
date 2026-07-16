/* ============================================================
   contrato-instalador-engine.js
   Template do Contrato de Instalação (terceiros/montadores).
   Adaptado do gerador externo "Contrato de Terceiros_Montagem".
   Exporta window.CI = { ... } pra não colidir com outros módulos.
   Sem React, sem persistência — só lógica do documento.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- CONTRATANTE (fixo) ---------- */
  const CONTRATANTE = {
    razaoSocial: 'VERTICAL PARTS – INDUSTRIA E COMERCIO DE PEÇAS PARA ESCADAS, ESTEIRAS ROLANTES E ELEVADORES LTDA-ME',
    cnpj: '15.822.325/0001-27',
    endereco: 'Rua Armandina Braga de Almeida, 383 – Guarulhos/SP - CEP: 07141-003',
    representante: 'DIEGO YUTAKA MAENO',
    repNacionalidade: 'brasileiro',
    repEstadoCivil: 'casado',
    repProfissao: 'empresário',
    repRG: '23.401.535-4 SSP/SP',
    repCPF: '249.432.208-19',
    cidade: 'Guarulhos',
    estado: 'SP',
  };

  const MODALIDADES = [
    { id: 'instalacao',        label: 'Instalação',          desc: 'Instalação e montagem de equipamento novo.' },
    { id: 'remocao',           label: 'Remoção',             desc: 'Desmontagem e remoção de equipamento existente.' },
    { id: 'remocao_adequacao', label: 'Remoção e Adequação', desc: 'Remoção + adequação para nova instalação (combo).' },
  ];

  const EQUIPAMENTOS = [
    { id: 'elevador', label: 'Elevador',        gen: 'o' },
    { id: 'escada',   label: 'Escada Rolante',  gen: 'a' },
    { id: 'esteira',  label: 'Esteira Rolante', gen: 'a' },
  ];

  const TIPOS_ELEVADOR = [
    { id: 'panoramico', label: 'Panorâmico' },
    { id: 'carga',      label: 'Carga' },
    { id: 'social',     label: 'Social' },
    { id: 'outros',     label: 'Outros' },
  ];

  const PARADAS_OPCOES = ['5', '10', '15', '20', '25+', 'Personalizado'];

  const ANEXOS = [
    { id: 'pgr',   label: 'PGR (Empresa)' },
    { id: 'pcmso', label: 'PCMSO (Empresa)' },
    { id: 'ltcat', label: 'LTCAT' },
    { id: 'ctps',  label: 'CTPS dos funcionários' },
    { id: 'nr01',  label: 'NR-01 — Ordem de serviço' },
    { id: 'nr06',  label: 'NR-06 — EPIs (com CA válido e ficha de entrega assinada)' },
    { id: 'nr10',  label: 'NR-10 — Eletricidade (com CH legal)' },
    { id: 'nr11',  label: 'NR-11 — Movimentação de carga (com CH legal)' },
    { id: 'nr12',  label: 'NR-12 — Máquinas e equipamentos (com CH legal)' },
    { id: 'nr18',  label: 'NR-18 — Construção civil (com CH legal)' },
    { id: 'nr35',  label: 'NR-35 — Trabalho em altura (com CH legal)' },
    { id: 'aso',   label: 'ASO — constando "Apto para Trabalho em Altura" e "Apto para Trabalho com Eletricidade"' },
    { id: 'apr',   label: 'APR — Análise preliminar de risco' },
  ];

  const ORDINAIS = [
    'PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA',
    'DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA',
    'DÉCIMA SÉTIMA','DÉCIMA OITAVA','DÉCIMA NONA','VIGÉSIMA','VIGÉSIMA PRIMEIRA','VIGÉSIMA SEGUNDA',
  ];
  const ORDINAIS_REF = ORDINAIS.map(o => o.charAt(0) + o.slice(1).toLowerCase());
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  /* ---------- "Por extenso" (PT) ---------- */
  const _UNI  = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove'];
  const _DEZ19 = ['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const _DEZ  = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const _CEM  = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

  function _tresDigitos(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const out = [];
    const c = Math.floor(n/100), resto = n%100;
    if (c > 0) out.push(_CEM[c]);
    if (resto > 0) {
      if (resto < 10) out.push(_UNI[resto]);
      else if (resto < 20) out.push(_DEZ19[resto-10]);
      else {
        const d = Math.floor(resto/10), u = resto%10;
        out.push(u === 0 ? _DEZ[d] : _DEZ[d] + ' e ' + _UNI[u]);
      }
    }
    return out.join(' e ');
  }

  function inteiroExtenso(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const grupos = [];
    let temp = n;
    while (temp > 0) { grupos.unshift(temp%1000); temp = Math.floor(temp/1000); }
    const nG = grupos.length;
    const sing = ['','mil','milhão','bilhão','trilhão'];
    const plur = ['','mil','milhões','bilhões','trilhões'];
    const partes = [];
    for (let i = 0; i < nG; i++) {
      const val = grupos[i], ordem = nG-1-i;
      if (val === 0) continue;
      let txt = _tresDigitos(val);
      if (ordem === 1) txt = (val === 1) ? 'mil' : (txt + ' mil');
      else if (ordem >= 2) txt = txt + ' ' + (val === 1 ? sing[ordem] : plur[ordem]);
      partes.push({ txt, val, ordem });
    }
    let result = partes[0].txt;
    for (let k = 1; k < partes.length; k++) {
      const p = partes[k];
      const isLast = (k === partes.length-1);
      if (isLast && (p.val < 100 || (p.val%100 === 0 && p.ordem === 0))) result += ' e ' + p.txt;
      else result += ', ' + p.txt;
    }
    return result;
  }

  function valorExtenso(valor) {
    const v = Number(valor) || 0;
    const reais = Math.floor(v);
    const centavos = Math.round((v-reais)*100);
    let s = '';
    if (reais > 0) s = inteiroExtenso(reais) + (reais === 1 ? ' real' : ' reais');
    if (centavos > 0) s += (reais > 0 ? ' e ' : '') + inteiroExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
    if (reais === 0 && centavos === 0) s = 'zero real';
    return s;
  }

  /* ---------- Máscaras e formatação ---------- */
  function onlyDigits(v) { return (v || '').replace(/\D/g, ''); }
  function maskCNPJ(v) {
    const d = onlyDigits(v).slice(0,14); let r = '';
    for (let i = 0; i < d.length; i++) { if (i===2||i===5) r += '.'; if (i===8) r += '/'; if (i===12) r += '-'; r += d[i]; }
    return r;
  }
  function maskCPF(v) {
    const d = onlyDigits(v).slice(0,11); let r = '';
    for (let i = 0; i < d.length; i++) { if (i===3||i===6) r += '.'; if (i===9) r += '-'; r += d[i]; }
    return r;
  }
  function maskCEP(v) {
    const d = onlyDigits(v).slice(0,8); let r = '';
    for (let i = 0; i < d.length; i++) { if (i===5) r += '-'; r += d[i]; }
    return r;
  }
  function maskRG(v) { return (v || '').replace(/[^0-9A-Za-z./\- ]/g, '').slice(0,24); }
  function maskMoeda(v) {
    const d = onlyDigits(v); if (!d) return '';
    return (parseInt(d,10)/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moedaParaNumero(str) {
    if (str == null || str === '') return 0;
    const d = onlyDigits(String(str));
    return d ? parseInt(d,10)/100 : 0;
  }
  function fmtMoeda(num) { return (Number(num) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function isCNPJValid(v) { return onlyDigits(v).length === 14; }
  function isCPFValid(v) { return onlyDigits(v).length === 11; }
  function isCEPValid(v) { return onlyDigits(v).length === 8; }

  function pad2(n) { return String(n).padStart(2,'0'); }

  function defaultState() {
    const hoje = new Date();
    return {
      modalidade: 'instalacao',
      c_razao:'', c_cnpj:'', c_rua:'', c_numero:'', c_bairro:'', c_cidade:'', c_estado:'', c_cep:'',
      r_nome:'', r_nacionalidade:'brasileiro(a)', r_estadoCivil:'', r_profissao:'',
      r_rg:'', r_cpf:'', r_mesmoEndereco: true,
      r_rua:'', r_numero:'', r_bairro:'', r_cidade:'', r_estado:'', r_cep:'',
      equipamento: 'elevador', quantidade: 1, localServico:'', descricaoServicos:'',
      tipoElevador: 'social', capacidadeCarga:'', cargaEspecial: false,
      paradas: '5', paradasCustom:'', destino:'',
      obraCidade:'', obraEstado:'', distancia:'',
      logResponsavel:'contratada', logModo:'despesas', logDiasExtra:'',
      valorTotal:'', formaPagamento:'2', parcelas:[],
      banco:'', agencia:'', conta:'', pix:'',
      anexos: ANEXOS.reduce((a,x) => (a[x.id]=false, a), {}),
      garantia_meses: '6',
      prazo_execucao: '',
      juros_atraso_pct: '1',
      cidadeAssinatura: 'Guarulhos',
      dataDia: pad2(hoje.getDate()),
      dataMes: MESES[hoje.getMonth()],
      dataAno: String(hoje.getFullYear()),
    };
  }

  /* ---------- Regras condicionais ---------- */
  function isCargaEspecial(s) {
    const cap = parseFloat(String(s.capacidadeCarga).replace(',','.')) || 0;
    return s.equipamento === 'elevador' && (s.cargaEspecial || cap > 1000);
  }
  function isLongaDistancia(s) {
    const km = parseFloat(String(s.distancia).replace(',','.')) || 0;
    return km >= 100;
  }
  function isRemocao(s) { return s.modalidade === 'remocao' || s.modalidade === 'remocao_adequacao'; }

  function activeConditionals(s) {
    const list = [];
    if (isRemocao(s))        list.push({ id:'remocao',    label:'Objeto adaptado p/ remoção',          tone:'info' });
    if (isCargaEspecial(s))  list.push({ id:'especial',   label:'Cláusula de Equipamento Especial',    tone:'warn' });
    if (isLongaDistancia(s)) list.push({ id:'distancia',  label:'Cláusula de Logística (≥ 100 km)',    tone:'warn' });
    return list;
  }

  /* ---------- Builder do documento ---------- */
  function vBlank(v, ph) { return (v && String(v).trim()) ? String(v).trim() : ph; }

  function buildEnderecoContratada(s) {
    return [
      'Rua ' + vBlank(s.c_rua, 'XXX'),
      'nº ' + vBlank(s.c_numero, 'XXX'),
      vBlank(s.c_bairro, 'bairro'),
      vBlank(s.c_cidade, 'cidade') + '/' + vBlank(s.c_estado, 'UF'),
      'CEP ' + vBlank(s.c_cep, 'XX.XXX-XX'),
    ].join(', ');
  }
  function buildEnderecoResponsavel(s) {
    if (s.r_mesmoEndereco) return buildEnderecoContratada(s);
    return [
      'Rua ' + vBlank(s.r_rua, 'XXX'),
      'nº ' + vBlank(s.r_numero, 'XXX'),
      vBlank(s.r_bairro, 'bairro'),
      vBlank(s.r_cidade, 'cidade') + '/' + vBlank(s.r_estado, 'UF'),
      'CEP ' + vBlank(s.r_cep, 'XX.XXX-XXX'),
    ].join(', ');
  }

  function contractTitle(s) {
    const eq = EQUIPAMENTOS.find(e => e.id === s.equipamento) || EQUIPAMENTOS[0];
    let acao;
    if (s.modalidade === 'instalacao') acao = 'INSTALAÇÃO';
    else if (s.modalidade === 'remocao') acao = 'REMOÇÃO';
    else acao = 'REMOÇÃO E ADEQUAÇÃO';
    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ${acao} DE ${eq.label.toUpperCase()}`;
  }

  function objetoFrase(s) {
    if (s.modalidade === 'instalacao') return 'prestação de serviços profissionais especializados nas instalações e montagens';
    if (s.modalidade === 'remocao')    return 'prestação de serviços profissionais especializados na desmontagem e remoção';
    return 'prestação de serviços profissionais especializados na desmontagem, remoção e adequação para nova instalação';
  }
  function verboModalidade(s) {
    if (s.modalidade === 'instalacao') return 'instalação';
    if (s.modalidade === 'remocao')    return 'remoção';
    return 'remoção e adequação';
  }

  function escopoFrase(s) {
    const eq = EQUIPAMENTOS.find(e => e.id === s.equipamento) || EQUIPAMENTOS[0];
    const qtd = parseInt(s.quantidade, 10) || 1;
    const qtdExt = inteiroExtenso(qtd);
    if (s.equipamento === 'elevador') {
      const tipo = (TIPOS_ELEVADOR.find(t => t.id === s.tipoElevador) || {}).label || '';
      const equipDesc = `Elevador${qtd > 1 ? 'es' : ''} do tipo ${tipo}`;
      const paradas = s.paradas === 'Personalizado' ? vBlank(s.paradasCustom, 'XX') : s.paradas;
      let frase = `Faz parte do escopo desse serviço a ${verboModalidade(s)} de ${qtd} (${qtdExt}) ${equipDesc} da Marca Vertical Parts, com ${paradas} paradas`;
      if (s.capacidadeCarga) frase += `, capacidade de carga de ${s.capacidadeCarga} kg`;
      frase += '.';
      return frase;
    }
    return `Faz parte do escopo desse serviço a ${verboModalidade(s)} de ${qtd} (${qtdExt}) ${eq.label} da Marca Vertical Parts.`;
  }

  function buildPagamentoItems(s) {
    const valor = moedaParaNumero(s.valorTotal);
    const valorFmt = valor ? 'R$ ' + fmtMoeda(valor) : 'R$ XX.XXX,XX';
    const valorExt = valor ? ' (' + valorExtenso(valor) + ')' : ' (valor por extenso)';
    const items = [];
    if (s.formaPagamento === '2') {
      const metade = valor ? valor/2 : 0;
      const mFmt = metade ? 'R$ ' + fmtMoeda(metade) : 'R$ XX.XXX,XX';
      const mExt = metade ? ' (' + valorExtenso(metade) + ')' : ' (valor por extenso)';
      items.push({ n:'5.1', text:`Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de ${valorFmt}${valorExt}, a ser pago em 2 (duas) parcelas via depósito em conta bancária, da seguinte forma:` });
      items.push({ n:'5.1.1', text:`${mFmt}${mExt} na data de início dos trabalhos;` });
      items.push({ n:'5.1.2', text:`${mFmt}${mExt} após a finalização do serviço, com o equipamento apto ao pleno funcionamento e mediante nota fiscal de serviço.` });
    } else if (s.formaPagamento === '3') {
      const terco = valor ? valor/3 : 0;
      const tFmt = terco ? 'R$ ' + fmtMoeda(terco) : 'R$ XX.XXX,XX';
      const tExt = terco ? ' (' + valorExtenso(terco) + ')' : ' (valor por extenso)';
      items.push({ n:'5.1', text:`Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de ${valorFmt}${valorExt}, a ser pago em 3 (três) parcelas via depósito em conta bancária, da seguinte forma:` });
      items.push({ n:'5.1.1', text:`${tFmt}${tExt} na data de início dos trabalhos;` });
      items.push({ n:'5.1.2', text:`${tFmt}${tExt} na metade da execução dos serviços;` });
      items.push({ n:'5.1.3', text:`${tFmt}${tExt} após a finalização do serviço, mediante nota fiscal de serviço.` });
    } else {
      items.push({ n:'5.1', text:`Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de ${valorFmt}${valorExt}, a ser pago via depósito em conta bancária, da seguinte forma:` });
      const parc = (s.parcelas && s.parcelas.length) ? s.parcelas : [];
      if (parc.length === 0) {
        items.push({ n:'5.1.1', text:'(defina as parcelas personalizadas — valor, data e descrição)' });
      } else {
        parc.forEach((p, i) => {
          const pv = moedaParaNumero(p.valor);
          const pf = pv ? 'R$ ' + fmtMoeda(pv) : 'R$ XX.XXX,XX';
          const pe = pv ? ' (' + valorExtenso(pv) + ')' : '';
          const quando = p.descricao && p.descricao.trim() ? p.descricao.trim() : (p.data ? 'em ' + p.data : '');
          items.push({ n:'5.1.'+(i+1), text:`${pf}${pe}${quando ? ' — ' + quando : ''};` });
        });
      }
    }
    const banco = vBlank(s.banco, '____');
    const ag    = vBlank(s.agencia, '____');
    const conta = vBlank(s.conta, '____');
    const pix   = vBlank(s.pix, '____');
    items.push({ n:'BANK', text:'Dados bancários da CONTRATADA:', bank:{ banco, ag, conta, pix } });
    /* C8 — Juros por atraso de pagamento (equilíbrio contratual) */
    const jurosStr = (s.juros_atraso_pct && String(s.juros_atraso_pct).trim()) ? String(s.juros_atraso_pct).trim() : '{{juros_atraso_pct}}';
    items.push({ n:'5.2', text:`O atraso no pagamento de qualquer parcela por parte da CONTRATANTE sujeitará o valor em mora a juros de mora de ${jurosStr}% ao mês, acrescidos de correção monetária pelo IPCA, sem prejuízo do direito de rescisão previsto neste instrumento.` });
    /* C9 — Condição precedente (Anexo I como pré-requisito para início e 1ª parcela) */
    items.push({ n:'5.3', text:'O início dos serviços e o pagamento da primeira parcela (item 5.1.1) ficam condicionados à entrega e aprovação prévia, pela CONTRATANTE, de toda a documentação constante do ANEXO I — Requisitos de Homologação, SST, NRs e Documentação. A ausência ou irregularidade de qualquer item do ANEXO I suspende o acesso da CONTRATADA à obra e retém o pagamento correspondente até a devida regularização, sem prejuízo das demais sanções previstas neste contrato.' });
    return items;
  }

  /* Monta o documento completo. Recebe o estado do form + o numero_documento já gerado.
     Retorna { titulo, numero, partes, intro, clauses[], encerramento, local, signatures } */
  function buildContract(s, numeroDoc) {
    const numero = numeroDoc || 'VPNI________';
    const clauses = [];

    /* OBJETO */
    const objetoItems = [
      { n:'1.',  text:`O objeto do presente contrato consiste na ${objetoFrase(s)}, referente aos equipamentos e condições a seguir:` },
      { n:'1.1', text: escopoFrase(s) },
    ];
    if (s.descricaoServicos && s.descricaoServicos.trim()) objetoItems.push({ n:'1.2', text:'Descrição dos serviços: ' + s.descricaoServicos.trim() });
    else objetoItems.push({ n:'1.2', text:'Descrição dos serviços: (detalhar os serviços a executar)' });
    objetoItems.push({ n:'1.3', text:'Local do serviço: ' + vBlank(s.localServico, '(endereço completo de onde será realizado o serviço)') });
    if (isRemocao(s)) {
      const lbl = s.modalidade === 'remocao_adequacao' ? 'Local da nova instalação' : 'Destino do equipamento removido';
      objetoItems.push({ n:'1.4', text:`${lbl}: ` + vBlank(s.destino, '(informar o destino / local)') });
    }
    /* C6 — Prazo de execução */
    const prazoN = isRemocao(s) ? '1.5' : '1.4';
    const prazoVal = s.prazo_execucao && String(s.prazo_execucao).trim();
    objetoItems.push({ n: prazoN, text: 'Prazo de execução: ' + (prazoVal ? prazoVal + ' (' + inteiroExtenso(parseInt(prazoVal, 10) || 0) + ') dias corridos a contar da data de início dos serviços, ou conforme cronograma acordado entre as partes em anexo.' : '(preencher o prazo — dias corridos ou indicar cronograma em anexo).') });
    clauses.push({ id:'objeto', titulo:'DO OBJETO', items:objetoItems });

    /* EQUIPAMENTO ESPECIAL (condicional) */
    if (isCargaEspecial(s)) {
      const cap = s.capacidadeCarga ? `${s.capacidadeCarga} kg` : 'superior a 1.000 kg';
      clauses.push({
        id:'especial', titulo:'DO EQUIPAMENTO ESPECIAL', conditional:true,
        items: [
          { n:'EE.1', text:`Tendo em vista que o equipamento objeto deste contrato possui capacidade de carga ${cap}, caracterizando equipamento especial, a CONTRATADA deverá observar reforço integral às normas de segurança aplicáveis, em especial a NR-12 (Máquinas e Equipamentos) e a NR-18 (Construção), com planejamento específico de içamento e movimentação de cargas.` },
          { n:'EE.2', text:'A CONTRATADA deverá apresentar, previamente ao início dos trabalhos, plano de rigging/içamento, com a indicação dos equipamentos de elevação (guindaste, talhas, etc.), pontos de ancoragem e Análise Preliminar de Risco (APR) específica para a operação de carga especial.' },
          { n:'EE.3', text:'Toda a logística de içamento, isolamento de área e sinalização correrá por conta da CONTRATADA, que responderá integralmente por eventuais danos decorrentes da movimentação do equipamento.' },
        ],
      });
    }

    /* GARANTIA DA MONTAGEM — C3 (só Instalação e Remoção+Adequação) */
    if (s.modalidade !== 'remocao') {
      const gMeses = (s.garantia_meses && String(s.garantia_meses).trim()) ? String(s.garantia_meses).trim() : '{{garantia_meses}}';
      const gExt = /^\d+$/.test(gMeses) ? inteiroExtenso(parseInt(gMeses, 10)) : gMeses;
      clauses.push({
        id: 'garantia',
        titulo: 'DA GARANTIA DA MONTAGEM',
        items: [
          { n:'GM.1', text:`A CONTRATADA garante a montagem e os serviços executados contra vícios de execução pelo prazo de ${gMeses} (${gExt}) meses, a contar da data do aceite formal pela CONTRATANTE, obrigando-se a corrigir ou refazer, sem ônus adicionais, os serviços que apresentarem defeitos comprovadamente decorrentes de falha de execução.` },
        ],
      });
    }

    /* SEGURO — C4 (todas as modalidades) */
    clauses.push({
      id: 'seguro',
      titulo: 'DO SEGURO',
      items: [
        { n:'SG.1', text:'A CONTRATADA deverá manter, durante toda a vigência deste contrato, Seguro de Responsabilidade Civil Geral e Seguro de Acidentes Pessoais em favor de todos os integrantes de sua equipe alocados na execução dos serviços.' },
        { n:'SG.2', text:'Comprovante válido das apólices acima referidas deverá ser entregue à CONTRATANTE antes do início dos serviços, sob pena de impedimento do acesso à obra.' },
      ],
    });

    /* ART/TRT DE INSTALAÇÃO — C5 (só Instalação e Remoção+Adequação) */
    if (s.modalidade !== 'remocao') {
      clauses.push({
        id: 'art_trt',
        titulo: 'DA ART/TRT DE INSTALAÇÃO',
        items: [
          { n:'AT.1', text:'A CONTRATADA é obrigada a emitir e entregar à CONTRATANTE a Anotação de Responsabilidade Técnica (ART) ou o Termo de Responsabilidade Técnica (TRT) referente à instalação objeto deste contrato, antes do início dos serviços.' },
          { n:'AT.2', text:'A ausência da ART/TRT no prazo indicado constitui motivo de impedimento do início da obra e poderá ensejar rescisão contratual, sem prejuízo das penalidades previstas neste instrumento.' },
        ],
      });
    }

    /* OBRIGAÇÕES DA CONTRATADA */
    clauses.push({
      id:'obrig_contratada', titulo:'DA OBRIGAÇÃO DO CONTRATADO',
      items: [
        { n:'2.1', text:'Fica responsável a CONTRATADA por todos os serviços que lhe forem apontados, durante o tempo necessário para ' + (isRemocao(s) ? 'remoção' : 'instalação') + ' e finalização do mesmo, conforme especificado no item 1.1.' },
        { n:'2.2', text:'A CONTRATADA deverá seguir as normas estabelecidas pela CONTRATANTE, como horário de funcionamento do local onde serão executados os serviços e quanto às regras de utilização de ferramentas, como a obrigatoriedade do uso de Equipamentos de Proteção Individual (EPIs).' },
        { n:'2.3', text:'A fiscalização será exercida por pessoas expressamente designadas pela CONTRATANTE, as quais serão investidas de plenos poderes para: solicitar da CONTRATADA substituição, no prazo máximo de 24 (vinte e quatro) horas, de qualquer profissional ou operário que embarace o seu trabalho de fiscalizar; rejeitar serviços defeituosos ou materiais que não satisfaçam às exigências ora contratadas, obrigando-se a CONTRATADA a refazer os serviços comprovadamente defeituosos, sem ônus para a CONTRATANTE; quando a causa do defeito não for imputável à CONTRATADA, as partes poderão acordar, por escrito, a reprogramação proporcional do prazo de execução.' },
        { n:'2.4', text:'A CONTRATADA deverá manter no local de ' + (isRemocao(s) ? 'execução' : 'instalação') + ' um Diário de Obra para anotação do andamento da execução dos serviços e de todos os eventos que possam implicar em alterações técnicas e prazos.' },
        { n:'2.5', text:'A CONTRATADA deverá manter os locais de trabalho o mais limpo possível, removendo todos os materiais, equipamentos, sobras e instalações provisórias de modo a deixar os ambientes limpos antes do início dos testes finais.' },
        { n:'2.6', text:'A CONTRATADA não deverá ' + (isRemocao(s) ? 'remover os equipamentos' : 'instalar os equipamentos na obra') + ' sem prévia fiscalização da CONTRATANTE.' },
        { n:'2.7', text:'A CONTRATADA fornecerá todo o ferramental para a execução do serviço, mão de obra e supervisão necessária às operações, bem como contratação de andaimes, auxiliares, etc.' },
        { n:'2.8', text:'A CONTRATADA se compromete a manter, durante toda a execução do Contrato, a fim de cumprir com as obrigações por ele assumidas, todas as condições de habilitação e qualificação exigidas por Lei e respectivas normas técnicas, para garantia e segurança da qualidade dos serviços.' },
        { n:'2.9', text:'A CONTRATADA se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, informações e documentos da CONTRATANTE, mesmo após a conclusão dos serviços ou do término da relação contratual, não podendo utilizar e/ou resguardar quaisquer informações recebidas, sob pena de responsabilizar-se por perdas e danos.' },
        { n:'2.10', text:'Os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados, pela CONTRATADA, estritamente para cumprimento dos serviços solicitados pela CONTRATANTE, sendo VEDADA a comercialização ou utilização para outros fins.' },
        { n:'2.11', text:'Garantir a execução deste contrato por sua equipe de profissionais, sendo permitida a subcontratação por parte da CONTRATADA, sob sua exclusiva responsabilidade.' },
        { n:'2.12', text:'Executar os serviços contratados através da fixação de parâmetros técnicos e a tempo certo, obedecendo ao cronograma e prazos estipulados entre as partes.' },
        { n:'2.13', text:'É obrigação da CONTRATADA entregar à CONTRATANTE cópia dos documentos, certificados e treinamentos exigidos pelas normas de Segurança do Trabalho, todos com validade legal e carga horária legalmente cumprida, conforme detalhado no ANEXO I — parte integrante e indissociável deste contrato. O ASO de cada trabalhador deverá constar expressamente "Apto para Trabalho em Altura" e "Apto para Trabalho com Eletricidade". A relação mínima de documentos exigidos é:', list: ANEXOS.map(a => a.label) },
      ],
    });

    /* OBRIGAÇÕES DA CONTRATANTE */
    clauses.push({
      id:'obrig_contratante', titulo:'DAS OBRIGAÇÕES DA CONTRATANTE',
      items: [
        { n:'3.1', text:'Prestar as informações e os esclarecimentos que venham a ser solicitados pela CONTRATADA, desde que necessários para a prestação dos serviços ora contratados.' },
        { n:'3.2', text:'A CONTRATANTE se responsabiliza a prestar todo apoio técnico necessário para que a CONTRATADA realize os serviços acordados neste instrumento.' },
        { n:'3.3', text:'Realizar os pagamentos dentro do prazo, conforme disposto na Cláusula __PAGAMENTO__.', ref:'pagamento' },
      ],
    });

    /* RESPONSABILIDADE DA CONTRATADA */
    clauses.push({
      id:'resp_contratada', titulo:'DA RESPONSABILIDADE DA CONTRATADA',
      items: [
        { n:'4.1', text:'A CONTRATADA responderá pelos encargos trabalhistas, fiscais, comerciais e previdenciários resultantes da execução deste contrato, não transferindo à CONTRATANTE, em caso de inadimplência da CONTRATADA com referência a esses encargos, a responsabilidade por seu pagamento, nem podendo onerar o objeto deste contrato.' },
        { n:'4.2', text:'Caberão à CONTRATADA os prejuízos causados à CONTRATANTE ou a terceiros, por atos de sua responsabilidade e decorrentes da execução dos serviços estipulados neste contrato, por culpa ou dolo, excluídos os casos em que a CONTRATANTE der causa, seja por sua ação ou omissão.' },
      ],
    });

    /* PAGAMENTO */
    clauses.push({ id:'pagamento', titulo:'DO PAGAMENTO', items: buildPagamentoItems(s) });

    /* LOGÍSTICA (condicional) */
    if (isLongaDistancia(s)) {
      const km = s.distancia;
      const resp = s.logResponsavel === 'contratante' ? 'CONTRATANTE' : 'CONTRATADA';
      const local = vBlank(s.obraCidade, 'cidade da obra') + '/' + vBlank(s.obraEstado, 'UF');
      const items = [
        { n:'LG.1', text:`Considerando que o local de execução dos serviços (${local}) situa-se a aproximadamente ${km} km da sede da CONTRATANTE em Guarulhos/SP, distância igual ou superior a 100 (cem) quilômetros, aplica-se a presente cláusula de logística e deslocamento.` },
      ];
      if (s.logModo === 'prazo') {
        const dias = vBlank(s.logDiasExtra, 'X');
        items.push({ n:'LG.2', text:`Em razão do deslocamento, o prazo de execução dos serviços será estendido em ${dias} (${typeof dias === 'string' && /^\d+$/.test(dias) ? inteiroExtenso(parseInt(dias,10)) : '...'}) dias, sem ônus adicional para qualquer das partes a esse título.` });
      } else {
        items.push({ n:'LG.2', text:`As despesas de transporte, hospedagem e alimentação da equipe correrão por conta da ${resp}, sendo cobradas à parte e mediante comprovação, não estando incluídas no valor descrito na Cláusula de Pagamento.` });
      }
      items.push({ n:'LG.3', text:'As partes poderão, de comum acordo e por termo aditivo, ajustar a forma de rateio das despesas de deslocamento, observada a boa-fé contratual.' });
      clauses.push({ id:'logistica', titulo:'DA LOGÍSTICA E DESLOCAMENTO', conditional:true, items });
    }

    /* CESSÃO */
    clauses.push({ id:'cessao', titulo:'DA CESSÃO OU TRANSFERÊNCIA', items:[
      { n:'6.1', text:'O contrato não poderá ser objeto de cessão ou transferência, no todo ou em parte, a não ser com prévio e expresso consentimento da CONTRATANTE, sob pena de imediata rescisão do mesmo.' },
    ]});

    /* RESCISÃO */
    clauses.push({ id:'rescisao', titulo:'DA RESCISÃO', items:[
      { n:'7.1', text:'Constituem motivos para a rescisão deste contrato:', list:[
        'não cumprimento de cláusulas, especificações e prazos;',
        'atraso ou paralisação injustificada e/ou sem comunicação à CONTRATANTE na execução dos serviços;',
        'desatendimento às determinações da fiscalização da CONTRATANTE;',
        'alteração social ou modificação da finalidade ou estrutura da CONTRATADA que impossibilite ou venha prejudicar a execução do Contrato;',
        'falta de entrega ou irregularidade na documentação exigida pelo ANEXO I deste contrato, após notificação e prazo de regularização de 48 (quarenta e oito) horas;',
        'atraso no pagamento dos serviços superior a 30 (trinta) dias, conforme disposto na Cláusula __PAGAMENTO__.',
      ], listType:'alpha', refInList:'pagamento' },
      { n:'7.2', text:'A rescisão do Contrato poderá ser:', list:[
        'determinada por ato unilateral e escrito da CONTRATANTE, caso a CONTRATADA descumpra quaisquer cláusulas ou condições ora pactuadas;',
        'amigável, por acordo entre as partes, reduzido a termo, desde que haja conveniência para a CONTRATANTE;',
        'judicial, nos termos da legislação.',
      ], listType:'alpha' },
    ]});

    /* VIGÊNCIA */
    clauses.push({ id:'vigencia', titulo:'DA VIGÊNCIA', items:[
      { n:'8.1', text:'Para efeito deste contrato, a vigência terá seu início na data de assinatura deste instrumento e se findará automaticamente com a finalização dos serviços ora contratados.' },
      { n:'8.2', text:'Este contrato é válido até o término do serviço objeto deste contrato, vide Cláusula __OBJETO__, não ficando as partes isentas de seus compromissos éticos após a invalidação do mesmo, podendo ser prorrogado e/ou alterado por acordo entre as partes, mediante termo aditivo.', ref:'objeto' },
    ]});

    /* PENALIDADES */
    clauses.push({ id:'penalidades', titulo:'DAS PENALIDADES', items:[
      { n:'9.1', text:'Em caso de rescisão sem justo motivo por uma das partes antes do prazo final do contrato, ou de qualquer uma das ocorrências previstas na Cláusula __RESCISAO__ deste instrumento, este Contrato será rescindido automaticamente e caberá à parte infratora multa equivalente a 20% (vinte por cento) sobre o total do contrato, a ser paga em até 5 (cinco) dias corridos da rescisão.', ref:'rescisao' },
    ]});

    /* TOLERÂNCIA */
    clauses.push({ id:'tolerancia', titulo:'DA TOLERÂNCIA', items:[
      { n:'10.1', text:'A eventual tolerância, pela CONTRATANTE, com relação ao descumprimento de qualquer termo ou condição aqui ajustado, não será considerada como desistência em exigir o cumprimento de disposição nele contida, nem representará novação com relação à obrigação passada, presente ou futura, no tocante ao termo ou condição cujo descumprimento foi tolerado.' },
    ]});

    /* DISPOSIÇÕES GERAIS */
    clauses.push({ id:'disposicoes', titulo:'DAS DISPOSIÇÕES GERAIS', items:[
      { n:'11.1', text:'Este é um contrato típico de prestação de serviços, conforme nomeado pelo Código Civil, e no caso de qualquer omissão deste contrato serão aplicáveis as regras previstas na Legislação.' },
      { n:'11.2', text:'A execução deste contrato será acompanhada e fiscalizada por empregado da CONTRATANTE, o qual será também responsável pelo recebimento dos serviços, avaliação e aceite.' },
      { n:'11.3', text:'A CONTRATANTE não será responsável por eventual prejuízo sofrido e/ou causado pelos profissionais da CONTRATADA em decorrência deste contrato, bem como não terá qualquer responsabilidade por eventuais danos e/ou encargos fiscais, trabalhistas, civis, securitários e/ou sociais relacionados com a execução do objeto contratual pela CONTRATADA.' },
      { n:'11.4', text:'Em que pese as previsões acima elencadas, compete frisar que a CONTRATADA não manterá qualquer vínculo de emprego com a CONTRATANTE, diante da ausência de exclusividade na prestação de serviços, bem como inexistente qualquer subordinação relativa a horário e ingerência quanto à expertise de atuação da pessoa jurídica contratada. A CONTRATADA será inteiramente responsável pelos profissionais que vier a contratar, ainda que para fins de cumprimento do presente contrato, não se estabelecendo nenhum vínculo empregatício entre estes e a CONTRATANTE.' },
    ]});

    /* FORO */
    clauses.push({ id:'foro', titulo:'DO FORO', items:[
      { n:'12.1', text:'As partes convencionam que o Foro para dirimir quaisquer dúvidas ou questões oriundas do presente contrato é o Foro da Comarca de Guarulhos, São Paulo, com exclusão de qualquer outro, por mais privilegiado que seja.' },
    ]});

    /* ANEXO I — REQUISITOS DE HOMOLOGAÇÃO, SST, NRs E DOCUMENTAÇÃO */
    clauses.push({
      id: 'anexo_i',
      titulo: 'ANEXO I — REQUISITOS DE HOMOLOGAÇÃO, SST, NRs E DOCUMENTAÇÃO',
      items: [
        { n:'AI.0', text:'Este Anexo é parte integrante e indissociável deste contrato. A CONTRATADA obriga-se a entregar e manter válidos todos os itens abaixo antes do início dos serviços. A não entrega ou irregularidade de qualquer item impede o início da obra, suspende pagamentos e constitui causa de rescisão, conforme Cláusula __RESCISAO__.', ref:'rescisao' },
        { n:'AI.1', text:'REGRA 1 — EPIs E FERRAMENTAL: Ficha de Entrega de EPI assinada pelo trabalhador e CA (Certificado de Aprovação) válido para cada EPI. Itens mínimos exigidos: cinto paraquedista (talabarte duplo), linha de vida, trava-quedas e cordas para trabalho em altura; capacete com jugular, óculos de proteção (incolor e escuro), protetor auricular e luvas (pigmentada, raspa e/ou vaqueta); calçado com biqueira de aço; uniforme identificado; ferramentas com duplo isolamento elétrico.' },
        { n:'AI.2', text:'REGRA 2 — NRs E TREINAMENTOS: Certificados válidos com carga horária legalmente exigida para todos os trabalhadores alocados: NR-10 (Eletricidade), NR-35 (Trabalho em Altura), NR-18 (Construção Civil), NR-11 (Movimentação de Carga Pesada), NR-12 (Máquinas e Equipamentos), NR-06 (Uso de EPI).' },
        { n:'AI.3', text:'REGRA 3 — SAÚDE E SEGURANÇA OCUPACIONAL (SST): ASO — Atestado de Saúde Ocupacional ativo, constando expressamente "Apto para Trabalho em Altura" e "Apto para Trabalho com Eletricidade"; PCMSO — Programa de Controle Médico de Saúde Ocupacional; PGR — Programa de Gerenciamento de Riscos; LTCAT — Laudo Técnico das Condições Ambientais do Trabalho.' },
        { n:'AI.4', text:'REGRA 4 — DOCUMENTAÇÃO DA EMPRESA (PJ): Cartão CNPJ; Contrato Social ou CCMEI; RG/CNH e Comprovante de Residência dos sócios; CNDs (Federal/Receita Federal, Estadual e Municipal) e CRF — Certificado de Regularidade do FGTS; Qualificação Técnica: comprovação de experiência na atividade e ART/TRT da instalação conforme cláusula específica deste contrato.' },
        { n:'AI.5', text:'REGRA 5 — DOCUMENTAÇÃO DE AJUDANTES E FUNCIONÁRIOS (risco trabalhista): Para cada trabalhador alocado à obra: RG/CNH, Comprovante de Residência e Termo de Responsabilidade Civil, Criminal e Trabalhista assinado pelo prestador principal. Se vínculo CLT: Ficha de Registro (FRE) assinada, cópia da CTPS e comprovantes mensais de recolhimento de FGTS e INSS (GFIP/SEFIP). Se terceirizado PJ: CNPJ próprio, Contrato de Prestação de Serviços entre as partes e todos os documentos de SST, NRs e EPIs desta Regra 2.' },
      ],
    });

    /* Resolve referências cruzadas */
    const ordById = {};
    clauses.forEach((c, i) => { ordById[c.id] = ORDINAIS_REF[i] || ('#'+(i+1)); c.ord = ORDINAIS[i] || ('#'+(i+1)); });
    clauses.forEach(c => c.items.forEach(it => {
      if (it.ref) it.text = it.text.replace(`__${it.ref.toUpperCase()}__`, ordById[it.ref] || '____');
      if (it.refInList && it.list) it.list = it.list.map(li => li.replace(`__${it.refInList.toUpperCase()}__`, ordById[it.refInList] || '____'));
      it.text = it.text.replace(/__([A-Z_]+)__/g, (m, k) => ordById[k.toLowerCase()] || m);
    }));

    return {
      titulo: contractTitle(s),
      numero,
      contratante: CONTRATANTE,
      contratada: {
        razao: vBlank(s.c_razao, 'RAZÃO SOCIAL'),
        cnpj: vBlank(s.c_cnpj, 'XX.XXX.XXX/XXXX-XX'),
        endereco: buildEnderecoContratada(s),
        responsavel: vBlank(s.r_nome, 'NOME DO RESPONSÁVEL'),
        nacionalidade: vBlank(s.r_nacionalidade, 'nacionalidade'),
        estadoCivil: vBlank(s.r_estadoCivil, 'estado civil'),
        profissao: vBlank(s.r_profissao, 'profissão'),
        rg: vBlank(s.r_rg, 'XXX'),
        cpf: vBlank(s.r_cpf, 'XXX'),
        enderecoResp: buildEnderecoResponsavel(s),
      },
      clauses,
      cidadeAssinatura: vBlank(s.cidadeAssinatura, 'Guarulhos'),
      dataDia: vBlank(s.dataDia, 'XX'),
      dataMes: vBlank(s.dataMes, '(mês)'),
      dataAno: vBlank(s.dataAno, '2026'),
    };
  }

  /* ---------- Exporta tudo em window.CI ---------- */
  window.CI = {
    CONTRATANTE, MODALIDADES, EQUIPAMENTOS, TIPOS_ELEVADOR, PARADAS_OPCOES, ANEXOS,
    ORDINAIS, ORDINAIS_REF, MESES,
    inteiroExtenso, valorExtenso,
    onlyDigits, maskCNPJ, maskCPF, maskCEP, maskRG, maskMoeda, moedaParaNumero, fmtMoeda,
    isCNPJValid, isCPFValid, isCEPValid,
    defaultState, pad2,
    isCargaEspecial, isLongaDistancia, isRemocao, activeConditionals,
    buildContract,
  };
}());
