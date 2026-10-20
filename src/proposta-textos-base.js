/* ============================================================
   proposta-textos-base.js — texto-base do conteúdo comercial por TIPO de equipamento
   (Carga / Passageiro / Panorâmico). Alimenta os perfis que a herança cria (proposta-heranca.js › montarPerfis).

   - Passageiro: são os textos institucionais que já eram o padrão da proposta (proposta-editor.jsx › makeDefaultProposta).
   - Carga e Panorâmico: RASCUNHO conservador, sem superlativos — só frases factuais ou aproveitadas do texto já
     aprovado (recursos que valem para qualquer cabine). A Comercial precisa REVISAR antes de virar padrão; o vendedor
     sempre vê e edita o texto antes de enviar (a proposta nasce em rascunho).
   - Texto que descreve passageiros (ventilação, "carro lotado", viagens confortáveis…) NÃO entra em Carga.

   Quando a Comercial quiser editar isto sem mexer em código, o caminho é uma tabela (como a biblioteca de acabamentos);
   hoje é este arquivo.
   window.PropostaTextosBase
   ============================================================ */
(function () {
  'use strict';

  const RECURSO = {
    ventiladores: { nome: 'Ventiladores de Cabine', desc: 'Nossas cabines possuem ventiladores para refrigeração e conforto aos usuários.' },
    intercom: { nome: 'Sistema de Intercomunicação', desc: 'Nossas cabines são equipadas com intercomunicadores, e disponibilizamos interfones para a portaria.' },
    retorno: { nome: 'Retorno Automático', desc: 'Após atender todas as chamadas, o elevador retorna automaticamente ao andar pré-configurado.' },
    lotado: { nome: 'Despacho de Carro Lotado', desc: 'Através de pesadores de carga na cabine, o sistema sabe a quantidade de passageiros e, além de sinalizar em caso de carro lotado para evitar excesso de carga, não para a cabine para chamadas de pavimento, caso a capacidade já esteja acima de 80% quando o elevador estiver em movimento.' },
    resgate: { nome: 'Resgate Manual Simplificado', desc: 'Em caso de falta de energia o equipamento possui um sistema de resgate simplificado através de um botão de acionamento manual (localizado no painel de comando), onde o técnico consegue manobrar a cabine para o pavimento mais próximo e liberar a pessoa retida na cabine.' },
    emergencia: { nome: 'Iluminação de Emergência na Cabine', desc: 'Nossas cabines são equipadas com iluminação de emergência na cabine no caso de falta de energia.' },
    falsas: { nome: 'Cancelamento de Chamadas Falsas', desc: 'Caso sejam feitas 3 ou mais chamadas na botoeira de cabine e nenhum passageiro entre ou saia da cabine, o sistema cancela estas chamadas, economizando energia e atendendo melhor o fluxo real de pavimento.' },
    posicao: { nome: 'Indicação de Posição', desc: 'Presente em todas as botoeiras de todos os pavimentos, para maior conforto do usuário.' },
  };

  const COMANDO = 'O comando de última geração e microprocessado garante ao equipamento paradas precisas, aceleração e desaceleração confortável e tudo isso com o máximo em economia de energia.';
  const TRACAO = 'Acionamento Elétrico com cabo de aço ou cinto de tração';
  const NORMAS = 'Atendimento integral às normas técnicas vigentes.';

  const BASE = {
    passageiro: {
      beneficios: [
        'Soluções de última geração para oferecer viagens seguras e confortáveis aos usuários.',
        'Eficiência energética e respeito ao meio ambiente.',
        'Componentes de maior durabilidade.',
        'Novo design atemporal com uma gama de opções exclusivas.',
      ],
      diferenciais: [
        'Piso em 12 mm de resina, modelo FR035',
        'Segurança em relação ao espelho não ser de vidro e sim de Aço espelhado. (Não corre o risco de acidente com quebra de espelho).',
        'Escada de acesso ao poço do elevador inclusa no projeto.',
        'Iluminação da caixa de corrida do elevador inclusa no projeto.',
      ],
      recursos: ['ventiladores', 'intercom', 'retorno', 'lotado', 'resgate', 'emergencia', 'falsas', 'posicao'].map((k) => RECURSO[k]),
    },
    carga: {
      beneficios: [
        'Elevador dimensionado para o transporte de cargas, com capacidade e dimensões de cabine definidas conforme o projeto.',
        'Eficiência energética e respeito ao meio ambiente.',
        NORMAS,
      ],
      diferenciais: [
        'Escada de acesso ao poço do elevador inclusa no projeto.',
        'Iluminação da caixa de corrida do elevador inclusa no projeto.',
      ],
      recursos: ['intercom', 'retorno', 'resgate', 'emergencia', 'posicao'].map((k) => RECURSO[k]),
    },
    panoramico: {
      beneficios: [
        'Cabine panorâmica com vidros, conforme o projeto aprovado.',
        'Eficiência energética e respeito ao meio ambiente.',
        NORMAS,
      ],
      diferenciais: [
        'Escada de acesso ao poço do elevador inclusa no projeto.',
        'Iluminação da caixa de corrida do elevador inclusa no projeto.',
      ],
      recursos: ['intercom', 'retorno', 'resgate', 'emergencia', 'falsas', 'posicao'].map((k) => RECURSO[k]),
    },
  };

  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* Conteúdo-base para um perfil. `chave` = PropostaOpcoes.tipoChave(tipo) ('' = tipo desconhecido → só o genérico).
     `unidade` = Unidade do Formulário do grupo: alimentação e tração saem DELA (tensão e relação de tração reais). */
  function paraTipo(chave, unidade) {
    const b = BASE[chave] || { beneficios: [NORMAS], diferenciais: [], recursos: ['retorno', 'resgate', 'emergencia', 'posicao'].map((k) => RECURSO[k]) };
    const u = unidade || {};
    const tensao = String(u.tensao_principal || '').trim();
    const rel = String(u.tracao || '').trim();
    return {
      textoModelos: '',
      beneficios: clone(b.beneficios),
      diferenciais: clone(b.diferenciais),
      recursosNomeados: clone(b.recursos),
      caracteristicasEquip: {
        alimentacao: tensao ? `Trifásico, ${/v$/i.test(tensao) ? tensao : tensao + 'V'} – A tensão deverá ser confirmada por ocasião da assinatura do contrato. Na hipótese de não correção da informação, a tensão será considerada como correta e definitiva.` : '',
        comando: COMANDO,
        tracao: rel ? `${TRACAO} (tração ${rel})` : TRACAO,
      },
    };
  }

  window.PropostaTextosBase = { paraTipo, BASE };
}());
