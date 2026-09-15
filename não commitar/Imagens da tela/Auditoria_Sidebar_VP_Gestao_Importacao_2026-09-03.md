# Auditoria de Arquitetura de Informação e Sidebar
## VP Gestão de Importação — VerticalParts

**Projeto analisado:** `verticalpartsIA/010_GestaoImportacao`  
**Data da análise:** 03/09/2026  
**Escopo:** arquitetura de informação, navegação, localização funcional das rotas e coerência da Sidebar.  
**Regra desta auditoria:** **somente leitura**. Nenhuma alteração em código, banco, GitHub ou Supabase foi realizada.

---

## 1. Resumo executivo

A Sidebar atual não está “errada” como um todo. Ela cresceu acompanhando a evolução funcional do sistema e contém boa parte dos elementos necessários. O problema é outro: **ela mistura critérios de organização diferentes no mesmo nível**.

Hoje existem, lado a lado:

- grupos por **departamento**: `Engenharia`, `Jurídico`, `RH Operacional`;
- grupos por **processo**: `Importação / Suprimentos`, `Logística`;
- grupos por **natureza da informação**: `Cadastros`, `Portal Admin`;
- telas por **fase da jornada**: `Propostas`, `Precificação`, `Vistorias`, `Entrega Final`;
- telas por **objeto de negócio**: `Clientes`, `Produtos`, `Empresas Instaladoras`.

Isso cria uma arquitetura compreensível para quem conhece profundamente o sistema, mas mais difícil para o usuário que pensa:

> “O que eu preciso fazer agora?”

em vez de:

> “Qual departamento tecnicamente é dono desta tela?”

A recomendação principal desta auditoria é migrar gradualmente de uma Sidebar predominantemente departamental para uma Sidebar **orientada à jornada de trabalho**, mantendo permissões por perfil e atalhos contextuais.

A lógica sugerida é:

**Geral → Pré-venda → Contratação/Financeiro → Suprimentos/Importação → Engenharia/Produto → Obras/Instalação → Entrega/Documentação**

com módulos auxiliares de:

**Parceiros/Instaladores → Logística → Cadastros Mestres → Administração**

Essa estrutura acompanha o fluxo real do sistema e reduz o “vai e volta” mental do usuário.

---

# 2. Diagnóstico principal

## 2.1 A Sidebar atual tenta ser simultaneamente organograma e fluxo operacional

O arquivo atual apresenta:

- Geral
- Cadastros
- Comercial
- ADM / Financeiro
- Jurídico
- Importação / Suprimentos
- Engenharia
- RH Operacional
- Logística
- Portal Admin

O próprio código da Sidebar declara que sua ordem tenta seguir:

> pré-venda → contrato/importação/suprimentos → engenharia → RH → logística → admin

Entretanto, o processo real do projeto não é puramente linear por departamento.

Exemplos:

- a Ficha Técnica começa no Comercial, passa pela Engenharia, volta ao Comercial, passa pelo Financeiro, Cliente e depois Importação;
- a vistoria e a homologação do instalador podem acontecer enquanto o equipamento ainda está em trânsito;
- ART pode ser providenciada antes da chegada física do equipamento;
- Contrato do Instalador pertence juridicamente ao Jurídico, mas operacionalmente faz parte da contratação do parceiro para uma obra;
- Pagamento do Instalador pertence financeiramente ao Financeiro, mas para o usuário está ligado ao mesmo ciclo do parceiro/obra;
- Central de Documentos agrega documentos de Engenharia, RH e instalação, portanto não é uma função exclusivamente de Engenharia.

**Conclusão:** o sistema já é transversal, mas a Sidebar ainda representa vários silos organizacionais.

---

# 3. Princípios usados nesta proposta

A nova árvore foi pensada usando seis critérios.

### 3.1 Jornada do usuário

Telas usadas em sequência devem ficar próximas.

### 3.2 Intenção

O usuário deve encontrar a função pela pergunta que faria naturalmente.

Exemplo:

> “Quero acompanhar minha obra.”

deveria levá-lo a um módulo de **Obras**, e não obrigá-lo a saber que a funcionalidade está tecnicamente dentro de Engenharia.

### 3.3 Dono operacional x dono jurídico/administrativo

