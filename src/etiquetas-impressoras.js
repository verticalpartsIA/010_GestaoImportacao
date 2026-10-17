/* ============================================================
   etiquetas-impressoras.js — Logística Interna · Etiquetas: perfis de impressora e adaptadores de transporte.
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md (seção 9.4).
   Três coisas separadas, para trocar uma sem mexer nas outras: layout (EtiquetasCalc) -> linguagem da impressora
   (hoje só ZPL II) -> transporte (adaptador). Adaptadores:
   - 'zebra-browser-print': programa gratuito da Zebra no computador; o site fala com ele em localhost
     (https 9101, ou http 9100 nas versões antigas): GET /available -> {printer:[...]}, POST /write {device, data} (text/plain).
     Endpoints conferidos no código do wrapper comunitário "zebra-browser-print-wrapper" e no guia v1.3 da Zebra; a lista oficial
     v1.3 NÃO cita a ZD220 — só o teste com a impressora real confirma. Só Zebra e só ZPL.
   - 'navegador': abre o diálogo de impressão do sistema com uma página por etiqueta (plano B universal; sem status).
   Ficam para depois: QZ Tray (qualquer marca) e WebUSB (bloqueado pelo driver no Windows).
   Nada aqui grava no banco nem escreve no Omie.
   window.EtiquetasImpressoras
   ============================================================ */
