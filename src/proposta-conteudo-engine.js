/* ============================================================
   proposta-conteudo-engine.js — categorias/campos dinâmicos pras seções
   de conteúdo "de lista" da Proposta (Benefícios, Diferenciais,
   Características Principais, Recursos Inclusos, Infraestrutura e
   Instalação, Responsabilidades) — mesmo padrão da Ficha Técnica e dos
   Acabamentos (proposta-acabamentos-engine.js): cada campo tem um
   checkbox "ativo" — só o marcado entra na proposta — e o vendedor pode
   criar campo/categoria novos, reaproveitáveis nas próximas propostas via
   a MESMA biblioteca compartilhada dos Acabamentos (tabelas
   propostas_lib_categorias/propostas_lib_campos, PropostaAcabamentosStore
   — nomes genéricos o bastante pra servir os dois).

   Migração: o legado é sempre um array de strings (Benefícios,
   Diferenciais, Responsabilidades) ou de {nome, desc} (Recursos,
   Infraestrutura) ou um objeto fixo de 3 campos (Características) —
   cada um vira uma categoria nativa na 1ª vez que a proposta abre no
   editor novo, sem perder nada já preenchido. As categorias nativas em
   si não são removíveis (mapeiam página fixa do PDF), mas todo CAMPO
   dentro delas é — inclusive os migrados.

   window.PropostaConteudoEngine
   ============================================================ */
