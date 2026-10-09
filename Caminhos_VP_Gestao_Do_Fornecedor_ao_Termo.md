# Caminhos Operacionais do VP Gestão

## Do primeiro gatilho comercial até o Termo de Conclusão

**Repositório base:** `verticalpartsIA/010_GestaoImportacao`  
**Base de análise:** auditoria técnica `Auditoria_VP_Gestao_22082026.md`  
**Commit auditado na origem:** `6bfff57`  
**Banco citado na auditoria:** Supabase `jxtqwzmpgofwctqajewt`  
**Objetivo deste documento:** descrever todos os caminhos de negócio do site desde o momento em que o vendedor coleta dados do cliente/equipamento e envia ao fornecedor, até a entrega do Termo de Conclusão / Handover, deixando claro quem conduz cada etapa, o que entra, o que sai, quais módulos herdam dados, quais módulos doam dados, quais ramificações existem e quais pontos precisam de atenção técnica.

---

## 1. Leitura executiva do fluxo

O VP Gestão deve ser lido como uma esteira empresarial de dados, não como um conjunto isolado de telas.

O fluxo principal começa quando o vendedor transforma uma oportunidade em dados estruturados de cliente, empreendimento e equipamento. A partir daí, esses dados seguem para cotação a fornecedor, precificação, proposta, contrato, aval financeiro, compra/importação, engenharia, obra, instalação, documentação e entrega final.

A cadeia principal pode ser representada assim:

```text
Lead / Cliente / Equipamento
  ↓
Formulário técnico-comercial
  ↓
Controle de Cotações
  ↓
Cotação a Fornecedor
  ↓
Precificação
  ↓
Proposta Comercial
  ↓
Contrato de Venda de Equipamentos
  ↓
Aval Financeiro + Sinal + Decisões
  ↓
P.I. / RFQ / IMS / Embarque
  ↓
Engenharia / Projeto / Ficha Técnica
  ↓
Dossiê da Obra / Vistorias / Homologação / Contrato Instalador
  ↓
Instalação em Campo / ART / Cronograma
  ↓
Data Book / Termo / Handover
  ↓
Entrega concluída / Pós-venda
```

Há também módulos transversais que não são etapas lineares, mas observam, bloqueiam, registram ou alimentam todo o processo:

```text
Dashboard
Notificações
Central de Decisões
Gatilhos & Prazo
Logs de Atividade
Configurações do Sistema
Cadastros
Master ID
Dossiê da Obra
```

---

## 2. Glossário dos condutores

### 2.1 Condutor Comercial

Responsável por iniciar a jornada.

Conduz:

- Lead
- Cadastro ou vínculo de cliente
- Formulário de equipamento
- Controle de cotação
- Solicitação ao fornecedor
- Proposta comercial
- Ajustes de escopo, preço e condição

Doa dados para:

- Fornecedor
- Precificação
- Jurídico
- Financeiro
- Engenharia
- Dossiê da Obra

Recebe dados de:

- Cliente
- Fornecedor
- Precificação
- Aprovação financeira
- Contrato
- Entrega / Pós-venda

---

### 2.2 Condutor Fornecedor / Suprimentos

Responsável por transformar a necessidade comercial em resposta de fornecimento.

Conduz:

- Cotação a Fornecedor
- Tratativas
- Anexos técnicos e comerciais
- Preço base
- Prazo de fornecimento
- Condições do fornecedor
- RFQ, quando aplicável

Doa dados para:

- Precificação
- Proposta
- P.I.
- Compra
- Embarque
- Pedido a Fornecedor

Recebe dados de:

- Formulário
- Produto
- NCM
- Cadastro de fornecedores
- Engenharia, quando há necessidade técnica

---

### 2.3 Condutor Financeiro

Responsável por proteger margem, caixa, risco e liberação de compra.

Conduz:

- Precificação
- Aval Financeiro
- Gatilhos & Prazo
- Comissões
- Liberação de compra
- Verificação de sinal
- Pagamentos ao fornecedor

Doa dados para:

- Proposta
- Contrato
- P.I.
- Decisão executiva
- Dashboard Financeiro

Recebe dados de:

- Cotação a fornecedor
- Proposta
- Contrato
- Sinal
- P.I.
- Embarques

Ponto crítico da auditoria:

- A rota `aval-financeiro` estava marcada como restrita na sidebar, mas não no bloqueio estrutural de rotas em `app.jsx`. Portanto, deve ser tratada como correção urgente de segurança.

---

### 2.4 Condutor Jurídico

Responsável por formalizar juridicamente o compromisso com cliente e prestadores.

Conduz:

- Jurídico
- Editor de Contrato
- Contrato Venda de Equipamentos
- Contrato Instalador
- Assinatura digital
- Minutas
- Status jurídico

Doa dados para:

- Aval Financeiro
- P.I.
- Dossiê da Obra
- Instalação
- Handover

Recebe dados de:

- Proposta
- Cliente
- Equipamento
- Condições comerciais
- Instalador homologado
- Escopo técnico

Ramificação importante:

- Contrato de venda e contrato de instalador são fluxos diferentes.
- O contrato de venda formaliza a obrigação com o cliente.
- O contrato de instalador formaliza a contratação de mão de obra para execução.

---

### 2.5 Condutor Importação / Suprimentos Internacionais

Responsável por transformar contrato e aval em compra, produção, embarque e entrega logística.

Conduz:

- P.I. — Proforma Invoice
- RFQ
- IMS
- Embarques
- Análise de Preços
- Pagamentos ao fornecedor
- Produção
- Cargo Ready
- Booking
- Desembaraço
- Entrega física

Doa dados para:

- Dossiê da Obra
- Cronograma
- Instalação
- Dashboard
- Notificações
- Financeiro

Recebe dados de:

- Contrato assinado
- Aval financeiro
- Sinal
- Produto
- Fornecedor
- Cotação
- Engenharia

Ponto crítico da auditoria:

- Existem dois trilhos paralelos de embarque: `embarques` e `embarques_importacao`.
- O módulo novo de Gestão Importação usa `embarques_importacao`.
- Dashboard e Busca Global ainda usam `embarques`.
- Isso pode gerar divergência de informação logística.

---

### 2.6 Condutor Engenharia

Responsável por validar tecnicamente o equipamento, a obra e a execução.

Conduz:

- Engenharia
- Projeto de Elevadores
- Projeto de Equipamento
- Projetos ER/ES
- Ficha Técnica
- Análise Técnica
- BOM
- Documentos técnicos
- ART
- Vistorias
- Status técnico da obra

Doa dados para:

- Ficha Técnica
- P.I.
- Dossiê da Obra
- Instalação
- Data Book
- Handover

Recebe dados de:

- Formulário
- Proposta
- Produto
- Contrato
- Obra
- Cliente

Ponto crítico da auditoria:

- Parte do fechamento técnico ainda usa a tabela legada `projetos`, desconectada da esteira real baseada em `dossier_obra`.

---

### 2.7 Condutor Obra / Instalação

Responsável por transformar equipamento vendido/importado em equipamento instalado, testado e entregue.

Conduz:

- Dossiê da Obra
- Vistorias de Obras
- Homologação de instalador
- Contrato Instalador
- Instalação em Campo
- Cronograma
- Pendências
- ART
- Testes
- Data Book
- Termo de entrega
- Handover

Doa dados para:

- Data Book
- Entrega final
- Dashboard
- Logs
- Pós-venda

Recebe dados de:

- Contrato
- Projeto
- Cliente
- Embarque
- Instalador
- IMS
- Vistorias

---

### 2.8 Condutor Governança

Responsável por observar, auditar, restringir, direcionar e manter consistência.

Conduz:

- Dashboard
- Notificações
- Central de Decisões
- Gatilhos & Prazo
- Logs de Atividade
- Configurações do Sistema
- Perfis
- Alocação de módulos

Doa dados para:

- Usuários
- Gestores
- Decisões
- Auditoria
- Controle de acesso

Recebe dados de:

- Todos os módulos

---

## 3. Caminho 0 — Preparação estrutural antes do fluxo

Antes de uma oportunidade seguir corretamente, o sistema precisa ter as fontes de verdade minimamente organizadas.

### 3.1 Clientes

Rota:

```text
cadastro-clientes
```

Arquivos citados na auditoria:

```text
src/cadastros-clientes-store.js
src/cadastros.jsx
```

Entra:

- Razão social ou nome do cliente
- Documento
- Contatos
- Endereço
- Dados comerciais
- Lead a ser vinculado, quando aplicável

Sai:

