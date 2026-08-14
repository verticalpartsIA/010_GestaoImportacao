/* =========================================================
   VerticalParts — Prancha de Instalação
   esquema.js · contrato de dados + derivações
   ---------------------------------------------------------
   Esta página NÃO coleta dados. Ela HERDA o payload do
   formulário do site (Dados do Cliente/Obra + Dados do
   Equipamento) e desenha a prancha.

   Ver INTEGRACAO.md para as 3 formas de injetar os dados.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- helpers ---------- */
  const isNum = (v) => typeof v === "number" && !isNaN(v);
  const num = (v, fb) => (isNum(v) ? v : (isNum(parseFloat(v)) ? parseFloat(v) : fb));
  // cotas de desenho: inteiro cru em mm, sem separador (convenção CAD)
  const mm = (v) => (isNum(v) ? String(Math.round(v)) : "--");
  const or = (v, fb) => (v === undefined || v === null || v === "" ? fb : v);
  const up = (v) => String(or(v, "--")).toUpperCase();
  const pad2 = (n) => String(n).padStart(2, "0");
  function deepMerge(base, over) {
    if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over).forEach((k) => {
      const b = out[k], o = over[k];
      out[k] = (b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(o)) ? deepMerge(b, o) : o;
    });
    return out;
  }

  /* ---------- sigla do tipo (compõe o código do equipamento) ---------- */
  const SIGLA_TIPO = {
    "passageiro": "P", "passageiros": "P", "social": "P", "panorâmico": "PN", "panoramico": "PN",
    "carga": "C", "monta-carga": "MC", "monta carga": "MC", "montacarga": "MC",
    "serviço": "S", "servico": "S", "plataforma": "PL", "acessibilidade": "PL",
    "residencial": "R", "automóvel": "AU", "automovel": "AU", "maca": "MA", "hospitalar": "MA",
  };
  function siglaTipo(tipo) {
    if (!tipo) return "X";
    const k = String(tipo).trim().toLowerCase();
    if (SIGLA_TIPO[k]) return SIGLA_TIPO[k];
    for (const key in SIGLA_TIPO) if (k.indexOf(key) >= 0) return SIGLA_TIPO[key];
    return String(tipo).trim().charAt(0).toUpperCase();
  }

  /* =========================================================
     DEMO — projeto de referência (renderiza sozinho, sem o site)
     Substituído inteiramente pelo payload herdado.
     ========================================================= */
  const DEMO = {
    documento: {
      revisao: "0", data: "21/05/2026", escala: "---", unidade: "mm",
      numeroProposta: "28778 - 776", numeroSerie: "500.0397",
      codigoEquipamento: null,           // null = derivar dos campos
      revisadoPor: "BRAYAN", aprovadoPor: "ALEXANDRE SCHMIDT",
      motivoRevisao1: "----", motivoRevisao2: "----",
    },
    cliente: {
      nomeRazaoSocial: "SF INCORPORAÇÕES",
      cnpj: "21.494.881/0001-14",
      endereco: { logradouro: "PASSEIO DOS COQUEIROS, 600", cep: "11262-093", cidade: "BERTIOGA", uf: "SP" },
    },
    equipamento: {
      identificador: "E1", quantidadeIdentica: 1,
      tipo: "Passageiro",                // ← o USUÁRIO decide. Nada fixo aqui.
      modelo: "GEP",
      normaProjeto: "NBR 16734 / NBR 5410",
      capacidadeKg: 630, capacidadePassageiros: 8,
      velocidade: 1.0,
      paradas: 3,
      casaDeMaquinas: "Superior",        // Superior | Inferior | Lateral | Sem casa de máquinas
      agrupamento: "Simplex",
      portaOposta: "Não",
    },
    // S = poço; cada pavimento tem a distância até o próximo nível.
    // A distância do ÚLTIMO pavimento é a última altura (K / overhead).
    poco: { profundidade: 1300, viga: 700 },
    pavimentos: [
      { rotulo: "-1", distancia: 3200, porta: "Frontal", parada: true, viga: "1600" },
      { rotulo: "0",  distancia: 3300, porta: "Frontal", parada: true, viga: "1650" },
      { rotulo: "1",  distancia: 4500, porta: "Frontal", parada: true, viga: "1500 - 3000" },
    ],
    caixa: {
      tipoEstrutura: "Concreto armado",
      largura: 1796,        // HW
      profundidade: 1810,   // HD
      percurso: 6500,       // P  (null = derivar dos pavimentos)
      ultimaAltura: null,   // K  (null = derivar do último pavimento)
    },
    cabina: {
      largura: 1100, profundidade: 1400, altura: 2500,   // CW / CD / CH
      tetoFalso: "--", piso: "--", corrimao: "--",
    },
    portas: {
      tipoAbertura: "Abertura central",
      modelo: "--",
      largura: 800, altura: 2100,        // OP / OPH
      soleiraLargura: 1000, soleiraAltura: 2200,  // SOW / SOH
      acabCabina: "--", acabPavimento: "--", classeCortaFogo: "--",
    },
    casaMaquinas: {
      largura: 1796, profundidade: 1810, altura: 2500,   // MRW / MRD / MRH
      alturaLivre: 2500, folga: 865,                     // C
      ganchoCapacidade: 2000,
    },
    eletrico: {
      tensaoPrincipal: "220V 60Hz", tensaoIluminacao: "220V 60Hz",
      fases: "Trifásico + N + PE",
      potenciaMotor: "4,6kW", correnteNominal: "10,4 A",
      disjuntorForca: "25A", disjuntorIluminacao: "10A",
      secaoForca: "6 mm²", secaoIluminacao: "2,5 mm²",
      potenciaIluminacao: "1,0kW",
      controle: "VVVF", efeitoTracao: "2:1", modeloMotor: "--",
    },
    engenharia: {
      guiaCabina: "T75", guiaContrapeso: "T75",
      contrapeso: { posicao: "traseiro", largura: 1016 },
      distanciaMaxSuportes: 2000, primeiroSuporte: 700, ultimoSuporte: 500,
      reacoes: { R: 16970, R1: 17170, R2: null, R3: null, R4: null, R5: null, U: 60240, V: 51990 },
      percursoMaximo: "--", pavimentosMaximo: "--",
    },
    botoeiras: { cop: "--", lop: "--" },
    opcionais: { ard: false, camera: false, anuncioVoz: false, exigenciasEspeciais: "" },
  };

  /* =========================================================
     resolve() — funde o payload herdado sobre o DEMO e deriva
     ========================================================= */
  function resolve(entrada) {
    const d = deepMerge(DEMO, entrada || {});
    const pav = Array.isArray(d.pavimentos) && d.pavimentos.length ? d.pavimentos : DEMO.pavimentos;

    // percurso: explícito, senão soma das distâncias exceto a última
    const somaPercurso = pav.slice(0, -1).reduce((s, p) => s + num(p.distancia, 0), 0);
    const percurso = num(d.caixa.percurso, somaPercurso) || somaPercurso;
    // última altura K: explícita, senão a distância do último pavimento
    const K = num(d.caixa.ultimaAltura, num(pav[pav.length - 1].distancia, 0));
    const S = num(d.poco.profundidade, 0);

    const paradas = num(d.equipamento.paradas, pav.filter(p => p.parada !== false).length);
    const portas = pav.filter(p => p.porta && p.porta !== "_" && p.porta !== "--").length;

    const codigo = or(d.documento.codigoEquipamento,
      `VP-${siglaTipo(d.equipamento.tipo)}-${num(d.equipamento.capacidadeKg, 0)}-${pad2(paradas)}-${percurso}`);

    const semCM = /sem casa/i.test(String(d.equipamento.casaDeMaquinas || ""));

    return Object.assign({}, d, {
      pavimentos: pav,
      derivado: {
        percurso, K, S,
        alturaTotal: S + percurso + K,
        paradas, portas, pisos: pav.length,
        codigo,
        semCasaMaquinas: semCM,
        tamanhoCabina: `${mm(d.cabina.largura)}x${mm(d.cabina.profundidade)}x${mm(d.cabina.altura)} mm`,
        tamanhoPorta: `${mm(d.portas.largura)} x ${mm(d.portas.altura)} mm`,
        capacidade: `${mm(d.equipamento.capacidadeKg)} kg / ${or(d.equipamento.capacidadePassageiros, "--")} Passageiros`,
        velocidade: isNum(num(d.equipamento.velocidade)) ? String(num(d.equipamento.velocidade)).replace(".", ",") + " m/s" : "--",
        enderecoLinha: [
          d.cliente.endereco.logradouro,
          d.cliente.endereco.cep ? "CEP: " + d.cliente.endereco.cep : null,
          d.cliente.endereco.cidade ? d.cliente.endereco.cidade + (d.cliente.endereco.uf ? " (" + d.cliente.endereco.uf + ")" : "") : null,
        ].filter(Boolean).join(" - "),
      },
    });
  }

  /* ---------- siglas (folha 6) ---------- */
  const SIGLAS = [
    ["HW", "LARGURA DA CAIXA DE CORRIDA"], ["CW", "LARGURA DA CABINE"],
    ["HD", "PROFUNDIDADE DA CAIXA DE CORRIDA"], ["CD", "PROFUNDIDADE DA CABINE"],
    ["K", "ÚLTIMA ALTURA"], ["CH", "ALTURA DA CABINE"],
    ["S", "PROFUNDIDADE DO POÇO"], ["OP", "LARGURA DA ABERTURA DE PORTA"],
    ["P", "PERCURSO"], ["OPH", "ALTURA DA ABERTURA DE PORTA"],
    ["SOW", "LARGURA DA PORTA DE ENTRADA"], ["BRW", "LARGURA DO CONTRAPESO"],
    ["SOH", "ALTURA DA PORTA DE ENTRADA"], ["MRH", "ALTURA DA CASA DE MÁQUINAS"],
  ];

  /* ---------- notas do carimbo ---------- */
  const NOTAS = [
    "As dimensões indicadas neste desenho serão consideradas definitivas para a fabricação e instalação, devendo ser rigorosamente observadas no preparo do local",
    "Todas as dimensões estão em mm",
    "O produto fornecido pela VerticalParts e o local de instalação atendem os requisitos da Norma NBR 16734 e NBR 5410",
    "As cargas indicadas em planta já possuem o coeficiente de segurança",
  ];

  /* ---------- notas de obra (folha 6) ---------- */
  const NOTAS_OBRA = [
    "A FONTE DE ALIMENTAÇÃO PRINCIPAL DEVE SER UM SISTEMA TRIFÁSICO DE CINCO FIOS, 220V, 60HZ. A VARIAÇÃO DE TENSÃO PERMITIDA É DE ±7%. O CLIENTE É RESPONSÁVEL POR LEVAR OS FIOS DE ALIMENTAÇÃO ATÉ A CAIXA DE ENERGIA DO ELEVADOR.",
    "O AR-CONDICIONADO E OUTROS DISPOSITIVOS DE VENTILAÇÃO DEVEM SER PROJETADOS E FORNECIDOS PELO CLIENTE.",
    "A TEMPERATURA DA CASA DE MÁQUINAS DEVE ESTAR ENTRE +5 °C E +40 °C; A UMIDADE RELATIVA NÃO DEVE ULTRAPASSAR 85% A 25 °C.",
    "A ILUMINAÇÃO DA CASA DE MÁQUINAS DEVE SER INSTALADA PELO USUÁRIO EM POSIÇÃO ADEQUADA; A ILUMINÂNCIA NÃO DEVE SER INFERIOR A 200 LUX.",
    "A CASA DE MÁQUINAS DEVE TER PASSAGEM E VENTILAÇÃO SUFICIENTES, SEM EQUIPAMENTOS, CABOS OU FUROS ALHEIOS AO ELEVADOR.",
    "A CASA DE MÁQUINAS DEVE SER À PROVA DE FOGO E DE POEIRA, E O PISO DEVE SUPORTAR 600 KG/m², EXCETO A VIGA DA MÁQUINA.",
    "A ESTRUTURA DA CAIXA DEVE SER DE CONCRETO E AÇO. EM VIGAS DE ANEL, O SUPORTE DA GUIA DEVE TER 300 MM DE ALTURA E A MESMA LARGURA DA VIGA.",
    "QUANDO A DISTÂNCIA ENTRE PORTAS DE PAVIMENTO FOR MAIOR QUE 11 M, O CLIENTE DEVERÁ INSTALAR PORTAS DE SEGURANÇA INTERMEDIÁRIAS.",
    "TOLERÂNCIA VERTICAL PERMITIDA: ELEVAÇÃO ≤ 30 m → 0 a +25 mm; 30 m < ELEVAÇÃO ≤ 60 m → 0 a +35 mm; ELEVAÇÃO > 60 m → 0 a +50 mm.",
    "FORA DA SOLEIRA DA PORTA DE PAVIMENTO, A MAIOR ESPESSURA PERMITIDA É DE 85 MM.",
    "O CLIENTE LEVA A LINHA DE ENERGIA ATÉ O LOCAL DO COMANDO INDICADO (ALTURA DO SOLO 1600 MM), RESERVANDO 3 M DE CABO COM MARCAÇÃO ADICIONAL.",
  ];

  window.VPDados = { DEMO, resolve, deepMerge, mm, num, or, up, pad2, siglaTipo, SIGLAS, NOTAS, NOTAS_OBRA };
})();
