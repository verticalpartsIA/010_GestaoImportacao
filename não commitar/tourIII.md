# Tour III do VP Gestão

Roteiro de aula e estrutura para mapa mental da VerticalParts.

Data da análise: 12/09/2026. Repositório: verticalpartsIA/010_GestaoImportacao. Versão publicada observada no rodapé: commit 01d965fb221921277d42c0961df754ba8ce4a3d6.

## Como ler e usar este roteiro

Cada categoria do menu é um ramo principal. Dentro dela, cada tela é um ramo; seus formulários, abas, documentos, janelas e ações são os ramos seguintes. Os títulos podem ser importados por ferramentas que transformam Markdown em mapa mental. As tabelas são notas explicativas dos respectivos ramos.

Esta terceira versão combina o código com uma navegação autenticada no portal e no aplicativo. Foram abertas as rotas da sidebar atual, formulários e janelas principais. Também foram criados registros de treinamento identificados com “Teste”: uma tarefa do Dashboard, um cliente, um Lead e um rascunho de formulário/cotação. Eles devem ser removidos ou arquivados depois da aula. A inspeção ao vivo confirma presença e comportamento dos controles observados naquele momento; o apêndice separa limitações de implementação e pontos que ainda exigem repetição em produção.

“Herda” significa carregar ou copiar dados existentes. “Alimenta” significa que existe uma gravação ou vínculo usado por outra parte do sistema. A presença de um número de cotação digitado manualmente não significa que todos os campos sejam sincronizados automaticamente. Os destinos mencionados devem ser entendidos com essa distinção.

### Caso didático contínuo

Usaremos a fictícia Construtora Horizonte, obra Edifício Horizonte em São José dos Campos, interessada em dois elevadores: um de 630 kg e dez paradas, outro de 1.000 kg e dez paradas. Além dela, a validação desta versão criou registros separados identificados com “Teste”; eles estão listados no registro de validação e não fazem parte do caso didático.

O Comercial identifica a oportunidade, registra os requisitos e negocia. O Financeiro forma preço e registra as liberações. O Jurídico formaliza os compromissos. Suprimentos conduz compra e transporte. Engenharia define o produto. Obras organiza execução e evidências. Parceiros & Instaladores reúne cadastro, documentação, contrato e pagamentos. Entrega encerra a obrigação e Administração governa acessos e rastreabilidade.

### Camada comum a todas as telas

O título da categoria no menu expande ou recolhe seus itens. Não abre uma página de cadastro da categoria. O botão de recolher a barra lateral muda sua apresentação; os itens continuam sendo os acessos às telas. Grupos recolhidos são lembrados no navegador.

O cabeçalho apresenta o caminho da página. A organização visual atual do menu não coincide necessariamente com o prefixo antigo da URL. Por exemplo, uma tela hoje agrupada em Obras pode continuar usando uma rota de Engenharia. Isso não indica, por si só, erro de navegação.

A visibilidade depende do perfil e das alocações do colaborador. Geral continua sendo navegação básica; itens financeiros e administrativos possuem restrições próprias. Um usuário pode não ter os mesmos botões do administrador.

Modais são janelas sobre a tela. Cancelar/Fechar retorna ao contexto anterior. Salvar rascunho preserva trabalho em andamento; aprovar, publicar, enviar, finalizar e marcar pago são ações distintas, com efeitos de negócio diferentes. Não usar esses botões como demonstração inconsequente durante a aula.

### Cabeçalho → Busca global

Digite pelo menos dois caracteres para consultar Leads, Projetos, Contratos e Embarques. O painel agrupa resultados por domínio e limita a busca a até seis por grupo. Clicar no resultado abre o detalhe de Lead, Contrato ou Embarque; no grupo Projetos, conduz à lista de obras. Limpar busca apaga a expressão; Escape ou clique fora fecha o painel. A busca não cobre automaticamente todas as entidades do sistema.

### Cabeçalho → Perfil, notificações e ajuda

Visualizando como abre os perfis Comercial, Engenharia, Financeiro e Admin disponibilizados pelo componente. Escolher altera o perfil de visualização. Isso não deve ser confundido com conceder autorização de banco. O sino abre Notificações. Ajuda abre Central de Ajuda, com orientação da tela, perguntas frequentes, Fechar e Falar com o suporte. O último abre o aplicativo de e-mail com o assunto contextualizado.

O primeiro segmento do caminho volta ao Dashboard; o segmento de módulo volta ao destino definido para aquele módulo. A versão no rodapé indica a atualização publicada quando a consulta de versão consegue confirmá-la.

### Estrutura atual da sidebar, confirmada ao vivo

Para o mapa mental, trate cada grupo abaixo como um mapa independente. “CRM” é um grupo visual sem tela disponível e deve ser marcado como “Em breve”. “Gestão Importação” é um subtítulo interno de Suprimentos & Importação, não uma tela. O rodapé mostra o usuário ativo, e o botão “Toggle sidebar” recolhe ou expande a navegação.

| Mapa | Ramos exibidos |
| --- | --- |
| Geral | Dashboard; Notificações; Central de Decisões; Prazos & Pendências; Inbox |
| CRM | Em breve, sem submódulos navegáveis |
| Cadastros Mestres | Clientes; Fornecedores |
| Comercial \| Pré-venda | Leads; Formulários; Controle de Cotações; Cotações a Fornecedor; Propostas |
| Financeiro & Preços | Atualização de Custos; Precificação; Aval Financeiro; Comissões |
| Contratos & Jurídico | Contrato Venda de Equipamentos; Contratos & Minutas |
| Suprimentos & Importação | Painel; P.I.; RFQ; IMS; Embarques; Importação; Análise de Preços; Compras Nacional; Pedidos |
| Engenharia & Produto | Engenharia; Projeto de Elevadores; Projeto de Equipamento; Projetos ER/Es; Ficha Técnica; Produtos; Linha do Tempo da Cotação |
| Obras & Instalação | Dossiês de Obras; Vistorias de Obras; Resultado Vistorias de Obras; Instalação em Campo; Cronograma; ART |
| Entrega & Documentação | Central de Documentos; Data Book & Termo; Entrega Final |
| Parceiros & Instaladores | Empresas Instaladoras; Homologação de Instaladores; Contrato Instalador; Pagamentos a Instaladores |
| Logística Interna | Almoxarifado |
| Administração | Logs de Atividade; Configurações do Sistema |

O nome “Dossiês de Obras” é o rótulo atual da antiga tela de status de obras. “Data Book & Termo” é o rótulo atual da tela antes apresentada como Guia Book & Termo. “RFQ” é a sigla exibida na sidebar; a rota e o código usam RFQ de importação. No rodapé observado ao vivo, o usuário exibido foi “Gelson Simoes”, não “Deilson Simões”; o roteiro deve ensinar o rótulo que o perfil da turma realmente mostrar.

# 1. Geral

Esta categoria reúne quatro telas que ajudam a saber como está a operação, o que chegou, quem precisa decidir e qual prazo está pendente. Sua proposta é permitir que o usuário encontre a próxima ação antes de abrir cada departamento separadamente.

## 1.1 Dashboard

O Dashboard reúne indicadores do perfil, projetos em andamento, tarefas, funil comercial, conversão por origem e etapas atrasadas. É um ponto de leitura e de encaminhamento. O mesmo nome de tela pode apresentar indicadores diferentes para Comercial, Engenharia, Financeiro e Admin.

### Cabeçalho e ações

| Item | Proposta e comportamento |
| --- | --- |
| Saudação e data | Situam a leitura no dia corrente. A saudação usa a identificação do perfil no código. |
| Alertas críticos | Havendo alertas, clicar no número abre Notificações. |
| Quantidade de tarefas | Conta as tarefas pendentes carregadas para o perfil. |
| Hoje / 7 dias / 30 dias / 90 dias | O botão alterna o período escrito. A limitação funcional está no apêndice A02. |
| Relatório | Baixa CSV com indicador, valor, complemento e variação dos KPIs do perfil. O arquivo recebe perfil e data no nome. Não é um pacote de todos os registros do sistema. |
| Ir para Leads | Abre a lista de Leads, onde existe o botão Novo Lead. |

### Indicadores

Os cartões sintetizam informações lidas de leads, cotações, propostas, projetos, contratos, embarques, gatilhos, comissões e outras bases, conforme o perfil. São leituras gerenciais; a edição do registro que origina o indicador acontece no módulo de origem. “Sem dados suficientes” e ausência de registros devem ser explicados como limitações da informação disponível.

### Projetos em Andamento

| Ramo | O que mostrar na aula |
| --- | --- |
| Gantt | Projetos distribuídos no tempo. A fase é derivada da esteira de gatilhos da cotação. |
| Lista | Os mesmos projetos em apresentação textual. |
| Kanban | Os projetos agrupados por fase. Não há neste componente movimentação manual de fase por arrastar. |
| Expandir | Solicita tela cheia do navegador; novo acionamento sai da tela cheia. |
| Clicar em um projeto | Abre janela de detalhe com ID, cliente, fase atual, início, previsão de término, valor e responsável, quando disponíveis. |
| Fechar | Fecha o detalhe e preserva o Dashboard. |

### Tarefas de Hoje

A lista mostra título, horário, módulo e prioridade. O botão de mais abre Nova Tarefa. O formulário possui Título da tarefa obrigatório, Módulo (Comercial, Engenharia, Jurídico, Importação, Financeiro ou Instalação), Prioridade (Alta, Média ou Baixa) e Horário. Criar Tarefa grava a tarefa pendente associada ao perfil corrente e recarrega o painel; Cancelar fecha sem criar. O checkbox exibido em cada tarefa exige a ressalva A03.

### Pipeline Comercial

Mostra o volume em cada estágio e a conversão Lead → Contrato. Serve para discutir em qual estágio a empresa perde oportunidades. Não cria uma proposta nem converte um lead quando se olha o gráfico.

### Conversão por Origem

Compara volume e conversão por origem dos leads. O Comercial deve preencher a origem com consistência para que o gráfico seja útil.

### Onde Parou

Lista até seis etapas abertas com prazo vencido, ordenadas pelo atraso. Cada linha mostra o evento, a cotação e os dias de atraso. Clicar pede ao motor de gatilhos o destino correspondente, podendo abrir uma tela com um registro específico. “Ver Gatilhos & Prazo” leva à tela hoje chamada Prazos & Pendências no menu.

### Herança e destino

O painel consulta as bases operacionais. Projetos do gráfico são derivados de formulários e gatilhos. Relatório gera um arquivo local; Ir para Leads e alertas apenas navegam; Nova Tarefa grava uma tarefa. No exemplo, o gestor usa Onde Parou para descobrir se a cotação da Horizonte aguarda fornecedor, Financeiro ou cliente.

Fonte: src/dashboard.jsx, src/supabase.js e src/dashboard-metrics-*.js.

## 1.2 Notificações

Notificações é a caixa de alertas operacionais. Uma notificação informa um acontecimento ou pendência. Marcar como lida registra leitura, sem aprovar a decisão nem encerrar automaticamente o evento de negócio.

### Lista, filtros e detalhe

Controle | Finalidade e resultado |

Todas / Não lidas | Filtra o estado de leitura. |

Seletor de módulo | Restringe a lista às origens presentes nos alertas carregados. |

Grupos por período | Organizam os alertas cronologicamente. |

Clicar na linha | Abre Detalhe da Notificação: módulo, título, complemento e horário. |

Ícone de check | Marca apenas aquela notificação como lida. |


Abrir origem | Marca a leitura e navega para a rota associada ao módulo. A tela não transmite aqui o ID específico do objeto. |

Marcar todas como lidas | Marca todos os alertas carregados, inclusive os que não aparecem no filtro corrente. |

### Preferências

Abre uma janela com Alertas no sistema, Resumo por email, Financeiro, Operações e Comercial. Salvar preferências guarda as escolhas no navegador; Cancelar fecha a janela. Não apresentar esses controles como prova de envio de e-mail ou assinatura ativa de notificações. Ver A04.

### Herança e destino

A lista consulta alertas não resolvidos. A leitura é armazenada por meio do serviço de notificações lidas. A origem pode ser Comercial, Operações ou Financeiro. No exemplo, a resposta do fornecedor pode motivar o retorno à cotação para análise; ler o alerta não aprova a compra.

Fonte: src/financeiro.jsx, src/notificacoes-processamento.js, src/notificacoes-lidas-store.js.

## 1.3 Central de Decisões

Reúne decisões que aguardam o usuário logado. A proposta é concentrar aprovações humanas distribuídas entre os departamentos. O administrador não deve presumir que esta tela é uma lista irrestrita de todas as decisões de todos os usuários.

### Aguardando você

Cada cartão mostra tipo de decisão, cliente/título/obra/item, número da cotação, quantidade, solicitante, valor e data de abertura, conforme o contexto disponível.

### Aprovar

Registra aprovação, executa o tratamento correspondente ao tipo de decisão e recarrega a fila. Dependências entre decisões podem liberar uma próxima decisão. Aprovar um item não equivale a liberar todas as condições da compra.

### Reprovar

Abre Reprovar decisão. O campo Motivo é obrigatório. Confirmar reprovação registra o resultado e a justificativa; Cancelar fecha sem reprovar. A decisão deixa de estar na fila de pendentes depois do recarregamento.

### Herança e destino

Consulta decisões gerenciais atribuídas ao usuário. Seus efeitos variam pelo tipo: autorização de compra, contratação, vinculação e demais eventos tratados pelo serviço. Pode gerar alertas e liberar decisões dependentes. No exemplo, a diretoria pode decidir sobre a compra depois das condições antecedentes.

Fonte: src/decisoes.jsx e src/decisoes-store.js.

## 1.4 Prazos & Pendências

No conteúdo e nas rotas ainda aparecem os nomes Gatilhos & Prazo e Financeiro. Esta é a tela de acompanhamento temporal da cadeia de cada cotação e dos compromissos financeiros avulsos. Está restrita a Financeiro/Admin no código consultado.

### Resumo e entrada

Os KPIs mostram cotações em andamento, ações pendentes do Financeiro, gatilhos manuais próximos de sete dias e manuais atrasados. Central de Alertas destaca o que exige atenção; Ver tudo abre Notificações.

Exportar fluxo baixa CSV dos gatilhos manuais, com projeto, empreendimento, gatilho, valor, vencimento, dias restantes e status. Não exporta automaticamente toda a árvore de eventos.

### Novo gatilho

Abre Novo Gatilho Financeiro. O formulário possui Prédio / Projeto obrigatório, Código do projeto, Tipo de gatilho (Pagamento entrada, Pagamento embarque, Pagamento entrega, Sinal, Medição ou Outro), Valor em reais, Vencimento obrigatório, Status (pendente, atenção ou ok) e Base do prazo reverso. Criar Gatilho grava o registro e recarrega a tela. Cancelar descarta a abertura.

### Cadeia de Gatilhos por Cotação

Cada cotação pode ser expandida para mostrar seus eventos, prazos, conclusões e lembretes. As barras temporais tornam visível o tempo consumido. A linha do evento conduz à atividade que o resolve quando existe destino configurado.

| Ação filha | Campos e consequência |
| --- | --- |
| Confirmar Boleto Pago | Abre janela com valor recebido e data de pagamento; confirmação registra o sinal no fluxo. |
| Dar Aval de Pagamento | Abre janela de observações opcionais; confirma o aval correspondente. |
| Fechar com motivo | Exige explicar o que aconteceu; Encerrar ciclo registra a justificativa de fechamento. |
| Já cobrei | Fecha o lembrete de cobrança. Não deve ser confundido com resposta do cliente. |
| Confirmar gatilho avulso | Registra a conclusão do compromisso manual. |

### Herança e destino

Lê os gatilhos produzidos pelas etapas do sistema e os registros manuais. Confirmações alimentam a esteira, podem atualizar o aval/sinal e liberar ações dependentes. No exemplo, o Financeiro registra que o sinal da Horizonte foi recebido; a compra ainda depende das demais condições exigidas.

Fonte: src/financeiro.jsx, src/gatilhos-engine.js, src/eventos-fluxo-store.js.

# 2. Cadastros Mestres

Duas telas mantêm identidades reutilizáveis em várias áreas. O objetivo é evitar cadastrar o mesmo cliente ou fornecedor de formas diferentes em cada operação.

## 2.1 Clientes

A lista possui busca por código, nome ou CNPJ/CPF. Novo cliente abre cadastro; Editar abre o registro existente; Histórico abre a janela de relacionamento; Excluir aciona a rotina de exclusão.

### Novo cliente / Editar cliente

| Campo | Proposta |
| --- | --- |
| Tipo de pessoa | Define PJ ou PF e o documento correspondente. |
| CNPJ / CPF | Identifica a pessoa. Documento pendente permite registrar a condição ainda não regularizada. |
| Inscrição estadual | Complementa a identificação fiscal. |
| Razão social / Nome | Identidade principal obrigatória. |
| Nome fantasia | Nome comercial usado para reconhecimento. |
| E-mail, telefone e contato | Canais e pessoa de referência. |
| Logradouro, complemento, bairro, CEP, cidade e estado | Endereço cadastral. |
| Ativo | Controla o estado de uso do cadastro. |

