# Análise de IA (Information Architecture) — Sidebar VerticalParts

**Contexto:** sistema interno de gestão (comercial → importação/suprimentos → engenharia → obra → logística → financeiro/jurídico), não o site institucional.  
**Método:** crítica de navegação e agrupamento sem alterar rotas no código. Premissa: o usuário pensa em **processo e objeto de trabalho** (lead, proposta, pedido, obra), não em organograma.  
**Critérios:** profundidade máxima, tamanho de grupo, consistência de nomes, redução de “vai-e-vem”, separação cadastro × transação × execução, e clareza de acrônimos.

---

## 1. Árvore atual (como está)

```
GERAL
├── Dashboard
├── Notificações
├── Central de Decisões
└── Gatilhos & Prazo

CADASTROS
├── Clientes
├── Fornecedores
├── Produtos
├── Empresas Instaladoras
└── Atualização de Custos

COMERCIAL
├── P-Leads
├── Formulários
├── Propostas
└── Controle de Cotações

ADM / FINANCEIRO
├── Cotações a Fornecedor
├── Precificação
├── Aval Financeira
├── Comissões
└── Pagamentos a Instaladores

JURÍDICO
├── Contrato Venda de Equipamento
├── Contrato Instalador
└── Contratos & Minutas

IMPORTAÇÃO / SUPRIMENTOS
├── GESTÃO IMPORTAÇÃO
├── Painel
├── P.L.
├── RFQ
├── IMS
├── Embarques
├── Importação
├── Análise de Preços
├── Compras Nacional
└── Pedidos

ENGENHARIA                    ← grupo mais sobrecarregado
├── Engenharia
├── Projeto de Elevadores
├── Projeto de Equipamento
├── Projetos E/E
├── Ficha Técnica
├── Vistorias de Obras
├── Resultado Vistorias de Obras
├── Instalação em Campo
├── Status de Obras
├── Linha de Tempo da Cotação
├── Central de Documentos
├── ART
├── Cronograma
├── Data Book & Termo
└── Entrega Final

RH OPERACIONAL
└── Homologação de Instaladores

LOGÍSTICA
├── Almoxarifado
├── Expedição
└── Logística

PORTAL ADMIN
├── Logs de Atividade
└── Configurações do Sistema
```

**Contagem aproximada:** 11 seções de 1º nível · ~55 itens · Engenharia sozinha com 15 destinos.

---

## 2. Diagnóstico: o que funciona e o que quebra

### O que já faz sentido

| Item | Avaliação |
|---|---|
| Bloco **GERAL** no topo | Correto. Dashboard, alertas, decisões e prazos são transversais. |
| **Cadastros** de Pessoas/Empresas/Produtos | Correto como dados mestres. |
| **Comercial** no funil lead → formulário → proposta | Ordem mental boa. |
| **Logística** separada de obra | Razoável (estoque/expedição ≠ canteiro). |
| **Portal Admin** no final | Padrão correto (baixa frequência, alto privilégio). |
| **Ficha Técnica em Engenharia** | Conceitualmente certo: é artefato de engenharia. O problema não é “estar em Engenharia”; é que Comercial e Importação também precisam dela sem descer 2 níveis num menu de 15 itens. |

### Problemas estruturais (impacto no uso diário)

#### A. Engenharia virou “gaveta de tudo que é técnico ou de obra”

Mistura **três naturezas diferentes**:

1. **Projeto / especificação** — Projeto Elevadores, Equipamento, E/E, Ficha Técnica, ART  
2. **Execução de campo** — Vistorias, Resultado, Instalação, Status, Cronograma, Entrega, Data Book  
3. **Transversal** — Central de Documentos, Linha de Tempo da Cotação  

Quem fecha venda não deveria abrir “Engenharia” para achar Linha de Tempo.  
Quem homologa instalador não deveria ir em RH e depois em Engenharia para ver Status de Obras.  
Quem despacha material vai em Logística e depois volta em Engenharia para Entrega Final.

**Benefício de separar:** menus menores, papel mental claro (“estou projetando” vs “estou executando obra”), menos erro de clique e menos treinamento.

#### B. Compra está fatiada em 3 departamentos

- `Controle de Cotações` → Comercial (lado cliente)  
- `Cotações a Fornecedor` → ADM/Financeiro (lado compra)  
- `RFQ` + `Análise de Preços` + `Pedidos` + `Compras Nacional` → Importação/Suprimentos  