(function () {
  'use strict';

  /* Perfis de fábrica. `implementado: false` = o renderizador dessa linguagem ainda não existe; a UI só oferece o navegador.
     Dados de Elgin/Argox vêm de fichas comerciais e do folheto da Argox: só valem como "garantidos" depois de teste físico. */
  const PERFIS = [
    { id: 'zebra-zd220', marca: 'Zebra', modelo: 'ZD220', dpi: 203, largura_max_mm: 104, linguagem: 'zpl', implementado: true, conexoes: 'USB',
      obs: 'Térmica direta. 203 dpi, 104 mm de largura útil. O Browser Print não lista a ZD220 oficialmente: confirmar na bancada.' },
    { id: 'zebra-zd230', marca: 'Zebra', modelo: 'ZD230', dpi: 203, largura_max_mm: 104, linguagem: 'zpl', implementado: true, conexoes: 'USB / Ethernet',
      obs: 'Mesma família da ZD220. Confirmar na bancada.' },
    { id: 'zebra-zt421', marca: 'Zebra', modelo: 'ZT421', dpi: 203, largura_max_mm: null, linguagem: 'zpl', implementado: true, conexoes: 'USB / Ethernet',
      obs: 'Industrial; existe em 203 e 300 dpi. Ajuste a resolução ao modelo comprado.' },
    { id: 'zebra-generica', marca: 'Zebra', modelo: 'Outro modelo Zebra (ZPL)', dpi: 203, largura_max_mm: null, linguagem: 'zpl', implementado: true, conexoes: 'USB / rede',
      obs: 'Perfil genérico para qualquer Zebra que fale ZPL II.' },
    { id: 'elgin-l42-pro', marca: 'Elgin', modelo: 'L42 Pro Full', dpi: 203, largura_max_mm: 108, linguagem: 'zpl', implementado: true, conexoes: 'USB / Ethernet / Serial',
      obs: 'Segundo fichas de loja, reconhece EPL, ZPL, PPLA e PPLB. Não é Zebra: o Browser Print não a enxerga; use o navegador até existir o adaptador QZ Tray.' },
    { id: 'argox-os214plus', marca: 'Argox', modelo: 'OS-214 Plus / OS-2140', dpi: 203, largura_max_mm: null, linguagem: 'pplz', implementado: false, conexoes: 'USB / RS-232',
      obs: 'Fala PPLA, PPLB e PPLZ (subconjunto do ZPL). Renderizador ainda não implementado: por ora, impressão pelo navegador.' },
    { id: 'generica', marca: '—', modelo: 'Outra impressora (navegador)', dpi: 203, largura_max_mm: null, linguagem: 'pdf', implementado: false, conexoes: 'qualquer',
      obs: 'Usa o diálogo de impressão do sistema, com o driver instalado no Windows.' },
  ];
  const perfilPorId = (id) => PERFIS.find((p) => p.id === id) || null;

  // Casa o que o adaptador reportou (nome, fabricante) com o perfil de fábrica mais próximo.
  function casarPerfil(imp) {
    const txt = `${imp && imp.nome || ''} ${imp && imp.fabricante || ''}`.toLowerCase();
    if (/zd\s*220/.test(txt)) return perfilPorId('zebra-zd220');
    if (/zd\s*230/.test(txt)) return perfilPorId('zebra-zd230');
    if (/zt\s*4\d\d/.test(txt)) return perfilPorId('zebra-zt421');
    if (/l\s*42/.test(txt) && /elgin/.test(txt)) return perfilPorId('elgin-l42-pro');
    if (/os[-\s]?214|os[-\s]?2140|argox/.test(txt)) return perfilPorId('argox-os214plus');
    if (/zebra|zdesigner|\bzd\d|\bzt\d/.test(txt)) return perfilPorId('zebra-generica');
    return perfilPorId('generica');
  }

  /* ---------- Zebra Browser Print ---------- */
  const BP_BASES = ['https://localhost:9101', 'http://localhost:9100'];
  let bpBase = null;
  // Tenta a base que já funcionou e depois as outras; devolve o texto da resposta.
  async function bpChamar(caminho, opts, f) {
    const fn = f || (typeof fetch === 'function' ? fetch : null);
    if (!fn) throw new Error('Este navegador não consegue falar com o Browser Print.');
    const bases = bpBase ? [bpBase, ...BP_BASES.filter((b) => b !== bpBase)] : BP_BASES;
    let ultimo = 'sem resposta';
    for (const base of bases) {
      try {
        const r = await fn(base + caminho, opts || {});
        if (r && r.ok) { bpBase = base; return await r.text(); }
        ultimo = `HTTP ${r && r.status}`;
      } catch (e) { ultimo = e && e.message ? e.message : String(e); }
    }
    throw new Error(`Browser Print não respondeu (${ultimo}). Confira se o programa está aberto no computador.`);
  }
  async function detectarBrowserPrint(f) {
    const txt = await bpChamar('/available', { method: 'GET' }, f);
    let dados;
    try { dados = JSON.parse(txt); } catch (e) { throw new Error('Resposta inesperada do Browser Print.'); }
    const lista = dados && Array.isArray(dados.printer) ? dados.printer : [];
    return lista.map((p) => ({
      adaptador: 'zebra-browser-print', id: String(p.uid || p.name), nome: String(p.name || 'Impressora sem nome'),
      conexao: p.connection || '', fabricante: p.manufacturer || 'Zebra', bruto: p,
    }));
  }
  async function enviarBrowserPrint(imp, zpl, f) {
    if (!imp || !imp.bruto) throw new Error('Impressora do Browser Print não identificada: detecte de novo.');
    await bpChamar('/write', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ device: imp.bruto, data: zpl }) }, f);
  }

  /* ---------- Navegador (diálogo de impressão do sistema) ---------- */
  const NAVEGADOR = { adaptador: 'navegador', id: 'navegador', nome: 'Diálogo de impressão do navegador', conexao: 'driver do Windows', fabricante: '', bruto: null };
  function imprimirNavegador(html) {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') { reject(new Error('Sem navegador.')); return; }
      const fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      fr.onload = () => {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); resolve(); } catch (e) { reject(e); }
        setTimeout(() => fr.remove(), 60000);
      };
      document.body.appendChild(fr);
      fr.srcdoc = html;
    });
  }

  /* ---------- Reunião dos adaptadores ---------- */
  // Pergunta a cada adaptador o que ele enxerga. Falha de um adaptador não derruba os outros.
  async function detectarTodas(f) {
    const impressoras = [], erros = {};
    try { impressoras.push(...await detectarBrowserPrint(f)); } catch (e) { erros['zebra-browser-print'] = e.message; }
    impressoras.push(NAVEGADOR);
    return { impressoras, erros };
  }

  // Escolha por computador (não é segredo; fica no navegador do posto).
  const CHAVE = 'vp_etiquetas_impressora';
  function lerEscolha() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function salvarEscolha(esc) { try { localStorage.setItem(CHAVE, JSON.stringify(esc)); } catch (e) { /* sem armazenamento: vale só nesta sessão */ } }

  window.EtiquetasImpressoras = {
    PERFIS, perfilPorId, casarPerfil, NAVEGADOR,
    detectarBrowserPrint, enviarBrowserPrint, imprimirNavegador, detectarTodas, lerEscolha, salvarEscolha,
    _resetarBase: () => { bpBase = null; },
  };
}());