Cadastrar cliente ou Salvar alterações grava os dados. Cancelar retorna à lista. Histórico reúne os dados de relacionamento disponíveis, sem exigir que o usuário abra cada documento isoladamente.

### Herança e destino

O cadastro pode ser associado ao Lead e ao Formulário. É consultado por operações comerciais e dossiês. Os documentos que copiam dados precisam ser conferidos depois de uma alteração cadastral: copiar para uma proposta não é necessariamente manter um espelho vivo.

No exemplo, primeiro localize a Horizonte antes de criar um segundo cadastro para a mesma empresa.

Fonte: src/cadastros.jsx e src/cadastros-clientes-store.js.

## 2.2 Fornecedores

Mantém fornecedores e categorias de fornecimento. Há busca por código/nome/documento e filtro de categoria, além de Novo fornecedor, Editar e Excluir.

### Cadastro

Categorias são obrigatórias e permitem marcar mais de uma. Tipo de pessoa, CPF/CNPJ, razão social/nome, nome fantasia, e-mail, telefone e contato identificam o parceiro. O endereço usa logradouro, complemento, bairro, CEP, cidade e estado. Observações registram particularidades. Ativo controla o estado do cadastro.

### Avaliações

No contexto do fornecedor há avaliações, média de notas, nota e comentário opcional. Avaliar grava a avaliação; a lixeira remove a avaliação selecionada. O objetivo é manter memória da experiência com o fornecedor.

### Herança e destino

Fornecedores aparecem como sugestões e seleções em P.I., RFQ, IMS, Embarques e Pedidos. Seleção por nome ou preenchimento textual não deve ser ensinada como vínculo universal por ID sem conferir a tela. O cadastro de operador estrangeiro em Produtos é outra entidade, com finalidade aduaneira.

Fonte: src/cadastros.jsx e src/cadastros-fornecedores-store.js.

# 3. Comercial | Pré-venda

Cinco telas conduzem a oportunidade até a oferta: Leads, Formulários, Controle de Cotações, Cotações a Fornecedor e Propostas. A proposta desta categoria é conservar a identidade do cliente e dos equipamentos durante a negociação.

## 3.1 Leads

O Lead registra o interesse comercial. Os KPIs mostram leads ativos, em qualificação, propostas e valor de pipeline. Há pesquisa por prédio, contato e equipamento; filtros e paginação organizam a listagem. Exportar gera CSV dos registros selecionados pelo tratamento da lista, com identificação, contatos, equipamento, origem, status, responsável, valor, prioridade, próxima ação e data.

### Novo Lead / Editar Lead

O formulário trata cliente e documento, tipo de pessoa, CPF/CNPJ, documento pendente, consulta de CNPJ e razão social. Também reúne identificação da oportunidade, contato, telefone, e-mail, origem, responsável, prioridade, valor estimado e próxima ação. Buscar CNPJ auxilia o preenchimento cadastral; não substitui a conferência dos dados retornados. Equipamentos detalhados pertencem ao Formulário.

Salvar registra a oportunidade. Depois da criação, uma janela de sucesso oferece acesso ao Formulário e se fecha automaticamente após alguns segundos. Editar usa o mesmo contexto para atualizar o Lead existente.

### Detalhe do Lead

| Ramo | O que faz |
| --- | --- |
| Voltar para Leads | Retorna à lista. |
| Cliente | Exibe razão social, documento e valor estimado. |
| Contato | Exibe telefone e e-mail. |
| WhatsApp | Abre conversa externa usando o telefone cadastrado. |
| Email | Abre o aplicativo de e-mail com o destinatário. |
| Editar Lead | Abre a edição da oportunidade. |
| Abrir Formulário | Recupera ou inicia o contexto técnico-comercial do Lead. |
| Criar/Abrir Dossiê | Cria ou acessa o prontuário da obra conforme o estado disponível. |
| Histórico de Atividades | Mostra os eventos registrados do Lead. |
| Próximo passo | Orienta a abertura do Formulário e a alocação de equipamentos. |
| Atribuição | Mostra vendedor, origem e estimativa de comissão. A estimativa de 4% não substitui a regra definitiva de Comissões. |

### Herança e destino

Cliente fornece a identidade. O Lead fornece contexto ao Formulário e à criação do Dossiê. A aprovação de proposta possui tratamento para atualizar o Lead vinculado como convertido. No exemplo, o interesse da Horizonte começa aqui, e os dois elevadores são detalhados no passo seguinte.

Fonte: src/comercial.jsx, src/proposta-store.js.

## 3.2 Formulários

A página mãe apresenta cartões de tipos de formulário. Equipamento está disponível para Elevador, Escada Rolante e Esteira Rolante. Modernização de Elevador, Modernização de Escadas e Esteiras, Máquina de Tração, Quadro de Comando e Portas aparecem como Em breve no código. Não ensinar esses cartões como fluxos concluídos.

### Equipamento → Dados do cliente e da obra

| Campo | Significado e uso posterior |
| --- | --- |
| Tipo de pessoa, nome/razão social, CPF/CNPJ | Identificação do comprador; pode vir do Lead/Cliente. |
| Inscrição Estadual e contribuinte de ICMS | Informações para tratamento fiscal da operação. |
| Telefone, e-mail, contato | Canais para coleta, proposta e tratativas. |
| Prédio / Empreendimento | Identifica a obra comercialmente. |
| Finalidade da compra | Distingue uso/consumo/ativo de revenda no contexto de preço. |
| Endereço cadastral | Logradouro, complemento, bairro, CEP, cidade e UF. |
| Endereço de instalação diferente | Abre o preenchimento específico da obra quando necessário. |
| Cidade e UF da obra | Contextualizam instalação, transporte e tributação. |
| Prazo mínimo desejado | Registra a expectativa do cliente, sem prometer prazo já contratado. |
| Instalação Será | Define quem assume a instalação: VerticalParts ou cliente. |
| Responsável pela entrega | Define a responsabilidade logística informada no formulário. |
| Origem da venda e vendedor | Campos internos que ajudam atribuição e comissionamento. |
| Observações | Registra requisitos gerais não representados em outros campos. |

### Equipamento → Cartões das unidades

Adicionar equipamento diferente cria outro cartão. Quantidade idêntica registra múltiplas unidades com a mesma especificação. Duplicar copia o cartão para facilitar uma variante; Remover tira o cartão. Expandir/recolher ajuda a navegar em formulários longos. O código do equipamento e o Master ID mantêm sua identificação na cadeia.

#### Elevador → Identificação e desempenho

Tipo de equipamento seleciona a família. Tipo identifica a aplicação do elevador. Modelo carrega opções compatíveis de acabamento. Norma de projeto registra a referência especificada. Fornecedor é campo interno. Tração, capacidade em kg, capacidade de passageiros, velocidade, paradas e descrição dos pavimentos definem o requisito funcional. Casa de máquinas diferencia configuração com casa e MRL. Agrupamento distingue simplex, duplex, triplex e grupo.

#### Elevador → Caixa e implantação

Porta oposta/múltiplas entradas descreve os acessos. Tipo de estrutura da caixa identifica concreto, alvenaria, aço ou outra informação. Largura e profundidade da caixa, percurso, última altura/overhead e profundidade do poço registram os espaços disponíveis, em milímetros. Não confundir profundidade horizontal da caixa com profundidade vertical do poço.

#### Elevador → Cabina e portas

A cabina possui largura, profundidade e altura. Teto falso e piso usam opções do modelo; corrimão detalha a configuração. Portas possuem tipo de abertura, modelo, largura, altura, acabamento de cabina, acabamento de pavimento e classe corta-fogo.

#### Elevador → Elétrica e opcionais

Tensão principal e tensão de iluminação registram alimentação. COP e LOP identificam botoeiras de cabina e de pavimento. ARD, câmera e anúncio de voz são opções marcáveis. Exigências especiais descrevem requisitos adicionais.

#### Escada e esteira

A seleção da família troca os campos técnicos. O código usa uma estrutura de especificações própria para cada tipo, sem exigir campos exclusivos de elevador. Desnível/comprimento, inclinação, largura, velocidade, alimentação e configuração devem acompanhar a família selecionada. O inventário complementar ao fim deste documento referencia as definições que geram esses campos.


#### Escada Rolante → Catálogo de campos do Formulário

Estes são campos de texto da configuração consultada. Os exemplos exibidos pelo sistema orientam o preenchimento; não são limites normativos validados neste roteiro. Todos compõem a especificação da unidade, usada na consulta ao fornecedor e na herança posterior quando suportada pelo documento.

##### Dados Gerais

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tipo de edificação | Comercial, residencial, hospitalar, aeroporto, metrô, shopping, institucional |
| Uso previsto | Público (alto tráfego) / privado (médio/baixo tráfego) |
| Horário de pico estimado | Passageiros/hora em cada sentido |

##### Dados Geométricos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Desnível (altura de elevação) | ex.: 5,04 m |
| Inclinação | 27,3° / 30° / 35° |
| Largura do degrau | 600 / 800 / 1.000 mm |
| Velocidade nominal | 0,50 / 0,65 / 0,75 m/s |
| Comprimento da abertura no piso | Medida correspondente no levantamento da obra; informar com unidade. |
| Largura do rasgo na laje | Medida correspondente no levantamento da obra; informar com unidade. |
| Profundidade do poço inferior | Medida correspondente no levantamento da obra; informar com unidade. |
| Última altura (headroom) | Medida correspondente no levantamento da obra; informar com unidade. |
| Sentido de circulação | Subida / descida / reversível |
| Nº de degraus planos no patamar | 2 ou 3 |
| Disposição no espaço | Simples / paralelas / cruzadas |

##### Especificações Técnicas

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tipo de acionamento | Motorredutor direto / VVVF |
| Sistema de economia de energia | Stand-by com sensor de presença |
| Capacidade de transporte | 4.500 a 13.500 pessoas/hora |
| Tipo de degrau | Aço inoxidável / liga de alumínio |
| Altura do degrau | ~200 mm, máx. 240 mm |
| Profundidade do degrau | > 380 mm |
| Balaustrada / guarda-corpo | 80cm ou 90cm : vidro/inox |
| Corrimão | Borracha preta/colorida/LED |
| Proteção lateral | Painéis de inox/vidro |
| Iluminação | LED balaustrada/teto/patamares |
| Proteção de patamar | Pente de alumínio/borracha |
| Sistema de segurança | Freio serviço+segurança, sensor objeto preso |
| Comunicação | Intercomunicador/alarme/indicadores |

##### Condições Ambientais

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Local de instalação | Interior / exterior / ambiente controlado |
| Proteção contra intempéries | Cobertura / toldo / totalmente exposta |
| Temperatura ambiente mínima | °C |
| Temperatura ambiente máxima | °C |
| Umidade relativa | % |
| Poeira, salinidade ou agentes químicos | Sim / Não |
| Acesso para içamento da máquina | Guindaste / elevador de carga / escada / manual |
| Disponibilidade de energia na obra | Provisória / definitiva / não há ainda |
| Poço inferior | Já existe / será construído |
| Caixa de corrida / rasgo no piso | Já executada / será executada |

##### Dados Elétricos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tensão de alimentação | 220V / 380V / 440V trifásica |
| Frequência | 60 Hz (Brasil) / 50 Hz |
| Potência estimada disponível | kVA |
| Aterramento | Existe / será executado / tipo |
| Quadro de distribuição próximo | Sim/Não : distância aproximada |
| Disjuntor dedicado | Sim/Não : capacidade em A |
| Gerador de emergência | Sim / Não |
| Sistema de alarme de incêndio | Sim / Não |
| Monitoramento remoto | Sim / Não |

##### Acabamentos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Acabamento dos degraus | Inox escovado/polido/antiderrapante/colorido |
| Acabamento das laterais | Inox / pintura / vidro |
| Acabamento dos patamares | Inox / granito / porcelanato |
| Cor do corrimão | Preto / cinza / personalizado |
| Iluminação decorativa | LED RGB fixo/programável/branco |
| Indicadores de pavimento | Display LED / LCD / simples |
| Revestimento do teto interno | Inox / pintura / outro |
| Proteção de impacto nas laterais | Sim / Não |

#### Esteira Rolante → Catálogo de campos do Formulário

Estes são campos de texto da configuração consultada. Os exemplos exibidos pelo sistema orientam o preenchimento; não são limites normativos validados neste roteiro. Todos compõem a especificação da unidade, usada na consulta ao fornecedor e na herança posterior quando suportada pelo documento.

##### Dados Gerais

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tipo de edificação | Comercial, residencial, hospitalar, aeroporto, metrô, shopping, institucional |
| Uso previsto | Público (alto tráfego) / privado (médio/baixo tráfego) |
| Horário de pico estimado | Passageiros/hora em cada sentido |

##### Dados Geométricos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Comprimento total (desnível horizontal) | até 80m comercial / 120m público / 140m especial |
| Desnível vertical (altura de elevação) | 2.500 a 8.000 mm |
| Inclinação | 0°–6° padrão / 10°/11° sob demanda / 12° inclinada |
| Largura do palete | 800/1.000mm comercial, até 1.400mm público |
| Velocidade nominal | 0,50 / 0,60 / 0,75 m/s |
| Comprimento do rasgo no piso | Medida correspondente no levantamento da obra; informar com unidade. |
| Largura do rasgo na laje | Medida correspondente no levantamento da obra; informar com unidade. |
| Profundidade do poço inferior | Medida correspondente no levantamento da obra; informar com unidade. |
| Última altura (headroom) | Medida correspondente no levantamento da obra; informar com unidade. |
| Sentido de circulação | Unidirecional / reversível |
| Nº de paletes planos no patamar | 2 ou 3 |
| Disposição no espaço | Simples / paralelas / cruzadas / em série |
| Raio de curva (se aplicável) | esteiras curvas, em metros |

##### Especificações Técnicas

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tipo de acionamento | Motorredutor direto / VVVF / corrente |
| Sistema de economia de energia | Stand-by, baixa velocidade em vazio |
| Capacidade de transporte | depende largura+velocidade : tabela do fabricante |
| Tipo de palete | Aço inox / liga alumínio / aço carbono tratado |
| Espessura do palete | mm : resistência à deformação |
| Balaustrada / guarda-corpo | 80/90/100cm : vidro/inox |
| Corrimão | Borracha preta/cinza/colorida/LED/antiderrapante |
| Proteção lateral | Painéis inox/vidro/sólidos até o piso |
| Iluminação | LED balaustrada/teto/patamares/piso |
| Proteção de patamar (pente) | Alumínio / borracha / inox |
| Sistema de segurança | Freio+sensor+parada emergência+chave inspeção |
| Sistema de travamento | Trava mecânica manutenção / automática emergência |
| Comunicação | Intercomunicador/alarme/setas/display |
| Sistema de lubrificação | Centralizado automático / manual / autolubrificante |

##### Condições Ambientais

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Local de instalação | Interior / exterior / ambiente controlado |
| Proteção contra intempéries | Cobertura / toldo / totalmente exposta |
| Temperatura ambiente mínima | °C |
| Temperatura ambiente máxima | °C |
| Umidade relativa | % |
| Poeira, salinidade ou agentes químicos | Sim / Não |
| Acesso para içamento da máquina | Guindaste / elevador de carga / escada / manual |
| Disponibilidade de energia na obra | Provisória / definitiva / não há ainda |
| Poço inferior | Já existe / será construído |
| Caixa de corrida / rasgo no piso | Já executada / será executada |
| Exposição à chuva direta | Sim/Não : determina IP elevado |
| Piso acabado nos patamares | Granito/porcelanato/cerâmica/concreto |

##### Dados Elétricos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Tensão de alimentação | 220V / 380V / 440V trifásica |
| Frequência | 60 Hz (Brasil) / 50 Hz |
| Potência estimada disponível | kVA |
| Aterramento | Existe / será executado / tipo |
| Quadro de distribuição próximo | Sim/Não : distância aproximada |
| Disjuntor dedicado | Sim/Não : capacidade em A |
| Gerador de emergência | Sim / Não |
| Sistema de alarme de incêndio | Sim / Não |
| Monitoramento remoto | Sim / Não |
| Sistema de controle de acesso | Sim/Não : integração com catracas/torniquetes |

##### Acabamentos

| Campo | Informação solicitada / exemplo da interface |
| --- | --- |
| Acabamento dos paletes | Inox escovado/polido/antiderrapante/colorido |
| Acabamento das laterais (frizos) | Inox / pintura / vidro |
| Acabamento dos patamares | Inox / granito / porcelanato / antiderrapante |
| Cor do corrimão | Preto/cinza/azul/verde/personalizado |
| Iluminação decorativa | LED RGB fixo/programável/sem |
| Indicadores de direção | Display/LCD/setas/placas |
| Revestimento do teto interno | Inox / pintura / painel |
| Proteção de impacto nas laterais | Sim / Não |
| Sinalização tátil | Sim/Não : NBR 9050 |
| Contraste visual | Sim/Não : deficientes visuais |
| Anúncio publicitário / branding | Sim / Não |

### Anexos

O bloco de anexos permite selecionar arquivo, Ver e Remover. Os desenhos e documentos complementam a especificação enviada. Anexar algo no formulário não prova que o fornecedor aceitou aquele conteúdo.