O comprador faz um loop: Financeiro → Importação → Comercial. Cotação a fornecedor **não é ato financeiro**; é ato de suprimentos. Financeiro entra depois (custo landed, aval, comissão, pagamento).

**Benefício de unificar o “lado compra”:** um único corredor de suprimentos (nacional + importado), financeiro só com dinheiro e risco.

#### C. Importação / Suprimentos está plano demais e com nomes opacos

Dez itens no mesmo nível, misturando:

- comando (`GESTÃO IMPORTAÇÃO`, `Painel`)  
- documentos (`P.L.`, `IMS`)  
- etapas (`RFQ`, `Embarques`, `Importação`)  
- compras locais (`Compras Nacional`, `Pedidos`)  

`P.L.` (Packing List) e `IMS` sem expandir o nome aumentam carga cognitiva para quem não é do time de comex. `GESTÃO IMPORTAÇÃO` em caixa alta quebra o padrão visual.

**Benefício de agrupar e nomear por extenso:** o menu conta o fluxo (RFQ → pedido → packing list → embarque → nacionalização) em vez de uma sopa de siglas.

#### D. Cadastro misturado com operação

`Atualização de Custos` não é cadastro mestre; é manutenção de preço/custo. Convive mal com Clientes/Fornecedores. Quem atualiza custo pensa em precificação/suprimentos.

#### E. RH Operacional com um único item órfão

`Homologação de Instaladores` é pré-requisito de **obra**, não de DP clássico. Já existe `Empresas Instaladoras` em Cadastros e `Pagamentos a Instaladores` no Financeiro. O instalador está em 3 ilhas.

**Benefício de juntar o ciclo do instalador perto da obra:** cadastro (mestre) fica em Cadastros; homologação + execução + pagamento continuam em seus papéis, mas homologação “mora” no contexto de quem usa todo dia.

#### F. Jurídico isolado do fechamento comercial

O vendedor que gera proposta precisa do contrato de venda no mesmo fluxo. Minutas/templates sim, são casa do jurídico. O **contrato daquele pedido** é destino de Comercial (com permissão/validação jurídica).

#### G. Documento e linha do tempo presos em Engenharia

`Central de Documentos` e `Linha de Tempo da Cotação` são **hubs transversais**. Toda área anexa arquivo; toda área pergunta “onde está esse pedido?”. Enterrá-los no maior submenu é o principal gerador de vai-e-vem.

#### H. Inconsistências de nomenclatura e granularidade

- `Gatilhos & Prazo` (singular) vs vários prazos  
- `Aval Financeira` vs `Avaliação Financeira` (preferível por extenso)  
- `Compras Nacional` (concordância: **Nacionais**)  
- Item `Engenharia` dentro do grupo `Engenharia` (hub sem nome de tela)  
- Item `Logística` dentro do grupo `Logística`  
- Item `GESTÃO IMPORTAÇÃO` vs `Importação` (dois “home” do mesmo processo)

Isso parece módulos nascidos em sprints diferentes, sem passada de IA.

---

## 3. Resposta direta ao exemplo “Ficha Técnica em Engenharia, tudo bem?”

**Sim, o dono canônico é Engenharia.**  
Ficha Técnica descreve o equipamento (capacidades, normas, interfaces E/E, acabamentos). Não pertence a Comercial nem a Importação como casa principal.

**Mas o acesso precisa ser dual:**

- Menu canônico: Engenharia e Projetos → Ficha Técnica  
- Atalhos de contexto: a partir de Proposta, Pedido, RFQ e Obra (“abrir ficha deste equipamento”)

Se o comercial só encontra a ficha descendo 15 itens de Engenharia, o problema não é a pasta — é a **descoberta**. Benefício: engenharia continua dona da verdade; as outras áreas param de copiar PDF no WhatsApp.

O mesmo padrão vale para ART, Data Book e Contrato: **uma casa + deep links no objeto** (proposta/pedido/obra).

---

## 4. Princípios da árvore sugerida

