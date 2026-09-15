Título: Checklist de Auditoria Guiada para Claude Code — VP Gestão / 010_GestaoImportacao

Objetivo

Orientar o Claude Code a entrar no repositório `verticalpartsIA/010_GestaoImportacao`, analisar o código real, marcar acertos e erros por evidência, e nunca afirmar que algo existe sem apontar o arquivo, a rota, o componente, a store, a função ou o trecho correspondente.

Regra principal

- [ ] Não afirmar “existe”, “funciona”, “está integrado”, “herda”, “bloqueia” ou “salva” sem evidência direta no código.
- [ ] Toda conclusão deve conter pelo menos uma evidência objetiva: arquivo, componente, função, rota, store, tabela Supabase, evento, botão, condição, importação de script ou comentário técnico.
- [ ] Quando houver intenção documentada, mas não houver implementação, marcar como “Planejado / Documentado, mas não comprovado no código”.
- [ ] Quando houver tela visual, mas sem persistência real, marcar como “UI presente, persistência não comprovada”.
- [ ] Quando houver store, mas sem uso em tela, marcar como “Lógica existente, integração visual não comprovada”.
- [ ] Quando houver rota no `app.jsx`, mas não houver item na sidebar, marcar como “Rota interna / detalhe / deep link”.
- [ ] Quando houver item na sidebar, mas sem rota real ou marcado como `planned`, marcar como “Menu planejado, não funcional”.
- [ ] Nunca inventar módulos, tabelas, relacionamentos, automações ou permissões.

Fontes obrigatórias de leitura

- [ ] Ler `README.md` para entender a visão de negócio, macroetapas, fontes de verdade, gates, Master ID e Dossiê da Obra. O README define que o VP Gestão representa o ciclo empresarial da VerticalParts, do lead ao handover. 
- [ ] Ler `src/shell.jsx` para extrair a hierarquia real da sidebar, grupos, subgrupos, itens planejados, restrições por perfil e navegação visível. O arquivo mostra os grupos Geral, Cadastros, Comercial, ADM/Financeiro, Jurídico | Importação | Suprimentos, Engenharia, Logística e Portal Admin. 
- [ ] Ler `src/app.jsx` para confirmar as rotas renderizadas, componentes associados, deep links, rotas de detalhe, fallback e restrições de acesso. O roteamento confirma telas como Dashboard, Leads, Formulários, Dossiê, Cotações, Precificação, Propostas, Engenharia, Jurídico, Importação, Compras, Financeiro, RH, Almoxarifado, P.I., RFQ, IMS, Embarques, Cadastros, Logs e Configurações. 
- [ ] Ler `index.html` para confirmar a ordem de carregamento dos scripts, dependências, stores, engines, componentes JSX, Supabase, PDF, copilotos e módulos transversais. 
- [ ] Ler `FluxogramaPortal.md` para validar o fluxo operacional ponta a ponta, principalmente compra, P.I., produção, RFQ, embarque, vistoria, homologação, instalação, Data Book e entrega. O fluxograma mostra, por exemplo, que vistoria e contratação de instalador podem rodar em paralelo ao trânsito marítimo. 

Formato obrigatório da resposta do Claude Code

- [ ] Para cada módulo, gerar uma tabela com estas colunas:
  - Módulo
  - Submódulo / Rota
  - Arquivo principal
  - Store / Engine
  - Dado que recebe
  - Dado que entrega
  - Acertos encontrados
  - Erros / riscos encontrados
  - Evidência no código
  - Status: Confirmado / Parcial / Planejado / Quebrado / Não encontrado

Critérios de classificação

- [ ] Confirmado: existe rota, componente, item de menu ou fluxo, e há evidência de uso real.
- [ ] Parcial: existe parte da tela ou lógica, mas falta integração, persistência, validação ou navegação.
- [ ] Planejado: aparece como intenção, comentário, item `planned`, documentação ou placeholder.
- [ ] Quebrado: há rota, componente ou store, mas existe erro claro de referência, ausência de dependência, função indefinida, fallback indevido, tabela removida ou fluxo impossível.
- [ ] Não encontrado: o checklist esperava verificar, mas o código não possui evidência suficiente.

Checklist geral de arquitetura

- [ ] Confirmar se a sidebar em `shell.jsx` representa todos os módulos realmente existentes.
- [ ] Confirmar se toda rota visível na sidebar possui `case` correspondente em `app.jsx`.
- [ ] Confirmar se toda rota em `app.jsx` possui componente carregado no `index.html`.
- [ ] Confirmar se todo componente carregado no `index.html` é usado por alguma rota, modal, store ou tela.
- [ ] Identificar componentes órfãos.
- [ ] Identificar stores órfãs.
- [ ] Identificar rotas órfãs.
- [ ] Identificar itens de menu sem rota.
- [ ] Identificar rotas sem item de menu.
- [ ] Identificar telas que dependem de `window.AlgumaCoisaPage` e verificar se essa variável global é realmente definida.
- [ ] Verificar se cada módulo tem fonte de dados clara: Supabase, localStorage, mock, store em memória, arquivo estático ou engine.
- [ ] Separar dados reais de dados demonstrativos.
- [ ] Marcar qualquer mock como risco, se estiver sendo usado em fluxo que deveria ser produtivo.

Checklist de navegação e rotas