### Salvar e enviar

| Ação | Resultado previsto |
| --- | --- |
| Salvar rascunho | Preserva cabeçalho e unidades sem tratar como envio concluído. |
| Enviar para Cotação | Valida e grava o formulário no estado enviado. |
| Link p/ cliente preencher | Abre janela com link público, WhatsApp e e-mail do cliente. |
| Copiar link | Copia a URL gerada para compartilhar pelo canal escolhido. |
| WhatsApp / E-mail | Encaminham a comunicação pelo mecanismo implementado, com o destinatário informado. |
| Enviar cotação a fornecedores | Abre janela com agrupamentos dos equipamentos por fornecedor e ações de envio. |
| Pedir nova revisão | Solicita nova rodada da resposta do fornecedor. |
| Ver resposta do fornecedor | Abre a resposta comercial/técnica recebida. |
| Controle de Cotações | Leva à lista consolidada para reencontrar a cotação. |
| Precificação manual, quando habilitada | Atalho excepcional associado à alçada de preço negociado; não equivale à aprovação de um cálculo completo. |

### Resposta do fornecedor

A janela apresenta moeda, Incoterm/porto, validade, fabricação, garantia, container, embalagem, pagamento e documentos de embarque. Por unidade, mostra modelo do fornecedor, andares/paradas/portas confirmados, preço unitário e total. Serve para comparar pedido e resposta antes de precificar.

### Herança e destino

Herda Lead/Cliente quando aberto com esse contexto. Grava formulário e unidades; gera as informações enviadas ao fornecedor. Respostas alimentam a Precificação. Formulário, unidades, resposta e preço são fontes da herança da Proposta. Os vínculos dependem da cotação e dos IDs conservados.

Fonte: src/formulario-elevador.jsx, src/formulario-elevador-store.js, src/cotacao-elevador-fornecedor-store.js, src/proposta-heranca.js.

## 3.3 Controle de Cotações

É o índice para reencontrar cotações, acompanhar seu estado e abrir suas tratativas. Mostra total do filtro, maior número registrado e conquistadas. Atualizar recarrega os dados. A busca aceita cliente, vendedor, documento e número da cotação.

### Abrir formulário

A ação da linha abre o formulário correspondente. Não cria outra cotação para consultar a existente.

### Tratativas da cotação

Abre uma janela com a cadeia de gatilhos daquele número. Permite consultar os eventos e suas ações, inclusive as janelas de confirmação de sinal/aval quando disponíveis. O título Tratativas aqui se refere à cadeia da cotação; não confundir com o histórico de mensagens de um fornecedor específico.

### Herança e destino

Consulta o histórico dos formulários e a cadeia de gatilhos. Navega para o formulário ou para o destino do evento. No exemplo, permite localizar a negociação da Horizonte pelo cliente ou número.

Fonte: src/controle-cotacoes.jsx.

## 3.4 Cotações a Fornecedor

Mostra a situação das consultas enviadas: Aguardando, Recebida, Em análise e Aprovada. Os KPIs e filtros usam esses estados. Clicar na linha abre o detalhe da consulta.

### Seleção e exclusão

Checkboxes selecionam linhas ou todas. Limpar seleção desfaz a seleção. Excluir selecionadas abre confirmação com motivo obrigatório. Cancelar não exclui; confirmar executa a remoção prevista. Não fazer exclusões de dados reais durante a aula.

### Detalhe da cotação

| Item | Função |
| --- | --- |
| Dados enviados | Fornecedor, categoria, número de cotação e equipamentos/Master IDs. |
| Linha do tempo | Envio, visualização, resposta, decisão de compra e aprovação. |
| Copiar link público | Recupera o acesso do fornecedor à consulta. |
| Ver resposta do fornecedor | Abre a resposta recebida. |
| Decidir comprar | Disponível após resposta e condicionado ao gate financeiro indicado. |
| Aprovar compra | Etapa posterior ao estado Em análise. |
| Compra aprovada | Estado informativo depois da confirmação. |
| Voltar | Retorna à lista. |

### Tratativas do fornecedor

Reúne mensagens e anexos da negociação. O usuário escreve o ajuste, pode anexar documentos e usar Enviar para registrá-lo no histórico. Não confundir registro interno da tratativa com e-mail automaticamente entregue.

### Herança e destino

Recebe os equipamentos do Formulário e a resposta do fornecedor. Estados e decisões participam do fluxo de compra e da precificação associada. O histórico preserva por que o pedido foi ajustado. No exemplo, um fornecedor pode confirmar uma medida diferente; isso deve ser revisado antes da promessa comercial.

Fonte: src/cotacoes-fornecedor.jsx, src/tratativas-store.js.

## 3.5 Propostas

Transforma dados técnicos e preço em uma oferta ao cliente. A lista apresenta indicadores de quantidade, valor, rastreabilidade e aprovação; busca por código, cliente, CNPJ, equipamento, cotação ou vendedor; exportação CSV; criação e abertura de propostas.

### Filas de trabalho

Prontas para enviar recebe precificações aguardando análise/envio. Analisar e enviar abre o editor com a herança. Pedidos de revisão reúne o retorno do cliente; Analisar e reenviar abre a proposta existente. Nova proposta inicia outro documento, respeitando as alçadas aplicáveis.

### Editor → Identificação e partes

Número da cotação, número da proposta, data, validade, vendedor, celular, telefone e e-mail identificam a oferta e o responsável. Cliente, documento, responsável, telefone, e-mail e endereço identificam o comprador. Empreendimento e endereço de obra identificam o local de instalação. Os cabeçalhos destacam número, Master ID, obra e total.

### Editor → Conteúdo e equipamentos

A família Elevador, Escada ou Esteira altera seções e especificações. Texto da proposta e texto dos modelos compõem a abertura. Equipamentos possuem identificação, modelo/linha, quantidades, especificações e valores. Produtos e unidades adicionais podem ser incluídos pelos controles de repetição.

No elevador, revisar desempenho, caixa, cabina, portas, alimentação, comando, tração e opcionais herdados. Em escada/esteira, revisar empreendimento, característica de transporte, desnível/comprimento, inclinação, degrau/pallet, balaustrada, velocidade, alimentação, arranjo, máquina e quantidade.

### Editor → Preço e condições

Valor unitário, quantidade, DIFAL e forma de pagamento compõem a oferta. Adicionar Parcela cria outro componente do parcelamento. Solicitar desconto abre janela para tipo percentual/valor, desconto e motivo; Enviar para aprovação registra a solicitação de alçada.

Ajustes e Impostos reúne câmbio, faturamento, frete marítimo quando aplicável, reajuste, tributos incluídos/excluídos e cláusula cambial. Prazos registra entrega e condições. Instalação reúne montagem, lubrificação, transporte, descarregamento/içamento. Garantia e condições gerais são textos contratuais que devem refletir o negócio aprovado.

### Editor → Acabamentos, imagens e campos extensíveis

Categorias e campos de acabamentos podem ser adicionados ou removidos. Novo campo pede nome/texto e tipo. Nova categoria pede nome. Fotos, desenhos e imagens dos equipamentos compõem a apresentação; Remover retira a imagem do slot correspondente.

### Editor → Publicação, PDF e assinatura

| Ação | Efeito |
| --- | --- |
| Salvar | Preserva o documento em edição. |
| Publicar versão | Disponibiliza uma versão conforme a rotina de publicação. |
| Gerar PDF | Abre a prévia; nela há baixar, imprimir e fechar. |
| Enviar para assinatura | Abre destinatário, WhatsApp e e-mail, com ações de envio e cópia de link. |
| Aceitar revisão | Registra a decisão interna sobre o ajuste solicitado. |
| Recusar internamente | Abre motivo e confirmação da recusa. |
| Destravar | Exceção de edição sujeita à alçada; uma proposta aprovada pode estar bloqueada. |

### Herança e destino

A herança consulta Formulário, unidades, cotações de fornecedor e Precificação. A Proposta serve de fonte ao Contrato de Venda e à seleção de ativos no Contrato Instalador. Aprovação do cliente participa da criação/atualização do Aval Financeiro e conversão do Lead vinculado. Publicar, enviar e obter aceite são estados diferentes.

Fonte: src/precificacao.jsx, src/proposta-editor.jsx, src/proposta-form.jsx, src/proposta-heranca.js, src/proposta-store.js.

# 4. Financeiro & Preços

Quatro telas cuidam da base de custos, formação do preço, aval da operação e comissionamento. A finalidade é transformar informação técnica e comercial em condições econômicas verificáveis. Calcular, aprovar e registrar pagamento devem ser apresentados como decisões diferentes.

## 4.1 Atualização de Custos

É a manutenção das referências usadas no orçamento. A interface permite editar valores diretamente nas tabelas. Algumas alterações são salvas ao sair do campo, portanto clicar em outra célula pode concluir uma edição.

### Instalação de Elevadores

Selecionar a tração muda a tabela. Cada linha possui capacidade mínima e máxima em kg, quantidade de paradas, dias de montagem, quantidade de montadores e valor reajustado. Adicionar linha cria outra faixa; Remover linha exclui a referência. Quando há uma estimativa sugerida, Usar adota o valor sugerido.

A aplicação é concreta: para o elevador de 630 kg e dez paradas da Horizonte, o orçamento procura uma faixa compatível com tração, capacidade e paradas. Uma combinação inexistente deve ser tratada como falta de referência, sem inventar preço.

### Instalação de Escada / Esteira

Duas famílias possuem valores para São Paulo e outros estados. A tabela mantém referências de mão de obra por família/localidade.

### Containers

Tipo, comprimento, altura, capacidade volumétrica, preço em USD, preço em reais, data da cotação, fornecedor e observações compõem a referência. Adicionar container e remover linha alteram o catálogo de custos. A dimensão física e o preço comercial são dados distintos.

### Herança e destino

A Precificação consulta essas referências para instalação e containers. Atualizar o cadastro não deve ser entendido como reaprovar todas as propostas antigas. Na Precificação há comandos próprios para recalcular/atualizar dados.

Fonte: src/cadastro-custos.jsx e src/cadastro-custos-store.js.

## 4.2 Precificação

A entrada diferencia o fluxo de equipamentos da calculadora existente. No fluxo especializado, o usuário abre a cotação e trabalha sobre dados do Formulário e da resposta do fornecedor. A função principal é transformar custo em preço de venda com impostos, despesas, comissões e margens.

### Lista → Detalhe da precificação

Abrir conduz à memória do cálculo. Voltar retorna à lista. Salvar rascunho preserva entradas. Calcular executa o motor. Aprovar precificação valida o resultado conforme as regras implementadas e o disponibiliza para a etapa comercial.

### Unidades da cotação

Exibe unidades herdadas do Formulário e resposta do fornecedor. Ressincronizar do fornecedor busca uma nova leitura dessa origem. Mão de obra mostra a busca automática por tração, capacidade e paradas. Recalcular atualiza a busca; o ícone de edição permite corrigir os parâmetros da unidade, com Salvar e Cancelar/fechar a edição.

### Despesas de importação

| Campo | Proposta |
| --- | --- |
| VMLE em USD | Valor informado da mercadoria no contexto da importação. |
| Seguro em USD | Componente de seguro do custo. |
| Frete + Seguro + Capatazia padrão 120 dias | Composição do cenário compartilhado. |
| Frete + Seguro + Capatazia expresso 90 dias | Composição do cenário exclusivo. |
| Siscomex | Despesa em reais. |
| Câmbio | Taxa usada na memória do cálculo. |
| Usar cotação disponível | Adota a referência cambial apresentada, por ação explícita. |
| Outras despesas | Custos de importação adicionais. |
| Despachante + Desembaraço | Custo do serviço e processo aduaneiro. |
| Demurrage | Custo considerado por permanência do container. |
| Containers | Tipo/tamanho e quantidade; adicionar/remover compõe os recursos considerados. |

### Despesas operacionais e extras

Despesas Operacionais registra custos itemizados, incluindo instalação/montagem. Despesas Extras permite descrição e valor por item. Frete interno, armazenagem, percentual de serviços, contingência e outros custos não recuperáveis complementam o cálculo. Adicionar item cria uma nova linha; a lixeira remove a linha. Resumo de Custos soma os componentes já preenchidos.

### Alavancas e parâmetros

Markup sobre custo, comissões de consultoria, vendedor e indicação e margem mínima orientam a venda. Mostrar parâmetros expande regime tributário, ICMS/IPI/PIS/COFINS/II de importação, tributos da venda e percentual de serviços. Estes são parâmetros do sistema: o roteiro não valida juridicamente as alíquotas.

### DIFAL e formação do preço

O bloco DIFAL usa o contexto fiscal do comprador e da operação. Modo de formação do preço e margem desejada mudam a forma de chegar ao preço. O resultado distingue cenário de 120 dias compartilhado e 90 dias exclusivo. A comparação V1 é apresentada pelo código como auditoria do motor anterior, sem ser a fonte oficial da proposta.

### Calculadora de projeto

O caminho da calculadora reúne FOB, câmbio, frete internacional, seguro, CIF, impostos, custos técnicos, despachante, frete nacional, margem e comissão. Pode apresentar referência à Análise Técnica do Dossiê. Gerar proposta navega ao editor. Versões e Duplicar nesse caminho exigem a ressalva do apêndice, pois o rótulo não basta para confirmar uma ação implementada.

### Herança e destino

Formulário e fornecedor fornecem equipamento, quantidades e valores de origem. Atualização de Custos fornece referências de instalação. A precificação aprovada alimenta a fila de Propostas. O câmbio usado é uma informação da memória daquela negociação, não uma promessa de atualização silenciosa de documentos já emitidos.

Fonte: src/precificacao.jsx, src/precificacao-elevador.jsx, src/precificacao-elevador-store.js, src/precificacao-elevador-engine.js.

## 4.3 Aval Financeiro

A fila reúne propostas aprovadas pelo cliente que exigem análise financeira. Seus indicadores distinguem aguardando consulta, aguardando aval, aguardando sinal e reprovados.

### Consultar score / Refazer consulta

Abre janela com fonte da consulta, score/resultado obrigatório, classificação e observações. Registrar consulta grava a informação apresentada pelo operador. O nome do botão não prova uma consulta automática a um bureau externo.

### Dar aval / Reprovar

Abrem a decisão sobre a operação. Observações permitem registrar condições ou motivo. Confirmar aval aprova financeiramente; Confirmar reprovação registra a recusa. A fila muda de acordo com o estado gravado.

### Confirmar sinal

Recebe valor e data do pagamento. Registra a informação do sinal no aval. Não executa cobrança bancária nem transferência de dinheiro.

### Aprovações adicionais

A tela possui aprovação do CEO e aprovação do responsável pelo sistema, conforme identidade/alçada. Os estados compõem a liberação da compra. Contrato, sinal e projeto podem continuar sendo condições adicionais.

### Herança e destino

Recebe Proposta, cotação e cliente. Registra consulta, decisão, sinal e aprovações. Alimenta os gates usados em Cotações a Fornecedor e P.I. e registra eventos para acompanhamento. No exemplo, a aprovação comercial da Horizonte ainda passa por esta análise antes de comprometer a compra.

Fonte: src/aval-financeiro.jsx e src/aval-financeiro-store.js.

## 4.4 Comissões

Reúne propostas assinadas aguardando geração de comissão e o resumo por vendedor. Há indicadores de total, aprovado, aguardando e maior comissão. Rótulos como Q2 e pagamento dia 10 estão escritos na interface e não devem ser apresentados como um calendário configurável comprovado.

Gerar comissão aplica o tratamento de comissionamento à proposta selecionada. Aprovar, Aprovar (diretoria) e Aprovar todas mudam o estado dos registros conforme a rotina. Pagar registra o estado de pagamento. Folha de pagto exporta CSV com vendedor, cargo, projetos, faturamento, percentual, comissão e status.

A lista contém vendedor, projetos fechados, faturamento líquido, percentual, comissão, progresso e status. A informação vem das propostas/comissões; marcar pago não é ordem bancária.

Fonte: src/financeiro.jsx, src/comissionamento-store.js.

# 5. Contratos & Jurídico

Duas telas formalizam a relação com o cliente: um assistente especializado e a gestão de contratos/minutas. O Contrato Instalador aparece em Parceiros & Instaladores, apesar de continuar sendo responsabilidade jurídica em parte do fluxo.

## 5.1 Contrato Venda de Equipamentos

A tela possui listagem e assistente de criação/edição. A finalidade é gerar um contrato coerente com a proposta e o equipamento, conservando o vínculo da negociação.

### Cadastro

Herdar de uma Proposta permite escolher a origem por Master ID, número e título. Os campos do comprador são razão social, CNPJ, telefone, endereço da sede e e-mail para assinatura. O representante possui nome, cargo, CPF, nacionalidade, estado civil, profissão, RG e endereço residencial. Os campos exigidos recebem validação antes do avanço.

### Objeto

Define família, quantidade e especificações do equipamento. Campos mudam conforme o tipo. A seleção da proposta é importante para não perder a relação entre o objeto vendido e o contrato.

### Logística

Endereço completo da obra/entrega e distância até Guarulhos contextualizam responsabilidades e cláusulas. O código diferencia condições por distância. A aula deve explicar que alterar um dado pode mudar o texto gerado.

