/* ============================================================
   qc-respostas-calc.js — resumo legível das respostas do formulário público do Quadro de Comando
   (10/11/2026; spec docs/superpowers/specs/2026-11-10-quadro-link-por-pedido-pdf.md).
   Função pura, usada por três lugares (uma regra só, Art. 44):
   - a página pública (tela "Revisão" e o que se grava no link do pedido);
   - a tela do hub (mostra e corrige as linhas);
   - o PDF (pdf-bundle/qc-respostas-reactpdf.entry.js recebe estas mesmas linhas).
   O que se grava é a lista [[rótulo, valor], …] já pronta: o PDF não depende de catálogo nem do formulário de hoje.
   ============================================================ */
(function () {
  const VARIANTES_QUADRO = [
    { value: '7.5_220', label: '7,5 kW / 220 V' }, { value: '7.5_380', label: '7,5 kW / 380 V' },
    { value: '15_220', label: '15 kW / 220 V' }, { value: '15_380', label: '15 kW / 380 V' },
    { value: '30_380', label: '30 kW / 380 V' },
  ];
  const ACESSORIOS = [
    ['cop', 'COP — Botoeira de Cabina'], ['lop', 'LOP — Botoeira de Pavimento'],
    ['lip', 'LIP — Indicador de Posição sobre as Portas'], ['resgate', 'Resgate Automático (ARD)'],
    ['interfone', 'Interfone 5 Canais'], ['insp_cabina', 'Botoeira de Inspeção sobre a Cabina'],
    ['insp_poco', 'Botoeira de Inspeção no Fundo do Poço'], ['stop_poco', 'Botão de Stop para Acesso ao Poço'],
    ['gongo', 'Gongo'], ['anuncio_voz', 'Anúncio de Voz na Cabina'], ['sensor_foto', 'Sensor Fotoelétrico de Poço'],
    ['barreira_luz', 'Barreira de Luz (Cortina) da Porta'], ['pesador', 'Pesador de Carga'],
    ['camera', 'Câmera na Cabina'], ['maquina_tracao', 'Máquina de Tração'], ['portas', 'Portas de Cabina e Pavimento'],
  ];
  const LABELS = {
    modernizacao: 'Modernização', elevador_novo: 'Elevador Novo',
    residencial: 'Residencial', comercial: 'Comercial', hospitalar: 'Hospitalar', industrial: 'Industrial',
    simplex: 'Simplex', duplex: 'Duplex', triplex: 'Triplex', quadriplex: 'Quadriplex',
    manual: 'Manual', eixo_vertical: 'Eixo Vertical', simultanea: 'Simultânea', pantografica: 'Pantográfica',
    vvvf: 'VVVF', trifasico: 'Trifásico', monofasico: 'Monofásico', corr_continua: 'Corr. Contínua',
    bobina_tensao: 'Bobina — Tensão', tipo_bs: 'Tipo BS', moto_freio: 'Moto Freio', nao_possui: 'Não Possui',
    vf: 'VVVF — Inversor de Frequência', ca: 'CA — Por Contatores', hd: 'HD — Hidráulico',
    com_casa: 'Com Casa de Máquinas', sem_casa: 'Sem Casa de Máquinas',
    sem_encoder: 'Sem Encoder', com_encoder: 'Com Encoder',
  };
  const lbl = (v) => LABELS[v] || v || '—';

  function descricaoDe(lista, codigo) {
    const x = (lista || []).find((m) => m.codigo === codigo);
    return (x && x.descricao) || codigo;
  }

  /* f = estado do formulário; catalogo = { maquinas, portas_cabina, portas_pavimento }; totalLop = nº total de botoeiras LOP.
     Devolve [[rótulo, valor], …] sem linhas vazias. */
  function montarResumo(f, catalogo, totalLop) {
    f = f || {}; catalogo = catalogo || {};
    const ac = f.acessorios || {};
    const linhas = [
      ['Empresa', f.empresa], ['CNPJ', f.cnpj], ['Solicitante', f.solicitante], ['Telefone', f.telefone], ['E-mail', f.email || '—'],
      ['Obra / Referência', f.identificacao], ['Nº de Paradas', f.num_paradas], ['Tipo de Serviço', lbl(f.tipo_servico)],
      ['Modelo do Quadro', (VARIANTES_QUADRO.find((v) => v.value === f.variante_quadro) || {}).label || '—'],
      ['Tensão da Rede', f.tensao_rede === 'outro' ? `${f.tensao_rede_outro} V (outro)` : `${f.tensao_rede} V`],
      ['Tipo de Porta', lbl(f.tipo_porta)], ['Operador de Porta', lbl(f.operador_porta)],
      ['Tipo de Freio', lbl(f.tipo_freio) + (f.tensao_freio ? ` — ${f.tensao_freio} V` : '')],
      ['Acionamento', lbl(f.acionamento)], ['Casa de Máquinas', lbl(f.casa_maquinas)],
      ['Acessórios', ACESSORIOS.filter(([k]) => ac[k]).map(([, l]) => l).join(' · ') || 'Nenhum'],
      ...(ac.cop ? [['COP', f.cop_display === 'com' ? 'Com display' : 'Sem display']] : []),
      ...(ac.lop ? [
        ['LOP — material', f.lop_material === 'vidro' ? 'Espelho em vidro' : 'Aço escovado'],
        ['LOP — intermediários', (f.lop_botoes === '1' ? '1 botão' : '2 botões (▲ e ▼)') + (f.lop_display === 'com' ? ' · com display' : ' · sem display')],
        ['LOP — total de botoeiras', String(totalLop == null ? '' : totalLop)],
        ['LOP — logo', f.logo_arquivo ? f.logo_arquivo.nome : '—'],
      ] : []),
      ['Porta oposta', f.porta_oposta === 'sim' ? `Sim — andares ${(f.porta_oposta_paradas || []).join(', ')}` : 'Não'],
      ...(f.ind_cor ? [['Cor do display', ({ vermelho: 'Vermelho', azul: 'Azul', branco: 'Branco' })[f.ind_cor]]] : []),
      ...(f.maquina_codigo ? [['Máquina de Tração', descricaoDe(catalogo.maquinas, f.maquina_codigo)]] : []),
      ...(f.porta_cabina_codigo ? [['Porta de Cabina', descricaoDe(catalogo.portas_cabina, f.porta_cabina_codigo)]] : []),
      ...(f.porta_pavimento_codigo ? [['Porta de Pavimento', descricaoDe(catalogo.portas_pavimento, f.porta_pavimento_codigo)]] : []),
      ['Observações', f.observacoes || '—'],
      ['Fiação de Poço', f.fiacao_omitida ? 'Omitida — valores padrão' : `L1:${f.f_l1}m UA:${f.f_ua}m TR:${f.f_tr}m BP:${f.f_bp}m LIM:${f.f_lim}m FP:${f.f_fp}m`],
    ];
    return linhas.filter(([, v]) => v);
  }

  /* Aceita só o formato esperado ao ler do banco/editar: lista de pares de texto, tamanho limitado. */
  function normalizarResumo(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.slice(0, 80)
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [String(p[0] == null ? '' : p[0]).slice(0, 120), String(p[1] == null ? '' : p[1]).slice(0, 2000)])
      .filter((p) => p[0]);
  }

  function nomeArquivoPdf(numeroPedido) {
    const n = String(numeroPedido || '').replace(/[^0-9A-Za-z-]/g, '');
    return `Quadro-de-Comando-Pedido-${n || 'sem-numero'}.pdf`;
  }

  const api = { montarResumo, normalizarResumo, nomeArquivoPdf, VARIANTES_QUADRO, ACESSORIOS };
  if (typeof window !== 'undefined') window.QcRespostasCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
