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
    { id: 'elevador', label: 'Elevador',        plural: 'Elevadores',       gen: 'o' },
    { id: 'escada',   label: 'Escada Rolante',  plural: 'Escadas Rolantes', gen: 'a' },
    { id: 'esteira',  label: 'Esteira Rolante', plural: 'Esteiras Rolantes', gen: 'a' },
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
    { id: 'ctps',  label: 'CTPS dos funcionários' },
    { id: 'nr01',  label: 'NR-01 — Ordem de serviço' },
    { id: 'nr06',  label: 'NR-06 — EPIs' },
    { id: 'nr12',  label: 'NR-12 — Máquinas e equipamentos' },
    { id: 'nr18',  label: 'NR-18 — Construção' },
    { id: 'nr35',  label: 'NR-35 — Trabalho em altura' },
    { id: 'aso',   label: 'ASO — Atestado de saúde ocupacional' },
    { id: 'apr',   label: 'APR — Análise preliminar de risco' },
  ];

  const ORDINAIS = [
    'PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA',
    'DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA',
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

  /* Divide `valor` (R$) em n parcelas, em centavos inteiros — a diferença de
     arredondamento vai pra ÚLTIMA parcela, então a soma bate exatamente com
     o total (antes: 100,00/3 virava 3×33,33 = 99,99 e 100,01/2 virava
     2×50,01 = 100,02). */
  function dividirEmParcelas(valor, n) {
    const total = Math.round((Number(valor) || 0) * 100);
    const base = Math.floor(total / n);
    const out = Array(n).fill(base / 100);
    out[n - 1] = (total - base * (n - 1)) / 100;
    return out;
  }

  /* Extenso com concordância de gênero (1→uma, 2→duas, 200→duzentas) —
     usado pra Escada/Esteira Rolante (feminino). */
  function inteiroExtensoGen(n, fem) {
    const t = inteiroExtenso(n);
    if (!fem) return t;
    return t
      .replace(/\bum\b(?! (mil|milh|bilh|trilh))/g, 'uma')
      .replace(/\bdois\b/g, 'duas')
      .replace(/\b(duz|trez|quatroc|quinh|seisc|setec|oitoc|novec)entos\b/g, '$1entas');
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

  /* Valida tamanho + dígitos verificadores (mod 11) — antes só checava o
     tamanho, então "111.111.111-11" ou um CNPJ digitado errado passavam. */
  function isCNPJValid(v) {
    const d = onlyDigits(v);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const dv = (base) => {
      let soma = 0, peso = base.length - 7;
      for (let i = 0; i < base.length; i++) { soma += parseInt(base[i], 10) * peso--; if (peso < 2) peso = 9; }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(d.slice(0, 12)) === parseInt(d[12], 10) && dv(d.slice(0, 13)) === parseInt(d[13], 10);
  }
  function isCPFValid(v) {
    const d = onlyDigits(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const dv = (base) => {
      let soma = 0;
      for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (base.length + 1 - i);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(d.slice(0, 9)) === parseInt(d[9], 10) && dv(d.slice(0, 10)) === parseInt(d[10], 10);
  }
  /* CNPJ da própria Contratante não pode ser usado como Contratada. */
  function isCNPJContratante(v) { return onlyDigits(v) === onlyDigits(CONTRATANTE.cnpj); }
  function isCEPValid(v) { return onlyDigits(v).length === 8; }

  function pad2(n) { return String(n).padStart(2,'0'); }

  function defaultState() {
    const hoje = new Date();
    return {
      modalidade: 'instalacao',
      masterId: null, propostaId: null, ativosIndices: [],  // Master ID Fase 2
      /* Snapshot dos ativos da Proposta selecionada (com custoInstalacaoMaoDeObraRs
         por equipamento, ver proposta-heranca.js) — usado só pra sugerir o
         Valor total do contrato (Passo 5), nunca lido pelo documento em si. */
      ativosSnapshot: [],
      dossierIds: [],  // Dossiê(s) reais cobertos (pagamento por marco — Trilha B)
      dossieNumero: '', acordoId: null,   // Dossiê informado no Passo 1 e preço combinado herdado dele (15/10/2026)
      /* Nº do contrato nasce dos equipamentos (29/09): numeroContratoBase =
         "VPNI-0955" (cotação) ou "VPNI-<nº de série/projeto>" (avulso);
         numeroContrato = base + sufixo -2/-3 se já existir outro contrato
         com a mesma base (ex.: 2 montadores na mesma cotação). Fixo depois
         de nascer. equipamentosManuais = nº de série / Master ID digitados
         (obrigatório no avulso; opcional junto de uma Proposta). */
      numeroCotacao: null, numeroContrato: null, numeroContratoBase: null, equipamentosManuais: [],
      clienteObraId:null, clienteObraNome:'', clienteObraNovo:false, c_razao:'', c_cnpj:'', c_rua:'', c_numero:'', c_bairro:'', c_cidade:'', c_estado:'', c_cep:'',
      r_nome:'', r_nacionalidade:'brasileiro(a)', r_estadoCivil:'', r_profissao:'',
      r_rg:'', r_cpf:'', r_mesmoEndereco: true,
      r_rua:'', r_numero:'', r_bairro:'', r_cidade:'', r_estado:'', r_cep:'',
      equipamento: 'elevador', quantidade: 1, localServico:'', descricaoServicos:'',
      /* Cláusula de prazo e cronograma (pedido do Jurídico, 22/10/2026) — bloco opcional; marcos escolhidos um a um, cada um com a sua data.
         criterio '' = não qualifica o prazo (corridos/úteis é decisão do Jurídico, ainda pendente). */
      cronograma: { ativo: false, prazoDias: '', criterio: '', marcos: {} },
      equipamentosDetalhe: [],   // [{dossier, serie, descricao, tipo}] vindos do Dossiê/equipamentos_obra (cláusula 1.1.1)
      fasesAtivas: {}, fasesTexto: {},   // fases de montagem (só elevador): { f1: true } / texto editado por fase
      tipoElevador: 'social', capacidadeCarga:'', cargaEspecial: false,
      paradas: '5', paradasCustom:'', destino:'',
      obraCidade:'', obraEstado:'', distancia:'', distanciaAuto:true,
      logResponsavel:'contratada', logModo:'despesas', logDiasExtra:'',
      valorTotal:'', formaPagamento:'2', parcelas:[], condicionarUltimaParcela: true, datasParcelas:['', '', ''],   // datas previstas das parcelas rápidas (2/3); nas personalizadas é p.data
      banco:'', agencia:'', conta:'', pix:'',
      cidadeAssinatura: 'Guarulhos',
      dataDia: pad2(hoje.getDate()),
      dataMes: MESES[hoje.getMonth()],
      dataAno: String(hoje.getFullYear()),
    };
  }

  /* ---------- Equipamentos e Nº do contrato ---------- */
  /* Equipamentos cobertos: ativos marcados da Proposta (identificador
     VPEL-EL0955-1…) + nº de série / projeto digitados. Sem duplicata. */
  function equipamentosDoContrato(s) {
    const marcados = (s.ativosSnapshot || [])
      .filter((a) => (s.ativosIndices || []).includes(a.indice))
      .map((a) => String(a.identificador || a.codigo || '').trim());
    const manuais = (s.equipamentosManuais || []).map((v) => String(v).trim());
    const out = [];
    marcados.concat(manuais).forEach((v) => { if (v && !out.includes(v)) out.push(v); });
    return out;
  }
  function slugEquipamento(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().trim().replace(/\s+/g, '-').replace(/[^A-Z0-9._-]/g, '').replace(/^-+|-+$/g, '');
  }
  /* Base do nº do contrato: com Proposta → VPNI-<Nº da cotação, 4 dígitos>;
     sem Proposta → VPNI-<1º nº de série/projeto informado>. null = ainda
     não dá pra nascer (nenhum equipamento mencionado). */
  function numeroBaseContrato(s) {
    if (!equipamentosDoContrato(s).length) return null;
    if (s.numeroCotacao != null && s.numeroCotacao !== '') return 'VPNI-' + String(s.numeroCotacao).padStart(4, '0');
    const primeiro = (s.equipamentosManuais || []).map(slugEquipamento).find(Boolean);
    return primeiro ? 'VPNI-' + primeiro : null;
  }
  /* 1º livre entre base, base-2, base-3… dado o conjunto de nºs já usados. */
  function proximoNumeroLivre(base, usados) {
    const set = usados instanceof Set ? usados : new Set(usados || []);
    if (!set.has(base)) return base;
    let n = 2;
    while (set.has(base + '-' + n)) n++;
    return base + '-' + n;
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

  /* Fases de montagem de elevador (opcionais, só elevador): texto-padrão editável por fase.
     {andares} vira o nº de paradas do equipamento. */
  const FASES_MONTAGEM = [
    { id:'f1', label:'Fase 1 (Estrutura e Caixa)', texto:'Fase 1 (Estrutura e Caixa): Fixação de suportes, alinhamento, prumo e montagem das guias (cabine e contra-peso), instalação do limitador de velocidade e montagem da estrutura do contra-peso;' },
    { id:'f2', label:'Fase 2 (Mecânica e Tracionamento)', texto:'Fase 2 (Mecânica e Tracionamento): Instalação da máquina de tração (MRL), passagem de cabos de aço (tracionamento), montagem da armação de cabine (chassis) e instalação do sistema de freio de segurança;' },
    { id:'f3', label:'Fase 3 (Cabine e Portas)', texto:'Fase 3 (Cabine e Portas): Montagem dos painéis da cabine, subteto, botoeiras, instalação dos operadores de porta e portas de pavimento em todos os {andares} andares;' },
    { id:'f4', label:'Fase 4 (Elétrica e Ajustes Finais)', texto:'Fase 4 (Elétrica e Ajustes Finais): Lançamento de cabos de manobra, fixação do quadro de comando, fiação de poço, sensores de leitura, ajustes de nivelamento, testes dinâmicos e preparação para vistoria.' },
  ];
  /* Descrição livre só conta se tiver letra ou número (um ":" solto não é descrição). Com fase marcada e com texto,
     a descrição livre é opcional (pedido do Jurídico, 22/10/2026). */
  function descricaoLivreTemTexto(s) { return /[\p{L}\p{N}]/u.test(String(s.descricaoServicos || '')); }
  function descricaoServicosValida(s) { return descricaoLivreTemTexto(s) || fasesDoContrato(s).length > 0; }
  /* Cláusula 1.1.1 — cada equipamento com descrição + nº de série + identificação. Ausência é dita, nunca inventada. */
  function equipamentosDescritos(s) {
    const cobertosSel = new Set(equipamentosDoContrato(s));   // só o que ainda está selecionado (chip removido sai do texto)
    const det = (s.equipamentosDetalhe || []).filter((e) => e && (e.descricao || e.serie || e.dossier) && (cobertosSel.has(String(e.dossier || '').trim()) || cobertosSel.has(String(e.serie || '').trim())));
    const itens = det.map((e) => {
      const partes = [e.serie ? 'nº de série ' + e.serie : 'nº de série não informado'];
      if (e.dossier) partes.push('Dossiê ' + e.dossier);
      return (e.descricao ? e.descricao + ' ' : '') + '(' + partes.join('; ') + ')';
    });
    const cobertos = new Set();
    det.forEach((e) => { if (e.serie) cobertos.add(String(e.serie).trim()); if (e.dossier) cobertos.add(String(e.dossier).trim()); });
    equipamentosDoContrato(s).forEach((v) => { if (!cobertos.has(v)) itens.push(v); });
    return itens;
  }
  const MARCOS_CRONOGRAMA = [
    { id:'inicio', label:'Início previsto' },
    { id:'tracionamento', label:'Previsão de tracionamento' },
    { id:'cabine', label:'Previsão de cabine e portas' },
    { id:'termino', label:'Término e entrega para vistoria' },
  ];
  const ISO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  function dataBR(iso) { const m = String(iso || '').match(ISO_DATA); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function _ms(iso) { const m = String(iso || '').match(ISO_DATA); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function diasCorridosEntre(a, b) { const x = _ms(a), y = _ms(b); return x == null || y == null ? null : Math.round((y - x) / 86400000); }
  function diasUteisEntre(a, b) {   // segunda a sexta, sem feriados; conta de a (exclusive) até b (inclusive)
    const x = _ms(a), y = _ms(b); if (x == null || y == null || y < x) return null;
    let n = 0; for (let t = x + 86400000; t <= y; t += 86400000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
    return n;
  }
  /* Cronograma efetivo: só se ativo, com prazo > 0; marcos só os marcados COM data válida. */
  function cronogramaDoContrato(s) {
    const c = s.cronograma || {};
    const dias = parseInt(String(c.prazoDias || '').replace(/\D/g, ''), 10);
    if (!c.ativo || !(dias > 0)) return null;
    const marcos = (c.marcos || {});
    const itens = MARCOS_CRONOGRAMA.filter((m) => marcos[m.id] && marcos[m.id].on && dataBR(marcos[m.id].data)).map((m) => ({ id: m.id, texto: m.label + ': ' + dataBR(marcos[m.id].data) }));
    return { dias, criterio: c.criterio === 'corridos' || c.criterio === 'uteis' ? c.criterio : '', itens };
  }
  /* Aviso (nunca altera nada): início→término não bate com o prazo informado. */
  function alertaCronograma(s) {
    const c = s.cronograma || {}; const dias = parseInt(String(c.prazoDias || '').replace(/\D/g, ''), 10);
    const m = c.marcos || {}; const a = m.inicio && m.inicio.on && m.inicio.data, b = m.termino && m.termino.on && m.termino.data;
    if (!c.ativo || !(dias > 0) || !a || !b) return '';
    const corr = diasCorridosEntre(a, b), ute = diasUteisEntre(a, b);
    if (corr == null) return '';
    if (corr < 0) return 'O término está antes do início.';
    const confere = c.criterio === 'uteis' ? ute === dias : corr === dias;
    if (confere) return '';
    return 'Do início ao término há ' + corr + ' dias corridos (' + ute + ' úteis), mas o prazo informado é de ' + dias + '. Nada foi alterado: confirme com o Jurídico qual contagem vale.';
  }
  function andaresDe(s) {
    const n = s.paradas === 'Personalizado' ? s.paradasCustom : s.paradas;
    return String(n || '').trim() || '___';
  }
  function fasesDoContrato(s) {
    if (s.equipamento !== 'elevador' || isRemocao(s)) return [];
    const ativas = s.fasesAtivas || {}, txt = s.fasesTexto || {};
    /* Fase marcada com o texto apagado NÃO conta (checkbox sem texto não supre a descrição). */
    return FASES_MONTAGEM.filter(f => ativas[f.id] && !(txt[f.id] != null && !String(txt[f.id]).trim())).map(f => {
      const t = (txt[f.id] != null) ? String(txt[f.id]).trim() : f.texto;
      return t.replace(/\{andares\}/g, andaresDe(s));
    });
  }

  function activeConditionals(s) {
    const list = [];
    if (isRemocao(s))        list.push({ id:'remocao',    label:'Objeto adaptado p/ remoção',          tone:'info' });
    if (isCargaEspecial(s))  list.push({ id:'especial',   label:'Cláusula de Equipamento Especial',    tone:'warn' });
    if (isLongaDistancia(s)) list.push({ id:'distancia',  label:'Cláusula de Logística (≥ 100 km)',    tone:'warn' });
    return list;
  }

  /* ---------- Builder do documento ---------- */
  function vBlank(v, ph) { return (v && String(v).trim()) ? String(v).trim() : ph; }

  /* Só prefixa "Rua " quando o usuário não digitou o tipo do logradouro
     (senão "Avenida Paulista" virava "Rua Avenida Paulista"). */
  const TIPO_LOGRADOURO = /^(rua|r\.|avenida|av\.?|alameda|al\.|travessa|tv\.|estrada|estr\.|rodovia|rod\.|pra[cç]a|p[cç]a\.?|largo|viela|via|beco|parque|jardim)(\s|$)/i;
  function logradouro(v) {
    const t = vBlank(v, '');
    if (!t) return 'Rua XXX';
    return TIPO_LOGRADOURO.test(t) ? t : 'Rua ' + t;
  }

  function buildEnderecoContratada(s) {
    return [
      logradouro(s.c_rua),
      'nº ' + vBlank(s.c_numero, 'XXX'),
      vBlank(s.c_bairro, 'bairro'),
      vBlank(s.c_cidade, 'cidade') + '/' + vBlank(s.c_estado, 'UF'),
      'CEP ' + vBlank(s.c_cep, 'XX.XXX-XX'),
    ].join(', ');
  }
  function buildEnderecoResponsavel(s) {
    if (s.r_mesmoEndereco) return buildEnderecoContratada(s);
    return [
      logradouro(s.r_rua),
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
    const fem = eq.gen === 'a';
    return `Faz parte do escopo desse serviço a ${verboModalidade(s)} de ${qtd} (${inteiroExtensoGen(qtd, fem)}) ${qtd > 1 ? eq.plural : eq.label} da Marca Vertical Parts.`;
  }

  /* Data PREVISTA de cada parcela (opcional; não é a data de pagamento). Aceita ISO (aaaa-mm-dd) ou texto já formatado. */
  function dataPrevistaTxt(v) {
    const t = String(v || '').trim();
    if (!t) return '';
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return ' (data prevista: ' + (m ? m[3] + '/' + m[2] + '/' + m[1] : t) + ')';
  }
  function buildPagamentoItems(s) {
    const dp = (s.datasParcelas || []);
    const valor = moedaParaNumero(s.valorTotal);
    const valorFmt = valor ? 'R$ ' + fmtMoeda(valor) : 'R$ XX.XXX,XX';
    const valorExt = valor ? ' (' + valorExtenso(valor) + ')' : ' (valor por extenso)';
    const items = [];
    if (s.formaPagamento === '2') {
      const [p1, p2] = dividirEmParcelas(valor, 2);
      const f = (v) => v ? 'R$ ' + fmtMoeda(v) : 'R$ XX.XXX,XX';
      const e = (v) => v ? ' (' + valorExtenso(v) + ')' : ' (valor por extenso)';
      items.push({ n:'5.1', text:`Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de ${valorFmt}${valorExt}, a ser pago em 2 (duas) parcelas via depósito em conta bancária, da seguinte forma:` });
      items.push({ n:'5.1.1', text:`${f(p1)}${e(p1)} na data de início dos trabalhos${dataPrevistaTxt(dp[0])};` });
      items.push({ n:'5.1.2', text:`${f(p2)}${e(p2)} após a finalização do serviço, com o equipamento apto ao pleno funcionamento e mediante nota fiscal de serviço${dataPrevistaTxt(dp[1])}.` });
    } else if (s.formaPagamento === '3') {
      const [p1, p2, p3] = dividirEmParcelas(valor, 3);
      const f = (v) => v ? 'R$ ' + fmtMoeda(v) : 'R$ XX.XXX,XX';
      const e = (v) => v ? ' (' + valorExtenso(v) + ')' : ' (valor por extenso)';
      items.push({ n:'5.1', text:`Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de ${valorFmt}${valorExt}, a ser pago em 3 (três) parcelas via depósito em conta bancária, da seguinte forma:` });
      items.push({ n:'5.1.1', text:`${f(p1)}${e(p1)} na data de início dos trabalhos${dataPrevistaTxt(dp[0])};` });
      items.push({ n:'5.1.2', text:`${f(p2)}${e(p2)} na metade da execução dos serviços${dataPrevistaTxt(dp[1])};` });
      items.push({ n:'5.1.3', text:`${f(p3)}${e(p3)} após a finalização do serviço, mediante nota fiscal de serviço${dataPrevistaTxt(dp[2])}.` });
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
          const quando = p.descricao && p.descricao.trim() ? p.descricao.trim() : '';
          items.push({ n:'5.1.'+(i+1), text:`${pf}${pe}${quando ? ' — ' + quando : ''}${dataPrevistaTxt(p.data)};` });
        });
      }
    }
    const banco = vBlank(s.banco, '____');
    const ag    = vBlank(s.agencia, '____');
    const conta = vBlank(s.conta, '____');
    const pix   = vBlank(s.pix, '____');
    /* Nº do item bancário calculado a partir do último item de fato (não
       fixo em "5.1.3") — senão desalinha sempre que a forma de pagamento
       não é a de 2 parcelas (3 parcelas usa até 5.1.3, personalizado usa
       um número de itens variável). */
    /* Última parcela condicionada à vistoria e aos laudos (redação do Jurídico, 22/10/2026) — imediatamente antes dos dados bancários.
       Só quando marcado (`=== true`: contratos criados antes não têm a chave e ficam como estavam). O valor é o da última parcela
       da sequência efetiva, recalculado a cada edição; sem valor válido vira o marcador padrão do documento. */
    let lastN = items.length ? items[items.length - 1].n : '5.1';
    if (s.condicionarUltimaParcela === true) {
      let vUlt = 0;
      if (s.formaPagamento === '2') vUlt = dividirEmParcelas(valor, 2)[1];
      else if (s.formaPagamento === '3') vUlt = dividirEmParcelas(valor, 3)[2];
      else { const pp = (s.parcelas || []); vUlt = pp.length ? moedaParaNumero(pp[pp.length - 1].valor) : 0; }
      const nCond = bumpItemNumber(lastN);
      items.push({ n: nCond, text: `A liberação da última parcela (${vUlt ? 'R$ ' + fmtMoeda(vUlt) : 'R$ XX.XXX,XX'}) fica estritamente condicionada à aprovação do equipamento na vistoria técnica realizada pelo Supervisor da CONTRATANTE e à emissão dos laudos de conformidade.` });
      lastN = nCond;
    }
    const nBanco = bumpItemNumber(lastN);
    items.push({ n: nBanco, text:'Dados bancários da CONTRATADA:', bank:{ banco, ag, conta, pix } });
    /* Trava de pagamento pelo envio diário do Acompanhamento de Obra (21/10/2026) — cláusula em destaque. */
    const nTrava = String(nBanco).split('.')[0] + '.2';
    items.push({ n: nTrava, destaque: true, text:'LIBERAÇÃO DOS PAGAMENTOS PELO ENVIO DIÁRIO DO ACOMPANHAMENTO DE OBRA: a CONTRATADA deverá enviar, DIARIAMENTE e a cada etapa concluída, o checklist do Acompanhamento de Obra pelo link individual que lhe for fornecido pela CONTRATANTE. Os envios registram o andamento real da obra e calculam, automaticamente, o seu percentual de evolução. Os pagamentos previstos no item 5.1 vinculados à metade da execução e à finalização somente serão liberados quando o percentual correspondente constar dos envios feitos. A ausência dos envios diários SUSPENDE a liberação de qualquer pagamento até a regularização, sem incidência de multa, juros ou correção sobre o período de suspensão. Solicitação de pagamento, por qualquer meio, não substitui nem antecipa os envios: quem libera os pagamentos são exclusivamente os envios do checklist.' });
    return items;
  }

  function bumpItemNumber(n) {
    const parts = String(n).split('.');
    const last = parseInt(parts[parts.length - 1], 10);
    parts[parts.length - 1] = String((isNaN(last) ? 0 : last) + 1);
    return parts.join('.');
  }

  /* Os números "n" dos itens (ex.: "2.1", "5.1.2") nascem hardcoded
     assumindo a ordem-base do contrato SEM nenhuma cláusula condicional
     (Equipamento Especial / Logística). Quando uma condicional entra, ela
     é inserida no meio do array sem número de cláusula próprio (usa EE./LG.),
     empurrando o ORDINAL (c.ord, "CLÁUSULA TERCEIRA...") de tudo que vem
     depois — mas o número dos itens ficava parado no valor hardcoded,
     desalinhando cabeçalho x corpo (ex.: "CLÁUSULA TERCEIRA" com itens
     "2.1, 2.2..."). renumClauseItems corrige isso reescrevendo só o
     primeiro segmento do "n" (o número da cláusula) pro valor real da
     posição, preservando o resto (".1", ".13" etc.). */
  function renumClauseItems(clause, actualNum) {
    if (!clause.baseNum || clause.baseNum === actualNum) return;
    const re = new RegExp('^' + clause.baseNum + '(?=[.\\D]|$)');
    clause.items.forEach(it => { if (it.n) it.n = it.n.replace(re, String(actualNum)); });
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
    const equips = equipamentosDoContrato(s);
    if (equips.length) {
      const desc = equipamentosDescritos(s);
      const plural = desc.length > 1 ? 's' : '';
      objetoItems.push({ n:'1.1.1', text: (s.equipamentosDetalhe && s.equipamentosDetalhe.length)
        ? `Equipamento${plural} objeto deste contrato: ${desc.join('; ')}.`
        : `Equipamento${plural} objeto deste contrato (nº de série / identificação): ${desc.join(', ')}.` });
    }
    const fases = fasesDoContrato(s);
    const temLivre = descricaoLivreTemTexto(s);
    if (temLivre) {
      objetoItems.push({ n:'1.2', text:'Descrição dos serviços: ' + String(s.descricaoServicos).trim() });
      if (fases.length) objetoItems.push({ n:'1.2.1', text:'A CONTRATADA executará as seguintes etapas:', list: fases });
    } else if (fases.length) {
      objetoItems.push({ n:'1.2', text:'Descrição dos serviços: a CONTRATADA executará as seguintes etapas:', list: fases });
    } else {
      objetoItems.push({ n:'1.2', text:'Descrição dos serviços: (detalhar os serviços a executar)' });
    }
    objetoItems.push({ n:'1.3', text:'Local do serviço: ' + vBlank(s.localServico, '(endereço completo de onde será realizado o serviço)') });
    if (isRemocao(s)) {
      const lbl = s.modalidade === 'remocao_adequacao' ? 'Local da nova instalação' : 'Destino do equipamento removido';
      objetoItems.push({ n:'1.4', text:`${lbl}: ` + vBlank(s.destino, '(informar o destino / local)') });
    }
    const cron = cronogramaDoContrato(s);
    if (cron) {
      const nCron = isRemocao(s) ? '1.5' : '1.4';   // em remoção a 1.4 já é o destino do equipamento
      const crit = cron.criterio === 'corridos' ? ' corridos' : cron.criterio === 'uteis' ? ' úteis' : '';
      const it = { n: nCron, text: `A CONTRATADA declara ciência e concordância de que o prazo total de execução dos serviços objeto deste contrato é de ${cron.dias} (${inteiroExtenso(cron.dias)}) dias${crit}${cron.itens.length ? ', observando o seguinte cronograma de evolução da obra:' : '.'}` };
      if (cron.itens.length) it.list = cron.itens.map((x) => x.texto);
      objetoItems.push(it);
    }
    clauses.push({ id:'objeto', titulo:'DO OBJETO', baseNum:1, items:objetoItems });

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

    /* OBRIGAÇÕES DA CONTRATADA */
    clauses.push({
      id:'obrig_contratada', titulo:'DA OBRIGAÇÃO DO CONTRATADO', baseNum:2,
      items: [
        { n:'2.1', text:'Fica responsável a CONTRATADA por todos os serviços que lhe forem apontados, durante o tempo necessário para ' + (isRemocao(s) ? 'remoção' : 'instalação') + ' e finalização do mesmo, conforme especificado no item 1.1.' },
        { n:'2.2', text:'A CONTRATADA deverá seguir as normas estabelecidas pela CONTRATANTE, como horário de funcionamento do local onde serão executados os serviços e quanto às regras de utilização de ferramentas, como a obrigatoriedade do uso de Equipamentos de Proteção Individual (EPIs).' },
        { n:'2.3', text:'A fiscalização será exercida por pessoas expressamente designadas pela CONTRATANTE, as quais serão investidas de plenos poderes para: solicitar da CONTRATADA substituição, no prazo máximo de 24 (vinte e quatro) horas, de qualquer profissional ou operário que embarace o seu trabalho de fiscalizar; rejeitar serviços defeituosos ou materiais que não satisfaçam às exigências ora contratadas, obrigando-se a CONTRATADA a refazer os serviços, sem ônus para a CONTRATANTE e sem alteração do cronograma.' },
        { n:'2.4', text:'A CONTRATADA deverá manter no local de ' + (isRemocao(s) ? 'execução' : 'instalação') + ' um Diário de Obra para anotação do andamento da execução dos serviços e de todos os eventos que possam implicar em alterações técnicas e prazos.' },
        { n:'2.5', text:'A CONTRATADA deverá manter os locais de trabalho o mais limpo possível, removendo todos os materiais, equipamentos, sobras e instalações provisórias de modo a deixar os ambientes limpos antes do início dos testes finais.' },
        { n:'2.6', text:'A CONTRATADA não deverá ' + (isRemocao(s) ? 'remover os equipamentos' : 'instalar os equipamentos na obra') + ' sem prévia fiscalização da CONTRATANTE.' },
        { n:'2.7', text:'A CONTRATADA fornecerá todo o ferramental para a execução do serviço, mão de obra e supervisão necessária às operações, bem como contratação de andaimes, auxiliares, etc.' },
        { n:'2.8', text:'A CONTRATADA se compromete a manter, durante toda a execução do Contrato, a fim de cumprir com as obrigações por ele assumidas, todas as condições de habilitação e qualificação exigidas por Lei e respectivas normas técnicas, para garantia e segurança da qualidade dos serviços.' },
        { n:'2.9', text:'A CONTRATADA se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, informações e documentos da CONTRATANTE, mesmo após a conclusão dos serviços ou do término da relação contratual, não podendo utilizar e/ou resguardar quaisquer informações recebidas, sob pena de responsabilizar-se por perdas e danos.' },
        { n:'2.10', text:'Os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados, pela CONTRATADA, estritamente para cumprimento dos serviços solicitados pela CONTRATANTE, sendo VEDADA a comercialização ou utilização para outros fins.' },
        { n:'2.11', text:'Garantir a execução deste contrato por sua equipe de profissionais, sendo permitida a subcontratação por parte da CONTRATADA, sob sua exclusiva responsabilidade.' },
        { n:'2.12', text:'Executar os serviços contratados através da fixação de parâmetros técnicos e a tempo certo, obedecendo ao cronograma e prazos estipulados entre as partes.' },
        { n:'2.13', text:'É obrigação da CONTRATADA nos enviar uma cópia dos documentos e certificações exigidas pelas normas de Segurança do Trabalho para a prestação dos serviços objeto deste contrato, conforme lista abaixo, não excluindo nenhuma outra certificação que seja pertinente ao trabalho:', list: ANEXOS.map(a => a.label) },
      ],
    });

    /* OBRIGAÇÕES DA CONTRATANTE */
    clauses.push({
      id:'obrig_contratante', titulo:'DAS OBRIGAÇÕES DA CONTRATANTE', baseNum:3,
      items: [
        { n:'3.1', text:'Prestar as informações e os esclarecimentos que venham a ser solicitados pela CONTRATADA, desde que necessários para a prestação dos serviços ora contratados.' },
        { n:'3.2', text:'A CONTRATANTE se responsabiliza a prestar todo apoio técnico necessário para que a CONTRATADA realize os serviços acordados neste instrumento.' },
        { n:'3.3', text:'Realizar os pagamentos dentro do prazo, conforme disposto na Cláusula __PAGAMENTO__.', ref:'pagamento' },
      ],
    });

    /* RESPONSABILIDADE DA CONTRATADA */
    clauses.push({
      id:'resp_contratada', titulo:'DA RESPONSABILIDADE DA CONTRATADA', baseNum:4,
      items: [
        { n:'4.1', text:'A CONTRATADA responderá pelos encargos trabalhistas, fiscais, comerciais e previdenciários resultantes da execução deste contrato, não transferindo à CONTRATANTE, em caso de inadimplência da CONTRATADA com referência a esses encargos, a responsabilidade por seu pagamento, nem podendo onerar o objeto deste contrato.' },
        { n:'4.2', text:'Caberão à CONTRATADA os prejuízos causados à CONTRATANTE ou a terceiros, por atos de sua responsabilidade e decorrentes da execução dos serviços estipulados neste contrato, por culpa ou dolo, excluídos os casos em que a CONTRATANTE der causa, seja por sua ação ou omissão.' },
      ],
    });

    /* PAGAMENTO */
    clauses.push({ id:'pagamento', titulo:'DO PAGAMENTO', baseNum:5, items: buildPagamentoItems(s) });

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
    clauses.push({ id:'cessao', titulo:'DA CESSÃO OU TRANSFERÊNCIA', baseNum:6, items:[
      { n:'6.1', text:'O contrato não poderá ser objeto de cessão ou transferência, no todo ou em parte, a não ser com prévio e expresso consentimento da CONTRATANTE, sob pena de imediata rescisão do mesmo.' },
    ]});

    /* RESCISÃO */
    clauses.push({ id:'rescisao', titulo:'DA RESCISÃO', baseNum:7, items:[
      { n:'7.1', text:'Constituem motivos para a rescisão deste contrato:', list:[
        'não cumprimento de cláusulas, especificações e prazos;',
        'atraso ou paralisação injustificada e/ou sem comunicação à CONTRATANTE na execução dos serviços;',
        'desatendimento às determinações da fiscalização da CONTRATANTE;',
        'alteração social ou modificação da finalidade ou estrutura da CONTRATADA que impossibilite ou venha prejudicar a execução do Contrato;',
        'atraso no pagamento dos serviços superior a 30 (trinta) dias, conforme disposto na Cláusula __PAGAMENTO__.',
      ], listType:'alpha', refInList:'pagamento' },
      { n:'7.2', text:'A rescisão do Contrato poderá ser:', list:[
        'determinada por ato unilateral e escrito da CONTRATANTE, caso a CONTRATADA descumpra quaisquer cláusulas ou condições ora pactuadas;',
        'amigável, por acordo entre as partes, reduzido a termo, desde que haja conveniência para a CONTRATANTE;',
        'judicial, nos termos da legislação.',
      ], listType:'alpha' },
    ]});

    /* VIGÊNCIA */
    clauses.push({ id:'vigencia', titulo:'DA VIGÊNCIA', baseNum:8, items:[
      { n:'8.1', text:'Para efeito deste contrato, a vigência terá seu início na data de assinatura deste instrumento e se findará automaticamente com a finalização dos serviços ora contratados.' },
      { n:'8.2', text:'Este contrato é válido até o término do serviço objeto deste contrato, vide Cláusula __OBJETO__, não ficando as partes isentas de seus compromissos éticos após a invalidação do mesmo, podendo ser prorrogado e/ou alterado por acordo entre as partes, mediante termo aditivo.', ref:'objeto' },
    ]});

    /* PENALIDADES */
    clauses.push({ id:'penalidades', titulo:'DAS PENALIDADES', baseNum:9, items:[
      { n:'9.1', text:'Em caso de rescisão sem justo motivo por uma das partes antes do prazo final do contrato, ou de qualquer uma das ocorrências previstas na Cláusula __RESCISAO__ deste instrumento, este Contrato será rescindido automaticamente e caberá à parte infratora multa equivalente a 20% (vinte por cento) sobre o total do contrato, a ser paga em até 5 (cinco) dias corridos da rescisão.', ref:'rescisao' },
    ]});

    /* TOLERÂNCIA */
    clauses.push({ id:'tolerancia', titulo:'DA TOLERÂNCIA', baseNum:10, items:[
      { n:'10.1', text:'A eventual tolerância, pela CONTRATANTE, com relação ao descumprimento de qualquer termo ou condição aqui ajustado, não será considerada como desistência em exigir o cumprimento de disposição nele contida, nem representará novação com relação à obrigação passada, presente ou futura, no tocante ao termo ou condição cujo descumprimento foi tolerado.' },
    ]});

    /* DISPOSIÇÕES GERAIS */
    clauses.push({ id:'disposicoes', titulo:'DAS DISPOSIÇÕES GERAIS', baseNum:11, items:[
      { n:'11.1', text:'Este é um contrato típico de prestação de serviços, conforme nomeado pelo Código Civil, e no caso de qualquer omissão deste contrato serão aplicáveis as regras previstas na Legislação.' },
      { n:'11.2', text:'A execução deste contrato será acompanhada e fiscalizada por empregado da CONTRATANTE, o qual será também responsável pelo recebimento dos serviços, avaliação e aceite.' },
      { n:'11.3', text:'A CONTRATANTE não será responsável por eventual prejuízo sofrido e/ou causado pelos profissionais da CONTRATADA em decorrência deste contrato, bem como não terá qualquer responsabilidade por eventuais danos e/ou encargos fiscais, trabalhistas, civis, securitários e/ou sociais relacionados com a execução do objeto contratual pela CONTRATADA.' },
      { n:'11.4', text:'Em que pese as previsões acima elencadas, compete frisar que a CONTRATADA não manterá qualquer vínculo de emprego com a CONTRATANTE, diante da ausência de exclusividade na prestação de serviços, bem como inexistente qualquer subordinação relativa a horário e ingerência quanto à expertise de atuação da pessoa jurídica contratada. A CONTRATADA será inteiramente responsável pelos profissionais que vier a contratar, ainda que para fins de cumprimento do presente contrato, não se estabelecendo nenhum vínculo empregatício entre estes e a CONTRATANTE.' },
    ]});

    /* FORO */
    clauses.push({ id:'foro', titulo:'DO FORO', baseNum:12, items:[
      { n:'12.1', text:'As partes convencionam que o Foro para dirimir quaisquer dúvidas ou questões oriundas do presente contrato é o Foro da Comarca de Guarulhos, São Paulo, com exclusão de qualquer outro, por mais privilegiado que seja.' },
    ]});

    /* Resolve referências cruzadas */
    const ordById = {};
    clauses.forEach((c, i) => {
      ordById[c.id] = ORDINAIS_REF[i] || ('#'+(i+1));
      c.ord = ORDINAIS[i] || ('#'+(i+1));
      renumClauseItems(c, i + 1);
    });
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
    isCNPJValid, isCPFValid, isCEPValid, isCNPJContratante,
    dividirEmParcelas, inteiroExtensoGen, logradouro,
    equipamentosDoContrato, slugEquipamento, numeroBaseContrato, proximoNumeroLivre,
    defaultState, pad2,
    isCargaEspecial, isLongaDistancia, isRemocao, activeConditionals, dataPrevistaTxt, MARCOS_CRONOGRAMA, cronogramaDoContrato, alertaCronograma, diasCorridosEntre, diasUteisEntre, dataBR, FASES_MONTAGEM, fasesDoContrato, andaresDe, descricaoLivreTemTexto, descricaoServicosValida, equipamentosDescritos,
    buildContract,
  };
}());