A localização primária deve priorizar **onde a tarefa é executada na jornada**.

A responsabilidade e a permissão continuam podendo pertencer a outro setor.

### 3.4 Redução de duplicidade semântica

Itens diferentes não devem parecer executar a mesma coisa.

### 3.5 Progressive disclosure

A Sidebar não precisa funcionar como mapa completo do banco ou inventário de todas as telas.

Páginas de detalhe, assistentes, resultados e subtelas podem aparecer dentro da rota principal.

### 3.6 Contexto

Quando uma ação depende de uma cotação, obra, fornecedor ou cliente, o melhor acesso frequentemente é **dentro daquele objeto**, e não outro item global na Sidebar.

---

# 4. Achados de maior prioridade

## ACHADO 01 — Dossier da Obra existe, mas não aparece na Sidebar

**Severidade de UX: ALTA**

O roteador conhece explicitamente:

`dossier-obra`

e o próprio sistema usa o Dossier como agregador da obra.

Além disso, o fluxo operacional documentado coloca várias atividades dentro dele:

- vistorias;
- instalação;
- checklist;
- documentos;
- definição de recursos;
- informações do recebimento.

### Problema

Um objeto extremamente importante existe, mas sua descoberta depende de outra tela encaminhar o usuário até ele.

Isso gera navegação indireta.

### Sugestão

Criar dentro de `OBRAS & INSTALAÇÃO`:

- **Dossiês de Obras**

ou

- **Obras / Dossiês**

### Benefício

O usuário passa a pensar:

`Obra → Dossiê → Vistoria / Instalação / Documento / Status`

em vez de procurar cada fragmento individualmente na Sidebar.

---

## ACHADO 02 — Engenharia está sobrecarregada

**Severidade de UX: ALTA**

Hoje Engenharia contém aproximadamente quinze destinos, incluindo funções de naturezas muito diferentes:

- engenharia de produto;
- desenho técnico;
- ficha técnica;
- vistoria;
- execução de obra;
- acompanhamento;
- documentos;
- ART;
- cronograma;
- Data Book;
- entrega final.

### Problema

“Engenharia” tornou-se um grande recipiente.

O usuário precisa memorizar que:

- documentos estão em Engenharia;
- entrega está em Engenharia;
- status de obra está em Engenharia;
- cronograma está em Engenharia.

Isso aumenta o custo cognitivo.

### Sugestão

Dividir o atual bloco em pelo menos três áreas:

1. `ENGENHARIA & PRODUTO`
2. `OBRAS & INSTALAÇÃO`
3. `ENTREGA & DOCUMENTAÇÃO`

### Benefício

Cria uma separação natural entre:

`definir o que será construído`

`executar/acompanhar a obra`

`fechar documentalmente e entregar`

---

## ACHADO 03 — Ficha Técnica: manter perto da Engenharia, mas mudar seu contexto

**Severidade de UX: MÉDIA**

Este é um caso importante porque uma simples mudança de pasta poderia piorar o fluxo.

O código define explicitamente o workflow da Ficha Técnica:

`Comercial → Engenharia → Comercial → Financeiro → Comercial → Cliente → Importação → Publicado`

A Engenharia é responsável por completar tecnicamente a ficha e eventualmente o desenho.

Portanto:

**Ficha Técnica não está conceitualmente errada em Engenharia.**

O erro seria tratá-la como uma função **exclusivamente** de Engenharia.

### Sugestão

Renomear o agrupamento:

`ENGENHARIA`

para:

`ENGENHARIA & PRODUTO`

e manter ali:

- Ficha Técnica
- Projeto de Elevadores
- Projeto de Equipamento
- Projetos ER/ES
- Produtos / Catálogo

Ao mesmo tempo, permitir acesso contextual à mesma Ficha a partir de:

- Lead/Formulário;
- Produto;
- Cotação;
- Dossiê quando pertinente.

### Benefício

A rota mantém um “lar” lógico, sem obrigar Comercial ou Importação a navegar manualmente até Engenharia para continuar o mesmo processo.

---

## ACHADO 04 — Cotações a Fornecedor não deveria parecer uma função financeira

**Severidade de UX: ALTA**

Hoje:

`ADM / FINANCEIRO → Cotações a Fornecedor`

### Problema

