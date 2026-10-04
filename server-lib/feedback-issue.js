/* ============================================================
   feedback-issue.js — monta a issue do GitHub a partir do formulário "Enviar feedback"
   (menu Suporte "?" do cabeçalho). Funções puras, sem rede: testadas em src/feedback-issue.test.js.
   Quem chama o GitHub é o server.js (rota POST /api/feedback), que guarda o token — o navegador nunca vê.

   Regras de privacidade (decisão do usuário, 04/10/2026): a issue leva SÓ o primeiro nome do colaborador
   (extraído do e-mail), nunca o e-mail completo. Menções (@pessoa) e referências (#123) do texto livre são
   neutralizadas para a issue não notificar ninguém nem linkar outras issues por acidente.
   ============================================================ */
'use strict';

const TIPOS = {
  erro:     { rotulo: 'Erro',     label: 'bug' },
  duvida:   { rotulo: 'Dúvida',   label: 'question' },
  sugestao: { rotulo: 'Sugestão', label: 'enhancement' },
};
const GRAVIDADES = {
  bloqueia:   'Não consigo trabalhar',
  atrapalha:  'Atrapalha, mas dá para contornar',
  detalhe:    'Detalhe / incômodo pequeno',
};
/* Títulos das seções do corpo da issue, por tipo (o formulário usa as mesmas perguntas — src/ajuda-suporte.jsx). */
const TITULOS_SECAO = {
  erro:     { fazendo: 'O que a pessoa estava fazendo',        aconteceu: 'O que aconteceu' },
  duvida:   { fazendo: 'O que a pessoa está tentando fazer',   aconteceu: 'Qual é a dúvida' },
  sugestao: { fazendo: 'Em que momento a pessoa sentiu falta', aconteceu: 'Qual é a ideia' },
};
const LIMITES = { resumo: 100, tela: 120, fazendo: 1000, aconteceu: 2000, esperava: 2000, livre: 3000 };
const LABEL_NOVA_ISSUE = 'aguardando-gestor';   // o gestor troca por `pronto-para-claude` depois de conversar com a pessoa
const LABEL_BASE = 'feedback';

/* "gelson.simoes@verticalparts.com.br" -> "Gelson". Sem e-mail válido -> "Colaborador". */
function primeiroNome(email) {
  const local = String(email || '').split('@')[0] || '';
  const primeiro = local.split(/[._\-+\s]+/)[0] || '';
  const limpo = primeiro.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (!limpo) return 'Colaborador';
  return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}