### Preço

Valor total, percentual de sinal e número de parcelas do saldo compõem as condições. O contrato apresenta os valores resultantes. Datas de pagamento da entrada e aprovação do projeto participam do contexto de prazos quando solicitadas.

### Revisão, anexos e envio

O usuário confere a prévia, documentação e dados de assinatura. Ações de salvar, gerar/visualizar documento, copiar link e enviar devem ser realizadas sobre uma versão revisada. A listagem permite reencontrar o contrato e acompanhar o estado de assinatura.

### Herança e destino

Recebe Proposta/Master ID e dados do comprador/equipamento. O contrato assinado é uma condição da cadeia de compra. O Aval Financeiro pode guardar o vínculo do contrato. Não basta gerar PDF para considerar a contratação assinada.

Fonte: src/contrato-venda.jsx, src/contrato-venda-store.js, src/contrato-venda-engine.js, src/contrato-venda-preview.jsx.

### Painel → Auditoria, prazos e reenvio

Painel lista contratos e propostas elegíveis; Criar contrato inicia pelo contexto da proposta. Auditoria abre a gaveta do registro. Enviar/Reenviar abre a janela de canal; Excluir executa a rotina de remoção. Na etapa de revisão, os controles de proposta, desenho e NRs registram a conferência dos anexos. O assistente usa Voltar, Avançar e Gerar e enviar para assinatura. Na janela de envio, selecionar WhatsApp, E-mail ou Link muda os campos do destinatário; Copiar disponibiliza o link, Cancelar fecha e Concluir termina a janela.

## 5.2 Contratos & Minutas

A página lista contratos e seus estados: redação, assinatura digital e assinados. Novo contrato abre cadastro inicial. Clicar/Editar abre o editor do registro. Acesso Rápido é outra entrada para os contratos.

### Novo contrato

Registra os dados iniciais que identificam o contrato e sua contraparte. Depois da gravação, o documento segue para o editor. Importar minuta tem limitação específica no apêndice A06.

### Editor de contrato

| Seção | Dados que o usuário revisa |
| --- | --- |
| Identificação | Número, emissão e advogado responsável. |
| Contratante | Razão social, CNPJ e endereço completo. |
| Representante | Nome, nacionalidade, estado civil, profissão, RG e CPF. |
| Objeto | Quantidade e referência da proposta comercial. |
| Entrega | Rua, número, bairro, cidade e UF da obra. |
| Valor | Total, valor por extenso e parcelas. |
| Assinatura | Cidade, data e nome/CPF das testemunhas. |

Salvar preserva o documento. Gerar PDF produz a representação documental. Enviar/assinar aciona o fluxo próprio. Voltar retorna à lista. O editor e o assistente de Contrato Venda são caminhos diferentes no código; não presumir equivalência perfeita de todos os campos.

### Redação e visualizações auxiliares

Há componentes de redação de seleção/página, navegação entre páginas e versão pública no arquivo de operações. Só devem entrar como demonstração operacional se forem alcançáveis na versão em produção; componentes existentes no arquivo não comprovam que o menu os exibe. Ver apêndice de validação.

Fonte: src/operacoes.jsx e src/contrato-editor.jsx.

# 6. Suprimentos & Importação

A categoria possui nove telas e um subtítulo organizador chamado Gestão Importação. O subtítulo não é uma tela. O grupo reúne Painel, P.I., RFQ, IMS, Embarques, Importação, Análise de Preços, Compras Nacional e Pedidos.

Sua proposta é ligar autorização de compra, fornecedor, produção, transporte, aduana e entrega. Existem duas visões de embarque; é necessário explicá-las separadamente para evitar duplicidade de trabalho.

## 6.1 Painel

Apresenta P.I.s abertas, RFQs abertas, IMS pendentes e embarques ativos. Embarques por etapa mostra a distribuição operacional. O painel consulta os serviços das quatro entidades. Não é o lugar de editar o pagamento de uma P.I.

No exemplo, o responsável por Importação começa verificando se a compra da Horizonte ainda está em produção, se já há embarque e se os recursos de entrega foram solicitados.

Fonte: src/gestao-importacao-painel.jsx.

## 6.2 P.I.

A Proforma Invoice registra o compromisso de compra com o fornecedor. A lista mostra número da P.I., cotação, fornecedor, abertura, status, produção, total, itens, percentual pago e embarque. Há pesquisa/filtro, Nova P.I., Editar, Vincular embarque e Excluir.

### Identificação

| Campo | Finalidade |
| --- | --- |
| Número da P.I. | Identificador do documento de compra. |
| Data de abertura | Início do registro. |
| Status | Em andamento, concluída, aguardando documentos ou cancelada. |
| Data de prontidão | Previsão/registro de pedido pronto. |
| Moeda | Unidade monetária dos valores da P.I. |
| Vincular ao embarque | Associa a compra a um embarque existente. |
| Fornecedor | Origem comercial da compra, com apoio do cadastro. |
| Incoterms | Condição comercial/logística registrada. |
| Solicitação de pagamento | Data em que o pagamento foi solicitado. |
| Número da requisição | Referência à solicitação interna. |
| Número da cotação | Vínculo usado na verificação do gate de compra. |
| Números de série | Lista repetível de identificadores dos equipamentos. |
| Categorias | Lista repetível de classificações. |
| Observações gerais | Particularidades da compra. |

### Produtos

Adicionar item cria descrição obrigatória, código, quantidade, unidade, NCM e valor unitário. O total é calculado a partir dos itens. Remover item altera a composição; não basta modificar um total visual para alterar os itens de origem.

### Pagamento

Primeiro e segundo pagamentos possuem data, valor e cotação do dólar. Pagamentos adicionais repetem a mesma estrutura com adicionar/remover. Esses dados compõem o percentual pago e são consultados em Embarques. Registrar um pagamento descreve uma ocorrência financeira; não movimenta conta bancária.

### Produção

Status pode ser não iniciada, em produção, concluída ou atrasada. Há início, previsão de conclusão, conclusão, marca de prontidão/Cargo Ready, observações e anexos de fotos, relatórios ou certificados. Remover anexo executa a rotina prevista para o arquivo.

### Vincular embarque

A janela permite selecionar um embarque ou Nenhum para desvincular. Salvar vínculo grava a relação. Quando aplicável, o serviço propaga o número da cotação ao embarque que ainda não o possui. Cancelar preserva o vínculo anterior.

### Herança e destino

A criação consulta a liberação da compra. O preenchimento da P.I. não é automaticamente uma cópia integral da Proposta. Seu vínculo com Embarques é explícito. Produção, fornecedor, Incoterm, categorias e pagamentos podem ser apresentados no embarque a partir das P.I.s vinculadas. No exemplo, a equipe atualiza produção aqui; o embarque acompanha essa informação.

Fonte: src/pi.jsx e src/pi-store.js.

## 6.3 RFQ

É a matriz comparativa de fornecedores. Nova RFQ cria uma consulta; Editar recupera a matriz; Excluir remove o registro. Status pode ser Aberta, Em análise, Fechada ou Cancelada.

### Identificação e itens

Número, data obrigatória, validade e status identificam a rodada. Itens possuem descrição/código de referência, quantidade, unidade e observações. Adicionar item cria outra linha; remover tira a linha da comparação.

### Fornecedores e comparação

Adicionar fornecedor cria outra coluna. Cada fornecedor pode ter moeda e preços. A matriz cruza item, quantidade, fornecedores e vencedor. O modo global escolhe um vencedor para o conjunto; o modo por item permite escolhas diferentes. Moeda de comparação e taxas disponíveis devem ser revisadas antes de interpretar o menor preço.

### Salvar

Criar/Atualizar RFQ preserva a matriz; Cancelar retorna sem a gravação final do formulário. Fechar a RFQ não prova emissão de pedido ou pagamento ao fornecedor.

### Herança e destino

Consulta Fornecedores; a matriz alimenta Análise de Preços. Não confundir esta RFQ com o envio técnico-comercial dos equipamentos em Formulários.

Fonte: src/rfq.jsx e src/rfq-store.js.

## 6.4 IMS

Planeja recursos e serviços necessários à operação. Cartões permitem expandir detalhes, editar, excluir e, quando finalizados, arquivar/desarquivar. Os filtros incluem Todos, Em execução, Pendentes, Atrasados e Encerrados no mês, além de status, tipo e arquivados.

### Identificação

Número de referência apresentado como número de embarque opcional, status, solicitante, projeto e responsável interno. Esse número textual não deve ser confundido com seleção relacional de um embarque por ID.

### Planejamento

Datas de início/fim, local, cidade e observações operacionais determinam onde e quando os recursos são necessários.

### Técnico

Adicionar recurso cria uma linha de Transporte, Munck, Empilhadeira, Andaime, Mão de obra ou Outros Equipamentos. Cada recurso possui especificações e campos condicionais:

| Recurso | Dados técnicos destacados |
| --- | --- |
| Munck | Peso da carga, altura de içamento e raio de operação. |
| Empilhadeira | Capacidade, altura de elevação e tipo de piso. |
| Andaime | Altura total e tipo de andaime. |
| Transporte | Tipo de carga e peso aproximado. |
| Demais tipos | Especificação descritiva e controles apresentados conforme o tipo. |

### Fornecedor

Adicionar fornecedor registra nome, status, valor e observações. Número do pedido de compra, aprovador, data e observação de aprovação documentam a contratação informada.

### Execução

Check-in e check-out registram horários. Avaliação do serviço de 1 a 5 e observações finais registram o resultado. Criar/Atualizar solicitação salva a ficha. Atribuir status Finalizado é diferente de arquivar a ficha.

### Herança e destino

O cadastro de Fornecedores apoia a escolha. IMS mantém seu planejamento e execução; o Painel consulta seus pendentes/atrasados. Não foi comprovada criação automática de IMS a partir de cada obra. No exemplo, solicitar Munck depende dos requisitos reais de recebimento dos elevadores.

Fonte: src/ims.jsx e src/ims-store.js.

## 6.5 Embarques

É o cadastro estruturado que consolida P.I.s e acompanha transporte até entrega. Novo embarque e Editar abrem sete abas. Os cartões também oferecem excluir e arquivar/desarquivar quando concluídos.

### Identificação e P.I.s vinculadas

Status da etapa e referência do embarque identificam a operação. O quadro de P.I.s mostra número, status e valor e recupera fornecedor, Incoterm, categorias e outros dados da compra. Alterações nos dados herdados devem ser feitas na P.I.

### Pagamentos

Exibe os pagamentos das P.I.s vinculadas. Sem P.I., apresenta a ausência de origem. É consulta, não outro formulário independente de pagamento.

### Embarque

Portos de origem/destino, navio, AWB/BL e armador SCAC identificam o transporte. Containers possuem número, tipo/tamanho, lacre, peso, data de embarque e chegada; é possível adicionar/remover.

ETD original e ETD atual preservam a diferença entre plano e situação corrente. Registrar rolagem recebe nova ETD, data de comunicação e motivo; a tabela mantém data anterior, nova data e justificativa. Redestinação e data do pedido complementam as alterações logísticas.

### Frete

Tipo, modalidade, cotação, moeda, transit time, free time, pedido de booking, aprovação e agente de carga registram o serviço contratado/planejado.

### Aduaneiro

Referência do despachante, estimativa de custos, documentos, tempo total, DUIMP, registro da DUIMP, canal de parametrização, última data do free time e ETA Santos contextualizam o desembaraço. Conferência tem status, data e motivo/exigência.

### Faturamento

Empresa de desembaraço, faturamento, numerário, reembolso e suas datas/status controlam informações financeiras da etapa. Adicionar NF-e cria número, chave de acesso, emissão, destinatário, valor e status; remover retira a linha cadastrada. Digitar uma NF-e não comprova emissão fiscal externa.

### Entrega

Data limite, local, carregamento, entrega e devolução do container fecham o acompanhamento físico. Salvar alterações/Cadastrar embarque grava o formulário.

### Herança e destino

Lê P.I.s vinculadas. O serviço contém sincronização para a base usada pela tela Importação, além de eventos do fluxo. Isso não torna todos os campos das duas telas equivalentes. No exemplo, um mesmo embarque pode reunir P.I.s; conferir cotação e equipamentos para não misturar a rastreabilidade.

Fonte: src/embarques-importacao.jsx e src/embarques-importacao-store.js.

## 6.6 Importação

É a visão de acompanhamento dos embarques, com detalhe, mapa e inbox. Filtra status, porto e linha. Novo embarque abre o cadastro desta visão; pode receber contexto de uma demanda. Use com cuidado a coexistência com Embarques.

### Novo embarque

Registra dados de transporte e permite associar uma obra/dossiê para recuperar cidade e UF do transporte nacional. O armador SCAC apoia rastreamento. Criar Embarque grava o registro desta base.

### Detalhe do embarque

Exibe linha do tempo de eventos, cronologia do embarque, posição do navio, navio/container, invoice/fornecedor, aduana, datas e gatilho financeiro. Documentos são uma lista editável de controles de disponibilidade; adicionar/remover altera essa lista.

Ver mapa abre mapa. Atualizar solicita sincronização do rastreamento. Mostrar todos os eventos expande a lista. Ver no Financeiro abre Prazos & Pendências. Reportar/confirmar chegada registra a chegada e cria tarefas previstas para os setores. Esse comando tem efeito de negócio.

### Mapa de navios

Permite filtros de status e ETA, escolha de navio, detalhe, atualização, estilo do mapa e tela cheia. Distinguir dado de provedor e indicação de simulação que o próprio código apresenta. Exportar relatório e Abrir embarque têm ressalvas no apêndice.

### Inbox Importação

A interface possui lista de mensagens, leitura, anexos aparentes e controles Responder, Responder a todos, Encaminhar, Vincular e Sugerir resposta. A análise identificou limitações de implementação; não apresentar essa tela como um cliente de e-mail integrado e operacional sem correção/validação.

### Herança e destino

Consulta a base de embarques desta visão; recebe sincronização prevista do cadastro estruturado. Liga transporte a dossiês e cria tarefas na confirmação de chegada. Não foi validado o provedor externo de rastreamento nesta sessão.

Fonte: src/logistica.jsx.

## 6.7 Análise de Preços

Consulta o histórico das RFQs e agrupa preços por item. Mostra fornecedor, valor unitário, RFQ e data. A finalidade é recuperar memória de compra para negociar melhor.

É leitura do histórico, sem formulário próprio de formação de preço de venda. Comparar moedas, datas e especificações antes de concluir que duas linhas são equivalentes. No exemplo, pode apoiar a discussão de uma compra recorrente, mas não substitui a Precificação comercial.

Fonte: src/gestao-importacao-painel.jsx.

## 6.8 Compras Nacional

O conteúdo atual concentra fretes nacionais associados aos embarques e às obras. A leitura da tela deve seguir o que ela implementa, mesmo que seu nome sugira todas as compras domésticas.

Novo frete via embarque conduz à Importação. A lista usa embarques e dossiês para compor origem/destino e situação. Inbox abre a variante de compras da caixa de mensagens. Transportadora aparece como controle com ressalva no apêndice.

A tela Pedidos mantém outro acompanhamento, e Almoxarifado mantém pedidos de varejo. São fluxos distintos que precisam ser nomeados na aula.

Fonte: src/logistica.jsx.

## 6.9 Pedidos

Acompanha pedidos por setor Nacional ou Importação. Os indicadores de quantidade nas abas mostram a distribuição. Novo pedido usa o setor ativo; Editar e Excluir atuam na linha selecionada.

### Formulário

Número, setor, status, fornecedor, descrição, total, moeda, data do pedido, previsão e data de recebimento formam o registro. Criar pedido/Salvar alterações grava; Cancelar volta. A tabela mostra número, fornecedor, descrição, status, pedido, previsão e valor.

### Herança e destino

Consulta Fornecedores para apoiar o preenchimento e mantém sua própria base de acompanhamento. Não presumir que toda RFQ fechada cria um pedido aqui. “Pedidos a fornecedor” dentro de Produtos é outro recurso, voltado à cotação/documento enviado ao operador.

Fonte: src/pedidos-acompanhamento.jsx e src/pedidos-acompanhamento-store.js.

# 7. Engenharia & Produto

Sete telas definem e documentam o produto: Engenharia, Projeto de Elevadores, Projeto de Equipamento, Projetos ER/Es, Ficha Técnica, Produtos e Linha do Tempo da Cotação. A proposta é conservar a especificação técnica e a identificação do equipamento durante venda, compra, obra e entrega.

## 7.1 Engenharia

Apresenta projetos ativos, situação de laudos e indicadores de visitas/SLA quando existem dados. Novo projeto abre o cadastro inicial de engenharia. Calendário visitas abre o Google Calendar; isso não comprova sincronização dos eventos do projeto.

### Lista → Detalhe do projeto

Selecionar um projeto abre suas informações e abas:

| Aba | Proposta |
| --- | --- |
| Laudo Técnico | Examinar a situação técnica; Aprovar laudo grava a aprovação do projeto. |
| Documentos | Consultar os documentos associados ao contexto técnico. |
| BOM | Consultar a lista de materiais/componentes. |
| Visita | Acompanhar informações de visita do projeto. |
| Vistoria | Conduzir à gestão de obras onde a vistoria é tratada. |
| NCM / Ficha Técnica | Relacionar o projeto à identidade técnica/fiscal do produto. |
| Gatilhos Importação | Mostrar as condições que interferem na compra. |

Anexar arquivo neste componente possui limitação no apêndice A07. Os botões Abrir obras levam à lista de dossiês, onde se escolhe a obra. A aprovação de laudo não substitui a aprovação formal dos demais gates.

### Herança e destino

Mantém a base de projetos. A análise e os documentos técnicos participam da preparação da compra e da obra. Os projetos desta lista e os Projetos de Elevadores são entidades distintas no código; não presumir que a criação em uma lista gera automaticamente um registro na outra.

Fonte: src/operacoes.jsx.

## 7.2 Projeto de Elevadores

Especializa o levantamento do elevador. A lista mostra referência, número da cotação, unidades, anexos e status. Os KPIs separam projetos, unidades, rascunhos e finalizados. Novo projeto abre janela; Abrir recupera o existente.

### Identificação

Prédio/empreendimento é obrigatório. Número da cotação relaciona o estudo à negociação. Responsável técnico identifica quem prepara o projeto.

### Unidades

Adicionar unidade cria outro elevador. Identificador distingue cada unidade; remover elimina uma unidade quando permitido. Cada unidade possui:

| Conjunto | Campos e finalidade |
| --- | --- |
| Configuração | Tipo, casa de máquinas, capacidade e velocidade. |
| Implantação | Poço largura, poço profundidade, overhead, fosso, percurso e paradas. Conferir o sentido das dimensões com o desenho. |
| Botoeiras | COP e LOP identificam os comandos especificados. |
| Cabina | Largura, profundidade e altura. |
| Portas | Tipo, largura e altura. |
| Observações | Divergências e particularidades daquela unidade. |

### Desenhos e anexos

Permite anexos múltiplos, incluindo PDF, imagens, DWG, DXF e planilhas conforme o seletor. Remover atua no anexo. Observações gerais descrevem pendências entre unidades.

### Rascunho e finalização

Salvar rascunho preserva o trabalho. Finalizar projeto grava o estado finalizado e registra o evento correspondente. Cancelar fecha o editor. A finalização participa da cadeia da cotação, mas não significa equipamento fisicamente instalado.

Fonte: src/engenharia-elevador.jsx e src/projeto-elevador-store.js.

## 7.3 Projeto de Equipamento

O configurador atual desta tela cobre Escada Rolante e Esteira Rolante. O elevador possui a tela anterior. Novo projeto de equipamento abre janela com referência, tipo, parâmetros, resumo calculado e anexos.

### Escada rolante

Aplicação distingue ambiente comercial e transporte público. Ambiente distingue interno/externo. Inclinação, desnível, largura do degrau, velocidade e degraus em patamar descrevem a geometria e operação. Motorização, economia de energia e balaustrada completam a configuração.

### Esteira rolante

Ambiente, inclinação, comprimento, largura da palheta, velocidade, tipo de superfície, motorização e economia de energia definem a especificação.

### Cálculos, esquema e anexos

O esquema e o resumo são derivados das entradas. Devem ser apresentados como cálculo do configurador, sem tratá-los como desenho executivo aprovado por um fabricante. Anexos complementam a especificação. Salvar rascunho e Finalizar especificação têm estados diferentes.

### Herança e destino

O configurador mantém especificações próprias e contexto de cotação. A lista mostra tipo, configuração, capacidade, anexos e status. A integração efetiva com documentos posteriores deve preservar a referência; não inferir cópia integral para todos os documentos.

Fonte: src/engenharia-config.jsx.

## 7.4 Projetos ER/Es

É a tela de desenho paramétrico de escadas e esteiras. Sua proposta é visualizar como escolhas alteram geometria e estimativas.

### Controles

Selecionar a família muda os limites. Desnível ou comprimento do vão, ângulo, velocidade, drive, modo de economia e balaustrada alteram o desenho e o resumo. O código possui opções predefinidas de acionamento/acabamento.

### Resultados

Mostra desnível, vão horizontal, comprimento inclinado, comprimento total, profundidade do poço, capacidade de transporte, potência nominal, potência média, consumo anual estimado e peso aproximado. São valores calculados pelo motor da tela.

### Exportar PDF

Aciona a exportação/impressão do projeto visual. Um arquivo exportado não prova que a configuração foi sincronizada com o Projeto de Equipamento. Essa ligação precisa de validação explícita.

Fonte: src/desenho-tecnico.jsx.

## 7.5 Ficha Técnica

É um editor extensível de especificação. Painel lista fichas; Nova ficha abre o gerador. Busca aceita número, produto e SKU. Abrir recupera ficha; Excluir pede confirmação.

### Gerador → Identificação

Nome do produto, descrição comercial, descrição técnica, categoria/segmento, código do produto Omie e part number identificam o item. SKU é gerado automaticamente e exibido como leitura. Insumo predominante, É parte de?, função/aplicação, forma/estado e descrição DUIMP enriquecem o contexto técnico/fiscal.

### Gerador → Categorias e campos

Busca “O que você quer especificar?” filtra campos. Templates carregam conjuntos de campos. Expandir categoria mostra opções. Marcar um campo ativa sua presença na ficha. Cada campo ativo recebe valor conforme seu tipo.

Nova categoria pede nome. Adicionar campo pede nome, tipo de entrada, unidade/símbolo, unidade personalizada quando necessário e valor padrão opcional. Excluir campo/categoria remove a estrutura selecionada. Esse caráter extensível significa que a quantidade de campos não é finita nem igual para todas as fichas.

### Gerador → Mídia

Desenho técnico e foto do produto têm slots separados. Selecionar imagem envia o arquivo pelo tratamento da ficha; Remover retira o slot.

### Salvar, visualizar e publicar

Salvar preserva a ficha. Visualização abre prévia, com baixar/imprimir e fechar. Publicar no Omie exige código e aciona a integração implementada; status e retorno devem ser conferidos. O copiloto especialista auxilia a ficha, mas suas sugestões precisam ser revisadas pelo responsável.

### Herança e destino

As fichas se relacionam ao Catálogo de Produtos e ao workflow de análise. A publicação Omie é uma ação separada do simples salvamento. No exemplo, a identificação e os dados técnicos precisam representar o elevador contratado, não uma ficha genérica de outra unidade.

Fonte: src/ficha-tecnica.jsx, src/ficha-tecnica-engine.js, src/ficha-tecnica-store.js, src/ficha-omie-publish.js.

## 7.6 Produtos

Organiza catálogo técnico/fiscal, operadores estrangeiros e pedidos a fornecedor. A listagem pode apresentar produtos vindos de Fichas Técnicas. Ativo, rascunho e desativado são situações do catálogo; não significam disponibilidade física em estoque.

### Produtos → Lista e detalhe

Pesquisa e filtros ajudam a localizar os itens. Os KPIs mostram ativos, rascunhos, desativados e NCMs distintas. As colunas incluem produto, NCM, código, código interno, versão e situação.

O detalhe apresenta NCM e descrição, modalidade, CNPJ raiz, unidade estatística e código interno. Ativar muda a situação; Gerar nova versão incrementa versão; Desativar retira o uso corrente; Reativar gera nova versão conforme a ação. Excluir abre confirmação própria.

### Produto → Cadastro e workflow

O cadastro previsto contém identificação, descrição, NCM, modalidade, unidade, atributos e operadores relacionados. Adicionar atributo amplia a descrição estruturada. Salvar rascunho conserva o item; Salvar e ativar disponibiliza conforme a rotina. A disponibilidade desse criador direto precisa ser conferida porque a tela também orienta a entrada pela Ficha Técnica.

O workflow pode abrir histórico, solicitação de revisão e cliente interessado. Ações de avançar/devolver dependem do estado e papel. Solicitar revisão registra a justificativa; Cliente interessado liga o contexto comercial quando oferecido; publicar é ação distinta da mudança de fase.

### Operadores estrangeiros

Novo operador cadastra fabricante/exportador. País, cidade, logradouro, subdivisão, código postal, TIN, e-mail, CNPJ raiz e código interno caracterizam o operador. Lista e detalhe mostram situação e versões. Não confundir com o cadastro geral de Fornecedores.

### Pedidos a fornecedor

Selecionar produtos habilita Gerar pedido a fornecedor. O construtor gera a cotação/documento a partir dos itens e operador. A prévia permite salvar PDF, salvar registro, enviar e fechar. A janela de envio permite copiar link, WhatsApp e e-mail. O portal de resposta recebe os preços e condições do fornecedor.

A lista mostra cotação, fornecedor, itens, idioma, situação e data. Ver resposta abre SKU/produto, quantidade, preço, MOQ, prazo e observações. A lixeira exclui o documento conforme sua rotina.

### Solicitações NCM → Tela filha de apoio

Existe rota de Solicitações NCM com Lista/Kanban, Novo produto e detalhe. As fases são Em preenchimento, Aguardando jurídico, Aprovado jurídico, Pronto LogComex e Cadastrado Siscomex. O detalhe possui o fluxo de revisão e exportação. Não é um item independente do menu atual; o caminho de acesso pela interface precisa de validação visual.

### Herança e destino

Ficha Técnica fornece descrição; workflow organiza revisão; catálogo conserva identidade fiscal; operador estrangeiro contextualiza origem; pedido transforma seleção em consulta ao fornecedor. Cadastrar um item local não comprova que ele já esteja transmitido ao Siscomex ou ao Omie.

Fonte: src/ncm-catalogo.jsx, src/ncm.jsx, src/ficha-workflow.jsx, src/pedido-fornecedor.jsx e respectivos serviços.

## 7.7 Linha do Tempo da Cotação

Permite informar a cotação e Buscar. A tela reúne eventos em sequência, com datas, papéis e contexto. A proposta é contar a história da negociação por fatos registrados, atravessando os departamentos.

Não é editor de datas passadas nem cronograma de montagem. Consulta o histórico da cotação. No exemplo, usar o número da Horizonte para explicar quando houve coleta, resposta, preço, aprovação e avanço.

Fonte: src/linha-do-tempo.jsx e src/linha-do-tempo-store.js.

# 8. Obras & Instalação

Seis telas organizam execução: Dossiês de Obras, Vistorias de Obras, Resultado Vistorias de Obras, Instalação em Campo, Cronograma e ART. O Dossiê é a principal página mãe desta categoria, porque reúne os registros da obra e suas relações.

## 8.1 Dossiês de Obras

A lista oferece busca e filtro de status, com número da obra, prédio, cliente, equipamento, local, status e criação. Abrir leva ao Dossiê selecionado. Essa tela deve ser apresentada como índice de prontuários.

### Dossiê → Visão Geral

Reúne identificação, estado mestre, vínculo do Cliente, informações da análise técnica e contrato do instalador. Cliente (Cadastro) permite relacionar a obra ao cadastro mestre. Abrir no Jurídico leva à área de Contrato Instalador.

Avançar Etapa abre Nova etapa e Observação opcional. Confirmar grava a evolução. O usuário deve observar as condições apontadas pelo sistema; mudar o estado não fabrica documentos faltantes.

#### Visão Geral → Análise Técnica

Abre o formulário técnico da obra. Reúne requisitos e custos/condições de montagem, logística, acesso, recursos como Munck/andaime, vistorias, supervisão, hospedagem e risco. Salvar/aprovar estabelece o registro da análise conforme a rotina. A calculadora de projeto pode usar esses dados para custo técnico.

Os campos concretos dependem do componente de análise e da condição marcada. A aula deve mostrar a abertura dos campos condicionais, como necessidades de recurso e justificativas.


| Etapa da Análise Técnica | Campos e proposta |
| --- | --- |
| Tipo de Equipamento | Equipamento, paradas, carga, abertura, vão de porta em cm e acabamento: descrevem o objeto analisado. |
| Localização da Obra | Cidade, estado e distância Santos → Obra: contextualizam transporte e deslocamento. |
| Infraestrutura | Necessidade de andaime e responsável, necessidade de Munck, armazenagem e suas observações: dimensionam preparação e recursos. |
| Instalação e Equipe | Dias de instalação, vistorias inclusas, supervisor, horas de deslocamento, hospedagem e dias de hospedagem: sustentam a estimativa de execução. |
| Documentação | Projeto, ART, NRs, ASO, PCMSO/PGR e riscos/exclusões: registram requisitos do serviço. |

Avançar e Voltar percorrem essas etapas. Aprovar Análise conclui a decisão prevista; Cancelar sai do formulário. A unidade de vão de porta desta análise é cm, enquanto vários campos do Formulário técnico usam mm.

### Dossiê → Documentos

Apresenta ART, Termo de Vistoria, DataBook e Termo de Entrega Final como tipos obrigatórios no catálogo da tela. Alvará, Contrato Instalador, NRs, ASO, PCMSO/PGR e Cronograma são tipos adicionais. O responsável pode anexar documentos conforme a linha e abrir o arquivo disponível.

O painel do Termo de Entrega gera o link de aceite e permite copiá-lo. Gerar link não equivale ao cliente assinar; o estado de assinatura é consultado separadamente.

### Dossiê → Instalação

Reúne checklist de preparação. Recebido por e quantidade de pessoas na recepção registram quem recebeu o equipamento. A ação de marcar entregue altera esse estado. O responsável indica se andaime/Munck é necessário e se foi providenciado.

Há parceiro principal da obra e relação de empresas vinculadas. Vincular empresa escolhe uma empresa cadastrada; remover desfaz o vínculo indicado. Empresas por equipamento e parceiro principal não devem ser tratados como a mesma informação. O contrato e a homologação entram na verificação de prontidão.

### Dossiê → Equipamentos

Cada equipamento pode ser expandido. Adicionar equipamento cria um item; lixeira solicita exclusão; Salvar preserva a ficha daquele equipamento.

| Bloco | Campos |
| --- | --- |
| Identificação | Número de série, tipo e descrição. |
| Pessoas | Empresa de montagem, montador responsável e vistoriador. |
| ART | Status e datas de início/término do processo. |
| Alvará de instalação | Status e datas de início/término. |
| Alvará de funcionamento | Status e datas de início/término. |
| Instalação | Prazo em dias, previsão de início/fim e início/fim real. |
| Materiais | Previsão de chegada e chegada real. |
| Observações | Contexto específico do ativo. |

A tela também pode mostrar equipamentos relacionados a outros dossiês e o botão Abrir correspondente. No exemplo, os elevadores de 630 kg e 1.000 kg precisam conservar identificação própria, mesmo estando na mesma obra.

### Dossiê → Cronograma de Instalação

Criar Cronograma de Instalação instancia a estrutura para o equipamento/contexto. Itens mostram semana, etapa, serviços e resultado esperado. Concluir registra o item feito; Desmarcar o retorna a pendente; N/A marca não aplicável; Reativar devolve sua aplicabilidade.

Link público (Cliente) e Link interno (VerticalParts) geram acessos com finalidades distintas. Adicionar item ao template abre tipo de equipamento, semana, etapa, serviços um por linha e resultado esperado. Essa ação altera o modelo reutilizável, não apenas a leitura da obra atual.

### Dossiê → Acompanhamento de Obra

É o diário de execução. O usuário seleciona serviços feitos e registra o avanço; Desflegar desfaz a marcação prevista. A tela gera link para o diário e permite evidências conforme o item. O foco é o realizado no dia, conservando data e contexto.

O percentual técnico, a liberação de parcela e a marca de pagamento são informações diferentes. O diário não deve ser apresentado como transferência automática ao instalador.

### Dossiê → Pendências

Adicionar Pendência abre tipo obrigatório, descrição obrigatória, etapa opcional e indicação de bloqueio conforme o formulário. Adicionar grava a pendência. Resolver muda seu estado. O cadastro deve explicar o que falta, quem precisa agir e em que etapa isso interfere.

Há uma ressalva para um atalho da Visão Geral no apêndice A08; usar o fluxo da aba de pendências até que esse atalho seja corrigido/validado.

### Dossiê → Responsáveis

Mostra responsáveis por etapa. Atribuir/editar abre a janela com responsável e notas. Salvar registra a atribuição. Essa informação explica qual setor/pessoa conduz cada trecho da execução.

### Dossiê → Histórico

Consulta os registros da obra. Serve para reconstituir mudanças, responsáveis e eventos. Não é um campo para reescrever fatos anteriores.

### Herança e destino

O Dossiê pode nascer do Lead e vincular Cliente/cotação. Reúne equipamentos, documentos, instalação, cronograma, pendências e responsáveis. É consultado por Central de Documentos, Vistorias, Instaladores e Entrega. A existência do vínculo deve ser preservada em vez de criar outra obra para cada documento.

Fonte: src/dossier-obra.jsx, src/dossier-store.js, src/analise-tecnica.jsx e serviços de instalação/acompanhamento.

## 8.2 Vistorias de Obras

A tela possui Questionários, Despachar e Calendário. Sua proposta é montar o formulário no escritório, vinculá-lo à obra e permitir execução pelo técnico.

### Questionários → Lista

