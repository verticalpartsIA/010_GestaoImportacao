/* ============================================================
   colaboradores-admin-store.js
   Administração — espelho de vpsistema.profiles (colaboradores_vpsistema,
   SÓ LEITURA — nome/foto/departamento real vêm de lá, nunca editados
   por aqui) + alocação de colaborador em grupo(s) de módulo do VP Gestão
   (colaborador_alocacoes, nossa própria tabela, essa sim editável).

   A alocação é o que controla o que cada colaborador vê na sidebar —
   diferente do departamento real (único, do RH): um mesmo colaborador
   pode estar alocado em vários grupos de módulo ao mesmo tempo.

   window.ColaboradoresAdminStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Mesma lista de labels usada em NAV_GROUPS (shell.jsx) — é o que existe
     pra alocar. Mantido aqui como cópia estática de propósito: evita
     acoplar a ordem de carregamento dos dois arquivos. Atualizado junto
     com a reorganização IA Fase 1 (2026-09-03) — labels antigos migrados
     em colaborador_alocacoes na mesma mudança, ver commit. */
  const GRUPOS_MODULO = [
    'Geral', 'CRM', 'Cadastros Mestres', 'Comercial | Pré-venda', 'Financeiro & Preços',
    'Contratos & Jurídico', 'Suprimentos & Importação', 'Engenharia & Produto',
    'Obras & Instalação', 'Entrega & Documentação', 'Parceiros & Instaladores',
    'Logística Interna', 'Fabricação', 'Administração',
  ];

  async function listarColaboradores() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('colaboradores_vpsistema').select('*').order('departamento').order('nome');
    if (error) { console.warn('[ColaboradoresAdminStore] listarColaboradores falhou', error); return []; }
    return data || [];
  }

  async function listarAlocacoes() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('colaborador_alocacoes').select('*');
    if (error) return [];
    return data || [];
  }

  /* Colaboradores agrupados por departamento real, cada um já com suas
     alocações de módulo — uma única leitura, monta tudo que a tela precisa. */
  async function arvoreDepartamentos() {
    const [colaboradores, alocacoes] = await Promise.all([listarColaboradores(), listarAlocacoes()]);
    const alocPorColaborador = {};
    alocacoes.forEach((a) => { (alocPorColaborador[a.colaborador_id] = alocPorColaborador[a.colaborador_id] || []).push(a.grupo_modulo); });

    const grupos = {};
    colaboradores.forEach((col) => {
      const dep = col.departamento || 'Sem departamento';
      (grupos[dep] = grupos[dep] || []).push({ ...col, alocacoes: alocPorColaborador[col.id] || [] });
    });
    Object.values(grupos).forEach((lista) => lista.sort((a, b) => (b.is_department_lead - a.is_department_lead) || a.nome.localeCompare(b.nome)));

    return Object.keys(grupos).sort((a, b) => (a === 'Sem departamento') - (b === 'Sem departamento') || a.localeCompare(b))
      .map((dep) => ({ departamento: dep, colaboradores: grupos[dep] }));
  }

  /* Marcador reservado (não é um label real de GRUPOS_MODULO) — gravado em
     colaborador_alocacoes por removerTodasAlocacoes para diferenciar
     "acesso removido de propósito" de "nunca configurado" (achado A12 da
     auditoria: lista vazia = shell.jsx mostrava o menu inteiro por engano).
     Como nunca bate com nenhum label real, grupoVisivel() em shell.jsx já
     trata como "só Geral visível" sem precisar mudar nada lá. */
  const ACESSO_RESTRITO_MARCADOR = '__acesso_restrito__';

  async function alocar(colaboradorId, grupoModulo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { error } = await c.from('colaborador_alocacoes').insert({ colaborador_id: colaboradorId, grupo_modulo: grupoModulo, alocado_por: user.email || null });
    if (error && error.code !== '23505') throw error; // 23505 = já alocado, idempotente
    // Conceder um módulo real levanta a restrição anterior, se houver.
    await c.from('colaborador_alocacoes').delete().eq('colaborador_id', colaboradorId).eq('grupo_modulo', ACESSO_RESTRITO_MARCADOR);
  }

  async function desalocar(colaboradorId, grupoModulo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('colaborador_alocacoes').delete().eq('colaborador_id', colaboradorId).eq('grupo_modulo', grupoModulo);
    if (error) throw error;
    // Se essa era a última alocação real, grava o marcador — desmarcar o
    // último módulo manualmente deve bloquear igual ao botão "Remover acesso".
    const { data: restantes } = await c.from('colaborador_alocacoes').select('grupo_modulo').eq('colaborador_id', colaboradorId).neq('grupo_modulo', ACESSO_RESTRITO_MARCADOR);
    if (!restantes || restantes.length === 0) {
      const user = window.__VP_USER || {};
      await c.from('colaborador_alocacoes').insert({ colaborador_id: colaboradorId, grupo_modulo: ACESSO_RESTRITO_MARCADOR, alocado_por: user.email || null });
    }
  }

  /* "Excluir" na tela de Administração — remove todas as alocações do
     colaborador (revoga o acesso aos módulos do VP Gestão). NÃO apaga o
     colaborador nem toca em nada no vpsistema — a pessoa continua existindo
     e o RH continua sendo a fonte da verdade sobre ela. */
  async function removerTodasAlocacoes(colaboradorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('colaborador_alocacoes').delete().eq('colaborador_id', colaboradorId);
    if (error) throw error;
    // Grava o marcador de restrição — sem isso, lista vazia = "nunca configurado"
    // e o shell mostraria o menu inteiro mesmo depois de "remover acesso" (A12).
    const user = window.__VP_USER || {};
    await c.from('colaborador_alocacoes').insert({ colaborador_id: colaboradorId, grupo_modulo: ACESSO_RESTRITO_MARCADOR, alocado_por: user.email || null });
  }

  /* ---------- Alçadas granulares (módulo → submódulo → ação) ----------
     Pedido do usuário 19/08: "Alocar em Módulo" não pode parar no grupo
     (Engenharia sim/não) — precisa entrar em cada submódulo (Ficha
     Técnica, Projeto de Elevadores...) e dentro dele dizer Criar/Editar/
     Excluir pra QUALQUER pessoa da empresa, não só vendedor. Catálogo é
     cópia estática dos itens navegáveis de NAV_GROUPS (shell.jsx) pelo
     mesmo motivo do GRUPOS_MODULO acima: não acoplar ordem de carga.
     Itens 'planned' (sem rota ainda) ficam de fora — não faz sentido dar
     alçada pra tela que não existe. Ações default cobrem o pedido
     explícito (Criar/Editar/Salvar~Editar/Excluir); Propostas mantém as
     3 capacidades específicas já em uso real (ver_todas,
     precificar_manual, destravar_aprovada — ver proposta-store.js). */
  const ACOES_PADRAO = [
    { chave: 'ver', label: 'Ver' },
    { chave: 'criar', label: 'Criar' },
    { chave: 'editar', label: 'Editar' },
    { chave: 'excluir', label: 'Excluir' },
  ];
  const CATALOGO_MODULOS = [
    { grupo: 'Administração geral', itens: [
      { modulo: 'admin', label: 'Conceder alçadas a outras pessoas', capacidades: [
        { chave: 'conceder_alcadas', label: 'Pode conceder (ou tirar) qualquer alçada de qualquer pessoa' },
      ]},
    ]},
    { grupo: 'Geral', itens: [
      { modulo: 'dashboard', label: 'Dashboard' },
      { modulo: 'notificacoes', label: 'Notificações' },
      /* 13/10/2026: as duas alçadas de decisão que o vpsistema declara existiam no banco mas sem caixa nesta tela. */
      { modulo: 'decisoes', label: 'Central de Decisões', capacidades: [
        ...ACOES_PADRAO,
        { chave: 'ceo', label: 'Decide como CEO' },
        { chave: 'gestor_comercial', label: 'Decide como Gestor Comercial' },
      ]},
      { modulo: 'financeiro', label: 'Prazos & Pendências' },
      /* 04/10/2026 — Inbox na grade de alçadas. Dono do e-mail = LOGIN de quem enviou (a resposta herda o dono do
         e-mail que responde; senão o dono da cotação; senão "sem dono"). Quem vê o dos outros é por pessoa.
         Tudo começa MARCADO (migration 20261004120000) = comportamento de hoje; o administrador desmarca.
         Regras em src/inbox-visibilidade.js (testadas). É organização na tela, não isolamento real (issue #571). */
      { modulo: 'inbox', label: 'Inbox', capacidades: [
        ...ACOES_PADRAO,
        { chave: 'ver_todos', label: 'Vê os e-mails de todos (CEO/administração)' },
        { chave: 'ver_equipe', label: 'Vê os e-mails de quem responde a ele (equipe)' },
        { chave: 'ver_departamento', label: 'Vê os e-mails do próprio departamento' },
        { chave: 'ver_area_comercial', label: 'Vê e-mails da área Comercial (interação entre áreas)' },
        { chave: 'ver_area_financeiro', label: 'Vê e-mails da área Adm/Financeiro (interação entre áreas)' },
        { chave: 'ver_area_engenharia', label: 'Vê e-mails da área Engenharia (interação entre áreas)' },
        { chave: 'ver_area_logistica', label: 'Vê e-mails da área Logística/Almoxarifado/Produção (interação entre áreas)' },
        { chave: 'ver_area_juridico_importacao', label: 'Vê e-mails da área Jurídico/Importação/Suprimentos (interação entre áreas)' },
        { chave: 'ver_area_gente_gestao', label: 'Vê e-mails da área Gente & Gestão (interação entre áreas)' },
        { chave: 'ver_area_marketing', label: 'Vê e-mails da área Marketing (interação entre áreas)' },
        { chave: 'triagem', label: 'Recebe os e-mails sem dono (fila de triagem)' },
        { chave: 'excluir_de_outros', label: 'Exclui e-mails de outras pessoas (por padrão só o dono exclui)' },
      ]},
    ]},
    { grupo: 'Cadastros', itens: [
      { modulo: 'cadastro-clientes', label: 'Clientes' },
      { modulo: 'cadastro-fornecedores', label: 'Fornecedores' },
      { modulo: 'cadastro-materias-primas', label: 'Matérias-Primas' },
      { modulo: 'cadastro-produtos', label: 'Produtos' },
      { modulo: 'ncm-catalogo', label: 'Produtos' },
      { modulo: 'cadastro-instaladores', label: 'Empresas Instaladoras' },
      { modulo: 'cadastro-custos', label: 'Atualização de Custos' },
    ]},
    { grupo: 'Comercial', itens: [
      { modulo: 'leads', label: 'Leads' },
      { modulo: 'formularios', label: 'Formulários', capacidades: [
        ...ACOES_PADRAO,
        /* 02/10/2026: sem esta alçada o vendedor só vê/edita as cotações que ELE criou
           (formulario-elevador-store.js). Quem não tem fica restrito aos próprios. */
        { chave: 'ver_de_outros', label: 'Vê e edita formulários/cotações de outros vendedores' },
        /* 12/10/2026: depois da 1ª Precificação o formulário trava; só quem tem esta alçada (o Líder, ex.: Regiane) destrava, com motivo. */
        { chave: 'destravar', label: 'Destrava formulário/cotação após a precificação (Líder)' },
      ]},
      { modulo: 'propostas', label: 'Propostas', capacidades: [
        { chave: 'ver_todas', label: 'Vê propostas de outros vendedores' },
        { chave: 'precificar_manual', label: 'Precifica manualmente' },
        { chave: 'destravar_aprovada', label: 'Destrava proposta aprovada' },
        { chave: 'excluir', label: 'Exclui propostas' },
      ]},
      { modulo: 'controle-cotacoes', label: 'Controle de Cotações' },
      /* 13/10/2026: declarada no vpsistema (só esta ação, sem Ver/Criar/Editar/Excluir) — antes sem caixa nesta tela. */
      { modulo: 'quadro_comando', label: 'Quadro de Comando', capacidades: [
        { chave: 'decidir_fabricacao', label: 'Decide fabricar interno ou comprar pronto' },
      ]},
      { modulo: 'contratos-sociais', label: 'Contratos Social' },
    ]},
    { grupo: 'ADM/ Financeiro', itens: [
      { modulo: 'cotacoes-fornecedor', label: 'Cotações a Fornecedor' },
      { modulo: 'precificacao', label: 'Precificação' },
      { modulo: 'aval-financeiro', label: 'Aval Financeiro' },
      { modulo: 'emissao-nf', label: 'Emissão de NF' },
    ]},
    { grupo: 'Jurídico', itens: [
      { modulo: 'contrato-venda-equipamentos', label: 'Contrato Venda de Equipamentos' },
      { modulo: 'aval-juridico', label: 'Aval Jurídico' },
      { modulo: 'contrato-instalador', label: 'Contrato Instalador' },
      { modulo: 'juridico', label: 'Contratos & Minutas' },
    ]},
    { grupo: 'Importação | Suprimentos', itens: [
      { modulo: 'importacao', label: 'Importação' },
      { modulo: 'gi-painel', label: 'Painel (Gestão Importação)' },
      { modulo: 'pi-importacao', label: 'P.I.' },
      { modulo: 'rfq-importacao', label: 'RFQ' },
      { modulo: 'ims-importacao', label: 'IMS' },
      { modulo: 'embarques-importacao', label: 'Embarques' },
      { modulo: 'gi-analise-precos', label: 'Análise de Preços' },
      { modulo: 'compras', label: 'Importação Varejo' },
      { modulo: 'cotacoes-varejo', label: 'Cotações de Varejo' },
      { modulo: 'pedidos-acompanhamento', label: 'Pedidos' },
    ]},
    { grupo: 'Engenharia', itens: [
      { modulo: 'engenharia', label: 'Engenharia' },
      { modulo: 'eng-projeto-elevadores', label: 'Projeto de Elevadores' },
      { modulo: 'repositorio-documentos', label: 'Repositório Documentos' },
      { modulo: 'eng-configurador', label: 'Projeto de Equipamento' },
      { modulo: 'desenho-tecnico', label: 'Projetos ER/Es' },
      { modulo: 'solicitacoes-produto', label: 'Solicitações de Produto' },
      { modulo: 'ficha-tecnica', label: 'Ficha Técnica', capacidades: [
        { chave: 'ver', label: 'Ver' },
        { chave: 'criar', label: 'Criar' },
        { chave: 'editar', label: 'Editar' },
        { chave: 'excluir', label: 'Excluir' },
        { chave: 'publicar_omie', label: 'Publica (ou republica) a ficha como anexo no Omie' },
      ]},
      { modulo: 'vistorias', label: 'Vistorias de Obras' },
      { modulo: 'instalacao', label: 'Instalação em Campo', capacidades: [
        ...ACOES_PADRAO,
        /* 13/10/2026: declarada no vpsistema; antes sem caixa nesta tela. */
        { chave: 'editar_status_obra', label: 'Edita status do Acompanhamento de Obra' },
      ]},
      { modulo: 'mapa-obras', label: 'Mapa de Obras', capacidades: [
        ...ACOES_PADRAO,
        /* 25/10/2026: pausa de obra legitimamente parada (para de cobrar o Felipe até a data). */
        { chave: 'pausar', label: 'Pausa a obra (some da cobrança diária até a data)' },
      ]},
      { modulo: 'status-obras', label: 'Status de Obras' },
      { modulo: 'linha-do-tempo', label: 'Linha do Tempo da Cotação' },
      { modulo: 'art', label: 'ART' },
      { modulo: 'cronograma', label: 'Cronograma' },
      { modulo: 'central-documentos', label: 'Central de Documentos' },
      { modulo: 'databook', label: 'Data Book & Termo' },
      { modulo: 'handover', label: 'Entrega Final' },
    ]},
    { grupo: 'RH Operacional', itens: [
      { modulo: 'rh-homologacao', label: 'Homologação de Instaladores' },
    ]},
    { grupo: 'Logística', itens: [
      { modulo: 'almoxarifado', label: 'Almoxarifado', capacidades: [
        { chave: 'ver', label: 'Ver' },
        { chave: 'criar', label: 'Criar' },
        { chave: 'editar', label: 'Editar' },
        { chave: 'excluir', label: 'Excluir' },
        { chave: 'ver_custo', label: 'Vê os preços de custo dos itens do estoque' },
        { chave: 'escrever_omie', label: 'Grava no Omie: requisição de compra e movimento de estoque (entrada, saída, ajuste)' },
        { chave: 'custo_manual', label: 'Informa o custo manual (estimado) de itens que o Omie ainda não tem custo' },
        { chave: 'reposicao_config', label: 'Define os parâmetros da Reposição (prazo de chegada, folga, ciclo de compra)' },
      ]},
      { modulo: 'carga-maquina', label: 'Carga Máquina' },
      { modulo: 'montagem-produto', label: 'Montagem do Produto' },
      { modulo: 'lista-fios', label: 'Lista de fios do quadro (Montagem do Produto)' },
      { modulo: 'simulacao-producao', label: 'Simulação' },
      { modulo: 'mes', label: 'MES — Sistema de Execução da Manufatura' },
      { modulo: 'mes-cadastros', label: 'MES — Cadastros do chão de fábrica' },
      { modulo: 'relatorios-pcp', label: 'Relatórios do PCP' },
      { modulo: 'expedicao', label: 'Expedição' },
      { modulo: 'separacao', label: 'Separação (painel TV dos pedidos a separar)', capacidades: [
        { chave: 'ver', label: 'Vê os links do painel TV e o SLA da separação' },
        { chave: 'editar', label: 'Gera e revoga links do painel TV e muda o SLA da separação' },
        { chave: 'enviar_fabricacao', label: 'Envia item da separação para Fabricação Corte ou Corrimão (cria a OP na hora)' },
      ]},
      { modulo: 'fabricacao-corrimao', label: 'Fabricação Corrimão' },
      { modulo: 'fabricacao-corte', label: 'Fabricação Corte' },
      /* Etiquetas (endereço, item…). Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md. As chaves são as que o SQL confere
         (migration 20261017160000: política de etiqueta_impressoes). Só quem tem 'imprimir' imprime; 'reimprimir' é outra alçada e exige motivo. */
      { modulo: 'etiquetas', label: 'Etiquetas (endereço, item, palete…)', capacidades: [
        { chave: 'ver', label: 'Vê a tela de Etiquetas, os modelos e o histórico de impressões' },
        { chave: 'imprimir', label: 'Imprime etiquetas' },
        { chave: 'reimprimir', label: 'Reimprime uma etiqueta já impressa (exige motivo)' },
        { chave: 'editar_modelos', label: 'Cria e edita modelos de etiqueta da empresa (fase 3)' },
        { chave: 'administrar', label: 'Administra modelos padrão, vínculos e impressoras (fase 3)' },
      ]},
      /* VP Estoque (app de coleta, 013_Estoque). As chaves abaixo são as que o SQL confere por e-mail
         (estoque_cap_email / estoque_exige) — migrations 20261013120000 e 20261013130000. Não renomeie sem mudar o SQL. */
      { modulo: 'estoque', label: 'VP Estoque — app de coleta (recebimento, contagem, saída, inventário)', capacidades: [
        { chave: 'contar', label: 'Conta o estoque no app (contagem e inventário)' },
        { chave: 'receber', label: 'Registra recebimento de mercadoria no app' },
        { chave: 'saida', label: 'Registra saída de material no app (ordem de produção, obra, consumo interno)' },
        { chave: 'abrir_sessao', label: 'Abre sessões de contagem/inventário e congela a lista esperada' },
        { chave: 'revisar', label: 'Revisa as sessões: vê o saldo do sistema e as diferenças, pede recontagem, decide e rejeita leituras' },
        { chave: 'aprovar', label: 'Aprova a contagem (grava o contado no hub) e fecha a sessão' },
      ]},
      { modulo: 'pcp', label: 'PCP — Planejamento e Controle da Produção', capacidades: [
        { chave: 'ver', label: 'Ver' },
        { chave: 'criar', label: 'Criar' },
        { chave: 'editar', label: 'Editar' },
        { chave: 'excluir', label: 'Excluir' },
        { chave: 'apontar_hh', label: 'Escolhe quem trabalhou na OP e as horas (mão de obra). O valor da hora é buscado no Omie e fica oculto' },
        { chave: 'ver_hh', label: 'Vê o valor da hora-homem e o custo de mão de obra das OPs (dado salarial)' },
      ]},
    ]},
    { grupo: 'Portal Admin', itens: [
      { modulo: 'logs', label: 'Logs de Atividade' },
    ]},
  ];

  /* Grupo da sidebar (GRUPOS_MODULO) → módulos do CATALOGO_MODULOS que
     moram nele. Os dois vocabulários de grupo são diferentes (o catálogo
     é por área de alçada, a sidebar é navegação), então o vínculo é este
     mapa explícito. Marcar o grupo de um colaborador concede TODAS as
     ações desses módulos; "admin.conceder_alcadas" fica de fora de
     propósito — poder de dar poder a terceiros nunca vem de tabela. */
  const MODULOS_POR_GRUPO_SIDEBAR = {
    'Geral': ['dashboard', 'notificacoes', 'decisoes', 'financeiro'],
    'CRM': ['leads'],
    'Cadastros Mestres': ['cadastro-clientes', 'cadastro-fornecedores', 'cadastro-materias-primas', 'cadastro-produtos'],
    'Comercial | Pré-venda': ['formularios', 'controle-cotacoes', 'cotacoes-fornecedor', 'propostas', 'contratos-sociais'],
    'Financeiro & Preços': ['cadastro-custos', 'precificacao', 'aval-financeiro', 'emissao-nf'],
    'Contratos & Jurídico': ['contrato-venda-equipamentos', 'aval-juridico', 'juridico'],
    'Suprimentos & Importação': ['importacao', 'gi-painel', 'pi-importacao', 'rfq-importacao', 'ims-importacao', 'embarques-importacao', 'gi-analise-precos', 'compras', 'cotacoes-varejo', 'pedidos-acompanhamento'],
    'Engenharia & Produto': ['engenharia', 'eng-projeto-elevadores', 'eng-configurador', 'desenho-tecnico', 'solicitacoes-produto', 'ficha-tecnica', 'ncm-catalogo', 'linha-do-tempo'],
    /* 29/10/2026: 'cronograma' mudou de lugar no menu (ver shell.jsx) — fica também aqui.
       Mantido também em 'Obras & Instalação' de propósito, pra quem já tinha esse
       grupo alocado não perder a alçada (mesmo padrão de Matérias-Primas/Produtos, 18/10). */
    'Obras & Instalação': ['status-obras', 'vistorias', 'instalacao', 'mapa-obras', 'cronograma', 'art'],
    'Entrega & Documentação': ['central-documentos', 'databook', 'handover', 'repositorio-documentos'],
    'Parceiros & Instaladores': ['cadastro-instaladores', 'rh-homologacao', 'contrato-instalador', 'cronograma'],
    'Logística Interna': ['almoxarifado', 'carga-maquina', 'montagem-produto', 'lista-fios', 'simulacao-producao', 'pcp', 'mes', 'mes-cadastros', 'relatorios-pcp', 'expedicao', 'separacao', 'etiquetas', 'fabricacao-corrimao', 'fabricacao-corte'],
    /* Fabricação saiu de Logística Interna (17/10/2026). Logística Interna mantém a lista completa de propósito: quem já tinha o grupo alocado não perde nada. */
    /* Matérias-Primas e Produtos passaram a morar aqui no menu (18/10/2026); continuam também em Cadastros Mestres acima, para ninguém perder a alçada já concedida. */
    'Fabricação': ['pcp', 'mes', 'mes-cadastros', 'carga-maquina', 'cadastro-materias-primas', 'cadastro-produtos', 'montagem-produto', 'lista-fios', 'simulacao-producao', 'relatorios-pcp', 'fabricacao-corrimao', 'fabricacao-corte'],
    'Administração': ['logs'],
  };

  /* Lista { modulo, capacidade } de tudo que o grupo inteiro cobre. */
  function capacidadesDoGrupo(grupo) {
    const ids = new Set(MODULOS_POR_GRUPO_SIDEBAR[grupo] || []);
    const out = [];
    CATALOGO_MODULOS.forEach((g) => g.itens.forEach((it) => {
      if (!ids.has(it.modulo)) return;
      (it.capacidades || ACOES_PADRAO).forEach((a) => out.push({ modulo: it.modulo, capacidade: a.chave }));
    }));
    return out;
  }

  /* Conceder/retirar alçadas saiu do HUB (árvore de alçadas, Gelson
     09/10/2026): quem concede agora é o vpsistema.com/administracao, que
     alimenta alcadas_capacidade pela edge function vpsistema-sync. O banco
     já recusa gravação vinda do navegador; aqui só deixamos a mensagem clara. */
  async function concederGrupoInteiro() { throw new Error('As alçadas agora são geridas em vpsistema.com/administracao.'); }

  async function listarCapacidadesConcedidas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('alcadas_capacidade').select('perfil_id, modulo, capacidade');
    if (error) return [];
    return data || [];
  }

  async function concederCapacidade() { throw new Error('As alçadas agora são geridas em vpsistema.com/administracao.'); }

  /* Modo MANUAL por pessoa (14/10/2026, Gelson): com perfis.acesso_manual o
     vpsistema-sync não mexe nas alçadas nem no menu dela; um Administrador
     marca/desmarca aqui. Gravação só pelas RPCs (conferem Administrador no banco). */
  async function acessoManual(perfilId) {
    const c = sb(); if (!c) return false;
    const { data } = await c.from('perfis').select('acesso_manual').eq('id', perfilId).maybeSingle();
    return !!(data && data.acesso_manual);
  }
  async function rpcManual(nome, args) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.rpc(nome, args);
    if (error) throw error;
    if (!data || data.ok !== true) {
      const m = { so_administrador: 'Só Administrador pode fazer isso.', perfil_nao_esta_em_modo_manual: 'Esta pessoa não está em modo manual.', perfil_inexistente: 'Perfil não encontrado.' };
      throw new Error(m[data && data.motivo] || 'O banco recusou a alteração.');
    }
    return data;
  }
  const definirAcessoManual = (perfilId, manual) => rpcManual('hub_set_acesso_manual', { p_perfil: perfilId, p_manual: !!manual });
  const definirAlcadaManual = (perfilId, modulo, capacidade, concedida) => rpcManual('hub_set_alcada_manual', { p_perfil: perfilId, p_modulo: modulo, p_capacidade: capacidade, p_concedida: !!concedida });


  /* Roda quando a identidade chega (evento 'vpprd:user' de supabase.js) —
     acha o colaborador correspondente pelo id (vem do JWT do vpsistema,
     mesmo id de profiles/colaboradores_vpsistema) e enriquece
     window.__VP_USER com foto real + os grupos alocados, depois redispara
     o evento pra Shell/sidebar re-renderizarem já com a foto. */
  async function enriquecerUsuarioLogado() {
    const c = sb(); const u = window.__VP_USER;
    if (!c || !u || !u.id || u.id === 'dev-local') return;
    try {
      const { data: col } = await c.from('colaboradores_vpsistema').select('id, avatar_url, departamento').eq('id', u.id).maybeSingle();
      if (!col) return;
      const { data: aloc } = await c.from('colaborador_alocacoes').select('grupo_modulo').eq('colaborador_id', col.id);
      window.__VP_USER = { ...u, avatarUrl: col.avatar_url || null, departamentoReal: col.departamento || null, gruposAlocados: (aloc || []).map((a) => a.grupo_modulo) };
      try { sessionStorage.setItem('vpprd_user', JSON.stringify(window.__VP_USER)); } catch (e) {}
      window.dispatchEvent(new CustomEvent('vpprd:user', { detail: window.__VP_USER }));
    } catch (e) { console.warn('[ColaboradoresAdminStore] enriquecerUsuarioLogado falhou', e); }
  }

  window.addEventListener('vpprd:user', () => { if (!(window.__VP_USER || {}).avatarUrl) enriquecerUsuarioLogado(); });
  if (window.__VP_USER) enriquecerUsuarioLogado();

  window.ColaboradoresAdminStore = {
    GRUPOS_MODULO, listarColaboradores, listarAlocacoes, arvoreDepartamentos,
    alocar, desalocar, removerTodasAlocacoes, enriquecerUsuarioLogado,
    ACOES_PADRAO, CATALOGO_MODULOS, listarCapacidadesConcedidas, concederCapacidade,
    MODULOS_POR_GRUPO_SIDEBAR, capacidadesDoGrupo, concederGrupoInteiro,
    acessoManual, definirAcessoManual, definirAlcadaManual,
  };
}());
