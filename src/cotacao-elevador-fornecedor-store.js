/* ============================================================
   cotacao-elevador-fornecedor-store.js
   Envio do RFQ técnico de Unidades do Formulário de Elevadores para o
   fornecedor real (começando pela Glarie — "Elevator Inquiry Form" e
   "Homelift Inquiry Form"). Mesmo padrão de pedido-fornecedor-store.js:
   token público, link por WhatsApp/E-mail/Link, resposta do fornecedor
   grava direto no banco (sem PDF, sem digitação manual).
   window.CotacaoElevadorFornecedorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  function cotacaoUrl(token) {
    return `${window.location.origin}/cotacao-elevador-fornecedor/${encodeURIComponent(token)}`;
  }

  /* ---------- IP (auditoria leve, mesmo padrão do resto do app) ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }

  /* ---------- Categorias de produto — hoje só "elevador" (Glarie) tem
     formulário técnico implementado; as demais existem no modelo de dados
     pra quando entrarem os próximos fornecedores (mesmo sistema, sem criar
     um domínio novo tipo o Pedido a Fornecedor de peças). ---------- */
  const CATEGORIAS_PRODUTO = [
    { value: 'elevador', label: 'Elevador' },
    { value: 'escada_rolante', label: 'Escada Rolante' },
    { value: 'esteira_rolante', label: 'Esteira Rolante' },
    { value: 'quadro_comando', label: 'Quadro de Comando' },
    { value: 'porta', label: 'Porta' },
    { value: 'cabine', label: 'Cabine' },
  ];

  /* ---------- Rótulos (nomenclatura do fornecedor) — usados na tela pública
     e no resumo interno, a partir dos MESMOS valores já salvos na Unidade. ---------- */
  const CEF_LIFT_MODEL = {
    'Passageiro': 'Passenger Lift', 'Carga': 'Freight Lift',
    'Hospitalar': 'Hospital (Bed) Lift', 'Panorâmico': 'Sightseeing/Panoramic Lift',
  };
  function liftModelLabel(tipo) { return CEF_LIFT_MODEL[tipo] || tipo || ''; }

  function machineRoomLabel(casaMaquinas) {
    if (casaMaquinas === 'com') return 'Machine Room';
    if (casaMaquinas === 'sem') return 'Machine Room Less';
    return '';
  }

  const CEF_CONTROLE = { simplex: 'Simplex', duplex: 'Duplex', triplex: 'Triplex', group: 'Group Control' };
  function controleLabel(agrupamento) { return CEF_CONTROLE[agrupamento] || agrupamento || ''; }

  /* Tipo da Unidade → qual dos 2 formulários da Glarie enviar. */
  function tipoFormularioPara(tipo) { return tipo === 'Home Lift' ? 'homelift' : 'elevator'; }

  /* ---------- Especificação técnica por Unidade (fonte única) — usada tanto
     no portal público (monta a tabela PT/EN + coluna de divergência do
     fornecedor) quanto na revisão interna (traduz a chave de uma divergência
     de volta pro rótulo PT/EN). Cada linha tem uma `key` estável — é o campo
     usado em respostas.itens[].divergencias quando o fornecedor propõe um
     valor diferente do enviado pela VerticalParts. ---------- */
  function cefMm(v) { return (v === '' || v === null || v === undefined) ? '' : `${v}mm`; }
  function cefSimNao(v) { return v ? 'Sim / Yes' : 'Não / No'; }  // cefValorI18n acrescenta o chinês

  /* ---------- 06/10 — PT / EN / 中文 no que o fornecedor lê ----------
     Rótulos (por `key` da definição), títulos de seção e VALORES conhecidos.
     Só afeta a exibição pro fornecedor (unitSpecSecoes com {i18n:true}); a
     visão interna e o que fica gravado em dados_envio continuam como antes.
     Texto livre que o vendedor digitou e que não está no dicionário chega
     como foi digitado. Tradução do chinês feita por IA — sujeita a revisão. */
  const CEF_ZH_LABEL = {
    numero_elevador: '电梯编号', qtd_unidades: '相同电梯数量', modelo_elevador: '电梯型号', estrutura: '井道结构',
    casa_maquinas: '机房类型', capacidade: '额定载重', velocidade: '额定速度', andares_paradas_portas: '层/站/门',
    pavimentos_desc: '楼层标识', modelo_controle: '控制方式', tamanho_caixa: '井道尺寸（宽×深）', overhead: '顶层高度',
    poco: '底坑深度', percurso: '提升高度', porta_oposta: '贯通门（对开门）',
    cabina_largura: '轿厢宽度', cabina_profundidade: '轿厢深度', cabina_altura: '轿厢高度', teto_falso: '轿厢吊顶',
    piso_cabina: '轿厢地板', corrimao: '轿厢扶手',
    porta_tipo_abertura: '开门方式', porta_modelo: '门型号', porta_largura: '门宽', porta_altura: '门高',
    acabamento_porta_cabina: '轿门饰面', acabamento_porta_pavimento: '层门饰面', classe_corta_fogo: '防火等级',
    botoeira_cabine: '轿内操纵箱（COP）类型', botoeira_pavimento: '层站召唤箱（LOP）类型',
    ard: 'ARD 自动救援装置', camera: '轿厢摄像头', anuncio_voz: '语音报站', exigencias_especiais: '特殊要求',
    // Quadro de Comando
    quantidade_quadros: '相同控制柜数量', aplicacao: '应用', novo_modernizacao: '新装/改造',
    fabricante_desejado: '期望品牌', modelo_desejado: '期望型号', paradas: '站数',
    controle: '控制（单梯/双梯/群控）', tensao_rede: '电网电压', tipo_controle: '控制类型',
    regeneracao_energia: '能量回馈', tipo_maquina: '曳引机类型', potencia_kw: '曳引机额定功率',
    corrente_a: '曳引机额定电流', freio_tensao_acionamento: '制动器吸合电压', freio_tensao_manutencao: '制动器保持电压',
    tensao_limitador_mrl: '限速器电压（无机房）', cop_modelo_acabamento: '轿内操纵箱型号/饰面',
    lop_modelo_acabamento: '层站召唤箱型号/饰面', indicador_posicao_tipo: '位置显示器',
    chave_incendio_tipo: '消防开关（集成/独立）', interfone_5_canais: '五方对讲', gongo: '到站钟',
    pesador_carga: '称重装置', botoeira_inspecao_cabina: '轿顶检修盒', botoeira_inspecao_poco: '底坑检修盒',
    caixa_emergencia_poco: '底坑急停盒', ultima_altura: '顶层高度', distancia_quadro_maquina: '控制柜至曳引机距离',
    distancia_quadro_limitador: '控制柜至限速器距离', distancia_quadro_entrada_caixa: '控制柜至井道入口距离',
    cabo_paralelo: '并联电缆（双梯）',
  };
  const CEF_ZH_SECAO = {
    'A. Especificações Principais / Main Specification': 'A. 主要规格',
    'B. Cabine / Car': 'B. 轿厢',
    'C. Portas / Door': 'C. 门',
    'D. COP e LOP': 'D. 操纵箱与召唤箱（COP / LOP）',
    'E. Opcionais / Options': 'E. 选配项',
    'A. Identificação do pedido / Order Identification': 'A. 订单信息',
    'B. Especificação básica do elevador atendido / Base Lift Specification': 'B. 所服务电梯的基本规格',
    'C. Comando / Control Cabinet': 'C. 控制柜',
    'D. Máquina, freio e encoder / Machine, Brake & Encoder': 'D. 曳引机、制动器和编码器',
    'E. Botoeiras e interface humana / Human Interface': 'E. 操纵箱与人机界面',
    'F. Acessórios elétricos / Electric Accessories': 'F. 电气附件',
    'G. Geometria para fiação / Cable System Geometry': 'G. 布线几何尺寸',
  };
  /* valor PT (minúsculo, sem espaços nas pontas) → [EN, 中文] */
  const CEF_VALORES_I18N = {
    'sim': ['Yes', '是'], 'não': ['No', '否'], 'nao': ['No', '否'], 'nenhuma': ['None', '无'],
    'aço 304': ['Stainless steel 304', '304不锈钢'], 'aço 430': ['Stainless steel 430', '430不锈钢'],
    'pintado': ['Painted', '喷漆'],
    'central': ['Center opening', '中分门'], 'lateral': ['Side opening', '旁开门'],
    'telescópica': ['Telescopic', '双折门（伸缩门）'], 'telescopica': ['Telescopic', '双折门（伸缩门）'],
    'concreto': ['Concrete', '混凝土'], 'alvenaria': ['Masonry', '砖石'], 'aço': ['Steel', '钢结构'],
    'metálica': ['Metal structure', '钢结构'], 'metalica': ['Metal structure', '钢结构'],
    'home lift': ['Home Lift', '家用电梯'],
    'passenger lift': ['', '乘客电梯'], 'freight lift': ['', '载货电梯'],
    'hospital (bed) lift': ['', '医用（病床）电梯'], 'sightseeing/panoramic lift': ['', '观光电梯'],
    'machine room': ['', '有机房'], 'machine room less': ['', '无机房'],
    'simplex': ['', '单梯控制'], 'duplex': ['', '双梯并联'], 'triplex': ['', '三梯并联'], 'group control': ['', '群控'],
  };
  /* Opções do catálogo (o que é gravado na Unidade é o CÓDIGO). */
  const CEF_OPCOES_I18N = {
    'COP-004C': ['Aço Inox Escovado c/ IPD', 'Brushed stainless steel with IPD', '拉丝不锈钢，带IPD显示器'],
    'COP-05C': ['Totem em Aço Inox Escovado c/ IPD', 'Brushed stainless steel totem with IPD', '拉丝不锈钢立柱式，带IPD显示器'],
    'COP-17TFT10': ['Totem em Aço Inox Escovado c/ TFT 10"', 'Brushed stainless steel totem with 10" TFT', '拉丝不锈钢立柱式，带10寸TFT屏'],
    'COP-5TFT10': ['Totem em Aço Inox Escovado c/ IPD — TFT 10"', 'Brushed stainless steel totem with IPD — 10" TFT', '拉丝不锈钢立柱式，带IPD — 10寸TFT屏'],
    'COP-26': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”操纵箱（家用梯）'],
    'COP-27': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”操纵箱（家用梯）'],
    'COP-29': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”操纵箱（家用梯）'],
    'LOP-12C': ['Aço Inox Escovado c/ IPD', 'Brushed stainless steel with IPD', '拉丝不锈钢，带IPD显示器'],
    'LOP-35': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”召唤箱（家用梯）'],
    'LOP-36': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”召唤箱（家用梯）'],
    'LOP-41': ['Botoeira "Touch" (Homelift)', '"Touch" panel (Homelift)', '“触摸式”召唤箱（家用梯）'],
    'LOP-M7': ['Vidro branco c/ IPD Vermelho', 'White glass with red IPD', '白色玻璃面板，红色IPD显示器'],
    'CLIENTE': ['A ser instalado pelo cliente', 'To be installed by the customer', '由客户自行安装'],
    'PS-034': ['Mármore Resinado — padrão PS-034', 'Resin marble — pattern PS-034', '树脂大理石 — 花纹 PS-034'],
    'PS-035': ['Mármore Resinado — padrão PS-035', 'Resin marble — pattern PS-035', '树脂大理石 — 花纹 PS-035'],
    'PS-036': ['Mármore Resinado — padrão PS-036', 'Resin marble — pattern PS-036', '树脂大理石 — 花纹 PS-036'],
    'PS-037': ['Mármore Resinado — padrão PS-037', 'Resin marble — pattern PS-037', '树脂大理石 — 花纹 PS-037'],
    'PS-102': ['PVC Cinza', 'Grey PVC', '灰色PVC'],
    'PS-201': ['Aço Xadrez', 'Checkered steel plate', '花纹钢板'],
    'REBAIXO': ['Com rebaixo (sem piso de fábrica)', 'Recessed (no factory floor)', '地面下沉（不含出厂地板）'],
    'P-01': ['Aço Inox Escovado', 'Brushed stainless steel', '拉丝不锈钢'],
    'P-01-VIDRO': ['Aço Inox Escovado / Vidro', 'Brushed stainless steel / glass', '拉丝不锈钢 / 玻璃'],
    'P-100': ['Aço Inox Escovado (variante)', 'Brushed stainless steel (variant)', '拉丝不锈钢（变体）'],
    'P-301': ['Aço Pintado', 'Painted steel', '喷漆钢板'],
    'SUB-001': ['Aço Inox Escovado e Led', 'Brushed stainless steel and LED', '拉丝不锈钢及LED灯'],
    'SUB-230': ['Aço Inox Escovado e Led (variante dourada)', 'Brushed stainless steel and LED (gold variant)', '拉丝不锈钢及LED灯（金色款）'],
    'VPV-TETO-ACRILICO': ['Teto Acrílico em Led', 'Acrylic LED ceiling', 'LED亚克力吊顶'],
    'VPV-TETO-INOX': ['Teto Inox em Led', 'Stainless steel LED ceiling', 'LED不锈钢吊顶'],
  };
  function cefValorUm(t) {
    const k = String(t).trim();
    if (CEF_OPCOES_I18N[k]) { const [pt, en, zh] = CEF_OPCOES_I18N[k]; return `${k} — ${pt} / ${en} / ${zh}`; }
    const m = CEF_VALORES_I18N[k.toLowerCase()];
    if (!m) return null;
    const [en, zh] = m;
    return en ? `${k} / ${en} / ${zh}` : `${k} / ${zh}`;
  }
  /* "Sim / Yes" e "Não / No" (já bilíngues) e valores já com EN ganham só o chinês. */
  function cefValorI18n(v) {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (t === 'Sim / Yes') return 'Sim / Yes / 是';
    if (t === 'Não / No') return 'Não / No / 否';
    const um = cefValorUm(t);
    if (um) return um;
    const partes = t.split('/').map((x) => x.trim()).filter(Boolean);
    if (partes.length > 1) {
      const trad = partes.map(cefValorUm);
      if (trad.every(Boolean)) return trad.join(' ; ');
    }
    return v;
  }

  const CEF_SPEC_DEFS = [
    { key: 'numero_elevador', pt: 'Número do elevador', en: 'Lift No.', secao: 'A', get: (u) => u.identificador },
    { key: 'qtd_unidades', pt: 'Quantidade de unidades idênticas', en: 'Lift Units (Quantity)', secao: 'A', get: (u) => u.quantidade || 1 },
    { key: 'modelo_elevador', pt: 'Modelo do elevador', en: 'Lift Model', secao: 'A', onlyElevator: true, get: (u) => liftModelLabel(u.tipo) },
    { key: 'estrutura', pt: 'Estrutura do elevador', en: 'Shaft structure', secao: 'A', get: (u) => u.estrutura_caixa },
    { key: 'casa_maquinas', pt: 'Casa de máquinas', en: 'Machine Room Type', secao: 'A', onlyElevator: true, get: (u) => machineRoomLabel(u.casa_maquinas) },
    { key: 'capacidade', pt: 'Capacidade', en: 'Rated Capacity', secao: 'A', get: (u) => `${u.capacidade_pessoas ? u.capacidade_pessoas + 'pass / ' : ''}${u.capacidade_kg || ''}kg` },
    { key: 'velocidade', pt: 'Velocidade', en: 'Rated Speed', secao: 'A', get: (u) => u.velocidade_ms ? `${u.velocidade_ms}m/s` : '' },
    { key: 'andares_paradas_portas', pt: 'Andares/Paradas/Portas', en: 'Floors/Stops/Doors', secao: 'A', get: (u) => u.paradas ? `${u.paradas}/${u.paradas}/${u.paradas}` : '' },
    { key: 'pavimentos_desc', pt: 'Descrição dos pavimentos', en: 'Floor Marks', secao: 'A', get: (u) => u.pavimentos_desc },
    { key: 'modelo_controle', pt: 'Modelo de controle', en: 'Control Model', secao: 'A', onlyElevator: true, get: (u) => controleLabel(u.agrupamento) },
    { key: 'tamanho_caixa', pt: 'Tamanho da caixa', en: 'Shaft Size (W×D)', secao: 'A', get: (u) => (u.caixa_largura_mm || u.caixa_profundidade_mm) ? `${u.caixa_largura_mm || '?'} x ${u.caixa_profundidade_mm || '?'} mm` : '' },
    { key: 'overhead', pt: 'Última altura', en: 'Overhead', secao: 'A', get: (u) => cefMm(u.overhead_mm) },
    { key: 'poco', pt: 'Poço', en: 'Shaft Pit', secao: 'A', get: (u) => cefMm(u.poco_mm) },
    { key: 'percurso', pt: 'Percurso', en: 'Travel Height', secao: 'A', get: (u) => cefMm(u.percurso_mm) },
    { key: 'porta_oposta', pt: 'Porta oposta', en: 'Open-Through Door', secao: 'A', get: (u) => u.porta_oposta },

    { key: 'cabina_largura', pt: 'Largura da cabina', en: 'Car Width', secao: 'B', get: (u) => cefMm(u.cabina_largura_mm) },
    { key: 'cabina_profundidade', pt: 'Profundidade da cabina', en: 'Car Depth', secao: 'B', get: (u) => cefMm(u.cabina_profundidade_mm) },
    { key: 'cabina_altura', pt: 'Altura da cabina', en: 'Car Height', secao: 'B', get: (u) => cefMm(u.cabina_altura_mm) },
    { key: 'teto_falso', pt: 'Teto falso', en: 'Car Ceiling', secao: 'B', get: (u) => u.teto_falso },
    { key: 'piso_cabina', pt: 'Piso da cabina', en: 'Car Floor', secao: 'B', get: (u) => u.piso_cabina },
    { key: 'corrimao', pt: 'Corrimão', en: 'Car Handrail', secao: 'B', get: (u) => u.corrimao },

    { key: 'porta_tipo_abertura', pt: 'Tipo de abertura', en: 'Door Opening Type', secao: 'C', get: (u) => u.porta_tipo_abertura },
    { key: 'porta_modelo', pt: 'Modelo de porta', en: 'Door Model', secao: 'C', get: (u) => u.porta_modelo },
    { key: 'porta_largura', pt: 'Largura da porta', en: 'Door Width', secao: 'C', get: (u) => cefMm(u.porta_largura_mm) },
    { key: 'porta_altura', pt: 'Altura da porta', en: 'Door Height', secao: 'C', get: (u) => cefMm(u.porta_altura_mm) },
    { key: 'acabamento_porta_cabina', pt: 'Acabamento porta cabina', en: 'Car Door Finish', secao: 'C', get: (u) => u.acabamento_porta_cabina },
    { key: 'acabamento_porta_pavimento', pt: 'Acabamento porta pavimento', en: 'Landing Door Finish', secao: 'C', get: (u) => u.acabamento_porta_pavimento },
    { key: 'classe_corta_fogo', pt: 'Classe corta-fogo', en: 'Fire Rating', secao: 'C', get: (u) => u.classe_corta_fogo },

    { key: 'botoeira_cabine', pt: 'Botoeira de cabine (COP)', en: 'COP Type', secao: 'D', get: (u) => u.botoeira_cabine },
    { key: 'botoeira_pavimento', pt: 'Botoeira de pavimento (LOP)', en: 'LOP Type', secao: 'D', get: (u) => u.botoeira_pavimento },

    { key: 'ard', pt: 'ARD — resgate automático', en: 'ARD', secao: 'E', get: (u) => cefSimNao(u.ard) },
    { key: 'camera', pt: 'Câmera na cabine', en: 'Camera in Car', secao: 'E', get: (u) => cefSimNao(u.camera) },
    { key: 'anuncio_voz', pt: 'Anúncio de voz', en: 'Voice Announcement', secao: 'E', get: (u) => cefSimNao(u.anuncio_voz) },
    { key: 'exigencias_especiais', pt: 'Exigências especiais', en: 'Special Requirements', secao: 'E', get: (u) => u.exigencias_especiais },
  ];

  const CEF_SECAO_TITULO = {
    A: 'A. Especificações Principais / Main Specification',
    B: 'B. Cabine / Car',
    C: 'C. Portas / Door',
    D: 'D. COP e LOP',
    E: 'E. Opcionais / Options',
  };

  /* ---------- Especificação técnica — Quadro de Comando (Ramo B: comprar
     pronto de fornecedor). Mesmo padrão de CEF_SPEC_DEFS/CEF_SECAO_TITULO
     acima, só que a "unidade" aqui é um objeto sintético montado por
     QuadroComandoStore a partir de quadros_comando + _maquina + _geometria +
     _paradas (não uma linha de formularios_elevador_unidades). Campos
     combinados com o usuário em conversa antes de implementar. */
  function cefBool(v) { return v === true ? 'Sim / Yes' : v === false ? 'Não / No' : ''; }
  const CEF_SPEC_DEFS_QUADRO_COMANDO = [
    { key: 'quantidade_quadros', pt: 'Quantidade de quadros idênticos', en: 'Quantity (identical panels)', secao: 'A', get: (u) => u.quantidade_quadros || 1 },
    { key: 'aplicacao', pt: 'Aplicação', en: 'Application', secao: 'A', get: (u) => u.aplicacao },
    { key: 'novo_modernizacao', pt: 'Novo / Modernização', en: 'New / Modernization', secao: 'A', get: (u) => u.novo_modernizacao },
    { key: 'fabricante_desejado', pt: 'Fabricante desejado', en: 'Preferred Manufacturer', secao: 'A', get: (u) => u.fabricante_desejado },
    { key: 'modelo_desejado', pt: 'Modelo desejado', en: 'Preferred Model', secao: 'A', get: (u) => u.modelo_desejado },

    { key: 'capacidade', pt: 'Capacidade', en: 'Rated Capacity', secao: 'B', get: (u) => u.capacidade_kg ? `${u.capacidade_kg}kg` : '' },
    { key: 'velocidade', pt: 'Velocidade', en: 'Rated Speed', secao: 'B', get: (u) => u.velocidade_ms ? `${u.velocidade_ms}m/s` : '' },
    { key: 'paradas', pt: 'Paradas', en: 'Stops', secao: 'B', get: (u) => u.paradas },
    { key: 'porta_oposta', pt: 'Porta oposta', en: 'Open-Through Door', secao: 'B', get: (u) => cefBool(u.porta_oposta) },
    { key: 'controle', pt: 'Controle (simplex/duplex/grupo)', en: 'Control (simplex/duplex/group)', secao: 'B', get: (u) => u.controle },

    { key: 'tensao_rede', pt: 'Tensão de rede', en: 'Site Voltage', secao: 'C', get: (u) => u.tensao_rede ? `${u.tensao_rede}V trifásico / 3-phase` : '' },
    { key: 'tipo_controle', pt: 'Tipo de controle', en: 'Control Type', secao: 'C', get: (u) => u.tipo_controle },
    { key: 'ard', pt: 'ARD — resgate automático', en: 'ARD', secao: 'C', get: (u) => cefBool(u.ard) },
    { key: 'regeneracao_energia', pt: 'Regeneração de energia', en: 'Energy Regeneration', secao: 'C', get: (u) => cefBool(u.regeneracao_energia) },

    { key: 'tipo_maquina', pt: 'Tipo de máquina', en: 'Machine Type', secao: 'D', get: (u) => u.tipo_maquina },
    { key: 'potencia_kw', pt: 'Potência da máquina', en: 'Machine Rated Power', secao: 'D', get: (u) => u.potencia_kw ? `${u.potencia_kw}kW` : '' },
    { key: 'corrente_a', pt: 'Corrente da máquina', en: 'Machine Rated Current', secao: 'D', get: (u) => u.corrente_a ? `${u.corrente_a}A` : '' },
    { key: 'freio_tensao_acionamento', pt: 'Tensão de acionamento do freio', en: 'Brake Voltage', secao: 'D', get: (u) => u.freio_tensao_acionamento ? `${u.freio_tensao_acionamento}V` : '' },
    { key: 'freio_tensao_manutencao', pt: 'Tensão de manutenção do freio', en: 'Brake Maintain Voltage', secao: 'D', get: (u) => u.freio_tensao_manutencao ? `${u.freio_tensao_manutencao}V` : '' },
    { key: 'tensao_limitador_mrl', pt: 'Tensão do limitador de velocidade (MRL)', en: 'Machine-Roomless Speed Governor Voltage', secao: 'D', get: (u) => u.tensao_limitador_mrl },

    { key: 'cop_modelo_acabamento', pt: 'COP — modelo/acabamento', en: 'COP Model/Finish', secao: 'E', get: (u) => u.cop_modelo_acabamento },
    { key: 'lop_modelo_acabamento', pt: 'LOP — modelo/acabamento', en: 'LOP Model/Finish', secao: 'E', get: (u) => u.lop_modelo_acabamento },
    { key: 'indicador_posicao_tipo', pt: 'Indicador de posição', en: 'Position Indicator', secao: 'E', get: (u) => u.indicador_posicao_tipo },
    { key: 'chave_incendio_tipo', pt: 'Chave de incêndio (integrada/independente)', en: 'Fire Switch (integrated/independent)', secao: 'E', get: (u) => u.chave_incendio_tipo },

    { key: 'interfone_5_canais', pt: 'Interfone 5 canais', en: 'Five-way Intercom', secao: 'F', get: (u) => cefBool(u.interfone_5_canais) },
    { key: 'gongo', pt: 'Gongo', en: 'Arrival Gong', secao: 'F', get: (u) => cefBool(u.gongo) },
    { key: 'pesador_carga', pt: 'Pesador de carga', en: 'Weighing Device', secao: 'F', get: (u) => cefBool(u.pesador_carga) },
    { key: 'botoeira_inspecao_cabina', pt: 'Botoeira de inspeção — cabina', en: 'Car Top Inspection Box', secao: 'F', get: (u) => cefBool(u.botoeira_inspecao_cabina) },
    { key: 'botoeira_inspecao_poco', pt: 'Botoeira de inspeção — poço', en: 'Pit Inspection Box', secao: 'F', get: (u) => cefBool(u.botoeira_inspecao_poco) },
    { key: 'caixa_emergencia_poco', pt: 'Caixa de emergência do poço', en: 'Emergency Stop Box', secao: 'F', get: (u) => cefBool(u.caixa_emergencia_poco) },

    { key: 'percurso', pt: 'Percurso', en: 'Travel Height', secao: 'G', get: (u) => cefMm(u.percurso_mm) },
    { key: 'ultima_altura', pt: 'Última altura', en: 'Overhead', secao: 'G', get: (u) => cefMm(u.ultima_altura_mm) },
    { key: 'poco', pt: 'Poço', en: 'Shaft Pit', secao: 'G', get: (u) => cefMm(u.poco_mm) },
    { key: 'distancia_quadro_maquina', pt: 'Distância quadro → máquina', en: 'Panel to Machine Distance', secao: 'G', get: (u) => cefMm(u.distancia_quadro_maquina_mm) },
    { key: 'distancia_quadro_limitador', pt: 'Distância quadro → limitador', en: 'Panel to Governor Distance', secao: 'G', get: (u) => cefMm(u.distancia_quadro_limitador_mm) },
    { key: 'distancia_quadro_entrada_caixa', pt: 'Distância quadro → entrada da caixa', en: 'Panel to Shaft Entry Distance', secao: 'G', get: (u) => cefMm(u.distancia_quadro_entrada_caixa_mm) },
    { key: 'cabo_paralelo', pt: 'Cabo paralelo (duplex)', en: 'Parallel Cable', secao: 'G', get: (u) => cefBool(u.cabo_paralelo) },
  ];
  const CEF_SECAO_TITULO_QUADRO_COMANDO = {
    A: 'A. Identificação do pedido / Order Identification',
    B: 'B. Especificação básica do elevador atendido / Base Lift Specification',
    C: 'C. Comando / Control Cabinet',
    D: 'D. Máquina, freio e encoder / Machine, Brake & Encoder',
    E: 'E. Botoeiras e interface humana / Human Interface',
    F: 'F. Acessórios elétricos / Electric Accessories',
    G: 'G. Geometria para fiação / Cable System Geometry',
  };

  function cefDefsPorCategoria(categoriaProduto) {
    return categoriaProduto === 'quadro_comando'
      ? { defs: CEF_SPEC_DEFS_QUADRO_COMANDO, titulos: CEF_SECAO_TITULO_QUADRO_COMANDO }
      : { defs: CEF_SPEC_DEFS, titulos: CEF_SECAO_TITULO };
  }

  /* Retorna as seções já filtradas por tipo (elevator/homelift) e com linhas
     [key, pt, en, valor] — key é usado como campo estável de divergência.
     categoriaProduto (opcional, default 'elevador') escolhe qual conjunto
     de definições usar — CEF_SPEC_DEFS (elevador) ou
     CEF_SPEC_DEFS_QUADRO_COMANDO (quadro de comando comprado pronto). */
  function unitSpecSecoes(u, tipoFormulario, categoriaProduto, opts) {
    const i18n = !!(opts && opts.i18n);
    const { defs, titulos } = cefDefsPorCategoria(categoriaProduto);
    const isElevator = tipoFormulario === 'elevator';
    const porSecao = {};
    defs.forEach((d) => {
      if (d.onlyElevator && !isElevator) return;
      const valor = d.get(u);
      /* i18n: a linha ganha o rótulo em chinês (5º item) e o valor conhecido
         é traduzido; sem i18n nada muda (visão interna). */
      const linha = i18n
        ? [d.key, d.pt, d.en, cefValorI18n(valor), CEF_ZH_LABEL[d.key] || '']
        : [d.key, d.pt, d.en, valor];
      (porSecao[d.secao] = porSecao[d.secao] || []).push(linha);
    });
    return Object.keys(titulos).filter((sc) => porSecao[sc]).map((sc) => ({
      titulo: i18n && CEF_ZH_SECAO[titulos[sc]] ? `${titulos[sc]} / ${CEF_ZH_SECAO[titulos[sc]]}` : titulos[sc],
      linhas: porSecao[sc],
    }));
  }

  /* ---------- 06/10 — assunto e corpo do RFQ em PT-BR / EN-US / 中文 ----------
     Fonte única pro Formulário de Elevador e pro Quadro de Comando. */
  function mensagemRfq({ numeroDocumento, numeroTxt, descricaoPt, descricaoEn, descricaoZh, url, linkJaEnviadoEmDoisCanais }) {
    const subject = `Cotação técnica ${numeroDocumento} — VerticalParts | Technical quotation ${numeroDocumento} — VerticalParts | 技术询价 ${numeroDocumento} — VerticalParts`;
    const numEn = (numeroTxt || '').replace('Cotação Nº', 'Quotation No.');
    const numZh = (numeroTxt || '').replace('Cotação Nº', '询价编号');
    let text =
      `🇧🇷 Português (Brasil)\n` +
      `Solicitação de cotação técnica ${numeroDocumento}${numeroTxt || ''} — VerticalParts\n` +
      `Segue o link com as especificações ${descricaoPt} para cotação:\n${url}\n\n` +
      `🇺🇸 English (US)\n` +
      `Technical quotation request ${numeroDocumento}${numEn} — VerticalParts\n` +
      `Please find the link with the specifications ${descricaoEn} for quotation:\n${url}\n\n` +
      `🇨🇳 中文\n` +
      `技术询价请求 ${numeroDocumento}${numZh} — VerticalParts\n` +
      `请通过以下链接查看${descricaoZh}的规格并报价：\n${url}`;
    if (linkJaEnviadoEmDoisCanais) {
      text += `\n\n—\n` +
        `Este mesmo link foi enviado por WhatsApp e E-mail — responda por qualquer um dos dois, sem precisar repetir.\n` +
        `This same link was sent via WhatsApp and Email — please reply through either one, no need to repeat.\n` +
        `此链接已通过WhatsApp和邮件发送 — 您可以通过任一方式回复，无需重复填写。`;
    }
    return { subject, text };
  }

  function unitSpecFieldLabel(key, categoriaProduto) {
    const { defs } = cefDefsPorCategoria(categoriaProduto);
    const def = defs.find((d) => d.key === key);
    return def ? `${def.pt} / ${def.en}` : key;
  }

  /* ---------- Snapshot do que é enviado — Quadro de Comando (Ramo B).
     "unidades" aqui é sempre um array de 1 objeto sintético (o quadro em
     si não tem múltiplas variantes num mesmo envio). Guarda todos os
     campos que CEF_SPEC_DEFS_QUADRO_COMANDO.get() lê, sem mapear campo a
     campo feito buildDadosEnvio — é um objeto próprio, montado só por
     QuadroComandoStore, então não corre risco de vazar coluna interna de
     outra tabela. */
  function buildDadosEnvioQuadroComando(unidades, numeroCotacao) {
    const primeira = unidades[0] || {};
    return {
      header: {
        numero_cotacao: numeroCotacao ?? null,
        pais: 'Brazil',
        data: new Date().toISOString().slice(0, 10),
      },
      unidades: unidades.map((u) => ({ ...u })),
      _primeiraIdentificador: primeira.identificador,
    };
  }

  /* ---------- Snapshot do que é enviado (congela os dados no momento do
     envio — edições posteriores na Unidade não alteram o que já foi mandado) ---------- */
  function buildDadosEnvio(unidades, numeroCotacao) {
    const primeira = unidades[0] || {};
    return {
      header: {
        numero_cotacao: numeroCotacao ?? null,
        pais: 'Brazil',
        data: new Date().toISOString().slice(0, 10),
        tensao_principal: primeira.tensao_principal || '',
        tensao_iluminacao: primeira.tensao_iluminacao || '',
        norma_projeto: primeira.norma_projeto || '',
      },
      unidades: unidades.map((u) => ({
        unidade_id: u.id, identificador: u.identificador, tipo: u.tipo, modelo: u.modelo,
        indice_ativo: u.indice_ativo ?? null,
        quantidade: u.quantidade || 1,
        tracao: u.tracao,
        capacidade_kg: u.capacidade_kg, capacidade_pessoas: u.capacidade_pessoas,
        velocidade_ms: u.velocidade_ms, paradas: u.paradas, pavimentos_desc: u.pavimentos_desc,
        casa_maquinas: u.casa_maquinas, agrupamento: u.agrupamento, porta_oposta: u.porta_oposta,
        estrutura_caixa: u.estrutura_caixa, caixa_largura_mm: u.caixa_largura_mm, caixa_profundidade_mm: u.caixa_profundidade_mm,
        percurso_mm: u.percurso_mm, overhead_mm: u.overhead_mm, poco_mm: u.poco_mm,
        cabina_largura_mm: u.cabina_largura_mm, cabina_profundidade_mm: u.cabina_profundidade_mm, cabina_altura_mm: u.cabina_altura_mm,
        teto_falso: u.teto_falso, piso_cabina: u.piso_cabina, corrimao: u.corrimao,
        porta_tipo_abertura: u.porta_tipo_abertura, porta_modelo: u.porta_modelo,
        porta_largura_mm: u.porta_largura_mm, porta_altura_mm: u.porta_altura_mm,
        acabamento_porta_cabina: u.acabamento_porta_cabina, acabamento_porta_pavimento: u.acabamento_porta_pavimento,
        classe_corta_fogo: u.classe_corta_fogo,
        botoeira_cabine: u.botoeira_cabine, botoeira_pavimento: u.botoeira_pavimento,
        ard: u.ard, camera: u.camera, anuncio_voz: u.anuncio_voz, exigencias_especiais: u.exigencias_especiais,
      })),
    };
  }

  /* Código completo por equipamento (Fase 1 do Master ID): numero_documento
     da cotação já é [base]-[revisão] — só falta somar o índice do ativo.
     Ex.: numero_documento "VPEL-EL0902-A" + indice_ativo 1 = "VPEL-EL0902-A-1".
     Retorna null se a Unidade ainda não tem índice atribuído (dados antigos,
     de antes da Fase 1). */
  function assetMasterId(cot, indiceAtivo) {
    if (indiceAtivo == null) return null;
    return `${cot.numero_documento}-${indiceAtivo}`;
  }

  /* ---------- Gerar cotação (rascunho) ----------
     unidades: linhas de formularios_elevador_unidades já salvas (com id), todas
     do MESMO fornecedor e do mesmo tipo_formulario (elevator OU homelift).
     numeroCotacao: o Nº da Cotação do cliente (formularios_elevador.numero_cotacao,
     a mesma numeração que já vem sendo continuada desde a planilha histórica) —
     é o número que identifica o projeto pro fornecedor, equivalente ao "Project
     Name" que a Glarie usa nas próprias cotações.

     numero_documento agora segue o Master ID (Fase 1): [PREFIXO-TIPO][Nº
     da Cotação]-[REVISÃO], ex.: VPEL-EL0902, depois VPEL-EL0902-A se essa
     mesma categoria/formulário precisar de um 2º envio (troca de
     especificação, 2º tipo de formulário, outro fornecedor etc.) — a
     revisão é escopada por (formulário, categoria) pra nunca colidir,
     mesmo cobrindo motivos diferentes de reenvio. Cotações antigas
     (VPEL-0001..0003, formato sequencial simples) não são migradas. */
  async function gerar(formularioElevadorId, unidades, fornecedor, numeroCotacao, categoriaProduto) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const categoria = categoriaProduto || 'elevador';
    const ehQuadroComando = categoria === 'quadro_comando';
    const tipo_formulario = ehQuadroComando ? 'quadro_comando' : tipoFormularioPara(unidades[0].tipo);

    const { data: existentes, error: exErr } = await c.from('cotacoes_elevador_fornecedor')
      .select('revisao').eq('formulario_elevador_id', formularioElevadorId).eq('categoria_produto', categoria);
    if (exErr) throw exErr;
    const maiorRevisao = (existentes || []).reduce((max, r) => (r.revisao && r.revisao > max ? r.revisao : max), '');
    const revisao = (existentes && existentes.length) ? window.MasterIdEngine.proximaRevisao(maiorRevisao || null) : null;
    const numero_documento = window.MasterIdEngine.masterId({ categoriaProduto: categoria, numeroCotacao, revisao });

    const row = {
      numero_documento,
      revisao,
      token: shortToken(),
      formulario_elevador_id: formularioElevadorId,
      fornecedor,
      categoria_produto: categoria,
      tipo_formulario,
      unidade_ids: unidades.map((u) => u.id),
      dados_envio: ehQuadroComando ? buildDadosEnvioQuadroComando(unidades, numeroCotacao) : buildDadosEnvio(unidades, numeroCotacao),
      status: 'rascunho',
    };
    const { data, error } = await c.from('cotacoes_elevador_fornecedor').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  /* 10/09 — bug real: channel/recipient são campos únicos, sobrescritos a
     cada chamada. Enviar por WhatsApp pra um contato e depois por E-mail
     pra outro apagava o rastro do primeiro envio — quem checasse depois
     "pra quem foi enviado" via só o último clique. `envios` (jsonb array,
     migração cotacao_elevador_fornecedor_envios_historico) acumula todos;
     channel/recipient continuam gravando só o último, mantidos por
     compatibilidade (nada mais no código lê os dois hoje, mas não custa
     preservar). */
  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const { data: cur } = await c.from('cotacoes_elevador_fornecedor').select('envios').eq('id', id).maybeSingle();
    const envios = [...((cur && cur.envios) || []), { channel: channel || null, recipient: recipient || null, sent_at: now }];
    const { error } = await c.from('cotacoes_elevador_fornecedor').update({
      status: 'enviado', channel: channel || null, recipient: recipient || null,
      envios, sent_at: now, updated_at: now,
    }).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) {
      const cot = await getById(id);
      if (cot) window.EventosFluxo.registrar({
        evento: 'COTACAO_ENVIADA_FORNECEDOR',
        numeroCotacao: cot.dados_envio?.header?.numero_cotacao,
        alvoLabel: `${cot.fornecedor || 'Fornecedor'} · ${cot.numero_documento || ''}`, alvoId: cot.id,
        detalhe: { channel },
      });
    }
  }

  async function listarPorFormulario(formularioElevadorId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*').eq('formulario_elevador_id', formularioElevadorId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Tela "Cotações a Fornecedor" (todas categorias, todos fornecedores) ---------- */
  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*, formularios_elevador(numero_cotacao, local_obra_cidade, local_obra_estado, clientes(razao_social))')
      .is('excluido_em', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Exclusão com motivo (soft delete) ----------
     Nunca DELETE de verdade: precificacoes_elevador, tratativas_cotacao,
     projetos_elevador e cotacoes_elevador_fornecedor_anexos referenciam
     esta linha por FK — apagar quebraria ou arrastaria esses registros.
     "Excluir" aqui marca excluido_em/motivo_exclusao e a linha some da
     listagem (listarTodas já filtra), mas os dados ficam preservados
     pra auditoria. Pedido do usuário (27/08): exige justificativa antes
     de excluir. */
  async function excluirComMotivo(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da exclusão.');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    const now = new Date().toISOString();
    const { error } = await c.from('cotacoes_elevador_fornecedor').update({
      excluido_em: now, excluido_por: (window.__VP_USER || {}).email || null,
      motivo_exclusao: motivo.trim(), updated_at: now,
    }).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cotações a Fornecedor', acao: 'Excluiu cotação',
      alvo: cur.numero_documento, alvo_id: id, detalhe: { motivo: motivo.trim(), fornecedor: cur.fornecedor },
    });
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* ---------- Decisão interna pós-resposta do fornecedor: time decide seguir
     com a compra (em_analise) e depois confirma a compra (aprovada). ---------- */
  async function decidirComprar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'respondido') return cur;
    const numeroCotacao = cur.dados_envio?.header?.numero_cotacao;
    // Gate: só inicia a compra na China depois do Financeiro confirmar o
    // sinal pago — ver aval-financeiro-store.js.
    if (window.AvalFinanceiroStore) {
      const gate = await window.AvalFinanceiroStore.podeIniciarCompra(numeroCotacao);
      if (!gate.ok) throw new Error(gate.motivo);
    }
    const now = new Date().toISOString();
    const patch = { status: 'em_analise', decidido_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'COMPRA_FORNECEDOR_INICIADA', numeroCotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  async function aprovar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'em_analise') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'aprovada', aprovado_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'COMPRA_FORNECEDOR_CONFIRMADA',
      numeroCotacao: cur.dados_envio?.header?.numero_cotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* ---------- Rótulos/cores de status — usados tanto no modal de envio
     (dentro do Formulário de Elevadores) quanto na tela de Cotações a
     Fornecedor, pra não duplicar a mesma tabela em dois arquivos. ---------- */
  const STATUS_LABEL = {
    rascunho: 'Rascunho', enviado: 'Enviado', visualizado: 'Visualizado',
    respondido: 'Respondido', em_analise: 'Em análise', aprovada: 'Aprovada', expirado: 'Expirado',
  };
  const STATUS_COR = {
    rascunho: '#64748b', enviado: '#2563eb', visualizado: '#b45309',
    respondido: '#059669', em_analise: '#7c3aed', aprovada: '#15803d', expirado: '#9f1239',
  };

  /* Rótulo agrupado (spec 3.3.1 — "Ciclo de status"): rascunho/enviado/
     visualizado colapsam em "Aguardando", os demais viram seu próprio
     grupo. Fonte única — antes cotacoes-fornecedor.jsx (CF_AGUARDANDO) e
     precificacao-elevador.jsx (PZ_STATUS_COTACAO_LABEL) mantinham cada um
     sua própria cópia, esse último com um comentário admitindo a
     duplicata sem resolvê-la. */
  const STATUS_GROUP_LABEL = {
    rascunho: 'Aguardando', enviado: 'Aguardando', visualizado: 'Aguardando',
    respondido: 'Recebida', em_analise: 'Em análise', aprovada: 'Aprovada',
  };
  function statusGroupLabel(status) { return STATUS_GROUP_LABEL[status] || STATUS_LABEL[status] || status; }

  /* ---------- Fila da Importação: compras confirmadas no fornecedor que ainda
     não viraram embarque. O embarque (importação) nasce quando a compra ao
     fornecedor é decidida/aprovada (em_analise/aprovada) — não no sinal pago,
     que é só o cliente pagando a entrada. Sem esta ponte, uma compra iniciada
     ficava invisível na Importação (achado E2E reteste D). ---------- */
  async function listarComprasAguardandoEmbarque() {
    const c = sb(); if (!c) return [];
    const { data: cots } = await c.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, formulario_elevador_id, status, respostas, decidido_em, aprovado_em')
      .in('status', ['em_analise', 'aprovada']).eq('categoria_produto', 'elevador');
    if (!cots || !cots.length) return [];
    const { data: emb } = await c.from('embarques').select('cotacao_fornecedor_id');
    const comEmbarque = new Set((emb || []).map((x) => x.cotacao_fornecedor_id).filter(Boolean));
    const pendentes = cots.filter((x) => !comEmbarque.has(x.id));
    if (!pendentes.length) return [];
    const formIds = [...new Set(pendentes.map((x) => x.formulario_elevador_id).filter(Boolean))];
    const { data: forms } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, clientes(razao_social)').in('id', formIds);
    const formById = {}; (forms || []).forEach((f) => { formById[f.id] = f; });
    return pendentes.map((x) => {
      const form = formById[x.formulario_elevador_id] || {};
      const respostas = x.respostas || {};
      const fobUsd = (respostas.itens || []).reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);
      return {
        cotacaoFornecedorId: x.id,
        numeroDocumento: x.numero_documento,
        numeroCotacao: form.numero_cotacao ?? null,
        fornecedor: x.fornecedor,
        clienteNome: (form.clientes && form.clientes.razao_social) || null,
        fobUsd,
        status: x.status,
        quando: x.aprovado_em || x.decidido_em,
      };
    }).sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')));
  }

  /* ---------- Portal público (/cotacao-elevador-fornecedor/:token) ---------- */
  async function getByToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  async function marcarVisualizado(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'visualizado', viewed_at: now, updated_at: now };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    return { ...cur, ...patch };
  }

  /* Traduz a "Confirmação técnica" do fornecedor pra português — chamado
     no momento de salvar a resposta (uma vez só, fica gravado). Devolve
     null quando o texto já está em PT-BR (a Edge Function decide isso),
     ou quando a tradução falha — nesse caso NÃO bloqueia o envio, o
     fornecedor não pode ficar travado por causa de um serviço de IA
     instável, só fica sem a linha traduzida. */
  const VP_TRANSLATE_URL = 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/vp-translate-to-pt';
  const VP_TRANSLATE_ANON_KEY = 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP';
  async function traduzirConfirmacaoTecnica(text) {
    if (!text || !text.trim()) return null;
    try {
      const res = await fetch(VP_TRANSLATE_URL, {
        method: 'POST',
        headers: { apikey: VP_TRANSLATE_ANON_KEY, Authorization: 'Bearer ' + VP_TRANSLATE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.translated || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Histórico de PREÇO do fornecedor (07/10/2026) ----------
     `respostas` é sobrescrita a cada nova resposta (formulário do link reaberto ou registro por e-mail com
     "substituir"), então o preço anterior se perdia. Aqui compara antes × depois e grava UMA linha em vp_logs
     (alvo_id = id desta cotação) com de → para; a linha do tempo das Tratativas (TratativasStore.listarHistoricoInterno)
     lê isso. Só registra se algo mudou (ou na 1ª vez que há preço). Best-effort: nunca quebra o fluxo de resposta. */
  function precosDe(r) {
    const out = {};
    if (!r) return out;
    (r.itens || []).forEach((i) => {
      const nome = i.unidade_identificador || i.unidade_id || 'Equipamento';
      if (i.preco_unitario !== '' && i.preco_unitario != null && !isNaN(Number(i.preco_unitario))) out[nome + ' (preço unitário)'] = Number(i.preco_unitario);
    });
    [['frete_internacional_usd', 'Frete internacional (US$)'], ['taxas_extras_usd', 'Taxas extras (US$)']].forEach(([k, nome]) => {
      if (r[k] !== '' && r[k] != null && !isNaN(Number(r[k]))) out[nome] = Number(r[k]);
    });
    return out;
  }
  function diffPrecos(antes, depois) {
    const a = precosDe(antes), d = precosDe(depois);
    const nomes = [...new Set([...Object.keys(a), ...Object.keys(d)])];
    const itens = nomes.filter((n) => a[n] !== d[n]).map((n) => ({ nome: n, antes: a[n] ?? null, depois: d[n] ?? null }));
    return { itens, primeira: !Object.keys(a).length && Object.keys(d).length > 0 };
  }
  function registrarMudancaPreco(cur, novas, extra) {
    try {
      if (!window.VPLog || !cur) return;
      const { itens, primeira } = diffPrecos(cur.respostas, novas);
      if (!itens.length) return;
      window.VPLog.registrar(Object.assign({
        modulo: 'Cotação a Fornecedor',
        acao: primeira ? 'Fornecedor informou os preços' : 'Preço do fornecedor atualizado',
        alvo: cur.numero_documento, alvo_id: cur.id,
        detalhe: { moeda: (novas && novas.moeda) || (cur.respostas && cur.respostas.moeda) || 'USD', itens },
      }, extra || {}));
    } catch (e) { console.warn('[CotacaoFornecedor] histórico de preço falhou', e); }
  }

  /* respostas = { moeda, incoterm_porto, condicoes_pagamento, prazo_fabricacao,
     garantia, validade_dias, embalagem, container_no, documentos_embarque,
     observacoes_gerais, itens:[{unidade_id, modelo_fornecedor, floors_stops_doors,
     preco_unitario, preco_total, confirmacao_tecnica, confirmacao_tecnica_pt}] } */
  async function salvarResposta(token, respostas) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    // Traduz cada "confirmação técnica" em paralelo — não atrasa o envio
    // sequencialmente item a item, e nunca bloqueia se a IA falhar.
    if (Array.isArray(respostas.itens) && respostas.itens.length) {
      await Promise.all(respostas.itens.map(async (it) => {
        if (it && it.confirmacao_tecnica) {
          it.confirmacao_tecnica_pt = await traduzirConfirmacaoTecnica(it.confirmacao_tecnica);
        }
      }));
    }
    const ip = await getPublicIP();
    const now = new Date().toISOString();
    const payload = { ...respostas, _meta: { ip, ua: navigator.userAgent, respondido_em: now } };
    /* Câmbio USD/BRL congelado no exato momento em que o fornecedor
       respondeu (pedido do usuário, 27/08) — base pra comparar depois
       "câmbio no dia da cotação" vs. "câmbio agora" na Precificação.
       Nunca bloqueia o envio se a API de câmbio falhar. */
    let cambioNaResposta = null;
    try { cambioNaResposta = (await window.CambioAPI.buscarUsdBrl()).valor; } catch (e) { /* segue sem — Precificação fica sem o congelado */ }
    const patch = {
      status: 'respondido', respostas: payload, responded_at: now, updated_at: now,
      cambio_na_resposta_usd_brl: cambioNaResposta,
    };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    registrarMudancaPreco(cur, respostas, { ator_nome: cur.fornecedor || 'Fornecedor', ator_setor: 'fornecedor' });
    if (window.VPLog) window.VPLog.registrar({
      ator_nome: cur.fornecedor || 'Fornecedor', ator_setor: 'fornecedor',
      modulo: 'Formulário de Elevadores', acao: 'respondeu a cotação de fornecedor',
      alvo: cur.numero_documento, alvo_id: cur.id, detalhe: { ip },
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FORNECEDOR_RESPONDEU',
      numeroCotacao: cur.dados_envio?.header?.numero_cotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* ---------- Resposta do fornecedor REGISTRADA A PARTIR DE UM E-MAIL (Inbox, 04/10/2026) ----------
     O fornecedor respondeu por e-mail em vez do link. Uma pessoa confere os valores propostos pelo Inbox (src/inbox-preco*.js) e
     confirma: aqui grava no MESMO formato do formulário (`salvarResposta`) — status 'respondido', câmbio congelado, evento
     FORNECEDOR_RESPONDEU (fecha a etapa de espera) —, mas com _meta.origem = 'email' (sem IP/navegador do fornecedor) e quem registrou.
     Não sobrescreve resposta já dada pelo formulário, a menos que `substituir` seja pedido explicitamente. */
  async function registrarRespostaPorEmail(id, respostas, opcoes) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação do fornecedor não encontrada.');
    const o = opcoes || {};
    if (cur.status === 'respondido' && !o.substituir) throw new Error('Este fornecedor já respondeu pelo formulário — confirme "substituir" para atualizar.');
    const now = new Date().toISOString();
    const payload = { ...respostas, _meta: { origem: 'email', email_id: o.emailId || null, registrado_por: o.por || null, respondido_em: now, ...(cur.respostas && cur.respostas._meta && cur.status === 'respondido' ? { substitui: cur.respostas._meta } : {}) } };
    let cambioNaResposta = cur.cambio_na_resposta_usd_brl ?? null;
    try { cambioNaResposta = (await window.CambioAPI.buscarUsdBrl()).valor; } catch (e) { /* segue sem câmbio novo */ }
    const patch = { status: 'respondido', respostas: payload, responded_at: now, updated_at: now, cambio_na_resposta_usd_brl: cambioNaResposta };
    const { data, error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Não consegui gravar a resposta (nenhuma linha alterada).');
    registrarMudancaPreco(cur, respostas);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Formulário de Elevadores', acao: 'Registrou a resposta do fornecedor a partir de um e-mail',
      alvo: cur.numero_documento, alvo_id: cur.id, detalhe: { email_id: o.emailId || null, substituiu: cur.status === 'respondido' },
    });
    if (window.EventosFluxo && cur.status !== 'respondido') window.EventosFluxo.registrar({
      evento: 'FORNECEDOR_RESPONDEU',
      numeroCotacao: cur.dados_envio?.header?.numero_cotacao,
      alvoLabel: `${cur.fornecedor || 'Fornecedor'} · ${cur.numero_documento || ''}`, alvoId: cur.id,
    });
    return { ...cur, ...patch };
  }

  /* ---------- Anexos da resposta do Fornecedor (PDF/DWG/imagens) ----------
     Bucket privado cotacao-fornecedor-anexos — mesmo padrão de bucket
     privado + URL assinada de formulario-elevador-store.js (FEA_BUCKET).
     Vinculados à cotação inteira (não por unidade). */
  const CEF_ANEXOS_BUCKET = 'cotacao-fornecedor-anexos';

  function cef_slugify(s) {
    return String(s || 'arquivo')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || 'arquivo';
  }

  async function listarAnexosResposta(cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('cotacoes_elevador_fornecedor_anexos')
      .select('*').eq('cotacao_fornecedor_id', cotacaoFornecedorId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function anexarArquivoResposta(cotacaoFornecedorId, file) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const nomeSeguro = cef_slugify(file.name);
    const path = `${cotacaoFornecedorId}/${Date.now()}-${nomeSeguro}`;
    const { error: upErr } = await c.storage.from(CEF_ANEXOS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (upErr) throw upErr;
    const { data, error } = await c.from('cotacoes_elevador_fornecedor_anexos').insert({
      cotacao_fornecedor_id: cotacaoFornecedorId,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      tipo_arquivo: file.type || null,
      path,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function urlAssinadaAnexoResposta(path, ttlSeconds) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(CEF_ANEXOS_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async function removerAnexoResposta(anexo) {
    const c = sb(); if (!c || !anexo) return;
    if (anexo.path) await c.storage.from(CEF_ANEXOS_BUCKET).remove([anexo.path]);
    await c.from('cotacoes_elevador_fornecedor_anexos').delete().eq('id', anexo.id);
  }

  /* ---------- Anexos do Formulário (VerticalParts) direcionados ao Fornecedor ----------
     Mesma tabela/bucket de formulario-elevador-store.js (formularios_elevador_anexos
     / bucket formulario-elevador-anexos, categoria='fornecedor') — lidos direto aqui
     pra não precisar carregar o store inteiro do Formulário na página pública. */
  const FORM_ANEXOS_BUCKET = 'formulario-elevador-anexos';

  async function listarAnexosFormulario(formularioId) {
    const c = sb(); if (!c || !formularioId) return [];
    const { data, error } = await c.from('formularios_elevador_anexos')
      .select('*').eq('formulario_id', formularioId).eq('categoria', 'fornecedor').order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async function urlAssinadaAnexoFormulario(path, ttlSeconds) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.storage.from(FORM_ANEXOS_BUCKET).createSignedUrl(path, ttlSeconds || 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  window.CotacaoElevadorFornecedorStore = {
    cotacaoUrl, tipoFormularioPara, liftModelLabel, machineRoomLabel, controleLabel,
    CATEGORIAS_PRODUTO, STATUS_LABEL, STATUS_COR, STATUS_GROUP_LABEL, statusGroupLabel,
    unitSpecSecoes, unitSpecFieldLabel, assetMasterId, mensagemRfq, cefValorI18n,
    listarAnexosResposta, anexarArquivoResposta, urlAssinadaAnexoResposta, removerAnexoResposta,
    listarAnexosFormulario, urlAssinadaAnexoFormulario,
    gerar, marcarEnviado, listarPorFormulario, listarTodas, getById,
    getByToken, marcarVisualizado, salvarResposta, registrarRespostaPorEmail, getPublicIP,
    decidirComprar, aprovar, listarComprasAguardandoEmbarque, excluirComMotivo, diffPrecos,
  };
}());