1. **Primeiro nível = fase do negócio**, não organograma puro.  
2. **Máximo ~8 itens visíveis por grupo**; o que for etapa de um mesmo fluxo vira subgrupo.  
3. **Cadastro ≠ transação ≠ execução ≠ dinheiro ≠ norma.**  
4. **Objetos transversais sobem** (Decisões, Documentos, Linha do tempo).  
5. **Nomes em português claro**; sigla só entre parênteses.  
6. **Não apagar telas** — só reposicionar o ponteiro do menu. Rotas antigas podem redirecionar.  
7. Permissões por perfil continuam existindo; o menu some o que o usuário não vê, mas a árvore lógica é a mesma.

---

## 5. O que move para onde (mapa de movimentação)

| Item atual | Sai de | Vai para | Por quê | Benefício |
|---|---|---|---|---|
| Atualização de Custos | Cadastros | Suprimentos (ou Precificação, se for só PVP) | É operação de custo, não mestre | Cadastros fica só “quem/o quê existe” |
| Cotações a Fornecedor | ADM/Financeiro | Suprimentos | É compra, não tesouraria | Comprador para de cruzar financeiro |
| RFQ, Análise de Preços, Pedidos, Compras Nacionais | Importação (solto) | Suprimentos, fluxo único | Mesmo ofício de abastecer | Um corredor nacional+importado |
| P.L., IMS, Embarques, Importação, Painel | Importação (plano) | Subgrupo **Importação** | São etapas/documentos do mesmo processo | Menu conta a história do processo |
| Contrato Venda de Equipamento | Jurídico (único) | Comercial (atalho) + Jurídico (minuta) | Fecha o funil de venda | Vendedor não “sai do comercial” para formalizar |
| Homologação de Instaladores | RH Operacional | Obras e Instalação | É gate de campo | Time de obra vê o pré-requisito no mesmo bloco |
| Vistorias, Resultado, Instalação, Status, Cronograma, Entrega, Data Book | Engenharia | **Obras e Instalação** | Execução ≠ projeto | Engenharia volta a ser projeto |
| Linha de Tempo da Cotação | Engenharia | GERAL (ou hub “Pedidos/Obras”) | É rastreio transversal | Qualquer perfil acha o processo sem abrir Engenharia |
| Central de Documentos | Engenharia | GERAL ou grupo **Documentos** | Repositório da empresa | Fim do “cadê o PDF?” em 4 menus |
| ART | Engenharia (ok) | Engenharia e Projetos | Continua projeto/regulatório | — |
| Ficha Técnica | Engenharia (ok) | Engenharia e Projetos + atalho no objeto | Dono certo, acesso errado hoje | Menos cópia informal |
| Pagamentos a Instaladores | Financeiro (ok) | Financeiro | Dinheiro fica no financeiro | — |
| Precificação, Aval Financeira, Comissões | Financeiro (ok) | Financeiro (nomes ajustados) | — | — |
| Empresas Instaladoras | Cadastros (ok) | Cadastros | Dado mestre | Homologação que muda de casa |

Itens que **não precisam mudar de casa:** Dashboard, Notificações, Central de Decisões, Gatilhos, Clientes, Fornecedores, Produtos, P-Leads, Formulários, Propostas, Controle de Cotações (cliente), Precificação, Comissões, Pagamentos, Contratos & Minutas, Almoxarifado, Expedição, Logs, Configurações.

---

## 6. Nova árvore sugerida

Comentários à direita indicam o que mudou.