- [ ] Listar todas as chaves de `ROUTE_TITLE` em `app.jsx`.
- [ ] Listar todos os `case` do `renderPage`.
- [ ] Listar todos os `id` de `NAV_GROUPS` em `shell.jsx`.
- [ ] Cruzar `ROUTE_TITLE` x `renderPage` x `NAV_GROUPS`.
- [ ] Marcar rotas que existem em `ROUTE_TITLE`, mas não aparecem no `renderPage`.
- [ ] Marcar rotas que aparecem no `renderPage`, mas não aparecem em `ROUTE_TITLE`.
- [ ] Marcar rotas que aparecem no menu, mas não aparecem no `renderPage`.
- [ ] Marcar rotas internas de detalhe, como `lead-detail`, `cotacao-fornecedor-detail`, `contrato-editor`, `importacao-detail`, `dossier-obra`, quando não forem itens diretos da sidebar.
- [ ] Validar `SYNC_PASSTHROUGH_ROUTES`.
- [ ] Validar `ASYNC_FETCH_ROUTES`.
- [ ] Validar `WRAPPED_ID_KEY`.
- [ ] Validar `SUBSEL_FALLBACK_ROUTE`.
- [ ] Verificar se os deep links carregam o registro correto por ID.
- [ ] Marcar qualquer rota de detalhe que dependa de tabela inexistente ou removida.

Checklist de permissões e perfis

- [ ] Ler `ROLE_MAP` em `shell.jsx`.
- [ ] Ler `RESTRICTED` em `app.jsx`.
- [ ] Verificar se as restrições da sidebar batem com as restrições do roteamento.
- [ ] Confirmar se `precificacao`, `financeiro`, `comissoes`, `logs` e `configuracoes` estão protegidos corretamente.
- [ ] Marcar erro se uma rota restrita puder ser acessada por deep link sem bloqueio.
- [ ] Verificar se `configuracoes` controla alocação de módulos por colaborador.
- [ ] Verificar se `gruposAlocados` realmente filtra a sidebar.
- [ ] Confirmar se “Geral” fica sempre visível.
- [ ] Marcar risco se houver permissão apenas visual, mas não houver bloqueio no roteamento ou no banco.

Checklist do Dashboard

- [ ] Confirmar se a rota `dashboard` chama `Dashboard`.
- [ ] Verificar arquivos de métricas carregados no `index.html`: comercial, engenharia, financeiro, gantt e admin.
- [ ] Confirmar se o dashboard muda por perfil.
- [ ] Verificar se os KPIs vêm de dados reais ou mocks.
- [ ] Marcar como acerto se o dashboard consolidar dados de múltiplos módulos.
- [ ] Marcar como erro se o dashboard apresentar número sem fonte rastreável.
- [ ] Verificar se cards do dashboard navegam para rotas operacionais.
- [ ] Verificar se há diferença entre dashboard executivo e dashboard operacional.

Checklist de Notificações

- [ ] Confirmar rota `notificacoes`.
- [ ] Verificar `notificacoes-processamento.js`.
- [ ] Verificar `notificacoes-lidas-store.js`.
- [ ] Confirmar origem dos eventos que geram notificações.
- [ ] Verificar se notificações apenas avisam ou se também executam ações.
- [ ] Marcar erro se uma notificação estiver sendo usada como decisão formal.
- [ ] Verificar se existe controle de lida/não lida.
- [ ] Verificar se existe vínculo da notificação com módulo, registro e rota.

Checklist da Central de Decisões

- [ ] Confirmar rota `decisoes`.
- [ ] Verificar `decisoes-store.js`.
- [ ] Verificar `decisoes.jsx`.
- [ ] Identificar quais módulos criam decisões.
- [ ] Verificar se decisões possuem responsável, status, motivo e data.
- [ ] Confirmar se decisões pendentes aparecem com badge na sidebar.
- [ ] Marcar acerto se decisões humanas estiverem separadas de notificações.
- [ ] Marcar erro se decisão crítica estiver automática sem evidência de regra.
- [ ] Verificar se decisão aprovada realmente libera algum gate.
- [ ] Verificar se decisão reprovada gera retorno de fluxo.

Checklist de Gatilhos & Prazo

- [ ] Confirmar rota `financeiro`.
- [ ] Verificar `gatilhos-engine.js`.
- [ ] Verificar `financeiro.jsx`.
- [ ] Identificar eventos que nascem automaticamente.
- [ ] Identificar eventos que fecham automaticamente.
- [ ] Verificar se há prazo reverso.
- [ ] Verificar se há vencimento, alerta e status.
- [ ] Marcar erro se prazo for apenas texto visual sem cálculo.
- [ ] Verificar integração com proposta, contrato, P.I., pagamento e embarque.
- [ ] Confirmar se o módulo é restrito a financeiro/admin.

Checklist de Cadastros — Clientes

- [ ] Confirmar rota `cadastro-clientes`.
- [ ] Verificar `cadastros-clientes-store.js`.
- [ ] Verificar `cadastros.jsx`.
- [ ] Verificar se cliente é usado em lead, proposta, contrato e obra.
- [ ] Verificar se há validação de documento, e-mail, telefone e endereço.
- [ ] Marcar erro se houver cadastro duplicado sem regra de prevenção.
- [ ] Marcar acerto se cliente for fonte de verdade transversal.
- [ ] Verificar se alteração de cliente propaga ou não propaga para documentos já emitidos.

Checklist de Cadastros — Fornecedores

- [ ] Confirmar rota `cadastro-fornecedores`.
- [ ] Verificar `cadastros-fornecedores-store.js`.
- [ ] Verificar uso em cotação a fornecedor, P.I., RFQ, IMS e pedidos.
- [ ] Verificar campos de contato, categoria, origem, moeda, país e avaliação.
- [ ] Marcar erro se fornecedor for digitado livremente em outro módulo sem vínculo ao cadastro.
- [ ] Marcar acerto se fornecedor for reutilizado em múltiplas etapas.
- [ ] Verificar se há Supplier Scorecard real ou apenas intenção futura.