/* Texto livre -> seguro para a issue: sem controle, sem HTML, sem menção (@) e sem referência (#123). */
function neutralizar(texto, max, { umaLinha = false } = {}) {
  let t = String(texto == null ? '' : texto)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (umaLinha) t = t.replace(/\s*\n\s*/g, ' ');
  if (max && t.length > max) t = t.slice(0, max).trimEnd();
  return t
    .replace(/</g, '&lt;')
    .replace(/@/g, '@​')
    .replace(/#(?=\d)/g, '#​');
}

/* Só um caminho do próprio app (ex.: /geral/decisoes). Qualquer outra coisa vira vazio. */
function caminhoSeguro(caminho) {
  const c = String(caminho || '').split('?')[0].split('#')[0].slice(0, 200);
  return /^\/[A-Za-z0-9\-_/.]*$/.test(c) ? c : '';
}

function slugTela(rota) {
  return String(rota || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* Valida o corpo recebido do formulário. Devolve { ok:true, dados } ou { ok:false, erro }. */
function validar(corpo) {
  const c = corpo && typeof corpo === 'object' ? corpo : {};
  const tipo = TIPOS[c.tipo] ? c.tipo : null;
  if (!tipo) return { ok: false, erro: 'Escolha o tipo: erro, dúvida ou sugestão.' };
  const gravidade = tipo === 'erro' ? (GRAVIDADES[c.gravidade] ? c.gravidade : null) : null;
  if (tipo === 'erro' && !gravidade) return { ok: false, erro: 'Diga o quanto o erro atrapalha.' };

  const dados = {
    tipo, gravidade,
    resumo:    neutralizar(c.resumo,    LIMITES.resumo,    { umaLinha: true }),
    tela:      neutralizar(c.tela,      LIMITES.tela,      { umaLinha: true }),
    fazendo:   neutralizar(c.fazendo,   LIMITES.fazendo),
    aconteceu: neutralizar(c.aconteceu, LIMITES.aconteceu),
    esperava:  neutralizar(c.esperava,  LIMITES.esperava),
    livre:     neutralizar(c.livre,     LIMITES.livre),
    contato:   c.contato !== false,
    rota:      slugTela(c.rota),
    caminho:   caminhoSeguro(c.caminho),
    colaborador: primeiroNome(c.email),
  };
  if (dados.resumo.length < 5) return { ok: false, erro: 'Escreva um resumo de pelo menos 5 letras.' };
  if (dados.aconteceu.length < 10 && dados.livre.length < 10) return { ok: false, erro: 'Conte o que aconteceu (pelo menos 10 letras).' };
  return { ok: true, dados };
}

/* Monta { title, body, labels } da issue. `ctx` = { versao, navegador } vindos do servidor (não do formulário). */
function montarIssue(dados, ctx = {}) {
  const tipo = TIPOS[dados.tipo];
  const tela = dados.tela || 'Tela não informada';
  const title = `[Feedback] ${tela} — ${dados.resumo}`.slice(0, 200);
  const linhas = [
    '> Enviado pelo menu **Suporte › Enviar feedback** do VP Gestão.',
    '',
    '| | |',
    '|---|---|',
    `| **Colaborador** | ${dados.colaborador} |`,
    `| **Tipo** | ${tipo.rotulo} |`,
  ];
  if (dados.gravidade) linhas.push(`| **Gravidade** | ${GRAVIDADES[dados.gravidade]} |`);
  linhas.push(`| **Tela** | ${tela}${dados.caminho ? ` (\`${dados.caminho}\`)` : ''} |`);
  if (ctx.versao) linhas.push(`| **Versão do site** | \`${neutralizar(ctx.versao, 40, { umaLinha: true })}\` |`);
  if (ctx.navegador) linhas.push(`| **Navegador** | ${neutralizar(ctx.navegador, 160, { umaLinha: true }).replace(/\|/g, '/')} |`);
  linhas.push(`| **Pode ser chamado para explicar** | ${dados.contato ? 'Sim' : 'Não'} |`);

  const secao = (titulo, texto) => { if (texto) linhas.push('', `### ${titulo}`, texto); };
  const t = TITULOS_SECAO[dados.tipo];
  secao(t.fazendo, dados.fazendo);
  secao(t.aconteceu, dados.aconteceu);
  secao('O que esperava', dados.esperava);
  secao('Observações', dados.livre);
  linhas.push('', '---',
    `_Triagem: etiqueta \`${LABEL_NOVA_ISSUE}\` — o gestor conversa com ${dados.colaborador} antes de resolver. ` +
    'Quando estiver claro, trocar por `pronto-para-claude`._');

  const labels = [LABEL_BASE, LABEL_NOVA_ISSUE, tipo.label];
  if (dados.gravidade) labels.push(`gravidade:${dados.gravidade}`);
  if (dados.rota) labels.push(`tela:${dados.rota}`);
  return { title, body: linhas.join('\n'), labels };
}

/* Limitador simples em memória: no máximo `max` usos por `janelaMs` por chave. */
function criarLimitador({ max, janelaMs }) {
  const usos = new Map();
  return function permitir(chave, agora = Date.now()) {
    const recentes = (usos.get(chave) || []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= max) { usos.set(chave, recentes); return false; }
    recentes.push(agora);
    usos.set(chave, recentes);
    return true;
  };
}

module.exports = { TIPOS, GRAVIDADES, LIMITES, LABEL_NOVA_ISSUE, primeiroNome, neutralizar, caminhoSeguro, validar, montarIssue, criarLimitador };
