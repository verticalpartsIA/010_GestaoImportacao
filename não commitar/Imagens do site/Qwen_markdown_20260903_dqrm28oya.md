# Análise e Proposta de Reestruturação da Sidebar - VerticalParts IA

## 1. Diagnóstico Geral (Crítica de Boas Práticas)
A estrutura atual apresenta **sobrecarga cognitiva** e **fragmentação de fluxo**. O usuário é forçado a navegar em "loops" ou adivinhar em qual departamento uma funcionalidade se encontra. 

Principais problemas identificados:
1. **Categoria "Engenharia" superlotada**: Possui 14 itens, misturando projeto pré-venda, execução em campo e documentação final. Isso viola a Lei de Miller.
2. **Fragmentação do Produto**: "Ficha Técnica" está em Engenharia, mas "Produtos" está em Cadastros. Como as fichas técnicas da VerticalParts são configuracionais (subcomponentes, modelos de botões, etc.), elas são atributos diretos do produto, não apenas um desenho de engenharia isolado.
3. **Duplicidade e Nomes Vagos**: "Logística > Logística" é redundante. "Central de Documentos" é muito genérico e flutua sem dono claro.
4. **Fluxo de Compras Quebrado**: "Cotações a Fornecedor" está em ADM/FINANCEIRO, mas a ação de cotar é de Suprimentos/Importação. O financeiro apenas valida (Aval Financeira) ou paga.
5. **Nesting Desnecessário**: "IMPORTAÇÃO / SUPRIMENTOS" tem um subtítulo "GESTÃO IMPORTAÇÃO", adicionando um clique extra sem valor organizacional real.

---

## 2. Análise Detalhada de Movimentações (O Que, Por Que e Benefícios)

### A. Ficha Técnica
- **De**: Engenharia  
- **Para**: CADASTROS > Produtos (ou como item irmão direto de Produtos)  
- **Por que**: A ficha técnica é a definição configuracional do produto (ex: Botoeiras, displays, intercomunicadores). Separar o "Produto" da sua "Ficha Técnica" força o usuário a ir a dois lugares diferentes para entender o que está vendendo ou comprando.  
- **Benefício**: Fluxo único de verdade (Single Source of Truth). O comercial e o suprimentos acessam a mesma fonte técnica diretamente no cadastro do produto, reduzindo erros de especificação.

### B. Linha de Tempo da Cotação
- **De**: Engenharia  
- **Para**: COMERCIAL  
- **Por que**: Acompanhar o prazo e status de uma cotação é uma atividade de follow-up comercial, não de cálculo estrutural ou elétrico.  
- **Benefício**: O time comercial tem todas as ferramentas de pré-venda (Leads, Propostas, Cotações e seus prazos) em um único menu, acelerando o fechamento.

### C. Cotações a Fornecedor
- **De**: ADM / FINANCEIRO  
- **Para**: SUPRIMENTOS & IMPORTAÇÃO > Compras Nacional  
- **Por que**: Solicitar cotações é uma tarefa operacional de compras. O financeiro entra apenas depois, na etapa de "Aval Financeira" ou "Pagamentos".  
- **Benefício**: Alinha a ferramenta ao fluxo natural de suprimentos (RFQ -> Cotação -> Análise de Preço -> Pedido).

### D. Atualização de Custos
- **De**: CADASTROS  
- **Para**: FINANCEIRO & ADM (ou SUPRIMENTOS > Análise de Preços)  
- **Por que**: Atualização de custos é uma atividade dinâmica de margem e precificação, não um cadastro estático como "Cliente" ou "Fornecedor".  
- **Benefício**: Mantém a seção de Cadastros limpa (apenas entidades) e agrupa decisões de margem e custo onde elas são usadas: na precificação.

### E. Central de Documentos
- **De**: Engenharia  
- **Para**: JURÍDICO (se focado em contratos) ou GERAL (se for um repositório global de uploads)  
- **Por que**: "Central de Documentos" em Engenharia se perde entre 14 itens. Se for repositório de contratos, vai para Jurídico. Se for global, vai para o topo.  
- **Benefício**: Encontra-se o documento pelo contexto de uso (contrato vs. desenho técnico).

### F. Logística > Logística
- **De**: Logística (subitem)  
- **Para**: LOGÍSTICA > Rastreamento e Transporte  
- **Por que**: Evita redundância de nomenclatura (Lei da Proximidade Semântica).  
- **Benefício**: Clareza imediata sobre o que o item faz.

### G. Desmembramento de "Engenharia"
- **De**: 14 itens em um único bloco.  
- **Para**: Dois blocos distintos: **ENGENHARIA & PROJETOS** e **OBRAS & CAMPO**.  
- **Por que**: O perfil do usuário que desenha o "Projeto de Elevador" é diferente do usuário que preenche o "Resultado de Vistoria de Obra" ou "Data Book".  
- **Benefício**: Redução drástica do tempo de busca e interface adaptada à fase do projeto (Pré-venda/Projeto vs. Pós-venda/Execução).

---

## 3. Nova Árvore de Navegação Sugerida

Esta estrutura limita os itens por categoria a no máximo 7, agrupa por **fluxo de trabalho** e não apenas por departamento estanque, e resolve os pontos de atrito identificados.

```text
GERAL
├── Dashboard
├── Notificações
├── Central de Decisões
└── Alertas e Prazos (renomeado de "Gatilhos & Prazo" para maior clareza)

CADASTROS (Base de Dados Mestra)
├── Clientes
├── Fornecedores
├── Produtos e Fichas Técnicas (unificado para evitar loop de busca)
└── Empresas Instaladoras

COMERCIAL (Fluxo de Pré-Venda)
├── P-Leads
├── Formulários
├── Propostas
├── Controle de Cotações
└── Linha de Tempo da Cotação (movido de Engenharia)

SUPRIMENTOS & IMPORTAÇÃO (Fluxo de Aquisição)
├── Compras Nacional
│   ├── Cotações a Fornecedor (movido de Financeiro)
│   ├── Análise de Preços
│   └── Pedidos
└── Gestão de Importação (removido o nesting desnecessário)
    ├── Painel de Importação
    ├── P.L. (Processo de Licitação / Proforma)
    ├── RFQ
    ├── IMS
    ├── Embarques
    └── Importação

FINANCEIRO & ADM (Fluxo de Validação e Pagamento)
├── Precificação
├── Atualização de Custos (movido de Cadastros)
├── Aval Financeira
├── Comissões
└── Pagamentos a Instaladores

JURÍDICO (Fluxo Contratual)
├── Contratos & Minutas
├── Contrato Venda de Equipamento
├── Contrato Instalador
└── Central de Documentos Contratuais (movido de Engenharia)

ENGENHARIA & PROJETOS (Fluxo Técnico Pré-Execução)
├── Engenharia (Visão Geral)
├── Projeto de Elevadores
├── Projeto de Equipamento
└── Projetos E/E

OBRAS & CAMPO (Fluxo de Execução e Pós-Venda)
├── Status de Obras
├── Cronograma
├── Vistorias de Obras
├── Resultado Vistorias de Obras
├── Instalação em Campo
├── ART
└── Data Book & Termo de Entrega Final (unificado para clareza)

RH OPERACIONAL
└── Homologação de Instaladores

LOGÍSTICA
├── Almoxarifado
├── Expedição
└── Rastreamento e Transporte (renomeado de "Logística")

PORTAL ADMIN
├── Configurações do Sistema
└── Logs de Atividade