Novo Questionário pede nome e tipo: Vistoria, Entrega ou Serviço. Criar e montar abre o editor. Ativo controla a disponibilidade. Abrir recupera a estrutura; Excluir remove o questionário conforme a confirmação da rotina.

### Questionário → Categorias

Adicionar categoria cria um grupo de perguntas. Excluir categoria remove o grupo. Repetir por pavimento permite replicar o conjunto conforme as paradas informadas no despacho.

### Categoria → Perguntas

Adicionar/Editar pergunta abre texto, tipo de campo, obrigatoriedade, opções quando aplicáveis e regra de exibição. A regra escolhe uma pergunta anterior e o valor que precisa estar presente para mostrar a pergunta atual. Sempre mostrar retira essa condição. Mover para cima/baixo altera ordem; Excluir remove a pergunta.

Os tipos vêm do catálogo do sistema. O preenchimento pode incluir texto, número, data, escolhas e fotos. Não há um número universal de perguntas: cada questionário e cada condição podem produzir ramos diferentes.

### Despachar → Nova vistoria

| Campo | Uso |
| --- | --- |
| Busca por obra/cliente/série | Localiza o contexto antes do envio. |
| Obra | Obrigatória, associa o resultado ao Dossiê. |
| Equipamento | Opcional; pode ser vistoria geral da obra. |
| Questionário | Obrigatório, define as perguntas. |
| Técnico | Opcional, pode ficar a definir. |
| Agendamento | Define data/hora prevista. |
| Paradas | Permite repetição por pavimento. |
| Medidas e referências | Guardam dados dimensionais usados pelo questionário, incluindo entre pisos e última parada/overhead quando aplicáveis. |

Despachar cria a atividade e seu link. Copiar link copia o acesso; WhatsApp abre o envio ao número informado. O roteiro não executou envios reais.

### Últimas vistorias despachadas

Mostra número, obra, equipamento, questionário, técnico, status, agendamento e envio. Ver resultado abre as respostas. Trocar vistoriador / reenviar link abre seleção do técnico e geração de novo link. Excluir atua na atividade selecionada.

### Calendário

Mês anterior, próximo mês e Hoje mudam a janela temporal. Clicar em um agendamento abre detalhes da vistoria.

### Herança e destino

Consulta Dossiês, equipamentos, colaboradores e questionários. Cria a atividade executável pelo técnico. Suas respostas aparecem em Resultado Vistorias e no contexto da obra. Questionário modelo e atividade despachada são entidades diferentes.

Fonte: src/vistorias-envio.jsx e src/vistorias-questionarios-store.js.

## 8.3 Resultado Vistorias de Obras

Permite escolher obra, inclusive pela organização por cliente/equipamento, e acompanhar os registros de vistoria. A página reúne registros tradicionais de vistoria e checklists digitais despachados.

### Registro de vistoria

O formulário reúne vistoriador, agendamento, tipo, fase contratual, custo/valor, observações e anexos. Tipo distingue Vistoria, Pré-Obra, Inserção e Pós-Venda. Fase distingue visita avulsa e fases 1, 2 e 3 inclusas. Estados distinguem agendada, em progresso, concluída e cancelada.

Abrir/editar e concluir usam o registro da obra. A liberação pelas fases depende de registros efetivamente concluídos, não apenas agendados.

### Checklists digitais → Resultado

Abrir atividade mostra o questionário e suas respostas. Editar respostas alterna o modo de edição. Texto/número podem salvar ao sair do campo; escolhas salvam por seleção; data salva por alteração. Fotos podem ser adicionadas/removidas e receber legenda. Marcar pendência destaca uma resposta que exige tratamento.

Baixar PDF gera o relatório das respostas. Não confundir o PDF do resultado com a versão modelo do questionário.

### Herança e destino

Consulta Dossiê, equipamentos, atividades e respostas. Os resultados permanecem vinculados à obra/atividade. O formulário tradicional usa sua própria base; verificar na aula qual dos dois fluxos a equipe deve adotar em cada situação.

Fonte: src/vistorias-obras.jsx, src/vistoria-execucao.jsx.

## 8.4 Instalação em Campo

É a visão de equipes e parceiros em obras. Mostra equipes em campo, alocações, parceiros homologados e indicador de termos quando disponível.

### Agenda

Calendário abre Google Calendar. Agendar instalação abre dados da programação e salva na rotina de agenda da tela. Não confundir com o cronograma completo do Dossiê.

### Parceiros em Obras e Equipes

Selecionar equipe abre seu checklist. Adicionar item insere uma atividade; marcar itens registra o controle implementado. O bloco de parceiros permite enxergar as alocações já existentes.

### Foto e laudo

O controle de foto possui limitação A07. Laudo final abre a impressão da página pelo código atual; não é prova de geração de um documento técnico independente com aceite.

### Herança e destino

Lê equipes, parceiros e alocações. Seu checklist é distinto do diário de obra e das parcelas do Contrato Instalador. Explicar essas diferenças evita usar a tela errada para solicitar pagamento.

Fonte: src/operacoes.jsx.

## 8.5 Cronograma

Esta tela possui um controle de fases de pagamento de instalação. Mostra equipamentos, total contratado, já pago e a liberar. A lista contém endereço, montador, paradas, carga, valor e progresso.

### Novo cronograma

Recebe endereço de instalação, montador PJ, paradas, carga e valores/datas das fases apresentados no formulário. Criar cronograma grava o registro; Cancelar fecha.

### Fases de pagamento

A estrutura exibida é: início da instalação, equipamento tracionado, portas de pavimento + elétrica prontos e conclusão do equipamento. A linha pode ser liberada e marcada paga conforme o tratamento desta tela. O clique altera seu controle local de cronograma.

### Relação com os outros controles

Este registro usa base própria. Não foi comprovada equivalência automática entre ele, o Cronograma de Instalação do Dossiê e as Parcelas do Contrato Instalador. O plano didático de 50%/75%/100% só pode ser apresentado como regra vigente quando refletido no contrato/checklist específico. Ver A10.

Fonte: src/entrega.jsx.

## 8.6 ART

A tela orienta que a ART seja gerenciada na obra. Abrir obras e Ir para a lista de obras levam a Dossiês. Em seguida, escolher a obra e acessar documentos/equipamentos para tratar a ART.

Não há nesta página mãe um assistente que registre uma ART diretamente no conselho profissional. A aula deve mostrar o caminho completo: ART → Obras → Dossiê → documento/controle do equipamento.

Fonte: src/entrega.jsx.

# 9. Entrega & Documentação

Três telas concentram consulta documental, encaminhamento ao Data Book e registro de entrega final. A proposta é distinguir equipamento instalado de obrigação documentada e aceita pelo cliente.

## 9.1 Central de Documentos

Permite localizar/selecionar obra e enxergar a documentação em um só lugar. A apresentação distingue Disponível, Pendente e não aplicável/ausente conforme a linha.

### Documentos da Obra

Reúne ART, Termo de Vistoria, DataBook, Termo de Entrega e demais tipos. Abrir documento usa o link existente. A ação para o Dossiê leva à origem do documento, onde ele é mantido.

### Documentação do Montador

Consulta os documentos relacionados ao parceiro/colaborador da obra. O usuário pode ir ao Dossiê ou à Homologação para tratar o cadastro de origem. Marcar documentação enviada registra esse estado; não comprova por si só entrega de uma mensagem a um destinatário externo.

### Herança e destino

Consulta Dossiê e documentação dos instaladores. É uma central de consulta com encaminhamentos; não substitui as telas responsáveis pelos arquivos. No exemplo, use-a para demonstrar que a Horizonte tem o conjunto documental necessário antes da entrega.

Fonte: src/central-documentos.jsx e src/central-documentos-store.js.

## 9.2 Data Book & Termo

A página orienta o acesso à documentação por obra. Abrir obras e Ir para a lista de obras levam aos Dossiês. Depois da seleção, Documentos contém os arquivos de DataBook e Termo, e o painel do termo permite gerar o link correspondente.

A proposta é manter o conjunto documental ligado à obra. Não apresentar a página mãe como gerador automático de um livro técnico completo se essa operação não foi realizada.

Fonte: src/entrega.jsx, src/dossier-obra.jsx.

## 9.3 Entrega Final

O menu abre o componente identificado internamente como Handover & Manutenção. A lista consulta os dossiês e mostra projetos, entregas registradas e indicadores de garantia/transferência.

### Selecionar obra → Registrar Handover

O formulário pede nome do cliente, período de garantia em meses, contato de suporte, e-mail de suporte e observações. Registrar Handover grava os dados no contexto selecionado. A pré-seleção da obra deve estar clara antes de confirmar.

### Checklist de Entrega

Editar checklist abre os itens de conclusão; marcar/desmarcar e Salvar alteram a relação dos itens concluídos. Os itens vêm do catálogo do componente. A prova documental e o aceite precisam ser conferidos, além da marcação.

### Transferência para manutenção

O código contém uma ação específica de transferência para Escamax. Isso é uma característica encontrada na implementação, não uma orientação de que a VerticalParts deva contratar essa empresa. Antes da aula, revisar se o destinatário fixo corresponde ao processo atual; ver A11.

### Herança e destino

Recebe a obra e registra o handover em seu contexto. Os indicadores derivados não devem ser confundidos com cálculo validado de vigência de garantia: a contagem apresentada é tratada no apêndice. O cadastro de entrega não cria automaticamente uma equipe própria de manutenção da VerticalParts.

Fonte: src/handover-manutencao.jsx e src/handover-manutencao.js.

# 10. Parceiros & Instaladores

Quatro telas organizam o ciclo do parceiro: Empresas Instaladoras, Homologação de Instaladores, Contrato Instalador e Pagamentos a Instaladores. A proposta é ligar a pessoa jurídica, sua equipe, documentos, ativos contratados, execução e pagamentos sem confundir os diferentes níveis.

## 10.1 Empresas Instaladoras

A lista permite buscar por nome/CNPJ, sincronizar dados pelo comando Omie, cadastrar, editar e excluir empresas. Selecionar uma empresa abre colaboradores e clientes atendidos. Os indicadores por empresa ajudam a comparar quantidade de pessoas e equipamentos.

### Nova empresa / Editar empresa

Nome obrigatório, CNPJ, contato, e-mail e telefone/WhatsApp identificam o prestador. Endereço reúne os campos cadastrais. Banco, agência, conta e PIX fornecem a referência financeira usada pelos fluxos que a consultam. Salvar preserva o cadastro; Cancelar fecha.

### Colaboradores

Novo colaborador abre nome completo obrigatório, CPF, RG, CNH, tipo de vínculo, endereço e status. Ativo, Inativo e A_CONFIRMAR representam a situação cadastral. Editar recupera o colaborador; Excluir atua no registro escolhido.

### Clientes atendidos → Obras → Equipamentos

A hierarquia permite expandir os clientes atendidos e suas obras/equipamentos. Abrir conduz ao Dossiê. Desvincular desfaz a relação indicada. O painel compara percentual pago com percentual da obra e pode consultar dados de pagamentos Omie; diferença entre os percentuais não é automaticamente erro, pois pagamentos podem ter sinal e marcos próprios.

### Herança e destino

Empresa e colaboradores alimentam Homologação, seleção de instalador na obra e Contrato Instalador. A documentação não deve ser duplicada em cada tela. No exemplo, a mesma empresa pode montar os dois elevadores, com pessoas diferentes em cada atividade.

Fonte: src/cadastro-instaladores.jsx, src/rh-homologacao.jsx, src/omie-pagamentos-store.js.

## 10.2 Homologação de Instaladores

Organiza empresa → colaborador → documentos. A proposta é conferir habilitação documental e vencimentos. Os KPIs mostram empresas, documentos vencidos, válidos e sem vencimento.

### Seleção

Buscar empresa por nome/CNPJ reduz a lista. Selecionar empresa mostra colaboradores; selecionar colaborador mostra documentos. Isso é importante: o documento de uma pessoa não comprova automaticamente a documentação de todas as outras pessoas da empresa.

### Adicionar / Editar documento

Tipo de documento vem do catálogo. O formulário solicita vencimento, arquivo PDF/imagem e observações. Remover o arquivo atual altera o anexo do cadastro. Salvar registra as mudanças.

Para carteira de vacinação, há escolhas de vacinas aplicadas, vencimentos opcionais e scan da carteira. Na aula, mostrar a estrutura com dados de demonstração adequados; não projetar documentos pessoais reais sem necessidade.

### Estados

Vencido indica necessidade de atualização. Válido indica data dentro da regra do componente. Sem vencimento significa documento existente sem data, e não comprovação automática de que qualquer exigência está atendida.

### Herança e destino

Lê Empresas/Colaboradores e catálogo documental. Contrato Instalador e Dossiê consultam o contexto documental; vínculo específico à obra continua sendo outra informação. A análise não validou exigências legais dos documentos, apenas os campos e seu uso no sistema.

Fonte: src/rh-homologacao.jsx e src/rh-homologacao-store.js.

## 10.3 Contrato Instalador

A tela possui Painel e Novo contrato. O assistente tem seis etapas: Início/Modalidade, Partes, Objeto, Logística, Pagamento e Revisão. Sua função é formalizar o serviço do parceiro, incluindo a seleção de quais ativos ele vai instalar.

### Início → Modalidade

Seleciona o tipo de contratação apresentado pelo assistente. Essa escolha condiciona textos e campos seguintes. Avançar valida a etapa; Voltar retorna; os títulos do assistente permitem a navegação prevista.

### Partes → Contratada e representante

Razão social e CNPJ identificam a empresa. Endereço possui rua, número, bairro, cidade, UF e CEP. O representante possui nome, nacionalidade, estado civil, profissão, RG e CPF. Marcar que reside no endereço da empresa evita repetir endereço; desmarcar abre os campos residenciais.

O aviso de homologação consulta o parceiro pelo CNPJ. Isso não substitui a conferência dos colaboradores que efetivamente entrarão na obra.

### Objeto → Proposta, ativos e obras

Selecionar Proposta permite herdar contexto e marcar ativos individualmente. Escolher somente um elevador significa que o contrato não deve cobrir automaticamente o outro. A seleção de obras permite adicionar/remover vínculos.

Quantidade, marca, tipo de elevador, paradas, paradas personalizadas, capacidade, carga especial, descrição dos serviços e local do serviço completam o objeto. Capacidade e distância podem alterar cláusulas geradas pelo motor.

### Logística

Cidade, UF e distância de Guarulhos contextualizam o deslocamento. Despesas à parte ou Extensão de prazo definem o tratamento; Contratada/Contratante define responsabilidade; dias adicionais registra a extensão quando escolhida.

### Pagamento

Valor total do contrato é obrigatório. A forma pode ser duas parcelas, três ou personalizada. Adicionar parcela cria outra linha e remover elimina a parcela. Banco, agência, conta e PIX podem ser preenchidos com apoio do cadastro do parceiro.

O conteúdo concreto da parcela e seu marco devem estar coerentes com a medição. Não ensinar automaticamente a mesma divisão para contratos diferentes.

### Revisão → Anexos e assinatura

Conferir os anexos/status e escolher cidade, dia, mês e ano da assinatura. Gerar e enviar para assinatura cria o documento e abre o envio. A janela permite nome do destinatário, WhatsApp/e-mail, seleção do canal e cópia do link. Cancelar fecha; Concluir encerra a janela de envio.

### Painel → Auditoria e reenvio

A lista mostra contrato, objeto, valor, status e atividade. Auditoria abre uma gaveta com histórico e informações do registro. Enviar/Reenviar link abre o envio do mesmo contrato. Excluir aciona a exclusão prevista; fechar a gaveta não altera o contrato.

### Herança e destino

Recebe proposta/ativos, obras e dados do parceiro. Alimenta o vínculo contratual da instalação e a base de parcelas consultada em Pagamentos a Instaladores. A assinatura é um evento separado da criação do documento.

Fonte: src/contrato-instalador.jsx, src/contrato-instalador-store.js, src/contrato-instalador-engine.js e src/contrato-instalador-parcelas-store.js.

## 10.4 Pagamentos a Instaladores

Mostra Liberadas p/ pagar, Aguardando marco, Pagas e Todas. As linhas identificam instalador, contrato, parcela, valor, situação e data de pagamento.

### Marcar paga

Só fica disponível quando a parcela está liberada pelo tratamento de marcos. Grava o pagamento na base de parcelas. Não transmite ordem bancária.

### Reabrir

Em uma parcela paga, permite desfazer o estado de pagamento conforme a rotina. Essa alteração afeta a leitura financeira e deve ser justificada no processo da empresa.

### Herança e destino

Recebe parcelas dos Contratos Instaladores e avalia sua liberação conforme os marcos disponíveis. Não substitui a conferência do comprovante financeiro nem garante conciliação automática com o Omie.

No exemplo didático, R$ 20.000 em quatro pagamentos só será o plano vigente se configurado no contrato; a medição libera a parcela, e o Financeiro registra o pagamento depois.

Fonte: src/pagamentos-instalador.jsx e src/contrato-instalador-parcelas-store.js.

# 11. Logística Interna

Possui uma tela: Almoxarifado. Na implementação consultada, seu foco é solicitação de compra de varejo com decisão de Logística. Não corresponde a um WMS completo de entradas, saídas e inventário.

