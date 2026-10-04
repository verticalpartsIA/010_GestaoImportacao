/* ============================================================
   inbox-visibilidade.js — quem vê o e-mail de quem no Inbox (04/10/2026, fase 1).
   Regras decididas com o usuário (ver CLAUDE.md, seção Inbox):
     - o DONO do e-mail é o login de quem enviou (a resposta herda o dono do e-mail que responde;
       senão o dono da cotação; senão "sem dono" → fila de triagem);
     - cada pessoa vê o que é dela MAIS o que as alçadas dela permitem (inbox.ver_todos / ver_equipe /
       ver_departamento / ver_area_* / triagem). Tudo começa marcado para todos; o administrador desmarca.
   Funções PURAS testadas em inbox-visibilidade.test.js; carregarContexto() é a única que fala com o banco.
   LIMITE HONESTO: é organização/controle de erro NA TELA (o read-inbox ainda devolve a caixa inteira a quem
   chamar com a chave pública). Isolamento real depende da issue #571.
   window.InboxVisibilidade = { AREA_POR_DEPARTAMENTO, areaDe, subordinados, podeVer, carregarContexto }
   ============================================================ */
(function () {
  'use strict';

  /* departamento (texto do cadastro de colaboradores) → sufixo da alçada inbox.ver_area_<sufixo> */
  const AREA_POR_DEPARTAMENTO = {
    'Comercial': 'comercial',
    'Adm/Financeiro': 'financeiro',
    'Engenharia': 'engenharia',
    'Logística/Almoxarifado/Produção': 'logistica',
    'Jurídico/Importação/Suprimentos': 'juridico_importacao',
    'Gente & Gestão': 'gente_gestao',
    'Marketing': 'marketing',
  };
  const norm = (e) => String(e || '').trim().toLowerCase();
  const areaDe = (departamento) => AREA_POR_DEPARTAMENTO[String(departamento || '').trim()] || null;

  /* subordinados(pessoas, emailChefe): todos que respondem direta ou indiretamente ao chefe (manager_id).
     `pessoas`: [{ id, email, manager_id }]. Protegido contra ciclo no cadastro. */
  function subordinados(pessoas, emailChefe) {
    const chefe = (pessoas || []).find((p) => norm(p.email) === norm(emailChefe));
    const saida = new Set();
    if (!chefe) return saida;
    const fila = [chefe.id];
    const vistos = new Set([chefe.id]);
    while (fila.length) {
      const atual = fila.shift();
      (pessoas || []).forEach((p) => {
        if (p.manager_id === atual && !vistos.has(p.id)) {
          vistos.add(p.id);
          if (p.email) saida.add(norm(p.email));
          fila.push(p.id);
        }
      });
    }
    return saida;
  }

  /* podeVer(dono, ctx) → boolean
     ctx = { eu, caps: { ver_todos, ver_equipe, ver_departamento, triagem, areas: [sufixos] },
             equipe: Set<email>, meuDepartamento, departamentoDe: (email) => texto }
     Regras, na ordem: é meu → vejo; ver_todos → vejo; sem dono → só quem faz triagem; equipe; meu departamento; áreas marcadas. */
  function podeVer(dono, ctx, atribuido) {
    const c = ctx || {};
    const caps = c.caps || {};
    const d = norm(dono);
    const a = norm(atribuido);
    const eu = norm(c.eu);
    if ((d && d === eu) || (a && a === eu)) return true;      // é meu, ou foi atribuído a mim (fase 2)
    if (caps.ver_todos) return true;
    if (!d && !a) return !!caps.triagem;
    /* equipe / departamento / áreas valem para o dono E para quem recebeu a atribuição */
    return [d, a].filter(Boolean).some((pessoa) => {
      if (caps.ver_equipe && c.equipe && c.equipe.has(pessoa)) return true;
      const depto = c.departamentoDe ? c.departamentoDe(pessoa) : null;
      if (caps.ver_departamento && depto && c.meuDepartamento && depto === c.meuDepartamento) return true;
      const area = areaDe(depto);
      return !!(area && Array.isArray(caps.areas) && caps.areas.includes(area));
    });
  }

  /* podeAtribuir(dono, atribuido, ctx) → quem pode TROCAR o responsável: precisa da alçada Editar e ser o responsável atual,
     ou ter ver_todos, ou fazer triagem (e-mail sem responsável), ou ser chefe do responsável (equipe). Férias: o chefe reatribui. */
  function podeAtribuir(dono, atribuido, ctx) {
    const c = ctx || {};
    const caps = c.caps || {};
    if (c.flags && !c.flags.editar) return false;
    const resp = norm(atribuido) || norm(dono);
    if (!resp) return !!(caps.triagem || caps.ver_todos);
    if (resp === norm(c.eu) || norm(dono) === norm(c.eu)) return true;
    if (caps.ver_todos) return true;
    return !!(caps.ver_equipe && c.equipe && c.equipe.has(resp));
  }

  /* carregarContexto(): lê as alçadas da pessoa logada (PropostaStore.temCapacidade — Administrador passa em tudo)
     e o cadastro de colaboradores. Falha ao carregar = devolve null (a tela mostra tudo e avisa no console:
     preferimos não esconder e-mail de venda por erro de leitura; a restrição já é só organização na tela). */
  async function carregarContexto() {
    try {
      const ps = window.PropostaStore;
      const sb = window.__VP_SB && window.__VP_SB.sb;
      const eu = norm((window.__VP_USER || {}).email);
      if (!ps || !ps.temCapacidade || !sb || !eu) return null;
      const nomes = ['ver', 'criar', 'editar', 'excluir', 'ver_todos', 'ver_equipe', 'ver_departamento', 'triagem', 'excluir_de_outros']
        .concat(Object.values(AREA_POR_DEPARTAMENTO).map((a) => 'ver_area_' + a));
      const flags = {};
      await Promise.all(nomes.map(async (n) => { flags[n] = !!(await ps.temCapacidade('inbox', n)); }));
      const { data: pessoas } = await sb.from('colaboradores_vpsistema').select('id, email, nome, departamento, manager_id, is_department_lead').eq('is_active', true);
      const lista = pessoas || [];
      const mapaDepto = {};
      lista.forEach((p) => { if (p.email) mapaDepto[norm(p.email)] = p.departamento || null; });
      return {
        eu,
        flags,
        caps: {
          ver_todos: flags.ver_todos, ver_equipe: flags.ver_equipe, ver_departamento: flags.ver_departamento, triagem: flags.triagem,
          areas: Object.values(AREA_POR_DEPARTAMENTO).filter((a) => flags['ver_area_' + a]),
        },
        equipe: subordinados(lista, eu),
        colaboradores: lista,                       // para o seletor "Atribuir" (nome, departamento, líder)
        meuDepartamento: mapaDepto[eu] || null,
        departamentoDe: (email) => mapaDepto[norm(email)] || null,
      };
    } catch (e) {
      console.warn('[InboxVisibilidade] não consegui carregar as alçadas — mostrando tudo', e);
      return null;
    }
  }

  const api = { AREA_POR_DEPARTAMENTO, areaDe, subordinados, podeVer, podeAtribuir, carregarContexto };
  if (typeof window !== 'undefined') window.InboxVisibilidade = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
