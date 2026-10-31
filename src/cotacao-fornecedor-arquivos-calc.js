/* ============================================================
   cotacao-fornecedor-arquivos-calc.js — abas "Imagens" e "Documentos" da cotação a fornecedor (20/10/2026).
   Funções PURAS (testadas em cotacao-fornecedor-arquivos-calc.test.js). Recebem a lista de arquivos que o
   FORNECEDOR mandou (anexos do formulário do link + anexos dos e-mails de entrada ligados à cotação) e:
     • separam imagem × documento pela EXTENSÃO do nome — os PDFs que chegam por e-mail vêm marcados como
       "application/octet-stream", então o tipo informado não serve;
     • agrupam as versões do mesmo documento pela "família" do nome (sem a data na frente, sem "_Updated",
       "(1)", "_v2"…) — a mais recente é a VIGENTE (regra do usuário: vale o que chegou por último);
     • juntam a mesma imagem repetida (mesmo tamanho em bytes) — assinatura/print citado volta em quase
       toda resposta com nome novo — e escondem imagem muito pequena (logo de assinatura).
   Nada é gravado: é só leitura do que o read-inbox e o formulário do fornecedor já guardam.
   window.CfArquivosCalc = { classificar, familia, montar, IMAGEM_MIN_BYTES }
   ============================================================ */
(function () {
  'use strict';

  const EXT_IMAGEM = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'svg'];
  const EXT_DOCUMENTO = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'xlsm', 'csv', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods',
    'dwg', 'dxf', 'step', 'stp', 'igs', 'iges', 'zip', 'rar', '7z'];
  const IMAGEM_MIN_BYTES = 5 * 1024;

  function extensao(nome) {
    const m = String(nome || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
    return m ? m[1] : '';
  }

  /* 'imagem' | 'documento' — sem extensão conhecida, decide pelo tipo informado; senão vai para Documentos
     (melhor aparecer como documento do que sumir). */
  function classificar(nome, tipo) {
    const ext = extensao(nome);
    if (EXT_IMAGEM.includes(ext)) return 'imagem';
    if (EXT_DOCUMENTO.includes(ext)) return 'documento';
    if (/^image\//i.test(String(tipo || ''))) return 'imagem';
    return 'documento';
  }

  /* Chave da "família" de versões: tira a extensão, a data no começo (20261019-, 2026-10-19_), marcas de
     versão no fim (_Updated, -rev2, _v3, (1), " - cópia") e normaliza caixa/acentos/separadores. */
  function familia(nome) {
    let s = String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/\.[a-z0-9]{1,5}$/, '');
    s = s.replace(/^\s*(\d{8}|\d{4}[-_.]\d{2}[-_.]\d{2}|\d{6})[\s_-]+/, '');
    let antes;
    do {
      antes = s;
      s = s.replace(/[\s_-]*\(\d+\)\s*$/, '')
        .replace(/[\s_-]*(updated|update|atualizado|revised|final|new|novo|copia|copy)\s*$/, '')
        .replace(/[\s_-]*(rev|r|v|ver|versao|version)[\s_.-]?\d+\s*$/, '');
    } while (s !== antes);
    s = s.replace(/[\s_.]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s || String(nome || '').toLowerCase();
  }

  const quandoMs = (a) => { const t = new Date(a && a.quando || 0).getTime(); return isFinite(t) ? t : 0; };

  /* lista: [{ id, nome, tipo, tamanho, quando, origem: 'formulario'|'email', remetente, assunto, ref }]
     Devolve { documentos: [{ familia, vigente, antigas: [...] }], imagens: [{ ...img, vezes, outras: [...], oculta }] } */
  function montar(lista) {
    const arquivos = (Array.isArray(lista) ? lista : []).filter((a) => a && a.nome);
    const docs = new Map();
    const imgs = new Map();
    for (const a of arquivos) {
      if (classificar(a.nome, a.tipo) === 'imagem') {
        const chave = Number(a.tamanho) > 0 ? 'b:' + Number(a.tamanho) : 'n:' + String(a.nome).toLowerCase();
        if (!imgs.has(chave)) imgs.set(chave, []);
        imgs.get(chave).push(a);
      } else {
        const f = familia(a.nome);
        if (!docs.has(f)) docs.set(f, []);
        docs.get(f).push(a);
      }
    }
    const documentos = [...docs.entries()].map(([f, vs]) => {
      const ord = vs.slice().sort((x, y) => quandoMs(y) - quandoMs(x));
      return { familia: f, vigente: ord[0], antigas: ord.slice(1) };
    }).sort((x, y) => String(x.vigente.nome).localeCompare(String(y.vigente.nome), 'pt-BR', { numeric: true }));
    const imagens = [...imgs.values()].map((vs) => {
      const ord = vs.slice().sort((x, y) => quandoMs(y) - quandoMs(x));
      const tam = Number(ord[0].tamanho);
      return { ...ord[0], vezes: ord.length, outras: ord.slice(1), oculta: tam > 0 && tam < IMAGEM_MIN_BYTES };
    }).sort((x, y) => quandoMs(y) - quandoMs(x));
    return { documentos, imagens };
  }

  const api = { classificar, familia, montar, IMAGEM_MIN_BYTES };
  if (typeof window !== 'undefined') window.CfArquivosCalc = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