## 11.1 Almoxarifado

Os indicadores mostram pedidos aguardando Logística, aprovados aguardando compra e total. A tabela apresenta número, item, quantidade, estimativa, urgência, solicitante e status.

### Novo pedido

Abre Novo pedido de compra de varejo. Item é obrigatório; quantidade e unidade medem a necessidade; valor estimado dimensiona a compra; urgência sinaliza prioridade; justificativa explica o uso. Enviar pedido grava a solicitação e aciona a decisão prevista. Cancelar fecha.

### Decisão e compra

O estado pode ser aguardando, aprovado, reprovado, comprado ou cancelado. A decisão é tratada pelo fluxo gerencial. Marcar comprado aparece para pedido aprovado e registra a compra realizada. Não comprova entrada física em estoque nem pagamento ao fornecedor.

### Herança e destino

Grava pedidos de varejo e interage com decisões gerenciais. No exemplo, uma necessidade pontual de material pode seguir este fluxo; não substitui a P.I. dos elevadores.

Fonte: src/almoxarifado.jsx e src/pedidos-varejo-store.js.

# 12. Administração

Possui dois submódulos: Logs de Atividade e Configurações do Sistema. Sua proposta é oferecer rastreabilidade e organizar os acessos/configurações disponíveis. As rotas estão restritas a Admin no código consultado.

## 12.1 Logs de Atividade

É a consulta da trilha operacional. Atualizar recarrega os registros. Data inicial, final e pesquisa por pessoa/ação/documento permitem reduzir o conjunto.

### Indicadores e registros

Mostra registros no filtro, ações de hoje, atores distintos e módulos. A listagem descreve o que foi feito e o detalhe, incluindo referências e valores quando o evento os registrou. O carregamento é limitado aos 400 últimos conforme o tratamento da página; uma ausência fora desse recorte não prova que a ação nunca aconteceu.

### Herança e destino

Recebe eventos registrados pelas ações do sistema. É leitura para explicar a sequência de fatos. Não é um editor para mudar o histórico, e nem todo evento imaginável foi necessariamente instrumentado.

Fonte: src/logs-admin.jsx e src/vp-log.js.

## 12.2 Configurações do Sistema

A página abre seis abas: Administração, Usuários & Perfis, Permissões (RLS), Parâmetros, Integrações e Buckets Storage. O nome de uma aba não garante que todos os elementos sejam editáveis.

### Administração → Colaboradores

Busca por nome/e-mail e agrupamento por departamento organizam os colaboradores. Alocar em Módulo abre o painel de alocação. Checkboxes de grupo alteram as alocações; catálogo de itens/capacidades permite as concessões expostas pelo componente.

Remover acesso remove alocações, sem apagar o colaborador. A consequência efetiva deve ser revisada com a regra do menu: ausência de alocação pode significar não filtrar grupos, conforme o código. Ver A12.

### Usuários & Perfis

Lista nome, perfil, e-mail, último login e status. Convidar usuário abre e-mail, nome e perfil. Registrar convite salva uma solicitação de acesso; não afirmar que envia automaticamente um convite por e-mail. Convites pendentes mostram destinatário, nome, perfil, autor e data; Revogar retira o convite conforme a rotina.

O menu de mais opções da linha tem ressalva por ausência de ação ligada no componente.

### Permissões (RLS)

Apresenta uma matriz de referência com leitura, escrita e ações restritas. Essa matriz não deve ser ensinada como editor de políticas de banco de dados. A seção Alçadas de Propostas controla capacidades específicas como acesso amplo, preço manual, destravar aprovada e concessão de alçadas, quando autorizado.

### Parâmetros

Mostra parâmetros financeiros e operacionais: câmbio manual, margens, comissão, impostos, SLAs, tempo médio, validade e garantia. No código consultado, são valores exibidos pelo componente. Não usar essa aba como prova de que mudar um texto alterará o motor de precificação; ver A13.

### Integrações

Apresenta os serviços previstos e orienta configuração no ambiente. O próprio texto informa que o status não é monitorado automaticamente. A lista não é evidência de saúde ou conexão válida de cada API.

### Buckets Storage

Consulta os buckets reais que a aplicação consegue listar, indicando bucket, uso e acesso. É uma visão de armazenamento; não é, por si só, um gerenciador de upload de qualquer documento da obra.

### Herança e destino

Alocações e capacidades influenciam os acessos exibidos e ações permitidas. Convites mantêm sua fila; configurações de referência não devem ser confundidas com parâmetros persistidos usados pelos motores. Na aula geral, basta demonstrar a governança; alterações de acesso merecem uma sessão própria com o administrador.

Fonte: src/financeiro.jsx, src/colaboradores-admin.jsx, src/colaboradores-admin-store.js e src/shell.jsx.

# 13. Telas externas e ramos transversais

Estas superfícies não são categorias adicionais do menu. São filhas de ações realizadas dentro das categorias anteriores e devem aparecer ligadas a elas no mapa mental.

## 13.1 Formulário público do cliente

Nasce do link gerado em Formulários. O cliente preenche a identificação e as especificações permitidas, sem ver todos os controles internos de fornecedor/origem/vendedor. A gravação retorna ao formulário da negociação. O acesso depende do link gerado, não de adivinhar uma URL.

## 13.2 Resposta pública do fornecedor

Nasce do envio da consulta. O fornecedor recebe os itens e preenche os preços/condições disponibilizados. A resposta volta à cotação. Há fluxos diferentes para equipamentos e para pedidos de produtos; cada um deve retornar à sua entidade de origem.

## 13.3 Proposta e assinatura pública

Nasce do editor da Proposta ou do envio contratual. A superfície pública exibe o documento e coleta a ação disponível ao destinatário, incluindo aceite/assinatura ou revisão conforme o tipo de documento. Visualizado, enviado, aprovado e assinado não são sinônimos.

## 13.4 Execução da vistoria

Nasce de Despachar. O técnico abre a atividade, responde categorias/perguntas condicionais e inclui evidências. O conteúdo depende do questionário, equipamento e paradas. Concluir registra o estado da atividade conforme as validações; o resultado volta à obra.

## 13.5 Diário e status da obra

Os links gerados no Dossiê mostram a execução e o acompanhamento conforme o público permitido. Não compartilhar como link do cliente uma superfície interna sem conferir o tipo escolhido. Os registros retornam à obra vinculada.

## 13.6 Termo de Entrega

Nasce do painel de termo no Dossiê. A aceitação do destinatário retorna ao registro da obra. Gerar ou copiar o link prepara o processo, sem comprovar assinatura.

## 13.7 Copiloto

Há um copiloto global, exceto onde o especialista da Ficha Técnica assume a função. Sua resposta é apoio, não confirmação de gravação ou decisão gerencial. Os recursos efetivamente disponíveis dependem das funções externas e configuração, não verificadas ao vivo nesta sessão.

Fontes: src/formulario-elevador-public.jsx, src/cotacao-elevador-fornecedor.jsx, src/cotacao-app.jsx, src/assinar-app.jsx, src/vistoria-execucao.jsx, src/diario-obra-app.jsx, src/status-obra-app.jsx, src/termo-entrega-app.jsx e src/vp-copiloto.jsx.

# 14. Sequência sugerida para a aula

1. Abrir Geral e explicar como a equipe identifica sua próxima ação.
2. Mostrar o cadastro da fictícia Horizonte e a oportunidade em Leads.
3. Abrir Formulário, cadastrar os dois equipamentos de forma distinta e explicar o número da cotação/Master IDs.
4. Mostrar consulta e resposta do fornecedor, sem realizar envio real de demonstração.
5. Abrir Precificação e mostrar custos de origem, despesas, margens e aprovação.
6. Abrir Proposta herdada, revisar especificações, preço e retorno do cliente.
7. Mostrar Aval Financeiro, contrato e decisões necessárias para a compra.
8. Percorrer P.I., produção, Embarques, transporte e recursos IMS.
9. Mostrar especificação técnica, ficha e produto, distinguindo projeto e obra.
10. Abrir o Dossiê e expandir suas nove abas, inclusive as duas unidades.
11. Mostrar empresa instaladora, colaboradores, documentos, contrato e parcelas.
12. Despachar uma vistoria de demonstração apenas em contexto adequado; explicar o resultado e o PDF.
13. Mostrar diário, medição, liberação de parcela e registro do pagamento como passos separados.
14. Conferir Central de Documentos, Termo e Entrega Final.
15. Encerrar em Logs e Configurações, explicando como acompanhar responsabilidade e acesso.

As demonstrações com efeito externo devem usar registros de treinamento previamente definidos. Nesta rodada foram criados apenas os registros explicitamente identificados com “Teste”; não foram aprovadas compras, contratos ou pagamentos, nem enviados documentos comerciais a clientes.

# Registro de validação ao vivo do Tour III

## Roteiro executado

1. Portal Corporativo → card Cotação Importação | PRD.
2. Geral → Dashboard → alternância de período, Gantt/Lista/Kanban, Nova Tarefa e Relatório.
3. Geral → Notificações → filtros, Preferências, Marcar como lida e Abrir origem.
4. Geral → Central de Decisões, Prazos & Pendências e Inbox, incluindo composição, resposta, encaminhamento e vínculo de e-mail.
5. Cadastros Mestres → Clientes e Fornecedores, com abertura de cadastro, busca, edição/histórico e categorias.
6. Comercial → Lead, detalhe, Formulário, Controle de Cotações, Cotações a Fornecedor, detalhe/resposta/tratativas e Propostas/editor.
7. Financeiro, Contratos, Suprimentos & Importação, Engenharia & Produto, Obras & Instalação, Entrega & Documentação, Parceiros & Instaladores, Almoxarifado e Administração.

## Evidências atuais importantes

| Evidência | Leitura para a aula |
| --- | --- |
| Dashboard admin exibiu 3 projetos ativos, 3 embarques em trânsito e 2 alertas críticos | Indicadores são leituras agregadas; a correção acontece na tela de origem. |
| Nova Tarefa possui título obrigatório, módulo, prioridade e horário | A tarefa é gravada para o perfil; o toast “Tarefa adicionada!” confirma a gravação. |
| Notificações exibiu alertas comerciais e de Central de Decisões | Ler um alerta não aprova a decisão de negócio. |
| Inbox mostrou Caixa de entrada, Enviados, Rascunhos e Arquivados | A caixa `suporte@vpsistema.com` é compartilhada, sem separação automática por assunto. |
| Cliente de treinamento apareceu com código VPCLI-0107 | O cadastro pode ser criado sem CNPJ, mas a aula deve explicar o preenchimento posterior. |
| Lead de treinamento abriu com contato e empreendimento, mas sem cliente/CNPJ | O Formulário é o ponto para completar/vincular o cliente. |
| Formulário salvo gerou `VPCT-0956` e `VPEL-EL0956-1` | Número da cotação e Master ID nascem no salvamento e amarram as etapas seguintes. |
| Controle de Cotações listou `VPCT-0956` como rascunho | O registro salvo ainda não é uma cotação enviada. |
| Resposta Glarie para `VPCT-0955` mostrou divergências de cabine e preço em USD | A resposta do fornecedor exige comparação antes da Precificação. |
| “Decidir comprar” ficou bloqueado por aprovação do CEO | O gate financeiro impede iniciar a compra mesmo com resposta recebida. |
| Precificação exibiu P.I./fornecedor e status “Recebida”/“Não iniciada” | Precificar e aprovar são ações posteriores à resposta técnica/comercial. |
| Administração exibiu filtros de logs e seis áreas de configuração | Controle de acesso, parâmetros e integrações são caminhos distintos. |

## Registros criados para o teste

| Registro | Identificação observada | Limpeza sugerida |
| --- | --- | --- |
| Tarefa | `Teste TourIII - demonstrar tarefa do Dashboard` | Marcar concluída e excluir/arquivar conforme a regra do sistema. |
| Cliente | `Teste TourIII - Cliente de treinamento` (`VPCLI-0107`) | Excluir ou inativar depois de confirmar que não possui vínculos reais. |
| Lead | `Teste TourIII - Obra de treinamento` (`LD-829157`) | Excluir/arquivar depois de conferir o histórico. |
| Formulário/cotação | `Teste TourIII - Cliente provisório da obra` (`VPCT-0956`) | Excluir/arquivar o rascunho e a unidade `VPEL-EL0956-1`. |

# Apêndice A. Achados e instruções para correção/validação

Este apêndice é separado do conteúdo da aula. Nenhuma alteração no repositório foi realizada. Os itens abaixo distinguem evidência de código, limitação observada na sessão e necessidade de validação. Não são prova de que todas as falhas ocorram para todos os usuários em produção.

## A01. Acesso pelo card PRD: resolvido nesta sessão, manter teste de regressão

Na repetição de 12/09/2026, o card Cotação Importação | PRD abriu o aplicativo autenticado em `/geral/dashboard` e a sidebar carregou. O achado anterior era específico da sessão de navegação anterior, não deve mais ser apresentado como falha atual.

Instrução: manter um teste de regressão portal → card PRD → Dashboard em sessão limpa, verificando também expiração e tratamento de erro. Não registrar tokens ou senhas.

## A02. Dashboard: seletor de período exige conferência dos KPIs

O código atual passa `period` para `loadDashboardData(role, period)` e a interface alterna Hoje/7/30/90. O comportamento visual foi confirmado ao vivo. Ainda é necessário comprovar, com registros em datas diferentes, que todos os KPIs e o CSV respeitam o intervalo escolhido.

Instrução: executar o teste com dados fora e dentro do período e documentar quais indicadores são temporais e quais são acumulados.

## A03. Dashboard: conclusão da tarefa deve ser validada após recarregar

O código atual liga o checkbox ao ID da tarefa e atualiza `tarefas.done`; a criação da tarefa foi confirmada ao vivo com o toast “Tarefa adicionada!”. Falta repetir o clique de conclusão e atualizar a página para comprovar a persistência visual do estado.

Instrução: concluir uma tarefa de treinamento, recarregar e confirmar que ela não volta à fila pendente.

## A04. Notificações: preferências só guardadas no navegador

Evidência: NotificationPrefsModal salva em localStorage; a consulta/filtro mostrados não aplicam essas preferências e o componente não configura envio de resumo por e-mail. Fonte: src/financeiro.jsx.

Instrução: definir quais preferências afetam a aplicação e qual serviço consome cada uma. Implementar o efeito ou indicar claramente que ainda não está ativo. Verificar em outra sessão e com alertas de cada módulo.

## A05. Controles sem ação ligada

Evidências de código: Ver agora no aviso financeiro; Versões e Duplicar na calculadora legada; Email fornecedor no detalhe de Importação; Exportar relatório no mapa; Transportadora em Compras; menu de opções em Usuários. Os elementos aparecem sem manipulador de ação nesse componente.

Instrução: para cada controle, implementar o resultado esperado ou remover/desabilitar com explicação. Testar também eventos do elemento pai antes de concluir que uma linha inteira está inerte. Não classificar o botão Abrir de uma tabela como inerte quando a linha possui o clique.

Fontes: src/financeiro.jsx, src/precificacao.jsx e src/logistica.jsx.

## A06. Importar minuta informa sucesso sem persistir arquivo

Evidência: o manipulador abre seletor, lê nome do arquivo e mostra mensagem de importação, sem upload/persistência naquele fluxo. Fonte: src/operacoes.jsx, JuridicoPage.

Instrução: salvar o arquivo e sua referência, tratar erro e permitir reencontro depois de recarregar; só informar importação concluída após sucesso real.

## A07. Anexar no projeto e foto na instalação: seleção não é upload

Evidência: os controles citados em Engenharia e Instalação em Campo selecionam arquivo e exibem mensagem, sem enviar o conteúdo pelo manipulador mostrado. Fonte: src/operacoes.jsx.

Instrução: implementar upload, vínculo ao projeto/equipe/obra, abertura e falha de envio. Conferir que a evidência reaparece após nova sessão. Não estender esse achado aos uploads de outros módulos, que possuem rotinas próprias.

## A08. Dossiê: atalho de pendência da Visão Geral incompleto

Evidência: há botão com alert('Adicionar pendência') em TabVisaoGeral; a aba Pendências possui fluxo próprio com ModalAdicionarPendencia. Fonte: src/dossier-obra.jsx.

Instrução: ligar o atalho ao mesmo modal funcional da aba, evitando implementações paralelas. Validar que a pendência criada aparece na aba e no histórico após recarregamento.

## A09. Inbox: controles foram implementados, mas exigem teste de ponta a ponta

Na sessão ao vivo, Responder, Vincular e a composição de Novo e-mail abriram seus campos. O código também possui envio, vínculo à cotação e sugestão de resposta. Ainda não foi enviado um e-mail de teste nesta rodada, portanto a entrega SMTP, a gravação em Enviados e o vínculo após recarregar continuam pendentes de comprovação.

Instrução: usar destinatário interno de teste e assunto que contenha “Teste TourIII”; confirmar envio, registro em `emails_projeto`, retorno da mensagem e vínculo correto na Linha do Tempo. No mapa de embarques, manter a verificação separada do Inbox.

## A10. Três controles de instalação/pagamento exigem regra única

