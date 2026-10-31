# 1.1 Dashboard — proposta de KPIs e de perfil por usuário (rascunho, 31/10/2026)

> **Lista de KPIs e perfis APROVADA pelo Gelson em 31/10/2026** ("Aprovo"), incluindo os perfis novos **Logística** e **Importação**. Nada disto está no código ainda. **Seguem em aberto** as perguntas 2 a 4 do fim (período padrão, definição de "A receber", dono da meta de conversão): até serem respondidas, valem o comportamento atual e "A receber" fora da lista. Colunas marcadas **[a conferir]** não foram verificadas no banco.

## 1. O problema, em uma frase
Hoje o Dashboard escolhe os KPIs por um "perfil" que a pessoa seleciona no navegador, existem só 4 perfis, e vários números estão errados ou sem período claro. Resultado: quem é do **almoxarifado** (o maior grupo) não tem perfil nenhum e vê números de outro departamento.

## 2. Perfil pelo usuário (decisão do Gelson: "do cargo ao usuário")
O sistema já sabe quem entrou (e-mail do login) e o departamento dele (`colaboradores_vpsistema.departamento`). Proposta: **o perfil sai do departamento**, sem escolha manual.

Departamentos hoje (51 colaboradores no cadastro):

| Departamento | Pessoas | Perfil proposto | Situação hoje |
|---|---|---|---|
| Logística/Almoxarifado/Produção | 16 | **Logística** (novo) | não tem perfil |
| Comercial | 9 | Comercial | existe |
| Engenharia | 8 | Engenharia | existe |
| Jurídico/Importação/Suprimentos | 5 | **Importação** (novo) | não tem perfil |
| Adm/Financeiro | 5 | Financeiro | existe |
| Marketing | 3 | Geral | não tem perfil |
| Gente & Gestão | 3 | Geral | não tem perfil |
| CEO | 1 | Diretoria (= Admin) | existe como "Admin" |
| (sem departamento) | 1 | Geral | — |

- **Administradores** continuam podendo trocar de visão (útil para conferir o que cada área vê). Os demais **não escolhem**.
- **Saudação:** primeiro nome do e-mail (`almoxarifado@` → "Almoxarifado", `bianca@` → "Bianca"). Regra no 1.1.3.
- **Blocos comuns a todos os perfis** (a pessoa sempre vê): *Minhas decisões pendentes*, *Meus alertas não lidos*, *Tarefas de hoje*, *Onde Parou* e *Projetos em andamento*.

## 3. Regras para qualquer KPI
1. **Nome + pergunta que responde + fonte + período.** Ex.: "Pedidos a separar — quantos pedidos esperam separação agora".
2. **Período explícito no rótulo.** KPI de **estado** ("em aberto agora") não usa o botão de período e diz "agora". KPI de **fluxo** ("no período") usa o botão. Nunca "no período" sem filtrar.
3. **Clicável:** todo KPI leva à tela de onde vem o número, já filtrada.
4. **Sem dado = traço ("—"), não zero.** Zero só quando a consulta funcionou e deu zero.
5. **Meta não mora no código.** Se o KPI tem meta (ex.: conversão), ela vem de uma tabela editável pelo gestor.
6. **No máximo 5 KPIs por perfil.**

## 4. KPIs por perfil
"Existe" = já está na tela hoje (pode precisar de correção). "Novo" = não existe. Todas as fontes abaixo são tabelas que o Dashboard já lê ou que existem no banco.

### Comercial
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Leads novos | fluxo (período) | leads criados no período, não excluídos | `leads` — existe ("Leads do mês", sem período) |
| Cotações em preço | estado (agora) | cotações com etapa aberta de resposta do fornecedor ou de precificação | `gatilhos` — existe ("Cot. em China", renomear) |
| Propostas aguardando o cliente | estado (agora) | propostas enviadas/visualizadas ainda sem resposta | `propostas` — novo |
| Propostas assinadas | fluxo (período) | propostas aprovadas no período | `propostas.aprovada_em` — existe |
| Conversão Lead→Proposta | fluxo (período) | regra atual, com a meta lida de tabela | `leads` + `propostas` — existe (meta fixa no código) |

### Financeiro
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Sinais a confirmar | estado | propostas aprovadas cujo sinal ainda não foi marcado como pago | `avais_financeiros.sinal_pago` — novo |
| Avais de pagamento pendentes | estado | etapa "Aval de Pagamento" aberta | `gatilhos` — novo |
| Etapas com prazo vencido | estado | etapas abertas além do prazo (mesma regra de Prazos & Pendências) | `gatilhos` — existe ("próx. 7d", corrigir para "vencidas") |
| Parcelas de instalador liberadas | estado | parcelas liberadas e não pagas, de contrato assinado | `contrato_instalador_parcelas` — novo [a conferir colunas] |
| Comissões pendentes | estado | soma das aguardando pagamento; **esconde o cartão enquanto a tabela estiver vazia** | `comissoes` — existe (tabela vazia hoje) |

