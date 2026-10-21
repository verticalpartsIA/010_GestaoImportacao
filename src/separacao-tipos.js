/* ============================================================
   separacao-tipos.js — tipo de cada item na Separação (21/10/2026, issue #1027, fase 1).
   O tipo vem de uma lista de CÓDIGOS cadastrada pelo time (tabela separacao_tipo_item), não da
   família do Omie: cabo de manobra e cabo modular nem estão em pcp_produtos.
   Funções puras. Código sempre em MAIÚSCULAS e sem espaço nas pontas.
   ============================================================ */
(function () {
  const TIPOS = {
    cabo_aco: { rotulo: 'Cabo de aço', corte: true },
    cabo_manobra: { rotulo: 'Cabo de manobra', corte: true },
    cabo_modular: { rotulo: 'Cabo elétrico modular', corte: false },
    corrimao: { rotulo: 'Corrimão', corte: false },
    cabo_aco_porta: { rotulo: 'Cabo de aço de porta (já cortado)', corte: false },
  };

  const norm = (c) => String(c == null ? '' : c).trim().toUpperCase();
  const rotulo = (tipo) => (TIPOS[tipo] ? TIPOS[tipo].rotulo : '—');

  // lista [{codigo, tipo, ativo}] -> Map(CÓDIGO -> tipo); item inativo não entra
  function indice(lista) {
    const m = new Map();
    (lista || []).forEach((l) => { if (l && l.ativo !== false && norm(l.codigo) && TIPOS[l.tipo]) m.set(norm(l.codigo), l.tipo); });
    return m;
  }
  const tipoDoCodigo = (idx, codigo) => { const c = norm(codigo); return c && idx && idx.has(c) ? idx.get(c) : null; };

  // peças que só CITAM cabo/corrimão (polia do cabo, rolete do corrimão…) e cabos que são matéria-prima
  const PECA = /(polia|limitador|tirante|rolete|corrente|protetor|guia|suporte|dispositivo|mancal|sensor|roseta|carrinho|cobertura|microrruptor|emenda|flex[ií]vel)/i;
  const CITA = /(cabo|corrim)/i;
  function ehSuspeito(descricao) {
    const d = String(descricao || '');
    return CITA.test(d) && !PECA.test(d);
  }
  // palpite pela descrição (só sugestão; quem cadastra confirma). Modular vem antes: a descrição dele cita "Quadro de Comando".
  function sugerirTipo(descricao) {
    const d = String(descricao || '');
    if (/modular/i.test(d)) return 'cabo_modular';
    if (/cabo de a[cç]o/i.test(d)) return 'cabo_aco';
    if (/manobra|cabo de comando/i.test(d)) return 'cabo_manobra';
    if (/corrim/i.test(d)) return 'corrimao';
    return null;
  }

  // itens de pedido [{codigo, descricao}] -> códigos suspeitos que ainda NÃO estão na lista (um por código)
  function sugestoes(itens, idx) {
    const vistos = new Set(); const out = [];
    (itens || []).forEach((i) => {
      const c = norm(i && i.codigo);
      if (!c || vistos.has(c) || tipoDoCodigo(idx, c) || !ehSuspeito(i.descricao)) return;
      vistos.add(c);
      out.push({ codigo: c, descricao: i.descricao, tipo_sugerido: sugerirTipo(i.descricao) });
    });
    return out;
  }

  window.SeparacaoTipos = { TIPOS, rotulo, norm, indice, tipoDoCodigo, ehSuspeito, sugerirTipo, sugestoes };
}());