```
INÍCIO
├── Dashboard
├── Notificações
├── Central de Decisões
├── Gatilhos e Prazos                          ← plural
├── Linha do Tempo do Pedido                   ← SAIU de Engenharia
└── Central de Documentos                      ← SAIU de Engenharia

CADASTROS
├── Clientes
├── Fornecedores
├── Produtos
└── Empresas Instaladoras
        └── (Atualização de Custos SAIU daqui)

COMERCIAL
├── P-Leads
├── Formulários
├── Propostas
├── Controle de Cotações                       ← cotações do CLIENTE
└── Contratos de Venda                         ← atalho; minuta continua no Jurídico

SUPRIMENTOS                                    ← une compra nacional + importada
├── Análise de Preços
├── Cotações a Fornecedor                      ← SAIU do Financeiro
├── RFQ (Solicitação de Cotação)
├── Pedidos
├── Compras Nacionais
├── Atualização de Custos                      ← SAIU de Cadastros
└── Importação                                 ← subgrupo (antes tudo solto)
    ├── Painel de Importação
    ├── Packing List (P.L.)
    ├── IMS
    ├── Embarques
    └── Desembaraço / Importação

ENGENHARIA E PROJETOS                          ← só especificação
├── Painel de Engenharia
├── Projeto de Elevadores
├── Projeto de Equipamento
├── Projetos Elétricos / Eletrônicos (E/E)
├── Ficha Técnica
└── ART

OBRAS E INSTALAÇÃO                             ← NOVO grupo (saiu de Eng + RH)
├── Homologação de Instaladores                ← SAIU de RH
├── Vistorias de Obras
├── Resultado das Vistorias
├── Instalação em Campo
├── Status de Obras
├── Cronograma
├── Data Book e Termo
└── Entrega Final

LOGÍSTICA
├── Almoxarifado
└── Expedição
        └── (item genérico “Logística” vira o próprio grupo ou um painel, se existir tela)

FINANCEIRO
├── Precificação
├── Avaliação Financeira
├── Comissões
└── Pagamentos a Instaladores

JURÍDICO
├── Contratos e Minutas                        ← templates / biblioteca
├── Contrato de Instalador
└── Contrato de Venda de Equipamento           ← casa normativa (espelho do atalho comercial)

ADMINISTRAÇÃO
├── Logs de Atividade
└── Configurações do Sistema
```

**RH Operacional** some como seção de 1º nível (tinha 1 item). Se no futuro existir folha, ponto, EPIs, a seção volta.  
**GESTÃO IMPORTAÇÃO** deixa de competir com **Importação**; vira o subgrupo ou o Painel.

Primeiro nível passa de **11 para 9** seções.  
Engenharia passa de **15 para 6**.  
Nenhum grupo operacional passa de ~8 folhas visíveis.

---

## 7. Jornadas: antes vs depois (onde o “loop” some)

### Jornada 1 — Vendedor fecha um elevador

| Passo | Hoje | Depois |
|---|---|---|
| Qualificar | Comercial → P-Leads | igual |
| Proposta | Comercial → Propostas | igual |
| Ver ficha / custo | desce em Engenharia e/ou Cadastros → Custos | atalho na proposta + custos em Suprimentos |
| Contrato | sai para Jurídico | continua no Comercial (validação jurídica) |
| Acompanhar | Engenharia → Linha de Tempo | Início → Linha do Tempo |

Menos 2 a 3 saltos de seção por venda.

### Jornada 2 — Comprador abastece um pedido

| Passo | Hoje | Depois |
|---|---|---|
| RFQ | Importação | Suprimentos |
| Cotação fornecedor | ADM/Financeiro | Suprimentos |
| Análise de preço | Importação | Suprimentos |
| Pedido nacional ou embarque | Importação (itens soltos) | mesmo grupo, subgrupo Importação se for exterior |

Um único menu para o ofício de comprar.

### Jornada 3 — Coordenação de obra

| Passo | Hoje | Depois |
|---|---|---|
| Homologar instalador | RH Operacional | Obras |
| Vistoriar / instalar / status | Engenharia (meio da lista) | Obras |
| Data book / entrega | Engenharia (fim da lista) | Obras |
| Pagar instalador | Financeiro | Financeiro (correto) |

Engenharia para de ser a “sala de espera” da obra.

### Jornada 4 — Engenheiro de produto

Permanece em **Engenharia e Projetos**. Deixa de dividir atenção com vistorias e entrega. Ficha Técnica e ART ficam óbvias.

---

## 8. Benefícios mensuráveis (o que vender internamente)

1. **Tempo de achar a tela** — grupos menores e nomes de processo; menos varredura visual.  
2. **Onboarding** — o menu ensina o fluxo da empresa (vender → comprar → projetar → instalar → receber).  
3. **Menos ticket de “cadê X?”** — Documentos e Linha do Tempo no Início.  
4. **Permissões mais limpas** — perfil Obra não precisa da floresta de Engenharia; perfil Compra não precisa de Financeiro para cotar.  
5. **Evolução do produto** — dá para crescer Importação (LI, DI, Siscomex, câmbio) dentro do subgrupo sem inflar o 1º nível.  
6. **Consistência visual** — fim de item em CAPS e de seção com um filho só.

O que **não** se promete: redução de telas. A quantidade de rotas pode ser a mesma; muda o *mapa*.