Financeiro utiliza o resultado da cotação para precificação e avaliação, mas a cotação ao fornecedor é uma atividade de sourcing/suprimentos/comercial/importação.

O fluxo real documentado inclui negociação final com fornecedor e RFQ antes da formação definitiva de vários custos.

### Sugestão

Remover `Cotações a Fornecedor` de `ADM / FINANCEIRO`.

Há duas alternativas defensáveis:

**Opção recomendada**

`COMERCIAL / PRÉ-VENDA → Cotações a Fornecedor`

porque ela fica ao lado de:

- Formulários;
- Controle de Cotações;
- Precificação;
- Propostas.

**Alternativa organizacional**

`SUPRIMENTOS / IMPORTAÇÃO → Cotações a Fornecedor`

se a VerticalParts considerar formalmente Suprimentos como dono dessa negociação.

### Minha preferência

Para reduzir cliques na pré-venda, colocaria a entrada principal próxima de **Controle de Cotações**.

---

## ACHADO 05 — Atualização de Custos não é um cadastro genérico

**Severidade de UX: MÉDIA/ALTA**

Hoje:

`CADASTROS → Atualização de Custos`

### Problema

Esse nome descreve uma atividade financeira/comercial de manutenção da base de precificação, não um cadastro mestre semelhante a Cliente ou Fornecedor.

### Sugestão

Mover para:

`FINANCEIRO & PREÇOS → Tabelas / Atualização de Custos`

### Benefício

Tudo que altera formação de preço passa a morar no mesmo domínio mental:

- custos;
- câmbio;
- precificação;
- análise;
- avaliação.

---

## ACHADO 06 — Ciclo do Instalador está fragmentado em quatro lugares

**Severidade de UX: ALTA**

Hoje o mesmo parceiro aparece em:

`CADASTROS`
- Empresas Instaladoras

`JURÍDICO`
- Contrato Instalador

`ADM / FINANCEIRO`
- Pagamentos a Instaladores

`RH OPERACIONAL`
- Homologação de Instaladores

### Problema

Do ponto de vista interno cada localização tem justificativa.

Do ponto de vista do usuário existe um único objeto:

**INSTALADOR / PARCEIRO**

com um ciclo:

`Cadastrar → Homologar → Contratar → Vincular à obra → Executar → Medir/Pagar`

### Sugestão

Criar:

`PARCEIROS & INSTALADORES`

com:

- Empresas Instaladoras
- Homologação de Instaladores
- Contratos de Instaladores
- Pagamentos a Instaladores

As permissões continuam separadas.

Exemplo:

- RH edita homologação;
- Jurídico edita contrato;
- Financeiro edita pagamento;
- Engenharia consulta tudo.

### Benefício

Reduz quatro “viagens” entre módulos para acompanhar um único parceiro.

---

## ACHADO 07 — Central de Documentos não é uma função de Engenharia

**Severidade de UX: ALTA**

O próprio componente declara que a Central de Documentos é uma biblioteca virtual agregada por obra contendo:

- Vistorias;
- ART;
- Data Book;
- Termo;
- documentação do montador/RH.

### Problema

O conteúdo é transversal e voltado ao fechamento documental da obra.

### Sugestão

Mover:

`ENGENHARIA → Central de Documentos`

para:

`ENTREGA & DOCUMENTAÇÃO → Central de Documentos`

### Benefício

O nome da seção passa a corresponder exatamente à intenção do usuário.

---

## ACHADO 08 — Data Book, Termo e Entrega Final merecem um domínio próprio

**Severidade de UX: MÉDIA/ALTA**

Hoje:

`ENGENHARIA`
- Data Book & Termo
- Entrega Final

O fluxo real mostra que a entrega envolve:

- ART;
- documentação;
- manuais;
- assinatura;
- treinamento;
- suporte;
- garantia;
- transição para manutenção.

Isso já ultrapassa “Engenharia”.

### Sugestão

Criar:

`ENTREGA & DOCUMENTAÇÃO`

com:

- Central de Documentos
- Data Book & Termo
- Entrega Final

Opcionalmente:

- ART, quando a principal intenção for “documentação legal da obra”.

### Benefício

Cria um estágio claro de encerramento do projeto.

---

