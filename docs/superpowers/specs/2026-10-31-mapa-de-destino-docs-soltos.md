# Mapa de destino — para onde vai cada documento solto (rascunho, 31/10/2026)

> Objetivo: transformar a "galáxia" em um planeta. Cada documento solto aponta para o módulo (e a tela filha) onde a verdade dele vai morar. **Nada foi movido nem apagado.** A coluna "Ação" diz o que proponho; só executo com a sua aprovação.
>
> **Regra de segurança:** só se move uma spec para dentro de um módulo **quando o documento daquele módulo existir**. Antes disso a spec fica onde está e ganha, no topo, o aviso temporário: `> ⚠ Será absorvida por docs/modulos/<arquivo> (<seção>). Até lá, vale este arquivo.` Depois da absorção, o arquivo antigo vira só um ponteiro de uma linha (nunca regras em dois lugares).

## Módulos (numeração do índice `docs/modulos/README.md`)
01 Geral · 02 CRM · 03 Cadastros Mestres · 04 Comercial|Pré-venda · 05 Financeiro & Preços · 06 Contratos & Jurídico · 07 Suprimentos & Importação · 08 Engenharia & Produto · 09 Obras & Instalação · 10 Entrega & Documentação · 11 Parceiros & Instaladores · 12 Logística Interna · 13 Fabricação · 14 Administração. Documentos existentes hoje: 01, 02, 03.

## A. Dashboard (1.1) — o que existe fora do documento
**Nenhuma spec ou plano em `docs/` é "do" Dashboard.** A "galáxia" do Dashboard está no `CLAUDE.md` (ver parte C) e no `01_geral.md` atual (seção 2.1, que o novo 1.1 substitui).

## B. Specs, planos e documentos soltos de `docs/`