(function () {
  'use strict';

  /* id categoria → { nome, tipo } — tipo define o shape do campo:
     'texto'     → 1 campo por item, valor = o texto em si (Benefícios,
                   Diferenciais, Responsabilidades)
     'nome_desc' → título (nome) fixo + descrição editável em valor
                   (Recursos Inclusos, Infraestrutura)
     'textarea'  → campo único de texto longo (Características Principais) */
  const CATEGORIAS_NATIVAS = [
    { id: 'cont_beneficios', nome: 'Benefícios', tipoCampo: 'texto' },
    { id: 'cont_diferenciais', nome: 'Diferenciais em Relação ao Mercado', tipoCampo: 'texto' },
    { id: 'cont_caracteristicas', nome: 'Características Principais', tipoCampo: 'textarea' },
    { id: 'cont_recursos', nome: 'Recursos Inclusos', tipoCampo: 'nome_desc' },
    { id: 'cont_infraestrutura', nome: 'Infraestrutura e Instalação', tipoCampo: 'nome_desc' },
    { id: 'cont_resp_vendedor', nome: 'Responsabilidades — VerticalParts', tipoCampo: 'texto' },
    { id: 'cont_resp_comprador', nome: 'Responsabilidades — Comprador', tipoCampo: 'texto' },
  ];

  /* Campos nativos fixos de "Características Principais" — os 3 que já
     existiam como caracteristicasEquip.{alimentacao,comando,tracao}. */
  const CARACTERISTICAS_NATIVAS = [
    { k: 'alimentacao', nome: 'Alimentação Elétrica' },
    { k: 'comando', nome: 'Sistema de Comando de Controle' },
    { k: 'tracao', nome: 'Máquina de Tração' },
  ];

  function normalizeNome(s) {
    return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function slugCategoria(nome) {
    return 'pc_' + normalizeNome(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
      + '_' + Math.random().toString(36).slice(2, 6);
  }
  function fieldKey(nome) {
    return 'fl_' + normalizeNome(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  }

  function campoTexto(texto, i, custom) {
    return { k: fieldKey(texto) + '_' + i, nome: texto, tipo: 'texto', valor: texto, ativo: true, ordem: i, custom: !!custom };
  }
  function campoNomeDesc(item, i, custom) {
    return { k: fieldKey(item.nome || `item_${i}`) + '_' + i, nome: item.nome || '', tipo: 'nome_desc', valor: item.desc || '', ativo: true, ordem: i, custom: !!custom };
  }

  /* Migra o legado (elevador.beneficios[], .diferenciais[],
     .caracteristicasEquip, .recursosNomeados[], .infraestruturaNomeada[],
     .responsabilidades.{vendedor,comprador}) pras 7 categorias nativas —
     roda só na 1ª vez que a proposta abre no editor novo. */
  function catsNativasFromLegacy(elevador) {
    const ed = elevador || {};
    const listaTexto = (arr) => (arr || []).map((t, i) => campoTexto(t, i, true));
    const listaNomeDesc = (arr) => (arr || []).map((it, i) => campoNomeDesc(it, i, true));
    const carac = ed.caracteristicasEquip || {};

    return [
      { id: 'cont_beneficios', nome: 'Benefícios', custom: false, campos: listaTexto(ed.beneficios) },
      { id: 'cont_diferenciais', nome: 'Diferenciais em Relação ao Mercado', custom: false, campos: listaTexto(ed.diferenciais) },
      {
        id: 'cont_caracteristicas', nome: 'Características Principais', custom: false,
        campos: CARACTERISTICAS_NATIVAS.map((c, i) => ({
          k: c.k, nome: c.nome, tipo: 'textarea', valor: carac[c.k] || '', ativo: !!carac[c.k], ordem: i, custom: false,
        })),
      },
      { id: 'cont_recursos', nome: 'Recursos Inclusos', custom: false, campos: listaNomeDesc(ed.recursosNomeados) },
      { id: 'cont_infraestrutura', nome: 'Infraestrutura e Instalação', custom: false, campos: listaNomeDesc(ed.infraestruturaNomeada) },
      { id: 'cont_resp_vendedor', nome: 'Responsabilidades — VerticalParts', custom: false, campos: listaTexto((ed.responsabilidades || {}).vendedor) },
      { id: 'cont_resp_comprador', nome: 'Responsabilidades — Comprador', custom: false, campos: listaTexto((ed.responsabilidades || {}).comprador) },
    ];
  }

  /* Biblioteca compartilhada — mesmo cache/mecanismo do Acabamentos, mas
     namespace próprio (LIB_EXTRAS local a este arquivo) pra não misturar
     com a extensão de campos da outra seção. */
  let LIB_EXTRAS = { cats: [], campos: [] };
  function setLibraryExtras(extras) {
    LIB_EXTRAS = { cats: (extras && extras.cats) || [], campos: (extras && extras.campos) || [] };
  }

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
        k: fld.k, nome: fld.nome, tipo: fld.tipo || 'texto',
        valor: '', ativo: false, ordem: cat.campos.length, custom: true,
      });
    });
    return out;
  }

  function garantirCats(elevador) {
    const existentes = (Array.isArray(elevador.conteudoCats) && elevador.conteudoCats.length)
      ? elevador.conteudoCats
      : catsNativasFromLegacy(elevador);
    return mergeComBiblioteca(existentes);
  }

  /* Deriva de volta os campos legados a partir dos cats — assim
     proposta-preview.jsx (PDF) e qualquer outro leitor antigo continuam
     funcionando sem mudança nenhuma, sempre com só os campos ATIVOS. */
  function derivarLegado(cats) {
    const porId = {}; cats.forEach((c) => { porId[c.id] = c; });
    const ativos = (catId) => ((porId[catId] && porId[catId].campos) || []).filter((f) => f.ativo);
    const textos = (catId) => ativos(catId).map((f) => f.valor || f.nome || '').filter(Boolean);
    const nomeDesc = (catId) => ativos(catId).map((f) => ({ nome: f.nome || '', desc: f.valor || '' }));
    const carac = {};
    ativos('cont_caracteristicas').forEach((f) => { carac[f.k] = f.valor || ''; });

    return {
      beneficios: textos('cont_beneficios'),
      diferenciais: textos('cont_diferenciais'),
      caracteristicasEquip: carac,
      recursosNomeados: nomeDesc('cont_recursos'),
      infraestruturaNomeada: nomeDesc('cont_infraestrutura'),
      responsabilidades: {
        vendedor: textos('cont_resp_vendedor'),
        comprador: textos('cont_resp_comprador'),
      },
    };
  }

  window.PropostaConteudoEngine = {
    CATEGORIAS_NATIVAS,
    normalizeNome, slugCategoria, fieldKey,
    catsNativasFromLegacy, setLibraryExtras, mergeComBiblioteca, garantirCats, derivarLegado,
  };
}());
