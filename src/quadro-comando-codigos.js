/* ============================================================
   quadro-comando-codigos.js — código do Omie de cada item do Escopo
   (Quadro de Comando, 28/10/2026)

   O formulário público só diz "quero COP / LOP / porta / máquina"; o
   vendedor escolhe no hub QUAL produto do Omie é. Este módulo:
     - filtra o catálogo do Omie (importacao_varejo_produtos) por item;
     - SUGERE o código a partir das respostas do cliente (o vendedor só
       confirma ou troca);
     - transforma os códigos escolhidos em linhas do BOM.
   Funções puras (testadas em quadro-comando-codigos.test.js), exceto
   carregarCatalogo(), que lê o Supabase.
   ============================================================ */
(function () {
  const decodificar = (t) => String(t == null ? '' : t)
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();

  /* Itens do Escopo que têm lista suspensa de código. `re` casa com a descrição do Omie. */
  const ITENS = {
    cop: { re: /^Botoeira de Cabina/i },
    lop: { re: /^Botoeira de Pavimento/i },
    lip: { re: /^(Display Indicador|Indicador de Posi)/i },
    resgate_automatico: { re: /^Resgate/i },
    interfone: { re: /^Interfone/i },
    botoeira_inspecao_cabina: { re: /^Botoeira de Inspe[cç][aã]o.*cabina/i },
    botoeira_inspecao_poco: { re: /^Botoeira de Inspe[cç][aã]o.*po[cç]o/i },
    botao_stop_poco: { re: /^Bot[aã]o Stop/i },
    gongo: { re: /gongo/i },
    anuncio_voz: { re: /an[uú]ncio de voz|sintetizador de voz/i },
    sensor_fotoeletrico: { re: /^Sensor Fotoel/i },
    barreira_luz: { re: /^Barreira de Prote[cç][aã]o Infravermelha/i },
    pesador_carga: { re: /pesador|pesagem/i },
    camera: { re: /c[aâ]mera/i },
    maquina_tracao: { codigoRe: /^VPMAC/i },
    portas: { re: /^Porta.*cabina/i },               // porta de cabina (campo `codigo`)
    portas_pavimento: { re: /^Porta.*pavimento/i },   // porta de pavimento (campo `codigo_pavimento`)
  };
  const SEM_PORTA = /^(PRD|VPKIT)/i;

  /* Famílias de botoeira de pavimento: um código de qualquer posição escolhe a família inteira. */
  const LOP_FAMILIAS = {
    vidro_sem: { desce: 'VPB-033', sobe: 'VPB-034', dois: 'VPB-035' },
    vidro_com: { desce: 'VPB-038', sobe: 'VPB-039', dois: 'VPB-037' },
    aco_sem: { desce: 'VPB-316', sobe: 'VPB-315', dois: 'VPB-317' },
    aco_com: { desce: 'VPB-064', sobe: 'VPB-063', dois: 'VPB-065' },
  };

  function normalizar(lista) {
    return (lista || []).map((r) => ({ codigo: String(r.codigo), descricao: decodificar(r.descricao) }));
  }

  /* Opções da lista suspensa de um item (chave de ITENS). */
  function opcoes(chave, lista) {
    const f = ITENS[chave];
    if (!f) return [];
    return normalizar(lista).filter((r) => {
      if (f.codigoRe) return f.codigoRe.test(r.codigo);
      if (SEM_PORTA.test(r.codigo) && (chave === 'portas' || chave === 'portas_pavimento')) return false;
      if (/^c[oó]pia/i.test(r.descricao)) return false;
      return f.re.test(r.descricao);
    });
  }

  function familiaDoCodigo(codigo) {
    const c = String(codigo || '');
    for (const [nome, fam] of Object.entries(LOP_FAMILIAS)) {
      if (Object.values(fam).includes(c)) return { nome, ...fam };
    }
    return null;
  }

  const existe = (lista, codigo) => normalizar(lista).some((r) => r.codigo === codigo);

  /* Sugere o código de um item a partir do que o cliente respondeu. `ctx`: { paradas, resp } (resp = respostas_publico).
     Devolve o código ou null (sem sugestão segura → o vendedor escolhe). */
  function sugerir(chave, ctx, lista) {
    const resp = (ctx && ctx.resp) || {};
    const n = parseInt(ctx && ctx.paradas, 10) || 0;
    const ops = opcoes(chave, lista);
    const tem = (c) => (existe(ops, c) ? c : null);

    if (chave === 'cop') {
      if (resp.cop_display === 'sem') return tem('VPB-318');
      if (resp.cop_display === 'com') {
        const exato = ops.find((o) => new RegExp(`Vidro Preto, ${n} Andares`, 'i').test(o.descricao));
        return exato ? exato.codigo : tem('VPB-351');
      }
      return null;
    }
    if (chave === 'lop') {
      if (!resp.lop_material || !resp.lop_display) return null;
      const fam = LOP_FAMILIAS[`${resp.lop_material === 'vidro' ? 'vidro' : 'aco'}_${resp.lop_display === 'com' ? 'com' : 'sem'}`];
      return tem(String(resp.lop_botoes) === '1' ? fam.sobe : fam.dois);
    }
    if (chave === 'lip') return resp.ind_cor === 'azul' ? tem('VPB-107') : tem('VPEL-686');
    if (chave === 'botoeira_inspecao_cabina') return tem('VPB-208');
    if (chave === 'botoeira_inspecao_poco') return tem('VPB-380');
    if (chave === 'botao_stop_poco') return tem('VPEL-378');
    if (chave === 'portas' || chave === 'portas_pavimento' || chave === 'maquina_tracao') return null; // o cliente já escolheu na página; vem de lá
    return ops.length === 1 ? ops[0].codigo : null; // só um produto possível no Omie
  }

  /* Quantidade padrão de cada item (o vendedor pode editar). */
  function quantidadePadrao(chave, paradasRows) {
    const rows = paradasRows || [];
    const frente = rows.filter((p) => p.abertura_frontal !== false).length || rows.length;
    const opostas = rows.filter((p) => p.abertura_traseira).length;
    if (chave === 'lip') return { qtd: frente + opostas, estimado: true, regra: 'Um indicador sobre a porta de cada parada (frente + porta oposta).' };
    if (chave === 'portas') return { qtd: 1 + (opostas ? 1 : 0), estimado: true, regra: 'Uma porta de cabina por face (frente e, se houver, oposta).' };
    if (chave === 'portas_pavimento') return { qtd: frente + opostas, estimado: true, regra: 'Uma porta de pavimento por parada (frente + porta oposta).' };
    return { qtd: 1, estimado: false, regra: '1 por elevador.' };
  }

  /* Linhas do BOM para os códigos escolhidos no Escopo. A LOP fica de fora (o motor monta pelas famílias),
     assim como o que já está na lista (`jaNoBom`: conjunto de SKUs). Item "fornecer" sem código vira pendência. */
  function itensDoEscopo(escopo, paradasRows, lista, jaNoBom) {
    const esc = escopo || {};
    const cat = {};
    normalizar(lista).forEach((r) => { cat[r.codigo] = r; });
    const vistos = new Set(jaNoBom || []);
    const itens = [];
    const pendentes = [];
    const chaves = ['cop', 'lip', 'resgate_automatico', 'interfone', 'botoeira_inspecao_cabina', 'botoeira_inspecao_poco', 'botao_stop_poco',
      'gongo', 'anuncio_voz', 'sensor_fotoeletrico', 'barreira_luz', 'pesador_carga', 'camera', 'maquina_tracao', 'portas'];
    const adicionar = (chave, codigo, rotulo, qtdChave, v) => {
      if (!codigo || vistos.has(codigo)) return;
      vistos.add(codigo);
      const q = quantidadePadrao(qtdChave, paradasRows);
      const manual = Number(String(v.quantidade == null ? '' : v.quantidade).replace(',', '.'));
      const quantidade = Number.isFinite(manual) && manual > 0 ? manual : q.qtd;
      itens.push({
        sku: codigo,
        descricao: (cat[codigo] && cat[codigo].descricao) || codigo,
        unidade: 'un', grupo_separacao: 'componentes', quantidade,
        origem: 'calculado_geometria',
        confianca: q.estimado && !(manual > 0) ? 'estimado' : 'confirmado',
        memoria_calculo: `Escopo: ${rotulo} (código escolhido no hub). ${manual > 0 ? 'Quantidade informada pelo vendedor.' : q.regra}`,
      });
    };
    chaves.forEach((chave) => {
      const v = esc[chave] || {};
      if (v.decisao !== 'fornecer') return;
      // As botoeiras de inspeção já têm código padrão no motor (montarItensInspecao); só entram aqui se o vendedor trocou.
      if (chave === 'botoeira_inspecao_cabina' || chave === 'botoeira_inspecao_poco') return;
      if (chave === 'portas') {
        if (!v.codigo && !v.codigo_pavimento) pendentes.push('Portas');
        adicionar(chave, v.codigo, 'Porta de Cabina', 'portas', v);
        adicionar(chave, v.codigo_pavimento, 'Porta de Pavimento', 'portas_pavimento', { ...v, quantidade: v.quantidade_pavimento });
        return;
      }
      if (!v.codigo) { pendentes.push(chave); return; }
      adicionar(chave, v.codigo, chave, chave, v);
    });
    return { itens, pendentes };
  }

  /* Lê o catálogo do Omie (espelho) só com o que as listas precisam. */
  let cacheCatalogo = null;
  async function carregarCatalogo(sb) {
    if (cacheCatalogo) return cacheCatalogo;
    if (!sb) return [];
    const padroes = ['Botoeira de %', 'Display Indicador%', 'Indicador de Posi%', 'Resgate%', 'Interfone%', 'Bot_o Stop%', '%gongo%',
      '%voz%', 'Sensor Fotoel%', 'Barreira de Prote%', '%pesador%', '%c_mera%', 'Porta%'];
    const filtro = [...padroes.map((p) => `descricao.ilike.${p}`), 'codigo.ilike.VPMAC%'].join(',');
    const { data, error } = await sb.from('importacao_varejo_produtos').select('codigo, descricao').eq('ativo', true).or(filtro).order('codigo').limit(1000);
    if (error) throw error;
    cacheCatalogo = normalizar(data);
    return cacheCatalogo;
  }

  window.QuadroComandoCodigos = { ITENS, LOP_FAMILIAS, opcoes, sugerir, familiaDoCodigo, quantidadePadrao, itensDoEscopo, carregarCatalogo, decodificar };
}());