| Arquivo | Assunto | Destino (módulo / seção) | Ação proposta |
|---|---|---|---|
| `superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md` | WhatsApp na Central de Decisões | 01 Geral › 1.3 Central de Decisões (1.3.10 Pendências / 1.3.11 Histórico) | Existe o módulo: absorver quando o 1.3 for redigido; aviso temporário agora |
| `superpowers/plans/2026-09-17-whatsapp-central-decisoes.md` | plano da mesma entrega | 01 Geral › 1.3 | idem |
| `eventos/vphub-aval-whatsapp.md` | aval do CEO por WhatsApp | 01 Geral › 1.3 (e 14 Administração, se for infraestrutura de eventos) | a conferir o destino único |
| `eventos/vphub-instalador.md` | avisos de WhatsApp do instalador | 11 Parceiros & Instaladores | aguarda o módulo 11 |
| `governanca-matriz.md` | status, bloqueios e handoffs entre módulos | 01 Geral › Parte comum (e referência cruzada nos módulos) | absorver quando a Parte comum for redigida |
| `superpowers/plans/2026-10-02-autenticacao-e-rls-571.md` | autenticação e RLS (#571) | 14 Administração (segurança) | aguarda o módulo 14 |
| `seguranca/*` (4 arquivos) | decisões, matriz RLS, cascata de assinatura, saldo | 14 Administração (segurança); `cascata-assinatura.md` também em 06 Contratos | aguarda 14 e 06 |
| `superpowers/plans/2026-10-13-desfoque-de-valores-hub.md` | desfoque de valores por alçada | 14 Administração (alçadas); cada tela cita sua etiqueta | aguarda 14 |
| `superpowers/specs/2026-10-15-difal-cadastro-formulario-design.md` | DIFAL no cadastro e no formulário | 05 Financeiro & Preços (e 04 Formulário) | aguarda 05 |
| `superpowers/specs/2026-10-23-ocultar-equipamento-proposta.md` | ocultar equipamento na Proposta | 04 Comercial › Propostas | aguarda 04 |
| `superpowers/specs/2026-10-28-formulario-quadro-publico-v2.md` | link público do Quadro de Comando | 04 Comercial (ou 13 Fabricação — a decidir) | aguarda decisão |
| `superpowers/specs/2026-10-29-formulario-escada-esteira-url-planilha.md` | Formulário de Escada/Esteira | 04 Comercial › Formulário | aguarda 04 |
| `superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/` (6 arquivos) | Cotações de Varejo → RFQ → P.I. | 07 Suprimentos & Importação | aguarda 07 (spec completa SDD: ficar como histórico dentro do módulo) |
| `superpowers/specs/2026-10-30-embarques-conectividade-abas.md` | Embarques: ligação entre as abas | 07 Suprimentos & Importação › Embarques | aguarda 07 |
| `superpowers/specs/2026-10-31-embarques-edicao-visivel.md` | Embarques: formulário de edição visível | 07 Suprimentos & Importação › Embarques | aguarda 07 |
| `superpowers/specs/2026-10-17-modulo-etiquetas-design.md` | Etiquetas | 12 Logística Interna | aguarda 12 |
| `superpowers/specs/2026-10-26-separacao-distribuicao/` (6 arquivos) | Separação distribui item a 4 destinos | 12 Logística Interna › Separação | aguarda 12 |
| `PLANO_/DIAGNOSTICO_separacao_envio_producao.md` (pasta `docs/`, **não versionados**) | desenho antigo da Separação, já superado | 12 Logística Interna | candidatos a **obsoletos** (a main seguiu outro desenho) |
| `superpowers/specs/2026-10-26-solicitacao-produto-fo612/` (5 arquivos) | Solicitação de Produto | 08 Engenharia & Produto | aguarda 08 |
| `superpowers/specs/2026-10-30-art-por-obra.md` | ART por obra | 09 Obras & Instalação | aguarda 09 |
| `superpowers/specs/2026-10-24-evolucao-qualidade-dados.md` | Evolução dos Equipamentos: dado a conferir | 09 Obras & Instalação | aguarda 09 |
| `superpowers/plans/2026-10-19-acompanhamento-obra-sla-ocorrencias.md` | acompanhamento de obra, SLA, ocorrências | 09 Obras & Instalação | aguarda 09 |
| `superpowers/specs/2026-10-22-fabricacao-corrimao-corte-design.md` | Fabricação de corrimão e corte | 13 Fabricação | aguarda 13 |
| `superpowers/specs/2026-10-19-evolucao-fabricacao-quadro-design.md` e `plans/2026-10-19-evolucao-fabricacao-quadro.md` | Evolução da Fabricação do Quadro | 13 Fabricação | aguarda 13 |
| `revisoes/00…03` (4 arquivos) | revisões comerciais: vigência de propostas, avais, cláusulas | 04 Comercial › Propostas e 06 Contratos | aguarda 04/06 |
| `VISTORIAS_DEPLOYMENT.md`, `VISTORIAS_DEPLOYMENT_REPORT.md` | deploy de Vistorias (set/2026) | 09 Obras & Instalação | **provável histórico**: avaliar descarte |
| `BUG-8-IMPLEMENTATION.md` | persistência de Proposta no Supabase (bug #8) | 04 Comercial › Propostas | **provável histórico** |
| `PROJETO_INCRIVEL.md` | correção de 9 bugs da issue #13 | — | **provável obsoleto** |
| `COMO_ADICIONAR_CARDS.md` | passo a passo de cards (obsoleto?) | — | **provável obsoleto** |
| `CONTEXTO_workflow_setores_vpclick.md` | workflow por setores e vp-click | 14 Administração (integrações) ou 01 Geral › Parte comum | a conferir |
| `relatorios/2026_05_29_relatorio.md` | relatório diário de maio | — | histórico; sem módulo |
| `MAPA_DE_ROTAS.md` | mapa gerado automaticamente | fica (é gerado por script) | **não mover**; o 1.1.2 aponta para ele |

**Resumo:** ainda não há onde absorver quase nenhuma: dos 14 módulos só 3 têm documento. Por isso o aviso temporário só vale agora para o que é de **Geral** (WhatsApp da Central, governança) e de **Cadastros/CRM** (nenhum encontrado). O restante espera o módulo respectivo ser criado.

## C. As 27 menções de "Dashboard" no `CLAUDE.md` — o que absorver e o que deixar

**Absorver no 1.1 (e depois retirar do `CLAUDE.md`):**
| Linha (hoje) | Seção do `CLAUDE.md` | O que diz | Onde fica no 1.1 |
|---|---|---|---|
| 299 | Leads (26/09) | lista de Leads, busca global e Dashboard filtram `excluido_em` | 1.1.8 (já absorvido) |
| 725 | Contrato de Venda 955 | KPI "contratado × previsto" lê `data_json.ativos` por `indice` | 1.1.8 (já absorvido) |
| 781 | Contrato de Venda · salvar rascunho | consultas a `contratos_venda_equipamentos` devem tratar `em_preenchimento` | 1.1.7 e 1.1.8 (já absorvido) |
| 947 | Formulário/Cotação · dono | Dashboard lê `formularios_elevador` sem filtro de dono | 1.1.8 (já absorvido) |
| 1014, 1823 | Tutoriais | Dashboard tem tutorial e está ligado ao "?" | 1.1.2 e 1.1.10 (já absorvido) |
| 1651 | Notificações | alertas do Dashboard filtram por destinatário | 1.1.7 e 1.1.8 (já absorvido) |
| 1953, 1957, 1964 | Varredura de URLs | modal de projeto na URL | 1.1.2 (já absorvido) |
| 1969 | Auditoria de amarrações | modal do Dashboard abre pela URL | 1.1.2 (já absorvido) |

**Deixar (citam o Dashboard só de passagem; pertencem a outro assunto):**
392 (Realtime), 745 (avais; a etapa AVAL_JURIDICO entra no `FASE_POR_NODE`), 810 (cache: rota nova abria o Dashboard — assunto de cache-busting), 894 (proposta 120×90), 977/980/991 (PCP — "dashboards" do PCP são outra coisa), 1647 (notificações), 1674/1675/1680 (Prazos & Pendências), 1695/1698/1699 e 1918 (versões e testes de entregas de gatilhos/avais), 1822 (tutoriais), 1969.

Observação: nas linhas de "versões" (`dashboard.jsx v22`, etc.) o que importa é o histórico de cache; não precisa ir para o 1.1.

**Para o futuro `CLAUDE.md` enxuto:** manter só a regra geral "antes de mexer em tela, leia o documento do módulo" e o ponteiro para `docs/modulos/README.md`. O histórico de cada entrega vira o tema `x.x.11 Histórico` de cada tela.