- `cliente_id`
- Dados reutilizáveis para Lead
- Dados reutilizáveis para Proposta
- Dados reutilizáveis para Contrato
- Dados reutilizáveis para Dossiê da Obra

Doa para:

```text
leads
propostas
contrato-venda-equipamentos
dossier-obra
handover
```

Herda de:

```text
lead
proposta
contrato
obra
```

Ramificações:

- Cliente novo criado a partir do Lead.
- Cliente já existente vinculado ao Lead.
- Cliente alterado depois de contrato/proposta exige controle de impacto documental.

Ponto de controle:

- Evitar duplicidade de cliente.
- Verificar se alteração cadastral retroage ou não para documentos já emitidos.

---

### 3.2 Fornecedores

Rota:

```text
cadastro-fornecedores
```

Arquivos citados na auditoria:

```text
src/cadastros-fornecedores-store.js
src/cadastros.jsx
```

Entra:

- Nome do fornecedor
- Categoria
- Origem
- País
- Contatos
- Condições comerciais

Sai:

- `fornecedor_id`
- Dados de fornecedor para cotação
- Dados de fornecedor para P.I.
- Dados de fornecedor para RFQ
- Dados de fornecedor para IMS
- Dados de fornecedor para pedido

Doa para:

```text
cotacoes-fornecedor
pi-importacao
rfq-importacao
ims-importacao
pedidos-acompanhamento
pedido-fornecedor
```

Herda de:

```text
histórico de cotação
histórico de compra
histórico de importação
```

Ramificações:

- Fornecedor nacional.
- Fornecedor estrangeiro.
- Agente de carga.
- Fornecedor de serviço logístico.
- Fornecedor de recurso IMS.

Ponto de controle:

- A auditoria confirmou que Fornecedor é cadastro real e reutilizado, não apenas texto livre.
- Supplier Scorecard estruturado não foi confirmado.

---

### 3.3 Produtos / Catálogo / NCM

Rota principal:

```text
ncm-catalogo
```

Rotas internas / problemáticas:

```text
ncm-kanban
ncm-detail
```

Arquivos citados na auditoria:

```text
src/ncm-catalogo.jsx
src/ncm.jsx
src/ncm-data.js
src/ficha-tecnica-store.js
src/pedido-fornecedor-store.js
```

Entra:

- Produto
- Categoria
- NCM
- Dados técnicos
- Dados fiscais
- Operador estrangeiro
- Imagens e especificações

Sai:

- Produto ativo
- Classificação fiscal
- Dados para ficha técnica
- Dados para pedido a fornecedor
- Dados para proposta
- Dados para contrato
- Dados para P.I.

Doa para:

```text
ficha-tecnica
pedido-fornecedor
propostas
contrato-venda-equipamentos
pi-importacao
cotacoes-fornecedor
```

Herda de:

```text
engenharia
NCM
catálogo
operadores estrangeiros
```

Ramificações:

- Produto ativo no catálogo.
- Solicitação de classificação NCM.
- Ficha técnica vinculada ao produto.
- Pedido a fornecedor gerado a partir do produto.

Ponto crítico:

- A auditoria confirmou que `catalogo_produtos` existe e alimenta Ficha Técnica e Pedido a Fornecedor.
- A auditoria também confirmou que `ncm_solicitacoes` foi removida do banco, mas ainda é usada por Dashboard e Kanban NCM.
- Portanto, o caminho de Produto ativo é válido; o caminho de Solicitações NCM está quebrado.

---

## 4. Caminho 1 — Primeiro gatilho comercial

### 4.1 Gatilho inicial

O primeiro gatilho de negócio ocorre quando o vendedor coleta dados do cliente, empreendimento e equipamento e transforma isso em um registro rastreável.

Evento inicial:

```text
Vendedor coleta dados do cliente/equipamento
```

Este evento pode nascer em:

```text
Lead
Formulário de Elevador
Controle de Cotações
```

Rotas envolvidas:

```text
leads
lead-detail
formularios
formulario-elevador
controle-cotacoes
```

Condutor:

```text
Comercial / Vendedor
```

Entra:

- Nome do cliente ou empreendimento
- Contato
- Telefone
- E-mail
- Tipo de equipamento
- Quantidade
- Paradas
- Características preliminares
- Origem da oportunidade
- Responsável comercial
- Valor estimado, se houver
- Próxima ação

Sai:

- Lead
- Número de cotação / Master ID
- Formulário técnico-comercial
- Base para cotação a fornecedor
- Base para precificação
- Base para proposta

Doa para:

```text
formularios
cotacoes-fornecedor
precificacao
propostas
dashboard
linha-do-tempo
```

Herda de:

```text
cadastro-clientes
cadastro-produtos, quando já existe produto conhecido
```

---

### 4.2 Lead

Rota:

```text
leads
lead-detail
```

Arquivo citado na auditoria:

```text
src/comercial.jsx
```

Entra:

- Oportunidade comercial
- Cliente ou contato inicial
- Empreendimento
- Equipamento pretendido
- Status comercial

Sai:

- Registro de oportunidade
- Contexto para formulário
- Contexto para proposta
- Possível vínculo com cliente

Doa para:

```text
formulario-elevador
controle-cotacoes
proposta-editor
cadastro-clientes
```

Herda de:

```text
cadastro-clientes, quando já houver cliente
usuário responsável
origem comercial
```

Ramificações:

```text
Lead incompleto → volta para Comercial preencher dados
Lead qualificado → segue para Formulário
Lead perdido → encerra ou permanece histórico
Lead convertido → segue para Proposta / Contrato
```

Pontos de controle:

- Lead deve preservar contexto por ID.
- Lead deve amarrar a futura cotação ao `numero_cotacao` / Master ID.
- Lead não deve gerar proposta sem dados mínimos.

---

### 4.3 Formulário técnico-comercial

Rota:

```text
formularios
formulario-elevador
```

Arquivos citados na auditoria:

```text
src/formulario-elevador.jsx
src/formulario-elevador-store.js
```

Tabela citada:

```text
formularios_elevador
```

Entra:

- Lead
- Cliente
- Empreendimento
- Tipo de equipamento
- Quantidade
- Dados preliminares

Sai:

- Especificação técnica inicial
- Número de cotação / Master ID
- Dados para cotação a fornecedor
- Dados para precificação
- Dados para proposta
- Dados para engenharia

Doa para:

```text
controle-cotacoes
cotacoes-fornecedor
precificacao
propostas
engenharia
linha-do-tempo
```

Herda de:

```text
lead
cadastro-clientes
produto, se aplicável
```

Ramificações:

```text
Formulário completo → Cotação a Fornecedor
Formulário incompleto → retorna ao vendedor
Formulário revisado → atualiza cotação/proposta se ainda não fechadas
Múltiplos equipamentos → gera itens individualizáveis pelo Master ID
```

Ponto de controle:

- O formulário é um dos maiores condutores de dados do sistema.
- Ele não deve ser tratado como simples checklist visual.
- Ele doa especificação para praticamente toda a cadeia posterior.

---

### 4.4 Controle de Cotações

Rota:

```text
controle-cotacoes
```

Arquivo citado na auditoria:

```text
src/controle-cotacoes.jsx
```

Entra:

- Formulário
- Número de cotação
- Histórico comercial
- Histórico de fornecedor
- Gatilhos

Sai:

- Linha consolidada da cotação
- Histórico por `numero_cotacao`
- Visão de rastreabilidade

Doa para:

```text
cotacoes-fornecedor
precificacao
propostas
linha-do-tempo
```

Herda de:

```text
formularios_elevador
cotacoes-fornecedor
gatilhos
```

Ramificações:

```text
Cotação ainda sem fornecedor → enviar para fornecedor
Cotação com fornecedor respondido → precificar
Cotação precificada → proposta
Cotação parada → gatilho/notificação
```

Ponto de controle:

- A auditoria confirmou que este módulo não é apenas uma lista visual; ele cruza dados por Master ID.

---

## 5. Caminho 2 — Envio ao fornecedor e tratativas

### 5.1 Cotação a Fornecedor

Rota:

```text
cotacoes-fornecedor
cotacao-fornecedor-detail
```

Arquivos citados na auditoria:

```text
src/cotacoes-fornecedor.jsx
src/cotacao-elevador-fornecedor.jsx
src/cotacao-elevador-fornecedor-store.js
src/tratativas-store.js
```

Condutor:

```text
Comercial / Suprimentos / Importação
```

Entra:

- Formulário técnico-comercial
- Número de cotação / Master ID
- Produto
- Fornecedor
- Especificação técnica
- Anexos
- Quantidades
- Condições esperadas

Sai:

- Resposta do fornecedor
- Preço base
- Prazo
- Condições comerciais
- Moeda
- Anexos
- Tratativas
- Registro de fornecedor escolhido ou comparado

Doa para:

```text
precificacao
propostas
rfq-importacao
pi-importacao
pedido-fornecedor
linha-do-tempo
```

Herda de:

```text
formulario-elevador
cadastro-fornecedores
ncm-catalogo
master-id-engine
```

Ramificações:

```text
Fornecedor não responde → nova tratativa / outro fornecedor
Fornecedor responde incompleto → retorna para tratativa
Fornecedor responde com preço → segue para Precificação
Fornecedor responde com divergência técnica → retorna para Engenharia/Formulário
Fornecedor vencedor escolhido → alimenta Proposta / P.I.
```

Entradas mínimas recomendadas:

- `numero_cotacao`
- `fornecedor_id`
- Produto/equipamento
- Quantidade
- Dados técnicos do formulário
- Moeda
- Prazo
- Incoterm, se aplicável

Saídas mínimas recomendadas:

- Preço base
- Prazo de produção
- Condição comercial
- Observações técnicas
- Anexos
- Status da cotação

Pontos de controle:

- Fornecedor deve ser ID real, não texto livre.
- Tratativas devem manter histórico.
- Cotação respondida deve alimentar Precificação.

---

### 5.2 Tratativas

Rota associada:

```text
cotacao-fornecedor-detail
```

Arquivo citado:

```text
src/tratativas-store.js
```

Entra:

- Mensagens
- Anexos
- Revisões de preço
- Revisões de prazo
- Dúvidas técnicas
- Respostas do fornecedor

Sai:

- Histórico de negociação
- Evidência de decisão
- Base de preço final
- Base de comparação futura

Doa para:

```text
precificacao
rfq-importacao
analise-precos
logs
linha-do-tempo
```

Herda de:

```text
cotacoes-fornecedor
fornecedores
formularios
```

Ramificações:

```text
Tratativa comercial → preço e prazo
Tratativa técnica → Engenharia / Ficha Técnica
Tratativa documental → Jurídico / P.I.
Tratativa logística → Importação / IMS
```

Ponto de controle:

- Tratativa não deve sobrescrever a cotação original sem histórico.

---

## 6. Caminho 3 — Precificação, margem e proposta

### 6.1 Precificação

Rota:

```text
precificacao
```

Arquivos citados:

```text
src/precificacao.jsx
src/precificacao-elevador.jsx
src/precificacao-elevador-engine.js
src/precificacao-elevador-store.js
src/difal-engine.js
```

Condutor:

```text
Financeiro / Comercial / Admin
```

Entra:

- Cotação respondida
- Preço base do fornecedor
- Moeda
- Câmbio
- Tributos
- DIFAL
- Custos de importação
- Serviços
- Instalação
- Comissões
- Markup
- Margem desejada

Sai:

- Preço comercial
- Margem
- Custo total estimado
- Parâmetros financeiros
- Base para proposta
- Base para aval financeiro

Doa para:

```text
propostas
aval-financeiro
comissoes
dashboard-financeiro
```

Herda de:

```text
cotacoes-fornecedor
formulario-elevador
cadastro-produtos
cadastro-fornecedores
```

Ramificações:

```text
Margem aprovada → Proposta
Margem baixa → retorna para negociação com fornecedor
Custo inconsistente → retorna para cotação / engenharia
DIFAL ou imposto divergente → retorna para revisão fiscal
```

Pontos de controle:

- Cálculo e aprovação devem ser tratados como estados diferentes.
- A auditoria confirmou que as engines de Precificação e DIFAL possuem testes.
- Gate de Análise Técnica antes da Precificação foi citado como intenção, mas não confirmado profundamente.

---

### 6.2 Proposta Comercial

Rotas:

```text
propostas
proposta-editor
```

Arquivos citados:

```text
src/proposta-form.jsx
src/proposta-preview.jsx
src/proposta-editor.jsx
src/proposta-store.js
src/proposta-heranca.js
src/proposta-imagens.js
src/proposta-legado.js
src/proposta-reactpdf.bundle.js
```

Condutor:

```text
Comercial
```

Entra:

- Lead
- Cliente
- Formulário
- Cotação respondida
- Precificação
- Imagens
- Desenhos
- Condições comerciais
- Escopo técnico

Sai:

- Proposta comercial estruturada
- PDF / preview
- Escopo vendido
- Valores
- Condições
- Dados para contrato
- Dados para comissionamento
- Dados para aval financeiro

Doa para:

```text
contrato-venda-equipamentos
juridico
aval-financeiro
comissoes
dossier-obra
dashboard-comercial
```

Herda de:

```text
lead
formulario-elevador
cotacoes-fornecedor
precificacao
proposta-heranca
```

Ramificações:

```text
Proposta em rascunho → Comercial revisa
Proposta enviada → aguarda cliente
Proposta aprovada → Contrato de Venda
Proposta recusada → retorna para Precificação ou Cotação
Proposta revisada → gera nova versão ou alteração de escopo
```

Pontos de controle:

- `proposta-heranca.js` é o mecanismo real de herança de dados.
- A proposta deve evitar redigitação.
- Preview e PDF final devem ser auditados para evitar divergência visual.
- O KPI de “propostas enviadas” no Dashboard Comercial precisa ser padronizado para não contar `leads.status` em um lugar e `propostas` em outro.

---

## 7. Caminho 4 — Contrato, assinatura e aval financeiro

### 7.1 Jurídico / Editor de Contrato

Rotas:

```text
juridico
contrato-editor
```

Arquivos citados:

```text
src/contrato-editor.jsx
src/contrato-venda-store.js
src/contrato-venda-engine.js
src/contrato-venda-preview.jsx
```

Condutor:

```text
Jurídico / Comercial / Admin
```

Entra:

- Proposta aprovada
- Cliente
- Equipamento
- Preço
- Condições comerciais
- Condições de entrega
- Escopo técnico

Sai:

- Minuta
- Contrato
- Status jurídico
- Status de assinatura
- Token de assinatura, quando aplicável
- Base para aval financeiro
- Base para P.I.
- Base para Dossiê

Doa para:

```text
contrato-venda-equipamentos
aval-financeiro
pi-importacao
dossier-obra
instalacao
databook
handover
```

Herda de:

```text
propostas
clientes
produtos
precificacao
```

Ramificações:

```text
Contrato em minuta → revisão jurídica
Contrato enviado → assinatura cliente
Contrato assinado → aval financeiro / compra / obra
Contrato pendente → volta para Jurídico ou Comercial
Contrato recusado → retorna para Proposta
```

Ponto de controle:

- A auditoria não encontrou bloqueio real impedindo criar contrato a partir de proposta não aprovada.
- Recomendação: contrato deve validar `proposta.status === aprovada` antes de seguir.

---

### 7.2 Contrato Venda de Equipamentos

Rota:

```text
contrato-venda-equipamentos
```

Arquivos citados:

```text
src/contrato-venda.jsx
src/contrato-venda-store.js
src/contrato-venda-engine.js
src/contrato-venda-preview.jsx
src/assinar-app.jsx
```

Condutor:

```text
Jurídico / Comercial
```

Entra:

- Proposta
- Comprador
- Objeto
- Preço
- Condições
- Logística
- Equipamentos
- Prazo

Sai:

- Contrato formal
- Status de assinatura
- Obrigação contratual
- Base de cobrança
- Base de compra
- Base de obra

Doa para:

```text
aval-financeiro
pi-importacao
dossier-obra
instalacao
handover
```

Herda de:

```text
proposta-editor
cadastro-clientes
precificacao
produtos
```

Ramificações:

```text
Contrato assinado + sinal pago → Aval / P.I.
Contrato assinado sem sinal → Financeiro / Gatilhos
Contrato pendente → Notificações / Jurídico
Contrato cancelado → encerra ou retorna para Proposta
```

Ponto de controle:

- Assinatura digital foi considerada real na auditoria, pois `assinar-app.jsx` registra assinatura, hash, IP, UA e device.

---

### 7.3 Aval Financeiro

Rota:

```text
aval-financeiro
```

Arquivos citados:

```text
src/aval-financeiro.jsx
src/aval-financeiro-store.js
```

Condutor:

```text
Financeiro / Admin
```

Entra:

- Contrato
- Proposta
- Sinal
- Valor
- Condições de pagamento
- Risco de caixa
- Número de cotação

Sai:

- Operação aprovada financeiramente
- Operação reprovada
- Solicitação de decisão
- Liberação informativa de compra
- Status para Dashboard Financeiro