## ACHADO 09 — Embarques e Importação têm sobreposição semântica

**Severidade de UX: ALTA**

O próprio comentário no código registra que existe sobreposição de conteúdo entre:

- `Embarques`
- `Importação`

e que essa sobreposição ainda não foi resolvida.

### Problema

Um usuário querendo saber:

> “Onde está meu container?”

pode não saber se entra em:

- Embarques;
- Importação;
- Painel;
- IMS.

### Sugestão de evolução

Consolidar, no futuro:

`Embarques & Rastreamento`

com abas:

- Visão Geral
- Booking
- Navio
- Containers
- Tracking/AIS
- Aduaneiro
- Custos
- Entrega
- Histórico

Até uma consolidação funcional ser feita, pelo menos renomear a rota legada:

`Importação`

para algo semanticamente explícito, por exemplo:

`Rastreamento / Operação Legada`

ou o nome da função real que permanece exclusiva dela.

### Benefício

Elimina duas entradas aparentemente equivalentes.

---

## ACHADO 10 — Vistorias estão representadas como envio + resultado

Hoje:

- Vistorias de Obras
- Resultado Vistorias de Obras

### Problema

É o mesmo objeto de negócio em fases diferentes.

### Sugestão

Sidebar:

`Vistorias de Obras`

Dentro da tela:

- Planejar / Agendar
- Enviar / Executar
- Em andamento
- Resultados
- Pendências / NC
- Histórico

### Benefício

O usuário não precisa decidir antecipadamente qual “lado” da vistoria ele está procurando.

---

## ACHADO 11 — “Linha do Tempo da Cotação” não é Engenharia

### Problema

Linha do tempo é uma visão transversal do processo.

Ela pode conter acontecimentos de:

- Comercial;
- Financeiro;
- Jurídico;
- Importação;
- Engenharia;
- Obra.

### Sugestão

Há duas opções melhores:

1. colocar a linha do tempo **dentro do detalhe da Cotação/Dossiê**, que é a opção preferível;
2. se continuar como item global, mover para `GERAL / CONTROLE`.

### Benefício

Transforma a timeline em histórico do objeto, e não “ferramenta da Engenharia”.

---

## ACHADO 12 — Itens planejados não deveriam disputar atenção com rotas funcionais

O código da Sidebar mantém itens planejados:

- Expedição
- Logística

sem rota própria.

### Problema

Mesmo visualmente desabilitados, aumentam:

- comprimento do menu;
- ruído;
- expectativa de funcionalidade.

### Sugestão

Em produção:

- ocultar itens ainda não utilizáveis;

ou:

- apresentar “Em breve” em uma área administrativa/roadmap, não no fluxo normal.

### Benefício

Cada item visível na navegação passa a significar:

> “Posso entrar aqui e realizar alguma coisa.”

---

# 5. Nova árvore sugerida

Abaixo está a arquitetura que considero mais coerente para o estágio atual do VP Gestão.

```text
VP GESTÃO
│
├── GERAL
│   ├── Dashboard
│   ├── Notificações
│   ├── Central de Decisões
│   └── Prazos & Pendências
│
├── COMERCIAL | PRÉ-VENDA
│   ├── Leads
│   ├── Formulários Técnico-Comerciais
│   ├── Controle de Cotações
│   ├── Cotações a Fornecedor
│   └── Propostas
│
├── FINANCEIRO | PREÇOS
│   ├── Atualização / Tabelas de Custos
│   ├── Precificação
│   ├── Aval Financeiro
│   └── Comissões
│
├── CONTRATOS | JURÍDICO
│   ├── Contratos de Venda
│   └── Contratos & Minutas
│
├── SUPRIMENTOS | IMPORTAÇÃO
│   ├── Gestão de Importação
│   │   ├── Painel
│   │   ├── P.I.
│   │   ├── RFQ
│   │   ├── IMS
│   │   ├── Embarques
│   │   ├── Rastreamento / Importação
│   │   └── Análise de Preços
│   │
│   ├── Compras Nacional
│   └── Pedidos
│
├── ENGENHARIA | PRODUTO
│   ├── Painel de Engenharia
│   ├── Produtos / Catálogo
│   ├── Projeto de Elevadores
│   ├── Projeto de Equipamento
│   ├── Projetos ER / ES
│   └── Ficha Técnica
│
├── OBRAS | INSTALAÇÃO
│   ├── Dossiês de Obras
│   ├── Vistorias de Obras
│   ├── Status de Obras
│   ├── Instalação em Campo
│   ├── Cronograma
│   └── ART
│
├── ENTREGA | DOCUMENTAÇÃO
│   ├── Central de Documentos
│   ├── Data Book & Termo
│   └── Entrega Final
│
├── PARCEIROS | INSTALADORES
│   ├── Empresas Instaladoras
│   ├── Homologação de Instaladores
│   ├── Contratos de Instaladores
│   └── Pagamentos a Instaladores
│
├── LOGÍSTICA INTERNA
│   └── Almoxarifado
│
├── CADASTROS MESTRES
│   ├── Clientes
│   └── Fornecedores
│
└── ADMINISTRAÇÃO
    ├── Logs de Atividade
    └── Configurações do Sistema
```