---

## 9. Riscos da mudança e como mitigar

| Risco | Mitigação |
|---|---|
| Usuário antigo “decorou” o caminho | Redirect da rota antiga + “você está em Obras (antes em Engenharia)” por 2 sprints |
| Discussão política de dono da tela | Separar **dono do dado** (Engenharia dona da ficha) de **ponto de menu** |
| Subgrupo Importação esconder telas | Painel de Importação como landing com cards para P.L., IMS, Embarques |
| Comercial achar que “virou jurídico” | Contrato de venda no comercial é instância; minuta continua no jurídico |
| Ficha Técnica “sumir” de quem só olha Engenharia hoje | Ela **não sai** de Engenharia |

---

## 10. Recomendações extras de UX (sem mexer em regra de negócio)

1. **Busca global** por número de proposta, pedido, DI, cliente, obra — a sidebar nunca será o único jeito de achar.  
2. **Página do objeto** (Pedido / Obra) com abas: Comercial, Técnico, Compra, Campo, Documentos, Financeiro. A sidebar leva ao *tipo*; o objeto amarra o *caso*. Isso mata a maior parte do vai-e-vem.  
3. **Expandir siglas no menu:** `Packing List (P.L.)`, `RFQ`, `IMS` (se IMS for sistema interno, colocar o nome completo no tooltip).  
4. **Não repetir o nome do grupo como primeiro filho** (`Engenharia` dentro de `Engenharia`) — chamar de Painel ou Visão geral.  
5. **Ordem dos grupos = ordem do pipeline** (já proposta acima).  
6. Se a sidebar for longa em notebook, grupos colapsáveis com *lembrar estado* por usuário.  
7. Badge de pendência em Gatilhos, Decisões e Status de Obras — reduz a necessidade de “passar o olho” em 8 telas.

---

## 11. O que eu *não* moveria (e por quê)

- **Produtos** permanece em Cadastros, mesmo sendo muito usado em Engenharia: é mestre. A ficha é a visão rica do produto.  
- **Pagamentos a Instaladores** permanece no Financeiro: efeito caixa.  
- **Almoxarifado / Expedição** fora de Obras: estoque é recurso da empresa, não do canteiro (ainda que a obra consuma).  
- **Central de Decisões** no Início, não dentro de cada módulo: decisão é cross-team.

---

## 12. Veredito

A sidebar atual é um **mapa de departamentos**, não um **mapa de trabalho**. Por isso o usuário competente ainda “caça” tela: o objeto (proposta, pedido, obra) atravessa 4 seções.

A mudança de maior ROI não é estética: é

1. fatiar Engenharia em **Projetos** + **Obras**;  
2. unir o lado compra em **Suprimentos**;  
3. subir **Documentos** e **Linha do Tempo**;  
4. tratar contrato de venda e ficha técnica como **casa canônica + atalho no fluxo**.

Isso alinha o menu ao ciclo real da VerticalParts (equipamento importado/nacional + projeto + instalador + entrega), reduz loop e deixa cada time reconhecer o próprio território em menos de um segundo.

---

## 13. Revisão após o GOV.UK Design System

**Pergunta:** os links do GOV.UK mudam o ponto de vista?  
**Resposta:** o diagnóstico de agrupamento **não muda**. O que muda é a **camada**: a sidebar não deve listar as ~55 telas. Navegação no GOV.UK não é sitemap.