Doa para:

```text
pi-importacao
central-de-decisoes
gatilhos-prazo
dashboard-financeiro
```

Herda de:

```text
contrato-venda-equipamentos
propostas
precificacao
clientes
```

Ramificações:

```text
Aval aprovado → P.I. / compra
Aval reprovado → retorna para preço, condição ou decisão
Sinal não pago → Gatilhos & Prazo
Divergência de valor → retorna para Proposta / Financeiro
```

Ponto crítico:

- Corrigir permissão de rota: `aval-financeiro` deve constar em `RESTRICTED` com `financeiro` e `admin`.

---

## 8. Caminho 5 — Compra, P.I., RFQ, IMS e Embarque

### 8.1 P.I. — Proforma Invoice

Rota:

```text
pi-importacao
```

Arquivos citados:

```text
src/pi.jsx
src/pi-store.js
```

Tabela citada:

```text
pi_importacao
```

Condutor:

```text
Importação / Suprimentos / Financeiro
```

Entra:

- Contrato assinado
- Aval financeiro
- Sinal
- Fornecedor
- Produto
- Itens
- NCM
- Valor
- Moeda
- Incoterm
- Condição de pagamento
- Prazo de produção

Sai:

- P.I. criada
- Compra formal
- Pagamento ao fornecedor
- Dados de produção
- Cargo Ready
- Base para RFQ
- Base para embarque
- Base para análise de preços

Doa para:

```text
rfq-importacao
embarques-importacao
gi-painel
dashboard
financeiro
```

Herda de:

```text
contrato-venda-equipamentos
aval-financeiro
cadastro-fornecedores
ncm-catalogo
cotacoes-fornecedor
```

Ramificações:

```text
P.I. completa → pagamento / produção
P.I. sem fornecedor válido → retorna para Cadastro/Cotação
P.I. sem contrato/aval/sinal → deveria bloquear
P.I. vinculada ao embarque → segue para Embarques
P.I. sem embarque → permanece em produção/compra
```

Pontos de controle:

- A auditoria confirmou vínculo bidirecional P.I. ↔ Embarque dentro de `pi-store.js` e `embarques-importacao-store.js`.
- A auditoria também apontou que P.I. nasce solta em alguns pontos, sem checar aval de forma estrutural.

---

### 8.2 RFQ — Request for Quotation

Rota:

```text
rfq-importacao
```

Arquivos citados:

```text
src/rfq.jsx
src/rfq-store.js
```

Tabela citada:

```text
rfq_importacao
```

Condutor:

```text
Importação / Suprimentos
```

Entra:

- Necessidade de cotação
- Fornecedores
- Itens
- Moedas
- Frete
- Serviço
- Condições

Sai:

- Comparativo de fornecedores
- Vencedor por item ou global
- Preço de referência
- Base para compra
- Base para análise de preços

Doa para:

```text
pi-importacao
ims-importacao
gi-analise-precos
pedido-fornecedor
```

Herda de:

```text
fornecedores
produtos
pi-importacao
cotacoes-fornecedor
```

Ramificações:

```text
RFQ de equipamento → P.I.
RFQ de frete → Embarque
RFQ de recurso → IMS
RFQ comparativa → Análise de Preços
```

Ponto de controle:

- Registrar vencedor de forma persistente.
- Evitar que RFQ vire apenas uma tabela visual sem efeito no pedido/compra.

---

### 8.3 IMS — Recursos operacionais

Rota:

```text
ims-importacao
```

Arquivos citados:

```text
src/ims.jsx
src/ims-store.js
```

Tabela citada:

```text
ims_importacao
```

Condutor:

```text
Importação / Logística / Engenharia
```

Entra:

- Obra
- Carga
- Peso
- Local de entrega
- Necessidade de recurso
- Prazo
- Fornecedores de serviço

Sai:

- Transporte contratado
- Munck contratado
- Empilhadeira contratada
- Andaime contratado
- Mão de obra auxiliar
- Recurso físico planejado

Doa para:

```text
embarques-importacao
dossier-obra
instalacao
vistorias
cronograma
```

Herda de:

```text
pi-importacao
embarques-importacao
dossier-obra
engenharia
```

Ramificações:

```text
Recurso de transporte → retirada / entrega
Munck / empilhadeira → descarga
Andaime → obra / instalação
Mão de obra → apoio em campo
Recurso indisponível → reprogramação de cronograma
```

Ponto de controle:

- Cada recurso crítico deve ter fornecedor, data, custo e responsável.

---

### 8.4 Embarques — Gestão Importação

Rotas:

```text
embarques-importacao
gi-painel
importacao-detail, no trilho legado
importacao-rastreamento, no trilho legado
```

Arquivos citados:

```text
src/embarques-importacao.jsx
src/embarques-importacao-store.js
src/logistica.jsx
```

Tabelas citadas:

```text
embarques_importacao
embarques
```

Condutor:

```text
Importação / Logística
```

Entra:

- P.I.
- Fornecedor
- Carga
- Frete
- Container
- Navio
- Portos
- Datas
- Aduana
- NF-e
- Recursos IMS

Sai:

- ETD
- ETA
- Container
- Tracking
- Rolagens
- Free time
- Status aduaneiro
- Status de entrega
- Informação para obra
- Informação para dashboard

Doa para:

```text
dossier-obra
status-obras
instalacao
cronograma
dashboard
notificacoes
financeiro
```

Herda de:

```text
pi-importacao
rfq-importacao
ims-importacao
fornecedores
```

Ramificações:

```text
Produção em andamento → aguarda Cargo Ready
Cargo Ready → booking / embarque
ETD confirmado → trânsito internacional
Rolagem → reprograma cronograma
Chegada no Brasil → aduana
Canal verde → liberação mais simples
Canal amarelo/vermelho/cinza → conferência e possível atraso
NF-e emitida → entrega
Container devolvido → encerra logística internacional
```

Ponto crítico:

- Unificar ou criar ponte entre `embarques` e `embarques_importacao`.
- Dashboard e Busca Global devem olhar para a fonte correta do fluxo novo.

---

## 9. Caminho 6 — Engenharia, ficha técnica e obra

### 9.1 Engenharia

Rota:

```text
engenharia
```

Arquivo citado:

```text
src/operacoes.jsx
```

Condutor:

```text
Engenharia
```

Entra:

- Formulário
- Proposta
- Produto
- Obra
- Cliente
- Dados técnicos
- Número de cotação

Sai:

- Projeto
- Análise técnica
- BOM
- Laudo
- Gates técnicos
- Base para ficha técnica
- Base para instalação

Doa para:

```text
ficha-tecnica
eng-projeto-elevadores
eng-configurador
desenho-tecnico
dossier-obra
instalacao
art
databook
```

Herda de:

```text
formulario-elevador
propostas
produtos
clientes
```

Ramificações:

```text
Dados técnicos suficientes → projeto
Dados insuficientes → retorna ao formulário/comercial
Divergência técnica → retorna para proposta/fornecedor
Projeto aprovado → ficha técnica / obra
Projeto pendente → gatilho / notificação
```

Ponto crítico:

- Parte da Engenharia ainda lê `projetos`, tabela apontada como desconectada da esteira real.

---

### 9.2 Projeto de Elevadores

Rota:

```text
eng-projeto-elevadores
```

Arquivos citados:

```text
src/projeto-elevador-store.js
src/engenharia-elevador.jsx
```

Condutor:

```text
Engenharia
```

Entra:

- Formulário de elevador
- Número de cotação
- Poço
- Cabine
- Portas
- Paradas
- Medidas
- Requisitos técnicos

Sai:

- Projeto de elevador
- Dados de especificação
- Status técnico
- Base para ficha técnica
- Base para instalação

Doa para:

```text
ficha-tecnica
dossier-obra
instalacao
art
databook
```

Herda de:

```text
formulario-elevador
engenharia
produtos
```

Ramificações:

```text
Projeto aprovado → instalação/ficha
Projeto reprovado → revisão técnica
Projeto incompleto → pendência de engenharia
```

---

### 9.3 Projeto de Equipamento

Rota:

```text
eng-configurador
```

Arquivo citado:

```text
src/engenharia-config.jsx
```

Condutor:

```text
Engenharia
```

Entra:

- Tipo de equipamento
- Requisitos técnicos
- Produto
- Formulário
- Dados de escada/esteira/elevador

Sai:

- Configuração técnica
- Especificação concreta
- BOM
- Dados de proposta/contrato/ficha

Doa para:

```text
ficha-tecnica
propostas
contrato-venda-equipamentos
pedido-fornecedor
```