"A receber" sai da lista até o Financeiro dizer o que ele quer contar (ver pergunta 3): hoje o cálculo compara com `Assinado` e conta contrato já assinado como "a receber".

### Engenharia
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Projetos aguardando assinatura do cliente | estado | cotações com Projeto de Instalação ainda não assinado (é o 3º aval da compra) | `projetos_elevador_desenhos` + `documento_signatarios` — novo |
| Equipamentos com dado a conferir | estado | equipamentos da Evolução com achado (hoje 23 de 58) | regra de `evolucao-conferir-calc.js` — novo |
| Obras em instalação | estado | dossiês em "Instalação" | `dossier_obra` — novo |
| Solicitações de produto em aberto | estado | solicitações não concluídas | `solicitacoes_produto` — novo |
| Alertas de engenharia | estado | alertas abertos do módulo | `alertas` — existe |

### Logística (perfil novo)
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Pedidos a separar | estado | pedidos na etapa 20 ainda não separados, com os fora do SLA em destaque | `separacao_tv_dados` / `estoque_separacoes` — novo |
| OPs atrasadas | estado | ordens abertas com prazo vencido | `pcp_ordens` — novo |
| Itens críticos para compra | estado | itens da Reposição em situação crítica (hoje 34) | `pcp_reposicao` / `reposicao-calc.js` — novo |
| Prontos para expedir | estado | pedidos com NF emitida e despacho pendente | `pcp_expedicoes` — novo |
| Ajustes de estoque pendentes | estado | contagens com diferença aguardando decisão | `estoque_movimentos` — novo |

### Importação (perfil novo)
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Embarques em trânsito | estado | status "Em trânsito" (hoje 4) | `embarques` — existe (hoje só no Admin) |
| Chegadas em 30 dias | estado | embarques com ETA nos próximos 30 dias | `embarques_importacao` — novo |
| Cotações de varejo em aberto | estado | lotes em cotação | `iv_cotacao_lotes` — novo |
| Avais jurídicos pendentes | estado | avais jurídicos aguardando decisão | `avais_juridicos` — novo |
| Itens com Dia D vencido | estado | produtos da Compras com Dia D vencido | `iv_compras_carga()` — novo |

### Diretoria / Administrador
| KPI | Tipo | Definição | Fonte |
|---|---|---|---|
| Decisões aguardando você | estado | decisões pendentes em que a pessoa é aprovadora | `decisoes_gerenciais` — novo |
| Projetos ativos | estado | cotações na esteira | `gatilhos` + `formularios_elevador` — existe (hoje usa período) |
| Faturamento (propostas assinadas) | fluxo (período) | soma de `valor_total` das aprovadas | `propostas` — existe |
| Embarques em trânsito | estado | idem Importação | `embarques` — existe |
| Alertas críticos | estado | regra atual (alertas `danger` + 3 checagens cruzadas) | `alertas` + cruzamentos — existe |

### Geral (Marketing, Gente & Gestão, sem departamento)
Só os blocos comuns (decisões, alertas, tarefas, Onde Parou). Sem KPI próprio por enquanto.

## 5. Ordem de execução sugerida
- **Fase 0 — corrigir o que está errado** (sem mudar a lista): "A receber" e "Contratos abertos" (comparação com `Assinado`), "Propostas enviadas" que diz "no período" mas não filtra, e o período padrão "Hoje" que esvazia o Admin (sugestão: padrão **30 dias**).
- **Fase 1 — perfil pelo usuário + saudação pelo e-mail.**
- **Fase 2 — KPIs de Comercial, Financeiro, Engenharia e Diretoria** como na tabela.
- **Fase 3 — perfis Logística e Importação.**

Cada fase é uma entrega separada, com spec no documento do módulo e "Confirmo" para qualquer migration.

## 6. Perguntas para o Gelson
1. Criar já os perfis **Logística** (16 pessoas, o maior grupo) e **Importação**, ou começar só com os 4 que existem?
2. O período padrão do Dashboard passa a ser **30 dias**?
3. O que o Financeiro chama de **"A receber"**: sinal + parcelas de contratos de venda assinados ainda não pagos? Existe esse dado de parcela de venda no sistema? **[a conferir]**
4. A **meta de conversão** (25%) deve ficar numa tabela editável por qual perfil?