Checklist de Cadastros — Produtos

- [ ] Confirmar rota `ncm-catalogo`.
- [ ] Verificar `ncm.jsx`, `ncm-catalogo.jsx` e `ncm-data.js`.
- [ ] Verificar relação entre produto, NCM, DUIMP, ficha técnica e pedido a fornecedor.
- [ ] Verificar se produtos alimentam proposta, contrato, P.I. e ficha.
- [ ] Marcar erro se NCM aparecer desconectado do produto.
- [ ] Marcar erro se houver tabela morta ou comentário indicando tabela removida.
- [ ] Marcar acerto se catálogo for fonte de verdade técnica/fiscal.

Checklist de Leads

- [ ] Confirmar rota `leads`.
- [ ] Confirmar rota de detalhe `lead-detail`.
- [ ] Verificar componente `comercial.jsx`.
- [ ] Verificar store ou integração Supabase para `leads`.
- [ ] Verificar campos mínimos: empreendimento, contato, equipamento, quantidade, origem, responsável, prioridade, valor estimado e próxima ação.
- [ ] Verificar se Lead gera formulário.
- [ ] Verificar se Lead gera cotação.
- [ ] Verificar se Lead gera proposta.
- [ ] Marcar erro se Lead não tiver transição clara para próxima etapa.
- [ ] Marcar acerto se o detalhe do Lead preserva contexto para o fluxo comercial.

Checklist de Formulários

- [ ] Confirmar rota `formularios`.
- [ ] Confirmar rota `formulario-elevador`.
- [ ] Verificar `formulario-elevador-store.js`.
- [ ] Verificar `formulario-elevador.jsx`.
- [ ] Verificar se formulário herda dados do Lead.
- [ ] Verificar se formulário doa dados para cotação, engenharia e proposta.
- [ ] Verificar se múltiplos equipamentos são individualizáveis.
- [ ] Verificar se há validação por tipo de equipamento.
- [ ] Marcar erro se formulário permitir especificação fictícia ou incompleta.
- [ ] Marcar erro se formulário salva localmente, mas não persiste no Supabase quando deveria.
- [ ] Marcar acerto se o formulário reduz redigitação.

Checklist de Controle de Cotações

- [ ] Confirmar rota `controle-cotacoes`.
- [ ] Verificar `controle-cotacoes.jsx`.
- [ ] Verificar se agrupa histórico por número de cotação.
- [ ] Verificar se se conecta a formulário de elevador.
- [ ] Verificar se se conecta a cotação a fornecedor.
- [ ] Verificar se se conecta a proposta.
- [ ] Marcar erro se o controle for apenas uma lista visual sem vínculo entre registros.
- [ ] Marcar acerto se permitir rastreabilidade de cotação.

Checklist de Cotações a Fornecedor

- [ ] Confirmar rota `cotacoes-fornecedor`.
- [ ] Confirmar rota `cotacao-fornecedor-detail`.
- [ ] Verificar `cotacao-elevador-fornecedor-store.js`.
- [ ] Verificar `cotacoes-fornecedor.jsx`.
- [ ] Verificar `tratativas-store.js`.
- [ ] Verificar se herda produto, formulário, fornecedor e número de cotação.
- [ ] Verificar se doa preço base para precificação.
- [ ] Verificar se há anexos e tratativas.
- [ ] Verificar se há status de envio, resposta, revisão e vencedor.
- [ ] Marcar erro se o fornecedor for texto livre sem ID.
- [ ] Marcar erro se cotação respondida não alimentar precificação.
- [ ] Marcar acerto se tratativas preservam histórico.

Checklist de Precificação

- [ ] Confirmar rota `precificacao`.
- [ ] Verificar `precificacao.jsx`.
- [ ] Verificar `precificacao-elevador-engine.js`.
- [ ] Verificar `precificacao-elevador-store.js`.
- [ ] Verificar `difal-engine.js`.
- [ ] Verificar se herda cotação a fornecedor.
- [ ] Verificar se calcula custo, câmbio, tributo, DIFAL, serviços, instalação, markup, comissão e margem.
- [ ] Verificar se cálculo e aprovação são estados separados.
- [ ] Marcar erro se houver cálculo sem persistência.
- [ ] Marcar erro se campos fiscais forem manuais sem validação.
- [ ] Marcar acerto se preço final puder alimentar proposta.

Checklist de Propostas

- [ ] Confirmar rota `propostas`.
- [ ] Confirmar rota `proposta-editor`.
- [ ] Verificar `proposta-store.js`.
- [ ] Verificar `proposta-heranca.js`.
- [ ] Verificar `proposta-form.jsx`.
- [ ] Verificar `proposta-preview.jsx`.
- [ ] Verificar `proposta-editor.jsx`.
- [ ] Verificar `proposta-reactpdf.bundle.js`.
- [ ] Verificar se a proposta herda lead, formulário, cotação, preço, imagens e especificações.
- [ ] Verificar se a proposta doa dados para contrato, decisão e aval financeiro.
- [ ] Verificar se há preview fiel ao PDF.
- [ ] Verificar se há risco de distorção de PDF, imagem ausente ou layout quebrado.
- [ ] Marcar erro se proposta permitir editar dados técnicos sem rastreio.
- [ ] Marcar acerto se há herança estruturada para evitar redigitação.

Checklist do Jurídico

