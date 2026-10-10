# Herança de dados entre telas

Quem **doa** dados e quem **recebe**. Ao criar ou alterar uma tela, atualize esta lista. O tutorial de cada tela deve citar, em "Antes de começar", de onde vêm os dados que ela já traz preenchidos.

Confirme sempre no código antes de gravar (`grep -n "Store\.\|from('" src/<arquivo>`). Os itens marcados **(confirmar)** ainda não foram conferidos no código.

## Cadeia principal de venda

```
Cadastro de Clientes ──┐
                       ├─► Formulários (formulario-elevador) ──► Precificação ──► Propostas ──► Contrato de Venda
Leads ─────────────────┘        │                                    │               │
                                │                                    │               ├─► Aval Financeiro (Pagamento)
                                └────────────────────────────────────┘               ├─► Aval Jurídico
Fornecedores ──► Cotações a Fornecedor ──► (preço do fornecedor) ──► Precificação   ├─► Contrato Instalador (via Proposta)
                                                                                     └─► Dossiê da obra
```

## Relações, tela por tela

| Tela que RECEBE | Recebe de | O que vem | Onde no código (confirmar) |
|---|---|---|---|
| Formulários (formulario-elevador) | Cadastro de Clientes | cliente, CNPJ/CPF, endereço | `formulario-elevador-store.js` (`buscarOuCriarCliente`) |
| Formulários | Leads | lead vinculado ao formulário | `comercial.jsx` (`lead_id`) (confirmar) |
| Precificação | Formulários | equipamentos (unidades), quantidades, especificações | `precificacao-elevador-store.js` (`montarRascunho`) |
| Precificação | Cotações a Fornecedor | preço por equipamento informado pelo fornecedor | `cotacao-elevador-fornecedor-store.js` (confirmar) |
| Propostas | Precificação | valores, custo, margem, containers | `proposta-heranca.js` (`montarPrefill`) |
| Propostas | Formulários | cliente, especificações, endereço da obra | `proposta-heranca.js` |
| Contrato de Venda | Propostas | comprador, valor, parcelas, equipamentos | `contrato-venda.jsx` (`aplicarProposta`) |
| Contrato de Venda | Formulários e Clientes | dados do comprador, endereço da obra | `contrato-venda.jsx` (confirmar) |
| Contrato Instalador | Propostas | equipamentos da proposta, número VPNI | `contrato-instalador.jsx` (`aplicarProposta`) |
| Aval Financeiro | Propostas | proposta aprovada abre o aval | `avais` via trigger `fn_avais_abrir_na_proposta` |
| Aval Jurídico | Propostas | proposta aprovada abre o aval | mesmo trigger |
| Projeto de Elevadores | Formulários / Propostas | Nº da cotação, cliente, equipamentos | `projeto-elevador-store.js` (`equipamentosDaObra`) |
| Cotações a Fornecedor | Formulários | Nº da cotação, equipamentos, fornecedores | `cotacao-elevador-fornecedor-store.js` |
| Tratativas | Cotações a Fornecedor | cotação e fornecedor da conversa | `tratativas-store.js` |
| Controle de Cotações | Formulários | lista de cotações do formulário | `controle-cotacoes` |
| Central de Decisões | Precificação, Propostas, Contratos | motivo, valor, margem, cliente da decisão | `decisoes-store.js` (`contextoDaCotacao`) |
| Prazos & Pendências | Gatilhos (motor) | etapas da cadeia de cada cotação | `gatilhos-engine.js` |
| Dashboard | Propostas, Contratos, Leads | indicadores | `supabase.js` (confirmar) |
| Inbox | E-mails enviados (Propostas, Contratos, Cotações) | vínculo por Nº de cotação ou referência | `logistica.jsx` |

## Quem doa para quem (visão reversa)

- **Cadastro de Clientes** → Formulários, Propostas, Contrato de Venda, Contrato Instalador, Leads.
- **Cadastro de Fornecedores** → Cotações a Fornecedor e Tratativas.
- **Cadastro de Produtos e Matérias-Primas** → Precificação e Projeto de Elevadores (confirmar).
- **Formulários** → Precificação, Propostas, Cotações a Fornecedor, Projeto de Elevadores, Controle de Cotações.
- **Precificação** → Propostas, Central de Decisões, Aval Financeiro (margem).
- **Propostas** → Contratos (Venda e Instalador), Avais, Dossiê, Inbox.
- **Contrato de Venda** → Aval Jurídico (vincula o contrato), Desenho de Instalação, Projeto de Elevadores.

## Como registrar uma relação nova

1. Achar o store ou o import que lê os dados da outra tela.
2. Acrescentar uma linha na tabela "Relações, tela por tela" com o arquivo e a função.
3. Acrescentar a relação reversa em "Quem doa para quem".
4. Citar a dependência no tutorial da tela que recebe.