Evidência: Cronograma usa instalacao_cronograma; o Dossiê possui cronograma/checklist próprio; Pagamentos a Instaladores usa parcelas contratuais. A análise não demonstrou sincronização integral entre os três.

Instrução: definir a fonte oficial de avanço e a de pagamento. Mapear medição → parcela liberada → pagamento registrado, incluindo sinal e marcos. Validar com um contrato de treinamento em quatro pagamentos e dois equipamentos. Se houver independência intencional, explicar a finalidade de cada tela e evitar totais contraditórios.

Fontes: src/entrega.jsx, src/dossier-obra.jsx, src/contrato-instalador-parcelas-store.js.

## A11. Entrega Final: destino fixo e indicador de garantia

Evidência: há transferência específica para Escamax. O KPI Em garantia usa entregas menos transferências, sem verificar nessa expressão a data final de vigência. Fonte: src/handover-manutencao.jsx.

Instrução: revisar a empresa de manutenção conforme o processo atual e permitir a responsável efetivamente indicada/contratada. Calcular garantia com datas e critérios definidos. Confirmar que registrar entrega não atribui à VerticalParts uma equipe própria de manutenção inexistente.

## A12. Remover alocações pode não retirar visibilidade

Evidência: a barra lateral só filtra grupos quando gruposAlocados tem pelo menos um item; lista vazia mantém a exibição padrão. O controle administrativo descreve remoção das alocações como remoção de acesso. Isso pode produzir uma expectativa oposta ao comportamento visual. Fontes: src/shell.jsx e src/colaboradores-admin.jsx.

Instrução: diferenciar sem configuração inicial de acesso explicitamente removido. Validar o resultado da remoção com usuário de teste, inclusive acesso direto às rotas. Não concluir violação de banco apenas a partir da visibilidade do menu.

## A13. Configurações: referências não são parâmetros editáveis

Evidência: ConfigParams apresenta valores fixos no componente e Permissões se identifica como modelo de referência. Integrações informa que não monitora status automaticamente. Fonte: src/financeiro.jsx.

Instrução: manter rótulos honestos ou ligar a persistência à fonte consumida pelos motores. Testar que qualquer parâmetro editável modifica o cálculo esperado. Não anunciar conexão ativa com base apenas em uma linha da lista.

## A14. Dashboard e decisões: falha de carga pode parecer ausência de pendência

Evidência: o Dashboard possui timeout que coloca estruturas vazias; a Central de Decisões captura erro da listagem convertendo-o em lista vazia. Fontes: src/dashboard.jsx e src/decisoes.jsx.

Instrução: distinguir carregando, vazio confirmado e erro/timeout. Incluir tentativa novamente. A tela não deve dizer que ninguém precisa agir quando a consulta falhou.

## A15. Painel de Importação: total de P.I.s em moedas diferentes

Evidência: o painel soma os valores das P.I.s abertas e formata com a moeda da primeira. Fonte: src/gestao-importacao-painel.jsx.

Instrução: agrupar totais por moeda ou converter com taxa e data identificadas. Validar com uma P.I. em USD e outra em EUR para evitar um total enganoso.

## A16. Pontos que ainda exigem inspeção em produção

Não foi possível confirmar: todas as opções dinâmicas dos questionários e campos extensíveis; ordenação visual e responsividade; estados vazios com dados reais; todos os downloads; entrega dos links; assinatura externa; integração Omie, rastreamento e demais serviços; regras efetivas de banco; todas as combinações de perfil; equivalência entre a versão do código e a versão publicada.

Para concluir a homologação da aula, percorrer a lista do apêndice B em produção, abrir pelo menos um registro por tela, expandir cada aba e verificar os estados relevantes. Registrar a versão publicada e as diferenças encontradas. Este documento não declara que essa homologação já aconteceu.


# Apêndice B. Índice de cobertura e rotas

Os caminhos abaixo foram derivados do roteador do código, não verificados por abertura em produção. Cada tela do menu tem capítulo acima. A presença no roteador confirma ligação no código, sem comprovar permissões ou carregamento no ambiente publicado.

| Categoria atual | Tela | Caminho definido pelo código |
| --- | --- | --- |
| Geral | Dashboard | `/geral/dashboard` |
| Geral | Notificações | `/geral/notificacoes` |
| Geral | Central de Decisões | `/geral/decisoes` |
| Geral | Prazos & Pendências | `/adm-financeiro/financeiro` |
| Cadastros Mestres | Clientes | `/cadastros/cadastro-clientes` |
| Cadastros Mestres | Fornecedores | `/cadastros/cadastro-fornecedores` |
| Comercial / Pré-venda | Leads | `/comercial/leads` |
| Comercial / Pré-venda | Formulários | `/comercial/formularios` |
| Comercial / Pré-venda | Controle de Cotações | `/comercial/controle-cotacoes` |
| Comercial / Pré-venda | Cotações a Fornecedor | `/adm-financeiro/cotacoes-fornecedor` |
| Comercial / Pré-venda | Propostas | `/comercial/propostas` |
| Financeiro & Preços | Atualização de Custos | `/cadastros/cadastro-custos` |
| Financeiro & Preços | Precificação | `/comercial/precificacao` |
| Financeiro & Preços | Aval Financeiro | `/adm-financeiro/aval-financeiro` |
| Financeiro & Preços | Comissões | `/adm-financeiro/comissoes` |
| Contratos & Jurídico | Contrato Venda de Equipamentos | `/juridico/contrato-venda-equipamentos` |
| Contratos & Jurídico | Contratos & Minutas | `/juridico/juridico` |
| Suprimentos & Importação | Painel | `/gestao-importacao/gi-painel` |
| Suprimentos & Importação | P.I. | `/gestao-importacao/pi-importacao` |
| Suprimentos & Importação | RFQ | `/gestao-importacao/rfq-importacao` |
| Suprimentos & Importação | IMS | `/gestao-importacao/ims-importacao` |
| Suprimentos & Importação | Embarques | `/gestao-importacao/embarques-importacao` |
| Suprimentos & Importação | Importação | `/gestao-importacao/importacao` |
| Suprimentos & Importação | Análise de Preços | `/gestao-importacao/gi-analise-precos` |
| Suprimentos & Importação | Compras Nacional | `/logistica/compras` |
| Suprimentos & Importação | Pedidos | `/logistica/pedidos-acompanhamento` |
| Engenharia & Produto | Engenharia | `/engenharia/engenharia` |
| Engenharia & Produto | Projeto de Elevadores | `/engenharia/eng-projeto-elevadores` |
| Engenharia & Produto | Projeto de Equipamento | `/engenharia/eng-configurador` |
| Engenharia & Produto | Projetos ER/Es | `/engenharia/desenho-tecnico` |
| Engenharia & Produto | Ficha Técnica | `/engenharia/ficha-tecnica` |
| Engenharia & Produto | Produtos | `/cadastros/ncm-catalogo` |
| Engenharia & Produto | Linha do Tempo da Cotação | `/engenharia/linha-do-tempo` |
| Obras & Instalação | Dossiês de Obras | `/engenharia/status-obras` |
| Obras & Instalação | Vistorias de Obras | `/engenharia/vistorias-envio` |
| Obras & Instalação | Resultado Vistorias de Obras | `/engenharia/vistorias` |
| Obras & Instalação | Instalação em Campo | `/engenharia/instalacao` |
| Obras & Instalação | Cronograma | `/engenharia/cronograma` |
| Obras & Instalação | ART | `/engenharia/art` |
| Entrega & Documentação | Central de Documentos | `/engenharia/central-documentos` |
| Entrega & Documentação | Data Book & Termo | `/engenharia/databook` |
| Entrega & Documentação | Entrega Final | `/engenharia/handover` |
| Parceiros & Instaladores | Empresas Instaladoras | `/cadastros/cadastro-instaladores` |
| Parceiros & Instaladores | Homologação de Instaladores | `/rh/rh-homologacao` |
| Parceiros & Instaladores | Contrato Instalador | `/juridico/contrato-instalador` |
| Parceiros & Instaladores | Pagamentos a Instaladores | `/adm-financeiro/pagamentos-instalador` |
| Logística Interna | Almoxarifado | `/geral/almoxarifado` |
| Administração | Logs de Atividade | `/admin/logs` |
| Administração | Configurações do Sistema | `/admin/configuracoes` |

Cobertura do menu: 12 categorias e 49 telas. As janelas, abas e páginas públicas não estão incluídas nessa contagem.

## Rotas filhas fora do menu

| ID da tela filha | Caminho base no código |
| --- | --- |
| lead-detail | `/comercial/lead-detail` |
| formulario-elevador | `/comercial/formulario-elevador` |
| cotacao-fornecedor-detail | `/comercial/cotacao-fornecedor-detail` |
| proposta-editor | `/comercial/proposta-editor` |
| contrato-editor | `/juridico/contrato-editor` |
| importacao-detail | `/gestao-importacao/importacao-detail` |
| importacao-rastreamento | `/gestao-importacao/importacao-rastreamento` |
| importacao-email | `/gestao-importacao/importacao-email` |
| compras-email | `/logistica/compras-email` |
| ncm-kanban | `/engenharia/ncm-kanban` |
| ncm-detail | `/engenharia/ncm-detail` |
| dossier-obra | `/engenharia/dossier-obra` |

Detalhes podem acrescentar o identificador do registro ao caminho. O Dossiê também permite segmento da aba. Abrir a base de um detalhe sem ID pode redirecionar à lista; esse comportamento não deve ser confundido com uma tela inexistente.

# Apêndice C. Fontes e alcance da análise

Foram obtidos 140 arquivos de interface e lógica em src, além da árvore do repositório e README. A leitura direcionou-se à navegação, controles, condições e serviços associados; não houve auditoria jurídica/fiscal nem teste de escrita em produção. O README ajudou no contexto; a ordem do menu veio de shell.jsx e a ligação de telas veio de app.jsx/router.js.

Para conferir um comportamento ou instruir uma correção, consultar a fonte correspondente. Os links abaixo apontam para main e podem mudar após esta análise; a árvore de referência está registrada no início.

- [src/almoxarifado.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/almoxarifado.jsx)
- [src/analise-tecnica.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/analise-tecnica.jsx)
- [src/assinar-app.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/assinar-app.jsx)
- [src/aval-financeiro-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/aval-financeiro-store.js)
- [src/aval-financeiro.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/aval-financeiro.jsx)
- [src/cadastro-custos-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastro-custos-store.js)
- [src/cadastro-custos.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastro-custos.jsx)
- [src/cadastro-instaladores.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastro-instaladores.jsx)
- [src/cadastros-clientes-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastros-clientes-store.js)
- [src/cadastros-fornecedores-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastros-fornecedores-store.js)
- [src/cadastros.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cadastros.jsx)
- [src/central-documentos-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/central-documentos-store.js)
- [src/central-documentos.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/central-documentos.jsx)
- [src/colaboradores-admin-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/colaboradores-admin-store.js)
- [src/colaboradores-admin.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/colaboradores-admin.jsx)
- [src/comercial.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/comercial.jsx)
- [src/comissionamento-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/comissionamento-store.js)
- [src/contrato-editor.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-editor.jsx)
- [src/contrato-instalador-engine.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-instalador-engine.js)
- [src/contrato-instalador-parcelas-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-instalador-parcelas-store.js)
- [src/contrato-instalador-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-instalador-store.js)
- [src/contrato-instalador.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-instalador.jsx)
- [src/contrato-venda-engine.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-venda-engine.js)
- [src/contrato-venda-preview.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-venda-preview.jsx)
- [src/contrato-venda-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-venda-store.js)
- [src/contrato-venda.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/contrato-venda.jsx)
- [src/controle-cotacoes.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/controle-cotacoes.jsx)
- [src/cotacao-app.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cotacao-app.jsx)
- [src/cotacao-elevador-fornecedor-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cotacao-elevador-fornecedor-store.js)
- [src/cotacao-elevador-fornecedor.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cotacao-elevador-fornecedor.jsx)
- [src/cotacoes-fornecedor.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/cotacoes-fornecedor.jsx)
- [src/dashboard.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/dashboard.jsx)
- [src/decisoes-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/decisoes-store.js)
- [src/decisoes.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/decisoes.jsx)
- [src/desenho-tecnico.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/desenho-tecnico.jsx)
- [src/diario-obra-app.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/diario-obra-app.jsx)
- [src/dossier-obra.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/dossier-obra.jsx)
- [src/dossier-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/dossier-store.js)
- [src/embarques-importacao-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/embarques-importacao-store.js)
- [src/embarques-importacao.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/embarques-importacao.jsx)
- [src/engenharia-config.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/engenharia-config.jsx)
- [src/engenharia-elevador.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/engenharia-elevador.jsx)
- [src/entrega.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/entrega.jsx)
- [src/eventos-fluxo-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/eventos-fluxo-store.js)
- [src/ficha-omie-publish.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ficha-omie-publish.js)
- [src/ficha-tecnica-engine.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ficha-tecnica-engine.js)
- [src/ficha-tecnica-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ficha-tecnica-store.js)
- [src/ficha-tecnica.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ficha-tecnica.jsx)
- [src/ficha-workflow.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ficha-workflow.jsx)
- [src/financeiro.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/financeiro.jsx)
- [src/formulario-elevador-public.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/formulario-elevador-public.jsx)
- [src/formulario-elevador-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/formulario-elevador-store.js)
- [src/formulario-elevador.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/formulario-elevador.jsx)
- [src/gatilhos-engine.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/gatilhos-engine.js)
- [src/gestao-importacao-painel.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/gestao-importacao-painel.jsx)
- [src/handover-manutencao.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/handover-manutencao.js)
- [src/handover-manutencao.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/handover-manutencao.jsx)
- [src/ims-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ims-store.js)
- [src/ims.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ims.jsx)
- [src/linha-do-tempo-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/linha-do-tempo-store.js)
- [src/linha-do-tempo.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/linha-do-tempo.jsx)
- [src/logistica.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/logistica.jsx)
- [src/logs-admin.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/logs-admin.jsx)
- [src/ncm-catalogo.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ncm-catalogo.jsx)
- [src/ncm.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/ncm.jsx)
- [src/notificacoes-lidas-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/notificacoes-lidas-store.js)
- [src/notificacoes-processamento.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/notificacoes-processamento.js)
- [src/omie-pagamentos-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/omie-pagamentos-store.js)
- [src/operacoes.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/operacoes.jsx)
- [src/pagamentos-instalador.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pagamentos-instalador.jsx)
- [src/pedido-fornecedor.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pedido-fornecedor.jsx)
- [src/pedidos-acompanhamento-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pedidos-acompanhamento-store.js)
- [src/pedidos-acompanhamento.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pedidos-acompanhamento.jsx)
- [src/pedidos-varejo-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pedidos-varejo-store.js)
- [src/pi-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pi-store.js)
- [src/pi.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/pi.jsx)
- [src/precificacao-elevador-engine.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/precificacao-elevador-engine.js)
- [src/precificacao-elevador-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/precificacao-elevador-store.js)
- [src/precificacao-elevador.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/precificacao-elevador.jsx)
- [src/precificacao.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/precificacao.jsx)
- [src/projeto-elevador-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/projeto-elevador-store.js)
- [src/proposta-editor.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/proposta-editor.jsx)
- [src/proposta-form.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/proposta-form.jsx)
- [src/proposta-heranca.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/proposta-heranca.js)
- [src/proposta-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/proposta-store.js)
- [src/rfq-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/rfq-store.js)
- [src/rfq.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/rfq.jsx)
- [src/rh-homologacao-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/rh-homologacao-store.js)
- [src/rh-homologacao.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/rh-homologacao.jsx)
- [src/shell.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/shell.jsx)
- [src/status-obra-app.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/status-obra-app.jsx)
- [src/supabase.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/supabase.js)
- [src/termo-entrega-app.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/termo-entrega-app.jsx)
- [src/tratativas-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/tratativas-store.js)
- [src/vistoria-execucao.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vistoria-execucao.jsx)
- [src/vistorias-envio.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vistorias-envio.jsx)
- [src/vistorias-obras.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vistorias-obras.jsx)
- [src/vistorias-questionarios-store.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vistorias-questionarios-store.js)
- [src/vp-copiloto.jsx](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vp-copiloto.jsx)
- [src/vp-log.js](https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/vp-log.js)

## Critério de conclusão da validação ao vivo

Uma tela entra como validada quando a rota abre, o título e a finalidade aparecem, os controles visíveis foram inventariados, pelo menos um caminho filho foi aberto e a origem/destino dos dados foi conferida no código. Um efeito de negócio só entra como confirmado quando houve sinal visual de sucesso e posterior leitura do registro. Quando isso não ocorreu, o texto usa “previsto”, “exige validação” ou “não comprovado”.

## Checklist de limpeza pós-aula

Antes de apagar, pesquise cada identificador exatamente como aparece no registro de validação. Exclua ou inative o cliente e o Lead somente depois de verificar que não ganharam vínculos adicionais. Remova o rascunho `VPCT-0956` pelo Controle de Cotações e confira se a unidade `VPEL-EL0956-1` desapareceu do formulário. Na Inbox, não exclua mensagens reais apenas porque contêm a palavra “Teste”; separe os testes de e-mail dos recebimentos existentes.
