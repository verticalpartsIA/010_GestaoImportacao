/* ============================================================
   fiacao-quadro-engine.js — Lista de fios do quadro de comando.
   Função pura: dada a lista de fios (cada fio = origem, destino, cor, bitola, comprimento),
   a variante do quadro (potência_tensão) e os cadastros de-para, devolve o que separar:
   metros de cada fio, pontas de cada terminal (terminal duplo = 1 peça p/ 2 pontas) e
   1 conector Mini-Fit por conector distinto (vias informadas pela Engenharia).
   Só a bitola grossa (>= bitolaBase, hoje 6 mm²) muda com a variante; as finas não mudam.
   Variante sem bitola grossa cadastrada -> não calcula (ok:false) e a tela avisa.
   ============================================================ */
(function () {
  const num = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
  const sem = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const arred = (n) => Math.round(n * 100) / 100;

  /* 'Tubular', 'Tubular duplo', 'Mini fit', 'Forquilha', 'Olhal', 'Faston' -> chave estável */
  function chaveTipo(t) {
    const s = sem(t).replace(/[-_]/g, ' ');
    if (s.includes('MINI')) return 'minifit';
    if (s.includes('DUPLO')) return 'tubular_duplo';
    if (s.includes('TUBULAR')) return 'tubular';
    if (s.includes('FORQUILHA')) return 'forquilha';
    if (s.includes('OLHAL')) return 'olhal';
    if (s.includes('FASTON')) return 'faston';
    return s.toLowerCase() || null;
  }
  /* 'PT', 'VD+AM', 'AZ' -> chave estável */
  function chaveCor(c) {
    const s = sem(c).replace(/\s/g, '');
    if (['VD+AM', 'VDAM', 'VD/AM', 'VERDE+AMARELO', 'VERDE/AMARELO', 'VERDEAMARELO'].includes(s)) return 'VD+AM';
    if (['PT', 'PRETO'].includes(s)) return 'PT';
    if (['AZ', 'AZUL'].includes(s)) return 'AZ';
    return s;
  }
  /* 'KY9/4' -> 'KY9' (o conector); borne sem barra -> o próprio borne */
  function conectorDe(borne) { return norm(String(borne || '').split('/')[0]); }

  function bitolaEfetiva(bitola, variante, cfg) {
    const b = num(bitola);
    const base = num(cfg.bitolaBase) || 6;
    if (b < base) return { bitola: b };
    const g = num((cfg.bitolaGrossaPorVariante || {})[variante]);
    if (!g) return { bitola: b, semBitola: true };
    return { bitola: g };
  }

  /* fios: [{ tag, origem:{comp,borne,tipo}, destino:{comp,borne,tipo}, cor, bitola, comprimentoCm }]
     cfg: { bitolaBase, bitolaGrossaPorVariante:{'7.5_220':10,..},
            fios:[{cor,bitola,codigo}], terminais:[{tipo,bitola,codigo}] (bitola nula = qualquer),
            conectores:[{nome, vias, codigo}] } */
  function calcular(fios, variante, cfg) {
    cfg = cfg || {};
    const avisos = [];
    const lista = (fios || []).filter(f => f && num(f.comprimentoCm) > 0);
    const precisaGrossa = lista.some(f => num(f.bitola) >= (num(cfg.bitolaBase) || 6));
    if (precisaGrossa && !num((cfg.bitolaGrossaPorVariante || {})[variante])) {
      return { ok: false, motivo: `A variante ${variante || '(não identificada)'} não tem bitola grossa cadastrada — a lista de fios não foi aplicada.`, itens: [], avisos };
    }

    const metros = new Map();      // chave cor|bitola -> metros
    const pontas = new Map();      // chave tipo|bitola -> pontas
    const conectores = new Set();
    const mapFio = new Map((cfg.fios || []).map(x => [`${chaveCor(x.cor)}|${num(x.bitola)}`, x.codigo]));
    const mapTerm = (tipo, bitola) => {
      const t = (cfg.terminais || []);
      const ach = t.find(x => chaveTipo(x.tipo) === tipo && num(x.bitola) === bitola) || t.find(x => chaveTipo(x.tipo) === tipo && !num(x.bitola));
      return ach ? ach.codigo : null;
    };

    lista.forEach(f => {
      const { bitola } = bitolaEfetiva(f.bitola, variante, cfg);
      const kf = `${chaveCor(f.cor)}|${bitola}`;
      metros.set(kf, (metros.get(kf) || 0) + num(f.comprimentoCm) / 100);
      [f.origem, f.destino].forEach(p => {
        const tipo = chaveTipo(p && p.tipo);
        if (!tipo) return;
        const kt = tipo === 'minifit' ? 'minifit|0' : `${tipo}|${bitola}`;
        pontas.set(kt, (pontas.get(kt) || 0) + 1);
        if (tipo === 'minifit' && p.borne) conectores.add(conectorDe(p.borne));
      });
    });

    const itens = [];
    [...metros.entries()].sort().forEach(([k, m]) => {
      const [cor, b] = k.split('|');
      const codigo = mapFio.get(`${cor}|${num(b)}`) || null;
      itens.push({ tipo: 'fio', cor, bitola: num(b), codigo, quantidade: arred(m), unidade: 'm', descricao: `Fio ${cor === 'VD+AM' ? 'verde/amarelo' : cor === 'AZ' ? 'azul' : 'preto'} ${num(b)} mm²` });
      if (!codigo) avisos.push(`Fio ${cor} ${num(b)} mm² sem código no de-para.`);
    });
    [...pontas.entries()].sort().forEach(([k, n]) => {
      const [tipo, b] = k.split('|');
      const bit = num(b);
      const qtd = tipo === 'tubular_duplo' ? Math.ceil(n / 2) : n;
      const codigo = mapTerm(tipo, bit);
      itens.push({ tipo: 'terminal', tipoTerminal: tipo, bitola: bit || null, codigo, quantidade: qtd, unidade: 'un', pontas: n, descricao: `Terminal ${tipo.replace('_', ' ')}${bit ? ` ${bit} mm²` : ''}` });
      if (!codigo) avisos.push(`Terminal ${tipo}${bit ? ` ${bit} mm²` : ''} sem código no de-para.`);
    });
    const mapCon = new Map((cfg.conectores || []).map(c => [norm(c.nome), c]));
    [...conectores].sort().forEach(nome => {
      const c = mapCon.get(nome);
      itens.push({ tipo: 'conector', nome, vias: c ? num(c.vias) || null : null, codigo: c ? c.codigo || null : null, quantidade: 1, unidade: 'un', descricao: `Conector Mini-Fit ${nome}${c && c.vias ? ` (${c.vias} vias)` : ''}` });
      if (!c || !c.codigo) avisos.push(`Conector ${nome} sem vias/código cadastrado.`);
    });

    return { ok: true, itens, avisos, totais: { fios: lista.length, conectores: conectores.size } };
  }

  /* Códigos que a lista cobre: a OP deve tirar do Omie/formulário as linhas equivalentes (a lista manda). */
  function codigosCobertos(resultado) {
    return new Set((resultado && resultado.itens || []).map(i => i.codigo).filter(Boolean));
  }

  /* Soma a lista de fios aos materiais da OP: a lista manda nos códigos que ela cobre. */
  function aplicarAosMateriais(materiais, resultado) {
    if (!resultado || !resultado.ok) return { materiais, aplicado: false };
    const cobertos = codigosCobertos(resultado);
    const resto = (materiais || []).filter(m => !cobertos.has(m.codigo));
    const novos = resultado.itens.filter(i => i.codigo).map(i => ({
      codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
      quantidade_unit: i.quantidade, necessario: i.quantidade,
    }));
    return { materiais: resto.concat(novos), aplicado: true, removidos: (materiais || []).length - resto.length };
  }

  const API = { calcular, codigosCobertos, aplicarAosMateriais, chaveTipo, chaveCor, conectorDe };
  if (typeof window !== 'undefined') window.FiacaoQuadro = API;
  if (typeof module !== 'undefined') module.exports = API;
}());
