/* ============================================================
   portas-vidro-calc.js — portas de VIDRO por pavimento e na cabina (12/11/2026, pedido do Gelson)
   Regra pura (sem tela, sem banco). window.PortasVidro

   Onde mora o dado: `unidade.especificacoes.portas_vidro` (jsonb que já existe na unidade; sem migration).
   As colunas `acabamento_porta_cabina` / `acabamento_porta_pavimento` continuam guardando o AÇO (um só por
   equipamento: Aço 304 OU Aço 430 OU Pintado, nunca misturados). Vidro é uma EXCEÇÃO sobre esse aço.

   Formato:
   { cabina:    { base, frente, oposta },
     pavimento: { base, modo: 'todos' | 'alguns', frente, oposta, andares: [{ n, frente, oposta }] } }
   - `base` = material das portas que NÃO são de vidro (uma das opções de aço).
   - `frente` / `oposta` = a porta daquele lado é de vidro. `oposta` só vale quando o equipamento tem porta oposta.
   - modo 'todos': `frente`/`oposta` valem para todos os pavimentos. modo 'alguns': só os `andares` marcados.
   - Um alvo sem vidro some do objeto (null).
   ============================================================ */
(function () {
  const ACOS = ['Aço 304', 'Aço 430', 'Pintado'];
  const EN_ZH = { 'aco 304': ['Stainless steel 304', '304不锈钢'], 'aco 430': ['Stainless steel 430', '430不锈钢'], pintado: ['Painted', '喷漆'] };
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  /* "Sim", "Sim - 180°" = tem porta oposta. "Não", vazio ou outro texto = não tem. */
  function temOposta(portaOposta) { return /^sim\b/.test(norm(portaOposta)); }

  /* Lista de pavimentos 1..paradas. O rótulo vem de "Térreo, 1, 2, 3" só se a contagem bater; senão "Pav. n". */
  function andares(paradas, pavimentosDesc) {
    const total = Math.max(0, Math.min(200, parseInt(paradas, 10) || 0));
    const partes = String(pavimentosDesc || '').split(',').map((s) => s.trim()).filter(Boolean);
    const usa = partes.length === total;
    const out = [];
    for (let n = 1; n <= total; n++) out.push({ n, rotulo: usa ? partes[n - 1] : 'Pav. ' + n });
    return out;
  }

  const baseValida = (b) => (ACOS.includes(b) ? b : '');
  const flag = (v) => v === true;

  /* Aceita lixo (null, texto, formato antigo) e devolve sempre algo seguro. */
  function normalizar(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const out = { cabina: null, pavimento: null };
    if (r.cabina && typeof r.cabina === 'object') {
      const c = { base: baseValida(r.cabina.base), frente: flag(r.cabina.frente), oposta: flag(r.cabina.oposta) };
      if (c.frente || c.oposta) out.cabina = c;
    }
    if (r.pavimento && typeof r.pavimento === 'object') {
      const p = r.pavimento;
      const modo = p.modo === 'alguns' ? 'alguns' : 'todos';
      const lista = (Array.isArray(p.andares) ? p.andares : [])
        .map((a) => ({ n: parseInt(a && a.n, 10), frente: flag(a && a.frente), oposta: flag(a && a.oposta) }))
        .filter((a) => a.n > 0 && (a.frente || a.oposta))
        .sort((a, b) => a.n - b.n)
        .filter((a, i, arr) => i === 0 || arr[i - 1].n !== a.n);
      const v = { base: baseValida(p.base), modo, frente: flag(p.frente), oposta: flag(p.oposta), andares: modo === 'alguns' ? lista : [] };
      if (modo === 'todos' ? (v.frente || v.oposta) : lista.length) out.pavimento = v;
    }
    return out;
  }

  const portas = (u) => normalizar(u && u.especificacoes && u.especificacoes.portas_vidro);
  const ativo = (u, alvo) => !!portas(u)[alvo];

  /* Quando o equipamento NÃO tem porta oposta, `oposta` não vale (a tela esconde, aqui garantimos). */
  function semOposta(p, tem) {
    if (tem || !p) return p;
    const c = { ...p, oposta: false };
    if (c.andares) c.andares = c.andares.map((a) => ({ ...a, oposta: false })).filter((a) => a.frente);
    return c;
  }

  /* ---------- textos ---------- */
  const T = {
    pt: { vidro: 'Vidro', todos: 'em todos os pavimentos', nos: 'nos pavimentos', frente: 'frente', oposta: 'oposta', fe: 'frente e oposta',
      pF: 'porta de frente', pO: 'porta oposta', pFO: 'porta de frente e porta oposta', outras: 'demais portas em', outra: 'porta', aDef: 'material a definir', em: 'em' },
    en: { vidro: 'Glass', todos: 'at all landings', nos: 'at landings', frente: 'front', oposta: 'opposite', fe: 'front and opposite',
      pF: 'front door', pO: 'opposite door', pFO: 'front and opposite doors', outras: 'other doors in', outra: 'door', aDef: 'material to be defined', em: 'in' },
    zh: { vidro: '玻璃', todos: '所有楼层', nos: '楼层：', frente: '前门', oposta: '对侧门', fe: '前门和对侧门',
      pF: '前门', pO: '对侧门', pFO: '前门和对侧门', outras: '其余门为', outra: '门', aDef: '材质待定', em: '' },
  };
  function nomeBase(base, lang) {
    if (!base) return T[lang].aDef;
    if (lang === 'pt') return base;
    const par = EN_ZH[norm(base)];
    return par ? par[lang === 'en' ? 0 : 1] : base;
  }
  function facesTxt(f, o, lang) { return f && o ? T[lang].fe : f ? T[lang].frente : T[lang].oposta; }

  /* Texto de um alvo em UM idioma. `tem` = equipamento com porta oposta. `rot` = n → rótulo do pavimento. */
  function textoAlvo(p, alvo, lang, tem, rot) {
    const t = T[lang];
    const base = nomeBase(p.base, lang);
    const sep = lang === 'zh' ? '；' : '; ';
    if (alvo === 'cabina' || p.modo === 'todos') {
      const escopo = alvo === 'cabina' ? '' : ' ' + t.todos;
      if (!tem) return t.vidro + escopo;
      if (p.frente && p.oposta) return `${t.vidro}${escopo} (${t.pFO})`;
      const vid = p.frente ? t.pF : t.pO, aco = p.frente ? t.pO : t.pF;
      return `${t.vidro}${escopo} (${vid}); ${aco} ${t.em} ${base}`.replace('  ', ' ');
    }
    const lista = p.andares.map((a) => {
      const nome = rot(a.n);
      return tem ? `${nome} (${facesTxt(a.frente, a.oposta, lang)})` : nome;
    }).join(', ');
    return `${t.vidro} ${t.nos} ${lista}${sep}${t.outras} ${base}`;
  }

  /* Descrição final de uma porta do equipamento (alvo 'cabina' | 'pavimento').
     Sem vidro → devolve o texto da coluna do aço, igual a antes. lang: 'pt' | 'en' | 'zh' | 'tri' (pt / en / zh). */
  function descricao(u, alvo, lang) {
    const col = String((u && u['acabamento_porta_' + alvo]) || '');
    const tem = temOposta(u && u.porta_oposta);
    const p = semOposta(portas(u)[alvo], tem);
    if (!p || !(p.modo === 'alguns' ? p.andares.length : (p.frente || p.oposta))) return col;
    const mapa = {}; andares(u.paradas, u.pavimentos_desc).forEach((a) => { mapa[a.n] = a.rotulo; });
    const rot = (n) => mapa[n] || ('Pav. ' + n);
    const um = (l) => textoAlvo(p, alvo, l, tem, rot);
    return lang === 'tri' ? [um('pt'), um('en'), um('zh')].join(' / ') : um(lang || 'pt');
  }

  /* Erros que impedem de salvar/enviar. [] = ok. */
  function validar(u) {
    const erros = [];
    const bruto = (u && u.especificacoes && u.especificacoes.portas_vidro) || {};
    const tem = temOposta(u && u.porta_oposta);
    const total = parseInt(u && u.paradas, 10) || 0;
    ['cabina', 'pavimento'].forEach((alvo) => {
      const b = bruto[alvo];
      if (!b) return;
      const p = semOposta(portas(u)[alvo], tem);
      const nome = alvo === 'cabina' ? 'cabina' : 'pavimento';
      const vazio = !p || !(p.modo === 'alguns' ? p.andares.length : (p.frente || p.oposta));
      if (vazio) { erros.push(`Porta de ${nome}: marque onde o vidro será usado.`); return; }
      const todasVidro = alvo === 'cabina' || p.modo === 'todos'
        ? (p.frente && (!tem || p.oposta))
        : false;
      if (!todasVidro && !p.base) erros.push(`Porta de ${nome}: informe o material das portas que não são de vidro (Aço 304, Aço 430 ou Pintado).`);
      if (alvo === 'pavimento' && p.modo === 'alguns') {
        if (!total) erros.push('Porta de pavimento: informe o número de paradas antes de escolher os pavimentos com vidro.');
        else if (p.andares.some((a) => a.n > total)) erros.push(`Porta de pavimento: há pavimento marcado acima das ${total} paradas.`);
      }
    });
    return erros;
  }

  /* Valor da coluna do aço a gravar: o material base quando há vidro, senão não mexe. */
  const colunaDoBase = (base) => baseValida(base) || '';

  window.PortasVidro = { ACOS, temOposta, andares, normalizar, ativo, descricao, validar, colunaDoBase };
}());