Fontes usadas: [Navigate a service](https://design-system.service.gov.uk/patterns/navigate-a-service/), [Service navigation](https://design-system.service.gov.uk/components/service-navigation/), [Task list](https://design-system.service.gov.uk/components/task-list/), [Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/), [Accordion](https://design-system.service.gov.uk/components/accordion/), [Step by step](https://design-system.service.gov.uk/patterns/step-by-step-navigation/).

### O que o GOV.UK confirma (fica)

- Sistema usado de forma repetida, com várias tarefas e **sem uma única ordem fixa** → navegação persistente é correta (`Navigate a service`: “used repeatedly / multiple tasks / no clear end-to-end”).
- Links de 1º nível = só as seções mais úteis, não cada tela. “Navigation is not a site map.”
- Engenharia com 15 filhos viola isso tanto quanto viola agrupamento de domínio.
- Separar Projeto de Obra e unir Compra continua certo: são seções de topo, não lista de rotas.

### O que o GOV.UK corrige na proposta anterior

A árvore da seção 6 ainda era um **sitemap reorganizado**. Pelo padrão britânico, isso é excesso.

| Antes (minha 1ª entrega) | Depois do GOV.UK |
|---|---|
| Sidebar lista P.L., IMS, Embarques, RFQ… | Sidebar só tem **Suprimentos**. As etapas vivem no **painel da seção** ou no **pedido**. |
| Linha do Tempo e Central de Documentos sobem para INÍCIO como itens de menu | São **páginas do objeto** (pedido/obra), não irmãos do Dashboard. No Início fica busca + decisões. |
| Contrato de venda como 5º filho de Comercial | Comercial leva à proposta; o contrato é **tarefa** daquela proposta (task list). |
| Ficha Técnica continua no menu de Engenharia (ok) e “atalho no objeto” | O atalho no objeto passa a ser o mecanismo principal. Menu só aponta o *tipo*. |

### Modelo de 3 camadas (é isso que o GOV.UK realmente pede)

```
CAMADA A — Service navigation (poucos links, sempre visível)
  Início · Comercial · Suprimentos · Engenharia · Obras · Logística · Financeiro · Jurídico · Cadastros · Admin

CAMADA B — Landing da seção (não é menu infinito)
  Ex.: /obras  → cards ou lista: vistorias, instalação, status, entrega
  Ex.: /suprimentos → compras nacionais | importação (painel)

CAMADA C — Task list no OBJETO (mata o vai-e-vem)
  Página "Pedido 1042" / "Obra Shopping X":
    Comercial        [Concluído]  proposta, contrato venda
    Comprar          [Em curso]   RFQ, cotação fornecedor, pedido
    Importar         [Pendente]   packing list, IMS, embarque, desembaraço
    Projetar         [Concluído]  ficha técnica, ART, E/E
    Instalar         [Em curso]   homologar, vistoria, campo, cronograma
    Entregar         [Pendente]   data book, termo, expedição
    Financeiro       [Pendente]   aval, comissão, pagamento instalador
```

A Camada C é o padrão **Complete multiple tasks / Task list**. Status curto: Concluído, Em curso, Pendente — sem inflar tags. Nomes com verbo quando for tarefa: “Homologar instalador”, “Emitir ART”.

Step-by-step do GOV.UK **não** entra dentro do sistema transacional (o próprio DS diz: use task list, não step-by-step, inside a transactional service). Serve no máximo como página de ajuda “Como importar um equipamento”.

Accordion na sidebar: o DS autoriza para caseworkers que repetem tarefas, com `rememberExpanded`. Serve para agrupar filhos da Camada A, não para esconder 15 itens de Engenharia. Accordion dentro de accordion: não.

### Árvore de 1º nível, versão GOV.UK (o que o usuário vê o dia todo)

```
Início
Comercial
Suprimentos
Engenharia
Obras
Logística
Financeiro
Jurídico
Cadastros
Admin
```

Dez itens. Sem “RH Operacional”. Sem “GESTÃO IMPORTAÇÃO” em caixa alta. Sem P.L. na borda da tela.

Os destinos da análise original **continuam existindo**; só deixam de ser folhas da sidebar. Mapa de movimento da seção 5 permanece válido como **dono canônico da tela**, não como item permanente do menu.

### O que eu recuo explicitamente

1. Não colocar Linha do Tempo e Central de Documentos como irmãos do Dashboard. Ficam no objeto + busca global.  
2. Não despejar o fluxo de importação como subárvore visível o tempo todo. Painel de Importação resolve.  
3. Não tratar a sidebar como o lugar onde o usuário “aprende o processo”. Quem ensina o processo é a task list do pedido/obra.

### O que eu não recuo

- Engenharia sobrecarregada continua errada.  
- Cotação a fornecedor no Financeiro continua errada.  
- Homologação órfã em RH continua errada.  
- Ficha Técnica continua sendo da Engenharia.

### Aplicação honesta (sem virar um clone visual do gov.uk)

Não copiar header azul, phase banner nem tipografia GDS. Copiar só as regras: poucos links de serviço, objeto com tarefas e status, nomes claros, não esconder o que todo mundo precisa ver, não usar a nav como inventário de rotas.

