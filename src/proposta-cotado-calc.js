/* ============================================================
   proposta-cotado-calc.js — "A proposta nasce com o que foi cotado" (REGRA do Gelson, 13/11/2026).
   Especificação: docs/modulos/04_comercial_pre_venda.md 4.5.10 item 16.

   Funções PURAS (sem banco, sem tela):
   - proposta "cotada" e o que fica travado (FR01);
   - divergências do fornecedor × pedido do vendedor (FR04/FR05);
   - comparação proposta × cotado para o "Conferir" (FR06).

   window.PropostaCotado
   ============================================================ */
(function () {
  'use strict';

  const norm = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase();
  const vazio = (v) => !String(v == null ? '' : v).trim();

  /* Campos de acabamento: chave da Unidade (e do que o fornecedor devolve em `divergencias`) → chave do bloco legado. */
  const CAMPOS_ACABAMENTO = [
    { key: 'modelo', legado: 'modeloCabine', rotulo: 'Modelo da cabine', secao: 'acabamentos' },
    { key: 'aco_cabina', legado: 'acabamentoMat', rotulo: 'Acabamento (material)', secao: 'acabamentos' },
    { key: 'teto_falso', legado: 'subTeto', rotulo: 'Sub-teto', secao: 'acabamentos' },
    { key: 'botoeira_cabine', legado: 'painelOperacao', rotulo: 'Painel de operação / botoeira de cabine', secao: 'acabamentos' },
    { key: 'piso_cabina', legado: 'pisoCabina', rotulo: 'Piso da cabina', secao: 'acabamentos' },
    { key: 'porta_tipo_abertura', legado: 'modeloPorta', rotulo: 'Tipo de abertura da porta', secao: 'acabamentos' },
    { key: 'acabamento_porta_cabina', legado: 'acabPortaCabine', rotulo: 'Acabamento da porta de cabine', secao: 'acabamentos' },
    { key: 'acabamento_porta_pavimento', legado: 'portasPavimento', rotulo: 'Acabamento da porta de pavimento', secao: 'acabamentos' },
    { key: 'botoeira_pavimento', legado: 'botoeirasPavimento', rotulo: 'Botoeira de pavimento', secao: 'acabamentos' },
  ];
  /* Campos de especificação que a proposta herda (chave da Unidade → campo da especificação). */
  const CAMPOS_ESPEC = [
    { key: 'paradas', campo: 'andaresParadasPortas', rotulo: 'Paradas', secao: 'especificacoes' },
    { key: 'tracao', campo: 'tracao', rotulo: 'Tração', secao: 'especificacoes' },
    { key: 'velocidade_ms', campo: 'vel', rotulo: 'Velocidade (m/s)', secao: 'especificacoes' },
    { key: 'tensao_principal', campo: 'tensao', rotulo: 'Tensão de alimentação', secao: 'especificacoes' },
  ];
  const TODOS = CAMPOS_ACABAMENTO.concat(CAMPOS_ESPEC);
  const defDe = (key) => TODOS.find((c) => c.key === key) || null;

  /* O fornecedor responde em texto livre (e em inglês): traduz só o que é seguro traduzir. */
  function traduzir(key, texto) {
    const t = String(texto == null ? '' : texto).trim();
    if (key === 'porta_tipo_abertura') {
      if (/side|lateral/i.test(t)) return 'Lateral';
      if (/cent(er|re|ral)/i.test(t)) return 'Central';
      if (/telesc/i.test(t)) return 'Telescópica';
    }
    return t;
  }

  /* ---------- Divergências do fornecedor (FR04/FR05) ---------- */
  function detectarDivergencias(fontes) {
    const cot = fontes && fontes.cotacao;
    if (!cot) return [];
    const itens = (cot.respostas && cot.respostas.itens) || [];
    const envio = (cot.dados_envio && cot.dados_envio.unidades) || [];
    const unidades = fontes.unidades || [];
    const out = [];
    itens.forEach((it) => {
      const dv = it && it.divergencias;
      if (!dv || typeof dv !== 'object') return;
      const uid = it.unidade_id;
      const env = envio.find((e) => e.unidade_id === uid) || {};
      const un = unidades.find((u) => u.id === uid) || {};
      Object.keys(dv).forEach((key) => {
        const def = defDe(key);
        const bruto = String(dv[key] == null ? '' : dv[key]).trim();
        if (!def || !bruto) return;
        const pedidoBruto = env[key] != null && env[key] !== '' ? env[key] : un[key];
        const cotado = traduzir(key, bruto);
        if (norm(cotado) === norm(pedidoBruto)) return; // o fornecedor só confirmou o que foi pedido
        out.push({
          id: 'div-' + uid + '-' + key,
          unidadeId: uid, identificador: it.unidade_identificador || env.identificador || '',
          key, rotulo: def.rotulo, secao: def.secao,
          pedido: String(pedidoBruto == null ? '' : pedidoBruto).trim(),
          cotado, cotadoOriginal: bruto,
          fornecedor: cot.fornecedor || '', cotacaoId: cot.id || '',
          status: 'pendente', criadaEm: new Date().toISOString(),
        });
      });
    });
    return out;
  }

  function valorCotado(divs, unidadeId, key) {
    const d = (Array.isArray(divs) ? divs : []).find((x) => x.unidadeId === unidadeId && x.key === key);
    return d ? d.cotado : undefined;
  }

  /* Bloco legado de acabamentos de UMA Unidade, já com o que foi realmente cotado
     (resposta do fornecedor > snapshot enviado > Unidade). */
  function legadoDaUnidade(u, tec, divs, opts) {
    const uid = u.id || u.unidade_id;
    tec = tec || {};
    opts = opts || {};
    const val = (k) => {
      const d = valorCotado(divs, uid, k);
      if (d !== undefined) return d;
      const t = tec[k];
      return !vazio(t) ? String(t) : (vazio(u[k]) ? '' : String(u[k]));
    };
    const dim = (l, a) => ((l || a) ? `${l || '?'} x ${a || '?'}mm` : '');
    const ab = String(val('porta_tipo_abertura')).trim();
    const porta = (lado, key) => {
      if (valorCotado(divs, uid, key) !== undefined) return val(key);
      const viaCb = opts.descricaoPorta ? opts.descricaoPorta(u, lado) : '';
      return viaCb || val(key);
    };
    return {
      modeloCabine: val('modelo'),
      acabamentoMat: val('aco_cabina'),
      subTeto: val('teto_falso'),
      painelOperacao: val('botoeira_cabine'),
      pisoCabina: val('piso_cabina'),
      modeloPorta: ab ? `Automática ${ab}` : '',
      dimPortaCabine: dim(val('porta_largura_mm'), val('porta_altura_mm')),
      acabPortaCabine: porta('cabina', 'acabamento_porta_cabina'),
      portasPavimento: porta('pavimento', 'acabamento_porta_pavimento'),
      botoeirasPavimento: val('botoeira_pavimento'),
    };
  }

  /* Aplica à lista de especificações o que o fornecedor cotou diferente (paradas, tração, velocidade, tensão). */
  function aplicarNasEspecs(especs, divs) {
    return (Array.isArray(especs) ? especs : []).map((e) => {
      const o = { ...e };
      CAMPOS_ESPEC.forEach((c) => {
        const v = valorCotado(divs, e.unidadeId, c.key);
        if (v === undefined) return;
        if (c.key === 'paradas') { const n = String(v).replace(/\D/g, ''); if (n) o[c.campo] = `${n} Paradas`; return; }
        o[c.campo] = v;
      });
      return o;
    });
  }

  /* Junta divergências novas às já gravadas: nunca recria nem sobrescreve uma já decidida. */
  function mesclarDivergencias(existentes, novas) {
    const out = Array.isArray(existentes) ? existentes.slice() : [];
    (Array.isArray(novas) ? novas : []).forEach((n) => { if (!out.some((x) => x.id === n.id)) out.push(n); });
    return out;
  }

  const pendentes = (data) => ((data && data.divergencias) || []).filter((d) => d.status === 'pendente' || d.status === 'recusada');

  /* Decisão do vendedor. `recusada` continua bloqueando o envio até alguém reabrir (volta à cotação). */
  function decidir(divs, id, decisao, por, quando) {
    if (!['aceita', 'recusada', 'pendente'].includes(decisao)) throw new Error('Decisão inválida.');
    let achou = false;
    const out = (Array.isArray(divs) ? divs : []).map((d) => {
      if (d.id !== id) return d;
      achou = true;
      return { ...d, status: decisao, decididoPor: decisao === 'pendente' ? null : (por || null), decididoEm: decisao === 'pendente' ? null : (quando || new Date().toISOString()) };
    });
    if (!achou) throw new Error('Divergência não encontrada.');
    return out;
  }

  /* ---------- Proposta "cotada" e o que fica travado (FR01) ---------- */
  function ehCotada(row) {
    return !!(row && row.numero_cotacao != null && row.precificacao_id && (!row.proposal_type || row.proposal_type === 'elevador'));
  }

  /* Valores de acabamento ATIVOS de um bloco (legado ou categorias), sem depender do rótulo: a migração do legado para
     categorias, que o editor faz sozinho ao abrir, não pode parecer "edição". */
  function valoresAcabamento(bloco) {
    const out = [];
    const cats = (b) => {
      if (Array.isArray(b.acabamentosCats) && b.acabamentosCats.length) {
        b.acabamentosCats.forEach((c) => (c.campos || []).forEach((f) => { if (f.ativo !== false && !vazio(f.valor)) out.push(norm(f.valor)); }));
      } else if (b.acabamentos && typeof b.acabamentos === 'object') {
        Object.keys(b.acabamentos).forEach((k) => { if (!vazio(b.acabamentos[k])) out.push(norm(b.acabamentos[k])); });
      }
    };
    cats(bloco || {});
    ((bloco && bloco.perfis) || []).forEach((p) => cats(p || {}));
    return out.sort();
  }

  const CHAVES_ESPEC = ['id', 'modelo', 'carac', 'capacidade', 'dimensoesCaixa', 'profPoço', 'dimensoesCabine', 'vel', 'andaresParadasPortas', 'percurso', 'qtd', 'tracao', 'tensao', 'denominacao'];

  function camposProtegidos(bloco) {
    const b = bloco || {};
    const specs = (Array.isArray(b.especificacoes) ? b.especificacoes : []).map((e) => {
      const o = {};
      CHAVES_ESPEC.forEach((k) => { o[k] = norm(e && e[k]); });
      o.codigos = ((e && e.codigos) || []).map(norm).join('|');
      return o;
    });
    return { especificacoes: specs, acabamentos: valoresAcabamento(b) };
  }

  /* Compara o que está gravado com o que o editor quer gravar. Devolve a lista de seções alteradas. */
  function alteracoesProtegidas(antigo, novo) {
    const a = camposProtegidos(antigo);
    const n = camposProtegidos(novo);
    const secoes = [];
    if (JSON.stringify(a.especificacoes) !== JSON.stringify(n.especificacoes)) secoes.push('Especificações Técnicas');
    if (JSON.stringify(a.acabamentos) !== JSON.stringify(n.acabamentos)) secoes.push('Acabamentos');
    return secoes;
  }

  /* ---------- "Conferir": proposta × cotado (FR06) ---------- */
  function compararComProposta(data, fontes) {
    const achados = [];
    const ed = (data && data.elevador) || {};
    const cot = fontes && fontes.cotacao;
    const envio = (cot && cot.dados_envio && cot.dados_envio.unidades) || [];
    const unidades = (fontes && fontes.unidades) || [];
    const base = envio.length ? envio : unidades;
    const divs = detectarDivergencias(fontes);
    const valoresProposta = valoresAcabamento(ed);
    base.forEach((u) => {
      const uid = u.unidade_id || u.id;
      const un = unidades.find((x) => x.id === uid) || {};
      const ident = u.identificador || un.identificador || uid;
      CAMPOS_ACABAMENTO.forEach((c) => {
        const esperado = valorCotado(divs, uid, c.key) !== undefined ? valorCotado(divs, uid, c.key) : (vazio(u[c.key]) ? un[c.key] : u[c.key]);
        if (vazio(esperado)) return;
        const alvo = c.key === 'porta_tipo_abertura' ? norm(esperado) : norm(esperado);
        const achou = valoresProposta.some((v) => v === alvo || (c.key === 'porta_tipo_abertura' && v.includes(alvo)));
        if (!achou) {
          achados.push({
            id: 'cotado-' + uid + '-' + c.key, gravidade: 'atencao', secao: 'acabamentos',
            titulo: `${c.rotulo} diferente do cotado (${ident})`,
            detalhe: `Cotado: "${esperado}". Na proposta não aparece esse valor nos Acabamentos.`,
          });
        }
      });
      const spec = (ed.especificacoes || []).find((e) => e.unidadeId === uid);
      if (spec) {
        CAMPOS_ESPEC.forEach((c) => {
          const esperado = valorCotado(divs, uid, c.key) !== undefined ? valorCotado(divs, uid, c.key) : (vazio(u[c.key]) ? un[c.key] : u[c.key]);
          if (vazio(esperado)) return;
          const na = norm(spec[c.campo]);
          const alvo = c.key === 'paradas' ? norm(String(esperado).replace(/\D/g, '') + ' paradas') : norm(esperado);
          const ok = c.key === 'vel' || c.key === 'velocidade_ms'
            ? parseFloat(String(spec[c.campo]).replace(',', '.')) === parseFloat(String(esperado).replace(',', '.'))
            : na === alvo || na.includes(alvo);
          if (!ok) {
            achados.push({
              id: 'cotado-' + uid + '-' + c.key, gravidade: 'atencao', secao: 'especificacoes',
              titulo: `${c.rotulo} diferente do cotado (${ident})`,
              detalhe: `Cotado: "${esperado}". Na proposta: "${spec[c.campo] || '—'}".`,
            });
          }
        });
      }
    });
    pendentes(data).forEach((d) => {
      achados.push({
        id: 'div-' + d.id, gravidade: 'impede', secao: d.secao || 'acabamentos',
        titulo: `Divergência do fornecedor sem decisão: ${d.rotulo} (${d.identificador || d.unidadeId})`,
        detalhe: `Pedido: "${d.pedido}". Cotado por ${d.fornecedor || 'o fornecedor'}: "${d.cotado}". ${d.status === 'recusada' ? 'Recusada: aguardando nova cotação.' : 'Aceite ou recuse antes de enviar.'}`,
      });
    });
    return achados;
  }

  window.PropostaCotado = {
    CAMPOS_ACABAMENTO, CAMPOS_ESPEC, traduzir,
    detectarDivergencias, valorCotado, legadoDaUnidade, aplicarNasEspecs, mesclarDivergencias, pendentes, decidir,
    ehCotada, camposProtegidos, alteracoesProtegidas, compararComProposta,
  };
}());
