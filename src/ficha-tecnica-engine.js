/* ============================================================
   ficha-tecnica-engine.js
   Gerador Universal de Fichas Técnicas — engine + biblioteca.
   Categorias pré-prontas, templates rápidos, compile do estado
   para o renderer da ficha.
   Exporta window.FT = { ... } pra não colidir.
   ============================================================ */
(function () {
  'use strict';

  /* Unidades disponíveis no Add Field modal */
  const UNIDADES = [
    '', '—',
    'mm', 'cm', 'm', 'pol', '°',
    'kg', 'g', 't', 'Nm',
    'V', 'VAC', 'VDC', 'A', 'mA', 'W', 'kW', 'HP', 'Hz', 'Ω', 'F', 'µF', 'Ah', '%',
    'm/s', 'RPM', 'm/s²',
    'L', 'mL', 'm³/h', 'bar', 'PSI',
    'dB', 'dBA', '°C', '°F', 'IP',
    'un', 'PC', 'PAR', 'JG', 'CX', 'polos', 'feixes', 'pinos', 'pax',
    'N', 'kN', 'HRC', 'dias', 'min', 'ano',
  ];

  const f = (nome, unidade, tipo, extra) => ({
    k: nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    nome, unidade: unidade || '', tipo: tipo || 'number', ...(extra || {}),
  });

  /* Categorias customizadas "adotadas" — tratadas como protegidas mesmo
     não sendo uma das 9 nativas (não recebem botão de excluir). Hoje só
     "Compatível com Fabricante", já estabelecida e em uso; pra proteger
     outra categoria específica no futuro, só adicionar o id aqui. */
  const PROTECTED_CUSTOM_CATS = ['c_madeira_test'];

  /* Normaliza nome pra comparação (sem acento, minúsculo, sem espaços nas
     pontas) — usado pra travar criação de categoria/campo duplicado. */
  function normalizeNome(s) {
    return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* 9 categorias pré-configuradas */
  const LIB = [
    {
      id: 'dimensoes', nome: 'Dimensões Físicas', icon: 'ruler',
      campos: [
        f('Altura', 'mm'), f('Largura', 'mm'), f('Profundidade', 'mm'), f('Comprimento', 'mm'),
        f('Diâmetro', 'mm'), f('Espessura', 'mm'), f('Curso / Stroke', 'mm'), f('Passo / Pitch', 'mm'),
        f('Ângulo / Inclinação', '°'), f('Raio', 'mm'),
      ],
    },
    {
      id: 'peso', nome: 'Peso e Massa', icon: 'weight',
      campos: [
        f('Peso Líquido', 'kg'), f('Peso Bruto', 'kg'), f('Capacidade de Carga', 'kg'),
        f('Carga Estática', 'kg'), f('Torque', 'Nm'),
      ],
    },
    {
      id: 'eletricas', nome: 'Elétricas', icon: 'bolt',
      campos: [
        f('Tensão de Alimentação', 'VAC'), f('Corrente Nominal', 'A'), f('Potência', 'kW'),
        f('Frequência', 'Hz'), f('Fator de Potência', '', 'text'), f('Resistência', 'Ω'), f('Capacitância', 'µF'),
      ],
    },
    {
      id: 'velocidade', nome: 'Velocidade e Movimento', icon: 'gauge',
      campos: [
        f('Velocidade', 'm/s'), f('Rotação', 'RPM'), f('Percurso Máximo', 'm'), f('Aceleração', 'm/s²'),
      ],
    },
    {
      id: 'fluidos', nome: 'Fluidos e Volumes', icon: 'droplet',
      campos: [f('Volume', 'L'), f('Vazão de Ar', 'm³/h'), f('Pressão', 'bar')],
    },
    {
      id: 'acustica', nome: 'Acústica e Ambiente', icon: 'wave',
      campos: [f('Ruído', 'dBA'), f('Temperatura de Operação', '°C'), f('Grau de Proteção', 'IP', 'text')],
    },
    {
      id: 'tracao', nome: 'Tração e Rolagem', icon: 'cog',
      campos: [
        f('Bitola / Diâmetro Nominal', 'mm'), f('Construção do Cabo', '', 'text'),
        f('Carga de Ruptura Mínima', 'kN'), f('Passo da Corrente', 'mm'), f('Diâmetro Rolo / Pino', 'mm'),
      ],
    },
    {
      id: 'componentes', nome: 'Específicas de Componentes', icon: 'chip',
      campos: [
        f('Número de Paradas', 'un'), f('Número de Polos', 'polos'), f('Qtd. de Cabos', 'un'),
        f('Número de Feixes', 'feixes'), f('Número de Pinos', 'pinos'), f('Número de Contatos', '', 'text'),
      ],
    },
    {
      id: 'codigos', nome: 'Códigos e Classificações', icon: 'barcode',
      campos: [
        f('NCM', '', 'text'), f('CEST', '', 'text'), f('EAN / GTIN', '', 'text'),
        f('Part Number', '', 'text'), f('Código ANVISA', '', 'text'), f('Código ANP', '', 'text'),
      ],
    },
  ];

  /* Templates rápidos */
  const TEMPLATES = [
    {
      nome: 'Rolamento 6205', produto: 'Rolamento 6205',
      campos: [
        { cat: 'dimensoes', nome: 'Diâmetro Interno', unidade: 'mm', valor: '25' },
        { cat: 'dimensoes', nome: 'Diâmetro Externo', unidade: 'mm', valor: '52' },
        { cat: 'dimensoes', nome: 'Largura', unidade: 'mm', valor: '15' },
        { cat: 'componentes', nome: 'Tipo de Vedação', unidade: '', tipo: 'text', valor: '2RS' },
      ],
    },
    {
      nome: 'Cabo de Aço 8mm', produto: 'Cabo de Aço 8mm',
      campos: [
        { cat: 'tracao', nome: 'Bitola / Diâmetro Nominal', unidade: 'mm', valor: '8' },
        { cat: 'tracao', nome: 'Construção do Cabo', unidade: '', tipo: 'text', valor: '6x19 + AF' },
        { cat: 'tracao', nome: 'Carga de Ruptura Mínima', unidade: 'kN', valor: '41' },
        { cat: 'dimensoes', nome: 'Comprimento', unidade: 'm', valor: '' },
      ],
    },
  ];

  function slug(s) {
    return 'c_' + String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
      + '_' + Math.random().toString(36).slice(2, 6);
  }

  function hoje() { return new Date().toLocaleDateString('pt-BR'); }

  /* Cache da biblioteca persistente (carregada via FTStore.loadLibrary).
     Estrutura: { cats: [{id, nome, icon}], campos: [{cat_id, k, nome, unidade, tipo}] } */
  let LIB_EXTRAS = { cats: [], campos: [] };

  function setLibraryExtras(extras) {
    LIB_EXTRAS = {
      cats: (extras && extras.cats) || [],
      campos: (extras && extras.campos) || [],
    };
  }

  function freshCats() {
    /* Começa com as 9 categorias pré-prontas */
    const cats = LIB.map((c) => ({
      id: c.id, nome: c.nome, icon: c.icon, custom: false,
      campos: c.campos.map((fld) => ({ ...fld, ativo: false, valor: '', ordem: 0 })),
    }));
    /* Adiciona categorias customizadas da biblioteca */
    LIB_EXTRAS.cats.forEach((cat) => {
      if (cats.find((x) => x.id === cat.id)) return;
      cats.push({
        id: cat.id, nome: cat.nome, icon: cat.icon || 'folder',
        custom: true, campos: [],
      });
    });
    /* Adiciona campos customizados da biblioteca em suas categorias */
    LIB_EXTRAS.campos.forEach((fld) => {
      const cat = cats.find((c) => c.id === fld.cat_id);
      if (!cat) return;
      if (cat.campos.find((x) => x.k === fld.k)) return;
      cat.campos.push({
        k: fld.k, nome: fld.nome,
        unidade: fld.unidade || '', tipo: fld.tipo || 'number',
        ativo: false, valor: '', ordem: 0, custom: true,
      });
    });
    return cats;
  }
  function genId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function freshState() {
    return {
      __id: genId(),    // estável desde o mount — usado como pasta no Storage e id na DB
      identificacao: { nomeProduto: '', descricaoComercial: '', descricaoTecnica: '', categoriaProduto: '', sku: '', codigoProduto: '', partNumber: '' },
      /* NCM/DUIMP — campos novos do copiloto (inputs do humano) */
      insumo: '', funcao_aplicacao: '', eh_parte_de: '', forma_estado: '',
      /* NCM/DUIMP — decisão limpa devolvida pela IA */
      ncm_recomendado: '', ncm_descricao: '', descricao_duimp: '',
      /* Defesa — só guardada em memória durante o wizard, persiste na tabela relatorio */
      __defesa: null,
      cats: freshCats(),
      midia: { desenho: null, foto: null },
    };
  }

  const filled = (v) => v != null && String(v).trim() !== '';

  /* Compila o estado bruto em um modelo pronto pro renderer da ficha:
     { identificacao, grupos[], midia, temMidia } */
  function compile(state) {
    const grupos = state.cats
      .map((c) => {
        const ativos = c.campos.filter((fld) => fld.ativo && filled(fld.valor));
        const linhas = ativos
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
          .map((fld) => ({ nome: fld.nome, valor: String(fld.valor).trim(), unidade: fld.unidade, tipo: fld.tipo }));
        const ordem = ativos.length
          ? Math.min.apply(null, ativos.map((fld) => fld.ordem || 0))
          : Infinity;
        return { id: c.id, nome: c.nome, linhas, ordem };
      })
      .filter((g) => g.linhas.length)
      .sort((a, b) => a.ordem - b.ordem);
    const midia = state.midia || {};
    const temMidia = !!(midia.desenho || midia.foto);
    return { identificacao: state.identificacao, grupos, midia, temMidia };
  }

  /* Aplica um template ao estado atual: desativa tudo, injeta campos do template */
  function aplicarTemplate(state, tp) {
    const cats = state.cats.map((c) => ({ ...c, campos: c.campos.map((fld) => ({ ...fld, ativo: false })) }));
    let seq = 1;
    tp.campos.forEach((tc) => {
      const cat = cats.find((c) => c.id === tc.cat); if (!cat) return;
      let fld = cat.campos.find((x) => x.nome.toLowerCase() === tc.nome.toLowerCase());
      if (!fld) { fld = { k: slug(tc.nome), nome: tc.nome, unidade: tc.unidade || '', tipo: tc.tipo || 'number', custom: true }; cat.campos.push(fld); }
      fld.ativo = true; fld.valor = tc.valor || ''; if (tc.unidade != null) fld.unidade = tc.unidade; fld.ordem = seq++;
    });
    return {
      ...state,
      identificacao: { ...state.identificacao, nomeProduto: tp.produto || state.identificacao.nomeProduto },
      cats,
    };
  }

  function nextOrdem(cats) {
    return Math.max(0, ...cats.flatMap((c) => c.campos.map((fld) => fld.ordem || 0))) + 1;
  }

  /* podeGerar: pelo menos nome + 1 grupo preenchido */
  function podeGerar(state) {
    return !!(state.identificacao.nomeProduto || '').trim() && compile(state).grupos.length > 0;
  }

  /* ============================================================
     SKU AUTOMÁTICO — determinístico (mesma ficha ⇒ mesmo SKU).
     Padrão: VPEL-PP-TEL-AD-IN-800X2100-258
       VPEL ........ prefixo do Código do Produto (Omie)
       PP .......... tipo = iniciais do nome (Porta de Pavimento)
       TEL/AD/IN ... características do dicionário fixo abaixo
       800X2100 .... vão × altura detectados nos campos/descrições
       258 ......... sequencial do Código do Produto (Omie)
     ============================================================ */

  /* Dicionário característica → sigla. Frases mais específicas PRIMEIRO.
     Para ampliar, adicione AQUI — o usuário nunca digita sigla
     (elimina interpretações divergentes). */
  const SKU_DICIONARIO = [
    /* — tipo construtivo — */
    { re: /telesc[oó]pic/i,                                      sig: 'TEL' },
    { re: /pantogr[aá]fic/i,                                     sig: 'PAN' },
    { re: /semi[\s-]*autom[aá]tic/i,                             sig: 'SAU' },
    { re: /autom[aá]tic/i,                                       sig: 'AUT' },
    { re: /\bmanual\b/i,                                         sig: 'MAN' },
    /* — abertura / lado — */
    { re: /abertura\s+central|\bcentral\b/i,                     sig: 'AC'  },
    { re: /abertura\s+direita|lado\s+direito|\bdireita\b/i,      sig: 'AD'  },
    { re: /abertura\s+esquerda|lado\s+esquerdo|\besquerda\b/i,   sig: 'AE'  },
    { re: /abertura\s+lateral/i,                                 sig: 'ALT' },
    { re: /ranhur/i,                                             sig: 'RAN' },
    { re: /dentad|\bdentes?\b/i,                                 sig: 'DEN' },
    /* — material / acabamento / cor — */
    { re: /a[cç]o\s+inox|\binox\b/i,                             sig: 'IN'  },
    { re: /a[cç]o\s+carbono/i,                                   sig: 'ACA' },
    { re: /galvanizad/i,                                         sig: 'GV'  },
    { re: /pintad|pintura/i,                                     sig: 'PT'  },
    { re: /\bvidro\b/i,                                          sig: 'VD'  },
    { re: /alum[ií]nio/i,                                        sig: 'ALU' },
    { re: /lat[aã]o/i,                                           sig: 'LTO' },
    { re: /\bbronze\b/i,                                         sig: 'BZ'  },
    { re: /elast[oô]mero/i,                                      sig: 'ELA' },
    { re: /poliuretano|\bpu\b/i,                                 sig: 'PU'  },
    { re: /pol[ií]mer|polim[eé]ric/i,                            sig: 'POL' },
    { re: /\bpvc\b/i,                                            sig: 'PVC' },
    { re: /\bepdm\b/i,                                           sig: 'EPDM'},
    { re: /borracha/i,                                           sig: 'BOR' },
    { re: /\bnylon\b|poliamida/i,                                sig: 'NY'  },
    { re: /cer[aâ]mic/i,                                         sig: 'CER' },
    { re: /ferro\s+fundido/i,                                    sig: 'FF'  },
    { re: /escovad/i,                                            sig: 'ESV' },
    { re: /\bpreto\b/i,                                          sig: 'PTO' },
    { re: /\bbranco\b/i,                                         sig: 'BCO' },
    { re: /\bvermelh/i,                                          sig: 'VM'  },
    { re: /\bazul\b/i,                                           sig: 'AZ'  },
    { re: /\bamarel/i,                                           sig: 'AM'  },
  ];

  /* Compatibilidade com fabricante → código CC? (categoria
     "Compatível com Fabricante" da biblioteca). CCO = Compatível Com Otis. */
  const SKU_COMPAT = [
    { re: /xizi/i,        sig: 'CCX'  },  // XIZI Otis ANTES de Otis
    { re: /otis/i,        sig: 'CCO'  },
    { re: /kone/i,        sig: 'CCK'  },
    { re: /tk|thyssen/i,  sig: 'CCT'  },
    { re: /schindler/i,   sig: 'CCS'  },
    { re: /sigma|lg\b/i,  sig: 'CCSG' },
    { re: /glarie/i,      sig: 'CCG'  },
    { re: /seloon/i,      sig: 'CCSE' },
    { re: /sjec/i,        sig: 'CCSJ' },
    { re: /monarch/i,     sig: 'CCM'  },
    { re: /bst/i,         sig: 'CCB'  },
  ];

  const SKU_STOPWORDS = ['de','da','do','das','dos','para','pra','com','sem','em','e','a','o','as','os','por','no','na'];

  /* Tipo = iniciais das palavras significativas do nome (máx 3).
     "Porta de Pavimento" → PP · "Botão de Chamada" → BC */
  function skuTipo(nome) {
    const palavras = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/)
      .filter((w) => w && SKU_STOPWORDS.indexOf(w.toLowerCase()) === -1);
    return palavras.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
  }

  /* Texto consolidado: nome + descrições + categoria + campos ativos.
     ATENÇÃO: a seção "Classificação fiscal · NCM/DUIMP" (insumo, função/
     aplicação, é-parte-de, forma/estado, descrição DUIMP) fica FORA do
     SKU por decisão de negócio — é insumo fiscal, não comercial. */
  function skuTexto(state) {
    const id = state.identificacao || {};
    const partes = [id.nomeProduto, id.descricaoComercial, id.descricaoTecnica, id.categoriaProduto];
    (state.cats || []).forEach((c) => (c.campos || []).forEach((f) => {
      if (f.ativo && String(f.valor || '').trim() !== '') partes.push(f.nome + ' ' + f.valor + ' ' + (f.unidade || ''));
    }));
    return partes.filter(Boolean).join(' · ');
  }

  /* Dimensões, em ordem de prioridade:
     1. padrão explícito "800x2100" em qualquer texto
     2. par vão/largura/abertura + altura
     3. quaisquer 2 primeiras medidas ativas de Dimensões Físicas (30X3)
     4. medida única → letra do campo + valor (L30, D52, E3) */
  function skuDimensoes(state, texto) {
    const m = texto.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
    if (m) return m[1] + 'X' + m[2];
    let vao = null, alt = null;
    const medidas = [];
    (state.cats || []).forEach((c) => (c.campos || []).forEach((f) => {
      if (!f.ativo || String(f.valor || '').trim() === '') return;
      const v = String(f.valor).replace(/[^\d]/g, '');
      if (!v) return;
      if (/v[aã]o|largura|abertura/i.test(f.nome) && !vao) vao = v;
      if (/altura/i.test(f.nome) && !alt) alt = v;
      if (c.id === 'dimensoes') medidas.push({ letra: f.nome[0].toUpperCase(), v, ordem: f.ordem || 0 });
    }));
    if (vao && alt) return vao + 'X' + alt;
    medidas.sort((a, b) => a.ordem - b.ordem);
    if (medidas.length >= 2) return medidas[0].v + 'X' + medidas[1].v;
    if (medidas.length === 1) return medidas[0].letra + medidas[0].v;
    return '';
  }

  /* Compatibilidade: campos ativos da categoria "Compatível com Fabricante"
     viram códigos CC? (CCO = Otis, CCK = KONE, CCS = Schindler…) */
  function skuCompat(state) {
    const sigs = [];
    (state.cats || []).forEach((c) => {
      if (!/compat/i.test(c.nome || '')) return;
      (c.campos || []).forEach((f) => {
        if (!f.ativo || String(f.valor || '').trim() === '') return;
        const d = SKU_COMPAT.find((x) => x.re.test(f.nome));
        if (d && sigs.indexOf(d.sig) === -1) sigs.push(d.sig);
      });
    });
    return sigs;
  }

  /* Monta o SKU. Vai "nascendo sozinho" conforme a ficha é preenchida.
     Retorna { sku, faltas[] } — sku vazio enquanto faltar a âncora. */
  function buildSKU(state) {
    const id = state.identificacao || {};
    const faltas = [];

    /* Família VPXXX é livre: VPB, VPEL, VPER (escada/esteira rolante),
       VPIN (insumos)… — qualquer VP + 1 a 6 letras + número (Omie). */
    const cod = String(id.codigoProduto || '').toUpperCase().replace(/\s+/g, '');
    const m = cod.match(/^(VP[A-Z]{1,6})-?(\d{1,6})$/);
    if (!m) faltas.push('Código do produto Omie (ex.: VPEL-258, VPB-25, VPER-10)');

    const tipo = skuTipo(id.nomeProduto);
    if (!tipo) faltas.push('Nome do produto');

    if (faltas.length) return { sku: '', faltas };

    const texto = skuTexto(state);
    const caracts = [];
    SKU_DICIONARIO.forEach((d) => {
      if (d.re.test(texto) && caracts.indexOf(d.sig) === -1) caracts.push(d.sig);
    });
    const dim = skuDimensoes(state, texto);
    const compat = skuCompat(state);

    /* PREFIXO-TIPO-CARACTERÍSTICAS-DIMENSÕES-COMPATIBILIDADE-SEQ */
    const partes = [m[1] + '-' + tipo].concat(caracts);
    if (dim) partes.push(dim);
    partes.push.apply(partes, compat);
    partes.push(m[2]);
    return { sku: partes.join('-'), faltas: [] };
  }

  window.FT = {
    UNIDADES, LIB, TEMPLATES, PROTECTED_CUSTOM_CATS,
    slug, hoje, freshCats, freshState, normalizeNome,
    compile, aplicarTemplate, nextOrdem, podeGerar,
    setLibraryExtras, buildSKU,
  };
}());
