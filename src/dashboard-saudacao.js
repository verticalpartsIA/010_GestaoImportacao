/* ============================================================
   dashboard-saudacao.js — nome da pessoa na saudação do Dashboard (função pura, sem rede).
   Regra (decisão do Gelson, 31/10/2026): a pessoa é chamada pelo que vem ANTES do "@" do e-mail do login,
   cada parte separada por "." "_" ou "-" vira uma palavra com inicial maiúscula:
     bianca@verticalparts.com.br        → "Bianca"
     almoxarifado@verticalparts.com.br  → "Almoxarifado"
     gelson.simoes@verticalparts.com.br → "Gelson Simões"
   O e-mail não traz acento, e o cadastro (perfis.nome) também não ("Gelson Simoes"): o acento vem de um dicionário
   (ACENTOS) e de poucas regras de final de palavra (-ção, -ções, -ões). Palavra fora disso fica sem acento — para
   acrescentar uma, basta uma linha em ACENTOS. Sem login (e-mail vazio ou "@localhost") devolve "VP Gestão".
   Exposto em window.DashboardSaudacao.
   ============================================================ */
(function () {
  'use strict';

  const SEM_LOGIN = 'VP Gestão';

  // chave = palavra sem acento em minúsculas; valor = forma correta (já com a inicial maiúscula)
  const ACENTOS = {
    automacao: 'Automação', expedicao: 'Expedição', producao: 'Produção', mauricio: 'Maurício', simoes: 'Simões',
    jessica: 'Jéssica', goncalves: 'Gonçalves', conceicao: 'Conceição', joao: 'João', jose: 'José', andre: 'André',
    lucia: 'Lúcia', fabio: 'Fábio', julio: 'Júlio',
  };

  function maiuscula(p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }

  function palavra(token) {
    const t = String(token || '').toLowerCase();
    if (!t) return '';
    if (ACENTOS[t]) return ACENTOS[t];
    if (t.length > 4 && /coes$/.test(t)) return maiuscula(t.replace(/coes$/, 'ções'));
    if (t.length > 4 && /cao$/.test(t)) return maiuscula(t.replace(/cao$/, 'ção'));
    if (t.length > 4 && /oes$/.test(t)) return maiuscula(t.replace(/oes$/, 'ões'));
    return maiuscula(t);
  }

  function nomeDaSaudacao(email) {
    const e = String(email || '').trim();
    if (!e || !e.includes('@')) return SEM_LOGIN;
    const [local, dominio] = e.split('@');
    if (/^localhost(\..*)?$/i.test(dominio || '')) return SEM_LOGIN;
    const palavras = local.split(/[._-]+/).filter(Boolean).map(palavra).filter(Boolean);
    return palavras.length ? palavras.join(' ') : SEM_LOGIN;
  }

  const api = { nomeDaSaudacao, ACENTOS, SEM_LOGIN };
  if (typeof window !== 'undefined') window.DashboardSaudacao = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
