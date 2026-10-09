/* ============================================================
   proposta-acabamentos-engine.js — categorias/campos dinâmicos pra
   seção "Acabamentos" da Proposta, no mesmo padrão da Ficha Técnica
   (window.FT): cada campo tem um checkbox "ativo" — só o que está
   marcado entra no PDF gerado — e o vendedor pode criar campos e
   categorias novos, que ficam disponíveis (via biblioteca persistente,
   ver proposta-acabamentos-store.js) pras próximas propostas também.

   Os 13 campos que já existiam (fixos, formulário estático) viram uma
   categoria "nativa" não-removível — pedido explícito: nenhuma proposta
   já salva pode perder o que já tinha preenchido.

   window.PropostaAcabamentosEngine
   ============================================================ */
(function () {
  'use strict';

  const CAT_NATIVA_ID = 'acab_nativos';

  /* Espelha exatamente os 13 campos do antigo S_Acabamentos fixo
     (proposta-form.jsx) — mesma label, mesmo tipo de input. `opcoesKey`
     aponta pra OPTIONS.<chave> (proposta-form.jsx) quando é um select. */
  const NATIVOS = [
    { k: 'modeloCabine', nome: 'Modelo da Cabine', tipo: 'select', opcoesKey: 'modeloCabine' },
    { k: 'acabamentoMat', nome: 'Acabamento (material)', tipo: 'select', opcoesKey: 'acabamentoMaterial' },
    { k: 'subTeto', nome: 'Sub-teto', tipo: 'select', opcoesKey: 'subTeto' },
    { k: 'painelOperacao', nome: 'Painel de Operação / Botoeira de Cabine', tipo: 'select', opcoesKey: 'painelOperacao' },
    { k: 'pisoCabina', nome: 'Piso da Cabina', tipo: 'select', opcoesKey: 'pisoCabina' },
    { k: 'medidasPiso', nome: 'Medidas do Piso', tipo: 'text' },
    { k: 'modeloPorta', nome: 'Modelo de Porta', tipo: 'select', opcoesKey: 'modeloPorta' },
    { k: 'dimPortaCabine', nome: 'Dimensão da Porta de Cabine', tipo: 'text' },
    { k: 'acabPortaCabine', nome: 'Acabamento Porta Cabine', tipo: 'select', opcoesKey: 'acabPortaCabine' },
    { k: 'portasPavimento', nome: 'Portas de Pavimento', tipo: 'select', opcoesKey: 'portasPavimento' },
    { k: 'botoeirasPavimento', nome: 'Botoeiras de Pavimento', tipo: 'select', opcoesKey: 'botoeirasPavimento' },
    { k: 'sinalizacao', nome: 'Sinalização', tipo: 'text' },
    { k: 'pavInox', nome: 'Pavimentos com acabamento Inox', tipo: 'text' },
    { k: 'demais', nome: 'Demais acabamentos', tipo: 'textarea' },
  ];

  function normalizeNome(s) {
    return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* id de categoria custom — sem sufixo aleatório na biblioteca (nome único
     por normalizeNome), mas com sufixo aqui pra nunca colidir dentro de uma
     única proposta antes de sincronizar. */
  function slugCategoria(nome) {
    return 'pc_' + normalizeNome(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
      + '_' + Math.random().toString(36).slice(2, 6);
  }

  /* Chave de campo estável (cat_id, k) — usada tanto na proposta quanto na
     biblioteca, então sem sufixo aleatório (senão nunca dá pra saber se já
     existe um campo com esse nome). */
  function fieldKey(nome) {
    return 'fl_' + normalizeNome(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  }

  /* Migra o objeto plano antigo (data.elevador.acabamentos, ex.:
     {modeloCabine:"VP-200", ...}) pra dentro da categoria nativa —
     roda só na 1ª vez que uma proposta salva ANTES dessa mudança é
     reaberta no editor. ativo=true só quando já tinha valor, pra manter
     o mesmo comportamento visual de antes ("só mostra o preenchido"). */
  function catNativaFromLegacy(legacy) {
    const l = legacy || {};
    return {
      id: CAT_NATIVA_ID, nome: 'Acabamentos', custom: false,
      campos: NATIVOS.map((n, i) => ({
        k: n.k, nome: n.nome, tipo: n.tipo, opcoesKey: n.opcoesKey || null,
        valor: l[n.k] || '', ativo: !!l[n.k], ordem: i, custom: false,
      })),
    };
  }

  /* Cache da biblioteca persistente (carregada via
     PropostaAcabamentosStore.loadLibrary). Mesmo padrão do FT_LIB_EXTRAS. */
  let LIB_EXTRAS = { cats: [], campos: [] };
  function setLibraryExtras(extras) {
    LIB_EXTRAS = { cats: (extras && extras.cats) || [], campos: (extras && extras.campos) || [] };
  }

  /* Acrescenta categorias/campos custom da biblioteca que ainda não estão
     nesta proposta — nunca sobrescreve o que já tem (mesma regra da Ficha
     Técnica: biblioteca só afeta o que uma proposta NOVA/ainda sem esse
     campo vai oferecer). */
  function mergeComBiblioteca(cats) {
    const out = cats.map((c) => ({ ...c, campos: c.campos.map((f) => ({ ...f })) }));
    LIB_EXTRAS.cats.forEach((cat) => {
      if (out.find((x) => x.id === cat.id)) return;
      out.push({ id: cat.id, nome: cat.nome, custom: true, campos: [] });
    });
    LIB_EXTRAS.campos.forEach((fld) => {
      const cat = out.find((c) => c.id === fld.cat_id);
      if (!cat) return;
      if (cat.campos.find((x) => x.k === fld.k)) return;
      cat.campos.push({
        k: fld.k, nome: fld.nome, tipo: fld.tipo || 'text', opcoesKey: null,
        valor: '', ativo: false, ordem: cat.campos.length, custom: true,
      });
    });
    return out;
  }

  /* Ponto de entrada usado pelo editor: garante que sempre existe pelo
     menos a categoria nativa (migrando do legado se preciso) e já mesclado
     com a biblioteca. */
  function garantirCats(elevador) {
    const existentes = (Array.isArray(elevador.acabamentosCats) && elevador.acabamentosCats.length)
      ? elevador.acabamentosCats
      : [catNativaFromLegacy(elevador.acabamentos)];
    return mergeComBiblioteca(existentes);
  }

  window.PropostaAcabamentosEngine = {
    CAT_NATIVA_ID, NATIVOS,
    normalizeNome, slugCategoria, fieldKey,
    catNativaFromLegacy, setLibraryExtras, mergeComBiblioteca, garantirCats,
  };
}());