---

# 6. Por que essa árvore funciona melhor

Ela cria um caminho praticamente legível como frase:

```text
Lead
  ↓
Formulário
  ↓
Controle / Cotação a Fornecedor
  ↓
Precificação
  ↓
Proposta
  ↓
Aval Financeiro
  ↓
Contrato
  ↓
P.I. / RFQ / IMS / Embarque
  ↓
Engenharia / Ficha / Projeto
  ↓
Dossiê / Vistoria
  ↓
Instalação
  ↓
Documentação
  ↓
Entrega Final
```

O processo real tem paralelismos — principalmente obra/instalador durante o trânsito marítimo — portanto a Sidebar não deve sugerir que tudo é uma sequência obrigatória.

Mas a ordem acima entrega ao usuário uma **linha narrativa reconhecível**.

---

# 7. Mapa completo: atual → sugerido

| Item atual | Local atual | Local sugerido | Decisão |
|---|---|---|---|
| Dashboard | Geral | Geral | Manter |
| Notificações | Geral | Geral | Manter |
| Central de Decisões | Geral | Geral | Manter |
| Gatilhos & Prazo | Geral | Geral como `Prazos & Pendências` | Renomear |
| Clientes | Cadastros | Cadastros Mestres | Manter em cadastro |
| Fornecedores | Cadastros | Cadastros Mestres | Manter em cadastro |
| Produtos | Cadastros | Engenharia & Produto | **Mover** |
| Empresas Instaladoras | Cadastros | Parceiros & Instaladores | **Mover** |
| Atualização de Custos | Cadastros | Financeiro & Preços | **Mover** |
| Leads | Comercial | Comercial / Pré-venda | Manter |
| Formulários | Comercial | Comercial / Pré-venda | Manter/renomear |
| Propostas | Comercial | Comercial / Pré-venda | Manter |
| Controle de Cotações | Comercial | Comercial / Pré-venda | Manter |
| Cotações a Fornecedor | ADM/Financeiro | Comercial / Pré-venda | **Mover** |
| Precificação | ADM/Financeiro | Financeiro & Preços | Manter |
| Aval Financeira | ADM/Financeiro | Financeiro & Preços | Manter |
| Comissões | ADM/Financeiro | Financeiro & Preços | Manter |
| Pagamentos a Instaladores | ADM/Financeiro | Parceiros & Instaladores | **Mover visualmente**, preservar permissão Financeiro |
| Contrato Venda de Equipamento | Jurídico | Contratos & Jurídico | Manter |
| Contrato Instalador | Jurídico | Parceiros & Instaladores | **Mover visualmente**, preservar responsabilidade Jurídico |
| Contratos & Minutas | Jurídico | Contratos & Jurídico | Manter |
| Painel GI | Importação | Suprimentos / Importação | Manter |
| P.I. | Importação | Suprimentos / Importação | Manter |
| RFQ | Importação | Suprimentos / Importação | Manter |
| IMS | Importação | Suprimentos / Importação | Manter |
| Embarques | Importação | Suprimentos / Importação | Manter |
| Importação | Importação | Rastreamento/Importação | Renomear ou fundir |
| Análise de Preços | Importação | Suprimentos / Importação | Manter |
| Compras Nacional | Importação/Suprimentos | Suprimentos / Importação | Manter |
| Pedidos | Importação/Suprimentos | Suprimentos / Importação | Manter |
| Engenharia | Engenharia | Engenharia & Produto como `Painel de Engenharia` | Renomear |
| Projeto de Elevadores | Engenharia | Engenharia & Produto | Manter |
| Projeto de Equipamento | Engenharia | Engenharia & Produto | Manter |
| Projetos ER/E | Engenharia | Engenharia & Produto | Manter |
| Ficha Técnica | Engenharia | Engenharia & Produto | **Manter**, mas tornar transversal |
| Vistorias de Obras | Engenharia | Obras & Instalação | **Mover** |
| Resultado Vistorias | Engenharia | dentro de `Vistorias de Obras` | **Consolidar** |
| Instalação em Campo | Engenharia | Obras & Instalação | **Mover** |
| Status de Obras | Engenharia | Obras & Instalação | **Mover** |
| Linha do Tempo da Cotação | Engenharia | detalhe da Cotação/Dossiê ou Geral | **Mover** |
| Central de Documentos | Engenharia | Entrega & Documentação | **Mover** |
| ART | Engenharia | Obras & Instalação | **Mover de grupo** |
| Cronograma | Engenharia | Obras & Instalação | **Mover** |
| Data Book & Termo | Engenharia | Entrega & Documentação | **Mover** |
| Entrega Final | Engenharia | Entrega & Documentação | **Mover** |
| Homologação de Instaladores | RH | Parceiros & Instaladores | **Mover visualmente** |
| Almoxarifado | Logística | Logística Interna | Manter |
| Expedição | Logística | ocultar até existir rota | **Ocultar enquanto planejado** |
| Logística | Logística | ocultar até existir rota | **Ocultar enquanto planejado** |
| Logs de Atividade | Portal Admin | Administração | Manter |
| Configurações do Sistema | Portal Admin | Administração | Manter |