- [ ] Confirmar rota `juridico`.
- [ ] Confirmar rota `contrato-editor`.
- [ ] Verificar `contrato-editor.jsx`.
- [ ] Verificar se jurídico herda proposta aprovada.
- [ ] Verificar se contrato herda cliente, objeto, preço e condições.
- [ ] Verificar se há status de minuta, revisão, assinatura e conclusão.
- [ ] Verificar se contrato assinado libera P.I. ou compra.
- [ ] Marcar erro se contrato puder ser criado sem proposta ou sem cliente.
- [ ] Marcar erro se assinatura for apenas visual.
- [ ] Marcar acerto se contrato for gate real.

Checklist de Contrato Venda de Equipamentos

- [ ] Confirmar rota `contrato-venda-equipamentos`.
- [ ] Verificar `contrato-venda-engine.js`.
- [ ] Verificar `contrato-venda-store.js`.
- [ ] Verificar `contrato-venda-preview.jsx`.
- [ ] Verificar `contrato-venda.jsx`.
- [ ] Verificar se herda proposta ou Master ID.
- [ ] Verificar se conduz comprador, objeto, logística, preço e condições.
- [ ] Verificar se gera documento final.
- [ ] Verificar se status assinado é usado como gate.
- [ ] Marcar erro se contrato não estiver vinculado ao fluxo da P.I.
- [ ] Marcar acerto se o contrato mantém rastreabilidade por proposta/equipamento.

Checklist de Contrato Instalador

- [ ] Confirmar rota `contrato-instalador`.
- [ ] Verificar `contrato-instalador-engine.js`.
- [ ] Verificar `contrato-instalador-store.js`.
- [ ] Verificar `contrato-instalador-preview.jsx`.
- [ ] Verificar `contrato-instalador.jsx`.
- [ ] Verificar se herda instalador homologado, obra e equipamentos.
- [ ] Verificar se permite seleção granular de ativos.
- [ ] Verificar se um instalador pode ser contratado para parte da proposta.
- [ ] Verificar se contrato de instalador alimenta instalação.
- [ ] Marcar erro se contrato puder selecionar instalador não homologado sem alerta.
- [ ] Marcar acerto se separar contrato do cliente e contrato do prestador.

Checklist de Aval Financeiro

- [ ] Confirmar rota `aval-financeiro`.
- [ ] Verificar `aval-financeiro-store.js`.
- [ ] Verificar `aval-financeiro.jsx`.
- [ ] Verificar se herda contrato, proposta, sinal, preço e condições.
- [ ] Verificar se doa liberação para compra.
- [ ] Verificar se existe status aprovado/reprovado/pendente.
- [ ] Verificar se reprovação volta para proposta, preço ou decisão.
- [ ] Marcar erro se P.I. puder ser criada sem aval quando regra exige aval.
- [ ] Marcar acerto se o financeiro atua como proteção de caixa.

Checklist de P.I. — Proforma Invoice

- [ ] Confirmar rota `pi-importacao`.
- [ ] Verificar `pi-store.js`.
- [ ] Verificar `pi.jsx`.
- [ ] Verificar se P.I. herda contrato assinado, sinal pago, aval financeiro e aprovação.
- [ ] Verificar se P.I. contém fornecedor, Incoterm, itens, NCM, valores, pagamentos, câmbio, produção, cargo ready, anexos e vínculo com embarque.
- [ ] Verificar se P.I. bloqueia salvamento quando gate não satisfeito.
- [ ] Verificar se P.I. doa dados para produção, pagamento, RFQ e embarque.
- [ ] Marcar erro se P.I. puder nascer sem fornecedor válido.
- [ ] Marcar erro se P.I. não se vincular a embarque.
- [ ] Marcar acerto se P.I. for a fonte financeira da compra.

Checklist de RFQ

- [ ] Confirmar rota `rfq-importacao`.
- [ ] Verificar `rfq-store.js`.
- [ ] Verificar `rfq.jsx`.
- [ ] Verificar se RFQ permite múltiplos fornecedores.
- [ ] Verificar se RFQ permite múltiplas moedas.
- [ ] Verificar se RFQ permite escolha de vencedor por item ou global.
- [ ] Verificar se RFQ serve frete, compra ou ambos.
- [ ] Verificar se RFQ alimenta análise de preços.
- [ ] Marcar erro se vencedor não for persistido.
- [ ] Marcar acerto se RFQ transformar sourcing em histórico reutilizável.

Checklist de IMS

- [ ] Confirmar rota `ims-importacao`.
- [ ] Verificar `ims-store.js`.
- [ ] Verificar `ims.jsx`.
- [ ] Verificar se IMS controla transporte, munck, empilhadeira, andaime, mão de obra e recursos.
- [ ] Verificar se IMS herda dados de obra, carga, peso, embarque e local de entrega.
- [ ] Verificar se IMS doa recursos para retirada, descarga e instalação.
- [ ] Marcar erro se recurso crítico for apenas anotação sem fornecedor, data ou custo.
- [ ] Marcar acerto se IMS antecipa recursos durante trânsito marítimo.

Checklist de Embarques

- [ ] Confirmar rota `embarques-importacao`.
- [ ] Confirmar rota `importacao`.
- [ ] Confirmar rota `importacao-detail`.
- [ ] Verificar `embarques-importacao-store.js`.
- [ ] Verificar `embarques-importacao.jsx`.
- [ ] Verificar se herda P.I., fornecedor, carga, frete e containers.
- [ ] Verificar se controla ETD original, ETD atual, ETA, rolagens, free time, aduana, NF-e, entrega e devolução de container.
- [ ] Verificar se atraso de embarque atualiza dashboard, notificações, dossiê ou cronograma.
- [ ] Verificar se detalhe de embarque busca registro por ID no Supabase.
- [ ] Marcar erro se dados de embarque ficarem desconectados da P.I.
- [ ] Marcar acerto se rolagens ficarem no histórico.

