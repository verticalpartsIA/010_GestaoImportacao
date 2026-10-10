# Módulos, telas e pastas do VP Gestão

Fonte de verdade para a organização dos tutoriais. Se uma tela nova não estiver aqui, acrescente antes de criar o tutorial (Modo B da `SKILL.md`).

Coluna **Ligação "?"**: `TUTORIAIS` (tela) ou `MODULOS_TUTORIAL` (módulo) em `src/shell.jsx`. "—" = ainda sem ligação.

## Árvore

Cada módulo pai tem a pasta `TreinamentoVP/<pai>/` com a visão do módulo. As telas filhas ficam dentro, em `TreinamentoVP/<pai>/<tela>/`.

### geral — "Geral" (menu lateral)
Ligação do módulo: `MODULOS_TUTORIAL["Geral"] = "geral"`

| Tela (pasta) | Rota do app | Ligação "?" da tela |
|---|---|---|
| dashboard | `dashboard` | `dashboard` |
| central-de-decisoes | `decisoes` | `decisoes` |
| notificacoes | `notificacoes` | `notificacoes` |
| prazos-e-pendencias | `financeiro` (rótulo "Prazos & Pendências") | `financeiro` |
| inbox | `inbox` | `inbox` |

### crm — "CRM"
Ligação do módulo: `MODULOS_TUTORIAL["CRM"] = "crm"`

| Tela | Rota | Ligação |
|---|---|---|
| leads | `leads` | `leads` |
| canais | `crm-canais` | `crm-canais` |
| conversao | `crm-conversao` | `crm-conversao` |
| automacao | `crm-automacao` | `crm-automacao` |
| analise | `crm-analise` | `crm-analise` |

### cadastros-mestres — "Cadastros Mestres"
Ligação do módulo: `MODULOS_TUTORIAL["Cadastros Mestres"] = "cadastros-mestres"`

| Tela | Rota | Ligação |
|---|---|---|
| clientes | `cadastro-clientes` | `cadastro-clientes` |
| fornecedores | `cadastro-fornecedores` | `cadastro-fornecedores` |
| materias-primas | `cadastro-materias-primas` | `cadastro-materias-primas` |
| produtos | `cadastro-produtos` | `cadastro-produtos` |

### comercial-pre-venda — "Comercial | Pré-venda"
Ligação do módulo: `MODULOS_TUTORIAL["Comercial | Pré-venda"] = "comercial-pre-venda"`

| Tela | Rota | Ligação |
|---|---|---|
| formularios | `formularios` | `formularios` |
| controle-de-cotacoes | `controle-cotacoes` | `controle-cotacoes` |
| cotacoes-a-fornecedor | `cotacoes-fornecedor` | `cotacoes-fornecedor` |
| cotacao-a-fornecedor-detalhe | `cotacao-fornecedor-detail` | `cotacao-fornecedor-detail` |
| cotacao-a-fornecedor-tratativas | aba "Tratativas" da tela de detalhe (`/comercial/cotacao-fornecedor-detail/<id>/tratativas`) | — |
| cotacao-quadro-comando | `cotacao-quadro-comando` | `cotacao-quadro-comando` |
| propostas | `propostas` | `propostas` |
| contratos-sociais | `contratos-sociais` | `contratos-sociais` |

### financeiro-precos — "Financeiro & Preços"
Ligação do módulo: `MODULOS_TUTORIAL["Financeiro & Preços"] = "financeiro-precos"`

| Tela | Rota | Ligação |
|---|---|---|
| precificacao | `precificacao` | `precificacao` |
| atualizacao-de-custos | `cadastro-custos` | `cadastro-custos` |
| aval-financeiro | `aval-financeiro` | `aval-financeiro` |
| comissoes | `comissoes` | `comissoes` |

### contratos-juridico — "Contratos & Jurídico"
Ligação do módulo: **ainda não ligado** (sem tutorial de módulo no menu).

| Tela | Rota | Ligação |
|---|---|---|
| contrato-venda-equipamentos | `/juridico/contrato-venda-equipamentos` | — |
| contratos-minutas | `/juridico/juridico` ("Contratos & Minutas") | — |
| aval-juridico | `aval-juridico` | `aval-juridico` |

## Fora do roteiro (decisão do usuário)

- **Emissão de NF**: usada pela Expedição. Só entra se pedirem tutorial para o perfil da Expedição.

## Próximos módulos (ordem de `NAV_GROUPS` em `src/shell.jsx`, depois que o atual estiver pronto)

Expedição · Suprimentos & Importação · Logística Interna · Engenharia · Administração. O usuário escolhe o próximo.

## Caminho de cada tutorial (publicado)

Padrão: `TreinamentoVP/<pai>/<tela>/index.html`. A visão do módulo fica em `TreinamentoVP/<pai>/index.html`. A ligação do "?" monta `/TreinamentoVP/<caminho>/`, então o valor de `TUTORIAIS` é `<pai>/<tela>` (ex.: `geral/dashboard`).
