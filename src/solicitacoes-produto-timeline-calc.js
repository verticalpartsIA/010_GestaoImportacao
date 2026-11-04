/* ============================================================
   solicitacoes-produto-timeline-calc.js — regras puras da linha do tempo
   (Engenharia & Produto › Solicitações de Produto, 8.3). Sem acesso a dados:
   recebe os eventos de `solicitacao_produto_eventos` e devolve as frases.
   window.SolProdTimeline
   ============================================================ */
(function (root) {
  'use strict';

  /* Quem pode ser avisado em cada etapa (decisão do Gelson, 03/11/2026). */
  var ENGENHARIA = [
    { nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br' },
    { nome: 'Alexandre Schmidt', email: 'alexandre@verticalparts.com.br' },
    { nome: 'Vinicius Leite', email: 'vinicius.leite@verticalparts.com.br' },
    { nome: 'Brayan Souza', email: 'automacao@verticalparts.com.br' },
  ];
  var IMPORTACAO = [
    { nome: 'Andreia Oliveira', email: 'andreia.oliveira@verticalparts.com.br' },
    { nome: 'Beatriz Anderson', email: 'beatriz@verticalparts.com.br' },
    { nome: 'Bianca Mayumi', email: 'bianca@verticalparts.com.br' },
  ];

  function pessoa(lista, email) {
    var e = String(email || '').trim().toLowerCase();
    return lista.find(function (p) { return p.email === e; }) || null;
  }

  /* Nome para mostrar: o gravado no evento; senão o e-mail; senão "Alguém". */
  function nomeDe(nome, email) {
    return String(nome || '').trim() || String(email || '').trim() || 'Alguém';
  }

  /* Resumo curto do que foi pedido, para o título do aviso. Duas solicitações no mesmo dia
     não podem ter o mesmo título normalizado, senão o gi-avisos agrupa e a segunda não sai. */
  function resumo(texto, max) {
    var t = String(texto || '').replace(/\s+/g, ' ').trim();
    var lim = max || 40;
    if (t.length <= lim) return t;
    return t.slice(0, lim - 1).replace(/\s+\S*$/, '') + '…';
  }

  /* Uma frase por evento. Nunca usa pronome: só nomes. */
  function frase(ev) {
    var ator = nomeDe(ev.ator_nome, ev.ator_email);
    var alvo = nomeDe(ev.alvo_nome, ev.alvo_email);
    var d = ev.detalhe || {};
    switch (ev.tipo) {
      case 'aberta': return ator + ' abriu a solicitação';
      case 'aviso_engenharia':
        if (d.aviso_enviado === false) return 'O aviso para ' + alvo + ' NÃO saiu (escolhido(a) por ' + ator + ')';
        if (d.automatico) return alvo + ' foi avisado(a) automaticamente para criar a Ficha Técnica (regra antiga, sem escolha)';
        return alvo + ' foi avisado(a) para criar a Ficha Técnica (escolhido(a) por ' + ator + ')';
      case 'analise_iniciada': return ator + ' iniciou a análise';
      case 'ficha_criada': return ator + ' criou a Ficha Técnica';
      case 'aviso_importacao':
        if (d.automatico) return alvo + ' foi avisado(a) automaticamente para conferir o NCM e publicar no Omie (regra antiga, sem escolha)';
        return alvo + ' foi avisado(a) para conferir o NCM e publicar no Omie (escolhido(a) por ' + ator + ')';
      case 'ficha_publicada': {
        var verbo = /^republicou/i.test(String(d.acao || '')) ? 'republicou' : 'publicou';
        return ator + ' ' + verbo + ' no Omie' + (d.codigo_produto ? ' (' + d.codigo_produto + ')' : '');
      }
      case 'devolvida': {
        var dest = DESTINOS[d.para] || d.para || 'outro departamento';
        return ator + ' devolveu à ' + dest + (alvo !== 'Alguém' && (ev.alvo_nome || ev.alvo_email) ? ' (citou ' + alvo + ')' : '');
      }
      case 'devolucao_respondida': return ator + ' respondeu a devolução';
      default: return ator + ': ' + ev.tipo;
    }
  }

  /* Indicador de etapas da lista: Recebido → Engenharia → Importação → Cadastro.
     feito = já aconteceu; atual = a próxima a acontecer; pendente = depois dela;
     desconhecido = sem como ler os eventos (Importação e Cadastro só existem nos eventos).
     Etapa anterior a uma já feita conta como feita (ex.: publicou sem registrar o aviso). */
  var ETAPAS_CICLO = [
    { chave: 'recebido', label: 'Recebido' },
    { chave: 'engenharia', label: 'Engenharia' },
    { chave: 'importacao', label: 'Importação' },
    { chave: 'cadastro', label: 'Cadastro' },
  ];
  function etapasDoCiclo(sol, eventos) {
    var lista = Array.isArray(eventos) ? eventos : null;
    var tem = function (t) { return !!lista && lista.some(function (e) { return e.tipo === t; }); };
    var feito = {
      recebido: true,
      engenharia: !!(sol && sol.ficha_tecnica_id) || tem('ficha_criada'),
      importacao: tem('aviso_importacao'),
      cadastro: tem('ficha_publicada'),
    };
    var ultimo = -1;
    ETAPAS_CICLO.forEach(function (e, i) { if (feito[e.chave]) ultimo = i; });
    var atualMarcado = false;
    return ETAPAS_CICLO.map(function (e, i) {
      var estado;
      if (i <= ultimo) estado = 'feito';
      else if (!lista && (e.chave === 'importacao' || e.chave === 'cadastro')) estado = 'desconhecido';
      else if (!atualMarcado) { atualMarcado = true; estado = 'atual'; }
      else estado = 'pendente';
      return { chave: e.chave, label: e.label, estado: estado };
    });
  }

  /* ---- Devolução com pendência (chat interno) — spec em docs/modulos/08_engenharia_produto.md, 8.3 ---- */
  var DESTINOS = { solicitante: 'Solicitante', engenharia: 'Engenharia', importacao: 'Importação' };
  var STATUS_ANTES_DA_FICHA = ['novo', 'em_analise'];

  function rotuloPendencia(com) {
    if (!DESTINOS[com]) return '';
    var prep = com === 'solicitante' ? 'ao ' : 'à ';
    return 'Devolvida ' + prep + DESTINOS[com] + ' — pendente de resposta';
  }

  function ehDe(lista, email) { return !!pessoa(lista, email); }

  /* Pode devolver `para` ("solicitante" | "engenharia" | "importacao")? Uma pendência por vez.
     Engenharia → Solicitante: antes da Ficha. Importação → Engenharia e Engenharia → Importação: depois da
     Ficha e antes de publicar no Omie (fichaPublicada vem de fichas_tecnicas.omie_publicado_em, não da `etapa`). */
  function podeDevolver(para, sol, email, admin, fichaPublicada) {
    if (!sol) return { ok: false, motivo: 'Solicitação não carregada.' };
    if (sol.pendente_com) return { ok: false, motivo: 'Já existe uma devolução aguardando resposta.' };
    var depoisDaFicha = sol.status === 'convertido_em_ficha';
    if (para === 'solicitante') {
      if (STATUS_ANTES_DA_FICHA.indexOf(sol.status) < 0) return { ok: false, motivo: 'Só se devolve ao solicitante antes de criar a Ficha.' };
      if (!admin && !ehDe(ENGENHARIA, email)) return { ok: false, motivo: 'Só a Engenharia devolve ao solicitante.' };
      return { ok: true };
    }
    if (para === 'engenharia' || para === 'importacao') {
      if (!depoisDaFicha) return { ok: false, motivo: 'Só se devolve entre Engenharia e Importação depois de criar a Ficha.' };
      if (fichaPublicada) return { ok: false, motivo: 'A Ficha já foi publicada no Omie.' };
      var lista = para === 'engenharia' ? IMPORTACAO : ENGENHARIA;
      if (!admin && !ehDe(lista, email)) return { ok: false, motivo: para === 'engenharia' ? 'Só a Importação devolve à Engenharia.' : 'Só a Engenharia devolve à Importação.' };
      return { ok: true };
    }
    return { ok: false, motivo: 'Destino inválido.' };
  }

  /* Em nome de qual departamento a pessoa escreve no chat. Engenharia e Importação vêm das listas; quem abriu a
     solicitação (e qualquer outra pessoa do Comercial) escreve como "solicitante". Administrador fora das listas
     escreve como o departamento que tem a vez (`preferido`), senão como Engenharia. */
  function setorDoUsuario(sol, email, admin, preferido) {
    if (preferido === 'engenharia' && (admin || ehDe(ENGENHARIA, email))) return 'engenharia';
    if (preferido === 'importacao' && (admin || ehDe(IMPORTACAO, email))) return 'importacao';
    if (preferido === 'solicitante' && String(sol && sol.solicitante_email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) return 'solicitante';
    if (ehDe(ENGENHARIA, email)) return 'engenharia';
    if (ehDe(IMPORTACAO, email)) return 'importacao';
    if (admin && !(sol && String(sol.solicitante_email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase())) return 'engenharia';
    return 'solicitante';
  }

  /* Quem responde: só o solicitante (1ª volta); qualquer pessoa do departamento (demais), mesmo que a mensagem cite um nome. */
  function podeResponder(sol, email, admin) {
    var com = sol && sol.pendente_com;
    if (!com) return false;
    if (admin) return true;
    var e = String(email || '').trim().toLowerCase();
    if (com === 'solicitante') return !!e && e === String(sol.solicitante_email || '').trim().toLowerCase();
    return ehDe(com === 'engenharia' ? ENGENHARIA : IMPORTACAO, e);
  }

  /* SLA: 4 horas comerciais, 09–17 h de Brasília (UTC−3, sem horário de verão), seg–sex, sem os feriados que contam no SLA.
     Janela PRÓPRIA: a da Precificação (gatilhos-engine, 08–18 h) não é alterada. `feriados` = lista/Set de 'aaaa-mm-dd'. */
  var SLA_DEVOLUCAO = { ini: 9, fim: 17, horas: 4, deslocaMs: -3 * 3600000 };
  function somarHorasComerciais(inicio, horas, feriados) {
    var f = feriados instanceof Set ? feriados : new Set(feriados || []);
    var H = 3600000, DIA = 24 * H;
    var t = new Date(inicio).getTime() + SLA_DEVOLUCAO.deslocaMs; // relógio de parede de Brasília, lido como UTC
    var resto = horas * H, guarda = 0;
    while (resto > 0 && guarda++ < 4000) {
      var dia0 = Math.floor(t / DIA) * DIA;
      var dow = new Date(dia0).getUTCDay();
      var iso = new Date(dia0).toISOString().slice(0, 10);
      var abre = dia0 + SLA_DEVOLUCAO.ini * H, fecha = dia0 + SLA_DEVOLUCAO.fim * H;
      if (dow === 0 || dow === 6 || f.has(iso) || t >= fecha) { t = dia0 + DIA + SLA_DEVOLUCAO.ini * H; continue; }
      if (t < abre) t = abre;
      var cabe = fecha - t;
      if (resto <= cabe) { t += resto; resto = 0; } else { resto -= cabe; t = fecha; }
    }
    return new Date(t - SLA_DEVOLUCAO.deslocaMs);
  }
  function prazoDevolucao(desde, feriados) { return somarHorasComerciais(desde, SLA_DEVOLUCAO.horas, feriados); }
  function emAtraso(prazo, agora) { return !!prazo && new Date(agora || Date.now()) > new Date(prazo); }

  function ordenar(eventos) {
    return (eventos || []).slice().sort(function (a, b) {
      return new Date(a.criado_em) - new Date(b.criado_em);
    });
  }

  /* Valida a escolha de quem avisar: tem de ser alguém da lista da etapa. */
  function escolhaValida(lista, email) {
    return !!pessoa(lista, email);
  }

  root.SolProdTimeline = { ENGENHARIA: ENGENHARIA, IMPORTACAO: IMPORTACAO, pessoa: pessoa, nomeDe: nomeDe, resumo: resumo, frase: frase, etapasDoCiclo: etapasDoCiclo, ordenar: ordenar, escolhaValida: escolhaValida,
    DESTINOS: DESTINOS, rotuloPendencia: rotuloPendencia, podeDevolver: podeDevolver, podeResponder: podeResponder, setorDoUsuario: setorDoUsuario,
    somarHorasComerciais: somarHorasComerciais, prazoDevolucao: prazoDevolucao, emAtraso: emAtraso };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SolProdTimeline;
}(typeof window !== 'undefined' ? window : globalThis));