Checklist de Rastreamento de Navios

- [ ] Confirmar rota `importacao-rastreamento`.
- [ ] Verificar componente `ImportacaoRastreamento`.
- [ ] Verificar se usa AIS real, simulação ou dados manuais.
- [ ] Marcar claramente “simulado” quando não houver AIS real.
- [ ] Verificar se há vínculo com embarque, navio, BL, container ou IMO.
- [ ] Marcar erro se mapa mostrar posição sem fonte confiável.
- [ ] Marcar acerto se rastreamento for contextual e não apenas decorativo.

Checklist de Compras Nacional

- [ ] Confirmar rota `compras`.
- [ ] Verificar `compras-email` se existir fluxo de inbox.
- [ ] Verificar se compras nacionais ficam separadas de importação.
- [ ] Verificar se herda fornecedor nacional e pedido.
- [ ] Verificar se doa pedido, status, recebimento ou custo.
- [ ] Marcar erro se compras nacionais reutilizarem lógica internacional sem distinção fiscal/logística.
- [ ] Marcar acerto se houver separação clara entre nacional e importado.

Checklist de Pedidos

- [ ] Confirmar rota `pedidos-acompanhamento`.
- [ ] Verificar `pedidos-acompanhamento-store.js`.
- [ ] Verificar `pedidos-acompanhamento.jsx`.
- [ ] Verificar `pedido-fornecedor-engine.js`.
- [ ] Verificar `pedido-fornecedor-store.js`.
- [ ] Verificar `pedido-fornecedor.jsx`.
- [ ] Verificar se pedido herda produto, fornecedor, preço e idioma.
- [ ] Verificar se pedido gera PDF ou documento bilíngue.
- [ ] Verificar se pedido alimenta acompanhamento.
- [ ] Marcar erro se pedido não tiver status operacional.
- [ ] Marcar acerto se pedido formaliza RFQ/compra com fornecedor.

Checklist de Engenharia

- [ ] Confirmar rota `engenharia`.
- [ ] Verificar `operacoes.jsx` e componentes relacionados.
- [ ] Verificar se engenharia herda formulário, proposta, contrato ou dossiê.
- [ ] Verificar se doa projeto, BOM, ficha, laudo e gates.
- [ ] Verificar se há rastreabilidade entre projeto e número da cotação.
- [ ] Marcar erro se engenharia criar especificação divergente da proposta sem alerta.
- [ ] Marcar acerto se engenharia alimenta importação e obra.

Checklist de Projeto de Elevadores

- [ ] Confirmar rota `eng-projeto-elevadores`.
- [ ] Verificar `projeto-elevador-store.js`.
- [ ] Verificar `engenharia-elevador.jsx`.
- [ ] Verificar campos de poço, cabine, porta, paradas, acionamento, máquina, acesso e dimensões.
- [ ] Verificar se herda formulário de elevador.
- [ ] Verificar se doa dados para ficha técnica, contrato, proposta e BOM.
- [ ] Marcar erro se dimensões forem apenas visuais sem validação.
- [ ] Marcar acerto se projeto se correlaciona por número de cotação.

Checklist de Projeto de Equipamento

- [ ] Confirmar rota `eng-configurador`.
- [ ] Verificar `engenharia-config.jsx`.
- [ ] Verificar se atende elevador, escada rolante e esteira rolante.
- [ ] Verificar se transforma requisitos em especificação concreta.
- [ ] Verificar se doa BOM, ficha, proposta, contrato e projeto.
- [ ] Marcar erro se configurador não persistir configuração.
- [ ] Marcar acerto se reduz ambiguidades técnicas.

Checklist de Projetos ER/ES

- [ ] Confirmar rota `desenho-tecnico`.
- [ ] Verificar `desenho-tecnico.jsx`.
- [ ] Verificar se atende Escada Rolante e Esteira Rolante.
- [ ] Verificar se há desenho técnico, medidas e exportação.
- [ ] Verificar se herda dados do formulário ou projeto.
- [ ] Marcar erro se desenho não se vincular ao equipamento.
- [ ] Marcar acerto se projeto ER/ES tem tela própria.

Checklist de Ficha Técnica

- [ ] Confirmar rota `ficha-tecnica`.
- [ ] Verificar `ficha-tecnica-engine.js`.
- [ ] Verificar `ficha-tecnica-store.js`.
- [ ] Verificar `ficha-tecnica-imagens.js`.
- [ ] Verificar `ficha-omie-publish.js`.
- [ ] Verificar `ficha-tecnica.jsx`.
- [ ] Verificar `ficha-tecnica-copiloto.jsx`.
- [ ] Verificar se ficha herda produto, NCM, engenharia, imagem e desenho.
- [ ] Verificar se ficha doa identidade técnica/fiscal para proposta, contrato, pedido e importação.
- [ ] Verificar se gera PDF em 1 página quando prometido.
- [ ] Verificar se publicação Omie é real ou apenas preparada.
- [ ] Marcar erro se ficha técnica permite categoria sem template válido.
- [ ] Marcar acerto se a ficha atua como fonte técnica/fiscal.

Checklist de Dossiê da Obra

- [ ] Confirmar rota `dossier-obra`.
- [ ] Verificar `dossier-store.js`.
- [ ] Verificar `dossier-obra.jsx`.
- [ ] Verificar se dossiê herda contrato, cliente, proposta, projeto, vistorias, instalação e embarque.
- [ ] Verificar se doa prontuário, pendências, cronograma, documentos e status.
- [ ] Verificar se Dossiê é entidade própria, diferente de Master ID.
- [ ] Verificar se status mestre está implementado ou apenas documentado.
- [ ] Marcar erro se dossiê não persistir histórico.
- [ ] Marcar acerto se dossiê centraliza a obra.