---

# 8. Cadastros: por que eu não eliminaria completamente o grupo

Existe um argumento forte para distribuir:

- Cliente → Comercial;
- Fornecedor → Suprimentos;
- Produto → Engenharia;
- Instalador → Parceiros.

Entretanto, cadastros mestres são utilizados transversalmente.

Por isso recomendo uma solução híbrida:

## Sidebar global

Manter apenas os cadastros realmente mestres:

- Clientes;
- Fornecedores.

## Domínios específicos

Mover:

- Produtos → Engenharia & Produto;
- Empresas Instaladoras → Parceiros & Instaladores;
- Atualização de Custos → Financeiro & Preços.

Assim `Cadastros` deixa de virar uma “gaveta de tudo que é registro”.

---

# 9. Recomendação para “Gatilhos & Prazo”

No código atual o item aparece em Geral, mas é restrito a Financeiro/Admin.

Isso gera inconsistência conceitual.

Se a função controlar SLA e gatilhos do processo inteiro:

### recomendado

manter em `GERAL`, renomear:

**Prazos & Pendências**

e mostrar para cada perfil apenas os prazos relevantes àquele usuário.

Se a tela for de fato uma ferramenta exclusivamente financeira:

### alternativa

mover para:

`FINANCEIRO & PREÇOS`

A decisão deve ser baseada no conteúdo da tela, e não apenas no nome atual.

---

# 10. A Sidebar não deve ser o único mecanismo de navegação

Para um sistema deste tamanho, uma Sidebar excelente ainda não resolve tudo.

Recomendo quatro camadas complementares.

## 10.1 Sidebar

Serve para entrar nos grandes domínios.

## 10.2 Breadcrumb

Exemplo:

`Obras > DOS-M034 > Vistorias > Vistoria 02`

## 10.3 Navegação contextual por objeto

Dentro de uma cotação:

```text
Resumo
Formulário
Cotação Fornecedor
Precificação
Proposta
Contrato
Importação
Engenharia
Obra
Documentos
Timeline
```

O usuário acompanha **a mesma cotação** sem voltar para a Sidebar.

## 10.4 “Próxima ação”

Cada objeto deveria saber qual é o próximo passo recomendado.

Exemplo:

`Proposta aprovada → Solicitar Aval Financeiro`

ou:

`Cargo Ready → Criar RFQ de Frete`

ou:

`Projeto aprovado → Providenciar ART`

