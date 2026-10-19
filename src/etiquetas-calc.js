/* ============================================================
   etiquetas-calc.js — Logística Interna · Etiquetas (regras puras: sem tela, sem rede, sem banco).
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md
   O que mora aqui:
   - endereço do almoxarifado (R<rua><vão><nível>, ex. R2A4; EXP = área de expedição) e o dígito verificador (DV);
   - modelos padrão de etiqueta (layout em milímetros, igual para qualquer impressora);
   - renderizador ZPL II (impressoras Zebra e compatíveis) e renderizador SVG (pré-visualização e impressão pelo navegador).
   Regras que existem por motivo:
   - Fase 4: PALETE (QR PAL:), ID-TAG (QR EQP:), OP_QUADRO (QR OP:), AVARIA (QR = código do item). Os 3 prefixos novos precisam estar na issue #862.
   - Fase 2: RECEBIMENTO (QR = código do item) e SEPARACAO (QR = PED:<pedido>, formato novo -> registrar na issue #862).
   - O CONTRATO com o app de estoque não muda: item = QR e Code 128 com o `codigo` exato; endereço = QR "END:" + código.
     Formato novo de QR exige comentário na issue #862 ANTES de mudar (spec do app, 3.4). O DV nunca entra no QR.
   - DV = (rua×3 + vão×5 + nível×7) mod 10, vão A=1 … J=10. Fórmula PROPOSTA, ainda não aprovada pelo Gelson: por isso o DV nasce
     DESLIGADO na tela. Mude só em DV_PESOS e imprima as etiquetas DEPOIS de aprovar (etiqueta antiga ficaria com o DV da regra velha).
   - ZPL: acentos saem como bytes UTF-8 em hexadecimal (^FH, _C3_A7 = ç) com ^CI28, independente de como o agente local codifica o
     texto. Se a impressora não aceitar UTF-8, o perfil liga "sem acentos" (acento é removido; nunca vira lixo).
   - QR e Code 128 são SEMPRE nativos da impressora (leitura mais confiável que imagem).
   window.EtiquetasCalc
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Endereço ---------- */
  const END_RE = /^R([1-4])([A-J])([1-8])$/;
  const VAOS = 'ABCDEFGHIJ';
  const DV_PESOS = { rua: 3, vao: 5, nivel: 7 };

  // Igual ao estoque_endereco_normalizar do banco: tira "END:", põe em maiúscula, tira espaços.
  function normalizarEndereco(texto) {
    return String(texto == null ? '' : texto).replace(/^\s*END:\s*/i, '').replace(/\s+/g, '').toUpperCase();
  }
  // null = endereço que não existe. Mesmas regras da constraint de estoque_enderecos: Rua 1 e Rua 4 só têm nível ímpar
  // (porta-palete à esquerda); a Rua 1 só vai até o vão I.
  function parseEndereco(texto) {
    const c = normalizarEndereco(texto);
    if (c === 'EXP') return { codigo: 'EXP', tipo: 'expedicao', rua: null, vao: null, nivel: null, lado: null };
    const m = END_RE.exec(c);
    if (!m) return null;
    const rua = Number(m[1]), vao = m[2], nivel = Number(m[3]);
    if (!(rua === 2 || rua === 3 || nivel % 2 === 1)) return null;
    if (rua === 1 && vao === 'J') return null;
    return { codigo: c, tipo: 'posicao', rua, vao, nivel, lado: nivel % 2 === 1 ? 'esquerda' : 'direita' };
  }
  function dvEndereco(texto) {
    const e = parseEndereco(texto);
    if (!e || e.tipo !== 'posicao') return null;
    return (e.rua * DV_PESOS.rua + (VAOS.indexOf(e.vao) + 1) * DV_PESOS.vao + e.nivel * DV_PESOS.nivel) % 10;
  }
  function textoEndereco(texto) {
    const e = parseEndereco(texto);
    if (!e) return '';
    if (e.tipo === 'expedicao') return 'Área de expedição';
    return `Rua ${e.rua} · Vão ${e.vao} · Nível ${e.nivel}`;
  }
  // As 236 posições + EXP (mesma carga da migration 20261017120000). Serve de conferência e de plano B se a tabela não responder.
  function todosEnderecos() {
    const out = [];
    for (let rua = 1; rua <= 4; rua++) for (const vao of VAOS) for (let nivel = 1; nivel <= 8; nivel++) {
      const e = parseEndereco(`R${rua}${vao}${nivel}`);
      if (e) out.push(e);
    }
    out.push(parseEndereco('EXP'));
    return out;
  }

  /* ---------- Dados que alimentam os modelos ---------- */
  function dadosEndereco(texto, opcoes) {
    const e = parseEndereco(texto);
    if (!e) throw new Error(`Endereço inexistente: ${texto}`);
    const comDv = !!(opcoes && opcoes.dv);
    const dv = comDv ? dvEndereco(e.codigo) : null;
    return {
      codigo: e.codigo,
      descricao_local: textoEndereco(e.codigo),
      lado_texto: e.lado === 'esquerda' ? 'LADO ESQUERDO' : e.lado === 'direita' ? 'LADO DIREITO' : '',
      dv_texto: dv == null ? '' : `DV ${dv}`,
      qr: `END:${e.codigo}`,
      barras: e.codigo,
    };
  }
  function dadosItem(p) {
    const codigo = String(p.codigo || '').trim();
    const unidade = String(p.unidade || '').trim();
    const familia = String(p.familia || '').trim();
    return {
      codigo,
      descricao: String(p.descricao || '').trim(),
      linha_unidade: [unidade, familia && `Família ${familia}`].filter(Boolean).join(' · '),
      endereco_txt: p.endereco ? `End.: ${String(p.endereco).trim()}` : '',
      qr: codigo,
      barras: codigo,
    };
  }

  // Recebimento: carga que chegou. QR = código do item (mesmo contrato do tipo ITEM, nenhum formato novo).
  function dadosRecebimento(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    const qtd = r.quantidade != null && r.quantidade !== '' ? `Qtd: ${t(r.quantidade)}${t(r.unidade) ? ' ' + t(r.unidade) : ''}` : '';
    return {
      titulo: `ENTRADA ${t(r.data)}`.trim(),
      origem: [t(r.embarque) && `Embarque ${t(r.embarque)}`, t(r.pi) && `P.I. ${t(r.pi)}`].filter(Boolean).join(' · '),
      fornecedor: t(r.fornecedor) ? `Fornecedor: ${t(r.fornecedor)}` : '',
      codigo: t(r.codigo),
      descricao: t(r.descricao),
      quantidade_txt: qtd,
      nf_txt: t(r.nf) ? `NF: ${t(r.nf)}` : '',
      conferencia: 'Conf.: ___ / ___',
      qr: t(r.codigo),
      barras: t(r.codigo),
    };
  }
  // Separação: volume n/N de um pedido de venda do Omie, rumo à área EXP. QR = "PED:<nº do pedido>" (formato NOVO: registrar na issue #862).
  function dadosSeparacao(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    const pedido = t(r.pedido);
    const total = Math.max(1, Math.floor(Number(r.total_volumes) || 1));
    const vol = Math.max(1, Math.min(total, Math.floor(Number(r.volume) || 1)));
    return {
      pedido_txt: `PEDIDO ${pedido}`,
      volume_txt: `VOL ${vol} / ${total}`,
      cliente_txt: t(r.cliente) ? `Cliente: ${t(r.cliente)}` : '',
      destino_txt: 'Destino: EXP',
      separador_txt: t(r.separador) ? `Separado por: ${t(r.separador)}` : '',
      data_txt: t(r.data),
      qr: `PED:${pedido}`,
      barras: pedido,
    };
  }

  // Palete: QR = "PAL:<código do palete>" (formato NOVO, registrado na issue #862). itens = [{codigo, quantidade, unidade}].
  function dadosPalete(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    const itens = (r.itens || []).filter((i) => t(i.codigo));
    const mostra = itens.slice(0, 6).map((i) => `${t(i.codigo)} x${t(i.quantidade) || '?'}`);
    const resto = itens.length - mostra.length;
    const codigo = t(r.codigo).toUpperCase();
    return {
      titulo: 'PALETE',
      codigo,
      origem: [t(r.embarque) && `Embarque ${t(r.embarque)}`, t(r.pi) && `P.I. ${t(r.pi)}`].filter(Boolean).join(' · '),
      data_txt: t(r.data) ? `Chegada: ${t(r.data)}` : '',
      itens_txt: mostra.join(' · ') + (resto > 0 ? ` · +${resto} item(ns)` : ''),
      total_txt: `${itens.length} item(ns)`,
      qr: `PAL:${codigo}`,
      barras: codigo,
    };
  }
  // ID-TAG do equipamento (elevador): QR = "EQP:<código>" (formato NOVO).
  function dadosIdTag(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    const codigo = t(r.codigo).toUpperCase();
    return {
      titulo: 'ID-TAG EQUIPAMENTO',
      codigo,
      cliente_txt: t(r.cliente),
      obra_txt: [t(r.predio), [t(r.cidade), t(r.uf)].filter(Boolean).join('/')].filter(Boolean).join(' · '),
      cotacao_txt: t(r.cotacao) ? `Cotação Nº ${t(r.cotacao)}` : '',
      qr: `EQP:${codigo}`,
      barras: codigo,
    };
  }
  // OP do quadro de comando: QR = "OP:<número da OP>" (formato NOVO). O nº de série é exigido na Qualidade do MES.
  function dadosOpQuadro(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    const numero = t(r.numero);
    return {
      titulo: 'QUADRO DE COMANDO',
      op_txt: `OP ${numero}`,
      produto_txt: t(r.produto) || t(r.titulo),
      cliente_txt: t(r.cliente) ? `Cliente: ${t(r.cliente)}` : '',
      serie_txt: t(r.serie) ? `Nº de série: ${t(r.serie)}` : 'Nº de série: ____________',
      data_txt: t(r.data),
      qr: `OP:${numero}`,
      barras: numero,
    };
  }
  // Avaria: material retido. QR = código do item (contrato do tipo Item).
  function dadosAvaria(r) {
    const t = (v) => String(v == null ? '' : v).trim();
    return {
      titulo: 'AVARIA - RETIDO',
      codigo: t(r.codigo),
      descricao: t(r.descricao),
      quantidade_txt: t(r.quantidade) ? `Qtd: ${t(r.quantidade)}${t(r.unidade) ? ' ' + t(r.unidade) : ''}` : '',
      motivo_txt: t(r.motivo) ? `Motivo: ${t(r.motivo)}` : '',
      quem_txt: [t(r.responsavel) && `Por: ${t(r.responsavel)}`, t(r.data)].filter(Boolean).join(' · '),
      qr: t(r.codigo),
      barras: t(r.codigo),
    };
  }

  /* ---------- Modelos padrão (layout em mm) ----------
     Elementos: caixa (borda) · linha · texto ({campo}, h = altura do texto, linhas) · qr (w = lado) · code128 (w × h). */
  const MODELOS = [
    {
      id: 'ENDERECO_VIGA_100x50', tipo: 'ENDERECO', nome: 'Endereço — viga horizontal', largura_mm: 100, altura_mm: 50,
      proposito: 'Identifica a posição no porta-palete. O QR (END:R2A4) é bipado no app para dizer onde se contou, guardou ou separou.',
      campos: ['codigo', 'descricao_local', 'lado_texto', 'dv_texto', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 4, w: 30 },
        { tipo: 'texto', campo: '{codigo}', x: 38, y: 4, w: 58, h: 16 },
        { tipo: 'texto', campo: '{descricao_local}', x: 38, y: 22, w: 58, h: 4.5 },
        { tipo: 'texto', campo: '{lado_texto}', x: 38, y: 29, w: 38, h: 5 },
        { tipo: 'texto', campo: '{dv_texto}', x: 78, y: 29, w: 18, h: 5, alinhamento: 'dir' },
        { tipo: 'code128', campo: '{barras}', x: 38, y: 36, w: 58, h: 10 },
      ],
    },
    {
      id: 'ITEM_100x50', tipo: 'ITEM', nome: 'Item — código e descrição', largura_mm: 100, altura_mm: 50,
      proposito: 'Cola-se na peça ou na caixa. QR e Code 128 levam exatamente o código do produto (contrato do app de estoque).',
      campos: ['codigo', 'descricao', 'linha_unidade', 'endereco_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 4, w: 24 },
        { tipo: 'texto', campo: '{codigo}', x: 32, y: 4, w: 64, h: 9 },
        { tipo: 'texto', campo: '{descricao}', x: 32, y: 14.5, w: 64, h: 4.6, linhas: 2 },
        { tipo: 'texto', campo: '{linha_unidade}', x: 32, y: 26.5, w: 64, h: 4.2 },
        { tipo: 'texto', campo: '{endereco_txt}', x: 32, y: 31.5, w: 64, h: 3.8 },
        { tipo: 'code128', campo: '{barras}', x: 4, y: 37, w: 92, h: 9 },
      ],
    },
    {
      id: 'RECEBIMENTO_100x50', tipo: 'RECEBIMENTO', nome: 'Recebimento — carga que chegou', largura_mm: 100, altura_mm: 50,
      proposito: 'Marca a carga recebida (embarque, P.I., fornecedor, item, quantidade). O QR leva o código do item, como na etiqueta Item.',
      campos: ['titulo', 'origem', 'fornecedor', 'codigo', 'descricao', 'quantidade_txt', 'nf_txt', 'conferencia', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'texto', campo: '{titulo}', x: 4, y: 2.5, w: 92, h: 5.5 },
        { tipo: 'linha', x: 4, y: 9, w: 92, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 11, w: 22 },
        { tipo: 'texto', campo: '{origem}', x: 30, y: 11, w: 66, h: 4 },
        { tipo: 'texto', campo: '{fornecedor}', x: 30, y: 16, w: 66, h: 4 },
        { tipo: 'texto', campo: '{codigo}', x: 30, y: 21, w: 66, h: 6 },
        { tipo: 'texto', campo: '{descricao}', x: 30, y: 28, w: 66, h: 3.8, linhas: 2 },
        { tipo: 'texto', campo: '{quantidade_txt}', x: 4, y: 37, w: 46, h: 5.5 },
        { tipo: 'texto', campo: '{nf_txt}', x: 52, y: 37, w: 44, h: 4.5, alinhamento: 'dir' },
        { tipo: 'texto', campo: '{conferencia}', x: 4, y: 43.5, w: 92, h: 4 },
      ],
    },
    {
      id: 'SEPARACAO_100x100', tipo: 'SEPARACAO', nome: 'Separação — volume do pedido', largura_mm: 100, altura_mm: 100,
      proposito: 'Identifica o volume n/N de um pedido de venda do Omie na área de expedição (EXP). Rolo 100 × 100 mm.',
      campos: ['pedido_txt', 'volume_txt', 'cliente_txt', 'destino_txt', 'separador_txt', 'data_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 99, esp: 0.5 },
        { tipo: 'texto', campo: '{pedido_txt}', x: 5, y: 5, w: 58, h: 8.5 },
        { tipo: 'texto', campo: '{volume_txt}', x: 63, y: 6.5, w: 32, h: 6, alinhamento: 'dir' },
        { tipo: 'linha', x: 5, y: 17, w: 90, esp: 0.5 },
        { tipo: 'texto', campo: '{cliente_txt}', x: 5, y: 20, w: 90, h: 6, linhas: 2 },
        { tipo: 'qr', campo: '{qr}', x: 5, y: 36, w: 40 },
        { tipo: 'texto', campo: '{destino_txt}', x: 50, y: 38, w: 45, h: 6.5 },
        { tipo: 'texto', campo: '{separador_txt}', x: 50, y: 50, w: 45, h: 4.5, linhas: 2 },
        { tipo: 'texto', campo: '{data_txt}', x: 50, y: 64, w: 45, h: 4.5 },
        { tipo: 'code128', campo: '{barras}', x: 5, y: 82, w: 90, h: 12 },
      ],
    },
    {
      id: 'SEPARACAO_100x50', tipo: 'SEPARACAO', nome: 'Separação — volume do pedido (100 × 50, deitada)', largura_mm: 100, altura_mm: 50,
      proposito: 'Mesma etiqueta de volume, aproveitando a largura toda do rolo 100 × 50 mm (conteúdo ocupa cerca de 95% da etiqueta).',
      campos: ['pedido_txt', 'volume_txt', 'cliente_txt', 'destino_txt', 'separador_txt', 'data_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.5 },
        { tipo: 'texto', campo: '{pedido_txt}', x: 3, y: 2.5, w: 54, h: 8 },
        { tipo: 'texto', campo: '{volume_txt}', x: 58, y: 4, w: 39, h: 6, alinhamento: 'dir' },
        { tipo: 'linha', x: 3, y: 12.5, w: 94, esp: 0.5 },
        { tipo: 'texto', campo: '{cliente_txt}', x: 3, y: 14.5, w: 94, h: 4.5, linhas: 2 },
        { tipo: 'qr', campo: '{qr}', x: 3, y: 25, w: 22 },
        { tipo: 'texto', campo: '{destino_txt}', x: 28, y: 25, w: 69, h: 6 },
        { tipo: 'texto', campo: '{separador_txt}', x: 28, y: 31.5, w: 69, h: 4 },
        { tipo: 'texto', campo: '{data_txt}', x: 28, y: 36, w: 69, h: 4 },
        { tipo: 'code128', campo: '{barras}', x: 28, y: 42, w: 69, h: 6 },
      ],
    },
    {
      id: 'SEPARACAO_100x150', tipo: 'SEPARACAO', nome: 'Separação — volume do pedido (100 × 150)', largura_mm: 100, altura_mm: 150,
      proposito: 'Mesma etiqueta de volume para o rolo 100 × 150 mm, com letras e QR grandes (conteúdo ocupa cerca de 95% da etiqueta).',
      campos: ['pedido_txt', 'volume_txt', 'cliente_txt', 'destino_txt', 'separador_txt', 'data_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 149, esp: 0.5 },
        { tipo: 'texto', campo: '{pedido_txt}', x: 5, y: 6, w: 90, h: 11 },
        { tipo: 'texto', campo: '{volume_txt}', x: 5, y: 19, w: 90, h: 11 },
        { tipo: 'linha', x: 5, y: 33, w: 90, esp: 0.5 },
        { tipo: 'texto', campo: '{cliente_txt}', x: 5, y: 37, w: 90, h: 7.5, linhas: 3 },
        { tipo: 'qr', campo: '{qr}', x: 5, y: 66, w: 44 },
        { tipo: 'texto', campo: '{destino_txt}', x: 52, y: 68, w: 43, h: 6.5 },
        { tipo: 'texto', campo: '{separador_txt}', x: 52, y: 79, w: 43, h: 5, linhas: 3 },
        { tipo: 'texto', campo: '{data_txt}', x: 52, y: 98, w: 43, h: 5 },
        { tipo: 'code128', campo: '{barras}', x: 5, y: 122, w: 90, h: 20 },
      ],
    },
    {
      id: 'PALETE_100x50', tipo: 'PALETE', nome: 'Palete — conteúdo e origem', largura_mm: 100, altura_mm: 50,
      proposito: 'Identifica um palete inteiro: código, P.I./embarque e os itens com quantidade. Não baixa estoque nem escreve no Omie.',
      campos: ['titulo', 'codigo', 'origem', 'data_txt', 'itens_txt', 'total_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 4, w: 26 },
        { tipo: 'texto', campo: '{titulo}', x: 34, y: 3, w: 40, h: 4.5 },
        { tipo: 'texto', campo: '{total_txt}', x: 74, y: 3.5, w: 22, h: 4, alinhamento: 'dir' },
        { tipo: 'texto', campo: '{codigo}', x: 34, y: 9, w: 62, h: 9 },
        { tipo: 'texto', campo: '{origem}', x: 34, y: 20, w: 62, h: 4 },
        { tipo: 'texto', campo: '{data_txt}', x: 34, y: 25, w: 62, h: 3.8 },
        { tipo: 'texto', campo: '{itens_txt}', x: 4, y: 33, w: 92, h: 3.8, linhas: 3 },
      ],
    },
    {
      id: 'IDTAG_100x50', tipo: 'IDTAG_EQUIPAMENTO', nome: 'ID-TAG do equipamento', largura_mm: 100, altura_mm: 50,
      proposito: 'Identifica cada elevador (ex.: VPEL-EL0985-1), o mesmo código das propostas e precificações.',
      campos: ['titulo', 'codigo', 'cliente_txt', 'obra_txt', 'cotacao_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'texto', campo: '{titulo}', x: 4, y: 3, w: 92, h: 4.5 },
        { tipo: 'linha', x: 4, y: 9, w: 92, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 12, w: 28 },
        { tipo: 'texto', campo: '{codigo}', x: 36, y: 12, w: 60, h: 7 },
        { tipo: 'texto', campo: '{cliente_txt}', x: 36, y: 22, w: 60, h: 4.5, linhas: 2 },
        { tipo: 'texto', campo: '{obra_txt}', x: 36, y: 32, w: 60, h: 3.8 },
        { tipo: 'texto', campo: '{cotacao_txt}', x: 36, y: 37, w: 60, h: 3.8 },
        { tipo: 'code128', campo: '{barras}', x: 4, y: 42, w: 92, h: 5 },
      ],
    },
    {
      id: 'OP_QUADRO_100x50', tipo: 'OP_QUADRO', nome: 'OP do quadro — número de série', largura_mm: 100, altura_mm: 50,
      proposito: 'Identifica a OP do PCP e o nº de série do quadro de comando (exigido na Qualidade do MES).',
      campos: ['titulo', 'op_txt', 'produto_txt', 'cliente_txt', 'serie_txt', 'data_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'texto', campo: '{titulo}', x: 4, y: 3, w: 70, h: 4.5 },
        { tipo: 'texto', campo: '{data_txt}', x: 70, y: 3.5, w: 26, h: 4, alinhamento: 'dir' },
        { tipo: 'linha', x: 4, y: 9, w: 92, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 12, w: 28 },
        { tipo: 'texto', campo: '{op_txt}', x: 36, y: 12, w: 60, h: 9 },
        { tipo: 'texto', campo: '{produto_txt}', x: 36, y: 23, w: 60, h: 4.2, linhas: 2 },
        { tipo: 'texto', campo: '{cliente_txt}', x: 36, y: 33, w: 60, h: 3.8 },
        { tipo: 'texto', campo: '{serie_txt}', x: 36, y: 38.5, w: 60, h: 5 },
        { tipo: 'code128', campo: '{barras}', x: 4, y: 43.5, w: 28, h: 4 },
      ],
    },
    {
      id: 'AVARIA_100x50', tipo: 'AVARIA', nome: 'Avaria — material retido', largura_mm: 100, altura_mm: 50,
      proposito: 'Retém o que chegou danificado ou aguarda decisão. O QR leva o código do item.',
      campos: ['titulo', 'codigo', 'descricao', 'quantidade_txt', 'motivo_txt', 'quem_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 1.2 },
        { tipo: 'texto', campo: '{titulo}', x: 4, y: 3, w: 92, h: 6.5 },
        { tipo: 'linha', x: 4, y: 11, w: 92, esp: 0.6 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 14, w: 24 },
        { tipo: 'texto', campo: '{codigo}', x: 32, y: 14, w: 64, h: 6 },
        { tipo: 'texto', campo: '{descricao}', x: 32, y: 22, w: 64, h: 4, linhas: 2 },
        { tipo: 'texto', campo: '{quantidade_txt}', x: 32, y: 31, w: 64, h: 4.5 },
        { tipo: 'texto', campo: '{motivo_txt}', x: 4, y: 39, w: 92, h: 4, linhas: 2 },
        { tipo: 'texto', campo: '{quem_txt}', x: 4, y: 45, w: 92, h: 3.2 },
      ],
    },
    {
      id: 'TESTE_100x50', tipo: 'TESTE', nome: 'Teste de bancada', largura_mm: 100, altura_mm: 50,
      proposito: 'Confere margem, acentos, QR, código de barras e escala (réguas de 10 mm e 50 mm) na impressora.',
      campos: ['qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'texto', campo: 'TESTE - 100 x 50 mm', x: 3, y: 2, w: 94, h: 4.5 },
        { tipo: 'texto', campo: 'Acentos: ç ã é ô Ç Ã', x: 3, y: 8, w: 94, h: 3.5 },
        { tipo: 'qr', campo: '{qr}', x: 3, y: 14, w: 22 },
        { tipo: 'code128', campo: '{barras}', x: 32, y: 14, w: 64, h: 11 },
        { tipo: 'texto', campo: 'QR: END:R2A4', x: 3, y: 37, w: 40, h: 3 },
        { tipo: 'linha', x: 3, y: 42, w: 10, esp: 0.4 },
        { tipo: 'texto', campo: '10 mm', x: 15, y: 40.5, w: 20, h: 3 },
        { tipo: 'linha', x: 3, y: 46.5, w: 50, esp: 0.4 },
        { tipo: 'texto', campo: '50 mm', x: 56, y: 45, w: 20, h: 3 },
      ],
    },
  ];
  const DADOS_TESTE = { qr: 'END:R2A4', barras: 'VPEL-156' };
  /* Modelos da empresa (cópias editadas, tabela etiqueta_modelos). Ficam num registro à parte: o padrão nunca é alterado.
     id do modelo da empresa = "C:<uuid>" (o histórico guarda esse id, então dá para reimprimir). */
  let CUSTOM = [];
  function registrarModelos(linhas) {
    CUSTOM = (linhas || []).map((l) => ({
      id: 'C:' + l.id, tipo: l.tipo, nome: l.nome, largura_mm: Number(l.largura_mm), altura_mm: Number(l.altura_mm),
      proposito: 'Modelo da empresa (cópia de ' + l.base_id + ').', campos: l.campos || [], elementos: l.elementos || [],
      empresa: true, ativo: l.ativo !== false, base_id: l.base_id, uuid: l.id,
    }));
  }
  const modeloPorId = (id) => MODELOS.find((m) => m.id === id) || CUSTOM.find((m) => m.id === id) || null;
  const modelosDoTipo = (tipo) => MODELOS.filter((m) => m.tipo === tipo).concat(CUSTOM.filter((m) => m.tipo === tipo && m.ativo));
  const modelosDaEmpresa = () => CUSTOM.slice();

  /* Valida um modelo editado contra o padrão de origem. Devolve lista de erros (vazia = pode salvar).
     Regras: tudo dentro da página; só campos do dicionário do tipo; os elementos "protegidos" do padrão (QR e Code 128) não
     podem ser apagados nem trocar de campo (o app de estoque depende do conteúdo deles). */
  function validarModelo(modelo, padrao) {
    const erros = [];
    const W = Number(modelo.largura_mm), H = Number(modelo.altura_mm);
    const campos = new Set(padrao.campos || []);
    (modelo.elementos || []).forEach((el, i) => {
      const nome = `Elemento ${i + 1}`;
      const nums = ['x', 'y', 'w'].concat(el.tipo === 'linha' || el.tipo === 'qr' ? [] : ['h']);
      for (const k of nums) if (!(Number(el[k]) >= 0) || el[k] === '' || el[k] == null) erros.push(`${nome}: "${k}" inválido.`);
      const h = el.tipo === 'qr' ? Number(el.w) : el.tipo === 'linha' ? Number(el.esp || 0.4) : Number(el.h);
      if (Number(el.x) + Number(el.w) > W + 0.01 || Number(el.y) + h > H + 0.01) erros.push(`${nome} sai da etiqueta (${W} × ${H} mm).`);
      if (el.tipo === 'texto' && !(Number(el.h) >= 2)) erros.push(`${nome}: altura do texto mínima de 2 mm.`);
      if (el.tipo === 'qr' && Number(el.w) < 12) erros.push(`${nome}: QR muito pequeno (mínimo 12 mm para leitura).`);
      if (el.tipo === 'code128' && Number(el.h) < 4) erros.push(`${nome}: código de barras muito baixo (mínimo 4 mm).`);
      for (const c of (String(el.campo || '').match(/\{(\w+)\}/g) || [])) if (!campos.has(c.slice(1, -1))) erros.push(`${nome}: campo ${c} não existe neste tipo.`);
    });
    for (const orig of padrao.elementos.filter((e) => e.tipo === 'qr' || e.tipo === 'code128')) {
      if (!(modelo.elementos || []).some((e) => e.tipo === orig.tipo && e.campo === orig.campo)) erros.push(`O ${orig.tipo === 'qr' ? 'QR Code' : 'código de barras'} (${orig.campo}) é obrigatório neste tipo e não pode ser apagado.`);
    }
    return erros;
  }

  // "{campo}" -> valor de dados (vazio se não existir)
  function aplicar(modelo, dados) {
    return String(modelo == null ? '' : modelo).replace(/\{(\w+)\}/g, (_, k) => (dados && dados[k] != null ? String(dados[k]) : ''));
  }

  /* ---------- ZPL II ---------- */
  // Impressoras de "203 dpi" têm 8 pontos por mm (203,2 dpi); as de "300 dpi", 12 pontos/mm. Qualquer outra resolução: dpi ÷ 25,4.
  const pontosPorMm = (dpi) => (Number(dpi) === 203 ? 8 : Number(dpi) === 300 ? 12 : Number(dpi) === 600 ? 24 : Number(dpi) / 25.4);
  const mmParaDots = (mm, dpi) => Math.round(Number(mm) * pontosPorMm(dpi));
  // Capacidade em bytes (modo byte, correção M) das versões 1..10 do QR; módulos = 17 + 4×versão.
  const QR_CAP_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  function qrModulos(bytes) {
    const i = QR_CAP_M.findIndex((c) => c >= bytes);
    return 17 + 4 * ((i < 0 ? QR_CAP_M.length : i) + 1);
  }
  const utf8Bytes = (s) => (typeof TextEncoder !== 'undefined' ? Array.from(new TextEncoder().encode(s)) : Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0)));

  // Texto seguro para dentro de ^FD (usa ^FH com "_" como escape). Acento vira _C3_A7; sem UTF-8, o acento é removido.
  function zplTexto(valor, utf8) {
    let s = String(valor == null ? '' : valor).replace(/[\r\n\t]+/g, ' ');
    if (!utf8) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    let out = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20 && cp <= 0x7e && ch !== '^' && ch !== '~' && ch !== '_' && ch !== '\\') { out += ch; continue; }
      if (!utf8 && cp > 0x7e) { out += '?'; continue; }
      if (cp < 0x20) { out += ' '; continue; }
      out += utf8Bytes(ch).map((b) => '_' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
    }
    return out;
  }
  function cortar(texto, max, utf8) {
    const s = String(texto || '');
    if (s.length <= max) return { texto: s, cortado: false };
    return { texto: s.slice(0, Math.max(1, max - 1)) + (utf8 ? '…' : '.'), cortado: true };
  }

  /* ---------- Rolo carregado: tamanho da etiqueta, colunas e ajuste do modelo ---------- */
  // Largura = lado que passa pela cabeça de impressão; comprimento (altura) = sentido em que o rolo sai. Colunas = etiquetas lado a lado.
  const ROLO_LIM = { min: 10, maxL: 200, maxA: 400, maxCols: 6, maxEsp: 20, maxDesl: 10 };
  function geometriaRolo(cfg, perfil) {
    const c = cfg || {};
    const num = (v) => Number(String(v).replace(',', '.'));
    const leg = /^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/.exec(String(c.rolo || '').replace(/\s/g, ''));   // formato antigo "100x50"
    const tem = (v) => v !== undefined && v !== null;   // campo vazio (''): conta como inválido, não volta ao padrão
    const largura = tem(c.largura_mm) ? num(c.largura_mm) : (leg ? num(leg[1]) : 100);
    const altura = tem(c.altura_mm) ? num(c.altura_mm) : (leg ? num(leg[2]) : 50);
    const colunas = tem(c.colunas) ? num(c.colunas) : 1;
    const espaco = tem(c.espaco_mm) ? num(c.espaco_mm) : 3;
    const dx = tem(c.desl_x_mm) ? num(c.desl_x_mm) : 0, dy = tem(c.desl_y_mm) ? num(c.desl_y_mm) : 0;
    let erro = null;
    if (!Number.isFinite(largura) || largura < ROLO_LIM.min || largura > ROLO_LIM.maxL) erro = `Informe a largura da etiqueta (de ${ROLO_LIM.min} a ${ROLO_LIM.maxL} mm).`;
    else if (!Number.isFinite(altura) || altura < ROLO_LIM.min || altura > ROLO_LIM.maxA) erro = `Informe o comprimento da etiqueta (de ${ROLO_LIM.min} a ${ROLO_LIM.maxA} mm).`;
    else if (!Number.isInteger(colunas) || colunas < 1 || colunas > ROLO_LIM.maxCols) erro = `Etiquetas por linha: use um número inteiro de 1 a ${ROLO_LIM.maxCols}.`;
    else if (colunas > 1 && (!Number.isFinite(espaco) || espaco < 0 || espaco > ROLO_LIM.maxEsp)) erro = `O espaço entre colunas deve ficar entre 0 e ${ROLO_LIM.maxEsp} mm.`;
    else if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > ROLO_LIM.maxDesl || Math.abs(dy) > ROLO_LIM.maxDesl) erro = `O ajuste de posição deve ficar entre -${ROLO_LIM.maxDesl} e ${ROLO_LIM.maxDesl} mm.`;
    const cols = Number.isInteger(colunas) && colunas >= 1 ? colunas : 1;
    const esp = cols > 1 && Number.isFinite(espaco) && espaco >= 0 ? espaco : 0;
    const larguraTotal = Number.isFinite(largura) ? Math.round((cols * largura + (cols - 1) * esp) * 100) / 100 : 0;
    if (!erro && perfil && perfil.largura_max_mm && larguraTotal > perfil.largura_max_mm) {
      erro = `O rolo fica com ${larguraTotal} mm de largura (${cols} × ${largura}${cols > 1 ? ` + espaços de ${esp}` : ''}) e a impressora aceita até ${perfil.largura_max_mm} mm.`;
    }
    return { ok: !erro, erro, largura: Number.isFinite(largura) ? largura : 100, altura: Number.isFinite(altura) ? altura : 50, colunas: cols, espaco: esp, larguraTotal, deslX: Number.isFinite(dx) ? dx : 0, deslY: Number.isFinite(dy) ? dy : 0 };
  }

  /* Ajusta um modelo (desenhado para o próprio tamanho) a outro tamanho de etiqueta: escala única (não distorce) e centraliza.
     opcoes.ampliar === false: só reduz (usado na etiqueta de teste, cujas réguas têm de continuar valendo 10 e 50 mm). */
  function adaptarModelo(modelo, largura, altura, opcoes) {
    const Lm = Number(modelo.largura_mm), Am = Number(modelo.altura_mm);
    if (Lm === Number(largura) && Am === Number(altura)) return { modelo, escala: 1, ajustado: false };
    let s = Math.min(largura / Lm, altura / Am);
    if (opcoes && opcoes.ampliar === false) s = Math.min(1, s);
    const dx = (largura - Lm * s) / 2, dy = (altura - Am * s) / 2;
    const r = (v) => Math.round(v * 1000) / 1000;
    const elementos = (modelo.elementos || []).map((el) => {
      const o = Object.assign({}, el);
      o.x = r(el.x * s + dx); o.y = r(el.y * s + dy);
      for (const k of ['w', 'h', 'esp']) if (o[k] != null) o[k] = r(o[k] * s);
      return o;
    });
    return { modelo: Object.assign({}, modelo, { largura_mm: Number(largura), altura_mm: Number(altura), elementos }), escala: s, ajustado: true };
  }

  // Elementos de UMA etiqueta em ZPL; dx = deslocamento horizontal em pontos (para as colunas do rolo).
  function zplCorpo(modelo, dados, o, dx) {
    const avisos = [];
    const d = (mm) => mmParaDots(mm, o.dpi);
    const z = [];
    for (const el of modelo.elementos) {
      // Ajuste fino de posição (calibração): soma o deslocamento a cada campo; ^FO não aceita negativo, então trava em 0.
      const x = Math.max(0, d(el.x) + (dx || 0) + d(o.desl_x_mm || 0)), y = Math.max(0, d(el.y) + d(o.desl_y_mm || 0));
      if (el.tipo === 'caixa') {
        const esp = Math.max(1, d(el.esp || 0.4));
        z.push(`^FO${x},${y}^GB${d(el.w)},${d(el.h)},${esp}^FS`);
      } else if (el.tipo === 'linha') {
        const esp = Math.max(1, d(el.esp || 0.4));
        z.push(`^FO${x},${y}^GB${d(el.w)},${esp},${esp}^FS`);
      } else if (el.tipo === 'texto') {
        const bruto = aplicar(el.campo, dados);
        if (!bruto.trim()) continue;
        const w = d(el.w), h = Math.max(8, d(el.h));
        const linhas = el.linhas || 1;
        const maxChars = Math.max(1, Math.floor(w / (h * 0.55))) * linhas;
        const c = cortar(bruto, maxChars, o.utf8);
        if (c.cortado) avisos.push(`Texto cortado para caber: "${bruto}"`);
        const al = el.alinhamento === 'dir' ? 'R' : el.alinhamento === 'centro' ? 'C' : 'L';
        z.push(`^FO${x},${y}^FB${w},${linhas},0,${al},0^A0N,${h},0^FH_^FD${zplTexto(c.texto, o.utf8)}^FS`);
      } else if (el.tipo === 'qr') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        const modulos = qrModulos(utf8Bytes(dado).length);
        const alvo = d(el.w);
        const mag = Math.max(2, Math.min(10, Math.floor(alvo / modulos)));
        if (Math.floor(alvo / modulos) < 3) avisos.push(`QR "${dado}" pequeno: ${mag} ponto(s) por módulo (ideal ≥ 3)`);
        z.push(`^FO${x},${y}^BQN,2,${mag}^FH_^FDMA,${zplTexto(dado, true)}^FS`);
      } else if (el.tipo === 'code128') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        // largura de um Code 128 em subset B: (11 × (caracteres + 3) + 13) módulos; escolhe a barra mais larga que couber (2 a 3 pontos).
        const modulos = 11 * (dado.length + 3) + 13;
        const alvo = d(el.w);
        const barra = Math.min(3, Math.floor(alvo / modulos));
        if (barra < 2) { avisos.push(`Código de barras "${dado}" não cabe na largura do modelo`); }
        z.push(`^BY${Math.max(2, barra)}`, `^FO${x},${y}^BCN,${Math.max(8, d(el.h))},N,N,N,A^FH_^FD${zplTexto(dado, true)}^FS`);
      }
    }
    return { linhas: z, avisos };
  }

  /* opcoes: { dpi = 203, utf8 = true, copias = 1 } -> { zpl, avisos[] } (uma etiqueta; ^PQ repete as cópias) */
  function renderZPL(modelo, dados, opcoes) {
    const o = Object.assign({ dpi: 203, utf8: true, copias: 1 }, opcoes || {});
    const d = (mm) => mmParaDots(mm, o.dpi);
    const z = ['^XA'];
    if (o.utf8) z.push('^CI28');
    z.push(`^PW${d(modelo.largura_mm)}`, `^LL${d(modelo.altura_mm)}`, '^LH0,0');
    const c = zplCorpo(modelo, dados, o, 0);
    z.push(...c.linhas, `^PQ${Math.max(1, Math.floor(Number(o.copias) || 1))}`, '^XZ');
    return { zpl: z.join('\n'), avisos: c.avisos };
  }

  /* Rolo com várias etiquetas por linha: junta as etiquetas (cada item × suas cópias) em linhas de `colunas`.
     Cada linha vira um formato ZPL com a largura do rolo inteiro; linhas seguidas iguais usam ^PQ.
     itens: [{ dados, copias }] -> { blocos: [zpl por linha (ou grupo de linhas iguais)], avisos[], etiquetas, linhas } */
  function renderZPLLinhas(modelo, itens, opcoes) {
    const o = Object.assign({ dpi: 203, utf8: true, colunas: 1, espaco: 3 }, opcoes || {});
    const d = (mm) => mmParaDots(mm, o.dpi);
    const cols = Math.max(1, Math.floor(Number(o.colunas) || 1));
    const esp = cols > 1 ? Number(o.espaco) || 0 : 0;
    const lista = [];
    for (const it of itens) for (let i = 0; i < Math.max(1, Math.floor(Number(it.copias) || 1)); i++) lista.push(it.dados);
    const passo = d(Number(modelo.largura_mm) + esp);
    const Wtot = d(cols * Number(modelo.largura_mm) + (cols - 1) * esp), H = d(modelo.altura_mm);
    const avisos = new Set();
    const linhas = [];
    for (let i = 0; i < lista.length; i += cols) {
      const grupo = lista.slice(i, i + cols);
      const chave = JSON.stringify(grupo);
      const ult = linhas[linhas.length - 1];
      if (ult && ult.chave === chave) { ult.n += 1; continue; }
      linhas.push({ chave, grupo, n: 1 });
    }
    const blocos = linhas.map((ln) => {
      const z = ['^XA'];
      if (o.utf8) z.push('^CI28');
      z.push(`^PW${Wtot}`, `^LL${H}`, '^LH0,0');
      ln.grupo.forEach((dados, c) => {
        const r = zplCorpo(modelo, dados, o, c * passo);
        z.push(...r.linhas);
        r.avisos.forEach((a) => avisos.add(a));
      });
      z.push(`^PQ${ln.n}`, '^XZ');
      return z.join('\n');
    });
    return { blocos, avisos: Array.from(avisos), etiquetas: lista.length, linhas: linhas.reduce((n, l) => n + l.n, 0) };
  }

  /* ---------- SVG (pré-visualização e impressão pelo navegador) ---------- */
  const escXml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => Math.round(n * 1000) / 1000;
  // Embute um <svg viewBox> gerado por biblioteca de código de barras dentro de uma caixa (x, y, w, h) em mm.
  function embutirSvg(svg, x, y, w, h, preservar) {
    const vb = /viewBox="([^"]+)"/.exec(svg);
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    if (!vb) return '';
    return `<svg x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" viewBox="${vb[1]}" preserveAspectRatio="${preservar}">${inner}</svg>`;
  }
  function quebrar(texto, maxChars, linhas) {
    const palavras = String(texto).split(/\s+/);
    const out = []; let atual = '';
    for (const p of palavras) {
      if ((atual + ' ' + p).trim().length <= maxChars) atual = (atual + ' ' + p).trim();
      else { if (atual) out.push(atual); atual = p; }
    }
    if (atual) out.push(atual);
    if (out.length > linhas) { out.length = linhas; out[linhas - 1] = out[linhas - 1].slice(0, Math.max(1, maxChars - 1)) + '…'; }
    return out;
  }
  /* opcoes.barcode(tipo, texto) -> string <svg> (tipo 'qr' | 'code128'); sem ela, desenha um retângulo de aviso. */
  function renderSVG(modelo, dados, opcoes) {
    const bc = opcoes && opcoes.barcode;
    const W = modelo.largura_mm, H = modelo.altura_mm;
    const p = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Arial, Helvetica, sans-serif">`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`];
    for (const el of modelo.elementos) {
      if (el.tipo === 'caixa') {
        p.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="none" stroke="#000" stroke-width="${el.esp || 0.4}"/>`);
      } else if (el.tipo === 'linha') {
        p.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.esp || 0.4}" fill="#000"/>`);
      } else if (el.tipo === 'texto') {
        const t = aplicar(el.campo, dados);
        if (!t.trim()) continue;
        const linhas = el.linhas || 1;
        const maxChars = Math.max(1, Math.floor(el.w / (el.h * 0.55))) * 1;   // mesma regra do ZPL: a prévia corta onde a impressora corta
        const partes = quebrar(t, maxChars, linhas);
        const anc = el.alinhamento === 'dir' ? 'end' : el.alinhamento === 'centro' ? 'middle' : 'start';
        const tx = el.alinhamento === 'dir' ? el.x + el.w : el.alinhamento === 'centro' ? el.x + el.w / 2 : el.x;
        partes.forEach((linha, i) => {
          p.push(`<text x="${num(tx)}" y="${num(el.y + el.h * 0.82 + i * el.h * 1.15)}" font-size="${num(el.h)}" font-weight="700" text-anchor="${anc}">${escXml(linha)}</text>`);
        });
      } else if (el.tipo === 'qr' || el.tipo === 'code128') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        const h = el.tipo === 'qr' ? el.w : el.h;
        const svg = bc ? bc(el.tipo, dado) : null;
        const emb = svg ? embutirSvg(svg, el.x, el.y, el.w, h, el.tipo === 'qr' ? 'xMinYMin meet' : 'none') : '';
        p.push(emb || `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${h}" fill="#eee" stroke="#999" stroke-width="0.2"/><text x="${el.x + 1}" y="${el.y + h / 2}" font-size="2.5" fill="#666">${el.tipo === 'qr' ? 'QR' : 'Code 128'}</text>`);
      }
    }
    p.push('</svg>');
    return p.join('');
  }
  /* Uma linha do rolo: `colunas` etiquetas lado a lado (listaDados[i] = dados da coluna i; coluna sem dados fica em branco).
     opcoes: { barcode, colunas, espaco, fluido (sem tamanho fixo, para a prévia), moldura (contorno cinza de cada etiqueta, só na prévia) } */
  function renderSVGLinha(modelo, listaDados, opcoes) {
    const o = Object.assign({ colunas: 1, espaco: 3 }, opcoes || {});
    const cols = Math.max(1, Math.floor(Number(o.colunas) || 1));
    const esp = cols > 1 ? Number(o.espaco) || 0 : 0;
    const L = Number(modelo.largura_mm), A = Number(modelo.altura_mm);
    const W = num(cols * L + (cols - 1) * esp);
    const tam = o.fluido ? '' : ` width="${W}mm" height="${A}mm"`;
    const p = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${A}"${tam} font-family="Arial, Helvetica, sans-serif">`, `<rect x="0" y="0" width="${W}" height="${A}" fill="#fff"/>`];
    for (let c = 0; c < cols; c++) {
      const dados = (listaDados || [])[c];
      if (!dados) continue;
      const x = num(c * (L + esp) + (Number(o.desl_x_mm) || 0)), y = num(Number(o.desl_y_mm) || 0);
      const inner = renderSVG(modelo, dados, { barcode: o.barcode }).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      p.push(`<svg x="${x}" y="${y}" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">${inner}</svg>`);
    }
    if (o.moldura) for (let c = 0; c < cols; c++) p.push(`<rect x="${num(c * (L + esp))}" y="0" width="${L}" height="${A}" fill="none" stroke="#9aa" stroke-width="0.3" stroke-dasharray="1.5 1"/>`);
    p.push('</svg>');
    return p.join('');
  }
  // Documento de impressão pelo navegador: uma página por etiqueta, tamanho exato em mm, sem margem.
  function htmlImpressao(paginasSvg, larguraMm, alturaMm) {
    const css = `@page{size:${larguraMm}mm ${alturaMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}` +
      `.pg{width:${larguraMm}mm;height:${alturaMm}mm;overflow:hidden;page-break-after:always;break-after:page}` +
      `.pg:last-child{page-break-after:auto;break-after:auto}.pg svg{display:block;width:${larguraMm}mm;height:${alturaMm}mm}`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title><style>${css}</style></head><body>` +
      paginasSvg.map((s) => `<div class="pg">${s}</div>`).join('') + '</body></html>';
  }

  /* Confere um endereço digitado à mão (regra do galpão, a mesma do app de estoque). Só vale para valor NOVO:
     se o texto é igual ao que já estava gravado (endereço antigo, ex.: "G13"), passa sem mexer — nunca apagamos dado existente.
     Devolve { ok, codigo, antigo, msg }; codigo = forma canônica (R2A4) ou null quando vazio. */
  function validarEnderecoNovo(texto, anterior) {
    const bruto = String(texto == null ? '' : texto).trim();
    if (!bruto) return { ok: true, codigo: null, antigo: false, msg: '' };
    const p = parseEndereco(bruto);
    if (p) return { ok: true, codigo: p.codigo, antigo: false, msg: '' };
    if (anterior != null && normalizarEndereco(bruto) === normalizarEndereco(anterior)) return { ok: true, codigo: bruto, antigo: true, msg: '' };
    return { ok: false, codigo: null, antigo: false, msg: `Endereço "${bruto}" não existe no galpão. Use o formato R<rua><vão><nível>, ex.: R2A4 (ruas 1–4, vãos A–J, níveis 1–8) ou EXP.` };
  }

  window.EtiquetasCalc = {
    DV_PESOS, validarEnderecoNovo, MODELOS, DADOS_TESTE, modeloPorId, modelosDoTipo, registrarModelos, modelosDaEmpresa, validarModelo,
    normalizarEndereco, parseEndereco, dvEndereco, textoEndereco, todosEnderecos,
    dadosEndereco, dadosItem, dadosRecebimento, dadosSeparacao, dadosPalete, dadosIdTag, dadosOpQuadro, dadosAvaria, aplicar, pontosPorMm, mmParaDots, qrModulos, zplTexto, renderZPL, renderZPLLinhas, renderSVG, renderSVGLinha, htmlImpressao,
    ROLO_LIM, geometriaRolo, adaptarModelo,
  };
}());