Checklist de Status de Obras

- [ ] Confirmar rota `status-obras`.
- [ ] Verificar componente `ObrasStatusPage`.
- [ ] Verificar se status vem do dossiê, instalação, vistorias, importação e contrato.
- [ ] Verificar se status é calculado ou manual.
- [ ] Verificar se status permite navegar para Dossiê.
- [ ] Marcar erro se status mostrado não tiver origem.
- [ ] Marcar acerto se status mestre resume a progressão do negócio.

Checklist de Vistorias de Obras

- [ ] Confirmar rota `vistorias`.
- [ ] Verificar `vistorias-obras.jsx`.
- [ ] Verificar se vistorias são fonte única de verdade.
- [ ] Verificar se aparecem tanto no menu quanto dentro do Dossiê.
- [ ] Verificar se há fase, tipo, vistoriador, custo, observações, documentos, imagens e status.
- [ ] Verificar se vistorias podem liberar ou bloquear obra.
- [ ] Marcar erro se houver vistorias duplicadas em tabelas diferentes.
- [ ] Marcar acerto se vistoria consolidada alimenta Dossiê e Instalação.

Checklist de Homologação de Parceiros

- [ ] Confirmar rota `rh-homologacao`.
- [ ] Verificar `rh-homologacao-store.js`.
- [ ] Verificar `rh-homologacao.jsx`.
- [ ] Verificar documentos NR-10, NR-35, ASO, PCMSO e PGR.
- [ ] Verificar diferença entre homologação geral e vínculo à obra.
- [ ] Verificar se homologação bloqueia contrato ou instalação.
- [ ] Marcar erro se instalador não homologado puder iniciar obra.
- [ ] Marcar acerto se RH atua como gate operacional.

Checklist de Instalação em Campo

- [ ] Confirmar rota `instalacao`.
- [ ] Verificar `instalacao-obra-store.js`.
- [ ] Verificar `instalacao-checklist-store.js`.
- [ ] Verificar se instalação herda contrato assinado, pagamento liberado, projeto recebido, obra liberada e instalador vinculado.
- [ ] Verificar se controla recebimento do equipamento, equipe, cronograma, pendências e testes.
- [ ] Verificar se há checklist técnico.
- [ ] Marcar erro se instalação puder iniciar sem gate.
- [ ] Marcar acerto se instalação é resultado de contrato, engenharia, RH e importação.

Checklist de ART

- [ ] Confirmar rota `art`.
- [ ] Verificar `entrega.jsx` ou componente correspondente.
- [ ] Verificar se ART herda projeto aprovado e obra.
- [ ] Verificar se ART doa documento legal para Data Book e Handover.
- [ ] Verificar se ART pode ser antecipada antes do equipamento chegar.
- [ ] Marcar erro se ART for apenas checkbox sem documento.
- [ ] Marcar acerto se ART participa do encerramento técnico/legal.

Checklist de Cronograma

- [ ] Confirmar rota `cronograma`.
- [ ] Verificar componente `CronogramaPage`.
- [ ] Verificar se cronograma herda embarque, obra, instalação e pendências.
- [ ] Verificar se atraso de embarque altera cronograma.
- [ ] Verificar se há datas planejadas, reais e reprogramadas.
- [ ] Marcar erro se cronograma for estático.
- [ ] Marcar acerto se cronograma conversa com Dossiê e Instalação.

Checklist de Data Book & Termo

- [ ] Confirmar rota `databook`.
- [ ] Verificar `data-book-store.js`.
- [ ] Verificar `entrega.jsx`.
- [ ] Verificar se Data Book herda ART, instalação, testes, documentos e manuais.
- [ ] Verificar se doa memória documental para Handover.
- [ ] Verificar se exige evidências antes do termo.
- [ ] Marcar erro se equipamento funcionando encerrar contrato sem Data Book.
- [ ] Marcar acerto se Data Book separa conclusão física de conclusão contratual.

Checklist de Handover / Entrega Final

- [ ] Confirmar rota `handover`.
- [ ] Verificar `handover-manutencao.js`.
- [ ] Verificar `handover-manutencao.jsx`.
- [ ] Verificar se herda Data Book, ART, testes, treinamento e aceite.
- [ ] Verificar se doa transição para manutenção/pós-venda.
- [ ] Verificar se há termo de entrega assinado.
- [ ] Verificar se garantia e suporte são comunicados.
- [ ] Marcar erro se entrega final não exige aceite.
- [ ] Marcar acerto se handover encerra ciclo com documentação.

Checklist de Almoxarifado

- [ ] Confirmar rota `almoxarifado`.
- [ ] Verificar `almoxarifado.jsx`.
- [ ] Verificar se controla estoque, materiais, itens e movimentações.
- [ ] Verificar se se conecta a IMS, instalação ou compras.
- [ ] Verificar se há entrada, saída, saldo e responsável.
- [ ] Marcar erro se estoque for apenas visual.
- [ ] Marcar acerto se almoxarifado apoia logística e instalação.

Checklist de Expedição e Logística planejadas

- [ ] Verificar em `shell.jsx` se Expedição está marcada como `planned`.
- [ ] Verificar em `shell.jsx` se Logística está marcada como `planned`.
- [ ] Não declarar esses módulos como funcionais.
- [ ] Marcar como “Planejado”.
- [ ] Verificar se há arquivos futuros ou placeholders.
- [ ] Sugerir implementação somente depois de confirmar ausência de rota funcional.