Esse mecanismo é mais poderoso do que tentar transformar a Sidebar inteira em workflow.

---

# 11. Uma mudança conceitual importante: “onde mora” ≠ “quem pode editar”

Não se deve organizar a Sidebar somente com base em permissão.

Exemplo:

`PARCEIROS & INSTALADORES`

pode mostrar:

- Cadastro
- Homologação
- Contrato
- Pagamento

mas:

- RH edita Homologação;
- Jurídico edita Contrato;
- Financeiro edita Pagamento;
- Engenharia consulta dados de obra.

A IA continua coerente mesmo com permissões diferentes.

**Permissão é segurança.  
Localização é experiência do usuário.**

Esses conceitos não precisam ser iguais.

---

# 12. Nomenclatura recomendada

Alguns rótulos podem ser mais específicos.

| Atual | Sugestão |
|---|---|
| Engenharia | Painel de Engenharia |
| Formulários | Formulários Técnico-Comerciais |
| Gatilhos & Prazo | Prazos & Pendências |
| Produtos | Catálogo de Produtos |
| Atualização de Custos | Tabelas / Atualização de Custos |
| Importação | Rastreamento / Operação de Importação |
| Resultado Vistorias de Obras | remover como item global; usar aba `Resultados` |
| Linha do Tempo da Cotação | Timeline da Cotação, dentro da própria cotação |
| Contrato Instalador | Contratos de Instaladores |
| Entrega Final | Entrega & Handover, se o termo for familiar aos usuários |

---

# 13. O que eu NÃO recomendo fazer

## 13.1 Não criar mais grupos apenas para acomodar uma tela

Grupo de um único item normalmente é sinal de arquitetura fragmentada.

O atual `RH Operacional` contém apenas Homologação de Instaladores.

Isso reforça a recomendação de absorvê-lo em `Parceiros & Instaladores`.

## 13.2 Não duplicar a mesma rota em vários grupos

Exemplo ruim:

- Ficha Técnica em Comercial;
- Ficha Técnica em Engenharia;
- Ficha Técnica em Importação.

O usuário perde noção de localização.

Melhor:

**um lar principal + links contextuais**.

## 13.3 Não transformar a Sidebar em sitemap

Telas como:

- detalhe de Lead;
- detalhe de Cotação;
- resultado específico;
- editor;
- dossiê de um equipamento específico;

devem nascer do contexto.

## 13.4 Não mover rotas físicas imediatamente só porque a Sidebar mudou

É perfeitamente possível primeiro mudar somente:

- agrupamento;
- label;
- ordem;

e preservar IDs e URLs.

Depois, numa etapa controlada, decidir se os slugs de URL também devem acompanhar a nova arquitetura.

---

# 14. Prioridade de implementação sugerida

## Fase 1 — baixo risco / alto benefício

Somente Sidebar e labels.

1. Criar `Obras & Instalação`.
2. Criar `Entrega & Documentação`.
3. Criar `Parceiros & Instaladores`.
4. Mover visualmente os itens.
5. Mover Atualização de Custos.
6. Mover Cotações a Fornecedor.
7. Renomear Engenharia → Engenharia & Produto.
8. Expor Dossiês de Obras.
9. Ocultar placeholders sem rota.

Sem alterar banco.

Sem alterar regras de negócio.

Sem alterar permissões.

---

## Fase 2 — consolidação de navegação

1. Vistorias → uma entrada com abas.
2. Embarques + Importação → eliminar sobreposição.
3. Linha do Tempo → incorporar à Cotação/Dossiê.
4. Central de Documentos → integrar mais profundamente com Dossiê.
5. Criar “próxima ação” nos objetos principais.

---

## Fase 3 — arquitetura orientada ao objeto

Criar uma navegação transversal por:

**Cotação / Projeto / Obra**

permitindo percorrer:

```text
Comercial
→ Financeiro
→ Contrato
→ Importação
→ Engenharia
→ Instalação
→ Documentação
→ Entrega
```

sem retornar à Sidebar.

Essa é, na minha avaliação, a evolução que mais reduziria loops.

---

# 15. Score da Sidebar atual

Avaliação qualitativa de arquitetura de informação:

| Critério | Atual | Com proposta |
|---|---:|---:|
| Clareza dos grupos | 6/10 | 9/10 |
| Correspondência com jornada | 5/10 | 9/10 |
| Descoberta de funções | 6/10 | 9/10 |
| Coerência semântica | 5/10 | 9/10 |
| Escalabilidade | 5/10 | 8/10 |
| Redução de vai-e-vem | 5/10 | 9/10 |
| Separação entre operação e cadastro | 6/10 | 9/10 |
| Orientação de novos usuários | 5/10 | 9/10 |

### Diagnóstico

**Atual:** funcional, porém já demonstra crescimento orgânico e fragmentação.

**Proposta:** arquitetura orientada a tarefas e objetos, preservando responsabilidades e permissões.

---

# 16. Minha recomendação final

Eu **não faria apenas uma reorganização cosmética da Sidebar**.

A mudança correta é reconhecer que o VP Gestão já deixou de ser um conjunto de telas departamentais e tornou-se um **sistema operacional de ponta a ponta da jornada comercial → importação → engenharia → obra → entrega**.

Por isso eu faria quatro mudanças estruturantes:

1. separar Engenharia de Obras;
2. separar Obras de Entrega/Documentação;
3. reunir o ciclo inteiro do Instalador;
4. aproximar Cotação a Fornecedor da etapa de pré-venda/suprimentos, retirando-a do Financeiro.

E manteria a Ficha Técnica em `Engenharia & Produto`, porque o código prova que Engenharia é um participante técnico central, mas garantiria que Comercial, Financeiro e Importação possam alcançá-la pelo **contexto do mesmo produto/cotação**, sem precisar “caçá-la” manualmente.

O resultado esperado é que o usuário pare de memorizar a estrutura interna da VerticalParts e passe a navegar pela própria pergunta:

- “Estou vendendo?”
- “Estou formando preço?”
- “Estou comprando/importando?”
- “Estou definindo tecnicamente?”
- “Estou executando a obra?”
- “Estou entregando?”
- “Estou gerindo um instalador?”

Quando a Sidebar responde essas perguntas, a arquitetura começa a trabalhar a favor do usuário.

---

# 17. Evidências do projeto utilizadas

Arquivos examinados em modo somente leitura:

- `src/shell.jsx` — definição real da Sidebar.
- `src/router.js` — rotas válidas e slugs.
- `src/app.jsx` — títulos, rotas de detalhe e comportamento de deep link.
- `src/ficha-tecnica.jsx` — natureza da Ficha Técnica e sincronização com catálogo.
- `src/ficha-workflow-engine.js` — workflow transversal da Ficha Técnica.
- `src/central-documentos.jsx` — agregação documental por obra.
- `FluxogramaPortal.md` — WBS operacional derivada do código.
- árvore completa do repositório `main`.
- arquivo fornecido `2026_09_03_Sidebar.md`.

---

# 18. Referências externas de boas práticas

### GOV.UK Design System — Navigate a service

Recomenda simplificar a jornada antes de aumentar navegação e ressalta que a navegação deve conter as principais seções úteis ao usuário — **não funcionar como sitemap completo**.

https://design-system.service.gov.uk/patterns/navigate-a-service/

### GOV.UK Design System — Step by step navigation

Recomenda ordenar passos e tarefas de acordo com a necessidade do usuário e representar jornadas de ponta a ponta em uma sequência lógica quando isso ajuda a completar o trabalho.

https://design-system.service.gov.uk/patterns/step-by-step-navigation/

### Nielsen Norman Group — Information Architecture Study Guide

Referência de pesquisa sobre arquitetura de informação, findability, discoverability e navegação.

https://www.nngroup.com/articles/ia-study-guide/

### Nielsen Norman Group — Information Architecture Research

Coleção de pesquisas sobre menus, navegação e arquitetura de intranets/sistemas internos.

https://www.nngroup.com/reports/topic/information-architecture/

---

# 19. Estado desta auditoria

**Nenhum código foi alterado.**  
**Nenhuma rota foi movida.**  
**Nenhum commit foi realizado.**  
**Nenhuma migration foi executada.**  
**Nenhuma alteração foi feita no Supabase.**

Este documento é exclusivamente uma proposta de arquitetura de informação para revisão e comparação antes de qualquer implementação.