Herda de:

```text
formularios
produtos
engenharia
```

Ponto de controle:

- A auditoria não aprofundou este módulo.
- Tratar como caminho provável, mas exigir verificação antes de alterar.

---

### 9.4 Projetos ER/ES

Rota:

```text
desenho-tecnico
```

Arquivo citado:

```text
src/desenho-tecnico.jsx
```

Condutor:

```text
Engenharia
```

Entra:

- Dados técnicos de Escada Rolante ou Esteira Rolante
- Medidas
- Configuração
- Requisitos do cliente

Sai:

- Desenho técnico
- Especificação ER/ES
- Base para proposta, contrato, ficha e fornecedor

Doa para:

```text
ficha-tecnica
propostas
contrato-venda-equipamentos
pedido-fornecedor
```

Herda de:

```text
formularios
engenharia
produtos
```

Ponto de controle:

- A auditoria classificou como parcial.

---

### 9.5 Ficha Técnica

Rota:

```text
ficha-tecnica
```

Arquivos citados:

```text
src/ficha-tecnica.jsx
src/ficha-tecnica-engine.js
src/ficha-tecnica-store.js
src/ficha-tecnica-imagens.js
src/ficha-omie-publish.js
src/ficha-tecnica-copiloto.jsx
```

Condutor:

```text
Engenharia / Produto / Fiscal
```

Entra:

- Produto
- NCM
- Dados técnicos
- Imagens
- Desenho
- Categoria
- Campos técnicos
- Operador estrangeiro

Sai:

- Ficha técnica
- Snapshot técnico
- Dados fiscais
- PDF / impressão técnica
- Base para pedido
- Base para proposta
- Base para contrato
- Base para importação

Doa para:

```text
pedido-fornecedor
propostas
contrato-venda-equipamentos
pi-importacao
engenharia
databook
```

Herda de:

```text
ncm-catalogo
engenharia
produtos
desenho-tecnico
```

Ramificações:

```text
Ficha completa → proposta / pedido / P.I.
Ficha incompleta → engenharia/produto
Ficha publicada → catálogo / Omie, se integração estiver ativa
```

Pontos de controle:

- A ficha foi confirmada como módulo forte.
- Publicação Omie não foi confirmada profundamente na auditoria.

---

## 10. Caminho 7 — Dossiê da Obra, vistorias e status

### 10.1 Dossiê da Obra

Rota:

```text
dossier-obra
```

Arquivos citados:

```text
src/dossier-obra.jsx
src/dossier-store.js
```

Tabela citada:

```text
dossier_obra
```

Condutor:

```text
Engenharia / Obra / Operações
```

Entra:

- Contrato
- Cliente
- Proposta
- Número de cotação
- Projeto
- Obra
- Embarque
- Vistorias
- Instalador

Sai:

- Prontuário da obra
- Status mestre
- Pendências
- Documentos
- Histórico
- Checklist de obra pronta
- Base para instalação
- Base para Data Book

Doa para:

```text
status-obras
vistorias
instalacao
cronograma
databook
handover
dashboard
```

Herda de:

```text
contrato-venda-equipamentos
propostas
clientes
engenharia
embarques-importacao
rh-homologacao
```

Ramificações:

```text
Dossiê criado → análise técnica
Dossiê com pendência → vistorias/engenharia/cliente
Dossiê liberado → instalação
Dossiê concluído → Data Book / Handover
```

Ponto de controle:

- Dossiê é entidade diferente de Master ID.
- Master ID acompanha a venda/ativo.
- Dossiê acompanha a obra física.

---

### 10.2 Status de Obras

Rota:

```text
status-obras
```

Condutor:

```text
Engenharia / Operações
```

Entra:

- Dossiê
- Vistorias
- Instalação
- Embarque
- Contrato
- Projeto
- Pendências

Sai:

- Status consolidado
- Visão gerencial da obra
- Indicação de bloqueios
- Próxima ação

Doa para:

```text
dashboard
notificacoes
dossier-obra
instalacao
```

Herda de:

```text
dossier-obra
vistorias
instalacao
embarques
```

Ramificações:

```text
Obra em análise → engenharia
Obra aguardando importação → importação
Obra aguardando vistoria → vistorias
Obra liberada → instalação
Obra em instalação → cronograma / pendências
Obra concluída → Data Book / Handover
```

Ponto de controle:

- Status deve vir de fontes reais, não de texto manual isolado.

---

### 10.3 Vistorias de Obras

Rota:

```text
vistorias
```

Arquivos citados:

```text
src/vistorias-obras.jsx
src/vistoria-tracker.js
```

Tabelas citadas:

```text
vistorias_obras
dossier_obra
projetos.vistoria, legado
```

Condutor:

```text
Engenharia / Campo
```

Entra:

- Dossiê
- Obra
- Tipo de vistoria
- Fase
- Vistoriador
- Custo
- Fotos
- Documentos
- Observações

Sai:

- Resultado da vistoria
- Pendências
- Liberação ou bloqueio
- Evidências
- Atualização do Dossiê

Doa para:

```text
dossier-obra
status-obras
instalacao
ims-importacao
notificacoes
```

Herda de:

```text
dossier-obra
engenharia
cliente
obra
```

Ramificações:

```text
Vistoria aprovada → segue para liberação de obra
Vistoria com pendência civil → volta para cliente/obra
Vistoria com pendência técnica → volta para engenharia
Vistoria exige recurso → IMS
Vistoria avulsa → custo adicional / margem
```

Ponto crítico:

- A auditoria encontrou duplicidade: `vistorias_obras` e `projetos.vistoria` coexistem.
- Recomendação: manter `vistorias_obras` como fonte oficial e aposentar o legado, se confirmado que não é mais usado.

---

## 11. Caminho 8 — RH, homologação e contrato instalador

### 11.1 Homologação de Parceiros Instaladores

Rota:

```text
rh-homologacao
```

Arquivos citados:

```text
src/rh-homologacao.jsx
src/rh-homologacao-store.js
```

Condutor:

```text
RH / Engenharia / Operações
```

Entra:

- Parceiro instalador
- Documentos
- NR-10
- NR-35
- ASO
- PCMSO
- PGR
- Status documental

Sai:

- Instalador homologado
- Instalador pendente
- Instalador reprovado
- Status geral
- Aptidão para obra

Doa para:

```text
contrato-instalador
instalacao
dossier-obra
central-de-decisoes
```

Herda de:

```text
cadastro-fornecedores ou cadastro de parceiros
requisitos da obra
```

Ramificações:

```text
Instalador homologado → pode ser vinculado à obra
Instalador com documento vencido → bloqueia ou alerta
Instalador não homologado → retorna para RH/substituição
```

Ponto de controle:

- A auditoria confirmou que homologação é usada em `InstalacaoObraStore` como gate real.
- Porém não há bloqueio no momento de criar Contrato Instalador.

---

### 11.2 Contrato Instalador

Rota:

```text
contrato-instalador
```

Arquivos citados:

```text
src/contrato-instalador.jsx
src/contrato-instalador-store.js
src/contrato-instalador-engine.js
src/contrato-instalador-preview.jsx
```

Condutor:

```text
Jurídico / Engenharia / RH
```

Entra:

- Instalador
- Obra
- Dossiê
- Equipamentos
- Escopo técnico
- Valor de mão de obra
- Prazo
- Modalidade

Sai:

- Contrato de prestação de serviço
- Escopo de instalação
- Mão de obra vinculada
- Base para liberação da instalação

Doa para:

```text
instalacao
dossier-obra
central-de-decisoes
logs
```

Herda de:

```text
rh-homologacao
dossier-obra
engenharia
contrato-venda-equipamentos
```

Ramificações:

```text
Instalador homologado + contrato assinado → instalação
Instalador não homologado → deveria bloquear antes do contrato
Contrato parcial por equipamento → instalação parcial
Contrato pendente → RH/Jurídico
```

Ponto crítico:

- Implementar checagem de homologação antes de gerar/enviar contrato.

---

## 12. Caminho 9 — Instalação em campo

### 12.1 Instalação em Campo

Rota:

```text
instalacao
```

Arquivos citados:

```text
src/instalacao-obra-store.js
src/instalacao-checklist-store.js
src/dossier-obra.jsx
```

Condutor:

```text
Engenharia / Obra / Instalador
```

Entra:

- Dossiê
- Contrato assinado
- Sinal pago
- Projeto aprovado
- Instalador homologado
- Instalador vinculado
- Equipamento entregue
- IMS, se necessário
- Vistorias aprovadas

Sai:

- Checklist de obra pronta
- Início de instalação
- Avanço físico
- Pendências
- Evidências
- Testes
- Base para ART
- Base para Data Book

Doa para:

```text
status-obras
cronograma
art
databook
handover
dashboard
notificacoes
```

Herda de:

```text
dossier-obra
contrato-venda-equipamentos
aval-financeiro
engenharia
rh-homologacao
contrato-instalador
embarques-importacao
ims-importacao
vistorias
```

Ramificações:

```text
Todos os gates aprovados → instalação inicia
Contrato não assinado → volta para Jurídico
Sinal não pago → volta para Financeiro / Gatilhos
Projeto não aprovado → volta para Engenharia
Instalador não homologado → volta para RH
Equipamento não entregue → volta para Importação / Logística
Obra com pendência → volta para Vistoria / Cliente / IMS
```

Pontos de controle:

- `InstalacaoObraStore.obterChecklistObraPronta` foi identificado como o gate mais completo do repositório.
- A auditoria não confirmou se a UI bloqueia o avanço ou apenas exibe status.

---

### 12.2 Cronograma

Rota:

```text
cronograma
```

Arquivos citados:

```text
src/entrega.jsx
```

Tabela citada parcialmente:

```text
instalacao_cronograma
```

Condutor:

```text
Engenharia / Obra
```

Entra:

- Dossiê
- Embarque
- Instalação
- Equipe
- Pendências
- Datas previstas
- Datas reais

Sai:

- Cronograma planejado
- Cronograma realizado
- Reprogramações
- Alertas de atraso
- Base para Dashboard

Doa para:

```text
status-obras
dashboard
notificacoes
databook
handover
```

Herda de:

```text
instalacao
embarques-importacao
dossier-obra
```

Ponto crítico:

- A auditoria classificou Cronograma como quebrado/desconectado porque parte do fechamento usa `projetos`, não `dossier_obra`.

---

### 12.3 ART

Rota:

```text
art
```

Arquivos citados:

```text
src/entrega.jsx
```

Condutor:

```text
Engenharia / Responsável Técnico
```

Entra:

- Projeto aprovado
- Obra
- Equipamento
- Responsável técnico
- Dados legais

Sai:

- ART registrada
- Documento legal
- Evidência para Data Book
- Evidência para Handover

Doa para:

```text
databook
handover
termo de entrega
```

Herda de:

```text
engenharia
instalacao
dossier-obra
```

Ponto crítico:

- A auditoria classificou ART como quebrada/desconectada por usar a trilha `projetos`.

---

## 13. Caminho 10 — Data Book, Termo e Handover

### 13.1 Data Book & Termo

Rota:

```text
databook
```

Arquivos citados:

```text
src/data-book-store.js
src/entrega.jsx
```

Condutor:

```text
Engenharia / Obra / Documentação
```

Entra:

- Instalação concluída
- ART
- Testes
- Manuais
- Certificados
- Fotos
- Evidências
- Documentos técnicos
- Aceite

Sai:

- Data Book
- Termo de Entrega
- Pacote documental
- Evidência de conclusão
- Base para Handover

Doa para:

```text
handover
pós-venda
logs
dashboard
```

Herda de:

```text
instalacao
art
engenharia
dossier-obra
```

Ramificações:

```text
Data Book completo → Termo / Handover
Data Book incompleto → volta para Engenharia / ART / Instalação
Documento ausente → pendência documental
Cliente não assinou → contrato não encerra formalmente
```

Ponto crítico:

- A auditoria não confirmou se Data Book exige todas as evidências antes do termo.
- Também apontou que Data Book grava metadado em `projetos`, desconectado da esteira real.

---

### 13.2 Handover / Entrega Final

Rota:

```text
handover
```

Arquivos citados:

```text
src/handover-manutencao.js
src/handover-manutencao.jsx
```

Condutor:

```text
Engenharia / Comercial / Pós-venda
```

Entra:

- Data Book
- ART
- Equipamento testado
- Documentos
- Manuais
- Certificados
- Treinamento
- Garantia
- Suporte
- Assinatura do cliente

Sai:

- Entrega final formalizada
- Termo assinado
- Transferência para manutenção/pós-venda
- Encerramento técnico/contratual

Doa para:

```text
pós-venda
dashboard
logs
histórico do cliente
```

Herda de:

```text
databook
instalacao
art
dossier-obra
contrato-venda-equipamentos
```

Ramificações:

```text
Termo assinado → projeto encerrado
Treinamento pendente → volta para instalação/engenharia
Certificado pendente → volta para engenharia/documentação
Garantia não explicada → volta para comercial
Cliente não aceita → pendência / jurídico / obra
```

Ponto crítico:

- A auditoria classificou Handover como quebrado no sentido arquitetural porque opera sobre `projetos`, tabela paralela/desconectada da esteira real.

---

## 14. Caminhos transversais

### 14.1 Dashboard

Rota:

```text
dashboard
```

Arquivos citados:

```text
src/dashboard.jsx
src/supabase.js
src/dashboard-metrics-comercial.js
src/dashboard-metrics-engenharia.js
src/dashboard-metrics-financeiro.js
src/dashboard-metrics-gantt.js
src/dashboard-metrics-admin.js
```

Condutor:

```text
Gestão / Diretoria / Perfis operacionais
```

Entra:

- Leads
- Cotações
- Projetos
- Alertas
- Tarefas
- Embarques
- Contratos
- Estoque
- Comissões
- Gatilhos
- Fichas
- Catálogo
- Propostas
- Avais
- NCM

Sai:

- KPIs por perfil
- Alertas críticos
- Visão executiva
- Sinais de atraso
- Sinais de conversão

Doa para:

```text
usuário gestor
decisão operacional
priorização de ação
```

Herda de:

```text
todos os módulos
```

Pontos críticos:

- Dashboard lê `ncm_solicitacoes`, tabela inexistente.
- KPI “Propostas enviadas” usa fonte divergente.
- Dashboard financeiro usa `days_left` armazenado, não recalculado.
- Dashboard de embarques pode ler trilho legado, não `embarques_importacao`.

---

### 14.2 Notificações

Rota:

```text
notificacoes
```

Arquivos citados:

```text
src/notificacoes-processamento.js
src/notificacoes-lidas-store.js
src/dashboard.jsx
```

Entra:

- Eventos operacionais
- Pendências
- Prazos
- Alterações
- Alertas

Sai:

- Avisos
- Itens lidos/não lidos
- Direcionamento para ação

Doa para:

```text
usuários
central operacional
```

Herda de:

```text
gatilhos
contratos
propostas
embarques
vistorias
instalação
```

Ponto de controle:

- Notificação não deve ser confundida com decisão formal.

---

### 14.3 Central de Decisões

Rota:

```text
decisoes
```

Arquivos citados:

```text
src/decisoes.jsx
src/decisoes-store.js
```

Entra:

- Solicitações de decisão
- Pendências de aprovação
- Reprovações
- Exceções
- Pedidos de autorização

Sai:

- Decisão aprovada
- Decisão reprovada
- Decisão pendente
- Motivo
- Responsável
- Trilha de decisão

Doa para:

```text
aval-financeiro
instalacao
pi-importacao
rh-homologacao
logs
```

Herda de:

```text
financeiro
pedidos
instalação
homologação
```

Ponto de controle:

- A auditoria classificou como parcial porque poucos módulos parecem criar decisões formais diretamente.

---

### 14.4 Gatilhos & Prazo

Rota:

```text
financeiro
```

Arquivos citados:

```text
src/gatilhos-engine.js
src/financeiro.jsx
src/eventos-fluxo-store.js
```

Entra:

- Evento
- SLA
- Data de vencimento
- Prazo
- Status
- Módulo de origem

Sai:

- Gatilho criado
- Gatilho vencido
- Gatilho concluído
- Alerta
- KPI financeiro

Doa para:

```text
dashboard
notificacoes
financeiro
central-de-decisoes
```

Herda de:

```text
propostas
contratos
pagamentos
pi-importacao
embarques
```

Ponto crítico:

- `days_left` armazenado pode divergir da data real.
- Dashboard deve recalcular a partir de `due_date`.

---

### 14.5 Logs de Atividade

Rota:

```text
logs
```

Arquivos citados:

```text
src/vp-log.js
src/logs-admin.jsx
```

Tabela citada:

```text
vp_logs
```

Entra:

- Ação do usuário
- Módulo
- Registro
- Data/hora
- Objeto alterado

Sai:

- Auditoria
- Histórico de ação
- Rastreabilidade

Doa para:

```text
administração
governança
segurança
```

Herda de:

```text
todos os módulos auditáveis
```