Checklist de Logs de Atividade

- [ ] Confirmar rota `logs`.
- [ ] Verificar `vp-log.js`.
- [ ] Verificar `logs-admin.jsx`.
- [ ] Verificar se registra usuário, ação, data, objeto e módulo.
- [ ] Verificar se ações críticas geram log.
- [ ] Verificar se logs são restritos a admin.
- [ ] Marcar erro se log depender apenas de console.
- [ ] Marcar acerto se logs forem auditoria real.

Checklist de Configurações do Sistema

- [ ] Confirmar rota `configuracoes`.
- [ ] Verificar `ConfiguracoesPage`.
- [ ] Verificar se configurações controlam perfil, módulos, grupos ou parâmetros.
- [ ] Verificar se configurações influenciam sidebar, permissões ou comportamento.
- [ ] Verificar se há persistência real.
- [ ] Marcar erro se configuração visual não altera nada.
- [ ] Marcar acerto se configurações governam acesso por colaborador.

Checklist de Copiloto VP

- [ ] Verificar `vp-copiloto.jsx`.
- [ ] Verificar se o copiloto aparece globalmente.
- [ ] Confirmar exceção da Ficha Técnica, onde existe copiloto próprio.
- [ ] Verificar se copiloto apenas orienta ou se executa ações.
- [ ] Verificar se ações do copiloto são auditadas.
- [ ] Marcar erro se copiloto altera dados sem confirmação.
- [ ] Marcar acerto se copiloto ajuda preenchimento e revisão com contexto.

Checklist de PDF e documentos

- [ ] Verificar `proposta-reactpdf.bundle.js`.
- [ ] Verificar `pedido-fornecedor-reactpdf.bundle.js`.
- [ ] Verificar uso de jsPDF e html2canvas para ficha técnica.
- [ ] Verificar se PDFs mantêm imagens, logotipo, layout e paginação.
- [ ] Verificar se há diferença entre preview e PDF final.
- [ ] Marcar erro se PDF distorce, perde imagens ou corta conteúdo.
- [ ] Marcar erro se PDF depende de CDN instável sem fallback.
- [ ] Marcar acerto se PDF for gerado por engine estruturada.

Checklist de Supabase e persistência

- [ ] Verificar `supabase.js`.
- [ ] Listar todas as tabelas acessadas por `.from("...")`.
- [ ] Cruzar cada tabela com o módulo correspondente.
- [ ] Verificar se operações possuem tratamento de erro.
- [ ] Verificar se operações possuem fallback indevido para mock.
- [ ] Verificar se inserts/updates usam IDs reais.
- [ ] Verificar se há uso de `maybeSingle()` e fallback.
- [ ] Marcar erro se uma tela promete salvar, mas não executa insert/update.
- [ ] Marcar erro se uma tabela comentada como removida ainda aparece no fluxo.
- [ ] Marcar acerto se stores encapsulam acesso ao banco.

Checklist de Master ID

- [ ] Verificar `master-id-engine.js`.
- [ ] Identificar onde Master ID é criado.
- [ ] Identificar onde Master ID é usado.
- [ ] Verificar se Master ID conecta lead, proposta, contrato, produto, P.I., obra e entrega.
- [ ] Marcar erro se cada módulo cria ID próprio sem ponte.
- [ ] Marcar acerto se Master ID preserva rastreabilidade ponta a ponta.

Checklist de Dossiê x Master ID

- [ ] Confirmar se Master ID acompanha o ativo/equipamento.
- [ ] Confirmar se Dossiê acompanha a obra.
- [ ] Verificar se os dois se conectam.
- [ ] Marcar erro se Dossiê e Master ID forem tratados como sinônimos.
- [ ] Marcar acerto se o sistema preserva os dois conceitos separados.

Checklist de gates

- [ ] Listar todos os gates explícitos no código.
- [ ] Verificar `project-gates.js`.
- [ ] Verificar gatilho de compra antes da P.I.
- [ ] Verificar gate de instalação: contrato assinado, pagamento F1 liberado e PDF do projeto recebido.
- [ ] Verificar gate de homologação de instalador.
- [ ] Verificar gate de Data Book / entrega.
- [ ] Marcar erro se gate existir apenas no texto, mas não bloquear ação.
- [ ] Marcar acerto se gate impede salvar, iniciar ou avançar status.

Checklist de “vai e vem”

- [ ] Verificar se proposta recusada volta para precificação ou cotação.
- [ ] Verificar se contrato pendente volta para jurídico, cliente ou proposta.
- [ ] Verificar se aval financeiro reprovado volta para preço ou decisão.
- [ ] Verificar se P.I. incompleta volta para produto, fornecedor, NCM ou contrato.
- [ ] Verificar se vistoria com pendência volta para Dossiê, Engenharia, Cliente ou IMS.
- [ ] Verificar se instalador não homologado volta para RH ou substituição.
- [ ] Verificar se embarque atrasado atualiza dashboard, notificações, dossiê e cronograma.
- [ ] Verificar se Data Book incompleto volta para Engenharia, ART ou Instalação.
- [ ] Marcar erro se o sistema só avança e não trata retorno.
- [ ] Marcar acerto se o retorno é rastreável e auditado.

Checklist de qualidade visual e UX

- [ ] Verificar se cada tela possui título coerente com `ROUTE_TITLE`.
- [ ] Verificar se botões principais têm ação real.
- [ ] Verificar se botões destrutivos pedem confirmação.
- [ ] Verificar se formulários possuem validação.
- [ ] Verificar se erros aparecem para o usuário.
- [ ] Verificar se carregamento assíncrono mostra “Carregando…” ou estado equivalente.
- [ ] Verificar se tela vazia mostra orientação.
- [ ] Verificar se sidebar colapsada mantém navegação utilizável.
- [ ] Marcar erro se houver botão falso.
- [ ] Marcar erro se modal fecha perdendo dados sem aviso.
- [ ] Marcar acerto se UX conduz o usuário pela próxima etapa.

