/* ============================================================
   proposta-padroes-escest.js — textos padrão da Proposta de ESCADA / ESTEIRA ROLANTE.

   Origem: Proposta nº 980 (escada, fluxo antigo) — o Financeiro pediu (16/10/2026) que a escada/esteira
   tenha o mesmo conteúdo que o elevador já tem: Acabamento, Características Técnicas, Instalação e Montagem,
   Responsabilidades, Condições de Pagamento, Ajustes, Prazo e Garantia. Garantia/Condições/Ajustes/Prazo são
   IGUAIS aos do elevador (vêm de makeDefaultProposta no editor); aqui ficam só os textos próprios do equipamento.

   A esteira usa os mesmos textos trocando escada→esteira e degrau→pallet (`paraEsteira`) — revisar com a
   Engenharia se algum item não se aplicar à esteira.

   Puro (sem DOM): `window.PropostaPadroesEscEst.padroes(eq)` devolve campos prontos para `data[eq]`;
   `completar(bloco, padroes)` só preenche o que está VAZIO (nunca sobrescreve o que o vendedor digitou).
   DIFAL não aparece em nenhum texto (Financeiro, 16/10/2026).
   ============================================================ */
(function () {
  const ACABAMENTO = [
    ['Tipo de Balaustrada', 'Perfil do corrimão em aço inoxidável sobreposto diretamente aos painéis de vidro, conferindo assim curvas de aparências suaves e delgadas ao guarda corpo'],
    ['Cor da Balaustrada', 'A balaustrada constitui-se por painéis de vidro de segurança temperado transparente, com espessura de 10mm, com juntas perpendiculares ao corrimão'],
    ['Rodapés', 'Os rodapés serão em aço inox 430'],
    ['Molduras e Rodapés', 'As molduras internas e externas sobre os rodapés serão de aço inox conforme os rodapés'],
    ['Degraus', 'Fabricados em peça única de aço inox, os degraus das escadas rolantes VerticalParts oferecem alta resistência à ruptura'],
    ['Acabamento dos Degraus', 'Pintado na cor preta e com demarcações em amarelo'],
    ['Resistência da Corrente', 'A corrente possui características mecânicas de alta resistência para atender o fluxo de passageiros para aplicações comerciais'],
    ['Revestimento do Piso', 'Alumínio com linhas contínuas'],
    ['Soleira', 'Alumínio com linhas contínuas'],
    ['Tampa de Entrada do Corrimão', 'Entrada do corrimão em ferro ou poliamida e equipado com escovas, reforçando a segurança dos usuários ao prevenir a entrada de objetos estranhos'],
    ['Cor da Tampa da Entrada do Corrimão', 'Cor grafite'],
    ['Revestimento Externo Lateral da Treliça', 'O revestimento externo lateral da treliça será a cargo e por conta do comprador'],
    ['Revestimento Externo Inferior da Treliça', 'O revestimento externo inferior da treliça será a cargo e por conta do comprador'],
    ['Iluminação do Vão entre Degraus', 'Entre os vãos dos degraus haverá iluminação em LED, permitindo melhor visualização e segurança aos usuários'],
    ['Iluminação da Placa Pente', 'Em LED constante triangular, instalado em ambos os lados do rodapé indicando a transição entre os degraus e a placa de entrada ou saída do equipamento.'],
    ['Indicador de Direção', 'Um indicador de direção em um lado.'],
    ['Escova de Segurança', 'Escovas de segurança com cerdas em nylon serão instaladas na face interna dos rodapés contribuindo para evitar que calçados e acessórios se prendam aos mecanismos do equipamento ao longo do seu percurso. Ao embarcar, a presença destas escovas induz os usuários a permanecerem afastados das extremidades dos degraus, preservando a área de segurança recomendada para seu posicionamento durante o trajeto.'],
    ['Sistema de Frenagem', 'Com o torque de frenagem adaptado à direção da viagem, o sistema de freios exclusivos VerticalParts reduz o risco de quedas de usuários durante paradas de emergência.'],
  ];

  const CARAC_TEC = [
    ['Conjunto Motor-Redutor', 'O conjunto motor-redutor localiza-se internamente à cabeceira superior da escada rolante. O redutor de eixos sem-fim resulta em alto rendimento de transmissão, proporcionando aos usuários maior conforto e suavidade. Seu acionamento é realizado através de um motor elétrico de corrente alternada.'],
    ['Correntes de Tração de Longa Duração', 'As correntes de tração estão em conformidade com as mais rígidas normas nacionais e internacionais. O sistema de lubrificação é controlado pelo comando, que garante uma longa vida útil e alta eficiência operacional.'],
    ['Comando', 'Inteligente comando microprocessado composto por dois circuitos de segurança independentes que controlam cada dispositivo de segurança em tempo real. A velocidade e direção são monitoradas no eixo do motor, nos degraus/paletes e no corrimão. Através da monitoração de três sensores de forma independente, garante-se um sistema ante reversão livre de falhas.'],
    ['Dispositivo de Restrição de Acesso entre Balaustradas', 'Serão inclusos dispositivos de proteção para restringir o acesso à moldura externa da balaustrada entre equipamentos adjacentes às paredes e/ou entre arranjos paralelos adjacentes, conforme determinação da NBR 16734/2022.'],
  ];

  const INSTALACAO = {
    instalacao: 'Os equipamentos são projetados para serem instalados em ambientes fechados/enclausurados de forma a não sofrer nenhuma ação climática direta ou indireta.',
    lubrificacao: 'A treliça e o mecanismo do equipamento são projetados para permitir serviço eficiente de lubrificação e ajustagem através de sistema de válvula solenoide. A acessibilidade é máxima a todos os equipamentos.',
    transporte: 'O(s) equipamento(s) será(ão) montado(s) e testado(s) na fábrica, devendo ser transportado(s) e levado(s) ao local em um ou mais módulos.',
    descarregamento: 'Para composição do preço ora estabelecido, foi considerado que o trabalho de descarregamento e içamento dos equipamentos do veículo de transporte até o local definitivo de instalação na obra se dará em ato contínuo, em horário comercial diurno e através de local de fácil acesso. Locais de difícil acesso e de alta complexidade de içamento exigirão reavaliação do preço apresentado na proposta comercial.',
  };

  const RESPONSABILIDADES = {
    vendedor: [
      'Para o serviço de Instalação e Montagem das Escadas Rolantes, está incluso:',
      'Carregamento das Escadas Rolantes',
      'Transporte dos Equipamentos até o local de Instalação',
      'Descarga dos Equipamentos no local indicado pelo Comprador',
      'Içamento',
      'Montagem Completa das Escadas Rolantes',
      'Fornecimento de Projeto Técnico com detalhes de poço e caixa a ser enviado após pedido de compra e confirmação do desnível',
      'Comissionamento com todos os testes para a Compradora e para a empresa de manutenção',
    ],
    comprador: [
      'Preparo do(s) poço(s) e caixa(s) de acordo com as nossas indicações;',
      'Execuções de trabalhos de concreto, ponto de içamento, alvenaria, andaimes, conserto nas paredes, recorte de pisos, mármore e granitos;',
      'Fornecimento de energia elétrica adequada aos nossos serviços e necessidades;',
      'Ligações de luz e força definitivas para o painel de comando e máquina no pavimento superior de acordo com Desenho Técnico fornecido;',
      'Ponto de Içamento de acordo com Desenho Técnico;',
      'Caso o Içamento tenha que ser realizado com Guindastes, Gruas e Demais equipamentos;',
      'Licenças das autoridades competentes para montagem e para o funcionamento dos equipamentos.',
    ],
  };

  const DESCRICAO = {
    titulo: 'Escada Rolante - OAK',
    desc: 'A VerticalParts pode fornecer uma ampla gama de escadas rolantes com 30-35 graus de inclinação.\n\nNossos produtos são utilizados em locais públicos como, lojas de departamento, aeroportos, shopping centers, supermercados, locais de entretenimento e centro de exposições.\n\nTemos certeza de que o nosso produto irá valorizar seu empreendimento, nossos equipamentos são produzidos com tecnologia avançada e projetados com ideias de primeira linha.\n\nOs equipamentos atendem a norma NBR 16734-2022 - Escadas rolantes e esteiras rolantes-Requisitos de Segurança.',
    beneficios: 'Soluções de última geração para oferecer viagens seguras e confortáveis aos usuários.\nEficiência energética e respeito ao meio ambiente.\nNova solução que libera mais espaço para circulação.\nNovo design atemporal com uma gama de opções exclusivas.',
  };

  /* Esteira = mesmos textos, trocando o vocabulário (a Engenharia revisa o que não se aplicar). */
  function paraEsteira(t) {
    return String(t == null ? '' : t)
      .replace(/Escadas Rolantes/g, 'Esteiras Rolantes').replace(/escadas rolantes/g, 'esteiras rolantes')
      .replace(/Escada Rolante/g, 'Esteira Rolante').replace(/escada rolante/g, 'esteira rolante')
      .replace(/Degraus/g, 'Pallets').replace(/degraus/g, 'pallets').replace(/Degrau/g, 'Pallet').replace(/degrau/g, 'pallet')
      .replace(/ com 30-35 graus de inclinação/g, '');
  }

  function padroes(eq) {
    const esteira = eq === 'esteira';
    const t = esteira ? paraEsteira : (x) => x;
    const par = ([nome, desc]) => ({ nome: t(nome), desc: t(desc) });
    return {
      descricao: [{ titulo: esteira ? '' : DESCRICAO.titulo, desc: t(DESCRICAO.desc), beneficios: DESCRICAO.beneficios }],
      acabamentosLista: ACABAMENTO.map(par),
      caracteristicasTec: CARAC_TEC.map(par),
      instalacao: Object.fromEntries(Object.entries(INSTALACAO).map(([k, v]) => [k, t(v)])),
      responsabilidades: { vendedor: RESPONSABILIDADES.vendedor.map(t), comprador: RESPONSABILIDADES.comprador.map(t) },
    };
  }

  const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
  const descVazia = (arr) => !Array.isArray(arr) || !arr.length || arr.every((d) => !d || (!d.titulo && !d.desc && !d.beneficios));

  /* Preenche SÓ o que está vazio no bloco (rascunho de escada/esteira criado antes destes textos existirem).
     Objetos mesclam campo a campo; listas só entram se a do vendedor estiver vazia. Não muta `bloco`. */
  function completar(bloco, padrao) {
    const out = { ...(bloco || {}) };
    Object.keys(padrao || {}).forEach((k) => {
      const p = padrao[k];
      if (k === 'descricao') { if (descVazia(out.descricao)) out.descricao = p; return; }
      if (Array.isArray(p)) { if (vazio(out[k])) out[k] = p; return; }
      if (p && typeof p === 'object') {
        const atual = (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) ? out[k] : {};
        out[k] = completar(atual, p);
        return;
      }
      if (vazio(out[k])) out[k] = p;
    });
    return out;
  }

  window.PropostaPadroesEscEst = { padroes, completar, paraEsteira };
}());