Ponto de controle:

- Logs foram confirmados como reais e restritos a admin.

---

### 14.6 Configurações do Sistema

Rota:

```text
configuracoes
```

Arquivos citados:

```text
src/colaboradores-admin-store.js
src/colaboradores-admin.jsx
src/shell.jsx
```

Tabela citada:

```text
colaborador_alocacoes
```

Entra:

- Colaborador
- Perfil
- Grupo de módulo
- Alocação
- Permissões visuais

Sai:

- Sidebar filtrada
- Módulos alocados
- Governança de acesso

Doa para:

```text
shell.jsx
sidebar
usuário logado
administração
```

Herda de:

```text
colaboradores_vpsistema
configurações administrativas
```

Ponto de controle:

- Configurações filtram a sidebar, mas permissões críticas também devem existir no roteamento e, idealmente, no banco.

---

## 15. Matriz completa — O que entra e o que sai

| Etapa | Condutor | Entra | Sai | Doa para | Herda de |
|---|---|---|---|---|---|
| Cliente | Comercial/Admin | Dados cadastrais | `cliente_id` | Lead, Proposta, Contrato, Dossiê | Lead, contrato, obra |
| Fornecedor | Suprimentos/Admin | Dados do fornecedor | `fornecedor_id` | Cotação, P.I., RFQ, IMS | Histórico de compra |
| Produto | Engenharia/Fiscal | Produto, NCM, dados técnicos | Catálogo/Ficha | Proposta, Pedido, P.I. | Engenharia/NCM |
| Lead | Comercial | Oportunidade | Contexto comercial | Formulário, Proposta | Cliente |
| Formulário | Comercial | Lead, equipamento | Especificação | Cotação, Precificação, Proposta | Lead |
| Controle de Cotações | Comercial | Formulário, histórico | Rastreabilidade | Fornecedor, Proposta | Formulário |
| Cotação Fornecedor | Comercial/Suprimentos | Especificação, fornecedor | Preço base | Precificação, P.I. | Formulário, Fornecedor |
| Precificação | Financeiro | Cotação, impostos, custos | Preço final | Proposta, Aval | Cotação |
| Proposta | Comercial | Lead, preço, escopo | Proposta/PDF | Contrato, Aval | Precificação |
| Contrato Venda | Jurídico | Proposta, cliente | Contrato assinado | P.I., Dossiê | Proposta |
| Aval Financeiro | Financeiro | Contrato, sinal | Liberação/reprovação | P.I., Decisões | Contrato |
| P.I. | Importação | Contrato, fornecedor, produto | Compra formal | Embarque, RFQ | Aval/Contrato |
| RFQ | Suprimentos | Necessidade de cotação | Comparativo | P.I., IMS | Fornecedor/Produto |
| IMS | Logística | Carga, obra, recursos | Recursos contratados | Instalação | Embarque/Obra |
| Embarque | Importação | P.I., frete, container | ETA/Entrega | Obra, Cronograma | P.I. |
| Engenharia | Engenharia | Formulário, produto | Projeto/BOM | Ficha, Instalação | Comercial |
| Ficha Técnica | Engenharia | Produto, NCM, projeto | Ficha | Pedido, Contrato, P.I. | Produto |
| Dossiê | Obra | Contrato, projeto, cliente | Prontuário | Vistoria, Instalação | Contrato |
| Vistoria | Engenharia | Obra, fase | Liberação/pendência | Dossiê, Instalação | Dossiê |
| Homologação | RH | Parceiro, documentos | Instalador apto | Contrato Instalador | Cadastro/Obra |
| Contrato Instalador | Jurídico/RH | Instalador, escopo | Mão de obra contratada | Instalação | RH/Dossiê |
| Instalação | Obra | Gates aprovados | Execução/testes | ART, Data Book | Dossiê |
| ART | Engenharia | Projeto/obra | Documento legal | Data Book | Instalação |
| Cronograma | Obra | Datas, equipe, atrasos | Planejado/realizado | Dashboard | Instalação/Embarque |
| Data Book | Engenharia | Evidências | Pacote documental | Handover | ART/Instalação |
| Handover | Engenharia/Comercial | Data Book, aceite | Termo final | Pós-venda | Data Book |
| Dashboard | Governança | Todos os dados | KPI | Gestão | Todos |
| Logs | Governança | Ações | Auditoria | Admin | Todos |
| Configurações | Admin | Colaborador/módulo | Acesso | Sidebar | Colaboradores |

---

## 16. Ramificações críticas do vai e vem

### 16.1 Proposta recusada

```text
Proposta recusada
  ↓
Comercial analisa motivo
  ↓
[Preço alto] → Precificação
[Escopo errado] → Formulário / Engenharia
[Fornecedor caro] → Cotação a Fornecedor / RFQ
[Condição comercial] → Proposta
```

Situação na auditoria:

- Não foi encontrado retorno automático rastreável forte.
- O usuário provavelmente precisa navegar manualmente.

---

### 16.2 Contrato pendente

```text
Contrato pendente
  ↓
Jurídico / Comercial
  ↓
[Minuta pendente] → Jurídico
[Cliente não assinou] → Notificação / Gatilho
[Condição divergente] → Proposta
[Dados cadastrais errados] → Clientes
```

Situação na auditoria:

- Parcial.
- Status existe, mas gatilho automático associado não foi confirmado.

---

### 16.3 Aval financeiro reprovado

```text
Aval reprovado
  ↓
Financeiro
  ↓
[Margem ruim] → Precificação
[Sinal insuficiente] → Comercial / Cliente
[Risco de caixa] → Central de Decisões
[Condição inadequada] → Proposta / Contrato
```

Situação na auditoria:

- Confirmado como vai e vem suportado pelo `aval-financeiro-store.js` e `DecisoesStore`.

---

### 16.4 P.I. incompleta

```text
P.I. incompleta
  ↓
Importação
  ↓
[Fornecedor ausente] → Cadastro Fornecedor / Cotação
[Produto/NCM ausente] → Catálogo / Ficha Técnica
[Contrato não assinado] → Jurídico
[Aval ausente] → Financeiro
[Pagamento ausente] → Gatilhos & Prazo
```

Situação na auditoria:

- Gate estrutural antes da P.I. precisa ser endurecido.

---

### 16.5 Embarque atrasado

```text
Embarque atrasado
  ↓
Importação
  ↓
Dashboard
Notificações
Dossiê da Obra
Cronograma
IMS
Cliente / Comercial
```

Situação na auditoria:

- Parcial.
- O risco é o atraso estar em `embarques_importacao`, mas o Dashboard ler `embarques`.

---

### 16.6 Vistoria com pendência

```text
Vistoria com pendência
  ↓
Classificar pendência
  ↓
[Civil] → Cliente / Obra
[Técnica] → Engenharia
[Recurso físico] → IMS
[Documental] → Dossiê / Jurídico
[Segurança] → Bloqueio de instalação
```

Situação na auditoria:

- Confirmado parcialmente.
- Há duplicidade de mecanismos de vistoria.

---

### 16.7 Instalador não homologado

```text
Instalador não homologado
  ↓
RH
  ↓
[Documento vencido] → regularização
[Não apto] → substituição
[Contrato já criado] → risco jurídico/operacional
[Obra bloqueada] → Instalação não deve iniciar
```

Situação na auditoria:

- Homologação bloqueia mais adiante na Instalação.
- Não bloqueia na criação do Contrato Instalador.

---

### 16.8 Data Book incompleto

```text
Data Book incompleto
  ↓
Engenharia / Documentação
  ↓
[ART ausente] → ART
[Teste ausente] → Instalação
[Manual ausente] → Engenharia / Fornecedor
[Assinatura ausente] → Cliente
[Certificado ausente] → Engenharia
```

Situação na auditoria:

- Quebrado arquiteturalmente porque Data Book/Handover usam `projetos`, não a esteira real `dossier_obra`.

---

## 17. Gates necessários do fluxo ideal

### 17.1 Gate para enviar ao fornecedor

Deve exigir:

- Cliente ou lead identificado
- Equipamento definido
- Quantidade definida
- Dados técnicos mínimos
- Número de cotação gerado
- Fornecedor selecionado

Bloqueia:

```text
Cotação a Fornecedor
```

Se falhar:

```text
Volta para Lead / Formulário / Cadastro Fornecedor
```

---

### 17.2 Gate para precificar

Deve exigir:

- Cotação respondida
- Preço base
- Moeda
- Prazo
- Condições
- Produto/equipamento definido

Bloqueia:

```text
Precificação
```

Se falhar:

```text
Volta para Cotação a Fornecedor
```