Checklist de performance e carregamento

- [ ] Verificar quantidade de scripts carregados no `index.html`.
- [ ] Verificar `jsx-loader.js` e cache de compilação JSX.
- [ ] Verificar dependências externas por CDN.
- [ ] Verificar se o app depende de Babel em produção.
- [ ] Verificar se há fallback em caso de erro de vídeo de abertura.
- [ ] Verificar timeout de emergência do app.
- [ ] Marcar erro se falha de CDN derrubar funcionalidade crítica.
- [ ] Marcar acerto se há cache, fallback e error boundary.

Checklist de segurança

- [ ] Verificar se chaves sensíveis estão fora do repositório.
- [ ] Verificar `.env.example`.
- [ ] Verificar se há tokens, senhas, service role ou credenciais reais commitadas.
- [ ] Verificar se restrição de rota é apenas frontend.
- [ ] Verificar se Supabase possui RLS documentado ou presumido.
- [ ] Não afirmar que RLS está correto sem consultar schema/policies.
- [ ] Marcar erro crítico se houver credencial exposta.
- [ ] Marcar risco se permissões dependem só da UI.
- [ ] Marcar acerto se configuração de ambiente está separada.

Checklist de testes

- [ ] Verificar existência de testes unitários.
- [ ] Verificar existência de testes E2E.
- [ ] Verificar workflows em `.github/workflows`.
- [ ] Verificar CI.
- [ ] Verificar se testes cobrem rotas críticas.
- [ ] Verificar se testes cobrem gates.
- [ ] Verificar se testes cobrem PDF.
- [ ] Verificar se testes cobrem Supabase ou usam mock.
- [ ] Marcar erro se módulos críticos não têm teste.
- [ ] Marcar acerto se CI impede regressão.

Checklist de relatório final

- [ ] Gerar sumário executivo.
- [ ] Gerar mapa de módulos e submódulos.
- [ ] Gerar matriz “doa / herda”.
- [ ] Gerar lista de acertos.
- [ ] Gerar lista de erros.
- [ ] Gerar lista de riscos.
- [ ] Gerar lista de módulos planejados.
- [ ] Gerar lista de rotas órfãs.
- [ ] Gerar lista de componentes órfãos.
- [ ] Gerar lista de stores órfãs.
- [ ] Gerar lista de integrações quebradas.
- [ ] Gerar recomendações priorizadas.
- [ ] Separar recomendações em: urgente, importante, melhoria, futuro.
- [ ] Nunca corrigir código sem autorização explícita.
- [ ] Nunca fazer commit sem autorização explícita.
- [ ] Nunca criar branch sem autorização explícita.
- [ ] Nunca alterar banco sem autorização explícita.

Modelo de marcação por item

- [ ] Item analisado:
- [ ] Arquivo lido:
- [ ] Evidência:
- [ ] O que está certo:
- [ ] O que está errado:
- [ ] Risco:
- [ ] Impacto no negócio:
- [ ] Recomendação:
- [ ] Status:
- [ ] Confiança: Alta / Média / Baixa

Modelo de saída esperada para cada módulo

Módulo: Comercial  
Submódulo: Leads  
Rota: `leads` / `lead-detail`  
Arquivos: `src/app.jsx`, `src/comercial.jsx`, stores relacionadas  
Herda de: Clientes / oportunidade / usuário responsável  
Doa para: Formulários, Cotações, Propostas, Dashboard  
Acertos:
- [ ] Existe rota principal.
- [ ] Existe rota de detalhe.
- [ ] Participa do fluxo inicial do VP Gestão.

Erros / riscos:
- [ ] Verificar se todos os campos críticos persistem.
- [ ] Verificar se Lead realmente gera próxima etapa.
- [ ] Verificar se há duplicidade de cliente.

Status: Confirmado / Parcial / Planejado / Quebrado / Não encontrado  
Confiança: preencher somente após evidência.

Comando sugerido para Claude Code

Use este checklist como contrato de auditoria.

Analise o repositório inteiro:

`https://github.com/verticalpartsIA/010_GestaoImportacao.git`

Regras:

- Não altere arquivos.
- Não faça commit.
- Não crie branch.
- Não corrija nada.
- Apenas leia, cruze evidências e gere relatório.
- Para cada conclusão, informe arquivo e trecho.
- Se não encontrar evidência, diga “não encontrei evidência”.
- Separe intenção documentada de implementação real.
- Classifique cada item como Confirmado, Parcial, Planejado, Quebrado ou Não encontrado.
- Marque acertos e erros por módulo.
- Gere um relatório final em HTML profissional.

Estrutura do relatório:

- Sumário executivo
- Metodologia
- Mapa de módulos
- Mapa de rotas
- Matriz doa / herda
- Gates encontrados
- Vai e vem do processo
- Acertos por módulo
- Erros por módulo
- Riscos críticos
- Rotas órfãs
- Stores órfãs
- Componentes órfãos
- Mocks encontrados
- Lacunas de persistência
- Lacunas de permissão
- Lacunas de PDF/documentos
- Recomendações priorizadas
- Roadmap técnico sugerido

Critério final de verdade

Uma afirmação só pode entrar no relatório como fato quando houver evidência no código.

Quando houver dúvida, escreva:

“Hipótese provável, mas não comprovada no código analisado.”