---

### 17.3 Gate para proposta

Deve exigir:

- Precificação válida
- Margem mínima
- Escopo técnico mínimo
- Cliente identificado
- Condições comerciais definidas

Bloqueia:

```text
Proposta Comercial
```

Se falhar:

```text
Volta para Precificação / Formulário / Cliente
```

---

### 17.4 Gate para contrato

Deve exigir:

- Proposta aprovada
- Cliente válido
- Objeto definido
- Preço e condições definidos

Bloqueia:

```text
Contrato Venda de Equipamentos
```

Se falhar:

```text
Volta para Proposta / Cliente / Precificação
```

Ponto da auditoria:

- Esse bloqueio não foi confirmado como real.

---

### 17.5 Gate para P.I. / compra

Deve exigir:

- Contrato assinado
- Sinal pago
- Aval financeiro aprovado
- Fornecedor válido
- Produto/NCM válido
- Aprovação executiva, se regra exigir

Bloqueia:

```text
P.I.
Compra
Pagamento ao fornecedor
```

Se falhar:

```text
Volta para Jurídico / Financeiro / Produto / Fornecedor
```

Ponto da auditoria:

- Gate aparece como intenção forte, mas há caminhos onde P.I. nasce solta.

---

### 17.6 Gate para instalação

Deve exigir:

- Contrato assinado
- Pagamento/sinal liberado
- Projeto aprovado
- Equipamento entregue ou em condição de instalar
- Vistoria aprovada
- Instalador homologado
- Instalador vinculado à obra
- Recursos IMS resolvidos

Bloqueia:

```text
Instalação em Campo
```

Se falhar:

```text
Volta para Financeiro / Engenharia / RH / Vistorias / IMS / Importação
```

Ponto da auditoria:

- `InstalacaoObraStore.obterChecklistObraPronta` é o gate mais completo encontrado.
- Confirmar se a UI bloqueia ou apenas exibe.

---

### 17.7 Gate para Data Book / Handover

Deve exigir:

- Instalação concluída
- Testes concluídos
- ART entregue
- Manuais anexados
- Certificados anexados
- Treinamento realizado
- Aceite do cliente

Bloqueia:

```text
Termo de Entrega
Handover
```

Se falhar:

```text
Volta para Instalação / Engenharia / ART / Cliente
```

Ponto da auditoria:

- Trilho está arquiteturalmente desconectado por usar `projetos`.

---

## 18. Sequência completa para Claude Code validar no código

```text
1. Vendedor cria ou atualiza Lead.
2. Lead gera ou alimenta Formulário de Elevador.
3. Formulário gera número de cotação / Master ID.
4. Controle de Cotações agrupa histórico pelo número de cotação.
5. Cotação a Fornecedor herda dados do formulário e fornecedor.
6. Tratativas registram mensagens, anexos e revisões.
7. Cotação respondida alimenta Precificação.
8. Precificação calcula preço, margem, impostos, DIFAL, custos e comissão.
9. Proposta herda Lead + Formulário + Cotação + Precificação.
10. Proposta enviada aguarda cliente.
11. Proposta aprovada deve liberar Contrato Venda.
12. Contrato Venda herda proposta, cliente, objeto e preço.
13. Contrato assinado + sinal + aval financeiro devem liberar compra.
14. Aval Financeiro aprova, reprova ou envia para decisão.
15. P.I. formaliza compra com fornecedor.
16. RFQ compara fornecedor/frete/recurso quando necessário.
17. IMS planeja transporte, munck, empilhadeira, andaime e apoio.
18. Embarque herda P.I. e controla produção, ETD, ETA, aduana e entrega.
19. Engenharia herda formulário/proposta/produto e gera projeto.
20. Ficha Técnica herda produto/NCM/engenharia e gera identidade técnica/fiscal.
21. Dossiê da Obra nasce conectado ao contrato/proposta/cliente.
22. Vistorias alimentam Dossiê e liberam ou bloqueiam obra.
23. RH homologa parceiro instalador.
24. Contrato Instalador formaliza mão de obra por obra/equipamento.
25. Instalação herda Dossiê, projeto, contrato, financeiro, RH, embarque e IMS.
26. Cronograma acompanha execução e reprogramações.
27. ART formaliza responsabilidade técnica.
28. Data Book reúne evidências, documentos, testes, manuais e certificados.
29. Handover entrega termo, aceite, treinamento, garantia e transição pós-venda.
30. Dashboard, Logs, Notificações, Decisões e Gatilhos atravessam todas as etapas.
```

---

## 19. Lista de correções estruturais antes de chamar isso de fluxo totalmente confiável

### 19.1 Segurança

```text
Adicionar aval-financeiro ao RESTRICTED de app.jsx.
```

Impacto:

- Impede acesso financeiro indevido por rota direta.

---

### 19.2 NCM

```text
Decidir: recriar ncm_solicitacoes ou remover/desativar UI do Kanban NCM.
```

Impacto:

- Evita botão que sempre falha.
- Evita dashboard silenciosamente vazio.

---

### 19.3 Dashboard

```text
Unificar fontes de KPI.
```

Corrigir:

- Propostas enviadas.
- `days_left`.
- Embarques legado x novo.
- NCM quebrado.

---

### 19.4 Embarques

```text
Criar ponte ou migração entre embarques e embarques_importacao.
```

Impacto:

- Evita que a operação atualize um embarque e a gestão veja outro.

---

### 19.5 Vistorias

```text
Escolher vistorias_obras como fonte única.
Aposentar projetos.vistoria se for legado.
```

Impacto:

- Evita duas verdades para vistoria.

---

### 19.6 Fechamento de obra

```text
Migrar ART / Cronograma / Data Book / Handover para dossier_obra.
```

Impacto:

- Reconecta a entrega final à obra real.

---

### 19.7 Gates reais

```text
Transformar gates visuais em bloqueios estruturais.
```

Aplicar em:

- Proposta → Contrato
- Contrato/Sinal/Aval → P.I.
- Homologação → Contrato Instalador
- Instalação → Data Book
- Data Book → Handover

---

## 20. Prompt para Claude Code aprofundar sem alterar nada

```text
Leia este documento como mapa operacional do VP Gestão.

Objetivo:
Validar no código cada caminho descrito desde o primeiro gatilho comercial — vendedor coleta dados do cliente/equipamento e envia ao fornecedor — até a entrega do Termo de Conclusão / Handover.

Regras:
- Não altere arquivos.
- Não faça commit.
- Não crie branch.
- Não rode migração.
- Apenas leia, cruze evidências e marque Confirmado, Parcial, Quebrado, Planejado ou Não encontrado.
- Para cada caminho, informe arquivo, função, store, tabela e rota.
- Se um ponto não tiver evidência, escreva: “não encontrei evidência”.
- Não presuma que `.from('tabela')` significa tabela existente; confirmar no Supabase se permitido.
- Separar fluxo novo de fluxo legado.
- Separar gate visual de gate bloqueante.
- Separar UI existente de persistência real.

Entregável:
Gerar relatório técnico em Markdown com:
1. Caminho Comercial
2. Caminho Fornecedor
3. Caminho Precificação
4. Caminho Proposta
5. Caminho Contrato
6. Caminho Aval Financeiro
7. Caminho P.I. / RFQ / IMS / Embarque
8. Caminho Engenharia
9. Caminho Dossiê / Vistorias
10. Caminho RH / Contrato Instalador
11. Caminho Instalação
12. Caminho ART / Data Book / Handover
13. Caminhos transversais: Dashboard, Notificações, Decisões, Gatilhos, Logs e Configurações
14. Matriz entra/sai
15. Matriz doa/herda
16. Ramificações e retornos
17. Pontos quebrados
18. Recomendações de correção em ordem de impacto
```

---

## 21. Conclusão

O caminho correto do VP Gestão é poderoso porque, quando bem conectado, ele evita perda de informação entre Comercial, Fornecedor, Financeiro, Jurídico, Importação, Engenharia, Obra e Entrega.

A essência do sistema é esta:

```text
O vendedor não cria apenas uma oportunidade.
Ele inicia uma cadeia de dados que deve sobreviver até o termo final de conclusão.
```

Por isso, cada etapa precisa responder:

```text
O que recebi?
De quem recebi?
O que validei?
O que bloqueei?
O que gerei?
Para quem entreguei?
Qual evidência ficou registrada?
```

Quando essa lógica estiver fechada, o VP Gestão deixará de ser apenas um sistema de telas e se tornará uma verdadeira esteira operacional auditável para venda, fornecimento, importação, instalação e entrega de equipamentos de transporte vertical.
